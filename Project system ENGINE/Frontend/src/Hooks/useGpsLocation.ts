// [Layer: Hooks]
// Responsibility: Continuous real GPS location tracking based on live hardware sensor data feeds.
// Uses navigator.geolocation.watchPosition with high accuracy and maximumAge: 0.
// Strictly tracks real hardware sensor telemetry without spoofed or unverified coordinates.
// Conforms to 100% arrow functions (=>), zero any, and zero emojis.

import { useState, useEffect, useCallback, useRef } from 'react';
import { KATIPUNAN_BASE_COORDS } from '@/Libs/Map/mapAccuracy';

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number; // In meters (+/-)
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  isFallback: boolean;
}

export type SignalQuality = 'searching' | 'excellent' | 'good' | 'fair' | 'poor';

// Katipunan, Zamboanga del Norte Default Operational Base Coordinates
const MUNICIPAL_KATIPUNAN_COORDS: GpsCoordinates = {
  latitude: KATIPUNAN_BASE_COORDS.latitude,
  longitude: KATIPUNAN_BASE_COORDS.longitude,
  accuracy: 100,
  altitude: null,
  heading: null,
  speed: null,
  timestamp: Date.now(),
  isFallback: true
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0
};

export const useGpsLocation = () => {
  const [coords, setCoords] = useState<GpsCoordinates>(MUNICIPAL_KATIPUNAN_COORDS);
  const [isHardwareGeolocated, setIsHardwareGeolocated] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fixCount, setFixCount] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);

  const clearActiveWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const handlePositionSuccess = useCallback((pos: GeolocationPosition) => {
    const telemetry: GpsCoordinates = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp || Date.now(),
      isFallback: false
    };

    setCoords(telemetry);
    setIsHardwareGeolocated(true);
    setIsLocating(false);
    setError(null);
    setFixCount((prev) => prev + 1);
  }, []);

  const handlePositionError = useCallback((err: GeolocationPositionError, isSingleShot = false) => {
    setIsLocating(false);
    if (!isSingleShot) {
      setIsTracking(false);
    }
    let errorDesc = isSingleShot
      ? 'Single-shot GPS location acquisition failed.'
      : 'GPS location tracking unavailable.';

    if (err.code === 1) {
      errorDesc = 'Location permission denied by user. Enable GPS in browser settings.';
    } else if (err.code === 2) {
      errorDesc = 'GPS position unavailable. Ensure device location / GPS sensor is switched on.';
    } else if (err.code === 3) {
      errorDesc = 'GPS lock timed out. Continuing to scan for satellite/cellular fix...';
    }
    setError(errorDesc);
  }, []);

  const startGpsStream = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Hardware GPS Geolocation not supported on this device/browser.');
      setIsLocating(false);
      setIsHardwareGeolocated(false);
      return;
    }

    clearActiveWatch();
    setIsLocating(true);
    setError(null);

    // Continuous real GPS tracking feed using watchPosition
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        handlePositionSuccess(pos);
        setIsTracking(true);
      },
      (err) => {
        handlePositionError(err, false);
      },
      GEOLOCATION_OPTIONS
    );

    watchIdRef.current = id;
    setIsTracking(true);
  }, [clearActiveWatch, handlePositionSuccess, handlePositionError]);

  // Manual single-shot refresh to acquire an immediate position
  const refreshLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Hardware GPS Geolocation not supported on this device/browser.');
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePositionSuccess(pos);
      },
      (err) => {
        handlePositionError(err, true);
      },
      GEOLOCATION_OPTIONS
    );
  }, [handlePositionSuccess, handlePositionError]);

  useEffect(() => {
    startGpsStream();
    return () => {
      clearActiveWatch();
    };
  }, [startGpsStream, clearActiveWatch]);

  // Derive signal quality rating from accuracy radius in meters:
  // < 15m: 'excellent'
  // 15m - 50m: 'good'
  // 50m - 100m: 'fair'
  // > 100m: 'poor'
  let signalQuality: SignalQuality = 'searching';
  if (isHardwareGeolocated) {
    if (coords.accuracy < 15) {
      signalQuality = 'excellent';
    } else if (coords.accuracy <= 50) {
      signalQuality = 'good';
    } else if (coords.accuracy <= 100) {
      signalQuality = 'fair';
    } else {
      signalQuality = 'poor';
    }
  }

  const formattedCoords = `${coords.latitude.toFixed(6)}° N, ${coords.longitude.toFixed(6)}° E (±${Math.round(coords.accuracy)}m)`;

  return {
    coords,
    isHardwareGeolocated,
    isLocating,
    isTracking,
    error,
    fixCount,
    signalQuality,
    formattedCoords,
    refreshLocation,
    refreshGps: startGpsStream,
    stopGps: clearActiveWatch
  };
};

export default useGpsLocation;
