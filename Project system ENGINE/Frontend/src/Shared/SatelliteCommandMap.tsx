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
  Layers,
  GripHorizontal,
  Plus,
  Minus,
  Crosshair
} from 'lucide-react';
import {
  RADAR_POINTER_CATEGORIES,
  RadarPointerCategoryMeta,
  resolvePointerCategory,
  resolveIncidentBeaconVisual,
  resolveResponderBadgeVisual,
  getMedicPointerSettings,
  saveMedicPointerSettings,
  formatTwoMinCountdown,
  formatDateTimeWithSecondsAmPm,
  parseIncidentTimestampMs,
  shouldPulseIncidentBeacon,
  RESPONDED_GREEN_COLOR,
  TWO_MINUTE_CLOSE_SECONDS
} from './radarPointerCategories';
import { ImageLightboxModal, LightboxMediaItem } from './ImageLightboxModal';
import { DeployRespondersModal } from './DeployRespondersModal';
import { ResponderClosureEvidenceModal } from './ResponderClosureEvidenceModal';
import { ReportItem, TaggedColleagueItem } from '@/Endpoints/reportsApi';
import { DutyUnit } from '@/Endpoints/responderOpsApi';
import {
  calculateHaversineDistanceKm,
  calculateDynamicEtaMinutes
} from '@/Libs/Map/mapAccuracy';
import {
  isRawCoordinateLabel,
  resolveStreetAddressSync,
  resolveStreetAddressAsync
} from '@/Libs/Map/addressResolver';
import { useFluidResposiveness, useDraggable } from '@/Hooks';

export interface IncidentPinData {
  id: string;
  title?: string;
  type: string;
  status: 'critical' | 'active' | 'resolved' | 'InProgress' | 'WorkingProgress' | 'Responded' | 'Verified' | 'Closed' | string;
  statusLabel?: string;
  place: string;
  locationLabel?: string;
  lat: number;
  lng: number;
  category?: string;
  pointerCategory?: string;
  pointerIconType?: string | null;
  severity?: string;
  ipAddress?: string;
  evidenceUrl?: string;
  evidenceImages?: Array<LightboxMediaItem | string>;
  verifiedAt?: string | number | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  aiVerificationStatus?: string | null;
  closureSummary?: string | null;
  closureApprovalMode?: string | null;
  taggedColleagues?: TaggedColleagueItem[];
  reportedAt?: string;
  isBlurry?: boolean;
  requiresManualVerification?: boolean;
  recommendedAgency?: string;
  gpsAccuracyMeters?: number;
  description?: string;
  allocatedUnitId?: string | null;
  allocatedUnitCode?: string | null;
  isFixture?: boolean;
  rawReportedAt?: string | number | null;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  locationLabel?: string;
  severity?: 'critical' | 'moderate' | 'low' | string;
  type?: 'gps' | 'fixture' | 'incident' | string;
  category?: string;
  pointerCategory?: string;
  pointerIconType?: string | null;
  agency?: string;
  description?: string;
  status?: string;
  ipAddress?: string;
  evidenceUrl?: string;
  reportedAt?: string | number | null;
  verifiedAt?: string | number | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  aiVerificationStatus?: string | null;
  closureSummary?: string | null;
  closureApprovalMode?: string | null;
  taggedColleagues?: TaggedColleagueItem[];
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
  onOpenClosureEvidence?: (incident: IncidentPinData) => void;
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
  isMinimap?: boolean;
  onCloseCallout?: () => void;
  hideZoomControls?: boolean;
}

interface PinLifecycleState {
  isWorkingProgress: boolean;
  isDone: boolean;
  elapsedSeconds: number;
  remainingFadeSeconds: number;
  isFadedOut: boolean;
  fadeOpacity: number;
}

const computePinLifecycle = (
  inc: Pick<IncidentPinData, 'status' | 'resolvedAt' | 'closedAt'>,
  nowMs: number
): PinLifecycleState => {
  const statusLower = (inc.status || '').trim().toLowerCase();
  const isWorkingProgress =
    statusLower === 'inprogress' ||
    statusLower === 'workingprogress' ||
    statusLower === 'in_progress';
  const doneTsRaw = inc.resolvedAt || inc.closedAt || null;
  const isDone =
    statusLower === 'resolved' ||
    statusLower === 'closed' ||
    Boolean(doneTsRaw);

  if (!isDone) {
    return {
      isWorkingProgress,
      isDone: false,
      elapsedSeconds: 0,
      remainingFadeSeconds: TWO_MINUTE_CLOSE_SECONDS,
      isFadedOut: false,
      fadeOpacity: 1
    };
  }

  const doneMs = doneTsRaw ? parseIncidentTimestampMs(doneTsRaw) : null;
  if (doneMs === null) {
    return {
      isWorkingProgress: false,
      isDone: true,
      elapsedSeconds: 0,
      remainingFadeSeconds: TWO_MINUTE_CLOSE_SECONDS,
      isFadedOut: false,
      fadeOpacity: 1
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - doneMs) / 1000));
  const remainingFadeSeconds = Math.max(0, TWO_MINUTE_CLOSE_SECONDS - elapsedSeconds);
  const isFadedOut = elapsedSeconds >= TWO_MINUTE_CLOSE_SECONDS;
  const fadeOpacity = isFadedOut
    ? 0
    : Math.max(0.15, (TWO_MINUTE_CLOSE_SECONDS - elapsedSeconds) / TWO_MINUTE_CLOSE_SECONDS);

  return {
    isWorkingProgress: false,
    isDone: true,
    elapsedSeconds,
    remainingFadeSeconds,
    isFadedOut,
    fadeOpacity
  };
};

const toCoordKey = (lat: number, lng: number): string =>
  `${lat.toFixed(4)},${lng.toFixed(4)}`;

const buildFallbackReportItem = (inc: IncidentPinData, displayPlace: string): ReportItem => ({
  id: inc.id,
  referenceCode: inc.id,
  reporterId: '',
  reporterName: 'Field Reporter',
  reporterRole: 'Civilian',
  title: inc.title || inc.type || 'Active Incident',
  note: inc.description || '',
  category: inc.category || 'MedicalEmergency',
  severity: inc.severity || 'High',
  status: inc.status || 'Active',
  latitude: inc.lat,
  longitude: inc.lng,
  locationLabel: displayPlace,
  hasImage: Boolean(inc.evidenceUrl),
  imageUrl: inc.evidenceUrl || null,
  allocatedUnitId: inc.allocatedUnitId || null,
  allocatedUnitCode: inc.allocatedUnitCode || null,
  createdAt: inc.reportedAt || new Date().toISOString(),
  verifiedAt: inc.verifiedAt ? String(inc.verifiedAt) : null,
  resolvedAt: inc.resolvedAt || null,
  closedAt: inc.closedAt || null,
  gpsAccuracyMeters: inc.gpsAccuracyMeters || null,
  isHardwareGeolocated: true,
  isBlurry: Boolean(inc.isBlurry),
  requiresManualVerification: Boolean(inc.requiresManualVerification),
  recommendedAgencyUnit: inc.recommendedAgency || null,
  aiVerificationStatus: inc.aiVerificationStatus || null,
  closureSummary: inc.closureSummary || null,
  closureApprovalMode: inc.closureApprovalMode || null,
  taggedColleagues: inc.taggedColleagues || []
});

// Katipunan, Zamboanga del Norte (7109) Municipal Sector Geofence & Strategic Bounding Box
// (Matching exact territorial boundary from Nabilid/Tuburan on the West to Malugas/Punta on the East)
export const KATIPUNAN_SECTOR_BOUNDS: [[number, number], [number, number]] = [
  [8.4720, 123.2100], // Southwest inland sector (encompassing Tuburan/Nabilid south)
  [8.5380, 123.3550]  // Northeast coastal sector (encompassing Punta/Malugas north)
];

// Max pan boundary box with strict viscosity (firmly locks camera inside Katipunan jurisdiction)
export const KATIPUNAN_MAX_PAN_BOUNDS: [[number, number], [number, number]] = [
  [8.4550, 123.1900], // Southwest hard boundary stop
  [8.5550, 123.3750]  // Northeast hard boundary stop
];

export const KATIPUNAN_CENTER: [number, number] = [8.51145, 123.28261];
export const DEFAULT_KATIPUNAN_ZOOM = 15.25;
export const MIN_KATIPUNAN_ZOOM = 12; // Strictly locks minimum zoom to Katipunan Municipal Sector
export const MAX_KATIPUNAN_ZOOM = 19; // Ultra-high resolution satellite zoom
const BOUNDS_PADDING: [number, number] = [16, 16];
const MIN_ACCURACY_RADIUS_METERS = 15;
const PAN_DURATION_SECONDS = 0.8;

