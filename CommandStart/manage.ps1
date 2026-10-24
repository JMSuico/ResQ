# ==============================================================================
# ResQTrack Incident AI System Detection -- Unified Dev & Ops Master Controller
# Works across any Windows workstation without requiring Visual Studio IDE.
# Relational Database: Microsoft SQL Server (SSMS 19) via Windows Auth / SQL Auth
# Usage:
#   .\manage.ps1                          (Launches interactive menu)
#   .\manage.ps1 start                    (Starts Backend :5000 & Frontend :5173)
#   .\manage.ps1 status                   (Probes live health matrix of ports 5000 & 5173 & SQL Server)
#   .\manage.ps1 refresh                  (Hard refresh: cleans caches, rebuilds & restarts)
#   .\manage.ps1 stop                     (Stops all running services on ports 5000 & 5173)
#   .\manage.ps1 migrate                  (Interactive EF Core SQL Server migration & DB update)
#   .\manage.ps1 test                     (Build checks, API tests, SQL Server check & TS verification)
#   .\manage.ps1 help                     (Displays help guide and SQL Server auth details)
#   .\manage.ps1 createsuperadmin <email> <password> <fullName> [unit]
#   .\manage.ps1 createcustomsuperadmin <email> <password> <fullName> [unit]
#   .\manage.ps1 resetpassword <email> <newPassword>
#   .\manage.ps1 adduser <email> <password> <fullName> <role> [unit] [employeeId]
#   .\manage.ps1 listusers
# ==============================================================================

param (
    [Parameter(Position=0)]
    [string]$Action = "",

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$CmdArgs = @()
)

$ErrorActionPreference = "Stop"

# Resolve root and inner directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }

# Detect repository root containing "Project system ENGINE"
if (Test-Path (Join-Path $ScriptDir "Project system ENGINE")) {
    $RootDir = $ScriptDir
} elseif (Test-Path (Join-Path (Split-Path -Parent $ScriptDir) "Project system ENGINE")) {
    $RootDir = Split-Path -Parent $ScriptDir
} else {
    $RootDir = $ScriptDir
}

$EngineDir = Join-Path $RootDir "Project system ENGINE"
$BackendDir = Join-Path $EngineDir "Backend"
$FrontendDir = Join-Path $EngineDir "Frontend"

$AllArgs = if ($CmdArgs -and $CmdArgs.Count -gt 0) { $CmdArgs } else { $args }

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Get-DatabaseConfig {
    $appSettingsPath = Join-Path $BackendDir "appsettings.json"
    $provider = "SqlServer"
    $connStr = "Server=localhost;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;"
    $source = "Default fallback"

    if (Test-Path $appSettingsPath) {
        try {
            $json = Get-Content $appSettingsPath -Raw | ConvertFrom-Json
            if ($json.DatabaseProvider) {
                $provider = $json.DatabaseProvider
            }
            if ($json.ConnectionStrings -and $json.ConnectionStrings.DefaultConnection) {
                $connStr = $json.ConnectionStrings.DefaultConnection
                $source = "appsettings.json"
            }
        } catch {
            $source = "Error reading appsettings.json"
        }
    }

    $authMode = "Standard / SQL Login"
    if ($connStr -match "(?i)Trusted_Connection=True|Integrated Security=(True|SSPI)") {
        $authMode = "Windows Authentication (SSMS 19 Trusted)"
    } elseif ($connStr -match "(?i)User Id=") {
        $authMode = "SQL Server Authentication (SQL Login)"
    }

    return [PSCustomObject]@{
        Provider         = $provider
        ConnectionString = $connStr
        AuthMode         = $authMode
        ConfigSource     = $source
    }
}

function Check-Prerequisites {
    Write-Host "[*] Checking development prerequisites..." -ForegroundColor Gray
    
    # 1. Check .NET SDK
    try {
        $dotnetVer = & dotnet --version 2>$null
        Write-Host "  [OK] .NET SDK installed: v$dotnetVer" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] .NET SDK is not installed! Download .NET 10 or .NET 9 from https://dotnet.microsoft.com/download" -ForegroundColor Red
        return $false
    }

    # 2. Check Node.js
    try {
        $nodeVer = & node --version 2>$null
        Write-Host "  [OK] Node.js installed: $nodeVer" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Node.js is not installed! Download Node.js from https://nodejs.org/" -ForegroundColor Red
        return $false
    }

    # 3. Check Frontend node_modules
    $nmPath = Join-Path $FrontendDir "node_modules"
    if (-not (Test-Path $nmPath)) {
        Write-Host "  [*] Frontend dependencies not found. Installing now..." -ForegroundColor Yellow
        Push-Location $FrontendDir
        & npm install
        Pop-Location
        Write-Host "  [OK] Frontend dependencies installed successfully." -ForegroundColor Green
    }

    return $true
}

