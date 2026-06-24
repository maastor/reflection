---
description: Run reflection autonomously until a time/round budget or the goal is reached
---
Start an autonomous reflection loop. $ARGUMENTS

Repeat reflection rounds until the budget is hit or the goal is reached. Record
the start time once with `date +%s`. Each round: pick a question not covered
recently, find ONE validated issue (file:line), apply the minimal fix directly
(auto mode — no approval), run fast tests/build if present, commit it as
`reflection(<slug>): <summary>`, and append a changelog entry. Stop on timeout
(default 30m), max rounds (default 20), or consecutive clean rounds (default 2),
or when I say /reflection stop. Parse args like `30m`, `1h`, `rounds=N`,
`clean=N`. Print a summary when you stop.
