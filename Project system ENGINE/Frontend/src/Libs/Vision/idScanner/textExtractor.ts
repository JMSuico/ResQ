// [Layer: Libs/Vision/idScanner]
// Responsibility: Pure on-device deterministic Text Extractor engine modeling Windows.Media.Ocr / PowerToys Text Extractor pipeline.
// Architecture:
// 1. Image Capture & Region-of-Interest (ROI) Isolation (exact pixel buffer capture)
// 2. Image Preprocessing & Normalization (DPI scaling 2.5x-3.0x, local contrast normalization, adaptive Sauvola binarization)
// 3. Character Segmentation & Line/Table Detection (Horizontal & Vertical Projection Profiling + CCA)
// 4. Pattern Matching & Disambiguated Recognition (whitelisted glyph matching & context-aware confusions repair)
// Strict TypeScript, ZERO 'any', 100% universal lambdas (=>), zero emojis.

import { resizeBilinear, toGrayscale } from './imageOps';
import { rgbaToGrayscale, computeIntegralImages, sauvolaAdaptiveThreshold } from './binarize';
import { findConnectedComponents, BoundingBox } from './ccl';
import {
  normalizeGlyphTo16x16,
  computeZoningFeatures,
  matchGlyph,
  disambiguateGlyph,
  type CharBoxInput
} from './glyphMatcher';
import { FONT_BANK } from './fontBank';
import { parseDynamicIdAnchors } from './dynamicAnchorParser';
import {
  repairAlphaField,
  repairNumericField,
  normalizePhilippineAddress,
  normalizePhysicalMeasurement,
  parseMrzLine
} from './validators';
import type { FieldCropSpec, RelativeRoi } from './idSpecs';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type TextExtractorLayoutMode = 'single-line' | 'multi-line' | 'table';

export type TextExtractorCharType = 'ALPHA' | 'NUMERIC' | 'ALPHANUMERIC' | 'DATE' | 'MRZ';

export interface PixelBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextExtractorOptions {
  readonly layoutMode?: TextExtractorLayoutMode;
  readonly charType?: TextExtractorCharType;
  readonly minDpiScale?: number; // default: 2.5 for small card text
  readonly targetLineHeight?: number; // default: 32px
  readonly allowedChars?: string;
  readonly filterNoise?: boolean;
}

export interface ExtractedGlyph {
  readonly char: string;
  readonly confidence: number;
  readonly box: PixelBoundingBox;
}

export interface ExtractedWord {
  readonly text: string;
  readonly confidence: number;
  readonly box: PixelBoundingBox;
  readonly glyphs: readonly ExtractedGlyph[];
}

export interface ExtractedLine {
  readonly text: string;
  readonly confidence: number;
  readonly box: PixelBoundingBox;
  readonly words: readonly ExtractedWord[];
}

export interface TextExtractorResult {
  readonly text: string;
  readonly rawText: string;
  readonly confidence: number;
  readonly lines: readonly ExtractedLine[];
  readonly layoutMode: TextExtractorLayoutMode;
  readonly executionTimeMs: number;
  readonly preprocessedWidth: number;
  readonly preprocessedHeight: number;
}

// ============================================================================
// 1. Image Capture & Region-of-Interest (ROI) Isolation
// ============================================================================

/**
 * Isolates and extracts the exact RGBA pixel buffer of a designated ROI region.
 * Handles both normalized relative coordinates [0..1] and pixel coordinates with boundary clamping.
 */
export const extractRoiBuffer = (
  sourceRgba: Uint8ClampedArray,
  sourceW: number,
  sourceH: number,
  roi: RelativeRoi | PixelBoundingBox
): { buffer: Uint8ClampedArray; width: number; height: number } => {
  let rx = 0;
  let ry = 0;
  let rw = 0;
  let rh = 0;

  if ('w' in roi && 'h' in roi) {
    // Relative coordinates [0..1]
    rx = Math.max(0, Math.min(sourceW - 1, Math.floor(roi.x * sourceW)));
    ry = Math.max(0, Math.min(sourceH - 1, Math.floor(roi.y * sourceH)));
    rw = Math.max(1, Math.min(sourceW - rx, Math.ceil(roi.w * sourceW)));
    rh = Math.max(1, Math.min(sourceH - ry, Math.ceil(roi.h * sourceH)));
  } else {
    // Pixel coordinates
    rx = Math.max(0, Math.min(sourceW - 1, Math.floor(roi.x)));
    ry = Math.max(0, Math.min(sourceH - 1, Math.floor(roi.y)));
    rw = Math.max(1, Math.min(sourceW - rx, Math.ceil(roi.width)));
    rh = Math.max(1, Math.min(sourceH - ry, Math.ceil(roi.height)));
  }

  const cropped = new Uint8ClampedArray(rw * rh * 4);

  for (let y = 0; y < rh; y++) {
    const srcRowStart = ((ry + y) * sourceW + rx) * 4;
    const dstRowStart = (y * rw) * 4;
    const rowBytes = rw * 4;
    cropped.set(sourceRgba.subarray(srcRowStart, srcRowStart + rowBytes), dstRowStart);
  }

  return {
    buffer: cropped,
    width: rw,
    height: rh
  };
};

// ============================================================================
// 2. Image Preprocessing & Normalization
// ============================================================================

/**
 * Local dynamic contrast stretching. Expands the dynamic range between
 * dark character ink strokes and light card background.
 */
