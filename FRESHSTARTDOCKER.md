# ResQTrack Incident AI Detection Engine - Fresh Start Docker Guide (`FRESHSTARTDOCKER.md`)

Complete command reference for running the **4-Port Docker Ecosystem** (`:1996` Admin, `:1997` Responders, `:1998` Civilian, `:1999` Backend API, PostgreSQL Primary `:5432`, PostgreSQL Replica `:5433`, Redis `:6379`) and executing all CLI account, migration, and AI vision workflows inside Docker.

---

## 1. Fresh Clone Setup on 2nd / 3rd PC & Clean Docker Launch

`docker-compose.yml` mounts the tracked `Project system ENGINE/Backend/LocalConfig` directory instead of a single gitignored `appsettings.Local.json` file, and mounts `Project system ENGINE/Frontend/public` plus isolated per-portal `node_modules` volumes with `CHOKIDAR_USEPOLLING=true` / `WATCHPACK_POLLING=true` across all 3 Vite portals (`:1996`, `:1997`, `:1998`). A freshly cloned repository starts cleanly with zero manual directory hacks.

```powershell
# 1. Clone from GitHub and enter the repository root
git clone <YOUR_GITHUB_REPO_URL> "INCIDENT AI SYSTEM DETECTION"
cd "INCIDENT AI SYSTEM DETECTION"

# 2. (Only if upgrading an older Windows/OneDrive clone) Remove stray directories left by older mounts or Python cache
Remove-Item -Path "Project system ENGINE/Frontend/postcss.config.js", "Project system ENGINE/Frontend/tailwind.config.js", "Project system ENGINE/Backend/appsettings.Local.json", "Project system ENGINE/Backend/Scripts" -Recurse -Force -ErrorAction SilentlyContinue

# 3. Stop any local non-Docker dev servers occupying ports 1996-1999
.\start.ps1 stop

# 4. Configure environment variables (.env is gitignored; safe defaults apply if omitted)
Copy-Item .env.example .env -ErrorAction SilentlyContinue
# Edit .env and set:
#   ANTHROPIC_API_KEY=sk-ant-...
#   ROBOFLOW_API_KEY=rf_...
# (Optional) Copy LocalConfig template if you prefer JSON overrides:
# Copy-Item "Project system ENGINE/Backend/LocalConfig/appsettings.Local.example.json" "Project system ENGINE/Backend/LocalConfig/appsettings.Local.json"

# 5. Build and start all Docker Compose services
docker compose up -d --build

# Or perform a completely clean uncached rebuild (use -v too if package.json changed):
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Verify Containers & Live Endpoints
```powershell
docker compose ps
Invoke-RestMethod http://127.0.0.1:1999/api/health
Invoke-RestMethod http://127.0.0.1:1999/api/standby-ai/status
```

| Service / Port | URL | Role Scope |
|---|---|---|
| Admin Command Portal | `http://localhost:1996/admin/login` | `LDRRMO_Admin` only |
| Emergency Responders Portal | `http://localhost:1997/login` | `RHU` (Medic), `FIRE` (BFP), `PNP` |
| Civilian Portal & Registration | `http://localhost:1998` | Civilians / Public Residents |
| Backend Web API & Scalar Docs | `http://localhost:1999/scalar/v1` | .NET 10 API + Postgres + Redis |

> Note on Docker CLI syntax:
> - When `resqtrack-api-backend` is **running**, use `docker compose exec resqtrack-backend dotnet Backend.dll <command> ...`
> - When containers are **stopped**, use `docker compose run --rm resqtrack-backend <command> ...` (or include `dotnet Backend.dll` -- `CliCommandRunner.NormalizeArgs` supports both).

---

## 2. Inspect Users (`listcliusers`)

```powershell
# List all accounts stored in PostgreSQL ResQTrackDb
docker compose exec resqtrack-backend dotnet Backend.dll listcliusers

# When stack is stopped:
docker compose run --rm resqtrack-backend listcliusers
```



---

## 3. Create Superadmin (`createsuperadmin` - Merged Default & Custom, No Statics, CLI-Protected in Frontend/UI)

