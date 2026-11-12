// [Layer: Libs/Vision/idScanner]
// Responsibility: Modular Philippine Government ID Recognition, Side/Version Classification, Special Channel Parsers (MRZ/QR),
// Field Normalization, Front/Back Consistency Checking, and Calibrated Provenance Pipeline.
// Strict TypeScript, ZERO 'any', 100% Universal Lambda Expressions (=>), zero emojis.

import type { GovernmentIdCategory } from './idSpecs';
import {
  type DocumentSide,
  type IdTemplate,
  ID_TEMPLATE_CATALOGUE,
  getIdTemplateById,
  getTemplatesByCategory,
} from './idTemplateRegistry';
import {
  parseMrzLine,
  validateIdNumber,
  normalizePhilippineAddress,
  normalizePhysicalMeasurement,
  parseNameComponents,
  isPlausibleHumanName,
  crossCheckFullName,
} from './validators';
import { parseDynamicIdAnchors } from './dynamicAnchorParser';
import { parseIdFieldsWithSpatialFsm } from './textExtractor';

export type ExtractedFieldStatus = 'ACCEPTED_FOR_PREFILL' | 'REQUIRES_REVIEW' | 'NOT_EXTRACTED';

export type ExtractedFieldSource = 'VIZ_OCR' | 'BARCODE' | 'QR' | 'PDF417' | 'MRZ' | 'DERIVED' | 'USER_EDITED';

export interface ExtractedField<T = string> {
  readonly rawText: string;
  readonly normalizedValue: T | null;
  readonly confidence: number;
  readonly source: ExtractedFieldSource;
  readonly sourceSide: DocumentSide;
  readonly sourceRegion?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly ocrMethod?: string;
  readonly validation: {
    readonly formatValid: boolean;
    readonly semanticValid: boolean;
    readonly crossChecked?: boolean;
    readonly checkDigitValid?: boolean;
    readonly messages: readonly string[];
  };
  readonly status: ExtractedFieldStatus;
  readonly warnings: readonly string[];
}

export interface DocumentClassificationCandidate {
  readonly templateId: string;
  readonly documentFamily: string;
  readonly categoryKey: GovernmentIdCategory;
  readonly issuer: string;
  readonly version: string;
  readonly side: DocumentSide;
  readonly confidence: number;
  readonly matchedSignals: readonly string[];
}

export interface DocumentAnalysisResult {
  readonly quality: {
    readonly passed: boolean;
    readonly blurScore: number;
    readonly glareScore: number;
    readonly brightnessScore: number;
    readonly contrastScore: number;
    readonly SkewDegrees: number;
    readonly cardCoverageRatio: number;
    readonly failureReasons: readonly string[];
  };
  readonly classification: {
    readonly documentFamily: string;
    readonly categoryKey: GovernmentIdCategory;
    readonly issuer: string;
    readonly version: string;
    readonly templateId: string;
    readonly side: DocumentSide;
    readonly expectedSide?: DocumentSide;
    readonly sideMismatchWarning?: string;
    readonly confidence: number;
    readonly topCandidates: readonly DocumentClassificationCandidate[];
    readonly needsManualTypeSelection: boolean;
  };
  readonly fields: Readonly<Record<string, ExtractedField>>;
  readonly crossSideCheck?: {
    readonly performed: boolean;
    readonly consistent: boolean;
    readonly mismatches: readonly string[];
  };
  readonly privacyCompliance: {
    readonly excludedSensitiveFields: readonly string[];
    readonly allowBiometricProfiling: boolean;
    readonly pcnSeparatedFromPsn: boolean;
    readonly complianceNote?: string;
  };
  readonly overallStatus: 'READY_FOR_PREFILL' | 'NEEDS_USER_REVIEW' | 'RECAPTURE_REQUIRED' | 'UNSUPPORTED_DOCUMENT';
  readonly officialVerificationStatus: 'not_checked' | 'pending_official_check' | 'passed' | 'failed';
}

export interface ClassifyDocumentInput {
  readonly rawText: string;
  readonly targetCategory?: GovernmentIdCategory;
  readonly expectedSide?: DocumentSide;
  readonly manualTemplateIdOverride?: string;
  readonly aspectRatio?: number;
  readonly hasPortrait?: boolean;
  readonly hasQrOrBarcode?: boolean;
  readonly hasMrz?: boolean;
}

// ============================================================================
// 1. Multi-Signal ID Type, Version & Side Classifiers
// ============================================================================

export const classifyPhilippineDocumentSide = (
  rawText: string,
  expectedSide: DocumentSide = 'front'
): { readonly detectedSide: DocumentSide; readonly confidence: number; readonly reasons: readonly string[] } => {
  const upper = (rawText || '').toUpperCase();
  const reasons: string[] = [];

  if (!upper.trim()) {
    return { detectedSide: 'unknown', confidence: 0, reasons: ['No text available for side classification'] };
  }

  // Passport data-page detection
  if (/P<PHL/.test(upper) || (/PASAPORTE|PASSPORT/.test(upper) && /DEPARTMENT OF FOREIGN AFFAIRS|SURNAME|DATE OF EXPIRY/.test(upper))) {
    reasons.push('Matched ICAO TD3 MRZ / Passport data-page anchors');
    return { detectedSide: 'data-page', confidence: 0.96, reasons };
  }

  // Full-page / paper document templates (ePhilID paper, PhilHealth MDR, COMELEC Voter's Certificate)
  if (
    /MEMBER DATA RECORD|\bMDR\b/.test(upper) ||
    /VOTER'?S?\s+CERTIFICATION|THIS IS TO CERTIFY THAT/.test(upper) ||
    /\bEPHILID\b|ELECTRONIC PHILIPPINE IDENTIFICATION/.test(upper)
  ) {
    reasons.push('Matched official paper/document certification anchors');
    return { detectedSide: 'document', confidence: 0.94, reasons };
  }

  let frontScore = 0;
  let backScore = 0;

  // Strong Back-side indicators across LTO, PhilSys, UMID, PRC, Postal
  if (/VEHICLE CATEGORY|IN CASE OF EMERGENCY|EMERGENCY CONTACT|ORGAN DONOR/.test(upper)) {
    backScore += 5.0;
    reasons.push('Matched LTO back-side vehicle category / emergency contact anchors');
  }
  if (/MOTORCYCLES|MOTORIZED TRICYCLES|GROSS VEHICLE WEIGHT|WEAR EYE GLASSES/.test(upper)) {
    backScore += 5.0;
    reasons.push('Matched LTO legacy back-side restriction legend anchors');
  }
  if (/PETSA NG PAGKAKALOOB|KALAGAYANG SIBIL|MARITAL STATUS|LUGAR NG KAPANGANAKAN|PLACE OF BIRTH/.test(upper) && !/PAMBANSANG PAGKAKAKILANLAN/.test(upper)) {
    backScore += 4.5;
    reasons.push('Matched PhilSys back-side demographic & QR anchors');
  }
  if (/THIS CARD IS NON-TRANSFERABLE|POSTMASTER GENERAL|IF FOUND PLEASE RETURN/.test(upper)) {
    backScore += 4.5;
    reasons.push('Matched reverse-side return/non-transferable notice');
  }
  if (/PROFESSIONAL REGULATORY BOARD|CHAIRPERSON/.test(upper) && !/REGISTRATION NO/.test(upper)) {
    backScore += 4.0;
    reasons.push('Matched PRC reverse-side regulatory board anchors');
  }

  // Strong Front-side indicators
  if (/LAST NAME,\s*FIRST NAME,\s*MIDDLE NAME|LICENSE NO\.?|EXPIRATION DATE|AGENCY CODE/.test(upper)) {
    frontScore += 4.5;
    reasons.push('Matched LTO front-side identity & license header anchors');
  }
  if (/PAMBANSANG PAGKAKAKILANLAN|PHILIPPINE IDENTIFICATION CARD|APELYIDO\/LAST NAME|MGA PANGALAN/.test(upper)) {
    frontScore += 4.5;
    reasons.push('Matched PhilSys front-side header & name anchors');
  }
  if (/UNIFIED MULTI-PURPOSE ID|COMMON REFERENCE NUMBER|\bCRN\b/.test(upper)) {
    frontScore += 4.0;
    reasons.push('Matched UMID front-side header');
  }
  if (/PROFESSIONAL REGULATION COMMISSION|PROFESSIONAL IDENTIFICATION CARD|REGISTRATION NO/.test(upper)) {
    frontScore += 4.0;
    reasons.push('Matched PRC front-side registration anchors');
  }
  if (/POSTAL IDENTITY CARD|\bPRN\b|SENIOR CITIZEN|PERSONS? WITH DISABILITY|UNIFIED PWD ID|SOLO PARENT|SANGGUNIANG BARANGAY|BUREAU OF FIRE|PHILIPPINE NATIONAL POLICE|OVERSEAS WORKERS WELFARE|PHILHEALTH IDENTIFICATION NUMBER/.test(upper)) {
    frontScore += 3.8;
    reasons.push('Matched front-side issuer title');
  }

  if (backScore > frontScore && backScore >= 3.5) {
    return {
      detectedSide: 'back',
      confidence: Number(Math.min(0.98, 0.65 + backScore * 0.06).toFixed(2)),
      reasons,
    };
  }

  if (frontScore > backScore && frontScore >= 3.0) {
    return {
      detectedSide: 'front',
      confidence: Number(Math.min(0.98, 0.65 + frontScore * 0.06).toFixed(2)),
      reasons,
    };
  }

  return {
    detectedSide: expectedSide,
    confidence: 0.45,
    reasons: ['Weak side-specific anchors; defaulted to upload slot side with low confidence'],
  };
};

