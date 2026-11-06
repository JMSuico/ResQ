[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [ValidateSet("SqlServer", "PostgreSql", "MySql", "Status", "")]
    [string]$TargetProvider = ""
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

$backendDir = Join-Path $RootDir "Project system ENGINE\Backend"
$appSettings = Join-Path $backendDir "appsettings.json"
$appSettingsDev = Join-Path $backendDir "appsettings.Development.json"

function Set-DatabaseProviderInFile {
    param([string]$FilePath, [string]$Provider)
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath -Raw
        $updated = $content -replace '"DatabaseProvider"\s*:\s*"[^"]+"', "`"DatabaseProvider`": `"$Provider`""
        Set-Content -Path $FilePath -Value $updated -Encoding UTF8
    }
}

function Get-CurrentProvider {
    if (Test-Path $appSettings) {
        $content = Get-Content $appSettings -Raw
        if ($content -match '"DatabaseProvider"\s*:\s*"([^"]+)"') {
            return $matches[1]
        }
    }
    return "SqlServer"
}

$current = Get-CurrentProvider

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "         RESQTRACK ENTERPRISE RDBMS PROVIDER CONTROLLER              " -ForegroundColor Magenta
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Current Database Provider: " -NoNewline
Write-Host "$current" -ForegroundColor Yellow
Write-Host ""

if ([string]::IsNullOrWhiteSpace($TargetProvider) -or $TargetProvider -eq "Status") {
    if ($TargetProvider -eq "Status") { exit 0 }
    Write-Host "Select relational database provider to activate:" -ForegroundColor Cyan
    Write-Host "  [1] Microsoft SQL Server (SSMS 19 / LocalDB / Express) [PRIMARY]" -ForegroundColor Green
    Write-Host "  [2] PostgreSQL 16 Alpine (Docker Compose Standby on :5432)" -ForegroundColor Green
    Write-Host "  [3] MySQL / MariaDB (XAMPP on :3306)" -ForegroundColor Green
    Write-Host "  [Q] Cancel / Exit" -ForegroundColor Gray
    Write-Host ""
    $choice = Read-Host "Enter selection [1-3, Q]"
    switch ($choice) {
        "1" { $TargetProvider = "SqlServer" }
        "2" { $TargetProvider = "PostgreSql" }
        "3" { $TargetProvider = "MySql" }
        default {
            Write-Host "[*] No changes made." -ForegroundColor Gray
            exit 0
        }
    }
}

Set-DatabaseProviderInFile -FilePath $appSettings -Provider $TargetProvider
Set-DatabaseProviderInFile -FilePath $appSettingsDev -Provider $TargetProvider

Write-Host "[OK] DatabaseProvider successfully updated to '$TargetProvider'!" -ForegroundColor Green
Write-Host "  Updated file: $appSettings" -ForegroundColor Gray
Write-Host "  Updated file: $appSettingsDev" -ForegroundColor Gray
Write-Host ""
if ($TargetProvider -eq "PostgreSql") {
    Write-Host "[!] Note: Ensure PostgreSQL Docker container is running by executing: .\start-postgres-docker.ps1" -ForegroundColor Yellow
}
