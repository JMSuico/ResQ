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
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to retrieve detailed user profile.');
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

  const getRoleBadgeStyle = (role: string, unit: string) => {
    if (role === 'LDRRMO_Admin') return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
    if (role === 'Responder') {
      if (unit === 'RHU') return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
      if (unit === 'FIRE') return 'bg-orange-950/80 text-orange-300 border-orange-800/80';
      if (unit === 'PNP') return 'bg-sky-950/80 text-sky-300 border-sky-800/80';
      return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
    }
    return 'bg-purple-950/80 text-purple-300 border-purple-800/80';
  };

  const getStatusBadgeStyle = (status: string) => {
    if (status === 'Verified') return 'bg-emerald-950/80 text-emerald-400 border-emerald-800';
    if (status === 'Suspended') return 'bg-rose-950/80 text-rose-400 border-rose-800';
    return 'bg-amber-950/80 text-amber-400 border-amber-800';
  };

  return (
    <>
      <DefaultFloatingModalCard
        isOpen={isOpen}
        onClose={onClose}
        title="Emergency Personnel & Resident Profile"
        subtitle="Granular Philippine emergency credentials, biometric captures, and audit history"
        maxWidth="4xl"
      >
        {isLoading && (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Loading secure user governance credentials…</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {!isLoading && user && (
          <div className="space-y-4 text-xs text-slate-200">
            {/* Top Identity Hero Card */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg">
                  {user.role === 'LDRRMO_Admin' ? '🏛️' : user.role === 'Responder' ? (user.unit === 'RHU' ? '🚑' : user.unit === 'FIRE' ? '🚒' : '👮') : '👤'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white tracking-wide">{user.fullName}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getStatusBadgeStyle(user.status)}`}>
                      {user.status}
                    </span>
                    {user.faceVerified && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Face Verified
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] mt-0.5 flex items-center gap-3 flex-wrap">
                    <span>{user.email}</span>
                    <span>•</span>
                    <span className="text-sky-400">ID: {user.employeeOrResidentId || 'N/A'}</span>
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
                <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${getRoleBadgeStyle(user.role, user.unit)}`}>
                  {user.role === 'Responder' ? `${user.unit} Tactical Responder` : user.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Biometric & Government ID Capture Previews */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>🪪</span> Official Government ID Capture
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {user.governmentIdType || 'National ID / LTO'}
                  </span>
                </div>
                <div className="h-44 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center relative group">
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
                    className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/75 hover:bg-black text-[10px] text-white backdrop-blur-sm cursor-pointer"
                  >
                    Enlarge ID
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>👤</span> Live Biometric Anti-Spoofing Capture
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {user.faceVerified ? 'Passed Laplacian Liveness' : 'Pending Verification'}
                  </span>
                </div>
                <div className="h-44 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center relative group">
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
                    className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/75 hover:bg-black text-[10px] text-white backdrop-blur-sm cursor-pointer"
                  >
                    Enlarge Face
                  </button>
                </div>
              </div>
            </div>

            {/* Granular Profile Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personal & Contact */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <h4 className="font-bold text-sky-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span>📋</span> Personal & Vital Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Sex:</span>
                    <span className="font-medium text-slate-200">{user.sex || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Blood Type:</span>
                    <span className="font-bold text-rose-400">{user.bloodType || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Date of Birth:</span>
                    <span className="font-medium text-slate-200">{fmtDate(user.dateOfBirth)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Phone Number:</span>
                    <span className="font-mono text-slate-200">{user.phoneNumber || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Philippine Address */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <h4 className="font-bold text-sky-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span>📍</span> Registered Philippine Address
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Full Residence Address:</span>
                    <span className="font-medium text-slate-100">{user.fullAddress || `${user.streetOrPurok || ''}, ${user.barangay}, ${user.cityOrMunicipality}, ${user.province}`}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Barangay:</span>
                      <span className="font-medium text-slate-200">{user.barangay}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">City & Province:</span>
                      <span className="font-medium text-slate-200">{user.cityOrMunicipality}, {user.province}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span>🚨</span> Emergency Contact (Next of Kin)
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Contact Name:</span>
                    <span className="font-semibold text-slate-100">{user.emergencyContactName || 'None Listed'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Relationship:</span>
                    <span className="font-medium text-slate-200">{user.emergencyContactRelationship || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Emergency Phone:</span>
                    <span className="font-mono text-amber-300">{user.emergencyContactPhone || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Station & Agency Allocation */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <h4 className="font-bold text-sky-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span>🛡️</span> Agency & Station Assignment
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Role / Unit:</span>
                    <span className="font-semibold text-slate-200">{user.role} {user.unit !== 'None' ? `(${user.unit})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Rank / Title:</span>
                    <span className="font-medium text-slate-200">{user.rankOrTitle || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Department or Station:</span>
                    <span className="font-medium text-slate-200">{user.departmentOrBarangay || 'Central Dispatch'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Role-Specific Granular Credentials Panel */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h4 className="font-bold text-sky-300 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <span>📜</span> Specific Philippine Emergency Registry Credentials
              </h4>

              {user.role === 'Civilian' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Gov ID Type:</span>
                    <span className="font-semibold text-slate-200">{user.governmentIdType || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ID Number:</span>
                    <span className="font-mono text-slate-200">{user.governmentIdNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Residency Category:</span>
                    <span className="font-medium text-slate-200">{user.residencyCategory || 'Permanent'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Priority / Vulnerability:</span>
                    <span className="font-semibold text-amber-400">{user.vulnerabilityFlags || 'None'}</span>
                  </div>
                </div>
              )}

              {user.role === 'Responder' && user.unit === 'RHU' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">PRC Medical License:</span>
                    <span className="font-mono text-emerald-400 font-bold">{user.medicalLicenseNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Medical Cadre:</span>
                    <span className="font-medium text-slate-200">{user.medicalCadre || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ambulance Call Sign:</span>
                    <span className="font-mono text-emerald-300 font-bold">{user.ambulanceCallSign || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Health Center Station:</span>
                    <span className="font-medium text-slate-200">{user.stationHealthCenter || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Medical Certifications:</span>
                    <span className="font-medium text-slate-200">{user.medicalCertifications || '—'}</span>
                  </div>
                </div>
              )}

              {user.role === 'Responder' && user.unit === 'FIRE' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">BFP Firefighter Rank:</span>
                    <span className="font-bold text-orange-400">{user.firefighterRank || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">BFP Badge Number:</span>
                    <span className="font-mono text-slate-200">{user.bfpBadgeNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Apparatus Call Sign:</span>
                    <span className="font-mono text-orange-300 font-bold">{user.apparatusCallSign || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Assigned Fire Station:</span>
                    <span className="font-medium text-slate-200">{user.fireStation || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Fire Specialization:</span>
                    <span className="font-medium text-slate-200">{user.fireSpecialization || '—'}</span>
                  </div>
                </div>
              )}

              {user.role === 'Responder' && user.unit === 'PNP' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">PNP Police Rank:</span>
                    <span className="font-bold text-sky-400">{user.policeRank || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">PNP Badge Number:</span>
                    <span className="font-mono text-slate-200">{user.pnpBadgeNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Sidearm Serial:</span>
                    <span className="font-mono text-rose-300">{user.sidearmSerial || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Precinct / Station:</span>
                    <span className="font-medium text-slate-200">{user.precinctOrStation || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Police Assignment:</span>
                    <span className="font-medium text-slate-200">{user.policeAssignment || '—'}</span>
                  </div>
                </div>
              )}

              {user.role === 'LDRRMO_Admin' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">LGU Plantilla Number:</span>
                    <span className="font-mono text-amber-300 font-bold">{user.plantillaNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Executive Designation:</span>
                    <span className="font-semibold text-slate-100">{user.executiveDesignation || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Clearance Level:</span>
                    <span className="font-semibold text-sky-400">{user.clearanceLevel || 'Level 2'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Audit & Compliance Footnote */}
            <div className="flex flex-col md:flex-row md:items-center justify-between text-[10px] text-slate-500 p-3 rounded-lg bg-slate-950/40 border border-slate-900 gap-2">
              <div>Created: {fmtDateTime(user.createdAt)} · Last Updated: {fmtDateTime(user.updatedAt)}</div>
              <div>Soft-Delete Status: {user.isDeleted ? <span className="text-rose-400 font-bold">Deleted on {fmtDateTime(user.deletedAt)} by {user.deletedBy}</span> : <span className="text-emerald-400 font-semibold">Active Record</span>}</div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          {user && onEdit && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(user);
              }}
            >
              Edit User Profile
            </Button>
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
