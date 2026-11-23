// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Interactive live satellite command map for Katipunan residents.
// Displays real-time GPS telemetry, extracted street addresses, evacuation shelters, and signed-in resident's My Reports (N)
// sorted strictly newest-to-oldest (descending by createdAt), navigating to /civilian/my-reports on click.
// Strictly 100% arrow functions (=>), ZERO 'any', ZERO emojis, resident-only telemetry, and ZERO tel: links.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowRight,
  Radio,
  MapPin,
  Clock
} from 'lucide-react';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { getAllReports, getMyReports, ReportItem } from '@/Endpoints/reportsApi';
import { getIncidentFixtures, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useSession } from '@/Hooks/useSession';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { KATIPUNAN_BASE_COORDS } from '@/Libs/Map/mapAccuracy';
import { resolveStreetAddressSync } from '@/Libs/Map/addressResolver';
import { formatRelativeTime } from '@/Libs/Assets/formatters';
import { CivilianButton } from './Shared/CivilianButton';

const REFRESH_INTERVAL_MS = 8000;

type MapLayerFilter = 'ALL' | 'MY_REPORTS' | 'SHELTERS';

type ExtendedReportItem = ReportItem & {
  aiAutoApproved?: boolean;
};

const resolveMapReportStatus = (report: ExtendedReportItem): { label: string; badgeClass: string } => {
  const raw = (report.status || 'Reported').trim().toUpperCase();
  if (raw === 'REJECTED') {
    return {
      label: 'Rejected',
      badgeClass: 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
    };
  }
  if (raw === 'RESOLVED' || raw === 'CLOSED' || Boolean(report.resolvedAt) || Boolean(report.closedAt)) {
    return {
      label: 'Mark as Done',
      badgeClass: 'bg-[#E9D9D0] text-[#670626] border-[#670626]/35'
    };
  }
  if (raw === 'INPROGRESS' || raw === 'IN_PROGRESS' || raw === 'WORKINGPROGRESS') {
    return {
      label: 'Working Progress',
      badgeClass: 'bg-[#A83B4D] text-[#F7F1EA] border-[#A83B4D]'
    };
  }
  if (raw === 'ALLOCATED' || raw === 'ENROUTE' || raw === 'ONSCENE' || raw === 'DISPATCHED' || report.allocatedUnitCode) {
    return {
      label: 'Dispatched',
      badgeClass: 'bg-[#A83B4D] text-[#F7F1EA] border-[#A83B4D]'
    };
  }
  if (raw === 'VERIFIED' || report.verifiedAt || report.aiAutoApproved) {
    const isAiApproved =
      Boolean(report.aiAutoApproved) || report.aiVerificationStatus === 'AI_AUTO_APPROVED';
    return {
      label: isAiApproved ? 'AI Auto-Approved' : 'Manual Approved',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
    };
  }
  return {
    label: 'Awaiting Triage',
    badgeClass: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/45'
  };
};