export const stretchContrast = (
  gray: Float32Array,
  width: number,
  height: number
): Float32Array => {
  const total = width * height;
  if (total === 0) return gray;

  let min = 255;
  let max = 0;

  for (let i = 0; i < total; i++) {
    const v = gray[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  if (range <= 18) {
    // Very flat low-contrast region
    return gray;
  }

  const normalized = new Float32Array(total);
  const scale = 255.0 / range;

  for (let i = 0; i < total; i++) {
    const v = (gray[i] - min) * scale;
    normalized[i] = Math.max(0, Math.min(255, v));
  }

  return normalized;
};

export interface PreprocessedRoi {
  readonly binary: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly scaleFactor: number;
}

/**
 * Executes Step 2 of Text Extractor:
 * - Computes DPI scale factor (upscales small card fonts to ~30-34px line height).
 * - Applies bilinear upscaling.
 * - Converts to Float32 grayscale.
 * - Stretches local dynamic contrast.
 * - Computes integral images and executes localized Sauvola adaptive thresholding.
 */
export const preprocessTextRoi = (
  roiRgba: Uint8ClampedArray,
  roiW: number,
  roiH: number,
  options?: TextExtractorOptions
): PreprocessedRoi => {
  if (roiW < 4 || roiH < 4) {
    return {
      binary: new Uint8Array(0),
      width: 0,
      height: 0,
      scaleFactor: 1.0
    };
  }

  // DPI scaling: target font x-height / line height around 32px
  let scale = options?.minDpiScale ?? 2.5;
  if (roiH >= 120) {
    scale = 1.0;
  } else if (roiH >= 60) {
    scale = 1.8;
  } else if (roiH >= 30) {
    scale = 2.5;
  } else {
    scale = 3.0;
  }

  const dstW = Math.max(8, Math.round(roiW * scale));
  const dstH = Math.max(8, Math.round(roiH * scale));

  // High-efficiency bilinear interpolation upscale
  const scaledRgba = scale !== 1.0
    ? resizeBilinear(roiRgba, roiW, roiH, dstW, dstH)
    : roiRgba;

  // Grayscale conversion
  const rawGray = rgbaToGrayscale(scaledRgba, dstW, dstH);

  // Local contrast stretching
  const contrastGray = stretchContrast(rawGray, dstW, dstH);

  // Sauvola adaptive thresholding (tuned for document glyph strokes)
  // Window size scaled proportionally to font stroke width (15..21)
  const windowSize = Math.max(11, Math.min(25, Math.round(15 * Math.min(scale, 2.0))));
  const binary = sauvolaAdaptiveThreshold(contrastGray, dstW, dstH, windowSize, 0.20);

  return {
    binary,
    width: dstW,
    height: dstH,
    scaleFactor: scale
  };
};

// ============================================================================
// 3. Character Segmentation and Line/Table Detection
// ============================================================================

export interface RawTextSegment {
  readonly charBoxes: CharBoxInput[];
  readonly lineBox: PixelBoundingBox;
}

/**
 * Horizontal Projection Profiling:
 * Sums foreground pixels across rows to segment distinct text lines
 * and filter out continuous table or border lines.
 */
export const findLineBandsByProjection = (
  binary: Uint8Array,
  width: number,
  height: number
): { top: number; bottom: number }[] => {
  const rowCounts = new Int32Array(height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (binary[rowOffset + x] > 0) {
        count++;
      }
    }
    rowCounts[y] = count;
  }

  // Threshold: at least 1.5% of row width or 2 pixels to be a text stroke
  const minDensity = Math.max(2, Math.floor(width * 0.015));
  // Filter out solid horizontal border/table lines (> 85% of row width)
  const maxDensity = Math.floor(width * 0.88);

  const bands: { top: number; bottom: number }[] = [];
  let inLine = false;
  let lineTop = 0;

  for (let y = 0; y < height; y++) {
    const cnt = rowCounts[y];
    const isTextRow = cnt >= minDensity && cnt <= maxDensity;

    if (isTextRow) {
      if (!inLine) {
        inLine = true;
        lineTop = y;
      }
    } else {
      if (inLine) {
        inLine = false;
        const lineH = y - lineTop;
        if (lineH >= 4) {
          bands.push({ top: lineTop, bottom: y - 1 });
        }
      }
    }
  }

  if (inLine && height - lineTop >= 4) {
    bands.push({ top: lineTop, bottom: height - 1 });
  }

  // Merge bands that are separated by small vertical gaps (< 3px) for accents (ñ) or dots (i, j)
  const merged: { top: number; bottom: number }[] = [];
  for (const b of bands) {
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (b.top - prev.bottom <= 3) {
        merged[merged.length - 1] = { top: prev.top, bottom: b.bottom };
        continue;
      }
    }
    merged.push(b);
  }

  return merged;
};

/**
 * Vertical Projection Profiling within a Line Band:
 * Segments individual character spans and identifies whitespace gaps between words.
 * Splits touching characters at local valley minima.
 */
