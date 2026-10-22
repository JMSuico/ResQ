// [Layer: LayoutBars]
// Responsibility: Top navigation header with live search, alert drawer trigger, settings navigation, and session chip.
// 100% authentic RISKQTRAK topbar styling with React Router integration.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserSessionChip } from './UserSessionChip';
import { NotificationsModal } from './NotificationsModal';
import { useDrawerSidebar } from '@/Shared/ToggleDrawerSidebarMenu';
import { UserSession } from '@/Endpoints/authEndpoints';

export const Header: React.FC<{ user?: { role?: string; [key: string]: unknown } | null }> = ({ user }) => {
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const { isCollapsed } = useDrawerSidebar();
  const navigate = useNavigate();

  const handleSettingsClick = () => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'ldrrmo_admin' || role === 'admin') {
      navigate('/admin/settings');
    } else if (role === 'responder') {
      navigate('/responder/profile');
    } else {
      navigate('/civilian/profile');
    }
  };

  const handleHelpClick = () => {
    alert('ResQTrack Emergency Response Command System\nKatipunan, Zamboanga del Norte\nHotline: 911 / (065) 908-1234');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout error', err);
    }
    navigate('/login');
  };

  return (
    <header className="topbar">
      <div
        className="brandbar flex items-center justify-between transition-all duration-200 border-r border-white/5 pr-3 overflow-hidden"
        style={{
          width: isCollapsed ? '72px' : 'var(--brand-w, 260px)',
          minWidth: isCollapsed ? '72px' : 'var(--brand-w, 260px)'
        }}
      >
        {!isCollapsed ? (
          <div>
            <span className="brandbar__mark">
              Res<span className="brandbar__accent">Qtrack</span>
            </span>
            <span className="brandbar__sub">Katipunan Emergency Response</span>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <span className="brandbar__mark text-base">
              R<span className="brandbar__accent">Q</span>
            </span>
          </div>
        )}
      </div>

      <form className="search" id="search-form" role="search" onSubmit={(e) => e.preventDefault()}>
        <svg className="search__icon" aria-hidden="true">
          <use href="#i-search" />
        </svg>
        <input
          className="search__input"
          id="search"
          type="search"
          name="q"
          placeholder="Search coordinates, incident ID, or responder..."
          autoComplete="off"
          spellCheck={false}
          aria-label="Search coordinates, incident ID, or responder"
        />
      </form>

      <div className="topbar__actions">
        <div className="alerts" id="alerts">
          <button
            className="iconbtn"
            type="button"
            id="btn-alerts"
            aria-label="Alerts"
            aria-haspopup="true"
            aria-expanded={isAlertsOpen}
            aria-controls="alerts-panel"
            onClick={() => setIsAlertsOpen(!isAlertsOpen)}
          >
            <svg aria-hidden="true">
              <use href="#i-bell" />
            </svg>
            <span className="iconbtn__dot" aria-hidden="true" />
          </button>
          <NotificationsModal isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} />
        </div>

        <button
          className="iconbtn iconbtn--desk"
          type="button"
          id="btn-settings"
          aria-label="Settings"
          onClick={handleSettingsClick}
        >
          <svg aria-hidden="true">
            <use href="#i-gear" />
          </svg>
        </button>

        <button
          className="iconbtn iconbtn--desk"
          type="button"
          id="btn-help"
          aria-label="Help"
          onClick={handleHelpClick}
        >
          <svg aria-hidden="true">
            <use href="#i-help" />
          </svg>
        </button>

        <span className="topbar__sep" aria-hidden="true" />

        <UserSessionChip user={user} />

        <button
          className="iconbtn iconbtn--logout text-rose-400 hover:text-white hover:bg-rose-950/80 border border-rose-900/50 ml-2"
          type="button"
          id="btn-logout"
          title="Sign Out"
          aria-label="Sign Out"
          onClick={handleLogout}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
