// [Layer: Hooks]
// Responsibility: Headless background dual-side Government ID verification, local Vision pre-flight gating,
// AbortController stale-request cancellation, standby IdVerificationToken caching, and visible-only auto-fill.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, and 100% Universal Arrow Lambda syntax (=>).

import { useCallback, useEffect, useRef, useState } from 'react';
import * as idScanEngineModule from '@/Libs/Vision/idScanner/idScanEngine';
import type { RoboflowPredictionBox } from '@/components/RoboflowDetectionOverlay';
import {
  areEquivalentPhilippineIdClasses,
  claudeSonnetOcrProvider,
  type ClaudeDualSideExtractRequest,
  type ClaudeNormalizedIdFields
} from '@/Libs/Vision/idScanner/ai/ClaudeSonnetOcrProvider';
import {
  type OcrErrorCode,
  computeAgeFromIsoDob,
  normalizeVisibleSex,
  sanitizeVisibleOcrFields
} from '@/Libs/Vision/idScanner/ai/ocrFieldUtils';

export const STANDBY_ID_TOKEN_STORAGE_KEY = 'resqtrack_standby_id_verification_token';
export const STANDBY_FACIAL_TOKEN_STORAGE_KEY = 'resqtrack_standby_facial_verification_token';

export type IdVerificationStatus =
  | 'IDLE'
  | 'VERIFYING'
  | 'VERIFIED_GENUINE'
  | 'PENDING_MANUAL_REVIEW'
  | 'REJECTED_LOCAL'
  | 'REJECTED_AI';

export type IdVerificationErrorCode =
  | OcrErrorCode
  | 'MISSING_ID_TYPE'
  | 'MISSING_BACK_IMAGE'
  | 'WRONG_ID_SIDE_FRONT_EXPECTED'
  | 'WRONG_ID_SIDE_BACK_EXPECTED'
  | 'WRONG_GOVERNMENT_ID_TYPE'
  | 'DUPLICATE_FRONT_BACK_IMAGE'
  | 'FAKE_OR_AI_GENERATED_ID'
  | 'NON_ID_DOCUMENT';

export interface VisibleExtractedAutoFillFields {
  readonly firstName: string;
  readonly middleName: string;
  readonly lastName: string;
  readonly suffix: string;
  readonly sex: string;
  readonly dob: string;
  readonly age: string;
  readonly licenseNumber: string;
  readonly barangay: string;
  readonly streetPurok: string;
  readonly cityOrMunicipality: string;
  readonly province: string;
  readonly weight: string;
  readonly height: string;
  readonly phoneNumber: string;
}

export interface IdVerificationState {
  readonly status: IdVerificationStatus;
  readonly canUnlockPersonalInfo: boolean;
  readonly idVerificationToken: string | null;
  readonly errorCode: IdVerificationErrorCode | null;
  readonly errorMessage: string | null;
  readonly detectedIdType: string | null;
  readonly detectedIdLabel: string | null;
  readonly authenticityVerdict: string | null;
  readonly providerUsed: string | null;
  readonly confidence: number | null;
  readonly roboflowIdPredictions: readonly RoboflowPredictionBox[];
  readonly roboflowDetectedClass: string | null;
  readonly roboflowDetectedConfidence: number | null;
  readonly roboflowCacheHit: boolean;
  readonly roboflowDataset: string | null;
  readonly claudeTrainingCacheActive: boolean;
}

export interface UseBackgroundIdVerificationResult extends IdVerificationState {
  readonly retryVerification: () => void;
  readonly clearStandbyToken: () => void;
}

export interface BackgroundIdVerificationParams {
  readonly frontImageDataUrl: string | null;
  readonly backImageDataUrl: string | null;
  readonly idType: string;
  readonly selectedIdLabel?: string;
  readonly onAutoFillVisibleFields?: (fields: VisibleExtractedAutoFillFields) => void;
}

interface DualSidePreflightResult {
  readonly passed: boolean;
  readonly errorCode?: string;
  readonly reason?: string;
  readonly detectedFrontSide?: string;
  readonly detectedBackSide?: string;
}

type RunDualSideRegistrationPreflightFn = (
  frontImageData: ImageData | null | undefined,
  backImageData: ImageData | null | undefined,
  selectedCategory?: string
) => DualSidePreflightResult | Promise<DualSidePreflightResult>;

