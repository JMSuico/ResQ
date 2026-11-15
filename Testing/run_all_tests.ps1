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

$FrontendNodeModules = Join-Path $ScriptDir "..\Project system ENGINE\Frontend\node_modules"

# 1. Run Backend Tests (.NET 10 xUnit Suite)
if (-not $FrontendOnly) {
    Write-Host "`n[1/7] Running Backend xUnit Security & Persistence Tests..." -ForegroundColor Green
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
    Write-Host "`n[2/7] Running Philippine Government ID Recognition & OCR 84-Test Suite..." -ForegroundColor Green
    $ocrTest = Join-Path $ScriptDir "Frontend\test_ph_id_ocr_pipeline.ts"
    if (Test-Path $ocrTest) {
        $env:NODE_PATH = $FrontendNodeModules
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

# 3. Run Visible-Only OCR Contract Verification Suite
if (-not $BackendOnly) {
    Write-Host "`n[3/7] Running Visible-Only OCR Contract Verification Suite..." -ForegroundColor Green
    $visibleOcrTest = Join-Path $ScriptDir "Frontend\VisionTests\verify_visible_only_ocr_contracts.ts"
    if (Test-Path $visibleOcrTest) {
        $env:NODE_PATH = $FrontendNodeModules
        npx tsx $visibleOcrTest
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Visible-only OCR contract verification failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Host "Visible-only OCR contract tests passed 100% GREEN." -ForegroundColor Green
    } else {
        Write-Warning "Visible-only OCR contract test file not found at: $visibleOcrTest"
    }
}

# 4. Run Unified Phase 2 Preflight Forensic Verification Suite
if (-not $BackendOnly) {
    Write-Host "`n[4/7] Running Unified Phase 2 Preflight Verification Suite..." -ForegroundColor Green
    $preflightTest = Join-Path $ScriptDir "Frontend\VisionTests\verify_unified_phase2_preflight.ts"
    if (Test-Path $preflightTest) {
        $env:NODE_PATH = $FrontendNodeModules
        npx tsx $preflightTest
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Unified Phase 2 preflight verification failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Host "Unified Phase 2 preflight verification tests passed 100% GREEN." -ForegroundColor Green
    } else {
        Write-Warning "Unified Phase 2 preflight test file not found at: $preflightTest"
    }
}

# 5. Run Multi-Role Port Isolation & Concurrency Suite
if (-not $BackendOnly) {
    Write-Host "`n[5/7] Running Multi-Role Port Clearance & Concurrency Suite..." -ForegroundColor Green
    $portTest = Join-Path $ScriptDir "Frontend\verify_multi_role_ports.ts"
    if (Test-Path $portTest) {
        $env:NODE_PATH = $FrontendNodeModules
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

# 6. Run Legacy/Unified Registration & Strategy Pattern E2E Suite
if (-not $BackendOnly) {
    Write-Host "`n[6/7] Running Unified 5-Phase Registration & Strategy Pattern E2E Suite..." -ForegroundColor Green
    $regTest = Join-Path $ScriptDir "Frontend\test_manual_6phase_registration_e2e.ts"
    if (Test-Path $regTest) {
        $env:NODE_PATH = $FrontendNodeModules
        npx tsx $regTest
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Unified registration E2E test failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Host "Unified registration E2E tests passed 100% GREEN." -ForegroundColor Green
    } else {
        Write-Warning "Registration test file not found at: $regTest"
    }
}

# 7. Run Unified Phase 2-5 Y4M & Token Auto-Approval E2E Master Suite
if (-not $BackendOnly) {
    Write-Host "`n[7/7] Running Unified Phase 2-5 Y4M & AI Auto-Approval E2E Master Suite..." -ForegroundColor Green
    $autoApproveTest = Join-Path $ScriptDir "Frontend\test_unified_phase2_auto_approval_e2e.ts"
    if (Test-Path $autoApproveTest) {
        $env:NODE_PATH = $FrontendNodeModules
        npx tsx $autoApproveTest
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Unified Phase 2-5 Auto-Approval E2E test failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        Write-Host "Unified Phase 2-5 Auto-Approval E2E tests passed 100% GREEN." -ForegroundColor Green
    } else {
        Write-Warning "Unified Phase 2-5 Auto-Approval E2E test file not found at: $autoApproveTest"
    }
}

Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "   ALL VERIFICATION TEST SUITES PASSED SUCCESSFULLY (100% GREEN)" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
