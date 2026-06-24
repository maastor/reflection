---
name: reflection-init
description: >
  Scaffold a repository for reflection: create reflection-changelog.md and an
  optional .reflection/config.json (custom question bank + rotation window).
  Use when the user says "set up reflection", "init reflection", or invokes
  /reflection-init.
---

Prepare the current repository for reflection rounds.

1. **Create `reflection-changelog.md`** at the repo root if it doesn't exist:

   ```
   # Reflection Changelog

   Log of codebase self-improvement rounds. Newest entries at the bottom.
   Each entry: one question, one validated finding, one minimal fix, the outcome.
   ```

   If it already exists, leave it untouched.

2. **Offer `.reflection/config.json`** (only if the user wants to customize). It
   supports:

   ```json
   {
     "rotationWindow": 5,
     "questions": [
       ["bugs", "If there is a bug in this code, where would it be?"],
       ["tests", "Can I improve test coverage or test quality?"]
     ]
   }
   ```

   - `rotationWindow` — how many recent questions to skip when picking (default 5).
   - `questions` — replaces the built-in bank. Each entry is `[slug, text]` or
     `{ "slug": ..., "question": ... }`. Slugs must be lowercase letters/hyphens.

   Don't create this file unless asked — the built-in bank works out of the box.

3. Confirm what was created and point the user at `/reflection` to start a round.

The `src/tools/reflection-init.js` script performs the same scaffolding
non-interactively (used by the installer's `--with-init`).
