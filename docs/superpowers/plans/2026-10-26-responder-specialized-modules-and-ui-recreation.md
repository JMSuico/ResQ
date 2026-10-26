# Responders Specialized Modules & UI/UX Frontend Recreation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate and rewrite the frontend and UI for all three emergency responder branches (**RHU Medic**, **BFP Fire Rescue**, and **PNP Police Force**), replacing generic shared pages with dedicated, role-specific operational modules, interactive tactile click behaviors, real-time civilian evidence and GPS tracking, and database-backed telemetry.

**Architecture:** Katipuneros 6-Tier Vertical Slice Architecture in React 19 + TypeScript + Vite + Tailwind CSS with dynamic agency sub-routing, backed by .NET 10 ASP.NET Core Web API + Microsoft SQL Server SSMS 19.

**Tech Stack:** React 19, TypeScript 5.8, Vite 8.3, Leaflet GIS, Tailwind CSS, .NET 10 Web API, Entity Framework Core 10, Scrypt KDF.

**Design Standard:** `ui-ux-pro-max` (dark-mode tactile HUDs, minimum 44px touch targets, zero generic AI marks, bespoke agency palettes).

---

## 1. Global Constraints & Architectural Invariants

1. **Katipuneros Universal Lambdas (`=>`)**: All C# service/repository methods and TypeScript endpoint functions MUST use expression bodies (`=>`).
2. **Zero-Static Telemetry Invariant** (`SKILL.md:1191` & `AGENTS.md:61`): NEVER display fake numbers, hardcoded fallback counts (`|| 12`), or mock curves. All metrics and charts MUST compute dynamically from database records. $N=0$ renders clean zeros.
3. **Dual-Port RBAC Isolation** (`ADR-014`): Port `5174` is strictly for `LDRRMO_Admin`. Port `5173` is for `Civilian` and all `Responder` units.
4. **Clean Route Contract**: Responders navigate clean semantic routes (`/responder/dashboard`, `/responder/incidents`, `/responder/roster`, `/responder/my-reports`, `/responder/alerts`, `/responder/profile`, etc.) with dynamic agency component rendering based on `session.unit` (`RHU` | `FIRE` | `PNP`).
5. **Real Photographic Evidence & GPS Accuracy**: Whenever a civilian submits a report, the responder's HUD displays the genuine photo snapshot, exact coordinates, and GPS accuracy radius circle.

---

## 2. Agency Palette & Design Systems (`ui-ux-pro-max` & `frontend-design`)

Each branch features an authoritative, non-templated tactical HUD:

```
┌────────────────────────────────────────────────────────────────────────┐
│ RHU MEDIC CORPS      │ Base: #0a192f │ Primary: #0284c7 │ Accent: #38bdf8 │
│ BFP FIRE RESCUE      │ Base: #1a0f0a │ Primary: #ea580c │ Accent: #f97316 │
│ PNP POLICE FORCE     │ Base: #0a1128 │ Primary: #1d4ed8 │ Accent: #3b82f6 │
└────────────────────────────────────────────────────────────────────────┘
```

* **No generic SaaS cards**: Replaced by bevel-bordered tactical HUD panels with high-contrast mono readouts, status beacons, and active-state border glows.
* **Haptic/Visual feedback**: 150ms active scale transitions (`active:scale-95`), glowing status badges, and contextual modal drawers.

---

## 3. Detailed Module Breakdown & Click Interactions

### A. RHU MEDIC (Rural Health Unit / Emergency Medical Services)

#### 1. `EmsTraumaDashboard.tsx` (Route: `/responder/dashboard` when `unit === 'RHU'`)
* **Purpose**: Primary pre-hospital triage console and incoming casualty command feed.
* **Contains**:
  - **Tactical Field Status Bar**: `AVAILABLE` | `EN ROUTE (SIRENS ON)` | `ON SCENE` | `TRANSPORTING TO ER` | `RETURNING`.
  - **START Triage KPI Bar**: Live counts of `Immediate (Red)`, `Delayed (Yellow)`, `Minor (Green)`, `Expectant (Black)`.
  - **Live Dispatch Map HUD**: Leaflet satellite map showing civilian emergency pins with pulsing red beacons.
  - **Priority Incident Queue**: Card feed of active medical SOS calls.
