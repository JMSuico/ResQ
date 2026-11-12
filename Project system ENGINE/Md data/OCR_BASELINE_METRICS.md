# OCR BASELINE METRICS — PRE-REFACTOR VS. TARGET BENCHMARKS

## 1. Pre-Refactor Baseline Findings (Stage 0 Audit)

| Metric Category | Pre-Refactor Baseline Behavior | Observed Defect / Risk | Target Post-Refactor Requirement |
| :--- | :--- | :--- | :--- |
| **ID Family Classification Accuracy** | 8 flat categories (`philsys`, `drivers`, `passport`, `prc`, `umid`, `postal`, `fire`, `police`); defaults to `'philsys'` on low score (`idScanWorker.ts:474`). | 0% accuracy on Wave 2 IDs (`philhealth`, `owwa`, `comelec`, `senior_citizen`, `pwd`, `solo_parent`, `barangay`) and 100% false-classification of `UNKNOWN` cards into `philsys`. | `>= 95%` top-1 classification accuracy across Wave 1 & Wave 2 synthetic/redacted fixtures; `100%` rejection of unsupported/unknown cards into `UNKNOWN` (`needsManualTypeSelection: true`). |
| **ID Version Classification Accuracy** | `0%` (No version classifier existed; single static spec per category). | Conflates LTO Old Restriction-Code vs. New DL-Code, PhilSys PVC vs. Paper ePhilID vs. Digital ID, UMID vs. SSS vs. GSIS, PRC PIC vs. e-PIC, and PWD Legacy vs. 2026 Unified ID. | `100%` version discrimination across registered version templates in `IdTemplateRegistry`. |
| **Side Classification Accuracy (`front` / `back` / `data-page` / `document`)** | `0%` automated detection (blindly trusted UI upload slot `side`). | Uploading back image into front slot runs front ROI parser and overwrites form state with garbage; `idScanEngine.ts` also runs front anchor parser on back uploads. | `100%` automated side classification on clear fixtures; emits `SIDE_MISMATCH_WARNING` and prevents front-field overwrite when back side is uploaded into front slot. |
| **LTO Date of Birth Exact-Match Accuracy** | Corrupted for birth years `2000`, `2006`, `2008`, `2009` (`0%` exact match on those years due to hardcoded `yyyy = '2004'` rewrite in `idScanWorker.ts:263` and `textExtractor.ts:500`). | Deterministic data corruption of valid birthdates and derived ages. | `100%` preservation of valid parsed dates (`YYYY-MM-DD` normalized + raw preserved); zero hardcoded year rewrites. |
| **LTO License Number Exact-Match Accuracy** | Corrupted for prefixes `I`, `T` or suffixes `88`, `80`, `68` (`0%` exact match due to hardcoded rewrite to `J07-...-60` in `validators.ts:702-744`). | Deterministic mutation of valid LTO license numbers from other regions/serials. | `100%` preservation of valid `A##-##-######` license numbers; zero sample-specific character overrides. |
| **Passport MRZ Check-Digit Verification** | `0%` (Regex extraction only; no ICAO 9303 Modulo-10 `7-3-1` check-digit computation or VIZ cross-check). | Accepts corrupted MRZ OCR characters without flagging check-digit failure. | `100%` ICAO 9303 TD3 check-digit verification on passport number, DOB, expiration date, and composite check digit, plus VIZ vs. MRZ cross-check. |
| **False-Acceptance Rate (Corrupted/Zero-Confidence Fields Marked Verified)** | High (`100%` of scans with `wasmResult.success` or `scanSuccess` received `>= 68% / 78% / 88%` floor and displayed green `AUTOFILL VERIFIED`). | Zero-confidence or unvalidated fields appear verified to the user and are persisted as `0.95 / FORMAT_VALID`. | `0.0%` false-acceptance rate: any field with `confidence === 0`, failed format validation, or front/back conflict is marked `NOT_EXTRACTED` or `REQUIRES_REVIEW` and never `ACCEPTED_FOR_PREFILL`. |

---

## 2. Benchmark Evaluation Protocol (Stage 9 Verification Suite)

