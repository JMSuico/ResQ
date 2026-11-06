// [Layer: Shared]
// ToggleDrawerSidebarMenu.tsx -- Drawer Sidebar open/close toggle system.
// Supports collapsed icon-only mode and expanded icon+label mode with smooth transitions.
// Universal lambda expressions (=>).

import React, { createContext, useContext, useState, useEffect, FC } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface DrawerSidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const DrawerSidebarContext = createContext<DrawerSidebarContextType>({
  isCollapsed: false,
  toggleSidebar: () => {},
  setCollapsed: () => {}
});

export const useDrawerSidebar = () => useContext(DrawerSidebarContext);

export interface DrawerSidebarProviderProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export const DrawerSidebarProvider: FC<DrawerSidebarProviderProps> = ({
  children,
  defaultCollapsed = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('resqtrack_sidebar_collapsed');
      return stored !== null ? JSON.parse(stored) : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('resqtrack_sidebar_collapsed', JSON.stringify(isCollapsed));
    } catch {
      // silent
    }
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed((prev) => !prev);
  const setCollapsed = (val: boolean) => setIsCollapsed(val);

  return (
    <DrawerSidebarContext.Provider value={{ isCollapsed, toggleSidebar, setCollapsed }}>
      {children}
    </DrawerSidebarContext.Provider>
  );
};

export interface ToggleDrawerSidebarMenuProps {
  className?: string;
}

export const ToggleDrawerSidebarMenu: FC<ToggleDrawerSidebarMenuProps> = ({ className = '' }) => {
  const { isCollapsed, toggleSidebar } = useDrawerSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={`p-1.5 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer ${className}`}
      title={isCollapsed ? 'Expand Navigation Menu' : 'Collapse to Icons Only'}
      aria-label={isCollapsed ? 'Expand Navigation Menu' : 'Collapse to Icons Only'}
    >
      {isCollapsed ? (
        <PanelLeftOpen className="w-4 h-4" />
      ) : (
        <PanelLeftClose className="w-4 h-4" />
      )}
    </button>
  );
};

export default ToggleDrawerSidebarMenu;
