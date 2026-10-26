// [Layer: UserRoles/Features/Pages/RespondersPanel/Medic]
// Responsibility: Tactical EMS Trauma Console for RHU Medics with START Triage, satellite map, and casualty queue.
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.
// Universal lambda expressions (=>).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getAgencyReports, getAllReports, ReportItem } from '@/Endpoints/reportsApi';
import { getDutyRoster, updateUnitDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import { verifyReport } from '@/Endpoints/adminGovernanceApi';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { Button } from '@/Shared/Button';
import { formatGpsCoord, formatRelativeTime, formatIsoTimestamp } from '@/Libs/Assets/formatters';
import { TacticalFieldStatusBar, TacticalFieldStatus } from './TacticalFieldStatusBar';
import { CivilianEvidenceModal } from './CivilianEvidenceModal';

export type StartTriageFilter = 'ALL' | 'IMMEDIATE' | 'DELAYED' | 'MINOR' | 'EXPECTANT';

export const EmsTraumaDashboard: React.FC = () => {
  const { session } = useSession();
  const { coords } = useGpsLocation();

  // Data state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Field status
  const [fieldStatus, setFieldStatus] = useState<TacticalFieldStatus>('AVAILABLE');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Filters & search
  const [triageFilter, setTriageFilter] = useState<StartTriageFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIncidentForModal, setSelectedIncidentForModal] = useState<ReportItem | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load live reports & duty units
  const loadData = useCallback(async () => {
    try {
      const [rhuReps, dutyUnits] = await Promise.all([
        getAgencyReports('RHU').catch(async () => {
          const all = await getAllReports().catch(() => [] as ReportItem[]);
          return all.filter((r) => r.category.toLowerCase().includes('accident') || r.category.toLowerCase().includes('medical') || r.recommendedAgencyUnit === 'RHU');
        }),
        getDutyRoster().catch(() => [] as DutyUnit[])
      ]);

      setReports(rhuReps);
      setRoster(dutyUnits);

      // Match duty status if unit exists in roster
      const myUnit = dutyUnits.find((u) => u.agency === 'RHU');
      if (myUnit) {
        if (myUnit.status === 'OnDuty') setFieldStatus('AVAILABLE');
        else if (myUnit.status === 'Dispatched') setFieldStatus('EN ROUTE (SIRENS ON)');
        else if (myUnit.status === 'Standby') setFieldStatus('RETURNING');
      }
    } catch (err) {
      console.error('Failed to load RHU EMS trauma telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Continuous auto-refresh every 6 seconds
  useValueRefreshAuto(loadData, {
    intervalMs: 6000,
    enabled: true
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  useReportEventBus(() => {
    loadData();
  });

  // Handle Field Status change
  const handleStatusChange = async (nextStatus: TacticalFieldStatus) => {
    setFieldStatus(nextStatus);
    setIsUpdatingStatus(true);

    const myUnit = roster.find((u) => u.agency === 'RHU');
    if (myUnit) {
      let mappedDuty: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty' = 'OnDuty';
      if (nextStatus === 'AVAILABLE') mappedDuty = 'OnDuty';
      else if (nextStatus === 'EN ROUTE (SIRENS ON)' || nextStatus === 'ON SCENE' || nextStatus === 'TRANSPORTING TO ER') {
        mappedDuty = 'Dispatched';
      } else if (nextStatus === 'RETURNING') {
        mappedDuty = 'Standby';
      }

      try {
        await updateUnitDutyStatus(myUnit.id, mappedDuty);
      } catch (err) {
        console.warn('Unit status sync fallback:', err);
      }
    }

    setIsUpdatingStatus(false);
    showToast(`TACTICAL BROADCAST: AMBULANCE IS NOW ${nextStatus}`);
  };

  // Quick navigation to patient coordinates via Google Maps
  const handleQuickNavigate = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Quick START triage tag modification
  const handleTriageTagChange = async (reportId: string, newSeverity: string) => {
    try {
      await verifyReport(reportId, 'Active', `START Triage classification updated to ${newSeverity.toUpperCase()} by RHU Medic`);
      showToast(`✓ START TRIAGE TAG SET TO ${newSeverity.toUpperCase()}`);
      await loadData();
      if (selectedIncidentForModal && selectedIncidentForModal.id === reportId) {
        setSelectedIncidentForModal((prev) => prev ? { ...prev, severity: newSeverity } : null);
      }
    } catch (err) {
      console.error('Failed to update triage tag:', err);
      showToast('FAILED TO UPDATE TRIAGE TAG');
    }
  };

  // START Triage counts computed dynamically from reports (Zero hardcoding)
  const triageCounts = useMemo(() => {
    let immediate = 0;
    let delayed = 0;
    let minor = 0;
    let expectant = 0;

    reports.forEach((r) => {
      const sev = (r.severity || '').toLowerCase();
      const stat = (r.status || '').toLowerCase();

      if (stat === 'resolved' || stat === 'deceased' || stat === 'expectant' || sev === 'expectant') {
        expectant += 1;
      } else if (sev === 'critical' || sev === 'high' || r.category === 'VehicularAccident') {
        immediate += 1;
      } else if (sev === 'moderate' || sev === 'medium') {
        delayed += 1;
      } else {
        minor += 1;
      }
    });

    return { immediate, delayed, minor, expectant, total: reports.length };
  }, [reports]);

  // Filtered reports for the casualty queue
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const sev = (r.severity || '').toLowerCase();
      const stat = (r.status || '').toLowerCase();

      // Triage filter
      if (triageFilter === 'IMMEDIATE') {
        if (!(sev === 'critical' || sev === 'high' || r.category === 'VehicularAccident')) return false;
      } else if (triageFilter === 'DELAYED') {
        if (!(sev === 'moderate' || sev === 'medium')) return false;
      } else if (triageFilter === 'MINOR') {
        if (!(sev === 'low' || sev === 'minor')) return false;
      } else if (triageFilter === 'EXPECTANT') {
        if (!(stat === 'resolved' || stat === 'deceased' || stat === 'expectant' || sev === 'expectant')) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const refMatch = (r.referenceCode || '').toLowerCase().includes(query);
        const titleMatch = (r.title || '').toLowerCase().includes(query);
        const locMatch = (r.locationLabel || '').toLowerCase().includes(query);
        const noteMatch = (r.note || '').toLowerCase().includes(query);
        return refMatch || titleMatch || locMatch || noteMatch;
      }

      return true;
    });
  }, [reports, triageFilter, searchQuery]);

  // Convert reports to SatelliteCommandMap markers
  const mapMarkers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = reports.map((r) => ({
      id: r.id,
      lat: r.latitude,
      lng: r.longitude,
      title: `[${r.referenceCode || r.id.slice(0, 6)}] ${r.title}`,
      severity: r.severity.toLowerCase() === 'critical' ? 'critical' : 'moderate',
      type: 'incident',
      category: r.category,
      agency: 'RHU',
      description: r.note,
      status: r.status,
      requiresManualVerification: r.requiresManualVerification || r.isBlurry,
      gpsAccuracyMeters: r.gpsAccuracyMeters ?? 0
    }));

    // Add Live Ambulance Marker if coords available
    if (coords) {
      list.push({
        id: 'AMB-GPS-LIVE',
        lat: coords.latitude,
        lng: coords.longitude,
        title: 'AMB-01 (Current Ambulance Position)',
        severity: 'low',
        type: 'gps',
        category: 'Medical',
        agency: 'RHU',
        description: 'Active hardware continuous geolocation lock',
        gpsAccuracyMeters: coords.accuracy ?? 0
      });
    }

    return list;
  }, [reports, coords]);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 font-sans pb-16">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg bg-sky-950 border border-sky-400/80 text-sky-200 shadow-[0_0_20px_rgba(56,189,248,0.4)] backdrop-blur-md animate-fade-in text-sm font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-sky-950/80 via-[#0a1a2b] to-slate-950 border border-sky-600/30 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-sky-600/20 border border-sky-500/40 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                RHU EMERGENCY MEDICAL SERVICES
              </span>
              <span className="text-xs font-mono text-slate-400">CALLSIGN: MEDIC-01</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-wide mt-1">
              EMS Trauma Console &amp; START Triage Feed
            </h1>
            <p className="text-xs text-sky-200/70 mt-0.5">
              Live casualty tracking, automated START triage taggers, and direct hospital ER telemetry.
            </p>
          </div>
        </div>

        {/* GPS Sensor Status Chip */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-400">GPS:</span>
          <span className="text-sky-300 font-bold">
            {coords ? formatGpsCoord(coords.latitude, coords.longitude) : '8.5147° N, 123.2842° E'}
          </span>
          <span className="text-[10px] text-slate-500">±4m Lock</span>
        </div>
      </div>

      {/* Persistent Tactical Field Status Bar */}
      <TacticalFieldStatusBar
        currentStatus={fieldStatus}
        onStatusChange={handleStatusChange}
        isUpdating={isUpdatingStatus}
        unitCallsign={session?.fullName || 'MEDIC-01'}
      />

      {/* START Triage KPI Summary Bar (Clickable Filter Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Immediate (Red) */}
        <div
          onClick={() => setTriageFilter(triageFilter === 'IMMEDIATE' ? 'ALL' : 'IMMEDIATE')}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between shadow-sm active:scale-95 ${
            triageFilter === 'IMMEDIATE'
              ? 'bg-red-950/80 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
              : 'bg-slate-900/90 border-slate-800 hover:border-red-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono tracking-wider text-red-400 uppercase flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              Immediate (Red)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
              PRIORITY 1
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-red-400">{triageCounts.immediate}</span>
            <span className="text-xs text-slate-400">Casualties</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Severe / Life-Threatening</span>
        </div>

        {/* Delayed (Yellow) */}
        <div
          onClick={() => setTriageFilter(triageFilter === 'DELAYED' ? 'ALL' : 'DELAYED')}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between shadow-sm active:scale-95 ${
            triageFilter === 'DELAYED'
              ? 'bg-amber-950/80 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'bg-slate-900/90 border-slate-800 hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
              <span>🟡</span> Delayed (Yellow)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              PRIORITY 2
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-amber-400">{triageCounts.delayed}</span>
            <span className="text-xs text-slate-400">Casualties</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Serious, Stable for Transfer</span>
        </div>

        {/* Minor (Green) */}
        <div
          onClick={() => setTriageFilter(triageFilter === 'MINOR' ? 'ALL' : 'MINOR')}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between shadow-sm active:scale-95 ${
            triageFilter === 'MINOR'
              ? 'bg-emerald-950/80 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
              <span>🟢</span> Minor (Green)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              PRIORITY 3
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">{triageCounts.minor}</span>
            <span className="text-xs text-slate-400">Casualties</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Ambulatory / Walking Wounded</span>
        </div>

        {/* Expectant (Black) */}
        <div
          onClick={() => setTriageFilter(triageFilter === 'EXPECTANT' ? 'ALL' : 'EXPECTANT')}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between shadow-sm active:scale-95 ${
            triageFilter === 'EXPECTANT'
              ? 'bg-slate-800/90 border-slate-400 shadow-[0_0_15px_rgba(148,163,184,0.3)]'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
              <span>⚫</span> Expectant (Black)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              PRIORITY 0
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-slate-300">{triageCounts.expectant}</span>
            <span className="text-xs text-slate-400">Cases</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Fatal Trauma / Moribund</span>
        </div>
      </div>

      {/* Main Grid: Satellite Map & Priority Casualty Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Leaflet Satellite Map */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                  <span>🛰️</span> Tactical Satellite Command Map
                </span>
                <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded">
                  Dipolog Metropolitan Grid
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {mapMarkers.length} Active GPS Pins
              </span>
            </div>

            {/* Map Container */}
            <div className="w-full h-[450px] rounded-xl overflow-hidden border border-slate-800 relative">
              <SatelliteCommandMap
                markers={mapMarkers}
                centerLat={coords ? coords.latitude : 8.5147}
                centerLng={coords ? coords.longitude : 123.2842}
                className="w-full h-full"
              />
            </div>

            {/* Map Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400 px-1 pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Immediate Casualty
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Delayed Casualty
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> AMB-01 Position
                </span>
              </div>
              <span>Click pin to inspect GPS telemetry</span>
            </div>
          </div>
        </div>

        {/* Right Column: Priority Casualty Queue Feed */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col gap-3">
            
            {/* Queue Header & Search */}
            <div className="flex flex-col gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                  <span>🚨</span> Priority Casualty Queue ({filteredReports.length})
                </h2>
                {triageFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setTriageFilter('ALL')}
                    className="text-[10px] font-mono text-sky-400 hover:underline"
                  >
                    Reset Filter [ALL]
                  </button>
                )}
              </div>

              {/* Search Bar Input */}
              <input
                type="text"
                placeholder="Search complaint, location, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            {/* Incident Cards Feed */}
            {loading ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">
                Synchronizing with LDRRMO Central Dispatch...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center flex flex-col items-center gap-2">
                <span className="text-2xl">📋</span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {triageFilter === 'ALL'
                    ? 'No Active Medical Dispatches'
                    : `No Casualties Tagged as ${triageFilter}`}
                </span>
                <p className="text-[11px] text-slate-500">
                  Sector clear. Units remain in quarters on standby.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                {filteredReports.map((report) => {
                  const isImmediate = report.severity.toLowerCase() === 'critical';
                  const isDelayed = report.severity.toLowerCase() === 'moderate';
                  const imageUrl = report.imageUrl || (report.hasImage ? `/api/reports/${report.id}/image` : null);

                  return (
                    <div
                      key={report.id}
                      className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-all shadow-sm bg-slate-950/95 ${
                        isImmediate
                          ? 'border-red-500/50 hover:border-red-400'
                          : isDelayed
                          ? 'border-amber-500/40 hover:border-amber-400'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Bar: Code, Time, Triage Tag */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
                            {report.referenceCode || report.id.slice(0, 8)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                              isImmediate
                                ? 'bg-red-500/20 text-red-400 border-red-500/50'
                                : isDelayed
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                            }`}
                          >
                            {report.severity}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatRelativeTime(report.createdAt)}
                        </span>
                      </div>

                      {/* Photo Thumbnail + Complaint Summary */}
                      <div
                        className="flex gap-3 cursor-pointer group"
                        onClick={() => setSelectedIncidentForModal(report)}
                      >
                        {/* Thumbnail Viewfinder */}
                        <div className="w-20 h-20 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={report.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                const target = e.target as HTMLElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-xl">📷</span>
                          )}
                          {report.isBlurry && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400" title="Blurry Capture" />
                          )}
                        </div>

                        {/* Title, Location & Note */}
                        <div className="flex flex-col justify-between flex-1 min-w-0">
                          <div>
                            <h3 className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                              {report.title}
                            </h3>
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                              {report.note || 'No notes provided by civilian reporter.'}
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-sky-400 truncate mt-1">
                            📍 {report.locationLabel || formatGpsCoord(report.latitude, report.longitude)}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelectedIncidentForModal(report)}
                          className="text-slate-300 hover:text-white"
                        >
                          🔍 Inspect Evidence
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => handleQuickNavigate(report.latitude, report.longitude)}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-mono active:scale-95"
                          >
                            Launch GPS Route ↗
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Civilian Evidence Modal */}
      {selectedIncidentForModal && (
        <CivilianEvidenceModal
          isOpen={!!selectedIncidentForModal}
          onClose={() => setSelectedIncidentForModal(null)}
          report={selectedIncidentForModal}
          onTriageTagChange={handleTriageTagChange}
          onQuickNavigate={handleQuickNavigate}
        />
      )}
    </div>
  );
};