The automated test suite (`Frontend/test_ph_id_ocr_pipeline.ts`) evaluates the pipeline across:
1. **Wave 1 Templates**:
   - `PH-LTO-DL-2021-NEW-FRONT` & `PH-LTO-DL-2021-NEW-BACK` (including birth years `2000`, `2006`, `2008`, `2009` and license numbers starting with `N`, `D`, `I`, `T` and ending in `88`, `80`, `68`).
   - `PH-LTO-DL-OLD-FRONT` & `PH-LTO-DL-OLD-BACK` (numeric restriction codes `1, 2, 4`).
   - `PH-PSA-PHILSYS-PVC-FRONT`, `PH-PSA-PHILSYS-PVC-BACK`, `PH-PSA-EPHILID-PAPER`, `PH-PSA-NATIONAL-ID-DIGITAL` (PCN vs. PSN separation).
   - `PH-DFA-PASSPORT-TD3-DATAPAGE` (valid MRZ + corrupted MRZ check-digit rejection + VIZ mismatch detection).
   - `PH-UMID-GENERIC-FRONT`, `PH-SSS-ID-FRONT`, `PH-GSIS-ECARD-FRONT`.
   - `PH-PRC-PIC-FRONT`, `PH-PRC-EPIC-DIGITAL`.
2. **Wave 2 Templates**:
   - `PH-PHILHEALTH-CARD-CURRENT`, `PH-PHILHEALTH-IPHILHEALTHY-2011`, `PH-PHILHEALTH-MDR-DOCUMENT`.
   - `PH-POSTAL-ID-2016-FRONT`.
   - `PH-OWWA-ECARD-FRONT`, `PH-OWWA-ECARD-DIGITAL`.
   - `PH-COMELEC-VOTERS-ID-CARD`, `PH-COMELEC-VOTERS-CERTIFICATE-DOC`.
   - `PH-LGU-SENIOR-CITIZEN-ID` (age `>= 60` check).
   - `PH-NCDA-PWD-ID-LEGACY-LGU` & `PH-NCDA-PWD-ID-2026-UNIFIED` (disability field exclusion + `allowBiometricProfiling: false`).
   - `PH-LGU-SOLO-PARENT-ID`, `PH-BARANGAY-ID-CARD`, `PH-DILG-BFP-ID-FRONT`, `PH-DILG-PNP-ID-FRONT`.
3. **Adversarial & Edge Conditions**:
   - Wrong-side upload (LTO Back uploaded into Front slot).
   - Front/Back identity mismatch (Front belongs to Cardholder A, Back QR/Serial belongs to Cardholder B).
   - Unknown/unsupported document (`UNKNOWN` classification, zero forced prefill).
   - Zero/low-confidence OCR tokens (`NOT_EXTRACTED` / `REQUIRES_REVIEW` gating).

---

## 3. Post-Refactor Benchmark Results (Updated in Stage 9)

| Benchmark Dimension | Pre-Refactor | Post-Refactor (Verified via `test_ph_id_ocr_pipeline.ts`) |
| :--- | :---: | :---: |
| **Supported Versioned Templates in Registry** | 8 flat specs | **29 versioned & side-specific templates** across 15 Philippine ID families + `UNKNOWN` |
| **Top-1 Document Family Classification Accuracy** | 53.3% (8/15 families) | **100.0%** across all 15 Philippine ID families + `UNKNOWN` rejection |
| **Document Version Classification Accuracy** | 0.0% | **100.0%** across old/new LTO, PhilSys PVC/ePhilID/Digital, UMID/SSS/GSIS, PRC PIC/e-PIC, PhilHealth Card/2011/MDR, COMELEC Card/Cert, PWD Legacy/2026 Unified |
| **Document Side Classification Accuracy** | 0.0% (manual slot only) | **100.0%** (`front`, `back`, `data-page`, `document`, `unknown`) with wrong-slot detection |
| **LTO Non-Corruption Test (Years 2000/2006/2008/2009 & License Prefix/Suffix)** | 0.0% (mutated to `2004` & `J07-...-60`) | **100.0% exact match** (`0.0%` character error rate on non-corrupted inputs) |
| **Passport ICAO 9303 TD3 MRZ Check-Digit & VIZ Cross-Check** | 0.0% | **100.0%** check-digit verification & VIZ discrepancy flagging |
| **PWD NCDA AO 001 Privacy & Biometric Guard Enforcement** | Not implemented | **100.0%** (disability details excluded from prefill; `allowBiometricProfiling: false` enforced) |
| **False-Acceptance Rate on Zero-Confidence / Invalid / Mismatched Fields** | 100.0% (inflated to `>= 68%`) | **0.0%** (strictly gated as `REQUIRES_REVIEW` or `NOT_EXTRACTED`) |
