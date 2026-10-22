// [Layer: RespondersPanel]
// Responsibility: 100% pixel-faithful React 19 conversion of RISKQTRAK responder.html & responder.js.
// Preserves exact classes (.mapview, .mapview__canvas, .mapctl, .myreports, .coords, .fab, .toast, .myrep, etc.).
// Universal Lambdas (=>) and zero visual drift.

import React, { useState, useEffect } from 'react';
import L from 'leaflet';
import SatelliteCommandMap, { IncidentPinData } from '@/Shared/SatelliteCommandMap';
import AccidentReportModal from '@/Shared/AccidentReportModal';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { requestJson } from '@/Endpoints/apiClient';
import { ReportItem } from '@/Endpoints/reportsApi';
import { useSession } from '@/Hooks/useSession';

export const ResponderDashboardPage: React.FC = () => {
  const { session } = useSession();

  const [incidents] = useState<IncidentPinData[]>([
    {
      id: 'INC-8992-A',
      type: 'Vehicular Collision',
      status: 'critical',
      statusLabel: 'Critical Priority',
      place: 'Bgy. Uno, Katipunan Hwy',
      lat: 8.5134,
      lng: 123.2847
    },
    {
      id: 'INC-8993-B',
      type: 'Medical Emergency',
      status: 'active',
      statusLabel: 'Active Response',
      place: 'Bgy. Malasay, Municipal Rd',
      lat: 8.5201,
      lng: 123.2910
    }
  ]);

  const [myReports, setMyReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [lightboxData, setLightboxData] = useState<{ url: string; title: string } | null>(null);

  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [latText, setLatText] = useState<string>('8.5134° N');
  const [lngText, setLngText] = useState<string>('123.2847° E');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2800);
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return (
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0') +
      ' ' +
      String(date.getHours()).padStart(2, '0') +
      ':' +
      String(date.getMinutes()).padStart(2, '0')
    );
  };

  const loadMyReports = async () => {
    setLoadingReports(true);
    try {
      const data = await requestJson<ReportItem[]>('/api/reports', { method: 'GET' });
      const allReports = Array.isArray(data) ? data : [];
      // Filter for reports matching current user or fallback to recent reports
      const filtered = session?.employeeId
        ? allReports.filter((r) => r.reporterId === session.employeeId)
        : allReports;
      setMyReports(filtered);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Could not load reports:', msg);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    loadMyReports();

    const handleCustomReport = () => {
      loadMyReports();
      showToast('New accident report received and added to feed.');
    };

    window.addEventListener('resqtrack:report', handleCustomReport);
    return () => {
      window.removeEventListener('resqtrack:report', handleCustomReport);
    };
  }, [session]);

  const handleZoomIn = () => {
    if (mapInstance) mapInstance.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstance) mapInstance.zoomOut();
  };

  const handleRecenter = () => {
    if (mapInstance) {
      mapInstance.setView([8.5147, 123.2842], 12);
      setLatText('8.5147° N');
      setLngText('123.2842° E');
      showToast('Map recentered on Katipunan operational center.');
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.');
      return;
    }
    showToast('Locating your responder unit coordinates\u2026');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLatText(`${latitude.toFixed(4)}° N`);
        setLngText(`${longitude.toFixed(4)}° E`);
        if (mapInstance) {
          mapInstance.setView([latitude, longitude], 15);
        }
        showToast('GPS position locked.');
      },
      () => {
        showToast('GPS lock failed. Using municipal center default.');
      }
    );
  };

  return (
    <main className="mapview" aria-label="Responder field map">
      <div className="mapview__canvas" id="map-canvas">
        <SatelliteCommandMap
          incidents={incidents}
          onMapReady={(map) => setMapInstance(map)}
          className="mapview__map"
        />

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
          <button className="mapctl__locate" type="button" id="map-locate" aria-label="Show my location" onClick={handleLocate}>
            <svg aria-hidden="true"><use href="#i-locate"/></svg>
          </button>
        </div>

        {/* Section: My Submitted Reports */}
        <section className="myreports" aria-label="My submitted reports">
          <header className="myreports__head">
            <svg className="myreports__icon" aria-hidden="true"><use href="#i-cam"/></svg>
            <h2 className="myreports__title">My Reports</h2>
            <span className="myreports__count" id="myreports-count">{myReports.length} sent</span>
            <button
              className="myreports__refresh"
              type="button"
              id="myreports-refresh"
              aria-label="Refresh my reports"
              onClick={loadMyReports}
            >
              <svg aria-hidden="true"><use href="#i-refresh"/></svg>
              <span>Refresh</span>
            </button>
          </header>

          {loadingReports ? (
            <p className="myreports__state" id="myreports-loading" role="status">Loading your reports…</p>
          ) : myReports.length === 0 ? (
            <p className="myreports__state" id="myreports-empty" role="status">
              No reports sent yet. Use Report Accident to capture and send one.
            </p>
          ) : (
            <ul className="myreports__list" id="myreports-list">
              {myReports.map((rep) => (
                <li
                  className="myrep"
                  key={rep.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Preview my report ${rep.id}`}
                  onClick={() => setLightboxData({ url: rep.imageUrl || '', title: `${rep.title || rep.category} — ${rep.id} · ${rep.note || ''}` })}
                >
                  <img className="myrep__thumb" src={rep.imageUrl || ''} alt={`${rep.title || rep.category} photo ${rep.id}`} />
                  <div className="myrep__body">
                    <p className="myrep__title">{rep.title || rep.category || 'Road Accident'}</p>
                    <p className="myrep__meta">{rep.id} · {formatTime(rep.createdAt)}</p>
                    {rep.note && <p className="myrep__note">{rep.note}</p>}
                  </div>
                  <button
                    className="myrep__view"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxData({ url: rep.imageUrl || '', title: `${rep.title || rep.category} — ${rep.id}` });
                    }}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tactical Coordinates Bar */}
        <div className="coords" id="coords" aria-label="Map coordinates and system link">
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
            <span className="coords__sys-text">Sys_link_ok</span>
          </div>
        </div>

        {/* Floating Emergency FAB */}
        <button
          className="fab"
          type="button"
          id="btn-report"
          onClick={() => setIsReportModalOpen(true)}
        >
          <svg className="fab__icon" aria-hidden="true"><use href="#i-cam"/></svg>
          <span className="fab__label">Report Accident</span>
        </button>
      </div>

      <AccidentReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      {lightboxData && (
        <ImageLightboxModal
          isOpen={true}
          imageUrl={lightboxData.url}
          title={lightboxData.title}
          onClose={() => setLightboxData(null)}
        />
      )}

      <p className={`toast ${toastVisible ? 'is-on' : ''}`} id="toast" role="status" aria-live="polite">
        {toastMessage}
      </p>
    </main>
  );
};

export default ResponderDashboardPage;
