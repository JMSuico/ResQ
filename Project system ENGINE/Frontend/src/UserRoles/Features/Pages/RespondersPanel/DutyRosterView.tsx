// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Unit-scoped Responders directory, agency chain of command,
// and OnDuty & Dispatched leaderboard computed strictly from real PostgreSQL DB records.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis, ZERO hotline/tel links.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useSession,
  useValueRefreshAuto,
  useDebounce,
  usePagination
} from '@/Hooks';
import {
  SearchBar,
  TableCardToggle,
  useTableCardView,
  Dropdown
} from '@/Shared';
import { getDutyRoster, updateUnitDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import { getAgencyReports, ReportItem } from '@/Endpoints/reportsApi';
import { formatGpsCoord } from '@/Libs/Assets/formatters';
import { ResponderButton } from './Shared/ResponderButton';
import { ResponderModalCard } from './Shared/ResponderModalCard';
import {
  Ambulance,
  Flame,
  Shield,
  Users,
  MapPin,
  Navigation,
  Award,
  Radio,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Filter,
  GitBranch,
  Trophy,
  Gauge,
  TrendingUp
} from 'lucide-react';

export type AgencyScope = 'RHU' | 'FIRE' | 'PNP';

export type ColleagueDutyStatus = 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty';

export type StatusFilterOption =
  | 'ALL_COLLEAGUES'
  | 'ACTIVE_AVAILABLE'
  | 'BEING_DISPATCHED'
  | 'STANDBY'
  | 'OFF_DUTY';

export type ColleagueSortOption = 'LEADERBOARD' | 'HIERARCHY' | 'AVAILABILITY';

export type HierarchyTier = 1 | 2 | 3 | 4;

export interface ColleagueResponder {
  id: string;
  fullName: string;
  callsign: string;
  unitCode: string;
  unitName: string;
  agency: AgencyScope;
  rankTitle: string;
  roleCategory: string;
  hierarchyTier: HierarchyTier;
  specialization: string;
  licenseOrBadge: string;
  status: ColleagueDutyStatus;
  resolvedMissions: number;
  activeDispatches: number;
  missionSuccessRate: number;
  avgResponseSeconds: number;
  avgResponseTime: string;
  sectorAssignment: string;
  shiftSchedule: string;
  radioChannel: string;
  baseLatitude: number;
  baseLongitude: number;
  activePersonnelCount: number;
}

interface ActiveUnitSummary {
  id: string;
  unitCode: string;
  unitName: string;
  agency: AgencyScope;
  commanderName: string;
  status: ColleagueDutyStatus;
  baseLatitude: number;
  baseLongitude: number;
  activePersonnelCount: number;
  shiftSchedule: string;
}

const resolveActiveAgency = (rawUnit?: string | null): AgencyScope => {
  const normalized = (rawUnit || '').trim().toUpperCase();
  if (normalized === 'FIRE' || normalized === 'BFP') return 'FIRE';
  if (normalized === 'PNP' || normalized === 'POLICE') return 'PNP';
  return 'RHU';
};

const deriveHierarchyTier = (unit: DutyUnit, index: number): HierarchyTier => {
  const code = `${unit.unitCode} ${unit.unitName} ${unit.commanderName}`.toUpperCase();
  if (code.includes('HQ') || code.includes('CHIEF') || code.includes('MARSHAL')) return 1;
  if (code.includes('01') || code.includes('ALPHA') || code.includes('ENG')) return 2;
  if (code.includes('02') || code.includes('BRAVO') || code.includes('RSC') || code.includes('SOCO')) return 3;
  if (index === 0) return 1;
  return 4;
};

const formatDurationSeconds = (seconds: number): string => {
  if (seconds <= 0) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
};

const computePerformanceScore = (responder: ColleagueResponder): number => {
  const speedBonus = responder.avgResponseSeconds > 0 ? responder.avgResponseSeconds * 0.1 : 0;
  return responder.resolvedMissions * 100 + responder.missionSuccessRate - speedBonus;
};

const mapUnitsToRosterEntries = (
  units: DutyUnit[],
  reports: ReportItem[],
  agencyMetaBadgeLabel: string
): ColleagueResponder[] =>
  units.map((unit, idx) => {
    const unitReports = reports.filter(
      (r) =>
        r.allocatedUnitId === unit.id ||
        (r.allocatedUnitCode &&
          r.allocatedUnitCode.trim().toUpperCase() === unit.unitCode.trim().toUpperCase())
    );

    const resolvedReports = unitReports.filter(
      (r) => r.status === 'Resolved' || r.status === 'Closed' || Boolean(r.resolvedAt)
    );
    const activeReports = unitReports.filter(
      (r) =>
        r.status !== 'Resolved' &&
        r.status !== 'Closed' &&
        r.status !== 'Rejected'
    );
    const totalTrackable = resolvedReports.length + activeReports.length;
    const missionSuccessRate =
      totalTrackable > 0 ? Number(((resolvedReports.length / totalTrackable) * 100).toFixed(1)) : 0;

    const responseDurationsSec: number[] = [];
    unitReports.forEach((r) => {
      const endIso = r.resolvedAt || r.verifiedAt;
      if (!endIso || !r.createdAt) return;
      const startMs = new Date(r.createdAt).getTime();
      const endMs = new Date(endIso).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
        responseDurationsSec.push(Math.round((endMs - startMs) / 1000));
      }
    });

    const avgResponseSeconds =
      responseDurationsSec.length > 0
        ? Math.round(
            responseDurationsSec.reduce((sum, val) => sum + val, 0) / responseDurationsSec.length
          )
        : 0;

    return {
      id: unit.id,
      fullName: unit.commanderName || unit.unitName,
      callsign: unit.unitCode,
      unitCode: unit.unitCode,
      unitName: unit.unitName,
      agency: resolveActiveAgency(unit.agency),
      rankTitle: `${unit.activePersonnelCount} Active Personnel`,
      roleCategory: agencyMetaBadgeLabel,
      hierarchyTier: deriveHierarchyTier(unit, idx),
      specialization: `Shift: ${unit.shiftSchedule || 'Unassigned'}`,
      licenseOrBadge: unit.unitCode,
      status: unit.status,
      resolvedMissions: resolvedReports.length,
      activeDispatches: activeReports.length,
      missionSuccessRate,
      avgResponseSeconds,
      avgResponseTime: formatDurationSeconds(avgResponseSeconds),
      sectorAssignment: unit.unitName,
      shiftSchedule: unit.shiftSchedule || 'Unscheduled',
      radioChannel: unit.contactHotline || 'Agency Command Channel',
      baseLatitude: unit.baseLatitude,
      baseLongitude: unit.baseLongitude,
      activePersonnelCount: unit.activePersonnelCount
    };
  });

