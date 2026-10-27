// [Layer: UserRoles/Features/Pages/RespondersPanel/Police]
// Responsibility: Crime Scene Cordon, Perimeter Security, Checkpoints & Traffic Diversion Hub.
// Tactical Leaflet GIS with Inner Cordon (Hot Zone - 50m), Outer Cordon (150m), Traffic Diversion (300m),
// and Dipolog City entry/exit checkpoint security status.

import React, { useState, useEffect, useRef } from 'react';
import { Crosshair, ShieldAlert, Shield, MapPin, Navigation, Radio } from 'lucide-react';
import { useSession } from '@/Hooks/useSession';
import { formatGpsCoord } from '@/Libs/Assets/formatters';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface CheckpointUnit {
  id: string;
  name: string;
  location: string;
  barangay: string;
  lat: number;
  lng: number;
  status: 'ROUTINE CHECK' | '100% VEHICLE SEARCH' | 'LOCKDOWN';
  mannedBy: string;
  supervisor: string;
  vehiclesInspected: number;
}

interface ActiveCordon {
  id: string;
  title: string;
  incidentType: string;
  lat: number;
  lng: number;
  innerRadius: number; // 50m
  outerRadius: number; // 150m
  diversionRadius: number; // 300m
  establishedAt: string;
  leadInvestigator: string;
  status: 'ACTIVE CORDON' | 'SOCO PROCESSING' | 'STAND DOWN';
}

interface RoadBlockade {
  id: string;
  streetName: string;
  barangay: string;
  diversionRoute: string;
  assignedCar: string;
  status: 'CLOSED' | 'PARTIAL DETOUR' | 'CLEARED';
}

const INITIAL_CHECKPOINTS: CheckpointUnit[] = [
  {
    id: 'chk-barra',
    name: 'Barangay Barra Coastal Checkpoint',
    location: 'Coastal Highway, Barra Border',
    barangay: 'Barangay Barra',
    lat: 8.5912,
    lng: 123.3289,
    status: 'ROUTINE CHECK',
    mannedBy: '4 PNP Personnel + 2 BPAT',
    supervisor: 'PSSg J. Balbuena',
    vehiclesInspected: 142
  },
  {
    id: 'chk-minaog',
    name: 'Barangay Minaog Airport Checkpoint',
    location: 'Airport Access Road, Minaog',
    barangay: 'Barangay Minaog',
    lat: 8.6015,
    lng: 123.3491,
    status: '100% VEHICLE SEARCH',
    mannedBy: '6 PNP Personnel + 1 K9 Unit',
    supervisor: 'PMSg C. Villamor',
    vehiclesInspected: 218
  },
  {
    id: 'chk-galas',
    name: 'Barangay Galas Highway Checkpoint',
    location: 'National Highway, Galas-Polanco Line',
    barangay: 'Barangay Galas',
    lat: 8.5631,
    lng: 123.3612,
    status: 'ROUTINE CHECK',
    mannedBy: '4 PNP Personnel + 2 TMU',
    supervisor: 'PCpl K. Mendoza',
    vehiclesInspected: 189
  },
  {
    id: 'chk-olingan',
    name: 'Barangay Olingan Southwest Checkpoint',
    location: 'National Highway, Olingan Border',
    barangay: 'Barangay Olingan',
    lat: 8.5421,
    lng: 123.3184,
    status: 'ROUTINE CHECK',
    mannedBy: '4 PNP Personnel',
    supervisor: 'PSSg N. Torralba',
    vehiclesInspected: 94
  }
];

