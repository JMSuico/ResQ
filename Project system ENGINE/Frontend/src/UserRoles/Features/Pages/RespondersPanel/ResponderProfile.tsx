// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: View and update responder operational profile hydrated from GET /api/profile
// and persisted via PUT /api/profile (including avatarDataUrl and Satellite Radar UI Pointer Visibility Settings).
// Universal Lucide icon standard with strict typing (ZERO any) and universal arrow syntax (=>).

import React, { useState, useEffect } from 'react';
import { Camera, Radar, Eye, Palette, Check, Shield, Radio } from 'lucide-react';
import { useSession } from '@/Hooks/useSession';
import { Button, RadioButton } from '@/Shared';
import {
  getOwnProfile,
  OwnProfileDto,
  updateOwnProfile,
  UpdateOwnProfilePayload
} from '@/Endpoints/usersApi';
import { updateDutyStatus } from '@/Endpoints/responderOpsApi';

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

const getAgencyBadgeClass = (unit?: string): string => {
  const norm = (unit || 'RHU').toUpperCase();
  if (norm === 'FIRE') return 'bg-orange-100 text-orange-900 border-orange-700/30';
  if (norm === 'PNP') return 'bg-indigo-100 text-indigo-900 border-indigo-700/30';
  return 'bg-sky-100 text-sky-900 border-sky-700/30';
};

