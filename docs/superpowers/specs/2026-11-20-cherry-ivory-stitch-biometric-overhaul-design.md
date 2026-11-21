# ResQTrack Official Cherry/Warm Ivory Stitch Overhaul, Biometric Async Learning, Docker CLI, Portal Cleanup & Instructor Patch Specification

**Date:** 2026-11-20  
**Classification:** Architectural Overhaul  
**Status:** Pending User Review (`superpowers:brainstorming`)  
**Reference Stitch Directory:** `SAMPLE FILES/stitch_resqtrack_emergency_response_ui`  

---

## 1. Purpose & Scope

This specification defines an end-to-end architectural and visual overhaul of the ResQTrack Incident AI System Detection platform across all five core pillars:

1. **Official Cherry & Warm Ivory Stitch Design System (Priority 1)**: Repaint and redesign the entire React/TypeScript frontend (Landing, Login/Register, Admin `:1996`, Responders `:1997`, Civilians `:1998`, Shared UI & GIS HUDs) using the Official ResQTrack Color Palette harmonized with `SAMPLE FILES/stitch_resqtrack_emergency_response_ui`.
2. **Async Multi-Frame Biometric Database Persistence, 5-Min AI Learning Pipeline & Login Root-Cause Fixes**: Fix all five root causes preventing newly registered users from logging in via facial recognition (even after waiting 5 minutes), persist captured frames/poses to SQL Server, queue an asynchronous background AI learning worker (`IBiometricTrainingQueue` + `BiometricTrainingBackgroundService`), and display a `"Please wait up to 5 minutes for AI facial learning"` toast + status indicator after registration.
3. **Docker Compose & CLI Operations Fixes**: Fix EF Core design-time factory configuration (`AppDbContextFactory.cs`), migration/startup ordering (`Program.cs`), replica DB startup/health, and add `docker compose` / PowerShell commands (`createsuperadmin`, `createcustomsuperadmin`, `createresponder`, `createcustomresponder`, `createcivilian`, `createcustomcivilian`, `addmigration`, `updatedatabase`, `up -d --build`, `cleanbuild`).
4. **Portal Feature Additions, Renames & Removals (`FIX & ADJUST #1-#17` and `REMOVING #1-#11`)**: Restructure Civilian, FIRE, RHU Medic, PNP, and LDRRMO Admin modules/menus, add role-scoped `Responders` leaderboard and `Request & Deploy` views, route agency alerts into the notification bell, upgrade `SatelliteCommandMap` markers, and strip all municipal hotlines, `tel:` links, and calling dialogs.
5. **Instructor Patch Requirements (`#1-#9`)**: Capture mobile/client IP address on incident submission, enforce role-scoped uploaded incident visibility, enforce `Submitted`/`Pending` initial status (no auto-verification bypass on camera capture), support personal contact number storage (without hotline calling), clarify Emergency Warning semantics (Admin Broadcast -> Notification Bell), wire nearby available responder recommendations into auto-dispatch, and render distinct map marker icons for incidents, responders, vehicles, dispatch sites, and nearby available units.

---

## 2. Official Color Palette & Stitch Design System Architecture

### 2.1 Color Token Hierarchy (Cherry & Warm Ivory Core)
All legacy dark-slate (`#020617` / `slate-950` / blue-glass) tokens are superseded by the Official Cherry & Warm Ivory system derived from `DESIGN.md` and the Stitch HTML sources:

