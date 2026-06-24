# reflection-loop

Run reflection autonomously, round after round, until a budget or goal is met.

## How to invoke

```
/reflection-loop              # defaults: 30m, max 20 rounds, stop after 2 clean
/reflection-loop 1h           # 1 hour budget
/reflection-loop 45m rounds=15 clean=3
/reflection stop              # halt early
```

The loop runs in **auto-apply** mode: each round finds one validated issue,
applies the minimal fix, runs fast tests/build if present, and commits it
(`reflection(<slug>): …`) — no per-round approval. It rotates questions and stops
on timeout, max rounds, or N consecutive clean rounds (goal achieved).

Per-repo defaults in `.reflection/config.json`:

```json
{ "loop": { "timeoutMin": 30, "maxRounds": 20, "cleanStreak": 2 } }
```

See [`SKILL.md`](./SKILL.md) for the full loop and stop conditions.
