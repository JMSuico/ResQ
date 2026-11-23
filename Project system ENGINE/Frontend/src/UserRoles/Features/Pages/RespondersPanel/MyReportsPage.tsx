// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Responder Incident Logs & Reports console strictly backed by PostgreSQL APIs
// (/api/reports, /api/reports/mine, /api/reports/agency/{unit}, /api/reports/{id}/evidences, /api/responder-ops/pcr).
// ZERO localStorage shadowing, ZERO baselineFixtures, ZERO fabricated PCR records, ZERO hardcoded IPs.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  getAllReports,
  getMyReports,
  getAgencyReports,
  getReportEvidences,
  uploadReportEvidence,
  createReport,
  verifyReport,
  ReportEvidenceRecordDto,
  ReportItem,
  TaggedColleagueItem,
  ClosureEvidenceSubmissionResult
} from '@/Endpoints/reportsApi';
import {
  getPcrRecords,
  submitPcrRecord,
  PatientCareRecord,
  ColleagueResponderItem
} from '@/Endpoints/responderOpsApi';
import { resolveStreetAddressSync } from '@/Libs/Map/addressResolver';
import { computeTwoMinFadeSecondsLeft } from '@/Endpoints/analyticsApi';
import {
  useSession,
  useGpsLocation,
  useValueRefreshAuto,
  useDebounce,
  usePagination
} from '@/Hooks';
import {
  SearchBar,
  TableCardToggle,
  useTableCardView,
  DefaultFloatingModalCard,
  CameraCaptureModal,
  CameraCaptureMetadata,
  ImageLightboxModal,
  Button,
  ResponderClosureEvidenceModal,
  ColleagueMentionPicker
} from '@/Shared';
import { formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';
import {
  Camera,
  ClipboardList,
  MapPin,
  Radio,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Activity,
  ShieldCheck,
  HeartPulse,
  Lock,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Globe,
  Crosshair,
  FileText,
  Layers,
  Check,
  XCircle,
  Send,
  Trash2,
  Timer
} from 'lucide-react';

const TWO_MINUTES_MS = 2 * 60 * 1000;
const MAX_EVIDENCE_PHOTOS = 40;

export interface EvidencePhotoItem {
  id: string;
  url: string;
  timestamp: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
}

export interface CasualtyVitalsEntry {
  id: string;
  patientName: string;
  age: number;
  gender: string;
  triageTag?: string;
  levelOfConsciousness: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRateBpm: number;
  respiratoryRate: number;
  spO2Percent: number;
  temperatureCelsius: number;
  bloodGlucoseMgDl?: number;
  chiefComplaint: string;
  interventions: string[];
  anatomicalInjuries?: string[];
  narrative?: string;
  recordedAt?: string;
}

interface DraftCasualtyInput {
  id: string;
  patientName: string;
  age: string;
  gender: string;
  levelOfConsciousness: string;
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  heartRateBpm: string;
  respiratoryRate: string;
  spO2Percent: string;
  temperatureCelsius: string;
  chiefComplaint: string;
}

export interface IncidentLogEntry {
  id: string;
  referenceCode: string;
  title: string;
  note: string;
  category: string;
  severity: string;
  status: 'Dispatched' | 'EnRoute' | 'OnScene' | 'Responded' | 'Verified' | 'Resolved' | 'Closed' | string;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy?: string;
  isClosed: boolean;
  closedAt: string | null;
  latitude: number;
  longitude: number;
  locationLabel: string;
  ipAddress: string;
  responderName: string;
  responderId: string;
  unitCode: string;
  createdAt: string;
  casualties: CasualtyVitalsEntry[];
  evidencePhotos: EvidencePhotoItem[];
  isHardwareGeolocated: boolean;
  aiAutoApproved?: boolean;
  aiVerificationStatus?: string | null;
  resolvedAt?: string | null;
  closureSummary?: string | null;
  closureApprovalMode?: string | null;
  taggedColleagues?: TaggedColleagueItem[];
  rawReport?: ReportItem;
}

type LogFilterTab = 'ALL_LOGS' | 'ACTIVE_IN_ACTION' | 'WORKING_PROGRESS' | 'CLOSED_SOLVED';
type LogSortMode = 'NEWEST' | 'OLDEST' | 'SEVERITY';

export const formatEvidenceTimestampExact = (input?: string | number | Date | null): string => {
  const dateObj = input ? new Date(input) : new Date();
  if (Number.isNaN(dateObj.getTime())) {
    if (typeof input === 'string' && input.trim().length > 0) return input;
    return formatEvidenceTimestampExact(new Date());
  }
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const rawHours = dateObj.getHours();
  const ampm = rawHours >= 12 ? 'PM' : 'AM';
  const hh12 = String(rawHours % 12 || 12).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  const sec = String(dateObj.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh12}:${min}:${sec} ${ampm}`;
};

export const formatMmSs = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(clamped / 60)).padStart(2, '0');
  const secs = String(clamped % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

export { computeTwoMinFadeSecondsLeft };

const getLogStatusMeta = (log: IncidentLogEntry): {
  label: string;
  pillClass: string;
} => {
  const s = (log.status || 'Submitted').trim().toLowerCase();
  if (s === 'rejected' || s === 'declined') {
    return {
      label: 'Rejected',
      pillClass: 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
    };
  }
  if (s === 'resolved' || s === 'closed' || s === 'completed' || log.isClosed) {
    return {
      label: 'Done',
      pillClass: 'bg-emerald-100 border-emerald-700/30 text-emerald-900'
    };
  }
  if (s === 'inprogress' || s === 'in_progress' || s === 'working progress') {
    return {
      label: 'Working Progress',
      pillClass: 'bg-amber-100 border-amber-700/30 text-amber-900'
    };
  }
  if (s === 'dispatched' || s === 'allocated' || s === 'enroute' || s === 'onscene') {
    return {
      label: 'Dispatched',
      pillClass: 'bg-[#A83B4D] border-[#A83B4D] text-[#F7F1EA]'
    };
  }
  if (s === 'verified' || s === 'responded' || log.isVerified) {
    const isAi =
      Boolean(log.aiAutoApproved) ||
      String(log.aiVerificationStatus || '').trim().toLowerCase() === 'autoapproved';
    return {
      label: isAi ? 'AI Auto-Approved' : 'Manual Approved',
      pillClass: 'bg-sky-100 border-sky-700/30 text-sky-900'
    };
  }
  return {
    label: 'Submitted',
    pillClass: 'bg-[#E9D9D0] border-[#A83B4D]/45 text-[#670626]'
  };
};

const getClaySeverityBadge = (severity: string): string => {
  const s = (severity || '').toLowerCase();
  if (s === 'critical') return 'bg-rose-100 text-rose-900 border-rose-700/35';
  if (s === 'high' || s === 'severe') return 'bg-orange-100 text-orange-900 border-orange-700/35';
  if (s === 'medium') return 'bg-amber-100 text-amber-900 border-amber-700/35';
  return 'bg-emerald-100 text-emerald-900 border-emerald-700/35';
};

const getAgencyHeaderMeta = (unit: string): { eyebrow: string; title: string; badgeClass: string } => {
  if (unit === 'FIRE') {
    return {
      eyebrow: 'BFP Fire Protection',
      title: 'Reports',
      badgeClass: 'bg-orange-100 text-orange-900 border-orange-700/35'
    };
  }
  if (unit === 'PNP') {
    return {
      eyebrow: 'PNP Police',
      title: 'Incident Logs',
      badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-700/35'
    };
  }
  return {
    eyebrow: 'RHU EMS',
    title: 'Incident Logs',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-700/35'
  };
};

const normalizeStatusForActiveFormula = (status: string): string => {
  const s = (status || '').trim();
  if (
    s === 'Submitted' ||
    s === 'Verified' ||
    s === 'Rejected' ||
    s === 'Dispatched' ||
    s === 'EnRoute' ||
    s === 'OnScene' ||
    s === 'Responded' ||
    s === 'InProgress' ||
    s === 'Resolved' ||
    s === 'Closed'
  ) {
    return s;
  }
  if (s === 'Reported') return 'Submitted';
  if (s === 'Allocated' || s === 'Active') return 'Dispatched';
  return 'Submitted';
};

const isAwaitingVerificationStatus = (status: string): boolean => {
  const s = (status || '').trim().toLowerCase();
  return s === 'submitted' || s === 'reported';
};

const createEmptyDraftCasualty = (): DraftCasualtyInput => ({
  id: `cas-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  patientName: '',
  age: '',
  gender: 'Male',
  levelOfConsciousness: 'Alert',
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  heartRateBpm: '',
  respiratoryRate: '',
  spO2Percent: '',
  temperatureCelsius: '',
  chiefComplaint: ''
});

