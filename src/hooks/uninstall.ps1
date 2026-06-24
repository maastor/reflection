# reflection — standalone hooks uninstaller (Windows / PowerShell).
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here "..\..")
& node (Join-Path $root "bin/install.js") --uninstall @Args
exit $LASTEXITCODE
