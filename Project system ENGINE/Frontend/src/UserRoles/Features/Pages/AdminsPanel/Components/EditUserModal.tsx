// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// EditUserModal.tsx -- Comprehensive user profile and emergency credentials editor.
// Built with Universal Lambdas (=>), Katipuneros architecture, and DefaultFloatingModalCard.
// DO NOT mutate user email or unverified identity hashes.

import React, { useEffect, useState } from 'react';
import { DefaultFloatingModalCard, Button } from '@/Shared';
import { getUserDetail, updateUser, UserDetail, UserSummary, ResponderUnit, UpdateUserPayload } from '@/Endpoints/adminGovernanceApi';

export interface EditUserModalProps {
  user: UserSummary | UserDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
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

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  showToast,
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
    cityOrMunicipality: 'Dipolog City',
    barangay: 'Barra',
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
    stationHealthCenter: 'Dipolog City Health Office',
    medicalCertifications: 'BLS, ACLS',
    ambulanceCallSign: 'RHU-MED1',
    firefighterRank: 'Fire Officer 1 (FO1)',
    bfpBadgeNumber: '',
    fireStation: 'Dipolog Central Fire Station',
    fireSpecialization: 'Structural Firefighting',
    apparatusCallSign: 'ENGINE-1',
    policeRank: 'Patrolman',
    pnpBadgeNumber: '',
    precinctOrStation: 'Dipolog City Police Station (CPS)',
    policeAssignment: 'Patrol',
    sidearmSerial: '',
    plantillaNumber: '',
    executiveDesignation: 'Operations Officer',
    clearanceLevel: 'Level 2 - Tactical Operations',
  });

  useEffect(() => {
    if (isOpen && user) {
      loadFullDetail(user.id);
    } else {
      setErrorText(null);
    }
  }, [isOpen, user]);

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
        cityOrMunicipality: d.cityOrMunicipality || 'Dipolog City',
        barangay: d.barangay || 'Barra',
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
        stationHealthCenter: d.stationHealthCenter || 'Dipolog City Health Office',
        medicalCertifications: d.medicalCertifications || 'BLS, ACLS',
        ambulanceCallSign: d.ambulanceCallSign || 'RHU-MED1',
        firefighterRank: d.firefighterRank || 'Fire Officer 1 (FO1)',
        bfpBadgeNumber: d.bfpBadgeNumber || '',
        fireStation: d.fireStation || 'Dipolog Central Fire Station',
        fireSpecialization: d.fireSpecialization || 'Structural Firefighting',
        apparatusCallSign: d.apparatusCallSign || 'ENGINE-1',
        policeRank: d.policeRank || 'Patrolman',
        pnpBadgeNumber: d.pnpBadgeNumber || '',
        precinctOrStation: d.precinctOrStation || 'Dipolog City Police Station (CPS)',
        policeAssignment: d.policeAssignment || 'Patrol',
        sidearmSerial: d.sidearmSerial || '',
        plantillaNumber: d.plantillaNumber || '',
        executiveDesignation: d.executiveDesignation || 'Operations Officer',
        clearanceLevel: d.clearanceLevel || 'Level 2 - Tactical Operations',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to populate existing profile details.';
      setErrorText(msg);
    } finally {
      setIsLoading(false);
    }
  };

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
        employeeOrResidentId: formData.employeeOrResidentId.trim() || null,
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
    { key: 'info', step: '01', label: 'Identity & Vitals', icon: '👤' },
    { key: 'address', step: '02', label: 'Residence Sector', icon: '📍' },
    { key: 'role', step: '03', label: 'Governance & Role', icon: '🛡️' },
    { key: 'credentials', step: '04', label: 'Emergency Badges', icon: '📜' },
  ] as const;

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title={`Modify Profile: ${user?.fullName || ''}`}
      subtitle="Update station assignment, Philippine credentials, authorization status, and contact telemetry"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs text-slate-200">
        {isLoading && (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="font-mono text-xs">Retrieving authoritative database record…</div>
          </div>
        )}

        {errorText && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 font-mono flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorText}</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Top Identity Hero Pill */}
            {user && (
              <div className="p-3 rounded-xl bg-[#071522] border border-[#1d3c5c] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0a1a2b] border border-[#1d3c5c] flex items-center justify-center text-sky-400 font-mono font-bold text-xs">
                    {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">{user.fullName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {user.employeeOrResidentId && (
                    <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                      ID: {user.employeeOrResidentId}
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {user.role} {user.unit !== 'None' ? `(${user.unit})` : ''}
                  </span>
                </div>
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

            {/* Tab 1: Info & Vitals */}
            {activeTab === 'info' && (
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
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => handleChange('middleName', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
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
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Suffix</label>
                  <input
                    type="text"
                    value={formData.suffix}
                    onChange={(e) => handleChange('suffix', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
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
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleChange('phoneNumber', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Resident / Employee ID</label>
                  <input
                    type="text"
                    value={formData.employeeOrResidentId}
                    onChange={(e) => handleChange('employeeOrResidentId', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-sky-400 focus:border-sky-400 focus:outline-none font-mono font-semibold"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Address & Emergency Contact */}
            {activeTab === 'address' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Province *</label>
                  <input
                    type="text"
                    required
                    value={formData.province}
                    onChange={(e) => handleChange('province', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">City / Municipality *</label>
                  <input
                    type="text"
                    required
                    value={formData.cityOrMunicipality}
                    onChange={(e) => handleChange('cityOrMunicipality', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Barangay Sector *</label>
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
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Street / Purok</label>
                  <input
                    type="text"
                    value={formData.streetOrPurok}
                    onChange={(e) => handleChange('streetOrPurok', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2 p-3.5 rounded-xl bg-[#0a1a2b]/80 border border-amber-900/60 shadow-md">
                  <h4 className="text-xs font-mono font-bold text-amber-300 mb-2.5 uppercase tracking-wider flex items-center gap-2">
                    <span>🚨</span> Emergency Contact (Next of Kin)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Contact Person</label>
                      <input
                        type="text"
                        value={formData.emergencyContactName}
                        onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                        className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Contact Phone</label>
                      <input
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                        className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-amber-300 focus:border-sky-400 focus:outline-none font-mono"
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

            {/* Tab 3: Governance & Role */}
            {activeTab === 'role' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                    Account Authorization Status <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-white font-mono font-bold focus:border-sky-400 focus:outline-none"
                  >
                    <option value="Verified">Verified (Active / Authorized)</option>
                    <option value="Pending">Pending Approval</option>
                    <option value="Suspended">Suspended (Access Revoked)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">
                    System Access Role <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 font-bold focus:border-sky-400 focus:outline-none"
                  >
                    <option value="Civilian">Civilian</option>
                    <option value="Responder">Responder</option>
                    <option value="LDRRMO_Admin">LDRRMO Admin</option>
                  </select>
                </div>

                {formData.role === 'Responder' && (
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Tactical Unit Agency</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => handleChange('unit', e.target.value)}
                      className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-sky-400 font-bold font-mono focus:border-sky-400 focus:outline-none"
                    >
                      <option value="RHU">RHU (City Health Office / Medical)</option>
                      <option value="FIRE">FIRE (Bureau of Fire Protection)</option>
                      <option value="PNP">PNP (Philippine National Police)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Station / Sector Department</label>
                  <input
                    type="text"
                    value={formData.departmentOrBarangay}
                    onChange={(e) => handleChange('departmentOrBarangay', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Official Rank or Operational Title</label>
                  <input
                    type="text"
                    value={formData.rankOrTitle}
                    onChange={(e) => handleChange('rankOrTitle', e.target.value)}
                    className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2.5 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Tab 4: Role Credentials */}
            {activeTab === 'credentials' && (
              <div className="space-y-3.5">
                {formData.role === 'Civilian' && (
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/60 space-y-3 shadow-lg">
                    <div className="text-purple-300 font-mono font-bold text-xs uppercase tracking-wider">
                      Civilian Resident Badges & Identification
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Government ID Type</label>
                        <select
                          value={formData.governmentIdType}
                          onChange={(e) => handleChange('governmentIdType', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono"
                        >
                          <option value="PhilSys National ID">PhilSys National ID</option>
                          <option value="UMID">UMID</option>
                          <option value="Driver's License">Driver's License</option>
                          <option value="Voter's ID">Voter's ID</option>
                          <option value="Passport">Philippine Passport</option>
                          <option value="Senior Citizen ID">Senior Citizen ID</option>
                          <option value="PWD ID">PWD ID</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">ID Card Number</label>
                        <input
                          type="text"
                          value={formData.governmentIdNumber}
                          onChange={(e) => handleChange('governmentIdNumber', e.target.value)}
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
                          <option value="Permanent">Permanent</option>
                          <option value="Transient">Transient</option>
                          <option value="Student">Student</option>
                          <option value="Displaced / Evacuee">Displaced / Evacuee</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Vulnerability Flags</label>
                        <select
                          value={formData.vulnerabilityFlags}
                          onChange={(e) => handleChange('vulnerabilityFlags', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-amber-300 font-mono font-bold"
                        >
                          <option value="None">None</option>
                          <option value="Senior Citizen">Senior Citizen</option>
                          <option value="PWD">PWD</option>
                          <option value="Pregnant">Pregnant</option>
                          <option value="Solo Parent">Solo Parent</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'RHU' && (
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-600/70 space-y-3 shadow-lg">
                    <div className="text-emerald-300 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>🚑</span> RHU Medical Badges & License
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">PRC License Number</label>
                        <input
                          type="text"
                          value={formData.medicalLicenseNumber}
                          onChange={(e) => handleChange('medicalLicenseNumber', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-emerald-300 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Medical Cadre</label>
                        <select
                          value={formData.medicalCadre}
                          onChange={(e) => handleChange('medicalCadre', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono"
                        >
                          <option value="Physician">Physician</option>
                          <option value="Registered Nurse">Registered Nurse</option>
                          <option value="Paramedic">Paramedic</option>
                          <option value="First Responder">First Responder</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Health Station</label>
                        <input
                          type="text"
                          value={formData.stationHealthCenter}
                          onChange={(e) => handleChange('stationHealthCenter', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Ambulance Call Sign</label>
                        <input
                          type="text"
                          value={formData.ambulanceCallSign}
                          onChange={(e) => handleChange('ambulanceCallSign', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-emerald-300 font-mono font-bold"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Medical Certifications</label>
                        <input
                          type="text"
                          value={formData.medicalCertifications}
                          onChange={(e) => handleChange('medicalCertifications', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'FIRE' && (
                  <div className="p-4 rounded-xl bg-orange-950/20 border border-orange-600/70 space-y-3 shadow-lg">
                    <div className="text-orange-300 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>🚒</span> Bureau of Fire Protection (BFP) Badges
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">BFP Firefighter Rank</label>
                        <select
                          value={formData.firefighterRank}
                          onChange={(e) => handleChange('firefighterRank', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-orange-300 font-bold font-mono"
                        >
                          <option value="Fire Officer 1 (FO1)">FO1</option>
                          <option value="Fire Officer 2 (FO2)">FO2</option>
                          <option value="Fire Officer 3 (FO3)">FO3</option>
                          <option value="Senior Fire Officer 1 (SFO1)">SFO1</option>
                          <option value="Senior Fire Officer 2 (SFO2)">SFO2</option>
                          <option value="Fire Inspector (FINSP)">FINSP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">BFP Badge Number</label>
                        <input
                          type="text"
                          value={formData.bfpBadgeNumber}
                          onChange={(e) => handleChange('bfpBadgeNumber', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-orange-300 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Fire Station</label>
                        <input
                          type="text"
                          value={formData.fireStation}
                          onChange={(e) => handleChange('fireStation', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Apparatus Call Sign</label>
                        <input
                          type="text"
                          value={formData.apparatusCallSign}
                          onChange={(e) => handleChange('apparatusCallSign', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-orange-300 font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'PNP' && (
                  <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-600/70 space-y-3 shadow-lg">
                    <div className="text-sky-300 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>👮</span> Philippine National Police (PNP) Badges
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">PNP Police Rank</label>
                        <select
                          value={formData.policeRank}
                          onChange={(e) => handleChange('policeRank', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-sky-300 font-bold font-mono"
                        >
                          <option value="Patrolman">Patrolman / Patrolwoman</option>
                          <option value="Police Corporal (PCpl)">PCpl</option>
                          <option value="Police Staff Sergeant (PSSg)">PSSg</option>
                          <option value="Police Master Sergeant (PMSg)">PMSg</option>
                          <option value="Police Lieutenant (PLT)">PLT</option>
                          <option value="Police Captain (PCPT)">PCPT</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">PNP Badge Number</label>
                        <input
                          type="text"
                          value={formData.pnpBadgeNumber}
                          onChange={(e) => handleChange('pnpBadgeNumber', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-sky-300 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Sidearm Serial Number</label>
                        <input
                          type="text"
                          value={formData.sidearmSerial}
                          onChange={(e) => handleChange('sidearmSerial', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-rose-300 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Precinct / Station</label>
                        <input
                          type="text"
                          value={formData.precinctOrStation}
                          onChange={(e) => handleChange('precinctOrStation', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'LDRRMO_Admin' && (
                  <div className="p-4 rounded-xl bg-rose-950/20 border border-amber-600/70 space-y-3 shadow-lg">
                    <div className="text-amber-300 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>🏛️</span> LDRRMO Administrative Credentials
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">LGU Plantilla Number</label>
                        <input
                          type="text"
                          value={formData.plantillaNumber}
                          onChange={(e) => handleChange('plantillaNumber', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-amber-300 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-bold">Executive Designation</label>
                        <input
                          type="text"
                          value={formData.executiveDesignation}
                          onChange={(e) => handleChange('executiveDesignation', e.target.value)}
                          className="w-full bg-[#071522] border border-[#1d3c5c] rounded-lg p-2 text-slate-100 font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#1d3c5c] mt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-sky-600 hover:bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Committing Changes…
              </>
            ) : (
              <>✓ Commit Changes</>
            )}
          </button>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};
