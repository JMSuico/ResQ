<#
.SYNOPSIS
    ResQTrack Incident AI System Unified Management Engine.
.DESCRIPTION
    Consolidated single controller for starting/stopping 4-port topology, managing database
    migrations across PostgreSQL, SQL Server (SSMS), and MySQL/MariaDB (strictly excluding SQLite),
    and terminal-based superadmin bypass account creation/editing/deletion (email & password only).
#>

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$Action = ""
)

$ErrorActionPreference = "Continue"

# Resolve Directory Paths dynamically (supports running from CommandStart or Root)
if (Test-Path "$PSScriptRoot\Project system ENGINE") {
    $RootDir = $PSScriptRoot
} elseif (Test-Path "$PSScriptRoot\..\Project system ENGINE") {
    $RootDir = (Resolve-Path "$PSScriptRoot\..").Path
} else {
    $RootDir = (Get-Location).Path
}

$BackendDir  = Join-Path $RootDir "Project system ENGINE\Backend"
$FrontendDir = Join-Path $RootDir "Project system ENGINE\Frontend"
$BackendProj = Join-Path $BackendDir "Backend.csproj"

$Ports = @(1999, 1996, 1997, 1998)

# --- Console Color Utility Functions ---
function Write-Header {
    param([string]$Title)
    Clear-Host
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "   RESQTRACK INCIDENT AI DETECTION SYSTEM - UNIFIED MANAGEMENT CONSOLE        " -ForegroundColor Yellow -NoNewline
    Write-Host " [v2.5]" -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Cyan
    if ($Title) {
        Write-Host " >> $Title" -ForegroundColor White
        Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray
    }
}

function Write-Success { param([string]$Msg) Write-Host "[OK] $Msg" -ForegroundColor Green }
function Write-Info    { param([string]$Msg) Write-Host "[i]  $Msg" -ForegroundColor Cyan }
function Write-Warn    { param([string]$Msg) Write-Host "[!]  $Msg" -ForegroundColor Yellow }
function Write-Err     { param([string]$Msg) Write-Host "[X]  $Msg" -ForegroundColor Red }

function Pause-Console {
    Write-Host "`nPress any key to return to menu..." -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

# --- Fresh Clone Dependency & Environment Detection ---
function Ensure-Prerequisites {
    Write-Info "Checking development runtime prerequisites..."

    # Check dotnet
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
        Write-Err ".NET SDK (v10.0+) is not installed or not in PATH."
        return $false
    }

    # Check node
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err "Node.js (v18+) is not installed or not in PATH."
        return $false
    }

    # Fresh clone detection: Check Frontend node_modules
    $NodeModulesDir = Join-Path $FrontendDir "node_modules"
    if (-not (Test-Path $NodeModulesDir)) {
        Write-Warn "Fresh clone detected! 'node_modules' is missing in Frontend."
        Write-Info "Running automatic 'npm install' in Frontend directory..."
        Push-Location $FrontendDir
        try {
            npm install
            Write-Success "Frontend dependencies successfully installed."
        } catch {
            Write-Err "Failed to run npm install: $_"
        } finally {
            Pop-Location
        }
    }

    # Check Backend build
    $BackendBin = Join-Path $BackendDir "bin\Debug\net10.0\Backend.dll"
    if (-not (Test-Path $BackendBin)) {
        Write-Info "Building .NET Backend project for initial execution..."
        Push-Location $BackendDir
        try {
            dotnet build -c Debug --nologo -v q
            Write-Success "Backend built successfully."
        } catch {
            Write-Err "Backend build failed: $_"
        } finally {
            Pop-Location
        }
    }

    return $true
}

# --- Port and Process Management ---
function Stop-PortProcesses {
    param([int[]]$TargetPorts = $Ports)
    Write-Info "Stopping active listeners and terminating locks on ports: $($TargetPorts -join ', ')..."

    foreach ($port in $TargetPorts) {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conns) {
            $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($processId in $pids) {
                if ($processId -gt 4) {
                    try {
                        $p = Get-Process -Id $processId -ErrorAction SilentlyContinue
                        if ($p) {
                            Write-Info "Killing process '$($p.ProcessName)' (PID: $processId) on port $port..."
                            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                        }
                    } catch {}
                }
            }
        }
    }

    # Also clean up any lingering orphan Backend.exe and Vite dev server processes
    Get-Process -Name Backend -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*vite*" -or $_.CommandLine -like "*dev:*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue

    Start-Sleep -Milliseconds 600
    Write-Success "All target port listeners and lingering engine processes stopped."
}

