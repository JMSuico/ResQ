// [Layer: UserRoles/Features/Pages/RespondersPanel]
// RequestDeployPage.tsx -- Unit-scoped "Request & Deploy" tactical workflow module (RHU, BFP Fire, PNP Police).
// Hydrated and mutated strictly via PostgreSQL /api/dispatch-requests in responderOpsApi.ts.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis, ZERO Unsplash URLs, ZERO static baselines.

import React, { FC, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Crosshair,
  Globe,
  Activity,
  FileText,
  ArrowUpDown,
  Eye,
  Sparkles,
  Radio,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Ambulance,
  Flame,
  Shield,
  ExternalLink,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import {
  SearchBar,
  TableCardToggle,
  useTableCardView,
  Dropdown
} from '@/Shared';
import {
  useDebounce,
  usePagination,
  useSession,
  useToasts,
  useReportEventBus,
  useGpsLocation
} from '@/Hooks';
import {
  DispatchRequestRecord,
  DispatchRequestStatus,
  getDispatchRequests,
  createMedicDispatchRequest,
  approveMedicRequestByAdmin,
  respondToAdminDeployOrder
} from '@/Endpoints/responderOpsApi';
import { ResponderButton } from './Shared/ResponderButton';
import { ResponderModalCard } from './Shared/ResponderModalCard';

type AgencyScope = 'RHU' | 'FIRE' | 'PNP';

type FilterTabKey = 'ALL' | 'UNIT_REQUESTS' | 'ADMIN_ORDERS';

type SortOptionKey = 'NEWEST' | 'OLDEST' | 'SEVERITY_HIGH' | 'STATUS';

const SEVERITY_WEIGHT: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Moderate: 2,
  Low: 1
};

const resolveActiveAgency = (rawUnit?: string | null): AgencyScope => {
  const normalized = (rawUnit || '').trim().toUpperCase();
  if (normalized === 'FIRE' || normalized === 'BFP') return 'FIRE';
  if (normalized === 'PNP' || normalized === 'POLICE') return 'PNP';
  return 'RHU';
};

const classifyDispatchAgency = (record: DispatchRequestRecord): AgencyScope => {
  const combined = `${record.incidentCode} ${record.responderId} ${record.responderName} ${record.category} ${record.incidentTitle}`.toUpperCase();
  if (
    combined.includes('FIRE') ||
    combined.includes('BFP') ||
    combined.includes('STRUCTURAL') ||
    combined.includes('ARSON') ||
    combined.includes('HYDRANT') ||
    combined.includes('HAZMAT')
  ) {
    return 'FIRE';
  }
  if (
    combined.includes('PNP') ||
    combined.includes('POLICE') ||
    combined.includes('CRIME') ||
    combined.includes('ROBBERY') ||
    combined.includes('SECURITY') ||
    combined.includes('CHECKPOINT') ||
    combined.includes('BLOTTER') ||
    combined.includes('DISTURBANCE') ||
    combined.includes('MISSING PERSON')
  ) {
    return 'PNP';
  }
  return 'RHU';
};

const AGENCY_UI_META: Record<
  AgencyScope,
  {
    label: string;
    shortUnit: string;
    defaultCategory: string;
    defaultResponderId: string;
    defaultResponderName: string;
    codePrefix: string;
    requestBadge: string;
    icon: typeof Ambulance;
  }
> = {
  RHU: {
    label: 'RHU EMS',
    shortUnit: 'RHU Medical Unit',
    defaultCategory: 'Medical / Trauma',
    defaultResponderId: 'AMB-RHU-01',
    defaultResponderName: 'RHU Medical Unit',
    codePrefix: 'RHU',
    requestBadge: 'RHU UNIT REQUEST',
    icon: Ambulance
  },
  FIRE: {
    label: 'BFP FIRE',
    shortUnit: 'BFP Fire Rescue',
    defaultCategory: 'Fire / Rescue',
    defaultResponderId: 'FIRE-ENG-01',
    defaultResponderName: 'BFP Fire Rescue Unit',
    codePrefix: 'FIRE',
    requestBadge: 'FIRE UNIT REQUEST',
    icon: Flame
  },
  PNP: {
    label: 'PNP POLICE',
    shortUnit: 'PNP Tactical Patrol',
    defaultCategory: 'Police / Security',
    defaultResponderId: 'PNP-MOB-01',
    defaultResponderName: 'PNP Tactical Patrol Unit',
    codePrefix: 'PNP',
    requestBadge: 'PNP UNIT REQUEST',
    icon: Shield
  }
};

