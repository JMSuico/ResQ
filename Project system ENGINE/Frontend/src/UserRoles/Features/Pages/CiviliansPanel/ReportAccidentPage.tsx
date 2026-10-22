// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Detailed accident report submission screen with continuous real GPS tracking feeds,
// refined stepped incident reporting flow, camera preview HUD frame with anti-spoofing verification,
// and automated multi-agency triage routing.
// ABSOLUTE INVARIANT: DO NOT touch createReport API calls, payload fields, or image base64 capture handlers.

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
  const [isResyncing, setIsResyncing] = useState(false);

  const handleCaptureComplete = (dataUrl: string, meta: CameraCaptureMetadata) => {
    setImageDataUrl(dataUrl);
    setCaptureMetadata(meta);
  };

  const handleForceResync = () => {
    setIsResyncing(true);
    refreshGps();
    setTimeout(() => setIsResyncing(false), 1200);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to transmit report.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for category agency routing preview
  const getCategoryRoutingTag = (catKey: string): { agencies: string[]; desc: string } => {
    switch (catKey) {
      case 'VehicularAccident':
        return { agencies: ['RHU (Medics)', 'PNP (Traffic)'], desc: 'Auto-dispatches trauma ambulance & traffic cordon' };
      case 'MedicalEmergency':
        return { agencies: ['RHU (Paramedics)'], desc: 'Dispatches emergency medical services' };
      case 'StructuralFire':
        return { agencies: ['BFP (Fire)', 'RHU (Triage)'], desc: 'Dispatches fire engine company & standby triage' };
      case 'CrimeOrSecurity':
        return { agencies: ['PNP (Police Patrol)'], desc: 'Dispatches sector patrol officers' };
      case 'NaturalDisaster':
        return { agencies: ['LDRRMO Command', 'RHU', 'BFP'], desc: 'Multi-agency disaster response activation' };
      case 'HazardFixture':
      default:
        return { agencies: ['LDRRMO', 'Municipal Engineering'], desc: 'Infrastructure hazard inspection & clearing' };
    }
  };

  const routingInfo = getCategoryRoutingTag(category);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-rose-600/20 text-rose-400 text-xs font-mono font-bold border border-rose-600/40 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>MUNICIPAL INCIDENT INTAKE PROTOCOL</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Report Road Incident / Emergency</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Direct emergency line to LDRRMO Command, RHU Medics, BFP Fire, and PNP Police
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/civilian/dashboard')}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono transition-colors"
        >
          ← Return to Hub
        </button>
      </div>

      {/* Stepped Incident Reporting Progress Track */}
      <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-emerald-500/30">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-[11px]">
            1
          </span>
          <div className="flex flex-col truncate">
            <span className="font-bold text-emerald-400 text-[10px] uppercase">STEP 1</span>
            <span className="text-slate-200 text-xs truncate">GPS Telemetry</span>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${imageDataUrl ? 'bg-slate-900/90 border-emerald-500/30' : 'bg-rose-950/40 border-rose-600/40'}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${imageDataUrl ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'}`}>
            {imageDataUrl ? '✓' : '2'}
          </span>
          <div className="flex flex-col truncate">
            <span className={`font-bold text-[10px] uppercase ${imageDataUrl ? 'text-emerald-400' : 'text-rose-400'}`}>STEP 2</span>
            <span className="text-slate-200 text-xs truncate">Camera HUD</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800">
          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center font-bold text-[11px]">
            3
          </span>
          <div className="flex flex-col truncate">
            <span className="font-bold text-slate-400 text-[10px] uppercase">STEP 3</span>
            <span className="text-slate-300 text-xs truncate">Classification</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-600/60 text-xs text-rose-200 flex items-center gap-3">
          <span className="text-base font-bold text-rose-400">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* STEP 1: CONTINUOUS REAL GPS HARDWARE SENSOR FEED */}
        <div className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-3.5 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isHardwareGeolocated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Step 1: Real-Time Hardware GPS Telemetry
              </h2>
            </div>
            <button
              type="button"
              onClick={handleForceResync}
              className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 hover:border-sky-500/40 transition-colors"
              title="Force sensor resynchronization"
            >
              <svg className={`w-3.5 h-3.5 ${isResyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isResyncing ? 'Resyncing...' : 'Force Resync'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase text-slate-500">Continuous Coordinates</span>
              <span className="text-sm sm:text-base font-mono font-extrabold text-emerald-400 mt-0.5">
                {coords.latitude.toFixed(6)}° N, {coords.longitude.toFixed(6)}° E
              </span>
            </div>

            <div className="flex flex-col sm:items-end justify-center">
              <span className="text-[10px] font-mono uppercase text-slate-500">Sensor Accuracy & Quality</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-slate-300">
                  ±<strong className="text-white">{Math.round(coords.accuracy)}</strong> meters
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${signalQuality === 'excellent' ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40' : 'bg-amber-950 text-amber-400 border border-amber-600/40'}`}>
                  {signalQuality}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">
              Landmark, Street, or Barangay Description <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="e.g. Near Katipunan Public Market, KM Post 284, Purok 3"
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* STEP 2: CAMERA PREVIEW HUD FRAME & ANTI-SPOOFING INDICATOR */}
        <div className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Step 2: Live Camera HUD & Anti-Spoofing Evidence
              </h2>
            </div>
            <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-600/30">
              NO GALLERY UPLOAD
            </span>
          </div>

          {/* Anti-Spoofing Protocol Directive Callout */}
          <div className="p-3 rounded-xl bg-slate-950 border border-rose-900/40 flex items-start gap-3 text-xs">
            <div className="w-7 h-7 rounded-lg bg-rose-950/80 border border-rose-600/40 flex items-center justify-center text-rose-400 font-bold flex-shrink-0 mt-0.5">
              🛡️
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-xs">Anti-Spoofing Hardware Policy Enforced</span>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Pre-recorded gallery image uploads are permanently prohibited to prevent fabricated reports. Only authentic live WebRTC camera frames with embedded coordinates watermark and Laplacian clarity scoring are accepted.
              </p>
            </div>
          </div>

          {/* Camera Viewfinder / Preview HUD Frame */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
            {imageDataUrl ? (
              /* Captured Image in HUD Frame */
              <div className="relative w-full sm:w-64 h-44 rounded-xl overflow-hidden border-2 border-emerald-500/80 shadow-lg shadow-emerald-950/40 flex-shrink-0 group">
                <img src={imageDataUrl} alt="Captured emergency scene" className="w-full h-full object-cover" />

                {/* HUD Corner Targeting Brackets */}
                <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
                <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
                <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400 pointer-events-none" />
                <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400 pointer-events-none" />

                {/* HUD Watermark Overlay */}
                <div className="absolute top-0 inset-x-0 bg-slate-950/80 px-2 py-1 text-[9px] font-mono text-emerald-300 flex items-center justify-between border-b border-emerald-500/30">
                  <span>LAT {coords.latitude.toFixed(4)}° LNG {coords.longitude.toFixed(4)}°</span>
                  <span>±{Math.round(coords.accuracy)}m</span>
                </div>

                {captureMetadata?.isBlurry ? (
                  <div className="absolute bottom-1 left-1 right-1 px-2 py-1 bg-amber-950/90 text-amber-300 text-[10px] font-mono font-bold rounded border border-amber-500/60 flex items-center gap-1.5">
                    <span>⚠️ BLUR SCORE: {captureMetadata.varianceScore.toFixed(1)}</span>
                    <span className="text-[9px] text-amber-400 truncate">(Manual Review)</span>
                  </div>
                ) : (
                  <div className="absolute bottom-1 left-1 right-1 px-2 py-1 bg-emerald-950/90 text-emerald-300 text-[10px] font-mono font-bold rounded border border-emerald-500/60 flex items-center gap-1.5">
                    <span>✓ CLARITY PASS: {captureMetadata?.varianceScore.toFixed(1)}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Empty HUD Viewfinder Placeholder */
              <div className="relative w-full sm:w-64 h-44 rounded-xl bg-slate-900 border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-4 text-center flex-shrink-0">
                {/* Tactical Reticle */}
                <div className="w-12 h-12 rounded-full border border-rose-500/40 flex items-center justify-center mb-2">
                  <div className="w-6 h-6 border-t-2 border-b-2 border-rose-500/70 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-300">Live Camera Standby</span>
                <span className="text-[10px] text-slate-500 mt-1">Tap button below to launch live camera</span>
              </div>
            )}

            {/* Action Buttons & Status Feed */}
            <div className="flex flex-col gap-3 w-full">
              {!imageDataUrl ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-rose-950/60 active:scale-[0.98] transition-all"
                  >
                    <svg className="w-5 h-5 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <circle cx="12" cy="13" r="3" strokeWidth="2.2" />
                    </svg>
                    <span>Activate Live Emergency Camera</span>
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Your camera stream will embed an indelible cryptographic GPS watermark into the image buffer.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ✓ Tamper-proof evidence snapshot locked
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {captureMetadata?.isBlurry ? (
                      <span className="text-amber-300">
                        Notice: Image flagged with low clarity score (variance {captureMetadata.varianceScore.toFixed(1)} &lt; threshold {captureMetadata.dynamicThreshold.toFixed(1)}). It will be marked for LDRRMO Manual Verification while dispatches proceed immediately.
                      </span>
                    ) : (
                      <span className="text-emerald-300">
                        Optimal optical clarity verified (score: {captureMetadata?.varianceScore.toFixed(1)}). Clear evidence ready for instant responder triage.
                      </span>
                    )}
                  </p>

                  <span className="text-[10px] font-mono text-slate-500">
                    Single-snap anti-spoofing policy is locked to preserve evidence integrity.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEP 3: INCIDENT CLASSIFICATION & URGENCY DETAILS */}
        <div className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Step 3: Incident Classification & Triage
              </h2>
            </div>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-600/30">
              DISPATCH ROUTING
            </span>
          </div>

          {/* Headline */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Incident Headline / Summary <span className="text-rose-500">*</span></span>
              <span className="text-[11px] text-slate-500 font-normal">Brief summary for dispatcher HUD</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Motorcycle collision along National Hwy, head trauma sustained"
              required
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Category & Severity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-200">Incident Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>

              {/* Dynamic Agency Routing Tag */}
              <div className="mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono">
                <span className="text-slate-400">Routes to: </span>
                <span className="text-sky-400 font-bold">{routingInfo.agencies.join(', ')}</span>
                <p className="text-slate-500 text-[9px] mt-0.5">{routingInfo.desc}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-200">Perceived Severity Tier</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="Critical">🔴 Critical (Immediate Danger / Severe Trauma)</option>
                <option value="High">🟠 High (Injuries / Fire Hazard / Road Block)</option>
                <option value="Medium">🟡 Medium (Assistance Required / Stable)</option>
                <option value="Low">🟢 Low (Minor Collision / Advisory)</option>
              </select>

              <div className="mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                {severity === 'Critical' && <span className="text-rose-400">🚨 Triggers siren alert across municipal dispatch terminals</span>}
                {severity === 'High' && <span className="text-orange-400">⚠️ Dispatches field unit within 3 minutes</span>}
                {severity === 'Medium' && <span className="text-amber-400">🟡 Queued for active response unit dispatch</span>}
                {severity === 'Low' && <span className="text-emerald-400">🟢 Logged in community registry for monitoring</span>}
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-200">
              Field Observations / Urgent Details <span className="text-slate-500">(Optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Describe injuries, persons trapped, fuel leakage, smoke, or traffic congestion..."
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 leading-relaxed"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            variant="danger"
            size="lg"
            isLoading={isLoading}
            className="w-full !py-4 font-black uppercase tracking-wider text-sm shadow-xl shadow-rose-950/80 rounded-xl"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          >
            Transmit Emergency Report to Command
          </Button>

          <p className="text-center text-[11px] font-mono text-slate-500">
            Emergency reports are broadcast in real-time to LDRRMO Municipal Command and active units.
          </p>
        </div>
      </form>

      {/* Emergency Camera Capture Modal */}
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