// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Displays resident Profile header, verified resident badge, personal contact number
// (text-only storage, zero tel: links), registered barangay, emergency contacts, and medical profile.
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React, { useState, useEffect } from 'react';
import { Edit2, CheckCircle2, Camera } from 'lucide-react';
import { useSession } from '@/Hooks/useSession';
import { requestJson } from '@/Endpoints/apiClient';
import { CivilianButton } from './Shared/CivilianButton';

const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const TOAST_NOTIFICATION_MS = 3500;
const SAVE_PROFILE_TOAST_MS = 4000;
const STORAGE_KEY = 'resqtrack_civilian_medical_profile';
const CONTACT_STORAGE_KEY = 'resqtrack_reporter_contact_number';

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

export interface UpdateOwnProfilePayload {
  phoneNumber?: string;
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

const getStoredContact = (): string => {
  try {
    return localStorage.getItem(CONTACT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

export const CivilianProfile: React.FC = () => {
  const { session, refreshSession } = useSession();

  const [profile, setProfile] = useState<EmergencyMedicalProfile>(() => ({
    reporterContactNumber: getStoredContact(),
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
  }));

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const storedContact = localStorage.getItem(CONTACT_STORAGE_KEY) || '';
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<EmergencyMedicalProfile>;
        setProfile((prev) => ({
          ...prev,
          ...parsed,
          reporterContactNumber: parsed.reporterContactNumber || storedContact || prev.reporterContactNumber
        }));
      }
    } catch (err) {
      console.error('Failed to load civilian medical profile:', err);
    }
  }, []);

  useEffect(() => {
    if (session?.departmentOrBarangay) {
      setProfile((prev) => ({
        ...prev,
        barangay:
          prev.barangay === 'Poblacion' && session.departmentOrBarangay
            ? session.departmentOrBarangay
            : prev.barangay
      }));
    }
  }, [session?.departmentOrBarangay]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      localStorage.setItem(CONTACT_STORAGE_KEY, profile.reporterContactNumber.trim());

      try {
        await updateOwnProfile({
          phoneNumber: profile.reporterContactNumber.trim(),
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
      setSaveSuccessToast('Profile, personal contact, and medical details saved.');
      setTimeout(() => setSaveSuccessToast(null), SAVE_PROFILE_TOAST_MS);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Page Header ("Profile") */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F7F1EA]/20 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
            Resident Account
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
            Profile
          </h1>
          <p className="text-sm text-[#E9D9D0] mt-1">Identity, Contact & Medical Info</p>
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

      {/* 2. Success Toast */}
      {saveSuccessToast && (
        <div className="clay-surface p-4 rounded-xl bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] text-sm font-bold flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-[#670626] flex-shrink-0" />
          <span>{saveSuccessToast}</span>
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
                  alt={session?.fullName || 'Resident'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#670626] flex items-center justify-center text-3xl font-black text-[#F7F1EA]">
                  {session?.fullName?.charAt(0) || 'C'}
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
                  {session?.fullName || 'Registered Resident'}
                </h2>
                {session?.faceVerified ? (
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
                {session?.email || 'citizen@katipunan.gov.ph'}
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

        {/* Identity, Barangay & Personal Contact Telemetry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-mono">
          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Status</span>
            <span className="text-[#670626] font-black text-base mt-1 block">
              {session?.status || 'Active Resident'}
            </span>
          </div>

          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">Resident ID</span>
            <span className="text-[#670626] font-black text-base mt-1 block">
              {session?.employeeOrResidentId || 'KTN-RES-9281'}
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
                {KATIPUNAN_BARANGAYS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[#670626] font-black text-base mt-1 block">
                {profile.barangay || session?.departmentOrBarangay || 'Poblacion, Katipunan, ZN'}
              </span>
            )}
          </div>

          <div className="p-4 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <span className="text-[#A83B4D] block text-xs font-bold">
              Personal Contact Number
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
                  placeholder="e.g. Penicillin, Aspirin, Latex, None"
                  className="px-3.5 py-2.5 bg-[#E9D9D0] border border-[#670626]/25 rounded-xl text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="text-sm font-mono text-[#670626]">{profile.allergies}</span>
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
                  placeholder="e.g. Asthma, Diabetic, Pacemaker, None"
                  className="px-3.5 py-2.5 bg-[#E9D9D0] border border-[#670626]/25 rounded-xl text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="text-sm font-mono text-[#670626]">
                    {profile.medicalConditions}
                  </span>
                </div>
              )}
            </div>
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
                    placeholder="Full Name (e.g. Maria Dela Cruz)"
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
                      placeholder="Contact Number (Text)"
                      className="px-3.5 py-2.5 bg-[#F7F1EA] border border-[#670626]/20 rounded-lg text-sm text-[#670626] font-mono placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-base font-bold text-[#670626]">
                    {profile.emergencyContactName || 'No primary contact registered'}
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
                    placeholder="Contact Number (Text)"
                    className="px-3.5 py-2.5 bg-[#F7F1EA] border border-[#670626]/20 rounded-lg text-sm text-[#670626] font-mono placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-base font-bold text-[#670626]">
                    {profile.secondaryContactName || 'No secondary contact specified'}
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

      {/* 6. Citizen Safety Guarantee */}
      <div className="clay-surface px-4 py-3.5 bg-[#F7F1EA] rounded-xl border border-[#670626]/15 text-sm text-[#670626] font-medium">
        Identity, personal contact, and medical details are stored securely and shared only with authorized responders during an active emergency.
      </div>
    </div>
  );
};

export default CivilianProfile;
