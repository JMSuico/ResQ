// [Layer: Endpoints]
// Responsibility: Tactical responder operations, duty roster, PCR, police blotter, and fire alarm API stubs using arrow lambdas (=>).
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
  contactHotline: string;
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

export interface SetAlarmLevelPayload {
  reportId?: string;
  alarmLevel: string;
  buildingType?: string;
  trappedOccupantsCount: number;
  commanderName?: string;
  reportingUnit?: string;
  remarks?: string;
  waterSupplyGallons: number;
}

export interface FireAlarmStatusRecord {
  id: string;
  reportId?: string | null;
  alarmLevel: string;
  buildingType: string;
  trappedOccupantsCount: number;
  commanderName: string;
  reportingUnit: string;
  remarks: string;
  waterSupplyGallons: number;
  updatedAt: string;
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

export const setFireAlarmLevel = (payload: SetAlarmLevelPayload): Promise<{ message: string; data: FireAlarmStatusRecord }> =>
  requestJson<{ message: string; data: FireAlarmStatusRecord }>('/api/responder-ops/alarm-level', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const getFireAlarmStatuses = (reportId?: string): Promise<FireAlarmStatusRecord[]> =>
  requestJson<FireAlarmStatusRecord[]>(`/api/responder-ops/alarm-level${reportId ? `?reportId=${reportId}` : ''}`, { method: 'GET' });

export const getNearbyHydrants = (): Promise<HydrantFixture[]> =>
  requestJson<HydrantFixture[]>('/api/responder-ops/hydrants', { method: 'GET' });
