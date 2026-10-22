// [Layer: UserRoles/Features/Pages/AdminsPanel]
// SettingsPage.tsx -- LDRRMO Administrative Profile & Cross-Portal Platform Settings.
// Conforms to Task 29:
// - Top Radio button selector for Profile | Platform Settings
// - Profile Tab: Admin personal credentials edit, avatar upload with static fallback
// - Platform Settings Tab: Operational parameters affecting Admin, Responder, and Civilian portals:
//   1. Emergency Broadcast Radius
//   2. AI Laplacian Blur Variance Threshold (Camera Anti-Spoofing)
//   3. Auto-Dispatch AI Mode
//   4. Emergency Alert Siren & Audio Chimes
//   5. Telemetry Refresh Interval
//   6. Cross-Portal Synchronized Telemetry State

import React, { useState, useEffect, FC } from 'react';
import { Button, RadioButton } from '@/Shared';
import { useSession } from '@/Hooks/useSession';

export const SettingsPage: FC = () => {
  const { session } = useSession();
  const [activeTab, setActiveTab] = useState<'profile' | 'platform'>('profile');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Profile Form State
  const [fullName, setFullName] = useState<string>('Commander Carlos Mendez');
  const [email, setEmail] = useState<string>('ldrrmo.admin@resqtrack.gov.ph');
  const [phone, setPhone] = useState<string>('+63 917 889 4432');
  const [rank, setRank] = useState<string>('Executive Director / C2 Commander');
  const [employeeId, setEmployeeId] = useState<string>('EMP-LDRRMO-001');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Platform Settings State (cross-portal effect)
  const [broadcastRadius, setBroadcastRadius] = useState<string>('15km');
  const [laplacianThreshold, setLaplacianThreshold] = useState<number>(70);
  const [autoDispatchMode, setAutoDispatchMode] = useState<boolean>(true);
  const [audioChimesEnabled, setAudioChimesEnabled] = useState<boolean>(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(6);
  const [highContrastHud, setHighContrastHud] = useState<boolean>(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load existing profile & platform settings
  useEffect(() => {
    if (session) {
      if (session.fullName) setFullName(session.fullName);
      if (session.email) setEmail(session.email);
    }

    try {
      const storedSettings = localStorage.getItem('resqtrack_platform_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (parsed.broadcastRadius) setBroadcastRadius(parsed.broadcastRadius);
        if (parsed.laplacianThreshold) setLaplacianThreshold(parsed.laplacianThreshold);
        if (parsed.autoDispatchMode !== undefined) setAutoDispatchMode(parsed.autoDispatchMode);
        if (parsed.audioChimesEnabled !== undefined) setAudioChimesEnabled(parsed.audioChimesEnabled);
        if (parsed.refreshIntervalSec) setRefreshIntervalSec(parsed.refreshIntervalSec);
        if (parsed.highContrastHud !== undefined) setHighContrastHud(parsed.highContrastHud);
      }

      const storedAvatar = localStorage.getItem('resqtrack_admin_avatar');
      if (storedAvatar) setAvatarUrl(storedAvatar);
    } catch {
      // ignore
    }
  }, [session]);

  // Handle Avatar Upload
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Avatar image exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      try {
        localStorage.setItem('resqtrack_admin_avatar', result);
        showToast('Profile photo updated.');
      } catch {
        showToast('Avatar set for current session.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
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
        employeeId
      };
      localStorage.setItem('resqtrack_user', JSON.stringify(updatedUser));
      showToast('Personal profile and credentials saved successfully.');
    } catch {
      showToast('Profile updated locally.');
    }
  };

  // Save Platform Settings (Task 29 - actively affects other user portals)
  const handleSavePlatformSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      broadcastRadius,
      laplacianThreshold,
      autoDispatchMode,
      audioChimesEnabled,
      refreshIntervalSec,
      highContrastHud,
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem('resqtrack_platform_settings', JSON.stringify(payload));
      // Dispatch custom event to notify all active windows & portals
      window.dispatchEvent(new CustomEvent('resqtrack:settings_updated', { detail: payload }));
      showToast('Platform settings synchronized. Active across Admin, Responders, and Civilians.');
    } catch {
      showToast('Settings saved to active session.');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-xl bg-slate-900/95 border border-rose-500/80 text-white text-xs font-mono shadow-2xl flex items-center gap-2 animate-fade-in backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80 backdrop-blur-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]" />
            System & Command Settings
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Configure administrative security credentials and global multi-portal dispatch parameters
          </p>
        </div>

        {/* Task 29: Radio Buttons at the Top for Profile | Platform Settings */}
        <div className="inline-flex items-center gap-4 bg-slate-950 p-2 rounded-xl border border-slate-700 shadow-inner">
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
        </div>
      </div>

      {/* TAB 1: Profile Management */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="tactical-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Administrator Identity & Access Profile
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Official credentials associated with Port 5174 executive clearance
              </p>
            </div>
            <Button variant="primary" size="sm" type="submit">
              SAVE CHANGES
            </Button>
          </div>

          {/* Profile Photo / Avatar with static fallback */}
          <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-rose-500/70 shadow-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Administrator Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <svg className="w-10 h-10 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
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

      {/* TAB 2: Cross-Portal Platform Settings (Task 29) */}
      {activeTab === 'platform' && (
        <form onSubmit={handleSavePlatformSettings} className="tactical-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Cross-Portal Operational Platform Engine
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                System variables actively persisted to all Responders, Civilians, and Dispatchers
              </p>
            </div>
            <Button variant="primary" size="sm" type="submit">
              APPLY TO ALL PORTALS
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Setting 1: Broadcast Radius */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-white font-bold">1. Emergency Broadcast Radius</label>
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
                <label className="font-mono text-xs text-white font-bold">2. Anti-Spoofing Blur Threshold</label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">
                  {laplacianThreshold}.0 Var Base
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Minimum variance required by the live camera kernel to accept civilian SOS photo proofs.
              </p>
              <input
                type="range"
                min="40"
                max="95"
                step="5"
                value={laplacianThreshold}
                onChange={(e) => setLaplacianThreshold(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Tolerant (40.0)</span>
                <span>Standard (70.0)</span>
                <span>Strict (95.0)</span>
              </div>
            </div>

            {/* Setting 3: Auto-Dispatch AI Mode */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-mono text-xs text-white font-bold">3. Auto-Dispatch AI Mode</h4>
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
                <h4 className="font-mono text-xs text-white font-bold">4. Emergency Siren Audio Chime</h4>
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
                <label className="font-mono text-xs text-white font-bold">5. Live Polling Rate</label>
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
                <h4 className="font-mono text-xs text-white font-bold">6. Tactical High-Contrast HUD</h4>
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
    </div>
  );
};

export default SettingsPage;
