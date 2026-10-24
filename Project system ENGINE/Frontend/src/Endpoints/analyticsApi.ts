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
    const ts = r.createdAt;
    if (!ts) return;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return;

    const hour = d.getHours();
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
    { label: 'Critical SOS', value: crit, color: '#ef4444' }
  ];
};

const computeAgencyWorkloadFallback = async (): Promise<AgencyWorkloadItem[]> => {
  const [reports, roster]: [ReportItem[], DutyUnit[]] = await Promise.all([
    getAllReports().catch(() => [] as ReportItem[]),
    getDutyRoster().catch(() => [] as DutyUnit[])
  ]);

  const rhuReports = reports.filter((r) => {
    const a = (r.recommendedAgencyUnit || '').toUpperCase();
    const c = (r.category || '').toLowerCase();
    const code = (r.allocatedUnitCode || '').toUpperCase();
    return a === 'RHU' || c.includes('medic') || c.includes('health') || code.includes('RHU');
  }).length;
  const rhuRoster = roster.filter((u) => (u.agency || '').toUpperCase() === 'RHU').length;
  const rhuCount = rhuReports > 0 ? rhuReports : rhuRoster;

  const fireReports = reports.filter((r) => {
    const a = (r.recommendedAgencyUnit || '').toUpperCase();
    const c = (r.category || '').toLowerCase();
    const code = (r.allocatedUnitCode || '').toUpperCase();
    return a === 'FIRE' || a === 'BFP' || c.includes('fire') || c.includes('conflagration') || code.includes('FIRE') || code.includes('BFP');
  }).length;
  const fireRoster = roster.filter((u) => {
    const ag = (u.agency || '').toUpperCase();
    return ag === 'FIRE' || ag === 'BFP';
  }).length;
  const fireCount = fireReports > 0 ? fireReports : fireRoster;

  const pnpReports = reports.filter((r) => {
    const a = (r.recommendedAgencyUnit || '').toUpperCase();
    const c = (r.category || '').toLowerCase();
    const code = (r.allocatedUnitCode || '').toUpperCase();
    return a === 'PNP' || c.includes('police') || c.includes('crime') || c.includes('security') || code.includes('PNP');
  }).length;
  const pnpRoster = roster.filter((u) => (u.agency || '').toUpperCase() === 'PNP').length;
  const pnpCount = pnpReports > 0 ? pnpReports : pnpRoster;

  const total = rhuCount + fireCount + pnpCount;

  return [
    {
      label: 'RHU Medical',
      value: rhuCount,
      color: '#0284c7',
      percentage: total > 0 ? Math.round((rhuCount / total) * 100) : 0
    },
    {
      label: 'BFP Fire Rescue',
      value: fireCount,
      color: '#ea580c',
      percentage: total > 0 ? Math.round((fireCount / total) * 100) : 0
    },
    {
      label: 'PNP Police Force',
      value: pnpCount,
      color: '#3b82f6',
      percentage: total > 0 ? Math.round((pnpCount / total) * 100) : 0
    }
  ];
};

const computeHeatmapMatrixFallback = async (): Promise<HeatmapMatrixDto> => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['00', '04', '08', '12', '16', '20'];
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(6).fill(0));

  const reports: ReportItem[] = await getAllReports().catch(() => [] as ReportItem[]);

  reports.forEach((r) => {
    const ts = r.createdAt;
    if (!ts) return;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return;

    const dayIndex = (d.getDay() + 6) % 7;
    const hour = d.getHours();
    const hourIndex = Math.min(5, Math.max(0, Math.floor(hour / 4)));

    matrix[dayIndex][hourIndex]++;
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
