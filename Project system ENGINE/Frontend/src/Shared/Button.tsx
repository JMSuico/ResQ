// [Layer: Shared]
// Button.tsx -- Atomic styled button primitive for ResQTrack and ported subsystems.
// Supports semantic variants (primary, secondary, danger, ghost, outline, soft-blue, action-green, warning, success),
// responsive sizes (xs, sm, md, lg), icon integration, loading spinners, and disabled states.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

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
    'inline-flex items-center justify-center font-semibold tracking-wide transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A83B4D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F1EA] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const sizeClasses: Record<ButtonSize, string> = {
    xs: 'px-2.5 py-1 text-xs gap-1 rounded-lg',
    sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-xl',
    md: 'px-4 py-2 text-sm gap-2 rounded-xl',
    lg: 'px-5 py-2.5 text-base gap-2.5 rounded-2xl',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-[#670626] hover:bg-[#7D0A30] active:bg-[#52041E] text-[#F7F1EA] border border-[#A83B4D]/45 focus:ring-[#670626] shadow-[0_8px_18px_-4px_rgba(103,6,38,0.35),inset_0_1px_1px_rgba(255,255,255,0.22)]',
    secondary:
      'clay-surface bg-[#E9D9D0] hover:bg-[#DFC9BE] active:bg-[#D4B8AA] text-[#670626] border border-[#D4B8AA] hover:border-[#A83B4D]/50 focus:ring-[#A83B4D] shadow-[0_4px_12px_-3px_rgba(103,6,38,0.14),inset_0_1px_1px_rgba(255,255,255,0.8)]',
    'action-green':
      'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border border-emerald-500/45 focus:ring-emerald-600 shadow-[0_6px_16px_-4px_rgba(5,150,105,0.35),inset_0_1px_1px_rgba(255,255,255,0.22)] font-bold',
    success:
      'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border border-emerald-500/45 focus:ring-emerald-600 shadow-[0_6px_16px_-4px_rgba(5,150,105,0.35),inset_0_1px_1px_rgba(255,255,255,0.22)]',
    danger:
      'bg-[#991B1B] hover:bg-[#B91C1C] active:bg-[#7F1D1D] text-white border border-rose-400/40 focus:ring-[#991B1B] shadow-[0_6px_16px_-4px_rgba(153,27,27,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]',
    warning:
      'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white border border-amber-500/40 focus:ring-amber-600 shadow-[0_6px_16px_-4px_rgba(217,119,6,0.32),inset_0_1px_1px_rgba(255,255,255,0.2)]',
    ghost:
      'bg-transparent text-[#670626] hover:bg-[#E9D9D0]/65 hover:text-[#3B1722] focus:ring-[#A83B4D]',
    outline:
      'bg-[#F7F1EA] hover:bg-[#E9D9D0]/70 border border-[#D4B8AA] hover:border-[#A83B4D] text-[#670626] focus:ring-[#670626] shadow-[0_2px_8px_-2px_rgba(103,6,38,0.1)]',
    'soft-blue':
      'bg-[#F3E4E7] text-[#670626] border border-[#A83B4D]/35 hover:bg-[#E9D9D0] hover:border-[#670626]/50 focus:ring-[#A83B4D] font-semibold shadow-sm',
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
        <Loader2 className="animate-spin h-4 w-4 text-current flex-shrink-0" />
      ) : iconPosition === 'left' ? (
        renderIcon()
      ) : null}

      {children && <span>{children}</span>}

      {!isLoading && iconPosition === 'right' ? renderIcon() : null}
    </button>
  );
};

export default Button;