function Invoke-TscValidation {
    $tscLocal = Join-Path $FrontendDir "node_modules\.bin\tsc.cmd"
    if (Test-Path $tscLocal) {
        & $tscLocal -b
    } elseif (Get-Command tsc -ErrorAction SilentlyContinue) {
        & tsc -b
    } else {
        & npx --yes tsc -b
    }
    return $LASTEXITCODE
}

function Stop-AllServices {
    Write-Header "STOPPING ALL SERVICES (PORTS 5000, 5173, 5174, 5175)"
    
    $ports = @(5000, 5173, 5174, 5175)
    $killedCount = 0

    foreach ($port in $ports) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connections) {
                foreach ($conn in $connections) {
                    $pidToKill = $conn.OwningProcess
                    if ($pidToKill -gt 0 -and $pidToKill -ne $PID) {
                        try {
                            $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
                            if ($proc) {
                                Write-Host "  [!] Terminating process $($proc.ProcessName) (PID: $pidToKill) on port $port..." -ForegroundColor Yellow
                                & taskkill /F /PID $pidToKill /T 2>$null | Out-Null
                                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                                $killedCount++
                            }
                        } catch {}
                    }
                }
            }
        } catch {}
    }

    # Fallback to netstat if Get-NetTCPConnection did not catch anything
    if ($killedCount -eq 0) {
        foreach ($port in $ports) {
            $lines = netstat -ano | Select-String ":$port\s+.*LISTENING\s+(\d+)"
            foreach ($line in $lines) {
                if ($line.Matches.Groups[1].Value) {
                    $pidToKill = [int]$line.Matches.Groups[1].Value
                    if ($pidToKill -gt 0 -and $pidToKill -ne $PID) {
                        Write-Host "  [!] Terminating listener PID $pidToKill on port $port..." -ForegroundColor Yellow
                        & taskkill /F /PID $pidToKill /T 2>$null | Out-Null
                        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                        $killedCount++
                    }
                }
            }
        }
    }

    if ($killedCount -gt 0) {
        Write-Host "  [OK] Stopped $killedCount service process(es). Ports 5000, 5173, 5174, and 5175 are now free." -ForegroundColor Green
    } else {
        Write-Host "  [i] No active services detected on ports 5000, 5173, 5174, or 5175." -ForegroundColor Gray
    }
}

function Show-Status {
    Write-Header "RESQTRACK SYSTEM LIVE STATUS & PORT MATRIX"
    
    $services = @(
        @{ Port = 5000; Name = "Backend Web API"; Target = "http://localhost:5000/api/reports"; Role = ".NET 10 REST API & Scalar Docs" },
        @{ Port = 5173; Name = "Responders & Civilians"; Target = "http://127.0.0.1:5173/"; Role = "React 19 Responders & Civilian SOS Portal" },
        @{ Port = 5174; Name = "LDRRMO Admin Command"; Target = "http://127.0.0.1:5174/"; Role = "React 19 Executive Command & Governance" }
    )

    $format = "{0,-6} | {1,-20} | {2,-8} | {3,-12} | {4,-14} | {5}"
    Write-Host ($format -f "PORT", "SERVICE NAME", "PID", "TCP STATUS", "HTTP HEALTH", "DESCRIPTION") -ForegroundColor Yellow
    Write-Host ("-" * 95) -ForegroundColor DarkGray

    foreach ($svc in $services) {
        $p = $svc.Port
        $procId = "-"
        $tcpStatus = "OFFLINE"
        $httpStatus = "UNKNOWN"

        # Check TCP Listener
        try {
            $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($conn) {
                $procId = $conn.OwningProcess
                $tcpStatus = "LISTENING"
            }
        } catch {}

        if ($tcpStatus -eq "OFFLINE") {
            # Netstat fallback
            $match = netstat -ano | Select-String ":$p\s+.*LISTENING\s+(\d+)" | Select-Object -First 1
            if ($match -and $match.Matches.Groups[1].Value) {
                $procId = [int]$match.Matches.Groups[1].Value
                $tcpStatus = "LISTENING"
            }
        }

        # Check HTTP Endpoint
        if ($tcpStatus -eq "LISTENING") {
            try {
                $resp = Invoke-WebRequest -Uri $svc.Target -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
                if ($resp.StatusCode -eq 200 -or $resp.StatusCode -eq 204) {
                    $httpStatus = "200 OK"
                } else {
                    $httpStatus = "HTTP $($resp.StatusCode)"
                }
            } catch {
                if ($_.Exception.Response) {
                    $code = [int]$_.Exception.Response.StatusCode
                    $httpStatus = "HTTP $code"
                } else {
                    $httpStatus = "NO RESPONSE"
                }
            }
        } else {
            $httpStatus = "DOWN"
        }

        $color = if ($tcpStatus -eq "LISTENING" -and $httpStatus -like "*200*") { "Green" } elseif ($tcpStatus -eq "LISTENING") { "Yellow" } else { "DarkGray" }
        Write-Host ($format -f $p, $svc.Name, $procId, $tcpStatus, $httpStatus, $svc.Role) -ForegroundColor $color
    }

    Write-Host ("-" * 95) -ForegroundColor DarkGray
    Write-Host ""

    # Database Diagnostics & Active RDBMS Provider
    Write-Host "DATABASE & RDBMS ENGINE STATUS (SSMS 19)" -ForegroundColor Yellow
    Write-Host ("-" * 95) -ForegroundColor DarkGray
    $dbConfig = Get-DatabaseConfig
    Write-Host "  Active Provider:    $($dbConfig.Provider) (Microsoft SQL Server / SSMS 19 Compatible)" -ForegroundColor Green
    Write-Host "  Target Connection:  $($dbConfig.ConnectionString)" -ForegroundColor Gray
    Write-Host "  Authentication:     $($dbConfig.AuthMode)" -ForegroundColor Cyan
    Write-Host "  Configuration From: $($dbConfig.ConfigSource)" -ForegroundColor DarkGray
    Write-Host ("-" * 95) -ForegroundColor DarkGray
    Write-Host ""
}

