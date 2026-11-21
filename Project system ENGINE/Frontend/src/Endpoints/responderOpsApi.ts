// [Layer: Endpoints]
// Responsibility: Tactical responder operations, duty roster, PCR, police blotter, and PostgreSQL dispatch request APIs using arrow lambdas (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage and ZERO localStorage fallback ledgers.

import { requestJson } from './apiClient';

export interface DutyUnit {
  id: string;
  unitCode: string;
  unitName: string;
  agency: string;
  commanderName: string;
  status: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty';
  baseLatitude: number;
  baseLongitude: number;
  contactHotline?: string;
  activePersonnelCount: number;
  shiftSchedule: string;
  updatedAt: string;
}

export interface CreatePcrPayload {
  reportId?: string;
  patientName: string;
  age: number;
  gender: string;
  weightKg?: number;
  levelOfConsciousness: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRateBpm: number;
  respiratoryRate: number;
  spO2Percent: number;
  bloodGlucoseMgDl?: number;
  temperatureCelsius?: number;
  interventions?: string[];
  anatomicalInjuries?: string[];
  chiefComplaint?: string;
  narrative?: string;
  medicName?: string;
  unitCode?: string;
}

export interface PatientCareRecord {
  id: string;
  pcrReference: string;
  reportId?: string | null;
  responderUserId?: string | null;
  medicName: string;
  unitCode: string;
  patientName: string;
  age: number;
  gender: string;
  weightKg: number;
  levelOfConsciousness: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRateBpm: number;
  respiratoryRate: number;
  spO2Percent: number;
  bloodGlucoseMgDl: number;
  temperatureCelsius: number;
  interventions: string[];
  anatomicalInjuries: string[];
  chiefComplaint: string;
  narrative: string;
  createdAt: string;
}

export interface CreateBlotterPayload {
  reportId?: string;
  incidentClassification: string;
  complainantName: string;
  complainantContact?: string;
  complainantAddress?: string;
  suspectName?: string;
  suspectDescription?: string;
  witnesses?: string;
  narrativeStatement: string;
  incidentLocation: string;
  incidentDateTime?: string;
  investigatingOfficerName?: string;
  investigatingOfficerBadge?: string;
  station?: string;
}

export interface PoliceBlotterEntry {
  id: string;
  blotterNumber: string;
  reportId?: string | null;
  incidentClassification: string;
  complainantName: string;
  complainantContact?: string | null;
  complainantAddress?: string | null;
  suspectName?: string | null;
  suspectDescription?: string | null;
  witnesses?: string | null;
  narrativeStatement: string;
  incidentLocation: string;
  incidentDateTime: string;
  investigatingOfficerName: string;
  investigatingOfficerBadge: string;
  station: string;
  cryptographicSeal: string;
  createdAt: string;
}

export interface HydrantFixture {
  id: string;
  fixtureCode: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  flowRateGpm: number;
  flowClass: string;
  isActive: boolean;
}

export const getDutyRoster = (agency?: string): Promise<DutyUnit[]> =>
  requestJson<DutyUnit[]>(`/api/responder-ops/roster${agency ? `?agency=${agency}` : ''}`, { method: 'GET' });

export const updateDutyStatus = (
  status: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty',
  unitId?: string,
  unitCode?: string
): Promise<{ message: string; data?: DutyUnit }> =>
  requestJson<{ message: string; data?: DutyUnit }>('/api/responder-ops/duty-status', {
    method: 'PUT',
    body: JSON.stringify({ status, unitId, unitCode })
  });

export const updateUnitDutyStatus = (
  unitId: string,
  status: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty'
): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/responder-ops/units/${unitId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });

