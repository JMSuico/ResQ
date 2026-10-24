// [Layer: Shared]
// ProfileFloatingModalCard.tsx -- Floating tactical profile modal card styled with ResQTrack dark command aesthetic.
// Features: Enlarged avatar photo, online glowing pulse, full identity telemetry, biometric verification status,
// and role-tailored route navigation to profile/settings page.

import React, { FC, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/Hooks/useSession';

export interface ProfileFloatingModalCardProps {
  isOpen: boolean;
  onClose: () => void;
  user?: {
    name?: string;
    fullName?: string;
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
  const fullName = user?.fullName || user?.name || session?.fullName || 'Active Operator';
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
  let roleBadgeStyle = 'bg-sky-950/90 text-sky-300 border-sky-600/50';
  let initialBgGradient = 'from-sky-600 via-blue-600 to-indigo-600';
  let settingsRoute = '/responder/profile';

  if (roleLower.includes('admin')) {
    roleBadgeLabel = 'LDRRMO Admin';
    roleBadgeStyle = 'bg-rose-950/90 text-rose-300 border-rose-600/50';
    initialBgGradient = 'from-rose-600 via-red-600 to-orange-600';
    settingsRoute = '/admin/settings';
  } else if (roleLower.includes('civilian') || roleLower.includes('citizen') || roleLower.includes('resident')) {
    roleBadgeLabel = 'Registered Resident';
    roleBadgeStyle = 'bg-emerald-950/90 text-emerald-300 border-emerald-600/50';
    initialBgGradient = 'from-emerald-600 via-teal-600 to-cyan-600';
    settingsRoute = '/civilian/profile';
  }

  const handleOpenSettings = () => {
    onClose();
    navigate(settingsRoute);
  };

  return (
    <>
      {/* Invisible backdrop overlay to catch outside clicks */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[0.5px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Tactical Card */}
      <div
        ref={cardRef}
        className="absolute top-[calc(100%+10px)] right-0 z-50 w-80 sm:w-88 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-rose-950/30 border border-slate-700/80 shadow-2xl p-4 text-slate-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
        style={{
          boxShadow: '0 24px 50px -6px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(244, 63, 94, 0.25)'
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Tactical User Profile"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tactical Header Accent */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400">
              TACTICAL PROFILE &bull; C2 HUD
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label="Close profile card"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Identity Row */}
        <div className="flex items-center gap-3.5">
          {/* Avatar Photo with Glowing Online Indicator */}
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl bg-slate-950 flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-tr ${initialBgGradient} flex items-center justify-center text-2xl font-black text-white shadow-inner`}
              >
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Glowing Online Indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950" />
            </span>
          </div>

          {/* User Meta Information */}
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-sm font-black text-white tracking-tight truncate leading-tight">
              {fullName}
            </h3>
            <span className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
              {email}
            </span>

            {/* Badges: Role and Agency Unit */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span
                className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-tight uppercase ${roleBadgeStyle}`}
              >
                {roleBadgeLabel}
              </span>

              {unit && (
                <span className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-300">
                  {unit}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Security & Credential Telemetry Grid */}
        <div className="flex flex-col gap-2 pt-1 text-xs font-mono">
          {/* Credential ID */}
          <div className="px-3 py-2 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              OPERATOR / CITIZEN ID
            </span>
            <span className="font-bold text-sky-400 tracking-wider">
              {employeeOrResidentId}
            </span>
          </div>

          {/* Verification Status */}
          <div className="px-3 py-2 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              AUTHENTICATION
            </span>
            {isVerified ? (
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span>✓</span>
                <span>BIOMETRICALLY VERIFIED</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                <span>⚠</span>
                <span>PENDING SCAN</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Button: Open Profile Settings */}
        <button
          type="button"
          onClick={handleOpenSettings}
          className="w-full mt-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] text-white font-mono font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 border border-rose-500/50 transition-all cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Open Profile Settings</span>
        </button>
      </div>
    </>
  );
};

export default ProfileFloatingModalCard;
