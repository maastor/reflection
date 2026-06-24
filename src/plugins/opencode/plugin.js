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
  safeWriteFlag, readFlag, getAutoDefault, getLoopConfig, parseLoopArgs,
} = config;

function opencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  return path.join(os.homedir(), '.config', 'opencode');
}

const ocDir = opencodeConfigDir();
const flagPath = path.join(ocDir, '.reflection-active');
const autoPath = path.join(ocDir, '.reflection-auto');
const loopPath = path.join(ocDir, '.reflection-loop');

function clearAll() {
  for (const p of [flagPath, autoPath, loopPath]) {
    try { if (existsSync(p)) unlinkSync(p); } catch (e) {}
  }
}

function questionFor(slug) {
  const hit = getQuestions().find(([s]) => s === slug);
  return hit ? hit[1] : slug;
}

function reminderLine(slug) {
  if (existsSync(loopPath)) {
    return 'REFLECTION LOOP ACTIVE. Keep iterating: pick a fresh question, find one validated issue, ' +
      'apply + commit the fix (reflection(<slug>): …), log it, and watch the time/round budget. ' +
      'Stop on timeout / max rounds / clean streak, or /reflection stop.';
  }
  if (existsSync(autoPath)) {
    return 'REFLECTION ACTIVE (auto-apply) on: "' + questionFor(slug) + '" (slug: ' + slug + '). ' +
      'Find one validated issue (file:line), apply the minimal fix, commit it (reflection(' + slug +
      '): …), then log to reflection-changelog.md.';
  }
  return 'REFLECTION ACTIVE on: "' + questionFor(slug) + '" (slug: ' + slug + '). ' +
    'Reflect on ONE concrete issue (cite file:line, validate it), propose a minimal fix (YAGNI) — ' +
    'wait for approval before editing — then log to reflection-changelog.md.';
}

const AUTO_TOKENS = new Set(['auto', 'yolo', '--auto', '-y']);

// Parse a prompt → { action: 'start'|'stop'|'loop', slug?, auto?, tokens? } or null.
function parseChange(promptRaw) {
  let prompt = (promptRaw || '').trim();
  const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
  if (wrapped) prompt = wrapped[2].trim();
  prompt = prompt.toLowerCase();
  if (!prompt) return null;

  // Deactivation first.
  if (/^\/reflection(?::reflection)?(?:-loop)?\s+(stop|done|off|end)\b/.test(prompt) ||
      /\b(stop|end|finish|deactivate|turn off|halt)\b.*\breflection\b/.test(prompt) ||
      /\breflection\b.*\b(stop|done|off|end|finished|halt)\b/.test(prompt)) {
    return { action: 'stop' };
  }

  // Loop — slash command or expanded command-file body.
  const loopSlash = /^\/reflection(?::reflection)?-loop\b(.*)$/.exec(prompt);
  const loopTpl = /^start an autonomous reflection loop\.\s*(.*)$/.exec(prompt);
  if (loopSlash || loopTpl) {
    const tokens = ((loopSlash ? loopSlash[1] : loopTpl[1]) || '').trim().split(/\s+/).filter(Boolean);
    return { action: 'loop', tokens };
  }

  // Single round — slash command or expanded "Begin a reflection round. …" body.
  const tpl = /^begin a reflection round\.\s*(.*)$/.exec(prompt);
  const slash = /^\/reflection(?::reflection)?\b(.*)$/.exec(prompt);
  if (tpl || slash) {
    const tokens = ((slash ? slash[1] : tpl[1]) || '').trim().split(/\s+/).filter(Boolean);
    let slug = null, auto = false;
    for (const t of tokens) {
      if (AUTO_TOKENS.has(t)) auto = true;
      else if (getQuestions().some(([s]) => s === t)) slug = t;
    }
    return { action: 'start', slug, auto };
  }

  if (/\breflect\b.*\b(codebase|code|repo|repository|project)\b/.test(prompt) ||
      /\breflection mode\b/.test(prompt) ||
      /\bself[-\s]?review\b/.test(prompt)) {
    return { action: 'start', slug: null, auto: /\bauto[-\s]?(fix|apply)?\b/.test(prompt) };
  }

  return null;
}

function pickRandom() {
  const cwd = process.cwd();
  const recent = recentSlugs(path.join(cwd, 'reflection-changelog.md'), getRotationWindow(cwd));
  return pickSlug(getQuestions({ cwd }), recent, Math.random());
}

function applyChange(change) {
  if (!change) return;
  if (change.action === 'stop') { clearAll(); return; }
  if (change.action === 'loop') {
    const cfg = parseLoopArgs(change.tokens, getLoopConfig(process.cwd()));
    const slug = pickRandom();
    if (!slug) return;
    safeWriteFlag(flagPath, slug);
    safeWriteFlag(autoPath, '1');
    safeWriteFlag(loopPath, 'timeout=' + cfg.timeoutMin + 'm rounds=' + cfg.maxRounds + ' clean=' + cfg.cleanStreak);
    return;
  }
  if (change.action === 'start') {
    const slug = change.slug || pickRandom();
    if (!slug) return;
    safeWriteFlag(flagPath, slug);
    const auto = change.auto || getAutoDefault(process.cwd());
    if (auto) safeWriteFlag(autoPath, '1');
    else { try { if (existsSync(autoPath)) unlinkSync(autoPath); } catch (e) {} }
    try { if (existsSync(loopPath)) unlinkSync(loopPath); } catch (e) {}
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
