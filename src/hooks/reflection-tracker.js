#!/usr/bin/env node
// reflection — UserPromptSubmit hook. The brain of the loop.
//
// Responsibilities:
//   1. /reflection-log [slug] → block the prompt, inject a changelog summary.
//   2. /reflection-loop [budget] → start an autonomous loop (auto-apply + commit
//      each fix, rotate questions, until timeout / max rounds / clean streak).
//   3. Start a single round: /reflection [slug] [auto] or natural language.
//      "auto" (or config autoApply) applies + commits the fix without approval.
//   4. Stop: /reflection stop|done|off, or "stop reflection". Clears all flags.
//   5. Per-turn reinforcement while a round/loop is active.
//
// Reflection is NOT always-on. Nothing activates unless the user asks.
//
// Sidecar flag files (alongside .reflection-active, all in CLAUDE_CONFIG_DIR):
//   .reflection-active  — the active question slug
//   .reflection-auto    — present ("1") when auto-apply+commit is on
//   .reflection-loop    — present (budget spec) when an autonomous loop is on

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const {
  getQuestions, getRotationWindow, recentSlugs, pickSlug,
  safeWriteFlag, readFlag, clearFlag, readMeta,
  getAutoDefault, getLoopConfig, parseLoopArgs,
} = require('./reflection-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.reflection-active');
const autoPath = path.join(claudeDir, '.reflection-auto');
const loopPath = path.join(claudeDir, '.reflection-loop');

const AUTO_TOKENS = new Set(['auto', 'yolo', '--auto', '-y']);

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try { handle(JSON.parse(input || '{}')); }
  catch (e) { /* never block a session over a hook error */ }
});

function emitContext(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text },
  }));
}

function questionFor(slug, questions) {
  const hit = questions.find(([s]) => s === slug);
  return hit ? hit[1] : slug;
}

function clearAll() { clearFlag(flagPath); clearFlag(autoPath); clearFlag(loopPath); }

function commitConvention(slug) {
  return 'git commit -m "reflection(' + slug + '): <short summary>"';
}

function goalBlock(slug, question, auto) {
  const lines = [
    'REFLECTION MODE ACTIVE' + (auto ? ' (auto-apply)' : '') + ' — focus this round:',
    '"' + question + '"  (slug: ' + slug + ')',
    '',
    'Reflect deeply on ONE concrete instance in THIS codebase:',
    '1. Read reflection-changelog.md first — avoid repeats; verify whether past fixes landed.',
    "2. Investigate. Read code; verify, don't guess. Optionally delegate a fresh-context deep dive to the `reflector` subagent.",
    '3. Find ONE specific, real issue. Cite file:line. Validate it (repro / trace) before claiming it.',
  ];
  if (auto) {
    lines.push(
      '4. Apply the minimal fix directly — NO approval needed (auto mode). YAGNI.',
      '5. Verify quickly if the repo has fast tests/build; then commit the fix (one commit per fix):',
      '   ' + commitConvention(slug),
      '6. Append a changelog entry (Status: applied) keeping the <!-- q:' + slug + ' --> marker.'
    );
  } else {
    lines.push(
      '4. Propose a minimal fix (YAGNI). Do NOT edit yet — wait for approval.',
      "5. After it's resolved, append an entry to reflection-changelog.md (keep the <!-- q:" + slug + ' --> marker).'
    );
  }
  lines.push('Be brief. One issue per round. Stop when logged or the user says "stop reflection".');
  return lines.join('\n');
}

function loopBlock(slug, question, cfg) {
  return [
    'REFLECTION LOOP ACTIVE (autonomous, auto-apply). First focus: "' + question + '" (slug: ' + slug + ').',
    'Budget: up to ' + cfg.timeoutMin + ' min wall-clock, max ' + cfg.maxRounds +
      ' rounds, stop after ' + cfg.cleanStreak + ' consecutive rounds with no issue found (goal achieved).',
    '',
    'First, record the start time ONCE: run  date +%s',
    'Then repeat until a stop condition is met:',
    '  1. Pick a question not covered recently (rotate; check reflection-changelog.md markers).',
    "  2. Investigate; find ONE validated issue (file:line). Verify, don't guess.",
    '  3. Apply the minimal fix directly (no approval). YAGNI.',
    '  4. Run fast tests/build if available; then commit:  git commit -m "reflection(<slug>): <summary>"',
    '  5. Append a changelog entry (Status: applied) with the <!-- q:<slug> --> marker.',
    '  6. Check elapsed via  date +%s  minus start. STOP if elapsed >= ' + cfg.timeoutMin +
      ' min, rounds >= ' + cfg.maxRounds + ', or ' + cfg.cleanStreak + ' consecutive clean rounds.',
    '',
    'When you stop, print a summary: rounds run, fixes committed, questions covered, why you stopped.',
    'Halt early anytime with /reflection stop.',
  ].join('\n');
}

