// [Layer: Endpoints]
// Responsibility: LDRRMO admin governance, user CRUD, verification, and allocation API stubs using arrow lambdas (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

import { requestJson } from './apiClient';
export * from './userEndpoints';

export interface IncidentFixture {
  id: string;
  fixtureCode: string;
  title: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  assignedUnitType: string;
  isActive: boolean;
  description: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
}

export const getIncidentFixtures = (): Promise<IncidentFixture[]> =>
  requestJson<IncidentFixture[]>('/api/incidents/fixtures', { method: 'GET' });

export const verifyReport = (reportId: string, status: string, adminNote?: string): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/reports/${reportId}/verify`, {
    method: 'POST',
    body: JSON.stringify({ status, adminNote })
  });

export const allocateReportUnit = (reportId: string, unitId: string): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/reports/${reportId}/allocate`, {
    method: 'POST',
    body: JSON.stringify({ unitId })
  });

export const getSystemSettings = (): Promise<SystemSetting[]> =>
  requestJson<SystemSetting[]>('/api/settings', { method: 'GET' });

export const updateSystemSetting = (key: string, value: string): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value })
  });

export const getAuditLogs = (): Promise<AuditLog[]> =>
  requestJson<AuditLog[]>('/api/settings/audit', { method: 'GET' });
