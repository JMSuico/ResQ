// [Layer: Hooks]
// Responsibility: Manages user authentication session state, status verification, and logout.
// DO NOT store plain text passwords in browser local storage.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface UserSession {
  userId: string;
  fullName: string;
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

export const useSession = () => {
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const stored = typeof window !== 'undefined'
        ? (localStorage.getItem('resqtrack_session') || localStorage.getItem('resqtrack_user'))
        : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('resqtrack_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/session', { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('resqtrack_session', JSON.stringify(data));
        }
        setError(null);
      } else {
        if (res.status === 403) {
          setError('Account suspended by administration.');
        } else if (res.status === 401 && !token) {
          setSession(null);
        }
      }
    } catch {
      // Offline fallback: retain localStorage session
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('resqtrack_token');
        localStorage.removeItem('resqtrack_session');
        localStorage.removeItem('resqtrack_user');
      }
      setSession(null);
      navigate('/login');
    }
  }, [navigate]);

  return { session, isLoading, error, refreshSession: fetchSession, logout };
};
