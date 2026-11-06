// [Layer: UserRoles/Features/Pages/RespondersPanel]
// RequestDeployPage.tsx -- Dedicated RHU EMS "REQUEST & DEPLOY" tactical workflow module.
// Supports both Medic-Initiated Dispatch Requests (PENDING -> DEPLOY) and Admin-Initiated Deploy Orders (TO BE DEPLOYED -> ACCEPT/DECLINE -> DEPLOY/DECLINED).
// 100% Universal Arrow Lambdas (=>), pure lucide-react icons, global @/Shared & @/Hooks primitives.

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
  Plus,
  ArrowUpDown,
  Eye,
  Sparkles,
  Radio,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Ambulance,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  Button,
  SearchBar,
  TableCardToggle,
  useTableCardView,
  DefaultFloatingModalCard,
  Dropdown,
} from '@/Shared';
import {
  useDebounce,
  usePagination,
  useSession,
  useToasts,
  useReportEventBus,
} from '@/Hooks';
import {
  DispatchRequestRecord,
  DispatchRequestStatus,
  getDispatchRequests,
  createMedicDispatchRequest,
  approveMedicRequestByAdmin,
  respondToAdminDeployOrder,
} from '@/Endpoints/responderOpsApi';

type FilterTabKey =
  | 'ALL'
  | 'MEDIC_REQUESTS'
  | 'ADMIN_ORDERS'
  | 'DEPLOYED_ACTIVE';

type SortOptionKey = 'NEWEST' | 'OLDEST' | 'SEVERITY_HIGH' | 'STATUS';

const SEVERITY_WEIGHT: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Moderate: 2,
  Low: 1,
};

