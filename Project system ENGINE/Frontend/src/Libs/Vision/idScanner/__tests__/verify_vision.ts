/**
 * ResQTrack Deterministic ID Scanner - Vision Verification Suite
 */

import {
  flattenIllumination,
  otsuThreshold,
  sauvolaAdaptiveThreshold,
  morphologyOpen,
  morphologyClose,
  deskewProjectionProfile,
  rgbaToGrayscale
} from '../binarize';

import {
  assessLaplacianClarity,
  detectSpecularGlare,
  checkExposureBalance,
  detectMoirePattern,
  evaluateQualityGate
} from '../qualityGates';

const assert = (condition: boolean, msg: string) => {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
};

console.log('--- STARTING VISION PIPELINE VERIFICATION ---');

// 1. Test rgbaToGrayscale
const testWidth = 4;
const testHeight = 4;
const rgba = new Uint8ClampedArray(testWidth * testHeight * 4);
// Fill with pure white
for (let i = 0; i < rgba.length; i += 4) {
  rgba[i] = 255;
  rgba[i + 1] = 255;
  rgba[i + 2] = 255;
  rgba[i + 3] = 255;
}
const grayWhite = rgbaToGrayscale(rgba, testWidth, testHeight);
assert(Math.abs(grayWhite[0] - 255) < 0.1, 'rgbaToGrayscale converts pure white to 255.0');

// 2. Test flattenIllumination
const gradW = 50;
const gradH = 50;
const gradientGray = new Float32Array(gradW * gradH);
for (let y = 0; y < gradH; y++) {
  for (let x = 0; x < gradW; x++) {
    // Add strong shadow ramp: left is 50, right is 200
    gradientGray[y * gradW + x] = 50 + (x / gradW) * 150;
  }
}
const flattened = flattenIllumination(gradientGray, gradW, gradH, 15);
assert(flattened.length === gradW * gradH, 'flattenIllumination returns correct dimensions');
const leftVal = flattened[25 * gradW + 5];
const rightVal = flattened[25 * gradW + 45];
const diff = Math.abs(leftVal - rightVal);
assert(diff < 40, `flattenIllumination neutralizes gradient flash (diff: ${diff.toFixed(2)} < 40)`);

// 3. Test otsuThreshold
const bimodalW = 10;
const bimodalH = 10;
const bimodal = new Float32Array(bimodalW * bimodalH);
for (let i = 0; i < bimodal.length; i++) {
  bimodal[i] = i < 50 ? 40 : 210; // 50 pixels dark, 50 pixels light
}
const otsuRes = otsuThreshold(bimodal, bimodalW, bimodalH);
assert(otsuRes.threshold >= 40 && otsuRes.threshold <= 210, `Otsu threshold is between modes (got ${otsuRes.threshold})`);
assert(otsuRes.binary[0] === 255, 'Dark text is mapped to 255');
assert(otsuRes.binary[60] === 0, 'Light background is mapped to 0');

// 4. Test sauvolaAdaptiveThreshold
const sauvW = 60;
const sauvH = 60;
const sauvGray = new Float32Array(sauvW * sauvH);
// Background: light 220 with faint microprint oscillation (+/- 4)
for (let y = 0; y < sauvH; y++) {
  for (let x = 0; x < sauvW; x++) {
    sauvGray[y * sauvW + x] = 220 + ((x + y) % 2 === 0 ? 4 : -4);
  }
}
// Insert high-contrast text stroke: dark 40
for (let x = 20; x <= 40; x++) {
  sauvGray[30 * sauvW + x] = 40;
}
const sauvBinary = sauvolaAdaptiveThreshold(sauvGray, sauvW, sauvH, 25, 0.34, 128);
// Verify microprint background is classified as 0 (suppressed)
assert(sauvBinary[10 * sauvW + 10] === 0, 'Sauvola suppresses subtle microprint background to 0');
// Verify true text stroke is classified as 255 (detected)
assert(sauvBinary[30 * sauvW + 30] === 255, 'Sauvola correctly extracts high-contrast text as 255');

// 5. Test morphologyOpen
const morphW = 8;
const morphH = 8;
const noiseImg = new Uint8Array(morphW * morphH);
// Add isolated 1-pixel noise dot at (4,4)
noiseImg[4 * morphW + 4] = 255;
const opened = morphologyOpen(noiseImg, morphW, morphH, 2);
assert(opened[4 * morphW + 4] === 0, 'morphologyOpen erases isolated salt noise dot');

// 6. Test morphologyClose
const closeImg = new Uint8Array(morphW * morphH);
// Broken horizontal text stroke: (2,3) and (4,3) are set, gap at (3,3)
closeImg[3 * morphW + 2] = 255;
closeImg[3 * morphW + 4] = 255;
assert(closeImg[3 * morphW + 3] === 0, 'Initial stroke has a gap');
const closed = morphologyClose(closeImg, morphW, morphH, 3, 1);
assert(closed[3 * morphW + 3] === 255, 'morphologyClose bridges horizontal gap between stroke pixels');

// 7. Test deskewProjectionProfile
const deskewW = 100;
const deskewH = 100;
const skewedImg = new Uint8Array(deskewW * deskewH);
// Create a tilted horizontal line at angle ~ +3 degrees
const angleRad = (3 * Math.PI) / 180;
for (let x = 20; x < 80; x++) {
  const y = Math.round(50 + (x - 50) * Math.tan(angleRad));
  skewedImg[y * deskewW + x] = 255;
}
const deskewRes = deskewProjectionProfile(skewedImg, deskewW, deskewH, [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]);
assert(Math.abs(deskewRes.bestAngle - 3) <= 1, `deskewProjectionProfile detects tilt angle (detected: ${deskewRes.bestAngle} deg)`);

