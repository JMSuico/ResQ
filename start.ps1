[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Action = "dev",

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs = @()
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
Set-Location $ScriptDir

$startDevScript = Join-Path $ScriptDir "CommandStart\startdev-all.ps1"
$dockerStartScript = Join-Path $ScriptDir "CommandStart\docker-start-all.ps1"
$dockerStopScript = Join-Path $ScriptDir "CommandStart\docker-stop-all.ps1"
$installScript = Join-Path $ScriptDir "CommandStart\install-dependencies.ps1"
$manageScript = Join-Path $ScriptDir "CommandStart\manage.ps1"
$stopScript = Join-Path $ScriptDir "CommandStart\stopdev-all.ps1"

# Fresh-Clone Guard: Auto-detect missing dependencies and bootstrap them
$frontendModules = Join-Path $ScriptDir "Project system ENGINE\Frontend\node_modules"
$backendBin = Join-Path $ScriptDir "Project system ENGINE\Backend\bin"

if ((-not (Test-Path $frontendModules)) -or (-not (Test-Path $backendBin))) {
    Write-Host "[*] Fresh clone or missing dependencies detected. Running auto-installer..." -ForegroundColor Yellow
    if (Test-Path $installScript) {
        & $installScript
    }
}

switch -Regex ($Action.ToLowerInvariant()) {
    "^(dev|start|^$)" {
        if (Test-Path $startDevScript) {
            & $startDevScript
        } else {
            Write-Error "Could not find startdev-all.ps1 at $startDevScript"
            exit 1
        }
    }

    "^(docker|compose|containers)$" {
        if (Test-Path $dockerStartScript) {
            & $dockerStartScript
        } else {
            Write-Error "Could not find docker-start-all.ps1 at $dockerStartScript"
            exit 1
        }
    }

    "^(docker-down|docker-stop)$" {
        if (Test-Path $dockerStopScript) {
            & $dockerStopScript
        } else {
            Write-Error "Could not find docker-stop-all.ps1 at $dockerStopScript"
            exit 1
        }
    }

    "^(install|setup|bootstrap|deps)$" {
        if (Test-Path $installScript) {
            & $installScript
        } else {
            Write-Error "Could not find install-dependencies.ps1 at $installScript"
            exit 1
        }
    }

    "^(stop|kill|down)$" {
        if (Test-Path $stopScript) {
            & $stopScript -IncludeDocker
        } else {
            Write-Error "Could not find stopdev-all.ps1 at $stopScript"
            exit 1
        }
    }

    "^(status|probe)$" {
        if (Test-Path $manageScript) {
            & $manageScript -Action "status"
        } else {
            Write-Error "Could not find manage.ps1 at $manageScript"
            exit 1
        }
    }

    "^(refresh|hard-refresh)$" {
        if (Test-Path $manageScript) {
            & $manageScript -Action "refresh"
        } else {
            Write-Error "Could not find manage.ps1 at $manageScript"
            exit 1
        }
    }

    "^(test|audit|verify)$" {
        $frontendDir = Join-Path $ScriptDir "Project system ENGINE\Frontend"
        Write-Host "[*] Executing ResQTrack Comprehensive Production Map & Dual-Approval Audit..." -ForegroundColor Cyan
        Push-Location $frontendDir
        try {
            npx tsx src/Libs/Testing/verify_map_and_dual_approval_workflows.ts
        } finally {
            Pop-Location
        }
    }

    "^(test-id|scan-test|id-test)$" {
        $frontendDir = Join-Path $ScriptDir "Project system ENGINE\Frontend"
        Write-Host "[*] Executing Optical ID Frame Freezing, Laser Scan & Autofill Verification..." -ForegroundColor Cyan
        Push-Location $frontendDir
        try {
            npx tsx src/Libs/Testing/test_id_scan_freeze_and_autofill_browser.ts
        } finally {
            Pop-Location
        }
    }

    "^(migrate|db-migrate)$" {
        $migrateScript = Join-Path $ScriptDir "CommandStart\migrate.ps1"
        if (Test-Path $migrateScript) {
            & $migrateScript
        } else {
            Write-Error "Could not find migrate.ps1 at $migrateScript"
            exit 1
        }
    }

    "^(menu)$" {
        if (Test-Path $manageScript) {
            & $manageScript
        } else {
            Write-Error "Could not find manage.ps1 at $manageScript"
            exit 1
        }
    }

    default {
        if (Test-Path $manageScript) {
            & $manageScript -Action $Action $RemainingArgs
        } else {
            Write-Error "Could not find manage.ps1 at $manageScript"
            exit 1
        }
    }
}
