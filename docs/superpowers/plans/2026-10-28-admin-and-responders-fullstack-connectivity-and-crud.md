# Admin and Multi-Agency Responders Full-Stack Connectivity & CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish complete, type-safe, and relationally synced end-to-end connectivity between Frontend UI triggers, Global UI Primitives (`@/Shared`), Global Hooks (`@/Hooks`), Typed Client Endpoints (`@/Endpoints`), ASP.NET Core Controllers, Services, Repositories, and SQL Server `ResQTrackDb` Entities across the Admin and specialized Responder domains (RHU Medic, BFP Firefighters, and PNP Police).

**Architecture:** Layered Vertical Slice following Katipuneros architecture, enforcing clean expression-bodied lambdas (`=>`) across C# and TypeScript, pure `lucide-react` icons, dual-port RBAC isolation (5174 for Admin, 5173 for Responders, 5000 for Web API), and the zero-static telemetry invariant.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React, .NET 10, ASP.NET Core Web API, Entity Framework Core 10, Microsoft SQL Server (SSMS 19), Scrypt KDF, SHA-256 cryptographic audit chaining.

**Spec:** [`docs/superpowers/specs/2026-10-28-admin-and-responders-fullstack-connectivity-and-crud-spec.md`](file:///C:/Users/provu/Desktop/INCIDENT%20AI%20SYSTEM%20DETECTION/docs/superpowers/specs/2026-10-28-admin-and-responders-fullstack-connectivity-and-crud-spec.md)

## Global Constraints
- Katipuneros 6-Tier Architecture: Presentation -> Feature -> Endpoints -> Shared -> Libs -> Assets.
- Universal Expression Body Lambda (`=>`) on all synchronous and asynchronous operations.
- Global Calling Imports: all UI primitives from `@/Shared`, all hooks from `@/Hooks`.
- Pure `lucide-react` icons ONLY (zero emojis, zero `<use href="#i-*"/>` SVG sprites, zero raw unstyled `<svg>`).
- Zero-Static Telemetry Invariant ($N=0$): 100% database-driven metrics, division-by-zero protection, authentic zeros.
- Dual-Port Physical RBAC Boundary: Port 5174 (LDRRMO Admin), Port 5173 (Responders & Civilians), Port 5000 (.NET 10 API).

---

### Task 1: Complete Typed Responder Operations Endpoints Stubs
**Files:**
- Modify: `Frontend/src/Endpoints/responderOpsApi.ts`
- Test: `Frontend/src/Endpoints/responderOpsApi.ts` (Type verification via `tsc -b`)

**Interfaces:**
- Consumes: `requestJson` from `./apiClient`
- Produces:
  - `submitPcrRecord(payload: CreatePcrPayload): Promise<{ message: string; data: PatientCareRecord }>`
  - `getPcrRecords(reportId?: string): Promise<PatientCareRecord[]>`
  - `filePoliceBlotter(payload: CreateBlotterPayload): Promise<{ message: string; data: PoliceBlotterEntry }>`
  - `getPoliceBlotters(reportId?: string): Promise<PoliceBlotterEntry[]>`
  - `setFireAlarmLevel(payload: SetAlarmLevelPayload): Promise<{ message: string; data: FireAlarmStatusRecord }>`
  - `getFireAlarmStatuses(reportId?: string): Promise<FireAlarmStatusRecord[]>`
  - `getNearbyHydrants(): Promise<IncidentFixture[]>`

- [ ] **Step 1: Define TypeScript interfaces for specialized domain payloads**
  Define `CreatePcrPayload`, `PatientCareRecord`, `CreateBlotterPayload`, `PoliceBlotterEntry`, `SetAlarmLevelPayload`, `FireAlarmStatusRecord`, and `IncidentFixture` in `responderOpsApi.ts`.
- [ ] **Step 2: Implement arrow lambda endpoint functions (`=>`)**
  Export `submitPcrRecord`, `getPcrRecords`, `filePoliceBlotter`, `getPoliceBlotters`, `setFireAlarmLevel`, `getFireAlarmStatuses`, and `getNearbyHydrants` using `requestJson` and arrow lambdas (`=>`).
- [ ] **Step 3: Verify TypeScript static compilation**
  Run `npx tsc -b` to guarantee zero type errors.
- [ ] **Step 4: Commit endpoint additions**
  Commit `Frontend/src/Endpoints/responderOpsApi.ts` to git.

---

### Task 2: Implement Shared Specialized Operational Modals in `@/Shared`
**Files:**
- Create: `Frontend/src/Shared/PatientCareRecordModal.tsx`
- Create: `Frontend/src/Shared/FireAlarmEscalationModal.tsx`
- Create: `Frontend/src/Shared/PoliceBlotterModal.tsx`
- Modify: `Frontend/src/Shared/index.ts`
- Test: `Frontend/src/Shared/index.ts` (Type check via `tsc -b`)

**Interfaces:**
- Consumes: `@/Shared/Button`, `@/Shared/DefaultFloatingModalCard`, `lucide-react` icons
- Produces:
  - `<PatientCareRecordModal isOpen={boolean} onClose={fn} reportId={string} onSaved={fn} />`
  - `<FireAlarmEscalationModal isOpen={boolean} onClose={fn} reportId={string} onSaved={fn} />`
  - `<PoliceBlotterModal isOpen={boolean} onClose={fn} reportId={string} onSaved={fn} />`

- [ ] **Step 1: Create `PatientCareRecordModal.tsx`**
  Build RHU Medic trauma and vitals input card with blood pressure, heart rate, SpO2, respiratory rate, GCS level, chief complaint, interventions, and pure Lucide icons (`HeartPulse`, `Activity`, `FileText`, `Check`).
- [ ] **Step 2: Create `FireAlarmEscalationModal.tsx`**
  Build BFP Fire Rescue alarm escalation card with alarm level selector (1st Alarm to General Alarm), building classification, trapped occupants count, water supply gallons, and pure Lucide icons (`Flame`, `Droplets`, `Building`, `Check`).
- [ ] **Step 3: Create `PoliceBlotterModal.tsx`**
  Build PNP Police incident blotter entry card with incident classification, complainant details, suspect details, narrative statement, investigating officer badge, station identifier, cryptographic seal preview, and pure Lucide icons (`Shield`, `FileText`, `BadgeCheck`, `Check`).
- [ ] **Step 4: Export modals from barrel `Frontend/src/Shared/index.ts`**
  Add explicit named exports for all 3 modals.
- [ ] **Step 5: Verify TypeScript compilation**
  Run `npx tsc -b` to confirm clean typing.
- [ ] **Step 6: Commit shared modals**
  Commit `Frontend/src/Shared/` to git.

---

### Task 3: Integrate Specialized Modals & Tactical Progression into Responder Console
**Files:**
- Modify: `Frontend/src/UserRoles/Features/Pages/RespondersPanel/ResponderDashboard.tsx`
- Modify: `Frontend/src/UserRoles/Features/Pages/RespondersPanel/UnitIncidentsFeed.tsx`
- Test: `Frontend/src/UserRoles/Features/Pages/RespondersPanel/ResponderDashboard.tsx`

**Interfaces:**
- Consumes: `@/Shared/PatientCareRecordModal`, `@/Shared/FireAlarmEscalationModal`, `@/Shared/PoliceBlotterModal`, `@/Hooks/useSession`, `@/Hooks/useReportEventBus`
- Produces:
  - Dynamically mounted operational actions matching agency identity (`RHU` -> PCR, `FIRE` -> Alarm Level, `PNP` -> Blotter).
  - Triage progression with real-time API sync (`En Route` -> `On Scene` -> `Resolved`).

- [ ] **Step 1: Wire agency action buttons in `ResponderDashboard.tsx`**
  Mount trigger buttons for `PatientCareRecordModal` when `user.unit === 'RHU'`, `FireAlarmEscalationModal` when `user.unit === 'FIRE'`, and `PoliceBlotterModal` when `user.unit === 'PNP'`, styled with Katipuneros tokens and pure Lucide icons.
- [ ] **Step 2: Wire incident feed quick-actions in `UnitIncidentsFeed.tsx`**
  Add quick-action buttons on incident cards to launch the agency-appropriate modal pre-filled with the incident's `reportId`.
- [ ] **Step 3: Verify TypeScript compilation and zero-static metrics**
  Run `npx tsc -b` to ensure 0 errors and confirm that all counters render authentic zeros when no data exists.
- [ ] **Step 4: Commit responder console enhancements**
  Commit changes to git.

---

### Task 4: Validate Admin Relational Cross-Page Synchronization Engine
**Files:**
- Inspect & Verify: `Frontend/src/UserRoles/Features/Pages/AdminsPanel/AdminDashboard.tsx`
- Inspect & Verify: `Frontend/src/UserRoles/Features/Pages/AdminsPanel/StrategicMapPage.tsx`
- Inspect & Verify: `Frontend/src/UserRoles/Features/Pages/AdminsPanel/IncidentsPage.tsx`
- Inspect & Verify: `Frontend/src/UserRoles/Features/Pages/AdminsPanel/RespondersRosterPage.tsx`
- Test: Full Frontend build (`npm run build`)

**Interfaces:**
- Consumes: `resqtrack:report` event bus, `useReportEventBus`, `useValueRefreshAuto`
- Produces:
  - Cross-module synchronized state between Incident triage updates, Satellite Map radar markers, Fleet Roster allocations, and Header alert counters.

- [ ] **Step 1: Audit event bus dispatch and listener wiring**
  Confirm that `window.dispatchEvent(new CustomEvent('resqtrack:report'))` is triggered upon incident creation, verification, and allocation.
- [ ] **Step 2: Confirm reactive listener bindings**
  Verify that `StrategicMapPage.tsx`, `AdminDashboard.tsx`, and `IncidentsPage.tsx` listen to `resqtrack:report` and re-fetch active database state cleanly.
- [ ] **Step 3: Audit division-by-zero protection**
  Confirm that all percentage calculations across `AnalyticsReportsPage.tsx` and `AdminDashboard.tsx` are protected against division-by-zero with clean empty fallbacks.
- [ ] **Step 4: Execute production bundle verification**
  Run `npm run build` (`tsc -b && vite build`) to ensure 0 errors and zero warnings.

---

### Task 5: Master Verification, DevOps Health & Obsidian Progress Sync
**Files:**
- Modify: `Obsidian Memory Engine/log.md`
- Test: `manage.ps1 status` / `dotnet build` / `npm run build`

- [ ] **Step 1: Execute `dotnet build` on Backend**
  Confirm backend compiles with 0 errors and 0 warnings.
- [ ] **Step 2: Execute `npm run build` on Frontend**
  Confirm frontend Vite production bundle completes with 0 errors.
- [ ] **Step 3: Update `Obsidian Memory Engine/log.md`**
  Record the implementation milestone and verified state.
- [ ] **Step 4: Final Git commit**
  Commit verified state to branch `Progress`.
