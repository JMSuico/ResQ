// [Layer: Hooks]
// Responsibility: Dispatches and listens to resqtrack:report DOM custom events across components.
// DO NOT forget to remove event listener upon hook unmount.

import { useEffect, useCallback } from 'react';

export const useReportEventBus = <T = unknown>(onReportReceived?: (report: T) => void) => {
  const dispatchReportEvent = useCallback((report: T) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('resqtrack:report', { detail: report }));
    }
  }, []);

  useEffect(() => {
    if (!onReportReceived || typeof window === 'undefined') return;

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<T>;
      onReportReceived(customEvent.detail);
    };

    window.addEventListener('resqtrack:report', handler);
    return () => window.removeEventListener('resqtrack:report', handler);
  }, [onReportReceived]);

  return { dispatchReportEvent };
};
