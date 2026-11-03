/**
 * ResQTrack Deterministic ID Scanner - Subagent 3 Classical OCR, CCL & Template Matcher Verification Suite
 * Verifies mathematical correctness and execution integrity of:
 * - ccl.ts
 * - fontBank.ts
 * - glyphMatcher.ts
 * - templateMatch.ts
 *
 * 100% universal lambda syntax, zero 'any', strictly typed.
 */

import {
  findConnectedComponents,
  groupBoundingBoxesIntoLines,
  groupWordsInLine,
} from '../ccl';

import { FONT_BANK } from '../fontBank';

import {
  normalizeGlyphTo16x16,
  computeZoningFeatures,
  matchGlyph,
  recognizeLineText,
} from '../glyphMatcher';

import {
  normalizedCrossCorrelation,
  matchTemplateMultiScale,
} from '../templateMatch';

const assert = (condition: boolean, msg: string): void => {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
};

console.log('========================================================');
console.log('STARTING CLASSICAL OCR, CCL & TEMPLATE MATCHER VERIFICATION');
console.log('========================================================');

// ==========================================
// TEST 1: CCL (Connected Component Labeling)
// ==========================================
console.log('\n--- 1. CCL & 8-Connectivity Verification ---');

const imgW = 40;
const imgH = 30;
const binaryImg = new Uint8Array(imgW * imgH);

// Component A: A 4x4 square at (2, 2) => Area 16
for (let y = 2; y < 6; y++) {
  for (let x = 2; x < 6; x++) {
    binaryImg[y * imgW + x] = 1;
  }
}

// Component B: A diagonal line of 5 pixels (8-connectivity test) from (10, 2) to (14, 6)
for (let i = 0; i < 5; i++) {
  binaryImg[(2 + i) * imgW + (10 + i)] = 1;
}

// Component C: A 5x5 hollow box at (20, 2) => Area 16
for (let x = 20; x < 25; x++) {
  binaryImg[2 * imgW + x] = 1;
  binaryImg[6 * imgW + x] = 1;
}
for (let y = 3; y < 6; y++) {
  binaryImg[y * imgW + 20] = 1;
  binaryImg[y * imgW + 24] = 1;
}

// Component D: Tiny noise pixel at (35, 2) => Area 1 (should be filtered out by minArea = 10)
binaryImg[2 * imgW + 35] = 1;

const cclRes = findConnectedComponents(binaryImg, imgW, imgH, 10, 500);

assert(cclRes.count === 2, `Expected 2 components filtered by minArea=10 (got ${cclRes.count})`);
assert(cclRes.boxes.length === 2, `Bounding boxes length matches count (${cclRes.boxes.length})`);

// Find square component A
const boxA = cclRes.boxes.find((b) => b.x === 2 && b.y === 2);
assert(boxA !== undefined && boxA.w === 4 && boxA.h === 4 && boxA.area === 16, 'Component A correctly segmented with 4x4 bounding box and area 16');

// Find hollow box component C
const boxC = cclRes.boxes.find((b) => b.x === 20 && b.y === 2);
assert(boxC !== undefined && boxC.w === 5 && boxC.h === 5 && boxC.area === 16, 'Component C correctly segmented with 5x5 bounding box');

// Verify 8-connectivity when minArea is small enough to include diagonal line
const cclAll = findConnectedComponents(binaryImg, imgW, imgH, 5, 500);
assert(cclAll.count === 3, `8-connectivity properly linked diagonal line as single component (total: ${cclAll.count})`);
const diagBox = cclAll.boxes.find((b) => b.x === 10 && b.y === 2);
assert(diagBox !== undefined && diagBox.w === 5 && diagBox.h === 5 && diagBox.area === 5, 'Diagonal line 8-connectivity validated');

// ==========================================
// TEST 2: Line Grouping & Word Segmentation
// ==========================================
console.log('\n--- 2. Line Grouping & Word Segmentation Verification ---');

// Simulate 2 lines of characters
// Line 1 at y = 10..22 (height 12)
// Line 2 at y = 35..47 (height 12)
const charBoxes = [
  // Line 1: Word 1 "ID"
  { x: 10, y: 10, w: 8, h: 12 },
  { x: 20, y: 11, w: 8, h: 11 },
  // Line 1: Word 2 "CARD" (gap from 28 to 38 is 10px > 0.6 * 8 = 4.8px)
  { x: 38, y: 10, w: 8, h: 12 },
  { x: 48, y: 12, w: 8, h: 10 },
  { x: 58, y: 10, w: 8, h: 12 },
  { x: 68, y: 11, w: 8, h: 11 },
  // Line 2: "PHILIPPINES"
  { x: 10, y: 35, w: 8, h: 12 },
  { x: 20, y: 36, w: 8, h: 11 },
  { x: 30, y: 35, w: 8, h: 12 },
];

