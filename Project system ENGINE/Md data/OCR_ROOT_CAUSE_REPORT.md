# OCR ROOT CAUSE REPORT — EVIDENCE-GROUNDED FAILURE ANALYSIS

## Executive Summary

Reverse engineering of `Frontend/src/Libs/Vision/idScanner/` and `Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage.tsx` identified **9 deterministic root causes** explaining why valid uploaded front and back Philippine government IDs produce corrupted dates, mutated license numbers, swapped/overwritten fields, and false-positive green `AUTOFILL VERIFIED` badges.

---

## Root Cause 1: Hardcoded Sample-Specific Date & Year Overrides (`2000/2006/2008/2009 -> 2004`)

### Evidence
- `Frontend/src/Libs/Vision/idScanner/idScanWorker.ts` (lines 261–266):
  ```ts
  // Resolve OCR 0/4/8/9 confusion in year: e.g. 2008, 2009, 2998 -> 2004
  if (isDobField && (yyyy === '2008' || yyyy === '2009' || yyyy === '2998' || yyyy === '2000' || yyyy === '2006')) {
      yyyy = '2004';
  }
  ```
- `Frontend/src/Libs/Vision/idScanner/idScanWorker.ts` (lines 705–706):
  ```ts
  } else if (rawDob.includes('20040220') || rawDob.includes('3035050') || rawDob.includes('304000045')) {
      dateOfBirth = '2004/02/20';
  }
  ```
- `Frontend/src/Libs/Vision/idScanner/textExtractor.ts` (lines 500–502):
  ```ts
  if (zoneField === 'dateOfBirth' && (yyyy === '2008' || yyyy === '2009' || yyyy === '2998' || yyyy === '2000' || yyyy === '2006')) {
      yyyy = '2004';
  }
  ```

### Impact
Any cardholder legitimately born in `2000`, `2006`, `2008`, or `2009` has their birth year silently rewritten to `2004` (`Age: 22`), corrupting both `dateOfBirth` and computed `age`.

---

## Root Cause 2: Hardcoded LTO License Number Prefix & Suffix Rewrites (`I/1/T/3/9 -> J`, `0Z -> 07`, `88/80/68 -> 60`)

### Evidence
- `Frontend/src/Libs/Vision/idScanner/validators.ts` (lines 702–744):
  ```ts
  if (firstChar === 'I' || firstChar === '1' || firstChar === 'T' || firstChar === '3' || firstChar === '9') {
      firstChar = 'J';
  }
  if (restRaw.length >= 2 && restRaw[0] === '0' && (restRaw[1] === 'Z' || restRaw[1] === 'z')) {
      restRaw = '07' + restRaw.slice(2);
  }
  ...
  if (p3.endsWith('88') || p3.endsWith('80') || p3.endsWith('68')) {
      p3 = p3.slice(0, 4) + '60';
  }
  ```

### Impact
Legitimate LTO Driver's License numbers starting with `I` or ending in `88`, `80`, or `68` are deterministically mutated to start with `J` and end with `60` (overfit to a single Zamboanga Peninsula `J07-23-004960` test card).

---

## Root Cause 3: Whole-Card `onDeviceWasmOcr.ts` Overwriting Template ROI Fields & Running Front Parser on Back Side

### Evidence
- `Frontend/src/Libs/Vision/idScanner/idScanEngine.ts` (lines 276–301):
  ```ts
  const wasmResult = await scanCardWithOnDeviceWasm(sourceCanvas, targetCategory);
  ...
  mergedFields = {
      ...workerResult.fields,
      ...Object.fromEntries(validWasmEntries),
  };
  ```
- `onDeviceWasmOcr.ts` (lines 43–67) binarizes the entire card with a hard threshold (`val < 135 ? 0 : 255`), runs `PSM.AUTO` across the full card, and feeds the noisy whole-card text into `parseDynamicIdAnchors(rawText)`.
- `idScanEngine.ts` runs this step **even when `side === 'back'`**, allowing noisy tokens on the back of the card to overwrite or fabricate front-side fields (`fullName`, `idNumber`, `address`).

### Impact
1. Carefully cropped, upscaled, and multi-thresholded ROI values from `idScanWorker.ts` are overwritten by lower-accuracy whole-card OCR.
2. Back-side uploads trigger front-side anchor heuristics.
3. Hard thresholding at `135` obliterates low-contrast characters on colored guilloche backgrounds (LTO blue/pink security waves, PhilSys holographic patterns, Passport data pages).

---

## Root Cause 4: Missing `IdSideClassifier` and Missing `IdVersionClassifier`

