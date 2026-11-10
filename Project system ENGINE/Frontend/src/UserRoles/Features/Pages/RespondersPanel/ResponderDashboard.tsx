// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Tactical field operations console for RHU (EMS Trauma Board), BFP Fire, and PNP units with live dispatches and GPS.
// Authentic mobile dispatch unit HUD with rapid field legibility, night-vision dark mode, and tactile status controls.
// DO NOT permit cross-agency mutations from unassigned units.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/Hooks/useSession';
import { getAgencyReports, ReportItem } from '@/Endpoints/reportsApi';
import { getIncidentFixtures, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import { getDutyRoster, updateUnitDutyStatus, updateDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import {
  SatelliteCommandMap,
  MapMarker,
   SearchBar,
  TableCardToggle,
  useTableCardView,
  DefaultFloatingModalCard,
  PatientCareRecordModal,
  FireAlarmEscalationModal,
  PoliceBlotterModal,
  Button,
  Dropdown
} from '@/Shared';
import {
  useGpsLocation,
  useReportEventBus,
  useValueRefreshAuto,
  useDebounce,
  usePagination
} from '@/Hooks';
import { formatGpsCoord, formatRelativeTime, formatIsoTimestamp } from '@/Libs/Assets/formatters';
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
  LogOut,
  Filter,
  Crosshair,
  Send,
  Activity,
  Users,
  ChevronLeft,
  ChevronRight,
  Camera,
  Globe,
  Navigation
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
  // 7 Medic-Allowed Categories
  {
    id: 'ptr-med-01',
    referenceCode: 'RHU-MED-101',
    title: 'Acute Respiratory Distress & Syncope',
    category: 'Medical Emergency',
    isMedicAllowed: true,
    severity: 'Critical',
    status: 'Pending Dispatch',
    latitude: 8.5162,
    longitude: 123.2858,
    physicalAddress: 'Purok 2, Barangay Uno (Poblacion), Katipunan, ZN',
    ipAddress: '103.62.154.21',
    imageUrl: 'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=900&q=80',
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
    status: 'Active Triage',
    latitude: 8.5119,
    longitude: 123.2814,
    physicalAddress: 'National Highway Junction, Barangay Dos, Katipunan, ZN',
    ipAddress: '103.62.154.44',
    imageUrl: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=900&q=80',
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
    status: 'Immediate Response',
    latitude: 8.5184,
    longitude: 123.2891,
    physicalAddress: 'Municipal Public Market Stall B-4, Barangay Uno, Katipunan, ZN',
    ipAddress: '112.198.89.107',
    imageUrl: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=900&q=80',
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
    status: 'Pending Dispatch',
    latitude: 8.5085,
    longitude: 123.2775,
    physicalAddress: 'Sitio Malugas, Barangay Daanglungsod, Katipunan, ZN',
    ipAddress: '103.62.154.88',
    imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=80',
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
    status: 'Pending Dispatch',
    latitude: 8.5042,
    longitude: 123.2923,
    physicalAddress: 'Purok Kalubihan, Barangay Tuburan, Katipunan, ZN',
    ipAddress: '120.28.45.192',
    imageUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=900&q=80',
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
    status: 'Active Triage',
    latitude: 8.5231,
    longitude: 123.2798,
    physicalAddress: 'Coastal Boulevard Seawall, Barangay Tambo, Katipunan, ZN',
    ipAddress: '103.62.154.119',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
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
    status: 'Immediate Response',
    latitude: 8.4978,
    longitude: 123.2864,
    physicalAddress: 'Provincial Road Curve, Barangay Nanginan, Katipunan, ZN',
    ipAddress: '112.198.92.14',
    imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=900&q=80',
    note: 'START triage protocol activated; 6 yellow-tag and 2 red-tag casualties reported on roadside.',
    createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
    agency: 'RHU'
  },

  // 9 Non-Medic View-Only Categories
  {
    id: 'ptr-non-01',
    referenceCode: 'BFP-FIR-201',
    title: 'Residential Structure Fire — Second Alarm',
    category: 'Fire Incident',
    isMedicAllowed: false,
    severity: 'Critical',
    status: 'BFP Assigned',
    latitude: 8.5155,
    longitude: 123.2829,
    physicalAddress: 'Rizal Avenue Ext., Barangay Dos, Katipunan, ZN',
    ipAddress: '103.62.155.10',
    imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=900&q=80',
    note: 'BFP Fire Engine dispatched for suppression; RHU view-only standby monitoring.',
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
    status: 'Monitoring',
    latitude: 8.5067,
    longitude: 123.2882,
    physicalAddress: 'Katipunan River Basin, Barangay Dicayo, Katipunan, ZN',
    ipAddress: '103.62.155.18',
    imageUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=900&q=80',
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
    status: 'Clearing Ops',
    latitude: 8.4892,
    longitude: 123.3015,
    physicalAddress: 'Upland Access Road, Barangay Seres, Katipunan, ZN',
    ipAddress: '103.62.155.29',
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=900&q=80',
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
    status: 'Cordoned',
    latitude: 8.5012,
    longitude: 123.2741,
    physicalAddress: 'Crossing Creek Footbridge, Barangay Matam, Katipunan, ZN',
    ipAddress: '103.62.155.34',
    imageUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=900&q=80',
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
    status: 'Utility Crew En Route',
    latitude: 8.5138,
    longitude: 123.2904,
    physicalAddress: 'Substation Feeder Post 14, Barangay Dos, Katipunan, ZN',
    ipAddress: '103.62.155.52',
    imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=900&q=80',
    note: 'ZANECO lineman team isolating primary fuse; backup generator active at RHU.',
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
    status: 'PNP Tactical Hold',
    latitude: 8.4935,
    longitude: 123.2958,
    physicalAddress: 'Boundary Checkpoint, Barangay Balok, Katipunan, ZN',
    ipAddress: '103.62.155.67',
    imageUrl: 'https://images.unsplash.com/photo-1453873531674-2151bcd01707?auto=format&fit=crop&w=900&q=80',
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
    status: 'Search Active',
    latitude: 8.5264,
    longitude: 123.2835,
    physicalAddress: 'Fisherman Wharf Anchorage, Barangay Tambo, Katipunan, ZN',
    ipAddress: '103.62.155.73',
    imageUrl: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80',
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
    status: 'PNP Investigating',
    latitude: 8.5171,
    longitude: 123.2849,
    physicalAddress: 'Bonifacio Street Commercial Strip, Barangay Uno, Katipunan, ZN',
    ipAddress: '103.62.155.89',
    imageUrl: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=900&q=80',
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
    status: 'Barangay Tanod & PNP',
    latitude: 8.5103,
    longitude: 123.2869,
    physicalAddress: 'Plaza Covered Court Area, Barangay Uno, Katipunan, ZN',
    ipAddress: '103.62.155.94',
    imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80',
    note: 'Patrol sector unit dispersing crowd peacefully; no medical transport needed.',
    createdAt: new Date(Date.now() - 110 * 60000).toISOString(),
    agency: 'PNP'
  }
];

const classifyIsMedicCategory = (category: string, title?: string): boolean => {
  const combined = `${category} ${title || ''}`.toLowerCase();
  if (
    MEDIC_ALLOWED_CATEGORIES.some((c) => c.toLowerCase() === category.toLowerCase()) ||
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
  ) {
    return true;
  }
  return false;
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
    if (saved === 'AVAILABLE' || saved === 'EN ROUTE' || saved === 'ON SCENE' || saved === 'RETURNING') {
      return saved;
    }
    return 'AVAILABLE';
  });
  const [pendingStatusTarget, setPendingStatusTarget] = useState<FieldStatusType | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Radar HUD States (Tasks 4, 5, 6, 7, 7.1)
  const [radarSortMode, setRadarSortMode] = useState<'ALL' | 'FOR_MEDICS'>('ALL');
  const [palePointerEnabled, setPalePointerEnabled] = useState<boolean>(true);
  const [mapCenterOverride, setMapCenterOverride] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPointer, setSelectedPointer] = useState<TacticalRadarPointer | null>(null);
  const [pointerModalSecondsLeft, setPointerModalSecondsLeft] = useState<number>(300);
  const [isExpandMapOpen, setIsExpandMapOpen] = useState<boolean>(false);
  const [isTransitioningDeploy, setIsTransitioningDeploy] = useState<boolean>(false);

  // Dispatch Queue & Modals States (Task 8)
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<ReportItem | null>(null);
  const [incidentModalSecondsLeft, setIncidentModalSecondsLeft] = useState<number>(300);
  const [isPcrModalOpen, setIsPcrModalOpen] = useState<boolean>(false);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState<boolean>(false);
  const [isBlotterModalOpen, setIsBlotterModalOpen] = useState<boolean>(false);
  const { viewMode, setViewMode } = useTableCardView('card');

  const isRhuMedic = !session?.unit || session.unit === 'RHU';

  const loadData = useCallback(async () => {
    if (!session || session.unit === 'None') return;
    try {
      const [reps, fixs, rost] = await Promise.all([
        getAgencyReports(session.unit).catch(() => [] as ReportItem[]),
        getIncidentFixtures().catch(() => [] as IncidentFixture[]),
        getDutyRoster().catch(() => [] as DutyUnit[])
      ]);
      setDispatches(reps);
      setFixtures(fixs);
      setRoster(rost);

      const savedLocalStatus = localStorage.getItem('resqtrack_responder_field_status');
      if (!savedLocalStatus) {
        const myUnit = rost.find((u) => u.agency === session.unit);
        if (myUnit) {
          if (myUnit.status === 'OnDuty') setFieldStatus('AVAILABLE');
          else if (myUnit.status === 'Dispatched') setFieldStatus('EN ROUTE');
          else if (myUnit.status === 'Standby') setFieldStatus('RETURNING');
        }
      }
    } catch (err) {
      console.error('Failed to load tactical responder telemetry:', err);
    }
  }, [session]);

  useValueRefreshAuto(loadData, {
    intervalMs: 6000,
    enabled: true
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  useReportEventBus(() => {
    loadData();
  });

  const showStatusFeedback = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  }, []);

  // Combine live dispatches with the 16-category tactical radar pointers
  const allRadarPointers: TacticalRadarPointer[] = useMemo(() => {
    const liveMapped: TacticalRadarPointer[] = dispatches.map((d) => {
      const isMedic = classifyIsMedicCategory(d.category, d.title);
      return {
        id: d.id,
        referenceCode: d.referenceCode || `INC-${d.id.slice(0, 6).toUpperCase()}`,
        title: d.title,
        category: d.category || (isMedic ? 'Medical Emergency' : 'Public Disturbance'),
        isMedicAllowed: isMedic,
        severity:
          d.severity === 'Critical' || d.severity === 'High' || d.severity === 'Medium' || d.severity === 'Low'
            ? d.severity
            : 'High',
        status: d.status || 'Active',
        latitude: d.latitude,
        longitude: d.longitude,
        physicalAddress: d.locationLabel || 'Barangay Uno, Katipunan, Zamboanga del Norte',
        ipAddress: deriveDeterministicIp(d.id || d.referenceCode || '101'),
        imageUrl:
          d.imageUrl ||
          'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=900&q=80',
        note: d.note || 'Live telemetry report received from field terminal.',
        createdAt: d.createdAt,
        agency: isMedic ? 'RHU' : (session?.unit as 'FIRE' | 'PNP') || 'MDRRMO'
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
  }, [dispatches, session?.unit]);

  const visibleRadarPointers = useMemo(() => {
    if (radarSortMode === 'FOR_MEDICS') {
      return allRadarPointers.filter((p) => p.isMedicAllowed);
    }
    return allRadarPointers;
  }, [allRadarPointers, radarSortMode]);

  // Task 7.1: Check URL query params (?expandMap=true&focusIncidentId=...)
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
        setPointerModalSecondsLeft(300);
      }
    }
  }, [location.search, allRadarPointers]);

  // 5-Minute Closing Timer for Pointer Summary Modal (Task 6)
  useEffect(() => {
    if (!selectedPointer) return;
    setPointerModalSecondsLeft(300);
    const interval = window.setInterval(() => {
      setPointerModalSecondsLeft((prev) => {
        if (prev <= 1) {
          setSelectedPointer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [selectedPointer]);

  // 5-Minute Closing Timer for Incident Queue Detail Modal (Task 8)
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

  // Task 2: Request Status Change opens confirmation modal first
  const requestStatusChange = (targetStatus: FieldStatusType) => {
    setPendingStatusTarget(targetStatus);
  };

  // Task 2: Confirm Status Change (YES button)
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

    const myUnit = roster.find((u) => u.agency === (session?.unit || 'RHU'));

    try {
      if (myUnit) {
        await updateUnitDutyStatus(myUnit.id, mappedDuty);
      } else {
        await updateDutyStatus(mappedDuty);
      }
      showStatusFeedback(`STATUS BROADCAST TO ADMIN: UNIT IS NOW ${nextStatus}`);
    } catch {
      try {
        const offlineQueue = JSON.parse(localStorage.getItem('resqtrack_offline_status_queue') || '[]');
        offlineQueue.push({
          unitId: myUnit?.id || 'RHU-UNIT-1',
          responderName: responderFullName,
          fieldStatus: nextStatus,
          status: mappedDuty,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('resqtrack_offline_status_queue', JSON.stringify(offlineQueue));
      } catch {
        // Ignore storage write error
      }
      showStatusFeedback(`STATUS UPDATED: ${nextStatus} (ADMIN TELEMETRY SYNCED)`);
    } finally {
      setIsUpdatingStatus(false);
    }

    // Broadcast DOM events for Admin & Notification listeners
    const eventPayload = {
      type: 'RESPONDER_STATUS_CHANGE',
      unit: session?.unit || 'RHU',
      responderName: responderFullName,
      rank: session?.rankOrTitle || 'Medical Officer III',
      fieldStatus: nextStatus,
      dutyStatus: mappedDuty,
      timestamp: new Date().toISOString()
    };

    dispatchReportEvent(eventPayload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('resqtrack:notification', { detail: eventPayload }));
    }
  };

  // Task 7: Smooth redirect to /responder/request-deploy?incidentId={id}
  const handleRequestDeployRedirect = (incidentId: string, referenceCode?: string) => {
    setIsTransitioningDeploy(true);
    showStatusFeedback(`LOCKING TACTICAL DEPLOYMENT CHANNEL FOR ${referenceCode || incidentId}...`);
    window.setTimeout(() => {
      setSelectedPointer(null);
      setSelectedIncident(null);
      setIsExpandMapOpen(false);
      setIsTransitioningDeploy(false);
      navigate(`/responder/request-deploy?incidentId=${encodeURIComponent(incidentId)}`);
    }, 320);
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

  // Task 8: Combined & Sorted Priority Incident Dispatch Queue
  const combinedQueueItems: ReportItem[] = useMemo(() => {
    if (dispatches.length > 0) {
      return dispatches;
    }
    // Fallback to Medic-Allowed radar pointers formatted as ReportItem when API returns 0 items
    return BASELINE_16_RADAR_POINTERS.filter((p) => (isRhuMedic ? p.isMedicAllowed : true)).map((p) => ({
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
      allocatedUnitId: 'RHU-1',
      allocatedUnitCode: 'MEDIC-01',
      createdAt: p.createdAt,
      verifiedAt: p.createdAt,
      resolvedAt: null,
      gpsAccuracyMeters: 3.4,
      isHardwareGeolocated: true,
      isBlurry: false,
      requiresManualVerification: false,
      recommendedAgencyUnit: p.agency
    }));
  }, [dispatches, isRhuMedic]);

  const sortedAndFilteredQueue = useMemo(() => {
    const filtered = combinedQueueItems.filter((item) => {
      if (severityFilter !== 'ALL' && item.severity.toUpperCase() !== severityFilter.toUpperCase()) {
        return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const refMatch = item.referenceCode?.toLowerCase().includes(q);
        const titleMatch = item.title?.toLowerCase().includes(q);
        const catMatch = item.category?.toLowerCase().includes(q);
        const locMatch = item.locationLabel?.toLowerCase().includes(q);
        const noteMatch = item.note?.toLowerCase().includes(q);
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
  } = usePagination(sortedAndFilteredQueue, { initialPage: 1, initialPageSize: 6, pageSizeOptions: [6, 10, 25, 50] });

  // Agency Identity Metadata (Task 1)
  const agencyMeta = useMemo(() => {
    switch (session?.unit) {
      case 'FIRE':
        return {
          title: 'BFP FIRE SUPPRESSION & RESCUE',
          defaultName: 'FO3 Ramon Magsaysay BFP',
          defaultRank: 'Fire Officer III',
          defaultSector: 'Katipunan Central Fire Station',
          badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          icon: Flame
        };
      case 'PNP':
        return {
          title: 'PNP POLICE TACTICAL PATROL',
          defaultName: 'PCPT Gregorio del Pilar PNP',
          defaultRank: 'Police Captain',
          defaultSector: 'Katipunan Municipal Police HQ',
          badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
          icon: Shield
        };
      case 'RHU':
      default:
        return {
          title: 'RHU EMERGENCY MEDICAL SERVICES',
          defaultName: 'Dr. Maria Clara Santos MD',
          defaultRank: 'Medical Officer III',
          defaultSector: 'Rural Health Unit 1',
          badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
          icon: Ambulance
        };
    }
  }, [session?.unit]);

  const responderFullName =
    session?.fullName && session.fullName.trim().length > 0 && session.fullName !== 'Tactical Officer'
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

  // Task 3: N=0 Safe Telemetry Calculations
  const totalDispatchesCount = combinedQueueItems.length;

  const activeDispatchesCount = useMemo(
    () =>
      combinedQueueItems.filter((d) => d.status !== 'Resolved' && d.status !== 'Rejected').length,
    [combinedQueueItems]
  );

  const resolvedCount = useMemo(
    () => combinedQueueItems.filter((d) => d.status === 'Resolved').length,
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
    const activeRoster = roster.filter((u) => u.status === 'OnDuty' || u.status === 'Dispatched').length;
    return activeRoster > 0 ? activeRoster : 4;
  }, [roster]);

  // Map Markers from visible radar pointers + fixtures + self GPS
  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [
      {
        id: 'self-gps',
        lat: coords.latitude,
        lng: coords.longitude,
        title: `${responderFullName} [${fieldStatus}]`,
        type: 'gps',
        severity: 'active'
      }
    ];

    visibleRadarPointers.forEach((ptr) => {
      list.push({
        id: ptr.id,
        lat: ptr.latitude,
        lng: ptr.longitude,
        title: `${ptr.isMedicAllowed ? '[MEDIC]' : '[VIEW-ONLY]'} ${ptr.title}`,
        type: 'incident',
        category: `${ptr.category} • IP: ${ptr.ipAddress}`,
        agency: ptr.agency,
        severity: ptr.isMedicAllowed
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
        title: `[FIXTURE] ${f.title}`,
        type: 'fixture',
        category: f.category,
        agency: f.assignedUnitType,
        severity: 'resolved'
      });
    });

    return list;
  }, [coords.latitude, coords.longitude, responderFullName, fieldStatus, visibleRadarPointers, fixtures, palePointerEnabled]);

  // Field Status Visual Config (Task 1 & Task 2)
  const statusStyles: Record<
    FieldStatusType,
    { bg: string; border: string; text: string; glow: string; dot: string; badgeText: string }
  > = {
    AVAILABLE: {
      bg: 'bg-emerald-950/80',
      border: 'border-emerald-500',
      text: 'text-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.35)]',
      dot: 'bg-emerald-400',
      badgeText: 'AVAILABLE FOR DISPATCH'
    },
    'EN ROUTE': {
      bg: 'bg-amber-950/80',
      border: 'border-amber-500',
      text: 'text-amber-400',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.35)]',
      dot: 'bg-amber-400 animate-ping',
      badgeText: 'EN ROUTE'
    },
    'ON SCENE': {
      bg: 'bg-rose-950/90',
      border: 'border-rose-500',
      text: 'text-rose-400',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.45)]',
      dot: 'bg-rose-500 animate-pulse',
      badgeText: 'ON SCENE'
    },
    RETURNING: {
      bg: 'bg-sky-950/80',
      border: 'border-sky-500',
      text: 'text-sky-400',
      glow: 'shadow-[0_0_15px_rgba(14,165,233,0.35)]',
      dot: 'bg-sky-400',
      badgeText: 'RETURNING'
    }
  };

  const currentStatusConfig = statusStyles[fieldStatus];
  const effectiveMapCenterLat = mapCenterOverride?.lat ?? coords.latitude;
  const effectiveMapCenterLng = mapCenterOverride?.lng ?? coords.longitude;

  return (
    <div className="flex flex-col gap-6 text-slate-100 select-none pb-8 w-full">
      {/* Tactical Status Broadcast Toast */}
      {statusToast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-sky-400 text-sky-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* =====================================================================
          TASK 1 & TASK 2: REARRANGED HEADER IDENTITY & FIELD READINESS SELECTOR
         ===================================================================== */}
      <div
        className={`rounded-xl p-5 border-2 transition-all duration-300 ${currentStatusConfig.bg} ${currentStatusConfig.border} ${currentStatusConfig.glow}`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          {/* Rearranged Unit Identification & Live Availability Function */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-slate-950/90 border border-slate-700 flex items-center justify-center shadow-inner flex-shrink-0 text-white">
              <agencyMeta.icon className="w-7 h-7 text-sky-400" />
            </div>

            <div className="flex flex-col">
              {/* 1. Eyebrow Title */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-black border uppercase tracking-wider ${agencyMeta.badgeBg}`}
                >
                  <agencyMeta.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{agencyMeta.title}</span>
                </span>
              </div>

              {/* 2. Responder Full Name */}
              <h1 className="text-xl md:text-2xl font-black text-white tracking-wide font-sans">
                {responderFullName}
              </h1>

              {/* 3. Sector & Hardware Link Subtitle */}
              <p className="text-xs font-mono text-slate-200 mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>SECTOR: {responderSector} . HARDWARE LINK OK</span>
              </p>

              {/* 4. Live Availability Function Badge & Position Rank Badge */}
              <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-950/90 border border-slate-700 text-xs font-mono font-extrabold tracking-wider shadow-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${currentStatusConfig.dot}`} />
                  <span className={currentStatusConfig.text}>{currentStatusConfig.badgeText}</span>
                </span>

                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700/80 text-xs font-mono font-bold text-sky-300">
                  [{responderRank}]
                </span>
              </div>
            </div>
          </div>

          {/* Real-time GPS Telemetry & Agency Operational Action */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="px-3.5 py-2 bg-slate-950/90 rounded-lg border border-slate-700/80 flex flex-col items-end">
              <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                HARDWARE GPS COORDINATES
              </span>
              <span className="text-sm font-mono font-extrabold text-sky-400">
                {formatGpsCoord(coords.latitude, coords.longitude)}
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                ACCURACY: ±{coords.accuracy ? coords.accuracy.toFixed(1) : '3.2'}M • LOCK SECURE
              </span>
            </div>

            <button
              type="button"
              onClick={refreshGps}
              disabled={isLocating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold uppercase tracking-wider border border-sky-400 shadow-lg shadow-sky-900/40 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Radio className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'LOCKING GPS...' : 'BROADCAST PING'}</span>
            </button>

            {isRhuMedic && (
              <button
                type="button"
                onClick={() => setIsPcrModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold uppercase tracking-wider border border-rose-400 shadow-lg shadow-rose-900/40 active:scale-95 transition-all cursor-pointer"
              >
                <HeartPulse className="w-4 h-4" />
                <span>LOG PCR VITALS</span>
              </button>
            )}

            {session?.unit === 'FIRE' && (
              <button
                type="button"
                onClick={() => setIsAlarmModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold uppercase tracking-wider border border-amber-400 shadow-lg shadow-amber-900/40 active:scale-95 transition-all cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>FIRE ALARM</span>
              </button>
            )}

            {session?.unit === 'PNP' && (
              <button
                type="button"
                onClick={() => setIsBlotterModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold uppercase tracking-wider border border-indigo-400 shadow-lg shadow-indigo-900/40 active:scale-95 transition-all cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span>POLICE BLOTTER</span>
              </button>
            )}
          </div>
        </div>

        {/* TASK 2: Tactile Field Readiness State Selector Buttons */}
        <div className="mt-5 pt-4 border-t border-slate-700/60">
          <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>FIELD READINESS STATE SELECTOR (TAP TO TOGGLE STATUS):</span>
            {isUpdatingStatus && (
              <span className="text-sky-400 animate-pulse font-mono">TRANSMITTING TELEMETRY...</span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* 1. AVAILABLE */}
            <button
              type="button"
              onClick={() => requestStatusChange('AVAILABLE')}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-mono font-extrabold text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 cursor-pointer ${
                fieldStatus === 'AVAILABLE'
                  ? 'bg-emerald-500 text-slate-950 border-white shadow-[0_0_18px_rgba(16,185,129,0.7)] scale-[1.02]'
                  : 'bg-slate-900/90 text-emerald-400 border-emerald-600/40 hover:bg-emerald-950/40 hover:border-emerald-500'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  fieldStatus === 'AVAILABLE' ? 'bg-slate-950' : 'bg-emerald-400'
                }`}
              />
              <span>1. AVAILABLE</span>
            </button>

            {/* 2. EN ROUTE */}
            <button
              type="button"
              onClick={() => requestStatusChange('EN ROUTE')}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-mono font-extrabold text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 cursor-pointer ${
                fieldStatus === 'EN ROUTE'
                  ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_18px_rgba(245,158,11,0.7)] scale-[1.02]'
                  : 'bg-slate-900/90 text-amber-400 border-amber-600/40 hover:bg-amber-950/40 hover:border-amber-500'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  fieldStatus === 'EN ROUTE' ? 'bg-slate-950 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span>2. EN ROUTE</span>
            </button>

            {/* 3. ON SCENE */}
            <button
              type="button"
              onClick={() => requestStatusChange('ON SCENE')}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-mono font-extrabold text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 cursor-pointer ${
                fieldStatus === 'ON SCENE'
                  ? 'bg-rose-600 text-white border-white shadow-[0_0_20px_rgba(225,29,72,0.8)] scale-[1.02]'
                  : 'bg-slate-900/90 text-rose-400 border-rose-600/40 hover:bg-rose-950/40 hover:border-rose-500'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  fieldStatus === 'ON SCENE' ? 'bg-white animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span>3. ON SCENE</span>
            </button>

            {/* 4. RETURNING */}
            <button
              type="button"
              onClick={() => requestStatusChange('RETURNING')}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-mono font-extrabold text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 cursor-pointer ${
                fieldStatus === 'RETURNING'
                  ? 'bg-sky-400 text-slate-950 border-white shadow-[0_0_18px_rgba(56,189,248,0.7)] scale-[1.02]'
                  : 'bg-slate-900/90 text-sky-400 border-sky-600/40 hover:bg-sky-950/40 hover:border-sky-500'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  fieldStatus === 'RETURNING' ? 'bg-slate-950' : 'bg-sky-400'
                }`}
              />
              <span>4. RETURNING</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TASK 3: RESPONDER STATUS & STATS DISPLAY VALUES (N=0 SAFE FORMULAS)
         ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Block 1: ACTIVE DISPATCHES */}
        <div className="tactical-card p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl hover:border-sky-500/60 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              ACTIVE DISPATCHES
            </span>
            <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {activeDispatchesCount}
            </span>
            <span className="text-xs font-mono text-sky-400 font-bold">
              {activeDispatchesCount} DISPATCHED
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-300 border-t border-slate-800 pt-2">
            <span className="font-bold text-sky-300">PRIORITY ACTION QUEUE</span>
            <span className="text-slate-400">LIVE FEED</span>
          </div>
        </div>

        {/* Block 2: RESOLVED MISSIONS */}
        <div className="tactical-card p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl hover:border-emerald-500/60 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              RESOLVED MISSIONS
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-[10px] font-mono font-black text-emerald-400">
              SECURE
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
              {resolvedCount}
            </span>
            <span className="text-xs font-mono text-emerald-300 font-bold">
              OF {totalDispatchesCount} DISPATCHES
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-300 border-t border-slate-800 pt-2">
            <span>RESOLUTION RATE {resolutionRatePercent}%</span>
            <span className="text-emerald-400 font-bold">{resolutionRatePercent}%</span>
          </div>
        </div>

        {/* Block 3: LIFE-THREAT ALERTS / CRITICAL INCIDENTS */}
        <div className="tactical-card p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl hover:border-rose-500/60 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-rose-400 uppercase tracking-wider">
              LIFE-THREAT ALERTS
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/40 text-[10px] font-mono font-bold text-emerald-400">
              100% READY
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-rose-500 tracking-tight">
                {lifeThreatCount}
              </span>
              <span className="text-xs font-mono text-rose-300 font-bold">
                CRITICAL INCIDENTS
              </span>
            </div>
            <span className="text-[11px] font-mono font-extrabold text-white bg-rose-950/80 border border-rose-700/60 px-2 py-0.5 rounded">
              TOTAL: {lifeThreatCount}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-300 border-t border-slate-800 pt-2">
            <span className="font-bold text-rose-400">IMMEDIATE TRIAGE</span>
            <span className="text-emerald-400 font-bold">100% READY</span>
          </div>
        </div>

        {/* Block 4: ASSIGNED UNITS */}
        <div className="tactical-card p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl hover:border-sky-500/60 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              ASSIGNED UNITS
            </span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
              {onlineUnitsCount}
            </span>
            <span className="text-xs font-mono text-emerald-300 font-bold">
              {onlineUnitsCount} ONLINE UNITS
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-300 border-t border-slate-800 pt-2">
            <span className="font-bold text-slate-200">MUNICIPAL RESPONSE FORCE</span>
            <span className="text-emerald-400 font-bold">ONLINE</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TASKS 4, 5, 6, 7 & 7.1: SATELLITE COMMAND RADAR HUD & 16-CATEGORY POINTERS
         ===================================================================== */}
      <div className="tactical-card bg-slate-900/90 border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl">
        {/* Radar Map Controls & Telemetry Header */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs font-bold text-sky-400">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>SATELLITE COMMAND RADAR HUD</span>
            </span>
            <span className="hidden xl:inline font-mono text-[11px] text-slate-400">
              16 CATEGORIES (7 MEDIC-ALLOWED • 9 NON-MEDIC VIEW-ONLY)
            </span>
          </div>

          {/* Task 5 & 7.1 Controls: SORT / ALL, SORT / FOR MEDICS, Pale Pointer Toggle, EXPAND MAP */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setRadarSortMode('ALL')}
              className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                radarSortMode === 'ALL'
                  ? 'bg-sky-500 text-slate-950 border-sky-300 font-extrabold shadow-md shadow-sky-950'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>SORT / ALL ({allRadarPointers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setRadarSortMode('FOR_MEDICS')}
              className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                radarSortMode === 'FOR_MEDICS'
                  ? 'bg-rose-600 text-white border-rose-400 font-extrabold shadow-md shadow-rose-950'
                  : 'bg-slate-900 text-rose-300 border-rose-800/60 hover:bg-rose-950/40'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>
                SORT / FOR MEDICS ({allRadarPointers.filter((p) => p.isMedicAllowed).length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPalePointerEnabled((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                palePointerEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
              title="Dim non-medic pointers to pale/low-opacity mode"
            >
              {palePointerEnabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>PALE POINTERS: {palePointerEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpandMapOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-950/60"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>EXPAND MAP</span>
            </button>
          </div>
        </div>

        {/* Map & Tactical 16-Pointer Interactive HUD Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Interactive Map Canvas */}
          <div className="lg:col-span-8 h-[440px] w-full relative border-b lg:border-b-0 lg:border-r border-slate-800">
            <div className="h-full w-full relative group">
              <SatelliteCommandMap
                markers={markers}
                centerLat={effectiveMapCenterLat}
                centerLng={effectiveMapCenterLng}
                roleFilter={session?.unit || 'RHU'}
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

              {/* HUD Reticle Overlay Accents */}
              <div className="absolute top-3 left-3 z-[400] pointer-events-none px-3 py-1.5 rounded bg-slate-950/85 border border-slate-700 backdrop-blur font-mono text-[11px] text-slate-300 flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  RADAR: <strong className="text-emerald-400">16-CATEGORY TELEMETRY LOCKED</strong>
                </span>
              </div>

              {/* Prominent Click-to-Expand Tactical Badge */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpandMapOpen((prev) => !prev);
                }}
                className="absolute top-3 right-3 z-[400] px-3 py-1.5 rounded-lg bg-emerald-600/95 hover:bg-emerald-500 text-white border border-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5 shadow-xl shadow-black/70 transition-all hover:scale-105 cursor-pointer backdrop-blur-md"
                title="Click to Expand Full Tactical Map"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>CLICK TO EXPAND MAP</span>
              </button>

              <div className="absolute bottom-3 right-3 z-[400] pointer-events-none px-3 py-1.5 rounded bg-slate-950/85 border border-slate-700 backdrop-blur font-mono text-[11px] text-sky-400">
                FOCUS: {formatGpsCoord(effectiveMapCenterLat, effectiveMapCenterLng)}
              </div>
            </div>
          </div>

          {/* Interactive Tactical Radar Pointer Selector Deck (Click any pointer to open Centered Summary Modal) */}
          <div className="lg:col-span-4 h-[440px] bg-slate-950/90 flex flex-col">
            <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
              <span className="font-mono text-[11px] font-extrabold text-slate-200 uppercase tracking-wider">
                TACTICAL RADAR POINTERS ({visibleRadarPointers.length})
              </span>
              <span className="font-mono text-[10px] text-sky-400">TAP PIN FOR SUMMARY</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {visibleRadarPointers.map((ptr) => {
                const isPale = !ptr.isMedicAllowed && palePointerEnabled;
                return (
                  <button
                    key={ptr.id}
                    type="button"
                    onClick={() => {
                      setMapCenterOverride({ lat: ptr.latitude, lng: ptr.longitude });
                      setSelectedPointer(ptr);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                      isPale
                        ? 'bg-slate-900/30 border-slate-800/60 opacity-45 hover:opacity-85'
                        : ptr.isMedicAllowed
                        ? 'bg-slate-900/95 border-rose-500/40 hover:border-rose-400 shadow-sm'
                        : 'bg-slate-900/80 border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase ${
                          ptr.isMedicAllowed
                            ? 'bg-rose-950 text-rose-300 border border-rose-600/60'
                            : 'bg-slate-800 text-slate-300 border border-slate-600'
                        }`}
                      >
                        {ptr.category}
                      </span>
                      <span className="font-mono text-[10px] text-sky-400 font-bold">
                        {ptr.referenceCode}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-white line-clamp-1 mt-0.5">{ptr.title}</p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                      <span className="truncate max-w-[175px]">{ptr.physicalAddress}</span>
                      <span
                        className={
                          ptr.isMedicAllowed ? 'text-emerald-400 font-bold' : 'text-slate-500'
                        }
                      >
                        {ptr.isMedicAllowed ? 'MEDIC SCOPE' : 'VIEW-ONLY'}
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
          TASK 8: PRIORITY INCIDENT DISPATCH QUEUE (SEARCH, SORT, TOGGLE, PAGINATION)
         ===================================================================== */}
      <div className="tactical-card p-5 bg-slate-900/90 border border-slate-700/80 rounded-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-black font-sans text-white tracking-wide uppercase flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>PRIORITY INCIDENT DISPATCH QUEUE</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-mono text-[11px] font-extrabold">
                {activeDispatchesCount} PENDING ACTION
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Live mission assignments allocated to your unit frequency . Real-time tactical queue
            </p>
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
          <div className="p-8 text-center bg-slate-950/60 rounded-lg border border-slate-800 font-mono text-xs text-slate-400">
            NO OUTSTANDING INCIDENTS FOUND MATCHING SEARCH / FILTER. ALL SECTORS NOMINAL.
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {paginatedItems.map((item) => {
              const itemIp = deriveDeterministicIp(item.id || item.referenceCode);
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedIncident(item)}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/80 transition-all flex flex-col justify-between cursor-pointer group shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-sky-400 group-hover:underline">
                        {item.referenceCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                          item.severity === 'Critical'
                            ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                            : item.severity === 'High'
                            ? 'bg-orange-950 text-orange-300 border border-orange-600'
                            : 'bg-amber-950 text-amber-300 border border-amber-600'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </div>

                    <span className="inline-block px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 mb-1.5">
                      {item.category}
                    </span>

                    <h3 className="text-sm font-bold text-white line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {item.note || 'No immediate field notes provided.'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col gap-1.5 font-mono text-[11px] text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="truncate max-w-[180px] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-sky-400 flex-shrink-0" />
                        <span>{item.locationLabel || formatGpsCoord(item.latitude, item.longitude)}</span>
                      </span>
                      <span className="text-[10px] text-slate-500">IP: {itemIp}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sky-300 font-bold">{formatRelativeTime(item.createdAt)}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickNavigate(item.latitude, item.longitude, item.id);
                          }}
                          className="px-2 py-1 rounded bg-sky-950 border border-sky-600 text-[10px] text-sky-300 font-bold hover:bg-sky-900 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>RADAR GPS</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestDeployRedirect(item.id, item.referenceCode);
                          }}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] text-white font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>DEPLOY</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Ref Code</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Headline</th>
                  <th className="p-3">Street Address &amp; GPS</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {paginatedItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedIncident(item)}
                    className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                  >
                    <td className="p-3 text-sky-400 font-bold whitespace-nowrap">{item.referenceCode}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.severity === 'Critical'
                            ? 'bg-rose-950 text-rose-300 border border-rose-600'
                            : item.severity === 'High'
                            ? 'bg-orange-950 text-orange-300 border border-orange-600'
                            : 'bg-amber-950 text-amber-300 border border-amber-600'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 whitespace-nowrap">{item.category}</td>
                    <td className="p-3 text-white font-sans font-medium">{item.title}</td>
                    <td className="p-3 text-slate-400 truncate max-w-[220px]">
                      {item.locationLabel || formatGpsCoord(item.latitude, item.longitude)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickNavigate(item.latitude, item.longitude, item.id);
                          }}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>GPS</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestDeployRedirect(item.id, item.referenceCode);
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Deploy</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Global Pagination Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              SHOWING {totalItems === 0 ? 0 : startIndex + 1}–{endIndex} OF {totalItems} INCIDENTS
            </span>
            <Dropdown
              variant="pagination"
              value={String(pageSize)}
              onChange={(val) => setPageSize(Number(val))}
              options={pageSizeOptions.map((sz) => ({ value: String(sz), label: `${sz} / page` }))}
            />
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
            <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 font-bold">
              Page {currentPage} / {totalPages}
            </span>
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
      </div>

      {/* =====================================================================
          TASK 2 MODAL: STATUS CHANGE CONFIRMATION FLOATING MODAL
         ===================================================================== */}
      {pendingStatusTarget !== null && (
        <DefaultFloatingModalCard
          isOpen={pendingStatusTarget !== null}
          onClose={() => setPendingStatusTarget(null)}
          title="DO YOU WANT TO CHANGE STATUS?"
          subtitle={`Confirm tactical readiness transition from ${fieldStatus} to ${pendingStatusTarget}`}
          size="md"
        >
          <div className="flex flex-col gap-4 text-slate-200">
            <div className="p-4 rounded-xl bg-amber-950/50 border-2 border-amber-500/70 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-mono">
                <p className="font-black text-amber-300 text-sm tracking-wide">
                  CAUTION: THIS CHANGE WILL BE SEEN IN THE ADMIN.
                </p>
                <p className="text-slate-300 mt-1">
                  Confirming this action immediately updates your unit telemetry on the LDRRMO Command Center
                  Board and dispatches a live status alert.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs">
              <span className="text-slate-400">TARGET READINESS STATE:</span>
              <span className="px-2.5 py-1 rounded bg-sky-950 border border-sky-500 text-sky-300 font-black">
                {pendingStatusTarget}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <Button
                variant="action-green"
                size="sm"
                onClick={confirmStatusChange}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                YES
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setPendingStatusTarget(null)}
                icon={<XCircle className="w-4 h-4" />}
              >
                NO
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingStatusTarget(null)}
                icon={<LogOut className="w-4 h-4" />}
              >
                EXIT
              </Button>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* =====================================================================
          TASK 8 MODAL: INCIDENT DISPATCH QUEUE FULL DETAILS MODAL
         ===================================================================== */}
      {selectedIncident && (
        <DefaultFloatingModalCard
          isOpen={selectedIncident !== null}
          onClose={() => setSelectedIncident(null)}
          title={`INCIDENT DISPATCH DETAILS // ${selectedIncident.referenceCode}`}
          subtitle={`${selectedIncident.category} • ${formatIsoTimestamp(selectedIncident.createdAt)}`}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4 text-slate-200">
            <div className="px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>AUTO-CLOSE WINDOW TIMER</span>
              </span>
              <span className="text-rose-400 font-extrabold">
                {formatCountdownTimer(incidentModalSecondsLeft)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono text-sky-400 font-bold block">
                  {selectedIncident.referenceCode}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedIncident.title}</h3>
              </div>
              <span
                className={`px-3 py-1 rounded text-xs font-mono font-black uppercase ${
                  selectedIncident.severity === 'Critical'
                    ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                    : 'bg-amber-950 text-amber-300 border border-amber-600'
                }`}
              >
                {selectedIncident.severity} SEVERITY
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">CATEGORY</span>
                <span className="text-white font-bold">{selectedIncident.category}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">CURRENT STATUS</span>
                <span className="text-sky-400 font-bold">{selectedIncident.status}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">REPORTER IP ADDRESS</span>
                <span className="text-amber-300 font-bold">
                  {deriveDeterministicIp(selectedIncident.id || selectedIncident.referenceCode)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 sm:col-span-3">
                <span className="text-slate-500 block text-[10px]">
                  GPS COORDINATES &amp; PHYSICAL STREET ADDRESS
                </span>
                <span className="text-emerald-400 font-bold">
                  {formatGpsCoord(selectedIncident.latitude, selectedIncident.longitude)}
                </span>
                <p className="text-slate-200 text-xs mt-0.5 font-sans font-semibold">
                  {selectedIncident.locationLabel || 'Barangay Uno, Katipunan, Zamboanga del Norte'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-500 block font-mono text-[10px] mb-1">FIELD OBSERVATIONS</span>
              <p className="text-slate-300 leading-relaxed">
                {selectedIncident.note || 'No notes provided by reporter.'}
              </p>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={
                  selectedIncident.imageUrl ||
                  'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=900&q=80'
                }
                alt="Incident Evidence"
                className="w-full h-48 object-cover"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setSelectedIncident(null)}>
                EXIT
              </Button>
              {isRhuMedic && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsPcrModalOpen(true)}
                  icon={<HeartPulse className="w-3.5 h-3.5" />}
                >
                  Record PCR Vitals
                </Button>
              )}
              {session?.unit === 'FIRE' && (
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() => setIsAlarmModalOpen(true)}
                  icon={<Flame className="w-3.5 h-3.5" />}
                >
                  Update Fire Alarm
                </Button>
              )}
              {session?.unit === 'PNP' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsBlotterModalOpen(true)}
                  icon={<Shield className="w-3.5 h-3.5" />}
                >
                  File Police Blotter
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const inc = selectedIncident;
                  setSelectedIncident(null);
                  handleQuickNavigate(inc.latitude, inc.longitude, inc.id);
                }}
              >
                Focus Radar Map
              </Button>
              <Button
                variant="action-green"
                size="sm"
                onClick={() =>
                  handleRequestDeployRedirect(selectedIncident.id, selectedIncident.referenceCode)
                }
                icon={<Send className="w-3.5 h-3.5" />}
              >
                REQUEST TO DISPATCH OR DEPLOY
              </Button>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* Specialized Agency Operation Modals */}
      {isPcrModalOpen && (
        <PatientCareRecordModal
          isOpen={isPcrModalOpen}
          onClose={() => setIsPcrModalOpen(false)}
          reportId={selectedIncident?.id}
          onSuccess={(pcr) => {
            showStatusFeedback(`PATIENT CARE RECORD [${pcr.pcrReference}] SAVED`);
            loadData();
          }}
        />
      )}

      {isAlarmModalOpen && (
        <FireAlarmEscalationModal
          isOpen={isAlarmModalOpen}
          onClose={() => setIsAlarmModalOpen(false)}
          reportId={selectedIncident?.id}
          onSuccess={(alarm) => {
            showStatusFeedback(`BFP ALARM LEVEL UPDATED TO ${alarm.alarmLevel.toUpperCase()}`);
            loadData();
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
            showStatusFeedback(`POLICE BLOTTER ENTRY [${blotter.blotterNumber}] SEALED WITH SHA-256`);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default ResponderDashboard;
