# 30–60 FPS Biometric Video Recording Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:dispatching-parallel-agents or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 4-pose facial biometric capture panel to explicitly record video at 30 to 60 frames per second, upgrade in-memory cache capacity to 60 frames/pose, render real-time 30-60 FPS HUD telemetry, update thumbnail strip indicators to show 30-60 FPS video recording, and watermark the compiled composite snapshot with video stream parameters.

**Architecture:** A client-side high-frequency sampling loop tied to hardware camera constraints (`frameRate: { ideal: 30, max: 60 }`), backed by an expanded `biometricFrameCache` (up to 60 frames per pose), streaming real-time FPS metrics (`performance.now()`), and rendering tactical HUD badges across the Viewfinder, Pose Strip, and Composite Watermark.

**Tech Stack:** React 19, TypeScript, HTML5 MediaStream API / Canvas 2D, Lucide Icons, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-12-biometric-video-30-60-fps-design.md`

## Global Constraints
- Zero external neural network dependencies; client-side mathematical determinism.
- Zero emojis in UI or log strings.
- Universal expression-bodied lambda syntax (`=>`) across TypeScript.
- Strict type safety with zero `any`.
- Backward-compatible with synthetic test runners and fallback file uploads.

---

### Task 1: Frame Cache Buffer Expansion & FPS Telemetry Store (`biometricFrameCache.ts`)

**Files:**
- Modify: `Project system ENGINE/Frontend/src/Libs/Cache/biometricFrameCache.ts`

**Interfaces:**
- Consumes: `CachedFrameEntry`, `BiometricPose`
- Produces: `maxFramesPerPose = 60`, `getRecordingFps()`, `getBufferCapacity()`, updated `BiometricCacheMetadata` with `targetFpsRange: string`, `frameRateBracket: string`

- [ ] **Step 1.1**: Update `maxFramesPerPose` from `10` to `60` in `BiometricFrameCacheStore`.
- [ ] **Step 1.2**: Add `targetFpsRange = '30-60 FPS'` and rolling FPS computation to cache store.
- [ ] **Step 1.3**: Update `buildBiometricCacheMetadata` and `BiometricCacheMetadata` interface with `targetFpsRange`, `averageFps`, and `frameRateBracket`.
- [ ] **Step 1.4**: Verify TypeScript build compatibility.

---

### Task 2: High-Frequency Video Sampling & Hardware Camera Stream (`ManualFacialCapturePanel.tsx`)

**Files:**
- Modify: `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/ManualFacialCapturePanel.tsx`

**Interfaces:**
- Consumes: `navigator.mediaDevices.getUserMedia`
- Produces: High-frequency sampling loop (33.3ms / ~30 FPS down to 16.6ms / ~60 FPS), rolling `measuredFps` state, `videoStreamState` with `ideal: 30, max: 60`.

- [ ] **Step 2.1**: Update `getUserMedia` constraints to include `frameRate: { ideal: 30, max: 60 }`.
- [ ] **Step 2.2**: Update `SAMPLING_INTERVAL_MS` to high-frequency interval (33ms, ~30 FPS sampling rate).
- [ ] **Step 2.3**: Implement high-resolution timestamp tracking (`performance.now()`) to measure actual live stream FPS.
- [ ] **Step 2.4**: Wire live FPS calculation into state `measuredFps: number` and `fpsBracket: string`.

---

### Task 3: Viewfinder HUD, Pulse Recording Badge & Calibration Banner (`ManualFacialCapturePanel.tsx`)

**Files:**
- Modify: `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/ManualFacialCapturePanel.tsx`

**Interfaces:**
- Consumes: `cameraState`, `measuredFps`, `currentPose`, `poseCounts`
- Produces: Visual recording badge (`● REC [30-60 FPS]`), HUD telemetry bar (`STREAM: 30-60 FPS // BUFFER: {count}/60 FRAMES`), and updated calibration banner.

- [ ] **Step 3.1**: Update top calibration training banner copy to explicitly state "at 30 to 60 frames per second (FPS)".
- [ ] **Step 3.2**: Add top-right Viewfinder badge indicating `30-60 FPS HIGH-SPEED VIDEO STREAM`.
- [ ] **Step 3.3**: Add live recording overlay during active streaming: `● REC [30-60 FPS] // {measuredFps} FPS`.
- [ ] **Step 3.4**: Add live frame buffer meter: `BUFFER: {count}/60 FRAMES ({Math.round(count/60*100)}%)`.

---

### Task 4: 4-Pose Thumbnail Strip Cards & Recapture Badges (`ManualFacialCapturePanel.tsx`)

**Files:**
- Modify: `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/ManualFacialCapturePanel.tsx`

**Interfaces:**
- Consumes: `poseCounts[pose]`, `bestFrames[pose]`, `ORDERED_POSES`
- Produces: Updated badge on thumbnails: `● 30-60 FPS // {count} frames` (or `{count}/60 frames (30-60 FPS)`), and active recording state `● RECORDING 30-60 FPS...`.

- [ ] **Step 4.1**: Update Strip header to: `4-Pose Biometric Frame Cache Strip (30–60 FPS High-Speed Sampling)`.
- [ ] **Step 4.2**: Replace static `{count} frames` badge with tactical `● 30-60 FPS // {count} frames` badge.
- [ ] **Step 4.3**: Update active thumbnail state to display `● RECORDING 30-60 FPS...` with pulsating beacon.
- [ ] **Step 4.4**: Ensure individual pose recapture properly re-samples up to 60 frames.

---

### Task 5: Watermarked Composite Snapshot & Synthetic/Fallback Simulation (`ManualFacialCapturePanel.tsx`)

**Files:**
- Modify: `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/ManualFacialCapturePanel.tsx`

**Interfaces:**
- Consumes: `createCompositeSnapshot`, `handleGenerateSyntheticTestRecord`, `handleFallbackFileUpload`
- Produces: Canvas composite with stamped `VIDEO STREAM: 30-60 FPS // 60 FRAMES/SEC BUFFER`, and synthetic/fallback generation populating 30 to 60 frames.

- [ ] **Step 5.1**: In `createCompositeSnapshot`, update quadrant titles to: `POSE 0X // {TITLE} (30-60 FPS STREAM)`.
- [ ] **Step 5.2**: In `createCompositeSnapshot`, update the bottom watermark banner to stamp: `RESQTRACK 30-60 FPS BIOMETRIC VIDEO STREAM // 60 FRAMES/SEC HIGH-SPEED SAMPLING`.
- [ ] **Step 5.3**: Upgrade `handleGenerateSyntheticTestRecord` to populate 30 to 60 frames per pose with high-speed synthetic metadata.
- [ ] **Step 5.4**: Upgrade `handleFallbackFileUpload` to populate 60 frames per pose with `30-60 FPS Video Emulation`.
- [ ] **Step 5.5**: Run `npm run build` to verify clean build with zero TypeScript or packaging errors.
