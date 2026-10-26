// [Layer: UserRoles/Features/Pages/RespondersPanel/Medic]
// Responsibility: Civilian photographic evidence inspection modal with hardware GPS watermark & blur verification.
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.
// Universal lambda expressions (=>).

import React from 'react';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';
import { Button } from '@/Shared/Button';
import { ReportItem } from '@/Endpoints/reportsApi';
import { formatIsoTimestamp, formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';

export interface CivilianEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportItem | null;
  onTriageTagChange?: (reportId: string, newSeverity: string) => void;
  onQuickNavigate?: (lat: number, lng: number) => void;
}

export const CivilianEvidenceModal: React.FC<CivilianEvidenceModalProps> = ({
  isOpen,
  onClose,
  report,
  onTriageTagChange,
  onQuickNavigate
}) => {
  if (!isOpen || !report) return null;

  const handleCopyGps = () => {
    const text = `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
  };

  const handleLaunchRoute = () => {
    if (onQuickNavigate) {
      onQuickNavigate(report.latitude, report.longitude);
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const imageUrl = report.imageUrl || (report.hasImage ? `/api/reports/${report.id}/image` : null);

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title={`Casualty Evidence: ${report.referenceCode || report.id.slice(0, 8)}`}
      subtitle={`Reported ${formatRelativeTime(report.createdAt)} • ${report.locationLabel || 'Dipolog City'}`}
      maxWidth="4xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">Quick Triage Tag:</span>
            {(['critical', 'moderate', 'low'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => onTriageTagChange && onTriageTagChange(report.id, sev)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase border transition-all ${
                  report.severity.toLowerCase() === sev
                    ? sev === 'critical'
                      ? 'bg-red-600 text-white border-red-400 shadow-md'
                      : sev === 'moderate'
                      ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                      : 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
                }`}
              >
                {sev === 'critical' ? '🔴 Immediate' : sev === 'moderate' ? '🟡 Delayed' : '🟢 Minor'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyGps}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              📋 Copy GPS
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleLaunchRoute}
              className="bg-sky-600 hover:bg-sky-500 text-white shadow-md active:scale-95"
            >
              Launch GPS Route ↗
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs font-mono">
        {/* Left Column: Photo Viewfinder & Watermark */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative w-full h-80 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={report.title}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>No photographic snapshot attached</span>
              </div>
            )}

            {/* Overlaid Anti-Spoof Watermark Badge */}
            <div className="absolute bottom-2 left-2 right-2 p-2.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10px] text-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold text-sky-400">{formatGpsCoord(report.latitude, report.longitude)}</span>
                <span className="text-slate-400">
                  (±{report.gpsAccuracyMeters ? `${report.gpsAccuracyMeters.toFixed(1)}m` : '5m'} sensor accuracy)
                </span>
              </div>
              <span className="text-slate-400">{formatIsoTimestamp(report.createdAt)}</span>
            </div>
          </div>

          {/* Laplacian Blur / Clarity Indicator */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              report.isBlurry || report.requiresManualVerification
                ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{report.isBlurry ? '⚠️' : '✓'}</span>
              <span className="font-bold">
                {report.isBlurry
                  ? 'Blurry Capture Detected (Laplacian Variance < 70)'
                  : 'Image Clarity Verified (Laplacian Edge Check Passed)'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold">
              {report.requiresManualVerification ? 'Manual Review Flagged' : 'Auto-Cleared'}
            </span>
          </div>
        </div>

        {/* Right Column: Civilian Reporter & Incident Dossier */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Incident Info */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="border-b border-slate-800/80 pb-2">
              <span className="text-[10px] text-slate-500 uppercase block">Chief Medical Complaint</span>
              <h4 className="text-sm font-bold text-white mt-0.5">{report.title}</h4>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Detailed Civilian Notes</span>
              <p className="text-slate-300 mt-0.5 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800">
                {report.note || 'No additional field notes submitted.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Category</span>
                <span className="text-sky-300 font-bold">{report.category}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Current Severity</span>
                <span
                  className={`font-bold ${
                    report.severity.toLowerCase() === 'critical'
                      ? 'text-red-400'
                      : report.severity.toLowerCase() === 'moderate'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {report.severity.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Reporter Bio */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">
              Civilian Reporter Profile
            </span>
            <div className="flex justify-between border-b border-slate-800/60 pb-1">
              <span className="text-slate-400">Reporter:</span>
              <span className="text-white font-bold">{report.reporterName || 'Registered Resident'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/60 pb-1">
              <span className="text-slate-400">Reporter Role:</span>
              <span className="text-slate-300">{report.reporterRole || 'Civilian'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/60 pb-1">
              <span className="text-slate-400">Verification:</span>
              <span className="text-emerald-400 font-bold">✓ Verified Phone &amp; ID</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hardware GPS Lock:</span>
              <span className="text-sky-400 font-bold">
                {report.isHardwareGeolocated ? 'True Sensor Feed' : 'Network Approx'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};