function Wait-ForPort {
    param([int]$Port, [int]$TimeoutSeconds = 25)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conn) { return $true }
        Start-Sleep -Milliseconds 400
    }
    return $false
}

function Start-AllEngines {
    Write-Header "START ALL ENGINES & 4-PORT ECOSYSTEM"

    if (-not (Ensure-Prerequisites)) {
        Pause-Console
        return
    }

    # Stop any existing processes first to avoid port collisions
    Stop-PortProcesses

    Write-Info "Applying database migrations and seeding initial fixtures..."
    Push-Location $BackendDir
    try {
        # Auto-run EF Core database migration on boot for fresh clones
        dotnet ef database update --no-build --nologo 2>$null
    } catch {
        Write-Warn "EF database update deferred (runtime EnsureCreatedAsync handles database setup on start)."
    } finally {
        Pop-Location
    }

    Write-Info "Starting Backend Web API on Port 1999..."
    $backendProc = Start-Process -FilePath "dotnet" -ArgumentList "run --launch-profile http" `
        -WorkingDirectory $BackendDir -PassThru -WindowStyle Minimized

    Write-Info "Waiting for Backend :1999 to become ready..."
    if (Wait-ForPort -Port 1999 -TimeoutSeconds 30) {
        Write-Success "Backend Web API is LIVE on http://localhost:1999"
    } else {
        Write-Warn "Backend startup timed out; continuing with frontends..."
    }

    Write-Info "Starting Admin (LDRRMO) Portal on Port 1996..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:admin" `
        -WorkingDirectory $FrontendDir -WindowStyle Minimized

    Write-Info "Starting Responders Portal on Port 1997..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:responder" `
        -WorkingDirectory $FrontendDir -WindowStyle Minimized

    Write-Info "Starting Civilian Portal on Port 1998..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:civilian" `
        -WorkingDirectory $FrontendDir -WindowStyle Minimized

    Write-Info "Verifying active portal endpoints..."
    Start-Sleep -Seconds 2

    Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host "                ACTIVE ECOSYSTEM RUNTIME PORTALS                              " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host " [API & DB]   Backend Core & Docs :  http://localhost:1999/scalar/v1" -ForegroundColor Yellow
    Write-Host " [PORT 1996]  Central Admin LDRRMO:  http://localhost:1996" -ForegroundColor Yellow
    Write-Host " [PORT 1997]  Tactical Responders :  http://localhost:1997" -ForegroundColor Yellow
    Write-Host " [PORT 1998]  Civilian Emergency  :  http://localhost:1998" -ForegroundColor Yellow
    Write-Host "================================================================================`n" -ForegroundColor Cyan

    Write-Success "All 4 engines launched successfully."
}

# --- Database Migration Management ---
function Manage-DatabaseMigrations {
    Write-Header "DATABASE MIGRATIONS & PROVIDER CONFIGURATION"
    Write-Host "Supported RDBMS Providers: Microsoft SQL Server, PostgreSQL, MariaDB/MySQL." -ForegroundColor Cyan
    Write-Host "Strict Architecture Rule : SQLite is strictly excluded from this system.`n" -ForegroundColor Yellow

    Write-Host "  [1] Apply / Update Database (dotnet ef database update)"
    Write-Host "  [2] Add New Migration (dotnet ef migrations add <Name>)"
    Write-Host "  [3] Remove Last Migration (dotnet ef migrations remove)"
    Write-Host "  [4] Check / Inspect Current Database Connection"
    Write-Host "  [0] Return to Main Menu`n"

    $subChoice = Read-Host "Select Migration Action (0-4)"
    switch ($subChoice) {
        "1" {
            Write-Info "Applying pending migrations to configured relational database..."
            Push-Location $BackendDir
            try {
                dotnet ef database update
                Write-Success "Database migration update completed."
            } catch {
                Write-Err "Migration failed: $_"
            } finally {
                Pop-Location
            }
        }
        "2" {
            $migName = Read-Host "Enter New Migration Name (e.g. AddAuditIndexing)"
            if (-not [string]::IsNullOrWhiteSpace($migName)) {
                Push-Location $BackendDir
                try {
                    dotnet ef migrations add $migName
                    Write-Success "Migration '$migName' created successfully."
                } catch {
                    Write-Err "Failed to add migration: $_"
                } finally {
                    Pop-Location
                }
            } else {
                Write-Warn "Migration name cannot be empty."
            }
        }
        "3" {
            $confirm = Read-Host "Are you sure you want to revert the last unapplied migration? (Y/N)"
            if ($confirm -eq "Y" -or $confirm -eq "y") {
                Push-Location $BackendDir
                try {
                    dotnet ef migrations remove
                    Write-Success "Last migration removed."
                } catch {
                    Write-Err "Failed to remove migration: $_"
                } finally {
                    Pop-Location
                }
            }
        }
        "4" {
            Push-Location $BackendDir
            try {
                dotnet run --no-build -- listcliusers | Out-Null
                Write-Success "Database connection validated successfully."
            } catch {
                Write-Err "Database connection check encountered an error: $_"
            } finally {
                Pop-Location
            }
        }
        default { return }
    }
}

