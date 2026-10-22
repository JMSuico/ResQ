// [Layer: Shared]
// Checkbox.tsx -- Accessible, theme-styled Checkbox primitive with checked, unchecked, and indeterminate support.
// Universal component for table headers, item rows, filters, batch operations, and incident triage.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC, useEffect, useRef } from 'react';

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  id?: string;
}

export const Checkbox: FC<CheckboxProps> = ({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  label,
  className = '',
  ariaLabel,
  id,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange?.(e.target.checked);
  };

  const isActive = checked || indeterminate;

  return (
    <label
      className={`inline-flex items-center gap-2 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <input
          ref={inputRef}
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          aria-label={ariaLabel}
          className="peer sr-only"
        />
        <div
          style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px', flexShrink: 0 }}
          className={`w-4 h-4 rounded border transition-all duration-150 flex items-center justify-center ${
            isActive
              ? 'bg-sky-600 border-sky-500 text-white shadow-sm shadow-sky-950/40 ring-1 ring-sky-500/30'
              : 'bg-slate-900 border-slate-600 hover:border-sky-500 text-transparent'
          } ${disabled ? 'bg-slate-800 border-slate-700' : ''}`}
        >
          {indeterminate ? (
            <svg
              style={{ width: '10px', height: '10px', maxWidth: '10px', maxHeight: '10px', display: 'block' }}
              className="w-2.5 h-2.5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          ) : (
            <svg
              style={{ width: '12px', height: '12px', maxWidth: '12px', maxHeight: '12px', display: 'block' }}
              className={`w-3 h-3 text-white transition-transform duration-150 ${
                checked ? 'scale-100' : 'scale-0'
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
      {label && (
        <span className="text-xs text-slate-200 leading-tight">
          {label}
        </span>
      )}
    </label>
  );
};

export default Checkbox;
