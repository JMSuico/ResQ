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

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   INCIDENT AI SYSTEM - START DEV ENVIRONMENT     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Call stopdev-all.ps1 to prevent port contention
$stopScript = Join-Path $PSScriptRoot "stopdev-all.ps1"
if (Test-Path $stopScript) {
    Write-Host "Running stopdev-all to free ports 5000, 5173, 5174, and 5175..." -ForegroundColor Yellow
    & $stopScript
}

# 2. Check Prerequisites
Write-Host "`n[Prerequisites Check]" -ForegroundColor Cyan

# Check .NET SDK
try {
    $dotnetVersion = dotnet --version
    Write-Host " [OK] .NET SDK found: $dotnetVersion" -ForegroundColor Green
} catch {
    Write-Host " [ERROR] .NET SDK not found! Please install .NET 10 SDK." -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host " [OK] Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host " [ERROR] Node.js not found! Please install Node.js." -ForegroundColor Red
    exit 1
}

# Check Frontend node_modules
$nodeModulesPath = Join-Path $frontendPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host " [WARNING] Frontend node_modules missing. Running npm install..." -ForegroundColor Yellow
    Push-Location $frontendPath
    npm install
    Pop-Location
} else {
    Write-Host " [OK] Frontend node_modules present" -ForegroundColor Green
}

# 3. Launch .NET Backend on port 5000
Write-Host "`n[Launching Backend (.NET 10)]" -ForegroundColor Cyan
Write-Host "Starting backend on http://127.0.0.1:5000..." -ForegroundColor Yellow

$backendCmd = "Set-Location '$backendPath'; `$env:ASPNETCORE_ENVIRONMENT='Development'; dotnet run --urls 'http://0.0.0.0:5000'"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host '=== ResQTrack .NET 10 Web API Backend (:5000) ===' -ForegroundColor Cyan; $backendCmd }"

# 4. Poll http://127.0.0.1:5000/api/reports with timeout (up to 15s)
Write-Host "Waiting for backend to become responsive..." -ForegroundColor Yellow
$maxAttempts = 15
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/reports" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401 -or $response.StatusCode -eq 403) {
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
    Write-Host " [OK] Backend is up and responsive!" -ForegroundColor Green
} else {
    Write-Host " [WARNING] Backend startup taking longer than expected, proceeding with frontend launch..." -ForegroundColor Yellow
}

# 5. Launch Vite React 19 Frontend Portals
Write-Host "`n[Launching Frontend Portals (Dual-Port Architecture)]" -ForegroundColor Cyan

# 5a. Launch LDRRMO Admin Command Portal on Port 5174
Write-Host "Starting LDRRMO Super Admin Portal on http://127.0.0.1:5174..." -ForegroundColor Magenta
$adminCmd = "Set-Location '$frontendPath'; npm run dev:admin"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host '=== ResQTrack LDRRMO Admin Command Portal (:5174) ===' -ForegroundColor Magenta; $adminCmd }"

Start-Sleep -Seconds 2

# 5b. Launch Responders & Civilians Portal on Port 5173
Write-Host "Starting Emergency Responders & Civilians Portal on http://127.0.0.1:5173..." -ForegroundColor Green
$responderCmd = "Set-Location '$frontendPath'; npm run dev:responder"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host '=== ResQTrack Responders & Civilians Portal (:5173) ===' -ForegroundColor Green; $responderCmd }"

Start-Sleep -Seconds 3

# 6. Display Colorized Tactical Launch Table
Write-Host "`n"
Write-Host "======================================================================" -ForegroundColor DarkCyan
Write-Host "         INCIDENT AI SYSTEM - MULTI-PORT TACTICAL DASHBOARD           " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor DarkCyan
Write-Host " Portal / Service           | Port  | Target URL                      " -ForegroundColor DarkGray
Write-Host "----------------------------+-------+---------------------------------" -ForegroundColor DarkGray
Write-Host " LDRRMO Admin Command       | :5174 | http://127.0.0.1:5174/login     " -ForegroundColor Magenta
Write-Host " LDRRMO Admin Dashboard     | :5174 | http://127.0.0.1:5174/dashboard " -ForegroundColor Magenta
Write-Host " Responders & Civilians     | :5173 | http://127.0.0.1:5173/login     " -ForegroundColor Green
Write-Host " Responders Hub (RHU/Fire)  | :5173 | http://127.0.0.1:5173/responder " -ForegroundColor Green
Write-Host " UG Civilians Emergency SOS | :5173 | http://127.0.0.1:5173/civilian  " -ForegroundColor Green
Write-Host " .NET 10 Web API Backend    | :5000 | http://localhost:5000/api       " -ForegroundColor Yellow
Write-Host " Scalar Interactive Docs    | :5000 | http://localhost:5000/scalar/v1 " -ForegroundColor White
Write-Host " OpenAPI V1 Spec            | :5000 | http://localhost:5000/openapi/v1" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor DarkCyan

# 7. Open Browser Tabs
Write-Host "`nOpening browser tabs..." -ForegroundColor Yellow
Start-Process "http://127.0.0.1:5174/"
Start-Process "http://127.0.0.1:5173/"
Start-Process "http://localhost:5000/scalar/v1"

Write-Host "`n[INFO] Development services are running in 3 separate visible PowerShell windows." -ForegroundColor Green
Write-Host "[INFO] To stop all services, run: .\stopdev-all.ps1 or stopdev-all.bat" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
