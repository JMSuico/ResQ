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
  XCircle
} from 'lucide-react';
import { getAllReports, verifyReport, ReportItem } from '@/Endpoints/reportsApi';
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

export interface RawEvidenceObject {
  url?: string;
  timestamp?: string;
  caption?: string;
}

export interface RawIncidentLog {
  id?: string;
  referenceCode?: string;
  title?: string;
  category?: string;
  severity?: string;
  status?: string;
  locationLabel?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
  responderName?: string;
  responderUnit?: string;
  unitCode?: string;
  createdAt?: string;
  submittedAt?: string;
  isVerified?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: string;
  isClosed?: boolean;
  closedAt?: string | null;
  evidencePhotos?: Array<RawEvidenceObject | string>;
  evidences?: Array<RawEvidenceObject | string>;
  casualties?: Partial<PcrCasualtyItem>[];
  pcrRecords?: Array<Record<string, unknown>>;
  notes?: string;
  note?: string;
  roboflowModelId?: string | null;
  roboflowPrediction?: string | null;
  roboflowConfidence?: number | null;
  roboflowNeedsReview?: boolean;
  claudeModelUsed?: string | null;
  claudeSituationSummary?: string | null;
  claudeVisibleHazards?: string | null;
  pointerIconType?: string | null;
}

const normalizeEvidence = (item: RawIncidentLog): Array<{ url: string; timestamp?: string; caption?: string }> => {
  const rawList = item.evidencePhotos || item.evidences || [];
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((e, idx) => {
      if (typeof e === 'string') {
        return { url: e, caption: `Attached Evidence #${idx + 1}` };
      }
      return {
        url: typeof e?.url === 'string' ? e.url : '',
        timestamp: typeof e?.timestamp === 'string' ? e.timestamp : undefined,
        caption: typeof e?.caption === 'string' ? e.caption : `Attached Evidence #${idx + 1}`
      };
    })
    .filter((e) => Boolean(e.url) && !e.url.includes('unsplash.com'));
};

const normalizeCasualties = (item: RawIncidentLog): PcrCasualtyItem[] => {
  const rawList = (item.casualties as Array<Record<string, unknown>> | undefined) ||
    (item.pcrRecords as Array<Record<string, unknown>> | undefined) || [];
  if (!Array.isArray(rawList)) return [];
  return rawList.map((c, idx) => ({
    id: typeof c.id === 'string' ? c.id : `cas-${idx + 1}`,
    patientName: typeof c.patientName === 'string' ? c.patientName : 'Unidentified Patient',
    age: typeof c.age === 'number' ? c.age : 0,
    gender: typeof c.gender === 'string' ? c.gender : 'Unspecified',
    levelOfConsciousness: typeof c.levelOfConsciousness === 'string' ? c.levelOfConsciousness : 'Alert',
    bpSystolic: typeof c.bpSystolic === 'number' ? c.bpSystolic : typeof c.bloodPressureSystolic === 'number' ? c.bloodPressureSystolic : 120,
    bpDiastolic: typeof c.bpDiastolic === 'number' ? c.bpDiastolic : typeof c.bloodPressureDiastolic === 'number' ? c.bloodPressureDiastolic : 80,
    heartRate: typeof c.heartRate === 'number' ? c.heartRate : typeof c.heartRateBpm === 'number' ? c.heartRateBpm : 75,
    respiratoryRate: typeof c.respiratoryRate === 'number' ? c.respiratoryRate : 16,
    spO2: typeof c.spO2 === 'number' ? c.spO2 : typeof c.spO2Percent === 'number' ? c.spO2Percent : 98,
    glucose: typeof c.glucose === 'number' ? c.glucose : typeof c.bloodGlucoseMgDl === 'number' ? c.bloodGlucoseMgDl : 90,
    temp: typeof c.temp === 'number' ? c.temp : typeof c.temperatureCelsius === 'number' ? c.temperatureCelsius : 36.5,
    receivingHospital: typeof c.receivingHospital === 'string' ? c.receivingHospital : 'Katipunan Rural Health Unit (RHU)',
    chiefComplaint: typeof c.chiefComplaint === 'string' ? c.chiefComplaint : 'Trauma & Triage Evaluation',
    narrative: typeof c.narrative === 'string' ? c.narrative : '',
    interventions: Array.isArray(c.interventions) ? c.interventions.filter((i): i is string => typeof i === 'string') : [],
    recordedAt: typeof c.recordedAt === 'string' ? c.recordedAt : typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString()
  }));
};

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
}