export const classifyPhilippineDocument = (
  input: ClassifyDocumentInput
): DocumentAnalysisResult['classification'] => {
  const upper = (input.rawText || '').toUpperCase().replace(/\s+/g, ' ').trim();

  // Manual template override takes highest precedence when explicitly chosen by user
  if (input.manualTemplateIdOverride) {
    const overridden = getIdTemplateById(input.manualTemplateIdOverride);
    if (overridden) {
      return {
        documentFamily: overridden.documentFamily,
        categoryKey: overridden.categoryKey,
        issuer: overridden.issuer,
        version: overridden.version,
        templateId: overridden.id,
        side: overridden.side,
        expectedSide: input.expectedSide,
        confidence: 1.0,
        topCandidates: [
          {
            templateId: overridden.id,
            documentFamily: overridden.documentFamily,
            categoryKey: overridden.categoryKey,
            issuer: overridden.issuer,
            version: overridden.version,
            side: overridden.side,
            confidence: 1.0,
            matchedSignals: ['MANUAL_TEMPLATE_OVERRIDE'],
          },
        ],
        needsManualTypeSelection: false,
      };
    }
  }

  const sideEval = classifyPhilippineDocumentSide(upper, input.expectedSide ?? 'front');
  const scoredCandidates: { candidate: DocumentClassificationCandidate; rawScore: number }[] = [];

  for (const template of ID_TEMPLATE_CATALOGUE) {
    let score = 0;
    const matchedSignals: string[] = [];

    // 1. Anchor phrase matching
    for (const anchor of template.classificationAnchors) {
      const normAnchor = anchor.toUpperCase();
      if (upper.includes(normAnchor)) {
        const tokenWeight = Math.max(1, normAnchor.split(/\s+/).length);
        score += 1.8 * tokenWeight;
        matchedSignals.push(`anchor:${normAnchor}`);
      }
    }

    // 2. Negative anchor penalty (discriminates versions and front/back)
    if (template.negativeAnchors) {
      for (const neg of template.negativeAnchors) {
        if (upper.includes(neg.toUpperCase())) {
          score -= 4.5;
          matchedSignals.push(`negative:-${neg.toUpperCase()}`);
        }
      }
    }

    // 3. Version-specific signature discriminators
    if (template.id === 'PH-LTO-DL-2021-NEW-FRONT' && /\bDL\s*CODES?\b/.test(upper)) {
      score += 4.5;
      matchedSignals.push('version:LTO_NEW_DL_CODES');
    }
    if (template.id === 'PH-LTO-DL-OLD-FRONT' && /\bRESTRICTIONS?\b/.test(upper) && !/\bDL\s*CODES?\b/.test(upper)) {
      score += 6.0;
      matchedSignals.push('version:LTO_LEGACY_RESTRICTIONS');
    }
    if (template.id === 'PH-LTO-DL-2021-NEW-BACK' && (/VEHICLE CATEGORY/.test(upper) || /IN CASE OF EMERGENCY/.test(upper))) {
      score += 5.0;
      matchedSignals.push('version:LTO_NEW_BACK_TABLE');
    }
    if (template.id === 'PH-LTO-DL-OLD-BACK' && /MOTORIZED TRICYCLES|GROSS VEHICLE WEIGHT/.test(upper)) {
      score += 5.0;
      matchedSignals.push('version:LTO_OLD_BACK_LEGEND');
    }
    if (template.id === 'PH-PSA-EPHILID-PAPER' && /\bEPHILID\b|ELECTRONIC PHILIPPINE IDENTIFICATION/.test(upper)) {
      score += 6.0;
      matchedSignals.push('version:PHILSYS_PAPER_EPHILID');
    }
    if (template.id === 'PH-PSA-NATIONAL-ID-DIGITAL' && /DIGITAL NATIONAL ID|EGOVPH|NATIONAL-ID\.GOV\.PH/.test(upper)) {
      score += 6.0;
      matchedSignals.push('version:PHILSYS_DIGITAL');
    }
    if (template.id === 'PH-DFA-PASSPORT-TD3-DATAPAGE' && /P<PHL/.test(upper)) {
      score += 6.0;
      matchedSignals.push('version:ICAO_TD3_MRZ');
    }
    if (template.id === 'PH-SSS-ID-FRONT' && /SOCIAL SECURITY SYSTEM|\bSS NUMBER\b/.test(upper) && !/UNIFIED MULTI-PURPOSE/.test(upper)) {
      score += 5.0;
      matchedSignals.push('version:SSS_DEDICATED_CARD');
    }
    if (template.id === 'PH-GSIS-ECARD-FRONT' && /GOVERNMENT SERVICE INSURANCE SYSTEM|\bGSIS\b|\bECARD\b/.test(upper) && !/UNIFIED MULTI-PURPOSE/.test(upper)) {
      score += 5.0;
      matchedSignals.push('version:GSIS_ECARD');
    }
    if (template.id === 'PH-PRC-EPIC-DIGITAL' && /\bE-PIC\b|LERIS|ELECTRONIC PROFESSIONAL/.test(upper)) {
      score += 6.0;
      matchedSignals.push('version:PRC_DIGITAL_EPIC');
    }
    if (template.id === 'PH-PHILHEALTH-IPHILHEALTHY-2011' && /I-PHILHEALTHY/.test(upper)) {
      score += 6.5;
      matchedSignals.push('version:IPHILHEALTHY_2011');
    }
    if (template.id === 'PH-PHILHEALTH-MDR-DOCUMENT' && /MEMBER DATA RECORD|\bMDR\b/.test(upper)) {
      score += 6.5;
      matchedSignals.push('version:PHILHEALTH_MDR_DOC');
    }
    if (template.id === 'PH-OWWA-ECARD-DIGITAL' && /DIGITAL E-CARD/.test(upper)) {
      score += 6.0;
      matchedSignals.push('version:OWWA_DIGITAL');
    }
    if (template.id === 'PH-COMELEC-VOTERS-CERTIFICATE-DOC' && /VOTER'?S?\s+CERTIFICATION|THIS IS TO CERTIFY THAT/.test(upper)) {
      score += 6.5;
      matchedSignals.push('version:COMELEC_VOTERS_CERTIFICATE');
    }
    if (template.id === 'PH-NCDA-PWD-ID-2026-UNIFIED' && (/UNIFIED PWD ID|AO NO\.?\s*001|NATIONAL COUNCIL ON DISABILITY AFFAIRS/.test(upper))) {
      score += 6.5;
      matchedSignals.push('version:NCDA_2026_UNIFIED_PWD');
    }
    if (template.id === 'PH-NCDA-PWD-ID-LEGACY-LGU' && /TYPE OF DISABILITY|\bPDAO\b/.test(upper) && !/UNIFIED PWD ID/.test(upper)) {
      score += 5.0;
      matchedSignals.push('version:PWD_LEGACY_LGU');
    }

    // 4. Side alignment bonus/penalty
    if (sideEval.confidence >= 0.70) {
      if (template.side === sideEval.detectedSide) {
        score += 2.5;
        matchedSignals.push(`side:${sideEval.detectedSide}`);
      } else {
        score -= 2.5;
      }
    }

    // 5. User-selected category hint (only boosts matching family if text does not strongly contradict it)
    if (input.targetCategory && input.targetCategory !== 'unknown' && template.categoryKey === input.targetCategory && score > 0) {
      score += 1.5;
      matchedSignals.push(`userHint:${input.targetCategory}`);
    }

    if (score > 0) {
      const normalizedConfidence = Number(Math.min(0.99, score / 14.0).toFixed(2));
      scoredCandidates.push({
        rawScore: score,
        candidate: {
          templateId: template.id,
          documentFamily: template.documentFamily,
          categoryKey: template.categoryKey,
          issuer: template.issuer,
          version: template.version,
          side: template.side,
          confidence: normalizedConfidence,
          matchedSignals,
        },
      });
    }
  }

  scoredCandidates.sort((a, b) => b.rawScore - a.rawScore);
  const candidates = scoredCandidates.map((s) => s.candidate);
  const best = candidates[0];

  // If no template achieved credible multi-signal confidence (< 0.35), return UNKNOWN!
  // Never force-route an unknown/unsupported document to LTO or PhilSys.
  if (!best || best.confidence < 0.35) {
    return {
      documentFamily: 'UNKNOWN',
      categoryKey: 'unknown',
      issuer: 'Unknown / Unclassified Issuer',
      version: 'unknown',
      templateId: 'UNKNOWN',
      side: sideEval.detectedSide,
      expectedSide: input.expectedSide,
      confidence: best ? best.confidence : 0,
      topCandidates: candidates.slice(0, 3),
      needsManualTypeSelection: true,
    };
  }

  let sideMismatchWarning: string | undefined;
  if (
    input.expectedSide &&
    input.expectedSide !== 'unknown' &&
    best.side !== input.expectedSide &&
    !(input.expectedSide === 'front' && (best.side === 'data-page' || best.side === 'document'))
  ) {
    sideMismatchWarning = `Uploaded image was recognized as the ${best.side.toUpperCase()} of ${best.documentFamily}, but was placed in the ${input.expectedSide.toUpperCase()} upload slot.`;
  }

  return {
    documentFamily: best.documentFamily,
    categoryKey: best.categoryKey,
    issuer: best.issuer,
    version: best.version,
    templateId: best.templateId,
    side: best.side,
    expectedSide: input.expectedSide,
    sideMismatchWarning,
    confidence: best.confidence,
    topCandidates: candidates.slice(0, 3),
    needsManualTypeSelection: best.confidence < 0.50,
  };
};

