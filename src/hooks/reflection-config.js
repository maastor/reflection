#!/usr/bin/env node
// reflection — shared configuration resolver + flag/changelog helpers.
//
// Resolution order for per-repo settings (rotation window, custom questions):
//   1. REFLECTION_ROTATION_WINDOW env var (rotation window only)
//   2. Repo-local config (checked-in, per-project):
//      - <cwd>/.reflection/config.json
//      - <cwd>/.reflection.json
//      Walks up from process.cwd() to the nearest ancestor containing one of
//      these (stops at filesystem root).
//   3. User config file:
//      - $XDG_CONFIG_HOME/reflection/config.json (any platform, if set)
//      - ~/.config/reflection/config.json (macOS / Linux fallback)
//      - %APPDATA%\reflection\config.json (Windows fallback)
//
// The flag file stores the active question SLUG (e.g. "tests"). Presence of the
// flag = a reflection round is in flight. The symlink-safe flag I/O is lifted
// verbatim from caveman's hardened helpers — a predictable flag path under
// ~/.claude is a clobber/exfil vector otherwise.

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_ROTATION_WINDOW = 5;

// A slug is lowercase letters + hyphens, short. Used to validate flag contents
// (defends the statusline / reinforcement readers against planted bytes).
const SLUG_RE = /^[a-z][a-z-]{0,23}$/;

// Built-in question bank. The canonical source of truth is the table in
// skills/reflection/SKILL.md; getQuestions() parses that at runtime so edits
// propagate. This list is the fallback when SKILL.md can't be read (standalone
// hook install without the skills dir) and the seed for tests.
const DEFAULT_QUESTIONS = [
  ['bugs',            'If there is a bug in this code, where would it be and how can I fix it?'],
  ['refactor',        'Can I refactor this code to make it simpler and clearer?'],
  ['tests',           'Can I improve test coverage or test quality?'],
  ['architecture',    'Can I improve the architecture or separation of concerns?'],
  ['packaging',       'Can I improve the package / module structure or file organization?'],
  ['quality',         'Can I improve code quality — naming, dead code, duplication, complexity?'],
  ['best-practices',  'Am I following the idioms / best practices for this language and its frameworks?'],
  ['performance',     'Are there performance bottlenecks or obvious inefficiencies?'],
  ['error-handling',  'Is error handling robust across edge cases, failures, and resource cleanup?'],
  ['security',        'Are there security weaknesses — input validation, secrets, injection, authz?'],
  ['docs',            'Are docs and comments accurate, sufficient, and free of staleness?'],
  ['dependencies',    'Are dependencies minimal, current, and free of known risks?'],
  ['consistency',     'Is style and convention consistent across the codebase?'],
  ['observability',   'Is there adequate logging / metrics / tracing for production debugging?'],
  ['tooling',         'Can build, CI, lint, or developer tooling be improved?'],
];

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'reflection');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'reflection'
    );
  }
  return path.join(os.homedir(), '.config', 'reflection');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

