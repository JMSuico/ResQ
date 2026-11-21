// [Layer: Shared]
// Checkbox.tsx -- Accessible, theme-styled Checkbox primitive with checked, unchecked, and indeterminate support.
// Universal component for table headers, item rows, filters, batch operations, and incident triage.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC, useEffect, useRef } from 'react';
import { Check, Minus } from 'lucide-react';

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
              ? 'bg-[#670626] border-[#670626] text-[#F7F1EA] shadow-sm ring-1 ring-[#A83B4D]/35'
              : 'bg-[#FFFBF7] border-[#D4B8AA] hover:border-[#670626] text-transparent'
          } ${disabled ? 'bg-[#E9D9D0] border-[#D4B8AA]' : ''}`}
        >
          {indeterminate ? (
            <Minus className="w-2.5 h-2.5 text-[#F7F1EA] stroke-[2.5]" />
          ) : (
            <Check
              className={`w-3 h-3 text-[#F7F1EA] stroke-[2.5] transition-transform duration-150 ${
                checked ? 'scale-100' : 'scale-0'
              }`}
            />
          )}
        </div>
      </div>
      {label && (
        <span className="text-sm text-[#3B1722] leading-tight">
          {label}
        </span>
      )}
    </label>
  );
};

export default Checkbox;