* **Click Behaviors**:
  - **Click Incident Card**: Opens `CivilianEvidenceModal` with full-resolution accident photo, civilian phone number, exact GPS coordinates, and chief complaint.
  - **Click "Launch GPS Route ↗"**: Launches external GPS routing with turn-by-turn navigation directly to the patient's coordinates.
  - **Click "START Triage Tag" Button**: Toggles quick casualty triage classification, updating report severity in the database.
  - **Click Status Button (`ON SCENE` / `TRANSPORTING`)**: Updates responder unit status in SQL Server and notifies LDRRMO Central Command.

#### 2. `PatientCareRecordPage.tsx` (Route: `/responder/my-reports` or `/responder/pcr`)
* **Purpose**: Digital Pre-Hospital Care Record (PCR) and clinical vital signs logger.
* **Contains**:
  - **Patient Demographic Intake**: Age, estimated weight, gender, level of consciousness (AVPU / GCS).
  - **Vital Signs Matrix**: Blood Pressure (Systolic/Diastolic), Heart Rate (BPM), Respiratory Rate, $\text{SpO}_2$ (%), Blood Glucose (mg/dL).
  - **Interventions Checklist**: Oxygen therapy (LPM via Mask/Cannula), Cervical collar applied, CPR cycle counter, IV fluid bolus, Wound packing/tourniquet.
  - **Injury Anatomical Locator**: Interactive body diagram to click and flag injury sites (Head, Chest, Abdomen, Extremities).
* **Click Behaviors**:
  - **Click Anatomical Region**: Drops an injury marker with a severity tag (Laceration, Fracture, Burn, Penetrating).
  - **Click "Log Vitals"**: Appends timestamped vital sign entry to the patient's active electronic record.
  - **Click "Generate Transfer Handoff"**: Produces an encrypted summary token to be scanned or received by the hospital triage nurse.

#### 3. `HospitalBedRadarPage.tsx` (Route: `/responder/hospital-radar` or `/responder/alerts`)
* **Purpose**: Real-time hospital ER receiving radar and trauma bay bed coordination.
* **Contains**:
  - **Hospital Facilities Grid**: Zamboanga del Norte Medical Center (ZNMC), Dipolog City RHU Main, Corazon C. Aquino Memorial Hospital.
  - **Real-Time ER Metrics**: Trauma Bay Occupancy, Available Ventilators, Blood Bank Status (O-Negative Reserve), Divert Status (Open / Full).
  - **Direct Radio/Line Hotline**: Emergency room dispatch phone numbers.
* **Click Behaviors**:
  - **Click "Notify Incoming Patient"**: Sends pre-arrival alert to the selected ER with patient GCS, estimated ETA (mins), and injury type.
  - **Click "Call ER Hotline"**: Initiates direct tel link to hospital trauma charge nurse.

#### 4. `MedicCrewRosterPage.tsx` (Route: `/responder/roster`)
* **Purpose**: Ambulance crew readiness, medical certifications, and shift check-in.
* **Contains**:
  - **Active Ambulance Roster**: Call signs (`MEDIC-01`, `MEDIC-02`), vehicle status, driver, and paramedic cadre.
  - **Crew Dossiers**: PRC Medical/Nursing license numbers, BLS/ACLS/PHTLS certification expiration dates.
* **Click Behaviors**:
  - **Click "Shift Check-In"**: Logs paramedic into active duty on the selected ambulance rig.
  - **Click "View Crew Member"**: Opens modal showing verified statutory PRC license details and emergency contact.

---

### B. BFP FIRE RESCUE (Bureau of Fire Protection)

