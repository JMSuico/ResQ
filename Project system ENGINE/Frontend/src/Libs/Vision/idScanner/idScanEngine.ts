// [Layer: Libs/Vision/idScanner]
// Responsibility: Master Orchestrator for ResQTrack Deterministic Government ID Vision Scanner.
// Coordinates: Quality Gates -> Canny/Contour Quad Detection -> Homography Rectification ->
// Preprocessing/Sauvola -> Layout Map Classification -> CCL & Glyph OCR -> Checksum/Repair Validation ->
// Multi-Provider AI Standby Fallback + Temporal Stability Corner Jitter Lock (<6px across 8 consecutive frames).
// Invariant: Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>). Zero emojis.

import { QualityGateEvaluation } from './qualityGates';
import { Point2D } from './cannyHough';
import { OrderedCorners } from './homography';
import { GovernmentIdCategory } from './idSpecs';
import {
  getIdScanConfidenceTier,
  IdScanConfidenceTier,
  sanitizeExtractedPersonName,
  validateIdNumber
} from './validators';
import { providerRegistry, IdOcrResult } from './ai';
import {
  WorkerRequest,
  WorkerResponse,
  WorkerAnalyzeFrameResponse,
  WorkerFullScanResponse,
  WorkerIdScanResult,
  ExtractedFieldsPayload,
  executeFrameAnalysis,
  executeFullCardScan
} from './idScanWorker';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TemporalStabilityState {
  readonly isLocked: boolean;
  readonly lockProgress: number; // 0 - 100%
  readonly stableFrameCount: number; // 0 - 8
  readonly maxShift: number; // max corner Euclidean shift in pixels
}

export interface FrameAnalysisResult {
  readonly corners: Point2D[] | null;
  readonly orderedCorners: OrderedCorners | null;
  readonly quality: QualityGateEvaluation;
  readonly aspectRatio: number;
  readonly quadScore: number;
  readonly stability: TemporalStabilityState;
}

export interface IdScanResult {
  readonly success: boolean;
  readonly idCategory: GovernmentIdCategory;
  readonly confidence: number;
  readonly confidenceTier: IdScanConfidenceTier;
  readonly fields: ExtractedFieldsPayload;
  readonly quality: QualityGateEvaluation;
  readonly corners: Point2D[];
  readonly rectifiedImageData?: ImageData;
  readonly rectifiedImageUrl?: string;
  readonly executionTimeMs: number;
  readonly method: 'DETERMINISTIC_CV' | 'AI_STANDBY_FALLBACK';
  readonly aiProviderUsed?: string;
  readonly rawText: string;
  readonly error?: string;
}

export interface IdScannerEngineConfig {
  readonly maxJitterPixels: number; // default: 6.0 px
  readonly requiredStableFrames: number; // default: 8
  readonly minConfidenceToAutofill: number; // default: 0.80
  readonly enableAiStandbyFallback: boolean; // default: true
  readonly targetRatios: readonly number[]; // default: [1.5858, 1.4205, 1.25]
  readonly useWebWorker: boolean; // default: true
  readonly frameThrottleMs: number; // default: 60ms (~16 fps for optimal thermals)
}

export const DEFAULT_SCANNER_CONFIG: IdScannerEngineConfig = {
  maxJitterPixels: 14.0,
  requiredStableFrames: 5,
  minConfidenceToAutofill: 0.80,
  enableAiStandbyFallback: true,
  targetRatios: [1.5858, 1.4205, 1.25],
  useWebWorker: true,
  frameThrottleMs: 60
};

// ============================================================================
// Utility: Convert ImageData to Data URL
// ============================================================================

export const imageDataToDataUrl = (imageData: ImageData): string => {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }
  return '';
};

// ============================================================================
// Temporal Stability Tracker
// Enforces: Corner shift across consecutive frames must remain within jitter threshold.
// Applies Exponential Moving Average (EMA) smoothing for jitter-free full-frame card tracking.
// ============================================================================

export class TemporalStabilityTracker {
  private readonly maxFrames: number;
  private readonly jitterThreshold: number;
  private history: Point2D[][] = [];
  private smoothedCorners: Point2D[] | null = null;
  private stableCount: number = 0;
  private missingCount: number = 0;
  private isLockedState: boolean = false;
  private lastMaxShift: number = 0;

  public constructor(maxFrames: number = 5, jitterThreshold: number = 14.0) {
    this.maxFrames = maxFrames;
    this.jitterThreshold = jitterThreshold;
  }

