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

## 3. Superadmin Commands (Create, Edit, Delete)

> Password minimum length enforced by `ScryptPasswordHelper`: **12 characters**.

### Create Superadmin (`createsuperadmin` & `createcustomsuperadmin`)
```powershell
# Default Superadmin (Role=LDRRMO_Admin, Unit=LDRRMO)
# Usage: createsuperadmin <email> <password> [fullName] [unit]
docker compose exec resqtrack-backend dotnet Backend.dll createsuperadmin "ldrrmo.admin2@resqtrack.gov.ph" "AdminCommand@2026!" "Director Juan Reyes" "LDRRMO"

# Custom Unit Admin (Role=LDRRMO_Admin if unit=LDRRMO, otherwise Responder unit officer)
# Usage: createcustomsuperadmin <email> <password> [unit] [fullName]
docker compose exec resqtrack-backend dotnet Backend.dll createcustomsuperadmin "rhu.lead@resqtrack.gov.ph" "RhuChief@2026!!" "RHU" "Dr. Elena Cruz"
```

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

## 4. Responder Commands - RHU / FIRE / PNP (Create, Edit, Delete)

### Create Responder (`createresponder` & `createcustomresponder`)
```powershell
# Create RHU (Medical) Responder
# Usage: createresponder <email> <password> <RHU|FIRE|PNP> [fullName]
docker compose exec resqtrack-backend dotnet Backend.dll createresponder "medic.unit2@resqtrack.gov.ph" "MedicPass@2026!!" "RHU" "Nurse Marco Santos"

# Create FIRE (BFP) Responder
docker compose exec resqtrack-backend dotnet Backend.dll createresponder "fire.unit2@resqtrack.gov.ph" "BfpFirePass@2026!" "FIRE" "FO2 Carlo Villanueva"

# Create PNP (Police) Responder
docker compose exec resqtrack-backend dotnet Backend.dll createresponder "pnp.unit2@resqtrack.gov.ph" "PnpPatrol@2026!" "PNP" "Pat. Mateo Navarro"

# Create Custom Responder with explicit Employee ID & Rank/Title
# Usage: createcustomresponder <email> <password> [unit] [fullName] [employeeId] [rankOrTitle]
docker compose exec resqtrack-backend dotnet Backend.dll createcustomresponder "fire.captain2@resqtrack.gov.ph" "BfpCaptain@2026!" "FIRE" "Capt. Luis Garcia" "BFP-ENG2-204" "Fire Inspector"
```

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

## 5. Civilian Commands (Create, Edit, Delete)

### Create Civilian (`createcivilian` & `createcustomcivilian`)
```powershell
# Standard Civilian account (Role=Civilian, Verified)
# Usage: createcivilian <email> <password> [fullName]
docker compose exec resqtrack-backend dotnet Backend.dll createcivilian "citizen.ana@resqtrack.gov.ph" "CivilianPass@2026!" "Ana Marie Bautista"

# Custom Civilian with explicit Resident ID & Barangay
# Usage: createcustomcivilian <email> <password> [fullName] [residentId] [barangay]
docker compose exec resqtrack-backend dotnet Backend.dll createcustomcivilian "citizen.pedro@resqtrack.gov.ph" "CivilianPedro@2026!" "Pedro Penduko" "UG-RES-2026-44" "Barangay Uno"
```

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
