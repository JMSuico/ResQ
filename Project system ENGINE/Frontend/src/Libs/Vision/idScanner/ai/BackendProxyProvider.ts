// [Layer: Frontend/Libs/Vision/idScanner/ai]
// Responsibility: Dispatches OCR extraction requests to the ASP.NET Core Web API proxy at /api/identity/ai-extract with strict visible-only sanitization.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, and 100% Universal Lambda syntax (=>).

import type { AiOcrProvider, IdOcrResult, ExtractedFieldsMap } from './AiOcrProvider';
import {
  type OcrErrorCode,
  buildMissingFrontImageWarning,
  composeVisibleAddress,
  computeAgeFromIsoDob,
  containsBannedDummyToken,
  normalizeVisibleSex,
  sanitizeVisibleOcrFields
} from './ocrFieldUtils';

/**
 * Request payload sent to ASP.NET Core /api/identity/ai-extract.
 */
export interface BackendAiExtractRequest {
  readonly imageDataUrl: string;
  readonly hintType?: string;
  readonly preferredProvider?: string;
}

/**
 * Structured field DTO returned by the backend.
 */
export interface BackendExtractedFieldDto {
  readonly value: string;
  readonly confidence: number;
}

/**
 * Full response envelope returned by /api/identity/ai-extract.
 */
export interface BackendAiExtractResponse {
  readonly success: boolean;
  readonly providerUsed?: string;
  readonly idType?: string;
  readonly confidence?: number;
  readonly extractedFields?: Record<string, BackendExtractedFieldDto | string | null | undefined>;
  readonly firstName?: string | null;
  readonly middleName?: string | null;
  readonly surname?: string | null;
  readonly lastName?: string | null;
  readonly suffix?: string | null;
  readonly fullName?: string | null;
  readonly dateOfBirth?: string | null;
  readonly dob?: string | null;
  readonly age?: string | null;
  readonly sex?: string | null;
  readonly licenseNumber?: string | null;
  readonly idNumber?: string | null;
  readonly expirationDate?: string | null;
  readonly barangay?: string | null;
  readonly street?: string | null;
  readonly streetPurok?: string | null;
  readonly cityOrMunicipality?: string | null;
  readonly province?: string | null;
  readonly address?: string | null;
  readonly weight?: string | null;
  readonly height?: string | null;
  readonly phoneNumber?: string | null;
  readonly rawText?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly warnings?: readonly string[];
  readonly executionTimeMs?: number;
}

/**
 * Health & configuration status returned by /api/identity/ai-status.
 */
export interface BackendAiStatusResponse {
  readonly claudeConfigured?: boolean;
  readonly geminiConfigured: boolean;
  readonly openAiConfigured: boolean;
  readonly azureConfigured: boolean;
  readonly hasAnyProvider: boolean;
  readonly activeChain: string;
}

/**
 * Initialization options for BackendProxyProvider.
 */
export interface BackendProxyProviderOptions {
  readonly targetProvider?: string;
  readonly extractEndpoint?: string;
  readonly statusEndpoint?: string;
  readonly timeoutMs?: number;
}

const VALID_ERROR_CODES: ReadonlySet<string> = new Set<OcrErrorCode>([
  'MISSING_FRONT_IMAGE',
  'UNREADABLE_OR_BLANK_IMAGE',
  'PROVIDER_UNAVAILABLE',
  'MODEL_NOT_FOUND',
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK_ERROR',
  'INVALID_RESPONSE',
  'EXTRACTION_FAILED'
]);

