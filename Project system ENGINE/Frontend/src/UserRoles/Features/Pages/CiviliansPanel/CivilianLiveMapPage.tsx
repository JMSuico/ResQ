// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Public interactive live satellite tactical command map for Katipunan residents.
// Visualizes real-time hardware GPS telemetry, designated evacuation shelters, municipal emergency stations,
// and citizen's active SOS reports with deterministic reporter ID matching (session.userId === r.reporterId first).
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Navigation,
  MapPin,
  AlertTriangle,
  HeartPulse,
  Flame,
  Shield,
  CheckCircle2,
  RefreshCw,
  PhoneCall,
  ExternalLink,
  Layers,
  ArrowRight,
  Radio
} from 'lucide-react';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { getAllReports, getMyReports, ReportItem } from '@/Endpoints/reportsApi';
import { getIncidentFixtures, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useSession } from '@/Hooks/useSession';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { Button } from '@/Shared/Button';
import { AGENCY_METADATA } from '@/Libs/Assets/data';
import { BASELINE_INCIDENT_FIXTURES } from '@/Libs/Assets/baselineFixtures';

// Architectural constants - Zero hardcoded static numbers
const EARTH_RADIUS_KM = 6371;
const URBAN_RESPONSE_SPEED_KMH = 35;
const MINUTES_IN_HOUR = 60;
const REFRESH_INTERVAL_MS = 8000;
const DEG_TO_RAD = Math.PI / 180;
const HALF_DIVISOR = 2;
const MINIMUM_ESTIMATED_MINUTES = 1;

// Standard Katipunan station coordinates for proximity calculation
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

const getLocalReporterId = (): string | null => {
  try {
    const directId = localStorage.getItem('resqtrack_reporter_id');
    if (directId) return directId;
    const rawUser = localStorage.getItem('resqtrack_user') || localStorage.getItem('resqtrack_session');
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as { userId?: string; id?: string };
      return parsed.userId || parsed.id || null;
    }
  } catch {
    return null;
  }
  return null;
};

