// [Layer: LayoutBars]
// Responsibility: Top navigation command header with live search, unit-scoped Responder Notification Bell dropdown/modal,
// contextual system routing, floating profile trigger, and authenticated logout session termination.
// Official Cherry (#670626 / #400014) & Warm Ivory (#F7F1EA / #E9D9D0) Stitch design -- Universal Lucide icon standard (ZERO any).

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Send,
  Radio,
  AlertTriangle,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Check,
  CheckCheck,
  Trash2,
  X,
  Clock,
  Volume2,
  VolumeX,
  ArrowUpRight
} from 'lucide-react';
import { UserSessionChip, UserSessionChipProps } from './UserSessionChip';
import { useDrawerSidebar } from '@/Shared/ToggleDrawerSidebarMenu';
import { requestJson } from '@/Endpoints/apiClient';
import { createPortal } from 'react-dom';
import { useFluidResposiveness } from '@/Hooks/useFluidResposiveness';

export interface HeaderProps {
  user?: UserSessionChipProps['user'];
}

export type ResponderNotificationCategory =
  | 'REQUEST DISPATCH DEPLOY'
  | 'ADMIN REQUEST YOU TO DEPLOY'
  | 'INCIDENT HAPPENS ON'
  | 'SUBMITTED INCIDENT LOGS'
  | 'VERIFIED SUBMITTED INCIDENT LOGS'
  | 'CLOSE CASE';

export interface ResponderNotificationItem {
  id: string;
  referenceCode: string;
  category: ResponderNotificationCategory;
  incidentCategory?: string;
  targetUnit?: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  targetRoute: string;
  locationLabel?: string;
}

interface RawNotificationPayload {
  id?: string;
  reportId?: string;
  referenceCode?: string;
  type?: string;
  notificationType?: string;
  category?: string;
  incidentCategory?: string;
  targetUnit?: string;
  unit?: string;
  agency?: string;
  recommendedAgencyUnit?: string;
  title?: string;
  message?: string;
  description?: string;
  note?: string;
  timestamp?: string;
  createdAt?: string;
  isRead?: boolean;
  read?: boolean;
  severity?: string;
  targetRoute?: string;
  route?: string;
  link?: string;
  location?: string;
  locationLabel?: string;
  sector?: string;
}

const COLLAPSED_SIDEBAR_WIDTH = '72px';
const EXPANDED_SIDEBAR_VAR = 'var(--brand-w, 260px)';
const ALERT_POLL_INTERVAL_MS = 10000;
const MAX_DISPLAY_UNREAD_COUNT = 99;
const LOCAL_STORAGE_READ_KEY = 'resqtrack.alerts.read';
const RESPONDER_NOTIFICATIONS_STORAGE_PREFIX = 'resqtrack_responder_notifications';

const NOTIFICATION_CATEGORIES: ResponderNotificationCategory[] = [
  'REQUEST DISPATCH DEPLOY',
  'ADMIN REQUEST YOU TO DEPLOY',
  'INCIDENT HAPPENS ON',
  'SUBMITTED INCIDENT LOGS',
  'VERIFIED SUBMITTED INCIDENT LOGS',
  'CLOSE CASE'
];

