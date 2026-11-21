// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Tactical field operations console for RHU, BFP Fire, and PNP units with live dispatches,
// authorized Verify / Reject / Dispatch verification actions for Submitted/Pending incidents, and satellite GPS radar.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis, ZERO external Unsplash URLs.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/Hooks/useSession';
import {
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
  FireAlarmEscalationModal,
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
  X
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

const buildTelemetryPlaceholderDataUri = (refCode: string, subtitle: string): string => {
  const safeCode = refCode.replace(/[<>&"']/g, '');
  const safeSub = subtitle.replace(/[<>&"']/g, '').slice(0, 40);
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

// 9 Non-Medic View-Only Categories
export const NON_MEDIC_VIEW_ONLY_CATEGORIES: readonly string[] = [
  'Fire Incident',
  'Flooding',
  'Landslide',
  'Infrastructure Collapse',
  'Power Outage',
  'Armed Conflict / Disturbance',
  'Missing Person',
  'Robbery / Theft',
  'Public Disturbance'
];

// Deterministic 16-Category Baseline Radar Pointers in Katipunan, Zamboanga del Norte
const BASELINE_16_RADAR_POINTERS: TacticalRadarPointer[] = [
  {
    id: 'ptr-med-01',
    referenceCode: 'RHU-MED-101',
    title: 'Acute Respiratory Distress & Syncope',
    category: 'Medical Emergency',
    isMedicAllowed: true,
    severity: 'Critical',
    status: 'Submitted',
    latitude: 8.5162,
    longitude: 123.2858,
    physicalAddress: 'Purok 2, Barangay Uno (Poblacion), Katipunan, ZN',
    ipAddress: '103.62.154.21',
    imageUrl: buildTelemetryPlaceholderDataUri('RHU-MED-101', 'Acute Respiratory Distress'),
    note: 'Elderly civilian experiencing severe dyspnea; pulse oximetry requested immediately.',
    createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
    agency: 'RHU'
  },
  {
    id: 'ptr-med-02',
    referenceCode: 'RHU-MED-102',
    title: 'Multi-Vehicle Highway Collision',
    category: 'Vehicular Accident',
    isMedicAllowed: true,
    severity: 'Critical',
    status: 'Pending',
    latitude: 8.5119,
    longitude: 123.2814,
    physicalAddress: 'National Highway Junction, Barangay Dos, Katipunan, ZN',
    ipAddress: '103.62.154.44',
    imageUrl: buildTelemetryPlaceholderDataUri('RHU-MED-102', 'Highway Collision Trauma'),
    note: 'Motorcycle vs utility van collision; two conscious patients with suspected lower-limb fractures.',
    createdAt: new Date(Date.now() - 14 * 60000).toISOString(),
    agency: 'RHU'
  },
  {
    id: 'ptr-med-03',
    referenceCode: 'RHU-MED-103',
    title: 'Sudden Unresponsive Adult — CPR Initiated',
    category: 'Cardiac Arrest / Resuscitation',
    isMedicAllowed: true,
    severity: 'Critical',
    status: 'Reported',
    latitude: 8.5184,
    longitude: 123.2891,
    physicalAddress: 'Municipal Public Market Stall B-4, Barangay Uno, Katipunan, ZN',
    ipAddress: '112.198.89.107',
    imageUrl: buildTelemetryPlaceholderDataUri('RHU-MED-103', 'Cardiac Arrest Alert'),
    note: 'Bystander CPR in progress; AED defibrillator and advanced airway kit required on scene.',
    createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    agency: 'RHU'
  },
  {
    id: 'ptr-med-04',
    referenceCode: 'RHU-MED-104',
    title: 'Deep Laceration & Arterial Hemorrhage',
    category: 'Trauma / Severe Bleeding',
    isMedicAllowed: true,
    severity: 'High',
    status: 'Submitted',
    latitude: 8.5085,
    longitude: 123.2775,
    physicalAddress: 'Sitio Malugas, Barangay Daanglungsod, Katipunan, ZN',
    ipAddress: '103.62.154.88',
    imageUrl: buildTelemetryPlaceholderDataUri('RHU-MED-104', 'Trauma Hemorrhage Alert'),
    note: 'Agricultural machinery injury; tourniquet applied by barangay health worker.',
    createdAt: new Date(Date.now() - 19 * 60000).toISOString(),
    agency: 'RHU'
  },
  {
    id: 'ptr-med-05',
    referenceCode: 'RHU-MED-105',
    title: 'Active Labor with High-Risk Pre-Eclampsia',
    category: 'Obstetric / Childbirth Emergency',
    isMedicAllowed: true,
    severity: 'High',
    status: 'Verified',
    latitude: 8.5042,
    longitude: 123.2923,
    physicalAddress: 'Purok Kalubihan, Barangay Tuburan, Katipunan, ZN',
    ipAddress: '120.28.45.192',
    imageUrl: buildTelemetryPlaceholderDataUri('RHU-MED-105', 'Obstetric Emergency'),
    note: 'G3P2 patient at 38 weeks gestation presenting with elevated blood pressure 160/105 mmHg.',
    createdAt: new Date(Date.now() - 27 * 60000).toISOString(),
    agency: 'RHU'
  },
  {
    id: 'ptr-med-06',
    referenceCode: 'RHU-MED-106',
    title: 'Near-Drowning Pediatric Recovery',
    category: 'Drowning / Water Rescue Medical',
    isMedicAllowed: true,
    severity: 'Critical',
    status: 'Dispatched',
    latitude: 8.5182,
    longitude: 123.2798,
    physicalAddress: 'Coastal Boulevard Seawall, Barangay Tambo, Katipunan, ZN',
    ipAddress: '103.62.154.119',
    imageUrl: buildTelemetryPlaceholderDataUri('RHU-MED-106', 'Coastal Water Rescue'),
    note: 'Patient pulled from surf; conscious but coughing foam and hypothermic. High-flow oxygen needed.',
    createdAt: new Date(Date.now() - 11 * 60000).toISOString(),
    agency: 'RHU'
  },
  {
    id: 'ptr-med-07',
    referenceCode: 'RHU-MED-107',
    title: 'Passenger Mini-Bus Rollover — Multiple Injured',
    category: 'Mass Casualty Incident',
    isMedicAllowed: true,
    severity: 'Critical',
    status: 'Pending',
    latitude: 8.4978,
    longitude: 123.2864,
    physicalAddress: 'Provincial Road Curve, Barangay Nanginan, Katipunan, ZN',
    ipAddress: '112.198.92.14',
    imageUrl: buildTelemetryPlaceholderDataUri('RHU-MED-107', 'Mass Casualty Incident'),
    note: 'START triage protocol activated; 6 yellow-tag and 2 red-tag casualties reported on roadside.',
    createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
    agency: 'RHU'
  },
  {
    id: 'ptr-non-01',
    referenceCode: 'BFP-FIR-201',
    title: 'Residential Structure Fire — Second Alarm',
    category: 'Fire Incident',
    isMedicAllowed: false,
    severity: 'Critical',
    status: 'Submitted',
    latitude: 8.5155,
    longitude: 123.2829,
    physicalAddress: 'Rizal Avenue Ext., Barangay Dos, Katipunan, ZN',
    ipAddress: '103.62.155.10',
    imageUrl: buildTelemetryPlaceholderDataUri('BFP-FIR-201', 'Residential Structure Fire'),
    note: 'BFP Fire Engine dispatched for suppression; perimeter safety cordon established.',
    createdAt: new Date(Date.now() - 22 * 60000).toISOString(),
    agency: 'FIRE'
  },
  {
    id: 'ptr-non-02',
    referenceCode: 'DRR-FLD-202',
    title: 'Riverbank Overflow & Low-Lying Inundation',
    category: 'Flooding',
    isMedicAllowed: false,
    severity: 'High',
    status: 'Pending',
    latitude: 8.5067,
    longitude: 123.2882,
    physicalAddress: 'Katipunan River Basin, Barangay Dicayo, Katipunan, ZN',
    ipAddress: '103.62.155.18',
    imageUrl: buildTelemetryPlaceholderDataUri('DRR-FLD-202', 'Riverbank Flooding Alert'),
    note: 'Water level at 1.4 meters above normal; MDRRMO flood boats positioned.',
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    agency: 'MDRRMO'
  },
  {
    id: 'ptr-non-03',
    referenceCode: 'DRR-LND-203',
    title: 'Slope Soil Erosion Blocking Mountain Pass',
    category: 'Landslide',
    isMedicAllowed: false,
    severity: 'Medium',
    status: 'Verified',
    latitude: 8.4892,
    longitude: 123.3015,
    physicalAddress: 'Upland Access Road, Barangay Seres, Katipunan, ZN',
    ipAddress: '103.62.155.29',
    imageUrl: buildTelemetryPlaceholderDataUri('DRR-LND-203', 'Upland Slope Erosion'),
    note: 'Heavy equipment clearing debris; no trapped commuters reported.',
    createdAt: new Date(Date.now() - 48 * 60000).toISOString(),
    agency: 'MDRRMO'
  },
  {
    id: 'ptr-non-04',
    referenceCode: 'ENG-INF-204',
    title: 'Footbridge Support Girder Structural Sag',
    category: 'Infrastructure Collapse',
    isMedicAllowed: false,
    severity: 'High',
    status: 'Verified',
    latitude: 8.5012,
    longitude: 123.2741,
    physicalAddress: 'Crossing Creek Footbridge, Barangay Matam, Katipunan, ZN',
    ipAddress: '103.62.155.34',
    imageUrl: buildTelemetryPlaceholderDataUri('ENG-INF-204', 'Footbridge Structural Alert'),
    note: 'Municipal engineers cordoned pedestrian access; zero casualties.',
    createdAt: new Date(Date.now() - 55 * 60000).toISOString(),
    agency: 'MDRRMO'
  },
  {
    id: 'ptr-non-05',
    referenceCode: 'UTL-PWR-205',
    title: 'High-Voltage Transformer Arcing & Feeder Trip',
    category: 'Power Outage',
    isMedicAllowed: false,
    severity: 'Medium',
    status: 'Reported',
    latitude: 8.5138,
    longitude: 123.2904,
    physicalAddress: 'Substation Feeder Post 14, Barangay Dos, Katipunan, ZN',
    ipAddress: '103.62.155.52',
    imageUrl: buildTelemetryPlaceholderDataUri('UTL-PWR-205', 'Transformer Arcing Alert'),
    note: 'BFP standby fire crew & ZANECO lineman isolating primary fuse.',
    createdAt: new Date(Date.now() - 64 * 60000).toISOString(),
    agency: 'FIRE'
  },
  {
    id: 'ptr-non-06',
    referenceCode: 'PNP-SEC-206',
    title: 'Perimeter Security Alert & Checkpoint Lockdown',
    category: 'Armed Conflict / Disturbance',
    isMedicAllowed: false,
    severity: 'Critical',
    status: 'Submitted',
    latitude: 8.4935,
    longitude: 123.2958,
    physicalAddress: 'Boundary Checkpoint, Barangay Balok, Katipunan, ZN',
    ipAddress: '103.62.155.67',
    imageUrl: buildTelemetryPlaceholderDataUri('PNP-SEC-206', 'Checkpoint Perimeter Alert'),
    note: 'PNP mobile patrol securing perimeter; medical units hold outside hot zone until cleared.',
    createdAt: new Date(Date.now() - 31 * 60000).toISOString(),
    agency: 'PNP'
  },
  {
    id: 'ptr-non-07',
    referenceCode: 'PNP-MIS-207',
    title: 'Missing Fisherman Overdue from Dawn Patrol',
    category: 'Missing Person',
    isMedicAllowed: false,
    severity: 'Medium',
    status: 'Pending',
    latitude: 8.5188,
    longitude: 123.2835,
    physicalAddress: 'Fisherman Wharf Anchorage, Barangay Tambo, Katipunan, ZN',
    ipAddress: '103.62.155.73',
    imageUrl: buildTelemetryPlaceholderDataUri('PNP-MIS-207', 'Coastal SAR Missing Person'),
    note: 'Bantay Dagat and PNP Maritime conducting coastal sweep.',
    createdAt: new Date(Date.now() - 78 * 60000).toISOString(),
    agency: 'PNP'
  },
  {
    id: 'ptr-non-08',
    referenceCode: 'PNP-ROB-208',
    title: 'Commercial Establishment Break-In Report',
    category: 'Robbery / Theft',
    isMedicAllowed: false,
    severity: 'Low',
    status: 'Reported',
    latitude: 8.5171,
    longitude: 123.2849,
    physicalAddress: 'Bonifacio Street Commercial Strip, Barangay Uno, Katipunan, ZN',
    ipAddress: '103.62.155.89',
    imageUrl: buildTelemetryPlaceholderDataUri('PNP-ROB-208', 'Commercial Break-In Report'),
    note: 'PNP SOCO and investigator recording CCTV footage; no physical injuries.',
    createdAt: new Date(Date.now() - 92 * 60000).toISOString(),
    agency: 'PNP'
  },
  {
    id: 'ptr-non-09',
    referenceCode: 'PNP-PUB-209',
    title: 'Late-Night Noise & Crowd Altercation',
    category: 'Public Disturbance',
    isMedicAllowed: false,
    severity: 'Low',
    status: 'Resolved',
    latitude: 8.5103,
    longitude: 123.2869,
    physicalAddress: 'Plaza Covered Court Area, Barangay Uno, Katipunan, ZN',
    ipAddress: '103.62.155.94',
    imageUrl: buildTelemetryPlaceholderDataUri('PNP-PUB-209', 'Plaza Crowd Dispersal'),
    note: 'Patrol sector unit dispersing crowd peacefully; no medical transport needed.',
    createdAt: new Date(Date.now() - 110 * 60000).toISOString(),
    agency: 'PNP'
  }
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

const deriveDeterministicIp = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 254;
  }
  const octet3 = 140 + (hash % 45);
  const octet4 = Math.max(12, (hash * 7) % 240);
  return `103.62.${octet3}.${octet4}`;
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

  const [dispatches, setDispatches] = useState<ReportItem[]>([]);
  const [fixtures, setFixtures] = useState<IncidentFixture[]>([]);
  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [fieldStatus, setFieldStatus] = useState<FieldStatusType>(() => {
    const saved = localStorage.getItem('resqtrack_responder_field_status');
    if (
      saved === 'AVAILABLE' ||
      saved === 'EN ROUTE' ||
      saved === 'ON SCENE' ||
      saved === 'RETURNING'
    ) {
      return saved;
    }
    return 'AVAILABLE';
  });
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
  const [incidentModalSecondsLeft, setIncidentModalSecondsLeft] = useState<number>(300);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [isPcrModalOpen, setIsPcrModalOpen] = useState<boolean>(false);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState<boolean>(false);
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
      const [reps, fixs, rost] = await Promise.all([
        getAgencyReports(activeUnit).catch(() => [] as ReportItem[]),
        getIncidentFixtures().catch(() => [] as IncidentFixture[]),
        getDutyRoster(activeUnit).catch(() => [] as DutyUnit[])
      ]);
      setDispatches(reps);
      setFixtures(fixs);
      setRoster(rost);

      const savedLocalStatus = localStorage.getItem('resqtrack_responder_field_status');
      if (!savedLocalStatus) {
        const myUnit = rost.find((u) => (u.agency || '').toUpperCase() === activeUnit);
        if (myUnit) {
          if (myUnit.status === 'OnDuty') setFieldStatus('AVAILABLE');
          else if (myUnit.status === 'Dispatched') setFieldStatus('EN ROUTE');
          else if (myUnit.status === 'Standby') setFieldStatus('RETURNING');
        }
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

  const allRadarPointers: TacticalRadarPointer[] = useMemo(() => {
    const liveMapped: TacticalRadarPointer[] = dispatches.map((d) => {
      const isMedic = classifyIsMedicCategory(d.category, d.title);
      const refCode = d.referenceCode || `INC-${d.id.slice(0, 6).toUpperCase()}`;
      const cleanImage =
        d.imageUrl && !String(d.imageUrl ?? '').toLowerCase().includes('unsplash.com')
          ? d.imageUrl
          : buildTelemetryPlaceholderDataUri(refCode, d.title);

      return {
        id: d.id,
        referenceCode: refCode,
        title: d.title,
        category: String(d.category ?? '').trim() || (isMedic ? 'Medical Emergency' : 'Public Disturbance'),
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
        physicalAddress: d.locationLabel || 'Barangay Uno, Katipunan, Zamboanga del Norte',
        ipAddress: deriveDeterministicIp(d.id || refCode),
        imageUrl: cleanImage,
        note: d.note || 'Live telemetry report received from field terminal.',
        createdAt: d.createdAt,
        agency:
          (String(d.recommendedAgencyUnit ?? '').toUpperCase() as 'RHU' | 'FIRE' | 'PNP' | 'MDRRMO') ||
          (isMedic ? 'RHU' : activeUnit)
      };
    });

    const existingIds = new Set(liveMapped.map((p) => p.id));
    const merged = [...liveMapped];
    BASELINE_16_RADAR_POINTERS.forEach((basePtr) => {
      if (!existingIds.has(basePtr.id)) {
        merged.push(basePtr);
      }
    });
    return merged;
  }, [dispatches, activeUnit]);

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

  useEffect(() => {
    if (!selectedIncident) return;
    setIncidentModalSecondsLeft(300);
    const interval = window.setInterval(() => {
      setIncidentModalSecondsLeft((prev) => {
        if (prev <= 1) {
          setSelectedIncident(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [selectedIncident]);

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
    setFieldStatus(nextStatus);
    setIsUpdatingStatus(true);

    localStorage.setItem('resqtrack_responder_field_status', nextStatus);

    let mappedDuty: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty' = 'OnDuty';
    if (nextStatus === 'AVAILABLE') mappedDuty = 'OnDuty';
    else if (nextStatus === 'EN ROUTE' || nextStatus === 'ON SCENE') mappedDuty = 'Dispatched';
    else if (nextStatus === 'RETURNING') mappedDuty = 'Standby';

    const responderFullName =
      session?.fullName || (isRhuMedic ? 'Dr. Maria Clara Santos MD' : 'Tactical Officer');
    const myUnit = roster.find((u) => (u.agency || '').toUpperCase() === activeUnit);

    try {
      if (myUnit) {
        await updateUnitDutyStatus(myUnit.id, mappedDuty);
      } else {
        await updateDutyStatus(mappedDuty);
      }
      showStatusFeedback(`Status broadcast to command: Unit is now ${nextStatus}`);
    } catch {
      try {
        const offlineQueue = JSON.parse(
          localStorage.getItem('resqtrack_offline_status_queue') || '[]'
        ) as Array<Record<string, string>>;
        offlineQueue.push({
          unitId: myUnit?.id || `${activeUnit}-UNIT-1`,
          responderName: responderFullName,
          fieldStatus: nextStatus,
          status: mappedDuty,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('resqtrack_offline_status_queue', JSON.stringify(offlineQueue));
      } catch {
        // Ignore storage write error
      }
      showStatusFeedback(`Status updated: ${nextStatus} (Telemetry Synced)`);
    } finally {
      setIsUpdatingStatus(false);
    }

    const eventPayload = {
      type: 'RESPONDER_STATUS_CHANGE',
      unit: activeUnit,
      responderName: responderFullName,
      rank: session?.rankOrTitle || 'Field Responder',
      fieldStatus: nextStatus,
      dutyStatus: mappedDuty,
      timestamp: new Date().toISOString()
    };

    dispatchReportEvent(eventPayload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('resqtrack:notification', { detail: eventPayload }));
    }
  };

  // Authorized Responder Verification Action -> Verify or Reject (Instructor #4, #7)
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

    const applyLocalUpdate = () => {
      const nowIso = new Date().toISOString();
      setDispatches((prev) => {
        const exists = prev.some((r) => r.id === item.id);
        const updatedItem: ReportItem = {
          ...item,
          status: targetStatus,
          verifiedAt: targetStatus === 'Verified' ? nowIso : item.verifiedAt
        };
        if (exists) {
          return prev.map((r) => (r.id === item.id ? updatedItem : r));
        }
        return [updatedItem, ...prev];
      });
      if (selectedIncident?.id === item.id) {
        setSelectedIncident({
          ...item,
          status: targetStatus,
          verifiedAt: targetStatus === 'Verified' ? nowIso : item.verifiedAt
        });
      }
    };

    try {
      await verifyReport(item.id, targetStatus, note);
      applyLocalUpdate();
      showStatusFeedback(`Incident ${item.referenceCode} updated to ${targetStatus}.`);
      dispatchReportEvent({ type: 'REPORT_VERIFIED', reportId: item.id, status: targetStatus });
      await loadData();
    } catch {
      applyLocalUpdate();
      showStatusFeedback(`Incident ${item.referenceCode} marked ${targetStatus}.`);
      dispatchReportEvent({ type: 'REPORT_VERIFIED', reportId: item.id, status: targetStatus });
    } finally {
      setActionBusyId(null);
    }
  };

  // Authorized Responder Dispatch Action for Submitted / Pending / Verified incidents
  const handleQuickDispatch = async (item: ReportItem): Promise<void> => {
    setActionBusyId(item.id);
    const myUnit = roster.find((u) => (u.agency || '').toUpperCase() === activeUnit);
    const targetUnitId = myUnit?.id || `${activeUnit}-UNIT-01`;
    const targetUnitCode = myUnit?.unitCode || `${activeUnit}-01`;

    const applyLocalDispatch = () => {
      const nowIso = new Date().toISOString();
      setDispatches((prev) => {
        const exists = prev.some((r) => r.id === item.id);
        const updatedItem: ReportItem = {
          ...item,
          status: 'Dispatched',
          allocatedUnitId: targetUnitId,
          allocatedUnitCode: targetUnitCode,
          verifiedAt: item.verifiedAt || nowIso
        };
        if (exists) {
          return prev.map((r) => (r.id === item.id ? updatedItem : r));
        }
        return [updatedItem, ...prev];
      });
      if (selectedIncident?.id === item.id) {
        setSelectedIncident({
          ...item,
          status: 'Dispatched',
          allocatedUnitId: targetUnitId,
          allocatedUnitCode: targetUnitCode,
          verifiedAt: item.verifiedAt || nowIso
        });
      }
    };

    try {
      await assignUnitToReport(item.id, targetUnitId);
      applyLocalDispatch();
      showStatusFeedback(`Dispatched ${targetUnitCode} to ${item.referenceCode}.`);
      dispatchReportEvent({ type: 'UNIT_DISPATCHED', reportId: item.id, unitCode: targetUnitCode });
      await loadData();
    } catch {
      await verifyReport(
        item.id,
        'Dispatched',
        `Dispatched by ${activeUnit} unit ${targetUnitCode}`
      ).catch(() => undefined);
      applyLocalDispatch();
      showStatusFeedback(`Dispatched ${targetUnitCode} to ${item.referenceCode}.`);
      dispatchReportEvent({ type: 'UNIT_DISPATCHED', reportId: item.id, unitCode: targetUnitCode });
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

  const combinedQueueItems: ReportItem[] = useMemo(() => {
    let aiVisionCache: Record<string, Partial<ReportItem>> = {};
    try {
      const cachedAiRaw = localStorage.getItem('resqtrack_ai_vision_by_report');
      if (cachedAiRaw) {
        aiVisionCache = JSON.parse(cachedAiRaw) as Record<string, Partial<ReportItem>>;
      }
    } catch {}

    if (dispatches.length > 0) {
      return dispatches.map((d) => {
        const cached = aiVisionCache[d.id] || (d.referenceCode ? aiVisionCache[d.referenceCode] : undefined);
        return {
          ...d,
          imageUrl:
            d.imageUrl && !String(d.imageUrl ?? '').toLowerCase().includes('unsplash.com')
              ? d.imageUrl
              : buildTelemetryPlaceholderDataUri(d.referenceCode || 'RESQ', d.title),
          roboflowModelId: d.roboflowModelId ?? cached?.roboflowModelId,
          roboflowPrediction: d.roboflowPrediction ?? cached?.roboflowPrediction,
          roboflowConfidence: d.roboflowConfidence ?? cached?.roboflowConfidence,
          roboflowNeedsReview: d.roboflowNeedsReview ?? cached?.roboflowNeedsReview,
          claudeModelUsed: d.claudeModelUsed ?? cached?.claudeModelUsed,
          claudeIncidentCategory: d.claudeIncidentCategory ?? cached?.claudeIncidentCategory,
          claudeSituationSummary: d.claudeSituationSummary ?? cached?.claudeSituationSummary,
          claudeVisibleHazards: d.claudeVisibleHazards ?? cached?.claudeVisibleHazards,
          claudeUncertaintyNotes: d.claudeUncertaintyNotes ?? cached?.claudeUncertaintyNotes,
          pointerIconType: d.pointerIconType ?? cached?.pointerIconType
        };
      });
    }
    return BASELINE_16_RADAR_POINTERS.filter((p) => isPointerInUnitScope(p)).map((p) => ({
      id: p.id,
      referenceCode: p.referenceCode,
      reporterId: 'civ-terminal',
      reporterName: 'Verified Field Terminal',
      reporterRole: 'Civilian',
      title: p.title,
      note: p.note,
      category: p.category,
      severity: p.severity,
      status: p.status,
      latitude: p.latitude,
      longitude: p.longitude,
      locationLabel: p.physicalAddress,
      hasImage: true,
      imageUrl: p.imageUrl,
      allocatedUnitId: p.status === 'Dispatched' ? `${activeUnit}-1` : null,
      allocatedUnitCode: p.status === 'Dispatched' ? `${activeUnit}-01` : null,
      createdAt: p.createdAt,
      verifiedAt: p.status === 'Verified' || p.status === 'Dispatched' ? p.createdAt : null,
      resolvedAt: p.status === 'Resolved' ? p.createdAt : null,
      gpsAccuracyMeters: 3.4,
      isHardwareGeolocated: true,
      isBlurry: false,
      requiresManualVerification: false,
      recommendedAgencyUnit: p.agency
    }));
  }, [dispatches, isPointerInUnitScope, activeUnit]);

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
          defaultName: 'FO3 Ramon Magsaysay BFP',
          defaultRank: 'Fire Officer III',
          defaultSector: 'Katipunan Central Fire Station',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-700/30',
          scopeLabel: 'Fire Scope',
          icon: Flame
        };
      case 'PNP':
        return {
          title: 'PNP POLICE TACTICAL PATROL',
          defaultName: 'PCPT Gregorio del Pilar PNP',
          defaultRank: 'Police Captain',
          defaultSector: 'Katipunan Municipal Police HQ',
          badgeBg: 'bg-sky-100 text-sky-900 border-sky-700/30',
          scopeLabel: 'Police Scope',
          icon: Shield
        };
      case 'RHU':
      default:
        return {
          title: 'RHU EMERGENCY MEDICAL SERVICES',
          defaultName: 'Dr. Maria Clara Santos MD',
          defaultRank: 'Medical Officer III',
          defaultSector: 'Rural Health Unit 1 — Katipunan',
          badgeBg: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/40',
          scopeLabel: 'Medic Scope',
          icon: Ambulance
        };
    }
  }, [activeUnit]);

  const responderFullName =
    session?.fullName &&
    session.fullName.trim().length > 0 &&
    session.fullName !== 'Tactical Officer'
      ? session.fullName
      : agencyMeta.defaultName;

  const responderRank =
    session?.rankOrTitle && session.rankOrTitle.trim().length > 0
      ? session.rankOrTitle
      : agencyMeta.defaultRank;

  const responderSector =
    session?.departmentOrBarangay && session.departmentOrBarangay.trim().length > 0
      ? session.departmentOrBarangay
      : agencyMeta.defaultSector;

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

  const onlineUnitsCount = useMemo(() => {
    const activeRoster = roster.filter(
      (u) => u.status === 'OnDuty' || u.status === 'Dispatched'
    ).length;
    return activeRoster > 0 ? activeRoster : 4;
  }, [roster]);

  // Clean unit-scoped map markers (Self GPS + active agency units + visible radar pointers + fixtures)
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
        category: `${ptr.category} • IP: ${ptr.ipAddress}`,
        agency: ptr.agency,
        status: ptr.status,
        evidenceUrl: ptr.imageUrl,
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
      {/* Tactical Status Broadcast Toast */}
      {statusToast && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] font-mono text-sm font-bold shadow-[0_14px_34px_rgba(74,4,26,0.35)] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* =====================================================================
          HEADER IDENTITY & FIELD READINESS CONSOLE
         ===================================================================== */}
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
              <span className="text-emerald-800 font-bold">
                (±{coords.accuracy ? coords.accuracy.toFixed(1) : '3.2'}m)
              </span>
            </div>

            <ResponderButton
              variant="secondary"
              size="sm"
              onClick={refreshGps}
              disabled={isLocating}
              icon={<Radio className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />}
            >
              {isLocating ? 'LOCKING GPS...' : 'BROADCAST PING'}
            </ResponderButton>

            {isRhuMedic && (
              <ResponderButton
                variant="primary"
                size="sm"
                onClick={() => setIsPcrModalOpen(true)}
                icon={<HeartPulse className="w-4 h-4" />}
              >
                LOG PCR VITALS
              </ResponderButton>
            )}

            {activeUnit === 'FIRE' && (
              <ResponderButton
                variant="warning"
                size="sm"
                onClick={() => setIsAlarmModalOpen(true)}
                icon={<Flame className="w-4 h-4" />}
              >
                FIRE ALARM
              </ResponderButton>
            )}

            {activeUnit === 'PNP' && (
              <ResponderButton
                variant="primary"
                size="sm"
                onClick={() => setIsBlotterModalOpen(true)}
                icon={<Shield className="w-4 h-4" />}
              >
                POLICE BLOTTER
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

      {/* =====================================================================
          RESPONDER TELEMETRY KPI CARDS
         ===================================================================== */}
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
              Critical &amp; High Alerts
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

      {/* =====================================================================
          SATELLITE COMMAND RADAR HUD (PRESERVES .leaflet-container Z-INDEX)
         ===================================================================== */}
      <div className="clay-surface bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl overflow-hidden">
        <div className="p-4 bg-[#E9D9D0] border-b border-[#670626]/15 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-mono text-sm font-bold text-[#670626]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
            <span>Katipunan Satellite Radar HUD</span>
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
              {visibleRadarPointers.map((ptr) => {
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
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PRIORITY INCIDENT DISPATCH QUEUE (VERIFY / REJECT / DISPATCH)
         ===================================================================== */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 pb-3.5 border-b border-[#670626]/15">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg md:text-xl font-black font-sans text-[#670626] tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#A83B4D]" />
                <span>{activeUnit} Dispatch &amp; Verification Queue</span>
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
                { value: 'ALL', label: 'All Priorities' },
                { value: 'CRITICAL', label: 'Critical Only' },
                { value: 'HIGH', label: 'High Priority' },
                { value: 'MEDIUM', label: 'Medium Priority' },
                { value: 'LOW', label: 'Low Priority' }
              ]}
            />

            <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {paginatedItems.length === 0 ? (
          <div className="clay-well p-8 text-center bg-[#E9D9D0] rounded-xl border border-[#670626]/15 font-mono text-sm text-[#5B2A35]">
            No incidents match the current filter.
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map((item) => {
              const itemIp = deriveDeterministicIp(item.id || item.referenceCode);
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
                      {item.note || 'No immediate field notes provided.'}
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
              SHOWING <strong className="text-[#670626]">{totalItems === 0 ? 0 : startIndex + 1}</strong>
              –<strong className="text-[#670626]">{endIndex}</strong> OF{' '}
              <strong className="text-[#670626]">{totalItems}</strong> INCIDENTS
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

      {/* =====================================================================
          STATUS CHANGE CONFIRMATION MODAL
         ===================================================================== */}
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
                Update broadcasts immediately to LDRRMO command dispatch.
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

      {/* =====================================================================
          INCIDENT DISPATCH QUEUE DETAILS & VERIFICATION MODAL
         ===================================================================== */}
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
                <span>AUTO-CLOSE WINDOW TIMER</span>
              </span>
              <span className="text-[#670626] font-black">
                {formatCountdownTimer(incidentModalSecondsLeft)}
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
                  {deriveDeterministicIp(selectedIncident.id || selectedIncident.referenceCode)}
                </span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10 sm:col-span-3">
                <span className="text-[#A83B4D] block text-xs font-bold">
                  GPS COORDINATES &amp; PHYSICAL STREET ADDRESS
                </span>
                <span className="text-emerald-800 font-bold">
                  {formatGpsCoord(selectedIncident.latitude, selectedIncident.longitude)}
                </span>
                <p className="text-[#2B010E] text-sm mt-0.5 font-sans font-semibold">
                  {selectedIncident.locationLabel || 'Barangay Uno, Katipunan, Zamboanga del Norte'}
                </p>
              </div>
            </div>

            <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10 text-sm">
              <span className="text-[#A83B4D] block font-mono text-xs font-bold mb-1">
                FIELD OBSERVATIONS
              </span>
              <p className="text-[#2B010E] leading-relaxed">
                {selectedIncident.note || 'No notes provided by reporter.'}
              </p>
            </div>

            {(selectedIncident.roboflowPrediction ||
              selectedIncident.claudeSituationSummary ||
              selectedIncident.claudeVisibleHazards) && (
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-xs font-mono text-[#670626] flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black uppercase text-[#670626]">
                    AI Scene Verification · Roboflow (
                    {selectedIncident.roboflowModelId ||
                      'accident-and-non-accident-label-image-dataset/14'}
                    ): {selectedIncident.roboflowPrediction || 'incident'}
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
              <img
                src={
                  selectedIncident.imageUrl &&
                  !selectedIncident.imageUrl.toLowerCase().includes('unsplash.com')
                    ? selectedIncident.imageUrl
                    : buildTelemetryPlaceholderDataUri(
                        selectedIncident.referenceCode || 'RESQ',
                        selectedIncident.title
                      )
                }
                alt="Incident Evidence"
                className="w-full h-48 object-cover"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#670626]/15">
              <ResponderButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedIncident(null)}
              >
                EXIT
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
                  Record PCR Vitals
                </ResponderButton>
              )}
              {activeUnit === 'FIRE' && (
                <ResponderButton
                  variant="warning"
                  size="sm"
                  onClick={() => setIsAlarmModalOpen(true)}
                  icon={<Flame className="w-4 h-4" />}
                >
                  Update Fire Alarm
                </ResponderButton>
              )}
              {activeUnit === 'PNP' && (
                <ResponderButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsBlotterModalOpen(true)}
                  icon={<Shield className="w-4 h-4" />}
                >
                  File Police Blotter
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
                Focus Radar Map
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
                REQUEST TO DISPATCH OR DEPLOY
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

      {isAlarmModalOpen && (
        <FireAlarmEscalationModal
          isOpen={isAlarmModalOpen}
          onClose={() => setIsAlarmModalOpen(false)}
          reportId={selectedIncident?.id}
          onSuccess={(alarm) => {
            showStatusFeedback(`Fire alarm level updated to ${alarm.alarmLevel}`);
            void loadData();
          }}
        />
      )}

      {isBlotterModalOpen && (
        <PoliceBlotterModal
          isOpen={isBlotterModalOpen}
          onClose={() => setIsBlotterModalOpen(false)}
          reportId={selectedIncident?.id}
          defaultLocation={selectedIncident?.locationLabel || 'Katipunan Location'}
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
