// [Layer: LayoutBars]
// Responsibility: Tactical command footer with system telemetry signature, system release tier, and responsive HUD framing.
// ResQTrack Incident AI System Detection -- Universal Lucide icon standard with zero raw SVGs.

import React from 'react';
import { Shield, Heart, Terminal } from 'lucide-react';

const CURRENT_RELEASE_VERSION = 'COMMAND CORE v2.4';
const MUNICIPAL_HOTLINE_LABEL = 'Katipunan Emergency Response System';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="footer w-full py-3 px-4 sm:px-6 border-t border-white/5 bg-slate-950/80 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 select-none transition-all"
      role="contentinfo"
      aria-label="ResQTrack System Footer"
    >
      <div className="flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" aria-hidden="true" />
        <span className="font-semibold text-slate-300">ResQTrack</span>
        <span className="text-slate-600" aria-hidden="true">&bull;</span>
        <span className="truncate">{MUNICIPAL_HOTLINE_LABEL}</span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span>Engineered with</span>
        <Heart className="w-3 h-3 text-rose-400 fill-rose-500/20 flex-shrink-0" aria-hidden="true" />
        <span>for Katipunan First Responders &copy; {currentYear}</span>
      </div>

      <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
        <Terminal className="w-3 h-3 text-cyan-400 flex-shrink-0" aria-hidden="true" />
        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-medium">
          {CURRENT_RELEASE_VERSION}
        </span>
      </div>
    </footer>
  );
};

export default Footer;
