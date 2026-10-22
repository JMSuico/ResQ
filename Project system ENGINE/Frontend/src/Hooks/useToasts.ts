// [Layer: Hooks]
// useToasts.ts -- Global toast notifications state hook.
// Dispatches temporary toast notifications for feedback, alerts, and operational cues.
// Universal lambda expressions (=>).
// DO NOT mutate active toast arrays without state setters.

import { useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export type ToastItem = ToastMessage;

export interface UseToastsReturn {
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
}

export const useToasts = (): UseToastsReturn => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};

export default useToasts;
