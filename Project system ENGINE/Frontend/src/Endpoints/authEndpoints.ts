// [Layer: Endpoints]
// Responsibility: Authentication, session verification, and token lifecycle endpoint stubs using universal arrow lambdas (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

import { requestJson } from './apiClient';

export type UserRole = 'LDRRMO_Admin' | 'Responder' | 'Civilian';
export type ResponderUnit = 'None' | 'LDRRMO' | 'RHU' | 'FIRE' | 'PNP' | 'Security';
export type AccountStatus = 'Verified' | 'Suspended' | 'Pending';

export interface UserSession {
  userId: string;
  fullName: string;
  email: string;
  employeeOrResidentId: string;
  role: UserRole;
  unit: ResponderUnit;
  status: AccountStatus;
  faceVerified: boolean;
  departmentOrBarangay?: string;
  rankOrTitle?: string;
  targetDashboardUrl: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  employeeOrResidentId?: string;
  validIdType?: string;
  role: UserRole;
  unit: ResponderUnit;
  departmentOrBarangay?: string;
  rankOrTitle?: string;
  idCaptureDataUrl?: string;
  faceCaptureDataUrl?: string;
}

export interface RegisterResponse {
  message: string;
  faceVerified: boolean;
  status: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  selectedTabRole?: string;
  portalOrigin?: string;
}

export interface LoginResponse {
  token: string;
  session: UserSession;
  redirectUrl: string;
}

export const registerUser = (payload: RegisterPayload): Promise<RegisterResponse> =>
  requestJson<RegisterResponse>('/api/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const loginUser = (payload: LoginPayload): Promise<LoginResponse> =>
  requestJson<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const getSession = (): Promise<UserSession> =>
  requestJson<UserSession>('/api/session', { method: 'GET' });

export const getUserSession = (): Promise<UserSession> =>
  requestJson<UserSession>('/api/session', { method: 'GET' });

export const getUserProfile = (): Promise<UserSession> =>
  requestJson<UserSession>('/api/session', { method: 'GET' });

export const logoutUser = async (): Promise<{ message: string }> => {
  try {
    return await requestJson<{ message: string }>('/api/logout', { method: 'POST' });
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('resqtrack_token');
      localStorage.removeItem('resqtrack_user');
    }
  }
};
