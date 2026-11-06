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

export interface IncidentEvidenceItem {
  id?: string;
  url: string;
  caption?: string;
  timestamp?: string;
  type?: string;
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
  evidences?: IncidentEvidenceItem[];
  evidencePhotos?: string[];
  pcrRecords?: unknown[];
  casualties?: unknown[];
  isVerified?: boolean;
  adminAiVerified?: boolean;
  submittedAt?: string;
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

export interface EmergencyBroadcastPayload {
  title: string;
  message: string;
  severity: string;
  externalLink?: string;
  hasImage?: boolean;
  hasVideo?: boolean;
}

export interface IncidentFieldLog {
  reportId: string;
  evidences: IncidentEvidenceItem[];
  evidencePhotos: string[];
  pcrRecords: unknown[];
  casualties: unknown[];
  isVerified: boolean;
  adminAiVerified: boolean;
  verifiedAt: string | null;
  submittedAt: string;
  notes?: string;
}

export interface PersistIncidentFieldLogPayload {
  evidences?: IncidentEvidenceItem[] | string[];
  evidencePhotos?: string[];
  pcrRecords?: unknown[];
  casualties?: unknown[];
  isVerified?: boolean;
  adminAiVerified?: boolean;
  verifiedAt?: string | null;
  submittedAt?: string;
  notes?: string;
}

export const createReport = (
  payload: CreateReportPayload
): Promise<{ message: string; report: ReportItem; event: string }> =>
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

export const verifyReport = (
  reportId: string,
  status: string,
  note?: string,
  severity?: string
): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/reports/${reportId}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      status,
      adminNote: note,
      severity
    })
  });

export const updateReportSeverity = async (
  reportId: string,
  severity: string
): Promise<{ message: string }> => {
  try {
    return await requestJson<{ message: string }>(`/api/reports/${reportId}/severity`, {
      method: 'PUT',
      body: JSON.stringify({ severity })
    });
  } catch {
    return await requestJson<{ message: string }>(`/api/reports/${reportId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ severity })
    });
  }
};

export const assignUnitToReport = async (
  reportId: string,
  unitId: string
): Promise<{ message: string; reportId: string; unitId: string }> => {
  try {
    const res = await requestJson<{ message: string }>(`/api/reports/${reportId}/allocate`, {
      method: 'POST',
      body: JSON.stringify({ unitId })
    });
    return { ...res, reportId, unitId };
  } catch {
    const fallbackRes = await requestJson<{ message: string }>(`/api/reports/${reportId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ unitId, responderId: unitId })
    });
    return { ...fallbackRes, reportId, unitId };
  }
};

export const assignResponderToReport = (
  reportId: string,
  responderId: string
): Promise<{ message: string; reportId: string; responderId: string }> =>
  assignUnitToReport(reportId, responderId).then((res) => ({
    message: res.message,
    reportId: res.reportId,
    responderId: res.unitId
  }));

export const sendEmergencyBroadcast = (
  payload: EmergencyBroadcastPayload
): Promise<{ message: string; alertId: string }> =>
  requestJson<{ message: string; alertId: string }>('/api/alerts/broadcast', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

const FIELD_LOG_STORAGE_PREFIX = 'resqtrack_field_log_';

export const getStoredIncidentFieldLog = (reportId: string): IncidentFieldLog | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${FIELD_LOG_STORAGE_PREFIX}${reportId}`);
    return raw ? (JSON.parse(raw) as IncidentFieldLog) : null;
  } catch {
    return null;
  }
};

export const persistIncidentFieldLog = async (
  reportId: string,
  payload: PersistIncidentFieldLogPayload
): Promise<IncidentFieldLog> => {
  const existing = getStoredIncidentFieldLog(reportId);

  const normalizedEvidences: IncidentEvidenceItem[] = [];
  if (Array.isArray(payload.evidences)) {
    for (const item of payload.evidences) {
      if (typeof item === 'string') {
        normalizedEvidences.push({ url: item });
      } else if (item && typeof item.url === 'string') {
        normalizedEvidences.push(item);
      }
    }
  } else if (existing?.evidences) {
    normalizedEvidences.push(...existing.evidences);
  }

  const normalizedPhotos: string[] = Array.isArray(payload.evidencePhotos)
    ? [...payload.evidencePhotos]
    : normalizedEvidences.map((e) => e.url);

  if (Array.isArray(payload.evidencePhotos)) {
    for (const photo of payload.evidencePhotos) {
      if (!normalizedEvidences.some((e) => e.url === photo)) {
        normalizedEvidences.push({ url: photo });
      }
    }
  }

  const pcrList = Array.isArray(payload.pcrRecords)
    ? payload.pcrRecords
    : Array.isArray(payload.casualties)
    ? payload.casualties
    : existing?.pcrRecords ?? [];

  const casualtiesList = Array.isArray(payload.casualties)
    ? payload.casualties
    : pcrList;

  const isVerified = payload.isVerified ?? payload.adminAiVerified ?? existing?.isVerified ?? false;
  const adminAiVerified = payload.adminAiVerified ?? payload.isVerified ?? existing?.adminAiVerified ?? false;
  const verifiedAt =
    payload.verifiedAt !== undefined
      ? payload.verifiedAt
      : isVerified
      ? existing?.verifiedAt ?? new Date().toISOString()
      : null;

  const submittedAt = payload.submittedAt || existing?.submittedAt || new Date().toISOString();

  const record: IncidentFieldLog = {
    reportId,
    evidences: normalizedEvidences,
    evidencePhotos: normalizedPhotos,
    pcrRecords: pcrList,
    casualties: casualtiesList,
    isVerified,
    adminAiVerified,
    verifiedAt,
    submittedAt,
    notes: payload.notes ?? existing?.notes ?? ''
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${FIELD_LOG_STORAGE_PREFIX}${reportId}`, JSON.stringify(record));
    } catch {
      // Storage fallback
    }
  }

  try {
    await requestJson<{ message: string }>(`/api/settings/FIELD_LOG_${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ value: JSON.stringify(record) })
    });
  } catch {
    // Non-fatal if setting key is absent on backend
  }

  return record;
};

export const getIncidentFieldLog = async (reportId: string): Promise<IncidentFieldLog | null> => {
  const local = getStoredIncidentFieldLog(reportId);

  try {
    const settings = await requestJson<Array<{ key: string; value: string }>>('/api/settings', {
      method: 'GET'
    });
    if (Array.isArray(settings)) {
      const match = settings.find((s) => s.key === `FIELD_LOG_${reportId}`);
      if (match?.value) {
        const parsed = JSON.parse(match.value) as IncidentFieldLog;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`${FIELD_LOG_STORAGE_PREFIX}${reportId}`, JSON.stringify(parsed));
          } catch {
            // Storage quota fallback
          }
        }
        return parsed;
      }
    }
  } catch {
    // Fall back to local storage
  }

  return local;
};
