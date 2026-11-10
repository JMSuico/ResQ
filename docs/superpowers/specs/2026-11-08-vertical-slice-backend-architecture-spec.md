# Vertical Slice Architecture Specification: Aligning ResQTrack Backend with Katipuneros Library Store Architecture

**Date**: 2026-11-08  
**Reference Project**: `C:\Users\provu\Desktop\KATIPUNEROS LIBRARY STORE\Katipuneros-Library-Store`  
**Target Project**: `C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Project system ENGINE\Backend`  
**Status**: Architecture Design & Gap Analysis Specification  

---

## 1. Executive Overview & Reference Architecture Analysis

The **Katipuneros Library Store** system (`C:\Users\provu\Desktop\KATIPUNEROS LIBRARY STORE\Katipuneros-Library-Store`) represents an enterprise-grade full-stack architecture built on:
- **Frontend**: React + Vite + TypeScript (Feature-based Vertical Slice)
- **Backend**: .NET 10 + ASP.NET Core Web API + C# 13 (Layered Vertical Slice)
- **ORM**: Entity Framework Core 10 (Code-First Migrations, Zero Raw DDL)
- **Database**: SQL Server (SSMS Default) / PostgreSQL / MySQL (Zero SQLite)
- **API Documentation**: Scalar V1 (OpenAPI)
- **Method Syntax**: 100% Universal Lambda Expressions (`=>`) across all Repositories, Services, Controllers, and Helpers.

### 1.1 The Golden Flowchains of Katipuneros

```
[ Frontend: React + Vite + TypeScript ]
  Pages (route-level composition only)
    ↓
  Features (vertical slice UI, local state, workflows)
    ↓
  Hooks / State / Endpoints (reusable logic, API stubs using =>)
    ↓
  Shared Components (presentational primitives only from @/Shared)
    ↓
  Libs / Utilities (helpers, formatters, pure functions)
    ↓
  Assets (raw static assets & 3D scene engines)

==================== HTTP / REST API BOUNDARY ====================

[ Backend: .NET 10 ASP.NET Core Web API + C# 13 ]
  Incoming HTTP Request
    ↓
  ASP.NET Core Middleware Pipeline (GlobalException, SessionVerification, CORS, RateLimit)
    ↓
  API Controllers (Features/Api/Controllers)
    - Validates DTOs
    - Calls Services ONLY (NEVER calls Repositories or DbContext directly)
    - Returns IActionResult via expression bodies (=>)
    ↓
  Service Layer (Features/Services/Interfaces & Implementations)
    - Contains 100% of business logic, validation, workflow orchestration
    - NEVER touches HttpContext
    - Calls Repositories ONLY (NEVER calls DbContext directly)
    - Returns clean tuples or DTOs: (bool Success, string? Error, T? Data)
    ↓
  Repository Layer (Features/Repositories/Interfaces & Implementations)
    - Contains 100% of data access and EF Core queries
    - Injects AppDbContext
    - NEVER contains business rules or workflow logic
    - Uses expression bodies (=>) for all queries and operations
    ↓
  Data Layer (Features/Data/AppDbContext.cs & Models/ & Enums/)
    - AppDbContext, entity models (table shapes only), fixed enumerations
    ↓
  Database (SQL Server / PostgreSQL / MariaDB)
```

### 1.2 Core Do and Never Do Rules

```
DO                                                  NEVER DO
--------------------------------------------------  --------------------------------------------------
Follow the exact flow chain                         Skip layers (e.g. Controller -> Repository)
Place code in the correct vertical layer            Mix responsibilities across layers
Keep every file to ONE responsibility (1 class/file) Create bloated multi-responsibility mega-files
Keep frontend and backend strictly decoupled        Put database logic in UI or UI logic in DB
Controllers call Services ONLY                      Query DbContext or Repositories from Controllers
Services call Repositories ONLY                     Access HttpContext or direct DB in Services
Use dependency injection everywhere via interfaces  Instantiate concrete classes directly
Use Universal Lambda expressions (=>) everywhere    Write bulky boilerplate methods with manual returns
Type everything strictly in TypeScript and C#       Use 'any' or untyped dynamic objects
All backend application code lives under Features/  Leave rogue Controllers/ or Models/ in Backend root
```