# --- Backend CLI User Management Operations ---
function Run-BackendCli {
    param([string[]]$CliArgs)
    Push-Location $BackendDir
    try {
        $output = & dotnet run --project $BackendProj --no-build -- $CliArgs
        return $output
    } finally {
        Pop-Location
    }
}

function Get-AllUsersFromCli {
    $rawOutput = Run-BackendCli -CliArgs @("listcliusers")
    $text = $rawOutput -join "`n"
    if ($text -match '(?s)\[CLI_USERS_JSON_BEGIN\]\r?\n?(.*?)\r?\n?\[CLI_USERS_JSON_END\]') {
        $jsonStr = $matches[1]
        try {
            return ($jsonStr | ConvertFrom-Json)
        } catch {
            Write-Err "Failed to parse users JSON."
            return @()
        }
    }
    return @()
}

function Select-UserInteractive {
    param(
        [string]$RoleFilter,
        [string]$UnitFilter = "",
        [string]$HeaderTitle = "SELECT USER"
    )

    $allUsers = Get-AllUsersFromCli
    if (-not $allUsers -or $allUsers.Count -eq 0) {
        Write-Warn "No users found in database."
        return $null
    }

    # Apply role filter
    $filtered = $allUsers
    if ($RoleFilter) {
        $filtered = $filtered | Where-Object { $_.role -like "*$RoleFilter*" }
    }
    if ($UnitFilter -and $UnitFilter -ne "ALL") {
        $filtered = $filtered | Where-Object { $_.unit -eq $UnitFilter }
    }

    if (-not $filtered -or $filtered.Count -eq 0) {
        Write-Warn "No accounts matched the criteria (Role: $RoleFilter, Unit: $UnitFilter)."
        return $null
    }

    Write-Host "`nSearch filter (leave empty to show all $($filtered.Count) accounts):" -ForegroundColor Cyan
    $search = Read-Host "Search query"
    if (-not [string]::IsNullOrWhiteSpace($search)) {
        $filtered = $filtered | Where-Object {
            $_.email -like "*$search*" -or $_.fullName -like "*$search*" -or $_.employeeOrResidentId -like "*$search*"
        }
    }

    if (-not $filtered -or $filtered.Count -eq 0) {
        Write-Warn "No users matched query '$search'."
        return $null
    }

    Write-Host "`n--------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ("{0,-4} | {1,-30} | {2,-12} | {3,-8} | {4,-15}" -f "#", "Email", "Role", "Unit", "ID") -ForegroundColor White
    Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray

    $list = @($filtered)
    for ($i = 0; $i -lt $list.Count; $i++) {
        $u = $list[$i]
        Write-Host ("{0,-4} | {1,-30} | {2,-12} | {3,-8} | {4,-15}" -f ($i + 1), $u.email, $u.role, $u.unit, $u.employeeOrResidentId) -ForegroundColor Gray
    }
    Write-Host "--------------------------------------------------------------------------------`n" -ForegroundColor DarkGray

    $pick = Read-Host "Enter # to select (or 0 to cancel)"
    if ($pick -match '^\d+$' -and [int]$pick -ge 1 -and [int]$pick -le $list.Count) {
        return $list[[int]$pick - 1]
    }
    return $null
}

