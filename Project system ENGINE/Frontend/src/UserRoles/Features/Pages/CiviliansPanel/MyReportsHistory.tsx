// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Displays real-time status progression of the authenticated resident's own filed reports
// via GET /api/reports/mine, sorted newest-to-oldest, with all status pills
// (Submitted / Reported, Pending, Verified, Dispatched, Resolved, Rejected).
// Strictly 100% arrow functions (=>), ZERO 'any', ZERO emojis, and ZERO Active & Dispatched counters.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  FileText,
  MapPin,
  Ambulance,
  ZoomIn,
  Star,
  Sparkles,
  Car,
  Flame,
  HeartPulse,
  ShieldAlert,
  Waves,
  AlertTriangle
} from 'lucide-react';
import { getMyReports, ReportItem } from '@/Endpoints/reportsApi';
import { requestJson } from '@/Endpoints/apiClient';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { SearchBar } from '@/Shared/SearchBar';
import { TableCardToggle, useTableCardView } from '@/Shared/TableCardToggle';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { useSession } from '@/Hooks/useSession';
import { formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { useDistressBeacon } from '@/Hooks/useDistressBeacon';
import { CivilianButton } from './Shared/CivilianButton';
import { CivilianModalCard } from './Shared/CivilianModalCard';

type ExtendedReportItem = ReportItem & {
  aiAutoApproved?: boolean;
  aiVerificationStatus?: string | null;
};

type StatusFilter =
  | 'all'
  | 'Submitted'
  | 'Pending'
  | 'Verified'
  | 'Dispatched'
  | 'Resolved'
  | 'Rejected';

type NormalizedStatus =
  | 'Submitted'
  | 'Pending'
  | 'Verified'
  | 'Dispatched'
  | 'Resolved'
  | 'Rejected';

const SEVERITY_PILL_MAP: Record<string, string> = {
  Critical: 'bg-[#670626] text-[#F7F1EA] border-[#670626]',
  High: 'bg-[#A83B4D] text-[#F7F1EA] border-[#A83B4D]',
  Medium: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/50',
  Low: 'bg-[#F7F1EA] text-[#670626] border-[#670626]/25'
};

const renderPointerIconBadge = (pointerIconType?: string | null): React.ReactNode => {
  switch (pointerIconType) {
    case 'car-crash':
      return <Car className="w-3.5 h-3.5 text-[#670626]" />;
    case 'fire':
      return <Flame className="w-3.5 h-3.5 text-[#670626]" />;
    case 'medical':
      return <HeartPulse className="w-3.5 h-3.5 text-[#670626]" />;
    case 'crime':
      return <ShieldAlert className="w-3.5 h-3.5 text-[#670626]" />;
    case 'flood':
      return <Waves className="w-3.5 h-3.5 text-[#670626]" />;
    default:
      return <ShieldAlert className="w-3.5 h-3.5 text-[#670626]" />;
  }
};

const enrichReportWithAiCache = (r: ExtendedReportItem): ExtendedReportItem => {
  try {
    const raw = localStorage.getItem('resqtrack_ai_vision_by_report');
    if (!raw) return r;
    const map = JSON.parse(raw) as Record<string, Partial<ExtendedReportItem>>;
    const cached = map[r.id] || (r.referenceCode ? map[r.referenceCode] : undefined);
    if (!cached) return r;
    return {
      ...r,
      roboflowModelId: r.roboflowModelId ?? cached.roboflowModelId,
      roboflowPrediction: r.roboflowPrediction ?? cached.roboflowPrediction,
      roboflowConfidence: r.roboflowConfidence ?? cached.roboflowConfidence,
      roboflowNeedsReview: r.roboflowNeedsReview ?? cached.roboflowNeedsReview,
      claudeModelUsed: r.claudeModelUsed ?? cached.claudeModelUsed,
      claudeIncidentCategory: r.claudeIncidentCategory ?? cached.claudeIncidentCategory,
      claudeSituationSummary: r.claudeSituationSummary ?? cached.claudeSituationSummary,
      claudeVisibleHazards: r.claudeVisibleHazards ?? cached.claudeVisibleHazards,
      claudeUncertaintyNotes: r.claudeUncertaintyNotes ?? cached.claudeUncertaintyNotes,
      pointerIconType: r.pointerIconType ?? cached.pointerIconType
    };
  } catch {
    return r;
  }
};

const getDeterministicStatus = (
  r: ExtendedReportItem
): {
  normalizedStatus: NormalizedStatus;
  pillLabel: string;
  currentStage: number;
  badgeClass: string;
} => {
  const raw = (r.status || 'Reported').trim().toUpperCase();

  if (raw === 'REJECTED') {
    return {
      normalizedStatus: 'Rejected',
      pillLabel: 'Rejected',
      currentStage: -1,
      badgeClass: 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
    };
  }

  if (raw === 'RESOLVED' || raw === 'CLOSED' || Boolean(r.resolvedAt)) {
    return {
      normalizedStatus: 'Resolved',
      pillLabel: 'Resolved',
      currentStage: 3,
      badgeClass: 'bg-[#E9D9D0] text-[#670626] border-[#670626]/40'
    };
  }

  if (
    raw === 'ALLOCATED' ||
    raw === 'ENROUTE' ||
    raw === 'ONSCENE' ||
    raw === 'DISPATCHED' ||
    Boolean(r.allocatedUnitCode)
  ) {
    return {
      normalizedStatus: 'Dispatched',
      pillLabel: 'Dispatched',
      currentStage: 2,
      badgeClass: 'bg-[#A83B4D] text-[#F7F1EA] border-[#A83B4D]'
    };
  }

  if (raw === 'VERIFIED' || Boolean(r.verifiedAt) || Boolean(r.aiAutoApproved)) {
    return {
      normalizedStatus: 'Verified',
      pillLabel: r.aiAutoApproved ? 'AI Auto-Approved' : 'Verified',
      currentStage: 1,
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
    };
  }

  if (raw === 'PENDING' || raw === 'PENDINGVERIFICATION') {
    return {
      normalizedStatus: 'Pending',
      pillLabel: 'Pending',
      currentStage: 0,
      badgeClass: 'bg-[#E9D9D0] text-[#A83B4D] border-[#A83B4D]/45'
    };
  }

  return {
    normalizedStatus: 'Submitted',
    pillLabel: 'Submitted',
    currentStage: 0,
    badgeClass: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/45'
  };
};

export const MyReportsHistory: React.FC = () => {
  const { session } = useSession();
  const [reports, setReports] = useState<ExtendedReportItem[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFeedbackReport, setSelectedFeedbackReport] = useState<ExtendedReportItem | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccessToast, setFeedbackSuccessToast] = useState<string | null>(null);

  const { viewMode, setViewMode } = useTableCardView('card');

  const activeDistressIncidentId = useMemo(() => {
    try {
      const stored = localStorage.getItem('resqtrack_active_distress_incident_id');
      if (stored) return stored;
    } catch {
      // Storage guard
    }
    const activeOne = reports.find((r) => {
      const st = (r.status || '').toLowerCase();
      return st !== 'resolved' && st !== 'closed' && st !== 'rejected';
    });
    return activeOne?.id || null;
  }, [reports]);

  useDistressBeacon({
    activeIncidentId: activeDistressIncidentId,
    intervalMs: 60000
  });

  const loadReports = useCallback(async () => {
    try {
      const data = await getMyReports();
      const safeList = Array.isArray(data) ? (data as ExtendedReportItem[]) : [];
      const ownReports = safeList
        .filter((r) => {
          if (!r || !r.id) return false;
          if (session?.userId && r.reporterId) {
            return r.reporterId === session.userId;
          }
          return true;
        })
        .map((r) => enrichReportWithAiCache(r));
      ownReports.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.submittedAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.submittedAt || 0).getTime();
        return timeB - timeA;
      });
      setReports(ownReports);
    } catch (err) {
      console.error('Failed to load citizen reports history:', err);
      setReports([]);
    }
  }, [session?.userId]);

  useValueRefreshAuto(loadReports, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useReportEventBus(() => {
    loadReports();
  });

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const { normalizedStatus } = getDeterministicStatus(r);
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = r.referenceCode?.toLowerCase().includes(q);
        const titleMatch = r.title?.toLowerCase().includes(q);
        const locMatch = r.locationLabel?.toLowerCase().includes(q);
        const catMatch = r.category?.toLowerCase().includes(q);
        const statusMatch = normalizedStatus.toLowerCase().includes(q);
        if (!codeMatch && !titleMatch && !locMatch && !catMatch && !statusMatch) return false;
      }

      return true;
    });
  }, [reports, statusFilter, searchQuery]);

  const statusTabs: StatusFilter[] = [
    'all',
    'Submitted',
    'Pending',
    'Verified',
    'Dispatched',
    'Resolved',
    'Rejected'
  ];

  const handleOpenFeedbackModal = (report: ExtendedReportItem) => {
    setFeedbackError(null);
    setFeedbackRating(5);
    setFeedbackComment('');
    setSelectedFeedbackReport(report);
  };

  const handleSubmitFeedback = async () => {
    if (!selectedFeedbackReport || isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await requestJson<{ message?: string }>(`/api/reports/${selectedFeedbackReport.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          rating: feedbackRating,
          comment: feedbackComment.trim()
        })
      });
      const refCode = selectedFeedbackReport.referenceCode;
      setSelectedFeedbackReport(null);
      setFeedbackComment('');
      setFeedbackRating(5);
      setFeedbackSuccessToast(`Feedback saved for #${refCode}.`);
      setTimeout(() => setFeedbackSuccessToast(null), 5000);
      await loadReports();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save feedback.';
      setFeedbackError(msg);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F7F1EA]/20 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
            Incident Ledger
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
            My Reports
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/civilian/report">
            <CivilianButton variant="danger" size="sm" className="min-h-[40px] text-sm">
              + New Report
            </CivilianButton>
          </Link>
        </div>
      </div>

      {/* 2. Feedback Success Toast */}
      {feedbackSuccessToast && (
        <div className="clay-surface p-4 rounded-xl bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] text-sm font-bold flex items-center gap-3 shadow-lg">
          <Check className="w-5 h-5 flex-shrink-0 text-[#670626]" />
          <span>{feedbackSuccessToast}</span>
        </div>
      )}

      {/* 3. Status Filter Bar, Search Bar, and TableCardToggle */}
      <div className="clay-surface flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 shadow-[0_12px_30px_rgba(74,4,26,0.22)]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          {statusTabs.map((tab) => {
            const count =
              tab === 'all'
                ? reports.length
                : reports.filter((r) => getDeterministicStatus(r).normalizedStatus === tab).length;
            const isSelected = statusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#670626] text-[#F7F1EA] shadow-sm'
                    : 'bg-[#E9D9D0] text-[#670626] hover:bg-[#670626]/15 border border-[#670626]/15'
                }`}
              >
                {tab === 'all' ? `All (${count})` : `${tab} (${count})`}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search code, title, sector..."
            className="w-full sm:w-56 !bg-[#E9D9D0] !text-[#670626] !border-[#670626]/20"
          />
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* 4. Empty State */}
      {filteredReports.length === 0 ? (
        <div className="clay-surface p-12 text-center flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 shadow-[0_14px_32px_rgba(74,4,26,0.22)]">
          <div className="w-14 h-14 rounded-2xl bg-[#E9D9D0] border border-[#670626]/20 flex items-center justify-center text-[#670626]">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-[#670626]">No Reports Found</h3>
          <p className="text-sm text-[#A83B4D] max-w-sm">
            {searchQuery ? `No reports matching "${searchQuery}".` : 'No reports submitted yet.'}
          </p>
          <Link to="/civilian/report" className="mt-2">
            <CivilianButton variant="danger" size="sm" className="text-sm">
              Submit Report
            </CivilianButton>
          </Link>
        </div>
      ) : viewMode === 'card' ? (
        /* 5. CARD VIEW */
        <div className="flex flex-col gap-5">
          {filteredReports.map((r) => {
            const { normalizedStatus, pillLabel, currentStage, badgeClass } =
              getDeterministicStatus(r);
            const sevClass = SEVERITY_PILL_MAP[r.severity] || SEVERITY_PILL_MAP.Low;

            return (
              <div
                key={r.id}
                className="clay-surface p-5 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 hover:border-[#670626]/35 transition-all duration-200 shadow-[0_14px_34px_rgba(74,4,26,0.22)] flex flex-col gap-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#670626]/15 pb-3.5">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-[#670626] bg-[#E9D9D0] px-3 py-1 rounded-lg border border-[#670626]/20">
                        #{r.referenceCode}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border ${sevClass}`}
                      >
                        {r.severity}
                      </span>
                      <span className="text-xs font-mono text-[#A83B4D] font-semibold">
                        {r.category || 'VehicularAccident'}
                      </span>
                    </div>

                    <h2 className="text-lg font-black text-[#670626] mt-1">{r.title}</h2>
                    <span className="text-xs text-[#A83B4D] flex items-center gap-1.5 font-medium">
                      <MapPin className="w-4 h-4 text-[#670626] flex-shrink-0" />
                      <span>{r.locationLabel || 'Katipunan Sector'}</span>
                      <span className="text-[#670626]/40">/</span>
                      <span className="font-mono text-xs text-[#670626]">
                        {formatGpsCoord(r.latitude, r.longitude)}
                      </span>
                    </span>
                  </div>

                  {/* Status Pill & Approaching Unit */}
                  <div className="flex flex-col sm:items-end gap-1.5">
                    <span
                      className={`px-3.5 py-1 rounded-full text-xs font-mono font-bold uppercase border inline-flex items-center gap-1.5 ${badgeClass}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current" />
                      <span>{pillLabel}</span>
                    </span>
                    <span className="text-xs font-mono text-[#A83B4D]">
                      Filed {formatRelativeTime(r.createdAt || r.submittedAt)}
                    </span>

                    {normalizedStatus === 'Dispatched' && r.allocatedUnitCode && (
                      <span className="mt-1 px-3 py-1 rounded-lg bg-[#E9D9D0] text-[#670626] border border-[#670626]/25 font-mono text-xs font-bold flex items-center gap-1.5">
                        <Ambulance className="w-4 h-4 text-[#670626]" />
                        <span>En Route:</span>
                        <strong className="text-[#4A041A]">{r.allocatedUnitCode}</strong>
                      </span>
                    )}

                    {normalizedStatus === 'Resolved' && (
                      <button
                        type="button"
                        onClick={() => handleOpenFeedbackModal(r)}
                        className="mt-1 text-xs font-mono text-[#670626] hover:text-[#4A041A] font-bold underline text-right inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Rate Response</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Stepped Progression Bar */}
                {normalizedStatus === 'Rejected' ? (
                  <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/25 text-xs font-mono font-bold text-[#670626]">
                    Rejected during verification.
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs font-mono font-bold">
                      <span className={currentStage >= 0 ? 'text-[#670626]' : 'text-[#A83B4D]/60'}>
                        Submitted
                      </span>
                      <span className={currentStage >= 1 ? 'text-[#670626]' : 'text-[#A83B4D]/60'}>
                        Verified
                      </span>
                      <span className={currentStage >= 2 ? 'text-[#670626]' : 'text-[#A83B4D]/60'}>
                        Dispatched
                      </span>
                      <span className={currentStage >= 3 ? 'text-[#670626]' : 'text-[#A83B4D]/60'}>
                        Resolved
                      </span>
                    </div>

                    <div className="relative w-full h-2.5 rounded-full bg-[#F7F1EA] border border-[#670626]/15 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 rounded-full ${
                          currentStage === 3
                            ? 'w-full bg-[#670626]'
                            : currentStage === 2
                            ? 'w-3/4 bg-[#A83B4D]'
                            : currentStage === 1
                            ? 'w-1/2 bg-[#A83B4D]'
                            : 'w-1/4 bg-[#A83B4D]/75'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Dual-AI Vision Summary Strip */}
                {(r.roboflowPrediction || r.claudeSituationSummary || r.pointerIconType) && (
                  <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 flex flex-col gap-2 text-xs font-mono">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-black text-[#670626] uppercase">
                        <Sparkles className="w-3.5 h-3.5 text-[#670626]" />
                        <span>
                          Roboflow: {r.roboflowPrediction || 'incident'}
                          {typeof r.roboflowConfidence === 'number'
                            ? ` (${Math.round(r.roboflowConfidence * 100)}%)`
                            : ''}
                        </span>
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        {r.pointerIconType && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] font-bold uppercase">
                            {renderPointerIconBadge(r.pointerIconType)}
                            <span>{r.pointerIconType}</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-[#F7F1EA] border border-[#A83B4D]/40 text-[#A83B4D] font-bold">
                          {r.claudeModelUsed || 'Pending AI'}
                        </span>
                      </div>
                    </div>

                    {(r.claudeSituationSummary || r.claudeVisibleHazards) && (
                      <div className="font-sans text-xs text-[#670626] leading-relaxed">
                        {r.claudeSituationSummary && (
                          <p>
                            <strong className="font-mono text-[#A83B4D] uppercase">Situation: </strong>
                            {r.claudeSituationSummary}
                          </p>
                        )}
                        {r.claudeVisibleHazards && (
                          <p className="mt-0.5">
                            <strong className="font-mono text-[#A83B4D] uppercase">Hazards: </strong>
                            {r.claudeVisibleHazards}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Note and Photo Lightbox Trigger */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  {r.note && (
                    <p className="text-sm text-[#670626] bg-[#E9D9D0] p-3.5 rounded-xl border border-[#670626]/15 flex-1 leading-relaxed">
                      <span className="text-[#A83B4D] font-mono text-xs uppercase font-bold block mb-1">
                        Notes:
                      </span>
                      {r.note}
                    </p>
                  )}

                  {r.imageUrl && (
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setLightboxImageUrl(r.imageUrl || null)}
                        className="group relative w-24 h-24 rounded-xl overflow-hidden border border-[#670626]/25 hover:border-[#670626] transition-all shadow-sm block cursor-pointer"
                      >
                        <img
                          src={r.imageUrl}
                          alt="Incident scene capture"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-[#4A041A]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-[#F7F1EA] text-xs font-mono font-bold">
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>Zoom</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 6. TABLE VIEW */
        <div className="clay-surface rounded-2xl border border-[#670626]/15 overflow-hidden bg-[#F7F1EA] text-[#670626] shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-sm">
              <thead className="bg-[#E9D9D0] border-b border-[#670626]/15 text-[#670626] uppercase text-xs tracking-wider">
                <tr>
                  <th className="p-4">Ref</th>
                  <th className="p-4">Title &amp; Location</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Unit</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10 bg-[#F7F1EA]">
                {filteredReports.map((r) => {
                  const { normalizedStatus, pillLabel, badgeClass } = getDeterministicStatus(r);
                  const sevClass = SEVERITY_PILL_MAP[r.severity] || SEVERITY_PILL_MAP.Low;

                  return (
                    <tr key={r.id} className="hover:bg-[#E9D9D0]/55 transition-colors">
                      <td className="p-4 text-[#670626] font-black whitespace-nowrap">
                        #{r.referenceCode}
                      </td>
                      <td className="p-4 max-w-xs">
                        <span className="font-sans font-bold text-[#670626] block truncate">
                          {r.title}
                        </span>
                        <span className="text-xs text-[#A83B4D] truncate block">
                          {r.locationLabel}
                        </span>
                      </td>
                      <td className="p-4 text-[#670626] whitespace-nowrap text-xs">
                        {r.category}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${sevClass}`}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClass}`}
                        >
                          {pillLabel}
                        </span>
                      </td>
                      <td className="p-4 text-[#670626] whitespace-nowrap">
                        {r.allocatedUnitCode ? (
                          <span className="font-bold text-[#670626]">{r.allocatedUnitCode}</span>
                        ) : (
                          <span className="text-[#A83B4D]">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {r.imageUrl && (
                            <button
                              type="button"
                              onClick={() => setLightboxImageUrl(r.imageUrl || null)}
                              className="px-3 py-1.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] hover:bg-[#670626] hover:text-[#F7F1EA] text-xs font-bold cursor-pointer transition-colors"
                            >
                              Photo
                            </button>
                          )}
                          {normalizedStatus === 'Resolved' && (
                            <button
                              type="button"
                              onClick={() => handleOpenFeedbackModal(r)}
                              className="px-3 py-1.5 rounded-lg bg-[#670626] text-[#F7F1EA] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5" />
                              <span>Rate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Citizen Response Quality Rating Modal */}
      <CivilianModalCard
        isOpen={Boolean(selectedFeedbackReport)}
        onClose={() => setSelectedFeedbackReport(null)}
        title="Rate Response"
        size="sm"
      >
        {selectedFeedbackReport && (
          <div className="flex flex-col gap-4 text-[#670626]">
            <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-sm font-mono">
              <span className="text-[#A83B4D] block mb-0.5 text-xs font-bold">Resolved:</span>
              <span className="font-black text-[#670626] block">
                #{selectedFeedbackReport.referenceCode} - {selectedFeedbackReport.title}
              </span>
              <span className="text-[#A83B4D] text-xs block mt-1">
                Unit: {selectedFeedbackReport.allocatedUnitCode || 'Municipal Unit'}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#670626]">Rating</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="p-1 transition-transform hover:scale-125 cursor-pointer"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= feedbackRating
                          ? 'fill-[#670626] text-[#670626]'
                          : 'text-[#A83B4D]/40'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 font-mono text-sm font-bold text-[#670626]">
                  {feedbackRating}/5
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-[#670626]">
                Comments <span className="text-[#A83B4D] font-normal">(Optional)</span>
              </label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={3}
                placeholder="Arrival time and responder notes..."
                className="px-3.5 py-2.5 bg-[#E9D9D0] border border-[#670626]/20 rounded-xl text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626] leading-relaxed"
              />
            </div>

            {feedbackError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[#670626] text-[#F7F1EA] text-xs font-mono font-bold flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{feedbackError}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <CivilianButton
                variant="primary"
                size="md"
                isLoading={isSubmittingFeedback}
                onClick={handleSubmitFeedback}
                className="flex-1 text-sm"
              >
                {isSubmittingFeedback ? 'Saving Feedback...' : 'Submit Feedback'}
              </CivilianButton>
              <CivilianButton
                variant="outline"
                size="md"
                onClick={() => setSelectedFeedbackReport(null)}
              >
                Cancel
              </CivilianButton>
            </div>
          </div>
        )}
      </CivilianModalCard>

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxImageUrl)}
        imageUrl={lightboxImageUrl}
        onClose={() => setLightboxImageUrl(null)}
        title="Incident Evidence"
      />
    </div>
  );
};

export default MyReportsHistory;