export const RequestDeployPage: FC = () => {
  const { session } = useSession();
  const { toasts, addToast, removeToast } = useToasts();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

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

  // New Medic Request Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formIncidentCode, setFormIncidentCode] = useState<string>('');
  const [formSeverity, setFormSeverity] = useState<string>('Critical');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formCoordinates, setFormCoordinates] = useState<string>('14.9565° N, 120.7602° E');
  const [formIpAddress, setFormIpAddress] = useState<string>('192.168.42.118');
  const [formEvidenceUrl, setFormEvidenceUrl] = useState<string>(
    'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=900&q=80'
  );
  const [formNotes, setFormNotes] = useState<string>('');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDispatchRequests();
      setRequests(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Listen to real-time dispatch / report events
  useReportEventBus(() => {
    loadRequests();
  });

  // Handle ?incidentId=... deep-link redirect from EMS Trauma Board Medic Pointer
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
          `Focused dispatch record ${existing.incidentCode} (${existing.status}) from EMS Trauma Board.`,
          'info'
        );
      } else {
        const titleParam =
          searchParams.get('title') ||
          `Trauma Map Pointer Dispatch (${incidentIdParam.toUpperCase()})`;
        const locationParam =
          searchParams.get('location') || 'MacArthur Highway Sector, Apalit, Pampanga';
        const coordsParam =
          searchParams.get('coordinates') || '14.9582° N, 120.7619° E';
        const severityParam = searchParams.get('severity') || 'Critical';
        const ipParam = searchParams.get('ip') || '192.168.42.195';

        const created = await createMedicDispatchRequest({
          incidentId: incidentIdParam,
          incidentCode: incidentIdParam.startsWith('RHU-')
            ? incidentIdParam
            : `RHU-${incidentIdParam.slice(0, 6).toUpperCase()}`,
          incidentTitle: titleParam,
          category: 'Medical / Trauma',
          severity: severityParam,
          location: locationParam,
          coordinates: coordsParam,
          ipAddress: ipParam,
          responderId: session?.employeeId || session?.userId || 'MED-UNIT-01',
          responderName: session?.fullName || 'Medic Alpha-1 (RHU EMS)',
          notes:
            'Initiated directly from EMS Trauma Board Medic Pointer — awaiting LDRRMO Admin approval to deploy.',
        });

        await loadRequests();
        setHighlightedId(created.id);
        setSelectedRecord(created);
        addToast(
          `Created Medic Dispatch Request ${created.incidentCode} in PENDING state.`,
          'success'
        );
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('incidentId');
      setSearchParams(nextParams, { replace: true });
    };

    handleDeepLinkIncident();
  }, [
    searchParams,
    isLoading,
    requests,
    session,
    loadRequests,
    addToast,
    setSearchParams,
  ]);

  // Clear highlight pulse after 6 seconds
  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), 6000);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  const handleCreateMedicRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formLocation.trim()) {
      addToast('Please provide both Incident Title and Physical Location.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createMedicDispatchRequest({
        incidentCode: formIncidentCode.trim() || undefined,
        incidentTitle: formTitle.trim(),
        category: 'Medical / Trauma',
        severity: formSeverity,
        location: formLocation.trim(),
        coordinates: formCoordinates.trim() || '14.9565° N, 120.7602° E',
        ipAddress: formIpAddress.trim() || '192.168.42.118',
        evidenceUrl: formEvidenceUrl.trim() || undefined,
        responderId: session?.employeeId || session?.userId || 'MED-UNIT-01',
        responderName: session?.fullName || 'Medic Alpha-1 (RHU EMS)',
        notes:
          formNotes.trim() ||
          'Medic responder initiated dispatch request; awaiting Admin approval.',
      });

      await loadRequests();
      setHighlightedId(created.id);
      setIsCreateModalOpen(false);
      setFormTitle('');
      setFormIncidentCode('');
      setFormLocation('');
      setFormNotes('');
      addToast(
        `Request ${created.id} submitted as PENDING. Waiting for LDRRMO Admin approval.`,
        'success'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateAdminApprove = async (record: DispatchRequestRecord) => {
    const updated = await approveMedicRequestByAdmin(record.id);
    if (updated) {
      await loadRequests();
      setSelectedRecord(updated);
      setHighlightedId(updated.id);
      addToast(
        `Admin Approved! Request ${updated.incidentCode} transitioned from PENDING to DEPLOY.`,
        'success'
      );
    }
  };

  const handleAdminOrderDecision = async (
    record: DispatchRequestRecord,
    decision: 'ACCEPT' | 'DECLINE'
  ) => {
    const updated = await respondToAdminDeployOrder(record.id, decision);
    if (updated) {
      await loadRequests();
      if (selectedRecord?.id === updated.id) {
        setSelectedRecord(updated);
      }
      setHighlightedId(updated.id);
      addToast(
        decision === 'ACCEPT'
          ? `Accepted Admin Deploy Order for ${updated.incidentCode}. Status is now DEPLOY!`
          : `Declined Admin Deploy Order for ${updated.incidentCode}. Status marked DECLINED.`,
        decision === 'ACCEPT' ? 'success' : 'warning'
      );
    }
  };

  // Filtered and Sorted Requests
  const filteredRequests = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const byTab = requests.filter((req) => {
      if (activeTab === 'MEDIC_REQUESTS') {
        return req.direction === 'MEDIC_REQUEST';
      }
      if (activeTab === 'ADMIN_ORDERS') {
        return req.direction === 'ADMIN_ORDER' || req.status === 'TO BE DEPLOYED';
      }
      if (activeTab === 'DEPLOYED_ACTIVE') {
        return req.status === 'DEPLOY' || req.status === 'RESPONDED';
      }
      return true;
    });

    const bySearch = byTab.filter((req) => {
      if (!query) return true;
      return (
        req.id.toLowerCase().includes(query) ||
        req.incidentCode.toLowerCase().includes(query) ||
        req.incidentTitle.toLowerCase().includes(query) ||
        req.location.toLowerCase().includes(query) ||
        req.coordinates.toLowerCase().includes(query) ||
        req.ipAddress.toLowerCase().includes(query) ||
        req.status.toLowerCase().includes(query) ||
        req.responderName.toLowerCase().includes(query)
      );
    });

    return [...bySearch].sort((a, b) => {
      if (sortBy === 'OLDEST') {
        return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
      }
      if (sortBy === 'SEVERITY_HIGH') {
        return (
          (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0)
        );
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
    pageSizeOptions,
  } = usePagination(filteredRequests, { initialPage: 1, initialPageSize: 10 });

  // KPI summary counts
  const kpiCounts = useMemo(() => {
    const medicPending = requests.filter(
      (r) => r.direction === 'MEDIC_REQUEST' && r.status === 'PENDING'
    ).length;
    const adminToBeDeployed = requests.filter(
      (r) => r.status === 'TO BE DEPLOYED'
    ).length;
    const activeDeploy = requests.filter((r) => r.status === 'DEPLOY').length;
    const declinedCount = requests.filter((r) => r.status === 'DECLINED').length;

    return { medicPending, adminToBeDeployed, activeDeploy, declinedCount };
  }, [requests]);

  const renderStatusBadge = (status: DispatchRequestStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40">
            <Clock className="w-3 h-3 animate-spin" />
            PENDING
          </span>
        );
      case 'TO BE DEPLOYED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-400/50 shadow-[0_0_12px_rgba(14,165,233,0.25)]">
            <Radio className="w-3 h-3 animate-pulse text-sky-400" />
            TO BE DEPLOYED
          </span>
        );
      case 'DEPLOY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            DEPLOY
          </span>
        );
      case 'DECLINED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3 text-rose-400" />
            DECLINED
          </span>
        );
      case 'RESPONDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/40">
            <Activity className="w-3 h-3 text-indigo-400" />
            RESPONDED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-700/60 text-slate-300 border border-slate-600">
            <Check className="w-3 h-3 text-slate-400" />
            CLOSED
          </span>
        );
    }
  };

  const renderDirectionBadge = (direction: DispatchRequestRecord['direction']) => {
    if (direction === 'MEDIC_REQUEST') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-700/60">
          <Send className="w-2.5 h-2.5" />
          MEDIC REQUEST
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-700/60">
        <ShieldAlert className="w-2.5 h-2.5" />
        ADMIN DEPLOY ORDER
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* Toast Notifications Overlay */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-xs font-medium transition-all ${
                t.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                  : t.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                  : t.type === 'error'
                  ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                  : 'bg-slate-900/95 border-sky-500/50 text-sky-200'
              }`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Top Tactical Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-400">
            <Ambulance className="w-4 h-4" />
            <span>RHU EMERGENCY MEDICAL SERVICES</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>REQUEST &amp; DEPLOY</span>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              LIVE DISPATCH SYNC
            </span>
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Dual-channel tactical dispatch queue: initiate Medic field deployment requests (
            <span className="text-amber-300 font-mono">PENDING</span> &rarr;{' '}
            <span className="text-emerald-300 font-mono">DEPLOY</span>) or respond to LDRRMO Admin
            deployment orders (<span className="text-sky-300 font-mono">TO BE DEPLOYED</span>{' '}
            &rarr; <span className="text-emerald-300 font-mono">ACCEPT</span> /{' '}
            <span className="text-rose-300 font-mono">DECLINE</span>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadRequests}
          >
            Sync Feed
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={() => navigate('/responder/incident-logs')}
          >
            Incident Logs
          </Button>
          <Button
            variant="action-green"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Medic Request
          </Button>
        </div>
      </div>

      {/* Dual-Workflow Status Banner Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/75 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300/90">
              Medic Requests (Pending)
            </p>
            <p className="text-2xl font-extrabold text-white mt-1">{kpiCounts.medicPending}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Awaiting Admin approval &rarr; DEPLOY
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/75 border border-sky-500/40 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-sky-300">
              Admin Deploy Orders
            </p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {kpiCounts.adminToBeDeployed}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              State: TO BE DEPLOYED (Accept/Decline)
            </p>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-slate-900/75 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300">
              Active Deployments
            </p>
            <p className="text-2xl font-extrabold text-white mt-1">{kpiCounts.activeDeploy}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Cleared &amp; actively deployed units
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/75 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-rose-300">
              Declined Orders
            </p>
            <p className="text-2xl font-extrabold text-white mt-1">{kpiCounts.declinedCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Reassigned / declined by unit
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Tabs + SearchBar + Sort + TableCardToggle Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'ALL', label: `ALL REQUESTS (${requests.length})` },
                {
                  key: 'MEDIC_REQUESTS',
                  label: 'MEDIC REQUESTS (PENDING / DEPLOY)',
                },
                {
                  key: 'ADMIN_ORDERS',
                  label: 'ADMIN DEPLOY ORDERS (TO BE DEPLOYED)',
                },
                { key: 'DEPLOYED_ACTIVE', label: 'DEPLOYED ACTIVE' },
              ] as Array<{ key: FilterTabKey; label: string }>
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 border border-slate-800'
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
              placeholder="Search by Incident Code, Title, Location, GPS Coordinates, IP Address, or Status..."
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>SORT:</span>
            </div>
            <Dropdown
              value={sortBy}
              onChange={(val) => setSortBy(val as SortOptionKey)}
              items={[
                { label: 'Newest Updated', value: 'NEWEST' },
                { label: 'Oldest First', value: 'OLDEST' },
                { label: 'Highest Severity', value: 'SEVERITY_HIGH' },
                { label: 'Status State', value: 'STATUS' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Content: Table View vs Card Grid View */}
      {isTable ? (
        <div className="bg-slate-900/85 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Evidence / Code</th>
                  <th className="py-3.5 px-4">Workflow Channel</th>
                  <th className="py-3.5 px-4">Incident &amp; Location</th>
                  <th className="py-3.5 px-4">Telemetry (GPS &amp; IP)</th>
                  <th className="py-3.5 px-4">Current State</th>
                  <th className="py-3.5 px-4 text-right">Tactical Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No dispatch requests or deployment orders match your current filter.
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
                            ? 'bg-emerald-950/50 ring-1 ring-inset ring-emerald-400/70 animate-pulse'
                            : 'hover:bg-slate-800/60'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                item.evidenceUrl ||
                                'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=400&q=80'
                              }
                              alt={item.incidentTitle}
                              className="w-12 h-12 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                            />
                            <div>
                              <div className="font-mono font-bold text-emerald-400">
                                {item.incidentCode}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {item.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            {renderDirectionBadge(item.direction)}
                            <span className="text-[11px] text-slate-400">
                              {item.responderName}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-100 truncate">
                            {item.incidentTitle}
                          </div>
                          <div className="flex items-center gap-1 text-slate-400 text-[11px] mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-rose-400 flex-shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5 text-sky-300">
                            <Crosshair className="w-3 h-3" />
                            <span>{item.coordinates}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                            <Globe className="w-3 h-3" />
                            <span>IP: {item.ipAddress}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">{renderStatusBadge(item.status)}</td>

                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-2">
                            {item.status === 'TO BE DEPLOYED' && (
                              <>
                                <Button
                                  variant="action-green"
                                  size="xs"
                                  icon={<Check className="w-3.5 h-3.5" />}
                                  onClick={() => handleAdminOrderDecision(item, 'ACCEPT')}
                                >
                                  ACCEPT
                                </Button>
                                <Button
                                  variant="danger"
                                  size="xs"
                                  icon={<X className="w-3.5 h-3.5" />}
                                  onClick={() => handleAdminOrderDecision(item, 'DECLINE')}
                                >
                                  DECLINE
                                </Button>
                              </>
                            )}

                            {item.status === 'PENDING' && (
                              <Button
                                variant="soft-blue"
                                size="xs"
                                icon={<Sparkles className="w-3.5 h-3.5" />}
                                onClick={() => handleSimulateAdminApprove(item)}
                                title="Simulate LDRRMO Admin approval to transition PENDING -> DEPLOY"
                              >
                                Approve &rarr; DEPLOY
                              </Button>
                            )}

                            <Button
                              variant="secondary"
                              size="xs"
                              icon={<Eye className="w-3.5 h-3.5" />}
                              onClick={() => setSelectedRecord(item)}
                            >
                              Details
                            </Button>
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
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedItems.length === 0 ? (
            <div className="col-span-full bg-slate-900/70 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              No dispatch requests or deployment orders match your current filter.
            </div>
          ) : (
            paginatedItems.map((item) => {
              const isHighlighted = highlightedId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedRecord(item)}
                  className={`bg-slate-900/85 border rounded-2xl overflow-hidden shadow-lg transition-all cursor-pointer flex flex-col justify-between ${
                    isHighlighted
                      ? 'border-emerald-400 ring-2 ring-emerald-500/40 animate-pulse'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="relative h-40 w-full bg-slate-950 overflow-hidden">
                      <img
                        src={
                          item.evidenceUrl ||
                          'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=800&q=80'
                        }
                        alt={item.incidentTitle}
                        className="w-full h-full object-cover opacity-85"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                      <div className="absolute top-3 left-3">
                        {renderDirectionBadge(item.direction)}
                      </div>
                      <div className="absolute top-3 right-3">
                        {renderStatusBadge(item.status)}
                      </div>
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-emerald-300">
                          {item.incidentCode}
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700">
                          {item.severity}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2.5">
                      <h3 className="text-sm font-bold text-white line-clamp-1">
                        {item.incidentTitle}
                      </h3>
                      <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-sky-300">
                          <Crosshair className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{item.coordinates}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>IP: {item.ipAddress}</span>
                        </div>
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 pt-1 border-t border-slate-800/80">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="px-4 py-3 bg-slate-950/70 border-t border-slate-800/80 flex items-center justify-between gap-2"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    {item.status === 'TO BE DEPLOYED' ? (
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          variant="action-green"
                          size="xs"
                          fullWidth
                          icon={<Check className="w-3.5 h-3.5" />}
                          onClick={() => handleAdminOrderDecision(item, 'ACCEPT')}
                        >
                          ACCEPT
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          fullWidth
                          icon={<X className="w-3.5 h-3.5" />}
                          onClick={() => handleAdminOrderDecision(item, 'DECLINE')}
                        >
                          DECLINE
                        </Button>
                      </div>
                    ) : item.status === 'PENDING' ? (
                      <div className="flex items-center justify-between w-full gap-2">
                        <Button
                          variant="soft-blue"
                          size="xs"
                          icon={<Sparkles className="w-3.5 h-3.5" />}
                          onClick={() => handleSimulateAdminApprove(item)}
                        >
                          Simulate Admin Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedRecord(item)}
                        >
                          Inspect
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(item.updatedAt).toLocaleTimeString()}
                        </span>
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedRecord(item)}
                        >
                          View Details
                        </Button>
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-xs">
        <div className="flex items-center gap-3 text-slate-400 font-mono">
          <span>
            Showing{' '}
            <strong className="text-slate-200">
              {totalItems === 0 ? 0 : startIndex + 1}
            </strong>{' '}
            to <strong className="text-slate-200">{endIndex}</strong> of{' '}
            <strong className="text-emerald-400">{totalItems}</strong> dispatch records
          </span>
          <select
            value={pageSize}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setPageSize(Number(e.target.value))
            }
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {pageSizeOptions.map((sz) => (
              <option key={sz} value={sz}>
                {sz} / page
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            disabled={!canPrevPage}
            onClick={prevPage}
            icon={<ChevronLeft className="w-3.5 h-3.5" />}
          >
            Prev
          </Button>
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => goToPage(pageNum)}
              className={`w-7 h-7 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                pageNum === currentPage
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {pageNum}
            </button>
          ))}
          <Button
            variant="secondary"
            size="xs"
            disabled={!canNextPage}
            onClick={nextPage}
            icon={<ChevronRight className="w-3.5 h-3.5" />}
            iconPosition="right"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Detail Floating Modal Card */}
      <DefaultFloatingModalCard
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title={
          selectedRecord
            ? `${selectedRecord.incidentCode} — ${selectedRecord.incidentTitle}`
            : 'Dispatch Record Details'
        }
        subtitle={
          selectedRecord
            ? `Record ID: ${selectedRecord.id} • Assigned Unit: ${selectedRecord.responderName}`
            : undefined
        }
        size="2xl"
        footer={
          selectedRecord ? (
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                {selectedRecord.status === 'PENDING' && (
                  <Button
                    variant="soft-blue"
                    size="sm"
                    icon={<Sparkles className="w-4 h-4" />}
                    onClick={() => handleSimulateAdminApprove(selectedRecord)}
                  >
                    SIMULATE ADMIN APPROVAL &rarr; DEPLOY
                  </Button>
                )}
                {selectedRecord.status === 'TO BE DEPLOYED' && (
                  <>
                    <Button
                      variant="action-green"
                      size="sm"
                      icon={<Check className="w-4 h-4" />}
                      onClick={() => handleAdminOrderDecision(selectedRecord, 'ACCEPT')}
                    >
                      ACCEPT DEPLOYMENT
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<X className="w-4 h-4" />}
                      onClick={() => handleAdminOrderDecision(selectedRecord, 'DECLINE')}
                    >
                      DECLINE ORDER
                    </Button>
                  </>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRecord(null)}
              >
                Close Window
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedRecord && (
          <div className="space-y-5 text-xs">
            {/* Evidence Photo + Status Header */}
            <div className="relative h-56 w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={
                  selectedRecord.evidenceUrl ||
                  'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=1000&q=80'
                }
                alt={selectedRecord.incidentTitle}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                {renderDirectionBadge(selectedRecord.direction)}
                <span className="px-2.5 py-0.5 rounded bg-slate-900/90 text-slate-200 font-mono text-[11px] border border-slate-700">
                  Severity: {selectedRecord.severity}
                </span>
              </div>
              <div className="absolute top-3 right-3">
                {renderStatusBadge(selectedRecord.status)}
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-slate-200">
                <p className="font-mono text-[11px] text-emerald-300">
                  OPTICAL EVIDENCE FEED • VERIFIED TELEMETRY
                </p>
                <p className="text-sm font-bold text-white">
                  {selectedRecord.incidentTitle}
                </p>
              </div>
            </div>

            {/* Telemetry Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400" /> Physical Address
                </span>
                <p className="font-semibold text-slate-100">{selectedRecord.location}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                  <Crosshair className="w-3 h-3 text-sky-400" /> Hardware GPS Coordinates
                </span>
                <p className="font-mono font-bold text-sky-300">
                  {selectedRecord.coordinates}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-emerald-400" /> Reporter / Device IP Address
                </span>
                <p className="font-mono text-slate-200">{selectedRecord.ipAddress}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-amber-400" /> Timestamps
                </span>
                <p className="font-mono text-slate-300">
                  Requested: {new Date(selectedRecord.requestedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Workflow Status Progression Timeline */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-300">
                Dispatch State Progression
              </h4>
              {selectedRecord.direction === 'MEDIC_REQUEST' ? (
                <div className="flex items-center gap-3 text-xs font-mono pt-1">
                  <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    1. MEDIC REQUEST (PENDING)
                  </span>
                  <span className="text-slate-500">&rarr;</span>
                  <span
                    className={`px-2.5 py-1 rounded border ${
                      selectedRecord.status === 'DEPLOY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    2. ADMIN APPROVED (DEPLOY)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-xs font-mono pt-1">
                  <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    1. ADMIN ORDER (TO BE DEPLOYED)
                  </span>
                  <span className="text-slate-500">&rarr;</span>
                  <span
                    className={`px-2.5 py-1 rounded border ${
                      selectedRecord.status === 'DEPLOY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                        : selectedRecord.status === 'DECLINED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    2. MEDIC DECISION ({selectedRecord.status})
                  </span>
                </div>
              )}
              {selectedRecord.notes && (
                <p className="text-slate-300 pt-2 border-t border-slate-800/80">
                  {selectedRecord.notes}
                </p>
              )}
            </div>
          </div>
        )}
      </DefaultFloatingModalCard>

      {/* New Medic Dispatch Request Modal */}
      <DefaultFloatingModalCard
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Initiate Medic Dispatch Request"
        subtitle="Submits a field responder request with state PENDING until LDRRMO Admin approves for DEPLOY."
        size="xl"
      >
        <form onSubmit={handleCreateMedicRequest} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">
                Incident Title *
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormTitle(e.target.value)
                }
                placeholder="e.g., Vehicular Trauma Triage - Brgy. San Juan"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">
                Incident Reference Code
              </label>
              <input
                type="text"
                value={formIncidentCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormIncidentCode(e.target.value)
                }
                placeholder="Auto-generated if blank (e.g. RHU-2026-9102)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">
                Physical Address / Sector *
              </label>
              <input
                type="text"
                required
                value={formLocation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormLocation(e.target.value)
                }
                placeholder="e.g., MacArthur Highway, Brgy. San Vicente, Apalit"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">
                Triage Severity
              </label>
              <select
                value={formSeverity}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormSeverity(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="Critical">Critical (Life-Threatening)</option>
                <option value="High">High (Urgent ALS)</option>
                <option value="Moderate">Moderate (BLS)</option>
                <option value="Low">Low (Non-Emergency)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">
                GPS Coordinates
              </label>
              <input
                type="text"
                value={formCoordinates}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormCoordinates(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sky-300 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">
                Source IP Telemetry
              </label>
              <input
                type="text"
                value={formIpAddress}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormIpAddress(e.target.value)
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">
              Evidence Image URL
            </label>
            <input
              type="url"
              value={formEvidenceUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormEvidenceUrl(e.target.value)
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-300 mb-1">
              Medic Field Assessment &amp; Notes
            </label>
            <textarea
              rows={3}
              value={formNotes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormNotes(e.target.value)
              }
              placeholder="Describe patient count, mechanism of injury, and required ALS/BLS ambulance resources..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="action-green"
              size="sm"
              isLoading={isSubmitting}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Request (PENDING)
            </Button>
          </div>
        </form>
      </DefaultFloatingModalCard>
    </div>
  );
};

export default RequestDeployPage;
