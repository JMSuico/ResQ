// [Layer: Frontend/Libs/Vision/idScanner/ai]
// Responsibility: Claude Sonnet Vision OCR Strategy implementation for dual-side Government ID visible-only text extraction with model failover.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, ZERO hardcoded fallback PII, and 100% Universal Arrow Lambda syntax (=>).

import type {
  AiProviderId,
  ExtractedFieldsMap,
  IAiOcrProvider,
  IdOcrResult
} from './AiOcrProvider';
import type { RoboflowPredictionBox } from '@/components/RoboflowDetectionOverlay';
import {
  type OcrErrorCode,
  buildMissingFrontImageWarning,
  composeVisibleAddress,
  computeAgeFromIsoDob,
  containsBannedDummyToken,
  normalizeVisibleSex,
  sanitizeVisibleOcrFields
} from './ocrFieldUtils';

export const PRIMARY_CLAUDE_OCR_MODEL = 'claude-sonnet-4-6';
export const FALLBACK_CLAUDE_OCR_MODEL = 'claude-sonnet-5-5';

const ROBOFLOW_CLASS_ALIAS_MAP: Readonly<Record<string, string>> = {
  driver: 'drivers',
  drivers: 'drivers',
  driver_license: 'drivers',
  drivers_license: 'drivers',
  lto: 'drivers',
  postal: 'postal',
  postal_id: 'postal',
  phlpost: 'postal',
  umid: 'umid',
  sss_umid: 'umid',
  unified_multi_purpose_id: 'umid',
  philsys: 'philsys',
  national_id: 'philsys',
  philid: 'philsys',
  passport: 'passport',
  dfa_passport: 'passport',
  prc: 'prc',
  prc_id: 'prc',
  voters: 'voters',
  voter: 'voters',
  comelec: 'voters',
  senior: 'senior',
  senior_citizen: 'senior',
  osca: 'senior',
  pwd: 'pwd'
};

/**
 * Canonicalizes Roboflow Philippine ID dataset labels (e.g., singular "driver" <-> "drivers",
 * "postal", and "umid") into canonical registration ID type keys.
 */
export const canonicalizePhilippineIdClass = (rawClass?: string | null): string => {
  if (typeof rawClass !== 'string') {
    return '';
  }
  const normalized = rawClass.trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return ROBOFLOW_CLASS_ALIAS_MAP[normalized] ?? normalized;
};

/**
 * Checks whether a selected Government ID type and a Roboflow/OCR detected ID class are equivalent.
 */
export const areEquivalentPhilippineIdClasses = (
  selectedIdType?: string | null,
  detectedClass?: string | null
): boolean => {
  const left = canonicalizePhilippineIdClass(selectedIdType);
  const right = canonicalizePhilippineIdClass(detectedClass);
  return left.length > 0 && left === right;
};

export interface ClaudeDualSideExtractRequest {
  readonly frontImage: File | Blob | string | null | undefined;
  readonly backImage?: File | Blob | string | null;
  readonly idType: string;
  readonly preferredProvider?: AiProviderId;
  readonly preferredModel?: string;
  readonly requireDualSide?: boolean;
  readonly signal?: AbortSignal;
}

export interface ClaudeNormalizedIdFields {
  readonly firstName: string;
  readonly middleName: string;
  readonly lastName: string;
  readonly suffix?: string;
  readonly fullName?: string;
  readonly sex: string;
  readonly dob: string;
  readonly age: string;
  readonly idNumber: string;
  readonly licenseNumber?: string;
  readonly expirationDate?: string;
  readonly barangay: string;
  readonly streetPurok: string;
  readonly cityOrMunicipality?: string;
  readonly province?: string;
  readonly address?: string;
  readonly weight: string;
  readonly height: string;
  readonly phoneNumber?: string;
  readonly rawText: string;
  readonly providerUsed: string;
  readonly modelUsed?: string;
  readonly confidence: number;
  readonly success?: boolean;
  readonly errorCode?: OcrErrorCode;
  readonly errorMessage?: string;
  readonly warnings?: readonly string[];
  readonly idVerificationToken?: string;
  readonly detectedIdType?: string;
  readonly detectedIdLabel?: string;
  readonly matchesSelectedIdType?: boolean;
  readonly frontSlotDetectedSide?: string;
  readonly backSlotDetectedSide?: string;
  readonly areSidesIdentical?: boolean;
  readonly authenticityVerdict?: string;
  readonly authenticityReason?: string;
  readonly requiresPendingManualReview?: boolean;
  readonly roboflowIdPredictions?: readonly RoboflowPredictionBox[];
  readonly roboflowDetectedClass?: string;
  readonly roboflowDetectedConfidence?: number;
  readonly roboflowCacheHit?: boolean;
  readonly roboflowDataset?: string;
  readonly claudeTrainingCacheActive?: boolean;
}

