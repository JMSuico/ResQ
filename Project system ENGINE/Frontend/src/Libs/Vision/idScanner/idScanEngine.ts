// [Layer: Libs/Vision/idScanner]
// Responsibility: Master Orchestrator for ResQTrack Deterministic Government ID Vision Scanner (Upload-Only Front & Back Pipeline).
// Coordinates: Quality Gates -> Canny/Contour Quad Detection (+ Pre-Cropped Full-Frame Upload Fallback) ->
// Homography Rectification -> Preprocessing/Sauvola -> Layout Map Classification ->
// Multi-Pass ROI + Full-Body CCL & Glyph OCR -> Spatial FSM Parser -> Checksum/Repair Validation ->
// Multi-Provider AI Standby Fallback + Deterministic Front & Back Field Merging.
// Invariant: Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>). Zero emojis.

import { QualityGateEvaluation } from './qualityGates';
import { Point2D } from './cannyHough';
import { GovernmentIdCategory } from './idSpecs';
import { CardPresenceEvaluation } from './cardPresenceGate';
import {
  getIdScanConfidenceTier,
  IdScanConfidenceTier,
  sanitizeExtractedPersonName,
  validateIdNumber,
  parseNameComponents
} from './validators';
import { providerRegistry, IdOcrResult } from './ai';
import { scanCardWithOnDeviceWasm, OnDeviceOcrResult } from './onDeviceWasmOcr';
import {
  runPhilippineIdRecognitionPipeline,
  type DocumentAnalysisResult,
} from './idRecognitionPipeline';
import {
  WorkerRequest,
  WorkerResponse,
  WorkerFullScanResponse,
  WorkerIdScanResult,
  ExtractedFieldsPayload,
  executeFullCardScan
} from './idScanWorker';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface IdScanResult {
  readonly success: boolean;
  readonly side?: 'front' | 'back';
  readonly idCategory: GovernmentIdCategory;
  readonly confidence: number;
  readonly confidenceTier: IdScanConfidenceTier;
  readonly fields: ExtractedFieldsPayload;
  readonly quality: QualityGateEvaluation;
  readonly corners: Point2D[];
  readonly rectifiedImageData?: ImageData;
  readonly rectifiedImageUrl?: string;
  readonly portraitImageData?: ImageData;
  readonly portraitImageUrl?: string;
  readonly executionTimeMs: number;
  readonly method: 'DETERMINISTIC_CV' | 'AI_STANDBY_FALLBACK';
  readonly aiProviderUsed?: string;
  readonly rawText: string;
  readonly error?: string;
  readonly cardPresence?: CardPresenceEvaluation;
  readonly documentAnalysis?: DocumentAnalysisResult;
}

export interface IdScannerEngineConfig {
  readonly minConfidenceToAutofill: number; // default: 0.65
  readonly enableAiStandbyFallback: boolean; // default: true
  readonly targetRatios: readonly number[]; // default: [1.5858, 1.4205]
  readonly useWebWorker: boolean; // default: true
}

