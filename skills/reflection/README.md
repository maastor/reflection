# reflection

A deliberate, feedback-driven codebase self-improvement loop.

## What it does

Each round, reflection picks **one** question about the codebase at random
(skipping recently-used ones), investigates deeply, surfaces **one** concrete,
validated issue, proposes a **minimal** fix (YAGNI) for you to approve, and logs
the outcome to `reflection-changelog.md`. The changelog is the memory that powers
the feedback loop and the question rotation.

Questions span bugs, refactoring, tests, architecture, packaging, code quality,
language best practices, performance, error handling, security, docs,
dependencies, consistency, observability, and tooling.

## How to invoke

```
/reflection            # start a round — hook picks a random question
/reflection tests      # force a specific question by slug
/reflection stop       # end the round
reflect on the codebase # natural language also works
```

While a round is active, a per-turn reminder keeps the agent anchored to the
chosen question, and a `[REFLECT:<slug>]` statusline badge shows what's in flight.

## The loop

1. Pick a question (hook does this at random, skipping recent ones).
2. Read `reflection-changelog.md` — avoid repeats, verify past fixes landed.
3. Investigate deeply; validate before claiming. Optionally delegate to the
   `reflector` subagent for a fresh-context deep dive.
4. Surface one real issue with `file:line`.
5. Propose a minimal fix — wait for approval before editing.
6. Apply on approval, then append a changelog entry.

## Related

- [`SKILL.md`](./SKILL.md) — full LLM-facing instructions + question bank
- `/reflection-init` — seed `reflection-changelog.md` and `.reflection/config.json`
- `/reflection-log` — summarize past reflections
