// [Layer: LayoutBars]
// Responsibility: Emergency alert notification drawer modal displaying unit-scoped emergency broadcasts and incident notifications.
// Dynamic synchronization with GET /api/alerts and POST /api/alerts/{reportId}/read.
// Official Cherry (#670626) & Warm Ivory (#F7F1EA) Stitch claymorphism with strict typing (ZERO any) and arrow syntax.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  AlertCircle,
  Info,
  Flame,
  HeartPulse,
  Shield,
  Clock
} from 'lucide-react';
import { requestJson } from '@/Endpoints/apiClient';
import { useSession } from '@/Hooks/useSession';

export interface AlertNotificationItem {
  reportId?: string;
  id?: string;
  referenceCode?: string;
  title: string;
  category?: string;
  severity?: string;
  status?: string;
  timestamp?: string;
  createdAt?: string;
  isRead?: boolean;
  hasImage?: boolean;
  imageUrl?: string | null;
  reporterName?: string;
  type?: string;
  targetUnit?: string;
  recommendedAgencyUnit?: string;
}

export interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LOCAL_STORAGE_READ_KEY = 'resqtrack.alerts.read';
const FALLBACK_CATEGORY_LABEL = 'INCIDENT';
const MAX_ALERT_ITEMS_DISPLAY = 25;

type AlertFilterKey = 'ALL' | 'UNREAD' | 'CRITICAL' | 'VERIFIED';
type AlertSortKey = 'newest' | 'oldest' | 'severity';

const ALERT_SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 5,
  SEVERE: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const normalizeUnitCode = (unit?: string): string => {
  const upper = (unit || '').toUpperCase().trim();
  if (upper === 'MEDIC') return 'RHU';
  if (upper === 'BFP') return 'FIRE';
  if (upper === 'SECURITY' || upper === 'POLICE') return 'PNP';
  return upper;
};

