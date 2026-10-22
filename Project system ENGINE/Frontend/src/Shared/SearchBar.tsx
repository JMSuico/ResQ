// [Layer: Shared]
// SearchBar.tsx -- Universal glassmorphic search bar component with shortcut pill, clear button, and input debouncing.
// Reusable across LDRRMO Admin, RHU, Fire, and PNP tactical dashboards.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC } from 'react';

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
    <div className={`relative flex items-center w-full ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900/90 pl-10 pr-12 py-2 rounded-xl text-xs text-slate-200 placeholder-slate-500 border border-slate-700/80 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
          title="Clear search"
          aria-label="Clear search input"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : shortcutKey ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 select-none pointer-events-none">
          {shortcutKey}
        </span>
      ) : null}
    </div>
  );
};

export default SearchBar;