export const segmentLineGlyphs = (
  binary: Uint8Array,
  width: number,
  height: number,
  lineTop: number,
  lineBottom: number
): { charBoxes: CharBoxInput[]; wordGaps: number[] } => {
  const lineH = lineBottom - lineTop + 1;
  const colCounts = new Int32Array(width);

  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = lineTop; y <= lineBottom; y++) {
      if (binary[y * width + x] > 0) {
        count++;
      }
    }
    colCounts[x] = count;
  }

  const rawSpans: { startX: number; endX: number }[] = [];
  let inSpan = false;
  let spanStart = 0;

  for (let x = 0; x < width; x++) {
    if (colCounts[x] > 0) {
      if (!inSpan) {
        inSpan = true;
        spanStart = x;
      }
    } else {
      if (inSpan) {
        inSpan = false;
        rawSpans.push({ startX: spanStart, endX: x - 1 });
      }
    }
  }

  if (inSpan) {
    rawSpans.push({ startX: spanStart, endX: width - 1 });
  }

  // Split touching characters if span width > 1.35 * lineH
  const splitSpans: { startX: number; endX: number }[] = [];

  for (const span of rawSpans) {
    const spanW = span.endX - span.startX + 1;
    if (spanW > lineH * 1.35) {
      // Find deepest valley near center
      let minVal = 999;
      let minX = -1;
      const mid = Math.floor((span.startX + span.endX) / 2);
      const searchStart = span.startX + Math.floor(spanW * 0.3);
      const searchEnd = span.endX - Math.floor(spanW * 0.3);

      for (let x = searchStart; x <= searchEnd; x++) {
        if (colCounts[x] < minVal) {
          minVal = colCounts[x];
          minX = x;
        }
      }

      if (minX > 0 && minVal <= Math.ceil(lineH * 0.4)) {
        splitSpans.push({ startX: span.startX, endX: minX });
        splitSpans.push({ startX: minX + 1, endX: span.endX });
        continue;
      }
    }
    splitSpans.push(span);
  }

  // Refine tight bounding boxes for each character
  const charBoxes: CharBoxInput[] = [];
  const wordGaps: number[] = [];
  const spaceGapThreshold = Math.max(7, Math.round(lineH * 0.62));

  for (let i = 0; i < splitSpans.length; i++) {
    const sp = splitSpans[i];
    if (i > 0) {
      const prev = splitSpans[i - 1];
      const gap = sp.startX - prev.endX;
      if (gap >= spaceGapThreshold) {
        wordGaps.push(charBoxes.length); // Index of character where new word begins
      }
    }

    // Find tight top and bottom in this column span
    let minY = lineBottom;
    let maxY = lineTop;
    let hasPixel = false;

    for (let x = sp.startX; x <= sp.endX; x++) {
      for (let y = lineTop; y <= lineBottom; y++) {
        if (binary[y * width + x] > 0) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixel = true;
        }
      }
    }

    if (hasPixel) {
      const boxW = sp.endX - sp.startX + 1;
      const boxH = maxY - minY + 1;
      // Filter out single-pixel noise flecks
      if (boxW >= 2 && boxH >= 4) {
        charBoxes.push({
          x: sp.startX,
          y: minY,
          w: boxW,
          h: boxH
        });
      }
    }
  }

  return { charBoxes, wordGaps };
};

// ============================================================================
// 4. Pattern Matching & Disambiguated Recognition
// ============================================================================

/**
 * Maps field type to strict character whitelist.
 */
export const getCharTypeAllowedChars = (charType?: TextExtractorCharType): string => {
  switch (charType) {
    case 'NUMERIC':
      return '0123456789-.';
    case 'DATE':
      return '0123456789/-DOZSIBLGQ';
    case 'ALPHA':
      return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ,.-';
    case 'MRZ':
      return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
    case 'ALPHANUMERIC':
    default:
      return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.-/';
  }
};

/**
 * Applies contextual disambiguation and optical repairs based on field type.
 */
export const postProcessFieldText = (
  rawText: string,
  charType?: TextExtractorCharType
): string => {
  if (!rawText) return '';

  switch (charType) {
    case 'NUMERIC': {
      return repairNumericField(rawText);
    }
    case 'ALPHA': {
      return repairAlphaField(rawText);
    }
    case 'DATE': {
      // Standardize date format YYYY/MM/DD
      const withM = rawText.replace(/M/g, '4').replace(/W/g, '4').replace(/A/g, '4');
      const repairedNum = repairNumericField(withM);
      const digits = repairedNum.replace(/\D/g, '');
      if (digits.length === 8) {
        let yyyy = digits.slice(0, 4);
        let mm = digits.slice(4, 6);
        const dd = digits.slice(6, 8);
        if (mm.startsWith('9')) mm = '0' + mm[1];
        if (yyyy.startsWith('29')) yyyy = '20' + yyyy.slice(2);
        return `${yyyy}/${mm}/${dd}`;
      }
      return repairedNum;
    }
    case 'MRZ': {
      return rawText.toUpperCase().replace(/[^A-Z0-9<]/g, '');
    }
    case 'ALPHANUMERIC':
    default: {
      return rawText.trim();
    }
  }
};

// ============================================================================
// Master Text Extractor Pipeline Implementation
// ============================================================================

/**
 * Executes the complete 4-step on-device Text Extractor pipeline:
 * 1. Capture ROI pixel buffer from raw source
 * 2. Preprocess & Normalize (DPI scaling, contrast stretching, Sauvola binarization)
 * 3. Line & Character Segmentation via Horizontal & Vertical Projection Profiling
 * 4. Pattern Matching & Disambiguated Recognition
 */
