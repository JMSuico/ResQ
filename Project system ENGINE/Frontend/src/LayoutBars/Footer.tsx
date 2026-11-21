// [Layer: LayoutBars]
// Responsibility: Tactical command footer in Official Cherry (#400014) & Warm Ivory (#F7F1EA) Stitch styling.
// ResQTrack Incident AI System Detection -- Universal Lucide icon standard with zero raw SVGs.

import React from 'react';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="footer w-full py-3.5 px-4 sm:px-6 rounded-2xl border border-[#FFD9DD]/18 bg-[#400014]/90 text-xs sm:text-sm text-[#FFD9DD] flex flex-col sm:flex-row items-center justify-between gap-2 select-none shadow-[0_12px_28px_rgba(43,1,14,0.35)] transition-all"
      role="contentinfo"
      aria-label="ResQTrack System Footer"
    >
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#F7F1EA] flex-shrink-0" aria-hidden="true" />
        <span className="font-bold text-[#F7F1EA]">ResQTrack</span>
        <span className="text-[#A83B4D]" aria-hidden="true">&bull;</span>
        <span className="truncate text-[#FFD9DD]">Katipunan Emergency Response</span>
      </div>

      <span className="text-xs text-[#E9D9D0]">
        &copy; {currentYear} Municipality of Katipunan, Zamboanga del Norte
      </span>
    </footer>
  );
};

export default Footer;