> Password minimum length enforced by `ScryptPasswordHelper`: **12 characters**.
> `createsuperadmin` merges both Default Superadmin (Option 1: Email and Password - No Statics) and Custom Superadmin (Option 2: Email, Password, and Confirm Password).
> **CLI-Protected Superadmin Immutability Rule**: Every Superadmin (`Role == LDRRMO_Admin`) created via `createsuperadmin` is stamped with `IdentityVerificationProvider = "CliSuperAdminProvisioned"` (`IsCliProtectedSuperAdmin = true`).
> - In the **Frontend/UI (`:1996/admin/users` & `:1996/admin/settings`)**, CLI-created Superadmins display a **`CLI Protected`** badge and **CANNOT be edited, suspended, restricted, or deleted** from the web UI or via HTTP (`PUT /api/users/{id}`, `DELETE /api/users/{id}`, `POST /api/users/{id}/status`, `PUT /api/profile`).
> - CLI-created Superadmins can **ONLY** be edited or deleted via the Docker CLI (`useredit` and `userdelete`).
> - By contrast, Admin accounts created inside the web UI (`+ Add User` -> `AdminProvisioned`), as well as Responders and Civilians, remain manageable from both the web UI and the Docker CLI.

### Command (`createsuperadmin`)
```powershell
docker compose exec -it resqtrack-backend dotnet Backend.dll createsuperadmin
```

**Interactive Display Flow (Option 1 - Default Superadmin, No Statics):**
```text
============================================================
 CREATE SUPERADMIN
============================================================
CHOOSE TO CREATE:
  [1] CREATE DEFAULT SUPERADMIN (EMAIL AND PASSWORD - NO STATICS)
  [2] CREATE CUSTOM SUPERADMIN (EMAIL, PASSWORD AND CONFIRM PASSWORD)
TYPE 1 OR 2: 1
INPUT EMAIL: ldrrmo.admin2@resqtrack.gov.ph
INPUT PASSWORD: AdminCommand@2026!
[CLI] Super Admin user 'ldrrmo.admin2@resqtrack.gov.ph' created successfully.
```

**Interactive Display Flow (Option 2 - Custom Superadmin):**
```text
============================================================
 CREATE SUPERADMIN
============================================================
CHOOSE TO CREATE:
  [1] CREATE DEFAULT SUPERADMIN (EMAIL AND PASSWORD - NO STATICS)
  [2] CREATE CUSTOM SUPERADMIN (EMAIL, PASSWORD AND CONFIRM PASSWORD)
TYPE 1 OR 2: 2
INPUT EMAIL: ldrrmo.custom@resqtrack.gov.ph
INPUT PASSWORD: AdminCommand@2026!
INPUT CONFIRM PASSWORD: AdminCommand@2026!
[CLI] Super Admin user 'ldrrmo.custom@resqtrack.gov.ph' created successfully.
```

**Non-Interactive One-Line Equivalents:**
```powershell
# Option 1: Default Superadmin (EMAIL AND PASSWORD - NO STATICS)
docker compose exec resqtrack-backend dotnet Backend.dll createsuperadmin 1 "ldrrmo.admin2@resqtrack.gov.ph" "AdminCommand@2026!"

# Option 2: Custom Superadmin (EMAIL, PASSWORD AND CONFIRM PASSWORD)
docker compose exec resqtrack-backend dotnet Backend.dll createsuperadmin 2 "ldrrmo.custom@resqtrack.gov.ph" "AdminCommand@2026!" "AdminCommand@2026!"
```

**LDRRMO Admin Functions (`http://localhost:1996`)**:
- Command Dashboard (`GET /api/analytics/overview`, live pulsing GIS radar map, Claude nearby unit ranking)
- Dispatch Manager & Responder Deployment (`POST /api/incidents`, `POST /api/reports/{id}/verify`, `POST /api/reports/{id}/allocate`)
- Submitted Reports & AI Auto-Approve (`POST /api/reports/{id}/ai-auto-approve`)
- Broadcast Alerts (`POST /api/alerts/broadcast`) & Full User Governance (`GET/POST/PUT/DELETE /api/users`)

---

## 4. Create Responders (`createresponders` - Custom Create Responders Only)

> **CHOOSE OPTION RESPONDERS**: `1. RHU/MEDICS`, `2. BFP/FIRE`, `3. PNP/POLICE`
> **Inputs required**: **INPUT EMAIL**, **INPUT PASSWORD**, and **INPUT CONFIRM PASSWORD**.

### Command (`createresponders`)
```powershell
docker compose exec -it resqtrack-backend dotnet Backend.dll createresponders
```