const DEFAULT_SEED_NOTIFICATIONS: ResponderNotificationItem[] = [
  // RHU / MEDIC Scoped Seed Notifications
  {
    id: 'notif-rhu-admin-deploy-01',
    referenceCode: 'CMD-RHU-101',
    category: 'ADMIN REQUEST YOU TO DEPLOY',
    incidentCategory: 'MedicalEmergency',
    targetUnit: 'RHU',
    title: 'LDRRMO Command Orders Immediate Medic Deployment',
    message: 'Central Command ordered RHU Ambulance Unit 01 to deploy to National Highway KM 284 trauma scene.',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Critical',
    targetRoute: '/responder/request-deploy',
    locationLabel: 'National Highway KM 284, Katipunan'
  },
  {
    id: 'notif-rhu-req-deploy-02',
    referenceCode: 'REQ-RHU-102',
    category: 'REQUEST DISPATCH DEPLOY',
    incidentCategory: 'MedicalEmergency',
    targetUnit: 'RHU',
    title: 'Medic Dispatch & Deployment Request Logged',
    message: 'RHU Medic Team Alpha requested ambulance deployment clearance to Barangay Uno sector.',
    timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'High',
    targetRoute: '/responder/request-deploy',
    locationLabel: 'Barangay Uno, Katipunan'
  },
  {
    id: 'notif-rhu-incident-on-03',
    referenceCode: 'INC-RHU-103',
    category: 'INCIDENT HAPPENS ON',
    incidentCategory: 'MedicalEmergency',
    targetUnit: 'RHU',
    title: 'Medical Emergency & Trauma Detected on Sector Radar',
    message: 'Acute respiratory distress and patient trauma alert reported on Sector 1 Radar (8.5147°N, 123.2842°E).',
    timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Critical',
    targetRoute: '/responder/incidents',
    locationLabel: 'Sector 1 · Poblacion Junction'
  },
  {
    id: 'notif-rhu-submitted-log-04',
    referenceCode: 'LOG-RHU-104',
    category: 'SUBMITTED INCIDENT LOGS',
    incidentCategory: 'MedicalEmergency',
    targetUnit: 'RHU',
    title: 'Submitted Medical Incident Log & Multi-PCR Evidence',
    message: 'Medic field assessment and multi-patient PCR trauma documentation transmitted to Command Verification Queue.',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Medium',
    targetRoute: '/responder/my-reports',
    locationLabel: 'RHU Field Terminal'
  },
  {
    id: 'notif-rhu-verified-log-05',
    referenceCode: 'VER-RHU-105',
    category: 'VERIFIED SUBMITTED INCIDENT LOGS',
    incidentCategory: 'MedicalEmergency',
    targetUnit: 'RHU',
    title: 'Verified Medical Incident Log — 5:00 Countdown Started',
    message: 'AI & LDRRMO Command verified your submitted PCR log. 5-minute auto case closure countdown initiated.',
    timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'High',
    targetRoute: '/responder/my-reports',
    locationLabel: 'Command Verification Engine'
  },
  {
    id: 'notif-rhu-close-case-06',
    referenceCode: 'CLS-RHU-106',
    category: 'CLOSE CASE',
    incidentCategory: 'MedicalEmergency',
    targetUnit: 'RHU',
    title: '5-Minute Countdown Complete — Medical Case Closed',
    message: 'Medical case #INC-2026-089 completed the 5-minute verification timer and is archived as CLOSED / SOLVED.',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    isRead: true,
    severity: 'Low',
    targetRoute: '/responder/my-reports',
    locationLabel: 'Municipal Archive'
  },

  // BFP / FIRE Scoped Seed Notifications
  {
    id: 'notif-fire-admin-deploy-01',
    referenceCode: 'CMD-BFP-201',
    category: 'ADMIN REQUEST YOU TO DEPLOY',
    incidentCategory: 'StructuralFire',
    targetUnit: 'FIRE',
    title: 'LDRRMO Command Orders Immediate Fire Engine Deployment',
    message: 'Central Command ordered BFP Engine 01 to deploy to Public Market electrical arcing & structural fire.',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Critical',
    targetRoute: '/responder/request-deploy',
    locationLabel: 'Public Market Perimeter, Barangay Uno'
  },
  {
    id: 'notif-fire-req-deploy-02',
    referenceCode: 'REQ-BFP-202',
    category: 'REQUEST DISPATCH DEPLOY',
    incidentCategory: 'StructuralFire',
    targetUnit: 'FIRE',
    title: 'Fire & Hazmat Dispatch Request Logged',
    message: 'BFP Engine Company requested 2-alarm suppression clearance for commercial warehouse smoke plume.',
    timestamp: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'High',
    targetRoute: '/responder/request-deploy',
    locationLabel: 'Barangay Dos Industrial Zone'
  },
  {
    id: 'notif-fire-incident-on-03',
    referenceCode: 'INC-BFP-203',
    category: 'INCIDENT HAPPENS ON',
    incidentCategory: 'StructuralFire',
    targetUnit: 'FIRE',
    title: 'Structural Fire & Hazmat Alert on Sector Radar',
    message: 'Active electrical transformer sparks and hazmat smoke reported on Sector 2 Radar.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Critical',
    targetRoute: '/responder/incidents',
    locationLabel: 'Sector 2 · Market Perimeter'
  },

  // PNP / POLICE Scoped Seed Notifications
  {
    id: 'notif-pnp-admin-deploy-01',
    referenceCode: 'CMD-PNP-301',
    category: 'ADMIN REQUEST YOU TO DEPLOY',
    incidentCategory: 'CrimeOrSecurity',
    targetUnit: 'PNP',
    title: 'LDRRMO Command Orders Immediate Patrol Deployment',
    message: 'Central Command ordered PNP Mobile Patrol 01 to secure Sitio Malugas Bridge vehicular traffic bottleneck.',
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'High',
    targetRoute: '/responder/request-deploy',
    locationLabel: 'Sitio Malugas Bridge, Katipunan'
  },
  {
    id: 'notif-pnp-req-deploy-02',
    referenceCode: 'REQ-PNP-302',
    category: 'REQUEST DISPATCH DEPLOY',
    incidentCategory: 'VehicularAccident',
    targetUnit: 'PNP',
    title: 'Traffic & Security Perimeter Dispatch Logged',
    message: 'PNP Patrol Unit requested perimeter security clearance for arterial highway vehicular collision.',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Medium',
    targetRoute: '/responder/request-deploy',
    locationLabel: 'National Highway KM 284'
  },
  {
    id: 'notif-pnp-incident-on-03',
    referenceCode: 'INC-PNP-303',
    category: 'INCIDENT HAPPENS ON',
    incidentCategory: 'CrimeOrSecurity',
    targetUnit: 'PNP',
    title: 'Security Disturbance & Traffic Gridlock Reported',
    message: 'Active highway gridlock and security perimeter report logged in Barangay Daanglungsod.',
    timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Medium',
    targetRoute: '/responder/my-reports',
    locationLabel: 'Barangay Daanglungsod'
  }
];

const normalizeUnitCode = (unit?: string): string => {
  const upper = (unit || '').toUpperCase().trim();
  if (upper === 'MEDIC') return 'RHU';
  if (upper === 'BFP') return 'FIRE';
  if (upper === 'SECURITY' || upper === 'POLICE') return 'PNP';
  return upper;
};

const resolveActiveSessionScope = (
  propUser?: HeaderProps['user']
): { role: string; unit: string } => {
  let role = propUser?.role || '';
  let unit = propUser?.unit || '';

  if (typeof window !== 'undefined' && (!role || !unit || unit === 'None')) {
    try {
      const tabRaw =
        window.sessionStorage.getItem('resqtrack_session') ||
        window.sessionStorage.getItem('resqtrack_user');
      if (tabRaw) {
        const parsed = JSON.parse(tabRaw) as { role?: string; unit?: string };
        role = role || parsed.role || '';
        if (!unit || unit === 'None') unit = parsed.unit || '';
      }
      if (!unit || unit === 'None') {
        const tabUnit = window.sessionStorage.getItem('resqtrack_unit') || '';
        if (tabUnit && tabUnit !== 'none') unit = tabUnit;
      }
    } catch {
      // Ignore storage read failure
    }
  }

  return {
    role: String(role ?? '').toLowerCase().trim(),
    unit: normalizeUnitCode(unit)
  };
};