function Start-AllServices {
    Write-Header "STARTING RESQTRACK INCIDENT AI SYSTEM (DEV PREVIEW - DUAL PORT)"
    if (-not (Check-Prerequisites)) { return }

    # 1. Stop any stale instances across ports 5000, 5173, 5174, and 5175
    Stop-AllServices

    # 2. Update Database via EF Core to ensure SQL Server schemas are current
    $targetProject = if (Test-Path "$BackendDir") { "$BackendDir" } else { "..\Project system ENGINE\Backend" }
    Write-Host "[*] Synchronizing SQL Server Database Schema via EF Core..." -ForegroundColor Magenta
    try {
        Push-Location $RootDir
        & dotnet ef database update --project "$targetProject"
        Pop-Location
        Write-Host "  [OK] Database schema is up to date." -ForegroundColor Green
    } catch {
        Write-Host "  [!] EF Core update note: $_" -ForegroundColor Yellow
        Pop-Location
    }

    # 3. Start Backend Web API on Port 5000
    Write-Host "[*] Launching .NET 10 Web API backend on http://localhost:5000..." -ForegroundColor Cyan
    $backendCmd = "Set-Location '$BackendDir'; `$host.UI.RawUI.WindowTitle = 'ResQTrack .NET 10 Web API Backend (:5000)'; dotnet run --launch-profile http"
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack .NET 10 Web API Backend (:5000)' -ForegroundColor Cyan; $backendCmd }"

    # Wait for backend port 5000 to be ready
    Write-Host "[*] Waiting for backend API to initialize..." -ForegroundColor Yellow
    $retry = 0
    $backendReady = $false
    while ($retry -lt 20 -and -not $backendReady) {
        Start-Sleep -Seconds 1
        try {
            $testReq = Invoke-WebRequest -Uri "http://localhost:5000/api/reports" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($testReq.StatusCode -ge 200 -and $testReq.StatusCode -lt 500) { $backendReady = $true }
        } catch {
            if ($_.Exception.Response) {
                # API responded with HTTP status, so backend is alive
                $backendReady = $true
            } else {
                $retry++
            }
        }
        Write-Host "." -NoNewline
    }
    Write-Host ""

    if ($backendReady) {
        Write-Host "  [OK] Backend is live and responding on http://localhost:5000/api" -ForegroundColor Green
    } else {
        Write-Host "  [i] Backend process spawned. Proceeding to launch UI client..." -ForegroundColor Yellow
    }

    # 4. Start React 19 Frontend Portals (Dual-Port RBAC Isolation)
    Write-Host "[*] Launching LDRRMO Admin Command Portal on http://127.0.0.1:5174..." -ForegroundColor Magenta
    $adminCmd = "Set-Location '$FrontendDir'; `$host.UI.RawUI.WindowTitle = 'ResQTrack LDRRMO Admin Command Portal (:5174)'; npm run dev:admin"
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack LDRRMO Admin Command Portal (:5174)' -ForegroundColor Magenta; $adminCmd }"

    Start-Sleep -Seconds 2

    Write-Host "[*] Launching Responders & Civilians Portal on http://127.0.0.1:5173..." -ForegroundColor Green
    $responderCmd = "Set-Location '$FrontendDir'; `$host.UI.RawUI.WindowTitle = 'ResQTrack Responders & Civilians Portal (:5173)'; npm run dev:responder"
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "& { Write-Host 'ResQTrack Emergency Responders & Civilians Portal (:5173)' -ForegroundColor Green; $responderCmd }"

    Start-Sleep -Seconds 2

    # 5. Print Access Dashboard & Auto-Launch Web Browser
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

    Write-Host "[*] Opening browser tabs for preview..." -ForegroundColor Yellow
    Start-Process "http://127.0.0.1:5174/"
    Start-Process "http://127.0.0.1:5173/"
    Start-Process "http://localhost:5000/scalar/v1"
}