export interface RoboflowDetectIdResult {
  readonly success: boolean;
  readonly ranOnline: boolean;
  readonly cacheHit: boolean;
  readonly datasetSlug: string | null;
  readonly topClass: string | null;
  readonly canonicalIdType: string | null;
  readonly topConfidence: number | null;
  readonly claudeTrainingCacheActive: boolean;
  readonly matchesSelectedIdType: boolean;
  readonly predictions: readonly RoboflowPredictionBox[];
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

const VALID_OCR_ERROR_CODES: ReadonlySet<string> = new Set<OcrErrorCode>([
  'MISSING_ID_TYPE',
  'MISSING_FRONT_IMAGE',
  'MISSING_BACK_IMAGE',
  'WRONG_ID_SIDE_FRONT_EXPECTED',
  'WRONG_ID_SIDE_BACK_EXPECTED',
  'WRONG_GOVERNMENT_ID_TYPE',
  'DUPLICATE_FRONT_BACK_IMAGE',
  'FAKE_OR_AI_GENERATED_ID',
  'NON_ID_DOCUMENT',
  'UNREADABLE_OR_BLANK_IMAGE',
  'PROVIDER_UNAVAILABLE',
  'MODEL_NOT_FOUND',
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK_ERROR',
  'INVALID_RESPONSE',
  'EXTRACTION_FAILED'
]);

const FAILOVER_HTTP_STATUSES: ReadonlySet<number> = new Set([404, 429, 500, 502, 503, 529]);

const SEMANTIC_REJECTION_ERROR_CODES: ReadonlySet<string> = new Set<OcrErrorCode>([
  'MISSING_ID_TYPE',
  'MISSING_FRONT_IMAGE',
  'MISSING_BACK_IMAGE',
  'WRONG_ID_SIDE_FRONT_EXPECTED',
  'WRONG_ID_SIDE_BACK_EXPECTED',
  'WRONG_GOVERNMENT_ID_TYPE',
  'DUPLICATE_FRONT_BACK_IMAGE',
  'FAKE_OR_AI_GENERATED_ID',
  'NON_ID_DOCUMENT',
  'UNREADABLE_OR_BLANK_IMAGE'
]);

const PENDING_MANUAL_REVIEW_ERROR_CODES: ReadonlySet<string> = new Set<OcrErrorCode>([
  'PROVIDER_UNAVAILABLE',
  'MODEL_NOT_FOUND',
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK_ERROR'
]);

const resolveClaudeOcrErrorCode = (
  rawCode: unknown,
  httpStatus: number,
  fallback: OcrErrorCode = 'PROVIDER_UNAVAILABLE'
): OcrErrorCode => {
  if (typeof rawCode === 'string') {
    const normalized = rawCode.trim().toUpperCase();
    if (VALID_OCR_ERROR_CODES.has(normalized)) {
      return normalized as OcrErrorCode;
    }
  }
  if (httpStatus === 404) {
    return 'MODEL_NOT_FOUND';
  }
  if (httpStatus === 429) {
    return 'RATE_LIMITED';
  }
  if (httpStatus === 408 || httpStatus === 504) {
    return 'TIMEOUT';
  }
  if (httpStatus >= 500) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (httpStatus >= 400) {
    return 'UNREADABLE_OR_BLANK_IMAGE';
  }
  return fallback;
};

const shouldFailoverClaudeModel = (httpStatus: number, rawErrorCode?: unknown): boolean => {
  if (typeof rawErrorCode === 'string') {
    const upper = rawErrorCode.trim().toUpperCase();
    if (SEMANTIC_REJECTION_ERROR_CODES.has(upper)) {
      return false;
    }
    if (upper === 'MODEL_NOT_FOUND' || upper === 'PROVIDER_UNAVAILABLE') {
      return true;
    }
  }
  return FAILOVER_HTTP_STATUSES.has(httpStatus);
};

const resolveOcrEndpoint = (path: string): string => {
  let base = '';
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    base = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, '');
  }
  if (!base && typeof window !== 'undefined') {
    const port = window.location.port;
    if (['1996', '1997', '1998', '5173', '5174', '5175'].includes(port)) {
      base = `${window.location.protocol}//${window.location.hostname}:1999`;
    }
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Computes exact integer age string from YYYY-MM-DD or YYYY/MM/DD DOB.
 * Returns "" when DOB is missing or invalid (never returns a hardcoded fallback age).
 */
export const calculateAgeFromIsoDob = (dobString: string): string =>
  computeAgeFromIsoDob(dobString);

const dataUrlToBlob = (dataUrl: string): Blob => {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const base64 = parts[1] ?? '';
    const binary = typeof atob === 'function' ? atob(base64) : '';
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return new Blob([], { type: 'image/png' });
  }
};

interface OffscreenCanvasExtra {
  readonly toDataURL?: (type?: string, quality?: number) => string;
}

const computeDownscaledDimensions = (
  srcWidth: number,
  srcHeight: number,
  maxDim: number
): { readonly width: number; readonly height: number } => {
  if (srcWidth >= srcHeight) {
    return {
      width: maxDim,
      height: Math.max(1, Math.round((srcHeight * maxDim) / srcWidth))
    };
  }
  return {
    width: Math.max(1, Math.round((srcWidth * maxDim) / srcHeight)),
    height: maxDim
  };
};

const blobToDataUrl = async (blob: Blob, fallbackMime: string): Promise<string> => {
  const mime = blob.type || fallbackMime;
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
          resolve(reader.result);
        } else {
          reject(new Error('Invalid FileReader output'));
        }
      };
      reader.onerror = (): void => reject(new Error('FileReader conversion failed'));
      reader.readAsDataURL(blob);
    });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(bytes.length, i + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === 'function') {
    return `data:${mime};base64,${btoa(binary)}`;
  }
  throw new Error('Base64 encoder unavailable');
};

const drawSourceToJpegDataUrl = async (
  source: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
  quality: number
): Promise<string | null> => {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.drawImage(source, 0, 0, targetWidth, targetHeight);
        if (typeof offscreen.convertToBlob === 'function') {
          const outBlob = await offscreen.convertToBlob({
            type: 'image/jpeg',
            quality
          });
          const converted = await blobToDataUrl(outBlob, 'image/jpeg');
          if (converted.startsWith('data:image/')) {
            return converted;
          }
        }
        const offscreenWithToDataUrl = offscreen as unknown as OffscreenCanvasExtra;
        if (typeof offscreenWithToDataUrl.toDataURL === 'function') {
          const converted = offscreenWithToDataUrl.toDataURL('image/jpeg', quality);
          if (typeof converted === 'string' && converted.startsWith('data:image/')) {
            return converted;
          }
        }
      }
    } catch {
      // Fall through to HTMLCanvasElement fallback
    }
  }

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx && typeof canvas.toDataURL === 'function') {
        ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
        const converted = canvas.toDataURL('image/jpeg', quality);
        if (typeof converted === 'string' && converted.startsWith('data:image/')) {
          return converted;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
};

/**
 * Downscales oversized ID image data URLs so the longest edge is <= maxDim (default 1568px),
 * encoding as image/jpeg at the specified quality. Images already <= maxDim or non-DOM contexts
 * return the original dataUrl completely untouched to preserve exact bytes.
 */
export const downscaleIdImageDataUrl = async (
  dataUrl: string,
  maxDim: number = 1568,
  quality: number = 0.86
): Promise<string> => {
  if (typeof dataUrl !== 'string') {
    return dataUrl;
  }
  const trimmed = dataUrl.trim();
  if (
    !trimmed.startsWith('data:image/') ||
    !trimmed.includes(',') ||
    !Number.isFinite(maxDim) ||
    maxDim <= 0
  ) {
    return dataUrl;
  }

  const clampedQuality = Number.isFinite(quality)
    ? Math.max(0.1, Math.min(1.0, quality))
    : 0.86;
  const hasCanvasSurface =
    typeof OffscreenCanvas !== 'undefined' ||
    (typeof document !== 'undefined' && typeof document.createElement === 'function');

  if (!hasCanvasSurface) {
    return dataUrl;
  }

  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      const blob = dataUrlToBlob(trimmed);
      if (blob.size > 0) {
        bitmap = await createImageBitmap(blob);
        const srcW = bitmap.width;
        const srcH = bitmap.height;
        if (srcW > 0 && srcH > 0) {
          if (Math.max(srcW, srcH) <= maxDim) {
            return dataUrl;
          }
          const dims = computeDownscaledDimensions(srcW, srcH, maxDim);
          const scaled = await drawSourceToJpegDataUrl(
            bitmap,
            dims.width,
            dims.height,
            clampedQuality
          );
          if (scaled) {
            return scaled;
          }
        }
      }
    } catch {
      // Fall through to HTMLImageElement fallback
    } finally {
      bitmap?.close?.();
    }
  }

  if (
    typeof Image !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  ) {
    try {
      const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = (): void => {
          img.onload = null;
          img.onerror = null;
          resolve(img);
        };
        img.onerror = (): void => {
          img.onload = null;
          img.onerror = null;
          resolve(null);
        };
        img.src = trimmed;
      });

      if (!loadedImg) {
        return dataUrl;
      }

      const srcW = loadedImg.naturalWidth || loadedImg.width || 0;
      const srcH = loadedImg.naturalHeight || loadedImg.height || 0;
      if (srcW <= 0 || srcH <= 0 || Math.max(srcW, srcH) <= maxDim) {
        return dataUrl;
      }

      const dims = computeDownscaledDimensions(srcW, srcH, maxDim);
      const scaled = await drawSourceToJpegDataUrl(
        loadedImg,
        dims.width,
        dims.height,
        clampedQuality
      );
      return scaled ?? dataUrl;
    } catch {
      return dataUrl;
    }
  }

  return dataUrl;
};

