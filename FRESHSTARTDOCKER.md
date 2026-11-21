# ResQTrack Incident AI Detection Engine - Fresh Start Docker Guide (`FRESHSTARTDOCKER.md`)

Complete command reference for running the **4-Port Docker Ecosystem** (`:1996` Admin, `:1997` Responders, `:1998` Civilian, `:1999` Backend API, PostgreSQL Primary `:5432`, PostgreSQL Replica `:5433`, Redis `:6379`) and executing all CLI account, migration, and AI vision workflows inside Docker.

---

## 1. Fresh Clone Setup on 2nd / 3rd PC & Clean Docker Launch

`docker-compose.yml` mounts the tracked `Project system ENGINE/Backend/LocalConfig` directory instead of a single gitignored `appsettings.Local.json` file, and mounts `Project system ENGINE/Frontend/public` plus isolated per-portal `node_modules` volumes with `CHOKIDAR_USEPOLLING=true` / `WATCHPACK_POLLING=true` across all 3 Vite portals (`:1996`, `:1997`, `:1998`). A freshly cloned repository starts cleanly with zero manual directory hacks.

```powershell
# 1. Clone from GitHub and enter the repository root
git clone <YOUR_GITHUB_REPO_URL> "INCIDENT AI SYSTEM DETECTION"
cd "INCIDENT AI SYSTEM DETECTION"

# 2. (Only if upgrading an older Windows clone) Remove stray empty directories left by older mounts
Remove-Item -Path "Project system ENGINE/Frontend/postcss.config.js", "Project system ENGINE/Frontend/tailwind.config.js", "Project system ENGINE/Backend/appsettings.Local.json" -Recurse -Force -ErrorAction SilentlyContinue

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

## 3. Superadmin / Custom Admin Commands (Create, Edit, Delete & Functions)

> Password minimum length enforced by `ScryptPasswordHelper`: **12 characters**.
> CLI commands accept `unit` aliases (`LDRRMO`, `MEDIC` / `RHU`, `FIRE` / `BFP`, `PNP` / `POLICE`) and `adduser` accepts full custom role + unit + ID arguments.

### Create Default & Custom Admin (`createsuperadmin`, `createcustomsuperadmin`, `adduser`)
```powershell
# 1. Default Superadmin (Role=LDRRMO_Admin, Unit=LDRRMO)
# Usage: createsuperadmin <email> <password> [fullName] [unit]
docker compose exec resqtrack-backend dotnet Backend.dll createsuperadmin "ldrrmo.admin2@resqtrack.gov.ph" "AdminCommand@2026!" "Director Juan Reyes" "LDRRMO"

# 2. Custom Admin / Unit Officer
# Usage: createcustomsuperadmin <email> <password> [unit] [fullName]
# Note: unit=LDRRMO provisions Role=LDRRMO_Admin; RHU/MEDIC/FIRE/PNP provisions Responder unit officer
docker compose exec resqtrack-backend dotnet Backend.dll createcustomsuperadmin "ldrrmo.ops@resqtrack.gov.ph" "AdminOpsPass@2026!" "LDRRMO" "Operations Chief Rivera"
docker compose exec resqtrack-backend dotnet Backend.dll createcustomsuperadmin "rhu.lead@resqtrack.gov.ph" "RhuChief@2026!!" "MEDIC" "Dr. Elena Cruz"

