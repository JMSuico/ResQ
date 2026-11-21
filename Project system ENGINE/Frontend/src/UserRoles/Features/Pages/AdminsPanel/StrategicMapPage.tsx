// [Layer: UserRoles/Features/Pages/AdminsPanel]
// StrategicMapPage.tsx -- Full Enlarged Tactical Strategic Map with 4-Pane Live Command Deck.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// REMOVING #11: Zero '911 Central Hotline' / tel: displays.
// Preserves DASHBOARD back button, min-h-[580px] full-height SatelliteCommandMap, and Haversine nearest-unit ranking.
// Strictly 100% arrow functions (=>), ZERO 'any', ZERO emojis.

import React, { useState, useEffect, FC, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
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
  Minimize2
} from 'lucide-react';
import { getAllReports, ReportItem } from '@/Endpoints/reportsApi';
import { getDutyRoster, DutyUnit } from '@/Endpoints/responderOpsApi';
import { getIncidentFixtures, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import { getAnalyticsSummary, AnalyticsSummaryDto } from '@/Endpoints/analyticsApi';
import { requestJson } from '@/Endpoints/apiClient';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { Dropdown } from '@/Shared';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import {
  calculateHaversineDistanceKm,
  calculateDynamicEtaMinutes,
  KATIPUNAN_BASE_COORDS,
  getKatipunanBarangay
} from '@/Libs/Map/mapAccuracy';
import {
  BASELINE_INCIDENT_REPORTS,
  BASELINE_INCIDENT_FIXTURES,
  BASELINE_DUTY_ROSTER,
  BASELINE_ANALYTICS_SUMMARY
} from '@/Libs/Assets/baselineFixtures';
import { AdminButton } from './Shared/AdminButton';
import { CLAY_SURFACE, CLAY_WELL } from './Shared/adminCommandHelpers';

export {
  calculateHaversineDistanceKm,
  calculateDynamicEtaMinutes
} from '@/Libs/Map/mapAccuracy';

export interface NearestUnitResult {
  unit: DutyUnit;
  distanceKm: number;
  etaMinutes: number;
}

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

  for (let i = 1; i < eligibleUnits.length; i += 1) {
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
    lat: KATIPUNAN_BASE_COORDS.latitude,
    lng: KATIPUNAN_BASE_COORDS.longitude
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
      setReports(r && r.length > 0 ? r : BASELINE_INCIDENT_REPORTS);
      setRoster(u && u.length > 0 ? u : BASELINE_DUTY_ROSTER);
      setFixtures(f && f.length > 0 ? f : BASELINE_INCIDENT_FIXTURES);
      setAnalyticsSummary(s || BASELINE_ANALYTICS_SUMMARY);
    } catch (err) {
      console.error('[StrategicMapPage] Telemetry sync error:', err);
      setReports((prev) => (prev.length > 0 ? prev : BASELINE_INCIDENT_REPORTS));
      setRoster((prev) => (prev.length > 0 ? prev : BASELINE_DUTY_ROSTER));
      setFixtures((prev) => (prev.length > 0 ? prev : BASELINE_INCIDENT_FIXTURES));
      setAnalyticsSummary((prev) => prev || BASELINE_ANALYTICS_SUMMARY);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { isRefreshing, refreshNow } = useValueRefreshAuto(loadData, { intervalMs: 7000 });

  useReportEventBus(() => {
    void loadData();
  });

  const markers: MapMarker[] = useMemo(() => [
    ...fixtures.map((fix) => ({
      id: fix.id,
      lat: Number(fix.latitude),
      lng: Number(fix.longitude),
      title: fix.title,
      type: 'fixture' as const,
      category: fix.category,
      agency: fix.assignedUnitType
    })),
    ...reports
      .filter((r) => {
        if (filterAgency === 'ALL') return true;
        const assigned = (r.allocatedUnitCode || r.recommendedAgencyUnit || r.category || '').toUpperCase();
        return assigned.includes(filterAgency);
      })
      .map((rep) => ({
        id: rep.id,
        lat: Number(rep.currentLatitude ?? rep.latitude),
        lng: Number(rep.currentLongitude ?? rep.longitude),
        title: rep.title,
        status: rep.status || 'Reported',
        type: 'incident' as const,
        category: rep.category,
        severity: rep.severity,
        evidenceUrl: rep.hasImage ? (rep.imageUrl || `/api/reports/${rep.id}/image`) : undefined,
        verifiedAt: rep.verifiedAt,
        requiresManualVerification: rep.requiresManualVerification,
        gpsAccuracyMeters: rep.gpsAccuracyMeters ?? undefined,
        description: rep.note || rep.locationLabel,
        allocatedUnitId: rep.allocatedUnitId,
        allocatedUnitCode: rep.allocatedUnitCode
      })),
    ...roster
      .filter((u) => {
        const lat = Number(u.baseLatitude);
        const lng = Number(u.baseLongitude);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return false;
        if (filterAgency === 'ALL') return true;
        return (u.agency || '').toUpperCase() === filterAgency;
      })
      .map((u) => ({
        id: `unit-${u.id}`,
        lat: Number(u.baseLatitude),
        lng: Number(u.baseLongitude),
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
      setActiveCenter({ lat: r.currentLatitude ?? r.latitude, lng: r.currentLongitude ?? r.longitude });
    }
  };

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
      {/* Top Header Bar (.clay-surface #F7F1EA) */}
      <div className={`relative z-[500] pointer-events-auto ${CLAY_SURFACE} flex flex-wrap items-center justify-between gap-3 p-3.5`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="px-3 py-1.5 rounded-xl border border-[#670626]/25 bg-[#E9D9D0] hover:bg-[#670626] text-[#670626] hover:text-[#F7F1EA] transition-all flex items-center gap-1.5 text-xs sm:text-sm font-mono font-bold cursor-pointer relative z-[510] pointer-events-auto"
            title="Return to Executive Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>DASHBOARD</span>
          </button>
          <div className="h-5 w-[1px] bg-[#670626]/20" />
          <h1 className="text-lg sm:text-xl font-black tracking-wide text-[#670626] uppercase flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#A83B4D] animate-pulse" />
            Strategic Map
          </h1>
          <span className="hidden md:inline text-xs font-mono text-[#A83B4D]">
            {analyticsSummary ? `${analyticsSummary.totalIncidents} total` : `${reports.length} live`}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
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
          <AdminButton
            variant="outline"
            size="sm"
            onClick={refreshNow}
            disabled={isRefreshing}
            className="text-xs sm:text-sm font-mono flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#670626]' : ''}`} />
            <span>{isRefreshing ? 'SYNCING…' : 'REFRESH'}</span>
          </AdminButton>
        </div>
      </div>

      {/* Main Grid: Enlarged Map + 4-Pane Live Command Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 min-h-0 w-full">
        <div className={`lg:col-span-2 xl:col-span-3 ${CLAY_SURFACE} overflow-hidden relative flex flex-col flex-1 h-full min-h-[580px]`}>
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-[#F7F1EA]/95 px-3.5 py-2 rounded-xl border border-[#670626]/25 text-xs font-mono text-[#670626] shadow-md">
            <Crosshair className="w-4 h-4 text-[#670626]" />
            <span className="font-black">{markers.length}</span> Active
            <span className="text-[#A83B4D]">|</span>
            <span className="text-[#A83B4D] font-bold">{unallocatedQueue.length}</span> Unallocated
          </div>

          {selectedIncident && (
            <div className={`absolute top-3 right-3 z-20 w-80 max-w-[90%] ${CLAY_SURFACE} p-4 text-sm`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-[#A83B4D] font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#670626]" />
                  Incident Details
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="p-1 rounded-lg hover:bg-[#E9D9D0] text-[#670626] cursor-pointer"
                  title="Close Inspector"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-bold text-[#670626] text-base truncate">{selectedIncident.title}</h3>
              <p className="text-xs text-[#A83B4D] flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {selectedIncident.locationLabel || getKatipunanBarangay(selectedIncident.latitude, selectedIncident.longitude)}
              </p>
              <div className="mt-2.5 pt-2.5 border-t border-[#670626]/15 flex items-center justify-between font-mono text-xs">
                <span className="text-[#A83B4D]">Severity:</span>
                <span className="px-2 py-0.5 rounded font-bold uppercase bg-[#670626] text-[#F7F1EA]">
                  {selectedIncident.severity}
                </span>
              </div>
              {selectedIncident.requiresManualVerification && (
                <div className="mt-2 p-2 rounded-lg bg-[#E9D9D0] border border-[#670626]/25 text-xs text-[#670626] font-mono">
                  Low clarity — review needed
                </div>
              )}
              <div className="mt-2.5 pt-2.5 border-t border-[#670626]/15">
                <p className="text-xs font-mono font-bold text-[#670626] uppercase mb-1.5">
                  Nearest Units:
                </p>
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {rankedUnitsForSelectedIncident.slice(0, 3).map((rUnit) => (
                    <div
                      key={rUnit.unit.id}
                      className={`${CLAY_WELL} p-2 flex items-center justify-between text-xs font-mono`}
                    >
                      <span className="text-[#670626] font-bold">{rUnit.unit.unitCode} ({rUnit.unit.agency})</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-800 font-bold">{rUnit.distanceKm} km</span>
                        <span className="text-[#A83B4D]">~{rUnit.etaMinutes}m ETA</span>
                      </div>
                    </div>
                  ))}
                  {rankedUnitsForSelectedIncident.length === 0 && (
                    <p className="text-[#A83B4D] text-xs">No active units in GPS range.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 w-full h-full min-h-[580px] relative flex flex-col">
            <SatelliteCommandMap
              markers={markers}
              responders={roster.map((u) => ({
                id: u.id,
                unitCode: u.unitCode,
                name: u.unitName || u.unitCode,
                lat: Number(u.baseLatitude),
                lng: Number(u.baseLongitude),
                status: u.status,
                agency: u.agency
              }))}
              selectedIncidentId={selectedIncident?.id}
              roleFilter={filterAgency === 'RHU' ? 'RHU' : 'LDRRMO'}
              onCloseCallout={() => setSelectedIncident(null)}
              onSelectIncident={(inc) => {
                const matched = reports.find((r) => r.id === inc.id);
                if (matched) {
                  handleSelectIncident(matched);
                } else if (typeof inc.lat === 'number' && typeof inc.lng === 'number') {
                  setActiveCenter({ lat: inc.lat, lng: inc.lng });
                }
              }}
              centerLat={activeCenter.lat}
              centerLng={activeCenter.lng}
              onExpandMap={() => navigate('/admin/dashboard')}
              className="w-full h-full min-h-[580px] flex-1"
            />
          </div>
        </div>

        {/* 4-Pane Command Deck */}
        <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Pane 1: Live Incidents */}
          <div className={`tactical-card ${CLAY_SURFACE} p-4 flex flex-col gap-2.5 border-l-4 border-l-[#670626]`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold tracking-wider text-[#670626] uppercase flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#A83B4D]" />
                Live Incidents
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-mono font-bold">
                {reports.length} Total
              </span>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 text-sm">
              {reports.map((r) => {
                const nearest = findNearestResponderUnit(r.latitude, r.longitude, roster);
                const isSelected = selectedIncident?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectIncident(r)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all flex flex-col gap-1 border ${
                      isSelected
                        ? 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
                        : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/15 hover:bg-[#E9D9D0]/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm truncate max-w-[140px]">
                        {r.title || 'Incident Report'}
                      </span>
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                          isSelected ? 'bg-[#F7F1EA] text-[#670626]' : 'bg-[#670626] text-[#F7F1EA]'
                        }`}
                      >
                        {r.severity}
                      </span>
                    </div>

                    <div className={`text-xs truncate ${isSelected ? 'text-[#E9D9D0]' : 'text-[#A83B4D]'}`}>
                      {r.locationLabel || getKatipunanBarangay(r.latitude, r.longitude)}
                    </div>

                    <div className={`flex items-center justify-between text-xs font-mono pt-1.5 border-t ${isSelected ? 'border-[#F7F1EA]/20' : 'border-[#670626]/10'}`}>
                      <span className="font-bold">
                        {r.allocatedUnitCode ? `Assigned: ${r.allocatedUnitCode}` : 'UNALLOCATED'}
                      </span>
                      {nearest ? (
                        <span className="flex items-center gap-1 font-bold">
                          <Navigation className="w-3 h-3" />
                          {nearest.distanceKm} km · ~{nearest.etaMinutes}m
                        </span>
                      ) : (
                        <span>Standby</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {reports.length === 0 && <p className="text-xs text-[#A83B4D] py-2">No active incidents.</p>}
            </div>
          </div>

          {/* Pane 2: Dispatch Queue (Zero hotline displays) */}
          <div className={`tactical-card ${CLAY_SURFACE} p-4 flex flex-col gap-2.5 border-l-4 border-l-[#A83B4D]`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold tracking-wider text-[#670626] uppercase flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#A83B4D]" />
                Dispatch Queue
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-mono font-bold">
                {criticalQueue.length} Priority
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className={`${CLAY_WELL} flex items-center justify-between p-2.5`}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Radio className="w-3.5 h-3.5 text-emerald-700" />
                  Unit Readiness Status
                </span>
                <span className="font-mono text-emerald-800 font-black">
                  {activeResponders.length} UNITS READY
                </span>
              </div>
              <div className={`${CLAY_WELL} flex items-center justify-between p-2.5`}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Activity className="w-3.5 h-3.5 text-[#670626]" />
                  Citizen SOS Ingestion
                </span>
                <span className="font-mono text-[#670626] font-black">
                  {reports.length} RECEIVED
                </span>
              </div>
              <div className={`${CLAY_WELL} flex items-center justify-between p-2.5`}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-[#A83B4D]" />
                  Unallocated Beacons
                </span>
                <span className="font-mono font-black text-[#670626]">
                  {unallocatedQueue.length > 0 ? `${unallocatedQueue.length} PENDING` : 'ALL ALLOCATED'}
                </span>
              </div>
            </div>
          </div>

          {/* Pane 3: Active Responder Units */}
          <div className={`tactical-card ${CLAY_SURFACE} p-4 flex flex-col gap-2.5 border-l-4 border-l-sky-700`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold tracking-wider text-[#670626] uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#A83B4D]" />
                Active Units
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-mono font-bold">
                {activeResponders.length} Deployed
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className={`${CLAY_WELL} flex items-center justify-between p-2`}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <HeartPulse className="w-3.5 h-3.5 text-[#670626]" />
                  RHU Medical
                </span>
                <span className="font-mono font-bold text-[#670626]">
                  {roster.filter((u) => (u.agency || '').toUpperCase() === 'RHU').length} Units
                </span>
              </div>
              <div className={`${CLAY_WELL} flex items-center justify-between p-2`}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Flame className="w-3.5 h-3.5 text-orange-700" />
                  BFP Fire Rescue
                </span>
                <span className="font-mono font-bold text-[#670626]">
                  {roster.filter((u) => {
                    const ag = (u.agency || '').toUpperCase();
                    return ag === 'FIRE' || ag === 'BFP';
                  }).length} Units
                </span>
              </div>
              <div className={`${CLAY_WELL} flex items-center justify-between p-2`}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Shield className="w-3.5 h-3.5 text-sky-700" />
                  PNP Police Force
                </span>
                <span className="font-mono font-bold text-[#670626]">
                  {roster.filter((u) => (u.agency || '').toUpperCase() === 'PNP').length} Units
                </span>
              </div>
            </div>
          </div>

          {/* Pane 4: Severity Breakdown */}
          <div className={`tactical-card ${CLAY_SURFACE} p-4 flex flex-col gap-2.5 border-l-4 border-l-[#670626]`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold tracking-wider text-[#670626] uppercase flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#A83B4D]" />
                Severity Breakdown
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-mono font-bold">
                {dynamicResolutionRate} Resolved
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <div className={`${CLAY_WELL} p-2.5 flex flex-col`}>
                <span className="text-xs text-[#670626] font-mono font-bold">Critical</span>
                <span className="text-xl font-black text-[#670626] mt-0.5">{criticalQueue.length}</span>
              </div>
              <div className={`${CLAY_WELL} p-2.5 flex flex-col`}>
                <span className="text-xs text-[#A83B4D] font-mono font-bold">High</span>
                <span className="text-xl font-black text-[#670626] mt-0.5">{highQueue.length}</span>
              </div>
              <div className={`${CLAY_WELL} p-2.5 flex flex-col`}>
                <span className="text-xs text-sky-800 font-mono font-bold">Medium</span>
                <span className="text-xl font-black text-[#670626] mt-0.5">{mediumQueue.length}</span>
              </div>
              <div className={`${CLAY_WELL} p-2.5 flex flex-col`}>
                <span className="text-xs text-emerald-800 font-mono font-bold">Low</span>
                <span className="text-xl font-black text-[#670626] mt-0.5">{lowQueue.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategicMapPage;
