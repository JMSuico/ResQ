/**
 * ResQTrack Classical ID Scanner Glyph Matcher
 * Zero-ML optical character recognition via 16x16 area-preserving resampling,
 * 4x4 zoning density grid features, and Normalized Hamming + IoU + Aspect correlation.
 * 100% universal lambda syntax, zero 'any', high-performance typed arrays.
 */

import { FONT_BANK, type GlyphTemplate } from './fontBank';

export interface GlyphMatchAlternative {
  char: string;
  confidence: number;
}

export interface GlyphMatchResult {
  char: string;
  confidence: number;
  alternatives: GlyphMatchAlternative[];
}

export interface RecognizedLineResult {
  text: string;
  confidence: number;
  charConfidences: number[];
}

export interface CharBoxInput {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resamples an arbitrary bounding box from a binary source image into a normalized
 * 16x16 binary matrix (0 or 1) using continuous area-weighted box integration.
 *
 * @param binary Source binary image buffer (0 = background, >0 = foreground).
 * @param fullW Full width of the source image in pixels.
 * @param box Bounding box to extract.
 * @returns 256-element Uint8Array containing normalized 16x16 binary glyph values (0 or 1).
 */
export const normalizeGlyphTo16x16 = (
  binary: Uint8Array,
  fullW: number,
  box: { x: number; y: number; w: number; h: number }
): Uint8Array => {
  const result = new Uint8Array(256);
  const boxW = Math.max(1, box.w);
  const boxH = Math.max(1, box.h);
  const totalPixels = binary.length;
  const fullH = Math.floor(totalPixels / Math.max(1, fullW));

  const scaleX = boxW / 16;
  const scaleY = boxH / 16;
  const cellArea = scaleX * scaleY;

  for (let ty = 0; ty < 16; ty++) {
    const y0 = box.y + ty * scaleY;
    const y1 = box.y + (ty + 1) * scaleY;
    const syStart = Math.max(0, Math.floor(y0));
    const syEnd = Math.min(fullH, Math.ceil(y1));

    const tyOffset = ty * 16;

    for (let tx = 0; tx < 16; tx++) {
      const x0 = box.x + tx * scaleX;
      const x1 = box.x + (tx + 1) * scaleX;
      const sxStart = Math.max(0, Math.floor(x0));
      const sxEnd = Math.min(fullW, Math.ceil(x1));

      let foregroundMass = 0;

      for (let sy = syStart; sy < syEnd; sy++) {
        const overlapY = Math.max(0, Math.min(sy + 1, y1) - Math.max(sy, y0));
        if (overlapY <= 0) continue;

        const rowOffset = sy * fullW;

        for (let sx = sxStart; sx < sxEnd; sx++) {
          const overlapX = Math.max(0, Math.min(sx + 1, x1) - Math.max(sx, x0));
          if (overlapX <= 0) continue;

          const pixelIdx = rowOffset + sx;
          if (pixelIdx < totalPixels && binary[pixelIdx] > 0) {
            foregroundMass += overlapX * overlapY;
          }
        }
      }

      const density = cellArea > 0 ? foregroundMass / cellArea : 0;
      // Adaptive binarization threshold preserves delicate thin strokes during downsampling
      result[tyOffset + tx] = density >= 0.32 ? 1 : 0;
    }
  }

  return result;
};

/**
 * Computes a 4x4 spatial zoning density grid (16 cell densities) from a 16x16 glyph matrix.
 *
 * @param glyph16 256-element Uint8Array representing 16x16 binary matrix.
 * @returns 16-element Float32Array containing regional foreground densities in [0, 1].
 */
export const computeZoningFeatures = (glyph16: Uint8Array): Float32Array => {
  const zoning = new Float32Array(16);

  for (let by = 0; by < 4; by++) {
    const startY = by * 4;
    const byOffset = by * 4;

    for (let bx = 0; bx < 4; bx++) {
      const startX = bx * 4;
      let count = 0;

      for (let y = startY; y < startY + 4; y++) {
        const yOffset = y * 16;
        for (let x = startX; x < startX + 4; x++) {
          if (glyph16[yOffset + x] > 0) {
            count++;
          }
        }
      }

      zoning[byOffset + bx] = count / 16.0;
    }
  }

  return zoning;
};

/**
 * Computes similarity between a candidate 16x16 glyph and a pre-compiled glyph template
 * using bitwise Hamming distance, Intersection-over-Union, zoning correlation, and aspect penalty.
 */
const evaluateCandidateSimilarity = (
  glyph16: Uint8Array,
  queryZoning: Float32Array,
  aspect: number,
  tpl: GlyphTemplate
): number => {
  let hammingMismatch = 0;
  let intersection = 0;
  let union = 0;

  const tplBits = tpl.bits16x16;

  for (let i = 0; i < 256; i++) {
    const q = glyph16[i] > 0 ? 1 : 0;
    const t = tplBits[i] > 0 ? 1 : 0;

    if (q !== t) {
      hammingMismatch++;
    }
    if (q === 1 && t === 1) {
      intersection++;
    }
    if (q === 1 || t === 1) {
      union++;
    }
  }

  // Hamming similarity normalized to [0, 1]
  const hammingSim = 1.0 - hammingMismatch / 256.0;

  // Jaccard / IoU metric
  const iou = union > 0 ? intersection / union : 0;

  // Zoning density Mean Absolute Error (MAE)
  const tplZoning = tpl.zoning4x4;
  let zoningError = 0;
  for (let z = 0; z < 16; z++) {
    zoningError += Math.abs(queryZoning[z] - tplZoning[z]);
  }
  const meanZoningError = zoningError / 16.0;
  const zoningSim = Math.max(0, 1.0 - meanZoningError * 2.5);

  // Aspect ratio deviation penalty
  const targetAspect = Math.max(0.1, tpl.aspect);
  const aspectDeviation = Math.abs(aspect - targetAspect) / targetAspect;
  const aspectScore = 1.0 / (1.0 + 1.8 * aspectDeviation);

  // Calibrated weighted combination
  const compositeScore =
    0.35 * hammingSim +
    0.35 * iou +
    0.20 * zoningSim +
    0.10 * aspectScore;

  return Math.max(0, Math.min(1, compositeScore));
};

/**
 * Matches a 16x16 normalized glyph against font bank templates.
 *
 * @param glyph16 256-element Uint8Array representing 16x16 glyph.
 * @param aspect Observed aspect ratio (width / height) of the original bounding box.
 * @param fontBank Dictionary of font families mapped to GlyphTemplate lists (defaults to FONT_BANK).
 * @param allowedChars Optional whitelist string of allowable characters (e.g., "0123456789").
 * @returns Best matching character with confidence score and alternative candidates.
 */
export const matchGlyph = (
  glyph16: Uint8Array,
  aspect: number,
  fontBank: Record<string, GlyphTemplate[]> = FONT_BANK,
  allowedChars?: string
): GlyphMatchResult => {
  const queryZoning = computeZoningFeatures(glyph16);
  const bestScorePerChar = new Map<string, number>();

  const families = Object.values(fontBank);
  for (let f = 0; f < families.length; f++) {
    const templates = families[f];
    for (let t = 0; t < templates.length; t++) {
      const tpl = templates[t];
      if (allowedChars && !allowedChars.includes(tpl.char)) {
        continue;
      }

      const score = evaluateCandidateSimilarity(glyph16, queryZoning, aspect, tpl);
      const existing = bestScorePerChar.get(tpl.char);
      if (existing === undefined || score > existing) {
        bestScorePerChar.set(tpl.char, score);
      }
    }
  }

  const candidates: GlyphMatchAlternative[] = Array.from(bestScorePerChar.entries())
    .map(([char, confidence]): GlyphMatchAlternative => ({ char, confidence }))
    .sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return {
      char: '?',
      confidence: 0,
      alternatives: [],
    };
  }

