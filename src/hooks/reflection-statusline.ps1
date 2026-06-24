# reflection — statusline badge for Claude Code (Windows / PowerShell).
# Renders [REFLECT:<slug>] when a reflection round is active.
#
# Usage in settings.json:
#   "statusLine": { "type": "command",
#     "command": "powershell -NoProfile -ExecutionPolicy Bypass -File C:\\path\\to\\reflection-statusline.ps1" }

$ErrorActionPreference = 'SilentlyContinue'

$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$flag = Join-Path $configDir '.reflection-active'

if (-not (Test-Path -LiteralPath $flag)) { exit 0 }
$item = Get-Item -LiteralPath $flag -Force
# Refuse symlinks / reparse points.
if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { exit 0 }
if ($item.Length -gt 64) { exit 0 }

$slug = (Get-Content -LiteralPath $flag -Raw).Trim().ToLower()
# Keep only [a-z0-9-].
$slug = ($slug -replace '[^a-z0-9-]', '')
if ([string]::IsNullOrEmpty($slug)) { exit 0 }

# Teal badge (ANSI; Windows Terminal / modern consoles render it).
$esc = [char]27
Write-Host -NoNewline "$esc[38;5;37m[REFLECT:$slug]$esc[0m"
