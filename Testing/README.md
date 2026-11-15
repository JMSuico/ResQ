# ResQTrack Incident AI Detection System -- Centralized Testing Directory

> **Canonical Test Directory:** `C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Testing`
> **Permanent Architectural Rule:** All future and existing test files must always be placed and maintained within this directory.

---

## 1. Directory Layout

```
Testing/
|-- Backend/
|   |-- Backend.Tests.csproj                         # .NET 10 xUnit test project
|   |-- OcrFidelityAndFailoverTests.cs               # Dual-side OCR fidelity, Claude failover, error codes
|   |-- RegistrationStrategyAndWorkflowTests.cs      # Role strategy validation, 5-phase contract rules
|   |-- RegistrationTokenAndAutoApprovalTests.cs     # IdVerificationToken + FacialVerificationToken auto-approval
|   |-- SecurityAndPersistenceTests.cs               # Lockout, scrypt password, RBAC security tests
|   `-- UnitTest1.cs                                 # Base assertion contract
|-- Frontend/
|   |-- fixtures/
|   |   |-- assets/                                  # Sample ID card & headshot fixtures (PhilSys, Driver's, Specimen)
|   |   |-- anthropicTestWireServer.ts               # Tier 2 local deterministic Claude /v1/messages harness
|   |   |-- e2eServerHarness.ts                      # Isolated ports 1996..1999 test server launcher (Claude__Endpoint)
|   |   |-- syntheticIdFixtures.ts                   # Synthetic Philippine ID generator fixtures
|   |   `-- y4mFaceAndMatchingIdFixture.ts           # Synthetic video stream + matching ID fixture
|   |-- VisionTests/
|   |   |-- verify_dip_core.ts                       # Classical image processing & matrix primitives
|   |   |-- verify_dynamic_anchor_parser.ts          # Dynamic anchor layout parser checks
|   |   |-- verify_face_recognition_and_biometrics.ts# 1:1 facial matching & descriptor checks
|   |   |-- verify_geometric_facial_patterns.ts      # Geometric anthropometric pattern checks
|   |   |-- verify_ocr_ccl.ts                        # Connected component labeling OCR checks
|   |   |-- verify_pascal_indication_and_noise_rejection.ts # PascalCase label & noise filtering checks
|   |   |-- verify_text_extractor_engine.ts          # ROI text extraction checks
|   |   |-- verify_unified_phase2_preflight.ts       # Unified Phase 02 state & Choose ID Type contract checks
|   |   |-- verify_uploaded_id_ocr_pipeline.ts       # Uploaded front/back ID OCR pipeline checks
|   |   |-- verify_visible_only_ocr_contracts.ts     # Visible-only OCR merge & blank-field preservation checks
|   |   `-- verify_vision.ts                         # General vision sanity suite
|   |-- test_unified_phase2_auto_approval_e2e.ts     # Unified 5-phase UI + Choose ID Type gate + E2E auto-approval
|   |-- test_manual_6phase_registration_e2e.ts       # Legacy/regression E2E harness (runs in stage [6/7])
|   |-- test_claude_strategy_and_multilayer_biometrics_e2e.ts # Strategy + biometric verification E2E
|   |-- test_ph_id_ocr_pipeline.ts                   # Offline synthetic PH ID OCR pipeline suite
|   |-- verify_multi_role_ports.ts                   # Multi-port 1996/1997/1998/1999 readiness & health suite
|   |-- test_biometric_enrollment_and_login.ts       # Facial enrollment & 1:1 biometric login tests
|   |-- test_register_flow_browser.ts                # Playwright browser registration smoke tests
|   `-- (additional targeted Playwright, diagnostic, and UI stability scripts in Testing/Frontend/)
|-- biometric_model_training_and_1to1_login_verification_report.md # Historical biometric verification report
|-- run_all_tests.ps1                                # Unified 7-stage test runner
`-- README.md                                        # This documentation
```

---

## 2. Two-Tier Test Architecture (Live vs Deterministic E2E Harness)

The test suite enforces a strict boundary between production/runtime behavior and deterministic E2E test execution:

- **Tier 1 -- Live Runtime & Production Behavior**:
  - `Project system ENGINE/Backend` calls real `https://api.anthropic.com/v1/messages` (`Claude:Endpoint` in `ClaudeMessagesClient.cs`) using `claude-sonnet-4-6` primary and `claude-sonnet-5-5` automatic failover.
  - Zero test flags, zero `mock-*` branches, and zero environment-based mock switches exist in production `Backend/` or `Frontend/src/` code.
