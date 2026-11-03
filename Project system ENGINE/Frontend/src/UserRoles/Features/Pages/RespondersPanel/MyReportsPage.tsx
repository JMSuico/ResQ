// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: RHU Emergency Medical Services — INCIDENT LOGS (renamed from PATIENT LOGS)
// Implements 4 N=0 safe telemetry KPI cards, 5-minute verification countdown & auto-close engine,
// multi-source synchronization (/api/incidents, /api/reports/mine, /api/responder-ops/pcr, localStorage 'resqtrack_incident_logs'),
// SearchBar with useDebounce, Sort & Filter tabs, TableCardToggle, Pagination, and DefaultFloatingModalCard drill-down.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  getAllReports,
  getMyReports,
  getAgencyReports,
  createReport,
  verifyReport,
  ReportItem
} from '@/Endpoints/reportsApi';
import { getPcrRecords, PatientCareRecord } from '@/Endpoints/responderOpsApi';
import { requestJson } from '@/Endpoints/apiClient';
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
  Button
} from '@/Shared';
import { formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS } from '@/Libs/Assets/data';
import { BASELINE_INCIDENT_REPORTS } from '@/Libs/Assets/baselineFixtures';
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
  Sparkles,
  Play,
  Lock,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Globe,
  Crosshair,
  FileText,
  Layers
} from 'lucide-react';

const INCIDENT_LOGS_STORAGE_KEY = 'resqtrack_incident_logs';
const FIVE_MINUTES_SECONDS = 300;
const MAX_EVIDENCE_PHOTOS = 40;

export interface EvidencePhotoItem {
  id: string;
  url: string;
  timestamp: string; // YYYY-MM-DD hh:mm:ss A
  caption?: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
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
}

type LogFilterTab = 'ALL_LOGS' | 'ACTIVE_IN_ACTION' | 'VERIFIED_5M_TIMER' | 'CLOSED_SOLVED';
type LogSortMode = 'NEWEST' | 'OLDEST' | 'SEVERITY' | 'TIMER_URGENCY';

// Format timestamp strictly as YYYY-MM-DD hh:mm:ss A
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

// Format remaining seconds as MM:SS
export const formatMmSs = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(clamped / 60)).padStart(2, '0');
  const secs = String(clamped % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

// Compute remaining seconds from verifiedAt using exact formula from FORMULAS_RHU_TELEMETRY.md:
// T_remaining(t) = max(0, 300 - floor((t_now - t_verifiedAt) / 1000))
export const computeRemainingSeconds = (verifiedAt: string | null, nowMs: number): number => {
  if (!verifiedAt) return FIVE_MINUTES_SECONDS;
  const verifiedMs = new Date(verifiedAt).getTime();
  if (Number.isNaN(verifiedMs)) return FIVE_MINUTES_SECONDS;
  const elapsedSeconds = Math.floor((nowMs - verifiedMs) / 1000);
  return Math.max(0, FIVE_MINUTES_SECONDS - elapsedSeconds);
};

export const computeProgressPct = (remainingSeconds: number): number => {
  const pct = (1 - remainingSeconds / FIVE_MINUTES_SECONDS) * 100;
  return Math.min(100, Math.max(0, Number(pct.toFixed(1))));
};

const readStoredLogs = (): Record<string, Partial<IncidentLogEntry>> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(INCIDENT_LOGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const map: Record<string, Partial<IncidentLogEntry>> = {};
      parsed.forEach((item: unknown) => {
        if (item && typeof item === 'object') {
          const rec = item as Partial<IncidentLogEntry> & {
            reportId?: string;
            incidentId?: string;
            evidences?: unknown[];
            pcrRecords?: unknown[];
          };
          const key = rec.id || rec.incidentId || rec.reportId || rec.referenceCode;
          if (key) {
            map[String(key)] = rec;
          }
          if (rec.incidentId) {
            map[String(rec.incidentId)] = rec;
          }
          if (rec.referenceCode) {
            map[String(rec.referenceCode)] = rec;
          }
          if (rec.id) {
            map[String(rec.id)] = rec;
          }
        }
      });
      return map;
    }
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, Partial<IncidentLogEntry>>;
    }
    return {};
  } catch {
    return {};
  }
};

const writeStoredLogs = (logsList: IncidentLogEntry[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INCIDENT_LOGS_STORAGE_KEY, JSON.stringify(logsList));
  } catch (err) {
    console.warn('[MyReportsPage] Failed to persist incident logs to localStorage:', err);
  }
};

const normalizeStatusForActiveFormula = (status: string): 'Dispatched' | 'EnRoute' | 'OnScene' | 'Responded' | string => {
  const s = (status || '').trim();
  if (
    s === 'Dispatched' ||
    s === 'EnRoute' ||
    s === 'OnScene' ||
    s === 'Responded' ||
    s === 'Resolved' ||
    s === 'Closed'
  ) {
    return s;
  }
  if (s === 'Reported' || s === 'Pending' || s === 'Allocated' || s === 'Active') {
    return 'Dispatched';
  }
  if (s === 'Verified') {
    return 'Responded';
  }
  return 'Responded';
};