type DualSideExtractRequestWithAbort = ClaudeDualSideExtractRequest & {
  readonly requireDualSide?: boolean;
  readonly signal?: AbortSignal;
};

type DualSideOcrDiagnostics = ClaudeNormalizedIdFields & {
  readonly idVerificationToken?: string | null;
  readonly detectedIdType?: string | null;
  readonly detectedIdLabel?: string | null;
  readonly matchesSelectedIdType?: boolean;
  readonly frontSlotDetectedSide?: string | null;
  readonly backSlotDetectedSide?: string | null;
  readonly areSidesIdentical?: boolean;
  readonly authenticityVerdict?: string | null;
  readonly authenticityReason?: string | null;
  readonly requiresPendingManualReview?: boolean;
  readonly suffix?: string;
  readonly licenseNumber?: string;
  readonly cityOrMunicipality?: string;
  readonly province?: string;
  readonly phoneNumber?: string;
  readonly roboflowIdPredictions?: readonly RoboflowPredictionBox[];
  readonly roboflowDetectedClass?: string | null;
  readonly roboflowDetectedConfidence?: number | null;
  readonly roboflowCacheHit?: boolean;
  readonly roboflowDataset?: string | null;
  readonly claudeTrainingCacheActive?: boolean;
};

const INITIAL_ROBOFLOW_TELEMETRY = {
  confidence: null as number | null,
  roboflowIdPredictions: [] as readonly RoboflowPredictionBox[],
  roboflowDetectedClass: null as string | null,
  roboflowDetectedConfidence: null as number | null,
  roboflowCacheHit: false,
  roboflowDataset: null as string | null,
  claudeTrainingCacheActive: false
};

const INITIAL_VERIFICATION_STATE: IdVerificationState = {
  status: 'IDLE',
  canUnlockPersonalInfo: false,
  idVerificationToken: null,
  errorCode: null,
  errorMessage: null,
  detectedIdType: null,
  detectedIdLabel: null,
  authenticityVerdict: null,
  providerUsed: null,
  ...INITIAL_ROBOFLOW_TELEMETRY
};

