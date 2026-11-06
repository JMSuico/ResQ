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
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-sky-400 transition-colors duration-150">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900/95 backdrop-blur-sm pl-10 pr-12 py-2 rounded-xl text-xs text-slate-100 placeholder-slate-400/80 border border-slate-700/80 hover:border-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 focus:bg-slate-900 transition-all duration-150"
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white hover:bg-slate-800/80 p-1 rounded-md transition-all duration-150 cursor-pointer"
          title="Clear search"
          aria-label="Clear search input"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : shortcutKey ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-slate-800/90 text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-700/80 tracking-wider select-none pointer-events-none">
          {shortcutKey}
        </span>
      ) : null}
    </div>
  );
};

export default SearchBar;
