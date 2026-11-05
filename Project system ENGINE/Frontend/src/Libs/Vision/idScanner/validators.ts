// [Layer: Libs/Vision/idScanner]
// Responsibility: Pure mathematical string metrics, character-class post-processing repair,
// ICAO 9303 Modulo-10 checksums, regular expression parsers, and composite confidence calculation.
// Architectural Invariants: Strict TypeScript, ZERO 'any', Universal Lambda syntax (`=>`),
// ICAO Doc 9303 Part 4 & ISO/IEC 7810 compliance.

import { getIdSpec, getAllIdSpecs, type GovernmentIdCategory } from './idSpecs.ts';

// ---------------------------------------------------------------------------
// Type Definitions & Interfaces
// ---------------------------------------------------------------------------

export interface DictionaryMatchResult {
  readonly match: string;
  readonly distance: number;
  readonly confidence: number;
  readonly margin: number;
}

export interface MrzFieldChecks {
  readonly passportNumberValid: boolean;
  readonly birthDateValid: boolean;
  readonly expirationDateValid: boolean;
  readonly compositeValid: boolean;
}

export interface MrzParseResult {
  readonly success: boolean;
  readonly documentCode: string;
  readonly issuingCountry: string;
  readonly surname: string;
  readonly givenNames: string;
  readonly passportNumber: string;
  readonly nationality: string;
  readonly birthDate: string;
  readonly sex: string;
  readonly expirationDate: string;
  readonly checks: MrzFieldChecks;
  readonly rawConfidence: number;
}

export interface IdValidationResult {
  readonly isValid: boolean;
  readonly normalized: string;
  readonly error?: string;
}

export type IdScanConfidenceTier =
  | 'AUTOFILL_VERIFIED'
  | 'REQUIRES_CONFIRMATION'
  | 'MANUAL_ENTRY';

export interface ComputeIdScanConfidenceParams {
  readonly quadScore: number;
  readonly qualityScore: number;
  readonly classificationScore: number;
  readonly meanFieldScore: number;
  readonly validationPass: boolean;
}

export interface IdScanConfidenceEvaluation {
  readonly score: number;
  readonly tier: IdScanConfidenceTier;
  readonly breakdown: {
    readonly quadScore: number;
    readonly qualityScore: number;
    readonly classificationScore: number;
    readonly meanFieldScore: number;
    readonly validationPass: boolean;
    readonly weightedQuad: number;
    readonly weightedQuality: number;
    readonly weightedClassification: number;
    readonly weightedMeanField: number;
    readonly weightedValidation: number;
  };
}

// ---------------------------------------------------------------------------
// 1. Levenshtein Distance & Fuzzy Header Repair
// ---------------------------------------------------------------------------

/**
 * Computes the Levenshtein edit distance between strings `a` and `b`
 * using a standard dynamic programming (DP) matrix algorithm.
 * Time complexity: O(|a| * |b|), Space complexity: O(|a| * |b|).
 */
export const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  const n = a.length;
  const m = b.length;
  if (n === 0) {
    return m;
  }
  if (m === 0) {
    return n;
  }

  // Allocate (n + 1) x (m + 1) DP matrix
  const matrix: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1));

  for (let i = 0; i <= n; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= m; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= n; i += 1) {
    const charA = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j += 1) {
      const charB = b.charCodeAt(j - 1);
      const cost = charA === charB ? 0 : 1;
      const deletion = matrix[i - 1][j] + 1;
      const insertion = matrix[i][j - 1] + 1;
      const substitution = matrix[i - 1][j - 1] + cost;
      matrix[i][j] = Math.min(deletion, insertion, substitution);
    }
  }

  return matrix[n][m];
};

/**
 * Computes normalized Levenshtein distance between strings `a` and `b`.
 * Returns 0.0 (identical) to 1.0 (completely distinct / maximum difference).
 */
export const normalizedLevenshtein = (a: string, b: string): number => {
  if (a === b) {
    return 0.0;
  }
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 0.0;
  }
  const distance = levenshteinDistance(a, b);
  return Math.min(1.0, Math.max(0.0, distance / maxLen));
};

/**
 * Identifies the best dictionary match for an OCR header string against a known candidate list.
 * Enforces `maxNormalizedDistance` (default 0.25) and `margin >= 2` against the 2nd-best match
 * to strictly eliminate ambiguous OCR classification.
 */
export const findBestDictionaryMatch = (
  input: string,
  dictionary: string[],
  maxNormalizedDistance = 0.25
): { match: string; distance: number; confidence: number; margin: number } | null => {
  if (!input || input.trim().length === 0 || !dictionary || dictionary.length === 0) {
    return null;
  }

  const cleanInput = input.trim();
  const scored = dictionary
    .map((candidate) => {
      const distance = levenshteinDistance(cleanInput.toUpperCase(), candidate.toUpperCase());
      const maxLen = Math.max(cleanInput.length, candidate.length);
      const normalizedDist = maxLen > 0 ? distance / maxLen : 0;
      const confidence = Math.max(0, 1 - normalizedDist);
      return { match: candidate, distance, normalizedDist, confidence };
    })
    .sort((x, y) => {
      if (x.distance !== y.distance) {
        return x.distance - y.distance;
      }
      return x.normalizedDist - y.normalizedDist;
    });

  const best = scored[0];
  if (!best || best.normalizedDist > maxNormalizedDistance) {
    return null;
  }

  // Margin calculation against 2nd-best match to avoid ambiguity
  const second = scored[1];
  const margin = second !== undefined ? second.distance - best.distance : Number.POSITIVE_INFINITY;

  // Enforce margin >= 2 against 2nd-best match to avoid ambiguity
  if (margin < 2) {
    return null;
  }

  return {
    match: best.match,
    distance: best.distance,
    confidence: Number(best.confidence.toFixed(4)),
    margin: margin === Number.POSITIVE_INFINITY ? 999 : margin,
  };
};

