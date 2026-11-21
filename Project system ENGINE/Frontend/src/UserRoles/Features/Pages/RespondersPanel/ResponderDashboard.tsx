// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Tactical field operations console for RHU, BFP Fire, and PNP units with live dispatches,
// authorized Verify / Reject / Dispatch verification actions for Submitted/Pending incidents, and satellite GPS radar
// strictly backed by PostgreSQL /api/reports, /api/incidents/fixtures, and /api/responder-ops/roster.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis, ZERO external Unsplash URLs.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/Hooks/useSession';
import {
  getAllReports,
  getAgencyReports,
  verifyReport,
  assignUnitToReport,
  ReportItem
} from '@/Endpoints/reportsApi';
import { getIncidentFixtures, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import {
  getDutyRoster,
  updateUnitDutyStatus,
  updateDutyStatus,
  DutyUnit
} from '@/Endpoints/responderOpsApi';
import {
  SatelliteCommandMap,
  MapMarker,
  SearchBar,
  TableCardToggle,
  useTableCardView,
  PatientCareRecordModal,
  PoliceBlotterModal,
  Dropdown
} from '@/Shared';
import {
  useGpsLocation,
  useReportEventBus,
  useValueRefreshAuto,
  useDebounce,
  usePagination
} from '@/Hooks';
import {
  formatGpsCoord,
  formatRelativeTime,
  formatIsoTimestamp
} from '@/Libs/Assets/formatters';
import { ResponderButton } from './Shared/ResponderButton';
import { ResponderModalCard } from './Shared/ResponderModalCard';
import {
  Ambulance,
  Flame,
  Shield,
  AlertTriangle,
  Radio,
  MapPin,
  ArrowUpRight,
  Clock,
  HeartPulse,
  Maximize2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Filter,
  Crosshair,
  Send,
  Activity,
  Users,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Image as ImageIcon
} from 'lucide-react';

export type FieldStatusType = 'AVAILABLE' | 'EN ROUTE' | 'ON SCENE' | 'RETURNING';

export interface TacticalRadarPointer {
  id: string;
  referenceCode: string;
  title: string;
  category: string;
  isMedicAllowed: boolean;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
  latitude: number;
  longitude: number;
  physicalAddress: string;
  ipAddress: string;
  imageUrl: string;
  note: string;
  createdAt: string;
  agency: 'RHU' | 'FIRE' | 'PNP' | 'MDRRMO';
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// 7 Medic-Allowed Categories
export const MEDIC_ALLOWED_CATEGORIES: readonly string[] = [
  'Medical Emergency',
  'Vehicular Accident',
  'Cardiac Arrest / Resuscitation',
  'Trauma / Severe Bleeding',
  'Obstetric / Childbirth Emergency',
  'Drowning / Water Rescue Medical',
  'Mass Casualty Incident'
];

const classifyIsMedicCategory = (category: unknown, title?: unknown): boolean => {
  const catStr = String(category ?? '').trim();
  const titleStr = String(title ?? '').trim();
  const combined = `${catStr} ${titleStr}`.toLowerCase();
  return (
    MEDIC_ALLOWED_CATEGORIES.some((c) => c.toLowerCase() === catStr.toLowerCase()) ||
    combined.includes('medical') ||
    combined.includes('accident') ||
    combined.includes('cardiac') ||
    combined.includes('trauma') ||
    combined.includes('bleeding') ||
    combined.includes('obstetric') ||
    combined.includes('childbirth') ||
    combined.includes('drowning') ||
    combined.includes('casualty') ||
    combined.includes('patient') ||
    combined.includes('ambulance')
  );
};

const resolvePointerAgency = (
  recommendedUnit?: string | null,
  isMedic?: boolean
): 'RHU' | 'FIRE' | 'PNP' | 'MDRRMO' => {
  const norm = String(recommendedUnit ?? '').trim().toUpperCase();
  if (norm === 'RHU') return 'RHU';
  if (norm === 'FIRE' || norm === 'BFP') return 'FIRE';
  if (norm === 'PNP' || norm === 'POLICE') return 'PNP';
  if (norm === 'MDRRMO' || norm === 'LDRRMO') return 'MDRRMO';
  return isMedic ? 'RHU' : 'MDRRMO';
};

const SEVERITY_PRIORITY_WEIGHT: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Moderate: 2,
  Low: 1
};

const isSubmittedOrPendingStatus = (status?: string | null): boolean => {
  const normalized = (status || 'Reported').trim().toLowerCase();
  return (
    normalized === 'reported' ||
    normalized === 'submitted' ||
    normalized === 'pending' ||
    normalized === 'pending dispatch' ||
    normalized === 'active triage' ||
    normalized === 'immediate response' ||
    normalized === 'active'
  );
};

const isVerifiedStatus = (status?: string | null): boolean => {
  const normalized = (status || '').trim().toLowerCase();
  return normalized === 'verified' || normalized === 'responded';
};

const computeRemainingSecondsFromVerifiedAt = (
  verifiedAt?: string | null,
  resolvedAt?: string | null,
  status?: string | null,
  nowMs: number = Date.now()
): number | null => {
  const st = (status || '').trim().toLowerCase();
  if (resolvedAt || st === 'resolved' || st === 'closed') return 0;
  if (!verifiedAt) return null;
  const verifiedMs = new Date(verifiedAt).getTime();
  if (Number.isNaN(verifiedMs)) return null;
  return Math.max(0, Math.floor((verifiedMs + FIVE_MINUTES_MS - nowMs) / 1000));
};

const formatQueueStatusBadge = (
  status?: string | null,
  allocatedUnitCode?: string | null,
  verifiedAt?: string | null,
  resolvedAt?: string | null
): { label: string; pillClass: string } => {
  const raw = (status || 'Reported').trim().toUpperCase();

  if (raw === 'REJECTED' || raw === 'DECLINED') {
    return {
      label: 'Rejected',
      pillClass: 'bg-[#670626] text-[#F7F1EA] border border-[#4A041A]'
    };
  }
  if (raw === 'RESOLVED' || raw === 'CLOSED' || raw === 'COMPLETED' || Boolean(resolvedAt)) {
    return {
      label: 'Resolved',
      pillClass: 'bg-emerald-100 text-emerald-900 border border-emerald-700/30'
    };
  }
  if (
    raw === 'ALLOCATED' ||
    raw === 'ENROUTE' ||
    raw === 'ONSCENE' ||
    raw === 'DISPATCHED' ||
    Boolean(allocatedUnitCode)
  ) {
    return {
      label: 'Dispatched',
      pillClass: 'bg-[#A83B4D] text-[#F7F1EA] border border-[#A83B4D]'
    };
  }
  if (raw === 'VERIFIED' || raw === 'RESPONDED' || Boolean(verifiedAt)) {
    return {
      label: 'Verified',
      pillClass: 'bg-sky-100 text-sky-900 border border-sky-700/30'
    };
  }
  if (raw === 'PENDING' || raw === 'PENDING DISPATCH') {
    return {
      label: 'Pending',
      pillClass: 'bg-amber-100 text-amber-900 border border-amber-700/30'
    };
  }
  return {
    label: 'Submitted',
    pillClass: 'bg-[#E9D9D0] text-[#670626] border border-[#A83B4D]/45'
  };
};

export const ResponderDashboard: React.FC = () => {
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { coords, isLocating, refreshGps } = useGpsLocation();
  const { dispatchReportEvent } = useReportEventBus();

  const [allReports, setAllReports] = useState<ReportItem[]>([]);
  const [dispatches, setDispatches] = useState<ReportItem[]>([]);
  const [fixtures, setFixtures] = useState<IncidentFixture[]>([]);
  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [fieldStatus, setFieldStatus] = useState<FieldStatusType>('AVAILABLE');
  const [pendingStatusTarget, setPendingStatusTarget] = useState<FieldStatusType | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const [radarSortMode, setRadarSortMode] = useState<'ALL' | 'UNIT_SCOPE'>('ALL');
  const [palePointerEnabled, setPalePointerEnabled] = useState<boolean>(true);
  const [mapCenterOverride, setMapCenterOverride] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [selectedPointer, setSelectedPointer] = useState<TacticalRadarPointer | null>(null);
  const [isExpandMapOpen, setIsExpandMapOpen] = useState<boolean>(false);

  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<ReportItem | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [isPcrModalOpen, setIsPcrModalOpen] = useState<boolean>(false);
  const [isBlotterModalOpen, setIsBlotterModalOpen] = useState<boolean>(false);
  const { viewMode, setViewMode } = useTableCardView('card');

  const activeUnit: 'RHU' | 'FIRE' | 'PNP' = useMemo(() => {
    const u = (session?.unit || '').toUpperCase();
    if (u === 'FIRE' || u === 'BFP') return 'FIRE';
    if (u === 'PNP') return 'PNP';
    return 'RHU';
  }, [session?.unit]);

  const isRhuMedic = activeUnit === 'RHU';

  const loadData = useCallback(async () => {
    if (!session || session.unit === 'None') return;
    try {
      const [allReps, agencyReps, fixs, rost] = await Promise.all([
        getAllReports().catch(() => [] as ReportItem[]),
        getAgencyReports(activeUnit).catch(() => [] as ReportItem[]),
        getIncidentFixtures().catch(() => [] as IncidentFixture[]),
        getDutyRoster(activeUnit).catch(() => [] as DutyUnit[])
      ]);
      const safeAll = Array.isArray(allReps) ? allReps : [];
      const safeAgency = Array.isArray(agencyReps) ? agencyReps : [];
      setAllReports(safeAll.length > 0 ? safeAll : safeAgency);
      setDispatches(safeAgency);
      setFixtures(Array.isArray(fixs) ? fixs : []);
      setRoster(Array.isArray(rost) ? rost : []);

      const myUnit = (Array.isArray(rost) ? rost : []).find(
        (u) => (u.agency || '').toUpperCase() === activeUnit
      );
      if (myUnit) {
        if (myUnit.status === 'OnDuty') setFieldStatus('AVAILABLE');
        else if (myUnit.status === 'Dispatched') setFieldStatus('EN ROUTE');
        else if (myUnit.status === 'Standby') setFieldStatus('RETURNING');
      }
    } catch (err) {
      console.error('Failed to load tactical responder telemetry:', err);
    }
  }, [session, activeUnit]);

  useValueRefreshAuto(loadData, {
    intervalMs: 6000,
    enabled: true
  });

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useReportEventBus(() => {
    void loadData();
  });

  const showStatusFeedback = useCallback((msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => setStatusToast(null), 3500);
  }, []);

  const allRadarPointers: TacticalRadarPointer[] = useMemo(
    () =>
      allReports.map((d) => {
        const isMedic = classifyIsMedicCategory(d.category, d.title);
        const refCode = d.referenceCode || `INC-${d.id.slice(0, 6).toUpperCase()}`;
        const cleanImage =
          d.imageUrl && !String(d.imageUrl).toLowerCase().includes('unsplash.com')
            ? d.imageUrl
            : '';

        return {
          id: d.id,
          referenceCode: refCode,
          title: d.title,
          category: String(d.category ?? '').trim() || 'Incident',
          isMedicAllowed: isMedic,
          severity:
            d.severity === 'Critical' ||
            d.severity === 'High' ||
            d.severity === 'Medium' ||
            d.severity === 'Low'
              ? d.severity
              : 'High',
          status: d.status || 'Submitted',
          latitude: d.latitude,
          longitude: d.longitude,
          physicalAddress: d.locationLabel || formatGpsCoord(d.latitude, d.longitude),
          ipAddress: d.submittedIpAddress || 'Unavailable',
          imageUrl: cleanImage,
          note: d.note || 'No field notes.',
          createdAt: d.createdAt,
          agency: resolvePointerAgency(d.recommendedAgencyUnit, isMedic)
        };
      }),
    [allReports]
  );

  const isPointerInUnitScope = useCallback(
    (ptr: TacticalRadarPointer): boolean => {
      if (activeUnit === 'RHU') return ptr.isMedicAllowed || ptr.agency === 'RHU';
      if (activeUnit === 'FIRE') return ptr.agency === 'FIRE';
      return ptr.agency === 'PNP';
    },
    [activeUnit]
  );

  const visibleRadarPointers = useMemo(() => {
    if (radarSortMode === 'UNIT_SCOPE') {
      return allRadarPointers.filter(isPointerInUnitScope);
    }
    return allRadarPointers;
  }, [allRadarPointers, radarSortMode, isPointerInUnitScope]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const expandMapParam = params.get('expandMap');
    const focusIncidentId = params.get('focusIncidentId') || params.get('incidentId');

    if (expandMapParam === 'true') {
      setIsExpandMapOpen(true);
    }

    if (focusIncidentId && allRadarPointers.length > 0) {
      const target =
        allRadarPointers.find(
          (p) =>
            p.id === focusIncidentId ||
            p.referenceCode.toLowerCase() === focusIncidentId.toLowerCase()
        ) || allRadarPointers[0];

      if (target) {
        setMapCenterOverride({ lat: target.latitude, lng: target.longitude });
        setSelectedPointer(target);
      }
    }
  }, [location.search, allRadarPointers]);

  // Real-time 1s clock for DB verifiedAt + 5m - now countdown
  useEffect(() => {
    if (!selectedIncident) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [selectedIncident]);

  const selectedIncidentSecondsLeft = useMemo(() => {
    if (!selectedIncident) return null;
    return computeRemainingSecondsFromVerifiedAt(
      selectedIncident.verifiedAt,
      selectedIncident.resolvedAt,
      selectedIncident.status,
      nowMs
    );
  }, [selectedIncident, nowMs]);

  const formatCountdownTimer = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const requestStatusChange = (targetStatus: FieldStatusType) => {
    setPendingStatusTarget(targetStatus);
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusTarget) return;
    const nextStatus = pendingStatusTarget;
    setPendingStatusTarget(null);
    setIsUpdatingStatus(true);

    let mappedDuty: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty' = 'OnDuty';
    if (nextStatus === 'AVAILABLE') mappedDuty = 'OnDuty';
    else if (nextStatus === 'EN ROUTE' || nextStatus === 'ON SCENE') mappedDuty = 'Dispatched';
    else if (nextStatus === 'RETURNING') mappedDuty = 'Standby';

    const responderFullName = session?.fullName || `${activeUnit} Responder`;
    const myUnit = roster.find((u) => (u.agency || '').toUpperCase() === activeUnit);

    try {
      if (myUnit) {
        await updateUnitDutyStatus(myUnit.id, mappedDuty);
      } else {
        await updateDutyStatus(mappedDuty);
      }
      setFieldStatus(nextStatus);
      showStatusFeedback(`Status broadcast to command: Unit is now ${nextStatus}`);

      const eventPayload = {
        type: 'RESPONDER_STATUS_CHANGE',
        unit: activeUnit,
        responderName: responderFullName,
        rank: session?.rankOrTitle || 'Responder',
        fieldStatus: nextStatus,
        dutyStatus: mappedDuty,
        timestamp: new Date().toISOString()
      };

      dispatchReportEvent(eventPayload);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('resqtrack:notification', { detail: eventPayload }));
      }
      await loadData();
    } catch {
      showStatusFeedback('Failed to update unit duty status on server.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleVerifyOrReject = async (
    item: ReportItem,
    targetStatus: 'Verified' | 'Rejected'
  ): Promise<void> => {
    setActionBusyId(item.id);
    const responderActor = session?.fullName || `${activeUnit} Responder`;
    const note =
      targetStatus === 'Verified'
        ? `Verified by ${responderActor} (${activeUnit}) at ${new Date().toLocaleTimeString()}`
        : `Rejected by ${responderActor} (${activeUnit}) at ${new Date().toLocaleTimeString()}`;

    try {
      await verifyReport(item.id, targetStatus, note);
      showStatusFeedback(`Incident ${item.referenceCode} updated to ${targetStatus}.`);
      dispatchReportEvent({ type: 'REPORT_VERIFIED', reportId: item.id, status: targetStatus });
      await loadData();
      if (selectedIncident?.id === item.id) {
        setSelectedIncident({
          ...item,
          status: targetStatus,
          verifiedAt: targetStatus === 'Verified' ? item.verifiedAt || new Date().toISOString() : item.verifiedAt
        });
      }
    } catch {
      showStatusFeedback(`Failed to mark ${item.referenceCode} as ${targetStatus} on server.`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleQuickDispatch = async (item: ReportItem): Promise<void> => {
    const myUnit = roster.find((u) => (u.agency || '').toUpperCase() === activeUnit);
    if (!myUnit) {
      showStatusFeedback(`No active ${activeUnit} duty unit registered to dispatch.`);
      return;
    }
    setActionBusyId(item.id);
    try {
      await assignUnitToReport(item.id, myUnit.id);
      showStatusFeedback(`Dispatched ${myUnit.unitCode} to ${item.referenceCode}.`);
      dispatchReportEvent({ type: 'UNIT_DISPATCHED', reportId: item.id, unitCode: myUnit.unitCode });
      await loadData();
    } catch {
      showStatusFeedback(`Failed to dispatch ${myUnit.unitCode} on server.`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRequestDeployRedirect = (incidentId: string, referenceCode?: string) => {
    showStatusFeedback(
      `Opening tactical deployment channel for ${referenceCode || incidentId}...`
    );
    window.setTimeout(() => {
      setSelectedPointer(null);
      setSelectedIncident(null);
      setIsExpandMapOpen(false);
      navigate(`/responder/request-deploy?incidentId=${encodeURIComponent(incidentId)}`);
    }, 220);
  };

  const handleQuickNavigate = (lat: number, lng: number, pointerId?: string) => {
    setMapCenterOverride({ lat, lng });
    if (pointerId) {
      const found = allRadarPointers.find((p) => p.id === pointerId);
      if (found) {
        setSelectedPointer(found);
      }
    }
    setIsExpandMapOpen(true);
  };

  const combinedQueueItems: ReportItem[] = useMemo(
    () =>
      dispatches.map((d) => ({
        ...d,
        imageUrl:
          d.imageUrl && !String(d.imageUrl).toLowerCase().includes('unsplash.com')
            ? d.imageUrl
            : null
      })),
    [dispatches]
  );

  const sortedAndFilteredQueue = useMemo(() => {
    const filtered = combinedQueueItems.filter((item) => {
      if (
        severityFilter !== 'ALL' &&
        String(item.severity ?? '').toUpperCase() !== String(severityFilter ?? '').toUpperCase()
      ) {
        return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const refMatch = String(item.referenceCode ?? '').toLowerCase().includes(q);
        const titleMatch = String(item.title ?? '').toLowerCase().includes(q);
        const catMatch = String(item.category ?? '').toLowerCase().includes(q);
        const locMatch = String(item.locationLabel ?? '').toLowerCase().includes(q);
        const noteMatch = String(item.note ?? '').toLowerCase().includes(q);
        if (!refMatch && !titleMatch && !catMatch && !locMatch && !noteMatch) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const weightA = SEVERITY_PRIORITY_WEIGHT[a.severity] || 1;
      const weightB = SEVERITY_PRIORITY_WEIGHT[b.severity] || 1;
      if (weightB !== weightA) return weightB - weightA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [combinedQueueItems, severityFilter, debouncedSearch]);

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
  } = usePagination(sortedAndFilteredQueue, {
    initialPage: 1,
    initialPageSize: 6,
    pageSizeOptions: [6, 10, 25, 50]
  });

  const agencyMeta = useMemo(() => {
    switch (activeUnit) {
      case 'FIRE':
        return {
          title: 'BFP FIRE SUPPRESSION & RESCUE',
          defaultSector: 'BFP Fire Station',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-700/30',
          scopeLabel: 'Fire Scope',
          icon: Flame
        };
      case 'PNP':
        return {
          title: 'PNP POLICE TACTICAL PATROL',
          defaultSector: 'PNP Municipal Police Station',
          badgeBg: 'bg-sky-100 text-sky-900 border-sky-700/30',
          scopeLabel: 'Police Scope',
          icon: Shield
        };
      case 'RHU':
      default:
        return {
          title: 'RHU EMERGENCY MEDICAL SERVICES',
          defaultSector: 'Rural Health Unit',
          badgeBg: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/40',
          scopeLabel: 'Medic Scope',
          icon: Ambulance
        };
    }
  }, [activeUnit]);

  const responderFullName = session?.fullName?.trim() || `${activeUnit} Responder`;
  const responderRank = session?.rankOrTitle?.trim() || 'Field Responder';
  const responderSector = session?.departmentOrBarangay?.trim() || agencyMeta.defaultSector;

  const totalDispatchesCount = combinedQueueItems.length;

  const activeDispatchesCount = useMemo(
    () =>
      combinedQueueItems.filter(
        (d) => d.status !== 'Resolved' && d.status !== 'Rejected' && d.status !== 'Closed'
      ).length,
    [combinedQueueItems]
  );

  const resolvedCount = useMemo(
    () =>
      combinedQueueItems.filter((d) => d.status === 'Resolved' || d.status === 'Closed').length,
    [combinedQueueItems]
  );

  const resolutionRatePercent = useMemo(() => {
    if (totalDispatchesCount === 0) return 0;
    return Math.round((resolvedCount / totalDispatchesCount) * 100);
  }, [resolvedCount, totalDispatchesCount]);

  const lifeThreatCount = useMemo(
    () =>
      combinedQueueItems.filter((d) => d.severity === 'Critical' || d.severity === 'High').length,
    [combinedQueueItems]
  );

  const onlineUnitsCount = useMemo(
    () => roster.filter((u) => u.status === 'OnDuty' || u.status === 'Dispatched').length,
    [roster]
  );

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [
      {
        id: 'self-gps',
        lat: coords.latitude,
        lng: coords.longitude,
        title: `${responderFullName} · ${fieldStatus}`,
        type: 'gps',
        agency: activeUnit,
        severity: 'active'
      }
    ];

    roster
      .filter(
        (u) =>
          (u.agency || '').toUpperCase() === activeUnit &&
          typeof u.baseLatitude === 'number' &&
          typeof u.baseLongitude === 'number' &&
          (u.status === 'OnDuty' || u.status === 'Dispatched')
      )
      .forEach((u) => {
        list.push({
          id: `unit-${u.id}`,
          lat: u.baseLatitude,
          lng: u.baseLongitude,
          title: `${u.unitCode} · ${u.unitName}`,
          type: 'gps',
          agency: activeUnit,
          status: u.status
        });
      });

    visibleRadarPointers.forEach((ptr) => {
      const inScope = isPointerInUnitScope(ptr);
      list.push({
        id: ptr.id,
        lat: ptr.latitude,
        lng: ptr.longitude,
        title: `${inScope ? activeUnit : 'View-Only'} · ${ptr.title}`,
        type: 'incident',
        category:
          ptr.ipAddress && ptr.ipAddress !== 'Unavailable'
            ? `${ptr.category} • IP: ${ptr.ipAddress}`
            : ptr.category,
        agency: ptr.agency,
        status: ptr.status,
        evidenceUrl: ptr.imageUrl || undefined,
        severity: inScope
          ? ptr.severity === 'Critical'
            ? 'critical'
            : 'active'
          : palePointerEnabled
          ? 'resolved'
          : 'active'
      });
    });

    fixtures.forEach((f) => {
      list.push({
        id: f.id,
        lat: f.latitude,
        lng: f.longitude,
        title: `Fixture · ${f.title}`,
        type: 'fixture',
        category: f.category,
        agency: f.assignedUnitType,
        severity: 'resolved'
      });
    });

    return list;
  }, [
    coords.latitude,
    coords.longitude,
    responderFullName,
    fieldStatus,
    activeUnit,
    roster,
    visibleRadarPointers,
    isPointerInUnitScope,
    fixtures,
    palePointerEnabled
  ]);

  const statusStyles: Record<
    FieldStatusType,
    { badgeClass: string; dot: string; badgeText: string }
  > = {
    AVAILABLE: {
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-700/30',
      dot: 'bg-emerald-600',
      badgeText: 'Available'
    },
    'EN ROUTE': {
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-700/30',
      dot: 'bg-amber-600 animate-ping',
      badgeText: 'En Route'
    },
    'ON SCENE': {
      badgeClass: 'bg-[#670626] text-[#F7F1EA] border-[#4A041A]',
      dot: 'bg-[#F7F1EA] animate-pulse',
      badgeText: 'On Scene'
    },
    RETURNING: {
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-700/30',
      dot: 'bg-sky-600',
      badgeText: 'Returning'
    }
  };

  const currentStatusConfig = statusStyles[fieldStatus];
  const effectiveMapCenterLat = mapCenterOverride?.lat ?? coords.latitude;
  const effectiveMapCenterLng = mapCenterOverride?.lng ?? coords.longitude;

  return (
    <div className="flex flex-col gap-6 text-[#F7F1EA] select-none pb-8 w-full">
      {statusToast && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] font-mono text-sm font-bold shadow-[0_14px_34px_rgba(74,4,26,0.35)] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* HEADER IDENTITY & FIELD READINESS CONSOLE */}
      <div className="clay-surface rounded-2xl p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#670626] border border-[#4A041A] flex items-center justify-center shadow-md flex-shrink-0 text-[#F7F1EA]">
              <agencyMeta.icon className="w-8 h-8" />
            </div>

            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-black border uppercase tracking-wider ${agencyMeta.badgeBg}`}
                >
                  <agencyMeta.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{agencyMeta.title}</span>
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-[#670626] tracking-tight font-sans">
                {responderFullName}
              </h1>

              <p className="text-sm font-mono text-[#5B2A35] mt-0.5">{responderSector}</p>

              <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
                <span
                  className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-mono font-bold ${currentStatusConfig.badgeClass}`}
                >
                  <span className={`w-2 h-2 rounded-full ${currentStatusConfig.dot}`} />
                  <span>{currentStatusConfig.badgeText}</span>
                </span>

                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#E9D9D0] border border-[#670626]/15 text-xs font-mono font-bold text-[#670626]">
                  {responderRank}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
            <div className="clay-well px-4 py-2.5 bg-[#E9D9D0] rounded-xl border border-[#670626]/15 flex items-center gap-2 font-mono text-xs sm:text-sm">
              <Crosshair className="w-4 h-4 text-[#670626] flex-shrink-0" />
              <span className="text-[#670626] font-bold">
                GPS: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
              </span>
              {typeof coords.accuracy === 'number' && (
                <span className="text-emerald-800 font-bold">
                  (±{coords.accuracy.toFixed(1)}m)
                </span>
              )}
            </div>

            <ResponderButton
              variant="secondary"
              size="sm"
              onClick={refreshGps}
              disabled={isLocating}
              icon={<Radio className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />}
            >
              {isLocating ? 'Locating...' : 'Ping GPS'}
            </ResponderButton>

            {isRhuMedic && (
              <ResponderButton
                variant="primary"
                size="sm"
                onClick={() => setIsPcrModalOpen(true)}
                icon={<HeartPulse className="w-4 h-4" />}
              >
                Log PCR
              </ResponderButton>
            )}

            {activeUnit === 'PNP' && (
              <ResponderButton
                variant="primary"
                size="sm"
                onClick={() => setIsBlotterModalOpen(true)}
                icon={<Shield className="w-4 h-4" />}
              >
                Blotter
              </ResponderButton>
            )}
          </div>
        </div>

        {/* Tactile Field Readiness Selector */}
        <div className="mt-5 pt-4 border-t border-[#670626]/15">
          <div className="text-xs font-mono font-bold uppercase text-[#A83B4D] tracking-wider mb-2.5 flex items-center justify-between">
            <span>Unit Readiness Status</span>
            {isUpdatingStatus && (
              <span className="text-[#670626] animate-pulse font-mono">Updating...</span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(
              [
                {
                  key: 'AVAILABLE',
                  label: 'Available',
                  activeClass: 'bg-emerald-700 text-[#F7F1EA] border-emerald-800 shadow-md',
                  dotColor: 'bg-emerald-600'
                },
                {
                  key: 'EN ROUTE',
                  label: 'En Route',
                  activeClass: 'bg-amber-600 text-[#F7F1EA] border-amber-700 shadow-md',
                  dotColor: 'bg-amber-600'
                },
                {
                  key: 'ON SCENE',
                  label: 'On Scene',
                  activeClass: 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-md',
                  dotColor: 'bg-[#670626]'
                },
                {
                  key: 'RETURNING',
                  label: 'Returning',
                  activeClass: 'bg-sky-700 text-[#F7F1EA] border-sky-800 shadow-md',
                  dotColor: 'bg-sky-600'
                }
              ] as Array<{
                key: FieldStatusType;
                label: string;
                activeClass: string;
                dotColor: string;
              }>
            ).map((btn) => {
              const isSelected = fieldStatus === btn.key;
              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => requestStatusChange(btn.key)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-mono font-extrabold text-sm tracking-wide transition-all duration-150 border active:scale-95 cursor-pointer ${
                    isSelected
                      ? btn.activeClass
                      : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/20 hover:bg-[#DFC9BE]'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isSelected ? 'bg-[#F7F1EA]' : btn.dotColor
                    }`}
                  />
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RESPONDER TELEMETRY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clay-surface p-5 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-[#A83B4D] tracking-wider">
              Active Dispatches
            </span>
            <Activity className="w-5 h-5 text-[#670626]" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-[#670626] tabular-nums">
              {activeDispatchesCount}
            </span>
            <span className="text-sm font-mono text-[#A83B4D] font-bold">Active</span>
          </div>
        </div>

        <div className="clay-surface p-5 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-[#A83B4D] tracking-wider">
              Resolved Missions
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-emerald-800 tabular-nums">
              {resolvedCount}
            </span>
            <span className="text-sm font-mono text-[#5B2A35] font-bold">
              of {totalDispatchesCount} ({resolutionRatePercent}%)
            </span>
          </div>
        </div>

        <div className="clay-surface p-5 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-[#A83B4D] tracking-wider">
              Priority Alerts
            </span>
            <AlertTriangle className="w-5 h-5 text-[#670626]" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-[#670626] tabular-nums">
              {lifeThreatCount}
            </span>
            <span className="text-sm font-mono text-[#A83B4D] font-bold">Priority</span>
          </div>
        </div>

        <div className="clay-surface p-5 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-[#A83B4D] tracking-wider">
              {activeUnit} Units Online
            </span>
            <Users className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-2.5">
            <span className="text-3xl font-black font-mono text-emerald-800 tabular-nums">
              {onlineUnitsCount}
            </span>
            <span className="text-sm font-mono text-[#5B2A35] font-bold">Active Duty</span>
          </div>
        </div>
      </div>

      {/* SATELLITE COMMAND RADAR HUD */}
      <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl overflow-hidden">
        <div className="p-4 bg-[#E9D9D0] border-b border-[#670626]/15 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-mono text-sm font-bold text-[#670626]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
            <span>Satellite Radar</span>
          </span>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setRadarSortMode('ALL')}
              className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
                radarSortMode === 'ALL'
                  ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-sm'
                  : 'bg-[#F7F1EA] text-[#670626] border-[#670626]/20 hover:bg-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>All ({allRadarPointers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setRadarSortMode('UNIT_SCOPE')}
              className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
                radarSortMode === 'UNIT_SCOPE'
                  ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-sm'
                  : 'bg-[#F7F1EA] text-[#670626] border-[#670626]/20 hover:bg-white'
              }`}
            >
              <agencyMeta.icon className="w-3.5 h-3.5" />
              <span>
                {agencyMeta.scopeLabel} ({allRadarPointers.filter(isPointerInUnitScope).length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPalePointerEnabled((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
                palePointerEnabled
                  ? 'bg-[#A83B4D] text-[#F7F1EA] border-[#670626]'
                  : 'bg-[#F7F1EA] text-[#670626] border-[#670626]/20 hover:bg-white'
              }`}
              title="Dim non-unit pointers"
            >
              {palePointerEnabled ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>Dim Others: {palePointerEnabled ? 'On' : 'Off'}</span>
            </button>

            <ResponderButton
              variant="primary"
              size="xs"
              onClick={() => setIsExpandMapOpen(true)}
              icon={<Maximize2 className="w-3.5 h-3.5" />}
            >
              Expand Map
            </ResponderButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Interactive Map Canvas */}
          <div className="lg:col-span-8 h-[440px] w-full relative border-b lg:border-b-0 lg:border-r border-[#670626]/15">
            <div className="h-full w-full relative">
              <SatelliteCommandMap
                markers={markers}
                centerLat={effectiveMapCenterLat}
                centerLng={effectiveMapCenterLng}
                roleFilter={activeUnit}
                selectedIncidentId={selectedPointer?.id || null}
                onCloseCallout={() => setSelectedPointer(null)}
                onSelectIncident={(inc) => {
                  const ptr = allRadarPointers.find((p) => p.id === inc.id);
                  if (ptr) setSelectedPointer(ptr);
                }}
                isExpanded={isExpandMapOpen}
                onToggleExpand={() => setIsExpandMapOpen((prev) => !prev)}
                className="h-full w-full"
              />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpandMapOpen((prev) => !prev);
                }}
                className="absolute top-3 right-3 z-[400] px-3.5 py-2 rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] border border-[#F7F1EA]/30 font-mono text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                title="Expand Map"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand</span>
              </button>

              <div className="absolute bottom-3 right-3 z-[400] pointer-events-none px-3 py-1.5 rounded-lg bg-[#F7F1EA]/95 border border-[#670626]/25 font-mono text-xs font-bold text-[#670626] shadow-md">
                {formatGpsCoord(effectiveMapCenterLat, effectiveMapCenterLng)}
              </div>
            </div>
          </div>

          {/* Interactive Tactical Radar Pointer Selector Deck */}
          <div className="lg:col-span-4 h-[440px] bg-[#E9D9D0]/70 flex flex-col">
            <div className="px-4 py-3 border-b border-[#670626]/15 flex items-center justify-between bg-[#E9D9D0]">
              <span className="font-mono text-xs font-extrabold uppercase text-[#670626] tracking-wider">
                Map Pointers ({visibleRadarPointers.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {visibleRadarPointers.length === 0 ? (
                <div className="p-6 text-center font-mono text-xs text-[#5B2A35]">
                  No active incident reports in PostgreSQL.
                </div>
              ) : (
                visibleRadarPointers.map((ptr) => {
                  const inScope = isPointerInUnitScope(ptr);
                  const isPale = !inScope && palePointerEnabled;
                  return (
                    <button
                      key={ptr.id}
                      type="button"
                      onClick={() => {
                        setMapCenterOverride({ lat: ptr.latitude, lng: ptr.longitude });
                        setSelectedPointer(ptr);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isPale
                          ? 'bg-[#F7F1EA]/55 border-[#670626]/10 opacity-60 hover:opacity-100'
                          : inScope
                          ? 'bg-[#F7F1EA] border-[#670626]/35 hover:border-[#670626] shadow-sm'
                          : 'bg-[#F7F1EA] border-[#670626]/15 hover:border-[#A83B4D]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-mono font-extrabold uppercase ${
                            inScope
                              ? 'bg-[#670626] text-[#F7F1EA]'
                              : 'bg-[#E9D9D0] text-[#670626] border border-[#670626]/20'
                          }`}
                        >
                          {ptr.category}
                        </span>
                        <span className="font-mono text-xs text-[#A83B4D] font-bold">
                          {ptr.referenceCode}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-[#2B010E] line-clamp-1 mt-0.5">
                        {ptr.title}
                      </p>

                      <div className="flex items-center justify-between text-xs font-mono text-[#5B2A35] mt-0.5">
                        <span className="truncate max-w-[175px]">{ptr.physicalAddress}</span>
                        <span
                          className={
                            inScope ? 'text-emerald-800 font-bold' : 'text-[#A83B4D] font-semibold'
                          }
                        >
                          {inScope ? `${activeUnit} SCOPE` : 'VIEW-ONLY'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PRIORITY INCIDENT DISPATCH QUEUE */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 pb-3.5 border-b border-[#670626]/15">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg md:text-xl font-black font-sans text-[#670626] tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#A83B4D]" />
                <span>{activeUnit} Dispatch Queue</span>
              </h2>
              <span className="px-3 py-0.5 rounded-full bg-[#670626] text-[#F7F1EA] font-mono text-xs font-bold">
                {activeDispatchesCount} Active
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search code, category, address..."
              className="w-full sm:w-60"
            />

            <Dropdown
              label="Priority"
              value={severityFilter}
              onChange={(val) => setSeverityFilter(val)}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'CRITICAL', label: 'Critical' },
                { value: 'HIGH', label: 'High' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'LOW', label: 'Low' }
              ]}
            />

            <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {paginatedItems.length === 0 ? (
          <div className="clay-well p-8 text-center bg-[#E9D9D0] rounded-xl border border-[#670626]/15 font-mono text-sm text-[#5B2A35]">
            No {activeUnit} dispatches match the current filter.
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map((item) => {
              const itemIp = item.submittedIpAddress || 'Unavailable';
              const statusBadge = formatQueueStatusBadge(
                item.status,
                item.allocatedUnitCode,
                item.verifiedAt,
                item.resolvedAt
              );
              const canVerifyOrReject = isSubmittedOrPendingStatus(item.status);
              const canDispatch =
                canVerifyOrReject || isVerifiedStatus(item.status);
              const isBusy = actionBusyId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedIncident(item)}
                  className="clay-well p-4 rounded-2xl bg-[#E9D9D0]/75 border border-[#670626]/15 hover:border-[#670626]/45 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-sm font-bold text-[#670626] group-hover:underline">
                        {item.referenceCode}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono ${statusBadge.pillClass}`}
                        >
                          {statusBadge.label}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase font-mono ${
                            item.severity === 'Critical'
                              ? 'bg-[#670626] text-[#F7F1EA]'
                              : item.severity === 'High'
                              ? 'bg-amber-100 text-amber-900 border border-amber-700/30'
                              : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/20'
                          }`}
                        >
                          {item.severity}
                        </span>
                      </div>
                    </div>

                    <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#F7F1EA] border border-[#670626]/15 text-xs font-mono font-semibold text-[#670626] mb-2">
                      {item.category}
                    </span>

                    <h3 className="text-base font-bold text-[#2B010E] line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#5B2A35] mt-1 line-clamp-2">
                      {item.note || 'No field notes.'}
                    </p>
                    {(item.roboflowPrediction || item.claudeSituationSummary || item.claudeVisibleHazards) && (
                      <div className="mt-2 p-2.5 rounded-xl bg-[#F7F1EA] border border-[#670626]/20 text-xs font-mono text-[#670626] flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black">
                            Roboflow: {item.roboflowPrediction || 'incident'}
                            {typeof item.roboflowConfidence === 'number'
                              ? ` (${Math.round(item.roboflowConfidence * 100)}%)`
                              : ''}
                          </span>
                          {item.pointerIconType && (
                            <span className="px-2 py-0.5 rounded bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold uppercase">
                              {item.pointerIconType}
                            </span>
                          )}
                        </div>
                        {(item.claudeVisibleHazards || item.claudeSituationSummary) && (
                          <p className="text-[#5B2A35] font-sans text-xs line-clamp-2">
                            Claude Haiku 4.5: {item.claudeVisibleHazards || item.claudeSituationSummary}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-[#670626]/15 flex flex-col gap-2.5 font-mono text-xs text-[#5B2A35]">
                    <div className="flex items-center justify-between">
                      <span className="truncate max-w-[180px] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#A83B4D] flex-shrink-0" />
                        <span>
                          {item.locationLabel || formatGpsCoord(item.latitude, item.longitude)}
                        </span>
                      </span>
                      <span className="text-xs text-[#670626] font-semibold">IP: {itemIp}</span>
                    </div>

                    <div
                      className="flex flex-wrap items-center justify-between gap-1.5 pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[#A83B4D] font-bold">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canVerifyOrReject && (
                          <>
                            <ResponderButton
                              variant="action-green"
                              size="xs"
                              isLoading={isBusy}
                              onClick={() => void handleVerifyOrReject(item, 'Verified')}
                              icon={<Check className="w-3.5 h-3.5" />}
                            >
                              Verify
                            </ResponderButton>
                            <ResponderButton
                              variant="danger"
                              size="xs"
                              isLoading={isBusy}
                              onClick={() => void handleVerifyOrReject(item, 'Rejected')}
                              icon={<X className="w-3.5 h-3.5" />}
                            >
                              Reject
                            </ResponderButton>
                          </>
                        )}
                        {canDispatch && (
                          <ResponderButton
                            variant="primary"
                            size="xs"
                            isLoading={isBusy}
                            onClick={() => void handleQuickDispatch(item)}
                            icon={<Send className="w-3.5 h-3.5" />}
                          >
                            Dispatch
                          </ResponderButton>
                        )}
                        <ResponderButton
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            handleQuickNavigate(item.latitude, item.longitude, item.id)
                          }
                          icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                        >
                          GPS
                        </ResponderButton>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#670626]/15 bg-[#FAF5EE]">
            <table className="w-full text-left text-sm font-mono">
              <thead className="bg-[#E9D9D0] text-[#670626] uppercase text-xs border-b border-[#670626]/15">
                <tr>
                  <th className="p-3.5">Ref Code</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Headline</th>
                  <th className="p-3.5">Street Address &amp; GPS</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10">
                {paginatedItems.map((item) => {
                  const statusBadge = formatQueueStatusBadge(
                    item.status,
                    item.allocatedUnitCode,
                    item.verifiedAt,
                    item.resolvedAt
                  );
                  const canVerifyOrReject = isSubmittedOrPendingStatus(item.status);
                  const canDispatch = canVerifyOrReject || isVerifiedStatus(item.status);
                  const isBusy = actionBusyId === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedIncident(item)}
                      className="hover:bg-[#E9D9D0]/55 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 text-[#670626] font-bold whitespace-nowrap">
                        {item.referenceCode}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            item.severity === 'Critical'
                              ? 'bg-[#670626] text-[#F7F1EA]'
                              : item.severity === 'High'
                              ? 'bg-amber-100 text-amber-900 border border-amber-700/30'
                              : 'bg-[#E9D9D0] text-[#670626] border border-[#670626]/20'
                          }`}
                        >
                          {item.severity}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#5B2A35] whitespace-nowrap text-xs">
                        {item.category}
                      </td>
                      <td className="p-3.5 text-[#2B010E] font-sans font-bold">{item.title}</td>
                      <td className="p-3.5 text-[#5B2A35] truncate max-w-[220px] text-xs">
                        {item.locationLabel || formatGpsCoord(item.latitude, item.longitude)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${statusBadge.pillClass}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td
                        className="p-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          {canVerifyOrReject && (
                            <>
                              <ResponderButton
                                variant="action-green"
                                size="xs"
                                isLoading={isBusy}
                                onClick={() => void handleVerifyOrReject(item, 'Verified')}
                              >
                                Verify
                              </ResponderButton>
                              <ResponderButton
                                variant="danger"
                                size="xs"
                                isLoading={isBusy}
                                onClick={() => void handleVerifyOrReject(item, 'Rejected')}
                              >
                                Reject
                              </ResponderButton>
                            </>
                          )}
                          {canDispatch && (
                            <ResponderButton
                              variant="primary"
                              size="xs"
                              isLoading={isBusy}
                              onClick={() => void handleQuickDispatch(item)}
                            >
                              Dispatch
                            </ResponderButton>
                          )}
                          <ResponderButton
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              handleQuickNavigate(item.latitude, item.longitude, item.id)
                            }
                            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                          >
                            GPS
                          </ResponderButton>
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
        <div className="mt-4 pt-3.5 border-t border-[#670626]/15 flex flex-wrap items-center justify-between gap-3 text-sm font-mono text-[#5B2A35]">
          <div className="flex items-center gap-2.5">
            <span>
              <strong className="text-[#670626]">{totalItems === 0 ? 0 : startIndex + 1}</strong>
              –<strong className="text-[#670626]">{endIndex}</strong> of{' '}
              <strong className="text-[#670626]">{totalItems}</strong>
            </span>
            <Dropdown
              variant="pagination"
              value={String(pageSize)}
              onChange={(val) => setPageSize(Number(val))}
              options={pageSizeOptions.map((sz) => ({
                value: String(sz),
                label: `${sz} / page`
              }))}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <ResponderButton
              variant="secondary"
              size="xs"
              disabled={!canPrevPage}
              onClick={prevPage}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Prev
            </ResponderButton>
            <span className="px-3 py-1.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold">
              Page {currentPage} / {totalPages}
            </span>
            <ResponderButton
              variant="secondary"
              size="xs"
              disabled={!canNextPage}
              onClick={nextPage}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
              iconPosition="right"
            >
              Next
            </ResponderButton>
          </div>
        </div>
      </div>

      {/* STATUS CHANGE CONFIRMATION MODAL */}
      {pendingStatusTarget !== null && (
        <ResponderModalCard
          isOpen={pendingStatusTarget !== null}
          onClose={() => setPendingStatusTarget(null)}
          title="Confirm Status Change"
          subtitle={`Switch from ${fieldStatus} to ${pendingStatusTarget}`}
          size="md"
        >
          <div className="flex flex-col gap-4 text-[#2B010E]">
            <div className="p-4 rounded-xl bg-amber-100 border border-amber-700/30 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-800 flex-shrink-0" />
              <p className="text-sm font-mono text-amber-900 font-semibold">
                Broadcasts immediately to command dispatch.
              </p>
            </div>

            <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex items-center justify-between font-mono text-sm">
              <span className="text-[#5B2A35]">New Status</span>
              <span className="px-3 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] font-black">
                {pendingStatusTarget}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#670626]/15">
              <ResponderButton
                variant="outline"
                size="sm"
                onClick={() => setPendingStatusTarget(null)}
                icon={<XCircle className="w-4 h-4" />}
              >
                Cancel
              </ResponderButton>
              <ResponderButton
                variant="action-green"
                size="sm"
                onClick={() => void confirmStatusChange()}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirm
              </ResponderButton>
            </div>
          </div>
        </ResponderModalCard>
      )}

      {/* INCIDENT DISPATCH QUEUE DETAILS & VERIFICATION MODAL */}
      {selectedIncident && (
        <ResponderModalCard
          isOpen={selectedIncident !== null}
          onClose={() => setSelectedIncident(null)}
          title={`Incident ${selectedIncident.referenceCode}`}
          subtitle={`${selectedIncident.category} • ${formatIsoTimestamp(selectedIncident.createdAt)}`}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4 text-[#2B010E]">
            <div className="clay-well px-4 py-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex items-center justify-between font-mono text-sm">
              <span className="text-[#670626] font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#A83B4D]" />
                <span>Verification Auto-Close Timer</span>
              </span>
              <span className="text-[#670626] font-black">
                {selectedIncidentSecondsLeft === null
                  ? 'Pending Verification'
                  : selectedIncidentSecondsLeft === 0
                  ? '00:00 (Completed)'
                  : formatCountdownTimer(selectedIncidentSecondsLeft)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#670626]/15 pb-3 gap-3">
              <div>
                <span className="text-sm font-mono text-[#A83B4D] font-bold block">
                  {selectedIncident.referenceCode}
                </span>
                <h3 className="text-xl font-black text-[#670626] mt-0.5">
                  {selectedIncident.title}
                </h3>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-black uppercase ${
                    selectedIncident.severity === 'Critical'
                      ? 'bg-[#670626] text-[#F7F1EA]'
                      : 'bg-amber-100 text-amber-900 border border-amber-700/30'
                  }`}
                >
                  {selectedIncident.severity} SEVERITY
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${
                    formatQueueStatusBadge(
                      selectedIncident.status,
                      selectedIncident.allocatedUnitCode,
                      selectedIncident.verifiedAt,
                      selectedIncident.resolvedAt
                    ).pillClass
                  }`}
                >
                  {
                    formatQueueStatusBadge(
                      selectedIncident.status,
                      selectedIncident.allocatedUnitCode,
                      selectedIncident.verifiedAt,
                      selectedIncident.resolvedAt
                    ).label
                  }
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-mono">
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-[#A83B4D] block text-xs font-bold">CATEGORY</span>
                <span className="text-[#2B010E] font-bold">{selectedIncident.category}</span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-[#A83B4D] block text-xs font-bold">CURRENT STATUS</span>
                <span className="text-[#670626] font-bold">{selectedIncident.status}</span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-[#A83B4D] block text-xs font-bold">REPORTER IP</span>
                <span className="text-[#2B010E] font-bold">
                  {selectedIncident.submittedIpAddress || 'Unavailable'}
                </span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10 sm:col-span-3">
                <span className="text-[#A83B4D] block text-xs font-bold">
                  GPS &amp; Address
                </span>
                <span className="text-emerald-800 font-bold">
                  {formatGpsCoord(selectedIncident.latitude, selectedIncident.longitude)}
                </span>
                <p className="text-[#2B010E] text-sm mt-0.5 font-sans font-semibold">
                  {selectedIncident.locationLabel || formatGpsCoord(selectedIncident.latitude, selectedIncident.longitude)}
                </p>
              </div>
            </div>

            <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10 text-sm">
              <span className="text-[#A83B4D] block font-mono text-xs font-bold mb-1">
                Field Notes
              </span>
              <p className="text-[#2B010E] leading-relaxed">
                {selectedIncident.note || 'No notes.'}
              </p>
            </div>

            {(selectedIncident.roboflowPrediction ||
              selectedIncident.claudeSituationSummary ||
              selectedIncident.claudeVisibleHazards) && (
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-xs font-mono text-[#670626] flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black uppercase text-[#670626]">
                    AI Scene Verification · Roboflow ({selectedIncident.roboflowModelId || 'Vision'}):{' '}
                    {selectedIncident.roboflowPrediction || 'incident'}
                    {typeof selectedIncident.roboflowConfidence === 'number'
                      ? ` (${Math.round(selectedIncident.roboflowConfidence * 100)}%)`
                      : ''}
                  </span>
                  {selectedIncident.pointerIconType && (
                    <span className="px-2.5 py-0.5 rounded bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] font-bold uppercase">
                      {selectedIncident.pointerIconType}
                    </span>
                  )}
                </div>
                {selectedIncident.claudeSituationSummary && (
                  <p className="font-sans text-[#2B010E]">
                    <strong className="font-mono text-[#A83B4D] uppercase">Claude 4.5 Situation: </strong>
                    {selectedIncident.claudeSituationSummary}
                  </p>
                )}
                {selectedIncident.claudeVisibleHazards && (
                  <p className="font-sans text-[#2B010E]">
                    <strong className="font-mono text-[#A83B4D] uppercase">Visible Hazards: </strong>
                    {selectedIncident.claudeVisibleHazards}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl overflow-hidden border border-[#670626]/20 bg-[#4A041A]">
              {selectedIncident.imageUrl &&
              !selectedIncident.imageUrl.toLowerCase().includes('unsplash.com') ? (
                <img
                  src={selectedIncident.imageUrl}
                  alt="Incident Evidence"
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-[#E9D9D0] flex flex-col items-center justify-center gap-1.5 text-[#5B2A35] font-mono text-xs">
                  <ImageIcon className="w-6 h-6 text-[#A83B4D]" />
                  <span>No photographic evidence attached to report</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#670626]/15">
              <ResponderButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedIncident(null)}
              >
                Close
              </ResponderButton>

              {isSubmittedOrPendingStatus(selectedIncident.status) && (
                <>
                  <ResponderButton
                    variant="action-green"
                    size="sm"
                    isLoading={actionBusyId === selectedIncident.id}
                    onClick={() => void handleVerifyOrReject(selectedIncident, 'Verified')}
                    icon={<Check className="w-4 h-4" />}
                  >
                    Verify
                  </ResponderButton>
                  <ResponderButton
                    variant="danger"
                    size="sm"
                    isLoading={actionBusyId === selectedIncident.id}
                    onClick={() => void handleVerifyOrReject(selectedIncident, 'Rejected')}
                    icon={<X className="w-4 h-4" />}
                  >
                    Reject
                  </ResponderButton>
                </>
              )}

              {(isSubmittedOrPendingStatus(selectedIncident.status) ||
                isVerifiedStatus(selectedIncident.status)) && (
                <ResponderButton
                  variant="secondary"
                  size="sm"
                  isLoading={actionBusyId === selectedIncident.id}
                  onClick={() => void handleQuickDispatch(selectedIncident)}
                  icon={<Send className="w-4 h-4" />}
                >
                  Dispatch
                </ResponderButton>
              )}

              {isRhuMedic && (
                <ResponderButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsPcrModalOpen(true)}
                  icon={<HeartPulse className="w-4 h-4" />}
                >
                  Log PCR
                </ResponderButton>
              )}
              {activeUnit === 'PNP' && (
                <ResponderButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsBlotterModalOpen(true)}
                  icon={<Shield className="w-4 h-4" />}
                >
                  File Blotter
                </ResponderButton>
              )}
              <ResponderButton
                variant="outline"
                size="sm"
                onClick={() => {
                  const inc = selectedIncident;
                  setSelectedIncident(null);
                  handleQuickNavigate(inc.latitude, inc.longitude, inc.id);
                }}
              >
                Focus Map
              </ResponderButton>
              <ResponderButton
                variant="primary"
                size="sm"
                onClick={() =>
                  handleRequestDeployRedirect(
                    selectedIncident.id,
                    selectedIncident.referenceCode
                  )
                }
                icon={<Send className="w-4 h-4" />}
              >
                Request Deploy
              </ResponderButton>
            </div>
          </div>
        </ResponderModalCard>
      )}

      {/* Specialized Agency Operation Modals */}
      {isPcrModalOpen && (
        <PatientCareRecordModal
          isOpen={isPcrModalOpen}
          onClose={() => setIsPcrModalOpen(false)}
          reportId={selectedIncident?.id}
          onSuccess={(pcr) => {
            showStatusFeedback(`Patient care record ${pcr.pcrReference} saved`);
            void loadData();
          }}
        />
      )}

      {isBlotterModalOpen && (
        <PoliceBlotterModal
          isOpen={isBlotterModalOpen}
          onClose={() => setIsBlotterModalOpen(false)}
          reportId={selectedIncident?.id}
          defaultLocation={selectedIncident?.locationLabel || 'Reported Location'}
          onSuccess={(blotter) => {
            showStatusFeedback(`Police blotter ${blotter.blotterNumber} sealed`);
            void loadData();
          }}
        />
      )}
    </div>
  );
};

export default ResponderDashboard;
