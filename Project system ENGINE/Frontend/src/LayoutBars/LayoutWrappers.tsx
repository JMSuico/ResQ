// [Layer: LayoutBars]
// Responsibility: Master layout wrappers connecting Header, dynamic role-tailored Sidebar, and page views.
// Ensures authentic RISKQTRAK app-shell structure with dynamic role-based session hydration.

import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ResQTrackSvgSprite } from '../Shared/ResQTrackSvgSprite';
import { PageErrorBoundary } from '../Shared/PageErrorBoundary';
import { useSession } from '../Hooks/useSession';
import { DrawerSidebarProvider } from '../Shared/ToggleDrawerSidebarMenu';

export interface LayoutWrappersProps {
  children?: React.ReactNode;
  defaultRole?: string;
  defaultUnit?: string;
}

const getTabSession = (): { unit?: string; fullName?: string; employeeOrResidentId?: string; employeeId?: string; role?: string; status?: string; faceVerified?: boolean } | null => {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Tab-isolated session storage (Guarantees independent sessions across tabs)
    const tabRaw = sessionStorage.getItem('resqtrack_session') || sessionStorage.getItem('resqtrack_user');
    if (tabRaw) return JSON.parse(tabRaw);

    // 2. Active tab unit-specific local storage
    const tabUnit = (sessionStorage.getItem('resqtrack_unit') || '').toLowerCase().trim();
    if (tabUnit && tabUnit !== 'none') {
      const unitRaw = localStorage.getItem(`resqtrack_session_${tabUnit}`) || localStorage.getItem(`resqtrack_user_${tabUnit}`);
      if (unitRaw) return JSON.parse(unitRaw);
    }

    const port = window.location.port || '5173';
    if (port === '5174') {
      const adminRaw = localStorage.getItem('resqtrack_session_5174') || localStorage.getItem('resqtrack_user_5174');
      if (adminRaw) return JSON.parse(adminRaw);
    } else {
      const portRaw = localStorage.getItem(`resqtrack_session_${port}`) || localStorage.getItem(`resqtrack_user_${port}`);
      if (portRaw) {
        const parsed = JSON.parse(portRaw);
        if (!(parsed.role || '').toLowerCase().includes('admin')) {
          return parsed;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
};

export const LayoutWrappers: React.FC<LayoutWrappersProps> = ({
  children,
  defaultRole = 'LDRRMO_Admin',
  defaultUnit = 'LDRRMO'
}) => {
  const { session } = useSession();
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const tabSession = getTabSession();

  // Authoritative role and unit from tab session first, then active session
  const activeRole = tabSession?.role || session?.role || defaultRole;
  const activeUnit = tabSession?.unit || session?.unit || defaultUnit;

  // Strict port 5174 enforcement: Port 5174 will NEVER display Responder or Civilian views
  const rawRoleLower = (activeRole || '').toLowerCase();
  const isAdmin = rawRoleLower.includes('admin') || rawRoleLower.includes('ldrrmo') || rawRoleLower === '1';

  if (currentPort === '5174' && !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  const user = {
    name: tabSession?.fullName || session?.fullName || (isAdmin ? 'LDRRMO Commander' : 'Active Duty Officer'),
    id: tabSession?.employeeOrResidentId || tabSession?.employeeId || session?.employeeOrResidentId || session?.employeeId || 'OP-773-567-009',
    role: activeRole,
    unit: activeUnit,
    status: tabSession?.status || session?.status || 'Verified',
    faceVerified: tabSession?.faceVerified ?? session?.faceVerified ?? true
  };

  return (
    <DrawerSidebarProvider>
      <div className="app-shell">
        <ResQTrackSvgSprite />
        <Header user={user} />
        <div className="dash relative z-10 flex flex-1 min-h-0 w-full overflow-hidden bg-slate-950">
          <Sidebar userRole={activeRole} userUnit={activeUnit} />
          <main className="dash__main flex-1 w-full min-w-0 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8 md:px-10 md:py-8 lg:px-12 bg-slate-950/95 transition-all">
            <div className="w-full flex-1 min-h-0 flex flex-col max-w-[1720px] mx-auto">
              {children || (
                <PageErrorBoundary>
                  <Outlet context={{ user, session }} />
                </PageErrorBoundary>
              )}
            </div>
          </main>
        </div>
      </div>
    </DrawerSidebarProvider>
  );
};

export const LandingLayout: React.FC = () => {
  return (
    <div className="landing-shell">
      <ResQTrackSvgSprite />
      <Outlet />
    </div>
  );
};

export const AdminLayout: React.FC = () => {
  const { session } = useSession();
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const host = typeof window !== 'undefined' ? (window.location.hostname || '127.0.0.1') : '127.0.0.1';
  const tabSession = getTabSession();

  const activeRole = (tabSession?.role || session?.role || '').toLowerCase();
  const isAdmin = activeRole.includes('admin') || activeRole.includes('ldrrmo') || activeRole === '1';

  if (currentPort === '5174') {
    if (!isAdmin) {
      return <Navigate to="/admin/login" replace />;
    }
  } else if (currentPort === '5173') {
    if (isAdmin) {
      const token = typeof window !== 'undefined'
        ? (sessionStorage.getItem('resqtrack_token') || localStorage.getItem('resqtrack_token_5173') || localStorage.getItem('resqtrack_token'))
        : null;
      const targetUrl = token
        ? `http://${host}:5174/admin/dashboard?session_token=${encodeURIComponent(token)}`
        : `http://${host}:5174/admin/dashboard`;
      window.location.href = targetUrl;
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950 font-mono text-sm text-rose-400">
          Admin account detected. Redirecting to Executive Command (5174)...
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  return <LayoutWrappers defaultRole="LDRRMO_Admin" defaultUnit="LDRRMO" />;
};

export { ResponderLayout } from './ResponderLayout';

export const CivilianLayout: React.FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  if (currentPort === '5174') {
    return <Navigate to="/admin/login" replace />;
  }
  return <LayoutWrappers defaultRole="Civilian" defaultUnit="None" />;
};

export default LayoutWrappers;
