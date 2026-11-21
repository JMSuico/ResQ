// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Casualty Field Dispatches feed allocated to the active responder agency with tactical progression controls,
// backend-connected sort/filter tabs, 3-option Call Backup modal, 40-image timestamped Evidence lightbox modal,
// multi-casualty PCR vitals ("ADD NEW PCR VITAL"), green pointer "RESPONDED" state (#10B981), and "SUBMIT REPORT" to Incident Logs.
// Strictly uses arrow lambda functions (=>), pure lucide-react icons, and @/Shared + @/Hooks primitives.

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
  ReportItem,
  sendEmergencyBroadcast,
  verifyReport
} from '@/Endpoints/reportsApi';
import {
  submitPcrRecord,
  getPcrRecords,
  CreatePcrPayload
} from '@/Endpoints/responderOpsApi';
import {
  Button,
  ImageLightboxModal,
  SearchBar,
  TableCardToggle,
  useTableCardView,
  DefaultFloatingModalCard,
  Dropdown,
  FireAlarmEscalationModal,
  PoliceBlotterModal
} from '@/Shared';
import { formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';
import { BASELINE_INCIDENT_REPORTS } from '@/Libs/Assets/baselineFixtures';
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
  chiefComplaint: string;
  narrative: string;
  interventions: string[];
  recordedAt: string;
  pcrReference?: string;
}

