// [Layer: LayoutBars]
// Responsibility: User identity chip with avatar, role/ID label, and secure session logout.

import React from 'react';
import { useNavigate } from 'react-router-dom';

export const UserSessionChip: React.FC<{
  user?: {
    name?: string;
    role?: string;
    unit?: string;
    id?: string;
  };
}> = ({ user }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout error', err);
    }
    navigate('/login');
  };

  const name = user?.name || 'Active Operator';
  const roleDisplay = user?.unit && user.unit !== 'None' ? `${user.role} [${user.unit}]` : (user?.role || 'Responder');
  const id = user?.id || 'OP-773-567-009';

  return (
    <button
      className="userchip"
      type="button"
      id="btn-user"
      onClick={handleLogout}
      aria-label={`Signed in as ${name} (${roleDisplay}), ID ${id}. Click to sign out.`}
      title="Click to sign out"
    >
      <span className="userchip__avatar" aria-hidden="true">
        <svg><use href="#i-user" /></svg>
      </span>
      <span className="userchip__meta">
        <span className="userchip__name">{name}</span>
        <span className="userchip__id">{id}</span>
      </span>
    </button>
  );
};

export default UserSessionChip;
