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
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        setError(null);
      } else {
        setSession(null);
        if (res.status === 403) {
          setError('Account suspended by administration.');
        }
      }
    } catch {
      setSession(null);
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
      setSession(null);
      navigate('/login');
    }
  }, [navigate]);

  return { session, isLoading, error, refreshSession: fetchSession, logout };
};