const resolveOcrErrorCode = (
  rawCode: unknown,
  httpStatus: number,
  fallback: OcrErrorCode = 'PROVIDER_UNAVAILABLE'
): OcrErrorCode => {
  if (typeof rawCode === 'string') {
    const upper = rawCode.trim().toUpperCase();
    if (VALID_ERROR_CODES.has(upper)) {
      return upper as OcrErrorCode;
    }
  }
  if (httpStatus === 429) {
    return 'RATE_LIMITED';
  }
  if (httpStatus === 404) {
    return 'MODEL_NOT_FOUND';
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

const resolveBackendEndpoint = (path: string): string => {
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

const pickSanitizedField = (
  sanitizedMap: Record<string, string>,
  candidates: readonly string[]
): string => {
  const lowerLookup = new Map<string, string>();
  for (const [k, v] of Object.entries(sanitizedMap)) {
    lowerLookup.set(k.toLowerCase(), v);
  }
  for (const key of candidates) {
    const found = lowerLookup.get(key.toLowerCase());
    if (found && found.trim().length > 0) {
      return found.trim();
    }
  }
  return '';
};

const buildErrorResult = (
  providerUsed: string,
  hintType: string | undefined,
  errorCode: OcrErrorCode,
  errorMessage: string,
  executionTimeMs: number,
  warnings?: readonly string[]
): IdOcrResult => ({
  type: (hintType || 'UNKNOWN').toUpperCase(),
  fields: {},
  rawText: '',
  providerUsed,
  executionTimeMs: Math.max(0, executionTimeMs),
  success: false,
  errorCode,
  errorMessage,
  warnings: warnings && warnings.length > 0 ? [...warnings] : [errorMessage]
});

/**
 * Communicates with the ResQTrack ASP.NET Core backend to invoke cloud vision providers securely.
 */
export class BackendProxyProvider implements AiOcrProvider {
  public readonly name: string;
  private readonly extractEndpoint: string;
  private readonly statusEndpoint: string;
  private readonly timeoutMs: number;
  private cachedIsConfigured: boolean | null = null;
  private lastConfigCheckTime: number = 0;
  private lastProbeFetchRef: typeof fetch | null = null;
  private static readonly CACHE_TTL_MS: number = 30_000;

  public constructor(options?: BackendProxyProviderOptions) {
    this.name = options?.targetProvider ?? 'backend-proxy';
    this.extractEndpoint = options?.extractEndpoint ?? resolveBackendEndpoint('/api/identity/ai-extract');
    this.statusEndpoint = options?.statusEndpoint ?? resolveBackendEndpoint('/api/identity/ai-status');
    this.timeoutMs = options?.timeoutMs ?? 20_000;
  }

  /**
   * Verifies whether the specified provider or any AI provider is configured on the backend.
   */
  public readonly isConfigured = async (): Promise<boolean> => {
    const now = Date.now();
    const currentFetch = globalThis.fetch;
    if (
      this.cachedIsConfigured !== null &&
      this.lastProbeFetchRef === currentFetch &&
      now - this.lastConfigCheckTime < BackendProxyProvider.CACHE_TTL_MS
    ) {
      return this.cachedIsConfigured;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout((): void => controller.abort(), 6_000);

      const response = await fetch(this.statusEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.cachedIsConfigured = false;
        this.lastConfigCheckTime = now;
        this.lastProbeFetchRef = currentFetch;
        return false;
      }

      const status = (await response.json()) as BackendAiStatusResponse;
      let configured = false;

      if (this.name === 'claude') {
        configured = Boolean(status.claudeConfigured);
      } else if (this.name === 'gemini') {
        configured = Boolean(status.geminiConfigured);
      } else if (this.name === 'azure') {
        configured = Boolean(status.azureConfigured);
      } else if (this.name === 'openai') {
        configured = Boolean(status.openAiConfigured);
      } else if (this.name === 'groq' || this.name === 'ollama') {
        configured = Boolean(
          status.activeChain && status.activeChain.toLowerCase().includes(this.name)
        );
      } else {
        configured = Boolean(status.hasAnyProvider);
      }

      this.cachedIsConfigured = configured;
      this.lastConfigCheckTime = now;
      this.lastProbeFetchRef = currentFetch;
      return configured;
    } catch {
      this.cachedIsConfigured = false;
      this.lastConfigCheckTime = now;
      this.lastProbeFetchRef = currentFetch;
      return false;
    }
  };

  /**
   * Executes AI-assisted OCR extraction via the backend endpoint using strict visible-only transcription rules.
   */
  public readonly extract = async (
    imageDataUrl: string,
    hintType?: string
  ): Promise<IdOcrResult | null> => {
    const cleanImage = (imageDataUrl ?? '').trim();
    if (!cleanImage) {
      const warning = buildMissingFrontImageWarning(hintType);
      return buildErrorResult(this.name, hintType, 'MISSING_FRONT_IMAGE', warning, 0, [warning]);
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout((): void => controller.abort(), this.timeoutMs);

      const requestBody: BackendAiExtractRequest = {
        imageDataUrl: cleanImage,
        hintType,
        preferredProvider: this.name === 'backend-proxy' ? undefined : this.name
      };

      const response = await fetch(this.extractEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const elapsedMs = Math.max(1, Date.now() - startTime);

      if (!response.ok) {
        const errorText = await response.text().catch((): string => '');
        let parsedError: Partial<BackendAiExtractResponse> | null = null;
        if (errorText) {
          try {
            parsedError = JSON.parse(errorText) as Partial<BackendAiExtractResponse>;
          } catch {
            parsedError = null;
          }
        }

        const errorCode = resolveOcrErrorCode(parsedError?.errorCode, response.status);
        const errorMessage =
          parsedError?.errorMessage?.trim() ||
          `Backend OCR request failed with HTTP ${response.status}.`;
        console.warn(`[BackendProxyProvider:${this.name}] HTTP ${response.status}: ${errorMessage}`);

        return buildErrorResult(
          parsedError?.providerUsed ?? this.name,
          parsedError?.idType ?? hintType,
          errorCode,
          errorMessage,
          parsedError?.executionTimeMs && parsedError.executionTimeMs > 0
            ? parsedError.executionTimeMs
            : elapsedMs,
          parsedError?.warnings
        );
      }

      const data = (await response.json()) as BackendAiExtractResponse;
      if (!data.success) {
        const errorCode = resolveOcrErrorCode(
          data.errorCode,
          200,
          'UNREADABLE_OR_BLANK_IMAGE'
        );
        const errorMessage =
          data.errorMessage?.trim() || 'No readable identification fields were extracted.';
        return buildErrorResult(
          data.providerUsed ?? this.name,
          data.idType ?? hintType,
          errorCode,
          errorMessage,
          data.executionTimeMs && data.executionTimeMs > 0 ? data.executionTimeMs : elapsedMs,
          data.warnings
        );
      }

      const rawCandidates: Record<string, unknown> = {};
      const confidenceByKey = new Map<string, number>();
      const fallbackConfidence =
        typeof data.confidence === 'number' && data.confidence > 0 && data.confidence <= 1
          ? Number(data.confidence.toFixed(3))
          : 0.85;

      const topLevelEntries: readonly [string, string | null | undefined][] = [
        ['firstName', data.firstName],
        ['middleName', data.middleName],
        ['lastName', data.lastName ?? data.surname],
        ['suffix', data.suffix],
        ['fullName', data.fullName],
        ['dob', data.dob ?? data.dateOfBirth],
        ['age', data.age],
        ['sex', data.sex],
        ['idNumber', data.idNumber ?? data.licenseNumber],
        ['licenseNumber', data.licenseNumber],
        ['expirationDate', data.expirationDate],
        ['barangay', data.barangay],
        ['streetPurok', data.streetPurok ?? data.street],
        ['cityOrMunicipality', data.cityOrMunicipality],
        ['province', data.province],
        ['address', data.address],
        ['weight', data.weight],
        ['height', data.height],
        ['phoneNumber', data.phoneNumber]
      ];

      for (const [key, value] of topLevelEntries) {
        if (value !== undefined) {
          rawCandidates[key] = value;
        }
      }

      if (data.extractedFields) {
        for (const [key, entry] of Object.entries(data.extractedFields)) {
          if (entry === null || entry === undefined) {
            rawCandidates[key] = entry;
          } else if (typeof entry === 'string') {
            rawCandidates[key] = entry;
          } else if (typeof entry === 'object' && 'value' in entry) {
            rawCandidates[key] = entry.value;
            if (typeof entry.confidence === 'number' && entry.confidence > 0 && entry.confidence <= 1) {
              confidenceByKey.set(key.toLowerCase(), Number(entry.confidence.toFixed(3)));
            }
          }
        }
      }

      const sanitized = sanitizeVisibleOcrFields(rawCandidates, data.rawText);
      const sanitizedRecord = sanitized.fields as Record<string, string>;

      const getConfidence = (...keys: readonly string[]): number => {
        for (const k of keys) {
          const c = confidenceByKey.get(k.toLowerCase());
          if (c !== undefined) {
            return c;
          }
        }
        return fallbackConfidence;
      };

      const firstName = pickSanitizedField(sanitizedRecord, ['firstName', 'givenName']);
      const middleName = pickSanitizedField(sanitizedRecord, ['middleName', 'middleInitial']);
      const lastName = pickSanitizedField(sanitizedRecord, ['lastName', 'surname', 'familyName']);
      const suffix = pickSanitizedField(sanitizedRecord, ['suffix', 'nameSuffix']);
      const explicitFullName = pickSanitizedField(sanitizedRecord, ['fullName']);
      const composedFullName =
        explicitFullName ||
        [firstName, middleName, lastName, suffix]
          .filter((part: string): boolean => part.length > 0)
          .join(' ');

      const dob = pickSanitizedField(sanitizedRecord, ['dob', 'dateOfBirth', 'birthDate']);
      const rawAge = pickSanitizedField(sanitizedRecord, ['age']);
      const age = rawAge || computeAgeFromIsoDob(dob);
      const sex = normalizeVisibleSex(pickSanitizedField(sanitizedRecord, ['sex', 'gender']));
      const idNumber = pickSanitizedField(sanitizedRecord, [
        'licenseNumber',
        'idNumber',
        'documentNumber',
        'serialNumber'
      ]);
      const licenseNumber = pickSanitizedField(sanitizedRecord, ['licenseNumber']) || idNumber;
      const expirationDate = pickSanitizedField(sanitizedRecord, ['expirationDate', 'expiryDate']);
      const barangay = pickSanitizedField(sanitizedRecord, ['barangay', 'brgy']);
      const streetPurok = pickSanitizedField(sanitizedRecord, ['streetPurok', 'street', 'streetOrPurok']);
      const cityOrMunicipality = pickSanitizedField(sanitizedRecord, [
        'cityOrMunicipality',
        'city',
        'municipality'
      ]);
      const province = pickSanitizedField(sanitizedRecord, ['province']);
      const explicitAddress = pickSanitizedField(sanitizedRecord, ['address']);
      const composedAddress = composeVisibleAddress({
        explicitAddress,
        streetPurok,
        barangay,
        cityOrMunicipality,
        province
      });
      const weight = pickSanitizedField(sanitizedRecord, ['weight', 'weightKg']);
      const height = pickSanitizedField(sanitizedRecord, ['height', 'heightCm', 'heightM']);
      const phoneNumber = pickSanitizedField(sanitizedRecord, [
        'phoneNumber',
        'mobileNumber',
        'contactNumber'
      ]);

      const fields: ExtractedFieldsMap = {};
      const assignField = (key: string, value: string, conf: number): void => {
        if (value.trim().length > 0) {
          fields[key] = { value: value.trim(), confidence: conf };
        }
      };

      assignField('FullName', composedFullName, getConfidence('fullName'));
      assignField('FirstName', firstName, getConfidence('firstName', 'givenName'));
      assignField('MiddleName', middleName, getConfidence('middleName'));
      assignField('LastName', lastName, getConfidence('lastName', 'surname'));
      assignField('Surname', lastName, getConfidence('surname', 'lastName'));
      assignField('Suffix', suffix, getConfidence('suffix'));
      assignField('DateOfBirth', dob, getConfidence('dateOfBirth', 'dob'));
      assignField('Age', age, getConfidence('age', 'dateOfBirth', 'dob'));
      assignField('Sex', sex, getConfidence('sex', 'gender'));
      assignField('IdNumber', idNumber, getConfidence('idNumber', 'licenseNumber'));
      assignField('LicenseNumber', licenseNumber, getConfidence('licenseNumber', 'idNumber'));
      assignField('ExpirationDate', expirationDate, getConfidence('expirationDate'));
      assignField('Barangay', barangay, getConfidence('barangay'));
      assignField('Street', streetPurok, getConfidence('street', 'streetPurok'));
      assignField('CityOrMunicipality', cityOrMunicipality, getConfidence('cityOrMunicipality', 'city'));
      assignField('Province', province, getConfidence('province'));
      assignField('Address', composedAddress, getConfidence('address', 'barangay', 'street'));
      assignField('Weight', weight, getConfidence('weight'));
      assignField('Height', height, getConfidence('height'));
      assignField('PhoneNumber', phoneNumber, getConfidence('phoneNumber'));

      const hasReadableIdentityField = Boolean(
        firstName ||
          lastName ||
          composedFullName ||
          idNumber ||
          dob ||
          composedAddress ||
          barangay ||
          streetPurok ||
          cityOrMunicipality ||
          province
      );

      if (
        Object.keys(fields).length === 0 ||
        (!hasReadableIdentityField && sanitized.strippedPlaceholders.length > 0)
      ) {
        return buildErrorResult(
          data.providerUsed ?? this.name,
          data.idType ?? hintType,
          'UNREADABLE_OR_BLANK_IMAGE',
          'No readable visible identity fields could be extracted from the ID image.',
          data.executionTimeMs && data.executionTimeMs > 0 ? data.executionTimeMs : elapsedMs,
          data.warnings
        );
      }

      const safeRawText =
        data.rawText && !containsBannedDummyToken(data.rawText) ? data.rawText.trim() : '';

      return {
        type: (data.idType || hintType || 'UNKNOWN').toUpperCase(),
        fields,
        rawText: safeRawText,
        providerUsed: data.providerUsed ?? this.name,
        executionTimeMs:
          data.executionTimeMs && data.executionTimeMs > 0 ? data.executionTimeMs : elapsedMs,
        success: true,
        warnings: data.warnings ? [...data.warnings] : undefined
      };
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[BackendProxyProvider:${this.name}] Extraction failure: ${message}`);
      return buildErrorResult(
        this.name,
        hintType,
        isAbort ? 'TIMEOUT' : 'PROVIDER_UNAVAILABLE',
        message,
        Math.max(1, Date.now() - startTime)
      );
    }
  };
}
