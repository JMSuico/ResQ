// [Layer: LayoutBars]
// Responsibility: Master layout wrapper for all emergency responder branches (RHU Medic, BFP Fire Rescue, and PNP Police Force).
// Dynamically reads active authenticated session, injects agency theme tokens, and binds the tactile HUD frame.

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ResQTrackSvgSprite } from '../Shared/ResQTrackSvgSprite';
import { useSession } from '../Hooks/useSession';
import { DrawerSidebarProvider } from '../Shared/ToggleDrawerSidebarMenu';

export interface ResponderLayoutProps {
  children?: React.ReactNode;
}

export const ResponderLayout: React.FC<ResponderLayoutProps> = ({ children }) => {
  const { session } = useSession();

  // Authoritative role and unit from active authenticated backend session
  const activeRole = session?.role || 'Responder';
  const rawUnit = session?.unit && session.unit !== 'None' ? session.unit : 'RHU';
  const normUnit = rawUnit.toUpperCase();

  const user = {
    name: session?.fullName || 'Active Duty Responder',
    id: session?.employeeOrResidentId || session?.employeeId || 'RES-773-009',
    role: activeRole,
    unit: normUnit,
    status: session?.status || 'Verified',
    faceVerified: session?.faceVerified ?? true
  };

  return (
    <DrawerSidebarProvider>
      <div className={`app-shell responder-portal responder-branch-${normUnit.toLowerCase()}`}>
        <ResQTrackSvgSprite />
        <Header user={user} />
        <div className="dash relative flex flex-1 min-h-0 w-full overflow-hidden bg-slate-950">
          <Sidebar userRole={activeRole} userUnit={normUnit} />
          <main className="dash__main flex-1 w-full min-w-0 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8 md:px-10 md:py-8 lg:px-12 bg-slate-950/95 transition-all">
            <div className="w-full flex-1 min-h-0 flex flex-col max-w-[1720px] mx-auto">
              {children || <Outlet context={{ user, session }} />}
            </div>
          </main>
        </div>
      </div>
    </DrawerSidebarProvider>
  );
};

export default ResponderLayout;
