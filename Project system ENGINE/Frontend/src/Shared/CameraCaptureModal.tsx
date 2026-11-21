// [Layer: Shared]
// Responsibility: WebRTC live camera modal with anti-spoofing single-snap, zero-retake enforcement,
// zero file gallery upload bypass, burnt-in GPS HUD watermark, and dynamically adjusting Laplacian blurriness detection.
// Universal lambda expressions (=>).

import React, { FC, useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Check } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { useGpsLocation } from '../Hooks/useGpsLocation';
import {
  computeLaplacianVariance,
  calculateDynamicClarityThreshold,
  DEFAULT_CLARITY_THRESHOLD,
  CANVAS_WIDTH,
  CANVAS_HEIGHT
} from '@/Libs/Vision/cameraClarityHelper';

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

export const CameraCaptureModal: FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Incident Camera',
  instructionText = 'Take a live photo of the scene.'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { coords, isHardwareGeolocated, signalQuality } = useGpsLocation();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [blurrinessScore, setBlurrinessScore] = useState<number | null>(null);
  const [activeThreshold, setActiveThreshold] = useState<number>(DEFAULT_CLARITY_THRESHOLD);
  const [thresholdReasoning, setThresholdReasoning] = useState<string>(`Default: ${DEFAULT_CLARITY_THRESHOLD}`);
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
      setActiveThreshold(DEFAULT_CLARITY_THRESHOLD);
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
    ctx.fillText('RESQTRACK EVIDENCE', 24, CANVAS_HEIGHT - 58);

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
      requiresManualVerification: true, // Always enter as unverified Submitted/Pending for Responder/Admin review
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
        <p className="text-sm text-[#5C313E] leading-relaxed">{instructionText}</p>

        {/* Live Viewfinder / Single Snapshot Freeze */}
        <div className="relative aspect-video bg-[#240812] rounded-2xl overflow-hidden border-2 border-[#E9D9D0] shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] flex items-center justify-center">
          {capturedUrl ? (
            <img src={capturedUrl} alt="Captured evidence" className="w-full h-full object-cover" />
          ) : !isUsingFallback ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-[#E9D9D0] gap-2">
              <div className="w-12 h-12 rounded-full bg-[#670626]/60 border border-[#A83B4D]/50 flex items-center justify-center text-[#F7F1EA]">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#F7F1EA]">Live Camera Standby</p>
              <p className="text-xs text-[#E9D9D0]/80 max-w-xs">{cameraError || 'Hardware camera unavailable in this environment. Synthetic emergency capture active.'}</p>
            </div>
          )}

          {/* Tactical HUD Header */}
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-[#F7F1EA]/95 backdrop-blur-md rounded-lg text-xs font-mono font-bold text-[#670626] flex items-center gap-2 border border-[#E9D9D0] shadow">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            <span>GPS: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}</span>
          </div>
        </div>

        {/* Quality Assessment & Blurriness Banner */}
        {capturedUrl && (
          <div className={`p-3 rounded-xl border text-sm flex items-center justify-between ${
            isBlurry
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-base">
                {isBlurry ? (
                  <AlertTriangle className="w-4 h-4 text-amber-700 inline-block" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 inline-block" />
                )}
              </span>
              <div>
                <p className="font-semibold">
                  {isBlurry
                    ? `Low Clarity (${blurrinessScore} / ${activeThreshold})`
                    : `Clear Photo (${blurrinessScore} / ${activeThreshold})`}
                </p>
                <p className="text-xs opacity-90">
                  {isBlurry
                    ? 'Flagged for manual clarity review. Submitted pending Responder/Admin verification.'
                    : 'Clarity checked. Submitted pending Responder/Admin verification.'}
                </p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${
              isBlurry ? 'bg-amber-200/80 text-amber-950' : 'bg-emerald-200/80 text-emerald-950'
            }`}>
              {isBlurry ? 'Manual Review' : 'Pending Verify'}
            </span>
          </div>
        )}

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Action Controls - Zero Retake & Zero File Upload */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E9D9D0]">
          <Button variant="ghost" size="sm" onClick={handleDiscardAndClose}>
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            {!capturedUrl ? (
              <Button
                variant="danger"
                size="md"
                onClick={handleCaptureFrame}
                icon={<Camera className="w-5 h-5" />}
              >
                Snap Photo
              </Button>
            ) : (
              <Button
                variant="success"
                size="md"
                onClick={handleConfirmAndSend}
                icon={<Check className="w-5 h-5" />}
              >
                Accept Evidence
              </Button>
            )}
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};

export default CameraCaptureModal;
