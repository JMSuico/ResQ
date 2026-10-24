# PowerShell Script to Generate 200 Phased Task Markdown Files
# 25 Phases, 50 Categories, 75 Sections, 200 Tasks

$ErrorActionPreference = "Stop"

$workspaceRoot = "c:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION"
$targetDir1 = Join-Path $workspaceRoot "Md data\Plans\10-22-2026\03-15-00 PM\Tasks"
$targetDir2 = Join-Path $workspaceRoot "Obsidian Memory Engine\10 - Projects\Incident-AI-System-Detection\Tasks"

if (-not (Test-Path $targetDir1)) { New-Item -ItemType Directory -Path $targetDir1 -Force | Out-Null }
if (-not (Test-Path $targetDir2)) { New-Item -ItemType Directory -Path $targetDir2 -Force | Out-Null }

$phases = @(
    @{
        Number = 1; Name = "Core Architecture & Shadcn UI Directory Infrastructure"; Assignee = "Subagent 1 (UI Architect)"; Layer = "SharedPrims";
        Cat1 = "Shadcn Project Layout & Strict Pathing"; Cat2 = "Design Tokens & CSS Invariants";
        Sec1 = "Directory Foundations & Component Architecture"; Sec2 = "CSS Directives Pipeline"; Sec3 = "Universal Lambda Static Rules";
        Tasks = @(
            "Verify and enforce shadcn directory layout in src/components/ui/",
            "Harmonize ink-orbit-features theme variables with deep burgundy tokens",
            "Establish strict component barrel exports in src/components/ui/index.ts",
            "Enforce zero any types across all shadcn atomic primitives",
            "Audit CSS custom properties in IB_CSS against deep maroon palette",
            "Create responsive fluid container wrapper for tactical HUD components",
            "Integrate Lucide icon mappings into tactical HUD primitives",
            "Audit font-family cascade ensuring JetBrains Mono for telemetry"
        )
    },
    @{
        Number = 2; Name = "Shadcn Bento Grid & Ink-Orbit Tactical Telemetry Engine"; Assignee = "Subagent 1 (UI Architect)"; Layer = "UIComponents";
        Cat1 = "Bento Diagram Integration"; Cat2 = "Telemetry Animations & Safety";
        Sec1 = "ink-orbit Customization & Theme Injection"; Sec2 = "Bento Component Barrels & Mounting"; Sec3 = "Vector Flow Paths & Motion Safety";
        Tasks = @(
            "Mount ink-orbit-features bento section in Home.tsx showcase",
            "Test ink-orbit-features SVG flow paths and Bezier curve rendering",
            "Verify dark theme data-attribute binding in bento root container",
            "Add tactical corner brackets ib-c styling overlay to bento cards",
            "Implement lazy loading for bento chart telemetry paths",
            "Verify touch targets on interactive bento avatar cluster nodes",
            "Ensure zero layout shift CLS during bento SVG stream hydration",
            "Add fallback states for bento report sheet animation on low power devices"
        )
    },
    @{
        Number = 3; Name = "Backend Database Engine, EF Core 10 & SQL Server SSMS 19 Architecture"; Assignee = "Subagent 3 (Backend Architect)"; Layer = "Database";
        Cat1 = "Strict Relational 8-Entity Model"; Cat2 = "Zero SQLite & Enterprise ConnStrings";
        Sec1 = "Entity Schemas & FK Constraints"; Sec2 = "Migration Engine & Seed Verification"; Sec3 = "DB Caching & Connection Pools";
        Tasks = @(
            "Audit SQL Server SSMS 19 connection string and dual authentication",
            "Verify zero SQLite references across all project layers and scripts",
            "Inspect EF Core 10 entity relationships and foreign key cascades",
            "Verify DatabaseSeeder.cs multi-agency accounts in ResQTrackDb",
            "Audit EF Core global query filters for soft-deleted user preservation",
            "Configure DbContext pool sizing and connection retry policies",
            "Validate database migration idempotency via CommandStart/migrate.ps1",
            "Benchmark database read latency under simulated concurrent triage load"
        )
    },
    @{
        Number = 4; Name = "Backend Universal Lambda API Services & Repository Flowchain"; Assignee = "Subagent 3 (Backend Architect)"; Layer = "Services";
        Cat1 = "6-Tier Unidirectional Flowchain"; Cat2 = "Universal Lambda Implementations";
        Sec1 = "Generic & Entity Repositories"; Sec2 = "Services & DI Registration"; Sec3 = "DTO Validation & Sanitization";
        Tasks = @(
            "Enforce universal lambda expressions => across IUserRepository and UserRepository",
            "Enforce universal lambda expressions => across IUserGovernanceService",
            "Enforce universal lambda expressions => across IIncidentReportRepository",
            "Enforce universal lambda expressions => across IIncidentReportService",
            "Verify DI service container registrations in Program.cs",
            "Audit DTO DataAnnotations validation attributes across all payload models",
            "Enforce InputSanitizer script stripping across incident text fields",
            "Audit controller action return types ensuring standard ApiResponse contracts"
        )
    },
    @{
        Number = 5; Name = "Cryptographic Authentication, Scrypt KDF & Security Engine"; Assignee = "Subagent 3 (Backend Architect)"; Layer = "Security";
        Cat1 = "Scrypt Password Hashing & Salt"; Cat2 = "Constant-Time Comparisons";
        Sec1 = "ScryptPasswordHelper & FixedTimeEquals"; Sec2 = "Per-Request DB Status Check"; Sec3 = "Dual-Port RBAC Isolation";
        Tasks = @(
            "Audit ScryptPasswordHelper.cs KDF salt generation and iterations",
            "Verify CryptographicOperations.FixedTimeEquals constant time hash check",
            "Enforce per-request user status check in SessionVerificationMiddleware",
            "Verify dual-port RBAC boundary returning 403 Forbidden on Port 5174",
            "Test Bearer token injection and expiration handling in apiClient.ts",
            "Validate secure HttpOnly cookie flags for production environments",
            "Verify Scrypt authentication benchmark against timing attack probes",
            "Conduct automated penetration test against password brute force vectors"
        )
    },
    @{
        Number = 6; Name = "Zero-Demo Unified Public Auth Portal (Port 5173)"; Assignee = "Subagent 2 (RBAC Specialist)"; Layer = "PublicPortal";
        Cat1 = "Single Universal Login Page"; Cat2 = "Zero Client-Side Unit Selector Tabs";
        Sec1 = "Fluid Responsive Form Layout"; Sec2 = "Dynamic Backend Role Routing"; Sec3 = "Tactical Aesthetic & Error HUD";
        Tasks = @(
            "Redesign LoginPage.tsx with tactical glassmorphism and deep maroon tokens",
            "Eliminate all cosmetic unit selector tabs and radio buttons from LoginPage",
            "Implement dynamic backend RBAC redirect for Civilians and Responders",
            "Verify zero demo account credentials or shortcut buttons on LoginPage",
            "Audit input validation feedback and error HUD alerts on LoginPage",
            "Test keyboard navigation and tab order accessibility on LoginPage",
            "Ensure fluid responsive scaling across mobile tablet and desktop viewports",
            "Verify zero API regression on authEndpoints.ts loginUser function"
        )
    },
    @{
        Number = 7; Name = "LDRRMO SuperAdmin Dedicated Command Portal (Port 5174)"; Assignee = "Subagent 2 (RBAC Specialist)"; Layer = "AdminPortal";
        Cat1 = "Dedicated Admin Login Page"; Cat2 = "Port 5174 Strict Boundary Guard";
        Sec1 = "Elimination of Cosmetic Wedges"; Sec2 = "Admin Session Hydration"; Sec3 = "SuperAdmin Credentials Check";
        Tasks = @(
            "Enhance AdminLoginPage.tsx on Port 5174 with cybernetic grid HUD backdrop",
            "Eliminate all cosmetic wedge artifacts from AdminLoginPage layout",
            "Enforce strict 403 Forbidden rejection for non-admin accounts on Port 5174",
            "Verify zero demo account buttons or pre-filled forms on AdminLoginPage",
            "Verify synchronous hydration of LDRRMO SuperAdmin session tokens",
            "Audit responsive layout of AdminLoginPage at extreme zoom levels",
            "Test keyboard focus trapping and enter key submission on AdminLoginPage",
            "Verify Port 5174 Vite proxy redirection to Kestrel backend port 5000"
        )
    },
    @{
        Number = 8; Name = "Synchronous Session Hydration & Dynamic Emblems Engine"; Assignee = "Subagent 2 (RBAC Specialist)"; Layer = "Navigation";
        Cat1 = "useSession Immediate Sync Hydration"; Cat2 = "Sidebar Agency Emblems & Glow";
        Sec1 = "Elimination of Fallback Traps"; Sec2 = "Agency Visual Identifiers"; Sec3 = "Active Link & Collapsible Bar";
        Tasks = @(
            "Refactor useSession.ts to immediately hydrate authentication state on mount",
            "Eliminate generic fallback role traps in LayoutWrappers.tsx",
            "Implement LDRRMO Civil Defense executive emblem and hazard glow in Sidebar",
            "Implement RHU Medical electric cyan emblem and stethoscope badge in Sidebar",
            "Implement BFP Fire flame orange emblem and apparatus shield in Sidebar",
            "Implement PNP Police law enforcement blue emblem and star badge in Sidebar",
            "Implement Civilian Resident safety rose emblem and community badge in Sidebar",
            "Add collapsible sidebar toggle with smooth fluid width transitions"
        )
    },
    @{
        Number = 9; Name = "LDRRMO SuperAdmin Operations Command Center (C2)"; Assignee = "Subagent 4 (Admin Specialist)"; Layer = "AdminFeatures";
        Cat1 = "High-Density Telemetry Counters"; Cat2 = "Master Incident Command Queue";
        Sec1 = "Real-Time Incident Triage"; Sec2 = "Fleet Deployment Grid"; Sec3 = "Alerts Center & Siren System";
        Tasks = @(
            "Upgrade AdminDashboard.tsx into tactical military C2 operations room",
            "Embed high-density telemetry counters for active incidents and fleet readiness",
            "Refactor IncidentsPage.tsx master incident triage queue with severity badges",
            "Implement real-time incident status transition controls in IncidentsPage",
            "Modernize RespondersRosterPage.tsx multi-agency fleet deployment grid",
            "Refactor AlertsCenter.tsx with municipal broadcast siren trigger",
            "Enhance SettingsPage.tsx with municipal geofence and API configuration",
            "Verify zero API regression on adminGovernanceApi.ts metrics endpoints"
        )
    },
    @{
        Number = 10; Name = "LDRRMO SuperAdmin Full CRUD User Governance Architecture"; Assignee = "Subagent 4 (Admin Specialist)"; Layer = "Governance";
        Cat1 = "Universal Lambda Admin Endpoints"; Cat2 = "4 Katipuneros Governance Modals";
        Sec1 = "AddUserModal & Roster Assignment"; Sec2 = "ViewUserDetailModal & PRC Inspector"; Sec3 = "EditUser & DeleteUser Soft-Delete";
        Tasks = @(
            "Refactor UserManagementPage.tsx with high-density tabular governance controls",
            "Modernize AddUserModal.tsx supporting all 5 Philippine emergency roles",
            "Modernize ViewUserDetailModal.tsx with live badge and credential inspector",
            "Modernize EditUserModal.tsx preserving role assignments and security levels",
            "Modernize DeleteUserConfirmModal.tsx with soft-delete safety challenge",
            "Integrate toast alerts useToasts on all admin CRUD mutation outcomes",
            "Verify EF Core soft-deletion query filters ensuring zero data destruction",
            "Conduct automated end-to-end integration test of complete admin CRUD lifecycle"
        )
    },
    @{
        Number = 11; Name = "Tamper-Evident SHA-256 Continuous Audit Log Chaining"; Assignee = "Subagent 3 (Backend Architect)"; Layer = "AuditTrail";
        Cat1 = "Cryptographic Hash Chaining Invariants"; Cat2 = "Column Sizing & Zero Truncation";
        Sec1 = "AuditLog Entity & Genesis Hash"; Sec2 = "Immutable Append-Only Ledger"; Sec3 = "Administrative Mutation Auditing";
        Tasks = @(
            "Audit AuditLog.cs entity schema and PreviousHash column sizing",
            "Verify genesis block initialization with standard 64-char hex zero hash",
            "Verify continuous SHA-256 hash calculation across consecutive audit entries",
            "Enforce automatic audit log creation on every admin user mutation",
            "Enforce automatic audit log creation on every incident status change",
            "Create cryptographic verification routine detecting broken audit links",
            "Build admin audit log table view with hash inspection modal in Frontend",
            "Execute automated audit ledger validation test against SQL Server"
        )
    },
    @{
        Number = 12; Name = "RHU Medical Response Terminal (EMS, Trauma Triage & Hospital Beds)"; Assignee = "Subagent 5 (Responder Specialist)"; Layer = "MedicalOps";
        Cat1 = "Paramedic & Emergency Medical HUD"; Cat2 = "START Trauma Triage Protocol";
        Sec1 = "Dedicated Medical Dashboard"; Sec2 = "Hospital ER Bed Availability"; Sec3 = "Ambulance Telemetry & Dispatch";
        Tasks = @(
            "Transform ResponderDashboard into dedicated RHU Medical Operations Terminal",
            "Implement START trauma triage classification counters (Immediate, Delayed, Minimal, Expectant)",
            "Design dedicated ambulance paramedic crew fleet and equipment monitor",
            "Upgrade UnitIncidentsFeed.tsx with casualty count and triage tags",
            "Add hospital ER bed availability monitor card with live capacity counters",
            "Upgrade DutyRosterView.tsx with paramedic shift rosters and call signs",
            "Add rapid dispatch acknowledgment button with ambulance en route timer",
            "Verify high-contrast tactical legibility under emergency field conditions"
        )
    },
    @{
        Number = 13; Name = "BFP Fire Protection & Hazmat Rescue Operations Terminal"; Assignee = "Subagent 5 (Responder Specialist)"; Layer = "FireOps";
        Cat1 = "Fire Ground Command & Alarm Matrix"; Cat2 = "Fire Apparatus & Water Telemetry";
        Sec1 = "Dedicated Fire Dashboard"; Sec2 = "Hydrant Geospatial Locator"; Sec3 = "Hazmat Triage & Containment";
        Tasks = @(
            "Transform ResponderDashboard into dedicated BFP Fire Command Terminal",
            "Implement structural fire alarm tier matrix counters (1st Alarm to General Alarm)",
            "Design fire engine company apparatus telemetry card (water volume, pump pressure)",
            "Upgrade UnitIncidentsFeed.tsx with structural fire and hazmat tags",
            "Add municipal fire hydrant geospatial locator and live pressure indicators",
            "Upgrade DutyRosterView.tsx with nozzle-man and pump operator assignments",
            "Implement fire containment status tracker (Under Control, Fire Out)",
            "Verify low-light night-ops high-contrast dark theme readability"
        )
    },
    @{
        Number = 14; Name = "PNP Police Sector Patrol & Traffic Collision Blotter Terminal"; Assignee = "Subagent 5 (Responder Specialist)"; Layer = "PoliceOps";
        Cat1 = "Law Enforcement Blotter & Crime"; Cat2 = "Patrol Beat Tracking & Cordon";
        Sec1 = "Dedicated Police Dashboard"; Sec2 = "Vehicular Collision Logging"; Sec3 = "Sector Cordon Controls";
        Tasks = @(
            "Transform ResponderDashboard into dedicated PNP Police Operations Terminal",
            "Implement law enforcement incident counters (Traffic Collisions, Patrol Calls, Blotters)",
            "Design dedicated patrol beat cruiser fleet tracking card",
            "Upgrade UnitIncidentsFeed.tsx with vehicular collision investigation details",
            "Add road accident blotter entry form with plate and license recording",
            "Upgrade DutyRosterView.tsx with sector patrol assignments and radio call signs",
            "Implement cordon and road closure status toggles for active crime scenes",
            "Verify high-contrast readability in mobile cruiser tablet viewports"
        )
    },
    @{
        Number = 15; Name = "Civilian SOS Emergency Action Portal & Mobile Viewport Engine"; Assignee = "Subagent 6 (Civilian Specialist)"; Layer = "CivilianOps";
        Cat1 = "Urgency-Focused Citizen Dashboard"; Cat2 = "One-Tap SOS Dispatch Trigger";
        Sec1 = "Mobile Viewport Optimization"; Sec2 = "Localized Community Broadcasts"; Sec3 = "Incident History & Tracking";
        Tasks = @(
            "Upgrade CivilianDashboard.tsx with high-urgency emergency action center HUD",
            "Implement instant one-tap SOS emergency trigger with confirmation countdown",
            "Upgrade MyReportsHistory.tsx with live incident status progression timeline",
            "Upgrade CommunityAlertsPage.tsx with localized flood and evacuation advisories",
            "Upgrade EmergencyHotlinesUnits.tsx with one-tap emergency direct dial",
            "Enhance CivilianProfile.tsx displaying PhilSys ID verification status",
            "Audit mobile fluid responsiveness using Hooks/useFluidResposiveness.ts",
            "Verify zero civilian access to administrative governance routes and endpoints"
        )
    },
    @{
        Number = 16; Name = "Anti-Spoofing Camera Viewfinder & Zero Gallery Bypass Architecture"; Assignee = "Subagent 6 (Civilian Specialist)"; Layer = "CameraAntiSpoof";
        Cat1 = "Native MediaStream API Lifecycle"; Cat2 = "Strict Anti-Spoofing Guards";
        Sec1 = "Full-Screen Camera Reticle HUD"; Sec2 = "Single Snapshot Freeze & Re-take"; Sec3 = "Memory Cleanup & Stream Closure";
        Tasks = @(
            "Redesign ReportAccidentPage.tsx with full-screen tactical camera viewfinder HUD",
            "Enforce strict elimination of file upload input and gallery bypass",
            "Implement single live snapshot freeze with instant retake controls",
            "Add target emergency agency selector chips (LDRRMO, RHU, BFP, PNP)",
            "Add incident category selector chips (Road Collision, Structural Fire, Medical Emergency)",
            "Manage camera MediaStream tracks ensuring complete hardware release on unmount",
            "Handle camera permission denials gracefully with clear instructional HUD",
            "Test camera viewfinder functionality across iOS Safari and Android Chrome"
        )
    },
    @{
        Number = 17; Name = "Hardware GPS Sensor Feed & Canvas Watermark Burn-In Engine"; Assignee = "Subagent 6 (Civilian Specialist)"; Layer = "GeospatialSensor";
        Cat1 = "Continuous Hardware Geolocation"; Cat2 = "Cryptographic Watermark Synthesis";
        Sec1 = "GPS Sensor Stabilization Loop"; Sec2 = "Non-Repudiation Watermark"; Sec3 = "PNG Data URL & Payload Sync";
        Tasks = @(
            "Integrate continuous hardware GPS sensor tracking via navigator.geolocation",
            "Implement GPS accuracy stabilization loop filtering low-confidence fixes",
            "Build HTML5 Canvas watermark burn-in engine embedding coordinates and timestamp",
            "Embed non-repudiation cryptographic telemetry banner onto captured accident image",
            "Generate standardized base64 PNG Data URL payload (data:image/png;base64,...)",
            "Verify coordinate transmission and mapping to backend IncidentReport entity",
            "Test offline GPS coordinate caching when network connectivity drops",
            "Validate GPS sensor accuracy bounds against Urbiztondo municipal geofence"
        )
    },
    @{
        Number = 18; Name = "Client-Side Laplacian Edge Variance Blur Detection"; Assignee = "Subagent 6 (Civilian Specialist)"; Layer = "ComputerVision";
        Cat1 = "Laplacian Convolution Kernel"; Cat2 = "Real-Time Blur Classification";
        Sec1 = "2D Canvas Grayscale Transform"; Sec2 = "Blur Threshold Boundary Guard"; Sec3 = "Tactical Re-Take HUD Guidance";
        Tasks = @(
            "Implement client-side 2D Canvas pixel extraction and grayscale conversion",
            "Implement discrete 3x3 Laplacian convolution kernel for edge variance computation",
            "Calculate image Laplacian variance score reflecting focus sharpness",
            "Enforce blur threshold boundary guard flagging captures with variance < 100",
            "Display tactical warning HUD with real-time stability guidance when blur is detected",
            "Require explicit confirmation or retake when submitting low-clarity accident capture",
            "Benchmark Laplacian edge computation speed ensuring < 250ms execution on mobile",
            "Create automated unit test suite verifying blur detection accuracy on sample images"
        )
    },
    @{
        Number = 19; Name = "Real-Time Multi-Agency Event Bus & Synchronization"; Assignee = "Subagent 4 (Admin Specialist)"; Layer = "EventBus";
        Cat1 = "Custom DOM Event Bus (resqtrack:report)"; Cat2 = "Real-Time Sibling Notification";
        Sec1 = "Global Nav & Header Listeners"; Sec2 = "Live Incident Feed Updating"; Sec3 = "Zero Reload State Updates";
        Tasks = @(
            "Implement window CustomEvent dispatch for resqtrack:report upon incident creation",
            "Configure global Header.tsx notification bell listener for resqtrack:report events",
            "Implement real-time triage queue updates in AdminDashboard without page reload",
            "Implement real-time incident queue updates in ResponderDashboard without page reload",
            "Implement instant notification sound and visual flash on incoming emergency report",
            "Sync civilian MyReportsHistory view immediately after successful accident submission",
            "Test multi-tab event synchronization across separate browser windows",
            "Validate zero memory leak on event listener registration and cleanup"
        )
    },
    @{
        Number = 20; Name = "Mathematical Geospatial Triage & Haversine Nearest-Unit Dispatch"; Assignee = "Subagent 4 (Admin Specialist)"; Layer = "TriageEngine";
        Cat1 = "Great-Circle Haversine Engine"; Cat2 = "Deterministic Unit Recommendation";
        Sec1 = "Mathematical Formula Implementation"; Sec2 = "Proximity Sorting Across Units"; Sec3 = "Dispatch Recommendation Badges";
        Tasks = @(
            "Implement exact mathematical Haversine distance formula 2R*arcsin in TypeScript",
            "Implement exact mathematical Haversine distance formula in C# backend service",
            "Sort available emergency units (RHU, BFP, PNP) by computed proximity in kilometers",
            "Render nearest unit recommendation card with ETA and distance badges in Admin Portal",
            "Compute estimated response time based on standard municipal transit speeds",
            "Highlight nearest emergency unit with glowing green tactical dispatch indicator",
            "Audit Haversine precision against known geographic landmarks in Urbiztondo",
            "Create automated test validating deterministic dispatch recommendations across test points"
        )
    },
    @{
        Number = 21; Name = "Zero-Baseline Empty State Resilience ($N = 0$) & Guarded Computations"; Assignee = "Subagent 6 (Civilian Specialist)"; Layer = "Resilience";
        Cat1 = "Clean Zero Display Architecture"; Cat2 = "Division-by-Zero Protection";
        Sec1 = "Ratio & Percentage Audit"; Sec2 = "Graceful Empty State Cards"; Sec3 = "Elimination of NaN% & Undefined";
        Tasks = @(
            "Audit all percentage and ratio calculations across frontend dashboards",
            "Enforce division-by-zero protection returning 0.0% when total incidents is zero",
            "Design tactical empty state cards with radar sweep graphics for zero-incident queues",
            "Ensure fleet roster renders clean No Units Deployed state without layout collapse",
            "Audit backend summary endpoints ensuring zero null reference exceptions on empty DB",
            "Verify clean zero presentation on brand new database initialization",
            "Test dashboard rendering stability when all data tables are completely empty",
            "Create automated test asserting zero NaN% or undefined strings in rendered DOM"
        )
    },
    @{
        Number = 22; Name = "CommandStart CLI Harness & Autonomous DevOps Automation"; Assignee = "Subagent 7 (Loop-Eng Auditor)"; Layer = "DevOps";
        Cat1 = "Unified PowerShell & Batch Suite"; Cat2 = "SuperAdmin Account Provisioning";
        Sec1 = "manage.ps1 Console Controller"; Sec2 = "startdev-all.ps1 Clean Tree"; Sec3 = "migrate.ps1 SSMS 19 Connection";
        Tasks = @(
            "Audit manage.ps1 unified 12-option interactive console controller in CommandStart",
            "Audit startdev-all.ps1 verifying clean concurrent process launch on ports 5000, 5173, 5174",
            "Audit stopdev-all.ps1 ensuring clean PID tree termination and port liberation",
            "Verify createsuperadmin.ps1 and customcreatesuperadmin.ps1 provisioning logic",
            "Verify deletesuperadmin.ps1 with foreign key integrity and audit logging",
            "Audit cli.ps1 user governance command suite (list, add, delete, reset)",
            "Test root start.ps1 -Dev launcher functionality from workspace root",
            "Document complete DevOps harness operations in CommandStart/README.md"
        )
    },
    @{
        Number = 23; Name = "Interactive API Documentation Engine (Scalar V1 & OpenAPI 3.1.1)"; Assignee = "Subagent 3 (Backend Architect)"; Layer = "Documentation";
        Cat1 = "Scalar Interactive UI Configuration"; Cat2 = "OpenAPI 3.1.1 Schema Mapping";
        Sec1 = "Unconditional Program.cs Mapping"; Sec2 = "Kestrel Route Redirects"; Sec3 = "Full Endpoint Coverage (8 Entities)";
        Tasks = @(
            "Verify unconditional Scalar interactive documentation mapping in Program.cs",
            "Verify Kestrel route redirects for relative assets in Scalar.AspNetCore",
            "Audit OpenAPI 3.1.1 JSON specification at http://localhost:5000/openapi/v1.json",
            "Verify interactive Scalar documentation rendering at http://localhost:5000/scalar/v1",
            "Ensure all 8 core entity endpoints are documented with request and response schemas",
            "Verify authorization header Bearer token input in Scalar interactive UI",
            "Test live API execution and curl generation directly from Scalar documentation",
            "Validate zero 404 errors on static assets referenced by Scalar UI"
        )
    },
    @{
        Number = 24; Name = "Obsidian Memory Engine, P.A.R.A. Knowledge Vault & Graphify AST"; Assignee = "Subagent 6 (Civilian Specialist)"; Layer = "Knowledge";
        Cat1 = "P.A.R.A. Knowledge Vault Structure"; Cat2 = "Zettelkasten Atomic Cards";
        Sec1 = "Session Delivery Notes"; Sec2 = "ZK Cards (ZK-057 to ZK-070)"; Sec3 = "Graphify AST Caching";
        Tasks = @(
            "Synchronize Obsidian Vault 10 - Projects/Incident-AI-System-Detection/ structure",
            "Update Incident-AI-HubNote.md linking all 25 phases and 200 tasks",
            "Create atomic Zettelkasten card for Ink-Orbit bento grid architecture",
            "Create atomic Zettelkasten card for dynamic multi-agency sidebar emblems",
            "Create atomic Zettelkasten card for client-side Laplacian blur convolution",
            "Create atomic Zettelkasten card for hardware GPS canvas watermark burn-in",
            "Verify Graphify AST knowledge graph cached strictly outside vault in Md data/MemoryCache",
            "Reconcile CLAUDE.md and GEMINI.md ICM routing tables with active project state"
        )
    },
    @{
        Number = 25; Name = "Loop-Eng Closed-Loop QA, Browser Automation & Production Hardening"; Assignee = "Subagent 7 (Loop-Eng Auditor)"; Layer = "QAAndProd";
        Cat1 = "Dual-Loop Machine Verification"; Cat2 = "Playwright / Chrome Browser E2E";
        Sec1 = "Zero TypeScript & Build Errors"; Sec2 = "Browser Visual HUD Verification"; Sec3 = "Production Artifacts & Git Commit";
        Tasks = @(
            "Execute complete TypeScript static type check npx tsc --noEmit (0 errors)",
            "Execute Vite production bundle build npm run build (0 errors, 0 warnings)",
            "Verify .NET 10 backend build dotnet build with zero warnings and zero errors",
            "Launch headless browser subagent session verifying Port 5173 and Port 5174",
            "Inspect ink-orbit-features bento section visual fidelity in browser",
            "Simulate authenticated user flows in browser across all 5 emergency roles",
            "Conduct browser network tab inspection verifying zero failed API calls",
            "Finalize and commit master workspace state with clean git working tree"
        )
    }
)

$taskCounter = 1

foreach ($p in $phases) {
    $phaseNumStr = "{0:D2}" -f $p.Number
    $phaseName = $p.Name
    $assignee = $p.Assignee
    $layer = $p.Layer
    $cat1 = $p.Cat1
    $cat2 = $p.Cat2
    $sec1 = $p.Sec1
    $sec2 = $p.Sec2
    $sec3 = $p.Sec3
    
    for ($i = 0; $i -lt $p.Tasks.Count; $i++) {
        $taskId = "TASK-{0:D3}" -f $taskCounter
        $taskTitle = $p.Tasks[$i]
        
        # Determine category (1-4 -> Cat1, 5-8 -> Cat2)
        $currentCat = if ($i -lt 4) { $cat1 } else { $cat2 }
        $currentCatNum = if ($i -lt 4) { ($p.Number * 2) - 1 } else { ($p.Number * 2) }
        $currentCatStr = "Category {0:D2}: {1}" -f $currentCatNum, $currentCat
        
        # Determine section (1-3 -> Sec1, 4-5 -> Sec2, 6-8 -> Sec3)
        $secOffset = if ($i -lt 3) { 1 } elseif ($i -lt 5) { 2 } else { 3 }
        $currentSecNum = (($p.Number - 1) * 3) + $secOffset
        $currentSec = if ($i -lt 3) { $sec1 } elseif ($i -lt 5) { $sec2 } else { $sec3 }
        $currentSecStr = "Section {0:D2}: {1}" -f $currentSecNum, $currentSec
        
        # Generate slug
        $slug = $taskTitle.ToLower() -replace '[^a-z0-9]+', '-' -replace '^-+|-+$', ''
        if ($slug.Length -gt 50) { $slug = $slug.Substring(0, 50).TrimEnd('-') }
        $fileName = "$taskId-$slug.md"
        
        $content = @"
---
id: "$taskId"
phase: "Phase ${phaseNumStr}: $phaseName"
category: "$currentCatStr"
section: "$currentSecStr"
title: "$taskTitle"
assignee: "$assignee"
status: "READY"
flowchain_layer: "$layer"
created: "2026-10-22T15:15:00+08:00"
tags:
  - resqtrack
  - phase-$phaseNumStr
  - $layer
  - autonomous-task
---

# ${taskId}: $taskTitle

## 1. Architectural Alignment
- **Phase:** Phase ${phaseNumStr} — $phaseName
- **Category:** $currentCatStr
- **Section:** $currentSecStr
- **Assignee:** $assignee
- **Flowchain Layer:** $layer
- **System Identity:** INCIDENT AI SYSTEM DETECTION (ResQTrack Engine)

---

## 2. Objective & Scope
The objective of this task is to implement, configure, and verify:
> **$taskTitle**

This task is part of the 25-Phase, 50-Category, 75-Section Master Autonomous Execution Plan. It ensures 100% full-stack development integrity, production-grade stability, zero regression on existing backend and database connectivity, and adherence to the deep maroon emergency tactical HUD aesthetic.

---

## 3. Implementation Directives & Invariants
1. **Universal Lambda Expression (`=>`) Rule:** Use clean, concise lambda expressions (`=>`) for all synchronous and asynchronous operations.
2. **Strict Typing Mandate:** Ensure zero `any` types across TypeScript files.
3. **Zero Backend/Database Regression:** Never modify or break the immutable endpoints and services documented in `05_IMMUTABLE_FUNCTIONS_AND_BACKEND_CONNECTIVITY_REGISTRY.md`.
4. **Color Scheme Invariant:** Preserve the deep maroon emergency palette (`#14020a`, `#340313`, `#44212c`) and tactical rose gold accents (`#ff5c74`).
5. **Role-Based Isolation:** Respect the strict dual-port boundary (Port 5174 for LDRRMO SuperAdmin; Port 5173 for Civilians and Responders).

---

## 4. Machine Verification Command
To verify completion of this task, execute:
```powershell
# Frontend Verification
cd "c:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Project system ENGINE\Frontend"
npx tsc --noEmit && npm run build

# Backend Verification
cd "c:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Project system ENGINE\Backend"
dotnet build
```

---

## 5. Acceptance & Completion Criteria
- [ ] Task implementation completed in accordance with Katipuneros 6-Tier Architecture.
- [ ] Zero TypeScript static compilation errors (`tsc -b` exits with 0).
- [ ] Zero backend build errors or warnings (`dotnet build` exits with 0).
- [ ] All buttons, interactions, and navigations verified functional.
- [ ] Progress recorded in the Obsidian Memory Vault.
"@
        
        $filePath1 = Join-Path $targetDir1 $fileName
        $filePath2 = Join-Path $targetDir2 $fileName
        
        [System.IO.File]::WriteAllText($filePath1, $content, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($filePath2, $content, [System.Text.Encoding]::UTF8)
        
        $taskCounter++
    }
}

Write-Host "SUCCESS: Generated $($taskCounter - 1) Phased Task Markdown Files across 25 Phases, 50 Categories, and 75 Sections in both locations!" -ForegroundColor Green