| Token | Hex | RGB / CMYK | Role & Application |
|---|---|---|---|
| **Cherry (Primary)** | `#670626` | `103, 6, 38` / `0, 94, 63, 60` | Main canvas anchor (`#4A041A`/`#52051D`/`#670626`), sidebar navigation (`#400014`–`#670626`), active CTA pill fill on cream cards, primary text & icons on Warm Ivory surfaces |
| **Warm Ivory (Secondary)** | `#F7F1EA` | `247, 241, 234` / `0, 2, 5, 3` | Primary `.clay-surface` dashboard containers, floating GIS HUD panels, modal surfaces, primary buttons, and main ink text on Cherry backgrounds |
| **Muted Cherry (Tertiary)** | `#A83B4D` | `168, 59, 77` / `0, 65, 54, 34` | Secondary accents, chart strokes, active borders/rings, tags/chips, hover highlights (`inverse-primary`) |
| **Soft Beige (Supporting)** | `#E9D9D0` | `233, 217, 208` / `0, 7, 11, 9` | Consolidates Stitch beige sub-tones (`#F3ECE2`, `#EFE6DC`, `#EDE4D8`, `#ECE2D6`): recessed wells, input fields, search docks, table alternating strips, track backgrounds, subtle card highlights/borders |
| **Cream Highlight** | `#FAF5EE` | `250, 245, 238` | Elevated sub-cards inside `.clay-surface` containers (`.clay-surface-cream`) |
| **Deep Crimson Canvas** | `#4A041A` / `#52051D` | — | Desktop/mobile scrolling background backdrop underneath Warm Ivory clay cards |
| **Primary Dark Ink (on Ivory)** | `#2B010E` / `#670626` | — | High-contrast body/heading ink on `#F7F1EA` cards |
| **Soft Blush Ink (on Cherry)** | `#FFD9DD` / `#F7F1EA` | — | Readable ink & active badges on `#4A041A`/`#670626` surfaces |

### 2.2 Semantic Status Tokens (Maintained Consistently Across Portals)
- **Critical / Code Red / Fire**: `rose-700` / `#93000A` text & border on `rose-100` pill (or `#FFB4AB` / `#93000A` on Cherry dark surfaces)
- **Warning / Caution / Triage Yellow**: `amber-800` / `#5F3F19` on `amber-100` (or `#F4C088` on dark surfaces)
- **Verified / Safe / Dispatch Ready**: `emerald-800` on `emerald-100`
- **PNP / Telemetry Info / Triage Blue**: `blue-700` / `sky-700` on `blue-100`

### 2.3 Claymorphic Elevation, Typography & Responsiveness
- **Font Family**: `'Plus Jakarta Sans', system-ui, sans-serif` (paired with monospace for CAD IDs, GPS coords, IP addresses, and telemetry metrics). Minimum UI readable floor `>= 12px` labels, `14px–15px` body/inputs, `18px–32px` headings.
- **Clay Surface Utilities** (in `LayoutStyles/index.css` & component styling):
  - `.clay-surface`: `background: #F7F1EA; border-radius: 1.25rem; box-shadow: 0 14px 28px rgba(43,1,14,0.32), 0 6px 12px rgba(0,0,0,0.18), inset 2px 2px 4px rgba(255,255,255,0.85), inset -2px -2px 4px rgba(200,185,175,0.3);`
  - `.clay-surface-cream`: `#FAF5EE` elevated sub-cards
  - `.clay-well` / `.clay-beige`: `#E9D9D0` recessed input/metric wells (`inset 1.5px 1.5px 3px rgba(103,6,38,0.12), inset -1.5px -1.5px 3px rgba(255,255,255,0.75)`)
  - `.clay-button-cherry`: `#670626` background with `#F7F1EA` text and soft crimson highlight/shadow
  - `.clay-button-ivory`: `#F7F1EA` background with `#670626` text and `#E9D9D0` underside shadow
  - `.clay-dock`: mobile bottom navigation bar (`rgba(64, 0, 20, 0.92)` with `backdrop-filter: blur(16px)` and `#A83B4D` border hairline)
