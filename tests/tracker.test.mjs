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
  return { configDir, cwd, flag: path.join(configDir, '.reflection-active') };
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