export const extractTextFromRoi = (
  sourceRgba: Uint8ClampedArray,
  sourceW: number,
  sourceH: number,
  roi: RelativeRoi | PixelBoundingBox,
  options?: TextExtractorOptions
): TextExtractorResult => {
  const startTime = performance.now();
  const layoutMode: TextExtractorLayoutMode = options?.layoutMode ?? 'single-line';
  const charType: TextExtractorCharType = options?.charType ?? 'ALPHANUMERIC';

  // Step 1: Capture & Isolate ROI buffer
  const roiCrop = extractRoiBuffer(sourceRgba, sourceW, sourceH, roi);
  if (roiCrop.width < 4 || roiCrop.height < 4) {
    return {
      text: '',
      rawText: '',
      confidence: 0,
      lines: [],
      layoutMode,
      executionTimeMs: Math.round(performance.now() - startTime),
      preprocessedWidth: 0,
      preprocessedHeight: 0
    };
  }

  // Step 2: Preprocess & Normalize (DPI scaling, contrast, Sauvola)
  const preprocessed = preprocessTextRoi(roiCrop.buffer, roiCrop.width, roiCrop.height, options);
  if (preprocessed.width < 4 || preprocessed.height < 4) {
    return {
      text: '',
      rawText: '',
      confidence: 0,
      lines: [],
      layoutMode,
      executionTimeMs: Math.round(performance.now() - startTime),
      preprocessedWidth: preprocessed.width,
      preprocessedHeight: preprocessed.height
    };
  }

  // Step 3: Segment Lines and Character Glyphs via Projection Profiling
  const lineBands = findLineBandsByProjection(
    preprocessed.binary,
    preprocessed.width,
    preprocessed.height
  );

  const allowedChars = options?.allowedChars ?? getCharTypeAllowedChars(charType);
  const isNumericOnly = charType === 'NUMERIC' || charType === 'DATE';

  const recognizedLines: ExtractedLine[] = [];
  const allWordTexts: string[] = [];
  let totalConfidenceSum = 0;
  let totalGlyphCount = 0;

  // Fallback: If projection profiling found 0 line bands (e.g. single short word), treat entire height as 1 band
  const activeBands = lineBands.length > 0
    ? lineBands
    : [{ top: 0, bottom: preprocessed.height - 1 }];

  for (const band of activeBands) {
    const { charBoxes, wordGaps } = segmentLineGlyphs(
      preprocessed.binary,
      preprocessed.width,
      preprocessed.height,
      band.top,
      band.bottom
    );

    if (charBoxes.length === 0) {
      continue;
    }

    const words: ExtractedWord[] = [];
    let currentWordGlyphs: ExtractedGlyph[] = [];
    let currentWordChars = '';
    let currentWordConfSum = 0;

    let lineMinX = preprocessed.width;
    let lineMaxX = 0;
    let lineMinY = preprocessed.height;
    let lineMaxY = 0;
    const bandLineH = Math.max(1, ...charBoxes.map((b) => b.h));
    const bandTopY = Math.min(...charBoxes.map((b) => b.y));
    const bandBotY = Math.max(...charBoxes.map((b) => b.y + b.h));
    const bandSpanH = Math.max(1, bandBotY - bandTopY);

    for (let i = 0; i < charBoxes.length; i++) {
      const box = charBoxes[i];
      if (wordGaps.includes(i) && currentWordGlyphs.length > 0) {
        // Complete previous word
        const wordBox: PixelBoundingBox = {
          x: currentWordGlyphs[0].box.x,
          y: Math.min(...currentWordGlyphs.map((g) => g.box.y)),
          width: currentWordGlyphs[currentWordGlyphs.length - 1].box.x + currentWordGlyphs[currentWordGlyphs.length - 1].box.width - currentWordGlyphs[0].box.x,
          height: Math.max(...currentWordGlyphs.map((g) => g.box.y + g.box.height)) - Math.min(...currentWordGlyphs.map((g) => g.box.y))
        };
        const avgWordConf = currentWordGlyphs.length > 0 ? currentWordConfSum / currentWordGlyphs.length : 0;
        words.push({
          text: currentWordChars,
          confidence: Number(avgWordConf.toFixed(4)),
          box: wordBox,
          glyphs: currentWordGlyphs
        });
        allWordTexts.push(currentWordChars);

        currentWordGlyphs = [];
        currentWordChars = '';
        currentWordConfSum = 0;
      }

      // Step 4: Recognize glyph using 16x16 normalization, font bank & disambiguation
      const glyph16 = normalizeGlyphTo16x16(preprocessed.binary, preprocessed.width, box);
      const aspect = box.w / Math.max(1, box.h);
      const matchRes = matchGlyph(glyph16, aspect, FONT_BANK, allowedChars);
      const relBoxY = ((box.y - bandTopY) / bandSpanH) * 16;
      const finalChar = disambiguateGlyph(glyph16, aspect, matchRes.char, box.h, relBoxY, bandLineH, isNumericOnly);

      const glyphBox: PixelBoundingBox = {
        x: Math.round(box.x / preprocessed.scaleFactor),
        y: Math.round(box.y / preprocessed.scaleFactor),
        width: Math.max(1, Math.round(box.w / preprocessed.scaleFactor)),
        height: Math.max(1, Math.round(box.h / preprocessed.scaleFactor))
      };

      currentWordGlyphs.push({
        char: finalChar,
        confidence: matchRes.confidence,
        box: glyphBox
      });

      currentWordChars += finalChar;
      currentWordConfSum += matchRes.confidence;
      totalConfidenceSum += matchRes.confidence;
      totalGlyphCount++;

      lineMinX = Math.min(lineMinX, glyphBox.x);
      lineMaxX = Math.max(lineMaxX, glyphBox.x + glyphBox.width);
      lineMinY = Math.min(lineMinY, glyphBox.y);
      lineMaxY = Math.max(lineMaxY, glyphBox.y + glyphBox.height);
    }

    if (currentWordGlyphs.length > 0) {
      const wordBox: PixelBoundingBox = {
        x: currentWordGlyphs[0].box.x,
        y: Math.min(...currentWordGlyphs.map((g) => g.box.y)),
        width: currentWordGlyphs[currentWordGlyphs.length - 1].box.x + currentWordGlyphs[currentWordGlyphs.length - 1].box.width - currentWordGlyphs[0].box.x,
        height: Math.max(...currentWordGlyphs.map((g) => g.box.y + g.box.height)) - Math.min(...currentWordGlyphs.map((g) => g.box.y))
      };
      const avgWordConf = currentWordGlyphs.length > 0 ? currentWordConfSum / currentWordGlyphs.length : 0;
      words.push({
        text: currentWordChars,
        confidence: Number(avgWordConf.toFixed(4)),
        box: wordBox,
        glyphs: currentWordGlyphs
      });
      allWordTexts.push(currentWordChars);
    }

    if (words.length > 0) {
      const lineText = words.map((w) => w.text).join(' ');
      const lineConf = words.reduce((acc, w) => acc + w.confidence, 0) / words.length;

      recognizedLines.push({
        text: lineText,
        confidence: Number(lineConf.toFixed(4)),
        box: {
          x: lineMinX,
          y: lineMinY,
          width: Math.max(1, lineMaxX - lineMinX),
          height: Math.max(1, lineMaxY - lineMinY)
        },
        words
      });
    }
  }

  // Format final output according to layout mode
  let finalRawText = '';
  if (layoutMode === 'single-line') {
    finalRawText = allWordTexts.join(' ').trim();
  } else if (layoutMode === 'table') {
    finalRawText = recognizedLines.map((l) => l.words.map((w) => w.text).join('\t')).join('\n');
  } else {
    // 'multi-line'
    finalRawText = recognizedLines.map((l) => l.text).join('\n');
  }

  const repairedText = postProcessFieldText(finalRawText, charType);
  const avgConfidence = totalGlyphCount > 0 ? totalConfidenceSum / totalGlyphCount : 0.0;

  return {
    text: repairedText,
    rawText: finalRawText,
    confidence: Number(avgConfidence.toFixed(4)),
    lines: recognizedLines,
    layoutMode,
    executionTimeMs: Math.round(performance.now() - startTime),
    preprocessedWidth: preprocessed.width,
    preprocessedHeight: preprocessed.height
  };
};