// ============================================================================
// 2. Machine-Readable Channel Parsers (Passport TD3 MRZ & PhilSys/ID QR/Barcode)
// ============================================================================

export interface ParsedMachineReadableChannel {
  readonly channelType: 'MRZ' | 'QR' | 'PDF417' | 'BARCODE' | 'NONE';
  readonly valid: boolean;
  readonly checkDigitsValid?: boolean;
  readonly fields: Readonly<Record<string, string>>;
  readonly excludedPsnDetected: boolean;
  readonly warnings: readonly string[];
}

export const parseMachineReadableChannels = (
  rawText: string,
  documentFamily: string
): ParsedMachineReadableChannel => {
  const warnings: string[] = [];
  const fields: Record<string, string> = {};
  let excludedPsnDetected = false;

  if (!rawText || !rawText.trim()) {
    return { channelType: 'NONE', valid: false, fields, excludedPsnDetected: false, warnings };
  }

  // 1. Check for ICAO 9303 TD3 Passport MRZ (2 lines of ~44 chars starting with P<)
  const lines = rawText
    .split(/[\r\n]+/)
    .map((l) => l.trim().replace(/\s+/g, ''))
    .filter((l) => l.length >= 30);

  const mrzLine1Idx = lines.findIndex((l) => /^P<[A-Z]{3}/.test(l.toUpperCase()));
  if (mrzLine1Idx !== -1 && mrzLine1Idx + 1 < lines.length) {
    const l1 = lines[mrzLine1Idx];
    const l2 = lines[mrzLine1Idx + 1];
    const mrz = parseMrzLine(l1, l2);

    if (mrz.passportNumber) fields['idNumber'] = mrz.passportNumber;
    if (mrz.surname) fields['lastName'] = mrz.surname;
    if (mrz.givenNames) fields['firstName'] = mrz.givenNames;
    if (mrz.surname || mrz.givenNames) {
      fields['fullName'] = `${mrz.surname}, ${mrz.givenNames}`.trim();
    }
    if (mrz.nationality) fields['nationality'] = mrz.nationality;
    if (mrz.sex === 'M' || mrz.sex === 'F') {
      fields['sex'] = mrz.sex === 'F' ? 'FEMALE' : 'MALE';
    }
    if (mrz.birthDate && /^\d{6}$/.test(mrz.birthDate)) {
      const yy = parseInt(mrz.birthDate.slice(0, 2), 10);
      const century = yy > 30 ? '19' : '20';
      fields['dateOfBirth'] = `${century}${mrz.birthDate.slice(0, 2)}-${mrz.birthDate.slice(2, 4)}-${mrz.birthDate.slice(4, 6)}`;
    }
    if (mrz.expirationDate && /^\d{6}$/.test(mrz.expirationDate)) {
      fields['expirationDate'] = `20${mrz.expirationDate.slice(0, 2)}-${mrz.expirationDate.slice(2, 4)}-${mrz.expirationDate.slice(4, 6)}`;
    }

    if (!mrz.checks.passportNumberValid) warnings.push('MRZ passport number check digit failed Modulo-10 verification.');
    if (!mrz.checks.birthDateValid) warnings.push('MRZ birth date check digit failed Modulo-10 verification.');
    if (!mrz.checks.expirationDateValid) warnings.push('MRZ expiration date check digit failed Modulo-10 verification.');
    if (!mrz.checks.compositeValid) warnings.push('MRZ composite check digit failed Modulo-10 verification.');

    return {
      channelType: 'MRZ',
      valid: mrz.success,
      checkDigitsValid: mrz.success,
      fields,
      excludedPsnDetected: false,
      warnings,
    };
  }

  // 2. Check for PhilSys / ePhilID / PRC / OWWA / PWD structured QR JSON payload
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const getStr = (keys: readonly string[]): string => {
        for (const k of keys) {
          const val = parsed[k];
          if (typeof val === 'string' && val.trim()) return val.trim();
        }
        return '';
      };

      // Strictly separate PCN from PSN (never copy PSN into idNumber!)
      const pcn = getStr(['pcn', 'PCN', 'cardNumber', 'philSysCardNumber']);
      const psn = getStr(['psn', 'PSN', 'philSysNumber']);
      if (psn) {
        excludedPsnDetected = true;
        warnings.push('PhilSys internal PSN token detected in QR payload and excluded per RA 11055 data minimization.');
      }
      if (pcn) fields['idNumber'] = pcn;

      const lName = getStr(['lastName', 'lName', 'surname', 'LastName']);
      const fName = getStr(['firstName', 'fName', 'givenNames', 'FirstName']);
      const mName = getStr(['middleName', 'mName', 'MiddleName']);
      if (lName) fields['lastName'] = lName.toUpperCase();
      if (fName) fields['firstName'] = fName.toUpperCase();
      if (mName) fields['middleName'] = mName.toUpperCase();
      if (lName && fName) {
        fields['fullName'] = mName ? `${lName.toUpperCase()}, ${fName.toUpperCase()} ${mName.toUpperCase()}` : `${lName.toUpperCase()}, ${fName.toUpperCase()}`;
      }

      const dob = getStr(['dob', 'DOB', 'dateOfBirth', 'BirthDate']);
      if (dob) fields['dateOfBirth'] = dob;

      const sex = getStr(['sex', 'Sex', 'gender']);
      if (sex) fields['sex'] = sex.toUpperCase().startsWith('F') ? 'FEMALE' : 'MALE';

      return {
        channelType: 'QR',
        valid: Object.keys(fields).length > 0,
        fields,
        excludedPsnDetected,
        warnings,
      };
    } catch {
      // Not valid JSON; continue to key-value / barcode parsing
    }
  }

  // 3. Check for explicit PSN string in raw text so we never mistake PSN for PCN
  if (/\bPSN[\s:-]*[0-9A-Z-]{12,20}\b/i.test(rawText)) {
    excludedPsnDetected = true;
    warnings.push('Internal PSN label detected and excluded from PCN extraction.');
  }

  // 4. LTO Back Serial / Barcode metadata
  if (documentFamily === 'LTO_DRIVERS_LICENSE') {
    const serialMatch = rawText.match(/(?:SERIAL\s*(?:NO\.?)?|SN)[\s:-]*([A-Z0-9-]{7,18})/i);
    if (serialMatch) {
      fields['cardSerialNumber'] = serialMatch[1].toUpperCase();
    }
  }

  return {
    channelType: Object.keys(fields).length > 0 ? 'BARCODE' : 'NONE',
    valid: Object.keys(fields).length > 0,
    fields,
    excludedPsnDetected,
    warnings,
  };
};