---

## 2. Comprehensive Audit of `INCIDENT AI SYSTEM DETECTION` Backend

An exhaustive audit of `C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Project system ENGINE\Backend` revealed the following architectural drift and violations:

### Issue 1: Rogue Root Folders Violating Vertical Slice Placement
- **Violation**: 
  - `Backend/Controllers/IdentityController.cs` was placed directly in the `Backend/` root.
  - `Backend/Models/IdentityDtos.cs` was placed directly in the `Backend/` root.
- **Rule Breached**: "All backend application code must reside strictly within `Features/` (`Features/Api`, `Features/Data`, `Features/DBInfrastructure`, `Features/Helpers`, `Features/Management`, `Features/Repositories`, `Features/Services`). Root `Backend/` must contain only solution files, project files, configuration, and `Program.cs`."
- **Remediation**:
  - Relocate `Backend/Models/IdentityDtos.cs` to `Backend/Features/Api/DTOs/IdentityDtos.cs`.
  - Relocate `Backend/Controllers/IdentityController.cs` to `Backend/Features/Api/Controllers/IdentityController.cs`.
  - Permanently remove root `Backend/Controllers/` and `Backend/Models/`.

### Issue 2: Monolithic Controller with Embedded Business Logic (`IdentityController.cs`)
- **Violation**: `IdentityController.cs` contains 665 lines of code, implementing direct `HttpClient` calls, multi-provider fallback chaining (Google Gemini, OpenAI GPT-4o, Azure Document Intelligence), prompt generation, JSON serialization, and Base64 parsing *directly inside private controller methods*.
- **Rule Breached**: "Controllers must ONLY parse requests, call services, and return `IActionResult`. NEVER put business logic, external API integrations, or workflow orchestration in controllers."
- **Remediation**:
  - Create `IIdentityAiService` in `Backend/Features/Services/Interfaces/IIdentityAiService.cs`.
  - Create `IdentityAiService` in `Backend/Features/Services/Implementations/IdentityAiService.cs`.
  - Move all AI vision logic, prompt templates, fallback chains, and HTTP calls to `IdentityAiService`.
  - Refactor `IdentityController.cs` into a clean REST controller (under 50 lines) that delegates 100% of execution to `IIdentityAiService` via `=>` lambdas.

### Issue 3: Controllers Bypassing Service Layer & Injecting Repositories Directly
- **Violations**:
  1. `AlertsController.cs`: Directly injects `IAlertRepository`, `IReportRepository`, `IAuditLogRepository`, and `IUserRepository`. It coordinates report alerts, broadcast storage, and mark-read state directly in controller actions.
  2. `ReportsController.cs`: Directly injects `IUserRepository` to resolve default/fallback reporter user accounts.
  3. `SettingsController.cs`: Directly injects `IAuditLogRepository` to query recent audit trails.
- **Rule Breached**: "Controllers call Services. Services call Repositories. Controllers must NEVER bypass the Service layer to talk directly to Repositories."
- **Remediation**:
  - Create `IAlertService` in `Features/Services/Interfaces/IAlertService.cs` and `AlertService` in `Features/Services/Implementations/AlertService.cs`. Refactor `AlertsController` to inject `IAlertService` only.
  - Move fallback reporter resolution into `IReportService` / `ReportService`. Refactor `ReportsController` to inject `IReportService` and `IWebHostEnvironment` only.
  - Add `GetRecentAuditLogsAsync` to `ISettingsService` and `SettingsService`. Refactor `SettingsController` to inject `ISettingsService` only.

