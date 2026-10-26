// [Layer: UserRoles/Features/Pages/RespondersPanel/Fire]
// Responsibility: Hazardous Materials Emergency Response Guidebook (ERG 2024 / NFPA 704) Console.
// Features: UN/NA 4-Digit Search, Interactive NFPA 704 Diamond, Initial Isolation Perimeters,
// Chemical Protective Clothing (Level A-D) Guidance, and Fire Suppression Media Protocols.
// Katipuneros Architecture: Strict typing, universal lambda syntax (=>), ZERO 'any' usage.

import React, { useState, useMemo } from 'react';

// --------------------------------------------------------------------------
// Types & Contracts
// --------------------------------------------------------------------------

export type HazmatClass =
  | 'Class 2 (Gases)'
  | 'Class 3 (Flammable Liquids)'
  | 'Class 4 (Flammable Solids / Water Reactive)'
  | 'Class 6 (Toxic Substances)'
  | 'Class 8 (Corrosives)';

export type PpeLevel = 'Level A' | 'Level B' | 'Level C' | 'Level D';

export interface NfpaDiamondRating {
  health: number; // 0-4
  flammability: number; // 0-4
  instability: number; // 0-4
  special?: 'W' | 'OX' | 'SA' | 'COR' | 'RAD' | 'None';
}

export interface HazmatChemical {
  unNumber: string;
  chemicalName: string;
  commonName: string;
  hazardClass: HazmatClass;
  ergGuideNumber: number;
  guideTitle: string;
  nfpa: NfpaDiamondRating;
  initialIsolationSmallSpillMeters: number;
  initialIsolationLargeSpillMeters: number;
  dayProtectionDistanceKm: number;
  nightProtectionDistanceKm: number;
  recommendedPpe: PpeLevel;
  ppeDetails: string;
  fireFightingMedia: string;
  doNotUseWater: boolean;
  healthHazards: string;
  firstAidProtocol: string;
}