/**
 * Convenient helper to extract text from a government ID specification field crop.
 */
export const extractFieldText = (
  rectifiedRgba: Uint8ClampedArray,
  targetW: number,
  targetH: number,
  spec: FieldCropSpec
): { text: string; confidence: number; lines: readonly ExtractedLine[] } => {
  const result = extractTextFromRoi(
    rectifiedRgba,
    targetW,
    targetH,
    spec.relativeRoi,
    {
      charType: spec.expectedCharType,
      layoutMode: spec.fieldKey === 'address' ? 'multi-line' : 'single-line',
      minDpiScale: 2.5
    }
  );

  return {
    text: result.text,
    confidence: result.confidence,
    lines: result.lines
  };
};

// ============================================================================
// 5. Reference-Synthesized Enhancements (pdftext & textricator Principles)
// ============================================================================

const LIGATURE_UNFOLD_MAP: Readonly<Record<string, string>> = {
  '\uFB00': 'FF',
  '\uFB01': 'FI',
  '\uFB02': 'FL',
  '\uFB03': 'FFI',
  '\uFB04': 'FFL',
  '\uFB05': 'ST',
  '\uFB06': 'ST',
  '\u00DF': 'SS',
  '\u00C6': 'AE',
  '\u00E6': 'AE',
  '\u0152': 'OE',
  '\u0153': 'OE'
};

/**
 * Unfolds typographic ligatures, strips non-printable ASCII control characters
 * (< 0x20 excluding \n and \t), and optionally joins hyphenated line-wraps.
 * Synthesized from document text extraction best practices.
 */
export const sanitizeOcrTextAndLigatures = (
  raw: string,
  joinHyphenatedWraps = true
): string => {
  if (!raw) return '';

  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const unfolded = LIGATURE_UNFOLD_MAP[ch];
    if (unfolded !== undefined) {
      out += unfolded;
      continue;
    }
    const code = ch.charCodeAt(0);
    // Preserve newline (10), carriage return (13 -> normalized later), and tab (9)
    if (code < 0x20 && code !== 10 && code !== 13 && code !== 9) {
      continue;
    }
    if (code === 0x7F) {
      continue;
    }
    out += ch;
  }

  out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (joinHyphenatedWraps) {
    out = out.replace(/([A-Za-z])-\n\s*([A-Za-z])/g, '$1$2');
  }

  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
};

/**
 * Sorts positioned bounding boxes into strict reading order (top-to-bottom, left-to-right)
 * using Y-coordinate tolerance band clustering (`item.y - bandAnchorY <= tolerancePx`)
 * so slightly tilted or uneven glyphs on the same baseline do not scramble left-to-right order.
 */
export const sortBoxesByToleranceReadingOrder = <T extends { readonly x: number; readonly y: number }>(
  boxes: readonly T[],
  tolerancePx = 6
): T[] => {
  if (boxes.length <= 1) {
    return [...boxes];
  }
  const safeTolerance = Math.max(1, tolerancePx);
  const byY = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: T[][] = [];
  let currentBand: T[] = [byY[0]];
  let bandAnchorY = byY[0].y;

  for (let i = 1; i < byY.length; i++) {
    const item = byY[i];
    if (item.y - bandAnchorY <= safeTolerance) {
      currentBand.push(item);
    } else {
      rows.push(currentBand);
      currentBand = [item];
      bandAnchorY = item.y;
    }
  }
  rows.push(currentBand);

  const result: T[] = [];
  for (let r = 0; r < rows.length; r++) {
    const sortedRow = rows[r].sort((a, b) => a.x - b.x);
    for (let c = 0; c < sortedRow.length; c++) {
      result.push(sortedRow[c]);
    }
  }
  return result;
};

export type SpatialFsmState =
  | 'IDLE'
  | 'EXPECT_ID_NUMBER'
  | 'EXPECT_LAST_NAME'
  | 'EXPECT_FIRST_NAME'
  | 'EXPECT_MIDDLE_NAME'
  | 'EXPECT_FULL_NAME'
  | 'EXPECT_DOB'
  | 'EXPECT_SEX'
  | 'EXPECT_ADDRESS'
  | 'EXPECT_NATIONALITY'
  | 'EXPECT_WEIGHT'
  | 'EXPECT_HEIGHT';

export interface ParsedIdCardFields {
  readonly idNumber?: string;
  readonly lastName?: string;
  readonly firstName?: string;
  readonly middleName?: string;
  readonly fullName?: string;
  readonly birthDate?: string;
  readonly sex?: string;
  readonly address?: string;
  readonly nationality?: string;
  readonly weight?: string;
  readonly height?: string;
  readonly expirationDate?: string;
  readonly agencyCode?: string;
  readonly bloodType?: string;
  readonly eyesColor?: string;
  readonly dlCodes?: string;
  readonly conditions?: string;
}

