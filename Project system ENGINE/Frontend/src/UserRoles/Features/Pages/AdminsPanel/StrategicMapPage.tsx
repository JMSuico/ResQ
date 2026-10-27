// [Layer: UserRoles/Features/Pages/AdminsPanel]
// StrategicMapPage.tsx -- Full Enlarged Tactical Strategic Map with 4-Pane Live Command Deck.
// Conforms to Task 11 with full enlarge satellite map and live pane for Incidents, Calls, Units, Severity.
// Universal Lucide migration, strictly typed relational synchronization, and dynamic Haversine distance & ETA calculations.

import React, { useState, useEffect, FC, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Phone,
  Users,
  Activity,
  Crosshair,
  Navigation,
  Clock,
  MapPin,
  Shield,
  Radio,
  Flame,
  HeartPulse,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Compass,
  Filter
} from 'lucide-react';
import { getAllReports, ReportItem } from '@/Endpoints/reportsApi';
import { getDutyRoster, DutyUnit } from '@/Endpoints/responderOpsApi';
import { getIncidentFixtures, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import { getAnalyticsSummary, AnalyticsSummaryDto } from '@/Endpoints/analyticsApi';
import { requestJson } from '@/Endpoints/apiClient';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { Button, Dropdown } from '@/Shared';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { useReportEventBus } from '@/Hooks/useReportEventBus';

export interface NearestUnitResult {
  unit: DutyUnit;
  distanceKm: number;
  etaMinutes: number;
}

export const calculateHaversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

export const calculateDynamicEtaMinutes = (distanceKm: number, averageSpeedKmH = 40): number => {
  if (distanceKm <= 0) return 1;
  const hours = distanceKm / averageSpeedKmH;
  return Math.max(1, Math.round(hours * 60));
};

export const findNearestResponderUnit = (
  incidentLat: number,
  incidentLng: number,
  roster: DutyUnit[]
): NearestUnitResult | null => {
  const eligibleUnits = roster.filter(
    (u) =>
      typeof u.baseLatitude === 'number' &&
      typeof u.baseLongitude === 'number' &&
      u.status !== 'OffDuty'
  );
  if (eligibleUnits.length === 0) return null;

  let bestUnit: DutyUnit = eligibleUnits[0];
  let bestDistance = calculateHaversineDistanceKm(
    incidentLat,
    incidentLng,
    bestUnit.baseLatitude,
    bestUnit.baseLongitude
  );

  for (let i = 1; i < eligibleUnits.length; i++) {
    const unit = eligibleUnits[i];
    const dist = calculateHaversineDistanceKm(
      incidentLat,
      incidentLng,
      unit.baseLatitude,
      unit.baseLongitude
    );
    if (dist < bestDistance) {
      bestDistance = dist;
      bestUnit = unit;
    }
  }

  return {
    unit: bestUnit,
    distanceKm: bestDistance,
    etaMinutes: calculateDynamicEtaMinutes(bestDistance)
  };
};

export const StrategicMapPage: FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [fixtures, setFixtures] = useState<IncidentFixture[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummaryDto | null>(null);
  const [filterAgency, setFilterAgency] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<ReportItem | null>(null);
  const [activeCenter, setActiveCenter] = useState<{ lat: number; lng: number }>({
    lat: 8.5147,
    lng: 123.2842
  });

  const loadData = useCallback(async () => {
    try {
      const [r, u, f, s] = await Promise.all([
        getAllReports().catch(() => [] as ReportItem[]),
        requestJson<DutyUnit[]>('/api/responder-ops/roster', { method: 'GET' })
          .catch(() => getDutyRoster().catch(() => [] as DutyUnit[])),
        getIncidentFixtures().catch(() => [] as IncidentFixture[]),
        getAnalyticsSummary().catch(() => null as AnalyticsSummaryDto | null)
      ]);
      setReports(r || []);
      setRoster(u || []);
      setFixtures(f || []);
      if (s) {
        setAnalyticsSummary(s);
      }
    } catch (err) {
      console.error('[StrategicMapPage] Telemetry sync error:', err);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { isRefreshing, refreshNow } = useValueRefreshAuto(loadData, { intervalMs: 7000 });

  useReportEventBus(() => {
    void loadData();
  });

  // Map markers: combines fixtures, incident pins, and active responder unit locations
  const markers: MapMarker[] = useMemo(() => [
    ...fixtures.map((fix) => ({
      id: fix.id,
      lat: fix.latitude,
      lng: fix.longitude,
      title: fix.title,
      type: 'fixture' as const,
      category: fix.category,
      agency: fix.assignedUnitType
    })),
    ...reports
      .filter((r) => {
        if (filterAgency === 'ALL') return true;
        const assigned = (r.allocatedUnitCode || r.recommendedAgencyUnit || '').toUpperCase();
        return assigned.includes(filterAgency);
      })
      .map((rep) => ({
        id: rep.id,
        lat: rep.latitude,
        lng: rep.longitude,
        title: rep.title,
        type: 'incident' as const,
        category: rep.category,
        severity: rep.severity,
        requiresManualVerification: rep.requiresManualVerification,
        gpsAccuracyMeters: rep.gpsAccuracyMeters ?? undefined
      })),
    ...roster
      .filter((u) => {
        if (typeof u.baseLatitude !== 'number' || typeof u.baseLongitude !== 'number') return false;
        if (filterAgency === 'ALL') return true;
        return (u.agency || '').toUpperCase() === filterAgency;
      })
      .map((u) => ({
        id: `unit-${u.id}`,
        lat: u.baseLatitude,
        lng: u.baseLongitude,
        title: `${u.unitCode} (${u.agency}) - ${u.status}`,
        type: 'gps' as const,
        agency: u.agency,
        status: u.status
      }))
  ], [fixtures, reports, roster, filterAgency]);

  const criticalQueue = useMemo(
    () => reports.filter((r) => (r.severity || '').toLowerCase() === 'critical'),
    [reports]
  );

  const highQueue = useMemo(
    () => reports.filter((r) => (r.severity || '').toLowerCase() === 'high'),
    [reports]
  );

  const mediumQueue = useMemo(
    () => reports.filter((r) => (r.severity || '').toLowerCase() === 'medium'),
    [reports]
  );

  const lowQueue = useMemo(
    () => reports.filter((r) => (r.severity || '').toLowerCase() === 'low'),
    [reports]
  );

  const unallocatedQueue = useMemo(
    () => reports.filter((r) => !r.allocatedUnitId && (r.status || '').toLowerCase() !== 'resolved'),
    [reports]
  );

  const activeResponders = useMemo(
    () => roster.filter((u) => u.status === 'OnDuty' || u.status === 'Dispatched'),
    [roster]
  );

  const resolvedCount = useMemo(
    () => reports.filter((r) => (r.status || '').toLowerCase() === 'resolved').length,
    [reports]
  );

  const dynamicResolutionRate = reports.length > 0
    ? `${((resolvedCount / reports.length) * 100).toFixed(1)}%`
    : '100%';

  const handleSelectIncident = (r: ReportItem) => {
    setSelectedIncident(r);
    if (typeof r.latitude === 'number' && typeof r.longitude === 'number') {
      setActiveCenter({ lat: r.latitude, lng: r.longitude });
    }
  };

  // Rank all active roster units by Haversine distance to selected incident
  const rankedUnitsForSelectedIncident = useMemo(() => {
    if (!selectedIncident) return [];
    return roster
      .filter((u) => typeof u.baseLatitude === 'number' && typeof u.baseLongitude === 'number')
      .map((unit) => {
        const distanceKm = calculateHaversineDistanceKm(
          selectedIncident.latitude,
          selectedIncident.longitude,
          unit.baseLatitude,
          unit.baseLongitude
        );
        return {
          unit,
          distanceKm,
          etaMinutes: calculateDynamicEtaMinutes(distanceKm)
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [selectedIncident, roster]);

  return (
    <div className="flex flex-col gap-4 w-full h-[calc(100vh-130px)] min-h-[580px] flex-1">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-700/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-mono font-bold"
            title="Return to Executive Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>DASHBOARD</span>
          </button>
          <div className="h-4 w-[1px] bg-slate-700" />
          <h1 className="text-base sm:text-lg font-black tracking-wide text-white uppercase flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            Strategic Command Geospatial Map
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Dropdown
            value={filterAgency}
            onChange={(val) => setFilterAgency(val as string)}
            options={[
              { value: 'ALL', label: 'All Jurisdictions' },
              { value: 'RHU', label: 'RHU Medical' },
              { value: 'FIRE', label: 'BFP Fire & Hazmat' },
              { value: 'PNP', label: 'PNP Police Security' }
            ]}
            className="min-w-[170px]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNow}
            disabled={isRefreshing}
            className="text-xs font-mono flex items-center gap-1.5 text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
            <span>{isRefreshing ? 'SYNCING…' : 'REFRESH'}</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Enlarge Map + 4-Pane Live Command Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 min-h-0 w-full">
        {/* Full Enlarged Map (Takes 2 Cols on lg, 3 Cols on xl) */}
        <div className="lg:col-span-2 xl:col-span-3 rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950/90 shadow-2xl relative flex flex-col">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-950/85 px-3 py-1.5 rounded-lg border border-slate-700/80 text-[11px] font-mono text-slate-300 backdrop-blur-md">
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-400 font-bold">{markers.length}</span> Coordinates Plotted
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 font-bold">{unallocatedQueue.length}</span> Unallocated
          </div>

          {/* Selected Incident Drawer on Map */}
          {selectedIncident && (
            <div className="absolute top-3 right-3 z-10 w-80 max-w-[90%] bg-slate-950/95 border border-rose-500/50 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-rose-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  INCIDENT BEACON TELEMETRY
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  title="Close Inspector"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <h3 className="font-bold text-white text-sm truncate">{selectedIncident.title}</h3>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-500" />
                {selectedIncident.locationLabel || 'Municipal Coordinates'}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between font-mono text-[10px]">
                <span className="text-slate-400">Severity:</span>
                <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                  (selectedIncident.severity || '').toLowerCase() === 'critical' ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {selectedIncident.severity}
                </span>
              </div>
              {selectedIncident.requiresManualVerification && (
                <div className="mt-1.5 p-1.5 rounded bg-amber-950/60 border border-amber-700/60 text-[10px] text-amber-300 font-mono">
                  Laplacian Blur Warning — Verification Required
                </div>
              )}
              {/* Closest Unit Ranking */}
              <div className="mt-2 pt-2 border-t border-slate-800">
                <p className="text-[10px] font-mono font-bold text-sky-400 uppercase mb-1">
                  Nearest Dynamic Haversine Dispatch:
                </p>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {rankedUnitsForSelectedIncident.slice(0, 3).map((rUnit) => (
                    <div
                      key={rUnit.unit.id}
                      className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[10px] font-mono"
                    >
                      <span className="text-white font-bold">{rUnit.unit.unitCode} ({rUnit.unit.agency})</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">{rUnit.distanceKm} km</span>
                        <span className="text-amber-300">~{rUnit.etaMinutes}m ETA</span>
                      </div>
                    </div>
                  ))}
                  {rankedUnitsForSelectedIncident.length === 0 && (
                    <p className="text-slate-500 text-[10px]">No active units in GPS range.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 w-full h-full min-h-[420px]">
            <SatelliteCommandMap
              markers={markers}
              centerLat={activeCenter.lat}
              centerLng={activeCenter.lng}
              className="w-full h-full min-h-[420px]"
            />
          </div>
        </div>

        {/* 4-Pane Command Deck (Takes 1 Col on desktop) */}
        <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Pane 1: Live Incidents & Dynamic Haversine Beacons */}
          <div className="tactical-card p-3.5 flex flex-col gap-2 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-rose-300 uppercase flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                1. Live Incidents
              </span>
              <div className="flex items-center gap-1">
                {unallocatedQueue.length > 0 && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono font-bold">
                    {unallocatedQueue.length} Unallocated
                  </span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold">
                  {reports.length} Total
                </span>
              </div>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
              {reports.map((r) => {
                const nearest = findNearestResponderUnit(r.latitude, r.longitude, roster);
                const isSelected = selectedIncident?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectIncident(r)}
                    className={`p-2 rounded cursor-pointer transition-all flex flex-col gap-1 border ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-500'
                        : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white truncate max-w-[130px]">
                        {r.title || 'Incident Report'}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1 rounded uppercase font-bold ${
                          (r.severity || '').toLowerCase() === 'critical'
                            ? 'bg-red-500 text-white'
                            : (r.severity || '').toLowerCase() === 'high'
                            ? 'bg-amber-500/30 text-amber-300'
                            : 'bg-sky-500/30 text-sky-300'
                        }`}
                      >
                        {r.severity}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 truncate">
                      {r.locationLabel || 'Municipal Coordinates'}
                    </div>

                    {/* Dynamic Haversine & ETA */}
                    <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-800/80">
                      {r.allocatedUnitCode ? (
                        <span className="text-sky-400 font-bold">Assigned: {r.allocatedUnitCode}</span>
                      ) : (
                        <span className="text-amber-400 font-bold">UNALLOCATED</span>
                      )}
                      {nearest ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                          <Navigation className="w-2.5 h-2.5" />
                          {nearest.distanceKm} km · ~{nearest.etaMinutes}m
                        </span>
                      ) : (
                        <span className="text-slate-500">Standby</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {reports.length === 0 && <p className="text-[11px] text-slate-500 py-2">No active incidents.</p>}
            </div>
          </div>

          {/* Pane 2: Emergency SOS Calls & Unallocated Queue */}
          <div className="tactical-card p-3.5 flex flex-col gap-2 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-amber-300 uppercase flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                2. Emergency Dispatch Queue
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono font-bold">
                {criticalQueue.length} Priority
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-emerald-400" />
                  911 Central Hotline
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {activeResponders.length} UNITS READY
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-sky-400" />
                  Citizen SOS Ingestion
                </span>
                <span className="font-mono text-sky-400 font-bold">
                  {reports.length} RECEIVED
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Unallocated Beacons
                </span>
                <span className={`font-mono font-bold ${unallocatedQueue.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {unallocatedQueue.length > 0 ? `${unallocatedQueue.length} PENDING` : 'ALL ALLOCATED'}
                </span>
              </div>
            </div>
          </div>

          {/* Pane 3: Active Responder Units & Dynamic GPS */}
          <div className="tactical-card p-3.5 flex flex-col gap-2 border-l-4 border-l-sky-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-sky-300 uppercase flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                3. Active Units
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 font-mono font-bold">
                {activeResponders.length} Deployed
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300 p-1.5 rounded bg-slate-900/60">
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="w-3 h-3 text-sky-400" />
                  RHU Medical
                </span>
                <span className="font-mono font-bold text-white">
                  {roster.filter((u) => (u.agency || '').toUpperCase() === 'RHU').length} Units
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 p-1.5 rounded bg-slate-900/60">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3 h-3 text-orange-400" />
                  BFP Fire Rescue
                </span>
                <span className="font-mono font-bold text-white">
                  {roster.filter((u) => {
                    const ag = (u.agency || '').toUpperCase();
                    return ag === 'FIRE' || ag === 'BFP';
                  }).length} Units
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 p-1.5 rounded bg-slate-900/60">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-blue-500" />
                  PNP Police Force
                </span>
                <span className="font-mono font-bold text-white">
                  {roster.filter((u) => (u.agency || '').toUpperCase() === 'PNP').length} Units
                </span>
              </div>
            </div>
          </div>

          {/* Pane 4: Triage Severity Spectrum & Resolution Velocity */}
          <div className="tactical-card p-3.5 flex flex-col gap-2 border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-purple-300 uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                4. Triage Severity & Velocity
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-mono font-bold">
                {dynamicResolutionRate} Resolved
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-slate-900/70 border border-red-500/30 flex flex-col">
                <span className="text-[10px] text-red-400 font-mono font-bold">Critical</span>
                <span className="text-lg font-black text-white">{criticalQueue.length}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/70 border border-amber-500/30 flex flex-col">
                <span className="text-[10px] text-amber-400 font-mono font-bold">High</span>
                <span className="text-lg font-black text-white">{highQueue.length}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/70 border border-sky-500/30 flex flex-col">
                <span className="text-[10px] text-sky-400 font-mono font-bold">Medium</span>
                <span className="text-lg font-black text-white">{mediumQueue.length}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/70 border border-emerald-500/30 flex flex-col">
                <span className="text-[10px] text-emerald-400 font-mono font-bold">Low</span>
                <span className="text-lg font-black text-white">{lowQueue.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategicMapPage;