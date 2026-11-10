# Upload-Only Government ID (Front & Back) & Automated OCR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate Phase 1 (`01 Identity`) of Registration to remove live camera ID detection, use Front & Back ID picture uploads exclusively, and execute automated + interactive on-device OCR text extraction on uploaded IDs.

**Architecture:** `idScanWorker.ts` and `idScanEngine.ts` are streamlined around static uploaded image processing (`scanUploadedIdImage` and `executeFullCardScan` with `side: 'front' | 'back'`, pre-cropped full-frame card fallback, multi-line ROI OCR, Spatial FSM field extraction, and Front+Back field merging). `RegisterPage.tsx` removes all Step 1 live camera hardware hooks and viewfinders, presenting a dual Front/Back upload interface with `<LaserScanOverlay />` optical feedback, automated field autofill, and interactive `<TextExtractorOverlay />` inspection.

**Tech Stack:** React 19, TypeScript 5.8 (Strict, Zero `any`, 100% Universal Lambda `=>`), HTML5 Canvas 2D, Web Workers.

**Spec:** `docs/superpowers/specs/2026-11-08-upload-id-automated-ocr-design.md`

## Global Constraints

- **100% Universal Lambda Syntax (`=>`)**: Zero `function` declarations anywhere.
- **Zero `any` Type**: Strict TypeScript interfaces and explicit type guards.
- **Zero Emojis**: No emoji characters in code, UI strings, or logs.
- **Zero SQLite**: MS SQL Server / PostgreSQL only.

---

### Phase 1: TDD Verification Suite & Vision Engine Streamlining (`idScanWorker.ts` & `idScanEngine.ts`)

- [ ] **Task 1: Create TDD Test Suite `verify_uploaded_id_ocr_pipeline.ts` and Delete Legacy Live-Stream Test**
  - Create `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/__tests__/verify_uploaded_id_ocr_pipeline.ts` testing:
    1. Uncropped Front ID image upload -> quad detection -> homography warp -> automated OCR & Spatial FSM autofill.
    2. Pre-cropped (full-frame) Front ID & Back ID image upload -> full-frame fallback rectification -> automated OCR & Back-side field extraction.
    3. Anti-selfie rejection (`FACE_DETECTED`) when a human face portrait is uploaded instead of an ID card.
    4. `mergeFrontAndBackFields` combining Front ID identity fields with Back ID supplemental fields (`address`, `weight`, `height`, `emergencyContact`) without overwriting verified Front ID fields.
  - Delete `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/__tests__/verify_id_freeze_and_retake_lifecycle.ts`.

- [ ] **Task 2: Streamline `idScanWorker.ts` & `idScanEngine.ts` for Front & Back Uploaded ID Scanning**
  - In `idScanWorker.ts`:
    - Remove `WorkerAnalyzeFrameRequest`, `WorkerAnalyzeFrameResponse`, and `executeFrameAnalysis`.
    - Update `WorkerFullScanRequest` and `executeFullCardScan` to accept `side?: 'front' | 'back'` and `isStaticUpload?: boolean`.
    - Implement pre-cropped full-frame card fallback when `findCardQuad` returns `null` on a valid non-face document image.
    - Support `side === 'back'` (`spec.reverseFields` + full-card multi-line `extractTextFromRoi` + `parseIdFieldsWithSpatialFsm`).
    - Extract `portraitImageData` from `spec.photoRoi` when `side === 'front'`.
  - In `idScanEngine.ts`:
    - Remove `TemporalStabilityTracker`, `SmartCaptureRingBuffer`, `FrameAnalysisResult`, `startLiveStream`, `stopLiveStream`, `resetStability`, `analyzeFrame`, and live camera loop methods.
    - Add `scanUploadedIdImage` and `mergeFrontAndBackFields`.

---

### Phase 2: Registration Phase 1 (`01 Identity`) UI Recreation & Legacy Cleanup

- [ ] **Task 3: Delete Obsolete `Register/Register.tsx` & Update `TextExtractorOverlay.tsx`**
  - Delete `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/Register/Register.tsx`.
  - Edit `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/TextExtractorOverlay.tsx` to remove `videoElement` prop and add optional Front/Back uploaded image switcher pills in the overlay header.

- [ ] **Task 4: Recreate Step 1 (`01 Identity`) in `RegisterPage.tsx` as Upload-Only Front & Back ID with Automated OCR**
  - Remove all Step 1 live camera states, refs, `useEffect` stream hooks, `startCamera`/`stopCamera`, `generateSyntheticIdCanvas`, and the `idCaptureMode === 'camera'` JSX block.
  - Implement dedicated Front ID & Back ID Upload Cards with `<LaserScanOverlay />` during OCR decoding, per-card quality/confidence badges, `applyUploadedIdScanResult` (fixing Front ID replacement and merging Back ID fields), `Re-Scan / Auto-Extract`, `Interactive Text Extractor`, `Replace`, and `Remove` actions.
  - Render `autofillBadge` directly in the Upload section and unlock the editable Personal Details form upon validation.

---

### Phase 3: Verification, Skill Update & Closed-Loop QA (`loop-eng`)

- [ ] **Task 5: Update `resqtrack-vision-biometrics` Skill & Run Full Verification Suite**
  - Update `C:\Users\provu\.gemini\config\skills\resqtrack-vision-biometrics\SKILL.md` and `Md data/SKILL_VISION_BIOMETRICS.md`.
  - Run `verify_uploaded_id_ocr_pipeline.ts`, `verify_text_extractor_engine.ts`, `verify_face_recognition_and_biometrics.ts`, `verify_ocr_ccl.ts`, `verify_dip_core.ts`, and `npm run build` (`tsc -b && vite build`) to verify 0 errors and 100% pass rate.