/**
 * Detects whether a string is a PascalCase / Title Case field header or indicator
 * on Philippine Government cards (e.g. "Nationality", "Sex", "Date of Birth",
 * "Weight(kg)", "Height(m)", "Address", "License No.", "Last Name, First Name, Middle Name").
 * These headers indicate field categories and MUST NEVER be captured as user personal data.
 */
export const isPascalCaseLabel = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Known Philippine Government Card Headers
  if (/^(?:Full\s*Name|Last\s*Name|First\s*Name|Middle\s*Name|Surname|Given\s*Name|Apelyido|Pangalan)\b/i.test(trimmed)) return true;
  if (/^Nationality\b/i.test(trimmed)) return true;
  if (/^Sex\b/i.test(trimmed)) return true;
  if (/^Date\s*of\s*Birth\b/i.test(trimmed) || /^Birth\s*Date\b/i.test(trimmed)) return true;
  if (/^Weight(?:\s*\([a-z]+\))?/i.test(trimmed)) return true;
  if (/^Height(?:\s*\([a-z]+\))?/i.test(trimmed)) return true;
  if (/^Address\b/i.test(trimmed) || /^Tirahan\b/i.test(trimmed)) return true;
  if (/^(?:Driver'?s?\s*)?License\s*(?:No\.?|Number)\b/i.test(trimmed)) return true;
  if (/^Expiration\s*Date\b/i.test(trimmed)) return true;
  if (/^Agency\s*Code\b/i.test(trimmed)) return true;
  if (/^Blood\s*Type\b/i.test(trimmed)) return true;
  if (/^Eyes\s*Color\b/i.test(trimmed)) return true;
  if (/^Conditions\b/i.test(trimmed)) return true;
  if (/^DL\s*Codes\b/i.test(trimmed)) return true;

  // Pattern-based PascalCase / Title Case indicator
  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+|\s*\([a-z]+\))*(?:\s*[:,.-])?$/.test(trimmed);
};

/**
 * Indication-to-Target pairing parser trained on Philippine Government IDs.
 * Recognizes that field headers are written in PascalCase / Title Case,
 * and the corresponding user information is located DIRECTLY BELOW the header
 * and written in ALL CAPITAL LETTERS / standardized number formats.
 *
 * Adheres strictly to the 9 primary indications:
 * 1. Nationality -> written in PascalCase; below it is an Acronym (mostly PHL)
 * 2. Sex -> written in PascalCase; below it is a single-letter Acronym (M or F)
 * 3. Date of Birth -> written in Numbers/PascalCase; below it is Date Number YYYY/MM/DD
 * 4. Weight(kg) -> written in PascalCase; below it is 2 or 3 digits (e.g. 52)
 * 5. Height(m) -> written in PascalCase; below it is decimal or 2-3 digits (e.g. 1.71)
 * 6. Address -> written in PascalCase; below it starts with dash and comma (-, -, ),
 *    ALL CAPITAL LETTERS with commas, ending with 4 to 8 digits Postal/ZIP code
 * 7. License No. -> written in PascalCase; below it is mixed capitalize letters & numbers with dash
 * 8. Last Name, First Name, Middle Name -> written in PascalCase; below it is ALL CAPITAL LETTERS
 * 9. Expiration Date -> (optional) written in PascalCase; below it is Date Number YYYY/MM/DD
 */
export const parseFieldsByPascalCaseIndications = (
  input: string | readonly ExtractedLine[]
): ParsedIdCardFields => {
  const fullText = typeof input === 'string'
    ? input
    : input.map((l) => l.text).join('\n');
  const anchor = parseDynamicIdAnchors(fullText);
  return {
    idNumber: anchor.licenseNumber || anchor.idNumber,
    lastName: anchor.lastName,
    firstName: anchor.firstName,
    middleName: anchor.middleName,
    fullName: anchor.fullName,
    birthDate: anchor.dateOfBirth,
    sex: anchor.sex,
    address: anchor.address,
    nationality: anchor.nationality,
    weight: anchor.weight,
    height: anchor.height,
    expirationDate: anchor.expirationDate,
    agencyCode: anchor.agencyCode,
    bloodType: anchor.bloodType,
    eyesColor: anchor.eyesColor,
    conditions: anchor.conditions
  };
};

/**
 * Deterministic Finite State Machine (FSM) and regex-keyed spatial parser that scans
 * multi-line OCR text (or positioned lines) and extracts structured Philippine ID fields
 * via label-triggered state transitions and inline pattern matching.
 */
