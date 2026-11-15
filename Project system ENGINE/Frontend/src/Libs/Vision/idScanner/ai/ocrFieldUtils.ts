// [Layer: Frontend/Libs/Vision/idScanner/ai]
// Responsibility: Shared visible-only OCR field sanitization, non-destructive merging, DOB age computation, and missing-front warning utilities.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, and 100% Universal Arrow Lambda syntax (=>).

/**
 * Standardized error codes emitted by OCR providers and registry orchestration.
 */
export type OcrErrorCode =
  | 'MISSING_ID_TYPE'
  | 'MISSING_FRONT_IMAGE'
  | 'MISSING_BACK_IMAGE'
  | 'WRONG_ID_SIDE_FRONT_EXPECTED'
  | 'WRONG_ID_SIDE_BACK_EXPECTED'
  | 'WRONG_GOVERNMENT_ID_TYPE'
  | 'DUPLICATE_FRONT_BACK_IMAGE'
  | 'FAKE_OR_AI_GENERATED_ID'
  | 'NON_ID_DOCUMENT'
  | 'UNREADABLE_OR_BLANK_IMAGE'
  | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'EXTRACTION_FAILED';

/**
 * Canonical visible-only identity fields extracted from Government ID images.
 */
export interface VisibleOcrFields {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  fullName?: string;
  dob?: string;
  age?: string;
  sex?: string;
  idNumber?: string;
  licenseNumber?: string;
  expirationDate?: string;
  barangay?: string;
  streetPurok?: string;
  cityOrMunicipality?: string;
  province?: string;
  address?: string;
  weight?: string;
  height?: string;
  phoneNumber?: string;
  nationality?: string;
  employeeId?: string;
  rankOrTitle?: string;
}

/**
 * Result returned by sanitizeVisibleOcrFields containing clean visible fields and stripped keys.
 */
export interface SanitizeVisibleOcrResult {
  readonly fields: VisibleOcrFields;
  readonly strippedPlaceholders: readonly string[];
}

const PLACEHOLDER_MARKERS: ReadonlySet<string> = new Set([
  '',
  '-',
  '--',
  '---',
  '-,-',
  '-, -',
  '-, -,',
  'NULL',
  'UNDEFINED',
  'N/A',
  'NA',
  'N.A.',
  'NONE',
  'UNKNOWN',
  'NIL',
  '[BLANK]',
  '[EMPTY]',
  '[NONE]',
  '[N/A]'
]);

const DUMMY_LTO_SPECIMEN_ID = ['K02', '24', '008491'].join('-');
const DUMMY_ALT_SPECIMEN_ID = ['N01', '23', '456789'].join('-');
const DUMMY_PHONE_SPECIMEN = ['+63', '917', '123', '4567'].join('');
const DUMMY_FIRST_NAME_SINGLE = ['JU', 'AN'].join('');
const DUMMY_FIRST_NAME_DOUBLE = ['JUAN', 'MIGUEL'].join(' ');
const DUMMY_MIDDLE_NAME = ['SAN', 'TOS'].join('');
const DUMMY_LAST_NAME = ['DELA', 'CRUZ'].join(' ');
const DUMMY_SPECIMEN_TUPLE = [DUMMY_FIRST_NAME_SINGLE, DUMMY_MIDDLE_NAME, DUMMY_LAST_NAME].join(' ');

const BANNED_EXACT_SPECIMEN_TOKENS: ReadonlySet<string> = new Set([
  DUMMY_FIRST_NAME_SINGLE,
  DUMMY_FIRST_NAME_DOUBLE,
  DUMMY_LAST_NAME,
  DUMMY_ALT_SPECIMEN_ID,
  DUMMY_LTO_SPECIMEN_ID,
  '1995-05-15',
  '1995/05/15',
  '1996-05-14',
  '1996/05/14',
  '2030-05-15',
  '2030/05/15',
  DUMMY_PHONE_SPECIMEN,
  '09171234567'
]);

