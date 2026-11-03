// [Layer: Endpoints]
// Responsibility: User management, profile modifications, and account synchronization API stubs using arrow lambdas (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

import { requestJson } from './apiClient';
import type { UserSession } from './authEndpoints';
export * from './userEndpoints';

export interface UpdateOwnProfilePayload {
  fullName?: string;
  phoneNumber?: string;
  departmentOrBarangay?: string;
  rankOrTitle?: string;
  bloodType?: string;
  allergies?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface UpdateOwnProfileResponse {
  message: string;
  user?: UserSession;
}

export const updateOwnProfile = async (
  payload: UpdateOwnProfilePayload
): Promise<UpdateOwnProfileResponse> => {
  let response: UpdateOwnProfileResponse;

  try {
    response = await requestJson<UpdateOwnProfileResponse>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        fullName: payload.fullName,
        phoneNumber: payload.phoneNumber,
        departmentOrBarangay: payload.departmentOrBarangay,
        rankOrTitle: payload.rankOrTitle,
        bloodType: payload.bloodType,
        allergies: payload.allergies,
        emergencyContactName: payload.emergencyContactName,
        emergencyContactPhone: payload.emergencyContactPhone
      })
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Profile updated locally.';
    response = { message };
  }

  if (typeof window !== 'undefined') {
    try {
      const existingRaw =
        sessionStorage.getItem('resqtrack_session') ||
        sessionStorage.getItem('resqtrack_user') ||
        localStorage.getItem('resqtrack_session') ||
        localStorage.getItem('resqtrack_user');

      const existing: Record<string, unknown> = existingRaw
        ? (JSON.parse(existingRaw) as Record<string, unknown>)
        : {};

      const updatedSession: Record<string, unknown> = {
        ...existing,
        ...(payload.fullName ? { fullName: payload.fullName } : {}),
        ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
        ...(payload.departmentOrBarangay ? { departmentOrBarangay: payload.departmentOrBarangay } : {}),
        ...(payload.rankOrTitle ? { rankOrTitle: payload.rankOrTitle } : {}),
        ...(payload.bloodType ? { bloodType: payload.bloodType } : {}),
        ...(payload.allergies ? { allergies: payload.allergies } : {}),
        ...(payload.emergencyContactName ? { emergencyContactName: payload.emergencyContactName } : {}),
        ...(payload.emergencyContactPhone ? { emergencyContactPhone: payload.emergencyContactPhone } : {}),
        ...(response.user ? (response.user as unknown as Record<string, unknown>) : {})
      };

      const serialized = JSON.stringify(updatedSession);

      sessionStorage.setItem('resqtrack_session', serialized);
      sessionStorage.setItem('resqtrack_user', serialized);

      const port = window.location.port;
      if (port) {
        localStorage.setItem(`resqtrack_session_${port}`, serialized);
        localStorage.setItem(`resqtrack_user_${port}`, serialized);
      }

      localStorage.setItem('resqtrack_session', serialized);
      localStorage.setItem('resqtrack_user', serialized);

      window.dispatchEvent(
        new CustomEvent('resqtrack:profile_updated', {
          detail: updatedSession
        })
      );
    } catch {
      // Storage quota or parsing safeguard
    }
  }

  return response;
};
