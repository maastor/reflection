// reflection → OpenClaw install / uninstall helper.
//
// Ported from caveman's bin/lib/openclaw.js. Drops a copy of
// skills/reflection/SKILL.md into <workspace>/skills/reflection/ (with
// OpenClaw frontmatter) so it's discoverable via `openclaw skills list`, and
// appends a marker-fenced bootstrap block to <workspace>/SOUL.md describing the
// /reflection trigger. Idempotent; uninstall strips both while preserving
// user-authored content.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SKILL_NAME = 'reflection';
const SKILL_VERSION = '0.1.0';
const MARK_BEGIN = '<!-- reflection-begin -->';
const MARK_END = '<!-- reflection-end -->';
const SOUL_FILE = 'SOUL.md';

function resolveWorkspace(env = process.env) {
  if (env.OPENCLAW_WORKSPACE) return path.resolve(env.OPENCLAW_WORKSPACE);
  return path.join(os.homedir(), '.openclaw', 'workspace');
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
}

// ── Frontmatter helpers ───────────────────────────────────────────────────
function splitFrontmatter(src) {
  if (!src.startsWith('---\n') && !src.startsWith('---\r\n')) {
    return { frontmatter: '', body: src };
  }
  const after = src.slice(src.indexOf('\n') + 1);
  const endRe = /(^|\n)---\s*(\r?\n|$)/;
  const m = endRe.exec(after);
  if (!m) return { frontmatter: '', body: src };
  const fmEnd = m.index + (m[1] ? 1 : 0);
  const fm = after.slice(0, fmEnd);
  const rest = after.slice(m.index + m[0].length);
  return { frontmatter: fm, body: rest };
}

function frontmatterHasKey(fm, key) {
  const re = new RegExp('(^|\\n)' + key + '\\s*:', 'i');
  return re.test(fm);
}

function mergeOpenclawFrontmatter(src) {
  const { frontmatter, body } = splitFrontmatter(src);
  const additions = [];
  if (!frontmatterHasKey(frontmatter, 'name')) additions.push(`name: ${SKILL_NAME}`);
  if (!frontmatterHasKey(frontmatter, 'version')) additions.push(`version: ${SKILL_VERSION}`);
  if (additions.length === 0 && frontmatter) return src;
  const fmBody = (frontmatter ? frontmatter.trimEnd() + '\n' : '') + additions.join('\n') + (additions.length ? '\n' : '');
  return '---\n' + fmBody + '---\n' + body;
}

// ── Bootstrap snippet load ────────────────────────────────────────────────
function loadBootstrapSnippet(repoRoot) {
  if (repoRoot) {
    const p = path.join(repoRoot, 'src', 'rules', 'reflection-openclaw-bootstrap.md');
    const body = readIfExists(p);
    if (body) return body.endsWith('\n') ? body : body + '\n';
  }
  return [
    MARK_BEGIN,
    '## Reflection (self-improvement loop)',
    '',
    'When asked to "reflect", "reflect on the codebase", or run "/reflection":',
    'pick ONE question about the codebase, investigate deeply, surface ONE',
    'validated issue (cite file:line), propose a minimal fix (YAGNI) — wait for',
    'approval before editing — then log the outcome to reflection-changelog.md.',
    '',
    "The full methodology and question bank live in this workspace's skill:",
    '',
    '  skills/reflection/SKILL.md',
    '',
    'One question, one issue, one minimal fix per round. Be brief.',
    MARK_END,
    '',
  ].join('\n');
}

function loadSkillBody(repoRoot) {
  if (!repoRoot) return null;
  return readIfExists(path.join(repoRoot, 'skills', 'reflection', 'SKILL.md'));
}

// ── SOUL.md marker-block append/strip ─────────────────────────────────────
function appendBootstrapToSoul(soulPath, snippet) {
  const existing = readIfExists(soulPath);
  if (existing && existing.includes(MARK_BEGIN) && existing.includes(MARK_END)) {
    return { changed: false, reason: 'already present' };
  }
  let next;
  if (existing && existing.length) {
    const sep = existing.endsWith('\n\n') ? '' : (existing.endsWith('\n') ? '\n' : '\n\n');
    next = existing + sep + snippet;
  } else {
    next = snippet;
  }
  fs.writeFileSync(soulPath, next, { mode: 0o644 });
  return { changed: true };
}

