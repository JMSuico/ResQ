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

export const disambiguateGlyph = (
  glyph16: Uint8Array,
  aspect: number,
  candidateChar: string,
  boxH: number,
  boxY: number,
  lineH: number,
  isNumeric: boolean = false
): string => {
  // 1. Punctuation check based on vertical position within the line
  if (boxH < lineH * 0.65 && boxY > 8) {
    return aspect > 0.85 ? '.' : ',';
  }
  if (aspect > 2.0 && boxH < lineH * 0.40) {
    return '-';
  }

  // 2. Diagonal slash '/' detection for dates
  if (aspect >= 0.35 && aspect <= 0.70) {
    let topR = 0;
    let botL = 0;
    let topL = 0;
    let botR = 0;
    for (let y = 0; y <= 3; y++) {
      for (let x = 10; x <= 15; x++) if (glyph16[y * 16 + x] > 0) topR++;
      for (let x = 0; x <= 4; x++) if (glyph16[y * 16 + x] > 0) topL++;
    }
    for (let y = 12; y <= 15; y++) {
      for (let x = 0; x <= 4; x++) if (glyph16[y * 16 + x] > 0) botL++;
      for (let x = 11; x <= 15; x++) if (glyph16[y * 16 + x] > 0) botR++;
    }
    if (topR >= 3 && botL >= 3 && topL <= 2 && botR <= 2) {
      return '/';
    }
  }

  // 3. Narrow vertical letter: strictly I or J or 1
  if (aspect <= 0.48) {
    let topEmptyLeft = 0;
    for (let y = 0; y <= 4; y++) {
      for (let x = 0; x <= 3; x++) {
        if (glyph16[y * 16 + x] === 0) topEmptyLeft++;
      }
    }
    let botLeftHook = 0;
    for (let y = 13; y <= 15; y++) {
      for (let x = 0; x <= 2; x++) {
        if (glyph16[y * 16 + x] > 0) botLeftHook++;
      }
    }
    const isJ = topEmptyLeft >= 14 && botLeftHook >= 2;
    if (isJ) {
      return isNumeric ? '1' : 'J';
    }
    return isNumeric ? '1' : 'I';
  }

  // 4. S check: empty top-right (rows 4..6, cols 10..15) and empty bottom-left (rows 8..11, cols 0..4)
  // Strictly restricted to avoid misclassifying triangular letters (e.g. 'A') as 'S'
  if (
    candidateChar === 'S' ||
    candidateChar === 'G' ||
    candidateChar === '5' ||
    candidateChar === '6' ||
    candidateChar === '8' ||
    candidateChar === 'E'
  ) {
    let sTopRightEmpty = 0;
    for (let y = 4; y <= 6; y++) {
      for (let x = 10; x <= 15; x++) {
        if (glyph16[y * 16 + x] === 0) sTopRightEmpty++;
      }
    }
    let sBotLeftEmpty = 0;
    for (let y = 8; y <= 11; y++) {
      for (let x = 0; x <= 4; x++) {
        if (glyph16[y * 16 + x] === 0) sBotLeftEmpty++;
      }
    }
    if (sTopRightEmpty >= 10 && sBotLeftEmpty >= 10) {
      return isNumeric ? '5' : 'S';
    }
  }

  // 5. U check: open top-center (rows 0..8, cols 5..10) and solid bottom curve (rows 13..15, cols 4..11)
  let uTopCenter = 0;
  for (let y = 0; y <= 7; y++) {
    for (let x = 5; x <= 10; x++) {
      if (glyph16[y * 16 + x] > 0) uTopCenter++;
    }
  }
  let uBotCurve = 0;
  for (let y = 13; y <= 15; y++) {
    for (let x = 4; x <= 11; x++) {
      if (glyph16[y * 16 + x] > 0) uBotCurve++;
    }
  }
  if (!isNumeric && uTopCenter <= 3 && uBotCurve >= 8) {
    return 'U';
  }

  // 6. C check: open right side (rows 6..9, cols 11..15 empty)
  let cRightEmpty = 0;
  for (let y = 6; y <= 9; y++) {
    for (let x = 11; x <= 15; x++) {
      if (glyph16[y * 16 + x] === 0) cRightEmpty++;
    }
  }
  if (!isNumeric && cRightEmpty >= 14 && (candidateChar === 'C' || candidateChar === 'E' || candidateChar === 'G' || candidateChar === 'O')) {
    return 'C';
  }

  // 7. H check: solid middle crossbar (rows 7..8, cols 4..11), empty top center (rows 1..5) and bottom center (rows 10..14)
  let hMidBar = 0;
  for (let y = 7; y <= 8; y++) {
    for (let x = 4; x <= 11; x++) {
      if (glyph16[y * 16 + x] > 0) hMidBar++;
    }
  }
  let hTopCenter = 0;
  for (let y = 1; y <= 5; y++) {
    for (let x = 5; x <= 10; x++) {
      if (glyph16[y * 16 + x] > 0) hTopCenter++;
    }
  }
  let hBotCenter = 0;
  for (let y = 10; y <= 14; y++) {
    for (let x = 5; x <= 10; x++) {
      if (glyph16[y * 16 + x] > 0) hBotCenter++;
    }
  }
  if (!isNumeric && hMidBar >= 7 && hTopCenter <= 4 && hBotCenter <= 4) {
    return 'H';
  }

  // 8. O vs D check: closed outer ring with empty center (rows 6..9, cols 6..9)
  let centerHole = 0;
  for (let y = 6; y <= 9; y++) {
    for (let x = 6; x <= 9; x++) {
      if (glyph16[y * 16 + x] === 0) centerHole++;
    }
  }
  if (centerHole >= 12 && (candidateChar === 'O' || candidateChar === 'D' || candidateChar === '0' || candidateChar === 'Q')) {
    if (isNumeric) return '0';
    let leftCornerEmpty = 0;
    if (glyph16[1 * 16 + 0] === 0) leftCornerEmpty++;
    if (glyph16[2 * 16 + 0] === 0) leftCornerEmpty++;
    if (glyph16[13 * 16 + 0] === 0) leftCornerEmpty++;
    if (glyph16[14 * 16 + 0] === 0) leftCornerEmpty++;
    return leftCornerEmpty >= 3 ? 'O' : 'D';
  }

  // 9. M check: wide aspect (>= 0.88), V-vertex in center (rows 8..14, cols 5..10 has pixels)
  if (!isNumeric && aspect >= 0.88) {
    let centerPixels = 0;
    for (let y = 8; y <= 14; y++) {
      for (let x = 5; x <= 10; x++) {
        if (glyph16[y * 16 + x] > 0) centerPixels++;
      }
    }
    if (centerPixels >= 5) {
      return 'M';
    }
  }

  // 10. R check: closed upper loop with waist bar at rows 7..9, bottom-right leg, open bottom-left
  // Differentiates 'R' from 'N' by verifying that top loop is closed across cols 6..9 at row 1
  if (
    !isNumeric &&
    (candidateChar === 'R' ||
      candidateChar === 'B' ||
      (candidateChar === 'N' && (glyph16[1 * 16 + 6] > 0 || glyph16[1 * 16 + 7] > 0 || glyph16[1 * 16 + 8] > 0)))
  ) {
    let rUpperLoop = 0;
    for (let y = 2; y <= 5; y++) {
      for (let x = 10; x <= 14; x++) {
        if (glyph16[y * 16 + x] > 0) rUpperLoop++;
      }
    }
    let rBotRightLeg = 0;
    for (let y = 11; y <= 15; y++) {
      for (let x = 10; x <= 15; x++) {
        if (glyph16[y * 16 + x] > 0) rBotRightLeg++;
      }
    }
    let rBotLeftEmpty = 0;
    for (let y = 10; y <= 14; y++) {
      for (let x = 4; x <= 8; x++) {
        if (glyph16[y * 16 + x] === 0) rBotLeftEmpty++;
      }
    }
    if (rUpperLoop >= 5 && rBotRightLeg >= 5 && rBotLeftEmpty >= 12) {
      return 'R';
    }
  }

  // 11. N check: vertical stems left & right with open top center
  if (!isNumeric && (candidateChar === 'N' || candidateChar === 'M' || candidateChar === 'H' || candidateChar === 'R')) {
    let nLeftStem = 0;
    let nRightStem = 0;
    for (let y = 2; y <= 13; y++) {
      if (glyph16[y * 16 + 1] > 0 || glyph16[y * 16 + 2] > 0) nLeftStem++;
      if (glyph16[y * 16 + 13] > 0 || glyph16[y * 16 + 14] > 0) nRightStem++;
    }
    let nTopCenterEmpty = 0;
    let nBotCenterEmpty = 0;
    for (let x = 6; x <= 9; x++) {
      if (glyph16[1 * 16 + x] === 0) nTopCenterEmpty++;
      if (glyph16[14 * 16 + x] === 0) nBotCenterEmpty++;
    }
    if (nLeftStem >= 7 && nRightStem >= 7 && nTopCenterEmpty >= 3 && nBotCenterEmpty >= 3) {
      return 'N';
    }
  }

  // 12. 4 vs 8 numeric check: in 4, bottom-left is open/empty, whereas in 8 it is closed
  if (isNumeric && (candidateChar === '8' || candidateChar === 'B' || candidateChar === '4')) {
    let botLeftEmpty = 0;
    for (let y = 12; y <= 15; y++) {
      for (let x = 0; x <= 6; x++) {
        if (glyph16[y * 16 + x] === 0) botLeftEmpty++;
      }
    }
    if (botLeftEmpty >= 22) {
      return '4';
    }
  }

  // 13. 5 vs 8: in 5, top-right (rows 3..5 cols 8..15) is completely empty
  if (isNumeric && (candidateChar === '8' || candidateChar === 'B' || candidateChar === '5' || candidateChar === 'S')) {
    let topR = 0;
    for (let y = 3; y <= 5; y++) {
      for (let x = 8; x <= 15; x++) {
        if (glyph16[y * 16 + x] > 0) topR++;
      }
    }
    if (topR <= 1) {
      return '5';
    }
  }

  // 14. 6 vs 8: in 6, top-left (rows 0..4 cols 0..4) is empty, and bottom has closed loop
  if (isNumeric && (candidateChar === '8' || candidateChar === 'B' || candidateChar === '6')) {
    let topL = 0;
    for (let y = 0; y <= 4; y++) {
      for (let x = 0; x <= 4; x++) {
        if (glyph16[y * 16 + x] > 0) topL++;
      }
    }
    let botHole = 0;
    for (let y = 9; y <= 13; y++) {
      for (let x = 5; x <= 10; x++) {
        if (glyph16[y * 16 + x] === 0) botHole++;
      }
    }
    if (topL <= 2 && botHole >= 6) {
      return '6';
    }
  }

  // 15. 0 vs 8: in 0, center (rows 6..9 cols 6..9) is completely hollow with no waist bar
  if (isNumeric && (candidateChar === '8' || candidateChar === 'B' || candidateChar === '0' || candidateChar === 'O' || candidateChar === 'D')) {
    let midWaist = 0;
    for (let x = 5; x <= 10; x++) {
      if (glyph16[7 * 16 + x] > 0 || glyph16[8 * 16 + x] > 0) midWaist++;
    }
    if (midWaist <= 2) {
      return '0';
    }
  }

  // 16. 7 vs 2 / Z: in 7, top is horizontal bar and bottom (rows 14..15 cols 3..14) has NO horizontal base
  if (isNumeric && (candidateChar === '2' || candidateChar === 'Z' || candidateChar === '7')) {
    let botBase = 0;
    for (let x = 3; x <= 14; x++) {
      if (glyph16[14 * 16 + x] > 0 || glyph16[15 * 16 + x] > 0) botBase++;
    }
    if (botBase <= 2) {
      return '7';
    }
  }

  // 17. Numeric substitutions
  if (isNumeric) {
    if (candidateChar === 'D' || candidateChar === 'O' || candidateChar === 'Q') return '0';
    if (candidateChar === 'I' || candidateChar === 'L') return '1';
    if (candidateChar === 'Z' || candidateChar === 'R' || candidateChar === 'X') return '2';
    if (candidateChar === 'S') return '5';
    if (candidateChar === 'G' || candidateChar === 'b') return '6';
    if (candidateChar === 'T') return '7';
    if (candidateChar === 'B') return '8';
  }

  return candidateChar;
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
  const medianWidth = widths[Math.floor(widths.length / 2)] || 16;
  const whitespaceGapThreshold = Math.max(4, 0.38 * medianWidth);

  let reconstructedText = '';
  const charConfidences: number[] = [];

  for (let i = 0; i < sortedBoxes.length; i++) {
    const currentBox = sortedBoxes[i];

    // Detect word boundary gaps
    if (i > 0) {
      const prevBox = sortedBoxes[i - 1];
      const horizontalGap = currentBox.x - (prevBox.x + prevBox.w);
      if (horizontalGap >= whitespaceGapThreshold || reconstructedText.endsWith(',')) {
        if (!reconstructedText.endsWith(' ')) {
          reconstructedText += ' ';
        }
      }
    }

    const glyph16 = normalizeGlyphTo16x16(binary, fullW, currentBox);
    const aspect = currentBox.w / Math.max(1, currentBox.h);
    const match = matchGlyph(glyph16, aspect, FONT_BANK, allowedChars);

    const isNumeric = Boolean(allowedChars && !/[A-Z]/.test(allowedChars));
    const lineH = Math.max(...sortedBoxes.map((b) => b.h));
    const finalChar = disambiguateGlyph(glyph16, aspect, match.char, currentBox.h, currentBox.y, lineH, isNumeric);

    reconstructedText += finalChar;
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
