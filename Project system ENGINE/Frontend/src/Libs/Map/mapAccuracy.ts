// [Layer: Libs/Map]
// Responsibility: High-accuracy geospatial tracking, reverse geocoding, distance matrix, and landmark reference grid
// for Katipunan, Zamboanga del Norte operational deployment and sensor geotagging.
// Strictly 100% arrow lambdas (=>), ZERO emojis, STRICT TypeScript with ZERO any.

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface LandmarkReference {
  id: string;
  name: string;
  category: 'government' | 'health' | 'fire' | 'police' | 'barangay';
  latitude: number;
  longitude: number;
  description?: string;
}

export interface BarangayReference {
  name: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

// Katipunan, Zamboanga del Norte Operational Base Coordinates (8.5147° N, 123.2842° E)
export const KATIPUNAN_BASE_COORDS: GeoCoordinate = {
  latitude: 8.5147,
  longitude: 123.2842
};

// Katipunan Reference Landmark Grid
export const KATIPUNAN_LANDMARKS: LandmarkReference[] = [
  {
    id: 'katipunan-municipal-hall',
    name: 'Katipunan Municipal Hall',
    category: 'government',
    latitude: 8.5147,
    longitude: 123.2842,
    description: 'Municipal Hall Ground Zero / Command Base'
  },
  {
    id: 'katipunan-rhu-clinic',
    name: 'Katipunan Rural Health Unit (RHU Clinic)',
    category: 'health',
    latitude: 8.5152,
    longitude: 123.2835,
    description: 'Primary Municipal Health Center & Triage Facility'
  },
  {
    id: 'bfp-katipunan-station',
    name: 'BFP Katipunan Fire Station',
    category: 'fire',
    latitude: 8.5135,
    longitude: 123.2855,
    description: 'Bureau of Fire Protection Katipunan Station'
  },
  {
    id: 'pnp-katipunan-station',
    name: 'PNP Municipal Police Station',
    category: 'police',
    latitude: 8.5139,
    longitude: 123.2848,
    description: 'Philippine National Police Municipal Precinct'
  },
  {
    id: 'brgy-daanglungsod',
    name: 'Barangay Daanglungsod',
    category: 'barangay',
    latitude: 8.5110,
    longitude: 123.3180,
    description: 'Eastern Riverbank Barangay Sector'
  },
  {
    id: 'brgy-san-antonio',
    name: 'Barangay San Antonio',
    category: 'barangay',
    latitude: 8.5080,
    longitude: 123.2910,
    description: 'Southern Highway / Agricultural Sector'
  },
  {
    id: 'brgy-uno-coastal',
    name: 'Barangay Uno (Poblacion Coastal)',
    category: 'barangay',
    latitude: 8.5180,
    longitude: 123.2820,
    description: 'Poblacion Coastal Residential Sector'
  },
  {
    id: 'brgy-dos-central',
    name: 'Barangay Dos (Poblacion Central)',
    category: 'barangay',
    latitude: 8.5130,
    longitude: 123.2830,
    description: 'Poblacion Central Commercial & Administrative Core'
  }
];

// Reference grid for Katipunan barangay matching
export const KATIPUNAN_BARANGAYS: BarangayReference[] = [
  {
    name: 'Barangay Daanglungsod',
    displayName: 'Brgy. Daanglungsod',
    latitude: 8.5110,
    longitude: 123.3180
  },
  {
    name: 'Barangay San Antonio',
    displayName: 'Brgy. San Antonio',
    latitude: 8.5080,
    longitude: 123.2910
  },
  {
    name: 'Barangay Uno (Poblacion Coastal)',
    displayName: 'Brgy. Uno (Poblacion Coastal)',
    latitude: 8.5180,
    longitude: 123.2820
  },
  {
    name: 'Barangay Dos (Poblacion Central)',
    displayName: 'Brgy. Dos (Poblacion Central)',
    latitude: 8.5130,
    longitude: 123.2830
  }
];

/**
 * Calculates great-circle Haversine distance in kilometers between two GPS points.
 * Earth radius R = 6371 km. Output formatted to 2 decimal places.
 */
export const calculateHaversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

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

/**
 * Estimates response vehicle dynamic ETA in minutes based on distance and average transit speed.
 * Default average speed: 40 km/h (Katipunan provincial road conditions).
 */
export const calculateDynamicEtaMinutes = (
  distanceKm: number,
  averageSpeedKmH = 40
): number => {
  if (distanceKm <= 0 || isNaN(distanceKm)) return 1;
  const speed = averageSpeedKmH > 0 ? averageSpeedKmH : 40;
  const hours = distanceKm / speed;
  return Math.max(1, Math.round(hours * 60));
};

/**
 * Reverse geocodes coordinates to the closest Katipunan barangay or landmark.
 * Defaults to "Katipunan, Zamboanga del Norte" if outside the municipal sector.
 */
export const getKatipunanBarangay = (lat: number, lng: number): string => {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    isNaN(lat) ||
    isNaN(lng)
  ) {
    return 'Katipunan, Zamboanga del Norte';
  }

  let nearestBarangay: BarangayReference | null = null;
  let minDistanceKm = Infinity;

  for (const brgy of KATIPUNAN_BARANGAYS) {
    const dist = calculateHaversineDistanceKm(lat, lng, brgy.latitude, brgy.longitude);
    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      nearestBarangay = brgy;
    }
  }

  // Within 12 kilometers of Katipunan municipal bounds
  if (nearestBarangay && minDistanceKm <= 12) {
    return `${nearestBarangay.displayName}, Katipunan, ZDN`;
  }

  return 'Katipunan, Zamboanga del Norte';
};

/**
 * Calculates initial compass bearing from (lat1, lon1) towards (lat2, lon2).
 * Returns 8-point compass sector: N, NE, E, SE, S, SW, W, NW.
 */
export const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): string => {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 'N';
  }

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const dLonRad = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(dLonRad) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLonRad);
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  deg = (deg + 360) % 360;

  const compassSectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const sectorIndex = Math.round(deg / 45) % 8;
  return compassSectors[sectorIndex];
};
