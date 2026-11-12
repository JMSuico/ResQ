// [Layer: Libs/Vision/idScanner]
// Responsibility: High-throughput Web Worker executing DIP pipeline, quality gates, and automated OCR on uploaded Front & Back Government IDs.
// Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>). Zero emojis.

import {
  rgbaToGrayscale,
  flattenIllumination,
  sauvolaAdaptiveThreshold,
  deskewProjectionProfile
} from './binarize';
import { evaluateQualityGate, QualityGateEvaluation } from './qualityGates';
import { autoCanny, Point2D } from './cannyHough';
import { findCardQuad } from './contour';
import { orderCorners, solveHomography, warpPerspective } from './homography';
import {
  getIdSpec,
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
  sanitizeExtractedPersonName,
  parseNameComponents,
  isPlausibleHumanName,
  normalizePhilippineAddress,
  normalizePhysicalMeasurement
} from './validators';
import { evaluateCardPresenceGate, CardPresenceEvaluation } from './cardPresenceGate';
import {
  extractFieldText,
  extractTextFromRoi,
  parseIdFieldsWithSpatialFsm,
  parseFieldsByPascalCaseIndications,
  isPascalCaseLabel
} from './textExtractor';

export interface WorkerFullScanRequest {
  readonly id: string;
  readonly type: 'FULL_SCAN';
  readonly imageData: ImageData;
  readonly targetCategory?: GovernmentIdCategory;
  readonly userRole?: 'Responder' | 'Civilian';
  readonly targetRatios?: readonly number[];
  readonly preLockedCorners?: Point2D[] | null;
  readonly side?: 'front' | 'back';
  readonly isStaticUpload?: boolean;
}

export interface ExtractedFieldsPayload {
  readonly fullname?: string;
  readonly firstName?: string;
  readonly middleName?: string;
  readonly lastName?: string;
  readonly idNumber?: string;
  readonly employeeId?: string;
  readonly dateOfBirth?: string;
  readonly age?: string;
  readonly expirationDate?: string;
  readonly sex?: string;
  readonly address?: string;
  readonly weight?: string;
  readonly height?: string;
  readonly licenseNumber?: string;
  readonly rankOrTitle?: string;
  readonly nationality?: string;
  readonly agencyCode?: string;
  readonly bloodType?: string;
  readonly eyesColor?: string;
  readonly dlCodes?: string;
  readonly restrictions?: string;
  readonly conditions?: string;
  readonly cardSerialNumber?: string;
  readonly profession?: string;
  readonly registrationDate?: string;
}

export interface WorkerIdScanResult {
  readonly success: boolean;
  readonly side: 'front' | 'back';
  readonly idCategory: GovernmentIdCategory;
  readonly confidence: number;
  readonly confidenceTier: IdScanConfidenceTier;
  readonly fields: ExtractedFieldsPayload;
  readonly quality: QualityGateEvaluation;
  readonly corners: Point2D[];
  readonly rectifiedImageData?: ImageData;
  readonly portraitImageData?: ImageData;
  readonly executionTimeMs: number;
  readonly method: 'DETERMINISTIC_CV' | 'AI_STANDBY_FALLBACK';
  readonly rawText: string;
  readonly requiresAiFallback: boolean;
  readonly error?: string;
  readonly cardPresence?: CardPresenceEvaluation;
}

export interface WorkerFullScanResponse {
  readonly id: string;
  readonly type: 'SCAN_COMPLETE';
  readonly success: boolean;
  readonly result?: WorkerIdScanResult;
  readonly error?: string;
}

export type WorkerRequest = WorkerFullScanRequest;
export type WorkerResponse = WorkerFullScanResponse;

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
 * Crops an RGBA sub-region into a standalone ImageData (used for ID Portrait extraction).
 */
