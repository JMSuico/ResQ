# INCIDENT AI SYSTEM DETECTION — ResQTrack Deterministic Emergency Triage, Verification & Dispatch Engine

> **Master Workspace Entry Document & Directory Indicator**  
> **System Identity:** `INCIDENT AI SYSTEM DETECTION` (`ResQTrack Engine`)  
> **Architecture Standard:** Katipuneros-Style 6-Tier Unidirectional Vertical Slice Architecture + Universal Lambda Expressions (`=>`) + 29-Plugin Operational Synthesis + 3-Skill Knowledge Architecture (Obsidian + Graphify + ICM)  
> **Active Timestamp Baseline:** `10-20-2026/08:46:03 AM`

---

## 1. Executive System Overview

**INCIDENT AI SYSTEM DETECTION (`ResQTrack`)** is a deterministic, cryptographically verified emergency incident detection, triage, biometric identity verification, geospatial satellite tracking, and multi-agency dispatch engine designed for **Urbiztondo, Pangasinan (`LDRRMO`, `RHU`, `FIRE`, `PNP`, and `Civilians / UG Residents`)**.

Unlike black-box probabilistic wrappers, the ResQTrack Engine enforces **100% deterministic verification, strict role-isolated vertical slices, Scrypt + `timingSafeEqual` (`CryptographicOperations.FixedTimeEquals`) authentication, per-request account status validation (`status === "verified"`), SHA-256 tamper-evident audit hash chaining, and Haversine nearest-unit dispatch**.

---

## 2. Master Directory Indicator & Governance Map ("One Home Per Fact")

Every file, rule, plan, plugin specification, memory cache, knowledge note, and source module in this workspace has a single authoritative home. **Never duplicate facts across directories.**