# --- User Management Handlers ---
function Create-SuperadminAccount {
    Write-Header "CREATE SUPERADMIN ACCOUNT (BYPASS TERMINAL CREATION)"
    Write-Host "Reminder: Enter email and password only. Default verified profile attributes are assigned.`n" -ForegroundColor Yellow

    Write-Host "  [1] Create Default Superadmin (admin@resqtrack.gov.ph / Admin123456!)"
    Write-Host "  [2] Create Custom Superadmin (Specify Email & Password)"
    Write-Host "  [0] Cancel`n"

    $choice = Read-Host "Select Option (0-2)"
    if ($choice -eq "1") {
        Write-Info "Creating default superadmin account..."
        $res = Run-BackendCli -CliArgs @("createsuperadmin", "admin@resqtrack.gov.ph", "Admin123456!")
        Write-Host ($res -join "`n") -ForegroundColor Green
    } elseif ($choice -eq "2") {
        $email = Read-Host "Enter Superadmin Email"
        if ([string]::IsNullOrWhiteSpace($email)) { Write-Warn "Email cannot be empty."; return }
        $pass = Read-Host "Enter Superadmin Password (min 12 chars)"
        if ([string]::IsNullOrWhiteSpace($pass) -or $pass.Length -lt 12) { Write-Warn "Password too short (must be at least 12 characters)."; return }

        Write-Info "Creating superadmin '$email'..."
        $res = Run-BackendCli -CliArgs @("createsuperadmin", $email, $pass)
        Write-Host ($res -join "`n") -ForegroundColor Green
    }
}

function Edit-SuperadminAccount {
    Write-Header "EDIT SUPERADMIN ACCOUNT"
    Write-Host "Search and select a superadmin to update (Email & Password only).`n" -ForegroundColor Yellow

    $user = Select-UserInteractive -RoleFilter "LDRRMO" -HeaderTitle "Select Superadmin to Edit"
    if (-not $user) { return }

    Write-Info "Selected Superadmin: $($user.email)"
    $newEmail = Read-Host "New Email [leave blank or press Enter to keep current]"
    $newPass  = Read-Host "New Password (min 12 chars) [leave blank or press Enter to keep current]"

    if (-not [string]::IsNullOrWhiteSpace($newPass) -and $newPass.Length -lt 12) {
        Write-Warn "Password too short (must be at least 12 characters)."
        return
    }

    if ([string]::IsNullOrWhiteSpace($newEmail) -and [string]::IsNullOrWhiteSpace($newPass)) {
        Write-Warn "No changes provided."
        return
    }

    $passArg = if ([string]::IsNullOrWhiteSpace($newPass)) { "-" } else { $newPass }
    $emailArg = if ([string]::IsNullOrWhiteSpace($newEmail)) { "-" } else { $newEmail }

    $res = Run-BackendCli -CliArgs @("edituser", $user.email, $passArg, $emailArg)
    Write-Host ($res -join "`n") -ForegroundColor Green
}

function Delete-SuperadminAccount {
    Write-Header "DELETE SUPERADMIN ACCOUNT"
    $user = Select-UserInteractive -RoleFilter "LDRRMO" -HeaderTitle "Select Superadmin to Delete"
    if (-not $user) { return }

    $confirm = Read-Host "Are you sure you want to permanently delete Superadmin '$($user.email)'? (Y/N)"
    if ($confirm -eq "Y" -or $confirm -eq "y") {
        $res = Run-BackendCli -CliArgs @("deletecliuser", $user.email)
        Write-Host ($res -join "`n") -ForegroundColor Green
    } else {
        Write-Info "Deletion cancelled."
    }
}

function Create-ResponderAccount {
    Write-Header "CREATE RESPONDER ACCOUNT"
    Write-Host "Select Agency Branch, then enter Email and Password only.`n" -ForegroundColor Yellow

    Write-Host "  [1] RHU  (Rural Health Unit / Medical)"
    Write-Host "  [2] FIRE (Bureau of Fire Protection)"
    Write-Host "  [3] PNP  (Philippine National Police)"
    Write-Host "  [0] Cancel`n"

    $unitChoice = Read-Host "Choose Branch (1-3)"
    $unit = switch ($unitChoice) {
        "1" { "RHU" }
        "2" { "FIRE" }
        "3" { "PNP" }
        default { return }
    }

    $email = Read-Host "Enter $unit Responder Email"
    if ([string]::IsNullOrWhiteSpace($email)) { Write-Warn "Email cannot be empty."; return }
    $pass = Read-Host "Enter Password (min 12 chars)"
    if ([string]::IsNullOrWhiteSpace($pass) -or $pass.Length -lt 12) { Write-Warn "Password too short (must be at least 12 characters)."; return }

    Write-Info "Creating $unit responder '$email'..."
    $res = Run-BackendCli -CliArgs @("createresponder", $email, $pass, $unit)
    Write-Host ($res -join "`n") -ForegroundColor Green
}

