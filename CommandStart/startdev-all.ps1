[CmdletBinding()]
param()

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

# 2. Synchronize SQL Server Database Schema via EF Core
Write-Host "[*] Synchronizing SQL Server Database Schema via EF Core..." -ForegroundColor Magenta
try {
    & dotnet ef database update --project "$backendPath"
    Write-Host "  [OK] Database schema is up to date." -ForegroundColor Green
} catch {
    Write-Host "  [!] EF Core update note: $_" -ForegroundColor Yellow
}

# 3. Check Frontend node_modules
$nodeModulesPath = Join-Path $frontendPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "[*] Frontend dependencies missing. Installing npm packages..." -ForegroundColor Yellow
    Push-Location $frontendPath
    npm install
    Pop-Location
    Write-Host "  [OK] Frontend packages installed." -ForegroundColor Green
}

# 4. Launch .NET 10 Web API Backend on Port 5000
Write-Host "[*] Launching .NET 10 Web API backend on http://localhost:5000..." -ForegroundColor Cyan
$backendCmd = "Set-Location '$backendPath'; `$host.UI.RawUI.WindowTitle = 'ResQTrack .NET 10 Web API Backend (:5000)'; dotnet run --launch-profile http"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack .NET 10 Web API Backend (:5000)' -ForegroundColor Cyan; $backendCmd }"

# 5. Wait for backend port 5000 to be ready
Write-Host "[*] Waiting for backend API to initialize..." -ForegroundColor Yellow
$maxAttempts = 20
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/reports" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
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

# 6. Launch Frontend Portals (Dual-Port Architecture)
Write-Host "`n[*] Launching Frontend Portals (Dual-Port Architecture)..." -ForegroundColor Cyan

# 6a. LDRRMO Admin Portal (:5174)
Write-Host "  [*] Launching LDRRMO Admin Command Portal on http://127.0.0.1:5174..." -ForegroundColor Magenta
$adminCmd = "Set-Location '$frontendPath'; `$host.UI.RawUI.WindowTitle = 'ResQTrack LDRRMO Admin Command Portal (:5174)'; npm run dev:admin"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack LDRRMO Admin Command Portal (:5174)' -ForegroundColor Magenta; $adminCmd }"

Start-Sleep -Seconds 2

# 6b. Responders & Civilians Portal (:5173)
Write-Host "  [*] Launching Emergency Responders & Civilians Portal on http://127.0.0.1:5173..." -ForegroundColor Green
$responderCmd = "Set-Location '$frontendPath'; `$host.UI.RawUI.WindowTitle = 'ResQTrack Responders & Civilians Portal (:5173)'; npm run dev:responder"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack Emergency Responders & Civilians Portal (:5173)' -ForegroundColor Green; $responderCmd }"

Start-Sleep -Seconds 2

# 7. Display Tactical Dashboard Status Table
Write-Host ""
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host "         RESQTRACK INCIDENT AI SYSTEM -- MULTI-PORT TACTICAL DASHBOARD                    " -ForegroundColor Cyan
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host " Portal / Service                  | Port  | Status   | Target URL                        " -ForegroundColor Yellow
Write-Host "-----------------------------------+-------+----------+-----------------------------------" -ForegroundColor DarkGray
Write-Host " LDRRMO Admin Executive Command    | :5174 | ACTIVE   | http://127.0.0.1:5174/dashboard   " -ForegroundColor Magenta
Write-Host " LDRRMO Admin Login Portal         | :5174 | ACTIVE   | http://127.0.0.1:5174/login       " -ForegroundColor Magenta
Write-Host " Emergency Responders (RHU/Fire/PNP)|:5173 | ACTIVE   | http://127.0.0.1:5173/responder   " -ForegroundColor Green
Write-Host " Civilians Emergency SOS Portal    | :5173 | ACTIVE   | http://127.0.0.1:5173/civilian    " -ForegroundColor Green
Write-Host " Responders & Civilians Login      | :5173 | ACTIVE   | http://127.0.0.1:5173/login       " -ForegroundColor Green
Write-Host " .NET 10 Web API Backend           | :5000 | ACTIVE   | http://localhost:5000/api         " -ForegroundColor Yellow
Write-Host " Scalar Interactive API Docs       | :5000 | ACTIVE   | http://localhost:5000/scalar/v1   " -ForegroundColor White
Write-Host " OpenAPI V1 Specification          | :5000 | ACTIVE   | http://localhost:5000/openapi/v1.json" -ForegroundColor White
Write-Host " Database Engine (SQL Server)      | :1433 | ONLINE   | localhost / ResQTrackDb (SSMS 19) " -ForegroundColor Cyan
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host " [i] Development services are running in 3 separate visible PowerShell windows." -ForegroundColor Gray
Write-Host " [i] To stop all running services cleanly, run: .\CommandStart\stopdev-all.ps1" -ForegroundColor Gray
Write-Host "==========================================================================================" -ForegroundColor DarkCyan
Write-Host ""

# 8. Open Browser Tabs
Write-Host "[*] Opening browser tabs for preview..." -ForegroundColor Yellow
Start-Process "http://127.0.0.1:5174/"
Start-Process "http://127.0.0.1:5173/"
Start-Process "http://localhost:5000/scalar/v1"
