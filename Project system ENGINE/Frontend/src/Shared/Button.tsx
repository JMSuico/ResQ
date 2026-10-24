// [Layer: Shared]
// Button.tsx -- Atomic styled button primitive for ResQTrack and ported subsystems.
// Supports semantic variants (primary, secondary, danger, ghost, outline, soft-blue, action-green, warning, success),
// responsive sizes (xs, sm, md, lg), icon integration, loading spinners, and disabled states.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'action-green'
  | 'danger'
  | 'warning'
  | 'success'
  | 'ghost'
  | 'outline'
  | 'soft-blue';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button: FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold tracking-wide transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const sizeClasses: Record<ButtonSize, string> = {
    xs: 'px-2.5 py-1 text-[11px] gap-1 rounded-md',
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-4 py-2 text-sm gap-2 rounded-lg',
    lg: 'px-5 py-2.5 text-base gap-2.5 rounded-xl',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white border border-sky-400/30 hover:border-sky-300/60 focus:ring-sky-500 shadow-md shadow-sky-950/60',
    secondary:
      'bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 focus:ring-slate-500 shadow-sm backdrop-blur-sm',
    'action-green':
      'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border border-emerald-400/30 hover:border-emerald-300/60 focus:ring-emerald-500 shadow-md shadow-emerald-950/60 font-bold',
    success:
      'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border border-emerald-400/30 hover:border-emerald-300/60 focus:ring-emerald-500 shadow-md shadow-emerald-950/60',
    danger:
      'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white border border-rose-400/30 hover:border-rose-300/60 focus:ring-rose-500 shadow-md shadow-rose-950/60',
    warning:
      'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white border border-amber-400/30 hover:border-amber-300/60 focus:ring-amber-500 shadow-md shadow-amber-950/60',
    ghost:
      'bg-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white focus:ring-slate-700',
    outline:
      'bg-transparent border border-slate-600/80 hover:border-slate-400 text-slate-200 hover:bg-slate-800/60 hover:text-white focus:ring-sky-500',
    'soft-blue':
      'bg-sky-950/70 text-sky-300 border border-sky-800/60 hover:bg-sky-900/80 hover:text-sky-100 hover:border-sky-700/80 focus:ring-sky-500 font-semibold backdrop-blur-sm',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return <span className="material-symbols-outlined text-[1.15em] leading-none select-none">{icon}</span>;
    }
    return <span className="flex-shrink-0 inline-flex items-center justify-center">{icon}</span>;
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        ...props.style
      }}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 text-current flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : iconPosition === 'left' ? (
        renderIcon()
      ) : null}

      {children && <span>{children}</span>}

      {!isLoading && iconPosition === 'right' ? renderIcon() : null}
    </button>
  );
};

export default Button;
