# 30–60 FPS Biometric Video Recording Engine & Visual Telemetry HUD Specification

**Project**: ResQTrack Incident AI System Detection (`C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION`)  
**Feature**: 4-Pose Biometric Video Recording at 30–60 FPS with High-Frequency Frame Buffering, Live Telemetry HUD, Dynamic FPS Meter, Watermarked Composite Snapshot, and Multi-Pose Verification  
**Date**: 2026-11-12  
**Status**: APPROVED // IN-IMPLEMENTATION  

---

## 1. Executive Summary & Root Cause Forensic Audit

### 1.1 The Forensic Evidence (User's Problem)
In the provided registration screenshots (`uploaded_media_1794463959431.png` and `uploaded_media_1794463978762.jpg`):
1. **Misleading Frame Count**: Each thumbnail in the 4-pose cache strip displays only a static badge: `10 frames`.
2. **Zero Video / FPS Telemetry**: Nowhere in the UI (viewfinder, headers, cards, status pills, or the compiled 4-pose composite) is there any indication that video is being recorded at **30 to 60 frames per second**.
3. **Underlying Architectural Mismatch**:
   - `biometricFrameCache.ts` hardcoded `private readonly maxFramesPerPose: number = 10;`. At 30 FPS, 10 frames is only 333ms of video; at 60 FPS, it is 166ms!
   - `ManualFacialCapturePanel.tsx` set `const SAMPLING_INTERVAL_MS = 200;` (5 frames/sec) via `setInterval`, which is 6× to 12× slower than true 30–60 FPS video feeds.
   - `getUserMedia` camera constraints did not specify `frameRate: { ideal: 30, max: 60 }`.
   - The compiled 4-quadrant canvas watermark lacked video capture telemetry metadata (`STREAM: 30-60 FPS // 60 FRAMES/SEC HD BUFFER`).
   - The synthetic test generator and fallback upload simulated only 5 to 10 frames per pose instead of a 30–60 FPS recording buffer.

---

## 2. Mathematical Foundations & Telemetry Formulations

### 2.1 Live Stream FPS Measurement
Using high-resolution monotonic timestamps ($t \in \mathbb{R}$ via `performance.now()`):
$$\Delta t_k = t_k - t_{k-1}$$
$$\text{FPS}_{\text{inst}} = \frac{1000}{\Delta t_k}$$
$$\text{FPS}_{\text{smoothed}} = \alpha \cdot \text{FPS}_{\text{smoothed}} + (1 - \alpha) \cdot \text{FPS}_{\text{inst}}, \quad \alpha = 0.85$$

When $\text{FPS}_{\text{smoothed}} \ge 24$, it is categorized into the target operating bracket:
$$\text{StreamMode} = \begin{cases} 
\text{"60 FPS HD ULTRA"}, & \text{if } \text{FPS} \ge 50 \\
\text{"30–60 FPS HIGH-SPEED"}, & \text{if } 28 \le \text{FPS} < 50 \\
\text{"30 FPS STANDARD"}, & \text{if } 20 \le \text{FPS} < 28 \\
\text{"VARIABLE FPS (ADAPTIVE)"}, & \text{otherwise}
\end{cases}$$

### 2.2 Frame Buffer Scaling
Each pose captures a continuous burst over 1.0 – 2.0 seconds:
$$N_{\text{capacity}} = 60 \text{ frames per pose} \quad (4 \text{ poses} \times 60 = 240 \text{ frames total cache})$$
- Target sampling rate: $16.6\text{ms}$ (60 FPS) to $33.3\text{ms}$ (30 FPS) driven by `requestVideoFrameCallback` or high-precision RAF sampling.
- Frame Replacement Strategy: While buffer $< 60$, append frames. When buffer reaches 60, replace the frame with the lowest Laplacian variance $\text{Var}(\nabla^2 I)$ if the new incoming frame is sharper.

---

## 3. UI/UX Architecture & HUD Telemetry Design

