// [Layer: Libs/Vision/idScanner]
// Responsibility: High-throughput Web Worker executing DIP pipeline, quality gates, and OCR without locking React main thread.
// Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>). Zero emojis.

import {
  rgbaToGrayscale,
  flattenIllumination,
  sauvolaAdaptiveThreshold,
  morphologyClose,
  deskewProjectionProfile
} from './binarize';
import { evaluateQualityGate, QualityGateEvaluation } from './qualityGates';
import { autoCanny, Point2D } from './cannyHough';
import { findCardQuad, CardQuadResult } from './contour';
import { orderCorners, solveHomography, warpPerspective, OrderedCorners } from './homography';
import {
  getIdSpec,
  getAllIdSpecs,
  GovernmentIdCategory,
  GovernmentIdSpec,
  FieldCropSpec,
  NON_TEXT_ROI_KEYS,
  identifyIdCategoryFromHeader
} from './idSpecs';
import { findConnectedComponents, groupBoundingBoxesIntoLines } from './ccl';
import { recognizeLineText, RecognizedLineResult } from './glyphMatcher';
import {
  repairAlphaField,
  repairNumericField,
  parseMrzLine,
  validateIdNumber,
  matchIdCategoryFromDictionaries,
  computeIdScanConfidence,
  getIdScanConfidenceTier,
  IdScanConfidenceTier,
  sanitizeExtractedPersonName
} from './validators';

export interface WorkerAnalyzeFrameRequest {
  readonly id: string;
  readonly type: 'ANALYZE_FRAME';
  readonly imageData: ImageData;
  readonly targetRatios?: readonly number[];
}

export interface WorkerAnalyzeFrameResponse {
  readonly id: string;
  readonly type: 'FRAME_ANALYSIS';
  readonly success: boolean;
  readonly corners: Point2D[] | null;
  readonly orderedCorners: OrderedCorners | null;
  readonly quality: QualityGateEvaluation;
  readonly aspectRatio: number;
  readonly quadScore: number;
  readonly error?: string;
}

export interface WorkerFullScanRequest {
  readonly id: string;
  readonly type: 'FULL_SCAN';
  readonly imageData: ImageData;
  readonly targetCategory?: GovernmentIdCategory;
  readonly userRole?: 'Responder' | 'Civilian';
  readonly targetRatios?: readonly number[];
}

export interface ExtractedFieldsPayload {
  readonly fullname?: string;
  readonly idNumber?: string;
  readonly employeeId?: string;
  readonly dateOfBirth?: string;
  readonly age?: string;
  readonly expirationDate?: string;
  readonly sex?: string;
  readonly address?: string;
  readonly rankOrTitle?: string;
}

export interface WorkerIdScanResult {
  readonly success: boolean;
  readonly idCategory: GovernmentIdCategory;
  readonly confidence: number;
  readonly confidenceTier: IdScanConfidenceTier;
  readonly fields: ExtractedFieldsPayload;
  readonly quality: QualityGateEvaluation;
  readonly corners: Point2D[];
  readonly rectifiedImageData?: ImageData;
  readonly executionTimeMs: number;
  readonly method: 'DETERMINISTIC_CV' | 'AI_STANDBY_FALLBACK';
  readonly rawText: string;
  readonly requiresAiFallback: boolean;
  readonly error?: string;
}

export interface WorkerFullScanResponse {
  readonly id: string;
  readonly type: 'SCAN_COMPLETE';
  readonly success: boolean;
  readonly result?: WorkerIdScanResult;
  readonly error?: string;
}

export type WorkerRequest = WorkerAnalyzeFrameRequest | WorkerFullScanRequest;
export type WorkerResponse = WorkerAnalyzeFrameResponse | WorkerFullScanResponse;

/**
 * Extracts a sub-region binary mask from a full 2D binary buffer.
 */
