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
    return <div className={`rounded-full bg-slate-800/80 animate-pulse ${className}`} />;
  }

  if (variant === 'card') {
    return (
      <div
        className={`rounded-xl bg-slate-900/90 p-4 border border-slate-700/80 flex flex-col gap-3 animate-pulse ${className}`}
      >
        <div className="h-36 bg-slate-800/80 rounded-lg w-full" />
        <div className="h-4 bg-slate-800/80 rounded w-3/4" />
        <div className="h-3 bg-slate-800/60 rounded w-1/2" />
      </div>
    );
  }

  if (variant === 'rect') {
    return <div className={`rounded-lg bg-slate-800/80 animate-pulse ${className}`} />;
  }

  if (rows > 1) {
    return (
      <div className={`flex flex-col gap-2.5 animate-pulse ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-8 bg-slate-800/70 rounded-md w-full" />
        ))}
      </div>
    );
  }

  return <div className={`h-4 rounded bg-slate-800/80 animate-pulse ${className}`} />;
};

export default SkeletonLoader;
