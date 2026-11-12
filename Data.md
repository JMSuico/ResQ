 COMPREHENSIVE SYSTEM AUDIT, TECHNICAL DISCOVERY, ARCHITECTURE REVIEW, AND IMPLEMENTATION ASSESSMENT
  ──────
  ## 1. Executive Summary
  This technical audit establishes an evidence-grounded baseline of the ResQTrack Incident AI System Detection
  workspace located at C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Project system ENGINE. Every conclusion in
  this report is derived directly from static and runtime inspection of the actual C# .NET 10 backend source files,
  React 19 + TypeScript 6 frontend modules, Entity Framework Core data models, vision WebWorkers, and verification
  test suites.
  ### Key Executive Findings
  1. Operational Core Platform: The application is a working Modular Monolith / Vertical-Slice Full-Stack Web
  Application serving three operational portals across two local ports: Port 5173 (Civilian & Emergency Responder
  Portals for RHU Medical, BFP Fire, and PNP Police) and Port 5174 (LDRRMO Executive Command & Super Admin Portal),
  backed by an ASP.NET Core (.NET 10) Web API on Port 5000.
  2. Computer Vision & Biometric Implementation Reality:
      • No .NET OpenCV libraries (OpenCvSharp4 or Emgu.CV) are installed or used. All image processing, document
      detection, OCR, face detection, landmark extraction, and biometric comparison execute client-side in
      TypeScript/JavaScript and WebAssembly inside the browser.
      • Government ID OCR operates as a 3-tier hybrid pipeline:
          1. Tier 1 (Primary Upload OCR): On-device tesseract.js (^7.0.0) WebAssembly LSTM OCR (onDeviceWasmOcr.ts)
          paired with a Dynamic Statutory Anchor Header Parser (dynamicAnchorParser.ts).
          2. Tier 2 (Deterministic CV & Interactive Crosshair): Pure TypeScript Digital Image Processing (Grayscale,
          CLAHE, Sauvola adaptive thresholding, Canny/Hough quadrilateral contour detection, DLT homography warp, 8-
          connected CCL, and 16x16 FONT_BANK template glyph matching) in idScanWorker.ts and textExtractor.ts.
          3. Tier 3 (Cloud AI Standby): Optional backend proxy (IdentityController.cs → IdentityAiService.cs)
          supporting Gemini 2.5 Flash, OpenAI GPT-4o, and Azure Document Intelligence when environment keys are
          configured (currently unconfigured in local .env, returning NullAiProvider).
      • Facial Recognition & Liveness combines Google MediaPipe FaceLandmarker (@mediapipe/tasks-vision@^1.2.2) for
      478-point 3D facial mesh + 52 blendshapes (mediaPipeFaceEngine.ts) with a classical deterministic YCbCr skin-
      chrominance + 68-point anthropometric landmark + 128-D hybrid descriptor engine (64-D CS-LBP + 32-D Gabor + 16-
      D Geometric Ratios + 16-D Haar Wavelets) in skinFaceTracker.ts and geometricFacePatternEngine.ts.
  3. Critical Architectural Gaps Discovered:
      • Biometric Descriptors and Multi-Angle Frames Are Not Persisted in the Database:
      BiometricFrameCacheStore.persistToDatabaseSimulation only simulates database progress on the frontend
      (setTimeout delays totaling 1,325 ms) and outputs a single composite/best PNG dataUrl. Only that single PNG is
      sent in RegisterRequest.FaceCaptureDataUrl to POST /api/register. The 128-D facial feature vector, landmark
      coordinates, liveness telemetry, and individual pose frames are discarded when biometricFrameCache.clear() runs.
      • No Repeat Biometric Facial Login Exists: Because no facial descriptors or enrollment templates are stored in
      the backend Users table, LoginPage.tsx and AuthService.LoginAsync support manual email + password
      authentication only.
      • Registration Field Drop-Off Between Frontend and Backend: While RegisterPage.tsx extracts firstName,
      middleName, lastName, dateOfBirth, sex, address, licenseNumber, weight, and height, RegisterPayload and
      AuthService.RegisterAsync drop middleName, address, weight, height, and exact dateOfBirth (approximating
      DateOfBirth = DateTime.UtcNow.AddYears(-request.Age.Value)), and auto-set AccountStatus.Verified whenever
      FaceCaptureDataUrl is non-empty.
      • Cryptographic Naming Mismatch: ScryptPasswordHelper.cs and UI labels ([ARGON2.KEY]) reference Scrypt/Argon2,
      but the actual implementation uses Rfc2898DeriveBytes.Pbkdf2 with SHA512 (100,000 iterations).
  ──────
  ## 2. Actual Project Identification

   Attribute                 │ Verified Technical Fact                   │ Source Evidence
  ───────────────────────────┼───────────────────────────────────────────┼───────────────────────────────────────────
   Actual Project Name       │ ResQTrack — Smart Emergency Response      │ README.md:1-5, HealthController.cs:18-19
                             │ System with Image Processing and Real-    │
                             │ Time Tracking (Workspace root: INCIDENT   │
                             │ AI SYSTEM DETECTION)                      │
   Intended Geographic Scope │ Municipality of Katipunan (7109) &        │ SatelliteCommandMap.tsx,
                             │ Dipolog City, Zamboanga del Norte,        │ DatabaseSeeder.cs:71-75
                             │ Philippines                               │
   Intended Purpose          │ Multi-agency emergency incident           │ ReportService.cs, TriageService.cs
                             │ reporting, automated agency               │
                             │ triage/dispatch, 1-BPM live GPS distress  │
                             │ beacon telemetry, and identity-verified   │
                             │ citizen/responder onboarding.             │
   Problems Aimed to Solve   │ 1. Fake/prank emergency reports via       │ ReportService.cs:19-135, AuditHelper.cs
                             │ mandatory Government ID + Facial Liveness │
                             │ KYC.2. Delayed multi-agency coordination  │
                             │ across LDRRMO, RHU (Medical), BFP (Fire), │
                             │ and PNP (Police).3. Inaccurate incident   │
                             │ coordinates via hardware GPS lock + 60-   │
                             │ second (1-BPM) live distress beacon       │
                             │ updates.4. Unverified field evidence via  │
                             │ Laplacian blurriness checks and SHA-256   │
                             │ hash-chained audit logs.                  │
   Current Development Stage │ Functional Advanced Prototype / Late-     │ Full workspace inspection
                             │ Stage MVP under Active Development. Core  │
                             │ emergency operations, multi-port RBAC,    │
                             │ on-device OCR, and live biometric HUDs    │
                             │ are operational, while backend            │
                             │ persistence of biometric templates,       │
                             │ repeat facial login, and 2D barcode/QR    │
                             │ decoding remain unimplemented.            │
  ──────
  ## 3. Current Development Status
  ### Comprehensive Implementation Status Table

   Feature / Subsystem        │ Status Classification      │ Source File(s) & Symbols   │ Evidence & Notes
  ────────────────────────────┼────────────────────────────┼────────────────────────────┼────────────────────────────
   Multi-Port Role-Based      │ IMPLEMENTED AND WORKING    │ App.tsx:84-267,            │ Enforces strict separation
   Routing (Port 5173 vs.     │                            │ AuthService.cs:95-115      │ between Admin (5174) and
   Port 5174)                 │                            │                            │ ResponderCivilian (5173)
                              │                            │                            │ portals at both API login
                              │                            │                            │ and React Router levels.
   Tab-Isolated & Unit-Scoped │ IMPLEMENTED AND WORKING    │ apiClient.ts:24-67,        │ Prioritizes Authorization:
   Session Management         │                            │ SessionCookieHelper.cs:42- │ Bearer → X-Session-Token →
                              │                            │ 72                         │ resqtrack_session cookie
                              │                            │                            │ so RHU, BFP, PNP, and
                              │                            │                            │ Admin tabs do not collide.
   Manual Email + Password    │ IMPLEMENTED AND WORKING    │ AuthController.cs:31-45,   │ Uses PBKDF2-SHA512
   Authentication             │                            │ ScryptPasswordHelper.cs:15 │ (100,000 iterations) and
                              │                            │ -45                        │ constant-time comparison
                              │                            │                            │ (CryptographicOperations.F
                              │                            │                            │ ixedTimeEquals).
   On-Device WebAssembly OCR  │ IMPLEMENTED AND WORKING    │ onDeviceWasmOcr.ts,        │ Extracts text from
   (tesseract.js) + Dynamic   │                            │ dynamicAnchorParser.ts     │ uploaded IDs in browser
   Anchor Parser              │                            │                            │ via Tesseract LSTM WASM
                              │                            │                            │ and parses Philippine
                              │                            │                            │ statutory headers (Last
                              │                            │                            │ Name, First Name, Middle
                              │                            │                            │ Name, License No., Date of
                              │                            │                            │ Birth, Address).
   Deterministic DIP &        │ IMPLEMENTED AND WORKING    │ idScanWorker.ts,           │ Implements Grayscale,
   Crosshair ROI Text         │                            │ textExtractor.ts,          │ CLAHE, Sauvola
   Extractor                  │                            │ TextExtractorOverlay.tsx   │ binarization, 8-way CCL,
                              │                            │                            │ and 16x16 FONT_BANK glyph
                              │                            │                            │ matching + user drag-to-
                              │                            │                            │ extract ROI modal.
   Cloud AI Standby OCR       │ IMPLEMENTED BUT UNVERIFIED │ IdentityAiService.cs:1-260 │ Code is fully implemented
   Fallback (Gemini / OpenAI  │                            │ , ProviderRegistry.ts      │ on backend (POST
   / Azure)                   │                            │                            │ /api/identity/ai-extract),
                              │                            │                            │ but no cloud API keys
                              │                            │                            │ (GEMINI_API_KEY,
                              │                            │                            │ OPENAI_API_KEY,
                              │                            │                            │ AZURE_VISION_KEY) are
                              │                            │                            │ configured in the
                              │                            │                            │ environment.
   4-Stage Multi-Angle Facial │ PARTIALLY IMPLEMENTED      │ MultiAngleBiometricEngine. │ Real-time tracking, pose
   Biometric HUD & Liveness   │                            │ tsx, skinFaceTracker.ts,   │ gating (CENTER, LEFT,
                              │                            │ mediaPipeFaceEngine.ts     │ RIGHT, BLINK/UP), and 1:1
                              │                            │                            │ ID-to-live cosine
                              │                            │                            │ similarity run in browser,
                              │                            │                            │ but multi-angle frames and
                              │                            │                            │ 128-D vectors are never
                              │                            │                            │ persisted to the backend
                              │                            │                            │ database, and headless/no-
                              │                            │                            │ camera environments fall
                              │                            │                            │ back to a procedural
                              │                            │                            │ synthetic wireframe
                              │                            │                            │ (isSynthetic).
   Biometric Frame Database   │ UI ONLY / MOCK DATA        │ biometricFrameCache.ts:173 │ Uses await delay(325..350)
   Persistence                │                            │ -213                       │ to animate progress bars
   (persistToDatabaseSimulati │                            │                            │ (20% → 50% → 80% → 100%)
   on)                        │                            │                            │ without making any network
                              │                            │                            │ or database call.
   Repeat Biometric Facial    │ PLANNED BUT NOT            │ LoginPage.tsx,             │ Neither frontend UI nor
   Login (1:1 / 1:N Face Auth │ IMPLEMENTED                │ AuthController.cs          │ backend endpoint exists
   on Login)                  │                            │                            │ for logging in via facial
                              │                            │                            │ recognition.
   QR Code / PDF417 / Code128 │ PLANNED BUT NOT            │ idSpecs.ts:165-173         │ idSpecs.ts defines
   Barcode Decoding on IDs    │ IMPLEMENTED                │                            │ relative ROIs for
                              │                            │                            │ ed25519Qr, pdf417, and
                              │                            │                            │ code128, and marks them in
                              │                            │                            │ NON_TEXT_ROI_KEYS, but no
                              │                            │                            │ barcode/QR decoder library
                              │                            │                            │ is installed or
                              │                            │                            │ implemented.
   User Registration          │ PARTIALLY IMPLEMENTED      │ RegisterPage.tsx:954-971,  │ Saves User and writes
   Persistence (POST          │                            │ AuthService.cs:18-74       │ composite ID PNG + Face
   /api/register)             │                            │                            │ PNG to server-
                              │                            │                            │ data/uploads/captures/,
                              │                            │                            │ but drops MiddleName,
                              │                            │                            │ Address, LicenseNumber
                              │                            │                            │ (GovernmentIdNumber not
                              │                            │                            │ sent in RegisterPayload),
                              │                            │                            │ Weight, Height, and exact
                              │                            │                            │ DateOfBirth.
   Incident Reporting & 1-BPM │ IMPLEMENTED AND WORKING    │ ReportsController.cs:19-53 │ Full report creation,
   Distress Beacon Engine     │                            │ , useDistressBeacon.ts     │ image upload, automatic
                              │                            │                            │ agency recommendation, and
                              │                            │                            │ 1-BPM (POST
                              │                            │                            │ /api/reports/{id}/beacon)
                              │                            │                            │ live coordinate updates.
   Command Triage & Agency    │ IMPLEMENTED AND WORKING    │ IncidentsController.cs,    │ Incident verification,
   Unit Dispatch              │                            │ TriageService.cs           │ severity escalation, and
                              │                            │                            │ duty unit allocation with
                              │                            │                            │ SHA-256 audit logging.
   Agency-Specific Tactical   │ IMPLEMENTED AND WORKING    │ RespondersController.cs,   │ Persists
   Operations (RHU PCR, PNP   │                            │ RespondersService.cs       │ PatientCareRecords,
   Blotter, BFP Fire Alarm)   │                            │                            │ cryptographically sealed
                              │                            │                            │ PoliceBlotterEntries, and
                              │                            │                            │ FireAlarmStatusRecords.
   Tamper-Evident SHA-256     │ IMPLEMENTED AND WORKING    │ AuditHelper.cs,            │ Chains PreviousHash +
   Hash-Chained Audit Trail   │                            │ AuditLogRepository.cs      │ timestamp + actor + action
                              │                            │                            │ + payload into
                              │                            │                            │ CurrentHash.
   Duplicate / Legacy         │ DEPRECATED / UNUSED        │ Home.tsx, Login.tsx,       │ Superseded by the active
   Frontend Page Components   │                            │ LoginPage.tsx,             │ components wired in
                              │                            │ DashboardPage.tsx,         │ App.tsx:12-42.
                              │                            │ IncidentsBoard.tsx,        │
                              │                            │ UserGovernance.tsx         │
   ASP.NET Core JwtBearer     │ DEPRECATED / UNUSED        │ Backend.csproj:12          │ Microsoft.AspNetCore.Authe
   NuGet Package              │                            │                            │ ntication.JwtBearer
                              │                            │                            │ (10.0.12) is installed in
                              │                            │                            │ Backend.csproj, but
                              │                            │                            │ Program.cs uses custom
                              │                            │                            │ opaque SHA-256 session
                              │                            │                            │ tokens via
                              │                            │                            │ SessionVerificationMiddlew
                              │                            │                            │ are.cs.
  ──────
  ## 4. Complete Project Structure
    C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\
    ├── README.md                                           # Root architecture & governance pointer
    ├── INSTALL_ALL_REQUIREMENTS.bat                        # Automated Windows dependency & DB installer
    ├── Md data/                                            # Architectural governance & timestamped plans
    │   ├── AGENTS.md
    │   ├── CLAUDE.md
    │   ├── GEMINI.md
    │   ├── SKILL.md
    │   └── Plans/
    └── Project system ENGINE/                              # Main application workspace
        ├── SETUP_NEW_PC.bat                                # New machine bootstrapper
        ├── START_RESQTRACK.bat                             # One-click multi-port launcher
        ├── start.ps1                                       # PowerShell orchestrator & CLI runner
        ├── Backend/                                        # .NET 10 ASP.NET Core Web API (Port 5000)
        │   ├── Backend.csproj
        │   ├── Dockerfile
        │   ├── Program.cs
        │   ├── appsettings.json
        │   ├── appsettings.Development.json
        │   ├── server-data/uploads/                        # Local disk storage for IDs, faces, & reports
        │   │   ├── captures/                               # ID_... & FACE_... images
        │   │   └── reports/                                # REPORT_... incident photos
        │   └── Features/
        │       ├── Api/
        │       │   ├── Controllers/                        # 10 REST API Controllers
        │       │   ├── DTOs/                               # 6 Request/Response record files
        │       │   └── Middleware/                         # GlobalException & SessionVerification
        │       ├── Data/
        │       │   ├── AppDbContext.cs                     # EF Core DbContext (11 DbSets)
        │       │   ├── Enums/ResQTrackEnums.cs             # 8 domain enums
        │       │   └── Models/                             # 11 Entity classes
        │       ├── DBInfrastructure/
        │       │   ├── AppDbContextFactory.cs              # Design-time factory
        │       │   └── DatabaseSeeder.cs                   # Schema patcher & default data seeder
        │       ├── Helpers/Infrastructure/                 # Audit, Capture, Cookie, InputSanitizer, Password,
        Permissions
        │       ├── Management/Commands/CliCommandRunner.cs # Terminal CLI commands (createsuperadmin, etc.)
        │       ├── Repositories/
        │       │   ├── Interfaces/                         # 8 Repository interfaces
        │       │   └── Implementations/                    # 8 EF Core Repository classes
        │       └── Services/
        │           ├── Interfaces/                         # 10 Service interfaces
        │           └── Implementations/                    # 9 Service implementations
        └── Frontend/                                       # React 19 + TypeScript 6 + Vite 8 + Tailwind 3
            ├── package.json
            ├── vite.config.ts
            ├── tsconfig.app.json
            └── src/
                ├── App.tsx                                 # Master router & dual-port RBAC guard
                ├── main.tsx                                # React DOM root
                ├── Endpoints/                              # 11 typed fetch API clients
                ├── Hooks/                                  # 14 custom hooks (GPS, 1-BPM beacon, session, etc.)
                ├── LayoutBars/                             # 7 navigation/header/layout wrappers
                ├── LayoutStyles/                           # 12 CSS stylesheets (military HUD & responsive styles)
                ├── Shared/                                 # 29 atomic UI components, modals, & Leaflet map
                ├── LANDING_PAGE/Features/Pages/
                │   ├── LandingPage/LandingPage.tsx
                │   ├── LoginPage/                          # LoginPage.tsx & AdminLoginPage.tsx
                │   └── RegisterPage/                       # RegisterPage.tsx, MultiAngleBiometricEngine.tsx,
                TextExtractorOverlay.tsx
                ├── UserRoles/Features/Pages/
                │   ├── AdminsPanel/                        # LDRRMO Executive Command pages & CRUD modals
                │   ├── RespondersPanel/                    # RHU, BFP, PNP tactical pages
                │   └── CiviliansPanel/                     # Resident SOS, Live Map, Hotlines, Profile
                └── Libs/
                    ├── Assets/                             # Baseline fixtures & formatters
                    ├── Cache/biometricFrameCache.ts        # In-memory multi-angle frame store
                    ├── Map/mapAccuracy.ts                  # Katipunan 7109 geofence & GPS accuracy helpers
                    ├── Testing/                            # 21 Playwright & Node verification scripts
                    └── Vision/idScanner/                   # Computer Vision, OCR, & Facial Biometrics Engine
                        ├── binarize.ts, cannyHough.ts, cardPresenceGate.ts, ccl.ts, contour.ts
                        ├── dynamicAnchorParser.ts, fontBank.ts, glyphMatcher.ts, homography.ts
                        ├── idScanEngine.ts, idScanWorker.ts, idSpecs.ts, imageOps.ts
                        ├── onDeviceWasmOcr.ts, qualityGates.ts, templateMatch.ts, textExtractor.ts, validators.ts
                        ├── ai/                             # Cloud AI fallback adapter classes
                        ├── face/                           # skinFaceTracker.ts, mediaPipeFaceEngine.ts,
                        geometricFacePatternEngine.ts, GeometricFacePatternHUD.tsx
                        └── __tests__/                      # 9 deterministic unit & pipeline test suites
  ──────
  ## 5. Actual Technology Stack
  ### A. Programming Languages
  • C# 13 / .NET 10 (net10.0, nullable reference types enabled, implicit usings enabled, expression-bodied lambda
  conventions).
  • TypeScript (~6.0.2) / ECMAScript 2023 (Frontend application, WebWorkers, and vision/biometric modules).
  • SQL (T-SQL / PL/pgSQL / MySQL dialect) (Embedded idempotent ALTER TABLE scripts in Program.cs:120-152 and
  DatabaseSeeder.cs:20-185).
  • CSS3 / Tailwind CSS (^3.4.19).
  • PowerShell & Windows Batch (.ps1, .bat) (start.ps1, INSTALL_ALL_REQUIREMENTS.bat, SETUP_NEW_PC.bat,
  START_RESQTRACK.bat).
  ### B. Frameworks and Platforms
  • Backend: ASP.NET Core 10.0 Web API (Microsoft.NET.Sdk.Web), Entity Framework Core 10.0.12, Scalar OpenAPI UI (2.
  17.3).
  • Frontend: React (^19.2.8), React DOM (^19.2.8), React Router DOM (^7.18.3), Vite (^8.3.0), Tailwind CSS (^3.4.19),
  Leaflet (^1.9.4).
  ### C. Traditional Computer Vision vs. Machine Learning / AI Distinction (Strict Audit Rule 20)

   Subsystem / Operation     │ Category                  │ Actual Implementation & Files │ Executed / Installed / C…
  ───────────────────────────┼───────────────────────────┼───────────────────────────────┼───────────────────────────
   Grayscale, Gaussian Blur, │ Traditional Digital Image │ Pure TypeScript pixel array   │ Actively Executed on
   CLAHE, Sauvola            │ Processing (DIP)          │ operations in imageOps.ts and │ every ID scan and
   Binarization              │                           │ binarize.ts.                  │ crosshair crop.
   Canny Edge Detection,     │ Traditional Computer      │ Pure TypeScript geometry in   │ Actively Executed in live
   Hough Transform, Douglas- │ Vision                    │ cannyHough.ts, contour.ts,    │ viewfinder worker;
   Peucker Contour & DLT     │                           │ and homography.ts.            │ bypassed in fast static
   Homography                │                           │                               │ upload mode
                             │                           │                               │ (skipPerspectiveWarp).
   8-Connected Component     │ Traditional Pattern       │ Two-pass union-find CCL +     │ Actively Executed as
   Labeling (CCL) & 16x16    │ Matching                  │ Hamming/Jaccard/hu-moment     │ deterministic OCR layer
   Bitmap FONT_BANK Matching │                           │ glyph matching in ccl.ts,     │ and crosshair ROI
                             │                           │ fontBank.ts, and              │ recognizer.
                             │                           │ glyphMatcher.ts.              │
   Tesseract.js (^7.0.0)     │ Pretrained Classical/LSTM │ Runs tesseract.js in a        │ Actively Executed during
   WebAssembly OCR           │ Neural Network (WASM)     │ browser WebWorker fetching    │ Front/Back ID upload in
                             │                           │ eng.traineddata from CDN in   │ RegisterPage.tsx.
                             │                           │ onDeviceWasmOcr.ts.           │
   YCbCr Skin Segmentation,  │ Traditional Computer      │ Pure TypeScript math in       │ Actively Executed at
   Viola-Jones Integral      │ Vision & Classical        │ skinFaceTracker.ts and        │ ~28–30 FPS during
   Image Haar Cascades, 68-  │ Feature Engineering       │ geometricFacePatternEngine.ts │ biometric enrollment and
   Point Anthropometric      │                           │ . Does not train or run a     │ ID portrait extraction.
   Landmarks, 128-D Hybrid   │                           │ neural network.               │
   Descriptor (LBP + Gabor + │                           │                               │
   Geometric + Haar)         │                           │                               │
   Google MediaPipe          │ Pretrained Deep Learning  │ Loads face_landmarker.task    │ Installed & Executed when
   FaceLandmarker            │ Model (WebGL/WASM TFLite  │ from                          │ internet/CDN is
   (@mediapipe/tasks-vision) │ .task)                    │ https://storage.googleapis.co │ reachable; falls back to
                             │                           │ m/mediapipe-models/... in     │ skinFaceTracker.ts
                             │                           │ mediaPipeFaceEngine.ts.       │ offline.
   Gemini 2.5 Flash / OpenAI │ External Cloud Multimodal │ HTTP REST calls in            │ Implemented in code, but
   GPT-4o / Azure Document   │ LLM / Vision APIs         │ IdentityAiService.cs.         │ Unconfigured (no API keys
   Intelligence              │                           │                               │ present; inactive at
                             │                           │                               │ runtime).
   OpenCvSharp / Emgu CV /   │ None Installed            │ Not present in Backend.csproj │ Not Installed / Not Used.
   ONNX Runtime / PyTorch /  │                           │ or package.json.              │
   TensorFlow                │                           │                               │
  ──────
  ## 6. Installed Packages and Dependencies
  ### Backend NuGet Packages (Backend.csproj)

   Package Name │ Version   │ Direct /… │ Purpose   │ Module Us… │ Actually … │ Status / … │ Necessary? │ Recommend…
  ──────────────┼───────────┼───────────┼───────────┼────────────┼────────────┼────────────┼────────────┼────────────
   Microsoft.As │ 10.0.12   │ Direct    │ JWT       │ None       │ No (Custom │ Current    │ No         │ Remove or
   pNetCore.Aut │           │           │ Bearer    │            │ SessionVer │ (.NET 10)  │            │ replace
   hentication. │           │           │ auth      │            │ ificationM │            │            │ with
   JwtBearer    │           │           │ middlewar │            │ iddleware  │            │            │ actual JWT
                │           │           │ e         │            │ is used    │            │            │ signing if
                │           │           │           │            │ instead)   │            │            │ stateless
                │           │           │           │            │            │            │            │ auth is
                │           │           │           │            │            │            │            │ desired.
   Microsoft.As │ 10.0.11   │ Direct    │ OpenAPI   │ Program.cs │ Yes        │ Current    │ Yes        │ Retain.
   pNetCore.Ope │           │           │ 3.1       │ :24        │            │            │            │
   nApi         │           │           │ document  │            │            │            │            │
                │           │           │ generatio │            │            │            │            │
                │           │           │ n         │            │            │            │            │
   Microsoft.En │ 10.0.12   │ Direct    │ Core ORM  │ Features/D │ Yes        │ Current    │ Yes        │ Retain.
   tityFramewor │           │           │ framework │ ata/,      │            │            │            │
   kCore        │           │           │           │ Features/R │            │            │            │
                │           │           │           │ epositorie │            │            │            │
                │           │           │           │ s/         │            │            │            │
   Microsoft.En │ 10.0.12   │ Direct    │ EF Core   │ AppDbConte │ Partially  │ Current    │ Yes        │ Retain and
   tityFramewor │           │ (PrivateA │ CLI       │ xtFactory. │ (No        │            │            │ generate
   kCore.Design │           │ ssets=all │ migration │ cs         │ Migrations │            │            │ formal EF
                │           │ )         │ tooling   │            │ / folder   │            │            │ Core
                │           │           │           │            │ exists     │            │            │ migrations
                │           │           │           │            │ yet)       │            │            │ .
   Microsoft.En │ 10.0.12   │ Direct    │ In-memory │ Program.cs │ Standby    │ Current    │ Optional   │ Retain for
   tityFramewor │           │           │ database  │ (fallback) │            │            │            │ unit
   kCore.InMemo │           │           │ provider  │            │            │            │            │ testing.
   ry           │           │           │           │            │            │            │            │
   Microsoft.En │ 10.0.12   │ Direct    │ SQL       │ Program.cs │ Yes        │ Current    │ Yes        │ Retain.
   tityFramewor │           │           │ Server /  │ :43-61,    │ (Default   │            │            │
   kCore.SqlSer │           │           │ SSMS 19 / │ DatabaseSe │ Provider)  │            │            │
   ver          │           │           │ LocalDB   │ eder.cs    │            │            │            │
                │           │           │ provider  │            │            │            │            │
   Microsoft.Ex │ 10.0.14   │ Direct    │ Distribut │ Program.cs │ Partially  │ Current    │ Optional   │ Wire into
   tensions.Cac │           │           │ ed Redis  │ :67-87     │ (Registere │            │            │ SessionVer
   hing.StackEx │           │           │ cache     │            │ d in DI,   │            │            │ ificationM
   changeRedis  │           │           │           │            │ but no     │            │            │ iddleware
                │           │           │           │            │ service    │            │            │ or remove
                │           │           │           │            │ calls      │            │            │ if
                │           │           │           │            │ IDistribut │            │            │ unneeded.
                │           │           │           │            │ edCache)   │            │            │
   Npgsql.Entit │ 10.0.3    │ Direct    │ PostgreSQ │ Program.cs │ Yes        │ Current    │ Yes        │ Retain for
   yFrameworkCo │           │           │ L EF Core │ :31-35     │ (Configura │            │            │ multi-
   re.PostgreSQ │           │           │ provider  │            │ ble)       │            │            │ RDBMS
   L            │           │           │           │            │            │            │            │ support.
   Pomelo.Entit │ 9.0.0-    │ Direct    │ MySQL EF  │ Program.cs │ Standby    │ Preview /  │ No (unless │ Remove if
   yFrameworkCo │ preview.2 │           │ Core      │ :36-41     │            │ Version    │ MySQL is   │ only SQL
   re.MySql     │ .efcore.9 │           │ provider  │            │            │ Mismatch   │ required)  │ Server &
                │ .0.0      │           │           │            │            │ (efcore.9. │            │ PostgreSQL
                │           │           │           │            │            │ 0.0 on     │            │ are
                │           │           │           │            │            │ net10.0)   │            │ targeted,
                │           │           │           │            │            │            │            │ to avoid
                │           │           │           │            │            │            │            │ EF Core
                │           │           │           │            │            │            │            │ 9/10
                │           │           │           │            │            │            │            │ runtime
                │           │           │           │            │            │            │            │ conflicts.
   Scalar.AspNe │ 2.17.3    │ Direct    │ Interacti │ Program.cs │ Yes        │ Current    │ Yes        │ Retain.
   tCore        │           │           │ ve API    │ :159       │            │            │            │
                │           │           │ documenta │            │            │            │            │
                │           │           │ tion UI   │            │            │            │            │
                │           │           │ (/scalar/ │            │            │            │            │
                │           │           │ v1)       │            │            │            │            │
  ### Frontend NPM Packages (package.json)

   Package Name  │ Version       │ Section       │ Purpose        │ Module Using … │ Actually Used? │ Necessary?
  ───────────────┼───────────────┼───────────────┼────────────────┼────────────────┼────────────────┼────────────────
   @mediapipe/ta │ ^1.2.2        │ dependencies  │ 478-point 3D   │ mediaPipeFaceE │ Yes            │ Yes (or bundle
   sks-vision    │               │               │ face mesh &    │ ngine.ts       │                │ local
                 │               │               │ blendshapes    │                │                │ .wasm/.task
                 │               │               │                │                │                │ assets for
                 │               │               │                │                │                │ offline use).
   tesseract.js  │ ^7.0.0        │ dependencies  │ Client-side    │ onDeviceWasmOc │ Yes            │ Yes.
                 │               │               │ WebAssembly    │ r.ts           │                │
                 │               │               │ OCR engine     │                │                │
   leaflet       │ ^1.9.4        │ dependencies  │ Interactive    │ SatelliteComma │ Yes            │ Yes.
                 │               │               │ satellite/stre │ ndMap.tsx      │                │
                 │               │               │ et command     │                │                │
                 │               │               │ maps           │                │                │
   lucide-react  │ ^1.61.0       │ dependencies  │ Tactical HUD & │ All pages &    │ Yes            │ Yes.
                 │               │               │ UI vector      │ modals         │                │
                 │               │               │ icons          │                │                │
   react /       │ ^19.2.8       │ dependencies  │ Core UI        │ Entire         │ Yes            │ Yes.
   react-dom     │               │               │ rendering      │ frontend       │                │
                 │               │               │ framework      │                │                │
   react-router- │ ^7.18.3       │ dependencies  │ Client-side    │ App.tsx        │ Yes            │ Yes.
   dom           │               │               │ SPA routing    │                │                │
   playwright    │ ^1.64.1       │ devDependenci │ Headless       │ src/Libs/Testi │ Yes            │ Yes.
                 │               │ es            │ browser E2E    │ ng/*.ts        │                │
                 │               │               │ verification   │                │                │
   tailwindcss / │ ^3.4.19 /     │ devDependenci │ Utility-first  │ Entire         │ Yes            │ Yes.
   postcss /     │ ^8.5.28 /     │ es            │ CSS styling    │ frontend       │                │
   autoprefixer  │ ^10.6.0       │               │ pipeline       │                │                │
   typescript /  │ ~6.0.2 /      │ devDependenci │ Type checking  │ Build & dev    │ Yes            │ Yes.
   vite /        │ ^8.3.0 /      │ es            │ &              │ server         │                │
   @vitejs/plugi │ ^6.1.1        │               │ dev/production │                │                │
   n-react       │               │               │ bundler        │                │                │
  ──────
  ## 7. Overall Architecture

  ### Verified Architectural Patterns
  • Backend: Follows a Layered Architecture (Controllers → Services → Repositories → AppDbContext) organized inside a
  Features/ directory. Although README.md refers to "Katipuneros Vertical Slice Architecture," the actual folder
  structure groups files by technical layer (Features/Api/Controllers, Features/Services, Features/Repositories,
  Features/Data/Models) rather than per-feature vertical slices.
  • Frontend: Follows a Hybrid Feature-Based & Shared Component Architecture (LANDING_PAGE/Features/Pages,
  UserRoles/Features/Pages/{AdminsPanel,RespondersPanel,CiviliansPanel}, Shared/, Endpoints/, Hooks/, Libs/Vision/).
  ### System Architecture Diagram
  │ Diagram exceeds terminal width (441 > 119 cols)
  │ Displayed as code block. Widen terminal to view inline.
    flowchart TB
        subgraph Client["Browser Client (React 19 + TypeScript 6 + Vite 8)"]
            direction TB
            Port5173["Port 5173: Public, Civilian & Responder Portals<br/>(RHU / BFP / PNP / Residents)"]
            Port5174["Port 5174: LDRRMO Executive Command Portal<br/>(Super Admin Only)"]

            subgraph VisionEngine["Client-Side Vision & Biometrics Engine (src/Libs/Vision)"]
                WasmOCR["Tesseract.js WASM Worker<br/>(onDeviceWasmOcr.ts)"]
                AnchorParser["Dynamic Statutory Anchor Parser<br/>(dynamicAnchorParser.ts)"]
                DIPWorker["Deterministic DIP + CCL + 16x16 FontBank<br/>(idScanWorker.ts / textExtractor.ts)"]
                FaceEngine["MediaPipe 478-pt 3D Mesh +<br/>YCbCr Skin/68-pt/128-D Hybrid
                Tracker<br/>(mediaPipeFaceEngine.ts / skinFaceTracker.ts)"]
                FrameCache["In-Memory BiometricFrameCacheStore<br/>(biometricFrameCache.ts)"]
            end

            ApiClient["Typed Fetch Client (apiClient.ts)<br/>Bearer / X-Session-Token / Cookie"]
        end

        subgraph Backend["ASP.NET Core .NET 10 Web API (Port 5000)"]
            direction TB
            ExceptionMW["GlobalExceptionMiddleware"]
            SessionMW["SessionVerificationMiddleware<br/>(SHA-256 Token Lookup + Verified Check)"]
            Controllers["10 REST Controllers<br/>(Auth, Users, Reports, Incidents, Responders, Identity, Alerts,
            Analytics, Settings, Health)"]
            Services["9 Domain Services<br/>(Auth, UserGovernance, Report, Triage, Responders, IdentityAi, Alert,
            Analytics, Settings)"]
            Repos["8 EF Core Repositories<br/>(User, Session, Report, DutyUnit, IncidentFixture, Alert, Settings,
            AuditLog)"]
            DbCtx["AppDbContext (EF Core 10)"]
        end

        subgraph Storage["Persistence & External Services"]
            RDBMS[("SQL Server (SSMS 19 / LocalDB)<br/>or PostgreSQL (ResQTrackDb)")]
            Disk["Local File System<br/>(Backend/server-data/uploads/{captures,reports})"]
            CloudAI["Optional Cloud AI Standby<br/>(Gemini 2.5 / GPT-4o / Azure DI)"]
        end

        Port5173 --> VisionEngine
        Port5173 --> ApiClient
        Port5174 --> ApiClient
        ApiClient -->|"/api/*"| ExceptionMW
        ExceptionMW --> SessionMW
        SessionMW --> Controllers
        Controllers --> Services
        Services --> Repos
        Repos --> DbCtx
        DbCtx --> RDBMS
        Services -->|"CaptureStorageHelper"| Disk
        Services -->|"IdentityAiService (Standby)"| CloudAI

  ### Project Component Diagram

  ┌──────────────────────────────────────────────┐
  │           Frontend Portal & Shared Components           │
  │                                                         │
  │                                                         │
  │ ┌─────────────────────────────────────────────────────┐ │
  │ │                                                     │ │
  │ │       LandingPage / LoginPage / AdminLoginPage      │ │
  │ │                                                     │ │
  │ └─────────────────────────────────────────────────────┘ │
  │                                                         │
  │                                                         │
  │ ┌─────────────────────────────────────────────────────┐ │
  │ │                                                     │ │
  │ │             RegisterPage (4-Step Wizard)            │ │
  │ │                                                     │ │
  │ └──────────────────────────────────────────────────────────────────────────────────────┘ │
  │                                                                                          │
  │                                                                                          │
  │ ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
  │ │                                                                                      │ │
  │ │                 MultiAngleBiometricEngine + GeometricFacePatternHUD                  │ │
  │ │                                                                                      │ │
  │ └──────────────────────────────────────────────────────────────────────────────────────┘ │
  │                                                                                          │
  │                                                                                          │
  │ ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
  │ │                                                                                      │ │
  │ │                         TextExtractorOverlay (Crosshair ROI)                         │ │
  │ │                                                                                      │ │
  │ └──────────────────────────────────────────────────────────────────────────────────────┘ │
  │                                                                                          │
  │                                                                                          │
  │ ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
  │ │                                                                                      │ │
  │ │ AdminsPanel (Dashboard, StrategicMap, Incidents, Roster, Users, Analytics, Settings) │ │
  │ │                                                                                      │ │
  │ └──────────────────────────────────────────────────────────────────────────────────────┘ │
  │                                                                                          │
  │                                                                                          │
  │ ┌──────────────────────────────────────────────────────────────────────────────────────┐ │
  │ │                                                                                      │ │
  │ │ RespondersPanel (Dashboard, UnitIncidents, Deploy, Roster, PCR/Blotter/Alarm Modals) │ │
  │ │                                                                                      │ │
                   │                 │                  │ s                   │                   │
   Backend Data &  │ Backend/Feature │ EF Core entity   │ AppDbContext.cs,    │ SQL Server /      │ IMPLEMENTED AND
   Repositories    │ s/Data &        │ definitions,     │ UserRepository.cs,  │ PostgreSQL        │ WORKING
                   │ Repositories    │ DbContext        │ ReportRepository.cs │                   │
                   │                 │ configuration,   │ , DatabaseSeeder.cs │                   │
                   │                 │ and CRUD data    │                     │                   │
                   │                 │ access.          │                     │                   │
   Frontend ID     │ Frontend/src/Li │ Document         │ idScanEngine.ts,    │ RegisterPage.tsx, │ IMPLEMENTED AND
   Scanner & OCR   │ bs/Vision/idSca │ boundary         │ onDeviceWasmOcr.ts, │ TextExtractorOver │ WORKING
   Engine          │ nner            │ detection,       │ dynamicAnchorParser │ lay.tsx           │
                   │                 │ perspective      │ .ts,                │                   │
                   │                 │ warp, on-device  │ textExtractor.ts,   │                   │
                   │                 │ WASM OCR,        │ idSpecs.ts          │                   │
                   │                 │ dynamic anchor   │                     │                   │
                   │                 │ parsing, and CCL │                     │                   │
                   │                 │ glyph matching.  │                     │                   │
   Frontend Facial │ Frontend/src/Li │ 3D/2D facial     │ skinFaceTracker.ts, │ MultiAngleBiometr │ PARTIALLY
   Biometrics      │ bs/Vision/idSca │ landmark         │ mediaPipeFaceEngine │ icEngine.tsx,     │ IMPLEMENTED
   Engine          │ nner/face       │ tracking, head   │ .ts,                │ biometricFrameCac │ (Client-only)
                   │                 │ pose estimation, │ geometricFacePatter │ he.ts             │
                   │                 │ blink/chroma     │ nEngine.ts,         │                   │
                   │                 │ liveness, and    │ GeometricFacePatter │                   │
                   │                 │ 128-D hybrid     │ nHUD.tsx            │                   │
                   │                 │ descriptor       │                     │                   │
                   │                 │ comparison.      │                     │                   │
   Frontend Role   │ Frontend/src/Us │ Operational      │ AdminDashboard.tsx, │ src/Endpoints/*,  │ IMPLEMENTED AND
   Portals         │ erRoles/Feature │ dashboards for   │ StrategicMapPage.ts │ src/Shared/*,     │ WORKING
                   │ s/Pages         │ LDRRMO Admin,    │ x,                  │ src/Hooks/*       │
                   │                 │ RHU/BFP/PNP      │ UserManagementPage. │                   │
                   │                 │ Responders, and  │ tsx,                │                   │
                   │                 │ Civilians.       │ ResponderDashboard. │                   │
                   │                 │                  │ tsx,                │                   │
                   │                 │                  │ CivilianDashboard.t │                   │
                   │                 │                  │ sx,                 │                   │
                   │                 │                  │ CivilianLiveMapPage │                   │
                   │                 │                  │ .tsx                │                   │

  ### Module Dependency Overview Diagram

  │ Diagram exceeds terminal width (218 > 119 cols)
  │ Displayed as code block. Widen terminal to view inline.
    flowchart TD
        App["App.tsx"] --> Landing["LANDING_PAGE/Features/Pages/*"]
        App --> Portals["UserRoles/Features/Pages/{Admins,Responders,Civilians}Panel/*"]
        Landing --> Vision["Libs/Vision/idScanner/*"]
        Landing --> Face["Libs/Vision/idScanner/face/*"]
        Landing --> Cache["Libs/Cache/biometricFrameCache.ts"]
        Landing --> Endpoints["Endpoints/*"]
        Portals --> Endpoints
        Portals --> Hooks["Hooks/*"]
        Portals --> Shared["Shared/* (SatelliteCommandMap, Modals)"]
        Shared --> MapLib["Libs/Map/mapAccuracy.ts"]
        Endpoints --> ApiClient["Endpoints/apiClient.ts"]
  ──────
  ## 9. Database and Data Model Audit
  ### 1. DBMS, Connections & ORM
  • Configured DBMS: Microsoft SQL Server (DatabaseProvider = "SqlServer", database name ResQTrackDb via Windows Auth
  or LocalDB fallback in Program.cs:43-61) or PostgreSQL (PostgreSqlConnection).
  • Configuration Variable Names (appsettings.json:20-31): DatabaseProvider, RedisConnection,
  ConnectionStrings:DefaultConnection, ConnectionStrings:SqlServer_LocalDB, ConnectionStrings:SqlServer_SqlAuth,
  ConnectionStrings:PostgreSqlConnection, ConnectionStrings:PostgreSqlConnection_Docker,
  ConnectionStrings:PostgreSqlConnection_Replica, ConnectionStrings:MySqlConnection.
  • ORM & Schema Management: Entity Framework Core 10.0.12 (AppDbContext.cs). No EF Core Migrations/ directory exists.
  Instead, the application calls await db.Database.EnsureCreatedAsync() followed by raw IF NOT EXISTS ... ALTER TABLE
  SQL statements in Program.cs:118-152 and DatabaseSeeder.cs:17-185.
  • Transactions, Stored Procedures, Triggers: Zero stored procedures, zero database triggers, and no explicit
  BeginTransactionAsync blocks exist (SaveChangesAsync is called per repository operation, meaning multi-step
  operations like CreateReportAsync + AuditLog.AddAsync execute in separate SaveChangesAsync calls).
  ### 2. Complete Entity & Table Inventory (11 Tables in AppDbContext.cs:14-24)
  1. Users (User.cs)
      • PK: Id (Guid).
      • Unique Indexes: IX_Users_Email (Email), IX_Users_EmployeeOrResidentId (EmployeeOrResidentId, filtered IS NOT
      NULL).
      • Core Columns: Email (nvarchar(180)), PasswordHash (nvarchar(512)), FirstName (nvarchar(80)), MiddleName
      (nvarchar(80)), Surname (nvarchar(80)), Suffix (nvarchar(20)), FullName (nvarchar(150)), DateOfBirth
      (datetime2), Sex (nvarchar(20)), BloodType (nvarchar(10)), PhoneNumber (nvarchar(30)), Province,
      CityOrMunicipality, Barangay, StreetOrPurok, EmergencyContactName/Phone/Relationship, Role (UserRole), Unit
      (ResponderUnitType), Status (AccountStatus), EmployeeOrResidentId (nvarchar(80)), ValidIdType (nvarchar(50)),
      GovernmentIdType (nvarchar(60)), GovernmentIdNumber (nvarchar(80)), role-specific columns (ResidencyCategory,
      VulnerabilityFlags, MedicalLicenseNumber, BfpBadgeNumber, PnpBadgeNumber, PlantillaNumber, etc.), IdCapturePath
      (nvarchar(500)), FaceCapturePath (nvarchar(500)), FaceVerified (bit), CreatedAt, UpdatedAt, IsDeleted (bit),
      DeletedAt, DeletedBy.
  2. Sessions (Session.cs)
      • PK: Id (Guid). Unique Index: TokenHash (nvarchar(128)). FK: UserId → Users.Id (Cascade). Columns: IpAddress,
      UserAgent, CreatedAt, ExpiresAt, IsRevoked.
  3. Reports (Report.cs)
      • PK: Id (Guid). Unique Index: ReferenceCode (nvarchar(40)). FKs: ReporterId → Users.Id (Restrict),
      AllocatedUnitId → DutyUnits.Id (SetNull). Columns: Title, Note, Category, Severity, Status, Latitude, Longitude,
      CurrentLatitude, CurrentLongitude, LastBeaconAt, BeaconCount, GpsAccuracyMeters, IsHardwareGeolocated, IsBlurry,
      RequiresManualVerification, RecommendedAgencyUnit, LocationLabel, ImageCapturePath, AllocatedUnitCode,
      VerifiedByAdminId, CreatedAt, VerifiedAt, ResolvedAt.
  4. DutyUnits (DutyUnit.cs)
      • PK: Id (Guid). Unique Index: UnitCode (nvarchar(40)). Columns: UnitName, Agency (ResponderUnitType),
      CommanderName, Status (DutyStatus), BaseLatitude, BaseLongitude, ContactHotline, ActivePersonnelCount,
      ShiftSchedule, UpdatedAt.
  5. IncidentFixtures (IncidentFixture.cs)
      • PK: Id (Guid). Unique Index: FixtureCode (nvarchar(40)). Columns: Title, Category, Severity, Latitude,
      Longitude, AssignedUnitType, IsActive, Description.
  6. Settings (Settings.cs)
      • PK: Id (Guid). Unique Index: Key (nvarchar(100)). Columns: Value, Description, Category, UpdatedAt,
      UpdatedByAdminId.
  7. AlertReadStates (AlertReadState.cs)
      • PK: Id (Guid). Composite Unique Index: (UserId, ReportId). FK: UserId → Users.Id (Cascade).
  8. AuditLogs (AuditLog.cs)
      • PK: Id (Guid). Index: Timestamp. Columns: ActorUserId, Action, TargetEntity, Payload, PreviousHash,
      CurrentHash, Timestamp.
  9. PatientCareRecords (PatientCareRecord.cs)
      • PK: Id (Guid). Index: PcrReference. Medical vitals & JSON interventions for RHU responders.
  10. PoliceBlotterEntries (PoliceBlotterEntry.cs)
      • PK: Id (Guid). Unique Index: BlotterNumber. PNP investigation blotter + CryptographicSeal.
  11. FireAlarmStatuses (FireAlarmStatusRecord.cs)
      • PK: Id (Guid). Index: ReportId. BFP fire alarm level & water supply telemetry.
  ### 3. Database Entity Relationship Diagram
    📊 Diagram (unsupported type)
    ──────────────────────────────
    erDiagram
        USERS ||--o{ SESSIONS : "has active"
        USERS ||--o{ REPORTS : "submits"
        USERS ||--o{ ALERT_READ_STATES : "tracks read"
        DUTY_UNITS ||--o{ REPORTS : "allocated to"
        REPORTS ||--o{ PATIENT_CARE_RECORDS : "linked via ReportId"
        REPORTS ||--o{ POLICE_BLOTTER_ENTRIES : "linked via ReportId"
        REPORTS ||--o{ FIRE_ALARM_STATUSES : "linked via ReportId"
        USERS {
            Guid Id PK
            string Email UK
            string EmployeeOrResidentId UK
            string PasswordHash
            string FirstName
            string MiddleName
            string Surname
            string FullName
            DateTime DateOfBirth
            string Sex
            UserRole Role
            ResponderUnitType Unit
            AccountStatus Status
            string ValidIdType
            string GovernmentIdType
            string GovernmentIdNumber
            string IdCapturePath
            string FaceCapturePath
            bool FaceVerified
            bool IsDeleted
        }
        SESSIONS {
            Guid Id PK
            Guid UserId FK
            string TokenHash UK
            DateTime ExpiresAt
            bool IsRevoked
        }
        REPORTS {
            Guid Id PK
            string ReferenceCode UK
            Guid ReporterId FK
            Guid AllocatedUnitId FK
            IncidentCategory Category
            IncidentSeverity Severity
            ReportStatus Status
            double Latitude
            double Longitude
            double CurrentLatitude
            double CurrentLongitude
            int BeaconCount
            string ImageCapturePath
        }
        DUTY_UNITS {
            Guid Id PK
            string UnitCode UK
            ResponderUnitType Agency
            DutyStatus Status
        }
        AUDIT_LOGS {
            Guid Id PK
            Guid ActorUserId
            string Action
            string PreviousHash
            string CurrentHash
            DateTime Timestamp
        }
  ### 4. Missing Database Structures Required by the Intended Biometric & ID Verification System

   Intended Capability                 │ Current Database Support             │ Missing Database Table / Columns
  ─────────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────
   Separate Front & Back Government ID │ Only a single Users.IdCapturePath    │ IdBackCapturePath,
   Images                              │ column exists (frontend stitches     │ IdPortraitCropPath,
                                       │ front + back into a single 856x320   │ IdDocumentVersion
                                       │ composite canvas).                   │
   OCR Extraction Provenance &         │ None (extracted fields are only held │ IdentityVerificationRecords table
   Confidence                          │ in React state; RegisterRequest      │ storing RawOcrText,
                                       │ drops most of them).                 │ ExtractedFieldsJson, OcrEngineUsed,
                                       │                                      │ OverallConfidence,
                                       │                                      │ UserEditedFieldsJson
   Biometric Facial Templates /        │ None (Users only stores              │ BiometricEnrollments table storing
   Descriptors                         │ FaceCapturePath and boolean          │ encrypted Descriptor128D (varbinary
                                       │ FaceVerified).                       │ or JSON float array),
                                       │                                      │ DescriptorVersion,
                                       │                                      │ PortraitSimilarityScore,
                                       │                                      │ LivenessScore
   Multi-Angle Facial Recording Frames │ None (discarded in browser memory).  │ BiometricEnrollmentFrames table
                                       │                                      │ (PoseType
                                       │                                      │ [CENTER,LEFT,RIGHT,BLINK,UP],
                                       │                                      │ FramePath, LaplacianScore, Yaw,
                                       │                                      │ Pitch, EarScore)
   Login Attempts & Account Lockout    │ None (only successful LOGIN is       │ LoginAttempts table or
                                       │ written to AuditLogs).               │ Users.FailedLoginCount +
                                       │                                      │ Users.LockoutEndUtc
   User Consent Records                │ None (consent1 and consent2          │ Users.ConsentAcceptedAtUtc,
                                       │ checkboxes in RegisterPage.tsx are   │ Users.ConsentPolicyVersion
                                       │ validated in JS only and not sent to │
                                       │ backend).                            │
  ──────
  ## 10. Government ID Verification Audit

  1. Currently Supported IDs in Vision Engine (idSpecs.ts:7-15):
      • 8 Configured Specifications: philsys (PhilSys National ID), drivers (LTO Driver's License), passport (PH
      Passport ID-3), prc (PRC Professional ID), umid (UMID), postal (PHLPost Digital Postal ID), fire (BFP Service
      ID), and police (PNP Official ID).
      • Discrepancy in UI Dropdown: RegisterPage.tsx:1420-1435 renders <option> items for 8 additional ID types
      (voters, senior, pwd, philhealth, tin, barangay, nbi, company, school) that are not in ID_SPECS_MAP and
      silently map to 'drivers' via mapUiIdTypeToCategory (RegisterPage.tsx:309-320).
  2. Automatic vs. Manual Document Recognition:
      • Manual selection is provided via the idType dropdown (RegisterPage.tsx).
      • Automatic header recognition is implemented in identifyIdCategoryFromHeader and
      dynamicAnchorParser.ts:216-246 by matching statutory header keywords (LAND TRANSPORTATION OFFICE, PAMBANSANG
      PAGKAKAKILANLAN, PASAPORTE, etc.) and regex signatures (J01-24-..., P<PHL, BFP-...).
  3. Front and Back Image Capture:
      • RegisterPage.tsx requires both Front ID (idFrontShot) and Back ID (idBackShot) uploads in Step 1
      (validateStep1 line 857).
      • Before submission, generateDualIdComposite (RegisterPage.tsx:184-253) draws both front and back images side-
      by-side onto a single 856x320 PNG canvas sent as idCaptureDataUrl.
  4. Boundary Detection & Perspective Correction:
      • Implemented in cannyHough.ts, contour.ts, and homography.ts (8-DOF Direct Linear Transform + bilinear inverse
      mapping to 856x540 ID-1 or 1000x704 ID-3).
      • Important Runtime Fact: When scanning an uploaded file via idScanEngine.scanStaticUpload
      (idScanEngine.ts:316-321), skipPerspectiveWarp: true is passed to the worker so pre-cropped ID uploads are
      resized directly to 856x540 without risking homography distortion on busy backgrounds.
  5. ID Portrait Extraction:
      • idScanWorker.ts:282-355 crops the ID's spec.photoRoi, runs detectFaceInPortraitRoi (skinFaceTracker.ts),
      extracts the 128-D portrait descriptor (idPortraitDescriptor), and returns portraitImageData, which
      RegisterPage.tsx converts into a data URL (idPortraitCropUrl) and caches via idScanEngine.
      setCachedIdPortraitDescriptor.
  6. QR Codes, Barcodes, Security Indicators, Duplicate ID Check, & Authenticity:
      • QR / Barcode Decoding: Not implemented (no decoder exists).
      • Security Holograms / Microprint / Document Generation: Not inspected.
      • Duplicate ID Number Check: AuthService.RegisterAsync checks duplicate Email and duplicate
      EmployeeOrResidentId, not GovernmentIdNumber.
      • Issuer-Backed Verification: None (no LTO LTMS, PSA PhilSys, or DFA API integration).
      • What the Current Implementation Can and Cannot Establish (Rule 19): The current system can establish that an
      uploaded image contains readable text matching Philippine ID header/field patterns and a human-like portrait
      region. It cannot establish cryptographic or physical document authenticity, nor detect a high-resolution
      digitally altered ID photo.

  ──────
  ## 11. OCR and Field Extraction Audit

  ### OCR Pipeline Architecture

  When a user uploads a Front or Back ID image in RegisterPage.tsx:533-743 (handleFileUpload):

  1. Primary Layer — On-Device WebAssembly OCR (onDeviceWasmOcr.ts):
      • Preprocesses the image on an offscreen canvas (preprocessCanvasForWasmOcr): upscales images < 1200px wide up
      to 1.75 × and applies luminance contrast stretching (1.28 ×).
      • Invokes a singleton tesseract.js (^7.0.0) WebWorker (eng LSTM model) to extract full-card raw text, line
      strings, word bounding boxes (bbox: {x0, y0, x1, y1}), and mean word confidence.
  2. Dynamic Statutory Anchor Header Parser (dynamicAnchorParser.ts):
      • Scans OCR lines for statutory anchor headers (Last Name, First Name, Middle Name, Nationality / Sex / Date of
      Birth / Weight / Height, Address, License No. / Expiration Date) and regex patterns across adjacent lines.
      • Tolerates common OCR confusions (0/O, 1/I) inside LTO license numbers ([A-Z]\d{2}-\d{2}-\d{6}), normalizes
      dates (YYYY/MM/DD), splits SURNAME, FIRST MIDDLE names, and extracts full multi-line municipal addresses and 4-
      digit Philippine ZIP codes.
  3. Secondary Layer — Deterministic DIP + CCL + 16x16 FONT_BANK (idScanWorker.ts & textExtractor.ts):
      • Crops relative ROIs defined in idSpecs.ts, runs CLAHE + Sauvola thresholding (k = 0.18, W = 15), 8-connected
      CCL blob isolation, and matches each character against the 16x16 bitmap FONT_BANK.
      • Also powers the interactive Crosshair OCR Modal (TextExtractorOverlay.tsx), allowing the user to drag a
      bounding box over any region of the card and assign it to a specific form field.
  4. Validation & Check-Digit Rules (validators.ts):
      • Implements Luhn Mod-10 (validateLuhnMod10), PhilSys 16-digit PCN validator (validatePhilSysPCN), LTO Driver's
      License format validator (validateLtoLicenseNumber), ICAO 9303 Mod-10 MRZ check-digit validator
      (computeIcaoCheckDigit, parseMrzLine), isPlausibleHumanName, isPascalCaseLabel, normalizePhilippineAddress, and
      normalizePhysicalMeasurement.


  ### OCR Field Mapping to Registration Inputs (RegisterPage.tsx:380-530)

   Extracted Field Key  │ Recognized by OCR? │ Populates RegisterPa… │ Sent in POST /api/re… │ Stored in Users Tabl…
  ──────────────────────┼────────────────────┼───────────────────────┼───────────────────────┼───────────────────────
   firstName /          │ Yes                │ Yes (setFirstName)    │ Concatenated into     │ Split by space in
   givenNames           │                    │                       │ fullName              │ AuthService.cs
   middleName           │ Yes                │ Yes (setMiddleName)   │ Concatenated into     │ No (Users.MiddleName
                        │                    │                       │ fullName              │ not set on register)
   lastName / surname   │ Yes                │ Yes (setLastName)     │ Concatenated into     │ Split by space in
                        │                    │                       │ fullName              │ AuthService.cs
   dateOfBirth / dob    │ Yes                │ Yes (setDateOfBirth + │ Only integer age is   │ Approximated
                        │                    │ auto-computes age)    │ sent                  │ (UtcNow.AddYears(-
                        │                    │                       │                       │ age))
   sex                  │ Yes                │ Yes (setSex)          │ Yes (sex)             │ Yes (Users.Sex)
   address              │ Yes                │ Yes (setAddress)      │ No (Hardcoded         │ No (Defaults to
                        │                    │                       │ departmentOrBarangay  │ 'Dipolog City')
                        │                    │                       │ sent)                 │
   licenseNumber /      │ Yes                │ Yes                   │ No (Not included in   │ No
   idNumber / pcn / crn │                    │ (setLicenseNumber)    │ RegisterPayload!)     │ (GovernmentIdNumber
                        │                    │                       │                       │ is null unless sent)
   weight / height      │ Yes                │ Yes (setWeight,       │ No                    │ No (No columns in
                        │                    │ setHeight)            │                       │ Users table)
   expirationDate /     │ Partial            │ No state inputs in    │ No                    │ No
   nationality /        │                    │ Step 1                │                       │
   bloodType            │                    │                       │                       │

  ### OCR Processing Flowchart

  │ Diagram exceeds terminal width (313 > 119 cols)
  │ Displayed as code block. Widen terminal to view inline.

    flowchart TD
        Upload["User Uploads Front / Back ID Image<br/>(RegisterPage.tsx: handleFileUpload)"] --> Scale["Offscreen
        Canvas Decode & Contrast Preprocess<br/>(onDeviceWasmOcr.ts)"]
        Scale --> WasmOCR["Tesseract.js WASM Worker (eng LSTM)<br/>Extracts Raw Text, Lines, Word BBoxes"]
        WasmOCR --> Anchor["Dynamic Statutory Anchor Parser<br/>(dynamicAnchorParser.ts: parseDynamicIdAnchors)"]
        Upload --> Worker["Parallel Deterministic DIP Worker<br/>(idScanEngine.scanStaticUpload -> idScanWorker.ts)"]
        Worker --> Portrait["Extract ID Portrait Crop & 128-D Face Vector<br/>(detectFaceInPortraitRoi)"]
        Worker --> DipFields["Fixed ROI Crop + Sauvola + CCL + FontBank<br/>(textExtractor.ts)"]
        Anchor --> Merge["Merge Dynamic Anchor + Deterministic Fields<br/>(mergeFrontAndBackFields)"]
        DipFields --> Merge
        Merge --> Validate["Noise & Plausibility Filters<br/>(validators.ts: isPlausibleHumanName,
        normalizeAddress)"]
        Validate --> AutoFill["Populate Editable React Form Inputs<br/>(firstName, middleName, lastName, dob, age,
        sex, licenseNo, weight, height, address)"]
        AutoFill --> Crosshair["Optional Manual Override: Crosshair ROI Modal<br/>(TextExtractorOverlay.tsx)"]
  ──────
  ## 12. Facial Detection and Recognition Audit

  ### A. Facial Detection

  • Libraries & Algorithms Used:
      1. Primary (When CDN/WebGL Available): @mediapipe/tasks-vision (FaceLandmarker) in
      mediaPipeFaceEngine.ts:38-179, configured with numFaces: 1, minFaceDetectionConfidence: 0.5,
      outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true.
      2. Deterministic Classical Engine (Always Active / Offline Fallback): skinFaceTracker.ts combining:
          • YCbCr Elliptical Skin Chrominance Model (computeYCbCrSkinLikelihood, lines 113–147) with Mahalanobis
          distance around (μ_{Cb} = 114.5, μ_{Cr} = 151.5).
          • Viola-Jones Integral Image & 3-Stage Haar-Like Cascade (buildIntegralImages, evaluateViolaJonesCascade,
          lines 155–238) evaluating eye-socket horizontal darkness, nasal bridge vertical symmetry, and mouth-band
          contrast.

  • Multiple-Face Detection: MediaPipe is configured with numFaces: 1; skinFaceTracker.ts computes moments inside the
  single target guide ellipse (cx: 160, cy: 120, rx: 84, ry: 102). Multiple simultaneous faces are not explicitly
  flagged or rejected.
  • Image Quality Assessment: Computes 3x3 Laplacian edge variance (computeLaplacianVariance in
  MultiAngleBiometricEngine.tsx:99-154) and luminance mean on every 320 × 240 frame.

  ### B. Facial Landmarks

  • MediaPipe Mode: Extracts 478 3D normalized landmarks (x, y, z) and maps key indices (leftEyeOuter: 33,
  leftEyeInner: 133, rightEyeInner: 362, rightEyeOuter: 263, noseTip: 1, mouthLeft: 61, mouthRight: 291, chin: 152).
  • Deterministic Classical Mode (skinFaceTracker.ts:285-530):
      • detectFacialLandmarks locates left eye center, right eye center, nose tip, and mouth center via local
      luminance minima/gradient search inside anatomical sub-windows, then synthesizes a 68-point iBUG/300-W
      topological landmark array (synthesize68PointMesh: jaw 0..16, brows 17..26, nose 27..35, eyes 36..47, mouth 48.
      .67) and 44 Delaunay triangles (DELAUNAY_MESH_TRIANGLES).
  • Geometric Pattern Blueprint (geometricFacePatternEngine.ts): Computes 18 key anthropometric nodes (Trichion,
  Glabella, Endocanthions, Exocanthions, Pupils, Nasion, Subnasale, Pronasale, Zygions, Cheilions, Stomion, Gonions,
  Gnathion) and 35 structural segments rendered by GeometricFacePatternHUD.tsx.

  ### C. Facial Descriptors and Recognition

  • Implemented Descriptor (skinFaceTracker.ts:540-815):
      • extractHybridFacialRecognitionProfile normalizes the face crop to 64 × 64 via affine inter-ocular alignment
      (affineAlignFace64x64), applies Illumination Tan-Triggs / CLAHE normalization, and builds a L2-normalized 128-D
      Float32Array descriptor (buildUnified128DDescriptor) composed of:
          1. 64-D Center-Symmetric Local Binary Patterns (CS-LBP / LBPH): 4 × 4 spatial grid × 4 orientation bins (0.
          .63).
          2. 32-D Multi-Orientation Gabor Jet Responses: 8 fiducial nodes × 4 orientations (64..95).
          3. 16-D Anthropometric Geometric Ratios: Inter-ocular/nose, nose/mouth, eye-mouth/jaw ratios (96..111).
          4. 16-D Multi-Scale Haar Wavelet Responses: 4 × 4 structural blocks (112..127).

  • Comparison Metrics:
      • compareFacialDescriptors computes Cosine Similarity, L2 Euclidean Distance, Histogram Intersection, and Chi-
      Square Distance between the live webcam 128-D descriptor and either the frontal baseline descriptor
      (centerDescriptorRef) or the cached ID portrait 128-D descriptor (idScanEngine.getCachedIdPortraitDescriptor()).
  • What Is NOT Used: Deep neural network facial embedding models (such as ArcFace, FaceNet, InsightFace, dlib
  ResNet-34, or ONNX models) are not installed or used.
  ──────
  ## 13. Facial Recording and Enrollment Audit

  ### Multi-Angle Enrollment State Machine (MultiAngleBiometricEngine.tsx)

  1. Supported Poses:
      • STANDBY → DISTANCE_CHECK → POSE_CENTER (|yaw| ≤ 12°, |pitch| ≤ 12°) → POSE_LEFT (yaw ≤ -14° or Δyaw ≤ -8°) →
      POSE_RIGHT (yaw ≥ 14° or Δyaw ≥ 8°) → POSE_BLINK (Eye Aspect Ratio EAR < 0.22 or MediaPipe eyeBlink > 0.42) →
      FLASH_CHROMA (screen flashes Cyan/Crimson to check skin specular reflection) → STORING_TO_DATABASE → VERIFIED.
  2. Frame Selection & Caching (biometricFrameCache.ts):
      • Samples the webcam every ~35 ms (processFrame), converts the 320 × 240 canvas to image/png Data URL, and
      stores up to maxFramesPerPose = 10 sharpest frames per pose based on laplacianVariance.
      • Automatically pauses frame accumulation (biometricFrameCache.pause('NO_FACE_IN_CAMERA')) when no valid face
      is detected and pauses for 900 ms between pose transitions.
  3. Critical Audit Finding — Synthetic Fallback & Simulated Persistence:
      • Synthetic Wireframe Fallback: If navigator.mediaDevices.getUserMedia fails or no camera hardware exists (e.g.,
      headless CI or desktop without webcam), startCamera sets isSynthetic = true (line 315), which automatically
      feeds synthetic yaw/pitch/blink values so the enrollment state machine completes without a real face.
      • Simulated Database Commit: biometricFrameCache.persistToDatabaseSimulation (lines 173–213) does not call any
      backend API. It runs 4 setTimeout delays (325ms + 350ms + 350ms + 300ms) and returns the sharpest single frame
      (compositeDataUrl), which RegisterPage.tsx stores in faceShot and sends as faceCaptureDataUrl to POST
      /api/register.


  ### Liveness Detection Assessment (PART 7.E)

  • What Exists:
      • Active head-turn challenge (CENTER → LEFT → RIGHT) + Eye Blink (POSE_BLINK) + UI Chroma Flash (FLASH_CHROMA) +
      inter-frame pixel difference (motionEnergy) + Laplacian sharpness check.
  • Presentation Attack Detection (PAD) Limitations:
      • Challenge Order Is Fixed, Not Randomized: Always runs CENTER → LEFT → RIGHT → BLINK, making it predictable
      for pre-recorded video replay attacks.
      • Client-Side Only: All liveness checks execute in browser JavaScript; a malicious client can call POST
      /api/register directly with any valid PNG data URL in FaceCaptureDataUrl and the backend (AuthService.cs:33-35)
      immediately sets FaceVerified = true and Status = AccountStatus.Verified.


  ### Facial Enrollment Flowchart

  │ Diagram exceeds terminal width (179 > 119 cols)
  │ Displayed as code block. Widen terminal to view inline.

    flowchart TD
        Start["User Clicks 'START BIOMETRIC SCAN'<br/>(MultiAngleBiometricEngine.tsx)"] -->
        CamCheck{"getUserMedia<br/>Camera Available?"}
        CamCheck -->|Yes| LiveFeed["Live 640x480 Video Stream<br/>Sampled every 35ms (320x240 Canvas)"]
        CamCheck -->|No / Blocked| Synth["isSynthetic = true<br/>Procedural 3D Wireframe Simulation"]
        LiveFeed --> Track["MediaPipe 478-pt Mesh +<br/>skinFaceTracker (YCbCr + 68-pt + 128-D)"]
        Synth --> Pose1
        Track --> Dist["DISTANCE_CHECK (Scale / Inter-Ocular Gate)"]
        Dist --> Pose1["POSE 1: CENTER (|Yaw| <= 12°)<br/>Caches top 10 sharpest frames + Baseline 128-D"]
        Pose1 --> Pause1["900ms Command Transition Pause"]
        Pause1 --> Pose2["POSE 2: TURN LEFT (Yaw <= -14°)<br/>Caches top 10 sharpest LEFT frames"]
        Pose2 --> Pause2["900ms Command Transition Pause"]
        Pause2 --> Pose3["POSE 3: TURN RIGHT (Yaw >= +14°)<br/>Caches top 10 sharpest RIGHT frames"]
        Pose3 --> Pause3["900ms Command Transition Pause"]
        Pause3 --> Pose4["POSE 4: BLINK LIVENESS (EAR < 0.22)<br/>Caches BLINK frames"]
        Pose4 --> Chroma["FLASH_CHROMA (Cyan / Crimson Screen Reflection)"]
        Chroma --> SimDB["STORING_TO_DATABASE<br/>(biometricFrameCache.persistToDatabaseSimulation - Client-Only
        Delay)"]
        SimDB --> Verified["VERIFIED: Passes single composite PNG to RegisterPage.tsx<br/>(128-D vector & multi-angle
        frames cleared on submit)"]
  ──────
  ## 14. Registration and Login Workflow

  ### Registration Sequence Diagram (Actual Current Implementation)

  │ Diagram exceeds terminal width (243 > 119 cols)
  │ Displayed as code block. Widen terminal to view inline.

    sequenceDiagram
        actor User
        participant RegUI as RegisterPage.tsx (Port 5173)
        participant Vision as On-Device WASM OCR + DIP Worker
        participant BioHUD as MultiAngleBiometricEngine.tsx
        participant API as AuthController / AuthService (Port 5000)
        participant Disk as CaptureStorageHelper (server-data/uploads)
        participant DB as AppDbContext (ResQTrackDb)

        User->>RegUI: Step 0: Select Role (Responder [FIRE/RHU/PNP] or Civilian)
        User->>RegUI: Step 1: Upload Front & Back Government ID Images
        RegUI->>Vision: scanCardWithOnDeviceWasm() + idScanEngine.scanStaticUpload()
        Vision-->>RegUI: Extracted Fields (Name, DOB, Sex, LicenseNo, Address) + ID Portrait 128-D
        RegUI->>RegUI: Auto-fills editable inputs & computes Age from DOB
        User->>RegUI: Step 2: Proceed to Biometric Enrollment
        RegUI->>BioHUD: Mount MultiAngleBiometricEngine
        BioHUD->>BioHUD: Execute CENTER -> LEFT -> RIGHT -> BLINK -> FLASH_CHROMA
        BioHUD-->>RegUI: onVerified(singleCompositePngDataUrl)
        User->>RegUI: Step 3: Enter Password (>=5 chars in UI, >=12 in API DTO) & Check Consents
        RegUI->>RegUI: generateDualIdComposite(frontId, backId) -> 856x320 PNG
        RegUI->>API: POST /api/register (RegisterPayload)
        Note over RegUI,API: Drops middleName, address, licenseNo, weight, height, exact DOB, & 128-D vector
        API->>Disk: SaveCaptureDataUrlAsync(IdCaptureDataUrl, "ID")
        API->>Disk: SaveCaptureDataUrlAsync(FaceCaptureDataUrl, "FACE")
        API->>API: ScryptPasswordHelper.HashPassword (PBKDF2-SHA512)
        API->>DB: Insert User (FaceVerified = true, Status = Verified) + AuditLog
        API-->>RegUI: 201 Created { status: "Verified", faceVerified: true }
        RegUI->>User: Redirect to /login

  ### Biometric & Manual Login Sequence Diagram (Current vs. Proposed Biometric Login)

  │ Diagram exceeds terminal width (147 > 119 cols)
  │ Displayed as code block. Widen terminal to view inline.

    sequenceDiagram
        actor User
        participant LoginUI as LoginPage.tsx / AdminLoginPage.tsx
        participant API as POST /api/login (AuthService.cs)
        participant DB as Users & Sessions Tables

        rect rgb(30, 41, 59)
        Note over User,DB: ACTUAL IMPLEMENTED LOGIN (Manual Email + Password Only)
        User->>LoginUI: Enter Email + Password + Consent Checkbox
        LoginUI->>API: POST /api/login { email, password, portalOrigin }
        API->>DB: GetByEmailAsync(email)
        API->>API: ScryptPasswordHelper.VerifyPassword (PBKDF2-SHA512 FixedTimeEquals)
        API->>API: Enforce Status == Verified & PortalOrigin vs Role (5174 = Admin, 5173 = Responder/Civilian)
        API->>DB: Create Session (SHA-256 TokenHash, 12h expiry) + Append AuditLog
        API-->>LoginUI: 200 OK { token, session, redirectUrl } + Set-Cookie: resqtrack_session
        LoginUI->>LoginUI: Store token in sessionStorage (tab-isolated) & unit/port localStorage
        end

        rect rgb(60, 20, 35)
        Note over User,DB: MISSING / PROPOSED REPEAT BIOMETRIC LOGIN (Not Yet Implemented)
        User--xLoginUI: Click "Biometric Face Login" (No UI button exists)
        LoginUI--xAPI: Capture live frame + Liveness + 128-D Descriptor -> POST /api/login/biometric (No endpoint
        exists)
        API--xDB: Compare against stored User 128-D Enrollment Template (No column/table exists)
        end
  ──────
  ## 15. Frontend and UI Audit

  1. Portals & Active Pages (App.tsx):
      • Public / Auth: LandingPage.tsx, LoginPage.tsx, AdminLoginPage.tsx, RegisterPage.tsx.
      • LDRRMO Admin Portal (/admin/* on Port 5174): AdminDashboard.tsx, StrategicMapPage.tsx, IncidentsPage.tsx,
      SubmittedReportsPage.tsx, RespondersRosterPage.tsx, AnalyticsReportsPage.tsx, UserManagementPage.tsx,
      AlertsCenter.tsx, SettingsPage.tsx.
      • Responder Portal (/responder/* on Port 5173): ResponderDashboard.tsx, UnitIncidentsFeed.tsx,
      RequestDeployPage.tsx, DutyRosterView.tsx, MyReportsPage.tsx, ResponderAlerts.tsx, ResponderProfile.tsx, plus
      agency modals (PatientCareRecordModal.tsx, PoliceBlotterModal.tsx, FireAlarmEscalationModal.tsx).
      • Civilian Portal (/civilian/* on Port 5173): CivilianDashboard.tsx, CivilianLiveMapPage.tsx,
      ReportAccidentPage.tsx, MyReportsHistory.tsx, CommunityAlertsPage.tsx, EmergencyHotlinesUnits.tsx,
      CivilianProfile.tsx.
  2. Duplicate / Dead UI Files:
      • src/LANDING_PAGE/Features/Pages/Home/Home.tsx, src/LANDING_PAGE/Features/Pages/Login/Login.tsx,
      src/Pages/PublicPortal/LoginPage.tsx, src/Pages/AdminsPortal/AdminLoginPage.tsx,
      src/UserRoles/Features/Pages/AdminsPanel/DashboardPage.tsx, IncidentsBoard.tsx, RespondersRoster.tsx,
      SystemSettings.tsx, UserGovernance.tsx, and EmergencyNumbersPage.tsx are unrouted duplicates from earlier
      iterations.
  3. Frontend Validation Mismatch:
      • In RegisterPage.tsx:866-868, validateStep3 only checks password.length < 5, whereas backend RegisterRequest
      and AuthService.cs:20 require Password.Length >= 12. If a user enters a 6–11 character password, Step 3 passes
      client validation and fails with HTTP 400 on POST /api/register.

  ──────
  ## 16. Backend and API Audit

  ### Complete REST API Endpoint Inventory (34 Endpoints across 10 Controllers)

   Controller           │ HTTP Method & Route     │ Auth / Role Required  │ Service Invoked         │ Operational S…
  ──────────────────────┼─────────────────────────┼───────────────────────┼─────────────────────────┼────────────────
   AuthController       │ POST /api/register      │ Public                │ IAuthService.RegisterAs │ Operational
                        │                         │                       │ ync                     │ (drops
                        │                         │                       │                         │ granular
                        │                         │                       │                         │ fields)
   AuthController       │ POST /api/login         │ Public                │ IAuthService.LoginAsync │ Operational
   AuthController       │ GET /api/session        │ Authenticated Session │ IAuthService.GetSession │ Operational
                        │                         │                       │ Async                   │
   AuthController       │ POST /api/logout        │ Public / Session      │ IAuthService.LogoutAsyn │ Operational
                        │                         │                       │ c                       │
   IdentityController   │ POST /api/identity/ai-  │ Public (Whitelisted)  │ IIdentityAiService.Extr │ Standby
                        │ extract                 │                       │ actIdentityAsync        │ (Requires
                        │                         │                       │                         │ Cloud API
                        │                         │                       │                         │ Keys)
   IdentityController   │ GET                     │ Public (Whitelisted)  │ IIdentityAiService.GetP │ Operational
                        │ /api/identity/providers │                       │ roviderStatus           │
   UsersController      │ GET /api/users          │ Authenticated (Admin  │ IUserGovernanceService. │ Operational
                        │                         │ in UI)                │ GetAllUsersAsync        │ (Note: Missing
                        │                         │                       │                         │ controller-
                        │                         │                       │                         │ level Admin
                        │                         │                       │                         │ role check!)
   UsersController      │ GET                     │ Authenticated         │ IUserGovernanceService. │ Operational
                        │ /api/users/{id:guid}    │                       │ GetUserDetailAsync      │
   UsersController      │ POST /api/users         │ LDRRMO_Admin          │ IUserGovernanceService. │ Operational
                        │                         │                       │ CreateUserByAdminAsync  │
   UsersController      │ PUT                     │ LDRRMO_Admin          │ IUserGovernanceService. │ Operational
                        │ /api/users/{id:guid}    │                       │ UpdateUserByAdminAsync  │
   UsersController      │ DELETE                  │ LDRRMO_Admin          │ IUserGovernanceService. │ Operational
                        │ /api/users/{id:guid}    │                       │ SoftDeleteUserAsync     │
   UsersController      │ PUT /api/users/profile  │ Authenticated User    │ IUserGovernanceService. │ Operational
                        │                         │                       │ UpdateProfileAsync      │
   UsersController      │ POST|PUT                │ LDRRMO_Admin          │ IUserGovernanceService. │ Operational
                        │ /api/users/{id:guid}/st │                       │ UpdateUserStatusAsync   │
                        │ atus                    │                       │                         │
   UsersController      │ GET                     │ Authenticated         │ IUserGovernanceService. │ Operational
                        │ /api/users/{id:guid}/ca │                       │ GetCapturePathAsync     │ (Note: Any
                        │ ptures/{kind}           │                       │                         │ logged-in user
                        │                         │                       │                         │ can fetch
                        │                         │                       │                         │ another user's
                        │                         │                       │                         │ ID/face
                        │                         │                       │                         │ image!)
   ReportsController    │ POST /api/reports       │ Authenticated (or     │ IReportService.CreateRe │ Operational
                        │                         │ fallback)             │ portAsync               │
   ReportsController    │ GET /api/reports        │ Authenticated         │ IReportService.GetAllRe │ Operational
                        │                         │                       │ portsAsync              │
   ReportsController    │ GET /api/reports/mine   │ Authenticated User    │ IReportService.GetMyRep │ Operational
                        │                         │                       │ ortsAsync               │
   ReportsController    │ GET                     │ Matching Agency or    │ IReportService.GetAgenc │ Operational
                        │ /api/reports/agency/{ag │ Admin                 │ yReportsAsync           │
                        │ ency}                   │                       │                         │
   ReportsController    │ GET                     │ Public (Whitelisted)  │ IReportService.GetRepor │ Operational
                        │ /api/reports/{id:guid}/ │                       │ tImagePathAsync         │
                        │ image                   │                       │                         │
   ReportsController    │ POST                    │ Authenticated         │ IReportService.RecordDi │ Operational
                        │ /api/reports/{id:guid}/ │                       │ stressBeaconAsync       │ (1-BPM Live
                        │ beacon                  │                       │                         │ GPS)
   IncidentsController  │ GET /api/incidents      │ Authenticated         │ IReportService.GetAllRe │ Operational
                        │                         │                       │ portsAsync              │
   IncidentsController  │ GET                     │ Authenticated         │ ITriageService.GetActiv │ Operational
                        │ /api/incidents/fixtures │                       │ eFixturesAsync          │
   IncidentsController  │ POST                    │ LDRRMO_Admin or       │ ITriageService.VerifyRe │ Operational
                        │ /api/reports/{id:guid}/ │ Responder             │ portAsync               │
                        │ verify                  │                       │                         │
   IncidentsController  │ POST                    │ LDRRMO_Admin or       │ ITriageService.Allocate │ Operational
                        │ /api/reports/{id:guid}/ │ Responder             │ UnitAsync               │
                        │ allocate|assign         │                       │                         │
   IncidentsController  │ PUT                     │ LDRRMO_Admin or       │ ITriageService.UpdateRe │ Operational
                        │ /api/reports/{id:guid}/ │ Responder             │ portSeverityAsync       │
                        │ severity                │                       │                         │
   RespondersController │ GET                     │ Authenticated         │ IResponderOpsService.Ge │ Operational
                        │ /api/responder/roster   │                       │ tRosterAsync            │
   RespondersController │ PUT                     │ LDRRMO_Admin or       │ IResponderOpsService.Up │ Operational
                        │ /api/responder/duty-sta │ Responder             │ dateDutyStatusAsync     │
                        │ tus                     │                       │                         │
   RespondersController │ PUT                     │ LDRRMO_Admin or       │ IResponderOpsService.Up │ Operational
                        │ /api/responder/units/{i │ Responder             │ dateUnitStatusAsync     │
                        │ d}/status               │                       │                         │
   RespondersController │ POST|GET                │ RHU or LDRRMO_Admin   │ IResponderOpsService.Su │ Operational
                        │ /api/responder/pcr      │                       │ bmitPcrAsync /          │
                        │                         │                       │ GetPcrRecordsAsync      │
   RespondersController │ POST|GET                │ PNP or LDRRMO_Admin   │ IResponderOpsService.Fi │ Operational
                        │ /api/responder/blotter  │                       │ leBlotterAsync /        │
                        │                         │                       │ GetBlotterEntriesAsync  │
   RespondersController │ POST|GET                │ FIRE or LDRRMO_Admin  │ IResponderOpsService.Se │ Operational
                        │ /api/responder/alarm-   │                       │ tAlarmLevelAsync /      │
                        │ level                   │                       │ GetAlarmStatusesAsync   │
   RespondersController │ GET                     │ Authenticated         │ IResponderOpsService.Ge │ Operational
                        │ /api/responder/hydrants │                       │ tHydrantsAsync          │
   AlertsController     │ GET /api/alerts, POST   │ Authenticated         │ IAlertService           │ Operational
                        │ /api/alerts/broadcast,  │                       │                         │
                        │ POST                    │                       │                         │
                        │ /api/alerts/{id}/read   │                       │                         │
   AnalyticsController  │ GET                     │ Authenticated         │ IAnalyticsService       │ Operational
                        │ /api/analytics/{summary │                       │                         │
                        │ ,volume-24h,severity-   │                       │                         │
                        │ breakdown,agency-       │                       │                         │
                        │ workload,heatmap-       │                       │                         │
                        │ matrix}                 │                       │                         │
   SettingsController   │ GET /api/settings, PUT  │ LDRRMO_Admin (for PUT │ ISettingsService        │ Operational
                        │ /api/settings/{key},    │ & audit)              │                         │
                        │ GET /api/settings/audit │                       │                         │
   HealthController     │ GET /api/health         │ Public (Whitelisted)  │ Direct response         │ Operational
                        │ (/health)               │                       │                         │
  ──────
  ## 17. External Integrations

   External Service / CDN       │ Purpose                      │ File Reference       │ Connection Status
  ──────────────────────────────┼──────────────────────────────┼──────────────────────┼──────────────────────────────
   JSDelivr / Tesseract CDN     │ Downloads tesseract.js WASM  │ onDeviceWasmOcr.ts   │ Connected (Requires internet
                                │ core & eng.traineddata on    │                      │ on first scan unless cached
                                │ first ID upload              │                      │ by browser)
   Google Storage MediaPipe CDN │ Loads                        │ mediaPipeFaceEngine. │ Connected (Falls back to
   (cdn.jsdelivr.net &          │ vision_wasm_internal.wasm    │ ts:17-20             │ skinFaceTracker.ts offline)
   storage.googleapis.com)      │ and face_landmarker.task     │                      │
   Esri ArcGIS World Imagery &  │ Satellite & street map tiles │ SatelliteCommandMap. │ Connected
   OpenStreetMap Tile Servers   │ for Katipunan/Dipolog        │ tsx                  │
                                │ command maps                 │                      │
   Google Gemini 2.5 Flash /    │ Cloud AI standby OCR         │ IdentityAiService.cs │ Disconnected / Standby (No
   OpenAI GPT-4o / Azure        │ extraction (POST             │                      │ API keys configured)
   Document Intelligence        │ /api/identity/ai-extract)    │                      │
   Redis (localhost:6379)       │ Distributed cache            │ Program.cs:67-87     │ Configured in DI, Unused by
                                │ (StackExchangeRedis)         │                      │ Services
  ──────
  ## 18. Important Code and Function Review

  Findings are prioritized by severity with exact source file and line references:

  1. [CRITICAL] Biometric Enrollment & Liveness Bypass at Backend Registration
      • Location: AuthService.cs:31-35 & biometricFrameCache.ts:173-213.
      • Finding: AuthService.RegisterAsync sets bool faceVerified = !string.IsNullOrWhiteSpace(facePath); and
      immediately activates the account (AccountStatus.Verified) whenever any valid PNG/JPEG/WebP image is supplied
      in FaceCaptureDataUrl. Meanwhile, persistToDatabaseSimulation is a pure frontend timer, and
      MultiAngleBiometricEngine.tsx allows synthetic wireframe completion (isSynthetic = true) when no camera is
      attached.
  2. [CRITICAL] Missing Authorization Guard on User Listing and Biometric Capture Endpoints
      • Location: UsersController.cs:19-26 and UsersController.cs:70-75.
      • Finding: While CreateUser, UpdateUser, DeleteUser, and UpdateUserStatus check IsSuperAdmin(),
      GetAllUsersAsync (GET /api/users), GetUserDetailAsync (GET /api/users/{id}), and GetCaptureAsync (GET
      /api/users/{id}/captures/{kind}) do not check IsSuperAdmin() or self-ownership! Any authenticated Civilian or
      Responder can query GET /api/users and download any user's Government ID (id) or facial capture (face) image.
  3. [HIGH] Loss of Extracted OCR Fields and Exact DOB During Registration Submission
      • Location: RegisterPage.tsx:954-969 and AuthService.cs:37-66.
      • Finding: RegisterPage.tsx extracts firstName, middleName, lastName, dateOfBirth, address, licenseNumber,
      weight, and height, and sets phoneNumber: '0917-000-0000' hardcoded (line 958). It never sends dateOfBirth,
      address, licenseNumber (GovernmentIdNumber), middleName, weight, or height in RegisterPayload. On the backend,
      AuthService.RegisterAsync approximates DateOfBirth = DateTime.UtcNow.AddYears(-request.Age.Value) and leaves
      MiddleName, GovernmentIdNumber, Barangay, and StreetOrPurok blank!
  4. [HIGH] Client-Side vs. Server-Side Password Minimum Length Mismatch (5 vs. 12 Characters)
      • Location: RegisterPage.tsx:866-868 vs. Requests.cs:12.
      • Finding: validateStep3 allows passwords of 5+ characters, whereas [MinLength(12)] on RegisterRequest.Password
      rejects anything under 12 characters.
  5. [MEDIUM] TypeScript Strict Mode Disabled in tsconfig.app.json
      • Location: tsconfig.app.json:15-17.
      • Finding: Although file comments claim "Strict TypeScript", tsconfig.app.json has "strict": false,
      "strictNullChecks": false, and "noImplicitAny": false.
  6. [MEDIUM] Misleading Cryptographic Naming (ScryptPasswordHelper & [ARGON2.KEY])
      • Location: ScryptPasswordHelper.cs:22-28.
      • Finding: Uses Rfc2898DeriveBytes.Pbkdf2 (SHA512, 100,000 iterations), which is NIST-compliant, but naming it
      ScryptPasswordHelper and labeling the UI [ARGON2.KEY] misleads auditors.
  7. [LOW] Unrouted Legacy Frontend Components & Unused NuGet Packages
      • Location: 10 unrouted .tsx files in Frontend/src/ and JwtBearer + Pomelo.EntityFrameworkCore.MySql in
      Backend.csproj.

  ──────
  ## 19. Security, Privacy, and Biometric Data Protection

   Security Control           │ Current Implementation     │ Risk Level & Gap           │ Recommended Mitigation
  ────────────────────────────┼────────────────────────────┼────────────────────────────┼────────────────────────────
   Password Hashing           │ PBKDF2-HMAC-SHA512,        │ Low Risk                   │ Rename helper or document
                              │ 100,000 iterations, 32-    │ (Cryptographically sound,  │ PBKDF2-SHA512 accurately.
                              │ byte random salt, 64-byte  │ only misnamed).            │
                              │ hash, constant-time        │                            │
                              │ FixedTimeEquals            │                            │
                              │ (ScryptPasswordHelper.cs). │                            │
   Session & Cookie Security  │ 32-byte CSPRNG hex token,  │ Medium Risk (localStorage  │ Bind Secure =
                              │ stored as SHA-256 hash in  │ token exposure if XSS      │ context.Request.IsHttps
                              │ Sessions table, 12-hour    │ occurs; Secure = false in  │ dynamically; restrict
                              │ TTL, HttpOnly = true,      │ dev).                      │ localStorage persistence.
                              │ SameSite = Lax, Secure =   │                            │
                              │ false                      │                            │
                              │ (SessionCookieHelper.cs:21 │                            │
                              │ -30). Token is also        │                            │
                              │ returned in JSON body and  │                            │
                              │ stored in                  │                            │
                              │ sessionStorage/localStorag │                            │
                              │ e.                         │                            │
   Access Control on ID &     │ GET                        │ Critical Risk (IDOR)       │ Enforce `IsSuperAdmin
   Biometric Images           │ /api/users/{id}/captures/{ │                            │
                              │ kind} in                   │                            │
                              │ UsersController.cs:70-75   │                            │
                              │ lacks IsSuperAdmin or      │                            │
                              │ self-ID check. GET         │                            │
                              │ /api/reports/{id}/image is │                            │
                              │ whitelisted as public in   │                            │
                              │ SessionVerificationMiddlew │                            │
                              │ are.cs:21.                 │                            │
   Encryption at Rest for     │ Saved as unencrypted raw   │ High Risk                  │ Encrypt sensitive ID and
   Biometric & Government ID  │ .png/.jpg/.webp files in   │                            │ face capture files at rest
   Files                      │ Backend/server-            │                            │ using AES-256-GCM before
                              │ data/uploads/captures/     │                            │ writing to server-
                              │ (CaptureStorageHelper.cs:3 │                            │ data/uploads/captures/.
                              │ 7).                        │                            │
   File Upload Validation     │ Validates PNG, JPEG, and   │ Medium Risk (No explicit   │ Enforce a strict payload
                              │ WebP magic bytes           │ maximum byte length check  │ size limit (e.g., ≤ 10 MB)
                              │ (ValidatePngHeader,        │ on base64 payload before   │ on IdCaptureDataUrl,
                              │ ValidateJpegHeader,        │ Convert.FromBase64String). │ FaceCaptureDataUrl, and
                              │ ValidateWebpHeader in      │                            │ ImageDataUrl.
                              │ CaptureStorageHelper.cs:53 │                            │
                              │ -79).                      │                            │
   Rate Limiting & Brute-     │ No ASP.NET Core            │ High Risk                  │ Add UseRateLimiter (e.g.,
   Force Protection           │ RateLimiter middleware or  │                            │ 5 login attempts per
                              │ failed-login lockout       │                            │ minute per IP/email) and
                              │ counter exists on POST     │                            │ account lockout tracking.
                              │ /api/login or POST         │                            │
                              │ /api/register.             │                            │
   CORS Policy                │ Program.cs:91-99 uses      │ Medium Risk (Allows any    │ Restrict allowed origins
                              │ .SetIsOriginAllowed(_ =>   │ external website to make   │ to configured
                              │ true).AllowCredentials().  │ credentialed cross-origin  │ hostnames/ports (5173,
                              │                            │ requests in production).   │ 5174).
   Philippine Data Privacy    │ Collects Sensitive         │ High Compliance Gap        │ Persist explicit consent
   Act of 2012 (RA 10173)     │ Personal Information       │                            │ metadata
   Assessment                 │ (Government IDs, DOB,      │                            │ (ConsentTimestampUtc,
                              │ biometric face images). UI │                            │ ConsentVersion), encrypt
                              │ has two consent checkboxes │                            │ biometric templates/images
                              │ in Step 3, but consent     │                            │ at rest, and purge raw
                              │ timestamps, privacy notice │                            │ ID/face files upon account
                              │ versions, data retention   │                            │ deletion or retention
                              │ schedules, and hard-       │                            │ expiry.
                              │ deletion/anonymization     │                            │
                              │ workflows for biometric    │                            │
                              │ files are not persisted in │                            │
                              │ the database.              │                            │
  ──────
  ## 20. Testing and Performance Assessment

  ### 1. Existing Test Suites & Actual Execution Results

  During this audit, non-destructive verification suites in Frontend/src/Libs/Vision/idScanner/__tests__/ were
  inspected and executed:

  • verify_dynamic_anchor_parser.ts: Runs & Passes (16/16 assertions passed) — verifies dynamic statutory header
  extraction on LTO Driver's Licenses (SALIWAN, ART LEVIN TORILLA, J01-24-005544, 2004/08/27, 84, 1.70, PUROK 2,
  LANGATIAN... 7102) and PhilSys IDs.
  • verify_geometric_facial_patterns.ts: Runs & Passes (36/36 assertions passed) — verifies 18 anthropometric nodes,
  35 segments, frontal/left/right/blink pose rules.
  • verify_uploaded_id_ocr_pipeline.ts: Runs & Passes (28/28 assertions passed) — verifies parseNameComponents,
  mergeFrontAndBackFields, and check-digit validators.
  • Other existing vision tests: verify_dip_core.ts, verify_ocr_ccl.ts, verify_face_recognition_and_biometrics.ts,
  verify_pascal_indication_and_noise_rejection.ts, verify_text_extractor_engine.ts, verify_vision.ts.
  • Browser/Playwright scripts in Frontend/src/Libs/Testing/: 18 scripts covering multi-port RBAC, map stability, and
  registration flows.

  ### 2. Missing Tests & Coverage Gaps

  • Zero Backend Unit or Integration Tests: There is no .csproj test project (xUnit/NUnit) for
  Backend/Features/Services or Controllers.
  • No Biometric Statistical Evaluation (Rule 18): The project does not have a labeled biometric evaluation dataset
  or benchmark protocol measuring False Acceptance Rate (FAR), False Rejection Rate (FRR), Equal Error Rate (EER),
  lighting invariance, or demographic fairness. Any UI badge showing 99.8% confidence
  (MultiAngleBiometricEngine.tsx:18) is a hardcoded display string, not an empirically measured biometric accuracy
  metric.

  ### 3. Performance Bottlenecks

  • Every-Request Uncached Database Query in SessionVerificationMiddleware: SessionVerificationMiddleware.cs:65
  queries sessionRepo.GetValidSessionByTokenHashAsync (with .Include(s => s.User)) on every single API call without
  using the configured IDistributedCache / memory cache.
  • High-Frequency Base64 PNG Encoding in Biometric Loop: MultiAngleBiometricEngine.tsx calls canvas.
  toDataURL('image/png') every ~120 ms during pose capture, causing main-thread PNG compression spikes.
  • Sequential Full-Table Reads in ReportRepository / UserRepository: GetAllReportsAsync and GetAllAsync load all
  entities into memory before mapping.
  ──────
  ## 21. Proposed Architecture Evaluation (PART 14)

  ### A. Configuration-Driven Government ID Intelligence Repository

  • Feasibility: **High — Directly Extends idSpecs.ts**.
  • Evaluation: idSpecs.ts already models 8 Philippine IDs with headerDictionary, photoRoi, fields, and reverseFields,
  while dynamicAnchorParser.ts models label-based extraction. Extending GovernmentIdSpec into a versioned, data-
  driven catalog supporting all 9+ target Philippine IDs (PhilSys Physical/ePhilID, Passport, LTO Driver's License,
  UMID, PhilHealth, Postal ID, Voter's ID/Certification, PRC, Senior Citizen/PWD) with issuer, documentGeneration,
  supportedVersions, fieldAliases, anchorKeywords, and knownLimitations requires refactoring/extending idSpecs.ts,
  not replacing it.
  • Authenticity Caveat: As mandated by Rule 19, the repository must classify results as
  OCR_READABLE_AND_FORMAT_VALID rather than AUTHENTIC_GOVERNMENT_ID unless verified via cryptographic QR (e.g.,
  PhilSys Ed25519 offline public key verification).

  ### B. OCR-Based Identity Extraction Pipeline (14-Step Deterministic + WASM Pipeline)

  • Feasibility: **High — 85% Already Present in onDeviceWasmOcr.ts, dynamicAnchorParser.ts, and idScanWorker.ts**.
  • Evaluation: Traditional DIP (Laplacian blur gate, Canny/Hough orientation, CLAHE/contrast stretching) +
  tesseract.js WASM OCR + configured ID-specific anchor/coordinate/regex rules + user confirmation works
  deterministically offline without cloud AI fees. The missing step (Step 14: Save extraction result and its
  provenance) requires adding extraction provenance fields to RegisterRequest and persisting them on the backend.

  ### C. Multi-Angle Facial Recording Enrollment (Without Deep Learning Training)

  • Why Facial Recording Is Enrollment Data Collection Rather Than Model Training:
      • Recording Front → Left → Right → Eyes Open → Blink → Return to Front does not train neural network weights or
      run stochastic gradient descent. Instead, it is deterministic enrollment data collection and active liveness
      verification:
          1. Multi-angle poses prove 3D head geometry and active compliance (defeating static flat-photo spoofs).
          2. Each pose yields high-clarity reference frames (Laplacian variance) and deterministic mathematical
          descriptors (128-D CS-LBP + Gabor + Geometric + Haar vectors).

  • Technical Evaluation of Specific Algorithms:
      • Viola-Jones Haar Cascade + YCbCr Skin + MediaPipe 478-pt Landmarks: Realistic and fast (already running at 30
      FPS in skinFaceTracker.ts and mediaPipeFaceEngine.ts).
      • Eye Aspect Ratio (EAR) & Head Pose Estimation: Reliable when 478-pt or 68-pt landmarks are locked; unreliable
      if synthetic fallback (isSynthetic) is allowed in production.
      • LBPH + Gabor + Geometric Ratios + Cosine Similarity / Euclidean Distance: Realistic for 1:1 same-user
      verification (comparing a user's live login face against their own enrolled frontal reference descriptor under
      controlled framing), provided the 128-D reference descriptor is persisted in the database during registration.
      However, classical LBPH/Gabor descriptors are not reliable for large-scale 1:N open-set identification across
      thousands of users under extreme lighting variance. Therefore, repeat facial login should always operate in 1:1
      mode (user enters email/username → system retrieves that user's enrolled 128-D descriptors → compares live 128-
      D descriptor + liveness check).


  ### D. Repeat Facial Login

  • Can the Existing System Support This With Minimal Architectural Changes?: Yes.
  • Required Additions:
      1. Persist the user's enrolled 128-D Float32Array frontal descriptor (and multi-angle metadata) in the database
      during POST /api/register.
      2. Add a "Biometric Facial Login" mode in LoginPage.tsx that reuses MultiAngleBiometricEngine.tsx (or a
      streamlined Center + Blink + Random Turn challenge).
      3. Add POST /api/login/biometric in AuthController.cs that verifies liveness telemetry, compares the live 128-D
      descriptor against the user's enrolled 128-D reference via cosine similarity + Euclidean distance, enforces
      failed-attempt lockouts, and falls back to password login.


  ### E. 7-Phase Sliding-Window Registration

  • Assessment: RegisterPage.tsx currently implements a 4-step wizard (00 Role → 01 Identity → 02 Biometrics → 03
  Security) where Step 1 crowds Role/Agency details, ID Type selection, Front/Back ID upload, OCR extraction, and 10
  personal inputs into a single long scrolling view. Refactoring RegisterPage.tsx into the proposed 7-phase sliding
  window (1. Account/Role Info → 2. Gov ID Selection → 3. Document Capture → 4. OCR Extraction & Confirmation → 5.
  Facial Recording & Enrollment → 6. Registration Review → 7. Submission & Completion) reuses 100% of the existing
  state hooks and vision components while eliminating UI crowding.
  ──────
  ## 22. Gap Analysis

   Feature │ Current Impl… │ Current Stat… │ Proposed Str… │ Required Chan… │ Reusable Comp… │ New Components │ Pri…
  ─────────┼───────────────┼───────────────┼───────────────┼────────────────┼────────────────┼────────────────┼──────
   Gov ID  │ 8 IDs in      │ PARTIALLY     │ Version-aware │ Add            │ idSpecs.ts,    │ idCatalogRepos │ HIGH
   Intelli │ idSpecs.ts; 8 │ IMPLEMENTED   │ configuration │ philhealth,    │ validators.ts  │ itory.ts       │
   gence   │ extra UI      │               │ repository    │ voters,        │                │                │
   Catalog │ options       │               │ for all 9+ PH │ senior, pwd,   │                │                │
           │ fallback to   │               │ IDs           │ tin, barangay  │                │                │
           │ drivers       │               │               │ specs +        │                │                │
           │               │               │               │ version        │                │                │
           │               │               │               │ metadata       │                │                │
   OCR     │ Client-side   │ PARTIALLY     │ 14-step OCR   │ Map all        │ onDeviceWasmOc │ IdentityVerifi │ CRIT
   Extract │ WASM          │ IMPLEMENTED   │ pipeline with │ extracted      │ r.ts,          │ cationRecord   │ ICAL
   ion &   │ tesseract.js  │               │ full field    │ fields         │ dynamicAnchorP │ entity         │
   Provena │ +             │               │ mapping & DB  │ (middleName,   │ arser.ts,      │                │
   nce     │ dynamicAnchor │               │ provenance    │ dob, address,  │ TextExtractorO │                │
   Persist │ Parser.ts +   │               │               │ licenseNo)     │ verlay.tsx     │                │
   ence    │ CCL;          │               │               │ into           │                │                │
           │ provenance    │               │               │ RegisterReques │                │                │
           │ not saved in  │               │               │ t & DB         │                │                │
           │ DB            │               │               │                │                │                │
   Multi-  │ Captures      │ PARTIALLY     │ True          │ Add            │ MultiAngleBiom │ BiometricEnrol │ CRIT
   Angle   │ CENTER, LEFT, │ IMPLEMENTED   │ persistence   │ POSE_RETURN_CE │ etricEngine.ts │ lment entity & │ ICAL
   Facial  │ RIGHT, BLINK  │               │ of 6-stage    │ NTER; disable  │ x,             │ API DTOs       │
   Enrollm │ in memory;    │               │ poses (Front, │ synthetic      │ skinFaceTracke │                │
   ent     │ simulates DB  │               │ Left, Right,  │ bypass in      │ r.ts           │                │
   Persist │ save; sends 1 │               │ Open, Blink,  │ production;    │                │                │
   ence    │ PNG           │               │ Return Front) │ send 128-D     │                │                │
           │               │               │ + 128-D       │ descriptor &   │                │                │
           │               │               │ descriptor    │ pose frames to │                │                │
           │               │               │               │ backend        │                │                │
   Repeat  │ Manual email  │ PLANNED BUT   │ 1:1 Biometric │ Add Biometric  │ MultiAngleBiom │ BiometricLogin │ HIGH
   Biometr │ + password    │ NOT           │ Login (Email  │ Login modal on │ etricEngine.ts │ Modal.tsx,     │
   ic      │ only          │ IMPLEMENTED   │ + Live        │ LoginPage.tsx  │ x,             │ AuthService.Lo │
   Facial  │               │               │ Liveness      │ and POST       │ AuthService.cs │ ginBiometricAs │
   Login   │               │               │ Capture +     │ /api/login/bio │                │ ync            │
           │               │               │ 128-D         │ metric on      │                │                │
           │               │               │ Descriptor    │ backend        │                │                │
           │               │               │ Match +       │                │                │                │
           │               │               │ Lockout)      │                │                │                │
   Sliding │ 4-step wizard │ IMPLEMENTED   │ 7-phase       │ Split Step 1   │ RegisterPage.t │ Phase sub-     │ MEDI
   -Window │ (00 Role, 01  │ AND WORKING   │ sliding-      │ into Phases    │ sx             │ components     │ UM
   Registr │ Identity, 02  │               │ window        │ 1–4 and add    │                │                │
   ation   │ Biometrics,   │               │ registration  │ Phase 6 Review │                │                │
   UI      │ 03 Security)  │               │ with          │ step           │                │                │
           │               │               │ dedicated     │                │                │                │
           │               │               │ Review step   │                │                │                │
   Endpoin │ /api/users    │ BROKEN /      │ Strict        │ Add role       │ PermissionsHel │ AES encryption │ CRIT
   t RBAC  │ and           │ INSECURE      │ Admin/Self    │ checks in      │ per.cs,        │ helper &       │ ICAL
   &       │ /api/users/{i │               │ authorization │ UsersControlle │ CaptureStorage │ RateLimiter    │
   Biometr │ d}/captures/{ │               │ + AES-256-GCM │ r.cs; encrypt  │ Helper.cs      │ policy         │
   ic Data │ kind} lack    │               │ file          │ capture        │                │                │
   Protect │ Admin/Self    │               │ encryption +  │ buffers in     │                │                │
   ion     │ guard; raw    │               │ rate limiting │ CaptureStorage │                │                │
           │ PNGs on disk  │               │               │ Helper.cs      │                │                │
  ──────
  ## 23. Reuse / Refactor / Replace / Build Matrix

   Subsystem / Component                             │ Action    │ Technical Justification & Cost/Risk Evaluation
  ───────────────────────────────────────────────────┼───────────┼───────────────────────────────────────────────────
   Core Emergency Operations (Reports, Incidents,    │ REUSE     │ Fully operational, tested across all 3 portals
   Responders, Alerts, Analytics, Settings,          │ UNTOUCHED │ (5173 and 5174), zero regression risk if
   SatelliteCommandMap)                              │           │ preserved untouched.
   On-Device WASM OCR (onDeviceWasmOcr.ts) & Dynamic │ REUSE &   │ Accurately extracts text from real uploaded IDs
   Anchor Parser (dynamicAnchorParser.ts)            │ EXTEND    │ client-side; extend anchor patterns for
                                                     │           │ additional Philippine ID types (PhilHealth,
                                                     │           │ Voter's, Senior/PWD).
   Classical Face Tracker (skinFaceTracker.ts),      │ REUSE &   │ Already computes 478-pt/68-pt landmarks, EAR
   MediaPipe Engine (mediaPipeFaceEngine.ts), &      │ REFACTOR  │ blink, head yaw/pitch, and 128-D descriptors at
   Geometric HUD (GeometricFacePatternHUD.tsx)       │           │ 30 FPS. Refactor to add the 6th pose
                                                     │           │ (RETURN_TO_FRONT), randomize challenge order, and
                                                     │           │ export the 128-D descriptor array to
                                                     │           │ RegisterPage.tsx.
   BiometricFrameCacheStore.persistToDatabaseSimulat │ REPLACE   │ Currently a setTimeout mock. Replace with real
   ion (biometricFrameCache.ts)                      │           │ payload serialization that packages the best pose
                                                     │           │ frames, liveness scores, and 128-D descriptor
                                                     │           │ vector for backend persistence.
   RegisterRequest (Requests.cs) &                   │ REFACTOR  │ Currently drops MiddleName, DateOfBirth, Address,
   AuthService.RegisterAsync (AuthService.cs)        │           │ GovernmentIdNumber, and biometric descriptors.
                                                     │           │ Refactor DTO and service mapping to persist all
                                                     │           │ extracted identity and biometric fields.
   UsersController.cs & CaptureStorageHelper.cs      │ REFACTOR  │ Fix critical IDOR authorization gap on GET
                                                     │           │ /api/users and GET
                                                     │           │ /api/users/{id}/captures/{kind}, enforce payload
                                                     │           │ size limits, and add encryption at rest.
   Repeat Biometric Login (POST /api/login/biometric │ BUILD NEW │ Does not exist yet; required for repeat facial
   + BiometricLoginModal.tsx)                        │           │ authentication.
   10 Unrouted Duplicate Frontend Pages & Unused     │ REMOVE /  │ Dead code and preview EF Core 9 dependency
   NuGet Packages (JwtBearer, Pomelo.MySql)          │ CLEAN UP  │ cluttering a .NET 10 project.
  ──────
  ## 24. Recommended Development Roadmap

  ### Phase 1: Security Hardening, Registration Data Integrity & Database Schema Expansion

  • Objective: Fix critical IDOR vulnerabilities, align client/server password validation, persist all OCR-extracted
  identity fields (MiddleName, DateOfBirth, Address, GovernmentIdNumber), and add database columns/tables for OCR
  provenance and 128-D biometric enrollment templates.
  • Existing Files Involved: UsersController.cs, Requests.cs, AuthService.cs, User.cs, AppDbContext.cs,
  DatabaseSeeder.cs, RegisterPage.tsx, authEndpoints.ts.
  • New Files Required: Backend/Features/Data/Models/BiometricEnrollment.cs,
  Backend/Features/Data/Models/IdentityVerificationRecord.cs.
  • Database & API Changes: Add IdBackCapturePath, ConsentAcceptedAtUtc, FailedLoginCount, LockoutEndUtc to Users;
  create BiometricEnrollments (storing 128-D float vector JSON/binary, pose scores, ID portrait similarity) and
  IdentityVerificationRecords (storing OCR provenance JSON). Expand RegisterRequest to accept all fields.
  • Acceptance Criteria: All fields extracted on RegisterPage.tsx are verifiably stored in SQL Server/PostgreSQL;
  non-admin users receive 403 Forbidden when requesting another user's /captures/.

  ### Phase 2: Configuration-Driven Philippine Government ID Intelligence Repository

  • Objective: Expand idSpecs.ts and dynamicAnchorParser.ts to cover all target Philippine IDs with versioned
  profiles, field aliases, and provenance tracking.
  • Files Modified: idSpecs.ts, dynamicAnchorParser.ts, validators.ts, onDeviceWasmOcr.ts.
  • Acceptance Criteria: Every ID option selectable in the UI has a dedicated, tested GovernmentIdSpec and anchor
  rule profile.

  ### Phase 3: True 6-Pose Multi-Angle Facial Enrollment & Backend Template Storage

  • Objective: Upgrade MultiAngleBiometricEngine.tsx to enforce the complete 6-step sequence (Front → Left → Right →
  Eyes Open → Blink → Return to Front), replace persistToDatabaseSimulation with genuine transmission of the 128-D
  descriptor + pose metadata, and gate isSynthetic to explicit test environments only.
  • Files Modified: MultiAngleBiometricEngine.tsx, biometricFrameCache.ts, skinFaceTracker.ts, AuthService.cs.
  • Acceptance Criteria: Enrollment stores a verified 128-D reference descriptor and pose telemetry in
  BiometricEnrollments.

  ### Phase 4: Repeat 1:1 Biometric Facial Login & Failed-Attempt Lockout

  • Objective: Build POST /api/login/biometric and integrate a live Biometric Facial Login modal into LoginPage.tsx.
  • New Files Required: Frontend/src/LANDING_PAGE/Features/Pages/LoginPage/BiometricLoginModal.tsx.
  • Algorithms Involved: Live webcam liveness check (Center + Blink + randomized turn), 128-D hybrid descriptor
  extraction, server-side Cosine Similarity (≥ 0.82) + Euclidean distance comparison against the user's enrolled
  reference descriptor, with 5-strike lockout fallback to password recovery.
  • Acceptance Criteria: Enrolled users can authenticate via live facial verification; spoofed/mismatched faces and >
  5 failed attempts are rejected and audited.

  ### Phase 5: 7-Phase Sliding-Window Registration UI & Automated Test Suite

  • Objective: Refactor RegisterPage.tsx into the 7-phase sliding window and add xUnit backend tests + biometric
  FAR/FRR evaluation scripts.
  ──────
  ## 25. Outstanding Technical Problems

  1. IDOR on /api/users and /api/users/{id}/captures/{kind} (UsersController.cs:19-26, #L70-L75): Missing
  IsSuperAdmin / ownership check.
  2. Silent Data Loss on Registration (RegisterPage.tsx:954-969): middleName, dateOfBirth, address, licenseNumber,
  weight, and height are extracted on screen by OCR, reviewed by the user, and then omitted from the POST
  /api/register payload, while phoneNumber is hardcoded to '0917-000-0000'.
  3. Password Length Validation Mismatch (RegisterPage.tsx:866 vs. Requests.cs:12): Frontend checks < 5, backend
  requires >= 12.
  4. Simulated Biometric Persistence (biometricFrameCache.ts:173-213): persistToDatabaseSimulation is a client-side
  setTimeout animation; 128-D descriptors and multi-angle frames are never sent to the server.
  5. Unconditional Synthetic Wireframe Fallback (MultiAngleBiometricEngine.tsx:313-317): Blocking camera permissions
  activates isSynthetic = true, allowing biometric verification to succeed using a simulated 3D wireframe.
  ──────
  ## 26. Unverified Assumptions and Missing Information

  1. External Cloud AI Keys: GEMINI_API_KEY, OPENAI_API_KEY, and AZURE_VISION_KEY / AZURE_VISION_ENDPOINT are not
  present in the workspace; therefore, live responses from IdentityAiService.cs could only be verified structurally,
  not against live cloud endpoints.
  2. Offline vs. Internet-Connected Deployment: Both tesseract.js (onDeviceWasmOcr.ts) and @mediapipe/tasks-vision
  (mediaPipeFaceEngine.ts) fetch their .wasm and .traineddata / .task model weights from external CDNs (cdn.jsdelivr.
  net and storage.googleapis.com) on first load. If the target deployment is an air-gapped LGU LAN, those static
  assets must be copied into Frontend/public/models/.
  3. Biometric Evaluation Dataset: No multi-subject ground-truth dataset of Philippine IDs and live webcam captures
  exists in the repository to compute empirical FAR/FRR/EER curves.
  ──────
  ## 27. Questions Requiring Developer Decisions (Including Explicit Answers to All 30 Questions in PART 17)

  ### Explicit Answers to PART 17 Questions (1–30)

  1. What does the application currently do from start to finish?
  It provides a multi-port emergency management system where Civilians and Responders register (with ID upload, on-
  device OCR, and live webcam pose checks) and sign in on Port 5173, while LDRRMO Super Admins sign in on Port 5174.
  Civilians submit geolocated incident reports and broadcast 1-BPM live GPS distress beacons; Responders (RHU, BFP,
  PNP) view agency feeds, update duty statuses, and file PCRs, Police Blotters, and Fire Alarm escalations; Admins
  verify incidents, dispatch duty units on a satellite map of Katipunan/Dipolog, broadcast alerts, view analytics,
  and govern user accounts.
  2. What happens when a user registers?
  In RegisterPage.tsx, the user selects a role (Responder or Civilian), uploads Front and Back ID images (which
  trigger on-device WASM OCR + DIP extraction to auto-fill form inputs), completes the 4-pose facial scan in
  MultiAngleBiometricEngine.tsx, sets a password, and submits POST /api/register. AuthService.RegisterAsync saves the
  composite ID PNG and face PNG to Backend/server-data/uploads/captures/, hashes the password with PBKDF2-SHA512,
  creates the User with Status = AccountStatus.Verified (if FaceCaptureDataUrl is present), logs a hash-chained
  AuditLog, and redirects to /login.
  3. What happens when a user uploads a government ID?
  handleFileUpload decodes the image into a Data URL, runs scanCardWithOnDeviceWasm (tesseract.js WASM worker +
  parseDynamicIdAnchors) in parallel with idScanEngine.scanStaticUpload (idScanWorker.ts), crops the ID portrait
  (idPortraitCropUrl) and extracts its 128-D facial vector, merges front/back extracted text fields, filters out
  label noise, and auto-populates the editable personal details fields.
  4. How is the document recognized?
  Via manual dropdown selection (idType) plus automatic header keyword/regex matching in identifyIdCategoryFromHeader
  and dynamicAnchorParser.ts:216-246.
  5. How is text extracted?
  Primarily via client-side tesseract.js WebAssembly LSTM OCR (onDeviceWasmOcr.ts), supplemented by deterministic
  Sauvola thresholding + 8-connected CCL + 16x16 FONT_BANK glyph template matching (textExtractor.ts) and interactive
  crosshair ROI cropping (TextExtractorOverlay.tsx).
  6. How are the extracted fields mapped?
  parseDynamicIdAnchors and parseFieldsByPascalCaseIndications map OCR lines below statutory labels (Last Name, First
  Name, Middle Name, License No., Date of Birth, Address, Weight, Height, Sex) into React states (firstName,
  middleName, lastName, dateOfBirth, age, sex, licenseNumber, weight, height, address).
  7. How is the ID photograph obtained?
  idScanWorker.ts crops the normalized spec.photoRoi rectangle from the front ID image, runs detectFaceInPortraitRoi
  (skinFaceTracker.ts) to refine the face crop and extract its 128-D descriptor, and returns portraitImageData to
  RegisterPage.tsx.
  8. How does facial enrollment work?
  MultiAngleBiometricEngine.tsx streams the user's webcam at 30 FPS and guides the user through DISTANCE_CHECK →
  POSE_CENTER → POSE_LEFT → POSE_RIGHT → POSE_BLINK → FLASH_CHROMA, verifying head yaw/pitch and eye closure while
  comparing the live 128-D face descriptor against the ID portrait's 128-D descriptor.
  9. How are facial frames processed?
  Every ~35 ms, a 320 × 240 mirrored canvas frame is analyzed for Laplacian edge variance, passed to MediaPipe
  FaceLandmarker (478 3D points + blendshapes) and trackSkinFace (YCbCr chrominance moments + Viola-Jones cascade +
  68-pt mesh + 128-D descriptor), and cached in BiometricFrameCacheStore (retaining the top 10 sharpest frames per
  pose).
  10. Where are facial templates or descriptors stored?
  Only in volatile browser RAM (centerDescriptorRef and idScanEngine.cachedIdPortraitDescriptor). They are never sent
  to the backend or stored in the database; only a single PNG image is saved to Backend/server-
  data/uploads/captures/FACE_*.png.
  11. How does biometric authentication work?
  It does not exist for login. Biometric verification currently runs only once on the client during Step 2 of
  registration.
  12. How does manual authentication work?
  POST /api/login (AuthService.LoginAsync) looks up the user by email, verifies the password using
  ScryptPasswordHelper.VerifyPassword (PBKDF2-SHA512 FixedTimeEquals), verifies Status == AccountStatus.Verified,
  enforces port-to-role isolation (5174 for LDRRMO_Admin, 5173 for Responder/Civilian), stores a SHA-256 hashed
  session token in Sessions, and returns the raw token via JSON and HttpOnly cookie.
  13. Which functions are still placeholders?
  BiometricFrameCacheStore.persistToDatabaseSimulation (biometricFrameCache.ts:173-213), NullAiProvider.extractFields
  (NullAiProvider.ts), and the hardcoded '0917-000-0000' phone number in RegisterPage.tsx:958.
  14. Which packages are unnecessary?
  Microsoft.AspNetCore.Authentication.JwtBearer (10.0.12) and Pomelo.EntityFrameworkCore.MySql (9.0.0-preview.2.
  efcore.9.0.0) in Backend.csproj.
  15. Which dependencies are missing?
  An xUnit test project (xunit, Microsoft.AspNetCore.Mvc.Testing) for the backend, and optionally a client-side 2D
  barcode/QR decoder (e.g., @zxing/library or jsqr) if PhilSys QR / LTO PDF417 barcode reading is desired.
  16. Which modules are duplicated?
  10 legacy frontend page files (Home.tsx, Login.tsx, Pages/PublicPortal/LoginPage.tsx,
  Pages/AdminsPortal/AdminLoginPage.tsx, DashboardPage.tsx, IncidentsBoard.tsx, RespondersRoster.tsx, SystemSettings.
  tsx, UserGovernance.tsx, EmergencyNumbersPage.tsx).
  17. Which integrations are actually connected?
  SQL Server / LocalDB (ResQTrackDb), Tesseract.js CDN, MediaPipe CDN, and Esri ArcGIS / OpenStreetMap tile servers.
  18. Which APIs are operational?
  33 of the 34 backend REST endpoints across all 10 controllers are operational (POST /api/identity/ai-extract is
  operational in code but returns unconfigured status until cloud API keys are provided).
  19. Does the architecture support the proposed revised approach?
  Yes. Both the React/TypeScript vision engine and the ASP.NET Core .NET 10 service/repository layer are modular and
  cleanly structured to support the revised ID catalog, OCR provenance persistence, 6-pose enrollment storage, repeat
  1:1 biometric login, and 7-phase registration wizard without a rewrite.
  20. What is the biggest existing technical limitation?
  The disconnect between the rich client-side vision/biometric state (RegisterPage.tsx / MultiAngleBiometricEngine.
  tsx) and backend persistence (RegisterRequest / AuthService.cs / Users table), which discards the 128-D facial
  descriptors, multi-angle frames, and several OCR-extracted fields upon registration.
  21. What should be implemented first?
  Phase 1: Fix the UsersController authorization vulnerability, align the 12-character password rule, expand
  RegisterRequest and AuthService.RegisterAsync to persist all OCR-extracted fields, and create the
  BiometricEnrollments and IdentityVerificationRecords database tables.
  22. What should not be changed?
  The multi-port RBAC routing (5173 vs 5174), tab-isolated session management, incident reporting, 1-BPM GPS distress
  beacon engine, command triage/dispatch, RHU/PNP/BFP responder operational modules, and SHA-256 hash-chained audit
  logging.
  23. What should be removed or replaced, and why?
  Replace biometricFrameCache.persistToDatabaseSimulation with real API persistence; disable automatic isSynthetic
  wireframe pass in production builds; remove the 10 unrouted duplicate .tsx files and unused Pomelo.
  EntityFrameworkCore.MySql / JwtBearer packages.
  24. Which components can be extended instead of rebuilt?
  idSpecs.ts, dynamicAnchorParser.ts, onDeviceWasmOcr.ts, skinFaceTracker.ts, mediaPipeFaceEngine.ts,
  GeometricFacePatternHUD.tsx, MultiAngleBiometricEngine.tsx, RegisterPage.tsx, LoginPage.tsx, and AuthService.cs.
  25. What are the most significant security and privacy risks?
  (1) Missing Admin/self authorization on GET /api/users and GET /api/users/{id}/captures/{kind}; (2) unencrypted
  storage of Government ID and face PNGs on disk; (3) client-only liveness enforcement (AuthService trusts any non-
  empty FaceCaptureDataUrl); (4) absence of login rate limiting.
  26. What data must be stored?
  Normalized identity fields, ID type/version, OCR extraction confidence & provenance metadata, encrypted Front/Back
  ID captures, L2-normalized 128-D facial enrollment descriptors, best pose keyframes (Center, Left, Right, Blink),
  liveness telemetry scores, and explicit user consent timestamps.
  27. What data should not be stored?
  Raw continuous 30-FPS video streams, unvalidated intermediate blurry frames, plaintext passwords, or unencrypted
  biometric images in publicly accessible static folders.
  28. What are the most important missing tests?
  Backend xUnit integration tests for AuthService, UsersController authorization guards, and RegisterAsync field
  persistence, plus a multi-subject evaluation test harness for 128-D facial descriptor matching thresholds (FAR/FRR).
  29. What are the biggest performance concerns?
  Uncached per-request DB session lookups in SessionVerificationMiddleware.cs and frequent synchronous canvas.
  toDataURL('image/png') calls inside the 35 ms biometric loop.
  30. What exact implementation sequence minimizes regression risk?
  Phase 1 (Security & DB Schema + Full Field Persistence) → Phase 2 (ID Intelligence Catalog Expansion) → Phase 3 (6-
  Pose Enrollment & 128-D Vector Persistence) → Phase 4 (Repeat 1:1 Biometric Login) → Phase 5 (7-Phase Sliding-
  Window Registration UI Refactor).

  ### Strategic Questions Requiring Developer Decisions Before Implementation

  1. Account Approval Policy: Should newly registered accounts with verified biometrics remain auto-activated
  (AccountStatus.Verified as currently coded in AuthService.cs line 35), or require manual LDRRMO Admin approval
  (AccountStatus.Pending as stated in README.md)?
  2. Offline Asset Bundling: Should the tesseract.js (eng.traineddata) and MediaPipe (face_landmarker.task) model
  files be bundled locally inside Frontend/public/models/ so the system runs 100% offline without CDN access?
  3. Biometric Login Mode: For repeat facial login, should the user enter their Email first (1:1 verification against
  their stored descriptor) or attempt 1:N identification across all enrolled users? (Architect Recommendation: 1:1
  verification via Email + Live Face is strongly recommended for classical/hybrid 128-D descriptors).
  ──────
  ## 28. Final Technical Recommendations

  1. Preserve the Working Core: Do not rewrite the .NET 10 backend or React 19 frontend. The existing multi-port
  architecture, incident triage, 1-BPM GPS beacon, and on-device WASM OCR + hybrid facial tracking engines are well-
  structured and operational.
  2. Bridge the Client-to-Server Biometric & OCR Persistence Gap: Upgrade POST /api/register and the database schema
  so that every OCR-extracted field, provenance record, and 128-D facial descriptor computed in the browser is saved
  and verified on the backend.
  3. Harden Biometric Security & Privacy: Lock down UsersController capture endpoints immediately, encrypt stored
  ID/face images at rest with AES-256-GCM, disable synthetic wireframe bypass in production, and implement 1:1 repeat
  biometric login using persisted 128-D descriptors.
  ──────
   TECHNICAL HANDOFF SUMMARY

  • Actual technology stack:
      • Frontend: React 19.2.8, TypeScript ~6.0.2, Vite 8.3.0, Tailwind CSS 3.4.19, React Router 7.18.3, Leaflet 1.9.
      4, tesseract.js ^7.0.0 (WASM OCR), @mediapipe/tasks-vision ^1.2.2 (478-pt 3D Face Mesh).
      • Backend: C# / ASP.NET Core .NET 10.0 Web API, Entity Framework Core 10.0.12, Scalar OpenAPI 2.17.3.
      • Database: SQL Server (SSMS 19 / LocalDB default) and PostgreSQL (Npgsql 10.0.3), database ResQTrackDb (11
      tables).
  • Actual architecture:
      • Backend: Layered Monolith (Controllers → Services → Repositories → AppDbContext) listening on http://0.0.0.
      0:5000.
      • Frontend: Multi-Port SPA serving Civilian & Responder portals on Port 5173 and the LDRRMO Executive Command
      Admin portal on Port 5174.
  • Existing operational features:
      • Multi-port RBAC & tab-isolated session management; Incident reporting with camera capture, Laplacian blur
      check, and auto-agency triage recommendation; 1-BPM (60s) live civilian GPS distress beacon (POST
      /api/reports/{id}/beacon); Satellite command map bounded to Katipunan (7109) / Dipolog; RHU Patient Care
      Records, PNP cryptographically sealed Police Blotters, and BFP Fire Alarm escalations; SHA-256 hash-chained
      tamper-evident audit logs; On-device tesseract.js WASM OCR + Dynamic Statutory Anchor parsing + interactive
      Crosshair ROI OCR.
  • Existing incomplete features:
      • Biometric template/descriptor database persistence (persistToDatabaseSimulation is a client-side mock);
      Repeat biometric facial login (not implemented); Registration field persistence (drops middleName, address,
      licenseNumber, weight, height, and exact dateOfBirth); 2D Barcode / QR code decoding on IDs (not implemented);
      Cloud AI OCR fallback (implemented in code, unconfigured in environment).
  • Current ID verification approach:
      • Client-side upload of Front and Back ID images in RegisterPage.tsx, automatic header keyword classification
      (idSpecs.ts / dynamicAnchorParser.ts), ID portrait ROI cropping + 128-D portrait face vector extraction, and
      regex/check-digit validation (validators.ts). Front and back images are stitched into a single 856x320
      composite PNG sent to the server.
  • Current OCR approach:
      • 3-Tier client-first pipeline: (1) tesseract.js WebAssembly LSTM engine (onDeviceWasmOcr.ts) with
      dynamicAnchorParser.ts for statutory header/label extraction; (2) Deterministic DIP (CLAHE, Sauvola
      thresholding, 8-way CCL, 16x16 FONT_BANK glyph matching) in idScanWorker.ts and TextExtractorOverlay.tsx; (3)
      Standby backend proxy (IdentityAiService.cs) for Gemini/OpenAI/Azure.
  • Current facial recognition approach:
      • 100% client-side in TypeScript (no OpenCvSharp or Emgu CV). Combines @mediapipe/tasks-vision (478-point 3D
      mesh + blendshapes) with skinFaceTracker.ts (YCbCr skin segmentation, Viola-Jones integral image cascade, 68-
      point anthropometric mesh, and a 128-D hybrid descriptor [64-D CS-LBP + 32-D Gabor + 16-D Geometric Ratios +
      16-D Haar Wavelets]) compared via Cosine Similarity and Euclidean distance against the ID portrait crop.
  • Existing registration workflow:
      • 4-step wizard (00 Role → 01 Identity & ID Upload → 02 Multi-Angle Biometrics → 03 Password & Consents)
      submitting POST /api/register. Server saves composite ID and face PNGs to Backend/server-data/uploads/captures/,
      hashes password with PBKDF2-SHA512, and sets AccountStatus.Verified if FaceCaptureDataUrl is non-empty.
  • Existing login workflow:
      • Manual email + password (POST /api/login), verified via PBKDF2-SHA512 constant-time comparison, enforcing
      port-to-role isolation (5174 Admin vs 5173 Responder/Civilian) and issuing a 12-hour SHA-256 session token
      (resqtrack_session cookie + Bearer/X-Session-Token headers).
  • Actual dependencies:
      • Backend: EF Core 10.0.12 (SqlServer, InMemory, Design), Npgsql 10.0.3, Pomelo.MySql 9.0.0-preview.2,
      StackExchangeRedis 10.0.14, JwtBearer 10.0.12, OpenApi 10.0.11, Scalar.AspNetCore 2.17.3.
      • Frontend: react 19.2.8, react-router-dom 7.18.3, leaflet 1.9.4, lucide-react 1.61.0, tesseract.js 7.0.0,
      @mediapipe/tasks-vision 1.2.2, vite 8.3.0, typescript 6.0.2, tailwindcss 3.4.19, playwright 1.64.1.
  • Critical issues:
      1. Missing Admin/self authorization check on GET /api/users and GET /api/users/{id}/captures/{kind}
      (UsersController.cs).
      2. Loss of extracted OCR fields (MiddleName, DateOfBirth, Address, GovernmentIdNumber, Weight, Height) between
      RegisterPage.tsx and AuthService.RegisterAsync.
      3. Non-persistence of 128-D facial descriptors and multi-angle frames (persistToDatabaseSimulation is a
      frontend timer).
      4. Client/server password minimum length mismatch (5 chars in UI vs 12 chars in API).
      5. Automatic synthetic wireframe fallback (isSynthetic = true) allowing camera-less biometric pass.
  • Recommended changes:
      • Enforce RBAC guards on UsersController; encrypt capture files at rest; expand RegisterRequest and
      AppDbContext with BiometricEnrollments and IdentityVerificationRecords; persist 128-D facial descriptors and
      OCR provenance; add 6th enrollment pose (Return to Front) and disable synthetic fallback in production; build
      POST /api/login/biometric for 1:1 repeat facial login; refactor RegisterPage.tsx into the 7-phase sliding
      window.
  • First recommended implementation phase:
      • Phase 1 — Security Hardening, Registration Data Integrity & Database Schema Expansion (locking down
      UsersController, aligning password validation, mapping all extracted OCR fields into POST /api/register, and
      adding BiometricEnrollments + IdentityVerificationRecords tables).