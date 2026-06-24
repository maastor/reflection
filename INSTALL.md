# Installing reflection

Reflection ships for Claude Code, Gemini CLI, opencode, Codex, OpenClaw, and ~25
other agents via the unified Node installer.

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/maastor/reflection/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/maastor/reflection/main/install.ps1 | iex
```

From a clone:

```bash
git clone https://github.com/maastor/reflection
cd reflection
node bin/install.js            # interactive; pick which detected agents
```

Requires Node ≥ 18.

## Flags

```
--dry-run             Print what would run, do nothing.
--force               Re-run even if a target reports already installed.
--only <agent>        Install only for the named agent (repeatable). See --list.
--all                 Hooks + seed reflection-changelog.md in the current repo.
--minimal             Just the plugin/extension install (no hooks, no init).
--with-hooks          Claude Code: wire hooks + statusline into settings.json.
--no-hooks            Skip the hooks installer.
--with-init           Write reflection-changelog.md into the current directory.
--config-dir <path>   Claude Code config dir (default $CLAUDE_CONFIG_DIR or ~/.claude).
--uninstall, -u       Remove reflection from this machine.
--list                Print the provider matrix and exit.
-h, --help            Full usage.
```

## Claude Code (plugin)

```
claude plugin marketplace add maastor/reflection
claude plugin install reflection@reflection
```

The plugin manifest wires the `SessionStart` and `UserPromptSubmit` hooks
automatically. To wire them standalone (no plugin) into `~/.claude/settings.json`:

```
bash src/hooks/install.sh
```

## Uninstall

```bash
node bin/install.js --uninstall
# or
curl -fsSL https://raw.githubusercontent.com/maastor/reflection/main/install.sh | bash -s -- --uninstall
```

This removes hooks, the statusline badge, the Claude plugin, the Gemini
extension, and opencode/OpenClaw entries. Per-repo files
(`reflection-changelog.md`, `.reflection/`) are left for you to remove.

## Verifying

```bash
node bin/install.js --list           # provider matrix
node bin/install.js --only claude --dry-run
```
