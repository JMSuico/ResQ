// [Layer: Shared]
// Dropdown.tsx -- Universal generic floating dropdown menu and selection panel.
// Supports custom trigger, icons, badges, click-outside auto-close (useRef), and keyboard access.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { ReactNode, useState, useRef, useEffect, useCallback, useMemo } from 'react';

export interface DropdownItem<T = string> {
  id?: string;
  value: T;
  label: string;
  icon?: string;
  badge?: string | number;
  description?: string;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps<T = string> {
  items?: DropdownItem<T>[];
  options?: { value: T; label: string }[];
  selectedValue?: T;
  value?: T;
  onSelect?: (value: T) => void;
  onChange?: (value: T) => void;
  trigger?: ReactNode | ((isOpen: boolean, selectedItem?: DropdownItem<T>) => ReactNode);
  label?: string;
  icon?: string;
  placeholder?: string;
  align?: 'left' | 'right';
  className?: string;
  menuWidth?: string;
  disabled?: boolean;
  direction?: 'down' | 'up' | 'auto';
  variant?: 'default' | 'pagination';
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  fullWidth?: boolean;
  id?: string;
}

export const Dropdown = <T = string,>({
  items,
  options,
  selectedValue,
  value,
  onSelect,
  onChange,
  trigger,
  label,
  icon,
  placeholder = 'Select option...',
  align = 'left',
  className = '',
  menuWidth,
  disabled = false,
  direction,
  variant = 'default',
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No matching options',
  fullWidth = false,
  id,
}: DropdownProps<T>) => {
  const normalizedItems: DropdownItem<T>[] = useMemo(() => {
    if (items && items.length > 0) return items;
    if (options && options.length > 0) {
      return options.map((opt) => ({
        value: opt.value,
        label: opt.label,
      }));
    }
    return [];
  }, [items, options]);

  const effectiveSelectedValue = selectedValue !== undefined ? selectedValue : value;
  const isPagination = variant === 'pagination';
  const effectiveDirection = direction ?? (isPagination ? 'up' : 'auto');
  const effectiveMenuWidth = fullWidth ? 'w-full' : menuWidth ?? (isPagination ? 'w-24' : 'w-56');

  const [isOpen, setIsOpen] = useState(false);
  const [actualDirection, setActualDirection] = useState<'down' | 'up'>(effectiveDirection === 'up' ? 'up' : 'down');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return normalizedItems;
    return normalizedItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false)
    );
  }, [normalizedItems, query, searchable]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(-1);
      return;
    }
    if (searchable) {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) return;
    if (effectiveDirection === 'up') {
      setActualDirection('up');
    } else if (effectiveDirection === 'down') {
      setActualDirection('down');
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setActualDirection(spaceBelow < (searchable ? 320 : 240) ? 'up' : 'down');
    }
  }, [isOpen, effectiveDirection, searchable]);

  const selectedItem = normalizedItems.find((item) => item.value === effectiveSelectedValue);

  const handleSelect = useCallback(
    (item: DropdownItem<T>) => {
      if (item.disabled) return;
      onSelect?.(item.value);
      onChange?.(item.value);
      setIsOpen(false);
    },
    [onSelect, onChange]
  );

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(visibleItems.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = visibleItems[activeIndex >= 0 ? activeIndex : 0];
      if (target) handleSelect(target);
    }
  };

  return (
    <div className={`relative ${fullWidth ? 'block w-full' : 'inline-block'} ${className}`} ref={containerRef}>
      {/* Trigger */}
      {typeof trigger === 'function' ? (
        <div onClick={() => !disabled && setIsOpen(!isOpen)}>{trigger(isOpen, selectedItem)}</div>
      ) : trigger ? (
        <div onClick={() => !disabled && setIsOpen(!isOpen)}>{trigger}</div>
      ) : fullWidth ? (
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full flex items-center justify-between gap-2 bg-slate-900/90 hover:bg-slate-800/60 backdrop-blur-sm border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-sm text-left hover:border-slate-500 transition-all duration-150 cursor-pointer select-none ${
            isOpen ? 'ring-2 ring-sky-500/40 border-sky-500 bg-slate-800' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {(selectedItem?.icon ?? icon) && (
              <span className="material-symbols-outlined text-[18px] text-sky-400 flex-shrink-0">
                {selectedItem?.icon ?? icon}
              </span>
            )}
            <span className={`truncate ${selectedItem ? 'text-slate-100 font-semibold' : 'text-slate-400'}`}>
              {selectedItem?.label ?? placeholder}
            </span>
          </span>
          <span
            className={`material-symbols-outlined text-[18px] text-slate-400 flex-shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-sky-400' : ''
            }`}
          >
            expand_more
          </span>
        </button>
      ) : isPagination ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between gap-1.5 bg-slate-900/90 hover:bg-slate-800/60 backdrop-blur-sm border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:border-slate-500 transition-all duration-150 cursor-pointer select-none ${
            isOpen ? 'ring-2 ring-sky-500/30 border-sky-500 bg-slate-800' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>{selectedItem?.label ?? String(effectiveSelectedValue ?? '')}</span>
          <span
            className={`material-symbols-outlined text-[14px] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-sky-400' : ''
            }`}
          >
            expand_more
          </span>
        </button>
      ) : (
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800/60 backdrop-blur-sm border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs text-slate-300 hover:border-slate-500 transition-all duration-150 cursor-pointer select-none ${
            isOpen ? 'ring-2 ring-sky-500/30 border-sky-500 bg-slate-800' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {icon && <span className="material-symbols-outlined text-[16px] text-sky-400">{icon}</span>}
          {label && <span className="text-slate-400">{label}:</span>}
          <span className="text-slate-100 font-semibold truncate max-w-[140px]">
            {selectedItem?.label ?? placeholder}
          </span>
          <span
            className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-sky-400' : ''
            }`}
          >
            expand_more
          </span>
        </button>
      )}

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          className={`absolute ${
            actualDirection === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${effectiveMenuWidth} bg-slate-900/98 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/80 border border-slate-700/80 py-1.5 z-50 animate-scaleUp overflow-hidden`}
        >
          {searchable && (
            <div className="px-2 pt-1.5 pb-1 border-b border-slate-800">
              <div className="flex items-center gap-2 bg-slate-800/80 rounded-lg px-2.5 py-1.5 border border-slate-700/60 focus-within:ring-2 focus-within:ring-sky-500/40">
                <span className="material-symbols-outlined text-[16px] text-slate-400">search</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="flex-1 min-w-0 bg-transparent outline-none border-none text-xs text-slate-200 placeholder:text-slate-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="material-symbols-outlined text-[16px] text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Clear search"
                  >
                    close
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1 space-y-0.5" role="listbox">
            {searchable && visibleItems.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-slate-400">{emptyMessage}</div>
            )}
            {visibleItems.map((item, index) => {
              const isSelected = item.value === effectiveSelectedValue;
              const isActive = searchable && index === activeIndex;

              if (isPagination) {
                return (
                  <button
                    key={`${item.label}-${index}`}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => handleSelect(item)}
                    className={`w-full text-center px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none ${
                      item.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isSelected
                        ? 'bg-sky-600 text-white font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              }

              return (
                <button
                  key={`${item.label}-${index}`}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-all duration-150 cursor-pointer select-none ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-sky-950/70 text-sky-300 font-bold border border-sky-800/60 shadow-sm'
                      : isActive
                      ? 'bg-slate-800 text-sky-400 ring-1 ring-sky-500/30'
                      : item.danger
                      ? 'text-rose-400 hover:bg-rose-950/40 hover:text-rose-200'
                      : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.icon && (
                      <span
                        className={`material-symbols-outlined text-[18px] transition-colors ${
                          item.danger ? 'text-rose-400' : isSelected ? 'text-sky-400' : 'text-slate-400'
                        }`}
                      >
                        {item.icon}
                      </span>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.description && (
                        <span className="text-[11px] text-slate-400 truncate">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.badge !== undefined && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {item.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span className="material-symbols-outlined text-sky-400 text-[18px]">check</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
