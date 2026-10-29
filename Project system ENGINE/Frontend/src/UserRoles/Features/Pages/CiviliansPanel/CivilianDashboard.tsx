// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Public emergency citizen dashboard featuring 1-tap accident reporting,
// tactical SOS action trigger with pulsing halo, instant click-to-call hotlines strip,
// distance-to-station calculation, offline SMS emergency dispatch, and expandable hazard maps.
// DO NOT hide municipal emergency hotlines from resident users.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  HeartPulse,
  Flame,
  Shield,
  ArrowRight,
  CheckCircle2,
  Camera,
  Radio,
  MapPin,
  PhoneCall,
  ExternalLink,
  Navigation
} from 'lucide-react';
import { getPublicAlerts } from '@/Endpoints/civilianPortalApi';
import { getIncidentFixtures, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { CameraCaptureModal, CameraCaptureMetadata } from '@/Shared/CameraCaptureModal';
import { createReport, AlertItem } from '@/Endpoints/reportsApi';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { useFluidResposiveness } from '@/Hooks/useFluidResposiveness';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';
import { Button } from '@/Shared/Button';
import { AGENCY_METADATA } from '@/Libs/Assets/data';
import { BASELINE_ALERTS, BASELINE_INCIDENT_FIXTURES } from '@/Libs/Assets/baselineFixtures';

// Architectural constants - Zero hardcoded static numbers
const EARTH_RADIUS_KM = 6371;
const URBAN_RESPONSE_SPEED_KMH = 35;
const MINUTES_IN_HOUR = 60;
const REFRESH_INTERVAL_MS = 8000;
const SUCCESS_TOAST_TIMEOUT_MS = 8000;
const SMS_HOTLINE_NUMBER = '09171234567';
const DEG_TO_RAD = Math.PI / 180;
const HALF_DIVISOR = 2;
const MINIMUM_ESTIMATED_MINUTES = 1;

// Standard station coordinates for distance calculation
const STATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  LDRRMO: { lat: 8.5080, lng: 123.2750 },
  RHU: { lat: 8.5090, lng: 123.2740 },
  FIRE: { lat: 8.5075, lng: 123.2760 },
  PNP: { lat: 8.5065, lng: 123.2770 }
};

// Haversine distance calculator in kilometers
const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / HALF_DIVISOR) * Math.sin(dLat / HALF_DIVISOR) +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLon / HALF_DIVISOR) * Math.sin(dLon / HALF_DIVISOR);
  const c = HALF_DIVISOR * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

