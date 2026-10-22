param(
    [string]$Email = "",
    [switch]$Force = $false
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
Write-Host "======================================================================" -ForegroundColor Red
Write-Host "   RESQTRACK INCIDENT AI SYSTEM -- DELETE SUPERADMIN ACCOUNT          " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Red
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Email)) {
    $Email = Read-Host "Enter SuperAdmin Email to delete"
}

if ([string]::IsNullOrWhiteSpace($Email)) {
    Write-Host "[!] Error: Email cannot be empty." -ForegroundColor Red
    exit 1
}

if (-not $Force) {
    Write-Host "[!] WARNING: You are about to permanently delete SuperAdmin account: $Email" -ForegroundColor Red
    $confirm = Read-Host "Type 'CONFIRM' or 'yes' to proceed with deletion"
    if ($confirm -ne 'CONFIRM' -and $confirm -ne 'yes') {
        Write-Host "[-] Deletion cancelled by user." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "[*] Executing SuperAdmin deletion for $Email..." -ForegroundColor Cyan
dotnet run --project "$BackendDir" -- deletesuperadmin "$Email"
