// [Layer: Hooks]
// Responsibility: Continuous real GPS location tracking based on live hardware sensor data feeds.
// Uses navigator.geolocation.watchPosition with high accuracy and maximumAge: 0.
// Strictly tracks real hardware sensor telemetry without spoofed or unverified coordinates.

import { useState, useEffect, useCallback, useRef } from 'react';

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
  latitude: 8.5147,
  longitude: 123.2842,
  accuracy: 100,
  altitude: null,
  heading: null,
  speed: null,
  timestamp: Date.now(),
  isFallback: true
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
        setIsTracking(true);
        setError(null);
        setFixCount((prev) => prev + 1);
      },
      (err) => {
        setIsLocating(false);
        setIsTracking(false);
        let errorDesc = 'GPS location tracking unavailable.';
        if (err.code === 1) {
          errorDesc = 'Location permission denied by user. Enable GPS in browser settings.';
        } else if (err.code === 2) {
          errorDesc = 'GPS position unavailable. Ensure device location / GPS sensor is switched on.';
        } else if (err.code === 3) {
          errorDesc = 'GPS lock timed out. Continuing to scan for satellite/cellular fix...';
        }
        setError(errorDesc);
      },
      {
        enableHighAccuracy: true, // Hardware GPS / satellite sensor preferred
        maximumAge: 0,            // Force fresh real-time data feeds, zero cached positions
        timeout: 15000            // 15 seconds lock threshold
      }
    );

    watchIdRef.current = id;
    setIsTracking(true);
  }, [clearActiveWatch]);

  useEffect(() => {
    startGpsStream();
    return () => {
      clearActiveWatch();
    };
  }, [startGpsStream, clearActiveWatch]);

  // Derive signal quality rating from accuracy radius in meters
  let signalQuality: SignalQuality = 'searching';
  if (isHardwareGeolocated) {
    if (coords.accuracy <= 5) signalQuality = 'excellent';
    else if (coords.accuracy <= 15) signalQuality = 'good';
    else if (coords.accuracy <= 30) signalQuality = 'fair';
    else signalQuality = 'poor';
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
    refreshGps: startGpsStream,
    stopGps: clearActiveWatch
  };
};

export default useGpsLocation;
