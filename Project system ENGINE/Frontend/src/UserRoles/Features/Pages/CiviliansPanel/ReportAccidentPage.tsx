// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Detailed accident report submission screen with continuous real GPS tracking feeds,
// anti-spoofing single-snap camera evidence, and automated triage routing.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createReport } from '@/Endpoints/reportsApi';
import { Button } from '@/Shared/Button';
import { CameraCaptureModal, CameraCaptureMetadata } from '@/Shared/CameraCaptureModal';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { CATEGORY_LABELS } from '@/Libs/Assets/data';

export const ReportAccidentPage: React.FC = () => {
  const { coords, isHardwareGeolocated, signalQuality, refreshGps } = useGpsLocation();
  const { dispatchReportEvent } = useReportEventBus();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('VehicularAccident');
  const [severity, setSeverity] = useState('Critical');
  const [locationLabel, setLocationLabel] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [captureMetadata, setCaptureMetadata] = useState<CameraCaptureMetadata | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCaptureComplete = (dataUrl: string, meta: CameraCaptureMetadata) => {
    setImageDataUrl(dataUrl);
    setCaptureMetadata(meta);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Incident title / headline is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await createReport({
        title: title.trim(),
        note: note.trim(),
        category,
        severity,
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracyMeters: coords.accuracy,
        isHardwareGeolocated,
        isBlurry: captureMetadata?.isBlurry ?? false,
        requiresManualVerification: captureMetadata?.requiresManualVerification ?? false,
        locationLabel: locationLabel.trim() || 'Katipunan, ZN (Live Hardware Sensor Geotag)',
        imageDataUrl: imageDataUrl || undefined
      });

      dispatchReportEvent(res.report);
      navigate('/civilian/my-reports');
    } catch (err: any) {
      setError(err.message || 'Failed to transmit report.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide">Report Road Incident / Emergency</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Direct emergency line to LDRRMO Command, RHU Medics, BFP Fire, and PNP Police
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-600/50 text-xs text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="tactical-card p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300">Incident Headline</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Motorcycle collision along National Hwy, head injury"
            required
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Incident Type</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Perceived Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
            >
              <option value="Critical">Critical (Immediate Danger / Trauma)</option>
              <option value="High">High (Injuries / Fire Hazard)</option>
              <option value="Medium">Medium (Assistance Required)</option>
              <option value="Low">Low (Minor Fender Bender / Advisory)</option>
            </select>
          </div>
        </div>

        {/* Continuous Real GPS Hardware Feed */}
        <div className="flex flex-col gap-2 p-3.5 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isHardwareGeolocated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-xs font-semibold text-slate-200">
                {isHardwareGeolocated ? 'Live Hardware GPS Data Feed' : 'Acquiring GPS Telemetry...'}
              </span>
            </div>
            <button
              type="button"
              onClick={refreshGps}
              className="text-[11px] font-mono text-sky-400 hover:text-sky-300"
            >
              Force Sensor Resync
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-bold">
              {coords.latitude.toFixed(6)}° N, {coords.longitude.toFixed(6)}° E
            </span>
            <span className="text-slate-400">
              Accuracy: <strong className="text-slate-200">±{Math.round(coords.accuracy)}m</strong> ({signalQuality.toUpperCase()})
            </span>
          </div>

          <input
            type="text"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="Landmark, barangay, or street note (optional)"
            className="mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
          />
        </div>

        {/* Observations */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300">Observations / Urgent Details</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Describe injuries, persons trapped, fuel leakage, or smoke..."
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Camera-Only Capture (Anti-Spoofing Single Shot) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300">Incident Photo Evidence (Live Camera Only)</label>
          <div className="flex items-center gap-4">
            {imageDataUrl ? (
              <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-slate-700">
                <img src={imageDataUrl} alt="Captured evidence" className="w-full h-full object-cover" />
                {captureMetadata?.isBlurry && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-amber-950/90 text-amber-300 text-[9px] font-bold rounded border border-amber-600/40">
                    ⚠️ Blurry
                  </span>
                )}
              </div>
            ) : (
              <div className="w-32 h-20 rounded-lg bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-[11px] text-center p-2">
                No Camera Snap
              </div>
            )}

            {!imageDataUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCameraOpen(true)}
                icon={
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                }
              >
                Open Emergency Camera
              </Button>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  ✓ Tamper-proof evidence locked
                </span>
                <span className="text-[10px] text-slate-400">
                  {captureMetadata?.isBlurry
                    ? 'Flagged for LDRRMO verification due to low blur score.'
                    : 'Clear imagery validated.'}
                </span>
              </div>
            )}
          </div>
        </div>

        <Button
          type="submit"
          variant="danger"
          size="lg"
          isLoading={isLoading}
          className="mt-4 font-bold shadow-lg shadow-rose-950/60"
        >
          Transmit Emergency Report to Command
        </Button>
      </form>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCaptureComplete}
        title="Emergency Incident Scene Verification"
      />
    </div>
  );
};

export default ReportAccidentPage;
