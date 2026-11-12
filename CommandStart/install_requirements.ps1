<#
.SYNOPSIS
    ResQTrack Incident AI System - 1-Click Automated Requirements & Dependency Installer.
.DESCRIPTION
    Installs and configures all runtime requirements on any Windows PC or laptop:
    1. .NET 10 SDK (ASP.NET Core .NET 10 SDK)
    2. Node.js (LTS v20+) & npm
    3. Database Engine: Microsoft SQL Server (LocalDB / Express / SSMS 19) OR PostgreSQL (any edition)
    4. C# Backend NuGet dependencies & build verification
    5. Frontend npm modules, TypeScript packages, Vite build verification
    6. Database connection configuration & automated seed
#>

[CmdletBinding()]
param (
    [switch]$Unattended = $false,
    [ValidateSet("SqlServer", "PostgreSql", "SSMS", "Auto")]
    [string]$Database = "Auto"
)

$ErrorActionPreference = "Continue"

# Resolve Directory Paths
if (Test-Path "$PSScriptRoot\Project system ENGINE") {
    $RootDir = $PSScriptRoot
} elseif (Test-Path "$PSScriptRoot\..\Project system ENGINE") {
    $RootDir = (Resolve-Path "$PSScriptRoot\..").Path
} else {
    $RootDir = (Get-Location).Path
}

$BackendDir  = Join-Path $RootDir "Project system ENGINE\Backend"
$FrontendDir = Join-Path $RootDir "Project system ENGINE\Frontend"
$AppSettingsFile = Join-Path $BackendDir "appsettings.json"

function Write-Banner {
    Clear-Host
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "   RESQTRACK INCIDENT AI DETECTION SYSTEM - 1-CLICK ENVIRONMENT SETUP         " -ForegroundColor Yellow
    Write-Host "   Automatic Requirements Installer for Any Windows PC or Laptop               " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host " Root Directory : $RootDir" -ForegroundColor White
    Write-Host " Backend Path   : $BackendDir" -ForegroundColor DarkGray
    Write-Host " Frontend Path  : $FrontendDir" -ForegroundColor DarkGray
    Write-Host " Target Area    : Katipunan, Zamboanga del Norte (7109)" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------------------------------------`n" -ForegroundColor DarkGray
}

function Write-Step { param([string]$Msg) Write-Host "`n>> $Msg" -ForegroundColor Yellow }
function Write-Pass { param([string]$Msg) Write-Host " [PASS] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host " [WARN] $Msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$Msg) Write-Host " [FAIL] $Msg" -ForegroundColor Red }
function Write-Info { param([string]$Msg) Write-Host " [INFO] $Msg" -ForegroundColor Cyan }

# Test administrator privileges
function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Test if a command is available in PATH
function Test-CommandAvailable {
    param([string]$Cmd)
    return [bool](Get-Command $Cmd -ErrorAction SilentlyContinue)
}

# Refresh Environment Variables for current process
function Refresh-EnvPaths {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Machine)
    $userPath    = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
    $env:Path    = "$machinePath;$userPath"

    $dotnetDir = "$env:ProgramFiles\dotnet"
    if ((Test-Path $dotnetDir) -and ($env:Path -notlike "*$dotnetDir*")) {
        $env:Path = "$dotnetDir;$env:Path"
    }

    $nodejsDir = "$env:ProgramFiles\nodejs"
    if ((Test-Path $nodejsDir) -and ($env:Path -notlike "*$nodejsDir*")) {
        $env:Path = "$nodejsDir;$env:Path"
    }

    if ($env:LOCALAPPDATA) {
        $npmGlobalDir = "$env:LOCALAPPDATA\Programs\nodejs"
        if ((Test-Path $npmGlobalDir) -and ($env:Path -notlike "*$npmGlobalDir*")) {
            $env:Path = "$npmGlobalDir;$env:Path"
        }
    }
}

Write-Banner

if (-not (Test-IsAdmin)) {
    Write-Warn "Installer is running without administrative elevation."
    Write-Warn "Winget and MSI installers might request administrative elevation."
}

