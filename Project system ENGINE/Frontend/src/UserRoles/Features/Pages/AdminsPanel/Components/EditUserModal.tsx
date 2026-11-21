// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// EditUserModal.tsx -- User profile and emergency credentials editor.
// Stitch Warm Ivory (#F7F1EA) + Soft Beige (#E9D9D0) + Cherry (#670626) + Muted Cherry (#A83B4D) claymorphic styling.
// Uses KATIPUNAN_BARANGAYS_LIST (Katipunan, Zamboanga del Norte 7109).
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useEffect, useState } from 'react';
import {
  User,
  MapPin,
  Shield,
  Award,
  AlertTriangle,
  Check,
  Phone,
  Stethoscope,
  Flame,
  ShieldAlert,
  Building2
} from 'lucide-react';
import {
  getUserDetail,
  updateUser,
  UserDetail,
  UserSummary,
  ResponderUnit,
  UpdateUserPayload
} from '@/Endpoints/adminGovernanceApi';
import { AdminButton } from '../Shared/AdminButton';
import { AdminModalCard } from '../Shared/AdminModalCard';
import {
  KATIPUNAN_BARANGAYS_LIST,
  CLAY_WELL,
  CLAY_INPUT,
  CLAY_SELECT
} from '../Shared/adminCommandHelpers';

