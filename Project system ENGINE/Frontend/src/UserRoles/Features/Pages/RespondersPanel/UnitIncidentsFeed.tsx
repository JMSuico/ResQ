// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Casualty Field Dispatches feed allocated to the active responder agency with tactical progression controls,
// PostgreSQL-backed evidence gallery (GET/POST /api/reports/{id}/evidences), multi-casualty PCR vitals,
// backup dispatch requests (POST /api/dispatch-requests), and real verifiedAt + 5m auto-close countdown.
// Strictly uses arrow lambda functions (=>), ZERO 'any', ZERO emojis, pure lucide-react icons, and @/Shared + @/Hooks primitives.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useSession,
  useValueRefreshAuto,
  useDebounce,
  usePagination,
  useReportEventBus
} from '@/Hooks';
import {
  getAgencyReports,
  getReportEvidences,
  uploadReportEvidence,
  ReportEvidenceRecordDto,
  ReportItem,
  sendEmergencyBroadcast,
  verifyReport
} from '@/Endpoints/reportsApi';
import {
  submitPcrRecord,
  getPcrRecords,
  createMedicDispatchRequest,
  CreatePcrPayload,
  PatientCareRecord
} from '@/Endpoints/responderOpsApi';
import {
  Button,
  ImageLightboxModal,
  SearchBar,
  TableCardToggle,
  useTableCardView,
  DefaultFloatingModalCard,
  Dropdown,
  PoliceBlotterModal
} from '@/Shared';
import { formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';
import {
  Ambulance,
  Flame,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Building,
  User,
  Navigation,
  Camera,
  Radio,
  Check,
  Zap,
  Eye,
  Lock,
  ArrowUpRight,
  HeartPulse,
  Plus,
  Send,
  Upload,
  Trash2,
  Activity,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Video,
  Sparkles,
  Timer,
  XCircle
} from 'lucide-react';

export interface EvidenceMediaItem {
  id: string;
  slotIndex: number;
  url: string;
  mediaType: 'image' | 'video';
  caption: string;
  capturedAtFormatted: string;
  capturedAtIso: string;
  uploadedBy: string;
}

export interface CasualtyVitalEntry {
  id: string;
  patientName: string;
  age: string;
  gender: string;
  levelOfConsciousness: string;
  bpSystolic: string;
  bpDiastolic: string;
  heartRate: string;
  respiratoryRate: string;
  spO2: string;
  glucose: string;
  temp: string;
  chiefComplaint: string;
  narrative: string;
  interventions: string[];
  recordedAt: string;
  pcrReference?: string;
}

type FilterTabMode = 'ALL' | 'CRITICAL' | 'ACTIVE' | 'RESOLVED';
type SortMode = 'CRITICAL_FIRST' | 'NEWEST_FIRST' | 'OLDEST_FIRST' | 'STATUS_ORDER';

const MAX_EVIDENCE_SLOTS = 40;
const COUNTDOWN_TOTAL_SECONDS = 300; // 05:00 -> 00:00

const COMMON_INTERVENTIONS: string[] = [
  'O2 Therapy (High-Flow)',
  'IV Cannulation (0.9% NaCl)',
  'C-Spine Immobilization',
  'Wound Dressing / Bandaging',
  'Limb Splinting',
  'Bag-Valve-Mask Ventilation',
  'Defibrillation / AED',
  'Patient Extrication'
];

const BACKUP_OPTIONS = [
  {
    id: 'OPTION_1_ADMIN_DISPATCH',
    number: 1,
    label: 'Request Admin Dispatch',
    description: 'Escalate backup request to LDRRMO Command Admin'
  },
  {
    id: 'OPTION_2_NEARBY_DISTRESS',
    number: 2,
    label: 'Nearby Distress Beacon',
    description: 'Priority digital beacon to nearby responder units'
  },
  {
    id: 'OPTION_3_OFFICIAL_DISPATCH',
    number: 3,
    label: 'Official Dispatch Message',
    description: 'Encrypted digital & tactical radio relay channel'
  }
] as const;

export const formatExactTimestampWithSeconds = (dateInput?: string | Date | null): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  const rawHours = validDate.getHours();
  const ampm = rawHours >= 12 ? 'PM' : 'AM';
  const hours12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
  const hoursStr = String(hours12).padStart(2, '0');
  const minutesStr = String(validDate.getMinutes()).padStart(2, '0');
  const secondsStr = String(validDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hoursStr}:${minutesStr}:${secondsStr} ${ampm}`;
};

export const formatCountdownMmSs = (totalSeconds: number): string => {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = String(Math.floor(clamped / 60)).padStart(2, '0');
  const secs = String(clamped % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

const computeRemainingSecondsFromVerifiedAt = (
  verifiedAt?: string | null,
  nowMs: number = Date.now()
): number => {
  if (!verifiedAt) return COUNTDOWN_TOTAL_SECONDS;
  const verifiedMs = new Date(verifiedAt).getTime();
  if (Number.isNaN(verifiedMs)) return COUNTDOWN_TOTAL_SECONDS;
  const elapsed = Math.floor((nowMs - verifiedMs) / 1000);
  return Math.max(0, COUNTDOWN_TOTAL_SECONDS - elapsed);
};

const createBlankCasualtyEntry = (): CasualtyVitalEntry => ({
  id: `pcr-casualty-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  patientName: '',
  age: '',
  gender: 'Male',
  levelOfConsciousness: 'Alert',
  bpSystolic: '',
  bpDiastolic: '',
  heartRate: '',
  respiratoryRate: '',
  spO2: '',
  glucose: '',
  temp: '',
  chiefComplaint: '',
  narrative: '',
  interventions: [],
  recordedAt: formatExactTimestampWithSeconds(new Date())
});

const mapApiEvidenceToMediaItem = (
  ev: ReportEvidenceRecordDto,
  index: number,
  fallbackId: string
): EvidenceMediaItem => {
  const ts = ev.createdAtUtc || ev.createdAt || new Date().toISOString();
  const resolvedUrl = ev.url || ev.dataUrl || ev.filePath || '';
  const isVideo =
    (ev.mediaType || '').toLowerCase() === 'video' ||
    resolvedUrl.startsWith('data:video/');
  return {
    id: ev.id || `ev-${fallbackId}-${index + 1}`,
    slotIndex: index + 1,
    url: resolvedUrl,
    mediaType: isVideo ? 'video' : 'image',
    caption: ev.caption || `Evidence #${index + 1}`,
    capturedAtFormatted: formatExactTimestampWithSeconds(ts),
    capturedAtIso: ts,
    uploadedBy: ev.uploadedByName || 'Responder'
  };
};

const mapPcrRecordToEntry = (r: PatientCareRecord): CasualtyVitalEntry => ({
  id: r.id,
  patientName: r.patientName,
  age: String(r.age),
  gender: r.gender,
  levelOfConsciousness: r.levelOfConsciousness,
  bpSystolic: String(r.bloodPressureSystolic),
  bpDiastolic: String(r.bloodPressureDiastolic),
  heartRate: String(r.heartRateBpm),
  respiratoryRate: String(r.respiratoryRate),
  spO2: String(r.spO2Percent),
  glucose: String(r.bloodGlucoseMgDl),
  temp: String(r.temperatureCelsius),
  chiefComplaint: r.chiefComplaint,
  narrative: r.narrative,
  interventions: r.interventions || [],
  recordedAt: formatExactTimestampWithSeconds(r.createdAt),
  pcrReference: r.pcrReference
});

