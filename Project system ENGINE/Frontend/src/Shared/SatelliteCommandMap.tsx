// [Layer: Shared]
// Responsibility: Interactive Leaflet satellite command map with 16 Tactical Incident Pointer Categories,
// RHU Medic vs Non-Medic role filtering, Pale Non-Medic Pointer mode, Dynamic Centered Pointer Modal,
// IP Address + GPS + Street Address + Picture Evidence display, and 5-Minute Verification Loading Timer.
// Universal lambda expressions (=>). 100% pure Lucide icons (zero emojis).

import React, { FC, useEffect, useRef, useState, useMemo } from 'react';
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
  ShieldAlert,
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
  selectedIncidentId,
  onSelectIncident,
  onRequestDeploy,
  onExpandMap,
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

  const [sortMode, setSortMode] = useState<'ALL' | 'FOR_MEDICS'>('ALL');
  const [pointerSettings, setPointerSettings] = useState(() => getMedicPointerSettings());
  const [showLegendDrawer, setShowLegendDrawer] = useState<boolean>(false);
  const [isExpandedFullscreen, setIsExpandedFullscreen] = useState<boolean>(false);
  const [activePointer, setActivePointer] = useState<IncidentPinData | null>(null);
  const [respondedIds, setRespondedIds] = useState<Record<string, boolean>>({});
  const [verifiedTimestamps, setVerifiedTimestamps] = useState<Record<string, number>>({});
  const [tickNow, setTickNow] = useState<number>(() => Date.now());
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

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

  // Merge `incidents` and `markers` into a unified enriched list with 16-category resolution
  const unifiedIncidents: Array<IncidentPinData & { categoryMeta: RadarPointerCategoryMeta }> =
    useMemo(() => {
      const combined: IncidentPinData[] = [...incidents];

      markers.forEach((m) => {
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
            description: m.description
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

      // Hide pointer once 5-minute verification countdown completes (00:00 -> 100% solved)
      if (verifiedStart) {
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

    const circlesLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);
    accuracyCirclesLayerRef.current = circlesLayer;
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

  // Render 16-category pointers onto Leaflet layer
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

      const pinIcon = L.divIcon({
        className: 'resqtrack-tactical-pointer',
        html: `
          <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;${paleStyle};transition:all 200ms ease;">
            <span style="position:absolute;inset:0;border-radius:9999px;background:${pointerBgColor};opacity:0.28;transform:scale(1.25);"></span>
            <div style="position:relative;width:32px;height:32px;border-radius:9999px;background:${pointerBgColor};border:2px solid #ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;color:#ffffff;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                ${meta.svgPathMarkup}
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
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
  }, [visibleIncidents, pointerSettings.paleNonMedicEnabled, respondedIds]);

  const handleTogglePaleNonMedic = () => {
    const updated = saveMedicPointerSettings({
      paleNonMedicEnabled: !pointerSettings.paleNonMedicEnabled
    });
    setPointerSettings(updated);
  };

  const handleExpandMap = () => {
    if (onExpandMap) {
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
      className={`relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 ${
        isExpandedFullscreen ? 'fixed inset-3 z-50 h-[calc(100vh-1.5rem)]' : ''
      }`}
      style={
        !isExpandedFullscreen && height
          ? { height: typeof height === 'number' ? `${height}px` : height }
          : undefined
      }
    >
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
              {isExpandedFullscreen ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
              <span>{isExpandedFullscreen ? 'EXIT FULL MAP' : 'EXPAND MAP'}</span>
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

      {/* Dynamic Centered Pointer Summary Modal (Tasks 6 & 7) */}
      {activePointer && activeCategoryMeta && (
        <div className="absolute inset-0 z-[410] flex items-center justify-center p-4 pointer-events-none">
          <div className="w-full max-w-md bg-slate-950/95 border-2 border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden pointer-events-auto animate-fadeIn">
            {/* Modal Top Header */}
            <div
              className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2"
              style={{
                background: `linear-gradient(90deg, ${
                  activeIsResponded ? RESPONDED_GREEN_COLOR : activeCategoryMeta.color
                }26 0%, rgba(15,23,42,0.95) 100%)`
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white border border-white/80 flex-shrink-0 shadow"
                  style={{
                    backgroundColor: activeIsResponded
                      ? RESPONDED_GREEN_COLOR
                      : activeCategoryMeta.color
                  }}
                >
                  {React.createElement(activeCategoryMeta.icon, { className: 'w-4 h-4' })}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300">
                      {activePointer.id}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
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
                  <h4 className="text-xs sm:text-sm font-extrabold text-white truncate mt-0.5">
                    {activeCategoryMeta.label}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePointer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Picture Evidence + IP Address + GPS + Physical Street Address */}
            <div className="p-4 space-y-3">
              {/* Picture Evidence Preview */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black group">
                <img
                  src={activePointer.evidenceUrl || DEFAULT_EVIDENCE_PHOTO}
                  alt={activeCategoryMeta.label}
                  className="w-full h-36 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-between p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-black/75 border border-slate-700 text-[10px] font-mono text-emerald-300">
                      {activePointer.reportedAt || formatDateTimeWithSecondsAmPm(new Date())}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="px-2 py-1 rounded bg-sky-600/90 hover:bg-sky-500 text-white text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer shadow"
                    >
                      <Camera className="w-3 h-3" />
                      <span>INSPECT (UP TO 40 MEDIA)</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-200">
                    <span className="truncate font-semibold">{activePointer.type}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        activeIsResponded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {activeIsResponded ? 'RESPONDED (GREEN)' : activeCategoryMeta.severityLevel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Telemetry Grid: IP Address, GPS Coordinates, Physical Street Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                    <span>REPORTER IP ADDRESS</span>
                  </div>
                  <div className="font-mono font-bold text-sky-300 mt-0.5">
                    {activePointer.ipAddress || '192.168.42.118'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                    <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    <span>EXACT GPS TELEMETRY</span>
                  </div>
                  <div className="font-mono font-bold text-emerald-300 mt-0.5">
                    {activePointer.lat.toFixed(5)}° N, {activePointer.lng.toFixed(5)}° E
                  </div>
                </div>

                <div className="sm:col-span-2 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      <span>PHYSICAL STREET ADDRESS & POINTER LINK</span>
                    </div>
                    <div className="font-semibold text-slate-100 mt-0.5 truncate">
                      {activePointer.place || 'Katipunan National Highway, Zamboanga del Norte'}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-slate-300 flex-shrink-0">
                    {activeCategoryMeta.agency}
                  </span>
                </div>
              </div>

              {/* 5-Minute Verification Loading Timer (05:00 -> 00:00 Case Closed) */}
              <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-300">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {activeVerifiedTimestamp
                        ? activeRemainingSeconds > 0
                          ? `VERIFICATION LOADING TIMER: ${formatCountdownMmSs(activeRemainingSeconds)}`
                          : 'CASE CLOSED (100% SOLVED)'
                        : '5-MINUTE VERIFICATION TIMER (05:00)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTriggerVerificationTimer(activePointer.id)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/90 hover:bg-amber-900 text-amber-300 border border-amber-600/60 cursor-pointer"
                  >
                    {activeVerifiedTimestamp ? 'Reset Timer' : 'Simulate AI/Admin Verify'}
                  </button>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 transition-all duration-500"
                    style={{
                      width: `${activeVerifiedTimestamp ? activeProgressPercent : 12}%`
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {activeVerifiedTimestamp
                    ? 'Verified by Admin/AI — Pointer auto-closes and clears from radar when 05:00 reaches 00:00.'
                    : 'Waiting for Admin/AI Verification to start 05:00 case-closure countdown.'}
                </p>
              </div>

              {/* Action Footer: Role-Gated "REQUEST TO DISPATCH OR DEPLOY" */}
              <div className="pt-1 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkResponded(activePointer.id)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeIsResponded
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {activeIsResponded ? 'RESPONDED (GREEN PIN)' : 'MARK RESPONDED (GREEN)'}
                    </span>
                  </button>
                </div>

                {activeCategoryMeta.isMedicAllowed ? (
                  <button
                    type="button"
                    onClick={() => handleRequestDeployClick(activePointer)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/70 border border-emerald-400/50 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>REQUEST TO DISPATCH OR DEPLOY</span>
                  </button>
                ) : (
                  <div className="w-full py-2 px-3 rounded-xl bg-slate-900/90 border border-amber-700/50 text-amber-300 text-[11px] font-mono flex items-center justify-center gap-2 text-center">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                    <span>
                      VIEW-ONLY NON-MEDIC CATEGORY — ASSIGNED TO {activeCategoryMeta.agency}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Multi-Media Evidence Lightbox (Up to 40 Captures with Seconds & AM/PM) */}
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
