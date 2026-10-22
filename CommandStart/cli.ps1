<#
.SYNOPSIS
    ResQTrack Incident AI System Detection - Root Administrative CLI Governance Console
.DESCRIPTION
    Manages root protected LDRRMO superusers, emergency responders (RHU/Fire/PNP/Security), and civilian accounts.
    Persisted directly to Microsoft SQL Server (SSMS 19 compatible enterprise relational database store).
    Renders high-fidelity ASCII tables directly from database output.
.EXAMPLE
    .\cli.ps1 listusers
    .\cli.ps1 createsuperadmin admin@resqtrack.gov.ph SecurePassword123! "Director Alejandro Ramos" LDRRMO
    .\cli.ps1 createcustomsuperadmin rhu.lead@resqtrack.gov.ph SecurePassword123! "Dr. Maria Clara Santos" RHU
    .\cli.ps1 createresponder fire.officer@resqtrack.gov.ph SecurePassword123! "Capt. Gabriel Mendoza" FIRE BFP-ENG1-105
    .\cli.ps1 createcivilian juan@gmail.com SecurePassword123! "Juan Dela Cruz" UG-RES-2026-99
    .\cli.ps1 resetpassword admin@resqtrack.gov.ph NewSecurePass123!
    .\cli.ps1 deleteuser customadmin@resqtrack.gov.ph
    .\cli.ps1 deleteallcliusers
#>

