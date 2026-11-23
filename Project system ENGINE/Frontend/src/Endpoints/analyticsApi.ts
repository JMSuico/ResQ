// [Layer: Endpoints]
// Responsibility: Executive Analytics, Incident Volume, Triage Distribution & Density Matrix API.
// Includes deterministic client-side algorithmic fallback calculating genuine metrics from live database entities.
// ZERO mock numbers or artificial static additions are ever returned.

import { requestJson } from './apiClient';
import { getAllReports, ReportItem } from './reportsApi';
import { getDutyRoster, DutyUnit } from './responderOpsApi';
import { getUsers, UserSummary } from './userEndpoints';

export interface AnalyticsSummaryDto {
  totalIncidents: number;
  activeDispatches: number;
  criticalIncidents: number;
  resolvedCount: number;
  totalResponders: number;
  onDutyResponders: number;
  registeredCivilians: number;
}

export interface TelemetryDataPoint {
  label: string;
  value: number;
}

export interface SeverityBreakdownItem {
  label: string;
  value: number;
  color?: string;
}

export interface AgencyWorkloadItem {
  label: string;
  value: number;
  color: string;
  percentage?: number;
}

export interface HeatmapMatrixDto {
  days: string[];
  hours: string[];
  matrix: number[][];
}

export interface AnalyticsOverviewDto {
  volumeSeries: number[];
  activeIncidents: number;
  resolvedIncidents: number;
  onDutyUnits: number;
  generatedAtUtc: string;
}

export interface RoleAnalyticsDashboardDto {
  scope: string;
  summary: AnalyticsSummaryDto;
  volumeTrend: TelemetryDataPoint[];
  severityBreakdown: SeverityBreakdownItem[];
  agencyWorkload: AgencyWorkloadItem[];
  heatmapMatrix: HeatmapMatrixDto;
  categoryBreakdown: SeverityBreakdownItem[];
}

