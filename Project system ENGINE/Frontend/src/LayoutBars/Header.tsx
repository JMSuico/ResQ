// [Layer: LayoutBars]
// Responsibility: Top navigation command header with live search, dynamic unread alert counter from GET /api/alerts,
// contextual system routing, floating profile trigger, and authenticated logout session termination.
// ResQTrack Incident AI System Detection -- Universal Lucide icon standard with strict typing (ZERO any).

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Settings,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { UserSessionChip, UserSessionChipProps } from './UserSessionChip';
import { NotificationsModal } from './NotificationsModal';
import { useDrawerSidebar } from '@/Shared/ToggleDrawerSidebarMenu';

export interface HeaderProps {
  user?: UserSessionChipProps['user'];
}

const COLLAPSED_SIDEBAR_WIDTH = '72px';
const EXPANDED_SIDEBAR_VAR = 'var(--brand-w, 260px)';
const ALERT_POLL_INTERVAL_MS = 15000;
const MAX_DISPLAY_UNREAD_COUNT = 99;
const LOCAL_STORAGE_READ_KEY = 'resqtrack.alerts.read';

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { isCollapsed } = useDrawerSidebar();
  const navigate = useNavigate();

  const fetchUnreadAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts', { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as Array<{
          reportId?: string;
          id?: string;
          referenceCode?: string;
          isRead?: boolean;
        }>;

        if (Array.isArray(data)) {
          let locallyReadIds: string[] = [];
          try {
            const raw = window.localStorage.getItem(LOCAL_STORAGE_READ_KEY);
            if (raw) locallyReadIds = JSON.parse(raw) as string[];
          } catch {
            // Ignore storage parse error
          }

          const unread = data.filter((item) => {
            const key = item.reportId || item.id || item.referenceCode || '';
            return !item.isRead && !locallyReadIds.includes(key);
          }).length;

          setUnreadCount(unread);
        }
      }
    } catch (err) {
      // Non-blocking warning on network jitter
      console.warn('Alert counter synchronization deferred:', err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadAlerts();
    const intervalId = window.setInterval(fetchUnreadAlerts, ALERT_POLL_INTERVAL_MS);

    const handleAlertsUpdated = () => {
      fetchUnreadAlerts();
    };

    window.addEventListener('resqtrack:alerts-updated', handleAlertsUpdated);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('resqtrack:alerts-updated', handleAlertsUpdated);
    };
  }, [fetchUnreadAlerts]);

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
    alert(
      'ResQTrack Emergency Response Command System\nKatipunan, Zamboanga del Norte\nHotline: 911 / (065) 908-1234'
    );
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout error encountered:', err);
    }
    navigate('/login');
  };

  const handleToggleAlerts = () => {
    setIsAlertsOpen((prev) => !prev);
  };

  const handleCloseAlerts = () => {
    setIsAlertsOpen(false);
    fetchUnreadAlerts();
  };

  return (
    <header className="topbar select-none" role="banner">
      <div
        className="brandbar flex items-center justify-between transition-all duration-200 border-r border-white/5 pr-3 overflow-hidden"
        style={{
          width: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR,
          minWidth: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_VAR
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
        <Search className="search__icon w-4 h-4 text-slate-400 pointer-events-none flex-shrink-0" aria-hidden="true" />
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

      <div className="topbar__actions flex items-center gap-1 sm:gap-2">
        <div className="alerts relative" id="alerts">
          <button
            className="iconbtn relative flex items-center justify-center p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
            type="button"
            id="btn-alerts"
            aria-label={`Alerts (${unreadCount} unread)`}
            aria-haspopup="true"
            aria-expanded={isAlertsOpen}
            aria-controls="alerts-panel"
            onClick={handleToggleAlerts}
          >
            <Bell className="w-4 h-4 text-slate-300 hover:text-white transition-colors" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="iconbtn__dot absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center border border-slate-900 shadow-md animate-pulse"
                aria-label={`${unreadCount} unread alerts`}
              >
                {unreadCount > MAX_DISPLAY_UNREAD_COUNT ? `${MAX_DISPLAY_UNREAD_COUNT}+` : unreadCount}
              </span>
            )}
          </button>
          <NotificationsModal isOpen={isAlertsOpen} onClose={handleCloseAlerts} />
        </div>

        <button
          className="iconbtn iconbtn--desk p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all hidden sm:flex items-center justify-center"
          type="button"
          id="btn-settings"
          aria-label="Settings"
          title="System Settings"
          onClick={handleSettingsClick}
        >
          <Settings className="w-4 h-4 text-slate-300 hover:text-white transition-colors" aria-hidden="true" />
        </button>

        <button
          className="iconbtn iconbtn--desk p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all hidden sm:flex items-center justify-center"
          type="button"
          id="btn-help"
          aria-label="Help"
          title="Emergency Command Support"
          onClick={handleHelpClick}
        >
          <HelpCircle className="w-4 h-4 text-slate-300 hover:text-white transition-colors" aria-hidden="true" />
        </button>

        <span className="topbar__sep w-px h-5 bg-white/10 mx-1" aria-hidden="true" />

        {/* User profile avatar session chip with profile card toggle */}
        <UserSessionChip user={user} />

        {/* Dedicated Logout button cleanly positioned after avatar */}
        <button
          className="iconbtn iconbtn--logout group flex items-center justify-center p-2 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/80 border border-rose-900/50 hover:border-rose-700 ml-1.5 transition-all focus:outline-none focus:ring-1 focus:ring-rose-500"
          type="button"
          id="btn-logout"
          title="Sign Out of Session"
          aria-label="Sign Out"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 text-rose-400 group-hover:text-white transition-colors" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};

export default Header;
