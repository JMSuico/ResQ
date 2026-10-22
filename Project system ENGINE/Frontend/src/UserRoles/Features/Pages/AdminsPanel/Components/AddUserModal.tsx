// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// AddUserModal.tsx -- Elite Emergency Command Personnel & Resident Registration Modal for ResQTrack.
// Supports full Philippine emergency credentials, Universal Lambdas (=>), and Katipuneros architecture.
// DO NOT expose cleartext credentials or omit required backend DTO attributes.

import React, { useState } from 'react';
import { DefaultFloatingModalCard, Button } from '@/Shared';
import { createUser, ResponderUnit, CreateUserPayload } from '@/Endpoints/adminGovernanceApi';

export interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const DIPOLOG_BARANGAYS = [
  'Barra',
  'Biasong',
  'Central',
  'Cogon',
  'Dicayas',
  'Galas',
  'Gulayon',
  'Lugdungan',
  'Minaog',
  'Miputak',
  'Olingan',
  'Polanco (Border)',
  'San Jose',
  'San Pedro',
  'Santa Filomena',
  'Santa Isabel',
  'Sicayab',
  'Sinaman',
  'Turno',
];

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'address' | 'role' | 'credentials' | 'account'>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    // Account Setup
    email: '',
    password: '',
    // Personal & Contact
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
    // Address
    province: 'Zamboanga del Norte',
    cityOrMunicipality: 'Dipolog City',
    barangay: 'Barra',
    streetOrPurok: '',
    // Role & Station
    role: 'Civilian' as 'Civilian' | 'Responder' | 'LDRRMO_Admin',
    unit: 'None' as ResponderUnit,
    departmentOrBarangay: '',
    rankOrTitle: '',
    employeeOrResidentId: '',
    // Civilian Credentials
    governmentIdType: 'PhilSys National ID',
    governmentIdNumber: '',
    residencyCategory: 'Permanent',
    vulnerabilityFlags: 'None',
    // RHU Credentials
    medicalLicenseNumber: '',
    medicalCadre: 'Paramedic',
    stationHealthCenter: 'Dipolog City Health Office',
    medicalCertifications: 'BLS, ACLS, EMT-B',
    ambulanceCallSign: 'RHU-MED1',
    // FIRE Credentials
    firefighterRank: 'Fire Officer 1 (FO1)',
    bfpBadgeNumber: '',
    fireStation: 'Dipolog Central Fire Station',
    fireSpecialization: 'Structural Firefighting',
    apparatusCallSign: 'ENGINE-1',
    // PNP Credentials
    policeRank: 'Patrolman',
    pnpBadgeNumber: '',
    precinctOrStation: 'Dipolog City Police Station (CPS)',
    policeAssignment: 'Patrol & First Response',
    sidearmSerial: '',
    // LDRRMO Admin Credentials
    plantillaNumber: '',
    executiveDesignation: 'Operations Officer',
    clearanceLevel: 'Level 2 - Tactical Operations',
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
      cityOrMunicipality: 'Dipolog City',
      barangay: 'Barra',
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
      stationHealthCenter: 'Dipolog City Health Office',
      medicalCertifications: 'BLS, ACLS, EMT-B',
      ambulanceCallSign: 'RHU-MED1',
      firefighterRank: 'Fire Officer 1 (FO1)',
      bfpBadgeNumber: '',
      fireStation: 'Dipolog Central Fire Station',
      fireSpecialization: 'Structural Firefighting',
      apparatusCallSign: 'ENGINE-1',
      policeRank: 'Patrolman',
      pnpBadgeNumber: '',
      precinctOrStation: 'Dipolog City Police Station (CPS)',
      policeAssignment: 'Patrol & First Response',
      sidearmSerial: '',
      plantillaNumber: '',
      executiveDesignation: 'Operations Officer',
      clearanceLevel: 'Level 2 - Tactical Operations',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    // Form validations
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

    if (!formData.password || formData.password.length < 12) {
      setActiveTab('account');
      setErrorText('Password must be at least 12 characters long according to emergency security policies.');
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
        employeeOrResidentId: formData.employeeOrResidentId.trim() || null,
      };

      // Role-specific credential payload bindings
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
      const msg = err instanceof Error ? err.message : 'Failed to create user account. Please check values.';
      setErrorText(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { key: 'personal', step: '01', label: 'Personal & Vitals', icon: '👤' },
    { key: 'address', step: '02', label: 'Residence Sector', icon: '📍' },
    { key: 'role', step: '03', label: 'Role & Agency', icon: '🛡️' },
    { key: 'credentials', step: '04', label: 'Emergency Badges', icon: '📜' },
    { key: 'account', step: '05', label: 'Security & Auth', icon: '🔐' },
  ] as const;

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Enroll Emergency Official or Resident"
      subtitle="Provision authenticated identity with Philippine emergency credentials & agency allocations"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs text-slate-200">
        {errorText && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 flex items-start gap-2.5 shadow-[0_0_12px_rgba(244,63,94,0.25)]">
            <svg className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 font-mono font-medium">{errorText}</div>
          </div>
        )}

        {/* Crisp Tactical Tab Header */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#1d3c5c] scrollbar-none bg-[#071522]/60 p-1 rounded-xl">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#16304a] text-sky-300 border border-sky-500/80 shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e243a]/80'
                }`}
              >
                <span className="text-[10px] text-slate-500 font-bold">{tab.step}</span>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Personal & Vitals */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                First Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="e.g. Juan"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Middle Name</label>
              <input
                type="text"
                value={formData.middleName}
                onChange={(e) => handleChange('middleName', e.target.value)}
                placeholder="e.g. Santos"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                Surname <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.surname}
                onChange={(e) => handleChange('surname', e.target.value)}
                placeholder="e.g. Dela Cruz"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Suffix</label>
              <input
                type="text"
                value={formData.suffix}
                onChange={(e) => handleChange('suffix', e.target.value)}
                placeholder="e.g. Jr., Sr., III"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 focus:border-sky-400 focus:outline-none font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Sex</label>
                <select
                  value={formData.sex}
                  onChange={(e) => handleChange('sex', e.target.value)}
                  className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 focus:border-sky-400 focus:outline-none font-mono"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Blood Type</label>
                <select
                  value={formData.bloodType}
                  onChange={(e) => handleChange('bloodType', e.target.value)}
                  className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-rose-300 font-bold focus:border-sky-400 focus:outline-none font-mono"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Mobile Telemetry Phone</label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                placeholder="e.g. +63 917 123 4567"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Resident / Employee ID</label>
              <input
                type="text"
                value={formData.employeeOrResidentId}
                onChange={(e) => handleChange('employeeOrResidentId', e.target.value)}
                placeholder="e.g. LDRRMO-2026-0042 (Auto if empty)"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-sky-400 placeholder-slate-500 focus:border-sky-400 focus:outline-none font-mono font-semibold"
              />
            </div>

            {/* Structured Emergency Contact Section */}
            <div className="md:col-span-2 p-3.5 rounded-xl bg-[#0a1a2b]/80 border border-amber-900/60 shadow-md">
              <h4 className="text-xs font-mono font-bold text-amber-300 mb-2.5 uppercase tracking-wider flex items-center gap-2">
                <span>🚨</span> Philippine Emergency Contact Information (Next of Kin)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Contact Person</label>
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                    placeholder="Full name of next of kin"
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Emergency Phone</label>
                  <input
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                    placeholder="e.g. +63 920 987 6543"
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-amber-300 placeholder-slate-500 focus:border-sky-400 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Relationship</label>
                  <select
                    value={formData.emergencyContactRelationship}
                    onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 focus:border-sky-400 focus:outline-none font-mono"
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

        {/* Tab 2: Philippine Address */}
        {activeTab === 'address' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                Province <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.province}
                onChange={(e) => handleChange('province', e.target.value)}
                placeholder="e.g. Zamboanga del Norte"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                City / Municipality <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.cityOrMunicipality}
                onChange={(e) => handleChange('cityOrMunicipality', e.target.value)}
                placeholder="e.g. Dipolog City"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                Barangay Sector <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.barangay}
                onChange={(e) => handleChange('barangay', e.target.value)}
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-sky-300 font-bold focus:border-sky-400 focus:outline-none font-mono"
              >
                {DIPOLOG_BARANGAYS.map((brgy) => (
                  <option key={brgy} value={brgy}>{brgy}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Street / Purok / Sitio</label>
              <input
                type="text"
                value={formData.streetOrPurok}
                onChange={(e) => handleChange('streetOrPurok', e.target.value)}
                placeholder="e.g. Purok Bougainvillea, Gen. Luna St."
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2 p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-[#1d3c5c] text-[11px] text-slate-300 flex items-start gap-2.5">
              <span className="text-sky-400 text-sm mt-0.5">🛰️</span>
              <div>
                <strong className="text-sky-300 font-mono">Geographic Triage Allocation: </strong>
                Barangay coordinates anchor live GPS responder routing and evacuation alert dispatch to the LDRRMO Command Console.
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Role & Station */}
        {activeTab === 'role' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                System Access Role <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none font-bold"
              >
                <option value="Civilian">Civilian (UG Resident / Community)</option>
                <option value="Responder">Responder (First Responder / Tactical Unit)</option>
                <option value="LDRRMO_Admin">LDRRMO Admin (Executive & Operations)</option>
              </select>
            </div>

            {formData.role === 'Responder' ? (
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                  Tactical Unit Agency <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-sky-400 focus:border-sky-400 focus:outline-none font-bold font-mono"
                >
                  <option value="RHU">RHU (City Health Office & Medical Response)</option>
                  <option value="FIRE">FIRE (Bureau of Fire Protection - BFP)</option>
                  <option value="PNP">PNP (Philippine National Police - Tactical)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Unit Allocation</label>
                <input
                  type="text"
                  disabled
                  value="None (Standard Community / Central Command)"
                  className="w-full bg-[#071522]/50 border border-slate-800 rounded-lg p-2.5 text-slate-500 cursor-not-allowed font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Station / Department / Sector</label>
              <input
                type="text"
                value={formData.departmentOrBarangay}
                onChange={(e) => handleChange('departmentOrBarangay', e.target.value)}
                placeholder="e.g. Dipolog Central Fire Station, CPS Station 1"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Official Rank or Operational Title</label>
              <input
                type="text"
                value={formData.rankOrTitle}
                onChange={(e) => handleChange('rankOrTitle', e.target.value)}
                placeholder="e.g. Lead Paramedic, FO2, Patrolman, Ops Chief"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Tab 4: Role-Specific Structured Emergency Badges */}
        {activeTab === 'credentials' && (
          <div className="space-y-3.5">
            {formData.role === 'Civilian' && (
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/60 space-y-3 shadow-lg">
                <div className="flex items-center gap-2 text-purple-300 font-mono font-bold text-xs uppercase tracking-wider">
                  <span>👤</span> Philippine Civilian Resident Credentials
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">PhilSys / Government ID Type</label>
                    <select
                      value={formData.governmentIdType}
                      onChange={(e) => handleChange('governmentIdType', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono text-xs"
                    >
                      <option value="PhilSys National ID">PhilSys National ID</option>
                      <option value="UMID">UMID (Unified Multi-Purpose ID)</option>
                      <option value="Driver's License">Driver's License (LTO)</option>
                      <option value="Voter's ID">Voter's ID / Comelec Certificate</option>
                      <option value="Barangay ID">Barangay Resident ID</option>
                      <option value="Passport">Philippine Passport</option>
                      <option value="Senior Citizen ID">Senior Citizen ID (OSCA)</option>
                      <option value="PWD ID">Persons with Disability (PWD) ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Government ID Card Number</label>
                    <input
                      type="text"
                      value={formData.governmentIdNumber}
                      onChange={(e) => handleChange('governmentIdNumber', e.target.value)}
                      placeholder="e.g. 1234-5678-9012-3456"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Residency Category</label>
                    <select
                      value={formData.residencyCategory}
                      onChange={(e) => handleChange('residencyCategory', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono"
                    >
                      <option value="Permanent">Permanent Resident</option>
                      <option value="Transient">Transient / Temporary</option>
                      <option value="Student">Student / Boarder</option>
                      <option value="Displaced / Evacuee">Displaced / Evacuee</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Vulnerability / Priority Flags</label>
                    <select
                      value={formData.vulnerabilityFlags}
                      onChange={(e) => handleChange('vulnerabilityFlags', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-amber-300 font-bold font-mono"
                    >
                      <option value="None">None (General Resident)</option>
                      <option value="Senior Citizen">Senior Citizen (60+)</option>
                      <option value="PWD">Persons with Disability (PWD)</option>
                      <option value="Pregnant">Pregnant Resident</option>
                      <option value="Solo Parent">Solo Parent with Minor Children</option>
                      <option value="Medical Risk">Critical Medical Risk / Dialysis</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'Responder' && formData.unit === 'RHU' && (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-600/70 space-y-3 shadow-lg">
                <div className="flex items-center gap-2 text-emerald-300 font-mono font-bold text-xs uppercase tracking-wider">
                  <span>🚑</span> Rural Health Unit (RHU) Medical Credentials
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">PRC Medical License Number</label>
                    <input
                      type="text"
                      value={formData.medicalLicenseNumber}
                      onChange={(e) => handleChange('medicalLicenseNumber', e.target.value)}
                      placeholder="e.g. PRC-0189421"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-emerald-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Medical Cadre / Specialization</label>
                    <select
                      value={formData.medicalCadre}
                      onChange={(e) => handleChange('medicalCadre', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono"
                    >
                      <option value="Physician">Medical Doctor / Physician</option>
                      <option value="Registered Nurse">Emergency Nurse (RN)</option>
                      <option value="Paramedic">Emergency Medical Technician (EMT / Paramedic)</option>
                      <option value="Medical Technologist">Medical Technologist</option>
                      <option value="First Responder">First Aid Responder / BHW</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Health Center Station</label>
                    <input
                      type="text"
                      value={formData.stationHealthCenter}
                      onChange={(e) => handleChange('stationHealthCenter', e.target.value)}
                      placeholder="e.g. Dipolog CHO Main, RHU Barra"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Ambulance Call Sign</label>
                    <input
                      type="text"
                      value={formData.ambulanceCallSign}
                      onChange={(e) => handleChange('ambulanceCallSign', e.target.value)}
                      placeholder="e.g. RHU-MED1, AMB-04"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-emerald-300 font-mono font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Medical Certifications</label>
                    <input
                      type="text"
                      value={formData.medicalCertifications}
                      onChange={(e) => handleChange('medicalCertifications', e.target.value)}
                      placeholder="e.g. BLS, ACLS, PHTLS, Mass Casualty Triage"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'Responder' && formData.unit === 'FIRE' && (
              <div className="p-4 rounded-xl bg-orange-950/20 border border-orange-600/70 space-y-3 shadow-lg">
                <div className="flex items-center gap-2 text-orange-300 font-mono font-bold text-xs uppercase tracking-wider">
                  <span>🚒</span> Bureau of Fire Protection (BFP) Credentials
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">BFP Firefighter Rank</label>
                    <select
                      value={formData.firefighterRank}
                      onChange={(e) => handleChange('firefighterRank', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-orange-300 font-bold font-mono"
                    >
                      <option value="Fire Officer 1 (FO1)">Fire Officer 1 (FO1)</option>
                      <option value="Fire Officer 2 (FO2)">Fire Officer 2 (FO2)</option>
                      <option value="Fire Officer 3 (FO3)">Fire Officer 3 (FO3)</option>
                      <option value="Senior Fire Officer 1 (SFO1)">Senior Fire Officer 1 (SFO1)</option>
                      <option value="Senior Fire Officer 2 (SFO2)">Senior Fire Officer 2 (SFO2)</option>
                      <option value="Senior Fire Officer 3 (SFO3)">Senior Fire Officer 3 (SFO3)</option>
                      <option value="Senior Fire Officer 4 (SFO4)">Senior Fire Officer 4 (SFO4)</option>
                      <option value="Fire Inspector (FINSP)">Fire Inspector (FINSP)</option>
                      <option value="Senior Fire Inspector (SINSP)">Senior Fire Inspector (SINSP)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">BFP Badge / Account Number</label>
                    <input
                      type="text"
                      value={formData.bfpBadgeNumber}
                      onChange={(e) => handleChange('bfpBadgeNumber', e.target.value)}
                      placeholder="e.g. BFP-982103"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-orange-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Assigned Fire Station</label>
                    <input
                      type="text"
                      value={formData.fireStation}
                      onChange={(e) => handleChange('fireStation', e.target.value)}
                      placeholder="e.g. Dipolog Central Fire Station"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Apparatus / Vehicle Call Sign</label>
                    <input
                      type="text"
                      value={formData.apparatusCallSign}
                      onChange={(e) => handleChange('apparatusCallSign', e.target.value)}
                      placeholder="e.g. ENGINE-1, LADDER-1, TANKER-2"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-orange-300 font-mono font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Specialization</label>
                    <select
                      value={formData.fireSpecialization}
                      onChange={(e) => handleChange('fireSpecialization', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono"
                    >
                      <option value="Structural Firefighting">Structural Firefighting</option>
                      <option value="Hazardous Materials (HazMat)">Hazardous Materials (HazMat)</option>
                      <option value="Urban Search and Rescue (USAR)">Urban Search and Rescue (USAR)</option>
                      <option value="Water Rescue & Floods">Water Rescue & Floods</option>
                      <option value="High-Angle Rope Rescue">High-Angle Rope Rescue</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'Responder' && formData.unit === 'PNP' && (
              <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-600/70 space-y-3 shadow-lg">
                <div className="flex items-center gap-2 text-sky-300 font-mono font-bold text-xs uppercase tracking-wider">
                  <span>👮</span> Philippine National Police (PNP) Credentials
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">PNP Police Rank</label>
                    <select
                      value={formData.policeRank}
                      onChange={(e) => handleChange('policeRank', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-sky-300 font-bold font-mono"
                    >
                      <option value="Patrolman">Patrolman / Patrolwoman (Pat)</option>
                      <option value="Police Corporal (PCpl)">Police Corporal (PCpl)</option>
                      <option value="Police Staff Sergeant (PSSg)">Police Staff Sergeant (PSSg)</option>
                      <option value="Police Master Sergeant (PMSg)">Police Master Sergeant (PMSg)</option>
                      <option value="Police Senior Master Sergeant (PSMS)">Police Senior Master Sergeant (PSMS)</option>
                      <option value="Police Chief Master Sergeant (PCMS)">Police Chief Master Sergeant (PCMS)</option>
                      <option value="Police Executive Master Sergeant (PEMS)">Police Executive Master Sergeant (PEMS)</option>
                      <option value="Police Lieutenant (PLT)">Police Lieutenant (PLT)</option>
                      <option value="Police Captain (PCPT)">Police Captain (PCPT)</option>
                      <option value="Police Major (PMAJ)">Police Major (PMAJ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">PNP Badge / Plantilla ID</label>
                    <input
                      type="text"
                      value={formData.pnpBadgeNumber}
                      onChange={(e) => handleChange('pnpBadgeNumber', e.target.value)}
                      placeholder="e.g. PNP-448102"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-sky-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Precinct / Police Station</label>
                    <input
                      type="text"
                      value={formData.precinctOrStation}
                      onChange={(e) => handleChange('precinctOrStation', e.target.value)}
                      placeholder="e.g. Dipolog CPS Central, Station 1"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Assignment / Sector</label>
                    <input
                      type="text"
                      value={formData.policeAssignment}
                      onChange={(e) => handleChange('policeAssignment', e.target.value)}
                      placeholder="e.g. Beat Patrol, Traffic, Tactical Response"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Sidearm Serial Number</label>
                    <input
                      type="text"
                      value={formData.sidearmSerial}
                      onChange={(e) => handleChange('sidearmSerial', e.target.value)}
                      placeholder="e.g. GLOCK17-SN-9281734"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-rose-300 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'LDRRMO_Admin' && (
              <div className="p-4 rounded-xl bg-rose-950/20 border border-amber-600/70 space-y-3 shadow-lg">
                <div className="flex items-center gap-2 text-amber-300 font-mono font-bold text-xs uppercase tracking-wider">
                  <span>🏛️</span> LDRRMO Administrative Governance Credentials
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LGU Plantilla Number</label>
                    <input
                      type="text"
                      value={formData.plantillaNumber}
                      onChange={(e) => handleChange('plantillaNumber', e.target.value)}
                      placeholder="e.g. LGU-PLANTILLA-2026-084"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-amber-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Executive Designation</label>
                    <input
                      type="text"
                      value={formData.executiveDesignation}
                      onChange={(e) => handleChange('executiveDesignation', e.target.value)}
                      placeholder="e.g. Operations Officer, CDRRMO Chief"
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-semibold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Security Clearance Level</label>
                    <select
                      value={formData.clearanceLevel}
                      onChange={(e) => handleChange('clearanceLevel', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-sky-300 font-mono font-bold"
                    >
                      <option value="Level 1 - Field Tactical">Level 1 - Field Tactical Operations</option>
                      <option value="Level 2 - Tactical Operations">Level 2 - Operations Center Tactical</option>
                      <option value="Level 3 - Executive Command Authority">Level 3 - Executive Command Authority</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Security & Auth */}
        {activeTab === 'account' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                Official Agency Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="e.g. official@resqtrack.gov.ph"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                Initial Provisioning Password <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                required
                minLength={12}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none font-mono"
              />
            </div>
            <div className="md:col-span-2 p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-[#1d3c5c] text-[11px] text-slate-300 space-y-1.5">
              <div className="font-bold text-sky-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                <span>🛡️</span> Incident AI Security Governance Protocol:
              </div>
              <div className="text-slate-400">
                • Minimum 12 alphanumeric characters with uppercase, lowercase, numbers, and symbols required.
              </div>
              <div className="text-slate-400">
                • Real-time Laplacian anti-spoofing face verification will be requested on initial field logon.
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3.5 border-t border-[#1d3c5c] mt-2">
          <div>
            {activeTab !== 'personal' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const idx = tabs.findIndex((t) => t.key === activeTab);
                  if (idx > 0) setActiveTab(tabs[idx - 1].key);
                }}
              >
                ← Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                handleReset();
                onClose();
              }}
            >
              Cancel
            </Button>

            {activeTab !== 'account' ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  const idx = tabs.findIndex((t) => t.key === activeTab);
                  if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].key);
                }}
              >
                Proceed Step →
              </Button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Provisioning…
                  </>
                ) : (
                  <>✓ Finalize & Register</>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};
