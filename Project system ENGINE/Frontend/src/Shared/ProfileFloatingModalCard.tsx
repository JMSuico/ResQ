// [Layer: Shared]
// ProfileFloatingModalCard.tsx -- Floating tactical profile modal card styled with ResQTrack dark command aesthetic.
// Features: Enlarged avatar photo, online glowing pulse, full identity telemetry, biometric verification status,
// and role-tailored route navigation to profile/settings page.
// Universal lambda expressions (=>).

import React, { FC, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Settings, ShieldCheck, AlertTriangle, User, Mail } from 'lucide-react';
import { useSession } from '@/Hooks/useSession';
import { useFluidResposiveness } from '@/Hooks/useFluidResposiveness';

export interface ProfileFloatingModalCardProps {
  isOpen: boolean;
  onClose: () => void;
  user?: {
    name?: string;
    fullName?: string;
    displayName?: string;
    role?: string;
    unit?: string;
    id?: string;
    employeeOrResidentId?: string;
    employeeId?: string;
    email?: string;
    status?: string;
    faceVerified?: boolean;
    departmentOrBarangay?: string;
    rankOrTitle?: string;
  };
  avatarUrl?: string | null;
}

export const ProfileFloatingModalCard: FC<ProfileFloatingModalCardProps> = ({
  isOpen,
  onClose,
  user,
  avatarUrl
}) => {
  const { session } = useSession();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Resolved identity fields
  const fullName = user?.displayName || user?.fullName || user?.name || session?.displayName || session?.fullName || 'Active Operator';
  const roleRaw = (user?.role || session?.role || 'Responder');
  const roleLower = roleRaw.toLowerCase();
  const unit = (user?.unit && user.unit !== 'None') ? user.unit : (session?.unit && session.unit !== 'None' ? session.unit : null);
  const employeeOrResidentId = user?.id || session?.employeeOrResidentId || session?.employeeId || 'OP-773-567-009';
  
  const email =
    user?.email ||
    session?.email ||
    (roleLower.includes('admin')
      ? 'ldrrmo.admin@resqtrack.gov.ph'
      : roleLower.includes('responder')
      ? 'responder.field@resqtrack.gov.ph'
      : 'citizen@katipunan.gov.ph');

  const isVerified = user?.faceVerified ?? session?.faceVerified ?? true;

  // Format display role and badge styling
  let roleBadgeLabel = 'Field Responder';
  let roleBadgeStyle = 'bg-sky-100 text-sky-900 border-sky-300';
  let initialBgGradient = 'from-[#670626] via-[#8A1438] to-[#A83B4D]';
  let settingsRoute = '/responder/profile';

  if (roleLower.includes('admin')) {
    roleBadgeLabel = 'LDRRMO Admin';
    roleBadgeStyle = 'bg-[#F3E4E7] text-[#670626] border-[#A83B4D]/40';
    initialBgGradient = 'from-[#670626] via-[#7D0A30] to-[#A83B4D]';
    settingsRoute = '/admin/settings';
  } else if (roleLower.includes('civilian') || roleLower.includes('citizen') || roleLower.includes('resident')) {
    roleBadgeLabel = 'Registered Resident';
    roleBadgeStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300';
    initialBgGradient = 'from-emerald-600 via-emerald-700 to-teal-700';
    settingsRoute = '/civilian/profile';
  }

  const handleOpenSettings = () => {
    onClose();
    navigate(settingsRoute);
  };

  const { isMobile } = useFluidResposiveness();

  const content = (
    <>
      {/* Backdrop overlay to catch outside clicks */}
      <div
        className="fixed inset-0 z-[999998] bg-[#3B1722]/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Claymorphic Profile Card */}
      <div
        ref={cardRef}
        className={`clay-surface fixed top-14 right-4 z-[999999] ${
          isMobile ? 'inset-x-3 w-auto' : 'w-80 sm:w-96'
        } max-w-[calc(100vw-1.5rem)] max-h-[88vh] rounded-2xl bg-[#F7F1EA] border border-[#E9D9D0] p-4 text-[#3B1722] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto`}
        style={{
          boxShadow: '0 24px 50px -8px rgba(103, 6, 38, 0.28), inset 0 2px 4px rgba(255, 255, 255, 0.9)'
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Tactical User Profile"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        {/* Header Accent */}
        <div className="flex items-center justify-between border-b border-[#E9D9D0] pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#670626] animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-[#7A4E59]">
              Profile
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#7A4E59] hover:text-[#670626] hover:bg-[#E9D9D0] transition-colors cursor-pointer"
            aria-label="Close profile card"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Identity Row */}
        <div className="flex items-center gap-3.5">
          {/* Avatar Photo with Glowing Online Indicator */}
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#E9D9D0] shadow-md bg-[#E9D9D0] flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-tr ${initialBgGradient} flex items-center justify-center text-2xl font-black text-[#F7F1EA] shadow-inner`}
              >
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Online Indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-[#F7F1EA]" />
            </span>
          </div>

          {/* User Meta Information */}
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-base font-black text-[#670626] tracking-tight truncate leading-tight">
              {fullName}
            </h3>
            <span className="text-xs font-mono text-[#7A4E59] truncate mt-0.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-[#A83B4D] flex-shrink-0" />
              <span className="truncate">{email}</span>
            </span>

            {/* Badges: Role and Agency Unit */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span
                className={`px-2 py-0.5 rounded-full border text-xs font-mono font-bold tracking-tight uppercase ${roleBadgeStyle}`}
              >
                {roleBadgeLabel}
              </span>

              {unit && (
                <span className="px-2 py-0.5 rounded-md bg-[#E9D9D0] border border-[#D4B8AA] text-xs font-mono font-bold text-[#670626]">
                  {unit}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Security & Credential Telemetry Grid */}
        <div className="flex flex-col gap-2 pt-1 text-sm font-mono">
          {/* Credential ID */}
          <div className="px-3 py-2 bg-[#E9D9D0]/60 rounded-xl border border-[#D8C1B5] flex items-center justify-between">
            <span className="text-xs text-[#7A4E59] uppercase font-bold tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#A83B4D]" />
              <span>ID</span>
            </span>
            <span className="font-bold text-[#670626] tracking-wider">
              {employeeOrResidentId}
            </span>
          </div>

          {/* Verification Status */}
          <div className="px-3 py-2 bg-[#E9D9D0]/60 rounded-xl border border-[#D8C1B5] flex items-center justify-between">
            <span className="text-xs text-[#7A4E59] uppercase font-bold tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#A83B4D]" />
              <span>AUTHENTICATION</span>
            </span>
            {isVerified ? (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Verified</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Pending</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Button: Open Profile Settings */}
        <button
          type="button"
          onClick={handleOpenSettings}
          className="w-full mt-1 py-2.5 px-4 rounded-xl bg-[#670626] hover:bg-[#7D0A30] active:scale-[0.98] text-[#F7F1EA] font-mono font-bold text-sm uppercase tracking-wider shadow-[0_8px_18px_-4px_rgba(103,6,38,0.4)] flex items-center justify-center gap-2 border border-[#A83B4D]/45 transition-all cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Open Profile Settings</span>
        </button>
      </div>
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
};

export default ProfileFloatingModalCard;
