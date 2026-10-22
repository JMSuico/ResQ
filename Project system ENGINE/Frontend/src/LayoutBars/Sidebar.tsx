// [Layer: LayoutBars]
// Responsibility: Role-tailored dynamic sidebar navigation for LDRRMO Admin, RHU, FIRE, PNP, and Civilians.
// 100% CSS class integrity with .sidebar, .nav, .nav__item, and .is-active via NavLink.

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useDrawerSidebar, ToggleDrawerSidebarMenu } from '@/Shared/ToggleDrawerSidebarMenu';

export interface SidebarProps {
  userRole?: string;
  userUnit?: string;
}

interface NavMenuItem {
  to: string;
  label: string;
  icon: string;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  userRole = 'LDRRMO_Admin',
  userUnit = 'LDRRMO'
}) => {
  const { isCollapsed } = useDrawerSidebar();
  const normRole = (userRole || '').toLowerCase();
  const normUnit = (userUnit || '').toUpperCase();

  const isLdrrmoAdmin =
    normRole === 'ldrrmo_admin' ||
    normRole === 'admin' ||
    normUnit === 'LDRRMO';

  const isResponder = normRole === 'responder';
  const isCivilian = normRole === 'civilian' || (!isLdrrmoAdmin && !isResponder);

  let agencyInfo = {
    badge: 'LDRRMO C2',
    name: 'Executive Command',
    color: '#dc2626',
    border: '#f59e0b',
    glow: 'rgba(220, 38, 38, 0.3)',
    category: 'MUNICIPAL COMMAND'
  };

  let menuItems: NavMenuItem[] = [];

  if (isLdrrmoAdmin) {
    agencyInfo = {
      badge: 'LDRRMO // LEVEL 4',
      name: 'Central Command C2',
      color: '#dc2626',
      border: '#f59e0b',
      glow: 'rgba(220, 38, 38, 0.35)',
      category: 'EXECUTIVE DISPATCH'
    };
    // 3.1 Super Admin (LDRRMO) — Port 5174
    menuItems = [
      { to: '/admin/dashboard', label: 'Dashboard', icon: '#i-grid' },
      { to: '/admin/strategic-map', label: 'Strategic Map', icon: '#i-pin' },
      { to: '/admin/incidents', label: 'Incident Operations & Triage Dispatch', icon: '#i-alert' },
      { to: '/admin/roster', label: 'Agency Fleet Roster', icon: '#i-people' },
      { to: '/admin/analytics', label: 'Analytics & Reports', icon: '#i-clock' },
      { to: '/admin/users', label: 'User Governance', icon: '#i-shield-check' },
      { to: '/admin/alerts', label: 'Emergency Broadcasts', icon: '#i-bell' },
      { to: '/admin/settings', label: 'System Settings', icon: '#i-sliders' }
    ];
  } else if (isResponder && normUnit === 'RHU') {
    agencyInfo = {
      badge: 'RHU // MEDIC CORPS',
      name: 'EMS & Trauma Unit',
      color: '#0284c7',
      border: '#38bdf8',
      glow: 'rgba(2, 132, 199, 0.35)',
      category: 'MEDICAL TRIAGE'
    };
    // 3.2 RHU Medical Responder — Port 5173
    menuItems = [
      { to: '/responder/dashboard', label: 'EMS Trauma Board', icon: '#i-medical' },
      { to: '/responder/incidents', label: 'Casualty Dispatches', icon: '#i-alert' },
      { to: '/responder/roster', label: 'Ambulance Crew', icon: '#i-people' },
      { to: '/responder/my-reports', label: 'Patient Logs', icon: '#i-badge' },
      { to: '/responder/alerts', label: 'Hospital ER Alarms', icon: '#i-bell' },
      { to: '/responder/profile', label: 'Medic Credentials', icon: '#i-user' }
    ];
  } else if (isResponder && normUnit === 'FIRE') {
    agencyInfo = {
      badge: 'BFP // FIRE RESCUE',
      name: 'Engine Company',
      color: '#ea580c',
      border: '#f97316',
      glow: 'rgba(234, 88, 12, 0.35)',
      category: 'FIRE & HAZMAT'
    };
    // 3.3 FIRE (BFP) Responder — Port 5173
    menuItems = [
      { to: '/responder/dashboard', label: 'Fire Command Hub', icon: '#i-flame' },
      { to: '/responder/incidents', label: 'Hazmat & 2-Alarm', icon: '#i-alert' },
      { to: '/responder/roster', label: 'Engine Apparatus', icon: '#i-people' },
      { to: '/responder/my-reports', label: 'After-Action Logs', icon: '#i-badge' },
      { to: '/responder/alerts', label: 'Station Alarms', icon: '#i-bell' },
      { to: '/responder/profile', label: 'Officer Profile', icon: '#i-user' }
    ];
  } else if (isResponder && (normUnit === 'PNP' || normUnit === 'SECURITY')) {
    agencyInfo = {
      badge: 'PNP // POLICE FORCE',
      name: 'Patrol & Tactical',
      color: '#3b82f6',
      border: '#60a5fa',
      glow: 'rgba(59, 130, 246, 0.35)',
      category: 'LAW ENFORCEMENT'
    };
    // 3.4 PNP Police Responder — Port 5173
    menuItems = [
      { to: '/responder/dashboard', label: 'Sector Patrol Hub', icon: '#i-shield' },
      { to: '/responder/incidents', label: 'Blotter & Dispatches', icon: '#i-alert' },
      { to: '/responder/roster', label: 'Patrol Beat Roster', icon: '#i-people' },
      { to: '/responder/my-reports', label: 'Police Action Logs', icon: '#i-badge' },
      { to: '/responder/alerts', label: 'Distress Alarms', icon: '#i-bell' },
      { to: '/responder/profile', label: 'Officer Credentials', icon: '#i-user' }
    ];
  } else if (isResponder) {
    agencyInfo = {
      badge: 'TACTICAL UNIT',
      name: 'Field Operations',
      color: '#64748b',
      border: '#94a3b8',
      glow: 'rgba(100, 116, 139, 0.35)',
      category: 'FIRST RESPONSE'
    };
    menuItems = [
      { to: '/responder/dashboard', label: 'Unit Dispatch Hub', icon: '#i-grid' },
      { to: '/responder/incidents', label: 'Unit Incidents', icon: '#i-alert' },
      { to: '/responder/roster', label: 'Duty Roster', icon: '#i-people' },
      { to: '/responder/my-reports', label: 'My Action Reports', icon: '#i-badge' },
      { to: '/responder/alerts', label: 'Unit Alerts', icon: '#i-bell' },
      { to: '/responder/profile', label: 'Responder Profile', icon: '#i-user' }
    ];
  } else {
    agencyInfo = {
      badge: 'CIVIL DEFENSE',
      name: 'Resident Portal',
      color: '#8b5cf6',
      border: '#a78bfa',
      glow: 'rgba(139, 92, 246, 0.35)',
      category: 'CITIZEN SERVICES'
    };
    // 3.5 Civilian / Resident — Port 5173
    menuItems = [
      { to: '/civilian/dashboard', label: 'Emergency Hub', icon: '#i-grid' },
      { to: '/civilian/report', label: 'Report Incident (SOS)', icon: '#i-cam' },
      { to: '/civilian/my-reports', label: 'My Reports Feed', icon: '#i-alert' },
      { to: '/civilian/alerts', label: 'Municipal Warnings', icon: '#i-bell' },
      { to: '/civilian/hotlines', label: 'Emergency Hotlines', icon: '#i-people' },
      { to: '/civilian/profile', label: 'PhilSys Identity', icon: '#i-user' }
    ];
  }

  return (
    <aside
      className={`sidebar transition-all duration-200 select-none ${isCollapsed ? 'is-collapsed w-[72px] min-w-[72px]' : 'w-[250px] min-w-[250px]'}`}
      style={{
        width: isCollapsed ? '72px' : 'var(--side-w, 250px)',
        minWidth: isCollapsed ? '72px' : 'var(--side-w, 250px)'
      }}
      aria-label="Role Navigation Sidebar"
    >
      {/* Agency Identity Emblem + Drawer Toggle Button */}
      <div className={`pt-3 pb-2 mb-2 border-b border-white/10 ${isCollapsed ? 'px-2 flex flex-col items-center' : 'px-4'}`}>
        <div className="flex items-center justify-between w-full mb-1">
          {!isCollapsed ? (
            <span
              className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${agencyInfo.color}35`,
                color: agencyInfo.border
              }}
            >
              {agencyInfo.badge}
            </span>
          ) : (
            <span
              className="w-2 h-2 rounded-full animate-pulse mx-auto mb-1"
              style={{ backgroundColor: agencyInfo.border }}
              title={agencyInfo.badge}
            />
          )}
          <ToggleDrawerSidebarMenu />
        </div>

        {!isCollapsed && (
          <div
            className="rounded-lg p-2 flex flex-col gap-0.5 border shadow-sm transition-all"
            style={{
              backgroundColor: `${agencyInfo.color}15`,
              borderColor: `${agencyInfo.border}50`,
              boxShadow: `0 0 12px ${agencyInfo.glow}`
            }}
          >
            <span className="text-xs font-bold text-white tracking-tight truncate">{agencyInfo.name}</span>
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{agencyInfo.category}</span>
          </div>
        )}
      </div>

      <nav className="nav flex flex-col gap-1 px-1" aria-label="Primary Role Navigation">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `nav__item flex items-center transition-all rounded-md ${
                isCollapsed ? 'justify-center px-0 h-10 w-full' : 'gap-3 px-3 h-10'
              } ${isActive ? 'is-active' : ''}`
            }
            title={item.label}
          >
            <svg className="nav__icon flex-shrink-0" aria-hidden="true">
              <use href={item.icon} />
            </svg>
            {!isCollapsed && (
              <>
                <span className="nav__label truncate flex-1">{item.label}</span>
                {item.badge && <span className="nav__badge">{item.badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
