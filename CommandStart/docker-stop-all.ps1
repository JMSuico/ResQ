# ==============================================================================
# ResQTrack Incident AI System Detection -- Docker Multi-Container Stopper
# Stops all 7 services and removes associated containers cleanly
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$Volumes = $false
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }

if (Test-Path (Join-Path $ScriptDir "Project system ENGINE")) {
    $RootDir = $ScriptDir
} elseif (Test-Path (Join-Path (Split-Path -Parent $ScriptDir) "Project system ENGINE")) {
    $RootDir = Split-Path -Parent $ScriptDir
} else {
    $RootDir = $ScriptDir
}

$composeFile = Join-Path $RootDir "docker-compose.yml"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "     RESQTRACK INCIDENT AI -- STOPPING DOCKER CONTAINERS              " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$downArgs = @("compose", "-f", $composeFile, "down")
if ($Volumes) {
    $downArgs += "-v"
    Write-Host "  [!] Flag -Volumes specified. Persistent volumes will be removed." -ForegroundColor Red
}

Push-Location $RootDir
try {
    Write-Host "  [*] Executing: docker $($downArgs -join ' ')..." -ForegroundColor Yellow
    & docker @downArgs
    Write-Host "  [OK] All Docker Compose services stopped and removed." -ForegroundColor Green
} catch {
    Write-Host "  [!] Encountered error stopping containers: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] DOCKER STACK SAFELY STOPPED." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