// ============================================================================
// 3. Field Normalization, Versioned LTO Parsing, and Provenance Evaluation
// ============================================================================

export const normalizeStandardDate = (raw: string): { readonly normalized: string | null; readonly valid: boolean } => {
  if (!raw || !raw.trim()) return { normalized: null, valid: false };
  const cleaned = raw.trim().toUpperCase();

  // Format 1: YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const ymd = cleaned.match(/\b((?:19|20)\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (ymd) {
    const yyyy = ymd[1];
    const mm = ymd[2].padStart(2, '0');
    const dd = ymd[3].padStart(2, '0');
    return { normalized: `${yyyy}-${mm}-${dd}`, valid: true };
  }

  // Format 2: MM/DD/YYYY or DD/MM/YYYY
  const dmy = cleaned.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.]((?:19|20)\d{2})\b/);
  if (dmy) {
    const yyyy = dmy[3];
    const mm = dmy[2].padStart(2, '0');
    const dd = dmy[1].padStart(2, '0');
    return { normalized: `${yyyy}-${mm}-${dd}`, valid: true };
  }

  // Format 3: Month DD, YYYY or DD Month YYYY (e.g. JANUARY 15, 1995 or 15 JAN 1995)
  const monthMap: Readonly<Record<string, string>> = {
    JAN: '01', JANUARY: '01', ENERO: '01',
    FEB: '02', FEBRUARY: '02', PEBRERO: '02',
    MAR: '03', MARCH: '03', MARSO: '03',
    APR: '04', APRIL: '04', ABRIL: '04',
    MAY: '05', MAYO: '05',
    JUN: '06', JUNE: '06', HUNYO: '06',
    JUL: '07', JULY: '07', HULYO: '07',
    AUG: '08', AUGUST: '08', AGOSTO: '08',
    SEP: '09', SEPT: '09', SEPTEMBER: '09', SETYEMBRE: '09',
    OCT: '10', OCTOBER: '10', OKTUBRE: '10',
    NOV: '11', NOVEMBER: '11', NOBYEMBRE: '11',
    DEC: '12', DECEMBER: '12', DISYEMBRE: '12',
  };

  const alphaMonth1 = cleaned.match(/\b([A-Z]{3,9})\s+(0?[1-9]|[12]\d|3[01]),?\s+((?:19|20)\d{2})\b/);
  if (alphaMonth1 && monthMap[alphaMonth1[1]]) {
    const mm = monthMap[alphaMonth1[1]];
    const dd = alphaMonth1[2].padStart(2, '0');
    const yyyy = alphaMonth1[3];
    return { normalized: `${yyyy}-${mm}-${dd}`, valid: true };
  }

  const alphaMonth2 = cleaned.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Z]{3,9}),?\s+((?:19|20)\d{2})\b/);
  if (alphaMonth2 && monthMap[alphaMonth2[2]]) {
    const dd = alphaMonth2[1].padStart(2, '0');
    const mm = monthMap[alphaMonth2[2]];
    const yyyy = alphaMonth2[3];
    return { normalized: `${yyyy}-${mm}-${dd}`, valid: true };
  }

  return { normalized: null, valid: false };
};