export const SatelliteCommandMap: FC<SatelliteCommandMapProps> = ({
  incidents = [],
  markers = [],
  responders = [],
  selectedIncidentId,
  onSelectIncident,
  onRequestDeploy,
  onOpenClosureEvidence,
  onExpandMap,
  isExpanded,
  onToggleExpand,
  centerLat,
  centerLng,
  height,
  roleFilter,
  showMedicHud = false,
  onMapReady,
  className = 'mapview__map',
  isMinimap: isMinimapProp = false,
  onCloseCallout,
  hideZoomControls = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const accuracyCirclesLayerRef = useRef<L.LayerGroup | null>(null);
  const dispatchRoutesLayerRef = useRef<L.LayerGroup | null>(null);
  const respondersLayerRef = useRef<L.LayerGroup | null>(null);
  const radarRingsLayerRef = useRef<L.LayerGroup | null>(null);
  const closedIncidentIdRef = useRef<string | null>(null);
  const markerInstancesRef = useRef<
    Map<string, { marker: L.Marker; circle?: L.Circle; lastHtml: string }>
  >(new Map());
  const requestedGeocodeKeysRef = useRef<Set<string>>(new Set());

  const [sortMode, setSortMode] = useState<'ALL' | 'FOR_MEDICS'>('ALL');
  const [pointerSettings, setPointerSettings] = useState(() => getMedicPointerSettings());
  const [showLegendDrawer, setShowLegendDrawer] = useState<boolean>(false);
  const [isExpandedFullscreen, setIsExpandedFullscreen] = useState<boolean>(false);
  const [activePointer, setActivePointer] = useState<IncidentPinData | null>(null);
  const [tickNow, setTickNow] = useState<number>(() => Date.now());
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [calloutPoint, setCalloutPoint] = useState<{ x: number; y: number } | null>(null);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState<boolean>(false);
  const [deployTargetIncident, setDeployTargetIncident] = useState<IncidentPinData | null>(null);
  const [closureTargetIncident, setClosureTargetIncident] = useState<IncidentPinData | null>(null);
  const [resolvedAddressesByCoord, setResolvedAddressesByCoord] = useState<Record<string, string>>({});

  const isCivilianViewer = useMemo(
    () => (roleFilter || '').trim().toLowerCase() === 'civilian',
    [roleFilter]
  );

  const isViewerMedic = useMemo(
    () => (roleFilter || '').toUpperCase().includes('MEDIC') || (roleFilter || '').toUpperCase().includes('RHU'),
    [roleFilter]
  );

  const lastFocusedIdRef = useRef<string | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const { position: dragOffset, dragHandleProps } = useDraggable({
    resetKey: activePointer?.id || null
  });

  const { isMobile, isTablet } = useFluidResposiveness();
  const effectiveExpanded = isExpanded !== undefined ? isExpanded : isExpandedFullscreen;

  // Real-time calculation of callout pixel position anchored to active pointer with requestAnimationFrame throttling
  const updateCalloutPosition = useCallback(() => {
    if (!mapInstanceRef.current || !activePointer) {
      setCalloutPoint(null);
      return;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = requestAnimationFrame(() => {
      try {
        const map = mapInstanceRef.current;
        if (!map) return;
        const pt = map.latLngToContainerPoint([activePointer.lat, activePointer.lng]);
        setCalloutPoint((prev) => {
          if (prev && Math.abs(prev.x - pt.x) < 0.4 && Math.abs(prev.y - pt.y) < 0.4) {
            return prev;
          }
          return { x: pt.x, y: pt.y };
        });
      } catch {
        setCalloutPoint(null);
      }
    });
  }, [activePointer]);

  // Smooth, non-jittering single camera transition to focused incident with stability check
  const smoothlyFocusIncident = useCallback((inc: IncidentPinData, isUserClick = false) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Prevent duplicate camera interruptions if already focused on this incident
    if (lastFocusedIdRef.current === inc.id && !isUserClick) {
      return;
    }
    lastFocusedIdRef.current = inc.id;

    try {
      // Check if incident marker is already comfortably within visible map viewport
      const pt = map.latLngToContainerPoint([inc.lat, inc.lng]);
      const size = map.getSize();
      const padX = size.x * 0.12;
      const padY = size.y * 0.15;
      const isComfortablyInView =
        pt.x >= padX && pt.x <= size.x - padX &&
        pt.y >= padY && pt.y <= size.y - padY;

      // If already comfortably visible, keep the map rock-solid and stable with ZERO shaking
      if (isComfortablyInView) {
        return;
      }

      // If outside view, pan gently and stably to bring the marker into view
      map.panTo([inc.lat, inc.lng], {
        animate: true,
        duration: 0.32,
        easeLinearity: 0.2
      });
    } catch {
      // Safe pan fallback
    }
  }, []);

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
    updateCalloutPosition();
  }, [activePointer, updateCalloutPosition]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        updateCalloutPosition();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [updateCalloutPosition]);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
      updateCalloutPosition();
    }, 60);
    const t2 = window.setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
      updateCalloutPosition();
    }, 240);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [effectiveExpanded]);

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

  const getExtractedStreetAddress = useCallback(
    (inc: Pick<IncidentPinData, 'lat' | 'lng' | 'locationLabel' | 'place'>): string => {
      if (inc.locationLabel && !isRawCoordinateLabel(inc.locationLabel)) {
        return inc.locationLabel;
      }
      const key = toCoordKey(inc.lat, inc.lng);
      const cachedAsync = resolvedAddressesByCoord[key];
      if (cachedAsync && !isRawCoordinateLabel(cachedAsync)) {
        return cachedAsync;
      }
      if (inc.place && !isRawCoordinateLabel(inc.place)) {
        return inc.place;
      }
      return resolveStreetAddressSync(inc.lat, inc.lng);
    },
    [resolvedAddressesByCoord]
  );

  // Merge `incidents` and `markers` into a unified enriched list with 16-category resolution
  // Excludes responder units (type === 'gps') which are rendered separately
  const unifiedIncidents: Array<IncidentPinData & { categoryMeta: RadarPointerCategoryMeta }> =
    useMemo(() => {
      const combined: IncidentPinData[] = incidents.map((inc) => ({
        ...inc,
        place:
          inc.locationLabel && !isRawCoordinateLabel(inc.locationLabel)
            ? inc.locationLabel
            : inc.place && !isRawCoordinateLabel(inc.place)
            ? inc.place
            : resolveStreetAddressSync(inc.lat, inc.lng)
      }));

      markers.forEach((m) => {
        if (m.type === 'gps') return;
        if (!combined.some((inc) => inc.id === m.id)) {
          const lat = Number(m.lat);
          const lng = Number(m.lng);
          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

          const extractedPlace =
            m.locationLabel && !isRawCoordinateLabel(m.locationLabel)
              ? m.locationLabel
              : resolveStreetAddressSync(lat, lng);

          combined.push({
            id: m.id,
            title: m.title,
            type: m.title,
            status: m.status || (m.severity === 'critical' ? 'critical' : 'active'),
            statusLabel: m.status || m.severity || 'Active',
            place: extractedPlace,
            locationLabel: m.locationLabel,
            lat,
            lng,
            category: m.category,
            pointerCategory: m.pointerCategory,
            pointerIconType: m.pointerIconType,
            severity: m.severity,
            ipAddress: m.ipAddress,
            evidenceUrl: m.evidenceUrl,
            reportedAt: m.reportedAt ? String(m.reportedAt) : undefined,
            verifiedAt: m.verifiedAt,
            resolvedAt: m.resolvedAt,
            closedAt: m.closedAt,
            aiVerificationStatus: m.aiVerificationStatus,
            closureSummary: m.closureSummary,
            closureApprovalMode: m.closureApprovalMode,
            taggedColleagues: m.taggedColleagues,
            requiresManualVerification: m.requiresManualVerification,
            recommendedAgency: m.agency,
            gpsAccuracyMeters: m.gpsAccuracyMeters,
            description: m.description,
            allocatedUnitId: m.allocatedUnitId,
            allocatedUnitCode: m.allocatedUnitCode,
            isFixture: m.type === 'fixture'
          });
        }
      });

      return combined.map((inc, index) => {
        const explicitMatch =
          inc.pointerCategory || inc.category || inc.type
            ? resolvePointerCategory({
                pointerCategory: inc.pointerCategory,
                category: inc.category,
                type: inc.type,
                title: inc.title || inc.place,
                severity: inc.severity,
                id: inc.id
              })
            : RADAR_POINTER_CATEGORIES[index % RADAR_POINTER_CATEGORIES.length];

        return {
          ...inc,
          ipAddress: inc.ipAddress,
          evidenceUrl: inc.evidenceUrl,
          rawReportedAt: inc.rawReportedAt ?? inc.reportedAt ?? null,
          reportedAt: inc.reportedAt ? formatDateTimeWithSecondsAmPm(inc.reportedAt) : undefined,
          categoryMeta: explicitMatch
        };
      });
    }, [incidents, markers]);

  // Filter pointers based on SORT mode, Medic Pointer Settings, and 2-minute Done fade-out expiration
  const visibleIncidents = useMemo(() => {
    return unifiedIncidents.filter((inc) => {
      const lifecycle = computePinLifecycle(inc, tickNow);
      if (lifecycle.isFadedOut) {
        return false;
      }

      if (sortMode === 'FOR_MEDICS') {
        return inc.categoryMeta.isMedicAllowed;
      }

      if (pointerSettings.hideNonMedicOnSort && !inc.categoryMeta.isMedicAllowed) {
        return false;
      }

      return true;
    });
  }, [unifiedIncidents, sortMode, pointerSettings.hideNonMedicOnSort, tickNow]);

  // Lazily resolve OSM Nominatim street addresses for visible pins without blocking UI
  useEffect(() => {
    let isCancelled = false;
    visibleIncidents.forEach((inc) => {
      if (inc.locationLabel && !isRawCoordinateLabel(inc.locationLabel)) return;
      const key = toCoordKey(inc.lat, inc.lng);
      if (resolvedAddressesByCoord[key] || requestedGeocodeKeysRef.current.has(key)) return;
      requestedGeocodeKeysRef.current.add(key);

      void resolveStreetAddressAsync(inc.lat, inc.lng).then((resolved) => {
        if (!isCancelled && resolved && !isRawCoordinateLabel(resolved)) {
          setResolvedAddressesByCoord((prev) =>
            prev[key] === resolved ? prev : { ...prev, [key]: resolved }
          );
        }
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [visibleIncidents, resolvedAddressesByCoord]);

  // Auto-close callout selection when an active pin completes its 120s fade-out
  useEffect(() => {
    if (!activePointer) return;
    const latest = unifiedIncidents.find((i) => i.id === activePointer.id) || activePointer;
    const lifecycle = computePinLifecycle(latest, tickNow);
    if (lifecycle.isFadedOut) {
      closedIncidentIdRef.current = activePointer.id;
      setActivePointer(null);
      onCloseCallout?.();
    }
  }, [activePointer, unifiedIncidents, tickNow, onCloseCallout]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const homeBounds = L.latLngBounds(KATIPUNAN_SECTOR_BOUNDS[0], KATIPUNAN_SECTOR_BOUNDS[1]);
    const maxBounds = L.latLngBounds(KATIPUNAN_MAX_PAN_BOUNDS[0], KATIPUNAN_MAX_PAN_BOUNDS[1]);
    const initialCenter: [number, number] =
      typeof centerLat === 'number' &&
      typeof centerLng === 'number' &&
      centerLat >= KATIPUNAN_MAX_PAN_BOUNDS[0][0] &&
      centerLat <= KATIPUNAN_MAX_PAN_BOUNDS[1][0] &&
      centerLng >= KATIPUNAN_MAX_PAN_BOUNDS[0][1] &&
      centerLng <= KATIPUNAN_MAX_PAN_BOUNDS[1][1]
        ? [centerLat, centerLng]
        : KATIPUNAN_CENTER;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: MIN_KATIPUNAN_ZOOM,
      maxZoom: MAX_KATIPUNAN_ZOOM,
      maxBounds: maxBounds,
      maxBoundsViscosity: 0.95,
      attributionControl: true
    }).setView(initialCenter, DEFAULT_KATIPUNAN_ZOOM);

    map.attributionControl.setPosition('bottomleft');
    map.setMaxBounds(maxBounds);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: MAX_KATIPUNAN_ZOOM,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
      }
    ).addTo(map);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: MAX_KATIPUNAN_ZOOM,
        attribution: 'Labels &copy; Esri'
      }
    ).addTo(map);

    const accuracyCirclesLayer = L.layerGroup().addTo(map);
    const dispatchRoutesLayer = L.layerGroup().addTo(map);
    const radarRingsLayer = L.layerGroup().addTo(map);
    const respondersLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    accuracyCirclesLayerRef.current = accuracyCirclesLayer;
    dispatchRoutesLayerRef.current = dispatchRoutesLayer;
    radarRingsLayerRef.current = radarRingsLayer;
    respondersLayerRef.current = respondersLayer;
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Firmly center and frame Katipunan Sector & Poblacion cluster matching tactical satellite view
    map.setView(initialCenter, DEFAULT_KATIPUNAN_ZOOM, { animate: false });

    // Draw initial tactical radar rings matching reference Katipunan Poblacion cluster
    const initialRings: Array<{ center: [number, number]; radius: number; weight: number; opacity: number }> = [
      { center: [8.51015, 123.28505], radius: 120, weight: 1.8, opacity: 0.85 }, // RHU Trauma Facility
      { center: [8.51022, 123.28663], radius: 110, weight: 1.8, opacity: 0.85 }, // Doctor Stethoscope Station
      { center: [8.51018, 123.28584], radius: 260, weight: 1.8, opacity: 0.70 }  // Enclosing Poblacion Cluster
    ];
    initialRings.forEach((r, idx) => {
      const circle = L.circle(r.center, {
        radius: r.radius,
        color: '#10b981', // Crisp emerald green matching reference picture
        weight: r.weight,
        opacity: r.opacity,
        fillColor: '#10b981',
        fillOpacity: 0.04,
        className: `resqtrack-radar-concentric-ring resqtrack-ring-${idx}`
      });
      radarRingsLayer.addLayer(circle);
    });

    // Staggered layout size invalidation passes to prevent partial tile clipping
    requestAnimationFrame(() => {
      map.invalidateSize();
      updateCalloutPosition();
    });
    const tInit1 = window.setTimeout(() => {
      map.invalidateSize();
      updateCalloutPosition();
    }, 80);
    const tInit2 = window.setTimeout(() => {
      map.invalidateSize();
      updateCalloutPosition();
    }, 240);
    const tInit3 = window.setTimeout(() => {
      map.invalidateSize();
      updateCalloutPosition();
    }, 650);

    if (onMapReady) {
      onMapReady(map);
    }

    return () => {
      window.clearTimeout(tInit1);
      window.clearTimeout(tInit2);
      window.clearTimeout(tInit3);
      try {
        const anyMap = map as unknown as { _panAnim?: { stop: () => void } };
        if (anyMap._panAnim) {
          anyMap._panAnim.stop();
          anyMap._panAnim = undefined;
        }
        map.off();
        map.stop();
        map.remove();
      } catch {
        // Safe disposal
      }
      mapInstanceRef.current = null;
    };
  }, []);

  // Smoothly pan when center coordinates change dynamically from outside
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (typeof centerLat !== 'number' || typeof centerLng !== 'number') return;
    // Prevent competing animation loops while user is viewing or dragging a callout
    if (activePointer) return;

    // Boundary guard: only pan if target is within Katipunan Municipal Sector
    if (
      centerLat < KATIPUNAN_MAX_PAN_BOUNDS[0][0] ||
      centerLat > KATIPUNAN_MAX_PAN_BOUNDS[1][0] ||
      centerLng < KATIPUNAN_MAX_PAN_BOUNDS[0][1] ||
      centerLng > KATIPUNAN_MAX_PAN_BOUNDS[1][1]
    ) {
      return;
    }

    try {
      const cur = mapInstanceRef.current.getCenter();
      if (Math.abs(cur.lat - centerLat) > 0.005 || Math.abs(cur.lng - centerLng) > 0.005) {
        mapInstanceRef.current.panTo([centerLat, centerLng], { animate: false });
      }
    } catch {
      // Safe fallback
    }
  }, [centerLat, centerLng, activePointer]);

  const handleRecenterSector = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(KATIPUNAN_CENTER, DEFAULT_KATIPUNAN_ZOOM, { animate: true });
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomOut();
  }, []);

  const handleCloseCallout = useCallback((e?: React.MouseEvent | MouseEvent) => {
    if (e && 'stopPropagation' in e) {
      e.stopPropagation();
    }
    if (activePointer) {
      closedIncidentIdRef.current = activePointer.id;
    } else if (selectedIncidentId) {
      closedIncidentIdRef.current = selectedIncidentId;
    }
    setActivePointer(null);
    onCloseCallout?.();
  }, [activePointer, selectedIncidentId, onCloseCallout]);

  // Sync external selectedIncidentId
  useEffect(() => {
    if (!selectedIncidentId) {
      if (lastFocusedIdRef.current !== null) {
        setActivePointer(null);
        lastFocusedIdRef.current = null;
      }
      return;
    }
    // If the user explicitly closed this callout, do not auto-reopen until closedIncidentIdRef is reset
    if (closedIncidentIdRef.current === selectedIncidentId) {
      return;
    }
    if (activePointer?.id === selectedIncidentId) {
      lastFocusedIdRef.current = selectedIncidentId;
      return;
    }
    const found = unifiedIncidents.find((i) => i.id === selectedIncidentId);
    if (found && found.id !== activePointer?.id) {
      lastFocusedIdRef.current = selectedIncidentId;
      setActivePointer(found);
    }
  }, [selectedIncidentId, unifiedIncidents, activePointer?.id]);

  // Render 16-category pointers onto Leaflet layer with prominent pulsing red/amber markers for unallocated or critical incidents
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const circlesLayer = accuracyCirclesLayerRef.current;
    if (!markersLayer || !circlesLayer) return;

    const activeIds = new Set<string>();

    visibleIncidents.forEach((inc) => {
      const lat = Number(inc.lat);
      const lng = Number(inc.lng);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;
      activeIds.add(inc.id);

      const meta = inc.categoryMeta;
      const lifecycle = computePinLifecycle(inc, tickNow);
      const isDone = lifecycle.isDone;
      const isWorkingProgress = lifecycle.isWorkingProgress;

      const isViewerMedic =
        (roleFilter || '').toUpperCase().includes('MEDIC') ||
        (roleFilter || '').toUpperCase().includes('RHU');

      const isPaleNonMedic =
        isViewerMedic &&
        pointerSettings.paleNonMedicEnabled &&
        !meta.isMedicAllowed &&
        !isDone;

      const beacon = resolveIncidentBeaconVisual(
        {
          category: inc.category,
          pointerCategory: inc.pointerCategory,
          pointerIconType: inc.pointerIconType,
          type: inc.type,
          title: inc.title,
          description: inc.description || inc.place,
          severity: inc.severity
        },
        meta,
        isDone
      );

      const pointerBgColor = isDone
        ? RESPONDED_GREEN_COLOR
        : isWorkingProgress
        ? '#0284C7'
        : beacon.bgColor;

      const pinOpacity = isPaleNonMedic
        ? 0.38
        : isDone
        ? lifecycle.fadeOpacity
        : 1;

      const paleStyle = isPaleNonMedic
        ? `opacity: ${pinOpacity}; filter: grayscale(82%);`
        : `opacity: ${pinOpacity.toFixed(3)};`;

      const statusLower = (inc.status || '').trim().toLowerCase();
      const pulseState = shouldPulseIncidentBeacon({
        status: inc.status,
        verifiedAt: inc.verifiedAt,
        reportedAt: inc.rawReportedAt,
        isResponded: isDone,
        isFixture: inc.isFixture
      });

      const shouldPulse = pulseState.shouldPulse && !isPaleNonMedic && !isDone && !isWorkingProgress;
      const isNewUpload = shouldPulse && pulseState.isNewUpload;
      const showNewPill =
        shouldPulse &&
        (pulseState.isRecentTimestamp ||
          !inc.verifiedAt ||
          statusLower === 'reported' ||
          statusLower === 'submitted');

      const wavePulseHtml = shouldPulse
        ? `
          <div class="resqtrack-wave-ring ${isNewUpload ? 'resqtrack-wave-ring--fast' : ''}" style="border:2px solid ${pointerBgColor};box-shadow:0 0 14px ${pointerBgColor};background:${pointerBgColor}1F;"></div>
          <div class="resqtrack-beat-ring ${isNewUpload ? 'resqtrack-beat-ring--fast' : ''}" style="border:2px solid ${beacon.ringColor};box-shadow:0 0 10px ${pointerBgColor};"></div>
        `
        : '';

      const statusBadgeHtml = isDone
        ? `<span style="position:absolute;top:-15px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:1px 5px;border-radius:9999px;background:#059669;color:#FFFFFF;border:1.5px solid #F7F1EA;font-family:monospace;font-size:7.5px;font-weight:800;letter-spacing:0.04em;line-height:1.25;box-shadow:0 2px 6px rgba(5,150,105,0.45);pointer-events:none;z-index:5;">MARK AS DONE · ${formatTwoMinCountdown(
            lifecycle.remainingFadeSeconds
          )}</span>`
        : isWorkingProgress
        ? '<span style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:1px 5px;border-radius:9999px;background:#0284C7;color:#FFFFFF;border:1.5px solid #F7F1EA;font-family:monospace;font-size:7.5px;font-weight:800;letter-spacing:0.04em;line-height:1.25;box-shadow:0 2px 6px rgba(2,132,199,0.45);pointer-events:none;z-index:5;">WORKING PROGRESS</span>'
        : showNewPill
        ? '<span class="resqtrack-new-badge">NEW</span>'
        : '';

      // 2-minute SVG circular countdown ring around the pointer icon when Mark as Done
      const ringRadius = 21;
      const ringCircumference = 2 * Math.PI * ringRadius;
      const ringProgress = lifecycle.remainingFadeSeconds / TWO_MINUTE_CLOSE_SECONDS;
      const ringDashOffset = ringCircumference * (1 - Math.max(0, Math.min(1, ringProgress)));
      const doneCountdownRingSvg = isDone
        ? `<svg width="46" height="46" viewBox="0 0 46 46" style="position:absolute;top:-4px;left:-1px;pointer-events:none;z-index:3;transform:rotate(-90deg);">
            <circle cx="23" cy="23" r="${ringRadius}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2.5" />
            <circle cx="23" cy="23" r="${ringRadius}" fill="none" stroke="#34D399" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="${ringCircumference.toFixed(
              2
            )}" stroke-dashoffset="${ringDashOffset.toFixed(2)}" />
          </svg>`
        : '';

      const isTargetDispatch = selectedIncidentId === inc.id || activePointer?.id === inc.id;
      const dispatchHaloHtml = isTargetDispatch
        ? `<div class="resqtrack-dispatch-halo" style="box-shadow:0 0 18px ${pointerBgColor};"></div>`
        : '';

      const coreBadgeClass = isNewUpload ? 'resqtrack-core-beat' : '';
      const coreBoxShadow = isNewUpload
        ? `0 0 18px ${pointerBgColor}, 0 6px 16px rgba(20,4,10,0.55), 0 0 0 3px ${beacon.ringColor}88`
        : `0 6px 16px rgba(20,4,10,0.55), 0 0 0 2px ${pointerBgColor}55`;

      const markerZIndexOffset = isTargetDispatch
        ? 900
        : isNewUpload
        ? 600
        : shouldPulse
        ? 250
        : 0;

      const pinHtml = `
          <div style="position:relative;width:44px;height:48px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow:visible;${paleStyle}transition:opacity 300ms ease;cursor:pointer;">
            ${wavePulseHtml}
            ${dispatchHaloHtml}
            ${doneCountdownRingSvg}
            ${statusBadgeHtml}
            <div class="${coreBadgeClass}" style="position:relative;width:38px;height:38px;border-radius:9999px;background:${pointerBgColor};border:2.5px solid #F7F1EA;box-shadow:${coreBoxShadow};display:flex;align-items:center;justify-content:center;color:#FFFFFF;z-index:2;">
              <svg role="img" aria-label="${beacon.ariaLabel}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45));">
                ${beacon.svgMarkup}
              </svg>
            </div>
            <div style="width:10px;height:10px;background:${pointerBgColor};border-right:2px solid #F7F1EA;border-bottom:2px solid #F7F1EA;transform:rotate(45deg);margin-top:-6px;z-index:1;box-shadow:2px 2px 6px rgba(0,0,0,0.35);"></div>
          </div>
        `;

      // Smooth distress signal live repositioning:
      // If marker already exists, smoothly update coordinates & only swap icon if HTML changed
      const existing = markerInstancesRef.current.get(inc.id);
      if (existing) {
        const cur = existing.marker.getLatLng();
        if (Math.abs(cur.lat - lat) > 0.00001 || Math.abs(cur.lng - lng) > 0.00001) {
          existing.marker.setLatLng([lat, lng]);
          if (existing.circle) {
            existing.circle.setLatLng([lat, lng]);
          }
          if (activePointer?.id === inc.id) {
            setActivePointer(inc);
          }
        }
        existing.marker.setZIndexOffset(markerZIndexOffset);
        existing.marker.off('click');
        existing.marker.on('click', (e) => {
          if (e && e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
          } else {
            const stoppableEvent = e as unknown as { stopPropagation?: () => void };
            stoppableEvent.stopPropagation?.();
          }
          closedIncidentIdRef.current = null;
          setActivePointer(inc);
          onSelectIncident?.(inc);
        });
        if (existing.lastHtml !== pinHtml) {
          existing.marker.setIcon(
            L.divIcon({
              className: 'resqtrack-tactical-pointer',
              html: pinHtml,
              iconSize: [44, 48],
              iconAnchor: [22, 46]
            })
          );
          existing.lastHtml = pinHtml;
        }
        return;
      }

      const pinIcon = L.divIcon({
        className: 'resqtrack-tactical-pointer',
        html: pinHtml,
        iconSize: [44, 48],
        iconAnchor: [22, 46]
      });

      const marker = L.marker([lat, lng], {
        icon: pinIcon,
        zIndexOffset: markerZIndexOffset,
        title: `${meta.label} — ${inc.id}`
      });

      let accuracyCircle: L.Circle | undefined;

      marker.on('click', (e) => {
        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        } else {
          const stoppableEvent = e as unknown as { stopPropagation?: () => void };
          stoppableEvent.stopPropagation?.();
        }
        closedIncidentIdRef.current = null;
        setActivePointer(inc);
        onSelectIncident?.(inc);
      });

      markersLayer.addLayer(marker);
      markerInstancesRef.current.set(inc.id, { marker, circle: accuracyCircle, lastHtml: pinHtml });
    });

    // Clean up expired or faded-out markers
    markerInstancesRef.current.forEach((val, id) => {
      if (!activeIds.has(id)) {
        markersLayer.removeLayer(val.marker);
        if (val.circle) circlesLayer.removeLayer(val.circle);
        markerInstancesRef.current.delete(id);
      }
    });
  }, [visibleIncidents, pointerSettings.paleNonMedicEnabled, tickNow, onSelectIncident, activePointer, selectedIncidentId, roleFilter]);

  // Render on-duty responder units on map with agency vehicle badges & emerald availability rings
  useEffect(() => {
    const respondersLayer = respondersLayerRef.current;
    if (!respondersLayer) return;

    respondersLayer.clearLayers();

    allResponderUnits.forEach((unit) => {
      const lat = Number(unit.lat);
      const lng = Number(unit.lng);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      const badge = resolveResponderBadgeVisual(unit.agency, unit.name, unit.status);
      const availabilityRing = badge.isAvailable
        ? 'border:2.5px solid #10B981;box-shadow:0 0 0 3px rgba(16,185,129,0.35), 0 5px 14px rgba(0,0,0,0.5);'
        : 'border:2.5px solid #F7F1EA;box-shadow:0 5px 14px rgba(0,0,0,0.5);';
      const statusDotHtml = badge.isAvailable
        ? '<span style="position:absolute;top:1px;right:1px;width:10px;height:10px;border-radius:9999px;background:#10B981;border:2px solid #F7F1EA;z-index:3;"></span>'
        : '';

      const unitIcon = L.divIcon({
        className: 'resqtrack-responder-unit-icon resqtrack-tactical-pointer',
        html: `
          <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
            ${statusDotHtml}
            <div style="position:relative;width:38px;height:38px;border-radius:12px;background:${badge.bgColor};${availabilityRing}display:flex;align-items:center;justify-content:center;color:#FFFFFF;transition:transform 200ms ease;">
              <svg role="img" aria-label="${badge.ariaLabel}" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45));">
                ${badge.svgMarkup}
              </svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const marker = L.marker([unit.lat, unit.lng], {
        icon: unitIcon,
        title: `${unit.name} (${badge.agencyLabel}) - ${unit.status || 'Active'}`
      });

      marker.bindTooltip(
        `<div style="text-align:left;">` +
          `<strong style="color:#670626;">${unit.name}</strong><br/>` +
          `Agency: ${unit.agency || badge.agencyLabel}<br/>` +
          `Status: <strong style="color:${badge.isAvailable ? '#047857' : '#A83B4D'};">${unit.status || 'OnDuty'}</strong>` +
        `</div>`,
        { direction: 'top', className: 'tactical-map-tooltip' }
      );

      respondersLayer.addLayer(marker);
    });
  }, [allResponderUnits]);

  // Render high-tech concentric radar sonar rings centered on active/newest incident or Katipunan cluster
  useEffect(() => {
    const radarLayer = radarRingsLayerRef.current;
    if (!radarLayer) return;

    radarLayer.clearLayers();

    const selectedTarget =
      activePointer && typeof activePointer.lat === 'number' && typeof activePointer.lng === 'number'
        ? activePointer
        : selectedIncidentId
        ? visibleIncidents.find((i) => i.id === selectedIncidentId) || null
        : null;

    const newestActiveIncident =
      selectedTarget ||
      visibleIncidents
        .filter((inc) => {
          const lat = Number(inc.lat);
          const lng = Number(inc.lng);
          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return false;
          const lifecycle = computePinLifecycle(inc, tickNow);
          return shouldPulseIncidentBeacon({
            status: inc.status,
            verifiedAt: inc.verifiedAt,
            reportedAt: inc.rawReportedAt,
            isResponded: lifecycle.isDone,
            isFixture: inc.isFixture
          }).shouldPulse;
        })
        .sort((a, b) => {
          const tsA = parseIncidentTimestampMs(a.rawReportedAt) ?? 0;
          const tsB = parseIncidentTimestampMs(b.rawReportedAt) ?? 0;
          return tsB - tsA;
        })[0] ||
      null;

    const focusIsResponded = newestActiveIncident
      ? computePinLifecycle(newestActiveIncident, tickNow).isDone
      : false;

    const focusRingColor = newestActiveIncident
      ? focusIsResponded
        ? '#10b981'
        : '#f43f5e'
      : '#10b981';

    const rings: Array<{ center: [number, number]; radius: number; weight: number; opacity: number; color: string }> =
      newestActiveIncident &&
      typeof newestActiveIncident.lat === 'number' &&
      typeof newestActiveIncident.lng === 'number'
        ? [
            {
              center: [newestActiveIncident.lat, newestActiveIncident.lng],
              radius: 115,
              weight: 2.1,
              opacity: 0.92,
              color: focusRingColor
            },
            {
              center: [newestActiveIncident.lat, newestActiveIncident.lng],
              radius: 230,
              weight: 1.8,
              opacity: 0.76,
              color: focusRingColor
            },
            {
              center: [newestActiveIncident.lat, newestActiveIncident.lng],
              radius: 360,
              weight: 1.5,
              opacity: 0.58,
              color: focusRingColor
            }
          ]
        : [
            { center: [8.51015, 123.28505], radius: 120, weight: 1.8, opacity: 0.85, color: '#10b981' },
            { center: [8.51022, 123.28663], radius: 110, weight: 1.8, opacity: 0.85, color: '#10b981' },
            { center: [8.51018, 123.28584], radius: 260, weight: 1.8, opacity: 0.7, color: '#10b981' }
          ];

    rings.forEach((r, idx) => {
      const circle = L.circle(r.center, {
        radius: r.radius,
        color: r.color,
        weight: r.weight,
        opacity: r.opacity,
        fillColor: r.color,
        fillOpacity: 0.04,
        interactive: false,
        className: `resqtrack-radar-concentric-ring resqtrack-ring-${idx}`
      });
      radarLayer.addLayer(circle);
    });
  }, [activePointer, selectedIncidentId, visibleIncidents, tickNow]);

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
          `<strong style="color:#670626;">${rUnit.unit.name}</strong> (${rUnit.unit.agency || 'Unit'})<br/>` +
          `Distance: <strong>${rUnit.distanceKm} km</strong><br/>` +
          `Est. ETA: <strong style="color:#A83B4D;">~${rUnit.etaMinutes} min</strong>` +
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

  const handleOpenClosureEvidenceClick = (inc: IncidentPinData) => {
    if (onOpenClosureEvidence) {
      onOpenClosureEvidence(inc);
    } else {
      setClosureTargetIncident(inc);
    }
  };

  const handleRequestDeployClick = (inc: IncidentPinData) => {
    if (onRequestDeploy) {
      onRequestDeploy(inc);
    } else {
      // In-place modal deployment without navigation or session drop
      setDeployTargetIncident(inc);
      setIsDeployModalOpen(true);
    }
  };

  const resolvedActivePointer = activePointer
    ? unifiedIncidents.find((i) => i.id === activePointer.id) || activePointer
    : null;

  const activeCategoryMeta = resolvedActivePointer
    ? resolvePointerCategory({
        pointerCategory: resolvedActivePointer.pointerCategory,
        category: resolvedActivePointer.category,
        type: resolvedActivePointer.type,
        title: resolvedActivePointer.title || resolvedActivePointer.place,
        severity: resolvedActivePointer.severity,
        id: resolvedActivePointer.id
      })
    : null;

  const activeLifecycle = resolvedActivePointer
    ? computePinLifecycle(resolvedActivePointer, tickNow)
    : null;

  const activeIsDone = Boolean(activeLifecycle?.isDone);
  const activeIsWorkingProgress = Boolean(activeLifecycle?.isWorkingProgress);
  const activeFadeRemainingSeconds = activeLifecycle?.remainingFadeSeconds ?? TWO_MINUTE_CLOSE_SECONDS;
  const activeDisplayPlace = resolvedActivePointer
    ? getExtractedStreetAddress(resolvedActivePointer)
    : 'Katipunan, Zamboanga del Norte';

  return (
    <div
      className={`relative w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden rounded-2xl border border-[#E9D9D0] bg-[#F7F1EA] transition-all duration-300 ${
        effectiveExpanded
          ? 'fixed inset-2 md:inset-4 z-[9999] h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)] border-2 border-[#670626] shadow-[0_24px_60px_rgba(103,6,38,0.35)]'
          : ''
      }`}
      style={
        !effectiveExpanded && height
          ? { height: typeof height === 'number' ? `${height}px` : height }
          : undefined
      }
    >
      {/* Global CSS for pulsing beacon animations & Stitch Claymorphism tooltips */}
      <style>{`
        .leaflet-marker-icon.resqtrack-tactical-pointer {
          overflow: visible !important;
        }
        @keyframes resqtrackPulseRing {
          0% { transform: scale(0.95); opacity: 0.95; }
          50% { transform: scale(1.35); opacity: 0.4; }
          100% { transform: scale(1.75); opacity: 0; }
        }
        @keyframes resqtrackWavePulse {
          0% { transform: scale(0.95); opacity: 0.92; }
          55% { opacity: 0.36; }
          100% { transform: scale(2.45); opacity: 0; }
        }
        @keyframes resqtrackBeatPulse {
          0% { transform: scale(0.96); opacity: 0.95; }
          18% { transform: scale(1.44); opacity: 0.68; }
          35% { transform: scale(1.08); opacity: 0.85; }
          52% { transform: scale(1.82); opacity: 0.42; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @keyframes resqtrackCoreBeat {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          18% { transform: scale(1.1); filter: brightness(1.14); }
          35% { transform: scale(1.02); filter: brightness(1.04); }
          52% { transform: scale(1.08); filter: brightness(1.12); }
        }
        .resqtrack-wave-ring {
          position: absolute;
          top: 0;
          left: 3px;
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          pointer-events: none;
          transform-origin: center center;
          animation: resqtrackWavePulse 1.8s cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
          z-index: 0;
        }
        .resqtrack-wave-ring--fast {
          animation-duration: 1.35s;
        }
        .resqtrack-beat-ring {
          position: absolute;
          top: 0;
          left: 3px;
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          pointer-events: none;
          transform-origin: center center;
          animation: resqtrackBeatPulse 1.8s ease-out 0.45s infinite;
          z-index: 0;
        }
        .resqtrack-beat-ring--fast {
          animation: resqtrackBeatPulse 1.35s ease-out 0.35s infinite;
        }
        .resqtrack-core-beat {
          transform-origin: center center;
          animation: resqtrackCoreBeat 1.35s ease-in-out infinite;
        }
        .resqtrack-new-badge {
          position: absolute;
          top: -9px;
          right: -8px;
          padding: 1px 5px;
          border-radius: 9999px;
          background: #DC2626;
          color: #FFFFFF;
          border: 1.5px solid #F7F1EA;
          font-family: monospace;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.06em;
          line-height: 1.2;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.55);
          pointer-events: none;
          z-index: 4;
        }
        .resqtrack-dispatch-halo {
          position: absolute;
          top: -4px;
          left: -1px;
          width: 46px;
          height: 46px;
          border-radius: 9999px;
          border: 2.5px dashed #F7F1EA;
          pointer-events: none;
          transform-origin: center center;
          animation: resqtrackPulseRing 1.8s ease-out infinite;
          z-index: 1;
        }
        @keyframes resqtrackRadarBreathe {
          0%, 100% {
            opacity: 0.88;
            stroke-opacity: 0.88;
            stroke-width: 1.8px;
            transform: scale(0.985);
          }
          50% {
            opacity: 0.42;
            stroke-opacity: 0.42;
            stroke-width: 2.6px;
            transform: scale(1.025);
          }
        }
        .resqtrack-radar-concentric-ring {
          transform-box: fill-box;
          transform-origin: center center;
          animation: resqtrackRadarBreathe 4s ease-in-out infinite;
          pointer-events: none !important;
        }
        .resqtrack-ring-1 {
          animation-delay: 0.9s;
        }
        .resqtrack-ring-2 {
          animation-delay: 1.8s;
        }
        .leaflet-control-attribution {
          background: rgba(247, 241, 234, 0.92) !important;
          color: #670626 !important;
          font-size: 10px !important;
          padding: 3px 8px !important;
          border-radius: 6px !important;
          margin: 0 0 5px 6px !important;
          backdrop-filter: blur(4px) !important;
          border: 1px solid #E9D9D0 !important;
        }
        .leaflet-control-attribution a {
          color: #A83B4D !important;
          text-decoration: none !important;
        }
        .tactical-map-tooltip {
          background: #F7F1EA !important;
          border: 1.5px solid #E9D9D0 !important;
          color: #3B1722 !important;
          font-family: monospace !important;
          font-size: 11px !important;
          border-radius: 10px !important;
          padding: 6px 10px !important;
          box-shadow: 0 10px 24px rgba(103, 6, 38, 0.22) !important;
        }
        .tactical-map-tooltip::before {
          border-top-color: #E9D9D0 !important;
        }
        .resqtrack-tactical-pointer,
        .leaflet-marker-icon {
          overflow: visible !important;
          transition: transform 1.2s cubic-bezier(0.25, 1, 0.5, 1) !important;
        }
        .leaflet-zoom-anim .resqtrack-tactical-pointer,
        .leaflet-zoom-anim .leaflet-marker-icon {
          transition: transform 0.25s cubic-bezier(0, 0, 0.25, 1) !important;
        }
        .tactical-modal-scroll {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .tactical-modal-scroll::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
        }
      `}</style>

      {/* Top RHU Medic Radar HUD Overlay */}
      {showMedicHud && (
        <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 pointer-events-none">
          <div className="clay-surface flex items-center gap-1.5 bg-[#F7F1EA]/95 border border-[#E9D9D0] backdrop-blur-md px-2 py-1.5 rounded-xl shadow-[0_10px_24px_-6px_rgba(103,6,38,0.22),inset_0_2px_4px_rgba(255,255,255,0.85)] pointer-events-auto">
            <button
              type="button"
              onClick={() => setSortMode((prev) => (prev === 'ALL' ? 'FOR_MEDICS' : 'ALL'))}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer ${
                sortMode === 'FOR_MEDICS'
                  ? 'bg-[#670626] text-[#F7F1EA] shadow-sm'
                  : 'bg-[#E9D9D0]/80 text-[#670626] hover:bg-[#DFC9BE]'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>{sortMode === 'FOR_MEDICS' ? 'MEDICS ONLY (7)' : 'ALL (16)'}</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePaleNonMedic}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                pointerSettings.paleNonMedicEnabled
                  ? 'bg-amber-100 border-amber-400 text-amber-900'
                  : 'bg-[#E9D9D0]/80 border-[#D4B8AA] text-[#670626] hover:bg-[#DFC9BE]'
              }`}
              title="Toggle pale non-medic pointers"
            >
              {pointerSettings.paleNonMedicEnabled ? (
                <EyeOff className="w-3 h-3 text-amber-700" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              <span>PALE: {pointerSettings.paleNonMedicEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLegendDrawer((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#E9D9D0]/80 hover:bg-[#DFC9BE] text-[#670626] border border-[#D4B8AA] flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3 h-3 text-[#A83B4D]" />
              <span>LEGEND</span>
            </button>
          </div>
        </div>
      )}

      {/* 16 Pointer Categories Legend Drawer */}
      {showLegendDrawer && (
        <div className="clay-surface absolute top-16 right-3 z-[405] w-80 max-h-[75%] overflow-y-auto bg-[#F7F1EA]/95 border border-[#E9D9D0] rounded-2xl p-3.5 shadow-[0_18px_40px_-10px_rgba(103,6,38,0.28)] backdrop-blur-md space-y-3 text-[#3B1722]">
          <div className="flex items-center justify-between border-b border-[#E9D9D0] pb-2">
            <span className="text-sm font-extrabold uppercase tracking-wider text-[#670626]">
              16 Radar Pointer Categories
            </span>
            <button
              type="button"
              onClick={() => setShowLegendDrawer(false)}
              className="p-1 rounded-lg text-[#7A4E59] hover:text-[#670626] hover:bg-[#E9D9D0]/60 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">
              7 Medic-Allowed Categories (Deployable)
            </div>
            {RADAR_POINTER_CATEGORIES.filter((c) => c.isMedicAllowed).map((c) => {
              const IconComp = c.icon;
              return (
                <div
                  key={c.code}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[#E9D9D0]/60 border border-[#D8C1B5] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    >
                      <IconComp className="w-3 h-3" />
                    </span>
                    <span className="text-[#3B1722] font-medium truncate">{c.label}</span>
                  </div>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                    MEDIC
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#E9D9D0]">
            <div className="text-xs font-mono uppercase tracking-wider text-amber-800 font-bold">
              9 View-Only Non-Medic Categories (Pale)
            </div>
            {RADAR_POINTER_CATEGORIES.filter((c) => !c.isMedicAllowed).map((c) => {
              const IconComp = c.icon;
              return (
                <div
                  key={c.code}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[#E9D9D0]/45 border border-[#E9D9D0] text-xs opacity-90"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    >
                      <IconComp className="w-3 h-3" />
                    </span>
                    <span className="text-[#5C313E] truncate">{c.label}</span>
                  </div>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#E9D9D0] text-[#670626] font-bold">
                    VIEW ONLY
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#E9D9D0] flex items-center gap-2 text-xs text-emerald-800 font-mono font-bold">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block"
              style={{ backgroundColor: RESPONDED_GREEN_COLOR }}
            />
            <span>GREEN POINTER = Mark as Done (2-Min Fade)</span>
          </div>
        </div>
      )}

      {/* Tactical Cloud Message Box Callout (Speech bubble pointing directly at the UI pointer icon) */}
      {resolvedActivePointer && activeCategoryMeta && calloutPoint && (() => {
        const containerW = mapContainerRef.current?.clientWidth || 700;
        const containerH = mapContainerRef.current?.clientHeight || 500;
        const isCompactMinimap = isMinimapProp || containerH < 440 || containerW < 460;

        // Fluid responsive sizing tailored to device width & zoom
        const cardW = isCompactMinimap
          ? Math.min(290, containerW - 20)
          : isMobile
          ? Math.min(310, containerW - 24)
          : isTablet
          ? Math.min(350, containerW - 32)
          : Math.min(400, Math.max(345, Math.round(containerW * 0.38)));
        const halfW = cardW / 2;

        const rawX = calloutPoint.x;
        const rawY = calloutPoint.y;
        const safeMargin = 12;

        const cardMaxH = Math.max(160, containerH - safeMargin * 2);
        const targetCardH = isCompactMinimap
          ? Math.min(250, cardMaxH)
          : Math.min(450, cardMaxH);

        const clampX = Math.round(containerW / 2);
        const clampedTop = Math.max(safeMargin, Math.round((containerH - targetCardH) / 2));
        const isPlacedAbove = rawY > clampedTop + targetCardH / 2;

        const boundedDragX = Math.max(
          -clampX + halfW + safeMargin,
          Math.min(containerW - clampX - halfW - safeMargin, dragOffset.x)
        );
        const boundedDragY = Math.max(
          -clampedTop + safeMargin,
          Math.min(containerH - clampedTop - targetCardH - safeMargin, dragOffset.y)
        );

        const arrowOffset = Math.max(-halfW + 28, Math.min(halfW - 28, rawX - clampX));

        const headerAccentColor = activeIsDone
          ? RESPONDED_GREEN_COLOR
          : activeIsWorkingProgress
          ? '#0284C7'
          : activeCategoryMeta.color;

        const miniRingRadius = 8;
        const miniRingCirc = 2 * Math.PI * miniRingRadius;
        const miniRingOffset =
          miniRingCirc * (1 - Math.max(0, Math.min(1, activeFadeRemainingSeconds / TWO_MINUTE_CLOSE_SECONDS)));

        return (
          <div
            className="absolute z-[1200] pointer-events-auto transition-transform duration-75 select-none"
            style={{
              left: `${clampX}px`,
              top: `${clampedTop}px`,
              transform: `translate(calc(-50% + ${boundedDragX}px), ${boundedDragY}px)`
            }}
          >
            <div
              className="clay-surface relative bg-[#F7F1EA] border-2 border-[#670626]/70 rounded-2xl shadow-[0_18px_42px_-10px_rgba(103,6,38,0.32),inset_0_2px_4px_rgba(255,255,255,0.85)] text-[#3B1722] flex flex-col overflow-hidden animate-fadeIn"
              style={{
                width: `${cardW}px`,
                maxHeight: `${targetCardH}px`
              }}
            >
              {/* 1. FIXED DRAGGABLE HEADER */}
              <div
                {...dragHandleProps}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragHandleProps.onPointerDown(e);
                }}
                className="flex-shrink-0 px-3.5 py-2.5 border-b border-[#E9D9D0] flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none"
                title="Drag to reposition card on map"
                style={{
                  ...dragHandleProps.style,
                  background: `linear-gradient(90deg, ${headerAccentColor}1A 0%, #F7F1EA 100%)`
                }}
              >
                <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white border-2 border-[#F7F1EA] flex-shrink-0 shadow"
                    style={{ backgroundColor: headerAccentColor }}
                  >
                    {React.createElement(activeCategoryMeta.icon, { className: 'w-3.5 h-3.5' })}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#E9D9D0] border border-[#D4B8AA] text-[#670626] font-bold">
                        {resolvedActivePointer.id}
                      </span>
                      {activeIsDone ? (
                        <span className="text-[11px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white border border-emerald-500">
                          MARK AS DONE
                        </span>
                      ) : activeIsWorkingProgress ? (
                        <span className="text-[11px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-sky-600 text-white border border-amber-300">
                          WORKING PROGRESS
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                            activeCategoryMeta.isMedicAllowed
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-amber-100 border-amber-300 text-amber-900'
                          }`}
                        >
                          {activeCategoryMeta.isMedicAllowed
                            ? 'MEDIC ALLOWED'
                            : 'VIEW-ONLY (NON-MEDIC)'}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-extrabold text-[#670626] truncate mt-0.5">
                      {activeCategoryMeta.label}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="p-1 text-[#7A4E59] hover:text-[#670626]" title="Drag card">
                    <GripHorizontal className="w-4 h-4 opacity-75" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleCloseCallout(e);
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 rounded-lg text-[#7A4E59] hover:text-[#670626] hover:bg-[#E9D9D0]/70 cursor-pointer pointer-events-auto"
                    title="Close Callout"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 2. SCROLLABLE BODY */}
              <div
                className="overflow-y-auto flex-1 min-h-0 tactical-modal-scroll"
                style={{
                  maxHeight: `${cardMaxH - 52}px`
                }}
              >
              {isCompactMinimap ? (
                /* Compact Minimap Callout */
                <div className="p-2.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-1 text-xs font-mono">
                    <span className="text-[#3B1722] font-bold truncate">
                      {resolvedActivePointer.type || activeCategoryMeta.label}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                        activeIsDone
                          ? 'bg-emerald-600 text-white'
                          : activeIsWorkingProgress
                          ? 'bg-sky-600 text-white'
                          : 'bg-[#670626] text-[#F7F1EA]'
                      }`}
                    >
                      {activeIsDone
                        ? 'MARK AS DONE'
                        : activeIsWorkingProgress
                        ? 'WORKING PROGRESS'
                        : activeCategoryMeta.severityLevel}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#E9D9D0]/65 border border-[#D4B8AA] space-y-1 text-xs font-mono">
                    <div className="flex items-start gap-1 text-[#5C313E]">
                      <MapPin className="w-3 h-3 text-[#670626] shrink-0 mt-0.5" />
                      <span className="text-[#3B1722] font-semibold leading-snug">
                        {activeDisplayPlace}
                      </span>
                    </div>
                    <div className="text-emerald-800 font-bold pl-4">
                      {resolvedActivePointer.lat.toFixed(6)}, {resolvedActivePointer.lng.toFixed(6)}
                    </div>
                  </div>

                  {activeIsDone && (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2 text-xs font-mono text-emerald-900">
                      <span className="font-bold">
                        Fading from map in {formatTwoMinCountdown(activeFadeRemainingSeconds)}
                      </span>
                      <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90 shrink-0">
                        <circle cx="11" cy="11" r={miniRingRadius} fill="none" stroke="#A7F3D0" strokeWidth="2.5" />
                        <circle
                          cx="11"
                          cy="11"
                          r={miniRingRadius}
                          fill="none"
                          stroke="#059669"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray={miniRingCirc}
                          strokeDashoffset={miniRingOffset}
                        />
                      </svg>
                    </div>
                  )}

                  {(!isCivilianViewer || Boolean(onExpandMap)) && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {!isCivilianViewer && !activeIsDone && (
                        <button
                          type="button"
                          onClick={() => handleOpenClosureEvidenceClick(resolvedActivePointer)}
                          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold border bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>CLOSE CASE</span>
                        </button>
                      )}

                      {onExpandMap && (
                        <button
                          type="button"
                          onClick={onExpandMap}
                          className="py-1.5 px-2.5 rounded-lg bg-[#670626] hover:bg-[#7D0A30] text-[#F7F1EA] text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer shadow"
                          title="Enlarge map to full view"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>ENLARGE</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Full Map View Callout Body */
                <div className="p-3 space-y-2.5 text-xs">
                  {/* Picture Evidence Preview */}
                  {resolvedActivePointer.evidenceUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-[#D4B8AA] bg-[#3B1722] group">
                      <img
                        src={resolvedActivePointer.evidenceUrl}
                        alt={activeCategoryMeta.label}
                        className="w-full h-28 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#240812]/90 via-black/15 to-transparent flex flex-col justify-between p-2">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-[#F7F1EA]/95 border border-[#E9D9D0] text-xs font-mono font-bold text-[#670626]">
                            {resolvedActivePointer.reportedAt || 'Live Incident'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setLightboxOpen(true)}
                            className="px-2 py-0.5 rounded bg-[#670626] hover:bg-[#7D0A30] text-[#F7F1EA] text-xs font-mono font-bold flex items-center gap-1 cursor-pointer shadow"
                          >
                            <Camera className="w-3 h-3" />
                            <span>INSPECT</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono text-[#F7F1EA]">
                          <span className="truncate font-semibold">{resolvedActivePointer.type}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              activeIsDone
                                ? 'bg-emerald-600 text-white'
                                : activeIsWorkingProgress
                                ? 'bg-sky-600 text-white'
                                : 'bg-[#991B1B] text-white'
                            }`}
                          >
                            {activeIsDone
                              ? 'MARK AS DONE'
                              : activeIsWorkingProgress
                              ? 'WORKING PROGRESS'
                              : activeCategoryMeta.severityLevel}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#D4B8AA] bg-[#E9D9D0]/65 p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#F7F1EA] border border-[#D4B8AA] flex items-center justify-center text-[#A83B4D] shrink-0">
                          <Camera className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#3B1722] truncate">
                            {resolvedActivePointer.type || activeCategoryMeta.shortLabel}
                          </div>
                          <div className="text-xs font-mono text-[#7A4E59] truncate">
                            {resolvedActivePointer.reportedAt || 'Live Incident'}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold shrink-0 ${
                          activeIsDone
                            ? 'bg-emerald-600 text-white'
                            : activeIsWorkingProgress
                            ? 'bg-sky-600 text-white'
                            : 'bg-[#670626] text-[#F7F1EA]'
                        }`}
                      >
                        {activeIsDone
                          ? 'MARK AS DONE'
                          : activeIsWorkingProgress
                          ? 'WORKING PROGRESS'
                          : activeCategoryMeta.severityLevel}
                      </span>
                    </div>
                  )}

                  {/* Telemetry Grid */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="p-2 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5]">
                      <div className="flex items-center gap-1 text-xs font-mono uppercase text-[#7A4E59]">
                        <Cpu className="w-3 h-3 text-[#A83B4D]" />
                        <span>IP ADDRESS</span>
                      </div>
                      <div className="font-mono font-bold text-[#670626] mt-0.5 truncate text-xs">
                        {resolvedActivePointer.ipAddress || 'Direct GPS'}
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5]">
                      <div className="flex items-center gap-1 text-xs font-mono uppercase text-[#7A4E59]">
                        <Navigation className="w-3 h-3 text-emerald-700" />
                        <span>EXACT COORDS</span>
                      </div>
                      <div className="font-mono font-bold text-emerald-800 mt-0.5 truncate text-[11px]">
                        {resolvedActivePointer.lat.toFixed(6)}, {resolvedActivePointer.lng.toFixed(6)}
                      </div>
                    </div>

                    <div className="col-span-2 p-2 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5] flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-xs font-mono uppercase text-[#7A4E59]">
                          <MapPin className="w-3 h-3 text-[#670626]" />
                          <span>STREET ADDRESS</span>
                        </div>
                        <div className="font-semibold text-[#3B1722] mt-0.5 leading-snug text-xs">
                          {activeDisplayPlace}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-[#F7F1EA] border border-[#D4B8AA] text-xs font-mono font-bold text-[#670626] flex-shrink-0">
                        {activeCategoryMeta.agency}
                      </span>
                    </div>
                  </div>

                  {/* Working Progress Status Card */}
                  {activeIsWorkingProgress && !activeIsDone && (
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-300 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded bg-sky-600 text-white text-[11px] font-mono font-extrabold">
                          WORKING PROGRESS
                        </span>
                        {resolvedActivePointer.closureApprovalMode && (
                          <span className="text-[11px] font-mono font-bold text-sky-900">
                            {resolvedActivePointer.closureApprovalMode}
                          </span>
                        )}
                      </div>
                      {resolvedActivePointer.closureSummary && (
                        <p className="text-xs text-sky-950 font-medium leading-snug">
                          {resolvedActivePointer.closureSummary}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Mark as Done 2-Minute (120s) Fade Countdown & Closure Details */}
                  {activeIsDone && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <svg width="24" height="24" viewBox="0 0 22 22" className="-rotate-90 shrink-0">
                            <circle cx="11" cy="11" r={miniRingRadius} fill="none" stroke="#A7F3D0" strokeWidth="2.5" />
                            <circle
                              cx="11"
                              cy="11"
                              r={miniRingRadius}
                              fill="none"
                              stroke="#059669"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeDasharray={miniRingCirc}
                              strokeDashoffset={miniRingOffset}
                            />
                          </svg>
                          <div className="text-xs font-mono font-extrabold text-emerald-900">
                            Fading from map in {formatTwoMinCountdown(activeFadeRemainingSeconds)}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-mono font-extrabold">
                          MARK AS DONE
                        </span>
                      </div>

                      {resolvedActivePointer.closureApprovalMode && (
                        <div className="text-[11px] font-mono font-bold text-emerald-800">
                          Approval Mode: {resolvedActivePointer.closureApprovalMode}
                        </div>
                      )}

                      {resolvedActivePointer.closureSummary && (
                        <p className="text-xs text-emerald-950 font-medium leading-snug">
                          {resolvedActivePointer.closureSummary}
                        </p>
                      )}

                      {resolvedActivePointer.taggedColleagues &&
                        resolvedActivePointer.taggedColleagues.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {resolvedActivePointer.taggedColleagues.map((colleague) => (
                              <span
                                key={colleague.userId}
                                className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-mono font-semibold"
                              >
                                @{colleague.fullName}
                                {colleague.rankOrTitle ? ` · ${colleague.rankOrTitle}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Situation Details */}
                  {resolvedActivePointer.description && (
                    <div className="p-2 rounded-xl bg-[#EFE5DC]/70 border border-[#D8C1B5] text-xs text-[#3B1722] leading-snug">
                      {resolvedActivePointer.description}
                    </div>
                  )}

                  {/* Action Footer: STRICTLY HIDDEN FOR CIVILIANS */}
                  {!isCivilianViewer && (
                    <div className="pt-0.5 flex flex-col gap-1.5">
                      {!activeIsDone && (
                        <button
                          type="button"
                          onClick={() => handleOpenClosureEvidenceClick(resolvedActivePointer)}
                          className="w-full py-1.5 px-2.5 rounded-lg text-xs font-mono font-bold border bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>SUBMIT DUTY EVIDENCE / CLOSE CASE</span>
                        </button>
                      )}

                      {(!isViewerMedic || activeCategoryMeta.isMedicAllowed) ? (
                        <button
                          type="button"
                          onClick={() => handleRequestDeployClick(resolvedActivePointer)}
                          className="w-full py-2 px-3 rounded-xl bg-[#670626] hover:bg-[#7D0A30] text-[#F7F1EA] font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_18px_-4px_rgba(103,6,38,0.45)] border border-[#A83B4D]/50 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>DISPATCH UNIT</span>
                        </button>
                      ) : (
                        <div className="w-full py-1.5 px-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs font-mono font-bold flex items-center justify-center gap-1.5 text-center">
                          <Lock className="w-3.5 h-3.5 flex-shrink-0 text-amber-800" />
                          <span>NON-MEDIC // ASSIGNED TO {activeCategoryMeta.agency}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>

              {/* Cloud Message Box Caret / Tail */}
              {!isCompactMinimap && (
                <div
                  className={`absolute w-3.5 h-3.5 bg-[#F7F1EA] ${
                    isPlacedAbove
                      ? '-bottom-1.5 border-r-2 border-b-2 border-[#670626]/70'
                      : '-top-1.5 border-l-2 border-t-2 border-[#670626]/70'
                  }`}
                  style={{
                    left: `calc(50% + ${arrowOffset}px)`,
                    transform: 'translateX(-50%) rotate(45deg)'
                  }}
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* Underlying Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        role="application"
        aria-label="Satellite map of Katipunan, Zamboanga del Norte"
        className={`absolute inset-0 w-full h-full ${className || ''}`}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      />

      {/* Floating Tactical Zoom & Recenter Controls Bar */}
      {!hideZoomControls && (
        <div className="clay-surface absolute bottom-4 right-4 z-[400] flex flex-col items-center bg-[#F7F1EA]/95 border border-[#E9D9D0] backdrop-blur-md rounded-xl shadow-[0_12px_28px_-6px_rgba(103,6,38,0.28),inset_0_2px_4px_rgba(255,255,255,0.85)] p-0.5 pointer-events-auto select-none divide-y divide-[#E9D9D0]">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center text-[#670626] hover:text-[#3B1722] hover:bg-[#E9D9D0]/70 rounded-lg transition-all cursor-pointer"
            title="Zoom In (+)"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4 stroke-[2.2]" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center text-[#670626] hover:text-[#3B1722] hover:bg-[#E9D9D0]/70 rounded-lg transition-all cursor-pointer"
            title="Zoom Out (-)"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4 stroke-[2.2]" />
          </button>
          <button
            type="button"
            onClick={handleRecenterSector}
            className="w-8 h-8 flex items-center justify-center text-[#A83B4D] hover:text-[#670626] hover:bg-[#E9D9D0]/70 rounded-lg transition-all cursor-pointer"
            title="Recenter Katipunan Sector View (7109)"
            aria-label="Recenter on Katipunan Sector"
          >
            <Crosshair className="w-4 h-4 stroke-[2.2] text-[#A83B4D]" />
          </button>
          <button
            type="button"
            onClick={handleExpandMap}
            className="w-8 h-8 flex items-center justify-center text-[#670626] hover:text-[#3B1722] hover:bg-[#E9D9D0]/70 rounded-lg transition-all cursor-pointer"
            title={effectiveExpanded ? 'Minimize Map' : 'Maximize Map'}
            aria-label="Toggle map size"
          >
            {effectiveExpanded ? (
              <Minimize2 className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <Maximize2 className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>
        </div>
      )}

      {/* Multi-Media Evidence Lightbox */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={resolvedActivePointer?.evidenceUrl || null}
        images={resolvedActivePointer?.evidenceImages}
        timestamp={resolvedActivePointer?.reportedAt}
        title={
          resolvedActivePointer && activeCategoryMeta
            ? `${activeCategoryMeta.label} — ${resolvedActivePointer.id}`
            : 'Incident Evidence Inspection'
        }
      />

      {/* Tactical Multi-Agency Responder Deployment & Workload Optimization Deck */}
      <DeployRespondersModal
        isOpen={isDeployModalOpen}
        onClose={() => {
          setIsDeployModalOpen(false);
          setDeployTargetIncident(null);
        }}
        incident={deployTargetIncident}
        rosterProp={responders as unknown as DutyUnit[]}
        onDeploySuccess={(unit, inc) => {
          setActivePointer((prev) =>
            prev && prev.id === inc.id
              ? {
                  ...prev,
                  status: 'Allocated',
                  allocatedUnitCode: unit.unitCode,
                  allocatedUnitId: unit.id
                }
              : prev
          );
        }}
      />

      {/* Embedded Responder Closure Evidence Modal Fallback */}
      <ResponderClosureEvidenceModal
        isOpen={Boolean(closureTargetIncident)}
        onClose={() => setClosureTargetIncident(null)}
        incident={
          closureTargetIncident
            ? buildFallbackReportItem(
                closureTargetIncident,
                getExtractedStreetAddress(closureTargetIncident)
              )
            : null
        }
        responderUnit={roleFilter}
        onSubmitted={(result) => {
          setActivePointer((prev) =>
            prev && result.report && prev.id === result.report.id
              ? {
                  ...prev,
                  status: result.report.status,
                  resolvedAt: result.report.resolvedAt || null,
                  closedAt: result.report.closedAt || null,
                  closureSummary: result.report.closureSummary || null,
                  closureApprovalMode: result.report.closureApprovalMode || result.approvalMode,
                  taggedColleagues: result.report.taggedColleagues || prev.taggedColleagues
                }
              : prev
          );
        }}
      />
    </div>
  );
};

export default SatelliteCommandMap;
