# reflection

A self-improving codebase reflection loop for AI coding agents.

Each round, reflection picks **one** question about your codebase at random,
investigates deeply, surfaces **one** concrete, validated issue, proposes a
**minimal** fix for you to approve, and logs the outcome to
`reflection-changelog.md`. That changelog is the memory that powers the feedback
loop — it stops the agent repeating itself and spreads attention across the whole
codebase over time.

## The loop

```
/reflection
   │
   ├─ hook picks ONE question (random, skipping recently-used ones)
   ├─ read reflection-changelog.md — avoid repeats, verify past fixes landed
   ├─ investigate deeply (optionally via the read-only `reflector` subagent)
   ├─ surface ONE validated issue  → file:line
   ├─ propose ONE minimal fix      → wait for your approval
   └─ apply on approval, then append a changelog entry
```

One question, one issue, one minimal fix per round. Be brief. YAGNI.

## Questions

`bugs` · `refactor` · `tests` · `architecture` · `packaging` · `quality` ·
`best-practices` · `performance` · `error-handling` · `security` · `docs` ·
`dependencies` · `consistency` · `observability` · `tooling`

The full text lives in [`skills/reflection/SKILL.md`](./skills/reflection/SKILL.md)
(the source of truth the hook parses). Override or extend per-repo with
`.reflection/config.json`.

## Install

```bash
# one-liner (detects your agents: Claude Code, Gemini, opencode, Codex, + 25 more)
curl -fsSL https://raw.githubusercontent.com/maastor/reflection/main/install.sh | bash

# or from a clone
node bin/install.js            # interactive
node bin/install.js --all      # hooks + seed reflection-changelog.md
node bin/install.js --list     # show the provider matrix
```

Claude Code only:

```
claude plugin marketplace add maastor/reflection
claude plugin install reflection@reflection
```

See [INSTALL.md](./INSTALL.md) for details and uninstall.

## Usage

```
/reflection            start a round on a random question (propose fix, wait for approval)
/reflection tests      start a round on a specific question
/reflection auto       apply + commit the fix without approval
/reflection stop       end the round / loop
/reflection-loop [b]   run rounds autonomously until a budget/goal (auto-apply)
/reflection-init       seed reflection-changelog.md (+ optional config)
/reflection-log        summarize past reflections
/reflection-help       quick reference
```

While a round is active, a per-turn reminder keeps the agent anchored to its
question and a `[REFLECT:<slug>]` statusline badge shows what's in flight
(`:auto` / `:loop` suffix in those modes).

### Auto-apply mode

By default reflection **proposes** a fix and waits for your approval. Add `auto`
(or set `"autoApply": true` in `.reflection/config.json`) to apply the minimal fix
directly and commit it as `reflection(<slug>): …` — one commit per fix.

### Autonomous loop

`/reflection-loop [30m|1h] [rounds=N] [clean=N]` repeats rounds in auto mode until
the time budget, max rounds, or N consecutive clean rounds (goal achieved) is hit.
Each round commits its fix; stop early with `/reflection stop`. Defaults: 30m,
20 rounds, 2 clean — override per-repo under `"loop"` in `.reflection/config.json`.

## How it works

- **`UserPromptSubmit` hook** (`reflection-tracker.js`) detects start/stop, picks
  the question (random + changelog rotation), writes a flag, and injects the goal
  and per-turn reminders.
- **`SessionStart` hook** (`reflection-activate.js`) only resumes a round that was
  already in flight — it never auto-starts one.
- **`reflector` subagent** does read-only deep investigation in fresh context and
  reports one validated issue + a proposed fix.
- **`reflection-changelog.md`** is the durable feedback loop and rotation memory.

## Configuration

Per-repo `.reflection/config.json`:

```json
{
  "rotationWindow": 5,
  "autoApply": false,
  "questions": [["bugs", "Where would a bug be?"], ["tests", "Improve tests?"]],
  "loop": { "timeoutMin": 30, "maxRounds": 20, "cleanStreak": 2 }
}
```

Env: `REFLECTION_ROTATION_WINDOW`, `REFLECTION_REF` (installer release pin),
`REFLECTION_DEBUG=1` (flag-write diagnostics).
