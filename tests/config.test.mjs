import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = require(path.join(root, 'src/hooks/reflection-config.js'));

test('getQuestions parses the SKILL.md bank (15 slugs, unique)', () => {
  const skillPath = path.join(root, 'skills/reflection/SKILL.md');
  const parsed = config.parseQuestionsFromSkill(skillPath);
  assert.ok(parsed, 'should parse a table');
  assert.equal(parsed.length, 15);
  const slugs = parsed.map(([s]) => s);
  assert.equal(new Set(slugs).size, 15, 'slugs unique');
  for (const s of slugs) assert.match(s, config.SLUG_RE);
  assert.ok(slugs.includes('tests'));
  assert.ok(slugs.includes('security'));
});

test('getQuestions falls back to DEFAULT_QUESTIONS when SKILL.md missing', () => {
  const qs = config.getQuestions({ skillPath: '/nonexistent/SKILL.md', cwd: os.tmpdir() });
  assert.ok(qs.length >= 15);
});

test('config questions override via .reflection/config.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refl-cfg-'));
  fs.mkdirSync(path.join(dir, '.reflection'));
  fs.writeFileSync(path.join(dir, '.reflection/config.json'), JSON.stringify({
    questions: [['alpha', 'A?'], ['beta', 'B?']],
    rotationWindow: 1,
  }));
  const qs = config.getQuestions({ cwd: dir });
  assert.deepEqual(qs.map(([s]) => s), ['alpha', 'beta']);
  assert.equal(config.getRotationWindow(dir), 1);
});

test('pickSlug avoids recent slugs, resets when pool exhausted', () => {
  const qs = [['a', '?'], ['b', '?'], ['c', '?']];
  // recent excludes a,b → only c available, regardless of r
  assert.equal(config.pickSlug(qs, ['a', 'b'], 0), 'c');
  assert.equal(config.pickSlug(qs, ['a', 'b'], 0.99), 'c');
  // all recent → pool resets to full bank, r=0 → first
  assert.equal(config.pickSlug(qs, ['a', 'b', 'c'], 0), 'a');
});

test('recentSlugs extracts trailing markers newest-last', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refl-log-'));
  const p = path.join(dir, 'reflection-changelog.md');
  fs.writeFileSync(p, [
    '# Reflection Changelog',
    '## 2026-01-01 — bugs: x <!-- q:bugs -->',
    '## 2026-01-02 — tests: y <!-- q:tests -->',
    '## 2026-01-03 — security: z <!-- q:security -->',
  ].join('\n'));
  assert.deepEqual(config.recentSlugs(p, 2), ['tests', 'security']);
  assert.deepEqual(config.recentSlugs(p, 10), ['bugs', 'tests', 'security']);
  assert.deepEqual(config.recentSlugs('/nope/x.md', 5), []);
});

test('flag write/read/clear round-trips and rejects bad slugs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refl-flag-'));
  const flag = path.join(dir, '.reflection-active');
  config.safeWriteFlag(flag, 'tests');
  assert.equal(config.readFlag(flag), 'tests');
  config.clearFlag(flag);
  assert.equal(config.readFlag(flag), null);
  // oversized / invalid content rejected on read
  fs.writeFileSync(flag, 'NOT A SLUG !!!');
  assert.equal(config.readFlag(flag), null);
});