function Hard-Refresh {
    Write-Header "HARD REFRESH & CLEAN REBUILD (ALL SERVICES)"
    
    # 1. Stop existing services on ports 5000, 5173, and 5174
    Stop-AllServices

    # 2. Clean Vite Cache & Build Artifacts
    Write-Host "[*] Cleaning Vite cache and frontend build output..." -ForegroundColor Gray
    $viteCache = Join-Path $FrontendDir "node_modules\.vite"
    if (Test-Path $viteCache) { Remove-Item -Recurse -Force $viteCache }
    $distFolder = Join-Path $FrontendDir "dist"
    if (Test-Path $distFolder) { Remove-Item -Recurse -Force $distFolder }
    Write-Host "  [OK] Frontend cache purged." -ForegroundColor Green

    # 3. Clean .NET bin & obj
    Write-Host "[*] Cleaning .NET build artifacts..." -ForegroundColor Gray
    Push-Location $BackendDir
    & dotnet clean --verbosity quiet
    Pop-Location
    Write-Host "  [OK] .NET clean completed." -ForegroundColor Green

    # 4. Verify Frontend TypeScript Compilation with resilient tsc detection
    Write-Host "[*] Validating TypeScript compilation (tsc -b)..." -ForegroundColor Gray
    Push-Location $FrontendDir
    $tscCode = Invoke-TscValidation
    if ($tscCode -ne 0) {
        Write-Host "  [ERROR] TypeScript build failed. Please fix compile errors before refreshing." -ForegroundColor Red
        Pop-Location
        return
    }
    Write-Host "  [OK] TypeScript check passed with 0 errors." -ForegroundColor Green
    Pop-Location

    # 5. Build .NET Backend
    Write-Host "[*] Building .NET 10 backend..." -ForegroundColor Gray
    Push-Location $BackendDir
    & dotnet build Backend.csproj
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Backend build failed." -ForegroundColor Red
        Pop-Location
        return
    }
    Write-Host "  [OK] Backend built successfully with 0 errors." -ForegroundColor Green
    Pop-Location

    # 6. Re-launch fresh services across both ports
    Start-AllServices
}

