# ResQTrack Deterministic Live ID Detection, Text Extraction & Facial Recognition Implementation Plan

## Goal
Establish a 100% deterministic, highly accurate, on-device biometric and document verification pipeline in ResQTrack. Incorporate lessons and architectures from reference models (`IDCardReader`, `opencvsharp_blazor_sample`, `CamCam`, `Face-Detection`, `face-detection-and-recognition`, `pdftext`, `tesseract`, `textricator`) without plagiarizing, adhering to zero `any`, 100% lambda functions, zero emojis, and zero SQLite.

---

## Phase 1: Reference Ingestion & Architectural Synthesis
- [x] Read and analyze all open source projects in `C:\Users\provu\Desktop\LIVE DETECTION ID SCAN RESOURCES` (`IDCardReader`, `opencvsharp_blazor_sample`).
- [x] Read and analyze all open source projects in `C:\Users\provu\Desktop\LIVE DETECTION FACIAL RECOGNITION` (`CamCam`, `Face-Detection`, `face-detection-and-recognition`).
- [x] Read and analyze all open source projects in `C:\Users\provu\Desktop\LIVE TEXT DETECTION EXTRATION RESOURCES` (`pdftext`, `tesseract`, `textricator`).
- [x] Extract and document core functions, mathematical algorithms, approaches, and strategies without copying code.
- [x] Map spatial layout modeling (Douglas-Peucker quad approximation, corner ordering, projective homography, projection profiling, valley-minima glyph segmentation, FSM field mapping).
- [x] Create project skill `resqtrack-vision-biometrics` in `C:\Users\provu\.gemini\config\skills\resqtrack-vision-biometrics\SKILL.md` and `Md data/SKILL_VISION_BIOMETRICS.md`.

---

## Phase 2: Live ID Detection & Frame Freeze Enhancements
- [x] Canny edge detection & morphological dilation in `cannyHough.ts`.
- [x] 4-point Douglas-Peucker contour quad detection & deterministic corner ordering in `contour.ts`.
- [x] Direct Linear Transform (DLT) $3 \times 3$ projective homography backward mapping in `homography.ts`.
- [x] `SmartCaptureRingBuffer` frame scoring using Laplacian edge variance in `idScanEngine.ts`.
- [x] Temporal stability tracker with sliding window and soft-decay in `idScanEngine.ts`.
- [x] Auto-trigger frame freeze upon 100% stability lock, preserving snapshot across card removal in `RegisterPage.tsx`.
- [x] Clean retake lifecycle releasing all scanner locks (`resetStability()`, `isScanningLock = false`).

---

## Phase 3: High-Accuracy Text Extraction (PowerToys Spec)
- [x] Build `textExtractor.ts` modeling the 4-phase PowerToys on-device OCR pipeline:
  1. Exact ROI sub-buffer isolation.
  2. Contrast stretching, bilinear DPI scaling ($2.5\times - 3.0\times$), Sauvola adaptive thresholding.
  3. Horizontal projection profiling (line bands) and vertical projection profiling (character segmentation & valley-minima splitting).
  4. Multi-font glyph matching (`FONT_BANK`) and 18 topological disambiguation rules ('0'/'O', '1'/'I', '8'/'B', '5'/'S', '3'/'5').
- [x] Build `TextExtractorOverlay.tsx` providing an interactive tactical crosshair tool with drag selection, clipboard auto-copy, and 9 quick-assign form pills.
- [x] Integrate multi-line Philippine Driver's License and National ID name parsing in `validators.ts`.
- [x] Wire `TextExtractorOverlay` into `RegisterPage.tsx` camera viewfinder controls and preview dropzones.

---

## Phase 4: Facial Recognition & Liveness Integration
- [x] Implement YCbCr physiological skin chrominance segmentation and morphological opening in `skinFaceTracker.ts`.
- [x] Compute $O(1)$ dual integral images (1st order luminance sum and 2nd order variance sum) in `skinFaceTracker.ts`.
- [x] Implement pose-adaptive Viola-Jones Haar cascade evaluator across frontal and profile hypotheses.
- [x] Extract 5 geometric anthropometric facial landmarks (eyes, nose tip, mouth, chin).
- [x] Calculate 3D head pose yaw/pitch degrees and cranial silhouette protrusion metrics.
- [x] Implement multi-modal biometric descriptors:
  - 16-D Eigenfaces PCA harmonic orthogonal basis projections.
  - 16-D Fisherfaces LDA linear discriminant projections.
  - 64-D Local Binary Patterns (LBP) spatial texture histograms.
  - 32-D Deep Convolutional Feature Embeddings (8 multi-scale kernels + pooling).
  - 128-D Unified Hypersphere Biometric Descriptor.
- [x] Evaluate Cosine Similarity between live facial embedding and rectified ID card portrait photo crop.

---

## Phase 5: Verification, TDD & Full-Stack Compilation
- [x] Verify Text Extractor Engine: `npx tsx src/Libs/Vision/idScanner/__tests__/verify_text_extractor_engine.ts` (100% PASS).
- [x] Verify ID Freeze & Retake Lifecycle: `npx tsx src/Libs/Vision/idScanner/__tests__/verify_id_freeze_and_retake_lifecycle.ts` (100% PASS).
- [x] Verify Classical OCR & CCL: `npx tsx src/Libs/Vision/idScanner/__tests__/verify_ocr_ccl.ts` (100% PASS).
- [x] Verify Digital Image Processing Core: `npx tsx src/Libs/Vision/idScanner/__tests__/verify_dip_core.ts` (100% PASS).
- [x] Verify Frontend Build: `npm run build` (`tsc -b && vite build`) - 0 errors, built in 2.40s.
- [x] Verify Backend Build: `dotnet build` - clean compilation.