const PROVIDER_FALLBACK_CODES: ReadonlySet<string> = new Set([
  'PROVIDER_UNAVAILABLE',
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK_ERROR',
  'MODEL_NOT_FOUND'
]);

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set<IdVerificationErrorCode>([
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

export const persistStandbyIdToken = (token: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (token && token.trim().length > 0) {
      window.sessionStorage.setItem(STANDBY_ID_TOKEN_STORAGE_KEY, token.trim());
    } else {
      window.sessionStorage.removeItem(STANDBY_ID_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Session storage safeguard
  }
};

export const persistStandbyFacialToken = (token: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (token && token.trim().length > 0) {
      window.sessionStorage.setItem(STANDBY_FACIAL_TOKEN_STORAGE_KEY, token.trim());
    } else {
      window.sessionStorage.removeItem(STANDBY_FACIAL_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Session storage safeguard
  }
};

export const clearStandbyRegistrationTokens = (): void => {
  persistStandbyIdToken(null);
  persistStandbyFacialToken(null);
};

const normalizeErrorCode = (rawCode?: string | null): IdVerificationErrorCode => {
  const upper = (rawCode ?? '').trim().toUpperCase();
  if (KNOWN_ERROR_CODES.has(upper)) {
    return upper as IdVerificationErrorCode;
  }
  return 'UNREADABLE_OR_BLANK_IMAGE';
};

const buildUserFriendlyRejectionMessage = (params: {
  readonly code: IdVerificationErrorCode;
  readonly rawMessage?: string | null;
  readonly selectedIdLabel?: string;
  readonly detectedIdLabel?: string | null;
  readonly authenticityReason?: string | null;
}): string => {
  const cleanRaw = (params.rawMessage ?? '').trim();
  if (cleanRaw.length >= 24) {
    return cleanRaw;
  }

  const selectedLabel = (params.selectedIdLabel ?? 'selected Government ID').trim();
  const detectedLabel = (params.detectedIdLabel ?? '').trim();
  const reasonSuffix =
    params.authenticityReason && params.authenticityReason.trim().length > 0
      ? ` (${params.authenticityReason.trim()})`
      : '';

  switch (params.code) {
    case 'MISSING_ID_TYPE':
      return 'Please select your Government ID document type before verifying ID images.';
    case 'MISSING_FRONT_IMAGE':
      return 'Front Government ID image is required. Please upload a clear photograph of the Front side of your ID.';
    case 'MISSING_BACK_IMAGE':
      return 'Back Government ID image is required. Please upload a clear photograph of the Back side of your ID.';
    case 'DUPLICATE_FRONT_BACK_IMAGE':
      return 'Duplicate Image Detected: Your Front and Back ID slots contain the exact same image. Please upload distinct Front and Back photos of your Government ID.';
    case 'WRONG_ID_SIDE_FRONT_EXPECTED':
      return 'Wrong Side Uploaded in Front Slot: The Front ID slot received the Back side of your Government ID. Please upload the Front side showing your photo and primary details.';
    case 'WRONG_ID_SIDE_BACK_EXPECTED':
      return 'Wrong Side Uploaded in Back Slot: The Back ID slot received the Front side of your Government ID. Please upload the Back side of your card.';
    case 'WRONG_GOVERNMENT_ID_TYPE':
      return detectedLabel
        ? `Wrong Government ID Type: The uploaded ID appears to be ${detectedLabel}, which does not match your selected ${selectedLabel}. Please upload the matching Government ID or change the ID type selector.`
        : `Wrong Government ID Type: The uploaded ID does not match your selected ${selectedLabel}. Please upload the matching Government ID or update your selection.`;
    case 'FAKE_OR_AI_GENERATED_ID':
      return `Invalid or Synthetic Government ID: This upload was flagged as a specimen, altered template, or AI-generated image${reasonSuffix}. Please upload clear photos of your genuine physical Government ID.`;
    case 'NON_ID_DOCUMENT':
      return 'Non-ID Document Detected: The uploaded image does not appear to be an official Government ID card (such as a selfie, screenshot, or unrelated document). Please upload clear Front and Back photos of your Government ID.';
    case 'UNREADABLE_OR_BLANK_IMAGE':
      return 'Unreadable or Blank ID Image: The uploaded ID image is blank, overly blurry, or lacks legible text. Please upload sharp, well-lit Front and Back photographs.';
    default:
      return cleanRaw || 'Government ID validation could not verify authenticity. Please re-upload clear Front and Back photographs of your Government ID.';
  }
};

const decodeDataUrlToImageData = async (
  dataUrl: string,
  signal: AbortSignal
): Promise<ImageData | null> => {
  if (
    signal.aborted ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return null;
  }

  return new Promise<ImageData | null>((resolve) => {
    const img = new Image();
    const onAbort = (): void => {
      resolve(null);
    };

    if (signal.aborted) {
      resolve(null);
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });

    img.onload = (): void => {
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        resolve(null);
        return;
      }
      try {
        const maxDim = 384;
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = longest > maxDim ? maxDim / longest : 1;
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(ctx.getImageData(0, 0, width, height));
      } catch {
        resolve(null);
      }
    };

    img.onerror = (): void => {
      signal.removeEventListener('abort', onAbort);
      resolve(null);
    };

    img.src = dataUrl;
  });
};

const getDualSidePreflightHelper = (): RunDualSideRegistrationPreflightFn | null => {
  const engineRecord = idScanEngineModule as unknown as Readonly<Record<string, unknown>>;
  const candidate = engineRecord['runDualSideRegistrationPreflight'];
  return typeof candidate === 'function' ? (candidate as RunDualSideRegistrationPreflightFn) : null;
};

const buildVisibleAutoFillPayload = (
  result: DualSideOcrDiagnostics
): VisibleExtractedAutoFillFields => {
  const rawCandidate: Record<string, string | null | undefined> = {
    firstName: result.firstName,
    middleName: result.middleName,
    lastName: result.lastName,
    suffix: result.suffix,
    sex: normalizeVisibleSex(result.sex ?? ''),
    dob: result.dob,
    age: result.age,
    licenseNumber: result.licenseNumber || result.idNumber,
    barangay: result.barangay,
    streetPurok: result.streetPurok,
    cityOrMunicipality: result.cityOrMunicipality,
    province: result.province,
    weight: result.weight,
    height: result.height,
    phoneNumber: result.phoneNumber
  };

  const { fields: sanitized } = sanitizeVisibleOcrFields(rawCandidate, result.rawText);
  const cleanDob = sanitized.dob ?? '';
  const cleanAge =
    sanitized.age && sanitized.age.trim().length > 0
      ? sanitized.age.trim()
      : cleanDob
      ? computeAgeFromIsoDob(cleanDob)
      : '';

  return {
    firstName: sanitized.firstName ?? '',
    middleName: sanitized.middleName ?? '',
    lastName: sanitized.lastName ?? '',
    suffix: sanitized.suffix ?? '',
    sex: normalizeVisibleSex(sanitized.sex ?? ''),
    dob: cleanDob,
    age: cleanAge,
    licenseNumber: sanitized.licenseNumber ?? sanitized.idNumber ?? '',
    barangay: sanitized.barangay ?? '',
    streetPurok: sanitized.streetPurok ?? '',
    cityOrMunicipality: sanitized.cityOrMunicipality ?? '',
    province: sanitized.province ?? '',
    weight: sanitized.weight ?? '',
    height: sanitized.height ?? '',
    phoneNumber: sanitized.phoneNumber ?? ''
  };
};

export const useBackgroundIdVerification = ({
  frontImageDataUrl,
  backImageDataUrl,
  idType,
  selectedIdLabel,
  onAutoFillVisibleFields
}: BackgroundIdVerificationParams): UseBackgroundIdVerificationResult => {
  const [state, setState] = useState<IdVerificationState>(INITIAL_VERIFICATION_STATE);
  const [verificationNonce, setVerificationNonce] = useState<number>(0);

  const activeRunIdRef = useRef<number>(0);
  const onAutoFillRef = useRef<BackgroundIdVerificationParams['onAutoFillVisibleFields']>(
    onAutoFillVisibleFields
  );
  onAutoFillRef.current = onAutoFillVisibleFields;

  const selectedLabelRef = useRef<string | undefined>(selectedIdLabel);
  selectedLabelRef.current = selectedIdLabel;

  const clearStandbyToken = useCallback((): void => {
    persistStandbyIdToken(null);
    setState((prev: IdVerificationState): IdVerificationState => ({
      ...prev,
      idVerificationToken: null
    }));
  }, []);

  const retryVerification = useCallback((): void => {
    persistStandbyIdToken(null);
    setVerificationNonce((n: number): number => n + 1);
  }, []);

  useEffect((): (() => void) => {
    const frontClean = (frontImageDataUrl ?? '').trim();
    const backClean = (backImageDataUrl ?? '').trim();
    const idTypeClean = (idType ?? '').trim();

    activeRunIdRef.current += 1;
    const runId = activeRunIdRef.current;
    const controller = new AbortController();

    persistStandbyIdToken(null);

    if (!idTypeClean || !frontClean || !backClean) {
      setState(INITIAL_VERIFICATION_STATE);
      return (): void => {
        controller.abort();
      };
    }

    setState({
      status: 'VERIFYING',
      canUnlockPersonalInfo: false,
      idVerificationToken: null,
      errorCode: null,
      errorMessage: null,
      detectedIdType: null,
      detectedIdLabel: null,
      authenticityVerdict: null,
      providerUsed: null,
      ...INITIAL_ROBOFLOW_TELEMETRY
    });

    const timerId = window.setTimeout((): void => {
      const executePipeline = async (): Promise<void> => {
        if (controller.signal.aborted || activeRunIdRef.current !== runId) {
          return;
        }

        if (!idTypeClean || !frontClean || !backClean) {
          persistStandbyIdToken(null);
          setState(INITIAL_VERIFICATION_STATE);
          return;
        }

        // Fast exact Data URL identity check prior to image decoding
        if (frontClean === backClean) {
          const code: IdVerificationErrorCode = 'DUPLICATE_FRONT_BACK_IMAGE';
          setState({
            status: 'REJECTED_LOCAL',
            canUnlockPersonalInfo: false,
            idVerificationToken: null,
            errorCode: code,
            errorMessage: buildUserFriendlyRejectionMessage({
              code,
              selectedIdLabel: selectedLabelRef.current
            }),
            detectedIdType: null,
            detectedIdLabel: null,
            authenticityVerdict: 'DUPLICATE_FRONT_BACK',
            providerUsed: 'local-preflight',
            ...INITIAL_ROBOFLOW_TELEMETRY
          });
          return;
        }

        // Local Vision Pre-Flight Gate (duplicate pixels, blank/unreadable, anti-selfie)
        const preflightFn = getDualSidePreflightHelper();
        if (preflightFn) {
          try {
            const [frontImageData, backImageData] = await Promise.all([
              decodeDataUrlToImageData(frontClean, controller.signal),
              decodeDataUrlToImageData(backClean, controller.signal)
            ]);

            if (controller.signal.aborted || activeRunIdRef.current !== runId) {
              return;
            }

            if (frontImageData && backImageData) {
              const preflight = await Promise.resolve(
                preflightFn(frontImageData, backImageData, idTypeClean)
              );

              if (controller.signal.aborted || activeRunIdRef.current !== runId) {
                return;
              }

              if (!preflight.passed) {
                const code = normalizeErrorCode(preflight.errorCode);
                setState({
                  status: 'REJECTED_LOCAL',
                  canUnlockPersonalInfo: false,
                  idVerificationToken: null,
                  errorCode: code,
                  errorMessage: buildUserFriendlyRejectionMessage({
                    code,
                    rawMessage: preflight.reason,
                    selectedIdLabel: selectedLabelRef.current
                  }),
                  detectedIdType: null,
                  detectedIdLabel: null,
                  authenticityVerdict: 'REJECTED_LOCAL_PREFLIGHT',
                  providerUsed: 'local-preflight',
                  ...INITIAL_ROBOFLOW_TELEMETRY
                });
                return;
              }
            }
          } catch {
            // Gracefully proceed to API call if canvas decoding or pre-flight throws on exotic format
          }
        }

        try {
          const requestPayload: DualSideExtractRequestWithAbort = {
            frontImage: frontClean,
            backImage: backClean,
            idType: idTypeClean,
            preferredProvider: 'claude',
            requireDualSide: true,
            signal: controller.signal
          };

          const rawResult = (await claudeSonnetOcrProvider.extractDualSide(
            requestPayload
          )) as DualSideOcrDiagnostics;

          if (controller.signal.aborted || activeRunIdRef.current !== runId) {
            return;
          }

          const rawCodeUpper = (rawResult.errorCode ?? '').trim().toUpperCase();
          const detectedIdType = rawResult.detectedIdType?.trim() || null;
          const detectedIdLabel = rawResult.detectedIdLabel?.trim() || null;
          const authenticityVerdict = rawResult.authenticityVerdict?.trim() || null;
          const providerUsed = rawResult.providerUsed?.trim() || 'claude';
          const confidence =
            typeof rawResult.confidence === 'number' &&
            Number.isFinite(rawResult.confidence) &&
            rawResult.confidence > 0
              ? rawResult.confidence
              : null;
          const roboflowIdPredictions = Array.isArray(rawResult.roboflowIdPredictions)
            ? rawResult.roboflowIdPredictions
            : [];
          const roboflowDetectedClass = rawResult.roboflowDetectedClass?.trim() || null;
          const roboflowDetectedConfidence =
            typeof rawResult.roboflowDetectedConfidence === 'number' &&
            Number.isFinite(rawResult.roboflowDetectedConfidence)
              ? rawResult.roboflowDetectedConfidence
              : null;
          const roboflowCacheHit = Boolean(rawResult.roboflowCacheHit);
          const roboflowDataset = rawResult.roboflowDataset?.trim() || null;
          const claudeTrainingCacheActive = Boolean(rawResult.claudeTrainingCacheActive);

          const roboflowTelemetry = {
            confidence,
            roboflowIdPredictions,
            roboflowDetectedClass,
            roboflowDetectedConfidence,
            roboflowCacheHit,
            roboflowDataset,
            claudeTrainingCacheActive
          };

          // Check graceful offline / temporary outage fallback -> PENDING_MANUAL_REVIEW
          if (
            rawResult.requiresPendingManualReview === true ||
            PROVIDER_FALLBACK_CODES.has(rawCodeUpper)
          ) {
            persistStandbyIdToken(null);
            setState({
              status: 'PENDING_MANUAL_REVIEW',
              canUnlockPersonalInfo: true,
              idVerificationToken: null,
              errorCode: normalizeErrorCode(rawCodeUpper || 'PROVIDER_UNAVAILABLE'),
              errorMessage:
                rawResult.errorMessage?.trim() ||
                'AI Verification is temporarily unavailable. Manual entry is unlocked for administrative review.',
              detectedIdType,
              detectedIdLabel,
              authenticityVerdict: authenticityVerdict ?? 'PENDING_MANUAL_REVIEW',
              providerUsed,
              ...roboflowTelemetry
            });
            return;
          }

          // Check explicit forensic / side / type / authenticity rejection flags
          const isEquivalentIdType = Boolean(
            detectedIdType && areEquivalentPhilippineIdClasses(idTypeClean, detectedIdType)
          );
          const verdictUpper = (authenticityVerdict ?? '').toUpperCase();
          let explicitRejectCode: IdVerificationErrorCode | null = null;
          if (rawResult.areSidesIdentical === true) {
            explicitRejectCode = 'DUPLICATE_FRONT_BACK_IMAGE';
          } else if (rawResult.frontSlotDetectedSide?.toUpperCase() === 'BACK') {
            explicitRejectCode = 'WRONG_ID_SIDE_FRONT_EXPECTED';
          } else if (rawResult.backSlotDetectedSide?.toUpperCase() === 'FRONT') {
            explicitRejectCode = 'WRONG_ID_SIDE_BACK_EXPECTED';
          } else if (rawResult.matchesSelectedIdType === false && !isEquivalentIdType) {
            explicitRejectCode = 'WRONG_GOVERNMENT_ID_TYPE';
          } else if (
            verdictUpper === 'FAKE_OR_AI_GENERATED' ||
            verdictUpper === 'SPECIMEN' ||
            verdictUpper === 'EDITED_OR_TEMPLATE'
          ) {
            explicitRejectCode = 'FAKE_OR_AI_GENERATED_ID';
          } else if (verdictUpper === 'NON_ID_DOCUMENT') {
            explicitRejectCode = 'NON_ID_DOCUMENT';
          } else if (verdictUpper === 'UNREADABLE_OR_BLANK') {
            explicitRejectCode = 'UNREADABLE_OR_BLANK_IMAGE';
          } else if (rawResult.success === false) {
            explicitRejectCode = normalizeErrorCode(rawCodeUpper);
          }

          if (explicitRejectCode !== null) {
            persistStandbyIdToken(null);
            setState({
              status: 'REJECTED_AI',
              canUnlockPersonalInfo: false,
              idVerificationToken: null,
              errorCode: explicitRejectCode,
              errorMessage: buildUserFriendlyRejectionMessage({
                code: explicitRejectCode,
                rawMessage: rawResult.errorMessage,
                selectedIdLabel: selectedLabelRef.current,
                detectedIdLabel,
                authenticityReason: rawResult.authenticityReason
              }),
              detectedIdType,
              detectedIdLabel,
              authenticityVerdict,
              providerUsed,
              ...roboflowTelemetry
            });
            return;
          }

          // Verified Genuine Physical ID -> Cache token in standby, unlock & non-destructively auto-fill
          const issuedToken =
            typeof rawResult.idVerificationToken === 'string' &&
            rawResult.idVerificationToken.trim().length > 0
              ? rawResult.idVerificationToken.trim()
              : null;

          persistStandbyIdToken(issuedToken);

          const autoFillFields = buildVisibleAutoFillPayload(rawResult);
          onAutoFillRef.current?.(autoFillFields);

          setState({
            status: 'VERIFIED_GENUINE',
            canUnlockPersonalInfo: true,
            idVerificationToken: issuedToken,
            errorCode: null,
            errorMessage: null,
            detectedIdType,
            detectedIdLabel,
            authenticityVerdict: authenticityVerdict ?? 'GENUINE_PHYSICAL_ID',
            providerUsed,
            ...roboflowTelemetry
          });
        } catch (err: unknown) {
          if (controller.signal.aborted || activeRunIdRef.current !== runId) {
            return;
          }
          persistStandbyIdToken(null);
          const fallbackMsg =
            err instanceof Error && err.message.trim().length > 0
              ? err.message.trim()
              : 'AI Verification is temporarily unavailable. Manual entry is unlocked for administrative review.';
          setState({
            status: 'PENDING_MANUAL_REVIEW',
            canUnlockPersonalInfo: true,
            idVerificationToken: null,
            errorCode: 'PROVIDER_UNAVAILABLE',
            errorMessage: fallbackMsg,
            detectedIdType: null,
            detectedIdLabel: null,
            authenticityVerdict: 'PENDING_MANUAL_REVIEW',
            providerUsed: 'manual-fallback',
            ...INITIAL_ROBOFLOW_TELEMETRY
          });
        }
      };

      void executePipeline();
    }, 120);

    return (): void => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [frontImageDataUrl, backImageDataUrl, idType, verificationNonce]);

  return {
    ...state,
    retryVerification,
    clearStandbyToken
  };
};

export default useBackgroundIdVerification;
