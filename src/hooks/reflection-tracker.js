#!/usr/bin/env node
// reflection — UserPromptSubmit hook. The brain of the loop.
//
// Responsibilities:
//   1. /reflection-log [slug] → block the prompt, inject a changelog summary.
//   2. Start a round: /reflection [slug] or natural-language ("reflect on the
//      codebase", "reflection mode"). Picks a question (forced slug, or random
//      skipping recently-used slugs from reflection-changelog.md), writes the
//      flag, and injects the REFLECTION MODE goal block.
//   3. Stop a round: /reflection stop|done|off, or "stop reflection". Clears flag.
//   4. Per-turn reinforcement: while a round is active, re-inject a short
//      reminder so the agent stays anchored to its question across turns.
//
// Reflection is NOT always-on. Nothing activates unless the user asks.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const {
  getQuestions, getRotationWindow, recentSlugs, pickSlug,
  safeWriteFlag, readFlag, clearFlag,
} = require('./reflection-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.reflection-active');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    handle(JSON.parse(input || '{}'));
  } catch (e) {
    // Silent fail — never block a session over a hook error.
  }
});

function emitContext(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: text,
    },
  }));
}

function questionFor(slug, questions) {
  const hit = questions.find(([s]) => s === slug);
  return hit ? hit[1] : null;
}

function goalBlock(slug, question) {
  return (
    'REFLECTION MODE ACTIVE — focus this round:\n' +
    '"' + question + '"  (slug: ' + slug + ')\n\n' +
    'Reflect deeply on ONE concrete instance in THIS codebase:\n' +
    '1. Read reflection-changelog.md first — avoid repeats; verify whether past fixes landed.\n' +
    '2. Investigate. Read code; verify, don\'t guess. Optionally delegate a fresh-context deep dive to the `reflector` subagent.\n' +
    '3. Find ONE specific, real issue. Cite file:line. Validate it (repro / trace) before claiming it.\n' +
    '4. Propose a minimal fix (YAGNI). Do NOT edit yet — wait for approval.\n' +
    '5. After it\'s resolved, append an entry to reflection-changelog.md (keep the <!-- q:' + slug + ' --> marker).\n' +
    'Be brief. One issue per round. Stop when logged or the user says "stop reflection".'
  );
}

function reminderLine(slug, question) {
  return (
    'REFLECTION ACTIVE on: "' + question + '" (slug: ' + slug + '). ' +
    'Stay on this question. Validate before claiming. Propose a minimal fix, await approval, then log to reflection-changelog.md.'
  );
}

function handle(data) {
  const cwd = data.cwd || process.cwd();
  const rawPrompt = (data.prompt || '').trim();
  const prompt = rawPrompt.toLowerCase();

  // 1. /reflection-log [args] — block + inject summary.
  const logMatch = /^\/reflection(?::reflection)?-log(?:\s+(.*))?$/.exec(prompt);
  if (logMatch) {
    let out;
    try {
      const argv = [path.join(__dirname, 'reflection-log.js'), '--cwd', cwd];
      out = execFileSync(process.execPath, argv, { encoding: 'utf8', timeout: 5000 }).trim();
    } catch (e) {
      out = 'reflection-log: could not read reflection-changelog.md. Run /reflection-init to create it.';
    }
    process.stdout.write(JSON.stringify({ decision: 'block', reason: out }));
    return;
  }

  // 2. Deactivation — checked before activation so "stop reflection" doesn't
  //    trip the activation regex.
  const isStopCmd = /^\/reflection(?::reflection)?\s+(stop|done|off|end)\b/.test(prompt);
  const isStopNL = /\b(stop|end|finish|deactivate|turn off)\b.*\breflection\b/.test(prompt) ||
                   /\breflection\b.*\b(stop|done|off|end|finished)\b/.test(prompt);
  if (isStopCmd || isStopNL) {
    clearFlag(flagPath);
    emitContext('Reflection round ended. Flag cleared.');
    return;
  }

  const questions = getQuestions({ cwd });

  // 3. Activation. Slash command or natural language.
  let startSlug = null;
  let starting = false;

  const slashMatch = /^\/reflection(?::reflection)?(?:\s+(\S+))?\s*$/.exec(prompt);
  if (slashMatch) {
    starting = true;
    const arg = slashMatch[1];
    if (arg && questions.some(([s]) => s === arg)) startSlug = arg;
  } else if (
    /\breflect\b.*\b(codebase|code|repo|repository|project)\b/.test(prompt) ||
    /\breflection mode\b/.test(prompt) ||
    /\bself[-\s]?review\b/.test(prompt) ||
    (/\breflect\b/.test(prompt) && !readFlag(flagPath))
  ) {
    starting = true;
  }

  if (starting) {
    if (!startSlug) {
      const k = getRotationWindow(cwd);
      const recent = recentSlugs(path.join(cwd, 'reflection-changelog.md'), k);
      startSlug = pickSlug(questions, recent, Math.random());
    }
    if (startSlug) {
      const question = questionFor(startSlug, questions) || startSlug;
      safeWriteFlag(flagPath, startSlug);
      emitContext(goalBlock(startSlug, question));
      return;
    }
  }

  // 4. Per-turn reinforcement when a round is active.
  const active = readFlag(flagPath);
  if (active) {
    const question = questionFor(active, questions) || active;
    emitContext(reminderLine(active, question));
  }
}
