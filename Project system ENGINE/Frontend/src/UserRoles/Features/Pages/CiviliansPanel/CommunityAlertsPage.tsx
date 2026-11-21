// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Minimal guidance view for legacy /civilian/alerts route,
// directing residents to the Dashboard and Live Map evacuation safe zones.
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { CivilianButton } from './Shared/CivilianButton';

export const CommunityAlertsPage: React.FC = () => (
  <div className="flex flex-col gap-6 w-full pb-12">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F7F1EA]/20 pb-4">
      <div>
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
          Katipunan Guidance
        </span>
        <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
          Public Safety Guidance
        </h1>
      </div>
    </div>

    <div className="clay-surface p-6 sm:p-8 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 shadow-[0_14px_34px_rgba(74,4,26,0.22)] flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-6 h-6 text-[#670626]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#670626]">
            Evacuation Safe Zones &amp; Live Map
          </h2>
          <p className="text-sm text-[#A83B4D]">
            Safe zones and verified advisories are consolidated on the Dashboard and Live Map.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/civilian/dashboard">
          <CivilianButton
            variant="primary"
            size="md"
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
          >
            Go to Dashboard
          </CivilianButton>
        </Link>
        <Link to="/civilian/live-map">
          <CivilianButton variant="outline" size="md">
            Open Live Map
          </CivilianButton>
        </Link>
      </div>
    </div>
  </div>
);

export default CommunityAlertsPage;