const lines = groupBoundingBoxesIntoLines(charBoxes);
assert(lines.length === 2, `groupBoundingBoxesIntoLines found exactly 2 lines (got ${lines.length})`);
assert(lines[0].charBoxes.length === 6, `Line 1 contains 6 characters (got ${lines[0].charBoxes.length})`);
assert(lines[1].charBoxes.length === 3, `Line 2 contains 3 characters (got ${lines[1].charBoxes.length})`);

// Verify horizontal character ordering
assert(lines[0].charBoxes[0].x === 10 && lines[0].charBoxes[5].x === 68, 'Characters in Line 1 are strictly sorted left-to-right');

// Test word segmentation in Line 1
const words = groupWordsInLine(lines[0]);
assert(words.length === 2, `groupWordsInLine split Line 1 into 2 words across whitespace gap (got ${words.length})`);
assert(words[0].charBoxes.length === 2, `Word 1 has 2 characters (got ${words[0].charBoxes.length})`);
assert(words[1].charBoxes.length === 4, `Word 2 has 4 characters (got ${words[1].charBoxes.length})`);

// ==========================================
// TEST 3: Font Bank Verification
// ==========================================
console.log('\n--- 3. Font Bank Verification ---');

const families = Object.keys(FONT_BANK);
assert(families.includes('standard'), 'FONT_BANK includes standard sans-serif');
assert(families.includes('ocr-b'), 'FONT_BANK includes ocr-b');
assert(families.includes('ocr-a'), 'FONT_BANK includes ocr-a');

for (const fam of families) {
  const templates = FONT_BANK[fam];
  assert(templates.length === 40, `Font '${fam}' contains all 40 glyphs (got ${templates.length})`);

  // Check required characters
  const chars = templates.map((t) => t.char);
  const requiredChars = ['0', '1', '7', '8', '9', 'A', 'B', 'M', 'Z', '-', '/', '<', '.'];
  for (const rc of requiredChars) {
    assert(chars.includes(rc), `Font '${fam}' contains '${rc}'`);
  }

  // Check data structure integrity
  for (const t of templates) {
    assert(t.bits16x16.length === 256, `Glyph '${t.char}' in '${fam}' has 256 bits`);
    assert(t.zoning4x4.length === 16, `Glyph '${t.char}' in '${fam}' has 16 zoning features`);
    assert(t.aspect > 0, `Glyph '${t.char}' in '${fam}' has positive aspect ratio (${t.aspect})`);
  }
}

// ==========================================
// TEST 4: Glyph Matcher Verification
// ==========================================
console.log('\n--- 4. Glyph Matcher Verification ---');

// Test matching a synthetic '0' from OCR-B font bank
const ocrB0 = FONT_BANK['ocr-b'].find((t) => t.char === '0')!;
const matchRes = matchGlyph(ocrB0.bits16x16, ocrB0.aspect);
assert(matchRes.char === '0', `matchGlyph correctly recognized '0' with confidence ${matchRes.confidence}`);
assert(matchRes.confidence >= 0.95, `Confidence on exact template is near 1.0 (got ${matchRes.confidence})`);
assert(matchRes.alternatives.length > 0, 'Alternatives array is populated');

// Test matching 'A'
const stdA = FONT_BANK['standard'].find((t) => t.char === 'A')!;
const matchA = matchGlyph(stdA.bits16x16, stdA.aspect);
assert(matchA.char === 'A', `matchGlyph correctly recognized 'A' with confidence ${matchA.confidence}`);

// Test allowedChars constraint
const ocrA4 = FONT_BANK['ocr-a'].find((t) => t.char === '4')!;
const matchDigitsOnly = matchGlyph(ocrA4.bits16x16, ocrA4.aspect, FONT_BANK, '0123456789');
assert(matchDigitsOnly.char === '4', `matchGlyph with allowedChars='0123456789' matched digit '4'`);

// Test area-preserving resampling normalizeGlyphTo16x16
const synthW = 60;
const synthH = 60;
const synthBinary = new Uint8Array(synthW * synthH);

