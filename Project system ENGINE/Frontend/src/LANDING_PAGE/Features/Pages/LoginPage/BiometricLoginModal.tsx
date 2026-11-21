// [Layer: LANDING_PAGE/Features/Pages/LoginPage]
// Responsibility: 5-Layer Claude AI & Geometric Biometric Facial Recognition Login Modal (supports both 1:1 Targeted Email + Face Verification and Direct 1:N Face Scan).
// Complies with Katipuneros Architecture: Universal Lambdas (=>), Zero 'any', Strict TypeScript, Zero Emojis, and military HUD aesthetics.

import React, { useState, useRef, useEffect, useCallback, FC } from 'react';
import {
  Camera,
  X,
  Shield,
  AlertTriangle,
  Cpu,
  RefreshCw,
  CheckCircle2,
  User,
  ArrowRight,
  Sparkles,
  Layers,
  ScanFace
} from 'lucide-react';
import {
  biometricLoginUser,
  getBiometricTrainingStatus,
  BiometricLoginPayload,
  BiometricValidationLayerTelemetry as BackendBiometricLayerTelemetry,
  LoginResponse
} from '@/Endpoints/authApi';
import { trackSkinFace } from '@/Libs/Vision/idScanner/face/skinFaceTracker';
import {
  extractBiometricFeatureVector,
  generateDeterministicBiometricVector
} from '@/Libs/Cache/biometricFrameCache';
import {
  claudeFacialBiometricStrategy,
  createInitialFiveLayerPipeline,
  type BiometricLoginLayerTelemetry,
  type BiometricValidationLayerCode
} from '@/Libs/Biometrics/claudeFacialBiometricStrategy';

type FacePresenceState = 'STANDBY' | 'NO_FACE' | 'ALIGN_FACE' | 'FACE_DETECTED';

const COMPACT_LAYER_LABELS: Record<BiometricValidationLayerCode, string> = {
  OPTICAL_LIVENESS_GATE: '1. Liveness',
  CLAUDE_AI_BIOMETRIC_STRATEGY: '2. Geometry',
  DATABASE_TRAINED_KNOWLEDGE_LOOKUP: '3. DB Match',
  MULTI_FACTOR_VERIFICATION_ENGINE: '4. Cosine Match',
  DETERMINISTIC_VALIDATION_VERDICT: '5. Verdict'
};

interface BiometricLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  portalOrigin?: string;
  onLoginSuccess: (response: LoginResponse) => void;
}

interface ExtendedBiometricLoginPayload extends BiometricLoginPayload {
  liveDescriptorVectorJson?: string;
  liveGeometricSignatureJson?: string;
  liveCaptureBase64?: string;
  liveCaptureFramesBase64?: string[];
  livenessScore?: number;
}

const TERMINAL_AUTH_FAILURE_TOKENS: readonly string[] = [
  'pending',
  'suspended',
  'not found',
  'invalid credentials',
  'access denied',
  'blocked',
  'forbidden'
];

const isTerminalAuthFailure = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return TERMINAL_AUTH_FAILURE_TOKENS.some((token) => lower.includes(token));
};

const computeFrameSharpnessAndContrast = (
  data: Uint8ClampedArray,
  width: number,
  height: number
): { contrastStdDev: number; laplacianVar: number; isSharpAndContrasted: boolean } => {
  const startX = Math.max(2, Math.floor(width * 0.2));
  const endX = Math.min(width - 2, Math.ceil(width * 0.8));
  const startY = Math.max(2, Math.floor(height * 0.1));
  const endY = Math.min(height - 2, Math.ceil(height * 0.9));

  let lumSum = 0;
  let lumSqSum = 0;
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;

  const getLum = (x: number, y: number): number => {
    const idx = (y * width + x) * 4;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  };

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const c = getLum(x, y);
      lumSum += c;
      lumSqSum += c * c;

      const lap =
        4 * c - getLum(x - 1, y) - getLum(x + 1, y) - getLum(x, y - 1) - getLum(x, y + 1);
      lapSum += lap;
      lapSqSum += lap * lap;
      count++;
    }
  }

  if (count === 0) {
    return { contrastStdDev: 0, laplacianVar: 0, isSharpAndContrasted: false };
  }

  const lumMean = lumSum / count;
  const contrastVar = Math.max(0, lumSqSum / count - lumMean * lumMean);
  const contrastStdDev = Math.sqrt(contrastVar);

  const lapMean = lapSum / count;
  const laplacianVar = Math.max(0, lapSqSum / count - lapMean * lapMean);

  return {
    contrastStdDev,
    laplacianVar,
    isSharpAndContrasted: contrastStdDev >= 8 && laplacianVar >= 12
  };
};

const captureLiveBurstFrames = async (
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  firstDataUrl: string = ''
): Promise<string[]> => {
  const frames: string[] = [];
  const trimmedFirst = firstDataUrl.trim();
  if (trimmedFirst.length > 0) {
    frames.push(trimmedFirst);
  }

  if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
    return frames;
  }

  while (frames.length < 3) {
    if (frames.length > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 60);
      });
    }
    if (video.readyState < 2 || video.videoWidth === 0) {
      break;
    }
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      break;
    }
    ctx.drawImage(video, 0, 0, 320, 240);
    const snapshot = canvas.toDataURL('image/jpeg', 0.86);
    if (snapshot && snapshot.trim().length > 0) {
      frames.push(snapshot);
    } else {
      break;
    }
  }

  return frames;
};

