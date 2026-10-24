// [Layer: Shared]
// TableCardToggle.tsx -- Universal view mode toggle (Table to Card & Card to Table)
// Enables interactive switching between compact grid cards and data tables.
// Connects with RadioButton and Button components.

import React, { FC, useState } from 'react';
import { Button } from './Button';
import { RadioButton } from './RadioButton';

export type ViewMode = 'table' | 'card';

export const TableToCard = (_mode?: ViewMode): ViewMode => 'card';
export const CardToTable = (_mode?: ViewMode): ViewMode => 'table';

export interface UseTableCardViewReturn {
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  isTable: boolean;
  isCard: boolean;
  toTable: () => void;
  toCard: () => void;
  toggleView: () => void;
}

export const useTableCardView = (initialMode: ViewMode = 'table'): UseTableCardViewReturn => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);

  return {
    viewMode,
    setViewMode,
    isTable: viewMode === 'table',
    isCard: viewMode === 'card',
    toTable: () => setViewMode('table'),
    toCard: () => setViewMode('card'),
    toggleView: () => setViewMode((prev) => (prev === 'table' ? 'card' : 'table'))
  };
};

export interface TableCardToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  variant?: 'buttons' | 'radios' | 'segmented';
  className?: string;
}

export const TableCardToggle: FC<TableCardToggleProps> = ({
  viewMode,
  onChange,
  variant = 'segmented',
  className = ''
}) => {
  if (variant === 'radios') {
    return (
      <div className={`inline-flex items-center gap-4 bg-slate-900/60 p-2 rounded-lg border border-slate-700/60 ${className}`}>
        <RadioButton
          id="view-toggle-table"
          name="view-mode-toggle"
          checked={viewMode === 'table'}
          onChange={() => onChange('table')}
          label={<span className="text-xs font-semibold text-slate-200">Table View</span>}
        />
        <RadioButton
          id="view-toggle-card"
          name="view-mode-toggle"
          checked={viewMode === 'card'}
          onChange={() => onChange('card')}
          label={<span className="text-xs font-semibold text-slate-200">Card Grid</span>}
        />
      </div>
    );
  }

  if (variant === 'buttons') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <Button
          variant={viewMode === 'table' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onChange('table')}
          className="flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h18v18H3z" />
            <path d="M3 9h18M3 15h18M9 3v18" />
          </svg>
          Table
        </Button>
        <Button
          variant={viewMode === 'card' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onChange('card')}
          className="flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Cards
        </Button>
      </div>
    );
  }

  // Default: Segmented Tactical HUD Pill
  return (
    <div
      className={`inline-flex p-0.5 rounded-lg bg-slate-950/80 border border-slate-700/80 backdrop-blur-sm shadow-inner ${className}`}
      role="group"
      aria-label="View layout switch"
    >
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 ${
          viewMode === 'table'
            ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="Switch to Table View (CardToTable)"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3z" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
        <span>TABLE</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('card')}
        className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 ${
          viewMode === 'card'
            ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="Switch to Card Grid View (TableToCard)"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        <span>CARDS</span>
      </button>
    </div>
  );
};

export default TableCardToggle;
