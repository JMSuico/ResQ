[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Action = "dev",

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs = @()
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
Set-Location $ScriptDir

$startDevScript = Join-Path $ScriptDir "CommandStart\startdev-all.ps1"
$manageScript = Join-Path $ScriptDir "CommandStart\manage.ps1"

if ($Action -ieq "dev" -or $Action -ieq "start" -or [string]::IsNullOrWhiteSpace($Action)) {
    if (Test-Path $startDevScript) {
        & $startDevScript
    } else {
        Write-Error "Could not find startdev-all.ps1 at $startDevScript"
        exit 1
    }
} elseif ($Action -ieq "menu") {
    if (Test-Path $manageScript) {
        & $manageScript
    } else {
        Write-Error "Could not find manage.ps1 at $manageScript"
        exit 1
    }
} else {
    if (Test-Path $manageScript) {
        & $manageScript -Action $Action $RemainingArgs
    } else {
        Write-Error "Could not find manage.ps1 at $manageScript"
        exit 1
    }
}