const doesNotificationMatchUnit = (
  item: ResponderNotificationItem,
  activeRole: string,
  activeUnit: string
): boolean => {
  if (activeRole !== 'responder') return true;
  if (!activeUnit || activeUnit === 'NONE') return true;

  const explicitTarget = normalizeUnitCode(item.targetUnit);
  if (explicitTarget && explicitTarget !== 'NONE') {
    return explicitTarget === activeUnit;
  }

  const text = `${item.incidentCategory || ''} ${item.title || ''} ${item.message || ''} ${item.referenceCode || ''}`.toUpperCase();

  if (activeUnit === 'FIRE') {
    return (
      text.includes('FIRE') ||
      text.includes('HAZMAT') ||
      text.includes('FLAME') ||
      text.includes('SMOKE') ||
      text.includes('ARSON') ||
      text.includes('ELECTRICAL') ||
      text.includes('SPARK') ||
      text.includes('ARCING') ||
      text.includes('GAS') ||
      text.includes('2-ALARM') ||
      text.includes('BFP')
    );
  }

  if (activeUnit === 'RHU') {
    return (
      text.includes('MEDICAL') ||
      text.includes('MEDIC') ||
      text.includes('RHU') ||
      text.includes('TRAUMA') ||
      text.includes('HEALTH') ||
      text.includes('AMBULANCE') ||
      text.includes('EMS') ||
      text.includes('CASUALTY') ||
      text.includes('PATIENT') ||
      text.includes('PCR') ||
      text.includes('CPR') ||
      text.includes('CARDIAC') ||
      text.includes('RESPIRATORY') ||
      text.includes('DYSPNEA') ||
      text.includes('LACERATION') ||
      text.includes('FRACTURE') ||
      text.includes('INJURY') ||
      text.includes('HEMORRHAGE') ||
      text.includes('FIRST AID')
    );
  }

  if (activeUnit === 'PNP') {
    return (
      text.includes('CRIME') ||
      text.includes('SECURITY') ||
      text.includes('PNP') ||
      text.includes('POLICE') ||
      text.includes('PATROL') ||
      text.includes('VEHICULAR') ||
      text.includes('TRAFFIC') ||
      text.includes('COLLISION') ||
      text.includes('GRIDLOCK') ||
      text.includes('BOTTLENECK') ||
      text.includes('DISTURBANCE') ||
      text.includes('BLOTTER') ||
      text.includes('ASSAULT') ||
      text.includes('THEFT') ||
      text.includes('ROBBERY') ||
      text.includes('PERIMETER')
    );
  }

  return true;
};

const normalizeNotificationCategory = (
  rawType?: string,
  title?: string,
  message?: string
): ResponderNotificationCategory => {
  const exactUpper = (rawType || '').trim().toUpperCase();
  if (
    exactUpper === 'REQUEST DISPATCH DEPLOY' ||
    exactUpper === 'ADMIN REQUEST YOU TO DEPLOY' ||
    exactUpper === 'INCIDENT HAPPENS ON' ||
    exactUpper === 'SUBMITTED INCIDENT LOGS' ||
    exactUpper === 'VERIFIED SUBMITTED INCIDENT LOGS' ||
    exactUpper === 'CLOSE CASE'
  ) {
    return exactUpper as ResponderNotificationCategory;
  }

  const combined = `${rawType || ''} ${title || ''} ${message || ''}`.toUpperCase();
  if (
    combined.includes('ADMIN REQUEST') ||
    combined.includes('ADMIN_REQUEST') ||
    combined.includes('ORDER YOU TO DEPLOY') ||
    combined.includes('ORDERS IMMEDIATE') ||
    combined.includes('ADMIN DEPLOY')
  ) {
    return 'ADMIN REQUEST YOU TO DEPLOY';
  }
  if (
    combined.includes('REQUEST DISPATCH') ||
    combined.includes('REQUEST_DISPATCH') ||
    combined.includes('REQUEST DEPLOY') ||
    combined.includes('DISPATCH DEPLOY')
  ) {
    return 'REQUEST DISPATCH DEPLOY';
  }
  if (
    combined.includes('VERIFIED SUBMITTED') ||
    combined.includes('VERIFIED_SUBMITTED') ||
    combined.includes('5-MINUTE') ||
    combined.includes('5 MINUTE') ||
    combined.includes('COUNTDOWN') ||
    combined.includes('VERIFIED INCIDENT LOG')
  ) {
    return 'VERIFIED SUBMITTED INCIDENT LOGS';
  }
  if (
    combined.includes('SUBMITTED INCIDENT') ||
    combined.includes('SUBMITTED_INCIDENT') ||
    combined.includes('PCR') ||
    combined.includes('SUBMITTED LOG')
  ) {
    return 'SUBMITTED INCIDENT LOGS';
  }
  if (
    combined.includes('CLOSE CASE') ||
    combined.includes('CLOSE_CASE') ||
    combined.includes('CASE CLOSED') ||
    combined.includes('DECLARED CLOSED') ||
    combined.includes('SOLVED')
  ) {
    return 'CLOSE CASE';
  }
  return 'INCIDENT HAPPENS ON';
};

