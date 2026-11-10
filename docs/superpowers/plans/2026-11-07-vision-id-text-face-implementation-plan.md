# Live ID Detection, Frame-Freeze Text Extraction, and Live Facial Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a 100% deterministic, zero-plagiarism, mathematical Computer Vision and Biometrics architecture across ResQTrack's Frontend Vision Engine (`src/Libs/Vision/idScanner/` and `src/LANDING_PAGE/Features/Pages/RegisterPage/`) by synthesizing reference algorithms from all three open-source reference directories:
1. `C:\Users\provu\Desktop\LIVE DETECTION ID SCAN RESOURCES` (`IDCardReader`, `opencvsharp_blazor_sample`)
2. `C:\Users\provu\Desktop\LIVE DETECTION FACIAL RECOGNITION` (`CamCam`, `Face-Detection`, `face-detection-and-recognition`, `DnnFaceDetection.razor`)
3. `C:\Users\provu\Desktop\LIVE TEXT DETECTION EXTRATION RESOURCES` (`pdftext`, `textricator`, `tesseract`)

**Architecture:**
- **Layer 1 (Live ID Detection & Frame-Freeze):** Multi-scale Canny + Morphological Closing (`closeEdges` 3x3 / 5x5) + Suzuki-Abe 8-connected Border Following + Ramer-Douglas-Peucker (`approxPolyDP`) + Hough Line Polar Intersection Fallback + Close-Range Viewport Filling Fallback (`up to 96%` frame area) + `evaluateCardPresence` 4-gate discriminator (Aspect Ratio, Edge Density, Bimodal Histogram Contrast, Text Row Alternation + Anti-Spoof Portrait Rejection) + 5-Frame Stability Lock & Best-Laplacian Sharpness Buffer that freezes immediately at 100% and preserves the locked frame even if the physical card is removed.
- **Layer 2 (Frame-Freeze & Interactive ROI Text Extraction):** On-device `textExtractor.ts` + `TextExtractorOverlay.tsx` + `idScanWorker.ts` combining Bilinear DPI Upscaling (`2.5x - 3.0x`), Retinex Illumination Flattening, Local Contrast Normalization, Integral-Image Sauvola Adaptive Thresholding (`k=0.16, W=21`), Horizontal/Vertical Projection Profile Segmentation, Valley-Minima Touching-Glyph Splitting (`tesseract` chopper principle), Tolerance-Bucketed Reading-Order Block Sorting & Ligature/Control-Char Sanitization (`pdftext` principle), and a Spatial/Label-Driven Finite State Machine (FSM) Field Parser (`textricator` Form & Table mode principle).
- **Layer 3 (Live Facial Recognition & Biometric Verification):** 5-Gate Hybrid Face Engine (`skinFaceTracker.ts`) combining YCbCr + HSV Chrominance Skin Segmentation, Canny-Pruned Multi-Scale Viola-Jones Haar-like Integral Image Cascade (`DO_CANNY_PRUNING` principle from `CamCam`), Finite & Bounds-Clamped 5-Landmark Geometric Ratio Validation (`DnnFaceDetection.razor` principle), Gabor Filter Bank EBGM + Sobel Edge Orientation, 128-Bin Multi-Grid LBPH + Eigenface PCA / Fisherface LDA Subspace Projection (`face-detection-and-recognition` principle), and 3-Layer Passive Liveness Anti-Spoofing (EAR Blink State Machine, Specular Glare Rejection, Micro-Motion Temporal Variance) + Cross-Match against the Scanned ID Portrait Crop.

**Tech Stack:**
- TypeScript 5.x (Strict mode, **ZERO `any`**, **100% Universal Lambda syntax `=>`**)
- React 19 + Web Workers (`idScanWorker.ts`) + HTML5 Canvas `ImageData` (`Uint8ClampedArray`, `Float32Array`, `Float64Array`, `Int32Array`)
- Verification Runner: `npx tsx` + `tsc -b && vite build`

---

## Category 1: Live ID Detection & Frame-Freeze Lifecycle Engine
**Reference Sources:** `IDCardReader` (`Form1.cs`) & `opencvsharp_blazor_sample` (`DocumentScanner.razor`, `CannyEdges.razor`, `TemplateMatching.razor`)

### Phase 1.1: Close-Up & Low-Contrast Quadrilateral Detection + Canny Edge Pruning
**Files:**
- Modify: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/contour.ts`
- Modify: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/cardPresenceGate.ts`
- Modify: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/idScanEngine.ts`
- Test: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/__tests__/verify_id_freeze_and_retake_lifecycle.ts`

- [ ] **Step 1: Enhance `contour.ts` & `cardPresenceGate.ts` for Close-Up IDs (`0.08 <= areaRatio <= 0.96`) and Canny Edge Pruning**
  - Ensure `findDocumentQuad` in `contour.ts` supports close-up ID placement up to `96%` of the frame area (`maxArea = width * height * 0.96`) and orders corners deterministically (`[TL, TR, BR, BL]`) using sum `(x+y)` and difference `(y-x)` invariants.
  - Ensure `evaluateCardPresence` in `cardPresenceGate.ts` computes integral-image Canny/Sobel edge density and bimodal foreground/background contrast so close-up IDs pass while bare skin/faces are rejected (`isLikelyFaceOnly`).

