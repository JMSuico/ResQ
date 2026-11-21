// [Layer: LANDING_PAGE/Features/Pages/LandingPage]
// Responsibility: Master public landing page showcasing deterministic AI emergency detection,
// multi-agency dispatch mesh, interactive civilian & responder pathways, and direct Sign In / Sign Up gateways.
// Official Cherry (#670626 / #4A041A / #400014) & Warm Ivory (#F7F1EA / #FAF5EE / #E9D9D0) Stitch Claymorphism.
// DO NOT expose admin management actions or hotline/phone call links on public landing screens.

import React, { useState, useEffect } from 'react';
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
import { AGENCY_METADATA } from '@/Libs/Assets/data';
import { getApiBaseUrl } from '@/Endpoints/apiClient';
import { InkOrbitFeatures } from '@/components/ui';

interface PublicHealthPayload {
  status?: string;
}

interface PublicAnalyticsOverviewPayload {
  volumeSeries?: number[];
  values?: number[];
  points?: Array<{ value?: number }>;
}

const EMPTY_TELEMETRY_SERIES: number[] = [0, 0, 0, 0, 0, 0];

export const LandingPage: React.FC = () => {
  const [activePathway, setActivePathway] = useState<'civilian' | 'responder'>('civilian');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [telemetryValues, setTelemetryValues] = useState<number[]>(EMPTY_TELEMETRY_SERIES);

  useEffect(() => {
    let isMounted = true;
    const baseUrl = getApiBaseUrl();

    const loadPublicTelemetry = async (): Promise<void> => {
      try {
        const healthRes = await fetch(baseUrl ? `${baseUrl}/api/health` : '/api/health', {
          method: 'GET',
          headers: { Accept: 'application/json' }
        });
        if (isMounted) {
          if (healthRes.ok) {
            const healthBody = (await healthRes.json()) as PublicHealthPayload;
            setApiOnline(String(healthBody?.status || '').toLowerCase() === 'healthy');
          } else {
            setApiOnline(false);
          }
        }
      } catch {
        if (isMounted) {
          setApiOnline(false);
        }
      }

      try {
        const overviewRes = await fetch(
          baseUrl ? `${baseUrl}/api/analytics/overview` : '/api/analytics/overview',
          {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'include'
          }
        );
        if (!overviewRes.ok) {
          if (isMounted) {
            setTelemetryValues(EMPTY_TELEMETRY_SERIES);
          }
          return;
        }
        const data = (await overviewRes.json()) as PublicAnalyticsOverviewPayload | Array<{ value?: number }>;
        if (!isMounted) return;
        if (Array.isArray(data)) {
          const parsed = data
            .map((d) => (typeof d?.value === 'number' && Number.isFinite(d.value) ? d.value : 0));
          setTelemetryValues(parsed.length > 1 ? parsed : EMPTY_TELEMETRY_SERIES);
        } else if (Array.isArray(data?.volumeSeries) && data.volumeSeries.length > 1) {
          setTelemetryValues(data.volumeSeries);
        } else if (Array.isArray(data?.values) && data.values.length > 1) {
          setTelemetryValues(data.values);
        } else if (Array.isArray(data?.points) && data.points.length > 1) {
          setTelemetryValues(
            data.points.map((p) => (typeof p?.value === 'number' && Number.isFinite(p.value) ? p.value : 0))
          );
        } else {
          setTelemetryValues(EMPTY_TELEMETRY_SERIES);
        }
      } catch {
        if (isMounted) {
          setTelemetryValues(EMPTY_TELEMETRY_SERIES);
        }
      }
    };

    void loadPublicTelemetry();
    return () => {
      isMounted = false;
    };
  }, []);

  const agencyStatusLabel =
    apiOnline === true ? 'Online' : apiOnline === false ? 'Offline' : 'Checking';
  const dispatchChannelLabel =
    apiOnline === true ? 'API Connected' : apiOnline === false ? 'Standby' : 'Checking';

  return (
    <div className="min-h-screen bg-[#4A041A] text-[#F7F1EA] flex flex-col selection:bg-[#F7F1EA] selection:text-[#670626]">
      {/* 1. STICKY CHERRY STITCH NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 w-full bg-[#400014]/95 backdrop-blur-xl border-b border-[#FFD9DD]/18 shadow-[0_12px_32px_rgba(43,1,14,0.45)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Telemetry Indicator */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-[#F7F1EA] border border-[#FFD9DD]/60 flex items-center justify-center shadow-[0_6px_14px_rgba(43,1,14,0.35),inset_0_2px_2px_rgba(255,255,255,0.9)] transition-all">
                <span className="font-mono font-black text-[#670626] text-lg tracking-tighter">R</span>
              </div>
              <div className="flex flex-col">
                <span className="font-sans font-black text-lg text-[#F7F1EA] tracking-wider flex items-center gap-1.5">
                  RESQTRACK
                  <span className="inline-block w-2 h-2 rounded-full bg-[#FFD9DD] animate-pulse" />
                </span>
                <span className="font-mono text-xs text-[#FFD9DD] tracking-wide -mt-0.5">
                  Incident AI
                </span>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links */}
          <div className="hidden md:flex items-center gap-7 font-mono text-sm font-semibold text-[#FFD9DD]">
            <a href="#overview" className="hover:text-[#F7F1EA] transition-colors">
              Overview
            </a>
            <a href="#pathways" className="hover:text-[#F7F1EA] transition-colors">
              Pathways
            </a>
            <a href="#agencies" className="hover:text-[#F7F1EA] transition-colors">
              Agencies
            </a>
            <a href="#architecture" className="hover:text-[#F7F1EA] transition-colors">
              Architecture
            </a>
          </div>

          {/* Right Action Authentication Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <Link to="/login">
              <button
                type="button"
                className="clay-button-ivory px-4 py-2 text-sm font-mono flex items-center gap-1.5"
              >
                Sign In
              </button>
            </Link>

            <Link to="/register">
              <button
                type="button"
                className="clay-button-cherry px-4 py-2 text-sm font-mono flex items-center gap-1.5"
              >
                <span>Sign Up</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-90" />
              </button>
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-[#670626] border border-[#FFD9DD]/25 text-[#F7F1EA] hover:bg-[#4A041A]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-3 pb-5 bg-[#400014] border-b border-[#FFD9DD]/20 space-y-2.5 font-mono text-sm">
            <a
              href="#overview"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#FFD9DD] hover:text-[#F7F1EA]"
            >
              Overview
            </a>
            <a
              href="#pathways"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#FFD9DD] hover:text-[#F7F1EA]"
            >
              Pathways
            </a>
            <a
              href="#agencies"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#FFD9DD] hover:text-[#F7F1EA]"
            >
              Agencies
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-[#FFD9DD] hover:text-[#F7F1EA]"
            >
              Architecture
            </a>
            <div className="pt-3 border-t border-[#FFD9DD]/20 flex items-center gap-2.5">
              <Link to="/login" className="flex-1">
                <button type="button" className="clay-button-ivory w-full py-2 px-3 text-sm font-mono">
                  Sign In
                </button>
              </Link>
              <Link to="/register" className="flex-1">
                <button type="button" className="clay-button-cherry w-full py-2 px-3 text-sm font-mono">
                  Sign Up
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* 2. HERO COMMAND SECTION (Deep Cherry Canvas) */}
      <section
        id="overview"
        className="relative w-full py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#670626] via-[#4A041A] to-[#400014] border-b border-[#FFD9DD]/15 flex flex-col items-center justify-center text-center overflow-hidden"
      >
        {/* Subtle Warm Ivory Dot Matrix */}
        <div className="absolute inset-0 bg-[radial-gradient(#F7F1EA_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#A83B4D]/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          {/* Top Status Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#400014]/85 border border-[#FFD9DD]/25 text-xs sm:text-sm font-mono text-[#FFD9DD] mb-6 shadow-[0_12px_30px_rgba(43,1,14,0.45)]">
            <span className="w-2 h-2 rounded-full bg-[#FFD9DD] animate-ping" />
            <span className="font-bold text-[#F7F1EA]">24/7 Emergency Triage</span>
            <span className="text-[#A83B4D]">&bull;</span>
            <span className="text-[#FFD9DD]">Katipunan, ZN</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-[#F7F1EA] tracking-tight leading-[1.08] max-w-4xl">
            AI Emergency <br />
            <span className="text-[#FFD9DD]">
              Detection &amp; Multi-Agency Dispatch
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-xl text-[#E9D9D0] max-w-2xl leading-relaxed">
            Real-time dispatch linking LDRRMO, RHU, BFP, PNP, and residents.
          </p>

          {/* DUAL ACTION CTAS: CREATE ACCOUNT & SIGN IN */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link to="/register" className="w-full sm:w-auto">
              <button
                type="button"
                className="clay-button-cherry w-full sm:w-auto px-8 py-3.5 font-mono text-sm sm:text-base tracking-wide flex items-center justify-center gap-2"
              >
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>

            <Link to="/login" className="w-full sm:w-auto">
              <button
                type="button"
                className="clay-button-ivory w-full sm:w-auto px-8 py-3.5 font-mono text-sm sm:text-base tracking-wide flex items-center justify-center gap-2"
              >
                <span>Sign In</span>
                <ExternalLink className="w-4 h-4 text-[#670626]" />
              </button>
            </Link>
          </div>

          {/* Core Capabilities Strip (Warm Ivory Clay Surface) */}
          <div className="mt-12 w-full max-w-4xl">
            <div className="clay-surface px-6 py-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 text-left">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#670626] flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-extrabold text-[#2B010E] block truncate">Laplacian Vision</span>
                    <span className="text-xs text-[#A83B4D] font-medium block truncate">Blur &amp; spoof filter</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A83B4D] flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-extrabold text-[#2B010E] block truncate">Live GPS Mesh</span>
                    <span className="text-xs text-[#A83B4D] font-medium block truncate">&plusmn;5m precision tracking</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#670626] flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-extrabold text-[#2B010E] block truncate">Role-Based Access</span>
                    <span className="text-xs text-[#A83B4D] font-medium block truncate">Verified agency routing</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#670626] animate-pulse flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-extrabold text-[#2B010E] block truncate">24/7 Dispatch</span>
                    <span className="text-xs text-[#A83B4D] font-medium block truncate">Active Katipunan mesh</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DUAL ROLE PATHWAYS: CIVILIANS VS RESPONDERS (Warm Ivory Canvas) */}
      <section id="pathways" className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-[#FAF5EE] text-[#2B010E]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#670626] tracking-tight">
              Citizens &amp; First Responders
            </h2>
            <p className="text-base text-[#2B010E]/80 mt-3 max-w-xl mx-auto font-medium">
              Dedicated portals for instant incident reporting and field dispatch.
            </p>

            {/* Interactive Toggle Switch */}
            <div className="mt-6 inline-flex p-1.5 rounded-2xl clay-well font-mono text-sm">
              <button
                type="button"
                onClick={() => setActivePathway('civilian')}
                className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                  activePathway === 'civilian'
                    ? 'bg-[#670626] text-[#F7F1EA] shadow-md'
                    : 'text-[#670626] hover:bg-[#F7F1EA]/60'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Civilians</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePathway('responder')}
                className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                  activePathway === 'responder'
                    ? 'bg-[#670626] text-[#F7F1EA] shadow-md'
                    : 'text-[#670626] hover:bg-[#F7F1EA]/60'
                }`}
              >
                <HeartPulse className="w-4 h-4" />
                <span>Responders</span>
              </button>
            </div>
          </div>

          {/* Pathway Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* Pathway 1: Civilian Portal */}
            <div
              className={`clay-surface p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 relative ${
                activePathway === 'civilian'
                  ? 'ring-2 ring-[#670626] shadow-[0_20px_48px_rgba(103,6,38,0.22)]'
                  : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-lg bg-[#670626] text-xs sm:text-sm font-mono font-bold text-[#F7F1EA]">
                    Civilian Portal
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-semibold text-[#A83B4D]">Public</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-[#2B010E]">Citizen Dashboard</h3>
                <p className="text-sm sm:text-base text-[#670626]/85 mt-2 font-medium">
                  Fast emergency reporting, SOS beacons, and live station proximity.
                </p>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="clay-well p-3.5 flex items-center gap-3">
                    <Camera className="w-4 h-4 text-[#670626] flex-shrink-0" />
                    <strong className="text-[#2B010E] font-sans">1-Tap SOS Camera</strong>
                    <span className="text-xs sm:text-sm text-[#A83B4D] font-medium ml-auto hidden sm:inline">Blur filter &amp; auto-GPS</span>
                  </div>

                  <div className="clay-well p-3.5 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-[#670626] flex-shrink-0" />
                    <strong className="text-[#2B010E] font-sans">SOS Distress Beacon</strong>
                    <span className="text-xs sm:text-sm text-[#A83B4D] font-medium ml-auto hidden sm:inline">Live LDRRMO broadcast</span>
                  </div>

                  <div className="clay-well p-3.5 flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-[#670626] flex-shrink-0" />
                    <strong className="text-[#2B010E] font-sans">Station Proximity</strong>
                    <span className="text-xs sm:text-sm text-[#A83B4D] font-medium ml-auto hidden sm:inline">Nearest RHU, Fire &amp; PNP</span>
                  </div>

                  <div className="clay-well p-3.5 flex items-center gap-3">
                    <Radio className="w-4 h-4 text-[#670626] flex-shrink-0" />
                    <strong className="text-[#2B010E] font-sans">Public Advisories</strong>
                    <span className="text-xs sm:text-sm text-[#A83B4D] font-medium ml-auto hidden sm:inline">Weather &amp; road alerts</span>
                  </div>
                </div>
              </div>

              {/* Civilian Quick Actions */}
              <div className="mt-8 pt-6 border-t border-[#A83B4D]/20 flex flex-wrap items-center gap-3">
                <Link to="/register" className="flex-1">
                  <button
                    type="button"
                    className="clay-button-cherry w-full py-2.5 px-4 text-sm font-mono flex items-center justify-center gap-1.5"
                  >
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link to="/login" className="flex-1">
                  <button
                    type="button"
                    className="clay-button-ivory w-full py-2.5 px-4 text-sm font-mono"
                  >
                    Sign In
                  </button>
                </Link>
              </div>
            </div>

            {/* Pathway 2: Responder Portal */}
            <div
              className={`clay-surface p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 relative ${
                activePathway === 'responder'
                  ? 'ring-2 ring-[#670626] shadow-[0_20px_48px_rgba(103,6,38,0.22)]'
                  : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-lg bg-[#400014] text-xs sm:text-sm font-mono font-bold text-[#F7F1EA]">
                    Responder Portal
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-semibold text-[#A83B4D]">Authorized</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-[#2B010E]">Field Responder HUD</h3>
                <p className="text-sm sm:text-base text-[#670626]/85 mt-2 font-medium">
                  Mobile dispatch terminal for RHU, BFP, and PNP units.
                </p>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="clay-well p-3.5 flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#670626] flex-shrink-0" />
                    <strong className="text-[#2B010E] font-sans">4-State Status Toggles</strong>
                    <span className="text-xs sm:text-sm text-[#A83B4D] font-medium ml-auto hidden sm:inline">Available to Returning</span>
                  </div>

                  <div className="clay-well p-3.5 flex items-center gap-3">
                    <Zap className="w-4 h-4 text-[#670626] flex-shrink-0" />
                    <strong className="text-[#2B010E] font-sans">Agency Dispatch Feed</strong>
                    <span className="text-xs sm:text-sm text-[#A83B4D] font-medium ml-auto hidden sm:inline">Unit-filtered incident queue</span>
                  </div>

                  <div className="clay-well p-3.5 flex items-center gap-3">
                    <Radio className="w-4 h-4 text-[#670626] flex-shrink-0" />
                    <strong className="text-[#2B010E] font-sans">Turn-by-Turn Routing</strong>
                    <span className="text-xs sm:text-sm text-[#A83B4D] font-medium ml-auto hidden sm:inline">1-tap scene navigation</span>
                  </div>

                  <div className="clay-well p-3.5 flex items-center gap-3">
                    <Activity className="w-4 h-4 text-[#670626] flex-shrink-0" />
                    <strong className="text-[#2B010E] font-sans">Shift &amp; Unit Logs</strong>
                    <span className="text-xs sm:text-sm text-[#A83B4D] font-medium ml-auto hidden sm:inline">Readiness &amp; audit trail</span>
                  </div>
                </div>
              </div>

              {/* Responder Quick Actions */}
              <div className="mt-8 pt-6 border-t border-[#A83B4D]/20 flex flex-wrap items-center gap-3">
                <Link to="/login" className="flex-1">
                  <button
                    type="button"
                    className="clay-button-cherry w-full py-2.5 px-4 text-sm font-mono"
                  >
                    Sign In
                  </button>
                </Link>
                <Link to="/register" className="flex-1">
                  <button
                    type="button"
                    className="clay-button-ivory w-full py-2.5 px-4 text-sm font-mono"
                  >
                    Create Account
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTEGRATED MULTI-AGENCY RESPONSE FORCE GRID (Cherry Canvas + Warm Ivory Clay Cards) */}
      <section id="agencies" className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-[#4A041A] border-t border-[#FFD9DD]/15">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#F7F1EA] tracking-tight">
              Response Agencies
            </h2>
            <p className="text-base text-[#FFD9DD] mt-3 max-w-xl mx-auto">
              Coordinated emergency dispatch across Katipunan municipal units.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(AGENCY_METADATA).map(([key, meta]) => (
              <div
                key={key}
                className="clay-surface p-6 flex flex-col justify-between transition-all relative"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] text-xs sm:text-sm font-mono font-bold">
                      {meta.short}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#670626]">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          apiOnline === true ? 'bg-emerald-600 animate-pulse' : 'bg-[#670626]'
                        }`}
                      />
                      {agencyStatusLabel}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-[#2B010E]">{meta.name}</h3>
                  <p className="text-sm text-[#670626]/85 mt-2 leading-relaxed font-medium">{meta.description}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#A83B4D]/20">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-[#A83B4D] uppercase font-bold">Dispatch Channel</span>
                    <span className="text-[#670626] font-extrabold">{dispatchChannelLabel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. DETERMINISTIC DISPATCH & INCIDENT TELEMETRY ARCHITECTURE */}
      <section
        id="architecture"
        className="w-full py-16 px-4 md:px-6 bg-[#400014] border-t border-[#FFD9DD]/15 flex flex-col items-center"
      >
        <div className="max-w-6xl w-full">
          <InkOrbitFeatures
            theme="dark"
            brand="ResQTrack AI"
            tag="Core Architecture"
            title="Dispatch &\n*Telemetry* Architecture"
            style={
              {
                '--ib-page': '#400014',
                '--ib-paper': '#4A041A',
                '--ib-card': '#670626',
                '--ib-raise': '#400014',
                '--ib-ink': '#F7F1EA',
                '--ib-soft': '#FFD9DD',
                '--ib-muted': '#E9D9D0',
                '--ib-faint': '#FFD9DD',
                '--ib-line': 'rgba(255, 217, 221, 0.2)',
                '--ib-line-strong': 'rgba(255, 217, 221, 0.4)',
                '--ib-bracket': '#FFD9DD',
                '--ib-inv': '#F7F1EA',
                '--ib-inv-ink': '#670626'
              } as React.CSSProperties
            }
            collaboration={{
              title: 'Multi-Agency Coordination',
              description: 'Shared telemetry and priority routing for LDRRMO, RHU, BFP, and PNP.'
            }}
            reports={{
              title: 'Incident Verification',
              description: 'AI severity grading, biometric liveness checks, and immutable logs.'
            }}
            integrations={{
              title: 'Live Telemetry Mesh',
              description: 'GIS mapping, edge blur detection, GPS geofencing, and unit dispatch.',
              tools: ['LDRRMO Command', 'RHU Medical', 'BFP Fire', 'PNP Patrol']
            }}
            insights={{
              title: 'Risk & Velocity Analytics',
              description: 'Municipal risk scoring and response velocity tracking.',
              values: telemetryValues,
              forecastFrom: Math.max(1, telemetryValues.length - 2)
            }}
          />
        </div>
      </section>

      {/* 6. DIRECT ACTION BANNER */}
      <section className="w-full py-12 px-4 sm:px-6 lg:px-8 bg-[#670626] border-t border-[#FFD9DD]/18">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-[#F7F1EA]">
              Create an Account or Sign In
            </h3>
            <p className="text-sm text-[#FFD9DD] mt-1.5 font-medium">
              Katipunan, Zamboanga del Norte Emergency Dispatch
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <button
                type="button"
                className="clay-button-ivory px-6 py-2.5 font-mono text-sm flex items-center gap-1.5"
              >
                <span>Sign Up</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/login">
              <button
                type="button"
                className="clay-button-cherry px-6 py-2.5 font-mono text-sm"
              >
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. MUNICIPAL COMPLIANCE FOOTER (No Hotlines / No Call Links) */}
      <footer className="w-full py-10 px-4 sm:px-6 lg:px-8 bg-[#400014] border-t border-[#FFD9DD]/18">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#F7F1EA] flex items-center justify-center font-mono font-black text-[#670626] text-sm">
                R
              </div>
              <span className="font-sans font-black text-base tracking-wider text-[#F7F1EA]">RESQTRACK</span>
            </div>
            <span className="font-mono text-xs text-[#E9D9D0]">
              &copy; {new Date().getFullYear()} Municipality of Katipunan, Zamboanga del Norte
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-mono text-sm text-[#FFD9DD]">
            <Link to="/login" className="hover:text-[#F7F1EA] transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="hover:text-[#F7F1EA] transition-colors">
              Sign Up
            </Link>
            <span className="text-[#A83B4D]">|</span>
            <span className="text-[#F7F1EA] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FFD9DD] animate-pulse" />
              Katipunan Multi-Agency Dispatch Mesh
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