- **Tier 2 -- Local Deterministic E2E Harness (`Testing/Frontend/fixtures/`)**:
  - `Testing/Frontend/fixtures/anthropicTestWireServer.ts` (`startAnthropicTestWireServer()`) serves an HTTP wire-compatible Anthropic `/v1/messages` server inside `Testing/`.
  - `Testing/Frontend/fixtures/e2eServerHarness.ts` spawns isolated backend (`:1999`) and frontend (`:1996` Admin, `:1997` Responder, `:1998` Civilian) test processes with `Claude__Endpoint` injected so Playwright E2E tests exercise the real C# HTTP client, HMAC verification tokens, forensics checks, and React Phase 02 UI cleanly offline/deterministically without modifying production code.

---

## 3. Running Tests

### 3.1 Full 7-Stage Suite (`run_all_tests.ps1`)
`Testing/run_all_tests.ps1` sets `$env:NODE_PATH` to `Project system ENGINE\Frontend\node_modules` and runs all 7 stages sequentially:

1. `[1/7]` `dotnet test Testing/Backend/Backend.Tests.csproj --nologo`
2. `[2/7]` `npx tsx Testing/Frontend/test_ph_id_ocr_pipeline.ts`
3. `[3/7]` `npx tsx Testing/Frontend/VisionTests/verify_visible_only_ocr_contracts.ts`
4. `[4/7]` `npx tsx Testing/Frontend/VisionTests/verify_unified_phase2_preflight.ts`
5. `[5/7]` `npx tsx Testing/Frontend/verify_multi_role_ports.ts`
6. `[6/7]` `npx tsx Testing/Frontend/test_manual_6phase_registration_e2e.ts`
7. `[7/7]` `npx tsx Testing/Frontend/test_unified_phase2_auto_approval_e2e.ts`

```powershell
powershell -ExecutionPolicy Bypass -File ".\Testing\run_all_tests.ps1"
```

### 3.2 Targeted Commands

```powershell
# Backend xUnit suite
dotnet test ".\Testing\Backend\Backend.Tests.csproj" --nologo

# Frontend Playwright/tsx scripts require NODE_PATH pointed at Frontend node_modules
$env:NODE_PATH = (Resolve-Path ".\Project system ENGINE\Frontend\node_modules").Path
npx tsx ".\Testing\Frontend\VisionTests\verify_unified_phase2_preflight.ts"
npx tsx ".\Testing\Frontend\test_unified_phase2_auto_approval_e2e.ts"
```

---

## 4. Phase 02 Choose-ID-Type Gate Coverage

Unified Phase 02 (`#phase-2-id-identity`) verification asserts:
- `select#id-type` initializes to `""` (`<option value="">Choose ID Type</option>`), keeping `#id-upload-locked-notice` visible and keeping `#id-upload-section`, `input#front-id-input`, `input#back-id-input`, `#btn-clear-both-ids`, `<IdVerificationBanner />`, and `#personal-info-section` unmounted (`count === 0`).
- Neither `?unit=rhu|pnp|fire|bfp|security` URL query params, role changes, nor agency unit switches pre-select an ID type.
- `#personal-info-section` mounts only after Front & Back IDs are uploaded for the chosen ID type and `idVerification.canUnlockPersonalInfo` becomes true (`VERIFIED_GENUINE` or `PENDING_MANUAL_REVIEW` on `503 PROVIDER_UNAVAILABLE`).
- `POST /api/identity/ocr/extract` (`IdentityController.ExtractOcrMultipartAsync`) returns HTTP `400 BadRequest` (`MISSING_ID_TYPE`) when `requireDualSide` is true and `idType` is blank.
