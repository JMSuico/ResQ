// [Layer: LayoutBars]
// Responsibility: Top navigation command header with live search, consolidated Hospital ER Alarms &
// 6-category Responder Notification Bell dropdown/modal, contextual system routing, floating profile trigger,
// and authenticated logout session termination.
// ResQTrack Incident AI System Detection -- Universal Lucide icon standard with strict typing (ZERO any) and arrow lambdas (=>).

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
const RESPONDER_NOTIFICATIONS_STORAGE_KEY = 'resqtrack_responder_notifications';

const NOTIFICATION_CATEGORIES: ResponderNotificationCategory[] = [
  'REQUEST DISPATCH DEPLOY',
  'ADMIN REQUEST YOU TO DEPLOY',
  'INCIDENT HAPPENS ON',
  'SUBMITTED INCIDENT LOGS',
  'VERIFIED SUBMITTED INCIDENT LOGS',
  'CLOSE CASE'
];

const DEFAULT_SEED_NOTIFICATIONS: ResponderNotificationItem[] = [
  {
    id: 'notif-admin-deploy-01',
    referenceCode: 'CMD-DEP-101',
    category: 'ADMIN REQUEST YOU TO DEPLOY',
    title: 'LDRRMO Command Orders Immediate Medic Deployment',
    message: 'Central Command C2 ordered RHU Ambulance Unit 01 to deploy to National Highway KM 284 multi-vehicle trauma scene.',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Critical',
    targetRoute: '/responder/request-deploy',
    locationLabel: 'National Highway KM 284, Katipunan'
  },
  {
    id: 'notif-req-deploy-02',
    referenceCode: 'REQ-DEP-102',
    category: 'REQUEST DISPATCH DEPLOY',
    title: 'Medic Dispatch & Deployment Request Logged',
    message: 'RHU Medic Team Alpha requested tactical dispatch clearance and ambulance deployment to Barangay Uno sector.',
    timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'High',
    targetRoute: '/responder/request-deploy',
    locationLabel: 'Barangay Uno, Katipunan'
  },
  {
    id: 'notif-incident-on-03',
    referenceCode: 'INC-RAD-103',
    category: 'INCIDENT HAPPENS ON',
    title: 'New Emergency Incident Detected on Sector Radar',
    message: 'High-impact vehicular collision with casualty alert reported on Sector 1 Radar (8.5147°N, 123.2842°E).',
    timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Critical',
    targetRoute: '/responder/incidents',
    locationLabel: 'Sector 1 • Poblacion Junction'
  },
  {
    id: 'notif-submitted-log-04',
    referenceCode: 'LOG-PCR-104',
    category: 'SUBMITTED INCIDENT LOGS',
    title: 'Submitted Incident Report & Multi-PCR Evidence',
    message: 'Medic field assessment and multi-patient PCR trauma documentation transmitted to Command Verification Queue.',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'Medium',
    targetRoute: '/responder/reports',
    locationLabel: 'RHU Field Terminal'
  },
  {
    id: 'notif-verified-log-05',
    referenceCode: 'VER-LOG-105',
    category: 'VERIFIED SUBMITTED INCIDENT LOGS',
    title: 'Verified Submitted Incident Log — 5:00 Countdown Started',
    message: 'AI & LDRRMO Command verified your submitted incident log and PCR evidence. 5-minute auto case closure countdown initiated.',
    timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    isRead: false,
    severity: 'High',
    targetRoute: '/responder/reports',
    locationLabel: 'Command Verification Engine'
  },
  {
    id: 'notif-close-case-06',
    referenceCode: 'CLS-CAS-106',
    category: 'CLOSE CASE',
    title: '5-Minute Countdown Complete — Case Declared Closed & Solved',
    message: 'Incident case #INC-2026-089 has completed the 5-minute verification timer and is officially archived as CLOSED / SOLVED.',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    isRead: true,
    severity: 'Low',
    targetRoute: '/responder/reports',
    locationLabel: 'Municipal Archive'
  }
];

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
  explicitRoute?: string
): string => {
  if (explicitRoute && explicitRoute.startsWith('/')) {
    return explicitRoute === '/responder/my-reports' ? '/responder/reports' : explicitRoute;
  }
  switch (category) {
    case 'REQUEST DISPATCH DEPLOY':
    case 'ADMIN REQUEST YOU TO DEPLOY':
      return '/responder/request-deploy';
    case 'INCIDENT HAPPENS ON':
      return '/responder/incidents';
    case 'SUBMITTED INCIDENT LOGS':
    case 'VERIFIED SUBMITTED INCIDENT LOGS':
    case 'CLOSE CASE':
      return '/responder/reports';
    default:
      return '/responder';
  }
};