#### 1. `FireCommandDashboard.tsx` (Route: `/responder/dashboard` when `unit === 'FIRE'`)
* **Purpose**: Fire ground command center, structural alarm escalation, and engine tracking.
* **Contains**:
  - **Alarm Level Escalation Selector**: `1st Alarm` (Barangay) | `2nd Alarm` (District) | `3rd to 5th Alarm` | `Task Force Alpha` | `General Alarm`.
  - **Tactical Field Status Bar**: `IN QUARTERS` | `EN ROUTE (ROLLING)` | `ON SCENE (PUMPING)` | `CONTAINED` | `OVERHAUL`.
  - **Active Fire Ground Feed**: Structural fires, vehicular blazes, grass fires, and hazmat calls.
  - **Water Supply Overview**: Fleet water reserves (Total Gallons available on scene).
* **Click Behaviors**:
  - **Click "Escalate Alarm Level"**: Prompts for confirmation and broadcasts municipal mutual-aid alert to neighboring fire substations and LDRRMO.
  - **Click Incident Card**: Displays civilian smoke/fire photo evidence, building construction type (Residential / Commercial / Industrial), and trapped occupant count.
  - **Click "Launch Water Route ↗"**: Navigates apparatus directly to the incident ground.

#### 2. `HydrantTacticalMapPage.tsx` (Route: `/responder/hydrants`)
* **Purpose**: Interactive GIS water asset radar for locating municipal hydrants and static water tenders.
* **Contains**:
  - **Leaflet Hydrant Map**: Color-coded hydrant pins based on NFPA/BFP flow rates:
    - **Blue (Class AA)**: $\ge 1,500$ GPM (Commercial/High Pressure)
    - **Green (Class A)**: $1,000 - 1,499$ GPM
    - **Orange (Class B)**: $500 - 999$ GPM
    - **Red (Class C)**: $< 500$ GPM
  - **Static Water Sources**: Dipolog river suction points, water utility storage tanks, private swimming pool easements.
* **Click Behaviors**:
  - **Click Hydrant Pin**: Opens popup showing Hydrant ID, exact street corner, static pressure (PSI), last flow test date, and operational status (Operable / Out of Service).
  - **Click "Set Booster Relay"**: Calculates hose distance in meters from the hydrant to the active fire engine.

#### 3. `ApparatusTelemetryPage.tsx` (Route: `/responder/apparatus` or `/responder/roster`)
* **Purpose**: Fire apparatus fleet readiness, water tank levels, and pump mechanics.
* **Contains**:
  - **Engine Fleet Cards**: Engine 01 (Pumper), Engine 02 (Water Tender 2,500 Gal), Ladder 01 (Aerial).
  - **Dynamic Tank Gauge**: Real-time water volume slider (100% Full down to 0% Empty).
  - **Pump Telemetry**: Discharge pressure (PSI), intake suction, foam proportioner ratio (1% / 3% / 6%).
* **Click Behaviors**:
  - **Click "Report Water Tank Level"**: Updates live water percentage so Incident Commander knows when water supply is low.
  - **Click "Log Equipment Check"**: Logs SCBA air pack pressure (4,500 PSI), nozzle inventory, and hydraulic cutter readiness.

#### 4. `HazmatGuidebookPage.tsx` (Route: `/responder/hazmat`)
* **Purpose**: Emergency Response Guidebook (ERG) chemical lookup and toxic plume safety.
* **Contains**:
  - **4-Digit UN/NA Search Bar**: Rapid search by chemical ID or substance name (e.g., `1203` Gasoline, `1005` Ammonia).
  - **Hazard Diamond (NFPA 704)**: Health, Flammability, Instability, Special hazards.
  - **Isolation Distances**: Initial isolation distance (meters/feet) and downwind protective action zone.
* **Click Behaviors**:
  - **Click Chemical Result**: Renders evacuation perimeter overlay on the tactical map centered on the incident coordinates.
  - **Click "View First Aid & PPE"**: Displays recommended turnout gear, SCBA requirements, and emergency medical antidote.

#### 5. `FireAarReportsPage.tsx` (Route: `/responder/my-reports`)
* **Purpose**: Post-fire investigation and After-Action Review (AAR) logging.
* **Contains**:
  - **Fire Incident Report (FIR) Generator**: Time fire out declared, origin area, structural damage estimate (PHP), civilian/firefighter injuries.
  - **Arson Investigation Notes**: Burn pattern analysis, electrical breaker photos, flammable liquid pour pattern indicators.

---

