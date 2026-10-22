// [Layer: Endpoints]
// Responsibility: Incident reporting and alert endpoint stubs using universal arrow lambda syntax (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

import { requestJson } from './apiClient';

export interface CreateReportPayload {
  title: string;
  note?: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  locationLabel?: string;
  imageDataUrl?: string;
  gpsAccuracyMeters?: number;
  isHardwareGeolocated?: boolean;
  isBlurry?: boolean;
  requiresManualVerification?: boolean;
}

export interface ReportItem {
  id: string;
  referenceCode: string;
  reporterId: string;
  reporterName: string;
  reporterRole: string;
  title: string;
  note: string;
  category: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  hasImage: boolean;
  imageUrl?: string | null;
  allocatedUnitId?: string | null;
  allocatedUnitCode?: string | null;
  createdAt: string;
  verifiedAt?: string | null;
  resolvedAt?: string | null;
  gpsAccuracyMeters?: number | null;
  isHardwareGeolocated: boolean;
  isBlurry: boolean;
  requiresManualVerification: boolean;
  recommendedAgencyUnit?: string | null;
}

export interface AlertItem {
  reportId: string;
  referenceCode: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  timestamp: string;
  isRead: boolean;
  hasImage: boolean;
  imageUrl?: string | null;
}

export const createReport = (payload: CreateReportPayload): Promise<{ message: string; report: ReportItem; event: string }> =>
  requestJson<{ message: string; report: ReportItem; event: string }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const getAllReports = (): Promise<ReportItem[]> =>
  requestJson<ReportItem[]>('/api/reports', { method: 'GET' });

export const getMyReports = (): Promise<ReportItem[]> =>
  requestJson<ReportItem[]>('/api/reports/mine', { method: 'GET' });

export const getAgencyReports = (agency: string): Promise<ReportItem[]> =>
  requestJson<ReportItem[]>(`/api/reports/agency/${agency}`, { method: 'GET' });

export const getAlerts = (): Promise<AlertItem[]> =>
  requestJson<AlertItem[]>('/api/alerts', { method: 'GET' });

export const markAlertRead = (reportId: string): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/alerts/${reportId}/read`, { method: 'POST' });
