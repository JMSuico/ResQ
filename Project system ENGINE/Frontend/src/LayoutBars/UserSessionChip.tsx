// [Layer: LayoutBars]
// Responsibility: User identity chip with avatar, role/ID label, and profile floating modal toggle.
// Decoupled from logout; toggles ProfileFloatingModalCard and reacts in real-time to avatar updates.

import React, { useState, useEffect } from 'react';
import { ProfileFloatingModalCard } from '@/Shared/ProfileFloatingModalCard';

export const UserSessionChip: React.FC<{
  user?: {
    name?: string;
    role?: string;
    unit?: string;
    id?: string;
    [key: string]: unknown;
  };
}> = ({ user }) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [avatar, setAvatar] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem('resqtrack_user_avatar') ||
        localStorage.getItem('resqtrack_admin_avatar') ||
        localStorage.getItem('resqtrack_responder_avatar') ||
        localStorage.getItem('resqtrack_civilian_avatar') ||
        null
      );
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleAvatarUpdated = (event: any) => {
      if (event?.detail?.avatar !== undefined) {
        setAvatar(event.detail.avatar);
      } else {
        try {
          const fresh =
            localStorage.getItem('resqtrack_user_avatar') ||
            localStorage.getItem('resqtrack_admin_avatar') ||
            localStorage.getItem('resqtrack_responder_avatar') ||
            localStorage.getItem('resqtrack_civilian_avatar') ||
            null;
          setAvatar(fresh);
        } catch {
          setAvatar(null);
        }
      }
    };

    window.addEventListener('resqtrack:avatar-updated', handleAvatarUpdated);
    return () => {
      window.removeEventListener('resqtrack:avatar-updated', handleAvatarUpdated);
    };
  }, []);

  const name = user?.name || 'Active Operator';
  const roleDisplay = user?.unit && user.unit !== 'None' ? `${user.role} [${user.unit}]` : (user?.role || 'Responder');
  const id = user?.id || 'OP-773-567-009';

  return (
    <div className="relative inline-flex items-center">
      <button
        className="userchip"
        type="button"
        id="btn-user"
        onClick={() => setIsProfileModalOpen((prev) => !prev)}
        aria-label={`Signed in as ${name} (${roleDisplay}), ID ${id}. Click to view profile options.`}
        title="View profile options"
        aria-expanded={isProfileModalOpen}
        aria-haspopup="dialog"
      >
        <span className="userchip__avatar overflow-hidden" aria-hidden="true">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <svg><use href="#i-user" /></svg>
          )}
        </span>
        <span className="userchip__meta">
          <span className="userchip__name">{name}</span>
          <span className="userchip__id">{id}</span>
        </span>
      </button>

      {isProfileModalOpen && (
        <ProfileFloatingModalCard
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          avatarUrl={avatar}
        />
      )}
    </div>
  );
};

export default UserSessionChip;
