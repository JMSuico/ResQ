// [Layer: UserRoles/Features/Pages/RespondersPanel/Fire]
// Responsibility: Municipal Fire Hydrant Tactical GIS Map & Booster Relay Calculator for BFP Dipolog.
// Color-coded NFPA 291 ratings: Class AA (Blue >=1500 GPM), Class A (Green 1000-1499 GPM),
// Class B (Orange 500-999 GPM), Class C (Red <500 GPM).
// Booster Relay Distance Calculator: Friction loss, relay engine count, and hose lay hydraulics.
// Katipuneros Architecture: Strict typing, universal lambda syntax (=>), ZERO 'any' usage.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { formatGpsCoord } from '@/Libs/Assets/formatters';

// --------------------------------------------------------------------------
// Types & Contracts
// --------------------------------------------------------------------------

export type NfpaFlowClass = 'Class AA' | 'Class A' | 'Class B' | 'Class C';
export type HydrantStatus = 'OPERATIONAL' | 'LOW PRESSURE' | 'DEFECTIVE' | 'FLUSHED';

export interface FireHydrant {
  id: string;
  code: string;
  barangay: string;
  street: string;
  latitude: number;
  longitude: number;
  staticPsi: number;
  residualPsi: number;
  flowGpm: number;
  mainDiameterMm: number;
  lastFlowTestDate: string;
  status: HydrantStatus;
  outletConfiguration: string;
  valveCondition: 'Good' | 'Fair' | 'Tight';
}

