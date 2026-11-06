# ==============================================================================
# ResQTrack Incident AI System Detection -- Docker Multi-Container Launcher
# Spins up the 7-container topology:
#   1. resqtrack-backend     (:5000)
#   2. resqtrack-admin       (:5174)
#   3. resqtrack-responders  (:5173)
#   4. resqtrack-civilian    (:5175)
#   5. resqtrack-cache       (:6379)
#   6. resqtrack-db-primary  (:5432)
#   7. resqtrack-db-replica  (:5433)
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$NoBrowser = $false,
    [switch]$Rebuild = $false
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
Write-Host "     RESQTRACK INCIDENT AI -- DOCKER MULTI-CONTAINER LAUNCHER        " -ForegroundColor Magenta
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " [Compose File]: $composeFile" -ForegroundColor Gray
Write-Host ""

# 1. Verify Docker Engine
Write-Host "[1/5] Checking Docker daemon status..." -ForegroundColor Cyan
try {
    $dockerInfo = & docker info 2>$null
    if (-not $dockerInfo) {
        throw "Docker daemon not responding"
    }
    Write-Host "  [OK] Docker Engine is running." -ForegroundColor Green
} catch {
    Write-Host "  [!] Docker is not currently running. Please launch Docker Desktop and retry." -ForegroundColor Red
    exit 1
}

# 2. Stop Any Conflicting Host Processes on Ports 5000, 5173, 5174, 5175
Write-Host "`n[2/5] Checking port availability (5000, 5173, 5174, 5175, 5432, 6379)..." -ForegroundColor Cyan
$portsToCheck = @(5000, 5173, 5174, 5175)
foreach ($p in $portsToCheck) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                $pidToKill = $c.OwningProcess
                if ($pidToKill -gt 4) {
                    $pName = (Get-Process -Id $pidToKill -ErrorAction SilentlyContinue).ProcessName
                    if ($pName -ne "com.docker.backend" -and $pName -ne "docker-proxy") {
                        Write-Host "  [*] Releasing port $p occupied by $pName (PID $pidToKill)..." -ForegroundColor Yellow
                        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
    } catch { }
}

# 2.5 Ensure Backend Publish Binaries Exist
$backendDir = Join-Path $RootDir "Project system ENGINE\Backend"
$publishDir = Join-Path $backendDir "publish"
if (-not (Test-Path (Join-Path $publishDir "Backend.dll")) -or $Rebuild) {
    Write-Host "`n[*] Compiling and publishing Backend Release binaries..." -ForegroundColor Yellow
    Push-Location $backendDir
    try {
        dotnet publish -c Release -o $publishDir --verbosity minimal
        Write-Host "  [OK] Backend binaries published to publish/." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# 3. Spin Up Docker Compose Multi-Container Services
Write-Host "`n[3/5] Starting Docker Compose services..." -ForegroundColor Cyan
$upArgs = @("compose", "-f", $composeFile, "up", "-d")
if ($Rebuild) {
    $upArgs += "--build"
}

Push-Location $RootDir
try {
    Write-Host "  [*] Executing: docker $($upArgs -join ' ')..." -ForegroundColor Yellow
    & docker @upArgs
    Write-Host "  [OK] Docker Compose up completed." -ForegroundColor Green
} catch {
    Write-Host "  [!] Docker compose failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# 4. Wait for Primary Relational DB & Backend Health
Write-Host "`n[4/5] Waiting for Primary Database & Cache services..." -ForegroundColor Cyan
$maxChecks = 30
$currentCheck = 0
$dbHealthy = $false

while ($currentCheck -lt $maxChecks) {
    $currentCheck++
    Start-Sleep -Seconds 1
    $status = & docker inspect --format="{{.State.Health.Status}}" resqtrack-postgres-primary 2>$null
    if ($status -eq "healthy") {
        $dbHealthy = $true
        break
    }
    Write-Host "." -NoNewline
}
Write-Host ""

if ($dbHealthy) {
    Write-Host "  [OK] Primary PostgreSQL 16 Alpine container is HEALTHY on port 5432." -ForegroundColor Green
} else {
    Write-Host "  [i] Containers spawned. Healthcheck initialized." -ForegroundColor Yellow
}

# 5. Display Tactical Dashboard
Write-Host ""
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host "         RESQTRACK INCIDENT AI SYSTEM -- DOCKER MULTI-CONTAINER TOPOLOGY                  " -ForegroundColor Cyan
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host " Service Name          | Container Name            | Port  | Target URL                  " -ForegroundColor Yellow
Write-Host "-----------------------+---------------------------+-------+-----------------------------" -ForegroundColor DarkGray
Write-Host " LDRRMO Admin Portal   | resqtrack-admin-ui        | :5174 | http://127.0.0.1:5174/admin " -ForegroundColor Magenta
Write-Host " Emergency Responders  | resqtrack-responders-ui   | :5173 | http://127.0.0.1:5173/responder" -ForegroundColor Green
Write-Host " Civilian SOS Portal   | resqtrack-civilian-ui     | :5175 | http://127.0.0.1:5175/civilian" -ForegroundColor Green
Write-Host " .NET 10 API Backend   | resqtrack-api-backend     | :5000 | http://localhost:5000/api   " -ForegroundColor Yellow
Write-Host " Scalar API Docs       | resqtrack-api-backend     | :5000 | http://localhost:5000/scalar/v1" -ForegroundColor White
Write-Host " Redis 7 Alpine Cache  | resqtrack-redis-cache     | :6379 | localhost:6379 (redis-cli)  " -ForegroundColor Red
Write-Host " Primary Relational DB | resqtrack-postgres-primary| :5432 | localhost:5432 (Postgres 16)" -ForegroundColor Cyan
Write-Host " Standby DB Replica    | resqtrack-postgres-replica| :5433 | localhost:5433 (Postgres 16)" -ForegroundColor DarkCyan
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host " [i] To inspect running containers: docker compose ps" -ForegroundColor Gray
Write-Host " [i] To stop all containers:        .\CommandStart\docker-stop-all.ps1" -ForegroundColor Gray
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host ""

if (-not $NoBrowser) {
    Write-Host "[*] Launching browser preview tabs..." -ForegroundColor Yellow
    Start-Process "http://127.0.0.1:5174/"
    Start-Process "http://127.0.0.1:5173/"
    Start-Process "http://127.0.0.1:5175/"
    Start-Process "http://localhost:5000/scalar/v1"
}