function Edit-ResponderAccount {
    Write-Header "EDIT RESPONDER ACCOUNT"
    Write-Host "Select Agency Branch to filter, then search and select.`n" -ForegroundColor Yellow

    Write-Host "  [1] RHU Responders"
    Write-Host "  [2] FIRE Responders"
    Write-Host "  [3] PNP Responders"
    Write-Host "  [4] All Responders"
    Write-Host "  [0] Cancel`n"

    $filterChoice = Read-Host "Choose Option (1-4)"
    $unitFilter = switch ($filterChoice) {
        "1" { "RHU" }
        "2" { "FIRE" }
        "3" { "PNP" }
        "4" { "ALL" }
        default { return }
    }

    $user = Select-UserInteractive -RoleFilter "Responder" -UnitFilter $unitFilter -HeaderTitle "Select Responder to Edit"
    if (-not $user) { return }

    Write-Info "Selected Responder: $($user.email) [Unit: $($user.unit)]"
    $newEmail = Read-Host "New Email [leave blank or press Enter to keep current]"
    $newPass  = Read-Host "New Password (min 12 chars) [leave blank or press Enter to keep current]"

    if (-not [string]::IsNullOrWhiteSpace($newPass) -and $newPass.Length -lt 12) {
        Write-Warn "Password too short (must be at least 12 characters)."
        return
    }

    if ([string]::IsNullOrWhiteSpace($newEmail) -and [string]::IsNullOrWhiteSpace($newPass)) {
        Write-Warn "No changes provided."
        return
    }

    $passArg = if ([string]::IsNullOrWhiteSpace($newPass)) { "-" } else { $newPass }
    $emailArg = if ([string]::IsNullOrWhiteSpace($newEmail)) { "-" } else { $newEmail }

    $res = Run-BackendCli -CliArgs @("edituser", $user.email, $passArg, $emailArg)
    Write-Host ($res -join "`n") -ForegroundColor Green
}

function Delete-ResponderAccount {
    Write-Header "DELETE RESPONDER ACCOUNT"
    Write-Host "  [1] RHU Responders"
    Write-Host "  [2] FIRE Responders"
    Write-Host "  [3] PNP Responders"
    Write-Host "  [4] All Responders"
    Write-Host "  [0] Cancel`n"

    $filterChoice = Read-Host "Choose Branch to Filter (1-4)"
    $unitFilter = switch ($filterChoice) {
        "1" { "RHU" }
        "2" { "FIRE" }
        "3" { "PNP" }
        "4" { "ALL" }
        default { return }
    }

    $user = Select-UserInteractive -RoleFilter "Responder" -UnitFilter $unitFilter -HeaderTitle "Select Responder to Delete"
    if (-not $user) { return }

    $confirm = Read-Host "Are you sure you want to delete Responder '$($user.email)' ($($user.unit))? (Y/N)"
    if ($confirm -eq "Y" -or $confirm -eq "y") {
        $res = Run-BackendCli -CliArgs @("deletecliuser", $user.email)
        Write-Host ($res -join "`n") -ForegroundColor Green
    } else {
        Write-Info "Deletion cancelled."
    }
}

function Create-CivilianAccount {
    Write-Header "CREATE CIVILIAN ACCOUNT"
    Write-Host "Enter Email and Password only. Resident account is created with Verified status.`n" -ForegroundColor Yellow

    $email = Read-Host "Enter Civilian Email"
    if ([string]::IsNullOrWhiteSpace($email)) { Write-Warn "Email cannot be empty."; return }
    $pass = Read-Host "Enter Password (min 12 chars)"
    if ([string]::IsNullOrWhiteSpace($pass) -or $pass.Length -lt 12) { Write-Warn "Password too short (must be at least 12 characters)."; return }

    Write-Info "Creating civilian account '$email'..."
    $res = Run-BackendCli -CliArgs @("createcivilian", $email, $pass)
    Write-Host ($res -join "`n") -ForegroundColor Green
}

