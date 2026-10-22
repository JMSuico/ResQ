// [Layer: Endpoints]
// Responsibility: Tactical responder operations and duty roster API stubs using arrow lambdas (=>).
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

export const getDutyRoster = (): Promise<DutyUnit[]> =>
  requestJson<DutyUnit[]>('/api/responders/roster', { method: 'GET' });

export const updateUnitDutyStatus = (
  unitId: string,
  status: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty'
): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/responders/units/${unitId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
