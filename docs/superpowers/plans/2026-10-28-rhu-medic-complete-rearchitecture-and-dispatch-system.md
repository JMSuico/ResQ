# RHU Medic Complete Re-Architecture & Dispatch System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:dispatching-parallel-agents` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 100% of the user's RHU Medic Responder Portal plan without altering a single idea, title, category, or flow across `EMS TRAUMA BOARD`, `CASUALTY FIELD DISPATCHES`, `REQUEST & DEPLOY`, `AMBULANCE CREW`, `INCIDENT LOGS`, `HEADER NOTIFICATION BELL`, `PROFILE SETTINGS`, and `Obsidian Memory Engine/Diagram/`.

**Architecture:**
- **Strict Katipuneros Full-Stack Compliance**: Universal `=>` arrow lambdas, global `@/Shared` and `@/Hooks` imports (`SearchBar`, `useDebounce`, `TableCardToggle`, `Pagination`, `DefaultFloatingModalCard`, `RadioButton`), pure `lucide-react` icons only, and zero-static telemetry ($N=0$ safe).
- **Obsidian Diagram Vault (`Obsidian Memory Engine/Diagram/`)**: Stores `/diagram-design` flowcharts, sequence flows, state machines, mathematical formulas, and CRUD connectivity matrices, referenced via pointer sections in `SKILL.md`, `AGENTS.md`, and `README.md`.

---

## 8-Subagent Parallel Execution Matrix (`superpowers:dispatching-parallel-agents`)

| Subagent # | Role Title | Assigned Tasks & Target Files |
| :--- | :--- | :--- |
| **Subagent 1** | **EMS Trauma Board & Status Modal Specialist** | `ResponderDashboard.tsx` (Tasks 1, 2, 3, 8), `Shared/StatusConfirmModal.tsx` |
| **Subagent 2** | **16-Category Radar HUD & 5-Min Timer Specialist** | `SatelliteCommandMap.tsx`, `Shared/radarPointerCategories.ts` (Tasks 4, 5, 6, 7, 7.1) |
| **Subagent 3** | **Casualty Dispatches, Backup & 40-Img Lightbox Specialist** | `UnitIncidentsFeed.tsx`, `Shared/ImageLightboxModal.tsx`, `Shared/BackupOptionsModal.tsx`, `Shared/PatientCareRecordModal.tsx` (Casualty Tasks 1, 2, 3, 4, 5) |
| **Subagent 4** | **Request & Deploy Module Specialist** | `RequestDeployPage.tsx`, `Endpoints/responderOpsApi.ts`, `App.tsx` (`/responder/request-deploy`) |
| **Subagent 5** | **Ambulance Crew Hierarchy & Roster Specialist** | `DutyRosterView.tsx` (Medic-only colleague leaderboard + Head Chief to Member org hierarchy + status toggles) |
| **Subagent 6** | **Incident Logs & 5-Min Auto-Close Specialist** | `MyReportsPage.tsx` (Rename from `PATIENT LOGS` to `INCIDENT LOGS`, 4 lifetime KPIs, 5-min auto-close listener) |
| **Subagent 7** | **Header Notification Bell & Profile Settings Specialist** | `Sidebar.tsx`, `Header.tsx` (Remove `HOSPITAL ER ALARMS` from sidebar and merge into Bell), `ResponderProfile.tsx` (Rename to `PROFILE SETTINGS`, remove static summary blocks, add RadioButton switches for pale/hidden non-medic pointers) |
| **Subagent 8** | **Obsidian Diagram & Pointer Governance Specialist** | `Obsidian Memory Engine/Diagram/*`, `SKILL.md`, `AGENTS.md`, `README.md`, `Obsidian Memory Engine/index.md`, `Obsidian Memory Engine/log.md` |

---

## Detailed Task Breakdown (Preserving 100% of User Specifications)

### Section A: `EMS TRAUMA BOARD` (`ResponderDashboard.tsx`)
- [x] **Task 1 — Header Identity & Availability Banner**:
  - Rearrange header to display `RHU EMERGENCY MEDICAL SERVICES`, Responder Full Name (`Dr. Maria Clara Santos MD`), `SECTOR: Rural Health Unit 1 . HARDWARE LINK OK`, actual availability status badge (`AVAILABLE FOR DISPATCH`), and rank (`[Medical Officer III]`).
  - Formula saved in `Obsidian Memory Engine/Diagram/FORMULAS_RHU_TELEMETRY.md`.
- [ ] **Task 2 — Field Readiness State Selector (`1. AVAILABLE`, `2. EN ROUTE`, `3. ON SCENE`, `4. RETURNING`)**:
  - Clicking any button opens a floating confirmation modal (`DefaultFloatingModalCard` / `StatusConfirmModal`) asking `"DO YOU WANT TO CHANGE STATUS?"` with `YES`, `NO`, and `EXIT` buttons, plus caution notice: `"CAUTION: THIS CHANGE WILL BE SEEN IN THE ADMIN."`
