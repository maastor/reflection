---
name: reflection-help
description: >
  Quick-reference card for the reflection plugin — commands, the loop, the
  question bank, and config. One-shot display, not a persistent mode. Trigger:
  /reflection-help, "reflection help", "how do I use reflection".
---

Display this quick reference, then stop.

# reflection — self-improving codebase loop

**Commands**
```
/reflection            start a round (random question; propose fix, wait for approval)
/reflection <slug>     start a round on a specific question
/reflection auto       start a round that applies + commits the fix (no approval)
/reflection stop       end the round / loop
/reflection-loop [b]   run rounds autonomously until a budget/goal (auto-apply)
/reflection-init       seed reflection-changelog.md (+ optional config)
/reflection-log        summarize past reflections
/reflection-help       this card
```

**The loop** — pick one question → read the changelog → investigate deeply →
surface one validated issue (`file:line`) → propose a minimal fix → apply on
approval (or auto-apply + commit) → log the outcome. One question, one issue, one
fix per round. YAGNI.

**Auto mode** — `/reflection auto` (or `autoApply: true` in config) applies the
fix and commits it as `reflection(<slug>): …` without asking.

**Loop** — `/reflection-loop [30m|1h] [rounds=N] [clean=N]` repeats rounds in auto
mode until timeout / max rounds / N consecutive clean rounds (goal achieved).

**Question slugs** — `bugs refactor tests architecture packaging quality
best-practices performance error-handling security docs dependencies consistency
observability tooling`

**Config** (optional, per repo): `.reflection/config.json` with `rotationWindow`,
`autoApply`, a custom `questions` bank, and `loop` ({timeoutMin, maxRounds,
cleanStreak}). Env: `REFLECTION_ROTATION_WINDOW`.

**State** — flags at `$CLAUDE_CONFIG_DIR/.reflection-{active,auto,loop}` hold the
active slug + mode; a `[REFLECT:<slug>]` / `[REFLECT:<slug>:auto]` /
`[REFLECT:<slug>:loop]` statusline badge shows it. Cleared by `/reflection stop`.
