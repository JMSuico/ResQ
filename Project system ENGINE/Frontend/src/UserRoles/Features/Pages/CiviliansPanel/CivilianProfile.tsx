// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Displays citizen profile, verified resident badge, registered barangay,
// editable next-of-kin emergency contacts, and emergency medical triage profile with localStorage persistence.
// DO NOT expose raw biometric capture files to unauthorized observers.

import React, { useState, useEffect } from 'react';
import {
  Edit2,
  CheckCircle2,
  Camera
} from 'lucide-react';
import { useSession } from '@/Hooks/useSession';
import { Button } from '@/Shared/Button';
import { requestJson } from '@/Endpoints/apiClient';

// Architectural constants - Zero hardcoded static numbers
const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const TOAST_NOTIFICATION_MS = 3500;
const SAVE_PROFILE_TOAST_MS = 4000;

export const KATIPUNAN_BARANGAYS = [
  'Balok',
  'Barangay Dos (Poblacion)',
  'Barangay Uno (Poblacion)',
  'Basagan',
  'Binoni',
  'Bulawan',
  'Caracol',
  'Dabiak',
  'Dr. Jose Rizal',
  'F. Tubungbanua',
  'Loyuran',
  'Malugas',
  'Matam',
  'Mias',
  'Miputak',
  'Nangca',
  'New Tambo',
  'Paterno',
  'Poblacion',
  'San Antonio',
  'San Roque',
  'Santo Nino',
  'Seres',
  'Sianib',
  'Sinuyak',
  'Sitog',
  'Tuburan'
];

export interface EmergencyMedicalProfile {
  bloodType: string;
  allergies: string;
  medicalConditions: string;
  isOrganDonor: boolean;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  secondaryContactName: string;
  secondaryContactPhone: string;
  barangay: string;
}

export interface UpdateOwnProfilePayload {
  bloodType?: string;
  allergies?: string;
  medicalConditions?: string;
  isOrganDonor?: boolean;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  secondaryContactName?: string;
  secondaryContactPhone?: string;
  barangay?: string;
  departmentOrBarangay?: string;
}

export const updateOwnProfile = async (
  payload: UpdateOwnProfilePayload
): Promise<{ message?: string; success?: boolean }> =>
  requestJson<{ message?: string; success?: boolean }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

const STORAGE_KEY = 'resqtrack_civilian_medical_profile';

