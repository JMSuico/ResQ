// [Layer: Shared]
// Dropdown.tsx -- Universal generic floating dropdown menu and selection panel.
// Supports custom trigger, icons, badges, click-outside auto-close (useRef), and keyboard access.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { ReactNode, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

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
          className={`w-full flex items-center justify-between gap-2 bg-[#FFFBF7] hover:bg-[#F7F1EA] border border-[#D8C1B5] px-3.5 py-2.5 rounded-xl text-sm text-left hover:border-[#A83B4D] transition-all duration-150 cursor-pointer select-none ${
            isOpen ? 'ring-2 ring-[#A83B4D]/35 border-[#670626] bg-[#FFFBF7]' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {(selectedItem?.icon ?? icon) && (
              <span className="material-symbols-outlined text-[18px] text-[#A83B4D] flex-shrink-0">
                {selectedItem?.icon ?? icon}
              </span>
            )}
            <span className={`truncate ${selectedItem ? 'text-[#3B1722] font-semibold' : 'text-[#9B727D]'}`}>
              {selectedItem?.label ?? placeholder}
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#7A4E59] flex-shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#670626]' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      ) : isPagination ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between gap-1.5 bg-[#F7F1EA] hover:bg-[#E9D9D0]/70 border border-[#D4B8AA] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#670626] hover:border-[#A83B4D] transition-all duration-150 cursor-pointer select-none ${
            isOpen ? 'ring-2 ring-[#A83B4D]/30 border-[#670626]' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>{selectedItem?.label ?? String(effectiveSelectedValue ?? '')}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#670626]' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 bg-[#F7F1EA] hover:bg-[#E9D9D0]/70 border border-[#D4B8AA] px-3.5 py-2 rounded-xl text-sm text-[#5C313E] hover:border-[#A83B4D] transition-all duration-150 cursor-pointer select-none ${
            isOpen ? 'ring-2 ring-[#A83B4D]/30 border-[#670626]' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {icon && <span className="material-symbols-outlined text-[16px] text-[#A83B4D]">{icon}</span>}
          {label && <span className="text-[#7A4E59]">{label}:</span>}
          <span className="text-[#3B1722] font-semibold truncate max-w-[140px]">
            {selectedItem?.label ?? placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[#7A4E59] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#670626]' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      )}

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          className={`clay-surface absolute ${
            actualDirection === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${effectiveMenuWidth} bg-[#F7F1EA] rounded-xl shadow-[0_18px_40px_-10px_rgba(103,6,38,0.28)] border border-[#E9D9D0] py-1.5 z-50 animate-scaleUp overflow-hidden`}
        >
          {searchable && (
            <div className="px-2 pt-1.5 pb-1 border-b border-[#E9D9D0]">
              <div className="flex items-center gap-2 bg-[#FFFBF7] rounded-lg px-2.5 py-1.5 border border-[#D8C1B5] focus-within:ring-2 focus-within:ring-[#A83B4D]/30">
                <Search className="w-4 h-4 text-[#7A4E59] shrink-0" aria-hidden="true" />
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
                  className="flex-1 min-w-0 bg-transparent outline-none border-none text-sm text-[#3B1722] placeholder:text-[#9B727D]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="text-[#7A4E59] hover:text-[#670626] cursor-pointer flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1 space-y-0.5" role="listbox">
            {searchable && visibleItems.length === 0 && (
              <div className="px-3 py-3 text-center text-sm text-[#7A4E59]">{emptyMessage}</div>
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
                        ? 'bg-[#670626] text-[#F7F1EA] font-bold'
                        : 'text-[#3B1722] hover:bg-[#E9D9D0]/70'
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
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-all duration-150 cursor-pointer select-none ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-[#F3E4E7] text-[#670626] font-bold border border-[#A83B4D]/35 shadow-sm'
                      : isActive
                      ? 'bg-[#E9D9D0]/80 text-[#670626] ring-1 ring-[#A83B4D]/30'
                      : item.danger
                      ? 'text-[#991B1B] hover:bg-rose-100'
                      : 'text-[#3B1722] hover:bg-[#E9D9D0]/70 hover:text-[#670626]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.icon && (
                      <span
                        className={`material-symbols-outlined text-[18px] transition-colors ${
                          item.danger ? 'text-[#991B1B]' : isSelected ? 'text-[#670626]' : 'text-[#7A4E59]'
                        }`}
                      >
                        {item.icon}
                      </span>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-[#7A4E59] truncate">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.badge !== undefined && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E9D9D0] text-[#670626] border border-[#D4B8AA]">
                        {item.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#670626] flex-shrink-0" aria-hidden="true" />
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
