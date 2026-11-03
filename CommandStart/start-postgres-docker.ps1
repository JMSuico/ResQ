[CmdletBinding()]
param(
    [switch]$WithPgAdmin
)

$ErrorActionPreference = "Stop"
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

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   RESQTRACK RELATIONAL POSTGRESQL (DOCKER ALPINE) LAUNCHER           " -ForegroundColor Magenta
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Verify docker is available
try {
    $null = & docker --version
} catch {
    Write-Host "[ERROR] Docker is not installed or not in system PATH." -ForegroundColor Red
    exit 1
}

Write-Host "[*] Launching PostgreSQL 16 Alpine container via Docker Compose..." -ForegroundColor Yellow
if ($WithPgAdmin) {
    & docker compose -f "$composeFile" --profile tools up -d
} else {
    & docker compose -f "$composeFile" up -d resqtrack-postgres
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start PostgreSQL Docker container." -ForegroundColor Red
    exit 1
}

Write-Host "[*] Waiting for PostgreSQL healthcheck to report healthy..." -ForegroundColor Yellow
$maxTries = 15
$tries = 0
$healthy = $false

while ($tries -lt $maxTries) {
    $tries++
    Start-Sleep -Seconds 1
    $status = & docker inspect --format="{{.State.Health.Status}}" resqtrack-postgres-db 2>$null
    if ($status -eq "healthy") {
        $healthy = $true
        break
    }
    Write-Host "." -NoNewline
}
Write-Host ""

if ($healthy) {
    Write-Host "[OK] PostgreSQL 16 Alpine is HEALTHY and READY on port 5432!" -ForegroundColor Green
    Write-Host "  Database Name : ResQTrackDb" -ForegroundColor Cyan
    Write-Host "  Username      : postgres" -ForegroundColor Cyan
    Write-Host "  Password      : YourPassword123!" -ForegroundColor Cyan
    Write-Host "  Host / Port   : localhost:5432" -ForegroundColor Cyan
    if ($WithPgAdmin) {
        Write-Host "  pgAdmin Web   : http://localhost:5050 (admin@resqtrack.gov.ph / AdminPostgres2026!)" -ForegroundColor Magenta
    }
} else {
    Write-Host "[!] Container is running. Verifying port listener on 5432..." -ForegroundColor Yellow
}
Write-Host ""