const hasNonEmptyImageInput = (
  imageInput: File | Blob | string | null | undefined
): imageInput is File | Blob | string => {
  if (!imageInput) {
    return false;
  }
  if (typeof imageInput === 'string') {
    return imageInput.trim().length > 0;
  }
  return imageInput.size > 0;
};

const extractScalarFromRecord = (
  record: Record<string, unknown> | undefined,
  keys: readonly string[]
): unknown => {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    if (key in record && record[key] !== undefined) {
      return record[key];
    }
  }
  return undefined;
};

interface ClaudeDiagnosticMetadata {
  readonly idVerificationToken?: string;
  readonly detectedIdType?: string;
  readonly detectedIdLabel?: string;
  readonly matchesSelectedIdType?: boolean;
  readonly frontSlotDetectedSide?: string;
  readonly backSlotDetectedSide?: string;
  readonly areSidesIdentical?: boolean;
  readonly authenticityVerdict?: string;
  readonly authenticityReason?: string;
  readonly requiresPendingManualReview?: boolean;
  readonly roboflowIdPredictions?: readonly RoboflowPredictionBox[];
  readonly roboflowDetectedClass?: string;
  readonly roboflowDetectedConfidence?: number;
  readonly roboflowCacheHit?: boolean;
  readonly roboflowDataset?: string;
  readonly claudeTrainingCacheActive?: boolean;
}

const resolveNestedFieldsRecord = (
  payload: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined => {
  if (!payload) {
    return undefined;
  }
  if (payload.fields && typeof payload.fields === 'object') {
    return payload.fields as Record<string, unknown>;
  }
  if (payload.extractedFields && typeof payload.extractedFields === 'object') {
    return payload.extractedFields as Record<string, unknown>;
  }
  if (payload.data && typeof payload.data === 'object') {
    return payload.data as Record<string, unknown>;
  }
  return undefined;
};

const pickDiagnosticString = (
  payload: Record<string, unknown> | null | undefined,
  nestedFields: Record<string, unknown> | undefined,
  keys: readonly string[]
): string | undefined => {
  const raw =
    extractScalarFromRecord(payload ?? undefined, keys) ??
    extractScalarFromRecord(nestedFields, keys);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
};

const pickDiagnosticBoolean = (
  payload: Record<string, unknown> | null | undefined,
  nestedFields: Record<string, unknown> | undefined,
  keys: readonly string[]
): boolean | undefined => {
  const raw =
    extractScalarFromRecord(payload ?? undefined, keys) ??
    extractScalarFromRecord(nestedFields, keys);
  return typeof raw === 'boolean' ? raw : undefined;
};

const pickDiagnosticNumber = (
  payload: Record<string, unknown> | null | undefined,
  nestedFields: Record<string, unknown> | undefined,
  keys: readonly string[]
): number | undefined => {
  const raw =
    extractScalarFromRecord(payload ?? undefined, keys) ??
    extractScalarFromRecord(nestedFields, keys);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
};

const parseRoboflowPredictionBox = (item: unknown): RoboflowPredictionBox | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const rec = item as Record<string, unknown>;
  const x = extractScalarFromRecord(rec, ['x', 'X']);
  const y = extractScalarFromRecord(rec, ['y', 'Y']);
  const width = extractScalarFromRecord(rec, ['width', 'Width']);
  const height = extractScalarFromRecord(rec, ['height', 'Height']);
  const rawClass = extractScalarFromRecord(rec, ['className', 'ClassName', 'class', 'Class']);
  const confidence = extractScalarFromRecord(rec, ['confidence', 'Confidence']);
  const imageWidth = extractScalarFromRecord(rec, ['imageWidth', 'ImageWidth']);
  const imageHeight = extractScalarFromRecord(rec, ['imageHeight', 'ImageHeight']);

  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y) ||
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    height <= 0 ||
    typeof rawClass !== 'string' ||
    rawClass.trim().length === 0 ||
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence)
  ) {
    return null;
  }

  return {
    x,
    y,
    width,
    height,
    className: rawClass.trim(),
    confidence,
    imageWidth: typeof imageWidth === 'number' && imageWidth > 0 ? imageWidth : undefined,
    imageHeight: typeof imageHeight === 'number' && imageHeight > 0 ? imageHeight : undefined
  };
};

const parseRoboflowPredictionsArray = (
  payload: Record<string, unknown> | null | undefined,
  nestedFields: Record<string, unknown> | undefined,
  keys: readonly string[]
): readonly RoboflowPredictionBox[] => {
  const raw =
    extractScalarFromRecord(payload ?? undefined, keys) ??
    extractScalarFromRecord(nestedFields, keys);
  if (!Array.isArray(raw)) {
    return [];
  }
  const boxes: RoboflowPredictionBox[] = [];
  for (const entry of raw) {
    const parsed = parseRoboflowPredictionBox(entry);
    if (parsed) {
      boxes.push(parsed);
    }
  }
  return boxes;
};

