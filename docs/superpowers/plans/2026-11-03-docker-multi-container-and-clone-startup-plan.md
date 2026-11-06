# Docker Multi-Container Separation & Universal Clone-and-Run Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerize the ResQTrack Incident AI System into isolated Docker Compose services separating Admin, Responders, Civilian, .NET 10 Backend, Redis Cache, Primary PostgreSQL Database, and Standby Replica Database; update all PowerShell and CMD startup automation to automatically install dependencies and launch cleanly on fresh git clones against any enterprise relational database (PostgreSQL, SQL Server SSMS 19, MySQL/MariaDB) with zero SQLite.

**Architecture:** 
- A multi-container Docker Compose topology (`docker-compose.yml`) containing 7 isolated services: `resqtrack-admin` (:5174), `resqtrack-responders` (:5173), `resqtrack-civilian` (:5175), `resqtrack-backend` (:5000), `resqtrack-cache` (:6379), `resqtrack-db-primary` (:5432), and `resqtrack-db-replica` (:5433).
- Dual-mode startup automation across PowerShell (`.ps1`) and CMD (`.bat`) in root (`start.ps1`, `start.bat`) and `CommandStart/`: supports both full-stack Docker orchestration and local development with auto-booted Docker relational database and Redis.
- Zero-configuration clone-and-run guarantee: auto-installs npm dependencies, auto-restores .NET packages, verifies database connection, runs EF Core migrations, and launches all service portals.

**Tech Stack:** Docker Compose v2, .NET 10 Web API, React 19 + TypeScript + Vite, PostgreSQL 16 Alpine, Redis 7 Alpine, PowerShell 7/5.1, Windows CMD.

---

## Global Constraints
- Strictly enterprise relational databases only: PostgreSQL, Microsoft SQL Server (SSMS 19), or MySQL (MariaDB). Zero SQLite anywhere in the repository.
- Strict multi-port role isolation: Admin (:5174), Responders (:5173), Civilian (:5175), Backend (:5000), Redis (:6379), Primary DB (:5432), Replica DB (:5433).
- 100% arrow lambda syntax (`=>`), zero `any`, zero Unicode emojis (pure `lucide-react`).
- Dual PowerShell (`.ps1`) and CMD (`.bat`) parity across all startup scripts.
- Graceful degradation: Backend runs with in-memory cache if Redis is temporarily unreachable, and connects to primary or configured fallback RDBMS.

---

## Tasks

### Task 1: Backend Redis Integration, CORS & Container Network Configuration
**Files:**
- Modify: `Project system ENGINE/Backend/Program.cs`
- Modify: `Project system ENGINE/Backend/appsettings.json`
- Modify: `Project system ENGINE/Backend/appsettings.Development.json` (if exists)

- [ ] **Step 1: Update CORS in `Program.cs` to include Port 5175 (Civilian SOS Portal)**
- [ ] **Step 2: Configure Redis distributed caching with resilient In-Memory fallback in `Program.cs`**
- [ ] **Step 3: Update `appsettings.json` with Docker & Replica connection strings and Redis endpoints**
- [ ] **Step 4: Verify backend compilation via `dotnet build`**

---

### Task 2: Frontend Multi-Port Scripts & Vite Proxy Docker Compatibility
**Files:**
- Modify: `Project system ENGINE/Frontend/package.json`
- Modify: `Project system ENGINE/Frontend/vite.config.ts`

- [ ] **Step 1: Add `dev:civilian` script to `package.json` with port 5175**
- [ ] **Step 2: Update `vite.config.ts` to dynamically resolve `process.env.BACKEND_URL` for container proxying**
- [ ] **Step 3: Verify frontend typecheck and build via `npm run build`**

---

### Task 3: Multi-Stage Dockerfiles for Backend and Frontend Services
**Files:**
- Create: `Project system ENGINE/Backend/Dockerfile`
- Create: `Project system ENGINE/Frontend/Dockerfile`
- Create: `Project system ENGINE/Frontend/Dockerfile.admin`
- Create: `Project system ENGINE/Frontend/Dockerfile.responder`
- Create: `Project system ENGINE/Frontend/Dockerfile.civilian`
- Create: `Project system ENGINE/Frontend/nginx.conf` (for optimized static production serving)

