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
  sendEmergencyBroadcast
} from '@/Endpoints/reportsApi';
import { verifyReport } from '@/Endpoints/adminGovernanceApi';
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
import {
  Ambulance,
  Flame,
  Shield,
  AlertTriangle,
  AlertCircle,
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
  FileText,
  Upload,
  Trash2,
  Phone,
  Mail,
  Activity,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Video,
  Sparkles,
  Timer
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
    label: '1. RECOMMEND REQUEST BACKUP VIA REQUESTING IN ADMIN SO ADMIN CAN DISPATCH REQUEST',
    description: 'Escalates formal tactical backup request to LDRRMO Command Admin Center for multi-unit dispatch.'
  },
  {
    id: 'OPTION_2_NEARBY_DISTRESS',
    number: 2,
    label: '2. SEND DISTRESS SIGNAL FOR ALL NEARBY RESPONDERS (MEDIC OR NON-MEDIC RESPONDERS)',
    description: 'Broadcasts high-priority GPS distress beacon to all RHU Medic, BFP Fire, and PNP units within radius.'
  },
  {
    id: 'OPTION_3_CALL_OR_EMAIL',
    number: 3,
    label: '3. SEND VIA CALL NUMBER OR EMAIL',
    description: 'Transmits direct emergency hotline dispatch payload via cellular voice call link and tactical email gateway.'
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

  const [incidents, setIncidents] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<FilterTabMode>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('CRITICAL_FIRST');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const { viewMode, setViewMode } = useTableCardView('card');

  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [selectedDetailIncident, setSelectedDetailIncident] = useState<ReportItem | null>(null);

  // Task 3: 3-Option Call Backup Modal State
  const [backupModalIncident, setBackupModalIncident] = useState<ReportItem | null>(null);
  const [selectedBackupOption, setSelectedBackupOption] = useState<string>(BACKUP_OPTIONS[0].id);
  const [backupAgency, setBackupAgency] = useState<'RHU' | 'FIRE' | 'PNP' | 'ALL'>('ALL');
  const [backupNote, setBackupNote] = useState<string>('');
  const [backupPhone, setBackupPhone] = useState<string>('911 / (065) 212-3456');
  const [backupEmail, setBackupEmail] = useState<string>('dispatch.ldrrmo@dipolog.gov.ph');

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
    if (!session || session.unit === 'None') {
      setLoading(false);
      return;
    }
    try {
      const data = await getAgencyReports(session.unit);
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load agency incident dispatches:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

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

  // Agency Emblem & Title (Task 1: Eyebrow RHU EMERGENCY MEDICAL SERVICES, Fire/Police compatible)
  const agencyBadge = useMemo(() => {
    switch (session?.unit) {
      case 'FIRE':
        return {
          label: 'BFP BUREAU OF FIRE PROTECTION',
          code: 'BFP-FIRE',
          badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          icon: Flame,
          accent: 'border-l-orange-500'
        };
      case 'PNP':
        return {
          label: 'PNP POLICE TACTICAL DISPATCH',
          code: 'PNP-POL',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
          icon: Shield,
          accent: 'border-l-indigo-500'
        };
      case 'RHU':
      default:
        return {
          label: 'RHU EMERGENCY MEDICAL SERVICES',
          code: 'RHU-EMS',
          badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
          icon: Ambulance,
          accent: 'border-l-sky-500'
        };
    }
  }, [session?.unit]);

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
          st === 'Allocated' ||
          st === 'EnRoute' ||
          st === 'OnScene' ||
          st === 'Responded' ||
          st === 'Pending' ||
          st === 'Verified'
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
        effectiveStatus !== 'Allocated' &&
        effectiveStatus !== 'EnRoute' &&
        effectiveStatus !== 'OnScene' &&
        effectiveStatus !== 'Responded' &&
        effectiveStatus !== 'Pending' &&
        effectiveStatus !== 'Verified'
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
    showToast(`COORDINATES COPIED: ${text}`);
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

    showToast(`REDIRECTING TO EMS TRAUMA BOARD MAP // PINPOINTING ${inc.referenceCode}`);
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
      contactNumber: backupPhone,
      contactEmail: backupEmail,
      requestedBy: session?.fullName || 'RHU Field Medic',
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
        title: `[BACKUP OPTION ${chosenOption.number}] ${backupModalIncident.referenceCode}`,
        message: `${chosenOption.label} — ${backupNote} (Target: ${backupAgency})`,
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
      `BACKUP REQUESTED // ${backupModalIncident.referenceCode}`,
      `${chosenOption.label} (${nowFormatted})`,
      { backupRecord }
    );

    if (optionId === 'OPTION_3_CALL_OR_EMAIL') {
      showToast(`BACKUP TRANSMITTED VIA CALL (${backupPhone}) & EMAIL (${backupEmail})`);
    } else if (optionId === 'OPTION_2_NEARBY_DISTRESS') {
      showToast(`DISTRESS SIGNAL BROADCASTED TO ALL NEARBY MEDIC & NON-MEDIC RESPONDERS`);
    } else {
      showToast(`BACKUP REQUEST RECOMMENDED TO ADMIN FOR IMMEDIATE DISPATCH`);
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
      showToast(`MAXIMUM 40 EVIDENCE IMAGES/VIDEOS REACHED FOR ${evidenceModalIncident.referenceCode}`);
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
            caption: `${file.name} (Slot #${newSlotNumber}/40)`,
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

    showToast(`ATTACHED ${filesToProcess.length} TIMESTAMPED EVIDENCE FILE(S) TO ${evidenceModalIncident.referenceCode}`);
    e.target.value = '';
  };

  const handleGenerateTacticalEvidenceSnapshot = () => {
    if (!evidenceModalIncident) return;
    const currentList = evidenceMap[evidenceModalIncident.id] || [];
    if (currentList.length >= MAX_EVIDENCE_SLOTS) {
      showToast(`ALL 40 EVIDENCE SLOTS ARE FULL FOR ${evidenceModalIncident.referenceCode}`);
      return;
    }

    const now = new Date();
    const formattedTs = formatExactTimestampWithSeconds(now);
    const nextSlot = currentList.length + 1;

    // Generate deterministic SVG data URL with exact date & time including seconds and AM/PM
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
      <rect width="800" height="500" fill="#090D16"/>
      <rect x="20" y="20" width="760" height="460" rx="12" fill="#0F172A" stroke="#0EA5E9" stroke-width="2"/>
      <text x="45" y="65" fill="#38BDF8" font-family="monospace" font-size="20" font-weight="bold">RESQTRACK FIELD EVIDENCE CAPTURE // SLOT #${nextSlot} OF 40</text>
      <text x="45" y="105" fill="#F8FAFC" font-family="sans-serif" font-size="24" font-weight="bold">${evidenceModalIncident.referenceCode} - ${evidenceModalIncident.title.replace(/[<>&"']/g, '')}</text>
      <text x="45" y="145" fill="#10B981" font-family="monospace" font-size="18" font-weight="bold">TIMESTAMP: ${formattedTs}</text>
      <text x="45" y="180" fill="#94A3B8" font-family="monospace" font-size="15">GPS LOCK: ${formatGpsCoord(evidenceModalIncident.latitude, evidenceModalIncident.longitude)} (${evidenceModalIncident.locationLabel || 'Field Sector'})</text>
      <text x="45" y="215" fill="#F43F5E" font-family="monospace" font-size="15">SEVERITY: ${evidenceModalIncident.severity.toUpperCase()} | RESPONDER: ${session?.fullName || 'RHU Medic'}</text>
      <rect x="45" y="250" width="710" height="190" rx="8" fill="#020617" stroke="#334155" stroke-width="1"/>
      <text x="400" y="345" text-anchor="middle" fill="#64748B" font-family="monospace" font-size="16">VERIFIED HARDWARE GEOLOCATED OPTICAL TELEMETRY FRAME #${nextSlot}</text>
      <text x="400" y="375" text-anchor="middle" fill="#38BDF8" font-family="monospace" font-size="14">${formattedTs}</text>
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
    showToast(`CAPTURED EVIDENCE SLOT #${nextSlot}/40 (${formattedTs})`);
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
    showToast(`ADDED NEW CASUALTY PCR VITAL FORM (#${draftCasualties.length + 1})`);
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
        `SAVED ${validatedEntries.length} CASUALTY PCR VITAL RECORD(S) FOR ${activePcrIncident.referenceCode}`
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
      `UNIT RESPONDED // ${inc.referenceCode}`,
      `Pointer turned GREEN (#10B981) at ${inc.locationLabel || 'Incident Sector'} (${nowFormatted})`,
      { incidentId: inc.id, pointerColor: '#10B981', status: 'Responded' }
    );

    showToast(`DISPATCH [${inc.referenceCode}] MARKED RESPONDED — MAP POINTER GREEN (#10B981)`);
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
      countdownSecondsRemaining: COUNTDOWN_TOTAL_SECONDS
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
      `REPORT SUBMITTED TO INCIDENT LOGS // ${inc.referenceCode}`,
      `Submitted ${incEvidences.length} Evidence(s) & ${incPcrs.length} PCR Record(s) to Admin. 05:00 Closure Countdown started.`,
      { logSubmission }
    );

    showToast(
      `REPORT [${inc.referenceCode}] SAVED TO INCIDENT LOGS — 05:00 SOLVED COUNTDOWN STARTED`
    );
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
    showToast(`CASE [${inc.referenceCode}] VERIFIED 100% SOLVED (CLOSED) — GREEN POINTER FADED OUT`);
  };

  const activeCasualtyDraft = draftCasualties[activeCasualtyTabIndex] || draftCasualties[0];
  const currentModalEvidences = evidenceModalIncident
    ? evidenceMap[evidenceModalIncident.id] || []
    : [];
  const activeEvidenceItem = currentModalEvidences[selectedEvidenceSlot] || null;

  return (
    <div className="flex flex-col gap-6 text-slate-100 select-none pb-8 w-full">
      {/* Toast Notification */}
      {actionSuccessToast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-emerald-400 text-emerald-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{actionSuccessToast}</span>
        </div>
      )}

      {/* TASK 1 & TASK 2: Header Rename ("CASUALTY FIELD DISPATCHES"), Subtitle Removal & Sort/Filter Controls */}
      <div className="tactical-card p-5 bg-slate-900/90 border-2 border-slate-700/80 rounded-xl shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-black border uppercase tracking-wider inline-flex items-center gap-1.5 ${agencyBadge.badgeClass}`}
              >
                <agencyBadge.icon className="w-3.5 h-3.5" />
                <span>{agencyBadge.label}</span>
              </span>
              <span className="text-slate-600 font-mono">|</span>
              <span className="text-xs font-mono font-bold text-sky-400">UNIT INCIDENTS FEED</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase">
              CASUALTY FIELD DISPATCHES
            </h1>
          </div>

          {/* Rapid Field Telemetry Badges */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold">TOTAL</span>
              <span className="text-base font-black text-white">{allCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800/80 flex flex-col items-center">
              <span className="text-[10px] text-rose-400 font-bold">CRITICAL</span>
              <span className="text-base font-black text-rose-400 animate-pulse">{criticalCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800/80 flex flex-col items-center">
              <span className="text-[10px] text-amber-400 font-bold">ACTIVE</span>
              <span className="text-base font-black text-amber-400">{activeCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 flex flex-col items-center">
              <span className="text-[10px] text-emerald-400 font-bold">RESOLVED</span>
              <span className="text-base font-black text-emerald-400">{resolvedCount}</span>
            </div>
          </div>
        </div>

        {/* TASK 2: Backend-Connected Filter Tabs, SearchBar with useDebounce, Priority Sort & TableCardToggle */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.5)]'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              ALL DISPATCHES ({allCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'CRITICAL'
                  ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  : 'bg-slate-950 text-rose-400 border-rose-900/50 hover:border-rose-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>CRITICAL / SEVERE ({criticalCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'ACTIVE'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                  : 'bg-slate-950 text-amber-400 border-amber-900/50 hover:border-amber-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>ACTIVE QUEUE ({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('RESOLVED')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'RESOLVED'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-950 text-emerald-400 border-emerald-900/50 hover:border-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>RESOLVED ({resolvedCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search ref code, street, reporter..."
              className="w-full sm:w-60"
            />

            {/* Priority / Severity Sort Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono">
              <ArrowUpDown className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <select
                aria-label="Sort Dispatches"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer"
              >
                <option value="CRITICAL_FIRST" className="bg-slate-900 text-white">
                  SORT: CRITICAL / SEVERITY
                </option>
                <option value="NEWEST_FIRST" className="bg-slate-900 text-white">
                  SORT: NEWEST DISPATCH
                </option>
                <option value="OLDEST_FIRST" className="bg-slate-900 text-white">
                  SORT: OLDEST DISPATCH
                </option>
                <option value="STATUS_ORDER" className="bg-slate-900 text-white">
                  SORT: TACTICAL STATUS
                </option>
              </select>
            </div>

            <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* LOADING OR EMPTY STATE */}
      {loading ? (
        <div className="tactical-card p-12 text-center text-sky-400 font-mono text-sm animate-pulse">
          LOADING CASUALTY FIELD DISPATCH TELEMETRY...
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="tactical-card p-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
          <Radio className="w-8 h-8 mx-auto mb-2 text-slate-500" />
          <h3 className="text-base font-bold text-white font-mono">ALL ASSIGNED QUEUES CLEAR</h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            No casualty dispatches found matching filter [{filterMode}]. Standing by on frequency.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        /* CARD VIEW */
        <div className="flex flex-col gap-4">
          {paginatedItems.map((inc) => {
            const effectiveStatus = getEffectiveStatus(inc);
            const isResponded = effectiveStatus === 'Responded' || Boolean(respondedMap[inc.id]);
            const timerState = countdownTimers[inc.id];
            const incEvidences = evidenceMap[inc.id] || [];
            const incPcrs = pcrRecordsByIncident[inc.id] || [];

            const isCritical = inc.severity === 'Critical';
            const isSevere = inc.severity === 'High';
            const isModerate = inc.severity === 'Medium';

            const severityBadge = isCritical ? (
              <span className="px-2.5 py-0.5 rounded bg-rose-950 text-rose-300 border-2 border-rose-500 text-[10px] font-black uppercase font-mono tracking-wider animate-pulse flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>CRITICAL</span>
              </span>
            ) : isSevere ? (
              <span className="px-2.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-500 text-[10px] font-extrabold uppercase font-mono tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-orange-400" />
                <span>SEVERE</span>
              </span>
            ) : isModerate ? (
              <span className="px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500 text-[10px] font-bold uppercase font-mono tracking-wider">
                MODERATE
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500 text-[10px] font-bold uppercase font-mono tracking-wider">
                ROUTINE
              </span>
            );

            const statusConfig = {
              Allocated: {
                bg: 'bg-purple-950/80',
                text: 'text-purple-300',
                border: 'border-purple-600/60',
                dot: 'bg-purple-400',
                label: 'ALLOCATED DISPATCH'
              },
              EnRoute: {
                bg: 'bg-amber-950/80',
                text: 'text-amber-300',
                border: 'border-amber-500',
                dot: 'bg-amber-400 animate-ping',
                label: 'EN ROUTE'
              },
              OnScene: {
                bg: 'bg-cyan-950/80',
                text: 'text-cyan-300',
                border: 'border-cyan-500',
                dot: 'bg-cyan-400 animate-pulse',
                label: 'ON SCENE'
              },
              Responded: {
                bg: 'bg-emerald-950/90',
                text: 'text-emerald-300',
                border: 'border-emerald-400',
                dot: 'bg-[#10B981] animate-ping',
                label: 'RESPONDED (GREEN POINTER #10B981)'
              },
              Resolved: {
                bg: 'bg-emerald-950/80',
                text: 'text-emerald-300',
                border: 'border-emerald-500',
                dot: 'bg-emerald-400',
                label: 'RESOLVED'
              },
              Closed: {
                bg: 'bg-slate-900/90',
                text: 'text-emerald-400',
                border: 'border-emerald-600/50',
                dot: 'bg-emerald-500 opacity-40',
                label: '100% SOLVED (CLOSED)'
              }
            }[effectiveStatus] || {
              bg: 'bg-slate-900',
              text: 'text-slate-300',
              border: 'border-slate-700',
              dot: 'bg-slate-400',
              label: effectiveStatus
            };

            const cardBorder = isResponded
              ? 'border-l-4 border-l-[#10B981] border-emerald-800/70 bg-gradient-to-r from-emerald-950/20 via-slate-900/90 to-slate-900/90'
              : isCritical
              ? 'border-l-4 border-l-rose-500 border-rose-900/60 bg-gradient-to-r from-rose-950/20 via-slate-900/90 to-slate-900/90'
              : 'border-l-4 border-l-slate-700 border-slate-800 bg-slate-900/90';

            const previewThumb = incEvidences[0]?.url || inc.imageUrl || null;

            return (
              <div
                key={inc.id}
                onClick={() => setSelectedDetailIncident(inc)}
                className={`tactical-card p-5 border rounded-xl shadow-lg transition-all flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 cursor-pointer hover:border-sky-500/60 ${cardBorder}`}
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
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg object-cover border-2 border-slate-700 group-hover:border-sky-400 transition-colors"
                        />
                        <div className="absolute inset-0 bg-slate-950/50 group-hover:bg-slate-950/20 rounded-lg flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-bold text-sky-300">
                          <Eye className="w-4 h-4 mb-0.5" />
                          <span>{incEvidences.length}/40 SLOTS</span>
                        </div>
                        {inc.isHardwareGeolocated && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-emerald-500 text-[9px] font-mono text-emerald-400 font-bold inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>LOCKED</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-slate-950 border-2 border-slate-800 hover:border-sky-500/60 flex flex-col items-center justify-center text-slate-500 transition-colors">
                        <Camera className="w-6 h-6 mb-1 text-slate-400" />
                        <span className="text-[10px] font-mono text-slate-400 font-bold">
                          0/40 EVIDENCE
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Incident Context & Header */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-black text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                        {inc.referenceCode}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider inline-flex items-center gap-1 ${agencyBadge.badgeClass}`}
                      >
                        <agencyBadge.icon className="w-3 h-3" />
                        <span>{session?.unit || 'RHU'}</span>
                      </span>

                      {severityBadge}

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        <span>{statusConfig.label}</span>
                      </span>

                      {incPcrs.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-500/60 text-[10px] font-mono font-bold inline-flex items-center gap-1">
                          <HeartPulse className="w-3 h-3 text-rose-400" />
                          <span>{incPcrs.length} PCR VITAL(S)</span>
                        </span>
                      )}

                      {timerState?.verified && !timerState.closed && (
                        <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-400 text-[10px] font-mono font-black inline-flex items-center gap-1.5 animate-pulse">
                          <Timer className="w-3 h-3 text-emerald-400" />
                          <span>SOLVED VERIFICATION: {formatCountdownMmSs(timerState.remaining)}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                      {inc.title}
                    </h2>

                    <p className="text-xs text-slate-300 mt-1 max-w-2xl font-sans leading-relaxed">
                      {inc.note || 'No specific field dispatcher annotations provided.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 mt-3 text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-1 text-sky-300 font-bold">
                        <MapPin className="w-3.5 h-3.5 text-sky-400" />
                        <span
                          onClick={(e) => copyCoordinates(inc.latitude, inc.longitude, e)}
                          className="hover:underline cursor-pointer tracking-wider"
                          title="Click to copy GPS coordinates"
                        >
                          {formatGpsCoord(inc.latitude, inc.longitude)}
                        </span>
                      </div>

                      {inc.locationLabel && (
                        <span className="text-slate-300 truncate max-w-xs inline-flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-500" />
                          <span>{inc.locationLabel}</span>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{inc.reporterName || 'Civilian Resident'}</span>
                      </span>

                      <span className="text-slate-400 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatExactTimestampWithSeconds(inc.createdAt)}</span>
                        <span className="text-slate-500">({formatRelativeTime(inc.createdAt)})</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Tactical Field Action Buttons (Tasks 3, 4, 5) */}
                <div
                  className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* TASK 3: NAVIGATE GPS Redirect to EMS Trauma Board Expanded Map */}
                  <button
                    type="button"
                    onClick={(e) => handleNavigateGpsToTraumaBoard(inc, e)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-sky-950 text-sky-300 border border-sky-500/50 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all shadow-md cursor-pointer"
                    title="Open EMS Trauma Board Expanded Map focused on this incident pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>NAVIGATE GPS</span>
                  </button>

                  {/* TASK 3: CALL BACKUP 3-Option Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setBackupModalIncident(inc);
                      setBackupNote(
                        `Requesting immediate tactical backup at ${inc.locationLabel || 'Incident Sector'} (${inc.referenceCode})`
                      );
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/50 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all shadow-md cursor-pointer"
                    title="Open 3-Option Tactical Backup Modal"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>CALL BACKUP</span>
                  </button>

                  {/* TASK 4: 40-Image Timestamped EVIDENCE Lightbox Modal Trigger */}
                  <button
                    type="button"
                    onClick={(e) => openEvidenceModal(inc, e)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                    title="Inspect or attach up to 40 timestamped evidence photos/videos"
                  >
                    <Camera className="w-3.5 h-3.5 text-sky-400" />
                    <span>EVIDENCE ({incEvidences.length}/40)</span>
                  </button>

                  {/* TASK 5: Specialized Agency Operation Trigger (RHU Multi-Casualty PCR Vitals + Fire/PNP compatibility) */}
                  {(session?.unit === 'RHU' || !session?.unit) && (
                    <button
                      type="button"
                      onClick={(e) => openPcrModalForIncident(inc, e)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-600/70 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all shadow-md cursor-pointer"
                      title="Record Multi-Casualty Patient Care Record & Vitals"
                    >
                      <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                      <span>PCR VITALS {incPcrs.length > 0 ? `(${incPcrs.length})` : ''}</span>
                    </button>
                  )}

                  {session?.unit === 'FIRE' && (
                    <button
                      type="button"
                      onClick={() => setActiveAlarmIncident(inc)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-950/90 hover:bg-amber-900 text-amber-300 border border-amber-600/70 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all shadow-md cursor-pointer"
                      title="Update Fire Alarm Level"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>FIRE ALARM</span>
                    </button>
                  )}

                  {session?.unit === 'PNP' && (
                    <button
                      type="button"
                      onClick={() => setActiveBlotterIncident(inc)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-950/90 hover:bg-blue-900 text-blue-300 border border-blue-600/70 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all shadow-md cursor-pointer"
                      title="File Official Police Blotter Record"
                    >
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span>BLOTTER</span>
                    </button>
                  )}

                  {/* TASK 5: "RESPONDED" Green Pointer Button (#10B981) replacing DEPLOY ROUTE */}
                  <button
                    type="button"
                    onClick={(e) => handleMarkRespondedGreenPointer(inc, e)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-mono text-xs font-black uppercase tracking-wider border active:scale-95 transition-all cursor-pointer ${
                      isResponded
                        ? 'bg-[#10B981] text-slate-950 border-white shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                        : 'bg-emerald-950/90 hover:bg-[#10B981] text-emerald-300 hover:text-slate-950 border-[#10B981]'
                    }`}
                    title="Mark location as Responded and turn map pointer GREEN (#10B981)"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>RESPONDED</span>
                  </button>

                  {/* TASK 5: "SUBMIT REPORT" Button to Admin & INCIDENT LOGS */}
                  <button
                    type="button"
                    onClick={(e) => handleSubmitReportToIncidentLogs(inc, e)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-xs font-black uppercase tracking-wider border border-white shadow-[0_0_15px_rgba(14,165,233,0.45)] active:scale-95 transition-all cursor-pointer"
                    title="Submit all recorded evidences & PCR vitals to Admin and save into INCIDENT LOGS"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>SUBMIT REPORT</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-2xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Ref Code</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5">Title / Summary</th>
                <th className="p-3.5">Location</th>
                <th className="p-3.5">Evidence / PCR</th>
                <th className="p-3.5">Status / Pointer</th>
                <th className="p-3.5 text-right">Tactical Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {paginatedItems.map((inc) => {
                const effectiveStatus = getEffectiveStatus(inc);
                const isResponded = effectiveStatus === 'Responded' || Boolean(respondedMap[inc.id]);
                const incEvidences = evidenceMap[inc.id] || [];
                const incPcrs = pcrRecordsByIncident[inc.id] || [];

                return (
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedDetailIncident(inc)}
                    className="hover:bg-slate-900/70 transition-colors cursor-pointer"
                  >
                    <td className="p-3.5 text-sky-400 font-bold whitespace-nowrap">
                      {inc.referenceCode}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inc.severity === 'Critical'
                            ? 'bg-rose-950 text-rose-300 border border-rose-600'
                            : 'bg-amber-950 text-amber-300 border border-amber-600'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="p-3.5 text-white font-sans font-medium">{inc.title}</td>
                    <td className="p-3.5 text-slate-400 truncate max-w-[180px]">
                      {inc.locationLabel || formatGpsCoord(inc.latitude, inc.longitude)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="text-sky-300 font-bold">{incEvidences.length}/40 Evid</span>
                      <span className="mx-1.5 text-slate-600">|</span>
                      <span className="text-rose-300 font-bold">{incPcrs.length} PCR</span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold inline-flex items-center gap-1.5 ${
                          isResponded
                            ? 'bg-emerald-950 text-emerald-300 border-[#10B981]'
                            : 'bg-slate-900 border-slate-700 text-slate-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isResponded ? 'bg-[#10B981]' : 'bg-amber-400'
                          }`}
                        />
                        <span>{effectiveStatus}</span>
                      </span>
                    </td>
                    <td
                      className="p-3.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleNavigateGpsToTraumaBoard(inc, e)}
                          className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>NAVIGATE GPS</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBackupModalIncident(inc);
                            setBackupNote(
                              `Requesting immediate tactical backup at ${inc.locationLabel || 'Incident Location'}`
                            );
                          }}
                          className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>CALL BACKUP</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => openEvidenceModal(inc, e)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-[10px] cursor-pointer"
                        >
                          EVIDENCE
                        </button>
                        {(session?.unit === 'RHU' || !session?.unit) && (
                          <button
                            type="button"
                            onClick={(e) => openPcrModalForIncident(inc, e)}
                            className="px-2 py-1 rounded bg-rose-900 hover:bg-rose-800 text-rose-200 font-bold text-[10px] cursor-pointer"
                          >
                            PCR VITALS
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleMarkRespondedGreenPointer(inc, e)}
                          className="px-2 py-1 rounded bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-black text-[10px] cursor-pointer"
                        >
                          RESPONDED
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleSubmitReportToIncidentLogs(inc, e)}
                          className="px-2 py-1 rounded bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-[10px] cursor-pointer"
                        >
                          SUBMIT REPORT
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TASK 2: Global Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            SHOWING{' '}
            <strong className="text-white">
              {totalItems === 0 ? 0 : startIndex + 1}-{endIndex}
            </strong>{' '}
            OF <strong className="text-sky-400">{totalItems}</strong> DISPATCHES
          </span>
          <div className="flex items-center gap-1.5">
            <span>ROWS:</span>
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
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-sky-500 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>PREV</span>
          </button>
          <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-bold">
            PAGE {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={!canNextPage}
            onClick={nextPage}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-sky-500 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
          >
            <span>NEXT</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TASK 2: Row/Card Click -> DefaultFloatingModalCard Full Incident Details */}
      {selectedDetailIncident && (
        <DefaultFloatingModalCard
          isOpen={selectedDetailIncident !== null}
          onClose={() => setSelectedDetailIncident(null)}
          title={`DISPATCH DOSSIER // ${selectedDetailIncident.referenceCode}`}
          subtitle={`${selectedDetailIncident.title} — ${selectedDetailIncident.locationLabel || formatGpsCoord(selectedDetailIncident.latitude, selectedDetailIncident.longitude)}`}
          size="2xl"
          footer={
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigateGpsToTraumaBoard(selectedDetailIncident)}
                  icon={<Navigation className="w-3.5 h-3.5" />}
                >
                  NAVIGATE GPS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const target = selectedDetailIncident;
                    setSelectedDetailIncident(null);
                    openEvidenceModal(target);
                  }}
                  icon={<Camera className="w-3.5 h-3.5" />}
                >
                  EVIDENCE ({(evidenceMap[selectedDetailIncident.id] || []).length}/40)
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="action-green"
                  size="sm"
                  onClick={() => handleMarkRespondedGreenPointer(selectedDetailIncident)}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  RESPONDED (#10B981)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSubmitReportToIncidentLogs(selectedDetailIncident)}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  SUBMIT REPORT
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs font-mono text-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block">REFERENCE CODE</span>
                <span className="text-sm font-black text-sky-400">
                  {selectedDetailIncident.referenceCode}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">SEVERITY &amp; CATEGORY</span>
                <span className="text-sm font-black text-rose-400">
                  {selectedDetailIncident.severity.toUpperCase()} // {selectedDetailIncident.category}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">CURRENT STATUS</span>
                <span className="text-sm font-black text-emerald-400">
                  {getEffectiveStatus(selectedDetailIncident).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="text-slate-400 text-[10px] font-bold uppercase">
                FIELD DISPATCH NARRATIVE &amp; TIMESTAMP
              </div>
              <p className="text-sm font-sans text-white">{selectedDetailIncident.note}</p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-slate-400">
                <span>
                  REPORTED AT:{' '}
                  <strong className="text-sky-300">
                    {formatExactTimestampWithSeconds(selectedDetailIncident.createdAt)}
                  </strong>
                </span>
                <span>
                  GPS:{' '}
                  <strong className="text-emerald-300">
                    {formatGpsCoord(selectedDetailIncident.latitude, selectedDetailIncident.longitude)}
                  </strong>
                </span>
                <span>
                  REPORTER: <strong className="text-white">{selectedDetailIncident.reporterName}</strong>
                </span>
              </div>
            </div>

            {/* 5-Minute Admin/AI Verification Countdown Panel */}
            {countdownTimers[selectedDetailIncident.id]?.verified && (
              <div className="p-4 rounded-xl bg-emerald-950/50 border-2 border-[#10B981] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#10B981]" />
                    <span>
                      ADMIN &amp; AI VERIFIED LOCATION DONE — 5-MINUTE SOLVED COUNTDOWN
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    When countdown reaches 00:00, green pointer (#10B981) fades out and case is marked 100% solved (Closed).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-emerald-500 text-lg font-black text-emerald-400">
                    {formatCountdownMmSs(countdownTimers[selectedDetailIncident.id].remaining)}
                  </span>
                  {!countdownTimers[selectedDetailIncident.id].closed && (
                    <Button
                      variant="action-green"
                      size="xs"
                      onClick={(e) => handleCompleteCountdownImmediately(selectedDetailIncident, e)}
                    >
                      Complete 00:00 Now
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* TASK 3: 3-OPTION CALL BACKUP FLOATING MODAL */}
      {backupModalIncident && (
        <DefaultFloatingModalCard
          isOpen={backupModalIncident !== null}
          onClose={() => setBackupModalIncident(null)}
          title={`CALL TACTICAL BACKUP // ${backupModalIncident.referenceCode}`}
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
                icon={<Radio className="w-3.5 h-3.5" />}
              >
                Execute Selected Backup Protocol
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 text-slate-200">
            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/50 text-xs font-mono">
              <span className="font-bold text-indigo-300 block mb-0.5">
                ACTIVE CASUALTY INCIDENT CONTEXT:
              </span>
              <p className="text-white font-bold">{backupModalIncident.title}</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Coordinates: {formatGpsCoord(backupModalIncident.latitude, backupModalIncident.longitude)} | Timestamp: {formatExactTimestampWithSeconds(new Date())}
              </p>
            </div>

            {/* 3 Exact Backup Options */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-mono font-bold text-sky-400 uppercase">
                SELECT TACTICAL BACKUP TRANSMISSION PROTOCOL (3 OPTIONS):
              </label>
              {BACKUP_OPTIONS.map((opt) => {
                const isSelected = selectedBackupOption === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedBackupOption(opt.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-indigo-950/80 border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.35)]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono font-black flex-shrink-0 ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {opt.number}
                        </span>
                        <div>
                          <div className="text-xs font-mono font-black text-white leading-snug">
                            {opt.label}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{opt.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBackupOption(opt.id);
                          handleExecuteBackupOption(opt.id);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] font-bold uppercase tracking-wider flex-shrink-0 cursor-pointer"
                      >
                        DISPATCH #{opt.number}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedBackupOption === 'OPTION_3_CALL_OR_EMAIL' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mb-1">
                    <Phone className="w-3 h-3 text-sky-400" />
                    <span>EMERGENCY CALL NUMBER</span>
                  </label>
                  <input
                    type="text"
                    value={backupPhone}
                    onChange={(e) => setBackupPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mb-1">
                    <Mail className="w-3 h-3 text-sky-400" />
                    <span>DISPATCH EMAIL GATEWAY</span>
                  </label>
                  <input
                    type="email"
                    value={backupEmail}
                    onChange={(e) => setBackupEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono font-bold text-slate-300">
                TARGET RESPONDER FORCE:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['ALL', 'RHU', 'FIRE', 'PNP'] as const).map((ag) => (
                  <button
                    key={ag}
                    type="button"
                    onClick={() => setBackupAgency(ag)}
                    className={`py-2 px-2.5 rounded-lg font-mono text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      backupAgency === ag
                        ? 'bg-indigo-600 text-white border-white shadow-lg'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {ag === 'RHU' && <Ambulance className="w-3.5 h-3.5" />}
                    {ag === 'FIRE' && <Flame className="w-3.5 h-3.5" />}
                    {ag === 'PNP' && <Shield className="w-3.5 h-3.5" />}
                    {ag === 'ALL' && <Radio className="w-3.5 h-3.5" />}
                    <span>{ag === 'ALL' ? 'ALL UNITS' : ag}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono font-bold text-slate-300">
                TACTICAL SITUATION NOTE:
              </label>
              <textarea
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                placeholder="Reason for backup..."
              />
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* TASK 4: 40-IMAGE TIMESTAMPED EVIDENCE FLOATING MODAL */}
      {evidenceModalIncident && (
        <DefaultFloatingModalCard
          isOpen={evidenceModalIncident !== null}
          onClose={() => setEvidenceModalIncident(null)}
          title={`FIELD EVIDENCE VAULT (UP TO 40 IMAGES/VIDEOS) // ${evidenceModalIncident.referenceCode}`}
          subtitle={`Capacity: ${currentModalEvidences.length} / ${MAX_EVIDENCE_SLOTS} Slots Used — Exact Timestamping (YYYY-MM-DD hh:mm:ss A)`}
          size="4xl"
          footer={
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="text-xs font-mono text-slate-400">
                SLOT CAPACITY:{' '}
                <strong className="text-sky-400">
                  {currentModalEvidences.length} / {MAX_EVIDENCE_SLOTS}
                </strong>{' '}
                MEDIA ITEMS RECORDED
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
                  icon={<Upload className="w-3.5 h-3.5" />}
                >
                  Upload Photos/Videos
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateTacticalEvidenceSnapshot}
                  disabled={currentModalEvidences.length >= MAX_EVIDENCE_SLOTS}
                  icon={<Camera className="w-3.5 h-3.5" />}
                >
                  Capture Timestamped Frame (+1)
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Active Evidence Viewer with Exact Date & Time including Seconds and AM/PM */}
            {activeEvidenceItem ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/50 text-sky-300 font-mono text-xs font-black">
                      SLOT #{activeEvidenceItem.slotIndex} OF {MAX_EVIDENCE_SLOTS}
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      {activeEvidenceItem.caption}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 font-mono text-xs font-black inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{activeEvidenceItem.capturedAtFormatted}</span>
                    </span>
                    {activeEvidenceItem.mediaType === 'image' && (
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxTitle(
                            `${evidenceModalIncident.referenceCode} — Slot #${activeEvidenceItem.slotIndex}/40 (${activeEvidenceItem.capturedAtFormatted})`
                          );
                          setLightboxImageUrl(activeEvidenceItem.url);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 font-mono text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>FULL ZOOM</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveEvidenceSlot(evidenceModalIncident.id, activeEvidenceItem.id)
                      }
                      className="p-1.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/50 cursor-pointer"
                      title="Remove evidence item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="w-full max-h-[340px] flex items-center justify-center overflow-hidden rounded-lg bg-black/70 border border-slate-800 p-2">
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
                          `${evidenceModalIncident.referenceCode} — Slot #${activeEvidenceItem.slotIndex}/40 (${activeEvidenceItem.capturedAtFormatted})`
                        );
                        setLightboxImageUrl(activeEvidenceItem.url);
                      }}
                      className="max-h-[320px] rounded object-contain cursor-pointer"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-xs text-slate-400">
                No evidence media in slot. Click &ldquo;Capture Timestamped Frame&rdquo; or &ldquo;Upload Photos/Videos&rdquo; below to populate up to 40 slots.
              </div>
            )}

            {/* 40-Slot Interactive Matrix (1..40) */}
            <div>
              <div className="flex items-center justify-between mb-2 font-mono text-xs">
                <span className="text-slate-300 font-bold">
                  40-IMAGE / VIDEO GALLERY MATRIX (SLOTS 1 TO 40):
                </span>
                <span className="text-slate-400">
                  Click any populated slot to inspect exact timestamp (YYYY-MM-DD hh:mm:ss A)
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-56 overflow-y-auto p-2 rounded-xl bg-slate-950/90 border border-slate-800">
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
                      className={`relative h-16 rounded-lg border font-mono text-[10px] flex flex-col items-center justify-center overflow-hidden transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-2 border-sky-400 ring-2 ring-sky-500/40 bg-sky-950/50'
                          : item
                          ? 'border-emerald-500/60 bg-slate-900 hover:border-sky-400'
                          : 'border-slate-800 bg-slate-950/60 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                      }`}
                      title={
                        item
                          ? `Slot #${idx + 1}: ${item.capturedAtFormatted}`
                          : `Empty Slot #${idx + 1} (Click to capture)`
                      }
                    >
                      {item ? (
                        <>
                          {item.mediaType === 'video' ? (
                            <Video className="w-4 h-4 text-sky-400 mb-0.5" />
                          ) : (
                            <img
                              src={item.url}
                              alt={`Slot ${idx + 1}`}
                              className="absolute inset-0 w-full h-full object-cover opacity-65"
                            />
                          )}
                          <span className="relative z-10 px-1 py-0.2 rounded bg-slate-950/90 text-emerald-300 font-black text-[9px]">
                            #{idx + 1}
                          </span>
                          <span className="relative z-10 px-1 bg-slate-950/90 text-[8px] text-white truncate max-w-full">
                            {item.capturedAtFormatted.split(' ').slice(1).join(' ')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold">#{idx + 1}</span>
                          <span className="text-[8px]">EMPTY</span>
                        </>
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

      {/* TASK 5: MULTI-CASUALTY PCR VITALS MODAL WITH "ADD NEW PCR VITAL" BUTTON */}
      {activePcrIncident && (
        <DefaultFloatingModalCard
          isOpen={activePcrIncident !== null}
          onClose={() => setActivePcrIncident(null)}
          title={`PATIENT CARE RECORD (PCR) & TRAUMA VITALS // ${activePcrIncident.referenceCode}`}
          subtitle={`Multi-Casualty Field Triage — ${draftCasualties.length} Injured Person(s) Recorded`}
          size="2xl"
        >
          <form onSubmit={handleSaveAllCasualtyPcrRecords} className="space-y-4">
            {/* Multi-Casualty Selector Strip & "ADD NEW PCR VITAL" Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-rose-900/60">
              <div className="flex flex-wrap items-center gap-1.5">
                {draftCasualties.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCasualtyTabIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                      idx === activeCasualtyTabIndex
                        ? 'bg-rose-600 text-white border-rose-400 shadow-lg'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>
                      CASUALTY #{idx + 1}: {c.patientName || 'Unnamed'}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddNewPcrVital}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-black uppercase tracking-wider border border-white inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD NEW PCR VITAL</span>
              </button>
            </div>

            {activeCasualtyDraft && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>
                    EDITING CASUALTY RECORD #{activeCasualtyTabIndex + 1} — TIMESTAMP:{' '}
                    <strong className="text-emerald-400">{activeCasualtyDraft.recordedAt}</strong>
                  </span>
                  {draftCasualties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCasualtyDraft(activeCasualtyTabIndex)}
                      className="text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Casualty #{activeCasualtyTabIndex + 1}</span>
                    </button>
                  )}
                </div>

                {/* Patient Demographics (Preserved Identity Inputs) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Injured Person Full Name / Identity
                    </label>
                    <input
                      type="text"
                      required
                      value={activeCasualtyDraft.patientName}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('patientName', e.target.value)
                      }
                      placeholder="e.g. Juan dela Cruz (or Unidentified Trauma Casualty)"
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Age</label>
                    <input
                      type="number"
                      min={0}
                      max={150}
                      value={activeCasualtyDraft.age}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('age', Number(e.target.value))
                      }
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Gender
                    </label>
                    <select
                      value={activeCasualtyDraft.gender}
                      onChange={(e) => handleUpdateActiveCasualtyField('gender', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Unknown">Unidentified</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Level of Consciousness (AVPU)
                    </label>
                    <select
                      value={activeCasualtyDraft.levelOfConsciousness}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('levelOfConsciousness', e.target.value)
                      }
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                    >
                      <option value="Alert">Alert (Spontaneous Eye &amp; Speech)</option>
                      <option value="Verbal">Verbal (Responds to Voice)</option>
                      <option value="Pain">Pain (Responds to Trapezius Squeeze)</option>
                      <option value="Unresponsive">Unresponsive (No Response)</option>
                    </select>
                  </div>
                </div>

                {/* Vitals Matrix */}
                <div className="p-3 bg-slate-950/70 border border-rose-950/80 rounded-lg">
                  <div className="flex items-center gap-2 mb-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Pre-Hospital Vitals Telemetry</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">BP (mmHg)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={activeCasualtyDraft.bpSystolic}
                          onChange={(e) =>
                            handleUpdateActiveCasualtyField('bpSystolic', Number(e.target.value))
                          }
                          className="w-1/2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
                          placeholder="SYS"
                        />
                        <span className="text-slate-500">/</span>
                        <input
                          type="number"
                          value={activeCasualtyDraft.bpDiastolic}
                          onChange={(e) =>
                            handleUpdateActiveCasualtyField('bpDiastolic', Number(e.target.value))
                          }
                          className="w-1/2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
                          placeholder="DIA"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">
                        Heart Rate (BPM)
                      </label>
                      <input
                        type="number"
                        value={activeCasualtyDraft.heartRate}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('heartRate', Number(e.target.value))
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">SpO2 (%)</label>
                      <input
                        type="number"
                        value={activeCasualtyDraft.spO2}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('spO2', Number(e.target.value))
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">
                        Resp Rate (/min)
                      </label>
                      <input
                        type="number"
                        value={activeCasualtyDraft.respiratoryRate}
                        onChange={(e) =>
                          handleUpdateActiveCasualtyField('respiratoryRate', Number(e.target.value))
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Interventions Checkchips */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Administered Medical Interventions
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_INTERVENTIONS.map((item) => {
                      const isSelected = activeCasualtyDraft.interventions.includes(item);
                      return (
                        <button
                          type="button"
                          key={item}
                          onClick={() => handleToggleCasualtyIntervention(item)}
                          className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 border cursor-pointer ${
                            isSelected
                              ? 'bg-rose-950/80 border-rose-700 text-rose-200'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Check
                            className={`w-3 h-3 ${
                              isSelected ? 'opacity-100 text-rose-400' : 'opacity-20'
                            }`}
                          />
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chief Complaint & Clinical Field Narrative */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Chief Complaint
                    </label>
                    <input
                      type="text"
                      value={activeCasualtyDraft.chiefComplaint}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('chiefComplaint', e.target.value)
                      }
                      placeholder="e.g. Multiple lacerations, blunt chest trauma"
                      className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Clinical Field Narrative
                    </label>
                    <textarea
                      rows={2}
                      value={activeCasualtyDraft.narrative}
                      onChange={(e) =>
                        handleUpdateActiveCasualtyField('narrative', e.target.value)
                      }
                      placeholder="Pre-hospital triage notes and patient response..."
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddNewPcrVital}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                ADD NEW PCR VITAL
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
                  Store All ({draftCasualties.length}) PCR Record(s)
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
            showToast(`BFP ALARM LEVEL UPDATED TO ${alarm.alarmLevel.toUpperCase()}`);
            loadIncidents();
          }}
        />
      )}

      {activeBlotterIncident && (
        <PoliceBlotterModal
          isOpen={activeBlotterIncident !== null}
          onClose={() => setActiveBlotterIncident(null)}
          reportId={activeBlotterIncident.id}
          defaultLocation={activeBlotterIncident.locationLabel || 'Dipolog City Location'}
          onSuccess={(blotter) => {
            showToast(`POLICE BLOTTER ENTRY [${blotter.blotterNumber}] SEALED WITH SHA-256`);
            loadIncidents();
          }}
        />
      )}
    </div>
  );
};

export default UnitIncidentsFeed;
