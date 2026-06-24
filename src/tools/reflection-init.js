#!/usr/bin/env node
// reflection — per-repo scaffolding tool.
//
// Creates reflection-changelog.md (the feedback-loop log) at the target repo
// root, and optionally a .reflection/config.json template. Used by the
// installer's --with-init and runnable directly:
//
//   node src/tools/reflection-init.js [targetDir] [--force] [--with-config] [--dry-run]

'use strict';

const fs = require('fs');
const path = require('path');

function parse(argv) {
  const opts = { dir: process.cwd(), force: false, withConfig: false, dryRun: false };
  for (const a of argv) {
    if (a === '--force') opts.force = true;
    else if (a === '--with-config') opts.withConfig = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (!a.startsWith('--')) opts.dir = path.resolve(a);
  }
  return opts;
}

const CHANGELOG = `# Reflection Changelog

Log of codebase self-improvement rounds. Newest entries at the bottom.
Each entry: one question, one validated finding, one minimal fix, the outcome.
Keep the hidden \`q:<slug>\` marker on each header — it drives question rotation.

Entry template:

\`\`\`
## YYYY-MM-DD — SLUG: QUESTION <!-- q:SLUG -->
**Finding:** \`path/to/file.ext:LINE\` — what's wrong.
**Proposed fix:** the minimal change.
**Status:** proposed | applied | rejected | deferred
**Outcome:** commit/PR ref or note. Follow-up: [[related]]
\`\`\`
`;

const CONFIG = `{
  "rotationWindow": 5,
  "questions": [
    ["bugs", "If there is a bug in this code, where would it be and how can I fix it?"],
    ["refactor", "Can I refactor this code to make it simpler and clearer?"],
    ["tests", "Can I improve test coverage or test quality?"],
    ["architecture", "Can I improve the architecture or separation of concerns?"],
    ["quality", "Can I improve code quality — naming, dead code, duplication, complexity?"],
    ["security", "Are there security weaknesses — input validation, secrets, injection, authz?"],
    ["performance", "Are there performance bottlenecks or obvious inefficiencies?"]
  ]
}
`;

function main() {
  const opts = parse(process.argv.slice(2));
  const changelogPath = path.join(opts.dir, 'reflection-changelog.md');
  const configDir = path.join(opts.dir, '.reflection');
  const configPath = path.join(configDir, 'config.json');

  // Changelog
  if (fs.existsSync(changelogPath) && !opts.force) {
    log(`  exists, leaving as-is: ${changelogPath}`);
  } else if (opts.dryRun) {
    log(`  would write ${changelogPath}`);
  } else {
    fs.writeFileSync(changelogPath, CHANGELOG);
    log(`  wrote ${changelogPath}`);
  }

  // Config (opt-in)
  if (opts.withConfig) {
    if (fs.existsSync(configPath) && !opts.force) {
      log(`  exists, leaving as-is: ${configPath}`);
    } else if (opts.dryRun) {
      log(`  would write ${configPath}`);
    } else {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(configPath, CONFIG);
      log(`  wrote ${configPath}`);
    }
  }

  log('  reflection scaffolding ready. Run /reflection to start a round.');
}

function log(s) { process.stdout.write(s + '\n'); }

main();