function Edit-CivilianAccount {
    Write-Header "EDIT CIVILIAN ACCOUNT"
    $user = Select-UserInteractive -RoleFilter "Civilian" -HeaderTitle "Select Civilian to Edit"
    if (-not $user) { return }

    Write-Info "Selected Civilian: $($user.email)"
    $newEmail = Read-Host "New Email [leave blank or press Enter to keep current]"
    $newPass  = Read-Host "New Password (min 12 chars) [leave blank or press Enter to keep current]"

    if (-not [string]::IsNullOrWhiteSpace($newPass) -and $newPass.Length -lt 12) {
        Write-Warn "Password too short (must be at least 12 characters)."
        return
    }

    if ([string]::IsNullOrWhiteSpace($newEmail) -and [string]::IsNullOrWhiteSpace($newPass)) {
        Write-Warn "No changes provided."
        return
    }

    $passArg = if ([string]::IsNullOrWhiteSpace($newPass)) { "-" } else { $newPass }
    $emailArg = if ([string]::IsNullOrWhiteSpace($newEmail)) { "-" } else { $newEmail }

    $res = Run-BackendCli -CliArgs @("edituser", $user.email, $passArg, $emailArg)
    Write-Host ($res -join "`n") -ForegroundColor Green
}

function Delete-CivilianAccount {
    Write-Header "DELETE CIVILIAN ACCOUNT"
    $user = Select-UserInteractive -RoleFilter "Civilian" -HeaderTitle "Select Civilian to Delete"
    if (-not $user) { return }

    $confirm = Read-Host "Are you sure you want to delete Civilian '$($user.email)'? (Y/N)"
    if ($confirm -eq "Y" -or $confirm -eq "y") {
        $res = Run-BackendCli -CliArgs @("deletecliuser", $user.email)
        Write-Host ($res -join "`n") -ForegroundColor Green
    } else {
        Write-Info "Deletion cancelled."
    }
}

function Invoke-HardHotRefresh {
    Write-Header "HARD HOT REFRESH (PURGE CACHES & RESTART ENGINES)"
    Write-Info "Stopping active processes..."
    Stop-PortProcesses

    Write-Info "Purging Vite and build cache directories..."
    $viteCache = Join-Path $FrontendDir "node_modules\.vite"
    $distDir   = Join-Path $FrontendDir "dist"
    if (Test-Path $viteCache) { Remove-Item -Recurse -Force $viteCache -ErrorAction SilentlyContinue }
    if (Test-Path $distDir)   { Remove-Item -Recurse -Force $distDir -ErrorAction SilentlyContinue }

    Write-Success "Caches cleared. Restarting 4-port ecosystem..."
    Start-AllEngines
}

function Invoke-CleanRebuild {
    Write-Header "CLEAN BUILD / REBUILD (.NET & FRONTEND)"
    Stop-PortProcesses

    Write-Info "Cleaning .NET Backend artifacts..."
    Push-Location $BackendDir
    try {
        dotnet clean --nologo -v q
        dotnet build -c Debug --nologo
        Write-Success "Backend rebuilt cleanly."
    } catch {
        Write-Err "Backend rebuild failed: $_"
    } finally {
        Pop-Location
    }

    Write-Info "Validating Frontend TypeScript compilation..."
    Push-Location $FrontendDir
    try {
        npm run build --no-emit
        Write-Success "Frontend build verification passed."
    } catch {
        Write-Warn "Frontend build check reported warnings or non-fatal notes."
    } finally {
        Pop-Location
    }
}

function Invoke-DockerRebuild {
    Write-Header "DOCKER BUILD / REBUILD"
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Err "Docker is not installed or docker daemon is not running."
        Pause-Console
        return
    }

    Push-Location $RootDir
    try {
        Write-Info "Stopping existing Docker Compose containers..."
        docker compose down
        Write-Info "Rebuilding containers without cache..."
        docker compose build --no-cache
        Write-Info "Starting containers in detached mode..."
        docker compose up -d
        Write-Success "Docker containers deployed."
        docker compose ps
    } catch {
        Write-Err "Docker operation failed: $_"
    } finally {
        Pop-Location
    }
}