const STORAGE_INCIDENT_LOGS_KEY = 'resqtrack_incident_logs';
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const SubmittedReportsPage: FC = () => {
  const [reports, setReports] = useState<SubmittedReportRecord[]>([]);
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
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSubmittedReports = useCallback(async (): Promise<void> => {
    try {
      let localLogs: RawIncidentLog[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_INCIDENT_LOGS_KEY);
        if (raw) localLogs = JSON.parse(raw) as RawIncidentLog[];
      } catch {
        localLogs = [];
      }

      let aiVisionCache: Record<string, Partial<ReportItem>> = {};
      try {
        const cachedAiRaw = localStorage.getItem('resqtrack_ai_vision_by_report');
        if (cachedAiRaw) {
          aiVisionCache = JSON.parse(cachedAiRaw) as Record<string, Partial<ReportItem>>;
        }
      } catch {}

      const backendReports = await getAllReports().catch(() => [] as ReportItem[]);
      const mergedMap = new Map<string, SubmittedReportRecord>();

      if (Array.isArray(localLogs)) {
        localLogs.forEach((item: RawIncidentLog) => {
          if (!item || !item.id) return;
          const rawStatus = (item.status || 'Submitted').toLowerCase();
          const isRejected = rawStatus === 'rejected';
          const isVerified = !isRejected && Boolean(item.isVerified || item.verifiedAt || rawStatus === 'verified');
          const isClosed = Boolean(item.isClosed || item.closedAt || rawStatus === 'closed' || rawStatus === 'resolved');
          const refCode = item.referenceCode || `RESQ-${item.id.slice(0, 8).toUpperCase()}`;
          const cached = aiVisionCache[item.id] || aiVisionCache[refCode];

          mergedMap.set(item.id, {
            id: item.id,
            referenceCode: refCode,
            title: item.title || 'Submitted Incident Report',
            category: item.category || 'MedicalEmergency',
            severity: item.severity || 'Medium',
            status: isRejected ? 'Rejected' : isClosed ? 'Resolved' : isVerified ? 'Verified' : (item.status || 'Submitted'),
            locationLabel:
              item.locationLabel ||
              item.location ||
              getKatipunanBarangay(item.latitude ?? KATIPUNAN_BASE_COORDS.latitude, item.longitude ?? KATIPUNAN_BASE_COORDS.longitude),
            latitude: typeof item.latitude === 'number' ? item.latitude : KATIPUNAN_BASE_COORDS.latitude,
            longitude: typeof item.longitude === 'number' ? item.longitude : KATIPUNAN_BASE_COORDS.longitude,
            ipAddress: item.ipAddress || '192.168.42.118',
            responderName: item.responderName || 'Dr. Maria Clara Santos MD',
            responderUnit: item.unitCode || item.responderUnit || 'RHU-ALPHA-1',
            submittedAt: item.createdAt || item.submittedAt || new Date().toISOString(),
            isVerified,
            verifiedAt: item.verifiedAt || (isVerified ? new Date().toISOString() : null),
            verifiedBy: item.verifiedBy,
            isClosed,
            closedAt: item.closedAt || (isClosed ? new Date().toISOString() : null),
            isRejected,
            evidencePhotos: normalizeEvidence(item),
            casualties: normalizeCasualties(item),
            notes: item.note || item.notes || '',
            roboflowModelId: item.roboflowModelId ?? cached?.roboflowModelId,
            roboflowPrediction: item.roboflowPrediction ?? cached?.roboflowPrediction,
            roboflowConfidence: item.roboflowConfidence ?? cached?.roboflowConfidence,
            roboflowNeedsReview: item.roboflowNeedsReview ?? cached?.roboflowNeedsReview,
            claudeModelUsed: item.claudeModelUsed ?? cached?.claudeModelUsed,
            claudeSituationSummary: item.claudeSituationSummary ?? cached?.claudeSituationSummary,
            claudeVisibleHazards: item.claudeVisibleHazards ?? cached?.claudeVisibleHazards,
            pointerIconType: item.pointerIconType ?? cached?.pointerIconType
          });
        });
      }

      if (Array.isArray(backendReports)) {
        backendReports.forEach((rep) => {
          if (!rep || !rep.id) return;
          if (mergedMap.has(rep.id)) return;

          const s = (rep.status || 'Reported').toLowerCase();
          const isRejected = s === 'rejected';
          const isVerified = !isRejected && (Boolean(rep.verifiedAt) || s === 'verified' || s === 'responded');
          const isClosed = s === 'resolved' || s === 'completed' || s === 'closed';
          const safePhoto = rep.imageUrl && !rep.imageUrl.includes('unsplash.com') ? rep.imageUrl : null;
          const refCode = rep.referenceCode || `RESQ-${rep.id.slice(0, 8).toUpperCase()}`;
          const cached = aiVisionCache[rep.id] || aiVisionCache[refCode];

          mergedMap.set(rep.id, {
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
            ipAddress: '192.168.42.118',
            responderName: rep.reporterName || 'Field Reporter',
            responderUnit: rep.allocatedUnitCode || rep.recommendedAgencyUnit || 'UNASSIGNED',
            submittedAt: rep.createdAt || new Date().toISOString(),
            isVerified,
            verifiedAt: rep.verifiedAt || (isVerified ? new Date().toISOString() : null),
            verifiedBy: isVerified ? 'LDRRMO Admin Command' : undefined,
            isClosed,
            closedAt: rep.resolvedAt || (isClosed ? new Date().toISOString() : null),
            isRejected,
            allocatedUnitCode: rep.allocatedUnitCode,
            evidencePhotos: safePhoto ? [{ url: safePhoto, timestamp: rep.createdAt, caption: 'Attached Evidence' }] : [],
            casualties: [],
            notes: rep.note || '',
            roboflowModelId: rep.roboflowModelId ?? cached?.roboflowModelId,
            roboflowPrediction: rep.roboflowPrediction ?? cached?.roboflowPrediction,
            roboflowConfidence: rep.roboflowConfidence ?? cached?.roboflowConfidence,
            roboflowNeedsReview: rep.roboflowNeedsReview ?? cached?.roboflowNeedsReview,
            claudeModelUsed: rep.claudeModelUsed ?? cached?.claudeModelUsed,
            claudeSituationSummary: rep.claudeSituationSummary ?? cached?.claudeSituationSummary,
            claudeVisibleHazards: rep.claudeVisibleHazards ?? cached?.claudeVisibleHazards,
            pointerIconType: rep.pointerIconType ?? cached?.pointerIconType
          });
        });
      }

      if (mergedMap.size === 0) {
        const seedId = 'seed-sub-rep-01';
        mergedMap.set(seedId, {
          id: seedId,
          referenceCode: 'RESQ-20261028-001',
          title: 'Two-Motorcycle Collision with Minor Injury',
          category: 'VehicularAccident',
          severity: 'Medium',
          status: 'Submitted',
          locationLabel: 'Barangay Uno (Poblacion), Katipunan, Zamboanga del Norte',
          latitude: 8.5147,
          longitude: 123.2842,
          ipAddress: '192.168.42.118',
          responderName: 'Dr. Maria Clara Santos MD',
          responderUnit: 'RHU-ALPHA-1',
          submittedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          isVerified: false,
          verifiedAt: null,
          isClosed: false,
          closedAt: null,
          isRejected: false,
          evidencePhotos: [],
          casualties: [
            {
              id: 'cas-01',
              patientName: 'Juan Dela Cruz',
              age: 28,
              gender: 'Male',
              levelOfConsciousness: 'Alert',
              bpSystolic: 120,
              bpDiastolic: 80,
              heartRate: 78,
              respiratoryRate: 18,
              spO2: 98,
              glucose: 95,
              temp: 36.6,
              receivingHospital: 'Katipunan Rural Health Unit (RHU)',
              chiefComplaint: 'Minor abrasions on right knee and forearm',
              narrative: 'Patient conscious and coherent. Dressed abrasions with sterile gauze.',
              interventions: ['Wound Cleaning', 'Sterile Dressing', 'Vitals Monitored'],
              recordedAt: formatDateTimeWithSecondsAmPm(new Date().toISOString())
            }
          ],
          notes: 'Both riders stabilized. Cleared by Medical Officer III.'
        });

        const seedId2 = 'seed-sub-rep-02';
        const seedVerifiedTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        mergedMap.set(seedId2, {
          id: seedId2,
          referenceCode: 'RESQ-20261028-002',
          title: 'Commercial Storefront Electrical Wire Sparking & Arcing',
          category: 'StructuralFire',
          severity: 'High',
          status: 'Verified',
          locationLabel: 'Public Market Perimeter, Barangay Uno, Katipunan, ZN',
          latitude: 8.5138,
          longitude: 123.2904,
          ipAddress: '192.168.42.119',
          responderName: 'SINSP Ricardo Dalisay BFP',
          responderUnit: 'FIRE-ENG-01',
          submittedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          isVerified: true,
          verifiedAt: seedVerifiedTime,
          verifiedBy: 'LDRRMO Admin Command',
          isClosed: false,
          closedAt: null,
          isRejected: false,
          evidencePhotos: [],
          casualties: [],
          notes: 'Feeder line de-energized by utility team. Perimeter secured.'
        });
      }

      setReports(Array.from(mergedMap.values()));
    } catch (err) {
      console.error('[SubmittedReportsPage] Error loading reports:', err);
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
      } catch (err: unknown) {
        console.warn('[SubmittedReportsPage] Failed to persist report verification:', err);
      }

      setReports((prev) => {
        const next = prev.map((r) => {
          if (r.id !== reportId) return r;
          return {
            ...r,
            isVerified: nextStatus === 'Verified',
            isRejected: nextStatus === 'Rejected',
            status: nextStatus,
            verifiedAt: nextStatus === 'Verified' ? actionTimestamp : null,
            verifiedBy: 'LDRRMO Admin Command'
          };
        });

        try {
          const raw = localStorage.getItem(STORAGE_INCIDENT_LOGS_KEY);
          let localArr: RawIncidentLog[] = raw ? (JSON.parse(raw) as RawIncidentLog[]) : [];
          localArr = localArr.map((item) => {
            if (item.id === reportId) {
              return {
                ...item,
                isVerified: nextStatus === 'Verified',
                status: nextStatus,
                verifiedAt: nextStatus === 'Verified' ? actionTimestamp : null,
                verifiedBy: 'LDRRMO Admin Command'
              };
            }
            return item;
          });
          localStorage.setItem(STORAGE_INCIDENT_LOGS_KEY, JSON.stringify(localArr));
        } catch (err: unknown) {
          console.error('[SubmittedReportsPage] Failed to persist verification:', err);
        }

        return next;
      });

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
    },
    []
  );

  const handleManualClose = useCallback(
    async (reportId: string) => {
      const closedTimestamp = new Date().toISOString();

      try {
        await verifyReport(reportId, 'Resolved', 'Incident closed by LDRRMO Administration.');
      } catch (err: unknown) {
        console.warn('[SubmittedReportsPage] Failed to persist close to backend:', err);
      }

      setReports((prev) => {
        const next = prev.map((r) => {
          if (r.id !== reportId) return r;
          return {
            ...r,
            isClosed: true,
            status: 'Resolved',
            closedAt: closedTimestamp
          };
        });

        try {
          const raw = localStorage.getItem(STORAGE_INCIDENT_LOGS_KEY);
          let localArr: RawIncidentLog[] = raw ? (JSON.parse(raw) as RawIncidentLog[]) : [];
          localArr = localArr.map((item) => {
            if (item.id === reportId) {
              return {
                ...item,
                isClosed: true,
                status: 'Closed',
                closedAt: closedTimestamp
              };
            }
            return item;
          });
          localStorage.setItem(STORAGE_INCIDENT_LOGS_KEY, JSON.stringify(localArr));
        } catch (err: unknown) {
          console.error('[SubmittedReportsPage] Failed to persist close:', err);
        }

        return next;
      });

      window.dispatchEvent(
        new CustomEvent('resqtrack:report', {
          detail: { id: reportId, status: 'Closed', isClosed: true, closedAt: closedTimestamp }
        })
      );
      setToastMessage('Incident successfully finalized and resolved.');
      setTimeout(() => setToastMessage(null), 4000);
    },
    []
  );

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

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

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
            Upload verification, PCR dossiers, and incident closure
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
          <h3 className="text-base font-bold text-[#670626]">No Submitted Reports Found</h3>
          <p className="text-xs text-[#A83B4D] font-mono mt-1">
            Submitted incident dossiers from civilians and field responders will populate here.
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
                      onClick={() => {
                        setSelectedReportId(r.id);
                        setIsDetailModalOpen(true);
                      }}
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
                          {statusBadge.label === 'Verified' && !r.isClosed && remSec > 0 && (
                            <div className="text-xs text-[#A83B4D] font-bold">
                              Closing in {mm}:{ss}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                            onClick={() => {
                              setSelectedReportId(r.id);
                              setIsDetailModalOpen(true);
                            }}
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
                onClick={() => {
                  setSelectedReportId(r.id);
                  setIsDetailModalOpen(true);
                }}
                className={`tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between gap-3.5 cursor-pointer hover:border-[#670626]/40 transition-all`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-[#A83B4D] text-xs font-mono">{r.referenceCode}</span>
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

                  <div className="flex items-center gap-1.5">
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

              {selectedReport.evidencePhotos.length === 0 ? (
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

              {selectedReport.casualties.length === 0 ? (
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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#670626]/15">
              <span className="text-xs font-mono text-[#A83B4D]">
                Action updates live radar pins and Notification Bell telemetry
              </span>

              <div className="flex items-center gap-2">
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