export const submitPcrRecord = (payload: CreatePcrPayload): Promise<{ message: string; data: PatientCareRecord }> =>
  requestJson<{ message: string; data: PatientCareRecord }>('/api/responder-ops/pcr', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const getPcrRecords = (reportId?: string): Promise<PatientCareRecord[]> =>
  requestJson<PatientCareRecord[]>(`/api/responder-ops/pcr${reportId ? `?reportId=${reportId}` : ''}`, { method: 'GET' });

export const filePoliceBlotter = (payload: CreateBlotterPayload): Promise<{ message: string; data: PoliceBlotterEntry }> =>
  requestJson<{ message: string; data: PoliceBlotterEntry }>('/api/responder-ops/blotter', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const getPoliceBlotters = (reportId?: string): Promise<PoliceBlotterEntry[]> =>
  requestJson<PoliceBlotterEntry[]>(`/api/responder-ops/blotter${reportId ? `?reportId=${reportId}` : ''}`, { method: 'GET' });

export const getNearbyHydrants = (): Promise<HydrantFixture[]> =>
  requestJson<HydrantFixture[]>('/api/responder-ops/hydrants', { method: 'GET' });

// ============================================================================
// REQUEST & DEPLOY + RESPONDER NOTIFICATION SYNC API (PostgreSQL Backed)
// ============================================================================

export type DispatchRequestDirection = 'MEDIC_REQUEST' | 'ADMIN_ORDER';

export type DispatchRequestStatus =
  | 'PENDING'
  | 'DEPLOY'
  | 'TO BE DEPLOYED'
  | 'DECLINED'
  | 'RESPONDED'
  | 'CLOSED';

export type ResponderNotificationCategory =
  | 'REQUEST_DISPATCH_DEPLOY'
  | 'ADMIN_REQUEST_DEPLOY'
  | 'INCIDENT_HAPPENS'
  | 'SUBMITTED_INCIDENT_LOGS'
  | 'VERIFIED_INCIDENT_LOGS'
  | 'CLOSE_CASE';

export interface DispatchRequestRecord {
  id: string;
  incidentId: string;
  incidentCode: string;
  incidentTitle: string;
  category: string;
  severity: string;
  location: string;
  coordinates: string;
  ipAddress: string;
  evidenceUrl?: string;
  responderId: string;
  responderName: string;
  direction: DispatchRequestDirection;
  status: DispatchRequestStatus;
  requestedAt: string;
  updatedAt: string;
  notes?: string;
}

export interface CreateMedicDispatchRequestPayload {
  incidentId?: string;
  incidentCode?: string;
  incidentTitle: string;
  category?: string;
  severity?: string;
  location: string;
  coordinates?: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
  evidenceUrl?: string;
  responderId?: string;
  responderName?: string;
  targetUnit?: string;
  originUnit?: string;
  direction?: DispatchRequestDirection;
  status?: DispatchRequestStatus;
  notes?: string;
}

export interface ResponderNotificationPayload {
  title: string;
  message: string;
  category: ResponderNotificationCategory;
  incidentId?: string;
}

export interface ResponderNotificationRecord extends ResponderNotificationPayload {
  id: string;
  type: ResponderNotificationCategory;
  timestamp: string;
  isRead: boolean;
}

interface RawBackendDispatchRequest {
  id?: string;
  incidentId?: string;
  reportId?: string;
  incidentCode?: string;
  requestCode?: string;
  incidentTitle?: string;
  title?: string;
  category?: string;
  severity?: string;
  location?: string;
  locationLabel?: string;
  coordinates?: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string | null;
  evidenceUrl?: string;
  responderId?: string;
  targetUnit?: string;
  originUnit?: string;
  responderName?: string;
  requestedByName?: string;
  respondedByName?: string | null;
  direction?: string;
  status?: string;
  requestedAt?: string;
  createdAtUtc?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedAtUtc?: string;
  notes?: string;
  description?: string;
}

const normalizeDispatchStatus = (raw?: string): DispatchRequestStatus => {
  const upper = (raw || 'PENDING').trim().toUpperCase();
  if (
    upper === 'PENDING' ||
    upper === 'DEPLOY' ||
    upper === 'TO BE DEPLOYED' ||
    upper === 'DECLINED' ||
    upper === 'RESPONDED' ||
    upper === 'CLOSED'
  ) {
    return upper;
  }
  if (upper === 'TO_BE_DEPLOYED' || upper === 'APPROVED') return 'TO BE DEPLOYED';
  if (upper === 'DISPATCHED') return 'DEPLOY';
  return 'PENDING';
};

const normalizeDispatchDirection = (raw?: string): DispatchRequestDirection => {
  const upper = (raw || 'MEDIC_REQUEST').trim().toUpperCase();
  return upper === 'ADMIN_ORDER' ? 'ADMIN_ORDER' : 'MEDIC_REQUEST';
};

const parseCoordinatesPair = (
  coordinates?: string,
  latitude?: number,
  longitude?: number
): { lat: number; lng: number; formatted: string } => {
  if (typeof latitude === 'number' && typeof longitude === 'number' && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
    return {
      lat: latitude,
      lng: longitude,
      formatted: coordinates || `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`
    };
  }
  if (coordinates) {
    const matches = coordinates.match(/-?\d+(\.\d+)?/g);
    if (matches && matches.length >= 2) {
      const parsedLat = Number(matches[0]);
      const parsedLng = Number(matches[1]);
      if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
        return { lat: parsedLat, lng: parsedLng, formatted: coordinates };
      }
    }
  }
  return {
    lat: 8.5119,
    lng: 123.2814,
    formatted: coordinates || '8.5119° N, 123.2814° E'
  };
};

const mapDispatchRecord = (raw: RawBackendDispatchRequest): DispatchRequestRecord => {
  const coords = parseCoordinatesPair(raw.coordinates, raw.latitude, raw.longitude);
  const id = raw.id || raw.requestCode || raw.incidentCode || '';
  const createdAt = raw.requestedAt || raw.createdAtUtc || raw.createdAt || new Date().toISOString();
  const updatedAt = raw.updatedAt || raw.updatedAtUtc || createdAt;
  return {
    id,
    incidentId: raw.incidentId || raw.reportId || id,
    incidentCode: raw.incidentCode || raw.requestCode || id,
    incidentTitle: raw.incidentTitle || raw.title || 'Dispatch Request',
    category: raw.category || raw.originUnit || 'Emergency Dispatch',
    severity: raw.severity || 'High',
    location: raw.location || raw.locationLabel || 'Katipunan Municipal Sector',
    coordinates: coords.formatted,
    ipAddress: raw.ipAddress || '',
    evidenceUrl: raw.evidenceUrl,
    responderId: raw.responderId || raw.targetUnit || '',
    responderName: raw.responderName || raw.requestedByName || raw.respondedByName || raw.targetUnit || 'Responder Unit',
    direction: normalizeDispatchDirection(raw.direction),
    status: normalizeDispatchStatus(raw.status),
    requestedAt: createdAt,
    updatedAt,
    notes: raw.notes ?? raw.description
  };
};

const unwrapDispatchPayload = (
  res: RawBackendDispatchRequest | { data?: RawBackendDispatchRequest; request?: RawBackendDispatchRequest }
): DispatchRequestRecord => {
  const wrapped = res as { data?: RawBackendDispatchRequest; request?: RawBackendDispatchRequest };
  const record = wrapped.data || wrapped.request || (res as RawBackendDispatchRequest);
  return mapDispatchRecord(record);
};

export const pushResponderNotification = (
  notification: ResponderNotificationPayload
): ResponderNotificationRecord => {
  const entry: ResponderNotificationRecord = {
    id: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    title: notification.title,
    message: notification.message,
    category: notification.category,
    type: notification.category,
    incidentId: notification.incidentId,
    timestamp: new Date().toISOString(),
    isRead: false
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:notification', {
        detail: entry
      })
    );
  }

  return entry;
};

