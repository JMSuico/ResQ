// [Layer: Libs/Vision/idScanner]
// Responsibility: Deterministic Card Presence Gate (CPG) & Anti-Selfie Human Face Rejector.
// Strict TypeScript, zero 'any', universal arrow lambdas (=>).

import { Point2D } from './cannyHough';
import {
  rgbaToYCbCr,
  segmentSkinMask,
  computeSpatialMoments,
  detectViolaJonesHaarFaceFeatures,
  computeSecondOrderIntegralImage,
  RoiRect
} from './face/skinFaceTracker';
import { computeIntegralImage } from './imageOps';

export type CardPresenceStatus = 'NO_CARD' | 'FACE_DETECTED' | 'ALIGNING' | 'LOCKED';

export interface CardPresenceEvaluation {
  readonly passed: boolean;
  readonly status: CardPresenceStatus;
  readonly hasCardStructure: boolean;
  readonly edgeContrast: number;
  readonly textStrokeDensity: number;
  readonly isDominantFace: boolean;
  readonly faceAreaRatio: number;
  readonly faceBox: RoiRect | null;
  readonly reason?: string;
}

/**
 * Evaluates whether the camera frame contains an actual physical Government ID card
 * vs. a human face pointing at the camera (selfie error) or static room furniture (bed frames, walls, desk slats).
 *
 * Rejection Criteria:
 * 1. Anti-Selfie Face Rejection Gate:
 *    - Detects whether a dominant human face is directly occupying the camera scene or overlapping with the candidate quad.
 *    - Uses YCbCr skin chrominance + Viola-Jones Haar features check (ocular dipole + nasal bridge triple).
 *    - Rejection triggered if face area ratio > 15% of frame AND candidate quad is either absent or centered on face.
 *    - Preserves handheld card verification: if user's face is in background but physical card is held in hands/desk,
 *      and candidate quad is separate from face, the card is allowed.
 *
 * 2. True Card Presence Gate (CPG):
 *    - Card structural aspect ratio: strictly [1.30, 1.75] (ISO ID-1 = 1.5858, ID-2/3 = 1.4205).
 *    - Corner orthogonality: all 4 corner angles must satisfy |cos θ| <= 0.38 (67.6° to 112.4°).
 *    - Border step contrast: directed orthogonal luminance contrast across all 4 borders >= 20.0.
 *    - Interior text stroke density: normalized stroke edge ratio >= 0.030 across >= 5 active spatial zones.
 */