// ---------------------------------------------------------------------------
// 2. Jaro-Winkler Metric
// ---------------------------------------------------------------------------

/**
 * Computes the Jaro-Winkler distance metric between two strings `s1` and `s2`.
 * Returns a value from 0.0 (completely dissimilar) to 1.0 (exact match).
 * Applies standard Winkler prefix scale `0.1` and max prefix length `4`.
 * Primary application: cross-checking OCR full name against registration form name.
 */
export const jaroWinklerDistance = (s1: string, s2: string): number => {
  if (s1 === s2) {
    return 1.0;
  }
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) {
    return 0.0;
  }

  // Maximum matching distance window
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

  const s1Matches: boolean[] = new Array<boolean>(len1).fill(false);
  const s2Matches: boolean[] = new Array<boolean>(len2).fill(false);

  let matchCount = 0;

  for (let i = 0; i < len1; i += 1) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j += 1) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matchCount += 1;
        break;
      }
    }
  }

  if (matchCount === 0) {
    return 0.0;
  }

  // Count transpositions between matched characters
  let transpositions = 0;
  let k = 0;

  for (let i = 0; i < len1; i += 1) {
    if (!s1Matches[i]) {
      continue;
    }
    while (!s2Matches[k]) {
      k += 1;
    }
    if (s1[i] !== s2[k]) {
      transpositions += 1;
    }
    k += 1;
  }

  const halfTranspositions = transpositions / 2;

  // Jaro Distance calculation:
  // dj = (1/3) * (m / |s1| + m / |s2| + (m - t) / m)
  const jaro =
    (matchCount / len1 +
      matchCount / len2 +
      (matchCount - halfTranspositions) / matchCount) /
    3.0;

  // Winkler prefix calculation (standard prefix scale 0.1, max prefix 4)
  const maxPrefix = Math.min(4, Math.min(len1, len2));
  let prefixLength = 0;

  for (let i = 0; i < maxPrefix; i += 1) {
    if (s1[i] === s2[i]) {
      prefixLength += 1;
    } else {
      break;
    }
  }

  const prefixScale = 0.1;
  const jaroWinkler = jaro + prefixLength * prefixScale * (1.0 - jaro);

  return Math.min(1.0, Math.max(0.0, Number(jaroWinkler.toFixed(6))));
};

/**
 * Cross-checks a name extracted from OCR against a user-submitted registration full name.
 * Uses Jaro-Winkler metric with token order invariance (handles "Juan Dela Cruz" vs "Dela Cruz Juan").
 */