export const MyReportsPage: React.FC = () => {
  const { session } = useSession();
  const { coords, isHardwareGeolocated, resolvedAddress } = useGpsLocation();
  const { viewMode, setViewMode } = useTableCardView('card');

  const activeAgencyUnit = (
    session?.unit && session.unit !== 'None'
      ? session.unit
      : (typeof window !== 'undefined' ? sessionStorage.getItem('resqtrack_unit') : null) || 'RHU'
  ).toUpperCase();
  const agencyHeaderMeta = getAgencyHeaderMeta(activeAgencyUnit);

  const defaultCategoryForUnit =
    activeAgencyUnit === 'FIRE'
      ? 'StructuralFire'
      : activeAgencyUnit === 'PNP'
      ? 'CrimeOrSecurity'
      : 'MedicalEmergency';

  const [logs, setLogs] = useState<IncidentLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [activeTab, setActiveTab] = useState<LogFilterTab>('ALL_LOGS');
  const [sortMode, setSortMode] = useState<LogSortMode>('NEWEST');

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [closureTargetReport, setClosureTargetReport] = useState<ReportItem | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraTargetLogId, setCameraTargetLogId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const [newTitle, setNewTitle] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [newLocationLabel, setNewLocationLabel] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<string>('Critical');
  const [newCategory, setNewCategory] = useState<string>(defaultCategoryForUnit);
  const [taggedColleagues, setTaggedColleagues] = useState<ColleagueResponderItem[]>([]);
  const [capturedPhotos, setCapturedPhotos] = useState<EvidencePhotoItem[]>([]);
  const [newCasualties, setNewCasualties] = useState<DraftCasualtyInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const autoAddr = resolvedAddress || resolveStreetAddressSync(coords.latitude, coords.longitude);
    if (!newLocationLabel.trim() && autoAddr) {
      setNewLocationLabel(autoAddr);
    }
  }, [resolvedAddress, coords.latitude, coords.longitude, newLocationLabel]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  }, []);

  const loadAllIncidentLogs = useCallback(async () => {
    try {
      const [myReportsRes, agencyReportsRes, allReportsRes, pcrRes] = await Promise.allSettled([
        getMyReports(),
        getAgencyReports(session?.unit && session.unit !== 'None' ? session.unit : 'RHU'),
        getAllReports(),
        getPcrRecords()
      ]);

      const rawReports: ReportItem[] = [];
      if (myReportsRes.status === 'fulfilled' && Array.isArray(myReportsRes.value)) {
        rawReports.push(...myReportsRes.value);
      }
      if (agencyReportsRes.status === 'fulfilled' && Array.isArray(agencyReportsRes.value)) {
        rawReports.push(...agencyReportsRes.value);
      }
      if (allReportsRes.status === 'fulfilled' && Array.isArray(allReportsRes.value)) {
        rawReports.push(...allReportsRes.value);
      }

      const pcrList: PatientCareRecord[] =
        pcrRes.status === 'fulfilled' && Array.isArray(pcrRes.value) ? pcrRes.value : [];

      const pcrByReportId: Record<string, CasualtyVitalsEntry[]> = {};
      pcrList.forEach((pcr) => {
        const key = pcr.reportId || pcr.id;
        if (!pcrByReportId[key]) pcrByReportId[key] = [];
        pcrByReportId[key].push({
          id: pcr.id,
          patientName: pcr.patientName,
          age: pcr.age,
          gender: pcr.gender,
          triageTag: pcr.spO2Percent < 92 || pcr.heartRateBpm > 120 ? 'RED — IMMEDIATE' : 'YELLOW — DELAYED',
          levelOfConsciousness: pcr.levelOfConsciousness,
          bloodPressureSystolic: pcr.bloodPressureSystolic,
          bloodPressureDiastolic: pcr.bloodPressureDiastolic,
          heartRateBpm: pcr.heartRateBpm,
          respiratoryRate: pcr.respiratoryRate,
          spO2Percent: pcr.spO2Percent,
          temperatureCelsius: pcr.temperatureCelsius,
          bloodGlucoseMgDl: pcr.bloodGlucoseMgDl,
          chiefComplaint: pcr.chiefComplaint || pcr.narrative || '',
          interventions: Array.isArray(pcr.interventions) ? pcr.interventions : [],
          anatomicalInjuries: Array.isArray(pcr.anatomicalInjuries) ? pcr.anatomicalInjuries : [],
          narrative: pcr.narrative,
          recordedAt: formatEvidenceTimestampExact(pcr.createdAt)
        });
      });

      const deduplicatedMap = new Map<string, ReportItem>();
      rawReports.forEach((r) => {
        if (r && r.id && !deduplicatedMap.has(r.id)) {
          deduplicatedMap.set(r.id, r);
        }
      });

      const uniqueReports = Array.from(deduplicatedMap.values());
      const evidenceEntries = await Promise.all(
        uniqueReports.slice(0, 25).map(async (r) => {
          try {
            const list = await getReportEvidences(r.id);
            return [r.id, Array.isArray(list) ? list : []] as const;
          } catch {
            return [r.id, [] as ReportEvidenceRecordDto[]] as const;
          }
        })
      );
      const evidencesByReportId = new Map<string, ReportEvidenceRecordDto[]>(evidenceEntries);

      const mergedById = new Map<string, IncidentLogEntry>();

      uniqueReports.forEach((r) => {
        const backendVerified = Boolean(
          r.verifiedAt || r.status === 'Verified' || r.status === 'Resolved'
        );
        const verifiedAt = r.verifiedAt || null;
        const backendClosed = Boolean(
          r.status === 'Resolved' ||
            r.status === 'Closed' ||
            Boolean(r.resolvedAt || r.closedAt)
        );

        const dbEvidences = evidencesByReportId.get(r.id) || [];
        const mergedPhotos: EvidencePhotoItem[] = dbEvidences
          .map((ev, idx) => ({
            id: ev.id || `ev-${r.id}-${idx}`,
            url: ev.url || ev.dataUrl || ev.filePath || '',
            timestamp: formatEvidenceTimestampExact(ev.createdAtUtc || ev.createdAt || r.createdAt),
            caption: ev.caption || `Evidence #${idx + 1}`,
            latitude: r.latitude,
            longitude: r.longitude
          }))
          .filter((p) => Boolean(p.url));

        if (r.imageUrl && !mergedPhotos.some((p) => p.url === r.imageUrl)) {
          mergedPhotos.unshift({
            id: `photo-main-${r.id}`,
            url: r.imageUrl,
            timestamp: formatEvidenceTimestampExact(r.createdAt),
            caption: 'Primary Field Evidence Snapshot',
            latitude: r.latitude,
            longitude: r.longitude
          });
        }

        const casualties = pcrByReportId[r.id] || [];
        const resolvedStreet =
          r.locationLabel || resolveStreetAddressSync(r.latitude, r.longitude);

        mergedById.set(r.id, {
          id: r.id,
          referenceCode: r.referenceCode || `RHU-${r.id.slice(0, 6).toUpperCase()}`,
          title: r.title || 'Incident Report',
          note: r.note || '',
          category: r.category || 'MedicalEmergency',
          severity: r.severity || 'High',
          status: backendClosed ? 'Closed' : normalizeStatusForActiveFormula(r.status),
          isVerified: backendVerified,
          verifiedAt,
          verifiedBy: backendVerified ? 'Command / Approved' : undefined,
          isClosed: backendClosed,
          closedAt: r.closedAt || r.resolvedAt || null,
          resolvedAt: r.resolvedAt || null,
          latitude: r.latitude,
          longitude: r.longitude,
          locationLabel: resolvedStreet,
          ipAddress: r.submittedIpAddress || 'Unavailable',
          responderName: r.reporterName || session?.fullName || 'Responder',
          responderId: r.reporterId || session?.userId || '',
          unitCode: r.allocatedUnitCode || session?.unit || 'RHU',
          createdAt: r.createdAt,
          casualties,
          evidencePhotos: mergedPhotos.slice(0, MAX_EVIDENCE_PHOTOS),
          isHardwareGeolocated: r.isHardwareGeolocated,
          aiAutoApproved: r.aiAutoApproved,
          aiVerificationStatus: r.aiVerificationStatus,
          closureSummary: r.closureSummary,
          closureApprovalMode: r.closureApprovalMode,
          taggedColleagues: r.taggedColleagues,
          rawReport: r
        });
      });

      pcrList.forEach((pcr) => {
        const linkedId = pcr.reportId || `pcr-log-${pcr.id}`;
        if (!mergedById.has(linkedId)) {
          mergedById.set(linkedId, {
            id: linkedId,
            referenceCode: pcr.pcrReference || `PCR-${pcr.id.slice(0, 6).toUpperCase()}`,
            title: `PCR Log: ${pcr.patientName}${pcr.chiefComplaint ? ` — ${pcr.chiefComplaint}` : ''}`,
            note: pcr.narrative || '',
            category: 'MedicalEmergency',
            severity: pcr.spO2Percent < 92 ? 'Critical' : 'High',
            status: 'Responded',
            isVerified: false,
            verifiedAt: null,
            isClosed: false,
            closedAt: null,
            latitude: coords.latitude,
            longitude: coords.longitude,
            locationLabel: pcr.unitCode ? `Unit ${pcr.unitCode}` : 'Field Sector',
            ipAddress: 'Unavailable',
            responderName: pcr.medicName || session?.fullName || 'Responder',
            responderId: pcr.responderUserId || session?.userId || '',
            unitCode: pcr.unitCode || activeAgencyUnit,
            createdAt: pcr.createdAt,
            casualties: pcrByReportId[pcr.reportId || pcr.id] || [],
            evidencePhotos: [],
            isHardwareGeolocated: true
          });
        }
      });

      setLogs(Array.from(mergedById.values()));
    } catch (err) {
      console.error('[MyReportsPage] Failed to load incident logs:', err);
    } finally {
      setLoading(false);
    }
  }, [session, activeAgencyUnit, coords.latitude, coords.longitude]);

  useValueRefreshAuto(loadAllIncidentLogs, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    void loadAllIncidentLogs();
  }, [loadAllIncidentLogs]);

  useEffect(() => {
    const handleExternalUpdate = () => {
      void loadAllIncidentLogs();
    };
    window.addEventListener('resqtrack:report', handleExternalUpdate);
    window.addEventListener('resqtrack:incident_created', handleExternalUpdate);
    return () => {
      window.removeEventListener('resqtrack:report', handleExternalUpdate);
      window.removeEventListener('resqtrack:incident_created', handleExternalUpdate);
    };
  }, [loadAllIncidentLogs]);

  // 1-second live tick solely for live 2-minute Done fade countdown notice (no premature auto-close)
  useEffect(() => {
    const hasActiveFade = logs.some((l) => {
      const rem = computeTwoMinFadeSecondsLeft(l.resolvedAt, l.closedAt, l.status, nowMs);
      return rem !== null && rem > 0;
    });
    if (!hasActiveFade) return;

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [logs, nowMs]);

  const handleVerifyOrRejectLog = useCallback(
    async (
      logItem: IncidentLogEntry,
      actionStatus: 'Verified' | 'Rejected' | 'Dispatched',
      e?: React.MouseEvent
    ) => {
      if (e) e.stopPropagation();
      const nowIso = new Date().toISOString();
      const responderLabel = session?.fullName || `${activeAgencyUnit} Responder`;
      const backendStatus = actionStatus === 'Dispatched' ? 'Allocated' : actionStatus;
      const noteText =
        actionStatus === 'Rejected'
          ? `Rejected by ${responderLabel} (${activeAgencyUnit}) at ${formatEvidenceTimestampExact(nowIso)}.`
          : actionStatus === 'Dispatched'
          ? `Dispatched by ${responderLabel} (${activeAgencyUnit}) at ${formatEvidenceTimestampExact(nowIso)}.`
          : `Manually approved by ${responderLabel} (${activeAgencyUnit}) at ${formatEvidenceTimestampExact(nowIso)}.`;

      try {
        await verifyReport(logItem.id, backendStatus, noteText);
        await loadAllIncidentLogs();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('resqtrack:report', {
              detail: { reportId: logItem.id, status: backendStatus }
            })
          );
        }

        showToast(`${logItem.referenceCode} marked ${actionStatus}`);
      } catch {
        showToast(`Failed to update ${logItem.referenceCode} on server.`);
      }
    },
    [activeAgencyUnit, session?.fullName, loadAllIncidentLogs, showToast]
  );

  const { totalLogged, activeInAction, verifiedActioned, resolvedMissions, workingProgressCount } = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const total = safeLogs.length;

    let activeCount = 0;
    let verifiedCount = 0;
    let resolvedCount = 0;
    let inProgressCount = 0;

    const activeStatuses = new Set(['Dispatched', 'EnRoute', 'OnScene', 'Responded', 'InProgress']);

    safeLogs.forEach((l) => {
      const lowerStatus = (l.status || '').toLowerCase();
      const effectivelyClosed = Boolean(
        l.isClosed || lowerStatus === 'resolved' || lowerStatus === 'closed' || Boolean(l.resolvedAt || l.closedAt)
      );

      if (activeStatuses.has(l.status) && !effectivelyClosed) {
        activeCount += 1;
      }
      if (l.isVerified === true) {
        verifiedCount += 1;
      }
      if (effectivelyClosed) {
        resolvedCount += 1;
      }
      if (lowerStatus === 'inprogress' && !effectivelyClosed) {
        inProgressCount += 1;
      }
    });

    return {
      totalLogged: total,
      activeInAction: activeCount,
      verifiedActioned: verifiedCount,
      resolvedMissions: resolvedCount,
      workingProgressCount: inProgressCount
    };
  }, [logs]);

  const filteredAndSortedLogs = useMemo(() => {
    const activeStatuses = new Set(['Dispatched', 'EnRoute', 'OnScene', 'Responded', 'InProgress']);
    const q = debouncedSearch.trim().toLowerCase();

    const filtered = logs.filter((l) => {
      const lowerStatus = (l.status || '').toLowerCase();
      const effectivelyClosed = Boolean(
        l.isClosed || lowerStatus === 'resolved' || lowerStatus === 'closed' || Boolean(l.resolvedAt || l.closedAt)
      );

      if (activeTab === 'ACTIVE_IN_ACTION') {
        if (!activeStatuses.has(l.status) || effectivelyClosed) return false;
      } else if (activeTab === 'WORKING_PROGRESS') {
        if (lowerStatus !== 'inprogress' || effectivelyClosed) return false;
      } else if (activeTab === 'CLOSED_SOLVED') {
        if (!effectivelyClosed) return false;
      }

      if (q.length > 0) {
        const refMatch = String(l.referenceCode ?? '').toLowerCase().includes(q);
        const titleMatch = String(l.title ?? '').toLowerCase().includes(q);
        const locMatch = String(l.locationLabel ?? '').toLowerCase().includes(q);
        const noteMatch = String(l.note ?? '').toLowerCase().includes(q);
        const medicMatch = String(l.responderName ?? '').toLowerCase().includes(q);
        const casualtyMatch = l.casualties.some(
          (c) =>
            String(c.patientName ?? '').toLowerCase().includes(q) ||
            String(c.chiefComplaint ?? '').toLowerCase().includes(q)
        );
        if (!refMatch && !titleMatch && !locMatch && !noteMatch && !medicMatch && !casualtyMatch) {
          return false;
        }
      }

      return true;
    });

    const severityRank: Record<string, number> = {
      Critical: 4,
      Severe: 4,
      High: 3,
      Medium: 2,
      Low: 1
    };

    return [...filtered].sort((a, b) => {
      if (sortMode === 'OLDEST') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortMode === 'SEVERITY') {
        return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [logs, activeTab, debouncedSearch, sortMode]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    startIndex,
    endIndex,
    canNextPage,
    canPrevPage,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    pageSizeOptions
  } = usePagination<IncidentLogEntry>(filteredAndSortedLogs, {
    initialPage: 1,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100]
  });

  const selectedLog = useMemo(
    () => logs.find((l) => l.id === selectedLogId) || null,
    [logs, selectedLogId]
  );

  const handleCameraCapture = useCallback(
    async (dataUrl: string, meta: CameraCaptureMetadata) => {
      const exactStamp = formatEvidenceTimestampExact(new Date());
      const newPhoto: EvidencePhotoItem = {
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url: dataUrl,
        timestamp: exactStamp,
        caption: `Geotagged Evidence (${exactStamp})`,
        latitude: meta.latitude ?? coords.latitude,
        longitude: meta.longitude ?? coords.longitude
      };

      setIsCameraOpen(false);

      if (cameraTargetLogId) {
        const targetId = cameraTargetLogId;
        setCameraTargetLogId(null);
        try {
          await uploadReportEvidence(targetId, dataUrl, newPhoto.caption);
          await loadAllIncidentLogs();
          showToast(`Evidence uploaded to PostgreSQL (${exactStamp})`);
        } catch {
          showToast('Failed to upload evidence photo to server.');
        }
      } else {
        setCapturedPhotos((prev) => [...prev, newPhoto].slice(0, MAX_EVIDENCE_PHOTOS));
        setIsCreateModalOpen(true);
      }
    },
    [cameraTargetLogId, coords.latitude, coords.longitude, loadAllIncidentLogs, showToast]
  );

  const handleAddCasualtyRow = useCallback(() => {
    setNewCasualties((prev) => [...prev, createEmptyDraftCasualty()]);
  }, []);

  const handleUpdateDraftCasualty = (
    id: string,
    field: keyof DraftCasualtyInput,
    value: string
  ) => {
    setNewCasualties((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveDraftCasualty = (id: string) => {
    setNewCasualties((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCreateLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const incompletePcr = newCasualties.find(
      (c) =>
        !c.patientName.trim() ||
        !c.age.trim() ||
        !c.bloodPressureSystolic.trim() ||
        !c.bloodPressureDiastolic.trim() ||
        !c.heartRateBpm.trim() ||
        !c.respiratoryRate.trim() ||
        !c.spO2Percent.trim()
    );
    if (incompletePcr) {
      showToast('Please complete all required PCR patient vitals or remove empty patient rows.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedLabel =
        newLocationLabel.trim() ||
        resolvedAddress ||
        resolveStreetAddressSync(coords.latitude, coords.longitude);

      const res = await createReport({
        title: newTitle.trim(),
        note: newNote.trim(),
        category: newCategory,
        severity: newSeverity,
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationLabel: resolvedLabel,
        imageDataUrl: capturedPhotos[0]?.url || undefined,
        isHardwareGeolocated,
        taggedColleagueIds:
          taggedColleagues.length > 0 ? taggedColleagues.map((c) => c.id) : undefined
      });

      const createdReportId = res?.report?.id;
      const finalRefCode = res?.report?.referenceCode || 'NEW';

      if (createdReportId) {
        for (let idx = 0; idx < capturedPhotos.length; idx += 1) {
          const photo = capturedPhotos[idx];
          await uploadReportEvidence(
            createdReportId,
            photo.url,
            photo.caption || `Field Evidence #${idx + 1}`
          );
        }

        for (const c of newCasualties) {
          await submitPcrRecord({
            reportId: createdReportId,
            patientName: c.patientName.trim(),
            age: Number(c.age),
            gender: c.gender,
            levelOfConsciousness: c.levelOfConsciousness,
            bloodPressureSystolic: Number(c.bloodPressureSystolic),
            bloodPressureDiastolic: Number(c.bloodPressureDiastolic),
            heartRateBpm: Number(c.heartRateBpm),
            respiratoryRate: Number(c.respiratoryRate),
            spO2Percent: Number(c.spO2Percent),
            temperatureCelsius: c.temperatureCelsius.trim() ? Number(c.temperatureCelsius) : 0,
            chiefComplaint: c.chiefComplaint.trim(),
            medicName: session?.fullName || `${activeAgencyUnit} Responder`,
            unitCode: activeAgencyUnit
          });
        }
      }

      await loadAllIncidentLogs();
      window.dispatchEvent(new CustomEvent('resqtrack:report', { detail: res?.report }));
      showToast(`Report ${finalRefCode} saved to PostgreSQL`);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewNote('');
      setNewLocationLabel('');
      setTaggedColleagues([]);
      setCapturedPhotos([]);
      setNewCasualties([]);
    } catch {
      showToast('Failed to submit report to PostgreSQL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-[#2B010E] select-none pb-12 w-full">
      {toastMessage && (
        <div className="clay-surface fixed top-5 right-5 z-50 px-4 py-3 rounded-xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] font-mono text-sm font-bold shadow-2xl flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#670626] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#F7F1EA]/20 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F7F1EA] animate-pulse" />
            <span className="text-sm font-mono font-bold text-[#E9D9D0]">
              {agencyHeaderMeta.eyebrow}
            </span>
            <span className="text-[#E9D9D0]/60 font-mono">·</span>
            <span className="text-sm font-mono text-[#F7F1EA] font-semibold">
              {session?.fullName || 'Responder'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-lg border text-xs font-mono font-bold ${agencyHeaderMeta.badgeClass}`}
            >
              {activeAgencyUnit}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F7F1EA] tracking-tight">
            {agencyHeaderMeta.title}
          </h1>
          <p className="text-sm text-[#E9D9D0] font-mono mt-1">
            Incident reports, verification, and evidence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCameraTargetLogId(null);
              setIsCameraOpen(true);
            }}
            className="clay-button-ivory px-4 py-2.5 rounded-xl bg-[#F7F1EA] hover:bg-[#E9D9D0] text-[#670626] border border-[#670626]/25 font-mono text-sm font-black tracking-wide flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>+ New Report</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clay-surface p-5 rounded-2xl bg-[#F7F1EA] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono font-bold text-[#670626]">
              Total Logged
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#E9D9D0] border border-[#670626]/15 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-[#670626]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-[#2B010E]">{totalLogged}</span>
            <span className="text-sm font-mono text-[#A83B4D] font-semibold">Reports</span>
          </div>
        </div>

        <div className="clay-surface p-5 rounded-2xl bg-[#F7F1EA] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono font-bold text-[#670626]">
              Active
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-700/25 flex items-center justify-center">
              <Activity className="w-4 h-4 text-amber-800 animate-pulse" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-amber-900">{activeInAction}</span>
            <span className="text-sm font-mono text-amber-800 font-semibold">Ongoing</span>
          </div>
        </div>

        <div className="clay-surface p-5 rounded-2xl bg-[#F7F1EA] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono font-bold text-[#670626]">
              Approved
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#670626]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-[#670626]">{verifiedActioned}</span>
            <span className="text-sm font-mono text-[#A83B4D] font-semibold">Actioned</span>
          </div>
        </div>

        <div className="clay-surface p-5 rounded-2xl bg-[#F7F1EA] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono font-bold text-[#670626]">
              Done
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-700/25 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-800" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-emerald-900">{resolvedMissions}</span>
            <span className="text-sm font-mono text-emerald-800 font-semibold">Closed</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs, SearchBar, Sort & TableCardToggle */}
      <div className="clay-surface p-4 bg-[#F7F1EA] border border-[#670626]/15 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ALL_LOGS');
              goToPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl border font-bold transition-all cursor-pointer ${
              activeTab === 'ALL_LOGS'
                ? 'bg-[#670626] text-[#F7F1EA] border-[#670626] shadow-sm'
                : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/20 hover:border-[#670626]/45'
            }`}
          >
            All ({totalLogged})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ACTIVE_IN_ACTION');
              goToPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl border font-bold transition-all cursor-pointer ${
              activeTab === 'ACTIVE_IN_ACTION'
                ? 'bg-amber-700 text-[#F7F1EA] border-amber-700 shadow-sm'
                : 'bg-[#E9D9D0] text-amber-900 border-[#670626]/20 hover:border-amber-700/45'
            }`}
          >
            Active ({activeInAction})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('WORKING_PROGRESS');
              goToPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'WORKING_PROGRESS'
                ? 'bg-[#A83B4D] text-[#F7F1EA] border-[#A83B4D] shadow-sm'
                : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/20 hover:border-[#A83B4D]'
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>Working Progress ({workingProgressCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('CLOSED_SOLVED');
              goToPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl border font-bold transition-all cursor-pointer ${
              activeTab === 'CLOSED_SOLVED'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                : 'bg-[#E9D9D0] text-emerald-900 border-[#670626]/20 hover:border-emerald-700/45'
            }`}
          >
            Done ({resolvedMissions})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl px-3 py-2 text-sm font-mono text-[#670626]">
            <ArrowUpDown className="w-4 h-4 text-[#A83B4D]" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as LogSortMode)}
              aria-label="Sort incident logs"
              className="bg-transparent text-sm font-mono font-bold text-[#670626] focus:outline-none cursor-pointer"
            >
              <option value="NEWEST">Sort: Newest</option>
              <option value="OLDEST">Sort: Oldest</option>
              <option value="SEVERITY">Sort: Severity</option>
            </select>
          </div>

          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search ref, patient, location..."
            className="w-full sm:w-64"
          />

          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Incident Logs Feed */}
      {loading ? (
        <div className="clay-surface p-12 text-center text-[#670626] font-mono text-base font-bold animate-pulse bg-[#F7F1EA] border border-[#670626]/15 rounded-2xl">
          Loading reports...
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="clay-surface p-12 text-center bg-[#F7F1EA] border border-[#670626]/15 rounded-2xl">
          <ClipboardList className="w-9 h-9 mx-auto mb-2.5 text-[#A83B4D]" />
          <h3 className="text-lg font-black text-[#670626] font-mono">No matching reports</h3>
          <p className="text-sm text-[#A83B4D] font-mono mt-1">
            No incident logs found in database.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedItems.map((log) => {
            const sevClass = getClaySeverityBadge(log.severity);
            const fadeSecLeft = computeTwoMinFadeSecondsLeft(log.resolvedAt, log.closedAt, log.status, nowMs);
            const isRejected = log.status === 'Rejected';
            const effectivelyClosed = Boolean(!isRejected && (log.isClosed || fadeSecLeft !== null));
            const progressPct =
              fadeSecLeft !== null
                ? Math.min(100, Math.max(0, Math.round(((120 - fadeSecLeft) / 120) * 100)))
                : effectivelyClosed
                ? 100
                : 0;
            const awaitingVerification = isAwaitingVerificationStatus(log.status) && !log.isVerified && !isRejected;

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLogId(log.id)}
                className={`clay-surface p-5 border rounded-2xl cursor-pointer group shadow-[0_14px_34px_rgba(74,4,26,0.2)] hover:-translate-y-0.5 flex flex-col justify-between transition-all duration-200 bg-[#F7F1EA] ${
                  isRejected
                    ? 'border-[#670626]/40 opacity-85'
                    : effectivelyClosed
                    ? 'border-emerald-700/35 hover:border-emerald-700'
                    : log.isVerified
                    ? 'border-[#A83B4D]/45 hover:border-[#670626]'
                    : 'border-[#670626]/20 hover:border-[#670626]'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-[#670626] group-hover:underline">
                        {log.referenceCode}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${sevClass}`}>
                        {log.severity}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/15 text-xs font-mono font-bold text-[#670626]">
                        {log.unitCode}
                      </span>
                    </div>

                    {isRejected ? (
                      <span className="px-3 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] text-xs font-mono font-bold flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Rejected</span>
                      </span>
                    ) : effectivelyClosed ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-100 border border-emerald-700/30 text-emerald-900 text-xs font-mono font-bold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {fadeSecLeft !== null && fadeSecLeft > 0
                            ? `Mark as Done · ${formatMmSs(fadeSecLeft)}`
                            : 'Mark as Done'}
                        </span>
                      </span>
                    ) : log.isVerified ? (
                      <span className="px-3 py-1 rounded-lg bg-[#670626]/12 border border-[#670626]/30 text-[#670626] text-xs font-mono font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{log.status === 'Working Progress' ? 'Working Progress' : 'Approved'}</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-amber-100 border border-amber-700/30 text-amber-900 text-xs font-mono font-bold flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        <span>{log.status}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-black text-[#2B010E] line-clamp-1">{log.title}</h3>
                  <p className="text-sm text-[#5C313E] mt-1 line-clamp-2">{log.note || 'No notes.'}</p>

                  <div className="flex flex-wrap items-center gap-2 mt-3 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/15 text-[#670626] font-bold inline-flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-[#A83B4D]" />
                      <span>
                        {log.casualties.length === 0
                          ? '0 PCRs logged'
                          : `${log.casualties.length} PCR`}
                      </span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/15 text-[#670626] font-bold inline-flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#A83B4D]" />
                      <span>{log.evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS} Photos</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/15 text-[#5C313E] inline-flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#A83B4D]" />
                      <span>{log.ipAddress}</span>
                    </span>
                  </div>

                  <div className="mt-3.5 p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                    {isRejected ? (
                      <div className="flex items-center justify-between text-xs font-mono text-[#670626] font-bold">
                        <span>Report Rejected</span>
                        <span>{formatEvidenceTimestampExact(log.closedAt)}</span>
                      </div>
                    ) : effectivelyClosed ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-emerald-900 font-bold">
                          <span>
                            {fadeSecLeft !== null && fadeSecLeft > 0
                              ? 'Mark as Done (Map Fade Countdown)'
                              : 'Case Resolved (Mark as Done)'}
                          </span>
                          <span>
                            {fadeSecLeft !== null && fadeSecLeft > 0
                              ? `${formatMmSs(fadeSecLeft)} (${progressPct}%)`
                              : formatEvidenceTimestampExact(log.closedAt || log.resolvedAt)}
                          </span>
                        </div>
                        {fadeSecLeft !== null && fadeSecLeft > 0 && (
                          <div className="w-full h-2.5 rounded-full bg-[#F7F1EA] overflow-hidden border border-emerald-700/25">
                            <div
                              className="h-full bg-gradient-to-r from-[#670626] via-[#A83B4D] to-emerald-600 transition-all duration-500"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : log.isVerified ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#670626] font-bold">
                        <span>
                          {log.status === 'Working Progress'
                            ? 'Working Progress — Awaiting Final Clearance'
                            : 'Approved — Ready for Field Closure Evidence'}
                        </span>
                        {log.rawReport && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClosureTargetReport(log.rawReport ?? null);
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Submit Evidence / Close</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-mono text-amber-900 font-bold">
                            {awaitingVerification ? 'Awaiting Verification' : 'Awaiting Triage'}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {log.rawReport && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setClosureTargetReport(log.rawReport ?? null);
                                }}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Submit Evidence / Close</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#670626]/12">
                          <button
                            type="button"
                            onClick={(e) => void handleVerifyOrRejectLog(log, 'Verified', e)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Verify</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void handleVerifyOrRejectLog(log, 'Dispatched', e)}
                            className="px-3 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-mono text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Dispatch</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void handleVerifyOrRejectLog(log, 'Rejected', e)}
                            className="px-3 py-1.5 rounded-lg bg-[#F7F1EA] hover:bg-rose-100 text-[#991B1B] border border-[#991B1B]/30 font-mono text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[#670626]/12 flex items-center justify-between font-mono text-xs text-[#5C313E]">
                  <span className="truncate max-w-[230px] inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#670626] shrink-0" />
                    <span>{formatGpsCoord(log.latitude, log.longitude)}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {log.evidencePhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxImageUrl(log.evidencePhotos[0].url);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] text-xs font-bold hover:bg-[#DFC9BE] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-[#670626]" />
                        <span>Photo</span>
                      </button>
                    )}
                    <span className="text-[#A83B4D] font-bold">{formatRelativeTime(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="clay-surface overflow-x-auto rounded-2xl border border-[#670626]/15 bg-[#F7F1EA] shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
          <table className="w-full text-left text-sm font-mono">
            <thead className="bg-[#E9D9D0] text-[#670626] text-xs uppercase border-b border-[#670626]/15">
              <tr>
                <th className="p-4">Ref</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Incident</th>
                <th className="p-4">Location / IP</th>
                <th className="p-4">Evidence</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#670626]/12 bg-[#F7F1EA]">
              {paginatedItems.map((log) => {
                const fadeSecLeft = computeTwoMinFadeSecondsLeft(log.resolvedAt, log.closedAt, log.status, nowMs);
                const isRejected = log.status === 'Rejected';
                const effectivelyClosed = Boolean(!isRejected && (log.isClosed || fadeSecLeft !== null));
                const progressPct =
                  fadeSecLeft !== null
                    ? Math.min(100, Math.max(0, Math.round(((120 - fadeSecLeft) / 120) * 100)))
                    : effectivelyClosed
                    ? 100
                    : 0;

                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className="hover:bg-[#E9D9D0]/45 transition-colors cursor-pointer"
                  >
                    <td className="p-4 text-[#670626] font-black whitespace-nowrap">
                      {log.referenceCode}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getClaySeverityBadge(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-[#2B010E] font-sans font-bold line-clamp-1">{log.title}</div>
                      <div className="text-xs text-[#A83B4D] mt-0.5">
                        {log.casualties.length === 0 ? '0 PCRs logged' : `${log.casualties.length} PCR`} · {log.unitCode}
                      </div>
                    </td>
                    <td className="p-4 text-[#5C313E] whitespace-nowrap">
                      <div className="text-emerald-800 font-bold text-xs">{formatGpsCoord(log.latitude, log.longitude)}</div>
                      <div className="text-xs text-[#7A4E59]">{log.ipAddress}</div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/15 text-[#670626] text-xs font-bold">
                        {log.evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS}
                      </span>
                    </td>
                    <td className="p-4 min-w-[180px]">
                      {isRejected ? (
                        <span className="px-2.5 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] text-xs font-bold inline-flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Rejected</span>
                        </span>
                      ) : effectivelyClosed ? (
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-700/30 text-emerald-900 text-xs font-bold inline-flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {fadeSecLeft !== null && fadeSecLeft > 0
                                ? `Mark as Done · ${formatMmSs(fadeSecLeft)}`
                                : 'Mark as Done'}
                            </span>
                          </span>
                          {fadeSecLeft !== null && fadeSecLeft > 0 && (
                            <div className="w-36 h-1.5 rounded-full bg-[#E9D9D0] overflow-hidden border border-emerald-700/20">
                              <div
                                className="h-full bg-emerald-600 transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ) : log.isVerified ? (
                        <span className="px-2.5 py-1 rounded-lg bg-[#670626]/12 border border-[#670626]/30 text-[#670626] text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{log.status === 'Working Progress' ? 'Working Progress' : 'Approved'}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-700/30 text-amber-900 text-xs font-bold">
                          {log.status}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {!effectivelyClosed && !isRejected && !log.isVerified ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => void handleVerifyOrRejectLog(log, 'Verified', e)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void handleVerifyOrRejectLog(log, 'Dispatched', e)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold text-xs cursor-pointer"
                          >
                            Dispatch
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void handleVerifyOrRejectLog(log, 'Rejected', e)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#E9D9D0] hover:bg-rose-100 text-[#991B1B] border border-[#991B1B]/30 font-bold text-xs cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : !effectivelyClosed && !isRejected && log.isVerified ? (
                        <div className="inline-flex items-center gap-1.5">
                          {log.status !== 'Dispatched' && (
                            <button
                              type="button"
                              onClick={(e) => void handleVerifyOrRejectLog(log, 'Dispatched', e)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold text-xs cursor-pointer"
                            >
                              Dispatch
                            </button>
                          )}
                        </div>
                      ) : isRejected ? (
                        <span className="text-xs text-[#991B1B] font-bold">Rejected</span>
                      ) : (
                        <span className="text-xs text-emerald-800 font-bold">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      <div className="clay-surface p-4 bg-[#F7F1EA] border border-[#670626]/15 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-sm shadow-[0_10px_28px_rgba(74,4,26,0.18)]">
        <div className="flex items-center gap-3 text-[#5C313E]">
          <span>
            <strong className="text-[#2B010E]">{totalItems === 0 ? 0 : startIndex + 1}</strong>–
            <strong className="text-[#2B010E]">{endIndex}</strong> of{' '}
            <strong className="text-[#670626]">{totalItems}</strong>
          </span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="px-2.5 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold text-sm cursor-pointer"
          >
            {pageSizeOptions.map((sz) => (
              <option key={sz} value={sz}>
                {sz} / page
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canPrevPage}
            onClick={prevPage}
            className="px-3 py-1.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold disabled:opacity-40 hover:border-[#670626] inline-flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>
          <span className="px-3.5 py-1.5 rounded-xl bg-[#670626] text-[#F7F1EA] font-bold">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={!canNextPage}
            onClick={nextPage}
            className="px-3 py-1.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold disabled:opacity-40 hover:border-[#670626] inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Incident Log Details Modal */}
      {selectedLog && (() => {
        const modalFadeSecLeft = computeTwoMinFadeSecondsLeft(
          selectedLog.resolvedAt,
          selectedLog.closedAt,
          selectedLog.status,
          nowMs
        );
        const modalRejected = selectedLog.status === 'Rejected';
        const modalClosed = Boolean(!modalRejected && (selectedLog.isClosed || modalFadeSecLeft !== null));
        const modalProgressPct =
          modalFadeSecLeft !== null
            ? Math.min(100, Math.max(0, Math.round(((120 - modalFadeSecLeft) / 120) * 100)))
            : modalClosed
            ? 100
            : 0;

        return (
          <DefaultFloatingModalCard
            isOpen={selectedLog !== null}
            onClose={() => setSelectedLogId(null)}
            title={`${selectedLog.referenceCode} — Incident Log`}
            subtitle={`${selectedLog.responderName} · ${selectedLog.unitCode}`}
            maxWidth="max-w-4xl"
          >
            <div className="flex flex-col gap-5 text-[#2B010E] text-sm font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#670626]/15 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[#670626] font-black text-base">{selectedLog.referenceCode}</span>
                    <span className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold ${getClaySeverityBadge(selectedLog.severity)}`}>
                      {selectedLog.severity}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/15 text-[#670626] text-xs font-bold">
                      {selectedLog.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-[#2B010E] font-sans mt-1.5">{selectedLog.title}</h3>
                </div>

                {modalRejected ? (
                  <span className="px-3.5 py-2 rounded-xl bg-[#670626] text-[#F7F1EA] font-bold inline-flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    <span>Rejected</span>
                  </span>
                ) : modalClosed ? (
                  <span className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-700/30 font-bold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {modalFadeSecLeft !== null && modalFadeSecLeft > 0
                        ? `Mark as Done · ${formatMmSs(modalFadeSecLeft)}`
                        : 'Mark as Done'}
                    </span>
                  </span>
                ) : selectedLog.isVerified ? (
                  <span className="px-3.5 py-2 rounded-xl bg-[#E9D9D0] text-[#670626] border border-[#670626]/30 font-bold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{selectedLog.status === 'Working Progress' ? 'Working Progress' : 'Approved'}</span>
                  </span>
                ) : (
                  <span className="px-3.5 py-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-700/30 font-bold inline-flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    <span>{selectedLog.status}</span>
                  </span>
                )}
              </div>

              {!modalClosed && !modalRejected && (
                <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#A83B4D] block">
                      Verification
                    </span>
                    <span className="text-sm font-bold text-[#670626]">
                      Verify, dispatch, or reject
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!selectedLog.isVerified && (
                      <Button
                        type="button"
                        variant="action-green"
                        size="sm"
                        onClick={(e) => void handleVerifyOrRejectLog(selectedLog, 'Verified', e)}
                        icon={<Check className="w-4 h-4" />}
                      >
                        Verify
                      </Button>
                    )}
                    {selectedLog.status !== 'Dispatched' && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={(e) => void handleVerifyOrRejectLog(selectedLog, 'Dispatched', e)}
                        icon={<Send className="w-4 h-4" />}
                      >
                        Dispatch
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={(e) => void handleVerifyOrRejectLog(selectedLog, 'Rejected', e)}
                      icon={<XCircle className="w-4 h-4" />}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <span className="text-sm font-bold text-[#670626] flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>Closure & Map Fade Status</span>
                  </span>
                </div>

                {modalRejected ? (
                  <div className="text-[#991B1B] font-bold text-sm flex items-center justify-between">
                    <span>Rejected</span>
                    <span>{formatEvidenceTimestampExact(selectedLog.closedAt)}</span>
                  </div>
                ) : modalClosed ? (
                  <div className="space-y-2">
                    <div className="text-emerald-900 font-bold text-sm flex items-center justify-between">
                      <span>
                        {modalFadeSecLeft !== null && modalFadeSecLeft > 0
                          ? 'Mark as Done (2-Min Map Icon Fade)'
                          : 'Case Resolved (Mark as Done)'}
                      </span>
                      <span>
                        {modalFadeSecLeft !== null && modalFadeSecLeft > 0
                          ? `${formatMmSs(modalFadeSecLeft)} (${modalProgressPct}%)`
                          : formatEvidenceTimestampExact(selectedLog.closedAt || selectedLog.resolvedAt)}
                      </span>
                    </div>
                    {modalFadeSecLeft !== null && modalFadeSecLeft > 0 && (
                      <div className="w-full h-3 rounded-full bg-[#F7F1EA] overflow-hidden border border-emerald-700/25">
                        <div
                          className="h-full bg-gradient-to-r from-[#670626] via-[#A83B4D] to-emerald-600 transition-all duration-500"
                          style={{ width: `${modalProgressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : selectedLog.isVerified ? (
                  <p className="text-[#670626] text-sm font-semibold">
                    {selectedLog.status === 'Working Progress'
                      ? 'Working Progress — Submit final scene/treatment photo evidence to mark as Done.'
                      : 'Approved — Ready for responder closure photo evidence submission.'}
                  </p>
                ) : (
                  <p className="text-[#5C313E] text-sm">
                    Awaiting field triage or responder closure evidence.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="text-[#A83B4D] block text-xs font-bold mb-0.5">Location</span>
                  <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4" />
                    <span>{formatGpsCoord(selectedLog.latitude, selectedLog.longitude)}</span>
                  </span>
                  <span className="text-[#5C313E] text-xs block mt-0.5">{selectedLog.locationLabel}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="text-[#A83B4D] block text-xs font-bold mb-0.5">IP Address</span>
                  <span className="text-[#670626] font-bold flex items-center gap-1.5">
                    <Globe className="w-4 h-4" />
                    <span>{selectedLog.ipAddress}</span>
                  </span>
                  <span className="text-[#5C313E] text-xs block mt-0.5">
                    {selectedLog.isHardwareGeolocated ? 'Hardware GPS' : 'Fallback GPS'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="text-[#A83B4D] block text-xs font-bold mb-0.5">Logged At</span>
                  <span className="text-[#2B010E] font-bold">
                    {formatEvidenceTimestampExact(selectedLog.createdAt)}
                  </span>
                  <span className="text-[#5C313E] text-xs block mt-0.5">
                    {selectedLog.responderName}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                <span className="text-[#670626] font-bold text-xs mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#A83B4D]" />
                  <span>Field Notes</span>
                </span>
                <p className="text-[#2B010E] leading-relaxed font-sans text-sm">
                  {selectedLog.note || 'No notes provided.'}
                </p>
              </div>

              {/* Multi-Casualty PCR Vitals List */}
              <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-[#670626] flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-[#A83B4D]" />
                    <span>
                      {selectedLog.casualties.length === 0
                        ? '0 PCRs logged'
                        : `PCR Vitals (${selectedLog.casualties.length})`}
                    </span>
                  </span>
                </div>

                {selectedLog.casualties.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#F7F1EA] border border-dashed border-[#670626]/25 text-center text-[#7A4E59] text-xs">
                    0 PCRs logged for this report in PostgreSQL.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedLog.casualties.map((cas, idx) => (
                      <div
                        key={cas.id || idx}
                        className="p-4 rounded-xl bg-[#F7F1EA] border border-[#670626]/15 flex flex-col gap-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#670626]/12 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#670626] text-[#F7F1EA] font-black text-xs">
                              #{idx + 1}
                            </span>
                            <span className="text-[#2B010E] font-bold text-sm">{cas.patientName}</span>
                            <span className="text-[#5C313E] text-xs">
                              ({cas.age}yo · {cas.gender})
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 border border-rose-700/30 text-rose-900 text-xs font-bold">
                            {cas.triageTag || 'PCR'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                          <div className="p-2.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/12">
                            <span className="text-[#A83B4D] block text-xs">BP</span>
                            <span className="text-[#2B010E] font-bold text-sm">
                              {cas.bloodPressureSystolic}/{cas.bloodPressureDiastolic}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/12">
                            <span className="text-[#A83B4D] block text-xs">HR</span>
                            <span className="text-rose-800 font-bold text-sm">{cas.heartRateBpm} bpm</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/12">
                            <span className="text-[#A83B4D] block text-xs">RR</span>
                            <span className="text-[#670626] font-bold text-sm">{cas.respiratoryRate}/min</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/12">
                            <span className="text-[#A83B4D] block text-xs">SpO2</span>
                            <span className="text-emerald-800 font-bold text-sm">{cas.spO2Percent}%</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/12">
                            <span className="text-[#A83B4D] block text-xs">Temp</span>
                            <span className="text-amber-800 font-bold text-sm">{cas.temperatureCelsius}°C</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/12">
                            <span className="text-[#A83B4D] block text-xs">AVPU</span>
                            <span className="text-[#670626] font-bold text-sm">{cas.levelOfConsciousness}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                          <span className="text-[#2B010E]">
                            <strong className="text-[#670626]">Complaint:</strong> {cas.chiefComplaint || 'N/A'}
                          </span>
                          {cas.interventions && cas.interventions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {cas.interventions.map((intv, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-0.5 rounded-lg bg-emerald-100 border border-emerald-700/30 text-emerald-900 text-xs font-semibold"
                                >
                                  {intv}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Evidence Gallery */}
              <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-sm font-bold text-[#670626] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#A83B4D]" />
                    <span>
                      Evidence ({selectedLog.evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS})
                    </span>
                  </span>

                  {selectedLog.evidencePhotos.length < MAX_EVIDENCE_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => {
                        setCameraTargetLogId(selectedLog.id);
                        setIsCameraOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Capture ({selectedLog.evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS})</span>
                    </button>
                  )}
                </div>

                {selectedLog.evidencePhotos.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#F7F1EA] border border-dashed border-[#670626]/25 text-center text-[#7A4E59]">
                    No photos attached.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
                    {selectedLog.evidencePhotos.slice(0, MAX_EVIDENCE_PHOTOS).map((photo, index) => (
                      <div
                        key={photo.id || index}
                        onClick={() => setLightboxImageUrl(photo.url)}
                        className="group relative rounded-xl overflow-hidden border border-[#670626]/20 bg-[#F7F1EA] cursor-pointer hover:border-[#670626] transition-all"
                      >
                        <img
                          src={photo.url}
                          alt={photo.caption || `Evidence #${index + 1}`}
                          className="w-full h-28 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="p-2.5 bg-[#F7F1EA] border-t border-[#670626]/12 text-xs font-mono">
                          <div className="text-[#670626] font-bold truncate">
                            #{index + 1} · {formatEvidenceTimestampExact(photo.timestamp)}
                          </div>
                          <div className="text-[#7A4E59] truncate text-xs">
                            {formatGpsCoord(
                              photo.latitude ?? selectedLog.latitude,
                              photo.longitude ?? selectedLog.longitude
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#670626]/15">
                {!selectedLog.isClosed && selectedLog.rawReport && (
                  <Button
                    variant="action-green"
                    size="sm"
                    onClick={() => setClosureTargetReport(selectedLog.rawReport ?? null)}
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-1.5" />
                    <span>Submit Duty Evidence / Close Case</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelectedLogId(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DefaultFloatingModalCard>
        );
      })()}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => {
          setIsCameraOpen(false);
          setCameraTargetLogId(null);
        }}
        onCapture={(dataUrl, meta) => void handleCameraCapture(dataUrl, meta)}
        title="Field Evidence Camera"
      />

      {/* Create New Field Incident Log Modal */}
      {isCreateModalOpen && (
        <DefaultFloatingModalCard
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="New Incident Report"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCreateLogSubmit} className="flex flex-col gap-4 text-sm font-mono text-[#2B010E]">
            <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[#670626] font-bold">
                  Evidence Photos ({capturedPhotos.length}/{MAX_EVIDENCE_PHOTOS})
                </span>
                {capturedPhotos.length < MAX_EVIDENCE_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => {
                      setCameraTargetLogId(null);
                      setIsCameraOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>+ Add Photo</span>
                  </button>
                )}
              </div>

              {capturedPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2.5">
                  {capturedPhotos.map((p, idx) => (
                    <div key={p.id} className="rounded-xl overflow-hidden border border-emerald-700/35 bg-[#F7F1EA]">
                      <img src={p.url} alt={`Capture ${idx + 1}`} className="w-full h-24 object-cover" />
                      <div className="p-1.5 text-xs text-emerald-800 font-bold truncate">{p.timestamp}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#670626] font-bold">Title *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Incident title"
                required
                className="px-3.5 py-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#2B010E] placeholder-[#9B727D] focus:outline-none focus:border-[#670626]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[#670626] font-bold">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#2B010E] focus:outline-none focus:border-[#670626]"
                >
                  <option value="MedicalEmergency">Medical Emergency</option>
                  <option value="VehicularAccident">Vehicular Accident</option>
                  <option value="StructuralFire">Structural Fire</option>
                  <option value="CrimeOrSecurity">Crime / Security Incident</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[#670626] font-bold">Severity</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#2B010E] focus:outline-none focus:border-[#670626]"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* PCR Vitals Builder (empty by default, requires real input when added) */}
            <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[#670626] font-bold">
                  PCR Vitals ({newCasualties.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddCasualtyRow}
                  className="px-3 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold text-xs cursor-pointer"
                >
                  + Add Patient
                </button>
              </div>
              {newCasualties.length === 0 ? (
                <p className="text-xs text-[#5C313E]">
                  0 PCRs added. Click + Add Patient to attach real patient vitals.
                </p>
              ) : (
                <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                  {newCasualties.map((c, i) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg bg-[#F7F1EA] border border-[#670626]/15 flex flex-col gap-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#670626]">Patient #{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftCasualty(c.id)}
                          className="text-[#991B1B] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Patient Name *"
                          value={c.patientName}
                          onChange={(e) => handleUpdateDraftCasualty(c.id, 'patientName', e.target.value)}
                          className="col-span-2 px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        />
                        <input
                          type="number"
                          required
                          min={0}
                          placeholder="Age *"
                          value={c.age}
                          onChange={(e) => handleUpdateDraftCasualty(c.id, 'age', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        />
                        <select
                          value={c.gender}
                          onChange={(e) => handleUpdateDraftCasualty(c.id, 'gender', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                        <input
                          type="number"
                          required
                          placeholder="BP Sys *"
                          value={c.bloodPressureSystolic}
                          onChange={(e) =>
                            handleUpdateDraftCasualty(c.id, 'bloodPressureSystolic', e.target.value)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        />
                        <input
                          type="number"
                          required
                          placeholder="BP Dia *"
                          value={c.bloodPressureDiastolic}
                          onChange={(e) =>
                            handleUpdateDraftCasualty(c.id, 'bloodPressureDiastolic', e.target.value)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        />
                        <input
                          type="number"
                          required
                          placeholder="HR BPM *"
                          value={c.heartRateBpm}
                          onChange={(e) => handleUpdateDraftCasualty(c.id, 'heartRateBpm', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        />
                        <input
                          type="number"
                          required
                          placeholder="SpO2 % *"
                          value={c.spO2Percent}
                          onChange={(e) => handleUpdateDraftCasualty(c.id, 'spO2Percent', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        />
                        <input
                          type="number"
                          required
                          placeholder="RR /min *"
                          value={c.respiratoryRate}
                          onChange={(e) =>
                            handleUpdateDraftCasualty(c.id, 'respiratoryRate', e.target.value)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        />
                        <input
                          type="text"
                          placeholder="Chief Complaint"
                          value={c.chiefComplaint}
                          onChange={(e) =>
                            handleUpdateDraftCasualty(c.id, 'chiefComplaint', e.target.value)
                          }
                          className="col-span-3 px-2.5 py-1.5 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#670626] font-bold">Extracted Street / Highway Location</label>
              <input
                type="text"
                value={newLocationLabel}
                onChange={(e) => setNewLocationLabel(e.target.value)}
                placeholder="Dipolog-Sindangan National Highway, Katipunan, Zamboanga del Norte"
                className="px-3.5 py-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#2B010E] placeholder-[#9B727D] focus:outline-none focus:border-[#670626]"
              />
            </div>

            <ColleagueMentionPicker
              unitLabel={activeAgencyUnit}
              selectedColleagues={taggedColleagues}
              onChange={setTaggedColleagues}
              label={`Tag Same-Unit Colleagues (${activeAgencyUnit} Only)`}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-[#670626] font-bold">Field Notes</label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Field notes..."
                className="px-3.5 py-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#2B010E] placeholder-[#9B727D] focus:outline-none focus:border-[#670626]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#670626]/15">
              <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" type="submit" isLoading={isSubmitting}>
                <Radio className="w-4 h-4 inline mr-1" />
                <span>Submit Report</span>
              </Button>
            </div>
          </form>
        </DefaultFloatingModalCard>
      )}

      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Incident Evidence"
      />

      <ResponderClosureEvidenceModal
        isOpen={closureTargetReport !== null}
        onClose={() => setClosureTargetReport(null)}
        incident={closureTargetReport}
        responderUnit={activeAgencyUnit}
        onSubmitted={(result) => {
          showToast(
            result.message ||
              `Updated ${result.report?.referenceCode || 'incident'} (${result.reportStatus})`
          );
          setClosureTargetReport(null);
          void loadAllIncidentLogs();
        }}
      />
    </div>
  );
};

export default MyReportsPage;
