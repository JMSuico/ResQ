// [Layer: Shared]
// DefaultFloatingModalCard.tsx -- Standard floating glassmorphic modal wrapper primitive.
// Supports backdrop blur, Escape key dismissal, header with subtitle, body scrolling, customizable footer, and responsive max-width.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC, ReactNode, useEffect, useCallback } from 'react';

export interface DefaultFloatingModalCardProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export type ModalProps = DefaultFloatingModalCardProps;

const SIZE_MAP: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
};

export const DefaultFloatingModalCard: FC<DefaultFloatingModalCardProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size,
  maxWidth,
  children,
  footer,
  className = '',
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const resolvedSize = maxWidth || size || 'lg';
  const maxWidthClass =
    SIZE_MAP[resolvedSize] ||
    (resolvedSize.startsWith('max-w-') ? resolvedSize : `max-w-[${resolvedSize}]`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full ${maxWidthClass} bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex-shrink-0">
          <div className="flex flex-col min-w-0 pr-3">
            <h3 id="modal-title" className="text-base font-bold text-slate-100 flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse flex-shrink-0" />
              <span className="truncate">{title}</span>
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/70 flex items-center justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default DefaultFloatingModalCard;
