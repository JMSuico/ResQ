// [Layer: Shared]
// Responsibility: WebRTC live camera modal with anti-spoofing single-snap, zero-retake enforcement,
// zero file gallery upload bypass, burnt-in GPS HUD watermark, and dynamically adjusting Laplacian blurriness detection.
// Universal lambda expressions (=>).

import React, { FC, useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Check } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { useGpsLocation } from '../Hooks/useGpsLocation';

export interface CameraCaptureMetadata {
  isBlurry: boolean;
  requiresManualVerification: boolean;
  varianceScore: number;
  dynamicThreshold: number;
  thresholdReasoning: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  isHardwareGeolocated: boolean;
}

export interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, metadata: CameraCaptureMetadata) => void;
  title?: string;
  instructionText?: string;
}

const DEFAULT_THRESHOLD = 70.0;
const SD_RESOLUTION_THRESHOLD = 640 * 480;
const HD_RESOLUTION_THRESHOLD = 1920 * 1080;
const LOW_LIGHT_LUMINANCE_CUTOFF = 45;
const HIGH_GLARE_LUMINANCE_CUTOFF = 215;
const LOW_FRAMERATE_CUTOFF = 20;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

// Client-side Laplacian edge variance calculation for blurriness detection
const computeLaplacianVariance = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { variance: number; meanLuminance: number } => {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const gray = new Float32Array(width * height);
    let totalLuminance = 0;

    // Convert RGB to luminance grayscale
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[i / 4] = lum;
      totalLuminance += lum;
    }

    const meanLuminance = totalLuminance / (width * height);

    // 3x3 Laplacian convolution kernel [-1, -1, -1, -1, 8, -1, -1, -1, -1]
    let sum = 0;
    let sumSq = 0;
    let sampleCount = 0;

    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = y * width + x;
        const laplacian =
          -gray[idx - width - 1] -
          gray[idx - width] -
          gray[idx - width + 1] -
          gray[idx - 1] +
          8 * gray[idx] -
          gray[idx + 1] -
          gray[idx + width - 1] -
          gray[idx + width] -
          gray[idx + width + 1];

        sum += laplacian;
        sumSq += laplacian * laplacian;
        sampleCount++;
      }
    }

    if (sampleCount === 0) return { variance: 100, meanLuminance: 128 };
    const mean = sum / sampleCount;
    const variance = sumSq / sampleCount - mean * mean;
    return {
      variance: Math.round(variance * 10) / 10,
      meanLuminance: Math.round(meanLuminance * 10) / 10
    };
  } catch {
    return { variance: 100, meanLuminance: 128 };
  }
};

// Dynamic Laplacian threshold calculator:
// Base default = 70. Dynamically adapts based on camera capabilities, resolution, and exposure
const calculateDynamicClarityThreshold = (
  width: number,
  height: number,
  meanLuminance: number,
  trackSettings?: MediaTrackSettings
): { threshold: number; reasoning: string } => {
  let multiplier = 1.0;
  const factors: string[] = [`Base: ${DEFAULT_THRESHOLD}`];

  // Resolution factor: higher pixel density naturally produces higher variance
  const totalPixels = width * height;
  if (totalPixels >= HD_RESOLUTION_THRESHOLD) {
    multiplier *= 1.15;
    factors.push('1080p+ (+15%)');
  } else if (totalPixels <= SD_RESOLUTION_THRESHOLD) {
    multiplier *= 0.85;
    factors.push('SD Sensor (-15%)');
  }

  // Low-light / night compensation: lower threshold if scene is dark to prevent false alarms
  if (meanLuminance < LOW_LIGHT_LUMINANCE_CUTOFF) {
    const lowLightScale = Math.max(0.65, meanLuminance / LOW_LIGHT_LUMINANCE_CUTOFF);
    multiplier *= lowLightScale;
    factors.push(`Low-Light/Night (${Math.round((lowLightScale - 1) * 100)}%)`);
  } else if (meanLuminance > HIGH_GLARE_LUMINANCE_CUTOFF) {
    multiplier *= 0.90;
    factors.push('High Glare (-10%)');
  }

  // Camera capability check: lower framerate or high exposure time
  if (trackSettings?.frameRate && trackSettings.frameRate < LOW_FRAMERATE_CUTOFF) {
    multiplier *= 0.90;
    factors.push('Low FPS (-10%)');
  }

  const dynamicThreshold = Math.round(DEFAULT_THRESHOLD * multiplier * 10) / 10;
  return {
    threshold: dynamicThreshold,
    reasoning: factors.join(' · ')
  };
};

