---
name: reflection
description: >
  Deliberate, feedback-driven codebase self-improvement loop. Reflect on ONE
  randomly chosen question about this codebase (bugs, refactor, tests,
  architecture, packaging, code quality, best practices, performance, error
  handling, security, docs, dependencies, consistency, observability, tooling),
  investigate deeply, find ONE concrete validated issue, propose a minimal fix
  (YAGNI) for approval, then log the outcome to reflection-changelog.md.
  Use when the user says "reflect", "reflect on the codebase", "self review",
  "reflection mode", or invokes /reflection.
---

Reflection is a self-improvement process. Each round: pick ONE question, reflect
deeply on THIS codebase, surface ONE real issue, propose a minimal fix, log it.
Be brief and concise. Follow YAGNI — fix what's needed, nothing more.

## The loop

1. **Pick a question.** The `/reflection` hook injects a `REFLECTION MODE ACTIVE`
   block naming the question for this round (chosen at random, skipping recently
   used ones). If no block is present, read `reflection-changelog.md`, then pick a
   question from the bank below that was NOT covered recently.
2. **Read the log first.** Open `reflection-changelog.md` (repo root). Avoid
   repeating a recent finding, and verify whether previously proposed fixes
   actually landed. This is the feedback loop — build on past rounds.
3. **Investigate deeply.** Read the relevant code. Verify, don't guess (repro, a
   trace, or a test). For a fresh-context deep dive, delegate to the `reflector`
   subagent. Validate that any issue is real before claiming it.
4. **Surface ONE issue.** Be specific: cite `file:line`. One issue per round —
   the highest-value one you found. If the codebase is genuinely clean on this
   question, say so plainly and log a "no issue found" entry.
5. **Propose a minimal fix.** Concrete and small (YAGNI). Show the change. Do NOT
   edit yet — wait for the user to approve.

   **Auto-apply mode** (the round was started with `/reflection auto`, or
   `autoApply: true` in `.reflection/config.json`): skip approval. Apply the
   minimal fix directly, verify with fast tests/build if available, then commit
   it on the current branch — one commit per fix:
   `git commit -m "reflection(<slug>): <short summary>"`.
6. **Apply on approval (or auto), then log.** Append an entry to
   `reflection-changelog.md` in the format below (`Status: applied`).
7. **Close out.** Tell the user the round is logged. They can run `/reflection`
   again for a new question, `/reflection-loop` to run rounds autonomously, or
   `/reflection stop` to end.

## Questions

The hook picks one of these at random (skipping recently-used slugs). This table
is the source of truth — the hook parses it. Override or extend per-repo via
`.reflection/config.json` (`"questions"` / `"rotationWindow"`).

| slug | question |
|------|----------|
| bugs | If there is a bug in this code, where would it be and how can I fix it? |
| refactor | Can I refactor this code to make it simpler and clearer? |
| tests | Can I improve test coverage or test quality? |
| architecture | Can I improve the architecture or separation of concerns? |
| packaging | Can I improve the package or module structure or file organization? |
| quality | Can I improve code quality such as naming, dead code, duplication, complexity? |
| best-practices | Am I following the idioms and best practices for this language and its frameworks? |
| performance | Are there performance bottlenecks or obvious inefficiencies? |
| error-handling | Is error handling robust across edge cases, failures, and resource cleanup? |
| security | Are there security weaknesses such as input validation, secrets, injection, authz? |
| docs | Are docs and comments accurate, sufficient, and free of staleness? |
| dependencies | Are dependencies minimal, current, and free of known risks? |
| consistency | Is style and convention consistent across the codebase? |
| observability | Is there adequate logging, metrics, and tracing for production debugging? |
| tooling | Can build, CI, lint, or developer tooling be improved? |

## Changelog format

Append to `reflection-changelog.md` at the repo root (run `/reflection-init` to
seed it). One entry per round. The hidden `<!-- q:<slug> -->` marker drives
question rotation — keep it.

```
## 2026-06-24 — tests: Can I improve test coverage or test quality? <!-- q:tests -->
**Finding:** `src/foo.js:42` — null-input path has no test and throws unhandled.
**Proposed fix:** add a guard + a unit case covering null input.
**Status:** proposed | applied | rejected | deferred
**Outcome:** <commit/PR ref or note>. Follow-up: [[related-entry]]
```

## Discipline

- One question, one issue, one minimal fix per round. Resist scope creep.
- Validate before claiming. No speculative "this might be a bug" — confirm it.
- In default mode, never edit before the user approves the proposed fix. In
  auto-apply mode, never commit a fix that breaks the build/tests — revert and
  log it as deferred instead.
- Keep findings short: location, problem, fix. No filler.
- Don't re-litigate issues already resolved in the changelog.