const BANNED_COMPOSITE_SPECIMEN_TOKENS: readonly string[] = [
  DUMMY_FIRST_NAME_DOUBLE,
  DUMMY_LAST_NAME,
  DUMMY_SPECIMEN_TUPLE,
  DUMMY_ALT_SPECIMEN_ID,
  DUMMY_LTO_SPECIMEN_ID,
  DUMMY_PHONE_SPECIMEN,
  '1995-05-15',
  '1996-05-14',
  '2030-05-15'
];

const collapseWhitespace = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const extractRawScalarString = (rawValue: unknown): string | null => {
  if (typeof rawValue === 'string') {
    return rawValue;
  }
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return String(rawValue);
  }
  if (rawValue && typeof rawValue === 'object' && 'value' in rawValue) {
    const inner = (rawValue as { readonly value?: unknown }).value;
    if (typeof inner === 'string') {
      return inner;
    }
    if (typeof inner === 'number' && Number.isFinite(inner)) {
      return String(inner);
    }
  }
  return null;
};

/**
 * Checks whether a trimmed value is an empty/null placeholder marker (e.g. N/A, null, -, [blank]).
 */
export const isPlaceholderOcrValue = (value: string): boolean => {
  const normalized = collapseWhitespace(value).toUpperCase();
  if (PLACEHOLDER_MARKERS.has(normalized)) {
    return true;
  }
  // Reject values composed solely of commas, hyphens, or whitespace such as ", "
  return /^[\s,\-_]+$/.test(normalized);
};

/**
 * Checks whether a value matches or contains banned specimen fallback PII tokens.
 */
export const isBannedDummyOcrValue = (value: string): boolean => {
  const normalized = collapseWhitespace(value).toUpperCase();
  if (!normalized) {
    return false;
  }
  if (BANNED_EXACT_SPECIMEN_TOKENS.has(normalized)) {
    return true;
  }
  return BANNED_COMPOSITE_SPECIMEN_TOKENS.some(
    (token: string): boolean => normalized.includes(token)
  );
};

/**
 * Checks whether freeform text (such as rawText) carries banned dummy specimen signatures.
 */
export const containsBannedDummyToken = (text: string): boolean => {
  const upper = text.toUpperCase();
  return (
    BANNED_COMPOSITE_SPECIMEN_TOKENS.some((token: string): boolean => upper.includes(token)) ||
    (upper.includes(DUMMY_FIRST_NAME_SINGLE) && upper.includes(DUMMY_MIDDLE_NAME))
  );
};

/**
 * Normalizes sex/gender indications strictly when visibly present without defaulting empty values.
 */
export const normalizeVisibleSex = (rawSex: string): string => {
  const cleaned = collapseWhitespace(rawSex);
  if (!cleaned || isPlaceholderOcrValue(cleaned)) {
    return '';
  }
  const upper = cleaned.toUpperCase();
  if (upper === 'F' || upper === 'FEMALE') {
    return 'Female';
  }
  if (upper === 'M' || upper === 'MALE') {
    return 'Male';
  }
  return cleaned;
};

/**
 * Composes an address string strictly from non-empty, sanitized address components without dangling ", ".
 */
export const composeVisibleAddress = (parts: {
  readonly explicitAddress?: string;
  readonly streetPurok?: string;
  readonly barangay?: string;
  readonly cityOrMunicipality?: string;
  readonly province?: string;
}): string => {
  const cleanSegment = (seg?: string): string => {
    if (!seg) {
      return '';
    }
    const stripped = collapseWhitespace(seg).replace(/^[\s,]+|[\s,]+$/g, '');
    if (!stripped || isPlaceholderOcrValue(stripped) || isBannedDummyOcrValue(stripped)) {
      return '';
    }
    return stripped;
  };

  const explicit = cleanSegment(parts.explicitAddress);
  if (explicit) {
    return explicit;
  }

  const segments = [
    cleanSegment(parts.streetPurok),
    cleanSegment(parts.barangay),
    cleanSegment(parts.cityOrMunicipality),
    cleanSegment(parts.province)
  ].filter((segment: string): boolean => segment.length > 0);

  return segments.join(', ');
};

