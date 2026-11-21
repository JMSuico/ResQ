// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Clean Cherry / Warm Ivory redirect notice for legacy /responder/alerts route,
// directing field responders to /responder/dashboard and the header Notification Bell.
// Strictly 100% arrow functions (=>), ZERO 'any', ZERO emojis.

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Radio, ShieldCheck } from 'lucide-react';
import { Button } from '@/Shared';

export const ResponderAlerts: React.FC = () => (
  <div className="flex flex-col gap-6 w-full pb-12 select-none">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F7F1EA]/20 pb-4">
      <div>
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
          Responder Operations
        </span>
        <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
          Dispatch Alerts
        </h1>
      </div>
    </div>

    <div className="clay-surface p-6 sm:p-8 rounded-2xl bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 shadow-[0_14px_34px_rgba(74,4,26,0.22)] flex flex-col gap-5">
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-[#670626]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#670626]">
            Alerts Moved to Dashboard
          </h2>
          <p className="text-sm text-[#A83B4D] font-medium mt-0.5">
            Dispatches, verifications, and backup signals appear on the Dashboard and Notification Bell.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#2B010E]">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#670626] flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Use the <strong className="text-[#670626]">Notification Bell</strong> to acknowledge alerts or open the <strong className="text-[#670626]">Dashboard</strong> for live radar.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link to="/responder/dashboard">
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
          >
            Open Dashboard
          </Button>
        </Link>
        <Link to="/responder/incidents">
          <Button
            type="button"
            variant="outline"
            size="md"
            icon={<Radio className="w-4 h-4" />}
          >
            Unit Dispatches
          </Button>
        </Link>
      </div>
    </div>
  </div>
);

export default ResponderAlerts;
