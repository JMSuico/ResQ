// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// AddUserModal.tsx -- Emergency Command Personnel & Resident Registration Modal for ResQTrack.
// Stitch Warm Ivory (#F7F1EA) + Soft Beige (#E9D9D0) + Cherry (#670626) + Muted Cherry (#A83B4D) claymorphic styling.
// Uses KATIPUNAN_BARANGAYS_LIST (Katipunan, Zamboanga del Norte 7109).
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useState, FormEvent } from 'react';
import {
  User,
  MapPin,
  Shield,
  FileText,
  Lock,
  AlertTriangle,
  Check,
  Loader2,
  HeartPulse,
  Flame,
  ShieldAlert,
  Phone,
  Radio,
  Building2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { createUser, ResponderUnit, CreateUserPayload } from '@/Endpoints/adminGovernanceApi';
import { AdminButton } from '../Shared/AdminButton';
import { AdminModalCard } from '../Shared/AdminModalCard';
import {
  KATIPUNAN_BARANGAYS_LIST,
  CLAY_WELL,
  CLAY_INPUT,
  CLAY_SELECT
} from '../Shared/adminCommandHelpers';

const MIN_PASSWORD_LENGTH = 12;
const STEP_ZERO = 0;
const STEP_OFFSET = 1;

export interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'address' | 'role' | 'credentials' | 'account'>('personal');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
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
    medicalCertifications: 'BLS, ACLS, EMT-B',
    ambulanceCallSign: 'RHU-MED1',
    firefighterRank: 'Fire Officer 1 (FO1)',
    bfpBadgeNumber: '',
    fireStation: 'BFP Katipunan Fire Station',
    fireSpecialization: 'Structural Firefighting',
    apparatusCallSign: 'ENGINE-1',
    policeRank: 'Patrolman',
    pnpBadgeNumber: '',
    precinctOrStation: 'PNP Katipunan Municipal Police Station',
    policeAssignment: 'Patrol & First Response',
    sidearmSerial: '',
    plantillaNumber: '',
    executiveDesignation: 'Operations Officer',
    clearanceLevel: 'Level 2 - Tactical Operations'
  });

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

  const handleReset = () => {
    setActiveTab('personal');
    setErrorText(null);
    setFormData({
      email: '',
      password: '',
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
      role: 'Civilian',
      unit: 'None',
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
      medicalCertifications: 'BLS, ACLS, EMT-B',
      ambulanceCallSign: 'RHU-MED1',
      firefighterRank: 'Fire Officer 1 (FO1)',
      bfpBadgeNumber: '',
      fireStation: 'BFP Katipunan Fire Station',
      fireSpecialization: 'Structural Firefighting',
      apparatusCallSign: 'ENGINE-1',
      policeRank: 'Patrolman',
      pnpBadgeNumber: '',
      precinctOrStation: 'PNP Katipunan Municipal Police Station',
      policeAssignment: 'Patrol & First Response',
      sidearmSerial: '',
      plantillaNumber: '',
      executiveDesignation: 'Operations Officer',
      clearanceLevel: 'Level 2 - Tactical Operations'
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!formData.firstName.trim() || !formData.surname.trim()) {
      setActiveTab('personal');
      setErrorText('First Name and Surname are mandatory.');
      return;
    }

    if (!formData.email.trim()) {
      setActiveTab('account');
      setErrorText('Valid email address is required for user account setup.');
      return;
    }

    if (!formData.password || formData.password.length < MIN_PASSWORD_LENGTH) {
      setActiveTab('account');
      setErrorText(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateUserPayload = {
        email: formData.email.trim(),
        password: formData.password,
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
          payload.rankOrTitle = payload.rankOrTitle || formData.medicalCadre;
        } else if (formData.unit === 'FIRE') {
          payload.firefighterRank = formData.firefighterRank;
          payload.bfpBadgeNumber = formData.bfpBadgeNumber.trim() || null;
          payload.fireStation = formData.fireStation.trim() || null;
          payload.fireSpecialization = formData.fireSpecialization.trim() || null;
          payload.apparatusCallSign = formData.apparatusCallSign.trim() || null;
          payload.rankOrTitle = payload.rankOrTitle || formData.firefighterRank;
        } else if (formData.unit === 'PNP') {
          payload.policeRank = formData.policeRank;
          payload.pnpBadgeNumber = formData.pnpBadgeNumber.trim() || null;
          payload.precinctOrStation = formData.precinctOrStation.trim() || null;
          payload.policeAssignment = formData.policeAssignment.trim() || null;
          payload.sidearmSerial = formData.sidearmSerial.trim() || null;
          payload.rankOrTitle = payload.rankOrTitle || formData.policeRank;
        }
      } else if (formData.role === 'LDRRMO_Admin') {
        payload.plantillaNumber = formData.plantillaNumber.trim() || null;
        payload.executiveDesignation = formData.executiveDesignation.trim() || null;
        payload.clearanceLevel = formData.clearanceLevel;
        payload.rankOrTitle = payload.rankOrTitle || formData.executiveDesignation;
      }

      await createUser(payload);
      showToast(`User ${payload.firstName} ${payload.surname} registered successfully!`, 'success');
      handleReset();
      onUserCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user account.';
      setErrorText(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'address', label: 'Address', icon: MapPin },
    { key: 'role', label: 'Role', icon: Shield },
    { key: 'credentials', label: 'Credentials', icon: FileText },
    { key: 'account', label: 'Account', icon: Lock }
  ] as const;

  const labelClass = 'block text-xs font-mono uppercase tracking-wider text-[#670626] mb-1.5 font-bold';

  return (
    <AdminModalCard
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Add User"
      subtitle="Create account and assign Katipunan role"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm text-[#670626]">
        {errorText && (
          <div className="p-3.5 rounded-xl bg-[#670626] text-[#F7F1EA] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 font-mono text-sm font-medium">{errorText}</div>
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
                  isActive
                    ? 'bg-[#670626] text-[#F7F1EA] shadow-sm'
                    : 'text-[#670626] hover:bg-[#F7F1EA]/70'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Personal */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="e.g. Juan"
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Middle Name</label>
              <input
                type="text"
                value={formData.middleName}
                onChange={(e) => handleChange('middleName', e.target.value)}
                placeholder="e.g. Santos"
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Surname *</label>
              <input
                type="text"
                required
                value={formData.surname}
                onChange={(e) => handleChange('surname', e.target.value)}
                placeholder="e.g. Dela Cruz"
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Suffix</label>
              <input
                type="text"
                value={formData.suffix}
                onChange={(e) => handleChange('suffix', e.target.value)}
                placeholder="e.g. Jr., Sr., III"
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className={CLAY_INPUT}
              />
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
              <label className={labelClass}>Contact Phone Number</label>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                placeholder="e.g. +63 917 123 4567"
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Resident / Employee ID</label>
              <input
                type="text"
                value={formData.employeeOrResidentId}
                onChange={(e) => handleChange('employeeOrResidentId', e.target.value)}
                placeholder="e.g. LDRRMO-2026-0042"
                className={CLAY_INPUT}
              />
            </div>

            <div className={`${CLAY_WELL} md:col-span-2 p-4`}>
              <h4 className="text-xs font-mono font-bold text-[#670626] mb-3 uppercase tracking-wider flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#A83B4D]" />
                Emergency Contact (Next of Kin)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Contact Person</label>
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                    placeholder="Full name"
                    className={CLAY_INPUT}
                  />
                </div>
                <div>
                  <label className={labelClass}>Contact Phone</label>
                  <input
                    type="text"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                    placeholder="e.g. +63 920 987 6543"
                    className={CLAY_INPUT}
                  />
                </div>
                <div>
                  <label className={labelClass}>Relationship</label>
                  <select
                    value={formData.emergencyContactRelationship}
                    onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)}
                    className={CLAY_SELECT}
                  >
                    {['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Colleague', 'Friend', 'Guardian'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Address */}
        {activeTab === 'address' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Province *</label>
              <input
                type="text"
                required
                value={formData.province}
                onChange={(e) => handleChange('province', e.target.value)}
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Municipality *</label>
              <input
                type="text"
                required
                value={formData.cityOrMunicipality}
                onChange={(e) => handleChange('cityOrMunicipality', e.target.value)}
                placeholder="e.g. Katipunan"
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Barangay Sector (Katipunan 7109) *</label>
              <select
                value={formData.barangay}
                onChange={(e) => handleChange('barangay', e.target.value)}
                className={CLAY_SELECT}
              >
                {KATIPUNAN_BARANGAYS_LIST.map((brgy) => (
                  <option key={brgy} value={brgy}>{brgy}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Street / Purok / Sitio</label>
              <input
                type="text"
                value={formData.streetOrPurok}
                onChange={(e) => handleChange('streetOrPurok', e.target.value)}
                placeholder="e.g. Purok 2, National Highway"
                className={CLAY_INPUT}
              />
            </div>
            <div className={`${CLAY_WELL} md:col-span-2 p-3.5 text-xs flex items-start gap-2.5`}>
              <Radio className="w-4 h-4 text-[#670626] mt-0.5 flex-shrink-0" />
              <div>
                <strong className="font-mono">Katipunan Sector: </strong>
                Barangay anchors GPS routing and local alerts.
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Role */}
        {activeTab === 'role' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>System Access Role *</label>
              <select value={formData.role} onChange={(e) => handleChange('role', e.target.value)} className={CLAY_SELECT}>
                <option value="Civilian">Civilian (Resident / Community)</option>
                <option value="Responder">Responder (First Responder / Tactical Unit)</option>
                <option value="LDRRMO_Admin">LDRRMO Admin (Executive & Operations)</option>
              </select>
            </div>

            {formData.role === 'Responder' ? (
              <div>
                <label className={labelClass}>Tactical Unit Agency *</label>
                <select value={formData.unit} onChange={(e) => handleChange('unit', e.target.value)} className={CLAY_SELECT}>
                  <option value="RHU">RHU (Rural Health Unit & Medical Response)</option>
                  <option value="FIRE">FIRE (Bureau of Fire Protection - BFP)</option>
                  <option value="PNP">PNP (Philippine National Police)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Unit Allocation</label>
                <input type="text" disabled value="None (Standard Community / Command)" className={CLAY_INPUT} />
              </div>
            )}

            <div>
              <label className={labelClass}>Station / Department / Barangay</label>
              <input
                type="text"
                value={formData.departmentOrBarangay}
                onChange={(e) => handleChange('departmentOrBarangay', e.target.value)}
                placeholder="e.g. BFP Katipunan Fire Station, RHU Poblacion"
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Official Rank or Operational Title</label>
              <input
                type="text"
                value={formData.rankOrTitle}
                onChange={(e) => handleChange('rankOrTitle', e.target.value)}
                placeholder="e.g. Lead Paramedic, FO2, Patrolman, Ops Chief"
                className={CLAY_INPUT}
              />
            </div>
          </div>
        )}

        {/* Tab 4: Credentials */}
        {activeTab === 'credentials' && (
          <div className="space-y-4">
            {formData.role === 'Civilian' && (
              <div className={`${CLAY_WELL} p-4 space-y-3`}>
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider">
                  <User className="w-4 h-4 text-[#A83B4D]" />
                  Philippine Civilian Resident Credentials
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelClass}>Government ID Type</label>
                    <select value={formData.governmentIdType} onChange={(e) => handleChange('governmentIdType', e.target.value)} className={CLAY_SELECT}>
                      <option value="PhilSys National ID">PhilSys National ID</option>
                      <option value="UMID">UMID</option>
                      <option value="Driver's License">Driver's License (LTO)</option>
                      <option value="Voter's ID">Voter's ID</option>
                      <option value="Barangay ID">Barangay Resident ID</option>
                      <option value="Passport">Philippine Passport</option>
                      <option value="Senior Citizen ID">Senior Citizen ID</option>
                      <option value="PWD ID">PWD ID</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Government ID Number</label>
                    <input
                      type="text"
                      value={formData.governmentIdNumber}
                      onChange={(e) => handleChange('governmentIdNumber', e.target.value)}
                      placeholder="e.g. 1234-5678-9012-3456"
                      className={CLAY_INPUT}
                    />
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
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider">
                  <HeartPulse className="w-4 h-4 text-emerald-700" />
                  Katipunan Rural Health Unit (RHU) Credentials
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelClass}>PRC Medical License Number</label>
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
                    <input
                      type="text"
                      value={formData.stationHealthCenter}
                      onChange={(e) => handleChange('stationHealthCenter', e.target.value)}
                      placeholder="e.g. Katipunan Rural Health Unit (RHU)"
                      className={CLAY_INPUT}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Ambulance Call Sign</label>
                    <input type="text" value={formData.ambulanceCallSign} onChange={(e) => handleChange('ambulanceCallSign', e.target.value)} className={CLAY_INPUT} />
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'Responder' && formData.unit === 'FIRE' && (
              <div className={`${CLAY_WELL} p-4 space-y-3`}>
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider">
                  <Flame className="w-4 h-4 text-orange-700" />
                  BFP Katipunan Credentials
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
                    <label className={labelClass}>Assigned Fire Station</label>
                    <input
                      type="text"
                      value={formData.fireStation}
                      onChange={(e) => handleChange('fireStation', e.target.value)}
                      placeholder="e.g. BFP Katipunan Fire Station"
                      className={CLAY_INPUT}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Apparatus Call Sign</label>
                    <input type="text" value={formData.apparatusCallSign} onChange={(e) => handleChange('apparatusCallSign', e.target.value)} className={CLAY_INPUT} />
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'Responder' && formData.unit === 'PNP' && (
              <div className={`${CLAY_WELL} p-4 space-y-3`}>
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-sky-700" />
                  PNP Katipunan Credentials
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
                    <input
                      type="text"
                      value={formData.precinctOrStation}
                      onChange={(e) => handleChange('precinctOrStation', e.target.value)}
                      placeholder="e.g. PNP Katipunan Municipal Police Station"
                      className={CLAY_INPUT}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Assignment / Sector</label>
                    <input type="text" value={formData.policeAssignment} onChange={(e) => handleChange('policeAssignment', e.target.value)} className={CLAY_INPUT} />
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'LDRRMO_Admin' && (
              <div className={`${CLAY_WELL} p-4 space-y-3`}>
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider">
                  <Building2 className="w-4 h-4 text-[#670626]" />
                  LDRRMO Administrative Credentials
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
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Account */}
        {activeTab === 'account' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Official Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="e.g. official@resqtrack.gov.ph"
                className={CLAY_INPUT}
              />
            </div>
            <div>
              <label className={labelClass}>Initial Password *</label>
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Minimum 12 characters"
                className={CLAY_INPUT}
              />
            </div>
            <div className={`${CLAY_WELL} md:col-span-2 p-4 text-xs space-y-1.5`}>
              <div className="font-bold font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#A83B4D]" />
                Security Governance Protocol:
              </div>
              <div className="text-[#A83B4D]">
                Min {MIN_PASSWORD_LENGTH} characters (mixed case, digits &amp; symbols).
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3.5 border-t border-[#670626]/15 mt-2">
          <div>
            {activeTab !== 'personal' && (
              <AdminButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = tabs.findIndex((t) => t.key === activeTab);
                  if (idx > STEP_ZERO) setActiveTab(tabs[idx - STEP_OFFSET].key);
                }}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                Back
              </AdminButton>
            )}
          </div>

          <div className="flex items-center gap-2">
            <AdminButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                handleReset();
                onClose();
              }}
            >
              Cancel
            </AdminButton>

            {activeTab !== 'account' ? (
              <AdminButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  const idx = tabs.findIndex((t) => t.key === activeTab);
                  if (idx < tabs.length - STEP_OFFSET) setActiveTab(tabs[idx + STEP_OFFSET].key);
                }}
              >
                Next <ChevronRight className="w-4 h-4 inline ml-1" />
              </AdminButton>
            ) : (
              <AdminButton
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              >
                {isSubmitting ? 'Creating…' : 'Create User'}
              </AdminButton>
            )}
          </div>
        </div>
      </form>
    </AdminModalCard>
  );
};