// Walk up from `start` looking for a repo-local reflection config. Returns the
// absolute path of the first match, or null. Stops at the filesystem root.
// Refuses symlinks — symmetric with safeWriteFlag/readFlag policy.
// Bounded to 64 levels to defend against symlink cycles on pathological mounts.
function findRepoConfigPath(start) {
  try {
    let dir = path.resolve(start || process.cwd());
    const candidates = ['.reflection/config.json', '.reflection.json'];
    for (let i = 0; i < 64; i++) {
      for (const rel of candidates) {
        const p = path.join(dir, rel);
        try {
          const st = fs.lstatSync(p);
          if (st.isSymbolicLink() || !st.isFile()) continue;
          return p;
        } catch (e) { /* not present, try next */ }
      }
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  } catch (e) { /* defensive */ }
  return null;
}

function readConfigFile(configPath) {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// Merge repo config over user config. Repo wins (per-project pinning).
function loadConfig(cwd) {
  let merged = {};
  const userCfg = readConfigFile(getConfigPath());
  if (userCfg && typeof userCfg === 'object') merged = Object.assign(merged, userCfg);
  const repoPath = findRepoConfigPath(cwd || process.cwd());
  if (repoPath) {
    const repoCfg = readConfigFile(repoPath);
    if (repoCfg && typeof repoCfg === 'object') merged = Object.assign(merged, repoCfg);
  }
  return merged;
}

function getRotationWindow(cwd) {
  const env = parseInt(process.env.REFLECTION_ROTATION_WINDOW, 10);
  if (Number.isFinite(env) && env >= 0) return env;
  const cfg = loadConfig(cwd);
  const w = parseInt(cfg.rotationWindow, 10);
  if (Number.isFinite(w) && w >= 0) return w;
  return DEFAULT_ROTATION_WINDOW;
}

// Parse the `| slug | question |` table out of SKILL.md. Returns [[slug, q], ...]
// or null when the file/table can't be read. Header + separator rows are
// skipped (separator has only dashes/pipes/spaces; header slug column is "slug").
function parseQuestionsFromSkill(skillPath) {
  let text;
  try { text = fs.readFileSync(skillPath, 'utf8'); }
  catch (e) { return null; }
  const out = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (!m) continue;
    const slug = m[1].trim();
    const question = m[2].trim();
    // Skip the header row and the |---|---| separator.
    if (slug.toLowerCase() === 'slug') continue;
    if (/^[-:\s]+$/.test(slug)) continue;
    if (!SLUG_RE.test(slug)) continue;
    out.push([slug, question]);
  }
  return out.length ? out : null;
}

// Resolve the question bank. Priority: repo/user config `questions` →
// SKILL.md table → built-in DEFAULT_QUESTIONS.
//
// Config `questions` may be either [["slug","text"], ...] or
// [{slug, question}, ...]. Invalid slugs are dropped.
function getQuestions(opts) {
  opts = opts || {};
  const cfg = loadConfig(opts.cwd);
  if (Array.isArray(cfg.questions) && cfg.questions.length) {
    const out = [];
    for (const q of cfg.questions) {
      let slug, text;
      if (Array.isArray(q)) { slug = q[0]; text = q[1]; }
      else if (q && typeof q === 'object') { slug = q.slug; text = q.question; }
      if (typeof slug === 'string' && SLUG_RE.test(slug) && typeof text === 'string' && text) {
        out.push([slug, text]);
      }
    }
    if (out.length) return out;
  }
  const skillPath = opts.skillPath || defaultSkillPath();
  if (skillPath) {
    const parsed = parseQuestionsFromSkill(skillPath);
    if (parsed) return parsed;
  }
  return DEFAULT_QUESTIONS.slice();
}

// Best-effort location of skills/reflection/SKILL.md relative to this file.
// Plugin install: <root>/hooks/ → <root>/skills/reflection/SKILL.md
// Source tree:    <root>/src/hooks/ → <root>/skills/reflection/SKILL.md
function defaultSkillPath() {
  const candidates = [
    path.join(__dirname, '..', 'skills', 'reflection', 'SKILL.md'),
    path.join(__dirname, '..', '..', 'skills', 'reflection', 'SKILL.md'),
  ];
  for (const p of candidates) {
    try { if (fs.statSync(p).isFile()) return p; } catch (e) {}
  }
  return null;
}

// ── Changelog rotation ──────────────────────────────────────────────────────
// Extract the slugs used in the most recent `k` changelog entries, newest
// first. Entries carry a hidden `<!-- q:<slug> -->` marker on their header line.
// Returns [] on any anomaly (missing file, no markers).
function recentSlugs(changelogPath, k) {
  let text;
  try {
    const st = fs.lstatSync(changelogPath);
    if (st.isSymbolicLink() || !st.isFile()) return [];
    text = fs.readFileSync(changelogPath, 'utf8');
  } catch (e) { return [] }
  // Drop fenced code blocks so the seeded template's example marker isn't
  // mistaken for a logged round.
  const noFences = text.replace(/```[\s\S]*?```/g, '');
  const slugs = [];
  const re = /<!--\s*q:([a-z][a-z-]{0,23})\s*-->/g;
  let m;
  while ((m = re.exec(noFences)) !== null) slugs.push(m[1]);
  // Newest entries are appended at the bottom of the file, so the tail is most
  // recent. Take the last k.
  return k > 0 ? slugs.slice(-k) : [];
}

// Pick a slug from the bank, avoiding the recently-used ones. Pure: caller
// supplies the RNG value (0<=r<1) so it's testable.
function pickSlug(questions, recent, r) {
  const recentSet = new Set(recent || []);
  let pool = questions.filter(([slug]) => !recentSet.has(slug));
  if (!pool.length) pool = questions.slice();
  if (!pool.length) return null;
  const idx = Math.min(pool.length - 1, Math.floor((r || 0) * pool.length));
  return pool[idx][0];
}

// ── Symlink-safe flag file write (lifted from caveman-config.js) ────────────
// Uses O_NOFOLLOW where available, writes atomically via temp + rename with
// 0600 permissions. When the parent dir is a symlink (legit: ~/.claude →
// elsewhere), resolves through and verifies ownership (uid) on Unix / home
// containment on Windows. The flag file itself must never be a symlink.
// Set REFLECTION_DEBUG=1 to log refusals. Silent-fails on fs error.
function safeWriteFlag(flagPath, content) {
  const debug = process.env.REFLECTION_DEBUG === '1';
  try {
    const flagDir = path.dirname(flagPath);
    fs.mkdirSync(flagDir, { recursive: true });

    let realFlagDir;
    try {
      const lstat = fs.lstatSync(flagDir);
      if (lstat.isSymbolicLink()) {
        realFlagDir = fs.realpathSync(flagDir);
        const realStat = fs.statSync(realFlagDir);
        if (!realStat.isDirectory()) {
          if (debug) process.stderr.write(`[reflection] safeWriteFlag: symlink target ${realFlagDir} is not a directory\n`);
          return;
        }
        if (typeof process.getuid === 'function') {
          if (realStat.uid !== process.getuid()) {
            if (debug) process.stderr.write(`[reflection] safeWriteFlag: symlink target ${realFlagDir} owned by uid ${realStat.uid}, not ${process.getuid()}\n`);
            return;
          }
        } else {
          const home = os.homedir();
          const normalizedReal = path.resolve(realFlagDir);
          const normalizedHome = path.resolve(home);
          if (!normalizedReal.toLowerCase().startsWith(normalizedHome.toLowerCase() + path.sep) &&
              normalizedReal.toLowerCase() !== normalizedHome.toLowerCase()) {
            if (debug) process.stderr.write(`[reflection] safeWriteFlag: symlink target ${normalizedReal} outside home ${normalizedHome}\n`);
            return;
          }
        }
      } else {
        realFlagDir = flagDir;
      }
    } catch (e) { return; }

    const realFlagPath = path.join(realFlagDir, path.basename(flagPath));
    try {
      if (fs.lstatSync(realFlagPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const tempPath = path.join(realFlagDir, `.reflection-active.${process.pid}.${process.hrtime.bigint()}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) { /* best-effort on Windows */ }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    fs.renameSync(tempPath, realFlagPath);
  } catch (e) { /* silent — flag is best-effort */ }
}

// Symlink-safe, size-capped, slug-validated flag read. Returns the active slug
// or null on any anomaly.
const MAX_FLAG_BYTES = 64;
function readFlag(flagPath) {
  try {
    let st;
    try { st = fs.lstatSync(flagPath); } catch (e) { return null; }
    if (st.isSymbolicLink() || !st.isFile()) return null;
    if (st.size > MAX_FLAG_BYTES) return null;

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_RDONLY | O_NOFOLLOW;
    let fd, out;
    try {
      fd = fs.openSync(flagPath, flags);
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    const raw = out.trim().toLowerCase();
    if (!SLUG_RE.test(raw)) return null;
    return raw;
  } catch (e) { return null; }
}

function clearFlag(flagPath) {
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

module.exports = {
  DEFAULT_ROTATION_WINDOW,
  DEFAULT_QUESTIONS,
  SLUG_RE,
  getConfigDir,
  getConfigPath,
  findRepoConfigPath,
  loadConfig,
  getRotationWindow,
  parseQuestionsFromSkill,
  getQuestions,
  defaultSkillPath,
  recentSlugs,
  pickSlug,
  safeWriteFlag,
  readFlag,
  clearFlag,
};
