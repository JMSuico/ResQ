// [Layer: Shared]
// SearchBar.tsx -- Universal glassmorphic search bar component with shortcut pill, clear button, and input debouncing.
// Reusable across LDRRMO Admin, RHU, Fire, and PNP tactical dashboards.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  shortcutKey?: string;
  autoFocus?: boolean;
}

export const SearchBar: FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search incidents, units, or logs...',
  className = '',
  shortcutKey = '⌘K',
  autoFocus = false,
}) => {
  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div className={`relative flex items-center w-full group ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7A4E59] group-focus-within:text-[#670626] transition-colors duration-150">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#FFFBF7] pl-10 pr-14 py-2 rounded-xl text-sm text-[#3B1722] placeholder-[#9B727D] border border-[#D8C1B5] hover:border-[#A83B4D] focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#A83B4D]/25 shadow-[inset_0_2px_4px_rgba(103,6,38,0.05)] transition-all duration-150"
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A4E59] hover:text-[#670626] hover:bg-[#E9D9D0] p-1 rounded-md transition-all duration-150 cursor-pointer"
          title="Clear search"
          aria-label="Clear search input"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : shortcutKey ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono bg-[#E9D9D0] text-[#670626] px-1.5 py-0.5 rounded-md border border-[#D4B8AA] tracking-wider select-none pointer-events-none font-bold">
          {shortcutKey}
        </span>
      ) : null}
    </div>
  );
};

export default SearchBar;
