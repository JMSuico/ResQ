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
        className={`rounded-full bg-[#E9D9D0] border border-[#D8C1B5] animate-pulse ${className}`}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={`clay-surface rounded-2xl bg-[#F7F1EA] p-4 border border-[#E9D9D0] shadow-md flex flex-col gap-3 animate-pulse ${className}`}
      >
        <div className="h-36 bg-[#E9D9D0] rounded-xl w-full border border-[#D8C1B5]" />
        <div className="h-4 bg-[#E9D9D0] rounded-md w-3/4" />
        <div className="h-3 bg-[#E9D9D0]/80 rounded-md w-1/2" />
      </div>
    );
  }

  if (variant === 'rect') {
    return (
      <div
        className={`rounded-xl bg-[#E9D9D0] border border-[#D8C1B5] animate-pulse ${className}`}
      />
    );
  }

  if (rows > 1) {
    return (
      <div className={`flex flex-col gap-2.5 animate-pulse ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-9 bg-[#E9D9D0] rounded-xl border border-[#D8C1B5] w-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`h-4 rounded-md bg-[#E9D9D0] border border-[#D8C1B5] animate-pulse ${className}`}
    />
  );
};

export default SkeletonLoader;
