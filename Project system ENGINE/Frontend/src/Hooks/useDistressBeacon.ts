// [Layer: Hooks]
// Responsibility: 1-Beat-Per-Minute (1-BPM) background distress signal telemetry heartbeats.
// Pinpoints live incident coordinates via GPS/WiFi/Network sensors and streams them to the .NET 10 backend
// so tactical command maps smoothly glide and reposition the UI pointer icon without map jitter.
// Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>). Zero emojis.

import { useEffect, useRef, useState, useCallback } from 'react';
import { requestJson } from '@/Endpoints/apiClient';

export interface DistressBeaconOptions {
  readonly activeIncidentId?: string | null;
  readonly intervalMs?: number; // Defaults to 60,000ms (1 Beat Per Minute)
  readonly enabled?: boolean;
  readonly onBeaconSent?: (coords: { latitude: number; longitude: number; accuracy: number; count: number }) => void;
  readonly onError?: (err: Error) => void;
}

export interface DistressBeaconState {
  readonly isBeaconsActive: boolean;
  readonly beaconCount: number;
  readonly lastBeaconAt: number | null;
  readonly latestCoords: { latitude: number; longitude: number; accuracy: number } | null;
  readonly pingNow: () => Promise<boolean>;
}

export const useDistressBeacon = (options: DistressBeaconOptions = {}): DistressBeaconState => {
  const {
    activeIncidentId = null,
    intervalMs = 60000, // 1 BPM = 60s
    enabled = true,
    onBeaconSent,
    onError
  } = options;

  const [beaconCount, setBeaconCount] = useState<number>(0);
  const [lastBeaconAt, setLastBeaconAt] = useState<number | null>(null);
  const [latestCoords, setLatestCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const intervalRef = useRef<number | null>(null);

  const dispatchBeacon = useCallback(async (): Promise<boolean> => {
    if (!activeIncidentId) return false;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return false;

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const timestamp = position.timestamp || Date.now();

          try {
            await requestJson<{ message: string }>(`/api/reports/${activeIncidentId}/beacon`, {
              method: 'POST',
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                gpsAccuracyMeters: accuracy,
                timestamp
              })
            });

            setBeaconCount((prev) => {
              const next = prev + 1;
              if (onBeaconSent) {
                onBeaconSent({ latitude: lat, longitude: lng, accuracy, count: next });
              }
              return next;
            });
            setLastBeaconAt(Date.now());
            setLatestCoords({ latitude: lat, longitude: lng, accuracy });
            console.info(`[DistressBeacon 1-BPM] Ping #${beaconCount + 1} dispatched for incident ${activeIncidentId}: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            resolve(true);
          } catch (err: unknown) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            console.warn('[DistressBeacon] Heartbeat delivery error:', errorObj.message);
            if (onError) onError(errorObj);
            resolve(false);
          }
        },
        (geoErr) => {
          console.warn('[DistressBeacon] Sensor geolocation acquisition error:', geoErr.message);
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        }
      );
    });
  }, [activeIncidentId, beaconCount, onBeaconSent, onError]);

  useEffect(() => {
    if (!enabled || !activeIncidentId) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send immediate initial beacon ping upon incident confirmation
    void dispatchBeacon();

    // 1 Beat Per Minute heartbeat loop
    intervalRef.current = window.setInterval(() => {
      void dispatchBeacon();
    }, intervalMs);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, activeIncidentId, intervalMs, dispatchBeacon]);

  return {
    isBeaconsActive: enabled && Boolean(activeIncidentId),
    beaconCount,
    lastBeaconAt,
    latestCoords,
    pingNow: dispatchBeacon
  };
};

export default useDistressBeacon;
