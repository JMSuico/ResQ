[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Action = "",

    [switch]$Dev,

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs = @()
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
Set-Location $ScriptDir

$manageScript = Join-Path $ScriptDir "CommandStart\manage.ps1"

if ($Dev -and -not $Action) {
    $Action = "start"
}

if (Test-Path $manageScript) {
    if ($Action) {
        & $manageScript -Action $Action -RemainingArgs $RemainingArgs
    } else {
        & $manageScript
    }
} else {
    Write-Error "Unified management script not found at: $manageScript"
    exit 1
}