**Interactive Display Flow:**
```text
============================================================
 CUSTOM CREATE RESPONDERS
============================================================
CHOOSE OPTION RESPONDERS:
  1. RHU/MEDICS
  2. BFP/FIRE
  3. PNP/POLICE
CHOOSE OPTION RESPONDERS (1-3): 1
INPUT EMAIL: medic.unit2@resqtrack.gov.ph
INPUT PASSWORD: MedicPass@2026!!
INPUT CONFIRM PASSWORD: MedicPass@2026!!
[CLI] Responder (RHU) user 'medic.unit2@resqtrack.gov.ph' created successfully.
```

**Non-Interactive One-Line Equivalents (`<option 1-3> <email> <password> <confirmPassword>`):**
```powershell
# 1 = RHU/MEDICS
docker compose exec resqtrack-backend dotnet Backend.dll createresponders 1 "medic.unit2@resqtrack.gov.ph" "MedicPass@2026!!" "MedicPass@2026!!"

# 2 = BFP/FIRE
docker compose exec resqtrack-backend dotnet Backend.dll createresponders 2 "fire.unit2@resqtrack.gov.ph" "BfpFirePass@2026!" "BfpFirePass@2026!"

# 3 = PNP/POLICE
docker compose exec resqtrack-backend dotnet Backend.dll createresponders 3 "pnp.unit2@resqtrack.gov.ph" "PnpPatrol@2026!" "PnpPatrol@2026!"
```

**Responder Unit Functions (`http://localhost:1997`)**:
- **1. RHU/MEDICS**: Scoped medical/vehicular incident feed, Patient Care Record (PCR) logging (`POST/GET /api/responder-ops/pcr`), GPS ping & duty readiness (`PUT /api/responder-ops/duty-status`), backup deploy requests (`/responder/request-deploy`).
- **2. BFP/FIRE**: Scoped structural fire/hazmat feed, Hydrant map lookup (`GET /api/responder-ops/hydrants`), apparatus readiness (`On Duty`, `En Route`, `On Scene`, `Returning`), backup dispatch coordination.
- **3. PNP/POLICE**: Scoped crime/security/traffic feed, Police Blotter filing (`POST/GET /api/responder-ops/blotter`), incident status & GPS readiness updates, backup dispatch requests.

---

## 5. Create Civilians (`createcivilians` - Custom Create Civilians Only)

> **Inputs required**: **INPUT EMAIL**, **INPUT PASSWORD**, and **INPUT CONFIRM PASSWORD**.

### Command (`createcivilians`)
```powershell
docker compose exec -it resqtrack-backend dotnet Backend.dll createcivilians
```

**Interactive Display Flow:**
```text
============================================================
 CUSTOM CREATE CIVILIANS
============================================================
INPUT EMAIL: citizen.ana@resqtrack.gov.ph
INPUT PASSWORD: CivilianPass@2026!
INPUT CONFIRM PASSWORD: CivilianPass@2026!
[CLI] Civilian user 'citizen.ana@resqtrack.gov.ph' created successfully.
```

**Non-Interactive One-Line Equivalent (`<email> <password> <confirmPassword>`):**
```powershell
docker compose exec resqtrack-backend dotnet Backend.dll createcivilians "citizen.ana@resqtrack.gov.ph" "CivilianPass@2026!" "CivilianPass@2026!"
```

**Civilian Functions (`http://localhost:1998`)**:
- Live Camera / Photo Incident SOS Reporting (`POST /api/reports/analyze-image`, `POST /api/reports` with Roboflow + Claude Haiku 4.5 AI verification & auto-approve eligibility)
- Live 1-BPM Distress GPS Beacon Telemetry (`POST /api/reports/{id}/beacon`)
- Live Sector & Evacuation Safe Zones Map (`/civilian/live-map`), Personal Report History & Response Feedback (`/civilian/my-reports`), Profile & Medical/Contact Updates (`GET/PUT /api/profile`)

---

## 6. Merged User Edit Command (`useredit` - Admin, Responders & Civilians)

> Single unified command to search, select, and edit any **Admin User**, **Responder** (`RHU/MEDICS`, `BFP/FIRE`, `PNP/POLICE`), or **Civilian** account with live search bar filtering, `FIRSTNAME`, `LASTNAME`, `EMAIL` editing, and optional direct password change (`Yes/No` -> `NEW PASSWORD` & `CONFIRM PASSWORD`).

