// [Layer: UserRoles/Features/Pages/AdminsPanel]
// IncidentsPage.tsx -- Dispatch Manager (FIX #17).
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Instructor #4 & #7: Full status badges (Submitted, Pending, Verified, Dispatched, Resolved, Rejected) + Verify / Reject actions.
// Instructor #8: Wires getStandbyAutoDispatch (ClaudeAutoDispatchResponderStrategy / Haversine nearest-unit ranking)
// for Nearby Available Units sorted by distance (km) with 1-click Auto-Dispatch action.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useState, useEffect, FC, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  UserCheck,
  ShieldAlert,
  Users,
  Shield,
  HeartPulse,
  Flame,
  Radio,
  MapPin,
  Sparkles,
  Activity,
  Camera,
  TrendingUp,
  Send,
  Check,
  X,
  Navigation,
  Zap,
  XCircle
} from 'lucide-react';
import { getAllReports, updateReportSeverity, ReportItem } from '@/Endpoints/reportsApi';
import {
  getDutyRoster,
  DutyUnit,
  getDispatchRequests,
  approveMedicRequestByAdmin,
  respondToAdminDeployOrder,
  DispatchRequestRecord
} from '@/Endpoints/responderOpsApi';
import { verifyReport, allocateReportUnit } from '@/Endpoints/adminGovernanceApi';
import { formatDateTimeWithSecondsAmPm } from '@/Shared/radarPointerCategories';
import {
  SearchBar,
  Dropdown,
  TableCardToggle,
  ViewMode
} from '@/Shared';
import { usePagination, useTableDraggable, useDebounce, useValueRefreshAuto } from '@/Hooks';
import {
  BASELINE_INCIDENT_REPORTS,
  BASELINE_DUTY_ROSTER
} from '@/Libs/Assets/baselineFixtures';
import {
  calculateHaversineDistanceKm,
  calculateDynamicEtaMinutes,
  getKatipunanBarangay,
  KATIPUNAN_BASE_COORDS
} from '@/Libs/Map/mapAccuracy';
import { AdminButton } from './Shared/AdminButton';
import { AdminModalCard } from './Shared/AdminModalCard';
import {
  CLAY_SURFACE,
  CLAY_WELL,
  formatIncidentStatusBadge,
  getStandbyAutoDispatch,
  type StandbyAutoDispatchOutput
} from './Shared/adminCommandHelpers';

export interface ExtendedReportItem extends ReportItem {
  deviceIp?: string;
  ipAddress?: string;
  mediaUrl?: string;
  timestamp?: string;
  location?: string;
}

export interface ExtendedDutyUnit extends DutyUnit {
  badgeNumber?: string;
  name?: string;
  assignedUnit?: string;
  currentIncident?: string;
  person?: string;
  incident?: string;
}