### Issue 4: Monolithic Mega-Files Violating Single-Responsibility Rule
- **Violation**:
  - `Features/Services/Implementations/Services.cs` (1315 lines) bundles 7 distinct services into one mega-file.
  - `Features/Repositories/Implementations/Repositories.cs` (330 lines) bundles 8 distinct repositories into one file.
- **Rule Breached**: "Keep every file to ONE responsibility. One class/interface per file with clear ownership."
- **Remediation**:
  - Split `Services.cs` and `IServices.cs` into clean, individual files for each service domain.
  - Split `Repositories.cs` and `IRepositories.cs` into clean, individual files for each repository domain.

---

## 3. Target Architecture & Project Structure

The target structure for `C:\Users\provu\Desktop\INCIDENT AI SYSTEM DETECTION\Project system ENGINE\Backend`:

```
Backend/                                             # Root .NET 10 ASP.NET Core Solution
|-- Program.cs                                       # Entry point: DI, middleware pipeline, EF Core setup
|-- appsettings.json                                 # App configuration (DB, Redis, Secrets)
|-- appsettings.Development.json                     # Development configuration
|-- Backend.csproj                                   # Project references
|-- Dockerfile / .dockerignore                       # Container orchestration
|
`-- Features/                                        # Domain Vertical Slices
    |
    |-- Data/                                        # MODEL-FIRST FOUNDATION
    |   |-- AppDbContext.cs                          # EF Core DbContext (DbSets using =>)
    |   |-- Models/                                  # Pure Entity Models (table shapes only)
    |   |   |-- User.cs
    |   |   |-- Session.cs
    |   |   |-- Report.cs
    |   |   `-- SupportingEntities.cs                # DutyUnit, IncidentFixture, AlertReadState, Settings, AuditLog
    |   `-- Enums/                                   # Domain Enumerations
    |       `-- ResQTrackEnums.cs                    # UserRole, ResponderUnitType, IncidentCategory, IncidentSeverity...
    |
    |-- Repositories/                                # DATA ACCESS LAYER (EF Core queries only, all =>)
    |   |-- Interfaces/                              # Individual Repository Contracts
    |   |   |-- IUserRepository.cs
    |   |   |-- ISessionRepository.cs
    |   |   |-- IReportRepository.cs
    |   |   |-- IDutyUnitRepository.cs
    |   |   |-- IIncidentFixtureRepository.cs
    |   |   |-- IAlertRepository.cs
    |   |   |-- ISettingsRepository.cs
    |   |   `-- IAuditLogRepository.cs
    |   `-- Implementations/                         # Concrete Repositories using Expression Bodies (=>)
    |       |-- UserRepository.cs
    |       |-- SessionRepository.cs
    |       |-- ReportRepository.cs
    |       |-- DutyUnitRepository.cs
    |       |-- IncidentFixtureRepository.cs
    |       |-- AlertRepository.cs
    |       |-- SettingsRepository.cs
    |       `-- AuditLogRepository.cs
    |
    |-- Services/                                    # BUSINESS LOGIC LAYER (No HttpContext, No direct DbContext)
    |   |-- Interfaces/                              # Individual Service Contracts
    |   |   |-- IAuthService.cs
    |   |   |-- IReportService.cs
    |   |   |-- ITriageService.cs
    |   |   |-- IResponderOpsService.cs
    |   |   |-- IUserGovernanceService.cs
    |   |   |-- ISettingsService.cs
    |   |   |-- IAnalyticsService.cs
    |   |   |-- IAlertService.cs                     # NEW: Encapsulates all alert & broadcast workflows
    |   |   `-- IIdentityAiService.cs                # NEW: Encapsulates all AI standby & vision extraction
    |   `-- Implementations/                         # Concrete Services using Expression Bodies (=>)
    |       |-- AuthService.cs
    |       |-- ReportService.cs
    |       |-- TriageService.cs
    |       |-- RespondersService.cs
    |       |-- UserGovernanceService.cs
    |       |-- SettingsService.cs
    |       |-- AnalyticsService.cs
    |       |-- AlertService.cs                      # NEW: Injects IAlertRepo, IReportRepo, IAuditRepo, IUserRepo
    |       `-- IdentityAiService.cs                 # NEW: Injects IHttpClientFactory, IConfiguration, ILogger
    |
    |-- Helpers/                                     # REUSABLE INFRASTRUCTURE & SECURITY UTILITIES
    |   `-- Infrastructure/
    |       |-- ScryptPasswordHelper.cs              # Scrypt + FixedTimeEquals (timingSafeEqual)
    |       |-- SessionCookieHelper.cs               # Secure HTTP-only session cookie handling
    |       |-- CaptureStorageHelper.cs              # Safe PNG storage & magic byte validation
    |       |-- InputSanitizer.cs                    # Strips XSS & dangerous tags
    |       |-- AuditHasher.cs                       # SHA-256 tamper-evident hash chaining
    |       |-- SecurityStampValidator.cs            # Session security stamp verification
    |       `-- GeoDistanceHelper.cs                 # Haversine geospatial calculation
    |
    |-- DBInfrastructure/                            # EXTERNAL INFRASTRUCTURE
    |   |-- AppDbContextReadOnly.cs                  # Read-only replica support
    |   `-- DatabaseSeeder.cs                        # Initial seed data for admin, responders, fixtures
    |
    |-- Management/                                  # CLI MANAGEMENT COMMANDS
    |   `-- Commands/
    |       `-- CliCommandRunner.cs                  # CLI admin creation, reset, seeding
    |
    `-- Api/                                         # REST API LAYER (Controllers call Services ONLY)
        |-- Controllers/
        |   |-- AlertsController.cs                  # Injects IAlertService ONLY (=>)
        |   |-- AnalyticsController.cs               # Injects IAnalyticsService ONLY (=>)
        |   |-- AuthController.cs                    # Injects IAuthService & IWebHostEnvironment (=>)
        |   |-- IncidentsController.cs               # Injects ITriageService & IReportService (=>)
        |   |-- ReportsController.cs                 # Injects IReportService & IWebHostEnvironment (=>)
        |   |-- RespondersController.cs              # Injects IResponderOpsService ONLY (=>)
        |   |-- SettingsController.cs                # Injects ISettingsService ONLY (=>)
        |   |-- UsersController.cs                   # Injects IUserGovernanceService ONLY (=>)
        |   `-- IdentityController.cs                # Injects IIdentityAiService ONLY (=>)
        |
        |-- DTOs/                                    # Request & Response Contracts
        |   |-- Requests.cs                          # Authentication, report, and admin request DTOs
        |   |-- Responses.cs                         # Standardized responses & envelopes
        |   |-- UserDtos.cs                          # User governance DTOs
        |   |-- AnalyticsDtos.cs                     # Telemetry & volume DTOs
        |   |-- ResponderOpsDtos.cs                  # Duty roster, PCR, blotter DTOs
        |   `-- IdentityDtos.cs                      # MOVED HERE: AI extraction request/response contracts
        |
        `-- Middleware/                              # Pipeline Guards
            |-- GlobalExceptionMiddleware.cs         # Catch-all exception handler with clean JSON envelope
            `-- SessionVerificationMiddleware.cs     # Per-request database security check
```

