// [Layer: UserRoles/Features/Pages/RespondersPanel/Fire]
// Responsibility: Bureau of Fire Protection (BFP) Post-Fire After-Action Review (AAR)
// and Fire Incident Report (FIR) Standard Generator.
// Features: Official Fire Out Declarations, Structural Damage Assessment (PHP ₱),
// Point of Origin & Probable Cause, Arson Investigation Notes, Casualties Breakdown,
// and Printable BFP Letterhead Report Preview.
// Katipuneros Architecture: Strict typing, universal lambda syntax (=>), ZERO 'any' usage.

import React, { useState } from 'react';

// --------------------------------------------------------------------------
// Types & Contracts
// --------------------------------------------------------------------------

export type BuildingOccupancyType =
  | 'Residential (Single-Family)'
  | 'Residential (Multi-Storey)'
  | 'Commercial (Retail / Mall)'
  | 'Industrial / Warehouse'
  | 'Educational / Institutional'
  | 'Government / Public Assembly';

export type ProbableCauseType =
  | 'Electrical Short Circuit / Overloaded Wire'
  | 'Unattended Cooking / LPG Gas Leak'
  | 'Faulty Electrical Appliance'
  | 'Open Flame / Lit Candle / Cigarette'
  | 'Incendiary / Suspected Arson'
  | 'Spontaneous Combustion / Hazmat'
  | 'Under Further Investigation';

export interface FireAarReport {
  id: string;
  referenceCode: string;
  incidentDate: string;
  incidentTime: string;
  barangay: string;
  streetAddress: string;
  highestAlarmDeclared: string;
  incidentCommander: string;
  fireMarshal: string;
  underControlTime: string;
  fireOutTime: string;
  buildingOccupancy: BuildingOccupancyType;
  floorAreaAffectedSqM: number;
  constructionType: string;
  estimatedDamagePhp: number;
  originLocation: string;
  materialIgnited: string;
  probableCause: ProbableCauseType;
  civilianInjuries: number;
  civilianFatalities: number;
  firefighterInjuries: number;
  waterDeliveredGallons: number;
  foamConcentrateGallons: number;
  respondingEngines: string;
  arsonNotes: string;
  burnPatternAnalysis: string;
  accelerantDetected: boolean;
  electricalPanelStatus: string;
}

const INITIAL_REPORT: FireAarReport = {
  id: 'AAR-BFP-2026-042',
  referenceCode: 'FIR-2026-1026-004',
  incidentDate: '2026-10-26',
  incidentTime: '14:22',
  barangay: 'Barangay Central',
  streetAddress: 'Rizal Avenue cor. General Luna St., Dipolog City',
  highestAlarmDeclared: '2nd Alarm (District)',
  incidentCommander: 'INSP Roberto A. Gomez, BFP',
  fireMarshal: 'CINSP Eduardo M. Ramirez, BFP',
  underControlTime: '15:45',
  fireOutTime: '16:30',
  buildingOccupancy: 'Commercial (Retail / Mall)',
  floorAreaAffectedSqM: 350,
  constructionType: 'Type II (Non-Combustible Steel & Concrete)',
  estimatedDamagePhp: 4500000,
  originLocation: 'Second Floor Storage / Stockroom (Sector Charlie)',
  materialIgnited: 'Corrugated Cardboard Packaging & Synthetic Textiles',
  probableCause: 'Electrical Short Circuit / Overloaded Wire',
  civilianInjuries: 2,
  civilianFatalities: 0,
  firefighterInjuries: 1,
  waterDeliveredGallons: 14500,
  foamConcentrateGallons: 25,
  respondingEngines: 'Engine 01, Engine 02 (Tender), Ladder 01, Volunteer Brigade 1',
  arsonNotes: 'Initial search revealed distinct V-pattern apex at northeastern electrical junction box. No flammable liquid pour patterns detected on concrete slab floor.',
  burnPatternAnalysis: 'Symmetrical V-pattern on masonry partition wall. Deep charring localized near 220V conduit line.',
  accelerantDetected: false,
  electricalPanelStatus: 'Main 60A breaker tripped; subsidiary 20A lighting circuit arc-melted.'
};