export const CivilianDashboard: React.FC = () => {
  const { coords, isHardwareGeolocated, signalQuality, refreshGps } = useGpsLocation();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [fixtures, setFixtures] = useState<IncidentFixture[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [selectedStationFilter, setSelectedStationFilter] = useState<'ALL' | 'LDRRMO' | 'RHU' | 'FIRE' | 'PNP'>('ALL');
  const [isSmsConfirmOpen, setIsSmsConfirmOpen] = useState(false);

  const { dispatchReportEvent } = useReportEventBus();
  const { isMobile: _isMobile } = useFluidResposiveness();

  const loadData = useCallback(async () => {
    try {
      const [a, f] = await Promise.all([
        getPublicAlerts().catch(() => []),
        getIncidentFixtures().catch(() => [])
      ]);
      setAlerts(a && a.length > 0 ? a : BASELINE_ALERTS);
      setFixtures(f && f.length > 0 ? f : BASELINE_INCIDENT_FIXTURES);
    } catch (err) {
      console.error('Error refreshing civilian dashboard feeds:', err);
      setAlerts((prev) => (prev.length > 0 ? prev : BASELINE_ALERTS));
      setFixtures((prev) => (prev.length > 0 ? prev : BASELINE_INCIDENT_FIXTURES));
    }
  }, []);

  // Continuous auto-refresh every 8 seconds
  useValueRefreshAuto(loadData, {
    intervalMs: REFRESH_INTERVAL_MS,
    enabled: true
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  useReportEventBus(() => {
    loadData();
  });

  const handleQuickReport = async (dataUrl: string, meta?: CameraCaptureMetadata) => {
    try {
      const res = await createReport({
        title: 'Emergency Reported via Citizen Dashboard',
        note: `Submitted via 1-Tap Quick Action Camera. Sensor Acc: ±${Math.round(coords.accuracy)}m.`,
        category: 'VehicularAccident',
        severity: 'Critical',
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracyMeters: coords.accuracy,
        isHardwareGeolocated,
        isBlurry: meta?.isBlurry ?? false,
        requiresManualVerification: meta?.requiresManualVerification ?? false,
        locationLabel: 'Citizen Current GPS Location (Live Geotag)',
        imageDataUrl: dataUrl
      });
      dispatchReportEvent(res.report);
      setReportSuccess(`Incident logged with reference: ${res.report.referenceCode}. Emergency responders notified.`);
      setTimeout(() => setReportSuccess(null), SUCCESS_TOAST_TIMEOUT_MS);
    } catch (err: unknown) {
      console.error('Failed to submit accident report:', err);
    }
  };

  const markers: MapMarker[] = useMemo(() => [
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
  ], [coords.latitude, coords.longitude, fixtures]);

  // Clean phone dialer parser for click-to-call
  const getDialNumber = (hotline: string): string => {
    const raw = hotline.split('/')[0].trim();
    return raw.replace(/[^0-9+]/g, '');
  };

  // Distance & ETA calculation for each agency
  const stationDistances = useMemo(() => {
    return Object.entries(STATION_COORDINATES).map(([code, pos]) => {
      const distKm = calculateDistanceKm(coords.latitude, coords.longitude, pos.lat, pos.lng);
      const estMinutes = Math.max(MINIMUM_ESTIMATED_MINUTES, Math.round((distKm / URBAN_RESPONSE_SPEED_KMH) * MINUTES_IN_HOUR));
      return {
        code,
        distKm: distKm.toFixed(2),
        estMinutes
      };
    });
  }, [coords.latitude, coords.longitude]);

  // Offline SMS SOS link generator
  const smsBody = useMemo(() => {
    const text = `EMERGENCY SOS: Accident reported at GPS (${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}), Accuracy +/-${Math.round(coords.accuracy)}m. Immediate rescue required at Katipunan ZN.`;
    return encodeURIComponent(text);
  }, [coords.latitude, coords.longitude, coords.accuracy]);

  const handleOpenGoogleMapsDir = (destLat: number, destLng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${coords.latitude},${coords.longitude}&destination=${destLat},${destLng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Agency specific icons and visual badges using Lucide
  const getAgencyIcon = (shortCode: string) => {
    switch (shortCode) {
      case 'LDRRMO':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      case 'RHU':
        return <HeartPulse className="w-5 h-5 text-sky-400" />;
      case 'FIRE':
        return <Flame className="w-5 h-5 text-orange-500" />;
      case 'PNP':
      default:
        return <Shield className="w-5 h-5 text-blue-400" />;
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
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* 1. Active Public Safety Alert Banner */}
      {alerts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 border border-amber-600/40 flex items-center justify-between gap-4 shadow-lg shadow-amber-950/30">
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
            className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 underline whitespace-nowrap flex items-center gap-1"
          >
            <span>View All ({alerts.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 2. Success Notification Toast */}
      {reportSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/95 border border-emerald-500 text-emerald-200 text-xs font-medium flex items-center gap-3 shadow-xl shadow-emerald-950/50 animate-fadeIn">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-white">Emergency Broadcast Transmitted</span>
            <span className="text-emerald-300 font-mono text-[11px] mt-0.5">{reportSuccess}</span>
          </div>
        </div>
      )}

      {/* 3. PROMINENT SOS / ONE-TAP ACCIDENT REPORTING TRIGGER WITH TACTICAL PULSING HALO */}
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
              Activate the 1-Tap SOS Camera below. Your exact hardware GPS coordinates and live camera snapshot will be broadcast simultaneously to LDRRMO Municipal Command, RHU Medics, BFP Firefighters, and PNP Police.
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
              <button
                type="button"
                onClick={refreshGps}
                className="ml-auto text-[10px] text-sky-400 hover:text-sky-300 font-bold underline"
              >
                Re-sync
              </button>
            </div>

            {/* Quad Agency Simultaneous Dispatch Indicators */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="text-slate-400 font-semibold uppercase tracking-wider mr-1">Direct to:</span>
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-600/40 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                LDRRMO
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-600/40 font-bold flex items-center gap-1">
                <HeartPulse className="w-3 h-3 text-sky-400" />
                RHU MEDIC
              </span>
              <span className="px-2 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-600/40 font-bold flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" />
                BFP FIRE
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-600/40 font-bold flex items-center gap-1">
                <Shield className="w-3 h-3 text-blue-400" />
                PNP POLICE
              </span>
            </div>
          </div>

          {/* Right Column: Prominent SOS Action Button with Pulsing Halo */}
          <div className="flex flex-col items-center justify-center gap-3 w-full sm:w-auto flex-shrink-0">
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
                  <Camera className="w-7 h-7 text-white animate-pulse" />
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
              className="w-full sm:w-80 py-2.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-500 text-xs font-semibold tracking-wide transition-all text-center flex items-center justify-center gap-2 shadow-sm min-h-[42px]"
            >
              <span>Need written details?</span>
              <span className="text-sky-400 font-bold hover:underline flex items-center gap-1">
                <span>Stepped Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Offline SMS SOS Fallback Link */}
            <button
              type="button"
              onClick={() => setIsSmsConfirmOpen(true)}
              className="w-full sm:w-80 py-2 px-3 rounded-lg bg-slate-950/90 hover:bg-slate-900 text-amber-400 hover:text-amber-300 border border-amber-600/40 text-[11px] font-mono font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>No Internet? Send SMS SOS Fallback</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. NEAREST EMERGENCY STATIONS & PROXIMITY MATRIX */}
      <div className="tactical-card p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase text-white tracking-wider">
              Nearest Municipal Response Stations (Live Telemetry)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Speed reference: 35 km/h urban emergency transit
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {stationDistances.map((s) => {
            const meta = AGENCY_METADATA[s.code as keyof typeof AGENCY_METADATA] || { name: s.code, short: s.code };
            const coord = STATION_COORDINATES[s.code];
            return (
              <div
                key={s.code}
                className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{meta.short}</span>
                    <span className="text-[10px] font-mono font-bold text-sky-400">~{s.estMinutes} min</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 block">{s.distKm} km away</span>
                </div>
                <button
                  type="button"
                  onClick={() => coord && handleOpenGoogleMapsDir(coord.lat, coord.lng)}
                  className="mt-2 text-[10px] font-mono text-sky-400 hover:text-sky-300 font-bold underline text-left flex items-center gap-1"
                >
                  <span>Route Map</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. EMERGENCY HOTLINES STRIP: INSTANT CLICK-TO-CALL CARDS */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              24/7 Emergency Hotlines (Instant Click-to-Call)
            </h2>
          </div>
          
          {/* Station Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'LDRRMO', 'RHU', 'FIRE', 'PNP'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedStationFilter(filter)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                  selectedStationFilter === filter
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(AGENCY_METADATA)
            .filter(([_, meta]) => selectedStationFilter === 'ALL' || meta.short === selectedStationFilter)
            .map(([key, meta]) => {
              const styles = getAgencyStyles(meta.short);
              const dialNumber = getDialNumber(meta.hotline);
              const distInfo = stationDistances.find((d) => d.code === meta.short);

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

                    {distInfo && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-300">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{distInfo.distKm} km</span>
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className="text-sky-400 font-bold">~{distInfo.estMinutes} min ETA</span>
                      </div>
                    )}
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
                      <PhoneCall className="w-4 h-4" />
                      <span>Instant Call: {dialNumber}</span>
                    </a>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 6. SATELLITE HAZARD MAP & EVACUATION SAFE ZONES WITH MODAL ENLARGE */}
      <div className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-600/40 flex items-center justify-center text-sky-400 font-bold">
              <Navigation className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Municipal Evacuation Safe Zones & Hazard Markers
              </h3>
              <p className="text-[11px] text-slate-400">
                Spatial visualization of designated safe zones, medical stations, and community hazards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-600/30">
              ● {fixtures.length} Active Safe Points
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMapModalOpen(true)}
              className="text-xs font-mono font-bold"
            >
              <span className="flex items-center gap-1">
                <span>Enlarge Map</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Button>
          </div>
        </div>

        <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-800/80 relative">
          <SatelliteCommandMap
            markers={markers}
            centerLat={coords.latitude}
            centerLng={coords.longitude}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* Full-Screen Expanded Map Modal */}
      <DefaultFloatingModalCard
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="Municipal Satellite Tactical Command Map"
        size="lg"
      >
        <div className="flex flex-col gap-4 h-[75vh]">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-emerald-400 font-bold">
              GPS SENSOR: {coords.latitude.toFixed(6)}° N, {coords.longitude.toFixed(6)}° E (±{Math.round(coords.accuracy)}m)
            </span>
            <span className="text-slate-400">
              {fixtures.length} Designated Evacuation Shelters & Relief Hubs
            </span>
          </div>

          <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-800">
            <SatelliteCommandMap
              markers={markers}
              centerLat={coords.latitude}
              centerLng={coords.longitude}
              className="h-full w-full"
            />
          </div>
        </div>
      </DefaultFloatingModalCard>

      {/* Offline SMS Emergency Confirmation Modal */}
      <DefaultFloatingModalCard
        isOpen={isSmsConfirmOpen}
        onClose={() => setIsSmsConfirmOpen(false)}
        title="Offline SMS Emergency Dispatch"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-600/50 text-xs text-amber-200">
            <p className="font-bold mb-1 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>Offline Cellular Protocol</span>
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              If mobile data or Wi-Fi is unavailable in remote barangays, your phone will open your default SMS messaging app with pre-filled coordinates addressed directly to the municipal command dispatcher hotline.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 break-words">
            <span className="text-slate-500 block mb-1">SMS PAYLOAD PREVIEW:</span>
            EMERGENCY SOS: Accident at GPS ({coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}), Accuracy ±{Math.round(coords.accuracy)}m.
          </div>

          <div className="flex items-center gap-3 pt-2">
            <a
              href={`sms:${SMS_HOTLINE_NUMBER}?body=${smsBody}`}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-950/60"
            >
              <span>Launch Phone SMS App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsSmsConfirmOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DefaultFloatingModalCard>

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
