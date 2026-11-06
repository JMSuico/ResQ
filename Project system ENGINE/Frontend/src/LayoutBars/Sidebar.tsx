// [Layer: LayoutBars]
// Responsibility: Role-tailored dynamic sidebar navigation for LDRRMO Admin, RHU Medic, BFP Fire, PNP Police, and Civilians.
// 100% CSS class integrity with .sidebar, .nav, .nav__item, and .is-active via NavLink.
// Universal Lucide icon standard with strict typing (ZERO any) and universal arrow syntax.

import React from 'react';
import { NavLink } from 'react-router-dom';
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
  Radio,
  FileText,
  Building2,
  Truck,
  ShieldAlert,
  Award,
  Lock,
  Compass,
  MapPin,
  Home,
  Camera,
  PhoneCall,
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
  color: string;
  border: string;
  glow: string;
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
  const normRole = (userRole || '').toLowerCase();
  const normUnit = (userUnit || '').toUpperCase();

  const isLdrrmoAdmin =
    normRole === 'ldrrmo_admin' ||
    normRole === 'admin' ||
    normUnit === 'LDRRMO';

  const isResponder = normRole === 'responder';

  let agencyInfo: AgencyIdentity = {
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
    menuItems = [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/strategic-map', label: 'Strategic Map', icon: Map },
      { to: '/admin/incidents', label: 'Incident Operations & Triage Dispatch', icon: AlertTriangle },
      { to: '/admin/submitted-reports', label: 'Submitted Reports', icon: FileCheck },
      { to: '/admin/roster', label: 'Agency Fleet Roster', icon: Users },
      { to: '/admin/analytics', label: 'Analytics & Reports', icon: BarChart3 },
      { to: '/admin/users', label: 'User Governance', icon: ShieldCheck },
      { to: '/admin/alerts', label: 'Emergency Broadcasts', icon: Bell },
      { to: '/admin/settings', label: 'System Settings', icon: Settings }
    ];
  } else if (isResponder && (normUnit === 'RHU' || normUnit === 'MEDIC')) {
    agencyInfo = {
      badge: 'RHU // MEDIC CORPS',
      name: 'EMS & Trauma Unit',
      color: '#0284c7',
      border: '#38bdf8',
      glow: 'rgba(2, 132, 199, 0.35)',
      category: 'MEDICAL TRIAGE'
    };
    menuItems = [
      { to: '/responder', label: 'EMS TRAUMA BOARD', icon: HeartPulse },
      { to: '/responder/incidents', label: 'CASUALTY DISPATCHES', icon: AlertTriangle },
      { to: '/responder/request-deploy', label: 'REQUEST & DEPLOY', icon: Send },
      { to: '/responder/roster', label: 'AMBULANCE CREW', icon: Users },
      { to: '/responder/reports', label: 'INCIDENT LOGS', icon: FileText },
      { to: '/responder/profile', label: 'PROFILE SETTINGS', icon: User }
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
    menuItems = [
      { to: '/responder/dashboard', label: 'Fire Command Hub', icon: Flame },
      { to: '/responder/incidents', label: 'Hazmat & 2-Alarm', icon: AlertTriangle },
      { to: '/responder/roster', label: 'Engine Apparatus', icon: Truck },
      { to: '/responder/my-reports', label: 'After-Action Logs', icon: FileText },
      { to: '/responder/alerts', label: 'Station Alarms', icon: Bell },
      { to: '/responder/profile', label: 'Officer Profile', icon: User }
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
    menuItems = [
      { to: '/responder/dashboard', label: 'Sector Patrol Hub', icon: Shield },
      { to: '/responder/incidents', label: 'Blotter & Dispatches', icon: AlertTriangle },
      { to: '/responder/roster', label: 'Patrol Beat Roster', icon: Users },
      { to: '/responder/my-reports', label: 'Police Action Logs', icon: FileText },
      { to: '/responder/alerts', label: 'Distress Alarms', icon: Bell },
      { to: '/responder/profile', label: 'Officer Credentials', icon: User }
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
      { to: '/responder/dashboard', label: 'Unit Dispatch Hub', icon: LayoutDashboard },
      { to: '/responder/incidents', label: 'Unit Incidents', icon: AlertTriangle },
      { to: '/responder/roster', label: 'Duty Roster', icon: Users },
      { to: '/responder/my-reports', label: 'My Action Reports', icon: FileText },
      { to: '/responder/alerts', label: 'Unit Alerts', icon: Bell },
      { to: '/responder/profile', label: 'Responder Profile', icon: User }
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
    menuItems = [
      { to: '/civilian/dashboard', label: 'Emergency Hub', icon: Home },
      { to: '/civilian/live-map', label: 'Tactical Live Map', icon: Map },
      { to: '/civilian/report', label: 'Report Incident (SOS)', icon: Camera },
      { to: '/civilian/my-reports', label: 'My Reports Feed', icon: AlertTriangle },
      { to: '/civilian/alerts', label: 'Municipal Warnings', icon: Bell },
      { to: '/civilian/hotlines', label: 'Emergency Hotlines', icon: PhoneCall },
      { to: '/civilian/profile', label: 'PhilSys Identity', icon: User }
    ];
  }

  return (
    <aside
      className={`sidebar transition-all duration-200 select-none border-r border-rose-950/80 shadow-2xl shadow-black/80 z-40 relative flex flex-col flex-shrink-0 ${
        isCollapsed ? 'is-collapsed w-[72px] min-w-[72px] max-w-[72px]' : 'w-[260px] min-w-[260px] max-w-[260px]'
      }`}
      style={{
        width: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR,
        minWidth: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR
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
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/responder'}
              className={({ isActive }) => {
                const activeMatch =
                  isActive ||
                  (item.to === '/responder' &&
                    typeof window !== 'undefined' &&
                    window.location.pathname === '/responder/dashboard');
                return `nav__item group flex items-center transition-all rounded-md ${
                  isCollapsed ? 'justify-center px-0 h-10 w-full' : 'gap-3 px-3 h-10'
                } ${activeMatch ? 'is-active' : ''}`;
              }}
              title={item.label}
            >
              <IconComponent
                className="nav__icon flex-shrink-0 w-5 h-5 text-slate-400 group-hover:text-white transition-colors"
                aria-hidden="true"
              />
              {!isCollapsed && (
                <>
                  <span className="nav__label truncate flex-1 text-sm font-medium">{item.label}</span>
                  {item.badge && <span className="nav__badge text-[10px] font-mono px-1.5 py-0.5 rounded">{item.badge}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
