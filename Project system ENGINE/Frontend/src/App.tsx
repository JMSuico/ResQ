// [Layer: App]
// Responsibility: Master router and role portal provider for ResQTrack system.
// Connects 100% pixel-faithful converted RISKQTRAK pages, nested role portals, and universal HTML compatibility redirects.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout Wrappers
import { LandingLayout, AdminLayout, ResponderLayout, CivilianLayout } from '@/LayoutBars/LayoutWrappers';

// 100% Pixel-Faithful RISKQTRAK Converted Pages
import { LandingPage } from '@/LANDING_PAGE/Features/Pages/LandingPage/LandingPage';
import { LoginPage } from '@/LANDING_PAGE/Features/Pages/LoginPage/LoginPage';
import { AdminLoginPage } from '@/LANDING_PAGE/Features/Pages/LoginPage/AdminLoginPage';
import { RegisterPage } from '@/LANDING_PAGE/Features/Pages/RegisterPage/RegisterPage';
import { AdminDashboard } from '@/UserRoles/Features/Pages/AdminsPanel/AdminDashboard';
import { StrategicMapPage } from '@/UserRoles/Features/Pages/AdminsPanel/StrategicMapPage';
import { AnalyticsReportsPage } from '@/UserRoles/Features/Pages/AdminsPanel/AnalyticsReportsPage';
import { IncidentsPage } from '@/UserRoles/Features/Pages/AdminsPanel/IncidentsPage';
import { SubmittedReportsPage } from '@/UserRoles/Features/Pages/AdminsPanel/SubmittedReportsPage';
import { RespondersRosterPage } from '@/UserRoles/Features/Pages/AdminsPanel/RespondersRosterPage';
import { UserManagementPage } from '@/UserRoles/Features/Pages/AdminsPanel/UserManagementPage';
import { SettingsPage } from '@/UserRoles/Features/Pages/AdminsPanel/SettingsPage';
import { CivilianDashboard } from '@/UserRoles/Features/Pages/CiviliansPanel/CivilianDashboard';

// Portal Feature Views
import { AlertsCenter } from '@/UserRoles/Features/Pages/AdminsPanel/AlertsCenter';
import { ResponderDashboard } from '@/UserRoles/Features/Pages/RespondersPanel/ResponderDashboard';
import { UnitIncidentsFeed } from '@/UserRoles/Features/Pages/RespondersPanel/UnitIncidentsFeed';
import { RequestDeployPage } from '@/UserRoles/Features/Pages/RespondersPanel/RequestDeployPage';
import { DutyRosterView } from '@/UserRoles/Features/Pages/RespondersPanel/DutyRosterView';
import { MyReportsPage } from '@/UserRoles/Features/Pages/RespondersPanel/MyReportsPage';
import { ResponderAlerts } from '@/UserRoles/Features/Pages/RespondersPanel/ResponderAlerts';
import { ResponderProfile } from '@/UserRoles/Features/Pages/RespondersPanel/ResponderProfile';

import { ReportAccidentPage } from '@/UserRoles/Features/Pages/CiviliansPanel/ReportAccidentPage';
import { MyReportsHistory } from '@/UserRoles/Features/Pages/CiviliansPanel/MyReportsHistory';
import { CommunityAlertsPage } from '@/UserRoles/Features/Pages/CiviliansPanel/CommunityAlertsPage';
import { EmergencyHotlinesUnits } from '@/UserRoles/Features/Pages/CiviliansPanel/EmergencyHotlinesUnits';
import { CivilianProfile } from '@/UserRoles/Features/Pages/CiviliansPanel/CivilianProfile';
import { CivilianLiveMapPage } from '@/UserRoles/Features/Pages/CiviliansPanel/CivilianLiveMapPage';

