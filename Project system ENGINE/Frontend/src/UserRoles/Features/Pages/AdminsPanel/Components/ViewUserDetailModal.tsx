// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// ViewUserDetailModal.tsx -- Comprehensive identity card and biometric preview modal for ResQTrack User Governance.
// Uses Universal Lambdas (=>), Katipuneros architecture, and DefaultFloatingModalCard.
// DO NOT mutate user profile state inside read-only inspection views.

import React, { useEffect, useState } from 'react';
import { DefaultFloatingModalCard, Button } from '@/Shared';
import { getUserDetail, UserDetail } from '@/Endpoints/adminGovernanceApi';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';

export interface ViewUserDetailModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (user: UserDetail) => void;
}

export const ViewUserDetailModal: React.FC<ViewUserDetailModalProps> = ({
  userId,
  isOpen,
  onClose,
  onEdit,
}) => {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxData, setLightboxData] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadDetail(userId);
    } else {
      setUser(null);
      setErrorMessage(null);
    }
  }, [isOpen, userId]);

  const loadDetail = async (id: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getUserDetail(id);
      setUser(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve detailed user profile.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return 'Not Provided';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const fmtDateTime = (iso?: string | null) => {
    if (!iso) return 'Not Provided';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // Clean Agency Badge Indicators (FIRE orange/red, PNP blue, RHU emerald, LDRRMO crimson/gold)
  const renderRoleBadge = (role: string, unit: string) => {
    if (role === 'LDRRMO_Admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-[#340313] text-amber-300 border border-amber-600/80 shadow-[0_0_12px_rgba(232,17,76,0.3)]">
          🏛️ LDRRMO Executive Command
        </span>
      );
    }
    if (role === 'Responder') {
      if (unit === 'RHU') {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-600/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            🚑 RHU Medical Responder
          </span>
        );
      }
      if (unit === 'FIRE') {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-orange-950/90 text-orange-300 border border-orange-600/80 shadow-[0_0_12px_rgba(249,115,22,0.3)]">
            🚒 FIRE (BFP Engine)
          </span>
        );
      }
      if (unit === 'PNP') {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-sky-950/90 text-sky-300 border border-sky-600/80 shadow-[0_0_12px_rgba(14,165,233,0.3)]">
            👮 PNP Sector Police
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-indigo-950/90 text-indigo-300 border border-indigo-600/80 shadow-[0_0_12px_rgba(99,102,241,0.3)]">
          🛡️ Tactical Responder
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-purple-950/80 text-purple-300 border border-purple-700/80 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
        👤 Civilian Resident
      </span>
    );
  };

  // Status Pill
  const renderStatusBadge = (status: string) => {
    if (status === 'Verified') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ACTIVE
        </span>
      );
    }
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-950/90 text-rose-300 border border-rose-600/80 shadow-[0_0_10px_rgba(244,63,94,0.25)]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          SUSPENDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-950/90 text-amber-300 border border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        PENDING
      </span>
    );
  };

  return (
    <>
      <DefaultFloatingModalCard
        isOpen={isOpen}
        onClose={onClose}
        title="Official Emergency Dossier & Telemetry"
        subtitle="Authoritative identity verification, biometric captures, and emergency credentials"
        maxWidth="4xl"
      >
        {isLoading && (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono">Loading secure user governance credentials from dispatch grid…</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-mono flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {!isLoading && user && (
          <div className="space-y-4 text-xs text-slate-200">
            {/* Top Identity Hero Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#071522] via-[#0a1a2b] to-[#0e243a] border border-[#1d3c5c] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-[#071522] border-2 border-[#1d3c5c] flex items-center justify-center text-2xl flex-shrink-0 shadow-lg text-sky-400 font-mono font-bold">
                  {user.role === 'LDRRMO_Admin' ? '🏛️' : user.role === 'Responder' ? (user.unit === 'RHU' ? '🚑' : user.unit === 'FIRE' ? '🚒' : '👮') : '👤'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-white tracking-wide font-display">{user.fullName}</h3>
                    {renderStatusBadge(user.status)}
                    {user.faceVerified && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 font-bold font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Face Verified
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] mt-1 flex items-center gap-3 flex-wrap">
                    <span>{user.email}</span>
                    <span>•</span>
                    <span className="text-sky-400 font-semibold">ID: {user.employeeOrResidentId || 'N/A'}</span>
                    {user.rankOrTitle && (
                      <>
                        <span>•</span>
                        <span className="text-slate-300 font-semibold">{user.rankOrTitle}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {renderRoleBadge(user.role, user.unit)}
              </div>
            </div>

            {/* Biometric & Government ID Capture Previews with Tactical HUD styling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ID Capture */}
              <div className="p-3.5 rounded-xl bg-[#071522] border border-[#1d3c5c] space-y-2 shadow-lg">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-xs">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-sky-400 uppercase tracking-wider">
                    <span>🪪</span> Official Government ID
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-[#0a1a2b] px-2 py-0.5 rounded border border-[#1d3c5c]">
                    {user.governmentIdType || 'National ID / LTO'}
                  </span>
                </div>
                <div className="h-48 rounded-lg overflow-hidden bg-[#0a1a2b] border border-[#1d3c5c] flex items-center justify-center relative group">
                  <img
                    src={`/api/users/${user.id}/captures/id`}
                    alt="Government ID"
                    className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-105"
                    onClick={() => setLightboxData({
                      url: `/api/users/${user.id}/captures/id`,
                      title: `${user.fullName} - Government ID (${user.governmentIdType || 'Valid ID'})`
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxData({
                      url: `/api/users/${user.id}/captures/id`,
                      title: `${user.fullName} - Government ID (${user.governmentIdType || 'Valid ID'})`
                    })}
                    className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-[10px] font-mono text-white backdrop-blur-md cursor-pointer border border-white/20 transition-all flex items-center gap-1.5"
                  >
                    <span>🔍</span> Enlarge ID
                  </button>
                </div>
              </div>

              {/* Face Biometric */}
              <div className="p-3.5 rounded-xl bg-[#071522] border border-[#1d3c5c] space-y-2 shadow-lg">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-xs">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 uppercase tracking-wider">
                    <span>👤</span> Anti-Spoofing Biometric
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    {user.faceVerified ? 'Passed Laplacian Liveness' : 'Pending Verification'}
                  </span>
                </div>
                <div className="h-48 rounded-lg overflow-hidden bg-[#0a1a2b] border border-[#1d3c5c] flex items-center justify-center relative group">
                  <img
                    src={`/api/users/${user.id}/captures/face`}
                    alt="Live Face Biometric"
                    className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-105"
                    onClick={() => setLightboxData({
                      url: `/api/users/${user.id}/captures/face`,
                      title: `${user.fullName} - Live Face Biometric Capture`
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxData({
                      url: `/api/users/${user.id}/captures/face`,
                      title: `${user.fullName} - Live Face Biometric Capture`
                    })}
                    className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-[10px] font-mono text-white backdrop-blur-md cursor-pointer border border-white/20 transition-all flex items-center gap-1.5"
                  >
                    <span>🔍</span> Enlarge Face
                  </button>
                </div>
              </div>
            </div>

            {/* Granular Profile Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personal & Vitals */}
              <div className="p-3.5 rounded-xl bg-[#071522] border border-[#1d3c5c] space-y-2.5 shadow-md">
                <h4 className="font-bold text-sky-400 uppercase tracking-wider font-mono text-[11px] flex items-center gap-1.5 border-b border-[#1d3c5c] pb-1.5">
                  <span>📋</span> Personal & Vital Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Sex:</span>
                    <span className="font-semibold text-slate-200">{user.sex || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Blood Type:</span>
                    <span className="font-black text-rose-400 font-mono text-sm">{user.bloodType || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Date of Birth:</span>
                    <span className="font-mono text-slate-200">{fmtDate(user.dateOfBirth)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Phone Telemetry:</span>
                    <span className="font-mono text-slate-200">{user.phoneNumber || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Philippine Address */}
              <div className="p-3.5 rounded-xl bg-[#071522] border border-[#1d3c5c] space-y-2.5 shadow-md">
                <h4 className="font-bold text-sky-400 uppercase tracking-wider font-mono text-[11px] flex items-center gap-1.5 border-b border-[#1d3c5c] pb-1.5">
                  <span>📍</span> Registered Residence Sector
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Full Residence Address:</span>
                    <span className="font-medium text-slate-100">{user.fullAddress || `${user.streetOrPurok || ''}, ${user.barangay}, ${user.cityOrMunicipality}, ${user.province}`}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-mono text-[10px] uppercase block">Barangay:</span>
                      <span className="font-bold text-sky-300 font-mono">{user.barangay}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-mono text-[10px] uppercase block">City & Province:</span>
                      <span className="font-semibold text-slate-200">{user.cityOrMunicipality}, {user.province}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-3.5 rounded-xl bg-[#071522] border border-amber-900/60 space-y-2.5 shadow-md">
                <h4 className="font-bold text-amber-300 uppercase tracking-wider font-mono text-[11px] flex items-center gap-1.5 border-b border-amber-900/60 pb-1.5">
                  <span>🚨</span> Emergency Contact (Next of Kin)
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="col-span-2">
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Contact Name:</span>
                    <span className="font-bold text-slate-100">{user.emergencyContactName || 'None Listed'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Relationship:</span>
                    <span className="font-medium text-slate-200">{user.emergencyContactRelationship || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Emergency Phone:</span>
                    <span className="font-mono text-amber-300 font-bold">{user.emergencyContactPhone || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Station & Agency Allocation */}
              <div className="p-3.5 rounded-xl bg-[#071522] border border-[#1d3c5c] space-y-2.5 shadow-md">
                <h4 className="font-bold text-sky-400 uppercase tracking-wider font-mono text-[11px] flex items-center gap-1.5 border-b border-[#1d3c5c] pb-1.5">
                  <span>🛡️</span> Agency & Station Assignment
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Role / Unit:</span>
                    <span className="font-semibold text-slate-200">{user.role} {user.unit !== 'None' ? `(${user.unit})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Rank / Title:</span>
                    <span className="font-medium text-slate-200">{user.rankOrTitle || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Station or Sector:</span>
                    <span className="font-medium text-slate-200">{user.departmentOrBarangay || 'Central Dispatch'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Role-Specific Structured Emergency Badges Panel */}
            <div className="p-4 rounded-xl bg-[#0a1a2b] border border-[#1d3c5c] space-y-3 shadow-lg">
              <h4 className="font-bold text-sky-300 uppercase tracking-wider font-mono text-[11px] flex items-center gap-2 border-b border-[#1d3c5c] pb-2">
                <span>📜</span> Specific Philippine Emergency Registry Badges
              </h4>

              {user.role === 'Civilian' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Gov ID Type:</span>
                    <span className="font-semibold text-slate-200">{user.governmentIdType || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">ID Number:</span>
                    <span className="font-mono text-slate-200">{user.governmentIdNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Residency Category:</span>
                    <span className="font-medium text-slate-200">{user.residencyCategory || 'Permanent'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Priority / Vulnerability:</span>
                    <span className="font-bold text-amber-400 font-mono">{user.vulnerabilityFlags || 'None'}</span>
                  </div>
                </div>
              )}

              {user.role === 'Responder' && user.unit === 'RHU' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">PRC Medical License:</span>
                    <span className="font-mono text-emerald-400 font-bold">{user.medicalLicenseNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Medical Cadre:</span>
                    <span className="font-medium text-slate-200">{user.medicalCadre || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Ambulance Call Sign:</span>
                    <span className="font-mono text-emerald-300 font-bold">{user.ambulanceCallSign || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Health Center Station:</span>
                    <span className="font-medium text-slate-200">{user.stationHealthCenter || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Medical Certifications:</span>
                    <span className="font-medium text-slate-200 font-mono">{user.medicalCertifications || '—'}</span>
                  </div>
                </div>
              )}

              {user.role === 'Responder' && user.unit === 'FIRE' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">BFP Firefighter Rank:</span>
                    <span className="font-bold text-orange-400 font-mono">{user.firefighterRank || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">BFP Badge Number:</span>
                    <span className="font-mono text-orange-300 font-bold">{user.bfpBadgeNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Apparatus Call Sign:</span>
                    <span className="font-mono text-orange-300 font-bold">{user.apparatusCallSign || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Assigned Fire Station:</span>
                    <span className="font-medium text-slate-200">{user.fireStation || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Fire Specialization:</span>
                    <span className="font-medium text-slate-200">{user.fireSpecialization || '—'}</span>
                  </div>
                </div>
              )}

              {user.role === 'Responder' && user.unit === 'PNP' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">PNP Police Rank:</span>
                    <span className="font-bold text-sky-400 font-mono">{user.policeRank || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">PNP Badge Number:</span>
                    <span className="font-mono text-sky-300 font-bold">{user.pnpBadgeNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Sidearm Serial:</span>
                    <span className="font-mono text-rose-300 font-bold">{user.sidearmSerial || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Precinct / Station:</span>
                    <span className="font-medium text-slate-200">{user.precinctOrStation || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Police Assignment:</span>
                    <span className="font-medium text-slate-200">{user.policeAssignment || '—'}</span>
                  </div>
                </div>
              )}

              {user.role === 'LDRRMO_Admin' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">LGU Plantilla Number:</span>
                    <span className="font-mono text-amber-300 font-bold">{user.plantillaNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Executive Designation:</span>
                    <span className="font-semibold text-slate-100">{user.executiveDesignation || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono text-[10px] uppercase block">Security Clearance:</span>
                    <span className="font-semibold text-sky-400 font-mono">{user.clearanceLevel || 'Level 2'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Audit & Compliance Footnote */}
            <div className="flex flex-col md:flex-row md:items-center justify-between text-[10px] font-mono text-slate-400 p-3 rounded-lg bg-[#071522] border border-[#1d3c5c] gap-2">
              <div>Created: {fmtDateTime(user.createdAt)} · Last Synchronized: {fmtDateTime(user.updatedAt)}</div>
              <div>
                Status: {user.isDeleted ? (
                  <span className="text-rose-400 font-bold">Soft-Deleted on {fmtDateTime(user.deletedAt)} by {user.deletedBy}</span>
                ) : (
                  <span className="text-emerald-400 font-semibold">Authoritative Database Record</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1d3c5c]">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close Dossier
          </Button>
          {user && onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(user);
              }}
              className="px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-sky-600 hover:bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Official Profile
            </button>
          )}
        </div>
      </DefaultFloatingModalCard>

      {/* Lightbox for Zooming Captures */}
      <ImageLightboxModal
        isOpen={lightboxData !== null}
        onClose={() => setLightboxData(null)}
        imageUrl={lightboxData?.url}
        title={lightboxData?.title}
      />
    </>
  );
};
