[CmdletBinding()]
param(
    [string]$Action = "",
    [switch]$Dev = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if ($Dev -or ($Action -ieq "dev")) {
    $targetScript = Join-Path $ScriptDir "CommandStart\startdev-all.ps1"
    if (Test-Path $targetScript) {
        Write-Host "[start.ps1] Launching Fullstack Dev Environment..." -ForegroundColor Cyan
        & $targetScript
    } else {
        Write-Error "Could not find startdev-all.ps1 at $targetScript"
        exit 1
    }
} elseif (-not [string]::IsNullOrEmpty($Action)) {
    $manageScript = Join-Path $ScriptDir "CommandStart\manage.ps1"
    if (Test-Path $manageScript) {
        & $manageScript -Action $Action
    } else {
        Write-Error "Could not find manage.ps1 at $manageScript"
        exit 1
    }
} else {
    $manageScript = Join-Path $ScriptDir "CommandStart\manage.ps1"
    if (Test-Path $manageScript) {
        & $manageScript
    } else {
        Write-Error "Could not find manage.ps1 at $manageScript"
        exit 1
    }
}