// --------------------------------------------------------------------------
// ERG 2024 High-Risk Industrial & Port Chemical Database
// --------------------------------------------------------------------------
export const HAZMAT_DATABASE: HazmatChemical[] = [
  {
    unNumber: '1203',
    chemicalName: 'GASOLINE / MOTOR SPIRIT',
    commonName: 'Petrol / Unleaded Gasoline',
    hazardClass: 'Class 3 (Flammable Liquids)',
    ergGuideNumber: 128,
    guideTitle: 'Flammable Liquids (Water-Immiscible)',
    nfpa: { health: 1, flammability: 3, instability: 0, special: 'None' },
    initialIsolationSmallSpillMeters: 50,
    initialIsolationLargeSpillMeters: 300,
    dayProtectionDistanceKm: 0.8,
    nightProtectionDistanceKm: 2.1,
    recommendedPpe: 'Level B',
    ppeDetails: 'SCBA + Fire Turnout Gear or Chemical Flash Protection Suit',
    fireFightingMedia: 'AFFF Aqueous Film Forming Foam, Dry Chemical, CO2. Fog nozzles for vapor dissipation.',
    doNotUseWater: false,
    healthHazards: 'Vapors cause dizziness and suffocation. Highly flammable; vapors may travel to ignition source.',
    firstAidProtocol: 'Move victim to fresh air. If not breathing, give artificial respiration. Flush skin with soap and water.'
  },
  {
    unNumber: '1005',
    chemicalName: 'AMMONIA, ANHYDROUS',
    commonName: 'Refrigeration Ammonia / Cold Storage Gas',
    hazardClass: 'Class 2 (Gases)',
    ergGuideNumber: 125,
    guideTitle: 'Gases - Corrosive and/or Toxic',
    nfpa: { health: 3, flammability: 1, instability: 0, special: 'None' },
    initialIsolationSmallSpillMeters: 100,
    initialIsolationLargeSpillMeters: 500,
    dayProtectionDistanceKm: 2.2,
    nightProtectionDistanceKm: 5.4,
    recommendedPpe: 'Level A',
    ppeDetails: 'Fully encapsulating vapor protective suit (NFPA 1991) + Positive-Pressure SCBA',
    fireFightingMedia: 'DO NOT extinguish fire unless flow can be stopped safely. Use fine water spray to knock down gas cloud.',
    doNotUseWater: false,
    healthHazards: 'Extremely corrosive to respiratory tract, skin, and eyes. Rapidly causes pulmonary edema and chemical blindness.',
    firstAidProtocol: 'Immediate decontamination shower (15 mins minimum). Administer 100% humidified oxygen. Irrigate eyes immediately.'
  },
  {
    unNumber: '1017',
    chemicalName: 'CHLORINE',
    commonName: 'Liquid Chlorine / Water Treatment Gas',
    hazardClass: 'Class 2 (Gases)',
    ergGuideNumber: 124,
    guideTitle: 'Gases - Toxic and/or Corrosive - Oxidizing',
    nfpa: { health: 4, flammability: 0, instability: 0, special: 'OX' },
    initialIsolationSmallSpillMeters: 100,
    initialIsolationLargeSpillMeters: 800,
    dayProtectionDistanceKm: 3.5,
    nightProtectionDistanceKm: 7.8,
    recommendedPpe: 'Level A',
    ppeDetails: 'Vapor-tight chemical suit + SCBA. No skin exposure permitted.',
    fireFightingMedia: 'Use water spray to cool surrounding containers. DO NOT spray water directly into chlorine leak (forms corrosive acid).',
    doNotUseWater: false,
    healthHazards: 'Lethal toxic gas. Oxidizer accelerates combustion. Severe lung and mucosal burn on inhalation.',
    firstAidProtocol: 'Evacuate upwind immediately. Remove contaminated clothing with shears. Administer oxygen under positive pressure.'
  },
  {
    unNumber: '1075',
    chemicalName: 'PETROLEUM GASES, LIQUEFIED',
    commonName: 'LPG / Liquefied Petroleum Gas / Propane-Butane',
    hazardClass: 'Class 2 (Gases)',
    ergGuideNumber: 115,
    guideTitle: 'Gases - Flammable (Including Refrigerated Liquids)',
    nfpa: { health: 1, flammability: 4, instability: 0, special: 'None' },
    initialIsolationSmallSpillMeters: 100,
    initialIsolationLargeSpillMeters: 800,
    dayProtectionDistanceKm: 1.6,
    nightProtectionDistanceKm: 1.6,
    recommendedPpe: 'Level B',
    ppeDetails: 'Full thermal turnout gear + SCBA. BLEVE potential requires unmanned monitors.',
    fireFightingMedia: 'Cool tank shell with massive water streams (>500 GPM per point of flame impingement) to prevent BLEVE catastrophe.',
    doNotUseWater: false,
    healthHazards: 'Vapors are heavier than air and collect in low areas/sewers. BLEVE risk if tank shell is uncooled.',
    firstAidProtocol: 'Treat frostbite with lukewarm water immersion. Never rub frostbitten skin. Move victim to fresh air.'
  },
  {
    unNumber: '1830',
    chemicalName: 'SULFURIC ACID (WITH >51% ACID)',
    commonName: 'Battery Acid / Industrial Vitriol',
    hazardClass: 'Class 8 (Corrosives)',
    ergGuideNumber: 137,
    guideTitle: 'Substances - Water-Reactive - Corrosive',
    nfpa: { health: 3, flammability: 0, instability: 2, special: 'W' },
    initialIsolationSmallSpillMeters: 50,
    initialIsolationLargeSpillMeters: 200,
    dayProtectionDistanceKm: 0.5,
    nightProtectionDistanceKm: 1.2,
    recommendedPpe: 'Level B',
    ppeDetails: 'Chemical splash suit (NFPA 1992), butyl rubber gloves, SCBA.',
    fireFightingMedia: 'Dry chemical, soda ash, or CO2. DO NOT USE DIRECT WATER STREAMS (violent exothermic steam explosion).',
    doNotUseWater: true,
    healthHazards: 'Violently water reactive. Causes deep third-degree chemical burns on contact. Dense sulfur trioxide fumes.',
    firstAidProtocol: 'Wipe off excess acid with dry cloth before flushing with water for at least 20 minutes. Call emergency burns unit.'
  },
  {
    unNumber: '1428',
    chemicalName: 'SODIUM, METAL',
    commonName: 'Metallic Sodium / Pyrophoric Metal',
    hazardClass: 'Class 4 (Flammable Solids / Water Reactive)',
    ergGuideNumber: 138,
    guideTitle: 'Substances - Water-Reactive (Emitting Flammable Gases)',
    nfpa: { health: 3, flammability: 3, instability: 2, special: 'W' },
    initialIsolationSmallSpillMeters: 60,
    initialIsolationLargeSpillMeters: 300,
    dayProtectionDistanceKm: 1.1,
    nightProtectionDistanceKm: 2.5,
    recommendedPpe: 'Level B',
    ppeDetails: 'Turnout gear + SCBA + Class D powder application shield.',
    fireFightingMedia: 'STRICTLY CLASS D DRY POWDER (MET-L-X, dry sodium chloride, or dry sand). WATER IS STRICTLY FORBIDDEN.',
    doNotUseWater: true,
    healthHazards: 'Spontaneously ignites in air and explodes on contact with water, producing flammable hydrogen and caustic NaOH.',
    firstAidProtocol: 'Brush off solid particles immediately with dry instrument. Do not apply water to burning skin. Cover with sterile mineral oil.'
  },
  {
    unNumber: '1223',
    chemicalName: 'KEROSENE / AVIATION JET FUEL',
    commonName: 'Jet A-1 / Kerosene',
    hazardClass: 'Class 3 (Flammable Liquids)',
    ergGuideNumber: 128,
    guideTitle: 'Flammable Liquids (Water-Immiscible)',
    nfpa: { health: 2, flammability: 2, instability: 0, special: 'None' },
    initialIsolationSmallSpillMeters: 50,
    initialIsolationLargeSpillMeters: 250,
    dayProtectionDistanceKm: 0.6,
    nightProtectionDistanceKm: 1.5,
    recommendedPpe: 'Level B',
    ppeDetails: 'SCBA + Firefighter turnout gear + chemical resistant boots.',
    fireFightingMedia: 'Alcohol-Resistant Foam or Regular AFFF, dry chemical, carbon dioxide.',
    doNotUseWater: false,
    healthHazards: 'Moderate skin and lung irritant. Ingestion hazard can cause chemical pneumonitis.',
    firstAidProtocol: 'Wash skin thoroughly with soap and water. Never induce vomiting if swallowed.'
  }
];