```
C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\
|
|-- README.md                                       # [THIS FILE] Master workspace entry & directory indicator
|
|-- start.bat                                       # 1-Click root launcher (Interactive menu by default / passes arguments)
|-- start.ps1                                       # Master PowerShell launcher (-Dev for instant start, -Action for CLI dispatch)
|
|-- CommandStart/                                   # DEDICATED COMMAND HARNESS (POWERSHELL + BATCH SUITE)
|   |-- manage.ps1 / manage.bat                     # Unified 12-option interactive console controller & CLI dispatcher
|   |-- startdev-all.ps1 / startdev-all.bat         # 1-click concurrent dev launcher (Backend :5000 + Frontend :5173 + Browser)
|   |-- stopdev-all.ps1 / stopdev-all.bat           # Clean process termination for ports 5000 & 5173 via PID tree kill
|   |-- migrate.ps1 / migrate.bat                   # Interactive EF Core SQL Server (SSMS 19) migrations (Check/Update/Add)
|   |-- createsuperadmin.ps1 / createsuperadmin.bat # Quick SuperAdmin creator (Default: LDRRMO Director Ramos)
|   |-- customcreatesuperadmin.ps1 / .bat           # Interactive/scripted Admin creator with emergency unit selection
|   |-- deletesuperadmin.ps1 / deletesuperadmin.bat # Secure SuperAdmin deletion with FK cleanup & safety prompt
|   `-- cli.ps1 / cli.bat                           # Administrative user governance console (list, add, delete, reset)
|
|-- Md data/                                        # MASTER GOVERNANCE, PLANS, PLUGINS & MEMORY CACHE HUB
|   |-- SKILL.md                                    # Binding Full-Stack Architecture Skill (Sections 0–17, 900+ lines)
|   |-- AGENTS.md                                   # Binding AI Agent Behavior Contract (700+ lines)
|   |-- CLAUDE.md                                   # ICM Routing Table & Karpathy 4-Principle Directives for Claude Code
|   |-- GEMINI.md                                   # ICM Routing Table & Operational Directives for Gemini / Antigravity
|   |
|   |-- Plans/                                      # TIMESTAMPED ARCHITECTURAL & IMPLEMENTATION PLANS
|   |   |-- README_PLANS_INDEX.md                   # Master index of all timestamped plan folders
|   |   `-- 10-20-2026/                             # Date folder (MM-DD-YYYY)
|   |       `-- 08-46-03 AM/                        # Time folder representing exact timestamp 10-20-2026/08:46:03 AM
|   |           |-- 01_MASTER_SYSTEM_ENGINE_PLAN.md
|   |           |-- 02_ENTITIES_AND_MULTI_ROLE_PORTALS_PLAN.md
|   |           |-- 03_KATIPUNEROS_STYLE_ARCHITECTURE_AND_FLOWCHAINS_PLAN.md
|   |           `-- 04_PLUGINS_AND_OBSIDIAN_GRAPHIFY_ICM_PLAN.md
|   |
|   |-- Plugins/                                    # CATALOG OF ALL 29 LEARNED, ADOPTED & OBEYED PLUGINS
|   |   |-- PLUGINS_MASTER_CATALOG.md               # Comprehensive synthesis of all 29 plugins from C:\Users\provu\Desktop\PLUGINS
|   |   `-- [Individual Plugin Specs & Rules]       # Domain rules extracted from all 29 plugin toolkits
|   |
|   `-- MemoryCache/                                # ACTIVE OPERATIONAL MEMORY CACHE & GRAPHIFY OUTPUT
|       |-- PLUGINS_SKILLS_MEMORY_CACHE.md          # Fast-recall operational memory cache for design tokens, security & UX
|       `-- graphify-out/                           # Graphify Knowledge Graph output (stored OUTSIDE Obsidian vault)
|           |-- graph.json                          # 22-chunk parallel extracted AST + semantic graph + Leiden communities
|           |-- GRAPH_REPORT.md                     # God-nodes, surprising connections, community summary
|           `-- cache/                              # SHA-256 content-addressed extraction cache
|
|-- Obsidian Memory Engine/                         # OBSIDIAN VAULT (P.A.R.A. + ZETTELKASTEN KNOWLEDGE BASE)
|   |-- 00_Inbox/                                   # Unprocessed field captures & raw triage notes
|   |-- 01_Projects/                                # Active sprint & feature delivery notes
|   |-- 02_Areas/                                   # Ongoing governance areas (Security, Geospatial, Triage, RBAC)
|   |-- 03_Resources/                               # Reference architectures, formulas, & standards
|   |-- 04_Archive/                                 # Completed & historical records
|   `-- Zettelkasten/                               # Atomic permanent notes with [[Wikilinks]], YAML frontmatter & .base views
|
`-- Project system ENGINE/                          # FULL-STACK PRODUCTION SOURCE CODE (FRONTEND + BACKEND)
    |-- FRONTEND/                                   # TypeScript + React 19 + Vite + Tailwind CSS
    |   |-- App.tsx                                 # Root router with React.lazy() + Suspense + Role Guards
    |   |-- main.tsx                                # ReactDOM.createRoot entry point
    |   `-- src/
    |       |-- Assets/                             # GLOBAL CALLING IMPORT: Raw static files (images/, videos/, icons/, threejs/)
    |       |-- LANDING_PAGE/                       # Public vertical slice (Home, Login, 3-Step Register Wizard, Public Overview)
    |       |-- UserRoles/                          # Role-isolated vertical slices (SEPARATE from LANDING_PAGE)
    |       |   `-- Features/Pages/
    |       |       |-- AdminsPanel/                # Super Admin (LDRRMO) Executive Command & Governance Console
    |       |       |-- RespondersPanel/            # Responder Agency Terminals (RHU Medical, FIRE BFP, PNP Police)
    |       |       `-- CiviliansPanel/             # UG Residents / Civilians Emergency SOS & Incident Reporting Portal
    |       |-- LayoutBars/                         # GLOBAL CALLING IMPORT: LandingLayout, AdminLayout, ResponderLayout, CivilianLayout
    |       |-- Shared/                             # GLOBAL CALLING IMPORT: Universal primitives (Button, Dropdown, RadioButton, Charts/)
    |       |-- LayoutStyles/                       # GLOBAL CALLING IMPORT: MainLayout.css, PartLayout.css, FontSyle/fontStyles.css
    |       |-- Hooks/                              # GLOBAL CALLING IMPORT: useFluidResposiveness.ts, useDebounce.ts, usePagination.ts...
    |       |-- Libs/Assets/                        # GLOBAL CALLING IMPORT: data.ts, incidentSeedData.ts, links.ts
    |       `-- Endpoints/                          # GLOBAL CALLING IMPORT: Typed API stubs (authApi, reportsApi, Admin/, Responder/, Civilian/)
    |
    `-- Backend/                                    # C# .NET 10 + ASP.NET Core Web API + Entity Framework Core 10
        |-- Program.cs                              # DI wiring, SecretConfiguration startup gate, middleware pipeline, Scalar V1
        |-- appsettings.json                        # Non-secret configuration defaults
        |-- Features/
        |   |-- Data/                               # AppDbContext.cs, Migrations/, Models/ (8 core entities), Enums/
        |   |-- Repositories/                       # Interfaces/ & Implementations/ (100% Universal Lambda =>)
        |   |-- Services/                           # Interfaces/ & Implementations/ (100% Universal Lambda =>)
        |   |-- Helpers/Infrastructure/             # InputSanitizer, ScryptPasswordHelper, SessionTokenHelper, PermissionsHelper, AuditHelper
        |   |-- DBInfrastructure/                   # Database/, Cache/, ApiTools/ (Scalar V1), EmailClient/
        |   `-- Api/                                # Controllers/ (100% =>), DTOs/ (Requests/ & Responses/), Middleware/
        `-- Management/                             # CLI Commands/ (Migrations, Seeding) & Scripts/ (SetupDb.ps1)