export interface EditUserModalProps {
  user: UserSummary | UserDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'address' | 'role' | 'credentials'>('info');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    surname: '',
    suffix: '',
    dateOfBirth: '',
    sex: 'Male',
    bloodType: 'O+',
    phoneNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: 'Spouse',
    province: 'Zamboanga del Norte',
    cityOrMunicipality: 'Katipunan',
    barangay: 'Barangay Uno (Poblacion)',
    streetOrPurok: '',
    status: 'Verified' as 'Verified' | 'Suspended' | 'Pending',
    role: 'Civilian' as 'Civilian' | 'Responder' | 'LDRRMO_Admin',
    unit: 'None' as ResponderUnit,
    departmentOrBarangay: '',
    rankOrTitle: '',
    employeeOrResidentId: '',
    governmentIdType: 'PhilSys National ID',
    governmentIdNumber: '',
    residencyCategory: 'Permanent',
    vulnerabilityFlags: 'None',
    medicalLicenseNumber: '',
    medicalCadre: 'Paramedic',
    stationHealthCenter: 'Katipunan Rural Health Unit (RHU)',
    medicalCertifications: 'BLS, ACLS',
    ambulanceCallSign: 'RHU-MED1',
    firefighterRank: 'Fire Officer 1 (FO1)',
    bfpBadgeNumber: '',
    fireStation: 'BFP Katipunan Fire Station',
    fireSpecialization: 'Structural Firefighting',
    apparatusCallSign: 'ENGINE-1',
    policeRank: 'Patrolman',
    pnpBadgeNumber: '',
    precinctOrStation: 'PNP Katipunan Municipal Police Station',
    policeAssignment: 'Patrol',
    sidearmSerial: '',
    plantillaNumber: '',
    executiveDesignation: 'Operations Officer',
    clearanceLevel: 'Level 2 - Tactical Operations'
  });

  const loadFullDetail = async (userId: string) => {
    setIsLoading(true);
    setErrorText(null);
    try {
      const d = await getUserDetail(userId);
      setFormData({
        firstName: d.firstName || '',
        middleName: d.middleName || '',
        surname: d.surname || '',
        suffix: d.suffix || '',
        dateOfBirth: d.dateOfBirth ? d.dateOfBirth.split('T')[0] : '',
        sex: d.sex || 'Male',
        bloodType: d.bloodType || 'O+',
        phoneNumber: d.phoneNumber || '',
        emergencyContactName: d.emergencyContactName || '',
        emergencyContactPhone: d.emergencyContactPhone || '',
        emergencyContactRelationship: d.emergencyContactRelationship || 'Spouse',
        province: d.province || 'Zamboanga del Norte',
        cityOrMunicipality: d.cityOrMunicipality || 'Katipunan',
        barangay: d.barangay || 'Barangay Uno (Poblacion)',
        streetOrPurok: d.streetOrPurok || '',
        status: d.status || 'Verified',
        role: d.role || 'Civilian',
        unit: d.unit || 'None',
        departmentOrBarangay: d.departmentOrBarangay || '',
        rankOrTitle: d.rankOrTitle || '',
        employeeOrResidentId: d.employeeOrResidentId || '',
        governmentIdType: d.governmentIdType || 'PhilSys National ID',
        governmentIdNumber: d.governmentIdNumber || '',
        residencyCategory: d.residencyCategory || 'Permanent',
        vulnerabilityFlags: d.vulnerabilityFlags || 'None',
        medicalLicenseNumber: d.medicalLicenseNumber || '',
        medicalCadre: d.medicalCadre || 'Paramedic',
        stationHealthCenter: d.stationHealthCenter || 'Katipunan Rural Health Unit (RHU)',
        medicalCertifications: d.medicalCertifications || 'BLS, ACLS',
        ambulanceCallSign: d.ambulanceCallSign || 'RHU-MED1',
        firefighterRank: d.firefighterRank || 'Fire Officer 1 (FO1)',
        bfpBadgeNumber: d.bfpBadgeNumber || '',
        fireStation: d.fireStation || 'BFP Katipunan Fire Station',
        fireSpecialization: d.fireSpecialization || 'Structural Firefighting',
        apparatusCallSign: d.apparatusCallSign || 'ENGINE-1',
        policeRank: d.policeRank || 'Patrolman',
        pnpBadgeNumber: d.pnpBadgeNumber || '',
        precinctOrStation: d.precinctOrStation || 'PNP Katipunan Municipal Police Station',
        policeAssignment: d.policeAssignment || 'Patrol',
        sidearmSerial: d.sidearmSerial || '',
        plantillaNumber: d.plantillaNumber || '',
        executiveDesignation: d.executiveDesignation || 'Operations Officer',
        clearanceLevel: d.clearanceLevel || 'Level 2 - Tactical Operations'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to populate existing profile details.';
      setErrorText(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      void loadFullDetail(user.id);
    } else {
      setErrorText(null);
    }
  }, [isOpen, user]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'role') {
        if (value === 'Responder' && next.unit === 'None') {
          next.unit = 'RHU';
        } else if (value !== 'Responder') {
          next.unit = 'None';
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (user.isCliProtectedSuperAdmin) {
      setErrorText('CLI-created Superadmin accounts cannot be edited from the Frontend/UI. Use Docker CLI (useredit).');
      return;
    }
    setErrorText(null);

    if (!formData.firstName.trim() || !formData.surname.trim()) {
      setErrorText('First Name and Surname are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: UpdateUserPayload = {
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim() || null,
        surname: formData.surname.trim(),
        suffix: formData.suffix.trim() || null,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString() : null,
        sex: formData.sex,
        bloodType: formData.bloodType,
        phoneNumber: formData.phoneNumber.trim() || null,
        province: formData.province.trim(),
        cityOrMunicipality: formData.cityOrMunicipality.trim(),
        barangay: formData.barangay.trim(),
        streetOrPurok: formData.streetOrPurok.trim() || null,
        emergencyContactName: formData.emergencyContactName.trim() || null,
        emergencyContactPhone: formData.emergencyContactPhone.trim() || null,
        emergencyContactRelationship: formData.emergencyContactRelationship || null,
        role: formData.role,
        unit: formData.role === 'Responder' ? formData.unit : 'None',
        status: formData.status,
        departmentOrBarangay: formData.departmentOrBarangay.trim() || formData.barangay,
        rankOrTitle: formData.rankOrTitle.trim() || null,
        employeeOrResidentId: formData.employeeOrResidentId.trim() || null
      };

      if (formData.role === 'Civilian') {
        payload.governmentIdType = formData.governmentIdType;
        payload.governmentIdNumber = formData.governmentIdNumber.trim() || null;
        payload.residencyCategory = formData.residencyCategory;
        payload.vulnerabilityFlags = formData.vulnerabilityFlags;
      } else if (formData.role === 'Responder') {
        if (formData.unit === 'RHU') {
          payload.medicalLicenseNumber = formData.medicalLicenseNumber.trim() || null;
          payload.medicalCadre = formData.medicalCadre;
          payload.stationHealthCenter = formData.stationHealthCenter.trim() || null;
          payload.medicalCertifications = formData.medicalCertifications.trim() || null;
          payload.ambulanceCallSign = formData.ambulanceCallSign.trim() || null;
        } else if (formData.unit === 'FIRE') {
          payload.firefighterRank = formData.firefighterRank;
          payload.bfpBadgeNumber = formData.bfpBadgeNumber.trim() || null;
          payload.fireStation = formData.fireStation.trim() || null;
          payload.fireSpecialization = formData.fireSpecialization.trim() || null;
          payload.apparatusCallSign = formData.apparatusCallSign.trim() || null;
        } else if (formData.unit === 'PNP') {
          payload.policeRank = formData.policeRank;
          payload.pnpBadgeNumber = formData.pnpBadgeNumber.trim() || null;
          payload.precinctOrStation = formData.precinctOrStation.trim() || null;
          payload.policeAssignment = formData.policeAssignment.trim() || null;
          payload.sidearmSerial = formData.sidearmSerial.trim() || null;
        }
      } else if (formData.role === 'LDRRMO_Admin') {
        payload.plantillaNumber = formData.plantillaNumber.trim() || null;
        payload.executiveDesignation = formData.executiveDesignation.trim() || null;
        payload.clearanceLevel = formData.clearanceLevel;
      }

      await updateUser(user.id, payload);
      showToast(`User profile for ${payload.firstName} ${payload.surname} updated successfully.`, 'success');
      onUserUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user profile.';
      setErrorText(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { key: 'info', label: 'Profile', icon: User },
    { key: 'address', label: 'Address', icon: MapPin },
    { key: 'role', label: 'Role', icon: Shield },
    { key: 'credentials', label: 'Credentials', icon: Award }
  ] as const;

  const labelClass = 'block text-xs font-mono uppercase tracking-wider text-[#670626] mb-1.5 font-bold';

  return (
    <AdminModalCard
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit User: ${user?.fullName || ''}`}
      subtitle="Update profile, role, and Katipunan credentials"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm text-[#670626]">
        {isLoading && (
          <div className="p-10 text-center text-[#A83B4D] space-y-2">
            <div className="w-7 h-7 border-2 border-[#670626] border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="font-mono text-sm">Loading user details…</div>
          </div>
        )}

        {errorText && (
          <div className="p-3.5 rounded-xl bg-[#670626] text-[#F7F1EA] text-sm font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        {!isLoading && (
          <>
            {user && (
              <div className={`${CLAY_WELL} p-3.5 flex flex-wrap items-center justify-between gap-3`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F7F1EA] border border-[#670626]/20 flex items-center justify-center text-[#670626] font-mono font-bold text-sm">
                    {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-[#670626] text-sm">{user.fullName}</div>
                    <div className="text-xs text-[#A83B4D] font-mono">{user.email}</div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded bg-[#670626] text-[#F7F1EA]">
                  {user.role} {user.unit !== 'None' ? `(${user.unit})` : ''}
                </span>
              </div>
            )}

            <div className={`${CLAY_WELL} flex items-center gap-1.5 overflow-x-auto p-1.5`}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isActive ? 'bg-[#670626] text-[#F7F1EA]' : 'text-[#670626] hover:bg-[#F7F1EA]/70'
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input type="text" required value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div>
                  <label className={labelClass}>Middle Name</label>
                  <input type="text" value={formData.middleName} onChange={(e) => handleChange('middleName', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div>
                  <label className={labelClass}>Surname *</label>
                  <input type="text" required value={formData.surname} onChange={(e) => handleChange('surname', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div>
                  <label className={labelClass}>Suffix</label>
                  <input type="text" value={formData.suffix} onChange={(e) => handleChange('suffix', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input type="date" value={formData.dateOfBirth} onChange={(e) => handleChange('dateOfBirth', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelClass}>Sex</label>
                    <select value={formData.sex} onChange={(e) => handleChange('sex', e.target.value)} className={CLAY_SELECT}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Blood Type</label>
                    <select value={formData.bloodType} onChange={(e) => handleChange('bloodType', e.target.value)} className={CLAY_SELECT}>
                      {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input type="text" value={formData.phoneNumber} onChange={(e) => handleChange('phoneNumber', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div>
                  <label className={labelClass}>Resident / Employee ID</label>
                  <input type="text" value={formData.employeeOrResidentId} onChange={(e) => handleChange('employeeOrResidentId', e.target.value)} className={CLAY_INPUT} />
                </div>
              </div>
            )}

            {activeTab === 'address' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Province *</label>
                  <input type="text" required value={formData.province} onChange={(e) => handleChange('province', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div>
                  <label className={labelClass}>Municipality *</label>
                  <input type="text" required value={formData.cityOrMunicipality} onChange={(e) => handleChange('cityOrMunicipality', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div>
                  <label className={labelClass}>Barangay Sector (Katipunan 7109) *</label>
                  <select value={formData.barangay} onChange={(e) => handleChange('barangay', e.target.value)} className={CLAY_SELECT}>
                    {KATIPUNAN_BARANGAYS_LIST.map((brgy) => (
                      <option key={brgy} value={brgy}>{brgy}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Street / Purok</label>
                  <input type="text" value={formData.streetOrPurok} onChange={(e) => handleChange('streetOrPurok', e.target.value)} className={CLAY_INPUT} />
                </div>

                <div className={`${CLAY_WELL} md:col-span-2 p-4`}>
                  <h4 className="text-xs font-mono font-bold text-[#670626] mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#A83B4D]" />
                    Emergency Contact (Next of Kin)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Contact Person</label>
                      <input type="text" value={formData.emergencyContactName} onChange={(e) => handleChange('emergencyContactName', e.target.value)} className={CLAY_INPUT} />
                    </div>
                    <div>
                      <label className={labelClass}>Contact Phone</label>
                      <input type="text" value={formData.emergencyContactPhone} onChange={(e) => handleChange('emergencyContactPhone', e.target.value)} className={CLAY_INPUT} />
                    </div>
                    <div>
                      <label className={labelClass}>Relationship</label>
                      <select value={formData.emergencyContactRelationship} onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)} className={CLAY_SELECT}>
                        {['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Colleague', 'Friend', 'Guardian'].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'role' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Account Status *</label>
                  <select value={formData.status} onChange={(e) => handleChange('status', e.target.value)} className={CLAY_SELECT}>
                    <option value="Verified">Verified (Active)</option>
                    <option value="Pending">Pending Approval</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>System Access Role *</label>
                  <select value={formData.role} onChange={(e) => handleChange('role', e.target.value)} className={CLAY_SELECT}>
                    <option value="Civilian">Civilian</option>
                    <option value="Responder">Responder</option>
                    <option value="LDRRMO_Admin">LDRRMO Admin</option>
                  </select>
                </div>
                {formData.role === 'Responder' && (
                  <div>
                    <label className={labelClass}>Tactical Unit Agency</label>
                    <select value={formData.unit} onChange={(e) => handleChange('unit', e.target.value)} className={CLAY_SELECT}>
                      <option value="RHU">RHU (Rural Health Unit / Medical)</option>
                      <option value="FIRE">FIRE (Bureau of Fire Protection)</option>
                      <option value="PNP">PNP (Philippine National Police)</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Station / Barangay</label>
                  <input type="text" value={formData.departmentOrBarangay} onChange={(e) => handleChange('departmentOrBarangay', e.target.value)} className={CLAY_INPUT} />
                </div>
                <div>
                  <label className={labelClass}>Rank / Operational Title</label>
                  <input type="text" value={formData.rankOrTitle} onChange={(e) => handleChange('rankOrTitle', e.target.value)} className={CLAY_INPUT} />
                </div>
              </div>
            )}

            {activeTab === 'credentials' && (
              <div className="space-y-4">
                {formData.role === 'Civilian' && (
                  <div className={`${CLAY_WELL} p-4 space-y-3`}>
                    <div className="font-mono font-bold text-xs uppercase tracking-wider">Civilian Resident Credentials</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className={labelClass}>Government ID Type</label>
                        <select value={formData.governmentIdType} onChange={(e) => handleChange('governmentIdType', e.target.value)} className={CLAY_SELECT}>
                          <option value="PhilSys National ID">PhilSys National ID</option>
                          <option value="UMID">UMID</option>
                          <option value="Driver's License">Driver's License</option>
                          <option value="Voter's ID">Voter's ID</option>
                          <option value="Barangay ID">Barangay Resident ID</option>
                          <option value="Passport">Philippine Passport</option>
                          <option value="Senior Citizen ID">Senior Citizen ID</option>
                          <option value="PWD ID">PWD ID</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>ID Card Number</label>
                        <input type="text" value={formData.governmentIdNumber} onChange={(e) => handleChange('governmentIdNumber', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div>
                        <label className={labelClass}>Residency Category</label>
                        <select value={formData.residencyCategory} onChange={(e) => handleChange('residencyCategory', e.target.value)} className={CLAY_SELECT}>
                          <option value="Permanent">Permanent Resident</option>
                          <option value="Transient">Transient / Temporary</option>
                          <option value="Student">Student / Boarder</option>
                          <option value="Displaced / Evacuee">Displaced / Evacuee</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Vulnerability Flags</label>
                        <select value={formData.vulnerabilityFlags} onChange={(e) => handleChange('vulnerabilityFlags', e.target.value)} className={CLAY_SELECT}>
                          <option value="None">None</option>
                          <option value="Senior Citizen">Senior Citizen (60+)</option>
                          <option value="PWD">Persons with Disability (PWD)</option>
                          <option value="Pregnant">Pregnant Resident</option>
                          <option value="Solo Parent">Solo Parent</option>
                          <option value="Medical Risk">Critical Medical Risk</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'RHU' && (
                  <div className={`${CLAY_WELL} p-4 space-y-3`}>
                    <div className="font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-emerald-700" />
                      RHU Medical Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className={labelClass}>PRC License Number</label>
                        <input type="text" value={formData.medicalLicenseNumber} onChange={(e) => handleChange('medicalLicenseNumber', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div>
                        <label className={labelClass}>Medical Cadre</label>
                        <select value={formData.medicalCadre} onChange={(e) => handleChange('medicalCadre', e.target.value)} className={CLAY_SELECT}>
                          <option value="Physician">Physician</option>
                          <option value="Registered Nurse">Registered Nurse</option>
                          <option value="Paramedic">Paramedic</option>
                          <option value="First Responder">First Responder</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Health Station</label>
                        <input type="text" value={formData.stationHealthCenter} onChange={(e) => handleChange('stationHealthCenter', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div>
                        <label className={labelClass}>Ambulance Call Sign</label>
                        <input type="text" value={formData.ambulanceCallSign} onChange={(e) => handleChange('ambulanceCallSign', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Medical Certifications</label>
                        <input type="text" value={formData.medicalCertifications} onChange={(e) => handleChange('medicalCertifications', e.target.value)} className={CLAY_INPUT} />
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'FIRE' && (
                  <div className={`${CLAY_WELL} p-4 space-y-3`}>
                    <div className="font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-orange-700" />
                      BFP Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className={labelClass}>BFP Rank</label>
                        <select value={formData.firefighterRank} onChange={(e) => handleChange('firefighterRank', e.target.value)} className={CLAY_SELECT}>
                          <option value="Fire Officer 1 (FO1)">FO1</option>
                          <option value="Fire Officer 2 (FO2)">FO2</option>
                          <option value="Fire Officer 3 (FO3)">FO3</option>
                          <option value="Senior Fire Officer 1 (SFO1)">SFO1</option>
                          <option value="Senior Fire Inspector (SINSP)">SINSP</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>BFP Badge Number</label>
                        <input type="text" value={formData.bfpBadgeNumber} onChange={(e) => handleChange('bfpBadgeNumber', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div>
                        <label className={labelClass}>Fire Station</label>
                        <input type="text" value={formData.fireStation} onChange={(e) => handleChange('fireStation', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div>
                        <label className={labelClass}>Apparatus Call Sign</label>
                        <input type="text" value={formData.apparatusCallSign} onChange={(e) => handleChange('apparatusCallSign', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Fire Specialization</label>
                        <input type="text" value={formData.fireSpecialization} onChange={(e) => handleChange('fireSpecialization', e.target.value)} className={CLAY_INPUT} />
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'PNP' && (
                  <div className={`${CLAY_WELL} p-4 space-y-3`}>
                    <div className="font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-sky-700" />
                      PNP Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className={labelClass}>PNP Police Rank</label>
                        <select value={formData.policeRank} onChange={(e) => handleChange('policeRank', e.target.value)} className={CLAY_SELECT}>
                          <option value="Patrolman">Patrolman / Patrolwoman</option>
                          <option value="Police Corporal (PCpl)">PCpl</option>
                          <option value="Police Staff Sergeant (PSSg)">PSSg</option>
                          <option value="Police Lieutenant (PLT)">PLT</option>
                          <option value="Police Major (PMAJ)">PMAJ</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>PNP Badge Number</label>
                        <input type="text" value={formData.pnpBadgeNumber} onChange={(e) => handleChange('pnpBadgeNumber', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div>
                        <label className={labelClass}>Police Station</label>
                        <input type="text" value={formData.precinctOrStation} onChange={(e) => handleChange('precinctOrStation', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div>
                        <label className={labelClass}>Assignment / Sector</label>
                        <input type="text" value={formData.policeAssignment} onChange={(e) => handleChange('policeAssignment', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Sidearm Serial</label>
                        <input type="text" value={formData.sidearmSerial} onChange={(e) => handleChange('sidearmSerial', e.target.value)} className={CLAY_INPUT} />
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'LDRRMO_Admin' && (
                  <div className={`${CLAY_WELL} p-4 space-y-3`}>
                    <div className="font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#670626]" />
                      LDRRMO Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className={labelClass}>LGU Plantilla Number</label>
                        <input type="text" value={formData.plantillaNumber} onChange={(e) => handleChange('plantillaNumber', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div>
                        <label className={labelClass}>Executive Designation</label>
                        <input type="text" value={formData.executiveDesignation} onChange={(e) => handleChange('executiveDesignation', e.target.value)} className={CLAY_INPUT} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Clearance Level</label>
                        <select value={formData.clearanceLevel} onChange={(e) => handleChange('clearanceLevel', e.target.value)} className={CLAY_SELECT}>
                          <option value="Level 1 - Tactical Support">Level 1 - Tactical Support</option>
                          <option value="Level 2 - Tactical Operations">Level 2 - Tactical Operations</option>
                          <option value="Level 3 - Executive Command">Level 3 - Executive Command</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#670626]/15 mt-2">
          <AdminButton type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </AdminButton>
          <AdminButton
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting || isLoading}
            icon={<Check className="w-4 h-4" />}
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </AdminButton>
        </div>
      </form>
    </AdminModalCard>
  );
};
