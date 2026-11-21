// [Layer: LayoutBars]
// Responsibility: User identity session chip with avatar, operator identification, and profile floating modal card toggle.
// Official Cherry (#670626 / #400014) & Warm Ivory (#F7F1EA) Stitch aesthetic -- Universal Lucide icon standard (ZERO any).

import React, { useState, useEffect, useCallback } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { ProfileFloatingModalCard } from '@/Shared/ProfileFloatingModalCard';

export interface UserSessionChipProps {
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

  const name = user?.displayName || user?.fullName || user?.name || DEFAULT_OPERATOR_NAME;
  const unit = user?.unit && user.unit !== 'None' ? user.unit : undefined;
  const roleDisplay = unit ? `${user?.role || DEFAULT_ROLE_FALLBACK} · ${unit}` : (user?.role || DEFAULT_ROLE_FALLBACK);
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
        className="userchip group flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl bg-[#670626]/85 border border-[#FFD9DD]/25 hover:border-[#F7F1EA]/55 hover:bg-[#670626] transition-all focus:outline-none focus:ring-2 focus:ring-[#FFD9DD]/60 shadow-sm"
        type="button"
        id="btn-user"
        onClick={toggleProfileModal}
        aria-label={`Signed in as ${name} (${roleDisplay}), ID ${operatorId}. Click to view profile options.`}
        title="View profile options"
        aria-expanded={isProfileModalOpen}
        aria-haspopup="dialog"
      >
        <span
          className="userchip__avatar w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-[#F7F1EA] text-[#670626] border border-[#FFD9DD]/60 flex-shrink-0"
          aria-hidden="true"
        >
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <User className="w-4 h-4 text-[#670626] transition-colors" aria-hidden="true" />
          )}
        </span>

        <span className="userchip__meta flex flex-col text-left leading-tight hidden sm:flex">
          <span className="userchip__name text-sm font-bold text-[#F7F1EA] truncate max-w-[140px]">
            {name}
          </span>
          <span className="userchip__id text-xs font-mono text-[#FFD9DD] tracking-wider">
            {operatorId}
          </span>
        </span>

        <ChevronDown
          className={`w-4 h-4 text-[#FFD9DD] group-hover:text-[#F7F1EA] transition-transform duration-200 flex-shrink-0 ${
            isProfileModalOpen ? 'rotate-180 text-[#F7F1EA]' : ''
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
