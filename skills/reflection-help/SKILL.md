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
/reflection            start a round (random question)
/reflection <slug>     start a round on a specific question
/reflection stop       end the round
/reflection-init       seed reflection-changelog.md (+ optional config)
/reflection-log        summarize past reflections
/reflection-help       this card
```

**The loop** — pick one question → read the changelog → investigate deeply →
surface one validated issue (`file:line`) → propose a minimal fix → apply on
approval → log the outcome. One question, one issue, one fix per round. YAGNI.

**Question slugs** — `bugs refactor tests architecture packaging quality
best-practices performance error-handling security docs dependencies consistency
observability tooling`

**Config** (optional, per repo): `.reflection/config.json` with `rotationWindow`
and a custom `questions` bank. Env: `REFLECTION_ROTATION_WINDOW`.

**State** — a flag at `$CLAUDE_CONFIG_DIR/.reflection-active` holds the active
slug; a `[REFLECT:<slug>]` statusline badge shows it. Cleared by `/reflection stop`.
