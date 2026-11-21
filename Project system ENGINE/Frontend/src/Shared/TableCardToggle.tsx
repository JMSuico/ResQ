// [Layer: Shared]
// TableCardToggle.tsx -- Universal view mode toggle (Table to Card & Card to Table)
// Enables interactive switching between compact grid cards and data tables.
// Connects with RadioButton and Button components.
// Universal lambda expressions (=>).

import React, { FC, useState } from 'react';
import { Table, LayoutGrid } from 'lucide-react';
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
      <div className={`inline-flex items-center gap-4 bg-[#F7F1EA] p-2 rounded-xl border border-[#E9D9D0] shadow-sm ${className}`}>
        <RadioButton
          id="view-toggle-table"
          name="view-mode-toggle"
          checked={viewMode === 'table'}
          onChange={() => onChange('table')}
          label={<span className="text-sm font-semibold text-[#3B1722]">Table View</span>}
        />
        <RadioButton
          id="view-toggle-card"
          name="view-mode-toggle"
          checked={viewMode === 'card'}
          onChange={() => onChange('card')}
          label={<span className="text-sm font-semibold text-[#3B1722]">Card Grid</span>}
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
          icon={<Table className="w-3.5 h-3.5" />}
        >
          Table
        </Button>
        <Button
          variant={viewMode === 'card' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onChange('card')}
          className="flex items-center gap-1.5"
          icon={<LayoutGrid className="w-3.5 h-3.5" />}
        >
          Cards
        </Button>
      </div>
    );
  }

  // Default: Segmented Claymorphic Pill
  return (
    <div
      className={`inline-flex p-0.5 rounded-xl bg-[#E9D9D0] border border-[#D4B8AA] shadow-inner ${className}`}
      role="group"
      aria-label="View layout switch"
    >
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
          viewMode === 'table'
            ? 'bg-[#670626] text-[#F7F1EA] shadow-sm'
            : 'text-[#670626] hover:text-[#3B1722]'
        }`}
        title="Switch to Table View (CardToTable)"
      >
        <Table className="w-3.5 h-3.5" />
        <span>TABLE</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('card')}
        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
          viewMode === 'card'
            ? 'bg-[#670626] text-[#F7F1EA] shadow-sm'
            : 'text-[#670626] hover:text-[#3B1722]'
        }`}
        title="Switch to Card Grid View (TableToCard)"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>CARDS</span>
      </button>
    </div>
  );
};

export default TableCardToggle;