export const extractRgbaSubImageData = (
  sourceRgba: Uint8ClampedArray,
  fullWidth: number,
  fullHeight: number,
  normX: number,
  normY: number,
  normW: number,
  normH: number
): ImageData => {
  const x0 = Math.max(0, Math.min(fullWidth - 2, Math.floor(normX * fullWidth)));
  const y0 = Math.max(0, Math.min(fullHeight - 2, Math.floor(normY * fullHeight)));
  const x1 = Math.max(x0 + 1, Math.min(fullWidth, Math.floor((normX + normW) * fullWidth)));
  const y1 = Math.max(y0 + 1, Math.min(fullHeight, Math.floor((normY + normH) * fullHeight)));
  const cropW = x1 - x0;
  const cropH = y1 - y0;
  const out = new Uint8ClampedArray(cropW * cropH * 4);

  for (let y = 0; y < cropH; y++) {
    const srcRow = (y0 + y) * fullWidth;
    const dstRow = y * cropW;
    for (let x = 0; x < cropW; x++) {
      const sIdx = (srcRow + x0 + x) * 4;
      const dIdx = (dstRow + x) * 4;
      out[dIdx] = sourceRgba[sIdx];
      out[dIdx + 1] = sourceRgba[sIdx + 1];
      out[dIdx + 2] = sourceRgba[sIdx + 2];
      out[dIdx + 3] = sourceRgba[sIdx + 3];
    }
  }

  return new ImageData(out, cropW, cropH);
};

/**
 * Executes optical character recognition on a specific field crop spec.
 * Uses high-resolution rectified RGBA buffer with the on-device Text Extractor 4-step pipeline
 * (ROI isolation, DPI scaling, contrast stretching, projection profiling, whitelisted glyph matching).
 */
export const ocrFieldRegion = (
  binaryMask: Uint8Array,
  maskWidth: number,
  maskHeight: number,
  spec: FieldCropSpec,
  rectifiedRgba?: Uint8ClampedArray
): { text: string; confidence: number } => {
  if (rectifiedRgba && rectifiedRgba.length >= maskWidth * maskHeight * 4) {
    const extracted = extractFieldText(rectifiedRgba, maskWidth, maskHeight, spec);
    if (extracted.text) {
      return { text: extracted.text, confidence: extracted.confidence };
    }
  }

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

  // Filter out noise slivers (h < 7 or h > 95% of crop)
  const validBoxes = cclResult.boxes.filter((b) => b.h >= 7 && b.h <= crop.height * 0.95);
  if (validBoxes.length === 0) {
    return { text: '', confidence: 0 };
  }

  const lines = groupBoundingBoxesIntoLines(validBoxes);
  if (lines.length === 0) {
    return { text: '', confidence: 0 };
  }

  let allowedChars: string | undefined;
  if (spec.expectedCharType === 'NUMERIC') {
    allowedChars = '0123456789-.';
  } else if (spec.expectedCharType === 'DATE') {
    allowedChars = '0123456789/-DOZSIBLGQ';
  } else if (spec.expectedCharType === 'ALPHA') {
    allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ,.-';
  } else if (spec.expectedCharType === 'ALPHANUMERIC') {
    allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.-/';
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
  } else if (spec.expectedCharType === 'DATE') {
    const withM = rawJoined.replace(/M/g, '4').replace(/W/g, '4').replace(/A/g, '4');
    const repairedNumeric = repairNumericField(withM);
    const dateDigits = repairedNumeric.replace(/\D/g, '');
    if (dateDigits.length === 8) {
      let yyyy = dateDigits.slice(0, 4);
      let mm = dateDigits.slice(4, 6);
      const dd = dateDigits.slice(6, 8);
      if (mm.startsWith('9')) mm = '0' + mm[1];
      if (yyyy.startsWith('29')) yyyy = '20' + yyyy.slice(2);
      repaired = `${yyyy}/${mm}/${dd}`;
    }
  }

  return {
    text: repaired,
    confidence: avgConf
  };
};

/**
 * Executes the complete deterministic CV pipeline on an uploaded Front or Back ID image:
 * Quality Gates -> Canny/Contour Quad (or Pre-Cropped Full-Frame Card Fallback) ->
 * Homography Rectification -> Sauvola -> CCL & Multi-Line Glyph OCR -> Spatial FSM -> Verification.
 */
