# ID OCR IMPLEMENTATION DECISIONS — ARCHITECTURAL DECISION RECORD (ADR)

## ADR-ID-01: Template-, Version-, and Side-Aware Recognition Before Field Extraction
- **Decision**: Never run field extraction or form autofill until the uploaded image has passed through `DocumentQualityAnalyzer`, `IdTypeClassifier`, `IdSideClassifier`, and `IdVersionClassifier`.
- **Rationale**: Different Philippine IDs—and different versions/sides of the same ID family (e.g., LTO Old Restriction-Code vs. LTO 2021+ DL-Code, PhilSys PVC vs. Paper ePhilID vs. Digital ID, PhilHealth Card vs. MDR Document)—place fields in different spatial regions and use different label anchors.
- **Fallback**: When classification confidence is below threshold (`< 0.45`), classify as `UNKNOWN` (`needsManualTypeSelection: true`) and never force-route the image through the LTO or PhilSys parser.

## ADR-ID-02: Elimination of All Sample-Specific Hardcoded Mutations
- **Decision**: Remove all hardcoded sample-specific overrides in `idScanWorker.ts` (`yyyy === '2008' || '2009' || '2000' || '2006' -> '2004'`, `2004/02/20`), `textExtractor.ts` (`yyyy -> '2004'`), and `validators.ts` (`I/1/T/3/9 -> J`, `0Z -> 07`, `88/80/68 -> 60`).
- **Rationale**: Overfitting to a single test card corrupts real civilian and responder data across Katipunan, Zamboanga del Norte and the Philippines. OCR ambiguity must be handled via multi-threshold consensus, format validation, and `REQUIRES_REVIEW` status rather than silent value replacement.

## ADR-ID-03: ROI-First Extraction Precedence Over Whole-Card OCR
- **Decision**: Template-aligned ROI extraction (`RegionOcrService` / `idScanWorker.ts`) is the primary VIZ extraction channel for card layouts. Whole-card anchor parsing (`dynamicAnchorParser.ts`) is restricted to supplementing missing fields (`!existingField`) or handling variable-layout LGU/document templates (`document` side), and must **never** overwrite a validated ROI field or run front-side heuristics on a `back` image.
- **Rationale**: Whole-card binary thresholding (`val < 135 ? 0 : 255` in `onDeviceWasmOcr.ts`) destroys colored guilloche security backgrounds and previously overwrote clean ROI crops.

## ADR-ID-04: Machine-Readable Channels (MRZ / QR / PDF417 / Barcode) Cross-Check VIZ
- **Decision**: When a document contains a machine-readable zone (Passport ICAO 9303 TD3 MRZ, PhilSys QR, LTO back barcode/serial, PRC/OWWA/Postal/PWD 2026 QR), parse both the machine-readable channel and the VIZ, compute check digits where defined (ICAO 9303 `7-3-1` Modulo-10), and compare overlapping fields via `FrontBackConsistencyChecker`.
- **Rationale**: Prevents front/back mix-ups (uploading Front of Person A and Back of Person B) and catches OCR character substitutions in VIZ names, dates, and ID numbers.

## ADR-ID-05: Strict Separation of 5 Verification Dimensions & Calibrated Confidence
- **Decision**: Remove all artificial confidence floors (`Math.max(..., 0.68 / 0.78 / 0.88)`). Every extracted field carries an `ExtractedField<T>` provenance envelope with calibrated confidence (`0.0` to `1.0`) and explicit status:
  - `ACCEPTED_FOR_PREFILL`: `confidence >= threshold` AND format/semantic validation passed AND no front/back conflict.
  - `REQUIRES_REVIEW`: extracted text exists but has low/medium confidence, OCR cleanup warning, or cross-check discrepancy.
  - `NOT_EXTRACTED`: no text extracted (`confidence = 0`).
- **Verification Separation**:
  1. **OCR Extraction Status**: Were characters read and parsed?
  2. **Document Format & Consistency Status**: Did regex, date logic, check digits, and front/back consistency pass?
  3. **Official Issuer Verification Status**: Checked against PSA/LTO/PRC/DFA/NCDA official registry (`not_checked` / `pending_official_check` when offline).
  4. **Facial Biometric & Liveness Status**: Live camera 4-pose challenge vs. ID portrait (`FaceVerified`).
  5. **Account Approval Status**: LDRRMO Admin governance (`AccountStatus.Pending`).

## ADR-ID-06: Data Minimization & NCDA AO No. 001 (2026) PWD Privacy Protection
- **Decision**:
  1. **PhilSys**: Extract and prefill only the 16-digit public **PhilSys Card Number (PCN)**; never store or expose the internal PhilSys Number (PSN) in registration prefill.
  2. **PWD ID (Legacy LGU & Sept 9, 2026 NCDA AO No. 001 Unified PWD ID)**: Exclude disability type, severity, cause, and functional limitations from registration autofill (`excludedSensitiveFields`), and set `allowBiometricProfiling: false` so the PWD card facial image is never used for automated facial profiling without an explicit alternate verification path.
  3. **Solo Parent / Voter / MDR**: Extract only identity, address, and document control fields needed for emergency dispatch registration.