const extractDiagnosticsFromPayload = (
  payload: Record<string, unknown> | null | undefined,
  nestedFields?: Record<string, unknown>
): ClaudeDiagnosticMetadata => ({
  idVerificationToken: pickDiagnosticString(payload, nestedFields, [
    'idVerificationToken',
    'IdVerificationToken'
  ]),
  detectedIdType: pickDiagnosticString(payload, nestedFields, ['detectedIdType', 'DetectedIdType']),
  detectedIdLabel: pickDiagnosticString(payload, nestedFields, [
    'detectedIdLabel',
    'DetectedIdLabel'
  ]),
  matchesSelectedIdType: pickDiagnosticBoolean(payload, nestedFields, [
    'matchesSelectedIdType',
    'MatchesSelectedIdType'
  ]),
  frontSlotDetectedSide: pickDiagnosticString(payload, nestedFields, [
    'frontSlotDetectedSide',
    'FrontSlotDetectedSide'
  ]),
  backSlotDetectedSide: pickDiagnosticString(payload, nestedFields, [
    'backSlotDetectedSide',
    'BackSlotDetectedSide'
  ]),
  areSidesIdentical: pickDiagnosticBoolean(payload, nestedFields, [
    'areSidesIdentical',
    'AreSidesIdentical'
  ]),
  authenticityVerdict: pickDiagnosticString(payload, nestedFields, [
    'authenticityVerdict',
    'AuthenticityVerdict'
  ]),
  authenticityReason: pickDiagnosticString(payload, nestedFields, [
    'authenticityReason',
    'AuthenticityReason'
  ]),
  requiresPendingManualReview: pickDiagnosticBoolean(payload, nestedFields, [
    'requiresPendingManualReview',
    'RequiresPendingManualReview'
  ]),
  roboflowIdPredictions: parseRoboflowPredictionsArray(payload, nestedFields, [
    'roboflowIdPredictions',
    'RoboflowIdPredictions',
    'predictions',
    'Predictions'
  ]),
  roboflowDetectedClass: pickDiagnosticString(payload, nestedFields, [
    'roboflowDetectedClass',
    'RoboflowDetectedClass',
    'topClass',
    'TopClass'
  ]),
  roboflowDetectedConfidence: pickDiagnosticNumber(payload, nestedFields, [
    'roboflowDetectedConfidence',
    'RoboflowDetectedConfidence',
    'topConfidence',
    'TopConfidence'
  ]),
  roboflowCacheHit: pickDiagnosticBoolean(payload, nestedFields, [
    'roboflowCacheHit',
    'RoboflowCacheHit',
    'cacheHit',
    'CacheHit'
  ]),
  roboflowDataset: pickDiagnosticString(payload, nestedFields, [
    'roboflowDataset',
    'RoboflowDataset',
    'datasetSlug',
    'DatasetSlug'
  ]),
  claudeTrainingCacheActive: pickDiagnosticBoolean(payload, nestedFields, [
    'claudeTrainingCacheActive',
    'ClaudeTrainingCacheActive'
  ])
});

const resolveRequiresPendingManualReview = (
  errorCode: OcrErrorCode,
  httpStatus: number,
  explicitFlag?: boolean
): boolean => {
  if (SEMANTIC_REJECTION_ERROR_CODES.has(errorCode)) {
    return false;
  }
  if (httpStatus === 503 || PENDING_MANUAL_REVIEW_ERROR_CODES.has(errorCode)) {
    return Boolean(explicitFlag ?? true);
  }
  return Boolean(explicitFlag ?? false);
};

const buildEmptyClaudeNormalizedFields = (options?: {
  readonly providerUsed?: string;
  readonly modelUsed?: string;
  readonly errorCode?: OcrErrorCode;
  readonly errorMessage?: string;
  readonly warnings?: readonly string[];
  readonly diagnostics?: ClaudeDiagnosticMetadata;
  readonly requiresPendingManualReview?: boolean;
}): ClaudeNormalizedIdFields => {
  const errorMessage = options?.errorMessage?.trim() || '';
  const warnings =
    options?.warnings && options.warnings.length > 0
      ? [...options.warnings]
      : errorMessage
      ? [errorMessage]
      : [];
  const diagnostics = options?.diagnostics;

  return {
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    fullName: '',
    sex: '',
    dob: '',
    age: '',
    idNumber: '',
    licenseNumber: '',
    expirationDate: '',
    barangay: '',
    streetPurok: '',
    cityOrMunicipality: '',
    province: '',
    address: '',
    weight: '',
    height: '',
    phoneNumber: '',
    rawText: '',
    providerUsed: options?.providerUsed ?? 'claude',
    modelUsed: options?.modelUsed,
    confidence: 0,
    success: false,
    errorCode: options?.errorCode ?? 'UNREADABLE_OR_BLANK_IMAGE',
    errorMessage,
    warnings,
    idVerificationToken: undefined,
    detectedIdType: diagnostics?.detectedIdType,
    detectedIdLabel: diagnostics?.detectedIdLabel,
    matchesSelectedIdType: diagnostics?.matchesSelectedIdType,
    frontSlotDetectedSide: diagnostics?.frontSlotDetectedSide,
    backSlotDetectedSide: diagnostics?.backSlotDetectedSide,
    areSidesIdentical: diagnostics?.areSidesIdentical,
    authenticityVerdict: diagnostics?.authenticityVerdict,
    authenticityReason: diagnostics?.authenticityReason,
    requiresPendingManualReview: options?.requiresPendingManualReview ?? false,
    roboflowIdPredictions: diagnostics?.roboflowIdPredictions,
    roboflowDetectedClass: diagnostics?.roboflowDetectedClass,
    roboflowDetectedConfidence: diagnostics?.roboflowDetectedConfidence,
    roboflowCacheHit: diagnostics?.roboflowCacheHit,
    roboflowDataset: diagnostics?.roboflowDataset,
    claudeTrainingCacheActive: diagnostics?.claudeTrainingCacheActive
  };
};