// Draw a letter 'T' at (10, 10) with width 20, height 30
// Top bar: y = 10..15, x = 10..30
for (let y = 10; y < 15; y++) {
  for (let x = 10; x < 30; x++) {
    synthBinary[y * synthW + x] = 1;
  }
}
// Stem: y = 15..40, x = 18..22
for (let y = 15; y < 40; y++) {
  for (let x = 18; x < 22; x++) {
    synthBinary[y * synthW + x] = 1;
  }
}

const normT = normalizeGlyphTo16x16(synthBinary, synthW, { x: 10, y: 10, w: 20, h: 30 });
assert(normT.length === 256, 'Normalized glyph has length 256');

// Zoning features on normT
const zoningT = computeZoningFeatures(normT);
assert(zoningT.length === 16, 'computeZoningFeatures produces 16 elements');
// Top cells should have higher density than bottom corners
const topCenter = zoningT[1] + zoningT[2];
const bottomCorners = zoningT[12] + zoningT[15];
assert(topCenter > bottomCorners, 'Zoning correctly reflects mass of T (top heavy vs bottom corners)');

// Match the extracted 'T'
const matchExtractedT = matchGlyph(normT, 20 / 30);
assert(matchExtractedT.char === 'T', `Extracted glyph normalized and matched as 'T' with confidence ${matchExtractedT.confidence}`);

// Test recognizeLineText
const lineTextResult = recognizeLineText(
  synthBinary,
  synthW,
  [{ x: 10, y: 10, w: 20, h: 30 }],
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
);
assert(lineTextResult.text === 'T', `recognizeLineText returned '${lineTextResult.text}'`);
assert(lineTextResult.confidence > 0.55, `Line confidence is strong (${lineTextResult.confidence})`);

// ==========================================
// TEST 5: NCC Template Matcher Verification
// ==========================================
console.log('\n--- 5. Template Matcher Verification ---');

const searchW = 50;
const searchH = 50;
const searchImage = new Float32Array(searchW * searchH);

// Add uniform background intensity 0.2
searchImage.fill(0.2);

// Create a distinctive 10x10 cross template
const tSize = 10;
const tplData = new Float32Array(tSize * tSize);
for (let y = 0; y < tSize; y++) {
  for (let x = 0; x < tSize; x++) {
    const isCross = (x >= 4 && x <= 5) || (y >= 4 && y <= 5);
    tplData[y * tSize + x] = isCross ? 1.0 : 0.0;
  }
}

// Embed template at exact coordinate (18, 22) in searchImage
for (let y = 0; y < tSize; y++) {
  for (let x = 0; x < tSize; x++) {
    searchImage[(22 + y) * searchW + (18 + x)] = tplData[y * tSize + x];
  }
}

// Run Normalized Cross-Correlation
const nccMatch = normalizedCrossCorrelation(searchImage, searchW, searchH, tplData, tSize, tSize);

assert(nccMatch.bestX === 18 && nccMatch.bestY === 22, `NCC located exact template coordinates (got ${nccMatch.bestX}, ${nccMatch.bestY})`);
assert(nccMatch.maxCorr >= 0.99, `NCC correlation coefficient at peak is near 1.0 (got ${nccMatch.maxCorr})`);

// Test with Region of Interest (ROI) containing target
const roi = { x: 15, y: 20, w: 20, h: 20 };
const nccRoiMatch = normalizedCrossCorrelation(searchImage, searchW, searchH, tplData, tSize, tSize, roi);
assert(nccRoiMatch.bestX === 18 && nccRoiMatch.bestY === 22, `NCC with ROI found target at (18, 22)`);

// Test Multi-scale template matching
const multiScaleRes = matchTemplateMultiScale(
  searchImage,
  searchW,
  searchH,
  tplData,
  tSize,
  tSize,
  [0.8, 1.0, 1.2]
);
assert(multiScaleRes.scale === 1.0, `MultiScale correctly identified 1.0 as optimal scale (got ${multiScaleRes.scale})`);
assert(multiScaleRes.x === 18 && multiScaleRes.y === 22, `MultiScale located target at (18, 22)`);
assert(multiScaleRes.score >= 0.99, `MultiScale score is near 1.0 (got ${multiScaleRes.score})`);

console.log('\n========================================================');
console.log('ALL CLASSICAL OCR, CCL & TEMPLATE MATCH TESTS PASSED!');
console.log('========================================================\n');