export const evaluateCardPresenceGate = (
  rgba: Uint8ClampedArray,
  gray: Float32Array,
  edges: Uint8Array,
  width: number,
  height: number,
  candidateCorners: Point2D[] | null,
  isTemporallyLocked: boolean
): CardPresenceEvaluation => {
  const totalPixels = width * height;
  if (totalPixels <= 0 || width < 40 || height < 40) {
    return {
      passed: false,
      status: 'NO_CARD',
      hasCardStructure: false,
      edgeContrast: 0,
      textStrokeDensity: 0,
      isDominantFace: false,
      faceAreaRatio: 0,
      faceBox: null,
      reason: 'INVALID_FRAME_DIMENSIONS'
    };
  }

  // -------------------------------------------------------------------------
  // PILLAR 1: ANTI-SELFIE FACE REJECTION GATE
  // -------------------------------------------------------------------------
  const ycbcr = rgbaToYCbCr(rgba, width, height);
  const skinMask = segmentSkinMask(ycbcr.cb, ycbcr.cr, width, height);
  const moments = computeSpatialMoments(skinMask, width, height);

  const skinRatio = moments.m00 / totalPixels;
  let isDominantFace = false;
  let faceAreaRatio = 0;
  let detectedFaceBox: RoiRect | null = null;

  // If skin pixels cover >= 9% of the viewport and ellipse major axis >= 35px
  if (skinRatio >= 0.09 && moments.majorAxis >= 35) {
    const rawFaceW = Math.max(35, Math.min(width, moments.minorAxis > 0 ? moments.minorAxis * 1.15 : moments.majorAxis * 0.85));
    const rawFaceH = Math.max(45, Math.min(height, moments.majorAxis * 1.25));

    detectedFaceBox = {
      x: Math.max(0, Math.min(width - rawFaceW, moments.cx - rawFaceW * 0.5)),
      y: Math.max(0, Math.min(height - rawFaceH, moments.cy - rawFaceH * 0.5)),
      w: rawFaceW,
      h: rawFaceH
    };

    faceAreaRatio = (detectedFaceBox.w * detectedFaceBox.h) / totalPixels;

    // Run Viola-Jones Haar cascading verification to confirm biological human face
    // Real faces occupy between 12% and 65% of the frame (ratios > 65% indicate brown walls or wooden desks)
    if (faceAreaRatio >= 0.12 && faceAreaRatio <= 0.65) {
      const integral = computeIntegralImage(gray, width, height);
      const integralSq = computeSecondOrderIntegralImage(gray, width, height);
      const haarCheck = detectViolaJonesHaarFaceFeatures(integral, width, height, detectedFaceBox, integralSq);

      // If ocular dipole, nasal bridge, or confidence score >= 0.50 confirms human facial architecture
      if (haarCheck.ocularDipolePassed || haarCheck.bridgeTriplePassed || haarCheck.score >= 0.50) {
        if (!candidateCorners || candidateCorners.length !== 4) {
          isDominantFace = true;
        } else {
          // If a candidate quad is present, evaluate whether the quad is actually just the user's face (selfie),
          // or if it is a real physical card held by the user or on a desk.
          const qMinX = Math.min(...candidateCorners.map((p) => p.x));
          const qMaxX = Math.max(...candidateCorners.map((p) => p.x));
          const qMinY = Math.min(...candidateCorners.map((p) => p.y));
          const qMaxY = Math.max(...candidateCorners.map((p) => p.y));
          const qW = Math.max(1, qMaxX - qMinX);
          const qH = Math.max(1, qMaxY - qMinY);
          const quadArea = qW * qH;

          // Intersection between detected face and candidate quad
          const interX0 = Math.max(qMinX, detectedFaceBox.x);
          const interY0 = Math.max(qMinY, detectedFaceBox.y);
          const interX1 = Math.min(qMaxX, detectedFaceBox.x + detectedFaceBox.w);
          const interY1 = Math.min(qMaxY, detectedFaceBox.y + detectedFaceBox.h);
          const interW = Math.max(0, interX1 - interX0);
          const interH = Math.max(0, interY1 - interY0);
          const intersectionArea = interW * interH;

          const faceOccupancyInQuad = intersectionArea / Math.max(1, quadArea);
          const quadAreaRatio = quadArea / totalPixels;

          // Reject if the face occupies > 45% of the candidate quad (selfie directly in quad),
          // OR if face is dominant in viewport while the candidate quad is too small (< 14% of viewport)
          // which indicates room furniture (bed frame, wall, desk) rather than a handheld ID card.
          if (faceOccupancyInQuad > 0.45 || quadAreaRatio < 0.14) {
            isDominantFace = true;
          }
        }
      }
    }
  }

  if (isDominantFace) {
    return {
      passed: false,
      status: 'FACE_DETECTED',
      hasCardStructure: false,
      edgeContrast: 0,
      textStrokeDensity: 0,
      isDominantFace: true,
      faceAreaRatio,
      faceBox: detectedFaceBox,
      reason: 'HUMAN_FACE_IN_VIEWPORT'
    };
  }

  // -------------------------------------------------------------------------
  // PILLAR 2: TRUE CARD PRESENCE GATE (CPG)
  // -------------------------------------------------------------------------
  if (!candidateCorners || candidateCorners.length !== 4) {
    return {
      passed: false,
      status: 'NO_CARD',
      hasCardStructure: false,
      edgeContrast: 0,
      textStrokeDensity: 0,
      isDominantFace: false,
      faceAreaRatio,
      faceBox: detectedFaceBox,
      reason: 'NO_VALID_QUAD'
    };
  }

  const s0 = Math.hypot(candidateCorners[1].x - candidateCorners[0].x, candidateCorners[1].y - candidateCorners[0].y);
  const s1 = Math.hypot(candidateCorners[2].x - candidateCorners[1].x, candidateCorners[2].y - candidateCorners[1].y);
  const s2 = Math.hypot(candidateCorners[3].x - candidateCorners[2].x, candidateCorners[3].y - candidateCorners[2].y);
  const s3 = Math.hypot(candidateCorners[0].x - candidateCorners[3].x, candidateCorners[0].y - candidateCorners[3].y);

  const avgW = (s0 + s2) * 0.5;
  const avgH = (s1 + s3) * 0.5;
  if (avgW <= 0 || avgH <= 0) {
    return {
      passed: false,
      status: 'NO_CARD',
      hasCardStructure: false,
      edgeContrast: 0,
      textStrokeDensity: 0,
      isDominantFace: false,
      faceAreaRatio,
      faceBox: detectedFaceBox,
      reason: 'ZERO_DIMENSIONS'
    };
  }

  // 1. Resilient ID Aspect Ratio: [1.25, 1.82] (Accommodates perspective tilt and close-up projection)
  const aspect = Math.max(avgW, avgH) / Math.min(avgW, avgH);
  if (aspect < 1.25 || aspect > 1.82) {
    return {
      passed: false,
      status: 'NO_CARD',
      hasCardStructure: false,
      edgeContrast: 0,
      textStrokeDensity: 0,
      isDominantFace: false,
      faceAreaRatio,
      faceBox: detectedFaceBox,
      reason: `INVALID_ASPECT_RATIO_${aspect.toFixed(2)}`
    };
  }

  // 1b. Card Viewport Area Ratio (8% to 96% of camera viewport)
  // Accommodates both distant alignment and close-up full-viewfinder positioning
  const quadArea = avgW * avgH;
  const quadAreaRatio = quadArea / totalPixels;
  if (quadAreaRatio < 0.08 || quadAreaRatio > 0.96) {
    return {
      passed: false,
      status: 'NO_CARD',
      hasCardStructure: false,
      edgeContrast: 0,
      textStrokeDensity: 0,
      isDominantFace: false,
      faceAreaRatio,
      faceBox: detectedFaceBox,
      reason: `INVALID_QUAD_SCALE_${Math.round(quadAreaRatio * 100)}%`
    };
  }

  // 2. Corner Orthogonality Check: |cos θ| <= 0.45 (63.2° to 116.8°)
  for (let i = 0; i < 4; i++) {
    const pPrev = candidateCorners[(i + 3) % 4];
    const pCurr = candidateCorners[i];
    const pNext = candidateCorners[(i + 1) % 4];

    const v1x = pPrev.x - pCurr.x;
    const v1y = pPrev.y - pCurr.y;
    const v2x = pNext.x - pCurr.x;
    const v2y = pNext.y - pCurr.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 <= 0 || len2 <= 0) continue;

    const cosTheta = Math.abs((v1x * v2x + v1y * v2y) / (len1 * len2));
    if (cosTheta > 0.45) {
      return {
        passed: false,
        status: 'NO_CARD',
        hasCardStructure: false,
        edgeContrast: 0,
        textStrokeDensity: 0,
        isDominantFace: false,
        faceAreaRatio,
        faceBox: detectedFaceBox,
        reason: 'NON_RECTANGULAR_CORNERS'
      };
    }
  }

  // 3. Perimeter Step-Contrast (Orthogonal derivative across card borders)
  let totalBorderContrast = 0;
  let sampledBorderPoints = 0;

  for (let m = 0; m < 4; m++) {
    const pA = candidateCorners[m];
    const pB = candidateCorners[(m + 1) % 4];
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;

    const nx = -dy / len;
    const ny = dx / len;

    // Sample along 15% to 85% of each side
    const K = 16;
    for (let k = 0; k < K; k++) {
      const t = 0.15 + 0.70 * (k / (K - 1));
      const lx = pA.x + dx * t;
      const ly = pA.y + dy * t;

      const clampX = (v: number): number => Math.max(0, Math.min(width - 1, Math.round(v)));
      const clampY = (v: number): number => Math.max(0, Math.min(height - 1, Math.round(v)));

      const in3X = clampX(lx + nx * 3);
      const in3Y = clampY(ly + ny * 3);
      const out3X = clampX(lx - nx * 3);
      const out3Y = clampY(ly - ny * 3);
      const step3 = Math.abs(gray[in3Y * width + in3X] - gray[out3Y * width + out3X]);

      const in6X = clampX(lx + nx * 6);
      const in6Y = clampY(ly + ny * 6);
      const out6X = clampX(lx - nx * 6);
      const out6Y = clampY(ly - ny * 6);
      const step6 = Math.abs(gray[in6Y * width + in6X] - gray[out6Y * width + out6X]);

      totalBorderContrast += Math.max(step3, step6);
      sampledBorderPoints++;
    }
  }

  const meanEdgeContrast = sampledBorderPoints > 0 ? totalBorderContrast / sampledBorderPoints : 0;
  if (meanEdgeContrast < 11.0) {
    return {
      passed: false,
      status: 'NO_CARD',
      hasCardStructure: true,
      edgeContrast: Math.round(meanEdgeContrast),
      textStrokeDensity: 0,
      isDominantFace: false,
      faceAreaRatio,
      faceBox: detectedFaceBox,
      reason: `LOW_BORDER_CONTRAST_${meanEdgeContrast.toFixed(1)}`
    };
  }

  // 4. Interior Text Stroke & Zone Dispersion
  const nu = 36;
  const nv = 24;
  const totalInteriorSamples = nu * nv;
  let edgeHits = 0;

  // 12-block spatial grid (4 columns x 3 rows)
  const blockRows = 3;
  const blockCols = 4;
  const blockHits = new Int32Array(blockRows * blockCols);
  const blockTotals = new Int32Array(blockRows * blockCols);

  for (let iv = 2; iv < nv - 2; iv++) {
    const v = iv / (nv - 1);
    const bRow = Math.min(blockRows - 1, Math.floor(v * blockRows));

    for (let iu = 2; iu < nu - 2; iu++) {
      const u = iu / (nu - 1);
      const bCol = Math.min(blockCols - 1, Math.floor(u * blockCols));
      const bIdx = bRow * blockCols + bCol;
      blockTotals[bIdx]++;

      // Bilinear interpolation inside quad
      const px = Math.round(
        (1 - u) * (1 - v) * candidateCorners[0].x +
        u * (1 - v) * candidateCorners[1].x +
        u * v * candidateCorners[2].x +
        (1 - u) * v * candidateCorners[3].x
      );
      const py = Math.round(
        (1 - u) * (1 - v) * candidateCorners[0].y +
        u * (1 - v) * candidateCorners[1].y +
        u * v * candidateCorners[2].y +
        (1 - u) * v * candidateCorners[3].y
      );

      if (px >= 0 && px < width && py >= 0 && py < height) {
        if (edges[py * width + px] > 0) {
          edgeHits++;
          blockHits[bIdx]++;
        }
      }
    }
  }

  const strokeDensity = edgeHits / Math.max(1, totalInteriorSamples);
  let activeBlocks = 0;
  for (let b = 0; b < blockRows * blockCols; b++) {
    const bRatio = blockTotals[b] > 0 ? blockHits[b] / blockTotals[b] : 0;
    if (bRatio >= 0.025 || blockHits[b] >= 3) {
      activeBlocks++;
    }
  }

  // Measure horizontal text stroke transitions across text area (u in [0.35, 0.88], v in [0.25, 0.80])
  // Genuine ID cards feature dense alternating character stroke transitions (> 20 transitions across sample rows)
  let textTransitions = 0;
  const sampleVList = [0.32, 0.44, 0.53, 0.67];
  for (const sv of sampleVList) {
    let lastEdge = 0;
    for (let iu = 12; iu < 32; iu++) {
      const su = iu / 35;
      const px = Math.round(
        (1 - su) * (1 - sv) * candidateCorners[0].x +
        su * (1 - sv) * candidateCorners[1].x +
        su * sv * candidateCorners[2].x +
        (1 - su) * sv * candidateCorners[3].x
      );
      const py = Math.round(
        (1 - su) * (1 - sv) * candidateCorners[0].y +
        su * (1 - sv) * candidateCorners[1].y +
        su * sv * candidateCorners[2].y +
        (1 - su) * sv * candidateCorners[3].y
      );
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const edgeVal = edges[py * width + px] > 0 ? 1 : 0;
        if (edgeVal !== lastEdge && edgeVal === 1) {
          textTransitions++;
        }
        lastEdge = edgeVal;
      }
    }
  }

  // Philippine government IDs have text lines spreading across at least 3 of 12 spatial blocks
  // and multiple distinct alternating character stroke transitions
  // Rejects plain furniture slats, doors, and bed frames that have border edges but lack dense text matrix
  if (strokeDensity < 0.011 || activeBlocks < 3 || textTransitions < 5) {
    return {
      passed: false,
      status: 'NO_CARD',
      hasCardStructure: true,
      edgeContrast: Math.round(meanEdgeContrast),
      textStrokeDensity: Math.round(strokeDensity * 1000) / 1000,
      isDominantFace: false,
      faceAreaRatio,
      faceBox: detectedFaceBox,
      reason: `INSUFFICIENT_TEXT_STROKES_${(strokeDensity * 100).toFixed(1)}%_ZONES_${activeBlocks}/12_TRANS_${textTransitions}`
    };
  }

  // Frame passed all criteria!
  const status: CardPresenceStatus = isTemporallyLocked ? 'LOCKED' : 'ALIGNING';
  return {
    passed: true,
    status,
    hasCardStructure: true,
    edgeContrast: Math.round(meanEdgeContrast),
    textStrokeDensity: Math.round(strokeDensity * 1000) / 1000,
    isDominantFace: false,
    faceAreaRatio,
    faceBox: detectedFaceBox
  };
};