- [ ] **Step 1: Create Backend .NET 10 multi-stage `Dockerfile` (build with `sdk:10.0-preview`, run with `aspnet:10.0-preview`)**
- [ ] **Step 2: Create Frontend unified `Dockerfile` with role-based build/serve targets (`admin`, `responder`, `civilian`)**
- [ ] **Step 3: Create role-specific wrapper Dockerfiles (`Dockerfile.admin`, `Dockerfile.responder`, `Dockerfile.civilian`)**

---

### Task 4: Complete Multi-Container Docker Compose Topology
**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.postgres.yml`
- Create: `docker-compose.replica.yml` (replication configuration and replica volume)

- [ ] **Step 1: Configure `resqtrack-cache` (Redis 7 Alpine, port 6379, persistent volume)**
- [ ] **Step 2: Configure `resqtrack-db-primary` (PostgreSQL 16 Alpine, port 5432, replication-ready)**
- [ ] **Step 3: Configure `resqtrack-db-replica` (PostgreSQL 16 Alpine, port 5433, standby read replica)**
- [ ] **Step 4: Configure `resqtrack-backend` (.NET 10 API, port 5000, connected to cache + db-primary)**
- [ ] **Step 5: Configure `resqtrack-admin` (Port 5174, LDRRMO Admin)**
- [ ] **Step 6: Configure `resqtrack-responders` (Port 5173, RHU/Fire/PNP)**
- [ ] **Step 7: Configure `resqtrack-civilian` (Port 5175, Civilian SOS)**
- [ ] **Step 8: Validate compose topology with `docker compose config`**

---

### Task 5: Universal Clone-and-Run Dependency Auto-Installer & Orchestration Scripts
**Files:**
- Create: `CommandStart/install-dependencies.ps1` & `install-dependencies.bat`
- Create: `CommandStart/docker-start-all.ps1` & `docker-start-all.bat`
- Create: `CommandStart/docker-stop-all.ps1` & `docker-stop-all.bat`
- Modify: `start.ps1` & `start.bat`
- Modify: `CommandStart/startdev-all.ps1` & `startdev-all.bat`
- Modify: `CommandStart/stopdev-all.ps1` & `stopdev-all.bat`
- Modify: `CommandStart/manage.ps1` & `manage.bat`
- Modify: `CommandStart/run.bat` & `start-dev.bat`

- [ ] **Step 1: Create `CommandStart/install-dependencies.ps1` & `.bat` to automatically restore npm, dotnet packages, and EF tools**
- [ ] **Step 2: Create `CommandStart/docker-start-all.ps1` & `.bat` to launch full multi-container stack**
- [ ] **Step 3: Create `CommandStart/docker-stop-all.ps1` & `.bat` to gracefully stop all containers**
- [ ] **Step 4: Update `CommandStart/startdev-all.ps1` to auto-install dependencies, start PostgreSQL + Redis if needed, and spawn Civilian :5175**
- [ ] **Step 5: Update `CommandStart/stopdev-all.ps1` to cleanly terminate processes across ports 5000, 5173, 5174, 5175, and stop background DB containers if prompted**
- [ ] **Step 6: Update root `start.ps1` and `start.bat` with interactive auto-bootstrap menu and fast-path defaults**
- [ ] **Step 7: Update `CommandStart/manage.ps1` with new container management verbs (`docker-up`, `docker-down`, `docker-build`, `docker-status`, `redis-cli`, `replica-status`)**

---

### Task 6: End-to-End Verification and Validation
**Files:**
- Test: `docker compose config`
- Test: `dotnet build`
- Test: `npm run build`
- Test: Multi-role port test execution

- [ ] **Step 1: Execute `docker compose config` to guarantee zero syntax or network errors**
- [ ] **Step 2: Execute backend `dotnet build` to confirm 0 errors and 0 warnings**
- [ ] **Step 3: Execute frontend `npm run build` to confirm clean React 19 compilation**
- [ ] **Step 4: Spin up Docker Compose services in test mode to verify port bindings and container health**
- [ ] **Step 5: Document verification results and create comprehensive summary report**