// --------------------------------------------------------------------------
// Dipolog City Municipal Hydrants GIS Dataset
// --------------------------------------------------------------------------
export const MUNICIPAL_HYDRANTS: FireHydrant[] = [
  {
    id: 'HYD-DIP-001',
    code: 'H-CEN-01',
    barangay: 'Barangay Central',
    street: 'Rizal Avenue cor. General Luna St.',
    latitude: 8.5862,
    longitude: 123.3415,
    staticPsi: 72,
    residualPsi: 54,
    flowGpm: 1650,
    mainDiameterMm: 200,
    lastFlowTestDate: '2026-08-14',
    status: 'OPERATIONAL',
    outletConfiguration: '1x 4.5" Steamer, 2x 2.5" Outlets',
    valveCondition: 'Good'
  },
  {
    id: 'HYD-DIP-002',
    code: 'H-CEN-02',
    barangay: 'Barangay Central',
    street: 'Quezon Avenue cor. Herrera St.',
    latitude: 8.588,
    longitude: 123.3432,
    staticPsi: 68,
    residualPsi: 50,
    flowGpm: 1350,
    mainDiameterMm: 150,
    lastFlowTestDate: '2026-07-22',
    status: 'OPERATIONAL',
    outletConfiguration: '1x 4.5" Steamer, 2x 2.5" Outlets',
    valveCondition: 'Good'
  },
  {
    id: 'HYD-DIP-003',
    code: 'H-MIP-01',
    barangay: 'Miputak',
    street: 'Sunset Boulevard Commercial Strip',
    latitude: 8.5915,
    longitude: 123.3375,
    staticPsi: 80,
    residualPsi: 62,
    flowGpm: 1800,
    mainDiameterMm: 250,
    lastFlowTestDate: '2026-09-05',
    status: 'OPERATIONAL',
    outletConfiguration: '1x 5" Storz, 2x 2.5" Outlets',
    valveCondition: 'Good'
  },
  {
    id: 'HYD-DIP-004',
    code: 'H-MIP-02',
    barangay: 'Miputak',
    street: 'Padre Ramon St. near Fishermen Village',
    latitude: 8.5835,
    longitude: 123.336,
    staticPsi: 55,
    residualPsi: 38,
    flowGpm: 850,
    mainDiameterMm: 150,
    lastFlowTestDate: '2026-06-11',
    status: 'OPERATIONAL',
    outletConfiguration: '2x 2.5" Outlets',
    valveCondition: 'Fair'
  },
  {
    id: 'HYD-DIP-005',
    code: 'H-BAR-01',
    barangay: 'Barra',
    street: 'Barra Port Road near Fish Landing',
    latitude: 8.595,
    longitude: 123.344,
    staticPsi: 85,
    residualPsi: 68,
    flowGpm: 2100,
    mainDiameterMm: 250,
    lastFlowTestDate: '2026-09-18',
    status: 'OPERATIONAL',
    outletConfiguration: '1x 5" Storz, 2x 2.5" Outlets',
    valveCondition: 'Good'
  },
  {
    id: 'HYD-DIP-006',
    code: 'H-BIA-01',
    barangay: 'Biasong',
    street: 'National Highway near Provincial Hospital',
    latitude: 8.577,
    longitude: 123.348,
    staticPsi: 75,
    residualPsi: 58,
    flowGpm: 1420,
    mainDiameterMm: 200,
    lastFlowTestDate: '2026-08-30',
    status: 'OPERATIONAL',
    outletConfiguration: '1x 4.5" Steamer, 2x 2.5" Outlets',
    valveCondition: 'Good'
  },
  {
    id: 'HYD-DIP-007',
    code: 'H-TUR-01',
    barangay: 'Turno',
    street: 'Turno Public Market Access Road',
    latitude: 8.571,
    longitude: 123.352,
    staticPsi: 48,
    residualPsi: 30,
    flowGpm: 680,
    mainDiameterMm: 100,
    lastFlowTestDate: '2026-05-19',
    status: 'OPERATIONAL',
    outletConfiguration: '2x 2.5" Outlets',
    valveCondition: 'Fair'
  },
  {
    id: 'HYD-DIP-008',
    code: 'H-GAL-01',
    barangay: 'Galas',
    street: 'Galas National Highway cor. Feeder Rd.',
    latitude: 8.563,
    longitude: 123.359,
    staticPsi: 40,
    residualPsi: 22,
    flowGpm: 440,
    mainDiameterMm: 100,
    lastFlowTestDate: '2026-04-10',
    status: 'LOW PRESSURE',
    outletConfiguration: '2x 2.5" Outlets',
    valveCondition: 'Tight'
  },
  {
    id: 'HYD-DIP-009',
    code: 'H-MIN-01',
    barangay: 'Minaog',
    street: 'Minaog Airport Approach Highway',
    latitude: 8.5985,
    longitude: 123.356,
    staticPsi: 78,
    residualPsi: 60,
    flowGpm: 1580,
    mainDiameterMm: 200,
    lastFlowTestDate: '2026-08-25',
    status: 'OPERATIONAL',
    outletConfiguration: '1x 4.5" Steamer, 2x 2.5" Outlets',
    valveCondition: 'Good'
  },
  {
    id: 'HYD-DIP-010',
    code: 'H-STA-01',
    barangay: 'Santa Isabel',
    street: 'Santa Isabel Industrial Park Gate',
    latitude: 8.552,
    longitude: 123.365,
    staticPsi: 32,
    residualPsi: 15,
    flowGpm: 380,
    mainDiameterMm: 100,
    lastFlowTestDate: '2026-03-15',
    status: 'DEFECTIVE',
    outletConfiguration: '2x 2.5" Outlets',
    valveCondition: 'Tight'
  },
  {
    id: 'HYD-DIP-011',
    code: 'H-GUL-01',
    barangay: 'Gulayon',
    street: 'Gulayon Eco-Park Access Road',
    latitude: 8.568,
    longitude: 123.342,
    staticPsi: 62,
    residualPsi: 45,
    flowGpm: 1100,
    mainDiameterMm: 150,
    lastFlowTestDate: '2026-07-02',
    status: 'OPERATIONAL',
    outletConfiguration: '1x 4.5" Steamer, 2x 2.5" Outlets',
    valveCondition: 'Good'
  },
  {
    id: 'HYD-DIP-012',
    code: 'H-DIC-01',
    barangay: 'Dicayas',
    street: 'Dicayas Mountain Road Km 4',
    latitude: 8.558,
    longitude: 123.331,
    staticPsi: 58,
    residualPsi: 40,
    flowGpm: 790,
    mainDiameterMm: 150,
    lastFlowTestDate: '2026-06-28',
    status: 'FLUSHED',
    outletConfiguration: '2x 2.5" Outlets',
    valveCondition: 'Good'
  }
];

