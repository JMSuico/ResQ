# Cherry/Warm Ivory Stitch Overhaul, Async Biometric Learning, Docker CLI & Portal Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or agent-calling wave execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign ResQTrack to the Official Cherry (`#670626`) / Warm Ivory (`#F7F1EA`) / Muted Cherry (`#A83B4D`) / Soft Beige (`#E9D9D0`) Stitch UI design system, fix all biometric registration/login root causes with a real async multi-frame 5-minute AI learning worker & toast indicator, add full Docker/EF CLI tooling, execute all 17 Fixes + 11 Removals across Civilian/FIRE/MEDIC/PNP/Admin, and implement all 9 Instructor Requirements.

**Architecture:** Clean vertical slices adhering to Strategy Pattern (OCP), universal arrow lambdas (`=>`), zero `any`, zero emojis, and SQL Server 2022 + PostgreSQL Docker portability. Wave 0 locks DTO/API/CSS contracts; Wave 1 establishes failing RED unit & contract tests; Wave 2 fans out across 9 disjoint domain engineers; Wave 3 runs Playwright E2E, Root-Cause Debug & Loop Challenge; Wave 4 executes full build, tests, live server rebuild (`.\start.ps1 rebuild` + daemon verification), and visual screenshot inspection.

**Spec:** `docs/superpowers/specs/2026-11-20-cherry-ivory-stitch-biometric-overhaul-design.md`

---

## Global Constraints
- Palette: Main bg & sidebar `#670626`/`#4A041A`, elevated `.clay-surface` cards & buttons `#F7F1EA`, accents `#A83B4D`, wells/borders `#E9D9D0`, semantic rose/amber/emerald/blue tags.
- Code style: Universal arrow lambdas (`=>`), zero `function` declarations in TypeScript, zero `any`, zero Unicode emojis (`lucide-react` icons only), zero `.env*` commits.
- Security: Zero silent auto-verification on unreviewed report uploads (`ReportStatus.Reported` initial state), strict civilian self-report isolation, no `tel:` click-to-dial hotlines anywhere while preserving user-supplied personal contact numbers as stored text.

---

## Wave 1: RED TDD Baseline

### Task 1: Author Failing Backend & Contract RED Tests
**Files:**
- Modify: `Testing/Backend/SecurityAndPersistenceTests.cs`
- Create/Modify: `Testing/Frontend/VisionTests/verify_cherry_ivory_and_removals.ts`