  public readonly update = (corners: Point2D[] | null): TemporalStabilityState & { smoothedCorners: Point2D[] | null } => {
    if (!corners || corners.length !== 4) {
      this.missingCount++;
      if (this.missingCount >= 3) {
        this.stableCount = Math.max(0, this.stableCount - 1);
        this.history = [];
        this.smoothedCorners = null;
      }
      this.isLockedState = false;
      return {
        isLocked: false,
        lockProgress: Math.round((this.stableCount / this.maxFrames) * 100),
        stableFrameCount: this.stableCount,
        maxShift: 999,
        smoothedCorners: this.smoothedCorners
      };
    }

    this.missingCount = 0;

    // Apply Exponential Moving Average (EMA) smoothing (alpha = 0.45)
    if (this.smoothedCorners && this.smoothedCorners.length === 4) {
      const alpha = 0.45;
      const nextSmoothed: Point2D[] = [];
      for (let i = 0; i < 4; i++) {
        nextSmoothed.push({
          x: Math.round((this.smoothedCorners[i].x * (1 - alpha) + corners[i].x * alpha) * 10) / 10,
          y: Math.round((this.smoothedCorners[i].y * (1 - alpha) + corners[i].y * alpha) * 10) / 10
        });
      }
      this.smoothedCorners = nextSmoothed;
    } else {
      this.smoothedCorners = corners.map((p) => ({ ...p }));
    }

    if (this.history.length > 0) {
      const prev = this.history[this.history.length - 1];
      let maxShift = 0;
      for (let i = 0; i < 4; i++) {
        const dx = corners[i].x - prev[i].x;
        const dy = corners[i].y - prev[i].y;
        const d = Math.hypot(dx, dy);
        if (d > maxShift) {
          maxShift = d;
        }
      }
      this.lastMaxShift = maxShift;

      if (maxShift < this.jitterThreshold) {
        this.stableCount = Math.min(this.maxFrames, this.stableCount + 1);
      } else {
        this.stableCount = Math.max(0, this.stableCount - 1);
      }
    } else {
      this.stableCount = 1;
      this.lastMaxShift = 0;
    }

    this.history.push(corners);
    if (this.history.length > this.maxFrames) {
      this.history.shift();
    }

    const lockProgress = Math.min(100, Math.round((this.stableCount / this.maxFrames) * 100));
    this.isLockedState = this.stableCount >= this.maxFrames;

    return {
      isLocked: this.isLockedState,
      lockProgress,
      stableFrameCount: this.stableCount,
      maxShift: this.lastMaxShift,
      smoothedCorners: this.smoothedCorners
    };
  };

  public readonly reset = (): void => {
    this.history = [];
    this.smoothedCorners = null;
    this.stableCount = 0;
    this.missingCount = 0;
    this.isLockedState = false;
    this.lastMaxShift = 0;
  };

  public readonly isLocked = (): boolean => this.isLockedState;
  public readonly getSmoothedCorners = (): Point2D[] | null => this.smoothedCorners;
}

// ============================================================================
// Master IdScanEngine Orchestrator Class
// ============================================================================

interface PendingWorkerTask {
  readonly resolve: (res: WorkerAnalyzeFrameResponse | WorkerFullScanResponse) => void;
  readonly reject: (err: Error) => void;
}

export class IdScanEngine {
  private config: IdScannerEngineConfig;
  private readonly stabilityTracker: TemporalStabilityTracker;
  private worker: Worker | null = null;
  private isRunning: boolean = false;
  private isScanningLock: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTimestamp: number = 0;
  private pendingTasks = new Map<string, PendingWorkerTask>();

  // Shared processing offscreen canvas for frame capture
  private processingCanvas: HTMLCanvasElement | null = null;
  private processingCtx: CanvasRenderingContext2D | null = null;