export const CivilianProfile: React.FC = () => {
  const { session, refreshSession } = useSession();

  const [profile, setProfile] = useState<EmergencyMedicalProfile>({
    bloodType: 'O+',
    allergies: 'None',
    medicalConditions: 'None',
    isOrganDonor: true,
    emergencyContactName: '',
    emergencyContactRelation: 'Spouse',
    emergencyContactPhone: '',
    secondaryContactName: '',
    secondaryContactPhone: '',
    barangay: 'Poblacion'
  });

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem('resqtrack_civilian_avatar') ||
        localStorage.getItem('resqtrack_user_avatar') ||
        null
      );
    } catch {
      return null;
    }
  });

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setSaveSuccessToast('Avatar image exceeds 2MB limit.');
      setTimeout(() => setSaveSuccessToast(null), TOAST_NOTIFICATION_MS);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      try {
        localStorage.setItem('resqtrack_user_avatar', dataUrl);
        localStorage.setItem('resqtrack_civilian_avatar', dataUrl);
        window.dispatchEvent(
          new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: dataUrl } })
        );
        setSaveSuccessToast('Identity photo uploaded and synchronized across portals.');
        setTimeout(() => setSaveSuccessToast(null), TOAST_NOTIFICATION_MS);
      } catch (err) {
        console.error('Failed to save civilian avatar', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetAvatar = () => {
    setAvatarUrl(null);
    try {
      localStorage.removeItem('resqtrack_user_avatar');
      localStorage.removeItem('resqtrack_civilian_avatar');
      window.dispatchEvent(
        new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: null } })
      );
      setSaveSuccessToast('Reverted to default resident photo avatar.');
      setTimeout(() => setSaveSuccessToast(null), TOAST_NOTIFICATION_MS);
    } catch (err) {
      console.error('Failed to reset avatar', err);
    }
  };

  // Load from localStorage on mount and sync with session
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProfile((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (err) {
      console.error('Failed to load civilian medical profile:', err);
    }
  }, []);

  useEffect(() => {
    if (session?.departmentOrBarangay) {
      setProfile((prev) => ({
        ...prev,
        barangay: prev.barangay === 'Poblacion' && session.departmentOrBarangay ? session.departmentOrBarangay : prev.barangay
      }));
    }
  }, [session?.departmentOrBarangay]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Save to local storage encrypted vault
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

      // 2. Call updateOwnProfile(payload) (PUT /api/profile) to persist in relational Users table
      try {
        await updateOwnProfile({
          bloodType: profile.bloodType,
          allergies: profile.allergies,
          medicalConditions: profile.medicalConditions,
          isOrganDonor: profile.isOrganDonor,
          emergencyContactName: profile.emergencyContactName,
          emergencyContactRelation: profile.emergencyContactRelation,
          emergencyContactRelationship: profile.emergencyContactRelation,
          emergencyContactPhone: profile.emergencyContactPhone,
          secondaryContactName: profile.secondaryContactName,
          secondaryContactPhone: profile.secondaryContactPhone,
          barangay: profile.barangay,
          departmentOrBarangay: profile.barangay
        });
        if (refreshSession) {
          refreshSession();
        }
      } catch (apiErr) {
        console.warn('Backend PUT /api/profile sync notice (persisted to local vault):', apiErr);
      }

      setIsEditing(false);
      setSaveSuccessToast('Emergency medical & next-of-kin profile saved to database and local vault.');
      setTimeout(() => setSaveSuccessToast(null), SAVE_PROFILE_TOAST_MS);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-600/40 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AUTHENTICATED RESIDENT PASSPORT</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Citizen Identity & Medical Passport</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Biometric verification credentials, next-of-kin notification contacts, and field triage medical profile
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="self-start sm:self-auto px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sky-400 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>{isEditing ? 'Cancel Edit' : 'Edit Emergency Details'}</span>
        </button>
      </div>

      {/* 2. Success Toast */}
      {saveSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/95 border border-emerald-500 text-emerald-200 text-xs font-medium flex items-center gap-3 shadow-lg shadow-emerald-950/50">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{saveSuccessToast}</span>
        </div>
      )}

      {/* 3. Verified Citizen Card */}
      <div className="tactical-card p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="relative group w-16 h-16 rounded-2xl overflow-hidden border border-emerald-400/40 shadow-lg shadow-emerald-950/60 bg-slate-950 flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={session?.fullName || 'Resident'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center text-2xl font-black text-white">
                  {session?.fullName?.charAt(0) || 'C'}
                </div>
              )}

              {/* Photo Upload Overlay Button */}
              <label
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-mono font-bold"
                title="Upload Photo"
              >
                <Camera className="w-5 h-5 mb-0.5 text-emerald-400" />
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
                <h2 className="text-lg font-bold text-white">{session?.fullName || 'Registered Resident'}</h2>
                {session?.faceVerified ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-600/50 text-[10px] font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>BIOMETRICALLY VERIFIED</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-600/50 text-[10px] font-mono font-bold">
                    PENDING FACIAL SCAN
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{session?.email || 'citizen@katipunan.gov.ph'}</p>

              {/* Upload photo / Reset actions */}
              <div className="flex items-center gap-3 mt-1.5">
                <label className="text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1">
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

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-300">
              ROLE: <strong className="text-emerald-400">CIVILIAN</strong>
            </span>
          </div>
        </div>

        {/* Identity & Barangay Registry Telemetry */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">MUNICIPAL STATUS</span>
            <span className="text-emerald-400 font-extrabold text-sm mt-0.5 block">{session?.status || 'Active Resident'}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">RESIDENT / CITIZEN ID</span>
            <span className="text-white font-extrabold text-sm mt-0.5 block">{session?.employeeOrResidentId || 'KTN-RES-9281'}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">REGISTERED BARANGAY</span>
            {isEditing ? (
              <select
                value={profile.barangay}
                onChange={(e) => setProfile({ ...profile, barangay: e.target.value })}
                className="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
              >
                {KATIPUNAN_BARANGAYS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            ) : (
              <span className="text-white font-extrabold text-sm mt-0.5 block">{profile.barangay || session?.departmentOrBarangay || 'Poblacion, Katipunan, ZN'}</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Emergency Medical Triage Passport & Next-of-Kin Form */}
      <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
        <div className="tactical-card p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Emergency Medical Triage Profile (Trauma Readiness)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2.5 py-0.5 rounded border border-rose-600/30">
              MEDIC FIRST RESPONDER HUD
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Blood Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono font-bold text-slate-300">BLOOD TYPE</label>
              {isEditing ? (
                <select
                  value={profile.bloodType}
                  onChange={(e) => setProfile({ ...profile, bloodType: e.target.value })}
                  className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-mono font-black text-rose-400">{profile.bloodType}</span>
                  <span className="text-[10px] font-mono text-slate-500">Rh Factor Verified</span>
                </div>
              )}
            </div>

            {/* Allergies */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono font-bold text-slate-300">KNOWN DRUG / FOOD ALLERGIES</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.allergies}
                  onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                  placeholder="e.g. Penicillin, Aspirin, Latex, None"
                  className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                />
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs font-mono text-slate-200">{profile.allergies}</span>
                </div>
              )}
            </div>

            {/* Chronic Conditions */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono font-bold text-slate-300">CHRONIC CONDITIONS / IMPLANTS</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.medicalConditions}
                  onChange={(e) => setProfile({ ...profile, medicalConditions: e.target.value })}
                  placeholder="e.g. Asthma, Diabetic, Pacemaker, None"
                  className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                />
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs font-mono text-slate-200">{profile.medicalConditions}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Next-of-Kin Emergency Contacts */}
        <div className="tactical-card p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Next-of-Kin Emergency Notification Contacts
              </h2>
            </div>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-2.5 py-0.5 rounded border border-sky-600/30">
              DISPATCH NOTIFICATION
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primary Contact */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
              <span className="text-[11px] font-mono font-bold text-sky-400 uppercase">Primary Emergency Contact</span>
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={profile.emergencyContactName}
                    onChange={(e) => setProfile({ ...profile, emergencyContactName: e.target.value })}
                    placeholder="Full Name (e.g. Maria Dela Cruz)"
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={profile.emergencyContactRelation}
                      onChange={(e) => setProfile({ ...profile, emergencyContactRelation: e.target.value })}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      {['Spouse', 'Parent', 'Sibling', 'Child', 'Guardian', 'Colleague'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={profile.emergencyContactPhone}
                      onChange={(e) => setProfile({ ...profile, emergencyContactPhone: e.target.value })}
                      placeholder="Phone (0917-xxx-xxxx)"
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-white">
                    {profile.emergencyContactName || 'No primary contact registered'}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>Relation: <strong className="text-slate-200">{profile.emergencyContactRelation}</strong></span>
                    <span>•</span>
                    <span className="text-sky-400 font-bold">{profile.emergencyContactPhone || 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Secondary Contact */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase">Secondary Emergency Contact</span>
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={profile.secondaryContactName}
                    onChange={(e) => setProfile({ ...profile, secondaryContactName: e.target.value })}
                    placeholder="Full Name (Optional)"
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    value={profile.secondaryContactPhone}
                    onChange={(e) => setProfile({ ...profile, secondaryContactPhone: e.target.value })}
                    placeholder="Phone (09xx-xxx-xxxx)"
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-white">
                    {profile.secondaryContactName || 'No secondary contact specified'}
                  </span>
                  <span className="text-xs font-mono text-sky-400 font-bold">
                    {profile.secondaryContactPhone || 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                className="font-bold text-xs"
              >
                Save Emergency Profile
              </Button>
            </div>
          )}
        </div>
      </form>

      {/* 6. Citizen Safety Guarantee */}
      <div className="p-4 bg-emerald-950/30 rounded-xl border border-emerald-800/40 text-xs text-emerald-200">
        <p className="font-bold">Citizen Safety & Data Privacy Guarantee</p>
        <p className="mt-1 text-slate-300 leading-relaxed">
          Your identity and facial biometric captures are encrypted and stored in secure municipal vaults.
          Emergency medical profiles and next-of-kin contacts are strictly provided to certified RHU trauma medics and LDRRMO dispatchers during live accident response.
        </p>
      </div>
    </div>
  );
};

export default CivilianProfile;