- [ ] **Step 1: Add failing backend unit tests for new contracts**:
  1. `MultiLayerBiometricLoginStrategy_ExtractCenterImageSlice_IgnoresFrameCounts_MatchesDistinctUsers` (regression for `"frameCounts": {"CENTER": 60}` vs `"bestFrames": {"CENTER": "..."}` collision).
  2. `MultiLayerBiometricLoginStrategy_HybridClaudeUnavailable_FallsBackTo128DCosine` (proves verified/ready users don't get hard-locked by transient Claude 503).
  3. `BiometricTrainingBackgroundService_ProcessesEnqueuedEnrollment_TransitionsLearningToReady` (proves async multi-frame AI learning updates `TrainingStatus` to `"READY"`).
  4. `ReportService_CreateReport_CapturesIpAddress_AndEnforcesInitialReportedPendingStatus_EvenWithImage` (Instructor #1 & #7).
- [ ] **Step 2: Run `dotnet test "Testing/Backend/Backend.Tests.csproj" -c Release --no-restore`** and observe expected compilation / RED test failures.
- [ ] **Step 3: Create `Testing/Frontend/VisionTests/verify_cherry_ivory_and_removals.ts`** asserting `#670626` Cherry / `#F7F1EA` Warm Ivory / `#A83B4D` Muted Cherry / `#E9D9D0` Soft Beige tokens in `LayoutStyles/index.css`, absence of `tel:` links across portals, removal of banned Civilian/Responder pages/buttons (`Hotlines`, `Warnings`, `Apparatus`, `Crew Roster`, `Patrol Roster`, `Dispatches`), Civilian layout (`ENLARGE TO REDIRECT`), Admin renames (`Responders`, `Dispatch Manager`), and `"5 minutes"` biometric toast/UI indicator. Run it and observe expected RED failures.

---

## Wave 2: 9 Parallel Disjoint Domain Engineers (`/agent-calling`)

### Task 2: Backend Biometric AI & Async 5-Min Training Queue Engineer
**Files (Strict Ownership):**
- `Project system ENGINE/Backend/Features/Data/Models/BiometricEnrollment.cs`
- Create: `Project system ENGINE/Backend/Features/Services/Biometrics/BiometricTrainingBackgroundService.cs`
- Modify: `Project system ENGINE/Backend/Features/Services/Biometrics/MultiLayerBiometricLoginStrategy.cs`
- Modify: `Project system ENGINE/Backend/Features/Services/Implementations/AuthService.cs`
- Modify: `Project system ENGINE/Backend/Features/Api/Controllers/IdentityController.cs`

- [ ] **Step 1**: Add `TrainingStatus`, `TrainingStartedAtUtc`, `TrainingReadyTargetUtc`, `TrainingCompletedAtUtc`, `TrainingNotes`, `TrainedFrameCount` to `BiometricEnrollment.cs`.
- [ ] **Step 2**: Implement `IBiometricTrainingQueue` + `BiometricTrainingChannelQueue` + `BiometricTrainingBackgroundService` processing saved `PoseFramesJson` + Gov ID path asynchronously in a background `IServiceScope`, refining geometric ratios + enrollment quality score and marking `TrainingStatus = "READY"`.
- [ ] **Step 3**: Update `AuthService.RegisterWithDetailsAsync` to set `TrainingStatus = "LEARNING"`, `TrainingStartedAtUtc = UtcNow`, `TrainingReadyTargetUtc = UtcNow.AddMinutes(5)`, persist multi-pose frames immediately, and enqueue `enrollment.Id` via `IBiometricTrainingQueue`. Update `LoginResponse`/`RegisterResult` and add `GET /api/identity/biometrics/training-status?email=...` in `IdentityController.cs`.
- [ ] **Step 4**: Fix `MultiLayerBiometricLoginStrategy.ExtractCenterImageSlice` (`JsonDocument` lookup into `bestFrames`/`poses` before `ExtractCachedPoseFrames`), add lightweight metadata projection before loading `PoseFramesJson`, cap concurrency `SemaphoreSlim(3, 3)`, and add deterministic 128-D cosine fallback on transient Claude errors (`PROVIDER_UNAVAILABLE`/429/timeout).

### Task 3: Backend Reports, Instructor Patch & Schema Reconciler Engineer
**Files (Strict Ownership):**
- `Project system ENGINE/Backend/Features/Data/Models/Report.cs`
- `Project system ENGINE/Backend/Features/Services/Interfaces/IReportService.cs`
- `Project system ENGINE/Backend/Features/Services/Implementations/ReportService.cs`
- `Project system ENGINE/Backend/Features/Api/Controllers/ReportsController.cs`
- `Project system ENGINE/Backend/Features/Api/Controllers/IncidentsController.cs`
- `Project system ENGINE/Backend/Features/Api/DTOs/Requests.cs`
- `Project system ENGINE/Backend/Features/Api/DTOs/Responses.cs`
- `Project system ENGINE/Backend/Features/DBInfrastructure/StartupSchemaReconciler.cs`

- [ ] **Step 1**: Add `SubmittedIpAddress` (`MaxLength(64)`) and `ReporterContactNumber` (`MaxLength(40)`) to `Report.cs`, `CreateReportRequest`, and `ReportResponse`, plus `BiometricTrainingStatus` / `BiometricTrainingReadyTargetUtc` / `TrainedFrameCount` to `BiometricEnrollment` reconciliation in `StartupSchemaReconciler.cs` and `RegisterResponse`.
- [ ] **Step 2**: Update `ReportsController` & `IncidentsController` to capture client IP (`X-Forwarded-For` / `RemoteIpAddress`), enforce role-based visibility on `GET /api/reports` & `GET /api/incidents` (Civilians strictly see only their own reports; Responders/Admins see operational feeds), and enrich nearby available unit recommendations cleanly.
- [ ] **Step 3**: Remove auto-verification shortcut in `ReportService.CreateReportAsync` so every new upload starts with `Status = ReportStatus.Reported`, `VerifiedAt = null`, `RequiresManualVerification = true` until verified by an authorized Responder or Admin.

### Task 4: Docker Compose, EF Migrations & CLI Operations Engineer
**Files (Strict Ownership):**
- `Project system ENGINE/Backend/Program.cs`
- `Project system ENGINE/Backend/Features/DBInfrastructure/AppDbContextFactory.cs`
- `Project system ENGINE/Backend/Features/Management/Commands/CliCommandRunner.cs`
- Create: `Project system ENGINE/Backend/Migrations/20261120_InitialBaselineSchema.cs` + `AppDbContextModelSnapshot.cs` (or generated cleanly via `dotnet ef migrations add`)
- `docker-compose.yml`
- `CommandStart/manage.ps1`
- `start.ps1`

- [ ] **Step 1**: Register `IBiometricTrainingQueue` + `BiometricTrainingBackgroundService` in `Program.cs`, run `CliCommandRunner.IsCliCommand(args)` cleanly, and support `MigrateAsync` when EF migrations exist alongside safe `StartupSchemaReconciler`.
- [ ] **Step 2**: Update `AppDbContextFactory.cs` to read `.env`, `appsettings.json`, `appsettings.Development.json`, and `appsettings.Local.json`.
- [ ] **Step 3**: Add `createcustomresponder`, `createcustomcivilian`, `addmigration`, and `updatedatabase` commands to `CliCommandRunner.cs`.
- [ ] **Step 4**: Fix `docker-compose.yml` (`resqtrack-db-replica` safe profile/config) and add direct Docker + PowerShell commands in `CommandStart/manage.ps1` and `start.ps1`: `createsuperadmin`, `createcustomsuperadmin`, `createresponder`, `createcustomresponder`, `createcivilian`, `createcustomcivilian`, `addmigration`, `updatedatabase`, `up -d --build`, `cleanbuild`.

### Task 5: Global Cherry/Warm Ivory Stitch CSS, Chrome, Landing & Cleanup Engineer
**Files (Strict Ownership):**
- `Project system ENGINE/Frontend/index.html`
- All files under `Project system ENGINE/Frontend/src/LayoutStyles/**`
- `Project system ENGINE/Frontend/src/App.tsx`
- `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/LandingPage/LandingPage.tsx`
- All 7 files in `Project system ENGINE/Frontend/src/LayoutBars/**`
- `Project system ENGINE/Frontend/src/Libs/Assets/data.ts`
- `Project system ENGINE/Frontend/src/Libs/Assets/baselineFixtures.ts`

- [ ] **Step 1**: Implement the Cherry (`#670626`), Warm Ivory (`#F7F1EA`), Muted Cherry (`#A83B4D`), Soft Beige (`#E9D9D0`), and `Plus Jakarta Sans` Stitch claymorphic design system across `index.html` & `LayoutStyles/*.css`.
- [ ] **Step 2**: Repaint `LandingPage.tsx` and `LayoutBars/{Header,Sidebar,Footer,LayoutWrappers,ResponderLayout,UserSessionChip}.tsx` in Official Cherry/Warm Ivory Claymorphism; purge `5173`/`5174` port checks; remove Civilian `Hotlines` and `Warnings` routes/sidebar links; rename Civilian `Identity` -> `Profile`; update FIRE/MEDIC/PNP sidebars (`Apparatus`/`Alerts`/`Crew Roster`/`Patrol Roster`/`Dispatches` removed; `Hazmat & 2-Alarm` -> `Reports`; add `Responders` & `Request & Deploy` for FIRE/MEDIC/PNP); update Admin sidebar (`Fleet Roster` -> `Responders`, `Incidents & Triage` -> `Dispatch Manager`); route agency-scoped notifications into Notification Bell (`Header.tsx`) with Admin Warning clarification.
- [ ] **Step 3**: Purge all `tel:` links, `#hotlines` nav, `"Hotline 911"`, municipal hotline numbers in `Header.tsx`, `LandingPage.tsx`, `ResponderLayout.tsx`, `data.ts`, and `baselineFixtures.ts`.

### Task 6: Frontend Biometrics, 5-Min AI Learning Toast & Auth Pages Engineer
**Files (Strict Ownership):**
- `Project system ENGINE/Frontend/src/Libs/Cache/biometricFrameCache.ts`
- `Project system ENGINE/Frontend/src/Libs/Biometrics/claudeFacialBiometricStrategy.ts`
- `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/ManualFacialCapturePanel.tsx`
- `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage.tsx`
- `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/LoginPage/{LoginPage,AdminLoginPage,Login,BiometricLoginModal}.tsx`
- `Project system ENGINE/Frontend/src/Endpoints/{authEndpoints,authApi}.ts`

- [ ] **Step 1**: Fix `biometricFrameCache.ts` (`CENTER` vector preservation when valid frontal face present; save top multi-frame shots per pose `CENTER`/`LEFT`/`RIGHT`/`BLINK`).
- [ ] **Step 2**: Update `RegisterPage.tsx` to display the 5-minute AI learning toast + post-registration reminder (`"Account and facial frames saved. AI is training on your poses & ID — please wait up to 5 minutes before biometric login"`).
- [ ] **Step 3**: Update `BiometricLoginModal.tsx` with optical blur sharpness gate (`>= 35`), warm-up frames (`>= 6` frames), 5-min AI training status indicator polling `/api/identity/biometrics/training-status`, and Cherry/Warm Ivory Stitch claymorphic styling across `LoginPage`, `AdminLoginPage`, `RegisterPage`, `ManualFacialCapturePanel`, and `BiometricLoginModal`.

### Task 7: GIS Map Indicator Icons & Shared Claymorphic Components Engineer
**Files (Strict Ownership):**
- All files under `Project system ENGINE/Frontend/src/Shared/**`

- [ ] **Step 1**: Refactor `radarPointerCategories.ts` & `SatelliteCommandMap.tsx` to eliminate hardcoded teal fills (`L821`, `L919`), Unsplash strings, and fake IPs, rendering distinct vector SVG icons for:
  - Car/Vehicular Crash, Homicide/Weapon/Knife/Pistol Threat, Burning House/Structural Fire, Medical/Flood hazards
  - Responders & Emergency Vehicles (`FIRE`, `RHU`, `PNP`, `LDRRMO`)
  - Dispatch destination pins & nearby available standby units with distance badges
- [ ] **Step 2**: Remove all `BackupOptionsModal` `"Hotline / Call Now"` functions (`Option 3`), remove `{u.contactHotline}` display in `DeployRespondersModal`, repaint all Shared components/modals/charts (`Charts/*`, `Button`, `Dropdown`, `SearchBar`, `CameraCaptureModal`, `DeployRespondersModal`, `PatientCareRecordModal`, `PoliceBlotterModal`, etc.) into Warm Ivory `#F7F1EA` / Soft Beige `#E9D9D0` / Cherry `#670626` Stitch claymorphism, and ensure `CameraCaptureModal.tsx` honors blur verification flag without forcing `requiresManualVerification: false`.

### Task 8: Civilian Portal Overhaul Engineer
**Files (Strict Ownership):**
- All files under `Project system ENGINE/Frontend/src/UserRoles/Features/Pages/CiviliansPanel/**`

- [ ] **Step 1**: Remove `EmergencyHotlinesUnits.tsx`, `EmergencyNumbersPage.tsx`, `View All (25)` floating banner, `My Active Emergency Submissions (14)`, `Nearest Stations`, `Emergency Hotlines` strips, `sms:` hotline links, `Active & Dispatched` cards in `MyReportsHistory.tsx`, and `Emergency Stations` list in `CivilianLiveMapPage.tsx`.
- [ ] **Step 2**: Re-layout `CivilianDashboard.tsx` with **Evacuation Safe Zones Map on the Left** and **Report Emergency Card on the Right** + **`ENLARGE TO REDIRECT`** button navigating to `/civilian/live-map` (fluid responsive).
- [ ] **Step 3**: Enforce user-only report filtering on `MyReportsHistory.tsx` (`GET /api/reports/mine`), render `"My Reports"` newest-to-oldest descending on `CivilianLiveMapPage.tsx` with click redirect to `/civilian/my-reports`, add status progression pills (`Submitted`, `Pending`, `Verified`, `Dispatched`, `Resolved`, `Rejected`), allow optional user personal contact number input on `CivilianProfile.tsx` & `ReportAccidentPage.tsx` (plain text only, zero `tel:`), and apply Stitch Warm Ivory claymorphism on Deep Cherry canvas.

### Task 9: Responder Portals (`FIRE`, `MEDIC/RHU`, `PNP`) Engineer
**Files (Strict Ownership):**
- All files under `Project system ENGINE/Frontend/src/UserRoles/Features/Pages/RespondersPanel/**`
- `Project system ENGINE/Frontend/src/Endpoints/responderOpsApi.ts`

- [ ] **Step 1**: Build/update dedicated unit-scoped views inside `RespondersPanel/`:
  - **`Responders` Leaderboard (`DutyRosterView.tsx` refactored cleanly per unit)**: lists ONLY `OnDuty` / `Dispatched` personnel matching the signed-in unit (`FIRE`, `RHU`, or `PNP`), ranked by response/succession rate. Remove old `Crew Roster` / `Patrol Roster` hotlines and `tel:` links.
  - **`Request & Deploy` (`RequestDeployPage.tsx`)**: filters & displays requests strictly for the active unit (`FIRE`-only for Fire, `RHU`-only for Medic, `PNP`-only for Police).
  - **`Reports` / `UnitIncidentsFeed.tsx` (`MyReportsPage.tsx`)**: FIRE `"Hazmat & 2-Alarm"` renamed to `"Reports"`; remove `Option 3 Call Dispatch` / `backupPhone` / `tel:` links across `RespondersPanel/` + remove external Unsplash URLs & `Apalit`/`San Mateo`/`Dipolog` fallbacks.
  - Ensure initial `Submitted`/`Pending` incident status review actions (`Verify` / `Reject` / `Dispatch`) work cleanly for authorized Responders.
- [ ] **Step 2**: Repaint all `RespondersPanel` pages & modals in Cherry / Warm Ivory / Soft Beige Stitch claymorphism with responsive mobile support.

### Task 10: LDRRMO Admin Portal Overhaul Engineer
**Files (Strict Ownership):**
- All files under `Project system ENGINE/Frontend/src/UserRoles/Features/Pages/AdminsPanel/**`

- [ ] **Step 1**: Rename labels cleanly (`RespondersRosterPage.tsx` -> `"Responders"`, `IncidentsPage.tsx` -> `"Dispatch Manager"`), clarify Warning notices inside `AlertsCenter.tsx`, surface **Auto-Dispatch Nearest Available Units** inside `IncidentsPage.tsx` & `AdminDashboard.tsx` (Instructor #8), and enforce full lifecycle status actions (`Submitted`, `Pending`, `Verified`, `Dispatched`, `Resolved`, `Rejected`).
- [ ] **Step 2**: Remove all `contactHotline` / `911 Central Hotline` displays, Dipolog/San Mateo fallbacks, Unsplash URLs, and unused unrouted legacy Admin files (`DashboardPage.tsx`, `IncidentsBoard.tsx`, `RespondersRoster.tsx`, `SystemSettings.tsx`, `UserGovernance.tsx` after verifying zero imports).
- [ ] **Step 3**: Redesign `AdminDashboard.tsx` and all `AdminsPanel/` pages to match the Stitch Executive Command Dashboard & Geospatial HUD (`#F7F1EA` `.clay-surface` cards on `#4A041A`/`#52051D` backdrop, `.clay-well` `#E9D9D0` tables/filters, `.clay-button-cherry` `#670626` actions, dynamic chart axes & audit pagination preserved).

---

## Wave 3 & Wave 4: Integrated Verification, Live Server Build & Visual Review

### Task 11: Integrated Build, Unit Tests, Docker Compose & Playwright E2E
- [ ] **Step 1**: Run `dotnet test "Testing/Backend/Backend.Tests.csproj" -c Release --no-restore` (100% pass).
- [ ] **Step 2**: Run `npx tsc --noEmit` and `npm --prefix "Project system ENGINE/Frontend" run build` (exit code `0`).
- [ ] **Step 3**: Run `docker compose config` and verify all Dockerfiles/CLI commands parse cleanly (`.\start.ps1 status` / `CommandStart/manage.ps1` static check).
- [ ] **Step 4**: Run Vision audits (`verify_cherry_ivory_and_removals.ts`, `verify_fast_ocr_and_hybrid_login.ts`) + comprehensive Playwright E2E across all portals (`Desktop 1366x860` & `Mobile 390x844`) capturing screenshots of Landing, Login/Biometric Modal, Admin (`Responders` & `Dispatch Manager`), Fire/Medic/PNP Responder, and Civilian (`Evacuation Safe Zones` left + `Report Emergency` right + `ENLARGE TO REDIRECT`). Inspect every screenshot via `read_file` and fix any visual overlap or regression until 100% green.
- [ ] **Step 5**: Cleanly rebuild and start live 4-port dev servers via `.\start.ps1 rebuild` + `Backend` & `Frontend` daemons so the running stack reflects all changes.

---

### Plan Self-Review Check
- Covers every requirement from Spec `2026-11-20-cherry-ivory-stitch-biometric-overhaul-design.md` with zero placeholders (`TBD`/`TODO` absent).
- Strict non-overlapping file ownership across all 9 Wave 2 tasks — zero two concurrent engineers share a file.
- Exact DTO/field/method names verified from prior file reads (`BiometricEnrollment`, `Report`, `CreateReportRequest`, `ReportResponse`, `ReportsController`, `IncidentsController`, `StartupSchemaReconciler`, `CliCommandRunner`).