export const DEFAULT_SCANNER_CONFIG: IdScannerEngineConfig = {
  minConfidenceToAutofill: 0.65,
  enableAiStandbyFallback: true,
  targetRatios: [1.5858, 1.4205],
  useWebWorker: true
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
// Deterministic Front + Back Field Merger
// Preserves Front primary identity fields while backfilling reverse-side fields
// (e.g., address, weight, height, serial/barcode IDs) from Back ID scan.
// ============================================================================

export const mergeFrontAndBackFields = (
  front: ExtractedFieldsPayload,
  back: ExtractedFieldsPayload
): ExtractedFieldsPayload => {
  return {
    fullname: front.fullname || undefined,
    firstName: front.firstName || undefined,
    middleName: front.middleName || undefined,
    lastName: front.lastName || undefined,
    idNumber: front.idNumber || back.idNumber,
    licenseNumber: front.licenseNumber || front.idNumber || back.licenseNumber || back.idNumber,
    employeeId: front.employeeId || back.employeeId,
    dateOfBirth: front.dateOfBirth || undefined,
    age: front.age || undefined,
    expirationDate: front.expirationDate || back.expirationDate,
    sex: front.sex || undefined,
    address: front.address || back.address || undefined,
    weight: front.weight || undefined,
    height: front.height || undefined,
    rankOrTitle: front.rankOrTitle || back.rankOrTitle
  };
};

// ============================================================================
// Master IdScanEngine Orchestrator Class (Upload-Only Front & Back Pipeline)
// ============================================================================

interface PendingWorkerTask {
  readonly resolve: (res: WorkerFullScanResponse) => void;
  readonly reject: (err: Error) => void;
  readonly type: 'FULL_SCAN';
}

export class IdScanEngine {
  private config: IdScannerEngineConfig;
  private worker: Worker | null = null;
  private pendingTasks = new Map<string, PendingWorkerTask>();

  public constructor(config: Partial<IdScannerEngineConfig> = {}) {
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...config };
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
          resolve: resolve as (res: WorkerFullScanResponse) => void,
          reject,
          type: request.type
        });
        this.worker?.postMessage(request);
      });
    }

    if (request.type === 'FULL_SCAN') {
      const result = executeFullCardScan(
        request.imageData,
        request.targetCategory,
        request.userRole,
        request.targetRatios,
        request.preLockedCorners,
        request.side ?? 'front',
        request.isStaticUpload ?? true
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
   * Primary entry point for scanning an uploaded Government ID image (Front or Back).
   * Handles both uncropped table photos and pre-cropped full-frame ID photos,
   * runs multi-pass OCR + Spatial FSM parsing, extracts the Front portrait crop for
   * Step 2 facial verification, and invokes AI Standby fallback if needed.
   */
  public readonly scanUploadedIdImage = async (
    imageData: ImageData,
    targetCategory?: GovernmentIdCategory,
    userRole?: 'Responder' | 'Civilian',
    side: 'front' | 'back' = 'front',
    preLockedCorners?: Point2D[] | null
  ): Promise<IdScanResult> => {
    const requestId = `upload_scan_${side}_${Math.random().toString(36).substring(2, 9)}`;
    const workerRes = await this.callWorkerOrInline<WorkerFullScanResponse>({
      id: requestId,
      type: 'FULL_SCAN',
      imageData,
      targetCategory,
      userRole,
      targetRatios: this.config.targetRatios,
      preLockedCorners,
      side,
      isStaticUpload: true
    });

    if (!workerRes.success || !workerRes.result) {
      return {
        success: false,
        side,
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
    const portraitImageUrl = workerResult.portraitImageData
      ? imageDataToDataUrl(workerResult.portraitImageData)
      : undefined;

    // 100% Client-Side On-Device WebAssembly OCR Pass (Tesseract.js WebWorker)
    // Only run whole-card anchor OCR on front/data-page uploads, and NEVER overwrite validated ROI fields.
    let wasmResult: OnDeviceOcrResult | null = null;
    const wasmInput = rectifiedImageUrl || (typeof document !== 'undefined' ? imageDataToDataUrl(imageData) : imageData);
    if (wasmInput && side === 'front') {
      try {
        wasmResult = await scanCardWithOnDeviceWasm(wasmInput);
      } catch (wasmErr: unknown) {
        console.warn('[IdScanEngine] On-Device WebAssembly OCR execution warning:', wasmErr);
      }
    }

    // Merge on-device WASM OCR extracted fields ONLY for missing worker fields (ROI takes precedence)
    let mergedFields: ExtractedFieldsPayload = { ...workerResult.fields };
    let rawTextCombined = workerResult.rawText || '';

    if (wasmResult && wasmResult.success && side === 'front') {
      const validWasmEntries = Object.entries(wasmResult.fields).filter(([k, v]) => {
        const existingVal = (mergedFields as Record<string, string | undefined>)[k];
        return Boolean(v) && !existingVal;
      });
      mergedFields = {
        ...mergedFields,
        ...Object.fromEntries(validWasmEntries)
      };
      if (wasmResult.rawText) {
        rawTextCombined = rawTextCombined
          ? `${rawTextCombined}\n${wasmResult.rawText}`
          : wasmResult.rawText;
      }
    }

    const hasWasmResolvedFront = Boolean(
      mergedFields.fullname || mergedFields.lastName || mergedFields.licenseNumber || mergedFields.idNumber
    );

    // Evaluate if AI Standby Fallback is necessary (only if on-device WASM and deterministic CV could not resolve core fields)
    if (
      this.config.enableAiStandbyFallback &&
      (workerResult.confidence < this.config.minConfidenceToAutofill ||
        (side === 'front' && !hasWasmResolvedFront)) &&
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
          const finalFullname = sanitizedAiName || mergedFields.fullname || workerResult.fields.fullname;

          const rawAiId = aiResult.fields['IdNumber']?.value || aiResult.fields['idNumber']?.value;
          let finalIdNumber = mergedFields.idNumber || workerResult.fields.idNumber;
          if (rawAiId) {
            const val = validateIdNumber(workerResult.idCategory, rawAiId);
            finalIdNumber = val.isValid ? val.normalized : rawAiId;
          }

          const nameParts = parseNameComponents(finalFullname || '');
          const aiMergedFields: ExtractedFieldsPayload = {
            fullname: finalFullname,
            firstName:
              aiResult.fields['FirstName']?.value ||
              aiResult.fields['firstName']?.value ||
              mergedFields.firstName ||
              nameParts.firstName ||
              undefined,
            middleName:
              aiResult.fields['MiddleName']?.value ||
              aiResult.fields['middleName']?.value ||
              mergedFields.middleName ||
              nameParts.middleName ||
              undefined,
            lastName:
              aiResult.fields['LastName']?.value ||
              aiResult.fields['lastName']?.value ||
              mergedFields.lastName ||
              nameParts.lastName ||
              undefined,
            idNumber: finalIdNumber,
            licenseNumber:
              aiResult.fields['LicenseNumber']?.value ||
              aiResult.fields['licenseNumber']?.value ||
              mergedFields.licenseNumber ||
              (workerResult.idCategory === 'drivers' ? finalIdNumber : undefined),
            employeeId:
              aiResult.fields['EmployeeId']?.value ||
              aiResult.fields['employeeId']?.value ||
              mergedFields.employeeId ||
              (userRole === 'Responder' ? finalIdNumber : undefined),
            dateOfBirth:
              aiResult.fields['DateOfBirth']?.value ||
              aiResult.fields['dateOfBirth']?.value ||
              mergedFields.dateOfBirth,
            expirationDate:
              aiResult.fields['ExpirationDate']?.value ||
              aiResult.fields['expirationDate']?.value ||
              mergedFields.expirationDate,
            sex:
              aiResult.fields['Sex']?.value ||
              aiResult.fields['sex']?.value ||
              mergedFields.sex,
            address:
              aiResult.fields['Address']?.value ||
              aiResult.fields['address']?.value ||
              mergedFields.address,
            weight:
              aiResult.fields['Weight']?.value ||
              aiResult.fields['weight']?.value ||
              mergedFields.weight,
            height:
              aiResult.fields['Height']?.value ||
              aiResult.fields['height']?.value ||
              mergedFields.height,
            rankOrTitle:
              aiResult.fields['Rank']?.value ||
              aiResult.fields['rank']?.value ||
              mergedFields.rankOrTitle
          };

          const idValidationPass = finalIdNumber
            ? validateIdNumber(workerResult.idCategory, finalIdNumber).isValid
            : false;
          const aiScore = aiResult.consensusScore ?? 0.88;
          const aiConfidence = Math.min(
            0.98,
            Math.max(
              workerResult.confidence,
              0.35 * workerResult.confidence + 0.45 * aiScore + (idValidationPass ? 0.20 : 0.05)
            )
          );
          const aiTier = getIdScanConfidenceTier(aiConfidence);

          return {
            success: true,
            side,
            idCategory: workerResult.idCategory,
            confidence: aiConfidence,
            confidenceTier: aiTier,
            fields: aiMergedFields,
            quality: workerResult.quality,
            corners: workerResult.corners,
            rectifiedImageData: workerResult.rectifiedImageData,
            rectifiedImageUrl,
            portraitImageData: workerResult.portraitImageData,
            portraitImageUrl,
            executionTimeMs: workerResult.executionTimeMs + aiResult.executionTimeMs + (wasmResult?.executionTimeMs || 0),
            method: 'AI_STANDBY_FALLBACK',
            aiProviderUsed: aiResult.providerUsed,
            rawText: aiResult.rawText || rawTextCombined,
            cardPresence: workerResult.cardPresence
          };
        }
      } catch (aiErr: unknown) {
        console.warn('[IdScanEngine] AI standby fallback error:', aiErr);
      }
    }

    const hasCoreFields = Boolean(
      mergedFields &&
        (mergedFields.fullname ||
          mergedFields.firstName ||
          mergedFields.lastName ||
          mergedFields.licenseNumber ||
          mergedFields.idNumber ||
          mergedFields.employeeId ||
          mergedFields.address ||
          mergedFields.weight ||
          mergedFields.height)
    );

    const calculatedConfidence = wasmResult?.success
      ? Math.max(workerResult.confidence, wasmResult.confidence)
      : workerResult.confidence;
    const finalTier = getIdScanConfidenceTier(calculatedConfidence);

    const documentAnalysis = runPhilippineIdRecognitionPipeline({
      rawText: rawTextCombined,
      extractedFields: mergedFields as Record<string, string | undefined>,
      targetCategory,
      expectedSide: side,
      qualityGate: {
        passed: workerResult.quality.passed,
        blurVariance: workerResult.quality.details.laplacian,
        glareRatio: workerResult.quality.details.glare,
        brightness: workerResult.quality.details.exposure,
        failureReason: workerResult.quality.reasons[0] ?? null,
      },
    });

    const resolvedCategory: GovernmentIdCategory =
      documentAnalysis.classification.categoryKey !== 'unknown'
        ? documentAnalysis.classification.categoryKey
        : workerResult.idCategory;

    // Enforce NCDA AO No. 001 (2026) PWD biometric profiling prohibition
    const safePortraitData =
      documentAnalysis.privacyCompliance.allowBiometricProfiling ? workerResult.portraitImageData : undefined;
    const safePortraitUrl =
      documentAnalysis.privacyCompliance.allowBiometricProfiling ? portraitImageUrl : undefined;

    const isSuccessful = Boolean(
      (workerResult.success || (wasmResult && wasmResult.success)) &&
        documentAnalysis.overallStatus !== 'UNSUPPORTED_DOCUMENT' &&
        (side === 'back' || hasCoreFields || calculatedConfidence >= this.config.minConfidenceToAutofill)
    );

    return {
      success: isSuccessful,
      side,
      idCategory: resolvedCategory,
      confidence: calculatedConfidence,
      confidenceTier: finalTier,
      fields: mergedFields,
      quality: workerResult.quality,
      corners: workerResult.corners,
      rectifiedImageData: workerResult.rectifiedImageData,
      rectifiedImageUrl,
      portraitImageData: safePortraitData,
      portraitImageUrl: safePortraitUrl,
      executionTimeMs: workerResult.executionTimeMs + (wasmResult?.executionTimeMs || 0),
      method: 'DETERMINISTIC_CV',
      rawText: rawTextCombined,
      cardPresence: workerResult.cardPresence,
      documentAnalysis,
      error: isSuccessful ? undefined : workerResult.error || 'Failed to detect or parse valid government ID'
    };
  };

  /**
   * Backward-compatible alias for `scanUploadedIdImage` (defaults to `side = 'front'`).
   */
  public readonly scanCard = async (
    imageData: ImageData,
    targetCategory?: GovernmentIdCategory,
    userRole?: 'Responder' | 'Civilian',
    preLockedCorners?: Point2D[] | null,
    side: 'front' | 'back' = 'front'
  ): Promise<IdScanResult> => {
    return this.scanUploadedIdImage(imageData, targetCategory, userRole, side, preLockedCorners);
  };

  /**
   * Cancels any pending worker tasks.
   */
  public readonly stop = (): void => {
    if (this.pendingTasks.size > 0) {
      this.pendingTasks.forEach((task) => {
        task.reject(new Error('ID scan operation cancelled: Engine stopped'));
      });
      this.pendingTasks.clear();
    }
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
  };
}

// Global default singleton instance
export const idScanEngine = new IdScanEngine();
