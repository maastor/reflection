#!/usr/bin/env bash
# reflection — standalone hooks uninstaller. Delegates to bin/install.js.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" 2>/dev/null && pwd)"
root="$(cd "$here/../.." && pwd)"
exec node "$root/bin/install.js" --uninstall "$@"
