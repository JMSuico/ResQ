// [Layer: LayoutBars]
// Responsibility: Role-tailored dynamic sidebar navigation & mobile clay dock for LDRRMO Admin, RHU Medic, BFP Fire, PNP Police, and Civilians.
// Official Cherry (#400014 / #670626) & Warm Ivory (#F7F1EA) Stitch design with strict typing (ZERO any) and universal arrow syntax.

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Map,
  AlertTriangle,
  Users,
  BarChart3,
  Settings,
  ShieldCheck,
  HeartPulse,
  Flame,
  FileText,
  Home,
  Camera,
  User,
  Shield,
  Bell,
  Send,
  FileCheck
} from 'lucide-react';
import { useDrawerSidebar, ToggleDrawerSidebarMenu } from '@/Shared/ToggleDrawerSidebarMenu';

export interface SidebarProps {
  userRole?: string;
  userUnit?: string;
}

interface NavMenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface AgencyIdentity {
  badge: string;
  name: string;
  category: string;
}

const COLLAPSED_SIDEBAR_WIDTH = '72px';
const EXPANDED_SIDEBAR_VAR = 'var(--side-w, 260px)';
const DEFAULT_USER_ROLE = 'LDRRMO_Admin';
const DEFAULT_USER_UNIT = 'LDRRMO';