export const extractLtoVersionedCodes = (
  rawText: string,
  version: string
): {
  readonly dlCodes?: string;
  readonly restrictions?: string;
  readonly conditions?: string;
  readonly cardSerialNumber?: string;
} => {
  const upper = (rawText || '').toUpperCase();
  const lines = upper.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  let dlCodes: string | undefined;
  let restrictions: string | undefined;
  let conditions: string | undefined;
  let cardSerialNumber: string | undefined;

  // 1. Check multi-line LTO row where header is "DL Codes Conditions" or "Restrictions Conditions"
  for (let i = 0; i < lines.length - 1; i++) {
    const hdr = lines[i];
    const valLine = lines[i + 1];
    if (/\bDL\s*CODES?\b/.test(hdr) && /\bCONDITIONS?\b/.test(hdr)) {
      const tokens = valLine.split(/[\s,]+/).filter(Boolean);
      const dlList: string[] = [];
      const condList: string[] = [];
      let inConditions = false;
      for (const tok of tokens) {
        if (!inConditions && /^(A|A1|B|B1|B2|C|D|BE|CE)$/.test(tok)) {
          dlList.push(tok);
        } else if (/^([1-5]|NONE)$/.test(tok)) {
          inConditions = true;
          condList.push(tok);
        }
      }
      if (dlList.length > 0) dlCodes = Array.from(new Set(dlList)).join(', ');
      if (condList.length > 0) conditions = condList.includes('NONE') ? 'NONE' : Array.from(new Set(condList)).join(', ');
    } else if (/\bRESTRICTIONS?\b/.test(hdr) && /\bCONDITIONS?\b/.test(hdr)) {
      const tokens = valLine.split(/[\s,]+/).filter(Boolean);
      const restList: string[] = [];
      const condList: string[] = [];
      for (const tok of tokens) {
        if (/^NONE$|^([A-E])$/.test(tok)) {
          condList.push(tok);
        } else if (/^[1-8]$/.test(tok) && condList.length === 0) {
          restList.push(tok);
        }
      }
      if (restList.length > 0) restrictions = Array.from(new Set(restList)).join(', ');
      if (condList.length > 0) conditions = condList.includes('NONE') ? 'NONE' : Array.from(new Set(condList)).join(', ');
    }
  }

  // 2. Inline fallback for DL Codes / Restrictions / Conditions
  if (version === '2021-dl-code-v1' && !dlCodes) {
    const dlMatch =
      upper.match(/DL\s*CODES?[\s:.-]+([A-E0-9,\s]+?)(?=\bCONDITIONS?\b|\bASSISTANT\b|\r|\n|$)/i) ||
      upper.match(/\b((?:A1|B1|B2|BE|CE)(?:\s*,\s*(?:A|A1|B|B1|B2|C|D|BE|CE))*)\b/);
    if (dlMatch) {
      const tokens = dlMatch[1]
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter((t) => /^(A|A1|B|B1|B2|C|D|BE|CE)$/.test(t));
      if (tokens.length > 0) {
        dlCodes = Array.from(new Set(tokens)).join(', ');
      }
    }
  } else if (version === 'legacy-restrictions-v1' && !restrictions) {
    const restMatch = upper.match(/RESTRICTIONS?[\s:.-]+([1-8,\s]+?)(?=\bCONDITIONS?\b|\bEXPIRES\b|\r|\n|$)/i);
    if (restMatch) {
      const nums = restMatch[1]
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter((t) => /^[1-8]$/.test(t));
      if (nums.length > 0) {
        restrictions = Array.from(new Set(nums)).join(', ');
      }
    }
  }

  if (!conditions) {
    const condMatch = upper.match(/CONDITIONS?[\s:.-]+([A-E1-5,\s]+|NONE)(?=\bASSISTANT\b|\bSERIAL\b|\bIN CASE\b|\r|\n|$)/i);
    if (condMatch) {
      const rawCond = condMatch[1].trim();
      if (/^NONE$/i.test(rawCond)) {
        conditions = 'NONE';
      } else {
        const tokens = rawCond
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter((t) => /^([1-5]|[A-E])$/.test(t));
        if (tokens.length > 0) {
          conditions = Array.from(new Set(tokens)).join(', ');
        }
      }
    }
  }

  const serialMatch = upper.match(/(?:SERIAL\s*(?:NO\.?)?|CARD\s*SN|\bSN\b)[\s:.-]*([A-Z0-9-]{7,18})/i);
  if (serialMatch) {
    cardSerialNumber = serialMatch[1].trim();
  }

  return { dlCodes, restrictions, conditions, cardSerialNumber };
};

export interface BuildProvenancePipelineInput {
  readonly rawText: string;
  readonly extractedFields?: Readonly<Record<string, string | undefined>>;
  readonly fieldConfidences?: Readonly<Record<string, number>>;
  readonly targetCategory?: GovernmentIdCategory;
  readonly expectedSide?: DocumentSide;
  readonly manualTemplateIdOverride?: string;
  readonly qualityGate?: {
    readonly passed: boolean;
    readonly blurVariance?: number;
    readonly glareRatio?: number;
    readonly brightness?: number;
    readonly contrast?: number;
    readonly skewDegrees?: number;
    readonly cardCoverageRatio?: number;
    readonly failureReason?: string | null;
  };
  readonly previousOppositeSideAnalysis?: DocumentAnalysisResult | null;
}