export const parseIdFieldsWithSpatialFsm = (
  input: string | readonly ExtractedLine[]
): ParsedIdCardFields => {
  const rawLines: string[] = typeof input === 'string'
    ? sanitizeOcrTextAndLigatures(input, false).split('\n').map((l) => l.trim()).filter(Boolean)
    : sortBoxesByToleranceReadingOrder(
        input.map((l) => ({ x: l.box.x, y: l.box.y, text: l.text })),
        8
      )
      .map((item) => sanitizeOcrTextAndLigatures(item.text, false))
      .filter(Boolean);

  const fields: {
    idNumber?: string;
    lastName?: string;
    firstName?: string;
    middleName?: string;
    fullName?: string;
    birthDate?: string;
    sex?: string;
    address?: string;
    nationality?: string;
    weight?: string;
    height?: string;
  } = {};

  let state: SpatialFsmState = 'IDLE';

  const isHeaderOrNoiseLabel = (text: string): boolean => {
    return /^(REPUBLIKA|REPUBLIC|DEPARTMENT|LAND TRANSPORTATION|PAMBANSANG|PHILIPPINE IDENTIFICATION|DRIVER'?S?\s*LICENSE|NON-PROFESSIONAL|PROFESSIONAL)$/i.test(
      text.trim()
    );
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].toUpperCase().trim();
    if (!line || isHeaderOrNoiseLabel(line)) {
      continue;
    }

    // 1. Check inline patterns that are unambiguous regardless of state
    // PhilSys PCN (XXXX-XXXX-XXXX-XXXX) or LTO License (LNN-NN-NNNNNN) or UMID CRN (NNNN-NNNNNNN-N)
    const ltoMatch = line.match(/\b([A-Z]\d{2}[-\s]\d{2}[-\s]\d{6})\b/);
    if (ltoMatch && !fields.idNumber) {
      fields.idNumber = ltoMatch[1].replace(/\s+/g, '-');
    }
    const pcnMatch = line.match(/\b(\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4})\b/);
    if (pcnMatch && !fields.idNumber) {
      fields.idNumber = pcnMatch[1].replace(/\s+/g, '-');
    }
    const crnMatch = line.match(/\b(\d{4}[-\s]\d{7}[-\s]\d)\b/);
    if (crnMatch && !fields.idNumber) {
      fields.idNumber = crnMatch[1].replace(/\s+/g, '-');
    }

    // Inline Date of Birth (YYYY/MM/DD or YYYY-MM-DD or DD/MM/YYYY)
    const dateMatch = line.match(/\b((?:19|20)\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01]))\b/);
    if (dateMatch && !fields.birthDate) {
      fields.birthDate = dateMatch[1].replace(/-/g, '/');
    }

    // 2. Check for label triggers (Inline "LABEL: VALUE" or transition to next line state)
    const labelValueMatch = (
      pattern: RegExp
    ): { matched: boolean; inlineValue: string } => {
      const m = line.match(pattern);
      if (!m) return { matched: false, inlineValue: '' };
      const remainder = line.slice(m.index! + m[0].length).replace(/^[:;.\-\s]+/, '').trim();
      return { matched: true, inlineValue: remainder };
    };

    const idLabel = labelValueMatch(/^(?:LICENSE\s*NO\.?|PCN|CRN|ID\s*NO\.?|CARD\s*NUMBER)/i);
    if (idLabel.matched) {
      if (idLabel.inlineValue) {
        fields.idNumber = idLabel.inlineValue;
        state = 'IDLE';
      } else {
        state = 'EXPECT_ID_NUMBER';
      }
      continue;
    }

    const lastLabel = labelValueMatch(/^(?:LAST\s*NAME|SURNAME|APELYIDO)(?:\s*\/\s*(?:APELYIDO|LAST\s*NAME|SURNAME))?/i);
    if (lastLabel.matched && !/FIRST\s*NAME/i.test(line)) {
      if (lastLabel.inlineValue) {
        fields.lastName = repairAlphaField(lastLabel.inlineValue);
        state = 'IDLE';
      } else {
        state = 'EXPECT_LAST_NAME';
      }
      continue;
    }

    const firstLabel = labelValueMatch(/^(?:GIVEN\s*NAMES?|FIRST\s*NAME|MGA\s*PANGALAN)(?:\s*\/\s*(?:MGA\s*PANGALAN|GIVEN\s*NAMES?|FIRST\s*NAME))?/i);
    if (firstLabel.matched) {
      if (firstLabel.inlineValue) {
        fields.firstName = repairAlphaField(firstLabel.inlineValue);
        state = 'IDLE';
      } else {
        state = 'EXPECT_FIRST_NAME';
      }
      continue;
    }

    const middleLabel = labelValueMatch(/^(?:MIDDLE\s*NAME|GITNANG\s*APELYIDO)(?:\s*\/\s*(?:GITNANG\s*APELYIDO|MIDDLE\s*NAME))?/i);
    if (middleLabel.matched) {
      if (middleLabel.inlineValue) {
        fields.middleName = repairAlphaField(middleLabel.inlineValue);
        state = 'IDLE';
      } else {
        state = 'EXPECT_MIDDLE_NAME';
      }
      continue;
    }

    const fullNameLabel = labelValueMatch(/^(?:LAST\s*NAME,\s*FIRST\s*NAME,\s*MIDDLE\s*NAME|FULL\s*NAME|NAME)/i);
    if (fullNameLabel.matched) {
      if (fullNameLabel.inlineValue) {
        fields.fullName = repairAlphaField(fullNameLabel.inlineValue);
        state = 'IDLE';
      } else {
        state = 'EXPECT_FULL_NAME';
      }
      continue;
    }

    const dobLabel = labelValueMatch(/^(?:DATE\s*OF\s*BIRTH|BIRTH\s*DATE|PETSA\s*NG\s*KAPANGANAKAN|DOB)(?:\s*\/\s*(?:DATE\s*OF\s*BIRTH|PETSA\s*NG\s*KAPANGANAKAN))?/i);
    if (dobLabel.matched) {
      if (dobLabel.inlineValue) {
        fields.birthDate = postProcessFieldText(dobLabel.inlineValue, 'DATE');
        state = 'IDLE';
      } else {
        state = 'EXPECT_DOB';
      }
      continue;
    }

    const sexLabel = labelValueMatch(/^(?:SEX|GENDER|KASARIAN)(?:\s*\/\s*(?:SEX|GENDER|KASARIAN))?/i);
    if (sexLabel.matched) {
      if (sexLabel.inlineValue && /^(M|F|MALE|FEMALE|LALAKI|BABAE)\b/i.test(sexLabel.inlineValue)) {
        const tok = sexLabel.inlineValue.split(/\s+/)[0];
        fields.sex = tok.startsWith('F') || tok === 'BABAE' ? 'FEMALE' : 'MALE';
        state = 'IDLE';
      } else {
        state = 'EXPECT_SEX';
      }
      continue;
    }

    const addrLabel = labelValueMatch(/^(?:ADDRESS|TIRAHAN|HOME\s*ADDRESS)(?:\s*\/\s*(?:ADDRESS|TIRAHAN))?/i);
    if (addrLabel.matched) {
      if (addrLabel.inlineValue) {
        fields.address = addrLabel.inlineValue;
        state = 'IDLE';
      } else {
        state = 'EXPECT_ADDRESS';
      }
      continue;
    }

    // 3. Consume line according to active FSM state
    switch (state) {
      case 'EXPECT_ID_NUMBER': {
        const cleaned = line.replace(/[^A-Z0-9\-\s]/gi, '').trim();
        const lto = cleaned.match(/\b([A-Z]\d{2}[-\s]?\d{2}[-\s]?\d{6})\b/i);
        const pcn = cleaned.match(/\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b/);
        const crn = cleaned.match(/\b(\d{4}[-\s]?\d{7}[-\s]?\d)\b/);
        const genericAlphaNum = cleaned.match(/\b([A-Z0-9]{6,20})\b/i);

        if (lto) {
          fields.idNumber = lto[1].replace(/\s+/g, '-');
        } else if (pcn) {
          fields.idNumber = pcn[1].replace(/\s+/g, '-');
        } else if (crn) {
          fields.idNumber = crn[1].replace(/\s+/g, '-');
        } else if (genericAlphaNum && /\d/.test(genericAlphaNum[1]) && /[A-Z]/i.test(genericAlphaNum[1])) {
          fields.idNumber = genericAlphaNum[1];
        }
        state = 'IDLE';
        break;
      }
      case 'EXPECT_LAST_NAME': {
        fields.lastName = repairAlphaField(line);
        state = 'IDLE';
        break;
      }
      case 'EXPECT_FIRST_NAME': {
        fields.firstName = repairAlphaField(line);
        state = 'IDLE';
        break;
      }
      case 'EXPECT_MIDDLE_NAME': {
        fields.middleName = repairAlphaField(line);
        state = 'IDLE';
        break;
      }
      case 'EXPECT_FULL_NAME': {
        fields.fullName = repairAlphaField(line);
        if (line.includes(',')) {
          const parts = line.split(',').map((s) => s.trim());
          fields.lastName = fields.lastName ?? parts[0];
          const rest = (parts[1] ?? '').split(/\s+/).filter(Boolean);
          if (rest.length > 1) {
            fields.middleName = fields.middleName ?? rest[rest.length - 1];
            fields.firstName = fields.firstName ?? rest.slice(0, -1).join(' ');
          } else if (rest.length === 1) {
            fields.firstName = fields.firstName ?? rest[0];
          }
        }
        state = 'IDLE';
        break;
      }
      case 'EXPECT_DOB': {
        fields.birthDate = postProcessFieldText(line, 'DATE');
        state = 'IDLE';
        break;
      }
      case 'EXPECT_SEX': {
        if (/^(M|F|MALE|FEMALE|LALAKI|BABAE)\b/i.test(line)) {
          fields.sex = line.startsWith('F') || line.startsWith('BABAE') ? 'FEMALE' : 'MALE';
        }
        state = 'IDLE';
        break;
      }
      case 'EXPECT_ADDRESS': {
        fields.address = fields.address ? `${fields.address}, ${line}` : line;
        const nextIdx = i + 1;
        if (
          nextIdx < rawLines.length &&
          !/^(?:LICENSE|EXPIRATION|AGENCY|BLOOD|EYES|CONDITIONS|RESTRICTIONS|SEX|DATE|DOB|WEIGHT|HEIGHT)/i.test(rawLines[nextIdx].toUpperCase().trim())
        ) {
          // Remain in EXPECT_ADDRESS to accumulate multi-line addresses
        } else {
          state = 'IDLE';
        }
        break;
      }
      default: {
        // If IDLE and line looks like "SURNAME, FIRSTNAME MIDDLENAME", capture as fullName
        if (!fields.fullName && /^[A-ZÑ\s-]+,\s*[A-ZÑ\s.-]+$/.test(line) && !/\d/.test(line)) {
          fields.fullName = line;
          const parts = line.split(',').map((s) => s.trim());
          fields.lastName = fields.lastName ?? parts[0];
          const rest = (parts[1] ?? '').split(/\s+/).filter(Boolean);
          if (rest.length > 1) {
            fields.middleName = fields.middleName ?? rest[rest.length - 1];
            fields.firstName = fields.firstName ?? rest.slice(0, -1).join(' ');
          } else if (rest.length === 1) {
            fields.firstName = fields.firstName ?? rest[0];
          }
        }
        break;
      }
    }
  }

  if (!fields.fullName && (fields.lastName || fields.firstName)) {
    fields.fullName = [
      fields.lastName ? `${fields.lastName},` : '',
      fields.firstName ?? '',
      fields.middleName ?? ''
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  const pascalParsed = parseFieldsByPascalCaseIndications(input);

  const combined: ParsedIdCardFields = {
    idNumber: fields.idNumber || pascalParsed.idNumber,
    lastName: fields.lastName || pascalParsed.lastName,
    firstName: fields.firstName || pascalParsed.firstName,
    middleName: fields.middleName || pascalParsed.middleName,
    fullName: fields.fullName || pascalParsed.fullName,
    birthDate: fields.birthDate || pascalParsed.birthDate,
    sex: fields.sex || pascalParsed.sex,
    address: pascalParsed.address || (fields.address ? normalizePhilippineAddress(fields.address) : undefined),
    nationality: fields.nationality || pascalParsed.nationality,
    weight: fields.weight || pascalParsed.weight,
    height: fields.height || pascalParsed.height,
    expirationDate: pascalParsed.expirationDate,
    agencyCode: pascalParsed.agencyCode,
    bloodType: pascalParsed.bloodType,
    eyesColor: pascalParsed.eyesColor,
    dlCodes: pascalParsed.dlCodes,
    conditions: pascalParsed.conditions
  };

  return combined;
};