export const Sidebar: React.FC<SidebarProps> = ({
  userRole = DEFAULT_USER_ROLE,
  userUnit = DEFAULT_USER_UNIT
}) => {
  const { isCollapsed } = useDrawerSidebar();
  const location = useLocation();
  const normRole = (userRole || '').toLowerCase();
  const normUnit = (userUnit || '').toUpperCase();

  const isLdrrmoAdmin =
    normRole === 'ldrrmo_admin' ||
    normRole === 'admin' ||
    normUnit === 'LDRRMO';

  const isResponder = normRole === 'responder';

  let agencyInfo: AgencyIdentity = {
    badge: 'LDRRMO',
    name: 'Central Command',
    category: 'Command'
  };

  let menuItems: NavMenuItem[] = [];

  if (isLdrrmoAdmin) {
    agencyInfo = {
      badge: 'LDRRMO',
      name: 'Central Command',
      category: 'Executive Dispatch'
    };
    menuItems = [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/strategic-map', label: 'Strategic Map', icon: Map },
      { to: '/admin/incidents', label: 'Dispatch Manager', icon: AlertTriangle },
      { to: '/admin/submitted-reports', label: 'Submitted Reports', icon: FileCheck },
      { to: '/admin/responders', label: 'Responders', icon: Users },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/users', label: 'Users', icon: ShieldCheck },
      { to: '/admin/alerts', label: 'Broadcasts', icon: Bell },
      { to: '/admin/settings', label: 'Settings', icon: Settings }
    ];
  } else if (isResponder && (normUnit === 'RHU' || normUnit === 'MEDIC')) {
    agencyInfo = {
      badge: 'RHU Medic',
      name: 'EMS & Trauma',
      category: 'Medical Corps'
    };
    menuItems = [
      { to: '/responder/dashboard', label: 'Dashboard', icon: HeartPulse },
      { to: '/responder/incidents', label: 'Dispatches', icon: AlertTriangle },
      { to: '/responder/request-deploy', label: 'Request & Deploy', icon: Send },
      { to: '/responder/duty-roster', label: 'Responders', icon: Users },
      { to: '/responder/my-reports', label: 'Incident Logs', icon: FileText },
      { to: '/responder/profile', label: 'Profile', icon: User }
    ];
  } else if (isResponder && normUnit === 'FIRE') {
    agencyInfo = {
      badge: 'BFP Fire',
      name: 'Engine Company',
      category: 'Fire & Hazmat'
    };
    menuItems = [
      { to: '/responder/dashboard', label: 'Dashboard', icon: Flame },
      { to: '/responder/incidents', label: 'Unit Feed', icon: AlertTriangle },
      { to: '/responder/duty-roster', label: 'Responders', icon: Users },
      { to: '/responder/request-deploy', label: 'Request & Deploy', icon: Send },
      { to: '/responder/my-reports', label: 'Reports', icon: FileText },
      { to: '/responder/profile', label: 'Profile', icon: User }
    ];
  } else if (isResponder && (normUnit === 'PNP' || normUnit === 'SECURITY')) {
    agencyInfo = {
      badge: 'PNP Police',
      name: 'Patrol Unit',
      category: 'Law Enforcement'
    };
    menuItems = [
      { to: '/responder/dashboard', label: 'Dashboard', icon: Shield },
      { to: '/responder/request-deploy', label: 'Request & Deploy', icon: Send },
      { to: '/responder/duty-roster', label: 'Responders', icon: Users },
      { to: '/responder/my-reports', label: 'Reports', icon: FileText },
      { to: '/responder/profile', label: 'Profile', icon: User }
    ];
  } else if (isResponder) {
    agencyInfo = {
      badge: 'Responder',
      name: 'Field Operations',
      category: 'Field Response'
    };
    menuItems = [
      { to: '/responder/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/responder/incidents', label: 'Unit Feed', icon: AlertTriangle },
      { to: '/responder/request-deploy', label: 'Request & Deploy', icon: Send },
      { to: '/responder/duty-roster', label: 'Responders', icon: Users },
      { to: '/responder/my-reports', label: 'Reports', icon: FileText },
      { to: '/responder/profile', label: 'Profile', icon: User }
    ];
  } else {
    agencyInfo = {
      badge: 'Civilian',
      name: 'Resident Portal',
      category: 'Resident Services'
    };
    menuItems = [
      { to: '/civilian/dashboard', label: 'Dashboard', icon: Home },
      { to: '/civilian/live-map', label: 'Live Map', icon: Map },
      { to: '/civilian/report', label: 'Reports Incident', icon: Camera },
      { to: '/civilian/my-reports', label: 'My Reports', icon: AlertTriangle },
      { to: '/civilian/profile', label: 'Profile', icon: User }
    ];
  }

  const isNavItemActive = (itemTo: string, routerIsActive: boolean): boolean => {
    if (routerIsActive) return true;
    if (itemTo === '/responder/dashboard' && location.pathname === '/responder') return true;
    if (itemTo === '/civilian/dashboard' && location.pathname === '/civilian') return true;
    if (itemTo === '/civilian/profile' && location.pathname === '/civilian/identity') return true;
    return false;
  };

  const mobileDockItems = menuItems.slice(0, 5);

  return (
    <>
      <aside
        className={`sidebar hidden md:flex transition-all duration-200 select-none bg-[#400014] border-r border-[#FFD9DD]/15 shadow-[12px_0_36px_rgba(43,1,14,0.45)] z-[600] relative pointer-events-auto flex-col flex-shrink-0 ${
          isCollapsed ? 'is-collapsed w-[72px] min-w-[72px] max-w-[72px]' : 'w-[260px] min-w-[260px] max-w-[260px]'
        }`}
        style={{
          width: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR,
          minWidth: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR,
          backgroundColor: 'var(--resq-cherry-sidebar, #400014)'
        }}
        aria-label="Role Navigation Sidebar"
      >
        {/* Agency Identity Emblem + Drawer Toggle Button */}
        <div className={`pt-3 pb-3 mb-2 border-b border-[#FFD9DD]/15 ${isCollapsed ? 'px-2 flex flex-col items-center' : 'px-4'}`}>
          <div className="flex items-center justify-between w-full mb-2">
            {!isCollapsed ? (
              <span className="text-xs font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-lg bg-[#670626] text-[#F7F1EA] border border-[#FFD9DD]/25 shadow-sm">
                {agencyInfo.badge}
              </span>
            ) : (
              <span
                className="w-2.5 h-2.5 rounded-full bg-[#FFD9DD] animate-pulse mx-auto mb-1"
                title={agencyInfo.badge}
              />
            )}
            <ToggleDrawerSidebarMenu />
          </div>

          {!isCollapsed && (
            <div className="clay-surface-cream rounded-2xl p-3 flex flex-col gap-0.5">
              <span className="text-sm font-extrabold text-[#2B010E] tracking-tight truncate">
                {agencyInfo.name}
              </span>
              <span className="text-xs font-mono font-semibold text-[#A83B4D] uppercase tracking-wider">
                {agencyInfo.category}
              </span>
            </div>
          )}
        </div>

        <nav className="nav flex flex-col gap-1.5 px-2 pb-4 overflow-y-auto" aria-label="Primary Role Navigation">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => {
                  const activeMatch = isNavItemActive(item.to, isActive);
                  return `nav__item group flex items-center transition-all rounded-xl ${
                    isCollapsed ? 'justify-center px-0 h-11 w-full' : 'gap-3 px-3.5 h-11'
                  } ${
                    activeMatch
                      ? 'is-active bg-[#F7F1EA] text-[#670626] font-bold shadow-[0_8px_18px_-6px_rgba(43,1,14,0.5),inset_0_2px_2px_rgba(255,255,255,0.9)]'
                      : 'text-[#FFD9DD] hover:bg-[#670626]/75 hover:text-[#F7F1EA]'
                  }`;
                }}
                title={item.label}
              >
                {({ isActive }) => {
                  const activeMatch = isNavItemActive(item.to, isActive);
                  return (
                    <>
                      <IconComponent
                        className={`nav__icon flex-shrink-0 w-5 h-5 transition-colors ${
                          activeMatch ? 'text-[#670626]' : 'text-[#FFD9DD]/85 group-hover:text-[#F7F1EA]'
                        }`}
                        aria-hidden="true"
                      />
                      {!isCollapsed && (
                        <>
                          <span className="nav__label truncate flex-1 text-sm font-semibold">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="nav__badge text-xs font-mono px-1.5 py-0.5 rounded bg-[#E9D9D0] text-[#670626]">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Fixed Bottom Navigation Dock (#400014) */}
      <nav className="clay-dock" aria-label="Mobile Navigation Dock">
        {mobileDockItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <NavLink
              key={`dock-${item.to}`}
              to={item.to}
              className={({ isActive }) => {
                const activeMatch = isNavItemActive(item.to, isActive);
                return `flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl min-w-0 transition-all ${
                  activeMatch
                    ? 'bg-[#F7F1EA] text-[#670626] font-bold shadow-sm'
                    : 'text-[#FFD9DD] hover:text-[#F7F1EA]'
                }`;
              }}
              title={item.label}
            >
              <IconComponent className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs leading-tight truncate max-w-full">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;