```

---

## 3. Authoritative Governance Files (`Md data\`)

All architectural laws, coding rules, DO / NEVER DO matrices, flowchains, placement guides, and mathematical formulas are strictly defined inside `C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Md data`:

1. **[`Md data\SKILL.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md)**:
   - The exhaustive 18-section (`0` through `17`) Full-Stack Architecture Skill.
   - Defines the 6-tier unidirectional flowchain, Universal Lambda Expression (`=>`) mandate for all synchronous and asynchronous methods, Global Calling Imports, Role-Scoped `Shared/` adapters, all 7 deterministic engine flows, all 8 database entities, and all deterministic mathematical formulas.
2. **[`Md data\AGENTS.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/AGENTS.md)**:
   - The binding AI Agent Behavior Contract. Every AI agent must read `AGENTS.md` and `SKILL.md` before creating or modifying any file.
3. **[`Md data\CLAUDE.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/CLAUDE.md) & [`Md data\GEMINI.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/GEMINI.md)**:
   - Interpretable Context Methodology (ICM) routing tables ("One Home Per Fact") and Andrej Karpathy's 4 engineering principles (*Think Before Coding*, *Simplicity First*, *Surgical Changes*, *Goal-Driven Execution*).

---

## 4. Timestamped Plans Convention (`Md data\Plans\`)

All architectural and feature execution plans are stored in **`C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Md data\Plans`** organized by the strict timestamp hierarchy:
- **Logical Timestamp Format:** `MM-DD-YYYY/HH:MM:SS AM/PM` (e.g., `10-20-2026/08:46:03 AM`)
- **Windows NTFS Directory Path:** `Md data\Plans\MM-DD-YYYY\HH-MM-SS AM_PM\` (e.g., `Md data\Plans\10-20-2026\08-46-03 AM\`, substituting `-` for `:` solely to satisfy Windows NTFS filename constraints while declaring the exact `10-20-2026/08:46:03 AM` timestamp in every plan's YAML frontmatter and title banner).
- **Master Index:** See [`Md data\Plans\README_PLANS_INDEX.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/Plans/README_PLANS_INDEX.md).

---

## 5. Plugins Catalog (`Md data\Plugins\`) & Memory Cache (`Md data\MemoryCache\`)

All **29 plugins** located in `C:\Users\provu\Desktop\PLUGINS` (`agentmemory`, `andrej-karpathy-skills`, `awesome-harness-engineering`, `awesome-software-architecture`, `caveman`, `claude-code`, `claude-skills`, `context7`, `diagram-design`, `ghidra`, `GhidrAssist`, `graphify`, `headroom`, `ImHex`, `Java and JavaFX Skills Plugins`, `obsidian-skills`, `OmniRoute`, `one-skill-to-rule-them-all`, `OpenViking`, `penetrations plugins`, `playwright`, `radare2`, `ralph`, `Research Paper Writing Plugins`, `REVERSE ENGINEER ANYTHING`, `rtk`, `skills`, `ui-ux-pro-max-skill`, `wazuh`) have been analyzed, adopted, and synthesized into:
- **Catalog:** `C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Md data\Plugins`
- **Active Memory Cache:** `C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Md data\MemoryCache`

