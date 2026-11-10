# Geometric Pattern Facial Recognition HUD & Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the traditional geometric pattern facial recognition engine and high-fidelity visual blueprint HUD (matching Pictures 1–7) in ResQTrack while keeping the MediaPipe 3D AI engine fully intact for future API capabilities.

**Architecture:** Pure geometric pattern detection engine (`geometricFacePatternEngine.ts`) calculating anthropometric facial triangles, symmetry axes, eye leveling, profile yaw sector arcs ($\approx 90^\circ$), and eyelid closure calipers (`||`). Fused into `MultiAngleBiometricEngine.tsx` with dynamic SVG/Canvas HUD overlays matching the user's reference blueprint.

**Tech Stack:** React 19, TypeScript (strict, zero `any`, 100% universal lambdas `=>`), Lucide icons, Vite, HTML5 Canvas, SVG overlay, Vitest/tsx test runner.

**Spec:** User reference Pictures 1 through 7 (`uploaded_media_0` to `uploaded_media_6`).

## Global Constraints
- 100% universal lambda expressions (`=>`).
- Zero `any`.
- Zero emojis in code or UI copy.
- Clickable markdown links with `file://` scheme.
- MediaPipe 3D FaceLandmarker remains intact for future API calls.
- Target operational jurisdiction: strictly Katipunan, Zamboanga del Norte (7109).

---

### Task 1: Document Skill in `incident-ai-geometric-facial-patterns/SKILL.md`
- [ ] Create `C:\Users\provu\.gemini\config\skills\incident-ai-geometric-facial-patterns\SKILL.md`.
- [ ] Document the mathematical formulas, indicator definitions, and validation checks for Frontal View, Left Profile, Right Profile, and Blink detection based on Pictures 1–7.

### Task 2: Implement Geometric Pattern Engine (`geometricFacePatternEngine.ts`)
- [ ] Create `Frontend/src/Libs/Vision/idScanner/face/geometricFacePatternEngine.ts`.
- [ ] Implement data types and calculation functions:
  - `computeFaceBoundingBox`
  - `computeCenterLines` (Vertical midline, Horizontal eye line)
  - `computeKeyPoints` (Left Eye, Right Eye, Nose Center, Chin Point)
  - `computeFacialTriangle` (Eye-Eye-Chin coordinates and area/symmetry)
  - `computeJawContour` (Contour path data)
  - `computeProfileAngleIndicator` (Angle arc $\approx 90^\circ$, Yaw gauge needle position)
  - `computeEyelidClosureCalipers` (Red vertical calipers `||`)
  - `evaluateGeometricValidationChecks` (5-item checklists for Front, Left, Right, Blink)
  - `getGeometricPoseData` (Yaw, Pitch, Roll, Eye Distance, Face Ratio)

### Task 3: TDD Unit Verification Suite (`verify_geometric_facial_patterns.ts`)
- [ ] Create `Frontend/src/Libs/Vision/idScanner/__tests__/verify_geometric_facial_patterns.ts`.
- [ ] Implement synthetic test scenarios verifying:
  - Front view detection, eye leveling, vertical symmetry, facial triangle
  - Left profile view detection ($70^\circ - 110^\circ$) with $\approx 90^\circ$ angle indicator
  - Right profile view detection ($70^\circ - 110^\circ$) with $\approx 90^\circ$ angle indicator
  - Eye closure detection with red caliper metrics
- [ ] Run test suite via `npx tsx` and verify 100% pass rate.

### Task 4: Integrate Visual Blueprint HUD into `MultiAngleBiometricEngine.tsx`
- [ ] Update `Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/MultiAngleBiometricEngine.tsx`:
  - Wire `geometricFacePatternEngine.ts` into frame loop.
  - Render SVG/Canvas blueprint matching Pictures 1–7:
    - White Bounding Box
    - Blue dashed Center Lines with directional arrows
    - Green concentric eye reticles and chin point
    - Red dot on nose center with connecting line to chin and eyes
    - Inverted green facial triangle and jawline contour
    - Green $\approx 90^\circ$ profile sector arc with arrows
    - Semi-circular Yaw Angle Gauge dial ($-90^\circ$ to $+90^\circ$)
    - Red dual vertical eyelid calipers (`||`) during Blink phase
    - Real-time Validation Checks Card (5 checks per pose)
    - Key Geometric Data Card (`Yaw`, `Pitch`, `Roll`, `Eye Distance`, `Face Ratio`)
    - Dynamic Status Banner (`Face Forward Detected`, `Face Left Detected`, `Face Right Detected`, `Blink Detected`)
  - Keep `mediaPipeFaceEngine.ts` intact in parallel.

### Task 5: Build Verification
- [ ] Run `npm run build` in `Frontend` to verify zero TypeScript errors.

### Task 6: E2E Live Testing in Chrome DevTools
- [ ] Navigate to `http://localhost:5173/register`.
- [ ] Advance to Stage 02 Biometrics.
- [ ] Verify HUD displays the geometric blueprint indicators and validation checklist.
- [ ] Capture verified screenshot artifacts.