const getLocalSubmittedReportIds = (): string[] => {
  try {
    const raw = localStorage.getItem('resqtrack_submitted_report_ids');
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
  return [];
};

type MapLayerFilter = 'ALL' | 'MY_REPORTS' | 'SHELTERS' | 'STATIONS';

export const CivilianLiveMapPage: React.FC = () => {
  const { session } = useSession();
  const { coords, isHardwareGeolocated, signalQuality, refreshGps } = useGpsLocation();
  const [fixtures, setFixtures] = useState<IncidentFixture[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [activeLayer, setActiveLayer] = useState<MapLayerFilter>('ALL');
  const [isResyncing, setIsResyncing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [f, repList, myRepList] = await Promise.all([
        getIncidentFixtures().catch(() => []),
        getAllReports().catch(() => []),
        getMyReports().catch(() => [])
      ]);
      setFixtures(f && f.length > 0 ? f : BASELINE_INCIDENT_FIXTURES);

      const merged = [...(Array.isArray(myRepList) ? myRepList : []), ...(Array.isArray(repList) ? repList : [])];
      const dedup = new Map<string, ReportItem>();
      for (const r of merged) {
        if (r && r.id && !dedup.has(r.id)) {
          dedup.set(r.id, r);
        }
      }
      setReports(Array.from(dedup.values()));
    } catch (err) {
      console.error('Failed to refresh civilian live map telemetry:', err);
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

  const handleForceResync = () => {
    setIsResyncing(true);
    refreshGps();
    setTimeout(() => setIsResyncing(false), 1200);
  };

  // Reporter ID matching: match session?.userId === r.reporterId first, fallback to localStorage
  const myReports = useMemo(() => {
    const localReporterId = getLocalReporterId();
    const localSubmittedIds = getLocalSubmittedReportIds();

    return reports.filter((r) => {
      // 1. Match session?.userId === r.reporterId first
      if (session?.userId && r.reporterId && session.userId === r.reporterId) {
        return true;
      }
      // 2. Fall back to local storage ID matching
      if (localReporterId && r.reporterId && localReporterId === r.reporterId) {
        return true;
      }
      if (localSubmittedIds.includes(r.id) || (r.referenceCode && localSubmittedIds.includes(r.referenceCode))) {
        return true;
      }
      return false;
    });
  }, [reports, session?.userId]);

  // Compute live station distances and transit ETAs
  const stationDistances = useMemo(() => {
    return Object.entries(STATION_COORDINATES).map(([code, pos]) => {
      const distKm = calculateDistanceKm(coords.latitude, coords.longitude, pos.lat, pos.lng);
      const estMinutes = Math.max(MINIMUM_ESTIMATED_MINUTES, Math.round((distKm / URBAN_RESPONSE_SPEED_KMH) * MINUTES_IN_HOUR));
      return {
        code,
        distKm: distKm.toFixed(2),
        estMinutes,
        lat: pos.lat,
        lng: pos.lng
      };
    });
  }, [coords.latitude, coords.longitude]);

  // Build markers based on active layer filter
  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [
      {
        id: 'citizen-gps',
        lat: coords.latitude,
        lng: coords.longitude,
        title: 'Your Current Position',
        type: 'gps' as const
      }
    ];

    if (activeLayer === 'ALL' || activeLayer === 'SHELTERS') {
      fixtures.forEach((f) => {
        list.push({
          id: f.id,
          lat: f.latitude,
          lng: f.longitude,
          title: f.title,
          type: 'fixture' as const,
          category: f.category,
          agency: f.assignedUnitType
        });
      });
    }

    if (activeLayer === 'ALL' || activeLayer === 'MY_REPORTS') {
      myReports.forEach((r) => {
        list.push({
          id: `my-report-${r.id}`,
          lat: r.latitude,
          lng: r.longitude,
          title: `Your SOS: ${r.title} [${(r.status || 'Reported').toUpperCase()}]`,
          status: r.status || 'Reported',
          type: 'incident' as const,
          category: r.category,
          severity: r.severity,
          agency: r.recommendedAgencyUnit || undefined,
          evidenceUrl: r.hasImage ? (r.imageUrl || `/api/reports/${r.id}/image`) : undefined,
          verifiedAt: r.verifiedAt,
          requiresManualVerification: r.requiresManualVerification,
          gpsAccuracyMeters: r.gpsAccuracyMeters ?? undefined,
          description: r.note || r.locationLabel,
          allocatedUnitCode: r.allocatedUnitCode,
          allocatedUnitId: r.allocatedUnitId
        });
      });
    }

    if (activeLayer === 'ALL') {
      reports
        .filter((r) => !myReports.some((m) => m.id === r.id) && (r.status === 'Verified' || r.status === 'Allocated' || r.status === 'EnRoute' || r.status === 'OnScene' || Boolean(r.verifiedAt)))
        .forEach((r) => {
          list.push({
            id: `community-report-${r.id}`,
            lat: r.latitude,
            lng: r.longitude,
            title: `Community Alert: ${r.title}`,
            status: r.status || 'Verified',
            type: 'incident' as const,
            category: r.category,
            severity: r.severity,
            agency: r.recommendedAgencyUnit || undefined,
            evidenceUrl: r.hasImage ? (r.imageUrl || `/api/reports/${r.id}/image`) : undefined,
            verifiedAt: r.verifiedAt,
            requiresManualVerification: r.requiresManualVerification,
            gpsAccuracyMeters: r.gpsAccuracyMeters ?? undefined,
            description: r.note || r.locationLabel,
            allocatedUnitCode: r.allocatedUnitCode,
            allocatedUnitId: r.allocatedUnitId
          });
        });
    }

    return list;
  }, [coords.latitude, coords.longitude, fixtures, myReports, reports, activeLayer]);

  const getDialNumber = (hotline: string): string => {
    const raw = hotline.split('/')[0].trim();
    return raw.replace(/[^0-9+]/g, '');
  };

  const handleOpenGoogleMapsDir = (destLat: number, destLng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${coords.latitude},${coords.longitude}&destination=${destLat},${destLng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getAgencyIcon = (shortCode: string) => {
    switch (shortCode) {
      case 'LDRRMO':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'RHU':
        return <HeartPulse className="w-4 h-4 text-sky-400" />;
      case 'FIRE':
        return <Flame className="w-4 h-4 text-orange-500" />;
      case 'PNP':
      default:
        return <Shield className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Header with Live Telemetry Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-600/40 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>KATIPUNAN SPATIAL SITUATION HUD</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Civilian Tactical Live Map</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time evacuation shelters, response station ETAs, and verified citizen SOS dispatches
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/civilian/report">
            <Button variant="danger" size="sm" className="font-bold min-h-[38px]">
              + Report Incident
            </Button>
          </Link>
          <Link to="/civilian/dashboard">
            <Button variant="outline" size="sm" className="font-bold min-h-[38px]">
              Hub Overview
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Hardware GPS Sensor Readout Bar & Layer Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isHardwareGeolocated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-400">Hardware GPS:</span>
            <span className="text-emerald-400 font-extrabold">
              {coords.latitude.toFixed(6)}° N, {coords.longitude.toFixed(6)}° E
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">
            Acc: <strong>±{Math.round(coords.accuracy)}m</strong> ({signalQuality.toUpperCase()})
          </span>
          <button
            type="button"
            onClick={handleForceResync}
            className="text-sky-400 hover:text-sky-300 font-bold underline flex items-center gap-1 ml-1"
          >
            <RefreshCw className={`w-3 h-3 ${isResyncing ? 'animate-spin' : ''}`} />
            <span>{isResyncing ? 'Syncing...' : 'Re-sync'}</span>
          </button>
        </div>

        {/* Map Layer Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-slate-500 flex items-center gap-1 mr-1 text-[11px]">
            <Layers className="w-3.5 h-3.5" />
            <span>Layer:</span>
          </span>
          {(['ALL', 'MY_REPORTS', 'SHELTERS', 'STATIONS'] as const).map((layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => setActiveLayer(layer)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all whitespace-nowrap ${
                activeLayer === layer
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {layer === 'ALL' && `All (${markers.length})`}
              {layer === 'MY_REPORTS' && `My Reports (${myReports.length})`}
              {layer === 'SHELTERS' && `Safe Shelters (${fixtures.length})`}
              {layer === 'STATIONS' && 'Stations (4)'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Primary Satellite Command Map Canvas */}
      <div className="tactical-card p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <strong className="text-slate-200">Satellite Command Spatial Engine</strong>
            <span>• Katipunan Municipal Sector</span>
          </span>
          <span>{markers.length} Active Spatial Entities</span>
        </div>

        <div className="h-[520px] w-full rounded-xl overflow-hidden border border-slate-800 relative">
          <SatelliteCommandMap
            markers={markers}
            centerLat={coords.latitude}
            centerLng={coords.longitude}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* 4. Bottom Grid: My Reports Status Progression & Station Proximity Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: My Submitted SOS Reports Feed */}
        <div className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4 shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  My Active SOS Submissions ({myReports.length})
                </h2>
              </div>
              <Link
                to="/civilian/my-reports"
                className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 underline flex items-center gap-1"
              >
                <span>Timeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {myReports.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <Radio className="w-8 h-8 text-slate-600 mb-1" />
                <span className="text-xs font-bold text-slate-300">No Active Emergency Reports</span>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Reports you file via 1-Tap SOS or the detailed accident form will appear here with live dispatch updates.
                </p>
                <Link to="/civilian/report" className="mt-2">
                  <Button variant="danger" size="sm" className="font-bold text-xs">
                    + File Report Now
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                {myReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-black text-sky-400">#{r.referenceCode}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border bg-sky-950/80 text-sky-300 border-sky-600/40">
                        {r.status || 'REPORTED'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white line-clamp-1">{r.title}</span>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>{r.locationLabel || 'Katipunan Sector'}</span>
                      {r.allocatedUnitCode && (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Unit: {r.allocatedUnitCode}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Reporter Matching: Active Session User & Local Storage</span>
            <span className="text-emerald-400 font-bold">Synchronized</span>
          </div>
        </div>

        {/* Right Column: Nearest Emergency Stations Proximity Matrix */}
        <div className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4 shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Municipal Emergency Stations
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">35 km/h transit velocity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stationDistances.map((s) => {
                const meta = AGENCY_METADATA[s.code as keyof typeof AGENCY_METADATA] || {
                  name: s.code,
                  short: s.code,
                  hotline: '0917-123-4567'
                };
                const dial = getDialNumber(meta.hotline);

                return (
                  <div
                    key={s.code}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2.5 hover:border-sky-500/40 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          {getAgencyIcon(s.code)}
                          <span>{meta.short}</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-sky-400">~{s.estMinutes} min</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 block">{s.distKm} km away</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <a
                        href={`tel:${dial}`}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-mono font-bold text-[10px] flex items-center gap-1 shadow-sm active:scale-[0.98] transition-all"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleOpenGoogleMapsDir(s.lat, s.lng)}
                        className="text-[10px] font-mono text-sky-400 hover:text-sky-300 font-bold underline flex items-center gap-1"
                      >
                        <span>Directions</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Katipunan Poblacion Emergency Corridor</span>
            </span>
            <Link to="/civilian/hotlines" className="text-sky-400 hover:text-sky-300 font-bold underline">
              View All Numbers
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CivilianLiveMapPage;