const AGENCY_THEME: Record<
  AgencyScope,
  {
    title: string;
    subtitle: string;
    badgeLabel: string;
    personnelNoun: string;
    tiers: Array<{ tier: HierarchyTier; code: string; title: string; subtitle: string }>;
  }
> = {
  RHU: {
    title: 'RHU Medical Responders',
    subtitle: 'Unit roster & response leaderboard',
    badgeLabel: 'RHU Ambulance Crew',
    personnelNoun: 'Units',
    tiers: [
      { tier: 1, code: 'Tier 1', title: 'Head Chief', subtitle: 'Municipal Health Officer' },
      { tier: 2, code: 'Tier 2', title: 'Medical Officer III', subtitle: 'Field Trauma Command' },
      { tier: 3, code: 'Tier 3', title: 'Senior Paramedic / Triage Lead', subtitle: 'Triage & ALS Lead' },
      { tier: 4, code: 'Tier 4', title: 'Ambulance Crew', subtitle: 'EMTs, Nurses & Drivers' }
    ]
  },
  FIRE: {
    title: 'BFP Fire Responders',
    subtitle: 'Unit roster & response leaderboard',
    badgeLabel: 'BFP Fire Suppression',
    personnelNoun: 'Units',
    tiers: [
      { tier: 1, code: 'Tier 1', title: 'Fire Marshal', subtitle: 'Municipal Fire Command' },
      { tier: 2, code: 'Tier 2', title: 'Engine & Rescue Boss', subtitle: 'Suppression & Extrication' },
      { tier: 3, code: 'Tier 3', title: 'Fire Attack & HazMat Lead', subtitle: 'Interior & Containment' },
      { tier: 4, code: 'Tier 4', title: 'Apparatus & Hose Crew', subtitle: 'Pump Operators & Crew' }
    ]
  },
  PNP: {
    title: 'PNP Police Responders',
    subtitle: 'Unit roster & response leaderboard',
    badgeLabel: 'PNP Tactical Patrol',
    personnelNoun: 'Units',
    tiers: [
      { tier: 1, code: 'Tier 1', title: 'Chief of Police', subtitle: 'Municipal Police Command' },
      { tier: 2, code: 'Tier 2', title: 'Operations & SOCO Lead', subtitle: 'Patrol & Investigation' },
      { tier: 3, code: 'Tier 3', title: 'Tactical & Maritime Lead', subtitle: 'Perimeter & Coastal SAR' },
      { tier: 4, code: 'Tier 4', title: 'Beat Patrol Responders', subtitle: 'Mobile & Barangay Patrol' }
    ]
  }
};