# 3. Generic Custom Admin with Explicit Employee ID via adduser
# Usage: adduser <email> <password> <fullName> <role> [unit] [employeeOrResidentId]
docker compose exec resqtrack-backend dotnet Backend.dll adduser "ldrrmo.custom@resqtrack.gov.ph" "LdrrmoCustom@2026!" "Deputy Director Santos" "LDRRMO_Admin" "LDRRMO" "LDRRMO-EXEC-009"
```

### Custom Admin via Authenticated REST API (`POST /api/users`)
```powershell
# Authenticate as LDRRMO Admin first, then provision full profile fields (PlantillaNumber, ExecutiveDesignation, ClearanceLevel)
$adminLogin = Invoke-RestMethod -Uri "http://127.0.0.1:1999/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"ldrrmo.admin@resqtrack.gov.ph","password":"LdrrmoCommand@2026!"}'
$headers = @{ Authorization = "Bearer $($adminLogin.token)"; "Content-Type" = "application/json" }
$customAdminBody = @{
  email = "ldrrmo.exec2@resqtrack.gov.ph"
  password = "ExecCommand@2026!"
  firstName = "Clarissa"
  surname = "Reyes"
  role = 1
  unit = 1
  employeeOrResidentId = "LDRRMO-EXEC-202"
  departmentOrBarangay = "Command & Operations Center"
  rankOrTitle = "Operations Officer IV"
  plantillaNumber = "PLANTILLA-LDRRMO-019"
  executiveDesignation = "Incident Command Officer"
  clearanceLevel = "Level 4 - Command Authority"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:1999/api/users" -Method POST -Headers $headers -Body $customAdminBody
```

**LDRRMO Admin Functions (`http://localhost:1996`)**:
- Command Dashboard (`GET /api/analytics/overview`, live pulsing GIS radar map, Claude nearby unit ranking)
- Dispatch Manager & Responder Deployment (`POST /api/incidents`, `POST /api/reports/{id}/verify`, `POST /api/reports/{id}/allocate`)
- Submitted Reports & AI Auto-Approve (`POST /api/reports/{id}/ai-auto-approve`)
- Broadcast Alerts (`POST /api/alerts/broadcast`) & Full User Governance (`GET/POST/PUT/DELETE /api/users`)

### Edit Superadmin (`edituser` & `resetpassword`)
```powershell
# Update password AND email (use "-" to keep current password or email)
# Usage: edituser <currentEmail> [newPassword] [newEmail]
docker compose exec resqtrack-backend dotnet Backend.dll edituser "ldrrmo.admin2@resqtrack.gov.ph" "NewAdminPass@2026!" "ldrrmo.chief@resqtrack.gov.ph"

# Update password only (keep existing email)
docker compose exec resqtrack-backend dotnet Backend.dll edituser "ldrrmo.chief@resqtrack.gov.ph" "UpdatedPass@2026!" "-"
docker compose exec resqtrack-backend dotnet Backend.dll resetpassword "ldrrmo.chief@resqtrack.gov.ph" "ResetAdminPass@2026!"

# Update email only (keep existing password)
docker compose exec resqtrack-backend dotnet Backend.dll edituser "ldrrmo.chief@resqtrack.gov.ph" "-" "ldrrmo.director@resqtrack.gov.ph"
```

### Delete Superadmin (`deletesuperadmin` / `deletecliuser`)
```powershell
# Delete a specific Superadmin account by email
docker compose exec resqtrack-backend dotnet Backend.dll deletesuperadmin "ldrrmo.director@resqtrack.gov.ph"

# Alternative generic delete command
docker compose exec resqtrack-backend dotnet Backend.dll deletecliuser "rhu.lead@resqtrack.gov.ph"
```

---

## 4. Custom Responder Commands - MEDIC (RHU), PNP & FIRE (Create, Edit, Delete & Functions)

> Unit aliases supported by `CliCommandRunner.ParseUnit`: `MEDIC` / `RHU` (`2`), `FIRE` / `BFP` (`3`), `PNP` / `POLICE` (`4`).

### Create Standard or Custom Responder (`createresponder`, `createcustomresponder`, `adduser`)
```powershell
# Quick Create per unit: createresponder <email> <password> <MEDIC|RHU|FIRE|PNP> [fullName]
docker compose exec resqtrack-backend dotnet Backend.dll createresponder "medic.unit2@resqtrack.gov.ph" "MedicPass@2026!!" "MEDIC" "Nurse Marco Santos"
docker compose exec resqtrack-backend dotnet Backend.dll createresponder "fire.unit2@resqtrack.gov.ph" "BfpFirePass@2026!" "FIRE" "FO2 Carlo Villanueva"
docker compose exec resqtrack-backend dotnet Backend.dll createresponder "pnp.unit2@resqtrack.gov.ph" "PnpPatrol@2026!" "PNP" "Pat. Mateo Navarro"

# Custom Responder with explicit Employee ID & Rank/Title:
# Usage: createcustomresponder <email> <password> [unit] [fullName] [employeeId] [rankOrTitle]
docker compose exec resqtrack-backend dotnet Backend.dll createcustomresponder "medic.custom@resqtrack.gov.ph" "MedicCustom@2026!" "MEDIC" "Dr. Paolo Aquino" "RHU-MED-301" "Emergency Medical Officer II"
docker compose exec resqtrack-backend dotnet Backend.dll createcustomresponder "pnp.custom@resqtrack.gov.ph" "PnpCustom@2026!!" "PNP" "Sgt. Rafael Torres" "PNP-PATROL-402" "Police Staff Sergeant"
docker compose exec resqtrack-backend dotnet Backend.dll createcustomresponder "fire.custom@resqtrack.gov.ph" "BfpCaptain@2026!" "FIRE" "Capt. Luis Garcia" "BFP-ENG2-204" "Fire Inspector"

# Alternative via generic adduser:
docker compose exec resqtrack-backend dotnet Backend.dll adduser "medic.amb3@resqtrack.gov.ph" "MedicAmb3@2026!" "EMT Carla Reyes" "Responder" "MEDIC" "RHU-EMT-303"
```

### Custom MEDIC / PNP / FIRE via REST API (`POST /api/users` with Agency Fields)
```powershell
# Reuse $headers from LDRRMO Admin login above
# Custom MEDIC (role=2, unit=2 -> RHU)
$customMedic = @{
  email = "medic.trauma@resqtrack.gov.ph"; password = "MedicTrauma@2026!"; firstName = "Paolo"; surname = "Aquino"
  role = 2; unit = 2; employeeOrResidentId = "RHU-MED-305"; rankOrTitle = "Trauma Officer II"
  medicalLicenseNumber = "PRC-MED-992104"; medicalCadre = "Emergency Physician"; stationHealthCenter = "Katipunan RHU Main"; ambulanceCallSign = "MEDIC-AMB-03"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:1999/api/users" -Method POST -Headers $headers -Body $customMedic

# Custom PNP (role=2, unit=4 -> PNP)
$customPnp = @{
  email = "pnp.traffic@resqtrack.gov.ph"; password = "PnpTraffic@2026!"; firstName = "Rafael"; surname = "Torres"
  role = 2; unit = 4; employeeOrResidentId = "PNP-TRF-405"; rankOrTitle = "Police Staff Sergeant"
  policeRank = "PSSg"; pnpBadgeNumber = "PNP-REG9-90412"; precinctOrStation = "Katipunan MPS Sector 2"; policeAssignment = "Traffic & Perimeter Patrol"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:1999/api/users" -Method POST -Headers $headers -Body $customPnp

# Custom FIRE (role=2, unit=3 -> FIRE)
$customFire = @{
  email = "fire.rescue2@resqtrack.gov.ph"; password = "FireRescue@2026!"; firstName = "Luis"; surname = "Garcia"
  role = 2; unit = 3; employeeOrResidentId = "BFP-RES-205"; rankOrTitle = "Senior Fire Officer I"
  firefighterRank = "SFO1"; bfpBadgeNumber = "BFP-REG9-77120"; fireStation = "Katipunan Central Fire Station"; apparatusCallSign = "BFP-TANKER-02"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:1999/api/users" -Method POST -Headers $headers -Body $customFire
```

**Responder Unit Functions (`http://localhost:1997`)**:
- **MEDIC (RHU)**: Scoped medical/vehicular incident feed, Patient Care Record (PCR) logging (`POST/GET /api/responder-ops/pcr`), GPS ping & duty readiness (`PUT /api/responder-ops/duty-status`), backup deploy requests (`/responder/request-deploy`).
- **PNP (Police)**: Scoped crime/security/traffic feed, Police Blotter filing (`POST/GET /api/responder-ops/blotter`), incident status & GPS readiness updates, backup dispatch requests.
- **FIRE (BFP)**: Scoped structural fire/hazmat feed, Hydrant map lookup (`GET /api/responder-ops/hydrants`), apparatus readiness (`On Duty`, `En Route`, `On Scene`, `Returning`), backup dispatch coordination.

### Edit Responder (`edituser` & `resetpassword`)
```powershell
# Change password and email for a Responder
docker compose exec resqtrack-backend dotnet Backend.dll edituser "medic.unit2@resqtrack.gov.ph" "NewMedicPass@2026!" "medic.alpha2@resqtrack.gov.ph"

# Change password only (keep email)
docker compose exec resqtrack-backend dotnet Backend.dll resetpassword "fire.unit2@resqtrack.gov.ph" "NewFirePass@2026!"

# Change email only (keep password)
docker compose exec resqtrack-backend dotnet Backend.dll edituser "pnp.unit2@resqtrack.gov.ph" "-" "pnp.sector2@resqtrack.gov.ph"
```

### Delete Responder (`deletecliuser`)
```powershell
docker compose exec resqtrack-backend dotnet Backend.dll deletecliuser "medic.alpha2@resqtrack.gov.ph"
docker compose exec resqtrack-backend dotnet Backend.dll deletecliuser "fire.unit2@resqtrack.gov.ph"
docker compose exec resqtrack-backend dotnet Backend.dll deletecliuser "pnp.sector2@resqtrack.gov.ph"
```

---

## 5. Custom Civilian Commands (Create, Edit, Delete & Functions)

### Create Default or Custom Civilian (`createcivilian`, `createcustomcivilian`, `adduser`)
```powershell
# 1. Standard Civilian account (Role=Civilian, Unit=None, Verified)
# Usage: createcivilian <email> <password> [fullName]
docker compose exec resqtrack-backend dotnet Backend.dll createcivilian "citizen.ana@resqtrack.gov.ph" "CivilianPass@2026!" "Ana Marie Bautista"

# 2. Custom Civilian with explicit Resident ID & Barangay
# Usage: createcustomcivilian <email> <password> [fullName] [residentId] [barangay]
docker compose exec resqtrack-backend dotnet Backend.dll createcustomcivilian "citizen.pedro@resqtrack.gov.ph" "CivilianPedro@2026!" "Pedro Penduko" "UG-RES-2026-44" "Barangay Uno"

# 3. Alternative via generic adduser
docker compose exec resqtrack-backend dotnet Backend.dll adduser "citizen.rosa@resqtrack.gov.ph" "CivilianRosa@2026!" "Rosa Mendoza" "Civilian" "None" "UG-RES-2026-88"
```

### Custom Civilian via REST API (`POST /api/users` with Residency Fields)
```powershell
# Reuse $headers from LDRRMO Admin login above (role=3 Civilian, unit=0 None)
$customCivilian = @{
  email = "citizen.elena@resqtrack.gov.ph"; password = "CivilianElena@2026!"; firstName = "Elena"; surname = "Magno"
  role = 3; unit = 0; employeeOrResidentId = "UG-RES-2026-105"; barangay = "Barangay San Antonio"
  phoneNumber = "0917 555 0199"; emergencyContactName = "Mario Magno"; emergencyContactPhone = "0917 555 0100"
  governmentIdType = "PhilSys National ID"; residencyCategory = "Permanent Resident"; vulnerabilityFlags = "None"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:1999/api/users" -Method POST -Headers $headers -Body $customCivilian
```

**Civilian Functions (`http://localhost:1998`)**:
- Live Camera / Photo Incident SOS Reporting (`POST /api/reports/analyze-image`, `POST /api/reports` with Roboflow + Claude Haiku 4.5 AI verification & auto-approve eligibility)
- Live 1-BPM Distress GPS Beacon Telemetry (`POST /api/reports/{id}/beacon`)
- Live Sector & Evacuation Safe Zones Map (`/civilian/live-map`), Personal Report History (`/civilian/my-reports`), Community Advisories (`/civilian/alerts`), Profile & Contact Updates (`PUT /api/profile`)

### Edit Civilian (`edituser` & `resetpassword`)
```powershell
# Update Civilian password and email
docker compose exec resqtrack-backend dotnet Backend.dll edituser "citizen.ana@resqtrack.gov.ph" "UpdatedCivPass@2026!" "citizen.ana.new@resqtrack.gov.ph"

# Update Civilian password only
docker compose exec resqtrack-backend dotnet Backend.dll resetpassword "citizen.pedro@resqtrack.gov.ph" "NewPedroPass@2026!"

# Update Civilian email only
docker compose exec resqtrack-backend dotnet Backend.dll edituser "citizen.pedro@resqtrack.gov.ph" "-" "pedro.uno@resqtrack.gov.ph"
```

### Delete Civilian / Bulk Cleanup (`deletecliuser` & `deleteallcliusers`)
```powershell
# Delete a specific Civilian account
docker compose exec resqtrack-backend dotnet Backend.dll deletecliuser "citizen.ana.new@resqtrack.gov.ph"

# Delete ALL non-default CLI-created test users (preserves seeded demo accounts)
docker compose exec resqtrack-backend dotnet Backend.dll deleteallcliusers
```

---

## 6. Database Migrations (`updatedatabase` & `addmigration`)

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

## 7. Roboflow + Claude Haiku 4.5 Vision Testing Inside Docker

```powershell
# Test standalone Python inference-sdk inside the Backend Docker container
docker compose exec -e ROBOFLOW_API_KEY="YOUR_ROBOFLOW_KEY" resqtrack-backend python3 /app/Scripts/roboflow_accident_infer.py --image /app/server-data/uploads/reports/sample_accident.png

# Verify C# Dual-Stage /api/reports/analyze-image endpoint in Docker
$b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("Testing/Frontend/fixtures/assets/elena_headshot_280.png"))
$body = @{ imageDataUrl = "data:image/png;base64,$b64"; titleHint = ""; noteHint = "" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "http://127.0.0.1:1999/api/reports/analyze-image" -Method POST -ContentType "application/json" -Body $body
```

---

## 8. Interactive Shortcuts via `.\start.ps1`

```powershell
.\start.ps1 docker-up              # Runs: docker compose up -d --build
.\start.ps1 docker-rebuild         # Runs: docker compose down -> build --no-cache -> up -d
.\start.ps1 docker-updatedatabase  # Runs: docker compose exec/run updatedatabase
.\start.ps1 docker-createsuperadmin <email> <password> [fullName] [unit]
.\start.ps1 docker-createresponder <email> <password> <RHU|FIRE|PNP> [fullName]
.\start.ps1 docker-createcivilian <email> <password> [fullName]
```
