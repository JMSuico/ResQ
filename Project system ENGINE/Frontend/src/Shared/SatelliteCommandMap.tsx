// [Layer: Shared]
// Responsibility: Interactive Leaflet satellite command map matching dashboard.js / dashboard.html.
// Features: Real-time incident pins, live GPS accuracy radius circles, Laplacian blur warning beacons,
// and deterministic agency dispatch tags.
// Universal lambda expressions (=>).

import React, { FC, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface IncidentPinData {
  id: string;
  type: string;
  status: 'critical' | 'active' | 'resolved' | string;
  statusLabel: string;
  place: string;
  lat: number;
  lng: number;
  isBlurry?: boolean;
  requiresManualVerification?: boolean;
  recommendedAgency?: string;
  gpsAccuracyMeters?: number;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  severity?: 'critical' | 'moderate' | 'low' | string;
  type?: 'gps' | 'fixture' | 'incident' | string;
  category?: string;
  agency?: string;
  description?: string;
  status?: string;
  requiresManualVerification?: boolean;
  gpsAccuracyMeters?: number;
}

export interface SatelliteCommandMapProps {
  incidents?: IncidentPinData[];
  markers?: MapMarker[];
  centerLat?: number;
  centerLng?: number;
  onMapReady?: (map: L.Map) => void;
  className?: string;
}

const AREA_BOUNDS: [[number, number], [number, number]] = [[8.32, 123.15], [8.60, 123.40]];
const HOME_CENTER: [number, number] = [8.5147, 123.2842];
const HOME_ZOOM = 12;
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;
const BOUNDS_PADDING: [number, number] = [18, 18];
const MIN_ACCURACY_RADIUS_METERS = 15;
const PAN_DURATION_SECONDS = 0.8;

// Lucide Icon SVG definitions for Leaflet divIcon markup
const LUCIDE_PIN_SVG = `<svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
const LUCIDE_WARN_SVG = `<svg class="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

export const SatelliteCommandMap: FC<SatelliteCommandMapProps> = ({
  incidents = [],
  markers = [],
  centerLat,
  centerLng,
  onMapReady,
  className = "mapview__map"
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const accuracyCirclesLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const homeBounds = L.latLngBounds(AREA_BOUNDS[0], AREA_BOUNDS[1]);
    const initialCenter: [number, number] =
      typeof centerLat === 'number' && typeof centerLng === 'number'
        ? [centerLat, centerLng]
        : HOME_CENTER;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBoundsViscosity: 1.0,
      attributionControl: true
    }).setView(initialCenter, HOME_ZOOM);

    map.attributionControl.setPosition("bottomleft");
    map.setMaxBounds(homeBounds.pad(0.05));

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: MAX_ZOOM,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
      }
    ).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: MAX_ZOOM,
        attribution: "Labels &copy; Esri"
      }
    ).addTo(map);

    const circlesLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);
    accuracyCirclesLayerRef.current = circlesLayer;
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    map.fitBounds(homeBounds, { padding: BOUNDS_PADDING });

    if (onMapReady) {
      onMapReady(map);
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Smoothly pan when center coordinates change dynamically
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (typeof centerLat === 'number' && typeof centerLng === 'number') {
      mapInstanceRef.current.panTo([centerLat, centerLng], { animate: true, duration: PAN_DURATION_SECONDS });
    }
  }, [centerLat, centerLng]);

  // Sync incident pins & GPS accuracy radii
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const circlesLayer = accuracyCirclesLayerRef.current;
    if (!markersLayer || !circlesLayer) return;

    markersLayer.clearLayers();
    circlesLayer.clearLayers();

    const createPinIcon = (status: string, requiresVerification: boolean) => {
      const isWarn = requiresVerification;
      const statusClass = status === 'resolved' ? 'incident-pin--resolved' : 'incident-pin--critical';
      const warnClass = isWarn ? ' incident-pin--warning' : '';

      return L.divIcon({
        className: `incident-pin ${statusClass}${warnClass}`,
        html: `
          <span class="incident-pin__dot flex items-center justify-center">
            ${isWarn ? LUCIDE_WARN_SVG : LUCIDE_PIN_SVG}
          </span>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28]
      });
    };

    incidents.forEach((inc) => {
      if (typeof inc.lat !== "number" || typeof inc.lng !== "number") return;
      const isWarn = !!inc.requiresManualVerification || !!inc.isBlurry;
      const marker = L.marker([inc.lat, inc.lng], {
        icon: createPinIcon(inc.status || 'critical', isWarn),
        title: `${inc.type} — ${inc.id}`
      });

      // Render GPS hardware accuracy radius circle if available
      if (inc.gpsAccuracyMeters && inc.gpsAccuracyMeters > 0) {
        const accuracyCircle = L.circle([inc.lat, inc.lng], {
          radius: Math.max(inc.gpsAccuracyMeters, MIN_ACCURACY_RADIUS_METERS),
          color: isWarn ? '#f59e0b' : '#e8114c',
          weight: 1.5,
          fillColor: isWarn ? '#f59e0b' : '#e8114c',
          fillOpacity: 0.12
        });
        circlesLayer.addLayer(accuracyCircle);
      }

      const warningHtml = isWarn
        ? '<div class="incpop__warning" style="display:flex;align-items:center;gap:4px;">' +
          LUCIDE_WARN_SVG +
          '<span>REVIEW NEEDED (Blurry Photo)</span></div>'
        : '';

      const agencyHtml = inc.recommendedAgency
        ? `<div class="incpop__agency">Recommended Dispatch: <strong>${inc.recommendedAgency}</strong></div>`
        : '';

      const gpsHtml = inc.gpsAccuracyMeters
        ? `<div class="incpop__gps">GPS Accuracy: ±${Math.round(inc.gpsAccuracyMeters)}m</div>`
        : '';

      marker.bindPopup(
        '<div class="incpop">' +
          '<p class="incpop__id">' + inc.id + '</p>' +
          '<p class="incpop__title">' + inc.type + '</p>' +
          '<p class="incpop__meta">' + (inc.statusLabel || inc.status) + ' &middot; ' + inc.place + '</p>' +
          warningHtml +
          agencyHtml +
          gpsHtml +
          '<a class="incpop__link" href="#incidents">View captured evidence</a>' +
          '</div>'
      );

      markersLayer.addLayer(marker);
    });

    markers.forEach((m) => {
      if (typeof m.lat !== "number" || typeof m.lng !== "number") return;
      const isWarn = !!m.requiresManualVerification;
      const marker = L.marker([m.lat, m.lng], {
        icon: createPinIcon(m.severity === 'critical' ? 'critical' : 'active', isWarn),
        title: m.title
      });

      marker.bindPopup(
        '<div class="incpop">' +
          '<p class="incpop__id">' + m.id + '</p>' +
          '<p class="incpop__title">' + m.title + '</p>' +
          (m.category ? '<p class="incpop__meta">' + m.category + (m.agency ? ' &middot; ' + m.agency : '') + '</p>' : '') +
        '</div>'
      );

      markersLayer.addLayer(marker);
    });
  }, [incidents, markers]);

  return (
    <div
      ref={mapContainerRef}
      id="map"
      role="application"
      aria-label="Satellite map of Katipunan, Zamboanga del Norte"
      className={className}
    />
  );
};

export default SatelliteCommandMap;
