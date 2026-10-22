// [Layer: LayoutBars]
// Responsibility: Role-tailored dynamic sidebar navigation for LDRRMO Admin, RHU, FIRE, PNP, and Civilians.
// 100% CSS class integrity with .sidebar, .nav, .nav__item, and .is-active via NavLink.

import React from 'react';
import { NavLink } from 'react-router-dom';

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
  const normRole = (userRole || '').toLowerCase();
  const normUnit = (userUnit || '').toUpperCase();

  const isLdrrmoAdmin =
    normRole === 'ldrrmo_admin' ||
    normRole === 'admin' ||
    normUnit === 'LDRRMO';

  const isResponder = normRole === 'responder';
  const isCivilian = normRole === 'civilian' || (!isLdrrmoAdmin && !isResponder);

  let menuItems: NavMenuItem[] = [];

  if (isLdrrmoAdmin) {
    // 3.1 Super Admin (LDRRMO) — Port 5174
    menuItems = [
      { to: '/admin/dashboard', label: 'Tactical Map', icon: '#i-grid' },
      { to: '/admin/incidents', label: 'Incident Triage', icon: '#i-alert' },
      { to: '/admin/roster', label: 'Agency Roster', icon: '#i-people' },
      { to: '/admin/users', label: 'User Governance', icon: '#i-shield-check' },
      { to: '/admin/alerts', label: 'Emergency Alerts', icon: '#i-bell' },
      { to: '/admin/settings', label: 'System Settings', icon: '#i-sliders' }
    ];
  } else if (isResponder && normUnit === 'RHU') {
    // 3.2 RHU Medical Responder — Port 5173
    menuItems = [
      { to: '/responder/dashboard', label: 'Medical Triage', icon: '#i-medical' },
      { to: '/responder/incidents', label: 'Trauma Incidents', icon: '#i-alert' },
      { to: '/responder/roster', label: 'Ambulance Crew', icon: '#i-people' },
      { to: '/responder/my-reports', label: 'Patient Logs', icon: '#i-badge' },
      { to: '/responder/alerts', label: 'Hospital Alarms', icon: '#i-bell' },
      { to: '/responder/profile', label: 'Medic Profile', icon: '#i-user' }
    ];
  } else if (isResponder && normUnit === 'FIRE') {
    // 3.3 FIRE (BFP) Responder — Port 5173
    menuItems = [
      { to: '/responder/dashboard', label: 'Fire Command', icon: '#i-flame' },
      { to: '/responder/incidents', label: 'Active Hazmat', icon: '#i-alert' },
      { to: '/responder/roster', label: 'Engine Company', icon: '#i-people' },
      { to: '/responder/my-reports', label: 'After-Action Logs', icon: '#i-badge' },
      { to: '/responder/alerts', label: 'Station Alarms', icon: '#i-bell' },
      { to: '/responder/profile', label: 'Fire Officer', icon: '#i-user' }
    ];
  } else if (isResponder && (normUnit === 'PNP' || normUnit === 'SECURITY')) {
    // 3.4 PNP Police Responder — Port 5173
    menuItems = [
      { to: '/responder/dashboard', label: 'Sector Command', icon: '#i-shield' },
      { to: '/responder/incidents', label: 'Road Security', icon: '#i-alert' },
      { to: '/responder/roster', label: 'Patrol Roster', icon: '#i-people' },
      { to: '/responder/my-reports', label: 'Blotter Records', icon: '#i-badge' },
      { to: '/responder/alerts', label: 'Patrol Alarms', icon: '#i-bell' },
      { to: '/responder/profile', label: 'Officer Profile', icon: '#i-user' }
    ];
  } else if (isResponder) {
    // Generic Responder Fallback
    menuItems = [
      { to: '/responder/dashboard', label: 'Unit Dashboard', icon: '#i-grid' },
      { to: '/responder/incidents', label: 'Unit Incidents', icon: '#i-alert' },
      { to: '/responder/roster', label: 'Duty Roster', icon: '#i-people' },
      { to: '/responder/my-reports', label: 'My Reports', icon: '#i-badge' },
      { to: '/responder/alerts', label: 'Unit Alerts', icon: '#i-bell' },
      { to: '/responder/profile', label: 'Responder Profile', icon: '#i-user' }
    ];
  } else {
    // 3.5 Civilian / Resident — Port 5173
    menuItems = [
      { to: '/civilian/dashboard', label: 'Emergency Hub', icon: '#i-grid' },
      { to: '/civilian/report', label: 'Report Accident', icon: '#i-cam' },
      { to: '/civilian/my-reports', label: 'My Incidents', icon: '#i-alert' },
      { to: '/civilian/alerts', label: 'Safety Warnings', icon: '#i-bell' },
      { to: '/civilian/hotlines', label: 'Hotline Directory', icon: '#i-people' },
      { to: '/civilian/profile', label: 'Resident Badge', icon: '#i-user' }
    ];
  }

  return (
    <aside className="sidebar" aria-label="Role Navigation Sidebar">
      <nav className="nav" aria-label="Primary Role Navigation">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`}
            title={item.label}
          >
            <svg className="nav__icon" aria-hidden="true">
              <use href={item.icon} />
            </svg>
            <span className="nav__label">{item.label}</span>
            {item.badge && <span className="nav__badge">{item.badge}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
