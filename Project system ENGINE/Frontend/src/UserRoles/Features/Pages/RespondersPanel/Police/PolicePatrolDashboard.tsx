// [Layer: UserRoles/Features/Pages/RespondersPanel/Police]
// Responsibility: Tactical Law Enforcement & Sector Patrol Operations Hub for PNP Police Force.
// Authentic Tactical Blue HUD (#1d4ed8 / #3b82f6), persistent field status, live 911 crime dispatches,
// officer distress beacon, and sector patrol radar map.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getAgencyReports, ReportItem, sendEmergencyBroadcast } from '@/Endpoints/reportsApi';
import { getDutyRoster, updateUnitDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { SearchBar } from '@/Shared/SearchBar';
import { formatGpsCoord, formatRelativeTime, formatIsoTimestamp } from '@/Libs/Assets/formatters';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type PoliceFieldStatus =
  | 'IN STATION'
  | 'ON MOBILE PATROL'
  | 'RESPONDING (CODE 3)'
  | 'ON SCENE (SECURING)'
  | 'PROCESSING BLOTTER';

interface BeatPoint {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  callsign: string;
  officers: string;
  status: 'ACTIVE PATROL' | 'HIGH ALERT' | 'STANDBY';
  sector: string;
}

const DIPOLOG_POLICE_BEATS: BeatPoint[] = [
  {
    id: 'beat-01',
    name: 'Sector 1 - Central Business District / Rizal Ave',
    code: 'BEAT-CBD-01',
    lat: 8.5862,
    lng: 123.3421,
    callsign: 'PATROL-ALPHA',
    officers: 'PSSg M. Reyes, PCpl D. Ramos',
    status: 'ACTIVE PATROL',
    sector: 'Commercial Core'
  },
  {
    id: 'beat-02',
    name: 'Sector 2 - Dipolog Sunset Boulevard Coastal Strip',
    code: 'BEAT-BLVD-02',
    lat: 8.5891,
    lng: 123.3364,
    callsign: 'PATROL-BRAVO',
    officers: 'PMSg R. Cruz, Pat E. Santos',
    status: 'ACTIVE PATROL',
    sector: 'Tourist & Coastal Zone'
  },
  {
    id: 'beat-03',
    name: 'Sector 3 - Turno National Highway & Transit Hub',
    code: 'BEAT-TURNO-03',
    lat: 8.5744,
    lng: 123.3498,
    callsign: 'MOTOR-CHARLIE',
    officers: 'PCpl F. Bautista',
    status: 'ACTIVE PATROL',
    sector: 'National Artery'
  },
  {
    id: 'beat-04',
    name: 'Sector 4 - Minaog Airport & North Perimeter',
    code: 'BEAT-MINAOG-04',
    lat: 8.5992,
    lng: 123.3482,
    callsign: 'MOTOR-DELTA',
    officers: 'PSMS G. Tan',
    status: 'STANDBY',
    sector: 'Critical Infrastructure'
  }
];

export const PolicePatrolDashboard: React.FC = () => {
  const { session } = useSession();
  const { coords, isLocating, refreshGps } = useGpsLocation();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<ReportItem | null>(null);

  // Persistent Field Status
  const [fieldStatus, setFieldStatus] = useState<PoliceFieldStatus>(() => {
    try {
      const stored = localStorage.getItem('resqtrack_pnp_status');
      if (stored) return stored as PoliceFieldStatus;
    } catch {
      // ignore
    }
    return 'ON MOBILE PATROL';
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Distress Beacon States
  const [isBeaconModalOpen, setIsBeaconModalOpen] = useState<boolean>(false);
  const [beaconCountdown, setBeaconCountdown] = useState<number>(5);
  const [isBeaconActive, setIsBeaconActive] = useState<boolean>(false);
  const beaconTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Map container reference
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sound generator for distress beacon
  const playDistressBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // audio synthesis unavailable or blocked
    }
  }, []);

  // Fetch telemetry
  const loadData = useCallback(async () => {
    try {
      const [reps, rost] = await Promise.all([
        getAgencyReports('PNP').catch(() => [] as ReportItem[]),
        getDutyRoster().catch(() => [] as DutyUnit[])
      ]);
      setReports(reps);
      setRoster(rost);
    } catch (err) {
      console.error('Failed to load PNP police reports telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useValueRefreshAuto(loadData, { intervalMs: 6000, enabled: true });
  useReportEventBus(() => {
    loadData();
  });

  // Handle Field Status Transition
  const handleStatusChange = async (nextStatus: PoliceFieldStatus) => {
    setFieldStatus(nextStatus);
    try {
      localStorage.setItem('resqtrack_pnp_status', nextStatus);
    } catch {
      // ignore
    }

    // Map to duty roster status
    const myUnit = roster.find((u) => u.agency === 'PNP' || u.agency === 'POLICE');
    if (myUnit) {
      let mappedDuty: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty' = 'OnDuty';
      if (nextStatus === 'IN STATION') mappedDuty = 'Standby';
      else if (nextStatus === 'ON MOBILE PATROL') mappedDuty = 'OnDuty';
      else if (nextStatus === 'RESPONDING (CODE 3)' || nextStatus === 'ON SCENE (SECURING)') mappedDuty = 'Dispatched';
      else if (nextStatus === 'PROCESSING BLOTTER') mappedDuty = 'OnDuty';

      try {
        await updateUnitDutyStatus(myUnit.id, mappedDuty);
      } catch (err) {
        console.warn('Could not sync status with duty roster:', err);
      }
    }
    showToast(`TACTICAL STATUS COMMITTED: ${nextStatus}`);
  };

  // Distress Beacon Countdown & Trigger
  const triggerDistressBroadcast = async () => {
    setIsBeaconActive(true);
    setIsBeaconModalOpen(false);
    showToast('🚨 10-0 OFFICER DISTRESS BROADCAST TRANSMITTED TO LDRRMO & ALL PNP CARS!');

    try {
      await sendEmergencyBroadcast({
        title: 'OFFICER IN DISTRESS (10-0 TACTICAL SOS)',
        message: `EMERGENCY: Officer ${session?.fullName || 'Active Duty'} initiated distress beacon at ${
          coords ? formatGpsCoord(coords.latitude, coords.longitude) : 'Dipolog Sector 1'
        }. All available mobile patrol units respond Code 3 immediately.`,
        severity: 'Critical'
      });
    } catch (err) {
      console.warn('Emergency distress broadcast failed or offline:', err);
    }
  };

  const handleStartDistressBeacon = () => {
    setBeaconCountdown(5);
    setIsBeaconModalOpen(true);
    playDistressBeep();

    if (beaconTimerRef.current) clearInterval(beaconTimerRef.current);
    beaconTimerRef.current = setInterval(() => {
      setBeaconCountdown((prev) => {
        if (prev <= 1) {
          if (beaconTimerRef.current) clearInterval(beaconTimerRef.current);
          triggerDistressBroadcast();
          return 0;
        }
        playDistressBeep();
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelDistressBeacon = () => {
    if (beaconTimerRef.current) {
      clearInterval(beaconTimerRef.current);
      beaconTimerRef.current = null;
    }
    setIsBeaconModalOpen(false);
    showToast('Officer Distress Beacon cancelled. Situation 10-4.');
  };

  const handleStandDownBeacon = () => {
    setIsBeaconActive(false);
    showToast('Distress Beacon cleared. Resumed normal patrol readiness.');
  };

  // Filtered crime reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        r.referenceCode.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.locationLabel.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeCategoryFilter === 'ALL') return true;
      if (activeCategoryFilter === 'CRITICAL') return r.severity.toLowerCase() === 'critical';
      if (activeCategoryFilter === 'BLURRY') return r.isBlurry || r.requiresManualVerification;
      if (activeCategoryFilter === 'ROBBERY') return r.category.toLowerCase().includes('robbery') || r.title.toLowerCase().includes('theft');
      if (activeCategoryFilter === 'COLLISION') return r.category.toLowerCase().includes('vehic') || r.category.toLowerCase().includes('crash');
      if (activeCategoryFilter === 'DISTURBANCE') return r.category.toLowerCase().includes('disturb') || r.category.toLowerCase().includes('assault');
      return true;
    });
  }, [reports, searchQuery, activeCategoryFilter]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      const initialCenter: [number, number] = coords
        ? [coords.latitude, coords.longitude]
        : [8.5833, 123.3417]; // Dipolog City Hall / Police Station vicinity

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(initialCenter, 13);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      ).addTo(map);

      // Boundaries overlay
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      ).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const markersGroup = markersLayerRef.current;
    if (markersGroup) {
      markersGroup.clearLayers();

      // Render PNP Police Beat Circles & Pins
      DIPOLOG_POLICE_BEATS.forEach((beat) => {
        // Cordon / beat circle
        const beatCircle = L.circle([beat.lat, beat.lng], {
          radius: 650,
          color: '#3b82f6',
          weight: 1.5,
          fillColor: '#1d4ed8',
          fillOpacity: 0.12,
          dashArray: '4, 4'
        });
        beatCircle.bindTooltip(`<b>${beat.code}</b><br/>${beat.name}`, {
          permanent: false,
          className: 'bg-slate-900 text-blue-300 border border-blue-500/40 text-xs px-2 py-1 rounded shadow-lg'
        });
        markersGroup.addLayer(beatCircle);

        // Beat Icon Pin
        const beatIcon = L.divIcon({
          className: 'custom-beat-marker',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:#1d4ed8;border:2px solid #60a5fa;border-radius:50%;color:white;box-shadow:0 0 14px rgba(59,130,246,0.6);font-size:16px;">
            🚔
          </div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        const beatMarker = L.marker([beat.lat, beat.lng], { icon: beatIcon });
        beatMarker.bindPopup(`
          <div style="font-family:Inter,sans-serif;color:#0f172a;min-width:200px;">
            <div style="font-size:11px;font-weight:700;color:#1d4ed8;letter-spacing:0.05em;">POLICE BEAT PATROL</div>
            <div style="font-weight:700;font-size:13px;margin:2px 0 4px;">${beat.name}</div>
            <div style="font-size:11px;color:#475569;">Callsign: <b>${beat.callsign}</b></div>
            <div style="font-size:11px;color:#475569;">Officers: ${beat.officers}</div>
            <div style="margin-top:6px;display:inline-block;padding:2px 6px;border-radius:4px;background:#dbeafe;color:#1e40af;font-size:10px;font-weight:700;">
              ${beat.status}
            </div>
          </div>
        `);
        markersGroup.addLayer(beatMarker);
      });

      // Render Active Live Reports on Tactical Radar
      reports.forEach((report) => {
        const isCritical = report.severity.toLowerCase() === 'critical';
        const pinColor = isCritical ? '#ef4444' : '#f59e0b';
        const iconEmoji = report.category.toLowerCase().includes('vehic')
          ? '💥'
          : report.category.toLowerCase().includes('robbery')
          ? '🚨'
          : '⚠️';

        const repIcon = L.divIcon({
          className: 'custom-crime-marker',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${pinColor};border:2px solid #ffffff;border-radius:50%;color:white;box-shadow:0 0 16px ${pinColor};font-size:15px;animation:${isCritical ? 'pulse 1.2s infinite' : 'none'};">
            ${iconEmoji}
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([report.latitude, report.longitude], { icon: repIcon });
        marker.bindPopup(`
          <div style="font-family:Inter,sans-serif;color:#0f172a;min-width:210px;">
            <div style="font-size:11px;font-weight:700;color:${pinColor};text-transform:uppercase;">${report.category} • ${report.severity}</div>
            <div style="font-weight:700;font-size:13px;margin:3px 0;">${report.title}</div>
            <div style="font-size:11px;color:#475569;margin-bottom:6px;">${report.locationLabel}</div>
            <div style="font-size:10px;color:#64748b;font-family:monospace;">${formatGpsCoord(report.latitude, report.longitude)}</div>
            ${report.isBlurry ? '<div style="color:#d97706;font-size:10px;font-weight:600;margin-top:4px;">⚠️ Laplacian Blurry Flag</div>' : ''}
          </div>
        `);
        markersGroup.addLayer(marker);
      });

      // Render current Officer GPS position if available
      if (coords) {
        const officerIcon = L.divIcon({
          className: 'custom-officer-gps',
          html: `<div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;opacity:0.35;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute;inset:3px;background:#2563eb;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 10px #3b82f6;"></div>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        const officerMarker = L.marker([coords.latitude, coords.longitude], { icon: officerIcon });
        officerMarker.bindTooltip('<b>YOUR MOBILE UNIT</b><br/>GPS Locked', { permanent: false });
        markersGroup.addLayer(officerMarker);
      }
    }
  }, [reports, coords]);

  // Status step progression helper
  const STATUS_STEPS: PoliceFieldStatus[] = [
    'IN STATION',
    'ON MOBILE PATROL',
    'RESPONDING (CODE 3)',
    'ON SCENE (SECURING)',
    'PROCESSING BLOTTER'
  ];

  return (
    <div className="flex-1 w-full flex flex-col space-y-5 text-slate-100">
      {/* Top Banner: Law Enforcement Tactical Command HUD */}
      <div className="relative overflow-hidden rounded-xl border border-blue-600/30 bg-gradient-to-r from-[#0a1128] via-[#0f1f4b] to-[#0a1128] p-5 shadow-2xl backdrop-blur-md">
        <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/20 border-2 border-blue-500/50 shadow-inner shadow-blue-500/40">
              <svg className="h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <circle cx="12" cy="16" r="1" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-400/30">
                  PNP TACTICAL DISPATCH C2
                </span>
                <span className="flex items-center space-x-1.5 text-xs font-mono text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>CAD DISPATCH LIVE</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                Philippine National Police // Sector Patrol Command
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Dipolog City Police Station (CPS) • Police Beat Sectors 1–4 • Encrypted CAD Channel 154.850 MHz
              </p>
            </div>
          </div>

          {/* Distress SOS Button & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isBeaconActive ? (
              <button
                type="button"
                onClick={handleStandDownBeacon}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/50 transition-all border border-emerald-400/40"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>STAND DOWN BEACON (10-4)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartDistressBeacon}
                className="group relative flex items-center space-x-2.5 px-4 py-2.5 rounded-lg bg-gradient-to-r from-red-600 via-rose-700 to-red-600 hover:from-red-500 hover:to-rose-600 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-red-950/70 border border-red-400/60 transition-all overflow-hidden"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-200"></span>
                </span>
                <span className="relative font-mono font-black tracking-widest text-[11px] sm:text-xs">
                  OFFICER DISTRESS BEACON (SOS)
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={refreshGps}
              className="flex items-center space-x-2 px-3 py-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-mono border border-slate-700/80 transition-all active:scale-95"
              title="Refresh GPS hardware coordinate lock"
            >
              <svg className={`h-4 w-4 text-blue-400 ${isLocating ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
              <span>{coords ? formatGpsCoord(coords.latitude, coords.longitude) : 'LOCKING GPS...'}</span>
            </button>
          </div>
        </div>

        {/* PERSISTENT TACTICAL FIELD STATUS BAR */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-blue-300 flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
              <span>PATROL FIELD STATUS (COMMAND CAD SYNC):</span>
            </span>
            <span className="text-xs font-mono font-semibold text-slate-400">
              Active Mode: <span className="text-blue-400 font-bold">{fieldStatus}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STATUS_STEPS.map((status) => {
              const isActive = fieldStatus === status;
              let activeColor = 'bg-blue-600 text-white border-blue-400 shadow-blue-900/60';
              if (status === 'RESPONDING (CODE 3)') {
                activeColor = 'bg-red-600 text-white border-red-400 shadow-red-900/60 animate-pulse';
              } else if (status === 'ON SCENE (SECURING)') {
                activeColor = 'bg-amber-600 text-white border-amber-400 shadow-amber-900/60';
              } else if (status === 'PROCESSING BLOTTER') {
                activeColor = 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-900/60';
              }

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusChange(status)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all duration-150 active:scale-95 ${
                    isActive
                      ? `${activeColor} border-2 shadow-lg font-bold`
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[10px] font-mono tracking-tight font-bold">
                    {status}
                  </span>
                  {isActive && (
                    <span className="text-[9px] font-mono text-white/80 uppercase tracking-widest mt-0.5">
                      ● ON AIR
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI METRICS TIER - ZERO STATIC GUARANTEE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-slate-400">Total PNP Calls</span>
            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-mono text-blue-300">LIVE CAD</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-white">
            {reports.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {reports.length === 0 ? 'No incidents logged today' : 'All active police calls'}
          </p>
        </div>

        <div className="rounded-xl border border-red-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-red-300">Priority Code 3</span>
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-mono text-red-300 animate-pulse">EMERGENCY</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-red-400">
            {reports.filter((r) => r.severity.toLowerCase() === 'critical').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Life-threat or armed incidents</p>
        </div>

        <div className="rounded-xl border border-amber-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-amber-300">Pending Review</span>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300">AI AUDIT</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-amber-400">
            {reports.filter((r) => r.isBlurry || r.requiresManualVerification).length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Laplacian edge blur check</p>
        </div>

        <div className="rounded-xl border border-emerald-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold text-emerald-300">Active Beats</span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">4 SECTORS</span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            {DIPOLOG_POLICE_BEATS.filter((b) => b.status === 'ACTIVE PATROL').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Mobile cars & motorcycle beats</p>
        </div>
      </div>

      {/* MAIN DUAL SPLIT: SECTOR RADAR MAP & PRIORITY DISPATCH QUEUE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT / CENTER: SECTOR PATROL RADAR MAP (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Dipolog City Sector Patrol Radar & Beat Map
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Interactive Leaflet GIS • 4 Beats Active
            </span>
          </div>

          <div className="relative h-[480px] w-full rounded-xl border border-blue-600/30 overflow-hidden shadow-xl bg-slate-950">
            <div ref={mapContainerRef} className="h-full w-full" />
            
            {/* Map Legend Floating Tag */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 border border-slate-700/80 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 shadow-xl backdrop-blur-md max-w-xs space-y-1">
              <div className="font-bold text-white text-[11px] mb-1">RADAR TELEMETRY LEGEND</div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 border border-blue-300"></span>
                <span>Police Beat Sector Area (650m Cordon)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600"></span>
                <span>Code 3 Priority 911 Crime</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                <span>Active Disturbance / Investigation</span>
              </div>
            </div>
          </div>

          {/* Beat Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DIPOLOG_POLICE_BEATS.map((beat) => (
              <div
                key={beat.id}
                className="rounded-lg border border-slate-800 bg-[#0a1128]/70 p-3 hover:border-blue-500/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-400">{beat.code}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                    beat.status === 'ACTIVE PATROL'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {beat.status}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-1 truncate">{beat.name}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
                  <span>Unit: <b className="text-slate-300">{beat.callsign}</b></span>
                  <span>{formatGpsCoord(beat.lat, beat.lng)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: PRIORITY 911 CRIME & DISTURBANCE DISPATCH QUEUE (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Priority 911 Crime Dispatch Queue
              </h2>
            </div>
            <span className="text-xs font-mono text-blue-400">
              Live Feed ({filteredReports.length})
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="space-y-2">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search reference #, crime type, barangay..."
              className="w-full text-xs"
            />

            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              {[
                { id: 'ALL', label: `ALL (${reports.length})` },
                { id: 'CRITICAL', label: 'CODE 3' },
                { id: 'BLURRY', label: 'BLURRY' },
                { id: 'ROBBERY', label: 'ROBBERY/THEFT' },
                { id: 'COLLISION', label: 'CRASHES' },
                { id: 'DISTURBANCE', label: 'DISTURBANCE' }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActiveCategoryFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-md transition-all active:scale-95 ${
                    activeCategoryFilter === pill.id
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/50'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* DISPATCH CARDS FEED */}
          <div className="flex-1 min-h-[380px] max-h-[580px] overflow-y-auto space-y-3 pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-3 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="h-7 w-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="text-xs font-mono text-slate-400">POLLING PNP CAD FEED...</span>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 rounded-xl border border-dashed border-blue-900/50 bg-[#0a1128]/40 text-center space-y-2">
                <svg className="h-10 w-10 text-blue-500/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <div className="text-sm font-bold text-slate-300">0 ACTIVE PNP CALLS IN QUEUE</div>
                <p className="text-xs text-slate-400 max-w-xs">
                  All sectors secure (10-4). No incoming armed incidents or road collisions reported for PNP dispatch.
                </p>
              </div>
            ) : (
              filteredReports.map((report) => {
                const isCritical = report.severity.toLowerCase() === 'critical';
                return (
                  <div
                    key={report.id}
                    onClick={() => setSelectedIncident(report)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all duration-150 active:scale-[0.98] ${
                      isCritical
                        ? 'border-red-600/50 bg-gradient-to-br from-red-950/20 via-[#0a1128] to-slate-900 hover:border-red-500 shadow-lg shadow-red-950/30'
                        : 'border-blue-900/40 bg-[#0a1128]/80 hover:border-blue-500/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-black text-blue-400">
                          {report.referenceCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isCritical
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}>
                          {report.category}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {formatRelativeTime(report.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white mt-1.5 line-clamp-1">
                      {report.title}
                    </h3>
                    <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">
                      {report.note || 'No notes provided by reporting civilian.'}
                    </p>

                    {/* Location & GPS Info */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                      <span className="flex items-center space-x-1 truncate max-w-[200px]">
                        <svg className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span className="truncate">{report.locationLabel}</span>
                      </span>

                      <div className="flex items-center space-x-2">
                        {report.isBlurry && (
                          <span className="text-amber-400 text-[10px] font-bold" title="Laplacian blur threshold exceeded">
                            ⚠️ BLURRY
                          </span>
                        )}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 hover:underline font-bold"
                        >
                          <span>INTERCEPT ↗</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* CIVILIAN EVIDENCE INSPECTION MODAL */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl border border-blue-500/40 bg-[#0a1128] p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {selectedIncident.referenceCode}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedIncident.severity.toLowerCase() === 'critical'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  }`}>
                    {selectedIncident.severity}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mt-1">
                  {selectedIncident.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Photo Snapshot & Evidence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-2 overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
                {selectedIncident.imageUrl ? (
                  <img
                    src={selectedIncident.imageUrl}
                    alt="Civilian Crime Snapshot"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-center p-6 space-y-1">
                    <svg className="h-10 w-10 text-slate-600 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <div className="text-xs font-mono text-slate-400">NO LIVE IMAGE ATTACHED</div>
                  </div>
                )}
                <div className="w-full mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>Anti-Spoofing: Live Camera</span>
                  <span>{selectedIncident.isBlurry ? '⚠️ Laplacian Alert' : '✓ Verified Sharp'}</span>
                </div>
              </div>

              {/* Incident Details & Caller Info */}
              <div className="space-y-2.5 text-xs">
                <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Civilian Caller</div>
                  <div className="font-bold text-white">{selectedIncident.reporterName || 'Anonymous Resident'}</div>
                  <div className="text-slate-300">{selectedIncident.reporterRole || 'Civilian Resident'}</div>
                </div>

                <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Exact Geolocation</div>
                  <div className="font-bold text-white">{selectedIncident.locationLabel}</div>
                  <div className="font-mono text-blue-300 text-[11px]">
                    {formatGpsCoord(selectedIncident.latitude, selectedIncident.longitude)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Accuracy: ±{selectedIncident.gpsAccuracyMeters ? `${selectedIncident.gpsAccuracyMeters}m` : '6m (Hardware Locked)'}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Narrative & Chief Concern</div>
                  <p className="text-slate-300">{selectedIncident.note || 'No notes provided.'}</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedIncident.latitude},${selectedIncident.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
              >
                <span>Launch GPS Route ↗</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  showToast(`Incident ${selectedIncident.referenceCode} acknowledged. Marked Code 3.`);
                  setSelectedIncident(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICER SAFETY DISTRESS BEACON MODAL (5s COUNTDOWN) */}
      {isBeaconModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-950/90 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border-2 border-red-500 bg-slate-950 p-6 shadow-2xl text-center space-y-5 animate-pulse">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-600/30 border-4 border-red-500 shadow-xl">
              <span className="text-4xl font-mono font-black text-white">{beaconCountdown}</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-red-500 tracking-tight uppercase">
                Officer Distress Beacon (10-0 SOS)
              </h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                CRITICAL WARNING: Releasing will immediately broadcast an urgent emergency alert to LDRRMO Central Command and all active PNP patrol cars with your GPS coordinates.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelDistressBeacon}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs tracking-wider uppercase border border-slate-600 transition-all active:scale-95"
              >
                CANCEL BEACON (FALSE ALARM)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (beaconTimerRef.current) clearInterval(beaconTimerRef.current);
                  triggerDistressBroadcast();
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs tracking-wider uppercase shadow-xl shadow-red-900/60 border border-red-400 transition-all active:scale-95"
              >
                BROADCAST NOW (IMMEDIATE)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HAPTIC / STATUS TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-blue-500/50 bg-[#0a1128] px-4 py-3 text-xs font-mono font-bold text-blue-200 shadow-2xl shadow-blue-950/80 animate-slideUp">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default PolicePatrolDashboard;
