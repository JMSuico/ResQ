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
  displayName?: string;
  email: string;
  employeeOrResidentId: string;
  role: UserRole;
  unit: ResponderUnit;
  status: AccountStatus;
  faceVerified: boolean;
  identityVerificationStatus?: string;
  facialVerificationStatus?: string;
  departmentOrBarangay?: string;
  rankOrTitle?: string;
  targetDashboardUrl: string;
}

export interface RegisterPayload {
  email: string;
  displayName?: string;
  password: string;
  confirmPassword?: string;
  fullName: string;
  firstName?: string;
  middleName?: string;
  surname?: string;
  suffix?: string;
  dateOfBirth?: string;
  sex?: string;
  age?: number | string;
  province?: string;
  cityOrMunicipality?: string;
  barangay?: string;
  streetOrPurok?: string;
  weight?: string;
  height?: string;
  phoneNumber?: string;
  employeeOrResidentId?: string;
  validIdType?: string;
  governmentIdType?: string;
  governmentIdNumber?: string;
  role: UserRole;
  unit: ResponderUnit;
  departmentOrBarangay?: string;
  rankOrTitle?: string;
  idCaptureDataUrl?: string;
  idBackCaptureDataUrl?: string;
  faceCaptureDataUrl?: string;
  consentAccepted?: boolean;
  consentNoticeVersion?: string;
  minImageDimension?: number;
  biometricDescriptorVector?: number[];
  ocrConfidenceScore?: number;
  documentVersion?: string;
  issuingAgency?: string;
  detectedSide?: string;
  documentCheckStatus?: string;
  officialVerificationStatus?: string;
  fieldProvenanceJson?: string;
}

export interface IdentityDocumentAnalysisRequest {
  selectedIdCategory?: string;
  manualTemplateOverride?: string;
  frontRawText?: string;
  backRawText?: string;
  frontImageDataUrl?: string;
  backImageDataUrl?: string;
  extractedFields?: Record<string, string | undefined>;
}

export interface IdentityDocumentAnalysisResponse {
  documentFamily: string;
  categoryKey: string;
  issuer: string;
  version: string;
  detectedSide: string;
  templateId: string;
  calibratedConfidence: number;
  overallStatus: 'READY_FOR_PREFILL' | 'OCR_NEEDS_REVIEW' | 'UNSUPPORTED_DOCUMENT';
  officialVerificationStatus: 'not_checked' | 'verified' | 'failed';
  allowBiometricProfiling: boolean;
  warnings: string[];
  normalizedFields: Record<string, string>;
}

export interface RegisterResponse {
  message: string;
  userId?: string;
  email?: string;
  displayName?: string;
  fullName?: string;
  role?: UserRole;
  unit?: ResponderUnit;
  status: string;
  faceVerified: boolean;
  identityVerificationStatus?: string;
  facialVerificationStatus?: string;
  identityVerificationProvider?: string;
  facialVerificationProvider?: string;
  hasIdFrontCapture?: boolean;
  hasIdBackCapture?: boolean;
  hasFaceCapture?: boolean;
  createdAt?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  selectedTabRole?: string;
  portalOrigin?: string;
}

export interface BiometricLoginPayload {
  email: string;
  liveDescriptorVector: number[];
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

export const analyzeIdentityDocument = (
  payload: IdentityDocumentAnalysisRequest
): Promise<IdentityDocumentAnalysisResponse> =>
  requestJson<IdentityDocumentAnalysisResponse>('/api/identity-documents/analyze', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const loginUser = (payload: LoginPayload): Promise<LoginResponse> =>
  requestJson<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const biometricLoginUser = (payload: BiometricLoginPayload): Promise<LoginResponse> =>
  requestJson<LoginResponse>('/api/biometric-login', {
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
      try {
        sessionStorage.removeItem('resqtrack_token');
        sessionStorage.removeItem('resqtrack_session');
        sessionStorage.removeItem('resqtrack_user');
        const port = window.location.port;
        if (port) {
          localStorage.removeItem(`resqtrack_token_${port}`);
          localStorage.removeItem(`resqtrack_session_${port}`);
          localStorage.removeItem(`resqtrack_user_${port}`);
        }
        localStorage.removeItem('resqtrack_token');
        localStorage.removeItem('resqtrack_session');
        localStorage.removeItem('resqtrack_user');
      } catch {
        // Storage cleanup safeguard
      }
    }
  }
};