### Command (`useredit`)
```powershell
docker compose exec -it resqtrack-backend dotnet Backend.dll useredit
```

### Flow 1: Edit `1. Admin User`
```text
============================================================
 USER EDIT (MERGED ADMIN, RESPONDERS & CIVILIANS)
============================================================
CHOOSE USER TYPE TO EDIT:
  1. Admin User
  2. Responders
  3. Civilians
CHOOSE OPTION (1-3): 1

------------------------------------------------------------
 ADMIN USER LIST
------------------------------------------------------------
  [1] Firstname: LDRRMO | Lastname: Command | Email: ldrrmo.admin@resqtrack.gov.ph
  [2] Firstname: Super  | Lastname: Admin   | Email: ldrrmo.admin2@resqtrack.gov.ph
------------------------------------------------------------
SEARCH BAR (Type number 1-2 to select, or type keyword to filter): 2
SELECTED USER: [2] Super Admin <ldrrmo.admin2@resqtrack.gov.ph>

INPUT FIRSTNAME (Current: Super, press Enter to keep): Chief
INPUT LASTNAME (Current: Admin, press Enter to keep): Director
INPUT EMAIL (Current: ldrrmo.admin2@resqtrack.gov.ph, press Enter to keep): ldrrmo.director@resqtrack.gov.ph
Do you want to direct change password on this account? (Yes/No): Yes
NEW PASSWORD: NewAdminDirector@2026!
CONFIRM PASSWORD: NewAdminDirector@2026!
PRESS ENTER TO SAVE...
[CLI] SUCCESSFUL: Admin user 'ldrrmo.director@resqtrack.gov.ph' updated and saved.
```

### Flow 2: Edit `2. Responders` (`1. RHU/MEDICS`, `2. BFP/FIRE`, `3. PNP/POLICE`)
```text
============================================================
 USER EDIT (MERGED ADMIN, RESPONDERS & CIVILIANS)
============================================================
CHOOSE USER TYPE TO EDIT:
  1. Admin User
  2. Responders
  3. Civilians
CHOOSE OPTION (1-3): 2

CHOOSE OPTION RESPONDERS:
  1. RHU/MEDICS
  2. BFP/FIRE
  3. PNP/POLICE
CHOOSE OPTION RESPONDERS (1-3): 1

------------------------------------------------------------
 RESPONDERS LIST (RHU/MEDICS)
------------------------------------------------------------
  [1] Firstname: RHU   | Lastname: Medic   | Email: rhu.medic@resqtrack.gov.ph
  [2] Firstname: Medic | Lastname: Unit2   | Email: medic.unit2@resqtrack.gov.ph
------------------------------------------------------------
SEARCH BAR (Type number 1-2 to select, or type keyword to filter): 2
SELECTED USER: [2] Medic Unit2 <medic.unit2@resqtrack.gov.ph>

INPUT FIRSTNAME (Current: Medic, press Enter to keep): Alpha
INPUT LASTNAME (Current: Unit2, press Enter to keep): Medic
INPUT EMAIL (Current: medic.unit2@resqtrack.gov.ph, press Enter to keep): medic.alpha@resqtrack.gov.ph
Do you want to direct change password on this account? (Yes/No): No
PRESS ENTER TO SAVE...
[CLI] SUCCESSFUL: Responder (RHU) user 'medic.alpha@resqtrack.gov.ph' updated and saved.
```

### Flow 3: Edit `3. Civilians`
```text
============================================================
 USER EDIT (MERGED ADMIN, RESPONDERS & CIVILIANS)
============================================================
CHOOSE USER TYPE TO EDIT:
  1. Admin User
  2. Responders
  3. Civilians
CHOOSE OPTION (1-3): 3

------------------------------------------------------------
 CIVILIANS LIST
------------------------------------------------------------
  [1] Firstname: Elena   | Lastname: Santos   | Email: citizen.elena@resqtrack.gov.ph
  [2] Firstname: Ana     | Lastname: Citizen  | Email: citizen.ana@resqtrack.gov.ph
------------------------------------------------------------
SEARCH BAR (Type number 1-2 to select, or type keyword to filter): 2
SELECTED USER: [2] Ana Citizen <citizen.ana@resqtrack.gov.ph>

INPUT FIRSTNAME (Current: Ana, press Enter to keep): Ana Marie
INPUT LASTNAME (Current: Citizen, press Enter to keep): Reyes
INPUT EMAIL (Current: citizen.ana@resqtrack.gov.ph, press Enter to keep): citizen.anamarie@resqtrack.gov.ph
Do you want to direct change password on this account? (Yes/No): Yes
NEW PASSWORD: UpdatedCivPass@2026!
CONFIRM PASSWORD: UpdatedCivPass@2026!
PRESS ENTER TO SAVE...
[CLI] SUCCESSFUL: Civilian user 'citizen.anamarie@resqtrack.gov.ph' updated and saved.
```

