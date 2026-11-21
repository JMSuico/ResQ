// [Layer: UserRoles/Features/Pages/AdminsPanel]
// SubmittedReportsPage.tsx -- LDRRMO Admin Submitted Reports Command Center.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Instructor #4 & #7: Renders full status badges (Submitted, Pending, Verified, Dispatched, Resolved, Rejected)
// and clear Verify / Reject actions for Submitted / Pending uploads, plus 5-minute auto-close timer.
// REMOVING #11: Zero Dipolog/San Mateo references and zero external Unsplash URLs; Katipunan, ZN (7109) coordinates only.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useState, useEffect, FC, useMemo, useCallback } from 'react';
import {
  FileCheck,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Check,
  X,
  HeartPulse,
  MapPin,
  RefreshCw,
  Activity,
  Camera,
  XCircle,
  Sparkles,
  Loader2
} from 'lucide-react';
import { getAllReports, verifyReport, autoApproveReportWithAi, ReportItem } from '@/Endpoints/reportsApi';
import { getPcrRecords, PatientCareRecord } from '@/Endpoints/responderOpsApi';
import { requestJson } from '@/Endpoints/apiClient';
import {
  SearchBar,
  Dropdown,
  TableCardToggle,
  ViewMode,
  ImageLightboxModal,
  LightboxMediaItem
} from '@/Shared';
import { usePagination, useDebounce, useValueRefreshAuto } from '@/Hooks';
import { formatDateTimeWithSecondsAmPm } from '@/Shared/radarPointerCategories';
import { KATIPUNAN_BASE_COORDS, getKatipunanBarangay } from '@/Libs/Map/mapAccuracy';
import { AdminButton } from './Shared/AdminButton';
import { AdminModalCard } from './Shared/AdminModalCard';
import {
  CLAY_SURFACE,
  CLAY_WELL,
  formatIncidentStatusBadge
} from './Shared/adminCommandHelpers';

export interface PcrCasualtyItem {
  id: string;
  patientName: string;
  age: number;
  gender: string;
  levelOfConsciousness: string;
  bpSystolic: number;
  bpDiastolic: number;
  heartRate: number;
  respiratoryRate: number;
  spO2: number;
  glucose: number;
  temp: number;
  receivingHospital: string;
  chiefComplaint: string;
  narrative: string;
  interventions: string[];
  recordedAt: string;
}

interface ReportEvidenceApiItem {
  id?: string;
  url?: string;
  mediaUrl?: string;
  caption?: string;
  timestamp?: string;
  createdAtUtc?: string;
}

const mapPcrToCasualty = (p: PatientCareRecord): PcrCasualtyItem => ({
  id: p.id,
  patientName: p.patientName || 'Unidentified Patient',
  age: p.age ?? 0,
  gender: p.gender || 'Unspecified',
  levelOfConsciousness: p.levelOfConsciousness || 'Alert',
  bpSystolic: p.bloodPressureSystolic ?? 0,
  bpDiastolic: p.bloodPressureDiastolic ?? 0,
  heartRate: p.heartRateBpm ?? 0,
  respiratoryRate: p.respiratoryRate ?? 0,
  spO2: p.spO2Percent ?? 0,
  glucose: p.bloodGlucoseMgDl ?? 0,
  temp: p.temperatureCelsius ?? 0,
  receivingHospital: p.unitCode || 'Katipunan Rural Health Unit (RHU)',
  chiefComplaint: p.chiefComplaint || '',
  narrative: p.narrative || '',
  interventions: Array.isArray(p.interventions) ? p.interventions : [],
  recordedAt: p.createdAt || ''
});