const normalizeRawNotification = (
  raw: RawNotificationPayload,
  fallbackIndex: number,
  readIds: string[]
): ResponderNotificationItem => {
  const category = normalizeNotificationCategory(
    raw.category || raw.notificationType || raw.type,
    raw.title,
    raw.message || raw.description || raw.note
  );
  const id =
    raw.id ||
    raw.reportId ||
    raw.referenceCode ||
    `notif-${category.toLowerCase().replace(/\s+/g, '-')}-${fallbackIndex}`;
  const referenceCode = raw.referenceCode || raw.reportId || raw.id || `ALT-${100 + fallbackIndex}`;
  const title = raw.title || `${category} Alert`;
  const message =
    raw.message ||
    raw.description ||
    raw.note ||
    (raw.location || raw.locationLabel || raw.sector
      ? `Sector telemetry update at ${raw.location || raw.locationLabel || raw.sector}`
      : 'Tactical hospital ER & dispatch channel notification.');
  const timestamp = raw.timestamp || raw.createdAt || new Date().toISOString();
  const isRead = Boolean(raw.isRead || raw.read || readIds.includes(id));
  const targetRoute = resolveTargetRoute(category, raw.targetRoute || raw.route || raw.link);

  return {
    id,
    referenceCode,
    category,
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
    try {
      const raw = window.localStorage.getItem(RESPONDER_NOTIFICATIONS_STORAGE_KEY);
      if (!raw) {
        window.localStorage.setItem(
          RESPONDER_NOTIFICATIONS_STORAGE_KEY,
          JSON.stringify(DEFAULT_SEED_NOTIFICATIONS)
        );
        return DEFAULT_SEED_NOTIFICATIONS.map((item) => ({
          ...item,
          isRead: item.isRead || readIds.includes(item.id)
        }));
      }
      const parsed = JSON.parse(raw) as RawNotificationPayload[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => normalizeRawNotification(item, idx, readIds));
      }
    } catch {
      // Fallback to default seed notifications
    }
    return DEFAULT_SEED_NOTIFICATIONS.map((item) => ({
      ...item,
      isRead: item.isRead || readIds.includes(item.id)
    }));
  }, [getLocallyReadIds]);

  const synchronizeAllNotifications = useCallback(async () => {
    const localItems = loadStoredResponderNotifications();
    const readIds = getLocallyReadIds();

    try {
      const apiAlerts = await requestJson<RawNotificationPayload[]>('/api/alerts', { method: 'GET' });
      if (Array.isArray(apiAlerts) && apiAlerts.length > 0) {
        const existingIds = new Set(localItems.map((i) => i.id));
        const mergedFromApi: ResponderNotificationItem[] = [];

        apiAlerts.slice(0, 15).forEach((alertItem, idx) => {
          const normalized = normalizeRawNotification(
            {
              ...alertItem,
              category: alertItem.category || 'INCIDENT HAPPENS ON'
            },
            idx + 200,
            readIds
          );
          if (!existingIds.has(normalized.id)) {
            existingIds.add(normalized.id);
            mergedFromApi.push(normalized);
          }
        });

        setNotifications([...localItems, ...mergedFromApi]);
        return;
      }
    } catch {
      // Ignore network jitter and use local responder notifications
    }

    setNotifications(localItems);
  }, [getLocallyReadIds, loadStoredResponderNotifications]);

  useEffect(() => {
    synchronizeAllNotifications();
    const intervalId = window.setInterval(synchronizeAllNotifications, ALERT_POLL_INTERVAL_MS);

    const handleCustomNotification = (event: Event) => {
      const customEvent = event as CustomEvent<RawNotificationPayload | undefined>;
      const detail = customEvent.detail;
      const readIds = getLocallyReadIds();

      if (detail && typeof detail === 'object') {
        const incoming = normalizeRawNotification(detail, Date.now() % 1000, readIds);
        try {
          const current = loadStoredResponderNotifications();
          const deduplicated = [
            incoming,
            ...current.filter((item) => item.id !== incoming.id)
          ];
          window.localStorage.setItem(
            RESPONDER_NOTIFICATIONS_STORAGE_KEY,
            JSON.stringify(deduplicated)
          );
        } catch {
          // Ignore quota error
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
            category: detail.category || 'INCIDENT HAPPENS ON',
            title: detail.title || 'New Emergency Incident Reported on Sector Radar'
          },
          Date.now() % 1000,
          readIds
        );
        try {
          const current = loadStoredResponderNotifications();
          const deduplicated = [
            incoming,
            ...current.filter((item) => item.id !== incoming.id)
          ];
          window.localStorage.setItem(
            RESPONDER_NOTIFICATIONS_STORAGE_KEY,
            JSON.stringify(deduplicated)
          );
        } catch {
          // Ignore quota error
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
  }, [getLocallyReadIds, loadStoredResponderNotifications, synchronizeAllNotifications]);

  // Close popover when clicking outside
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

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'UNREAD') return !item.isRead;
      return item.category === activeFilter;
    });
  }, [notifications, activeFilter]);

  const countByCategory = useCallback(
    (cat: ResponderNotificationCategory): number =>
      notifications.filter((n) => n.category === cat).length,
    [notifications]
  );

  const persistNotificationsState = (updated: ResponderNotificationItem[]) => {
    setNotifications(updated);
    try {
      window.localStorage.setItem(
        RESPONDER_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(updated)
      );
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

    const updated = notifications.map((n) =>
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
    navigate(item.targetRoute || '/responder');
  };

  const handleMarkAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    const combinedRead = Array.from(new Set([...getLocallyReadIds(), ...allIds]));
    try {
      window.localStorage.setItem(LOCAL_STORAGE_READ_KEY, JSON.stringify(combinedRead));
    } catch {
      // Ignore storage error
    }
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    persistNotificationsState(updated);
  };

  const handleClearReadNotifications = () => {
    const remaining = notifications.filter((n) => !n.isRead);
    persistNotificationsState(remaining.length > 0 ? remaining : []);
  };

  const getCategoryVisuals = (category: ResponderNotificationCategory) => {
    switch (category) {
      case 'REQUEST DISPATCH DEPLOY':
        return {
          icon: Send,
          badgeClass: 'bg-sky-950/90 text-sky-300 border-sky-500/60',
          iconWrapClass: 'bg-sky-950/80 border-sky-500/50 text-sky-400',
          routeLabel: 'OPEN REQUEST & DEPLOY'
        };
      case 'ADMIN REQUEST YOU TO DEPLOY':
        return {
          icon: Radio,
          badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-500/70 animate-pulse',
          iconWrapClass: 'bg-rose-950/80 border-rose-500/60 text-rose-400',
          routeLabel: 'DEPLOY ORDER -> REQUEST & DEPLOY'
        };
      case 'INCIDENT HAPPENS ON':
        return {
          icon: AlertTriangle,
          badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-500/60',
          iconWrapClass: 'bg-amber-950/80 border-amber-500/50 text-amber-400',
          routeLabel: 'OPEN CASUALTY DISPATCHES'
        };
      case 'SUBMITTED INCIDENT LOGS':
        return {
          icon: FileText,
          badgeClass: 'bg-indigo-950/90 text-indigo-300 border-indigo-500/60',
          iconWrapClass: 'bg-indigo-950/80 border-indigo-500/50 text-indigo-400',
          routeLabel: 'OPEN INCIDENT LOGS'
        };
      case 'VERIFIED SUBMITTED INCIDENT LOGS':
        return {
          icon: ShieldCheck,
          badgeClass: 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60',
          iconWrapClass: 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400',
          routeLabel: 'VIEW 5-MIN VERIFIED TIMER'
        };
      case 'CLOSE CASE':
        return {
          icon: CheckCircle2,
          badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60',
          iconWrapClass: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400',
          routeLabel: 'VIEW CLOSED CASE LOG'
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
      'ResQTrack Emergency Response Command System\nKatipunan, Zamboanga del Norte\nHotline: 911 / (065) 908-1234'
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

  return (
    <header
      className="topbar select-none relative"
      style={{ zIndex: isAlertsOpen ? 999999 : 100000 }}
      role="banner"
    >
      <div
        className="brandbar flex items-center justify-between transition-all duration-200 border-r border-white/5 pr-3 overflow-hidden"
        style={{
          width: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR,
          minWidth: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR
        }}
      >
        {!isCollapsed ? (
          <div>
            <span className="brandbar__mark">
              Res<span className="brandbar__accent">Qtrack</span>
            </span>
            <span className="brandbar__sub">Katipunan Emergency Response</span>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <span className="brandbar__mark text-base">
              R<span className="brandbar__accent">Q</span>
            </span>
          </div>
        )}
      </div>

      <form className="search" id="search-form" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search className="search__icon w-4 h-4 text-slate-400 pointer-events-none flex-shrink-0" aria-hidden="true" />
        <input
          className="search__input"
          id="search"
          type="search"
          name="q"
          placeholder="Search coordinates, incident ID, or responder..."
          autoComplete="off"
          spellCheck={false}
          aria-label="Search coordinates, incident ID, or responder"
        />
      </form>

      <div className="topbar__actions flex items-center gap-1 sm:gap-2">
        <div className={`alerts relative ${isAlertsOpen ? 'z-[999999]' : ''}`} id="alerts" ref={bellWrapperRef}>
          <button
            className="iconbtn relative flex items-center justify-center p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
            type="button"
            id="btn-alerts"
            title="Hospital ER Alarms & Tactical Notifications"
            aria-label={`Notifications and Hospital ER Alarms (${unreadCount} unread)`}
            aria-haspopup="true"
            aria-expanded={isAlertsOpen}
            aria-controls="alerts-panel"
            onClick={handleToggleAlerts}
          >
            <Bell className="w-4 h-4 text-slate-300 hover:text-white transition-colors" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="iconbtn__dot absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center border border-slate-900 shadow-md animate-pulse"
                aria-label={`${unreadCount} unread alerts`}
              >
                {unreadCount > MAX_DISPLAY_UNREAD_COUNT ? `${MAX_DISPLAY_UNREAD_COUNT}+` : unreadCount}
              </span>
            )}
          </button>

          {/* Consolidated Hospital ER Alarms & 6-Category Responder Notification Bell Popover */}
          {isAlertsOpen && typeof document !== 'undefined' && createPortal(
            <>
              <div
                className="fixed inset-0 z-[999998] bg-black/20 backdrop-blur-[0.5px]"
                onClick={() => setIsAlertsOpen(false)}
                aria-hidden="true"
              />
              <section
                className={`alerts__panel fixed top-14 right-2 sm:right-4 z-[999999] ${
                  isMobile ? 'inset-x-2 w-auto' : 'w-[400px] sm:w-[480px] md:w-[540px]'
                } max-w-[calc(100vw-1rem)] max-h-[85vh] border border-slate-700/90 shadow-2xl rounded-2xl bg-slate-950/98 backdrop-blur-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150`}
                id="alerts-panel"
                aria-label="Hospital ER Alarms and Tactical Notifications"
                role="region"
                onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
              >
              {/* Popover Header */}
              <header className="flex flex-col gap-2.5 px-4 py-3 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
                    <Bell className="w-4 h-4 text-sky-400 flex-shrink-0" aria-hidden="true" />
                    <h2 className="text-xs font-black font-mono tracking-wider text-white uppercase truncate">
                      HOSPITAL ER ALARMS &amp; DISPATCH NOTIFICATIONS
                    </h2>
                    {unreadCount > 0 ? (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-rose-600/30 text-rose-300 border border-rose-500/50 rounded flex-shrink-0">
                        {unreadCount} NEW
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400 flex-shrink-0">
                        ALL CLEAR
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAlertsOpen(false)}
                    aria-label="Close notifications panel"
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Action Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSirenMuted((prev) => !prev)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold border inline-flex items-center gap-1 transition-all ${
                        sirenMuted
                          ? 'bg-slate-950 text-slate-400 border-slate-800'
                          : 'bg-rose-950/70 text-rose-300 border-rose-600/60'
                      }`}
                    >
                      {sirenMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      <span>{sirenMuted ? 'ER SIREN MUTED' : 'ER SIREN ACTIVE'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAlertsOpen(false);
                        navigate('/responder');
                      }}
                      className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-slate-950 text-sky-400 border border-slate-800 hover:border-sky-500/50 transition-colors"
                    >
                      RADAR BOARD
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/60 transition-colors"
                      title="Mark all notifications as read"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>MARK ALL READ</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearReadNotifications}
                      className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-300 hover:text-rose-300 px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-rose-800 transition-colors"
                      title="Clear read notifications"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>CLEAR READ</span>
                    </button>
                  </div>
                </div>

                {/* Category Filter Pills (All + Unread + 6 User-Requested Notification Categories) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('ALL')}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                      activeFilter === 'ALL'
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ALL ({notifications.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('UNREAD')}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                      activeFilter === 'UNREAD'
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-950 text-amber-300 border-amber-900/60 hover:border-amber-700'
                    }`}
                  >
                    UNREAD ({unreadCount})
                  </button>

                  {NOTIFICATION_CATEGORIES.map((category) => {
                    const count = countByCategory(category);
                    const isSelected = activeFilter === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveFilter(category)}
                        className={`px-2 py-1 rounded text-[9px] font-mono font-bold border transition-all ${
                          isSelected
                            ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-sm'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {category} ({count})
                      </button>
                    );
                  })}
                </div>
              </header>

              {/* Notification Items Feed */}
              <ul className="divide-y divide-slate-800/80 max-h-[420px] overflow-y-auto bg-slate-950" id="alerts-list">
                {filteredNotifications.length === 0 ? (
                  <li className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-1.5">
                    <Bell className="w-7 h-7 text-slate-600" />
                    <p className="text-xs font-mono font-bold text-slate-300">
                      NO NOTIFICATIONS IN [{activeFilter}]
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Hospital ER alarms and responder dispatch channels are actively monitored.
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
                            ? 'bg-sky-950/20 hover:bg-sky-950/35 border-l-2 border-l-sky-400'
                            : 'bg-slate-950 hover:bg-slate-900/70 opacity-85 hover:opacity-100'
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
                              className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider border ${visuals.badgeClass}`}
                            >
                              {item.category}
                            </span>

                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                              <span className="text-sky-400 font-bold">{item.referenceCode}</span>
                              <span>&bull;</span>
                              <span className="inline-flex items-center gap-0.5">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {formatTimeAgo(item.timestamp)}
                              </span>
                            </div>
                          </div>

                          {/* Title & Message */}
                          <p className="text-xs font-bold text-white leading-snug">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-300 font-sans mt-0.5 line-clamp-2 leading-relaxed">
                            {item.message}
                          </p>

                          {/* Bottom Row: Navigation Action & Read Toggle */}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-sky-400 hover:underline">
                              <span>{visuals.routeLabel}</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </span>

                            {!item.isRead ? (
                              <button
                                type="button"
                                onClick={(e) => handleMarkSingleRead(item, e)}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-[10px] font-mono font-bold inline-flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>ACK READ</span>
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500 inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span>ACKNOWLEDGED</span>
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
          className="iconbtn iconbtn--desk p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all hidden sm:flex items-center justify-center"
          type="button"
          id="btn-settings"
          aria-label="Settings"
          title="Profile Settings"
          onClick={handleSettingsClick}
        >
          <Settings className="w-4 h-4 text-slate-300 hover:text-white transition-colors" aria-hidden="true" />
        </button>

        <button
          className="iconbtn iconbtn--desk p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all hidden sm:flex items-center justify-center"
          type="button"
          id="btn-help"
          aria-label="Help"
          title="Emergency Command Support"
          onClick={handleHelpClick}
        >
          <HelpCircle className="w-4 h-4 text-slate-300 hover:text-white transition-colors" aria-hidden="true" />
        </button>

        <span className="topbar__sep w-px h-5 bg-white/10 mx-1" aria-hidden="true" />

        {/* User profile avatar session chip with profile card toggle */}
        <UserSessionChip user={user} />

        {/* Dedicated Logout button cleanly positioned after avatar */}
        <button
          className="iconbtn iconbtn--logout group flex items-center justify-center p-2 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/80 border border-rose-900/50 hover:border-rose-700 ml-1.5 transition-all focus:outline-none focus:ring-1 focus:ring-rose-500"
          type="button"
          id="btn-logout"
          title="Sign Out of Session"
          aria-label="Sign Out"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 text-rose-400 group-hover:text-white transition-colors" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};

export default Header;
