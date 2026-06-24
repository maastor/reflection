// reflection — opencode plugin.
//
// Provides the on-demand reflection loop for opencode:
// - Parses user messages for /reflection [slug] start, /reflection stop, and
//   natural-language toggles. On start, picks a question (random, skipping
//   recently-used slugs from reflection-changelog.md) and writes the flag.
// - Injects a per-turn reminder into the system prompt while a round is active.
//
// Reflection is NOT always-on — nothing activates unless the user asks.
//
// Bun ESM module; loads the security-hardened helpers from reflection-config.js
// via a hand-rolled CommonJS eval (opencode's compiled Bun binary rejects
// require()/import() of on-disk CJS files), mirroring caveman's bridge.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function loadConfig() {
  const installed = join(here, 'reflection-config.cjs');
  const dev = join(here, '..', '..', 'hooks', 'reflection-config.js');
  const target = existsSync(installed) ? installed : dev;
  const code = readFileSync(target, 'utf8').replace(/^#![^\n]*\n/, '');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', '__filename', code)(
    mod, mod.exports, createRequire(import.meta.url), dirname(target), target
  );
  return mod.exports;
}
const config = loadConfig();

const {
  getQuestions, getRotationWindow, recentSlugs, pickSlug,
  safeWriteFlag, readFlag,
} = config;

function opencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  return path.join(os.homedir(), '.config', 'opencode');
}

const flagPath = path.join(opencodeConfigDir(), '.reflection-active');

function questionFor(slug) {
  const hit = getQuestions().find(([s]) => s === slug);
  return hit ? hit[1] : slug;
}

function reminderLine(slug) {
  return (
    'REFLECTION ACTIVE on: "' + questionFor(slug) + '" (slug: ' + slug + '). ' +
    'Reflect on ONE concrete issue (cite file:line, validate it), propose a minimal ' +
    'fix (YAGNI) — wait for approval before editing — then log to reflection-changelog.md.'
  );
}

// Parse a prompt → { action: 'start'|'stop', slug? } or null.
function parseChange(promptRaw) {
  let prompt = (promptRaw || '').trim();
  const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
  if (wrapped) prompt = wrapped[2].trim();
  prompt = prompt.toLowerCase();
  if (!prompt) return null;

  // Deactivation first.
  if (/^\/reflection(?::reflection)?\s+(stop|done|off|end)\b/.test(prompt) ||
      /\b(stop|end|finish|deactivate|turn off)\b.*\breflection\b/.test(prompt) ||
      /\breflection\b.*\b(stop|done|off|end|finished)\b/.test(prompt)) {
    return { action: 'stop' };
  }

  // opencode expands the /reflection command file body before chat.message
  // fires; recover the slug from the template's first line if present.
  const tpl = /^begin a reflection round\.\s*(\S*)/.exec(prompt);
  if (tpl) {
    const arg = tpl[1] || '';
    return { action: 'start', slug: validSlug(arg) };
  }

  if (prompt.startsWith('/reflection')) {
    const parts = prompt.split(/\s+/);
    if (parts[0] === '/reflection' || parts[0] === '/reflection:reflection') {
      return { action: 'start', slug: validSlug(parts[1] || '') };
    }
  }

  if (/\breflect\b.*\b(codebase|code|repo|repository|project)\b/.test(prompt) ||
      /\breflection mode\b/.test(prompt) ||
      /\bself[-\s]?review\b/.test(prompt)) {
    return { action: 'start', slug: null };
  }

  return null;
}

function validSlug(arg) {
  if (!arg) return null;
  return getQuestions().some(([s]) => s === arg) ? arg : null;
}

function applyChange(change) {
  if (!change) return;
  if (change.action === 'stop') {
    try { if (existsSync(flagPath)) unlinkSync(flagPath); } catch (e) {}
    return;
  }
  if (change.action === 'start') {
    let slug = change.slug;
    if (!slug) {
      const cwd = process.cwd();
      const recent = recentSlugs(path.join(cwd, 'reflection-changelog.md'), getRotationWindow(cwd));
      slug = pickSlug(getQuestions({ cwd }), recent, Math.random());
    }
    if (slug) safeWriteFlag(flagPath, slug);
  }
}

export const ReflectionPlugin = async (_ctx) => {
  return {
    'chat.message': async (_input, output) => {
      if (!output || !output.parts) return;
      for (const part of output.parts) {
        if (part && part.type === 'text' && part.text) {
          const change = parseChange(part.text);
          if (change) applyChange(change);
        }
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      if (!output || !Array.isArray(output.system)) return;
      const active = readFlag(flagPath);
      if (active) output.system.push(reminderLine(active));
    },
  };
};

export default ReflectionPlugin;