---

## 4. Detailed Component Design & Contracts

### 4.1 `IAlertService` & `AlertService`
```csharp
namespace Backend.Features.Services.Interfaces;

public interface IAlertService
{
    Task<List<AlertResponse>> GetAlertsForUserAsync(Guid userId, CancellationToken ct = default);
    Task<(bool Success, string? Error, AlertBroadcastResponse? Broadcast)> CreateBroadcastAsync(Guid adminId, CreateAlertBroadcastRequest request, CancellationToken ct = default);
    Task<(bool Success, string? Error)> MarkAlertReadAsync(Guid userId, string reportId, CancellationToken ct = default);
}
```

Implementation in `AlertService.cs` coordinates:
1. Fetching all active reports (`IReportRepository`) and user read statuses (`IAlertRepository`).
2. Mapping to `AlertResponse` DTOs.
3. Broadcasting new alerts, creating the `Report` and immutable SHA-256 `AuditLog` entry.
4. Marking read status via `IAlertRepository.MarkAsReadAsync`.

### 4.2 `IIdentityAiService` & `IdentityAiService`
```csharp
namespace Backend.Features.Services.Interfaces;

public interface IIdentityAiService
{
    AiProviderStatusDto GetAiStatus();
    Task<AiExtractResponseDto> ExtractIdentityAsync(AiExtractRequestDto request, CancellationToken ct = default);
}
```