### C. PNP POLICE FORCE (Philippine National Police)

#### 1. `PolicePatrolDashboard.tsx` (Route: `/responder/dashboard` when `unit === 'PNP'`)
* **Purpose**: Law enforcement patrol dispatch hub, 911 crime feed, and sector emergency coordination.
* **Contains**:
  - **Tactical Field Status Bar**: `IN QUARTERS / STATION` | `ON MOBILE PATROL` | `RESPONDING (CODE 3)` | `ON SCENE (SECURING)` | `PROCESSING BLOTTER`.
  - **Officer Distress Beacon (SOS)**: Dedicated high-priority "OFFICER DOWN" emergency distress button.
  - **Crime & Security Dispatch Queue**: Vehicular crashes, armed robbery, public disturbance, domestic violence, and suspicious persons.
  - **Sector Patrol GPS Map**: Police car / motorcycle beat positions and active crime pins.
* **Click Behaviors**:
  - **Click "OFFICER DISTRESS BEACON (SOS)"**: Pops up instant 5-second countdown with sound beacon; broadcasting emergency distress signal to LDRRMO and all mobile units.
  - **Click Incident Card**: Inspects civilian crime snapshot, suspects description, weapon involvement flag, and exact location.
  - **Click "Launch GPS Intercept ↗"**: Generates navigation route with live coordinate tracking.

#### 2. `PoliceBlotterPage.tsx` (Route: `/responder/blotter` or `/responder/my-reports`)
* **Purpose**: Digital Philippine Police Blotter entry ledger.
* **Contains**:
  - **Official Blotter Entry Form**:
    - **Incident Classification**: Revised Penal Code (RPC) offense or Special Penal Law (e.g., Physical Injuries, Robbery/Theft, RA 9262, Traffic Reckless Imprudence).
    - **Parties Involved**: Complainant / Victim, Suspect / Person of Interest, Witnesses.
    - **Narrative Statement**: Detailed chronological recounting of facts.
    - **Investigating Officer**: Rank, Name, Badge Number, Station.
* **Click Behaviors**:
  - **Click "File Blotter Entry"**: Validates and cryptographically seals the blotter record in SQL Server with an immutable entry number (`BLOTTER-2026-XXXX`).
  - **Click "Export Blotter Extract (PDF)"**: Generates an official certifiable blotter extract for court or insurance filing.

#### 3. `TacticalPerimeterMapPage.tsx` (Route: `/responder/perimeter`)
* **Purpose**: Crime scene cordon, traffic blockade, and checkpoint geofencing.
* **Contains**:
  - **Interactive Cordon Tool**: Drop Inner Cordon (Hot Zone - SOCO/Forensics only), Outer Cordon (Command post & media), and Traffic Diversion points.
  - **Barangay Checkpoints**: Status of Dipolog entry/exit checkpoints (Active / Standby / Alert).
* **Click Behaviors**:
  - **Click "Establish Cordon"**: Sets a perimeter radius around incident coordinates on the map.
  - **Click "Log Road Blockade"**: Flags street as closed in the civilian portal traffic feed.

#### 4. `EvidenceVaultPage.tsx` (Route: `/responder/evidence`)
* **Purpose**: Chain of custody logging and photographic evidence vault.
* **Contains**:
  - **Evidence Tag Registry**: Item description, seizure location, recovering officer badge, storage locker.
  - **Chain of Custody Timeline**: Chronological log of who handled, transferred, or tested the evidence.
* **Click Behaviors**:
  - **Click "Tag New Evidence"**: Captures photo of recovered firearm/casings/contraband and logs tamper-evident hash.
  - **Click "Transfer Custody"**: Records transfer of custody to Crime Lab / Prosecutor's Office.

#### 5. `PolicePatrolRosterPage.tsx` (Route: `/responder/roster`)
* **Purpose**: Shift assignments, patrol car call signs, and sidearm serial verification.
* **Contains**:
  - **Beat Patrol Duty Board**: Mobile Patrol Car 01 (`ALPHA`), Motorcycle Beat 03 (`BRAVO`), Foot Patrol Officers.
  - **Armory & Duty Gear Check**: Duty sidearm serial (`GLOCK 17 - S/N: XXXX`), body-worn camera serial and battery status.

