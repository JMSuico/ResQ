// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Complete emergency hotline directory and local agency station addresses.
// DO NOT provide invalid or outdated municipal contact numbers.

import React from 'react';
import { AGENCY_METADATA } from '@/Libs/Assets/data';

export const EmergencyHotlinesUnits: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Emergency Hotlines & Station Directory</h2>
        <p className="text-xs text-slate-400 mt-0.5">Direct emergency contacts for municipal medical, fire, police, and disaster teams</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(AGENCY_METADATA).map(([key, meta]) => (
          <div key={key} className="tactical-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded font-mono font-bold text-xs" style={{ backgroundColor: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}50` }}>
                  {meta.short} STATION
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-slate-950 border border-slate-800">
                  24/7 ACTIVE
                </span>
              </div>

              <h3 className="text-base font-bold text-white">{meta.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{meta.description}</p>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase block">DIRECT HOTLINE</span>
                <span className="text-lg font-mono font-black text-sky-400">{meta.hotline}</span>
              </div>
              <a
                href={`tel:${meta.hotline.split('/')[0].trim()}`}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors shadow-md shadow-sky-950/40"
              >
                Call Hotline
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
