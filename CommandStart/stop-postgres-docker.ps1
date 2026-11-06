[CmdletBinding()]
param()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }

# Detect repository root
if (Test-Path (Join-Path $ScriptDir "Project system ENGINE")) {
    $RootDir = $ScriptDir
} elseif (Test-Path (Join-Path (Split-Path -Parent $ScriptDir) "Project system ENGINE")) {
    $RootDir = Split-Path -Parent $ScriptDir
} else {
    $RootDir = $ScriptDir
}

$composeFile = Join-Path $RootDir "docker-compose.postgres.yml"
if (-not (Test-Path $composeFile)) {
    $composeFile = Join-Path $RootDir "docker-compose.yml"
}

Write-Host "[*] Stopping PostgreSQL Alpine container via Docker Compose..." -ForegroundColor Yellow
& docker compose -f "$composeFile" down
Write-Host "[OK] PostgreSQL container stopped." -ForegroundColor Green
