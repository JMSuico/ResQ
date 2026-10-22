// [Layer: Endpoints]
// Responsibility: Public civilian emergency operations, alerts, and incident queries using arrow lambdas (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

import { requestJson } from './apiClient';
import type { AlertItem } from './reportsApi';
import type { SystemSetting } from './adminGovernanceApi';

export const getPublicAlerts = (): Promise<AlertItem[]> =>
  requestJson<AlertItem[]>('/api/alerts', { method: 'GET' });

export const getPublicAdvisories = (): Promise<SystemSetting[]> =>
  requestJson<SystemSetting[]>('/api/settings', { method: 'GET' });
