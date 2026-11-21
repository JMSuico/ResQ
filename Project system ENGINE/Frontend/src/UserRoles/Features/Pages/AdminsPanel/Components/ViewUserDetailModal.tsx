// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// ViewUserDetailModal.tsx -- Comprehensive identity card and biometric preview modal for ResQTrack User Governance.
// Stitch Warm Ivory (#F7F1EA) + Soft Beige (#E9D9D0) + Cherry (#670626) claymorphic styling.
// Zero tel: links; phoneNumber / emergencyContactPhone rendered as plain text only.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useEffect, useState } from 'react';
import {
  User,
  MapPin,
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  HeartPulse,
  Flame,
  ShieldAlert,
  Phone,
  Building2,
  Eye,
  Sliders,
  UserCheck
} from 'lucide-react';
import { getUserDetail, UserDetail } from '@/Endpoints/adminGovernanceApi';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { AdminButton } from '../Shared/AdminButton';
import { AdminModalCard } from '../Shared/AdminModalCard';
import { CLAY_WELL } from '../Shared/adminCommandHelpers';

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
  onEdit
}) => {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxData, setLightboxData] = useState<{ url: string; title: string } | null>(null);

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

  useEffect(() => {
    if (isOpen && userId) {
      void loadDetail(userId);
    } else {
      setUser(null);
      setErrorMessage(null);
    }
  }, [isOpen, userId]);

  const fmtDate = (iso?: string | null): string => {
    if (!iso) return 'Not Provided';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  const fmtDateTime = (iso?: string | null): string => {
    if (!iso) return 'Not Provided';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const renderRoleBadge = (role: string, unit: string) => {
    if (role === 'LDRRMO_Admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase bg-[#670626] text-[#F7F1EA]">
          <Building2 className="w-3.5 h-3.5" />
          LDRRMO Executive Command
        </span>
      );
    }
    if (role === 'Responder') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase bg-[#A83B4D] text-[#F7F1EA]">
          {unit === 'RHU' ? <HeartPulse className="w-3.5 h-3.5" /> : unit === 'FIRE' ? <Flame className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
          {unit} Responder
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase bg-[#F7F1EA] text-[#670626] border border-[#670626]/25">
        <User className="w-3.5 h-3.5" />
        Civilian Resident
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'Verified') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-700/30">
          ACTIVE
        </span>
      );
    }
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase bg-[#670626] text-[#F7F1EA]">
          SUSPENDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase bg-amber-100 text-amber-900 border border-amber-700/30">
        PENDING
      </span>
    );
  };

  const renderHeroIcon = () => {
    if (!user) return <User className="w-7 h-7 text-[#670626]" />;
    if (user.role === 'LDRRMO_Admin') return <Building2 className="w-7 h-7 text-[#670626]" />;
    if (user.role === 'Responder') {
      if (user.unit === 'RHU') return <HeartPulse className="w-7 h-7 text-emerald-700" />;
      if (user.unit === 'FIRE') return <Flame className="w-7 h-7 text-orange-700" />;
      return <ShieldAlert className="w-7 h-7 text-sky-700" />;
    }
    return <User className="w-7 h-7 text-[#A83B4D]" />;
  };

  return (
    <>
      <AdminModalCard
        isOpen={isOpen}
        onClose={onClose}
        title="User Details"
        subtitle="Identity profile, captures, and credentials"
        maxWidth="4xl"
      >
        {isLoading && (
          <div className="p-12 text-center text-[#A83B4D] space-y-3">
            <Loader2 className="w-8 h-8 text-[#670626] animate-spin mx-auto" />
            <p className="text-sm font-mono">Loading user details…</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-[#670626] text-[#F7F1EA] text-sm font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!isLoading && user && (
          <div className="space-y-4 text-sm text-[#670626]">
            <div className={`${CLAY_WELL} p-4 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-[#F7F1EA] border border-[#670626]/20 flex items-center justify-center flex-shrink-0">
                  {renderHeroIcon()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-[#670626]">{user.fullName}</h3>
                    {renderStatusBadge(user.status)}
                    {user.faceVerified && (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-700/30 font-bold font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Live Face Verified
                      </span>
                    )}
                  </div>
                  <div className="text-[#A83B4D] font-mono text-xs mt-1 flex items-center gap-3 flex-wrap">
                    <span>{user.email}</span>
                    <span>•</span>
                    <span className="font-bold text-[#670626]">ID: {user.employeeOrResidentId || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div>{renderRoleBadge(user.role, user.unit)}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`${CLAY_WELL} p-4 space-y-2.5`}>
                <div className="flex items-center justify-between font-semibold text-xs">
                  <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-[#670626]">
                    <FileText className="w-4 h-4 text-[#A83B4D]" /> Government ID
                  </span>
                  <span className="text-xs font-mono bg-[#F7F1EA] px-2.5 py-0.5 rounded border border-[#670626]/20">
                    {user.governmentIdType || 'National ID / LTO'}
                  </span>
                </div>
                <div className="h-48 rounded-lg overflow-hidden bg-[#F7F1EA] border border-[#670626]/15 flex items-center justify-center relative">
                  <img
                    src={`/api/users/${user.id}/captures/id`}
                    alt="Government ID"
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() =>
                      setLightboxData({
                        url: `/api/users/${user.id}/captures/id`,
                        title: `${user.fullName} - Government ID`
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxData({
                        url: `/api/users/${user.id}/captures/id`,
                        title: `${user.fullName} - Government ID`
                      })
                    }
                    className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-[#670626] text-xs font-mono text-[#F7F1EA] cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" /> Enlarge ID
                  </button>
                </div>
              </div>

              <div className={`${CLAY_WELL} p-4 space-y-2.5`}>
                <div className="flex items-center justify-between font-semibold text-xs">
                  <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-[#670626]">
                    <UserCheck className="w-4 h-4 text-emerald-700" /> Face Biometric
                  </span>
                  <span className="text-xs font-mono bg-[#F7F1EA] px-2.5 py-0.5 rounded border border-[#670626]/20">
                    {user.faceVerified ? 'Verified' : 'Pending'}
                  </span>
                </div>
                <div className="h-48 rounded-lg overflow-hidden bg-[#F7F1EA] border border-[#670626]/15 flex items-center justify-center relative">
                  <img
                    src={`/api/users/${user.id}/captures/face`}
                    alt="Live Face Biometric"
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() =>
                      setLightboxData({
                        url: `/api/users/${user.id}/captures/face`,
                        title: `${user.fullName} - Face Biometric`
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxData({
                        url: `/api/users/${user.id}/captures/face`,
                        title: `${user.fullName} - Face Biometric`
                      })
                    }
                    className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-[#670626] text-xs font-mono text-[#F7F1EA] cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" /> Enlarge Face
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`${CLAY_WELL} p-4 space-y-3`}>
                <h4 className="font-bold text-[#670626] uppercase tracking-wider font-mono text-xs flex items-center gap-1.5 border-b border-[#670626]/15 pb-2">
                  <User className="w-4 h-4 text-[#A83B4D]" /> Personal & Vital Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Sex:</span>
                    <span className="font-semibold">{user.sex || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Blood Type:</span>
                    <span className="font-black font-mono text-base">{user.bloodType || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Date of Birth:</span>
                    <span className="font-mono">{fmtDate(user.dateOfBirth)}</span>
                  </div>
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Phone Number:</span>
                    <span className="font-mono">{user.phoneNumber || '—'}</span>
                  </div>
                </div>
              </div>

              <div className={`${CLAY_WELL} p-4 space-y-3`}>
                <h4 className="font-bold text-[#670626] uppercase tracking-wider font-mono text-xs flex items-center gap-1.5 border-b border-[#670626]/15 pb-2">
                  <MapPin className="w-4 h-4 text-[#A83B4D]" /> Registered Residence Sector
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Address:</span>
                    <span className="font-medium">
                      {user.fullAddress || `${user.streetOrPurok || ''}, ${user.barangay}, ${user.cityOrMunicipality}, ${user.province}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[#A83B4D] font-mono text-xs uppercase block">Barangay:</span>
                      <span className="font-bold font-mono">{user.barangay}</span>
                    </div>
                    <div>
                      <span className="text-[#A83B4D] font-mono text-xs uppercase block">Municipality:</span>
                      <span className="font-semibold">{user.cityOrMunicipality}, {user.province}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${CLAY_WELL} p-4 space-y-3`}>
                <h4 className="font-bold text-[#670626] uppercase tracking-wider font-mono text-xs flex items-center gap-1.5 border-b border-[#670626]/15 pb-2">
                  <Phone className="w-4 h-4 text-[#A83B4D]" /> Emergency Contact (Next of Kin)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Contact Name:</span>
                    <span className="font-bold">{user.emergencyContactName || 'None Listed'}</span>
                  </div>
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Relationship:</span>
                    <span className="font-medium">{user.emergencyContactRelationship || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Contact Phone:</span>
                    <span className="font-mono font-bold">{user.emergencyContactPhone || '—'}</span>
                  </div>
                </div>
              </div>

              <div className={`${CLAY_WELL} p-4 space-y-3`}>
                <h4 className="font-bold text-[#670626] uppercase tracking-wider font-mono text-xs flex items-center gap-1.5 border-b border-[#670626]/15 pb-2">
                  <Shield className="w-4 h-4 text-[#A83B4D]" /> Agency & Station Assignment
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Role / Unit:</span>
                    <span className="font-semibold">{user.role} {user.unit !== 'None' ? `(${user.unit})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Rank / Title:</span>
                    <span className="font-medium">{user.rankOrTitle || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#A83B4D] font-mono text-xs uppercase block">Station or Sector:</span>
                    <span className="font-medium">{user.departmentOrBarangay || 'Katipunan Command'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${CLAY_WELL} flex flex-col md:flex-row md:items-center justify-between text-xs font-mono p-3.5 gap-2`}>
              <div>Created: {fmtDateTime(user.createdAt)} · Synced: {fmtDateTime(user.updatedAt)}</div>
              <div>
                {user.isDeleted ? (
                  <span className="text-[#670626] font-bold">Soft-Deleted on {fmtDateTime(user.deletedAt)}</span>
                ) : (
                  <span className="text-emerald-800 font-bold">Active Record</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#670626]/15">
          <AdminButton type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </AdminButton>
          {user && onEdit && (
            <AdminButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(user);
              }}
              icon={<Sliders className="w-4 h-4" />}
            >
              Edit Profile
            </AdminButton>
          )}
        </div>
      </AdminModalCard>

      <ImageLightboxModal
        isOpen={lightboxData !== null}
        onClose={() => setLightboxData(null)}
        imageUrl={lightboxData?.url}
        title={lightboxData?.title}
      />
    </>
  );
};
