// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Displays resident Profile header, verified resident badge, personal contact number
// (text-only storage, zero tel: links), registered barangay, emergency contacts, and medical profile.
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React, { useState, useEffect, useCallback } from 'react';
import { Edit2, CheckCircle2, Camera, AlertTriangle } from 'lucide-react';
import { useSession } from '@/Hooks/useSession';
import {
  getOwnProfile,
  updateOwnProfile,
  type OwnProfileDto,
  type UpdateOwnProfilePayload
} from '@/Endpoints/usersApi';
import { CivilianButton } from './Shared/CivilianButton';

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
  reporterContactNumber: string;
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

interface AccountIdentityMeta {
  fullName: string;
  email: string;
  employeeOrResidentId: string;
  status: string;
  faceVerified: boolean;
  departmentOrBarangay: string;
}

export type { UpdateOwnProfilePayload };

export const CivilianProfile: React.FC = () => {
  const { session, refreshSession } = useSession();

  const [profile, setProfile] = useState<EmergencyMedicalProfile>({
    reporterContactNumber: '',
    bloodType: 'O+',
    allergies: '',
    medicalConditions: '',
    isOrganDonor: false,
    emergencyContactName: '',
    emergencyContactRelation: 'Spouse',
    emergencyContactPhone: '',
    secondaryContactName: '',
    secondaryContactPhone: '',
    barangay: ''
  });

  const [accountMeta, setAccountMeta] = useState<AccountIdentityMeta>({
    fullName: '',
    email: '',
    employeeOrResidentId: '',
    status: '',
    faceVerified: false,
    departmentOrBarangay: ''
  });

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const hydrateFromOwnProfile = useCallback((data: OwnProfileDto) => {
    setAccountMeta({
      fullName: data.fullName || '',
      email: data.email || '',
      employeeOrResidentId: data.employeeOrResidentId || '',
      status: data.status || '',
      faceVerified: Boolean(data.faceVerified),
      departmentOrBarangay: data.departmentOrBarangay || data.barangay || ''
    });

    setProfile({
      reporterContactNumber: data.phoneNumber || '',
      bloodType: data.bloodType || 'O+',
      allergies: data.allergies || '',
      medicalConditions: data.medicalConditions || '',
      isOrganDonor: Boolean(data.isOrganDonor),
      emergencyContactName: data.emergencyContactName || '',
      emergencyContactRelation: data.emergencyContactRelationship || 'Spouse',
      emergencyContactPhone: data.emergencyContactPhone || '',
      secondaryContactName: data.secondaryContactName || '',
      secondaryContactPhone: data.secondaryContactPhone || '',
      barangay: data.barangay || data.departmentOrBarangay || ''
    });

    const nextAvatar = data.avatarDataUrl || null;
    setAvatarUrl(nextAvatar);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: nextAvatar } })
      );
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadOwnProfile = async () => {
      setIsLoadingProfile(true);
      setProfileError(null);
      try {
        const data = await getOwnProfile();
        if (!isMounted) return;
        hydrateFromOwnProfile(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Unable to load profile from database.';
        setProfileError(msg);
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadOwnProfile();
    return () => {
      isMounted = false;
    };
  }, [hydrateFromOwnProfile]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setProfileError('Image exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setProfileError(null);
      setIsSubmitting(true);
      try {
        const res = await updateOwnProfile({ avatarDataUrl: dataUrl });
        if (res.user) {
          hydrateFromOwnProfile(res.user);
        } else {
          setAvatarUrl(dataUrl);
          window.dispatchEvent(
            new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: dataUrl } })
          );
        }
        setSaveSuccessToast('Photo saved.');
        setTimeout(() => setSaveSuccessToast(null), TOAST_NOTIFICATION_MS);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save profile photo.';
        setProfileError(msg);
      } finally {
        setIsSubmitting(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleResetAvatar = async () => {
    setProfileError(null);
    setIsSubmitting(true);
    try {
      const res = await updateOwnProfile({ avatarDataUrl: null });
      if (res.user) {
        hydrateFromOwnProfile(res.user);
      } else {
        setAvatarUrl(null);
        window.dispatchEvent(
          new CustomEvent('resqtrack:avatar-updated', { detail: { avatar: null } })
        );
      }
      setSaveSuccessToast('Photo removed.');
      setTimeout(() => setSaveSuccessToast(null), TOAST_NOTIFICATION_MS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove profile photo.';
      setProfileError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setProfileError(null);
    setSaveSuccessToast(null);
    try {
      const res = await updateOwnProfile({
        phoneNumber: profile.reporterContactNumber.trim(),
        bloodType: profile.bloodType,
        allergies: profile.allergies.trim(),
        medicalConditions: profile.medicalConditions.trim(),
        isOrganDonor: profile.isOrganDonor,
        emergencyContactName: profile.emergencyContactName.trim(),
        emergencyContactRelationship: profile.emergencyContactRelation,
        emergencyContactPhone: profile.emergencyContactPhone.trim(),
        secondaryContactName: profile.secondaryContactName.trim(),
        secondaryContactPhone: profile.secondaryContactPhone.trim(),
        departmentOrBarangay: profile.barangay,
        avatarDataUrl: avatarUrl
      });

      if (res.user) {
        hydrateFromOwnProfile(res.user);
      }
      if (refreshSession) {
        void refreshSession();
      }

      setIsEditing(false);
      setSaveSuccessToast('Profile saved.');
      setTimeout(() => setSaveSuccessToast(null), SAVE_PROFILE_TOAST_MS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile changes.';
      setProfileError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F7F1EA]/20 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
            Resident Account
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
            Profile
          </h1>
        </div>

        <CivilianButton
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsEditing((prev) => !prev)}
          icon={<Edit2 className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </CivilianButton>
      </div>

      {/* 2. Success & Error Callouts */}
      {saveSuccessToast && (
        <div className="clay-surface p-4 rounded-xl bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] text-sm font-bold flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-[#670626] flex-shrink-0" />
          <span>{saveSuccessToast}</span>
        </div>
      )}
      {profileError && (
        <div
          role="alert"
          className="clay-surface p-4 rounded-xl bg-[#670626] border border-[#F7F1EA]/25 text-[#F7F1EA] text-sm font-bold flex items-center gap-3 shadow-lg"
        >
          <AlertTriangle className="w-5 h-5 text-[#F7F1EA] flex-shrink-0" />
          <span>{profileError}</span>
        </div>
      )}

      {/* 3. Resident Identity Card */}
      <div className="clay-surface p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 flex flex-col gap-6 shadow-[0_16px_38px_rgba(74,4,26,0.24)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#670626]/15">
          <div className="flex items-center gap-4">
            <div className="relative group w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#670626]/25 bg-[#E9D9D0] flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={accountMeta.fullName || session?.fullName || 'Resident'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#670626] flex items-center justify-center text-3xl font-black text-[#F7F1EA]">
                  {(accountMeta.fullName || session?.fullName)?.charAt(0) || 'C'}
                </div>
              )}

              <label
                className="absolute inset-0 bg-[#4A041A]/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-[#F7F1EA] text-xs font-mono font-bold"
                title="Upload Photo"
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
                <h2 className="text-xl font-black text-[#670626]">
                  {accountMeta.fullName || session?.fullName || (isLoadingProfile ? 'Loading...' : 'Registered Resident')}
                </h2>
                {(accountMeta.faceVerified || session?.faceVerified) ? (
                  <span className="px-3 py-1 rounded-full bg-[#E9D9D0] text-[#670626] border border-[#670626]/30 text-xs font-mono font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#670626]" />
                    <span>Verified</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-[#E9D9D0] text-[#A83B4D] border border-[#A83B4D]/40 text-xs font-mono font-bold">
                    Pending Scan
                  </span>
                )}
              </div>
              <p className="text-sm text-[#A83B4D] mt-0.5 font-mono">
                {accountMeta.email || session?.email || 'Not provided'}
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
                    onClick={handleResetAvatar}
                    className="text-xs font-mono text-[#A83B4D] hover:text-[#670626] underline transition-colors cursor-pointer"
                  >
                    Reset Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-sm font-mono font-bold text-[#670626]">
              Civilian
            </span>
          </div>
        </div>

        {/* Identity, Barangay & Personal Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-mono">
          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Status</span>
            <span className="text-[#670626] font-black text-base mt-1 block">
              {accountMeta.status || session?.status || 'Unavailable'}
            </span>
          </div>

          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Resident ID</span>
            <span className="text-[#670626] font-black text-base mt-1 block">
              {accountMeta.employeeOrResidentId || session?.employeeOrResidentId || 'Not assigned'}
            </span>
          </div>

          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Barangay</span>
            {isEditing ? (
              <select
                value={profile.barangay}
                onChange={(e) => setProfile({ ...profile, barangay: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 bg-[#F7F1EA] border border-[#670626]/25 rounded-lg text-sm text-[#670626] font-mono font-bold focus:outline-none focus:border-[#670626]"
              >
                <option value="">Select Barangay</option>
                {KATIPUNAN_BARANGAYS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[#670626] font-black text-base mt-1 block">
                {profile.barangay || accountMeta.departmentOrBarangay || session?.departmentOrBarangay || 'Not set'}
              </span>
            )}
          </div>

          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">
              Contact Number
            </span>
            {isEditing ? (
              <input
                type="text"
                value={profile.reporterContactNumber}
                onChange={(e) =>
                  setProfile({ ...profile, reporterContactNumber: e.target.value })
                }
                placeholder="e.g. 0917 123 4567"
                className="mt-1.5 w-full px-3 py-2 bg-[#F7F1EA] border border-[#670626]/25 rounded-lg text-sm text-[#670626] font-mono font-bold placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
              />
            ) : (
              <span className="text-[#670626] font-black text-base mt-1 block">
                {profile.reporterContactNumber || 'Not set'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Medical Profile & Emergency Contacts Form */}
      <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
        <div className="clay-surface p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 flex flex-col gap-6 shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
          <div className="flex items-center justify-between border-b border-[#670626]/15 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#670626]" />
              <h2 className="text-base font-black text-[#670626]">Medical Profile</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-mono font-bold text-[#670626]">Blood Type</label>
              {isEditing ? (
                <select
                  value={profile.bloodType}
                  onChange={(e) => setProfile({ ...profile, bloodType: e.target.value })}
                  className="px-3.5 py-2.5 bg-[#E9D9D0] border border-[#670626]/25 rounded-xl text-sm text-[#670626] font-mono font-bold focus:outline-none focus:border-[#670626]"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="text-base font-mono font-black text-[#670626]">
                    {profile.bloodType}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-mono font-bold text-[#670626]">Allergies</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.allergies}
                  onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                  placeholder="e.g. Penicillin, None"
                  className="px-3.5 py-2.5 bg-[#E9D9D0] border border-[#670626]/25 rounded-xl text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="text-sm font-mono text-[#670626]">
                    {profile.allergies || 'None listed'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-mono font-bold text-[#670626]">
                Medical Conditions
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.medicalConditions}
                  onChange={(e) =>
                    setProfile({ ...profile, medicalConditions: e.target.value })
                  }
                  placeholder="e.g. Asthma, None"
                  className="px-3.5 py-2.5 bg-[#E9D9D0] border border-[#670626]/25 rounded-xl text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="text-sm font-mono text-[#670626]">
                    {profile.medicalConditions || 'None listed'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex items-center justify-between gap-3">
            <span className="text-sm font-mono font-bold text-[#670626]">Organ Donor Status</span>
            {isEditing ? (
              <label className="inline-flex items-center gap-2 text-sm font-mono font-bold text-[#670626] cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.isOrganDonor}
                  onChange={(e) => setProfile({ ...profile, isOrganDonor: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#670626] cursor-pointer"
                />
                <span>Registered Organ Donor</span>
              </label>
            ) : (
              <span className="text-sm font-mono font-black text-[#670626]">
                {profile.isOrganDonor ? 'Registered Donor' : 'Not Registered'}
              </span>
            )}
          </div>
        </div>

        {/* 5. Emergency Contacts (Strictly text only, ZERO tel: links) */}
        <div className="clay-surface p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 flex flex-col gap-6 shadow-[0_14px_34px_rgba(74,4,26,0.22)]">
          <div className="flex items-center justify-between border-b border-[#670626]/15 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A83B4D]" />
              <h2 className="text-base font-black text-[#670626]">Emergency Contact</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-3">
              <span className="text-xs font-mono font-bold text-[#A83B4D]">Primary Contact</span>
              {isEditing ? (
                <div className="flex flex-col gap-2.5">
                  <input
                    type="text"
                    value={profile.emergencyContactName}
                    onChange={(e) =>
                      setProfile({ ...profile, emergencyContactName: e.target.value })
                    }
                    placeholder="Full Name"
                    className="px-3.5 py-2.5 bg-[#F7F1EA] border border-[#670626]/20 rounded-lg text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <select
                      value={profile.emergencyContactRelation}
                      onChange={(e) =>
                        setProfile({ ...profile, emergencyContactRelation: e.target.value })
                      }
                      className="px-3.5 py-2.5 bg-[#F7F1EA] border border-[#670626]/20 rounded-lg text-sm text-[#670626] font-bold focus:outline-none focus:border-[#670626]"
                    >
                      {['Spouse', 'Parent', 'Sibling', 'Child', 'Guardian', 'Colleague'].map(
                        (r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        )
                      )}
                    </select>
                    <input
                      type="text"
                      value={profile.emergencyContactPhone}
                      onChange={(e) =>
                        setProfile({ ...profile, emergencyContactPhone: e.target.value })
                      }
                      placeholder="Contact Number"
                      className="px-3.5 py-2.5 bg-[#F7F1EA] border border-[#670626]/20 rounded-lg text-sm text-[#670626] font-mono placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-base font-bold text-[#670626]">
                    {profile.emergencyContactName || 'Not set'}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-mono text-[#A83B4D]">
                    <span>
                      Relation:{' '}
                      <strong className="text-[#670626]">
                        {profile.emergencyContactRelation}
                      </strong>
                    </span>
                    <span>/</span>
                    <span className="text-[#670626] font-bold">
                      {profile.emergencyContactPhone || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-3">
              <span className="text-xs font-mono font-bold text-[#A83B4D]">
                Secondary Contact
              </span>
              {isEditing ? (
                <div className="flex flex-col gap-2.5">
                  <input
                    type="text"
                    value={profile.secondaryContactName}
                    onChange={(e) =>
                      setProfile({ ...profile, secondaryContactName: e.target.value })
                    }
                    placeholder="Full Name (Optional)"
                    className="px-3.5 py-2.5 bg-[#F7F1EA] border border-[#670626]/20 rounded-lg text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                  />
                  <input
                    type="text"
                    value={profile.secondaryContactPhone}
                    onChange={(e) =>
                      setProfile({ ...profile, secondaryContactPhone: e.target.value })
                    }
                    placeholder="Contact Number"
                    className="px-3.5 py-2.5 bg-[#F7F1EA] border border-[#670626]/20 rounded-lg text-sm text-[#670626] font-mono placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-base font-bold text-[#670626]">
                    {profile.secondaryContactName || 'Not set'}
                  </span>
                  <span className="text-sm font-mono text-[#670626] font-bold">
                    {profile.secondaryContactPhone || 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#670626]/15">
              <CivilianButton
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </CivilianButton>
              <CivilianButton
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                className="text-sm"
              >
                Save Profile
              </CivilianButton>
            </div>
          )}
        </div>
      </form>

      {/* 6. Privacy Note */}
      <div className="clay-surface px-4 py-3 bg-[#F7F1EA] rounded-xl border border-[#670626]/15 text-xs font-mono text-[#670626]">
        Stored securely and shared only with authorized responders during an active emergency.
      </div>
    </div>
  );
};

export default CivilianProfile;