export const UnitIncidentsFeed: React.FC = () => {
  const { session } = useSession();
  const navigate = useNavigate();
  const { dispatchReportEvent } = useReportEventBus();

  const activeAgencyUnit = (
    session?.unit && session.unit !== 'None'
      ? session.unit
      : (typeof window !== 'undefined' ? sessionStorage.getItem('resqtrack_unit') : null) || 'RHU'
  ).toUpperCase();

  const [incidents, setIncidents] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [filterMode, setFilterMode] = useState<FilterTabMode>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('CRITICAL_FIRST');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const { viewMode, setViewMode } = useTableCardView('card');

  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [selectedDetailIncident, setSelectedDetailIncident] = useState<ReportItem | null>(null);

  const [backupModalIncident, setBackupModalIncident] = useState<ReportItem | null>(null);
  const [selectedBackupOption, setSelectedBackupOption] = useState<string>(BACKUP_OPTIONS[0].id);
  const [backupAgency, setBackupAgency] = useState<'RHU' | 'FIRE' | 'PNP' | 'ALL'>('ALL');
  const [backupNote, setBackupNote] = useState<string>('');
  const [dispatchChannel, setDispatchChannel] = useState<string>('KATIPUNAN-C2-TAC1');
  const [isSendingBackup, setIsSendingBackup] = useState<boolean>(false);

  const [evidenceModalIncident, setEvidenceModalIncident] = useState<ReportItem | null>(null);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, EvidenceMediaItem[]>>({});
  const [isUploadingEvidence, setIsUploadingEvidence] = useState<boolean>(false);
  const [selectedEvidenceSlot, setSelectedEvidenceSlot] = useState<number>(0);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>('Field Incident Photographic Evidence');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activePcrIncident, setActivePcrIncident] = useState<ReportItem | null>(null);
  const [pcrRecordsByIncident, setPcrRecordsByIncident] = useState<Record<string, CasualtyVitalEntry[]>>({});
  const [draftCasualties, setDraftCasualties] = useState<CasualtyVitalEntry[]>([createBlankCasualtyEntry()]);
  const [activeCasualtyTabIndex, setActiveCasualtyTabIndex] = useState<number>(0);
  const [isSavingPcr, setIsSavingPcr] = useState<boolean>(false);

  const [activeBlotterIncident, setActiveBlotterIncident] = useState<ReportItem | null>(null);
  const autoClosedIdsRef = useRef<Set<string>>(new Set());

  const showToast = useCallback((msg: string) => {
    setActionSuccessToast(msg);
    window.setTimeout(() => setActionSuccessToast(null), 3500);
  }, []);

  const broadcastNotificationEvent = useCallback((title: string, message: string, metadata?: Record<string, unknown>) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('resqtrack:notification', {
          detail: {
            id: `notif-${Date.now()}`,
            title,
            message,
            timestamp: formatExactTimestampWithSeconds(new Date()),
            ...metadata
          }
        })
      );
    }
  }, []);

  const refreshEvidencesForIncident = useCallback(async (inc: ReportItem) => {
    try {
      const apiEvidences = await getReportEvidences(inc.id);
      const list: EvidenceMediaItem[] = Array.isArray(apiEvidences)
        ? apiEvidences
            .map((ev, idx) => mapApiEvidenceToMediaItem(ev, idx, inc.id))
            .filter((item) => Boolean(item.url))
        : [];
      if (inc.imageUrl && !list.some((item) => item.url === inc.imageUrl)) {
        list.unshift({
          id: `ev-primary-${inc.id}`,
          slotIndex: 1,
          url: inc.imageUrl,
          mediaType: 'image',
          caption: `${inc.referenceCode} — Initial Field Capture`,
          capturedAtFormatted: formatExactTimestampWithSeconds(inc.createdAt),
          capturedAtIso: inc.createdAt || new Date().toISOString(),
          uploadedBy: inc.reporterName || 'Reporter'
        });
      }
      const reindexed = list.map((item, idx) => ({ ...item, slotIndex: idx + 1 }));
      setEvidenceMap((prev) => ({ ...prev, [inc.id]: reindexed }));
    } catch {
      if (inc.imageUrl) {
        setEvidenceMap((prev) => ({
          ...prev,
          [inc.id]: [
            {
              id: `ev-primary-${inc.id}`,
              slotIndex: 1,
              url: inc.imageUrl || '',
              mediaType: 'image',
              caption: `${inc.referenceCode} — Initial Field Capture`,
              capturedAtFormatted: formatExactTimestampWithSeconds(inc.createdAt),
              capturedAtIso: inc.createdAt || new Date().toISOString(),
              uploadedBy: inc.reporterName || 'Reporter'
            }
          ]
        }));
      }
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      const [data, allPcrs] = await Promise.all([
        getAgencyReports(activeAgencyUnit),
        getPcrRecords().catch(() => [] as PatientCareRecord[])
      ]);
      const reportList = Array.isArray(data) ? data : [];
      setIncidents(reportList);

      const pcrGrouped: Record<string, CasualtyVitalEntry[]> = {};
      (Array.isArray(allPcrs) ? allPcrs : []).forEach((p) => {
        if (!p.reportId) return;
        if (!pcrGrouped[p.reportId]) pcrGrouped[p.reportId] = [];
        pcrGrouped[p.reportId].push(mapPcrRecordToEntry(p));
      });
      setPcrRecordsByIncident(pcrGrouped);

      await Promise.all(reportList.slice(0, 20).map((inc) => refreshEvidencesForIncident(inc)));
    } catch (err) {
      console.error('Failed to load agency incident dispatches:', err);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [activeAgencyUnit, refreshEvidencesForIncident]);

  useValueRefreshAuto(loadIncidents, {
    intervalMs: 6000,
    enabled: true
  });

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  // 1-second tick for real DB verifiedAt + 5m - now countdown; persists Resolved to PostgreSQL upon reaching 00:00
  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      incidents.forEach((inc) => {
        const isTerminal =
          inc.status === 'Resolved' ||
          inc.status === 'Closed' ||
          inc.status === 'Rejected' ||
          Boolean(inc.resolvedAt);
        if (!isTerminal && inc.verifiedAt) {
          const remaining = computeRemainingSecondsFromVerifiedAt(inc.verifiedAt, currentNow);
          if (remaining <= 0 && !autoClosedIdsRef.current.has(inc.id)) {
            autoClosedIdsRef.current.add(inc.id);
            void verifyReport(
              inc.id,
              'Resolved',
              '5-minute post-verification countdown completed. Case resolved.'
            )
              .then(() => loadIncidents())
              .catch(() => {
                autoClosedIdsRef.current.delete(inc.id);
              });
          }
        }
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [incidents, loadIncidents]);

  const agencyBadge = useMemo(() => {
    switch (activeAgencyUnit) {
      case 'FIRE':
        return {
          label: 'BFP Fire Protection',
          pageTitle: 'Reports',
          code: 'BFP-FIRE',
          badgeClass: 'bg-orange-100 text-orange-900 border-orange-700/35',
          icon: Flame,
          accent: 'border-l-orange-600'
        };
      case 'PNP':
        return {
          label: 'PNP Dispatch',
          pageTitle: 'Unit Dispatches',
          code: 'PNP-POL',
          badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-700/35',
          icon: Shield,
          accent: 'border-l-indigo-600'
        };
      case 'RHU':
      default:
        return {
          label: 'RHU EMS',
          pageTitle: 'Unit Dispatches',
          code: 'RHU-EMS',
          badgeClass: 'bg-sky-100 text-sky-900 border-sky-700/35',
          icon: Ambulance,
          accent: 'border-l-sky-600'
        };
    }
  }, [activeAgencyUnit]);

  const getEffectiveStatus = useCallback((inc: ReportItem): string => inc.status, []);

  const allCount = incidents.length;

  const criticalCount = useMemo(
    () => incidents.filter((i) => i.severity === 'Critical' || i.severity === 'High').length,
    [incidents]
  );

  const activeCount = useMemo(
    () =>
      incidents.filter((i) => {
        const st = getEffectiveStatus(i);
        return (
          st === 'Submitted' ||
          st === 'Reported' ||
          st === 'Pending' ||
          st === 'Verified' ||
          st === 'Allocated' ||
          st === 'Dispatched' ||
          st === 'EnRoute' ||
          st === 'OnScene' ||
          st === 'Responded'
        );
      }).length,
    [incidents, getEffectiveStatus]
  );

  const resolvedCount = useMemo(
    () =>
      incidents.filter((i) => {
        const st = getEffectiveStatus(i);
        return st === 'Resolved' || st === 'Closed';
      }).length,
    [incidents, getEffectiveStatus]
  );

  const filteredAndSortedIncidents = useMemo(() => {
    const filtered = incidents.filter((inc) => {
      const effectiveStatus = getEffectiveStatus(inc);

      if (filterMode === 'CRITICAL' && inc.severity !== 'Critical' && inc.severity !== 'High') {
        return false;
      }
      if (
        filterMode === 'ACTIVE' &&
        effectiveStatus !== 'Submitted' &&
        effectiveStatus !== 'Reported' &&
        effectiveStatus !== 'Pending' &&
        effectiveStatus !== 'Verified' &&
        effectiveStatus !== 'Allocated' &&
        effectiveStatus !== 'Dispatched' &&
        effectiveStatus !== 'EnRoute' &&
        effectiveStatus !== 'OnScene' &&
        effectiveStatus !== 'Responded'
      ) {
        return false;
      }
      if (filterMode === 'RESOLVED' && effectiveStatus !== 'Resolved' && effectiveStatus !== 'Closed') {
        return false;
      }

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const refMatch = inc.referenceCode?.toLowerCase().includes(q);
        const titleMatch = inc.title?.toLowerCase().includes(q);
        const locMatch = inc.locationLabel?.toLowerCase().includes(q);
        const reporterMatch = inc.reporterName?.toLowerCase().includes(q);
        const catMatch = inc.category?.toLowerCase().includes(q);
        if (!refMatch && !titleMatch && !locMatch && !reporterMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });

    const severityRank: Record<string, number> = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1
    };

    const statusRank: Record<string, number> = {
      Allocated: 1,
      EnRoute: 2,
      OnScene: 3,
      Responded: 4,
      Resolved: 5,
      Closed: 6
    };

    return [...filtered].sort((a, b) => {
      if (sortMode === 'CRITICAL_FIRST') {
        const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortMode === 'NEWEST_FIRST') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortMode === 'OLDEST_FIRST') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortMode === 'STATUS_ORDER') {
        const stA = statusRank[getEffectiveStatus(a)] || 99;
        const stB = statusRank[getEffectiveStatus(b)] || 99;
        return stA - stB;
      }
      return 0;
    });
  }, [incidents, filterMode, debouncedSearch, sortMode, getEffectiveStatus]);

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
  } = usePagination(filteredAndSortedIncidents, {
    initialPage: 1,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100]
  });

  const copyCoordinates = (lat: number, lng: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
    showToast(`Coordinates copied: ${text}`);
  };

  const handleNavigateGpsToTraumaBoard = (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('resqtrack:map-focus', {
          detail: {
            expandMap: true,
            focusIncidentId: inc.id,
            latitude: inc.latitude,
            longitude: inc.longitude
          }
        })
      );
    }

    showToast(`Opening map for ${inc.referenceCode}`);
    navigate(`/responder?expandMap=true&focusIncidentId=${encodeURIComponent(inc.id)}`);
  };

  // Wire backup dispatch request cleanly through POST /api/dispatch-requests (+ optional broadcast)
  const handleExecuteBackupOption = async (optionId: string) => {
    if (!backupModalIncident) return;
    const chosenOption = BACKUP_OPTIONS.find((o) => o.id === optionId) || BACKUP_OPTIONS[0];
    const nowFormatted = formatExactTimestampWithSeconds(new Date());
    setIsSendingBackup(true);

    try {
      const dispatchRecord = await createMedicDispatchRequest({
        incidentId: backupModalIncident.id,
        incidentCode: backupModalIncident.referenceCode,
        incidentTitle: `Backup: ${backupModalIncident.title}`,
        category: backupModalIncident.category,
        severity: backupModalIncident.severity,
        location:
          backupModalIncident.locationLabel ||
          formatGpsCoord(backupModalIncident.latitude, backupModalIncident.longitude),
        coordinates: `${backupModalIncident.latitude.toFixed(6)}, ${backupModalIncident.longitude.toFixed(6)}`,
        latitude: backupModalIncident.latitude,
        longitude: backupModalIncident.longitude,
        targetUnit: backupAgency,
        originUnit: activeAgencyUnit,
        responderId: session?.employeeOrResidentId || session?.userId || activeAgencyUnit,
        responderName: session?.fullName || `${activeAgencyUnit} Responder`,
        notes: `[${chosenOption.label}] Target: ${backupAgency} | Channel: ${dispatchChannel} | ${backupNote}`
      });

      if (optionId !== 'OPTION_1_ADMIN_DISPATCH') {
        await sendEmergencyBroadcast({
          title: `Backup Request · ${backupModalIncident.referenceCode}`,
          message: `${chosenOption.label} — ${backupNote} (Target: ${backupAgency}, Channel: ${dispatchChannel})`,
          severity: 'Critical'
        }).catch(() => undefined);
      }

      dispatchReportEvent({
        type: 'BACKUP_REQUEST_DISPATCHED',
        backupRecord: dispatchRecord
      });

      broadcastNotificationEvent(
        `Backup Request · ${backupModalIncident.referenceCode}`,
        `${chosenOption.label} (${nowFormatted})`,
        { backupRecord: dispatchRecord }
      );

      if (optionId === 'OPTION_3_OFFICIAL_DISPATCH') {
        showToast(`Official dispatch message sent on ${dispatchChannel}`);
      } else if (optionId === 'OPTION_2_NEARBY_DISTRESS') {
        showToast('Distress signal sent to nearby units');
      } else {
        showToast('Backup request persisted to Central Command');
      }

      setBackupModalIncident(null);
    } catch {
      showToast('Failed to send backup dispatch request to server.');
    } finally {
      setIsSendingBackup(false);
    }
  };

  const openEvidenceModal = async (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEvidenceModalIncident(inc);
    setSelectedEvidenceSlot(0);
    await refreshEvidencesForIncident(inc);
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Failed to read file'));
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(file);
    });

  const handleUploadEvidenceFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!evidenceModalIncident || !e.target.files || e.target.files.length === 0) return;
    const targetIncident = evidenceModalIncident;
    const files = Array.from(e.target.files);
    const currentList = evidenceMap[targetIncident.id] || [];
    const remainingSlots = MAX_EVIDENCE_SLOTS - currentList.length;

    if (remainingSlots <= 0) {
      showToast(`Max 40 evidence items reached for ${targetIncident.referenceCode}`);
      e.target.value = '';
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    setIsUploadingEvidence(true);
    let uploadedCount = 0;

    try {
      for (let i = 0; i < filesToProcess.length; i += 1) {
        const file = filesToProcess[i];
        const dataUrl = await readFileAsDataUrl(file);
        const slotNumber = currentList.length + i + 1;
        await uploadReportEvidence(
          targetIncident.id,
          dataUrl,
          `${file.name} (${slotNumber}/40)`
        );
        uploadedCount += 1;
      }
      await refreshEvidencesForIncident(targetIncident);
      showToast(`Uploaded ${uploadedCount} evidence file(s) to ${targetIncident.referenceCode}`);
    } catch {
      showToast('Failed to upload evidence to server.');
    } finally {
      setIsUploadingEvidence(false);
      e.target.value = '';
    }
  };

  const openPcrModalForIncident = async (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActivePcrIncident(inc);

    try {
      const apiRecords = await getPcrRecords(inc.id);
      if (apiRecords && apiRecords.length > 0) {
        const mapped = apiRecords.map(mapPcrRecordToEntry);
        setPcrRecordsByIncident((prev) => ({ ...prev, [inc.id]: mapped }));
        setDraftCasualties(mapped);
        setActiveCasualtyTabIndex(0);
        return;
      }
    } catch {
      // fall through to blank entry
    }

    setDraftCasualties([createBlankCasualtyEntry()]);
    setActiveCasualtyTabIndex(0);
  };

  const handleAddNewPcrVital = () => {
    setDraftCasualties((prev) => {
      const newEntry = createBlankCasualtyEntry();
      const updated = [...prev, newEntry];
      setActiveCasualtyTabIndex(updated.length - 1);
      return updated;
    });
    showToast(`Added casualty #${draftCasualties.length + 1}`);
  };

  const handleUpdateActiveCasualtyField = <K extends keyof CasualtyVitalEntry>(
    field: K,
    value: CasualtyVitalEntry[K]
  ) => {
    setDraftCasualties((prev) =>
      prev.map((item, idx) =>
        idx === activeCasualtyTabIndex
          ? { ...item, [field]: value, recordedAt: formatExactTimestampWithSeconds(new Date()) }
          : item
      )
    );
  };

  const handleToggleCasualtyIntervention = (intervention: string) => {
    setDraftCasualties((prev) =>
      prev.map((item, idx) => {
        if (idx !== activeCasualtyTabIndex) return item;
        const exists = item.interventions.includes(intervention);
        const nextInterventions = exists
          ? item.interventions.filter((i) => i !== intervention)
          : [...item.interventions, intervention];
        return { ...item, interventions: nextInterventions };
      })
    );
  };

  const handleRemoveCasualtyDraft = (idxToRemove: number) => {
    if (draftCasualties.length <= 1) return;
    setDraftCasualties((prev) => prev.filter((_, i) => i !== idxToRemove));
    setActiveCasualtyTabIndex((prevIdx) => Math.max(0, prevIdx - 1));
  };

  const handleSaveAllCasualtyPcrRecords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePcrIncident) return;

    const invalidEntry = draftCasualties.find(
      (entry) =>
        !entry.patientName.trim() ||
        !entry.age.trim() ||
        !entry.bpSystolic.trim() ||
        !entry.bpDiastolic.trim() ||
        !entry.heartRate.trim() ||
        !entry.spO2.trim() ||
        !entry.respiratoryRate.trim()
    );
    if (invalidEntry) {
      showToast('Please enter patient name, age, and all required vitals (BP, HR, SpO2, RR).');
      return;
    }

    setIsSavingPcr(true);
    try {
      for (const entry of draftCasualties) {
        const payload: CreatePcrPayload = {
          reportId: activePcrIncident.id,
          patientName: entry.patientName.trim(),
          age: Number(entry.age),
          gender: entry.gender,
          levelOfConsciousness: entry.levelOfConsciousness,
          bloodPressureSystolic: Number(entry.bpSystolic),
          bloodPressureDiastolic: Number(entry.bpDiastolic),
          heartRateBpm: Number(entry.heartRate),
          respiratoryRate: Number(entry.respiratoryRate),
          spO2Percent: Number(entry.spO2),
          bloodGlucoseMgDl: entry.glucose.trim() ? Number(entry.glucose) : 0,
          temperatureCelsius: entry.temp.trim() ? Number(entry.temp) : 0,
          interventions: entry.interventions,
          chiefComplaint: entry.chiefComplaint.trim(),
          narrative: entry.narrative.trim(),
          medicName: session?.fullName || 'RHU Paramedic',
          unitCode: session?.unit || 'RHU-EMS'
        };
        await submitPcrRecord(payload);
      }

      const refreshed = await getPcrRecords(activePcrIncident.id);
      const mapped = refreshed.map(mapPcrRecordToEntry);
      setPcrRecordsByIncident((prev) => ({
        ...prev,
        [activePcrIncident.id]: mapped
      }));

      dispatchReportEvent({
        type: 'MULTI_CASUALTY_PCR_SAVED',
        incidentId: activePcrIncident.id,
        referenceCode: activePcrIncident.referenceCode,
        casualtyCount: draftCasualties.length
      });

      showToast(
        `Saved ${draftCasualties.length} PCR record(s) for ${activePcrIncident.referenceCode}`
      );
      setActivePcrIncident(null);
    } catch {
      showToast('Failed to save PCR records to PostgreSQL.');
    } finally {
      setIsSavingPcr(false);
    }
  };

  const handleMarkRespondedGreenPointer = async (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nowFormatted = formatExactTimestampWithSeconds(new Date());
    const responderName = session?.fullName || `${activeAgencyUnit} Responder`;

    try {
      await verifyReport(
        inc.id,
        'Responded',
        `Incident marked RESPONDED by ${responderName} at ${nowFormatted}.`
      );
      await loadIncidents();

      dispatchReportEvent({
        type: 'INCIDENT_RESPONDED_GREEN_POINTER',
        incidentId: inc.id,
        referenceCode: inc.referenceCode,
        status: 'Responded',
        pointerColor: '#10B981',
        respondedAt: nowFormatted,
        latitude: inc.latitude,
        longitude: inc.longitude
      });

      broadcastNotificationEvent(
        `Responded · ${inc.referenceCode}`,
        `${inc.locationLabel || 'Incident Sector'} (${nowFormatted})`,
        { incidentId: inc.id, pointerColor: '#10B981', status: 'Responded' }
      );

      showToast(`${inc.referenceCode} marked Responded`);
    } catch {
      showToast(`Failed to mark ${inc.referenceCode} as Responded on server.`);
    }
  };

  const handleVerifyIncidentAction = async (
    inc: ReportItem,
    nextStatus: 'Verified' | 'Rejected' | 'Allocated',
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    const responderName = session?.fullName || `${activeAgencyUnit} Responder`;
    const nowFormatted = formatExactTimestampWithSeconds(new Date());
    const actionLabel = nextStatus === 'Allocated' ? 'Dispatched' : nextStatus;

    try {
      await verifyReport(
        inc.id,
        nextStatus,
        `Incident ${actionLabel} by ${responderName} (${activeAgencyUnit}) at ${nowFormatted}.`
      );
      await loadIncidents();

      dispatchReportEvent({
        type: `INCIDENT_${actionLabel.toUpperCase()}`,
        incidentId: inc.id,
        referenceCode: inc.referenceCode,
        status: nextStatus
      });

      broadcastNotificationEvent(
        `${actionLabel} · ${inc.referenceCode}`,
        `${inc.title} marked ${actionLabel} by ${responderName} (${nowFormatted})`,
        { incidentId: inc.id, status: nextStatus }
      );

      showToast(`${inc.referenceCode} ${actionLabel}`);
    } catch (err: unknown) {
      console.warn('[UnitIncidentsFeed] verifyReport failed:', err);
      showToast(`Failed to update ${inc.referenceCode} on server.`);
    }
  };

  const handleSubmitReportToIncidentLogs = async (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const incEvidences = evidenceMap[inc.id] || [];
    const incPcrs = pcrRecordsByIncident[inc.id] || [];

    try {
      await verifyReport(
        inc.id,
        'Verified',
        `Field Report verified by ${session?.fullName || 'Responder'} with ${incEvidences.length} evidence item(s) and ${incPcrs.length} PCR vital record(s). 05:00 countdown initiated.`
      );
      await loadIncidents();

      dispatchReportEvent({
        type: 'INCIDENT_REPORT_SUBMITTED_TO_LOGS',
        incidentId: inc.id,
        referenceCode: inc.referenceCode
      });

      broadcastNotificationEvent(
        `Report Submitted · ${inc.referenceCode}`,
        `${incEvidences.length} Evidence · ${incPcrs.length} PCR · 05:00 verification timer active`,
        { incidentId: inc.id }
      );

      showToast(`${inc.referenceCode} verified — 05:00 auto-close countdown active`);
    } catch {
      showToast(`Failed to submit report for ${inc.referenceCode} to server.`);
    }
  };

  const handleCompleteCountdownImmediately = async (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await verifyReport(
        inc.id,
        'Resolved',
        `Incident closed by ${session?.fullName || 'Responder'} after verification.`
      );
      await loadIncidents();
      if (selectedDetailIncident?.id === inc.id) {
        setSelectedDetailIncident({ ...inc, status: 'Resolved', resolvedAt: new Date().toISOString() });
      }
      showToast(`${inc.referenceCode} resolved and persisted to PostgreSQL`);
    } catch {
      showToast(`Failed to resolve ${inc.referenceCode} on server.`);
    }
  };

  const activeCasualtyDraft = draftCasualties[activeCasualtyTabIndex] || draftCasualties[0];
  const currentModalEvidences = evidenceModalIncident
    ? evidenceMap[evidenceModalIncident.id] || []
    : [];
  const activeEvidenceItem = currentModalEvidences[selectedEvidenceSlot] || null;

  return (
    <div className="flex flex-col gap-6 text-[#2B010E] select-none pb-8 w-full">
      {actionSuccessToast && (
        <div className="clay-surface fixed top-5 right-5 z-50 px-4 py-3 rounded-xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] font-mono text-sm font-bold shadow-2xl flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#670626] animate-ping" />
          <span>{actionSuccessToast}</span>
        </div>
      )}

      {/* Header, KPI Telemetry & Filter Controls */}
      <div className="clay-surface p-5 bg-[#F7F1EA] border border-[#670626]/15 rounded-2xl shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border tracking-wide inline-flex items-center gap-1.5 ${agencyBadge.badgeClass}`}
              >
                <agencyBadge.icon className="w-4 h-4" />
                <span>{agencyBadge.label}</span>
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#670626] tracking-tight">
              {agencyBadge.pageTitle}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-sm">
            <div className="px-4 py-2 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col items-center">
              <span className="text-xs text-[#A83B4D] font-bold">Total</span>
              <span className="text-xl font-black text-[#670626]">{allCount}</span>
            </div>
            <div className="px-4 py-2 rounded-xl bg-rose-100 border border-rose-700/25 flex flex-col items-center">
              <span className="text-xs text-rose-800 font-bold">Critical</span>
              <span className="text-xl font-black text-rose-900">{criticalCount}</span>
            </div>
            <div className="px-4 py-2 rounded-xl bg-amber-100 border border-amber-700/25 flex flex-col items-center">
              <span className="text-xs text-amber-800 font-bold">Active</span>
              <span className="text-xl font-black text-amber-900">{activeCount}</span>
            </div>
            <div className="px-4 py-2 rounded-xl bg-emerald-100 border border-emerald-700/25 flex flex-col items-center">
              <span className="text-xs text-emerald-800 font-bold">Resolved</span>
              <span className="text-xl font-black text-emerald-900">{resolvedCount}</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs, SearchBar, Sort & TableCardToggle */}
        <div className="mt-4 pt-4 border-t border-[#670626]/15 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3.5 py-2 rounded-xl border font-bold transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-[#670626] text-[#F7F1EA] border-[#670626] shadow-sm'
                  : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/20 hover:border-[#670626]/50'
              }`}
            >
              All ({allCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('CRITICAL')}
              className={`px-3.5 py-2 rounded-xl border font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'CRITICAL'
                  ? 'bg-[#991B1B] text-white border-[#991B1B] shadow-sm'
                  : 'bg-[#E9D9D0] text-[#991B1B] border-[#670626]/20 hover:border-[#991B1B]/50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Critical ({criticalCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ACTIVE')}
              className={`px-3.5 py-2 rounded-xl border font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'ACTIVE'
                  ? 'bg-amber-700 text-white border-amber-700 shadow-sm'
                  : 'bg-[#E9D9D0] text-amber-900 border-[#670626]/20 hover:border-amber-700/50'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Active ({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('RESOLVED')}
              className={`px-3.5 py-2 rounded-xl border font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'RESOLVED'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                  : 'bg-[#E9D9D0] text-emerald-900 border-[#670626]/20 hover:border-emerald-700/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Resolved ({resolvedCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search ref, location..."
              className="w-full sm:w-60"
            />

            <div className="flex items-center gap-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl px-3 py-2 text-sm font-mono">
              <ArrowUpDown className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />
              <select
                aria-label="Sort Dispatches"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-transparent text-[#670626] font-bold focus:outline-none cursor-pointer"
              >
                <option value="CRITICAL_FIRST">Sort: Severity</option>
                <option value="NEWEST_FIRST">Sort: Newest</option>
                <option value="OLDEST_FIRST">Sort: Oldest</option>
                <option value="STATUS_ORDER">Sort: Status</option>
              </select>
            </div>

            <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* LOADING OR EMPTY STATE */}
      {loading ? (
        <div className="clay-surface p-12 text-center text-[#670626] font-mono text-base font-bold animate-pulse bg-[#F7F1EA] border border-[#670626]/15 rounded-2xl">
          Loading dispatches...
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="clay-surface p-12 text-center bg-[#F7F1EA] border border-[#670626]/15 rounded-2xl">
          <Radio className="w-9 h-9 mx-auto mb-2.5 text-[#A83B4D]" />
          <h3 className="text-lg font-black text-[#670626] font-mono">No dispatches</h3>
          <p className="text-sm text-[#A83B4D] font-mono mt-1">
            No {activeAgencyUnit} dispatches found in database.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="flex flex-col gap-4">
          {paginatedItems.map((inc) => {
            const effectiveStatus = getEffectiveStatus(inc);
            const isResponded = effectiveStatus === 'Responded';
            const isRejected = effectiveStatus === 'Rejected';
            const isClosedOrResolved =
              effectiveStatus === 'Resolved' ||
              effectiveStatus === 'Closed' ||
              Boolean(inc.resolvedAt);
            const isAwaitingVerification =
              effectiveStatus === 'Reported' ||
              effectiveStatus === 'Submitted' ||
              effectiveStatus === 'Pending';
            const hasActiveTimer = Boolean(inc.verifiedAt) && !isClosedOrResolved && !isRejected;
            const remainingSeconds = hasActiveTimer
              ? computeRemainingSecondsFromVerifiedAt(inc.verifiedAt, nowMs)
              : 0;
            const incEvidences = evidenceMap[inc.id] || [];
            const incPcrs = pcrRecordsByIncident[inc.id] || [];

            const isCritical = inc.severity === 'Critical';
            const isSevere = inc.severity === 'High';
            const isModerate = inc.severity === 'Medium';

            const severityBadge = isCritical ? (
              <span className="px-3 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-700/35 text-xs font-black font-mono tracking-wide flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>Critical</span>
              </span>
            ) : isSevere ? (
              <span className="px-3 py-0.5 rounded-lg bg-orange-100 text-orange-900 border border-orange-700/35 text-xs font-extrabold font-mono tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-700" />
                <span>Severe</span>
              </span>
            ) : isModerate ? (
              <span className="px-3 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-700/35 text-xs font-bold font-mono tracking-wide">
                Moderate
              </span>
            ) : (
              <span className="px-3 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-700/35 text-xs font-bold font-mono tracking-wide">
                Routine
              </span>
            );

            const statusConfig = {
              Submitted: {
                bg: 'bg-[#E9D9D0]',
                text: 'text-[#670626]',
                border: 'border-[#A83B4D]/45',
                dot: 'bg-[#670626]',
                label: 'Submitted'
              },
              Reported: {
                bg: 'bg-[#E9D9D0]',
                text: 'text-[#670626]',
                border: 'border-[#A83B4D]/45',
                dot: 'bg-[#670626]',
                label: 'Submitted'
              },
              Pending: {
                bg: 'bg-amber-100',
                text: 'text-amber-900',
                border: 'border-amber-700/30',
                dot: 'bg-amber-600 animate-pulse',
                label: 'Pending'
              },
              Verified: {
                bg: 'bg-[#670626]/12',
                text: 'text-[#670626]',
                border: 'border-[#670626]/35',
                dot: 'bg-[#670626]',
                label: 'Verified'
              },
              Rejected: {
                bg: 'bg-[#670626]',
                text: 'text-[#F7F1EA]',
                border: 'border-[#670626]',
                dot: 'bg-[#FFD9DD]',
                label: 'Rejected'
              },
              Allocated: {
                bg: 'bg-[#A83B4D]',
                text: 'text-[#F7F1EA]',
                border: 'border-[#A83B4D]',
                dot: 'bg-[#F7F1EA]',
                label: 'Dispatched'
              },
              Dispatched: {
                bg: 'bg-[#A83B4D]',
                text: 'text-[#F7F1EA]',
                border: 'border-[#A83B4D]',
                dot: 'bg-[#F7F1EA]',
                label: 'Dispatched'
              },
              EnRoute: {
                bg: 'bg-amber-100',
                text: 'text-amber-900',
                border: 'border-amber-700/35',
                dot: 'bg-amber-600 animate-ping',
                label: 'En Route'
              },
              OnScene: {
                bg: 'bg-sky-100',
                text: 'text-sky-900',
                border: 'border-sky-700/35',
                dot: 'bg-sky-600 animate-pulse',
                label: 'On Scene'
              },
              Responded: {
                bg: 'bg-emerald-100',
                text: 'text-emerald-900',
                border: 'border-emerald-700/40',
                dot: 'bg-[#10B981] animate-ping',
                label: 'Responded'
              },
              Resolved: {
                bg: 'bg-emerald-100',
                text: 'text-emerald-900',
                border: 'border-emerald-700/35',
                dot: 'bg-emerald-600',
                label: 'Resolved'
              },
              Closed: {
                bg: 'bg-[#E9D9D0]',
                text: 'text-emerald-900',
                border: 'border-emerald-700/35',
                dot: 'bg-emerald-600 opacity-60',
                label: 'Closed'
              }
            }[effectiveStatus] || {
              bg: 'bg-[#E9D9D0]',
              text: 'text-[#670626]',
              border: 'border-[#670626]/20',
              dot: 'bg-[#670626]',
              label: effectiveStatus
            };

            const cardBorder = isResponded
              ? 'border-l-4 border-l-[#10B981] border-emerald-700/30'
              : isCritical
              ? 'border-l-4 border-l-[#991B1B] border-[#670626]/20'
              : 'border-l-4 border-l-[#670626] border-[#670626]/15';

            const previewThumb = incEvidences[0]?.url || inc.imageUrl || null;

            return (
              <div
                key={inc.id}
                onClick={() => setSelectedDetailIncident(inc)}
                className={`clay-surface p-5 border bg-[#F7F1EA] rounded-2xl shadow-[0_14px_34px_rgba(74,4,26,0.2)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 cursor-pointer hover:border-[#670626]/50 ${cardBorder}`}
              >
                <div className="flex flex-col sm:flex-row items-start gap-4 w-full xl:w-auto">
                  <div
                    className="relative flex-shrink-0"
                    onClick={(e) => void openEvidenceModal(inc, e)}
                  >
                    {previewThumb ? (
                      <div className="relative group">
                        <img
                          src={previewThumb}
                          alt={inc.title}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border border-[#670626]/20 group-hover:border-[#670626] transition-colors"
                        />
                        <div className="absolute inset-0 bg-[#4A041A]/60 group-hover:bg-[#4A041A]/45 rounded-xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono font-bold text-[#F7F1EA]">
                          <Eye className="w-4 h-4 mb-0.5" />
                          <span>{incEvidences.length}/40</span>
                        </div>
                        {inc.isHardwareGeolocated && (
                          <span className="absolute bottom-1 right-1 px-2 py-0.5 rounded-md bg-[#F7F1EA]/95 border border-emerald-700/40 text-xs font-mono text-emerald-800 font-bold inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>GPS</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 hover:border-[#670626] flex flex-col items-center justify-center text-[#670626] transition-colors">
                        <Camera className="w-6 h-6 mb-1 text-[#A83B4D]" />
                        <span className="text-xs font-mono text-[#670626] font-bold">
                          {incEvidences.length}/40
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-black text-[#670626] bg-[#E9D9D0] px-2.5 py-0.5 rounded-lg border border-[#670626]/20">
                        {inc.referenceCode}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border tracking-wide inline-flex items-center gap-1 ${agencyBadge.badgeClass}`}
                      >
                        <agencyBadge.icon className="w-3.5 h-3.5" />
                        <span>{activeAgencyUnit}</span>
                      </span>

                      {severityBadge}

                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border tracking-wide flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                        <span>{statusConfig.label}</span>
                      </span>

                      {incPcrs.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-700/35 text-xs font-mono font-bold inline-flex items-center gap-1">
                          <HeartPulse className="w-3.5 h-3.5 text-rose-700" />
                          <span>{incPcrs.length} PCR</span>
                        </span>
                      )}

                      {hasActiveTimer && (
                        <span className="px-3 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-700/35 text-xs font-mono font-black inline-flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{formatCountdownMmSs(remainingSeconds)}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg sm:text-xl font-black text-[#2B010E] tracking-wide">
                      {inc.title}
                    </h2>

                    <p className="text-sm text-[#5C313E] mt-1 max-w-2xl font-sans line-clamp-2">
                      {inc.note || 'No field notes.'}
                    </p>

                    {(inc.roboflowPrediction || inc.claudeSituationSummary || inc.claudeVisibleHazards) && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-xs font-mono text-[#670626] flex flex-col gap-1 max-w-2xl">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-black">
                            AI Scene Verification · Roboflow ({inc.roboflowModelId || 'Vision'}):{' '}
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
                          <p className="text-[#5C313E] font-sans text-xs line-clamp-2">
                            Claude Haiku 4.5: {inc.claudeVisibleHazards || inc.claudeSituationSummary}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 mt-3 text-xs font-mono text-[#5C313E] pt-2.5 border-t border-[#670626]/12">
                      <div className="flex items-center gap-1.5 text-[#670626] font-bold">
                        <MapPin className="w-4 h-4 text-[#A83B4D]" />
                        <span
                          onClick={(e) => copyCoordinates(inc.latitude, inc.longitude, e)}
                          className="hover:underline cursor-pointer tracking-wider"
                          title="Click to copy GPS coordinates"
                        >
                          {formatGpsCoord(inc.latitude, inc.longitude)}
                        </span>
                      </div>

                      {inc.locationLabel && (
                        <span className="text-[#2B010E] truncate max-w-xs inline-flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-[#A83B4D]" />
                          <span>{inc.locationLabel}</span>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#A83B4D]" />
                        <span>{inc.reporterName || 'Civilian'}</span>
                      </span>

                      <span
                        className="text-[#7A4E59] inline-flex items-center gap-1.5"
                        title={formatExactTimestampWithSeconds(inc.createdAt)}
                      >
                        <Clock className="w-3.5 h-3.5 text-[#A83B4D]" />
                        <span>{formatRelativeTime(inc.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Tactical Field Action Buttons */}
                <div
                  className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end pt-3 xl:pt-0 border-t xl:border-t-0 border-[#670626]/12"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isAwaitingVerification && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => void handleVerifyIncidentAction(inc, 'Verified', e)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold shadow-sm cursor-pointer"
                        title="Verify submitted incident"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void handleVerifyIncidentAction(inc, 'Allocated', e)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] text-xs font-mono font-bold shadow-sm cursor-pointer"
                        title="Dispatch unit to incident"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void handleVerifyIncidentAction(inc, 'Rejected', e)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#E9D9D0] hover:bg-rose-100 text-[#991B1B] border border-[#991B1B]/30 text-xs font-mono font-bold cursor-pointer"
                        title="Reject invalid report"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {effectiveStatus === 'Verified' && (
                    <button
                      type="button"
                      onClick={(e) => void handleVerifyIncidentAction(inc, 'Allocated', e)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] text-xs font-mono font-bold shadow-sm cursor-pointer"
                      title="Dispatch unit to verified incident"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleNavigateGpsToTraumaBoard(inc, e)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                    title="Open map focused on this incident"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Navigate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBackupModalIncident(inc);
                      setBackupNote(
                        `Backup requested at ${inc.locationLabel || formatGpsCoord(inc.latitude, inc.longitude)} (${inc.referenceCode})`
                      );
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                    title="Request backup"
                  >
                    <Shield className="w-4 h-4 text-[#A83B4D]" />
                    <span>Backup</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => void openEvidenceModal(inc, e)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                    title="View or attach evidence"
                  >
                    <Camera className="w-4 h-4 text-[#A83B4D]" />
                    <span>Evidence ({incEvidences.length}/40)</span>
                  </button>

                  {activeAgencyUnit === 'RHU' && (
                    <button
                      type="button"
                      onClick={(e) => void openPcrModalForIncident(inc, e)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-700/30 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                      title="Record patient vitals"
                    >
                      <HeartPulse className="w-4 h-4 text-rose-700" />
                      <span>PCR {incPcrs.length > 0 ? `(${incPcrs.length})` : ''}</span>
                    </button>
                  )}

                  {activeAgencyUnit === 'PNP' && (
                    <button
                      type="button"
                      onClick={() => setActiveBlotterIncident(inc)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-700/30 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                      title="File Police Blotter"
                    >
                      <Shield className="w-4 h-4 text-indigo-700" />
                      <span>Blotter</span>
                    </button>
                  )}

                  {!isRejected && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => void handleMarkRespondedGreenPointer(inc, e)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs font-black border active:scale-95 transition-all cursor-pointer ${
                          isResponded
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-emerald-100 hover:bg-emerald-600 text-emerald-900 hover:text-white border-emerald-700/30'
                        }`}
                        title="Mark Responded"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Responded</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => void handleSubmitReportToIncidentLogs(inc, e)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-mono text-xs font-black border border-[#670626] shadow-sm active:scale-95 transition-all cursor-pointer"
                        title="Verify & initiate 5-minute countdown"
                      >
                        <Send className="w-4 h-4" />
                        <span>Submit Report</span>
                      </button>
                    </>
                  )}
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
                <th className="p-4">Location</th>
                <th className="p-4">Evidence / PCR</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#670626]/12 bg-[#F7F1EA]">
              {paginatedItems.map((inc) => {
                const effectiveStatus = getEffectiveStatus(inc);
                const isResponded = effectiveStatus === 'Responded';
                const isRejected = effectiveStatus === 'Rejected';
                const isAwaitingVerification =
                  effectiveStatus === 'Reported' ||
                  effectiveStatus === 'Submitted' ||
                  effectiveStatus === 'Pending';
                const incEvidences = evidenceMap[inc.id] || [];
                const incPcrs = pcrRecordsByIncident[inc.id] || [];

                return (
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedDetailIncident(inc)}
                    className="hover:bg-[#E9D9D0]/45 transition-colors cursor-pointer"
                  >
                    <td className="p-4 text-[#670626] font-black whitespace-nowrap">
                      {inc.referenceCode}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          inc.severity === 'Critical'
                            ? 'bg-rose-100 text-rose-900 border-rose-700/35'
                            : inc.severity === 'High'
                            ? 'bg-orange-100 text-orange-900 border-orange-700/35'
                            : 'bg-amber-100 text-amber-900 border-amber-700/35'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="p-4 text-[#2B010E] font-sans font-bold">{inc.title}</td>
                    <td className="p-4 text-[#5C313E] truncate max-w-[180px] text-xs">
                      {inc.locationLabel || formatGpsCoord(inc.latitude, inc.longitude)}
                    </td>
                    <td className="p-4 whitespace-nowrap text-xs">
                      <span className="text-[#670626] font-bold">{incEvidences.length}/40</span>
                      <span className="mx-1.5 text-[#A83B4D]">·</span>
                      <span className="text-rose-800 font-bold">{incPcrs.length} PCR</span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 ${
                          isRejected
                            ? 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
                            : isResponded
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-700/35'
                            : 'bg-[#E9D9D0] border-[#670626]/20 text-[#670626]'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isRejected ? 'bg-[#FFD9DD]' : isResponded ? 'bg-[#10B981]' : 'bg-[#670626]'
                          }`}
                        />
                        <span>{effectiveStatus === 'Reported' ? 'Submitted' : effectiveStatus}</span>
                      </span>
                    </td>
                    <td
                      className="p-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {isAwaitingVerification && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => void handleVerifyIncidentAction(inc, 'Verified', e)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleVerifyIncidentAction(inc, 'Allocated', e)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold text-xs cursor-pointer"
                            >
                              Dispatch
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleVerifyIncidentAction(inc, 'Rejected', e)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#E9D9D0] hover:bg-rose-100 text-[#991B1B] border border-[#991B1B]/30 font-bold text-xs cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleNavigateGpsToTraumaBoard(inc, e)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Navigate</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBackupModalIncident(inc);
                            setBackupNote(
                              `Backup requested at ${inc.locationLabel || formatGpsCoord(inc.latitude, inc.longitude)}`
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Backup</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void openEvidenceModal(inc, e)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 font-bold text-xs cursor-pointer"
                        >
                          Evidence
                        </button>
                        {activeAgencyUnit === 'RHU' && (
                          <button
                            type="button"
                            onClick={(e) => void openPcrModalForIncident(inc, e)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-700/25 font-bold text-xs cursor-pointer"
                          >
                            PCR
                          </button>
                        )}
                        {activeAgencyUnit === 'PNP' && (
                          <button
                            type="button"
                            onClick={() => setActiveBlotterIncident(inc)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-700/25 font-bold text-xs cursor-pointer"
                          >
                            Blotter
                          </button>
                        )}
                        {!isRejected && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => void handleMarkRespondedGreenPointer(inc, e)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
                            >
                              Responded
                            </button>
                            <button
                              type="button"
                              onClick={(e) => void handleSubmitReportToIncidentLogs(inc, e)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-black text-xs cursor-pointer"
                            >
                              Submit
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Global Pagination Bar */}
      <div className="clay-surface flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-[#F7F1EA] border border-[#670626]/15 text-sm font-mono text-[#5C313E] shadow-[0_10px_28px_rgba(74,4,26,0.18)]">
        <div className="flex items-center gap-3">
          <span>
            <strong className="text-[#2B010E]">
              {totalItems === 0 ? 0 : startIndex + 1}-{endIndex}
            </strong>{' '}
            of <strong className="text-[#670626]">{totalItems}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <Dropdown
              variant="pagination"
              value={String(pageSize)}
              options={pageSizeOptions.map((sz) => ({ value: String(sz), label: `${sz} / page` }))}
              onChange={(val) => setPageSize(Number(val))}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canPrevPage}
            onClick={prevPage}
            className="px-3 py-1.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold hover:border-[#670626] disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
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
            className="px-3 py-1.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold hover:border-[#670626] disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Incident Details Modal */}
      {selectedDetailIncident && (
        <DefaultFloatingModalCard
          isOpen={selectedDetailIncident !== null}
          onClose={() => setSelectedDetailIncident(null)}
          title={`${selectedDetailIncident.referenceCode} — Dispatch`}
          subtitle={selectedDetailIncident.locationLabel || formatGpsCoord(selectedDetailIncident.latitude, selectedDetailIncident.longitude)}
          size="2xl"
          footer={
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigateGpsToTraumaBoard(selectedDetailIncident)}
                  icon={<Navigation className="w-4 h-4" />}
                >
                  Navigate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const target = selectedDetailIncident;
                    setSelectedDetailIncident(null);
                    void openEvidenceModal(target);
                  }}
                  icon={<Camera className="w-4 h-4" />}
                >
                  Evidence ({(evidenceMap[selectedDetailIncident.id] || []).length}/40)
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(getEffectiveStatus(selectedDetailIncident) === 'Reported' ||
                  getEffectiveStatus(selectedDetailIncident) === 'Submitted' ||
                  getEffectiveStatus(selectedDetailIncident) === 'Pending') && (
                  <>
                    <Button
                      variant="action-green"
                      size="sm"
                      onClick={(e) => void handleVerifyIncidentAction(selectedDetailIncident, 'Verified', e)}
                      icon={<Check className="w-4 h-4" />}
                    >
                      Verify
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => void handleVerifyIncidentAction(selectedDetailIncident, 'Rejected', e)}
                      icon={<XCircle className="w-4 h-4" />}
                    >
                      Reject
                    </Button>
                  </>
                )}
                <Button
                  variant="action-green"
                  size="sm"
                  onClick={() => void handleMarkRespondedGreenPointer(selectedDetailIncident)}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Responded
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSubmitReportToIncidentLogs(selectedDetailIncident)}
                  icon={<Send className="w-4 h-4" />}
                >
                  Submit Report
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-sm font-mono text-[#2B010E]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
              <div>
                <span className="text-xs text-[#A83B4D] font-bold block">Reference</span>
                <span className="text-base font-black text-[#670626]">
                  {selectedDetailIncident.referenceCode}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#A83B4D] font-bold block">Severity &amp; Category</span>
                <span className="text-base font-black text-[#991B1B]">
                  {selectedDetailIncident.severity} · {selectedDetailIncident.category}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#A83B4D] font-bold block">Status</span>
                <span className="text-base font-black text-emerald-800">
                  {getEffectiveStatus(selectedDetailIncident)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 space-y-2">
              <div className="text-[#670626] text-xs font-bold">
                {selectedDetailIncident.title}
              </div>
              <p className="text-base font-sans font-semibold text-[#2B010E]">{selectedDetailIncident.note}</p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#5C313E]">
                <span>
                  Reported:{' '}
                  <strong className="text-[#670626]">
                    {formatExactTimestampWithSeconds(selectedDetailIncident.createdAt)}
                  </strong>
                </span>
                <span>
                  GPS:{' '}
                  <strong className="text-emerald-800">
                    {formatGpsCoord(selectedDetailIncident.latitude, selectedDetailIncident.longitude)}
                  </strong>
                </span>
                <span>
                  Reporter: <strong className="text-[#2B010E]">{selectedDetailIncident.reporterName}</strong>
                </span>
              </div>
            </div>

            {(selectedDetailIncident.roboflowPrediction ||
              selectedDetailIncident.claudeSituationSummary ||
              selectedDetailIncident.claudeVisibleHazards) && (
              <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 space-y-2 text-xs font-mono text-[#670626]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black uppercase">
                    AI Scene Verification · Roboflow ({selectedDetailIncident.roboflowModelId || 'Vision'}):{' '}
                    {selectedDetailIncident.roboflowPrediction || 'incident'}
                    {typeof selectedDetailIncident.roboflowConfidence === 'number'
                      ? ` (${Math.round(selectedDetailIncident.roboflowConfidence * 100)}%)`
                      : ''}
                  </span>
                  {selectedDetailIncident.pointerIconType && (
                    <span className="px-2.5 py-0.5 rounded bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] font-bold uppercase">
                      {selectedDetailIncident.pointerIconType}
                    </span>
                  )}
                </div>
                {selectedDetailIncident.claudeSituationSummary && (
                  <p className="font-sans text-[#2B010E]">
                    <strong className="font-mono text-[#A83B4D] uppercase">Claude 4.5 Situation: </strong>
                    {selectedDetailIncident.claudeSituationSummary}
                  </p>
                )}
                {selectedDetailIncident.claudeVisibleHazards && (
                  <p className="font-sans text-[#2B010E]">
                    <strong className="font-mono text-[#A83B4D] uppercase">Visible Hazards: </strong>
                    {selectedDetailIncident.claudeVisibleHazards}
                  </p>
                )}
              </div>
            )}

            {/* 5-Minute Verification Countdown from real DB verifiedAt */}
            {selectedDetailIncident.verifiedAt && (
              <div className="p-4 rounded-xl bg-emerald-100 border-2 border-emerald-700/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <span>Verification Countdown</span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    {selectedDetailIncident.status === 'Resolved' ||
                    selectedDetailIncident.status === 'Closed' ||
                    Boolean(selectedDetailIncident.resolvedAt)
                      ? 'Resolved in PostgreSQL.'
                      : 'Auto-closes at 00:00 via verifyReport.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-2 rounded-xl bg-[#F7F1EA] border border-emerald-700/35 text-xl font-black text-emerald-900">
                    {selectedDetailIncident.status === 'Resolved' ||
                    selectedDetailIncident.status === 'Closed' ||
                    Boolean(selectedDetailIncident.resolvedAt)
                      ? '00:00'
                      : formatCountdownMmSs(
                          computeRemainingSecondsFromVerifiedAt(
                            selectedDetailIncident.verifiedAt,
                            nowMs
                          )
                        )}
                  </span>
                  {selectedDetailIncident.status !== 'Resolved' &&
                    selectedDetailIncident.status !== 'Closed' &&
                    !selectedDetailIncident.resolvedAt && (
                      <Button
                        variant="action-green"
                        size="xs"
                        onClick={(e) =>
                          void handleCompleteCountdownImmediately(selectedDetailIncident, e)
                        }
                      >
                        Close Now
                      </Button>
                    )}
                </div>
              </div>
            )}
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* 3-Option Backup Modal */}
      {backupModalIncident && (
        <DefaultFloatingModalCard
          isOpen={backupModalIncident !== null}
          onClose={() => setBackupModalIncident(null)}
          title={`Request Backup — ${backupModalIncident.referenceCode}`}
          subtitle={
            backupModalIncident.locationLabel ||
            formatGpsCoord(backupModalIncident.latitude, backupModalIncident.longitude)
          }
          size="xl"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="outline" size="sm" onClick={() => setBackupModalIncident(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSendingBackup}
                onClick={() => void handleExecuteBackupOption(selectedBackupOption)}
                icon={<Radio className="w-4 h-4" />}
              >
                Send Backup Request
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 text-[#2B010E]">
            <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-sm font-mono">
              <p className="text-[#670626] font-bold">{backupModalIncident.title}</p>
              <p className="text-[#5C313E] text-xs mt-0.5">
                {formatGpsCoord(backupModalIncident.latitude, backupModalIncident.longitude)} · {formatExactTimestampWithSeconds(new Date())}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-sm font-mono font-bold text-[#670626]">
                Protocol
              </label>
              {BACKUP_OPTIONS.map((opt) => {
                const isSelected = selectedBackupOption === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedBackupOption(opt.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-[#E9D9D0] border-2 border-[#670626] shadow-sm'
                        : 'bg-[#FFFBF7] border-[#D8C1B5] hover:border-[#A83B4D]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black flex-shrink-0 ${
                            isSelected
                              ? 'bg-[#670626] text-[#F7F1EA]'
                              : 'bg-[#E9D9D0] text-[#670626]'
                          }`}
                        >
                          {opt.number}
                        </span>
                        <div>
                          <div className="text-sm font-mono font-bold text-[#670626] leading-snug">
                            {opt.label}
                          </div>
                          <p className="text-xs text-[#5C313E] mt-0.5">{opt.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isSendingBackup}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBackupOption(opt.id);
                          void handleExecuteBackupOption(opt.id);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-mono text-xs font-bold flex-shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedBackupOption === 'OPTION_3_OFFICIAL_DISPATCH' && (
              <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                <label className="text-xs font-mono font-bold text-[#670626] flex items-center gap-1.5 mb-1">
                  <Radio className="w-3.5 h-3.5 text-[#A83B4D]" />
                  <span>Dispatch Channel</span>
                </label>
                <input
                  type="text"
                  value={dispatchChannel}
                  onChange={(e) => setDispatchChannel(e.target.value)}
                  placeholder="KATIPUNAN-C2-TAC1"
                  className="w-full px-3 py-2 rounded-lg bg-[#FFFBF7] border border-[#D8C1B5] text-sm font-mono text-[#2B010E] focus:outline-none focus:border-[#670626]"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-mono font-bold text-[#670626]">
                Target Unit
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['ALL', 'RHU', 'FIRE', 'PNP'] as const).map((ag) => (
                  <button
                    key={ag}
                    type="button"
                    onClick={() => setBackupAgency(ag)}
                    className={`py-2.5 px-3 rounded-xl font-mono text-sm font-bold border transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      backupAgency === ag
                        ? 'bg-[#670626] text-[#F7F1EA] border-[#670626] shadow-sm'
                        : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/20 hover:border-[#670626]'
                    }`}
                  >
                    {ag === 'RHU' && <Ambulance className="w-4 h-4" />}
                    {ag === 'FIRE' && <Flame className="w-4 h-4" />}
                    {ag === 'PNP' && <Shield className="w-4 h-4" />}
                    {ag === 'ALL' && <Radio className="w-4 h-4" />}
                    <span>{ag === 'ALL' ? 'All' : ag}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-mono font-bold text-[#670626]">
                Note
              </label>
              <textarea
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-sm font-mono text-[#2B010E] placeholder-[#9B727D] focus:outline-none focus:border-[#670626]"
                placeholder="Reason for backup..."
              />
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* 40-Image Timestamped Evidence Modal (PostgreSQL-backed) */}
      {evidenceModalIncident && (
        <DefaultFloatingModalCard
          isOpen={evidenceModalIncident !== null}
          onClose={() => setEvidenceModalIncident(null)}
          title={`Evidence — ${evidenceModalIncident.referenceCode}`}
          subtitle={`${currentModalEvidences.length} / ${MAX_EVIDENCE_SLOTS} items`}
          size="4xl"
          footer={
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="text-sm font-mono text-[#5C313E]">
                <strong className="text-[#670626]">
                  {currentModalEvidences.length} / {MAX_EVIDENCE_SLOTS}
                </strong>{' '}
                stored in PostgreSQL
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => void handleUploadEvidenceFiles(e)}
                  className="hidden"
                />
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isUploadingEvidence}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={currentModalEvidences.length >= MAX_EVIDENCE_SLOTS}
                  icon={<Upload className="w-4 h-4" />}
                >
                  Upload Evidence
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {activeEvidenceItem ? (
              <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#670626]/15 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-0.5 rounded-lg bg-[#670626] text-[#F7F1EA] font-mono text-sm font-black">
                      #{activeEvidenceItem.slotIndex}/{MAX_EVIDENCE_SLOTS}
                    </span>
                    <span className="text-sm font-mono font-bold text-[#2B010E]">
                      {activeEvidenceItem.caption}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-emerald-100 border border-emerald-700/30 text-emerald-900 font-mono text-xs font-black inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{activeEvidenceItem.capturedAtFormatted}</span>
                    </span>
                    {activeEvidenceItem.mediaType === 'image' && (
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxTitle(
                            `${evidenceModalIncident.referenceCode} · #${activeEvidenceItem.slotIndex}/40 (${activeEvidenceItem.capturedAtFormatted})`
                          );
                          setLightboxImageUrl(activeEvidenceItem.url);
                        }}
                        className="px-3 py-1 rounded-lg bg-[#F7F1EA] hover:bg-white text-[#670626] border border-[#670626]/25 font-mono text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Zoom</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full max-h-[340px] flex items-center justify-center overflow-hidden rounded-xl bg-[#4A041A]/10 border border-[#670626]/15 p-2">
                  {activeEvidenceItem.mediaType === 'video' ? (
                    <video
                      src={activeEvidenceItem.url}
                      controls
                      className="max-h-[320px] rounded object-contain"
                    />
                  ) : (
                    <img
                      src={activeEvidenceItem.url}
                      alt={activeEvidenceItem.caption}
                      onClick={() => {
                        setLightboxTitle(
                          `${evidenceModalIncident.referenceCode} · #${activeEvidenceItem.slotIndex}/40 (${activeEvidenceItem.capturedAtFormatted})`
                        );
                        setLightboxImageUrl(activeEvidenceItem.url);
                      }}
                      className="max-h-[320px] rounded object-contain cursor-pointer"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-center font-mono text-sm text-[#5C313E]">
                No evidence uploaded yet. Use Upload Evidence below.
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2 font-mono text-sm">
                <span className="text-[#670626] font-bold">
                  Slots (1–40)
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-60 overflow-y-auto p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                {Array.from({ length: MAX_EVIDENCE_SLOTS }).map((_, idx) => {
                  const item = currentModalEvidences[idx];
                  const isCurrent = idx === selectedEvidenceSlot && Boolean(item);
                  return (
                    <button
                      key={`slot-${idx + 1}`}
                      type="button"
                      onClick={() => {
                        if (item) {
                          setSelectedEvidenceSlot(idx);
                        } else {
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`relative h-20 rounded-xl border font-mono text-xs flex flex-col items-center justify-center overflow-hidden transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-2 border-[#670626] ring-2 ring-[#A83B4D]/35 bg-[#F7F1EA]'
                          : item
                          ? 'border-emerald-700/45 bg-[#F7F1EA] hover:border-[#670626]'
                          : 'border-[#670626]/15 bg-[#F7F1EA]/70 text-[#7A4E59] hover:border-[#670626]/40 hover:text-[#670626]'
                      }`}
                      title={
                        item
                          ? `#${idx + 1}: ${item.capturedAtFormatted}`
                          : `Upload to Slot #${idx + 1}`
                      }
                    >
                      {item ? (
                        <>
                          {item.mediaType === 'video' ? (
                            <Video className="w-4 h-4 text-[#670626] mb-0.5" />
                          ) : (
                            <img
                              src={item.url}
                              alt={`Slot ${idx + 1}`}
                              className="absolute inset-0 w-full h-full object-cover opacity-75"
                            />
                          )}
                          <span className="relative z-10 px-1.5 py-0.5 rounded bg-[#670626] text-[#F7F1EA] font-black text-xs">
                            #{idx + 1}
                          </span>
                          <span className="relative z-10 px-1 bg-[#F7F1EA]/90 text-xs text-[#2B010E] font-bold truncate max-w-full">
                            {item.capturedAtFormatted.split(' ').slice(1).join(' ')}
                          </span>
                        </>
                      ) : (
                        <span className="font-bold">#{idx + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* High-Resolution Zoom Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title={lightboxTitle}
      />

      {/* Multi-Casualty PCR Vitals Modal (requires real input — zero prefilled mock vitals) */}
      {activePcrIncident && (
        <DefaultFloatingModalCard
          isOpen={activePcrIncident !== null}
          onClose={() => setActivePcrIncident(null)}
          title={`PCR Vitals — ${activePcrIncident.referenceCode}`}
          subtitle={`${draftCasualties.length} patient(s)`}
          size="2xl"
        >
          <form onSubmit={handleSaveAllCasualtyPcrRecords} className="space-y-4 text-[#2B010E]">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20">
              <div className="flex flex-wrap items-center gap-2">
                {draftCasualties.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCasualtyTabIndex(idx)}
                    className={`px-3.5 py-2 rounded-xl font-mono text-xs font-bold border transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                      idx === activeCasualtyTabIndex
                        ? 'bg-[#670626] text-[#F7F1EA] border-[#670626] shadow-sm'
                        : 'bg-[#F7F1EA] text-[#670626] border-[#670626]/20 hover:border-[#670626]'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>
                      #{idx + 1}: {c.patientName || 'Unnamed'}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddNewPcrVital}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-black border border-emerald-700 inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add PCR</span>
              </button>
            </div>

            {activeCasualtyDraft && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm font-mono text-[#5C313E]">
                  <span>
                    Patient #{activeCasualtyTabIndex + 1} ·{' '}
                    <strong className="text-emerald-800">{activeCasualtyDraft.recordedAt}</strong>
                  </span>
                  {draftCasualties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCasualtyDraft(activeCasualtyTabIndex)}
                      className="text-[#991B1B] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-[#670626] mb-1.5">
                      Patient Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={activeCasualtyDraft.patientName}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('patientName', e.target.value)
                      }
                      placeholder="Full name or Unidentified"
                      className="w-full px-3.5 py-2.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] text-sm focus:outline-none focus:border-[#670626]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#670626] mb-1.5">Age *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={150}
                      value={activeCasualtyDraft.age}
                      placeholder="Age"
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('age', e.target.value)
                      }
                      className="w-full px-3.5 py-2.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] text-sm focus:outline-none focus:border-[#670626]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-sm font-bold text-[#670626] mb-1.5">
                      Gender
                    </label>
                    <select
                      value={activeCasualtyDraft.gender}
                      onChange={(e) => handleUpdateActiveCasualtyField('gender', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] text-sm focus:outline-none focus:border-[#670626]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Unknown">Unidentified</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#670626] mb-1.5">
                      Consciousness (AVPU)
                    </label>
                    <select
                      value={activeCasualtyDraft.levelOfConsciousness}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('levelOfConsciousness', e.target.value)
                      }
                      className="w-full px-3.5 py-2.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] text-sm focus:outline-none focus:border-[#670626]"
                    >
                      <option value="Alert">Alert</option>
                      <option value="Verbal">Verbal</option>
                      <option value="Pain">Pain</option>
                      <option value="Unresponsive">Unresponsive</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-[#E9D9D0] border border-[#670626]/15 rounded-xl">
                  <div className="flex items-center gap-2 mb-2.5 text-[#670626] text-sm font-bold">
                    <Activity className="w-4 h-4 text-[#A83B4D]" />
                    <span>Vitals *</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#5C313E] mb-1">BP (mmHg) *</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          required
                          min={0}
                          value={activeCasualtyDraft.bpSystolic}
                          onChange={(e) =>
                            handleUpdateActiveCasualtyField('bpSystolic', e.target.value)
                          }
                          className="w-1/2 px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                          placeholder="SYS"
                        />
                        <span className="text-[#670626] font-bold">/</span>
                        <input
                          type="number"
                          required
                          min={0}
                          value={activeCasualtyDraft.bpDiastolic}
                          onChange={(e) =>
                            handleUpdateActiveCasualtyField('bpDiastolic', e.target.value)
                          }
                          className="w-1/2 px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                          placeholder="DIA"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5C313E] mb-1">
                        HR (BPM) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        placeholder="BPM"
                        value={activeCasualtyDraft.heartRate}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('heartRate', e.target.value)
                        }
                        className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5C313E] mb-1">SpO2 (%) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        max={100}
                        placeholder="%"
                        value={activeCasualtyDraft.spO2}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('spO2', e.target.value)
                        }
                        className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5C313E] mb-1">
                        RR (/min) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        placeholder="/min"
                        value={activeCasualtyDraft.respiratoryRate}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('respiratoryRate', e.target.value)
                        }
                        className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#670626] mb-2">
                    Interventions
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_INTERVENTIONS.map((item) => {
                      const isSelected = activeCasualtyDraft.interventions.includes(item);
                      return (
                        <button
                          type="button"
                          key={item}
                          onClick={() => handleToggleCasualtyIntervention(item)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 border cursor-pointer ${
                            isSelected
                              ? 'bg-[#670626] border-[#670626] text-[#F7F1EA]'
                              : 'bg-[#E9D9D0] border-[#670626]/20 text-[#670626] hover:border-[#670626]'
                          }`}
                        >
                          <Check
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'opacity-100 text-[#F7F1EA]' : 'opacity-30'
                            }`}
                          />
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-[#670626] mb-1.5">
                      Chief Complaint
                    </label>
                    <input
                      type="text"
                      value={activeCasualtyDraft.chiefComplaint}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('chiefComplaint', e.target.value)
                      }
                      placeholder="Primary injury or symptom"
                      className="w-full px-3.5 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] text-sm focus:outline-none focus:border-[#670626]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#670626] mb-1.5">
                      Field Notes
                    </label>
                    <textarea
                      rows={2}
                      value={activeCasualtyDraft.narrative}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('narrative', e.target.value)
                      }
                      placeholder="Triage notes..."
                      className="w-full px-3.5 py-2.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] text-sm focus:outline-none focus:border-[#670626] resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#670626]/15">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddNewPcrVital}
                icon={<Plus className="w-4 h-4" />}
              >
                + Add PCR
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActivePcrIncident(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="action-green"
                  size="sm"
                  isLoading={isSavingPcr}
                  icon={<HeartPulse className="w-4 h-4" />}
                >
                  Save ({draftCasualties.length})
                </Button>
              </div>
            </div>
          </form>
        </DefaultFloatingModalCard>
      )}

      {activeBlotterIncident && (
        <PoliceBlotterModal
          isOpen={activeBlotterIncident !== null}
          onClose={() => setActiveBlotterIncident(null)}
          reportId={activeBlotterIncident.id}
          defaultLocation={activeBlotterIncident.locationLabel || 'Reported Location'}
          onSuccess={(blotter) => {
            showToast(`Blotter ${blotter.blotterNumber} sealed`);
            void loadIncidents();
          }}
        />
      )}
    </div>
  );
};

export default UnitIncidentsFeed;
