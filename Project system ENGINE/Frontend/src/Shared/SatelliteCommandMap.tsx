// [Layer: Shared]
// Responsibility: Interactive Leaflet satellite command map with 16 Tactical Incident Pointer Categories,
// RHU Medic vs Non-Medic role filtering, Pale Non-Medic Pointer mode, Dynamic Centered Pointer Modal,
// IP Address + GPS + Street Address + Picture Evidence display, 5-Minute Verification Loading Timer,
// dynamic proximity circles and lines to closest on-duty units, and prominent pulsing red/amber markers for new incidents.
// Universal lambda expressions (=>). 100% pure Lucide icons (zero emojis).

import React, { FC, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Filter,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  MapPin,
  Cpu,
  Navigation,
  Clock,
  CheckCircle2,
  Send,
  X,
  Camera,
  Lock,
  Layers
} from 'lucide-react';
import {
  RADAR_POINTER_CATEGORIES,
  RadarPointerCategoryMeta,
  resolvePointerCategory,
  getMedicPointerSettings,
  saveMedicPointerSettings,
  getRemainingCloseSeconds,
  formatCountdownMmSs,
  formatDateTimeWithSecondsAmPm,
  RESPONDED_GREEN_COLOR,
  DEFAULT_VERIFICATION_CLOSE_SECONDS
} from './radarPointerCategories';
import { ImageLightboxModal, LightboxMediaItem } from './ImageLightboxModal';
import {
  calculateHaversineDistanceKm,
  calculateDynamicEtaMinutes
} from '@/Libs/Map/mapAccuracy';

export interface IncidentPinData {
  id: string;
  type: string;
  status: 'critical' | 'active' | 'resolved' | 'Responded' | 'Verified' | string;
  statusLabel?: string;
  place: string;
  lat: number;
  lng: number;
  category?: string;
  pointerCategory?: string;
  severity?: string;
  ipAddress?: string;
  evidenceUrl?: string;
  evidenceImages?: Array<LightboxMediaItem | string>;
  verifiedAt?: string | number | null;
  reportedAt?: string;
  isBlurry?: boolean;
  requiresManualVerification?: boolean;
  recommendedAgency?: string;
  gpsAccuracyMeters?: number;
  description?: string;
  allocatedUnitId?: string | null;
  allocatedUnitCode?: string | null;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  severity?: 'critical' | 'moderate' | 'low' | string;
  type?: 'gps' | 'fixture' | 'incident' | string;
  category?: string;
  pointerCategory?: string;
  agency?: string;
  description?: string;
  status?: string;
  ipAddress?: string;
  evidenceUrl?: string;
  verifiedAt?: string | number | null;
  requiresManualVerification?: boolean;
  gpsAccuracyMeters?: number;
  allocatedUnitId?: string | null;
  allocatedUnitCode?: string | null;
}

export interface ResponderMapUnit {
  id: string;
  unitCode?: string;
  name?: string;
  lat: number;
  lng: number;
  status?: string;
  agency?: string;
}

export interface SatelliteCommandMapProps {
  incidents?: IncidentPinData[];
  markers?: MapMarker[];
  responders?: ResponderMapUnit[];
  selectedIncidentId?: string | null;
  onSelectIncident?: (incident: IncidentPinData) => void;
  onRequestDeploy?: (incident: IncidentPinData) => void;
  onExpandMap?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  centerLat?: number;
  centerLng?: number;
  height?: string | number;
  roleFilter?: string;
  showMedicHud?: boolean;
  onMapReady?: (map: L.Map) => void;
  className?: string;
}

const AREA_BOUNDS: [[number, number], [number, number]] = [
  [8.32, 123.15],
  [8.60, 123.40]
];
const HOME_CENTER: [number, number] = [8.5147, 123.2842];
const HOME_ZOOM = 12;
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;
const BOUNDS_PADDING: [number, number] = [18, 18];
const MIN_ACCURACY_RADIUS_METERS = 15;
const PAN_DURATION_SECONDS = 0.8;

const DEFAULT_EVIDENCE_PHOTO =
  'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=900&q=80';

const generateDeterministicIp = (seedId: string): string => {
  let hash = 0;
  for (let i = 0; i < seedId.length; i += 1) {
    hash = (hash * 37 + seedId.charCodeAt(i)) & 0xffff;
  }
  const octet3 = (hash % 240) + 10;
  const octet4 = ((hash >> 4) % 230) + 12;
  return `192.168.${octet3}.${octet4}`;
};