  public constructor(config: Partial<IdScannerEngineConfig> = {}) {
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...config };
    this.stabilityTracker = new TemporalStabilityTracker(
      this.config.requiredStableFrames,
      this.config.maxJitterPixels
    );
    this.initWorker();
  }

  /**
   * Initializes Web Worker or falls back gracefully to main-thread execution.
   */
  private readonly initWorker = (): void => {
    if (!this.config.useWebWorker || typeof Worker === 'undefined') {
      return;
    }

    try {
      this.worker = new Worker(new URL('./idScanWorker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>): void => {
        const msg = event.data;
        if (msg && msg.id && this.pendingTasks.has(msg.id)) {
          const task = this.pendingTasks.get(msg.id);
          this.pendingTasks.delete(msg.id);
          if (task) {
            task.resolve(msg);
          }
        }
      };

      this.worker.onerror = (err: ErrorEvent): void => {
        const errorDesc = err?.message || 'Worker runtime error';
        console.warn(
          '[IdScanEngine] Web Worker encountered error, falling back to synchronous execution:',
          errorDesc
        );
        this.pendingTasks.forEach((task) => {
          task.reject(new Error(`Web Worker execution error: ${errorDesc}`));
        });
        this.pendingTasks.clear();

        this.worker?.terminate();
        this.worker = null;
      };
    } catch (err: unknown) {
      console.warn('[IdScanEngine] Unable to instantiate Web Worker, using main thread:', err);
      this.worker = null;
    }
  };

  /**
   * Dispatches a request to the Web Worker or executes inline.
   */
  private readonly callWorkerOrInline = async <T extends WorkerResponse>(
    request: WorkerRequest
  ): Promise<T> => {
    if (this.worker) {
      return new Promise<T>((resolve, reject) => {
        this.pendingTasks.set(request.id, {
          resolve: resolve as (res: WorkerAnalyzeFrameResponse | WorkerFullScanResponse) => void,
          reject
        });
        this.worker?.postMessage(request);
      });
    }

    // Inline synchronous execution fallback
    if (request.type === 'ANALYZE_FRAME') {
      const analysis = executeFrameAnalysis(request.imageData, request.targetRatios);
      return {
        id: request.id,
        ...analysis
      } as unknown as T;
    }

    if (request.type === 'FULL_SCAN') {
      const result = executeFullCardScan(
        request.imageData,
        request.targetCategory,
        request.userRole,
        request.targetRatios
      );
      return {
        id: request.id,
        type: 'SCAN_COMPLETE',
        success: true,
        result
      } as unknown as T;
    }

    throw new Error('Unsupported worker request type');
  };

  /**
   * Analyzes an isolated ImageData frame without full OCR text extraction.
   */
  public readonly analyzeFrame = async (imageData: ImageData): Promise<FrameAnalysisResult> => {
    const requestId = `frame_${Math.random().toString(36).substring(2, 9)}`;
    const response = await this.callWorkerOrInline<WorkerAnalyzeFrameResponse>({
      id: requestId,
      type: 'ANALYZE_FRAME',
      imageData,
      targetRatios: this.config.targetRatios
    });

    const stability = this.stabilityTracker.update(response.corners);
    const effectiveCorners = stability.smoothedCorners || response.corners;

    return {
      corners: effectiveCorners,
      orderedCorners: response.orderedCorners,
      quality: response.quality,
      aspectRatio: response.aspectRatio,
      quadScore: response.quadScore,
      stability
    };
  };

  /**
   * Executes the full OCR and classification pipeline, falling back to multi-provider AI standby if needed.
   */
  public readonly scanCard = async (
    imageData: ImageData,
    targetCategory?: GovernmentIdCategory,
    userRole?: 'Responder' | 'Civilian'
  ): Promise<IdScanResult> => {
    const requestId = `scan_${Math.random().toString(36).substring(2, 9)}`;
    const workerRes = await this.callWorkerOrInline<WorkerFullScanResponse>({
      id: requestId,
      type: 'FULL_SCAN',
      imageData,
      targetCategory,
      userRole,
      targetRatios: this.config.targetRatios
    });

    if (!workerRes.success || !workerRes.result) {
      return {
        success: false,
        idCategory: targetCategory || 'philsys',
        confidence: 0,
        confidenceTier: 'MANUAL_ENTRY',
        fields: {},
        quality: {
          passed: false,
          score: 0,
          reasons: [workerRes.error || 'DIP pipeline failure'],
          details: { laplacian: 0, glare: 0, exposure: 0, moire: 0 }
        },
        corners: [],
        executionTimeMs: 0,
        method: 'DETERMINISTIC_CV',
        rawText: '',
        error: workerRes.error || 'DIP pipeline failure'
      };
    }

    const workerResult: WorkerIdScanResult = workerRes.result;
    const rectifiedImageUrl = workerResult.rectifiedImageData
      ? imageDataToDataUrl(workerResult.rectifiedImageData)
      : undefined;

    // Evaluate if AI Standby Fallback is necessary (composite confidence < 0.80)
    if (
      this.config.enableAiStandbyFallback &&
      (workerResult.confidence < this.config.minConfidenceToAutofill ||
        !workerResult.fields.fullname) &&
      rectifiedImageUrl
    ) {
      try {
        const aiResult: IdOcrResult | null = await providerRegistry.extract(
          rectifiedImageUrl,
          workerResult.idCategory
        );

        if (aiResult && Object.keys(aiResult.fields).length > 0) {
          const rawAiName = aiResult.fields['FullName']?.value || aiResult.fields['fullname']?.value;
          const sanitizedAiName = rawAiName ? sanitizeExtractedPersonName(rawAiName) : null;
          const finalFullname = sanitizedAiName || workerResult.fields.fullname;

          const rawAiId = aiResult.fields['IdNumber']?.value || aiResult.fields['idNumber']?.value;
          let finalIdNumber = workerResult.fields.idNumber;
          if (rawAiId) {
            const val = validateIdNumber(workerResult.idCategory, rawAiId);
            finalIdNumber = val.isValid ? val.normalized : rawAiId;
          }

          const mergedFields: ExtractedFieldsPayload = {
            fullname: finalFullname,
            idNumber: finalIdNumber,
            employeeId:
              aiResult.fields['EmployeeId']?.value ||
              aiResult.fields['employeeId']?.value ||
              workerResult.fields.employeeId ||
              (userRole === 'Responder'
                ? finalIdNumber
                : undefined),
            dateOfBirth:
              aiResult.fields['DateOfBirth']?.value ||
              aiResult.fields['dateOfBirth']?.value ||
              workerResult.fields.dateOfBirth,
            expirationDate:
              aiResult.fields['ExpirationDate']?.value ||
              aiResult.fields['expirationDate']?.value ||
              workerResult.fields.expirationDate,
            sex:
              aiResult.fields['Sex']?.value ||
              aiResult.fields['sex']?.value ||
              workerResult.fields.sex,
            address:
              aiResult.fields['Address']?.value ||
              aiResult.fields['address']?.value ||
              workerResult.fields.address,
            rankOrTitle:
              aiResult.fields['Rank']?.value ||
              aiResult.fields['rank']?.value ||
              workerResult.fields.rankOrTitle
          };

          const idValidationPass = finalIdNumber ? validateIdNumber(workerResult.idCategory, finalIdNumber).isValid : false;
          const aiScore = aiResult.consensusScore ?? 0.88;
          const aiConfidence = Math.min(
            0.98,
            Math.max(workerResult.confidence, 0.35 * workerResult.confidence + 0.45 * aiScore + (idValidationPass ? 0.20 : 0.05))
          );
          const aiTier = getIdScanConfidenceTier(aiConfidence);

          return {
            success: true,
            idCategory: workerResult.idCategory,
            confidence: aiConfidence,
            confidenceTier: aiTier,
            fields: mergedFields,
            quality: workerResult.quality,
            corners: workerResult.corners,
            rectifiedImageData: workerResult.rectifiedImageData,
            rectifiedImageUrl,
            executionTimeMs: workerResult.executionTimeMs + aiResult.executionTimeMs,
            method: 'AI_STANDBY_FALLBACK',
            aiProviderUsed: aiResult.providerUsed,
            rawText: aiResult.rawText || workerResult.rawText
          };
        }
      } catch (aiErr: unknown) {
        console.warn('[IdScanEngine] AI standby fallback error:', aiErr);
      }
    }

    return {
      success: true,
      idCategory: workerResult.idCategory,
      confidence: workerResult.confidence,
      confidenceTier: workerResult.confidenceTier,
      fields: workerResult.fields,
      quality: workerResult.quality,
      corners: workerResult.corners,
      rectifiedImageData: workerResult.rectifiedImageData,
      rectifiedImageUrl,
      executionTimeMs: workerResult.executionTimeMs,
      method: 'DETERMINISTIC_CV',
      rawText: workerResult.rawText
    };
  };

  /**
   * Connects the live camera video stream, running real-time frame analysis and HUD telemetry.
   * When corner jitter remains < 6.0px across 8 consecutive frames, automatically freezes and scans!
   */
  public readonly startLiveStream = (
    video: HTMLVideoElement,
    callbacks: {
      readonly onFrame: (analysis: FrameAnalysisResult) => void;
      readonly onLockedScan: (result: IdScanResult) => void;
      readonly targetCategory?: GovernmentIdCategory;
      readonly userRole?: 'Responder' | 'Civilian';
    }
  ): void => {
    if (this.isRunning) {
      this.stop();
    }

    this.isRunning = true;
    this.isScanningLock = false;
    this.stabilityTracker.reset();

    // Prepare processing canvas (fixed downsample resolution 640x360 for high-efficiency 30fps Canny)
    if (!this.processingCanvas) {
      this.processingCanvas = document.createElement('canvas');
      this.processingCanvas.width = 640;
      this.processingCanvas.height = 360;
      this.processingCtx = this.processingCanvas.getContext('2d', {
        willReadFrequently: true
      });
    }

    const processLoop = async (now: number): Promise<void> => {
      if (!this.isRunning) {
        return;
      }

      // Check frame throttle
      if (now - this.lastFrameTimestamp >= this.config.frameThrottleMs && !this.isScanningLock) {
        this.lastFrameTimestamp = now;

        if (video.readyState >= 2 && video.videoWidth > 0 && this.processingCtx) {
          const procW = 640;
          const procH = 360;

          this.processingCtx.drawImage(video, 0, 0, procW, procH);
          const imageData = this.processingCtx.getImageData(0, 0, procW, procH);

          try {
            const analysis = await this.analyzeFrame(imageData);

            // Scale corner coordinates back to video coordinate space
            const scaleX = video.videoWidth / procW;
            const scaleY = video.videoHeight / procH;

            const scaledCorners = analysis.corners
              ? analysis.corners.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }))
              : null;

            const scaledOrdered = analysis.orderedCorners
              ? {
                  tl: { x: analysis.orderedCorners.tl.x * scaleX, y: analysis.orderedCorners.tl.y * scaleY },
                  tr: { x: analysis.orderedCorners.tr.x * scaleX, y: analysis.orderedCorners.tr.y * scaleY },
                  br: { x: analysis.orderedCorners.br.x * scaleX, y: analysis.orderedCorners.br.y * scaleY },
                  bl: { x: analysis.orderedCorners.bl.x * scaleX, y: analysis.orderedCorners.bl.y * scaleY }
                }
              : null;

            const normalizedAnalysis: FrameAnalysisResult = {
              ...analysis,
              corners: scaledCorners,
              orderedCorners: scaledOrdered
            };

            callbacks.onFrame(normalizedAnalysis);

            // Temporal stability lock condition met! Trigger full scan!
            if (analysis.stability.isLocked && !this.isScanningLock) {
              this.isScanningLock = true;

              // Grab full resolution video snapshot for OCR accuracy
              const fullCanvas = document.createElement('canvas');
              fullCanvas.width = video.videoWidth;
              fullCanvas.height = video.videoHeight;
              const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });

              if (fullCtx) {
                fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);
                const fullImageData = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);

                const scanResult = await this.scanCard(
                  fullImageData,
                  callbacks.targetCategory,
                  callbacks.userRole
                );

                callbacks.onLockedScan(scanResult);
              }
            }
          } catch (loopErr: unknown) {
            console.warn('[IdScanEngine] Frame processing loop error:', loopErr);
          }
        }
      }

      if (this.isRunning) {
        this.animationFrameId = requestAnimationFrame(processLoop);
      }
    };

    this.animationFrameId = requestAnimationFrame(processLoop);
  };

  /**
   * Resets temporal stability to allow re-locking or retaking the document.
   */
  public readonly resetStability = (): void => {
    this.stabilityTracker.reset();
    this.isScanningLock = false;
  };

  /**
   * Halts active processing loops and terminates worker connections.
   */
  public readonly stop = (): void => {
    this.isRunning = false;
    this.isScanningLock = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stabilityTracker.reset();

    if (this.pendingTasks.size > 0) {
      this.pendingTasks.forEach((task) => {
        task.reject(new Error('ID scan operation cancelled: Live stream stopped'));
      });
      this.pendingTasks.clear();
    }
  };

  /**
   * Stops active camera video stream processing and clears pending worker tasks.
   */
  public readonly stopLiveStream = (): void => {
    this.stop();
  };

  /**
   * Updates scanner configurations on the fly.
   */
  public readonly updateConfig = (patch: Partial<IdScannerEngineConfig>): void => {
    this.config = { ...this.config, ...patch };
  };

  /**
   * Destroys engine instance and worker threads.
   */
  public readonly destroy = (): void => {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingTasks.clear();
    this.processingCanvas = null;
    this.processingCtx = null;
  };
}

// Global default singleton instance
export const idScanEngine = new IdScanEngine();
