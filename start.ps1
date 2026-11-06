[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Action = "",

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs = @()
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
Set-Location $ScriptDir

$manageScript = Join-Path $ScriptDir "CommandStart\manage.ps1"

if (Test-Path $manageScript) {
    if ($Action) {
        & $manageScript -Action $Action
    } else {
        & $manageScript
    }
} else {
    Write-Error "Unified management script not found at: $manageScript"
    exit 1
}
