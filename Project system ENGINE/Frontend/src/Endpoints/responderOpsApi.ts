// [Layer: Endpoints]
// Responsibility: Tactical responder operations, duty roster, PCR, and police blotter API stubs using arrow lambdas (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

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
// REQUEST & DEPLOY + RESPONDER NOTIFICATION SYNC API
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
  ipAddress?: string;
  evidenceUrl?: string;
  responderId?: string;
  responderName?: string;
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

const DISPATCH_STORAGE_KEY = 'resqtrack_dispatch_requests';
const NOTIFICATION_STORAGE_KEY = 'resqtrack_responder_notifications';
const SETTING_LEDGER_KEY = 'DISPATCH_REQUESTS_LEDGER';

const buildDispatchEvidenceUri = (code: string, subtitle: string): string => {
  const safeCode = code.replace(/[<>&"']/g, '');
  const safeSub = subtitle.replace(/[<>&"']/g, '');
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">',
    '<rect width="640" height="360" fill="#4A041A"/>',
    '<rect x="24" y="24" width="592" height="312" rx="20" fill="#F7F1EA"/>',
    '<rect x="44" y="44" width="180" height="32" rx="8" fill="#670626"/>',
    `<text x="134" y="65" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" fill="#F7F1EA">${safeCode}</text>`,
    `<text x="320" y="185" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="#2B010E">${safeSub}</text>`,
    '<text x="320" y="220" text-anchor="middle" font-family="monospace" font-size="12" fill="#A83B4D">RESQTRACK KATIPUNAN DISPATCH TELEMETRY</text>',
    '</svg>'
  ].join('');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const buildInitialSeedRequests = (): DispatchRequestRecord[] => {
  const now = Date.now();
  return [
    {
      id: 'REQ-MED-2026-001',
      incidentId: 'INC-EMS-9041',
      incidentCode: 'RHU-2026-9041',
      incidentTitle: 'Multi-Vehicle Highway Collision - Trauma Triage',
      category: 'Medical / Trauma',
      severity: 'Critical',
      location: 'National Highway, Brgy. Dos (Poblacion), Katipunan, ZN',
      coordinates: '8.5119° N, 123.2814° E',
      ipAddress: '192.168.42.118',
      evidenceUrl: buildDispatchEvidenceUri('RHU-2026-9041', 'Highway Trauma Triage'),
      responderId: 'MED-UNIT-01',
      responderName: 'Medic Alpha-1 (RHU EMS)',
      direction: 'MEDIC_REQUEST',
      status: 'PENDING',
      requestedAt: new Date(now - 14 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 14 * 60 * 1000).toISOString(),
      notes:
        'Medic field unit spotted high-impact collision on patrol telemetry; requesting immediate LDRRMO Admin clearance to deploy ALS ambulance.',
    },
    {
      id: 'ORD-ADM-2026-002',
      incidentId: 'INC-EMS-9044',
      incidentCode: 'RHU-2026-9044',
      incidentTitle: 'Acute Cardiac Arrest & Respiratory Distress',
      category: 'Medical Emergency',
      severity: 'Critical',
      location: 'Purok 2, Brgy. Uno (Poblacion), Katipunan, ZN',
      coordinates: '8.5162° N, 123.2858° E',
      ipAddress: '10.24.88.204',
      evidenceUrl: buildDispatchEvidenceUri('RHU-2026-9044', 'Cardiac & Respiratory Response'),
      responderId: 'MED-UNIT-01',
      responderName: 'Medic Alpha-1 (RHU EMS)',
      direction: 'ADMIN_ORDER',
      status: 'TO BE DEPLOYED',
      requestedAt: new Date(now - 6 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 6 * 60 * 1000).toISOString(),
      notes:
        'LDRRMO Command Center priority dispatch order: Civilian cardiac emergency verified via optical & GPS telemetry. Awaiting Medic ACCEPT confirmation.',
    },
  ];
};

const readStoredDispatchRequests = (): DispatchRequestRecord[] => {
  if (typeof window === 'undefined') return buildInitialSeedRequests();
  try {
    const raw = localStorage.getItem(DISPATCH_STORAGE_KEY);
    if (!raw) {
      const seeded = buildInitialSeedRequests();
      localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as DispatchRequestRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = buildInitialSeedRequests();
      localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    return buildInitialSeedRequests();
  }
};

const writeStoredDispatchRequests = (records: DispatchRequestRecord[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota errors
  }
};

const syncLedgerFromBackend = async (): Promise<DispatchRequestRecord[] | null> => {
  try {
    const settings = await requestJson<Array<{ key: string; value: string }>>('/api/settings', {
      method: 'GET'
    });
    if (Array.isArray(settings)) {
      const match = settings.find((s) => s.key === SETTING_LEDGER_KEY);
      if (match?.value) {
        const parsed = JSON.parse(match.value) as DispatchRequestRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {
    // Fall back gracefully to localStorage
  }
  return null;
};

const isCurrentSessionAdmin = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const candidates = [
      sessionStorage.getItem('resqtrack_session'),
      sessionStorage.getItem('resqtrack_user'),
      localStorage.getItem('resqtrack_session_1996'),
      localStorage.getItem('resqtrack_session')
    ];
    for (const raw of candidates) {
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { role?: string };
      const role = (parsed?.role || '').toLowerCase();
      if (role.includes('admin') || role.includes('ldrrmo') || role === '1') {
        return true;
      }
      if (role !== '') return false;
    }
  } catch {
    return false;
  }
  return false;
};

const syncLedgerToBackend = async (records: DispatchRequestRecord[]): Promise<void> => {
  if (!isCurrentSessionAdmin()) {
    return;
  }
  try {
    await requestJson<{ message: string }>(`/api/settings/${SETTING_LEDGER_KEY}`, {
      method: 'PUT',
      body: JSON.stringify({ value: JSON.stringify(records) })
    });
  } catch {
    // If backend rejects (e.g., key unseeded), local state is still persisted in localStorage
  }
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
    isRead: false,
  };

  if (typeof window !== 'undefined') {
    try {
      const existingRaw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      const existing: ResponderNotificationRecord[] = existingRaw
        ? (JSON.parse(existingRaw) as ResponderNotificationRecord[])
        : [];
      const updated = [entry, ...(Array.isArray(existing) ? existing : [])].slice(0, 100);
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }

    window.dispatchEvent(
      new CustomEvent('resqtrack:notification', {
        detail: entry,
      })
    );
  }

  return entry;
};

export const getResponderNotifications = (): ResponderNotificationRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ResponderNotificationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getDispatchRequests = async (): Promise<DispatchRequestRecord[]> => {
  let records = readStoredDispatchRequests();

  // 1. Attempt to sync with backend ledger
  const remoteLedger = await syncLedgerFromBackend();
  if (remoteLedger && remoteLedger.length > 0) {
    const map = new Map<string, DispatchRequestRecord>();
    for (const r of records) {
      map.set(r.id, r);
    }
    for (const r of remoteLedger) {
      const existing = map.get(r.id);
      if (!existing || new Date(r.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
        map.set(r.id, r);
      }
    }
    records = Array.from(map.values());
    writeStoredDispatchRequests(records);
  }

  // 2. Fetch live reports and synchronize newly reported medical incidents
  try {
    const reports = await requestJson<
      Array<{
        id: string;
        referenceCode?: string;
        title?: string;
        category?: string;
        severity?: string;
        status?: string;
        latitude?: number;
        longitude?: number;
        locationLabel?: string;
        imageUrl?: string | null;
        allocatedUnitCode?: string | null;
        createdAt?: string;
      }>
    >('/api/reports', { method: 'GET' });

    if (Array.isArray(reports) && reports.length > 0) {
      const existingIncidentIds = new Set(records.map((r) => r.incidentId));
      const merged = [...records];
      let hasNewReport = false;

      reports.slice(0, 8).forEach((rep, idx) => {
        if (!rep.id || existingIncidentIds.has(rep.id)) return;
        const catLower = String(rep.category ?? '').toLowerCase();
        const isMedical =
          !catLower ||
          catLower.includes('med') ||
          catLower.includes('trauma') ||
          catLower.includes('accident') ||
          idx < 2;

        if (!isMedical) return;

        const lat = typeof rep.latitude === 'number' ? rep.latitude.toFixed(4) : '8.5119';
        const lng = typeof rep.longitude === 'number' ? rep.longitude.toFixed(4) : '123.2814';

        merged.push({
          id: `REQ-SYNC-${rep.id.slice(0, 8).toUpperCase()}`,
          incidentId: rep.id,
          incidentCode: rep.referenceCode || `RHU-${rep.id.slice(0, 6).toUpperCase()}`,
          incidentTitle: rep.title || 'Emergency Medical Incident',
          category: rep.category || 'Medical / Trauma',
          severity: rep.severity || 'High',
          location: rep.locationLabel || 'Katipunan Municipal Sector',
          coordinates: `${lat}° N, ${lng}° E`,
          ipAddress: `192.168.10.${110 + idx}`,
          evidenceUrl: rep.imageUrl || undefined,
          responderId: rep.allocatedUnitCode || 'MED-UNIT-01',
          responderName: 'Medic Alpha-1 (RHU EMS)',
          direction: idx % 2 === 0 ? 'ADMIN_ORDER' : 'MEDIC_REQUEST',
          status:
            rep.status === 'Resolved' || rep.status === 'Closed'
              ? 'CLOSED'
              : rep.status === 'Dispatched'
              ? 'DEPLOY'
              : idx % 2 === 0
              ? 'TO BE DEPLOYED'
              : 'PENDING',
          requestedAt: rep.createdAt || new Date().toISOString(),
          updatedAt: rep.createdAt || new Date().toISOString(),
          notes: 'Synchronized from live ResQTrack incident telemetry feed.',
        });
        hasNewReport = true;
      });

      if (hasNewReport) {
        writeStoredDispatchRequests(merged);
        syncLedgerToBackend(merged).catch(() => {});
        records = merged;
      }
    }
  } catch {
    // Offline / local fallback uses records seamlessly
  }

  return [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

export const createMedicDispatchRequest = async (
  payload: CreateMedicDispatchRequestPayload
): Promise<DispatchRequestRecord> => {
  const nowIso = new Date().toISOString();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const current = readStoredDispatchRequests();

  const newRecord: DispatchRequestRecord = {
    id: `REQ-MED-${suffix}`,
    incidentId: payload.incidentId || `INC-EMS-${suffix}`,
    incidentCode: payload.incidentCode || `RHU-2026-${suffix}`,
    incidentTitle: payload.incidentTitle,
    category: payload.category || 'Medical / Trauma',
    severity: payload.severity || 'Critical',
    location: payload.location,
    coordinates: payload.coordinates || '8.5119° N, 123.2814° E',
    ipAddress: payload.ipAddress || `192.168.42.${Math.floor(20 + Math.random() * 200)}`,
    evidenceUrl: payload.evidenceUrl || undefined,
    responderId: payload.responderId || 'MED-UNIT-01',
    responderName: payload.responderName || 'Medic Alpha-1 (RHU EMS)',
    direction: 'MEDIC_REQUEST',
    status: 'PENDING',
    requestedAt: nowIso,
    updatedAt: nowIso,
    notes:
      payload.notes ||
      'Medic responder initiated dispatch request; awaiting LDRRMO Admin verification and deployment clearance.',
  };

  const updated = [newRecord, ...current];
  writeStoredDispatchRequests(updated);
  await syncLedgerToBackend(updated);

  pushResponderNotification({
    title: `Dispatch Request Submitted (${newRecord.incidentCode})`,
    message: `${newRecord.responderName} requested deployment for "${newRecord.incidentTitle}" at ${newRecord.location}. Status: PENDING Admin approval.`,
    category: 'REQUEST_DISPATCH_DEPLOY',
    incidentId: newRecord.incidentId,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:report', {
        detail: {
          type: 'REQUEST_DISPATCH_DEPLOY',
          request: newRecord,
        },
      })
    );
  }

  return newRecord;
};

export const approveMedicRequestByAdmin = async (
  id: string
): Promise<DispatchRequestRecord | null> => {
  const current = readStoredDispatchRequests();
  const targetIndex = current.findIndex((item) => item.id === id);
  if (targetIndex === -1) return null;

  const target = current[targetIndex];
  const updatedRecord: DispatchRequestRecord = {
    ...target,
    status: 'DEPLOY',
    updatedAt: new Date().toISOString(),
    notes: `${
      target.notes ? `${target.notes} | ` : ''
    }Approved by LDRRMO Command Admin — Unit cleared for active DEPLOY.`,
  };

  const nextList = [...current];
  nextList[targetIndex] = updatedRecord;
  writeStoredDispatchRequests(nextList);
  await syncLedgerToBackend(nextList);

  // Cross-service backend sync: allocate report and update unit status
  if (updatedRecord.incidentId) {
    try {
      const isGuid = (val: string): boolean =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      let targetUnitId = updatedRecord.responderId;

      if (!isGuid(targetUnitId)) {
        try {
          const roster = await getDutyRoster();
          const matched = roster.find(
            (u) =>
              u.id === targetUnitId ||
              u.unitCode === targetUnitId ||
              u.unitName === targetUnitId
          );
          if (matched) {
            targetUnitId = matched.id;
          }
        } catch {
          // Fall back to targetUnitId
        }
      }

      if (isGuid(updatedRecord.incidentId) && isGuid(targetUnitId)) {
        await requestJson<{ message: string }>(`/api/reports/${updatedRecord.incidentId}/allocate`, {
          method: 'POST',
          body: JSON.stringify({ unitId: targetUnitId })
        }).catch(() => {});
      }

      if (isGuid(targetUnitId)) {
        await requestJson<{ message: string }>(`/api/responder-ops/units/${targetUnitId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'Dispatched' })
        }).catch(() => {});
      }
    } catch {
      // Backend allocation/status call failure is non-fatal to optimistic client transition
    }
  }

  pushResponderNotification({
    title: `Admin Approved Deployment (${updatedRecord.incidentCode})`,
    message: `LDRRMO Admin approved request ${updatedRecord.id} for "${updatedRecord.incidentTitle}". State transitioned from PENDING to DEPLOY.`,
    category: 'ADMIN_REQUEST_DEPLOY',
    incidentId: updatedRecord.incidentId,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:report', {
        detail: {
          type: 'ADMIN_APPROVED_DEPLOY',
          request: updatedRecord,
        },
      })
    );
  }

  return updatedRecord;
};

export const respondToAdminDeployOrder = async (
  id: string,
  decision: 'ACCEPT' | 'DECLINE'
): Promise<DispatchRequestRecord | null> => {
  const current = readStoredDispatchRequests();
  const targetIndex = current.findIndex((item) => item.id === id);
  if (targetIndex === -1) return null;

  const nextStatus: DispatchRequestStatus = decision === 'ACCEPT' ? 'DEPLOY' : 'DECLINED';
  const updatedRecord: DispatchRequestRecord = {
    ...current[targetIndex],
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    notes:
      decision === 'ACCEPT'
        ? 'Medic Responder ACCEPTED Admin deployment order — Unit actively DEPLOYED to scene.'
        : 'Medic Responder DECLINED Admin deployment order — Flagged for unit reassignment.',
  };

  const nextList = [...current];
  nextList[targetIndex] = updatedRecord;
  writeStoredDispatchRequests(nextList);
  await syncLedgerToBackend(nextList);

  if (decision === 'ACCEPT' && updatedRecord.responderId) {
    const isGuid = (val: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    let targetUnitId = updatedRecord.responderId;
    if (!isGuid(targetUnitId)) {
      try {
        const roster = await getDutyRoster();
        const matched = roster.find(
          (u) =>
            u.id === targetUnitId ||
            u.unitCode === targetUnitId ||
            u.unitName === targetUnitId
        );
        if (matched) {
          targetUnitId = matched.id;
        }
      } catch {
        // Fall back
      }
    }

    if (isGuid(targetUnitId)) {
      requestJson<{ message: string }>(`/api/responder-ops/units/${targetUnitId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Dispatched' })
      }).catch(() => {});
    }
  }

  pushResponderNotification({
    title:
      decision === 'ACCEPT'
        ? `Deployment Order Accepted (${updatedRecord.incidentCode})`
        : `Deployment Order Declined (${updatedRecord.incidentCode})`,
    message:
      decision === 'ACCEPT'
        ? `${updatedRecord.responderName} accepted Admin deploy order for "${updatedRecord.incidentTitle}". Unit status is now DEPLOY.`
        : `${updatedRecord.responderName} declined Admin deploy order for "${updatedRecord.incidentTitle}". Status: DECLINED.`,
    category:
      decision === 'ACCEPT' ? 'REQUEST_DISPATCH_DEPLOY' : 'ADMIN_REQUEST_DEPLOY',
    incidentId: updatedRecord.incidentId,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:report', {
        detail: {
          type: decision === 'ACCEPT' ? 'MEDIC_ACCEPTED_DEPLOY' : 'MEDIC_DECLINED_DEPLOY',
          decision,
          request: updatedRecord,
        },
      })
    );
  }

  return updatedRecord;
};

export const updateDispatchRequestStatus = async (
  id: string,
  status: DispatchRequestStatus,
  notes?: string
): Promise<DispatchRequestRecord | null> => {
  const current = readStoredDispatchRequests();
  const targetIndex = current.findIndex((item) => item.id === id);
  if (targetIndex === -1) return null;

  const updatedRecord: DispatchRequestRecord = {
    ...current[targetIndex],
    status,
    updatedAt: new Date().toISOString(),
    notes: notes || current[targetIndex].notes,
  };

  const nextList = [...current];
  nextList[targetIndex] = updatedRecord;
  writeStoredDispatchRequests(nextList);
  await syncLedgerToBackend(nextList);

  const categoryMap: Record<DispatchRequestStatus, ResponderNotificationCategory> = {
    PENDING: 'REQUEST_DISPATCH_DEPLOY',
    'TO BE DEPLOYED': 'ADMIN_REQUEST_DEPLOY',
    DEPLOY: 'REQUEST_DISPATCH_DEPLOY',
    DECLINED: 'ADMIN_REQUEST_DEPLOY',
    RESPONDED: 'SUBMITTED_INCIDENT_LOGS',
    CLOSED: 'CLOSE_CASE',
  };

  pushResponderNotification({
    title: `Incident Status Updated: ${status} (${updatedRecord.incidentCode})`,
    message: `"${updatedRecord.incidentTitle}" transitioned to ${status}.`,
    category: categoryMap[status],
    incidentId: updatedRecord.incidentId,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resqtrack:report', {
        detail: {
          type: 'DISPATCH_STATUS_UPDATED',
          request: updatedRecord,
        },
      })
    );
  }

  return updatedRecord;
};