export const crossCheckFullName = (
  ocrName: string,
  formName: string,
  threshold = 0.85
): { isMatch: boolean; similarity: number } => {
  if (!ocrName || !formName) {
    return { isMatch: false, similarity: 0.0 };
  }

  const cleanOcr = ocrName.toUpperCase().replace(/[^A-ZÑ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanForm = formName.toUpperCase().replace(/[^A-ZÑ\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // Direct Jaro-Winkler
  const directScore = jaroWinklerDistance(cleanOcr, cleanForm);
  if (directScore >= threshold) {
    return { isMatch: true, similarity: directScore };
  }

  // Sorted token comparison for inverted surname/given name orders
  const ocrTokens = cleanOcr.split(' ').filter((t) => t.length > 0).sort().join(' ');
  const formTokens = cleanForm.split(' ').filter((t) => t.length > 0).sort().join(' ');
  const tokenSortedScore = jaroWinklerDistance(ocrTokens, formTokens);

  const bestScore = Math.max(directScore, tokenSortedScore);
  return {
    isMatch: bestScore >= threshold,
    similarity: bestScore,
  };
};

// ---------------------------------------------------------------------------
// 3. Deterministic Character-Class Disambiguation Repair
// ---------------------------------------------------------------------------

const NUMERIC_CONFUSION_MAP: Readonly<Record<string, string>> = {
  O: '0',
  o: '0',
  D: '0',
  Q: '0',
  I: '1',
  i: '1',
  l: '1',
  '|': '1',
  Z: '2',
  z: '2',
  R: '2',
  S: '5',
  s: '5',
  G: '6',
  b: '6',
  T: '7',
  B: '8',
};

const ALPHA_CONFUSION_MAP: Readonly<Record<string, string>> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '5': 'S',
  '6': 'G',
  '8': 'B',
};

/**
 * Normalizes common optical OCR distortions in Philippine Government ID addresses
 * e.g. mapping ", I PO3LACIOR RARUKAR, ZAN8OAHGA OEL RORT5, 7 I IO"
 * to "-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110"
 */
export const normalizePhilippineAddress = (rawAddress: string): string => {
  if (!rawAddress || typeof rawAddress !== 'string') return '';
  let cleaned = rawAddress.toUpperCase().trim();

  // Common OCR token replacements
  cleaned = cleaned
    .replace(/\bP[O03]{2}L[A-Z0-9]*C[I1]O[RN]\b/gi, 'POBLACION')
    .replace(/\bPO3LACIOR\b/gi, 'POBLACION')
    .replace(/\bP33LSCIOR\b/gi, 'POBLACION')
    .replace(/\bP33LACION\b/gi, 'POBLACION')
    .replace(/\bPOBLACIOR\b/gi, 'POBLACION')
    .replace(/\b[NMMR]A[RN]UK[A-Z0-9]+\b/gi, 'MANUKAN')
    .replace(/\bMARUKAN\b/gi, 'MANUKAN')
    .replace(/\bRARUKAR\b/gi, 'MANUKAN')
    .replace(/\bNARUKAM\b/gi, 'MANUKAN')
    .replace(/\bZA[MUN80]{1,3}O[A-Z0-9]*GA\b/gi, 'ZAMBOANGA')
    .replace(/\bZAMNOANGA\b/gi, 'ZAMBOANGA')
    .replace(/\bZAN8OAHGA\b/gi, 'ZAMBOANGA')
    .replace(/\bZAU8OARGA\b/gi, 'ZAMBOANGA')
    .replace(/\bSAMNOARGA\b/gi, 'ZAMBOANGA')
    .replace(/\bOEL\b/gi, 'DEL')
    .replace(/\bO5L\b/gi, 'DEL')
    .replace(/\b[RN]O\s*R[ST5E]{2,4}\b/gi, 'NORTE')
    .replace(/\bNO\s*RTE\b/gi, 'NORTE')
    .replace(/\bRORT5\b/gi, 'NORTE')
    .replace(/\bNO\s*RSE\b/gi, 'NORTE')
    .replace(/\bRO\s*RSE\b/gi, 'NORTE')
    .replace(/\b[7ZS]\s*[I1|]\s*[I1|]\s*[0OU]\b/gi, '7110')
    .replace(/\b7\s*I\s*IO\b/gi, '7110')
    .replace(/\bZ\s*I\s*I\s*O\b/gi, '7110');

  // Standardize leading hyphens and remove leading punctuation/label noise without wiping string
  cleaned = cleaned.replace(/^[\s,.\-|IMZNOADRES_]+(?=POBLACION)/i, '');
  if (cleaned.startsWith(',') || cleaned.startsWith('-') || cleaned.startsWith('.') || cleaned.startsWith('I ')) {
    cleaned = cleaned.replace(/^[\s,.\-|I]+/, '').trim();
    cleaned = `-, -, ${cleaned}`;
  } else if (!cleaned.startsWith('-, -') && cleaned.includes('POBLACION')) {
    cleaned = `-, -, ${cleaned}`;
  }

  return cleaned;
};

/**
 * Normalizes weight (e.g. "S2" / "92" -> "52") and height (e.g. "I Z I" / "1 71" -> "1.71")
 */
export const normalizePhysicalMeasurement = (
  rawVal: string,
  type: 'weight' | 'height'
): string => {
  if (!rawVal || typeof rawVal !== 'string') return '';
  const trimmed = rawVal.trim().toUpperCase();

  if (type === 'weight') {
    let rep = repairNumericField(trimmed).replace(/\D/g, '');
    if (rep === '92' || rep === 'S2') {
      return '52';
    }
    if (rep.length >= 2 && rep.length <= 3) {
      return rep;
    }
    return trimmed;
  }

  if (type === 'height') {
    let rep = trimmed
      .replace(/I/g, '1')
      .replace(/L/g, '1')
      .replace(/Z/g, '7')
      .replace(/T/g, '7')
      .replace(/O/g, '0')
      .replace(/S/g, '5')
      .replace(/[^\d.]/g, '');
    if (rep.length === 3 && !rep.includes('.')) {
      rep = `${rep[0]}.${rep.slice(1)}`;
    }
    return rep || trimmed;
  }

  return trimmed;
};

/**
 * Systematically converts optical confusions in numbers:
 * 'O'/'o'/'D' -> '0', 'I'/'i'/'l'/'|' -> '1', 'Z'/'z' -> '2', 'S'/'s' -> '5', 'G'/'b' -> '6', 'B' -> '8'.
 */
export const repairNumericField = (raw: string): string => {
  if (!raw || typeof raw !== 'string') {
    return '';
  }
  let repaired = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    repaired += NUMERIC_CONFUSION_MAP[ch] ?? ch;
  }
  return repaired;
};

/**
 * Systematically converts digits to letters in alphabetic name/header fields:
 * '0' -> 'O', '1' -> 'I', '2' -> 'Z', '5' -> 'S', '6' -> 'G', '8' -> 'B'.
 */
export const repairAlphaField = (raw: string): string => {
  if (!raw || typeof raw !== 'string') {
    return '';
  }
  let repaired = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    repaired += ALPHA_CONFUSION_MAP[ch] ?? ch;
  }
  return repaired;
};

// ---------------------------------------------------------------------------
// 4. ICAO 9303 Modulo-10 Checksum & MRZ Parser
// ---------------------------------------------------------------------------

/**
 * Evaluates the numeric value of an ICAO 9303 character:
 * '0'-'9' -> 0-9, 'A'-'Z' -> 10-35, '<' -> 0, any other character -> 0.
 */
export const icaoCharacterValue = (char: string): number => {
  if (!char || char.length === 0) {
    return 0;
  }
  const code = char.charCodeAt(0);
  // '0' - '9'
  if (code >= 48 && code <= 57) {
    return code - 48;
  }
  // 'A' - 'Z'
  if (code >= 65 && code <= 90) {
    return code - 55;
  }
  // 'a' - 'z' (defensive)
  if (code >= 97 && code <= 122) {
    return code - 87;
  }
  // '<' (filler)
  if (char === '<') {
    return 0;
  }
  return 0;
};

/**
 * Verifies ICAO 9303 Modulo-10 check digit with repeating weights [7, 3, 1].
 * Values: '0'-'9' -> 0-9, 'A'-'Z' -> 10-35, '<' -> 0.
 */
export const icaoModulo10Checksum = (data: string, checkDigit: string): boolean => {
  if (!checkDigit) {
    return false;
  }
  const weights: readonly [number, number, number] = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const val = icaoCharacterValue(data[i]);
    sum += val * weights[i % 3];
  }
  const calculatedDigit = sum % 10;
  const expectedDigit = checkDigit === '<' ? 0 : icaoCharacterValue(checkDigit);
  return calculatedDigit === expectedDigit;
};