export const runPhilippineIdRecognitionPipeline = (
  input: BuildProvenancePipelineInput
): DocumentAnalysisResult => {
  const classification = classifyPhilippineDocument({
    rawText: input.rawText,
    targetCategory: input.targetCategory,
    expectedSide: input.expectedSide,
    manualTemplateIdOverride: input.manualTemplateIdOverride,
  });

  const template: IdTemplate | undefined =
    classification.templateId !== 'UNKNOWN' ? getIdTemplateById(classification.templateId) : undefined;

  const qualityPassed = input.qualityGate ? input.qualityGate.passed : true;
  const qualityFailures: string[] = [];
  if (input.qualityGate?.failureReason) {
    qualityFailures.push(input.qualityGate.failureReason);
  }
  if (classification.sideMismatchWarning) {
    qualityFailures.push(classification.sideMismatchWarning);
  }

  // If classification returned UNKNOWN, do NOT force-parse through LTO or PhilSys!
  if (classification.templateId === 'UNKNOWN' || classification.categoryKey === 'unknown') {
    return {
      quality: {
        passed: qualityPassed,
        blurScore: input.qualityGate?.blurVariance ?? 100,
        glareScore: input.qualityGate?.glareRatio ?? 0,
        brightnessScore: input.qualityGate?.brightness ?? 128,
        contrastScore: input.qualityGate?.contrast ?? 64,
        SkewDegrees: input.qualityGate?.skewDegrees ?? 0,
        cardCoverageRatio: input.qualityGate?.cardCoverageRatio ?? 0.85,
        failureReasons: qualityFailures,
      },
      classification,
      fields: {},
      privacyCompliance: {
        excludedSensitiveFields: [],
        allowBiometricProfiling: false,
        pcnSeparatedFromPsn: true,
        complianceNote: 'Document type could not be verified. Manual ID type selection is required before extraction.',
      },
      overallStatus: 'UNSUPPORTED_DOCUMENT',
      officialVerificationStatus: 'not_checked',
    };
  }

  // Parse machine-readable channels (MRZ / QR / Barcode)
  const mrChannel = parseMachineReadableChannels(input.rawText, classification.documentFamily);

  // Parse VIZ text using anchor + spatial FSM (only for front/data-page/document, or back-specific fields)
  const anchorParsed =
    classification.side !== 'back' ? parseDynamicIdAnchors(input.rawText) : { confidence: 0 };
  const fsmParsed =
    classification.side !== 'back' ? parseIdFieldsWithSpatialFsm(input.rawText) : {};

  // Version-specific LTO codes
  const ltoCodes =
    classification.documentFamily === 'LTO_DRIVERS_LICENSE'
      ? extractLtoVersionedCodes(input.rawText, classification.version)
      : {};

  // Profession extraction for PRC
  let prcProfession: string | undefined;
  let prcRegistrationDate: string | undefined;
  if (classification.documentFamily === 'PRC_PROFESSIONAL_ID') {
    const profMatch = input.rawText.match(
      /\b(CIVIL ENGINEER|MECHANICAL ENGINEER|ELECTRICAL ENGINEER|ELECTRONICS ENGINEER|CHEMICAL ENGINEER|GEODETIC ENGINEER|ARCHITECT|PHYSICIAN|MEDICAL TECHNOLOGIST|NURSE|REGISTERED NURSE|PROFESSIONAL TEACHER|CERTIFIED PUBLIC ACCOUNTANT|PHARMACIST|CRIMINOLOGIST|MIDWIFE|SOCIAL WORKER|DENTIST|PSYCHOLOGIST|FORESTER|AGRICULTURIST)\b/i
    );
    if (profMatch) {
      prcProfession = profMatch[1].toUpperCase();
    }
    const regDateMatch = input.rawText.match(
      /(?:REGISTRATION\s*DATE|REG\.?\s*DATE)[\s:.-]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i
    );
    if (regDateMatch) {
      prcRegistrationDate = regDateMatch[1];
    }
  }

  // Generic ID Number fallback for Wave 1 & Wave 2 templates when label is e.g. PIN, PRN, VIN, OSCA, PWD, OWWA, etc.
  let genericPatternIdNumber: string | undefined;
  const cleanUpper = input.rawText.toUpperCase();
  if (classification.categoryKey === 'philsys') {
    // Strictly match 16-digit PCN (####-####-####-####) and never match a line labeled PSN
    const nonPsnLines = cleanUpper
      .split(/[\r\n]+/)
      .filter((l) => !/\bPSN\b/.test(l))
      .join('\n');
    const pcnMatch = nonPsnLines.match(/\b(\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4})\b/);
    if (pcnMatch) genericPatternIdNumber = pcnMatch[1].replace(/\s+/g, '-');
  } else if (classification.categoryKey === 'philhealth') {
    const pinMatch = cleanUpper.match(/\b(\d{2}-\d{9}-\d)\b/);
    if (pinMatch) genericPatternIdNumber = pinMatch[1];
  } else if (classification.categoryKey === 'sss') {
    const sssMatch = cleanUpper.match(/\b(\d{2}-\d{7}-\d|\d{4}-\d{7}-\d)\b/);
    if (sssMatch) genericPatternIdNumber = sssMatch[1];
  } else if (classification.categoryKey === 'pwd') {
    const pwdMatch =
      cleanUpper.match(/\b(\d{2}-\d{4}-\d{3}-\d{7})\b/) ||
      cleanUpper.match(/(?:PWD\s*(?:ID)?\s*(?:NO\.?)?|ID\s*NO\.?)[\s:.-]*([A-Z0-9-]{6,20})/i);
    if (pwdMatch) genericPatternIdNumber = pwdMatch[1];
  } else if (classification.categoryKey === 'prc') {
    const prcMatch =
      cleanUpper.match(/(?:REGISTRATION\s*NO\.?|REG\.?\s*NO\.?)[\s:.-]*(\d{7})\b/i) ||
      cleanUpper.match(/\b(\d{7})\b/);
    if (prcMatch) genericPatternIdNumber = prcMatch[1];
  } else if (classification.categoryKey === 'postal') {
    const prnMatch = cleanUpper.match(/\bPRN[\s:-]*([A-Z0-9]{9,16})\b/i);
    if (prnMatch) genericPatternIdNumber = `PRN ${prnMatch[1]}`;
  } else if (
    classification.categoryKey === 'owwa' ||
    classification.categoryKey === 'comelec' ||
    classification.categoryKey === 'senior_citizen' ||
    classification.categoryKey === 'solo_parent' ||
    classification.categoryKey === 'barangay' ||
    classification.categoryKey === 'gsis'
  ) {
    const ctrlMatch = cleanUpper.match(
      /(?:VIN|OWWA\s*(?:NO\.?)?|ECARD\s*NO\.?|OSCA\s*(?:ID)?\s*(?:NO\.?)?|BP\s*NO\.?|CONTROL\s*NO\.?|ID\s*NO\.?)[\s:.-]*([A-Z0-9-]{5,24})/i
    );
    if (ctrlMatch) genericPatternIdNumber = ctrlMatch[1];
  } else if (classification.categoryKey === 'fire') {
    const bfpMatch = cleanUpper.match(/\b(BFP-[A-Z0-9]{2,4}-\d{4}-\d{3,4})\b/);
    if (bfpMatch) genericPatternIdNumber = bfpMatch[1];
  } else if (classification.categoryKey === 'police') {
    const pnpMatch = cleanUpper.match(/\b(PNP-[A-Z0-9]{2,4}-\d{4}-\d{3,4})\b/);
    if (pnpMatch) genericPatternIdNumber = pnpMatch[1];
  }

  // Merge raw candidates (caller ROI fields -> anchor/FSM -> machine-readable channel)
  const callerFields = input.extractedFields ?? {};
  const callerConf = input.fieldConfidences ?? {};

  const rawCandidates: Record<string, { raw: string; source: ExtractedFieldSource; baseConf: number }> = {};

  const setCandidate = (
    key: string,
    val: string | undefined,
    source: ExtractedFieldSource,
    defaultConf: number
  ): void => {
    if (!val || !val.trim()) return;
    const explicitConf = callerConf[key];
    const conf = typeof explicitConf === 'number' ? explicitConf : defaultConf;
    rawCandidates[key] = { raw: val.trim(), source, baseConf: conf };
  };

  if (classification.side !== 'back') {
    const resolvedFullName =
      callerFields['fullname'] ||
      callerFields['fullName'] ||
      anchorParsed.fullName ||
      fsmParsed.fullName;
    setCandidate('fullName', resolvedFullName, 'VIZ_OCR', 0.84);

    const nameParts = resolvedFullName ? parseNameComponents(resolvedFullName) : { firstName: '', middleName: '', lastName: '' };
    setCandidate('lastName', callerFields['lastName'] || anchorParsed.lastName || fsmParsed.lastName || nameParts.lastName, 'VIZ_OCR', 0.84);
    setCandidate('firstName', callerFields['firstName'] || anchorParsed.firstName || fsmParsed.firstName || nameParts.firstName, 'VIZ_OCR', 0.84);
    setCandidate('middleName', callerFields['middleName'] || anchorParsed.middleName || fsmParsed.middleName || nameParts.middleName, 'VIZ_OCR', 0.82);

    const resolvedIdNo =
      callerFields['idNumber'] ||
      callerFields['licenseNumber'] ||
      anchorParsed.licenseNumber ||
      anchorParsed.idNumber ||
      fsmParsed.idNumber ||
      genericPatternIdNumber;
    setCandidate('idNumber', resolvedIdNo, 'VIZ_OCR', 0.86);

    setCandidate('dateOfBirth', callerFields['dateOfBirth'] || anchorParsed.dateOfBirth || fsmParsed.birthDate, 'VIZ_OCR', 0.84);
    setCandidate('expirationDate', callerFields['expirationDate'] || anchorParsed.expirationDate || fsmParsed.expirationDate, 'VIZ_OCR', 0.82);
    setCandidate('sex', callerFields['sex'] || anchorParsed.sex || fsmParsed.sex, 'VIZ_OCR', 0.86);
    setCandidate('address', callerFields['address'] || anchorParsed.address || fsmParsed.address, 'VIZ_OCR', 0.78);
    setCandidate('weight', callerFields['weight'] || anchorParsed.weight || fsmParsed.weight, 'VIZ_OCR', 0.82);
    setCandidate('height', callerFields['height'] || anchorParsed.height || fsmParsed.height, 'VIZ_OCR', 0.82);
    setCandidate('nationality', callerFields['nationality'] || anchorParsed.nationality || fsmParsed.nationality, 'VIZ_OCR', 0.82);
    setCandidate('agencyCode', callerFields['agencyCode'] || anchorParsed.agencyCode || fsmParsed.agencyCode, 'VIZ_OCR', 0.80);
    setCandidate('bloodType', callerFields['bloodType'] || anchorParsed.bloodType || fsmParsed.bloodType, 'VIZ_OCR', 0.80);
    setCandidate('eyesColor', callerFields['eyesColor'] || anchorParsed.eyesColor || fsmParsed.eyesColor, 'VIZ_OCR', 0.80);
  } else {
    // Back side: only extract back-specific fields (never overwrite front personal details)
    const backSex = callerFields['sex'] || (/\bKASARIAN\b|\bSEX\b/i.test(input.rawText) ? (/\b(FEMALE|BABAE)\b/i.test(input.rawText) ? 'FEMALE' : /\b(MALE|LALAKI)\b/i.test(input.rawText) ? 'MALE' : undefined) : undefined);
    if (backSex) setCandidate('sex', backSex, 'VIZ_OCR', 0.82);
  }

  // Versioned LTO & PRC fields
  if (ltoCodes.dlCodes) setCandidate('dlCodes', ltoCodes.dlCodes, 'VIZ_OCR', 0.84);
  if (ltoCodes.restrictions) setCandidate('restrictions', ltoCodes.restrictions, 'VIZ_OCR', 0.84);
  if (ltoCodes.conditions || anchorParsed.conditions) {
    setCandidate('conditions', ltoCodes.conditions || anchorParsed.conditions, 'VIZ_OCR', 0.82);
  }
  if (ltoCodes.cardSerialNumber) setCandidate('cardSerialNumber', ltoCodes.cardSerialNumber, 'VIZ_OCR', 0.84);
  if (prcProfession) setCandidate('profession', prcProfession, 'VIZ_OCR', 0.85);
  if (prcRegistrationDate) setCandidate('registrationDate', prcRegistrationDate, 'VIZ_OCR', 0.82);

  // Build provenance records & cross-check against Machine-Readable Channel (MRZ / QR)
  const provenanceFields: Record<string, ExtractedField> = {};

  // Ensure all required template fields have an entry (even if NOT_EXTRACTED)
  const templateFieldKeys = new Set<string>(template ? template.fields.map((f) => f.key) : []);
  for (const k of Object.keys(rawCandidates)) {
    templateFieldKeys.add(k);
  }
  for (const k of Object.keys(mrChannel.fields)) {
    templateFieldKeys.add(k);
  }

  const excludedSensitive = new Set<string>(
    (template?.privacyRules?.excludedSensitiveFields ?? []).map((s) => s.toLowerCase())
  );

  for (const fieldKey of templateFieldKeys) {
    if (excludedSensitive.has(fieldKey.toLowerCase())) {
      continue;
    }

    const vizCand = rawCandidates[fieldKey];
    const mrVal = mrChannel.fields[fieldKey];
    const fieldDef = template?.fields.find((f) => f.key === fieldKey);
    const minConf = fieldDef?.minConfidenceForAutoFill ?? 0.72;

    if (!vizCand && !mrVal) {
      provenanceFields[fieldKey] = {
        rawText: '',
        normalizedValue: null,
        confidence: 0,
        source: 'VIZ_OCR',
        sourceSide: classification.side,
        sourceRegion: fieldDef?.normalizedRegions[0],
        validation: {
          formatValid: false,
          semanticValid: false,
          messages: ['Field was not extracted from image.'],
        },
        status: 'NOT_EXTRACTED',
        warnings: [],
      };
      continue;
    }

    const rawTextVal = vizCand?.raw || mrVal || '';
    const rawConf = vizCand ? vizCand.baseConf : mrChannel.valid ? 0.92 : 0.60;
    const source: ExtractedFieldSource =
      !vizCand && mrVal
        ? mrChannel.channelType === 'MRZ'
          ? 'MRZ'
          : mrChannel.channelType === 'QR'
            ? 'QR'
            : 'BARCODE'
        : vizCand?.source ?? 'VIZ_OCR';

    const messages: string[] = [];
    const warnings: string[] = [];
    let formatValid = true;
    let semanticValid = true;
    let normalizedValue: string | null = rawTextVal;
    let crossChecked: boolean | undefined;
    let checkDigitValid: boolean | undefined = mrChannel.checkDigitsValid;

    // Cross-check VIZ vs MRZ/QR when both exist
    if (vizCand && mrVal) {
      crossChecked = true;
      if (fieldKey === 'fullName' || fieldKey === 'lastName' || fieldKey === 'firstName') {
        const cmp = crossCheckFullName(vizCand.raw, mrVal, 0.85);
        if (!cmp.isMatch) {
          semanticValid = false;
          warnings.push(`VIZ vs. ${mrChannel.channelType} mismatch on ${fieldKey}: VIZ="${vizCand.raw}" vs. ${mrChannel.channelType}="${mrVal}".`);
        } else {
          messages.push(`Cross-checked against ${mrChannel.channelType} (similarity ${(cmp.similarity * 100).toFixed(0)}%).`);
        }
      } else if (fieldKey === 'idNumber') {
        const cleanViz = vizCand.raw.replace(/[\s-]/g, '').toUpperCase();
        const cleanMr = mrVal.replace(/[\s-]/g, '').toUpperCase();
        if (cleanViz !== cleanMr) {
          semanticValid = false;
          warnings.push(`VIZ vs. ${mrChannel.channelType} ID number discrepancy: VIZ="${vizCand.raw}" vs. ${mrChannel.channelType}="${mrVal}".`);
        } else {
          messages.push(`ID number verified against ${mrChannel.channelType}.`);
        }
      } else if (fieldKey === 'dateOfBirth' || fieldKey === 'expirationDate') {
        const dViz = normalizeStandardDate(vizCand.raw).normalized;
        const dMr = normalizeStandardDate(mrVal).normalized;
        if (dViz && dMr && dViz !== dMr) {
          semanticValid = false;
          warnings.push(`VIZ vs. ${mrChannel.channelType} date discrepancy: VIZ="${dViz}" vs. ${mrChannel.channelType}="${dMr}".`);
        }
      }
    }

    // If MRZ check digits failed on a passport field, downgrade validity
    if (mrChannel.channelType === 'MRZ' && mrChannel.checkDigitsValid === false) {
      semanticValid = false;
      warnings.push(...mrChannel.warnings);
    }

    // Per-field normalization & validation
    if (fieldKey === 'idNumber' || fieldKey === 'licenseNumber') {
      const idVal = validateIdNumber(classification.categoryKey, rawTextVal);
      formatValid = idVal.isValid;
      normalizedValue = idVal.isValid ? idVal.normalized : rawTextVal;
      if (!idVal.isValid && idVal.error) {
        messages.push(idVal.error);
        warnings.push(idVal.error);
      }
    } else if (fieldKey === 'dateOfBirth' || fieldKey === 'expirationDate' || fieldKey === 'registrationDate') {
      const dateRes = normalizeStandardDate(rawTextVal);
      formatValid = dateRes.valid;
      normalizedValue = dateRes.normalized;
      if (!dateRes.valid) {
        warnings.push(`Invalid or unparseable date format for ${fieldKey}: "${rawTextVal}"`);
      } else if (fieldKey === 'dateOfBirth' && dateRes.normalized) {
        const birthYr = parseInt(dateRes.normalized.slice(0, 4), 10);
        const currentYr = new Date().getFullYear();
        const approxAge = currentYr - birthYr;
        if (approxAge < 0 || approxAge > 125) {
          semanticValid = false;
          warnings.push(`Implausible birth year ${birthYr}.`);
        }
        if (classification.categoryKey === 'senior_citizen' && approxAge < 60) {
          semanticValid = false;
          warnings.push(`Senior Citizen ID requires cardholder age >= 60 (computed age: ${approxAge}).`);
        }
      }
    } else if (fieldKey === 'fullName' || fieldKey === 'lastName' || fieldKey === 'firstName' || fieldKey === 'middleName') {
      formatValid = isPlausibleHumanName(rawTextVal);
      normalizedValue = formatValid ? rawTextVal.toUpperCase() : null;
      if (!formatValid) {
        warnings.push(`Name field "${fieldKey}" failed plausibility check: "${rawTextVal}".`);
      }
    } else if (fieldKey === 'weight') {
      const normWt = normalizePhysicalMeasurement(rawTextVal, 'weight');
      formatValid = Boolean(normWt);
      normalizedValue = normWt ? `${normWt} kg` : null;
      if (!formatValid) warnings.push(`Weight "${rawTextVal}" is outside valid kg range (30-250 kg).`);
    } else if (fieldKey === 'height') {
      const normHt = normalizePhysicalMeasurement(rawTextVal, 'height');
      formatValid = Boolean(normHt);
      normalizedValue = normHt ? `${normHt} m` : null;
      if (!formatValid) warnings.push(`Height "${rawTextVal}" is outside valid meters range (0.90-2.50 m).`);
    } else if (fieldKey === 'address') {
      const normAddr = normalizePhilippineAddress(rawTextVal);
      formatValid = normAddr.length >= 5;
      normalizedValue = formatValid ? normAddr : null;
    } else if (fieldKey === 'sex') {
      const upperSex = rawTextVal.toUpperCase().trim();
      if (/^(M|MALE|LALAKI)$/.test(upperSex)) {
        normalizedValue = 'MALE';
      } else if (/^(F|FEMALE|BABAE)$/.test(upperSex)) {
        normalizedValue = 'FEMALE';
      } else {
        formatValid = false;
        normalizedValue = null;
      }
    }

    // Calibrated confidence (NO artificial floor!)
    const calibratedConf =
      rawConf <= 0
        ? 0
        : Number(
            Math.max(
              0,
              Math.min(
                0.99,
                rawConf * (formatValid ? 1.0 : 0.55) * (semanticValid ? 1.0 : 0.65)
              )
            ).toFixed(2)
          );

    // Status determination
    let status: ExtractedFieldStatus;
    if (calibratedConf === 0 || !rawTextVal.trim()) {
      status = 'NOT_EXTRACTED';
    } else if (
      calibratedConf >= minConf &&
      formatValid &&
      semanticValid &&
      warnings.length === 0 &&
      !classification.sideMismatchWarning
    ) {
      status = 'ACCEPTED_FOR_PREFILL';
    } else {
      status = 'REQUIRES_REVIEW';
    }

    provenanceFields[fieldKey] = {
      rawText: rawTextVal,
      normalizedValue,
      confidence: calibratedConf,
      source,
      sourceSide: classification.side,
      sourceRegion: fieldDef?.normalizedRegions[0],
      validation: {
        formatValid,
        semanticValid,
        crossChecked,
        checkDigitValid,
        messages,
      },
      status,
      warnings,
    };
  }

  // 4. Front/Back Consistency Check (if opposite side analysis was previously completed)
  let crossSideCheck: DocumentAnalysisResult['crossSideCheck'];
  if (input.previousOppositeSideAnalysis) {
    const prev = input.previousOppositeSideAnalysis;
    const mismatches: string[] = [];

    if (
      prev.classification.documentFamily !== 'UNKNOWN' &&
      classification.documentFamily !== 'UNKNOWN' &&
      prev.classification.documentFamily !== classification.documentFamily
    ) {
      mismatches.push(
        `Front/Back document family mismatch: "${prev.classification.documentFamily}" vs. "${classification.documentFamily}".`
      );
    }

    const overlappingKeys = ['idNumber', 'fullName', 'dateOfBirth', 'dlCodes', 'restrictions'];
    for (const key of overlappingKeys) {
      const a = prev.fields[key]?.normalizedValue;
      const b = provenanceFields[key]?.normalizedValue;
      if (a && b) {
        const isConsistent =
          key === 'fullName'
            ? crossCheckFullName(String(a), String(b), 0.80).isMatch
            : String(a).replace(/[\s,-]/g, '').toUpperCase() === String(b).replace(/[\s,-]/g, '').toUpperCase();
        if (!isConsistent) {
          mismatches.push(`Front/Back mismatch on ${key}: "${String(a)}" vs. "${String(b)}".`);
          const existing = provenanceFields[key];
          if (existing) {
            provenanceFields[key] = {
              ...existing,
              status: 'REQUIRES_REVIEW',
              warnings: [...existing.warnings, `Front/Back mismatch against opposite side ("${String(a)}").`],
            };
          }
        }
      }
    }

    crossSideCheck = {
      performed: true,
      consistent: mismatches.length === 0,
      mismatches,
    };
  }

  // 5. Overall Document Status Determination
  const allExtracted = Object.values(provenanceFields);
  const anyRequiresReview =
    allExtracted.some((f) => f.status === 'REQUIRES_REVIEW') ||
    Boolean(classification.sideMismatchWarning) ||
    Boolean(crossSideCheck && !crossSideCheck.consistent);
  const anyAccepted = allExtracted.some((f) => f.status === 'ACCEPTED_FOR_PREFILL');

  let overallStatus: DocumentAnalysisResult['overallStatus'];
  if (!qualityPassed) {
    overallStatus = 'RECAPTURE_REQUIRED';
  } else if (anyRequiresReview || !anyAccepted) {
    overallStatus = 'NEEDS_USER_REVIEW';
  } else {
    overallStatus = 'READY_FOR_PREFILL';
  }

  return {
    quality: {
      passed: qualityPassed,
      blurScore: input.qualityGate?.blurVariance ?? 120,
      glareScore: input.qualityGate?.glareRatio ?? 0.02,
      brightnessScore: input.qualityGate?.brightness ?? 135,
      contrastScore: input.qualityGate?.contrast ?? 68,
      SkewDegrees: input.qualityGate?.skewDegrees ?? 0,
      cardCoverageRatio: input.qualityGate?.cardCoverageRatio ?? 0.88,
      failureReasons: qualityFailures,
    },
    classification,
    fields: provenanceFields,
    crossSideCheck,
    privacyCompliance: {
      excludedSensitiveFields: template?.privacyRules?.excludedSensitiveFields ?? [],
      allowBiometricProfiling: template?.privacyRules?.allowBiometricProfiling ?? true,
      pcnSeparatedFromPsn: true,
      complianceNote: template?.privacyRules?.complianceNote,
    },
    overallStatus,
    officialVerificationStatus: 'not_checked',
  };
};