export const BiometricLoginModal: FC<BiometricLoginModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  portalOrigin = 'ResponderCivilian',
  onLoginSuccess
}) => {
  const [email, setEmail] = useState<string>(initialEmail);
  const [emailError, setEmailError] = useState<string>('');
  const [stage, setStage] = useState<'CAMERA_SCAN' | 'VERIFYING'>('CAMERA_SCAN');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusTone, setStatusTone] = useState<'ok' | 'bad' | ''>('');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [pipelineLayers, setPipelineLayers] = useState<BiometricLoginLayerTelemetry[]>(() =>
    createInitialFiveLayerPipeline()
  );
  const [validationVerdict, setValidationVerdict] = useState<'IDLE' | 'SUCCESS_LOGIN' | 'INVALID'>('IDLE');
  const [facePresence, setFacePresence] = useState<FacePresenceState>('STANDBY');
  const [trainingStatusUi, setTrainingStatusUi] = useState<{
    state: 'idle' | 'ready' | 'learning';
    label: string;
  }>({ state: 'idle', label: '' });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const prevGrayRef = useRef<Float32Array | undefined>(undefined);
  const hasDispatchedRef = useRef<boolean>(false);
  const autoScanPausedRef = useRef<boolean>(false);
  const autoRetryCountRef = useRef<number>(0);
  const scanProgressRef = useRef<number>(0);
  const centeredFrameCountRef = useRef<number>(0);
  const lastFaceUiUpdateRef = useRef<number>(0);
  const lastFacePresenceRef = useRef<FacePresenceState>('STANDBY');
  const processFrameRef = useRef<() => void>(() => {});
  const stopCameraRef = useRef<() => void>(() => {});
  const scheduleTickRef = useRef<() => void>(() => {});
  const retryTimeoutRef = useRef<number | null>(null);
  const manualEmailEditRef = useRef<boolean>(false);

  const refreshTrainingStatus = useCallback(async (targetEmail: string): Promise<void> => {
    const clean = targetEmail.trim().toLowerCase();
    if (!clean.includes('@') || !clean.includes('.')) {
      setTrainingStatusUi({ state: 'idle', label: '' });
      return;
    }
    try {
      const res = await getBiometricTrainingStatus(clean);
      if (
        res.exists === false ||
        res.found === false ||
        res.hasBiometricEnrollment === false
      ) {
        setTrainingStatusUi({ state: 'idle', label: '' });
        return;
      }
      const statusNorm = String(res.biometricTrainingStatus || res.trainingStatus || '')
        .trim()
        .toUpperCase();
      if (!statusNorm || statusNorm === 'NONE') {
        setTrainingStatusUi({ state: 'idle', label: '' });
        return;
      }
      const isReady =
        res.isReady === true ||
        res.ready === true ||
        statusNorm === 'READY' ||
        statusNorm === 'COMPLETED' ||
        (typeof res.remainingSeconds === 'number' && res.remainingSeconds <= 0);

      if (isReady) {
        setTrainingStatusUi({
          state: 'ready',
          label: 'AI Learning: Ready'
        });
      } else {
        const mins =
          typeof res.remainingMinutes === 'number' && res.remainingMinutes > 0
            ? Math.ceil(res.remainingMinutes)
            : typeof res.remainingSeconds === 'number' && res.remainingSeconds > 0
            ? Math.max(1, Math.ceil(res.remainingSeconds / 60))
            : 5;
        setTrainingStatusUi({
          state: 'learning',
          label: `AI Learning in progress (~${mins} min remaining) — Please wait up to 5 minutes after registration`
        });
      }
    } catch {
      // Non-blocking: ignore unavailable or un-enrolled status lookups
    }
  }, []);

  useEffect(() => {
    setEmail(initialEmail || '');
    manualEmailEditRef.current = false;
    if (!isOpen) {
      setTrainingStatusUi({ state: 'idle', label: '' });
    }
  }, [initialEmail, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const clean = email.trim();
    if (!clean.includes('@') || !clean.includes('.')) {
      setTrainingStatusUi({ state: 'idle', label: '' });
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshTrainingStatus(clean);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [email, isOpen, refreshTrainingStatus]);

  const stopCamera = useCallback(() => {
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.srcObject = null;
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    lastFacePresenceRef.current = 'STANDBY';
    lastFaceUiUpdateRef.current = 0;
    setFacePresence('STANDBY');
  }, []);

  const handleClose = () => {
    stopCamera();
    setIsStreaming(false);
    setFacePresence('STANDBY');
    lastFacePresenceRef.current = 'STANDBY';
    lastFaceUiUpdateRef.current = 0;
    setStatusMessage('');
    setStatusTone('');
    setEmailError('');
    setScanProgress(0);
    scanProgressRef.current = 0;
    centeredFrameCountRef.current = 0;
    setCameraError(null);
    setPipelineLayers(createInitialFiveLayerPipeline());
    setValidationVerdict('IDLE');
    hasDispatchedRef.current = false;
    autoScanPausedRef.current = false;
    autoRetryCountRef.current = 0;
    onClose();
  };

  const markPipelineSuccess = useCallback(
    (
      recognizedName: string,
      modeLabel: string,
      backendLayers?: BackendBiometricLayerTelemetry[] | null,
      liveLayers?: BiometricLoginLayerTelemetry[]
    ) => {
      setValidationVerdict('SUCCESS_LOGIN');
      const baseLayers = liveLayers && liveLayers.length > 0 ? liveLayers : createInitialFiveLayerPipeline();
      const findBackendLayer = (
        layerNum: number,
        layerCode: BiometricValidationLayerCode
      ): BackendBiometricLayerTelemetry | undefined =>
        backendLayers?.find(
          (b) =>
            b.layerNumber === layerNum ||
            b.layer === layerNum ||
            b.layerCode === layerCode ||
            b.name === layerCode
        );

      const resolveScore = (
        backendLayer: BackendBiometricLayerTelemetry | undefined,
        fallbackScore: number
      ): number => {
        if (typeof backendLayer?.score === 'number' && Number.isFinite(backendLayer.score)) {
          return backendLayer.score;
        }
        if (
          typeof backendLayer?.cosineSimilarity === 'number' &&
          Number.isFinite(backendLayer.cosineSimilarity)
        ) {
          return backendLayer.cosineSimilarity;
        }
        return fallbackScore;
      };

      setPipelineLayers(
        baseLayers.map((liveLayer) => {
          const matched = findBackendLayer(liveLayer.layerNumber, liveLayer.layerCode);
          const resolvedScore = resolveScore(matched, liveLayer.score);
          const defaultDetail =
            liveLayer.layerNumber === 3
              ? `PostgreSQL biometric template located (${modeLabel})`
              : liveLayer.layerNumber === 5
              ? `Verdict: ${matched?.verdict || 'SUCCESS_LOGIN'} // Authenticated as ${recognizedName}`
              : liveLayer.detail;

          return {
            layerNumber: liveLayer.layerNumber,
            layerCode: liveLayer.layerCode,
            layerName: matched?.layerName || liveLayer.layerName,
            status: 'PASSED',
            passed: matched?.passed ?? true,
            score: resolvedScore,
            detail: matched?.detail || defaultDetail
          };
        })
      );
    },
    []
  );

  const markPipelineFailure = useCallback((errorDetail: string) => {
    setValidationVerdict('INVALID');
    setPipelineLayers((prev) =>
      prev.map((layer) => {
        if (layer.layerNumber <= 2) {
          return {
            ...layer,
            status: layer.passed ? 'PASSED' : 'FAILED',
            score: layer.score
          };
        }
        if (layer.layerNumber === 3) {
          const isLookupFailure =
            errorDetail.toLowerCase().includes('not found') ||
            errorDetail.toLowerCase().includes('no active biometric');
          return {
            ...layer,
            status: isLookupFailure ? 'FAILED' : 'PASSED',
            passed: !isLookupFailure,
            score: isLookupFailure ? 0 : layer.score,
            detail: isLookupFailure ? errorDetail : 'PostgreSQL biometric template retrieved for comparison'
          };
        }
        if (layer.layerNumber === 4) {
          return {
            ...layer,
            status: 'FAILED',
            passed: false,
            score: 0,
            detail: errorDetail
          };
        }
        return {
          ...layer,
          status: 'FAILED',
          passed: false,
          score: 0,
          detail: `Verdict: INVALID // ${errorDetail}`
        };
      })
    );
  }, []);

  const executeBiometricLogin = useCallback(
    async (
      descriptorVector: number[],
      frameDataUrl: string = '',
      fallbackVector?: number[],
      extraLiveFrames?: string[]
    ) => {
      setStage('VERIFYING');
      setStatusMessage('Verifying face…');
      setStatusTone('');

      const liveEvaluation = await claudeFacialBiometricStrategy.evaluateLiveLoginScanLayers(
        frameDataUrl,
        descriptorVector
      );
      setPipelineLayers(liveEvaluation.layers);

      const trimmedEmail = email.trim().toLowerCase();
      const is1To1 = trimmedEmail.includes('@');
      const trimmedFrameDataUrl = frameDataUrl.trim();
      const sanitizedBurst = (extraLiveFrames ?? [])
        .map((frame) => frame.trim())
        .filter((frame) => frame.length > 0);
      const cleanFrames =
        sanitizedBurst.length > 0
          ? sanitizedBurst
          : trimmedFrameDataUrl.length > 0
          ? [trimmedFrameDataUrl]
          : [];

      const buildPayload = (vec: number[], useEmailTarget: boolean): ExtendedBiometricLoginPayload => {
        const req: ExtendedBiometricLoginPayload = {
          liveDescriptorVector: vec,
          liveDescriptorVectorJson: JSON.stringify(vec),
          liveGeometricSignatureJson: liveEvaluation.liveGeometricSignatureJson,
          liveCaptureBase64: trimmedFrameDataUrl.length > 0 ? trimmedFrameDataUrl : undefined,
          liveCaptureFramesBase64: cleanFrames.length > 0 ? cleanFrames : undefined,
          livenessScore: liveEvaluation.livenessScore,
          portalOrigin
        };
        if (useEmailTarget) {
          req.email = trimmedEmail;
        }
        return req;
      };

      let resolvedOneToOne = is1To1;

      try {
        let response: LoginResponse;
        try {
          response = await biometricLoginUser(buildPayload(liveEvaluation.liveDescriptorVector, is1To1));
        } catch (firstErr: unknown) {
          const firstMsg = firstErr instanceof Error ? firstErr.message.toLowerCase() : '';
          // If LoginPage autofill carried an un-enrolled demo/legacy email into the 1:1 slot,
          // seamlessly fall back to 1:N face identification so enrolled users (e.g. SUICO) still match.
          if (is1To1 && !manualEmailEditRef.current && firstMsg.includes('no active biometric enrollment')) {
            resolvedOneToOne = false;
            setEmail('');
            setStatusMessage(`'${trimmedEmail}' has no face frames — scanning enrolled faces (1:N)…`);
            setStatusTone('');
            response = await biometricLoginUser(buildPayload(liveEvaluation.liveDescriptorVector, false));
          } else if (fallbackVector && fallbackVector.length === 128) {
            response = await biometricLoginUser(buildPayload(fallbackVector, is1To1));
          } else {
            throw firstErr;
          }
        }

        const recognizedName = response.session?.fullName || 'Verified User';
        const sessionWithLayers = response.session as
          | { validationLayers?: BackendBiometricLayerTelemetry[] }
          | undefined;
        const backendLayers = response.validationLayers ?? sessionWithLayers?.validationLayers ?? null;
        markPipelineSuccess(
          recognizedName,
          resolvedOneToOne ? `1:1 ${trimmedEmail}` : '1:N Optical Identification',
          backendLayers,
          liveEvaluation.layers
        );

        setStatusMessage(`Identity verified (${recognizedName}) — Redirecting…`);
        setStatusTone('ok');
        stopCamera();
        setIsStreaming(false);

        setTimeout(() => {
          onLoginSuccess(response);
        }, 650);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Biometric 1:1 verification failed: Cosine similarity is below the 0.82 security threshold.';
        markPipelineFailure(msg);
        setStatusMessage(msg);
        setStatusTone('bad');
        if (retryTimeoutRef.current !== null) {
          window.clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        hasDispatchedRef.current = false;
        scanProgressRef.current = 0;
        centeredFrameCountRef.current = 0;
        setScanProgress(0);
        setStage('CAMERA_SCAN');

        if (is1To1) {
          void refreshTrainingStatus(trimmedEmail);
        }

        if (isTerminalAuthFailure(msg) || autoRetryCountRef.current >= 1) {
          autoScanPausedRef.current = true;
        } else {
          autoRetryCountRef.current += 1;
          retryTimeoutRef.current = window.setTimeout(() => {
            retryTimeoutRef.current = null;
            if (!autoScanPausedRef.current && !hasDispatchedRef.current) {
              scheduleTickRef.current();
            }
          }, 2500);
        }
      }
    },
    [email, portalOrigin, stopCamera, onLoginSuccess, markPipelineSuccess, markPipelineFailure, refreshTrainingStatus]
  );

  // Dedicated Frame Processing Logic for Genuine Optical Face Detection
  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || hasDispatchedRef.current || autoScanPausedRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 320, 240);
    const imgData = ctx.getImageData(0, 0, 320, 240);

    // Reject pure flat/blank/blurry frames before progressing or firing API
    const frameQuality = computeFrameSharpnessAndContrast(imgData.data, 320, 240);

    const skinRes = trackSkinFace(
      imgData.data,
      320,
      240,
      { cx: 160, cy: 120, rx: 84, ry: 102 },
      prevGrayRef.current
    );
    if (skinRes?.ycbcr?.y) {
      prevGrayRef.current = skinRes.ycbcr.y;
    }

    // Require genuine skin face & landmark/haar validation for automatic hands-free reticle trigger
    const hasGenuineFace = Boolean(
      frameQuality.isSharpAndContrasted &&
        skinRes?.isValidFace &&
        (skinRes.landmarks?.isValidLandmarks || (skinRes.haarCheck?.score ?? 0) >= 0.55)
    );
    const yawVal = Math.abs(skinRes?.yawDegrees || 0);
    const pitchVal = Math.abs(skinRes?.pitchDegrees || 0);
    const isCentered = Boolean(hasGenuineFace && skinRes && yawVal <= 22 && pitchVal <= 22);

    const nextPresence: FacePresenceState = hasGenuineFace
      ? isCentered
        ? 'FACE_DETECTED'
        : 'ALIGN_FACE'
      : 'NO_FACE';
    const now = performance.now();
    if (nextPresence !== lastFacePresenceRef.current || now - lastFaceUiUpdateRef.current >= 150) {
      lastFacePresenceRef.current = nextPresence;
      lastFaceUiUpdateRef.current = now;
      setFacePresence(nextPresence);
    }

    if (hasGenuineFace && skinRes && frameQuality.isSharpAndContrasted) {
      if (isCentered) {
        centeredFrameCountRef.current += 1;
        const nextProgress = Math.min(scanProgressRef.current + 18, 100);
        scanProgressRef.current = nextProgress;
        setScanProgress(nextProgress);

        if (centeredFrameCountRef.current >= 6 && nextProgress >= 100 && !hasDispatchedRef.current) {
          hasDispatchedRef.current = true;
          setStage('VERIFYING');
          const bestFrameUrl = canvas.toDataURL('image/jpeg', 0.86);
          void Promise.all([
            captureLiveBurstFrames(video, canvas, bestFrameUrl),
            extractBiometricFeatureVector(bestFrameUrl)
          ])
            .then(([burstFrames, vec]) => {
              if (vec && vec.length === 128) {
                void executeBiometricLogin(vec, bestFrameUrl, undefined, burstFrames);
              } else {
                hasDispatchedRef.current = false;
                centeredFrameCountRef.current = 0;
                scanProgressRef.current = 0;
                setScanProgress(0);
                setStage('CAMERA_SCAN');
                scheduleTickRef.current();
              }
            })
            .catch(() => {
              hasDispatchedRef.current = false;
              centeredFrameCountRef.current = 0;
              scanProgressRef.current = 0;
              setScanProgress(0);
              setStage('CAMERA_SCAN');
              scheduleTickRef.current();
            });
        }
      } else {
        centeredFrameCountRef.current = Math.max(0, centeredFrameCountRef.current - 1);
        const nextProgress = Math.max(10, scanProgressRef.current - 1);
        scanProgressRef.current = nextProgress;
        setScanProgress(nextProgress);
      }
    } else {
      centeredFrameCountRef.current = 0;
      const nextProgress = Math.max(0, scanProgressRef.current - 2);
      scanProgressRef.current = nextProgress;
      setScanProgress(nextProgress);
    }
  }, [executeBiometricLogin]);

  stopCameraRef.current = stopCamera;
  processFrameRef.current = processFrame;

  const startOrEnsureCamera = useCallback(async () => {
    if (streamRef.current && isStreaming) {
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, max: 60 }
          },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        await videoRef.current.play().catch(() => {});
      }
      setIsStreaming(true);
      setCameraError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access physical camera.';
      setCameraError(msg);
    }
  }, [isStreaming]);

  // Stable Camera Lifecycle triggered on modal open/close
  useEffect(() => {
    let isCancelled = false;

    if (!isOpen) {
      stopCameraRef.current();
      setIsStreaming(false);
      setFacePresence('STANDBY');
      lastFacePresenceRef.current = 'STANDBY';
      lastFaceUiUpdateRef.current = 0;
      scanProgressRef.current = 0;
      centeredFrameCountRef.current = 0;
      setScanProgress(0);
      return;
    }

    hasDispatchedRef.current = false;
    autoScanPausedRef.current = false;
    autoRetryCountRef.current = 0;
    scanProgressRef.current = 0;
    centeredFrameCountRef.current = 0;
    setScanProgress(0);
    setCameraError(null);
    setEmailError('');
    setPipelineLayers(createInitialFiveLayerPipeline());
    setValidationVerdict('IDLE');
    setStatusMessage('Align face in oval.');
    setStatusTone('');
    setStage('CAMERA_SCAN');

    const activateCamera = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 30, max: 60 }
            },
            audio: false
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('autoplay', 'true');

          const onReady = async () => {
            try {
              await videoRef.current?.play();
              if (!isCancelled) {
                setIsStreaming(true);
                setCameraError(null);
              }
            } catch {
              if (!isCancelled) setIsStreaming(true);
            }
          };

          videoRef.current.onloadedmetadata = onReady;
          if (videoRef.current.readyState >= 2) {
            void onReady();
          }
        }

        const tick = () => {
          if (isCancelled || hasDispatchedRef.current || autoScanPausedRef.current) return;
          processFrameRef.current();
          animationFrameId.current = requestAnimationFrame(tick);
        };
        scheduleTickRef.current = () => {
          if (isCancelled || hasDispatchedRef.current || autoScanPausedRef.current) return;
          if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
          }
          animationFrameId.current = requestAnimationFrame(tick);
        };
        scheduleTickRef.current();
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : 'Unable to access physical camera.';
        setCameraError(msg);
        setStatusMessage('Camera unavailable. Use Test Scan below.');
        setStatusTone('bad');
      }
    };

    void activateCamera();

    return () => {
      isCancelled = true;
      stopCameraRef.current();
      setIsStreaming(false);
    };
  }, [isOpen]);

  const handleActivateLiveCameraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    hasDispatchedRef.current = false;
    autoScanPausedRef.current = false;
    autoRetryCountRef.current = 0;
    scanProgressRef.current = 0;
    centeredFrameCountRef.current = 0;
    setScanProgress(0);
    setStage('CAMERA_SCAN');
    setValidationVerdict('IDLE');

    await startOrEnsureCamera();
    scheduleTickRef.current();
    if (email.trim().includes('@')) {
      void refreshTrainingStatus(email);
    }

    setPipelineLayers((prev) =>
      prev.map((layer, idx) =>
        idx === 0
          ? {
              ...layer,
              status: 'RUNNING',
              passed: false,
              score: 0,
              detail: 'Live camera active — awaiting oval reticle alignment'
            }
          : layer
      )
    );

    setStatusMessage('Ready to scan.');
    setStatusTone('');
  };

  const handleDirect1ToNScan = async () => {
    manualEmailEditRef.current = false;
    setEmail('');
    setEmailError('');
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    hasDispatchedRef.current = false;
    autoScanPausedRef.current = false;
    autoRetryCountRef.current = 0;
    scanProgressRef.current = 0;
    centeredFrameCountRef.current = 0;
    setScanProgress(0);
    setTrainingStatusUi({ state: 'idle', label: '' });
    setStage('CAMERA_SCAN');
    setValidationVerdict('IDLE');
    await startOrEnsureCamera();
    scheduleTickRef.current();
    setStatusMessage('Ready to scan.');
    setStatusTone('');
  };

  const handleManualScanNow = async () => {
    if (hasDispatchedRef.current || stage === 'VERIFYING') return;

    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    let dataUrl = '';

    if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, 320, 240);
        const imgData = ctx.getImageData(0, 0, 320, 240);
        const quality = computeFrameSharpnessAndContrast(imgData.data, 320, 240);
        if (!quality.isSharpAndContrasted) {
          setStatusMessage('Frame is blank or lacks contrast. Ensure clear lighting and face visibility before scanning.');
          setStatusTone('bad');
          return;
        }
        dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      }
    }

    autoScanPausedRef.current = true;
    autoRetryCountRef.current = 1;
    hasDispatchedRef.current = true;
    scanProgressRef.current = 100;
    setScanProgress(100);
    setStage('VERIFYING');

    const burstFrames = dataUrl ? await captureLiveBurstFrames(video, canvas, dataUrl) : [];
    const vector = dataUrl
      ? await extractBiometricFeatureVector(dataUrl)
      : new Array<number>(128).fill(0).map((_, i) => (i === 0 ? 1 : 0));

    await executeBiometricLogin(vector, dataUrl, undefined, burstFrames);
  };

  const handleSyntheticTestScan = async () => {
    if (stage === 'VERIFYING') return;
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    autoScanPausedRef.current = true;
    autoRetryCountRef.current = 1;
    hasDispatchedRef.current = true;
    scanProgressRef.current = 100;
    setScanProgress(100);
    setStage('VERIFYING');

    let dataUrl = '';
    let liveExtractedVec: number[] | null = null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.videoWidth > 0) {
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, 320, 240);
        const imgData = ctx.getImageData(0, 0, 320, 240);
        const quality = computeFrameSharpnessAndContrast(imgData.data, 320, 240);
        if (quality.isSharpAndContrasted) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.86);
          const extracted = await extractBiometricFeatureVector(dataUrl);
          if (extracted && extracted.length === 128) {
            liveExtractedVec = extracted;
          }
        }
      }
    }

    const burstFrames = dataUrl ? await captureLiveBurstFrames(video, canvas, dataUrl) : [];
    const trimmedEmail = email.trim();
    if (!dataUrl || !liveExtractedVec) {
      if (!trimmedEmail) {
        hasDispatchedRef.current = false;
        autoScanPausedRef.current = false;
        setScanProgress(0);
        scanProgressRef.current = 0;
        setStage('CAMERA_SCAN');
        setStatusMessage('Enter your account email or enable live camera before running Test Scan.');
        setStatusTone('bad');
        return;
      }
    }
    const primaryVec =
      dataUrl && liveExtractedVec
        ? liveExtractedVec
        : generateDeterministicBiometricVector(trimmedEmail);

    await executeBiometricLogin(primaryVec, dataUrl, undefined, burstFrames);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B0210]/75 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="clay-surface relative w-full max-w-xl max-h-[94vh] overflow-y-auto rounded-3xl bg-[#F7F1EA] border border-[#D8C2B8] p-4 sm:p-5 shadow-[0_28px_64px_-12px_rgba(38,2,14,0.6),inset_0_2px_4px_rgba(255,255,255,0.85)] text-[#670626] font-sans my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#D5BEB3] pb-2.5 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#E9D9D0] border border-[#D5BEB3]">
              <Shield className="w-5 h-5 text-[#670626]" />
            </div>
            <div>
              <h3 className="font-mono text-sm sm:text-base font-bold uppercase tracking-wider text-[#670626]">
                {email && email.trim().includes('@')
                  ? 'Biometric Face Login (1:1)'
                  : 'Biometric Face Login (1:N)'}
              </h3>
              {email && email.trim().includes('@') && (
                <p className="font-mono text-xs text-[#A83B4D] font-semibold tracking-wider uppercase mt-0.5">
                  {email.trim().toLowerCase()}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#A83B4D] hover:text-[#670626] p-1.5 rounded-xl hover:bg-[#E9D9D0] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1:1 Account Email Form & 1:N Direct Scan Switcher */}
        <form onSubmit={handleActivateLiveCameraSubmit} className="mb-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label
              className="block font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
              htmlFor="bio-email"
            >
              Email (Optional for 1:N)
            </label>
            <button
              type="button"
              id="btn-direct-1ton-scan"
              onClick={handleDirect1ToNScan}
              className="font-mono text-xs sm:text-sm text-[#670626] hover:text-[#4A041A] font-semibold underline cursor-pointer flex items-center gap-1"
            >
              <ScanFace className="w-3.5 h-3.5 text-[#A83B4D]" />
              <span>1:N Scan (No Email)</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0 focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] flex items-center px-3 rounded-xl border border-[#D5BEB3] bg-[#E9D9D0]">
              <User className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
              <input
                id="bio-email"
                type="email"
                value={email}
                onChange={(e) => {
                  manualEmailEditRef.current = e.target.value.trim().length > 0;
                  setEmail(e.target.value);
                  setEmailError('');
                }}
                placeholder="Email (optional for 1:N)"
                className="w-full min-w-0 py-2.5 bg-transparent font-sans text-sm text-[#670626] focus:outline-none placeholder:text-[#A83B4D]/70"
              />
            </div>

            <button
              type="submit"
              className="px-3.5 py-2.5 rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-mono text-xs sm:text-sm font-bold uppercase tracking-wider shadow-md shadow-[#4A041A]/20 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-[0.99]"
            >
              <span>Activate Live Camera</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {emailError && <p className="font-mono text-xs sm:text-sm text-[#670626] font-semibold">{emailError}</p>}

          {trainingStatusUi.state !== 'idle' && (
            <div
              id="biometric-training-status-badge"
              role="status"
              aria-live="polite"
              className={`px-3 py-2 rounded-xl border font-mono text-xs font-semibold flex items-center gap-2 ${
                trainingStatusUi.state === 'ready'
                  ? 'bg-emerald-50 border-emerald-600/35 text-emerald-800'
                  : 'bg-[#E9D9D0] border-[#A83B4D]/45 text-[#670626]'
              }`}
            >
              {trainingStatusUi.state === 'ready' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <Cpu className="w-4 h-4 text-[#A83B4D] shrink-0 animate-pulse" />
              )}
              <span>{trainingStatusUi.label}</span>
            </div>
          )}
        </form>

        <div className="flex flex-col items-center">
          {/* Live Camera Viewport */}
          <div className="relative w-full h-36 bg-[#24030D] rounded-2xl overflow-hidden border-2 border-[#670626]/30 flex items-center justify-center shadow-inner">
            <canvas ref={canvasRef} className="hidden" />
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
                isStreaming ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Connecting Spinner Overlay */}
            {!isStreaming && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#24030D]/90 gap-2 text-[#F7F1EA] font-mono text-sm z-10">
                <RefreshCw className="w-5 h-5 animate-spin text-[#E9D9D0]" />
                <span className="tracking-widest uppercase">Starting camera…</span>
              </div>
            )}

            {/* HUD Oval Reticle */}
            <div
              className="absolute w-32 h-40 rounded-[50%] border-2 transition-colors duration-200 pointer-events-none z-10"
              style={{
                borderColor:
                  scanProgress >= 100 || facePresence === 'FACE_DETECTED'
                    ? '#10b981'
                    : facePresence === 'ALIGN_FACE'
                    ? '#38bdf8'
                    : facePresence === 'NO_FACE'
                    ? 'rgba(233, 217, 208, 0.75)'
                    : '#F7F1EA',
                borderStyle: facePresence === 'NO_FACE' ? 'dashed' : 'solid',
                boxShadow:
                  scanProgress >= 100 || facePresence === 'FACE_DETECTED'
                    ? '0 0 15px rgba(16,185,129,0.5)'
                    : 'none'
              }}
            />

            {/* Scanline Animation */}
            <div className="absolute inset-x-0 h-0.5 bg-[#E9D9D0]/80 shadow-[0_0_8px_#F7F1EA] animate-pulse pointer-events-none top-1/2 -translate-y-1/2 z-10" />

            {/* Live Face Detection Status Badge */}
            <div
              id="biometric-face-status-badge"
              role="status"
              aria-live="polite"
              data-face-detected={
                facePresence === 'FACE_DETECTED' || facePresence === 'ALIGN_FACE' ? 'true' : 'false'
              }
              data-face-presence={facePresence}
              className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-[#2B0210]/90 border text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 z-10 ${
                !isStreaming
                  ? 'border-[#E9D9D0]/25 text-[#E9D9D0]'
                  : facePresence === 'FACE_DETECTED'
                  ? 'border-emerald-400/60 text-emerald-300'
                  : facePresence === 'ALIGN_FACE'
                  ? 'border-sky-400/60 text-sky-300'
                  : facePresence === 'NO_FACE'
                  ? 'border-[#E9D9D0]/45 text-[#F7F1EA]'
                  : 'border-[#E9D9D0]/25 text-[#E9D9D0]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !isStreaming
                    ? 'bg-[#E9D9D0]/60'
                    : facePresence === 'FACE_DETECTED'
                    ? 'bg-emerald-400'
                    : facePresence === 'ALIGN_FACE'
                    ? 'bg-sky-400'
                    : facePresence === 'NO_FACE'
                    ? 'bg-rose-400'
                    : 'bg-[#E9D9D0]/60'
                }`}
              />
              <span>
                {!isStreaming
                  ? 'CAMERA STANDBY'
                  : facePresence === 'FACE_DETECTED'
                  ? 'FACE DETECTED'
                  : facePresence === 'ALIGN_FACE'
                  ? 'FACE DETECTED · CENTER'
                  : facePresence === 'NO_FACE'
                  ? 'NO FACE DETECTED'
                  : 'CAMERA STANDBY'}
              </span>
            </div>

            {stage === 'VERIFYING' && (
              <div className="absolute inset-0 bg-[#2B0210]/90 flex flex-col items-center justify-center gap-2 z-20">
                <Cpu className="w-7 h-7 text-[#E9D9D0] animate-spin" />
                <span className="font-mono text-sm text-[#F7F1EA] font-bold uppercase tracking-wider">
                  Verifying face…
                </span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full mt-3">
            <div className="flex justify-between font-mono text-xs sm:text-sm text-[#7D2B3D] mb-1">
              <span className="font-semibold">FACE SCAN</span>
              <span className="text-[#670626] font-bold">{scanProgress}%</span>
            </div>
            <div className="w-full bg-[#E9D9D0] rounded-full h-2.5 overflow-hidden border border-[#D5BEB3]">
              <div
                className="bg-gradient-to-r from-[#670626] via-[#8E1538] to-[#A83B4D] h-full transition-all duration-150"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>

          {/* 5-Layer Facial Recognition Validation Pipeline */}
          <div
            id="biometric-5layer-pipeline"
            className="w-full mt-3 p-3 rounded-2xl bg-[#EFE4DD] border border-[#D5BEB3] space-y-2"
          >
            <div className="flex items-center justify-between border-b border-[#D5BEB3] pb-1.5">
              <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-[#670626]">
                <Layers className="w-4 h-4 text-[#A83B4D]" />
                <span>Verification Pipeline</span>
              </div>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md border ${
                  validationVerdict === 'SUCCESS_LOGIN'
                    ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                    : validationVerdict === 'INVALID'
                    ? 'bg-[#670626] border-[#4A041A] text-[#F7F1EA]'
                    : 'bg-[#F7F1EA] border-[#D5BEB3] text-[#670626]'
                }`}
              >
                {validationVerdict === 'SUCCESS_LOGIN'
                  ? 'SUCCESS_LOGIN'
                  : validationVerdict === 'INVALID'
                  ? 'INVALID'
                  : 'READY'}
              </span>
            </div>

            <div className="space-y-1.5">
              {pipelineLayers.map((layer) => (
                <div
                  key={layer.layerCode}
                  data-layer-code={layer.layerCode}
                  className="flex items-center justify-between text-xs font-mono px-2.5 py-1.5 rounded-xl bg-[#F7F1EA] border border-[#D5BEB3]"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        layer.status === 'PASSED'
                          ? 'text-emerald-700'
                          : layer.status === 'FAILED'
                          ? 'text-[#670626]'
                          : layer.status === 'RUNNING'
                          ? 'text-[#A83B4D] animate-pulse'
                          : 'text-[#A83B4D]/50'
                      }`}
                    />
                    <span className="text-[#670626] font-medium truncate">
                      {COMPACT_LAYER_LABELS[layer.layerCode] || layer.layerName}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${
                      layer.status === 'PASSED'
                        ? 'text-emerald-700'
                        : layer.status === 'FAILED'
                        ? 'text-[#670626]'
                        : layer.status === 'RUNNING'
                        ? 'text-[#A83B4D]'
                        : 'text-[#A83B4D]/70'
                    }`}
                  >
                    {layer.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {cameraError && (
            <div className="w-full mt-2.5 p-2.5 rounded-xl bg-[#670626]/10 border border-[#670626]/40 text-[#670626] font-mono text-xs sm:text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#670626] shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Primary Action & Synthetic Test Scan Buttons */}
          <div className="w-full mt-3 space-y-2">
            <button
              type="button"
              id="btn-scan-biometric-face"
              onClick={handleManualScanNow}
              disabled={stage === 'VERIFYING'}
              className="w-full !h-[44px] rounded-xl bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-mono text-sm sm:text-base font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-[#4A041A]/25 disabled:opacity-50 active:scale-[0.99]"
            >
              <Camera className="w-4 h-4 text-[#F7F1EA]" />
              <span>Scan Face</span>
            </button>

            <button
              type="button"
              id="btn-synthetic-test-scan"
              onClick={handleSyntheticTestScan}
              disabled={stage === 'VERIFYING'}
              className="w-full !h-[40px] rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] font-mono text-xs sm:text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-4 h-4 text-[#A83B4D]" />
              <span>Test Scan (5-Layer)</span>
            </button>
          </div>

          {/* Bottom Control Actions */}
          <div className="flex gap-2.5 w-full mt-3">
            <button
              type="button"
              id="btn-use-password"
              onClick={handleClose}
              className="flex-1 !h-[40px] rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] text-[#670626] hover:bg-[#DFC9BE] font-mono text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
            >
              Use Password
            </button>
            <button
              type="button"
              id="btn-close-biometric"
              onClick={handleClose}
              className="flex-1 !h-[40px] rounded-xl border border-[#D5BEB3] bg-[#EFE4DD] text-[#7D2B3D] hover:bg-[#E9D9D0] font-mono text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-3 space-y-2">
            <p
              role="alert"
              className={`font-mono text-xs sm:text-sm text-center p-2.5 rounded-xl border font-semibold ${
                statusTone === 'ok'
                  ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                  : statusTone === 'bad'
                  ? 'bg-[#670626] border-[#4A041A] text-[#F7F1EA]'
                  : 'bg-[#E9D9D0] border-[#D5BEB3] text-[#670626]'
              }`}
            >
              {statusMessage}
            </p>
            {statusTone === 'bad' &&
              email.trim().includes('@') &&
              statusMessage.toLowerCase().includes('no active biometric enrollment') && (
                <button
                  type="button"
                  id="btn-fallback-1ton-scan"
                  onClick={handleDirect1ToNScan}
                  className="w-full !h-[38px] rounded-xl border border-emerald-600/45 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <ScanFace className="w-4 h-4 text-emerald-700" />
                  <span>Switch to 1:N Face Scan (Find My Account)</span>
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BiometricLoginModal;