export const extractSubRegion = (
  source: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): { data: Uint8Array; width: number; height: number } => {
  const x0 = Math.max(0, Math.min(fullWidth - 1, Math.floor(rx)));
  const y0 = Math.max(0, Math.min(fullHeight - 1, Math.floor(ry)));
  const x1 = Math.max(x0 + 1, Math.min(fullWidth, Math.floor(rx + rw)));
  const y1 = Math.max(y0 + 1, Math.min(fullHeight, Math.floor(ry + rh)));

  const width = x1 - x0;
  const height = y1 - y0;
  const data = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const srcRowOffset = (y0 + y) * fullWidth + x0;
    const dstRowOffset = y * width;
    for (let x = 0; x < width; x++) {
      data[dstRowOffset + x] = source[srcRowOffset + x];
    }
  }

  return { data, width, height };
};

/**
 * Executes optical character recognition on a specific field crop spec.
 */
export const ocrFieldRegion = (
  binaryMask: Uint8Array,
  maskWidth: number,
  maskHeight: number,
  spec: FieldCropSpec
): { text: string; confidence: number } => {
  const rx = spec.relativeRoi.x * maskWidth;
  const ry = spec.relativeRoi.y * maskHeight;
  const rw = spec.relativeRoi.w * maskWidth;
  const rh = spec.relativeRoi.h * maskHeight;

  const crop = extractSubRegion(binaryMask, maskWidth, maskHeight, rx, ry, rw, rh);
  if (crop.width < 8 || crop.height < 8) {
    return { text: '', confidence: 0 };
  }

  const cclResult = findConnectedComponents(crop.data, crop.width, crop.height);
  if (cclResult.boxes.length === 0) {
    return { text: '', confidence: 0 };
  }

  const lines = groupBoundingBoxesIntoLines(cclResult.boxes);
  if (lines.length === 0) {
    return { text: '', confidence: 0 };
  }

  let allowedChars: string | undefined;
  if (spec.expectedCharType === 'NUMERIC') {
    allowedChars = '0123456789-';
  } else if (spec.expectedCharType === 'ALPHA') {
    allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ .';
  } else if (spec.expectedCharType === 'MRZ') {
    allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
  }

  const recognizedLines: RecognizedLineResult[] = lines.map((line) =>
    recognizeLineText(crop.data, crop.width, line.charBoxes, allowedChars)
  );

  const rawJoined = recognizedLines.map((r) => r.text).join(' ').trim();
  const sumConf = recognizedLines.reduce((acc, curr) => acc + curr.confidence, 0);
  const avgConf = recognizedLines.length > 0 ? sumConf / recognizedLines.length : 0;

  let repaired = rawJoined;
  if (spec.expectedCharType === 'NUMERIC') {
    repaired = repairNumericField(rawJoined);
  } else if (spec.expectedCharType === 'ALPHA') {
    repaired = repairAlphaField(rawJoined);
  }

  return {
    text: repaired,
    confidence: avgConf
  };
};

/**
 * Executes frame analysis: quality gates + canny + card quadrilateral detection.
 */
export const executeFrameAnalysis = (
  imageData: ImageData,
  targetRatios: readonly number[] = [1.5858, 1.4205, 1.25]
): Omit<WorkerAnalyzeFrameResponse, 'id'> => {
  const width = imageData.width;
  const height = imageData.height;

  const quality = evaluateQualityGate(imageData.data, width, height);
  const gray = rgbaToGrayscale(imageData.data, width, height);
  const edges = autoCanny(gray, width, height);
  const quadResult: CardQuadResult | null = findCardQuad(edges, width, height, [...targetRatios], gray);

  if (!quadResult || quadResult.corners.length !== 4) {
    return {
      type: 'FRAME_ANALYSIS',
      success: true,
      corners: null,
      orderedCorners: null,
      quality,
      aspectRatio: 0,
      quadScore: 0
    };
  }

  const ordered = orderCorners(quadResult.corners);

  return {
    type: 'FRAME_ANALYSIS',
    success: true,
    corners: quadResult.corners,
    orderedCorners: ordered,
    quality,
    aspectRatio: quadResult.aspect,
    quadScore: quadResult.score
  };
};

/**
 * Executes the complete deterministic CV pipeline:
 * Quality Gates -> Canny/Contour Quad -> Homography Rectification -> Sauvola -> CCL & Glyph OCR -> Verification.
 */
