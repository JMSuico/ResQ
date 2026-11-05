# ID Scanner Frame Freeze, Laser Scan Line Animation, Biometric Active Liveness, and Hybrid Pinpoint Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automatic frame freezing and laser scan sweep animation during optical ID acquisition, eliminate non-card false positives, auto-populate all 10 Philippine Driver's License fields into the review form, integrate active biometric liveness detection (head turn yaw & eye blink EAR), and deploy hybrid pinpoint geolocation cross-verification across Civilian, Admin, and Responder portals.

**Architecture:** A stateful optical capture session freezes uncompressed camera frames upon reaching 100% temporal stability (`freezeCaptureSession`), displaying a glowing laser scan animation (`startScanAnimation`) while high-resolution perspective rectification and OCR decoding execute (`decode`). Active biometric liveness enforces biological gestures (horizontal yaw $\ge 15^\circ$, eye aspect ratio $< 0.18$), while emergency incident reporting fuses HTML5 high-accuracy GPS hardware sensors with server-side TCP/IP connection envelopes to detect spoofing.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS, Lucide React, HTML5 Canvas 2D / Web Workers, ASP.NET Core (.NET 10), Microsoft SQL Server 2019 Developer Edition (`ResQTrackDb`).

**Spec:** `docs/superpowers/specs/2026-11-05-id-framefreeze-laser-scan-active-liveness-and-hybrid-location-design.md`

## Global Constraints
- Strict TypeScript with ZERO `any`.
- Universal expression-bodied lambdas (`=>`).
- Port isolation: LDRRMO Admin exclusively on `:5174`, Responders on `:5173`, Civilian SOS on `:5175`.
- Incident reporting accepts only live camera feeds with coordinates burned into the canvas watermark (no file uploads).

---

### Task 1: Frame Freeze Engine & Laser Scan Line Animation Overlay

**Files:**
- Create: `Frontend/src/Components/Vision/LaserScanOverlay.tsx`
- Modify: `Frontend/src/Libs/Vision/idScanner/idScanEngine.ts`
- Modify: `Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage.tsx`
- Test: `Frontend/src/Libs/Vision/idScanner/__tests__/idScanEngine.test.ts`

**Interfaces:**
- Consumes: `TemporalStabilityState.isLocked`, `HTMLVideoElement`, `FrameAnalysisResult`
- Produces: `isFrameFrozen: boolean`, `isScanningAnimationActive: boolean`, `frozenFrameDataUrl: string | null`, `<LaserScanOverlay />`

- [ ] **Step 1: Create LaserScanOverlay component with glowing laser beam and reticle corner sweep**
  Implement `LaserScanOverlay.tsx` rendering an animated laser beam traveling vertically across the frozen frame, pulsating reticles, and status text `[OPTICAL DECODING IN PROGRESS...]`.

- [ ] **Step 2: Update `idScanEngine.ts` with explicit `freezeCaptureSession()` and `pausePreview()` controls**
  Add state flags to freeze the video frame buffer on the exact frame stability lock reaches 100%, preventing downstream jitter.

- [ ] **Step 3: Integrate frame-freeze and scanning animation into `RegisterPage.tsx`**
  When `scannerAnalysis.stability.isLocked` triggers, set `isFrameFrozen(true)`, freeze `<canvas>` preview, render `<LaserScanOverlay />`, and trigger `decode()`.

- [ ] **Step 4: Verify laser scan animation and frame freezing in browser**
  Test using `npm run dev:responder` on `:5173/register`, confirming the viewfinder freezes on lock and plays the laser sweep.

---

### Task 2: Card Presence Gate Hardening (Reject Furniture & Non-Card Backgrounds)

**Files:**
- Modify: `Frontend/src/Libs/Vision/idScanner/cardPresenceGate.ts`
- Modify: `Frontend/src/Libs/Vision/idScanner/idScanWorker.ts`
- Test: `Frontend/src/Libs/Vision/idScanner/__tests__/cardPresenceGate.test.ts`

**Interfaces:**
- Consumes: `rgba`, `gray`, `edges`, `candidateCorners`, `isTemporallyLocked`
- Produces: `CardPresenceEvaluation` (`passed: boolean`, `status: CardPresenceStatus`, `reason?: string`)

- [ ] **Step 1: Write test case verifying rejection of non-card rectangular slats (furniture/bunk beds)**
  Assert that quads lacking internal text lines across $\ge 4$ spatial blocks or lacking ID header markers return `passed: false` and `status: 'NO_CARD'`.

- [ ] **Step 2: Harden `cardPresenceGate.ts` interior stroke distribution check**
  Require genuine ID card interior text density and reject candidate quads where background skin/face is present but quad text transitions are below minimum threshold.

- [ ] **Step 3: Run test suite to verify furniture and selfie rejections pass**
  Run `npx vitest run src/Libs/Vision/idScanner/__tests__/cardPresenceGate.test.ts`.

---

### Task 3: Philippine Driver's License Layout OCR & 10-Field Autofill Engine

**Files:**
- Modify: `Frontend/src/Libs/Vision/idScanner/idSpecs.ts`
- Modify: `Frontend/src/Libs/Vision/idScanner/idScanWorker.ts`
- Modify: `Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage.tsx`
- Test: `Frontend/src/Libs/Vision/idScanner/__tests__/driverLicenseOcr.test.ts`

**Interfaces:**
- Consumes: `rectifiedImageData (856x540)`
- Produces: `ExtractedFieldsPayload` with all 10 verified fields:
  `lastName: 'SUICO'`, `firstName: 'JHONMARK'`, `middleName: 'AMACA'`, `sex: 'male'`, `dateOfBirth: '2004/02/20'`, `age: '22'`, `licenseNumber: 'J07-22-302560'`, `weight: '52'`, `height: '1.71'`, `address: '-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110'`.