export interface IncidentLogSubmission {
  id: string;
  incidentId: string;
  referenceCode: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  pointerColor: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  responderName: string;
  responderUnit: string;
  evidences: EvidenceMediaItem[];
  pcrRecords: CasualtyVitalEntry[];
  submittedAt: string;
  submittedAtFormatted: string;
  adminAiVerified: boolean;
  countdownSecondsRemaining: number;
  evidencePhotos?: Array<{
    id?: string;
    url: string;
    timestamp?: string;
    caption?: string;
    latitude?: number;
    longitude?: number;
  }>;
  casualties?: Array<{
    id?: string;
    patientName: string;
    age?: number | string;
    gender?: string;
    triageColor?: 'Red' | 'Yellow' | 'Green' | 'Black';
    triageTag?: string;
    consciousness?: string;
    levelOfConsciousness?: string;
    bloodPressure?: string;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number | string;
    heartRateBpm?: number;
    respiratoryRate?: number | string;
    oxygenSaturation?: number | string;
    spO2Percent?: number;
    glucose?: number;
    bloodGlucoseMgDl?: number;
    temperature?: number | string;
    temperatureCelsius?: number;
    chiefComplaint?: string;
    treatmentNotes?: string;
    narrative?: string;
    interventions?: string[];
    recordedAt?: string;
    pcrReference?: string;
  }>;
  isVerified?: boolean;
  verifiedAt?: string;
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

const createBlankCasualtyEntry = (indexNum: number): CasualtyVitalEntry => ({
  id: `pcr-casualty-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  patientName: indexNum > 1 ? `Casualty Patient #${indexNum}` : '',
  age: 28,
  gender: 'Male',
  levelOfConsciousness: 'Alert',
  bpSystolic: 120,
  bpDiastolic: 80,
  heartRate: 78,
  respiratoryRate: 16,
  spO2: 98,
  glucose: 105,
  temp: 36.8,
  chiefComplaint: '',
  narrative: '',
  interventions: [],
  recordedAt: formatExactTimestampWithSeconds(new Date())
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
  const [filterMode, setFilterMode] = useState<FilterTabMode>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('CRITICAL_FIRST');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const { viewMode, setViewMode } = useTableCardView('card');

  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [selectedDetailIncident, setSelectedDetailIncident] = useState<ReportItem | null>(null);

  // Task 3: 3-Option Backup Modal State
  const [backupModalIncident, setBackupModalIncident] = useState<ReportItem | null>(null);
  const [selectedBackupOption, setSelectedBackupOption] = useState<string>(BACKUP_OPTIONS[0].id);
  const [backupAgency, setBackupAgency] = useState<'RHU' | 'FIRE' | 'PNP' | 'ALL'>('ALL');
  const [backupNote, setBackupNote] = useState<string>('');
  const [dispatchChannel, setDispatchChannel] = useState<string>('KATIPUNAN-C2-TAC1');

  // Task 4: 40-Image Timestamped Evidence Modal State
  const [evidenceModalIncident, setEvidenceModalIncident] = useState<ReportItem | null>(null);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, EvidenceMediaItem[]>>(() => {
    try {
      const raw = localStorage.getItem('resqtrack_incident_evidences');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [selectedEvidenceSlot, setSelectedEvidenceSlot] = useState<number>(0);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>('Field Incident Photographic Evidence');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Task 5: Multi-Casualty PCR Vitals, RESPONDED (#10B981), SUBMIT REPORT & 5-Min Verification Countdown
  const [activePcrIncident, setActivePcrIncident] = useState<ReportItem | null>(null);
  const [pcrRecordsByIncident, setPcrRecordsByIncident] = useState<Record<string, CasualtyVitalEntry[]>>(() => {
    try {
      const raw = localStorage.getItem('resqtrack_pcr_records');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [draftCasualties, setDraftCasualties] = useState<CasualtyVitalEntry[]>([createBlankCasualtyEntry(1)]);
  const [activeCasualtyTabIndex, setActiveCasualtyTabIndex] = useState<number>(0);
  const [isSavingPcr, setIsSavingPcr] = useState<boolean>(false);

  const [respondedMap, setRespondedMap] = useState<Record<string, { respondedAt: string; pointerColor: string; responderName: string }>>(() => {
    try {
      const raw = localStorage.getItem('resqtrack_responded_incidents');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [countdownTimers, setCountdownTimers] = useState<Record<string, { remaining: number; verified: boolean; closed: boolean }>>(() => {
    try {
      const raw = localStorage.getItem('resqtrack_verification_countdowns');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [activeAlarmIncident, setActiveAlarmIncident] = useState<ReportItem | null>(null);
  const [activeBlotterIncident, setActiveBlotterIncident] = useState<ReportItem | null>(null);

  const showToast = useCallback((msg: string) => {
    setActionSuccessToast(msg);
    setTimeout(() => setActionSuccessToast(null), 3500);
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

  const loadIncidents = useCallback(async () => {
    const targetUnit = activeAgencyUnit;
    let aiVisionCache: Record<string, Partial<ReportItem>> = {};
    try {
      const cachedAiRaw = localStorage.getItem('resqtrack_ai_vision_by_report');
      if (cachedAiRaw) {
        aiVisionCache = JSON.parse(cachedAiRaw) as Record<string, Partial<ReportItem>>;
      }
    } catch {}

    const enrichList = (list: ReportItem[]): ReportItem[] =>
      list.map((r) => {
        const cached = aiVisionCache[r.id] || (r.referenceCode ? aiVisionCache[r.referenceCode] : undefined);
        return {
          ...r,
          roboflowModelId: r.roboflowModelId ?? cached?.roboflowModelId,
          roboflowPrediction: r.roboflowPrediction ?? cached?.roboflowPrediction,
          roboflowConfidence: r.roboflowConfidence ?? cached?.roboflowConfidence,
          roboflowNeedsReview: r.roboflowNeedsReview ?? cached?.roboflowNeedsReview,
          claudeModelUsed: r.claudeModelUsed ?? cached?.claudeModelUsed,
          claudeIncidentCategory: r.claudeIncidentCategory ?? cached?.claudeIncidentCategory,
          claudeSituationSummary: r.claudeSituationSummary ?? cached?.claudeSituationSummary,
          claudeVisibleHazards: r.claudeVisibleHazards ?? cached?.claudeVisibleHazards,
          claudeUncertaintyNotes: r.claudeUncertaintyNotes ?? cached?.claudeUncertaintyNotes,
          pointerIconType: r.pointerIconType ?? cached?.pointerIconType
        };
      });

    try {
      const data = await getAgencyReports(targetUnit);
      if (Array.isArray(data) && data.length > 0) {
        setIncidents(enrichList(data));
      } else {
        const agencyFiltered = BASELINE_INCIDENT_REPORTS.filter((r) => {
          const rec = (r.recommendedAgencyUnit || '').toUpperCase();
          const alloc = (r.allocatedUnitCode || '').toUpperCase();
          return rec.includes(targetUnit) || alloc.includes(targetUnit);
        });
        setIncidents(enrichList(agencyFiltered.length > 0 ? agencyFiltered : BASELINE_INCIDENT_REPORTS));
      }
    } catch (err) {
      console.error('Failed to load agency incident dispatches:', err);
      setIncidents((prev) => (prev.length > 0 ? prev : enrichList(BASELINE_INCIDENT_REPORTS)));
    } finally {
      setLoading(false);
    }
  }, [activeAgencyUnit]);

  useValueRefreshAuto(loadIncidents, {
    intervalMs: 6000,
    enabled: true
  });

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  // Seed initial evidence items from incident imageUrl if not yet populated
  useEffect(() => {
    if (incidents.length === 0) return;
    setEvidenceMap((prev) => {
      let mutated = false;
      const next = { ...prev };
      incidents.forEach((inc) => {
        if (!next[inc.id] || next[inc.id].length === 0) {
          const initialList: EvidenceMediaItem[] = [];
          if (inc.imageUrl) {
            initialList.push({
              id: `ev-init-${inc.id}-1`,
              slotIndex: 1,
              url: inc.imageUrl,
              mediaType: 'image',
              caption: `${inc.referenceCode} — Initial Field Capture (${inc.title})`,
              capturedAtFormatted: formatExactTimestampWithSeconds(inc.createdAt),
              capturedAtIso: inc.createdAt || new Date().toISOString(),
              uploadedBy: inc.reporterName || 'Field Civilian Sensor'
            });
            mutated = true;
          }
          if (initialList.length > 0) {
            next[inc.id] = initialList;
          }
        }
      });
      if (mutated) {
        try {
          localStorage.setItem('resqtrack_incident_evidences', JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
      }
      return mutated ? next : prev;
    });
  }, [incidents]);

  // 1-second tick for 5-minute verification countdowns (05:00 -> 00:00 -> Closed)
  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdownTimers((prev) => {
        const keys = Object.keys(prev);
        if (keys.length === 0) return prev;
        let changed = false;
        const next = { ...prev };
        keys.forEach((incId) => {
          const entry = next[incId];
          if (entry && entry.verified && !entry.closed && entry.remaining > 0) {
            const nextRemaining = entry.remaining - 1;
            changed = true;
            if (nextRemaining <= 0) {
              next[incId] = { remaining: 0, verified: true, closed: true };
              setIncidents((currIncidents) =>
                currIncidents.map((item) =>
                  item.id === incId ? { ...item, status: 'Closed' } : item
                )
              );
              verifyReport(incId, 'Closed', '5-minute post-verification countdown completed. Green pointer faded out & case 100% solved.').catch(() => undefined);
            } else {
              next[incId] = { ...entry, remaining: nextRemaining };
            }
          }
        });
        if (changed) {
          try {
            localStorage.setItem('resqtrack_verification_countdowns', JSON.stringify(next));
          } catch {
            // ignore
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Agency Emblem & Title (FIX #6: FIRE branch displays 'Reports')
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

  // Effective status helper incorporating local Responded / Closed progression
  const getEffectiveStatus = useCallback(
    (inc: ReportItem): string => {
      const timer = countdownTimers[inc.id];
      if (timer?.closed || inc.status === 'Closed') return 'Closed';
      if (respondedMap[inc.id] && inc.status !== 'Resolved' && inc.status !== 'Closed') {
        return 'Responded';
      }
      return inc.status;
    },
    [countdownTimers, respondedMap]
  );

  // Task 2: Live Counts for Filter Tabs
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

  // Task 2: Filtered + Sorted Incidents
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

  // Task 2: Global Pagination Hook
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

  // Task 3: NAVIGATE GPS redirect to /responder?expandMap=true&focusIncidentId={incident.id}
  const handleNavigateGpsToTraumaBoard = (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      localStorage.setItem(
        'resqtrack_focus_incident',
        JSON.stringify({
          incidentId: inc.id,
          referenceCode: inc.referenceCode,
          latitude: inc.latitude,
          longitude: inc.longitude,
          title: inc.title,
          pointerColor: respondedMap[inc.id]?.pointerColor || '#EF4444',
          expandMap: true,
          timestamp: new Date().toISOString()
        })
      );
    } catch {
      // ignore storage error
    }

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

  // Task 3: Execute 3-Option Call Backup Action
  const handleExecuteBackupOption = async (optionId: string) => {
    if (!backupModalIncident) return;
    const chosenOption = BACKUP_OPTIONS.find((o) => o.id === optionId) || BACKUP_OPTIONS[0];
    const nowFormatted = formatExactTimestampWithSeconds(new Date());

    const backupRecord = {
      id: `backup-${Date.now()}`,
      incidentId: backupModalIncident.id,
      referenceCode: backupModalIncident.referenceCode,
      incidentTitle: backupModalIncident.title,
      locationLabel:
        backupModalIncident.locationLabel ||
        formatGpsCoord(backupModalIncident.latitude, backupModalIncident.longitude),
      latitude: backupModalIncident.latitude,
      longitude: backupModalIncident.longitude,
      optionId: chosenOption.id,
      optionLabel: chosenOption.label,
      targetAgency: backupAgency,
      note: backupNote,
      dispatchChannel,
      requestedBy: session?.fullName || 'Field Responder',
      requesterUnit: session?.unit || 'RHU',
      timestamp: nowFormatted
    };

    try {
      const existingRaw = localStorage.getItem('resqtrack_backup_requests');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      localStorage.setItem('resqtrack_backup_requests', JSON.stringify([backupRecord, ...existing]));
    } catch {
      // ignore storage error
    }

    try {
      await sendEmergencyBroadcast({
        title: `Backup Request · ${backupModalIncident.referenceCode}`,
        message: `${chosenOption.label} — ${backupNote} (Target: ${backupAgency}, Channel: ${dispatchChannel})`,
        severity: 'Critical'
      });
    } catch {
      // fallback to local event bus
    }

    dispatchReportEvent({
      type: 'BACKUP_REQUEST_DISPATCHED',
      backupRecord
    });

    broadcastNotificationEvent(
      `Backup Request · ${backupModalIncident.referenceCode}`,
      `${chosenOption.label} (${nowFormatted})`,
      { backupRecord }
    );

    if (optionId === 'OPTION_3_OFFICIAL_DISPATCH') {
      showToast(`Official dispatch message sent on ${dispatchChannel}`);
    } else if (optionId === 'OPTION_2_NEARBY_DISTRESS') {
      showToast('Distress signal sent to nearby units');
    } else {
      showToast('Backup request sent to Admin');
    }

    setBackupModalIncident(null);
  };

  // Task 4: Open 40-Image Timestamped Evidence Modal
  const openEvidenceModal = (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEvidenceModalIncident(inc);
    setSelectedEvidenceSlot(0);
  };

  const handleUploadEvidenceFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!evidenceModalIncident || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const currentList = evidenceMap[evidenceModalIncident.id] || [];
    const remainingSlots = MAX_EVIDENCE_SLOTS - currentList.length;

    if (remainingSlots <= 0) {
      showToast(`Max 40 evidence items reached for ${evidenceModalIncident.referenceCode}`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) return;
        const now = new Date();
        const isVideo = file.type.startsWith('video/');
        setEvidenceMap((prev) => {
          const existing = prev[evidenceModalIncident.id] || [];
          if (existing.length >= MAX_EVIDENCE_SLOTS) return prev;
          const newSlotNumber = existing.length + 1;
          const newItem: EvidenceMediaItem = {
            id: `ev-${evidenceModalIncident.id}-${Date.now()}-${idx}`,
            slotIndex: newSlotNumber,
            url: dataUrl,
            mediaType: isVideo ? 'video' : 'image',
            caption: `${file.name} (${newSlotNumber}/40)`,
            capturedAtFormatted: formatExactTimestampWithSeconds(now),
            capturedAtIso: now.toISOString(),
            uploadedBy: session?.fullName || 'RHU Field Responder'
          };
          const updatedList = [...existing, newItem];
          const nextMap = { ...prev, [evidenceModalIncident.id]: updatedList };
          try {
            localStorage.setItem('resqtrack_incident_evidences', JSON.stringify(nextMap));
          } catch {
            // ignore storage limit
          }
          return nextMap;
        });
      };
      reader.readAsDataURL(file);
    });

    showToast(`Attached ${filesToProcess.length} file(s) to ${evidenceModalIncident.referenceCode}`);
    e.target.value = '';
  };

  const handleGenerateTacticalEvidenceSnapshot = () => {
    if (!evidenceModalIncident) return;
    const currentList = evidenceMap[evidenceModalIncident.id] || [];
    if (currentList.length >= MAX_EVIDENCE_SLOTS) {
      showToast(`All 40 evidence slots full (${evidenceModalIncident.referenceCode})`);
      return;
    }

    const now = new Date();
    const formattedTs = formatExactTimestampWithSeconds(now);
    const nextSlot = currentList.length + 1;

    // Generate deterministic SVG data URL with exact date & time including seconds and AM/PM
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
      <rect width="800" height="500" fill="#4A041A"/>
      <rect x="20" y="20" width="760" height="460" rx="16" fill="#F7F1EA" stroke="#670626" stroke-width="2"/>
      <text x="45" y="65" fill="#670626" font-family="monospace" font-size="20" font-weight="bold">RESQTRACK FIELD EVIDENCE CAPTURE // SLOT #${nextSlot} OF 40</text>
      <text x="45" y="105" fill="#2B010E" font-family="sans-serif" font-size="24" font-weight="bold">${evidenceModalIncident.referenceCode} - ${evidenceModalIncident.title.replace(/[<>&"']/g, '')}</text>
      <text x="45" y="145" fill="#047857" font-family="monospace" font-size="18" font-weight="bold">TIMESTAMP: ${formattedTs}</text>
      <text x="45" y="180" fill="#5C313E" font-family="monospace" font-size="15">GPS LOCK: ${formatGpsCoord(evidenceModalIncident.latitude, evidenceModalIncident.longitude)} (${evidenceModalIncident.locationLabel || 'Katipunan Sector'})</text>
      <text x="45" y="215" fill="#A83B4D" font-family="monospace" font-size="15">SEVERITY: ${String(evidenceModalIncident.severity ?? 'HIGH').toUpperCase()} | RESPONDER: ${session?.fullName || 'Field Responder'}</text>
      <rect x="45" y="250" width="710" height="190" rx="12" fill="#E9D9D0" stroke="#A83B4D" stroke-width="1"/>
      <text x="400" y="345" text-anchor="middle" fill="#670626" font-family="monospace" font-size="16">VERIFIED HARDWARE GEOLOCATED OPTICAL TELEMETRY FRAME #${nextSlot}</text>
      <text x="400" y="375" text-anchor="middle" fill="#A83B4D" font-family="monospace" font-size="14">${formattedTs}</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`;

    const newItem: EvidenceMediaItem = {
      id: `ev-${evidenceModalIncident.id}-${Date.now()}`,
      slotIndex: nextSlot,
      url: dataUrl,
      mediaType: 'image',
      caption: `Field Optical Evidence #${nextSlot} — ${formattedTs}`,
      capturedAtFormatted: formattedTs,
      capturedAtIso: now.toISOString(),
      uploadedBy: session?.fullName || 'RHU Field Responder'
    };

    const updated = [...currentList, newItem];
    const nextMap = { ...evidenceMap, [evidenceModalIncident.id]: updated };
    setEvidenceMap(nextMap);
    setSelectedEvidenceSlot(updated.length - 1);
    try {
      localStorage.setItem('resqtrack_incident_evidences', JSON.stringify(nextMap));
    } catch {
      // ignore
    }
    showToast(`Captured evidence #${nextSlot}/40`);
  };

  const handleRemoveEvidenceSlot = (incidentId: string, evidenceId: string) => {
    setEvidenceMap((prev) => {
      const current = prev[incidentId] || [];
      const filtered = current
        .filter((item) => item.id !== evidenceId)
        .map((item, idx) => ({ ...item, slotIndex: idx + 1 }));
      const nextMap = { ...prev, [incidentId]: filtered };
      try {
        localStorage.setItem('resqtrack_incident_evidences', JSON.stringify(nextMap));
      } catch {
        // ignore
      }
      return nextMap;
    });
    setSelectedEvidenceSlot(0);
  };

  // Task 5: Open Multi-Casualty PCR Modal
  const openPcrModalForIncident = async (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActivePcrIncident(inc);
    const localSaved = pcrRecordsByIncident[inc.id] || [];
    if (localSaved.length > 0) {
      setDraftCasualties(localSaved);
      setActiveCasualtyTabIndex(0);
      return;
    }

    try {
      const apiRecords = await getPcrRecords(inc.id);
      if (apiRecords && apiRecords.length > 0) {
        const mapped: CasualtyVitalEntry[] = apiRecords.map((r) => ({
          id: r.id,
          patientName: r.patientName,
          age: r.age,
          gender: r.gender,
          levelOfConsciousness: r.levelOfConsciousness,
          bpSystolic: r.bloodPressureSystolic,
          bpDiastolic: r.bloodPressureDiastolic,
          heartRate: r.heartRateBpm,
          respiratoryRate: r.respiratoryRate,
          spO2: r.spO2Percent,
          glucose: r.bloodGlucoseMgDl,
          temp: r.temperatureCelsius,
          chiefComplaint: r.chiefComplaint,
          narrative: r.narrative,
          interventions: r.interventions || [],
          recordedAt: formatExactTimestampWithSeconds(r.createdAt),
          pcrReference: r.pcrReference
        }));
        setDraftCasualties(mapped);
        setActiveCasualtyTabIndex(0);
        return;
      }
    } catch {
      // fallback to blank entry
    }

    setDraftCasualties([createBlankCasualtyEntry(1)]);
    setActiveCasualtyTabIndex(0);
  };

  // Task 5: "ADD NEW PCR VITAL" button handler for multiple injured persons/civilians
  const handleAddNewPcrVital = () => {
    setDraftCasualties((prev) => {
      const nextIndex = prev.length + 1;
      const newEntry = createBlankCasualtyEntry(nextIndex);
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
    setIsSavingPcr(true);

    const validatedEntries = draftCasualties.map((entry, idx) => ({
      ...entry,
      patientName: entry.patientName.trim() || `Unidentified Casualty #${idx + 1}`,
      recordedAt: formatExactTimestampWithSeconds(new Date())
    }));

    try {
      for (const entry of validatedEntries) {
        const payload: CreatePcrPayload = {
          reportId: activePcrIncident.id,
          patientName: entry.patientName,
          age: Number(entry.age) || 0,
          gender: entry.gender,
          levelOfConsciousness: entry.levelOfConsciousness,
          bloodPressureSystolic: Number(entry.bpSystolic) || 120,
          bloodPressureDiastolic: Number(entry.bpDiastolic) || 80,
          heartRateBpm: Number(entry.heartRate) || 80,
          respiratoryRate: Number(entry.respiratoryRate) || 16,
          spO2Percent: Number(entry.spO2) || 98,
          bloodGlucoseMgDl: Number(entry.glucose) || 100,
          temperatureCelsius: Number(entry.temp) || 36.8,
          interventions: entry.interventions,
          chiefComplaint: entry.chiefComplaint,
          narrative: entry.narrative,
          medicName: session?.fullName || 'RHU Paramedic',
          unitCode: session?.unit || 'RHU-EMS'
        };
        try {
          const res = await submitPcrRecord(payload);
          if (res?.data?.pcrReference) {
            entry.pcrReference = res.data.pcrReference;
          }
        } catch {
          entry.pcrReference = entry.pcrReference || `PCR-${Date.now().toString().slice(-6)}`;
        }
      }

      const nextPcrMap = {
        ...pcrRecordsByIncident,
        [activePcrIncident.id]: validatedEntries
      };
      setPcrRecordsByIncident(nextPcrMap);
      localStorage.setItem('resqtrack_pcr_records', JSON.stringify(nextPcrMap));

      dispatchReportEvent({
        type: 'MULTI_CASUALTY_PCR_SAVED',
        incidentId: activePcrIncident.id,
        referenceCode: activePcrIncident.referenceCode,
        casualtyCount: validatedEntries.length,
        records: validatedEntries
      });

      showToast(
        `Saved ${validatedEntries.length} PCR record(s) for ${activePcrIncident.referenceCode}`
      );
      setActivePcrIncident(null);
    } finally {
      setIsSavingPcr(false);
    }
  };

  // Task 5: "RESPONDED" Button -> Marks incident Responded & turns radar pointer GREEN (#10B981)
  const handleMarkRespondedGreenPointer = async (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nowFormatted = formatExactTimestampWithSeconds(new Date());
    const responderName = session?.fullName || 'RHU Field Responder';

    const nextRespondedMap = {
      ...respondedMap,
      [inc.id]: {
        respondedAt: nowFormatted,
        pointerColor: '#10B981',
        responderName
      }
    };
    setRespondedMap(nextRespondedMap);
    try {
      localStorage.setItem('resqtrack_responded_incidents', JSON.stringify(nextRespondedMap));
    } catch {
      // ignore
    }

    setIncidents((prev) =>
      prev.map((item) => (item.id === inc.id ? { ...item, status: 'Responded' } : item))
    );

    try {
      await verifyReport(
        inc.id,
        'Responded',
        `Incident marked RESPONDED by ${responderName} at ${nowFormatted}. Radar pointer set to GREEN (#10B981).`
      );
    } catch {
      // continue with local + event bus state
    }

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
  };

  // Instructor #4, #7: Authorized Responder Incident Verification (Verify / Reject / Dispatch)
  const handleVerifyIncidentAction = async (
    inc: ReportItem,
    nextStatus: 'Verified' | 'Rejected' | 'Allocated',
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    const responderName = session?.fullName || `${activeAgencyUnit} Responder`;
    const nowFormatted = formatExactTimestampWithSeconds(new Date());
    const actionLabel =
      nextStatus === 'Allocated' ? 'Dispatched' : nextStatus;

    setIncidents((prev) =>
      prev.map((item) =>
        item.id === inc.id
          ? {
              ...item,
              status: nextStatus,
              verifiedAt: nextStatus === 'Verified' || nextStatus === 'Allocated' ? new Date().toISOString() : item.verifiedAt
            }
          : item
      )
    );

    try {
      await verifyReport(
        inc.id,
        nextStatus,
        `Incident ${actionLabel} by ${responderName} (${activeAgencyUnit}) at ${nowFormatted}.`
      );
    } catch (err: unknown) {
      console.warn('[UnitIncidentsFeed] verifyReport transition fallback:', err);
    }

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
  };

  // Task 5: "SUBMIT REPORT" Button -> Submits evidences & multi-casualty PCRs to Admin and saves into "INCIDENT LOGS"
  const handleSubmitReportToIncidentLogs = async (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const now = new Date();
    const nowFormatted = formatExactTimestampWithSeconds(now);
    const incEvidences = evidenceMap[inc.id] || [];
    const incPcrs = pcrRecordsByIncident[inc.id] || [];

    // Ensure incident is also marked Responded with green pointer (#10B981)
    if (!respondedMap[inc.id]) {
      await handleMarkRespondedGreenPointer(inc);
    }

    const logSubmission: IncidentLogSubmission = {
      id: `log-${inc.id}-${Date.now()}`,
      incidentId: inc.id,
      referenceCode: inc.referenceCode,
      title: inc.title,
      category: inc.category,
      severity: inc.severity,
      status: 'Responded',
      pointerColor: '#10B981',
      latitude: inc.latitude,
      longitude: inc.longitude,
      locationLabel: inc.locationLabel || formatGpsCoord(inc.latitude, inc.longitude),
      responderName: session?.fullName || 'RHU Field Responder',
      responderUnit: session?.unit || 'RHU',
      evidences: incEvidences,
      pcrRecords: incPcrs,
      submittedAt: now.toISOString(),
      submittedAtFormatted: nowFormatted,
      adminAiVerified: true,
      countdownSecondsRemaining: COUNTDOWN_TOTAL_SECONDS,
      evidencePhotos: incEvidences.map((e, idx) => ({
        id: e.id || `photo-${inc.id}-${idx}`,
        url: e.url,
        timestamp: e.capturedAtFormatted || nowFormatted,
        caption: e.caption || `Field Evidence #${idx + 1}`,
        latitude: inc.latitude,
        longitude: inc.longitude
      })),
      casualties: incPcrs.map((pcr) => ({
        id: pcr.id,
        patientName: pcr.patientName,
        age: pcr.age,
        gender: pcr.gender,
        triageColor: (pcr.spO2 < 92 || pcr.heartRate > 120 ? 'Red' : 'Yellow') as 'Red' | 'Yellow' | 'Green' | 'Black',
        triageTag: pcr.spO2 < 92 || pcr.heartRate > 120 ? 'RED — IMMEDIATE' : 'YELLOW — DELAYED',
        consciousness: pcr.levelOfConsciousness,
        levelOfConsciousness: pcr.levelOfConsciousness,
        bloodPressure: `${pcr.bpSystolic}/${pcr.bpDiastolic}`,
        bloodPressureSystolic: pcr.bpSystolic,
        bloodPressureDiastolic: pcr.bpDiastolic,
        heartRate: pcr.heartRate,
        heartRateBpm: pcr.heartRate,
        respiratoryRate: pcr.respiratoryRate,
        oxygenSaturation: pcr.spO2,
        spO2Percent: pcr.spO2,
        glucose: pcr.glucose,
        bloodGlucoseMgDl: pcr.glucose,
        temperature: pcr.temp,
        temperatureCelsius: pcr.temp,
        chiefComplaint: pcr.chiefComplaint,
        treatmentNotes: pcr.narrative,
        narrative: pcr.narrative,
        interventions: pcr.interventions,
        recordedAt: pcr.recordedAt || nowFormatted,
        pcrReference: pcr.pcrReference
      })),
      isVerified: true,
      verifiedAt: now.toISOString()
    };

    try {
      const existingRaw = localStorage.getItem('resqtrack_incident_logs');
      const existingLogs: IncidentLogSubmission[] = existingRaw ? JSON.parse(existingRaw) : [];
      const filteredLogs = existingLogs.filter((l) => l.incidentId !== inc.id);
      const updatedLogs = [logSubmission, ...filteredLogs];
      localStorage.setItem('resqtrack_incident_logs', JSON.stringify(updatedLogs));
    } catch {
      // ignore storage error
    }

    // Activate 5-minute Admin/AI verification countdown timer (05:00 -> 00:00 -> Closed)
    setCountdownTimers((prev) => {
      const next = {
        ...prev,
        [inc.id]: {
          remaining: COUNTDOWN_TOTAL_SECONDS,
          verified: true,
          closed: false
        }
      };
      try {
        localStorage.setItem('resqtrack_verification_countdowns', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    try {
      await verifyReport(
        inc.id,
        'Resolved',
        `Field Report submitted to INCIDENT LOGS by ${session?.fullName || 'Responder'} with ${incEvidences.length} evidence item(s) and ${incPcrs.length} PCR vital record(s). 05:00 verification countdown initiated.`
      );
    } catch {
      // fallback to local state
    }

    dispatchReportEvent({
      type: 'INCIDENT_REPORT_SUBMITTED_TO_LOGS',
      logSubmission
    });

    broadcastNotificationEvent(
      `Report Submitted · ${inc.referenceCode}`,
      `${incEvidences.length} Evidence · ${incPcrs.length} PCR · 05:00 countdown started`,
      { logSubmission }
    );

    showToast(`${inc.referenceCode} submitted to Incident Logs`);
  };

  const handleCompleteCountdownImmediately = (inc: ReportItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCountdownTimers((prev) => {
      const next = {
        ...prev,
        [inc.id]: { remaining: 0, verified: true, closed: true }
      };
      try {
        localStorage.setItem('resqtrack_verification_countdowns', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setIncidents((prev) =>
      prev.map((item) => (item.id === inc.id ? { ...item, status: 'Closed' } : item))
    );
    showToast(`${inc.referenceCode} closed`);
  };

  const activeCasualtyDraft = draftCasualties[activeCasualtyTabIndex] || draftCasualties[0];
  const currentModalEvidences = evidenceModalIncident
    ? evidenceMap[evidenceModalIncident.id] || []
    : [];
  const activeEvidenceItem = currentModalEvidences[selectedEvidenceSlot] || null;

  return (
    <div className="flex flex-col gap-6 text-[#2B010E] select-none pb-8 w-full">
      {/* Toast Notification */}
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

          {/* Rapid Field Telemetry Badges */}
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
              placeholder="Search ref, location, reporter..."
              className="w-full sm:w-60"
            />

            {/* Priority / Severity Sort Selector */}
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
            No matching dispatches.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        /* CARD VIEW */
        <div className="flex flex-col gap-4">
          {paginatedItems.map((inc) => {
            const effectiveStatus = getEffectiveStatus(inc);
            const isResponded = effectiveStatus === 'Responded' || Boolean(respondedMap[inc.id]);
            const isRejected = effectiveStatus === 'Rejected';
            const isAwaitingVerification =
              effectiveStatus === 'Reported' ||
              effectiveStatus === 'Submitted' ||
              effectiveStatus === 'Pending';
            const timerState = countdownTimers[inc.id];
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
                {/* Left: Visual Evidence & Telemetry Details */}
                <div className="flex flex-col sm:flex-row items-start gap-4 w-full xl:w-auto">
                  {/* Evidence Thumbnail */}
                  <div
                    className="relative flex-shrink-0"
                    onClick={(e) => openEvidenceModal(inc, e)}
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
                          0/40
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Incident Context & Header */}
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

                      {timerState?.verified && !timerState.closed && (
                        <span className="px-3 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-700/35 text-xs font-mono font-black inline-flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{formatCountdownMmSs(timerState.remaining)}</span>
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
                            AI Scene Verification · Roboflow ({inc.roboflowModelId || 'accident-and-non-accident-label-image-dataset/14'}):{' '}
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
                  {/* Authorized Responder Verification Controls for Submitted/Pending Incidents (Instructor #4, #7) */}
                  {isAwaitingVerification && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleVerifyIncidentAction(inc, 'Verified', e)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold shadow-sm cursor-pointer"
                        title="Verify submitted incident"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleVerifyIncidentAction(inc, 'Allocated', e)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] text-xs font-mono font-bold shadow-sm cursor-pointer"
                        title="Dispatch unit to incident"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleVerifyIncidentAction(inc, 'Rejected', e)}
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
                      onClick={(e) => handleVerifyIncidentAction(inc, 'Allocated', e)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] text-xs font-mono font-bold shadow-sm cursor-pointer"
                      title="Dispatch unit to verified incident"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch</span>
                    </button>
                  )}

                  {/* TASK 3: NAVIGATE GPS Redirect to EMS Trauma Board Expanded Map */}
                  <button
                    type="button"
                    onClick={(e) => handleNavigateGpsToTraumaBoard(inc, e)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                    title="Open map focused on this incident"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Navigate</span>
                  </button>

                  {/* TASK 3: 3-Option Backup Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setBackupModalIncident(inc);
                      setBackupNote(
                        `Backup requested at ${inc.locationLabel || 'Katipunan Sector'} (${inc.referenceCode})`
                      );
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                    title="Request backup"
                  >
                    <Shield className="w-4 h-4 text-[#A83B4D]" />
                    <span>Backup</span>
                  </button>

                  {/* TASK 4: 40-Image Timestamped EVIDENCE Lightbox Modal Trigger */}
                  <button
                    type="button"
                    onClick={(e) => openEvidenceModal(inc, e)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                    title="View or attach evidence"
                  >
                    <Camera className="w-4 h-4 text-[#A83B4D]" />
                    <span>Evidence ({incEvidences.length}/40)</span>
                  </button>

                  {/* TASK 5: Specialized Agency Operation Trigger */}
                  {activeAgencyUnit === 'RHU' && (
                    <button
                      type="button"
                      onClick={(e) => openPcrModalForIncident(inc, e)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-700/30 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                      title="Record patient vitals"
                    >
                      <HeartPulse className="w-4 h-4 text-rose-700" />
                      <span>PCR {incPcrs.length > 0 ? `(${incPcrs.length})` : ''}</span>
                    </button>
                  )}

                  {activeAgencyUnit === 'FIRE' && (
                    <button
                      type="button"
                      onClick={() => setActiveAlarmIncident(inc)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-700/30 text-xs font-mono font-bold active:scale-95 transition-all cursor-pointer"
                      title="Update Fire Alarm Level"
                    >
                      <Flame className="w-4 h-4 text-amber-700" />
                      <span>Fire Alarm</span>
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
                      {/* TASK 5: "RESPONDED" Green Pointer Button (#10B981) */}
                      <button
                        type="button"
                        onClick={(e) => handleMarkRespondedGreenPointer(inc, e)}
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

                      {/* TASK 5: "SUBMIT REPORT" Button to Admin & INCIDENT LOGS */}
                      <button
                        type="button"
                        onClick={(e) => handleSubmitReportToIncidentLogs(inc, e)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-mono text-xs font-black border border-[#670626] shadow-sm active:scale-95 transition-all cursor-pointer"
                        title="Submit report to Incident Logs"
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
        /* TABLE VIEW */
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
                const isResponded = effectiveStatus === 'Responded' || Boolean(respondedMap[inc.id]);
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
                              onClick={(e) => handleVerifyIncidentAction(inc, 'Verified', e)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleVerifyIncidentAction(inc, 'Allocated', e)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold text-xs cursor-pointer"
                            >
                              Dispatch
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleVerifyIncidentAction(inc, 'Rejected', e)}
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
                              `Backup requested at ${inc.locationLabel || 'Katipunan Sector'}`
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Backup</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => openEvidenceModal(inc, e)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] border border-[#670626]/20 font-bold text-xs cursor-pointer"
                        >
                          Evidence
                        </button>
                        {activeAgencyUnit === 'RHU' && (
                          <button
                            type="button"
                            onClick={(e) => openPcrModalForIncident(inc, e)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-700/25 font-bold text-xs cursor-pointer"
                          >
                            PCR
                          </button>
                        )}
                        {activeAgencyUnit === 'FIRE' && (
                          <button
                            type="button"
                            onClick={() => setActiveAlarmIncident(inc)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-700/25 font-bold text-xs cursor-pointer"
                          >
                            Alarm
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
                              onClick={(e) => handleMarkRespondedGreenPointer(inc, e)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
                            >
                              Responded
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSubmitReportToIncidentLogs(inc, e)}
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
                    openEvidenceModal(target);
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
                      onClick={(e) => handleVerifyIncidentAction(selectedDetailIncident, 'Verified', e)}
                      icon={<Check className="w-4 h-4" />}
                    >
                      Verify
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => handleVerifyIncidentAction(selectedDetailIncident, 'Rejected', e)}
                      icon={<XCircle className="w-4 h-4" />}
                    >
                      Reject
                    </Button>
                  </>
                )}
                <Button
                  variant="action-green"
                  size="sm"
                  onClick={() => handleMarkRespondedGreenPointer(selectedDetailIncident)}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Responded
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSubmitReportToIncidentLogs(selectedDetailIncident)}
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
                    AI Scene Verification · Roboflow (
                    {selectedDetailIncident.roboflowModelId ||
                      'accident-and-non-accident-label-image-dataset/14'}
                    ): {selectedDetailIncident.roboflowPrediction || 'incident'}
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

            {/* 5-Minute Verification Countdown */}
            {countdownTimers[selectedDetailIncident.id]?.verified && (
              <div className="p-4 rounded-xl bg-emerald-100 border-2 border-emerald-700/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <span>Verification Countdown</span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    Auto-closes at 00:00.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-2 rounded-xl bg-[#F7F1EA] border border-emerald-700/35 text-xl font-black text-emerald-900">
                    {formatCountdownMmSs(countdownTimers[selectedDetailIncident.id].remaining)}
                  </span>
                  {!countdownTimers[selectedDetailIncident.id].closed && (
                    <Button
                      variant="action-green"
                      size="xs"
                      onClick={(e) => handleCompleteCountdownImmediately(selectedDetailIncident, e)}
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

      {/* 3-Option Backup Modal (Official Digital/Radio Dispatch — zero phone/email hotlines) */}
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
                onClick={() => handleExecuteBackupOption(selectedBackupOption)}
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

            {/* 3 Backup Options */}
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
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-black flex-shrink-0 ${
                            isSelected ? 'bg-[#670626] text-[#F7F1EA]' : 'bg-[#E9D9D0] text-[#670626]'
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBackupOption(opt.id);
                          handleExecuteBackupOption(opt.id);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-mono text-xs font-bold flex-shrink-0 cursor-pointer"
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
                  <span>Radio / Digital Dispatch Channel</span>
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

      {/* 40-Image Timestamped Evidence Modal */}
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
                used
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleUploadEvidenceFiles}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={currentModalEvidences.length >= MAX_EVIDENCE_SLOTS}
                  icon={<Upload className="w-4 h-4" />}
                >
                  Upload
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateTacticalEvidenceSnapshot}
                  disabled={currentModalEvidences.length >= MAX_EVIDENCE_SLOTS}
                  icon={<Camera className="w-4 h-4" />}
                >
                  Capture Frame (+1)
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Active Evidence Viewer */}
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
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveEvidenceSlot(evidenceModalIncident.id, activeEvidenceItem.id)
                      }
                      className="p-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-700/30 cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                No evidence recorded. Upload or capture a frame below.
              </div>
            )}

            {/* 40-Slot Interactive Matrix (1..40) */}
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
                          handleGenerateTacticalEvidenceSnapshot();
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
                          : `Slot #${idx + 1}`
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

      {/* Multi-Casualty PCR Vitals Modal */}
      {activePcrIncident && (
        <DefaultFloatingModalCard
          isOpen={activePcrIncident !== null}
          onClose={() => setActivePcrIncident(null)}
          title={`PCR Vitals — ${activePcrIncident.referenceCode}`}
          subtitle={`${draftCasualties.length} patient(s)`}
          size="2xl"
        >
          <form onSubmit={handleSaveAllCasualtyPcrRecords} className="space-y-4 text-[#2B010E]">
            {/* Multi-Casualty Selector Strip */}
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

                {/* Patient Demographics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-[#670626] mb-1.5">
                      Patient Name
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
                    <label className="block text-sm font-bold text-[#670626] mb-1.5">Age</label>
                    <input
                      type="number"
                      min={0}
                      max={150}
                      value={activeCasualtyDraft.age}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('age', Number(e.target.value))
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

                {/* Vitals Matrix */}
                <div className="p-4 bg-[#E9D9D0] border border-[#670626]/15 rounded-xl">
                  <div className="flex items-center gap-2 mb-2.5 text-[#670626] text-sm font-bold">
                    <Activity className="w-4 h-4 text-[#A83B4D]" />
                    <span>Vitals</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#5C313E] mb-1">BP (mmHg)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={activeCasualtyDraft.bpSystolic}
                          onChange={(e) =>
                            handleUpdateActiveCasualtyField('bpSystolic', Number(e.target.value))
                          }
                          className="w-1/2 px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                          placeholder="SYS"
                        />
                        <span className="text-[#670626] font-bold">/</span>
                        <input
                          type="number"
                          value={activeCasualtyDraft.bpDiastolic}
                          onChange={(e) =>
                            handleUpdateActiveCasualtyField('bpDiastolic', Number(e.target.value))
                          }
                          className="w-1/2 px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                          placeholder="DIA"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5C313E] mb-1">
                        HR (BPM)
                      </label>
                      <input
                        type="number"
                        value={activeCasualtyDraft.heartRate}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('heartRate', Number(e.target.value))
                        }
                        className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5C313E] mb-1">SpO2 (%)</label>
                      <input
                        type="number"
                        value={activeCasualtyDraft.spO2}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('spO2', Number(e.target.value))
                        }
                        className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5C313E] mb-1">
                        RR (/min)
                      </label>
                      <input
                        type="number"
                        value={activeCasualtyDraft.respiratoryRate}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('respiratoryRate', Number(e.target.value))
                        }
                        className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#2B010E]"
                      />
                    </div>
                  </div>
                </div>

                {/* Interventions Checkchips */}
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

                {/* Chief Complaint & Field Notes */}
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

      {/* Fire & Police Compatibility Modals */}
      {activeAlarmIncident && (
        <FireAlarmEscalationModal
          isOpen={activeAlarmIncident !== null}
          onClose={() => setActiveAlarmIncident(null)}
          reportId={activeAlarmIncident.id}
          onSuccess={(alarm) => {
            showToast(`Alarm level: ${alarm.alarmLevel}`);
            loadIncidents();
          }}
        />
      )}

      {activeBlotterIncident && (
        <PoliceBlotterModal
          isOpen={activeBlotterIncident !== null}
          onClose={() => setActiveBlotterIncident(null)}
          reportId={activeBlotterIncident.id}
          defaultLocation={activeBlotterIncident.locationLabel || 'Katipunan Municipal Sector'}
          onSuccess={(blotter) => {
            showToast(`Blotter ${blotter.blotterNumber} sealed`);
            loadIncidents();
          }}
        />
      )}
    </div>
  );
};

export default UnitIncidentsFeed;
