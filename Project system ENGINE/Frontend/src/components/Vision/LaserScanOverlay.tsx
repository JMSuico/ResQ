// [Layer: Components/Vision]
// Responsibility: High-fidelity optical laser scan sweep overlay and reticle targeting animation during optical decoding.
// Invariant: Strict TypeScript, ZERO 'any', Universal Lambda syntax (=>).

import React from 'react';
import { Cpu, ShieldCheck } from 'lucide-react';

export interface LaserScanOverlayProps {
  readonly isScanning: boolean;
  readonly progress?: number; // 0 - 100
  readonly label?: string;
  readonly cardCategory?: string;
}

export const LaserScanOverlay: React.FC<LaserScanOverlayProps> = ({
  isScanning,
  progress = 100,
  label = 'DECODING CREDENTIAL MATRIX...',
  cardCategory = 'GOVERNMENT ID'
}) => {
  if (!isScanning) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden rounded-lg">
      {/* 1. Tactical Semi-Transparent Scanning Tint & Vignette */}
      <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-[0.5px]" />

      {/* 2. Optical Grid Fine Scan Lines Raster */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(52, 211, 153, 0.18) 3px, rgba(52, 211, 153, 0.18) 4px)'
        }}
      />

      {/* 3. Sweeping Horizontal Laser Beam */}
      <div
        className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_18px_rgba(52,211,153,0.9),0_0_30px_rgba(6,182,212,0.7)] animate-laser-sweep"
      />

      {/* 4. Secondary Soft Trailing Gradient Wave */}
      <div
        className="absolute inset-x-0 h-16 bg-gradient-to-b from-emerald-500/15 to-transparent animate-laser-sweep pointer-events-none"
      />

      {/* 5. 4 Corner Pulsing Reticle Brackets */}
      <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-emerald-400 shadow-[0_0_10px_#34d399] transition-all" />
      <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-emerald-400 shadow-[0_0_10px_#34d399] transition-all" />
      <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-emerald-400 shadow-[0_0_10px_#34d399] transition-all" />
      <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-emerald-400 shadow-[0_0_10px_#34d399] transition-all" />

      {/* 6. Central Optical Decoding HUD Pill */}
      <div className="absolute inset-x-0 top-3 flex justify-center">
        <div className="px-3.5 py-1 rounded-full bg-black/85 border border-emerald-500/60 shadow-[0_0_15px_rgba(52,211,153,0.4)] flex items-center gap-2 font-mono text-[9px] text-emerald-300 backdrop-blur-md">
          <Cpu className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          <span className="font-bold tracking-wider uppercase">
            {label}
          </span>
          <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-[8px]">
            {progress}%
          </span>
        </div>
      </div>

      {/* 7. Bottom Tactical Standard Verification Pill */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <div className="px-3 py-0.5 rounded bg-black/80 border border-emerald-500/40 text-[8.5px] font-mono text-emerald-400 flex items-center gap-1.5 backdrop-blur-md">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>FRAME FROZEN // {cardCategory.toUpperCase()} // OPTICAL EXTRACTION</span>
        </div>
      </div>
    </div>
  );
};
