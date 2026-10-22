// [Layer: Libs/Assets]
// Responsibility: Formatters for timestamps, reference codes, GPS coordinates, and relative time.
// DO NOT use non-deterministic date formats that vary by client locale.

export const formatIsoTimestamp = (isoDate?: string | null): string => {
  if (!isoDate) return 'N/A';
  try {
    const d = new Date(isoDate);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return isoDate;
  }
};

export const formatRelativeTime = (isoDate?: string | null): string => {
  if (!isoDate) return '';
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
};

export const formatGpsCoord = (lat: number, lng: number): string =>
  `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
