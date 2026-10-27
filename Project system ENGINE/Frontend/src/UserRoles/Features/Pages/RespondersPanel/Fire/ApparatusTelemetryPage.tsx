// [Layer: UserRoles/Features/Pages/RespondersPanel/Fire]
// Responsibility: Apparatus Fleet Telemetry, Pump Diagnostics, Foam Proportioning & SCBA 4,500 PSI HUD.
// Monitored Fleet: Engine 01 (Pumper), Engine 02 (Water Tender 2,500 Gal), Ladder 01 (100ft Aerial).
// Controls: Interactive Water Tank Sliders, Master Pump Intake/Discharge PSI Gauges,
// Foam Proportioner (1% / 3% / 6%), and SCBA 4,500 PSI Readiness Inspection Checklist.
// Katipuneros Architecture: Strict typing, universal lambda syntax (=>), ZERO 'any' usage.

import React, { useState, useMemo } from 'react';
import {
  Gauge,
  Droplets,
  Fuel,
  Users,
  CheckCircle2,
  AlertCircle,
  Activity,
  Flame,
  Shield,
  Sliders,
  Wind
} from 'lucide-react';

// --------------------------------------------------------------------------
// Types & Contracts
// --------------------------------------------------------------------------

export type ApparatusId = 'ENGINE-01' | 'TENDER-02' | 'LADDER-01' | 'RESCUE-01';

export interface ApparatusSpec {
  id: ApparatusId;
  callsign: string;
  name: string;
  type: string;
  chassis: string;
  tankCapacityGallons: number;
  pumpCapacityGpm: number;
  foamCapacityGallons: number;
  station: string;
  assignedCrewCount: number;
  fuelPercent: number;
  engineRpm: number;
  oilPressurePsi: number;
  transmissionTempC: number;
}

export interface ScbaCheckItem {
  id: string;
  cylinderCode: string;
  assignedPosition: string;
  pressurePsi: number;
  passAlarmTest: boolean;
  lowAirWhistleTest: boolean;
  maskSealOk: boolean;
  cylinderHydroTestYear: number;
  batteryStatus: 'Good' | 'Low' | 'Replace';
}

const APPARATUS_FLEET: ApparatusSpec[] = [
  {
    id: 'ENGINE-01',
    callsign: 'BFP-PUMPER-01',
    name: 'Engine 01 (First-Due Attack Pumper)',
    type: 'Type 1 Tactical Pumper',
    chassis: 'Isuzu FTR 850 4x2 / Rosenbauer Body',
    tankCapacityGallons: 750,
    pumpCapacityGpm: 1000,
    foamCapacityGallons: 50,
    station: 'Dipolog Central Fire Station',
    assignedCrewCount: 5,
    fuelPercent: 88,
    engineRpm: 1250,
    oilPressurePsi: 55,
    transmissionTempC: 84
  },
  {
    id: 'TENDER-02',
    callsign: 'BFP-TENDER-02',
    name: 'Engine 02 (Heavy Water Tender 2,500 Gal)',
    type: 'Heavy Water Supply Tanker',
    chassis: 'Hino 700 Series 6x4 Heavy Duty',
    tankCapacityGallons: 2500,
    pumpCapacityGpm: 500,
    foamCapacityGallons: 100,
    station: 'Dipolog Central Fire Station',
    assignedCrewCount: 3,
    fuelPercent: 92,
    engineRpm: 1050,
    oilPressurePsi: 58,
    transmissionTempC: 80
  },
  {
    id: 'LADDER-01',
    callsign: 'BFP-LADDER-01',
    name: 'Ladder 01 (100ft Aerial Platform)',
    type: 'Hydraulic Aerial Platform & Water Tower',
    chassis: 'MAN TGS 26.400 6x4 / Bronto Skylift 32M',
    tankCapacityGallons: 400,
    pumpCapacityGpm: 1500,
    foamCapacityGallons: 60,
    station: 'Dipolog Central Fire Station',
    assignedCrewCount: 4,
    fuelPercent: 80,
    engineRpm: 1400,
    oilPressurePsi: 60,
    transmissionTempC: 88
  },
  {
    id: 'RESCUE-01',
    callsign: 'BFP-RESCUE-01',
    name: 'Rescue 01 (Special Rescue Unit & Extrication)',
    type: 'Heavy Tactical Rescue & Air Cascade',
    chassis: 'Isuzu Forward FVR Heavy Rescue',
    tankCapacityGallons: 200,
    pumpCapacityGpm: 250,
    foamCapacityGallons: 25,
    station: 'Dipolog Central Fire Station',
    assignedCrewCount: 4,
    fuelPercent: 95,
    engineRpm: 900,
    oilPressurePsi: 54,
    transmissionTempC: 78
  }
];