const resolveTargetRoute = (
  category: ResponderNotificationCategory,
  explicitRoute?: string,
  activeRole?: string,
  activeUnit?: string
): string => {
  if (explicitRoute && explicitRoute.startsWith('/')) {
    if (explicitRoute === '/responder/reports' || explicitRoute === '/responder/my-reports') {
      return '/responder/my-reports';
    }
    return explicitRoute;
  }
  if (activeRole === 'ldrrmo_admin' || activeRole === 'admin') {
    return '/admin/incidents';
  }
  if (activeRole === 'civilian') {
    return '/civilian/my-reports';
  }
  switch (category) {
    case 'REQUEST DISPATCH DEPLOY':
    case 'ADMIN REQUEST YOU TO DEPLOY':
      return '/responder/request-deploy';
    case 'INCIDENT HAPPENS ON':
      return activeUnit === 'PNP' ? '/responder/my-reports' : '/responder/incidents';
    case 'SUBMITTED INCIDENT LOGS':
    case 'VERIFIED SUBMITTED INCIDENT LOGS':
    case 'CLOSE CASE':
      return '/responder/my-reports';
    default:
      return '/responder/dashboard';
  }
};

const normalizeRawNotification = (
  raw: RawNotificationPayload,
  fallbackIndex: number,
  readIds: string[],
  activeRole: string,
  activeUnit: string
): ResponderNotificationItem => {
  const category = normalizeNotificationCategory(
    raw.notificationType || raw.type || raw.category,
    raw.title,
    raw.message || raw.description || raw.note
  );
  const id =
    raw.id ||
    raw.reportId ||
    raw.referenceCode ||
    `notif-${String(category ?? '').toLowerCase().replace(/\s+/g, '-')}-${fallbackIndex}`;
  const referenceCode = raw.referenceCode || raw.reportId || raw.id || `ALT-${100 + fallbackIndex}`;
  const title = raw.title || `${category} Alert`;
  const message =
    raw.message ||
    raw.description ||
    raw.note ||
    (raw.location || raw.locationLabel || raw.sector
      ? `Sector telemetry update at ${raw.location || raw.locationLabel || raw.sector}`
      : 'Official LDRRMO safety notice & dispatch channel notification.');
  const timestamp = raw.timestamp || raw.createdAt || new Date().toISOString();
  const isRead = Boolean(raw.isRead || raw.read || readIds.includes(id));
  const targetRoute = resolveTargetRoute(
    category,
    raw.targetRoute || raw.route || raw.link,
    activeRole,
    activeUnit
  );

  return {
    id,
    referenceCode,
    category,
    incidentCategory: raw.incidentCategory || raw.category,
    targetUnit: raw.targetUnit || raw.recommendedAgencyUnit || raw.unit || raw.agency,
    title,
    message,
    timestamp,
    isRead,
    severity: raw.severity || 'High',
    targetRoute,
    locationLabel: raw.locationLabel || raw.location || raw.sector
  };
};