export const TacticalPerimeterMapPage: React.FC = () => {
  const { session } = useSession();
  const [checkpoints, setCheckpoints] = useState<CheckpointUnit[]>(INITIAL_CHECKPOINTS);
  const [activeCordon, setActiveCordon] = useState<ActiveCordon | null>({
    id: 'cordon-01',
    title: 'Major Crime Scene Investigation - Commercial Robbery',
    incidentType: 'Armed Robbery',
    lat: 8.5862,
    lng: 123.3421,
    innerRadius: 50,
    outerRadius: 150,
    diversionRadius: 300,
    establishedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    leadInvestigator: session?.fullName || 'PMAJ Marco Santillan',
    status: 'ACTIVE CORDON'
  });

  const [cordonCoords, setCordonCoords] = useState<{ lat: number; lng: number }>({
    lat: 8.5862,
    lng: 123.3421
  });

  const [blockades, setBlockades] = useState<RoadBlockade[]>([
    {
      id: 'blk-01',
      streetName: 'Rizal Avenue (Between Herrera & Echavez)',
      barangay: 'Barangay Central',
      diversionRoute: 'Detour via Gen. Luna St. to Sunset Blvd.',
      assignedCar: 'PATROL-01 (ALPHA)',
      status: 'CLOSED'
    },
    {
      id: 'blk-02',
      streetName: 'Herrera Extension Southbound',
      barangay: 'Barangay Central',
      diversionRoute: 'Reroute to Quezon Ave. Corridor',
      assignedCar: 'MOTOR-01 (CHARLIE)',
      status: 'PARTIAL DETOUR'
    }
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Map references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([8.5833, 123.3417], 13);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      ).addTo(map);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      ).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Click to relocate cordon coordinates
      map.on('click', (e: L.LeafletMouseEvent) => {
        setCordonCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      layersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const group = layersGroupRef.current;
    if (group) {
      group.clearLayers();

      // Render Checkpoints
      checkpoints.forEach((chk) => {
        const isLockdown = chk.status === 'LOCKDOWN';
        const isSearch = chk.status === '100% VEHICLE SEARCH';
        const chkColor = isLockdown ? '#ef4444' : isSearch ? '#f59e0b' : '#3b82f6';

        const chkIcon = L.divIcon({
          className: 'custom-chk-icon',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:${chkColor};border:2px solid #ffffff;border-radius:8px;color:white;box-shadow:0 0 14px ${chkColor};font-size:15px;font-weight:bold;">
            🛑
          </div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const chkMarker = L.marker([chk.lat, chk.lng], { icon: chkIcon });
        chkMarker.bindPopup(`
          <div style="font-family:Inter,sans-serif;color:#0f172a;min-width:210px;">
            <div style="font-size:10px;font-weight:700;color:${chkColor};letter-spacing:0.05em;text-transform:uppercase;">
              ${chk.status}
            </div>
            <div style="font-weight:700;font-size:13px;margin:2px 0;">${chk.name}</div>
            <div style="font-size:11px;color:#475569;">${chk.location}</div>
            <div style="margin-top:6px;font-size:11px;color:#334155;">
              <b>Manned:</b> ${chk.mannedBy}<br/>
              <b>Supervisor:</b> ${chk.supervisor}<br/>
              <b>Inspections:</b> ${chk.vehiclesInspected} vehicles
            </div>
          </div>
        `);
        group.addLayer(chkMarker);
      });

      // Render Active Cordon Circles
      if (activeCordon && activeCordon.status !== 'STAND DOWN') {
        const center: [number, number] = [activeCordon.lat, activeCordon.lng];

        // Diversion Zone (Cold Zone - 300m)
        const coldCircle = L.circle(center, {
          radius: activeCordon.diversionRadius,
          color: '#06b6d4',
          weight: 1.5,
          fillColor: '#0891b2',
          fillOpacity: 0.12,
          dashArray: '6, 6'
        });
        coldCircle.bindTooltip('<b>COLD ZONE (300m)</b><br/>Traffic Diversion & Perimeter Barrier', {
          permanent: false
        });
        group.addLayer(coldCircle);

        // Outer Cordon (Warm Zone - 150m)
        const warmCircle = L.circle(center, {
          radius: activeCordon.outerRadius,
          color: '#f59e0b',
          weight: 2,
          fillColor: '#d97706',
          fillOpacity: 0.2,
          dashArray: '4, 4'
        });
        warmCircle.bindTooltip('<b>WARM ZONE (150m)</b><br/>Tactical Command & EMS Staging Area', {
          permanent: false
        });
        group.addLayer(warmCircle);

        // Inner Cordon (Hot Zone - 50m)
        const hotCircle = L.circle(center, {
          radius: activeCordon.innerRadius,
          color: '#ef4444',
          weight: 3,
          fillColor: '#dc2626',
          fillOpacity: 0.35
        });
        hotCircle.bindTooltip('<b>HOT ZONE (50m - SOCO ONLY)</b><br/>Strict Forensic Quarantine', {
          permanent: false
        });
        group.addLayer(hotCircle);

        // Center Marker
        const cordonIcon = L.divIcon({
          className: 'custom-cordon-epicenter',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:#dc2626;border:3px solid #ffffff;border-radius:50%;color:white;box-shadow:0 0 20px #dc2626;font-size:16px;animation:pulse 1.2s infinite;">
            ⚠️
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const centerMarker = L.marker(center, { icon: cordonIcon });
        centerMarker.bindPopup(`
          <div style="font-family:Inter,sans-serif;color:#0f172a;min-width:220px;">
            <div style="font-size:11px;font-weight:700;color:#dc2626;">ACTIVE CRIME SCENE CORDON</div>
            <div style="font-weight:800;font-size:14px;margin:3px 0;">${activeCordon.title}</div>
            <div style="font-size:11px;color:#475569;">Lead: ${activeCordon.leadInvestigator}</div>
            <div style="font-size:10px;color:#64748b;font-family:monospace;margin-top:4px;">
              ${formatGpsCoord(activeCordon.lat, activeCordon.lng)}
            </div>
            <div style="margin-top:6px;font-size:11px;color:#dc2626;font-weight:bold;">
              ● HOT ZONE: 50m • WARM ZONE: 150m • COLD ZONE: 300m
            </div>
          </div>
        `);
        group.addLayer(centerMarker);
      }
    }
  }, [checkpoints, activeCordon]);

  // Establish Cordon Action
  const handleEstablishCordon = () => {
    setActiveCordon({
      id: `cordon-${Date.now()}`,
      title: 'Established Tactical Crime Scene Cordon',
      incidentType: 'Tactical Perimeter',
      lat: cordonCoords.lat,
      lng: cordonCoords.lng,
      innerRadius: 50,
      outerRadius: 150,
      diversionRadius: 300,
      establishedAt: new Date().toISOString(),
      leadInvestigator: session?.fullName || 'Active Duty Officer',
      status: 'ACTIVE CORDON'
    });

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([cordonCoords.lat, cordonCoords.lng], 16);
    }
    showToast(`✓ CORDON ESTABLISHED at ${formatGpsCoord(cordonCoords.lat, cordonCoords.lng)}`);
  };

  const handleStandDownCordon = () => {
    if (!activeCordon) return;
    setActiveCordon((prev) => (prev ? { ...prev, status: 'STAND DOWN' } : null));
    showToast('Crime scene cordon stood down. Road barricades opened.');
  };

  const handleCycleCheckpointStatus = (chkId: string) => {
    setCheckpoints((prev) =>
      prev.map((c) => {
        if (c.id !== chkId) return c;
        const nextStatus =
          c.status === 'ROUTINE CHECK'
            ? '100% VEHICLE SEARCH'
            : c.status === '100% VEHICLE SEARCH'
            ? 'LOCKDOWN'
            : 'ROUTINE CHECK';
        showToast(`Checkpoint ${c.name} transitioned to ${nextStatus}`);
        return { ...c, status: nextStatus };
      })
    );
  };

  return (
    <div className="flex-1 w-full flex flex-col space-y-5 text-slate-100">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-xl border border-blue-600/30 bg-gradient-to-r from-[#0a1128] via-[#0f1f4b] to-[#0a1128] p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/20 border-2 border-blue-500/50 shadow-inner shadow-blue-500/40">
              <Crosshair className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-400/30">
                  TACTICAL PERIMETER & ROAD CORDON
                </span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  GIS GEOFENCE ACTIVE
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                Crime Scene Cordon & Municipal Checkpoints
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Dipolog City Security Perimeter • Inner Hot Zone / Outer Warm Zone / Traffic Diversion Geofence
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {activeCordon && activeCordon.status !== 'STAND DOWN' ? (
              <button
                type="button"
                onClick={handleStandDownCordon}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-600 transition-all cursor-pointer"
              >
                STAND DOWN CORDON
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleEstablishCordon}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-red-900/60 border border-red-400/60 transition-all cursor-pointer"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>ESTABLISH CORDON AT PIN</span>
            </button>
          </div>
        </div>
      </div>

      {/* INTERACTIVE LEAFLET TACTICAL MAP CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEAFLET MAP VIEWPORT (8 COLS) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span>Interactive Leaflet Cordon & Checkpoint Map (Click to Set Epicenter)</span>
            </span>
            <span className="text-xs font-mono text-blue-400">
              Selected Target: {formatGpsCoord(cordonCoords.lat, cordonCoords.lng)}
            </span>
          </div>

          <div className="relative h-[540px] w-full rounded-xl border border-blue-600/30 overflow-hidden shadow-2xl bg-slate-950">
            <div ref={mapContainerRef} className="h-full w-full" />

            {/* Cordon Legend Floating HUD */}
            <div className="absolute top-4 left-4 z-[1000] rounded-xl border border-slate-700/80 bg-slate-950/90 p-3.5 text-xs font-mono shadow-2xl backdrop-blur-md max-w-sm space-y-2">
              <div className="font-bold text-white uppercase text-[11px] border-b border-slate-800 pb-1.5">
                CORDON PERIMETER SPECIFICATION
              </div>
              <div className="flex items-center space-x-2.5">
                <span className="h-3.5 w-3.5 rounded-full bg-red-600 border border-red-300 flex-shrink-0"></span>
                <span className="text-slate-200">
                  <b>HOT ZONE (50m Radius):</b> SOCO / Forensics & SWAT Only
                </span>
              </div>
              <div className="flex items-center space-x-2.5">
                <span className="h-3.5 w-3.5 rounded-full bg-amber-500 border border-amber-300 flex-shrink-0"></span>
                <span className="text-slate-200">
                  <b>WARM ZONE (150m Radius):</b> Command Post & EMS Staging
                </span>
              </div>
              <div className="flex items-center space-x-2.5">
                <span className="h-3.5 w-3.5 rounded-full bg-cyan-500 border border-cyan-300 flex-shrink-0"></span>
                <span className="text-slate-200">
                  <b>COLD / TRAFFIC (300m Radius):</b> Barricade & Diversion
                </span>
              </div>
              <div className="pt-1 text-[10px] text-slate-400 italic">
                Tip: Click anywhere on the map to place a new cordon target.
              </div>
            </div>
          </div>
        </div>

        {/* SIDE PANEL: CHECKPOINTS & ROAD BLOCKADES (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              City Entry/Exit Checkpoints
            </h2>
            <span className="text-xs font-mono text-blue-400 font-bold">
              {checkpoints.length} STATIONS
            </span>
          </div>

          <div className="space-y-3">
            {checkpoints.map((chk) => {
              const isLockdown = chk.status === 'LOCKDOWN';
              const isSearch = chk.status === '100% VEHICLE SEARCH';

              return (
                <div
                  key={chk.id}
                  className="rounded-xl border border-blue-900/40 bg-[#0a1128]/90 p-4 shadow-md space-y-2 hover:border-blue-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">{chk.name}</div>
                      <div className="text-[11px] text-slate-400">{chk.location}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCycleCheckpointStatus(chk.id)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-tight uppercase transition-all ${
                        isLockdown
                          ? 'bg-red-500 text-white animate-pulse'
                          : isSearch
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}
                      title="Click to toggle status: Routine -> 100% Search -> Lockdown"
                    >
                      {chk.status} ↻
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-800">
                    <div>Supervisor: <span className="text-white font-semibold">{chk.supervisor}</span></div>
                    <div>Inspected: <span className="text-blue-400 font-bold">{chk.vehiclesInspected}</span></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ACTIVE ROAD BLOCKADES */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-mono font-bold uppercase text-slate-300">
                Active Street Barricades
              </h3>
              <span className="text-[10px] font-mono text-red-400 font-bold">
                {blockades.length} DETOURS
              </span>
            </div>

            <div className="space-y-2">
              {blockades.map((blk) => (
                <div
                  key={blk.id}
                  className="rounded-lg border border-red-950 bg-red-950/20 p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-300">{blk.streetName}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-600/30 text-red-300 border border-red-500/40">
                      {blk.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{blk.diversionRoute}</div>
                  <div className="text-[10px] font-mono text-slate-500">Unit: {blk.assignedCar}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-blue-500/50 bg-[#0a1128] px-4 py-3 text-xs font-mono font-bold text-blue-200 shadow-2xl shadow-blue-950/80 animate-slideUp">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default TacticalPerimeterMapPage;