- [ ] **Task 3 — Responder Status & Stats Display Values**:
  - Display KPI blocks tracking how many times the responder was selected/dispatched, assigned to a unit, handled critical incidents, and resolved missions with unit assets/teams:
    - `ACTIVE DISPATCHES` (`1 DISPATCHED`, `PRIORITY ACTION QUEUE`)
    - `RESOLVED MISSIONS` (`SECURE`, `OF 1 DISPATCHES`, `RESOLUTION RATE`)
    - `LIFE-THREAT ALERTS` (`TOTAL: 1`, `CRITICAL INCIDENTS`, `100% READY`, `IMMEDIATE TRIAGE`)
    - `ASSIGNED UNITS` (`3 ONLINE UNITS`, `MUNICIPAL RESPONSE FORCE`)
  - Formula saved in `Obsidian Memory Engine/Diagram/FORMULAS_RHU_TELEMETRY.md`.
- [ ] **Task 4 — Satellite Command Radar HUD (16 Incident Category Pointers)**:
  - **9 View-Only Non-Medic Categories** (visible on map, Medics cannot request to dispatch):
    1. Vehicle 4 wheel or more wheels accident
    2. Motor accident
    3. Vehicular accidents involve many vehicle like motor and 4 wheels
    4. Road rage
    5. Carnapping and motornapping
    6. Road checkpoints
    7. Suicide
    8. Homicide
    9. Genocide
  - **7 Medic-Allowed Categories** (Medics CAN request and sort):
    10. Minor injuries
    11. First aiding
    12. Hospital emergency
    13. Critical conditions
    14. Under medical care
    15. Dead body
    16. On safe healing
- [ ] **Task 5 — Medic Pointer Sorting & Pale Color Indication**:
  - Sort buttons: `SORT / ALL` (shows all pointers including non-assigned jobs) and `SORT / FOR MEDICS` (shows only medic pointers whether pale color is enabled or disabled).
  - Button to make non-medic pointers **pale** (`opacity: 0.35`, desaturated) indicating they are not the medic's assigned jobs, while medic pointers remain vibrant level colors.
  - Option to completely hide/remove pale non-assigned pointers (controlled via radio switch in `PROFILE SETTINGS`).
- [ ] **Task 6 — Dynamic Centered Modal & Request to Dispatch/Deploy Redirect**:
  - Clicking a pointer opens a modal dynamically adjusting left/right/up/down to stay centered in the middle, with a `"REQUEST TO DISPATCH OR DEPLOY"` button (for the 7 Medic categories) that smoothly redirects to `"REQUEST & DEPLOY"` (`/responder/request-deploy`).
- [ ] **Task 7 — Pointer Click Summary Details & 5-Minute Closing Timer**:
  - Displays summary details with Picture Evidence, IP Address, GPS Location, and Street Address pointing to the UI Pointer Icon.
  - **5-Minute Loading Timer**: After Admin manual verification or System AI verification, a 5-minute countdown loading timer animates on the pointer and declares the case closed (`100% SOLVED`, pointer fades out) when it reaches `00:00`.
- [ ] **Task 7.1 — Expand Map Floating Modal**:
  - Button to expand the map into a full-view `DefaultFloatingModalCard` displaying the flow map with an `EXIT` button.
- [ ] **Task 8 — Priority Incident Dispatch Queue**:
  - Displays priority-sorted dispatch queue (`1 PENDING ACTION`, `RESQ-20261020-001`, etc.) using global `@/Shared` and `@/Hooks` (`SearchBar` with `useDebounce`, sort/filter, `TableCardToggle`, `Pagination`, and `DefaultFloatingModalCard` showing full incident details on click).

### Section B: `CASUALTY FIELD DISPATCHES` (`UnitIncidentsFeed.tsx`)
- [ ] **Task 1 — Rename & Header Cleanup**:
  - Eyebrow: `RHU EMERGENCY MEDICAL SERVICES`
  - Rename title from `"Tactical Field Incident Dispatches"` to `"CASUALTY FIELD DISPATCHES"`.
  - Remove subtitle `"Active operational assignments allocated to RHU tactical response force"`.
- [ ] **Task 2 — Backend-Connected Sort/Filter Tabs & Global Shared UI**:
  - `ALL DISPATCHES (1)`, `CRITICAL / SEVERE (0)`, `ACTIVE QUEUE (1)`, `RESOLVED`.
  - Uses `@/Shared` and `@/Hooks` (`SearchBar` with `useDebounce`, sort/filter, `TableCardToggle`, `Pagination`, `DefaultFloatingModalCard` on item click).
- [ ] **Task 3 — `NAVIGATE GPS` Redirect & 3-Option `CALL BACKUP` Modal**:
  - Clicking `NAVIGATE GPS` redirects smoothly to `EMS TRAUMA BOARD` and opens the Expanded Map Modal (`DefaultFloatingModalCard`) pointing directly to the exact incident UI pointer icon.
  - Clicking `CALL BACKUP` opens a modal with 3 options:
    1. Recommend request backup via requesting in Admin so Admin can dispatch request.
    2. Send distress signal for all nearby responders (Medic or Non-Medic responders).
    3. Send via call number or email.
