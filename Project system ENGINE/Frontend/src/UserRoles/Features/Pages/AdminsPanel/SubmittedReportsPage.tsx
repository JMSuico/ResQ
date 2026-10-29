// [Layer: UserRoles/Features/Pages/AdminsPanel]
// SubmittedReportsPage.tsx -- LDRRMO Admin Submitted Reports Command Center.
// Displays all incident reports, multi-casualty PCR vitals, and evidence dossiers submitted by field responders
// after responding to their assigned tasks. Includes Admin Verification action that starts the 5-minute auto-close timer.
// Universal lambda expressions (=>). 100% pure Lucide icons (zero emojis).

import React, { useState, useEffect, FC, useMemo, useCallback } from 'react';
import {
  FileCheck,
  CheckCircle2,
  Clock,
  Filter,
  Eye,
  ShieldAlert,
  ArrowUpDown,
  Search,
  FileText,
  Check,
  X,
  Users,
  Shield,
  HeartPulse,
  Flame,
  Radio,
  MapPin,
  RefreshCw,
  Sparkles,
  Activity,
  Camera,
  TrendingUp,
  Send,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { getAllReports, ReportItem } from '@/Endpoints/reportsApi';
import { getDutyRoster, DutyUnit } from '@/Endpoints/responderOpsApi';
import {
  SearchBar,
  Dropdown,
  Button,
  TableCardToggle,
  ViewMode,
  DefaultFloatingModalCard,
  ImageLightboxModal,
  LightboxMediaItem
} from '@/Shared';
import { usePagination, useDebounce, useValueRefreshAuto } from '@/Hooks';
import { formatDateTimeWithSecondsAmPm } from '@/Shared/radarPointerCategories';

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

export interface SubmittedReportRecord {
  id: string;
  referenceCode: string;
  title: string;
  category: string;
  severity: string;
  status: 'Responded' | 'Verified' | 'Closed' | 'Dispatched' | string;
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
  evidencePhotos: Array<{ url: string; timestamp?: string; caption?: string }>;
  casualties: PcrCasualtyItem[];
  notes?: string;
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

  // 1-second interval to update live 5-minute countdown timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSubmittedReports = useCallback(async (): Promise<void> => {
    try {
      // 1. Read from localStorage 'resqtrack_incident_logs'
      let localLogs: any[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_INCIDENT_LOGS_KEY);
        if (raw) localLogs = JSON.parse(raw);
      } catch {
        localLogs = [];
      }

      // 2. Fetch backend reports
      const backendReports = await getAllReports().catch(() => [] as ReportItem[]);

      // 3. Merge into unified SubmittedReportRecord list
      const mergedMap = new Map<string, SubmittedReportRecord>();

      // Local logs take precedence for rich field telemetry (multi-PCR & evidence gallery)
      if (Array.isArray(localLogs)) {
        localLogs.forEach((item: any) => {
          if (!item || !item.id) return;
          const isVerified = Boolean(item.isVerified || item.verifiedAt);
          const isClosed = Boolean(item.isClosed || item.closedAt || item.status === 'Closed');

          mergedMap.set(item.id, {
            id: item.id,
            referenceCode: item.referenceCode || `RESQ-${item.id.slice(0, 8).toUpperCase()}`,
            title: item.title || 'Submitted Incident Report',
            category: item.category || 'MedicalEmergency',
            severity: item.severity || 'Medium',
            status: isClosed ? 'Closed' : isVerified ? 'Verified' : (item.status || 'Responded'),
            locationLabel: item.locationLabel || item.location || 'Municipal Sector Coordinates',
            latitude: typeof item.latitude === 'number' ? item.latitude : 14.6514,
            longitude: typeof item.longitude === 'number' ? item.longitude : 121.0493,
            ipAddress: item.ipAddress || '192.168.42.118',
            responderName: item.responderName || 'Dr. Maria Clara Santos MD',
            responderUnit: item.unitCode || item.responderUnit || 'RHU-ALPHA-1',
            submittedAt: item.createdAt || item.submittedAt || new Date().toISOString(),
            isVerified,
            verifiedAt: item.verifiedAt || (isVerified ? new Date().toISOString() : null),
            verifiedBy: item.verifiedBy,
            isClosed,
            closedAt: item.closedAt || (isClosed ? new Date().toISOString() : null),
            evidencePhotos: Array.isArray(item.evidencePhotos) ? item.evidencePhotos : [],
            casualties: Array.isArray(item.casualties) ? item.casualties : [],
            notes: item.note || item.notes || ''
          });
        });
      }

      // Merge backend reports that have been marked as Responded/Resolved
      if (Array.isArray(backendReports)) {
        backendReports.forEach((rep) => {
          if (!rep || !rep.id) return;
          if (mergedMap.has(rep.id)) return;

          const s = (rep.status || '').toLowerCase();
          const isRespondedOrDone = s === 'responded' || s === 'resolved' || s === 'completed' || Boolean(rep.verifiedAt);
          if (!isRespondedOrDone && !rep.verifiedAt) return;

          const isVerified = Boolean(rep.verifiedAt);
          const isClosed = s === 'resolved' || s === 'completed';

          mergedMap.set(rep.id, {
            id: rep.id,
            referenceCode: rep.referenceCode || `RESQ-${rep.id.slice(0, 8).toUpperCase()}`,
            title: rep.title || 'Field Incident Report',
            category: rep.category || 'General',
            severity: rep.severity || 'Medium',
            status: isClosed ? 'Closed' : isVerified ? 'Verified' : 'Responded',
            locationLabel: rep.locationLabel || 'Municipal Sector Field Coordinates',
            latitude: rep.latitude ?? 14.6514,
            longitude: rep.longitude ?? 121.0493,
            ipAddress: '192.168.42.118',
            responderName: rep.reporterName || 'Field Responder Unit',
            responderUnit: rep.allocatedUnitCode || 'RHU-EMS',
            submittedAt: rep.createdAt || new Date().toISOString(),
            isVerified,
            verifiedAt: rep.verifiedAt || (isVerified ? new Date().toISOString() : null),
            verifiedBy: isVerified ? 'LDRRMO Admin Command' : undefined,
            isClosed,
            closedAt: rep.resolvedAt || (isClosed ? new Date().toISOString() : null),
            evidencePhotos: rep.imageUrl ? [{ url: rep.imageUrl, timestamp: rep.createdAt, caption: 'Attached Evidence' }] : [],
            casualties: [],
            notes: rep.note || ''
          });
        });
      }

      // If empty, seed initial realistic submitted reports so Admin immediately sees the workflow in action
      if (mergedMap.size === 0) {
        const seedId = 'seed-sub-rep-01';
        mergedMap.set(seedId, {
          id: seedId,
          referenceCode: 'RESQ-20261028-001',
          title: 'Two-Motorcycle Collision with Minor Injury',
          category: 'VehicleAccident',
          severity: 'Medium',
          status: 'Responded',
          locationLabel: 'Corner University Ave, Barangay Poblacion',
          latitude: 14.6514,
          longitude: 121.0493,
          ipAddress: '192.168.42.118',
          responderName: 'Dr. Maria Clara Santos MD',
          responderUnit: 'RHU-ALPHA-1',
          submittedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          isVerified: false,
          verifiedAt: null,
          isClosed: false,
          closedAt: null,
          evidencePhotos: [
            {
              url: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?auto=format&fit=crop&w=800&q=80',
              timestamp: formatDateTimeWithSecondsAmPm(new Date(Date.now() - 15 * 60 * 1000).toISOString()),
              caption: 'On-scene motorcycle collision point of impact'
            }
          ],
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
              receivingHospital: 'San Mateo Municipal Hospital',
              chiefComplaint: 'Minor abrasions on right knee and forearm',
              narrative: 'Patient conscious and coherent. Dressed abrasions with sterile gauze.',
              interventions: ['Wound Cleaning', 'Sterile Dressing', 'Vitals Monitored'],
              recordedAt: formatDateTimeWithSecondsAmPm(new Date().toISOString())
            }
          ],
          notes: 'Both riders stabilized. Transport not required, cleared by Medical Officer III.'
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
          evidencePhotos: [
            {
              url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
              timestamp: formatDateTimeWithSecondsAmPm(new Date(Date.now() - 20 * 60 * 1000).toISOString()),
              caption: 'Electrical conduit isolated and perimeter cordoned'
            }
          ],
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

  // Telemetry KPIs ($N=0$ Safe)
  const totalSubmitted = reports.length;
  const pendingReview = reports.filter((r) => !r.isVerified && !r.isClosed).length;
  const verifiedCount = reports.filter((r) => r.isVerified && !r.isClosed).length;
  const closedCount = reports.filter((r) => r.isClosed).length;

  // Verify Action (Starts 5-minute countdown timer)
  const handleVerifyReport = useCallback(
    (reportId: string) => {
      const verifiedTimestamp = new Date().toISOString();

      setReports((prev) => {
        const next = prev.map((r) => {
          if (r.id !== reportId) return r;
          return {
            ...r,
            isVerified: true,
            status: 'Verified',
            verifiedAt: verifiedTimestamp,
            verifiedBy: 'LDRRMO Admin Command'
          };
        });

        // Sync with localStorage
        try {
          const raw = localStorage.getItem(STORAGE_INCIDENT_LOGS_KEY);
          let localArr: any[] = raw ? JSON.parse(raw) : [];
          localArr = localArr.map((item) => {
            if (item.id === reportId) {
              return {
                ...item,
                isVerified: true,
                status: 'Verified',
                verifiedAt: verifiedTimestamp,
                verifiedBy: 'LDRRMO Admin Command'
              };
            }
            return item;
          });
          localStorage.setItem(STORAGE_INCIDENT_LOGS_KEY, JSON.stringify(localArr));
        } catch (err) {
          console.error('[SubmittedReportsPage] Failed to persist verification:', err);
        }

        return next;
      });

      // Dispatch global events so responder map green pin starts 5m timer and Header bell notifies
      window.dispatchEvent(
        new CustomEvent('resqtrack:report', {
          detail: { id: reportId, status: 'Verified', verifiedAt: verifiedTimestamp }
        })
      );
      window.dispatchEvent(
        new CustomEvent('resqtrack:notification', {
          detail: {
            type: 'VERIFIED_SUBMITTED_INCIDENT_LOGS',
            title: 'Submitted Incident Log Verified',
            message: `Report ${reportId} verified by LDRRMO Admin. 5-Minute Auto-Close countdown initiated.`,
            incidentId: reportId
          }
        })
      );

      setToastMessage('Report verified. 5-Minute auto-close timer started on radar HUD.');
      setTimeout(() => setToastMessage(null), 4000);
    },
    []
  );

  // Manual Close Action
  const handleManualClose = useCallback(
    (reportId: string) => {
      const closedTimestamp = new Date().toISOString();

      setReports((prev) => {
        const next = prev.map((r) => {
          if (r.id !== reportId) return r;
          return {
            ...r,
            isClosed: true,
            status: 'Closed',
            closedAt: closedTimestamp
          };
        });

        try {
          const raw = localStorage.getItem(STORAGE_INCIDENT_LOGS_KEY);
          let localArr: any[] = raw ? JSON.parse(raw) : [];
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
        } catch (err) {
          console.error('[SubmittedReportsPage] Failed to persist close:', err);
        }

        return next;
      });

      window.dispatchEvent(
        new CustomEvent('resqtrack:report', {
          detail: { id: reportId, status: 'Closed', isClosed: true, closedAt: closedTimestamp }
        })
      );
      window.dispatchEvent(
        new CustomEvent('resqtrack:notification', {
          detail: {
            type: 'CLOSE_CASE',
            title: 'Case Finalized & Closed',
            message: `Incident ${reportId} marked closed by LDRRMO Admin.`,
            incidentId: reportId
          }
        })
      );

      setToastMessage('Incident successfully finalized and closed.');
      setTimeout(() => setToastMessage(null), 4000);
    },
    []
  );

  // Filter & Search Pipeline
  const filteredReports = useMemo(() => {
    let result = [...reports];

    // Status filter
    if (statusFilter === 'PENDING') {
      result = result.filter((r) => !r.isVerified && !r.isClosed);
    } else if (statusFilter === 'VERIFIED') {
      result = result.filter((r) => r.isVerified && !r.isClosed);
    } else if (statusFilter === 'CLOSED') {
      result = result.filter((r) => r.isClosed);
    }

    // Debounced search
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.referenceCode.toLowerCase().includes(query) ||
          r.responderName.toLowerCase().includes(query) ||
          r.responderUnit.toLowerCase().includes(query) ||
          r.locationLabel.toLowerCase().includes(query) ||
          r.category.toLowerCase().includes(query)
      );
    }

    // Sorting
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
    pageSize,
    goToPage,
    nextPage,
    prevPage,
    setPageSize
  } = usePagination(filteredReports, { initialPageSize: 10 });

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

  // Compute 5-minute countdown remaining for verified reports
  const getRemainingSeconds = (verifiedAtStr: string | null): number => {
    if (!verifiedAtStr) return 0;
    const verifiedMs = new Date(verifiedAtStr).getTime();
    if (isNaN(verifiedMs)) return 0;
    const elapsed = currentTime - verifiedMs;
    const remaining = Math.max(0, FIVE_MINUTES_MS - elapsed);
    return Math.floor(remaining / 1000);
  };

  const openLightbox = (images: Array<{ url: string; timestamp?: string; caption?: string }>, idx: number) => {
    setLightboxImages(images.map((img) => ({ url: img.url, timestamp: img.timestamp, caption: img.caption })));
    setLightboxIndex(idx);
    setLightboxImageUrl(images[idx]?.url || null);
    setIsLightboxOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-700/80 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
              LDRRMO EXECUTIVE COMMAND // MUNICIPAL DISPATCH C2
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase flex items-center gap-2.5">
            <FileCheck className="w-6 h-6 text-emerald-400" />
            Submitted Field Incident Reports
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Operational dossiers, multi-casualty PCR vitals & evidence packages submitted by field responders
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSubmittedReports()}
            className="text-xs font-mono font-bold flex items-center gap-1.5 border-slate-600 hover:border-slate-400 text-slate-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            SYNC
          </Button>
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Telemetry KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="tactical-card p-4 border-l-4 border-l-sky-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">Total Submitted Reports</p>
            <FileText className="w-4 h-4 text-sky-400" />
          </div>
          <h3 className="text-2xl font-black text-white mt-1.5">{totalSubmitted}</h3>
          <span className="text-[10px] text-sky-400 font-mono">Lifetime Field Logs</span>
        </div>

        <div className="tactical-card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">Pending Verification</p>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-2xl font-black text-amber-400 mt-1.5">{pendingReview}</h3>
          <span className="text-[10px] text-amber-400 font-mono">Awaiting Admin Review</span>
        </div>

        <div className="tactical-card p-4 border-l-4 border-l-rose-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">Verified & Actioned</p>
            <Activity className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-2xl font-black text-rose-400 mt-1.5">{verifiedCount}</h3>
          <span className="text-[10px] text-rose-300 font-mono">5m Auto-Close Active</span>
        </div>

        <div className="tactical-card p-4 border-l-4 border-l-emerald-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">Closed / Resolved</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-emerald-400 mt-1.5">{closedCount}</h3>
          <span className="text-[10px] text-emerald-400 font-mono">100% Solved Missions</span>
        </div>
      </div>

      {/* Filter Tabs + SearchBar + Sorter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            ALL ({totalSubmitted})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            PENDING REVIEW ({pendingReview})
          </button>
          <button
            onClick={() => setStatusFilter('VERIFIED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              statusFilter === 'VERIFIED'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            VERIFIED 5M TIMER ({verifiedCount})
          </button>
          <button
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              statusFilter === 'CLOSED'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            CLOSED ({closedCount})
          </button>
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

      {/* Main Content: Table or Cards */}
      {paginatedItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <FileCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">No Submitted Reports Found</h3>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Submitted incident dossiers from field responders will automatically populate here.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] uppercase font-mono text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Ref Code & Incident</th>
                <th className="py-3 px-4">Responding Unit</th>
                <th className="py-3 px-4">Casualties / PCR</th>
                <th className="py-3 px-4">Evidence</th>
                <th className="py-3 px-4">Status & Timer</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {paginatedItems.map((r) => {
                const remSec = getRemainingSeconds(r.verifiedAt);
                const mm = Math.floor(remSec / 60).toString().padStart(2, '0');
                const ss = (remSec % 60).toString().padStart(2, '0');

                return (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setSelectedReportId(r.id);
                      setIsDetailModalOpen(true);
                    }}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-400 text-xs">{r.referenceCode}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                            r.severity === 'Critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : r.severity === 'High'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          }`}
                        >
                          {r.severity}
                        </span>
                      </div>
                      <p className="text-slate-200 text-xs font-semibold font-sans mt-0.5 group-hover:text-white">
                        {r.title}
                      </p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-xs">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        {r.locationLabel}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 font-sans">
                      <p className="text-white text-xs font-bold">{r.responderName}</p>
                      <p className="text-[10px] font-mono text-sky-400 mt-0.5">{r.responderUnit}</p>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {formatDateTimeWithSecondsAmPm(r.submittedAt)}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      {r.casualties.length > 0 ? (
                        <div>
                          <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-600/40 font-bold text-[10px]">
                            {r.casualties.length} CASUALTIES
                          </span>
                          <p className="text-[10px] text-slate-400 font-sans mt-1 truncate max-w-[140px]">
                            {r.casualties.map((c) => c.patientName).join(', ')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">0 Recorded</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {r.evidencePhotos.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLightbox(r.evidencePhotos, 0);
                            }}
                            className="relative group/thumb rounded overflow-hidden border border-slate-700 hover:border-sky-400 transition-all"
                          >
                            <img
                              src={r.evidencePhotos[0].url}
                              alt="Evidence"
                              className="w-10 h-10 object-cover"
                            />
                            {r.evidencePhotos.length > 1 && (
                              <span className="absolute bottom-0 right-0 bg-slate-950/80 text-[8px] text-white px-1 font-mono font-bold">
                                +{r.evidencePhotos.length - 1}
                              </span>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">None</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {r.isClosed ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                          CLOSED / SOLVED
                        </span>
                      ) : r.isVerified ? (
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/40 font-bold text-[10px] flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-sky-400 animate-spin" />
                            CLOSING IN {mm}:{ss}
                          </span>
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-400 rounded-full transition-all duration-1000"
                              style={{ width: `${Math.max(0, (remSec / 300) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-bold text-[10px]">
                          AWAITING REVIEW
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {!r.isVerified && !r.isClosed && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleVerifyReport(r.id)}
                            className="text-[10px] font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            <Check className="w-3 h-3" />
                            VERIFY
                          </Button>
                        )}
                        {!r.isClosed && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManualClose(r.id)}
                            className="text-[10px] font-mono font-bold border-slate-700 hover:border-rose-400 text-slate-300"
                          >
                            CLOSE
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedReportId(r.id);
                            setIsDetailModalOpen(true);
                          }}
                          className="text-[10px] font-mono text-slate-400 hover:text-white"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((r) => {
            const remSec = getRemainingSeconds(r.verifiedAt);
            const mm = Math.floor(remSec / 60).toString().padStart(2, '0');
            const ss = (remSec % 60).toString().padStart(2, '0');

            return (
              <div
                key={r.id}
                onClick={() => {
                  setSelectedReportId(r.id);
                  setIsDetailModalOpen(true);
                }}
                className="tactical-card p-4 flex flex-col justify-between gap-3 cursor-pointer hover:border-slate-600 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-rose-400 text-xs font-mono">{r.referenceCode}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold font-mono ${
                        r.severity === 'Critical'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : r.severity === 'High'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      }`}
                    >
                      {r.severity}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                    {r.title}
                  </h3>

                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    {r.locationLabel}
                  </p>

                  <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Responder:</span>
                      <span className="font-bold text-white">{r.responderName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Unit:</span>
                      <span className="text-sky-400">{r.responderUnit}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Casualties:</span>
                      <span className="text-amber-400 font-bold">{r.casualties.length} recorded</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Submitted:</span>
                      <span className="text-slate-400">{formatDateTimeWithSecondsAmPm(r.submittedAt)}</span>
                    </div>
                  </div>

                  {r.isVerified && !r.isClosed && (
                    <div className="mt-2.5 p-2 rounded bg-sky-950/40 border border-sky-500/40 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-sky-300">
                        <span>Auto-Close Countdown:</span>
                        <span className="font-bold">
                          {mm}:{ss}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-400 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.max(0, (remSec / 300) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center justify-between pt-2 border-t border-slate-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    {r.isClosed ? (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">CLOSED</span>
                    ) : r.isVerified ? (
                      <span className="text-[10px] font-mono text-sky-400 font-bold">VERIFIED</span>
                    ) : (
                      <span className="text-[10px] font-mono text-amber-400 font-bold">PENDING REVIEW</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!r.isVerified && !r.isClosed && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleVerifyReport(r.id)}
                        className="text-[10px] font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        VERIFY
                      </Button>
                    )}
                    {!r.isClosed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManualClose(r.id)}
                        className="text-[10px] font-mono font-bold border-slate-700 hover:border-rose-400 text-slate-300"
                      >
                        CLOSE
                      </Button>
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
        <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400">
            Page {currentPage} of {totalPages} ({filteredReports.length} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={prevPage}
              className="text-xs"
            >
              PREV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={nextPage}
              className="text-xs"
            >
              NEXT
            </Button>
          </div>
        </div>
      )}

      {/* Complete Submitted Dossier Floating Modal */}
      {isDetailModalOpen && selectedReport && (
        <DefaultFloatingModalCard
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Submitted Dossier: ${selectedReport.referenceCode}`}
          subtitle={`${selectedReport.title} — Submitted by ${selectedReport.responderName} (${selectedReport.responderUnit})`}
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          <div className="space-y-6 text-xs text-slate-200">
            {/* Top Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Severity</span>
                <p className="text-sm font-black text-rose-400 mt-0.5">{selectedReport.severity}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Status</span>
                <p className="text-sm font-black text-emerald-400 mt-0.5">{selectedReport.status}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Terminal IP</span>
                <p className="text-sm font-mono text-sky-400 mt-0.5">{selectedReport.ipAddress}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Submitted At</span>
                <p className="text-xs font-mono text-slate-300 mt-0.5">
                  {formatDateTimeWithSecondsAmPm(selectedReport.submittedAt)}
                </p>
              </div>
            </div>

            {/* Location & GPS Info */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span className="text-slate-300">{selectedReport.locationLabel}</span>
              </div>
              <span className="text-slate-500 text-[11px]">
                Coordinates: {selectedReport.latitude.toFixed(6)}° N, {selectedReport.longitude.toFixed(6)}° E
              </span>
            </div>

            {/* Evidence Gallery Section (Supports up to 40 images with exact timestamp) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Camera className="w-4 h-4 text-sky-400" />
                  Field Evidence Gallery ({selectedReport.evidencePhotos.length} Items)
                </h4>
                <span className="text-[10px] font-mono text-slate-500">
                  Exact timestamps with seconds (YYYY-MM-DD hh:mm:ss A)
                </span>
              </div>

              {selectedReport.evidencePhotos.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-500 font-mono text-xs">
                  No photographic evidence attached to this dossier.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedReport.evidencePhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => openLightbox(selectedReport.evidencePhotos, idx)}
                      className="group/item relative rounded-lg overflow-hidden border border-slate-800 hover:border-sky-400 cursor-pointer bg-slate-950 transition-all"
                    >
                      <img
                        src={photo.url}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-28 object-cover group-hover/item:scale-105 transition-transform duration-200"
                      />
                      <div className="p-2 bg-slate-900/90 border-t border-slate-800 text-[9px] font-mono text-slate-400 truncate">
                        {photo.timestamp || formatDateTimeWithSecondsAmPm(selectedReport.submittedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multi-Casualty PCR Records Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  Multi-Casualty Patient Care Records ({selectedReport.casualties.length} Civilians)
                </h4>
              </div>

              {selectedReport.casualties.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-500 font-mono text-xs">
                  No individual patient care records recorded for this incident.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedReport.casualties.map((c, i) => (
                    <div key={c.id || i} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center">
                            #{i + 1}
                          </span>
                          <span className="font-bold text-white text-xs">{c.patientName}</span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            ({c.gender}, {c.age} yrs)
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-sky-400 font-bold px-2 py-0.5 rounded bg-sky-950/80 border border-sky-600/30">
                          {c.levelOfConsciousness || 'Conscious'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono text-[11px]">
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/60">
                          <span className="text-slate-500 text-[9px] block">BP (mmHg)</span>
                          <span className="font-bold text-white">
                            {c.bpSystolic}/{c.bpDiastolic}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/60">
                          <span className="text-slate-500 text-[9px] block">HR (BPM)</span>
                          <span className="font-bold text-white">{c.heartRate}</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/60">
                          <span className="text-slate-500 text-[9px] block">SpO2</span>
                          <span className="font-bold text-emerald-400">{c.spO2}%</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/60">
                          <span className="text-slate-500 text-[9px] block">Resp Rate</span>
                          <span className="font-bold text-white">{c.respiratoryRate}/min</span>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800/60">
                          <span className="text-slate-500 text-[9px] block">Temp (°C)</span>
                          <span className="font-bold text-white">{c.temp}°C</span>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-1">
                        <p className="text-slate-300">
                          <strong className="text-slate-400">Chief Complaint:</strong> {c.chiefComplaint}
                        </p>
                        {c.narrative && (
                          <p className="text-slate-400">
                            <strong className="text-slate-400">Clinical Narrative:</strong> {c.narrative}
                          </p>
                        )}
                        {c.interventions && c.interventions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <strong className="text-slate-400 text-[10px]">Interventions:</strong>
                            {c.interventions.map((it, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-sky-300 font-mono"
                              >
                                {it}
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

            {/* Action Bar inside Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-[10px] font-mono text-slate-500">
                Action will update live radar pins and notification channels
              </span>

              <div className="flex items-center gap-2">
                {!selectedReport.isVerified && !selectedReport.isClosed && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      handleVerifyReport(selectedReport.id);
                      setIsDetailModalOpen(false);
                    }}
                    className="text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    VERIFY REPORT (START 5M TIMER)
                  </Button>
                )}
                {!selectedReport.isClosed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleManualClose(selectedReport.id);
                      setIsDetailModalOpen(false);
                    }}
                    className="text-xs font-mono font-bold border-slate-700 hover:border-rose-400 text-slate-300"
                  >
                    CLOSE CASE
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-xs font-mono"
                >
                  DISMISS
                </Button>
              </div>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* Up to 40 Images Lightbox */}
      {isLightboxOpen && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageUrl={lightboxImageUrl}
          images={lightboxImages}
          initialIndex={lightboxIndex}
          title="Evidence Package Inspection"
        />
      )}
    </div>
  );
};

export default SubmittedReportsPage;