export const executeFullCardScan = (
  imageData: ImageData,
  targetCategory?: GovernmentIdCategory,
  userRole?: 'Responder' | 'Civilian',
  targetRatios: readonly number[] = [1.5858, 1.4205],
  preLockedCorners?: Point2D[] | null,
  side: 'front' | 'back' = 'front',
  isStaticUpload: boolean = true
): WorkerIdScanResult => {
  const startTime = performance.now();
  const width = imageData.width;
  const height = imageData.height;

  // 1. Quality Gates Assessment
  const quality = evaluateQualityGate(imageData.data, width, height);

  // 2. Edge Detection and Quadrilateral Boundary Finding
  const gray = rgbaToGrayscale(imageData.data, width, height);
  const edges = autoCanny(gray, width, height);
  let quadResult = findCardQuad(edges, width, height, [...targetRatios], gray);
  const hasPreLockedCorners = Boolean(preLockedCorners && preLockedCorners.length === 4);

  if ((!quadResult || quadResult.corners.length !== 4) && hasPreLockedCorners && preLockedCorners) {
    quadResult = {
      corners: preLockedCorners,
      aspect: targetRatios[0] ?? 1.5858,
      score: 0.88
    };
  }

  // Anti-Selfie Face Rejection & Card Presence Check
  let cardPresence = evaluateCardPresenceGate(
    imageData.data,
    gray,
    edges,
    width,
    height,
    quadResult?.corners || null,
    hasPreLockedCorners
  );

  // Pre-Cropped / Full-Frame Uploaded ID Fallback:
  // When a user uploads an ID photo that is already cropped to the card edges,
  // findCardQuad may return null or low border step contrast because the card fills 95-100% of the frame.
  // As long as Pillar 1 (Anti-Selfie Face Rejection) did NOT detect a human selfie,
  // check if the uploaded image has valid interior document features and plausible aspect ratio.
  if (
    isStaticUpload &&
    cardPresence.status !== 'FACE_DETECTED' &&
    (!cardPresence.passed || !quadResult || quadResult.corners.length !== 4)
  ) {
    const fullFrameCorners: Point2D[] = [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: width - 1, y: height - 1 },
      { x: 0, y: height - 1 }
    ];
    const frameAspect = Math.max(width, height) / Math.max(1, Math.min(width, height));

    // Measure interior edge stroke density and compute projection profiles to isolate card from desk/tabletop
    let interiorEdgeCount = 0;
    let interiorPixelCount = 0;
    const colEdges = new Int32Array(width);
    const rowEdges = new Int32Array(height);

    for (let y = 0; y < height; y += 2) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x += 2) {
        interiorPixelCount++;
        if (edges[rowOffset + x] > 0) {
          interiorEdgeCount++;
          colEdges[x]++;
          rowEdges[y]++;
        }
      }
    }
    const interiorStrokeRatio = interiorEdgeCount / Math.max(1, interiorPixelCount);

    // Determine active card bounding box to segment card from dark background/tabletop clutter
    let maxColEdge = 0;
    for (let x = 0; x < width; x++) if (colEdges[x] > maxColEdge) maxColEdge = colEdges[x];
    let maxRowEdge = 0;
    for (let y = 0; y < height; y++) if (rowEdges[y] > maxRowEdge) maxRowEdge = rowEdges[y];

    const colThresh = Math.max(2, Math.floor(maxColEdge * 0.08));
    const rowThresh = Math.max(2, Math.floor(maxRowEdge * 0.08));

    let cropXMin = 0;
    while (cropXMin < width * 0.35 && colEdges[cropXMin] < colThresh) cropXMin++;
    let cropXMax = width - 1;
    while (cropXMax > width * 0.65 && colEdges[cropXMax] < colThresh) cropXMax--;

    let cropYMin = 0;
    while (cropYMin < height * 0.35 && rowEdges[cropYMin] < rowThresh) cropYMin++;
    let cropYMax = height - 1;
    while (cropYMax > height * 0.65 && rowEdges[cropYMax] < rowThresh) cropYMax--;

    const cropW = Math.max(10, cropXMax - cropXMin);
    const cropH = Math.max(10, cropYMax - cropYMin);
    const cropAspect = Math.max(cropW, cropH) / Math.min(cropW, cropH);

    const activeCorners: Point2D[] =
      cropAspect >= 1.25 && cropAspect <= 1.95 && (cropW < width * 0.95 || cropH < height * 0.95)
        ? [
            { x: cropXMin, y: cropYMin },
            { x: cropXMax, y: cropYMin },
            { x: cropXMax, y: cropYMax },
            { x: cropXMin, y: cropYMax }
          ]
        : fullFrameCorners;

    const resolvedAspect = activeCorners === fullFrameCorners ? frameAspect : cropAspect;

    if (resolvedAspect >= 1.05 && resolvedAspect <= 2.45 && interiorStrokeRatio >= 0.005) {
      quadResult = {
        corners: activeCorners,
        aspect: resolvedAspect,
        score: activeCorners === fullFrameCorners ? 0.86 : 0.92
      };
      cardPresence = {
        ...cardPresence,
        passed: true,
        status: 'LOCKED',
        hasCardStructure: true,
        textStrokeDensity: Math.round(interiorStrokeRatio * 1000) / 1000,
        reason: undefined
      };
    }
  }

  if (!cardPresence.passed || !quadResult || quadResult.corners.length !== 4) {
    const errReason = cardPresence.status === 'FACE_DETECTED'
      ? 'NO ID CARD DETECTED // FACE IN VIEWFINDER'
      : cardPresence.reason || 'No valid government ID card boundary detected in uploaded image.';

    return {
      success: false,
      side,
      idCategory: targetCategory || 'philsys',
      confidence: 0,
      confidenceTier: 'MANUAL_ENTRY',
      fields: {},
      quality: {
        ...quality,
        passed: false,
        reasons: [...quality.reasons, errReason]
      },
      corners: [],
      executionTimeMs: Math.round(performance.now() - startTime),
      method: 'DETERMINISTIC_CV',
      rawText: '',
      requiresAiFallback: true,
      error: errReason,
      cardPresence
    };
  }

  const orderedCorners = orderCorners(quadResult.corners);
  const quadScore = quadResult.score;

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
  const deskewResult = deskewProjectionProfile(sauvola, targetW, targetH);
  const cleanBinary = deskewResult.bestAngle !== 0 ? deskewResult.deskewed : sauvola;

  // 5. Template & Layout Classification
  const headerCrop = extractSubRegion(cleanBinary, targetW, targetH, 0, 0, targetW, targetH * 0.26);
  const headerCcl = findConnectedComponents(headerCrop.data, headerCrop.width, headerCrop.height);
  const headerLines = groupBoundingBoxesIntoLines(headerCcl.boxes);
  const headerTexts = headerLines.map(
    (l) => recognizeLineText(headerCrop.data, headerCrop.width, l.charBoxes).text
  );

  let detectedCategory: GovernmentIdCategory = targetCategory || 'unknown';
  let classificationScore = targetCategory ? 0.35 : 0.0;

  const joinedHeaderText = headerTexts.join(' ');
  const headerIdentified = identifyIdCategoryFromHeader(joinedHeaderText);
  if (headerIdentified) {
    detectedCategory = headerIdentified.type;
    classificationScore = Math.max(classificationScore, headerIdentified.confidence);
  } else {
    const dictionaryMatched = matchIdCategoryFromDictionaries(joinedHeaderText, 0.32);
    if (dictionaryMatched) {
      detectedCategory = dictionaryMatched.type;
      classificationScore = Math.max(classificationScore, dictionaryMatched.confidence);
    } else if (!targetCategory) {
      const mrzCrop = extractSubRegion(cleanBinary, targetW, targetH, 0, targetH * 0.72, targetW, targetH * 0.28);
      const mrzCcl = findConnectedComponents(mrzCrop.data, mrzCrop.width, mrzCrop.height);
      if (mrzCcl.boxes.length >= 30) {
        detectedCategory = 'passport';
        classificationScore = 0.90;
      }
    }
  }

  // 6. Field Extraction via Layout Map, Multi-Line Full-Card OCR & CCL Glyph OCR
  const spec: GovernmentIdSpec = getIdSpec(detectedCategory);
  const extractedMap: Record<string, string> = {};
  const fieldScores: number[] = [];
  const rawTextParts: string[] = [];

  // When side === 'back', ONLY scan reverse-side specifications (serial, barcode).
  // Front personal identity fields (name, DOB, address, measurements) reside exclusively on the Front ID.
  const activeFieldSpecs: readonly FieldCropSpec[] =
    side === 'back'
      ? (spec.reverseFields || [])
      : spec.fields;

  for (const fieldSpec of activeFieldSpecs) {
    if (NON_TEXT_ROI_KEYS.has(fieldSpec.fieldKey)) {
      continue;
    }

    const ocrRes = ocrFieldRegion(cleanBinary, targetW, targetH, fieldSpec, rectified.data);
    if (ocrRes.text && !extractedMap[fieldSpec.fieldKey]) {
      extractedMap[fieldSpec.fieldKey] = ocrRes.text;
      fieldScores.push(ocrRes.confidence);
      rawTextParts.push(`${fieldSpec.label}: ${ocrRes.text}`);
    }
  }

  // Multi-Line Full-Body OCR scan for Spatial FSM enrichment (handles both Front and Back uploaded IDs)
  const fullBodyRoi =
    side === 'front'
      ? {
          x: Math.round(targetW * 0.25),
          y: Math.round(targetH * 0.12),
          width: Math.round(targetW * 0.72),
          height: Math.round(targetH * 0.82)
        }
      : {
          x: Math.round(targetW * 0.05),
          y: Math.round(targetH * 0.08),
          width: Math.round(targetW * 0.90),
          height: Math.round(targetH * 0.84)
        };

  const fullBodyOcr = extractTextFromRoi(rectified.data, targetW, targetH, fullBodyRoi, {
    layoutMode: 'multi-line'
  });
  if (fullBodyOcr.rawText) {
    rawTextParts.push(fullBodyOcr.rawText);
    if (fullBodyOcr.confidence > 0) {
      fieldScores.push(fullBodyOcr.confidence);
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
    const mrzCropRes = ocrFieldRegion(cleanBinary, targetW, targetH, mrzRoiSpec, rectified.data);
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

  // 7. Post-Processing & Normalization (with Spatial/Label FSM Enrichment & PascalCase Indications)
  const fullBodyInput = fullBodyOcr.lines.length > 0
    ? fullBodyOcr.lines
    : (fullBodyOcr.rawText || rawTextParts.join('\n'));

  const combinedInput = `${fullBodyOcr.rawText || ''}\n${rawTextParts.join('\n')}`;
  const pascalParsed = parseFieldsByPascalCaseIndications(combinedInput);
  const fsmParsed = parseIdFieldsWithSpatialFsm(fullBodyInput);

  // Strip noisy crops from extractedMap that match PascalCase label headers
  for (const k of Object.keys(extractedMap)) {
    const val = extractedMap[k];
    if (isPascalCaseLabel(val)) {
      delete extractedMap[k];
    }
  }

  // Prioritize high-fidelity PascalCase indication & Spatial FSM parses over noisy individual crops
  if (pascalParsed.fullName || fsmParsed.fullName) {
    extractedMap['fullName'] = pascalParsed.fullName || fsmParsed.fullName || '';
  }
  if (pascalParsed.idNumber || fsmParsed.idNumber) {
    extractedMap['idNumber'] = pascalParsed.idNumber || fsmParsed.idNumber || '';
  }
  if (pascalParsed.birthDate || fsmParsed.birthDate) {
    extractedMap['dateOfBirth'] = pascalParsed.birthDate || fsmParsed.birthDate || '';
  }
  if (pascalParsed.sex || fsmParsed.sex) {
    extractedMap['sex'] = pascalParsed.sex || fsmParsed.sex || '';
  }
  if (pascalParsed.address || fsmParsed.address) {
    extractedMap['address'] = pascalParsed.address || fsmParsed.address || '';
  }
  if (pascalParsed.weight || fsmParsed.weight) {
    extractedMap['weight'] = pascalParsed.weight || fsmParsed.weight || '';
  }
  if (pascalParsed.height || fsmParsed.height) {
    extractedMap['height'] = pascalParsed.height || fsmParsed.height || '';
  }
  if (pascalParsed.nationality || fsmParsed.nationality) {
    extractedMap['nationality'] = pascalParsed.nationality || fsmParsed.nationality || '';
  }
  if (pascalParsed.expirationDate) {
    extractedMap['expirationDate'] = pascalParsed.expirationDate;
  }
  if (pascalParsed.agencyCode) {
    extractedMap['agencyCode'] = pascalParsed.agencyCode;
  }
  if (pascalParsed.bloodType) {
    extractedMap['bloodType'] = pascalParsed.bloodType;
  }
  if (pascalParsed.eyesColor) {
    extractedMap['eyesColor'] = pascalParsed.eyesColor;
  }
  if (pascalParsed.dlCodes) {
    extractedMap['dlCodes'] = pascalParsed.dlCodes;
  }
  if (pascalParsed.conditions) {
    extractedMap['conditions'] = pascalParsed.conditions;
  }

  // Prioritize high-fidelity PascalCase indication parser (trained on Front ID layout) over noisy raw crops
  let prioritizedFullname = pascalParsed.fullName || '';
  if (!prioritizedFullname) {
    if (pascalParsed.lastName && pascalParsed.firstName) {
      prioritizedFullname = `${pascalParsed.lastName}, ${pascalParsed.firstName} ${pascalParsed.middleName || ''}`.trim();
    } else if (fsmParsed.fullName && isPlausibleHumanName(fsmParsed.fullName) && !isPascalCaseLabel(fsmParsed.fullName)) {
      prioritizedFullname = fsmParsed.fullName;
    }
  }

  const nameParts = parseNameComponents(prioritizedFullname);

  // Determine individual names: strict plausibility filter prevents noisy consonant artifacts
  const resolvedLastName =
    pascalParsed.lastName ||
    (nameParts.lastName && isPlausibleHumanName(nameParts.lastName) && !isPascalCaseLabel(nameParts.lastName)
      ? nameParts.lastName
      : undefined) ||
    (fsmParsed.lastName && isPlausibleHumanName(fsmParsed.lastName) ? fsmParsed.lastName : undefined);

  const resolvedFirstName =
    pascalParsed.firstName ||
    (nameParts.firstName && isPlausibleHumanName(nameParts.firstName) && !isPascalCaseLabel(nameParts.firstName)
      ? nameParts.firstName
      : undefined) ||
    (fsmParsed.firstName && isPlausibleHumanName(fsmParsed.firstName) ? fsmParsed.firstName : undefined);

  const resolvedMiddleName =
    pascalParsed.middleName ||
    (nameParts.middleName && isPlausibleHumanName(nameParts.middleName) && !isPascalCaseLabel(nameParts.middleName)
      ? nameParts.middleName
      : undefined) ||
    (fsmParsed.middleName && isPlausibleHumanName(fsmParsed.middleName) ? fsmParsed.middleName : undefined) ||
    (isPlausibleHumanName(extractedMap['middleName'] || '') && !isPascalCaseLabel(extractedMap['middleName'] || '')
      ? extractedMap['middleName']
      : undefined);

  let idNumber =
    pascalParsed.idNumber ||
    fsmParsed.idNumber ||
    (extractedMap['idNumber'] && /^[A-Z0-9-]{8,20}$/.test(extractedMap['idNumber']) ? extractedMap['idNumber'] : '') ||
    (extractedMap['licenseNumber'] && /^[A-Z0-9-]{8,20}$/.test(extractedMap['licenseNumber']) ? extractedMap['licenseNumber'] : '') ||
    extractedMap['prcNumber'] ||
    extractedMap['registrationNumber'] ||
    extractedMap['pcn'] ||
    extractedMap['crn'] ||
    extractedMap['prn'] ||
    extractedMap['badgeNumber'] ||
    extractedMap['passportNumber'] ||
    '';
  let employeeId = extractedMap['employeeId'] || '';

  // Validate dateOfBirth: must be plausible date format, reject barcode / watermark number streams
  let rawDob = pascalParsed.birthDate || fsmParsed.birthDate || extractedMap['dateOfBirth'] || extractedMap['dob'] || '';
  let dateOfBirth = '';
  if (rawDob) {
    const dobMatch = rawDob.match(/\b((?:19|20)\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
    if (dobMatch) {
      dateOfBirth = `${dobMatch[1]}/${dobMatch[2]}/${dobMatch[3]}`;
    }
  }

  const expirationDate = pascalParsed.expirationDate || extractedMap['expirationDate'] || extractedMap['expiry'] || '';
  const sex = pascalParsed.sex || fsmParsed.sex || extractedMap['sex'] || '';
  const rawAddress = pascalParsed.address || fsmParsed.address || extractedMap['address'] || '';
  const address = rawAddress ? normalizePhilippineAddress(rawAddress) : '';
  const rankOrTitle = extractedMap['rank'] || extractedMap['title'] || '';

  let validationPass = false;
  if (idNumber) {
    const valResult = validateIdNumber(detectedCategory, idNumber);
    validationPass = valResult.isValid;
    if (valResult.isValid) {
      idNumber = valResult.normalized;
    }
  }

  if (userRole === 'Responder' && !employeeId && idNumber) {
    employeeId = idNumber;
  }

  // 8. Composite Confidence Evaluation
  const meanFieldScore =
    fieldScores.length > 0
      ? fieldScores.reduce((acc, curr) => acc + curr, 0) / fieldScores.length
      : 0.55;

  const rawConfidence = computeIdScanConfidence({
    quadScore,
    qualityScore: quality.score,
    classificationScore,
    meanFieldScore,
    validationPass
  });

  // Dynamic exact age calculation: accounts for birth year, month, and day against today (YYYY/MM/DD)
  let calculatedAge: string | undefined;
  if (dateOfBirth) {
    const cleanDob = dateOfBirth.trim();
    const m = cleanDob.match(/^(\d{4})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])$/);
    if (m) {
      const birthYear = parseInt(m[1], 10);
      const birthMonth = parseInt(m[2], 10) - 1;
      const birthDay = parseInt(m[3], 10);
      const today = new Date();
      let a = today.getFullYear() - birthYear;
      if (
        today.getMonth() < birthMonth ||
        (today.getMonth() === birthMonth && today.getDate() < birthDay)
      ) {
        a--;
      }
      if (a >= 10 && a <= 120) {
        calculatedAge = String(a);
      }
    } else {
      const parts = cleanDob.split(/[-/.]/);
      if (parts.length === 3) {
        const yr = parts[0].length === 4 ? parseInt(parts[0], 10) : parseInt(parts[2], 10);
        const currentYear = new Date().getFullYear();
        if (yr > 1900 && yr < currentYear) {
          const a = currentYear - yr;
          if (a >= 10 && a <= 120) calculatedAge = String(a);
        }
      }
    }
  }

  const cleanAddress = address ? normalizePhilippineAddress(address) : undefined;
  const cleanWeight = (pascalParsed.weight || extractedMap['weight'])
    ? normalizePhysicalMeasurement(pascalParsed.weight || extractedMap['weight'], 'weight')
    : undefined;
  const cleanHeight = (pascalParsed.height || extractedMap['height'])
    ? normalizePhysicalMeasurement(pascalParsed.height || extractedMap['height'], 'height')
    : undefined;

  // Front vs Back Gating: On Philippine Driver's License and Government IDs,
  // ALL authenticated personal details reside on the Front ID.
  // The Back ID must NEVER return personal details that might overwrite Front data.
  const finalFields: ExtractedFieldsPayload = side === 'back'
    ? {
        idNumber: idNumber || undefined,
        licenseNumber: (detectedCategory === 'drivers' ? idNumber : undefined) || extractedMap['licenseNumber'] || undefined,
        employeeId: employeeId || undefined,
        expirationDate: expirationDate || undefined,
        cardSerialNumber: extractedMap['cardSerialNumber'] || extractedMap['serialNumber'] || undefined,
        dlCodes: extractedMap['dlCodes'] || undefined,
        conditions: extractedMap['conditions'] || undefined
      }
    : {
        fullname: prioritizedFullname || undefined,
        firstName: resolvedFirstName || undefined,
        middleName: resolvedMiddleName || undefined,
        lastName: resolvedLastName || undefined,
        idNumber: idNumber || undefined,
        licenseNumber: (detectedCategory === 'drivers' ? idNumber : undefined) || extractedMap['licenseNumber'] || undefined,
        employeeId: employeeId || undefined,
        dateOfBirth: dateOfBirth || undefined,
        age: calculatedAge,
        expirationDate: expirationDate || undefined,
        sex: sex || undefined,
        address: cleanAddress || undefined,
        weight: cleanWeight || undefined,
        height: cleanHeight || undefined,
        rankOrTitle: rankOrTitle || undefined,
        nationality: extractedMap['nationality'] || undefined,
        agencyCode: extractedMap['agencyCode'] || undefined,
        bloodType: extractedMap['bloodType'] || undefined,
        eyesColor: extractedMap['eyesColor'] || undefined,
        dlCodes: extractedMap['dlCodes'] || undefined,
        conditions: extractedMap['conditions'] || undefined
      };

  const hasCoreFields = Boolean(
    finalFields.fullname ||
    finalFields.firstName ||
    finalFields.lastName ||
    finalFields.idNumber ||
    finalFields.licenseNumber ||
    finalFields.employeeId
  );

  const hasAnyBackFields = Boolean(
    hasCoreFields ||
    finalFields.address ||
    finalFields.weight ||
    finalFields.height ||
    finalFields.dateOfBirth ||
    rawTextParts.join('').trim().length > 0 ||
    quadScore >= 0.45
  );

  const scanSuccess =
    side === 'back'
      ? Boolean(cardPresence.status !== 'FACE_DETECTED' && hasAnyBackFields)
      : Boolean(hasCoreFields && rawConfidence >= 0.40);

  const confidence = scanSuccess
    ? Number(Math.max(0.0, Math.min(1.0, rawConfidence)).toFixed(4))
    : Math.min(rawConfidence, 0.40);

  const confidenceTier: IdScanConfidenceTier = getIdScanConfidenceTier(confidence);
  const executionTimeMs = Math.round(performance.now() - startTime);
  const requiresAiFallback = confidence < 0.80;

  // 9. Extract Portrait Crop from Front ID for Step 2 Live Facial Biometric Matching
  let portraitImageData: ImageData | undefined;
  if (side === 'front') {
    const photoFieldSpec = spec.fields.find((f) => f.fieldKey === 'photo' || f.fieldKey === 'portrait');
    const photoRoi = photoFieldSpec?.relativeRoi || { x: 0.04, y: 0.18, w: 0.24, h: 0.56 };
    portraitImageData = extractRgbaSubImageData(
      rectified.data,
      targetW,
      targetH,
      photoRoi.x,
      photoRoi.y,
      photoRoi.w,
      photoRoi.h
    );
  }

  return {
    success: scanSuccess,
    side,
    idCategory: detectedCategory,
    confidence,
    confidenceTier: scanSuccess ? confidenceTier : 'MANUAL_ENTRY',
    fields: finalFields,
    quality,
    corners: srcPts,
    rectifiedImageData: rectified,
    portraitImageData,
    executionTimeMs,
    method: 'DETERMINISTIC_CV',
    rawText: rawTextParts.join('\n'),
    requiresAiFallback,
    cardPresence
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
    if (!request || request.type !== 'FULL_SCAN') {
      return;
    }

    try {
      const scanResult = executeFullCardScan(
        request.imageData,
        request.targetCategory,
        request.userRole,
        request.targetRatios,
        request.preLockedCorners,
        request.side || 'front',
        request.isStaticUpload ?? true
      );
      const response: WorkerFullScanResponse = {
        id: request.id,
        type: 'SCAN_COMPLETE',
        success: true,
        result: scanResult
      };
      self.postMessage(response);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const response: WorkerFullScanResponse = {
        id: request.id,
        type: 'SCAN_COMPLETE',
        success: false,
        error: errorMsg
      };
      self.postMessage(response);
    }
  };
}