export const ASIA_MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export const parseUtcTimestamp = (raw?: string | null): Date | null => {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const hasZone = /([Zz]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized = hasZone ? trimmed : `${trimmed}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toManilaDate = (raw?: string | null): Date | null => {
  const utc = parseUtcTimestamp(raw);
  return utc ? new Date(utc.getTime() + ASIA_MANILA_OFFSET_MS) : null;
};

export const toManilaParts = (raw?: string | null): { dayIndex: number; hour: number } | null => {
  const utcDate = parseUtcTimestamp(raw);
  if (!utcDate) return null;
  const pht = new Date(utcDate.getTime() + ASIA_MANILA_OFFSET_MS);
  const jsDay = pht.getUTCDay();
  const dayIndex = (jsDay + 6) % 7;
  return { dayIndex, hour: pht.getUTCHours() };
};

export const computeTwoMinFadeSecondsLeft = (
  resolvedAt?: string | null,
  closedAt?: string | null,
  status?: string | null,
  nowMs: number = Date.now()
): number | null => {
  const s = (status || '').trim().toLowerCase();
  const isDone = s === 'resolved' || s === 'closed' || s === 'completed' || Boolean(resolvedAt || closedAt);
  if (!isDone) return null;
  const doneIso = closedAt || resolvedAt;
  if (!doneIso) return 0;
  const parsed = parseUtcTimestamp(doneIso);
  if (!parsed) return 0;
  return Math.max(0, Math.floor((parsed.getTime() + 120 * 1000 - nowMs) / 1000));
};

// ==========================================
// Fallback Aggregation Algorithms
// ==========================================

const computeSummaryFallback = async (): Promise<AnalyticsSummaryDto> => {
  const [reports, roster] = await Promise.all([
    getAllReports().catch(() => [] as ReportItem[]),
    getDutyRoster().catch(() => [] as DutyUnit[])
  ]);

  let registeredCivilians = 0;
  try {
    const users: UserSummary[] = await getUsers();
    registeredCivilians = users.filter((u) => u.role === 'Civilian').length;
  } catch {
    const uniqueCivilians = new Set(
      reports
        .filter((r) => r.reporterRole === 'Civilian' || r.reporterRole === 'CIVILIAN' || !r.reporterRole)
        .map((r) => r.reporterId || r.reporterName)
        .filter(Boolean)
    );
    registeredCivilians = uniqueCivilians.size;
  }

  const totalIncidents = reports.length;
  const activeDispatches = reports.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'dispatched' || s === 'in progress' || s === 'assigned' || s === 'responding';
  }).length || roster.filter((u) => u.status === 'Dispatched').length;

  const criticalIncidents = reports.filter((r) => {
    const sev = (r.severity || '').toLowerCase();
    return (sev === 'critical' || sev === 'severe') && (r.status || '').toLowerCase() !== 'resolved';
  }).length;

  const resolvedCount = reports.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'resolved' || s === 'closed' || s === 'completed';
  }).length;

  const totalResponders = roster.reduce<number>((sum, u) => sum + (u.activePersonnelCount || 1), 0);
  const onDutyResponders = roster
    .filter((u) => u.status === 'OnDuty' || u.status === 'Dispatched')
    .reduce<number>((sum, u) => sum + (u.activePersonnelCount || 1), 0);

  return {
    totalIncidents,
    activeDispatches,
    criticalIncidents,
    resolvedCount,
    totalResponders,
    onDutyResponders,
    registeredCivilians
  };
};

const computeVolume24hFallback = async (): Promise<TelemetryDataPoint[]> => {
  const reports: ReportItem[] = await getAllReports().catch(() => [] as ReportItem[]);
  const buckets: Record<string, number> = {
    '00:00': 0,
    '04:00': 0,
    '08:00': 0,
    '12:00': 0,
    '16:00': 0,
    '20:00': 0
  };

  reports.forEach((r) => {
    const parts = toManilaParts(r.createdAt);
    if (!parts) return;

    const hour = parts.hour;
    if (hour < 4) buckets['00:00']++;
    else if (hour < 8) buckets['04:00']++;
    else if (hour < 12) buckets['08:00']++;
    else if (hour < 16) buckets['12:00']++;
    else if (hour < 20) buckets['16:00']++;
    else buckets['20:00']++;
  });

  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
};

const computeSeverityBreakdownFallback = async (): Promise<SeverityBreakdownItem[]> => {
  const reports: ReportItem[] = await getAllReports().catch(() => [] as ReportItem[]);
  const low = reports.filter((r) => (r.severity || '').toLowerCase() === 'low').length;
  const med = reports.filter((r) => (r.severity || '').toLowerCase() === 'medium').length;
  const high = reports.filter((r) => (r.severity || '').toLowerCase() === 'high').length;
  const crit = reports.filter((r) => {
    const s = (r.severity || '').toLowerCase();
    return s === 'critical' || s === 'severe';
  }).length;

  return [
    { label: 'Low Severity', value: low, color: '#10b981' },
    { label: 'Medium Tier', value: med, color: '#f59e0b' },
    { label: 'High Priority', value: high, color: '#ea580c' },
    { label: 'Critical Alert', value: crit, color: '#ef4444' }
  ];
};

export const classifyReportAgency = (r: Pick<ReportItem, 'allocatedUnitCode' | 'recommendedAgencyUnit' | 'category'>): 'RHU' | 'FIRE' | 'PNP' | 'LDRRMO' => {
  const code = (r.allocatedUnitCode || '').toUpperCase();
  const rec = (r.recommendedAgencyUnit || '').toUpperCase();
  const cat = (r.category || '').toLowerCase();

  if (code.includes('RHU') || rec.includes('RHU') || rec.includes('MEDICAL') || cat.includes('medical')) {
    return 'RHU';
  }
  if (code.includes('BFP') || code.includes('FIRE') || rec.includes('FIRE') || rec.includes('BFP') || cat.includes('fire')) {
    return 'FIRE';
  }
  if (code.includes('PNP') || rec.includes('PNP') || rec.includes('POLICE') || cat.includes('crime') || cat.includes('security') || cat.includes('vehicular')) {
    return 'PNP';
  }
  return 'LDRRMO';
};

export const buildAgencyWorkloadFromReports = (reports: ReportItem[]): AgencyWorkloadItem[] => {
  let rhuCount = 0;
  let fireCount = 0;
  let pnpCount = 0;
  let ldrrmoCount = 0;

  reports.forEach((r) => {
    const agency = classifyReportAgency(r);
    if (agency === 'RHU') rhuCount++;
    else if (agency === 'FIRE') fireCount++;
    else if (agency === 'PNP') pnpCount++;
    else ldrrmoCount++;
  });

  const total = rhuCount + fireCount + pnpCount + ldrrmoCount;

  return [
    {
      label: 'RHU Medical',
      value: rhuCount,
      color: '#0284c7',
      percentage: total > 0 ? Math.round((rhuCount / total) * 1000) / 10 : 0
    },
    {
      label: 'BFP Fire Rescue',
      value: fireCount,
      color: '#ea580c',
      percentage: total > 0 ? Math.round((fireCount / total) * 1000) / 10 : 0
    },
    {
      label: 'PNP Police Force',
      value: pnpCount,
      color: '#3b82f6',
      percentage: total > 0 ? Math.round((pnpCount / total) * 1000) / 10 : 0
    },
    {
      label: 'LDRRMO Command',
      value: ldrrmoCount,
      color: '#670626',
      percentage: total > 0 ? Math.round((ldrrmoCount / total) * 1000) / 10 : 0
    }
  ];
};

const computeAgencyWorkloadFallback = async (): Promise<AgencyWorkloadItem[]> => {
  const reports: ReportItem[] = await getAllReports().catch(() => [] as ReportItem[]);
  return buildAgencyWorkloadFromReports(reports);
};

const computeHeatmapMatrixFallback = async (): Promise<HeatmapMatrixDto> => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['00', '04', '08', '12', '16', '20'];
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(6).fill(0));

  const reports: ReportItem[] = await getAllReports().catch(() => [] as ReportItem[]);

  reports.forEach((r) => {
    const parts = toManilaParts(r.createdAt);
    if (!parts) return;

    const hourIndex = Math.min(5, Math.max(0, Math.floor(parts.hour / 4)));
    matrix[parts.dayIndex][hourIndex]++;
  });

  return { days, hours, matrix };
};

// ==========================================
// API Endpoint Functions
// ==========================================

export const getAnalyticsSummary = async (): Promise<AnalyticsSummaryDto> => {
  try {
    return await requestJson<AnalyticsSummaryDto>('/api/analytics/summary', { method: 'GET' });
  } catch {
    return await computeSummaryFallback();
  }
};

export const getVolume24h = async (): Promise<TelemetryDataPoint[]> => {
  try {
    return await requestJson<TelemetryDataPoint[]>('/api/analytics/volume-24h', { method: 'GET' });
  } catch {
    return await computeVolume24hFallback();
  }
};

export const getSeverityBreakdown = async (): Promise<SeverityBreakdownItem[]> => {
  try {
    return await requestJson<SeverityBreakdownItem[]>('/api/analytics/severity-breakdown', { method: 'GET' });
  } catch {
    return await computeSeverityBreakdownFallback();
  }
};

export const getAgencyWorkload = async (): Promise<AgencyWorkloadItem[]> => {
  try {
    return await requestJson<AgencyWorkloadItem[]>('/api/analytics/agency-workload', { method: 'GET' });
  } catch {
    return await computeAgencyWorkloadFallback();
  }
};

export const getHeatmapMatrix = async (): Promise<HeatmapMatrixDto> => {
  try {
    return await requestJson<HeatmapMatrixDto>('/api/analytics/heatmap-matrix', { method: 'GET' });
  } catch {
    return await computeHeatmapMatrixFallback();
  }
};

export const getAnalyticsOverview = (): Promise<AnalyticsOverviewDto> =>
  requestJson<AnalyticsOverviewDto>('/api/analytics/overview', { method: 'GET' });

export const getRoleAnalyticsDashboard = (horizon = '30d'): Promise<RoleAnalyticsDashboardDto> =>
  requestJson<RoleAnalyticsDashboardDto>(`/api/analytics/role-dashboard?horizon=${encodeURIComponent(horizon)}`, {
    method: 'GET'
  });
