// [Layer: Test/Libs/Vision/idScanner]
// Responsibility: Comprehensive TDD verification suite for Live Facial Recognition & Biometrics
// (Viola-Jones Haar Cascade, Canny Edge Pruning, YuNet 5-Landmark Topology, Bicubic Inter.Cubic 100x100 Normalization,
// PCA Eigenfaces + Fisherface LDA + LBPH + 128-D Portrait Matching).
// Strict TypeScript, ZERO 'any', 100% universal lambdas (=>), zero emojis.

import {
  rgbaToYCbCr,
  segmentSkinMask,
  computeSpatialMoments,
  computeFullFrameProfileMetrics,
  extractGeometricFacialLandmarks,
  resampleBicubic,
  checkCannyEdgePruningGate,
  compareLiveFaceWithIdPortrait,
  trackSkinFace
} from '../face/skinFaceTracker';

const assert = (condition: boolean, msg: string): void => {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
};

/**
 * Generates a realistic synthetic human face RGBA buffer with warm skin tones,
 * darker bilateral eyes, brighter nasal bridge, darker mouth line, and chin contour.
 */
const createSyntheticFaceRgba = (
  width: number,
  height: number,
  variant: 'personA' | 'personB' = 'personA'
): { rgba: Uint8ClampedArray; gray: Float32Array } => {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const gray = new Float32Array(width * height);

  const cx = width * 0.5;
  const cy = height * 0.5;
  const rx = width * 0.30;
  const ry = height * 0.38;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pIdx = idx * 4;

      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const insideEllipsoid = nx * nx + ny * ny <= 1.0;

      if (!insideEllipsoid) {
        rgba[pIdx] = 35;
        rgba[pIdx + 1] = 40;
        rgba[pIdx + 2] = 48;
        rgba[pIdx + 3] = 255;
        gray[idx] = 40;
        continue;
      }

      // Base warm human skin tone (RGB: 210, 155, 125 -> YCbCr skin cluster)
      let r = 210;
      let g = 155;
      let b = 125;

      // Subtle 3D shading across face oval
      const radialShade = 1.0 - 0.18 * (nx * nx + ny * ny);
      r = Math.round(r * radialShade);
      g = Math.round(g * radialShade);
      b = Math.round(b * radialShade);

      // Left and Right Eye Sockets
      const eyeOffsetY = variant === 'personA' ? -0.22 : -0.14;
      const eyeSpacingX = variant === 'personA' ? 0.36 : 0.50;
      const leftEyeDist = Math.hypot(nx + eyeSpacingX, (ny - eyeOffsetY) * 1.6);
      const rightEyeDist = Math.hypot(nx - eyeSpacingX, (ny - eyeOffsetY) * 1.6);

      if (leftEyeDist < 0.20 || rightEyeDist < 0.20) {
        r = 35;
        g = 28;
        b = 25;
      }

      // Bright Nasal Bridge & Nose Tip
      if (Math.abs(nx) < 0.12 && ny >= -0.20 && ny <= 0.22) {
        r = Math.min(250, r + 35);
        g = Math.min(240, g + 35);
        b = Math.min(220, b + 35);
      }

      // Mouth Line
      const mouthY = variant === 'personA' ? 0.45 : 0.30;
      const mouthW = variant === 'personA' ? 0.38 : 0.18;
      if (Math.abs(nx) < mouthW && Math.abs(ny - mouthY) < 0.08) {
        r = 75;
        g = 35;
        b = 35;
      }

      rgba[pIdx] = r;
      rgba[pIdx + 1] = g;
      rgba[pIdx + 2] = b;
      rgba[pIdx + 3] = 255;
      gray[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  return { rgba, gray };
};

console.log('\n--- 1. Testing Binary Skin Mask (0/1) & Profile Metrics Integration ---');
const W = 200;
const H = 200;
const personA = createSyntheticFaceRgba(W, H, 'personA');
const ycbcr = rgbaToYCbCr(personA.rgba, W, H);
const skinMask = segmentSkinMask(ycbcr.cb, ycbcr.cr, W, H);
const moments = computeSpatialMoments(skinMask, W, H, { x: 0, y: 0, w: W, h: H });
const profileMetrics = computeFullFrameProfileMetrics(skinMask, W, H, moments);

assert(moments.m00 > 1000, `segmentSkinMask detected substantial skin mass (m00=${moments.m00})`);
assert(
  profileMetrics.minSkinX > 0 && profileMetrics.maxSkinX < W,
  `computeFullFrameProfileMetrics properly read {0, 1} skinMask bounds ([${profileMetrics.minSkinX}..${profileMetrics.maxSkinX}])`
);

console.log('\n--- 2. Testing Canny Edge Pruning Gate (DO_CANNY_PRUNING) ---');
const flatGray = new Float32Array(W * H).fill(128);
const flatGate = checkCannyEdgePruningGate(flatGray, W, H, { x: 20, y: 20, w: 160, h: 160 });
assert(flatGate.passed === false, `checkCannyEdgePruningGate rejected flat zero-gradient region (density=${flatGate.edgeDensity})`);

const faceGate = checkCannyEdgePruningGate(personA.gray, W, H, { x: 40, y: 24, w: 120, h: 152 });
assert(faceGate.passed === true, `checkCannyEdgePruningGate passed synthetic face region (density=${faceGate.edgeDensity})`);

console.log('\n--- 3. Testing YuNet-Style 5-Landmark Finite & Topology Validation ---');
const landmarks = extractGeometricFacialLandmarks(
  personA.gray,
  W,
  H,
  { x: 40, y: 24, w: 120, h: 152 },
  skinMask,
  profileMetrics
);
assert(landmarks.isValidLandmarks === true, 'extractGeometricFacialLandmarks validated anthropometric topology');
assert(landmarks.leftEye.x < landmarks.rightEye.x, `Left eye X (${landmarks.leftEye.x}) < Right eye X (${landmarks.rightEye.x})`);
const eyeMidY = (landmarks.leftEye.y + landmarks.rightEye.y) * 0.5;
assert(eyeMidY < landmarks.noseTip.y, `Eye mid Y (${eyeMidY}) < Nose tip Y (${landmarks.noseTip.y})`);
assert(landmarks.noseTip.y < landmarks.mouthCenter.y, `Nose tip Y (${landmarks.noseTip.y}) < Mouth center Y (${landmarks.mouthCenter.y})`);

console.log('\n--- 4. Testing Bicubic Inter.Cubic Normalization & Live-to-ID Portrait Matching ---');
const bicubic100 = resampleBicubic(personA.gray, W, H, 100, 100);
assert(bicubic100.length === 10000, 'resampleBicubic produced canonical 100x100 float buffer');

// Same-person comparison (Live frame vs slightly scaled ID portrait crop)
const samePersonMatch = compareLiveFaceWithIdPortrait(
  personA.gray,
  W,
  H,
  { x: 40, y: 24, w: 120, h: 152 },
  personA.gray,
  W,
  H,
  { x: 42, y: 26, w: 116, h: 148 }
);
assert(
  samePersonMatch.isMatch === true && samePersonMatch.compositeSimilarity >= 0.85,
  `Same-person live vs ID portrait matched (similarity=${samePersonMatch.compositeSimilarity}, cosine128=${samePersonMatch.cosineSimilarity128D}, eigenDist=${samePersonMatch.eigenfaceSubspaceDistance})`
);

// End-to-end trackSkinFace verification
const tracked = trackSkinFace(personA.rgba, W, H, { cx: 100, cy: 100, rx: 60, ry: 75 });
assert(tracked.isValidFace === true, `trackSkinFace verified synthetic face (confidence=${tracked.confidence})`);

console.log('\n==============================================================');
console.log('ALL FACIAL RECOGNITION & BIOMETRIC ENGINE TESTS PASSED (100%)');
console.log('==============================================================\n');
