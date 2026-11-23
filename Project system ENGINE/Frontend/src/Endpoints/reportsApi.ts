// [Layer: Endpoints]
// Responsibility: Incident reporting, evidence media, feedback, and alert endpoint stubs using universal arrow lambda syntax (=>).
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.

import { requestJson } from './apiClient';

export type IncidentPointerIconType = 'car-crash' | 'fire' | 'medical' | 'crime';

export interface TaggedColleagueItem {
  userId: string;
  fullName: string;
  unit: string;
  rankOrTitle: string;
}

export interface IncidentImageAiAnalysisRequest {
  imageDataUrl: string;
  titleHint?: string;
  noteHint?: string;
  categoryHint?: string;
}

export interface IncidentImageAiAnalysisResponse {
  roboflowModelId: string;
  roboflowPrediction: string;
  roboflowConfidence: number;
  roboflowNeedsReview: boolean;
  roboflowAuthTransport: string;
  claudeModelUsed: string;
  isGenuineIncident: boolean;
  autoApproveEligible?: boolean;
  aiVerificationStatus?: string | null;
  detectedCategory: string;
  recommendedSeverity: string;
  pointerIconType: IncidentPointerIconType;
  situationDescription: string;
  visibleHazards: string;
  uncertaintyNotes: string;
  verificationStatus: string;
  recommendedAgencyUnit: string;
}

export type IncidentImageAiAnalysisResult = IncidentImageAiAnalysisResponse;

export interface CreateReportPayload {
  title: string;
  note?: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  locationLabel?: string;
  imageDataUrl?: string;
  gpsAccuracyMeters?: number;
  isHardwareGeolocated?: boolean;
  isBlurry?: boolean;
  requiresManualVerification?: boolean;
  reporterContactNumber?: string;
  roboflowModelId?: string | null;
  roboflowPrediction?: string | null;
  roboflowConfidence?: number | null;
  roboflowNeedsReview?: boolean;
  claudeModelUsed?: string | null;
  claudeIncidentCategory?: string | null;
  claudeSituationSummary?: string | null;
  claudeVisibleHazards?: string | null;
  claudeUncertaintyNotes?: string | null;
  pointerIconType?: string | null;
  taggedColleagueIds?: string[];
}

export interface IncidentEvidenceItem {
  id?: string;
  url: string;
  caption?: string;
  timestamp?: string;
  type?: string;
}

export interface ReportEvidenceRecordDto {
  id: string;
  reportId: string;
  filePath?: string;
  url?: string;
  dataUrl?: string;
  mediaType?: string;
  caption?: string;
  uploadedByUserId?: string | null;
  uploadedByName?: string;
  createdAtUtc?: string;
  createdAt?: string;
  closureOutcome?: string;
  aiVerdict?: string;
  aiReasoning?: string;
  taggedColleagues?: TaggedColleagueItem[];
  approvedByUserId?: string | null;
  approvedAtUtc?: string | null;
}

export interface ReportFeedbackRecordDto {
  id: string;
  reportId: string;
  userId?: string;
  rating: number;
  comment: string;
  createdAtUtc?: string;
  createdAt?: string;
}

export interface ReportItem {
  id: string;
  referenceCode: string;
  reporterId: string;
  reporterName: string;
  reporterRole: string;
  title: string;
  note: string;
  category: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastBeaconAt?: string | null;
  beaconCount?: number;
  locationLabel: string;
  hasImage: boolean;
  imageUrl?: string | null;
  allocatedUnitId?: string | null;
  allocatedUnitCode?: string | null;
  createdAt: string;
  verifiedAt?: string | null;
  resolvedAt?: string | null;
  gpsAccuracyMeters?: number | null;
  isHardwareGeolocated: boolean;
  isBlurry: boolean;
  requiresManualVerification: boolean;
  recommendedAgencyUnit?: string | null;
  evidences?: IncidentEvidenceItem[];
  evidencePhotos?: string[];
  pcrRecords?: unknown[];
  casualties?: unknown[];
  isVerified?: boolean;
  adminAiVerified?: boolean;
  submittedAt?: string;
  submittedIpAddress?: string | null;
  reporterContactNumber?: string | null;
  roboflowModelId?: string | null;
  roboflowPrediction?: string | null;
  roboflowConfidence?: number | null;
  roboflowNeedsReview?: boolean;
  claudeModelUsed?: string | null;
  claudeIncidentCategory?: string | null;
  claudeSituationSummary?: string | null;
  claudeVisibleHazards?: string | null;
  claudeUncertaintyNotes?: string | null;
  pointerIconType?: string | null;
  aiAutoApproved?: boolean;
  aiVerificationStatus?: string | null;
  closedAt?: string | null;
  closureSummary?: string | null;
  closureApprovalMode?: string | null;
  taggedColleagues?: TaggedColleagueItem[];
}

export interface SubmitClosureEvidencePayload {
  imageDataUrl: string;
  notes?: string;
  requestedOutcome?: 'InProgress' | 'Resolved' | 'Auto';
  taggedColleagueIds?: string[];
  triggerAiAutoApprove?: boolean;
}

export interface ClosureEvidenceSubmissionResult {
  success: boolean;
  message: string;
  verdict: string;
  autoApproved: boolean;
  approvalMode: string;
  reportStatus: string;
  aiReasoning: string;
  modelUsed: string;
  report: ReportItem;
  evidence: ReportEvidenceRecordDto;
}

export interface ApproveClosurePayload {
  useAi?: boolean;
  targetStatus?: 'Resolved' | 'Closed' | 'InProgress';
  adminNote?: string;
}

export interface AiAutoApproveReportResponse {
  autoApproved: boolean;
  status: string;
  aiVerificationStatus: string;
  message: string;
  report?: ReportItem;
}