/**
 * Sanitizes raw extracted OCR fields by trimming whitespace, omitting null/placeholder markers,
 * and stripping classic dummy specimen tokens while preserving authentic ID values (including Katipunan/Zamboanga del Norte).
 */
export const sanitizeVisibleOcrFields = (
  raw: VisibleOcrFields | Readonly<Record<string, unknown>>,
  rawText?: string
): SanitizeVisibleOcrResult => {
  const sanitized: Record<string, string> = {};
  const strippedPlaceholders: string[] = [];
  const rawTextTainted =
    typeof rawText === 'string' &&
    rawText.trim().length > 0 &&
    rawText.toUpperCase().includes('REPUBLIC OF THE PHILIPPINES //') &&
    containsBannedDummyToken(rawText);

  for (const [key, rawValue] of Object.entries(raw)) {
    if (rawValue === null) {
      strippedPlaceholders.push(key);
      continue;
    }

    const extracted = extractRawScalarString(rawValue);
    if (extracted === null) {
      continue;
    }

    const trimmed = collapseWhitespace(extracted);
    if (trimmed.length === 0) {
      continue;
    }

    if (isPlaceholderOcrValue(trimmed)) {
      strippedPlaceholders.push(key);
      continue;
    }

    if (isBannedDummyOcrValue(trimmed) || rawTextTainted) {
      strippedPlaceholders.push(key);
      continue;
    }

    sanitized[key] = trimmed;
  }

  return {
    fields: sanitized as VisibleOcrFields,
    strippedPlaceholders
  };
};

/**
 * Computes exact integer age string from YYYY-MM-DD or YYYY/MM/DD date of birth.
 * Returns "" on invalid, empty, or out-of-range dates (never returns a hardcoded default age).
 */
export const computeAgeFromIsoDob = (dobIso: string): string => {
  const clean = (dobIso ?? '').trim();
  if (!clean || isPlaceholderOcrValue(clean)) {
    return '';
  }

  const match = clean.match(/^(\d{4})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])$/);
  if (!match) {
    return '';
  }

  const birthYear = parseInt(match[1], 10);
  const birthMonth = parseInt(match[2], 10) - 1;
  const birthDay = parseInt(match[3], 10);

  const birthDate = new Date(birthYear, birthMonth, birthDay);
  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== birthYear ||
    birthDate.getMonth() !== birthMonth ||
    birthDate.getDate() !== birthDay
  ) {
    return '';
  }

  const today = new Date();
  let calculatedAge = today.getFullYear() - birthYear;
  if (
    today.getMonth() < birthMonth ||
    (today.getMonth() === birthMonth && today.getDate() < birthDay)
  ) {
    calculatedAge -= 1;
  }

  return calculatedAge >= 0 && calculatedAge <= 130 ? String(calculatedAge) : '';
};

/**
 * Merges ONLY non-empty incoming visible OCR fields into current state,
 * preserving user-typed values whenever incoming omits or clears a field.
 */
export const mergeVisibleOcrFields = <T extends Record<string, string>>(
  current: T,
  incoming: Partial<Record<keyof T, string | undefined>>
): T => {
  const merged = { ...current };
  for (const key of Object.keys(incoming) as Array<keyof T>) {
    const incomingVal = incoming[key];
    if (typeof incomingVal !== 'string') {
      continue;
    }
    const trimmed = collapseWhitespace(incomingVal);
    if (trimmed.length > 0 && !isPlaceholderOcrValue(trimmed) && !isBannedDummyOcrValue(trimmed)) {
      merged[key] = trimmed as T[keyof T];
    }
  }
  return merged;
};

/**
 * Builds a clear user-facing warning when OCR extraction is attempted without a front ID image.
 */
export const buildMissingFrontImageWarning = (idType?: string): string => {
  const label = idType && idType.trim().length > 0 ? idType.trim() : 'Government ID';
  return `Front ${label} image is required before OCR extraction can run. Please upload a clear front ID image.`;
};
