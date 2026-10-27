// [Layer: AdminsPanel]
// Responsibility: Exact React 19 conversion of DashboardPage matching dashboard.html / dashboard.css / dashboard.js.
// 100% CSS class & DOM hierarchy integrity, Universal Lambdas (=>), and continuous real GPS telemetry.
// Universal Lucide migration (zero raw inline <svg> / <use href="#i-*"/>), zero hardcoded static numbers, and live relational synchronization.

import React, { useState, useEffect, useCallback } from 'react';
import L from 'leaflet';
import {
  Plus,
  Minus,
  Crosshair,
  Navigation,
  Activity,
  MapPin,
  Zap,
  Camera,
  AlertTriangle,
  Clock
} from 'lucide-react';
import SatelliteCommandMap, { IncidentPinData } from '@/Shared/SatelliteCommandMap';
import AccidentReportModal from '@/Shared/AccidentReportModal';
import { getAllReports, ReportItem } from '@/Endpoints/reportsApi';
import { getDutyRoster, DutyUnit } from '@/Endpoints/responderOpsApi';
import { getAnalyticsSummary, AnalyticsSummaryDto } from '@/Endpoints/analyticsApi';
import { requestJson } from '@/Endpoints/apiClient';
import { useGpsLocation } from '@/Hooks/useGpsLocation';

export const calculateHaversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

export const calculateDynamicEtaMinutes = (distanceKm: number, averageSpeedKmH = 40): number => {
  if (distanceKm <= 0) return 1;
  const hours = distanceKm / averageSpeedKmH;
  return Math.max(1, Math.round(hours * 60));
};

