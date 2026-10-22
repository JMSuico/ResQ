// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// AddUserModal.tsx -- Comprehensive multi-step registration modal for ResQTrack emergency personnel and residents.
// Supports full Philippine emergency credentials, Universal Lambdas (=>), and Katipuneros architecture.
// DO NOT expose cleartext credentials or omit required backend DTO attributes.

import React, { useState } from 'react';
import { DefaultFloatingModalCard, Button } from '@/Shared';
import { createUser, ResponderUnit } from '@/Endpoints/adminGovernanceApi';

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
      const payload: any = {
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
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to create user account. Please check values.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { key: 'personal', label: '1. Personal & Contact', icon: '👤' },
    { key: 'address', label: '2. Philippine Address', icon: '📍' },
    { key: 'role', label: '3. Role & Station', icon: '🛡️' },
    { key: 'credentials', label: '4. Credentials', icon: '📜' },
    { key: 'account', label: '5. Account Setup', icon: '🔐' },
  ] as const;

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Register Emergency Personnel or Resident"
      subtitle="Provision authenticated accounts with Philippine emergency identity attributes"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs text-slate-200">
        {errorText && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 flex items-start gap-2">
            <svg className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 font-medium">{errorText}</div>
          </div>
        )}

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

        {/* Tab 1: Personal & Contact */}
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="e.g. Juan"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Middle Name</label>
              <input
                type="text"
                value={formData.middleName}
                onChange={(e) => handleChange('middleName', e.target.value)}
                placeholder="e.g. Santos"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Surname *</label>
              <input
                type="text"
                required
                value={formData.surname}
                onChange={(e) => handleChange('surname', e.target.value)}
                placeholder="e.g. Dela Cruz"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Suffix</label>
              <input
                type="text"
                value={formData.suffix}
                onChange={(e) => handleChange('suffix', e.target.value)}
                placeholder="e.g. Jr., Sr., III"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Sex</label>
                <select
                  value={formData.sex}
                  onChange={(e) => handleChange('sex', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Mobile Phone Number</label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                placeholder="e.g. +63 917 123 4567"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Resident / Employee ID</label>
              <input
                type="text"
                value={formData.employeeOrResidentId}
                onChange={(e) => handleChange('employeeOrResidentId', e.target.value)}
                placeholder="Auto-generated if left empty"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-sky-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <span>🚨</span> Philippine Emergency Contact Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Emergency Contact Person</label>
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                    placeholder="Full name of contact"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                    placeholder="e.g. +63 920 987 6543"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Relationship</label>
                  <select
                    value={formData.emergencyContactRelationship}
                    onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
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
              <label className="block text-slate-400 mb-1 font-semibold">Province *</label>
              <input
                type="text"
                required
                value={formData.province}
                onChange={(e) => handleChange('province', e.target.value)}
                placeholder="e.g. Zamboanga del Norte"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">City / Municipality *</label>
              <input
                type="text"
                required
                value={formData.cityOrMunicipality}
                onChange={(e) => handleChange('cityOrMunicipality', e.target.value)}
                placeholder="e.g. Dipolog City"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Barangay *</label>
              <select
                value={formData.barangay}
                onChange={(e) => handleChange('barangay', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                {DIPOLOG_BARANGAYS.map((brgy) => (
                  <option key={brgy} value={brgy}>{brgy}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Street / Purok / Sitio</label>
              <input
                type="text"
                value={formData.streetOrPurok}
                onChange={(e) => handleChange('streetOrPurok', e.target.value)}
                placeholder="e.g. Purok Bougainvillea, Gen. Luna St."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-bold text-sky-400">Note: </span>
              Accurate barangay mapping links user incident dispatches and localized evacuation alerts to the LDRRMO Early Warning Command system.
            </div>
          </div>
        )}

        {/* Tab 3: Role & Station */}
        {activeTab === 'role' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">System Access Role *</label>
              <select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none font-semibold"
              >
                <option value="Civilian">Civilian (UG Resident / Community)</option>
                <option value="Responder">Responder (First Responder / Tactical Unit)</option>
                <option value="LDRRMO_Admin">LDRRMO Admin (Executive & Operations)</option>
              </select>
            </div>

            {formData.role === 'Responder' ? (
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Responder Unit Agency *</label>
                <select
                  value={formData.unit}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none font-semibold text-sky-400"
                >
                  <option value="RHU">RHU (City Health Office & Medical Response)</option>
                  <option value="FIRE">FIRE (Bureau of Fire Protection - BFP)</option>
                  <option value="PNP">PNP (Philippine National Police - Tactical)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Unit Allocation</label>
                <input
                  type="text"
                  disabled
                  value="None (Standard Community / Central Command)"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 text-slate-500 cursor-not-allowed"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Station / Department / Barangay</label>
              <input
                type="text"
                value={formData.departmentOrBarangay}
                onChange={(e) => handleChange('departmentOrBarangay', e.target.value)}
                placeholder="e.g. Central Fire Station, CPS Dipolog, Brgy Hall"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Rank or Title</label>
              <input
                type="text"
                value={formData.rankOrTitle}
                onChange={(e) => handleChange('rankOrTitle', e.target.value)}
                placeholder="e.g. Lead Paramedic, FO2, Pat, Admin Officer"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Tab 4: Role-Specific Emergency Credentials */}
        {activeTab === 'credentials' && (
          <div className="space-y-3.5">
            {formData.role === 'Civilian' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="md:col-span-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                  Civilian Resident Verification Data
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Government ID Type</label>
                  <select
                    value={formData.governmentIdType}
                    onChange={(e) => handleChange('governmentIdType', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
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
                  <label className="block text-slate-400 mb-1 font-semibold">Government ID Card Number</label>
                  <input
                    type="text"
                    value={formData.governmentIdNumber}
                    onChange={(e) => handleChange('governmentIdNumber', e.target.value)}
                    placeholder="e.g. 1234-5678-9012-3456"
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
                    <option value="Permanent">Permanent Resident</option>
                    <option value="Transient">Transient / Temporary</option>
                    <option value="Student">Student / Boarder</option>
                    <option value="Displaced / Evacuee">Displaced / Evacuee</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Vulnerability / Priority Flags</label>
                  <select
                    value={formData.vulnerabilityFlags}
                    onChange={(e) => handleChange('vulnerabilityFlags', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
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
            )}

            {formData.role === 'Responder' && formData.unit === 'RHU' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/60">
                <div className="md:col-span-2 text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>🚑</span> Rural Health Unit (RHU) Tactical Credentials
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">PRC Medical License Number</label>
                  <input
                    type="text"
                    value={formData.medicalLicenseNumber}
                    onChange={(e) => handleChange('medicalLicenseNumber', e.target.value)}
                    placeholder="e.g. PRC-0189421"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Medical Cadre / Specialization</label>
                  <select
                    value={formData.medicalCadre}
                    onChange={(e) => handleChange('medicalCadre', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  >
                    <option value="Physician">Medical Doctor / Physician</option>
                    <option value="Registered Nurse">Emergency Nurse (RN)</option>
                    <option value="Paramedic">Emergency Medical Technician (EMT / Paramedic)</option>
                    <option value="Medical Technologist">Medical Technologist</option>
                    <option value="First Responder">First Aid Responder / BHW</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Health Center Station</label>
                  <input
                    type="text"
                    value={formData.stationHealthCenter}
                    onChange={(e) => handleChange('stationHealthCenter', e.target.value)}
                    placeholder="e.g. Dipolog CHO Main, RHU Barra"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Ambulance Call Sign</label>
                  <input
                    type="text"
                    value={formData.ambulanceCallSign}
                    onChange={(e) => handleChange('ambulanceCallSign', e.target.value)}
                    placeholder="e.g. RHU-MED1, AMB-04"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Medical Certifications</label>
                  <input
                    type="text"
                    value={formData.medicalCertifications}
                    onChange={(e) => handleChange('medicalCertifications', e.target.value)}
                    placeholder="e.g. BLS, ACLS, PHTLS, Mass Casualty Triage"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>
            )}

            {formData.role === 'Responder' && formData.unit === 'FIRE' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-orange-950/30 border border-orange-900/60">
                <div className="md:col-span-2 text-orange-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>🚒</span> Bureau of Fire Protection (BFP) Credentials
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">BFP Firefighter Rank</label>
                  <select
                    value={formData.firefighterRank}
                    onChange={(e) => handleChange('firefighterRank', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
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
                  <label className="block text-slate-400 mb-1 font-semibold">BFP Badge / Account Number</label>
                  <input
                    type="text"
                    value={formData.bfpBadgeNumber}
                    onChange={(e) => handleChange('bfpBadgeNumber', e.target.value)}
                    placeholder="e.g. BFP-982103"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Assigned Fire Station</label>
                  <input
                    type="text"
                    value={formData.fireStation}
                    onChange={(e) => handleChange('fireStation', e.target.value)}
                    placeholder="e.g. Dipolog Central Fire Station"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Apparatus / Vehicle Call Sign</label>
                  <input
                    type="text"
                    value={formData.apparatusCallSign}
                    onChange={(e) => handleChange('apparatusCallSign', e.target.value)}
                    placeholder="e.g. ENGINE-1, LADDER-1, TANKER-2"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Specialization</label>
                  <select
                    value={formData.fireSpecialization}
                    onChange={(e) => handleChange('fireSpecialization', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  >
                    <option value="Structural Firefighting">Structural Firefighting</option>
                    <option value="Hazardous Materials (HazMat)">Hazardous Materials (HazMat)</option>
                    <option value="Urban Search and Rescue (USAR)">Urban Search and Rescue (USAR)</option>
                    <option value="Water Rescue & Floods">Water Rescue & Floods</option>
                    <option value="High-Angle Rope Rescue">High-Angle Rope Rescue</option>
                  </select>
                </div>
              </div>
            )}

            {formData.role === 'Responder' && formData.unit === 'PNP' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-sky-950/30 border border-sky-900/60">
                <div className="md:col-span-2 text-sky-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>👮</span> Philippine National Police (PNP) Credentials
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">PNP Police Rank</label>
                  <select
                    value={formData.policeRank}
                    onChange={(e) => handleChange('policeRank', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
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
                  <label className="block text-slate-400 mb-1 font-semibold">PNP Badge / Plantilla ID</label>
                  <input
                    type="text"
                    value={formData.pnpBadgeNumber}
                    onChange={(e) => handleChange('pnpBadgeNumber', e.target.value)}
                    placeholder="e.g. PNP-448102"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Precinct / Police Station</label>
                  <input
                    type="text"
                    value={formData.precinctOrStation}
                    onChange={(e) => handleChange('precinctOrStation', e.target.value)}
                    placeholder="e.g. Dipolog CPS Central, Station 1"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Assignment / Sector</label>
                  <input
                    type="text"
                    value={formData.policeAssignment}
                    onChange={(e) => handleChange('policeAssignment', e.target.value)}
                    placeholder="e.g. Beat Patrol, Traffic, Tactical Response"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Sidearm Serial Number</label>
                  <input
                    type="text"
                    value={formData.sidearmSerial}
                    onChange={(e) => handleChange('sidearmSerial', e.target.value)}
                    placeholder="e.g. GLOCK17-SN-9281734"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>
            )}

            {formData.role === 'LDRRMO_Admin' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-amber-950/30 border border-amber-900/60">
                <div className="md:col-span-2 text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏛️</span> LDRRMO Administrative Governance Credentials
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">LGU Plantilla Number</label>
                  <input
                    type="text"
                    value={formData.plantillaNumber}
                    onChange={(e) => handleChange('plantillaNumber', e.target.value)}
                    placeholder="e.g. LGU-PLANTILLA-2026-084"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Executive Designation</label>
                  <input
                    type="text"
                    value={formData.executiveDesignation}
                    onChange={(e) => handleChange('executiveDesignation', e.target.value)}
                    placeholder="e.g. Operations Officer, CDRRMO Chief"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Security Clearance Level</label>
                  <select
                    value={formData.clearanceLevel}
                    onChange={(e) => handleChange('clearanceLevel', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 font-semibold"
                  >
                    <option value="Level 1 - Field Tactical">Level 1 - Field Tactical Operations</option>
                    <option value="Level 2 - Tactical Operations">Level 2 - Operations Center Tactical</option>
                    <option value="Level 3 - Executive Command Authority">Level 3 - Executive Command Authority</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Account Setup */}
        {activeTab === 'account' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Official Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="e.g. user@resqtrack.gov.ph"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Initial Password * (Min 12 characters)</label>
              <input
                type="password"
                required
                minLength={12}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-bold text-sky-400">Security Governance Policy:</div>
              <div>• Minimum 12 alphanumeric characters with special symbols required.</div>
              <div>• Upon initial logon, biometric anti-spoofing verification and valid ID capture may be enforced.</div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
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
                Previous Step
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
                Next Step →
              </Button>
            ) : (
              <Button
                type="submit"
                variant="action-green"
                size="sm"
                isLoading={isSubmitting}
              >
                Save & Register User
              </Button>
            )}
          </div>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};