// Smart Dynamic Role Routers for Universal Compatibility
const getStoredSessionData = (): { role?: string; unit?: string } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const port = window.location.port || '5173';
    // 1. Tab-isolated session storage has top priority
    const tabRaw = sessionStorage.getItem('resqtrack_session') || sessionStorage.getItem('resqtrack_user');
    if (tabRaw) return JSON.parse(tabRaw) as { role?: string; unit?: string };

    // 2. Tab-unit scoped local storage
    const tabUnit = (sessionStorage.getItem('resqtrack_unit') || '').toLowerCase().trim();
    if (tabUnit && tabUnit !== 'none') {
      const unitRaw = localStorage.getItem(`resqtrack_session_${tabUnit}`) || localStorage.getItem(`resqtrack_user_${tabUnit}`);
      if (unitRaw) return JSON.parse(unitRaw) as { role?: string; unit?: string };
    }

    if (port === '5174') {
      const adminRaw = localStorage.getItem('resqtrack_session_5174') || localStorage.getItem('resqtrack_user_5174');
      if (adminRaw) return JSON.parse(adminRaw) as { role?: string; unit?: string };
    } else {
      const portRaw = localStorage.getItem(`resqtrack_session_${port}`) || localStorage.getItem(`resqtrack_user_${port}`);
      if (portRaw) {
        const parsed = JSON.parse(portRaw) as { role?: string; unit?: string };
        // Never allow an old or stray Admin session on port 5173 to hijack Port 5173 routing!
        if (!(parsed.role || '').toLowerCase().includes('admin')) {
          return parsed;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
};

const getStoredRole = (): string | null => {
  const session = getStoredSessionData();
  return session?.role ?? null;
};

const SmartDashboardRouter: React.FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const host = typeof window !== 'undefined' ? (window.location.hostname || '127.0.0.1') : '127.0.0.1';
  const role = (getStoredRole() || '').toLowerCase();
  const isAdmin = role.includes('admin') || role.includes('ldrrmo') || role === '1';

  if (currentPort === '5174') {
    if (!isAdmin) return <Navigate to="/admin/login" replace />;
    return <Navigate to="/admin/dashboard" replace />;
  }

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

  if (role === 'responder' || role === '2') return <Navigate to="/responder/dashboard" replace />;
  if (role === 'civilian' || role === '3') return <Navigate to="/civilian/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

const SmartIncidentsRouter: React.FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const host = typeof window !== 'undefined' ? (window.location.hostname || '127.0.0.1') : '127.0.0.1';
  const role = (getStoredRole() || '').toLowerCase();
  const isAdmin = role.includes('admin') || role.includes('ldrrmo') || role === '1';

  if (currentPort === '5174') {
    if (!isAdmin) return <Navigate to="/admin/login" replace />;
    return <Navigate to="/admin/incidents" replace />;
  }

  if (isAdmin) {
    const token = typeof window !== 'undefined'
      ? (sessionStorage.getItem('resqtrack_token') || localStorage.getItem('resqtrack_token_5173') || localStorage.getItem('resqtrack_token'))
      : null;
    const targetUrl = token
      ? `http://${host}:5174/admin/incidents?session_token=${encodeURIComponent(token)}`
      : `http://${host}:5174/admin/incidents`;
    window.location.href = targetUrl;
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 font-mono text-sm text-rose-400">
        Admin account detected. Redirecting to Executive Command (5174)...
      </div>
    );
  }

  if (role === 'responder' || role === '2') return <Navigate to="/responder/incidents" replace />;
  return <Navigate to="/civilian/my-reports" replace />;
};

const SmartRosterRouter: React.FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const host = typeof window !== 'undefined' ? (window.location.hostname || '127.0.0.1') : '127.0.0.1';
  const role = (getStoredRole() || '').toLowerCase();
  const isAdmin = role.includes('admin') || role.includes('ldrrmo') || role === '1';

  if (currentPort === '5174') {
    if (!isAdmin) return <Navigate to="/admin/login" replace />;
    return <Navigate to="/admin/roster" replace />;
  }

  if (isAdmin) {
    const token = typeof window !== 'undefined'
      ? (sessionStorage.getItem('resqtrack_token') || localStorage.getItem('resqtrack_token_5173') || localStorage.getItem('resqtrack_token'))
      : null;
    const targetUrl = token
      ? `http://${host}:5174/admin/roster?session_token=${encodeURIComponent(token)}`
      : `http://${host}:5174/admin/roster`;
    window.location.href = targetUrl;
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 font-mono text-sm text-rose-400">
        Admin account detected. Redirecting to Executive Command (5174)...
      </div>
    );
  }

  if (role === 'responder' || role === '2') return <Navigate to="/responder/roster" replace />;
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
          <Route path="/" element={isAdminPort ? <AdminLoginPage /> : <LandingPage />} />
          <Route path="/home" element={isAdminPort ? <AdminLoginPage /> : <LandingPage />} />
          <Route path="/landing" element={isAdminPort ? <AdminLoginPage /> : <LandingPage />} />
          <Route path="/login" element={isAdminPort ? <AdminLoginPage /> : <LoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/responder/login" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <LoginPage />} />
          <Route path="/civilian/login" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <LoginPage />} />
          <Route path="/register" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <RegisterPage />} />
        </Route>

        {/* Top-Level Tactical Routes with Smart Role Navigation */}
        <Route path="/dashboard" element={<SmartDashboardRouter />} />
        <Route path="/incidents" element={<SmartIncidentsRouter />} />
        <Route path="/responders" element={<SmartRosterRouter />} />
        <Route path="/settings" element={isAdminPort ? <Navigate to="/admin/settings" replace /> : <SmartDashboardRouter />} />
        <Route path="/analytics" element={isAdminPort ? <Navigate to="/admin/analytics" replace /> : <SmartDashboardRouter />} />
        <Route path="/submitted-reports" element={isAdminPort ? <Navigate to="/admin/submitted-reports" replace /> : <SmartDashboardRouter />} />

        {/* LDRRMO Admin Executive Command Portal (/admin/*) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="strategic-map" element={<StrategicMapPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="submitted-reports" element={<SubmittedReportsPage />} />
          <Route path="reports" element={<Navigate to="/admin/submitted-reports" replace />} />
          <Route path="roster" element={<RespondersRosterPage />} />
          <Route path="analytics" element={<AnalyticsReportsPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="alerts" element={<AlertsCenter />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Responders Portal (/responder/*) */}
        <Route path="/responder" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <ResponderLayout />}>
          <Route index element={<ResponderDashboard />} />
          <Route path="dashboard" element={<ResponderDashboard />} />
          <Route path="incidents" element={<UnitIncidentsFeed />} />
          <Route path="request-deploy" element={<RequestDeployPage />} />
          <Route path="roster" element={<DutyRosterView />} />
          <Route path="reports" element={<MyReportsPage />} />
          <Route path="incident-logs" element={<MyReportsPage />} />
          <Route path="my-reports" element={<MyReportsPage />} />
          <Route path="alerts" element={<ResponderAlerts />} />
          <Route path="profile" element={<ResponderProfile />} />
        </Route>

        {/* UG Residents & Civilians Portal (/civilian/*) */}
        <Route path="/civilian" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <CivilianLayout />}>
          <Route index element={<CivilianDashboard />} />
          <Route path="dashboard" element={<CivilianDashboard />} />
          <Route path="live-map" element={<CivilianLiveMapPage />} />
          <Route path="map" element={<CivilianLiveMapPage />} />
          <Route path="report" element={<ReportAccidentPage />} />
          <Route path="my-reports" element={<MyReportsHistory />} />
          <Route path="alerts" element={<CommunityAlertsPage />} />
          <Route path="hotlines" element={<EmergencyHotlinesUnits />} />
          <Route path="profile" element={<CivilianProfile />} />
        </Route>

        {/* Canonical / Alias Portal Routing */}
        <Route path="/civilian-portal" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <Navigate to="/civilian/dashboard" replace />} />
        <Route path="/civilian-portal/*" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <Navigate to="/civilian" replace />} />
        <Route path="/responder-portal" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <Navigate to="/responder/dashboard" replace />} />
        <Route path="/responder-portal/*" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <Navigate to="/responder" replace />} />
        <Route path="/admin-portal" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin-portal/*" element={<Navigate to="/admin" replace />} />

        {/* Static HTML Compatibility Redirects */}
        <Route path="/index.html" element={<Navigate to="/login" replace />} />
        <Route path="/register.html" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <Navigate to="/register" replace />} />
        <Route path="/dashboard.html" element={<Navigate to="/dashboard" replace />} />
        <Route path="/incidents.html" element={<Navigate to="/incidents" replace />} />
        <Route path="/responders.html" element={<Navigate to="/responders" replace />} />
        <Route path="/admin.html" element={<Navigate to="/admin/users" replace />} />
        <Route path="/responder.html" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <Navigate to="/responder" replace />} />
        <Route path="/settings.html" element={isAdminPort ? <Navigate to="/admin/settings" replace /> : <Navigate to="/login" replace />} />

        {/* Fallback */}
        <Route path="*" element={isAdminPort ? <Navigate to="/admin/login" replace /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