param(
    [Parameter(Position=0)]
    [string]$Command = "",

    [Parameter(Position=1)]
    [string]$Arg1 = "",

    [Parameter(Position=2)]
    [string]$Arg2 = "",

    [Parameter(Position=3)]
    [string]$Arg3 = "",

    [Parameter(Position=4)]
    [string]$Arg4 = "",

    [Parameter(Position=5)]
    [string]$Arg5 = "",

    [Parameter(Position=6)]
    [string]$Arg6 = ""
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

$BackendDir = Join-Path $RootDir "Project system ENGINE\Backend"

if (-not (Test-Path $BackendDir)) {
    Write-Host "[!] Error: Backend directory not found at '$BackendDir'." -ForegroundColor Red
    exit 1
}

function Show-Header {
    Write-Host ""
    Write-Host "==========================================================================================" -ForegroundColor Cyan
    Write-Host "         RESQTRACK INCIDENT AI SYSTEM -- ADMINISTRATIVE ROOT CLI TOOL                     " -ForegroundColor Yellow
    Write-Host "         Emergency Response Governance Authority & Protected User Management              " -ForegroundColor DarkCyan
    Write-Host "         Relational Database Store: Microsoft SQL Server (SSMS 19 / Windows & SQL Auth)   " -ForegroundColor Gray
    Write-Host "==========================================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Show-TableFromUsersJson($rawOutput) {
    $inJson = $false
    $jsonLines = @()
    foreach ($line in ($rawOutput -split "`r?`n")) {
        if ($line.Trim() -eq "[CLI_USERS_JSON_BEGIN]") {
            $inJson = $true
            continue
        }
        if ($line.Trim() -eq "[CLI_USERS_JSON_END]") {
            $inJson = $false
            continue
        }
        if ($inJson) {
            $jsonLines += $line
        }
    }

    if ($jsonLines.Count -eq 0) {
        Write-Host "  No user records found in Microsoft SQL Server database or unexpected output." -ForegroundColor DarkYellow
        Write-Host ""
        return
    }

    $jsonStr = $jsonLines -join "`n"
    try {
        $users = ConvertFrom-Json $jsonStr
    } catch {
        Write-Host "  Failed to parse user JSON data." -ForegroundColor Red
        return
    }

    if (-not $users -or $users.Count -eq 0) {
        Write-Host "  No registered accounts found in Microsoft SQL Server database." -ForegroundColor DarkYellow
        Write-Host ""
        return
    }

    Write-Host "  Total Registered ResQTrack Accounts in SQL Server: $($users.Count)" -ForegroundColor Green
    Write-Host ""

    # Render ASCII Table
    $colId = 16
    $colName = 26
    $colEmail = 32
    $colRole = 14
    $colUnit = 10
    $colStatus = 10
    $colDate = 12

    $sep = "+-" + ("-" * $colId) + "-+-" + ("-" * $colName) + "-+-" + ("-" * $colEmail) + "-+-" + ("-" * $colRole) + "-+-" + ("-" * $colUnit) + "-+-" + ("-" * $colStatus) + "-+-" + ("-" * $colDate) + "-+"

    Write-Host $sep -ForegroundColor DarkGray
    $hdr = "| " + ("ID / BADGE #".PadRight($colId)) + " | " + ("FULL NAME".PadRight($colName)) + " | " + ("EMAIL".PadRight($colEmail)) + " | " + ("ROLE".PadRight($colRole)) + " | " + ("UNIT".PadRight($colUnit)) + " | " + ("STATUS".PadRight($colStatus)) + " | " + ("CREATED AT".PadRight($colDate)) + " |"
    Write-Host $hdr -ForegroundColor Yellow
    Write-Host $sep -ForegroundColor DarkGray

    foreach ($u in $users) {
        $badgeRaw = if ($u.employeeOrResidentId) { $u.employeeOrResidentId } else { "-" }
        $badge = $badgeRaw.PadRight($colId).Substring(0, [Math]::Min($badgeRaw.Length, $colId)).PadRight($colId)

        $nameRaw = if ($u.fullName) { $u.fullName } else { "-" }
        $name = $nameRaw.PadRight($colName).Substring(0, [Math]::Min($nameRaw.Length, $colName)).PadRight($colName)

        $emailRaw = if ($u.email) { $u.email } else { "-" }
        $email = $emailRaw.PadRight($colEmail).Substring(0, [Math]::Min($emailRaw.Length, $colEmail)).PadRight($colEmail)

        $roleRaw = if ($u.role) { $u.role } else { "Civilian" }
        $role = $roleRaw.PadRight($colRole).Substring(0, [Math]::Min($roleRaw.Length, $colRole)).PadRight($colRole)

        $unitRaw = if ($u.unit) { $u.unit } else { "None" }
        $unit = $unitRaw.PadRight($colUnit).Substring(0, [Math]::Min($unitRaw.Length, $colUnit)).PadRight($colUnit)

        $statusRaw = if ($u.status) { $u.status } else { "Verified" }
        $status = $statusRaw.PadRight($colStatus).Substring(0, [Math]::Min($statusRaw.Length, $colStatus)).PadRight($colStatus)

        $dateRaw = if ($u.createdAt) {
            try { ([DateTime]$u.createdAt).ToString("yyyy-MM-dd") } catch { $u.createdAt.Substring(0, [Math]::Min(10, $u.createdAt.Length)) }
        } else { "-" }
        $date = $dateRaw.PadRight($colDate).Substring(0, [Math]::Min($dateRaw.Length, $colDate)).PadRight($colDate)

        $row = "| $badge | $name | $email | $role | $unit | $status | $date |"
        
        $roleColor = switch ($u.role) {
            "LDRRMO_Admin" { "Cyan" }
            "Responder"    { "Yellow" }
            "Civilian"     { "Green" }
            Default        { "White" }
        }
        Write-Host $row -ForegroundColor $roleColor
    }
    Write-Host $sep -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  [i] All administrative & responder accounts above are persisted in Microsoft SQL Server (SSMS 19) and secured via Scrypt KDF." -ForegroundColor Cyan
    Write-Host ""
}

function Invoke-ListUsers {
    Write-Host "[*] Querying Microsoft SQL Server database for ResQTrack registered users..." -ForegroundColor Cyan
    $output = & dotnet run --project "$BackendDir" --no-build -- listcliusers
    Show-TableFromUsersJson $output
}

function Invoke-CreateSuperAdmin($mail, $pwd, $name, $unit) {
    if (-not $mail -or -not $pwd -or -not $name) {
        Write-Host "[!] Missing required arguments: <email> <password> <fullName> [unit]" -ForegroundColor Red
        return
    }
    if (-not $unit) { $unit = "LDRRMO" }
    Write-Host "[*] Registering Super Admin '$mail' in Microsoft SQL Server ($name, Unit: $unit)..." -ForegroundColor Cyan
    & dotnet run --project "$BackendDir" --no-build -- createsuperadmin "$mail" "$pwd" "$name" "$unit"
    Write-Host ""
    Invoke-ListUsers
}

function Invoke-CreateCustomSuperAdmin($mail, $pwd, $name, $unit) {
    if (-not $mail -or -not $pwd -or -not $name) {
        Write-Host "[!] Missing required arguments: <email> <password> <fullName> [unit]" -ForegroundColor Red
        return
    }
    if (-not $unit) { $unit = "RHU" }
    Write-Host "[*] Registering Custom Admin '$mail' in Microsoft SQL Server ($name, Unit: $unit)..." -ForegroundColor Cyan
    & dotnet run --project "$BackendDir" --no-build -- createcustomsuperadmin "$mail" "$pwd" "$name" "$unit"
    Write-Host ""
    Invoke-ListUsers
}

function Invoke-CreateResponder($mail, $pwd, $name, $unit, $badge) {
    if (-not $mail -or -not $pwd -or -not $name) {
        Write-Host "[!] Missing required arguments: <email> <password> <fullName> [unit] [employeeId]" -ForegroundColor Red
        return
    }
    if (-not $unit) { $unit = "RHU" }
    if (-not $badge) { $badge = "$unit-" + ([Guid]::NewGuid().ToString("N").Substring(0,6).ToUpper()) }
    Write-Host "[*] Registering Responder '$mail' in Microsoft SQL Server ($name, Unit: $unit, Badge: $badge)..." -ForegroundColor Cyan
    & dotnet run --project "$BackendDir" --no-build -- adduser "$mail" "$pwd" "$name" "Responder" "$unit" "$badge"
    Write-Host ""
    Invoke-ListUsers
}

function Invoke-CreateCivilian($mail, $pwd, $name, $residentId) {
    if (-not $mail -or -not $pwd -or -not $name) {
        Write-Host "[!] Missing required arguments: <email> <password> <fullName> [residentId]" -ForegroundColor Red
        return
    }
    if (-not $residentId) { $residentId = "UG-RES-" + ([Guid]::NewGuid().ToString("N").Substring(0,6).ToUpper()) }
    Write-Host "[*] Registering Resident Civilian '$mail' in Microsoft SQL Server ($name, ID: $residentId)..." -ForegroundColor Cyan
    & dotnet run --project "$BackendDir" --no-build -- adduser "$mail" "$pwd" "$name" "Civilian" "None" "$residentId"
    Write-Host ""
    Invoke-ListUsers
}

function Invoke-AddUser($mail, $pwd, $name, $role, $unit, $badge) {
    if (-not $mail -or -not $pwd -or -not $name) {
        Write-Host "[!] Missing required arguments: <email> <password> <fullName> <role> [unit] [employeeId]" -ForegroundColor Red
        return
    }
    if (-not $role) { $role = "Civilian" }
    if (-not $unit) { $unit = "None" }
    Write-Host "[*] Adding user '$mail' to Microsoft SQL Server ($name, Role: $role, Unit: $unit)..." -ForegroundColor Cyan
    & dotnet run --project "$BackendDir" --no-build -- adduser "$mail" "$pwd" "$name" "$role" "$unit" "$badge"
    Write-Host ""
    Invoke-ListUsers
}

function Invoke-ResetPassword($mail, $newPassword) {
    if (-not $mail -or -not $newPassword) {
        Write-Host "[!] Missing required arguments: <email> <newPassword>" -ForegroundColor Red
        return
    }
    Write-Host "[*] Resetting password for user '$mail' with Scrypt KDF in Microsoft SQL Server..." -ForegroundColor Cyan
    & dotnet run --project "$BackendDir" --no-build -- resetpassword "$mail" "$newPassword"
    Write-Host ""
}

function Invoke-DeleteUser($mail) {
    if (-not $mail) {
        Write-Host "[!] Missing argument: <email>" -ForegroundColor Red
        return
    }
    Write-Host "[*] Permanently deleting user '$mail' from Microsoft SQL Server database..." -ForegroundColor Yellow
    & dotnet run --project "$BackendDir" --no-build -- deletecliuser "$mail"
    Write-Host ""
    Invoke-ListUsers
}

function Invoke-DeleteAllUsers {
    Write-Host "[!] CAUTION: This will delete ALL registered users from Microsoft SQL Server database!" -ForegroundColor Red
    $confirm = Read-Host "Are you sure you want to proceed? (yes/no)"
    if ($confirm -eq "yes") {
        Write-Host "[*] Deleting all users from Microsoft SQL Server database..." -ForegroundColor Yellow
        & dotnet run --project "$BackendDir" --no-build -- deleteallcliusers
        Write-Host ""
        Invoke-ListUsers
    } else {
        Write-Host "[-] Deletion cancelled." -ForegroundColor Gray
    }
}

function Show-InteractiveMenu {
    Show-Header
    while ($true) {
        Write-Host "Select an administrative operation (Microsoft SQL Server / SSMS 19 Store):" -ForegroundColor Cyan
        Write-Host "  [1] List all registered users (listusers)"
        Write-Host "  [2] Create SuperAdmin - LDRRMO Director (createsuperadmin)"
        Write-Host "  [3] Create Custom Admin - Unit Admin (createcustomsuperadmin)"
        Write-Host "  [4] Create Responder - Medic/Fire/Police (createresponder)"
        Write-Host "  [5] Create Resident Civilian (createcivilian)"
        Write-Host "  [6] Add User Generic - Role/Unit/Badge (adduser)"
        Write-Host "  [7] Reset User Password with Scrypt KDF (resetpassword)"
        Write-Host "  [8] Delete a user by email (deletecliuser)"
        Write-Host "  [9] Delete ALL users (deleteallcliusers)"
        Write-Host "  [0] Exit"
        Write-Host ""
        $choice = Read-Host "Enter option (0-9)"

        switch ($choice) {
            "1" {
                Invoke-ListUsers
            }
            "2" {
                $e = Read-Host "Email (e.g. ldrrmo.admin@resqtrack.gov.ph)"
                $p = Read-Host "Password (min 12 chars)"
                $n = Read-Host "Full Name (e.g. Director Alejandro Ramos)"
                $u = Read-Host "Unit [LDRRMO/RHU/FIRE/PNP/Security] (Default: LDRRMO)"
                if (-not $u) { $u = "LDRRMO" }
                Invoke-CreateSuperAdmin $e $p $n $u
            }
            "3" {
                $e = Read-Host "Email"
                $p = Read-Host "Password (min 12 chars)"
                $n = Read-Host "Full Name"
                $u = Read-Host "Unit [LDRRMO/RHU/FIRE/PNP/Security] (Default: RHU)"
                if (-not $u) { $u = "RHU" }
                Invoke-CreateCustomSuperAdmin $e $p $n $u
            }
            "4" {
                $e = Read-Host "Email"
                $p = Read-Host "Password (min 12 chars)"
                $n = Read-Host "Full Name"
                $u = Read-Host "Unit [RHU/FIRE/PNP/Security] (Default: RHU)"
                if (-not $u) { $u = "RHU" }
                $b = Read-Host "Badge / Employee ID (Optional)"
                Invoke-CreateResponder $e $p $n $u $b
            }
            "5" {
                $e = Read-Host "Email"
                $p = Read-Host "Password (min 12 chars)"
                $n = Read-Host "Full Name"
                $r = Read-Host "Resident ID (Optional)"
                Invoke-CreateCivilian $e $p $n $r
            }
            "6" {
                $e = Read-Host "Email"
                $p = Read-Host "Password (min 12 chars)"
                $n = Read-Host "Full Name"
                $ro = Read-Host "Role [LDRRMO_Admin/Responder/Civilian] (Default: Civilian)"
                if (-not $ro) { $ro = "Civilian" }
                $u = Read-Host "Unit [None/LDRRMO/RHU/FIRE/PNP/Security] (Default: None)"
                if (-not $u) { $u = "None" }
                $b = Read-Host "Badge / ID (Optional)"
                Invoke-AddUser $e $p $n $ro $u $b
            }
            "7" {
                $e = Read-Host "Email of user"
                $p = Read-Host "New Password (min 12 chars)"
                Invoke-ResetPassword $e $p
            }
            "8" {
                $e = Read-Host "Email of user to delete"
                Invoke-DeleteUser $e
            }
            "9" {
                Invoke-DeleteAllUsers
            }
            "0" {
                Write-Host "Exiting administrative CLI. Stay safe!" -ForegroundColor Yellow
                return
            }
            Default {
                Write-Host "Invalid option." -ForegroundColor Red
            }
        }
        Write-Host ""
        Read-Host "Press Enter to continue..."
        Clear-Host
        Show-Header
    }
}

# ─── Command Line Dispatcher ─────────────────────────────────────────────────
if (-not $Command) {
    Show-InteractiveMenu
    exit 0
}

Show-Header

switch ($Command.ToLower()) {
    "listusers"               { Invoke-ListUsers }
    "list"                    { Invoke-ListUsers }
    "createsuperadmin"        { Invoke-CreateSuperAdmin $Arg1 $Arg2 $Arg3 $Arg4 }
    "createcustomsuperadmin"  { Invoke-CreateCustomSuperAdmin $Arg1 $Arg2 $Arg3 $Arg4 }
    "createresponder"         { Invoke-CreateResponder $Arg1 $Arg2 $Arg3 $Arg4 $Arg5 }
    "createcivilian"          { Invoke-CreateCivilian $Arg1 $Arg2 $Arg3 $Arg4 }
    "adduser"                 { Invoke-AddUser $Arg1 $Arg2 $Arg3 $Arg4 $Arg5 $Arg6 }
    "resetpassword"           { Invoke-ResetPassword $Arg1 $Arg2 }
    "deleteuser"              { Invoke-DeleteUser $Arg1 }
    "deletesuperadmin"        { Invoke-DeleteUser $Arg1 }
    "deletecliuser"           { Invoke-DeleteUser $Arg1 }
    "deleteallcliusers"       { Invoke-DeleteAllUsers }
    "help"                    {
        Write-Host "Available Commands (Targeting Microsoft SQL Server / SSMS 19):" -ForegroundColor Yellow
        Write-Host "  listusers"
        Write-Host "  createsuperadmin <email> <password> <fullName> [unit]"
        Write-Host "  createcustomsuperadmin <email> <password> <fullName> [unit]"
        Write-Host "  createresponder <email> <password> <fullName> <unit> [employeeId]"
        Write-Host "  createcivilian <email> <password> <fullName> [residentId]"
        Write-Host "  adduser <email> <password> <fullName> <role> [unit] [employeeId]"
        Write-Host "  resetpassword <email> <newPassword>"
        Write-Host "  deleteuser <email>"
        Write-Host "  deleteallcliusers"
    }
    Default {
        Write-Host "[!] Unknown command: '$Command'. Run 'cli.ps1 help' for usage." -ForegroundColor Red
        exit 1
    }
}