export const executeFullCardScan = (
  imageData: ImageData,
  targetCategory?: GovernmentIdCategory,
  userRole?: 'Responder' | 'Civilian',
  targetRatios: readonly number[] = [1.5858, 1.4205, 1.25]
): WorkerIdScanResult => {
  const startTime = performance.now();
  const width = imageData.width;
  const height = imageData.height;

  // 1. Quality Gates Assessment
  const quality = evaluateQualityGate(imageData.data, width, height);

  // 2. Edge Detection and Quadrilateral Boundary Finding
  const gray = rgbaToGrayscale(imageData.data, width, height);
  const edges = autoCanny(gray, width, height);
  const quadResult = findCardQuad(edges, width, height, [...targetRatios], gray);

  let orderedCorners: OrderedCorners;
  let quadScore = 0.5;

  if (quadResult && quadResult.corners.length === 4) {
    orderedCorners = orderCorners(quadResult.corners);
    quadScore = quadResult.score;
  } else {
    // Center-framed viewport fallback (84% width with ISO ID-1 1.5858 aspect ratio)
    const cw = width * 0.84;
    const ch = cw / 1.5858;
    const cx = width / 2;
    const cy = height / 2;
    orderedCorners = {
      tl: { x: cx - cw / 2, y: cy - ch / 2 },
      tr: { x: cx + cw / 2, y: cy - ch / 2 },
      br: { x: cx + cw / 2, y: cy + ch / 2 },
      bl: { x: cx - cw / 2, y: cy + ch / 2 }
    };
    quadScore = 0.72;
  }

  // 3. Perspective Rectification (Standard ID-1: 856 x 540)
  const targetW = 856;
  const targetH = 540;
  const srcPts: Point2D[] = [
    orderedCorners.tl,
    orderedCorners.tr,
    orderedCorners.br,
    orderedCorners.bl
  ];
  const dstPts: Point2D[] = [
    { x: 0, y: 0 },
    { x: targetW, y: 0 },
    { x: targetW, y: targetH },
    { x: 0, y: targetH }
  ];

  const H = solveHomography(srcPts, dstPts);
  const rectified = warpPerspective(imageData, H, targetW, targetH);

  // 4. Preprocessing & Adaptive Binarization
  const rectGray = rgbaToGrayscale(rectified.data, targetW, targetH);
  const flattened = flattenIllumination(rectGray, targetW, targetH, 15);
  const sauvola = sauvolaAdaptiveThreshold(flattened, targetW, targetH, 25, 0.2);
  const closed = morphologyClose(sauvola, targetW, targetH);
  const deskewResult = deskewProjectionProfile(closed, targetW, targetH);
  const cleanBinary = deskewResult.bestAngle !== 0 ? deskewResult.deskewed : closed;

  // 5. Template & Layout Classification
  // Extract top 25% header region to match against government ID dictionary
  const headerCrop = extractSubRegion(cleanBinary, targetW, targetH, 0, 0, targetW, targetH * 0.26);
  const headerCcl = findConnectedComponents(headerCrop.data, headerCrop.width, headerCrop.height);
  const headerLines = groupBoundingBoxesIntoLines(headerCcl.boxes);
  const headerTexts = headerLines.map(
    (l) => recognizeLineText(headerCrop.data, headerCrop.width, l.charBoxes).text
  );

  let detectedCategory: GovernmentIdCategory = targetCategory || 'philsys';
  let classificationScore = 0.85;

  const joinedHeaderText = headerTexts.join(' ');
  const headerIdentified = identifyIdCategoryFromHeader(joinedHeaderText);
  if (headerIdentified) {
    detectedCategory = headerIdentified.type;
    classificationScore = Math.max(classificationScore, headerIdentified.confidence);
  } else {
    const dictionaryMatched = matchIdCategoryFromDictionaries(joinedHeaderText, 0.32);
    if (dictionaryMatched) {
      detectedCategory = dictionaryMatched.type;
      classificationScore = dictionaryMatched.confidence;
    } else if (!targetCategory) {
      // Check if MRZ exists at bottom for Passport
      const mrzCrop = extractSubRegion(cleanBinary, targetW, targetH, 0, targetH * 0.72, targetW, targetH * 0.28);
      const mrzCcl = findConnectedComponents(mrzCrop.data, mrzCrop.width, mrzCrop.height);
      if (mrzCcl.boxes.length >= 30) {
        detectedCategory = 'passport';
        classificationScore = 0.90;
      }
    }
  }

  // 6. Field Extraction via Layout Map & CCL Glyph OCR
  const spec: GovernmentIdSpec = getIdSpec(detectedCategory);
  const extractedMap: Record<string, string> = {};
  const fieldScores: number[] = [];
  const rawTextParts: string[] = [];

  for (const fieldSpec of spec.fields) {
    // Skip non-text visual ROIs (photos, QR codes, chips, emblems)
    if (NON_TEXT_ROI_KEYS.has(fieldSpec.fieldKey)) {
      continue;
    }

    const ocrRes = ocrFieldRegion(cleanBinary, targetW, targetH, fieldSpec);
    if (ocrRes.text) {
      extractedMap[fieldSpec.fieldKey] = ocrRes.text;
      fieldScores.push(ocrRes.confidence);
      rawTextParts.push(`${fieldSpec.label}: ${ocrRes.text}`);
    }
  }

  // Handle MRZ special decoding if passport
  if (detectedCategory === 'passport') {
    const mrzRoiSpec: FieldCropSpec = {
      fieldKey: 'mrz',
      label: 'MRZ',
      relativeRoi: { x: 0.05, y: 0.72, w: 0.90, h: 0.26 },
      expectedCharType: 'MRZ',
      regexPattern: /^[A-Z0-9<]+$/,
      required: true
    };
    const mrzCropRes = ocrFieldRegion(cleanBinary, targetW, targetH, mrzRoiSpec);
    if (mrzCropRes.text) {
      const mrzSplit = mrzCropRes.text.split(/[\r\n\s]+/).filter((s) => s.length >= 20);
      const mrzLine1 = mrzSplit[0] || mrzCropRes.text.substring(0, 44);
      const mrzLine2 = mrzSplit[1] || mrzCropRes.text.substring(44);
      const parsedMrz = parseMrzLine(mrzLine1, mrzLine2);
      if (parsedMrz.success) {
        if (parsedMrz.surname || parsedMrz.givenNames) {
          extractedMap['fullName'] = `${parsedMrz.givenNames} ${parsedMrz.surname}`.trim();
        }
        if (parsedMrz.passportNumber) {
          extractedMap['idNumber'] = parsedMrz.passportNumber;
        }
        if (parsedMrz.birthDate) {
          extractedMap['dateOfBirth'] = parsedMrz.birthDate;
        }
        if (parsedMrz.expirationDate) {
          extractedMap['expirationDate'] = parsedMrz.expirationDate;
        }
        if (parsedMrz.sex) {
          extractedMap['sex'] = parsedMrz.sex;
        }
      }
    }
  }

  // 7. Post-Processing & Normalization
  let fullname = extractedMap['fullName'] || extractedMap['name'] || '';
  if (!fullname && (extractedMap['givenNames'] || extractedMap['lastName'])) {
    const given = extractedMap['givenNames'] || '';
    const mid = extractedMap['middleName'] || '';
    const last = extractedMap['lastName'] || '';
    fullname = `${given} ${mid} ${last}`.replace(/\s+/g, ' ').trim();
  }

  // Sanitize person name to filter out OCR optical background noise/hallucinations
  const sanitizedName = sanitizeExtractedPersonName(fullname);
  fullname = sanitizedName || '';

  // Exhaustive mapping across all 8 Philippine ID specifications
  let idNumber =
    extractedMap['idNumber'] ||
    extractedMap['licenseNumber'] ||
    extractedMap['prcNumber'] ||
    extractedMap['registrationNumber'] ||
    extractedMap['pcn'] ||
    extractedMap['crn'] ||
    extractedMap['prn'] ||
    extractedMap['badgeNumber'] ||
    extractedMap['passportNumber'] ||
    '';
  let employeeId = extractedMap['employeeId'] || '';
  const dateOfBirth = extractedMap['dateOfBirth'] || extractedMap['dob'] || '';
  const expirationDate = extractedMap['expirationDate'] || extractedMap['expiry'] || '';
  const sex = extractedMap['sex'] || '';
  const address = extractedMap['address'] || '';
  const rankOrTitle = extractedMap['rank'] || extractedMap['title'] || '';

  // Validate ID number format
  let validationPass = false;
  if (idNumber) {
    const valResult = validateIdNumber(detectedCategory, idNumber);
    validationPass = valResult.isValid;
    if (valResult.isValid) {
      idNumber = valResult.normalized;
    }
  }

  // Role attribution logic for ResQTrack
  if (userRole === 'Responder' && !employeeId && idNumber) {
    employeeId = idNumber;
  }

  // 8. Composite Confidence Evaluation
  const meanFieldScore =
    fieldScores.length > 0
      ? fieldScores.reduce((acc, curr) => acc + curr, 0) / fieldScores.length
      : 0.5;

  const confidence = computeIdScanConfidence({
    quadScore,
    qualityScore: quality.score,
    classificationScore,
    meanFieldScore,
    validationPass
  });

  const confidenceTier: IdScanConfidenceTier = getIdScanConfidenceTier(confidence);
  const executionTimeMs = Math.round(performance.now() - startTime);
  const requiresAiFallback = confidence < 0.80;

  let calculatedAge: string | undefined;
  if (dateOfBirth) {
    const parts = dateOfBirth.split(/[-/.]/);
    if (parts.length === 3) {
      const yr = parts[0].length === 4 ? parseInt(parts[0], 10) : parseInt(parts[2], 10);
      const currentYear = new Date().getFullYear();
      if (yr > 1900 && yr < currentYear) {
        const a = currentYear - yr;
        if (a >= 18 && a <= 100) {
          calculatedAge = String(a);
        }
      }
    }
  }

  const finalFields: ExtractedFieldsPayload = {
    fullname: fullname || undefined,
    idNumber: idNumber || undefined,
    employeeId: employeeId || undefined,
    dateOfBirth: dateOfBirth || undefined,
    age: calculatedAge,
    expirationDate: expirationDate || undefined,
    sex: sex || undefined,
    address: address || undefined,
    rankOrTitle: rankOrTitle || undefined
  };

  return {
    success: true,
    idCategory: detectedCategory,
    confidence,
    confidenceTier,
    fields: finalFields,
    quality,
    corners: srcPts,
    rectifiedImageData: rectified,
    executionTimeMs,
    method: 'DETERMINISTIC_CV',
    rawText: rawTextParts.join('\n'),
    requiresAiFallback
  };
};