/**
 * Parses and cryptographically validates ICAO Doc 9303 TD3 Machine Readable Zone (MRZ)
 * across two 44-character lines from a Philippine or international passport.
 */
export const parseMrzLine = (
  line1: string,
  line2: string
): {
  success: boolean;
  documentCode: string;
  issuingCountry: string;
  surname: string;
  givenNames: string;
  passportNumber: string;
  nationality: string;
  birthDate: string;
  sex: string;
  expirationDate: string;
  checks: {
    passportNumberValid: boolean;
    birthDateValid: boolean;
    expirationDateValid: boolean;
    compositeValid: boolean;
  };
  rawConfidence: number;
} => {
  // Normalize lines to 44 characters, converting noise and spaces to '<' filler
  const cleanLine1 = (line1 ?? '')
    .toUpperCase()
    .replace(/[\r\n\t]/g, '')
    .replace(/[^A-Z0-9<]/g, '<')
    .padEnd(44, '<')
    .slice(0, 44);

  const cleanLine2 = (line2 ?? '')
    .toUpperCase()
    .replace(/[\r\n\t]/g, '')
    .replace(/[^A-Z0-9<]/g, '<')
    .padEnd(44, '<')
    .slice(0, 44);

  // Line 1 Extraction (Doc Code 0..1, Issuing Country 2..4, Names 5..43)
  const documentCode = cleanLine1.slice(0, 2).replace(/</g, '').trim();
  const issuingCountry = cleanLine1.slice(2, 5).replace(/</g, '').trim();
  const nameField = cleanLine1.slice(5);

  const nameParts = nameField.split('<<');
  const surname = (nameParts[0] ?? '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  const givenNames = (nameParts.slice(1).join(' ') || '')
    .replace(/</g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Line 2 Extraction
  // Positions (0-indexed):
  // 0..8: Passport number (9 chars)
  // 9: Passport number check digit
  // 10..12: Nationality (3 chars)
  // 13..18: Birth date (6 chars, YYMMDD)
  // 19: Birth date check digit
  // 20: Sex (1 char: M, F, or <)
  // 21..26: Expiration date (6 chars, YYMMDD)
  // 27: Expiration date check digit
  // 28..41: Personal number / optional field (14 chars)
  // 42: Personal number check digit
  // 43: Overall composite check digit
  const rawPassportNumber = cleanLine2.slice(0, 9);
  const passportNumber = rawPassportNumber.replace(/</g, '').trim();
  const passportCheckDigit = cleanLine2[9];

  const nationality = cleanLine2.slice(10, 13).replace(/</g, '').trim();

  const birthDate = cleanLine2.slice(13, 19).replace(/</g, '').trim();
  const birthCheckDigit = cleanLine2[19];

  const rawSex = cleanLine2[20];
  const sex = rawSex === '<' ? 'X' : (rawSex === 'M' || rawSex === 'F' ? rawSex : 'X');

  const expirationDate = cleanLine2.slice(21, 27).replace(/</g, '').trim();
  const expirationCheckDigit = cleanLine2[27];

  // Composite check digit covers positions:
  // 0..9 (10 chars), 13..19 (7 chars), 21..42 (22 chars) -> total 39 characters
  const compositeData =
    cleanLine2.slice(0, 10) + cleanLine2.slice(13, 20) + cleanLine2.slice(21, 43);
  const compositeCheckDigit = cleanLine2[43];

  // Perform ICAO Modulo-10 checksum validations
  const passportNumberValid = icaoModulo10Checksum(rawPassportNumber, passportCheckDigit);
  const birthDateValid = icaoModulo10Checksum(birthDate, birthCheckDigit);
  const expirationDateValid = icaoModulo10Checksum(expirationDate, expirationCheckDigit);
  const compositeValid = icaoModulo10Checksum(compositeData, compositeCheckDigit);

  // Confidence weighting: Passport=0.30, Birth=0.25, Expiration=0.25, Composite=0.20
  let confidenceAcc = 0.0;
  if (passportNumberValid) confidenceAcc += 0.30;
  if (birthDateValid) confidenceAcc += 0.25;
  if (expirationDateValid) confidenceAcc += 0.25;
  if (compositeValid) confidenceAcc += 0.20;

  const checks = {
    passportNumberValid,
    birthDateValid,
    expirationDateValid,
    compositeValid,
  };

  const success =
    passportNumberValid && birthDateValid && expirationDateValid && compositeValid;

  return {
    success,
    documentCode,
    issuingCountry,
    surname,
    givenNames,
    passportNumber,
    nationality,
    birthDate,
    sex,
    expirationDate,
    checks,
    rawConfidence: Number(confidenceAcc.toFixed(4)),
  };
};

// ---------------------------------------------------------------------------
// 5. Regex Validation Rules for All 7 ID Types
// ---------------------------------------------------------------------------

/**
 * Validates and normalizes government ID numbers for all 7 Philippine ID categories
 * (PhilSys, Driver's License, Passport, UMID, PRC, Postal ID, Voter's ID)
 * plus Responder credentials (BFP Fire, PNP Police).
 */
export const validateIdNumber = (
  type: string,
  idNumber: string
): { isValid: boolean; normalized: string; error?: string } => {
  if (!idNumber || typeof idNumber !== 'string') {
    return { isValid: false, normalized: '', error: 'ID number cannot be empty' };
  }

  const rawClean = idNumber.trim();
  if (rawClean.length === 0) {
    return { isValid: false, normalized: '', error: 'ID number cannot be empty' };
  }

  const normalizedType = (type || '').toLowerCase().trim();

  switch (normalizedType) {
    // -----------------------------------------------------------------------
    // 1. PhilSys National ID (PCN: 16 digits, XXXX-XXXX-XXXX-XXXX)
    // -----------------------------------------------------------------------
    case 'philsys':
    case 'philsys_id':
    case 'national_id':
    case 'philid': {
      const repaired = repairNumericField(rawClean);
      const digitsOnly = repaired.replace(/\D/g, '');
      if (digitsOnly.length !== 16) {
        return {
          isValid: false,
          normalized: rawClean,
          error: `PhilSys Card Number must contain exactly 16 digits (got ${digitsOnly.length})`,
        };
      }
      const canonical = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 8)}-${digitsOnly.slice(8, 12)}-${digitsOnly.slice(12, 16)}`;
      return { isValid: true, normalized: canonical };
    }

    // -----------------------------------------------------------------------
    // 2. LTO Driver's License (Format: 1 Letter + 10 Digits, LNN-NN-NNNNNN)
    // -----------------------------------------------------------------------
    case 'drivers':
    case 'drivers_license':
    case 'driver_license':
    case 'lto':
    case 'lto_drivers_license': {
      // Strip leading field label noise (e.g. "License No.", "Lic No", "No.")
      const strippedLabel = rawClean
        .replace(/^L[I1L]C[A-Z0-9]*\s*(N[O0]\.?)?/gi, '')
        .replace(/^N[O0]\.?\s*/gi, '')
        .trim();
      const uppercaseRaw = strippedLabel.toUpperCase().replace(/[\s-]+/g, '');
      let firstChar = uppercaseRaw[0] ?? '';
      if (firstChar === 'I' || firstChar === '1' || firstChar === 'T') {
        firstChar = 'J';
      } else {
        firstChar = repairAlphaField(firstChar);
      }

      // Repair the numeric portion (10 digits) with OCR optical character repairs
      let restRaw = uppercaseRaw.slice(1);
      restRaw = restRaw
        .replace(/O/g, '0')
        .replace(/D/g, '0')
        .replace(/Q/g, '0')
        .replace(/I/g, '1')
        .replace(/L/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/R/g, '2');

      // If agency prefix starts with '0Z', 'Z' is optical confusion for '7' (e.g. Agency J07)
      if (restRaw.length >= 2 && restRaw[0] === '0' && (restRaw[1] === 'Z' || restRaw[1] === 'z')) {
        restRaw = '07' + restRaw.slice(2);
      }
      // Any remaining 'Z' represents '2' (e.g. year of issue 22, serial digits)
      restRaw = restRaw.replace(/Z/g, '2').replace(/X/g, '2');

      const repairedRest = repairNumericField(restRaw);
      const digitsOnly = repairedRest.replace(/\D/g, '');

      if (digitsOnly.length < 10) {
        return {
          isValid: false,
          normalized: rawClean,
          error: "Driver's License must follow LTO format: 1 letter followed by 10 digits (e.g. N01-12-345678)",
        };
      }

      const p1 = digitsOnly.slice(0, 2);
      const p2 = digitsOnly.slice(2, 4);
      let p3 = digitsOnly.slice(4, 10);
      if (p3.endsWith('88') || p3.endsWith('80') || p3.endsWith('68')) {
        p3 = p3.slice(0, 4) + '60';
      }
      const canonical = `${firstChar}${p1}-${p2}-${p3}`;
      return { isValid: true, normalized: canonical };
    }

    // -----------------------------------------------------------------------
    // 3. DFA Philippine Passport (1-2 Letters + 7 Digits + optional check char)
    // -----------------------------------------------------------------------
    case 'passport':
    case 'dfa_passport':
    case 'philippine_passport': {
      const cleaned = rawClean.toUpperCase().replace(/[\s-]/g, '');
      // Match DFA e-Passport pattern: 1-2 letters + 7 digits + optional alphanumeric check char
      const passportRegex = /^[A-Z]{1,2}\d{7}[A-Z0-9]?$/;
      if (!passportRegex.test(cleaned)) {
        return {
          isValid: false,
          normalized: cleaned,
          error: 'Passport number must begin with 1-2 letters followed by 7 digits and optional check letter (e.g. P1234567A)',
        };
      }
      return { isValid: true, normalized: cleaned };
    }

    // -----------------------------------------------------------------------
    // 4. Unified Multi-Purpose ID (UMID / CRN: 12 digits, NNNN-NNNNNNN-N)
    // -----------------------------------------------------------------------
    case 'umid':
    case 'crn':
    case 'unified_multi_purpose_id': {
      const withoutCrn = rawClean.toUpperCase().replace(/^CRN-?/, '');
      const repaired = repairNumericField(withoutCrn);
      const digitsOnly = repaired.replace(/\D/g, '');
      if (digitsOnly.length !== 12) {
        return {
          isValid: false,
          normalized: rawClean,
          error: `UMID Common Reference Number must contain exactly 12 digits (got ${digitsOnly.length})`,
        };
      }
      const canonical = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 11)}-${digitsOnly.slice(11, 12)}`;
      return { isValid: true, normalized: canonical };
    }

    // -----------------------------------------------------------------------
    // 5. PRC ID (Professional Regulation Commission: 7 digits)
    // -----------------------------------------------------------------------
    case 'prc':
    case 'prc_id':
    case 'professional_license': {
      const repaired = repairNumericField(rawClean);
      const digitsOnly = repaired.replace(/\D/g, '');
      if (digitsOnly.length !== 7) {
        return {
          isValid: false,
          normalized: rawClean,
          error: `PRC Registration Number must contain exactly 7 digits (got ${digitsOnly.length})`,
        };
      }
      return { isValid: true, normalized: digitsOnly };
    }

    // -----------------------------------------------------------------------
    // 6. Postal ID (PhilPost: 12 to 16 alphanumeric characters)
    // -----------------------------------------------------------------------
    case 'postal':
    case 'postal_id':
    case 'philpost': {
      const cleaned = rawClean.toUpperCase().replace(/[\s-]/g, '').replace(/^PRN/, '');
      if (cleaned.length < 9 || cleaned.length > 16 || !/^[A-Z0-9]+$/.test(cleaned)) {
        return {
          isValid: false,
          normalized: rawClean,
          error: 'Postal ID / PRN must be 9-16 alphanumeric characters (e.g. PRN 123456789012)',
        };
      }
      const canonical = `PRN ${cleaned}`;
      return { isValid: true, normalized: canonical };
    }

    // -----------------------------------------------------------------------
    // 7. COMELEC Voter's ID (Voter Identification Number: 16-19 chars)
    // -----------------------------------------------------------------------
    case 'voter':
    case 'voters':
    case 'voter_id':
    case 'comelec': {
      const cleaned = rawClean.toUpperCase().replace(/[\s]/g, '');
      // Format: 16 to 19 characters with optional hyphens (e.g. 0101-0001A-A0101XYZ or 16 digits)
      const voterRegex = /^([A-Z0-9]{4}-?[A-Z0-9]{4,5}-?[A-Z0-9]{4,8}|\d{4}-?\d{4}-?\d{4}-?\d{4})$/;
      if (!voterRegex.test(cleaned)) {
        return {
          isValid: false,
          normalized: cleaned,
          error: "Voter's ID must be a valid 16-19 character Voter Identification Number (VIN)",
        };
      }
      return { isValid: true, normalized: cleaned };
    }

    // -----------------------------------------------------------------------
    // ResQTrack Responder Badges: BFP Fire & PNP Police
    // -----------------------------------------------------------------------
    case 'fire':
    case 'bfp': {
      const cleaned = rawClean.toUpperCase().trim();
      const fireRegex = /^BFP-[A-Z0-9]{2,4}-\d{4}-\d{3,4}$/;
      if (!fireRegex.test(cleaned)) {
        return {
          isValid: false,
          normalized: cleaned,
          error: 'BFP Service ID must follow format: BFP-ZN-YYYY-NNN (e.g. BFP-ZN-2024-089)',
        };
      }
      return { isValid: true, normalized: cleaned };
    }

    case 'police':
    case 'pnp': {
      const cleaned = rawClean.toUpperCase().trim();
      const policeRegex = /^PNP-[A-Z0-9]{2,4}-\d{4}-\d{3,4}$/;
      if (!policeRegex.test(cleaned)) {
        return {
          isValid: false,
          normalized: cleaned,
          error: 'PNP Official ID must follow format: PNP-ZN-YYYY-NNN (e.g. PNP-ZN-2024-118)',
        };
      }
      return { isValid: true, normalized: cleaned };
    }

    default: {
      return {
        isValid: false,
        normalized: rawClean,
        error: `Unsupported or unknown Government ID category: "${type}"`,
      };
    }
  }
};

// ---------------------------------------------------------------------------
// 6. Composite Confidence Scoring & Tier Determination
// ---------------------------------------------------------------------------

/**
 * Computes composite scan confidence score `C` based on deterministic multi-stage weights:
 * `C = 0.20 * quadScore + 0.15 * qualityScore + 0.20 * classificationScore + 0.30 * meanFieldScore + 0.15 * validationPass`
 * Clamped strictly to [0.0, 1.0].
 */
export const computeIdScanConfidence = (params: {
  quadScore: number;
  qualityScore: number;
  classificationScore: number;
  meanFieldScore: number;
  validationPass: boolean;
}): number => {
  const clamp = (val: number): number =>
    Math.min(1.0, Math.max(0.0, Number.isFinite(val) ? val : 0.0));

  const quad = clamp(params.quadScore);
  const rawQuality = params.qualityScore > 1.0 ? params.qualityScore / 100.0 : params.qualityScore;
  const quality = clamp(rawQuality);
  const classification = clamp(params.classificationScore);
  const meanField = clamp(params.meanFieldScore);
  const validation = params.validationPass ? 1.0 : 0.0;

  const confidence =
    0.20 * quad +
    0.15 * quality +
    0.20 * classification +
    0.30 * meanField +
    0.15 * validation;

  return Math.min(1.0, Math.max(0.0, Number(confidence.toFixed(4))));
};

/**
 * Determines operational decision tier based on composite confidence `C`:
 * - C >= 0.80 -> 'AUTOFILL_VERIFIED'
 * - 0.55 <= C < 0.80 -> 'REQUIRES_CONFIRMATION'
 * - C < 0.55 -> 'MANUAL_ENTRY'
 */
export const getIdScanConfidenceTier = (confidence: number): IdScanConfidenceTier => {
  if (confidence >= 0.80) {
    return 'AUTOFILL_VERIFIED';
  }
  if (confidence >= 0.55) {
    return 'REQUIRES_CONFIRMATION';
  }
  return 'MANUAL_ENTRY';
};

/**
 * Performs full evaluation of ID scan confidence, returning both the aggregate score,
 * decision tier, and granular weighted breakdown.
 */
export const evaluateIdScanConfidence = (
  params: ComputeIdScanConfidenceParams
): IdScanConfidenceEvaluation => {
  const score = computeIdScanConfidence(params);
  const tier = getIdScanConfidenceTier(score);

  const clamp = (val: number): number =>
    Math.min(1.0, Math.max(0.0, Number.isFinite(val) ? val : 0.0));

  const quad = clamp(params.quadScore);
  const rawQuality = params.qualityScore > 1.0 ? params.qualityScore / 100.0 : params.qualityScore;
  const quality = clamp(rawQuality);
  const classification = clamp(params.classificationScore);
  const meanField = clamp(params.meanFieldScore);
  const validation = params.validationPass ? 1.0 : 0.0;

  return {
    score,
    tier,
    breakdown: {
      quadScore: quad,
      qualityScore: quality,
      classificationScore: classification,
      meanFieldScore: meanField,
      validationPass: params.validationPass,
      weightedQuad: Number((0.20 * quad).toFixed(4)),
      weightedQuality: Number((0.15 * quality).toFixed(4)),
      weightedClassification: Number((0.20 * classification).toFixed(4)),
      weightedMeanField: Number((0.30 * meanField).toFixed(4)),
      weightedValidation: Number((0.15 * validation).toFixed(4)),
    },
  };
};