const parseResponseJsonSafe = async (
  response: Response
): Promise<Record<string, unknown> | null> => {
  const errorText = await response.text().catch((): string => '');
  if (!errorText) {
    return null;
  }
  try {
    return JSON.parse(errorText) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const buildHttpFailureResult = (
  payload: Record<string, unknown> | null,
  httpStatus: number,
  activeModel: string,
  fallbackMessage: string
): ClaudeNormalizedIdFields => {
  const nestedFields = resolveNestedFieldsRecord(payload);
  const providerUsedRaw = payload?.providerUsed ?? payload?.ProviderUsed ?? payload?.provider;
  const providerUsed =
    typeof providerUsedRaw === 'string' && providerUsedRaw.trim().length > 0
      ? providerUsedRaw.trim()
      : 'claude';
  const modelUsedRaw = payload?.modelUsed ?? payload?.ModelUsed ?? payload?.model;
  const modelUsed =
    typeof modelUsedRaw === 'string' && modelUsedRaw.trim().length > 0
      ? modelUsedRaw.trim()
      : activeModel;

  const rawErrorCode = payload?.errorCode ?? payload?.ErrorCode;
  const errorCode = resolveClaudeOcrErrorCode(rawErrorCode, httpStatus);
  const rawErrorMessage = payload?.errorMessage ?? payload?.ErrorMessage;
  const errorMessage =
    typeof rawErrorMessage === 'string' && rawErrorMessage.trim().length > 0
      ? rawErrorMessage.trim()
      : fallbackMessage;
  const warningsCandidate = payload?.warnings ?? payload?.Warnings;
  const rawWarnings = Array.isArray(warningsCandidate)
    ? warningsCandidate.filter((w: unknown): w is string => typeof w === 'string')
    : undefined;
  const diagnostics = extractDiagnosticsFromPayload(payload, nestedFields);

  return buildEmptyClaudeNormalizedFields({
    providerUsed,
    modelUsed,
    errorCode,
    errorMessage,
    warnings: rawWarnings,
    diagnostics,
    requiresPendingManualReview: resolveRequiresPendingManualReview(
      errorCode,
      httpStatus,
      diagnostics.requiresPendingManualReview
    )
  });
};

/**
 * Parses and sanitizes the response from /api/identity/ocr/extract using strict visible-only rules.
 * Never populates unprinted, null, or failed fields with dummy specimen values.
 */
export const parseClaudeOcrApiResponse = (
  payload: Record<string, unknown>,
  _idType?: string
): ClaudeNormalizedIdFields => {
  const providerUsedRaw = payload.providerUsed ?? payload.ProviderUsed ?? payload.provider;
  const providerUsed =
    typeof providerUsedRaw === 'string' && providerUsedRaw.trim().length > 0
      ? providerUsedRaw.trim()
      : 'claude';
  const modelUsedRaw = payload.modelUsed ?? payload.ModelUsed ?? payload.model;
  const modelUsed =
    typeof modelUsedRaw === 'string' && modelUsedRaw.trim().length > 0
      ? modelUsedRaw.trim()
      : undefined;

  const nestedFields = resolveNestedFieldsRecord(payload);
  const diagnostics = extractDiagnosticsFromPayload(payload, nestedFields);

  if (payload.success === false || payload.Success === false) {
    const rawErrorCode = payload.errorCode ?? payload.ErrorCode;
    const errorCode = resolveClaudeOcrErrorCode(
      rawErrorCode,
      200,
      'UNREADABLE_OR_BLANK_IMAGE'
    );
    const rawErrorMessage = payload.errorMessage ?? payload.ErrorMessage;
    const errorMessage =
      typeof rawErrorMessage === 'string' && rawErrorMessage.trim().length > 0
        ? rawErrorMessage.trim()
        : 'No readable visible text could be extracted from the uploaded ID.';
    const warningsCandidate = payload.warnings ?? payload.Warnings;
    const rawWarnings = Array.isArray(warningsCandidate)
      ? warningsCandidate.filter((w: unknown): w is string => typeof w === 'string')
      : undefined;

    return buildEmptyClaudeNormalizedFields({
      providerUsed,
      modelUsed,
      errorCode,
      errorMessage,
      warnings: rawWarnings,
      diagnostics,
      requiresPendingManualReview: resolveRequiresPendingManualReview(
        errorCode,
        200,
        diagnostics.requiresPendingManualReview
      )
    });
  }

  const pickRaw = (keys: readonly string[]): unknown => {
    const top = extractScalarFromRecord(payload, keys);
    if (top !== undefined) {
      return top;
    }
    return extractScalarFromRecord(nestedFields, keys);
  };

  const rawTextCandidate = pickRaw(['rawText', 'RawText']);
  const rawTextString = typeof rawTextCandidate === 'string' ? rawTextCandidate.trim() : '';

  const rawCandidates: Record<string, unknown> = {
    firstName: pickRaw(['firstName', 'FirstName', 'givenName', 'GivenName']),
    middleName: pickRaw(['middleName', 'MiddleName', 'middleInitial']),
    lastName: pickRaw(['surname', 'Surname', 'lastName', 'LastName', 'familyName']),
    suffix: pickRaw(['suffix', 'Suffix', 'nameSuffix']),
    fullName: pickRaw(['fullName', 'FullName']),
    sex: pickRaw(['sex', 'Sex', 'gender', 'Gender']),
    dob: pickRaw(['dateOfBirth', 'DateOfBirth', 'dob', 'DOB', 'birthDate']),
    age: pickRaw(['age', 'Age']),
    idNumber: pickRaw([
      'licenseNumber',
      'LicenseNumber',
      'idNumber',
      'IdNumber',
      'documentNumber',
      'serialNumber'
    ]),
    licenseNumber: pickRaw(['licenseNumber', 'LicenseNumber']),
    expirationDate: pickRaw(['expirationDate', 'ExpirationDate', 'expiryDate']),
    barangay: pickRaw(['barangay', 'Barangay', 'brgy']),
    streetPurok: pickRaw([
      'street',
      'Street',
      'streetPurok',
      'StreetPurok',
      'streetOrPurok'
    ]),
    cityOrMunicipality: pickRaw([
      'cityOrMunicipality',
      'CityOrMunicipality',
      'city',
      'City',
      'municipality',
      'Municipality'
    ]),
    province: pickRaw(['province', 'Province']),
    address: pickRaw(['address', 'Address']),
    weight: pickRaw(['weight', 'Weight', 'weightKg']),
    height: pickRaw(['height', 'Height', 'heightCm', 'heightM']),
    phoneNumber: pickRaw(['phoneNumber', 'PhoneNumber', 'mobileNumber', 'contactNumber'])
  };

  const { fields: sanitized, strippedPlaceholders } = sanitizeVisibleOcrFields(
    rawCandidates,
    rawTextString
  );

  const firstName = sanitized.firstName ?? '';
  const middleName = sanitized.middleName ?? '';
  const lastName = sanitized.lastName ?? '';
  const suffix = sanitized.suffix ?? '';
  const sex = normalizeVisibleSex(sanitized.sex ?? '');
  const dob = sanitized.dob ?? '';
  const age = computeAgeFromIsoDob(dob);
  const idNumber = sanitized.idNumber ?? '';
  const licenseNumber = sanitized.licenseNumber ?? idNumber;
  const expirationDate = sanitized.expirationDate ?? '';
  const barangay = sanitized.barangay ?? '';
  const streetPurok = sanitized.streetPurok ?? '';
  const cityOrMunicipality = sanitized.cityOrMunicipality ?? '';
  const province = sanitized.province ?? '';
  const address = composeVisibleAddress({
    explicitAddress: sanitized.address,
    streetPurok,
    barangay,
    cityOrMunicipality,
    province
  });
  const weight = sanitized.weight ?? '';
  const height = sanitized.height ?? '';
  const phoneNumber = sanitized.phoneNumber ?? '';
  const fullName =
    sanitized.fullName ??
    [firstName, middleName, lastName, suffix]
      .filter((part: string): boolean => part.trim().length > 0)
      .join(' ');

  const hasReadableIdentityField = Boolean(
    firstName ||
      lastName ||
      fullName ||
      idNumber ||
      dob ||
      barangay ||
      streetPurok ||
      cityOrMunicipality ||
      province ||
      address
  );

  if (!hasReadableIdentityField) {
    const errorCode: OcrErrorCode = 'UNREADABLE_OR_BLANK_IMAGE';
    return buildEmptyClaudeNormalizedFields({
      providerUsed,
      modelUsed,
      errorCode,
      errorMessage:
        strippedPlaceholders.length > 0
          ? 'No valid visible identity fields remained after placeholder sanitization.'
          : 'No readable visible text could be extracted from the uploaded ID.',
      diagnostics,
      requiresPendingManualReview: resolveRequiresPendingManualReview(
        errorCode,
        200,
        diagnostics.requiresPendingManualReview
      )
    });
  }

  const confidenceRaw = payload.confidence ?? nestedFields?.confidence;
  const parsedConfidence =
    typeof confidenceRaw === 'number' &&
    Number.isFinite(confidenceRaw) &&
    confidenceRaw > 0 &&
    confidenceRaw <= 1
      ? Number(confidenceRaw.toFixed(3))
      : 0.85;

  const safeRawText =
    rawTextString && !containsBannedDummyToken(rawTextString) ? rawTextString : '';

  const rawWarnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((w: unknown): w is string => typeof w === 'string')
    : undefined;

  const parsedMatchesSelectedIdType =
    _idType && diagnostics.detectedIdType && areEquivalentPhilippineIdClasses(_idType, diagnostics.detectedIdType)
      ? true
      : diagnostics.matchesSelectedIdType;

  return {
    firstName,
    middleName,
    lastName,
    suffix,
    fullName,
    sex,
    dob,
    age,
    idNumber,
    licenseNumber,
    expirationDate,
    barangay,
    streetPurok,
    cityOrMunicipality,
    province,
    address,
    weight,
    height,
    phoneNumber,
    rawText: safeRawText,
    providerUsed,
    modelUsed,
    confidence: parsedConfidence,
    success: true,
    warnings: rawWarnings,
    idVerificationToken: diagnostics.idVerificationToken,
    detectedIdType: diagnostics.detectedIdType,
    detectedIdLabel: diagnostics.detectedIdLabel,
    matchesSelectedIdType: parsedMatchesSelectedIdType,
    frontSlotDetectedSide: diagnostics.frontSlotDetectedSide,
    backSlotDetectedSide: diagnostics.backSlotDetectedSide,
    areSidesIdentical: diagnostics.areSidesIdentical,
    authenticityVerdict: diagnostics.authenticityVerdict,
    authenticityReason: diagnostics.authenticityReason,
    requiresPendingManualReview: diagnostics.requiresPendingManualReview ?? false,
    roboflowIdPredictions: diagnostics.roboflowIdPredictions,
    roboflowDetectedClass: diagnostics.roboflowDetectedClass,
    roboflowDetectedConfidence: diagnostics.roboflowDetectedConfidence,
    roboflowCacheHit: diagnostics.roboflowCacheHit,
    roboflowDataset: diagnostics.roboflowDataset,
    claudeTrainingCacheActive: diagnostics.claudeTrainingCacheActive
  };
};

/**
 * Claude Sonnet Vision OCR Provider Strategy.
 * Invokes /api/identity/ocr/extract with primary model 'claude-sonnet-4-6' and automatic failover
 * to 'claude-sonnet-5-5' on HTTP 404/429/500/502/503/529. Never returns hardcoded specimen fallback PII.
 */
export class ClaudeSonnetOcrProvider implements IAiOcrProvider {
  public static readonly downscaleIdImageDataUrl = downscaleIdImageDataUrl;
  public readonly id: AiProviderId = 'claude';
  public readonly name: string = 'claude';
  public readonly displayName: string = 'Claude Sonnet Vision OCR Strategy';
  private readonly endpointUrl: string;
  private readonly timeoutMs: number;

  public constructor(endpointUrl?: string, timeoutMs: number = 30_000) {
    this.endpointUrl = endpointUrl ?? resolveOcrEndpoint('/api/identity/ocr/extract');
    this.timeoutMs = timeoutMs;
  }

  public readonly isConfigured = async (): Promise<boolean> => true;

  private readonly buildMultipartFormData = (
    request: ClaudeDualSideExtractRequest,
    frontBlob: Blob,
    backBlob: Blob | null,
    targetModel: string
  ): FormData => {
    const formData = new FormData();
    const frontExt = frontBlob.type === 'image/jpeg' ? 'jpg' : 'png';
    formData.append('frontImage', frontBlob, `front-id.${frontExt}`);
    if (backBlob) {
      const backExt = backBlob.type === 'image/jpeg' ? 'jpg' : 'png';
      formData.append('backImage', backBlob, `back-id.${backExt}`);
    }
    formData.append('idType', request.idType.trim());
    formData.append('preferredProvider', request.preferredProvider ?? 'claude');
    formData.append('model', targetModel);
    formData.append('preferredModel', targetModel);
    if (typeof request.requireDualSide === 'boolean') {
      formData.append('requireDualSide', String(request.requireDualSide));
    }
    return formData;
  };

  private readonly postMultipartOcrRequest = async (
    formData: FormData,
    externalSignal?: AbortSignal
  ): Promise<Response> => {
    const controller = new AbortController();
    const onExternalAbort = (): void => {
      controller.abort();
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const timeoutId = setTimeout((): void => controller.abort(), this.timeoutMs);
    try {
      return await fetch(this.endpointUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  };

  /**
   * Executes Front + optional Back ID extraction via /api/identity/ocr/extract.
   * Uses primary model 'claude-sonnet-4-6' and retries once with 'claude-sonnet-5-5' on HTTP 404/429/500/502/503/529.
   */
  public readonly extractDualSide = async (
    request: ClaudeDualSideExtractRequest
  ): Promise<ClaudeNormalizedIdFields> => {
    const normalizedIdType = (request.idType ?? '').trim();
    if (request.requireDualSide && normalizedIdType.length === 0) {
      const errorMessage =
        'Please choose a Government ID type before scanning or uploading ID images.';
      return buildEmptyClaudeNormalizedFields({
        providerUsed: 'claude',
        errorCode: 'MISSING_ID_TYPE',
        errorMessage,
        warnings: [errorMessage],
        requiresPendingManualReview: false
      });
    }

    if (!hasNonEmptyImageInput(request.frontImage)) {
      const warning = buildMissingFrontImageWarning(normalizedIdType);
      return buildEmptyClaudeNormalizedFields({
        providerUsed: 'claude',
        errorCode: 'MISSING_FRONT_IMAGE',
        errorMessage: warning,
        warnings: [warning],
        requiresPendingManualReview: false
      });
    }

    const primaryModel = request.preferredModel?.trim() || PRIMARY_CLAUDE_OCR_MODEL;
    if (request.signal?.aborted) {
      return buildEmptyClaudeNormalizedFields({
        providerUsed: 'claude',
        modelUsed: primaryModel,
        errorCode: 'TIMEOUT',
        errorMessage: 'Claude OCR request was aborted.',
        requiresPendingManualReview: false
      });
    }

    const [frontClean, backClean] = await Promise.all([
      typeof request.frontImage === 'string'
        ? downscaleIdImageDataUrl(request.frontImage.trim())
        : Promise.resolve<string | null>(null),
      hasNonEmptyImageInput(request.backImage) && typeof request.backImage === 'string'
        ? downscaleIdImageDataUrl(request.backImage.trim())
        : Promise.resolve<string | null>(null)
    ]);

    const frontBlob: Blob =
      typeof request.frontImage === 'string'
        ? dataUrlToBlob(frontClean ?? request.frontImage)
        : request.frontImage;

    const backBlob: Blob | null = hasNonEmptyImageInput(request.backImage)
      ? typeof request.backImage === 'string'
        ? dataUrlToBlob(backClean ?? request.backImage)
        : request.backImage
      : null;

    try {
      const firstFormData = this.buildMultipartFormData(
        request,
        frontBlob,
        backBlob,
        primaryModel
      );
      let response = await this.postMultipartOcrRequest(firstFormData, request.signal);
      let activeModel = primaryModel;

      if (!response.ok) {
        const firstErrorPayload = await parseResponseJsonSafe(response);
        const firstErrorCode = firstErrorPayload?.errorCode ?? firstErrorPayload?.ErrorCode;

        if (
          !request.signal?.aborted &&
          primaryModel !== FALLBACK_CLAUDE_OCR_MODEL &&
          shouldFailoverClaudeModel(response.status, firstErrorCode)
        ) {
          activeModel = FALLBACK_CLAUDE_OCR_MODEL;
          const fallbackFormData = this.buildMultipartFormData(
            request,
            frontBlob,
            backBlob,
            activeModel
          );
          response = await this.postMultipartOcrRequest(fallbackFormData, request.signal);
        } else {
          return buildHttpFailureResult(
            firstErrorPayload,
            response.status,
            activeModel,
            `Claude OCR request failed with HTTP ${response.status}.`
          );
        }
      }

      if (!response.ok) {
        const retryErrorPayload = await parseResponseJsonSafe(response);
        return buildHttpFailureResult(
          retryErrorPayload,
          response.status,
          activeModel,
          `Claude OCR failover request failed with HTTP ${response.status}.`
        );
      }

      const json = (await response.json()) as Record<string, unknown>;
      return parseClaudeOcrApiResponse(json, request.idType);
    } catch (err: unknown) {
      const externallyAborted = Boolean(request.signal?.aborted);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const errorCode: OcrErrorCode =
        isAbort || externallyAborted ? 'TIMEOUT' : 'PROVIDER_UNAVAILABLE';
      const errorMessage =
        err instanceof Error ? err.message : 'Claude OCR network request failed.';
      return buildEmptyClaudeNormalizedFields({
        providerUsed: 'claude',
        modelUsed: primaryModel,
        errorCode,
        errorMessage,
        requiresPendingManualReview: externallyAborted
          ? false
          : resolveRequiresPendingManualReview(errorCode, 0)
      });
    }
  };

  /**
   * Implements IAiOcrProvider.extract for single-image data URL invocation in the ProviderRegistry chain.
   * Never clones front image as back image and never returns synthetic fallback PII on failure.
   */
  public readonly extract = async (
    imageDataUrl: string,
    hintType?: string
  ): Promise<IdOcrResult | null> => {
    const startTime = Date.now();
    const idType = hintType?.trim() ?? '';
    const cleanFront = (imageDataUrl ?? '').trim();

    if (!cleanFront) {
      const warning = buildMissingFrontImageWarning(idType);
      return {
        type: (idType || 'UNKNOWN').toUpperCase(),
        fields: {},
        rawText: '',
        providerUsed: this.id,
        executionTimeMs: 0,
        success: false,
        errorCode: 'MISSING_FRONT_IMAGE',
        errorMessage: warning,
        warnings: [warning]
      };
    }

    const normalized = await this.extractDualSide({
      frontImage: cleanFront,
      idType,
      preferredProvider: 'claude'
    });

    const elapsedMs = Math.max(1, Date.now() - startTime);

    if (normalized.success === false || normalized.confidence <= 0) {
      const errorCode = normalized.errorCode ?? 'UNREADABLE_OR_BLANK_IMAGE';
      const errorMessage =
        normalized.errorMessage ||
        'No readable visible identity fields could be extracted from the uploaded ID.';
      return {
        type: idType.toUpperCase(),
        fields: {},
        rawText: '',
        providerUsed: normalized.providerUsed || this.id,
        executionTimeMs: elapsedMs,
        success: false,
        errorCode,
        errorMessage,
        warnings:
          normalized.warnings && normalized.warnings.length > 0
            ? [...normalized.warnings]
            : [errorMessage]
      };
    }

    const fields: ExtractedFieldsMap = {};
    const assignVisibleField = (key: string, value: string | undefined): void => {
      if (typeof value === 'string' && value.trim().length > 0) {
        fields[key] = { value: value.trim(), confidence: normalized.confidence };
      }
    };

    const fullName =
      normalized.fullName ||
      [normalized.firstName, normalized.middleName, normalized.lastName, normalized.suffix ?? '']
        .filter((part: string): boolean => part.trim().length > 0)
        .join(' ');
    const composedAddress = composeVisibleAddress({
      explicitAddress: normalized.address,
      streetPurok: normalized.streetPurok,
      barangay: normalized.barangay,
      cityOrMunicipality: normalized.cityOrMunicipality,
      province: normalized.province
    });

    assignVisibleField('FullName', fullName);
    assignVisibleField('FirstName', normalized.firstName);
    assignVisibleField('MiddleName', normalized.middleName);
    assignVisibleField('Surname', normalized.lastName);
    assignVisibleField('LastName', normalized.lastName);
    assignVisibleField('Suffix', normalized.suffix);
    assignVisibleField('IdNumber', normalized.idNumber);
    assignVisibleField('LicenseNumber', normalized.licenseNumber || normalized.idNumber);
    assignVisibleField('ExpirationDate', normalized.expirationDate);
    assignVisibleField('DateOfBirth', normalized.dob);
    assignVisibleField('Age', normalized.age);
    assignVisibleField('Sex', normalized.sex);
    assignVisibleField('Barangay', normalized.barangay);
    assignVisibleField('Street', normalized.streetPurok);
    assignVisibleField('CityOrMunicipality', normalized.cityOrMunicipality);
    assignVisibleField('Province', normalized.province);
    assignVisibleField('Address', composedAddress);
    assignVisibleField('Weight', normalized.weight);
    assignVisibleField('Height', normalized.height);
    assignVisibleField('PhoneNumber', normalized.phoneNumber);

    if (Object.keys(fields).length === 0) {
      const errorMessage = 'No readable visible identity fields were detected on the ID image.';
      return {
        type: idType.toUpperCase(),
        fields: {},
        rawText: '',
        providerUsed: normalized.providerUsed || this.id,
        executionTimeMs: elapsedMs,
        success: false,
        errorCode: 'UNREADABLE_OR_BLANK_IMAGE',
        errorMessage,
        warnings: [errorMessage]
      };
    }

    return {
      type: idType.toUpperCase(),
      fields,
      rawText: normalized.rawText,
      providerUsed: normalized.providerUsed || this.id,
      executionTimeMs: elapsedMs,
      success: true,
      warnings: normalized.warnings ? [...normalized.warnings] : undefined
    };
  };
}

export const claudeSonnetOcrProvider = new ClaudeSonnetOcrProvider();

const buildEmptyRoboflowDetectIdResult = (
  errorCode?: string,
  errorMessage?: string
): RoboflowDetectIdResult => ({
  success: false,
  ranOnline: false,
  cacheHit: false,
  datasetSlug: null,
  topClass: null,
  canonicalIdType: null,
  topConfidence: null,
  claudeTrainingCacheActive: false,
  matchesSelectedIdType: true,
  predictions: [],
  errorCode,
  errorMessage
});

/**
 * Non-blocking helper invoking POST /api/identity/roboflow/detect-id for yolov8-ctdd4/philippine-ids
 * bounding box detection ("driver" <-> "drivers", "postal", "umid") with AbortSignal support.
 */
export const detectRoboflowPhilippineId = async (
  imageDataUrl: string,
  selectedIdType?: string,
  signal?: AbortSignal
): Promise<RoboflowDetectIdResult> => {
  const trimmedImage = (imageDataUrl ?? '').trim();
  if (!trimmedImage || signal?.aborted) {
    return buildEmptyRoboflowDetectIdResult(
      signal?.aborted ? 'ABORTED' : 'MISSING_IMAGE',
      signal?.aborted ? 'Roboflow Philippine ID detection aborted.' : 'Image data URL is empty.'
    );
  }

  const controller = new AbortController();
  const onExternalAbort = (): void => {
    controller.abort();
  };
  if (signal) {
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timeoutId = setTimeout((): void => controller.abort(), 12_000);
  try {
    const preparedImage = await downscaleIdImageDataUrl(trimmedImage);
    if (controller.signal.aborted) {
      return buildEmptyRoboflowDetectIdResult('ABORTED', 'Roboflow Philippine ID detection aborted.');
    }

    const endpoint = resolveOcrEndpoint('/api/identity/roboflow/detect-id');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: preparedImage,
        selectedIdType: selectedIdType?.trim() || undefined
      }),
      signal: controller.signal
    });

    const payload = await parseResponseJsonSafe(response);
    if (!response.ok || !payload) {
      return buildEmptyRoboflowDetectIdResult(
        pickDiagnosticString(payload, undefined, ['errorCode', 'ErrorCode']) ??
          `HTTP_${response.status}`,
        pickDiagnosticString(payload, undefined, ['errorMessage', 'ErrorMessage']) ??
          `Roboflow ID detection returned HTTP ${response.status}.`
      );
    }

    const predictions = parseRoboflowPredictionsArray(payload, undefined, [
      'predictions',
      'Predictions',
      'roboflowIdPredictions',
      'RoboflowIdPredictions'
    ]);
    const topClass =
      pickDiagnosticString(payload, undefined, [
        'topClass',
        'TopClass',
        'roboflowDetectedClass',
        'RoboflowDetectedClass'
      ]) ??
      predictions[0]?.className ??
      null;
    const rawCanonical = pickDiagnosticString(payload, undefined, [
      'canonicalIdType',
      'CanonicalIdType'
    ]);
    const canonicalIdType =
      (rawCanonical ? canonicalizePhilippineIdClass(rawCanonical) : null) ??
      (topClass ? canonicalizePhilippineIdClass(topClass) : null) ??
      null;
    const topConfidence =
      pickDiagnosticNumber(payload, undefined, [
        'topConfidence',
        'TopConfidence',
        'roboflowDetectedConfidence',
        'RoboflowDetectedConfidence'
      ]) ??
      predictions[0]?.confidence ??
      null;
    const datasetSlug =
      pickDiagnosticString(payload, undefined, [
        'datasetSlug',
        'DatasetSlug',
        'roboflowDataset',
        'RoboflowDataset'
      ]) ?? null;
    const cacheHit =
      pickDiagnosticBoolean(payload, undefined, [
        'cacheHit',
        'CacheHit',
        'roboflowCacheHit',
        'RoboflowCacheHit'
      ]) ?? false;
    const claudeTrainingCacheActive =
      pickDiagnosticBoolean(payload, undefined, [
        'claudeTrainingCacheActive',
        'ClaudeTrainingCacheActive'
      ]) ?? false;
    const ranOnline =
      pickDiagnosticBoolean(payload, undefined, ['ranOnline', 'RanOnline']) ?? false;
    const success =
      pickDiagnosticBoolean(payload, undefined, ['success', 'Success']) ?? response.ok;
    const cleanSelected = selectedIdType?.trim() ?? '';
    const matchesSelectedIdType =
      cleanSelected && (canonicalIdType || topClass)
        ? areEquivalentPhilippineIdClasses(cleanSelected, canonicalIdType ?? topClass)
        : true;

    return {
      success,
      ranOnline,
      cacheHit,
      datasetSlug,
      topClass,
      canonicalIdType: canonicalIdType || null,
      topConfidence,
      claudeTrainingCacheActive,
      matchesSelectedIdType,
      predictions,
      errorCode: pickDiagnosticString(payload, undefined, ['errorCode', 'ErrorCode']),
      errorMessage: pickDiagnosticString(payload, undefined, ['errorMessage', 'ErrorMessage'])
    };
  } catch (err: unknown) {
    const isAbort = Boolean(signal?.aborted) || (err instanceof Error && err.name === 'AbortError');
    return buildEmptyRoboflowDetectIdResult(
      isAbort ? 'ABORTED' : 'NETWORK_ERROR',
      err instanceof Error ? err.message : 'Roboflow Philippine ID detection failed.'
    );
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }
};