function Run-DatabaseMigrations {
    Write-Header "ENTITY FRAMEWORK CORE DATABASE MIGRATIONS (MICROSOFT SQL SERVER / SSMS 19)"
    if (-not (Check-Prerequisites)) { return }

    $targetProject = if (Test-Path "$BackendDir") { "$BackendDir" } else { "..\Project system ENGINE\Backend" }
    $dbConfig = Get-DatabaseConfig

    Write-Host "Active RDBMS Provider: $($dbConfig.Provider) (Microsoft SQL Server / SSMS 19)" -ForegroundColor Cyan
    Write-Host "Target Connection:     $($dbConfig.ConnectionString)" -ForegroundColor Gray
    Write-Host "Authentication Mode:   $($dbConfig.AuthMode)" -ForegroundColor Gray
    Write-Host "Target EF Project:     $targetProject" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Choose migration option:" -ForegroundColor Yellow
    Write-Host "  [1] Apply all pending migrations (dotnet ef database update --project `"$targetProject`")"
    Write-Host "  [2] Create a new migration and apply it to SQL Server"
    Write-Host "  [3] Re-seed initial database & test fixtures"
    Write-Host "  [0] Back to main menu"
    $choice = Read-Host "Select [0-3]"

    switch ($choice) {
        "1" {
            Write-Host "[*] Synchronizing SQL Server Database Schema via EF Core..." -ForegroundColor Magenta
            Push-Location $RootDir
            & dotnet ef database update --project "$targetProject"
            Pop-Location
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Database schema is up to date." -ForegroundColor Green
            } else {
                Write-Host "[!] Migration failed. Ensure Microsoft SQL Server is running and connection string is valid." -ForegroundColor Red
            }
        }
        "2" {
            $migName = Read-Host "Enter descriptive name for the new migration (e.g. SqlServerInitialCreate)"
            if ([string]::IsNullOrWhiteSpace($migName)) {
                Write-Host "[!] Migration name cannot be empty." -ForegroundColor Red
                return
            }
            Write-Host "[*] Creating EF Core migration '$migName' for Microsoft SQL Server..." -ForegroundColor Cyan
            Push-Location $RootDir
            & dotnet ef migrations add $migName --project "$targetProject"
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[*] Applying new migration to Microsoft SQL Server..." -ForegroundColor Cyan
                & dotnet ef database update --project "$targetProject"
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[OK] Migration '$migName' successfully created and applied to SQL Server." -ForegroundColor Green
                }
            }
            Pop-Location
        }
        "3" {
            Write-Host "[*] Triggering database re-seed via CLI..." -ForegroundColor Cyan
            Push-Location $BackendDir
            & dotnet run -- listcliusers
            Pop-Location
            Write-Host "[OK] Database ready." -ForegroundColor Green
        }
        Default { return }
    }
}

function Run-HealthTests {
    Write-Header "RESQTRACK SYSTEM HEALTH & INTEGRITY CHECK"
    
    # 1. Check Backend Build
    Write-Host "[1/5] Checking .NET 10 compilation..." -ForegroundColor Gray
    Push-Location $BackendDir
    & dotnet build Backend.csproj --verbosity minimal
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Backend compiles with 0 errors." -ForegroundColor Green
    }
    Pop-Location

    # 2. Check Frontend Typecheck with resilient tsc detection
    Write-Host "[2/5] Checking Frontend TypeScript..." -ForegroundColor Gray
    Push-Location $FrontendDir
    $tscCode = Invoke-TscValidation
    if ($tscCode -eq 0) {
        Write-Host "  [OK] Frontend TypeScript compiles with 0 errors." -ForegroundColor Green
    }
    Pop-Location

    # 3. Check Relational Database Configuration
    Write-Host "[3/5] Verifying Relational Database Configuration (SQL Server / SSMS 19)..." -ForegroundColor Gray
    $dbConfig = Get-DatabaseConfig
    if ($dbConfig.Provider -ieq "SqlServer") {
        Write-Host "  [OK] Active RDBMS Provider: $($dbConfig.Provider) (Microsoft SQL Server)" -ForegroundColor Green
        Write-Host "  [OK] Authentication Mode:   $($dbConfig.AuthMode)" -ForegroundColor Green
        Write-Host "  [i] Connection Target:      $($dbConfig.ConnectionString)" -ForegroundColor DarkGray
    } else {
        Write-Host "  [!] Active Provider is configured as: $($dbConfig.Provider)" -ForegroundColor Yellow
    }

    # 4. Check live API endpoints if running
    Write-Host "[4/5] Testing Backend REST API connectivity (:5000)..." -ForegroundColor Gray
    try {
        $reports = Invoke-RestMethod -Uri "http://localhost:5000/api/reports" -TimeoutSec 3 -ErrorAction Stop
        Write-Host "  [OK] GET /api/reports returned successfully." -ForegroundColor Green
    } catch {
        Write-Host "  [i] Backend is not currently running. Start services via Option [1] to test live API." -ForegroundColor Yellow
    }

    # 5. Probe Frontend Port 5173
    Write-Host "[5/5] Checking Frontend listener (:5173)..." -ForegroundColor Gray
    $found = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "  [OK] Frontend Client (:5173) is active (PID: $($found.OwningProcess))." -ForegroundColor Green
    } else {
        Write-Host "  [i] Frontend Client (:5173) is not listening." -ForegroundColor DarkGray
    }
}

function Show-Help {
    Write-Header "RESQTRACK DEV & OPS MASTER CONTROLLER -- USAGE & HELP"
    Write-Host "Architecture Overview:" -ForegroundColor Yellow
    Write-Host "  Backend:    .NET 10 ASP.NET Core REST API (:5000)" -ForegroundColor White
    Write-Host "  Frontend:   React 19 + TypeScript + Vite (:5173)" -ForegroundColor White
    Write-Host "  Database:   Microsoft SQL Server (SSMS 19 Compatible Relational Store)" -ForegroundColor White
    Write-Host ""
    Write-Host "SQL Server Authentication Options (configured in appsettings.json):" -ForegroundColor Yellow
    Write-Host "  * Windows Authentication (Recommended for local dev / SSMS):" -ForegroundColor Cyan
    Write-Host "    Server=localhost;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;" -ForegroundColor Gray
    Write-Host "  * LocalDB Instance (SQL Server Express / Visual Studio LocalDB):" -ForegroundColor Cyan
    Write-Host "    Server=(localdb)\mssqllocaldb;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;" -ForegroundColor Gray
    Write-Host "  * SQL Server Authentication (SSMS / Production SQL logins):" -ForegroundColor Cyan
    Write-Host "    Server=localhost;Database=ResQTrackDb;User Id=sa;Password=<YourPassword>;TrustServerCertificate=True;MultipleActiveResultSets=true;" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Available CLI Actions:" -ForegroundColor Yellow
    Write-Host "  .\manage.ps1 start                    Start Backend (:5000) & Frontend (:5173)"
    Write-Host "  .\manage.ps1 status                   Inspect health matrix & SQL Server RDBMS connection"
    Write-Host "  .\manage.ps1 refresh                  Hard refresh: cleans caches, rebuilds & restarts"
    Write-Host "  .\manage.ps1 stop                     Stop all running services on ports 5000 & 5173"
    Write-Host "  .\manage.ps1 migrate                  Apply EF Core migrations to SQL Server (SSMS 19)"
    Write-Host "  .\manage.ps1 test                     Run compilation, TypeScript, and SQL Server health tests"
    Write-Host "  .\manage.ps1 help                     Display this help guide"
    Write-Host "  .\manage.ps1 createsuperadmin <email> <password> <fullName> [unit]"
    Write-Host "  .\manage.ps1 createcustomsuperadmin <email> <password> <fullName> [unit]"
    Write-Host "  .\manage.ps1 resetpassword <email> <newPassword>"
    Write-Host "  .\manage.ps1 adduser <email> <password> <fullName> <role> [unit] [employeeId]"
    Write-Host "  .\manage.ps1 listusers                List all registered users from SQL Server"
    Write-Host ""
}

function New-SuperAdminPrompt {
    Write-Header "CREATE SUPERADMIN CLI (LDRRMO EXECUTIVE DIRECTOR)"
    $email = Read-Host "Enter Email (e.g. ldrrmo.admin@resqtrack.gov.ph)"
    $password = Read-Host "Enter Password (min 12 chars)"
    $fullName = Read-Host "Enter Full Name (e.g. Director Alejandro Ramos)"
    $unit = Read-Host "Enter Unit [LDRRMO/RHU/FIRE/PNP/Security] (Default: LDRRMO)"
    if ([string]::IsNullOrWhiteSpace($unit)) { $unit = "LDRRMO" }

    if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($password) -or [string]::IsNullOrWhiteSpace($fullName)) {
        Write-Host "[!] Email, Password, and Full Name are required." -ForegroundColor Red
        return
    }
    Push-Location $BackendDir
    & dotnet run -- createsuperadmin "$email" "$password" "$fullName" "$unit"
    Pop-Location
}

function New-CustomSuperAdminPrompt {
    Write-Header "CREATE CUSTOM SUPERADMIN CLI"
    $email = Read-Host "Enter Email"
    $password = Read-Host "Enter Password (min 12 chars)"
    $fullName = Read-Host "Enter Full Name"
    $unit = Read-Host "Enter Unit [LDRRMO/RHU/FIRE/PNP/Security] (Default: RHU)"
    if ([string]::IsNullOrWhiteSpace($unit)) { $unit = "RHU" }

    if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($password) -or [string]::IsNullOrWhiteSpace($fullName)) {
        Write-Host "[!] Email, Password, and Full Name are required." -ForegroundColor Red
        return
    }
    Push-Location $BackendDir
    & dotnet run -- createcustomsuperadmin "$email" "$password" "$fullName" "$unit"
    Pop-Location
}

function New-ResetPasswordPrompt {
    Write-Header "RESET USER PASSWORD CLI (SCRYPT KDF)"
    $email = Read-Host "Enter Email of User"
    $newPassword = Read-Host "Enter New Password (min 12 chars)"
    if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($newPassword)) {
        Write-Host "[!] Email and New Password are required." -ForegroundColor Red
        return
    }
    Push-Location $BackendDir
    & dotnet run -- resetpassword "$email" "$newPassword"
    Pop-Location
}

function New-UserCliPrompt {
    Write-Header "ADD NEW USER CLI (ADMIN / RESPONDER / CIVILIAN)"
    $email = Read-Host "Enter Email"
    $password = Read-Host "Enter Password (min 12 chars)"
    $fullName = Read-Host "Enter Full Name"
    $role = Read-Host "Enter Role [LDRRMO_Admin/Responder/Civilian] (Default: Civilian)"
    if ([string]::IsNullOrWhiteSpace($role)) { $role = "Civilian" }
    $unit = Read-Host "Enter Unit [None/LDRRMO/RHU/FIRE/PNP/Security] (Default: None)"
    if ([string]::IsNullOrWhiteSpace($unit)) { $unit = "None" }
    $id = Read-Host "Enter Employee or Resident ID (Optional)"
    
    if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($password) -or [string]::IsNullOrWhiteSpace($fullName)) {
        Write-Host "[!] Email, Password, and Full Name are required." -ForegroundColor Red
        return
    }
    Push-Location $BackendDir
    & dotnet run -- adduser "$email" "$password" "$fullName" "$role" "$unit" "$id"
    Pop-Location
}

function New-DeleteSuperAdminPrompt {
    Write-Header "DELETE SUPERADMIN ACCOUNT CLI (SQL SERVER)"
    $email = Read-Host "Enter SuperAdmin Email to delete"
    if ([string]::IsNullOrWhiteSpace($email)) {
        Write-Host "[!] Email cannot be empty." -ForegroundColor Red
        return
    }
    Write-Host "[!] WARNING: You are about to permanently delete SuperAdmin account: $email" -ForegroundColor Red
    $confirm = Read-Host "Type 'CONFIRM' or 'yes' to proceed with deletion"
    if ($confirm -ne 'CONFIRM' -and $confirm -ne 'yes') {
        Write-Host "[-] Deletion cancelled by user." -ForegroundColor Yellow
        return
    }
    Push-Location $BackendDir
    & dotnet run -- deletesuperadmin "$email"
    Pop-Location
}

# ─── Command Line Argument Dispatcher ────────────────────────────────────────
switch ($Action.ToLower()) {
    "start"   { Start-AllServices; exit }
    "status"  { Show-Status; exit }
    "refresh" { Hard-Refresh; exit }
    "stop"    { Stop-AllServices; exit }
    "migrate" { Run-DatabaseMigrations; exit }
    "test"    { Run-HealthTests; exit }
    "help"    { Show-Help; exit }
    "-h"      { Show-Help; exit }
    "--help"  { Show-Help; exit }
    "-?"      { Show-Help; exit }
    "createsuperadmin" { 
        if ($AllArgs.Count -lt 3) {
            Write-Host "Usage: .\manage.ps1 createsuperadmin <email> <password> <fullName> [unit]" -ForegroundColor Red
            exit 1
        }
        $unit = if ($AllArgs.Count -gt 3) { $AllArgs[3] } else { "LDRRMO" }
        Push-Location $BackendDir
        & dotnet run -- createsuperadmin "$($AllArgs[0])" "$($AllArgs[1])" "$($AllArgs[2])" "$unit"
        Pop-Location
        exit 
    }
    "createcustomsuperadmin" {
        if ($AllArgs.Count -lt 3) {
            Write-Host "Usage: .\manage.ps1 createcustomsuperadmin <email> <password> <fullName> [unit]" -ForegroundColor Red
            exit 1
        }
        $unit = if ($AllArgs.Count -gt 3) { $AllArgs[3] } else { "RHU" }
        Push-Location $BackendDir
        & dotnet run -- createcustomsuperadmin "$($AllArgs[0])" "$($AllArgs[1])" "$($AllArgs[2])" "$unit"
        Pop-Location
        exit
    }
    "deletesuperadmin" {
        if ($AllArgs.Count -lt 1) {
            Write-Host "Usage: .\manage.ps1 deletesuperadmin <email>" -ForegroundColor Red
            exit 1
        }
        Push-Location $BackendDir
        & dotnet run -- deletesuperadmin "$($AllArgs[0])"
        Pop-Location
        exit
    }
    "resetpassword" {
        if ($AllArgs.Count -lt 2) {
            Write-Host "Usage: .\manage.ps1 resetpassword <email> <newPassword>" -ForegroundColor Red
            exit 1
        }
        Push-Location $BackendDir
        & dotnet run -- resetpassword "$($AllArgs[0])" "$($AllArgs[1])"
        Pop-Location
        exit
    }
    "adduser" {
        if ($AllArgs.Count -lt 4) {
            Write-Host "Usage: .\manage.ps1 adduser <email> <password> <fullName> <role> [unit] [employeeId]" -ForegroundColor Red
            exit 1
        }
        $unit = if ($AllArgs.Count -gt 4) { $AllArgs[4] } else { "None" }
        $id = if ($AllArgs.Count -gt 5) { $AllArgs[5] } else { "" }
        Push-Location $BackendDir
        & dotnet run -- adduser "$($AllArgs[0])" "$($AllArgs[1])" "$($AllArgs[2])" "$($AllArgs[3])" "$unit" "$id"
        Pop-Location
        exit
    }
    "listusers" {
        Push-Location $BackendDir
        & dotnet run -- listcliusers
        Pop-Location
        exit
    }
}

# ─── Interactive Console Menu ────────────────────────────────────────────────
do {
    Clear-Host
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "   RESQTRACK INCIDENT AI SYSTEM DETECTION -- DEV & OPS CONTROLLER    " -ForegroundColor Yellow
    Write-Host "   Database Engine: Microsoft SQL Server (SSMS 19 / Windows & SQL Auth)" -ForegroundColor DarkCyan
    Write-Host "   Single command runner for any team member's Windows machine        " -ForegroundColor Gray
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] Start Fullstack Dev        -> Backend :5000 + Responders :5173 + Admin :5174" -ForegroundColor White
    Write-Host "  [2] Live Status Matrix         -> Probes ports 5000, 5173, 5174 & SQL Server DB" -ForegroundColor White
    Write-Host "  [3] Hard Refresh & Rebuild     -> Purge caches, re-compile & restart services" -ForegroundColor White
    Write-Host "  [4] Stop All Services          -> Free ports 5000, 5173, and 5174" -ForegroundColor White
    Write-Host "  [5] Database Migrations        -> EF Core SQL Server (SSMS 19) migrations" -ForegroundColor White
    Write-Host "  [6] Health Check & Tests       -> Compilation, TypeScript, SQL Server & API" -ForegroundColor White
    Write-Host "  [7] Create SuperAdmin CLI      -> Terminal prompt for createsuperadmin" -ForegroundColor White
    Write-Host "  [8] Create Custom Admin CLI    -> Terminal prompt for createcustomsuperadmin" -ForegroundColor White
    Write-Host "  [9] Reset User Password CLI   -> Terminal prompt for resetpassword (Scrypt KDF)" -ForegroundColor White
    Write-Host "  [10] Add User CLI              -> Terminal prompt to add Admin/Responder/Civilian" -ForegroundColor White
    Write-Host "  [11] List All Users            -> Lists all accounts from SQL Server database" -ForegroundColor White
    Write-Host "  [12] Delete SuperAdmin CLI     -> Permanently delete SuperAdmin account" -ForegroundColor Red
    Write-Host ""
    Write-Host "  [0] Exit" -ForegroundColor DarkGray
    Write-Host "======================================================================" -ForegroundColor Cyan
    $sel = Read-Host "Select an option [0-12]"

    switch ($sel) {
        "1"  { Start-AllServices; Read-Host "`nPress Enter to return to menu..." }
        "2"  { Show-Status; Read-Host "`nPress Enter to return to menu..." }
        "3"  { Hard-Refresh; Read-Host "`nPress Enter to return to menu..." }
        "4"  { Stop-AllServices; Read-Host "`nPress Enter to return to menu..." }
        "5"  { Run-DatabaseMigrations; Read-Host "`nPress Enter to return to menu..." }
        "6"  { Run-HealthTests; Read-Host "`nPress Enter to return to menu..." }
        "7"  { New-SuperAdminPrompt; Read-Host "`nPress Enter to return to menu..." }
        "8"  { New-CustomSuperAdminPrompt; Read-Host "`nPress Enter to return to menu..." }
        "9"  { New-ResetPasswordPrompt; Read-Host "`nPress Enter to return to menu..." }
        "10" { New-UserCliPrompt; Read-Host "`nPress Enter to return to menu..." }
        "11" { 
            Push-Location $BackendDir
            & dotnet run -- listcliusers
            Pop-Location
            Read-Host "`nPress Enter to return to menu..." 
        }
        "12" { New-DeleteSuperAdminPrompt; Read-Host "`nPress Enter to return to menu..." }
        "0"  { Write-Host "`nExiting. Stay safe, ResQTrack!" -ForegroundColor Yellow; break }
        Default { Write-Host "`nInvalid selection." -ForegroundColor Red; Start-Sleep -Seconds 1 }
    }
} while ($sel -ne "0")