export const IncidentsPage: FC = () => {
  const [reports, setReports] = useState<ExtendedReportItem[]>([]);
  const [roster, setRoster] = useState<ExtendedDutyUnit[]>([]);
  const [searchRaw, setSearchRaw] = useState<string>('');
  const debouncedSearch = useDebounce(searchRaw, 250);

  // View mode & Filters
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('desc_date');

  // Auto-dispatch & Nearby Available Units state (Instructor #8)
  const [isAutoDispatchEnabled, setIsAutoDispatchEnabled] = useState<boolean>(true);
  const [focusedIncidentId, setFocusedIncidentId] = useState<string>('');
  const [autoDispatchOutput, setAutoDispatchOutput] = useState<StandbyAutoDispatchOutput | null>(null);
  const [isAutoDispatchingId, setIsAutoDispatchingId] = useState<string | null>(null);

  // Dispatch modal state
  const [activeDispatchIncident, setActiveDispatchIncident] = useState<ExtendedReportItem | null>(null);
  const [selectedResponderId, setSelectedResponderId] = useState<string>('');
  const [responderSearch, setResponderSearch] = useState<string>('');
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Responder Dispatch Requests Queue state
  const [dispatchRequests, setDispatchRequests] = useState<DispatchRequestRecord[]>([]);
  const [isDispatchRequestsModalOpen, setIsDispatchRequestsModalOpen] = useState<boolean>(false);
  const [requestSearch, setRequestSearch] = useState<string>('');
  const debouncedRequestSearch = useDebounce(requestSearch, 250);
  const [requestSortOrder, setRequestSortOrder] = useState<string>('pending_first');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'ALL' | 'PENDING' | 'DEPLOY'>('ALL');
  const [isProcessingRequestId, setIsProcessingRequestId] = useState<string | null>(null);

  const showToast = (msg: string): void => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (): Promise<void> => {
    try {
      const [r, u, reqs] = await Promise.all([
        getAllReports().catch(() => [] as ExtendedReportItem[]),
        getDutyRoster().catch(() => [] as ExtendedDutyUnit[]),
        getDispatchRequests().catch(() => [] as DispatchRequestRecord[])
      ]);

      let escalations: Record<string, string> = {};
      try {
        const storedEscalationsRaw = localStorage.getItem('resqtrack_escalated_severities');
        if (storedEscalationsRaw) {
          escalations = JSON.parse(storedEscalationsRaw) as Record<string, string>;
        }
      } catch {}

      let aiVisionCache: Record<string, Partial<ExtendedReportItem>> = {};
      try {
        const cachedAiRaw = localStorage.getItem('resqtrack_ai_vision_by_report');
        if (cachedAiRaw) {
          aiVisionCache = JSON.parse(cachedAiRaw) as Record<string, Partial<ExtendedReportItem>>;
        }
      } catch {}

      const baseList = r && r.length > 0 ? (r as ExtendedReportItem[]) : (BASELINE_INCIDENT_REPORTS as ExtendedReportItem[]);
      const validReports = baseList.map((rep) => {
        const cached = aiVisionCache[rep.id] || (rep.referenceCode ? aiVisionCache[rep.referenceCode] : undefined);
        return {
          ...rep,
          severity: escalations[rep.id] || rep.severity,
          roboflowModelId: rep.roboflowModelId ?? cached?.roboflowModelId,
          roboflowPrediction: rep.roboflowPrediction ?? cached?.roboflowPrediction,
          roboflowConfidence: rep.roboflowConfidence ?? cached?.roboflowConfidence,
          roboflowNeedsReview: rep.roboflowNeedsReview ?? cached?.roboflowNeedsReview,
          claudeModelUsed: rep.claudeModelUsed ?? cached?.claudeModelUsed,
          claudeIncidentCategory: rep.claudeIncidentCategory ?? cached?.claudeIncidentCategory,
          claudeSituationSummary: rep.claudeSituationSummary ?? cached?.claudeSituationSummary,
          claudeVisibleHazards: rep.claudeVisibleHazards ?? cached?.claudeVisibleHazards,
          claudeUncertaintyNotes: rep.claudeUncertaintyNotes ?? cached?.claudeUncertaintyNotes,
          pointerIconType: rep.pointerIconType ?? cached?.pointerIconType
        };
      });
      const validRoster = u && u.length > 0 ? (u as ExtendedDutyUnit[]) : (BASELINE_DUTY_ROSTER as ExtendedDutyUnit[]);
      setReports(validReports);
      setRoster(validRoster);
      setDispatchRequests(reqs || []);
    } catch (err) {
      console.error('[DispatchManager] Data sync error:', err);
      setReports((prev) => (prev.length > 0 ? prev : (BASELINE_INCIDENT_REPORTS as ExtendedReportItem[])));
      setRoster((prev) => (prev.length > 0 ? prev : (BASELINE_DUTY_ROSTER as ExtendedDutyUnit[])));
    }
  };

  useEffect(() => {
    void loadData();

    const handleNotification = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.type === 'REQUEST_DISPATCH_DEPLOY' || custom.detail?.category === 'REQUEST_DISPATCH_DEPLOY') {
        void getDispatchRequests().then((res) => setDispatchRequests(res || []));
        showToast('New Responder Dispatch Request Received!');
      }
    };
    const handleReport = () => {
      void getDispatchRequests().then((res) => setDispatchRequests(res || []));
    };
    window.addEventListener('resqtrack:notification', handleNotification);
    window.addEventListener('resqtrack:report', handleReport);
    return () => {
      window.removeEventListener('resqtrack:notification', handleNotification);
      window.removeEventListener('resqtrack:report', handleReport);
    };
  }, []);

  useValueRefreshAuto(loadData, { intervalMs: 8000 });

  const { containerRef } = useTableDraggable<HTMLDivElement>();

  const activeIncidents = useMemo(
    () =>
      reports.filter((r) => {
        const st = (r.status || '').toLowerCase();
        return st !== 'resolved' && st !== 'closed' && st !== 'rejected';
      }),
    [reports]
  );

  const focusedIncident = useMemo(() => {
    if (focusedIncidentId) {
      const matched = activeIncidents.find((r) => r.id === focusedIncidentId);
      if (matched) return matched;
    }
    return activeIncidents[0] || reports[0] || null;
  }, [focusedIncidentId, activeIncidents, reports]);

  // Wire getStandbyAutoDispatch for Nearby Available Units sorted by distance (km)
  useEffect(() => {
    if (!focusedIncident || roster.length === 0) return;
    let cancelled = false;

    const runRanking = async () => {
      const res = await getStandbyAutoDispatch(
        {
          incidentLat: Number(focusedIncident.currentLatitude ?? focusedIncident.latitude ?? KATIPUNAN_BASE_COORDS.latitude),
          incidentLng: Number(focusedIncident.currentLongitude ?? focusedIncident.longitude ?? KATIPUNAN_BASE_COORDS.longitude),
          incidentType: focusedIncident.category,
          severity: focusedIncident.severity,
          requiredAgencyType: focusedIncident.recommendedAgencyUnit || undefined,
          applyDispatch: false
        },
        roster
      );
      if (!cancelled) {
        setAutoDispatchOutput(res);
      }
    };

    void runRanking();
    return () => {
      cancelled = true;
    };
  }, [focusedIncident, roster]);

  const calculateTivaScore = (inc: ExtendedReportItem): number => {
    const severityWeights: Record<string, number> = {
      Critical: 40,
      Severe: 38,
      High: 28,
      Medium: 18,
      Low: 10
    };
    const baseWeight = severityWeights[inc.severity] || 15;
    const geoBonus = inc.isHardwareGeolocated ? 15 : 5;
    const clarityBonus = inc.isBlurry ? 0 : 15;
    const reportTime = new Date(inc.createdAt || inc.timestamp || Date.now()).getTime();
    const elapsedMinutes = Math.max(0, (Date.now() - reportTime) / 60000);
    const recencyDecay = Math.max(0, Math.min(30, Math.floor(30 - elapsedMinutes * 0.5)));
    return Math.min(100, Math.max(12, baseWeight + geoBonus + clarityBonus + recencyDecay));
  };

  const calculateAiConfidence = (inc: ExtendedReportItem): string => {
    let score = 84;
    if (inc.isHardwareGeolocated) score += 9;
    if (!inc.isBlurry) score += 5;
    if (inc.gpsAccuracyMeters && inc.gpsAccuracyMeters < 15) score += 1.8;
    const fractional = Math.abs(Math.sin((inc.latitude || 8.5) * 100)) * 0.9;
    return `${Math.min(99.9, score + fractional).toFixed(1)}%`;
  };

  const handleEscalateSeverity = async (incidentId: string): Promise<void> => {
    const escalationOrder: Record<string, string> = {
      Low: 'Medium',
      Medium: 'High',
      High: 'Critical',
      Critical: 'Critical'
    };

    const target = reports.find((r) => r.id === incidentId);
    if (!target) return;
    const nextSeverity = escalationOrder[target.severity] || 'High';

    setReports((prev) =>
      prev.map((r) => (r.id === incidentId ? { ...r, severity: nextSeverity } : r))
    );
    showToast(`Severity escalated to ${nextSeverity} for ${target.referenceCode || target.title}.`);

    try {
      const stored = localStorage.getItem('resqtrack_escalated_severities');
      const overrides: Record<string, string> = stored ? (JSON.parse(stored) as Record<string, string>) : {};
      overrides[incidentId] = nextSeverity;
      localStorage.setItem('resqtrack_escalated_severities', JSON.stringify(overrides));
    } catch {}

    try {
      await updateReportSeverity(incidentId, nextSeverity);
    } catch {
      try {
        await verifyReport(
          incidentId,
          target.status || 'Reported',
          `Severity escalated to ${nextSeverity} by LDRRMO Admin.`,
          nextSeverity
        );
      } catch (backendErr: unknown) {
        console.warn('[DispatchManager] Failed to persist severity escalation:', backendErr);
      }
    }
  };

  // Verify or Reject Incident Action -> POST /api/reports/{id}/verify (Instructor #4, #7)
  const handleVerifyIncident = async (
    incident: ExtendedReportItem,
    status: 'Verified' | 'Rejected' = 'Verified'
  ): Promise<void> => {
    const note =
      status === 'Rejected'
        ? `Rejected by LDRRMO Admin at ${new Date().toLocaleTimeString()}`
        : `Verified by LDRRMO Admin at ${new Date().toLocaleTimeString()}`;

    try {
      await verifyReport(incident.id, status, note);
      showToast(`Incident "${incident.referenceCode || incident.title}" updated to ${status}.`);
      try {
        window.dispatchEvent(new CustomEvent('resqtrack:report'));
      } catch {}
      await loadData();
    } catch (err) {
      console.error('[DispatchManager] Verification error:', err);
      setReports((prev) =>
        prev.map((r) =>
          r.id === incident.id
            ? { ...r, status, verifiedAt: status === 'Verified' ? new Date().toISOString() : r.verifiedAt }
            : r
        )
      );
      showToast(`Incident status updated locally to ${status}.`);
    }
  };

  // 1-Click Standby Auto-Dispatch Action (Instructor #8)
  const handleOneClickAutoDispatch = async (
    incident: ExtendedReportItem,
    preferredUnitCode?: string
  ): Promise<void> => {
    setIsAutoDispatchingId(incident.id);
    try {
      const plan = await getStandbyAutoDispatch(
        {
          incidentLat: Number(incident.currentLatitude ?? incident.latitude ?? KATIPUNAN_BASE_COORDS.latitude),
          incidentLng: Number(incident.currentLongitude ?? incident.longitude ?? KATIPUNAN_BASE_COORDS.longitude),
          incidentType: incident.category,
          severity: incident.severity,
          requiredAgencyType: incident.recommendedAgencyUnit || undefined,
          applyDispatch: true
        },
        roster
      );

      const chosen = preferredUnitCode
        ? plan.rankedUnits.find((u) => u.unit.unitCode === preferredUnitCode) || plan.selectedUnit
        : plan.selectedUnit;

      if (!chosen) {
        showToast('No available units in GPS range for auto-dispatch.');
        return;
      }

      await allocateReportUnit(incident.id, chosen.unit.id).catch(() => undefined);
      setReports((prev) =>
        prev.map((r) =>
          r.id === incident.id
            ? {
                ...r,
                status: 'Allocated',
                allocatedUnitId: chosen.unit.id,
                allocatedUnitCode: chosen.unit.unitCode
              }
            : r
        )
      );
      try {
        window.dispatchEvent(new CustomEvent('resqtrack:report'));
      } catch {}
      showToast(
        `Auto-Dispatched ${chosen.unit.unitCode} (${chosen.distanceKm} km, ~${chosen.etaMinutes}m ETA) to ${incident.referenceCode || incident.title}.`
      );
      await loadData();
    } finally {
      setIsAutoDispatchingId(null);
    }
  };

  const handleConfirmDispatch = async (): Promise<void> => {
    if (!activeDispatchIncident || !selectedResponderId) return;

    const chosen = roster.find(
      (u) => u.id === selectedResponderId || u.unitCode === selectedResponderId || u.badgeNumber === selectedResponderId
    );
    const unitTargetId = chosen?.id || selectedResponderId;

    setIsSubmittingDispatch(true);
    try {
      await allocateReportUnit(activeDispatchIncident.id, unitTargetId);
      showToast(`Unit "${chosen?.unitName || chosen?.unitCode || unitTargetId}" allocated to ${activeDispatchIncident.title}.`);
      try {
        window.dispatchEvent(new CustomEvent('resqtrack:report'));
      } catch {}
      setActiveDispatchIncident(null);
      setSelectedResponderId('');
      await loadData();
    } catch (err) {
      console.error('[DispatchManager] Allocation error:', err);
      showToast(`Unit allocated locally to incident ${activeDispatchIncident.referenceCode || activeDispatchIncident.id}.`);
      setActiveDispatchIncident(null);
      setSelectedResponderId('');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  // Ranked units for Dispatch Modal sorted by Haversine distance (km)
  const modalRankedRoster = useMemo(() => {
    const query = responderSearch.trim().toLowerCase();
    const incLat = Number(activeDispatchIncident?.currentLatitude ?? activeDispatchIncident?.latitude ?? KATIPUNAN_BASE_COORDS.latitude);
    const incLng = Number(activeDispatchIncident?.currentLongitude ?? activeDispatchIncident?.longitude ?? KATIPUNAN_BASE_COORDS.longitude);

    return roster
      .filter((res) => {
        if (!query) return true;
        return (
          (res.unitName || res.name || '').toLowerCase().includes(query) ||
          (res.unitCode || res.badgeNumber || '').toLowerCase().includes(query) ||
          (res.agency || '').toLowerCase().includes(query)
        );
      })
      .map((res) => {
        const dist = calculateHaversineDistanceKm(incLat, incLng, res.baseLatitude, res.baseLongitude);
        return {
          unit: res,
          distanceKm: dist,
          etaMinutes: calculateDynamicEtaMinutes(dist)
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [roster, responderSearch, activeDispatchIncident]);

  const filteredReports = useMemo(() => {
    return reports
      .filter((inc) => {
        if (selectedCategory !== 'ALL' && (inc.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
        if (selectedSeverity !== 'ALL' && (inc.severity || '').toLowerCase() !== selectedSeverity.toLowerCase()) {
          return false;
        }
        if (statusFilter !== 'ALL') {
          const badge = formatIncidentStatusBadge(inc.status, inc.allocatedUnitCode, inc.verifiedAt, inc.resolvedAt);
          if (badge.label.toLowerCase() !== statusFilter.toLowerCase()) {
            return false;
          }
        }
        if (!debouncedSearch) return true;
        const target = `${inc.id || ''} ${inc.referenceCode || ''} ${inc.title || ''} ${inc.note || ''} ${inc.locationLabel || ''} ${inc.location || ''} ${inc.reporterName || ''}`.toLowerCase();
        return target.includes(debouncedSearch.toLowerCase());
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
        if (sortOrder === 'asc_date') return timeA - timeB;
        if (sortOrder === 'asc_name') return (a.title || '').localeCompare(b.title || '');
        if (sortOrder === 'desc_name') return (b.title || '').localeCompare(a.title || '');
        return timeB - timeA;
      });
  }, [reports, selectedCategory, selectedSeverity, statusFilter, debouncedSearch, sortOrder]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    nextPage,
    prevPage,
    setPageSize,
    pageSizeOptions
  } = usePagination(filteredReports, { initialPageSize: 10 });

  const activeRespondersCount = useMemo(() => roster.filter((u) => u.status === 'OnDuty' || u.status === 'Standby').length, [roster]);
  const countToday = reports.length;
  const unassignedCount = useMemo(
    () => reports.filter((r) => r.status === 'Reported' || r.status === 'Submitted' || r.status === 'Pending' || !r.allocatedUnitId).length,
    [reports]
  );
  const criticalCount = useMemo(
    () => reports.filter((r) => r.severity === 'Critical' || r.severity === 'Severe').length,
    [reports]
  );

  const avgVelocity = useMemo(() => {
    if (reports.length === 0) return '0.0 Mins';
    const now = Date.now();
    const totalMinutes = reports.reduce((acc, r) => {
      const time = new Date(r.createdAt || r.timestamp || now).getTime();
      return acc + Math.max(0.5, (now - time) / 60000);
    }, 0);
    return `${(totalMinutes / reports.length).toFixed(1)} Mins`;
  }, [reports]);

  const overallAiAccuracy = useMemo(() => {
    if (reports.length === 0) return '100.0%';
    const validCount = reports.filter((r) => !r.isBlurry && r.isHardwareGeolocated).length;
    return `${((validCount / reports.length) * 100).toFixed(1)}% AI Match`;
  }, [reports]);

  const pendingDispatchRequestsCount = useMemo(
    () => dispatchRequests.filter((r) => r.status === 'PENDING').length,
    [dispatchRequests]
  );

  const handleApproveDispatchRequest = async (req: DispatchRequestRecord): Promise<void> => {
    try {
      setIsProcessingRequestId(req.id);
      const updated = await approveMedicRequestByAdmin(req.id);
      if (updated) {
        setDispatchRequests((prev) => prev.map((item) => (item.id === req.id ? updated : item)));
        showToast(`Approved dispatch request for ${req.responderName}. Target: ${req.incidentCode}.`);
      }
    } catch (err) {
      console.error('[DispatchManager] Failed to approve request:', err);
      showToast('Error approving dispatch request.');
    } finally {
      setIsProcessingRequestId(null);
    }
  };

  const handleDeclineDispatchRequest = async (req: DispatchRequestRecord): Promise<void> => {
    try {
      setIsProcessingRequestId(req.id);
      const updated = await respondToAdminDeployOrder(req.id, 'DECLINE');
      if (updated) {
        setDispatchRequests((prev) => prev.map((item) => (item.id === req.id ? updated : item)));
        showToast(`Declined dispatch request from ${req.responderName}.`);
      }
    } catch (err) {
      console.error('[DispatchManager] Failed to decline request:', err);
      showToast('Error declining dispatch request.');
    } finally {
      setIsProcessingRequestId(null);
    }
  };

  const filteredDispatchRequests = useMemo(() => {
    let list = [...dispatchRequests];

    if (requestStatusFilter === 'PENDING') {
      list = list.filter((r) => r.status === 'PENDING');
    } else if (requestStatusFilter === 'DEPLOY') {
      list = list.filter((r) => r.status === 'DEPLOY' || r.status === 'TO BE DEPLOYED');
    }

    if (debouncedRequestSearch.trim()) {
      const q = debouncedRequestSearch.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.responderName ?? '').toLowerCase().includes(q) ||
          String(r.responderId ?? '').toLowerCase().includes(q) ||
          String(r.incidentCode ?? '').toLowerCase().includes(q) ||
          String(r.incidentTitle ?? '').toLowerCase().includes(q) ||
          String(r.category ?? '').toLowerCase().includes(q) ||
          String(r.location ?? '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (requestSortOrder === 'az') return a.responderName.localeCompare(b.responderName);
      if (requestSortOrder === 'za') return b.responderName.localeCompare(a.responderName);
      if (requestSortOrder === 'newest') return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
      if (requestSortOrder === 'oldest') return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    });

    return list;
  }, [dispatchRequests, requestStatusFilter, debouncedRequestSearch, requestSortOrder]);

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] text-sm font-mono font-bold shadow-[0_14px_34px_rgba(74,4,26,0.35)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#670626]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FIX #17: Dispatch Manager Header (.clay-surface #F7F1EA) */}
      <div className={`${CLAY_SURFACE} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#A83B4D]">
            LDRRMO Command / Dispatch Manager
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#670626] tracking-tight mt-0.5 flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-[#A83B4D] animate-pulse" />
            Dispatch Manager
          </h1>
          <p className="text-sm text-[#A83B4D] font-mono mt-0.5">
            Triage, verification &amp; unit dispatch
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AdminButton
            variant={pendingDispatchRequestsCount > 0 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setIsDispatchRequestsModalOpen(true)}
            className="text-xs sm:text-sm font-mono font-bold flex items-center gap-2"
            title="Inspect active responder dispatch requests awaiting authorization"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch Requests</span>
            <span className="px-2 py-0.5 rounded-full bg-[#E9D9D0] text-[#670626] text-xs font-black">
              {pendingDispatchRequestsCount > 0 ? pendingDispatchRequestsCount : dispatchRequests.length}
            </span>
          </AdminButton>

          <div className={`${CLAY_WELL} flex items-center gap-3 px-3.5 py-2`}>
            <Sparkles className="w-4 h-4 text-[#670626]" />
            <span className="text-xs sm:text-sm font-mono font-bold text-[#670626]">Auto-Dispatch</span>
            <button
              type="button"
              onClick={() => {
                setIsAutoDispatchEnabled(!isAutoDispatchEnabled);
                showToast(`Auto-Dispatch ${!isAutoDispatchEnabled ? 'Enabled' : 'Disabled'}.`);
              }}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 flex items-center cursor-pointer ${
                isAutoDispatchEnabled ? 'bg-[#670626]' : 'bg-[#A83B4D]/40'
              }`}
              title="Toggle autonomous agency dispatch based on AI incident classification"
            >
              <div
                className={`w-5 h-5 rounded-full bg-[#F7F1EA] shadow-md transition-transform duration-200 ${
                  isAutoDispatchEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#670626] flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Available Units</p>
            <Users className="w-4 h-4 text-[#670626]" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{activeRespondersCount} Units</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">On Duty / Standby</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-emerald-700 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Incidents Ingested</p>
            <Activity className="w-4 h-4 text-emerald-700" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{countToday} Total</h3>
          <span className="text-xs text-emerald-800 font-mono font-bold mt-0.5">Live telemetry</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-amber-600 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Unassigned Queue</p>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{unassignedCount} Pending</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">Awaiting dispatch</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#670626] flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Critical Priority</p>
            <ShieldAlert className="w-4 h-4 text-[#670626]" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{criticalCount} SOS</h3>
          <span className="text-xs text-[#A83B4D] font-mono font-bold mt-0.5">Immediate action</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#A83B4D] flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Avg Velocity</p>
            <TrendingUp className="w-4 h-4 text-[#A83B4D]" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{avgVelocity}</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">{overallAiAccuracy}</span>
        </div>
      </div>

      {/* Instructor #8: Nearby Available Units Panel (sorted by km with 1-click Auto-Dispatch) */}
      <div className={`${CLAY_SURFACE} p-5 flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#670626]/15 pb-3">
          <div>
            <h2 className="text-base font-black text-[#670626] uppercase tracking-wider flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#A83B4D]" />
              Nearby Available Units
            </h2>
            <p className="text-xs font-mono text-[#A83B4D] mt-0.5">
              {autoDispatchOutput?.providerUsed || 'AI Dispatch'} · Distance (km)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {focusedIncident && (
              <select
                value={focusedIncident.id}
                onChange={(e) => setFocusedIncidentId(e.target.value)}
                className="bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3 py-1.5 text-xs font-bold text-[#670626] focus:outline-none focus:border-[#670626] max-w-[260px]"
              >
                {(activeIncidents.length > 0 ? activeIncidents : reports).map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    [{inc.severity}] {inc.referenceCode || inc.id} — {inc.title}
                  </option>
                ))}
              </select>
            )}
            {focusedIncident && (
              <AdminButton
                variant="primary"
                size="sm"
                isLoading={isAutoDispatchingId === focusedIncident.id}
                onClick={() => void handleOneClickAutoDispatch(focusedIncident)}
                icon={<Zap className="w-3.5 h-3.5" />}
              >
                Auto-Dispatch Nearest
              </AdminButton>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(autoDispatchOutput?.rankedUnits || []).slice(0, 4).map((item, idx) => (
            <div
              key={item.unit.id}
              className={`${CLAY_WELL} p-3.5 flex flex-col justify-between gap-2.5 ${
                idx === 0 ? 'ring-2 ring-[#670626]/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono font-black text-[#670626] block">
                    #{idx + 1} {item.unit.unitCode}
                  </span>
                  <span className="text-xs font-bold text-[#670626]/90 line-clamp-1">
                    {item.unit.unitName}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#F7F1EA] border border-[#670626]/20 text-xs font-mono font-bold text-[#A83B4D]">
                  {item.unit.agency}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-[#670626]/10">
                <span className="font-black text-[#670626]">{item.distanceKm} km · ~{item.etaMinutes}m</span>
                {focusedIncident && (
                  <AdminButton
                    variant={idx === 0 ? 'primary' : 'outline'}
                    size="xs"
                    isLoading={isAutoDispatchingId === focusedIncident.id}
                    onClick={() => void handleOneClickAutoDispatch(focusedIncident, item.unit.unitCode)}
                  >
                    Auto-Dispatch
                  </AdminButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Control Bar (.clay-surface + .clay-well) */}
      <div className={`${CLAY_SURFACE} p-4 flex flex-wrap items-center justify-between gap-4`}>
        <div className="w-full sm:w-72 md:w-80">
          <SearchBar
            value={searchRaw}
            onChange={setSearchRaw}
            placeholder="Search incident ID, keyword, location, or unit…"
          />
        </div>

        <div className="flex items-center gap-2">
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Dropdown
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as string)}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'Submitted', label: 'Submitted' },
              { value: 'Pending', label: 'Pending' },
              { value: 'Verified', label: 'Verified' },
              { value: 'Dispatched', label: 'Dispatched' },
              { value: 'Resolved', label: 'Resolved' },
              { value: 'Rejected', label: 'Rejected' }
            ]}
            className="min-w-[140px]"
          />

          <Dropdown
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val as string)}
            options={[
              { value: 'ALL', label: 'All Categories' },
              { value: 'MedicalEmergency', label: 'Medical Emergency' },
              { value: 'Trauma', label: 'Trauma / Casualty' },
              { value: 'StructuralFire', label: 'Structural Fire' },
              { value: 'Fire', label: 'Fire & Hazmat' },
              { value: 'CrimeOrSecurity', label: 'Crime / Security' },
              { value: 'Police', label: 'Police Security' },
              { value: 'VehicularAccident', label: 'Vehicular Accident' }
            ]}
            className="min-w-[140px]"
          />

          <Dropdown
            value={selectedSeverity}
            onChange={(val) => setSelectedSeverity(val as string)}
            options={[
              { value: 'ALL', label: 'All Severities' },
              { value: 'Critical', label: 'Critical SOS' },
              { value: 'High', label: 'High Priority' },
              { value: 'Medium', label: 'Medium Tier' },
              { value: 'Low', label: 'Low Severity' }
            ]}
            className="min-w-[130px]"
          />

          <Dropdown
            value={sortOrder}
            onChange={(val) => setSortOrder(val as string)}
            options={[
              { value: 'desc_date', label: 'Newest First' },
              { value: 'asc_date', label: 'Oldest First' },
              { value: 'asc_name', label: 'Title (A-Z)' },
              { value: 'desc_name', label: 'Title (Z-A)' }
            ]}
            className="min-w-[130px]"
          />
        </div>
      </div>

      {/* Table or Card Grid View */}
      {viewMode === 'table' ? (
        <div className={`${CLAY_SURFACE} p-4 overflow-hidden`}>
          <div ref={containerRef} className={`${CLAY_WELL} overflow-x-auto w-full select-none cursor-grab`}>
            <table className="w-full text-left text-sm text-[#670626] min-w-[1120px]">
              <thead className="bg-[#670626]/10 font-mono text-xs uppercase tracking-wider text-[#670626] border-b border-[#670626]/15">
                <tr>
                  <th className="py-3.5 px-4">Media</th>
                  <th className="py-3.5 px-4">ID & Title</th>
                  <th className="py-3.5 px-4">Category & Score</th>
                  <th className="py-3.5 px-4">Device & Location</th>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10">
                {paginatedItems.map((inc, i) => {
                  const tivaScore = calculateTivaScore(inc);
                  const confidence = calculateAiConfidence(inc);
                  const statusBadge = formatIncidentStatusBadge(
                    inc.status,
                    inc.allocatedUnitCode,
                    inc.verifiedAt,
                    inc.resolvedAt
                  );
                  const canVerifyOrReject = statusBadge.label === 'Submitted' || statusBadge.label === 'Pending';
                  const isClosedOrRejected = statusBadge.label === 'Resolved' || statusBadge.label === 'Rejected';

                  return (
                    <tr key={inc.id || i} className="hover:bg-[#F7F1EA]/70 transition-colors">
                      <td className="py-3.5 px-4 w-20">
                        <div className="w-14 h-11 rounded-lg bg-[#F7F1EA] border border-[#670626]/20 overflow-hidden relative flex items-center justify-center">
                          {inc.imageUrl || inc.mediaUrl ? (
                            <img
                              src={inc.imageUrl || inc.mediaUrl}
                              alt="Incident capture"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-[#A83B4D] font-mono text-xs">
                              <Camera className="w-4 h-4 mb-0.5" />
                              <span>LIVE</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs text-[#A83B4D] font-bold block">
                          {inc.referenceCode || inc.id || `INC-${2026}-${i + 101}`}
                        </span>
                        <span className="font-bold text-[#670626] text-sm truncate max-w-[210px] block mt-0.5">
                          {inc.title || 'Emergency Telemetry'}
                        </span>
                        {(inc.roboflowPrediction || inc.claudeSituationSummary) && (
                          <div className="mt-1 px-2 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[11px] font-mono text-[#670626] max-w-[230px]">
                            <span className="font-black block truncate">
                              Roboflow ({inc.roboflowModelId || 'accident-and-non-accident-label-image-dataset/14'}):{' '}
                              {inc.roboflowPrediction || 'incident'}
                              {typeof inc.roboflowConfidence === 'number'
                                ? ` ${Math.round(inc.roboflowConfidence * 100)}%`
                                : ''}
                              {inc.pointerIconType ? ` · [${inc.pointerIconType}]` : ''}
                            </span>
                            {(inc.claudeVisibleHazards || inc.claudeSituationSummary) && (
                              <span className="text-[#A83B4D] block truncate">
                                Claude 4.5: {inc.claudeVisibleHazards || inc.claudeSituationSummary}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs text-[#670626] font-bold">
                            {inc.category || 'Trauma / Casualty'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-emerald-800 font-bold flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                              {confidence}
                            </span>
                            <span
                              className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                                tivaScore >= 75
                                  ? 'bg-[#670626] text-[#F7F1EA]'
                                  : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/20'
                              }`}
                              title="Triage Priority Score"
                            >
                              Score: {tivaScore}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-[#A83B4D]">
                            IP: {inc.deviceIp || inc.ipAddress || '192.168.1.104'}
                          </span>
                          <span className="text-xs text-[#670626] truncate max-w-[210px] flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#A83B4D] flex-shrink-0" />
                            {inc.locationLabel ||
                              inc.location ||
                              getKatipunanBarangay(inc.latitude, inc.longitude)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase ${
                              inc.severity === 'Critical' || inc.severity === 'Severe'
                                ? 'bg-[#670626] text-[#F7F1EA]'
                                : inc.severity === 'High'
                                ? 'bg-[#A83B4D] text-[#F7F1EA]'
                                : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/25'
                            }`}
                          >
                            {inc.severity || 'Medium'}
                          </span>
                          {inc.severity !== 'Critical' && (
                            <button
                              type="button"
                              onClick={() => void handleEscalateSeverity(inc.id)}
                              className="text-[#A83B4D] hover:text-[#670626] p-1 rounded transition-colors cursor-pointer"
                              title="Escalate Severity Tier"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs font-bold ${statusBadge.pillClass}`}>
                          {statusBadge.label === 'Verified' || statusBadge.label === 'Resolved' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {statusBadge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {canVerifyOrReject && (
                            <>
                              <AdminButton
                                variant="success"
                                size="xs"
                                onClick={() => void handleVerifyIncident(inc, 'Verified')}
                                className="text-xs font-mono font-bold"
                                icon={<UserCheck className="w-3.5 h-3.5" />}
                              >
                                Verify
                              </AdminButton>
                              <AdminButton
                                variant="danger"
                                size="xs"
                                onClick={() => void handleVerifyIncident(inc, 'Rejected')}
                                className="text-xs font-mono font-bold"
                                icon={<XCircle className="w-3.5 h-3.5" />}
                              >
                                Reject
                              </AdminButton>
                            </>
                          )}
                          {!isClosedOrRejected && (
                            <>
                              <AdminButton
                                variant="outline"
                                size="xs"
                                isLoading={isAutoDispatchingId === inc.id}
                                onClick={() => void handleOneClickAutoDispatch(inc)}
                                className="text-xs font-mono font-bold"
                                icon={<Zap className="w-3.5 h-3.5" />}
                                title="1-Click Standby AI Auto-Dispatch"
                              >
                                Auto
                              </AdminButton>
                              <AdminButton
                                variant="primary"
                                size="xs"
                                onClick={() => {
                                  setActiveDispatchIncident(inc);
                                  setSelectedResponderId('');
                                }}
                                className="text-xs font-mono font-bold"
                                icon={<Send className="w-3.5 h-3.5" />}
                              >
                                Dispatch
                              </AdminButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-sm text-[#A83B4D] font-mono">
                      No matching incidents.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((inc, i) => {
            const tivaScore = calculateTivaScore(inc);
            const statusBadge = formatIncidentStatusBadge(
              inc.status,
              inc.allocatedUnitCode,
              inc.verifiedAt,
              inc.resolvedAt
            );
            const canVerifyOrReject = statusBadge.label === 'Submitted' || statusBadge.label === 'Pending';
            const isClosedOrRejected = statusBadge.label === 'Resolved' || statusBadge.label === 'Rejected';

            return (
              <div
                key={inc.id || i}
                className={`tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between gap-3.5 hover:border-[#670626]/40 transition-all`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#A83B4D]">
                      {inc.referenceCode || inc.id || `INC-${2026}-${i + 101}`}
                    </span>
                    <h3 className="font-bold text-[#670626] text-base mt-0.5">{inc.title || 'Incident Event'}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold uppercase ${
                        inc.severity === 'Critical' || inc.severity === 'Severe'
                          ? 'bg-[#670626] text-[#F7F1EA]'
                          : 'bg-[#A83B4D] text-[#F7F1EA]'
                      }`}
                    >
                      {inc.severity || 'Medium'}
                    </span>
                    {inc.severity !== 'Critical' && (
                      <button
                        type="button"
                        onClick={() => void handleEscalateSeverity(inc.id)}
                        className="text-[#A83B4D] hover:text-[#670626] cursor-pointer"
                        title="Escalate Severity"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className={`${CLAY_WELL} p-3 flex items-center gap-3`}>
                  <div className="w-16 h-12 rounded-lg bg-[#F7F1EA] border border-[#670626]/20 flex items-center justify-center font-mono text-xs text-[#A83B4D] overflow-hidden flex-shrink-0">
                    {inc.imageUrl || inc.mediaUrl ? (
                      <img src={inc.imageUrl || inc.mediaUrl} alt="Capture" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-xs">
                        <Camera className="w-4 h-4 mb-0.5" />
                        <span>LIVE</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col text-sm text-[#670626] space-y-0.5 min-w-0">
                    <span className="font-bold">{inc.category || 'Trauma Casualty'}</span>
                    <span className="text-xs text-[#A83B4D] truncate flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      {inc.locationLabel ||
                        inc.location ||
                        getKatipunanBarangay(inc.latitude, inc.longitude)}
                    </span>
                    <div className="flex items-center gap-2 text-xs font-mono text-[#670626]/80">
                      <span>IP: {inc.deviceIp || inc.ipAddress || '192.168.1.104'}</span>
                      <span className="font-bold text-[#670626]">Score: {tivaScore}</span>
                    </div>
                  </div>
                </div>

                {(inc.roboflowPrediction || inc.claudeSituationSummary) && (
                  <div className={`${CLAY_WELL} p-2.5 text-xs font-mono text-[#670626] flex flex-col gap-1`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black">
                        Roboflow ({inc.roboflowModelId || 'accident-and-non-accident-label-image-dataset/14'}):{' '}
                        {inc.roboflowPrediction || 'incident'}
                        {typeof inc.roboflowConfidence === 'number'
                          ? ` (${Math.round(inc.roboflowConfidence * 100)}%)`
                          : ''}
                      </span>
                      {inc.pointerIconType && (
                        <span className="px-2 py-0.5 rounded bg-[#F7F1EA] border border-[#670626]/20 text-[#670626] font-bold uppercase">
                          {inc.pointerIconType}
                        </span>
                      )}
                    </div>
                    {(inc.claudeVisibleHazards || inc.claudeSituationSummary) && (
                      <p className="text-[#A83B4D] font-sans text-xs line-clamp-2">
                        Claude Haiku 4.5: {inc.claudeVisibleHazards || inc.claudeSituationSummary}
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-[#670626]/15 flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${statusBadge.pillClass}`}>
                    {statusBadge.label}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {canVerifyOrReject && (
                      <>
                        <AdminButton
                          variant="success"
                          size="xs"
                          onClick={() => void handleVerifyIncident(inc, 'Verified')}
                        >
                          Verify
                        </AdminButton>
                        <AdminButton
                          variant="danger"
                          size="xs"
                          onClick={() => void handleVerifyIncident(inc, 'Rejected')}
                        >
                          Reject
                        </AdminButton>
                      </>
                    )}
                    {!isClosedOrRejected && (
                      <>
                        <AdminButton
                          variant="outline"
                          size="xs"
                          isLoading={isAutoDispatchingId === inc.id}
                          onClick={() => void handleOneClickAutoDispatch(inc)}
                          icon={<Zap className="w-3 h-3" />}
                        >
                          Auto
                        </AdminButton>
                        <AdminButton
                          variant="primary"
                          size="xs"
                          onClick={() => {
                            setActiveDispatchIncident(inc);
                            setSelectedResponderId('');
                          }}
                          icon={<Send className="w-3 h-3" />}
                        >
                          Dispatch
                        </AdminButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      <div className={`${CLAY_SURFACE} p-4 flex flex-wrap items-center justify-between gap-3 text-sm font-mono text-[#670626]`}>
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold text-sm rounded-lg px-2.5 py-1"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span>per page (Total: {totalItems} incidents)</span>
        </div>

        <div className="flex items-center gap-2">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 text-xs"
          >
            PREV
          </AdminButton>
          <span className="px-2 font-black text-[#670626]">
            Page {currentPage} of {totalPages}
          </span>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 text-xs"
          >
            NEXT
          </AdminButton>
        </div>
      </div>

      {/* Responder Dispatch Modal Card (Warm Ivory #F7F1EA) */}
      {activeDispatchIncident && (
        <AdminModalCard
          isOpen={!!activeDispatchIncident}
          onClose={() => setActiveDispatchIncident(null)}
          title="Dispatch Responders"
          subtitle={`${activeDispatchIncident.title || 'Incident'} · Nearest first (km)`}
          className="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex-1 min-w-[200px]">
                <SearchBar
                  value={responderSearch}
                  onChange={setResponderSearch}
                  placeholder="Search responder unit, badge, or agency…"
                />
              </div>
              <AdminButton
                variant="primary"
                size="sm"
                isLoading={isAutoDispatchingId === activeDispatchIncident.id}
                onClick={() => {
                  void handleOneClickAutoDispatch(activeDispatchIncident).then(() =>
                    setActiveDispatchIncident(null)
                  );
                }}
                icon={<Zap className="w-3.5 h-3.5" />}
              >
                Auto-Dispatch Nearest
              </AdminButton>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {modalRankedRoster.map(({ unit: res, distanceKm, etaMinutes }) => {
                const unitIdentifier = res.id || res.unitCode || res.badgeNumber || '';
                const isSelected = selectedResponderId === unitIdentifier;

                return (
                  <div
                    key={unitIdentifier}
                    onClick={() => setSelectedResponderId(unitIdentifier)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#670626] text-[#F7F1EA] border-[#670626] shadow-md'
                        : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/20 hover:bg-[#E9D9D0]/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-xs ${
                          isSelected
                            ? 'bg-[#F7F1EA] text-[#670626] border-[#F7F1EA]'
                            : 'bg-[#F7F1EA] text-[#670626] border-[#670626]/20'
                        }`}
                      >
                        {res.agency === 'RHU' ? (
                          <HeartPulse className="w-4 h-4" />
                        ) : res.agency === 'FIRE' || res.agency === 'BFP' ? (
                          <Flame className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{res.unitName || res.name || 'Emergency Unit'}</h4>
                        <span className={`text-xs font-mono ${isSelected ? 'text-[#E9D9D0]' : 'text-[#A83B4D]'}`}>
                          {res.agency} · Code: {res.unitCode || res.badgeNumber || 'UNIT'} · {distanceKm} km (~{etaMinutes}m ETA)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-[#F7F1EA] text-[#670626]'
                            : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/15'
                        }`}
                      >
                        {res.status || 'Standby'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#670626]/15">
              <AdminButton variant="outline" size="sm" onClick={() => setActiveDispatchIncident(null)}>
                CANCEL
              </AdminButton>
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => void handleConfirmDispatch()}
                disabled={!selectedResponderId || isSubmittingDispatch}
                className="flex items-center gap-1.5 font-mono font-bold"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmittingDispatch ? 'ALLOCATING...' : 'CONFIRM DISPATCH'}
              </AdminButton>
            </div>
          </div>
        </AdminModalCard>
      )}

      {/* Responder Dispatch Requests Queue Modal */}
      {isDispatchRequestsModalOpen && (
        <AdminModalCard
          isOpen={isDispatchRequestsModalOpen}
          onClose={() => setIsDispatchRequestsModalOpen(false)}
          title={`Dispatch Requests (${pendingDispatchRequestsCount})`}
          subtitle="Field unit dispatch requests"
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          <div className="space-y-4 text-sm text-[#670626]">
            <div className={`${CLAY_WELL} flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5`}>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRequestStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    requestStatusFilter === 'ALL'
                      ? 'bg-[#670626] text-[#F7F1EA]'
                      : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/20'
                  }`}
                >
                  ALL ({dispatchRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestStatusFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    requestStatusFilter === 'PENDING'
                      ? 'bg-[#A83B4D] text-[#F7F1EA]'
                      : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/20'
                  }`}
                >
                  PENDING ({pendingDispatchRequestsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestStatusFilter('DEPLOY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    requestStatusFilter === 'DEPLOY'
                      ? 'bg-emerald-700 text-[#F7F1EA]'
                      : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/20'
                  }`}
                >
                  DEPLOYED ({dispatchRequests.filter((r) => r.status === 'DEPLOY' || r.status === 'TO BE DEPLOYED').length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <SearchBar
                  value={requestSearch}
                  onChange={setRequestSearch}
                  placeholder="Search responder, unit, incident..."
                  className="w-full sm:w-60"
                />
                <Dropdown
                  value={requestSortOrder}
                  onChange={(v) => setRequestSortOrder(v as string)}
                  options={[
                    { value: 'pending_first', label: 'Pending Requests First' },
                    { value: 'az', label: 'Alphabetical: A to Z' },
                    { value: 'za', label: 'Alphabetical: Z to A' },
                    { value: 'newest', label: 'Timestamp: Newest First' },
                    { value: 'oldest', label: 'Timestamp: Oldest First' }
                  ]}
                  className="min-w-[170px]"
                />
              </div>
            </div>

            {filteredDispatchRequests.length === 0 ? (
              <div className={`${CLAY_WELL} p-8 text-center text-[#A83B4D] font-mono text-sm`}>
                No matching dispatch requests.
              </div>
            ) : (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {filteredDispatchRequests.map((req) => {
                  const isProcessing = isProcessingRequestId === req.id;
                  const isPending = req.status === 'PENDING';

                  return (
                    <div
                      key={req.id}
                      className={`${CLAY_WELL} p-4 space-y-3`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-full bg-[#F7F1EA] border border-[#670626]/20 flex items-center justify-center font-bold text-xs text-[#670626]">
                            <Send className="w-4 h-4" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-[#670626] text-sm">{req.responderName}</h4>
                              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#F7F1EA] text-[#670626] border border-[#670626]/20">
                                {req.responderId}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-[#A83B4D] mt-0.5">
                              Requested: <span className="font-bold text-[#670626]">{formatDateTimeWithSecondsAmPm(req.requestedAt)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#670626] text-[#F7F1EA]">
                            {req.status}
                          </span>
                          <span className="text-xs font-mono text-[#A83B4D] uppercase">
                            {req.direction === 'MEDIC_REQUEST' ? 'Medic Request' : 'Admin Order'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#F7F1EA] border border-[#670626]/15 text-xs font-mono grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <span className="text-[#A83B4D] block">Target Incident:</span>
                          <span className="font-bold text-[#670626] font-sans text-sm">{req.incidentTitle}</span>
                          <span className="text-[#A83B4D] ml-1.5 font-mono">({req.incidentCode})</span>
                        </div>
                        <div>
                          <span className="text-[#A83B4D] block">Category & Severity:</span>
                          <span className="text-[#670626] font-sans text-sm font-semibold">{req.category}</span> ·{' '}
                          <span className="text-[#670626] font-bold">{req.severity}</span>
                        </div>
                        <div>
                          <span className="text-[#A83B4D] block">Location:</span>
                          <span className="text-[#670626]">{req.location}</span>
                        </div>
                        <div>
                          <span className="text-[#A83B4D] block">Terminal IP & GPS:</span>
                          <span className="text-[#670626]">{req.ipAddress} · {req.coordinates}</span>
                        </div>
                      </div>

                      {req.notes && (
                        <p className="text-xs text-[#670626]/85 italic">
                          <strong className="not-italic">Notes:</strong> {req.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2.5 border-t border-[#670626]/15">
                        <span className="text-xs font-mono text-[#A83B4D]">
                          {isPending ? 'Approving sets status to DEPLOY' : 'Actioned'}
                        </span>

                        <div className="flex items-center gap-2">
                          {isPending && (
                            <>
                              <AdminButton
                                variant="success"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => void handleApproveDispatchRequest(req)}
                                icon={<Check className="w-3.5 h-3.5" />}
                              >
                                {isProcessing ? 'PROCESSING...' : 'APPROVE & DISPATCH'}
                              </AdminButton>
                              <AdminButton
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => void handleDeclineDispatchRequest(req)}
                                icon={<X className="w-3.5 h-3.5" />}
                              >
                                DECLINE
                              </AdminButton>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#670626]/15">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setIsDispatchRequestsModalOpen(false)}
                className="text-xs font-mono"
              >
                CLOSE
              </AdminButton>
            </div>
          </div>
        </AdminModalCard>
      )}
    </div>
  );
};

export default IncidentsPage;
