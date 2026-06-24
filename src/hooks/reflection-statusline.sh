#!/bin/bash
# reflection — statusline badge for Claude Code.
# Renders [REFLECT:<slug>] when a reflection round is active.
#
# Usage in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/reflection-statusline.sh" }

FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.reflection-active"

# Refuse symlinks — a local attacker could point the flag at a secret and have
# the statusline render its bytes (incl. ANSI escapes) every keystroke.
[ -L "$FLAG" ] && exit 0
[ ! -f "$FLAG" ] && exit 0

# Hard-cap the read at 64 bytes; keep only [a-z0-9-] — blocks terminal-escape
# injection via the flag contents. Slugs are lowercase letters + hyphens.
SLUG=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
SLUG=$(printf '%s' "$SLUG" | tr -cd 'a-z0-9-')

[ -z "$SLUG" ] && exit 0

# Teal badge.
printf '\033[38;5;37m[REFLECT:%s]\033[0m' "$SLUG"
