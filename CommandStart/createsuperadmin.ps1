param(
    [string]$Email = "",
    [string]$Password = "",
    [string]$FullName = "",
    [string]$Unit = "LDRRMO"
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

$BackendDir = Join-Path $RootDir "Project system ENGINE\Backend"

if (-not (Test-Path $BackendDir)) {
    Write-Host "[!] Error: Backend directory not found at '$BackendDir'." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   RESQTRACK INCIDENT AI SYSTEM -- CREATE SUPERADMIN (LDRRMO)       " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Email)) {
    $Email = Read-Host "Enter SuperAdmin Email (e.g. ldrrmo.admin@resqtrack.gov.ph)"
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    $secPass = Read-Host "Enter SuperAdmin Password (min 12 chars)" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

if ($Password.Length -lt 12) {
    Write-Host "[!] Error: Password must be at least 12 characters long." -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($FullName)) {
    $FullName = Read-Host "Enter Full Name (e.g. Director Alejandro Ramos)"
}

if ([string]::IsNullOrWhiteSpace($Unit)) {
    $Unit = "LDRRMO"
}

Write-Host ""
Write-Host "[*] Executing SuperAdmin creation for $Email ($Unit)..." -ForegroundColor Cyan
dotnet run --project "$BackendDir" -- createsuperadmin "$Email" "$Password" "$FullName" "$Unit"
