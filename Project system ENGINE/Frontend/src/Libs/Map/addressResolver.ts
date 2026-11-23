// [Layer: Libs/Map]
// Responsibility: Deterministic Katipunan, Zamboanga del Norte (7109) street & barangay address resolution
// with OSM Nominatim reverse-geocoding cache and offline geometric corridor fallback.
// Universal arrow lambdas (=>). ZERO 'any', ZERO emojis.

import { calculateHaversineDistanceKm } from './mapAccuracy';

export interface StreetCorridor {
  name: string;
  barangay: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
}

export interface BarangayAnchor {
  barangay: string;
  streetHint: string;
  lat: number;
  lng: number;
}

const MUNICIPAL_SUFFIX = 'Katipunan, Zamboanga del Norte';
const GEOCODE_STORAGE_KEY = 'resqtrack_nominatim_address_cache_v1';
const MAX_LOCAL_CACHE_ENTRIES = 200;
const NOMINATIM_TIMEOUT_MS = 4500;

const inMemoryAddressCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string>>();

const KATIPUNAN_CORRIDORS: StreetCorridor[] = [
  {
    name: 'Katipunan Municipal Boulevard',
    barangay: 'Poblacion Uno',
    minLat: 8.5142,
    maxLat: 8.5192,
    minLng: 123.2805,
    maxLng: 123.2852,
    centerLat: 8.5162,
    centerLng: 123.2831
  },
  {
    name: 'Dipolog-Sindangan National Highway',
    barangay: 'Barangay Dos',
    minLat: 8.5105,
    maxLat: 8.5150,
    minLng: 123.2810,
    maxLng: 123.2885,
    centerLat: 8.5132,
    centerLng: 123.2845
  },
  {
    name: 'Dicayas-Katipunan Highway Bridge',
    barangay: 'Barangay Uno',
    minLat: 8.5165,
    maxLat: 8.5235,
    minLng: 123.2920,
    maxLng: 123.3040,
    centerLat: 8.5195,
    centerLng: 123.2975
  },
  {
    name: 'Purok Mabini',
    barangay: 'Barangay Daanglungsod',
    minLat: 8.5065,
    maxLat: 8.5160,
    minLng: 123.3080,
    maxLng: 123.3290,
    centerLat: 8.5110,
    centerLng: 123.3180
  },
  {
    name: 'Sitio Riverside',
    barangay: 'Barangay San Antonio',
    minLat: 8.5030,
    maxLat: 8.5110,
    minLng: 123.2860,
    maxLng: 123.2995,
    centerLat: 8.5080,
    centerLng: 123.2910
  }
];

const KATIPUNAN_BARANGAY_ANCHORS: BarangayAnchor[] = [
  { barangay: 'Barangay Uno', streetHint: 'Katipunan Municipal Boulevard', lat: 8.5172, lng: 123.2825 },
  { barangay: 'Barangay Dos', streetHint: 'Dipolog-Sindangan National Highway', lat: 8.5132, lng: 123.2844 },
  { barangay: 'Barangay Daanglungsod', streetHint: 'Purok Mabini', lat: 8.5110, lng: 123.3180 },
  { barangay: 'Barangay San Antonio', streetHint: 'Sitio Riverside', lat: 8.5080, lng: 123.2910 },
  { barangay: 'Barangay Mias', streetHint: 'Mias Provincial Road', lat: 8.4985, lng: 123.2795 },
  { barangay: 'Barangay Basagan', streetHint: 'Basagan Interior Road', lat: 8.4865, lng: 123.2735 },
  { barangay: 'Barangay Seres', streetHint: 'Seres Barangay Road', lat: 8.4745, lng: 123.2685 },
  { barangay: 'Barangay Situbo', streetHint: 'Situbo Highland Trail', lat: 8.4585, lng: 123.2625 },
  { barangay: 'Barangay Miatan', streetHint: 'Miatan Access Road', lat: 8.4955, lng: 123.2985 },
  { barangay: 'Barangay Loyuran', streetHint: 'Loyuran Provincial Road', lat: 8.4825, lng: 123.2925 },
  { barangay: 'Barangay Balok', streetHint: 'Balok Barangay Road', lat: 8.4685, lng: 123.2845 }
];

const RAW_COORDINATE_PATTERN =
  /^-?\d{1,3}(?:\.\d+)?(?:\s*°\s*[NS])?\s*,\s*-?\d{1,3}(?:\.\d+)?(?:\s*°\s*[EW])?(?:\s*\([^)]*\))?$/i;

export const isRawCoordinateLabel = (label?: string | null): boolean => {
  if (!label) return true;
  const trimmed = label.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('gps:') ||
    lower === 'katipunan tactical sector' ||
    lower === 'katipunan municipal sector' ||
    lower === 'katipunan c2 area' ||
    lower === 'pending / direct gps'
  ) {
    return true;
  }

  return RAW_COORDINATE_PATTERN.test(trimmed);
};

