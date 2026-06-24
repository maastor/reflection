import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tracker = path.join(root, 'src/hooks/reflection-tracker.js');

function runTracker(prompt, configDir, cwd) {
  const r = spawnSync(process.execPath, [tracker], {
    input: JSON.stringify({ prompt, cwd }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
  });
  let json = null;
  try { json = JSON.parse(r.stdout || '{}'); } catch (_) {}
  return { raw: r.stdout, json };
}

function tmpDirs() {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refl-cfg-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refl-cwd-'));
  return {
    configDir, cwd,
    flag: path.join(configDir, '.reflection-active'),
    autoFlag: path.join(configDir, '.reflection-auto'),
    loopFlag: path.join(configDir, '.reflection-loop'),
  };
}

test('/reflection starts a round: writes flag + injects goal block', () => {
  const { configDir, cwd, flag } = tmpDirs();
  const { json } = runTracker('/reflection', configDir, cwd);
  assert.ok(json.hookSpecificOutput, 'emits hookSpecificOutput');
  assert.match(json.hookSpecificOutput.additionalContext, /REFLECTION MODE ACTIVE/);
  assert.ok(fs.existsSync(flag), 'flag written');
  assert.match(fs.readFileSync(flag, 'utf8').trim(), /^[a-z][a-z-]*$/);
});

test('/reflection <slug> forces that question', () => {
  const { configDir, cwd, flag } = tmpDirs();
  const { json } = runTracker('/reflection security', configDir, cwd);
  assert.equal(fs.readFileSync(flag, 'utf8').trim(), 'security');
  assert.match(json.hookSpecificOutput.additionalContext, /slug: security/);
});

test('per-turn reminder fires while a round is active', () => {
  const { configDir, cwd } = tmpDirs();
  runTracker('/reflection tests', configDir, cwd);
  const { json } = runTracker('keep going', configDir, cwd);
  assert.match(json.hookSpecificOutput.additionalContext, /REFLECTION ACTIVE on/);
  assert.match(json.hookSpecificOutput.additionalContext, /tests/);
});

test('stop reflection clears the flag', () => {
  const { configDir, cwd, flag } = tmpDirs();
  runTracker('/reflection', configDir, cwd);
  assert.ok(fs.existsSync(flag));
  runTracker('stop reflection', configDir, cwd);
  assert.ok(!fs.existsSync(flag), 'flag cleared');
});

test('rotation: forced slug not repeated when it is the only recent one', () => {
  const { configDir, cwd } = tmpDirs();
  // Seed a changelog with every slug recent EXCEPT "tooling" so random must pick it.
  const slugs = ['bugs','refactor','tests','architecture','packaging','quality',
    'best-practices','performance','error-handling','security','docs',
    'dependencies','consistency','observability'];
  const body = ['# Reflection Changelog',
    ...slugs.map((s,i) => `## 2026-01-${String(i+1).padStart(2,'0')} — ${s}: q <!-- q:${s} -->`)
  ].join('\n');
  fs.writeFileSync(path.join(cwd, 'reflection-changelog.md'), body);
  // rotationWindow default 5 → only last 5 excluded; to force determinism set window high
  fs.mkdirSync(path.join(cwd, '.reflection'));
  fs.writeFileSync(path.join(cwd, '.reflection/config.json'), JSON.stringify({ rotationWindow: 14 }));
  const { configDir: cd, flag } = tmpDirs();
  const { json } = runTracker('/reflection', cd, cwd);
  assert.equal(fs.readFileSync(flag, 'utf8').trim(), 'tooling');
  assert.match(json.hookSpecificOutput.additionalContext, /slug: tooling/);
});

test('/reflection-log blocks the prompt with a summary', () => {
  const { configDir, cwd } = tmpDirs();
  fs.writeFileSync(path.join(cwd, 'reflection-changelog.md'),
    '# Reflection Changelog\n## 2026-01-01 — tests: q <!-- q:tests -->\n**Status:** proposed\n');
  const { json } = runTracker('/reflection-log', configDir, cwd);
  assert.equal(json.decision, 'block');
  assert.match(json.reason, /Reflection log/);
});

test('/reflection auto sets the auto flag + goal mentions auto-apply', () => {
  const { configDir, cwd, flag, autoFlag, loopFlag } = tmpDirs();
  const { json } = runTracker('/reflection auto', configDir, cwd);
  assert.ok(fs.existsSync(flag), 'slug flag written');
  assert.ok(fs.existsSync(autoFlag), 'auto flag written');
  assert.ok(!fs.existsSync(loopFlag), 'loop flag not written');
  assert.match(json.hookSpecificOutput.additionalContext, /auto-apply/);
  assert.match(json.hookSpecificOutput.additionalContext, /git commit -m/);
});

test('/reflection <slug> auto combines slug + auto', () => {
  const { configDir, cwd, flag, autoFlag } = tmpDirs();
  runTracker('/reflection security auto', configDir, cwd);
  assert.equal(fs.readFileSync(flag, 'utf8').trim(), 'security');
  assert.ok(fs.existsSync(autoFlag));
});

test('plain /reflection does not set auto (approval default)', () => {
  const { configDir, cwd, autoFlag } = tmpDirs();
  runTracker('/reflection', configDir, cwd);
  assert.ok(!fs.existsSync(autoFlag), 'no auto flag by default');
});

test('autoApply config makes plain /reflection auto', () => {
  const { configDir, cwd, autoFlag } = tmpDirs();
  fs.mkdirSync(path.join(cwd, '.reflection'));
  fs.writeFileSync(path.join(cwd, '.reflection/config.json'), JSON.stringify({ autoApply: true }));
  runTracker('/reflection', configDir, cwd);
  assert.ok(fs.existsSync(autoFlag), 'auto flag set from config');
});

test('/reflection-loop sets loop + auto flags and injects loop block', () => {
  const { configDir, cwd, flag, autoFlag, loopFlag } = tmpDirs();
  const { json } = runTracker('/reflection-loop 45m rounds=7 clean=3', configDir, cwd);
  assert.ok(fs.existsSync(flag) && fs.existsSync(autoFlag) && fs.existsSync(loopFlag));
  assert.match(fs.readFileSync(loopFlag, 'utf8'), /timeout=45m rounds=7 clean=3/);
  const ctx = json.hookSpecificOutput.additionalContext;
  assert.match(ctx, /REFLECTION LOOP ACTIVE/);
  assert.match(ctx, /up to 45 min/);
  assert.match(ctx, /max 7 rounds/);
  assert.match(ctx, /3 consecutive/);
});

test('loop reminder fires while loop active', () => {
  const { configDir, cwd } = tmpDirs();
  runTracker('/reflection-loop', configDir, cwd);
  const { json } = runTracker('continue', configDir, cwd);
  assert.match(json.hookSpecificOutput.additionalContext, /REFLECTION LOOP ACTIVE/);
});

test('stop clears all three flags', () => {
  const { configDir, cwd, flag, autoFlag, loopFlag } = tmpDirs();
  runTracker('/reflection-loop', configDir, cwd);
  assert.ok(fs.existsSync(flag) && fs.existsSync(autoFlag) && fs.existsSync(loopFlag));
  runTracker('stop reflection', configDir, cwd);
  assert.ok(!fs.existsSync(flag) && !fs.existsSync(autoFlag) && !fs.existsSync(loopFlag));
});

test('starting a plain round after auto clears the stale auto flag', () => {
  const { configDir, cwd, autoFlag } = tmpDirs();
  runTracker('/reflection auto', configDir, cwd);
  assert.ok(fs.existsSync(autoFlag));
  runTracker('/reflection tests', configDir, cwd);
  assert.ok(!fs.existsSync(autoFlag), 'auto flag cleared on plain start');
});