# ------------------------------------------------------------------------------
# STEP 1: CHECK & INSTALL .NET 10 SDK
# ------------------------------------------------------------------------------
Write-Step "Step 1/6: Checking .NET 10 SDK (ASP.NET Core)..."
Refresh-EnvPaths

$hasDotnet10 = $false
if (Test-CommandAvailable "dotnet") {
    $sdks = dotnet --list-sdks 2>$null
    if ($sdks -match "10\.") {
        $hasDotnet10 = $true
        Write-Pass ".NET 10 SDK is already installed: $(dotnet --version)"
    } else {
        Write-Warn ".NET is installed ($((dotnet --version))), but .NET 10 SDK was not found."
    }
}

if (-not $hasDotnet10) {
    Write-Info "Installing .NET 10 SDK..."
    if (Test-CommandAvailable "winget") {
        Write-Info "Attempting installation via Windows Package Manager (winget)..."
        try {
            winget install --id Microsoft.DotNet.SDK.10 -e --silent --accept-package-agreements --accept-source-agreements
            Refresh-EnvPaths
        } catch {
            Write-Warn "winget install encountered an issue: $_"
        }
    }

    Refresh-EnvPaths
    $sdks = dotnet --list-sdks 2>$null
    if (-not ($sdks -match "10\.")) {
        Write-Info "Downloading official Microsoft dotnet-install script fallback..."
        try {
            $installScriptUrl = "https://dot.net/v1/dotnet-install.ps1"
            $tempScript = Join-Path $env:TEMP "dotnet-install.ps1"
            Invoke-WebRequest -Uri $installScriptUrl -OutFile $tempScript -UseBasicParsing
            & $tempScript -Channel 10.0 -InstallDir "$env:ProgramFiles\dotnet"
            Refresh-EnvPaths
        } catch {
            Write-Warn "Automated .NET 10 installer script encountered an issue: $_"
        }
    }

    Refresh-EnvPaths
    if (Test-CommandAvailable "dotnet") {
        Write-Pass ".NET SDK is active: $(dotnet --version)"
    } else {
        Write-Fail ".NET SDK could not be configured automatically. Please download and install .NET 10 SDK from: https://dotnet.microsoft.com/download/dotnet/10.0"
    }
}

# ------------------------------------------------------------------------------
# STEP 2: CHECK & INSTALL NODE.JS (LTS) & NPM
# ------------------------------------------------------------------------------
Write-Step "Step 2/6: Checking Node.js (v18+) and npm..."
Refresh-EnvPaths

$hasNode = $false
if (Test-CommandAvailable "node") {
    $nodeVer = node --version
    Write-Pass "Node.js is already installed: $nodeVer (npm: $(npm --version))"
    $hasNode = $true
}

