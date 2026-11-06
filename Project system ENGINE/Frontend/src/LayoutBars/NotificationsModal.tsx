// [Layer: LayoutBars]
// Responsibility: Tactical alert notification drawer modal displaying real-time emergency broadcasts and incident notifications.
// Dynamic synchronization with GET /api/alerts and POST /api/alerts/{reportId}/read.
// Universal Lucide icon standard with strict typing (ZERO any) and universal arrow syntax.

import React, { useState, useEffect, useCallback } from 'react';
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
}

export interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LOCAL_STORAGE_READ_KEY = 'resqtrack.alerts.read';
const FALLBACK_CATEGORY_LABEL = 'INCIDENT';
const MAX_ALERT_ITEMS_DISPLAY = 25;

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const [alerts, setAlerts] = useState<AlertNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
      // Primary: sync with backend AlertsController /api/alerts
      try {
        const data = await requestJson<AlertNotificationItem[]>('/api/alerts', { method: 'GET' });
        if (Array.isArray(data) && data.length > 0) {
          setAlerts(data.slice(0, MAX_ALERT_ITEMS_DISPLAY));
          return;
        }
      } catch {
        // Fallback to reports endpoint below
      }

      // Secondary fallback if /api/reports envelope is present
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

  const markAlertAsRead = useCallback(
    async (alertKey: string) => {
      if (!alertKey) return;

      // Optimistic state update
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

      // Backend sync
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
    const allKeys = alerts.map((a) => getAlertKey(a)).filter((k) => k.length > 0);
    const combined = Array.from(new Set([...readIds, ...allKeys]));
    setReadIds(combined);

    try {
      window.localStorage.setItem(LOCAL_STORAGE_READ_KEY, JSON.stringify(combined));
    } catch {
      // Ignore quota error
    }

    setAlerts((prev) => prev.map((item) => ({ ...item, isRead: true })));

    // Asynchronously acknowledge on backend
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
  }, [alerts, getAlertKey, readIds]);

  const renderCategoryIcon = (category?: string, severity?: string) => {
    const normCat = (category || '').toUpperCase();
    const normSev = (severity || '').toUpperCase();

    if (normCat.includes('FIRE') || normCat.includes('FLAME') || normCat.includes('HAZMAT')) {
      return <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" aria-hidden="true" />;
    }
    if (normCat.includes('MEDIC') || normCat.includes('TRAUMA') || normCat.includes('HEALTH')) {
      return <HeartPulse className="w-4 h-4 text-rose-400 flex-shrink-0" aria-hidden="true" />;
    }
    if (normCat.includes('POLICE') || normCat.includes('SECURITY') || normCat.includes('CRIME')) {
      return <Shield className="w-4 h-4 text-sky-400 flex-shrink-0" aria-hidden="true" />;
    }
    if (normSev === 'CRITICAL' || normSev === 'HIGH') {
      return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-hidden="true" />;
    }
    return <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true" />;
  };

  if (!isOpen) return null;

  const unreadAlertsCount = alerts.filter((item) => {
    const key = getAlertKey(item);
    return !item.isRead && !readIds.includes(key);
  }).length;

  return (
    <section
      className="alerts__panel z-[100001] border border-white/10 shadow-2xl rounded-xl bg-slate-950 overflow-hidden"
      id="alerts-panel"
      aria-label="Emergency Alerts and Notifications"
      role="region"
    >
      <header className="alerts__head flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-white/10 select-none">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-rose-500 flex-shrink-0" aria-hidden="true" />
          <h2 className="alerts__title text-xs font-bold font-mono tracking-wider text-white uppercase">
            Emergency Alerts
          </h2>
          {unreadAlertsCount > 0 ? (
            <span className="alerts__count px-1.5 py-0.5 text-[10px] font-mono font-bold bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded">
              {unreadAlertsCount} NEW
            </span>
          ) : (
            <span className="alerts__count is-off text-[10px] font-mono text-slate-500">
              ALL CLEAR
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadAlertsCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded hover:bg-emerald-950/40"
              title="Mark all notifications as read"
            >
              <CheckCheck className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span>Mark read</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close alerts panel"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          </button>
        </div>
      </header>

      <ul className="alerts__list divide-y divide-white/5 max-h-[380px] overflow-y-auto" id="alerts-list">
        {isLoading && alerts.length === 0 ? (
          <li className="p-6 text-center text-xs text-slate-400 font-mono flex flex-col items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500 animate-spin" aria-hidden="true" />
            <span>Synchronizing live alert feed...</span>
          </li>
        ) : alerts.length === 0 ? (
          <li className="p-8 text-center text-slate-400 flex flex-col items-center justify-center">
            <Info className="w-8 h-8 text-slate-600 mb-2 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-300">No Pending Emergency Alerts</p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Municipal dispatch channel is all clear</p>
          </li>
        ) : (
          alerts.map((report) => {
            const key = getAlertKey(report);
            const isRead = Boolean(report.isRead || readIds.includes(key));
            const displayTitle = report.title || report.type || 'Incident Dispatch Alert';
            const displayCategory = (report.category || report.type || FALLBACK_CATEGORY_LABEL).toUpperCase();
            const displayRef = report.referenceCode || report.id || report.reportId || 'ALERT';
            const displayReporter = report.reporterName ? ` \u00B7 ${report.reporterName}` : '';

            return (
              <li
                key={key || displayTitle}
                className={`alert transition-all flex items-start gap-3 p-3 cursor-pointer select-none ${
                  !isRead ? 'is-unread bg-rose-950/20 hover:bg-rose-950/30' : 'bg-transparent hover:bg-white/5 opacity-80 hover:opacity-100'
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
                    className="alert__thumb w-12 h-12 rounded-lg object-cover border border-white/10 bg-slate-900 flex-shrink-0"
                    src={report.imageUrl}
                    alt={displayTitle}
                    onError={(e) => {
                      // Fallback gracefully on image load error
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg border border-white/10 bg-slate-900 flex items-center justify-center flex-shrink-0">
                    {renderCategoryIcon(report.category, report.severity)}
                  </div>
                )}

                <div className="alert__body flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="alert__title text-xs font-semibold text-slate-200 truncate">
                      {displayTitle}
                    </p>
                    {isRead ? (
                      <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" aria-label="Read" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" aria-hidden="true" />
                    )}
                  </div>
                  <p className="alert__meta text-[10px] font-mono text-slate-400 tracking-wider truncate mt-0.5">
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