# --- Interactive Main Menu ---
function Show-MainMenu {
    while ($true) {
        Write-Header ""
        Write-Host " CORE ENGINE OPERATIONS" -ForegroundColor Green
        Write-Host "  [1]  Start all Engines & Portals (:1999, :1996, :1997, :1998)"
        Write-Host "  [2]  Stop all Engines & Release Ports"
        Write-Host "  [3]  Database Migrations (Add Migration / Update Database / Auto-detect)"
        Write-Host ""
        Write-Host " SUPERADMIN MANAGEMENT (Email & Password Only)" -ForegroundColor Yellow
        Write-Host "  [4]  Create Superadmin (Default or Custom)"
        Write-Host "  [5]  Edit Superadmin (Search list, Email & Password only)"
        Write-Host "  [6]  Delete Superadmin (Search list)"
        Write-Host ""
        Write-Host " RESPONDER MANAGEMENT (Choose RHU / FIRE / PNP - Email & Password Only)" -ForegroundColor Cyan
        Write-Host "  [7]  Create Responder (Choose RHU / FIRE / PNP)"
        Write-Host "  [8]  Edit Responder (Choose Unit, Search list, Email & Password only)"
        Write-Host "  [9]  Delete Responder (Choose Unit, Search list)"
        Write-Host ""
        Write-Host " CIVILIAN MANAGEMENT (Email & Password Only)" -ForegroundColor Magenta
        Write-Host "  [10] Create Civilian (Email & Password only)"
        Write-Host "  [11] Edit Civilian (Search list, Email & Password only)"
        Write-Host "  [12] Delete Civilian (Search list)"
        Write-Host ""
        Write-Host " SYSTEM MAINTENANCE & CONTAINERS" -ForegroundColor DarkCyan
        Write-Host "  [13] HARD HOT REFRESH (Purge Vite caches & restart)"
        Write-Host "  [14] CLEAN BUILD / REBUILD (.NET clean & build, frontend check)"
        Write-Host "  [15] DOCKER BUILD / REBUILD (Compose down, rebuild, boot)"
        Write-Host "  [16] AUTO-INSTALL ALL REQUIREMENTS (.NET 10, Node.js, SSMS/PG, npm modules)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [0]  Exit Console"
        Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkGray

        $choice = Read-Host "Select an Option [0-16]"

        switch ($choice) {
            "1"  { Start-AllEngines; Pause-Console }
            "2"  { Stop-PortProcesses; Pause-Console }
            "3"  { Manage-DatabaseMigrations; Pause-Console }
            "4"  { Create-SuperadminAccount; Pause-Console }
            "5"  { Edit-SuperadminAccount; Pause-Console }
            "6"  { Delete-SuperadminAccount; Pause-Console }
            "7"  { Create-ResponderAccount; Pause-Console }
            "8"  { Edit-ResponderAccount; Pause-Console }
            "9"  { Delete-ResponderAccount; Pause-Console }
            "10" { Create-CivilianAccount; Pause-Console }
            "11" { Edit-CivilianAccount; Pause-Console }
            "12" { Delete-CivilianAccount; Pause-Console }
            "13" { Invoke-HardHotRefresh; Pause-Console }
            "14" { Invoke-CleanRebuild; Pause-Console }
            "15" { Invoke-DockerRebuild; Pause-Console }
            "16" { 
                $installScript = Join-Path $PSScriptRoot "install_requirements.ps1"
                if (Test-Path $installScript) {
                    & $installScript
                } else {
                    Write-Err "Installer script not found at $installScript"
                }
                Pause-Console 
            }
            "0"  { Write-Host "Exiting ResQTrack Management Console. Goodbye!" -ForegroundColor Cyan; break }
            default { Write-Warn "Invalid choice. Please enter a number between 0 and 16."; Start-Sleep -Milliseconds 800 }
        }
    }
}

# --- CLI Dispatcher Entrypoint ---
if ($Action) {
    switch ($Action.ToLowerInvariant()) {
        "start"        { Start-AllEngines }
        "stop"         { Stop-PortProcesses }
        "migrate"      { Manage-DatabaseMigrations }
        "superadmin"   { Create-SuperadminAccount }
        "refresh"      { Invoke-HardHotRefresh }
        "rebuild"      { Invoke-CleanRebuild }
        "docker"       { Invoke-DockerRebuild }
        "install"      { 
            $installScript = Join-Path $PSScriptRoot "install_requirements.ps1"
            & $installScript
        }
        default        { Show-MainMenu }
    }
} else {
    Show-MainMenu
}