export const MyReportsPage: React.FC = () => {
  const { session } = useSession();
  const { coords, isHardwareGeolocated } = useGpsLocation();
  const { viewMode, setViewMode } = useTableCardView('card');

  const [logs, setLogs] = useState<IncidentLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [clientIp, setClientIp] = useState<string>('192.168.10.42 (RHU-MDT-LINK)');

  // Search, Debounce, Filter & Sort
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [activeTab, setActiveTab] = useState<LogFilterTab>('ALL_LOGS');
  const [sortMode, setSortMode] = useState<LogSortMode>('NEWEST');

  // Modals & Lightbox
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraTargetLogId, setCameraTargetLogId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Create Field Log Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<string>('Critical');
  const [newCategory, setNewCategory] = useState<string>('MedicalEmergency');
  const [capturedPhotos, setCapturedPhotos] = useState<EvidencePhotoItem[]>([]);
  const [newCasualties, setNewCasualties] = useState<CasualtyVitalsEntry[]>([
    {
      id: 'cas-init-1',
      patientName: 'Unidentified Trauma Patient #1',
      age: 34,
      gender: 'Male',
      triageTag: 'RED — IMMEDIATE',
      levelOfConsciousness: 'Alert (GCS 14)',
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 76,
      heartRateBpm: 96,
      respiratoryRate: 20,
      spO2Percent: 97,
      temperatureCelsius: 36.8,
      bloodGlucoseMgDl: 105,
      chiefComplaint: 'Blunt vehicular trauma & laceration stabilization',
      interventions: ['Cervical Collar', 'O2 Nasal Cannula 4L', 'IV Normal Saline', 'Hemorrhage Control']
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Track which logs have already broadcasted CLOSE_CASE so we only fire once per log transition
  const closedBroadcastSetRef = useRef<Set<string>>(new Set());

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  }, []);

  // Resolve client IP telemetry best-effort
  useEffect(() => {
    let active = true;
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        if (res.ok) {
          const data = (await res.json()) as { ip?: string };
          if (active && data?.ip) {
            setClientIp(`${data.ip} (RHU-MDT-VERIFIED)`);
          }
        }
      } catch {
        // Keep tactical MDT link fallback IP
      }
    };
    void fetchIp();
    return () => {
      active = false;
    };
  }, []);

  // Merge backend reports (/api/reports/mine, /api/reports/agency/RHU, /api/incidents), PCR records (/api/responder-ops/pcr), and localStorage 'resqtrack_incident_logs'
  const loadAllIncidentLogs = useCallback(async () => {
    try {
      const storedMap = readStoredLogs();

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
          id: pcr.id || `pcr-${Date.now()}`,
          patientName: pcr.patientName || 'Trauma Patient',
          age: pcr.age ?? 30,
          gender: pcr.gender || 'Unknown',
          triageTag: pcr.spO2Percent < 92 || pcr.heartRateBpm > 120 ? 'RED — IMMEDIATE' : 'YELLOW — DELAYED',
          levelOfConsciousness: pcr.levelOfConsciousness || 'Alert',
          bloodPressureSystolic: pcr.bloodPressureSystolic || 120,
          bloodPressureDiastolic: pcr.bloodPressureDiastolic || 80,
          heartRateBpm: pcr.heartRateBpm || 84,
          respiratoryRate: pcr.respiratoryRate || 18,
          spO2Percent: pcr.spO2Percent || 98,
          temperatureCelsius: pcr.temperatureCelsius || 36.7,
          bloodGlucoseMgDl: pcr.bloodGlucoseMgDl || 100,
          chiefComplaint: pcr.chiefComplaint || pcr.narrative || 'Field medical stabilization',
          interventions: Array.isArray(pcr.interventions) ? pcr.interventions : [],
          anatomicalInjuries: Array.isArray(pcr.anatomicalInjuries) ? pcr.anatomicalInjuries : [],
          narrative: pcr.narrative,
          recordedAt: formatEvidenceTimestampExact(pcr.createdAt)
        });
      });

      const mergedById = new Map<string, IncidentLogEntry>();

      // 1. Hydrate from stored localStorage logs first (includes CASUALTY FIELD DISPATCHES "SUBMIT REPORT" entries)
      Object.values(storedMap).forEach((stored) => {
        if (!stored || !stored.id) return;
        const id = String(stored.id);
        const verifiedAt = stored.verifiedAt || null;
        const isVerified = Boolean(stored.isVerified || verifiedAt || stored.status === 'Verified');
        const remaining = isVerified ? computeRemainingSeconds(verifiedAt, Date.now()) : FIVE_MINUTES_SECONDS;
        const isClosed = Boolean(
          stored.isClosed ||
            stored.status === 'Closed' ||
            stored.status === 'Resolved' ||
            (isVerified && verifiedAt && remaining === 0)
        );

        type StoredEvidenceRaw = {
          id?: string;
          url?: string;
          dataUrl?: string;
          timestamp?: string;
          capturedAtFormatted?: string;
          capturedAtIso?: string;
          caption?: string;
          name?: string;
          latitude?: number;
          longitude?: number;
          ipAddress?: string;
        };
        const rawEvidenceArray: StoredEvidenceRaw[] =
          Array.isArray(stored.evidencePhotos) && stored.evidencePhotos.length > 0
            ? (stored.evidencePhotos as StoredEvidenceRaw[])
            : Array.isArray((stored as { evidences?: StoredEvidenceRaw[] }).evidences)
            ? ((stored as { evidences: StoredEvidenceRaw[] }).evidences)
            : [];

        const photos: EvidencePhotoItem[] = rawEvidenceArray
          .filter((p) => Boolean(p.url || p.dataUrl))
          .slice(0, MAX_EVIDENCE_PHOTOS)
          .map((p, idx) => ({
            id: p.id || `photo-${id}-${idx}`,
            url: p.url || p.dataUrl || '',
            timestamp: formatEvidenceTimestampExact(p.timestamp || p.capturedAtFormatted || p.capturedAtIso),
            caption: p.caption || p.name || `Field Evidence #${idx + 1}`,
            latitude: p.latitude ?? stored.latitude ?? coords.latitude,
            longitude: p.longitude ?? stored.longitude ?? coords.longitude,
            ipAddress: p.ipAddress || stored.ipAddress || clientIp
          }));

        type StoredCasualtyRaw = {
          id?: string;
          patientName?: string;
          age?: number | string;
          gender?: string;
          triageColor?: string;
          triageTag?: string;
          consciousness?: string;
          levelOfConsciousness?: string;
          bloodPressure?: string;
          bloodPressureSystolic?: number;
          bpSystolic?: number;
          bloodPressureDiastolic?: number;
          bpDiastolic?: number;
          heartRate?: number | string;
          heartRateBpm?: number;
          respiratoryRate?: number | string;
          oxygenSaturation?: number | string;
          spO2Percent?: number;
          spO2?: number;
          temperature?: number | string;
          temperatureCelsius?: number;
          temp?: number;
          glucose?: number;
          bloodGlucoseMgDl?: number;
          chiefComplaint?: string;
          treatmentNotes?: string;
          narrative?: string;
          interventions?: string[];
          anatomicalInjuries?: string[];
          recordedAt?: string;
        };

        const rawCasualtyArray: StoredCasualtyRaw[] =
          Array.isArray(stored.casualties) && stored.casualties.length > 0
            ? (stored.casualties as StoredCasualtyRaw[])
            : Array.isArray((stored as { pcrRecords?: StoredCasualtyRaw[] }).pcrRecords)
            ? ((stored as { pcrRecords: StoredCasualtyRaw[] }).pcrRecords)
            : [];

        const casualties: CasualtyVitalsEntry[] =
          rawCasualtyArray.length > 0
            ? rawCasualtyArray.map((c, idx) => {
                const systolic = c.bloodPressureSystolic ?? c.bpSystolic ?? 120;
                const diastolic = c.bloodPressureDiastolic ?? c.bpDiastolic ?? 80;
                const hr = Number(c.heartRateBpm ?? c.heartRate ?? 84);
                const spo2 = Number(c.spO2Percent ?? c.spO2 ?? c.oxygenSaturation ?? 98);
                return {
                  id: c.id || `pcr-${id}-${idx}`,
                  patientName: c.patientName || 'Trauma Patient',
                  age: typeof c.age === 'number' ? c.age : parseInt(String(c.age || 30), 10) || 30,
                  gender: c.gender || 'Unknown',
                  triageTag: c.triageTag || (spo2 < 92 || hr > 120 ? 'RED — IMMEDIATE' : 'YELLOW — DELAYED'),
                  levelOfConsciousness: c.levelOfConsciousness || c.consciousness || 'Alert',
                  bloodPressureSystolic: systolic,
                  bloodPressureDiastolic: diastolic,
                  heartRateBpm: hr,
                  respiratoryRate: Number(c.respiratoryRate ?? 18),
                  spO2Percent: spo2,
                  temperatureCelsius: Number(c.temperatureCelsius ?? c.temperature ?? c.temp ?? 36.7),
                  bloodGlucoseMgDl: Number(c.bloodGlucoseMgDl ?? c.glucose ?? 100),
                  chiefComplaint: c.chiefComplaint || c.treatmentNotes || c.narrative || 'Field medical stabilization',
                  interventions: Array.isArray(c.interventions) ? c.interventions : [],
                  anatomicalInjuries: Array.isArray(c.anatomicalInjuries) ? c.anatomicalInjuries : [],
                  narrative: c.narrative || c.treatmentNotes,
                  recordedAt: formatEvidenceTimestampExact(c.recordedAt)
                };
              })
            : pcrByReportId[id] || [];

        if (isClosed) {
          closedBroadcastSetRef.current.add(id);
        }

        mergedById.set(id, {
          id,
          referenceCode: stored.referenceCode || `RHU-LOG-${id.slice(0, 6).toUpperCase()}`,
          title: stored.title || 'Field Medical Trauma Dispatch',
          note: stored.note || 'Field medical stabilization and PCR telemetry logged.',
          category: stored.category || 'MedicalEmergency',
          severity: stored.severity || 'High',
          status: isClosed ? 'Closed' : normalizeStatusForActiveFormula(stored.status || 'Responded'),
          isVerified,
          verifiedAt,
          verifiedBy: stored.verifiedBy || (isVerified ? 'LDRRMO Command / AI Triage' : undefined),
          isClosed,
          closedAt: stored.closedAt || (isClosed ? new Date().toISOString() : null),
          latitude: typeof stored.latitude === 'number' ? stored.latitude : coords.latitude,
          longitude: typeof stored.longitude === 'number' ? stored.longitude : coords.longitude,
          locationLabel: stored.locationLabel || 'San Mateo RHU Sector Geotag',
          ipAddress: stored.ipAddress || clientIp,
          responderName: stored.responderName || session?.fullName || 'Dr. Maria Clara Santos MD',
          responderId: stored.responderId || session?.userId || 'rhu-medic-01',
          unitCode: stored.unitCode || session?.unit || 'RHU-ALPHA-1',
          createdAt: stored.createdAt || new Date().toISOString(),
          casualties,
          evidencePhotos: photos,
          isHardwareGeolocated: stored.isHardwareGeolocated ?? true
        });
      });

      // 2. Merge backend ReportItems
      rawReports.forEach((r) => {
        if (!r || !r.id) return;
        const existing = mergedById.get(r.id) || (r.referenceCode ? mergedById.get(r.referenceCode) : undefined);
        const backendVerified = Boolean(
          r.verifiedAt || r.status === 'Verified' || r.status === 'Resolved' || existing?.isVerified
        );
        const verifiedAt =
          existing?.verifiedAt ||
          r.verifiedAt ||
          (backendVerified ? r.createdAt || new Date().toISOString() : null);

        const remaining = backendVerified ? computeRemainingSeconds(verifiedAt, Date.now()) : FIVE_MINUTES_SECONDS;
        const backendClosed = Boolean(
          existing?.isClosed ||
            r.status === 'Resolved' ||
            r.status === 'Closed' ||
            Boolean(r.resolvedAt) ||
            (backendVerified && verifiedAt && remaining === 0)
        );

        if (backendClosed) {
          closedBroadcastSetRef.current.add(r.id);
        }

        const existingPhotos = existing?.evidencePhotos || [];
        const mergedPhotos: EvidencePhotoItem[] = [...existingPhotos];
        if (r.imageUrl && !mergedPhotos.some((p) => p.url === r.imageUrl)) {
          mergedPhotos.unshift({
            id: `photo-main-${r.id}`,
            url: r.imageUrl,
            timestamp: formatEvidenceTimestampExact(r.createdAt),
            caption: 'Primary Field Evidence Snapshot',
            latitude: r.latitude,
            longitude: r.longitude,
            ipAddress: existing?.ipAddress || clientIp
          });
        }

        const casualties =
          existing?.casualties && existing.casualties.length > 0
            ? existing.casualties
            : pcrByReportId[r.id] && pcrByReportId[r.id].length > 0
            ? pcrByReportId[r.id]
            : [
                {
                  id: `cas-${r.id}-1`,
                  patientName: `Field Patient (${r.referenceCode || r.id.slice(0, 6)})`,
                  age: 32,
                  gender: 'Male',
                  triageTag: r.severity === 'Critical' ? 'RED — IMMEDIATE' : 'YELLOW — OBSERVATION',
                  levelOfConsciousness: 'Alert (GCS 15)',
                  bloodPressureSystolic: 122,
                  bloodPressureDiastolic: 78,
                  heartRateBpm: 88,
                  respiratoryRate: 18,
                  spO2Percent: 98,
                  temperatureCelsius: 36.8,
                  bloodGlucoseMgDl: 102,
                  chiefComplaint: r.title || 'Field trauma assessment',
                  interventions: ['Primary Trauma Survey', 'Vitals Telemetry Logged'],
                  recordedAt: formatEvidenceTimestampExact(r.createdAt)
                }
              ];

        mergedById.set(r.id, {
          id: r.id,
          referenceCode: r.referenceCode || existing?.referenceCode || `RHU-${r.id.slice(0, 6).toUpperCase()}`,
          title: r.title || existing?.title || 'Emergency Medical Situation Report',
          note: r.note || existing?.note || 'On-scene triage and patient stabilization executed.',
          category: r.category || existing?.category || 'MedicalEmergency',
          severity: r.severity || existing?.severity || 'High',
          status: backendClosed ? 'Closed' : normalizeStatusForActiveFormula(existing?.status || r.status),
          isVerified: backendVerified,
          verifiedAt,
          verifiedBy: existing?.verifiedBy || (backendVerified ? 'LDRRMO Command / AI Verified' : undefined),
          isClosed: backendClosed,
          closedAt: existing?.closedAt || r.resolvedAt || (backendClosed ? new Date().toISOString() : null),
          latitude: r.latitude ?? existing?.latitude ?? coords.latitude,
          longitude: r.longitude ?? existing?.longitude ?? coords.longitude,
          locationLabel: r.locationLabel || existing?.locationLabel || 'RHU Sector Field Coordinates',
          ipAddress: existing?.ipAddress || clientIp,
          responderName: existing?.responderName || r.reporterName || session?.fullName || 'Dr. Maria Clara Santos MD',
          responderId: existing?.responderId || r.reporterId || session?.userId || 'rhu-medic-01',
          unitCode: existing?.unitCode || r.allocatedUnitCode || session?.unit || 'RHU-EMS-01',
          createdAt: r.createdAt || existing?.createdAt || new Date().toISOString(),
          casualties,
          evidencePhotos: mergedPhotos.slice(0, MAX_EVIDENCE_PHOTOS),
          isHardwareGeolocated: r.isHardwareGeolocated ?? existing?.isHardwareGeolocated ?? true
        });
      });

      // 3. Also include any standalone PCR records not yet linked to a report
      pcrList.forEach((pcr) => {
        const linkedId = pcr.reportId || `pcr-log-${pcr.id}`;
        if (!mergedById.has(linkedId)) {
          mergedById.set(linkedId, {
            id: linkedId,
            referenceCode: pcr.pcrReference || `PCR-${pcr.id.slice(0, 6).toUpperCase()}`,
            title: `PCR Log: ${pcr.patientName} — ${pcr.chiefComplaint || 'Medical Triage'}`,
            note: pcr.narrative || 'Patient Care Record submitted by field medic.',
            category: 'MedicalEmergency',
            severity: pcr.spO2Percent < 92 ? 'Critical' : 'High',
            status: 'Responded',
            isVerified: false,
            verifiedAt: null,
            isClosed: false,
            closedAt: null,
            latitude: coords.latitude,
            longitude: coords.longitude,
            locationLabel: `Unit ${pcr.unitCode || 'RHU'} Field Sector`,
            ipAddress: clientIp,
            responderName: pcr.medicName || session?.fullName || 'Dr. Maria Clara Santos MD',
            responderId: pcr.responderUserId || session?.userId || 'rhu-medic-01',
            unitCode: pcr.unitCode || 'RHU-EMS-01',
            createdAt: pcr.createdAt || new Date().toISOString(),
            casualties: pcrByReportId[pcr.reportId || pcr.id] || [],
            evidencePhotos: [],
            isHardwareGeolocated: true
          });
        }
      });

      if (mergedById.size === 0) {
        BASELINE_INCIDENT_REPORTS.forEach((baseRep, idx) => {
          const verifiedAt = idx === 0 ? new Date(Date.now() - 2 * 60 * 1000).toISOString() : null;
          const isVerified = Boolean(verifiedAt);
          mergedById.set(baseRep.id, {
            id: baseRep.id,
            referenceCode: baseRep.referenceCode,
            title: baseRep.title,
            note: baseRep.note,
            category: baseRep.category,
            severity: baseRep.severity,
            status: isVerified ? 'Verified' : 'Responded',
            isVerified,
            verifiedAt,
            verifiedBy: isVerified ? 'LDRRMO Admin Command' : undefined,
            isClosed: false,
            closedAt: null,
            latitude: baseRep.latitude,
            longitude: baseRep.longitude,
            locationLabel: baseRep.locationLabel,
            ipAddress: '192.168.10.42',
            responderName: session?.fullName || 'Dr. Maria Clara Santos MD',
            responderId: session?.userId || 'rhu-medic-01',
            unitCode: baseRep.allocatedUnitCode || 'AMB-RHU-01',
            createdAt: baseRep.createdAt,
            casualties: [
              {
                id: `cas-base-${baseRep.id}`,
                patientName: 'Casualty Patient (Juan Dela Cruz)',
                age: 28,
                gender: 'Male',
                triageTag: 'RED — IMMEDIATE',
                levelOfConsciousness: 'Alert (GCS 15)',
                bloodPressureSystolic: 120,
                bloodPressureDiastolic: 80,
                heartRateBpm: 78,
                respiratoryRate: 18,
                spO2Percent: 98,
                temperatureCelsius: 36.6,
                bloodGlucoseMgDl: 95,
                chiefComplaint: 'Acute knee laceration & lower limb trauma',
                interventions: ['Wound Irrigation', 'Sterile Dressing', 'Traction Splint'],
                recordedAt: formatEvidenceTimestampExact(baseRep.createdAt)
              }
            ],
            evidencePhotos: baseRep.imageUrl
              ? [
                  {
                    id: `ev-base-${baseRep.id}`,
                    url: baseRep.imageUrl,
                    timestamp: formatEvidenceTimestampExact(baseRep.createdAt),
                    caption: 'Field incident point of impact',
                    latitude: baseRep.latitude,
                    longitude: baseRep.longitude,
                    ipAddress: '192.168.10.42'
                  }
                ]
              : [],
            isHardwareGeolocated: true
          });
        });
      }

      const finalLogs = Array.from(mergedById.values());
      setLogs(finalLogs);
      writeStoredLogs(finalLogs);
    } catch (err) {
      console.error('[MyReportsPage] Failed to load incident logs:', err);
    } finally {
      setLoading(false);
    }
  }, [session, coords.latitude, coords.longitude, clientIp]);

  useValueRefreshAuto(loadAllIncidentLogs, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    void loadAllIncidentLogs();
  }, [loadAllIncidentLogs]);

  // Listen for cross-component incident submissions or verification events
  useEffect(() => {
    const handleExternalUpdate = () => {
      void loadAllIncidentLogs();
    };
    window.addEventListener('resqtrack:report', handleExternalUpdate);
    window.addEventListener('resqtrack:incident_created', handleExternalUpdate);
    window.addEventListener('storage', handleExternalUpdate);
    return () => {
      window.removeEventListener('resqtrack:report', handleExternalUpdate);
      window.removeEventListener('resqtrack:incident_created', handleExternalUpdate);
      window.removeEventListener('storage', handleExternalUpdate);
    };
  }, [loadAllIncidentLogs]);

  // 1-second live tick for 5-Minute Verification Countdown & Auto-Close transitions
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      setLogs((prevLogs) => {
        let didMutate = false;
        const nextLogs = prevLogs.map((log) => {
          if (log.isVerified && !log.isClosed && log.verifiedAt) {
            const rem = computeRemainingSeconds(log.verifiedAt, currentNow);
            if (rem === 0) {
              didMutate = true;
              const closedAtIso = new Date(currentNow).toISOString();

              if (!closedBroadcastSetRef.current.has(log.id)) {
                closedBroadcastSetRef.current.add(log.id);
                // Broadcast resqtrack:notification with 'CLOSE_CASE'
                window.dispatchEvent(
                  new CustomEvent('resqtrack:notification', {
                    detail: {
                      type: 'CLOSE_CASE',
                      action: 'CLOSE_CASE',
                      reportId: log.id,
                      referenceCode: log.referenceCode,
                      title: log.title,
                      message: `Incident ${log.referenceCode} (${log.title}) auto-closed after 5-minute verification timer reached 00:00.`,
                      timestamp: closedAtIso
                    }
                  })
                );
                void verifyReport(
                  log.id,
                  'Resolved',
                  'Case auto-closed (100% solved) upon completion of 5-minute verification timer.'
                ).catch(() => {
                  // Ignore if local-only report
                });
              }

              return {
                ...log,
                isClosed: true,
                status: 'Closed',
                closedAt: closedAtIso
              };
            }
          }
          return log;
        });

        if (didMutate) {
          writeStoredLogs(nextLogs);
          return nextLogs;
        }
        return prevLogs;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Trigger 5-Minute Verification Timer (for testing/demoing or manual/AI verification)
  const handleStartFiveMinTimer = useCallback(
    (logItem: IncidentLogEntry, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const verifiedIso = new Date().toISOString();
      closedBroadcastSetRef.current.delete(logItem.id);

      setLogs((prev) => {
        const updated = prev.map((item) =>
          item.id === logItem.id
            ? {
                ...item,
                status: 'Responded',
                isVerified: true,
                verifiedAt: verifiedIso,
                verifiedBy: 'RHU Command / AI Verification Engine',
                isClosed: false,
                closedAt: null
              }
            : item
        );
        writeStoredLogs(updated);
        return updated;
      });

      void verifyReport(
        logItem.id,
        'Verified',
        `Verified at ${formatEvidenceTimestampExact(verifiedIso)} — 5-minute auto-close countdown initiated.`
      ).catch(() => {
        // Local report fallback
      });

      showToast(`5-MIN CLOSING TIMER STARTED FOR ${logItem.referenceCode} (05:00)`);
    },
    [showToast]
  );

  // Fast-forward timer to last 5 seconds so user/tester can immediately witness the 00:00 auto-close transition if desired
  const handleSimulateFinalSeconds = useCallback(
    (logItem: IncidentLogEntry, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const almostDoneIso = new Date(Date.now() - (FIVE_MINUTES_SECONDS - 5) * 1000).toISOString();
      closedBroadcastSetRef.current.delete(logItem.id);

      setLogs((prev) => {
        const updated = prev.map((item) =>
          item.id === logItem.id
            ? {
                ...item,
                status: 'Responded',
                isVerified: true,
                verifiedAt: almostDoneIso,
                verifiedBy: 'RHU Command / AI Verification Engine',
                isClosed: false,
                closedAt: null
              }
            : item
        );
        writeStoredLogs(updated);
        return updated;
      });

      showToast(`TIMER SET TO 00:05 FOR ${logItem.referenceCode} — WATCH AUTO-CLOSE!`);
    },
    [showToast]
  );

  // ============================================================================
  // TASK 2: 4 EXACT KPI TELEMETRY CARDS (N=0 SAFE FORMULAS FROM FORMULAS_RHU_TELEMETRY.md)
  // 1. TOTAL LOGGED: N_totalLogged(r) = |L(r)|
  // 2. ACTIVE IN ACTION: N_activeInAction(r) = |{ l in L(r) | l.status in {"Dispatched","EnRoute","OnScene","Responded"} AND NOT l.isClosed }|
  // 3. VERIFIED ACTIONED: N_verifiedActioned(r) = |{ l in L(r) | l.isVerified = true }|
  // 4. RESOLVED MISSIONS: N_resolvedMissions(r) = |{ l in L(r) | l.isClosed = true OR (l.isVerified = true AND T_remaining(l) = 0) }|
  // ============================================================================
  const { totalLogged, activeInAction, verifiedActioned, resolvedMissions, verifiedActiveTimerCount } = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const total = safeLogs.length;

    let activeCount = 0;
    let verifiedCount = 0;
    let resolvedCount = 0;
    let timerRunningCount = 0;

    const activeStatuses = new Set(['Dispatched', 'EnRoute', 'OnScene', 'Responded']);

    safeLogs.forEach((l) => {
      const rem = l.isVerified ? computeRemainingSeconds(l.verifiedAt, nowMs) : FIVE_MINUTES_SECONDS;
      const effectivelyClosed = Boolean(l.isClosed || (l.isVerified && rem === 0));

      if (activeStatuses.has(l.status) && !effectivelyClosed) {
        activeCount += 1;
      }
      if (l.isVerified === true) {
        verifiedCount += 1;
      }
      if (effectivelyClosed) {
        resolvedCount += 1;
      }
      if (l.isVerified && !effectivelyClosed && rem > 0) {
        timerRunningCount += 1;
      }
    });

    return {
      totalLogged: total,
      activeInAction: activeCount,
      verifiedActioned: verifiedCount,
      resolvedMissions: resolvedCount,
      verifiedActiveTimerCount: timerRunningCount
    };
  }, [logs, nowMs]);

  // Filter & Sort Logs
  const filteredAndSortedLogs = useMemo(() => {
    const activeStatuses = new Set(['Dispatched', 'EnRoute', 'OnScene', 'Responded']);
    const q = debouncedSearch.trim().toLowerCase();

    const filtered = logs.filter((l) => {
      const rem = l.isVerified ? computeRemainingSeconds(l.verifiedAt, nowMs) : FIVE_MINUTES_SECONDS;
      const effectivelyClosed = Boolean(l.isClosed || (l.isVerified && rem === 0));

      if (activeTab === 'ACTIVE_IN_ACTION') {
        if (!activeStatuses.has(l.status) || effectivelyClosed) return false;
      } else if (activeTab === 'VERIFIED_5M_TIMER') {
        if (!l.isVerified || effectivelyClosed || rem <= 0) return false;
      } else if (activeTab === 'CLOSED_SOLVED') {
        if (!effectivelyClosed) return false;
      }

      if (q.length > 0) {
        const refMatch = l.referenceCode.toLowerCase().includes(q);
        const titleMatch = l.title.toLowerCase().includes(q);
        const locMatch = l.locationLabel.toLowerCase().includes(q);
        const noteMatch = l.note.toLowerCase().includes(q);
        const medicMatch = l.responderName.toLowerCase().includes(q);
        const casualtyMatch = l.casualties.some(
          (c) =>
            c.patientName.toLowerCase().includes(q) ||
            c.chiefComplaint.toLowerCase().includes(q)
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
      if (sortMode === 'TIMER_URGENCY') {
        const remA = a.isVerified && !a.isClosed ? computeRemainingSeconds(a.verifiedAt, nowMs) : 9999;
        const remB = b.isVerified && !b.isClosed ? computeRemainingSeconds(b.verifiedAt, nowMs) : 9999;
        return remA - remB;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [logs, activeTab, debouncedSearch, sortMode, nowMs]);

  // Pagination via @/Hooks/usePagination
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

  // Camera capture handler (either for new incident log or appending up to 40 photos to an existing log)
  const handleCameraCapture = useCallback(
    (dataUrl: string, meta: CameraCaptureMetadata) => {
      const exactStamp = formatEvidenceTimestampExact(new Date());
      const newPhoto: EvidencePhotoItem = {
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url: dataUrl,
        timestamp: exactStamp,
        caption: `Geotagged Evidence (${exactStamp})`,
        latitude: meta.latitude ?? coords.latitude,
        longitude: meta.longitude ?? coords.longitude,
        ipAddress: clientIp
      };

      setIsCameraOpen(false);

      if (cameraTargetLogId) {
        setLogs((prev) => {
          const updated = prev.map((item) => {
            if (item.id !== cameraTargetLogId) return item;
            if (item.evidencePhotos.length >= MAX_EVIDENCE_PHOTOS) return item;
            return {
              ...item,
              evidencePhotos: [...item.evidencePhotos, newPhoto].slice(0, MAX_EVIDENCE_PHOTOS)
            };
          });
          writeStoredLogs(updated);
          return updated;
        });
        setCameraTargetLogId(null);
        showToast(`EVIDENCE PHOTO APPENDED (${exactStamp})`);
      } else {
        setCapturedPhotos((prev) => [...prev, newPhoto].slice(0, MAX_EVIDENCE_PHOTOS));
        setIsCreateModalOpen(true);
      }
    },
    [cameraTargetLogId, coords.latitude, coords.longitude, clientIp, showToast]
  );

  const handleAddCasualtyRow = useCallback(() => {
    setNewCasualties((prev) => [
      ...prev,
      {
        id: `cas-${Date.now()}-${prev.length + 1}`,
        patientName: `Casualty Patient #${prev.length + 1}`,
        age: 28,
        gender: 'Female',
        triageTag: 'YELLOW — DELAYED',
        levelOfConsciousness: 'Alert (GCS 15)',
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        heartRateBpm: 86,
        respiratoryRate: 18,
        spO2Percent: 98,
        temperatureCelsius: 36.7,
        bloodGlucoseMgDl: 98,
        chiefComplaint: 'Secondary impact contusion & triage observation',
        interventions: ['Vitals Monitoring', 'Wound Dressing']
      }
    ]);
  }, []);

  const handleCreateLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);

    const createdAtIso = new Date().toISOString();
    const refCode = `RHU-LOG-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      let createdReportId = `local-log-${Date.now()}`;
      let finalRefCode = refCode;

      try {
        const res = await createReport({
          title: newTitle.trim(),
          note: newNote.trim(),
          category: newCategory,
          severity: newSeverity,
          latitude: coords.latitude,
          longitude: coords.longitude,
          locationLabel: 'RHU Field Responder Geotag',
          imageDataUrl: capturedPhotos[0]?.url || undefined,
          isHardwareGeolocated
        });
        if (res?.report?.id) {
          createdReportId = res.report.id;
          finalRefCode = res.report.referenceCode || refCode;
        }
      } catch {
        // Fallback to local incident log persistence when backend is offline
      }

      const newEntry: IncidentLogEntry = {
        id: createdReportId,
        referenceCode: finalRefCode,
        title: newTitle.trim(),
        note: newNote.trim() || 'Field medical stabilization and multi-casualty PCR vitals recorded.',
        category: newCategory,
        severity: newSeverity,
        status: 'Responded',
        isVerified: false,
        verifiedAt: null,
        isClosed: false,
        closedAt: null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationLabel: 'San Mateo RHU EMS Field Coordinates',
        ipAddress: clientIp,
        responderName: session?.fullName || 'Dr. Maria Clara Santos MD',
        responderId: session?.userId || 'rhu-medic-01',
        unitCode: session?.unit || 'RHU-ALPHA-1',
        createdAt: createdAtIso,
        casualties: newCasualties,
        evidencePhotos: capturedPhotos.slice(0, MAX_EVIDENCE_PHOTOS),
        isHardwareGeolocated
      };

      setLogs((prev) => {
        const next = [newEntry, ...prev];
        writeStoredLogs(next);
        return next;
      });

      window.dispatchEvent(new CustomEvent('resqtrack:report', { detail: newEntry }));
      showToast(`INCIDENT LOG ${finalRefCode} SAVED TO RHU TELEMETRY`);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewNote('');
      setCapturedPhotos([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100 select-none pb-12 w-full">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl bg-slate-900/95 border-2 border-emerald-400 text-emerald-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =====================================================================
          TASK 1: HEADER — Eyebrow: RHU EMERGENCY MEDICAL SERVICES | Title: INCIDENT LOGS
         ===================================================================== */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/90 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs font-mono font-black tracking-widest text-sky-400 uppercase">
              RHU EMERGENCY MEDICAL SERVICES
            </span>
            <span className="text-slate-600 font-mono">|</span>
            <span className="text-xs font-mono text-slate-300 font-bold">
              MEDIC: {session?.fullName || 'Dr. Maria Clara Santos MD'}
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-950/90 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300">
              UNIT: {session?.unit || 'RHU'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
            INCIDENT LOGS
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Lifetime submitted casualty dispatches, multi-patient PCR vitals, 40-photo timestamped evidence &amp; 5-minute auto-close verification engine
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCameraTargetLogId(null);
              setIsCameraOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-950/60 active:scale-95 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>SUBMIT FIELD INCIDENT LOG</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          TASK 2: 4 EXACT KPI TELEMETRY CARDS (N=0 SAFE FORMULAS)
         ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL LOGGED */}
        <div className="tactical-card p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-sky-500/60 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-black text-slate-300 uppercase tracking-wider">
              TOTAL LOGGED
            </span>
            <ClipboardList className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-white">{totalLogged}</span>
            <span className="text-xs font-mono text-sky-400 font-black uppercase">REPORTS</span>
          </div>
          <div className="mt-2.5 text-[10px] font-mono font-bold text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
            <span>LIFETIME LOGS</span>
            <span className="text-sky-300">REPORTS</span>
          </div>
        </div>

        {/* Card 2: ACTIVE IN ACTION */}
        <div className="tactical-card p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-amber-500/60 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-black text-slate-300 uppercase tracking-wider">
              ACTIVE IN ACTION
            </span>
            <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-amber-400">{activeInAction}</span>
            <span className="text-xs font-mono text-amber-300 font-black uppercase">ACTIVE</span>
          </div>
          <div className="mt-2.5 text-[10px] font-mono font-bold text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
            <span>ACTIVE</span>
            <span className="text-amber-300">ONGOING OPERATIONS</span>
          </div>
        </div>

        {/* Card 3: VERIFIED ACTIONED */}
        <div className="tactical-card p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/60 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-black text-slate-300 uppercase tracking-wider">
              VERIFIED ACTIONED
            </span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-cyan-400">{verifiedActioned}</span>
            <span className="text-xs font-mono text-cyan-300 font-black uppercase">VERIFIED</span>
          </div>
          <div className="mt-2.5 text-[10px] font-mono font-bold text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
            <span>VERIFIED</span>
            <span className="text-cyan-300">VALIDATED EVIDENCE</span>
          </div>
        </div>

        {/* Card 4: RESOLVED MISSIONS */}
        <div className="tactical-card p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-emerald-500/60 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-black text-slate-300 uppercase tracking-wider">
              RESOLVED MISSIONS
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-emerald-400">{resolvedMissions}</span>
            <span className="text-xs font-mono text-emerald-300 font-black uppercase">CLOSED</span>
          </div>
          <div className="mt-2.5 text-[10px] font-mono font-bold text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
            <span>CLOSED</span>
            <span className="text-emerald-300">SUCCESSFUL RESOLUTION</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TASK 4: FILTER TABS, SEARCHBAR (WITH USEDEBOUNCE), SORT & TABLECARDTOGGLE
         ===================================================================== */}
      <div className="tactical-card p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ALL_LOGS');
              goToPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
              activeTab === 'ALL_LOGS'
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            ALL LOGS ({totalLogged})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ACTIVE_IN_ACTION');
              goToPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
              activeTab === 'ACTIVE_IN_ACTION'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-slate-950 text-amber-400 border-slate-800 hover:border-amber-500/40'
            }`}
          >
            ACTIVE IN ACTION ({activeInAction})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('VERIFIED_5M_TIMER');
              goToPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'VERIFIED_5M_TIMER'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                : 'bg-slate-950 text-cyan-400 border-slate-800 hover:border-cyan-500/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>VERIFIED (5M TIMER) ({verifiedActiveTimerCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('CLOSED_SOLVED');
              goToPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
              activeTab === 'CLOSED_SOLVED'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                : 'bg-slate-950 text-emerald-400 border-slate-800 hover:border-emerald-500/40'
            }`}
          >
            CLOSED / SOLVED ({resolvedMissions})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as LogSortMode)}
              aria-label="Sort incident logs"
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="NEWEST" className="bg-slate-950">SORT: NEWEST FIRST</option>
              <option value="OLDEST" className="bg-slate-950">SORT: OLDEST FIRST</option>
              <option value="SEVERITY" className="bg-slate-950">SORT: SEVERITY PRIORITY</option>
              <option value="TIMER_URGENCY" className="bg-slate-950">SORT: 5M TIMER URGENCY</option>
            </select>
          </div>

          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search ref, patient, street, notes..."
            className="w-full sm:w-64"
          />

          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* =====================================================================
          TASK 3: INCIDENT LOGS FEED WITH 5-MINUTE VERIFICATION TIMER & AUTO-CLOSE
         ===================================================================== */}
      {loading ? (
        <div className="tactical-card p-12 text-center text-sky-400 font-mono text-sm animate-pulse bg-slate-900/60 border border-slate-800 rounded-xl">
          SYNCHRONIZING RHU INCIDENT LOGS &amp; 5-MINUTE VERIFICATION TIMERS...
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="tactical-card p-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
          <ClipboardList className="w-9 h-9 mx-auto mb-2.5 text-slate-500" />
          <h3 className="text-base font-bold text-white font-mono">NO INCIDENT LOGS MATCH CURRENT FILTER</h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Submit a report from &quot;CASUALTY FIELD DISPATCHES&quot; or click &quot;SUBMIT FIELD INCIDENT LOG&quot; above.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedItems.map((log) => {
            const sev = SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.High;
            const remainingSec = log.isVerified ? computeRemainingSeconds(log.verifiedAt, nowMs) : FIVE_MINUTES_SECONDS;
            const effectivelyClosed = Boolean(log.isClosed || (log.isVerified && remainingSec === 0));
            const progressPct = effectivelyClosed ? 100 : log.isVerified ? computeProgressPct(remainingSec) : 0;

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLogId(log.id)}
                className={`tactical-card p-5 border rounded-xl cursor-pointer group shadow-lg flex flex-col justify-between transition-all ${
                  effectivelyClosed
                    ? 'border-emerald-500/40 bg-slate-950/85 hover:border-emerald-400/80'
                    : log.isVerified
                    ? 'border-cyan-500/60 bg-slate-950/95 hover:border-cyan-400'
                    : 'border-slate-800 bg-slate-950/90 hover:border-sky-500/70'
                }`}
              >
                <div>
                  {/* Top Bar: Reference Code, Severity & Lifecycle State Badge */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-sky-400 group-hover:underline">
                        {log.referenceCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                        {log.severity.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                        {log.unitCode}
                      </span>
                    </div>

                    {effectivelyClosed ? (
                      <span className="px-2.5 py-1 rounded-md bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[10px] font-mono font-black flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>CLOSED / SOLVED CASE</span>
                      </span>
                    ) : log.isVerified ? (
                      <span className="px-2.5 py-1 rounded-md bg-cyan-950/90 border border-cyan-400 text-cyan-300 text-[10px] font-mono font-black flex items-center gap-1 animate-pulse">
                        <Clock className="w-3 h-3" />
                        <span>VERIFIED — 5M CLOSING TIMER ({formatMmSs(remainingSec)})</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md bg-amber-950/90 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-black flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>ACTIVE / ONGOING OPERATIONS ({log.status.toUpperCase()})</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Narrative */}
                  <h3 className="text-base font-bold text-white line-clamp-1">{log.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{log.note}</p>

                  {/* Multi-Casualty & Photo Evidence Summary Chips */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold inline-flex items-center gap-1">
                      <HeartPulse className="w-3 h-3" />
                      <span>{log.casualties.length} CASUALTY PCR VITALS</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/40 text-sky-300 font-bold inline-flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      <span>{log.evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS} EVIDENCE PHOTOS</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 inline-flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-500" />
                      <span>IP: {log.ipAddress.split(' ')[0]}</span>
                    </span>
                  </div>

                  {/* 5-Minute Verification Loading Timer Bar OR Action Trigger */}
                  <div className="mt-3.5 p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                    {effectivelyClosed ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-emerald-400 font-black flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>CASE CLOSED (100% SOLVED — POINTER FADED)</span>
                          </span>
                          <span className="text-emerald-300 font-bold">00:00 (100%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-emerald-500/40">
                          <div className="h-full bg-emerald-500 w-full transition-all duration-500" />
                        </div>
                      </div>
                    ) : log.isVerified ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-cyan-300 font-black flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                            <span>VERIFIED — CLOSING IN {formatMmSs(remainingSec)}</span>
                          </span>
                          <span className="text-cyan-400 font-bold">{progressPct}%</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-cyan-500/40">
                          <div
                            className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-700"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] font-mono text-slate-400">
                            Auto-transitions to CLOSED at 00:00
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleSimulateFinalSeconds(log, e)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold cursor-pointer"
                          >
                            DEMO: JUMP TO 00:05
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-amber-300 font-bold">
                          Awaiting Admin / AI Verification to start 5m close timer
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleStartFiveMinTimer(log, e)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>VERIFY &amp; START 5M TIMER</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: GPS Coordinates & Timestamp */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between font-mono text-[11px] text-slate-400">
                  <span className="truncate max-w-[230px] inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
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
                        className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold hover:bg-slate-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3 h-3 text-sky-400" />
                        <span>View Photo</span>
                      </button>
                    )}
                    <span className="text-sky-300 font-bold">{formatRelativeTime(log.createdAt)}</span>
                  </div>
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
                <th className="p-3.5">Incident &amp; Casualties</th>
                <th className="p-3.5">GPS &amp; IP Telemetry</th>
                <th className="p-3.5">Evidence</th>
                <th className="p-3.5">Lifecycle &amp; 5M Timer</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {paginatedItems.map((log) => {
                const remainingSec = log.isVerified ? computeRemainingSeconds(log.verifiedAt, nowMs) : FIVE_MINUTES_SECONDS;
                const effectivelyClosed = Boolean(log.isClosed || (log.isVerified && remainingSec === 0));
                const progressPct = effectivelyClosed ? 100 : log.isVerified ? computeProgressPct(remainingSec) : 0;

                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className="hover:bg-slate-900/70 transition-colors cursor-pointer"
                  >
                    <td className="p-3.5 text-sky-400 font-black whitespace-nowrap">
                      {log.referenceCode}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-200">
                        {log.severity}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="text-white font-sans font-bold line-clamp-1">{log.title}</div>
                      <div className="text-[10px] text-rose-300 mt-0.5">
                        {log.casualties.length} Casualty PCR Record(s) · Unit {log.unitCode}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-300 whitespace-nowrap">
                      <div className="text-emerald-400 font-bold">{formatGpsCoord(log.latitude, log.longitude)}</div>
                      <div className="text-[10px] text-slate-500">IP: {log.ipAddress}</div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-sky-950/70 border border-sky-500/40 text-sky-300 text-[10px] font-bold">
                        {log.evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS} Photos
                      </span>
                    </td>
                    <td className="p-3.5 min-w-[210px]">
                      {effectivelyClosed ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>CLOSED / SOLVED (100%)</span>
                        </span>
                      ) : log.isVerified ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-cyan-300 font-bold text-[10px]">
                            VERIFIED — {formatMmSs(remainingSec)} ({progressPct}%)
                          </span>
                          <div className="w-36 h-1.5 rounded-full bg-slate-900 overflow-hidden border border-cyan-500/40">
                            <div
                              className="h-full bg-cyan-400 transition-all duration-500"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                          ACTIVE ({log.status})
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      {!effectivelyClosed && !log.isVerified ? (
                        <button
                          type="button"
                          onClick={(e) => handleStartFiveMinTimer(log, e)}
                          className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          VERIFY &amp; START 5M TIMER
                        </button>
                      ) : !effectivelyClosed && log.isVerified ? (
                        <button
                          type="button"
                          onClick={(e) => handleSimulateFinalSeconds(log, e)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold text-[10px] cursor-pointer"
                        >
                          JUMP 00:05
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold">ARCHIVED</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          TASK 4: PAGINATION BAR (USING @/Hooks/usePagination)
         ===================================================================== */}
      <div className="tactical-card p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-3 text-slate-400">
          <span>
            SHOWING <strong className="text-white">{totalItems === 0 ? 0 : startIndex + 1}</strong>–
            <strong className="text-white">{endIndex}</strong> OF{' '}
            <strong className="text-sky-400">{totalItems}</strong> INCIDENT LOGS
          </span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs cursor-pointer"
          >
            {pageSizeOptions.map((sz) => (
              <option key={sz} value={sz}>
                {sz} / PAGE
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canPrevPage}
            onClick={prevPage}
            className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40 hover:border-sky-500/50 inline-flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>PREV</span>
          </button>
          <span className="px-3 py-1 rounded bg-slate-950 border border-slate-800 text-sky-400 font-bold">
            PAGE {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={!canNextPage}
            onClick={nextPage}
            className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40 hover:border-sky-500/50 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>NEXT</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* =====================================================================
          TASK 4: DEFAULTFLOATINGMODALCARD — FULL SUBMITTED REPORT, MULTI-CASUALTY PCR VITALS,
          UP TO 40 TIMESTAMPED PHOTOS (YYYY-MM-DD hh:mm:ss A), IP, GPS & 5M TIMER STATUS
         ===================================================================== */}
      {selectedLog && (() => {
        const modalRemainingSec = selectedLog.isVerified
          ? computeRemainingSeconds(selectedLog.verifiedAt, nowMs)
          : FIVE_MINUTES_SECONDS;
        const modalClosed = Boolean(
          selectedLog.isClosed || (selectedLog.isVerified && modalRemainingSec === 0)
        );
        const modalProgressPct = modalClosed
          ? 100
          : selectedLog.isVerified
          ? computeProgressPct(modalRemainingSec)
          : 0;

        return (
          <DefaultFloatingModalCard
            isOpen={selectedLog !== null}
            onClose={() => setSelectedLogId(null)}
            title={`RHU INCIDENT LOG // ${selectedLog.referenceCode}`}
            subtitle={`Submitted by ${selectedLog.responderName} · Unit ${selectedLog.unitCode}`}
            maxWidth="max-w-4xl"
          >
            <div className="flex flex-col gap-5 text-slate-200 text-xs font-mono">
              {/* Top Headline & Lifecycle Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sky-400 font-black text-sm">{selectedLog.referenceCode}</span>
                    <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[10px] font-bold">
                      {selectedLog.severity.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px]">
                      {selectedLog.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-sans mt-1">{selectedLog.title}</h3>
                </div>

                {modalClosed ? (
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500 font-black inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CLOSED / SOLVED CASE</span>
                  </span>
                ) : selectedLog.isVerified ? (
                  <span className="px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-400 font-black inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>VERIFIED — CLOSING IN {formatMmSs(modalRemainingSec)}</span>
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-500 font-black inline-flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    <span>ACTIVE / ONGOING ({selectedLog.status})</span>
                  </span>
                )}
              </div>

              {/* 5-Minute Verification Countdown Engine Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>5-MINUTE VERIFICATION &amp; AUTO-CLOSE ENGINE</span>
                  </span>
                  {!modalClosed && !selectedLog.isVerified && (
                    <button
                      type="button"
                      onClick={(e) => handleStartFiveMinTimer(selectedLog, e)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>VERIFY &amp; START 5M TIMER</span>
                    </button>
                  )}
                  {!modalClosed && selectedLog.isVerified && (
                    <button
                      type="button"
                      onClick={(e) => handleSimulateFinalSeconds(selectedLog, e)}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950 text-cyan-300 border border-cyan-500/50 font-bold text-[11px] cursor-pointer"
                    >
                      FAST-FORWARD TO 00:05
                    </button>
                  )}
                </div>

                {modalClosed ? (
                  <div className="text-emerald-300 font-bold text-xs flex items-center justify-between">
                    <span>CASE CLOSED (100% SOLVED — POINTER FADED)</span>
                    <span>CLOSED AT: {formatEvidenceTimestampExact(selectedLog.closedAt)}</span>
                  </div>
                ) : selectedLog.isVerified ? (
                  <div>
                    <div className="flex items-center justify-between text-xs text-cyan-300 font-bold mb-1.5">
                      <span>
                        VERIFIED BY: {selectedLog.verifiedBy || 'LDRRMO Command'} AT{' '}
                        {formatEvidenceTimestampExact(selectedLog.verifiedAt)}
                      </span>
                      <span className="text-sm font-black">
                        {formatMmSs(modalRemainingSec)} ({modalProgressPct}%)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-cyan-500/50">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-500"
                        style={{ width: `${modalProgressPct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs">
                    Report is currently in <strong className="text-amber-300">ACTIVE / ONGOING OPERATIONS</strong>. Once verified by Admin or System AI (or via the button above), a 5-minute countdown (`05:00` → `00:00`) runs before automatically closing the case and incrementing <strong className="text-emerald-300">RESOLVED MISSIONS</strong>.
                  </p>
                )}
              </div>

              {/* Telemetry Metadata Grid: GPS, IP Address, Timestamp & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] mb-0.5">GPS COORDINATES &amp; SECTOR</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{formatGpsCoord(selectedLog.latitude, selectedLog.longitude)}</span>
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-0.5">{selectedLog.locationLabel}</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] mb-0.5">TERMINAL IP TELEMETRY</span>
                  <span className="text-sky-300 font-bold flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    <span>{selectedLog.ipAddress}</span>
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-0.5">
                    Hardware Geotag: {selectedLog.isHardwareGeolocated ? 'VERIFIED' : 'SIMULATED'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] mb-0.5">LOGGED TIMESTAMP</span>
                  <span className="text-white font-bold">
                    {formatEvidenceTimestampExact(selectedLog.createdAt)}
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-0.5">
                    Medic: {selectedLog.responderName}
                  </span>
                </div>
              </div>

              {/* Clinical Narrative / Field Notes */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-bold block text-[10px] mb-1 uppercase flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>CLINICAL SITUATION NARRATIVE &amp; FIELD OBSERVATIONS</span>
                </span>
                <p className="text-slate-200 leading-relaxed font-sans text-xs">
                  {selectedLog.note || 'No additional narrative notes provided.'}
                </p>
              </div>

              {/* Multi-Casualty PCR Vitals List */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4" />
                    <span>MULTI-CASUALTY PCR VITALS LIST ({selectedLog.casualties.length} PATIENT RECORDS)</span>
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {selectedLog.casualties.map((cas, idx) => (
                    <div
                      key={cas.id || idx}
                      className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/40 font-black text-[10px]">
                            PATIENT #{idx + 1}
                          </span>
                          <span className="text-white font-bold text-xs">{cas.patientName}</span>
                          <span className="text-slate-400 text-[11px]">
                            ({cas.age}yo · {cas.gender})
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-rose-950/90 border border-rose-500/50 text-rose-300 text-[10px] font-bold">
                          {cas.triageTag || 'RED — IMMEDIATE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">BLOOD PRESSURE</span>
                          <span className="text-white font-bold">
                            {cas.bloodPressureSystolic}/{cas.bloodPressureDiastolic} mmHg
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">HEART RATE</span>
                          <span className="text-rose-400 font-bold">{cas.heartRateBpm} BPM</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">RESP. RATE</span>
                          <span className="text-sky-300 font-bold">{cas.respiratoryRate} /min</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">SpO2 SATURATION</span>
                          <span className="text-emerald-400 font-bold">{cas.spO2Percent}%</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">TEMP</span>
                          <span className="text-amber-300 font-bold">{cas.temperatureCelsius}°C</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">CONSCIOUSNESS</span>
                          <span className="text-cyan-300 font-bold">{cas.levelOfConsciousness}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                        <span className="text-slate-300">
                          <strong className="text-slate-400">Chief Complaint:</strong> {cas.chiefComplaint}
                        </span>
                        {cas.interventions && cas.interventions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {cas.interventions.map((intv, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px]"
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
              </div>

              {/* Up to 40 Timestamped Evidence Photos (YYYY-MM-DD hh:mm:ss A) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    <span>
                      TIMESTAMPED EVIDENCE GALLERY ({selectedLog.evidencePhotos.length} / {MAX_EVIDENCE_PHOTOS} MAX PHOTOS)
                    </span>
                  </span>

                  {selectedLog.evidencePhotos.length < MAX_EVIDENCE_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => {
                        setCameraTargetLogId(selectedLog.id);
                        setIsCameraOpen(true);
                      }}
                      className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-slate-950 font-black text-[10px] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>CAPTURE EVIDENCE PHOTO ({selectedLog.evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS})</span>
                    </button>
                  )}
                </div>

                {selectedLog.evidencePhotos.length === 0 ? (
                  <div className="p-6 rounded-lg bg-slate-900/60 border border-dashed border-slate-800 text-center text-slate-400">
                    No timestamped photos attached yet. Click &quot;CAPTURE EVIDENCE PHOTO&quot; to attach up to 40 geotagged photos.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
                    {selectedLog.evidencePhotos.slice(0, MAX_EVIDENCE_PHOTOS).map((photo, index) => (
                      <div
                        key={photo.id || index}
                        onClick={() => setLightboxImageUrl(photo.url)}
                        className="group relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900 cursor-pointer hover:border-sky-400 transition-all"
                      >
                        <img
                          src={photo.url}
                          alt={photo.caption || `Evidence #${index + 1}`}
                          className="w-full h-28 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="p-2 bg-slate-950/95 border-t border-slate-800 text-[10px] font-mono">
                          <div className="text-sky-300 font-bold truncate">
                            #{index + 1} · {formatEvidenceTimestampExact(photo.timestamp)}
                          </div>
                          <div className="text-slate-400 truncate text-[9px]">
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

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <Button variant="outline" size="sm" onClick={() => setSelectedLogId(null)}>
                  Close Log Inspector
                </Button>
              </div>
            </div>
          </DefaultFloatingModalCard>
        );
      })()}

      {/* Camera Capture Modal (Hardware WebRTC Anti-Spoofing) */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => {
          setIsCameraOpen(false);
          setCameraTargetLogId(null);
        }}
        onCapture={handleCameraCapture}
        title="RHU Tactical Field Evidence Camera (YYYY-MM-DD hh:mm:ss A)"
      />

      {/* Create New Field Incident Log Modal */}
      {isCreateModalOpen && (
        <DefaultFloatingModalCard
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="SUBMIT RHU FIELD INCIDENT LOG & MULTI-CASUALTY PCR"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCreateLogSubmit} className="flex flex-col gap-4 text-xs font-mono">
            {/* Captured Timestamped Evidence Photos Preview */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sky-400 font-bold">
                  TIMESTAMPED EVIDENCE PHOTOS ({capturedPhotos.length}/{MAX_EVIDENCE_PHOTOS})
                </span>
                {capturedPhotos.length < MAX_EVIDENCE_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => {
                      setCameraTargetLogId(null);
                      setIsCameraOpen(true);
                    }}
                    className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3" />
                    <span>+ ADD PHOTO</span>
                  </button>
                )}
              </div>

              {capturedPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {capturedPhotos.map((p, idx) => (
                    <div key={p.id} className="rounded overflow-hidden border border-emerald-500/40 bg-slate-900">
                      <img src={p.url} alt={`Capture ${idx + 1}`} className="w-full h-20 object-cover" />
                      <div className="p-1 text-[9px] text-emerald-300 truncate">{p.timestamp}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-bold">INCIDENT HEADLINE / DISPATCH TITLE *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Multi-Vehicle Trauma Collision at National Rd KM 24"
                required
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-bold">CATEGORY</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="MedicalEmergency">Medical Emergency</option>
                  <option value="VehicularAccident">Vehicular Accident</option>
                  <option value="StructuralFire">Structural Fire</option>
                  <option value="HazardFixture">Hazard Fixture</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-bold">SEVERITY</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Multi-Casualty PCR Vitals Quick Builder */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-rose-400 font-bold">
                  CASUALTY PCR VITALS ({newCasualties.length} PATIENT(S))
                </span>
                <button
                  type="button"
                  onClick={handleAddCasualtyRow}
                  className="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
                >
                  + ADD CASUALTY PATIENT
                </button>
              </div>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {newCasualties.map((c, i) => (
                  <div key={c.id} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold">#{i + 1} {c.patientName}</span>
                      <span className="text-slate-400 ml-2">
                        BP {c.bloodPressureSystolic}/{c.bloodPressureDiastolic} · HR {c.heartRateBpm} · SpO2 {c.spO2Percent}%
                      </span>
                    </div>
                    <span className="text-rose-300 text-[10px] font-bold">{c.triageTag}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-bold">CLINICAL NARRATIVE &amp; FIELD ACTIONS</label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Details of patient stabilization, ambulance transport, and hospital endorsement..."
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" type="submit" isLoading={isSubmitting}>
                <Radio className="w-3.5 h-3.5 inline mr-1" />
                <span>Submit Incident Log</span>
              </Button>
            </div>
          </form>
        </DefaultFloatingModalCard>
      )}

      {/* Fullscreen Evidence Photo Lightbox */}
      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="RHU Timestamped Incident Evidence"
      />
    </div>
  );
};

export default MyReportsPage;