export const SatelliteCommandMap: FC<SatelliteCommandMapProps> = ({
  incidents = [],
  markers = [],
  responders = [],
  selectedIncidentId,
  onSelectIncident,
  onRequestDeploy,
  onExpandMap,
  isExpanded,
  onToggleExpand,
  centerLat,
  centerLng,
  height,
  showMedicHud = true,
  onMapReady,
  className = 'mapview__map'
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const accuracyCirclesLayerRef = useRef<L.LayerGroup | null>(null);
  const dispatchRoutesLayerRef = useRef<L.LayerGroup | null>(null);
  const respondersLayerRef = useRef<L.LayerGroup | null>(null);

  const [sortMode, setSortMode] = useState<'ALL' | 'FOR_MEDICS'>('ALL');
  const [pointerSettings, setPointerSettings] = useState(() => getMedicPointerSettings());
  const [showLegendDrawer, setShowLegendDrawer] = useState<boolean>(false);
  const [isExpandedFullscreen, setIsExpandedFullscreen] = useState<boolean>(false);
  const [activePointer, setActivePointer] = useState<IncidentPinData | null>(null);
  const [respondedIds, setRespondedIds] = useState<Record<string, boolean>>({});
  const [verifiedTimestamps, setVerifiedTimestamps] = useState<Record<string, number>>({});
  const [tickNow, setTickNow] = useState<number>(() => Date.now());
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [calloutPoint, setCalloutPoint] = useState<{ x: number; y: number } | null>(null);

  const effectiveExpanded = isExpanded !== undefined ? isExpanded : isExpandedFullscreen;

  // Real-time calculation of callout pixel position anchored to active pointer
  const updateCalloutPosition = useCallback(() => {
    if (!mapInstanceRef.current || !activePointer) {
      setCalloutPoint(null);
      return;
    }
    try {
      const pt = mapInstanceRef.current.latLngToContainerPoint([activePointer.lat, activePointer.lng]);
      setCalloutPoint({ x: pt.x, y: pt.y });
    } catch {
      setCalloutPoint(null);
    }
  }, [activePointer]);

  useEffect(() => {
    updateCalloutPosition();
    const map = mapInstanceRef.current;
    if (!map) return;
    map.on('move', updateCalloutPosition);
    map.on('moveend', updateCalloutPosition);
    map.on('zoom', updateCalloutPosition);
    map.on('zoomend', updateCalloutPosition);
    return () => {
      map.off('move', updateCalloutPosition);
      map.off('moveend', updateCalloutPosition);
      map.off('zoom', updateCalloutPosition);
      map.off('zoomend', updateCalloutPosition);
    };
  }, [updateCalloutPosition]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
      updateCalloutPosition();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [effectiveExpanded, updateCalloutPosition]);

  // Sync medic pointer settings from localStorage / custom event
  useEffect(() => {
    const handleSettingsSync = () => {
      setPointerSettings(getMedicPointerSettings());
    };
    window.addEventListener('resqtrack:medic-pointer-settings', handleSettingsSync);
    window.addEventListener('storage', handleSettingsSync);
    return () => {
      window.removeEventListener('resqtrack:medic-pointer-settings', handleSettingsSync);
      window.removeEventListener('storage', handleSettingsSync);
    };
  }, []);

  // 1-second ticker for active 5-minute verification countdowns
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTickNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Normalizes all responder units from both `responders` prop and `markers` where type === 'gps'
  const allResponderUnits = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      agency?: string;
      status?: string;
    }> = [];

    if (responders && responders.length > 0) {
      responders.forEach((r) => {
        if (typeof r.lat === 'number' && typeof r.lng === 'number') {
          list.push({
            id: r.id,
            name: r.unitCode || r.name || `Unit ${r.id}`,
            lat: r.lat,
            lng: r.lng,
            agency: r.agency,
            status: r.status
          });
        }
      });
    }

    markers.forEach((m) => {
      if (m.type === 'gps' && typeof m.lat === 'number' && typeof m.lng === 'number') {
        const alreadyExists = list.some(
          (u) => u.id === m.id || u.id === m.id.replace('unit-', '') || `unit-${u.id}` === m.id
        );
        if (!alreadyExists) {
          list.push({
            id: m.id,
            name: m.title || `Unit ${m.id}`,
            lat: m.lat,
            lng: m.lng,
            agency: m.agency,
            status: m.status
          });
        }
      }
    });

    return list;
  }, [responders, markers]);

  // Merge `incidents` and `markers` into a unified enriched list with 16-category resolution
  // Excludes responder units (type === 'gps') which are rendered separately
  const unifiedIncidents: Array<IncidentPinData & { categoryMeta: RadarPointerCategoryMeta }> =
    useMemo(() => {
      const combined: IncidentPinData[] = [...incidents];

      markers.forEach((m) => {
        if (m.type === 'gps') return;
        if (!combined.some((inc) => inc.id === m.id)) {
          combined.push({
            id: m.id,
            type: m.title,
            status: m.status || (m.severity === 'critical' ? 'critical' : 'active'),
            statusLabel: m.status || m.severity || 'Active',
            place: m.description || m.category || 'Katipunan Tactical Sector',
            lat: m.lat,
            lng: m.lng,
            category: m.category,
            pointerCategory: m.pointerCategory,
            severity: m.severity,
            ipAddress: m.ipAddress,
            evidenceUrl: m.evidenceUrl,
            verifiedAt: m.verifiedAt,
            requiresManualVerification: m.requiresManualVerification,
            recommendedAgency: m.agency,
            gpsAccuracyMeters: m.gpsAccuracyMeters,
            description: m.description,
            allocatedUnitId: m.allocatedUnitId,
            allocatedUnitCode: m.allocatedUnitCode
          });
        }
      });

      return combined.map((inc, index) => {
        // Assign deterministic category across the 16 categories if generic
        const explicitMatch =
          inc.pointerCategory || inc.category || inc.type
            ? resolvePointerCategory({
                pointerCategory: inc.pointerCategory,
                category: inc.category,
                type: inc.type,
                title: inc.place,
                severity: inc.severity,
                id: inc.id
              })
            : RADAR_POINTER_CATEGORIES[index % RADAR_POINTER_CATEGORIES.length];

        return {
          ...inc,
          ipAddress: inc.ipAddress || generateDeterministicIp(inc.id || String(index)),
          evidenceUrl: inc.evidenceUrl || DEFAULT_EVIDENCE_PHOTO,
          reportedAt: inc.reportedAt || formatDateTimeWithSecondsAmPm(new Date(Date.now() - index * 95000)),
          categoryMeta: explicitMatch
        };
      });
    }, [incidents, markers]);

  // Filter pointers based on SORT mode & Medic Pointer Settings
  const visibleIncidents = useMemo(() => {
    return unifiedIncidents.filter((inc) => {
      const verifiedStart =
        verifiedTimestamps[inc.id] ||
        (inc.verifiedAt ? new Date(inc.verifiedAt).getTime() : null);

      // Hide pointer once 5-minute countdown completes ONLY IF marked responded or resolved
      const isResolvedOrResponded =
        Boolean(respondedIds[inc.id]) ||
        inc.status?.toLowerCase() === 'responded' ||
        inc.status?.toLowerCase() === 'resolved' ||
        inc.status?.toLowerCase() === 'closed';

      if (isResolvedOrResponded && verifiedStart) {
        const remaining = getRemainingCloseSeconds(verifiedStart);
        if (remaining <= 0) {
          return false;
        }
      }

      if (sortMode === 'FOR_MEDICS') {
        return inc.categoryMeta.isMedicAllowed;
      }

      if (pointerSettings.hideNonMedicOnSort && !inc.categoryMeta.isMedicAllowed) {
        return false;
      }

      return true;
    });
  }, [unifiedIncidents, sortMode, pointerSettings.hideNonMedicOnSort, verifiedTimestamps, tickNow]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

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

    map.attributionControl.setPosition('bottomleft');
    map.setMaxBounds(homeBounds.pad(0.05));

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: MAX_ZOOM,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
      }
    ).addTo(map);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: MAX_ZOOM,
        attribution: 'Labels &copy; Esri'
      }
    ).addTo(map);

    const accuracyCirclesLayer = L.layerGroup().addTo(map);
    const dispatchRoutesLayer = L.layerGroup().addTo(map);
    const respondersLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    accuracyCirclesLayerRef.current = accuracyCirclesLayer;
    dispatchRoutesLayerRef.current = dispatchRoutesLayer;
    respondersLayerRef.current = respondersLayer;
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    map.fitBounds(homeBounds, { padding: BOUNDS_PADDING, animate: false });

    if (onMapReady) {
      onMapReady(map);
    }

    return () => {
      try {
        map.stop();
        map.remove();
      } catch {
        // Safe disposal
      }
      mapInstanceRef.current = null;
    };
  }, []);

  // Smoothly pan when center coordinates change dynamically
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (typeof centerLat === 'number' && typeof centerLng === 'number') {
      mapInstanceRef.current.panTo([centerLat, centerLng], {
        animate: true,
        duration: PAN_DURATION_SECONDS
      });
    }
  }, [centerLat, centerLng]);

  // Sync external selectedIncidentId
  useEffect(() => {
    if (!selectedIncidentId) return;
    const found = unifiedIncidents.find((i) => i.id === selectedIncidentId);
    if (found) {
      setActivePointer(found);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([found.lat, found.lng], {
          animate: true,
          duration: PAN_DURATION_SECONDS
        });
      }
    }
  }, [selectedIncidentId, unifiedIncidents]);

  // Render 16-category pointers onto Leaflet layer with prominent pulsing red/amber markers for unallocated or critical incidents
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const circlesLayer = accuracyCirclesLayerRef.current;
    if (!markersLayer || !circlesLayer) return;

    markersLayer.clearLayers();
    circlesLayer.clearLayers();

    visibleIncidents.forEach((inc) => {
      if (typeof inc.lat !== 'number' || typeof inc.lng !== 'number') return;

      const meta = inc.categoryMeta;
      const isResponded =
        Boolean(respondedIds[inc.id]) ||
        inc.status?.toLowerCase() === 'responded' ||
        inc.status?.toLowerCase() === 'resolved';

      const isPaleNonMedic =
        pointerSettings.paleNonMedicEnabled && !meta.isMedicAllowed && !isResponded;

      const pointerBgColor = isResponded ? RESPONDED_GREEN_COLOR : meta.color;
      const paleStyle = isPaleNonMedic
        ? 'opacity: 0.38; filter: grayscale(82%);'
        : 'opacity: 1;';

      // Prominent pulsing red or amber markers for unallocated or critical reports
      const isCritical = (inc.severity || '').toLowerCase() === 'critical';
      const isUnallocated = !inc.allocatedUnitCode && !inc.allocatedUnitId && !isResponded;
      const isPulsing = (isUnallocated || isCritical) && !isResponded;
      const pulseColor = isCritical ? '#ef4444' : '#f59e0b';
      const glowAnimation = isCritical
        ? 'resqtrackBeaconGlow 1.6s ease-in-out infinite'
        : 'resqtrackAmberGlow 1.8s ease-in-out infinite';

      const pulsingRingHtml = isPulsing
        ? `
          <span style="position:absolute;inset:-6px;border-radius:9999px;border:2.5px solid ${pulseColor};animation:resqtrackPulseRing 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>
          <span style="position:absolute;inset:-2px;border-radius:9999px;background:${pulseColor};opacity:0.35;animation:resqtrackPulseRing 1.8s cubic-bezier(0,0,0.2,1) infinite;animation-delay:0.45s;"></span>
          <span style="position:absolute;top:-4px;right:-4px;width:11px;height:11px;border-radius:9999px;background:${pulseColor};border:2px solid #ffffff;box-shadow:0 0 6px ${pulseColor};z-index:2;"></span>
        `
        : '';

      const pinIcon = L.divIcon({
        className: 'resqtrack-tactical-pointer',
        html: `
          <div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;${paleStyle};transition:all 200ms ease;">
            ${pulsingRingHtml}
            <span style="position:absolute;inset:0;border-radius:9999px;background:${pointerBgColor};opacity:0.28;transform:scale(1.25);"></span>
            <div style="position:relative;width:32px;height:32px;border-radius:9999px;background:${pointerBgColor};border:2px solid #ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.65);${
              isPulsing ? `animation:${glowAnimation};` : ''
            }display:flex;align-items:center;justify-content:center;color:#ffffff;z-index:1;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                ${meta.svgPathMarkup}
              </svg>
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const marker = L.marker([inc.lat, inc.lng], {
        icon: pinIcon,
        title: `${meta.label} — ${inc.id}`
      });

      if (inc.gpsAccuracyMeters && inc.gpsAccuracyMeters > 0) {
        const accuracyCircle = L.circle([inc.lat, inc.lng], {
          radius: Math.max(inc.gpsAccuracyMeters, MIN_ACCURACY_RADIUS_METERS),
          color: pointerBgColor,
          weight: 1.5,
          fillColor: pointerBgColor,
          fillOpacity: isPaleNonMedic ? 0.04 : 0.14
        });
        circlesLayer.addLayer(accuracyCircle);
      }

      marker.on('click', () => {
        setActivePointer(inc);
        onSelectIncident?.(inc);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([inc.lat, inc.lng], {
            animate: true,
            duration: 0.55
          });
        }
      });

      markersLayer.addLayer(marker);
    });
  }, [visibleIncidents, pointerSettings.paleNonMedicEnabled, respondedIds, onSelectIncident]);

  // Render on-duty responder units on map with tactical agency badges
  useEffect(() => {
    const respondersLayer = respondersLayerRef.current;
    if (!respondersLayer) return;

    respondersLayer.clearLayers();

    allResponderUnits.forEach((unit) => {
      if (typeof unit.lat !== 'number' || typeof unit.lng !== 'number') return;

      const agencyUpper = (unit.agency || '').toUpperCase();
      let agencyColor = '#0284c7'; // default sky
      let badgeLetter = 'U';
      if (agencyUpper.includes('FIRE') || agencyUpper.includes('BFP')) {
        agencyColor = '#ea580c'; // fire orange
        badgeLetter = 'F';
      } else if (agencyUpper.includes('PNP') || agencyUpper.includes('POLICE')) {
        agencyColor = '#2563eb'; // police blue
        badgeLetter = 'P';
      } else if (agencyUpper.includes('RHU') || agencyUpper.includes('MEDIC')) {
        agencyColor = '#10b981'; // medical emerald
        badgeLetter = 'M';
      }

      const unitIcon = L.divIcon({
        className: 'resqtrack-responder-unit-icon',
        html: `
          <div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
            <div style="position:relative;width:24px;height:24px;border-radius:6px;background:${agencyColor};border:2px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;color:#ffffff;transform:rotate(45deg);">
              <div style="transform:rotate(-45deg);font-size:10px;font-weight:900;font-family:monospace;">
                ${badgeLetter}
              </div>
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([unit.lat, unit.lng], {
        icon: unitIcon,
        title: `${unit.name} (${unit.agency || 'Responder'}) - ${unit.status || 'Active'}`
      });

      marker.bindTooltip(
        `<div style="text-align:left;">` +
          `<strong style="color:${agencyColor};">${unit.name}</strong><br/>` +
          `Agency: ${unit.agency || 'Emergency Services'}<br/>` +
          `Status: <strong>${unit.status || 'OnDuty'}</strong>` +
        `</div>`,
        { direction: 'top', className: 'tactical-map-tooltip' }
      );

      respondersLayer.addLayer(marker);
    });
  }, [allResponderUnits]);

  // When a report is clicked, dynamically center map and draw proximity circles or lines to closest on-duty units
  useEffect(() => {
    const dispatchLayer = dispatchRoutesLayerRef.current;
    if (!dispatchLayer) return;

    dispatchLayer.clearLayers();

    const selectedInc =
      activePointer || unifiedIncidents.find((i) => i.id === selectedIncidentId);
    if (!selectedInc || typeof selectedInc.lat !== 'number' || typeof selectedInc.lng !== 'number') {
      return;
    }

    // Smoothly center the map on the selected incident
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([selectedInc.lat, selectedInc.lng], {
        animate: true,
        duration: 0.6
      });
    }

    // Filter available on-duty responder units
    const eligibleUnits = allResponderUnits.filter((u) => {
      const statusLower = (u.status || '').toLowerCase();
      return statusLower !== 'offduty' && typeof u.lat === 'number' && typeof u.lng === 'number';
    });

    if (eligibleUnits.length === 0) {
      // Standalone tactical perimeter
      const perimeter = L.circle([selectedInc.lat, selectedInc.lng], {
        radius: 300,
        color: '#f43f5e',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#f43f5e',
        fillOpacity: 0.08
      });
      dispatchLayer.addLayer(perimeter);
      return;
    }

    // Calculate dynamic Haversine distance and ETA
    const ranked = eligibleUnits
      .map((unit) => {
        const distanceKm = calculateHaversineDistanceKm(
          selectedInc.lat,
          selectedInc.lng,
          unit.lat,
          unit.lng
        );
        return {
          unit,
          distanceKm,
          etaMinutes: calculateDynamicEtaMinutes(distanceKm)
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const closestUnits = ranked.slice(0, 3);
    const nearestUnit = closestUnits[0];

    // Draw proximity radius circle encompassing closest responder range
    if (nearestUnit) {
      const radiusMeters = Math.max(300, Math.min(nearestUnit.distanceKm * 1000, 15000));
      const proximityCircle = L.circle([selectedInc.lat, selectedInc.lng], {
        radius: radiusMeters,
        color: '#f43f5e',
        weight: 1.5,
        dashArray: '6, 6',
        fillColor: '#f43f5e',
        fillOpacity: 0.04
      });
      dispatchLayer.addLayer(proximityCircle);
    }

    // Draw inner tactical cordon perimeter
    const innerCordon = L.circle([selectedInc.lat, selectedInc.lng], {
      radius: 200,
      color: '#38bdf8',
      weight: 2,
      fillColor: '#38bdf8',
      fillOpacity: 0.12
    });
    dispatchLayer.addLayer(innerCordon);

    // Draw proximity lines to closest on-duty units
    closestUnits.forEach((rUnit, idx) => {
      const isPrimary = idx === 0;
      const lineColor = isPrimary ? '#38bdf8' : '#94a3b8';
      const lineWeight = isPrimary ? 3 : 2;

      const polyline = L.polyline(
        [
          [selectedInc.lat, selectedInc.lng],
          [rUnit.unit.lat, rUnit.unit.lng]
        ],
        {
          color: lineColor,
          weight: lineWeight,
          dashArray: isPrimary ? '8, 8' : '5, 5',
          opacity: isPrimary ? 0.9 : 0.65
        }
      );

      polyline.bindTooltip(
        `<div style="text-align:left;">` +
          `<strong style="color:#38bdf8;">${rUnit.unit.name}</strong> (${rUnit.unit.agency || 'Unit'})<br/>` +
          `Distance: <strong>${rUnit.distanceKm} km</strong><br/>` +
          `Est. ETA: <strong style="color:#fbbf24;">~${rUnit.etaMinutes} min</strong>` +
        `</div>`,
        {
          permanent: false,
          direction: 'center',
          className: 'tactical-map-tooltip'
        }
      );

      dispatchLayer.addLayer(polyline);
    });
  }, [activePointer, selectedIncidentId, unifiedIncidents, allResponderUnits]);

  const handleTogglePaleNonMedic = () => {
    const updated = saveMedicPointerSettings({
      paleNonMedicEnabled: !pointerSettings.paleNonMedicEnabled
    });
    setPointerSettings(updated);
  };

  const handleExpandMap = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else if (onExpandMap) {
      onExpandMap();
    } else {
      setIsExpandedFullscreen((prev) => !prev);
      window.setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  };

  const handleMarkResponded = (incidentId: string) => {
    setRespondedIds((prev) => ({
      ...prev,
      [incidentId]: !prev[incidentId]
    }));
  };

  const handleTriggerVerificationTimer = (incidentId: string) => {
    setVerifiedTimestamps((prev) => ({
      ...prev,
      [incidentId]: prev[incidentId] ? 0 : Date.now()
    }));
  };

  const handleRequestDeployClick = (inc: IncidentPinData) => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          'resqtrack_selected_deploy_incident',
          JSON.stringify(inc)
        );
      } catch {
        // Ignore storage error
      }
    }
    if (onRequestDeploy) {
      onRequestDeploy(inc);
    } else if (typeof window !== 'undefined') {
      window.location.assign('/responder/request-deploy');
    }
  };

  const activeCategoryMeta = activePointer
    ? resolvePointerCategory({
        pointerCategory: activePointer.pointerCategory,
        category: activePointer.category,
        type: activePointer.type,
        title: activePointer.place,
        severity: activePointer.severity,
        id: activePointer.id
      })
    : null;

  const activeIsResponded = activePointer
    ? Boolean(respondedIds[activePointer.id]) ||
      activePointer.status?.toLowerCase() === 'responded' ||
      activePointer.status?.toLowerCase() === 'resolved'
    : false;

  const activeVerifiedTimestamp = activePointer
    ? verifiedTimestamps[activePointer.id] ||
      (activePointer.verifiedAt ? new Date(activePointer.verifiedAt).getTime() : null)
    : null;

  const activeRemainingSeconds = activeVerifiedTimestamp
    ? getRemainingCloseSeconds(activeVerifiedTimestamp)
    : DEFAULT_VERIFICATION_CLOSE_SECONDS;

  const activeProgressPercent = activeVerifiedTimestamp
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((DEFAULT_VERIFICATION_CLOSE_SECONDS - activeRemainingSeconds) /
              DEFAULT_VERIFICATION_CLOSE_SECONDS) *
              100
          )
        )
      )
    : 0;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 transition-all duration-300 ${
        effectiveExpanded
          ? 'fixed inset-2 md:inset-4 z-[9999] h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)] border-2 border-emerald-500/80 shadow-[0_0_60px_rgba(0,0,0,0.95)]'
          : ''
      }`}
      style={
        !effectiveExpanded && height
          ? { height: typeof height === 'number' ? `${height}px` : height }
          : undefined
      }
    >
      {/* Global CSS for pulsing beacon animations & tactical tooltips */}
      <style>{`
        @keyframes resqtrackPulseRing {
          0% { transform: scale(0.9); opacity: 0.9; }
          50% { transform: scale(1.6); opacity: 0.35; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes resqtrackBeaconGlow {
          0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.7), 0 0 20px rgba(239, 68, 68, 0.5); }
          50% { box-shadow: 0 0 22px rgba(239, 68, 68, 0.95), 0 0 35px rgba(239, 68, 68, 0.75); }
        }
        @keyframes resqtrackAmberGlow {
          0%, 100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.7), 0 0 20px rgba(245, 158, 11, 0.5); }
          50% { box-shadow: 0 0 22px rgba(245, 158, 11, 0.95), 0 0 35px rgba(245, 158, 11, 0.75); }
        }
        .tactical-map-tooltip {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(56, 189, 248, 0.6) !important;
          color: #f8fafc !important;
          font-family: monospace !important;
          font-size: 11px !important;
          border-radius: 8px !important;
          padding: 6px 10px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8) !important;
        }
        .tactical-map-tooltip::before {
          border-top-color: rgba(56, 189, 248, 0.6) !important;
        }
      `}</style>

      {/* Top RHU Medic Radar HUD Overlay */}
      {showMedicHud && (
        <div className="absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 border border-slate-800/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-xl pointer-events-auto">
            <button
              type="button"
              onClick={() => setSortMode('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                sortMode === 'ALL'
                  ? 'bg-sky-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>SORT / ALL (16)</span>
            </button>

            <button
              type="button"
              onClick={() => setSortMode('FOR_MEDICS')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                sortMode === 'FOR_MEDICS'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>SORT / FOR MEDICS (7)</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePaleNonMedic}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                pointerSettings.paleNonMedicEnabled
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Make 9 non-medic pointers pale to indicate they are not RHU Medic assignments"
            >
              {pointerSettings.paleNonMedicEnabled ? (
                <EyeOff className="w-3 h-3 text-amber-400" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              <span>
                PALE NON-MEDIC: {pointerSettings.paleNonMedicEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-xl pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowLegendDrawer((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3 h-3 text-sky-400" />
              <span>16 POINTERS LEGEND</span>
            </button>

            <button
              type="button"
              onClick={handleExpandMap}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-sky-950/90 hover:bg-sky-900 text-sky-200 border border-sky-700/70 flex items-center gap-1.5 cursor-pointer"
            >
              {effectiveExpanded ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
              <span>{effectiveExpanded ? 'EXIT FULL MAP' : 'EXPAND MAP'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 16 Pointer Categories Legend Drawer */}
      {showLegendDrawer && (
        <div className="absolute top-16 right-3 z-[405] w-80 max-h-[75%] overflow-y-auto bg-slate-950/95 border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
              16 Radar Pointer Categories
            </span>
            <button
              type="button"
              onClick={() => setShowLegendDrawer(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
              7 Medic-Allowed Categories (Deployable)
            </div>
            {RADAR_POINTER_CATEGORIES.filter((c) => c.isMedicAllowed).map((c) => {
              const IconComp = c.icon;
              return (
                <div
                  key={c.code}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900/90 border border-slate-800 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    >
                      <IconComp className="w-3 h-3" />
                    </span>
                    <span className="text-slate-200 truncate">{c.label}</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                    MEDIC
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              9 View-Only Non-Medic Categories (Pale)
            </div>
            {RADAR_POINTER_CATEGORIES.filter((c) => !c.isMedicAllowed).map((c) => {
              const IconComp = c.icon;
              return (
                <div
                  key={c.code}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900/60 border border-slate-800/80 text-[11px] opacity-75"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    >
                      <IconComp className="w-3 h-3" />
                    </span>
                    <span className="text-slate-300 truncate">{c.label}</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    VIEW ONLY
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-[11px] text-emerald-300 font-mono">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block"
              style={{ backgroundColor: RESPONDED_GREEN_COLOR }}
            />
            <span>GREEN POINTER = Responded / Active Unit On Scene</span>
          </div>
        </div>
      )}

      {/* Tactical Cloud Message Box Callout (Speech bubble pointing directly at the UI pointer icon) */}
      {activePointer && activeCategoryMeta && calloutPoint && (() => {
        const containerW = mapContainerRef.current?.clientWidth || 700;
        const cardW = 340;
        const halfW = cardW / 2;

        const isAbove = calloutPoint.y > 270;
        const rawX = calloutPoint.x;
        const rawY = calloutPoint.y;

        const clampX = Math.max(halfW + 12, Math.min(containerW - halfW - 12, rawX));
        const arrowOffset = Math.max(-halfW + 28, Math.min(halfW - 28, rawX - clampX));

        return (
          <div
            className="absolute z-[450] pointer-events-auto transition-transform duration-75"
            style={{
              left: `${clampX}px`,
              top: `${isAbove ? rawY - 20 : rawY + 20}px`,
              transform: isAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
            }}
          >
            <div className="relative w-[320px] sm:w-[350px] max-h-[460px] overflow-y-auto bg-slate-950/95 border-2 border-sky-400/80 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.95)] backdrop-blur-md overflow-hidden text-slate-100 flex flex-col animate-fadeIn">
              {/* Cloud Message Box Header */}
              <div
                className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2"
                style={{
                  background: `linear-gradient(90deg, ${
                    activeIsResponded ? RESPONDED_GREEN_COLOR : activeCategoryMeta.color
                  }28 0%, rgba(15,23,42,0.98) 100%)`
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white border border-white/80 flex-shrink-0 shadow"
                    style={{
                      backgroundColor: activeIsResponded
                        ? RESPONDED_GREEN_COLOR
                        : activeCategoryMeta.color
                    }}
                  >
                    {React.createElement(activeCategoryMeta.icon, { className: 'w-3.5 h-3.5' })}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-sky-300">
                        {activePointer.id}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${
                          activeCategoryMeta.isMedicAllowed
                            ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                            : 'bg-amber-950/90 border-amber-500/60 text-amber-300'
                        }`}
                      >
                        {activeCategoryMeta.isMedicAllowed
                          ? 'MEDIC ALLOWED'
                          : 'VIEW-ONLY (NON-MEDIC)'}
                      </span>
                    </div>
                    <h4 className="text-xs font-extrabold text-white truncate mt-0.5">
                      {activeCategoryMeta.label}
                    </h4>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePointer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Close Callout"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cloud Message Box Body */}
              <div className="p-3 space-y-2.5 text-xs">
                {/* Picture Evidence Preview */}
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black group">
                  <img
                    src={activePointer.evidenceUrl || DEFAULT_EVIDENCE_PHOTO}
                    alt={activeCategoryMeta.label}
                    className="w-full h-28 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-between p-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-black/80 border border-slate-700 text-[9px] font-mono text-emerald-300">
                        {activePointer.reportedAt || formatDateTimeWithSecondsAmPm(new Date())}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="px-2 py-0.5 rounded bg-sky-600/90 hover:bg-sky-500 text-white text-[9px] font-mono font-bold flex items-center gap-1 cursor-pointer shadow"
                      >
                        <Camera className="w-3 h-3" />
                        <span>INSPECT</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-200">
                      <span className="truncate font-semibold">{activePointer.type}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          activeIsResponded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {activeIsResponded ? 'RESPONDED' : activeCategoryMeta.severityLevel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Telemetry Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-slate-400">
                      <Cpu className="w-3 h-3 text-sky-400" />
                      <span>IP ADDRESS</span>
                    </div>
                    <div className="font-mono font-bold text-sky-300 mt-0.5 truncate text-[11px]">
                      {activePointer.ipAddress || '192.168.42.118'}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-slate-400">
                      <Navigation className="w-3 h-3 text-emerald-400" />
                      <span>GPS TELEMETRY</span>
                    </div>
                    <div className="font-mono font-bold text-emerald-300 mt-0.5 truncate text-[11px]">
                      {activePointer.lat.toFixed(4)}°, {activePointer.lng.toFixed(4)}°
                    </div>
                  </div>

                  <div className="col-span-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-slate-400">
                        <MapPin className="w-3 h-3 text-rose-400" />
                        <span>STREET ADDRESS</span>
                      </div>
                      <div className="font-semibold text-slate-100 mt-0.5 truncate text-[11px]">
                        {activePointer.place || 'Katipunan National Highway, ZN'}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[9px] font-mono text-slate-300 flex-shrink-0">
                      {activeCategoryMeta.agency}
                    </span>
                  </div>
                </div>

                {/* 5-Minute Verification Loading Timer (05:00 -> 00:00 Case Closed) */}
                <div className="p-2.5 rounded-xl bg-slate-900/95 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>
                        {activeVerifiedTimestamp
                          ? activeRemainingSeconds > 0
                            ? `TIMER: ${formatCountdownMmSs(activeRemainingSeconds)}`
                            : 'CASE CLOSED (SOLVED)'
                          : '5-MIN VERIFY TIMER (05:00)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTriggerVerificationTimer(activePointer.id)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-950/90 hover:bg-amber-900 text-amber-300 border border-amber-600/60 cursor-pointer"
                    >
                      {activeVerifiedTimestamp ? 'Reset' : 'Simulate Verify'}
                    </button>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 transition-all duration-500"
                      style={{
                        width: `${activeVerifiedTimestamp ? activeProgressPercent : 12}%`
                      }}
                    />
                  </div>
                </div>

                {/* Action Footer: Role-Gated "REQUEST TO DISPATCH OR DEPLOY" */}
                <div className="pt-0.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMarkResponded(activePointer.id)}
                    className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-mono font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeIsResponded
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      {activeIsResponded ? 'RESPONDED (GREEN PIN)' : 'MARK RESPONDED (GREEN)'}
                    </span>
                  </button>

                  {activeCategoryMeta.isMedicAllowed ? (
                    <button
                      type="button"
                      onClick={() => handleRequestDeployClick(activePointer)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] uppercase tracking-wider shadow-lg shadow-emerald-950/70 border border-emerald-400/50 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>REQUEST TO DISPATCH OR DEPLOY</span>
                    </button>
                  ) : (
                    <div className="w-full py-1.5 px-2 rounded-xl bg-slate-900/90 border border-amber-700/50 text-amber-300 text-[10px] font-mono flex items-center justify-center gap-1.5 text-center">
                      <Lock className="w-3 h-3 flex-shrink-0 text-amber-400" />
                      <span>NON-MEDIC // ASSIGNED TO {activeCategoryMeta.agency}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cloud Message Box Caret / Tail pointing directly to the UI Pointer Icon */}
              <div
                className={`absolute w-3.5 h-3.5 bg-slate-950 ${
                  isAbove
                    ? '-bottom-1.5 border-r-2 border-b-2 border-sky-400/80'
                    : '-top-1.5 border-l-2 border-t-2 border-sky-400/80'
                }`}
                style={{
                  left: `calc(50% + ${arrowOffset}px)`,
                  transform: 'translateX(-50%) rotate(45deg)'
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* Underlying Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        id="map"
        role="application"
        aria-label="Satellite map of Katipunan, Zamboanga del Norte"
        className={className}
        style={
          height && !isExpandedFullscreen
            ? { height: typeof height === 'number' ? `${height}px` : height, width: '100%' }
            : { minHeight: '420px', height: '100%', width: '100%' }
        }
      />

      {/* Multi-Media Evidence Lightbox */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={activePointer?.evidenceUrl || DEFAULT_EVIDENCE_PHOTO}
        images={activePointer?.evidenceImages}
        timestamp={activePointer?.reportedAt}
        title={
          activePointer && activeCategoryMeta
            ? `${activeCategoryMeta.label} — ${activePointer.id}`
            : 'Incident Evidence Inspection'
        }
      />
    </div>
  );
};

export default SatelliteCommandMap;
