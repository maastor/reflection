---
name: reflection-log
description: >
  Summarize the reflection-changelog.md feedback loop — counts per question,
  recent findings, and open/proposed items not yet resolved. Use when the user
  says "reflection log", "reflection history", "what have I reflected on", or
  invokes /reflection-log.
---

Summarize `reflection-changelog.md` (repo root) so the user can see the
feedback loop at a glance.

Report, briefly:
- **Rounds logged** and date range.
- **Coverage per question slug** — which questions got attention, which are
  untouched (cross-reference the bank in the `reflection` skill).
- **Open items** — entries with `Status: proposed` or `deferred` that have no
  resolution yet. These are the backlog.
- **Recently applied fixes** — last few `Status: applied`, with their `file:line`.

If `reflection-changelog.md` is missing, say so and suggest `/reflection-init`.

Keep it scannable. No filler. The point is to decide what to reflect on next.
