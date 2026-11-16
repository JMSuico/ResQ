// [Layer: LANDING_PAGE/Features/Pages/LandingPage]
// Responsibility: Master public tactical landing page showcasing deterministic AI emergency detection,
// multi-agency dispatch mesh, interactive civilian & responder pathways, and direct Sign In / Sign Up gateways.
// DO NOT expose admin management actions on public landing screens.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  Menu,
  X,
  User,
  HeartPulse,
  Camera,
  AlertTriangle,
  MapPin,
  Radio,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
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
                  Incident AI
                </span>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links */}
          <div className="hidden md:flex items-center gap-6 font-mono text-xs text-slate-300">
            <a href="#overview" className="hover:text-rose-400 transition-colors">
              Overview
            </a>
            <a href="#pathways" className="hover:text-rose-400 transition-colors">
              Pathways
            </a>
            <a href="#agencies" className="hover:text-rose-400 transition-colors">
              Agencies
            </a>
            <a href="#architecture" className="hover:text-rose-400 transition-colors">
              Architecture
            </a>
            <a href="#hotlines" className="hover:text-rose-400 transition-colors">
              Hotlines
            </a>
          </div>

          {/* Right Action Authentication Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Sign In Button */}
            <Link to="/login">
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold text-slate-200 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:text-white transition-all shadow-sm"
              >
                Sign In
              </button>
            </Link>

            {/* Sign Up Button */}
            <Link to="/register">
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg font-mono text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border border-rose-400/50 shadow-[0_0_16px_rgba(225,29,72,0.4)] hover:shadow-[0_0_22px_rgba(225,29,72,0.6)] active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span>Sign Up</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
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
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
              Overview
            </a>
            <a
              href="#pathways"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-slate-300 hover:text-rose-400"
            >
              Pathways
            </a>
            <a
              href="#agencies"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-slate-300 hover:text-rose-400"
            >
              Agencies
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-slate-300 hover:text-rose-400"
            >
              Architecture
            </a>
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
              <Link to="/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Sign In
                </Button>
              </Link>
              <Link to="/register" className="flex-1">
                <Button variant="danger" size="sm" className="w-full text-xs">
                  Sign Up
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
            <span className="font-semibold">24/7 Emergency Triage</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-slate-300">Katipunan, ZN</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight max-w-4xl">
            AI Emergency <br />
            <span className="bg-gradient-to-r from-rose-500 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              Detection &amp; Multi-Agency Dispatch
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
            Unified dispatch connecting LDRRMO, RHU, BFP, PNP, and residents in real time.
          </p>

          {/* DUAL ACTION CTAS: CREATE ACCOUNT & SIGN IN */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            {/* CTA 1: Create Account */}
            <Link to="/register" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-mono font-bold text-sm tracking-wide text-white bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 hover:from-rose-500 hover:to-rose-600 border border-rose-400/60 shadow-[0_0_28px_rgba(225,29,72,0.45)] hover:shadow-[0_0_36px_rgba(225,29,72,0.7)] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>

            {/* CTA 2: Sign In */}
            <Link to="/login" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-mono font-bold text-sm tracking-wide text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-rose-500/70 hover:text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Sign In</span>
                <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              </button>
            </Link>
          </div>

          {/* Core Capabilities Strip */}
          <div className="mt-12 w-full max-w-4xl">
            <div className="tactical-card px-5 py-4 bg-slate-900/80 border-slate-800 shadow-2xl">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#ff5c74] flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">Laplacian Vision</span>
                    <span className="text-[11px] text-slate-400 block truncate">Blur &amp; spoof filter</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">Live GPS Mesh</span>
                    <span className="text-[11px] text-slate-400 block truncate">&plusmn;5m precision tracking</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">Role-Based Access</span>
                    <span className="text-[11px] text-slate-400 block truncate">Verified agency routing</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#ff5c74] animate-pulse flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">24/7 Dispatch</span>
                    <span className="text-[11px] text-slate-400 block truncate">Active Katipunan mesh</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DUAL ROLE PATHWAYS: CIVILIANS VS RESPONDERS */}
      <section id="pathways" className="w-full py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-white tracking-wide">
            Citizens &amp; First Responders
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-xl mx-auto">
            Dedicated portals for instant incident reporting and field dispatch.
          </p>

          {/* Interactive Toggle Switch */}
          <div className="mt-6 inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
            <button
              type="button"
              onClick={() => setActivePathway('civilian')}
              className={`px-5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activePathway === 'civilian'
                  ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Civilians</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePathway('responder')}
              className={`px-5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activePathway === 'responder'
                  ? 'bg-sky-600 text-white shadow-[0_0_12px_rgba(2,132,199,0.5)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>Responders</span>
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
                  Civilian Portal
                </span>
                <span className="text-xs font-mono text-slate-400">Public</span>
              </div>

              <h3 className="text-2xl font-black text-white">Citizen Dashboard</h3>
              <p className="text-sm text-slate-300 mt-2">
                Fast emergency reporting, SOS beacons, and live station proximity.
              </p>

              <div className="mt-6 space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <Camera className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <strong className="text-white font-sans">1-Tap SOS Camera</strong>
                  <span className="text-slate-400 ml-auto hidden sm:inline">Blur filter &amp; auto-GPS</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <strong className="text-white font-sans">SOS Distress Beacon</strong>
                  <span className="text-slate-400 ml-auto hidden sm:inline">Live LDRRMO broadcast</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <strong className="text-white font-sans">Station Proximity</strong>
                  <span className="text-slate-400 ml-auto hidden sm:inline">Nearest RHU, Fire &amp; PNP</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <Radio className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <strong className="text-white font-sans">Public Advisories</strong>
                  <span className="text-slate-400 ml-auto hidden sm:inline">Weather &amp; road alerts</span>
                </div>
              </div>
            </div>

            {/* Civilian Quick Actions */}
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center gap-3">
              <Link to="/register" className="flex-1">
                <Button variant="danger" size="md" className="w-full text-xs font-mono font-bold flex items-center justify-center gap-1">
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
              <Link to="/login" className="flex-1">
                <Button variant="outline" size="md" className="w-full text-xs font-mono font-bold">
                  Sign In
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
                  Responder Portal
                </span>
                <span className="text-xs font-mono text-slate-400">Authorized</span>
              </div>

              <h3 className="text-2xl font-black text-white">Field Responder HUD</h3>
              <p className="text-sm text-slate-300 mt-2">
                Mobile dispatch terminal for RHU, BFP, and PNP units.
              </p>

              <div className="mt-6 space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <strong className="text-white font-sans">4-State Status Toggles</strong>
                  <span className="text-slate-400 ml-auto hidden sm:inline">Available to Returning</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <Zap className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <strong className="text-white font-sans">Agency Dispatch Feed</strong>
                  <span className="text-slate-400 ml-auto hidden sm:inline">Unit-filtered incident queue</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <Radio className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <strong className="text-white font-sans">Turn-by-Turn Routing</strong>
                  <span className="text-slate-400 ml-auto hidden sm:inline">1-tap scene navigation</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <Activity className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <strong className="text-white font-sans">Shift &amp; Unit Logs</strong>
                  <span className="text-slate-400 ml-auto hidden sm:inline">Readiness &amp; audit trail</span>
                </div>
              </div>
            </div>

            {/* Responder Quick Actions */}
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center gap-3">
              <Link to="/login" className="flex-1">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-lg font-mono font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-950/60 transition-colors"
                >
                  Sign In
                </button>
              </Link>
              <Link to="/register" className="flex-1">
                <Button variant="outline" size="md" className="w-full text-xs font-mono font-bold">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTEGRATED MULTI-AGENCY RESPONSE FORCE GRID */}
      <section id="agencies" className="w-full py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-white tracking-wide">
            Response Agencies
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-xl mx-auto">
            Coordinated emergency dispatch across Katipunan municipal units.
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
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#ff5c74]">
                    <span className="w-2 h-2 rounded-full bg-[#ff5c74] animate-pulse" />
                    Online
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{meta.name}</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{meta.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[10px] text-slate-400 uppercase">Hotline</span>
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
            tag="Core Architecture"
            title="Dispatch &\n*Telemetry* Architecture"
            collaboration={{
              title: "Multi-Agency Coordination",
              description: "Shared telemetry and priority routing for LDRRMO, RHU, BFP, and PNP."
            }}
            reports={{
              title: "Incident Verification",
              description: "AI severity grading, biometric liveness checks, and immutable logs."
            }}
            integrations={{
              title: "Live Telemetry Mesh",
              description: "GIS mapping, edge blur detection, GPS geofencing, and unit dispatch.",
              tools: ["LDRRMO Command", "RHU Medical", "BFP Fire", "PNP Patrol"]
            }}
            insights={{
              title: "Risk & Velocity Analytics",
              description: "Municipal risk scoring and response velocity tracking.",
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
            <h3 className="text-2xl font-black text-white">
              Create an Account or Sign In
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Katipunan, Zamboanga del Norte Emergency Dispatch
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <button
                type="button"
                className="px-6 py-2.5 rounded-lg font-mono font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/40 shadow-lg shadow-rose-950/60 transition-colors flex items-center gap-1.5"
              >
                <span>Sign Up</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
            <Link to="/login">
              <button
                type="button"
                className="px-6 py-2.5 rounded-lg font-mono font-bold text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
              >
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. MUNICIPAL HOTLINES & COMPLIANCE FOOTER */}
      <footer id="hotlines" className="w-full py-10 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-rose-600 flex items-center justify-center font-mono font-black text-white text-xs">
                R
              </div>
              <span className="font-sans font-black text-sm tracking-wider text-white">RESQTRACK</span>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              &copy; {new Date().getFullYear()} Municipality of Katipunan, Zamboanga del Norte
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-mono text-xs text-slate-400">
            <Link to="/login" className="hover:text-rose-400 transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="hover:text-rose-400 transition-colors">
              Sign Up
            </Link>
            <Link to="/civilian/hotlines" className="hover:text-rose-400 transition-colors">
              Directory
            </Link>
            <span className="text-slate-600">|</span>
            <span className="text-[#ff5c74] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ff5c74] animate-pulse" />
              Hotline: 911 / (065) 212-1111
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