  const topMatch = candidates[0];
  const alternatives = candidates.slice(1, 6);

  return {
    char: topMatch.char,
    confidence: Number(topMatch.confidence.toFixed(4)),
    alternatives: alternatives.map((alt) => ({
      char: alt.char,
      confidence: Number(alt.confidence.toFixed(4)),
    })),
  };
};

/**
 * Recognizes all characters in a text line, automatically inserting spaces when
 * character gaps exceed 0.6 * median character width.
 *
 * @param binary Source binary image buffer.
 * @param fullW Full image width.
 * @param lineBoxes Array of character bounding boxes in the line.
 * @param allowedChars Optional character whitelist.
 * @returns Recognized text string, overall confidence, and per-character confidence scores.
 */
export const recognizeLineText = (
  binary: Uint8Array,
  fullW: number,
  lineBoxes: { x: number; y: number; w: number; h: number }[],
  allowedChars?: string
): RecognizedLineResult => {
  if (lineBoxes.length === 0) {
    return {
      text: '',
      confidence: 0,
      charConfidences: [],
    };
  }

  // Ensure left-to-right reading order
  const sortedBoxes = [...lineBoxes].sort((a, b) => a.x - b.x);

  // Determine median character width to accurately detect whitespace gaps
  const widths = sortedBoxes.map((b) => b.w).sort((a, b) => a - b);
  const medianWidth = widths[Math.floor(widths.length / 2)];
  const whitespaceGapThreshold = Math.max(3, 0.6 * medianWidth);

  let reconstructedText = '';
  const charConfidences: number[] = [];

  for (let i = 0; i < sortedBoxes.length; i++) {
    const currentBox = sortedBoxes[i];

    // Detect word boundary gaps
    if (i > 0) {
      const prevBox = sortedBoxes[i - 1];
      const horizontalGap = currentBox.x - (prevBox.x + prevBox.w);
      if (horizontalGap > whitespaceGapThreshold) {
        reconstructedText += ' ';
      }
    }

    const glyph16 = normalizeGlyphTo16x16(binary, fullW, currentBox);
    const aspect = currentBox.w / Math.max(1, currentBox.h);
    const match = matchGlyph(glyph16, aspect, FONT_BANK, allowedChars);

    reconstructedText += match.char;
    charConfidences.push(match.confidence);
  }

  const sumConfidence = charConfidences.reduce((sum, c) => sum + c, 0);
  const meanConfidence =
    charConfidences.length > 0 ? Number((sumConfidence / charConfidences.length).toFixed(4)) : 0;

  return {
    text: reconstructedText,
    confidence: meanConfidence,
    charConfidences,
  };
};
