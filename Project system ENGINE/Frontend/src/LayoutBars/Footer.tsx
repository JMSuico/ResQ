// [Layer: LayoutBars]
// Responsibility: Tactical command footer with system telemetry signature, system release tier, and responsive HUD framing.
// ResQTrack Incident AI System Detection -- Universal Lucide icon standard with zero raw SVGs.

import React from 'react';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="footer w-full py-3 px-4 sm:px-6 border-t border-white/5 bg-slate-950/80 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 select-none transition-all"
      role="contentinfo"
      aria-label="ResQTrack System Footer"
    >
      <div className="flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" aria-hidden="true" />
        <span className="font-semibold text-slate-300">ResQTrack</span>
        <span className="text-slate-600" aria-hidden="true">&bull;</span>
        <span className="truncate">Katipunan Emergency Response</span>
      </div>

      <span className="text-[11px] text-slate-500">
        &copy; {currentYear} Municipality of Katipunan, Zamboanga del Norte
      </span>
    </footer>
  );
};

export default Footer;