export const DutyRosterView: React.FC = () => {
  const { session } = useSession();
  const activeAgency = useMemo<AgencyScope>(() => resolveActiveAgency(session?.unit), [session?.unit]);
  const agencyMeta = AGENCY_THEME[activeAgency];

  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('ALL_COLLEAGUES');
  const [selectedTierFilter, setSelectedTierFilter] = useState<HierarchyTier | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<ColleagueSortOption>('LEADERBOARD');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const { viewMode, setViewMode } = useTableCardView('card');

  const [selectedColleague, setSelectedColleague] = useState<ColleagueResponder | null>(null);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [rosterData, agencyReports] = await Promise.all([
        getDutyRoster(activeAgency),
        getAgencyReports(activeAgency).catch(() => [] as ReportItem[])
      ]);
      setRoster(Array.isArray(rosterData) ? rosterData : []);
      setReports(Array.isArray(agencyReports) ? agencyReports : []);
    } catch (err) {
      console.error('Failed to load duty roster data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeAgency]);

  useValueRefreshAuto(loadData, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeDispatchesCount = useMemo(
    () =>
      reports.filter(
        (r) => r.status !== 'Resolved' && r.status !== 'Rejected' && r.status !== 'Closed'
      ).length,
    [reports]
  );

  // Strictly DB-backed unit roster scoped to active agency
  const agencyScopedColleagues = useMemo(
    () =>
      mapUnitsToRosterEntries(
        roster.filter((u) => resolveActiveAgency(u.agency) === activeAgency),
        reports,
        agencyMeta.badgeLabel
      ),
    [roster, activeAgency, reports, agencyMeta.badgeLabel]
  );

  const myUnit: ActiveUnitSummary | null = useMemo(() => {
    const found = roster.find((u) => resolveActiveAgency(u.agency) === activeAgency);
    if (!found) return null;
    return {
      id: found.id,
      unitCode: found.unitCode,
      unitName: found.unitName,
      agency: activeAgency,
      commanderName: found.commanderName,
      status: found.status,
      baseLatitude: found.baseLatitude,
      baseLongitude: found.baseLongitude,
      activePersonnelCount: found.activePersonnelCount,
      shiftSchedule: found.shiftSchedule
    };
  }, [roster, activeAgency]);

  const showToast = useCallback((msg: string) => {
    setStatusFeedback(msg);
    window.setTimeout(() => setStatusFeedback(null), 3200);
  }, []);

  const handleToggleDuty = useCallback(
    async (newStatus: ColleagueDutyStatus) => {
      if (!myUnit) return;
      try {
        await updateUnitDutyStatus(myUnit.id, newStatus);
        showToast(`Unit ${myUnit.unitCode} status updated to ${newStatus}`);
        await loadData();
      } catch {
        showToast('Failed to update unit status on server.');
      }
    },
    [myUnit, loadData, showToast]
  );

  const handleQuickNavigate = useCallback((lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const copyCoordinates = useCallback(
    (lat: number, lng: number) => {
      const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      navigator.clipboard?.writeText(text);
      showToast(`Coordinates copied: ${text}`);
    },
    [showToast]
  );

  const statusCounts = useMemo(
    () => ({
      ALL_COLLEAGUES: agencyScopedColleagues.length,
      ACTIVE_AVAILABLE: agencyScopedColleagues.filter((c) => c.status === 'OnDuty').length,
      BEING_DISPATCHED: agencyScopedColleagues.filter((c) => c.status === 'Dispatched').length,
      STANDBY: agencyScopedColleagues.filter((c) => c.status === 'Standby').length,
      OFF_DUTY: agencyScopedColleagues.filter((c) => c.status === 'OffDuty').length
    }),
    [agencyScopedColleagues]
  );

  const activeLeaderboard = useMemo(
    () =>
      agencyScopedColleagues
        .filter((c) => c.status === 'OnDuty' || c.status === 'Dispatched')
        .sort((a, b) => {
          const scoreDiff = computePerformanceScore(b) - computePerformanceScore(a);
          if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
          if (a.avgResponseSeconds !== b.avgResponseSeconds) {
            return a.avgResponseSeconds - b.avgResponseSeconds;
          }
          return b.missionSuccessRate - a.missionSuccessRate;
        }),
    [agencyScopedColleagues]
  );

  const leaderboardRankMap = useMemo(() => {
    const map = new Map<string, number>();
    activeLeaderboard.forEach((m, idx) => {
      map.set(m.id, idx + 1);
    });
    return map;
  }, [activeLeaderboard]);

  const processedColleagues = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const filtered = agencyScopedColleagues.filter((c) => {
      if (statusFilter === 'ACTIVE_AVAILABLE' && c.status !== 'OnDuty') return false;
      if (statusFilter === 'BEING_DISPATCHED' && c.status !== 'Dispatched') return false;
      if (statusFilter === 'STANDBY' && c.status !== 'Standby') return false;
      if (statusFilter === 'OFF_DUTY' && c.status !== 'OffDuty') return false;

      if (selectedTierFilter !== 'ALL' && c.hierarchyTier !== selectedTierFilter) return false;

      if (query) {
        const matchesName = c.fullName.toLowerCase().includes(query);
        const matchesCallsign = c.callsign.toLowerCase().includes(query);
        const matchesRank = c.rankTitle.toLowerCase().includes(query);
        const matchesRole = c.roleCategory.toLowerCase().includes(query);
        const matchesUnit =
          c.unitCode.toLowerCase().includes(query) || c.unitName.toLowerCase().includes(query);
        const matchesSector = c.sectorAssignment.toLowerCase().includes(query);
        if (
          !matchesName &&
          !matchesCallsign &&
          !matchesRank &&
          !matchesRole &&
          !matchesUnit &&
          !matchesSector
        ) {
          return false;
        }
      }

      return true;
    });

    const statusPriority: Record<ColleagueDutyStatus, number> = {
      OnDuty: 1,
      Dispatched: 2,
      Standby: 3,
      OffDuty: 4
    };

    return [...filtered].sort((a, b) => {
      if (sortBy === 'LEADERBOARD') {
        const aActive = a.status === 'OnDuty' || a.status === 'Dispatched';
        const bActive = b.status === 'OnDuty' || b.status === 'Dispatched';
        if (aActive !== bActive) return aActive ? -1 : 1;
        return computePerformanceScore(b) - computePerformanceScore(a);
      }
      if (sortBy === 'HIERARCHY') {
        if (a.hierarchyTier !== b.hierarchyTier) return a.hierarchyTier - b.hierarchyTier;
        return computePerformanceScore(b) - computePerformanceScore(a);
      }
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return computePerformanceScore(b) - computePerformanceScore(a);
    });
  }, [agencyScopedColleagues, statusFilter, selectedTierFilter, debouncedSearch, sortBy]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedColleagues,
    startIndex,
    endIndex,
    canNextPage,
    canPrevPage,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    pageSizeOptions
  } = usePagination<ColleagueResponder>(processedColleagues, {
    initialPage: 1,
    initialPageSize: 6,
    pageSizeOptions: [6, 10, 25, 50]
  });

  const organizationTiers = useMemo(
    () =>
      agencyMeta.tiers.map((tierSpec) => ({
        ...tierSpec,
        members: agencyScopedColleagues.filter((c) => c.hierarchyTier === tierSpec.tier)
      })),
    [agencyMeta.tiers, agencyScopedColleagues]
  );

  const getStatusBadgeStyle = useCallback((status: ColleagueDutyStatus) => {
    switch (status) {
      case 'OnDuty':
        return {
          label: 'On Duty',
          pill: 'bg-emerald-100 text-emerald-900 border-emerald-700/30',
          dot: 'bg-emerald-600'
        };
      case 'Dispatched':
        return {
          label: 'Dispatched',
          pill: 'bg-amber-100 text-amber-900 border-amber-700/35',
          dot: 'bg-amber-600 animate-pulse'
        };
      case 'Standby':
        return {
          label: 'Standby',
          pill: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/40',
          dot: 'bg-[#A83B4D]'
        };
      default:
        return {
          label: 'Off Duty',
          pill: 'bg-stone-200 text-stone-700 border-stone-400/50',
          dot: 'bg-stone-500'
        };
    }
  }, []);

  const AgencyIcon = useMemo(() => {
    if (activeAgency === 'FIRE') return Flame;
    if (activeAgency === 'PNP') return Shield;
    return Ambulance;
  }, [activeAgency]);

  const getAgencySemanticBadge = useCallback((agency: AgencyScope) => {
    switch (agency) {
      case 'FIRE':
        return {
          label: 'BFP Fire Rescue',
          color: 'bg-amber-100 text-amber-900 border-amber-700/30',
          icon: Flame
        };
      case 'PNP':
        return {
          label: 'PNP Police',
          color: 'bg-sky-100 text-sky-900 border-sky-700/30',
          icon: Shield
        };
      default:
        return {
          label: 'RHU Medical',
          color: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/40',
          icon: Ambulance
        };
    }
  }, []);

  const getHierarchyHeatStyle = useCallback(
    (memberCount: number, activeCount: number, totalUnits: number) => {
      const sharePct = totalUnits > 0 ? Math.round((memberCount / totalUnits) * 100) : 0;
      const readinessPct = memberCount > 0 ? Math.round((activeCount / memberCount) * 100) : 0;

      if (memberCount === 0) {
        return {
          sharePct,
          readinessPct,
          heatLabel: 'Unassigned',
          cardTone: 'bg-[#E9D9D0]/55 border-[#670626]/15',
          badgeTone: 'bg-stone-200 text-stone-700 border-stone-400/40',
          barTone: 'bg-stone-400'
        };
      }
      if (sharePct >= 40 || activeCount >= 3) {
        return {
          sharePct,
          readinessPct,
          heatLabel: 'High Load',
          cardTone: 'bg-rose-50/90 border-rose-700/35 hover:border-[#670626]',
          badgeTone: 'bg-[#670626] text-[#F7F1EA] border-[#4A041A]',
          barTone: 'bg-[#670626]'
        };
      }
      if (readinessPct >= 60 || activeCount >= 2) {
        return {
          sharePct,
          readinessPct,
          heatLabel: 'Active Ready',
          cardTone: 'bg-emerald-50/90 border-emerald-700/35 hover:border-emerald-700',
          badgeTone: 'bg-emerald-100 text-emerald-900 border-emerald-700/35',
          barTone: 'bg-emerald-600'
        };
      }
      if (activeCount >= 1) {
        return {
          sharePct,
          readinessPct,
          heatLabel: 'Moderate',
          cardTone: 'bg-amber-50/90 border-amber-700/35 hover:border-amber-700',
          badgeTone: 'bg-amber-100 text-amber-900 border-amber-700/35',
          barTone: 'bg-amber-600'
        };
      }
      return {
        sharePct,
        readinessPct,
        heatLabel: 'Standby / Low',
        cardTone: 'bg-sky-50/85 border-sky-700/30 hover:border-sky-700',
        badgeTone: 'bg-sky-100 text-sky-900 border-sky-700/30',
        barTone: 'bg-sky-600'
      };
    },
    []
  );

  const sortOptions = useMemo(
    () => [
      { value: 'LEADERBOARD' as ColleagueSortOption, label: 'Sort: Performance' },
      { value: 'HIERARCHY' as ColleagueSortOption, label: 'Sort: Hierarchy' },
      { value: 'AVAILABILITY' as ColleagueSortOption, label: 'Sort: Availability' }
    ],
    []
  );

  const pageSizeDropdownOptions = useMemo(
    () =>
      pageSizeOptions.map((sz) => ({
        value: String(sz),
        label: `${sz} / page`
      })),
    [pageSizeOptions]
  );

  return (
    <div className="flex flex-col gap-6 text-[#F7F1EA] select-none pb-10 w-full">
      {/* Toast Feedback */}
      {statusFeedback && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] font-mono text-sm font-bold shadow-[0_14px_34px_rgba(74,4,26,0.35)] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Header & Unit Scope Bar */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#E9D9D0] border border-[#A83B4D]/35 text-xs font-mono font-bold text-[#670626]">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>{agencyMeta.badgeLabel}</span>
            </span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
              Katipunan, Zamboanga del Norte (7109)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#670626] tracking-tight flex items-center gap-2.5">
            <AgencyIcon className="w-7 h-7 text-[#670626]" />
            <span>Responders</span>
          </h1>
          <p className="text-sm text-[#6E3B46] font-medium mt-0.5">{agencyMeta.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 font-mono text-xs font-bold text-[#670626] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#A83B4D]" />
            <span>
              {activeLeaderboard.length} Active {agencyMeta.personnelNoun}
            </span>
          </div>
        </div>
      </div>

      {/* Active Unit Readiness Banner */}
      {myUnit ? (
        <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <span className="px-3 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] font-mono text-xs font-bold inline-flex items-center gap-1.5">
                  <AgencyIcon className="w-3.5 h-3.5" />
                  <span>{myUnit.unitCode}</span>
                </span>
                <span className="font-mono text-sm text-[#670626] font-bold">
                  Lead: {myUnit.commanderName}
                </span>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-[#2B010E] tracking-tight">
                {myUnit.unitName}
              </h2>

              <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs sm:text-sm font-mono text-[#5B2A35]">
                <span className="flex items-center gap-2">
                  <span className="text-[#A83B4D] font-bold">Status:</span>
                  <span
                    className={`font-bold px-2.5 py-0.5 rounded-lg border ${
                      getStatusBadgeStyle(myUnit.status).pill
                    }`}
                  >
                    {getStatusBadgeStyle(myUnit.status).label}
                  </span>
                </span>
                <span className="text-[#A83B4D]/50">|</span>
                <span>
                  Shift: <strong className="text-[#2B010E]">{myUnit.shiftSchedule}</strong>
                </span>
                <span className="text-[#A83B4D]/50">|</span>
                <span>
                  Unit Roster:{' '}
                  <strong className="text-[#670626]">
                    {agencyScopedColleagues.length} {agencyMeta.personnelNoun}
                  </strong>
                </span>
              </div>
            </div>

            <div className="clay-well px-4 py-3 bg-[#E9D9D0] border border-[#670626]/15 flex flex-col items-start lg:items-end font-mono">
              <span className="text-xs text-[#A83B4D] font-bold uppercase tracking-wider">
                Base Telemetry GPS
              </span>
              <span className="text-sm font-bold text-[#670626] tracking-wider mt-0.5">
                {formatGpsCoord(myUnit.baseLatitude, myUnit.baseLongitude)}
              </span>
              <span className="text-xs text-[#5B2A35] mt-0.5">
                {activeAgency} Scope
              </span>
            </div>
          </div>

          {/* Unit Duty Status Selector */}
          <div className="mt-5 pt-4 border-t border-[#670626]/15">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D] block mb-2.5">
              Unit Status
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  { key: 'OnDuty', label: 'On Duty', activeClass: 'bg-emerald-700 text-[#F7F1EA] border-emerald-800 shadow-md' },
                  { key: 'Dispatched', label: 'Dispatched', activeClass: 'bg-amber-600 text-[#F7F1EA] border-amber-700 shadow-md' },
                  { key: 'Standby', label: 'Standby', activeClass: 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-md' },
                  { key: 'OffDuty', label: 'Off Duty', activeClass: 'bg-stone-700 text-[#F7F1EA] border-stone-800 shadow-md' }
                ] as Array<{ key: ColleagueDutyStatus; label: string; activeClass: string }>
              ).map((btn) => {
                const isActive = myUnit.status === btn.key;
                return (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => void handleToggleDuty(btn.key)}
                    className={`py-2.5 px-3 rounded-xl font-mono font-bold text-sm transition-all duration-150 border active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                      isActive
                        ? btn.activeClass
                        : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/20 hover:bg-[#DFC9BE]'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-[#F7F1EA]' : getStatusBadgeStyle(btn.key).dot
                      }`}
                    />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="clay-surface p-6 bg-[#F7F1EA] text-[#5B2A35] border border-[#670626]/15 font-mono text-sm">
          {loading
            ? `Loading ${activeAgency} duty unit from database...`
            : `No active duty units registered for ${activeAgency}.`}
        </div>
      )}

      {/* Responders Leaderboard */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#670626]/15">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Trophy className="w-4 h-4 text-[#670626]" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
                {activeAgency} Leaderboard
              </span>
              {activeDispatchesCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-lg bg-[#670626] text-[#F7F1EA] font-mono text-xs font-bold">
                  {activeDispatchesCount} Active
                </span>
              )}
            </div>
            <h2 className="text-lg md:text-xl font-black text-[#670626] tracking-tight mt-0.5">
              Top Responders
            </h2>
          </div>

          <ResponderButton
            variant="secondary"
            size="sm"
            onClick={() => setShowFullLeaderboard((prev) => !prev)}
          >
            {showFullLeaderboard
              ? 'Show Top 5'
              : `View All Active (${activeLeaderboard.length})`}
          </ResponderButton>
        </div>

        <div className="overflow-x-auto mt-4 rounded-xl border border-[#670626]/15 bg-[#FAF5EE]">
          <table className="w-full text-left text-sm font-mono">
            <thead className="bg-[#E9D9D0] text-[#670626] text-xs uppercase border-b border-[#670626]/15">
              <tr>
                <th className="p-3.5">Rank</th>
                <th className="p-3.5">Unit / Commander</th>
                <th className="p-3.5">Agency</th>
                <th className="p-3.5">Response Speed</th>
                <th className="p-3.5">Success Rate</th>
                <th className="p-3.5">Resolved</th>
                <th className="p-3.5">Unit Name</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#670626]/10">
              {activeLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[#5B2A35]">
                    No active On-Duty or Dispatched {activeAgency} units found.
                  </td>
                </tr>
              ) : (
                (showFullLeaderboard ? activeLeaderboard : activeLeaderboard.slice(0, 5)).map(
                  (member, idx) => {
                    const rank = idx + 1;
                    const statusBadge = getStatusBadgeStyle(member.status);
                    return (
                      <tr
                        key={member.id}
                        onClick={() => setSelectedColleague(member)}
                        className="hover:bg-[#E9D9D0]/55 transition-colors cursor-pointer group"
                      >
                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs border ${
                              rank === 1
                                ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-sm'
                                : rank === 2
                                ? 'bg-[#A83B4D] text-[#F7F1EA] border-[#670626]'
                                : rank === 3
                                ? 'bg-[#E9D9D0] text-[#670626] border-[#670626]/40'
                                : 'bg-[#FAF5EE] text-[#5B2A35] border-[#670626]/20'
                            }`}
                          >
                            #{rank}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-sans font-bold text-[#2B010E] group-hover:text-[#670626] flex items-center gap-1.5 text-sm">
                            <span>{member.fullName}</span>
                            {rank <= 3 && <Award className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />}
                          </div>
                          <div className="text-xs text-[#A83B4D] font-bold">
                            {member.callsign} · {member.unitCode}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg bg-[#E9D9D0] text-[#670626] border border-[#670626]/15 text-xs font-bold">
                            {member.roleCategory}
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#670626] tabular-nums">
                            <Gauge className="w-4 h-4 text-[#A83B4D]" />
                            <span>{member.avgResponseTime}</span>
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-800 tabular-nums">
                            <TrendingUp className="w-4 h-4 text-emerald-700" />
                            <span>{member.missionSuccessRate.toFixed(1)}%</span>
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="text-base font-black text-[#2B010E] tabular-nums">
                            {member.resolvedMissions}
                          </span>
                        </td>
                        <td
                          className="p-3.5 text-[#5B2A35] max-w-[220px] truncate text-xs"
                          title={member.sectorAssignment}
                        >
                          {member.sectorAssignment}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadge.pill}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unit Chain of Command Hierarchy */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#670626]/15">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#A83B4D]" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
                {activeAgency} Chain of Command
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-black text-[#670626] tracking-tight mt-0.5">
              Command Hierarchy
            </h2>
          </div>

          {selectedTierFilter !== 'ALL' && (
            <ResponderButton
              variant="secondary"
              size="sm"
              onClick={() => setSelectedTierFilter('ALL')}
            >
              Show All Tiers
            </ResponderButton>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
          {organizationTiers.map((tierObj, index) => {
            const isTierSelected = selectedTierFilter === tierObj.tier;
            const activeInTier = tierObj.members.filter(
              (m) => m.status === 'OnDuty' || m.status === 'Dispatched'
            ).length;
            const heat = getHierarchyHeatStyle(
              tierObj.members.length,
              activeInTier,
              agencyScopedColleagues.length
            );
            return (
              <div
                key={tierObj.tier}
                className={`clay-well rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                  isTierSelected
                    ? `${heat.cardTone} ring-2 ring-[#670626] border-[#670626]`
                    : heat.cardTone
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-[#670626] text-[#F7F1EA]">
                        {tierObj.code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${heat.badgeTone}`}
                      >
                        {heat.heatLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTierFilter((prev) =>
                            prev === tierObj.tier ? 'ALL' : tierObj.tier
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#F7F1EA] hover:bg-white text-xs font-mono font-bold text-[#670626] border border-[#670626]/20 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isTierSelected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Filtered</span>
                          </>
                        ) : (
                          <span>Filter ({tierObj.members.length})</span>
                        )}
                      </button>
                      {index < organizationTiers.length - 1 && (
                        <ChevronRight className="hidden lg:inline-block w-4 h-4 text-[#A83B4D]" />
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-black font-mono text-[#670626] leading-snug">
                    {tierObj.title}
                  </h3>
                  <p className="text-xs text-[#5B2A35] mt-0.5">{tierObj.subtitle}</p>

                  {/* Tier Load & Readiness Intensity Bar */}
                  <div className="mt-2.5 p-2 rounded-xl bg-[#F7F1EA]/90 border border-[#670626]/12">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-[#5B2A35] font-semibold">
                        Share: <strong className="text-[#670626]">{heat.sharePct}%</strong>
                      </span>
                      <span className="text-[#5B2A35] font-semibold">
                        Ready: <strong className="text-emerald-800">{heat.readinessPct}%</strong>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E9D9D0] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${heat.barTone}`}
                        style={{ width: `${Math.max(heat.sharePct, tierObj.members.length > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#670626]/15 flex flex-col gap-2">
                    {tierObj.members.length === 0 ? (
                      <span className="text-xs font-mono text-[#7A4E59] py-2">
                        No units assigned
                      </span>
                    ) : (
                      tierObj.members.map((member) => {
                        const statusStyle = getStatusBadgeStyle(member.status);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => setSelectedColleague(member)}
                            className="w-full text-left p-2.5 rounded-xl bg-[#F7F1EA] hover:bg-white border border-[#670626]/15 hover:border-[#670626]/45 transition-all flex items-center justify-between gap-2 group cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#2B010E] group-hover:text-[#670626] truncate">
                                {member.fullName}
                              </div>
                              <div className="text-xs font-mono text-[#A83B4D] truncate">
                                {member.callsign} · {member.avgResponseTime}
                              </div>
                            </div>
                            <span
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusStyle.dot}`}
                              title={statusStyle.label}
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#670626]/15 flex items-center justify-between text-xs font-mono text-[#5B2A35]">
                  <span>Active Duty</span>
                  <span className="text-emerald-800 font-bold">
                    {activeInTier} / {tierObj.members.length}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Filter Heatmap Matrix + Search, Sort, Toggle & Directory */}
      <div className="flex flex-col gap-4">
        <div className="clay-surface p-4 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D] flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#670626]" />
              <span>Duty Status Heatmap Matrix</span>
            </span>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                On Duty
              </span>
              <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                Dispatched
              </span>
              <span className="inline-flex items-center gap-1 text-sky-800 font-bold">
                <span className="w-2 h-2 rounded-full bg-sky-600" />
                Standby
              </span>
              <span className="text-[#670626] font-bold">
                {processedColleagues.length} of {agencyScopedColleagues.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {(
              [
                {
                  key: 'ALL_COLLEAGUES',
                  label: 'All',
                  count: statusCounts.ALL_COLLEAGUES,
                  dotClass: 'bg-[#670626]',
                  barClass: 'bg-[#670626]',
                  idleHigh: 'bg-[#E9D9D0] text-[#670626] border-[#670626]/30 hover:bg-[#DFC9BE]',
                  idleLow: 'bg-[#E9D9D0]/60 text-[#670626] border-[#670626]/15 hover:bg-[#E9D9D0]',
                  activeTone: 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-md',
                  badgeIdle: 'bg-[#F7F1EA] text-[#670626]'
                },
                {
                  key: 'ACTIVE_AVAILABLE',
                  label: 'On Duty',
                  count: statusCounts.ACTIVE_AVAILABLE,
                  dotClass: 'bg-emerald-600',
                  barClass: 'bg-emerald-600',
                  idleHigh: 'bg-emerald-100 text-emerald-950 border-emerald-700/35 hover:bg-emerald-200/75',
                  idleLow: 'bg-emerald-50 text-emerald-900 border-emerald-700/20 hover:bg-emerald-100',
                  activeTone: 'bg-emerald-700 text-[#F7F1EA] border-emerald-900 shadow-md',
                  badgeIdle: 'bg-white/90 text-emerald-900'
                },
                {
                  key: 'BEING_DISPATCHED',
                  label: 'Dispatched',
                  count: statusCounts.BEING_DISPATCHED,
                  dotClass: 'bg-amber-600',
                  barClass: 'bg-amber-600',
                  idleHigh: 'bg-amber-100 text-amber-950 border-amber-700/35 hover:bg-amber-200/75',
                  idleLow: 'bg-amber-50 text-amber-900 border-amber-700/20 hover:bg-amber-100',
                  activeTone: 'bg-amber-600 text-[#F7F1EA] border-amber-800 shadow-md',
                  badgeIdle: 'bg-white/90 text-amber-900'
                },
                {
                  key: 'STANDBY',
                  label: 'Standby',
                  count: statusCounts.STANDBY,
                  dotClass: 'bg-sky-600',
                  barClass: 'bg-sky-600',
                  idleHigh: 'bg-sky-100 text-sky-950 border-sky-700/35 hover:bg-sky-200/75',
                  idleLow: 'bg-sky-50 text-sky-900 border-sky-700/20 hover:bg-sky-100',
                  activeTone: 'bg-sky-700 text-[#F7F1EA] border-sky-900 shadow-md',
                  badgeIdle: 'bg-white/90 text-sky-900'
                },
                {
                  key: 'OFF_DUTY',
                  label: 'Off Duty',
                  count: statusCounts.OFF_DUTY,
                  dotClass: 'bg-stone-500',
                  barClass: 'bg-stone-500',
                  idleHigh: 'bg-stone-200 text-stone-900 border-stone-500/40 hover:bg-stone-300/75',
                  idleLow: 'bg-stone-100 text-stone-700 border-stone-400/25 hover:bg-stone-200/75',
                  activeTone: 'bg-stone-700 text-[#F7F1EA] border-stone-900 shadow-md',
                  badgeIdle: 'bg-white/90 text-stone-800'
                }
              ] as Array<{
                key: StatusFilterOption;
                label: string;
                count: number;
                dotClass: string;
                barClass: string;
                idleHigh: string;
                idleLow: string;
                activeTone: string;
                badgeIdle: string;
              }>
            ).map((btn) => {
              const isSelected = statusFilter === btn.key;
              const totalUnits = Math.max(1, statusCounts.ALL_COLLEAGUES);
              const intensityPct =
                statusCounts.ALL_COLLEAGUES > 0
                  ? Math.round((btn.count / totalUnits) * 100)
                  : 0;
              const idleClass = intensityPct >= 30 ? btn.idleHigh : btn.idleLow;

              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => setStatusFilter(btn.key)}
                  className={`p-3 rounded-xl font-mono text-sm font-bold border transition-all flex flex-col gap-2 cursor-pointer ${
                    isSelected ? btn.activeTone : idleClass
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-[#F7F1EA]' : btn.dotClass
                        }`}
                      />
                      <span>{btn.label}</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-black tabular-nums ${
                        isSelected ? 'bg-[#F7F1EA]/20 text-[#F7F1EA]' : btn.badgeIdle
                      }`}
                    >
                      {btn.count}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full">
                    <div
                      className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                        isSelected ? 'bg-[#F7F1EA]/25' : 'bg-black/10'
                      }`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSelected ? 'bg-[#F7F1EA]' : btn.barClass
                        }`}
                        style={{ width: `${intensityPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums opacity-90">
                      {intensityPct}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Control Bar */}
        <div className="clay-surface p-4 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#670626]" />
            <h2 className="text-lg font-black text-[#670626] tracking-tight">
              {activeAgency} Roster
            </h2>
            <span className="px-3 py-0.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-mono text-sm font-bold">
              {processedColleagues.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search commander, unit, shift..."
              className="w-full sm:w-64"
            />

            <Dropdown<ColleagueSortOption>
              options={sortOptions}
              value={sortBy}
              onChange={setSortBy}
              menuWidth="w-60"
              align="right"
            />

            <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Directory Grid / Table */}
        {loading ? (
          <div className="clay-surface p-12 text-center text-[#670626] font-mono text-base animate-pulse bg-[#F7F1EA]">
            Loading {activeAgency} responder roster...
          </div>
        ) : paginatedColleagues.length === 0 ? (
          <div className="clay-surface p-12 text-center text-[#5B2A35] font-mono text-sm flex flex-col items-center gap-3 bg-[#F7F1EA]">
            <span>No matching {activeAgency} units found.</span>
            <ResponderButton
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('ALL_COLLEAGUES');
                setSelectedTierFilter('ALL');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </ResponderButton>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedColleagues.map((colleague) => {
              const badge = getAgencySemanticBadge(colleague.agency);
              const statusStyle = getStatusBadgeStyle(colleague.status);
              const leaderboardRank = leaderboardRankMap.get(colleague.id);

              return (
                <div
                  key={colleague.id}
                  onClick={() => setSelectedColleague(colleague)}
                  className="clay-surface p-5 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 hover:border-[#670626]/45 flex flex-col justify-between hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border inline-flex items-center gap-1.5 ${badge.color}`}
                        >
                          <badge.icon className="w-3.5 h-3.5" />
                          <span>{colleague.roleCategory}</span>
                        </span>
                        <span className="font-mono text-sm font-bold text-[#670626]">
                          {colleague.callsign}
                        </span>
                        {leaderboardRank !== undefined && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] font-mono text-xs font-black inline-flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5" />
                            <span>#{leaderboardRank}</span>
                          </span>
                        )}
                      </div>

                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1.5 ${statusStyle.pill}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                        <span>{statusStyle.label}</span>
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-[#2B010E] group-hover:text-[#670626] transition-colors">
                      {colleague.fullName}
                    </h3>
                    <p className="text-sm font-mono text-[#A83B4D] font-bold mt-0.5">
                      {colleague.rankTitle}
                    </p>
                    <p className="text-xs text-[#5B2A35] mt-1">
                      <strong className="text-[#2B010E]">{colleague.unitName}</strong> ·{' '}
                      {colleague.unitCode}
                    </p>

                    <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3.5 border-t border-[#670626]/15 text-xs font-mono">
                      <div className="clay-well p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                        <span className="text-[#A83B4D] block text-xs">Avg Speed</span>
                        <span className="text-[#670626] font-black text-base tabular-nums">
                          {colleague.avgResponseTime}
                        </span>
                      </div>
                      <div className="clay-well p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                        <span className="text-[#A83B4D] block text-xs">Success Rate</span>
                        <span className="text-emerald-800 font-black text-base tabular-nums">
                          {colleague.missionSuccessRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="clay-well p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                        <span className="text-[#A83B4D] block text-xs">Resolved</span>
                        <span className="text-[#2B010E] font-black text-base tabular-nums">
                          {colleague.resolvedMissions}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-col gap-1.5 text-xs font-mono text-[#5B2A35]">
                      <div className="truncate">
                        <span className="text-[#A83B4D] font-bold">Shift: </span>
                        <span className="text-[#2B010E] font-semibold">
                          {colleague.shiftSchedule}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[#670626] font-bold">
                          <Radio className="w-3.5 h-3.5 text-[#A83B4D]" />
                          <span>{colleague.radioChannel}</span>
                        </span>
                        <span className="text-xs font-bold text-[#A83B4D]">
                          Active Dispatches: {colleague.activeDispatches}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#670626]/15 flex items-center justify-between font-mono text-xs">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        copyCoordinates(colleague.baseLatitude, colleague.baseLongitude);
                      }}
                      className="text-[#5B2A35] hover:text-[#670626] cursor-pointer truncate max-w-[190px] inline-flex items-center gap-1"
                      title="Copy GPS coordinates"
                    >
                      <MapPin className="w-4 h-4 text-[#A83B4D]" />
                      <span>
                        {formatGpsCoord(colleague.baseLatitude, colleague.baseLongitude)}
                      </span>
                    </span>

                    <div className="flex items-center gap-2">
                      <ResponderButton
                        variant="secondary"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickNavigate(colleague.baseLatitude, colleague.baseLongitude);
                        }}
                        icon={<Navigation className="w-3.5 h-3.5" />}
                      >
                        GPS
                      </ResponderButton>
                      <ResponderButton
                        variant="primary"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColleague(colleague);
                        }}
                      >
                        Inspect
                      </ResponderButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="clay-surface overflow-x-auto rounded-2xl border border-[#670626]/15 bg-[#F7F1EA]">
            <table className="w-full text-left text-sm font-mono">
              <thead className="bg-[#E9D9D0] text-[#670626] text-xs uppercase border-b border-[#670626]/15">
                <tr>
                  <th className="p-4">Unit Code</th>
                  <th className="p-4">Commander</th>
                  <th className="p-4">Personnel</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Speed &amp; Success</th>
                  <th className="p-4">Shift</th>
                  <th className="p-4">Channel</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10 bg-[#FAF5EE]">
                {paginatedColleagues.map((colleague) => {
                  const statusStyle = getStatusBadgeStyle(colleague.status);
                  const leaderboardRank = leaderboardRankMap.get(colleague.id);
                  return (
                    <tr
                      key={colleague.id}
                      onClick={() => setSelectedColleague(colleague)}
                      className="hover:bg-[#E9D9D0]/55 transition-colors cursor-pointer"
                    >
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-[#670626] font-bold">{colleague.callsign}</div>
                        <div className="text-xs text-[#A83B4D]">{colleague.unitName}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[#2B010E] font-sans font-bold">
                          {colleague.fullName}
                        </div>
                        {leaderboardRank !== undefined && (
                          <span className="text-xs text-[#670626] font-bold">
                            Active Rank #{leaderboardRank}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-[#670626] font-bold text-xs">
                          {colleague.activePersonnelCount} personnel
                        </div>
                        <div className="text-xs text-[#5B2A35]">{colleague.roleCategory}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusStyle.pill}`}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-xs">
                        <span className="text-[#670626] font-bold">{colleague.avgResponseTime}</span>
                        <span className="text-[#A83B4D]"> · </span>
                        <span className="text-emerald-800 font-bold">
                          {colleague.missionSuccessRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4 text-[#5B2A35] max-w-[200px] truncate text-xs">
                        {colleague.shiftSchedule}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-[#670626] font-semibold text-xs">
                          {colleague.radioChannel}
                        </div>
                        <div className="text-xs text-[#A83B4D]">
                          {colleague.resolvedMissions} Resolved
                        </div>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <ResponderButton
                          variant="primary"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedColleague(colleague);
                          }}
                        >
                          Inspect
                        </ResponderButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls Bar */}
        <div className="clay-surface p-4 rounded-2xl bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-sm">
          <div className="flex items-center gap-3 text-[#5B2A35]">
            <span>
              <strong className="text-[#670626]">
                {totalItems === 0 ? 0 : startIndex + 1}
              </strong>
              –<strong className="text-[#670626]">{endIndex}</strong> of{' '}
              <strong className="text-[#670626]">{totalItems}</strong>
            </span>
            <Dropdown<string>
              variant="pagination"
              options={pageSizeDropdownOptions}
              value={String(pageSize)}
              onChange={(val) => setPageSize(Number(val))}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <ResponderButton
              variant="secondary"
              size="xs"
              disabled={!canPrevPage}
              onClick={prevPage}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Prev
            </ResponderButton>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => goToPage(pageNum)}
                className={`w-9 h-9 rounded-xl font-bold text-sm border transition-colors cursor-pointer ${
                  pageNum === currentPage
                    ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] font-black'
                    : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/15 hover:bg-[#DFC9BE]'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <ResponderButton
              variant="secondary"
              size="xs"
              disabled={!canNextPage}
              onClick={nextPage}
              icon={<ChevronRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Next
            </ResponderButton>
          </div>
        </div>
      </div>

      {/* Responder Unit Inspection Modal */}
      {selectedColleague && (
        <ResponderModalCard
          isOpen={Boolean(selectedColleague)}
          onClose={() => setSelectedColleague(null)}
          title={selectedColleague.fullName}
          subtitle={`${selectedColleague.callsign} · ${selectedColleague.unitName}`}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4 text-[#2B010E] text-sm font-mono">
            <div className="clay-well p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#670626] text-[#F7F1EA] text-xs font-bold">
                    Tier {selectedColleague.hierarchyTier} · {selectedColleague.roleCategory}
                  </span>
                  <span className="text-[#5B2A35] text-xs">
                    Unit Code: <strong className="text-[#2B010E]">{selectedColleague.unitCode}</strong>
                  </span>
                </div>
                <h3 className="text-xl font-black text-[#670626] font-sans">
                  {selectedColleague.fullName}
                </h3>
                <p className="text-[#A83B4D] text-sm font-bold mt-0.5">
                  {selectedColleague.specialization}
                </p>
              </div>

              <div className="flex flex-col sm:items-end gap-1.5">
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                    getStatusBadgeStyle(selectedColleague.status).pill
                  }`}
                >
                  {getStatusBadgeStyle(selectedColleague.status).label}
                </span>
                {leaderboardRankMap.get(selectedColleague.id) && (
                  <span className="text-xs text-[#670626] font-bold">
                    Active Rank #{leaderboardRankMap.get(selectedColleague.id)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-xs text-[#A83B4D] block">Resolved</span>
                <span className="text-xl font-black text-[#2B010E]">
                  {selectedColleague.resolvedMissions}
                </span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-xs text-[#A83B4D] block">Active</span>
                <span className="text-xl font-black text-amber-800">
                  {selectedColleague.activeDispatches}
                </span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-xs text-[#A83B4D] block">Success Rate</span>
                <span className="text-xl font-black text-emerald-800">
                  {selectedColleague.missionSuccessRate.toFixed(1)}%
                </span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-xs text-[#A83B4D] block">Avg Speed</span>
                <span className="text-xl font-black text-[#670626]">
                  {selectedColleague.avgResponseTime}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#A83B4D] font-bold">Unit</span>
                <span className="text-[#2B010E] font-bold">
                  {selectedColleague.unitName} ({selectedColleague.unitCode})
                </span>
                <span className="text-xs text-[#5B2A35]">
                  Shift: {selectedColleague.shiftSchedule}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#A83B4D] font-bold">Personnel &amp; GPS</span>
                <span className="text-[#670626] font-bold">
                  {selectedColleague.activePersonnelCount} Active Personnel
                </span>
                <span className="text-xs text-[#5B2A35]">
                  {formatGpsCoord(selectedColleague.baseLatitude, selectedColleague.baseLongitude)}
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-2 border-t border-[#670626]/15 sm:col-span-2">
                <span className="text-xs text-[#A83B4D] font-bold">Dispatch Channel</span>
                <span className="text-[#670626] font-bold inline-flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-[#A83B4D]" />
                  <span>{selectedColleague.radioChannel}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#670626]/15">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    getStatusBadgeStyle(selectedColleague.status).pill
                  }`}
                >
                  Status: {getStatusBadgeStyle(selectedColleague.status).label}
                </span>
                <ResponderButton
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleQuickNavigate(
                      selectedColleague.baseLatitude,
                      selectedColleague.baseLongitude
                    )
                  }
                  icon={<Navigation className="w-4 h-4" />}
                >
                  Navigate Base
                </ResponderButton>
              </div>

              <ResponderButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedColleague(null)}
              >
                Close
              </ResponderButton>
            </div>
          </div>
        </ResponderModalCard>
      )}
    </div>
  );
};

export default DutyRosterView;
