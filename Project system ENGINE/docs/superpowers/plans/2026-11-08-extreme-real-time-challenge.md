# Real-Time Strict Extreme Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a 100% verified, zero-regression client-side on-device Philippine Driver's License OCR text extraction with PascalCase indication mapping, dynamic DOB-to-Age auto-fill, stable draggable tactical map modal card, and compliant .NET 10 Vertical Slice backend.

**Architecture:** 
1. Client-side Web Worker vision pipeline extracting rectified ISO/IEC 7810 ID-1 cards, suppressing guilloche noise, and targeting calibrated sub-label value ROIs.
2. Spatial PascalCase indication parser mapping TitleCase headers to ALL-CAPS credentials with dynamic DOB-to-Age auto-calculation.
3. React draggable tactical map card hook (`useDraggable`) with viewport boundary clamping and zero-shake camera positioning.
4. ASP.NET Core .NET 10 Layered Vertical Slice backend with 100% single-responsibility files and universal lambda expressions (`=>`).

**Tech Stack:** React 19, TypeScript 5.7, Vite, Tailwind CSS, Leaflet Geospatial Satellite Map, .NET 10 ASP.NET Core Web API, Entity Framework Core 10.

**Spec:** `incident-ai-id-ocr-vision` and `KATIPUNEROS SKILL.MD`.

## Global Constraints

- 100% deterministic on-device client execution for ID OCR and biometric processing.
- Zero consonant soup strings (`LRNSCDCDJNLL`, `MRQZMM`, `-MMM XO`, `OFTHI`) allowed into user form fields.
- Date of Birth must always auto-populate Age (`today.getFullYear() - birthDate.getFullYear()`).
- Map tactical popup modal must be draggable via global `useDraggable` and never clipped by container boundaries.
- Backend code must strictly follow 1 class per file, 1 interface per file, and 100% universal lambdas (`=>`).
- Zero emojis in code, logs, and artifacts.

---

### Task 1: OCR Spatial Indication Engine & PascalCase Parser Verification

**Files:**
- Modify: `Frontend/src/Libs/Vision/idScanner/textExtractor.ts`
- Modify: `Frontend/src/Libs/Vision/idScanner/idSpecs.ts`
- Modify: `Frontend/src/Libs/Vision/idScanner/validators.ts`
- Test: `Frontend/src/Libs/Vision/idScanner/__tests__/pascalCaseExtractor.test.ts`

**Interfaces:**
- Consumes: Raw OCR lines, Rectified ID canvas/bitmap, ID template field specs.
- Produces: `ExtractedIdData` with cleaned `firstName`, `middleName`, `lastName`, `birthDate`, `sex`, `weight`, `height`, `address`, `idNumber`.

- [ ] **Step 1: Write the failing unit test**
Validate extraction of `SUICO, JHONMARK AMACA`, `2004/02/20`, `PHL`, `M`, `52`, `1.71`, `-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110`, and `J07-22-302560`.
- [ ] **Step 2: Run test to verify it fails**
Run test suite and assert failure when consonant noise is fed.
- [ ] **Step 3: Implement minimal fix**
Calibrate ROI offsets and enforce PascalCase header value pairing.
- [ ] **Step 4: Run test to verify it passes**
Ensure 100% tests pass.

---

### Task 2: Registration Page Dynamic DOB-to-Age Auto-Fill

**Files:**
- Modify: `Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage.tsx`
- Test: `Frontend/src/LANDING_PAGE/Features/Pages/RegisterPage/__tests__/ageCalculation.test.ts`

**Interfaces:**
- Consumes: `birthDate` string (`YYYY/MM/DD`).
- Produces: `age` number state update.

- [ ] **Step 1: Write failing age calculation test**
Test DOB `2004/02/20` yields expected age (e.g. 22).
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement auto-population in RegisterPage**
- [ ] **Step 4: Verify test passes**

---

### Task 3: Map Camera Stability & Draggable Modal Card

**Files:**
- Modify: `Frontend/src/Shared/SatelliteCommandMap.tsx`
- Verify: `Frontend/src/Hooks/useDraggable.ts`

**Interfaces:**
- Consumes: Marker click event, viewport bounds.
- Produces: Smooth center without camera jitter; drag movement via pointer events.

- [ ] **Step 1: Verify viewport comfort threshold**
Skip `panTo` when marker is in comfortable visible zone.
- [ ] **Step 2: Enforce scrollbar-width none !important**
Eliminate default white scrollbars.
- [ ] **Step 3: Test modal card dragging**
Ensure card translates smoothly without leaving map container.

---

### Task 4: Backend Vertical Slice & Micro-Slice Compliance

**Files:**
- Create: Discrete model files in `Backend/Features/Data/Models/`
- Create: Discrete interface files in `Backend/Features/Services/Interfaces/`
- Verify: `dotnet build Backend.csproj`

- [ ] **Step 1: Decompose any remaining multi-class files**
- [ ] **Step 2: Enforce universal lambda expressions (`=>`) across all methods**
- [ ] **Step 3: Build backend and verify 0 warnings, 0 errors**