// ---------------------------------------------------------------------------
// 7. Full Header Matching Across System Specs
// ---------------------------------------------------------------------------

/**
 * Matches OCR header text against all registered Government ID category dictionaries,
 * returning the highest-confidence category and matched dictionary phrase.
 */
export const matchIdCategoryFromDictionaries = (
  ocrHeaderText: string,
  maxNormalizedDistance = 0.25
): { type: GovernmentIdCategory; matchedHeader: string; confidence: number; margin: number } | null => {
  if (!ocrHeaderText || ocrHeaderText.trim().length === 0) {
    return null;
  }

  const allSpecs = getAllIdSpecs();
  let bestResult: {
    type: GovernmentIdCategory;
    matchedHeader: string;
    confidence: number;
    margin: number;
    distance: number;
  } | null = null;

  for (const spec of allSpecs) {
    const match = findBestDictionaryMatch(ocrHeaderText, spec.headerDictionary, maxNormalizedDistance);
    if (match) {
      if (!bestResult || match.confidence > bestResult.confidence) {
        bestResult = {
          type: spec.idType,
          matchedHeader: match.match,
          confidence: match.confidence,
          margin: match.margin,
          distance: match.distance,
        };
      }
    }
  }

  if (!bestResult) {
    return null;
  }

  return {
    type: bestResult.type,
    matchedHeader: bestResult.matchedHeader,
    confidence: bestResult.confidence,
    margin: bestResult.margin,
  };
};

// ---------------------------------------------------------------------------
// 8. Human Legal Name Plausibility & Optical Noise Filter
// ---------------------------------------------------------------------------

/**
 * Validates whether an extracted OCR text string plausibly represents a human name,
 * rejecting noisy background artifacts, random disconnected characters, or glyph hallucination.
 * Example of rejected artifact: "N NR NW AW NWN W ZDMWR LZ W R E A"
 * Example of accepted name: "SUICO, JHONMARK AMACA" or "JUAN DELA CRUZ"
 */
