// [Layer: LayoutBars]
// Responsibility: Master layout wrappers connecting Header, dynamic role-tailored Sidebar, and page views.
// Ensures authentic RISKQTRAK app-shell structure with dynamic role-based session hydration.

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ResQTrackSvgSprite } from '../Shared/ResQTrackSvgSprite';
import { useSession } from '../Hooks/useSession';

export interface LayoutWrappersProps {
  children?: React.ReactNode;
  defaultRole?: string;
  defaultUnit?: string;
}

export const LayoutWrappers: React.FC<LayoutWrappersProps> = ({
  children,
  defaultRole = 'LDRRMO_Admin',
  defaultUnit = 'LDRRMO'
}) => {
  const { session } = useSession();

  // Authoritative role and unit from active authenticated backend session
  const activeRole = session?.role || defaultRole;
  const activeUnit = session?.unit || defaultUnit;

  const user = {
    name: session?.fullName || (activeRole === 'LDRRMO_Admin' ? 'LDRRMO Commander' : 'Active Duty Officer'),
    id: session?.employeeOrResidentId || session?.employeeId || 'OP-773-567-009',
    role: activeRole,
    unit: activeUnit,
    status: session?.status || 'Verified',
    faceVerified: session?.faceVerified ?? true
  };

  return (
    <div className="app-shell">
      <ResQTrackSvgSprite />
      <Header user={user} />
      <div className="dash">
        <Sidebar userRole={activeRole} userUnit={activeUnit} />
        {children || <Outlet context={{ user, session }} />}
      </div>
    </div>
  );
};

export const LandingLayout: React.FC = () => (
  <div className="landing-shell">
    <ResQTrackSvgSprite />
    <Outlet />
  </div>
);

export const AdminLayout: React.FC = () => (
  <LayoutWrappers defaultRole="LDRRMO_Admin" defaultUnit="LDRRMO" />
);

export const ResponderLayout: React.FC = () => (
  <LayoutWrappers defaultRole="Responder" defaultUnit="RHU" />
);

export const CivilianLayout: React.FC = () => (
  <LayoutWrappers defaultRole="Civilian" defaultUnit="None" />
);

export default LayoutWrappers;