const formatTimeAgo = (iso?: string): string => {
  if (!iso) return 'JUST NOW';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
  if (diffSec < 60) return `${diffSec}S AGO`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}M AGO`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}H AGO`;
  return `${Math.floor(diffHr / 24)}D AGO`;
};

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<ResponderNotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | ResponderNotificationCategory>('ALL');
  const [sirenMuted, setSirenMuted] = useState<boolean>(false);
  const { isCollapsed } = useDrawerSidebar();
  const { isMobile } = useFluidResposiveness();
  const navigate = useNavigate();
  const bellWrapperRef = useRef<HTMLDivElement | null>(null);

  const sessionScope = useMemo(() => resolveActiveSessionScope(user), [user]);

  const storageKey = useMemo(() => {
    if (sessionScope.role === 'responder' && sessionScope.unit && sessionScope.unit !== 'NONE') {
      return `${RESPONDER_NOTIFICATIONS_STORAGE_PREFIX}_${String(sessionScope.unit ?? '').toLowerCase()}`;
    }
    return `${RESPONDER_NOTIFICATIONS_STORAGE_PREFIX}_${sessionScope.role || 'default'}`;
  }, [sessionScope.role, sessionScope.unit]);

  const getLocallyReadIds = useCallback((): string[] => {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_READ_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }, []);

  const loadStoredResponderNotifications = useCallback((): ResponderNotificationItem[] => {
    const readIds = getLocallyReadIds();
    const scopedDefaults = DEFAULT_SEED_NOTIFICATIONS.filter((item) =>
      doesNotificationMatchUnit(item, sessionScope.role, sessionScope.unit)
    ).map((item) => ({
      ...item,
      targetRoute: resolveTargetRoute(item.category, item.targetRoute, sessionScope.role, sessionScope.unit),
      isRead: item.isRead || readIds.includes(item.id)
    }));

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        window.localStorage.setItem(storageKey, JSON.stringify(scopedDefaults));
        return scopedDefaults;
      }
      const parsed = JSON.parse(raw) as RawNotificationPayload[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((item, idx) =>
            normalizeRawNotification(item, idx, readIds, sessionScope.role, sessionScope.unit)
          )
          .filter((item) => doesNotificationMatchUnit(item, sessionScope.role, sessionScope.unit));
      }
    } catch {
      // Fallback to unit-scoped seed notifications
    }
    return scopedDefaults;
  }, [getLocallyReadIds, sessionScope.role, sessionScope.unit, storageKey]);

  const synchronizeAllNotifications = useCallback(async () => {
    const localItems = loadStoredResponderNotifications();
    const readIds = getLocallyReadIds();

    try {
      const apiAlerts = await requestJson<RawNotificationPayload[]>('/api/alerts', { method: 'GET' });
      if (Array.isArray(apiAlerts) && apiAlerts.length > 0) {
        const existingIds = new Set(localItems.map((i) => i.id));
        const mergedFromApi: ResponderNotificationItem[] = [];

        apiAlerts.slice(0, 20).forEach((alertItem, idx) => {
          const normalized = normalizeRawNotification(
            {
              ...alertItem,
              incidentCategory: alertItem.incidentCategory || alertItem.category,
              notificationType: alertItem.notificationType || 'INCIDENT HAPPENS ON'
            },
            idx + 200,
            readIds,
            sessionScope.role,
            sessionScope.unit
          );
          if (
            !existingIds.has(normalized.id) &&
            doesNotificationMatchUnit(normalized, sessionScope.role, sessionScope.unit)
          ) {
            existingIds.add(normalized.id);
            mergedFromApi.push(normalized);
          }
        });

        setNotifications([...localItems, ...mergedFromApi]);
        return;
      }
    } catch {
      // Ignore network jitter and use unit-scoped local notifications
    }

    setNotifications(localItems);
  }, [getLocallyReadIds, loadStoredResponderNotifications, sessionScope.role, sessionScope.unit]);

  useEffect(() => {
    synchronizeAllNotifications();
    const intervalId = window.setInterval(synchronizeAllNotifications, ALERT_POLL_INTERVAL_MS);

    const handleCustomNotification = (event: Event) => {
      const customEvent = event as CustomEvent<RawNotificationPayload | undefined>;
      const detail = customEvent.detail;
      const readIds = getLocallyReadIds();

      if (detail && typeof detail === 'object') {
        const incoming = normalizeRawNotification(
          detail,
          Date.now() % 1000,
          readIds,
          sessionScope.role,
          sessionScope.unit
        );
        if (doesNotificationMatchUnit(incoming, sessionScope.role, sessionScope.unit)) {
          try {
            const current = loadStoredResponderNotifications();
            const deduplicated = [
              incoming,
              ...current.filter((item) => item.id !== incoming.id)
            ];
            window.localStorage.setItem(storageKey, JSON.stringify(deduplicated));
          } catch {
            // Ignore quota error
          }
        }
      }
      synchronizeAllNotifications();
    };

    const handleCustomReport = (event: Event) => {
      const customEvent = event as CustomEvent<RawNotificationPayload | undefined>;
      const detail = customEvent.detail;
      const readIds = getLocallyReadIds();

      if (detail && typeof detail === 'object' && (detail.title || detail.id || detail.referenceCode)) {
        const incoming = normalizeRawNotification(
          {
            ...detail,
            incidentCategory: detail.incidentCategory || detail.category,
            notificationType: detail.notificationType || 'INCIDENT HAPPENS ON',
            title: detail.title || 'New Emergency Incident Reported on Sector Radar'
          },
          Date.now() % 1000,
          readIds,
          sessionScope.role,
          sessionScope.unit
        );
        if (doesNotificationMatchUnit(incoming, sessionScope.role, sessionScope.unit)) {
          try {
            const current = loadStoredResponderNotifications();
            const deduplicated = [
              incoming,
              ...current.filter((item) => item.id !== incoming.id)
            ];
            window.localStorage.setItem(storageKey, JSON.stringify(deduplicated));
          } catch {
            // Ignore quota error
          }
        }
      }
      synchronizeAllNotifications();
    };

    const handleStorageOrAlertsUpdated = () => {
      synchronizeAllNotifications();
    };

    window.addEventListener('resqtrack:notification', handleCustomNotification);
    window.addEventListener('resqtrack:report', handleCustomReport);
    window.addEventListener('resqtrack:alerts-updated', handleStorageOrAlertsUpdated);
    window.addEventListener('storage', handleStorageOrAlertsUpdated);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('resqtrack:notification', handleCustomNotification);
      window.removeEventListener('resqtrack:report', handleCustomReport);
      window.removeEventListener('resqtrack:alerts-updated', handleStorageOrAlertsUpdated);
      window.removeEventListener('storage', handleStorageOrAlertsUpdated);
    };
  }, [
    getLocallyReadIds,
    loadStoredResponderNotifications,
    sessionScope.role,
    sessionScope.unit,
    storageKey,
    synchronizeAllNotifications
  ]);

  useEffect(() => {
    if (!isAlertsOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (bellWrapperRef.current && !bellWrapperRef.current.contains(e.target as Node)) {
        setIsAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isAlertsOpen]);

  const unitScopedNotifications = useMemo(
    () =>
      notifications.filter((item) =>
        doesNotificationMatchUnit(item, sessionScope.role, sessionScope.unit)
      ),
    [notifications, sessionScope.role, sessionScope.unit]
  );

  const unreadCount = useMemo(
    () => unitScopedNotifications.filter((item) => !item.isRead).length,
    [unitScopedNotifications]
  );

  const filteredNotifications = useMemo(() => {
    return unitScopedNotifications.filter((item) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'UNREAD') return !item.isRead;
      return item.category === activeFilter;
    });
  }, [unitScopedNotifications, activeFilter]);

  const countByCategory = useCallback(
    (cat: ResponderNotificationCategory): number =>
      unitScopedNotifications.filter((n) => n.category === cat).length,
    [unitScopedNotifications]
  );

  const persistNotificationsState = (updated: ResponderNotificationItem[]) => {
    setNotifications(updated);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignore storage error
    }
  };

  const handleMarkSingleRead = async (item: ResponderNotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const readIds = getLocallyReadIds();
    if (!readIds.includes(item.id)) {
      const nextReadIds = [...readIds, item.id];
      try {
        window.localStorage.setItem(LOCAL_STORAGE_READ_KEY, JSON.stringify(nextReadIds));
      } catch {
        // Ignore storage error
      }
    }

    const updated = unitScopedNotifications.map((n) =>
      n.id === item.id ? { ...n, isRead: true } : n
    );
    persistNotificationsState(updated);

    try {
      await requestJson<{ message?: string }>(`/api/alerts/${encodeURIComponent(item.id)}/read`, {
        method: 'POST'
      });
    } catch {
      // Non-blocking backend acknowledge
    }
  };

  const handleNotificationClick = (item: ResponderNotificationItem) => {
    handleMarkSingleRead(item);
    setIsAlertsOpen(false);
    navigate(item.targetRoute || '/responder/dashboard');
  };

  const handleMarkAllRead = () => {
    const allIds = unitScopedNotifications.map((n) => n.id);
    const combinedRead = Array.from(new Set([...getLocallyReadIds(), ...allIds]));
    try {
      window.localStorage.setItem(LOCAL_STORAGE_READ_KEY, JSON.stringify(combinedRead));
    } catch {
      // Ignore storage error
    }
    const updated = unitScopedNotifications.map((n) => ({ ...n, isRead: true }));
    persistNotificationsState(updated);
  };

  const handleClearReadNotifications = () => {
    const remaining = unitScopedNotifications.filter((n) => !n.isRead);
    persistNotificationsState(remaining.length > 0 ? remaining : []);
  };

  const getCategoryVisuals = (category: ResponderNotificationCategory) => {
    switch (category) {
      case 'REQUEST DISPATCH DEPLOY':
        return {
          icon: Send,
          badgeClass: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/35',
          iconWrapClass: 'bg-[#E9D9D0] border-[#A83B4D]/35 text-[#670626]',
          routeLabel: 'Request & Deploy'
        };
      case 'ADMIN REQUEST YOU TO DEPLOY':
        return {
          icon: Radio,
          badgeClass: 'bg-[#670626] text-[#F7F1EA] border-[#4A041A]',
          iconWrapClass: 'bg-[#670626] border-[#4A041A] text-[#F7F1EA]',
          routeLabel: 'Deploy Order'
        };
      case 'INCIDENT HAPPENS ON':
        return {
          icon: AlertTriangle,
          badgeClass: 'bg-[#FAF5EE] text-[#670626] border-[#A83B4D]/45',
          iconWrapClass: 'bg-[#E9D9D0] border-[#670626]/30 text-[#670626]',
          routeLabel: sessionScope.unit === 'PNP' ? 'Reports' : 'Incident Feed'
        };
      case 'SUBMITTED INCIDENT LOGS':
        return {
          icon: FileText,
          badgeClass: 'bg-[#E9D9D0] text-[#2B010E] border-[#A83B4D]/35',
          iconWrapClass: 'bg-[#E9D9D0] border-[#A83B4D]/35 text-[#670626]',
          routeLabel: 'Reports'
        };
      case 'VERIFIED SUBMITTED INCIDENT LOGS':
        return {
          icon: ShieldCheck,
          badgeClass: 'bg-[#670626]/15 text-[#670626] border-[#670626]/35',
          iconWrapClass: 'bg-[#E9D9D0] border-[#670626]/35 text-[#670626]',
          routeLabel: 'Verified Timer'
        };
      case 'CLOSE CASE':
        return {
          icon: CheckCircle2,
          badgeClass: 'bg-[#E9D9D0] text-[#2B010E] border-[#A83B4D]/35',
          iconWrapClass: 'bg-[#E9D9D0] border-[#A83B4D]/35 text-[#670626]',
          routeLabel: 'Closed Case'
        };
    }
  };

  const handleSettingsClick = () => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'ldrrmo_admin' || role === 'admin') {
      navigate('/admin/settings');
    } else if (role === 'responder') {
      navigate('/responder/profile');
    } else {
      navigate('/civilian/profile');
    }
  };

  const handleHelpClick = () => {
    alert(
      'ResQTrack Emergency Response Command System\nKatipunan, Zamboanga del Norte\nMulti-Agency Dispatch Mesh: LDRRMO • RHU • BFP • PNP'
    );
  };

  const handleLogout = async () => {
    try {
      await requestJson<{ message?: string }>('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error encountered:', err);
    } finally {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('resqtrack_token');
        window.sessionStorage.removeItem('resqtrack_session');
        window.sessionStorage.removeItem('resqtrack_user');
        window.localStorage.removeItem('resqtrack_token');
        window.localStorage.removeItem('resqtrack_session');
        window.localStorage.removeItem('resqtrack_user');
      }
    }
    navigate('/login');
  };

  const handleToggleAlerts = () => {
    setIsAlertsOpen((prev) => !prev);
  };

  const handleRadarClick = () => {
    setIsAlertsOpen(false);
    if (sessionScope.role === 'ldrrmo_admin' || sessionScope.role === 'admin') {
      navigate('/admin/strategic-map');
    } else if (sessionScope.role === 'civilian') {
      navigate('/civilian/live-map');
    } else {
      navigate('/responder/dashboard');
    }
  };

  return (
    <header
      className="topbar select-none relative bg-[#400014]/95 backdrop-blur-xl border-b border-[#FFD9DD]/18 shadow-[0_8px_28px_rgba(43,1,14,0.45)]"
      style={{ zIndex: isAlertsOpen ? 999999 : 100000 }}
      role="banner"
    >
      <div
        className="brandbar flex items-center justify-between transition-all duration-200 border-r border-[#FFD9DD]/15 pr-3 overflow-hidden"
        style={{
          width: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR,
          minWidth: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR
        }}
      >
        {!isCollapsed ? (
          <div className="flex flex-col gap-0.5">
            <span className="brandbar__mark !text-xl font-black text-[#F7F1EA]">
              Res<span className="brandbar__accent text-[#FFD9DD]">Qtrack</span>
            </span>
            <span className="brandbar__sub !text-xs !tracking-wider !text-[#E9D9D0] !font-semibold !normal-case">
              Katipunan Dispatch
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <span className="brandbar__mark !text-lg font-black text-[#F7F1EA]">
              R<span className="brandbar__accent text-[#FFD9DD]">Q</span>
            </span>
          </div>
        )}
      </div>

      <form className="search" id="search-form" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search className="search__icon w-4 h-4 text-[#FFD9DD]/80 pointer-events-none flex-shrink-0" aria-hidden="true" />
        <input
          className="search__input !h-9 !text-sm !bg-[#670626]/75 !border !border-[#FFD9DD]/25 focus:!border-[#F7F1EA] !text-[#F7F1EA] placeholder:!text-[#FFD9DD]/65 rounded-xl"
          id="search"
          type="search"
          name="q"
          placeholder="Search incidents..."
          autoComplete="off"
          spellCheck={false}
          aria-label="Search incidents"
        />
      </form>

      <div className="topbar__actions flex items-center gap-1.5 sm:gap-2">
        <div className={`alerts relative ${isAlertsOpen ? 'z-[999999]' : ''}`} id="alerts" ref={bellWrapperRef}>
          <button
            className="iconbtn relative flex items-center justify-center p-2 rounded-xl text-[#FFD9DD] hover:text-[#F7F1EA] hover:bg-[#670626] border border-transparent hover:border-[#FFD9DD]/25 transition-all"
            type="button"
            id="btn-alerts"
            title="Notifications"
            aria-label={`Notifications (${unreadCount} unread)`}
            aria-haspopup="true"
            aria-expanded={isAlertsOpen}
            aria-controls="alerts-panel"
            onClick={handleToggleAlerts}
          >
            <Bell className="w-4 h-4 text-current transition-colors" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="iconbtn__dot absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-[#F7F1EA] text-[#670626] text-xs font-extrabold font-mono rounded-full flex items-center justify-center border border-[#670626] shadow-md"
                aria-label={`${unreadCount} unread alerts`}
              >
                {unreadCount > MAX_DISPLAY_UNREAD_COUNT ? `${MAX_DISPLAY_UNREAD_COUNT}+` : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Bell Popover (Warm Ivory Clay Drawer + Cherry Header) */}
          {isAlertsOpen && typeof document !== 'undefined' && createPortal(
            <>
              <div
                className="fixed inset-0 z-[999998] bg-[#2B010E]/45 backdrop-blur-[2px]"
                onClick={() => setIsAlertsOpen(false)}
                aria-hidden="true"
              />
              <section
                className={`alerts__panel clay-surface fixed top-14 right-2 sm:right-4 z-[999999] ${
                  isMobile ? 'inset-x-2 w-auto' : 'w-[420px] sm:w-[500px] md:w-[560px]'
                } max-w-[calc(100vw-1rem)] max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150`}
                id="alerts-panel"
                aria-label="Notifications"
                role="region"
                onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
              >
                {/* Popover Header */}
                <header className="flex flex-col gap-2.5 px-4 py-3.5 bg-[#670626] text-[#F7F1EA] border-b border-[#FFD9DD]/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-[#FFD9DD] animate-ping flex-shrink-0" />
                        <Bell className="w-4 h-4 text-[#FFD9DD] flex-shrink-0" aria-hidden="true" />
                        <h2 className="text-sm font-black tracking-wide text-[#F7F1EA] truncate">
                          Notifications
                        </h2>
                        {sessionScope.role === 'responder' && sessionScope.unit && sessionScope.unit !== 'NONE' && (
                          <span className="px-2 py-0.5 text-xs font-mono font-bold bg-[#400014] text-[#FFD9DD] border border-[#FFD9DD]/25 rounded-md flex-shrink-0">
                            {sessionScope.unit}
                          </span>
                        )}
                        {unreadCount > 0 ? (
                          <span className="px-2 py-0.5 text-xs font-mono font-bold bg-[#F7F1EA] text-[#670626] rounded-md flex-shrink-0">
                            {unreadCount} New
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-[#FFD9DD] flex-shrink-0">
                            All Clear
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#FFD9DD] font-medium leading-snug">
                        Emergency Advisories &amp; Warnings — Official LDRRMO safety notices &amp; dispatch alerts
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAlertsOpen(false)}
                      aria-label="Close notifications panel"
                      className="p-1.5 rounded-lg text-[#FFD9DD] hover:text-[#F7F1EA] hover:bg-[#4A041A] transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Action Controls Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#FFD9DD]/15">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSirenMuted((prev) => !prev)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border inline-flex items-center gap-1.5 transition-all ${
                          sirenMuted
                            ? 'bg-[#400014] text-[#FFD9DD] border-[#FFD9DD]/20'
                            : 'bg-[#F7F1EA] text-[#670626] border-[#F7F1EA]'
                        }`}
                      >
                        {sirenMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        <span>{sirenMuted ? 'Siren Muted' : 'Siren Active'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRadarClick}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#400014] text-[#F7F1EA] border border-[#FFD9DD]/25 hover:bg-[#4A041A] transition-colors"
                      >
                        Radar
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-1 text-xs font-mono font-bold text-[#F7F1EA] hover:bg-[#4A041A] px-2.5 py-1 rounded-lg bg-[#400014] border border-[#FFD9DD]/25 transition-colors"
                        title="Mark all notifications as read"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark All Read</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleClearReadNotifications}
                        className="flex items-center gap-1 text-xs font-mono font-bold text-[#FFD9DD] hover:text-[#F7F1EA] px-2.5 py-1 rounded-lg bg-[#400014] border border-[#FFD9DD]/20 hover:border-[#FFD9DD]/45 transition-colors"
                        title="Clear read notifications"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Read</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                        activeFilter === 'ALL'
                          ? 'bg-[#F7F1EA] text-[#670626] border-[#F7F1EA]'
                          : 'bg-[#400014] text-[#FFD9DD] border-[#FFD9DD]/20 hover:border-[#FFD9DD]/45'
                      }`}
                    >
                      All ({unitScopedNotifications.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilter('UNREAD')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                        activeFilter === 'UNREAD'
                          ? 'bg-[#F7F1EA] text-[#670626] border-[#F7F1EA]'
                          : 'bg-[#400014] text-[#FFD9DD] border-[#FFD9DD]/20 hover:border-[#FFD9DD]/45'
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>

                    {NOTIFICATION_CATEGORIES.map((category) => {
                      const count = countByCategory(category);
                      const isSelected = activeFilter === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setActiveFilter(category)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                            isSelected
                              ? 'bg-[#F7F1EA] text-[#670626] border-[#F7F1EA] shadow-sm'
                              : 'bg-[#400014] text-[#FFD9DD] border-[#FFD9DD]/20 hover:border-[#FFD9DD]/45'
                          }`}
                        >
                          {category} ({count})
                        </button>
                      );
                    })}
                  </div>
                </header>

                {/* Notification Items Feed (Warm Ivory) */}
                <ul className="divide-y divide-[#A83B4D]/15 max-h-[420px] overflow-y-auto bg-[#F7F1EA]" id="alerts-list">
                  {filteredNotifications.length === 0 ? (
                    <li className="p-8 text-center text-[#670626] flex flex-col items-center justify-center gap-2">
                      <Bell className="w-7 h-7 text-[#A83B4D]" />
                      <p className="text-sm font-mono font-bold text-[#2B010E]">
                        No notifications for this filter
                      </p>
                    </li>
                  ) : (
                    filteredNotifications.map((item) => {
                      const visuals = getCategoryVisuals(item.category);
                      const CategoryIcon = visuals.icon;

                      return (
                        <li
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 ${
                            !item.isRead
                              ? 'bg-[#FAF5EE] hover:bg-[#E9D9D0]/75 border-l-4 border-l-[#670626]'
                              : 'bg-[#F7F1EA] hover:bg-[#E9D9D0]/55 opacity-85 hover:opacity-100'
                          }`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              handleNotificationClick(item);
                            }
                          }}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${visuals.iconWrapClass}`}
                          >
                            <CategoryIcon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Top row: Category Badge + Ref Code + Timestamp */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                              <span
                                className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider border ${visuals.badgeClass}`}
                              >
                                {item.category}
                              </span>

                              <div className="flex items-center gap-1.5 text-xs font-mono text-[#A83B4D]">
                                <span className="text-[#670626] font-bold">{item.referenceCode}</span>
                                <span>&bull;</span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-[#A83B4D]" />
                                  {formatTimeAgo(item.timestamp)}
                                </span>
                              </div>
                            </div>

                            {/* Title & Message */}
                            <p className="text-sm font-extrabold text-[#2B010E] leading-snug">
                              {item.title}
                            </p>
                            <p className="text-xs sm:text-sm text-[#670626]/90 font-sans mt-1 line-clamp-2 leading-relaxed">
                              {item.message}
                            </p>

                            {/* Bottom Row: Navigation Action & Read Toggle */}
                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#670626] hover:underline">
                                <span>{visuals.routeLabel}</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </span>

                              {!item.isRead ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkSingleRead(item, e)}
                                  className="px-2.5 py-1 rounded-lg bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] text-xs font-mono font-bold inline-flex items-center gap-1 shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5 text-[#FFD9DD]" />
                                  <span>Acknowledge</span>
                                </button>
                              ) : (
                                <span className="text-xs font-mono text-[#A83B4D] inline-flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-[#670626]" />
                                  <span>Acknowledged</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>
            </>,
            document.body
          )}
        </div>

        <button
          className="iconbtn iconbtn--desk p-2 rounded-xl text-[#FFD9DD] hover:text-[#F7F1EA] hover:bg-[#670626] border border-transparent hover:border-[#FFD9DD]/25 transition-all hidden sm:flex items-center justify-center"
          type="button"
          id="btn-settings"
          aria-label="Settings"
          title="Profile Settings"
          onClick={handleSettingsClick}
        >
          <Settings className="w-4 h-4 text-current transition-colors" aria-hidden="true" />
        </button>

        <button
          className="iconbtn iconbtn--desk p-2 rounded-xl text-[#FFD9DD] hover:text-[#F7F1EA] hover:bg-[#670626] border border-transparent hover:border-[#FFD9DD]/25 transition-all hidden sm:flex items-center justify-center"
          type="button"
          id="btn-help"
          aria-label="Help"
          title="Emergency Command Support"
          onClick={handleHelpClick}
        >
          <HelpCircle className="w-4 h-4 text-current transition-colors" aria-hidden="true" />
        </button>

        <span className="topbar__sep w-px h-5 bg-[#FFD9DD]/20 mx-1" aria-hidden="true" />

        {/* User profile avatar session chip with profile card toggle */}
        <UserSessionChip user={user} />

        {/* Dedicated Logout button cleanly positioned after avatar */}
        <button
          className="iconbtn iconbtn--logout group flex items-center justify-center p-2 rounded-xl text-[#FFD9DD] hover:text-[#670626] hover:bg-[#F7F1EA] border border-[#FFD9DD]/25 hover:border-[#F7F1EA] ml-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-[#FFD9DD]/60"
          type="button"
          id="btn-logout"
          title="Sign Out of Session"
          aria-label="Sign Out"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 text-current transition-colors" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};

export default Header;
