// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// EditUserModal.tsx -- Comprehensive user profile and emergency credentials editor.
// Built with Universal Lambdas (=>), Katipuneros architecture, and DefaultFloatingModalCard.
// DO NOT mutate user email or unverified identity hashes.

import React, { useEffect, useState } from 'react';
import { DefaultFloatingModalCard, Button } from '@/Shared';
import { getUserDetail, updateUser, UserDetail, UserSummary, ResponderUnit } from '@/Endpoints/adminGovernanceApi';

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
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to populate existing profile details.');
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
      const payload: any = {
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
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to update user profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { key: 'info', label: '1. Identity & Contact', icon: '👤' },
    { key: 'address', label: '2. Residence & Address', icon: '📍' },
    { key: 'role', label: '3. Role & Status', icon: '🛡️' },
    { key: 'credentials', label: '4. Emergency Credentials', icon: '📜' },
  ] as const;

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit User Profile: ${user?.fullName || ''}`}
      subtitle="Modify account status, station assignment, contact information, and role credentials"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs text-slate-200">
        {isLoading && (
          <div className="p-8 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading profile parameters…
          </div>
        )}

        {errorText && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 font-medium">
            {errorText}
          </div>
        )}

        {!isLoading && (
          <>
            {/* Tab Header */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-950/50'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Info */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => handleChange('middleName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Surname *</label>
                  <input
                    type="text"
                    required
                    value={formData.surname}
                    onChange={(e) => handleChange('surname', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Suffix</label>
                  <input
                    type="text"
                    value={formData.suffix}
                    onChange={(e) => handleChange('suffix', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Sex</label>
                    <select
                      value={formData.sex}
                      onChange={(e) => handleChange('sex', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Blood Type</label>
                    <select
                      value={formData.bloodType}
                      onChange={(e) => handleChange('bloodType', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                    >
                      {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleChange('phoneNumber', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Resident / Employee ID</label>
                  <input
                    type="text"
                    value={formData.employeeOrResidentId}
                    onChange={(e) => handleChange('employeeOrResidentId', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Address & Emergency Contact */}
            {activeTab === 'address' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Province *</label>
                  <input
                    type="text"
                    required
                    value={formData.province}
                    onChange={(e) => handleChange('province', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">City / Municipality *</label>
                  <input
                    type="text"
                    required
                    value={formData.cityOrMunicipality}
                    onChange={(e) => handleChange('cityOrMunicipality', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Barangay *</label>
                  <select
                    value={formData.barangay}
                    onChange={(e) => handleChange('barangay', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  >
                    {DIPOLOG_BARANGAYS.map((brgy) => (
                      <option key={brgy} value={brgy}>{brgy}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Street / Purok</label>
                  <input
                    type="text"
                    value={formData.streetOrPurok}
                    onChange={(e) => handleChange('streetOrPurok', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>

                <div className="md:col-span-2 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-sky-400 mb-2 uppercase tracking-wider">
                    Emergency Contact Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Contact Person</label>
                      <input
                        type="text"
                        value={formData.emergencyContactName}
                        onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Contact Phone</label>
                      <input
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Relationship</label>
                      <select
                        value={formData.emergencyContactRelationship}
                        onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
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

            {/* Tab 3: Role & Status */}
            {activeTab === 'role' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Account Governance Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold"
                  >
                    <option value="Verified">Verified (Active / Authorized)</option>
                    <option value="Pending">Pending Approval</option>
                    <option value="Suspended">Suspended (Access Revoked)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">System Access Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-semibold"
                  >
                    <option value="Civilian">Civilian</option>
                    <option value="Responder">Responder</option>
                    <option value="LDRRMO_Admin">LDRRMO Admin</option>
                  </select>
                </div>

                {formData.role === 'Responder' && (
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Tactical Unit Agency</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => handleChange('unit', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-semibold text-sky-400"
                    >
                      <option value="RHU">RHU (City Health Office / Medical)</option>
                      <option value="FIRE">FIRE (Bureau of Fire Protection)</option>
                      <option value="PNP">PNP (Philippine National Police)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Station / Department</label>
                  <input
                    type="text"
                    value={formData.departmentOrBarangay}
                    onChange={(e) => handleChange('departmentOrBarangay', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Rank or Title</label>
                  <input
                    type="text"
                    value={formData.rankOrTitle}
                    onChange={(e) => handleChange('rankOrTitle', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>
            )}

            {/* Tab 4: Credentials */}
            {activeTab === 'credentials' && (
              <div className="space-y-3.5">
                {formData.role === 'Civilian' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Government ID Type</label>
                      <select
                        value={formData.governmentIdType}
                        onChange={(e) => handleChange('governmentIdType', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
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
                      <label className="block text-slate-400 mb-1 font-semibold">ID Card Number</label>
                      <input
                        type="text"
                        value={formData.governmentIdNumber}
                        onChange={(e) => handleChange('governmentIdNumber', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Residency Category</label>
                      <select
                        value={formData.residencyCategory}
                        onChange={(e) => handleChange('residencyCategory', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      >
                        <option value="Permanent">Permanent</option>
                        <option value="Transient">Transient</option>
                        <option value="Student">Student</option>
                        <option value="Displaced / Evacuee">Displaced / Evacuee</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Vulnerability Flags</label>
                      <select
                        value={formData.vulnerabilityFlags}
                        onChange={(e) => handleChange('vulnerabilityFlags', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      >
                        <option value="None">None</option>
                        <option value="Senior Citizen">Senior Citizen</option>
                        <option value="PWD">PWD</option>
                        <option value="Pregnant">Pregnant</option>
                        <option value="Solo Parent">Solo Parent</option>
                      </select>
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'RHU' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/60">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">PRC License Number</label>
                      <input
                        type="text"
                        value={formData.medicalLicenseNumber}
                        onChange={(e) => handleChange('medicalLicenseNumber', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Medical Cadre</label>
                      <select
                        value={formData.medicalCadre}
                        onChange={(e) => handleChange('medicalCadre', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      >
                        <option value="Physician">Physician</option>
                        <option value="Registered Nurse">Registered Nurse</option>
                        <option value="Paramedic">Paramedic</option>
                        <option value="First Responder">First Responder</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Health Station</label>
                      <input
                        type="text"
                        value={formData.stationHealthCenter}
                        onChange={(e) => handleChange('stationHealthCenter', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Ambulance Call Sign</label>
                      <input
                        type="text"
                        value={formData.ambulanceCallSign}
                        onChange={(e) => handleChange('ambulanceCallSign', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-slate-400 mb-1 font-semibold">Medical Certifications</label>
                      <input
                        type="text"
                        value={formData.medicalCertifications}
                        onChange={(e) => handleChange('medicalCertifications', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'FIRE' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-orange-950/30 border border-orange-900/60">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">BFP Firefighter Rank</label>
                      <select
                        value={formData.firefighterRank}
                        onChange={(e) => handleChange('firefighterRank', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
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
                      <label className="block text-slate-400 mb-1 font-semibold">BFP Badge Number</label>
                      <input
                        type="text"
                        value={formData.bfpBadgeNumber}
                        onChange={(e) => handleChange('bfpBadgeNumber', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Fire Station</label>
                      <input
                        type="text"
                        value={formData.fireStation}
                        onChange={(e) => handleChange('fireStation', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Apparatus Call Sign</label>
                      <input
                        type="text"
                        value={formData.apparatusCallSign}
                        onChange={(e) => handleChange('apparatusCallSign', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                  </div>
                )}

                {formData.role === 'Responder' && formData.unit === 'PNP' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-sky-950/30 border border-sky-900/60">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">PNP Police Rank</label>
                      <select
                        value={formData.policeRank}
                        onChange={(e) => handleChange('policeRank', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
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
                      <label className="block text-slate-400 mb-1 font-semibold">PNP Badge Number</label>
                      <input
                        type="text"
                        value={formData.pnpBadgeNumber}
                        onChange={(e) => handleChange('pnpBadgeNumber', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Sidearm Serial Number</label>
                      <input
                        type="text"
                        value={formData.sidearmSerial}
                        onChange={(e) => handleChange('sidearmSerial', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Precinct / Station</label>
                      <input
                        type="text"
                        value={formData.precinctOrStation}
                        onChange={(e) => handleChange('precinctOrStation', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                  </div>
                )}

                {formData.role === 'LDRRMO_Admin' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-amber-950/30 border border-amber-900/60">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Plantilla Number</label>
                      <input
                        type="text"
                        value={formData.plantillaNumber}
                        onChange={(e) => handleChange('plantillaNumber', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Executive Designation</label>
                      <input
                        type="text"
                        value={formData.executiveDesignation}
                        onChange={(e) => handleChange('executiveDesignation', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};
