// [Layer: Shared]
// ColleagueMentionPicker.tsx -- Debounced same-unit responder colleague @mention search & chip selector.
// Universal arrow lambdas (=>). ZERO 'any', ZERO emojis.

import React, { FC, useEffect, useRef, useState } from 'react';
import { Users, Search, X, Check, Loader2, Shield } from 'lucide-react';
import { ColleagueResponderItem, getUnitColleagues } from '@/Endpoints/responderOpsApi';

export interface ColleagueMentionPickerProps {
  unitLabel?: string;
  selectedColleagues: ColleagueResponderItem[];
  onChange: (next: ColleagueResponderItem[]) => void;
  disabled?: boolean;
  label?: string;
}

const SEARCH_DEBOUNCE_MS = 260;

export const ColleagueMentionPicker: FC<ColleagueMentionPickerProps> = ({
  unitLabel,
  selectedColleagues,
  onChange,
  disabled = false,
  label = 'Tag Colleague Responders'
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<ColleagueResponderItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (disabled || !isOpen) return;
    let isCancelled = false;

    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setErrorText(null);
      void getUnitColleagues(query, unitLabel)
        .then((items) => {
          if (!isCancelled) {
            setResults(Array.isArray(items) ? items : []);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setResults([]);
            setErrorText('Unable to load unit colleagues.');
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, unitLabel, disabled, isOpen]);

  const isSelected = (colleagueId: string): boolean =>
    selectedColleagues.some((c) => c.id === colleagueId);

  const handleToggleColleague = (item: ColleagueResponderItem) => {
    if (disabled) return;
    if (isSelected(item.id)) {
      onChange(selectedColleagues.filter((c) => c.id !== item.id));
    } else {
      onChange([...selectedColleagues, item]);
    }
  };

  const handleRemoveColleague = (colleagueId: string) => {
    if (disabled) return;
    onChange(selectedColleagues.filter((c) => c.id !== colleagueId));
  };

  const scopedUnitText = unitLabel ? unitLabel.toUpperCase() : 'ASSIGNED UNIT';

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#670626]">
          <Users className="w-3.5 h-3.5 text-[#A83B4D]" />
          <span>{label}</span>
        </label>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E9D9D0] border border-[#D4B8AA] text-[11px] font-mono font-bold text-[#670626]">
          <Shield className="w-3 h-3 text-[#A83B4D]" />
          <span>Same-Unit Tagging Only: {scopedUnitText}</span>
        </span>
      </div>

      {/* Selected Colleague Chips */}
      {selectedColleagues.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedColleagues.map((colleague) => (
            <span
              key={colleague.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#670626] text-[#F7F1EA] text-xs font-mono font-semibold shadow-sm"
            >
              <span>
                @{colleague.fullName}
                {colleague.rankOrTitle ? ` · ${colleague.rankOrTitle}` : ''}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveColleague(colleague.id)}
                  className="p-0.5 rounded-full hover:bg-[#A83B4D] transition-colors cursor-pointer"
                  aria-label={`Remove ${colleague.fullName}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search Input & Dropdown */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#7A4E59] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={query}
            disabled={disabled}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            placeholder="Search colleague by name, rank, or unit ID..."
            className="w-full pl-9 pr-9 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-xs font-mono text-[#3B1722] placeholder-[#9B727D] focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#A83B4D]/25 disabled:opacity-50"
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 text-[#670626] animate-spin absolute right-3 pointer-events-none" />
          )}
        </div>

        {isOpen && !disabled && (
          <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-[#D4B8AA] bg-[#FFFBF7] shadow-[0_12px_28px_-6px_rgba(103,6,38,0.22)] divide-y divide-[#E9D9D0] z-30">
            {errorText ? (
              <div className="p-3 text-xs font-mono text-[#991B1B]">{errorText}</div>
            ) : isLoading && results.length === 0 ? (
              <div className="p-3 text-xs font-mono text-[#7A4E59] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#670626]" />
                <span>Searching unit roster...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-3 text-xs font-mono text-[#7A4E59]">
                No matching same-unit colleagues found.
              </div>
            ) : (
              results.map((item) => {
                const active = isSelected(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleColleague(item)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active ? 'bg-emerald-50/90' : 'hover:bg-[#E9D9D0]/55'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#3B1722] truncate">
                          {item.fullName}
                        </span>
                        {item.rankOrTitle && (
                          <span className="px-1.5 py-0.5 rounded bg-[#E9D9D0] text-[10px] font-mono font-bold text-[#670626] flex-shrink-0">
                            {item.rankOrTitle}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#7A4E59] truncate">
                        {item.unit} {item.employeeOrResidentId ? `· ID: ${item.employeeOrResidentId}` : ''}
                      </div>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${
                        active
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-[#F7F1EA] border-[#D4B8AA] text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ColleagueMentionPicker;
