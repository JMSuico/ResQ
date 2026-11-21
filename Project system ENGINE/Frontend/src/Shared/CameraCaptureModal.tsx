// [Layer: Shared]
// Responsibility: WebRTC live camera modal with anti-spoofing single-snap, zero-retake enforcement,
// clean un-watermarked AI analysis frame capture, slim translucent telemetry badge, Laplacian clarity check,
// and real-time Roboflow + Claude Haiku 4.5 incident pre-verification indicator.
// Universal lambda expressions (=>). ZERO 'any', ZERO emojis.

import React, { FC, useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Check, RefreshCw, Sparkles } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { useGpsLocation } from '../Hooks/useGpsLocation';
import { analyzeIncidentImage, IncidentImageAiAnalysisResponse } from '@/Endpoints/reportsApi';
import {
  computeLaplacianVariance,
  calculateDynamicClarityThreshold,
  DEFAULT_CLARITY_THRESHOLD,
  CANVAS_WIDTH,
  CANVAS_HEIGHT
} from '@/Libs/Vision/cameraClarityHelper';

export type CameraCaptureAiPreview = IncidentImageAiAnalysisResponse & {
  autoApproveEligible?: boolean;
  aiVerificationStatus?: string | null;
};

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
  analysisImageDataUrl?: string;
  aiPreview?: CameraCaptureAiPreview;
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
  const isMountedOpenRef = useRef<boolean>(false);

  const { coords, isHardwareGeolocated, signalQuality } = useGpsLocation();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [cleanAnalysisUrl, setCleanAnalysisUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [blurrinessScore, setBlurrinessScore] = useState<number | null>(null);
  const [activeThreshold, setActiveThreshold] = useState<number>(DEFAULT_CLARITY_THRESHOLD);
  const [thresholdReasoning, setThresholdReasoning] = useState<string>(`Default: ${DEFAULT_CLARITY_THRESHOLD}`);
  const [isBlurry, setIsBlurry] = useState<boolean>(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);
  const [aiPreview, setAiPreview] = useState<CameraCaptureAiPreview | null>(null);

  useEffect(() => {
    isMountedOpenRef.current = isOpen;
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setCapturedUrl(null);
      setCleanAnalysisUrl(null);
      setCameraError(null);
      setBlurrinessScore(null);
      setIsBlurry(false);
      setIsAnalyzingAi(false);
      setAiPreview(null);
      setActiveThreshold(DEFAULT_CLARITY_THRESHOLD);
      return;
    }

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Live camera unavailable on this browser.');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: CANVAS_WIDTH },
            height: { ideal: CANVAS_HEIGHT },
            facingMode: 'environment'
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
        const msg = err instanceof Error ? err.message : 'Camera unavailable — synthetic frame active.';
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

  const runLiveAiPreCheck = useCallback(async (cleanDataUrl: string) => {
    setIsAnalyzingAi(true);
    setAiPreview(null);
    try {
      const res = (await analyzeIncidentImage({
        imageDataUrl: cleanDataUrl
      })) as CameraCaptureAiPreview;
      if (isMountedOpenRef.current) {
        setAiPreview(res);
      }
    } catch {
      if (isMountedOpenRef.current) {
        setAiPreview(null);
      }
    } finally {
      if (isMountedOpenRef.current) {
        setIsAnalyzingAi(false);
      }
    }
  }, []);

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
      ctx.fillStyle = '#2B010E';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = '#670626';
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

      ctx.strokeStyle = '#E9D9D0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 110, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F7F1EA';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('RESQTRACK SYNTHETIC SENSOR', CANVAS_WIDTH / 2 - 180, CANVAS_HEIGHT / 2 - 12);
      ctx.font = '15px monospace';
      ctx.fillStyle = '#E9D9D0';
      ctx.fillText('CAMERA STANDBY / SYNTHETIC FRAME', CANVAS_WIDTH / 2 - 165, CANVAS_HEIGHT / 2 + 24);
    }

    // 1. Capture clean un-watermarked pixels for AI object detection BEFORE drawing any overlay
    const cleanDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCleanAnalysisUrl(cleanDataUrl);

    // 2. Run Laplacian blurriness variance test on clean pixels
    const { variance, meanLuminance } = computeLaplacianVariance(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    const dynamicCheck = calculateDynamicClarityThreshold(CANVAS_WIDTH, CANVAS_HEIGHT, meanLuminance, trackSettings);
    const blurry = variance < dynamicCheck.threshold;

    setBlurrinessScore(variance);
    setActiveThreshold(dynamicCheck.threshold);
    setThresholdReasoning(dynamicCheck.reasoning);
    setIsBlurry(blurry);

    // 3. Burn a compact, slim translucent 36px telemetry badge on the display copy
    const nowTime = new Date().toISOString().slice(11, 19);
    const gpsTag = isHardwareGeolocated ? `GPS ${signalQuality.toUpperCase()}` : 'SECTOR GPS';
    const badgeHeight = 36;

    ctx.fillStyle = 'rgba(43, 1, 14, 0.72)';
    ctx.fillRect(0, CANVAS_HEIGHT - badgeHeight, CANVAS_WIDTH, badgeHeight);
    ctx.fillStyle = '#670626';
    ctx.fillRect(0, CANVAS_HEIGHT - badgeHeight, CANVAS_WIDTH, 2);

    ctx.fillStyle = '#F7F1EA';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(
      `RESQTRACK  |  ${coords.latitude.toFixed(5)}N, ${coords.longitude.toFixed(5)}E (±${Math.round(coords.accuracy)}m ${gpsTag})  |  CLARITY ${variance}/${dynamicCheck.threshold}  |  ${nowTime}Z`,
      16,
      CANVAS_HEIGHT - 13
    );

    const displayDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedUrl(displayDataUrl);

    // Stop video stream immediately upon single snapshot
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    // 4. Immediately trigger live AI pre-check on the clean un-watermarked frame
    void runLiveAiPreCheck(cleanDataUrl);
  }, [coords, isHardwareGeolocated, signalQuality, isUsingFallback, stream, runLiveAiPreCheck]);

  const handleConfirmAndSend = () => {
    if (!capturedUrl) return;

    const aiConfirmedGenuine =
      Boolean(aiPreview?.isGenuineIncident) && !aiPreview?.roboflowNeedsReview;
    const requiresManualVerification = aiPreview
      ? isBlurry || !aiConfirmedGenuine
      : isBlurry;

    onCapture(capturedUrl, {
      isBlurry,
      requiresManualVerification,
      varianceScore: blurrinessScore || 100,
      dynamicThreshold: activeThreshold,
      thresholdReasoning,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: coords.accuracy,
      isHardwareGeolocated,
      analysisImageDataUrl: cleanAnalysisUrl || capturedUrl,
      aiPreview: aiPreview ?? undefined
    });

    onClose();
  };

  const handleDiscardAndClose = () => {
    isMountedOpenRef.current = false;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCapturedUrl(null);
    setCleanAnalysisUrl(null);
    setAiPreview(null);
    setIsAnalyzingAi(false);
    onClose();
  };

  return (
    <DefaultFloatingModalCard isOpen={isOpen} onClose={handleDiscardAndClose} title={title} maxWidth="2xl">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#5C313E] leading-snug">{instructionText}</p>

        {/* Live Viewfinder / Single Snapshot Freeze */}
        <div className="relative aspect-video bg-[#2B010E] rounded-2xl overflow-hidden border-2 border-[#E9D9D0] shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] flex items-center justify-center">
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
              <p className="text-xs text-[#E9D9D0]/80 max-w-xs">
                {cameraError || 'Camera unavailable — synthetic frame active.'}
              </p>
            </div>
          )}

          {/* Tactical HUD Header */}
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-[#F7F1EA]/95 backdrop-blur-md rounded-lg text-xs font-mono font-bold text-[#670626] flex items-center gap-2 border border-[#E9D9D0] shadow">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            <span>GPS: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}</span>
          </div>

          {/* Live AI Processing Scan Overlay on Captured Preview */}
          {capturedUrl && isAnalyzingAi && (
            <div className="absolute inset-0 bg-[#2B010E]/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center gap-2.5">
              <div className="w-full max-w-xs h-1.5 rounded-full bg-[#F7F1EA]/25 overflow-hidden">
                <div className="h-full w-1/2 bg-[#F7F1EA] rounded-full animate-pulse" />
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/30 shadow-lg flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 animate-spin text-[#670626] flex-shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-mono font-black uppercase">AI Processing &amp; Verifying Incident...</p>
                  <p className="text-[11px] font-mono text-[#A83B4D]">
                    Checking Scene Clarity -&gt; Running Roboflow &amp; Claude Haiku 4.5 Verification...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quality Assessment & AI Pre-Check Banner */}
        {capturedUrl && (
          <div className="flex flex-col gap-2">
            <div
              className={`p-3 rounded-xl border text-sm flex items-center justify-between ${
                isBlurry
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {isBlurry ? (
                  <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {isBlurry
                      ? `Low Clarity (${blurrinessScore} / ${activeThreshold})`
                      : `Clear Photo (${blurrinessScore} / ${activeThreshold})`}
                  </p>
                  <p className="text-xs opacity-90">
                    {isBlurry ? 'Low clarity — manual review required.' : 'Scene clarity verified.'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${
                  isBlurry ? 'bg-amber-200/80 text-amber-950' : 'bg-emerald-200/80 text-emerald-950'
                }`}
              >
                {isBlurry ? 'Manual Review' : 'Clarity OK'}
              </span>
            </div>

            {isAnalyzingAi && (
              <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/25 text-[#670626] text-xs font-mono font-bold flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>AI Analyzing... Roboflow &amp; Claude Haiku 4.5 scene verification in progress.</span>
              </div>
            )}

            {!isAnalyzingAi && aiPreview && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 ${
                  aiPreview.isGenuineIncident !== false
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span className="font-bold">
                    {aiPreview.isGenuineIncident !== false
                      ? `AI Verified Incident (${aiPreview.detectedCategory} / ${aiPreview.recommendedSeverity})`
                      : 'No emergency detected in photo — manual review required'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-white/75 font-bold uppercase">
                  {aiPreview.isGenuineIncident !== false && !aiPreview.roboflowNeedsReview && !isBlurry
                    ? 'Auto-Approve Ready'
                    : 'Review Flagged'}
                </span>
              </div>
            )}
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
