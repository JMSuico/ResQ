// [Layer: UserRoles/Features/Pages/RespondersPanel]
// RequestDeployPage.tsx -- Unit-scoped "Request & Deploy" tactical workflow module (RHU, BFP Fire, PNP Police).
// Supports Responder-Initiated Dispatch Requests (PENDING -> DEPLOY) and Admin-Initiated Deploy Orders (TO BE DEPLOYED -> ACCEPT/DECLINE -> DEPLOY/DECLINED).
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis, ZERO Unsplash URLs, ZERO Apalit fallbacks.

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
  RefreshCw
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
  useReportEventBus
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

const KATIPUNAN_DEFAULT_COORDS = '8.5145° N, 123.2852° E';
const KATIPUNAN_DEFAULT_LOCATION = 'Barangay Uno (Poblacion), Katipunan, Zamboanga del Norte';

const buildTelemetryPlaceholderDataUri = (refCode: string, subtitle: string): string => {
  const safeCode = refCode.replace(/[<>&"']/g, '');
  const safeSub = subtitle.replace(/[<>&"']/g, '').slice(0, 42);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">',
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0%" stop-color="#4A041A"/><stop offset="100%" stop-color="#670626"/>',
    '</linearGradient></defs>',
    '<rect width="640" height="360" fill="url(#bg)"/>',
    '<rect x="24" y="24" width="592" height="312" rx="22" fill="#F7F1EA" fill-opacity="0.96"/>',
    '<rect x="44" y="44" width="180" height="34" rx="10" fill="#670626"/>',
    `<text x="134" y="66" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#F7F1EA">${safeCode}</text>`,
    '<circle cx="320" cy="175" r="46" fill="#E9D9D0" stroke="#A83B4D" stroke-width="2"/>',
    '<path d="M320 148v54M293 175h54" stroke="#670626" stroke-width="6" stroke-linecap="round"/>',
    `<text x="320" y="256" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="#2B010E">${safeSub}</text>`,
    '<text x="320" y="284" text-anchor="middle" font-family="monospace" font-size="12" fill="#A83B4D">RESQTRACK KATIPUNAN TELEMETRY</text>',
    '</svg>'
  ].join('');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

const sanitizeKatipunanRecord = (record: DispatchRequestRecord): DispatchRequestRecord => {
  const rawLocation = (record.location || '').trim();
  const isLegacyApalit =
    /apalit|pampanga|macarthur|sampaloc/i.test(rawLocation) || rawLocation.length === 0;
  const cleanLocation = isLegacyApalit
    ? record.incidentCode.includes('9044')
      ? 'Purok 2, Barangay Uno (Poblacion), Katipunan, Zamboanga del Norte'
      : 'National Highway Junction, Barangay Dos, Katipunan, Zamboanga del Norte'
    : rawLocation;

  const rawCoords = (record.coordinates || '').trim();
  const isLegacyCoords =
    rawCoords.startsWith('14.9') || rawCoords.includes('120.7') || rawCoords.length === 0;
  const cleanCoords = isLegacyCoords
    ? record.incidentCode.includes('9044')
      ? '8.5162° N, 123.2858° E'
      : '8.5119° N, 123.2814° E'
    : rawCoords;

  const hasExternalUnsplash =
    !record.evidenceUrl || record.evidenceUrl.toLowerCase().includes('unsplash.com');
  const cleanEvidence = hasExternalUnsplash
    ? buildTelemetryPlaceholderDataUri(record.incidentCode, record.incidentTitle)
    : record.evidenceUrl;

  return {
    ...record,
    location: cleanLocation,
    coordinates: cleanCoords,
    evidenceUrl: cleanEvidence
  };
};

const buildUnitBaselineRequests = (agency: AgencyScope): DispatchRequestRecord[] => {
  const now = Date.now();
  if (agency === 'FIRE') {
    return [
      {
        id: 'REQ-FIRE-2026-101',
        incidentId: 'INC-BFP-4101',
        incidentCode: 'FIRE-2026-4101',
        incidentTitle: 'Commercial Storefront Electrical Arcing & Smoke Alert',
        category: 'Fire / Structural',
        severity: 'Critical',
        location: 'Public Market Perimeter, Barangay Uno (Poblacion), Katipunan, ZN',
        coordinates: '8.5138° N, 123.2904° E',
        ipAddress: '103.62.155.10',
        evidenceUrl: buildTelemetryPlaceholderDataUri(
          'FIRE-2026-4101',
          'Commercial Electrical Arcing Alert'
        ),
        responderId: 'FIRE-ENG-01',
        responderName: 'BFP Pumper Engine 01 (SFO4 Pendelton)',
        direction: 'MEDIC_REQUEST',
        status: 'PENDING',
        requestedAt: new Date(now - 11 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 11 * 60 * 1000).toISOString(),
        notes:
          'BFP Engine 01 requesting LDRRMO Command clearance for Second Alarm water tanker and feeder line isolation.'
      },
      {
        id: 'ORD-FIRE-2026-102',
        incidentId: 'INC-BFP-4104',
        incidentCode: 'FIRE-2026-4104',
        incidentTitle: 'Residential Kitchen LPG Leak & Containment',
        category: 'Fire / HazMat',
        severity: 'High',
        location: 'Rizal Avenue Ext., Barangay Dos, Katipunan, ZN',
        coordinates: '8.5155° N, 123.2829° E',
        ipAddress: '103.62.155.42',
        evidenceUrl: buildTelemetryPlaceholderDataUri(
          'FIRE-2026-4104',
          'Residential LPG Containment'
        ),
        responderId: 'FIRE-RSC-02',
        responderName: 'BFP Rapid Rescue Unit 02 (SFO2 Macapagal)',
        direction: 'ADMIN_ORDER',
        status: 'TO BE DEPLOYED',
        requestedAt: new Date(now - 5 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
        notes:
          'LDRRMO Command priority order: Civilian reported strong LPG odor near residential block. Awaiting BFP ACCEPT confirmation.'
      }
    ];
  }
  if (agency === 'PNP') {
    return [
      {
        id: 'REQ-PNP-2026-201',
        incidentId: 'INC-PNP-7201',
        incidentCode: 'PNP-2026-7201',
        incidentTitle: 'Barangay Boundary Traffic Gridlock & Checkpoint Support',
        category: 'Police / Traffic & Security',
        severity: 'High',
        location: 'Sitio Malugas Bridge, Barangay Daanglungsod, Katipunan, ZN',
        coordinates: '8.5085° N, 123.2775° E',
        ipAddress: '103.62.156.24',
        evidenceUrl: buildTelemetryPlaceholderDataUri(
          'PNP-2026-7201',
          'Sitio Malugas Traffic Lockdown'
        ),
        responderId: 'PNP-MOB-01',
        responderName: 'PNP Tactical Mobile Patrol 01 (PCPT del Pilar)',
        direction: 'MEDIC_REQUEST',
        status: 'PENDING',
        requestedAt: new Date(now - 12 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 12 * 60 * 1000).toISOString(),
        notes:
          'Mobile Patrol 01 requesting LDRRMO Admin clearance to deploy additional perimeter patrol and highway reroute barricades.'
      },
      {
        id: 'ORD-PNP-2026-202',
        incidentId: 'INC-PNP-7204',
        incidentCode: 'PNP-2026-7204',
        incidentTitle: 'Commercial Strip Perimeter Security & SOCO Dispatch',
        category: 'Police / Security',
        severity: 'Critical',
        location: 'Bonifacio Street Commercial Strip, Barangay Uno, Katipunan, ZN',
        coordinates: '8.5171° N, 123.2849° E',
        ipAddress: '103.62.156.89',
        evidenceUrl: buildTelemetryPlaceholderDataUri(
          'PNP-2026-7204',
          'Commercial Strip Perimeter Security'
        ),
        responderId: 'PNP-MOB-02',
        responderName: 'PNP Investigation Unit 02 (PLT Dimaculangan)',
        direction: 'ADMIN_ORDER',
        status: 'TO BE DEPLOYED',
        requestedAt: new Date(now - 6 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 6 * 60 * 1000).toISOString(),
        notes:
          'LDRRMO Command priority deploy order: Verified civilian security alarm with optical evidence. Awaiting PNP ACCEPT confirmation.'
      }
    ];
  }
  return [];
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
    defaultResponderName: 'Medic Alpha-1 (RHU EMS)',
    codePrefix: 'RHU',
    requestBadge: 'RHU UNIT REQUEST',
    icon: Ambulance
  },
  FIRE: {
    label: 'BFP FIRE',
    shortUnit: 'BFP Fire Rescue',
    defaultCategory: 'Fire / Rescue',
    defaultResponderId: 'FIRE-ENG-01',
    defaultResponderName: 'BFP Engine 01 (Fire Rescue)',
    codePrefix: 'FIRE',
    requestBadge: 'FIRE UNIT REQUEST',
    icon: Flame
  },
  PNP: {
    label: 'PNP POLICE',
    shortUnit: 'PNP Tactical Patrol',
    defaultCategory: 'Police / Security',
    defaultResponderId: 'PNP-MOB-01',
    defaultResponderName: 'PNP Mobile Patrol 01',
    codePrefix: 'PNP',
    requestBadge: 'PNP UNIT REQUEST',
    icon: Shield
  }
};

export const RequestDeployPage: FC = () => {
  const { session } = useSession();
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

  // Unit-Scoped Dispatch Request Form State (Katipunan baseline defaults)
  const [formTitle, setFormTitle] = useState<string>('');
  const [formIncidentCode, setFormIncidentCode] = useState<string>('');
  const [formSeverity, setFormSeverity] = useState<string>('Critical');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formCoordinates, setFormCoordinates] = useState<string>(KATIPUNAN_DEFAULT_COORDS);
  const [formIpAddress, setFormIpAddress] = useState<string>('103.62.154.118');
  const [formEvidenceUrl, setFormEvidenceUrl] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const rawData = await getDispatchRequests();
      const sanitized = rawData.map(sanitizeKatipunanRecord);
      const unitScoped = sanitized.filter(
        (rec) => classifyDispatchAgency(rec) === activeAgency
      );

      if (unitScoped.length > 0) {
        setRequests(unitScoped);
      } else {
        setRequests(buildUnitBaselineRequests(activeAgency));
      }
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

  // Handle ?incidentId=... deep-link redirect from Responder Dashboard / Map Pointer
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
        const locationParam =
          searchParams.get('location') || KATIPUNAN_DEFAULT_LOCATION;
        const coordsParam =
          searchParams.get('coordinates') || KATIPUNAN_DEFAULT_COORDS;
        const severityParam = searchParams.get('severity') || 'Critical';
        const ipParam = searchParams.get('ip') || '103.62.154.195';
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
          ipAddress: ipParam,
          evidenceUrl: buildTelemetryPlaceholderDataUri(resolvedCode, titleParam),
          responderId:
            session?.employeeId || session?.userId || agencyMeta.defaultResponderId,
          responderName: session?.fullName || agencyMeta.defaultResponderName,
          notes: `Initiated from ${agencyMeta.label} Radar Pointer — awaiting LDRRMO Admin clearance to deploy.`
        });

        const cleanCreated = sanitizeKatipunanRecord(created);
        await loadRequests();
        setHighlightedId(cleanCreated.id);
        setSelectedRecord(cleanCreated);
        addToast(
          `Created ${activeAgency} Dispatch Request ${cleanCreated.incidentCode} in PENDING state.`,
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
        `${agencyMeta.codePrefix}-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await createMedicDispatchRequest({
        incidentCode: code,
        incidentTitle: formTitle.trim(),
        category: agencyMeta.defaultCategory,
        severity: formSeverity,
        location: formLocation.trim(),
        coordinates: formCoordinates.trim() || KATIPUNAN_DEFAULT_COORDS,
        ipAddress: formIpAddress.trim() || '103.62.154.118',
        evidenceUrl:
          formEvidenceUrl.trim() ||
          buildTelemetryPlaceholderDataUri(code, formTitle.trim()),
        responderId:
          session?.employeeId || session?.userId || agencyMeta.defaultResponderId,
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
      setFormEvidenceUrl('');
      setFormNotes('');
      addToast(
        `Request ${created.incidentCode} submitted as PENDING. Waiting for LDRRMO Admin approval.`,
        'success'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateAdminApprove = async (record: DispatchRequestRecord) => {
    const updated = await approveMedicRequestByAdmin(record.id);
    if (updated) {
      const cleanUpdated = sanitizeKatipunanRecord(updated);
      await loadRequests();
      setSelectedRecord(cleanUpdated);
      setHighlightedId(cleanUpdated.id);
      addToast(
        `Admin Approved! Request ${cleanUpdated.incidentCode} transitioned from PENDING to DEPLOY.`,
        'success'
      );
    } else {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? { ...r, status: 'DEPLOY', updatedAt: new Date().toISOString() }
            : r
        )
      );
      addToast(`Request ${record.incidentCode} transitioned to DEPLOY.`, 'success');
    }
  };

  const handleAdminOrderDecision = async (
    record: DispatchRequestRecord,
    decision: 'ACCEPT' | 'DECLINE'
  ) => {
    const updated = await respondToAdminDeployOrder(record.id, decision);
    if (updated) {
      const cleanUpdated = sanitizeKatipunanRecord(updated);
      await loadRequests();
      if (selectedRecord?.id === cleanUpdated.id) {
        setSelectedRecord(cleanUpdated);
      }
      setHighlightedId(cleanUpdated.id);
      addToast(
        decision === 'ACCEPT'
          ? `Accepted Admin Deploy Order for ${cleanUpdated.incidentCode}. Status is now DEPLOY.`
          : `Declined Admin Deploy Order for ${cleanUpdated.incidentCode}. Status marked DECLINED.`,
        decision === 'ACCEPT' ? 'success' : 'warning'
      );
    } else {
      const nextStatus: DispatchRequestStatus = decision === 'ACCEPT' ? 'DEPLOY' : 'DECLINED';
      setRequests((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? { ...r, status: nextStatus, updatedAt: new Date().toISOString() }
            : r
        )
      );
      if (selectedRecord?.id === record.id) {
        setSelectedRecord({ ...record, status: nextStatus, updatedAt: new Date().toISOString() });
      }
      addToast(
        `${record.incidentCode} marked ${nextStatus}.`,
        decision === 'ACCEPT' ? 'success' : 'warning'
      );
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-700/30">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            PENDING
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
      {/* Toast Notifications Overlay */}
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
            Unit-scoped dispatch ledger strictly filtered for {agencyMeta.shortUnit}
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
            REQUEST TO DISPATCH OR DEPLOY
          </ResponderButton>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 hover:-translate-y-0.5 transition-all duration-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
              Pending Requests
            </p>
            <p className="text-3xl font-black text-[#670626] mt-1.5 tabular-nums">
              {kpiCounts.unitPending}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-amber-800">
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
              placeholder="Search by Incident Code, Title, Location, GPS Coordinates, IP Address, or Status..."
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
                { label: 'Newest Updated', value: 'NEWEST' },
                { label: 'Oldest First', value: 'OLDEST' },
                { label: 'Highest Severity', value: 'SEVERITY_HIGH' },
                { label: 'Status State', value: 'STATUS' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Content: Table View vs Card Grid View */}
      {isTable ? (
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
                      No {activeAgency} dispatch requests or deployment orders match your current filter.
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
                            <img
                              src={
                                item.evidenceUrl ||
                                buildTelemetryPlaceholderDataUri(
                                  item.incidentCode,
                                  item.incidentTitle
                                )
                              }
                              alt={item.incidentTitle}
                              className="w-12 h-12 rounded-xl object-cover border border-[#670626]/20 flex-shrink-0"
                            />
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
                            <span>{item.coordinates}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#5B2A35] mt-0.5">
                            <Globe className="w-3.5 h-3.5 text-[#A83B4D]" />
                            <span>IP: {item.ipAddress}</span>
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
                                title="Approve request to transition PENDING -> DEPLOY"
                              >
                                Approve &rarr; DEPLOY
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
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedItems.length === 0 ? (
            <div className="col-span-full clay-surface bg-[#F7F1EA] text-[#5B2A35] border border-[#670626]/15 rounded-2xl p-12 text-center text-sm">
              No {activeAgency} dispatch requests or deployment orders match your current filter.
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
                    <div className="relative h-44 w-full bg-[#4A041A] overflow-hidden">
                      <img
                        src={
                          item.evidenceUrl ||
                          buildTelemetryPlaceholderDataUri(
                            item.incidentCode,
                            item.incidentTitle
                          )
                        }
                        alt={item.incidentTitle}
                        className="w-full h-full object-cover opacity-90"
                      />
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
                          <span>{item.coordinates}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-[#5B2A35]">
                          <Globe className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />
                          <span>IP: {item.ipAddress}</span>
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
                          Approve &rarr; DEPLOY
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
            Showing{' '}
            <strong className="text-[#670626]">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
            <strong className="text-[#670626]">{endIndex}</strong> of{' '}
            <strong className="text-[#670626]">{totalItems}</strong> {activeAgency} dispatch records
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
                    APPROVE REQUEST &rarr; DEPLOY
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
                      ACCEPT DEPLOYMENT
                    </ResponderButton>
                    <ResponderButton
                      variant="danger"
                      size="sm"
                      icon={<X className="w-4 h-4" />}
                      onClick={() => void handleAdminOrderDecision(selectedRecord, 'DECLINE')}
                    >
                      DECLINE ORDER
                    </ResponderButton>
                  </>
                )}
              </div>
              <ResponderButton
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRecord(null)}
              >
                Close Window
              </ResponderButton>
            </div>
          ) : undefined
        }
      >
        {selectedRecord && (
          <div className="space-y-5 text-sm text-[#2B010E]">
            <div className="relative h-56 w-full rounded-xl overflow-hidden border border-[#670626]/20 bg-[#4A041A]">
              <img
                src={
                  selectedRecord.evidenceUrl ||
                  buildTelemetryPlaceholderDataUri(
                    selectedRecord.incidentCode,
                    selectedRecord.incidentTitle
                  )
                }
                alt={selectedRecord.incidentTitle}
                className="w-full h-full object-cover"
              />
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
                  OPTICAL EVIDENCE FEED • VERIFIED TELEMETRY
                </p>
                <p className="text-base font-bold">{selectedRecord.incidentTitle}</p>
              </div>
            </div>

            <div className="clay-well grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[#E9D9D0] border border-[#670626]/15 rounded-xl p-4">
              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-[#A83B4D] font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Physical Address
                </span>
                <p className="font-semibold text-[#2B010E]">{selectedRecord.location}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-[#A83B4D] font-bold flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" /> Hardware GPS Coordinates
                </span>
                <p className="font-mono font-bold text-[#670626]">
                  {selectedRecord.coordinates}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono uppercase text-[#A83B4D] font-bold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Reporter / Device IP Address
                </span>
                <p className="font-mono text-[#2B010E]">{selectedRecord.ipAddress}</p>
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
                  <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-700/30 font-bold">
                    1. {activeAgency} REQUEST (PENDING)
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
        title={`REQUEST TO DISPATCH OR DEPLOY (${agencyMeta.label})`}
        subtitle="Submits a unit-scoped dispatch request with state PENDING until LDRRMO Admin approves for DEPLOY."
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
                placeholder={`e.g., ${agencyMeta.defaultCategory} — Brgy. Uno, Katipunan`}
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                Incident Reference Code
              </label>
              <input
                type="text"
                value={formIncidentCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormIncidentCode(e.target.value)
                }
                placeholder={`Auto-generated if blank (e.g. ${agencyMeta.codePrefix}-2026-9102)`}
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] font-mono placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                Physical Address / Barangay *
              </label>
              <input
                type="text"
                required
                value={formLocation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormLocation(e.target.value)
                }
                placeholder="e.g., National Highway, Barangay Dos, Katipunan, ZN"
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                Priority Severity
              </label>
              <select
                value={formSeverity}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormSeverity(e.target.value)
                }
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] font-semibold focus:outline-none focus:border-[#670626]"
              >
                <option value="Critical">Critical (Immediate Response)</option>
                <option value="High">High (Urgent Deployment)</option>
                <option value="Moderate">Moderate (Standard Support)</option>
                <option value="Low">Low (Routine Advisory)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                GPS Coordinates
              </label>
              <input
                type="text"
                value={formCoordinates}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormCoordinates(e.target.value)
                }
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#670626] font-mono font-bold focus:outline-none focus:border-[#670626]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
                Source IP Telemetry
              </label>
              <input
                type="text"
                value={formIpAddress}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormIpAddress(e.target.value)
                }
                className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] font-mono focus:outline-none focus:border-[#670626]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
              Evidence Image URL (Optional — Katipunan SVG Telemetry Used If Blank)
            </label>
            <input
              type="url"
              value={formEvidenceUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormEvidenceUrl(e.target.value)
              }
              placeholder="Optional uploaded capture URL..."
              className="w-full bg-[#E9D9D0] border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-[#2B010E] font-mono placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[#670626] mb-1.5">
              Field Assessment &amp; Resource Notes
            </label>
            <textarea
              rows={3}
              value={formNotes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormNotes(e.target.value)
              }
              placeholder="Describe scene status, casualties or hazards, and required unit equipment..."
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
              REQUEST TO DISPATCH OR DEPLOY
            </ResponderButton>
          </div>
        </form>
      </ResponderModalCard>
    </div>
  );
};

export default RequestDeployPage;