function reminderLine(slug, question) {
  const loop = readMeta(loopPath);
  const auto = fs.existsSync(autoPath);
  if (loop) {
    return 'REFLECTION LOOP ACTIVE (' + loop + '). Keep iterating: pick a fresh question, find one ' +
      'validated issue, apply + commit the fix, log it, check the time budget. Stop on timeout / max ' +
      'rounds / clean streak, or /reflection stop.';
  }
  if (auto) {
    return 'REFLECTION ACTIVE (auto-apply) on: "' + question + '" (slug: ' + slug + '). ' +
      'Find one validated issue, apply the minimal fix, commit it (reflection(' + slug + '): …), then log to reflection-changelog.md.';
  }
  return 'REFLECTION ACTIVE on: "' + question + '" (slug: ' + slug + '). ' +
    'Stay on this question. Validate before claiming. Propose a minimal fix, await approval, then log to reflection-changelog.md.';
}

function pickRandomSlug(questions, cwd) {
  const recent = recentSlugs(path.join(cwd, 'reflection-changelog.md'), getRotationWindow(cwd));
  return pickSlug(questions, recent, Math.random());
}

function handle(data) {
  const cwd = data.cwd || process.cwd();
  const rawPrompt = (data.prompt || '').trim();
  const prompt = rawPrompt.toLowerCase();

  // 1. /reflection-log — block + inject summary.
  if (/^\/reflection(?::reflection)?-log(?:\s+.*)?$/.test(prompt)) {
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

  // 2. Deactivation — before activation so "stop reflection" doesn't trip start.
  const isStopCmd = /^\/reflection(?::reflection)?(?:-loop)?\s+(stop|done|off|end)\b/.test(prompt);
  const isStopNL = /\b(stop|end|finish|deactivate|turn off|halt)\b.*\breflection\b/.test(prompt) ||
                   /\breflection\b.*\b(stop|done|off|end|finished|halt)\b/.test(prompt);
  if (isStopCmd || isStopNL) {
    clearAll();
    emitContext('Reflection ended. Flags cleared.');
    return;
  }

  const questions = getQuestions({ cwd });

  // 3. /reflection-loop [budget…] — autonomous loop.
  const loopMatch = /^\/reflection(?::reflection)?-loop\b(.*)$/.exec(prompt);
  if (loopMatch) {
    const tokens = loopMatch[1].trim().split(/\s+/).filter(Boolean);
    const cfg = parseLoopArgs(tokens, getLoopConfig(cwd));
    const slug = pickRandomSlug(questions, cwd);
    if (slug) {
      const question = questionFor(slug, questions);
      safeWriteFlag(flagPath, slug);
      safeWriteFlag(autoPath, '1');
      safeWriteFlag(loopPath, 'timeout=' + cfg.timeoutMin + 'm rounds=' + cfg.maxRounds + ' clean=' + cfg.cleanStreak);
      emitContext(loopBlock(slug, question, cfg));
    }
    return;
  }

  // 4. Start a single round: /reflection [slug] [auto], or natural language.
  let startSlug = null;
  let starting = false;
  let auto = false;

  const slashMatch = /^\/reflection(?::reflection)?\b(.*)$/.exec(prompt);
  if (slashMatch) {
    starting = true;
    for (const tok of slashMatch[1].trim().split(/\s+/).filter(Boolean)) {
      if (AUTO_TOKENS.has(tok)) auto = true;
      else if (questions.some(([s]) => s === tok)) startSlug = tok;
    }
  } else if (
    /\breflect\b.*\b(codebase|code|repo|repository|project)\b/.test(prompt) ||
    /\breflection mode\b/.test(prompt) ||
    /\bself[-\s]?review\b/.test(prompt) ||
    (/\breflect\b/.test(prompt) && !readFlag(flagPath))
  ) {
    starting = true;
    if (/\bauto[-\s]?(fix|apply)?\b/.test(prompt) || /\bno approval\b/.test(prompt)) auto = true;
  }

  if (starting) {
    if (!auto && getAutoDefault(cwd)) auto = true;
    if (!startSlug) startSlug = pickRandomSlug(questions, cwd);
    if (startSlug) {
      const question = questionFor(startSlug, questions);
      safeWriteFlag(flagPath, startSlug);
      if (auto) safeWriteFlag(autoPath, '1'); else clearFlag(autoPath);
      clearFlag(loopPath);
      emitContext(goalBlock(startSlug, question, auto));
      return;
    }
  }

  // 5. Per-turn reinforcement when a round/loop is active.
  const active = readFlag(flagPath);
  if (active) emitContext(reminderLine(active, questionFor(active, questions)));
}
