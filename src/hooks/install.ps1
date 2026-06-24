# reflection — standalone hooks installer (Windows / PowerShell).
# Delegates to the unified Node installer (bin/install.js).
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here "..\..")
& node (Join-Path $root "bin/install.js") --only claude --with-hooks @Args
exit $LASTEXITCODE