- **Stitch Screen Mimicry Mapping**:
  - **Admin Dashboard (`AdminDashboard.tsx`) & Shared Command Layout**: Adopts the Stitch Executive Command Dashboard rhythm (fixed Cherry sidebar `w-72` with bottom system status card -> frosted Cherry topbar -> top Warm Ivory command bar -> 4-col Warm Ivory KPI cards -> 7/5 GIS Map & Fleet Readiness + Live Incident Stream & Weather/System Advisories).
  - **GIS Map Pages (`StrategicMapPage.tsx`, `CivilianLiveMapPage.tsx`, `ResponderDashboard.tsx`)**: Full-bleed Leaflet/Esri GIS map framed with floating `#F7F1EA` Warm Ivory clay HUD inspector/filter pills, zoom/layer dock, and zero clipping across desktop & mobile (`useFluidResposiveness`).
  - **Mobile Viewports**: Uses collapsible drawer + fixed `.clay-dock` bottom navigation with crisp touch targets (`>= 44px`).
- **Constraints**: Zero `any`, zero `function` declarations (arrow functions `=>` everywhere), zero Unicode emojis (`lucide-react` icons only), clean elimination of stale `:5173`/`:5174` port refs, external Unsplash URLs, and non-Katipunan city fallbacks (`Apalit`, `San Mateo`, `Dipolog`).

---

## 3. Biometric 5-Minute Persistence, Async AI Learning & Login Fixes

### 3.1 Root Causes Eliminated (Verified in Audit)
1. **Json Key Match Bug in `MultiLayerBiometricLoginStrategy.ExtractCenterImageSlice`**: Currently calls `IndexOf("\"CENTER\"")` which matches `"frameCounts": {"CENTER": 60, ...}` *before* `"bestFrames": {"CENTER": "data:image/..."}`, returning `"5:RIGHT"` for all pose-equipped users. Fix: Parse JSON (`JsonDocument` or `ExtractCachedPoseFrames`) directly from `bestFrames`/`poses` container so distinct users never collide during `1:N` deduplication.
2. **Zero Cosine Fallback on Hybrid Errors**: In `ExecuteHybridVerificationAsync` (1:1 and 1:N), if Claude Vision returns `PROVIDER_UNAVAILABLE`, `429` rate limit, timeout, or transient failure, fail gracefully to `ExecuteDeterministicVerification` (multi-pose 128-D cosine similarity `>= 0.82` + local liveness score `>= 0.70`) for enrolled templates while still rejecting true `LIVENESS_SPOOF_REJECTED`.
3. **1:N Concurrency Saturation & Full Table Blob Pull**: `SelectTopKPoseCandidates` triggers up to 6 simultaneous multi-image Claude calls and pulls `NVARCHAR(MAX)` `PoseFramesJson` for every DB row. Fix: Project metadata first (`Id`, `UserId`, `EnrolledAtUtc`, `EncryptedTemplateData`, `GeometricSignatureJson`, `DescriptorVectorJson`), rank/deduplicate lightweight metadata first, fetch `PoseFramesJson` only for top `K = 8` distinct candidates, and cap concurrent Claude calls to `SemaphoreSlim(3, 3)`.
4. **Blurry 83ms Frame Capture on Login (`BiometricLoginModal.tsx`)**: `scanProgress` advances `+22` per animation frame (~83ms total) with zero blur variance check or exposure warm-up. Fix: Require minimum `6` centered frames (~300ms warm-up) with Laplacian sharpness variance check (`variance >= 35`) and non-zero skin oval coverage before firing `/api/biometric-login`, plus keep retry count unbounded/resettable without artificial terminal freezes.
5. **Profile-Only 128-D Skew & Pending Account Block (`biometricFrameCache.ts` + `ManualFacialCapturePanel.tsx` + `AuthService.cs`)**:
   - Store **normalized frontal `CENTER` + averaged multi-frame `128-D` descriptor** cleanly (never let `RIGHT`/`LEFT` profile yaw overwrite `CENTER` at 100% weight when `CENTER` JPEG re-decode passes oval geometry).
   - Never fall back silently to `generateDeterministicBiometricVector(email)` when real webcam frames exist.

