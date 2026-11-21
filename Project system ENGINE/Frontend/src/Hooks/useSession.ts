// [Layer: Hooks]
// Responsibility: Manages user authentication session state, status verification, and logout.
// DO NOT store plain text passwords in browser local storage.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchSessionWithClientHeaders,
  logoutSessionWithClientHeaders
} from '@/Endpoints/authEndpoints';

export interface UserSession {
  userId: string;
  fullName: string;
  displayName?: string;
  email: string;
  employeeOrResidentId?: string;
  employeeId?: string;
  role: 'LDRRMO_Admin' | 'Responder' | 'Civilian' | string;
  unit: 'None' | 'LDRRMO' | 'RHU' | 'FIRE' | 'PNP' | 'Security' | string;
  status: 'Pending' | 'Verified' | 'Suspended' | string;
  faceVerified: boolean;
  departmentOrBarangay?: string;
  rankOrTitle?: string;
  targetDashboardUrl?: string;
}

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  // 1. Tab-isolated session storage token has absolute priority
  const tabToken = sessionStorage.getItem('resqtrack_token');
  if (tabToken && tabToken.trim() !== '') return tabToken;

  // 2. Unit-scoped token if tab has designated unit (RHU, FIRE, PNP)
  const tabUnit = (sessionStorage.getItem('resqtrack_unit') || '').toLowerCase().trim();
  if (tabUnit && tabUnit !== 'none') {
    const unitToken = localStorage.getItem(`resqtrack_token_${tabUnit}`);
    if (unitToken && unitToken.trim() !== '') return unitToken;
  }

  const port = window.location.port || '1998';
  if (port === '1996') {
    return localStorage.getItem('resqtrack_token_1996');
  }

  return (
    localStorage.getItem(`resqtrack_token_${port}`) ||
    localStorage.getItem('resqtrack_token')
  );
};

const getInitialSession = (): UserSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const port = window.location.port || '1998';
    // 1. Tab-level isolation (Medics, Fire, PNP tabs in same browser)
    const tabSession = sessionStorage.getItem('resqtrack_session') || sessionStorage.getItem('resqtrack_user');
    if (tabSession) {
      return JSON.parse(tabSession) as UserSession;
    }

    // 2. Tab-unit scoped fallback
    const tabUnit = (sessionStorage.getItem('resqtrack_unit') || '').toLowerCase().trim();
    if (tabUnit && tabUnit !== 'none') {
      const unitSession = localStorage.getItem(`resqtrack_session_${tabUnit}`) || localStorage.getItem(`resqtrack_user_${tabUnit}`);
      if (unitSession) return JSON.parse(unitSession) as UserSession;
    }

    // 3. Port-scoped fallback (Port 1996 vs Port 1998)
    if (port === '1996') {
      const portSession =
        localStorage.getItem('resqtrack_session_1996') ||
        localStorage.getItem('resqtrack_user_1996');
      if (portSession) {
        return JSON.parse(portSession) as UserSession;
      }
    } else {
      const portSession =
        localStorage.getItem(`resqtrack_session_${port}`) ||
        localStorage.getItem(`resqtrack_user_${port}`);
      if (portSession) {
        const parsed = JSON.parse(portSession) as UserSession;
        // Strict guard: Never hydrate an Admin session on Port 1998
        if ((parsed.role || '').toLowerCase().includes('admin')) {
          return null;
        }
        return parsed;
      }
    }

    return null;
  } catch {
    return null;
  }
};

export const useSession = () => {
  const [session, setSession] = useState<UserSession | null>(() => getInitialSession());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = getStoredToken();
      const port = typeof window !== 'undefined' ? window.location.port || '1998' : '1998';

      const res = await fetchSessionWithClientHeaders(port, token);
      if (res.ok && res.data) {
        const data = res.data as UserSession;
        setSession(data);
        if (typeof window !== 'undefined') {
          const unitKey = (data.unit || 'NONE').toLowerCase();
          const roleLower = (data.role || '').toLowerCase();
          const isAdminRole = roleLower.includes('admin') || roleLower.includes('ldrrmo');

          sessionStorage.setItem('resqtrack_session', JSON.stringify(data));
          sessionStorage.setItem('resqtrack_user', JSON.stringify(data));
          sessionStorage.setItem('resqtrack_unit', unitKey);

          // Store in unit-scoped local storage so other units (RHU, FIRE, PNP) are NEVER clobbered!
          if (unitKey && unitKey !== 'none') {
            localStorage.setItem(`resqtrack_session_${unitKey}`, JSON.stringify(data));
            localStorage.setItem(`resqtrack_user_${unitKey}`, JSON.stringify(data));
          }

          if (isAdminRole || port === '1996') {
            localStorage.setItem('resqtrack_session_1996', JSON.stringify(data));
            localStorage.setItem('resqtrack_user_1996', JSON.stringify(data));
          } else {
            localStorage.setItem(`resqtrack_session_${port}`, JSON.stringify(data));
            localStorage.setItem(`resqtrack_user_${port}`, JSON.stringify(data));
          }
        }
        setError(null);
      } else {
        if (res.status === 403) {
          setError('Account suspended by administration or port restriction.');
        } else if (res.status === 401 && !token) {
          setSession(null);
        }
      }
    } catch {
      // Offline fallback: retain active tab/port session
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('session_token');
      if (urlToken) {
        const port = window.location.port || '1998';
        sessionStorage.setItem('resqtrack_token', urlToken);
        localStorage.setItem(`resqtrack_token_${port}`, urlToken);
        localStorage.setItem('resqtrack_token', urlToken);

        searchParams.delete('session_token');
        const remainingQuery = searchParams.toString() ? `?${searchParams.toString()}` : '';
        const cleanUrl = `${window.location.pathname}${remainingQuery}${window.location.hash}`;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
    fetchSession();
  }, [fetchSession]);

  const logout = useCallback(async () => {
    try {
      const token = getStoredToken();
      const port = typeof window !== 'undefined' ? window.location.port || '1998' : '1998';
      await logoutSessionWithClientHeaders(port, token);
    } finally {
      if (typeof window !== 'undefined') {
        const port = window.location.port || '1998';
        const tabUnit = (sessionStorage.getItem('resqtrack_unit') || '').toLowerCase().trim();

        sessionStorage.removeItem('resqtrack_token');
        sessionStorage.removeItem('resqtrack_session');
        sessionStorage.removeItem('resqtrack_user');
        sessionStorage.removeItem('resqtrack_unit');

        if (tabUnit && tabUnit !== 'none') {
          localStorage.removeItem(`resqtrack_token_${tabUnit}`);
          localStorage.removeItem(`resqtrack_session_${tabUnit}`);
          localStorage.removeItem(`resqtrack_user_${tabUnit}`);
        }

        if (port === '1996') {
          localStorage.removeItem('resqtrack_token_1996');
          localStorage.removeItem('resqtrack_session_1996');
          localStorage.removeItem('resqtrack_user_1996');
        } else {
          localStorage.removeItem(`resqtrack_token_${port}`);
          localStorage.removeItem(`resqtrack_session_${port}`);
          localStorage.removeItem(`resqtrack_user_${port}`);
        }
      }
      setSession(null);
      const port = typeof window !== 'undefined' ? window.location.port : '';
      if (port === '1996') {
        navigate('/admin/login');
      } else {
        navigate('/login');
      }
    }
  }, [navigate]);

  return { session, isLoading, error, refreshSession: fetchSession, logout };
};