export const CivilianLiveMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const { coords, isHardwareGeolocated, resolvedAddress, refreshGps } = useGpsLocation();
  const [fixtures, setFixtures] = useState<IncidentFixture[]>([]);
  const [allReports, setAllReports] = useState<ExtendedReportItem[]>([]);
  const [myRawReports, setMyRawReports] = useState<ExtendedReportItem[]>([]);
  const [activeLayer, setActiveLayer] = useState<MapLayerFilter>('ALL');
  const [isResyncing, setIsResyncing] = useState<boolean>(false);

  const currentStreetAddress = useMemo(
    () => resolvedAddress || resolveStreetAddressSync(coords.latitude, coords.longitude),
    [resolvedAddress, coords.latitude, coords.longitude]
  );

  const loadData = useCallback(async () => {
    try {
      const [f, repList, myRepList] = await Promise.all([
        getIncidentFixtures().catch(() => []),
        getAllReports().catch(() => []),
        getMyReports().catch(() => [])
      ]);

      setFixtures(Array.isArray(f) ? f : []);
      setAllReports(Array.isArray(repList) ? (repList as ExtendedReportItem[]) : []);
      setMyRawReports(Array.isArray(myRepList) ? (myRepList as ExtendedReportItem[]) : []);
    } catch (err) {
      console.error('Failed to refresh civilian live map telemetry:', err);
      setFixtures([]);
    }
  }, []);

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

  // Strictly filter to the signed-in civilian's reports and sort newest-to-oldest (descending by createdAt)
  const myReports = useMemo(() => {
    const filtered = myRawReports.filter((r) => {
      if (!r || !r.id) return false;
      if (session?.userId && r.reporterId) {
        return r.reporterId === session.userId;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.submittedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.submittedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [myRawReports, session?.userId]);

  // Build map markers based on active layer filter
  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [];
    if (isHardwareGeolocated && coords.latitude && coords.longitude) {
      list.push({
        id: 'citizen-gps',
        lat: coords.latitude,
        lng: coords.longitude,
        title: 'Your Current Position',
        locationLabel: currentStreetAddress,
        type: 'gps' as const
      });
    }

    if (activeLayer === 'ALL' || activeLayer === 'SHELTERS') {
      fixtures.forEach((f) => {
        list.push({
          id: f.id,
          lat: f.latitude,
          lng: f.longitude,
          title: f.title,
          type: 'fixture' as const,
          category: f.category,
          agency: f.assignedUnitType,
          locationLabel: resolveStreetAddressSync(f.latitude, f.longitude)
        });
      });
    }

    if (activeLayer === 'ALL' || activeLayer === 'MY_REPORTS') {
      myReports.forEach((r) => {
        const lat = Number(r.currentLatitude ?? r.latitude);
        const lng = Number(r.currentLongitude ?? r.longitude);
        const resolvedStreet = r.locationLabel || resolveStreetAddressSync(lat, lng);
        list.push({
          id: `my-report-${r.id}`,
          lat,
          lng,
          title: r.title,
          status: r.status || 'Reported',
          type: 'incident' as const,
          category: r.category,
          severity: r.severity,
          agency: r.recommendedAgencyUnit || undefined,
          locationLabel: resolvedStreet,
          evidenceUrl: r.hasImage ? (r.imageUrl || `/api/reports/${r.id}/image`) : undefined,
          reportedAt: r.createdAt || r.submittedAt || undefined,
          verifiedAt: r.verifiedAt,
          resolvedAt: r.resolvedAt,
          closedAt: r.closedAt,
          aiVerificationStatus: r.aiVerificationStatus,
          closureSummary: r.closureSummary,
          closureApprovalMode: r.closureApprovalMode,
          requiresManualVerification: r.requiresManualVerification,
          gpsAccuracyMeters: r.gpsAccuracyMeters ?? undefined,
          description: r.note || resolvedStreet,
          allocatedUnitCode: r.allocatedUnitCode,
          allocatedUnitId: r.allocatedUnitId
        });
      });
    }

    if (activeLayer === 'ALL') {
      allReports
        .filter((r) => {
          if (myReports.some((m) => m.id === r.id)) return false;
          const statusUpper = (r.status || '').toUpperCase();
          return (
            statusUpper === 'VERIFIED' ||
            statusUpper === 'ALLOCATED' ||
            statusUpper === 'DISPATCHED' ||
            statusUpper === 'ENROUTE' ||
            statusUpper === 'ONSCENE' ||
            statusUpper === 'INPROGRESS' ||
            statusUpper === 'RESOLVED' ||
            statusUpper === 'CLOSED' ||
            Boolean(r.verifiedAt)
          );
        })
        .forEach((r) => {
          const lat = Number(r.currentLatitude ?? r.latitude);
          const lng = Number(r.currentLongitude ?? r.longitude);
          const resolvedStreet = r.locationLabel || resolveStreetAddressSync(lat, lng);
          list.push({
            id: `community-report-${r.id}`,
            lat,
            lng,
            title: r.title,
            status: r.status || 'Verified',
            type: 'incident' as const,
            category: r.category,
            severity: r.severity,
            agency: r.recommendedAgencyUnit || undefined,
            locationLabel: resolvedStreet,
            evidenceUrl: r.hasImage ? (r.imageUrl || `/api/reports/${r.id}/image`) : undefined,
            reportedAt: r.createdAt || r.submittedAt || undefined,
            verifiedAt: r.verifiedAt,
            resolvedAt: r.resolvedAt,
            closedAt: r.closedAt,
            aiVerificationStatus: r.aiVerificationStatus,
            closureSummary: r.closureSummary,
            closureApprovalMode: r.closureApprovalMode,
            requiresManualVerification: r.requiresManualVerification,
            gpsAccuracyMeters: r.gpsAccuracyMeters ?? undefined,
            description: r.note || resolvedStreet,
            allocatedUnitCode: r.allocatedUnitCode,
            allocatedUnitId: r.allocatedUnitId
          });
        });
    }

    return list;
  }, [
    coords.latitude,
    coords.longitude,
    currentStreetAddress,
    isHardwareGeolocated,
    fixtures,
    myReports,
    allReports,
    activeLayer
  ]);

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F7F1EA]/20 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
            Katipunan Sector
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
            Live Map
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/civilian/report">
            <CivilianButton variant="danger" size="sm" className="min-h-[40px] text-sm">
              + Reports Incident
            </CivilianButton>
          </Link>
          <Link to="/civilian/dashboard">
            <CivilianButton variant="outline" size="sm" className="min-h-[40px] text-sm">
              Dashboard
            </CivilianButton>
          </Link>
        </div>
      </div>

      {/* 2. GPS Telemetry Bar & Layer Controls */}
      <div className="clay-surface flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 text-sm font-mono shadow-[0_12px_28px_rgba(74,4,26,0.22)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isHardwareGeolocated ? 'bg-emerald-600 animate-pulse' : 'bg-[#A83B4D]'
              }`}
            />
            <span className="text-[#A83B4D] font-bold">GPS:</span>
            <span className="text-[#670626] font-black">
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </span>
            <span className="text-[#A83B4D]">(±{Math.round(coords.accuracy)}m)</span>
          </div>
          <span className="text-xs font-sans font-semibold text-[#670626] truncate max-w-xs">
            {currentStreetAddress}
          </span>
          <button
            type="button"
            onClick={handleForceResync}
            className="text-[#670626] hover:text-[#4A041A] font-bold underline flex items-center gap-1.5 ml-1 cursor-pointer text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResyncing ? 'animate-spin' : ''}`} />
            <span>{isResyncing ? 'Syncing...' : 'Re-sync'}</span>
          </button>
        </div>

        {/* Map Layer Filter Tabs (No Stations) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[#A83B4D] font-bold flex items-center gap-1 mr-1 text-xs">
            <Layers className="w-4 h-4" />
            <span>Layer:</span>
          </span>
          {(['ALL', 'MY_REPORTS', 'SHELTERS'] as const).map((layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => setActiveLayer(layer)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeLayer === layer
                  ? 'bg-[#670626] text-[#F7F1EA] shadow-sm'
                  : 'bg-[#E9D9D0] text-[#670626] hover:bg-[#670626]/15 border border-[#670626]/15'
              }`}
            >
              {layer === 'ALL' && `All (${markers.length})`}
              {layer === 'MY_REPORTS' && `My Reports (${myReports.length})`}
              {layer === 'SHELTERS' && `Safe Zones (${fixtures.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Primary Satellite Command Map Canvas */}
      <div className="clay-surface p-4 sm:p-5 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 shadow-[0_14px_34px_rgba(74,4,26,0.25)] flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm font-mono px-1">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#670626]" />
            <strong className="text-[#670626]">Live Sector Map</strong>
          </span>
          <span className="text-xs font-bold text-[#A83B4D] bg-[#E9D9D0] px-2.5 py-1 rounded-lg border border-[#670626]/15">
            {markers.length} Pins
          </span>
        </div>

        <div className="h-[440px] sm:h-[540px] w-full rounded-xl overflow-hidden border border-[#670626]/20 bg-[#E9D9D0] relative">
          <SatelliteCommandMap
            markers={markers}
            centerLat={
              typeof coords.latitude === 'number' && Number.isFinite(coords.latitude)
                ? coords.latitude
                : KATIPUNAN_BASE_COORDS.latitude
            }
            centerLng={
              typeof coords.longitude === 'number' && Number.isFinite(coords.longitude)
                ? coords.longitude
                : KATIPUNAN_BASE_COORDS.longitude
            }
            roleFilter="Civilian"
            className="h-full w-full"
          />
        </div>
      </div>

      {/* 4. My Reports Timeline (Filtered to signed-in civilian, newest-to-oldest, click -> /civilian/my-reports) */}
      <div className="clay-surface p-5 sm:p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 flex flex-col gap-4 shadow-[0_14px_34px_rgba(74,4,26,0.25)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#670626]/15 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#670626] animate-pulse" />
            <h2 className="text-base font-black text-[#670626] uppercase tracking-wider font-mono">
              My Reports ({myReports.length})
            </h2>
          </div>
          <Link
            to="/civilian/my-reports"
            className="text-sm font-mono font-bold text-[#670626] hover:text-[#4A041A] underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {myReports.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2.5 bg-[#E9D9D0] rounded-xl border border-[#670626]/15">
            <Radio className="w-8 h-8 text-[#A83B4D] mb-1" />
            <span className="text-sm font-bold text-[#670626]">
              No reports yet
            </span>
            <Link to="/civilian/report" className="mt-2">
              <CivilianButton variant="danger" size="sm" className="text-sm">
                + Reports Incident
              </CivilianButton>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {myReports.map((r) => {
              const statusInfo = resolveMapReportStatus(r);
              const resolvedStreet = r.locationLabel || resolveStreetAddressSync(r.latitude, r.longitude);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate('/civilian/my-reports')}
                  className="text-left p-4 rounded-xl bg-[#E9D9D0] hover:bg-[#E9D9D0]/80 border border-[#670626]/15 hover:border-[#670626] transition-all flex flex-col gap-2 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-black text-[#A83B4D]">
                      #{r.referenceCode}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${statusInfo.badgeClass}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <span className="text-sm font-bold text-[#670626] line-clamp-1">
                    {r.title}
                  </span>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#A83B4D]">
                    <span className="inline-flex items-center gap-1 truncate max-w-[65%]">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{resolvedStreet}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatRelativeTime(r.createdAt || r.submittedAt)}</span>
                    </span>
                  </div>

                  {r.allocatedUnitCode && (
                    <div className="text-xs font-mono text-[#670626] font-bold flex items-center gap-1 pt-1 border-t border-[#670626]/10">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#670626]" />
                      <span>Unit: {r.allocatedUnitCode}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CivilianLiveMapPage;