export interface AlertItem {
  reportId: string;
  referenceCode: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  timestamp: string;
  isRead: boolean;
  hasImage: boolean;
  imageUrl?: string | null;
}

export interface EmergencyBroadcastPayload {
  title: string;
  message: string;
  severity: string;
  externalLink?: string;
  hasImage?: boolean;
  hasVideo?: boolean;
  imageDataUrl?: string;
}

export const analyzeIncidentImage = (
  payload: IncidentImageAiAnalysisRequest
): Promise<IncidentImageAiAnalysisResponse> =>
  requestJson<IncidentImageAiAnalysisResponse>('/api/reports/analyze-image', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const createReport = (
  payload: CreateReportPayload
): Promise<{ message: string; report: ReportItem; event: string }> =>
  requestJson<{ message: string; report: ReportItem; event: string }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const getAllReports = (): Promise<ReportItem[]> =>
  requestJson<ReportItem[]>('/api/reports', { method: 'GET' });

export const getMyReports = (): Promise<ReportItem[]> =>
  requestJson<ReportItem[]>('/api/reports/mine', { method: 'GET' });

export const getAgencyReports = (agency: string): Promise<ReportItem[]> =>
  requestJson<ReportItem[]>(`/api/reports/agency/${agency}`, { method: 'GET' });

export const getReportEvidences = (reportId: string): Promise<ReportEvidenceRecordDto[]> =>
  requestJson<ReportEvidenceRecordDto[]>(`/api/reports/${encodeURIComponent(reportId)}/evidences`, {
    method: 'GET'
  });

export const uploadReportEvidence = (
  reportId: string,
  dataUrl: string,
  caption?: string
): Promise<{ message?: string; data?: ReportEvidenceRecordDto } & Partial<ReportEvidenceRecordDto>> =>
  requestJson<{ message?: string; data?: ReportEvidenceRecordDto } & Partial<ReportEvidenceRecordDto>>(
    `/api/reports/${encodeURIComponent(reportId)}/evidences`,
    {
      method: 'POST',
      body: JSON.stringify({
        dataUrl,
        imageDataUrl: dataUrl,
        caption: caption || '',
        mediaType: 'image'
      })
    }
  );

export const submitClosureEvidence = (
  reportId: string,
  payload: SubmitClosureEvidencePayload
): Promise<ClosureEvidenceSubmissionResult> =>
  requestJson<ClosureEvidenceSubmissionResult>(
    `/api/reports/${encodeURIComponent(reportId)}/submit-closure-evidence`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );

export const approveReportClosure = (
  reportId: string,
  payload: ApproveClosurePayload
): Promise<ClosureEvidenceSubmissionResult> =>
  requestJson<ClosureEvidenceSubmissionResult>(
    `/api/reports/${encodeURIComponent(reportId)}/approve-closure`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );

export const submitReportFeedback = (
  reportId: string,
  rating: number,
  comment: string
): Promise<{ message?: string; data?: ReportFeedbackRecordDto } & Partial<ReportFeedbackRecordDto>> =>
  requestJson<{ message?: string; data?: ReportFeedbackRecordDto } & Partial<ReportFeedbackRecordDto>>(
    `/api/reports/${encodeURIComponent(reportId)}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify({ rating, comment })
    }
  );

export const getAlerts = (): Promise<AlertItem[]> =>
  requestJson<AlertItem[]>('/api/alerts', { method: 'GET' });

export const markAlertRead = (reportId: string): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/alerts/${encodeURIComponent(reportId)}/read`, { method: 'POST' });

export const markAllAlertsRead = (): Promise<{ message: string }> =>
  requestJson<{ message: string }>('/api/alerts/mark-all-read', { method: 'POST' });

export const verifyReport = (
  reportId: string,
  status: string,
  note?: string,
  severity?: string
): Promise<{ message: string }> =>
  requestJson<{ message: string }>(`/api/reports/${reportId}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      status,
      adminNote: note,
      severity
    })
  });

export const autoApproveReportWithAi = (id: string): Promise<AiAutoApproveReportResponse> =>
  requestJson<AiAutoApproveReportResponse>(`/api/reports/${encodeURIComponent(id)}/ai-auto-approve`, {
    method: 'POST'
  });

export const updateReportSeverity = async (
  reportId: string,
  severity: string
): Promise<{ message: string }> => {
  try {
    return await requestJson<{ message: string }>(`/api/reports/${reportId}/severity`, {
      method: 'PUT',
      body: JSON.stringify({ severity })
    });
  } catch {
    return await requestJson<{ message: string }>(`/api/reports/${reportId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ severity })
    });
  }
};

export const assignUnitToReport = async (
  reportId: string,
  unitId: string
): Promise<{ message: string; reportId: string; unitId: string }> => {
  try {
    const res = await requestJson<{ message: string }>(`/api/reports/${reportId}/allocate`, {
      method: 'POST',
      body: JSON.stringify({ unitId })
    });
    return { ...res, reportId, unitId };
  } catch {
    const fallbackRes = await requestJson<{ message: string }>(`/api/reports/${reportId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ unitId, responderId: unitId })
    });
    return { ...fallbackRes, reportId, unitId };
  }
};

export const assignResponderToReport = (
  reportId: string,
  responderId: string
): Promise<{ message: string; reportId: string; responderId: string }> =>
  assignUnitToReport(reportId, responderId).then((res) => ({
    message: res.message,
    reportId: res.reportId,
    responderId: res.unitId
  }));

export const sendEmergencyBroadcast = (
  payload: EmergencyBroadcastPayload
): Promise<{ message: string; alertId: string }> =>
  requestJson<{ message: string; alertId: string }>('/api/alerts/broadcast', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