export const getResponderNotifications = (): ResponderNotificationRecord[] => [];

export const getDispatchRequests = async (): Promise<DispatchRequestRecord[]> => {
  const raw = await requestJson<RawBackendDispatchRequest[] | { items?: RawBackendDispatchRequest[]; data?: RawBackendDispatchRequest[] }>(
    '/api/dispatch-requests',
    { method: 'GET' }
  );
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.items) ? raw.items : [];
  return list
    .map(mapDispatchRecord)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const createMedicDispatchRequest = async (
  payload: CreateMedicDispatchRequestPayload
): Promise<DispatchRequestRecord> => {
  const coords = parseCoordinatesPair(payload.coordinates, payload.latitude, payload.longitude);
  const direction: DispatchRequestDirection = payload.direction || 'MEDIC_REQUEST';
  const status: DispatchRequestStatus = payload.status || (direction === 'ADMIN_ORDER' ? 'TO BE DEPLOYED' : 'PENDING');

  const res = await requestJson<
    RawBackendDispatchRequest | { data?: RawBackendDispatchRequest; request?: RawBackendDispatchRequest }
  >('/api/dispatch-requests', {
    method: 'POST',
    body: JSON.stringify({
      incidentId: payload.incidentId,
      requestCode: payload.incidentCode,
      incidentCode: payload.incidentCode,
      title: payload.incidentTitle,
      incidentTitle: payload.incidentTitle,
      category: payload.category || 'Medical / Trauma',
      severity: payload.severity || 'Critical',
      location: payload.location,
      locationLabel: payload.location,
      coordinates: coords.formatted,
      latitude: coords.lat,
      longitude: coords.lng,
      ipAddress: payload.ipAddress,
      evidenceUrl: payload.evidenceUrl,
      responderId: payload.responderId,
      targetUnit: payload.targetUnit || payload.responderId || 'RHU',
      originUnit: payload.originUnit || (direction === 'ADMIN_ORDER' ? 'LDRRMO' : 'RHU'),
      responderName: payload.responderName,
      requestedByName: payload.responderName,
      direction,
      status,
      description: payload.notes || '',
      notes: payload.notes || ''
    })
  });

  const created = unwrapDispatchPayload(res);

  pushResponderNotification({
    title: `Dispatch Request Submitted (${created.incidentCode})`,
    message: `${created.responderName} requested deployment for "${created.incidentTitle}" at ${created.location}. Status: ${created.status}.`,
    category: direction === 'ADMIN_ORDER' ? 'ADMIN_REQUEST_DEPLOY' : 'REQUEST_DISPATCH_DEPLOY',
    incidentId: created.incidentId
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:report', {
        detail: {
          type: direction === 'ADMIN_ORDER' ? 'ADMIN_REQUEST_DEPLOY' : 'REQUEST_DISPATCH_DEPLOY',
          request: created
        }
      })
    );
  }

  return created;
};

