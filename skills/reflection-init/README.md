# reflection-init

Scaffold a repository for reflection rounds.

## How to invoke

```
/reflection-init
```

## What it creates

- `reflection-changelog.md` at the repo root (the feedback-loop log).
- Optionally `.reflection/config.json` — a custom question bank and/or
  `rotationWindow`, only if you ask for it.

The built-in question bank works without any config. After init, run
`/reflection` to start your first round.