- [ ] **Task 4 — 40-Image Timestamped `EVIDENCE` Lightbox Modal**:
  - Clicking `EVIDENCE` opens a shared floating modal card displaying pictures/videos (supporting up to 40 images) with exact date and time including seconds and AM/PM (`YYYY-MM-DD hh:mm:ss A`).
- [ ] **Task 5 — Multi-Casualty PCR Vitals, `RESPONDED` Green Pin & `SUBMIT REPORT`**:
  - Keep injured person identity inputs intact in PCR modal; add `"ADD NEW PCR VITAL"` button to record multiple injured persons/civilians.
  - Replace `"DEPLOY ROUTE"` with `"RESPONDED"` button that marks the incident location as responded and turns its map pointer **GREEN**.
  - Add `"SUBMIT REPORT"` button to submit all evidences and casualties to Admin and place the submitted report in `"INCIDENT LOGS"` (renamed from `"PATIENT LOGS"`).
  - Once Admin confirms/verifies the responded location is done, the 5-minute countdown loading timer animates on the green pointer; when empty, it fades out as 100% done and solved.

### Section C: `REQUEST & DEPLOY` (`RequestDeployPage.tsx`)
- [ ] **Task 1 — New Sidebar Menu & Module Page `"REQUEST & DEPLOY"`**:
  - Uses `@/Shared` and `@/Hooks` (`SearchBar` with `useDebounce`, sort/filter, `TableCardToggle`, `Pagination`, `DefaultFloatingModalCard`).
  - Medic-initiated dispatch requests show as `PENDING` until approved by Admin $\rightarrow$ state becomes `DEPLOY`.
  - Admin-initiated deployment requests to the Medic show `ACCEPT` and `DECLINE` buttons with indication `TO BE DEPLOYED`.

### Section D: `AMBULANCE CREW` (`DutyRosterView.tsx`)
- [ ] **Task 1 — Medic-Only Leaderboard & Organizational Structure**:
  - Shows only duty colleague Medic responders (leaderboard style) + Organization Structure from **Head Chief** to **Member**.
  - Toggle buttons to sort/filter who is `Active / Available`, `Being Dispatched`, `Standby`, and `Off Duty` + colleague name search using `@/Shared` and `@/Hooks`.

### Section E: `INCIDENT LOGS` (`MyReportsPage.tsx` — Renamed from `"PATIENT LOGS"`)
- [ ] **Task 1 & 2 — Rename to `"INCIDENT LOGS"` & 4 Lifetime KPI Blocks**:
  - KPI blocks: `TOTAL LOGGED` (`LIFETIME LOGS` / `REPORTS`), `ACTIVE IN ACTION` (`ACTIVE` / `ONGOING OPERATIONS`), `VERIFIED ACTIONED` (`VERIFIED` / `VALIDATED EVIDENCE`), `RESOLVED MISSIONS` (`CLOSED` / `SUCCESSFUL RESOLUTION`).
  - Tracks submitted reports, active responses, verified logs, and closed cases after the 5-minute loading timer.

### Section F: `HOSPITAL ER ALARMS` $\rightarrow$ Header Notification Bell (`Header.tsx` & `Sidebar.tsx`)
- [ ] **Task 1 — Remove `"HOSPITAL ER ALARMS"` Module & Merge into Header Bell**:
  - Remove `"HOSPITAL ER ALARMS"` from the sidebar menu and routes.
  - Consolidate notifications into the Header Notification Bell icon for all 6 events:
    1. Request Dispatch Deploy
    2. Admin Requests You to Deploy
    3. Incident Happens On
    4. Submitted Incident Logs
    5. Verified Submitted Incident Logs
    6. Close Case

### Section G: `PROFILE SETTINGS` (`ResponderProfile.tsx` — Renamed from `"MEDIC CREDENTIALS"`)
- [ ] **Task 1 — Rename to `"PROFILE SETTINGS"`, Remove Static Blocks & Add Pointer Radio Switches**:
  - Keep credentials and profile picture upload intact.
  - Remove static blocks (`"Biometric verification record..."`, `RESOLVED MISSIONS 0`, `TOTAL LOGGED: 1`, `ACTIVE DISPATCHES 1`, `CRITICAL RESPONSES`, `CURRENT DUTY STATE Standby 6 CREW M`).
  - Add `@/Shared/RadioButton` switches to control pale color pointer indication vs making non-medic pointers invisible when sorted.

### Section H: Obsidian `Diagram/` Vault & Governance Pointers
- [x] Create `Obsidian Memory Engine/Diagram/` with Markdown flowcharts, sequence diagrams, formulas, and CRUD matrices.
- [ ] Update `SKILL.md`, `AGENTS.md`, and `README.md` files as authoritative pointers to `Obsidian Memory Engine/Diagram/`.