- [ ] **Step 1: Write unit test with physical Driver's License image fixtures**
  Create test verifying accurate parsing of the 10 fields from LTO Driver's License layout.

- [ ] **Step 2: Refine ROI coordinates in `driversSpec` in `idSpecs.ts`**
  Ensure field bounding boxes align with physical card layout:
  - `fullName`: `{ x: 0.35, y: 0.31, w: 0.54, h: 0.08 }`
  - `sex`: `{ x: 0.46, y: 0.40, w: 0.08, h: 0.07 }`
  - `dateOfBirth`: `{ x: 0.53, y: 0.40, w: 0.18, h: 0.07 }`
  - `weight`: `{ x: 0.71, y: 0.40, w: 0.09, h: 0.07 }`
  - `height`: `{ x: 0.81, y: 0.40, w: 0.11, h: 0.07 }`
  - `address`: `{ x: 0.35, y: 0.49, w: 0.62, h: 0.13 }`
  - `licenseNumber`: `{ x: 0.35, y: 0.63, w: 0.25, h: 0.07 }`

- [ ] **Step 3: Enhance field normalizer in `idScanWorker.ts`**
  Calculate `age` from `dateOfBirth` (`2004/02/20` $\to$ `22` in 2026), map `sex` `M` $\to$ `male`, clean address string, and parse `lastName: SUICO`, `firstName: JHONMARK`, `middleName: AMACA`.

- [ ] **Step 4: Update `handleLockedCardScan` in `RegisterPage.tsx`**
  Populate all 10 state fields and set `autofillBadge` to verified.

- [ ] **Step 5: Run tests and verify zero type errors**
  `npx vitest run` & `npx tsc --noEmit`.

---

### Task 4: Step 2 Biometric Active Liveness & Facial Sweep Animation

**Files:**
- Modify: `Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/MultiAngleBiometricEngine.tsx`
- Modify: `Frontend/src/Libs/Vision/idScanner/face/skinFaceTracker.ts`
- Test: `Frontend/src/Libs/Vision/idScanner/__tests__/biometricLiveness.test.ts`

**Interfaces:**
- Consumes: Video frames, facial landmarks
- Produces: `yawAngle: number`, `eyeAspectRatio: number`, active liveness gesture pass events (`TURN_LEFT`, `TURN_RIGHT`, `BLINK`)

- [ ] **Step 1: Implement Yaw Angle ($Euler Y$) and Eye Aspect Ratio ($EAR$) formulas**
  Add explicit mathematical functions:
  - `computeHeadYawAngle(landmarks)`: Returns angle in degrees.
  - `computeEyeAspectRatio(eyeLandmarks)`: Returns ratio $\frac{\|p_2-p_6\|+\|p_3-p_5\|}{2\|p_1-p_4\|}$.

- [ ] **Step 2: Add 1.2-second command stabilization and face-loss recovery**
  Ensure transitions between challenge prompts pause gracefully and resume when face is centered.

- [ ] **Step 3: Integrate facial mesh wireframe overlay and sweep animation**
  Render real-time wireframe vertices contouring eyebrows, nose, and jawline with glowing scanning sweep.

- [ ] **Step 4: Verify active liveness in browser**
  Test head turns and blinking on `:5173/register?step=2`.

---

### Task 5: Hybrid Pinpoint Location Delivery System & Anti-Spoofing Fusion

**Files:**
- Modify: `Frontend/src/Components/Modals/EmergencyReportingModal.tsx` (or civilian SOS reporting component)
- Modify: `Backend/Features/Controllers/IncidentsController.cs` (or emergency reporting endpoint)
- Modify: `Backend/Features/Models/Incident.cs`
- Test: `Backend.Tests/IncidentLocationVerificationTests.cs`

**Interfaces:**
- Consumes: HTML5 Geolocation (`latitude`, `longitude`, `accuracy`), HTTP connection context (`RemoteIpAddress`, `X-Forwarded-For`)
- Produces: Incident entity with `Latitude`, `Longitude`, `AccuracyRadiusMeters`, `ClientIpAddress`, `IsSpoofingSuspected: boolean`

- [ ] **Step 1: Integrate HTML5 sensor fusion in reporting frontend**
  Call `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`, and burn coordinates watermark onto camera frame.

- [ ] **Step 2: Add IP envelope logging and Haversine cross-verification in backend**
  Capture `HttpContext.Connection.RemoteIpAddress` and flag incidents whose reported GPS coordinates deviate $> 500\text{ km}$ from regional IP origin.

- [ ] **Step 3: Compile and run backend tests**
  `dotnet test` & `dotnet build`.

---

### Task 6: Tactical End-to-End Multi-Portal Verification Protocol

**Files:**
- Test verification script / browser testing protocol across `:5175`, `:5174`, `:5173`.

- [ ] **Step 1: Civilian Portal (:5175) Incident Creation**
  Log in as `civilain1@gmail.com` / `Civilian1`, submit live emergency snapshot with coordinates.

- [ ] **Step 2: LDRRMO Admin (:5174) Manual Approval & Dispatch**
  Log in as `ldrrmo.admin@resqtrack.gov.ph` / `LdrrmoCommand@2026!`, inspect pinpoint coordinates on map, approve incident, and dispatch to RHU Medic, Fire, and Police units.

- [ ] **Step 3: Responders Portal (:5173) Dispatch Acceptance**
  Log in as `medic1@gmail.com` / `Medic1`, review incident coordinates, and accept dispatch request.

- [ ] **Step 4: Alternative Two-Way Flow Verification**
  Responder requests dispatch $\to$ Admin approves $\to$ Responder status updates to deployed.
