// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: View and update responder operational profile, tactical radio channel, credentials,
// and Satellite Radar UI Pointer Visibility Settings.
// Universal Lucide icon standard with strict typing (ZERO any) and universal arrow syntax (=>).

import React, { useState, useEffect } from 'react';
import { Camera, Radar, Eye, Palette, Check, Shield, Radio } from 'lucide-react';
import { useSession } from '@/Hooks/useSession';
import { Button, RadioButton } from '@/Shared';

export interface MedicPointerSettings {
  paleNonMedicPointers: boolean;
  nonMedicPaleColor: boolean;
  paleColorEnabled: boolean;
  enablePaleNonMedic: boolean;
  paleColorMode: 'ENABLED' | 'DISABLED';
  hideNonMedicPointers: boolean;
  hideNonMedicWhenSorted: boolean;
  showNonMedicPointers: boolean;
  nonMedicVisibility: 'SHOW_PALE' | 'HIDE';
  sortedVisibilityMode: 'SHOW_PALE' | 'HIDE';
}

const POINTER_SETTINGS_STORAGE_KEY = 'resqtrack_medic_pointer_settings';

const buildPointerSettingsPayload = (
  paleEnabled: boolean,
  hideNonMedic: boolean
): MedicPointerSettings => ({
  paleNonMedicPointers: paleEnabled,
  nonMedicPaleColor: paleEnabled,
  paleColorEnabled: paleEnabled,
  enablePaleNonMedic: paleEnabled,
  paleColorMode: paleEnabled ? 'ENABLED' : 'DISABLED',
  hideNonMedicPointers: hideNonMedic,
  hideNonMedicWhenSorted: hideNonMedic,
  showNonMedicPointers: !hideNonMedic,
  nonMedicVisibility: hideNonMedic ? 'HIDE' : 'SHOW_PALE',
  sortedVisibilityMode: hideNonMedic ? 'HIDE' : 'SHOW_PALE'
});

