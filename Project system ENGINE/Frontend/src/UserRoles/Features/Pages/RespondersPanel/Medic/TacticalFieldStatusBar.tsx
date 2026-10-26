// [Layer: UserRoles/Features/Pages/RespondersPanel/Medic]
// Responsibility: Tactical persistent field status bar for RHU emergency medical responders.
// Katipuneros Architecture: Universal lambda expressions (=>).

import React from 'react';

export type TacticalFieldStatus =
  | 'AVAILABLE'
  | 'EN ROUTE (SIRENS ON)'
  | 'ON SCENE'
  | 'TRANSPORTING TO ER'
  | 'RETURNING';

export interface TacticalFieldStatusBarProps {
  currentStatus: TacticalFieldStatus;
  onStatusChange: (status: TacticalFieldStatus) => void;
  isUpdating?: boolean;
  unitCallsign?: string;
}

const STATUS_ITEMS: {
  status: TacticalFieldStatus;
  label: string;
  badge: string;
  icon: string;
  activeColor: string;
  borderGlow: string;
}[] = [
  {
    status: 'AVAILABLE',
    label: 'AVAILABLE',
    badge: 'STAGED',
    icon: '🟢',
    activeColor: 'bg-emerald-600 text-white border-emerald-400',
    borderGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]'
  },
  {
    status: 'EN ROUTE (SIRENS ON)',
    label: 'EN ROUTE (SIRENS ON)',
    badge: 'CODE 3',
    icon: '🚨',
    activeColor: 'bg-red-600 text-white border-red-400 animate-pulse',
    borderGlow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]'
  },
  {
    status: 'ON SCENE',
    label: 'ON SCENE',
    badge: 'TRIAGING',
    icon: '🩺',
    activeColor: 'bg-sky-600 text-white border-sky-400',
    borderGlow: 'shadow-[0_0_15px_rgba(56,189,248,0.4)]'
  },
  {
    status: 'TRANSPORTING TO ER',
    label: 'TRANSPORTING TO ER',
    badge: 'ZNMC BOUND',
    icon: '🚑',
    activeColor: 'bg-indigo-600 text-white border-indigo-400',
    borderGlow: 'shadow-[0_0_15px_rgba(99,102,241,0.4)]'
  },
  {
    status: 'RETURNING',
    label: 'RETURNING',
    badge: 'QUARTERS',
    icon: '🔄',
    activeColor: 'bg-slate-700 text-white border-slate-500',
    borderGlow: 'shadow-[0_0_15px_rgba(148,163,184,0.3)]'
  }
];

export const TacticalFieldStatusBar: React.FC<TacticalFieldStatusBarProps> = ({
  currentStatus,
  onStatusChange,
  isUpdating = false,
  unitCallsign = 'MEDIC-01'
}) => {
  return (
    <div className="w-full p-3 rounded-xl bg-slate-900/95 border border-sky-600/30 shadow-lg backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-3">
      {/* Unit Callsign Chip */}
      <div className="flex items-center gap-2 self-start md:self-center">
        <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping" />
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider">
            TACTICAL STATUS HUD
          </span>
          <span className="text-xs font-mono font-extrabold text-white">
            {unitCallsign} // C2 EMS
          </span>
        </div>
      </div>

      {/* 5-State Button Segment */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full md:w-auto flex-1 max-w-4xl">
        {STATUS_ITEMS.map((item) => {
          const isActive = currentStatus === item.status;
          return (
            <button
              key={item.status}
              type="button"
              disabled={isUpdating}
              onClick={() => onStatusChange(item.status)}
              className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all duration-150 flex flex-col items-center justify-center gap-0.5 border active:scale-95 select-none ${
                isActive
                  ? `${item.activeColor} ${item.borderGlow} scale-[1.02]`
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              } ${isUpdating ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-1.5">
                <span>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              <span className={`text-[9px] uppercase tracking-wider ${isActive ? 'text-white/90' : 'text-slate-500'}`}>
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
