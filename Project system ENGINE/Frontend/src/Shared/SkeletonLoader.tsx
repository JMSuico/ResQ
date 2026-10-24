// [Layer: Shared]
// SkeletonLoader.tsx -- Loading animation placeholders (line, circle, card, and rect variants).
// Shimmer loading skeleton with line, circle, and card variants for asynchronous telemetry & UI states.
// Universal lambda expressions (=>).
// DO NOT put feature-specific or API business logic here.

import React, { FC } from 'react';

export interface SkeletonLoaderProps {
  variant?: 'line' | 'circle' | 'card' | 'rect';
  rows?: number;
  className?: string;
}

export const SkeletonLoader: FC<SkeletonLoaderProps> = ({
  variant = 'line',
  rows = 1,
  className = '',
}) => {
  if (variant === 'circle') {
    return (
      <div
        className={`rounded-full bg-slate-800/80 border border-slate-700/30 animate-pulse ${className}`}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={`rounded-xl bg-slate-900/90 p-4 border border-slate-700/80 shadow-lg flex flex-col gap-3 animate-pulse ${className}`}
      >
        <div className="h-36 bg-slate-800/80 rounded-lg w-full border border-slate-700/30" />
        <div className="h-4 bg-slate-800/80 rounded-md w-3/4" />
        <div className="h-3 bg-slate-800/60 rounded-md w-1/2" />
      </div>
    );
  }

  if (variant === 'rect') {
    return (
      <div
        className={`rounded-lg bg-slate-800/80 border border-slate-700/30 animate-pulse ${className}`}
      />
    );
  }

  if (rows > 1) {
    return (
      <div className={`flex flex-col gap-2.5 animate-pulse ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-9 bg-slate-800/70 rounded-lg border border-slate-700/30 w-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`h-4 rounded-md bg-slate-800/80 border border-slate-700/30 animate-pulse ${className}`}
    />
  );
};

export default SkeletonLoader;