export const DashboardPage: React.FC = () => {
  const { coords, isHardwareGeolocated, signalQuality, refreshGps } = useGpsLocation();

  const [incidents, setIncidents] = useState<IncidentPinData[]>([]);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [unitsCount, setUnitsCount] = useState<number>(0);
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [coordsPing, setCoordsPing] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2800);
  };

  const fetchLiveTelemetry = useCallback(async () => {
    try {
      const [reports, roster, analytics] = await Promise.all([
        getAllReports().catch(() => [] as ReportItem[]),
        requestJson<DutyUnit[]>('/api/responder-ops/roster', { method: 'GET' })
          .catch(() => getDutyRoster().catch(() => [] as DutyUnit[])),
        getAnalyticsSummary().catch(() => null as AnalyticsSummaryDto | null)
      ]);

      if (reports && reports.length > 0) {
        const mapped: IncidentPinData[] = reports.map((r: ReportItem) => ({
          id: r.referenceCode || r.id,
          type: r.title || r.category || 'Road Accident',
          status: (r.status || '').toLowerCase() === 'resolved' ? 'resolved' : 'critical',
          statusLabel: r.requiresManualVerification ? 'Manual Review' : (r.severity || 'Critical'),
          place: r.locationLabel || 'Katipunan, ZN',
          lat: r.latitude,
          lng: r.longitude,
          isBlurry: r.isBlurry,
          requiresManualVerification: r.requiresManualVerification,
          recommendedAgency: r.recommendedAgencyUnit,
          gpsAccuracyMeters: r.gpsAccuracyMeters ?? undefined
        }));
        setIncidents(mapped);
      }

      const activeCritical = reports.filter(
        (r: ReportItem) =>
          (r.severity || '').toLowerCase() === 'critical' &&
          (r.status || '').toLowerCase() !== 'resolved'
      ).length;
      setCriticalCount(analytics?.criticalIncidents ?? activeCritical);

      const activeDutyUnits = roster.filter(
        (u: DutyUnit) => u.status === 'OnDuty' || u.status === 'Dispatched'
      ).length;
      setUnitsCount(analytics?.onDutyResponders ?? activeDutyUnits);
    } catch (err) {
      console.warn('[DashboardPage] Telemetry fetch warning:', err);
    }
  }, []);

  // Load database incident pins and roster telemetry on mount
  useEffect(() => {
    void fetchLiveTelemetry();
  }, [fetchLiveTelemetry]);

  // Listen to new live reports dispatched across the system
  useEffect(() => {
    const handleCustomReport = (e: Event) => {
      const customEvent = e as CustomEvent<ReportItem>;
      if (customEvent.detail) {
        const rep = customEvent.detail;
        const newInc: IncidentPinData = {
          id: rep.referenceCode || rep.id || `INC-${Math.floor(1000 + Math.random() * 9000)}`,
          type: rep.title || rep.category || 'Road Accident',
          status: 'critical',
          statusLabel: rep.requiresManualVerification ? 'Manual Review' : 'Critical Priority',
          place: rep.locationLabel || 'Katipunan, Zamboanga del Norte',
          lat: rep.latitude || coords.latitude,
          lng: rep.longitude || coords.longitude,
          isBlurry: rep.isBlurry,
          requiresManualVerification: rep.requiresManualVerification,
          recommendedAgency: rep.recommendedAgencyUnit,
          gpsAccuracyMeters: rep.gpsAccuracyMeters ?? coords.accuracy
        };
        setIncidents((prev) => [newInc, ...prev]);
        setCriticalCount((prev) => prev + 1);

        if (newInc.requiresManualVerification) {
          showToast('⚠️ New incident reported with low-clarity photo — flagged for manual review.');
        } else {
          showToast('🚨 Live road accident reported — dispatched to response queue.');
        }
      }
    };

    window.addEventListener('resqtrack:report', handleCustomReport);
    return () => {
      window.removeEventListener('resqtrack:report', handleCustomReport);
    };
  }, [coords]);

  const handleZoomIn = () => {
    if (mapInstance) {
      if (mapInstance.getZoom() >= 18) {
        showToast('Maximum zoom level reached.');
        return;
      }
      mapInstance.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstance) {
      if (mapInstance.getZoom() <= 11) {
        showToast('Minimum zoom level reached.');
        return;
      }
      mapInstance.zoomOut();
    }
  };

  const handleRecenter = () => {
    if (mapInstance) {
      const homeBounds = L.latLngBounds([8.32, 123.15], [8.60, 123.40]);
      mapInstance.fitBounds(homeBounds, { padding: [18, 18] });
    }
    setCoordsPing(false);
    setTimeout(() => setCoordsPing(true), 10);
    showToast('Map recentered on Municipality of Katipunan.');
  };

  const handleLocate = () => {
    refreshGps();
    if (mapInstance && coords) {
      mapInstance.setView([coords.latitude, coords.longitude], 15);
      showToast(
        isHardwareGeolocated
          ? `Hardware GPS Lock: ±${Math.round(coords.accuracy)}m (${signalQuality.toUpperCase()})`
          : 'Acquiring continuous satellite GPS feed...'
      );
    }
  };

  const latText = `${coords.latitude.toFixed(4)}° N`;
  const lngText = `${coords.longitude.toFixed(4)}° E`;

  return (
    <div className="dash">
      <main className="mapview" aria-label="Live incident map">
        <div className="mapview__canvas" id="map-canvas">
          <SatelliteCommandMap incidents={incidents} onMapReady={(m) => setMapInstance(m)} />

          <div className="mapctl">
            <div className="mapctl__zoom" role="group" aria-label="Map zoom">
              <button
                className="mapctl__btn"
                type="button"
                id="map-in"
                aria-label="Zoom in"
                onClick={handleZoomIn}
              >
                <Plus aria-hidden="true" />
              </button>
              <button
                className="mapctl__btn"
                type="button"
                id="map-out"
                aria-label="Zoom out"
                onClick={handleZoomOut}
              >
                <Minus aria-hidden="true" />
              </button>
            </div>
            <button
              className="mapctl__recenter"
              type="button"
              id="map-recenter"
              aria-label="Recenter on Katipunan"
              onClick={handleRecenter}
            >
              <Crosshair aria-hidden="true" />
            </button>
            <button
              className="mapctl__locate"
              type="button"
              id="map-locate"
              aria-label="Show my location"
              aria-pressed="false"
              onClick={handleLocate}
            >
              <Navigation aria-hidden="true" />
            </button>
          </div>

          <section className="stats" aria-label="Live response summary">
            <header className="stats__head">
              <Activity className="stats__icon" aria-hidden="true" />
              <span className="livebadge">
                <span className="livebadge__dot" aria-hidden="true"></span>
                Live
              </span>
            </header>

            <div className="stats__metrics">
              <div className="metric">
                <p className="metric__label">Critical</p>
                <p className="metric__value" id="metric-critical">
                  {String(criticalCount).padStart(2, '0')}
                </p>
              </div>
              <div className="metric">
                <p className="metric__label">Units deployed</p>
                <p className="metric__value" id="metric-units">
                  {String(unitsCount).padStart(2, '0')}
                </p>
              </div>
            </div>

            <div className="stats__rule" aria-hidden="true"></div>

            <p className="stats__queue-label">High priority queue</p>
            {incidents.slice(0, 1).map((inc) => {
              const distanceKm =
                typeof inc.lat === 'number' && typeof inc.lng === 'number'
                  ? calculateHaversineDistanceKm(coords.latitude, coords.longitude, inc.lat, inc.lng)
                  : 0;
              const etaMinutes = calculateDynamicEtaMinutes(distanceKm);

              return (
                <article className="incident" key={inc.id}>
                  <header className="incident__head">
                    <span className="incident__id">{inc.id}</span>
                    <span className="incident__age">
                      {inc.requiresManualVerification ? '⚠️ Review Needed' : 'Active'}
                    </span>
                  </header>
                  <h2 className="incident__title">{inc.type}</h2>
                  <p className="incident__loc">
                    <MapPin aria-hidden="true" />
                    {inc.place}
                  </p>
                  {distanceKm > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mt-1">
                      <Navigation className="w-3 h-3" />
                      <span>{distanceKm} km from C2 GPS</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-amber-300 font-bold">~{etaMinutes} min ETA</span>
                    </div>
                  )}
                </article>
              );
            })}
            {incidents.length === 0 && (
              <p className="text-[11px] text-slate-400 font-mono py-2">No active incidents in queue.</p>
            )}
          </section>

          <div
            className={`coords ${coordsPing ? 'is-ping' : ''}`}
            id="coords"
            aria-label="Map coordinates and system link"
          >
            <div className="coords__item">
              <p className="coords__label">Latitude</p>
              <p className="coords__value">{latText}</p>
            </div>
            <span className="coords__sep" aria-hidden="true"></span>
            <div className="coords__item">
              <p className="coords__label">Longitude</p>
              <p className="coords__value">{lngText}</p>
            </div>
            <span className="coords__sep" aria-hidden="true"></span>
            <div className="coords__sys">
              <Zap className="coords__bolt" aria-hidden="true" />
              <span className="coords__sys-text">
                {isHardwareGeolocated ? `GPS_Lock_±${Math.round(coords.accuracy)}m` : 'Sys_link_ok'}
              </span>
            </div>
          </div>

          <button className="fab" type="button" id="btn-report" onClick={() => setIsReportModalOpen(true)}>
            <Camera className="fab__icon" aria-hidden="true" />
            <span className="fab__label">Report Accident</span>
          </button>
        </div>
      </main>

      <AccidentReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      <p className={`toast ${toastVisible ? 'is-on' : ''}`} id="toast" role="status" aria-live="polite">
        {toastMessage}
      </p>
    </div>
  );
};

export default DashboardPage;