// --------------------------------------------------------------------------
// Audio Feedback Helper
// --------------------------------------------------------------------------
const triggerTactileBeep = (freq = 720, duration = 0.05): void => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
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
// Sub-Component: NFPA 704 Diamond
// --------------------------------------------------------------------------
const Nfpa704Diamond: React.FC<{ nfpa: NfpaDiamondRating }> = ({ nfpa }) => {
  return (
    <div className="relative w-36 h-36 flex items-center justify-center p-1 select-none">
      {/* 45-degree Rotated Outer Diamond */}
      <div className="w-24 h-24 rotate-45 grid grid-cols-2 grid-rows-2 border-2 border-black bg-black shadow-2xl overflow-hidden rounded-sm">
        {/* Top: Flammability (Red) */}
        <div className="bg-red-600 flex items-center justify-center border border-black/40">
          <span className="-rotate-45 font-black text-white text-lg drop-shadow">
            {nfpa.flammability}
          </span>
        </div>

        {/* Right: Instability / Reactivity (Yellow) */}
        <div className="bg-yellow-400 flex items-center justify-center border border-black/40">
          <span className="-rotate-45 font-black text-black text-lg">
            {nfpa.instability}
          </span>
        </div>

        {/* Left: Health (Blue) */}
        <div className="bg-blue-600 flex items-center justify-center border border-black/40">
          <span className="-rotate-45 font-black text-white text-lg drop-shadow">
            {nfpa.health}
          </span>
        </div>

        {/* Bottom: Special Hazard (White) */}
        <div className="bg-white flex items-center justify-center border border-black/40">
          <span className="-rotate-45 font-black text-black text-xs">
            {nfpa.special === 'W' ? (
              <span className="relative">
                W<span className="absolute left-0 top-1/2 w-full h-[2px] bg-black -translate-y-1/2" />
              </span>
            ) : nfpa.special === 'None' ? (
              ''
            ) : (
              nfpa.special
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// Component: HazmatGuidebookPage
// --------------------------------------------------------------------------
export const HazmatGuidebookPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('1203');
  const [selectedChemical, setSelectedChemical] = useState<HazmatChemical>(HAZMAT_DATABASE[0]);

  // Filtered Chemicals by UN Number or Name
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return HAZMAT_DATABASE;
    const q = searchQuery.toLowerCase();
    return HAZMAT_DATABASE.filter(
      (c) =>
        c.unNumber.includes(q) ||
        c.chemicalName.toLowerCase().includes(q) ||
        c.commonName.toLowerCase().includes(q) ||
        c.hazardClass.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Quick Select Helper
  const handleSelectChemical = (chem: HazmatChemical) => {
    triggerTactileBeep(780, 0.05);
    setSelectedChemical(chem);
    setSearchQuery(chem.unNumber);
  };

  return (
    <div className="w-full flex flex-col gap-5 text-slate-100 font-sans pb-10">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header: Hazmat Guidebook & ERG 2024 Identity */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-600 to-amber-700 border-2 border-yellow-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(245,158,11,0.5)] flex-shrink-0">
            ☣️
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 uppercase tracking-widest">
                ERG 2024 // EMERGENCY RESPONSE GUIDEBOOK
              </span>
              <span className="text-slate-500 font-mono text-xs">|</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                NFPA 704 / PHMSA COMPLIANT
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>HAZMAT CHEMICAL TRIAGE CONSOLE</span>
            </h1>

            <p className="text-xs font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>INITIAL ISOLATION PERIMETERS • PPE SUIT LEVEL SELECTION • MEDIA RESTRICTIONS</span>
            </p>
          </div>
        </div>

        {/* Quick Chemical Badges for Instant Field Access */}
        <div className="flex flex-wrap items-center gap-2">
          {HAZMAT_DATABASE.slice(0, 4).map((c) => (
            <button
              key={c.unNumber}
              type="button"
              onClick={() => handleSelectChemical(c)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black transition-all border active:scale-95 cursor-pointer ${
                selectedChemical.unNumber === c.unNumber
                  ? 'bg-yellow-500 text-slate-950 border-white shadow-[0_0_15px_rgba(234,179,8,0.7)]'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-yellow-500/40'
              }`}
            >
              UN {c.unNumber} ({c.commonName.split('/')[0].trim()})
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Search Bar: UN/NA Number or Chemical Name */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <span className="text-amber-400 font-black text-base">UN</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter 4-Digit UN Number (e.g. 1203, 1005, 1017) or Chemical Name..."
            className="w-full bg-slate-950 px-3 py-2 rounded-lg border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500 text-sm font-bold"
          />
        </div>

        <div className="text-slate-400 text-[11px]">
          SHOWING <strong className="text-white">{searchResults.length}</strong> MATCHED HAZMAT CHEMICALS
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Main Chemical Dossier & NFPA 704 HUD Split */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Chemical Primary Specs, NFPA Diamond & Isolation Perimeters (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-4 shadow-xl">
            {/* Chemical Banner */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs mb-1">
                  <span className="px-2.5 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 font-black text-sm">
                    UN {selectedChemical.unNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                    ERG GUIDE {selectedChemical.ergGuideNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 font-bold">
                    {selectedChemical.hazardClass}
                  </span>
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight">
                  {selectedChemical.chemicalName}
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  COMMERCIAL NAME: <strong className="text-slate-200">{selectedChemical.commonName}</strong>
                </p>
              </div>

              {/* NFPA 704 Visual Diamond Component */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono text-slate-400 font-bold mb-1">
                  NFPA 704 DIAMOND
                </span>
                <Nfpa704Diamond nfpa={selectedChemical.nfpa} />
              </div>
            </div>

            {/* DO NOT USE WATER Warning Banner if Water Reactive */}
            {selectedChemical.doNotUseWater && (
              <div className="p-3.5 rounded-xl bg-red-950/90 border-2 border-red-500 text-white font-mono text-xs font-black shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center gap-3 animate-pulse">
                <span className="text-2xl">🚫💧</span>
                <div>
                  <div className="text-red-200 text-sm">CRITICAL WARNING: DO NOT USE WATER!</div>
                  <div className="text-[10px] text-red-300 font-normal">
                    This chemical reacts violently with water to release explosive hydrogen or toxic gas.
                    Water application will trigger immediate detonation.
                  </div>
                </div>
              </div>
            )}

            {/* Initial Isolation Perimeters HUD (Small Spill vs Large Spill) */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-yellow-400 font-bold">
                  INITIAL ISOLATION & PROTECTIVE ACTION DISTANCES
                </span>
                <span className="text-slate-400 text-[10px]">ERG TABLE 1 SPEC</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">SMALL SPILL ISOLATION</span>
                  <span className="text-lg font-black text-amber-400">
                    {selectedChemical.initialIsolationSmallSpillMeters} M
                  </span>
                  <span className="text-[9px] text-slate-500 block">
                    ({Math.round(selectedChemical.initialIsolationSmallSpillMeters * 3.28)} ft)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">LARGE SPILL ISOLATION</span>
                  <span className="text-lg font-black text-red-400">
                    {selectedChemical.initialIsolationLargeSpillMeters} M
                  </span>
                  <span className="text-[9px] text-slate-500 block">
                    ({Math.round(selectedChemical.initialIsolationLargeSpillMeters * 3.28)} ft)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">DOWNWIND (DAY)</span>
                  <span className="text-lg font-black text-white">
                    {selectedChemical.dayProtectionDistanceKm} KM
                  </span>
                  <span className="text-[9px] text-slate-500 block">Protective Zone</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">DOWNWIND (NIGHT)</span>
                  <span className="text-lg font-black text-purple-400">
                    {selectedChemical.nightProtectionDistanceKm} KM
                  </span>
                  <span className="text-[9px] text-slate-500 block">Inversion Hazard</span>
                </div>
              </div>
            </div>

            {/* Health Hazards & Symptoms */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2 font-mono text-xs">
              <span className="text-red-400 font-bold">HEALTH HAZARDS & TOXICITY PROFILE:</span>
              <p className="text-slate-300 font-sans text-xs leading-relaxed">
                {selectedChemical.healthHazards}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Protective Equipment (PPE) & Fire Suppression Instructions (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Protective Equipment (PPE Level A-D) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-orange-400 font-bold font-mono text-xs">
                  CHEMICAL PROTECTIVE CLOTHING (CPC)
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-orange-600/30 text-white font-mono font-black text-xs border border-orange-500/50">
                REQUIRED: {selectedChemical.recommendedPpe.toUpperCase()}
              </span>
            </div>

            {/* PPE Levels Grid */}
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              {(['Level A', 'Level B', 'Level C', 'Level D'] as const).map((lvl) => {
                const isSelected = selectedChemical.recommendedPpe === lvl;
                return (
                  <div
                    key={lvl}
                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                      isSelected
                        ? 'bg-orange-600/30 border-orange-400 text-white shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm">{lvl}</span>
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500 text-black font-bold">
                          MANDATORY
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] leading-tight">
                      {lvl === 'Level A' && 'Vapor-tight full encapsulating suit + SCBA'}
                      {lvl === 'Level B' && 'Liquid splash suit + Positive-pressure SCBA'}
                      {lvl === 'Level C' && 'Chemical suit + Air purifying respirator'}
                      {lvl === 'Level D' && 'Standard structural turnout gear + helmet'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300">
              <strong className="text-orange-400 block mb-1">SPECIFIC PPE PROTOCOL:</strong>
              {selectedChemical.ppeDetails}
            </div>
          </div>

          {/* Fire Suppression Protocols */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <span className="text-orange-400 font-mono font-bold text-xs">
                RECOMMENDED FIRE SUPPRESSION MEDIA
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs flex flex-col gap-2">
              <span className="text-slate-400">EXTINGUISHING AGENTS:</span>
              <p className="text-white font-bold leading-relaxed">
                {selectedChemical.fireFightingMedia}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs flex flex-col gap-2">
              <span className="text-emerald-400 font-bold">EMERGENCY FIRST AID PROTOCOL:</span>
              <p className="text-slate-300 font-sans text-xs leading-relaxed">
                {selectedChemical.firstAidProtocol}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HazmatGuidebookPage;
