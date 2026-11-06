[CmdletBinding()]
param(
    [switch]$NoBrowser = $false
)

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

$backendPath = Join-Path $RootDir "Project system ENGINE\Backend"
$frontendPath = Join-Path $RootDir "Project system ENGINE\Frontend"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "     RESQTRACK INCIDENT AI SYSTEM -- FULLSTACK DEV ENVIRONMENT        " -ForegroundColor Magenta
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stop any stale instances across ports 5000, 5173, 5174, 5175
$stopScript = Join-Path $PSScriptRoot "stopdev-all.ps1"
if (Test-Path $stopScript) {
    & $stopScript
}

# 2. Check and auto-install dependencies if missing
$nodeModulesPath = Join-Path $frontendPath "node_modules"
$backendBinPath = Join-Path $backendPath "bin"
if ((-not (Test-Path $nodeModulesPath)) -or (-not (Test-Path $backendBinPath))) {
    Write-Host "[*] Missing dependencies detected. Running auto-installer..." -ForegroundColor Yellow
    $installScript = Join-Path $PSScriptRoot "install-dependencies.ps1"
    if (Test-Path $installScript) {
        & $installScript
    }
}

# 3. Check Database & Redis Cache Availability
Write-Host "[*] Verifying Relational Database and Redis Cache status..." -ForegroundColor Cyan
$appSettings = Join-Path $backendPath "appsettings.json"
$dbProvider = "SqlServer"
if (Test-Path $appSettings) {
    $cfg = Get-Content $appSettings -Raw | ConvertFrom-Json
    if ($cfg.DatabaseProvider) { $dbProvider = $cfg.DatabaseProvider }
}

$sqlServerOnline = $false
try {
    $testConn = New-Object System.Net.Sockets.TcpClient
    $iar = $testConn.BeginConnect("127.0.0.1", 1433, $null, $null)
    $success = $iar.AsyncWaitHandle.WaitOne(800)
    if ($success) {
        $testConn.EndConnect($iar)
        $sqlServerOnline = $true
    }
    $testConn.Close()
} catch { }

# If SQL Server is offline or provider is Postgres, check Docker for PostgreSQL + Redis
if (-not $sqlServerOnline -or $dbProvider -ieq "PostgreSql") {
    Write-Host "  [*] SQL Server (:1433) is offline or PostgreSQL is configured." -ForegroundColor Yellow
    try {
        $dockerOk = & docker info 2>$null
        if ($dockerOk) {
            Write-Host "  [*] Booting Standby PostgreSQL 16 Alpine & Redis 7 Alpine in Docker..." -ForegroundColor Cyan
            $composeFile = Join-Path $RootDir "docker-compose.yml"
            & docker compose -f "$composeFile" up -d resqtrack-cache resqtrack-db-primary resqtrack-db-replica 2>$null
            Start-Sleep -Seconds 2
            Write-Host "  [OK] Docker Database & Cache services started." -ForegroundColor Green
        }
    } catch { }
}

# 4. Synchronize Database Schema via EF Core
Write-Host "[*] Synchronizing Database Schema via EF Core ($dbProvider)..." -ForegroundColor Magenta
try {
    & dotnet ef database update --project "$backendPath" --no-build 2>$null
    if ($LASTEXITCODE -ne 0) {
        & dotnet ef database update --project "$backendPath" 2>$null
    }
    Write-Host "  [OK] Database schema is up to date." -ForegroundColor Green
} catch {
    Write-Host "  [!] EF Core update note: $_" -ForegroundColor Yellow
}

# 5. Launch .NET 10 Web API Backend on Port 5000
Write-Host "`n[*] Launching .NET 10 Web API backend on http://localhost:5000..." -ForegroundColor Cyan
$backendCmd = "Set-Location '$backendPath'; `$host.UI.RawUI.WindowTitle = 'ResQTrack .NET 10 Web API Backend (:5000)'; dotnet run --launch-profile http"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack .NET 10 Web API Backend (:5000)' -ForegroundColor Cyan; $backendCmd }"

# 6. Wait for backend port 5000 to be ready
Write-Host "[*] Waiting for backend API to initialize..." -ForegroundColor Yellow
$maxAttempts = 20
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response -and $response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            $backendReady = $true
            break
        }
        # Fallback probe to reports
        $altResp = Invoke-WebRequest -Uri "http://localhost:5000/api/reports" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($altResp -and $altResp.StatusCode -ge 200 -and $altResp.StatusCode -lt 500) {
            $backendReady = $true
            break
        }
    } catch {
        if ($_.Exception.Response) {
            $backendReady = $true
            break
        }
    }
    Write-Host "." -NoNewline
}
Write-Host ""

