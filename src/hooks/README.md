# reflection hooks

Runtime scripts wired into Claude Code (and copied for standalone installs).

| File | Event | Role |
|------|-------|------|
| `reflection-tracker.js` | UserPromptSubmit | The loop brain. Detects `/reflection [slug]`, `/reflection stop`, and natural-language start/stop. Picks a question (random, skipping recently-used slugs from `reflection-changelog.md`), writes the flag, injects the goal block, and re-injects a per-turn reminder while a round is active. Also serves `/reflection-log`. |
| `reflection-activate.js` | SessionStart | Resume-only. Re-asserts the reminder if a round was already in flight; nudges to wire the statusline badge. Never starts a round. |
| `reflection-log.js` | (invoked by tracker) | Summarizes `reflection-changelog.md` for `/reflection-log`. |
| `reflection-config.js` | (library) | Symlink-safe flag I/O, config resolution, question-bank parsing, changelog rotation. |
| `reflection-statusline.sh` / `.ps1` | statusLine | Renders `[REFLECT:<slug>]` from the flag file. |

## Install

The plugin manifest (`.claude-plugin/plugin.json`) wires the hooks automatically
when installed via `claude plugin install`. For a standalone wiring into
`~/.claude/settings.json` (no plugin), run:

```
bash src/hooks/install.sh        # macOS / Linux
pwsh src/hooks/install.ps1       # Windows
```

Both delegate to `bin/install.js` so the settings.json merge logic has a single
source of truth.

## Statusline badge

If you already have a `statusLine` configured, the installer won't overwrite it.
Add the badge to your existing statusline by calling `reflection-statusline.sh`
and concatenating its output, e.g.:

```bash
printf '%s ' "$(bash ~/.claude/hooks/reflection-statusline.sh)"
# ... your existing statusline ...
```

## State

A single flag file at `$CLAUDE_CONFIG_DIR/.reflection-active` holds the active
question slug. Presence = a round is in flight. All reads/writes are symlink-safe
and validated against a slug whitelist (`reflection-config.js`).