export const RequestDeployPage: FC = () => {
  const { session } = useSession();
  const { coords } = useGpsLocation();
  const { toasts, addToast, removeToast } = useToasts();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeAgency = useMemo<AgencyScope>(
    () => resolveActiveAgency(session?.unit),
    [session?.unit]
  );
  const agencyMeta = AGENCY_UI_META[activeAgency];
  const AgencyIcon = agencyMeta.icon;

  const [requests, setRequests] = useState<DispatchRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);

  const [activeTab, setActiveTab] = useState<FilterTabKey>('ALL');
  const [sortBy, setSortBy] = useState<SortOptionKey>('NEWEST');
  const { viewMode, setViewMode, isTable } = useTableCardView('table');

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DispatchRequestRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [formTitle, setFormTitle] = useState<string>('');
  const [formIncidentCode, setFormIncidentCode] = useState<string>('');
  const [formSeverity, setFormSeverity] = useState<string>('Critical');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formCoordinates, setFormCoordinates] = useState<string>('');
  const [formEvidenceUrl, setFormEvidenceUrl] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const rawData = await getDispatchRequests();
      const unitScoped = (Array.isArray(rawData) ? rawData : []).filter(
        (rec) => classifyDispatchAgency(rec) === activeAgency
      );
      setRequests(unitScoped);
    } catch (err) {
      console.error('[RequestDeployPage] Failed to load dispatch requests:', err);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeAgency]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useReportEventBus(() => {
    void loadRequests();
  });

  useEffect(() => {
    const incidentIdParam = searchParams.get('incidentId');
    if (!incidentIdParam || isLoading) return;

    const handleDeepLinkIncident = async () => {
      const existing = requests.find(
        (r) =>
          r.incidentId.toLowerCase() === incidentIdParam.toLowerCase() ||
          r.incidentCode.toLowerCase() === incidentIdParam.toLowerCase() ||
          r.id.toLowerCase() === incidentIdParam.toLowerCase()
      );

      if (existing) {
        setHighlightedId(existing.id);
        setSelectedRecord(existing);
        addToast(
          `Focused ${activeAgency} dispatch record ${existing.incidentCode} (${existing.status}).`,
          'info'
        );
      } else {
        const titleParam =
          searchParams.get('title') ||
          `${agencyMeta.label} Field Dispatch (${incidentIdParam.toUpperCase()})`;
        const locationParam = searchParams.get('location') || 'Reported Field Location';
        const coordsParam =
          searchParams.get('coordinates') ||
          `${coords.latitude.toFixed(4)}° N, ${coords.longitude.toFixed(4)}° E`;
        const severityParam = searchParams.get('severity') || 'Critical';
        const resolvedCode = incidentIdParam.toUpperCase().startsWith(agencyMeta.codePrefix)
          ? incidentIdParam.toUpperCase()
          : `${agencyMeta.codePrefix}-${incidentIdParam.slice(0, 6).toUpperCase()}`;

        const created = await createMedicDispatchRequest({
          incidentId: incidentIdParam,
          incidentCode: resolvedCode,
          incidentTitle: titleParam,
          category: agencyMeta.defaultCategory,
          severity: severityParam,
          location: locationParam,
          coordinates: coordsParam,
          responderId:
            session?.employeeOrResidentId || session?.userId || agencyMeta.defaultResponderId,
          responderName: session?.fullName || agencyMeta.defaultResponderName,
          notes: `Initiated from ${agencyMeta.label} Radar Pointer — awaiting LDRRMO Admin clearance to deploy.`
        });

        await loadRequests();
        setHighlightedId(created.id);
        setSelectedRecord(created);
        addToast(
          `Created ${activeAgency} Dispatch Request ${created.incidentCode} as Submitted.`,
          'success'
        );
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('incidentId');
      setSearchParams(nextParams, { replace: true });
    };

    void handleDeepLinkIncident();
  }, [
    searchParams,
    isLoading,
    requests,
    session,
    coords.latitude,
    coords.longitude,
    activeAgency,
    agencyMeta,
    loadRequests,
    addToast,
    setSearchParams
  ]);

  useEffect(() => {
    if (!highlightedId) return;
    const timer = window.setTimeout(() => setHighlightedId(null), 6000);
    return () => window.clearTimeout(timer);
  }, [highlightedId]);

  const handleCreateUnitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formLocation.trim()) {
      addToast('Please provide both Incident Title and Physical Location.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const code =
        formIncidentCode.trim() ||
        `${agencyMeta.codePrefix}-${Date.now().toString().slice(-6)}`;
      const fallbackCoords = `${coords.latitude.toFixed(4)}° N, ${coords.longitude.toFixed(4)}° E`;
      const created = await createMedicDispatchRequest({
        incidentCode: code,
        incidentTitle: formTitle.trim(),
        category: agencyMeta.defaultCategory,
        severity: formSeverity,
        location: formLocation.trim(),
        coordinates: formCoordinates.trim() || fallbackCoords,
        evidenceUrl: formEvidenceUrl.trim() || undefined,
        responderId:
          session?.employeeOrResidentId || session?.userId || agencyMeta.defaultResponderId,
        responderName: session?.fullName || agencyMeta.defaultResponderName,
        notes:
          formNotes.trim() ||
          `${agencyMeta.label} responder initiated dispatch request; awaiting Admin approval.`
      });

      await loadRequests();
      setHighlightedId(created.id);
      setIsCreateModalOpen(false);
      setFormTitle('');
      setFormIncidentCode('');
      setFormLocation('');
      setFormCoordinates('');
      setFormEvidenceUrl('');
      setFormNotes('');
      addToast(
        `Request ${created.incidentCode} submitted for LDRRMO Admin approval.`,
        'success'
      );
    } catch {
      addToast('Failed to submit dispatch request to server.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateAdminApprove = async (record: DispatchRequestRecord) => {
    try {
      const updated = await approveMedicRequestByAdmin(record.id);
      if (updated) {
        await loadRequests();
        setSelectedRecord(updated);
        setHighlightedId(updated.id);
        addToast(
          `Admin Approved! Request ${updated.incidentCode} transitioned from Submitted to DEPLOY.`,
          'success'
        );
      } else {
        addToast('Failed to approve request on server.', 'warning');
      }
    } catch {
      addToast('Failed to approve request on server.', 'warning');
    }
  };

  const handleAdminOrderDecision = async (
    record: DispatchRequestRecord,
    decision: 'ACCEPT' | 'DECLINE'
  ) => {
    try {
      const updated = await respondToAdminDeployOrder(record.id, decision);
      if (updated) {
        await loadRequests();
        if (selectedRecord?.id === updated.id) {
          setSelectedRecord(updated);
        }
        setHighlightedId(updated.id);
        addToast(
          decision === 'ACCEPT'
            ? `Accepted Admin Deploy Order for ${updated.incidentCode}. Status is now DEPLOY.`
            : `Declined Admin Deploy Order for ${updated.incidentCode}. Status marked DECLINED.`,
          decision === 'ACCEPT' ? 'success' : 'warning'
        );
      } else {
        addToast('Failed to update dispatch order status on server.', 'warning');
      }
    } catch {
      addToast('Failed to update dispatch order status on server.', 'warning');
    }
  };

  const filteredRequests = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const byTab = requests.filter((req) => {
      if (activeTab === 'UNIT_REQUESTS') {
        return req.direction === 'MEDIC_REQUEST';
      }
      if (activeTab === 'ADMIN_ORDERS') {
        return req.direction === 'ADMIN_ORDER' || req.status === 'TO BE DEPLOYED';
      }
      return true;
    });

    const bySearch = byTab.filter((req) => {
      if (!query) return true;
      return (
        String(req.id ?? '').toLowerCase().includes(query) ||
        String(req.incidentCode ?? '').toLowerCase().includes(query) ||
        String(req.incidentTitle ?? '').toLowerCase().includes(query) ||
        String(req.location ?? '').toLowerCase().includes(query) ||
        String(req.coordinates ?? '').toLowerCase().includes(query) ||
        String(req.ipAddress ?? '').toLowerCase().includes(query) ||
        String(req.status ?? '').toLowerCase().includes(query) ||
        String(req.responderName ?? '').toLowerCase().includes(query)
      );
    });

    return [...bySearch].sort((a, b) => {
      if (sortBy === 'OLDEST') {
        return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
      }
      if (sortBy === 'SEVERITY_HIGH') {
        return (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0);
      }
      if (sortBy === 'STATUS') {
        return a.status.localeCompare(b.status);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [requests, activeTab, debouncedSearch, sortBy]);

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
  } = usePagination(filteredRequests, { initialPage: 1, initialPageSize: 10 });

  const kpiCounts = useMemo(() => {
    const unitPending = requests.filter(
      (r) => r.direction === 'MEDIC_REQUEST' && r.status === 'PENDING'
    ).length;
    const adminToBeDeployed = requests.filter(
      (r) => r.status === 'TO BE DEPLOYED'
    ).length;
    const activeDeploy = requests.filter((r) => r.status === 'DEPLOY').length;
    const declinedCount = requests.filter((r) => r.status === 'DECLINED').length;

    return { unitPending, adminToBeDeployed, activeDeploy, declinedCount };
  }, [requests]);

  const renderStatusBadge = (status: DispatchRequestStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#E9D9D0] text-[#670626] border border-[#A83B4D]/40">
            <Clock className="w-3.5 h-3.5 text-[#A83B4D]" />
            SUBMITTED
          </span>
        );
      case 'TO BE DEPLOYED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-100 text-sky-900 border border-sky-700/30">
            <Radio className="w-3.5 h-3.5 animate-pulse text-sky-700" />
            TO BE DEPLOYED
          </span>
        );
      case 'DEPLOY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-700/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            DEPLOY
          </span>
        );
      case 'DECLINED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#670626] text-[#F7F1EA] border border-[#4A041A]">
            <XCircle className="w-3.5 h-3.5" />
            DECLINED
          </span>
        );
      case 'RESPONDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#E9D9D0] text-[#670626] border border-[#670626]/25">
            <Activity className="w-3.5 h-3.5 text-[#670626]" />
            RESPONDED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-stone-200 text-stone-800 border border-stone-400/50">
            <Check className="w-3.5 h-3.5 text-stone-700" />
            CLOSED
          </span>
        );
    }
  };

  const renderDirectionBadge = (direction: DispatchRequestRecord['direction']) => {
    if (direction === 'MEDIC_REQUEST') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#E9D9D0] text-[#670626] border border-[#A83B4D]/35 font-bold">
          <Send className="w-3 h-3" />
          {agencyMeta.requestBadge}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] border border-[#4A041A] font-bold">
        <ShieldAlert className="w-3 h-3" />
        ADMIN DEPLOY ORDER
      </span>
    );
  };

  return (
    <div className="min-h-screen text-[#F7F1EA] p-1 sm:p-2 space-y-6">
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border-2 border-[#670626] bg-[#F7F1EA] text-[#670626] shadow-[0_14px_34px_rgba(74,4,26,0.35)] text-sm font-bold transition-all"
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-[#A83B4D] hover:text-[#670626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Top Tactical Header */}
      <div className="clay-surface flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl p-5 sm:p-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#A83B4D] font-bold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#E9D9D0] text-[#670626] border border-[#670626]/15">
              <AgencyIcon className="w-3.5 h-3.5" />
              <span>{agencyMeta.label}</span>
            </span>
            <span>Katipunan, Zamboanga del Norte (7109)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#670626]">
            Request &amp; Deploy
          </h1>
          <p className="text-sm text-[#5B2A35] font-medium">
            {agencyMeta.shortUnit} dispatch queue
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ResponderButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => void loadRequests()}
          >
            Sync Feed
          </ResponderButton>
          <ResponderButton
            variant="outline"
            size="sm"
            icon={<ExternalLink className="w-4 h-4" />}
            onClick={() => navigate('/responder/incident-logs')}
          >
            Incident Logs
          </ResponderButton>
          <ResponderButton
            variant="primary"
            size="md"
            icon={<Send className="w-4 h-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Request Deploy
          </ResponderButton>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
              Submitted Requests
            </p>
            <p className="text-3xl font-black text-[#670626] mt-1.5 tabular-nums">
              {kpiCounts.unitPending}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-[#670626]">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
              Deploy Orders
            </p>
            <p className="text-3xl font-black text-[#670626] mt-1.5 tabular-nums">
              {kpiCounts.adminToBeDeployed}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-[#670626]">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
              Active Deployments
            </p>
            <p className="text-3xl font-black text-emerald-800 mt-1.5 tabular-nums">
              {kpiCounts.activeDeploy}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-emerald-800">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
              Declined
            </p>
            <p className="text-3xl font-black text-[#670626] mt-1.5 tabular-nums">
              {kpiCounts.declinedCount}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-[#670626]">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Tabs + SearchBar + Sort + TableCardToggle Toolbar */}
      <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#670626]/15 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'ALL', label: `All ${activeAgency} (${requests.length})` },
                { key: 'UNIT_REQUESTS', label: `My ${activeAgency} Requests` },
                { key: 'ADMIN_ORDERS', label: 'Admin Deploy Orders' }
              ] as Array<{ key: FilterTabKey; label: string }>
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-sm font-mono font-bold tracking-wide transition-all cursor-pointer border ${
                  activeTab === tab.key
                    ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-sm'
                    : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/15 hover:bg-[#DFC9BE]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 max-w-xl">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search code, title, location, GPS, IP, status..."
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-[#A83B4D]">
              <ArrowUpDown className="w-4 h-4 text-[#670626]" />
              <span>SORT:</span>
            </div>
            <Dropdown
              value={sortBy}
              onChange={(val) => setSortBy(val as SortOptionKey)}
              items={[
                { label: 'Newest', value: 'NEWEST' },
                { label: 'Oldest', value: 'OLDEST' },
                { label: 'Severity', value: 'SEVERITY_HIGH' },
                { label: 'Status', value: 'STATUS' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Content: Table View vs Card Grid View */}
      {isLoading ? (
        <div className="clay-surface bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 rounded-2xl p-12 text-center font-mono font-bold animate-pulse">
          Loading {activeAgency} dispatch requests...
        </div>
      ) : isTable ? (
        <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#E9D9D0] border-b border-[#670626]/15 text-xs font-mono uppercase tracking-wider text-[#670626]">
                  <th className="py-4 px-4">Evidence / Code</th>
                  <th className="py-4 px-4">Workflow Channel</th>
                  <th className="py-4 px-4">Incident &amp; Location</th>
                  <th className="py-4 px-4">Telemetry (GPS &amp; IP)</th>
                  <th className="py-4 px-4">Current State</th>
                  <th className="py-4 px-4 text-right">Tactical Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10 text-sm bg-[#FAF5EE]">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#5B2A35]">
                      No dispatch requests found for {activeAgency}.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const isHighlighted = highlightedId === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedRecord(item)}
                        className={`transition-all cursor-pointer ${
                          isHighlighted
                            ? 'bg-[#E9D9D0] ring-1 ring-inset ring-[#670626]'
                            : 'hover:bg-[#E9D9D0]/55'
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {item.evidenceUrl ? (
                              <img
                                src={item.evidenceUrl}
                                alt={item.incidentTitle}
                                className="w-12 h-12 rounded-xl object-cover border border-[#670626]/20 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="w-5 h-5 text-[#A83B4D]" />
                              </div>
                            )}
                            <div>
                              <div className="font-mono font-bold text-[#670626]">
                                {item.incidentCode}
                              </div>
                              <div className="text-xs font-mono text-[#A83B4D]">{item.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            {renderDirectionBadge(item.direction)}
                            <span className="text-xs text-[#5B2A35] font-medium">
                              {item.responderName}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 max-w-xs">
                          <div className="font-bold text-[#2B010E] truncate">
                            {item.incidentTitle}
                          </div>
                          <div className="flex items-center gap-1.5 text-[#5B2A35] text-xs mt-0.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-[#A83B4D] flex-shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 font-mono text-xs">
                          <div className="flex items-center gap-1.5 text-[#670626] font-bold">
                            <Crosshair className="w-3.5 h-3.5 text-[#A83B4D]" />
                            <span>{item.coordinates || 'Unavailable'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#5B2A35] mt-0.5">
                            <Globe className="w-3.5 h-3.5 text-[#A83B4D]" />
                            <span>IP: {item.ipAddress || 'Unavailable'}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4">{renderStatusBadge(item.status)}</td>

                        <td
                          className="py-4 px-4 text-right"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-2">
                            {item.status === 'TO BE DEPLOYED' && (
                              <>
                                <ResponderButton
                                  variant="action-green"
                                  size="xs"
                                  icon={<Check className="w-3.5 h-3.5" />}
                                  onClick={() => void handleAdminOrderDecision(item, 'ACCEPT')}
                                >
                                  ACCEPT
                                </ResponderButton>
                                <ResponderButton
                                  variant="danger"
                                  size="xs"
                                  icon={<X className="w-3.5 h-3.5" />}
                                  onClick={() => void handleAdminOrderDecision(item, 'DECLINE')}
                                >
                                  DECLINE
                                </ResponderButton>
                              </>
                            )}

                            {item.status === 'PENDING' && (
                              <ResponderButton
                                variant="primary"
                                size="xs"
                                icon={<Sparkles className="w-3.5 h-3.5" />}
                                onClick={() => void handleSimulateAdminApprove(item)}
                                title="Approve deployment"
                              >
                                Approve
                              </ResponderButton>
                            )}

                            <ResponderButton
                              variant="secondary"
                              size="xs"
                              icon={<Eye className="w-3.5 h-3.5" />}
                              onClick={() => setSelectedRecord(item)}
                            >
                              Details
                            </ResponderButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedItems.length === 0 ? (
            <div className="col-span-full clay-surface bg-[#F7F1EA] text-[#5B2A35] border border-[#670626]/15 rounded-2xl p-12 text-center text-sm">
              No dispatch requests found for {activeAgency}.
            </div>
          ) : (
            paginatedItems.map((item) => {
              const isHighlighted = highlightedId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedRecord(item)}
                  className={`clay-surface bg-[#F7F1EA] text-[#2B010E] border rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isHighlighted
                      ? 'border-[#670626] ring-2 ring-[#670626]/35'
                      : 'border-[#670626]/15 hover:border-[#670626]/45'
                  }`}
                >
                  <div>
                    <div className="relative h-44 w-full bg-[#4A041A] overflow-hidden flex items-center justify-center">
                      {item.evidenceUrl ? (
                        <img
                          src={item.evidenceUrl}
                          alt={item.incidentTitle}
                          className="w-full h-full object-cover opacity-90"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-[#E9D9D0]/70 font-mono text-xs">
                          <ImageIcon className="w-8 h-8" />
                          <span>No evidence image</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#2B010E]/85 via-[#2B010E]/25 to-transparent" />
                      <div className="absolute top-3 left-3">
                        {renderDirectionBadge(item.direction)}
                      </div>
                      <div className="absolute top-3 right-3">
                        {renderStatusBadge(item.status)}
                      </div>
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-[#F7F1EA]">
                          {item.incidentCode}
                        </span>
                        <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-[#F7F1EA] text-[#670626] font-bold">
                          {item.severity}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2.5">
                      <h3 className="text-base font-bold text-[#2B010E] line-clamp-1">
                        {item.incidentTitle}
                      </h3>
                      <div className="space-y-1.5 text-sm text-[#5B2A35]">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-[#670626] font-bold">
                          <Crosshair className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />
                          <span>{item.coordinates || 'Unavailable'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-[#5B2A35]">
                          <Globe className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />
                          <span>IP: {item.ipAddress || 'Unavailable'}</span>
                        </div>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-[#5B2A35] line-clamp-2 pt-2 border-t border-[#670626]/15">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="px-4 py-3 bg-[#E9D9D0] border-t border-[#670626]/15 flex items-center justify-between gap-2"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    {item.status === 'TO BE DEPLOYED' ? (
                      <div className="flex items-center gap-2 w-full">
                        <ResponderButton
                          variant="action-green"
                          size="xs"
                          fullWidth
                          icon={<Check className="w-3.5 h-3.5" />}
                          onClick={() => void handleAdminOrderDecision(item, 'ACCEPT')}
                        >
                          ACCEPT
                        </ResponderButton>
                        <ResponderButton
                          variant="danger"
                          size="xs"
                          fullWidth
                          icon={<X className="w-3.5 h-3.5" />}
                          onClick={() => void handleAdminOrderDecision(item, 'DECLINE')}
                        >
                          DECLINE
                        </ResponderButton>
                      </div>
                    ) : item.status === 'PENDING' ? (
                      <div className="flex items-center justify-between w-full gap-2">
                        <ResponderButton
                          variant="primary"
                          size="xs"
                          icon={<Sparkles className="w-3.5 h-3.5" />}
                          onClick={() => void handleSimulateAdminApprove(item)}
                        >
                          Approve
                        </ResponderButton>
                        <ResponderButton
                          variant="outline"
                          size="xs"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedRecord(item)}
                        >
                          Inspect
                        </ResponderButton>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-mono text-[#5B2A35]">
                          {new Date(item.updatedAt).toLocaleTimeString()}
                        </span>
                        <ResponderButton
                          variant="outline"
                          size="xs"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedRecord(item)}
                        >
                          View Details
                        </ResponderButton>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pagination Bar */}
      <div className="clay-surface flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl px-4 py-3.5 text-sm">
        <div className="flex items-center gap-3 text-[#5B2A35] font-mono">
          <span>
            <strong className="text-[#670626]">{totalItems === 0 ? 0 : startIndex + 1}</strong>–
            <strong className="text-[#670626]">{endIndex}</strong> of{' '}
            <strong className="text-[#670626]">{totalItems}</strong>
          </span>
          <select
            value={pageSize}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setPageSize(Number(e.target.value))
            }
            className="bg-[#E9D9D0] border border-[#670626]/20 rounded-lg px-2.5 py-1 text-sm text-[#670626] font-bold focus:outline-none focus:border-[#670626]"
          >
            {pageSizeOptions.map((sz) => (
              <option key={sz} value={sz}>
                {sz} / page
              </option>
            ))}
          </select>
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
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => goToPage(pageNum)}
              className={`w-8 h-8 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer border ${
                pageNum === currentPage
                  ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A]'
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
            icon={<ChevronRight className="w-3.5 h-3.5" />}
            iconPosition="right"
          >
            Next
          </ResponderButton>
        </div>
      </div>

      {/* Detail Floating Modal Card */}
      <ResponderModalCard
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title={
          selectedRecord
            ? `${selectedRecord.incidentCode} — ${selectedRecord.incidentTitle}`
            : 'Dispatch Record Details'
        }
        subtitle={
          selectedRecord
            ? `Record ID: ${selectedRecord.id} • Unit: ${selectedRecord.responderName}`
            : undefined
        }
        size="2xl"
        footer={
          selectedRecord ? (
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                {selectedRecord.status === 'PENDING' && (
                  <ResponderButton
                    variant="primary"
                    size="sm"
                    icon={<Sparkles className="w-4 h-4" />}
                    onClick={() => void handleSimulateAdminApprove(selectedRecord)}
                  >
                    Approve Deploy
                  </ResponderButton>
                )}
                {selectedRecord.status === 'TO BE DEPLOYED' && (
                  <>
                    <ResponderButton
                      variant="action-green"
                      size="sm"
                      icon={<Check className="w-4 h-4" />}
                      onClick={() => void handleAdminOrderDecision(selectedRecord, 'ACCEPT')}
                    >
                      Accept
                    </ResponderButton>
                    <ResponderButton
                      variant="danger"
                      size="sm"
                      icon={<X className="w-4 h-4" />}
                      onClick={() => void handleAdminOrderDecision(selectedRecord, 'DECLINE')}
                    >
                      Decline
                    </ResponderButton>
                  </>
                )}
              </div>
              <ResponderButton
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </ResponderButton>
            </div>
          ) : undefined
        }
      >
        {selectedRecord && (
          <div className="space-y-5 text-sm text-[#2B010E]">
            <div className="relative h-56 w-full rounded-xl overflow-hidden border border-[#670626]/20 bg-[#4A041A] flex items-center justify-center">
              {selectedRecord.evidenceUrl ? (
                <img
                  src={selectedRecord.evidenceUrl}
                  alt={selectedRecord.incidentTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#E9D9D0]/70 font-mono text-xs">
                  <ImageIcon className="w-10 h-10" />
                  <span>No evidence image attached</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#2B010E]/85 via-[#2B010E]/20 to-transparent" />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                {renderDirectionBadge(selectedRecord.direction)}
                <span className="px-2.5 py-1 rounded-lg bg-[#F7F1EA] text-[#670626] font-mono text-xs font-bold">
                  Severity: {selectedRecord.severity}
                </span>
              </div>
              <div className="absolute top-3 right-3">
                {renderStatusBadge(selectedRecord.status)}
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-[#F7F1EA]">
                <p className="font-mono text-xs text-[#FFD9DD]">
                  Dispatch Telemetry
                </p>
                <p className="text-base font-bold">{selectedRecord.incidentTitle}</p>
              </div>
            </div>

            <div className="clay-well grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[#E9D9D0] border border-[#670626]/15 rounded-xl p-4">
              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-[#A83B4D] font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Address
                </span>
                <p className="font-semibold text-[#2B010E]">{selectedRecord.location}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-[#A83B4D] font-bold flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" /> GPS Coordinates
                </span>
                <p className="font-mono font-bold text-[#670626]">
                  {selectedRecord.coordinates || 'Unavailable'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-[#A83B4D] font-bold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Device IP
                </span>
                <p className="font-mono text-[#2B010E]">
                  {selectedRecord.ipAddress || 'Unavailable'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-[#A83B4D] font-bold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Timestamps
                </span>
                <p className="font-mono text-[#5B2A35]">
                  Requested: {new Date(selectedRecord.requestedAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="clay-well bg-[#E9D9D0] border border-[#670626]/15 rounded-xl p-4 space-y-2.5">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#A83B4D] font-bold">
                Dispatch State Progression
              </h4>
              {selectedRecord.direction === 'MEDIC_REQUEST' ? (
                <div className="flex flex-wrap items-center gap-3 text-sm font-mono pt-1">
                  <span className="px-3 py-1 rounded-lg bg-[#F7F1EA] text-[#670626] border border-[#670626]/25 font-bold">
                    1. {activeAgency} REQUEST (SUBMITTED)
                  </span>
                  <span className="text-[#A83B4D]">&rarr;</span>
                  <span
                    className={`px-3 py-1 rounded-lg border ${
                      selectedRecord.status === 'DEPLOY'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-700/30 font-bold'
                        : 'bg-[#F7F1EA] text-[#5B2A35] border-[#670626]/15'
                    }`}
                  >
                    2. ADMIN APPROVED (DEPLOY)
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-sm font-mono pt-1">
                  <span className="px-3 py-1 rounded-lg bg-sky-100 text-sky-900 border border-sky-700/30 font-bold">
                    1. ADMIN ORDER (TO BE DEPLOYED)
                  </span>
                  <span className="text-[#A83B4D]">&rarr;</span>
                  <span
                    className={`px-3 py-1 rounded-lg border ${
                      selectedRecord.status === 'DEPLOY'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-700/30 font-bold'
                        : selectedRecord.status === 'DECLINED'
                        ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] font-bold'
                        : 'bg-[#F7F1EA] text-[#5B2A35] border-[#670626]/15'
                    }`}
                  >
                    2. {activeAgency} DECISION ({selectedRecord.status})
                  </span>
                </div>
              )}
              {selectedRecord.notes && (
                <p className="text-[#2B010E] pt-2 border-t border-[#670626]/15">
                  {selectedRecord.notes}
                </p>
              )}
            </div>
          </div>
        )}
      </ResponderModalCard>

      {/* New Unit Dispatch Request Modal */}
      <ResponderModalCard
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={`Request Deploy (${agencyMeta.label})`}
        subtitle="Submits a dispatch request for LDRRMO Admin approval."
        size="xl"
      >
        <form onSubmit={handleCreateUnitRequest} className="space-y-4 text-sm text-[#2B010E]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                Incident Title *
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormTitle(e.target.value)
                }
                placeholder={`e.g., ${agencyMeta.defaultCategory}`}
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                Reference Code
              </label>
              <input
                type="text"
                value={formIncidentCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormIncidentCode(e.target.value)
                }
                placeholder="Auto-generated if blank"
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] font-mono placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                Address / Barangay *
              </label>
              <input
                type="text"
                required
                value={formLocation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormLocation(e.target.value)
                }
                placeholder="e.g., National Highway, Brgy. Dos, Katipunan"
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                Severity
              </label>
              <select
                value={formSeverity}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormSeverity(e.target.value)
                }
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] font-semibold focus:outline-none focus:border-[#670626]"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Moderate">Moderate</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
              GPS Coordinates (Optional — defaults to device GPS)
            </label>
            <input
              type="text"
              value={formCoordinates}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormCoordinates(e.target.value)
              }
              placeholder={`${coords.latitude.toFixed(4)}° N, ${coords.longitude.toFixed(4)}° E`}
              className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#670626] font-mono font-bold focus:outline-none focus:border-[#670626]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
              Evidence URL (Optional)
            </label>
            <input
              type="url"
              value={formEvidenceUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormEvidenceUrl(e.target.value)
              }
              placeholder="Optional image URL..."
              className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] font-mono placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
              Field Notes
            </label>
            <textarea
              rows={3}
              value={formNotes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormNotes(e.target.value)
              }
              placeholder="Scene status, hazards, and required gear..."
              className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#670626]/15">
            <ResponderButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </ResponderButton>
            <ResponderButton
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              icon={<Send className="w-4 h-4" />}
            >
              Submit Request
            </ResponderButton>
          </div>
        </form>
      </ResponderModalCard>
    </div>
  );
};

export default RequestDeployPage;