```
+-----------------------------------------------------------------------------------------+
| [BIOMETRIC PROFILE TRAINING // 1:1 LOGIN CALIBRATION]                 [100% Trained]    |
| This 4-pose video trains the system on your unique facial geometry at 30 to 60 frames    |
| per second (FPS). Once enrolled, you can authenticate instantly using 1:1 Face Login.  |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
| [CAMERA VIEWFINDER / RECORDING HUD]                                                     |
| +-------------------------------------------------------------------------------------+ |
| | [REC 30-60 FPS]  |  [30-60 FPS HIGH-SPEED VIDEO]  |  [60 FRAMES/POSE CACHE]  [LIVE]  | |
| |                                                                                     | |
| |                                   ( OVAL GUIDE )                                    | |
| |                                                                                     | |
| | [TELEMETRY: 60.0 FPS | 1080p | 548.6 VAR | 48/60 FRAMES CACHED | BUFFER: 80%]      | |
| +-------------------------------------------------------------------------------------+ |
|                                                                                         |
| [4-POSE BIOMETRIC FRAME CACHE STRIP (30–60 FPS HIGH-SPEED SAMPLING)]                    |
| +------------------+ +------------------+ +------------------+ +------------------+     |
| | 1. Face Forward  | | 2. Face Right    | | 3. Face Left     | | 4. Face Blink    |     |
| | 0° Center Lock   | | +25° Turn        | | -25° Turn        | | Eye Blink        |     |
| | [60 frames]      | | [60 frames]      | | [60 frames]      | | [60 frames]      |     |
| | ● 30-60 FPS REC  | | ● 30-60 FPS REC  | | ● 30-60 FPS REC  | | ● 30-60 FPS REC  |     |
| | [ RECAPTURE ]    | | [ RECAPTURE ]    | | [ RECAPTURE ]    | | [ RECAPTURE ]    |     |
| +------------------+ +------------------+ +------------------+ +------------------+     |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Subsystem Decomposition & 5 Parallel Subagent Workstreams

1. **Subagent 1: Frame Cache Buffer & Core Store (`biometricFrameCache.ts`)**:
   - Upgrade `maxFramesPerPose` from 10 to 60.
   - Add telemetry getters: `getRecordingFps()`, `getBufferCapacity()`, `getFrameRateRange()`.
   - Update metadata structure to hold `recordingFps`, `frameRateBracket`, and `samplingIntervalMs`.

2. **Subagent 2: High-Frequency Video Sampling & Camera Constraints (`ManualFacialCapturePanel.tsx` Core)**:
   - Configure `navigator.mediaDevices.getUserMedia` video constraints with `frameRate: { ideal: 30, max: 60 }`.
   - Implement continuous high-rate sampling (16.6ms - 33.3ms) with `performance.now()` delta-based FPS measurement.
   - Maintain rolling FPS state and buffer fill percentage.

3. **Subagent 3: Viewfinder HUD & Top Guidance UI Overlays (`ManualFacialCapturePanel.tsx` UI)**:
   - Display prominent pulsing `● REC 30-60 FPS` video indicator.
   - Render real-time telemetry HUD overlay: `STREAM: 30–60 FPS`, `BUFFER: {count}/60 FRAMES`, `LAPLACIAN VAR`.
   - Update calibration header copy to emphasize 30 to 60 FPS video recording.

4. **Subagent 4: Thumbnail Strip Cards & Recapture Actions (`ManualFacialCapturePanel.tsx` Cards)**:
   - Upgrade thumbnail badges from `10 frames` to `● 30-60 FPS // 60 frames` (or dynamic `{fps} FPS // {count} frames`).
   - Add active recording indicator: `● RECORDING 30-60 FPS...` with pulsating beacon.
   - Ensure individual pose recapture re-populates the full 30–60 frame buffer.

5. **Subagent 5: Composite Canvas Watermark & Synthetic/Fallback Simulation (`ManualFacialCapturePanel.tsx` & Helpers)**:
   - In `createCompositeSnapshot`, stamp quadrant HUD: `POSE 01 // 30-60 FPS VIDEO STREAM (60 FRAMES CACHED)`.
   - In composite footer, stamp: `30-60 FPS HD VIDEO STREAM // 60 FRAMES/SEC HIGH-SPEED BIOMETRIC SAMPLING`.
   - Upgrade `handleGenerateSyntheticTestRecord` and `handleFallbackFileUpload` to populate 30 to 60 frames with 30-60 FPS video simulation.