### Evidence
- `idScanWorker.ts` accepts `side: 'front' | 'back'` solely from the caller (`RegisterPage.tsx` upload slot) and never verifies whether the image actually shows the front, back, or a document page.
- `idSpecs.ts` models each ID category as a single static spec (`drivers`, `philsys`, `umid`, `prc`, `postal`, `passport`), ignoring layout differences between:
  - LTO Old Restriction-Code cards (`Restrictions: 1, 2...`) vs. LTO New DL-Code cards (`DL Codes: A, A1, B...`).
  - PhilSys Physical PVC vs. Paper ePhilID vs. Digital National ID.
  - UMID Generic vs. SSS Card vs. GSIS eCard.
  - PRC Physical PIC vs. Digital e-PIC.

### Impact
Uploading an ID version whose field positions differ from the single hardcoded ROI map crops adjacent labels or neighboring values into the wrong field. Uploading the back image into the front slot (or vice versa) extracts garbage without warning the user.

---

## Root Cause 5: Silent Fallback to `'philsys'` When Document Type Classification Fails

### Evidence
- `Frontend/src/Libs/Vision/idScanner/idScanWorker.ts` (line 474):
  ```ts
  let detectedCategory: GovernmentIdCategory = targetCategory || 'philsys';
  ```

### Impact
When an unknown, unsupported, or low-clarity image is uploaded, the pipeline never returns `'unknown'` or `needsManualTypeSelection: true`; instead it silently applies PhilSys or user-selected ROI boxes and attempts to force-parse unrelated text.

---

## Root Cause 6: Artificial Confidence Floor & Misleading Green `AUTOFILL VERIFIED` Badge

### Evidence
- `idScanWorker.ts` (line 837):
  ```ts
  const confidence = scanSuccess ? Math.max(rawConfidence, side === 'back' ? 0.78 : 0.68) : ...
  ```
- `idScanEngine.ts` (line 446):
  ```ts
  const calculatedConfidence = wasmResult?.success ? Math.max(workerResult.confidence, wasmResult.confidence, 0.88) : workerResult.confidence;
  ```
- `RegisterPage.tsx` (lines 508, 517, 1780–1782):
  ```ts
  confidence: Math.max(68, Math.round(confidenceScore * 100))
  ...
  AUTOFILL VERIFIED ({autofillBadge.confidence}% CONFIDENCE)
  ```
- `AuthService.cs` (lines 149–150):
  ```csharp
  ConfidenceScore = 0.95,
  DocumentCheckStatus = "FORMAT_VALID",
  ```

### Impact
Even when critical fields have `0%` confidence, fail format checks, or require manual review, the user sees a green `AUTOFILL VERIFIED (88% CONFIDENCE)` badge, and the database records `0.95 / FORMAT_VALID`.

---

## Root Cause 7: Label Bleed & Concatenated PascalCase Header Contamination

### Evidence
- When ROI crops slightly overlap the printed field header (e.g., `Last Name, First Name, Middle Name`, `Apelyido`, `Unang Pangalan`, `License No.`, `Date of Birth`, `Nationality`, `Sex`), Tesseract outputs concatenated label tokens (`SurnameFirstNameMiddleName`, `LicenseNo`, `Height(m)`).
- While `textExtractor.ts` strips a subset of prefixes, multi-line ROI crops frequently retain part of the header on line 1 or bleed into the adjacent column (`Nationality PHL`, `Sex M`, `Weight 52`) when line segmentation is not separated from value lines.

---

## Root Cause 8: LTO Height/Weight Unit & Field Separation Ambiguity

### Evidence
- LTO Driver's Licenses print Height in **meters** (`Height(m): 1.71`) and Weight in **kilograms** (`Weight(kg): 52`) on the **Front** side.
- `RegisterPage.tsx` (line 1744) erroneously tells users that the **Back** ID dropzone `[AUTO-EXTRACTS ADDRESS, WEIGHT, HEIGHT & BARCODE]`, while `idScanWorker.ts` (lines 787–793) actually clears `address`, `weight`, and `height` when `side === 'back'`.
- Furthermore, LTO `License No.`, `Serial No.`, `Agency Code`, `DL Codes` (`A, A1, B, B1, B2`), and `Conditions` (`1, 2, 3, 4, 5` / `A, B`) are not tracked as distinct structured fields with separate provenance.

---

## Root Cause 9: Missing Per-Field Provenance & Front/Back Cross-Check

### Evidence
- `IdScanResult` returns flat `fields: Record<string, string>` and `fieldConfidences: Record<string, number>`, omitting `rawText`, `normalizedValue`, `sourceSide`, `sourceRegion`, `ocrMethod`, `validation`, `status` (`ACCEPTED_FOR_PREFILL` | `REQUIRES_REVIEW` | `NOT_EXTRACTED`), and `warnings`.
- There is no `FrontBackConsistencyChecker` comparing Front VIZ vs. Back QR/PDF417/MRZ/Serial to detect mismatched front and back uploads from different cards.
