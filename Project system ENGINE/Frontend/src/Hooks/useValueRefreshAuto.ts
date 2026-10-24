// [Layer: Hooks]
// Responsibility: Automatic polling, interval refresh, and event-based refresh hook for UI values.
// Supports dynamic polling interval, tab focus detection, manual trigger, and last refreshed telemetry.

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseValueRefreshAutoOptions {
  intervalMs?: number;
  enabled?: boolean;
  pauseOnHidden?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export interface UseValueRefreshAutoReturn {
  isRefreshing: boolean;
  lastRefreshedAt: Date;
  refreshNow: () => Promise<void>;
  toggleAutoRefresh: (val?: boolean) => void;
  isEnabled: boolean;
}

export const useValueRefreshAuto = (
  callback?: () => void | Promise<void>,
  options: UseValueRefreshAutoOptions = {}
): UseValueRefreshAutoReturn => {
  const {
    intervalMs = 8000,
    enabled = true,
    pauseOnHidden = true,
    onRefresh
  } = options;

  const [isEnabled, setIsEnabled] = useState<boolean>(enabled);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  
  const savedCallback = useRef<(() => void | Promise<void>) | undefined>(callback || onRefresh);

  useEffect(() => {
    savedCallback.current = callback || onRefresh;
  }, [callback, onRefresh]);

  const refreshNow = useCallback(async () => {
    if (!savedCallback.current) return;
    setIsRefreshing(true);
    try {
      await savedCallback.current();
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('[useValueRefreshAuto] Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const toggleAutoRefresh = useCallback((val?: boolean) => {
    setIsEnabled((prev) => (val !== undefined ? val : !prev));
  }, []);

  useEffect(() => {
    if (!isEnabled || intervalMs <= 0) return;

    const timer = setInterval(() => {
      if (pauseOnHidden && typeof document !== 'undefined' && document.hidden) {
        return;
      }
      refreshNow();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isEnabled, intervalMs, pauseOnHidden, refreshNow]);

  // Also trigger refresh when tab becomes visible again
  useEffect(() => {
    if (!isEnabled || !pauseOnHidden) return;

    const handleVisibility = () => {
      if (!document.hidden) {
        refreshNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isEnabled, pauseOnHidden, refreshNow]);

  return {
    isRefreshing,
    lastRefreshedAt,
    refreshNow,
    toggleAutoRefresh,
    isEnabled
  };
};

export default useValueRefreshAuto;
