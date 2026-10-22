// [Layer: AdminsPanel]
// Responsibility: Exact React 19 conversion of DashboardPage matching dashboard.html / dashboard.css / dashboard.js.
// 100% CSS class & DOM hierarchy integrity, Universal Lambdas (=>), and continuous real GPS telemetry.

import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import SatelliteCommandMap, { IncidentPinData } from '@/Shared/SatelliteCommandMap';
import AccidentReportModal from '@/Shared/AccidentReportModal';
import { getAllReports } from '@/Endpoints/reportsApi';
import { useGpsLocation } from '@/Hooks/useGpsLocation';

export const DashboardPage: React.FC = () => {
  const { coords, isHardwareGeolocated, signalQuality, refreshGps } = useGpsLocation();

  const [incidents, setIncidents] = useState<IncidentPinData[]>([
    {
      id: 'INC-8992-A',
      type: 'Vehicular Collision',
      status: 'critical',
      statusLabel: 'Critical Priority',
      place: 'Bgy. Uno, Katipunan Hwy',
      lat: 8.5134,
      lng: 123.2847,
      gpsAccuracyMeters: 4.5,
      recommendedAgency: 'RHU + PNP'
    },
    {
      id: 'INC-8993-B',
      type: 'Medical Emergency',
      status: 'active',
      statusLabel: 'Active Response',
      place: 'Bgy. Malasay, Municipal Rd',
      lat: 8.5201,
      lng: 123.2910,
      gpsAccuracyMeters: 8.0,
      recommendedAgency: 'RHU'
    }
  ]);

  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [unitsCount, setUnitsCount] = useState<number>(4);
  const [criticalCount, setCriticalCount] = useState<number>(1);
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

  // Load database incident pins on mount
  useEffect(() => {
    const fetchLiveReports = async () => {
      try {
        const reports = await getAllReports();
        if (reports && reports.length > 0) {
          const mapped: IncidentPinData[] = reports.map((r: any) => ({
            id: r.referenceCode || r.id,
            type: r.title || r.category || 'Road Accident',
            status: r.status === 'Resolved' ? 'resolved' : 'critical',
            statusLabel: r.requiresManualVerification ? 'Manual Review' : (r.severity || 'Critical'),
            place: r.locationLabel || 'Katipunan, ZN',
            lat: r.latitude,
            lng: r.longitude,
            isBlurry: r.isBlurry,
            requiresManualVerification: r.requiresManualVerification,
            recommendedAgency: r.recommendedAgencyUnit,
            gpsAccuracyMeters: r.gpsAccuracyMeters
          }));
          setIncidents(mapped);
          setCriticalCount(mapped.filter((i) => i.status === 'critical').length);
        }
      } catch {
        // Fallback to initial tactical pins if backend is still starting
      }
    };

    fetchLiveReports();
  }, []);

  // Listen to new live reports dispatched across the system
  useEffect(() => {
    const handleCustomReport = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const rep = customEvent.detail;
        const newInc: IncidentPinData = {
          id: rep.referenceCode || rep.id || 'INC-' + Math.floor(1000 + Math.random() * 9000),
          type: rep.title || rep.category || 'Road Accident',
          status: 'critical',
          statusLabel: rep.requiresManualVerification ? 'Manual Review' : 'Critical Priority',
          place: rep.locationLabel || 'Katipunan, Zamboanga del Norte',
          lat: rep.latitude || coords.latitude,
          lng: rep.longitude || coords.longitude,
          isBlurry: rep.isBlurry,
          requiresManualVerification: rep.requiresManualVerification,
          recommendedAgency: rep.recommendedAgencyUnit || rep.recommendedAgency,
          gpsAccuracyMeters: rep.gpsAccuracyMeters || coords.accuracy
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
      showToast(isHardwareGeolocated
        ? `Hardware GPS Lock: ±${Math.round(coords.accuracy)}m (${signalQuality.toUpperCase()})`
        : 'Acquiring continuous satellite GPS feed...');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    showToast(q ? `Searching tactical index for “${q}”…` : 'Enter coordinates, incident ID, or responder.');
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
              <button className="mapctl__btn" type="button" id="map-in" aria-label="Zoom in" onClick={handleZoomIn}>
                <svg aria-hidden="true"><use href="#i-plus"/></svg>
              </button>
              <button className="mapctl__btn" type="button" id="map-out" aria-label="Zoom out" onClick={handleZoomOut}>
                <svg aria-hidden="true"><use href="#i-minus"/></svg>
              </button>
            </div>
            <button className="mapctl__recenter" type="button" id="map-recenter" aria-label="Recenter on Katipunan" onClick={handleRecenter}>
              <svg aria-hidden="true"><use href="#i-crosshair"/></svg>
            </button>
            <button className="mapctl__locate" type="button" id="map-locate" aria-label="Show my location" aria-pressed="false" onClick={handleLocate}>
              <svg aria-hidden="true"><use href="#i-locate"/></svg>
            </button>
          </div>

          <section className="stats" aria-label="Live response summary">
            <header className="stats__head">
              <svg className="stats__icon" aria-hidden="true"><use href="#i-chart"/></svg>
              <span className="livebadge"><span className="livebadge__dot" aria-hidden="true"></span>Live</span>
            </header>

            <div className="stats__metrics">
              <div className="metric">
                <p className="metric__label">Critical</p>
                <p className="metric__value" id="metric-critical">{String(criticalCount).padStart(2, '0')}</p>
              </div>
              <div className="metric">
                <p className="metric__label">Units deployed</p>
                <p className="metric__value" id="metric-units">{String(unitsCount).padStart(2, '0')}</p>
              </div>
            </div>

            <div className="stats__rule" aria-hidden="true"></div>

            <p className="stats__queue-label">High priority queue</p>
            {incidents.slice(0, 1).map((inc) => (
              <article className="incident" key={inc.id}>
                <header className="incident__head">
                  <span className="incident__id">{inc.id}</span>
                  <span className="incident__age">
                    {inc.requiresManualVerification ? '⚠️ Review Needed' : 'Active'}
                  </span>
                </header>
                <h2 className="incident__title">{inc.type}</h2>
                <p className="incident__loc">
                  <svg aria-hidden="true"><use href="#i-pin"/></svg>
                  {inc.place}
                </p>
              </article>
            ))}
          </section>

          <div className={`coords ${coordsPing ? 'is-ping' : ''}`} id="coords" aria-label="Map coordinates and system link">
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
              <svg className="coords__bolt" aria-hidden="true"><use href="#i-bolt"/></svg>
              <span className="coords__sys-text">
                {isHardwareGeolocated ? `GPS_Lock_±${Math.round(coords.accuracy)}m` : 'Sys_link_ok'}
              </span>
            </div>
          </div>

          <button className="fab" type="button" id="btn-report" onClick={() => setIsReportModalOpen(true)}>
            <svg className="fab__icon" aria-hidden="true"><use href="#i-cam"/></svg>
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
