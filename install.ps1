# reflection — installer shim (Windows / PowerShell).
#
# Thin wrapper around bin/install.js (the unified Node installer). Every flag
# you'd pass to bin/install.js can be passed here; we just forward them.
#
# One-line install:
#   irm https://raw.githubusercontent.com/maastor/reflection/main/install.ps1 | iex
#
# Local clone:
#   pwsh install.ps1 [flags]

[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$InstallerArgs
)

$ErrorActionPreference = "Stop"
$Repo = "maastor/reflection"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error @"
reflection: Node.js (>=18) required. Install:
  - winget install OpenJS.NodeJS.LTS
  - or download from https://nodejs.org
"@
  exit 1
}

$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 18) {
  Write-Error "reflection: Node $nodeMajor too old. Need Node >=18. Upgrade: https://nodejs.org"
  exit 1
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$local = Join-Path $here "bin/install.js"
if (Test-Path $local) {
  & node $local @InstallerArgs
  exit $LASTEXITCODE
}

$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
  Write-Error "reflection: npx required (ships with Node >=18). Reinstall Node.js."
  exit 1
}

& npx -y "github:$Repo" @InstallerArgs
exit $LASTEXITCODE
