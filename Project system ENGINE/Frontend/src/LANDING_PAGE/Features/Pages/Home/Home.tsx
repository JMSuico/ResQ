// [Layer: LANDING_PAGE/Features/Pages/Home]
// Responsibility: Public emergency overview, duty agency status, hotlines, and quick actions.
// DO NOT expose admin management actions on public home screens.

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/Shared/Button';
import { AGENCY_METADATA } from '@/Libs/Assets/data';

export const Home: React.FC = () => {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Command Banner */}
      <section className="w-full py-20 px-6 bg-gradient-to-b from-slate-900 via-command-dark to-command-dark border-b border-slate-800 text-center flex flex-col items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:32px_32px] opacity-10 pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-700/60 text-xs font-mono text-rose-300 mb-6 shadow-md shadow-rose-950/40">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>MUNICIPAL 24/7 JOINT EMERGENCY TRIAGE SYSTEM</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight max-w-4xl leading-tight">
          Deterministic AI Emergency <br />
          <span className="bg-gradient-to-r from-rose-500 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
            Detection & Multi-Agency Dispatch
          </span>
        </h1>

        <p className="mt-6 text-base md:text-lg text-slate-400 max-w-2xl">
          Empowering LDRRMO Command, RHU Medical Teams, BFP Firefighters, PNP Officers, and UG Residents with real-time biometric verification, live camera accident reporting, and GPS dispatch triage.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/register">
            <Button variant="danger" size="lg" className="shadow-lg shadow-rose-950/60">
              Create Verified Account
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="lg">
              Sign In to Operational Portal
            </Button>
          </Link>
        </div>
      </section>

      {/* Emergency Units Strip */}
      <section className="w-full max-w-6xl py-16 px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white">Integrated Multi-Agency Response Force</h2>
          <p className="text-sm text-slate-400 mt-1">Inter-connected under a unified deterministic triage state engine</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(AGENCY_METADATA).map(([key, meta]) => (
            <div key={key} className="tactical-card p-5 flex flex-col justify-between hover:border-slate-600 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold" style={{ backgroundColor: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
                    {meta.short}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">{meta.name}</h3>
                <p className="text-xs text-slate-400 mt-2">{meta.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase">DIRECT HOTLINE</span>
                <span className="text-xs font-mono font-bold text-sky-400">{meta.hotline}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