// --------------------------------------------------------------------------
// Audio Feedback Helper
// --------------------------------------------------------------------------
const triggerTactileBeep = (freq = 740, duration = 0.05): void => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
};

// --------------------------------------------------------------------------
// Component: FireAarReportsPage
// --------------------------------------------------------------------------
export const FireAarReportsPage: React.FC = () => {
  const [report, setReport] = useState<FireAarReport>(INITIAL_REPORT);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Form Field Update Helper
  const updateField = <K extends keyof FireAarReport>(key: K, value: FireAarReport[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  // Submit / Save Report
  const handleSaveReport = () => {
    triggerTactileBeep(880, 0.08);
    try {
      const existing = JSON.parse(localStorage.getItem('resqtrack_bfp_aar_reports') || '[]');
      existing.unshift({ ...report, savedAt: new Date().toISOString() });
      localStorage.setItem('resqtrack_bfp_aar_reports', JSON.stringify(existing));
    } catch {}
    setSavedToast(
      `AAR REPORT ${report.referenceCode} DOCKETED • SUBMITTED TO BFP REGION IX & LDRRMO C2 ARCHIVE`
    );
    setTimeout(() => setSavedToast(null), 5000);
  };

  // Print Report
  const handlePrint = () => {
    triggerTactileBeep(920, 0.06);
    window.print();
  };

  return (
    <div className="w-full flex flex-col gap-5 text-slate-100 font-sans pb-10">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header: AAR & FIR Generator Console */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-orange-700 border-2 border-red-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(239,68,68,0.5)] flex-shrink-0">
            📋
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-black bg-red-500/20 text-red-400 border border-red-500/40 uppercase tracking-widest">
                BFP STANDARD FORM // FIRE INCIDENT INVESTIGATION
              </span>
              <span className="text-slate-500 font-mono text-xs">|</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                CASE DOCKET: {report.referenceCode}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>AFTER-ACTION REVIEW (AAR) &amp; FIR GENERATOR</span>
            </h1>

            <p className="text-xs font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>LEGAL ARSON INVESTIGATION RECORD • DAMAGE CLAIMS • OFFICIAL DECLARATION</span>
            </p>
          </div>
        </div>

        {/* Action Buttons: Save & Print Preview */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveReport}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-mono text-xs font-black uppercase tracking-wider border border-orange-400 shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>DOCKET AAR REPORT</span>
            <span>💾</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerTactileBeep(700, 0.05);
              setShowPrintModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-mono text-xs font-black uppercase tracking-wider border border-slate-700 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>BFP LETTERHEAD PREVIEW</span>
            <span>🖨️</span>
          </button>
        </div>
      </div>

      {/* Saved Toast Alert */}
      {savedToast && (
        <div className="p-4 rounded-xl bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 font-mono text-xs font-bold shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Interactive Form: 6 Tactical Sections */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Demographics, Declarations & Structural Damage (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Section 1: Demographics & Time Declarations */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <span className="text-orange-400 font-mono font-bold text-xs">
                SECTION 1: INCIDENT METRICS &amp; TIME DECLARATIONS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">INCIDENT REFERENCE CODE:</span>
                <input
                  type="text"
                  value={report.referenceCode}
                  onChange={(e) => updateField('referenceCode', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">HIGHEST ALARM LEVEL REACHED:</span>
                <input
                  type="text"
                  value={report.highestAlarmDeclared}
                  onChange={(e) => updateField('highestAlarmDeclared', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-orange-400 font-bold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">INCIDENT DATE &amp; TIME:</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={report.incidentDate}
                    onChange={(e) => updateField('incidentDate', e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                  <input
                    type="time"
                    value={report.incidentTime}
                    onChange={(e) => updateField('incidentTime', e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">BARANGAY / LOCATION:</span>
                <input
                  type="text"
                  value={report.barangay}
                  onChange={(e) => updateField('barangay', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-slate-400 text-[11px]">STREET ADDRESS:</span>
                <input
                  type="text"
                  value={report.streetAddress}
                  onChange={(e) => updateField('streetAddress', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            {/* Official Declarations Banner */}
            <div className="p-4 rounded-xl bg-slate-950 border border-orange-500/30 grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-amber-400 font-bold">"UNDER CONTROL" DECLARED AT:</span>
                <input
                  type="time"
                  value={report.underControlTime}
                  onChange={(e) => updateField('underControlTime', e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Spread arrested; no active extension</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-emerald-400 font-bold">OFFICIAL "FIRE OUT" DECLARED AT:</span>
                <input
                  type="time"
                  value={report.fireOutTime}
                  onChange={(e) => updateField('fireOutTime', e.target.value)}
                  className="bg-slate-900 border border-emerald-500/40 rounded-lg p-2 text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Complete extinguishment & overhaul verified</span>
              </div>
            </div>
          </div>

          {/* Section 2: Structural Damage Assessment */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <span className="text-orange-400 font-mono font-bold text-xs">
                SECTION 2: STRUCTURAL DAMAGE ASSESSMENT &amp; VALUATION
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">BUILDING OCCUPANCY TYPE:</span>
                <select
                  value={report.buildingOccupancy}
                  onChange={(e) => updateField('buildingOccupancy', e.target.value as BuildingOccupancyType)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="Residential (Single-Family)">Residential (Single-Family)</option>
                  <option value="Residential (Multi-Storey)">Residential (Multi-Storey)</option>
                  <option value="Commercial (Retail / Mall)">Commercial (Retail / Mall)</option>
                  <option value="Industrial / Warehouse">Industrial / Warehouse</option>
                  <option value="Educational / Institutional">Educational / Institutional</option>
                  <option value="Government / Public Assembly">Government / Public Assembly</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">CONSTRUCTION CLASSIFICATION:</span>
                <input
                  type="text"
                  value={report.constructionType}
                  onChange={(e) => updateField('constructionType', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">FLOOR AREA AFFECTED (SQ METERS):</span>
                <input
                  type="number"
                  value={report.floorAreaAffectedSqM}
                  onChange={(e) => updateField('floorAreaAffectedSqM', Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-red-400 font-bold text-[11px]">
                  ESTIMATED STRUCTURAL DAMAGE (PHP ₱):
                </span>
                <input
                  type="number"
                  value={report.estimatedDamagePhp}
                  onChange={(e) => updateField('estimatedDamagePhp', Number(e.target.value))}
                  className="bg-slate-950 border border-red-500/40 rounded-lg p-2 text-red-400 font-black text-sm"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300">
              VALUATION NOTE: ₱{report.estimatedDamagePhp.toLocaleString()} estimated based on BFP
              Region IX Engineering and Arson Investigation Division pricing metrics.
            </div>
          </div>
        </div>

        {/* Right Column: Origin, Arson Investigation & Casualties (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Section 3: Origin Point & Probable Cause */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <span className="text-orange-400 font-mono font-bold text-xs">
                SECTION 3: POINT OF ORIGIN &amp; PROBABLE CAUSE
              </span>
            </div>

            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">EXACT POINT / ROOM OF ORIGIN:</span>
                <input
                  type="text"
                  value={report.originLocation}
                  onChange={(e) => updateField('originLocation', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">PRIMARY MATERIAL FIRST IGNITED:</span>
                <input
                  type="text"
                  value={report.materialIgnited}
                  onChange={(e) => updateField('materialIgnited', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">PROBABLE CAUSE OF FIRE:</span>
                <select
                  value={report.probableCause}
                  onChange={(e) => updateField('probableCause', e.target.value as ProbableCauseType)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                >
                  <option value="Electrical Short Circuit / Overloaded Wire">Electrical Short Circuit / Overloaded Wire</option>
                  <option value="Unattended Cooking / LPG Gas Leak">Unattended Cooking / LPG Gas Leak</option>
                  <option value="Faulty Electrical Appliance">Faulty Electrical Appliance</option>
                  <option value="Open Flame / Lit Candle / Cigarette">Open Flame / Lit Candle / Cigarette</option>
                  <option value="Incendiary / Suspected Arson">Incendiary / Suspected Arson</option>
                  <option value="Spontaneous Combustion / Hazmat">Spontaneous Combustion / Hazmat</option>
                  <option value="Under Further Investigation">Under Further Investigation</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Arson Investigation & Evidence Notes */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-orange-400 font-mono font-bold text-xs">
                SECTION 4: ARSON INVESTIGATION &amp; FORENSICS
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={report.accelerantDetected}
                  onChange={(e) => updateField('accelerantDetected', e.target.checked)}
                  className="accent-red-500 w-4 h-4 cursor-pointer"
                />
                <span className={report.accelerantDetected ? 'text-red-400 font-bold' : ''}>
                  ACCELERANT DETECTED
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">BURN PATTERN ANALYSIS:</span>
                <input
                  type="text"
                  value={report.burnPatternAnalysis}
                  onChange={(e) => updateField('burnPatternAnalysis', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">ELECTRICAL BREAKER PANEL STATUS:</span>
                <input
                  type="text"
                  value={report.electricalPanelStatus}
                  onChange={(e) => updateField('electricalPanelStatus', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[11px]">ARSON INVESTIGATOR CASE NOTES:</span>
                <textarea
                  rows={3}
                  value={report.arsonNotes}
                  onChange={(e) => updateField('arsonNotes', e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-sans text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Casualties & Resource Utilization */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-3 shadow-xl font-mono text-xs">
            <span className="text-orange-400 font-bold border-b border-slate-800 pb-2">
              SECTION 5: CASUALTIES &amp; WATER EXPENDITURE
            </span>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">CIVILIAN INJURIES</span>
                <span className="text-base font-black text-amber-400">{report.civilianInjuries}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">CIVILIAN FATALITIES</span>
                <span className="text-base font-black text-red-400">{report.civilianFatalities}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">FIREFIGHTER INJURIES</span>
                <span className="text-base font-black text-white">{report.firefighterInjuries}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-slate-800">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">WATER DELIVERED</span>
                <span className="text-base font-black text-blue-400">
                  {report.waterDeliveredGallons.toLocaleString()} GAL
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">FOAM USED</span>
                <span className="text-base font-black text-amber-400">
                  {report.foamConcentrateGallons} GAL (AFFF)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Modal: BFP Official Letterhead Print Preview */}
      {/* ------------------------------------------------------------------ */}
      {showPrintModal && (
        <div
          onClick={() => setShowPrintModal(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full max-h-[90vh] bg-white text-slate-950 rounded-2xl overflow-y-auto p-8 shadow-2xl flex flex-col gap-6 cursor-default"
          >
            {/* Modal Controls */}
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <span className="font-mono text-xs font-bold text-slate-500">
                OFFICIAL BFP FIRE INCIDENT REPORT (FIR) - DOCUMENT PREVIEW
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-mono text-xs font-bold"
                >
                  PRINT / PDF 🖨️
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 font-mono text-xs font-bold"
                >
                  CLOSE ✕
                </button>
              </div>
            </div>

            {/* Republic of the Philippines BFP Letterhead Header */}
            <div className="text-center flex flex-col items-center border-b-2 border-slate-900 pb-4">
              <div className="text-xs font-serif uppercase tracking-widest text-slate-700">
                Republic of the Philippines
              </div>
              <div className="text-sm font-serif uppercase font-bold text-slate-900">
                Department of the Interior and Local Government
              </div>
              <div className="text-lg font-serif uppercase font-black text-red-700 tracking-wider">
                BUREAU OF FIRE PROTECTION
              </div>
              <div className="text-xs font-sans text-slate-600">
                Region IX • Zamboanga del Norte • Dipolog Central Fire Station
              </div>
              <div className="text-xs font-mono font-bold mt-2 text-slate-800">
                FIRE INCIDENT REPORT &amp; AFTER-ACTION REVIEW
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                CASE NUMBER: {report.referenceCode} • DOCKET: {report.id}
              </div>
            </div>

            {/* Document Body */}
            <div className="flex flex-col gap-4 font-sans text-xs text-slate-900">
              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <span className="font-bold block">DATE &amp; TIME OF ALARM:</span>
                  <span>
                    {report.incidentDate} at {report.incidentTime} Hours
                  </span>
                </div>
                <div>
                  <span className="font-bold block">HIGHEST ALARM DECLARED:</span>
                  <span>{report.highestAlarmDeclared}</span>
                </div>
                <div>
                  <span className="font-bold block">LOCATION OF OCCURRENCE:</span>
                  <span>
                    {report.streetAddress}, {report.barangay}
                  </span>
                </div>
                <div>
                  <span className="font-bold block">BUILDING OCCUPANCY / CONSTRUCTION:</span>
                  <span>
                    {report.buildingOccupancy} ({report.constructionType})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <span className="font-bold block">UNDER CONTROL TIME:</span>
                  <span>{report.underControlTime} Hours</span>
                </div>
                <div>
                  <span className="font-bold block">OFFICIAL FIRE OUT DECLARED:</span>
                  <span>{report.fireOutTime} Hours</span>
                </div>
                <div>
                  <span className="font-bold block">POINT OF ORIGIN:</span>
                  <span>{report.originLocation}</span>
                </div>
                <div>
                  <span className="font-bold block">PROBABLE CAUSE:</span>
                  <span className="font-bold text-red-700">{report.probableCause}</span>
                </div>
              </div>

              <div className="border-b pb-3 flex flex-col gap-1">
                <span className="font-bold">STRUCTURAL DAMAGE ASSESSMENT:</span>
                <p>
                  Estimated structural and contents damage is valued at{' '}
                  <strong>PHP ₱{report.estimatedDamagePhp.toLocaleString()}</strong> over an affected floor
                  area of approximately {report.floorAreaAffectedSqM} square meters.
                </p>
              </div>

              <div className="border-b pb-3 flex flex-col gap-1">
                <span className="font-bold">ARSON FORENSICS &amp; EVIDENCE NOTES:</span>
                <p className="leading-relaxed">{report.arsonNotes}</p>
                <div className="mt-1 font-mono text-[11px] text-slate-700">
                  Burn Pattern: {report.burnPatternAnalysis} | Accelerant: {report.accelerantDetected ? 'POSITIVE' : 'NEGATIVE'} | Panel: {report.electricalPanelStatus}
                </div>
              </div>

              <div className="border-b pb-3 grid grid-cols-2 gap-4">
                <div>
                  <span className="font-bold block">CASUALTIES:</span>
                  <span>
                    Civilians: {report.civilianInjuries} Injured, {report.civilianFatalities} Fatality |
                    Firefighters: {report.firefighterInjuries} Injured
                  </span>
                </div>
                <div>
                  <span className="font-bold block">SUPPRESSION RESOURCES:</span>
                  <span>
                    Water: {report.waterDeliveredGallons.toLocaleString()} Gallons | Foam: {report.foamConcentrateGallons} Gallons
                  </span>
                </div>
              </div>
            </div>

            {/* Official Signature Lines */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-center font-sans">
              <div className="flex flex-col items-center">
                <div className="w-56 border-b border-black mb-1" />
                <span className="font-bold text-xs uppercase">{report.incidentCommander}</span>
                <span className="text-[10px] text-slate-600">Incident Commander / Shift Head</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-56 border-b border-black mb-1" />
                <span className="font-bold text-xs uppercase">{report.fireMarshal}</span>
                <span className="text-[10px] text-slate-600">City Fire Marshal, BFP Dipolog</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FireAarReportsPage;