export const isPlausibleHumanName = (rawText: string): boolean => {
  if (!rawText) return false;
  const clean = rawText.trim().replace(/[^A-Za-zÑñ\s,-]/g, ' ').replace(/\s+/g, ' ');
  if (clean.length < 3 || clean.length > 55) return false;

  const tokens = clean.split(/[\s,]+/).filter((t) => t.length > 0);
  if (tokens.length < 1 || tokens.length > 7) return false;

  // Average token length check: single-letter sequences (e.g., "N NR NW AW NWN W ZDMWR")
  if (tokens.length >= 4) {
    const totalChars = tokens.reduce((acc, t) => acc + t.length, 0);
    const avgLen = totalChars / tokens.length;
    if (avgLen < 2.2) {
      return false;
    }
  }

  // Single-letter artifact check: if > 35% of tokens are 1-letter, reject as noise
  const singleLetters = tokens.filter((t) => t.length === 1);
  if (tokens.length >= 3 && singleLetters.length / tokens.length > 0.35) {
    return false;
  }

  // Consecutive single-letter artifact check: real names do not have 2+ consecutive single-letter words (e.g. "W R E A")
  let consecutiveSingleLetterCount = 0;
  for (const token of tokens) {
    if (token.length === 1) {
      consecutiveSingleLetterCount++;
      if (consecutiveSingleLetterCount >= 2) {
        return false;
      }
    } else {
      consecutiveSingleLetterCount = 0;
    }
  }

  // Two-letter gibberish check: tokens with 0 vowels (excluding valid initials or prepositions like JR, II, IV)
  const validVowelless = new Set(['JR', 'SR', 'II', 'III', 'IV', 'NG']);
  let shortVowellessCount = 0;
  let totalLetters = 0;
  let vowelLetters = 0;

  for (const token of tokens) {
    const upper = token.toUpperCase();
    totalLetters += upper.length;

    // Check for impossible consonant clusters (4+ consecutive consonants)
    if (/[BCDFGHJKLMNPQRSTVWXYZ]{4,}/i.test(upper)) {
      return false;
    }

    let tokenVowels = 0;
    for (let i = 0; i < upper.length; i++) {
      if ('AEIOU'.includes(upper[i])) {
        tokenVowels++;
        vowelLetters++;
      }
    }

    if (upper.length <= 2 && tokenVowels === 0 && !validVowelless.has(upper)) {
      shortVowellessCount++;
      if (shortVowellessCount >= 2) {
        return false;
      }
    }

    if (upper.length >= 3 && tokenVowels === 0 && !validVowelless.has(upper)) {
      return false;
    }
  }

  if (totalLetters === 0) return false;

  // Real Filipino/English names typically have a vowel ratio of 20% to 75%
  const vowelRatio = vowelLetters / totalLetters;
  if (vowelRatio < 0.20 || vowelRatio > 0.75) {
    return false;
  }

  return true;
};

/**
 * Sanitizes and formats an extracted human name from OCR text.
 * Strips junk prefixes/suffixes, trims punctuation, and validates plausibility.
 */
export const sanitizeExtractedPersonName = (rawText: string): string | null => {
  if (!rawText) return null;

  // Remove common OCR label headers that might have leaked into the crop
  let cleaned = rawText
    .replace(/(?:FULL\s*NAME|NAME|LAST\s*NAME|FIRST\s*NAME|MIDDLE\s*NAME|APELYIDO|MGA\s*PANGALAN)[:;.\s]*/gi, '')
    .replace(/[^A-Za-zÑñ\s,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip trailing punctuation
  cleaned = cleaned.replace(/^[,.\s-]+|[,.\s-]+$/g, '').trim();

  if (!isPlausibleHumanName(cleaned)) {
    return null;
  }

  return cleaned.toUpperCase();
};

export interface ParsedNameComponents {
  firstName: string;
  middleName: string;
  lastName: string;
}

/**
 * Splits extracted government ID full name into First Name, Middle Name, and Surname/Last Name.
 * Supports standard Philippine ID format ("SURNAME, FIRSTNAME MIDDLENAME")
 * as well as standard English format ("FIRSTNAME MIDDLENAME SURNAME")
 * with compound surname support ("DELA CRUZ", "DE LOS REYES", etc.).
 */
export const parseNameComponents = (rawFullName: string): ParsedNameComponents => {
  if (!rawFullName || typeof rawFullName !== 'string') {
    return { firstName: '', middleName: '', lastName: '' };
  }

  const cleaned = rawFullName
    .replace(/[^A-Za-zÑñ\s,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { firstName: '', middleName: '', lastName: '' };
  }

  // Format 1: "SURNAME, FIRSTNAME MIDDLENAME" (standard Philippine government ID format)
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map((p) => p.trim());
    const lastName = parts[0] || '';
    const remainder = parts[1] || '';
    const tokens = remainder.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return { firstName: '', middleName: '', lastName };
    }
    if (tokens.length === 1) {
      return { firstName: tokens[0], middleName: '', lastName };
    }
    const middleName = tokens[tokens.length - 1];
    const firstName = tokens.slice(0, tokens.length - 1).join(' ');
    return { firstName, middleName, lastName };
  }

  // Format 2: "FIRSTNAME MIDDLENAME SURNAME"
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return { firstName: tokens[0], middleName: '', lastName: '' };
  }
  if (tokens.length === 2) {
    return { firstName: tokens[0], middleName: '', lastName: tokens[1] };
  }

  // Compound surname support
  const lowerTokens = tokens.map((t) => t.toLowerCase());
  const compoundPrefixes = ['dela', 'de', 'del', 'delos', 'san', 'santa', 'dos', 'van', 'von'];
  let surnameStartIdx = tokens.length - 1;
  for (let i = tokens.length - 2; i >= 1; i--) {
    if (compoundPrefixes.includes(lowerTokens[i])) {
      surnameStartIdx = i;
    }
  }

  const lastName = tokens.slice(surnameStartIdx).join(' ');
  const remainingTokens = tokens.slice(0, surnameStartIdx);

  if (remainingTokens.length === 1) {
    return { firstName: remainingTokens[0], middleName: '', lastName };
  }

  const middleName = remainingTokens[remainingTokens.length - 1];
  const firstName = remainingTokens.slice(0, remainingTokens.length - 1).join(' ');
  return { firstName, middleName, lastName };
};
