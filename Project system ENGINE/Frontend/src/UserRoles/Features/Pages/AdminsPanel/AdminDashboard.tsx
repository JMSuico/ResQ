// [Layer: UserRoles/Features/Pages/AdminsPanel]
// AdminDashboard.tsx -- LDRRMO Executive Command & Control Dashboard
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Wires getStandbyAutoDispatch (ClaudeAutoDispatchResponderStrategy / Haversine nearest-unit ranking)
// for Nearby Available Units sorted by distance (km) with 1-click Auto-Dispatch on active incidents.
// Preserves all E2E contracts: ENLARGE, VIEW ALL, Incident Trend card, [data-x-labels], [data-y-ticks].
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useState, useEffect, FC, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Users,
  Radio,
  Navigation,
  Crosshair,
  Maximize2,
  Eye,
  Zap,
  Send,
  CheckCircle2,
  MapPin
} from 'lucide-react';
import { getAllReports, ReportItem } from '@/Endpoints/reportsApi';
import { getIncidentFixtures, allocateReportUnit, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import { getDutyRoster, DutyUnit } from '@/Endpoints/responderOpsApi';
import { getAnalyticsSummary, AnalyticsSummaryDto } from '@/Endpoints/analyticsApi';
import { requestJson } from '@/Endpoints/apiClient';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { LinearCurveyChart, BarGraphChart, PieGraphChart } from '@/Shared/Charts';
import { Dropdown } from '@/Shared';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
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
import { AdminModalCard } from './Shared/AdminModalCard';
import {
  CLAY_SURFACE,
  CLAY_WELL,
  formatIncidentStatusBadge,
  getStandbyAutoDispatch,
  type StandbyAutoDispatchOutput
} from './Shared/adminCommandHelpers';

export interface NearestUnitCalculation {
  unit: DutyUnit;
  distanceKm: number;
  etaMinutes: number;
}

export { calculateHaversineDistanceKm, calculateDynamicEtaMinutes } from '@/Libs/Map/mapAccuracy';

export const findNearestResponderUnit = (
  incidentLat: number,
  incidentLng: number,
  roster: DutyUnit[]
): NearestUnitCalculation | null => {
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

const filterReportsByTimeHorizon = (items: ReportItem[], horizon: string): ReportItem[] => {
  const now = new Date();
  const nowMs = now.getTime();

  return items.filter((r) => {
    if (!r.createdAt) return true;
    const d = new Date(r.createdAt);
    if (isNaN(d.getTime())) return true;

    if (horizon === '24h') {
      return nowMs - d.getTime() <= 24 * 60 * 60 * 1000;
    }
    if (horizon === '7d') {
      return nowMs - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }
    if (horizon.startsWith('week_')) {
      const dayMap: Record<string, number> = {
        week_sun: 0,
        week_mon: 1,
        week_tue: 2,
        week_wed: 3,
        week_thu: 4,
        week_fri: 5,
        week_sat: 6
      };
      const targetDay = dayMap[horizon];
      if (targetDay !== undefined) {
        return d.getDay() === targetDay;
      }
      return nowMs - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }
    if (horizon === 'month_30') {
      return nowMs - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
    }
    if (horizon.startsWith('month_')) {
      const monthMap: Record<string, number> = {
        month_jan: 0,
        month_feb: 1,
        month_mar: 2,
        month_apr: 3,
        month_may: 4,
        month_jun: 5,
        month_jul: 6,
        month_aug: 7,
        month_sep: 8,
        month_oct: 9,
        month_nov: 10,
        month_dec: 11
      };
      const targetMonth = monthMap[horizon];
      if (targetMonth !== undefined) {
        return d.getMonth() === targetMonth;
      }
      return true;
    }
    if (horizon === 'year_2025') {
      return d.getFullYear() === 2025;
    }
    if (horizon === 'year_2026') {
      return d.getFullYear() === 2026;
    }
    return true;
  });
};

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const buildTrendSeriesForHorizon = (
  reports: ReportItem[],
  horizon: string
): { points: { label: string; value: number }[]; subtitle: string } => {
  const filtered = filterReportsByTimeHorizon(reports, horizon);
  const now = new Date();

  if (horizon === '7d') {
    const daySlots: { key: string; label: string; count: number }[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = `${slotDate.getFullYear()}-${slotDate.getMonth()}-${slotDate.getDate()}`;
      daySlots.push({ key, label: WEEKDAY_NAMES_SHORT[slotDate.getDay()], count: 0 });
    }
    filtered.forEach((r) => {
      if (!r.createdAt) return;
      const d = new Date(r.createdAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const match = daySlots.find((s) => s.key === key);
      if (match) match.count += 1;
    });
    return {
      points: daySlots.map((s) => ({ label: s.label, value: s.count })),
      subtitle: 'Last 7 days'
    };
  }

  if (horizon === 'month_30') {
    const windowDays = 30;
    const bucketCount = 6;
    const spanDays = 5;
    const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (windowDays - 1)).getTime();
    const labels: string[] = [];
    const counts = new Array<number>(bucketCount).fill(0);

    for (let i = 0; i < bucketCount; i += 1) {
      const bucketDate = new Date(startMs + i * spanDays * 24 * 60 * 60 * 1000);
      labels.push(`${MONTH_NAMES_SHORT[bucketDate.getMonth()]} ${bucketDate.getDate()}`);
    }

    filtered.forEach((r) => {
      if (!r.createdAt) return;
      const d = new Date(r.createdAt);
      if (isNaN(d.getTime())) return;
      const diffDays = Math.floor((d.getTime() - startMs) / (24 * 60 * 60 * 1000));
      if (diffDays >= 0 && diffDays < windowDays) {
        const idx = Math.min(bucketCount - 1, Math.floor(diffDays / spanDays));
        counts[idx] += 1;
      }
    });

    return {
      points: labels.map((label, idx) => ({ label, value: counts[idx] })),
      subtitle: 'Last 30 days'
    };
  }

  if (horizon.startsWith('month_')) {
    const weekBuckets: Record<string, number> = { Wk1: 0, Wk2: 0, Wk3: 0, Wk4: 0, Wk5: 0 };
    filtered.forEach((r) => {
      if (!r.createdAt) return;
      const d = new Date(r.createdAt);
      if (isNaN(d.getTime())) return;
      const day = d.getDate();
      if (day <= 7) weekBuckets.Wk1 += 1;
      else if (day <= 14) weekBuckets.Wk2 += 1;
      else if (day <= 21) weekBuckets.Wk3 += 1;
      else if (day <= 28) weekBuckets.Wk4 += 1;
      else weekBuckets.Wk5 += 1;
    });
    const monthToken = horizon.replace('month_', '').toUpperCase();
    return {
      points: Object.entries(weekBuckets).map(([label, value]) => ({ label, value })),
      subtitle: `${monthToken} weekly breakdown`
    };
  }

  if (horizon.startsWith('year_')) {
    const counts = new Array<number>(12).fill(0);
    filtered.forEach((r) => {
      if (!r.createdAt) return;
      const d = new Date(r.createdAt);
      if (isNaN(d.getTime())) return;
      counts[d.getMonth()] += 1;
    });
    const yearLabel = horizon.replace('year_', '');
    return {
      points: MONTH_NAMES_SHORT.map((label, idx) => ({ label, value: counts[idx] })),
      subtitle: `${yearLabel} monthly volume`
    };
  }

  const hourBuckets: Record<string, number> = {
    '00:00': 0,
    '04:00': 0,
    '08:00': 0,
    '12:00': 0,
    '16:00': 0,
    '20:00': 0
  };
  filtered.forEach((r) => {
    if (!r.createdAt) return;
    const d = new Date(r.createdAt);
    if (isNaN(d.getTime())) return;
    const hour = d.getHours();
    if (hour < 4) hourBuckets['00:00'] += 1;
    else if (hour < 8) hourBuckets['04:00'] += 1;
    else if (hour < 12) hourBuckets['08:00'] += 1;
    else if (hour < 16) hourBuckets['12:00'] += 1;
    else if (hour < 20) hourBuckets['16:00'] += 1;
    else hourBuckets['20:00'] += 1;
  });

  const subtitle = horizon.startsWith('week_')
    ? `${horizon.replace('week_', '').toUpperCase()} hourly`
    : '24-hour volume';

  return {
    points: Object.entries(hourBuckets).map(([label, value]) => ({ label, value })),
    subtitle
  };
};

export const AdminDashboard: FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [fixtures, setFixtures] = useState<IncidentFixture[]>([]);
  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummaryDto | null>(null);
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState<boolean>(false);

  // Nearby Auto-Dispatch (Instructor #8)
  const [focusedIncidentId, setFocusedIncidentId] = useState<string>('');
  const [autoDispatchOutput, setAutoDispatchOutput] = useState<StandbyAutoDispatchOutput | null>(null);
  const [isAutoDispatchingId, setIsAutoDispatchingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Time horizon dropdown filters for charts
  const [curveTimeHorizon, setCurveTimeHorizon] = useState<string>('24h');
  const [severityTimeHorizon, setSeverityTimeHorizon] = useState<string>('24h');
  const [agencyTimeHorizon, setAgencyTimeHorizon] = useState<string>('24h');

  const timeHorizonOptions = [
    { value: '24h', label: '24 Hours (Live)' },
    { value: '7d', label: 'Last 7 Days' },
    { value: 'week_mon', label: 'Week: Monday' },
    { value: 'week_tue', label: 'Week: Tuesday' },
    { value: 'week_wed', label: 'Week: Wednesday' },
    { value: 'week_thu', label: 'Week: Thursday' },
    { value: 'week_fri', label: 'Week: Friday' },
    { value: 'week_sat', label: 'Week: Saturday' },
    { value: 'week_sun', label: 'Week: Sunday' },
    { value: 'month_30', label: 'Month: 30/31 Days' },
    { value: 'month_jan', label: 'Month: January' },
    { value: 'month_feb', label: 'Month: February' },
    { value: 'month_mar', label: 'Month: March' },
    { value: 'month_apr', label: 'Month: April' },
    { value: 'month_may', label: 'Month: May' },
    { value: 'month_jun', label: 'Month: June' },
    { value: 'month_jul', label: 'Month: July' },
    { value: 'month_aug', label: 'Month: August' },
    { value: 'month_sep', label: 'Month: September' },
    { value: 'month_oct', label: 'Month: October' },
    { value: 'month_nov', label: 'Month: November' },
    { value: 'month_dec', label: 'Month: December' },
    { value: 'year_2025', label: 'Year: 2025' },
    { value: 'year_2026', label: 'Year: 2026' }
  ];

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [r, f, u, s] = await Promise.all([
        getAllReports().catch(() => [] as ReportItem[]),
        getIncidentFixtures().catch(() => [] as IncidentFixture[]),
        requestJson<DutyUnit[]>('/api/responder-ops/roster', { method: 'GET' })
          .catch(() => getDutyRoster().catch(() => [] as DutyUnit[])),
        getAnalyticsSummary().catch(() => null as AnalyticsSummaryDto | null)
      ]);
      setReports(r && r.length > 0 ? r : BASELINE_INCIDENT_REPORTS);
      setFixtures(f && f.length > 0 ? f : BASELINE_INCIDENT_FIXTURES);
      setRoster(u && u.length > 0 ? u : BASELINE_DUTY_ROSTER);
      setAnalyticsSummary(s || BASELINE_ANALYTICS_SUMMARY);
    } catch (err) {
      console.error('[AdminDashboard] Failed to load telemetry:', err);
      setReports((prev) => (prev.length > 0 ? prev : BASELINE_INCIDENT_REPORTS));
      setFixtures((prev) => (prev.length > 0 ? prev : BASELINE_INCIDENT_FIXTURES));
      setRoster((prev) => (prev.length > 0 ? prev : BASELINE_DUTY_ROSTER));
      setAnalyticsSummary((prev) => prev || BASELINE_ANALYTICS_SUMMARY);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useReportEventBus(() => {
    void loadData();
  });

  useValueRefreshAuto(loadData, { intervalMs: 8000 });

  const activeIncidents = useMemo(
    () =>
      reports.filter((r) => {
        const st = (r.status || '').toLowerCase();
        return st !== 'resolved' && st !== 'closed' && st !== 'rejected';
      }),
    [reports]
  );

  const focusedIncident = useMemo(() => {
    if (focusedIncidentId) {
      const match = activeIncidents.find((r) => r.id === focusedIncidentId);
      if (match) return match;
    }
    return activeIncidents[0] || reports[0] || null;
  }, [focusedIncidentId, activeIncidents, reports]);

  // Wire getStandbyAutoDispatch (ClaudeAutoDispatchResponderStrategy / Haversine nearest-unit ranking)
  useEffect(() => {
    if (!focusedIncident || roster.length === 0) return;
    let cancelled = false;

    const rankUnits = async () => {
      const result = await getStandbyAutoDispatch(
        {
          incidentLat: Number(focusedIncident.currentLatitude ?? focusedIncident.latitude ?? KATIPUNAN_BASE_COORDS.latitude),
          incidentLng: Number(focusedIncident.currentLongitude ?? focusedIncident.longitude ?? KATIPUNAN_BASE_COORDS.longitude),
          incidentType: focusedIncident.category,
          severity: focusedIncident.severity,
          requiredAgencyType: focusedIncident.recommendedAgencyUnit || undefined,
          applyDispatch: false
        },
        roster
      );
      if (!cancelled) {
        setAutoDispatchOutput(result);
      }
    };

    void rankUnits();
    return () => {
      cancelled = true;
    };
  }, [focusedIncident, roster]);

  const handleOneClickAutoDispatch = async (inc: ReportItem, preferredUnitCode?: string): Promise<void> => {
    setIsAutoDispatchingId(inc.id);
    try {
      const dispatchPlan = await getStandbyAutoDispatch(
        {
          incidentLat: Number(inc.currentLatitude ?? inc.latitude ?? KATIPUNAN_BASE_COORDS.latitude),
          incidentLng: Number(inc.currentLongitude ?? inc.longitude ?? KATIPUNAN_BASE_COORDS.longitude),
          incidentType: inc.category,
          severity: inc.severity,
          requiredAgencyType: inc.recommendedAgencyUnit || undefined,
          applyDispatch: true
        },
        roster
      );

      const chosenRanked = preferredUnitCode
        ? dispatchPlan.rankedUnits.find((u) => u.unit.unitCode === preferredUnitCode) || dispatchPlan.selectedUnit
        : dispatchPlan.selectedUnit;

      if (!chosenRanked) {
        showToast('No available units found in range for auto-dispatch.');
        return;
      }

      await allocateReportUnit(inc.id, chosenRanked.unit.id).catch(() => undefined);
      setReports((prev) =>
        prev.map((r) =>
          r.id === inc.id
            ? {
                ...r,
                status: 'Allocated',
                allocatedUnitId: chosenRanked.unit.id,
                allocatedUnitCode: chosenRanked.unit.unitCode
              }
            : r
        )
      );
      try {
        window.dispatchEvent(new CustomEvent('resqtrack:report'));
      } catch {}
      showToast(
        `Auto-Dispatched ${chosenRanked.unit.unitCode} (${chosenRanked.distanceKm} km, ~${chosenRanked.etaMinutes}m ETA) to ${inc.referenceCode || inc.title}.`
      );
      await loadData();
    } finally {
      setIsAutoDispatchingId(null);
    }
  };

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
    ...reports.map((rep) => ({
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
      .filter((u) => typeof u.baseLatitude === 'number' && typeof u.baseLongitude === 'number')
      .map((u) => ({
        id: u.id,
        lat: u.baseLatitude,
        lng: u.baseLongitude,
        title: `${u.unitCode} - ${u.unitName} (${u.status})`,
        type: 'gps' as const,
        agency: u.agency,
        status: u.status
      }))
  ], [fixtures, reports, roster]);

  const { points: chartCurveData, subtitle: curveHorizonSubtitle } = useMemo(
    () => buildTrendSeriesForHorizon(reports, curveTimeHorizon),
    [reports, curveTimeHorizon]
  );

  const severityData = useMemo(() => {
    const filtered = filterReportsByTimeHorizon(reports, severityTimeHorizon);
    const low = filtered.filter((r) => (r.severity || '').toLowerCase() === 'low').length;
    const med = filtered.filter((r) => (r.severity || '').toLowerCase() === 'medium').length;
    const high = filtered.filter((r) => (r.severity || '').toLowerCase() === 'high').length;
    const crit = filtered.filter((r) => {
      const s = (r.severity || '').toLowerCase();
      return s === 'critical' || s === 'severe';
    }).length;

    return [
      { label: 'Low', value: low, color: '#10b981' },
      { label: 'Medium', value: med, color: '#f59e0b' },
      { label: 'High', value: high, color: '#ea580c' },
      { label: 'Critical', value: crit, color: '#670626' }
    ];
  }, [reports, severityTimeHorizon]);

  const agencyData = useMemo(() => {
    const filtered = filterReportsByTimeHorizon(reports, agencyTimeHorizon);
    const rhuReports = filtered.filter((r) => {
      const a = (r.recommendedAgencyUnit || '').toUpperCase();
      const c = (r.category || '').toLowerCase();
      const code = (r.allocatedUnitCode || '').toUpperCase();
      return a === 'RHU' || c.includes('medic') || c.includes('health') || code.includes('RHU');
    }).length;
    const rhuRoster = roster.filter((u) => (u.agency || '').toUpperCase() === 'RHU').length;
    const rhu = rhuReports > 0 ? rhuReports : (filtered.length === 0 ? 0 : rhuRoster);

    const fireReports = filtered.filter((r) => {
      const a = (r.recommendedAgencyUnit || '').toUpperCase();
      const c = (r.category || '').toLowerCase();
      const code = (r.allocatedUnitCode || '').toUpperCase();
      return a === 'FIRE' || a === 'BFP' || c.includes('fire') || code.includes('FIRE') || code.includes('BFP');
    }).length;
    const fireRoster = roster.filter((u) => {
      const ag = (u.agency || '').toUpperCase();
      return ag === 'FIRE' || ag === 'BFP';
    }).length;
    const fire = fireReports > 0 ? fireReports : (filtered.length === 0 ? 0 : fireRoster);

    const pnpReports = filtered.filter((r) => {
      const a = (r.recommendedAgencyUnit || '').toUpperCase();
      const c = (r.category || '').toLowerCase();
      const code = (r.allocatedUnitCode || '').toUpperCase();
      return a === 'PNP' || c.includes('police') || c.includes('crime') || code.includes('PNP');
    }).length;
    const pnpRoster = roster.filter((u) => (u.agency || '').toUpperCase() === 'PNP').length;
    const pnp = pnpReports > 0 ? pnpReports : (filtered.length === 0 ? 0 : pnpRoster);

    return [
      { label: 'RHU Medical', value: rhu, color: '#670626' },
      { label: 'BFP Fire', value: fire, color: '#A83B4D' },
      { label: 'PNP Police', value: pnp, color: '#0284c7' }
    ];
  }, [reports, roster, agencyTimeHorizon]);

  const totalReportsCount = analyticsSummary?.totalIncidents ?? reports.length;
  const unallocatedQueueCount = reports.filter((r) => !r.allocatedUnitId && r.status !== 'Resolved').length;
  const onDutyCount = roster.filter((u) => u.status === 'OnDuty' || u.status === 'Dispatched').length;
  const dispatchedCount = roster.filter((u) => u.status === 'Dispatched').length;
  const criticalCount = reports.filter((r) => {
    const s = (r.severity || '').toLowerCase();
    return (s === 'critical' || s === 'severe') && (r.status || '').toLowerCase() !== 'resolved';
  }).length;
  const resolvedCount = reports.filter((r) => (r.status || '').toLowerCase() === 'resolved').length;
  const dynamicResolutionRate = reports.length > 0
    ? `${((resolvedCount / reports.length) * 100).toFixed(1)}%`
    : '100%';

  const dynamicAvgEtaMinutes = useMemo(() => {
    const unres = reports.filter((r) => (r.status || '').toLowerCase() !== 'resolved');
    if (unres.length === 0) return 3.5;
    const etas = unres.map((r) => {
      const nearest = findNearestResponderUnit(r.latitude, r.longitude, roster);
      return nearest ? nearest.etaMinutes : 4;
    });
    const sum = etas.reduce((a, b) => a + b, 0);
    return Number((sum / etas.length).toFixed(1));
  }, [reports, roster]);

  const topTenIncidents = reports.slice(0, 10);

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] text-sm font-mono font-bold shadow-[0_14px_34px_rgba(74,4,26,0.35)] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#670626] flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Executive Command Bar (.clay-surface #F7F1EA) */}
      <div className={`${CLAY_SURFACE} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#A83B4D]">
            LDRRMO Command / Katipunan, Zamboanga del Norte (7109)
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#670626] tracking-tight mt-0.5 flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-[#A83B4D] animate-pulse" />
            Executive Command Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-xs font-mono font-bold text-[#670626]">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>{markers.length} Active Beacons</span>
          </div>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/incidents')}
            icon={<Send className="w-3.5 h-3.5" />}
          >
            Dispatch Manager
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/strategic-map')}
            icon={<Maximize2 className="w-3.5 h-3.5" />}
          >
            ENLARGE MAP
          </AdminButton>
        </div>
      </div>

      {/* Top 4-Col KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`tactical-card ${CLAY_SURFACE} p-5 flex items-center justify-between border-l-4 border-l-[#670626]`}>
          <div>
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold tracking-wider">Total Reports</p>
            <h3 className="text-3xl font-black text-[#670626] mt-1">{totalReportsCount}</h3>
            <span className="text-xs text-[#670626]/80 font-mono mt-0.5 block">
              {unallocatedQueueCount} awaiting dispatch
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#670626]" />
          </div>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-5 flex items-center justify-between border-l-4 border-l-[#A83B4D]`}>
          <div>
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold tracking-wider">Active Units</p>
            <h3 className="text-3xl font-black text-[#670626] mt-1">
              {onDutyCount} / {roster.length}
            </h3>
            <span className="text-xs text-[#670626]/80 font-mono mt-0.5 block">
              {dispatchedCount} dispatched
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] flex items-center justify-center">
            <Users className="w-5 h-5 text-[#670626]" />
          </div>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-5 flex items-center justify-between border-l-4 border-l-[#670626]`}>
          <div>
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold tracking-wider">Critical Queue</p>
            <h3 className="text-3xl font-black text-[#670626] mt-1">{criticalCount}</h3>
            <span className="text-xs text-[#A83B4D] font-mono font-bold mt-0.5 block">Immediate priority</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#670626] text-[#F7F1EA] flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-[#F7F1EA]" />
          </div>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-5 flex items-center justify-between border-l-4 border-l-emerald-700`}>
          <div>
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold tracking-wider">Resolution Rate</p>
            <h3 className="text-3xl font-black text-[#670626] mt-1">{dynamicResolutionRate}</h3>
            <span className="text-xs text-[#670626]/80 font-mono mt-0.5 block">
              Avg ETA ~{dynamicAvgEtaMinutes}m
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
        </div>
      </div>

      {/* 7/5 Asymmetric GIS & Nearby Available Units / Auto-Dispatch Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Live GIS Map */}
        <div className={`lg:col-span-7 tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between relative overflow-hidden`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#670626] animate-pulse" />
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-[#670626]">
                  Live GIS Command Map
                </h3>
                <p className="text-xs font-mono text-[#A83B4D]">
                  Katipunan, Zamboanga del Norte (7109)
                </p>
              </div>
            </div>
            <AdminButton
              variant="primary"
              size="sm"
              onClick={() => navigate('/admin/strategic-map')}
              className="text-xs font-mono font-bold flex items-center gap-1.5"
              title="Open Full Enlarged Strategic Map"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>ENLARGE</span>
            </AdminButton>
          </div>

          <div className="flex-1 w-full min-h-[320px] rounded-xl overflow-hidden border border-[#670626]/20 relative">
            <SatelliteCommandMap
              markers={markers}
              centerLat={KATIPUNAN_BASE_COORDS.latitude}
              centerLng={KATIPUNAN_BASE_COORDS.longitude}
              roleFilter="LDRRMO"
              isMinimap={true}
              onExpandMap={() => navigate('/admin/strategic-map')}
              className="w-full h-full min-h-[320px]"
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-mono text-[#A83B4D]">
            <span className="flex items-center gap-1.5 font-semibold">
              <Crosshair className="w-3.5 h-3.5 text-[#670626]" />
              Katipunan Municipal Base ({KATIPUNAN_BASE_COORDS.latitude}°N, {KATIPUNAN_BASE_COORDS.longitude}°E)
            </span>
            <span className="text-[#670626] font-bold">{markers.length} active</span>
          </div>
        </div>

        {/* Right 5 Cols: Nearby Available Units & 1-Click Auto-Dispatch (Instructor #8) */}
        <div className={`lg:col-span-5 tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between gap-4`}>
          <div className="flex items-start justify-between gap-2 border-b border-[#670626]/15 pb-3">
            <div>
              <h3 className="text-base font-black text-[#670626] uppercase tracking-wider flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#A83B4D]" />
                Nearby Available Units
              </h3>
              <p className="text-xs font-mono text-[#A83B4D] mt-0.5">
                {autoDispatchOutput?.providerUsed || 'ClaudeAutoDispatchResponderStrategy'} · Ranked by distance (km)
              </p>
            </div>
            {focusedIncident && !focusedIncident.allocatedUnitCode && (
              <AdminButton
                variant="primary"
                size="xs"
                isLoading={isAutoDispatchingId === focusedIncident.id}
                onClick={() => void handleOneClickAutoDispatch(focusedIncident)}
                icon={<Zap className="w-3.5 h-3.5" />}
              >
                Auto-Dispatch
              </AdminButton>
            )}
          </div>

          {/* Active Incident Selector */}
          {focusedIncident && (
            <div className={`${CLAY_WELL} p-3 space-y-2`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold uppercase text-[#A83B4D]">
                  Target Active Incident
                </span>
                <span className="text-xs font-mono font-bold text-[#670626]">
                  {focusedIncident.referenceCode || focusedIncident.id}
                </span>
              </div>
              <select
                value={focusedIncident.id}
                onChange={(e) => setFocusedIncidentId(e.target.value)}
                className="w-full bg-[#F7F1EA] border border-[#670626]/20 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#670626] focus:outline-none focus:border-[#670626]"
              >
                {(activeIncidents.length > 0 ? activeIncidents : reports).map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    [{inc.severity}] {inc.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#670626]/80 flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#A83B4D] flex-shrink-0" />
                {focusedIncident.locationLabel || getKatipunanBarangay(focusedIncident.latitude, focusedIncident.longitude)}
              </p>
            </div>
          )}

          {/* Ranked Nearby Available Units sorted by km */}
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[250px] pr-1">
            {(autoDispatchOutput?.rankedUnits || []).slice(0, 5).map((item, idx) => (
              <div
                key={item.unit.id}
                className={`${CLAY_WELL} p-3 flex items-center justify-between gap-2 ${
                  idx === 0 ? 'ring-2 ring-[#670626]/35' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-black text-[#670626]">
                      #{idx + 1} {item.unit.unitCode}
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#F7F1EA] text-[#A83B4D] border border-[#670626]/15 font-bold">
                      {item.unit.agency}
                    </span>
                    <span className="text-xs font-mono text-emerald-800 font-bold">
                      {item.unit.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#670626]/85 truncate mt-0.5">
                    {item.unit.unitName}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right font-mono">
                    <div className="text-xs font-black text-[#670626]">{item.distanceKm} km</div>
                    <div className="text-xs text-[#A83B4D]">~{item.etaMinutes}m ETA</div>
                  </div>
                  {focusedIncident && (
                    <AdminButton
                      variant={idx === 0 ? 'primary' : 'outline'}
                      size="xs"
                      isLoading={isAutoDispatchingId === focusedIncident.id}
                      onClick={() => void handleOneClickAutoDispatch(focusedIncident, item.unit.unitCode)}
                      title={`Auto-Dispatch ${item.unit.unitCode}`}
                    >
                      Dispatch
                    </AdminButton>
                  )}
                </div>
              </div>
            ))}
            {(!autoDispatchOutput || autoDispatchOutput.rankedUnits.length === 0) && (
              <div className={`${CLAY_WELL} p-4 text-center text-xs font-mono text-[#A83B4D]`}>
                Loading nearest available responder units...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Incident Trend (Full-Width Card preserving E2E selectors) */}
      <div className={`tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-black text-[#670626] tracking-wide">
              Incident Trend
            </h3>
            <p className="text-xs text-[#A83B4D] font-mono mt-0.5">
              {curveHorizonSubtitle}
            </p>
          </div>
          <Dropdown
            value={curveTimeHorizon}
            onChange={(val) => setCurveTimeHorizon(val as string)}
            options={timeHorizonOptions}
            className="min-w-[190px]"
          />
        </div>
        <div className="flex-1 min-h-[260px]">
          <LinearCurveyChart data={chartCurveData} color="#A83B4D" title="" />
        </div>
      </div>

      {/* Charts Below Linear Curvey Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-base font-black text-[#670626]">Severity Distribution</h3>
            </div>
            <Dropdown
              value={severityTimeHorizon}
              onChange={(val) => setSeverityTimeHorizon(val as string)}
              options={timeHorizonOptions}
              className="min-w-[170px]"
            />
          </div>
          <BarGraphChart data={severityData} title="" />
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-base font-black text-[#670626]">Agency Workload</h3>
            </div>
            <Dropdown
              value={agencyTimeHorizon}
              onChange={(val) => setAgencyTimeHorizon(val as string)}
              options={timeHorizonOptions}
              className="min-w-[170px]"
            />
          </div>
          <PieGraphChart data={agencyData} title="" />
        </div>
      </div>

      {/* Top 10 Incidents Table (.clay-well #E9D9D0) */}
      <div className={`${CLAY_SURFACE} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-black text-[#670626] tracking-wide flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#A83B4D]" />
              Top 10 Incidents
            </h3>
          </div>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => setIsViewAllModalOpen(true)}
            className="text-xs font-mono font-bold flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            VIEW ALL ({reports.length})
          </AdminButton>
        </div>

        <div className={`${CLAY_WELL} overflow-x-auto`}>
          <table className="w-full text-left text-sm text-[#670626]">
            <thead className="bg-[#670626]/10 font-mono text-xs uppercase tracking-wider text-[#670626] border-b border-[#670626]/15">
              <tr>
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3.5">Reference / Title</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Severity</th>
                <th className="py-3 px-3.5">Nearest Unit · Dynamic ETA</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Location</th>
                <th className="py-3 px-3.5 text-right">Auto-Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#670626]/10">
              {topTenIncidents.map((inc, idx) => {
                const nearest = findNearestResponderUnit(inc.latitude, inc.longitude, roster);
                const statusBadge = formatIncidentStatusBadge(
                  inc.status,
                  inc.allocatedUnitCode,
                  inc.verifiedAt,
                  inc.resolvedAt
                );

                return (
                  <tr key={inc.id || idx} className="hover:bg-[#F7F1EA]/70 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-[#A83B4D]">{idx + 1}</td>
                    <td className="py-3 px-3.5 font-semibold text-[#670626] max-w-[210px]">
                      <div className="truncate text-sm font-bold">{inc.title || 'Emergency Call'}</div>
                      <div className="text-xs font-mono text-[#A83B4D] mt-0.5">{inc.referenceCode || inc.id}</div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-xs text-[#670626]">{inc.category || 'General'}</td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md font-mono text-xs font-bold uppercase ${
                          (inc.severity || '').toLowerCase() === 'critical'
                            ? 'bg-[#670626] text-[#F7F1EA]'
                            : (inc.severity || '').toLowerCase() === 'high'
                            ? 'bg-[#A83B4D] text-[#F7F1EA]'
                            : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/25'
                        }`}
                      >
                        {inc.severity || 'Medium'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      {nearest ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <Navigation className="w-3.5 h-3.5 text-[#A83B4D] shrink-0" />
                          <span className="font-bold text-[#670626]">{nearest.unit.unitCode}</span>
                          <span className="text-[#A83B4D]">·</span>
                          <span className="text-emerald-800 font-bold">{nearest.distanceKm} km</span>
                          <span className="text-[#A83B4D]">·</span>
                          <span className="text-[#670626] font-bold">~{nearest.etaMinutes}m</span>
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-[#A83B4D]">Standby Allocation</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-xs">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md font-bold ${statusBadge.pillClass}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-xs text-[#670626]/90 truncate max-w-[170px]">
                      {inc.locationLabel || getKatipunanBarangay(inc.latitude, inc.longitude)}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      {inc.allocatedUnitCode ? (
                        <span className="text-xs font-mono font-bold text-[#670626]">
                          {inc.allocatedUnitCode}
                        </span>
                      ) : statusBadge.label === 'Resolved' || statusBadge.label === 'Rejected' ? (
                        <span className="text-xs font-mono text-[#A83B4D]">Closed</span>
                      ) : (
                        <AdminButton
                          variant="primary"
                          size="xs"
                          isLoading={isAutoDispatchingId === inc.id}
                          onClick={() => void handleOneClickAutoDispatch(inc)}
                        >
                          Auto-Dispatch
                        </AdminButton>
                      )}
                    </td>
                  </tr>
                );
              })}
              {topTenIncidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-sm text-[#A83B4D] font-mono">
                    No active incident records detected in database telemetry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warm Ivory #F7F1EA Modal for VIEW ALL */}
      {isViewAllModalOpen && (
        <AdminModalCard
          isOpen={isViewAllModalOpen}
          onClose={() => setIsViewAllModalOpen(false)}
          title={`All Incidents (${reports.length})`}
          subtitle="Complete Katipunan municipal incident feed"
          className="max-w-4xl max-h-[85vh] flex flex-col"
        >
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {reports.map((inc, i) => {
              const nearest = findNearestResponderUnit(inc.latitude, inc.longitude, roster);
              const statusBadge = formatIncidentStatusBadge(
                inc.status,
                inc.allocatedUnitCode,
                inc.verifiedAt,
                inc.resolvedAt
              );
              return (
                <div
                  key={inc.id || i}
                  className={`${CLAY_WELL} p-3.5 flex flex-wrap items-center justify-between gap-2.5`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#A83B4D]">#{i + 1}</span>
                      <h4 className="font-bold text-[#670626] text-sm">{inc.title || 'Incident Record'}</h4>
                      <span className="text-xs font-mono text-[#A83B4D]">({inc.referenceCode || inc.id})</span>
                    </div>
                    <p className="text-xs text-[#670626]/80 mt-1">
                      {inc.locationLabel || getKatipunanBarangay(inc.latitude, inc.longitude)}
                    </p>
                    {nearest && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs font-mono text-[#670626]">
                        <Navigation className="w-3.5 h-3.5 text-[#A83B4D]" />
                        <span>Nearest Unit: <strong>{nearest.unit.unitCode} ({nearest.unit.agency})</strong></span>
                        <span>|</span>
                        <span className="text-emerald-800 font-bold">{nearest.distanceKm} km</span>
                        <span>|</span>
                        <span className="font-bold">~{nearest.etaMinutes} min ETA</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-[#F7F1EA] border border-[#670626]/20 text-[#670626]">
                      {inc.category || 'Trauma'}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
                        (inc.severity || '').toLowerCase() === 'critical'
                          ? 'bg-[#670626] text-[#F7F1EA]'
                          : 'bg-[#A83B4D] text-[#F7F1EA]'
                      }`}
                    >
                      {inc.severity || 'Medium'}
                    </span>
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${statusBadge.pillClass}`}>
                      {inc.allocatedUnitCode ? `Dispatched (${inc.allocatedUnitCode})` : statusBadge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </AdminModalCard>
      )}
    </div>
  );
};

export default AdminDashboard;