export const ResponderProfile: React.FC = () => {
  const { session } = useSession();
  const [profileData, setProfileData] = useState<OwnProfileDto | null>(null);
  const [radioFreq, setRadioFreq] = useState<string>('');
  const [apparatusPlate, setApparatusPlate] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      setIsLoadingProfile(true);
      try {
        const data = await getOwnProfile();
        if (cancelled || !data) return;
        setProfileData(data);
        setEmergencyPhone(data.phoneNumber || '');
        setApparatusPlate(data.departmentOrBarangay || '');
        setAvatarUrl(data.avatarDataUrl || null);
      } catch (err: unknown) {
        console.warn('[ResponderProfile] Failed to load profile from GET /api/profile:', err);
      } finally {
        if (!cancelled) setIsLoadingProfile(false);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncPointerSettings = (
    nextPaleEnabled: boolean,
    nextHideNonMedic: boolean,
    notifyLabel?: string
  ) => {
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
      console.error('Failed to dispatch pointer settings:', err);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Avatar image exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setAvatarUrl(dataUrl);
      try {
        await updateOwnProfile({ avatarDataUrl: dataUrl });
        window.dispatchEvent(
          new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: dataUrl } })
        );
        showToast('Officer identity photo saved to profile.');
      } catch (err: unknown) {
        console.warn('[ResponderProfile] Failed to persist avatar to backend:', err);
        showToast('Failed to save avatar to server.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetAvatar = async () => {
    setAvatarUrl(null);
    try {
      await updateOwnProfile({ avatarDataUrl: null });
      window.dispatchEvent(
        new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: null } })
      );
      showToast('Cleared profile avatar.');
    } catch (err: unknown) {
      console.warn('[ResponderProfile] Failed to clear avatar on backend:', err);
      showToast('Failed to clear avatar on server.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const profilePayload: UpdateOwnProfilePayload = {
        phoneNumber: emergencyPhone.trim() || undefined,
        departmentOrBarangay: apparatusPlate.trim() || undefined,
        avatarDataUrl: avatarUrl
      };

      await updateOwnProfile(profilePayload);

      if (apparatusPlate.trim()) {
        await updateDutyStatus('OnDuty', undefined, apparatusPlate.trim()).catch(() => undefined);
      }

      setIsSaved(true);
      showToast('Responder profile saved to PostgreSQL.');
      window.setTimeout(() => setIsSaved(false), 3000);
    } catch (err: unknown) {
      console.warn('[ResponderProfile] updateOwnProfile failed:', err);
      showToast('Failed to save profile changes to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = profileData?.fullName || session?.fullName || 'Responder';
  const displayEmail = profileData?.email || session?.email || '';
  const displayUnit = profileData?.unit || session?.unit || 'RHU';
  const displayRole = profileData?.role || session?.role || 'Responder';
  const displayEmpId = profileData?.employeeOrResidentId || session?.employeeOrResidentId || 'N/A';
  const displayRank = profileData?.rankOrTitle || session?.rankOrTitle || 'Responder';
  const isFaceVerified = profileData?.faceVerified ?? session?.faceVerified ?? false;

  return (
    <div className="flex flex-col gap-6 w-full text-[#2B010E] select-none pb-10">
      {toastMessage && (
        <div className="clay-surface p-4 rounded-xl bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] text-sm font-bold flex items-center gap-3 shadow-lg">
          <Check className="w-5 h-5 text-[#670626] flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header: Profile Settings */}
      <div className="border-b border-[#F7F1EA]/20 pb-4">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
          Responder Account &amp; Telemetry
        </span>
        <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
          Profile Settings
        </h1>
      </div>

      {/* Responder Credentials & Apparatus Config Card */}
      <div className="clay-surface p-6 flex flex-col gap-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl shadow-[0_16px_38px_rgba(74,4,26,0.24)]">
        <div className="flex items-center gap-4 pb-6 border-b border-[#670626]/15">
          <div className="relative group w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#670626]/25 shadow-sm bg-[#E9D9D0] flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#670626] flex items-center justify-center text-3xl font-black text-[#F7F1EA]">
                {displayName.charAt(0)}
              </div>
            )}

            <label
              className="absolute inset-0 bg-[#4A041A]/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-[#F7F1EA] text-xs font-mono font-bold"
              title="Upload Officer Photo"
            >
              <Camera className="w-5 h-5 mb-0.5 text-[#F7F1EA]" />
              <span>Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-xl font-black text-[#670626] font-sans">
                {isLoadingProfile ? 'Loading profile...' : displayName}
              </h3>
              {isFaceVerified && (
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-700/30 text-xs font-mono font-bold inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Verified</span>
                </span>
              )}
              <span
                className={`px-3 py-1 rounded-full border text-xs font-mono font-bold ${getAgencyBadgeClass(
                  displayUnit
                )}`}
              >
                {displayUnit}
              </span>
            </div>
            <p className="text-sm text-[#A83B4D] mt-0.5 font-mono">
              {displayEmail}
            </p>

            <div className="flex items-center gap-4 mt-2">
              <label className="text-xs font-mono font-bold text-[#670626] hover:text-[#4A041A] cursor-pointer flex items-center gap-1.5">
                <Camera className="w-4 h-4" />
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
                  onClick={() => void handleResetAvatar()}
                  className="text-xs font-mono text-[#A83B4D] hover:text-[#670626] underline transition-colors cursor-pointer"
                >
                  Reset Photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Role</span>
            <span className="text-[#670626] font-black text-base mt-0.5 block">
              {displayRole}
            </span>
          </div>

          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Unit Agency</span>
            <span className="mt-1 inline-block">
              <span
                className={`px-2.5 py-0.5 rounded-lg border text-sm font-black ${getAgencyBadgeClass(
                  displayUnit
                )}`}
              >
                {displayUnit}
              </span>
            </span>
          </div>

          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Employee ID</span>
            <span className="text-[#670626] font-black text-base mt-0.5 block">
              {displayEmpId}
            </span>
          </div>

          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Rank / Title</span>
            <span className="text-[#670626] font-black text-base mt-0.5 block">
              {displayRank}
            </span>
          </div>
        </div>

        {/* Tactical Field Apparatus & Contact Config */}
        <form onSubmit={handleSave} className="flex flex-col gap-4 pt-4 border-t border-[#670626]/15 text-sm font-mono">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-[#670626] tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#A83B4D]" />
              <span>Unit &amp; Contact Settings</span>
            </span>
            {isSaved && (
              <span className="text-emerald-800 font-bold inline-flex items-center gap-1.5 bg-emerald-100 border border-emerald-700/30 px-2.5 py-0.5 rounded-lg text-xs">
                <Check className="w-4 h-4 text-emerald-700" />
                <span>Saved</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#670626] text-xs font-bold">Radio Frequency (Optional)</label>
              <input
                type="text"
                value={radioFreq}
                onChange={(e) => setRadioFreq(e.target.value)}
                placeholder="Enter assigned frequency"
                className="p-3 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] placeholder-[#9B727D] focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#A83B4D]/25 font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#670626] text-xs font-bold">Station / Call Sign</label>
              <input
                type="text"
                value={apparatusPlate}
                onChange={(e) => setApparatusPlate(e.target.value)}
                placeholder="Enter station or call sign"
                className="p-3 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] placeholder-[#9B727D] focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#A83B4D]/25 font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#670626] text-xs font-bold">Contact Number</label>
              <input
                type="text"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="Enter contact number"
                className="p-3 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#2B010E] placeholder-[#9B727D] focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#A83B4D]/25 font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="md" isLoading={isSaving} className="font-bold text-sm">
              Save Settings
            </Button>
          </div>
        </form>
      </div>

      {/* Map Pin Visibility Settings Card */}
      <div className="clay-surface p-6 flex flex-col gap-5 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 rounded-2xl shadow-[0_16px_38px_rgba(74,4,26,0.24)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#670626]/15">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-[#670626]" />
              <h2 className="text-base font-black font-mono tracking-wider text-[#670626]">
                Map Pin Visibility
              </h2>
            </div>
            <p className="text-sm font-mono text-[#A83B4D] mt-1">
              Configure non-medic map pin display.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#670626] flex-shrink-0" />
              <span className="text-sm font-mono font-bold text-[#670626] tracking-wide">
                Dim Non-Medic Pins
              </span>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                paleNonMedicEnabled
                  ? 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
                  : 'bg-[#F7F1EA] text-[#7A4E59] border-[#D8C1B5]'
              }`}
            >
              {paleNonMedicEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs font-mono text-[#5C313E]">
            Dim non-medic pins to highlight medical calls.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              onClick={() =>
                syncPointerSettings(
                  true,
                  hideNonMedicWhenSorted,
                  'Non-medic pin dimming enabled'
                )
              }
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                paleNonMedicEnabled
                  ? 'bg-[#F7F1EA] border-[#670626] shadow-sm ring-1 ring-[#A83B4D]/35'
                  : 'bg-[#F7F1EA]/65 border-[#D8C1B5] hover:border-[#A83B4D]'
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
                    'Non-medic pin dimming enabled'
                  )
                }
                label="Dimmed"
                description="Desaturate non-medic pins on the map"
              />
            </div>

            <div
              onClick={() =>
                syncPointerSettings(
                  false,
                  hideNonMedicWhenSorted,
                  'Non-medic pin dimming disabled'
                )
              }
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                !paleNonMedicEnabled
                  ? 'bg-[#F7F1EA] border-[#670626] shadow-sm ring-1 ring-[#A83B4D]/35'
                  : 'bg-[#F7F1EA]/65 border-[#D8C1B5] hover:border-[#A83B4D]'
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
                    'Non-medic pin dimming disabled'
                  )
                }
                label="Standard"
                description="Show all pins in full color"
              />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#670626] flex-shrink-0" />
              <span className="text-sm font-mono font-bold text-[#670626] tracking-wide">
                Non-Medic Visibility
              </span>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                !hideNonMedicWhenSorted
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-700/30'
                  : 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
              }`}
            >
              {!hideNonMedicWhenSorted ? 'Show Dimmed' : 'Hidden'}
            </span>
          </div>
          <p className="text-xs font-mono text-[#5C313E]">
            Show dimmed or hide non-medic pins when filtered.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              onClick={() =>
                syncPointerSettings(
                  paleNonMedicEnabled,
                  false,
                  'Showing dimmed non-medic pins'
                )
              }
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                !hideNonMedicWhenSorted
                  ? 'bg-[#F7F1EA] border-emerald-700 shadow-sm ring-1 ring-emerald-700/25'
                  : 'bg-[#F7F1EA]/65 border-[#D8C1B5] hover:border-[#A83B4D]'
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
                    'Showing dimmed non-medic pins'
                  )
                }
                label="Show Dimmed"
                description="Keep non-medic pins visible in pale styling"
              />
            </div>

            <div
              onClick={() =>
                syncPointerSettings(
                  paleNonMedicEnabled,
                  true,
                  'Hiding non-medic pins'
                )
              }
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                hideNonMedicWhenSorted
                  ? 'bg-[#F7F1EA] border-[#670626] shadow-sm ring-1 ring-[#A83B4D]/35'
                  : 'bg-[#F7F1EA]/65 border-[#D8C1B5] hover:border-[#A83B4D]'
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
                    'Hiding non-medic pins'
                  )
                }
                label="Hide Non-Medic Pins"
                description="Hide non-assigned pins on the map"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponderProfile;