// 8. Test assessLaplacianClarity
const lapW = 40;
const lapH = 40;
// Flat blurry image
const blurryGray = new Float32Array(lapW * lapH);
blurryGray.fill(128);
const blurResult = assessLaplacianClarity(blurryGray, lapW, lapH);
assert(blurResult.variance < 1.0 && !blurResult.isSharp, 'assessLaplacianClarity marks flat image as not sharp');

// Sharp checkerboard image
const sharpGray = new Float32Array(lapW * lapH);
for (let y = 0; y < lapH; y++) {
  for (let x = 0; x < lapW; x++) {
    sharpGray[y * lapW + x] = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 20 : 230;
  }
}
const sharpResult = assessLaplacianClarity(sharpGray, lapW, lapH);
assert(sharpResult.variance >= 100.0 && sharpResult.isSharp, `assessLaplacianClarity marks sharp edges as sharp (var: ${sharpResult.variance})`);

// 9. Test detectSpecularGlare
const glareW = 20;
const glareH = 20;
const glareRGBA = new Uint8ClampedArray(glareW * glareH * 4);
// 10 pixels out of 400 are specular glare (S=0, V=1.0) -> 2.5% (under 3%)
for (let i = 0; i < 10; i++) {
  glareRGBA[i * 4] = 255;
  glareRGBA[i * 4 + 1] = 255;
  glareRGBA[i * 4 + 2] = 255;
  glareRGBA[i * 4 + 3] = 255;
}
const lowGlare = detectSpecularGlare(glareRGBA, glareW, glareH);
assert(lowGlare.glareRatio <= 0.03 && !lowGlare.hasGlare, `detectSpecularGlare passes ratio <= 3% (got ${lowGlare.glareRatio * 100}%)`);

// Now make 30 pixels glare -> 7.5% (exceeds 3%)
for (let i = 10; i < 30; i++) {
  glareRGBA[i * 4] = 255;
  glareRGBA[i * 4 + 1] = 255;
  glareRGBA[i * 4 + 2] = 255;
  glareRGBA[i * 4 + 3] = 255;
}
const highGlare = detectSpecularGlare(glareRGBA, glareW, glareH);
assert(highGlare.hasGlare, `detectSpecularGlare flags glare > 3% (got ${highGlare.glareRatio * 100}%)`);

// 10. Test checkExposureBalance
const expGray = new Float32Array(100);
expGray.fill(40);
assert(checkExposureBalance(expGray, 10, 10).status === 'UNDEREXPOSED', 'Exposure < 60 is UNDEREXPOSED');
expGray.fill(130);
assert(checkExposureBalance(expGray, 10, 10).status === 'OPTIMAL', 'Exposure in [60, 200] is OPTIMAL');
expGray.fill(220);
assert(checkExposureBalance(expGray, 10, 10).status === 'OVEREXPOSED', 'Exposure > 200 is OVEREXPOSED');

// 11. Test detectMoirePattern
const moireW = 50;
const moireH = 50;
const cleanDoc = new Float32Array(moireW * moireH);
cleanDoc.fill(180);
const cleanMoire = detectMoirePattern(cleanDoc, moireW, moireH);
assert(!cleanMoire.hasMoireScreenReplay, 'Clean doc has zero moiré screen replay');

// Simulate LCD screen sub-pixel grid ripple (alternating pattern)
const lcdScreen = new Float32Array(moireW * moireH);
for (let y = 0; y < moireH; y++) {
  for (let x = 0; x < moireW; x++) {
    lcdScreen[y * moireW + x] = 160 + ((x + y) % 2 === 0 ? 15 : -15);
  }
}
const lcdMoire = detectMoirePattern(lcdScreen, moireW, moireH);
assert(lcdMoire.hasMoireScreenReplay, `LCD screen subgrid detected as moiré spoofing (ratio: ${(lcdMoire.highFrequencyRatio * 100).toFixed(1)}%)`);

// 12. Test evaluateQualityGate
const qgW = 50;
const qgH = 50;
const qgRGBA = new Uint8ClampedArray(qgW * qgH * 4);
// Populate realistic sharp document frame
for (let y = 0; y < qgH; y++) {
  for (let x = 0; x < qgW; x++) {
    const idx = (y * qgW + x) * 4;
    const isText = (y % 10 === 0 && x > 5 && x < 45);
    const lum = isText ? 30 : 180;
    qgRGBA[idx] = lum;
    qgRGBA[idx + 1] = lum;
    qgRGBA[idx + 2] = lum;
    qgRGBA[idx + 3] = 255;
  }
}
const qgEval = evaluateQualityGate(qgRGBA, qgW, qgH);
console.log('Quality Gate Evaluation Result:', {
  passed: qgEval.passed,
  score: qgEval.score,
  reasons: qgEval.reasons,
  details: qgEval.details
});

assert(typeof qgEval.passed === 'boolean', 'evaluateQualityGate returns boolean passed');
assert(typeof qgEval.score === 'number' && qgEval.score >= 0 && qgEval.score <= 100, 'Score is in range [0..100]');

console.log('--- ALL 12 VISION PIPELINE TESTS PASSED PERFECTION ---');
