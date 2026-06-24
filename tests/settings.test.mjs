import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = require(path.join(root, 'bin/lib/settings.js'));

test('stripJsonComments removes // and /* */ but not inside strings', () => {
  const src = '{\n  "a": 1, // line\n  /* block */ "b": "http://x", // trailing\n}';
  const obj = JSON.parse(S.stripJsonComments(src));
  assert.equal(obj.a, 1);
  assert.equal(obj.b, 'http://x');
});

test('addCommandHook is idempotent on the marker', () => {
  const settings = {};
  const a = S.addCommandHook(settings, 'SessionStart', {
    command: '"node" "/x/reflection-activate.js"', marker: 'reflection-activate', timeout: 5,
  });
  const b = S.addCommandHook(settings, 'SessionStart', {
    command: '"node" "/x/reflection-activate.js"', marker: 'reflection-activate', timeout: 5,
  });
  assert.equal(a, true);
  assert.equal(b, false);
  assert.equal(settings.hooks.SessionStart.length, 1);
});

test('removeReflectionHooks strips only reflection entries', () => {
  const settings = { hooks: { UserPromptSubmit: [
    { hooks: [{ type: 'command', command: '"node" "/x/reflection-tracker.js"' }] },
    { hooks: [{ type: 'command', command: '"node" "/x/other.js"' }] },
  ] } };
  const removed = S.removeReflectionHooks(settings, 'reflection');
  assert.equal(removed, 1);
  assert.equal(settings.hooks.UserPromptSubmit.length, 1);
  assert.match(settings.hooks.UserPromptSubmit[0].hooks[0].command, /other\.js/);
});

test('validateHookFields drops malformed entries', () => {
  const settings = { hooks: { SessionStart: [
    { hooks: [{ type: 'command', command: '' }] },     // empty command → dropped
    { hooks: [{ type: 'command', command: 'ok' }] },   // valid
    'garbage',                                          // not an object → dropped
  ] } };
  S.validateHookFields(settings);
  assert.equal(settings.hooks.SessionStart.length, 1);
});

test('pruneOrphanedManagedHooks removes hooks whose script is missing', () => {
  const settings = { hooks: { SessionStart: [
    { hooks: [{ type: 'command', command: '"node" "/definitely/missing/reflection-activate.js"' }] },
  ] } };
  const removed = S.pruneOrphanedManagedHooks(settings, '/tmp');
  assert.equal(removed, 1);
  assert.equal(settings.hooks, undefined);
});