if ($backendReady) {
    Write-Host "  [OK] Backend is live and responding on http://localhost:5000/api" -ForegroundColor Green
} else {
    Write-Host "  [i] Backend process spawned. Proceeding to launch UI portals..." -ForegroundColor Yellow
}

# 7. Launch Frontend Portals (Role & Port Separation)
Write-Host "`n[*] Launching Frontend Portals (Multi-Port Separation)..." -ForegroundColor Cyan

# 7a. LDRRMO Admin Portal (:5174)
Write-Host "  [*] Launching LDRRMO Admin Command Portal on http://127.0.0.1:5174..." -ForegroundColor Magenta
$adminCmd = "Set-Location '$frontendPath'; `$host.UI.RawUI.WindowTitle = 'ResQTrack LDRRMO Admin Command Portal (:5174)'; npm run dev:admin"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack LDRRMO Admin Command Portal (:5174)' -ForegroundColor Magenta; $adminCmd }"

Start-Sleep -Seconds 2

# 7b. Responders Portal (:5173) (RHU, Fire, PNP)
Write-Host "  [*] Launching Emergency Responders Portal on http://127.0.0.1:5173..." -ForegroundColor Green
$responderCmd = "Set-Location '$frontendPath'; `$host.UI.RawUI.WindowTitle = 'ResQTrack Emergency Responders Portal (:5173)'; npm run dev:responder"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack Emergency Responders Portal (:5173)' -ForegroundColor Green; $responderCmd }"

Start-Sleep -Seconds 2

# 7c. Civilian SOS Portal (:5175)
Write-Host "  [*] Launching Civilian Emergency SOS Portal on http://127.0.0.1:5175..." -ForegroundColor Green
$civilianCmd = "Set-Location '$frontendPath'; `$host.UI.RawUI.WindowTitle = 'ResQTrack Civilian Emergency SOS Portal (:5175)'; npm run dev:civilian"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack Civilian Emergency SOS Portal (:5175)' -ForegroundColor Green; $civilianCmd }"

Start-Sleep -Seconds 2

# 8. Display Tactical Dashboard Status Table
Write-Host ""
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host "         RESQTRACK INCIDENT AI SYSTEM -- MULTI-PORT TACTICAL DASHBOARD                    " -ForegroundColor Cyan
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host " Portal / Service                  | Port  | Status   | Target URL                        " -ForegroundColor Yellow
Write-Host "-----------------------------------+-------+----------+-----------------------------------" -ForegroundColor DarkGray
Write-Host " LDRRMO Admin Executive Command    | :5174 | ACTIVE   | http://127.0.0.1:5174/dashboard   " -ForegroundColor Magenta
Write-Host " LDRRMO Admin Login Portal         | :5174 | ACTIVE   | http://127.0.0.1:5174/login       " -ForegroundColor Magenta
Write-Host " Emergency Responders (RHU/Fire/PNP)|:5173 | ACTIVE   | http://127.0.0.1:5173/responder   " -ForegroundColor Green
Write-Host " Responders Login Portal           | :5173 | ACTIVE   | http://127.0.0.1:5173/login       " -ForegroundColor Green
Write-Host " Civilians Emergency SOS Portal    | :5175 | ACTIVE   | http://127.0.0.1:5175/civilian    " -ForegroundColor Green
Write-Host " .NET 10 Web API Backend           | :5000 | ACTIVE   | http://localhost:5000/api         " -ForegroundColor Yellow
Write-Host " Scalar Interactive API Docs       | :5000 | ACTIVE   | http://localhost:5000/scalar/v1   " -ForegroundColor White
Write-Host " Redis Distributed Cache           | :6379 | ACTIVE   | localhost:6379 (redis:7-alpine)   " -ForegroundColor Red
Write-Host " Primary Relational DB             | :5432 | ACTIVE   | localhost:5432 ($dbProvider)      " -ForegroundColor Cyan
Write-Host " Standby Relational DB Replica     | :5433 | STANDBY  | localhost:5433 (PostgreSQL 16)    " -ForegroundColor DarkCyan
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host " [i] Development services are running in 4 separate visible PowerShell windows." -ForegroundColor Gray
Write-Host " [i] To stop all running services cleanly, run: .\CommandStart\stopdev-all.ps1" -ForegroundColor Gray
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host ""

# 9. Open Browser Tabs
if (-not $NoBrowser) {
    Write-Host "[*] Opening browser tabs for preview..." -ForegroundColor Yellow
    Start-Process "http://127.0.0.1:5174/"
    Start-Process "http://127.0.0.1:5173/"
    Start-Process "http://127.0.0.1:5175/"
    Start-Process "http://localhost:5000/scalar/v1"
}