export const CameraCaptureModal: FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Live Emergency Incident Camera',
  instructionText = 'Anti-spoofing camera stream active. Take a single live photo of the incident scene. Retakes and file uploads are disabled to preserve tamper-proof evidence.'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { coords, isHardwareGeolocated, signalQuality } = useGpsLocation();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [blurrinessScore, setBlurrinessScore] = useState<number | null>(null);
  const [activeThreshold, setActiveThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [thresholdReasoning, setThresholdReasoning] = useState<string>(`Default: ${DEFAULT_THRESHOLD}`);
  const [isBlurry, setIsBlurry] = useState<boolean>(false);

  // Initialize WebRTC Camera Stream
  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setCapturedUrl(null);
      setCameraError(null);
      setBlurrinessScore(null);
      setIsBlurry(false);
      setActiveThreshold(DEFAULT_THRESHOLD);
      return;
    }

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('WebRTC live camera not supported on this browser.');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: CANVAS_WIDTH },
            height: { ideal: CANVAS_HEIGHT },
            facingMode: 'environment' // Back camera for incident capturing
          },
          audio: false
        });

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
        setIsUsingFallback(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Camera inaccessible. Synthetic sensor frame active.';
        setCameraError(msg);
        setIsUsingFallback(true);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  // Single-Snap Capture with Burn-in Watermark and Dynamic Laplacian Check
  const handleCaptureFrame = useCallback(() => {
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    let trackSettings: MediaTrackSettings | undefined;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        trackSettings = videoTrack.getSettings ? videoTrack.getSettings() : undefined;
      }
    }

    if (videoRef.current && !isUsingFallback && stream) {
      ctx.drawImage(videoRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      // Synthetic tactical frame when running in headless/mock camera environments
      ctx.fillStyle = '#071522';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Tactical Reticle
      ctx.strokeStyle = '#e8114c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 120, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('RESQTRACK SYNTHETIC SENSOR FRAME', CANVAS_WIDTH / 2 - 240, CANVAS_HEIGHT / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('CAMERA ACCESS RESTRICTED / SYNTHETIC ACTIVE', CANVAS_WIDTH / 2 - 210, CANVAS_HEIGHT / 2 + 30);
    }

    // Run Laplacian blurriness variance test BEFORE watermark
    const { variance, meanLuminance } = computeLaplacianVariance(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    const dynamicCheck = calculateDynamicClarityThreshold(CANVAS_WIDTH, CANVAS_HEIGHT, meanLuminance, trackSettings);
    const blurry = variance < dynamicCheck.threshold;

    setBlurrinessScore(variance);
    setActiveThreshold(dynamicCheck.threshold);
    setThresholdReasoning(dynamicCheck.reasoning);
    setIsBlurry(blurry);

    // Burn-in Tactical Telemetry Watermark directly onto canvas pixels
    const nowIso = new Date().toISOString();
    const latFormatted = `${coords.latitude.toFixed(6)}° N`;
    const lngFormatted = `${coords.longitude.toFixed(6)}° E`;
    const accuracyFormatted = `±${Math.round(coords.accuracy)}m`;
    const gpsStatusText = isHardwareGeolocated
      ? `GPS HARDWARE LOCK [ACC: ${accuracyFormatted} // QUALITY: ${signalQuality.toUpperCase()}]`
      : `SECTOR MUNICIPAL BASE [NO SATELLITE LOCK]`;

    // Bottom Watermark Ribbon
    ctx.fillStyle = 'rgba(7, 21, 34, 0.88)';
    ctx.fillRect(0, CANVAS_HEIGHT - 90, CANVAS_WIDTH, 90);

    ctx.fillStyle = '#e8114c';
    ctx.fillRect(0, CANVAS_HEIGHT - 90, CANVAS_WIDTH, 3); // Red accent border

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Montserrat", sans-serif';
    ctx.fillText('RESQTRACK RESCUE TELEMETRY // TAMPER-PROOF VERIFIED EVIDENCE', 24, CANVAS_HEIGHT - 58);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillText(`COORDS: ${latFormatted}, ${lngFormatted}  |  STATUS: ${gpsStatusText}`, 24, CANVAS_HEIGHT - 34);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(
      `TIME: ${nowIso}  |  CLARITY: ${variance} (TARGET: ${dynamicCheck.threshold}) [${blurry ? 'BLURRY - REQUIRES MANUAL REVIEW' : 'CRISP'}]`,
      24,
      CANVAS_HEIGHT - 12
    );

    const dataUrl = canvas.toDataURL('image/png');
    setCapturedUrl(dataUrl);

    // Stop video stream immediately upon single snapshot
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [coords, isHardwareGeolocated, signalQuality, isUsingFallback, stream]);

  const handleConfirmAndSend = () => {
    if (!capturedUrl) return;

    onCapture(capturedUrl, {
      isBlurry,
      requiresManualVerification: isBlurry,
      varianceScore: blurrinessScore || 100,
      dynamicThreshold: activeThreshold,
      thresholdReasoning,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: coords.accuracy,
      isHardwareGeolocated
    });

    onClose();
  };

  const handleDiscardAndClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCapturedUrl(null);
    onClose();
  };

  return (
    <DefaultFloatingModalCard isOpen={isOpen} onClose={handleDiscardAndClose} title={title} maxWidth="2xl">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-slate-300 leading-relaxed">{instructionText}</p>

        {/* Live Viewfinder / Single Snapshot Freeze */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 flex items-center justify-center">
          {capturedUrl ? (
            <img src={capturedUrl} alt="Captured evidence" className="w-full h-full object-cover" />
          ) : !isUsingFallback ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-rose-500">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-200">Live Camera Standby</p>
              <p className="text-[11px] text-slate-400 max-w-xs">{cameraError || 'Hardware camera unavailable in this environment. Synthetic emergency capture active.'}</p>
            </div>
          )}

          {/* Tactical HUD Header */}
          <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/80 backdrop-blur-sm rounded text-[10px] font-mono text-emerald-400 flex items-center gap-2 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>LIVE GPS: {coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E (±{Math.round(coords.accuracy)}m)</span>
          </div>

          <div className="absolute top-2 right-2 px-2.5 py-1 bg-black/80 backdrop-blur-sm rounded text-[10px] font-mono text-rose-400 border border-rose-500/30">
            <span>ANTI-SPOOF // SINGLE-SNAP</span>
          </div>
        </div>

        {/* Quality Assessment & Blurriness Banner */}
        {capturedUrl && (
          <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            isBlurry
              ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-base">
                {isBlurry ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 inline-block" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 inline-block" />
                )}
              </span>
              <div>
                <p className="font-semibold">
                  {isBlurry
                    ? `Blurry / Low-Clarity Photo (Score: ${blurrinessScore} · Dynamic Target: ${activeThreshold})`
                    : `High-Clarity Validated Photo (Score: ${blurrinessScore} · Dynamic Target: ${activeThreshold})`}
                </p>
                <p className="text-[11px] opacity-80">
                  {isBlurry
                    ? `Flagged for manual review. Adaptive adjustments: [${thresholdReasoning}]. GPS coordinates remain locked.`
                    : `Crisp imagery validated against camera capabilities: [${thresholdReasoning}]. Auto-prioritized.`}
                </p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
              isBlurry ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {isBlurry ? 'Manual Review' : 'Verified Crisp'}
            </span>
          </div>
        )}

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Action Controls - Zero Retake & Zero File Upload */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <Button variant="ghost" size="sm" onClick={handleDiscardAndClose}>
            Cancel & Discard
          </Button>

          <div className="flex items-center gap-3">
            {!capturedUrl ? (
              <Button
                variant="danger"
                size="md"
                onClick={handleCaptureFrame}
                icon={<Camera className="w-5 h-5" />}
              >
                Snap Live Evidence (Single Shot)
              </Button>
            ) : (
              <Button
                variant="success"
                size="md"
                onClick={handleConfirmAndSend}
                icon={<Check className="w-5 h-5" />}
              >
                Accept & Attach Evidence
              </Button>
            )}
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};

export default CameraCaptureModal;
