# Implementation Plan: Biometric Lockout Removal, Speed/Restart Fix, Typography Scale & Glassmorphism

## Wave 1: Red TDD Baseline
- Update/add xUnit tests in `Testing/Backend/SecurityAndPersistenceTests.cs` & `Testing/Backend/FastOcrAndHybridBiometricTests.cs` proving:
  - >= 5 failed biometric login attempts NEVER return `"Account temporarily locked"` / 15-minute lockout on `BiometricLoginAsync`.
  - Newly registered Civilian and Responder accounts (`RegisterWithDetailsAsync`) immediately succeed on `BiometricLoginAsync` (both `1:1` and `1:N` without DbContext tracking issues) even when prior failed `LoginAttempts` existed for that email.
- Update/extend `Testing/Frontend/VisionTests/verify_fast_ocr_and_hybrid_login.ts` and `Testing/Frontend/VisionTests/verify_minimal_ui_and_face_indicator.ts` for zero biometric lockout UI guards, larger font minimums, and glassmorphic minimalism contracts.

## Wave 2: Parallel Disjoint Domain Execution
- **Backend Auth & Biometrics Engineer**: `AuthService.cs`, `MultiLayerBiometricLoginStrategy.cs` (remove biometric lockout check/recording, clear `LoginAttempts` on fresh registration, `.AsNoTracking()`, freshest-enrollment guarantee in `1:N`, concurrent `Task.WhenAll`).
- **Frontend Biometrics Speed & Flow Engineer**: `biometricFrameCache.ts`, `ManualFacialCapturePanel.tsx`, `RegisterPage.tsx`, `BiometricLoginModal.tsx` (parallel 4-pose synthesis, deduplicated Phase 3 confirm, fast pose durations, `biometricFrameCache.clear()` after registration, remove biometric `'locked'` hard-block handling, larger modal fonts & glass polish).
- **Global Typography & Glass CSS Engineer**: `LayoutStyles/index.css`, `style.css`, `dashboard.css`, `register.css`, `PartLayout.css`, `MainLayout.css`, `tacticalHuds.css`, `FontSyle/fontStyles.css`, `responder.css`, `responders.css`, `settings.css`, `incidents.css`.
- **Landing, Auth & Layout Chrome Typography/Glass Engineer**: `LandingPage.tsx`, `LoginPage.tsx`, `AdminLoginPage.tsx`, `Login.tsx`, `LayoutBars/*`.
- **Admin Portal Typography/Glass Engineer**: `AdminsPanel/*` (larger fonts + minimal frosted glass without altering API calls/handlers).
- **Responder & Civilian Portals Typography/Glass Engineer**: `RespondersPanel/*`, `CiviliansPanel/*` (larger fonts + minimal frosted glass for RHU/PNP/FIRE & Civilian views without altering functions/endpoints).
- **Shared Modals & Charts Typography/Glass Engineer**: `Shared/*` (larger readable typography + frosted glass without touching callbacks).

## Wave 3: Integrated Verification Gate
- `dotnet test "Testing\Backend\Backend.Tests.csproj" -c Release --no-restore`
- `npm --prefix "Project system ENGINE\Frontend" run build` (`tsc -b && vite build`)
- `verify_minimal_ui_and_face_indicator.ts`, `verify_fast_ocr_and_hybrid_login.ts`, and Playwright E2E across freshly registered Responder + Civilian biometric login, Landing, Admin, Responder, and Civilian screenshots.