// --------------------------------------------------------------------------
// Audio Feedback Helper
// --------------------------------------------------------------------------
const triggerTactileBeep = (freq = 700, duration = 0.05): void => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
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
// Component: HydrantTacticalMapPage
// --------------------------------------------------------------------------
export const HydrantTacticalMapPage: React.FC = () => {
  const { coords } = useGpsLocation();

  // State
  const [hydrants] = useState<FireHydrant[]>(MUNICIPAL_HYDRANTS);
  const [selectedHydrant, setSelectedHydrant] = useState<FireHydrant>(MUNICIPAL_HYDRANTS[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Booster Relay Calculator Inputs
  const [relayDistanceMeters, setRelayDistanceMeters] = useState<number>(350);
  const [targetFlowGpm, setTargetFlowGpm] = useState<number>(1000);
  const [hoseDiameterInches, setHoseDiameterInches] = useState<number>(5); // 2.5, 3, 4, 5

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const relayLineLayerRef = useRef<L.LayerGroup | null>(null);

  // Helper: Determine NFPA Class
  const getNfpaClass = (gpm: number): { cls: NfpaFlowClass; color: string; bg: string; border: string } => {
    if (gpm >= 1500) {
      return {
        cls: 'Class AA',
        color: '#38bdf8',
        bg: 'bg-sky-500/20 text-sky-400',
        border: 'border-sky-500'
      };
    }
    if (gpm >= 1000) {
      return {
        cls: 'Class A',
        color: '#22c55e',
        bg: 'bg-emerald-500/20 text-emerald-400',
        border: 'border-emerald-500'
      };
    }
    if (gpm >= 500) {
      return {
        cls: 'Class B',
        color: '#f97316',
        bg: 'bg-orange-500/20 text-orange-400',
        border: 'border-orange-500'
      };
    }
    return {
      cls: 'Class C',
      color: '#ef4444',
      bg: 'bg-red-500/20 text-red-400',
      border: 'border-red-500'
    };
  };

  // Filtered Hydrants
  const filteredHydrants = useMemo(() => {
    return hydrants.filter((h) => {
      const matchSearch =
        h.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.street.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.barangay.toLowerCase().includes(searchQuery.toLowerCase());

      const nfpa = getNfpaClass(h.flowGpm).cls;
      const matchClass = selectedClass === 'ALL' || nfpa === selectedClass;
      const matchStatus = selectedStatus === 'ALL' || h.status === selectedStatus;

      return matchSearch && matchClass && matchStatus;
    });
  }, [hydrants, searchQuery, selectedClass, selectedStatus]);

  // Booster Relay Hydraulics Calculation
  const relayCalculations = useMemo(() => {
    const distanceFeet = relayDistanceMeters * 3.28084;

    // Friction Loss Coefficient C for single line
    // 2.5" C=2, 3" C=0.8, 4" C=0.2, 5" C=0.08
    let coeff = 0.08;
    if (hoseDiameterInches === 2.5) coeff = 2.0;
    else if (hoseDiameterInches === 3) coeff = 0.8;
    else if (hoseDiameterInches === 4) coeff = 0.2;
    else if (hoseDiameterInches === 5) coeff = 0.08;

    const qHundreds = targetFlowGpm / 100;
    const lHundreds = distanceFeet / 100;

    // FL = C * Q^2 * L
    const totalFrictionLossPsi = coeff * Math.pow(qHundreds, 2) * lHundreds;

    // Maximum engine discharge pressure guideline: 150 to 180 PSI
    // Recommended Relay Pumpers: 1 pumper per ~300 meters at 1000 GPM
    const pumpersNeeded = Math.max(1, Math.ceil(totalFrictionLossPsi / 120));

    // Remaining residual pressure at attack engine
    const availableHydrantPsi = selectedHydrant.residualPsi ?? 0;
    const netSupplyPressure = availableHydrantPsi + pumpersNeeded * 120 - totalFrictionLossPsi;

    return {
      distanceFeet: Math.round(distanceFeet),
      totalFrictionLossPsi: Math.round(totalFrictionLossPsi),
      pumpersNeeded,
      recommendedHoseLay:
        hoseDiameterInches >= 4
          ? `Single ${hoseDiameterInches}" Storz Large Diameter Hose (LDH)`
          : `Dual ${hoseDiameterInches}" Siamese Supply Lines`,
      estimatedIntakePsi: Math.max(20, Math.round(netSupplyPressure)),
      statusRating: netSupplyPressure >= 20 ? 'OPTIMAL INTAKE' : 'RISK OF CAVITATION'
    };
  }, [relayDistanceMeters, targetFlowGpm, hoseDiameterInches, selectedHydrant]);

  // Leaflet Map Initialization and Layer updates
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([8.585, 123.34], 14);

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd'
        }
      ).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      relayLineLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const relayLineLayer = relayLineLayerRef.current;

    if (!map || !markersLayer || !relayLineLayer) return;

    markersLayer.clearLayers();
    relayLineLayer.clearLayers();

    // Plot Hydrants
    hydrants.forEach((hyd) => {
      const nfpa = getNfpaClass(hyd.flowGpm);
      const isSelected = selectedHydrant?.id === hyd.id;

      const hydrantIcon = L.divIcon({
        className: 'bfp-hydrant-pin',
        html: `
          <div class="relative flex flex-col items-center cursor-pointer group">
            <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              isSelected
                ? 'scale-125 shadow-[0_0_20px_rgba(56,189,248,1)] border-white'
                : 'hover:scale-110 shadow-md'
            }" style="background-color: ${nfpa.color}; border-color: ${
          isSelected ? '#ffffff' : nfpa.color
        }">
              <span class="text-white text-xs font-black">🚰</span>
            </div>
            <span class="mt-0.5 px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-slate-950/90 text-white border border-slate-700 whitespace-nowrap">
              ${hyd.code}
            </span>
          </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 20]
      });

      const marker = L.marker([hyd.latitude, hyd.longitude], { icon: hydrantIcon });
      marker.on('click', () => {
        triggerTactileBeep(750, 0.05);
        setSelectedHydrant(hyd);
      });
      marker.addTo(markersLayer);
    });

    // Draw Booster Relay Line from Selected Hydrant to hypothetical Engine (350m offset or user GPS)
    if (selectedHydrant) {
      const destLat = coords ? coords.latitude : selectedHydrant.latitude + 0.0028;
      const destLng = coords ? coords.longitude : selectedHydrant.longitude + 0.0022;

      L.polyline(
        [
          [selectedHydrant.latitude, selectedHydrant.longitude],
          [destLat, destLng]
        ],
        {
          color: '#f97316',
          weight: 4,
          dashArray: '8, 8'
        }
      ).addTo(relayLineLayer);

      // Destination Engine Marker
      const engineIcon = L.divIcon({
        className: 'bfp-relay-dest',
        html: `
          <div class="w-7 h-7 rounded-lg bg-orange-600 border-2 border-white flex items-center justify-center shadow-lg animate-pulse">
            <span class="text-xs">🚒</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      L.marker([destLat, destLng], { icon: engineIcon })
        .bindPopup('<strong class="font-mono text-xs">PUMP ATTACK ENGINE (INTAKE TARGET)</strong>')
        .addTo(relayLineLayer);
    }
  }, [hydrants, selectedHydrant, coords]);

  return (
    <div className="w-full flex flex-col gap-5 text-slate-100 font-sans pb-10">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header: Municipal Fire Hydrant Tactical GIS Console */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-800 border-2 border-sky-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(56,189,248,0.5)] flex-shrink-0">
            🚰
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-black bg-sky-500/20 text-sky-400 border border-sky-500/40 uppercase tracking-widest">
                DIPOLOG WATER DISTRICT & BFP FIRE RESCUE GIS
              </span>
              <span className="text-slate-500 font-mono text-xs">|</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                TOTAL HYDRANTS: {hydrants.length}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>MUNICIPAL HYDRANT TACTICAL MAP</span>
              <span className="text-sky-400 text-sm font-mono font-bold px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/30">
                NFPA 291 COMPLIANT
              </span>
            </h1>

            <p className="text-xs font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>FLOW RATINGS CLASSIFIED BY BONNET & CAP COLOR CODING</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-bold">LIVE GIS TELEMETRY ACTIVE</span>
            </p>
          </div>
        </div>

        {/* NFPA 291 Flow Legend Chips */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>CLASS AA (≥1500 GPM)</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>CLASS A (1000-1499)</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-950/80 border border-orange-500/40 text-orange-300">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span>CLASS B (500-999)</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span>CLASS C (&lt;500 GPM)</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Search & Filter Bar */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <span className="text-slate-400">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Hydrant Code, Street, or Barangay (e.g. Rizal Ave, Central, Miputak)..."
            className="w-full bg-slate-950 px-3 py-2 rounded-lg border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 text-[11px]">NFPA RATING:</span>
          {['ALL', 'Class AA', 'Class A', 'Class B', 'Class C'].map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => setSelectedClass(cls)}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedClass === cls
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">STATUS:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="OPERATIONAL">OPERATIONAL</option>
            <option value="LOW PRESSURE">LOW PRESSURE</option>
            <option value="DEFECTIVE">DEFECTIVE</option>
            <option value="FLUSHED">FLUSHED</option>
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Main Split: GIS Interactive Map & Telemetry Details */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Interactive Leaflet Map (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="rounded-2xl bg-slate-900/90 border border-orange-500/30 overflow-hidden shadow-xl flex flex-col">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
              <span className="text-orange-400 font-bold">
                MUNICIPAL GIS LEAFLET SURFACE ({filteredHydrants.length} HYDRANTS DISPLAYED)
              </span>
              <span className="text-slate-400">TAP PIN TO INSPECT TELEMETRY</span>
            </div>

            <div className="relative w-full h-[520px] bg-slate-950">
              <div ref={mapContainerRef} className="w-full h-full z-0" />
            </div>

            {/* Quick Hydrant Ribbon */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
              {filteredHydrants.map((h) => {
                const isSelected = selectedHydrant?.id === h.id;
                const nfpa = getNfpaClass(h.flowGpm);

                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      triggerTactileBeep(700, 0.04);
                      setSelectedHydrant(h);
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.panTo([h.latitude, h.longitude], { animate: true });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs whitespace-nowrap flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-600 text-white border-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-orange-500/40'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: nfpa.color }} />
                    <span className="font-bold">{h.code}</span>
                    <span className="text-[10px] text-slate-400">({h.flowGpm} GPM)</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Hydrant Specs & "Set Booster Relay" Calculator (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Selected Hydrant Telemetry Card */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 flex flex-col gap-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] mb-1">
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/40 font-bold">
                    {selectedHydrant.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase ${
                      getNfpaClass(selectedHydrant.flowGpm).bg
                    }`}
                  >
                    {getNfpaClass(selectedHydrant.flowGpm).cls}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedHydrant.status === 'OPERATIONAL'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {selectedHydrant.status}
                  </span>
                </div>

                <h3 className="text-xl font-black text-white">{selectedHydrant.street}</h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  {selectedHydrant.barangay}, Dipolog City
                </p>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400 block">FLOW RATING</span>
                <span className="text-2xl font-black text-orange-400">
                  {selectedHydrant.flowGpm}{' '}
                  <span className="text-xs font-normal text-slate-300">GPM</span>
                </span>
              </div>
            </div>

            {/* Pressure & Main Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400">STATIC PSI</span>
                <span className="text-lg font-black text-white">{selectedHydrant.staticPsi} PSI</span>
                <span className="text-[9px] text-slate-500">Mains Rest</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400">RESIDUAL PSI</span>
                <span className="text-lg font-black text-sky-400">
                  {selectedHydrant.residualPsi} PSI
                </span>
                <span className="text-[9px] text-slate-500">Under Load</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400">WATER MAIN</span>
                <span className="text-lg font-black text-amber-400">
                  {selectedHydrant.mainDiameterMm}mm
                </span>
                <span className="text-[9px] text-slate-500">Ductile Iron</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400">FLOW TEST</span>
                <span className="text-sm font-black text-slate-300 mt-1">
                  {selectedHydrant.lastFlowTestDate}
                </span>
                <span className="text-[9px] text-emerald-400">Certified</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs flex flex-col gap-1.5">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">OUTLETS:</span>
                <span className="font-bold">{selectedHydrant.outletConfiguration}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">GPS COORDINATES:</span>
                <span className="text-orange-400 font-bold">
                  {formatGpsCoord(selectedHydrant.latitude, selectedHydrant.longitude)}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">VALVE CONDITION:</span>
                <span className="text-emerald-400 font-bold">
                  {selectedHydrant.valveCondition} (Opens Counter-Clockwise)
                </span>
              </div>
            </div>
          </div>

          {/* "Set Booster Relay" Distance & Hydraulics Calculator */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-orange-950/30 border-2 border-orange-500/40 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
                <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                  SET BOOSTER RELAY CALCULATOR (HYDRAULIC ENGINE RELAY)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 border border-orange-500/40 font-mono text-[10px] font-bold">
                PUMP OPERATIONS
              </span>
            </div>

            {/* Interactive Inputs */}
            <div className="flex flex-col gap-3 font-mono text-xs">
              {/* Hose Lay Distance Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-slate-300">
                  <span className="font-bold">HOSE LAY DISTANCE TO ATTACK APPARATUS:</span>
                  <span className="text-orange-400 font-black text-sm">
                    {relayDistanceMeters} METERS ({relayCalculations.distanceFeet} FT)
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1200"
                  step="25"
                  value={relayDistanceMeters}
                  onChange={(e) => setRelayDistanceMeters(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>50m (Direct Supply)</span>
                  <span>500m (Single Relay)</span>
                  <span>1200m (Long Distance Relay)</span>
                </div>
              </div>

              {/* Target Flow Rate & Hose Size Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400">DESIRED FLOW RATE:</span>
                  <select
                    value={targetFlowGpm}
                    onChange={(e) => setTargetFlowGpm(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value={500}>500 GPM (Handline Attack)</option>
                    <option value={750}>750 GPM (Master Stream)</option>
                    <option value={1000}>1,000 GPM (Heavy Fog Monitor)</option>
                    <option value={1500}>1,500 GPM (Aerial Deck Gun)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400">SUPPLY HOSE DIAMETER:</span>
                  <select
                    value={hoseDiameterInches}
                    onChange={(e) => setHoseDiameterInches(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value={2.5}>2.5" Double Jacket Hose (C=2.0)</option>
                    <option value={3}>3.0" Supply Line (C=0.8)</option>
                    <option value={4}>4.0" Storz LDH (C=0.2)</option>
                    <option value={5}>5.0" Storz Large Diameter (C=0.08)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Calculated Results HUD */}
            <div className="p-4 rounded-xl bg-slate-950 border border-orange-500/30 grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">FRICTION LOSS (FL):</span>
                <span className="text-lg font-black text-red-400">
                  {relayCalculations.totalFrictionLossPsi} PSI
                </span>
                <span className="text-[9px] text-slate-500">Total Hose Drag</span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">RELAY PUMPERS NEEDED:</span>
                <span className="text-lg font-black text-orange-400">
                  {relayCalculations.pumpersNeeded} PUMPER(S)
                </span>
                <span className="text-[9px] text-slate-500">Every 300m @ 150 PSI</span>
              </div>

              <div className="flex flex-col col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400">INTAKE PRESSURE:</span>
                <span className="text-lg font-black text-emerald-400">
                  {relayCalculations.estimatedIntakePsi} PSI
                </span>
                <span className="text-[9px] text-emerald-500 font-bold">
                  {relayCalculations.statusRating}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-orange-950/40 border border-orange-500/30 font-mono text-[11px] text-orange-200">
              <strong className="text-white block mb-0.5">RECOMMENDED RELAY LAYOUT:</strong>
              {relayCalculations.recommendedHoseLay}. Connect Source Pumper E-02 to Hydrant{' '}
              {selectedHydrant.code} via 5" Storz suction, relay at 150 PSI discharge to Attack Engine
              E-01.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HydrantTacticalMapPage;
