// [Layer: Endpoints]
// Responsibility: User management, profile retrieval/modification, and account synchronization APIs using arrow lambdas (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

import { requestJson } from './apiClient';
import type { UserSession } from './authEndpoints';
export * from './userEndpoints';

export interface OwnProfileDto extends UserSession {
  id?: string;
  phoneNumber?: string;
  bloodType?: string;
  allergies?: string;
  medicalConditions?: string;
  isOrganDonor?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  secondaryContactName?: string;
  secondaryContactPhone?: string;
  avatarDataUrl?: string | null;
  avatarCapturePath?: string | null;
  province?: string;
  cityOrMunicipality?: string;
  barangay?: string;
  streetOrPurok?: string;
  dateOfBirth?: string;
  sex?: string;
}

export interface UpdateOwnProfilePayload {
  fullName?: string;
  displayName?: string;
  phoneNumber?: string;
  departmentOrBarangay?: string;
  rankOrTitle?: string;
  bloodType?: string;
  allergies?: string;
  medicalConditions?: string;
  isOrganDonor?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  secondaryContactName?: string;
  secondaryContactPhone?: string;
  avatarDataUrl?: string | null;
}

export interface UpdateOwnProfileResponse {
  message: string;
  user?: OwnProfileDto;
}

export const getOwnProfile = (): Promise<OwnProfileDto> =>
  requestJson<OwnProfileDto>('/api/profile', { method: 'GET' });

export const updateOwnProfile = async (
  payload: UpdateOwnProfilePayload
): Promise<UpdateOwnProfileResponse> => {
  const response = await requestJson<UpdateOwnProfileResponse>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({
      fullName: payload.fullName,
      displayName: payload.displayName,
      phoneNumber: payload.phoneNumber,
      departmentOrBarangay: payload.departmentOrBarangay,
      rankOrTitle: payload.rankOrTitle,
      bloodType: payload.bloodType,
      allergies: payload.allergies,
      medicalConditions: payload.medicalConditions,
      isOrganDonor: payload.isOrganDonor,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone,
      emergencyContactRelationship: payload.emergencyContactRelationship,
      secondaryContactName: payload.secondaryContactName,
      secondaryContactPhone: payload.secondaryContactPhone,
      avatarDataUrl: payload.avatarDataUrl
    })
  });

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
        ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
        ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
        ...(payload.phoneNumber !== undefined ? { phoneNumber: payload.phoneNumber } : {}),
        ...(payload.departmentOrBarangay !== undefined
          ? { departmentOrBarangay: payload.departmentOrBarangay }
          : {}),
        ...(payload.rankOrTitle !== undefined ? { rankOrTitle: payload.rankOrTitle } : {}),
        ...(payload.bloodType !== undefined ? { bloodType: payload.bloodType } : {}),
        ...(payload.allergies !== undefined ? { allergies: payload.allergies } : {}),
        ...(payload.medicalConditions !== undefined
          ? { medicalConditions: payload.medicalConditions }
          : {}),
        ...(payload.isOrganDonor !== undefined ? { isOrganDonor: payload.isOrganDonor } : {}),
        ...(payload.emergencyContactName !== undefined
          ? { emergencyContactName: payload.emergencyContactName }
          : {}),
        ...(payload.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: payload.emergencyContactPhone }
          : {}),
        ...(payload.emergencyContactRelationship !== undefined
          ? { emergencyContactRelationship: payload.emergencyContactRelationship }
          : {}),
        ...(payload.secondaryContactName !== undefined
          ? { secondaryContactName: payload.secondaryContactName }
          : {}),
        ...(payload.secondaryContactPhone !== undefined
          ? { secondaryContactPhone: payload.secondaryContactPhone }
          : {}),
        ...(payload.avatarDataUrl !== undefined ? { avatarDataUrl: payload.avatarDataUrl } : {}),
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