---

## 6. The 3-Skill Knowledge Architecture (Obsidian + Graphify + ICM)

The workspace implements a 3-pillar cognitive memory architecture:

| Pillar | Role | Storage Location | Core Mechanism |
|---|---|---|---|
| **1. Obsidian as Memory** | Persistent human + agent knowledge vault | `Obsidian Memory Engine\` | P.A.R.A. folders (`00_Inbox` to `04_Archive`) + `Zettelkasten/` atomic notes, `[[Wikilinks]]`, YAML frontmatter (`id`, `title`, `type`, `layer`, `Status`, `tags`, `created`), and `.base` views |
| **2. Graphify as Connections** | Structural & semantic knowledge graph | `Md data\MemoryCache\graphify-out\` *(strictly outside Obsidian vault)* | 22-chunk parallel subagent extraction (`nodes`, `edges`, `hyperedges`, `input_tokens`, `output_tokens`), Tree-sitter AST + doc/media ingestion, Leiden community clustering, god-node detection, SHA-256 caching |
| **3. ICM as Directions** | Interpretable Context Methodology routing | `Md data\CLAUDE.md` & `Md data\GEMINI.md` | "One Home Per Fact" routing table preventing context bloat and hallucination |

---

## 7. Complete System Overview: 7 Deterministic Engine Flows & 8 Core Entities

### 7.1 The 7 Deterministic System Engine Flows

```
+---------------------------------------------------------------------------------------------------+
| 1. REGISTER FLOW (3-Step Biometric & ID Capture Wizard)                                           |
|    Step 1: Account Credentials + Role Selection (LDRRMO / RHU / FIRE / PNP / Civilian)            |
|    Step 2: Live Camera / Upload Valid ID Card -> Base64 PNG Data URL (data:image/png;base64,...)  |
|    Step 3: Live Camera Biometric Face Capture -> Base64 PNG Data URL -> Status = "pending"        |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
| 2. LOGIN FLOW (Scrypt + Constant-Time Verification + Role Redirect)                               |
|    POST /api/login -> Scrypt key derivation + CryptographicOperations.FixedTimeEquals             |
|    (timingSafeEqual) -> Verify User.Status === "verified" -> Issue HttpOnly Cookie + Bearer Token |
|    -> Redirect to /admin/* (LDRRMO), /responder/* (RHU/FIRE/PNP), or /civilian/* (UG Resident)    |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
| 3. SESSION & PER-REQUEST VERIFICATION GUARD FLOW                                                  |
|    GET /api/session & Middleware Guard -> Re-evaluates active Session token expiry AND queries    |
|    User.Status === "verified" on EVERY protected request. Suspended/Pending users are rejected.   |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
| 4. REPORT ACCIDENT FLOW (Camera FAB + GPS Telemetry + Custom DOM Event)                           |
|    Floating Action Button (FAB) Camera Capture -> PNG Data URL + GPS (Lat/Lng) + Severity/Agency  |
|    -> POST /api/reports -> Persists Report + IncidentFixture -> Dispatches window CustomEvent     |
|    new CustomEvent('resqtrack:report', { detail: report }) for instant cross-panel reactivity.    |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
| 5. MONITOR & TRIAGE ENGINE FLOW (Satellite Map + Incidents Board + Duty Roster + Alerts)          |
|    Deterministic Triage Priority Score + Haversine Nearest-Unit Distance Calculation              |
|    -> Interactive Satellite Map (Urbiztondo 15.8228° N, 120.3292° E) + Live Incident Queue        |
|    + Responder DutyUnit Status (Available / Dispatched / EnRoute / OnScene) + AlertReadState.     |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
| 6. ADMIN GOVERNANCE & BIOMETRIC INSPECTION FLOW (LDRRMO Super Admin)                              |
|    GET /api/users -> PATCH /api/users/:id/status (Approve -> "verified" / Reject / Suspend)       |
|    -> GET /api/users/:id/captures/:kind (kind = "id" | "face" PNG stream inspection) + AuditLog.  |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
| 7. LOGOUT & CRYPTOGRAPHIC SESSION REVOCATION FLOW                                                 |
|    POST /api/logout -> Revokes Session record in DB -> Clears Cookie & Bearer storage -> /login.  |
+---------------------------------------------------------------------------------------------------+
```

### 7.2 The 8 Core Database Entities (`Features/Data/Models/`)

| # | Entity | Primary Key | Core Responsibility & Deterministic Invariants |
|---|---|---|---|
| **1** | [`User`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md) | `Guid Id` | Multi-role identity (`LDRRMO`, `RHU`, `FIRE`, `PNP`, `Civilian`), `PasswordHash` (`scrypt$N$r$p$salt$hash`), `Status` (`pending`, `verified`, `rejected`, `suspended`), `IdCardDataUrl`, `FaceCaptureDataUrl` |
| **2** | [`Session`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md) | `Guid Id` | Cryptographic session token (`TokenHash`), `UserId` FK, `ExpiresAt`, `IsRevoked`, `IpAddress`, `UserAgent` |
| **3** | [`Report`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md) | `Guid Id` | Citizen/Responder incident report: `ReporterId` FK, `Title`, `Category`, `Severity`, `TargetAgency` (`LDRRMO`/`RHU`/`FIRE`/`PNP`), `Latitude`, `Longitude`, `Barangay`, `PhotoDataUrl` (PNG), `TriageScore`, `Status` |
| **4** | [`IncidentFixture`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md) | `Guid Id` | Map pin & tactical telemetry fixture linked to `ReportId` FK: satellite coordinates, radius zone, assigned `DutyUnitId` FK, ETA minutes, Haversine distance km |
| **5** | [`DutyUnit`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md) | `Guid Id` | Emergency response unit (`UnitCode`, `Agency` [`LDRRMO`/`RHU`/`FIRE`/`PNP`], `CommanderName`, `ContactNumber`, `BaseLatitude`, `BaseLongitude`, `CurrentStatus`) |
| **6** | [`Settings`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md) | `Guid Id` | System-wide deterministic parameters (`Key`, `Value`, `Category`, `UpdatedByUserId`, `UpdatedAt`) — e.g., geofence bounds, auto-refresh intervals, triage weights |
| **7** | [`AlertReadState`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md) | `Guid Id` | Per-user notification & emergency broadcast read tracking (`UserId` FK, `ReportId` FK, `IsRead`, `ReadAt`) |
| **8** | [`AuditLog`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md) | `Guid Id` | Immutable tamper-evident ledger (`ActorUserId`, `Action`, `TargetEntity`, `EntityId`, `PayloadJson`, `PreviousHash`, `CurrentHash` via SHA-256 chaining, `CreatedAt`) |

### 7.3 The Intact UI HTML-to-TSX Conversion Flow Chain

The **Intact UI Flow Chain** provides a deterministic protocol for transforming HTML5 prototypes, design mockups, and Three.js canvas scenes into production React 19 + TypeScript + Tailwind CSS TSX components with **100% visual fidelity preserved**:

```
[Raw HTML/CSS Mockup] 
      |
      v
1. Token Extraction        --> Map all colors, fonts, and shadows to LayoutStyles/MainLayout.css & FontSyle/fontStyles.css
      |
      v
2. Component Slicing       --> Segment into Pages/, Features/Components/, Shared/ primitives, and LayoutBars/ frames
      |
      v
3. Strict TypeScript (TSX) --> Define explicit props & data interfaces with ZERO 'any' types
      |
      v
4. Fluid Scaling           --> Integrate Hooks/useFluidResposiveness.ts (getFluidClamp / getFluidPx)
      |
      v
5. Universal Lambdas (=>)  --> Express all handlers, sub-renders, and API stubs via clean arrow expressions
      |
      v
6. Zero-Baseline Resilience--> Guarantee graceful N=0 rendering (zeros, empty states, SkeletonLoader)
      |
      v
7. Build & Parity Verify   --> Validate via 'npm run build' with zero visual or interactive regression
```

---

## 8. Full-Stack Technology Stack & Development Runtime

| Tier | Technology | Standard & Port |
|---|---|---|
| **Frontend (Dual-Port)** | TypeScript 5.x + React 19 + Vite + Tailwind CSS | • **Port 5173:** Responders & Civilians Hub (`npm run dev:responder`)<br>• **Port 5174:** LDRRMO Admin Command Portal (`npm run dev:admin`) |
| **Backend** | C# 13 + .NET 10 ASP.NET Core Web API (Kestrel bound to `http://0.0.0.0:5000`) | `http://localhost:5000` / `http://127.0.0.1:5000` (`dotnet run` / `.\start.ps1 -Dev`) |
| **ORM & Database** | Entity Framework Core 10 (Code-First Migrations)<br>• **Primary:** Microsoft SQL Server (SSMS 19) via `Microsoft.EntityFrameworkCore.SqlServer`<br>• **Secondary Supported:** PostgreSQL (`Npgsql`) / MariaDB MySQL (`Pomelo` on XAMPP)<br>• **Zero SQLite Mandate:** Embedded file-based SQLite is strictly prohibited and removed | Relational Schema with Strict FK Constraints (8 Core Entities + Real-Life Philippine Emergency Hierarchy) |
| **Authentication** | Scrypt + `CryptographicOperations.FixedTimeEquals` (`timingSafeEqual`) + Cookie/Bearer Session | Backend-Enforced + Per-Request `status === "verified"` + Dynamic Unified RBAC (Zero Role Tabs) |
| **API Documentation** | Scalar V1 (`/scalar/v1`) + OpenAPI (`/openapi/v1.json`) | Development Environment Only |

---

### 7.4 Dynamic Unified RBAC Login (Zero Unit Selector Tabs)
- **Elimination of Cosmetic Role Tabs:** Stripped legacy `[ RESPONDER ] [ SECURITY ] [ ADMINISTRATOR ]` buttons and "Select authorized unit" header.
- **Aesthetic Fidelity:** Rebuilt with deep maroon radial backdrop (`#340313`), giant stylized silver 'R', and responders team cutout graphic (`/img/responders.png`).
- **Dynamic Programmatic Routing:** Backend Scrypt authentication establishes verified identity and executes dynamic routing:
  - `Civilian` $\rightarrow$ `/civilian/dashboard`
  - `Responder` (RHU, FIRE, PNP) $\rightarrow$ `/responder/dashboard`
  - `LDRRMO_Admin` $\rightarrow$ Automatic cross-port redirect to Port 5174 (`http://127.0.0.1:5174/admin/dashboard`).

### 7.5 Admin User Governance: Full Interactive CRUD Inventory
- **Interactive Console:** In `UserManagementPage.tsx`, LDRRMO Administrators have full lifecycle control supported by 4 dedicated Katipuneros-standard modals:
  1. `AddUserModal.tsx`: 5-step registration wizard for all 5 agency roles.
  2. `ViewUserDetailModal.tsx`: Comprehensive identity dossier with live biometric capture streaming (`/api/users/{id}/captures/{kind}`).
  3. `EditUserModal.tsx`: Profile and credentials editor supporting granular updates without exposing password hashes.
  4. `DeleteUserConfirmModal.tsx`: Safe soft-delete dialog marking `IsDeleted = true`, terminating active sessions, and appending a chained SHA-256 cryptographic audit log.
- **Real-Life Philippine Emergency Entities:** Built-in address hierarchy (Dipolog City & Zamboanga del Norte context) and statutory role credentials (PRC license, BFP rank/apparatus, PNP rank/assignment, civilian vulnerability flags).
- **EF Core Soft-Delete Query Filter:** Standard queries automatically omit soft-deleted records via `entity.HasQueryFilter(u => !u.IsDeleted)`.

### 8.1 Microsoft SQL Server (SSMS 19) & Enterprise RDBMS Configuration

ResQTrack requires enterprise-grade relational ACID transactions and strict foreign key integrity. Embedded file-based SQLite is **strictly prohibited and permanently purged**.

The backend dynamically selects its relational provider at startup via the `"DatabaseProvider"` setting in `Project system ENGINE/Backend/appsettings.json`:

```json
{
  "DatabaseProvider": "SqlServer",
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;",
    "SqlServer_LocalDB": "Server=(localdb)\\mssqllocaldb;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;",
    "SqlServer_SqlAuth": "Server=localhost;Database=ResQTrackDb;User Id=sa;Password=YourPassword123!;TrustServerCertificate=True;MultipleActiveResultSets=true;",
    "PostgreSqlConnection": "Host=localhost;Port=5432;Database=ResQTrackDb;Username=postgres;Password=YourPassword123!;",
    "MySqlConnection": "Server=localhost;Port=3306;Database=ResQTrackDb;User=root;Password=;"
  }
}
```

#### SQL Server Management Studio (SSMS 19) Authentication Presets:
1. **Windows Authentication (Recommended & Default for SSMS 19)**:
   - Connection String: `Server=localhost;Database=ResQTrackDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;`
   - Connects using your active Windows domain/local login credentials without plaintext passwords.
2. **SQL Server Authentication (SA / Service Account)**:
   - Connection String: `Server=localhost;Database=ResQTrackDb;User Id=sa;Password=YourPassword123!;TrustServerCertificate=True;MultipleActiveResultSets=true;`
   - Uses dedicated SQL credentials configured in SSMS 19 Object Explorer under **Security $\rightarrow$ Logins**.
3. **Secondary Supported RDBMS**:
   - **PostgreSQL**: Set `"DatabaseProvider": "PostgreSql"` using `Npgsql.EntityFrameworkCore.PostgreSQL`.
   - **MariaDB / MySQL**: Set `"DatabaseProvider": "MySql"` using `Pomelo.EntityFrameworkCore.MySql` (compatible with XAMPP MySQL on port 3306).

#### Applying Database Migrations & Seeding:
```powershell
# 1. Using CommandStart lifecycle orchestrator:
.\CommandStart\manage.ps1 migrate
.\CommandStart\manage.ps1 seed

# 2. Or using direct .NET EF Core CLI:
dotnet ef database update --project "Project system ENGINE\Backend\Backend.csproj"
```

---

## 9. CommandStart Operations & CLI Execution Engine (`CommandStart/`)

The **`CommandStart/`** directory is the central operational command hub for running, testing, building, and maintaining the Incident AI System Detection workspace.

### Core Execution Files & Scripts:
- **`manage.ps1`**: Unified PowerShell orchestrator supporting:
  - `start` (boots both services), `stop` (terminates processes & frees ports), `restart`, `build` (full solution check), `test` (runs test suites), `migrate` (EF Core update), `seed` (populates LDRRMO & responder units), `status` (process & port monitor), and `health` (queries `/api/health`).
- **`cli.ps1`**: Administrative interactive CLI utility for manual incident simulation, live telemetry injection, biometric verification overrides, and audit log inspection.
- **`start-dev.bat`**: Windows 1-click batch launcher starting the ASP.NET Core API on port `5000` and Vite development server on port `5173`.
- **`stop-all.bat`**: Fast shutdown batch script that kills running dotnet and vite/node listeners, preventing port contention.
- **`setup-db.ps1`**: Automated database migration application and seeder runner targeting SSMS 19 SQL Server / configured enterprise RDBMS.
- **`health-check.ps1`**: Full-stack readiness probe testing database, REST API, and frontend server responsiveness.

---

## 10. Mandatory Multi-Agent Dispatch Rule & Coordinated Engineering Squad Architecture

### The Mandatory Multi-Agent Dispatch Rule
> **Mandatory Multi-Agent Dispatch Rule:**  
> **After deep brainstorming and planning are accurately completed, the agent runtime MUST ALWAYS perform parallel dispatch of a minimum of 5 to 7 (or 8) specialized subagents to execute implementation tasks concurrently like a coordinated engineering squad:**  
> - **Subagent 1: Team Leader / Coordinator & Integration Officer**  
> - **Subagent 2: Backend .NET 10 & API Architecture Specialist**  
> - **Subagent 3: Frontend UI / HTML-to-TSX Intact UI Converter**  
> - **Subagent 4: Database, EF Core & Migrations Specialist**  
> - **Subagent 5: CommandStart Scripts & CLI Operations Engineer**  
> - **Subagent 6: Obsidian Memory Engine & P.A.R.A. Knowledge Graph Maintainer**  
> - **Subagent 7: Quality Assurance, Verification & Automated Test Runner**  
> - **Subagent 8: Security Guardian & Cryptographic Audit Specialist**  

### Squad Specialization & Directory Matrix
- **Subagent 1 (Coordinator):** High-level task routing, integration across slices, issue reconciliation, and caller updates.
- **Subagent 2 (Backend Specialist):** .NET 10 ASP.NET Core controllers, services, repositories, and middleware with 100% universal lambda (`=>`) expressions.
- **Subagent 3 (Frontend / Intact UI Specialist):** React 19 + TypeScript + Tailwind TSX components, `LANDING_PAGE/`, `UserRoles/`, `useFluidResposiveness.ts`, and zero-regression UI conversion.
- **Subagent 4 (Database Specialist):** EF Core 10 `AppDbContext`, 8 core relational entities, migrations, and seed scripts targeting Microsoft SQL Server (SSMS 19 primary) with PostgreSQL / MariaDB support (Zero SQLite Mandate).
- **Subagent 5 (CommandStart & CLI Engineer):** Automation, orchestration scripts, and batch runners in `CommandStart/`.
- **Subagent 6 (Obsidian & P.A.R.A. Maintainer):** P.A.R.A. knowledge organization, atomic Zettelkasten documentation, and Graphify cache synchronization.
- **Subagent 7 (QA & Verification Runner):** Automated builds (`dotnet build`, `npm run build`), unit/integration testing, and $N=0$ empty database verification.
- **Subagent 8 (Security Guardian):** Scrypt KDF + `timingSafeEqual`, SHA-256 audit hash chaining, input sanitization, and session guard enforcement.

---

## 11. Quick Navigation Links

- **Architecture Skill:** [`Md data/SKILL.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/SKILL.md)
- **Agent Behavior Contract:** [`Md data/AGENTS.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/AGENTS.md)
- **Claude ICM Router:** [`Md data/CLAUDE.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/CLAUDE.md)
- **Gemini ICM Router:** [`Md data/GEMINI.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/GEMINI.md)
- **Plans Index:** [`Md data/Plans/README_PLANS_INDEX.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/Plans/README_PLANS_INDEX.md)
- **Active Plans (`10-20-2026/08:46:03 AM`):**
  - [`01_MASTER_SYSTEM_ENGINE_PLAN.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/Plans/10-20-2026/08-46-03%20AM/01_MASTER_SYSTEM_ENGINE_PLAN.md)
  - [`02_ENTITIES_AND_MULTI_ROLE_PORTALS_PLAN.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/Plans/10-20-2026/08-46-03%20AM/02_ENTITIES_AND_MULTI_ROLE_PORTALS_PLAN.md)
  - [`03_KATIPUNEROS_STYLE_ARCHITECTURE_AND_FLOWCHAINS_PLAN.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/Plans/10-20-2026/08-46-03%20AM/03_KATIPUNEROS_STYLE_ARCHITECTURE_AND_FLOWCHAINS_PLAN.md)
  - [`04_PLUGINS_AND_OBSIDIAN_GRAPHIFY_ICM_PLAN.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/Plans/10-20-2026/08-46-03%20AM/04_PLUGINS_AND_OBSIDIAN_GRAPHIFY_ICM_PLAN.md)
  - [`05_HTML_CSS_TO_REACT_TYPESCRIPT_INTACT_UI_CONVERSION_PLAN.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/Plans/10-20-2026/08-46-03%20AM/05_HTML_CSS_TO_REACT_TYPESCRIPT_INTACT_UI_CONVERSION_PLAN.md)
  - [`06_RDBMS_MIGRATION_SQLSERVER_SSMS19_AND_SQLITE_PURGE_PLAN.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/Md%20data/Plans/10-20-2026/08-46-03%20AM/06_RDBMS_MIGRATION_SQLSERVER_SSMS19_AND_SQLITE_PURGE_PLAN.md)
#   R e s Q  
 