Implementation in `IdentityAiService.cs`:
- Handles secret key resolution (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `AZURE_VISION_KEY`).
- Validates Base64 data URLs.
- Executes provider order: `PreferredProvider` -> `gemini` -> `azure` -> `openai`.
- Formulates strict JSON prompts.
- Parses and normalizes extracted fields (`FullName`, `IdNumber`, `DateOfBirth`, `Address`, `Sex`).
- Returns structured `AiExtractResponseDto` with execution timing.

### 4.3 Refactored `IdentityController.cs`
```csharp
namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/identity")]
public class IdentityController(IIdentityAiService identityService) : ControllerBase
{
    [HttpGet("ai-status")]
    public IActionResult GetAiStatus() =>
        Ok(identityService.GetAiStatus());

    [HttpPost("ai-extract")]
    public async Task<IActionResult> AiExtractAsync([FromBody] AiExtractRequestDto request, CancellationToken ct) =>
        Ok(await identityService.ExtractIdentityAsync(request, ct));
}
```

### 4.4 Refactored `AlertsController.cs`
```csharp
namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/alerts")]
public class AlertsController(IAlertService alertService) : ControllerBase
{
    private Guid CurrentUserId =>
        HttpContext.Items["UserId"] is Guid uid ? uid : Guid.Empty;

    [HttpGet]
    public async Task<IActionResult> GetAlertsAsync(CancellationToken ct) =>
        Ok(await alertService.GetAlertsForUserAsync(CurrentUserId, ct));

    [HttpPost("broadcast")]
    public async Task<IActionResult> CreateBroadcastAsync([FromBody] CreateAlertBroadcastRequest request, CancellationToken ct) =>
        await alertService.CreateBroadcastAsync(CurrentUserId, request, ct) is var (success, error, broadcast) && success
            ? StatusCode(StatusCodes.Status201Created, broadcast)
            : BadRequest(new { message = error });

    [HttpPost("{reportId}/read")]
    public async Task<IActionResult> MarkReadAsync(string reportId, CancellationToken ct) =>
        await alertService.MarkAlertReadAsync(CurrentUserId, reportId, ct) is var (success, error) && success
            ? Ok(new { message = "Alert marked as read." })
            : BadRequest(new { message = error });
}
```

---

## 5. Verification & Validation Plan

1. **Compilation Check**:
   - `dotnet build` in `Backend/` must succeed with 0 warnings and 0 errors.
2. **Architecture Compliance Check**:
   - Confirm root `Backend/Controllers/` and `Backend/Models/` no longer exist.
   - Confirm all controllers inject Services ONLY (no `_context`, no `*Repository`).
   - Confirm all Services inject Repositories ONLY (no direct `AppDbContext`).
   - Confirm all methods use Universal Lambda Expressions (`=>`).
3. **End-to-End API Verification**:
   - Verify `GET /api/identity/ai-status` and `POST /api/identity/ai-extract`.
   - Verify `GET /api/alerts`, `POST /api/alerts/broadcast`, and `POST /api/alerts/{id}/read`.
   - Verify `GET /api/reports` and `POST /api/reports`.
   - Verify `GET /api/settings` and `GET /api/settings/audit`.
4. **Scalar V1 OpenAPI Verification**:
   - Verify all endpoints are visible and documented on `http://localhost:5000/scalar/v1`.