export const ResponderProfile: React.FC = () => {
  const { session } = useSession();
  const [radioFreq, setRadioFreq] = useState<string>('');
  const [apparatusPlate, setApparatusPlate] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Satellite Radar UI Pointer Visibility Settings state
  const [paleNonMedicEnabled, setPaleNonMedicEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(POINTER_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MedicPointerSettings>;
        if (typeof parsed.paleNonMedicPointers === 'boolean') return parsed.paleNonMedicPointers;
        if (typeof parsed.nonMedicPaleColor === 'boolean') return parsed.nonMedicPaleColor;
        if (typeof parsed.paleColorEnabled === 'boolean') return parsed.paleColorEnabled;
        if (parsed.paleColorMode === 'DISABLED') return false;
      }
    } catch {
      // Fallback to default enabled
    }
    return true;
  });

  const [hideNonMedicWhenSorted, setHideNonMedicWhenSorted] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(POINTER_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MedicPointerSettings>;
        if (typeof parsed.hideNonMedicPointers === 'boolean') return parsed.hideNonMedicPointers;
        if (typeof parsed.hideNonMedicWhenSorted === 'boolean') return parsed.hideNonMedicWhenSorted;
        if (parsed.nonMedicVisibility === 'HIDE' || parsed.sortedVisibilityMode === 'HIDE') return true;
      }
    } catch {
      // Fallback to default show pale
    }
    return false;
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem('resqtrack_responder_avatar') ||
        localStorage.getItem('resqtrack_user_avatar') ||
        null
      );
    } catch {
      return null;
    }
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const syncPointerSettings = (nextPaleEnabled: boolean, nextHideNonMedic: boolean, notifyLabel?: string) => {
    setPaleNonMedicEnabled(nextPaleEnabled);
    setHideNonMedicWhenSorted(nextHideNonMedic);
    const payload = buildPointerSettingsPayload(nextPaleEnabled, nextHideNonMedic);
    try {
      localStorage.setItem(POINTER_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
      window.dispatchEvent(
        new CustomEvent('resqtrack:pointer-settings', { detail: payload })
      );
      if (notifyLabel) {
        showToast(notifyLabel);
      }
    } catch (err) {
      console.error('Failed to persist medic pointer settings:', err);
    }
  };

  // Ensure initial pointer settings exist in localStorage for SatelliteCommandMap
  useEffect(() => {
    try {
      const existing = localStorage.getItem(POINTER_SETTINGS_STORAGE_KEY);
      if (!existing) {
        const initialPayload = buildPointerSettingsPayload(paleNonMedicEnabled, hideNonMedicWhenSorted);
        localStorage.setItem(POINTER_SETTINGS_STORAGE_KEY, JSON.stringify(initialPayload));
      }
    } catch {
      // Ignore storage access error
    }
  }, [paleNonMedicEnabled, hideNonMedicWhenSorted]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Avatar image exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      try {
        localStorage.setItem('resqtrack_user_avatar', dataUrl);
        localStorage.setItem('resqtrack_responder_avatar', dataUrl);
        window.dispatchEvent(
          new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: dataUrl } })
        );
        showToast('Officer identity photo updated & synchronized.');
      } catch (err) {
        console.error('Failed to save responder avatar', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetAvatar = () => {
    setAvatarUrl(null);
    try {
      localStorage.removeItem('resqtrack_user_avatar');
      localStorage.removeItem('resqtrack_responder_avatar');
      window.dispatchEvent(
        new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: null } })
      );
      showToast('Reverted to default responder photo avatar.');
    } catch (err) {
      console.error('Failed to reset avatar', err);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('resqtrack_responder_profile');
      if (saved) {
        const parsed = JSON.parse(saved) as {
          radioFreq?: string;
          apparatusPlate?: string;
          emergencyPhone?: string;
        };
        if (parsed.radioFreq) setRadioFreq(parsed.radioFreq);
        if (parsed.apparatusPlate) setApparatusPlate(parsed.apparatusPlate);
        if (parsed.emergencyPhone) setEmergencyPhone(parsed.emergencyPhone);
      } else {
        if (session?.unit === 'RHU' || !session?.unit || session?.unit === 'None') {
          setRadioFreq('142.850 MHz');
          setApparatusPlate('RHU-MEDIC-01');
        } else if (session?.unit === 'FIRE') {
          setRadioFreq('143.100 MHz');
          setApparatusPlate('BFP-ENGINE-01');
        } else if (session?.unit === 'PNP') {
          setRadioFreq('143.450 MHz');
          setApparatusPlate('PNP-PATROL-01');
        }
      }
    } catch {
      // Ignore parse error
    }
  }, [session]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(
        'resqtrack_responder_profile',
        JSON.stringify({ radioFreq, apparatusPlate, emergencyPhone })
      );
      setIsSaved(true);
      showToast('Field apparatus & radio telemetry configuration saved.');
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      // Ignore storage error
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 select-none pb-10">
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-sky-950/95 border border-sky-500 text-sky-200 text-xs font-medium flex items-center gap-3 shadow-lg shadow-sky-950/50">
          <Check className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header: PROFILE SETTINGS */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-sky-400">RHU EMERGENCY MEDICAL SERVICES</span>
          <span className="text-slate-600 font-mono">|</span>
          <span className="text-xs font-mono text-slate-400">OFFICER IDENTIFICATION &amp; RADAR HUD PREFERENCES</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight uppercase">PROFILE SETTINGS</h1>
      </div>

      {/* Responder Credentials & Apparatus Config Card */}
      <div className="tactical-card p-6 flex flex-col gap-6 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
          <div className="relative group w-16 h-16 rounded-2xl overflow-hidden border border-sky-400/50 shadow-lg bg-slate-950 flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={session?.fullName || 'Responder'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-2xl font-black text-white">
                {session?.fullName?.charAt(0) || 'R'}
              </div>
            )}

            {/* Photo Upload Overlay Button */}
            <label
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-mono font-bold"
              title="Upload Officer Photo"
            >
              <Camera className="w-5 h-5 mb-0.5 text-sky-400" />
              <span>PHOTO</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white font-sans">{session?.fullName || 'Active Medic Officer'}</h3>
              {session?.faceVerified && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>BIOMETRICALLY VERIFIED</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{session?.email || 'medic.rhu@resqtrack.gov.ph'}</p>

            {/* Upload photo / Reset actions */}
            <div className="flex items-center gap-3 mt-1.5">
              <label className="text-[11px] font-mono font-bold text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleResetAvatar}
                  className="text-[11px] font-mono text-slate-400 hover:text-rose-400 underline transition-colors cursor-pointer"
                >
                  Reset to Default Photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">OPERATIONAL ROLE</span>
            <span className="text-white font-bold">{session?.role || 'Responder'}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">ASSIGNED UNIT AGENCY</span>
            <span className="text-sky-400 font-bold">{session?.unit || 'RHU'}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">BADGE / EMPLOYEE ID</span>
            <span className="text-white font-bold">{session?.employeeOrResidentId || 'RES-RHU-019'}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">RANK / TITLE</span>
            <span className="text-white font-bold">{session?.rankOrTitle || 'EMS Trauma Medic'}</span>
          </div>
        </div>

        {/* Tactical Field Apparatus & Radio Config */}
        <form onSubmit={handleSave} className="flex flex-col gap-4 pt-4 border-t border-slate-800 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              <span>FIELD APPARATUS &amp; RADIO TELEMETRY CONFIG</span>
            </span>
            {isSaved && <span className="text-emerald-400 font-bold">✓ SETTINGS PERSISTED</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-[10px] uppercase">Assigned Radio Frequency</label>
              <input
                type="text"
                value={radioFreq}
                onChange={(e) => setRadioFreq(e.target.value)}
                placeholder="e.g. 142.850 MHz"
                className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500 font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-[10px] uppercase">Apparatus Plate / Call Sign</label>
              <input
                type="text"
                value={apparatusPlate}
                onChange={(e) => setApparatusPlate(e.target.value)}
                placeholder="e.g. S-RHU-04"
                className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500 font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-[10px] uppercase">Duty Cellular Hotline</label>
              <input
                type="text"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="e.g. +63 917 882 1928"
                className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500 font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="sm" className="font-bold">
              Save Apparatus Settings
            </Button>
          </div>
        </form>
      </div>

      {/* Satellite Radar UI Pointer Visibility Settings Card */}
      <div className="tactical-card p-6 flex flex-col gap-5 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-black font-mono uppercase tracking-wider text-white">
                SATELLITE RADAR UI POINTER VISIBILITY SETTINGS
              </h2>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Configure how non-medic incident pointers (BFP Fire / PNP Police) render on the EMS Trauma Board radar map
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-sky-950/80 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300 self-start sm:self-center">
            REAL-TIME RADAR SYNC
          </span>
        </div>

        {/* Setting 1 — Non-Medic Pointer Pale Color Indication */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wide">
                Setting 1 — Non-Medic Pointer Pale Color Indication
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                paleNonMedicEnabled
                  ? 'bg-sky-950 text-sky-300 border-sky-600'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              {paleNonMedicEnabled ? 'ENABLED (PALE COLOR)' : 'DISABLED (NORMAL COLOR)'}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-400">
            Controls whether non-medic pointers on the EMS TRAUMA BOARD radar map are rendered in pale desaturated color so RHU Medic priorities stand out clearly.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              onClick={() =>
                syncPointerSettings(
                  true,
                  hideNonMedicWhenSorted,
                  'Radar Pointer Setting Updated: Non-Medic Pale Color ENABLED'
                )
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                paleNonMedicEnabled
                  ? 'bg-sky-950/60 border-sky-500 shadow-md shadow-sky-950/50'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <RadioButton
                id="radio-pale-color-enabled"
                name="nonMedicPaleColorIndication"
                checked={paleNonMedicEnabled}
                onChange={() =>
                  syncPointerSettings(
                    true,
                    hideNonMedicWhenSorted,
                    'Radar Pointer Setting Updated: Non-Medic Pale Color ENABLED'
                  )
                }
                label="ENABLED (PALE COLOR)"
                description="Render non-medic incident markers in desaturated pale tone on EMS Trauma Board"
              />
            </div>

            <div
              onClick={() =>
                syncPointerSettings(
                  false,
                  hideNonMedicWhenSorted,
                  'Radar Pointer Setting Updated: Non-Medic Pale Color DISABLED (Normal Color)'
                )
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                !paleNonMedicEnabled
                  ? 'bg-sky-950/60 border-sky-500 shadow-md shadow-sky-950/50'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <RadioButton
                id="radio-pale-color-disabled"
                name="nonMedicPaleColorIndication"
                checked={!paleNonMedicEnabled}
                onChange={() =>
                  syncPointerSettings(
                    false,
                    hideNonMedicWhenSorted,
                    'Radar Pointer Setting Updated: Non-Medic Pale Color DISABLED (Normal Color)'
                  )
                }
                label="DISABLED (NORMAL COLOR)"
                description="Render all agency incident markers in full standard saturation"
              />
            </div>
          </div>
        </div>

        {/* Setting 2 — Non-Medic Pointer Visibility When Sorted */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wide">
                Setting 2 — Non-Medic Pointer Visibility When Sorted
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                !hideNonMedicWhenSorted
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                  : 'bg-rose-950 text-rose-300 border-rose-600'
              }`}
            >
              {!hideNonMedicWhenSorted
                ? 'SHOW PALE NON-MEDIC POINTERS'
                : 'MAKE DIRECTLY NOT VISIBLE (HIDE NON-MEDIC POINTERS)'}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-400">
            Controls whether non-assigned pointers for medics remain visible in pale mode or are completely hidden on the radar map when sorted.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              onClick={() =>
                syncPointerSettings(
                  paleNonMedicEnabled,
                  false,
                  'Radar Pointer Visibility: SHOW PALE NON-MEDIC POINTERS'
                )
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                !hideNonMedicWhenSorted
                  ? 'bg-emerald-950/50 border-emerald-500 shadow-md shadow-emerald-950/50'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <RadioButton
                id="radio-visibility-show-pale"
                name="nonMedicPointerVisibilityWhenSorted"
                checked={!hideNonMedicWhenSorted}
                onChange={() =>
                  syncPointerSettings(
                    paleNonMedicEnabled,
                    false,
                    'Radar Pointer Visibility: SHOW PALE NON-MEDIC POINTERS'
                  )
                }
                label="SHOW PALE NON-MEDIC POINTERS"
                description="Keep non-medic pointers visible on radar with pale styling for peripheral situational awareness"
              />
            </div>

            <div
              onClick={() =>
                syncPointerSettings(
                  paleNonMedicEnabled,
                  true,
                  'Radar Pointer Visibility: MAKE DIRECTLY NOT VISIBLE (HIDE NON-MEDIC POINTERS)'
                )
              }
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                hideNonMedicWhenSorted
                  ? 'bg-rose-950/50 border-rose-500 shadow-md shadow-rose-950/50'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <RadioButton
                id="radio-visibility-hide-non-medic"
                name="nonMedicPointerVisibilityWhenSorted"
                checked={hideNonMedicWhenSorted}
                onChange={() =>
                  syncPointerSettings(
                    paleNonMedicEnabled,
                    true,
                    'Radar Pointer Visibility: MAKE DIRECTLY NOT VISIBLE (HIDE NON-MEDIC POINTERS)'
                  )
                }
                label="MAKE DIRECTLY NOT VISIBLE (HIDE NON-MEDIC POINTERS)"
                description="Completely hide non-assigned pointers on the EMS Trauma Board radar map"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponderProfile;