### 3.2 Real Async Multi-Frame Persistence & 5-Minute AI Learning Pipeline
1. **Capture & Persisted Frame Bundle (`BiometricEnrollment` Schema Extension)**:
   - Frontend `ManualFacialCapturePanel.tsx` sends top **multi-second sampled frames** (up to `3` sharpest frames each for `CENTER`, `LEFT`, `RIGHT`, `BLINK` = up to `12` frames compressed at `320x240` JPEG `0.78`) alongside client descriptor vector, user PII, and Front/Back Gov ID.
   - `AuthService.RegisterWithDetailsAsync` immediately writes:
     - `BiometricEnrollment.EncryptedTemplateData` (normalized initial 128-D `CENTER` float vector) & `PoseFramesJson` (persisted immediately to SQL Server so zero frames are lost when client `biometricFrameCache.clear()` runs!)
     - New tracking columns on `BiometricEnrollment` (`TrainingStatus`: `'LEARNING'` / `'READY'` / `'FAILED'`, `TrainingStartedAtUtc`, `TrainingReadyTargetUtc = EnrolledAtUtc.AddMinutes(5)`, `TrainingCompletedAtUtc`, `TrainingNotes`, `TrainedFrameCount`).
2. **Hosted Background AI Training Worker (`IBiometricTrainingQueue` + `BiometricTrainingBackgroundService`)**:
   - Uses `System.Threading.Channels.Channel<Guid>` hosted as a Singleton `.NET` `IHostedService` (`BackgroundService`).
   - On `RegisterWithDetailsAsync`, enqueues the new `BiometricEnrollment.Id`.
   - Worker opens an `IServiceScope`, loads the saved multi-pose frames (`CENTER`, `LEFT`, `RIGHT`, `BLINK`) + linked `User` details + Gov ID front image (`IdCapturePath`), calls Claude Vision / geometric analyzer + multi-frame descriptor refinement to study oval centering, yaw `[-25deg, +25deg]`, EAR blink delta, and ID face consistency, updates `BiometricEnrollment` (`TrainingStatus = "READY"`, `TrainingCompletedAtUtc`, `EnrollmentQualityScore`, refined `GeometricSignatureJson`), and logs an `AuditLog` (`BIOMETRIC_AI_TRAINING_COMPLETED`).
   - Also provides `GetBiometricTrainingStatusAsync` (`GET /api/identity/biometrics/training-status?email=...`) so UI can inspect readiness.
3. **5-Minute UI & Toast Indicators**:
   - **Registration Toast & Phase 5 Confirmation (`RegisterPage.tsx`)**: Immediately after registration succeeds, trigger a prominent toast banner + inline confirmation notice stating:  
     `"Account & facial frames saved to database. AI training is processing your oval, left, right, blink poses & ID details — please wait up to 5 minutes before signing in via Biometric Login."`
   - **Biometric Login Modal Indicator (`BiometricLoginModal.tsx`)**: Show an informative status chip/banner during/after recent enrollment (`"AI facial learning in progress — please allow up to 5 minutes after registration if this is your first scan"` + live readiness badge when `email` is entered), while permitting login immediately as soon as `TrainingStatus == "READY"` (or via refined vector check if worker finishes early, avoiding an artificial lock once trained!).

---

## 4. Docker Compose & CLI Operational Tooling Fixes

### 4.1 Root Fixes
1. **`AppDbContextFactory.cs`**: Load `.env`, `appsettings.json`, `appsettings.Development.json`, and `appsettings.Local.json` so `dotnet ef migrations add` and `dotnet ef database update` work out of the box both locally and inside Docker containers.
2. **`Program.cs` CLI Dispatch Order**: Inspect `CliCommandRunner.IsCliCommand(args)` for schema/user management commands cleanly, ensuring `migrations`/`updatedatabase` commands invoke `db.Database.MigrateAsync()` instead of skipping EF migration history via `EnsureCreatedAsync` when migrations exist, and generate an initial clean EF Core baseline migration (`Migrations/InitialCreate.cs`) compatible with both SQL Server and PostgreSQL.
3. **`docker-compose.yml` + `start.ps1` / `CommandStart/manage.ps1`**:
   - Parameterize `resqtrack-db-replica` cleanly (profile or working Postgres service without broken silent replication errors) and add a dedicated `profiles: ["tools"]` one-shot `resqtrack-backend-cli` / helper targets inside `manage.ps1` + root helper wrapper commands so users can run:
     - `docker compose up -d --build` (`docker` / `docker-build`)
     - `docker compose down && docker compose build --no-cache && docker compose up -d` (`docker-cleanbuild` / `docker-rebuild`)
     - `createsuperadmin`, `createcustomsuperadmin`, `createresponder`, `createcustomresponder`, `createcivilian`, `createcustomcivilian`
     - `addmigration <Name>`, `updatedatabase` (all executable both on local host AND via `docker compose exec` / `docker compose run --rm resqtrack-backend ...`!).
   - Verify `Backend.csproj` EF Core package versions cleanly compile on both local Windows `.NET 10` and `mcr.microsoft.com/dotnet/sdk:10.0` Docker Linux containers.

