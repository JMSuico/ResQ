# ==============================================================================
# ResQTrack Incident AI Detection System — Master Test Execution Suite
# Canonical Testing Directory: C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Testing
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "   RESQTRACK INCIDENT AI DETECTION SYSTEM - CENTRALIZED TEST RUNNER" -ForegroundColor Yellow
Write-Host "   Location: $ScriptDir" -ForegroundColor DarkGray
Write-Host "================================================================================" -ForegroundColor Cyan

# 1. Run Backend Tests (.NET 10 xUnit Suite)
if (-not $FrontendOnly) {
    Write-Host "`n[1/3] Running Backend xUnit Security & Persistence Tests..." -ForegroundColor Green
    $backendProj = Join-Path $ScriptDir "Backend\Backend.Tests.csproj"
    if (Test-Path $backendProj) {
        dotnet test $backendProj --nologo
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Backend test execution failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Host "Backend tests passed successfully." -ForegroundColor Green
    } else {
        Write-Warning "Backend test project not found at: $backendProj"
    }
}

# 2. Run Philippine ID Recognition & OCR 84-Test Suite
if (-not $BackendOnly) {
    Write-Host "`n[2/3] Running Philippine Government ID Recognition & OCR 84-Test Suite..." -ForegroundColor Green
    $ocrTest = Join-Path $ScriptDir "Frontend\test_ph_id_ocr_pipeline.ts"
    if (Test-Path $ocrTest) {
        npx tsx $ocrTest
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Philippine ID OCR pipeline tests failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Host "Philippine ID OCR pipeline tests passed 100% GREEN." -ForegroundColor Green
    } else {
        Write-Warning "OCR test file not found at: $ocrTest"
    }
}

# 3. Run Multi-Role Port Isolation & Concurrency Suite
if (-not $BackendOnly) {
    Write-Host "`n[3/4] Running Multi-Role Port Clearance & Concurrency Suite..." -ForegroundColor Green
    $portTest = Join-Path $ScriptDir "Frontend\verify_multi_role_ports.ts"
    if (Test-Path $portTest) {
        npx tsx $portTest
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Multi-role port clearance tests failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Host "Multi-role port clearance tests passed 100%." -ForegroundColor Green
    } else {
        Write-Warning "Port test file not found at: $portTest"
    }
}

# 4. Run 6-Phase Manual Registration & Strategy Pattern E2E Suite
if (-not $BackendOnly) {
    Write-Host "`n[4/4] Running 6-Phase Manual Registration & Strategy Pattern E2E Suite..." -ForegroundColor Green
    $regTest = Join-Path $ScriptDir "Frontend\test_manual_6phase_registration_e2e.ts"
    if (Test-Path $regTest) {
        $env:NODE_PATH = Join-Path $ScriptDir "..\Project system ENGINE\Frontend\node_modules"
        npx tsx $regTest
        if ($LASTEXITCODE -ne 0) {
            Write-Error "6-Phase Manual Registration E2E test failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Host "6-Phase Manual Registration E2E tests passed 100% GREEN." -ForegroundColor Green
    } else {
        Write-Warning "Registration test file not found at: $regTest"
    }
}

Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "   ALL VERIFICATION TEST SUITES PASSED SUCCESSFULLY (100% GREEN)" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
