#!/usr/bin/env node
// reflection — SessionStart hook.
//
// Reflection is on-demand, NOT always-on. This hook does NOT start a round.
// It only:
//   1. Re-asserts the goal reminder if a round was already mid-flight when the
//      session started/resumed (the flag file persists across sessions).
//   2. Nudges the user to wire the [REFLECT:<slug>] statusline badge if it's
//      not configured yet.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getQuestions, readFlag } = require('./reflection-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.reflection-active');
const settingsPath = path.join(claudeDir, 'settings.json');

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => { run(safeParse(input)); });
// SessionStart may deliver no stdin on some runtimes — guard with a fallback.
process.stdin.on('error', () => { run({}); });
if (process.stdin.isTTY) run({});

let done = false;
function run(data) {
  if (done) return; done = true;
  const cwd = (data && data.cwd) || process.cwd();
  let out = '';

  const active = readFlag(flagPath);
  if (active) {
    const questions = getQuestions({ cwd });
    const hit = questions.find(([s]) => s === active);
    const question = hit ? hit[1] : active;
    out +=
      'REFLECTION ROUND IN PROGRESS on: "' + question + '" (slug: ' + active + '). ' +
      'Resume the loop: surface one validated issue, propose a minimal fix, log to ' +
      'reflection-changelog.md. Run /reflection stop to end it.';
  }

  out += statuslineNudge();
  process.stdout.write(out || 'OK');
}

function statuslineNudge() {
  try {
    let hasStatusline = false;
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.statusLine) hasStatusline = true;
    }
    if (hasStatusline) return '';
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'reflection-statusline.ps1' : 'reflection-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    const command = isWindows
      ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      : `bash "${scriptPath}"`;
    const snippet = '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
    return (
      '\n\nSTATUSLINE SETUP AVAILABLE: the reflection plugin ships a statusline badge ' +
      'showing the active question (e.g. [REFLECT:tests]). It is not configured yet. ' +
      'To enable, add this to ' + settingsPath + ': ' + snippet + ' ' +
      'Offer to set this up on first interaction.'
    );
  } catch (e) {
    return '';
  }
}

function safeParse(s) { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } }
