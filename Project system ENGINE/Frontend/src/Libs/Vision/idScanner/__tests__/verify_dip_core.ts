/**
 * ResQTrack Deterministic ID Scanner - Subagent 1 DIP Core Verification Suite
 * Verifies mathematical correctness and execution integrity of:
 * - imageOps.ts
 * - cannyHough.ts
 * - contour.ts
 * - homography.ts
 */

import {
  toGrayscale,
  gaussianBlur5x5,
  sobelGradients,
  computeIntegralImage,
  queryIntegralArea,
  bilinearSample,
  resizeBilinear,
} from '../imageOps';

import {
  autoCanny,
  houghLines,
  clusterLines,
  findLineIntersections,
} from '../cannyHough';

import {
  traceContours,
  douglasPeucker,
  polygonArea,
  isQuadConvex,
  findCardQuad,
} from '../contour';

import {
  orderCorners,
  solveHomography,
  invertHomography,
  warpPerspective,
} from '../homography';

const assert = (condition: boolean, msg: string): void => {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
};

console.log('========================================================');
console.log('STARTING DIP CORE GEOMETRY & SEGMENTATION VERIFICATION');
console.log('========================================================');

// ========================================================
// 1. imageOps.ts Verification
// ========================================================
console.log('\n--- 1. Testing imageOps.ts ---');

// 1.1 toGrayscale
const w = 4;
const h = 4;
const rgba = new Uint8ClampedArray(w * h * 4);
// Pixel (0, 0): pure red (255, 0, 0) -> expected 0.299 * 255 = 76.245
rgba[0] = 255; rgba[1] = 0; rgba[2] = 0; rgba[3] = 255;
// Pixel (1, 0): pure green (0, 255, 0) -> expected 0.587 * 255 = 149.685
rgba[4] = 0; rgba[5] = 255; rgba[6] = 0; rgba[7] = 255;
// Pixel (2, 0): pure blue (0, 0, 255) -> expected 0.114 * 255 = 29.07
rgba[8] = 0; rgba[9] = 0; rgba[10] = 255; rgba[11] = 255;
// Pixel (3, 0): pure white (255, 255, 255) -> expected 255
rgba[12] = 255; rgba[13] = 255; rgba[14] = 255; rgba[15] = 255;

const gray = toGrayscale(rgba, w, h);
assert(Math.abs(gray[0] - 76.245) < 0.01, 'toGrayscale calculates Red ITU-R BT.601 correctly');
assert(Math.abs(gray[1] - 149.685) < 0.01, 'toGrayscale calculates Green ITU-R BT.601 correctly');
assert(Math.abs(gray[2] - 29.07) < 0.01, 'toGrayscale calculates Blue ITU-R BT.601 correctly');
assert(Math.abs(gray[3] - 255.0) < 0.01, 'toGrayscale calculates White correctly (255.0)');

// 1.2 gaussianBlur5x5
const blurTestW = 10;
const blurTestH = 10;
const impulseGray = new Float32Array(blurTestW * blurTestH);
impulseGray[5 * blurTestW + 5] = 1000.0; // Impulse spike at (5, 5)
const blurred = gaussianBlur5x5(impulseGray, blurTestW, blurTestH, 1.4);
assert(blurred[5 * blurTestW + 5] < 1000.0, 'gaussianBlur5x5 attenuates impulse spike at center');
assert(blurred[5 * blurTestW + 4] > 0, 'gaussianBlur5x5 disperses energy to left neighbor');
assert(blurred[4 * blurTestW + 5] > 0, 'gaussianBlur5x5 disperses energy to top neighbor');

// 1.3 sobelGradients
const stepImgW = 8;
const stepImgH = 8;
const stepImg = new Float32Array(stepImgW * stepImgH);
// Vertical step edge: left is 0, right is 255
for (let y = 0; y < stepImgH; y++) {
  for (let x = 4; x < stepImgW; x++) {
    stepImg[y * stepImgW + x] = 255.0;
  }
}
const sobel = sobelGradients(stepImg, stepImgW, stepImgH);
const edgeMag = sobel.magnitude[4 * stepImgW + 4];
assert(edgeMag > 500, `sobelGradients detects strong vertical step edge (magnitude: ${edgeMag})`);
assert(Math.abs(sobel.gy[4 * stepImgW + 4]) < 1e-4, 'sobelGradients Gy is 0 on purely vertical step edge');
assert(Math.abs(sobel.angle[4 * stepImgW + 4]) < 0.01, 'sobelGradients angle is near 0 for horizontal normal gradient');

// 1.4 computeIntegralImage & queryIntegralArea
const intW = 5;
const intH = 5;
const constGray = new Float32Array(intW * intH);
constGray.fill(2.0); // Every pixel is 2.0
const integral = computeIntegralImage(constGray, intW, intH);
assert(integral.length === (intW + 1) * (intH + 1), 'computeIntegralImage returns (W+1)*(H+1) elements');
assert(integral[(intH) * (intW + 1) + intW] === 2.0 * 25, 'Total sum matches 2.0 * 25 = 50.0');
const subAreaSum = queryIntegralArea(integral, intW, 1, 1, 3, 3); // 3x3 region = 9 pixels * 2.0 = 18.0
assert(Math.abs(subAreaSum - 18.0) < 1e-5, `queryIntegralArea accurately evaluates 3x3 sub-region sum (got ${subAreaSum})`);

// 1.5 bilinearSample
const sampleGrid = new Float32Array([
  10, 20,
  30, 40
]);
const midSample = bilinearSample(sampleGrid, 2, 2, 0.5, 0.5, 1);
assert(Math.abs(midSample[0] - 25.0) < 1e-4, `bilinearSample at (0.5, 0.5) is average: 25.0 (got ${midSample[0]})`);

// 1.6 resizeBilinear
const tinySrc = new Uint8ClampedArray([
  255, 0, 0, 255,   0, 255, 0, 255,
  0, 0, 255, 255,   255, 255, 255, 255
]);
const resized = resizeBilinear(tinySrc, 2, 2, 4, 4);
assert(resized.length === 4 * 4 * 4, 'resizeBilinear produces correct buffer byte length');

// ========================================================
// 2. cannyHough.ts Verification
// ========================================================
console.log('\n--- 2. Testing cannyHough.ts ---');

// 2.1 autoCanny on synthetic rectangular card
const cardW = 100;
const cardH = 80;
const cardImg = new Float32Array(cardW * cardH);
cardImg.fill(40.0); // Dark background
// Draw bright card in center [20..80] x [15..65]
for (let y = 15; y <= 65; y++) {
  for (let x = 20; x <= 80; x++) {
    cardImg[y * cardW + x] = 220.0;
  }
}
const edges = autoCanny(cardImg, cardW, cardH);
assert(edges.length === cardW * cardH, 'autoCanny returns binary array matching input dimensions');
// Edge should exist along card border
assert(edges[15 * cardW + 50] === 255, 'autoCanny extracts top border of synthetic card');
assert(edges[65 * cardW + 50] === 255, 'autoCanny extracts bottom border of synthetic card');
assert(edges[40 * cardW + 20] === 255, 'autoCanny extracts left border of synthetic card');
assert(edges[40 * cardW + 80] === 255, 'autoCanny extracts right border of synthetic card');
// Interior of card should be clean (0)
assert(edges[40 * cardW + 50] === 0, 'autoCanny leaves homogeneous card interior clean (0)');

// 2.2 houghLines & clusterLines
const houghDetected = houghLines(edges, cardW, cardH, 0.20);
assert(houghDetected.length >= 4, `houghLines detects straight line boundaries (found ${houghDetected.length} lines)`);
const clustered = clusterLines(houghDetected);
assert(clustered.horizontal.length >= 1, `clusterLines identified horizontal lines (found ${clustered.horizontal.length})`);
assert(clustered.vertical.length >= 1, `clusterLines identified vertical lines (found ${clustered.vertical.length})`);

// 2.3 findLineIntersections
const intersections = findLineIntersections(clustered.horizontal, clustered.vertical, cardW, cardH);
assert(intersections.length >= 4, `findLineIntersections locates card corners (found ${intersections.length} points)`);

// ========================================================
// 3. contour.ts Verification
// ========================================================
console.log('\n--- 3. Testing contour.ts ---');

// 3.1 traceContours
const contours = traceContours(edges, cardW, cardH);
assert(contours.length >= 1, `traceContours extracts outer card perimeter loop (found ${contours.length} contours)`);
assert(contours[0].length >= 20, `Contour loop has sufficient points (length: ${contours[0].length})`);

// 3.2 douglasPeucker
const simplified = douglasPeucker(contours[0], 4.0);
assert(simplified.length < contours[0].length, `douglasPeucker simplified contour from ${contours[0].length} to ${simplified.length} vertices`);

// 3.3 polygonArea
const testQuad = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 0, y: 50 },
];
const area = polygonArea(testQuad);
assert(Math.abs(area - 5000) < 1e-4, `polygonArea shoelace calculates 100x50 rectangle area: 5000 (got ${area})`);

// 3.4 isQuadConvex
assert(isQuadConvex(testQuad) === true, 'isQuadConvex returns true for convex rectangle');
const concaveQuad = [
  { x: 0, y: 50 },   // Tip
  { x: 100, y: 0 },  // Wing 1
  { x: 60, y: 50 },  // Inward notch reflex vertex
  { x: 100, y: 100 }, // Wing 2
];
assert(isQuadConvex(concaveQuad) === false, 'isQuadConvex detects concave quad and returns false');

// 3.5 findCardQuad
const cardEdgesWithInterior = new Uint8Array(edges);
for (const lineY of [24, 32, 40, 48, 56]) {
  for (let x = 26; x <= 74; x += 2) {
    cardEdgesWithInterior[lineY * cardW + x] = 255;
  }
}
const bestQuad = findCardQuad(cardEdgesWithInterior, cardW, cardH, [1.5858, 1.4205, 60 / 50]);
assert(bestQuad !== null, 'findCardQuad locates candidate card quad');
if (bestQuad) {
  assert(bestQuad.corners.length === 4, 'findCardQuad returns exactly 4 corners');
  assert(bestQuad.score > 0.5, `findCardQuad achieves high confidence score (got ${bestQuad.score.toFixed(3)})`);
}

// ========================================================
// 4. homography.ts Verification
// ========================================================
console.log('\n--- 4. Testing homography.ts ---');

// 4.1 orderCorners
const unordered = [
  { x: 100, y: 100 }, // BR
  { x: 0, y: 0 },     // TL
  { x: 100, y: 0 },   // TR
  { x: 0, y: 100 },   // BL
];
const ordered = orderCorners(unordered);
assert(ordered.tl.x === 0 && ordered.tl.y === 0, 'orderCorners identifies Top-Left (0, 0)');
assert(ordered.tr.x === 100 && ordered.tr.y === 0, 'orderCorners identifies Top-Right (100, 0)');
assert(ordered.br.x === 100 && ordered.br.y === 100, 'orderCorners identifies Bottom-Right (100, 100)');
assert(ordered.bl.x === 0 && ordered.bl.y === 100, 'orderCorners identifies Bottom-Left (0, 100)');

// 4.2 solveHomography & invertHomography
const srcQuad = [
  { x: 10, y: 10 },
  { x: 90, y: 15 },
  { x: 85, y: 85 },
  { x: 15, y: 80 },
];
const dstQuad = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 80 },
];
const H = solveHomography(srcQuad, dstQuad);
assert(H.length === 9, 'solveHomography produces 3x3 homography matrix (9 elements)');
assert(Math.abs(H[8] - 1.0) < 1e-4, 'Homography normalized with H[8] = 1.0');

// Verify forward projection of srcQuad[0] -> dstQuad[0] (0, 0)
const xs0 = srcQuad[0].x;
const ys0 = srcQuad[0].y;
const wProj = H[6] * xs0 + H[7] * ys0 + H[8];
const uProj = (H[0] * xs0 + H[1] * ys0 + H[2]) / wProj;
const vProj = (H[3] * xs0 + H[4] * ys0 + H[5]) / wProj;
assert(Math.abs(uProj - dstQuad[0].x) < 1e-3, `solveHomography maps X0: ${uProj.toFixed(3)} -> ${dstQuad[0].x}`);
assert(Math.abs(vProj - dstQuad[0].y) < 1e-3, `solveHomography maps Y0: ${vProj.toFixed(3)} -> ${dstQuad[0].y}`);

const invH = invertHomography(H);
assert(invH.length === 9, 'invertHomography produces 9-element inverted matrix');

// 4.3 warpPerspective
const mockSrcData = {
  width: 100,
  height: 100,
  data: new Uint8ClampedArray(100 * 100 * 4),
  colorSpace: 'srgb',
} as ImageData;
// Fill interior of source quad with solid green
for (let y = 15; y <= 75; y++) {
  for (let x = 15; x <= 75; x++) {
    const idx = (y * 100 + x) * 4;
    mockSrcData.data[idx] = 0;
    mockSrcData.data[idx + 1] = 255;
    mockSrcData.data[idx + 2] = 0;
    mockSrcData.data[idx + 3] = 255;
  }
}
const warped = warpPerspective(mockSrcData, H, 100, 80);
assert(warped.width === 100 && warped.height === 80, 'warpPerspective generates rectified image with target dimensions');
// Center of destination image should be green
const centerDstIdx = (40 * 100 + 50) * 4;
assert(warped.data[centerDstIdx + 1] > 200, `warpPerspective rectified center pixel is green (value: ${warped.data[centerDstIdx + 1]})`);

console.log('\n========================================================');
console.log('ALL DIP CORE MATHEMATICS & GEOMETRY TESTS PASSED (100%)');
console.log('========================================================\n');