const INITIAL_SCBA_ROSTER: ScbaCheckItem[] = [
  {
    id: 'SCBA-01',
    cylinderCode: 'CYL-4500-A1',
    assignedPosition: 'Engine Officer / Entry Lead',
    pressurePsi: 4500,
    passAlarmTest: true,
    lowAirWhistleTest: true,
    maskSealOk: true,
    cylinderHydroTestYear: 2028,
    batteryStatus: 'Good'
  },
  {
    id: 'SCBA-02',
    cylinderCode: 'CYL-4500-A2',
    assignedPosition: 'Nozzleman 1 (Interior Attack)',
    pressurePsi: 4450,
    passAlarmTest: true,
    lowAirWhistleTest: true,
    maskSealOk: true,
    cylinderHydroTestYear: 2028,
    batteryStatus: 'Good'
  },
  {
    id: 'SCBA-03',
    cylinderCode: 'CYL-4500-A3',
    assignedPosition: 'Backup Nozzleman (Hoseman)',
    pressurePsi: 4300,
    passAlarmTest: true,
    lowAirWhistleTest: true,
    maskSealOk: true,
    cylinderHydroTestYear: 2027,
    batteryStatus: 'Good'
  },
  {
    id: 'SCBA-04',
    cylinderCode: 'CYL-4500-A4',
    assignedPosition: 'Driver / Pump Operator',
    pressurePsi: 4200,
    passAlarmTest: true,
    lowAirWhistleTest: true,
    maskSealOk: true,
    cylinderHydroTestYear: 2027,
    batteryStatus: 'Good'
  }
];

