// [Layer: LayoutBars]
// Responsibility: User identity session chip with avatar, operator identification, and profile floating modal card toggle.
// Authentic ResQTrack dark command aesthetic -- Universal Lucide icon standard with strict typing (ZERO any).

import React, { useState, useEffect, useCallback } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { ProfileFloatingModalCard } from '@/Shared/ProfileFloatingModalCard';

export interface UserSessionChipProps {
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
    [key: string]: unknown;
  } | null;
}

const DEFAULT_OPERATOR_NAME = 'Active Operator';
const DEFAULT_OPERATOR_ID = 'OP-773-567-009';
const DEFAULT_ROLE_FALLBACK = 'Responder';

const AVATAR_LOCAL_STORAGE_KEYS = [
  'resqtrack_user_avatar',
  'resqtrack_admin_avatar',
  'resqtrack_responder_avatar',
  'resqtrack_civilian_avatar'
] as const;

export const UserSessionChip: React.FC<UserSessionChipProps> = ({ user }) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const getStoredAvatar = useCallback((): string | null => {
    try {
      for (const key of AVATAR_LOCAL_STORAGE_KEYS) {
        const val = localStorage.getItem(key);
        if (val) return val;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const [avatar, setAvatar] = useState<string | null>(getStoredAvatar);

  useEffect(() => {
    const handleAvatarUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ avatar?: string | null }>;
      if (customEvent?.detail?.avatar !== undefined) {
        setAvatar(customEvent.detail.avatar);
      } else {
        setAvatar(getStoredAvatar());
      }
    };

    window.addEventListener('resqtrack:avatar-updated', handleAvatarUpdated);
    return () => {
      window.removeEventListener('resqtrack:avatar-updated', handleAvatarUpdated);
    };
  }, [getStoredAvatar]);

  const name = user?.fullName || user?.name || DEFAULT_OPERATOR_NAME;
  const unit = user?.unit && user.unit !== 'None' ? user.unit : undefined;
  const roleDisplay = unit ? `${user?.role || DEFAULT_ROLE_FALLBACK} [${unit}]` : (user?.role || DEFAULT_ROLE_FALLBACK);
  const operatorId = user?.employeeOrResidentId || user?.employeeId || user?.id || DEFAULT_OPERATOR_ID;

  const toggleProfileModal = () => {
    setIsProfileModalOpen((prev) => !prev);
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        className="userchip group flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 transition-all focus:outline-none focus:ring-1 focus:ring-rose-500/50"
        type="button"
        id="btn-user"
        onClick={toggleProfileModal}
        aria-label={`Signed in as ${name} (${roleDisplay}), ID ${operatorId}. Click to view profile options.`}
        title="View profile options"
        aria-expanded={isProfileModalOpen}
        aria-haspopup="dialog"
      >
        <span
          className="userchip__avatar w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-slate-800 border border-white/10 ring-1 ring-white/5 flex-shrink-0"
          aria-hidden="true"
        >
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <User className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" aria-hidden="true" />
          )}
        </span>

        <span className="userchip__meta flex flex-col text-left leading-tight hidden sm:flex">
          <span className="userchip__name text-xs font-semibold text-slate-200 group-hover:text-white truncate max-w-[130px]">
            {name}
          </span>
          <span className="userchip__id text-[10px] font-mono text-slate-400 group-hover:text-slate-300 tracking-wider">
            {operatorId}
          </span>
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 flex-shrink-0 ${
            isProfileModalOpen ? 'rotate-180 text-rose-400' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isProfileModalOpen && (
        <ProfileFloatingModalCard
          isOpen={isProfileModalOpen}
          onClose={closeProfileModal}
          user={user || undefined}
          avatarUrl={avatar}
        />
      )}
    </div>
  );
};

export default UserSessionChip;
