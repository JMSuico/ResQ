// [Layer: Hooks]
// Responsibility: Reactive analytics telemetry hook managing live database state, automatic polling, and window event bus listeners.
// Re-computes aggregates in real-time when 'resqtrack:report' or 'resqtrack:incident_created' events trigger.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAnalyticsSummary,
  getVolume24h,
  getSeverityBreakdown,
  getAgencyWorkload,
  getHeatmapMatrix,
  AnalyticsSummaryDto,
  TelemetryDataPoint,
  SeverityBreakdownItem,
  AgencyWorkloadItem,
  HeatmapMatrixDto
} from '@/Endpoints/analyticsApi';

export type {
  AnalyticsSummaryDto,
  TelemetryDataPoint,
  SeverityBreakdownItem,
  AgencyWorkloadItem,
  HeatmapMatrixDto
};

export interface AnalyticsTelemetryHookResult {
  summary: AnalyticsSummaryDto;
  volumeData: TelemetryDataPoint[];
  severityData: SeverityBreakdownItem[];
  agencyData: AgencyWorkloadItem[];
  heatmapMatrix: number[][];
  isLoading: boolean;
  refresh: () => Promise<void>;

  // Backwards compatibility convenience properties for AnalyticsReportsPage & admin views:
  responseCurveData: TelemetryDataPoint[];
  severityBarData: SeverityBreakdownItem[];
  agencyPieData: AgencyWorkloadItem[];
  totalReportsCount: number;
  activeReportsCount: number;
  criticalReportsCount: number;
  resolvedReportsCount: number;
  onDutyUnitsCount: number;
  totalUnitsCount: number;
  dispatchedUnitsCount: number;
  dispatchRatioPercent: string;
}

const DEFAULT_SUMMARY: AnalyticsSummaryDto = {
  totalIncidents: 0,
  activeDispatches: 0,
  criticalIncidents: 0,
  resolvedCount: 0,
  totalResponders: 0,
  onDutyResponders: 0,
  registeredCivilians: 0
};

const DEFAULT_VOLUME: TelemetryDataPoint[] = [
  { label: '00:00', value: 0 },
  { label: '04:00', value: 0 },
  { label: '08:00', value: 0 },
  { label: '12:00', value: 0 },
  { label: '16:00', value: 0 },
  { label: '20:00', value: 0 }
];

const DEFAULT_SEVERITY: SeverityBreakdownItem[] = [
  { label: 'Low Severity', value: 0, color: '#10b981' },
  { label: 'Medium Tier', value: 0, color: '#f59e0b' },
  { label: 'High Priority', value: 0, color: '#ea580c' },
  { label: 'Critical SOS', value: 0, color: '#ef4444' }
];

const DEFAULT_AGENCY: AgencyWorkloadItem[] = [
  { label: 'RHU Medical', value: 0, color: '#0284c7', percentage: 0 },
  { label: 'BFP Fire Rescue', value: 0, color: '#ea580c', percentage: 0 },
  { label: 'PNP Police Force', value: 0, color: '#3b82f6', percentage: 0 }
];

const DEFAULT_HEATMAP: number[][] = Array.from({ length: 7 }, () => Array(6).fill(0));

export const useAnalyticsTelemetry = (
  _reports?: unknown[],
  _roster?: unknown[]
): AnalyticsTelemetryHookResult => {
  const [summary, setSummary] = useState<AnalyticsSummaryDto>(DEFAULT_SUMMARY);
  const [volumeData, setVolumeData] = useState<TelemetryDataPoint[]>(DEFAULT_VOLUME);
  const [severityData, setSeverityData] = useState<SeverityBreakdownItem[]>(DEFAULT_SEVERITY);
  const [agencyData, setAgencyData] = useState<AgencyWorkloadItem[]>(DEFAULT_AGENCY);
  const [heatmapMatrix, setHeatmapMatrix] = useState<number[][]>(DEFAULT_HEATMAP);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isMountedRef = useRef<boolean>(true);

  const refresh = useCallback(async () => {
    try {
      const [sum, vol, sev, age, heat] = await Promise.all([
        getAnalyticsSummary(),
        getVolume24h(),
        getSeverityBreakdown(),
        getAgencyWorkload(),
        getHeatmapMatrix()
      ]);

      if (!isMountedRef.current) return;

      setSummary(sum);
      setVolumeData(vol);
      setSeverityData(sev);
      setAgencyData(age);
      setHeatmapMatrix(heat.matrix || DEFAULT_HEATMAP);
    } catch (err) {
      console.warn('[useAnalyticsTelemetry] Refresh warning:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void refresh();

    const handleEvent = () => {
      void refresh();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resqtrack:report', handleEvent);
      window.addEventListener('resqtrack:incident_created', handleEvent);
    }

    const intervalId = setInterval(() => {
      void refresh();
    }, 10000);

    return () => {
      isMountedRef.current = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('resqtrack:report', handleEvent);
        window.removeEventListener('resqtrack:incident_created', handleEvent);
      }
      clearInterval(intervalId);
    };
  }, [refresh]);

  // Derived properties for UI consumption
  const activeReportsCount = Math.max(0, summary.totalIncidents - summary.resolvedCount);
  const dispatchRatioPercent =
    summary.totalResponders > 0
      ? `${((summary.activeDispatches / summary.totalResponders) * 100).toFixed(1)}%`
      : '0.0%';

  return {
    summary,
    volumeData,
    severityData,
    agencyData,
    heatmapMatrix,
    isLoading,
    refresh,

    // Backwards-compatibility aliases:
    responseCurveData: volumeData,
    severityBarData: severityData,
    agencyPieData: agencyData,
    totalReportsCount: summary.totalIncidents,
    activeReportsCount,
    criticalReportsCount: summary.criticalIncidents,
    resolvedReportsCount: summary.resolvedCount,
    onDutyUnitsCount: summary.onDutyResponders,
    totalUnitsCount: summary.totalResponders,
    dispatchedUnitsCount: summary.activeDispatches,
    dispatchRatioPercent
  };
};
