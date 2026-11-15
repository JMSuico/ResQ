// [Layer: Frontend/Libs/Vision/idScanner/ai]
// Responsibility: Type definitions, interfaces, and shared utilities for the pluggable multi-provider AI standby chain.
// Invariant: Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>).

import type { OcrErrorCode } from './ocrFieldUtils';

export type { OcrErrorCode } from './ocrFieldUtils';

/**
 * Supported identification field keys across Philippine Government ID extraction strategies.
 */
export type IdOcrFieldKey =
  | 'FullName'
  | 'FirstName'
  | 'MiddleName'
  | 'Surname'
  | 'LastName'
  | 'Suffix'
  | 'IdNumber'
  | 'LicenseNumber'
  | 'EmployeeId'
  | 'DateOfBirth'
  | 'Age'
  | 'ExpirationDate'
  | 'Sex'
  | 'Barangay'
  | 'Street'
  | 'CityOrMunicipality'
  | 'Province'
  | 'Address'
  | 'Weight'
  | 'Height'
  | 'PhoneNumber'
  | 'Rank'
  | 'Nationality'
  | 'fullname'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'suffix'
  | 'dob'
  | 'dateOfBirth'
  | 'age'
  | 'sex'
  | 'idNumber'
  | 'licenseNumber'
  | 'employeeId'
  | 'expirationDate'
  | 'barangay'
  | 'streetPurok'
  | 'cityOrMunicipality'
  | 'province'
  | 'address'
  | 'weight'
  | 'height'
  | 'phoneNumber'
  | 'rankOrTitle'
  | 'nationality';

/**
 * Structured field extracted from an identification card with associated confidence telemetry.
 */
export interface ExtractedField {
  readonly value: string;
  readonly confidence: number;
}

/**
 * Map of extracted field names to their values and confidence metrics.
 * Common fields: FullName, IdNumber, DateOfBirth, ExpirationDate, Address, Sex.
 */
export type ExtractedFieldsMap = Record<string, ExtractedField>;

/**
 * Normalized OCR and classification result produced by an AI or deterministic OCR provider.
 */
export interface IdOcrResult {
  readonly type: string;
  readonly fields: ExtractedFieldsMap;
  readonly rawText: string;
  readonly providerUsed: string;
  readonly executionTimeMs: number;
  readonly consensusScore?: number;
  readonly success?: boolean;
  readonly errorCode?: OcrErrorCode;
  readonly errorMessage?: string;
  readonly warnings?: string[];
}

/**
 * Configuration schema governing multi-provider orchestration, fallback order, and consensus resolution.
 */
export interface MultiProviderConfig {
  readonly chain: readonly string[];
  readonly consensusMode: boolean;
  readonly timeoutMs?: number;
}

/**
 * Supported AI OCR Provider identifiers in the multi-provider strategy chain.
 */
export type AiProviderId = 'claude' | 'gemini' | 'openai' | 'groq' | 'ollama';

/**
 * Core interface implemented by all AI standby and OCR providers.
 * All method declarations adhere to Universal Lambda syntax (=>).
 */
export interface AiOcrProvider {
  readonly name: string;
  readonly isConfigured: () => Promise<boolean> | boolean;
  readonly extract: (imageDataUrl: string, hintType?: string) => Promise<IdOcrResult | null>;
}

/**
 * Strategy pattern interface for pluggable AI Vision OCR providers.
 */
export interface IAiOcrProvider extends AiOcrProvider {
  readonly id: AiProviderId;
  readonly displayName: string;
}

/**
 * Default multi-provider configuration favoring Claude Sonnet 4 Vision first, followed by Gemini, OpenAI, Groq, and Ollama.
 */
export const DEFAULT_MULTI_PROVIDER_CONFIG: MultiProviderConfig = {
  chain: ['claude', 'gemini', 'openai', 'groq', 'ollama'],
  consensusMode: false,
  timeoutMs: 15_000
};

/**
 * Standard list of core identity fields evaluated across Philippine ID formats.
 */
export const CORE_ID_FIELDS: readonly string[] = [
  'FullName',
  'IdNumber',
  'DateOfBirth',
  'ExpirationDate',
  'Address',
  'Sex'
] as const;

/**
 * Normalizes a field string by trimming, capitalizing, and collapsing multiple spaces.
 */
export const normalizeFieldValue = (value: string): string =>
  value.trim().toUpperCase().replace(/\s+/g, ' ');

/**
 * Computes field-level consensus agreement percentage across multiple provider OCR results.
 */
export const calculateConsensusScore = (
  results: readonly IdOcrResult[],
  fieldKeys: readonly string[] = CORE_ID_FIELDS
): number => {
  if (results.length <= 1) {
    return 1.0;
  }

  let matches = 0;
  let evaluatedFields = 0;

  for (const key of fieldKeys) {
    const presentValues = results
      .map((r: IdOcrResult): string | undefined => r.fields[key]?.value)
      .filter((v: string | undefined): v is string => Boolean(v && v.trim().length > 0));

    if (presentValues.length > 1) {
      evaluatedFields++;
      const firstNormalized = normalizeFieldValue(presentValues[0]);
      const allAgree = presentValues.every(
        (v: string): boolean => normalizeFieldValue(v) === firstNormalized
      );
      if (allAgree) {
        matches++;
      }
    }
  }

  return evaluatedFields > 0 ? Number((matches / evaluatedFields).toFixed(3)) : 1.0;
};
