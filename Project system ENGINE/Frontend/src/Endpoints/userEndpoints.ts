// [Layer: Endpoints]
// Responsibility: User governance, account provisioning, profile modification, and status transition API stubs using arrow lambdas (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

import { requestJson } from './apiClient';
import type { UserRole, ResponderUnit, AccountStatus } from './authEndpoints';

export type { UserRole, ResponderUnit, AccountStatus };

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  employeeOrResidentId: string;
  role: UserRole;
  unit: ResponderUnit;
  status: AccountStatus;
  faceVerified: boolean;
  hasIdCapture: boolean;
  hasFaceCapture: boolean;
  departmentOrBarangay: string;
  rankOrTitle: string;
  createdAt: string;
  fullAddress?: string;
  phoneNumber?: string;
}

export interface UserDetail extends UserSummary {
  firstName: string;
  middleName?: string;
  surname: string;
  suffix?: string;
  dateOfBirth?: string;
  sex?: string;
  bloodType?: string;
  province: string;
  cityOrMunicipality: string;
  barangay: string;
  streetOrPurok: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  validIdType?: string;
  idCapturePath?: string;
  faceCapturePath?: string;
  governmentIdType?: string;
  governmentIdNumber?: string;
  residencyCategory?: string;
  vulnerabilityFlags?: string;
  medicalLicenseNumber?: string;
  medicalCadre?: string;
  stationHealthCenter?: string;
  medicalCertifications?: string;
  ambulanceCallSign?: string;
  firefighterRank?: string;
  bfpBadgeNumber?: string;
  fireStation?: string;
  fireSpecialization?: string;
  apparatusCallSign?: string;
  policeRank?: string;
  pnpBadgeNumber?: string;
  precinctOrStation?: string;
  policeAssignment?: string;
  sidearmSerial?: string;
  plantillaNumber?: string;
  executiveDesignation?: string;
  clearanceLevel?: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  middleName?: string | null;
  surname: string;
  suffix?: string | null;
  dateOfBirth?: string | null;
  sex?: string;
  bloodType?: string;
  phoneNumber?: string | null;
  province?: string;
  cityOrMunicipality?: string;
  barangay?: string;
  streetOrPurok?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  role: UserRole;
  unit: ResponderUnit;
  departmentOrBarangay?: string;
  rankOrTitle?: string | null;
  employeeOrResidentId?: string | null;
  governmentIdType?: string;
  governmentIdNumber?: string | null;
  residencyCategory?: string;
  vulnerabilityFlags?: string;
  medicalLicenseNumber?: string | null;
  medicalCadre?: string;
  stationHealthCenter?: string | null;
  medicalCertifications?: string | null;
  ambulanceCallSign?: string | null;
  firefighterRank?: string;
  bfpBadgeNumber?: string | null;
  fireStation?: string | null;
  fireSpecialization?: string | null;
  apparatusCallSign?: string | null;
  policeRank?: string;
  pnpBadgeNumber?: string | null;
  precinctOrStation?: string | null;
  policeAssignment?: string | null;
  sidearmSerial?: string | null;
  plantillaNumber?: string | null;
  executiveDesignation?: string | null;
  clearanceLevel?: string;
}

export interface UpdateUserPayload {
  firstName: string;
  middleName?: string | null;
  surname: string;
  suffix?: string | null;
  dateOfBirth?: string | null;
  sex?: string;
  bloodType?: string;
  phoneNumber?: string | null;
  province?: string;
  cityOrMunicipality?: string;
  barangay?: string;
  streetOrPurok?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  role: UserRole;
  unit: ResponderUnit;
  status: AccountStatus;
  departmentOrBarangay?: string;
  rankOrTitle?: string | null;
  employeeOrResidentId?: string | null;
  governmentIdType?: string;
  governmentIdNumber?: string | null;
  residencyCategory?: string;
  vulnerabilityFlags?: string;
  medicalLicenseNumber?: string | null;
  medicalCadre?: string;
  stationHealthCenter?: string | null;
  medicalCertifications?: string | null;
  ambulanceCallSign?: string | null;
  firefighterRank?: string;
  bfpBadgeNumber?: string | null;
  fireStation?: string | null;
  fireSpecialization?: string | null;
  apparatusCallSign?: string | null;
  policeRank?: string;
  pnpBadgeNumber?: string | null;
  precinctOrStation?: string | null;
  policeAssignment?: string | null;
  sidearmSerial?: string | null;
  plantillaNumber?: string | null;
  executiveDesignation?: string | null;
  clearanceLevel?: string;
}

export interface PagedUserParams {
  query?: string;
  role?: string;
  unit?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getUsers = (): Promise<UserSummary[]> =>
  requestJson<UserSummary[]>('/api/users', { method: 'GET' });

export const getPagedUsers = (params: PagedUserParams = {}): Promise<PagedResult<UserSummary>> => {
  const queryParams = new URLSearchParams();
  if (params.query) queryParams.set('query', params.query);
  if (params.role && params.role !== 'ALL') queryParams.set('role', params.role);
  if (params.unit && params.unit !== 'ALL') queryParams.set('unit', params.unit);
  if (params.status && params.status !== 'ALL') queryParams.set('status', params.status);
  if (params.page !== undefined) queryParams.set('page', String(params.page));
  if (params.pageSize !== undefined) queryParams.set('pageSize', String(params.pageSize));

  const qs = queryParams.toString();
  return requestJson<PagedResult<UserSummary>>(`/api/users/paged${qs ? `?${qs}` : ''}`, { method: 'GET' });
};

export const getUserDetail = (userId: string): Promise<UserDetail> =>
  requestJson<UserDetail>(`/api/users/${userId}`, { method: 'GET' });

export const createUser = (payload: CreateUserPayload): Promise<UserSummary> =>
  requestJson<UserSummary>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const updateUser = (userId: string, payload: UpdateUserPayload): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

export const deleteUser = (userId: string): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/users/${userId}`, {
    method: 'DELETE'
  });

export const updateUserStatus = (userId: string, status: AccountStatus): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/users/${userId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });
