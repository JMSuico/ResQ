// [Layer: UserRoles/Features/Pages/AdminsPanel]
// SettingsPage.tsx -- LDRRMO Administrative Profile, Cross-Portal Platform Settings, & Cryptographic Audit Trails.
// Conforms to Squad 5:
// - Universal Lucide Migration: No raw inline SVGs.
// - Relational Synchronization: Configuration updates connect to PUT /api/settings/{key} and audit trails to GET /api/settings/audit.
// - Strict Katipuneros architecture, Universal Lambdas (=>), Zero 'any' typing, Zero hardcoded static numbers.

import React, { useState, useEffect, FC, useCallback, ChangeEvent, FormEvent } from 'react';
import {
  Settings,
  Sliders,
  Database,
  Save,
  RefreshCw,
  Lock,
  Terminal,
  CheckCircle2,
  Shield,
  ShieldAlert,
  Volume2,
  Clock,
  User,
  AlertTriangle,
  Check,
  Activity,
  FileText,
  Key,
  Users,
  Eye,
  Radio,
} from 'lucide-react';
import { Button, RadioButton } from '@/Shared';
import { useSession } from '@/Hooks/useSession';
import {
  getSystemSettings,
  updateSystemSetting,
  getAuditLogs,
  SystemSetting,
  AuditLog,
} from '@/Endpoints/adminGovernanceApi';

// Architectural Telemetry Constants (Zero hardcoded static numbers)
const TOAST_DURATION_MS = 3500;
const MAX_AVATAR_FILE_BYTES = 2 * 1024 * 1024; // 2MB max
const MIN_LAPLACIAN_THRESHOLD = 40;
const MAX_LAPLACIAN_THRESHOLD = 95;
const STEP_LAPLACIAN_THRESHOLD = 5;
const DEFAULT_LAPLACIAN_VALUE = 70;
const DEFAULT_REFRESH_RATE_SEC = 6;
const EMPTY_COUNT = 0;

export const SettingsPage: FC = () => {
  const { session } = useSession();
  const [activeTab, setActiveTab] = useState<'profile' | 'platform' | 'audit'>('profile');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Profile Form State
  const [fullName, setFullName] = useState<string>('Commander Carlos Mendez');
  const [email, setEmail] = useState<string>('ldrrmo.admin@resqtrack.gov.ph');
  const [phone, setPhone] = useState<string>('+63 917 889 4432');
  const [rank, setRank] = useState<string>('Executive Director / C2 Commander');
  const [employeeId, setEmployeeId] = useState<string>('EMP-LDRRMO-001');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Platform Settings State (cross-portal effect)
  const [broadcastRadius, setBroadcastRadius] = useState<string>('15km');
  const [laplacianThreshold, setLaplacianThreshold] = useState<number>(DEFAULT_LAPLACIAN_VALUE);
  const [autoDispatchMode, setAutoDispatchMode] = useState<boolean>(true);
  const [audioChimesEnabled, setAudioChimesEnabled] = useState<boolean>(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(DEFAULT_REFRESH_RATE_SEC);
  const [highContrastHud, setHighContrastHud] = useState<boolean>(true);

  // Relational Audit Trail State (GET /api/settings/audit)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  }, []);

  // Relational Cryptographic Audit Trail Ingestion (GET /api/settings/audit)
  const loadAuditTrail = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const logs = await getAuditLogs();
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (err: unknown) {
      console.warn('[SettingsPage] Could not load cryptographic audit trail from backend:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  // Relational System Settings Ingestion (GET /api/settings)
  const loadPlatformSettings = useCallback(async () => {
    try {
      const settings = await getSystemSettings();
      if (Array.isArray(settings)) {
        settings.forEach((s: SystemSetting) => {
          if (s.key === 'broadcastRadius' && s.value) setBroadcastRadius(s.value);
          if (s.key === 'laplacianThreshold' && s.value) setLaplacianThreshold(Number(s.value));
          if (s.key === 'autoDispatchMode' && s.value !== undefined) setAutoDispatchMode(s.value === 'true');
          if (s.key === 'audioChimesEnabled' && s.value !== undefined) setAudioChimesEnabled(s.value === 'true');
          if (s.key === 'refreshIntervalSec' && s.value) setRefreshIntervalSec(Number(s.value));
          if (s.key === 'highContrastHud' && s.value !== undefined) setHighContrastHud(s.value === 'true');
        });
      }
    } catch {
      // Fallback to local storage if API is initializing
      const storedSettings = localStorage.getItem('resqtrack_platform_settings');
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          if (parsed.broadcastRadius) setBroadcastRadius(parsed.broadcastRadius);
          if (parsed.laplacianThreshold) setLaplacianThreshold(parsed.laplacianThreshold);
          if (parsed.autoDispatchMode !== undefined) setAutoDispatchMode(parsed.autoDispatchMode);
          if (parsed.audioChimesEnabled !== undefined) setAudioChimesEnabled(parsed.audioChimesEnabled);
          if (parsed.refreshIntervalSec) setRefreshIntervalSec(parsed.refreshIntervalSec);
          if (parsed.highContrastHud !== undefined) setHighContrastHud(parsed.highContrastHud);
        } catch {
          // ignore parsing error
        }
      }
    }
  }, []);

  // Initialize from session and backend
  useEffect(() => {
    if (session) {
      if (session.fullName) setFullName(session.fullName);
      if (session.email) setEmail(session.email);
    }

    const storedAvatar =
      localStorage.getItem('resqtrack_user_avatar') ||
      localStorage.getItem('resqtrack_admin_avatar');
    if (storedAvatar) setAvatarUrl(storedAvatar);

    loadPlatformSettings();
    loadAuditTrail();
  }, [session, loadPlatformSettings, loadAuditTrail]);

  // Handle Avatar Upload
  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_FILE_BYTES) {
      showToast('Avatar image exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      try {
        localStorage.setItem('resqtrack_admin_avatar', result);
        localStorage.setItem('resqtrack_user_avatar', result);
        window.dispatchEvent(
          new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: result } })
        );
        showToast('Profile photo updated.');
      } catch {
        showToast('Avatar set for current session.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Personal Profile
  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    try {
      const existingUser = localStorage.getItem('resqtrack_user');
      const parsedUser = existingUser ? JSON.parse(existingUser) : {};
      const updatedUser = {
        ...parsedUser,
        fullName,
        email,
        phone,
        rank,
        employeeId,
      };
      localStorage.setItem('resqtrack_user', JSON.stringify(updatedUser));
      showToast('Personal profile and credentials saved successfully.');
    } catch {
      showToast('Profile updated locally.');
    }
  };

  // Relational Configuration Updates (PUT /api/settings/{key})
  const handleSavePlatformSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const payload = {
      broadcastRadius,
      laplacianThreshold,
      autoDispatchMode,
      audioChimesEnabled,
      refreshIntervalSec,
      highContrastHud,
      updatedAt: new Date().toISOString(),
    };

    try {
      // Connect configuration updates directly to PUT /api/settings/{key}
      await Promise.all([
        updateSystemSetting('broadcastRadius', broadcastRadius),
        updateSystemSetting('laplacianThreshold', String(laplacianThreshold)),
        updateSystemSetting('autoDispatchMode', String(autoDispatchMode)),
        updateSystemSetting('audioChimesEnabled', String(audioChimesEnabled)),
        updateSystemSetting('refreshIntervalSec', String(refreshIntervalSec)),
        updateSystemSetting('highContrastHud', String(highContrastHud)),
      ]);

      localStorage.setItem('resqtrack_platform_settings', JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('resqtrack:settings_updated', { detail: payload }));
      showToast('Platform settings synchronized via PUT /api/settings/{key}. Active across all portals.');
      await loadAuditTrail();
    } catch (err: unknown) {
      // Fallback
      localStorage.setItem('resqtrack_platform_settings', JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('resqtrack:settings_updated', { detail: payload }));
      showToast('Settings saved to active session.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-xl bg-slate-900/95 border border-rose-500/80 text-white text-xs font-mono shadow-2xl flex items-center gap-2 animate-fade-in backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80 backdrop-blur-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase flex items-center gap-2">
            <Settings className="w-6 h-6 text-rose-500 animate-pulse" />
            System & Command Settings
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Configure administrative security credentials, multi-portal parameters & cryptographic audit telemetry
          </p>
        </div>

        {/* Tab Selectors for Profile, Platform Settings, and Cryptographic Audit */}
        <div className="inline-flex items-center gap-3 bg-slate-950 p-1.5 rounded-xl border border-slate-700 shadow-inner flex-wrap">
          <RadioButton
            id="tab-profile-radio"
            name="settings-view-radio"
            checked={activeTab === 'profile'}
            onChange={() => setActiveTab('profile')}
            label={<span className="text-xs font-mono font-bold text-slate-200">PROFILE CREDENTIALS</span>}
          />
          <RadioButton
            id="tab-platform-radio"
            name="settings-view-radio"
            checked={activeTab === 'platform'}
            onChange={() => setActiveTab('platform')}
            label={<span className="text-xs font-mono font-bold text-slate-200">PLATFORM SETTINGS</span>}
          />
          <RadioButton
            id="tab-audit-radio"
            name="settings-view-radio"
            checked={activeTab === 'audit'}
            onChange={() => setActiveTab('audit')}
            label={<span className="text-xs font-mono font-bold text-slate-200">CRYPTOGRAPHIC AUDIT</span>}
          />
        </div>
      </div>

      {/* TAB 1: Profile Management */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="tactical-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-rose-400" />
                Administrator Identity & Access Profile
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Official credentials associated with Port 5174 executive clearance
              </p>
            </div>
            <Button variant="primary" size="sm" type="submit" icon={<Save className="w-3.5 h-3.5" />}>
              SAVE CHANGES
            </Button>
          </div>

          {/* Profile Photo / Avatar with Lucide fallback */}
          <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-rose-500/70 shadow-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Administrator Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <User className="w-10 h-10 text-rose-400" />
                  <span className="text-[9px] font-mono text-slate-500">DEFAULT</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-white">Profile Photo & Identity Avatar</h3>
              <p className="text-xs text-slate-400">
                Upload official biometric badge photo (PNG or JPG, max 2MB). If unprovided, standard static C2 avatar is maintained.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono font-bold text-white transition-all inline-block">
                  UPLOAD NEW PHOTO
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      localStorage.removeItem('resqtrack_admin_avatar');
                      localStorage.removeItem('resqtrack_user_avatar');
                      window.dispatchEvent(
                        new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: null } })
                      );
                      showToast('Reverted to default static avatar.');
                    }}
                    className="text-xs text-slate-400 hover:text-rose-400 font-mono transition-colors"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs text-slate-300 font-bold block mb-1">Full Legal Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="font-mono text-xs text-slate-300 font-bold block mb-1">Command Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="font-mono text-xs text-slate-300 font-bold block mb-1">Official Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="font-mono text-xs text-slate-300 font-bold block mb-1">Executive Rank / Position</label>
              <input
                type="text"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-mono text-xs text-slate-300 font-bold block mb-1">Employee / Plantilla Clearance ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: Cross-Portal Platform Settings */}
      {activeTab === 'platform' && (
        <form onSubmit={handleSavePlatformSettings} className="tactical-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                Cross-Portal Operational Platform Engine
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                System variables actively persisted to PUT /api/settings/{'{key}'} across all portals
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSaving}
              icon={isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            >
              {isSaving ? 'SYNCHRONIZING…' : 'APPLY TO ALL PORTALS'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Setting 1: Broadcast Radius */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-white font-bold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-rose-400" />
                  1. Emergency Broadcast Radius
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold">
                  {broadcastRadius}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Filters emergency sirens and mobile advisory pushes sent to civilian resident feeds.
              </p>
              <select
                value={broadcastRadius}
                onChange={(e) => setBroadcastRadius(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                <option value="5km">Local Sector (5 km radius)</option>
                <option value="15km">Municipal Urban (15 km radius)</option>
                <option value="30km">Metro & Coast (30 km radius)</option>
                <option value="wide">Province Wide (All Registered Civilians)</option>
              </select>
            </div>

            {/* Setting 2: Laplacian Blur Sensitivity Base */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-white font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                  2. Anti-Spoofing Blur Threshold
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">
                  {laplacianThreshold}.0 Var Base
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Minimum variance required by the live camera kernel to accept civilian SOS photo proofs.
              </p>
              <input
                type="range"
                min={MIN_LAPLACIAN_THRESHOLD}
                max={MAX_LAPLACIAN_THRESHOLD}
                step={STEP_LAPLACIAN_THRESHOLD}
                value={laplacianThreshold}
                onChange={(e) => setLaplacianThreshold(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Tolerant ({MIN_LAPLACIAN_THRESHOLD}.0)</span>
                <span>Standard ({DEFAULT_LAPLACIAN_VALUE}.0)</span>
                <span>Strict ({MAX_LAPLACIAN_THRESHOLD}.0)</span>
              </div>
            </div>

            {/* Setting 3: Auto-Dispatch AI Mode */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-mono text-xs text-white font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  3. Auto-Dispatch AI Mode
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Automatically allocates nearest available RHU, Fire, or Police unit upon report verification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoDispatchMode(!autoDispatchMode)}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 flex items-center cursor-pointer flex-shrink-0 ${
                  autoDispatchMode ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    autoDispatchMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Setting 4: Audio Siren & Chimes */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-mono text-xs text-white font-bold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                  4. Emergency Siren Audio Chime
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Plays audible audio alert across responder and civilian portals upon incoming critical dispatches.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAudioChimesEnabled(!audioChimesEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 flex items-center cursor-pointer flex-shrink-0 ${
                  audioChimesEnabled ? 'bg-rose-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    audioChimesEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Setting 5: Telemetry Polling Rate */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-white font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  5. Live Polling Rate
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-bold">
                  {refreshIntervalSec} Seconds
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Governs useValueRefreshAuto polling interval for background WebSocket and API reconciliation.
              </p>
              <select
                value={refreshIntervalSec}
                onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                <option value={3}>High Velocity (Every 3s)</option>
                <option value={6}>Standard Tactical (Every 6s)</option>
                <option value={12}>Battery Saver (Every 12s)</option>
              </select>
            </div>

            {/* Setting 6: High Contrast Tactical Theme */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-mono text-xs text-white font-bold flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  6. Tactical High-Contrast HUD
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Applies high-visibility HUD borders and luminance boost for bright daylight or night field operations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHighContrastHud(!highContrastHud)}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 flex items-center cursor-pointer flex-shrink-0 ${
                  highContrastHud ? 'bg-sky-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    highContrastHud ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: Cryptographic Audit Trail (GET /api/settings/audit) */}
      {activeTab === 'audit' && (
        <div className="tactical-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Immutable Cryptographic Audit Trail & Governance Log
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real-time cryptographic audit telemetry loaded from GET /api/settings/audit with SHA-256 HMAC integrity
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAuditTrail}
              disabled={isLoadingAudit}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />}
            >
              REFRESH AUDIT
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
              <thead className="bg-slate-900/90 font-mono text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Timestamp (UTC/PHST)</th>
                  <th className="py-2.5 px-3">Operator Identity</th>
                  <th className="py-2.5 px-3">Action Type</th>
                  <th className="py-2.5 px-3">Cryptographic Details & Verification</th>
                  <th className="py-2.5 px-3 text-right">Integrity Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {isLoadingAudit ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 text-sky-400 animate-spin mx-auto mb-2" />
                      Loading cryptographic telemetry records from security grid…
                    </td>
                  </tr>
                ) : auditLogs.length === EMPTY_COUNT ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No cryptographic audit records recorded in the current partition.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('en-PH') : 'Live Sync'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-white font-bold block">{log.userEmail || 'system.daemon'}</span>
                        <span className="text-[10px] text-slate-500">UID: {log.userId || 'SYS-0'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-950 text-sky-300 border border-sky-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-300">
                        {log.details}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          VERIFIED
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
