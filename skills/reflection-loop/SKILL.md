---
name: reflection-loop
description: >
  Run reflection autonomously, round after round, until a time/round budget is
  hit or the goal is reached (consecutive clean rounds). Each round auto-applies
  its fix and commits it — no per-round approval. Use when the user says
  "reflection loop", "keep reflecting until", "auto-improve the codebase", or
  invokes /reflection-loop.
---

Run an autonomous self-improvement loop. This is `reflection` in auto-apply mode,
repeated until a stop condition. Because it runs unattended, each round applies
its fix and commits it without asking.

## Budget & stop conditions

`/reflection-loop [timeout] [rounds=N] [clean=N]` — e.g. `/reflection-loop 30m`,
`/reflection-loop 1h rounds=15 clean=3`. Defaults (override per-repo in
`.reflection/config.json` under `"loop"`): timeout **30m**, max **20 rounds**,
stop after **2** consecutive clean rounds.

Stop when ANY holds:
- elapsed wall-clock ≥ timeout,
- rounds run ≥ max rounds,
- `clean` consecutive rounds found no real issue (**goal achieved**),
- the user runs `/reflection stop` or interrupts.

## The loop

1. Record the start time once: run `date +%s`.
2. Each round:
   a. Pick a question NOT covered recently (rotate using the `<!-- q:slug -->`
      markers in `reflection-changelog.md`).
   b. Investigate deeply; find ONE validated issue (`file:line`). Verify — don't
      guess. Optionally delegate to the `reflector` subagent.
   c. Apply the minimal fix directly (YAGNI). If you find no real issue, count it
      as a clean round and move to the next question.
   d. Run fast tests/build if the repo has them. If the fix breaks them and you
      can't fix it quickly, revert it and log the round as deferred.
   e. Commit the fix on the current branch, one commit per fix:
      `git commit -m "reflection(<slug>): <short summary>"`.
   f. Append a changelog entry (`Status: applied`) with the `<!-- q:slug -->` marker.
   g. Check elapsed (`date +%s` minus start) and the stop conditions.
3. On stop, print a summary: rounds run, fixes committed, questions covered, and
   why you stopped.

## Discipline

- One validated issue and one minimal fix per round — no batching.
- Never commit a fix that breaks the build/tests. Revert and defer instead.
- Commit on the current branch (auto mode is opt-in). If you're on the default
  branch and that's a concern, create a working branch first and say so.
- Keep going until a stop condition — don't end the loop early without reason.
