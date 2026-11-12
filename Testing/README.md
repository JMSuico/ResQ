# ResQTrack Incident AI Detection System — Centralized Testing Directory

> **Canonical Test Directory:** `C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Testing`  
> **Permanent Architectural Rule:** All future and existing test files must always be placed and maintained within this directory.

---

## Directory Layout

```
Testing/
├── Backend/
│   ├── Backend.Tests.csproj              # .NET 10 xUnit test project
│   ├── SecurityAndPersistenceTests.cs    # 13 xUnit security, lockout, and password tests
│   └── UnitTest1.cs                      # Base assertion contract
├── Frontend/
│   ├── VisionTests/                      # Specialized Computer Vision & DIP Test Suite
│   │   ├── verify_dip_core.ts
│   │   ├── verify_dynamic_anchor_parser.ts
│   │   ├── verify_face_recognition_and_biometrics.ts
│   │   ├── verify_geometric_facial_patterns.ts
│   │   ├── verify_ocr_ccl.ts
│   │   ├── verify_pascal_indication_and_noise_rejection.ts
│   │   ├── verify_text_extractor_engine.ts
│   │   ├── verify_uploaded_id_ocr_pipeline.ts
│   │   └── verify_vision.ts
│   ├── test_ph_id_ocr_pipeline.ts        # 84-test Philippine Government ID OCR benchmark
│   ├── verify_dynamic_anchor_parser.ts   # Dynamic anchor and spatial indication test
│   ├── verify_multi_role_ports.ts        # Multi-role clearance & port origin isolation test
│   ├── verify_user_issues_and_map_fixes.ts # Tactical map, draggable modal, and age auto-calc
│   ├── strict_challenge_production_verification.ts # End-to-end multi-role live portal check
│   ├── challenge_verify_all_user_creation.ts # Automated user provisioning test
│   ├── test_incident_e2e_flow.ts         # Incident creation, dispatch, and lifecycle test
│   ├── e2e_verify_geometric_hud.ts       # Facial HUD and active liveness test
│   ├── e2e_verify_map_zoom_focus.ts      # Leaflet map zooming and focus test
│   ├── test_tactical_map_stability.ts    # Tactical map rendering & resize stability test
│   ├── test_vision_and_biometrics.ts     # Biometric enrollment and crosshair target verification
│   ├── verify_accounts_and_dispatch.ts   # Account credentials and dispatch channel verification
│   ├── verify_map_and_dual_approval_workflows.ts # Dual-approval workflows & map telemetry
│   ├── verify_map_draggable_and_dob_age.ts # Drag-drop coordinate updates and age math
│   ├── verify_registration_autofill_and_map_e2e.ts # End-to-end citizen registration & autofill
│   ├── inspect_genuine_id_ocr.ts         # Deep inspection of genuine ID OCR bounding boxes
│   ├── inspect_last_scan.ts              # Diagnostic tool for last captured camera frame
│   ├── test_pascal_indication_parser.ts  # PascalCase indicator token parser tests
│   ├── test_id_scan_freeze_and_autofill_browser.ts # Headless browser scan freeze simulation
│   ├── test_register_flow_browser.ts     # Automated CDP registration workflow test
│   ├── test_user_upload_investigation.ts # File payload ingestion test
│   ├── test_webcam_shot.ts               # Virtual video frame capture test
│   ├── check_dim.ts                      # Image dimension & DPI calculation test
│   └── debug_quad_detection.ts           # Corner quad detection debugging test
├── run_all_tests.ps1                     # Unified 1-click test runner (Backend + OCR + Multi-Port)
└── README.md                             # This documentation
```

---

## How to Execute Tests

### 1. Unified 1-Click Master Runner
```powershell
powershell -ExecutionPolicy Bypass -File "Testing\run_all_tests.ps1"
```

### 2. Backend .NET 10 Unit Tests
```powershell
dotnet test "Testing\Backend\Backend.Tests.csproj"
```

### 3. Philippine ID Recognition & OCR 84-Test Benchmark
```powershell
npx tsx "Testing\Frontend\test_ph_id_ocr_pipeline.ts"
```

### 4. Dynamic Anchor Parser Test
```powershell
npx tsx "Testing\Frontend\verify_dynamic_anchor_parser.ts"
```

### 5. Multi-Role Port Clearance Test
```powershell
npx tsx "Testing\Frontend\verify_multi_role_ports.ts"
```