- [ ] **Step 2: Verify 100% Frame-Freeze Lock & Retake Lifecycle in `idScanEngine.ts` and `RegisterPage.tsx`**
  - Confirm that when stability reaches 100% (`LOCKED_100`), `bestFrameBuffer` (highest Laplacian sharpness score) is immediately frozen into `frozenFrameUrl` and preserved even if the ID is removed from the camera view, and clicking `Retake` cleanly resets `idScanEngineRef.current.reset()` so subsequent scans freeze again deterministically.

---

## Category 2: Frame-Freeze & Interactive ROI Text Extraction Engine
**Reference Sources:** `pdftext` (`extraction.py`, `pdf/chars.py`, `pdf/pages.py`, `pdf/utils.py`), `textricator` (`TextExtractor.kt`, `RecordParser.kt`, `FormParse.kt`, `TableParse.kt`), `tesseract` (`ccstruct`, `textord`, `wordrec`, `classify`, `dict`), and Windows PowerToys Text Extractor spec.

### Phase 2.1: Tolerance-Bucketed Reading Order, Ligature Sanitizer & Spatial/Label FSM Field Parser
**Files:**
- Modify: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/textExtractor.ts`
- Modify: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/idScanWorker.ts`
- Modify: `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/TextExtractorOverlay.tsx`
- Test: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/__tests__/verify_text_extractor_engine.ts`

- [ ] **Step 1: Write failing tests in `verify_text_extractor_engine.ts` for Tolerance-Bucketed Block Sorting, Ligature/Control-Char Sanitization, and FSM Structured Field Parsing**
  - Test `sanitizeOcrTextAndLigatures` (unfolding `ﬁ -> FI`, `ﬂ -> FL`, `ﬀ -> FF`, stripping ASCII `< 0x20`, normalizing hyphenated wraps).
  - Test `sortBoxesByToleranceReadingOrder` (bucketing Y coordinates by `Math.round(y / tolerance) * tolerance` then sorting left-to-right `x`, adapted from `pdftext`).
  - Test `parseIdFieldsWithSpatialFsm` (state-machine label/value transition parser adapted from `textricator` `FormParse.kt` & `TableParse.kt` that extracts `idNumber`, `lastName`, `firstName`, `middleName`, `birthDate`, `sex`, `address`, `weight`, `height` from positioned text lines or multi-line OCR output).

- [ ] **Step 2: Implement `sanitizeOcrTextAndLigatures`, `sortBoxesByToleranceReadingOrder`, and `parseIdFieldsWithSpatialFsm` in `textExtractor.ts`**
  - Wire `parseIdFieldsWithSpatialFsm` into `idScanWorker.ts` as an automatic fallback/enrichment layer after ROI template cropping so that even if a card is slightly shifted inside the frame-freeze, any label-adjacent field values (`LAST NAME`, `FIRST NAME`, `MIDDLE NAME`, `DATE OF BIRTH`, `SEX`, `ADDRESS`, `LICENSE NO`, `PCN`, `CRN`) are deterministically captured and validated.
  - Add a **"Smart Auto-Parse To Form"** action in `TextExtractorOverlay.tsx` when the user drags a selection box over multiple lines on the frozen ID frame, allowing one-click auto-population of all detected fields via `parseIdFieldsWithSpatialFsm`.

---

## Category 3: Live Facial Recognition & Biometric Cross-Match Engine
**Reference Sources:** `CamCam` (`Cam.cs`), `Face-Detection` (`Form1.cs`), `face-detection-and-recognition` (`Form1.cs`), `opencvsharp_blazor_sample` (`LiveFaceDetection.razor`, `DnnFaceDetection.razor`)

### Phase 3.1: Canny-Pruned Haar Cascade, Finite/Clamped 5-Landmark Validation & Subspace Portrait Recognition
**Files:**
- Modify: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/face/skinFaceTracker.ts`
- Modify: `Project system ENGINE/Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage.tsx`
- Create Test: `Project system ENGINE/Frontend/src/Libs/Vision/idScanner/__tests__/verify_face_recognition_and_biometrics.ts`

- [ ] **Step 1: Write comprehensive TDD verification suite `verify_face_recognition_and_biometrics.ts`**
  - Verify Canny-pruned integral-image Haar cascade rejection on flat/non-edge regions (`checkCannyEdgePruningGate`, modeled after `HAAR_DETECTION_TYPE.DO_CANNY_PRUNING` in `CamCam`).
  - Verify finite & bounds-clamped 5-landmark geometry validation (`clampAndValidateFaceDetection`, modeled after `DnnFaceDetection.razor`).
  - Verify 6-metric hybrid face comparison (`compareFaces`: 128-bin LBPH, 1024-D Eigenface PCA, 1024-D Fisherface LDA, 128-D Deep CNN embedding, Gabor EBGM, and Geometric Landmark ratios) between an ID portrait crop and a live webcam face frame (same-person similarity `>= 0.75`, impostor rejection `< 0.50`).

- [ ] **Step 2: Implement `checkCannyEdgePruningGate` and `clampAndValidateFaceDetection` in `skinFaceTracker.ts`**
  - Add O(1) integral-image gradient/edge density pre-pruning before full multi-scale Haar cascade evaluation (`DO_CANNY_PRUNING` concept).
  - Add strict `Number.isFinite` and image-boundary intersection clamping on bounding boxes and 5 facial landmarks (`leftEye`, `rightEye`, `noseTip`, `mouthLeft`, `mouthRight`).

- [ ] **Step 3: Run all unit & integration tests and full production build**
  - Execute `verify_text_extractor_engine.ts`, `verify_id_freeze_and_retake_lifecycle.ts`, `verify_ocr_ccl.ts`, `verify_face_recognition_and_biometrics.ts`, and `npm run build`.