---

## 7. Merged User Delete Command (`userdelete` - Single Selection or Delete ALL with Admin Password Verification)

> Single unified command to delete a specific user (`1..N` or search keyword) OR type `ALL` to delete all accounts in the selected category after confirming `DO YOU WANT TO DELETE ALL? (YES/NO):` and verifying `INPUT ADMIN PASSWORD:`.

### Command (`userdelete`)
```powershell
docker compose exec -it resqtrack-backend dotnet Backend.dll userdelete
```

### Flow 1: Delete `1. Admin User` (Single or `ALL`)
```text
============================================================
 USER DELETE (MERGED ADMIN, RESPONDERS & CIVILIANS)
============================================================
CHOOSE USER TYPE TO DELETE:
  1. Admin User
  2. Responders
  3. Civilians
CHOOSE OPTION (1-3): 1

------------------------------------------------------------
 ADMIN USER LIST
------------------------------------------------------------
  [1] Firstname: LDRRMO | Lastname: Command  | Email: ldrrmo.admin@resqtrack.gov.ph
  [2] Firstname: Chief  | Lastname: Director | Email: ldrrmo.director@resqtrack.gov.ph
------------------------------------------------------------
SEARCH BAR (Type number 1..N, search keyword, or ALL to delete all listed): ALL
DO YOU WANT TO DELETE ALL? (YES/NO): YES
INPUT ADMIN PASSWORD: AdminCommand@2026!
[CLI] SUCCESSFUL: Deleted all (2) users in selected category.
```

### Flow 2: Delete `2. Responders` (`1. RHU/MEDICS`, `2. BFP/FIRE`, `3. PNP/POLICE` - Single or `ALL`)
```text
============================================================
 USER DELETE (MERGED ADMIN, RESPONDERS & CIVILIANS)
============================================================
CHOOSE USER TYPE TO DELETE:
  1. Admin User
  2. Responders
  3. Civilians
CHOOSE OPTION (1-3): 2

CHOOSE OPTION RESPONDERS:
  1. RHU/MEDICS
  2. BFP/FIRE
  3. PNP/POLICE
CHOOSE OPTION RESPONDERS (1-3): 1

------------------------------------------------------------
 RESPONDERS LIST (RHU/MEDICS)
------------------------------------------------------------
  [1] Firstname: RHU   | Lastname: Medic | Email: rhu.medic@resqtrack.gov.ph
  [2] Firstname: Alpha | Lastname: Medic | Email: medic.alpha@resqtrack.gov.ph
------------------------------------------------------------
SEARCH BAR (Type number 1..N, search keyword, or ALL to delete all listed): ALL
DO YOU WANT TO DELETE ALL? (YES/NO): YES
INPUT ADMIN PASSWORD: AdminCommand@2026!
[CLI] SUCCESSFUL: Deleted all (2) users in selected category.
```

### Flow 3: Delete `3. Civilians` (Single or `ALL`)
```text
============================================================
 USER DELETE (MERGED ADMIN, RESPONDERS & CIVILIANS)
============================================================
CHOOSE USER TYPE TO DELETE:
  1. Admin User
  2. Responders
  3. Civilians
CHOOSE OPTION (1-3): 3

------------------------------------------------------------
 CIVILIANS LIST
------------------------------------------------------------
  [1] Firstname: Elena     | Lastname: Santos | Email: citizen.elena@resqtrack.gov.ph
  [2] Firstname: Ana Marie | Lastname: Reyes  | Email: citizen.anamarie@resqtrack.gov.ph
------------------------------------------------------------
SEARCH BAR (Type number 1..N, search keyword, or ALL to delete all listed): ALL
DO YOU WANT TO DELETE ALL? (YES/NO): YES
INPUT ADMIN PASSWORD: AdminCommand@2026!
[CLI] SUCCESSFUL: Deleted all (2) users in selected category.
```