export const resolveStreetAddressSync = (lat: number, lng: number): string => {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    (lat === 0 && lng === 0)
  ) {
    return MUNICIPAL_SUFFIX;
  }

  const key = buildCoordCacheKey(lat, lng);
  const cached = readFromCaches(key);
  if (cached) return cached;

  // 1. Check explicit Katipunan street corridor bounding polygons
  let bestCorridor: StreetCorridor | null = null;
  let bestCorridorDist = Infinity;

  for (const corridor of KATIPUNAN_CORRIDORS) {
    if (
      lat >= corridor.minLat &&
      lat <= corridor.maxLat &&
      lng >= corridor.minLng &&
      lng <= corridor.maxLng
    ) {
      const dist = calculateHaversineDistanceKm(lat, lng, corridor.centerLat, corridor.centerLng);
      if (dist < bestCorridorDist) {
        bestCorridorDist = dist;
        bestCorridor = corridor;
      }
    }
  }

  if (bestCorridor) {
    return `${bestCorridor.name}, ${bestCorridor.barangay}, ${MUNICIPAL_SUFFIX}`;
  }

  // 2. Fallback to nearest Katipunan barangay anchor within municipal perimeter (<= 18 km)
  let nearestAnchor: BarangayAnchor | null = null;
  let minDistKm = Infinity;

  for (const anchor of KATIPUNAN_BARANGAY_ANCHORS) {
    const dist = calculateHaversineDistanceKm(lat, lng, anchor.lat, anchor.lng);
    if (dist < minDistKm) {
      minDistKm = dist;
      nearestAnchor = anchor;
    }
  }

  if (nearestAnchor && minDistKm <= 18) {
    return `${nearestAnchor.streetHint}, ${nearestAnchor.barangay}, ${MUNICIPAL_SUFFIX}`;
  }

  return MUNICIPAL_SUFFIX;
};

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  residential?: string;
  highway?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  village?: string;
  hamlet?: string;
  town?: string;
  city?: string;
  municipality?: string;
  state?: string;
  province?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

const buildCoordCacheKey = (lat: number, lng: number): string =>
  `${lat.toFixed(4)},${lng.toFixed(4)}`;

const readStorageMap = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GEOCODE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) {
        clean[k] = v;
      }
    }
    return clean;
  } catch {
    return {};
  }
};

const readFromCaches = (key: string): string | null => {
  const mem = inMemoryAddressCache.get(key);
  if (mem) return mem;

  const stored = readStorageMap();
  if (stored[key]) {
    inMemoryAddressCache.set(key, stored[key]);
    return stored[key];
  }
  return null;
};

const writeToCaches = (key: string, address: string): void => {
  inMemoryAddressCache.set(key, address);
  if (typeof window === 'undefined') return;
  try {
    const stored = readStorageMap();
    stored[key] = address;
    const keys = Object.keys(stored);
    if (keys.length > MAX_LOCAL_CACHE_ENTRIES) {
      const overflow = keys.length - MAX_LOCAL_CACHE_ENTRIES;
      for (let i = 0; i < overflow; i += 1) {
        delete stored[keys[i]];
      }
    }
    window.localStorage.setItem(GEOCODE_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Ignore storage quota errors
  }
};

const formatNominatimAddress = (
  payload: NominatimResponse,
  fallbackLat: number,
  fallbackLng: number
): string => {
  const addr = payload.address;
  if (!addr) {
    return resolveStreetAddressSync(fallbackLat, fallbackLng);
  }

  const road =
    addr.road ||
    addr.pedestrian ||
    addr.footway ||
    addr.residential ||
    addr.highway ||
    addr.neighbourhood ||
    addr.hamlet;

  const barangayOrArea = addr.suburb || addr.village || addr.quarter;
  const town = addr.town || addr.municipality || addr.city;
  const province = addr.province || addr.state;

  const parts: string[] = [];
  if (road) parts.push(road.trim());
  if (barangayOrArea && !parts.includes(barangayOrArea.trim())) {
    parts.push(barangayOrArea.trim());
  }

  if (town && town.toLowerCase().includes('katipunan')) {
    parts.push('Katipunan');
    parts.push(province && province.toLowerCase().includes('zamboanga') ? province.trim() : 'Zamboanga del Norte');
  } else if (town) {
    parts.push(town.trim());
    if (province) {
      parts.push(province.trim());
    }
  } else {
    parts.push(MUNICIPAL_SUFFIX);
  }

  const formatted = parts.filter(Boolean).join(', ');
  if (!formatted || isRawCoordinateLabel(formatted)) {
    return resolveStreetAddressSync(fallbackLat, fallbackLng);
  }

  return formatted;
};

export const resolveStreetAddressAsync = async (lat: number, lng: number): Promise<string> => {
  const syncFallback = resolveStreetAddressSync(lat, lng);
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    (lat === 0 && lng === 0)
  ) {
    return syncFallback;
  }

  const key = buildCoordCacheKey(lat, lng);
  const cached = readFromCaches(key);
  if (cached) return cached;

  const existingRequest = inFlightRequests.get(key);
  if (existingRequest) return existingRequest;

  const fetchPromise = (async (): Promise<string> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId =
      controller && typeof window !== 'undefined'
        ? window.setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS)
        : null;

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lng))}&zoom=18&addressdetails=1`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        },
        signal: controller?.signal
      });

      if (!response.ok) {
        return syncFallback;
      }

      const data = (await response.json()) as NominatimResponse;
      const formatted = formatNominatimAddress(data, lat, lng);
      writeToCaches(key, formatted);
      return formatted;
    } catch {
      return syncFallback;
    } finally {
      if (timeoutId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
};
