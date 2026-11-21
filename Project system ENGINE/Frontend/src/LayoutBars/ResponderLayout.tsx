// [Layer: LayoutBars]
// Responsibility: Master layout wrapper for all emergency responder branches (RHU Medic, BFP Fire Rescue, and PNP Police Force).
// Dynamically reads active authenticated session, injects branch telemetry HUD banner, and binds Cherry/Ivory Stitch shell frame.
// ResQTrack Incident AI System Detection -- Universal Lucide icon standard with strict typing (ZERO any).

import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Shield, Activity } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { useSession } from '../Hooks/useSession';
import { useGpsLocation } from '../Hooks/useGpsLocation';
import { DrawerSidebarProvider } from '../Shared/ToggleDrawerSidebarMenu';

export interface ResponderLayoutProps {
  children?: React.ReactNode;
}

const DEFAULT_RESPONDER_ROLE = 'Responder';
const DEFAULT_RESPONDER_UNIT = 'RHU';
const DEFAULT_RESPONDER_NAME = 'Active Duty Responder';
const DEFAULT_VERIFIED_STATUS = 'Verified';

interface StoredResponderTabSession {
  unit?: string;
  fullName?: string;
  displayName?: string;
  employeeOrResidentId?: string;
  employeeId?: string;
  email?: string;
  role?: string;
  status?: string;
  faceVerified?: boolean;
}

const getTabSession = (): StoredResponderTabSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Tab-isolated session storage (Guarantees Tab 1 Medic never reads Fire)
    const tabRaw = sessionStorage.getItem('resqtrack_session') || sessionStorage.getItem('resqtrack_user');
    if (tabRaw) return JSON.parse(tabRaw) as StoredResponderTabSession;

    // 2. Active tab unit-specific local storage
    const tabUnit = (sessionStorage.getItem('resqtrack_unit') || '').toLowerCase().trim();
    if (tabUnit && tabUnit !== 'none') {
      const unitRaw = localStorage.getItem(`resqtrack_session_${tabUnit}`) || localStorage.getItem(`resqtrack_user_${tabUnit}`);
      if (unitRaw) return JSON.parse(unitRaw) as StoredResponderTabSession;
    }

    const port = window.location.port || '1997';
    const portRaw = localStorage.getItem(`resqtrack_session_${port}`) || localStorage.getItem(`resqtrack_user_${port}`);
    if (portRaw) {
      const parsed = JSON.parse(portRaw) as StoredResponderTabSession;
      if (!(parsed.role || '').toLowerCase().includes('admin')) {
        return parsed;
      }
    }
  } catch {
    return null;
  }
  return null;
};

export const ResponderLayout: React.FC<ResponderLayoutProps> = ({ children }) => {
  const { session } = useSession();
  const { isHardwareGeolocated, isLocating, error: gpsError, coords } = useGpsLocation();
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';

  // Strict Port Guard: Port 1996 will NEVER display Responder or Civilian views
  if (currentPort === '1996') {
    return <Navigate to="/admin/login" replace />;
  }

  const tabSession = getTabSession();

  // Authoritative role and unit from tab sessionStorage first, then active session
  const activeRole = tabSession?.role || session?.role || DEFAULT_RESPONDER_ROLE;
  const rawUnit =
    tabSession?.unit && tabSession.unit !== 'None'
      ? tabSession.unit
      : session?.unit && session.unit !== 'None'
      ? session.unit
      : DEFAULT_RESPONDER_UNIT;
  const normUnit = rawUnit.toUpperCase();

  const resolvedId =
    tabSession?.employeeOrResidentId ||
    tabSession?.employeeId ||
    session?.employeeOrResidentId ||
    session?.employeeId ||
    '-';

  const user = {
    name: tabSession?.displayName || tabSession?.fullName || session?.displayName || session?.fullName || DEFAULT_RESPONDER_NAME,
    id: resolvedId,
    email: tabSession?.email || session?.email,
    role: activeRole,
    unit: normUnit,
    status: tabSession?.status || session?.status || DEFAULT_VERIFIED_STATUS,
    faceVerified: tabSession?.faceVerified ?? session?.faceVerified ?? true
  };

  const getBranchTelemetry = (unit: string) => {
    switch (unit) {
      case 'FIRE':
        return {
          label: 'BFP Fire',
          accent: 'text-[#670626]',
          badgeBg: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/30'
        };
      case 'PNP':
      case 'SECURITY':
        return {
          label: 'PNP Police',
          accent: 'text-[#670626]',
          badgeBg: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/30'
        };
      case 'RHU':
      default:
        return {
          label: 'RHU Medic',
          accent: 'text-[#670626]',
          badgeBg: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/30'
        };
    }
  };

  const branch = getBranchTelemetry(normUnit);

  const gpsStatusLabel = isHardwareGeolocated
    ? `GPS Locked (${Math.round(coords.accuracy)}m)`
    : isLocating
    ? 'Acquiring GPS Signal...'
    : gpsError
    ? 'GPS Unavailable'
    : 'GPS Standby';

  return (
    <DrawerSidebarProvider>
      <div className={`app-shell responder-portal responder-branch-${normUnit.toLowerCase()} flex flex-col h-screen w-screen overflow-hidden bg-[#4A041A] text-[#F7F1EA]`}>
        <Header user={user} />

        <div className="dash relative flex flex-1 min-h-0 w-full overflow-hidden bg-[#4A041A]">
          <Sidebar userRole={activeRole} userUnit={normUnit} />

          <main className="dash__main flex-1 w-full min-w-0 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 pb-24 md:pb-8 sm:px-6 sm:py-6 md:px-8 md:py-6 lg:px-10 bg-gradient-to-br from-[#670626] via-[#4A041A] to-[#400014] transition-all flex flex-col">
            <div className="w-full flex-none flex flex-col max-w-[1720px] mx-auto">
              {/* Responder Unit Status Bar — Warm Ivory Clay Pill */}
              <div
                className="clay-surface mb-4 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-mono select-none"
                role="status"
                aria-label="Responder Unit Status"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border font-bold ${branch.badgeBg}`}>
                    <Shield className={`w-3.5 h-3.5 ${branch.accent} flex-shrink-0`} aria-hidden="true" />
                    <span>{branch.label}</span>
                  </span>
                  <span className="text-[#A83B4D]" aria-hidden="true">&bull;</span>
                  <span className="text-[#2B010E] font-semibold">
                    {user.id && user.id !== '-' ? `${user.name} (${user.id})` : user.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#670626] font-bold">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E9D9D0] border border-[#A83B4D]/25"
                    title={gpsError || gpsStatusLabel}
                  >
                    <Activity className="w-3.5 h-3.5 text-[#670626] flex-shrink-0" aria-hidden="true" />
                    <span>{gpsStatusLabel}</span>
                  </div>
                </div>
              </div>

              {children || <Outlet context={{ user, session }} />}
            </div>

            <div className="w-full max-w-[1720px] mx-auto mt-6">
              <Footer />
            </div>
          </main>
        </div>
      </div>
    </DrawerSidebarProvider>
  );
};

export default ResponderLayout;