function stripBootstrapFromSoul(soulPath) {
  const existing = readIfExists(soulPath);
  if (!existing) return { changed: false, reason: 'no SOUL.md' };
  const begin = existing.indexOf(MARK_BEGIN);
  const end = existing.indexOf(MARK_END);
  if (begin === -1 || end === -1 || end <= begin) return { changed: false, reason: 'no marker block' };
  const before = existing.slice(0, begin);
  const after = existing.slice(end + MARK_END.length);
  let next = (before.replace(/\n+$/, '\n') + after.replace(/^\n+/, '\n')).trimEnd();
  next = next ? next + '\n' : '';
  if (next === '') {
    try { fs.unlinkSync(soulPath); } catch (_) {}
    return { changed: true, removed: true };
  }
  fs.writeFileSync(soulPath, next, { mode: 0o644 });
  return { changed: true };
}

// ── Public API ────────────────────────────────────────────────────────────
function installOpenclaw({ workspace, repoRoot, dryRun = false, force = false, log = noopLog() } = {}) {
  const ws = workspace || resolveWorkspace();
  const skillBody = loadSkillBody(repoRoot);
  if (!skillBody) {
    log.warn('  openclaw install requires the reflection repo on disk (skills/reflection/SKILL.md missing).');
    log.note('  Re-run from a clone.');
    return { ok: false, reason: 'repo not available' };
  }
  const snippet = loadBootstrapSnippet(repoRoot);

  if (!fs.existsSync(ws)) {
    if (!force) {
      log.warn(`  openclaw workspace not found at ${ws}.`);
      log.note('  Install OpenClaw and re-run, or pass --force to mkdir.');
      return { ok: false, reason: 'workspace missing' };
    }
    if (!dryRun) fs.mkdirSync(ws, { recursive: true });
  }

  const skillDir = path.join(ws, 'skills', SKILL_NAME);
  const skillFile = path.join(skillDir, 'SKILL.md');
  const soulFile = path.join(ws, SOUL_FILE);

  if (dryRun) {
    log.note(`  would write ${skillFile} (with version frontmatter)`);
    log.note(`  would ${fs.existsSync(soulFile) ? 'append to' : 'create'} ${soulFile} (reflection bootstrap block)`);
    return { ok: true, dryRun: true };
  }

  fs.mkdirSync(skillDir, { recursive: true });
  const merged = mergeOpenclawFrontmatter(skillBody);
  fs.writeFileSync(skillFile, merged, { mode: 0o644 });
  log.write(`  installed: ${skillFile}\n`);

  const soul = appendBootstrapToSoul(soulFile, snippet);
  if (soul.changed) log.write(`  wrote bootstrap block to ${soulFile}\n`);
  else log.note(`  ${soulFile} already contains reflection bootstrap`);

  return { ok: true };
}

function uninstallOpenclaw({ workspace, dryRun = false, log = noopLog() } = {}) {
  const ws = workspace || resolveWorkspace();
  const skillDir = path.join(ws, 'skills', SKILL_NAME);
  const soulFile = path.join(ws, SOUL_FILE);

  let touched = false;

  if (fs.existsSync(skillDir)) {
    if (dryRun) {
      log.note(`  would remove ${skillDir}/`);
    } else {
      try { fs.rmSync(skillDir, { recursive: true, force: true }); } catch (_) {}
      log.note(`  removed ${skillDir}`);
    }
    touched = true;
  }

  if (fs.existsSync(soulFile)) {
    if (dryRun) {
      log.note(`  would strip reflection block from ${soulFile}`);
      touched = true;
    } else {
      const r = stripBootstrapFromSoul(soulFile);
      if (r.changed) {
        log.note(r.removed ? `  removed ${soulFile}` : `  stripped reflection block from ${soulFile}`);
        touched = true;
      }
    }
  }

  return { ok: true, touched };
}

function noopLog() {
  return { write: (_) => {}, note: (_) => {}, warn: (_) => {} };
}

module.exports = {
  installOpenclaw,
  uninstallOpenclaw,
  resolveWorkspace,
  mergeOpenclawFrontmatter,
  splitFrontmatter,
  appendBootstrapToSoul,
  stripBootstrapFromSoul,
  loadBootstrapSnippet,
  MARK_BEGIN,
  MARK_END,
  SKILL_NAME,
  SKILL_VERSION,
};
