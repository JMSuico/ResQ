param(
    [string]$Email = "",
    [string]$Password = "",
    [string]$FullName = "",
    [string]$Unit = "RHU"
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
Write-Host "   RESQTRACK INCIDENT AI SYSTEM -- CREATE CUSTOM SUPERADMIN           " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Email)) {
    $Email = Read-Host "Enter Custom SuperAdmin Email (e.g. rhu.lead@resqtrack.gov.ph)"
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    $secPass = Read-Host "Enter Password (min 12 chars)" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

if ($Password.Length -lt 12) {
    Write-Host "[!] Error: Password must be at least 12 characters long." -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($FullName)) {
    $FullName = Read-Host "Enter Full Name (e.g. Dr. Maria Clara Santos)"
}

if ([string]::IsNullOrWhiteSpace($Unit)) {
    $Unit = Read-Host "Enter Unit (LDRRMO, RHU, FIRE, PNP, Security) [default: RHU]"
}
if ([string]::IsNullOrWhiteSpace($Unit)) {
    $Unit = "RHU"
}

Write-Host ""
Write-Host "[*] Executing Custom SuperAdmin creation for $Email ($Unit)..." -ForegroundColor Cyan
dotnet run --project "$BackendDir" -- createcustomsuperadmin "$Email" "$Password" "$FullName" "$Unit"
