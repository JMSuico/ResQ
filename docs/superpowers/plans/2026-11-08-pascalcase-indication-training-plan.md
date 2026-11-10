# PascalCase Indication-to-Target OCR Training & Yellow-Ink ROI Calibration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train the ResQTrack on-device Government ID OCR engine to distinguish between PascalCase / Title Case field indicator headers (red-ink reference layer) and ALL-CAPS / numeric user personal data directly below them (yellow-ink reference layer), implementing all 8 mandatory indications and 6 optional indications with 100% accuracy.

**Architecture:**
1. **Calibrated ISO/IEC 7810 ID-1 ROI Geometry (`idSpecs.ts`)**: Shifts relative bounding boxes for Philippine Driver's Licenses (`856x540` rectified frame) down by `+0.03` to `+0.05` vertically so that single-field crops bypass PascalCase header lines and land directly on the ALL-CAPS user data lines.
2. **PascalCase Header Guard (`isPascalCaseLabel` in `textExtractor.ts`)**: Deterministic classifier that identifies field headers (`Nationality`, `Sex`, `Date of Birth`, `Weight(kg)`, `Height(m)`, `Address`, `License No.`, `Last Name, First Name, Middle Name`, `Expiration Date`, `Agency Code`, `Blood Type`, `Eyes Color`, `DL Codes`, `Conditions`) and blocks them from ever populating user personal details.
3. **Indication-to-Target Spatial Pairing (`parseFieldsByPascalCaseIndications` in `textExtractor.ts`)**: Scans multi-line OCR output for PascalCase headers and pairs each header with the ALL-CAPS / formatted line immediately below it.

**Tech Stack:** Strict TypeScript (Zero `any`), Universal Lambda Syntax (`const fn = () => {}`), HTML5 Canvas 2D ImageData, Sauvola Adaptive Binarization, Connected Component Labeling (CCL), Spatial Finite State Machine (FSM).

---

## Category 1: Layout Geometry & ROI Calibration (`idSpecs.ts`)

### Phase 1.1: Calibrate Yellow-Ink Data ROIs on Rectified `856x540` Card
- [x] **Task 1**: Update `driversSpec.fields` in `src/Libs/Vision/idScanner/idSpecs.ts` so every field ROI sits strictly inside the yellow-ink user data band below its PascalCase label:
  - `fullName`: `{ x: 0.34, y: 0.30, w: 0.46, h: 0.075 }`
  - `nationality`: `{ x: 0.34, y: 0.41, w: 0.08, h: 0.07 }`
  - `sex`: `{ x: 0.48, y: 0.41, w: 0.055, h: 0.07 }`
  - `dateOfBirth`: `{ x: 0.55, y: 0.41, w: 0.18, h: 0.07 }`
  - `weight`: `{ x: 0.755, y: 0.41, w: 0.07, h: 0.07 }`
  - `height`: `{ x: 0.865, y: 0.41, w: 0.08, h: 0.07 }` (`expectedCharType: 'NUMERIC'`)
  - `address`: `{ x: 0.34, y: 0.50, w: 0.61, h: 0.125 }`
  - `licenseNumber`: `{ x: 0.34, y: 0.65, w: 0.22, h: 0.075 }`
  - `expirationDate`: `{ x: 0.57, y: 0.65, w: 0.18, h: 0.075 }`
  - `agencyCode`: `{ x: 0.805, y: 0.65, w: 0.075, h: 0.075 }`
  - `bloodType`: `{ x: 0.34, y: 0.75, w: 0.12, h: 0.055 }`
  - `eyesColor`: `{ x: 0.49, y: 0.75, w: 0.14, h: 0.055 }`
  - `dlCodes`: `{ x: 0.34, y: 0.835, w: 0.22, h: 0.06 }`
  - `conditions`: `{ x: 0.50, y: 0.835, w: 0.16, h: 0.06 }`

---

## Category 2: Indication-to-Target OCR Engine (`textExtractor.ts`)

### Phase 2.1: Implement `isPascalCaseLabel` Guard
- [x] **Task 2**: Implement `isPascalCaseLabel(text: string): boolean` in `src/Libs/Vision/idScanner/textExtractor.ts` to detect all 8 mandatory + 6 optional PascalCase headers and reject them as personal data.

### Phase 2.2: Implement `parseFieldsByPascalCaseIndications`
- [x] **Task 3**: Implement `parseFieldsByPascalCaseIndications` in `src/Libs/Vision/idScanner/textExtractor.ts` covering:
  1. `Nationality` -> Acronym below (`PHL`).
  2. `Sex` -> Single-letter acronym below (`M` -> `MALE`, `F` -> `FEMALE`).
  3. `Date of Birth` -> Date number below (`YYYY/MM/DD`, e.g., `2004/02/20`).
  4. `Weight(kg)` -> 2 or 3 digits below (`52`).
  5. `Height(m)` / `Height(kg)` -> Decimal or 2-3 digits below (`1.71`).
  6. `Address` -> Starts with `-, -, `, ALL CAPS with commas, ending with 4-8 digit ZIP/Postal code (`-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110`).
  7. `License No.` -> Mixed capital letters and numbers with dashes (`J07-22-302560`).
  8. `Last Name, First Name, Middle Name` -> ALL CAPS (`SUICO, JHONMARK AMACA`).
  9. Optional Indications (`Expiration Date`, `Agency Code`, `Blood Type`, `Eyes Color`, `DL Codes`, `Conditions`).

---

## Category 3: Worker & Registration Form Integration (`idScanWorker.ts`, `validators.ts`, `RegisterPage.tsx`)

### Phase 3.1: Worker Priority & Optical Disambiguation
- [x] **Task 4**: Update `executeFullCardScan` in `src/Libs/Vision/idScanner/idScanWorker.ts` and `validators.ts` to strip PascalCase headers from `extractedMap`, prioritize `pascalParsed` and `fsmParsed`, and normalize optical confusions.
- [x] **Task 5**: Update `applyUploadedIdScanResult` in `src/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage.tsx` to sanitize form fields against `isPascalCaseLabel`.

---

## Category 4: Automated Verification & Live Browser Testing

### Phase 4.1: Execute Verification Suites
- [x] **Task 6**: Run `verify_text_extractor_engine.ts`, `verify_uploaded_id_ocr_pipeline.ts`, `test_vision_and_biometrics.ts`, `inspect_genuine_id_ocr.ts`, and `npm run build`.