export interface SubmittedReportRecord {
  id: string;
  referenceCode: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  ipAddress: string;
  responderName: string;
  responderUnit: string;
  submittedAt: string;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy?: string;
  isClosed: boolean;
  closedAt: string | null;
  isRejected?: boolean;
  allocatedUnitCode?: string | null;
  evidencePhotos: Array<{ url: string; timestamp?: string; caption?: string }>;
  casualties: PcrCasualtyItem[];
  notes?: string;
  roboflowModelId?: string | null;
  roboflowPrediction?: string | null;
  roboflowConfidence?: number | null;
  roboflowNeedsReview?: boolean;
  claudeModelUsed?: string | null;
  claudeSituationSummary?: string | null;
  claudeVisibleHazards?: string | null;
  pointerIconType?: string | null;
  aiAutoApproved?: boolean;
  aiVerificationStatus?: string | null;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const SubmittedReportsPage: FC = () => {
  const [reports, setReports] = useState<SubmittedReportRecord[]>([]);
  const [dossierPcrByReportId, setDossierPcrByReportId] = useState<Record<string, PcrCasualtyItem[]>>({});
  const [dossierEvidencesByReportId, setDossierEvidencesByReportId] = useState<
    Record<string, Array<{ url: string; timestamp?: string; caption?: string }>>
  >({});
  const [isLoadingDossier, setIsLoadingDossier] = useState<boolean>(false);
  const [searchRaw, setSearchRaw] = useState<string>('');
  const debouncedSearch = useDebounce(searchRaw, 250);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<LightboxMediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [aiProcessingId, setAiProcessingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSubmittedReports = useCallback(async (): Promise<void> => {
    try {
      const backendReports = await getAllReports();
      if (!Array.isArray(backendReports)) {
        setReports([]);
        return;
      }

      const mapped: SubmittedReportRecord[] = backendReports
        .filter((rep): rep is ReportItem => Boolean(rep && rep.id))
        .map((rep) => {
          const s = (rep.status || 'Reported').toLowerCase();
          const isRejected = s === 'rejected';
          const isVerified = !isRejected && (Boolean(rep.verifiedAt) || s === 'verified' || s === 'responded');
          const isClosed = s === 'resolved' || s === 'completed' || s === 'closed';
          const safePhoto = rep.hasImage ? (rep.imageUrl || `/api/reports/${rep.id}/image`) : null;
          const refCode = rep.referenceCode || `RESQ-${rep.id.slice(0, 8).toUpperCase()}`;

          return {
            id: rep.id,
            referenceCode: refCode,
            title: rep.title || 'Field Incident Report',
            category: rep.category || 'General',
            severity: rep.severity || 'Medium',
            status: rep.status || 'Submitted',
            locationLabel:
              rep.locationLabel ||
              getKatipunanBarangay(rep.latitude ?? KATIPUNAN_BASE_COORDS.latitude, rep.longitude ?? KATIPUNAN_BASE_COORDS.longitude),
            latitude: rep.latitude ?? KATIPUNAN_BASE_COORDS.latitude,
            longitude: rep.longitude ?? KATIPUNAN_BASE_COORDS.longitude,
            ipAddress: rep.submittedIpAddress || 'Unavailable',
            responderName: rep.reporterName || 'Unknown Reporter',
            responderUnit: rep.allocatedUnitCode || rep.recommendedAgencyUnit || 'UNASSIGNED',
            submittedAt: rep.createdAt || new Date().toISOString(),
            isVerified,
            verifiedAt: rep.verifiedAt || null,
            verifiedBy: isVerified ? 'LDRRMO Admin Command' : undefined,
            isClosed,
            closedAt: rep.resolvedAt || null,
            isRejected,
            allocatedUnitCode: rep.allocatedUnitCode,
            evidencePhotos: safePhoto ? [{ url: safePhoto, timestamp: rep.createdAt, caption: 'Attached Evidence' }] : [],
            casualties: [],
            notes: rep.note || '',
            roboflowModelId: rep.roboflowModelId,
            roboflowPrediction: rep.roboflowPrediction,
            roboflowConfidence: rep.roboflowConfidence,
            roboflowNeedsReview: rep.roboflowNeedsReview,
            claudeModelUsed: rep.claudeModelUsed,
            claudeSituationSummary: rep.claudeSituationSummary,
            claudeVisibleHazards: rep.claudeVisibleHazards,
            pointerIconType: rep.pointerIconType,
            aiAutoApproved: Boolean(rep.aiAutoApproved),
            aiVerificationStatus: rep.aiVerificationStatus ?? null
          };
        });

      setReports(mapped);
    } catch (err) {
      console.error('[SubmittedReportsPage] Error loading reports:', err);
    }
  }, []);

  const openReportDossier = useCallback(async (reportId: string): Promise<void> => {
    setSelectedReportId(reportId);
    setIsDetailModalOpen(true);
    setIsLoadingDossier(true);

    try {
      const [pcrs, evidences] = await Promise.all([
        getPcrRecords(reportId).catch(() => [] as PatientCareRecord[]),
        requestJson<ReportEvidenceApiItem[]>(`/api/reports/${encodeURIComponent(reportId)}/evidences`, {
          method: 'GET'
        }).catch(() => [] as ReportEvidenceApiItem[])
      ]);

      if (Array.isArray(pcrs)) {
        setDossierPcrByReportId((prev) => ({
          ...prev,
          [reportId]: pcrs.map(mapPcrToCasualty)
        }));
      }

      if (Array.isArray(evidences)) {
        const mappedEvidences = evidences
          .map((ev, idx) => ({
            url:
              ev.url ||
              ev.mediaUrl ||
              (ev.id ? `/api/reports/${encodeURIComponent(reportId)}/evidences/${encodeURIComponent(ev.id)}` : ''),
            timestamp: ev.timestamp || ev.createdAtUtc,
            caption: ev.caption || `Attached Evidence #${idx + 1}`
          }))
          .filter((ev) => Boolean(ev.url));

        setDossierEvidencesByReportId((prev) => ({
          ...prev,
          [reportId]: mappedEvidences
        }));
      }
    } finally {
      setIsLoadingDossier(false);
    }
  }, []);

  useEffect(() => {
    void loadSubmittedReports();
  }, [loadSubmittedReports]);

  useValueRefreshAuto(loadSubmittedReports, { intervalMs: 8000 });

  const totalSubmitted = reports.length;
  const pendingReview = reports.filter((r) => {
    const b = formatIncidentStatusBadge(r.status, r.allocatedUnitCode, r.verifiedAt, r.closedAt);
    return b.label === 'Submitted' || b.label === 'Pending';
  }).length;
  const verifiedCount = reports.filter((r) => r.isVerified && !r.isClosed && !r.isRejected).length;
  const closedCount = reports.filter((r) => r.isClosed).length;

  const handleVerifyOrRejectReport = useCallback(
    async (reportId: string, nextStatus: 'Verified' | 'Rejected') => {
      const actionTimestamp = new Date().toISOString();

      try {
        await verifyReport(
          reportId,
          nextStatus,
          nextStatus === 'Rejected'
            ? 'Rejected by LDRRMO Administration.'
            : 'Verified by LDRRMO Administration.'
        );

        setReports((prev) =>
          prev.map((r) => {
            if (r.id !== reportId) return r;
            return {
              ...r,
              isVerified: nextStatus === 'Verified',
              isRejected: nextStatus === 'Rejected',
              status: nextStatus,
              verifiedAt: nextStatus === 'Verified' ? actionTimestamp : null,
              verifiedBy: 'LDRRMO Admin Command'
            };
          })
        );

        window.dispatchEvent(
          new CustomEvent('resqtrack:report', {
            detail: { id: reportId, status: nextStatus, verifiedAt: nextStatus === 'Verified' ? actionTimestamp : null }
          })
        );
        setToastMessage(
          nextStatus === 'Verified'
            ? 'Report verified. 5-Minute auto-close timer started on radar HUD.'
            : 'Report marked as Rejected.'
        );
        setTimeout(() => setToastMessage(null), 4000);
        await loadSubmittedReports();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update report verification.';
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
      }
    },
    [loadSubmittedReports]
  );

  const handleManualClose = useCallback(
    async (reportId: string) => {
      const closedTimestamp = new Date().toISOString();

      try {
        await verifyReport(reportId, 'Resolved', 'Incident closed by LDRRMO Administration.');

        setReports((prev) =>
          prev.map((r) => {
            if (r.id !== reportId) return r;
            return {
              ...r,
              isClosed: true,
              status: 'Resolved',
              closedAt: closedTimestamp
            };
          })
        );

        window.dispatchEvent(
          new CustomEvent('resqtrack:report', {
            detail: { id: reportId, status: 'Closed', isClosed: true, closedAt: closedTimestamp }
          })
        );
        setToastMessage('Incident successfully finalized and resolved.');
        setTimeout(() => setToastMessage(null), 4000);
        await loadSubmittedReports();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to close incident.';
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
      }
    },
    [loadSubmittedReports]
  );

  const handleAiAutoApprove = useCallback(
    async (reportId: string): Promise<void> => {
      setAiProcessingId(reportId);
      const actionTimestamp = new Date().toISOString();
      try {
        const res = await autoApproveReportWithAi(reportId);
        const approved = Boolean(res.autoApproved || (res.status || '').toLowerCase() === 'verified');
        const nextStatus = approved ? 'Verified' : (res.status || 'Pending');
        const nextAiStatus = res.aiVerificationStatus || (approved ? 'AUTO_APPROVED' : 'MANUAL_REVIEW');

        setReports((prev) =>
          prev.map((r) => {
            if (r.id !== reportId) return r;
            return {
              ...r,
              isVerified: approved ? true : r.isVerified,
              status: nextStatus,
              verifiedAt: approved ? (res.report?.verifiedAt || actionTimestamp) : r.verifiedAt,
              verifiedBy: approved ? 'AI Auto-Approve (Roboflow + Claude 4.5)' : r.verifiedBy,
              aiAutoApproved: approved,
              aiVerificationStatus: nextAiStatus,
              roboflowPrediction: res.report?.roboflowPrediction ?? r.roboflowPrediction,
              roboflowConfidence: res.report?.roboflowConfidence ?? r.roboflowConfidence,
              claudeSituationSummary: res.report?.claudeSituationSummary ?? r.claudeSituationSummary,
              claudeVisibleHazards: res.report?.claudeVisibleHazards ?? r.claudeVisibleHazards
            };
          })
        );

        window.dispatchEvent(
          new CustomEvent('resqtrack:report', {
            detail: { id: reportId, status: nextStatus, aiAutoApproved: approved, aiVerificationStatus: nextAiStatus }
          })
        );
        setToastMessage(
          res.message ||
            (approved
              ? 'AI Auto-Approved photo report. 5-Minute auto-close timer started.'
              : 'AI flagged report for manual review.')
        );
        await loadSubmittedReports();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'AI Auto-Approve request failed.';
        setToastMessage(msg);
      } finally {
        setAiProcessingId(null);
        setTimeout(() => setToastMessage(null), 4000);
      }
    },
    [loadSubmittedReports]
  );

  const renderAiStatusPill = (r: SubmittedReportRecord) => {
    if (aiProcessingId === r.id) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#670626] text-[#F7F1EA] animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          AI Processing...
        </span>
      );
    }
    if (r.aiAutoApproved || r.aiVerificationStatus === 'AUTO_APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-700/30">
          <Sparkles className="w-3 h-3" />
          AI Auto-Approved
        </span>
      );
    }
    if (r.aiVerificationStatus === 'MANUAL_REVIEW' || r.roboflowNeedsReview) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-700/30">
          Manual Review
        </span>
      );
    }
    if (r.roboflowPrediction || r.claudeSituationSummary) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#E9D9D0] text-[#670626] border border-[#670626]/20">
          <Sparkles className="w-3 h-3" />
          AI Screened
        </span>
      );
    }
    return null;
  };

  const filteredReports = useMemo(() => {
    let result = [...reports];

    if (statusFilter !== 'ALL') {
      result = result.filter((r) => {
        const b = formatIncidentStatusBadge(r.status, r.allocatedUnitCode, r.verifiedAt, r.closedAt);
        return b.label.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (r) =>
          String(r.title ?? '').toLowerCase().includes(query) ||
          String(r.referenceCode ?? '').toLowerCase().includes(query) ||
          String(r.responderName ?? '').toLowerCase().includes(query) ||
          String(r.responderUnit ?? '').toLowerCase().includes(query) ||
          String(r.locationLabel ?? '').toLowerCase().includes(query) ||
          String(r.category ?? '').toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
      if (sortOrder === 'oldest') {
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      }
      if (sortOrder === 'responder_az') {
        return a.responderName.localeCompare(b.responderName);
      }
      if (sortOrder === 'responder_za') {
        return b.responderName.localeCompare(a.responderName);
      }
      if (sortOrder === 'severity') {
        const weight = (s: string) => (s === 'Critical' ? 4 : s === 'High' ? 3 : s === 'Medium' ? 2 : 1);
        return weight(b.severity) - weight(a.severity);
      }
      return 0;
    });

    return result;
  }, [reports, statusFilter, debouncedSearch, sortOrder]);

  const {
    paginatedItems,
    currentPage,
    totalPages,
    nextPage,
    prevPage
  } = usePagination(filteredReports, { initialPageSize: 10 });

  const selectedReport = useMemo(() => {
    const base = reports.find((r) => r.id === selectedReportId) || null;
    if (!base) return null;

    const dossierCasualties = dossierPcrByReportId[base.id];
    const dossierEvidences = dossierEvidencesByReportId[base.id] || [];
    const mergedEvidences = [...base.evidencePhotos];
    dossierEvidences.forEach((ev) => {
      if (!mergedEvidences.some((existing) => existing.url === ev.url)) {
        mergedEvidences.push(ev);
      }
    });

    return {
      ...base,
      casualties: dossierCasualties ?? base.casualties,
      evidencePhotos: mergedEvidences
    };
  }, [reports, selectedReportId, dossierPcrByReportId, dossierEvidencesByReportId]);

  const getRemainingSeconds = (verifiedAtStr: string | null): number => {
    if (!verifiedAtStr) return 0;
    const verifiedMs = new Date(verifiedAtStr).getTime();
    if (isNaN(verifiedMs)) return 0;
    const elapsed = currentTime - verifiedMs;
    const remaining = Math.max(0, FIVE_MINUTES_MS - elapsed);
    return Math.floor(remaining / 1000);
  };

  useEffect(() => {
    reports.forEach((r) => {
      if (r.isVerified && !r.isClosed && !r.isRejected && r.verifiedAt) {
        const rem = getRemainingSeconds(r.verifiedAt);
        if (rem <= 0) {
          void handleManualClose(r.id);
        }
      }
    });
  }, [currentTime, reports, handleManualClose]);

  const openLightbox = (images: Array<{ url: string; timestamp?: string; caption?: string }>, idx: number) => {
    setLightboxImages(images.map((img) => ({ url: img.url, timestamp: img.timestamp, caption: img.caption })));
    setLightboxIndex(idx);
    setLightboxImageUrl(images[idx]?.url || null);
    setIsLightboxOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Page Header (.clay-surface #F7F1EA) */}
      <div className={`${CLAY_SURFACE} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#A83B4D]">
            LDRRMO Command / Submitted Reports
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#670626] tracking-tight mt-0.5 flex items-center gap-2.5">
            <FileCheck className="w-6 h-6 text-[#A83B4D]" />
            Submitted Reports
          </h1>
          <p className="text-sm text-[#A83B4D] font-mono mt-0.5">
            Upload verification &amp; PCR dossiers
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => void loadSubmittedReports()}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            SYNC
          </AdminButton>
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {toastMessage && (
        <div className={`${CLAY_SURFACE} p-3.5 text-sm font-mono font-bold flex items-center justify-between border-2 border-[#670626]`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#670626]" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-[#670626] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Telemetry KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#670626] flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Total Reports</p>
            <FileText className="w-4 h-4 text-[#670626]" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{totalSubmitted}</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">All submitted</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-amber-600 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Submitted / Pending</p>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{pendingReview}</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">Awaiting review</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#A83B4D] flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Verified</p>
            <Activity className="w-4 h-4 text-[#A83B4D]" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{verifiedCount}</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">5m auto-close</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-emerald-700 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Resolved</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{closedCount}</h3>
          <span className="text-xs text-emerald-800 font-mono font-bold mt-0.5">Closed cases</span>
        </div>
      </div>

      {/* Filter Tabs + SearchBar + Sorter */}
      <div className={`${CLAY_SURFACE} p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'Submitted', 'Pending', 'Verified', 'Dispatched', 'Resolved', 'Rejected'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#670626] text-[#F7F1EA] shadow-sm'
                  : 'bg-[#E9D9D0] text-[#670626] hover:bg-[#E9D9D0]/80 border border-[#670626]/15'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <SearchBar
            value={searchRaw}
            onChange={setSearchRaw}
            placeholder="Search reports, responder, code..."
            className="w-full sm:w-64"
          />
          <Dropdown
            value={sortOrder}
            onChange={(v) => setSortOrder(v as string)}
            options={[
              { value: 'newest', label: 'Newest Submitted' },
              { value: 'oldest', label: 'Oldest Submitted' },
              { value: 'severity', label: 'Severity (Critical First)' },
              { value: 'responder_az', label: 'Responder (A to Z)' },
              { value: 'responder_za', label: 'Responder (Z to A)' }
            ]}
            className="min-w-[170px]"
          />
        </div>
      </div>

      {/* Main Content */}
      {paginatedItems.length === 0 ? (
        <div className={`${CLAY_SURFACE} p-12 text-center`}>
          <FileCheck className="w-10 h-10 text-[#A83B4D] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#670626]">No Submitted Reports</h3>
          <p className="text-xs text-[#A83B4D] font-mono mt-1">
            Submitted dossiers appear here.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className={`${CLAY_SURFACE} p-4`}>
          <div className={`${CLAY_WELL} overflow-x-auto`}>
            <table className="w-full text-left text-sm text-[#670626]">
              <thead className="bg-[#670626]/10 text-xs uppercase font-mono text-[#670626] tracking-wider border-b border-[#670626]/15">
                <tr>
                  <th className="py-3.5 px-4">Ref Code & Incident</th>
                  <th className="py-3.5 px-4">Responding Unit / Reporter</th>
                  <th className="py-3.5 px-4">Casualties / PCR</th>
                  <th className="py-3.5 px-4">Evidence</th>
                  <th className="py-3.5 px-4">Status & Timer</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10 font-mono">
                {paginatedItems.map((r) => {
                  const remSec = getRemainingSeconds(r.verifiedAt);
                  const mm = Math.floor(remSec / 60).toString().padStart(2, '0');
                  const ss = (remSec % 60).toString().padStart(2, '0');
                  const statusBadge = formatIncidentStatusBadge(
                    r.status,
                    r.allocatedUnitCode,
                    r.verifiedAt,
                    r.closedAt
                  );
                  const canVerifyOrReject = statusBadge.label === 'Submitted' || statusBadge.label === 'Pending';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => void openReportDossier(r.id)}
                      className="hover:bg-[#F7F1EA]/70 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#A83B4D] text-xs">{r.referenceCode}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${
                              r.severity === 'Critical'
                                ? 'bg-[#670626] text-[#F7F1EA]'
                                : r.severity === 'High'
                                ? 'bg-[#A83B4D] text-[#F7F1EA]'
                                : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/20'
                            }`}
                          >
                            {r.severity}
                          </span>
                        </div>
                        <p className="text-[#670626] text-sm font-bold font-sans mt-1">{r.title}</p>
                        <p className="text-xs text-[#A83B4D] flex items-center gap-1 mt-0.5 truncate max-w-xs">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          {r.locationLabel}
                        </p>
                        {(r.roboflowPrediction || r.claudeSituationSummary) && (
                          <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[11px] font-mono text-[#670626] max-w-xs">
                            <span className="font-black block truncate">
                              Roboflow ({r.roboflowModelId || 'accident-and-non-accident-label-image-dataset/14'}):{' '}
                              {r.roboflowPrediction || 'incident'}
                              {typeof r.roboflowConfidence === 'number'
                                ? ` ${Math.round(r.roboflowConfidence * 100)}%`
                                : ''}
                              {r.pointerIconType ? ` · [${r.pointerIconType}]` : ''}
                            </span>
                            {(r.claudeVisibleHazards || r.claudeSituationSummary) && (
                              <span className="text-[#A83B4D] block truncate">
                                Claude 4.5: {r.claudeVisibleHazards || r.claudeSituationSummary}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 font-sans">
                        <p className="text-[#670626] text-sm font-bold">{r.responderName}</p>
                        <p className="text-xs font-mono text-[#A83B4D] font-bold mt-0.5">{r.responderUnit}</p>
                        <p className="text-xs font-mono text-[#670626]/75 mt-0.5">
                          {formatDateTimeWithSecondsAmPm(r.submittedAt)}
                        </p>
                      </td>

                      <td className="py-4 px-4">
                        {r.casualties.length > 0 ? (
                          <div>
                            <span className="px-2.5 py-0.5 rounded bg-[#F7F1EA] text-[#670626] border border-[#670626]/20 font-bold text-xs">
                              {r.casualties.length} CASUALTIES
                            </span>
                            <p className="text-xs text-[#A83B4D] font-sans mt-1 truncate max-w-[160px]">
                              {r.casualties.map((c) => c.patientName).join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[#A83B4D] text-xs">0 Recorded</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        {r.evidencePhotos.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLightbox(r.evidencePhotos, 0);
                            }}
                            className="relative rounded-lg overflow-hidden border border-[#670626]/25 hover:border-[#670626] transition-all cursor-pointer"
                          >
                            <img
                              src={r.evidencePhotos[0].url}
                              alt="Evidence"
                              className="w-11 h-11 object-cover"
                            />
                          </button>
                        ) : (
                          <span className="text-[#A83B4D] text-xs">None</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <span className={`inline-block px-2.5 py-1 rounded font-bold text-xs ${statusBadge.pillClass}`}>
                            {statusBadge.label}
                          </span>
                          <div>{renderAiStatusPill(r)}</div>
                          {statusBadge.label === 'Verified' && !r.isClosed && remSec > 0 && (
                            <div className="text-xs text-[#A83B4D] font-bold">
                              Closing in {mm}:{ss}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {canVerifyOrReject && r.evidencePhotos.length > 0 && (
                            <AdminButton
                              variant="primary"
                              size="xs"
                              disabled={aiProcessingId === r.id}
                              onClick={() => void handleAiAutoApprove(r.id)}
                              icon={
                                aiProcessingId === r.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5" />
                                )
                              }
                            >
                              {aiProcessingId === r.id ? 'AI Processing Photo...' : 'AI Auto-Approve'}
                            </AdminButton>
                          )}
                          {canVerifyOrReject && (
                            <>
                              <AdminButton
                                variant="success"
                                size="xs"
                                onClick={() => void handleVerifyOrRejectReport(r.id, 'Verified')}
                                icon={<Check className="w-3.5 h-3.5" />}
                              >
                                Verify
                              </AdminButton>
                              <AdminButton
                                variant="danger"
                                size="xs"
                                onClick={() => void handleVerifyOrRejectReport(r.id, 'Rejected')}
                                icon={<XCircle className="w-3.5 h-3.5" />}
                              >
                                Reject
                              </AdminButton>
                            </>
                          )}
                          {!r.isClosed && !r.isRejected && (
                            <AdminButton
                              variant="outline"
                              size="xs"
                              onClick={() => void handleManualClose(r.id)}
                            >
                              Close
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            onClick={() => void openReportDossier(r.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((r) => {
            const remSec = getRemainingSeconds(r.verifiedAt);
            const mm = Math.floor(remSec / 60).toString().padStart(2, '0');
            const ss = (remSec % 60).toString().padStart(2, '0');
            const statusBadge = formatIncidentStatusBadge(
              r.status,
              r.allocatedUnitCode,
              r.verifiedAt,
              r.closedAt
            );
            const canVerifyOrReject = statusBadge.label === 'Submitted' || statusBadge.label === 'Pending';

            return (
              <div
                key={r.id}
                onClick={() => void openReportDossier(r.id)}
                className={`tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between gap-3.5 cursor-pointer hover:border-[#670626]/40 transition-all`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <span className="font-bold text-[#A83B4D] text-xs font-mono">{r.referenceCode}</span>
                    <div className="flex items-center gap-1.5">
                      {renderAiStatusPill(r)}
                      <span
                        className={`px-2 py-0.5 rounded text-xs uppercase font-bold font-mono ${
                          r.severity === 'Critical'
                            ? 'bg-[#670626] text-[#F7F1EA]'
                            : 'bg-[#A83B4D] text-[#F7F1EA]'
                        }`}
                      >
                        {r.severity}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-[#670626]">{r.title}</h3>

                  <p className="text-xs text-[#A83B4D] flex items-center gap-1.5 mt-1 truncate">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    {r.locationLabel}
                  </p>

                  <div className={`${CLAY_WELL} mt-3 p-3 text-xs font-mono space-y-1.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[#A83B4D]">Responder:</span>
                      <span className="font-bold text-[#670626]">{r.responderName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#A83B4D]">Unit:</span>
                      <span className="font-bold text-[#670626]">{r.responderUnit}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#A83B4D]">Casualties:</span>
                      <span className="font-bold text-[#670626]">{r.casualties.length} recorded</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#A83B4D]">Submitted:</span>
                      <span className="text-[#670626]">{formatDateTimeWithSecondsAmPm(r.submittedAt)}</span>
                    </div>
                  </div>

                  {(r.roboflowPrediction || r.claudeSituationSummary) && (
                    <div className={`${CLAY_WELL} mt-2.5 p-2.5 text-xs font-mono text-[#670626] flex flex-col gap-1`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black">
                          Roboflow ({r.roboflowModelId || 'accident-and-non-accident-label-image-dataset/14'}):{' '}
                          {r.roboflowPrediction || 'incident'}
                          {typeof r.roboflowConfidence === 'number'
                            ? ` (${Math.round(r.roboflowConfidence * 100)}%)`
                            : ''}
                        </span>
                        {r.pointerIconType && (
                          <span className="px-2 py-0.5 rounded bg-[#F7F1EA] border border-[#670626]/20 text-[#670626] font-bold uppercase">
                            {r.pointerIconType}
                          </span>
                        )}
                      </div>
                      {(r.claudeVisibleHazards || r.claudeSituationSummary) && (
                        <p className="text-[#A83B4D] font-sans text-xs line-clamp-2">
                          Claude Haiku 4.5: {r.claudeVisibleHazards || r.claudeSituationSummary}
                        </p>
                      )}
                    </div>
                  )}

                  {statusBadge.label === 'Verified' && !r.isClosed && remSec > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-xs font-mono text-[#670626] flex items-center justify-between">
                      <span>Auto-Close Countdown:</span>
                      <span className="font-black">{mm}:{ss}</span>
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center justify-between pt-3 border-t border-[#670626]/15 gap-2 flex-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${statusBadge.pillClass}`}>
                    {statusBadge.label}
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {canVerifyOrReject && r.evidencePhotos.length > 0 && (
                      <AdminButton
                        variant="primary"
                        size="xs"
                        disabled={aiProcessingId === r.id}
                        onClick={() => void handleAiAutoApprove(r.id)}
                        icon={
                          aiProcessingId === r.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )
                        }
                      >
                        {aiProcessingId === r.id ? 'AI Processing Photo...' : 'AI Auto-Approve'}
                      </AdminButton>
                    )}
                    {canVerifyOrReject && (
                      <>
                        <AdminButton
                          variant="success"
                          size="xs"
                          onClick={() => void handleVerifyOrRejectReport(r.id, 'Verified')}
                        >
                          Verify
                        </AdminButton>
                        <AdminButton
                          variant="danger"
                          size="xs"
                          onClick={() => void handleVerifyOrRejectReport(r.id, 'Rejected')}
                        >
                          Reject
                        </AdminButton>
                      </>
                    )}
                    {!r.isClosed && !r.isRejected && (
                      <AdminButton
                        variant="outline"
                        size="xs"
                        onClick={() => void handleManualClose(r.id)}
                      >
                        Close
                      </AdminButton>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className={`${CLAY_SURFACE} flex items-center justify-between gap-4 p-4 text-sm font-mono`}>
          <span className="text-[#A83B4D]">
            Page {currentPage} of {totalPages} ({filteredReports.length} total)
          </span>
          <div className="flex items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={prevPage}
              className="text-xs"
            >
              PREV
            </AdminButton>
            <AdminButton
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={nextPage}
              className="text-xs"
            >
              NEXT
            </AdminButton>
          </div>
        </div>
      )}

      {/* Warm Ivory Dossier Modal */}
      {isDetailModalOpen && selectedReport && (
        <AdminModalCard
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Report ${selectedReport.referenceCode}`}
          subtitle={`${selectedReport.title} — ${selectedReport.responderName} (${selectedReport.responderUnit})`}
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          <div className="space-y-6 text-sm text-[#670626]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className={`${CLAY_WELL} p-3.5`}>
                <span className="text-xs font-mono text-[#A83B4D] uppercase">Severity</span>
                <p className="text-base font-black text-[#670626] mt-1">{selectedReport.severity}</p>
              </div>
              <div className={`${CLAY_WELL} p-3.5`}>
                <span className="text-xs font-mono text-[#A83B4D] uppercase">Status</span>
                <p className="text-base font-black text-[#670626] mt-1">
                  {formatIncidentStatusBadge(selectedReport.status, selectedReport.allocatedUnitCode, selectedReport.verifiedAt, selectedReport.closedAt).label}
                </p>
              </div>
              <div className={`${CLAY_WELL} p-3.5`}>
                <span className="text-xs font-mono text-[#A83B4D] uppercase">Terminal IP</span>
                <p className="text-base font-mono font-bold text-[#670626] mt-1">{selectedReport.ipAddress}</p>
              </div>
              <div className={`${CLAY_WELL} p-3.5`}>
                <span className="text-xs font-mono text-[#A83B4D] uppercase">Submitted At</span>
                <p className="text-xs font-mono text-[#670626] mt-1">
                  {formatDateTimeWithSecondsAmPm(selectedReport.submittedAt)}
                </p>
              </div>
            </div>

            <div className={`${CLAY_WELL} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono`}>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#670626] flex-shrink-0" />
                <span className="text-[#670626] text-sm font-bold">{selectedReport.locationLabel}</span>
              </div>
              <span className="text-[#A83B4D] text-xs">
                {selectedReport.latitude.toFixed(6)}° N, {selectedReport.longitude.toFixed(6)}° E
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#670626] uppercase tracking-wider flex items-center gap-1.5 font-mono mb-2.5">
                <Camera className="w-4 h-4 text-[#A83B4D]" />
                Evidence Photos ({selectedReport.evidencePhotos.length})
              </h4>

              {isLoadingDossier && selectedReport.evidencePhotos.length === 0 ? (
                <div className={`${CLAY_WELL} p-6 text-center text-[#A83B4D] font-mono text-sm flex items-center justify-center gap-2`}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading evidence media from PostgreSQL…</span>
                </div>
              ) : selectedReport.evidencePhotos.length === 0 ? (
                <div className={`${CLAY_WELL} p-6 text-center text-[#A83B4D] font-mono text-sm`}>
                  No photographic evidence attached to this dossier.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedReport.evidencePhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => openLightbox(selectedReport.evidencePhotos, idx)}
                      className="rounded-xl overflow-hidden border border-[#670626]/20 hover:border-[#670626] cursor-pointer bg-[#E9D9D0]"
                    >
                      <img
                        src={photo.url}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-28 object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#670626] uppercase tracking-wider flex items-center gap-1.5 font-mono mb-2.5">
                <HeartPulse className="w-4 h-4 text-[#A83B4D]" />
                Patient Care Records ({selectedReport.casualties.length})
              </h4>

              {isLoadingDossier && selectedReport.casualties.length === 0 ? (
                <div className={`${CLAY_WELL} p-6 text-center text-[#A83B4D] font-mono text-sm flex items-center justify-center gap-2`}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading Patient Care Records from PostgreSQL…</span>
                </div>
              ) : selectedReport.casualties.length === 0 ? (
                <div className={`${CLAY_WELL} p-6 text-center text-[#A83B4D] font-mono text-sm`}>
                  No individual patient care records recorded for this incident.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedReport.casualties.map((c, i) => (
                    <div key={c.id || i} className={`${CLAY_WELL} p-4 space-y-3`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#670626]/15 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#670626] text-[#F7F1EA] font-mono text-xs font-bold flex items-center justify-center">
                            #{i + 1}
                          </span>
                          <span className="font-bold text-[#670626] text-sm">{c.patientName}</span>
                          <span className="text-[#A83B4D] font-mono text-xs">
                            ({c.gender}, {c.age} yrs)
                          </span>
                        </div>
                        <span className="text-xs font-mono text-[#670626] font-bold px-2.5 py-0.5 rounded bg-[#F7F1EA] border border-[#670626]/20">
                          {c.levelOfConsciousness || 'Conscious'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center font-mono text-xs">
                        <div className="p-2.5 rounded-lg bg-[#F7F1EA] border border-[#670626]/15">
                          <span className="text-[#A83B4D] text-xs block">BP (mmHg)</span>
                          <span className="font-bold text-[#670626] text-sm mt-0.5 block">
                            {c.bpSystolic}/{c.bpDiastolic}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#F7F1EA] border border-[#670626]/15">
                          <span className="text-[#A83B4D] text-xs block">HR (BPM)</span>
                          <span className="font-bold text-[#670626] text-sm mt-0.5 block">{c.heartRate}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#F7F1EA] border border-[#670626]/15">
                          <span className="text-[#A83B4D] text-xs block">SpO2</span>
                          <span className="font-bold text-emerald-800 text-sm mt-0.5 block">{c.spO2}%</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#F7F1EA] border border-[#670626]/15">
                          <span className="text-[#A83B4D] text-xs block">Resp Rate</span>
                          <span className="font-bold text-[#670626] text-sm mt-0.5 block">{c.respiratoryRate}/min</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#F7F1EA] border border-[#670626]/15">
                          <span className="text-[#A83B4D] text-xs block">Temp (°C)</span>
                          <span className="font-bold text-[#670626] text-sm mt-0.5 block">{c.temp}°C</span>
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <p><strong>Receiving Facility:</strong> {c.receivingHospital}</p>
                        <p><strong>Chief Complaint:</strong> {c.chiefComplaint}</p>
                        {c.narrative && <p><strong>Clinical Narrative:</strong> {c.narrative}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {aiProcessingId === selectedReport.id && (
              <div className="p-3.5 rounded-xl bg-[#670626] text-[#F7F1EA] font-mono text-xs font-bold flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>AI Processing Photo... Evaluating Roboflow + Claude Haiku 4.5</span>
              </div>
            )}

            {(selectedReport.roboflowPrediction ||
              selectedReport.claudeSituationSummary ||
              selectedReport.aiAutoApproved ||
              selectedReport.aiVerificationStatus) && (
              <div className={`${CLAY_WELL} p-4 space-y-2`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-mono font-black uppercase tracking-wider text-[#670626] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#A83B4D]" />
                    Roboflow + Claude Haiku 4.5 Triage
                  </span>
                  {renderAiStatusPill(selectedReport)}
                </div>
                {selectedReport.roboflowPrediction && (
                  <p className="text-xs font-mono text-[#670626]">
                    <strong>Roboflow:</strong> {selectedReport.roboflowPrediction}
                    {typeof selectedReport.roboflowConfidence === 'number'
                      ? ` (${Math.round(selectedReport.roboflowConfidence * 100)}%)`
                      : ''}
                    {selectedReport.pointerIconType ? ` · [${selectedReport.pointerIconType}]` : ''}
                  </p>
                )}
                {(selectedReport.claudeVisibleHazards || selectedReport.claudeSituationSummary) && (
                  <p className="text-xs text-[#670626]">
                    <strong>Claude Haiku 4.5:</strong>{' '}
                    {selectedReport.claudeVisibleHazards || selectedReport.claudeSituationSummary}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#670626]/15">
              <span className="text-xs font-mono text-[#A83B4D]">
                Updates live map &amp; alert bell
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                {!selectedReport.isVerified &&
                  !selectedReport.isClosed &&
                  !selectedReport.isRejected &&
                  selectedReport.evidencePhotos.length > 0 && (
                    <AdminButton
                      variant="primary"
                      size="sm"
                      disabled={aiProcessingId === selectedReport.id}
                      onClick={() => void handleAiAutoApprove(selectedReport.id)}
                      icon={
                        aiProcessingId === selectedReport.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {aiProcessingId === selectedReport.id ? 'AI Processing Photo...' : 'AI Auto-Approve'}
                    </AdminButton>
                  )}
                {!selectedReport.isVerified && !selectedReport.isClosed && !selectedReport.isRejected && (
                  <>
                    <AdminButton
                      variant="success"
                      size="sm"
                      onClick={() => {
                        void handleVerifyOrRejectReport(selectedReport.id, 'Verified');
                        setIsDetailModalOpen(false);
                      }}
                      icon={<Check className="w-3.5 h-3.5" />}
                    >
                      Verify Report
                    </AdminButton>
                    <AdminButton
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        void handleVerifyOrRejectReport(selectedReport.id, 'Rejected');
                        setIsDetailModalOpen(false);
                      }}
                      icon={<XCircle className="w-3.5 h-3.5" />}
                    >
                      Reject Report
                    </AdminButton>
                  </>
                )}
                {!selectedReport.isClosed && !selectedReport.isRejected && (
                  <AdminButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleManualClose(selectedReport.id);
                      setIsDetailModalOpen(false);
                    }}
                  >
                    Close Case
                  </AdminButton>
                )}
                <AdminButton variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                  Dismiss
                </AdminButton>
              </div>
            </div>
          </div>
        </AdminModalCard>
      )}

      {isLightboxOpen && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageUrl={lightboxImageUrl}
          images={lightboxImages}
          initialIndex={lightboxIndex}
          title="Evidence Photos"
        />
      )}
    </div>
  );
};

export default SubmittedReportsPage;
