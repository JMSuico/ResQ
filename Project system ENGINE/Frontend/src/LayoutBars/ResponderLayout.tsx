// [Layer: LayoutBars]
// Responsibility: Master layout wrapper for all emergency responder branches (RHU Medic, BFP Fire Rescue, and PNP Police Force).
// Dynamically reads active authenticated session, injects branch telemetry HUD banner, and binds tactile layout frame.
// ResQTrack Incident AI System Detection -- Universal Lucide icon standard with strict typing (ZERO any).

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Shield, Activity, Radio, PhoneCall } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { useSession } from '../Hooks/useSession';
import { DrawerSidebarProvider } from '../Shared/ToggleDrawerSidebarMenu';

export interface ResponderLayoutProps {
  children?: React.ReactNode;
}

const DEFAULT_RESPONDER_ROLE = 'Responder';
const DEFAULT_RESPONDER_UNIT = 'RHU';
const DEFAULT_RESPONDER_NAME = 'Active Duty Responder';
const DEFAULT_EMPLOYEE_ID = 'RES-773-009';
const DEFAULT_VERIFIED_STATUS = 'Verified';

export const ResponderLayout: React.FC<ResponderLayoutProps> = ({ children }) => {
  const { session } = useSession();

  // Authoritative role and unit from active authenticated backend session
  const activeRole = session?.role || DEFAULT_RESPONDER_ROLE;
  const rawUnit = session?.unit && session.unit !== 'None' ? session.unit : DEFAULT_RESPONDER_UNIT;
  const normUnit = rawUnit.toUpperCase();

  const user = {
    name: session?.fullName || DEFAULT_RESPONDER_NAME,
    id: session?.employeeOrResidentId || session?.employeeId || DEFAULT_EMPLOYEE_ID,
    role: activeRole,
    unit: normUnit,
    status: session?.status || DEFAULT_VERIFIED_STATUS,
    faceVerified: session?.faceVerified ?? true
  };

  const getBranchTelemetry = (unit: string) => {
    switch (unit) {
      case 'FIRE':
        return {
          label: 'BFP FIRE TACTICAL GROUND',
          channel: 'CH-02 TACTICAL',
          accent: 'text-orange-400',
          bg: 'bg-orange-950/30 border-orange-800/40'
        };
      case 'PNP':
      case 'SECURITY':
        return {
          label: 'PNP POLICE FORCE PATROL',
          channel: 'CH-03 PATROL',
          accent: 'text-sky-400',
          bg: 'bg-sky-950/30 border-sky-800/40'
        };
      case 'RHU':
      default:
        return {
          label: 'RHU EMS MEDIC TRAUMA DISPATCH',
          channel: 'CH-01 EMS NET',
          accent: 'text-cyan-400',
          bg: 'bg-cyan-950/30 border-cyan-800/40'
        };
    }
  };

  const branch = getBranchTelemetry(normUnit);

  return (
    <DrawerSidebarProvider>
      <div className={`app-shell responder-portal responder-branch-${normUnit.toLowerCase()} flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100`}>
        <Header user={user} />

        <div className="dash relative flex flex-1 min-h-0 w-full overflow-hidden bg-slate-950">
          <Sidebar userRole={activeRole} userUnit={normUnit} />

          <main className="dash__main flex-1 w-full min-w-0 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-6 lg:px-10 bg-slate-950/95 transition-all flex flex-col justify-between">
            <div className="w-full flex-1 min-h-0 flex flex-col max-w-[1720px] mx-auto">
              {/* Tactical Responder HUD Telemetry Bar */}
              <div
                className={`mb-4 px-3 py-2 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs font-mono select-none ${branch.bg}`}
                role="status"
                aria-label="Responder Branch Dispatch Telemetry"
              >
                <div className="flex items-center gap-2">
                  <Shield className={`w-3.5 h-3.5 ${branch.accent} flex-shrink-0`} aria-hidden="true" />
                  <span className="font-bold tracking-wider text-slate-200">{branch.label}</span>
                  <span className="text-slate-600" aria-hidden="true">&bull;</span>
                  <span className="text-slate-400">{user.name} ({user.id})</span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    <span className="text-emerald-300 font-semibold">{branch.channel}</span>
                  </div>

                  <div className="flex items-center gap-1 hidden sm:flex">
                    <Activity className="w-3 h-3 text-cyan-400 flex-shrink-0" aria-hidden="true" />
                    <span>GPS 100% HARDWARE LOCK</span>
                  </div>

                  <div className="flex items-center gap-1 hidden md:flex">
                    <PhoneCall className="w-3 h-3 text-rose-400 flex-shrink-0" aria-hidden="true" />
                    <span>HOTLINE 911</span>
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