const matchesResponderUnitAlert = (
  item: AlertNotificationItem,
  role?: string,
  unit?: string
): boolean => {
  const normRole = (role || '').toLowerCase();
  if (normRole !== 'responder') return true;

  const normUnit = normalizeUnitCode(unit);
  if (!normUnit || normUnit === 'NONE') return true;

  const explicitTarget = normalizeUnitCode(item.targetUnit || item.recommendedAgencyUnit);
  if (explicitTarget && explicitTarget !== 'NONE') {
    return explicitTarget === normUnit;
  }

  const text = `${item.category || ''} ${item.type || ''} ${item.title || ''} ${item.referenceCode || ''}`.toUpperCase();

  if (normUnit === 'FIRE') {
    return (
      text.includes('FIRE') ||
      text.includes('HAZMAT') ||
      text.includes('FLAME') ||
      text.includes('SMOKE') ||
      text.includes('ARSON') ||
      text.includes('ELECTRICAL') ||
      text.includes('SPARK') ||
      text.includes('GAS') ||
      text.includes('BFP')
    );
  }

  if (normUnit === 'RHU') {
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
      text.includes('CARDIAC') ||
      text.includes('RESPIRATORY') ||
      text.includes('LACERATION') ||
      text.includes('INJURY')
    );
  }

  if (normUnit === 'PNP') {
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
      text.includes('DISTURBANCE') ||
      text.includes('BLOTTER') ||
      text.includes('ASSAULT') ||
      text.includes('THEFT')
    );
  }

  return true;
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const { session } = useSession();
  const [alerts, setAlerts] = useState<AlertNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<AlertFilterKey>('ALL');
  const [sortOrder, setSortOrder] = useState<AlertSortKey>('newest');
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_READ_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const getAlertKey = useCallback((item: AlertNotificationItem): string => {
    return item.reportId || item.id || item.referenceCode || '';
  }, []);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      try {
        const data = await requestJson<AlertNotificationItem[]>('/api/alerts', { method: 'GET' });
        if (Array.isArray(data) && data.length > 0) {
          setAlerts(data.slice(0, MAX_ALERT_ITEMS_DISPLAY));
          return;
        }
      } catch {
        // Fallback to reports endpoint below
      }

      try {
        const repData = await requestJson<{ reports?: AlertNotificationItem[] } | AlertNotificationItem[]>('/api/reports', { method: 'GET' });
        if (Array.isArray(repData)) {
          setAlerts(repData.slice(0, MAX_ALERT_ITEMS_DISPLAY));
        } else if (repData && Array.isArray(repData.reports)) {
          setAlerts(repData.reports.slice(0, MAX_ALERT_ITEMS_DISPLAY));
        }
      } catch {
        // Fallback exhausted
      }
    } catch (err) {
      console.warn('Alerts fetch deferred due to network state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, fetchAlerts]);

  const scopedAlerts = useMemo(
    () => alerts.filter((item) => matchesResponderUnitAlert(item, session?.role, session?.unit)),
    [alerts, session?.role, session?.unit]
  );

  const markAlertAsRead = useCallback(
    async (alertKey: string) => {
      if (!alertKey) return;

      setReadIds((prev) => {
        if (prev.includes(alertKey)) return prev;
        const next = [...prev, alertKey];
        try {
          window.localStorage.setItem(LOCAL_STORAGE_READ_KEY, JSON.stringify(next));
        } catch {
          // Ignore local storage quota limits
        }
        return next;
      });

      setAlerts((prev) =>
        prev.map((item) => (getAlertKey(item) === alertKey ? { ...item, isRead: true } : item))
      );

      try {
        await requestJson<{ message?: string }>(`/api/alerts/${encodeURIComponent(alertKey)}/read`, {
          method: 'POST'
        });
      } catch (err) {
        console.warn('Alert read acknowledgment deferred:', err);
      }

      window.dispatchEvent(new CustomEvent('resqtrack:alerts-updated'));
    },
    [getAlertKey]
  );

  const handleMarkAllRead = useCallback(async () => {
    const allKeys = scopedAlerts.map((a) => getAlertKey(a)).filter((k) => k.length > 0);
    const combined = Array.from(new Set([...readIds, ...allKeys]));
    setReadIds(combined);

    try {
      window.localStorage.setItem(LOCAL_STORAGE_READ_KEY, JSON.stringify(combined));
    } catch {
      // Ignore quota error
    }

    setAlerts((prev) =>
      prev.map((item) => (allKeys.includes(getAlertKey(item)) ? { ...item, isRead: true } : item))
    );

    for (const key of allKeys) {
      try {
        await requestJson<{ message?: string }>(`/api/alerts/${encodeURIComponent(key)}/read`, {
          method: 'POST'
        });
      } catch {
        // Individual failure tolerated
      }
    }

    window.dispatchEvent(new CustomEvent('resqtrack:alerts-updated'));
  }, [scopedAlerts, getAlertKey, readIds]);

  const renderCategoryIcon = (category?: string, severity?: string) => {
    const normCat = (category || '').toUpperCase();
    const normSev = (severity || '').toUpperCase();

    if (normCat.includes('FIRE') || normCat.includes('FLAME') || normCat.includes('HAZMAT')) {
      return <Flame className="w-4 h-4 text-[#670626] flex-shrink-0" aria-hidden="true" />;
    }
    if (normCat.includes('MEDIC') || normCat.includes('TRAUMA') || normCat.includes('HEALTH')) {
      return <HeartPulse className="w-4 h-4 text-[#670626] flex-shrink-0" aria-hidden="true" />;
    }
    if (normCat.includes('POLICE') || normCat.includes('SECURITY') || normCat.includes('CRIME')) {
      return <Shield className="w-4 h-4 text-[#670626] flex-shrink-0" aria-hidden="true" />;
    }
    if (normSev === 'CRITICAL' || normSev === 'HIGH') {
      return <AlertCircle className="w-4 h-4 text-[#670626] flex-shrink-0" aria-hidden="true" />;
    }
    return <AlertCircle className="w-4 h-4 text-[#A83B4D] flex-shrink-0" aria-hidden="true" />;
  };

  if (!isOpen) return null;

  const unreadAlertsCount = scopedAlerts.filter((item) => {
    const key = getAlertKey(item);
    return !item.isRead && !readIds.includes(key);
  }).length;

  const filteredAlerts = useMemo(() => {
    const filtered = scopedAlerts.filter((item) => {
      const key = getAlertKey(item);
      const isRead = Boolean(item.isRead || readIds.includes(key));
      if (activeFilter === 'UNREAD') return !isRead;
      if (activeFilter === 'CRITICAL') {
        const sev = (item.severity || '').toUpperCase();
        return sev === 'CRITICAL' || sev === 'SEVERE' || sev === 'HIGH';
      }
      if (activeFilter === 'VERIFIED') {
        const st = (item.status || '').toUpperCase();
        return st === 'VERIFIED' || st === 'RESOLVED' || st === 'CLOSED';
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const tsA = Date.parse(a.timestamp || a.createdAt || '') || 0;
      const tsB = Date.parse(b.timestamp || b.createdAt || '') || 0;
      if (sortOrder === 'oldest') return tsA - tsB;
      if (sortOrder === 'severity') {
        const sevA = ALERT_SEVERITY_RANK[(a.severity || '').toUpperCase()] ?? 1;
        const sevB = ALERT_SEVERITY_RANK[(b.severity || '').toUpperCase()] ?? 1;
        if (sevA !== sevB) return sevB - sevA;
      }
      return tsB - tsA;
    });
  }, [scopedAlerts, readIds, activeFilter, sortOrder, getAlertKey]);

  return (
    <section
      className="alerts__panel clay-surface z-[100001] overflow-hidden rounded-2xl"
      id="alerts-panel"
      aria-label="Emergency Alerts and Notifications"
      role="region"
    >
      <header className="alerts__head flex flex-col gap-2 px-4 py-3.5 bg-[#670626] text-[#F7F1EA] border-b border-[#FFD9DD]/20 select-none">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-4 h-4 text-[#FFD9DD] flex-shrink-0" aria-hidden="true" />
            <h2 className="alerts__title text-sm font-extrabold font-sans tracking-wide text-[#F7F1EA]">
              Notifications
            </h2>
            {unreadAlertsCount > 0 ? (
              <span className="alerts__count px-2 py-0.5 text-xs font-mono font-bold bg-[#F7F1EA] text-[#670626] rounded-md">
                {unreadAlertsCount} New
              </span>
            ) : (
              <span className="alerts__count is-off text-xs font-mono text-[#FFD9DD]">
                All Clear
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadAlertsCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="relative z-10 pointer-events-auto cursor-pointer flex items-center gap-1.5 text-xs font-mono font-semibold text-[#F7F1EA] hover:bg-[#4A041A] transition-colors px-2.5 py-1 rounded-lg border border-[#FFD9DD]/25"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>Mark Read</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close alerts panel"
              className="relative z-10 pointer-events-auto cursor-pointer p-1.5 rounded-lg text-[#FFD9DD] hover:text-[#F7F1EA] hover:bg-[#4A041A] transition-colors"
            >
              <X className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        <p className="text-xs text-[#FFD9DD] font-medium leading-snug">
          Official dispatch &amp; hazard advisories
        </p>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#FFD9DD]/15">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { key: 'ALL', label: 'All' },
                { key: 'UNREAD', label: 'Unread' },
                { key: 'CRITICAL', label: 'Critical' },
                { key: 'VERIFIED', label: 'Verified' }
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                className={`relative z-10 pointer-events-auto cursor-pointer px-2 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                  activeFilter === f.key
                    ? 'bg-[#F7F1EA] text-[#670626] border-[#F7F1EA]'
                    : 'bg-[#400014] text-[#FFD9DD] border-[#FFD9DD]/20 hover:border-[#FFD9DD]/45'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {(
              [
                { key: 'newest', label: 'Newest' },
                { key: 'oldest', label: 'Oldest' },
                { key: 'severity', label: 'Severity' }
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSortOrder(s.key)}
                className={`relative z-10 pointer-events-auto cursor-pointer px-2 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                  sortOrder === s.key
                    ? 'bg-[#F7F1EA] text-[#670626] border-[#F7F1EA]'
                    : 'bg-[#400014] text-[#FFD9DD] border-[#FFD9DD]/20 hover:border-[#FFD9DD]/45'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <ul className="alerts__list divide-y divide-[#A83B4D]/15 max-h-[380px] overflow-y-auto bg-[#F7F1EA]" id="alerts-list">
        {isLoading && filteredAlerts.length === 0 ? (
          <li className="p-6 text-center text-sm text-[#670626] font-mono flex flex-col items-center gap-2">
            <Clock className="w-5 h-5 text-[#A83B4D] animate-spin" aria-hidden="true" />
            <span>Loading alerts...</span>
          </li>
        ) : filteredAlerts.length === 0 ? (
          <li className="p-8 text-center text-[#2B010E] flex flex-col items-center justify-center">
            <Info className="w-8 h-8 text-[#A83B4D] mb-2 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm font-bold text-[#670626]">All Clear</p>
            <p className="text-xs text-[#A83B4D] font-mono mt-1">No alerts match this filter.</p>
          </li>
        ) : (
          filteredAlerts.map((report) => {
            const key = getAlertKey(report);
            const isRead = Boolean(report.isRead || readIds.includes(key));
            const displayTitle = report.title || report.type || 'Incident Dispatch Alert';
            const displayCategory = (report.category || report.type || FALLBACK_CATEGORY_LABEL).toUpperCase();
            const displayRef = report.referenceCode || report.id || report.reportId || 'ALERT';
            const displayReporter = report.reporterName ? ` \u00B7 ${report.reporterName}` : '';

            return (
              <li
                key={key || displayTitle}
                className={`alert transition-all flex items-start gap-3 p-3.5 cursor-pointer select-none ${
                  !isRead ? 'is-unread bg-[#FAF5EE] hover:bg-[#E9D9D0]/75' : 'bg-[#F7F1EA] hover:bg-[#E9D9D0]/55 opacity-85 hover:opacity-100'
                }`}
                tabIndex={0}
                role="button"
                onClick={() => markAlertAsRead(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    markAlertAsRead(key);
                  }
                }}
                aria-label={`${displayTitle}, ${displayCategory}`}
              >
                {report.hasImage && report.imageUrl ? (
                  <img
                    className="alert__thumb w-12 h-12 rounded-xl object-cover border border-[#A83B4D]/25 bg-[#E9D9D0] flex-shrink-0"
                    src={report.imageUrl}
                    alt={displayTitle}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl border border-[#A83B4D]/25 bg-[#E9D9D0] flex items-center justify-center flex-shrink-0">
                    {renderCategoryIcon(report.category, report.severity)}
                  </div>
                )}

                <div className="alert__body flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="alert__title text-sm font-bold text-[#2B010E] truncate">
                      {displayTitle}
                    </p>
                    {isRead ? (
                      <Check className="w-3.5 h-3.5 text-[#A83B4D] flex-shrink-0" aria-label="Read" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#670626] flex-shrink-0 animate-pulse" aria-hidden="true" />
                    )}
                  </div>
                  <p className="alert__meta text-xs font-mono text-[#A83B4D] tracking-wider truncate mt-0.5">
                    {displayCategory} &middot; {displayRef}{displayReporter}
                  </p>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
};

export default NotificationsModal;