// --------------------------------------------------------------------------
// Audio Feedback Helper
// --------------------------------------------------------------------------
const triggerTactileBeep = (freq = 680, duration = 0.05): void => {
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
// Component: ApparatusTelemetryPage
// --------------------------------------------------------------------------
export const ApparatusTelemetryPage: React.FC = () => {
  const [selectedApparatusId, setSelectedApparatusId] = useState<ApparatusId>('ENGINE-01');

  // Dynamic Apparatus Telemetry States
  const [waterTankPercent, setWaterTankPercent] = useState<number>(85); // 0-100%
  const [isRefilling, setIsRefilling] = useState<boolean>(false);
  const [isPumping, setIsPumping] = useState<boolean>(false);

  // Pump Governor & Discharge Pressures
  const [dischargePsi, setDischargePsi] = useState<number>(150); // 0-350 PSI
  const [intakePsi, setIntakePsi] = useState<number>(45); // 0-100 PSI
  const [governorMode, setGovernorMode] = useState<'PRESSURE' | 'RPM'>('PRESSURE');

  // Foam Proportioner Controls
  const [foamRate, setFoamRate] = useState<'OFF' | '1%' | '3%' | '6%'>('OFF');
  const [foamType, setFoamType] = useState<'CLASS-A' | 'CLASS-B-AFFF'>('CLASS-A');
  const [foamLevelPercent, setFoamLevelPercent] = useState<number>(90);

  // SCBA Checklist State
  const [scbaRoster, setScbaRoster] = useState<ScbaCheckItem[]>(INITIAL_SCBA_ROSTER);
  const [signOffStatus, setSignOffStatus] = useState<string | null>(null);

  const currentApparatus = useMemo(() => {
    return (
      APPARATUS_FLEET.find((a) => a.id === selectedApparatusId) || APPARATUS_FLEET[0]
    );
  }, [selectedApparatusId]);

  // Current Water Gallons Remaining
  const currentWaterGallons = useMemo(() => {
    return Math.round((waterTankPercent / 100) * currentApparatus.tankCapacityGallons);
  }, [waterTankPercent, currentApparatus]);

  // Handle Refill Simulation Toggle
  const handleToggleRefill = () => {
    triggerTactileBeep(850, 0.08);
    setIsRefilling((prev) => !prev);
    if (!isRefilling) {
      setWaterTankPercent(100);
    }
  };

  // Handle SCBA Checkbox Toggle
  const handleToggleScbaField = (
    id: string,
    field: 'passAlarmTest' | 'lowAirWhistleTest' | 'maskSealOk'
  ) => {
    triggerTactileBeep(720, 0.04);
    setScbaRoster((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: !item[field] } : item))
    );
  };

  // SCBA Sign-off
  const handleScbaSignOff = () => {
    triggerTactileBeep(940, 0.1);
    setSignOffStatus(
      `VERIFIED BY PUMP OPERATOR ON DUTY • ALL 4 UNITS PASSED 4,500 PSI READINESS AT ${new Date().toLocaleTimeString()}`
    );
    setTimeout(() => setSignOffStatus(null), 6000);
  };

  return (
    <div className="w-full flex flex-col gap-5 text-slate-100 font-sans pb-10">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header: Fleet Monitoring & Apparatus HUD Identity */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 border-2 border-orange-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(234,88,12,0.5)] flex-shrink-0">
            🎛️
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-black bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase tracking-widest">
                BFP APPARATUS TELEMETRY & PUMP GAUGES
              </span>
              <span className="text-slate-500 font-mono text-xs">|</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                ACTIVE APPARATUS: {currentApparatus.callsign}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>{currentApparatus.name}</span>
            </h1>

            <p className="text-xs font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>CHASSIS: {currentApparatus.chassis}</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CAN-BUS TELEMETRY LINKED
              </span>
            </p>
          </div>
        </div>

        {/* Engine Fleet Switcher Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {APPARATUS_FLEET.map((app) => {
            const isSelected = selectedApparatusId === app.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  triggerTactileBeep(640, 0.04);
                  setSelectedApparatusId(app.id);
                  setWaterTankPercent(app.id === 'TENDER-02' ? 95 : 85);
                }}
                className={`px-3 py-2 rounded-xl font-mono text-xs font-bold transition-all border-2 active:scale-95 cursor-pointer flex flex-col items-start ${
                  isSelected
                    ? 'bg-orange-600 border-white text-white shadow-[0_0_15px_rgba(234,88,12,0.6)]'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-orange-500/40'
                }`}
              >
                <span className="text-[10px] uppercase text-slate-200">{app.id}</span>
                <span className="text-xs font-black truncate max-w-[110px]">{app.callsign}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Apparatus Vital Stats & Engine Telemetry Bar */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">ENGINE RPM</span>
          <span className="text-xl font-black text-white">{currentApparatus.engineRpm} RPM</span>
          <span className="text-[9px] text-emerald-400">Pumping Idle</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">OIL PRESSURE</span>
          <span className="text-xl font-black text-sky-400">
            {currentApparatus.oilPressurePsi} PSI
          </span>
          <span className="text-[9px] text-slate-400">Normal Range</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">TRANS TEMP</span>
          <span className="text-xl font-black text-amber-400">
            {currentApparatus.transmissionTempC}°C
          </span>
          <span className="text-[9px] text-slate-400">Optimal Cool</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">FUEL LEVEL</span>
          <span className="text-xl font-black text-emerald-400">
            {currentApparatus.fuelPercent}%
          </span>
          <span className="text-[9px] text-slate-400">Ultra-Low Sulfur Diesel</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">PUMP RATING</span>
          <span className="text-xl font-black text-orange-400">
            {currentApparatus.pumpCapacityGpm} GPM
          </span>
          <span className="text-[9px] text-slate-400">Centrifugal 2-Stage</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">CREW COMPLEMENT</span>
          <span className="text-xl font-black text-white">
            {currentApparatus.assignedCrewCount} CREW
          </span>
          <span className="text-[9px] text-slate-400">Shift A Active</span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Main Hydraulics: Water Tank & Master Pump Gauges Split */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Water Tank Level Gauges & Interactive Sliders (6 Cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <h3 className="text-sm font-black font-mono text-white uppercase tracking-wider">
                  WATER TANK LEVEL TELEMETRY (750 / 2,500 GAL)
                </h3>
              </div>
              <button
                type="button"
                onClick={handleToggleRefill}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                  isRefilling
                    ? 'bg-blue-600 border-white text-white shadow-lg animate-pulse'
                    : 'bg-slate-950 border-blue-500/40 text-blue-400 hover:bg-blue-900/30'
                }`}
              >
                {isRefilling ? 'REFILLING FROM HYDRANT...' : 'FILL TANK (HYDRANT)'}
              </button>
            </div>

            {/* Visual Tank Graphic */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
              <div className="flex justify-between items-end font-mono">
                <div>
                  <span className="text-xs text-slate-400 block">WATER RESERVOIR</span>
                  <span className="text-3xl font-black text-blue-400">
                    {currentWaterGallons}{' '}
                    <span className="text-sm font-normal text-slate-300">
                      / {currentApparatus.tankCapacityGallons} GALLONS
                    </span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white">{waterTankPercent}%</span>
                  <span
                    className={`block text-[10px] font-bold ${
                      waterTankPercent <= 25 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
                    }`}
                  >
                    {waterTankPercent <= 25 ? 'LOW WATER ALARM' : 'ADEQUATE SUPPLY'}
                  </span>
                </div>
              </div>

              {/* Tank Graphic Container */}
              <div className="w-full h-10 rounded-xl bg-slate-900 border-2 border-slate-700 overflow-hidden relative p-1 flex items-center">
                <div
                  className={`h-full rounded-lg transition-all duration-300 ${
                    waterTankPercent <= 25
                      ? 'bg-gradient-to-r from-red-600 to-rose-700'
                      : 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                  }`}
                  style={{ width: `${waterTankPercent}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-black text-white drop-shadow">
                  {waterTankPercent}% CAPACITY
                </div>
              </div>

              {/* Interactive Tank Level Slider */}
              <div className="flex flex-col gap-1 mt-1 font-mono text-xs">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>ADJUST TANK LEVEL (DISCHARGE / REFILL):</span>
                  <span className="text-blue-400 font-bold">{waterTankPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={waterTankPercent}
                  onChange={(e) => setWaterTankPercent(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Foam Proportioner Controls (1% / 3% / 6%) */}
            <div className="p-4 rounded-xl bg-slate-950 border border-orange-500/30 flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">FOAM PROPORTIONER SYSTEM</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                    AR-AFFF READY
                  </span>
                </div>
                <span className="text-slate-400 text-[11px]">
                  FOAM TANK: <strong className="text-amber-400">{foamLevelPercent}%</strong> (
                  {Math.round((foamLevelPercent / 100) * currentApparatus.foamCapacityGallons)} Gal)
                </span>
              </div>

              {/* Foam Type Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFoamType('CLASS-A')}
                  className={`p-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    foamType === 'CLASS-A'
                      ? 'bg-amber-600 text-white border border-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  CLASS A (Structures & Wood)
                </button>
                <button
                  type="button"
                  onClick={() => setFoamType('CLASS-B-AFFF')}
                  className={`p-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    foamType === 'CLASS-B-AFFF'
                      ? 'bg-amber-600 text-white border border-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  CLASS B (Hydrocarbon Fuels)
                </button>
              </div>

              {/* Proportioner Rate Buttons: Off, 1%, 3%, 6% */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-slate-400">SELECT PROPORTIONING INJECTION RATE:</span>
                <div className="grid grid-cols-4 gap-2">
                  {(['OFF', '1%', '3%', '6%'] as const).map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        triggerTactileBeep(740, 0.04);
                        setFoamRate(rate);
                      }}
                      className={`py-2 rounded-lg font-black transition-all border cursor-pointer ${
                        foamRate === rate
                          ? 'bg-orange-600 text-white border-white shadow-[0_0_15px_rgba(234,88,12,0.6)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {rate}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800">
                {foamRate === 'OFF' && 'Proportioner valve closed. Pure water delivered to handlines.'}
                {foamRate === '1%' && '1% injection rate active. Optimized for structural penetration & deep-seated ember knockdown.'}
                {foamRate === '3%' && '3% injection rate active. Recommended for gasoline, diesel, and hydrocarbon spill blankets.'}
                {foamRate === '6%' && '6% injection rate active. Required for polar solvent / alcohol fires and high vapor suppression.'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Master Pump Intake & Discharge Pressure Gauges (6 Cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <h3 className="text-sm font-black font-mono text-white uppercase tracking-wider">
                  MASTER PUMP DISCHARGE & INTAKE GAUGES
                </h3>
              </div>

              {/* Governor Mode Switch */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => setGovernorMode('PRESSURE')}
                  className={`px-2 py-1 rounded font-bold cursor-pointer ${
                    governorMode === 'PRESSURE'
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PRESSURE GOVERNOR
                </button>
                <button
                  type="button"
                  onClick={() => setGovernorMode('RPM')}
                  className={`px-2 py-1 rounded font-bold cursor-pointer ${
                    governorMode === 'RPM' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  RPM CRUISE
                </button>
              </div>
            </div>

            {/* Gauges Side by Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Intake Pressure Gauge */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center font-mono">
                <span className="text-[11px] text-slate-400 font-bold mb-2">
                  MASTER INTAKE (COMPOUND)
                </span>

                <div className="w-32 h-32 rounded-full border-4 border-slate-700 bg-slate-900 flex flex-col items-center justify-center relative shadow-inner">
                  <span className="text-2xl font-black text-sky-400">{intakePsi}</span>
                  <span className="text-[10px] text-slate-400">PSI / IN HG</span>
                  <div className="text-[9px] text-emerald-400 mt-1">POSITIVE HEAD</div>
                </div>

                <div className="w-full mt-3 flex flex-col gap-1 text-xs">
                  <div className="flex justify-between text-slate-400 text-[10px]">
                    <span>INTAKE PSI:</span>
                    <span className="text-sky-400 font-bold">{intakePsi} PSI</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={intakePsi}
                    onChange={(e) => setIntakePsi(Number(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Discharge Pressure Gauge */}
              <div className="p-4 rounded-xl bg-slate-950 border border-orange-500/40 flex flex-col items-center text-center font-mono shadow-[0_0_15px_rgba(234,88,12,0.2)]">
                <span className="text-[11px] text-orange-400 font-bold mb-2">
                  MASTER DISCHARGE (PRESSURE)
                </span>

                <div className="w-32 h-32 rounded-full border-4 border-orange-500 bg-slate-900 flex flex-col items-center justify-center relative shadow-[0_0_20px_rgba(234,88,12,0.3)]">
                  <span className="text-3xl font-black text-white">{dischargePsi}</span>
                  <span className="text-[10px] text-orange-400 font-bold">PSI DISCHARGE</span>
                  <div className="text-[9px] text-amber-400 mt-1">GOVERNED</div>
                </div>

                <div className="w-full mt-3 flex flex-col gap-1 text-xs">
                  <div className="flex justify-between text-slate-400 text-[10px]">
                    <span>DISCHARGE PSI GOVERNOR:</span>
                    <span className="text-orange-400 font-bold">{dischargePsi} PSI</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="350"
                    step="5"
                    value={dischargePsi}
                    onChange={(e) => setDischargePsi(Number(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Attack Discharge Line Pressure Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">CROSSLAY 1 (1.75")</span>
                <span className="font-bold text-white">140 PSI</span>
                <span className="text-[9px] text-emerald-400 block">Flowing 150 GPM</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">CROSSLAY 2 (1.75")</span>
                <span className="font-bold text-white">140 PSI</span>
                <span className="text-[9px] text-slate-500 block">Line Charged</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">BLITZ ATTACK (2.5")</span>
                <span className="font-bold text-white">160 PSI</span>
                <span className="text-[9px] text-slate-500 block">Standby</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">DECK GUN MONITOR</span>
                <span className="font-bold text-white">180 PSI</span>
                <span className="text-[9px] text-slate-500 block">Deck Valve Closed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. SCBA 4,500 PSI Readiness Inspection Checklist */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-black font-mono text-white uppercase tracking-wider">
              SCBA 4,500 PSI FIELD READINESS CHECKLIST (NFPA 1852 STANDARD)
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleScbaSignOff}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-black uppercase tracking-wider border border-emerald-400 shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>SIGN OFF SCBA READINESS</span>
              <span>✓</span>
            </button>
          </div>
        </div>

        {signOffStatus && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 font-mono text-xs font-bold animate-bounce">
            {signOffStatus}
          </div>
        )}

        {/* SCBA Inspection Table / Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          {scbaRoster.map((item) => {
            const isFull = item.pressurePsi >= 4050; // >=90% of 4500

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 text-[10px] font-bold">
                      {item.cylinderCode}
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">{item.assignedPosition}</h4>
                  </div>
                  <span
                    className={`text-xs font-black px-2 py-1 rounded ${
                      isFull ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {item.pressurePsi} PSI
                  </span>
                </div>

                {/* Readiness Tests Interactive Checkboxes */}
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={item.passAlarmTest}
                      onChange={() => handleToggleScbaField(item.id, 'passAlarmTest')}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px]">PASS Alarm & Vibralert Checked</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={item.lowAirWhistleTest}
                      onChange={() => handleToggleScbaField(item.id, 'lowAirWhistleTest')}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px]">Low Air Whistle Test Passed</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={item.maskSealOk}
                      onChange={() => handleToggleScbaField(item.id, 'maskSealOk')}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px]">Positive Pressure Facepiece Seal</span>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>HYDRO TEST: {item.cylinderHydroTestYear}</span>
                  <span className="text-emerald-400 font-bold">BATTERY: {item.batteryStatus}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ApparatusTelemetryPage;