// ============================================================================
// Web Worker onmessage Dispatcher
// ============================================================================

declare abstract class WorkerGlobalScope {}

const isWorkerScope = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;

if (isWorkerScope) {
  self.onmessage = (event: MessageEvent<WorkerRequest>): void => {
    const request = event.data;
    if (!request || !request.type) {
      return;
    }

    try {
      if (request.type === 'ANALYZE_FRAME') {
        const analysis = executeFrameAnalysis(request.imageData, request.targetRatios);
        const response: WorkerAnalyzeFrameResponse = {
          id: request.id,
          ...analysis
        };
        self.postMessage(response);
      } else if (request.type === 'FULL_SCAN') {
        const scanResult = executeFullCardScan(
          request.imageData,
          request.targetCategory,
          request.userRole,
          request.targetRatios
        );
        const response: WorkerFullScanResponse = {
          id: request.id,
          type: 'SCAN_COMPLETE',
          success: true,
          result: scanResult
        };
        self.postMessage(response);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (request.type === 'ANALYZE_FRAME') {
        const response: WorkerAnalyzeFrameResponse = {
          id: request.id,
          type: 'FRAME_ANALYSIS',
          success: false,
          corners: null,
          orderedCorners: null,
          quality: {
            passed: false,
            score: 0,
            reasons: ['Worker execution error'],
            details: { laplacian: 0, glare: 0, exposure: 0, moire: 0 }
          },
          aspectRatio: 0,
          quadScore: 0,
          error: errorMsg
        };
        self.postMessage(response);
      } else {
        const response: WorkerFullScanResponse = {
          id: request.id,
          type: 'SCAN_COMPLETE',
          success: false,
          error: errorMsg
        };
        self.postMessage(response);
      }
    }
  };
}
