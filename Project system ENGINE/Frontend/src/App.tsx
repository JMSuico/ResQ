// [Layer: App]
// Responsibility: Master router and role portal provider for ResQTrack system.
// Connects 100% pixel-faithful converted RISKQTRAK pages, nested role portals, and universal HTML compatibility redirects.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout Wrappers
import { LandingLayout, AdminLayout, ResponderLayout, CivilianLayout } from '@/LayoutBars/LayoutWrappers';

// 100% Pixel-Faithful RISKQTRAK Converted Pages
import { LoginPage } from '@/LANDING_PAGE/Features/Pages/LoginPage/LoginPage';
import { AdminLoginPage } from '@/LANDING_PAGE/Features/Pages/LoginPage/AdminLoginPage';
import { RegisterPage } from '@/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage';
import { AdminDashboard } from '@/UserRoles/Features/Pages/AdminsPanel/AdminDashboard';
import { IncidentsPage } from '@/UserRoles/Features/Pages/AdminsPanel/IncidentsPage';
import { RespondersRosterPage } from '@/UserRoles/Features/Pages/AdminsPanel/RespondersRosterPage';
import { UserManagementPage } from '@/UserRoles/Features/Pages/AdminsPanel/UserManagementPage';
import { SettingsPage } from '@/UserRoles/Features/Pages/AdminsPanel/SettingsPage';
import { ResponderDashboard } from '@/UserRoles/Features/Pages/RespondersPanel/ResponderDashboard';
import { CivilianDashboard } from '@/UserRoles/Features/Pages/CiviliansPanel/CivilianDashboard';

// Portal Feature Views
import { AlertsCenter } from '@/UserRoles/Features/Pages/AdminsPanel/AlertsCenter';
import { UnitIncidentsFeed } from '@/UserRoles/Features/Pages/RespondersPanel/UnitIncidentsFeed';
import { DutyRosterView } from '@/UserRoles/Features/Pages/RespondersPanel/DutyRosterView';
import { MyReportsPage } from '@/UserRoles/Features/Pages/RespondersPanel/MyReportsPage';
import { ResponderAlerts } from '@/UserRoles/Features/Pages/RespondersPanel/ResponderAlerts';
import { ResponderProfile } from '@/UserRoles/Features/Pages/RespondersPanel/ResponderProfile';

import { ReportAccidentPage } from '@/UserRoles/Features/Pages/CiviliansPanel/ReportAccidentPage';
import { MyReportsHistory } from '@/UserRoles/Features/Pages/CiviliansPanel/MyReportsHistory';
import { CommunityAlertsPage } from '@/UserRoles/Features/Pages/CiviliansPanel/CommunityAlertsPage';
import { EmergencyHotlinesUnits } from '@/UserRoles/Features/Pages/CiviliansPanel/EmergencyHotlinesUnits';
import { CivilianProfile } from '@/UserRoles/Features/Pages/CiviliansPanel/CivilianProfile';

// Smart Dynamic Role Routers for Universal Compatibility
const getStoredRole = (): string | null => {
  try {
    const raw = typeof window !== 'undefined'
      ? (localStorage.getItem('resqtrack_session') || localStorage.getItem('resqtrack_user'))
      : null;
    return raw ? JSON.parse(raw)?.role : null;
  } catch {
    return null;
  }
};

const SmartDashboardRouter: React.FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  if (currentPort === '5174') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  const role = (getStoredRole() || '').toLowerCase();
  if (role === 'ldrrmo_admin' || role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'responder') return <Navigate to="/responder/dashboard" replace />;
  if (role === 'civilian') return <Navigate to="/civilian/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

const SmartIncidentsRouter: React.FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  if (currentPort === '5174') {
    return <Navigate to="/admin/incidents" replace />;
  }
  const role = (getStoredRole() || '').toLowerCase();
  if (role === 'ldrrmo_admin' || role === 'admin') return <Navigate to="/admin/incidents" replace />;
  if (role === 'responder') return <Navigate to="/responder/incidents" replace />;
  return <Navigate to="/civilian/my-reports" replace />;
};

const SmartRosterRouter: React.FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  if (currentPort === '5174') {
    return <Navigate to="/admin/roster" replace />;
  }
  const role = (getStoredRole() || '').toLowerCase();
  if (role === 'ldrrmo_admin' || role === 'admin') return <Navigate to="/admin/roster" replace />;
  if (role === 'responder') return <Navigate to="/responder/roster" replace />;
  return <Navigate to="/civilian/hotlines" replace />;
};

export const App: React.FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const isAdminPort = currentPort === '5174';

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing & Authentication */}
        <Route element={<LandingLayout />}>
          <Route path="/" element={isAdminPort ? <AdminLoginPage /> : <LoginPage />} />
          <Route path="/login" element={isAdminPort ? <AdminLoginPage /> : <LoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/responder/login" element={<LoginPage />} />
          <Route path="/civilian/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Top-Level Tactical Routes with Smart Role Navigation */}
        <Route path="/dashboard" element={<SmartDashboardRouter />} />
        <Route path="/incidents" element={<SmartIncidentsRouter />} />
        <Route path="/responders" element={<SmartRosterRouter />} />
        <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />

        {/* LDRRMO Admin Executive Command Portal (/admin/*) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="roster" element={<RespondersRosterPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="alerts" element={<AlertsCenter />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Responders Portal (/responder/*) */}
        <Route path="/responder" element={<ResponderLayout />}>
          <Route index element={<ResponderDashboard />} />
          <Route path="dashboard" element={<ResponderDashboard />} />
          <Route path="incidents" element={<UnitIncidentsFeed />} />
          <Route path="roster" element={<DutyRosterView />} />
          <Route path="my-reports" element={<MyReportsPage />} />
          <Route path="alerts" element={<ResponderAlerts />} />
          <Route path="profile" element={<ResponderProfile />} />
        </Route>

        {/* UG Residents & Civilians Portal (/civilian/*) */}
        <Route path="/civilian" element={<CivilianLayout />}>
          <Route index element={<CivilianDashboard />} />
          <Route path="dashboard" element={<CivilianDashboard />} />
          <Route path="report" element={<ReportAccidentPage />} />
          <Route path="my-reports" element={<MyReportsHistory />} />
          <Route path="alerts" element={<CommunityAlertsPage />} />
          <Route path="hotlines" element={<EmergencyHotlinesUnits />} />
          <Route path="profile" element={<CivilianProfile />} />
        </Route>

        {/* Canonical / Alias Portal Routing */}
        <Route path="/civilian-portal" element={<Navigate to="/civilian/dashboard" replace />} />
        <Route path="/civilian-portal/*" element={<Navigate to="/civilian" replace />} />
        <Route path="/responder-portal" element={<Navigate to="/responder/dashboard" replace />} />
        <Route path="/responder-portal/*" element={<Navigate to="/responder" replace />} />
        <Route path="/admin-portal" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin-portal/*" element={<Navigate to="/admin" replace />} />

        {/* Static HTML Compatibility Redirects */}
        <Route path="/index.html" element={<Navigate to="/login" replace />} />
        <Route path="/register.html" element={<Navigate to="/register" replace />} />
        <Route path="/dashboard.html" element={<Navigate to="/dashboard" replace />} />
        <Route path="/incidents.html" element={<Navigate to="/incidents" replace />} />
        <Route path="/responders.html" element={<Navigate to="/responders" replace />} />
        <Route path="/admin.html" element={<Navigate to="/admin/users" replace />} />
        <Route path="/responder.html" element={<Navigate to="/responder" replace />} />
        <Route path="/settings.html" element={<Navigate to="/settings" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
