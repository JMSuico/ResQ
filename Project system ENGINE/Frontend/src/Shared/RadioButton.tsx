// [Layer: Shared]
// RadioButton.tsx -- Universal atomic RadioButton and RadioGroup primitives for ResQTrack.
// Accessible across LDRRMO Admin, RHU, Fire, and PNP tactical dashboards.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC, InputHTMLAttributes, ReactNode } from 'react';

export interface RadioButtonProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const RadioButton: FC<RadioButtonProps> = ({
  label,
  description,
  checked,
  disabled,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (typeof label === 'string' ? `radio-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none transition-opacity ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
      } ${className}`}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="radio"
          id={inputId}
          checked={checked}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <div className="w-4 h-4 rounded-full border border-slate-600 bg-slate-900 peer-checked:border-sky-500 peer-checked:bg-sky-500 transition-all duration-150 flex items-center justify-center shadow-sm peer-focus:ring-2 peer-focus:ring-sky-500/40">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950 opacity-0 peer-checked:opacity-100 transition-opacity" />
        </div>
      </div>

      {(label || description) && (
        <div className="flex flex-col text-xs">
          {label && <span className={`font-semibold ${checked ? 'text-slate-100' : 'text-slate-300'}`}>{label}</span>}
          {description && <span className="text-[11px] text-slate-400 mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
};

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  badge?: string | number;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  selectedValue: string;
  onChange: (value: string) => void;
  label?: string;
  direction?: 'row' | 'col';
  variant?: 'card' | 'simple';
  className?: string;
}

export const RadioGroup: FC<RadioGroupProps> = ({
  name,
  options,
  selectedValue,
  onChange,
  label,
  direction = 'row',
  variant = 'card',
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
          {label}
        </span>
      )}

      <div className={`flex flex-wrap ${direction === 'col' ? 'flex-col' : 'flex-row'} gap-2`}>
        {options.map((opt) => {
          const isSelected = selectedValue === opt.value;

          if (variant === 'simple') {
            return (
              <RadioButton
                key={opt.value}
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={() => onChange(opt.value)}
                label={opt.label}
                description={opt.description}
              />
            );
          }

          return (
            <label
              key={opt.value}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-all duration-150 select-none ${
                isSelected
                  ? 'bg-sky-950/70 border-sky-500 text-sky-300 font-bold shadow-md shadow-sky-950/40 ring-1 ring-sky-500/30'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600 hover:text-slate-100'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={() => onChange(opt.value)}
                className="w-4 h-4 accent-sky-500 cursor-pointer"
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  {opt.icon && <span className="material-symbols-outlined text-[18px] text-sky-400">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                  {opt.badge !== undefined && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300">
                      {opt.badge}
                    </span>
                  )}
                </div>
                {opt.description && (
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    {opt.description}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default RadioButton;
