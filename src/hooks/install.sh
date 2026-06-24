#!/usr/bin/env bash
# reflection — standalone hooks installer.
#
# Wires the SessionStart + UserPromptSubmit hooks and statusline badge into
# Claude Code's settings.json without going through `claude plugin install`.
# Delegates to the unified Node installer (bin/install.js) so there is a single
# source of truth for the JSON merge logic.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" 2>/dev/null && pwd)"
root="$(cd "$here/../.." && pwd)"
exec node "$root/bin/install.js" --only claude --with-hooks "$@"