---

## 5. Portal-by-Portal Changes, Removals & Instructor Requirements

### 5.1 Cross-Cutting Removals & Map Marker Overhaul
- **Hotline / Calling Purge (`REMOVING #11` + Instructor `#5` resolution)**:
  - **Remove completely**: `/civilian/hotlines` route (`App.tsx`), `EmergencyHotlinesUnits.tsx`, `EmergencyNumbersPage.tsx`, `Sidebar.tsx` Hotlines nav item, `LandingPage.tsx` `#hotlines` nav link, hero/agency hotline numbers & `<a href="tel:...">` links, `ResponderLayout.tsx` `"Hotline 911"` chip, `Header.tsx` hotline numbers in alert dialog, `CivilianDashboard.tsx` hotline strip & `sms:` hotline trigger, `CivilianLiveMapPage.tsx` emergency hotlines card & `tel:` buttons, `BackupOptionsModal.tsx` Option 3 `"Direct Hotline / Call Now"`, `UnitIncidentsFeed.tsx` Option 3 Call Dispatch / `backupPhone`, `DutyRosterView.tsx` `contactHotline` display & `tel:` dial links, `RespondersRosterPage.tsx` / `StrategicMapPage.tsx` `"911 Central Hotline"` & `contactHotline` cells, and fallback `contactHotline` strings in fixtures/API DTOs where displayed as hotlines.
  - **Keep solely as stored personal text (Instructor #5)**: Personal `phoneNumber` / `emergencyContactNumber` text fields in registration, Civilian Profile (`CivilianProfile.tsx`), Responder Profile (`ResponderProfile.tsx`), and Incident Report forms so users can register/provide their own contact number for responder record coordination (rendered strictly as plain text/input, zero `tel:` click-to-dial links and zero municipal hotline directories).
- **Distinct Map Indicator Icons (`FIX #1` + Instructor `#9`) in `SatelliteCommandMap.tsx` & `radarPointerCategories.ts`**:
  - Remove hardcoded teal circle fills at `L821` and `L919`!
  - Render crisp category/role-specific SVG badges & colored tactical pointers:
    - **Car / Vehicular Accident**: Red/Amber pointer with car collision SVG badge
    - **Homicide / Armed / Violence / Knife / Pistol Threat**: Deep crimson danger pointer with blade/crosshair weapon threat SVG badge
    - **Fire / Burning Home / Structure Fire**: Flame-orange pointer with burning house/fire SVG badge
    - **Medical / Trauma / Flood / Other**: Distinct triage-colored SVG icons (cross, wave, medical kit, hazard triangle)
    - **Responders & Emergency Vehicles**: Distinct Agency-colored vehicle/personnel markers (FIRE firetruck crimson-orange, RHU ambulance sky/rose, PNP cruiser royal blue, LDRRMO command unit)
    - **Dispatch Locations & Nearby Available Units**: Highlighted dispatch destination beacon (`Pending` / `Dispatched` route target) and green-ringed `Standby / Available` nearby unit markers with Haversine distance badges.

### 5.2 Civilian Portal (`CiviliansPanel/`)
- **Renames**: Menu label `"Identity"` -> `"Profile"` (`Sidebar.tsx`, route alias preserved or `/civilian/profile`).
- **Removals (`REMOVING #1, #2, #3, #4`)**:
  - Remove `View All (25)` floating modal banner (`REMOVING #1`).
  - Remove `My Active Emergency Submissions (14)`, `Nearest Stations`, `Emergency Hotlines`, `Warnings` menu/page (`CommunityAlertsPage.tsx` nav/route), `Hotlines` menu/page (`REMOVING #1, #2`).
  - In **My Reports** (`MyReportsHistory.tsx`): Remove `"Active & Dispatched"` summary tabs/counters & connections (`REMOVING #3`), and strictly filter to show **only reports submitted by the currently authenticated resident account** (`FIX #4`, enforcing UserId scoping on `/api/reports/my` as well!).
  - In **Live Map** (`CivilianLiveMapPage.tsx`): Remove `"Emergency Stations"` list & API/UI bindings (`REMOVING #4`). Render `"My Reports (N)"` strictly **newest-to-oldest (descending by `CreatedAt`)** with timeline item click redirecting to `/civilian/my-reports` (`FIX #5`).
- **Layout Realignment (`FIX #3`)**: On `CivilianDashboard.tsx`, place **Evacuation Safe Zones Map** cleanly on the **left** column and move **Report Emergency** card cleanly to the **right** column, adding a tactile button labeled **`ENLARGE TO REDIRECT`** that navigates directly to `/civilian/live-map` (fluid responsive stacking on mobile).
- **Instructor #6 Warning Clarification**: Clarify explicitly in Admin `AlertsCenter` & Notification Bell drawer tooltips that **"Warnings"** are **LDRRMO Official Emergency Advisories & Hazard Notifications** broadcast via the top Notification Bell (no standalone Civilian Warnings page).

### 5.3 Responder Portal (`RespondersPanel/` — `FIRE`, `MEDIC/RHU`, `PNP`)
- **FIRE Unit (`FIX #6, #7, #8, #11` + `REMOVING #5, #7`)**:
  - Sidebar Menu: Remove `"Apparatus"` and `"Alerts"` (`REMOVING #5, #7` + routes/APIs); rename `"Hazmat & 2-Alarm"` -> **`Reports`** (`FIX #6`); add **`Responders`** (live FIRE roster filtering `OnDuty`/`Dispatched` firefighters ranked by response/succession rate, `FIX #7`) and **`Request & Deploy`** (scoped strictly to **FIRE responders only**, `FIX #8`).
  - Notifications (`Header.tsx`): Route **FIRE incident notifications** into the Notification Bell scoped strictly to `FIRE` (`FIX #11`).
- **MEDIC (`RHU`) Unit (`FIX #9, #10, #12` + `REMOVING #6`)**:
  - Sidebar Menu: Remove `"Crew Roster"` (`REMOVING #6` + dead connections); add **`Responders`** (RHU medics `OnDuty`/`Dispatched` ranked by response/succession rate, `FIX #10`); update **`Request & Deploy`** (`RequestDeployPage.tsx`) to display/filter **MEDIC (`RHU`) responders only** (`FIX #9`).
  - Notifications (`Header.tsx`): Route **MEDIC incident notifications** into the Notification Bell scoped strictly to `RHU` (`FIX #12`).
- **PNP Unit (`FIX #13, #14, #15` + `REMOVING #8, #9, #10`)**:
  - Sidebar Menu: Remove `"Alerts"`, `"Patrol Roster"`, and `"Dispatches"` (`REMOVING #8, #9, #10`); add **`Responders`** (PNP officers `OnDuty`/`Dispatched` ranked by response/succession rate, `FIX #15`) and **`Request & Deploy`** scoped strictly to **PNP responders only** (`FIX #14`).
  - Notifications (`Header.tsx`): Route **PNP incident notifications** into the Notification Bell scoped strictly to `PNP` (`FIX #13`).

### 5.4 LDRRMO Admin Portal (`AdminsPanel/`)
- **Menu & Route Renames (`FIX #16, #17`)**:
  - Rename sidebar `"Fleet Roster"` -> **`Responders`** (`FIX #16`).
  - Rename sidebar `"Incidents & Triage"` -> **`Dispatch Manager`** (`FIX #17`).
- **Dead Legacy Cleanup**: Consolidate or remove stale unrouted duplicates (`DashboardPage.tsx`, `IncidentsBoard.tsx`, `RespondersRoster.tsx`, `SystemSettings.tsx`, `UserGovernance.tsx`) and remove leftover Dipolog/San Mateo/Apalit fallbacks and Unsplash URLs.

### 5.5 Incident Pipeline & Instructor Requirements (`#1-#9`)
- **Report Creation & Verification (`Report.cs`, `CreateReportRequest`, `ReportsController.cs`, `IncidentsController.cs`, `ReportService.cs`, `CameraCaptureModal.tsx`, `ReportAccidentPage.tsx`)**:
  1. Capture client/mobile IPv4/IPv6 IP (`HttpContext.Connection.RemoteIpAddress` + `X-Forwarded-For`) into `Report.SubmittedIpAddress` (masked/visible appropriately to authorized personnel).
  2. Accept user `ReporterContactNumber` (personal mobile/contact text field — not hotline dialer).
  3. **Initial Status = `Submitted` (`ReportStatus.Reported` / `Pending` review)**: Remove auto-verification shortcut when `ImageDataUrl` is supplied (`ReportService.cs:31-37` and `CameraCaptureModal.tsx:328`). A Responder or LDRRMO Admin must explicitly verify (`Verified` -> `Dispatched` -> `Resolved` / `Rejected`) before progression.
  4. **Role-Scoped Report Visibility**: `GET /api/reports/my` strictly filters `r.ReporterId == currentUserId`; `GET /api/reports` enforces civilian isolation (civilians only view their own submissions + public safe zone metadata, while authorized Responders/Admins view operational incident feeds).
  5. **Nearby Available Auto-Dispatch (`Instructor #8`)**: Wire `ClaudeAutoDispatchResponderStrategy` directly into `Dispatch Manager` (`IncidentsPage.tsx` / `DeployRespondersModal.tsx`) and report inspection panels so administrators/responders immediately see nearest available units sorted by Haversine distance (`km`), ETA, and workload fairness, with 1-click Auto-Dispatch assignment.
  6. **Full Lifecycle Statuses (`Instructor #4`)**: Support clean UI & backend mapping across `Submitted` (`Reported`), `Pending` (pending verification), `Verified`, `Dispatched`, `Resolved`, and `Rejected`.

---

## 6. Verification & Multi-Agent Delivery Gate

Once this specification is approved:
1. We will author the wave-exact implementation plan (`docs/superpowers/plans/2026-11-20-cherry-ivory-stitch-biometric-overhaul-plan.md`) via `/superpowers:writing-plans` with a strict Disjoint File Ownership Matrix across **Wave 1 (RED TDD)** -> **Wave 2 (8–10 Parallel Domain Engineers via `/agent-calling`)** -> **Wave 3 (E2E, Root-Cause Debug & Loop Gate)** -> **Wave 4 (Full Build, `dotnet test`, `vite build`, Docker compose validation, Playwright multi-portal screenshot visual audit)**.
2. All 4 running dev ports (`1996..1999`) will be rebuilt cleanly after completion and verified live with Playwright visual screenshots across Desktop & Mobile viewports.

---

### Spec Self-Review Check
- Zero placeholders (`TBD`/`TODO` absent)
- All 17 Fix & Adjust items, 11 Removing items, 9 Instructor items, 2 Finding Issues items, Biometric 5-min persistence/learning + login fixes, and Cherry/Warm Ivory + Stitch UI redesign explicitly mapped to verified file paths and symbols.
- All 4 user clarification answers integrated consistently with zero contradictions.
