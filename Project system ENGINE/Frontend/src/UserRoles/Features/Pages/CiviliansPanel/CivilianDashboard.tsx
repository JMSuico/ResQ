// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Public emergency citizen dashboard featuring 1-tap accident reporting,
// tactical SOS action trigger with pulsing halo, instant click-to-call hotlines strip, and hazard maps.
// DO NOT hide municipal emergency hotlines from resident users.

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublicAlerts } from '@/Endpoints/civilianPortalApi';
import { getIncidentFixtures } from '@/Endpoints/adminGovernanceApi';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { CameraCaptureModal } from '@/Shared/CameraCaptureModal';
import { createReport } from '@/Endpoints/reportsApi';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { AGENCY_METADATA } from '@/Libs/Assets/data';

export const CivilianDashboard: React.FC = () => {
  const { coords, isHardwareGeolocated, signalQuality } = useGpsLocation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const { dispatchReportEvent } = useReportEventBus();

  const loadData = async () => {
    try {
      const [a, f] = await Promise.all([getPublicAlerts(), getIncidentFixtures()]);
      setAlerts(a || []);
      setFixtures(f || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useReportEventBus(() => {
    loadData();
  });

  const handleQuickReport = async (dataUrl: string) => {
    try {
      const res = await createReport({
        title: 'Emergency Reported via Citizen Dashboard',
        note: 'Submitted via 1-Tap Quick Action Camera.',
        category: 'VehicularAccident',
        severity: 'High',
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationLabel: 'Citizen Current GPS Location',
        imageDataUrl: dataUrl
      });
      dispatchReportEvent(res.report);
      setReportSuccess(`Incident logged with reference: ${res.report.referenceCode}. Emergency responders notified.`);
      setTimeout(() => setReportSuccess(null), 7000);
    } catch (err: unknown) {
      console.error('Failed to submit accident report:', err);
    }
  };

  const markers: MapMarker[] = [
    {
      id: 'citizen-gps',
      lat: coords.latitude,
      lng: coords.longitude,
      title: 'Your Current Position',
      type: 'gps' as const
    },
    ...fixtures.map((f) => ({
      id: f.id,
      lat: f.latitude,
      lng: f.longitude,
      title: f.title,
      type: 'fixture' as const,
      category: f.category,
      agency: f.assignedUnitType
    }))
  ];

  // Clean phone dialer parser for click-to-call
  const getDialNumber = (hotline: string): string => {
    const raw = hotline.split('/')[0].trim();
    return raw.replace(/[^0-9+]/g, '');
  };

  // Agency specific icons and visual badges
  const getAgencyIcon = (shortCode: string) => {
    switch (shortCode) {
      case 'LDRRMO':
        return (
          <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'RHU':
        return (
          <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        );
      case 'FIRE':
        return (
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
        );
      case 'PNP':
      default:
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
    }
  };

  const getAgencyStyles = (shortCode: string) => {
    switch (shortCode) {
      case 'LDRRMO':
        return {
          border: 'border-rose-600/30 hover:border-rose-500/70',
          badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          btnBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60',
          glow: 'group-hover:shadow-[0_0_24px_rgba(225,29,72,0.25)]',
          accent: 'text-rose-400'
        };
      case 'RHU':
        return {
          border: 'border-sky-600/30 hover:border-sky-500/70',
          badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          btnBg: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-950/60',
          glow: 'group-hover:shadow-[0_0_24px_rgba(2,132,199,0.25)]',
          accent: 'text-sky-400'
        };
      case 'FIRE':
        return {
          border: 'border-orange-600/30 hover:border-orange-500/70',
          badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
          btnBg: 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/60',
          glow: 'group-hover:shadow-[0_0_24px_rgba(234,88,12,0.25)]',
          accent: 'text-orange-400'
        };
      case 'PNP':
      default:
        return {
          border: 'border-blue-600/30 hover:border-blue-500/70',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          btnBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/60',
          glow: 'group-hover:shadow-[0_0_24px_rgba(59,130,246,0.25)]',
          accent: 'text-blue-400'
        };
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-8">
      {/* Active Public Safety Alert Banner (if any) */}
      {alerts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 border border-amber-600/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <span className="text-xs font-mono font-bold uppercase text-amber-400 tracking-wider">
              OFFICIAL PUBLIC ADVISORY:
            </span>
            <span className="text-xs text-slate-200 font-medium truncate max-w-md md:max-w-xl">
              {alerts[0].title}
            </span>
          </div>
          <Link
            to="/civilian/alerts"
            className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 underline whitespace-nowrap"
          >
            View All ({alerts.length}) →
          </Link>
        </div>
      )}

      {/* Success Notification */}
      {reportSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/95 border border-emerald-500 text-emerald-200 text-xs font-medium flex items-center gap-3 shadow-xl shadow-emerald-950/50 animate-fadeIn">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-300 font-bold text-base flex-shrink-0">
            ✓
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-white">Emergency Broadcast Transmitted</span>
            <span className="text-emerald-300 font-mono text-[11px] mt-0.5">{reportSuccess}</span>
          </div>
        </div>
      )}

      {/* PROMINENT SOS / ONE-TAP ACCIDENT REPORTING TRIGGER WITH TACTICAL PULSING HALO */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1c020b] via-[#100308] to-[#0a1120] border border-rose-600/40 p-6 md:p-8 shadow-2xl">
        {/* Ambient background tactical grid & lighting */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, rgba(232, 17, 76, 0.4) 0%, transparent 70%), linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 32px 32px, 32px 32px'
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left Column: Urgency Briefing & Live Telemetry */}
          <div className="flex flex-col items-start text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600/20 text-rose-400 text-xs font-mono font-bold border border-rose-600/40 mb-3 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>24/7 RAPID INCIDENT TRIAGE</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              Witnessed or Involved in a Road Collision?
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              Activate the 1-Tap SOS Camera below. Your exact hardware GPS coordinates and single-snap photo will be immediately broadcast simultaneously to LDRRMO Municipal Command, RHU Medics, BFP Firefighters, and PNP Police.
            </p>

            {/* Live GPS Telemetry Readout Pill */}
            <div className="mt-4 flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isHardwareGeolocated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-slate-400">Telemetry:</span>
                <span className="text-emerald-400 font-bold">
                  {coords.latitude.toFixed(5)}° N, {coords.longitude.toFixed(5)}° E
                </span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Acc: <strong className="text-slate-200">±{Math.round(coords.accuracy)}m</strong> ({signalQuality.toUpperCase()})
              </span>
            </div>

            {/* Quad Agency Simultaneous Dispatch Indicators */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="text-slate-400 font-semibold uppercase tracking-wider mr-1">Direct to:</span>
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-600/40 font-bold">LDRRMO</span>
              <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-600/40 font-bold">RHU MEDIC 🚑</span>
              <span className="px-2 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-600/40 font-bold">BFP FIRE 🚒</span>
              <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-600/40 font-bold">PNP POLICE 🚓</span>
            </div>
          </div>

          {/* Right Column: Prominent SOS Action Button with Pulsing Halo */}
          <div className="flex flex-col items-center justify-center gap-4 w-full sm:w-auto flex-shrink-0">
            <div className="relative group p-3">
              {/* Tactical Pulsing Halo Ring 1 */}
              <div className="absolute -inset-4 rounded-3xl bg-rose-600/20 blur-xl animate-pulse pointer-events-none" />

              {/* Tactical Radar Wave Ring 2 */}
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 opacity-60 blur group-hover:opacity-100 transition duration-500 animate-ping" />

              {/* High-Urgency One-Tap Trigger Button */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="relative z-10 w-full sm:w-80 min-h-[72px] px-8 py-5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-700 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-lg tracking-wide uppercase shadow-[0_0_40px_rgba(225,29,72,0.6)] hover:shadow-[0_0_55px_rgba(225,29,72,0.8)] active:scale-[0.98] transition-all flex items-center justify-center gap-4 border border-rose-400/50"
                aria-label="One-Tap Emergency Accident SOS Trigger"
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/20">
                  <svg className="w-7 h-7 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" strokeWidth="2.2" />
                  </svg>
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-extrabold text-base tracking-wider leading-none">ONE-TAP SOS</span>
                  <span className="text-[11px] font-mono font-medium text-rose-100 tracking-normal opacity-90 mt-1">
                    Instant Camera & Geotag
                  </span>
                </div>
              </button>
            </div>

            {/* Stepped Detailed Report Secondary Option */}
            <Link
              to="/civilian/report"
              className="w-full sm:w-80 py-3 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-500 text-xs font-semibold tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
            >
              <span>Need to provide written details?</span>
              <span className="text-sky-400 font-bold hover:underline">Detailed Stepped Report →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* EMERGENCY HOTLINES STRIP: INSTANT CLICK-TO-CALL CARDS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              24/7 Emergency Hotlines (Instant Click-to-Call)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Tap card to dial immediately</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(AGENCY_METADATA).map(([key, meta]) => {
            const styles = getAgencyStyles(meta.short);
            const dialNumber = getDialNumber(meta.hotline);

            return (
              <div
                key={key}
                className={`tactical-card group relative p-4 flex flex-col justify-between rounded-xl bg-slate-900/90 border transition-all duration-300 ${styles.border} ${styles.glow}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${styles.badge}`}>
                      {meta.short} STATION
                    </span>
                    <div className="p-1 rounded-lg bg-slate-950 border border-slate-800">
                      {getAgencyIcon(meta.short)}
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-white tracking-wide">{meta.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">
                    {meta.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 text-[10px] uppercase">DIRECT LINE</span>
                    <span className={`font-black ${styles.accent}`}>{meta.hotline}</span>
                  </div>

                  {/* Instant Click-to-Call Anchor Button */}
                  <a
                    href={`tel:${dialNumber}`}
                    className={`w-full min-h-[44px] py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] ${styles.btnBg}`}
                    aria-label={`Call ${meta.short} Emergency Hotline at ${dialNumber}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>Instant Call: {dialNumber}</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SATELLITE HAZARD MAP & EVACUATION SAFE ZONES */}
      <div className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-600/40 flex items-center justify-center text-sky-400 font-bold">
              🗺️
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Municipal Evacuation Safe Zones & Hazard Markers
              </h3>
              <p className="text-[11px] text-slate-400">
                Real-time spatial visualization of designated safe zones, medical stations, and community hazards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-600/30">
              ● {fixtures.length} Active Safe Points
            </span>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
              GPS: {coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E
            </span>
          </div>
        </div>

        <div className="h-[420px] w-full rounded-xl overflow-hidden border border-slate-800/80 relative">
          <SatelliteCommandMap
            markers={markers}
            centerLat={coords.latitude}
            centerLng={coords.longitude}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* 1-Tap Emergency Camera Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleQuickReport}
        title="1-Tap Emergency Accident Reporter"
        instructionText="Take photo of the emergency scene. Exact hardware GPS telemetry will be permanently embedded."
      />
    </div>
  );
};

export default CivilianDashboard;