// [Layer: LANDING_PAGE/Features/Pages/RegisterPage]
// Responsibility: Compact Deep Burgundy status banner for silent background Government ID authenticity and OCR verification.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, lucide-react icons only, and 100% Universal Arrow Lambda syntax (=>).

import React from 'react';
import {
  AlertTriangle,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Upload
} from 'lucide-react';
import type {
  IdVerificationErrorCode,
  IdVerificationStatus
} from '@/Hooks/useBackgroundIdVerification';

export interface IdVerificationBannerProps {
  readonly status: IdVerificationStatus;
  readonly errorCode: IdVerificationErrorCode | null;
  readonly errorMessage: string | null;
  readonly detectedIdLabel?: string | null;
  readonly hasFrontImage: boolean;
  readonly hasBackImage: boolean;
  readonly hasStandbyToken?: boolean;
  readonly onRetry: () => void;
}

export const IdVerificationBanner: React.FC<IdVerificationBannerProps> = ({
  status,
  errorCode,
  errorMessage,
  detectedIdLabel,
  hasFrontImage,
  hasBackImage,
  hasStandbyToken = false,
  onRetry
}) => {
  const resolveIdleHint = (): string => {
    if (!hasFrontImage && !hasBackImage) {
      return 'Upload Front & Back ID images to verify.';
    }
    if (!hasFrontImage) {
      return 'Upload Front ID.';
    }
    return 'Upload Back ID.';
  };

  return (
    <div
      id="id-verification-banner"
      data-verification-status={status}
      data-error-code={errorCode ?? undefined}
      className={`id-verification-banner mt-4 rounded-xl border p-3.5 transition-all ${
        status === 'VERIFIED_GENUINE'
          ? 'id-verification-banner--verified border-emerald-500/45 bg-[#121c18]/90 text-emerald-100'
          : status === 'PENDING_MANUAL_REVIEW'
          ? 'id-verification-banner--pending border-amber-500/45 bg-[#23140b]/90 text-amber-100'
          : status === 'REJECTED_LOCAL' || status === 'REJECTED_AI'
          ? 'id-verification-banner--rejected border-rose-500/60 bg-[#2a0913]/95 text-rose-100'
          : status === 'VERIFYING'
          ? 'id-verification-banner--verifying border-rose-500/40 bg-[#1c080e]/90 text-rose-100'
          : 'id-verification-banner--idle border-rose-500/25 bg-[#14020a]/80 text-slate-300'
      }`}
    >
      {status === 'IDLE' && (
        <div className="flex items-center gap-2.5 font-mono text-[11px] text-rose-200/85">
          <div className="p-1.5 rounded-lg bg-rose-950/70 border border-rose-500/30 shrink-0">
            <Upload className="w-4 h-4 text-[#ff5c74]" />
          </div>
          <span>{resolveIdleHint()}</span>
        </div>
      )}

      {status === 'VERIFYING' && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 font-mono text-[11px] text-rose-100"
        >
          <div className="p-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 shrink-0">
            <Loader2 className="w-4 h-4 text-[#ff5c74] animate-spin" />
          </div>
          <span>Verifying Government ID…</span>
        </div>
      )}

      {status === 'VERIFIED_GENUINE' && (
        <div
          id="badge-id-verified-genuine"
          role="status"
          aria-live="polite"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/45 shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#5fe0a4]" />
            </div>
            <div>
              <div className="font-mono text-[11.5px] font-bold text-[#5fe0a4]">
                ID Verified
              </div>
              {detectedIdLabel && (
                <div className="font-mono text-[10px] text-emerald-200/80 mt-0.5">
                  {detectedIdLabel}
                </div>
              )}
            </div>
          </div>
          {hasStandbyToken && (
            <span className="self-start sm:self-center shrink-0 px-2.5 py-1 rounded border border-emerald-500/40 bg-emerald-950/70 font-mono text-[9.5px] font-bold uppercase tracking-wider text-emerald-200">
              Token Ready
            </span>
          )}
        </div>
      )}

      {status === 'PENDING_MANUAL_REVIEW' && (
        <div
          id="badge-id-pending-manual"
          role="status"
          aria-live="polite"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-500/45 shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#ffb454]" />
            </div>
            <div>
              <div className="font-mono text-[11.5px] font-bold text-[#ffb454]">
                AI Unavailable — Manual Review
              </div>
              {errorMessage && (
                <div className="font-sans text-[11px] text-amber-200/85 mt-0.5">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            id="btn-retry-id-verify"
            onClick={onRetry}
            className="id-verification-banner__retry-btn self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg border border-amber-500/45 bg-amber-950/60 hover:bg-amber-900/70 text-amber-100 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {(status === 'REJECTED_LOCAL' || status === 'REJECTED_AI') && (
        <div
          id="banner-id-rejected"
          role="alert"
          data-error-code={errorCode ?? undefined}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-950 border border-rose-500/50 shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4 text-[#ff5c74]" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#ff5c74]">
                  ID Rejected
                </span>
                {errorCode && (
                  <span className="px-2 py-0.5 rounded bg-rose-950/90 border border-rose-500/45 font-mono text-[9.5px] font-bold text-rose-200">
                    {errorCode}
                  </span>
                )}
              </div>
              <p className="font-sans text-xs text-rose-100/95 leading-relaxed m-0">
                {errorMessage ||
                  'Upload clear Front & Back ID photos matching your selected ID type.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-retry-id-verify"
            onClick={onRetry}
            className="id-verification-banner__retry-btn self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg border border-[#ff5c74]/60 bg-rose-950/80 hover:bg-rose-900 text-white font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default IdVerificationBanner;