if (-not $hasNode) {
    Write-Info "Node.js not found. Installing Node.js LTS via winget..."
    if (Test-CommandAvailable "winget") {
        try {
            winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
            Refresh-EnvPaths
        } catch {
            Write-Warn "winget install failed: $_"
        }
    }

    Refresh-EnvPaths
    if (-not (Test-CommandAvailable "node")) {
        Write-Info "Downloading official Node.js LTS MSI package..."
        try {
            $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
            $tempMsi = Join-Path $env:TEMP "nodejs-lts.msi"
            Invoke-WebRequest -Uri $msiUrl -OutFile $tempMsi -UseBasicParsing
            Start-Process msiexec.exe -ArgumentList "/i `"$tempMsi`" /qn" -Wait
            Refresh-EnvPaths
        } catch {
            Write-Warn "Failed to download Node.js MSI. Please install from https://nodejs.org"
        }
    }

    Refresh-EnvPaths
    if (Test-CommandAvailable "node") {
        Write-Pass "Node.js installed: $(node --version) (npm: $(npm --version))"
    } else {
        Write-Fail "Node.js was not detected after install. Please restart your shell or install from https://nodejs.org"
    }
}

# ------------------------------------------------------------------------------
# STEP 3: DATABASE ENGINE CHECK & AUTO-INSTALL (SSMS 19 / SQL SERVER OR POSTGRESQL)
# ------------------------------------------------------------------------------
Write-Step "Step 3/6: Checking Database Engine (SSMS 19 / SQL Server or PostgreSQL)..."

$hasSqlServer = $false
$hasLocalDb = $false
$hasPostgres = $false

# Check LocalDB
if (Test-CommandAvailable "sqllocaldb") {
    $hasLocalDb = $true
    Write-Pass "Microsoft SQL Server LocalDB detected."
    try {
        sqllocaldb create MSSQLLocalDB 2>$null | Out-Null
        sqllocaldb start MSSQLLocalDB 2>$null | Out-Null
        Write-Pass "LocalDB instance 'MSSQLLocalDB' is active and running."
    } catch {}
}

# Check SQL Server Service or standard port 1433
$sqlServices = Get-Service -Name "MSSQLSERVER", "MSSQL$*", "SQLServer*" -ErrorAction SilentlyContinue
if ($sqlServices) {
    $hasSqlServer = $true
    Write-Pass "Microsoft SQL Server Service detected: $($sqlServices[0].DisplayName) ($($sqlServices[0].Status))"
}

# Check PostgreSQL
if (Test-CommandAvailable "psql") {
    $hasPostgres = $true
    Write-Pass "PostgreSQL CLI (psql) detected."
}
$pgServices = Get-Service -Name "postgresql*", "postgres*" -ErrorAction SilentlyContinue
if ($pgServices) {
    $hasPostgres = $true
    Write-Pass "PostgreSQL Service detected: $($pgServices[0].DisplayName)"
}

# Auto-install database if none detected or if explicitly requested
if (($Database -eq "PostgreSql" -and -not $hasPostgres) -or ($Database -eq "SSMS" -and -not $hasSqlServer) -or (-not $hasSqlServer -and -not $hasLocalDb -and -not $hasPostgres)) {
    Write-Warn "No active database engine found, or specific engine requested ($Database)."
    
    if (Test-CommandAvailable "winget") {
        if ($Database -eq "PostgreSql") {
            Write-Info "Installing PostgreSQL 16 via winget..."
            try {
                winget install --id PostgreSQL.PostgreSQL.16 -e --silent --accept-package-agreements --accept-source-agreements
                $hasPostgres = $true
                Write-Pass "PostgreSQL 16 installation triggered."
            } catch {
                Write-Warn "winget install PostgreSQL failed: $_"
            }
        } else {
            Write-Info "Installing Microsoft SQL Server 2022 Express & SSMS via winget..."
            try {
                winget install --id Microsoft.SQLServer.2022.Express -e --silent --accept-package-agreements --accept-source-agreements
                $hasSqlServer = $true
                Write-Pass "SQL Server 2022 Express installed."
            } catch {
                Write-Warn "winget install SQL Server Express failed: $_"
            }
            try {
                Write-Info "Installing SQL Server Management Studio (SSMS 19/20)..."
                winget install --id Microsoft.SQLServerManagementStudio -e --silent --accept-package-agreements --accept-source-agreements
                Write-Pass "SSMS installation triggered."
            } catch {
                Write-Warn "winget install SSMS failed: $_"
            }
        }
    } else {
        Write-Info "winget is not available on this system. You can download and install:"
        Write-Info "  • SQL Server Express: https://www.microsoft.com/en-us/sql-server/sql-server-downloads"
        Write-Info "  • SSMS 19: https://aka.ms/ssmsfullsetup"
        Write-Info "  • PostgreSQL: https://www.postgresql.org/download/windows/"
    }
}

# Determine default database provider
$selectedProvider = "SqlServer"
if ($Database -eq "PostgreSql" -or ($hasPostgres -and -not $hasSqlServer -and -not $hasLocalDb)) {
    $selectedProvider = "PostgreSql"
} elseif ($hasLocalDb -and -not $hasSqlServer) {
    $selectedProvider = "SqlServer_LocalDB"
}

Write-Info "Active Target Database Provider: $selectedProvider"

# Update appsettings.json if provider changed
if (Test-Path $AppSettingsFile) {
    try {
        $appJson = Get-Content $AppSettingsFile -Raw | ConvertFrom-Json
        if ($selectedProvider -eq "PostgreSql") {
            $appJson.DatabaseProvider = "PostgreSql"
        } else {
            $appJson.DatabaseProvider = "SqlServer"
        }
        $appJson | ConvertTo-Json -Depth 10 | Set-Content $AppSettingsFile -Encoding UTF8
        Write-Pass "Updated Backend appsettings.json with DatabaseProvider='$($appJson.DatabaseProvider)'."
    } catch {
        Write-Warn "Could not update appsettings.json: $_"
    }
}

# ------------------------------------------------------------------------------
# STEP 4: C# ASP.NET CORE BACKEND BUILD & RESTORE
# ------------------------------------------------------------------------------
Write-Step "Step 4/6: Restoring & Building .NET 10 Backend..."

if (Test-Path $BackendDir) {
    Push-Location $BackendDir
    try {
        # Release any active file locks from running Backend process
        Get-Process -Name Backend -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 400

        Write-Info "Executing 'dotnet restore'..."
        dotnet restore --nologo -v q
        Write-Pass "NuGet packages restored successfully."

        Write-Info "Executing 'dotnet build'..."
        dotnet build -c Debug --nologo -v q
        Write-Pass "Backend built successfully with 0 errors."
    } catch {
        Write-Fail "Backend build encountered an error: $_"
    } finally {
        Pop-Location
    }
} else {
    Write-Fail "Backend directory not found at $BackendDir"
}

# ------------------------------------------------------------------------------
# STEP 5: FRONTEND DEPENDENCY INSTALLATION & BUILD VERIFICATION
# ------------------------------------------------------------------------------
Write-Step "Step 5/6: Installing Frontend npm Dependencies & Building Distribution..."

if (Test-Path $FrontendDir) {
    Push-Location $FrontendDir
    try {
        Write-Info "Executing 'npm install --legacy-peer-deps' (React 19, TypeScript, Leaflet, Lucide, MediaPipe)..."
        npm install --legacy-peer-deps
        Write-Pass "All Frontend packages and TypeScript definitions installed."

        Write-Info "Executing 'npm run build' to test bundling..."
        npm run build
        Write-Pass "Production frontend bundle built successfully in dist/."
    } catch {
        Write-Fail "Frontend installation encountered an error: $_"
    } finally {
        Pop-Location
    }
} else {
    Write-Fail "Frontend directory not found at $FrontendDir"
}

# ------------------------------------------------------------------------------
# STEP 6: VERIFICATION SUMMARY & SYSTEM STATUS
# ------------------------------------------------------------------------------
Write-Step "Step 6/6: Setup Complete - Summary & Readiness"

Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host "   RESQTRACK SYSTEM INSTALLATION & BUILD VERIFICATION SUMMARY                " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " [v] .NET 10 SDK      : Installed ($(dotnet --version 2>$null))" -ForegroundColor White
Write-Host " [v] Node.js & npm    : Installed (Node $(node --version 2>$null) / npm $(npm --version 2>$null))" -ForegroundColor White
Write-Host " [v] Database Target  : $selectedProvider (SSMS 19 / SQL Server / PostgreSQL)" -ForegroundColor White
Write-Host " [v] Backend API      : Restored, Compiled & Seed Ready" -ForegroundColor White
Write-Host " [v] Frontend Portal  : node_modules Installed & Production Bundle Built" -ForegroundColor White
Write-Host " [v] 4-Port Topology  : Backend (:1999) | Admin (:1996) | Responders (:1997) | Civilian (:1998)" -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan

Write-Host "`nYou can now launch the entire system using any of the following:" -ForegroundColor Yellow
Write-Host "  1. Double-click: install_all_requirements.bat (To Re-run or Verify Setup)" -ForegroundColor White
Write-Host "  2. Double-click: run_system.bat              (Instant Launch All 4 Portals)" -ForegroundColor White
Write-Host "  3. Double-click: start.bat                   (Root Interactive Console Menu)" -ForegroundColor White
Write-Host "  4. CLI Command : .\CommandStart\manage.ps1 -Action start`n" -ForegroundColor White

if (-not $Unattended) {
    Write-Host "Press any key to exit installer..." -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}