**Single User Delete Example (Selecting `1..N` instead of `ALL`):**
```text
SEARCH BAR (Type number 1..N, search keyword, or ALL to delete all listed): 2
SELECTED USER: [2] Ana Marie Reyes <citizen.anamarie@resqtrack.gov.ph>
DO YOU WANT TO DELETE THIS USER? (YES/NO): YES
[CLI] SUCCESSFUL: Deleted user 'citizen.anamarie@resqtrack.gov.ph'.
```

---

## 8. Database Migrations (`updatedatabase` & `addmigration`)

### Apply Migrations / Reconcile Schema Inside Docker PostgreSQL
```powershell
# Apply EF Core migrations + StartupSchemaReconciler inside running container
docker compose exec resqtrack-backend dotnet Backend.dll updatedatabase

# Or run one-shot when backend container is stopped (with Postgres container up):
docker compose up -d resqtrack-db-primary
docker compose run --rm resqtrack-backend updatedatabase
```

### Inspect PostgreSQL Tables Directly in Docker
```powershell
docker exec resqtrack-postgres-primary psql -U postgres -d ResQTrackDb -c "\dt"
docker exec resqtrack-postgres-primary psql -U postgres -d ResQTrackDb -c "SELECT ""Email"", ""Role"", ""Unit"", ""Status"" FROM ""Users"";"
```

### Create a New EF Core Migration (`addmigration`)
> `addmigration` requires the .NET SDK and source `Backend.csproj` (the runtime Docker image runs published `Backend.dll` only). Create the migration on the host or via a .NET 10 SDK container, then rebuild Docker:

```powershell
# Option A: Using unified manager / dotnet ef on host (keep migrations provider-agnostic!)
.\start.ps1 addmigration AddNewIncidentColumn

# Option B: Using Docker .NET 10 SDK container directly (no local SDK install needed)
docker compose run --rm --entrypoint bash -v "${PWD}/Project system ENGINE/Backend:/src" mcr.microsoft.com/dotnet/sdk:10.0 -c "cd /src && dotnet tool install --global dotnet-ef && export PATH=\$PATH:/root/.dotnet/tools && dotnet ef migrations add AddNewIncidentColumn"

# After adding a migration, rebuild and apply inside Docker:
docker compose up -d --build
docker compose exec resqtrack-backend dotnet Backend.dll updatedatabase
```

---

## 9. Roboflow + Claude Haiku 4.5 Vision Testing Inside Docker

```powershell
# Verify C# Dual-Stage /api/reports/analyze-image endpoint in Docker
$b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("Testing/Frontend/fixtures/assets/elena_headshot_280.png"))
$body = @{ imageDataUrl = "data:image/png;base64,$b64"; titleHint = ""; noteHint = "" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "http://127.0.0.1:1999/api/reports/analyze-image" -Method POST -ContentType "application/json" -Body $body
```

---

## 10. Interactive Shortcuts via `.\start.ps1`

```powershell
.\start.ps1 docker-up                        # Runs: docker compose up -d --build
.\start.ps1 docker-rebuild                   # Runs: docker compose down -> build --no-cache -> up -d
.\start.ps1 docker-updatedatabase            # Runs: docker compose exec/run updatedatabase
.\start.ps1 createsuperadmin                 # Prompts: [1] DEFAULT (Email & Password - No Statics) or [2] CUSTOM (Email, Password & Confirm Password)
.\start.ps1 createresponders                 # Prompts: 1. RHU/MEDICS, 2. BFP/FIRE, 3. PNP/POLICE -> Email, Password & Confirm Password
.\start.ps1 createcivilians                  # Prompts: Email, Password & Confirm Password
.\start.ps1 useredit                         # Merged Edit: 1. Admin User, 2. Responders (RHU/BFP/PNP), 3. Civilians -> Search Bar -> FirstName/LastName/Email + Optional Direct Password Change
.\start.ps1 userdelete                       # Merged Delete: 1. Admin User, 2. Responders (RHU/BFP/PNP), 3. Civilians -> Search Bar -> Single User or ALL (with Admin Password Verification)
```
