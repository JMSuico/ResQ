// [Layer: LANDING_PAGE/Features/Pages/LandingPage]
// Responsibility: Master public tactical landing page showcasing deterministic AI emergency detection,
// multi-agency dispatch mesh, interactive civilian & responder pathways, and direct Sign In / Sign Up gateways.
// DO NOT expose admin management actions on public landing screens.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/Shared/Button';
import { AGENCY_METADATA } from '@/Libs/Assets/data';
import { InkOrbitFeatures } from '@/components/ui';

export const LandingPage: React.FC = () => {
  const [activePathway, setActivePathway] = useState<'civilian' | 'responder'>('civilian');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* 1. STICKY TACTICAL HUD NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 w-full bg-slate-950/90 backdrop-blur-md border-b border-rose-500/20 shadow-lg shadow-black/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Telemetry Indicator */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 via-rose-700 to-rose-950 border border-rose-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(225,29,72,0.4)] group-hover:shadow-[0_0_18px_rgba(225,29,72,0.7)] transition-all">
                <span className="font-mono font-black text-white text-base tracking-tighter">R</span>
              </div>
              <div className="flex flex-col">
                <span className="font-sans font-black text-base text-white tracking-wider flex items-center gap-1.5">
                  RESQTRACK
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                </span>
                <span className="font-mono text-[9px] text-slate-400 tracking-tight -mt-0.5">
                  INCIDENT AI SYSTEM
                </span>
              </div>
            </Link>

            {/* Live Gateway Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-rose-500/30 text-[10px] font-mono text-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>SYS.ONLINE // GATEWAY :5173</span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <div className="hidden md:flex items-center gap-6 font-mono text-xs text-slate-300">
            <a href="#overview" className="hover:text-rose-400 transition-colors">
              OVERVIEW
            </a>
            <a href="#pathways" className="hover:text-rose-400 transition-colors">
              ROLE PATHWAYS
            </a>
            <a href="#agencies" className="hover:text-rose-400 transition-colors">
              RESPONSE FORCE
            </a>
            <a href="#architecture" className="hover:text-rose-400 transition-colors">
              AI ENGINE
            </a>
            <a href="#hotlines" className="hover:text-rose-400 transition-colors">
              HOTLINES
            </a>
          </div>

          {/* Right Action Authentication Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* SIGN IN BUTTON */}
            <Link to="/login">
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold text-slate-200 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:text-white transition-all shadow-sm"
              >
                SIGN IN
              </button>
            </Link>

            {/* SIGN UP / REGISTER BUTTON */}
            <Link to="/register">
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg font-mono text-xs font-black text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border border-rose-400/50 shadow-[0_0_16px_rgba(225,29,72,0.4)] hover:shadow-[0_0_22px_rgba(225,29,72,0.6)] active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span>SIGN UP</span>
                <span className="text-[10px] opacity-80">↗</span>
              </button>
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-2 pb-4 bg-slate-950 border-b border-rose-500/20 space-y-2 font-mono text-xs">
            <a
              href="#overview"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-slate-300 hover:text-rose-400"
            >
              OVERVIEW
            </a>
            <a
              href="#pathways"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-slate-300 hover:text-rose-400"
            >
              ROLE PATHWAYS
            </a>
            <a
              href="#agencies"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-slate-300 hover:text-rose-400"
            >
              RESPONSE FORCE
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-slate-300 hover:text-rose-400"
            >
              AI ENGINE
            </a>
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
              <Link to="/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  SIGN IN
                </Button>
              </Link>
              <Link to="/register" className="flex-1">
                <Button variant="danger" size="sm" className="w-full text-xs">
                  SIGN UP
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* 2. HERO COMMAND SECTION */}
      <section
        id="overview"
        className="relative w-full py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-slate-800 flex flex-col items-center justify-center text-center overflow-hidden"
      >
        {/* Futuristic Tactical Grid & Spotlight */}
        <div className="absolute inset-0 bg-[radial-gradient(#ff5c74_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          {/* Top Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-600/50 text-[11px] font-mono text-rose-300 mb-6 shadow-lg shadow-rose-950/50">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-bold">MUNICIPAL 24/7 JOINT EMERGENCY TRIAGE SYSTEM</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">KATIPUNAN, ZN</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight max-w-4xl">
            Deterministic AI Emergency <br />
            <span className="bg-gradient-to-r from-rose-500 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              Detection & Multi-Agency Dispatch
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed">
            Next-generation unified incident intelligence coordinating LDRRMO Command, RHU Medical Teams, BFP
            Firefighters, PNP Officers, and Municipal Residents with real-time biometric verification, edge camera
            accident analysis, and precision GPS dispatch triage.
          </p>

          {/* DUAL ACTION CTAS: SIGN UP & SIGN IN */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            {/* CTA 1: Create Account / Sign Up */}
            <Link to="/register" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-mono font-black text-sm uppercase tracking-wider text-white bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 hover:from-rose-500 hover:to-rose-600 border border-rose-400/60 shadow-[0_0_28px_rgba(225,29,72,0.45)] hover:shadow-[0_0_36px_rgba(225,29,72,0.7)] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>CREATE VERIFIED ACCOUNT</span>
                <span className="text-xs bg-rose-900/60 px-2 py-0.5 rounded border border-rose-400/40">FREE</span>
              </button>
            </Link>

            {/* CTA 2: Sign In to Portal */}
            <Link to="/login" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-mono font-bold text-sm uppercase tracking-wider text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-rose-500/70 hover:text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <span>SIGN IN TO OPERATIONAL PORTAL</span>
                <span className="text-xs text-sky-400 font-mono">RBAC ↗</span>
              </button>
            </Link>
          </div>

          {/* Tactical Verification Subtext */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 font-mono text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              CIVILIAN 1-TAP SOS CAMERA
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              FIELD RESPONDER HUD
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              ZERO FAKE STATS / 100% DB-BACKED
            </span>
          </div>

          {/* Cutout Visual Showcase */}
          <div className="mt-12 w-full max-w-4xl relative">
            <div className="tactical-card p-6 bg-slate-900/80 border-slate-800 shadow-2xl relative overflow-hidden">
              {/* Military HUD Corner Brackets */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-rose-500/70 rounded-tl-[3px]" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-rose-500/70 rounded-tr-[3px]" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-rose-500/70 rounded-bl-[3px]" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-rose-500/70 rounded-br-[3px]" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                <div className="border-r border-slate-800/80 pr-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    AI VISION FILTER
                  </span>
                  <span className="text-lg font-black font-mono text-emerald-400">LAPLACIAN</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Blur & Spoof Reject</span>
                </div>
                <div className="border-r border-slate-800/80 pr-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    GPS TRACKING
                  </span>
                  <span className="text-lg font-black font-mono text-sky-400">HARDWARE</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">±5m Precision Mesh</span>
                </div>
                <div className="border-r border-slate-800/80 pr-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    RBAC GATEWAY
                  </span>
                  <span className="text-lg font-black font-mono text-rose-400">DYNAMIC</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Auto Role Detection</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    SYSTEM STATUS
                  </span>
                  <span className="text-lg font-black font-mono text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    OPERATIONAL
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">24/7 Municipality</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DUAL ROLE PATHWAYS: CIVILIANS VS RESPONDERS */}
      <section id="pathways" className="w-full py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-sky-400 mb-3">
            <span>CHOOSE YOUR OPERATIONAL PATHWAY</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-wide">
            Designed for Citizens & First Responders
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl mx-auto">
            Experience tailored interfaces customized for instant citizen accident reporting or high-intensity first responder tactical field coordination.
          </p>

          {/* Interactive Toggle Switch */}
          <div className="mt-6 inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
            <button
              type="button"
              onClick={() => setActivePathway('civilian')}
              className={`px-5 py-2 rounded-lg font-bold transition-all ${
                activePathway === 'civilian'
                  ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              👥 FOR MUNICIPAL CIVILIANS
            </button>
            <button
              type="button"
              onClick={() => setActivePathway('responder')}
              className={`px-5 py-2 rounded-lg font-bold transition-all ${
                activePathway === 'responder'
                  ? 'bg-sky-600 text-white shadow-[0_0_12px_rgba(2,132,199,0.5)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🚑 FOR EMERGENCY RESPONDERS
            </button>
          </div>
        </div>

        {/* Pathway Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Pathway 1: Civilian Portal */}
          <div
            className={`tactical-card p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 relative ${
              activePathway === 'civilian'
                ? 'border-rose-500/80 shadow-[0_0_30px_rgba(225,29,72,0.2)] bg-gradient-to-b from-slate-900 to-slate-950'
                : 'border-slate-800 bg-slate-900/60 opacity-80 hover:opacity-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/40 text-xs font-mono font-bold text-rose-400">
                  CITIZEN RESIDENT DISPATCH
                </span>
                <span className="text-xs font-mono text-slate-400">PUBLIC ACCESS</span>
              </div>

              <h3 className="text-2xl font-black text-white">Emergency Citizen Dashboard</h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Empowering every citizen with high-speed emergency reporting tools, instant distress beacons, and live proximity tracking to municipal rescue teams.
              </p>

              <div className="mt-6 space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="text-lg">📸</span>
                  <div>
                    <strong className="text-white block font-sans">1-Tap Camera Accident Report</strong>
                    <span className="text-slate-400">
                      Edge Laplacian blurriness filtering ensures crystal-clear scene capture with automatic GPS geotagging.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="text-lg">🚨</span>
                  <div>
                    <strong className="text-white block font-sans">Tactile SOS Pulsing Beacon</strong>
                    <span className="text-slate-400">
                      High-visibility distress trigger immediately broadcasts live coordinates to LDRRMO dispatchers.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="text-lg">📍</span>
                  <div>
                    <strong className="text-white block font-sans">Real-Time Station Proximity</strong>
                    <span className="text-slate-400">
                      Live Haversine distance and ETA calculations to nearest RHU Clinic, Fire Station, and Police Station.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="text-lg">📢</span>
                  <div>
                    <strong className="text-white block font-sans">Official Public Advisories</strong>
                    <span className="text-slate-400">
                      Instant severe weather alerts, road blockages, and community safety broadcasts.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Civilian Quick Actions */}
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center gap-3">
              <Link to="/register" className="flex-1">
                <Button variant="danger" size="md" className="w-full text-xs font-mono font-bold">
                  REGISTER AS CITIZEN ↗
                </Button>
              </Link>
              <Link to="/login" className="flex-1">
                <Button variant="outline" size="md" className="w-full text-xs font-mono font-bold">
                  CIVILIAN SIGN IN
                </Button>
              </Link>
            </div>
          </div>

          {/* Pathway 2: Responder Portal */}
          <div
            className={`tactical-card p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 relative ${
              activePathway === 'responder'
                ? 'border-sky-500/80 shadow-[0_0_30px_rgba(2,132,199,0.2)] bg-gradient-to-b from-slate-900 to-slate-950'
                : 'border-slate-800 bg-slate-900/60 opacity-80 hover:opacity-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/40 text-xs font-mono font-bold text-sky-400">
                  FIRST RESPONDER FLEET
                </span>
                <span className="text-xs font-mono text-slate-400">TACTICAL ACCESS</span>
              </div>

              <h3 className="text-2xl font-black text-white">Tactical Field Responder HUD</h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Purpose-built mobile-first tactical terminal for RHU Paramedics, BFP Firefighters, and PNP Patrol Officers with zero friction status switches.
              </p>

              <div className="mt-6 space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="text-lg">🛡️</span>
                  <div>
                    <strong className="text-white block font-sans">4-State Tactile Status Toggles</strong>
                    <span className="text-slate-400">
                      1-click transitions between AVAILABLE, EN ROUTE, ON SCENE, and RETURNING with instant database persistence.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="text-lg">⚡</span>
                  <div>
                    <strong className="text-white block font-sans">Agency-Filtered Dispatch Feed</strong>
                    <span className="text-slate-400">
                      Live incident queue isolated to your branch with severity badges, victim counts, and caller details.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="text-lg">🛰️</span>
                  <div>
                    <strong className="text-white block font-sans">GPS Direct Turn-by-Turn Routing</strong>
                    <span className="text-slate-400">
                      Instant 1-tap navigation triggers launching destination coordinates directly to field vehicle mapping.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <span className="text-lg">📋</span>
                  <div>
                    <strong className="text-white block font-sans">Shift Handover & Apparatus Logging</strong>
                    <span className="text-slate-400">
                      Record fuel levels, comms readiness, and medical kits with tamper-evident audit timestamps.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Responder Quick Actions */}
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center gap-3">
              <Link to="/login" className="flex-1">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-950/60 transition-colors"
                >
                  RESPONDER SIGN IN
                </button>
              </Link>
              <Link to="/register" className="flex-1">
                <Button variant="outline" size="md" className="w-full text-xs font-mono font-bold">
                  REGISTER FIELD UNIT
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTEGRATED MULTI-AGENCY RESPONSE FORCE GRID */}
      <section id="agencies" className="w-full py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 mb-3">
            <span>CROSS-AGENCY MUNICIPAL COLLABORATION</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-wide">
            Integrated Multi-Agency Response Force
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl mx-auto">
            Inter-connected under a unified deterministic triage state engine ensuring zero dropped emergencies and zero jurisdictional delays.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(AGENCY_METADATA).map(([key, meta]) => (
            <div
              key={key}
              className="tactical-card p-6 flex flex-col justify-between hover:border-slate-600 transition-colors bg-slate-900/80 relative"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="px-2.5 py-1 rounded text-xs font-mono font-bold"
                    style={{
                      backgroundColor: `${meta.color}20`,
                      color: meta.color,
                      border: `1px solid ${meta.color}40`
                    }}
                  >
                    {meta.short}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    ONLINE
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{meta.name}</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{meta.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[10px] text-slate-400 uppercase">DIRECT HOTLINE</span>
                  <a
                    href={`tel:${meta.hotline.split('/')[0].trim().replace(/[^0-9+]/g, '')}`}
                    className="text-xs font-bold text-sky-400 hover:text-sky-300 underline"
                  >
                    {meta.hotline}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. DETERMINISTIC DISPATCH & INCIDENT TELEMETRY ARCHITECTURE */}
      <section
        id="architecture"
        className="w-full py-16 px-4 md:px-6 bg-[#0a0f1d] border-t border-slate-800 flex flex-col items-center"
      >
        <div className="max-w-6xl w-full">
          <InkOrbitFeatures
            theme="dark"
            brand="ResQTrack AI"
            tag="Deterministic Telemetry"
            title="Deterministic Dispatch &\n*Incident Telemetry* Architecture"
            collaboration={{
              title: "Multi-Agency Coordination Mesh",
              description:
                "LDRRMO Command, RHU Medical, BFP Firefighters, and PNP Patrols stay continuously synchronized with shared telemetry and automated priority routing."
            }}
            reports={{
              title: "Deterministic Incident Verification",
              description:
                "Instantaneous AI severity grading, biometric anti-spoofing verification, and tamper-proof dispatch incident logs."
            }}
            integrations={{
              title: "Joint Tactical Telemetry",
              description:
                "Live data pipelines linking GIS vector layers, edge camera blur detection, GPS geofencing, and rapid unit responder dispatch.",
              tools: ["LDRRMO Command", "RHU Medical", "BFP Fire", "PNP Patrol"]
            }}
            insights={{
              title: "Predictive Municipal Incident Vector",
              description:
                "Real-time municipal risk scoring and response velocity analytics projecting high-risk clusters for strategic pre-deployment.",
              values: [14, 18, 16, 25, 23, 31, 29, 38, 35, 44, 49, 56],
              forecastFrom: 8
            }}
          />
        </div>
      </section>

      {/* 6. DIRECT ACTION FLOATING COMMAND BANNER */}
      <section className="w-full py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-950 border-t border-rose-500/30">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <span className="font-mono text-xs font-bold text-rose-400 uppercase tracking-widest block mb-1">
              READY TO ACCELERATE EMERGENCY RESPONSE?
            </span>
            <h3 className="text-2xl font-black text-white">
              Create an Account or Sign In to Your Station
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Serving Katipunan, Zamboanga del Norte with precision artificial intelligence and real-time response.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <button
                type="button"
                className="px-6 py-2.5 rounded-lg font-mono font-bold text-xs uppercase bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/40 shadow-lg shadow-rose-950/60 transition-colors"
              >
                SIGN UP (REGISTER) ↗
              </button>
            </Link>
            <Link to="/login">
              <button
                type="button"
                className="px-6 py-2.5 rounded-lg font-mono font-bold text-xs uppercase bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
              >
                SIGN IN (LOG IN)
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. MUNICIPAL HOTLINES & COMPLIANCE FOOTER */}
      <footer id="hotlines" className="w-full py-12 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-rose-600 flex items-center justify-center font-mono font-black text-white text-xs">
                R
              </div>
              <span className="font-sans font-black text-sm tracking-wider text-white">RESQTRACK INCIDENT AI</span>
            </div>
            <p className="text-xs text-slate-400 max-w-md">
              Official Municipal Emergency Incident Detection and Multi-Agency Coordination Platform for Local Disaster Risk Reduction & Management.
            </p>
            <span className="font-mono text-[11px] text-slate-500">
              © {new Date().getFullYear()} Municipal Government of Katipunan, Zamboanga del Norte. All rights reserved.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-mono text-xs text-slate-400">
            <Link to="/login" className="hover:text-rose-400 transition-colors">
              SIGN IN
            </Link>
            <Link to="/register" className="hover:text-rose-400 transition-colors">
              SIGN UP
            </Link>
            <Link to="/civilian/hotlines" className="hover:text-rose-400 transition-colors">
              DIRECTORY
            </Link>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              HOTLINE: 911 / (065) 212-1111
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