---

## 4. Subagent Parallel Execution Squad (8 Specialists)

Once approved, execution will proceed with 8 specialized subagents in parallel with strictly segregated, non-overlapping file scopes:

| Subagent | Role Title | Strict File Scope & Responsibility |
| :--- | :--- | :--- |
| **Subagent 1** | **Dynamic Routing & Layout Architect** | `Sidebar.tsx`, `ResponderLayout.tsx`, `App.tsx`, `RespondersPanel/index.ts`. Implements dynamic agency sub-routing, sidebar menu updates, and role navigation. |
| **Subagent 2** | **RHU Medic Domain Specialist** | `EmsTraumaDashboard.tsx`, `PatientCareRecordPage.tsx`, `HospitalBedRadarPage.tsx`, `MedicCrewRosterPage.tsx`, `MedicProfilePage.tsx`. |
| **Subagent 3** | **BFP Fire Rescue Domain Specialist** | `FireCommandDashboard.tsx`, `HydrantTacticalMapPage.tsx`, `ApparatusTelemetryPage.tsx`, `HazmatGuidebookPage.tsx`, `FireAarReportsPage.tsx`, `FireApparatusRosterPage.tsx`. |
| **Subagent 4** | **PNP Police Force Domain Specialist**| `PolicePatrolDashboard.tsx`, `PoliceBlotterPage.tsx`, `TacticalPerimeterMapPage.tsx`, `EvidenceVaultPage.tsx`, `PolicePatrolRosterPage.tsx`, `OfficerArmoryProfilePage.tsx`. |
| **Subagent 5** | **Shared Tactical HUD & GPS Telemetry**| `TacticalFieldStatusBar.tsx`, `CivilianEvidenceModal.tsx`, `SatelliteCommandMap.tsx` enhancements (hydrant & beat overlays, turn-by-turn nav links). |
| **Subagent 6** | **Backend API & Database Telemetry** | `ResponderOpsController.cs`, `IServices.cs`, `Services.cs`, `ResponderOpsDtos.cs`. Extends endpoints for PCR vitals, hydrant data, blotter records, and alarm stages. |
| **Subagent 7** | **UI/UX Pro Max & Frontend Design** | Layout styles, bespoke agency CSS color tokens (`MainLayout.css`), haptic click animations, dark-mode contrast checks, and responsive layouts. |
| **Subagent 8** | **3-Phase Verification & QA Officer** | Runs Phase 1 (Frontend TypeScript + Vite build), Phase 2 (Backend .NET 10 build & API contracts), and Phase 3 (Zero-static audit, empty baseline checks, git staging). |

---

## 5. Verification Plan (3 Distinct Phases)

In compliance with `superpowers:verification-before-completion`:

### Phase 1: Frontend Build & Type Integrity
* **Command**: `cd "Project system ENGINE/Frontend"; npm run build` (`tsc -b && vite build`)
* **Pass Criteria**: 0 TypeScript compilation errors, 0 linting failures, bundle generated cleanly under 2.5s.

### Phase 2: Backend .NET 10 Build & API Verification
* **Command**: `cd "Project system ENGINE/Backend"; dotnet build`
* **Pass Criteria**: 0 warnings, 0 errors, all C# lambda expressions (`=>`) compile cleanly.

### Phase 3: Zero-Static & Functional Verification
* **Checklist**:
  - [ ] Every new page renders real database telemetry or clean $N=0$ empty state (no `|| 12` fallbacks).
  - [ ] Logging in as RHU Medic loads `EmsTraumaDashboard` and EMS sidebar items.
  - [ ] Logging in as BFP Fire loads `FireCommandDashboard` and Fire sidebar items.
  - [ ] Logging in as PNP Police loads `PolicePatrolDashboard` and Police sidebar items.
  - [ ] Civilian evidence photo and exact GPS coordinates are rendered in the responder inspection modal.
  - [ ] "Launch GPS Route ↗" triggers valid Google Maps navigation URL with destination coordinates.
  - [ ] Git commit created with descriptive message and clean working tree.