export const updateDispatchRequestStatus = async (
  id: string,
  status: DispatchRequestStatus,
  notes?: string
): Promise<DispatchRequestRecord | null> => {
  const res = await requestJson<
    RawBackendDispatchRequest | { data?: RawBackendDispatchRequest; request?: RawBackendDispatchRequest }
  >(`/api/dispatch-requests/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    body: JSON.stringify({
      status,
      notes
    })
  });

  const updatedRecord = unwrapDispatchPayload(res);

  const categoryMap: Record<DispatchRequestStatus, ResponderNotificationCategory> = {
    PENDING: 'REQUEST_DISPATCH_DEPLOY',
    'TO BE DEPLOYED': 'ADMIN_REQUEST_DEPLOY',
    DEPLOY: 'REQUEST_DISPATCH_DEPLOY',
    DECLINED: 'ADMIN_REQUEST_DEPLOY',
    RESPONDED: 'SUBMITTED_INCIDENT_LOGS',
    CLOSED: 'CLOSE_CASE'
  };

  pushResponderNotification({
    title: `Incident Status Updated: ${updatedRecord.status} (${updatedRecord.incidentCode})`,
    message: `"${updatedRecord.incidentTitle}" transitioned to ${updatedRecord.status}.`,
    category: categoryMap[updatedRecord.status],
    incidentId: updatedRecord.incidentId
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:report', {
        detail: {
          type: 'DISPATCH_STATUS_UPDATED',
          request: updatedRecord
        }
      })
    );
  }

  return updatedRecord;
};

export const approveMedicRequestByAdmin = async (
  id: string
): Promise<DispatchRequestRecord | null> => {
  const updatedRecord = await updateDispatchRequestStatus(
    id,
    'DEPLOY',
    'Approved by LDRRMO Command Admin — Unit cleared for active DEPLOY.'
  );

  if (updatedRecord && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:report', {
        detail: {
          type: 'ADMIN_APPROVED_DEPLOY',
          request: updatedRecord
        }
      })
    );
  }

  return updatedRecord;
};

export const respondToAdminDeployOrder = async (
  id: string,
  decision: 'ACCEPT' | 'DECLINE'
): Promise<DispatchRequestRecord | null> => {
  const nextStatus: DispatchRequestStatus = decision === 'ACCEPT' ? 'DEPLOY' : 'DECLINED';
  const notes =
    decision === 'ACCEPT'
      ? 'Responder ACCEPTED Admin deployment order — Unit actively DEPLOYED to scene.'
      : 'Responder DECLINED Admin deployment order — Flagged for unit reassignment.';

  const updatedRecord = await updateDispatchRequestStatus(id, nextStatus, notes);

  if (updatedRecord && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:report', {
        detail: {
          type: decision === 'ACCEPT' ? 'MEDIC_ACCEPTED_DEPLOY' : 'MEDIC_DECLINED_DEPLOY',
          decision,
          request: updatedRecord
        }
      })
    );
  }

  return updatedRecord;
};
