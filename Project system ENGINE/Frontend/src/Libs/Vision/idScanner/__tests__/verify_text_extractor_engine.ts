// [Layer: Test/Libs/Vision/idScanner]
// Responsibility: Comprehensive TDD verification suite for the On-Device Text Extractor Engine.
// Verifies all 4 PowerToys / Windows.Media.Ocr architecture phases:
// 1. Image Capture & ROI Isolation
// 2. Image Preprocessing & Normalization (DPI scaling, contrast stretching, Sauvola binarization)
// 3. Line/Table Detection & Character Segmentation (Horizontal & Vertical Projection Profiling + CCA)
// 4. Pattern Matching & Disambiguated Recognition (Context whitelisting & confusions repair)
// Strict TypeScript, ZERO 'any', 100% universal lambdas (=>).

import {
  extractRoiBuffer,
  stretchContrast,
  preprocessTextRoi,
  findLineBandsByProjection,
  segmentLineGlyphs,
  getCharTypeAllowedChars,
  postProcessFieldText,
  extractTextFromRoi,
  extractFieldText,
  sanitizeOcrTextAndLigatures,
  sortBoxesByToleranceReadingOrder,
  parseIdFieldsWithSpatialFsm,
  isPascalCaseLabel,
  parseFieldsByPascalCaseIndications
} from '../textExtractor';
import { FONT_BANK } from '../fontBank';
import type { FieldCropSpec } from '../idSpecs';

const assert = (condition: boolean, msg: string): void => {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
};

/**
 * Generates synthetic RGBA buffer with rendered high-contrast text strokes.
 */
const createSyntheticTextRgba = (
  width: number,
  height: number,
  texts: string[]
): Uint8ClampedArray => {
  const buffer = new Uint8ClampedArray(width * height * 4);
  // Fill background with light card color (RGB 230, 230, 230)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    buffer[idx] = 230;
    buffer[idx + 1] = 230;
    buffer[idx + 2] = 230;
    buffer[idx + 3] = 255;
  }

  const standardFont = FONT_BANK['standard'] || [];
  const glyphMap = new Map<string, (typeof standardFont)[0]>();
  for (const g of standardFont) {
    glyphMap.set(g.char, g);
  }

  const lineHeight = 16;
  const startY = Math.floor((height - texts.length * lineHeight) / 2);

  for (let lineIdx = 0; lineIdx < texts.length; lineIdx++) {
    const lineText = texts[lineIdx];
    let curX = 10;
    const curY = startY + lineIdx * lineHeight;

    for (let c = 0; c < lineText.length; c++) {
      const ch = lineText[c];
      if (ch === ' ') {
        curX += 14;
        continue;
      }

      const template = glyphMap.get(ch);
      if (template) {
        let minGx = 16;
        let maxGx = 0;
        for (let gy = 0; gy < 16; gy++) {
          for (let gx = 0; gx < 16; gx++) {
            if (template.bits16x16[gy * 16 + gx] > 0) {
              if (gx < minGx) minGx = gx;
              if (gx > maxGx) maxGx = gx;
            }
          }
        }

        if (minGx <= maxGx) {
          for (let gy = 0; gy < 16; gy++) {
            for (let gx = minGx; gx <= maxGx; gx++) {
              if (template.bits16x16[gy * 16 + gx] > 0) {
                const px = curX + (gx - minGx);
                const py = curY + gy;
                if (px >= 0 && px < width && py >= 0 && py < height) {
                  const pIdx = (py * width + px) * 4;
                  buffer[pIdx] = 20;
                  buffer[pIdx + 1] = 20;
                  buffer[pIdx + 2] = 20;
                  buffer[pIdx + 3] = 255;
                }
              }
            }
          }
          curX += (maxGx - minGx + 1) + 2;
        } else {
          curX += 12;
        }
      } else {
        curX += 12;
      }
    }
  }

  return buffer;
};

// ============================================================================
// SUITE 1: Phase 1 - ROI Isolation & Exact Pixel Buffer Extraction
// ============================================================================
console.log('\n--- 1. Testing Image Capture & ROI Isolation ---');

const srcW = 200;
const srcH = 100;
const fullImageRgba = new Uint8ClampedArray(srcW * srcH * 4);
// Fill with test gradient
for (let y = 0; y < srcH; y++) {
  for (let x = 0; x < srcW; x++) {
    const idx = (y * srcW + x) * 4;
    fullImageRgba[idx] = x;
    fullImageRgba[idx + 1] = y;
    fullImageRgba[idx + 2] = 128;
    fullImageRgba[idx + 3] = 255;
  }
}

// Test pixel coordinates ROI
const pixelCrop = extractRoiBuffer(fullImageRgba, srcW, srcH, {
  x: 20,
  y: 30,
  width: 50,
  height: 40
});
assert(pixelCrop.width === 50, 'ROI isolation crops correct pixel width: 50');
assert(pixelCrop.height === 40, 'ROI isolation crops correct pixel height: 40');
assert(pixelCrop.buffer.length === 50 * 40 * 4, 'ROI isolation produces exact buffer byte length');

// Check pixel values at (0, 0) in crop match (20, 30) in source
assert(pixelCrop.buffer[0] === 20, 'Pixel (0,0) in crop matches source X=20');
assert(pixelCrop.buffer[1] === 30, 'Pixel (0,0) in crop matches source Y=30');

// Test normalized relative coordinates [0..1]
const relCrop = extractRoiBuffer(fullImageRgba, srcW, srcH, {
  x: 0.1,
  y: 0.2,
  w: 0.5,
  h: 0.4
});
assert(relCrop.width === 100, 'Normalized ROI crops correct scaled width: 100 (0.5 * 200)');
assert(relCrop.height === 40, 'Normalized ROI crops correct scaled height: 40 (0.4 * 100)');

// Test boundary clamping
const clampedCrop = extractRoiBuffer(fullImageRgba, srcW, srcH, {
  x: 180,
  y: 80,
  width: 50, // exceeds 200
  height: 50 // exceeds 100
});
assert(clampedCrop.width === 20, 'Clamped ROI width stops at right boundary (200 - 180 = 20)');
assert(clampedCrop.height === 20, 'Clamped ROI height stops at bottom boundary (100 - 80 = 20)');

// ============================================================================
// SUITE 2: Phase 2 - Preprocessing, Normalization & DPI Scaling
// ============================================================================
console.log('\n--- 2. Testing Preprocessing, Normalization & DPI Scaling ---');

// Contrast stretching test
const testGray = new Float32Array([100, 120, 140, 160, 180]);
const stretched = stretchContrast(testGray, 5, 1);
assert(stretched[0] === 0, 'Contrast stretching normalizes minimum value to 0');
assert(Math.round(stretched[4]) === 255, 'Contrast stretching normalizes maximum value to 255');

// DPI scaling & Sauvola adaptive binarization test on small text
const smallTextRgba = createSyntheticTextRgba(80, 20, ['123']);
const preprocessed = preprocessTextRoi(smallTextRgba, 80, 20, { minDpiScale: 2.5 });

assert(preprocessed.scaleFactor >= 2.5, `DPI scaling upscaled small text by factor >= 2.5 (got ${preprocessed.scaleFactor})`);
assert(preprocessed.width >= 200, `Preprocessed width upscaled to >= 200px (got ${preprocessed.width})`);
assert(preprocessed.height >= 50, `Preprocessed height upscaled to >= 50px (got ${preprocessed.height})`);
assert(preprocessed.binary.length === preprocessed.width * preprocessed.height, 'Binary mask matches upscaled dimensions');

// Verify binary contains both foreground (255) and background (0)
let fgCount = 0;
let bgCount = 0;
for (let i = 0; i < preprocessed.binary.length; i++) {
  if (preprocessed.binary[i] === 255) fgCount++;
  else if (preprocessed.binary[i] === 0) bgCount++;
}
assert(fgCount > 0, `Sauvola adaptive threshold extracted foreground text strokes (count: ${fgCount})`);
assert(bgCount > 0, `Sauvola adaptive threshold preserved card background (count: ${bgCount})`);

// ============================================================================
// SUITE 3: Phase 3 - Horizontal & Vertical Projection Profiling + Line/Table
// ============================================================================
console.log('\n--- 3. Testing Projection Profiling & Segmentation ---');

const multiLineRgba = createSyntheticTextRgba(240, 60, ['SANTOS', 'MANUKAN']);
const multiLinePreproc = preprocessTextRoi(multiLineRgba, 240, 60, { minDpiScale: 1.0 });

// Horizontal Projection Profiling
const bands = findLineBandsByProjection(
  multiLinePreproc.binary,
  multiLinePreproc.width,
  multiLinePreproc.height
);
assert(bands.length === 2, `Horizontal projection profiling segmented exactly 2 text lines (got ${bands.length})`);
assert(bands[1].top > bands[0].bottom, 'Line bands are vertically ordered top-to-bottom');

// Vertical Projection Profiling on Line 1
const line1Glyphs = segmentLineGlyphs(
  multiLinePreproc.binary,
  multiLinePreproc.width,
  multiLinePreproc.height,
  bands[0].top,
  bands[0].bottom
);
assert(line1Glyphs.charBoxes.length === 6, `Vertical projection profiling isolated 6 characters for 'SANTOS' (got ${line1Glyphs.charBoxes.length})`);

// Test whitespace gap detection
const phraseRgba = createSyntheticTextRgba(300, 30, ['JUAN DELA CRUZ']);
const phrasePreproc = preprocessTextRoi(phraseRgba, 300, 30, { minDpiScale: 1.0 });
const phraseBands = findLineBandsByProjection(phrasePreproc.binary, phrasePreproc.width, phrasePreproc.height);
const phraseGlyphs = segmentLineGlyphs(
  phrasePreproc.binary,
  phrasePreproc.width,
  phrasePreproc.height,
  phraseBands[0].top,
  phraseBands[0].bottom
);
assert(phraseGlyphs.wordGaps.length === 2, `Vertical projection profiling detected 2 whitespace gaps between 3 words (got ${phraseGlyphs.wordGaps.length})`);

// ============================================================================
// SUITE 4: Phase 4 - Pattern Matching, Whitelisting & Optical Repairs
// ============================================================================
console.log('\n--- 4. Testing Pattern Matching & Optical Repairs ---');

// Test character type whitelist maps
assert(getCharTypeAllowedChars('NUMERIC') === '0123456789-.', 'Numeric whitelist strictly contains digits and separators');
assert(getCharTypeAllowedChars('ALPHA').includes('A') && !getCharTypeAllowedChars('ALPHA').includes('1'), 'Alpha whitelist excludes numeric digits');

// Test optical disambiguation repairs
const repairedNumeric = postProcessFieldText('DO2-I9-OIZ34S', 'NUMERIC');
assert(repairedNumeric === '002-19-012345', `postProcessFieldText repaired 'DO2-I9-OIZ34S' to '002-19-012345' (got ${repairedNumeric})`);

const repairedDate = postProcessFieldText('2O24/O9/IS', 'DATE');
assert(repairedDate === '2024/09/15', `postProcessFieldText repaired '2O24/O9/IS' to '2024/09/15' (got ${repairedDate})`);

const repairedAlpha = postProcessFieldText('5ANT05', 'ALPHA');
assert(repairedAlpha === 'SANTOS', `postProcessFieldText repaired '5ANT05' to 'SANTOS' (got ${repairedAlpha})`);

// ============================================================================
// SUITE 5: End-to-End Synthetic ID Card Text Extraction
// ============================================================================
console.log('\n--- 5. Testing End-to-End Text Extractor Pipeline ---');

// 1. Synthetic Name Field ("SANTOS")
const nameRgba = createSyntheticTextRgba(200, 40, ['SANTOS']);
const nameResult = extractTextFromRoi(
  nameRgba,
  200,
  40,
  { x: 0, y: 0, w: 1.0, h: 1.0 },
  { charType: 'ALPHA' }
);
assert(nameResult.text === 'SANTOS', `extractTextFromRoi successfully extracted 'SANTOS' (got '${nameResult.text}')`);
assert(nameResult.confidence >= 0.55, `Name extraction achieved confidence: ${nameResult.confidence}`);

// 2. Synthetic Number Field ("123456")
const numRgba = createSyntheticTextRgba(200, 40, ['123456']);
const numResult = extractTextFromRoi(
  numRgba,
  200,
  40,
  { x: 0, y: 0, w: 1.0, h: 1.0 },
  { charType: 'NUMERIC' }
);
assert(numResult.text === '123456', `extractTextFromRoi successfully extracted '123456' (got '${numResult.text}')`);

// 3. Multi-line Address with table/multi-line layout mode
const addrRgba = createSyntheticTextRgba(300, 60, ['POBLACION', 'MANUKAN']);
const multiLineResult = extractTextFromRoi(
  addrRgba,
  300,
  60,
  { x: 0, y: 0, w: 1.0, h: 1.0 },
  { layoutMode: 'multi-line' }
);
assert(multiLineResult.text.includes('\n'), 'Multi-line layout mode preserved newline break between lines');
assert(multiLineResult.lines.length === 2, `Multi-line mode returned 2 extracted lines (got ${multiLineResult.lines.length})`);

// 4. extractFieldText helper
const mockFieldSpec: FieldCropSpec = {
  fieldKey: 'lastName',
  label: 'Last Name',
  relativeRoi: { x: 0, y: 0, w: 1.0, h: 1.0 },
  expectedCharType: 'ALPHA',
  regexPattern: /^[A-Z]+$/,
  required: true
};
const fieldRes = extractFieldText(nameRgba, 200, 40, mockFieldSpec);
assert(fieldRes.text === 'SANTOS', `extractFieldText extracted 'SANTOS' with confidence ${fieldRes.confidence}`);

// ============================================================================
// SUITE 6: Reference-Synthesized Enhancements (pdftext & textricator FSM)
// ============================================================================
console.log('\n--- 6. Testing Ligature Sanitizer, Tolerance Reading-Order Sorter & Spatial FSM ---');

const rawLigatures = 'O\uFB03CIAL \uFB01LE \uFB02AG\x07 ZAMBO-\nANGA';
const sanitizedLig = sanitizeOcrTextAndLigatures(rawLigatures, true);
assert(
  sanitizedLig === 'OFFICIAL FILE FLAG ZAMBOANGA',
  `sanitizeOcrTextAndLigatures unfolded ligatures, stripped control char, and joined hyphen wrap (got '${sanitizedLig}')`
);

const jitteredBoxes = [
  { id: 'B', x: 120, y: 22 },
  { id: 'A', x: 20, y: 19 },
  { id: 'D', x: 140, y: 48 },
  { id: 'C', x: 15, y: 51 }
];
const sortedBoxes = sortBoxesByToleranceReadingOrder(jitteredBoxes, 6);
assert(
  sortedBoxes.map((b) => b.id).join('') === 'ABCD',
  `sortBoxesByToleranceReadingOrder bucketed jittered Y-lines into ABCD reading order (got '${sortedBoxes.map((b) => b.id).join('')}')`
);

const fsmSampleText = [
  'REPUBLIC OF THE PHILIPPINES',
  'LAND TRANSPORTATION OFFICE',
  'LAST NAME, FIRST NAME, MIDDLE NAME',
  'SUICO, JHONMARK AMACA',
  'DATE OF BIRTH: 2004/09/15',
  'SEX: MALE',
  'LICENSE NO.',
  'J07-22-012360',
  'ADDRESS',
  'POBLACION, MANUKAN, ZAMBOANGA DEL NORTE'
].join('\n');

const fsmFields = parseIdFieldsWithSpatialFsm(fsmSampleText);
assert(fsmFields.lastName === 'SUICO', `Spatial FSM extracted lastName='SUICO' (got '${fsmFields.lastName}')`);
assert(fsmFields.firstName === 'JHONMARK', `Spatial FSM extracted firstName='JHONMARK' (got '${fsmFields.firstName}')`);
assert(fsmFields.middleName === 'AMACA', `Spatial FSM extracted middleName='AMACA' (got '${fsmFields.middleName}')`);
assert(fsmFields.birthDate === '2004/09/15', `Spatial FSM extracted birthDate='2004/09/15' (got '${fsmFields.birthDate}')`);
assert(fsmFields.sex === 'MALE', `Spatial FSM extracted sex='MALE' (got '${fsmFields.sex}')`);
assert(fsmFields.idNumber === 'J07-22-012360', `Spatial FSM extracted idNumber='J07-22-012360' (got '${fsmFields.idNumber}')`);
assert(
  fsmFields.address?.includes('POBLACION, MANUKAN, ZAMBOANGA DEL NORTE') === true,
  `Spatial FSM extracted address (got '${fsmFields.address}')`
);

// ============================================================================
// SUITE 7: PascalCase Indication-to-Target Training Verification
// ============================================================================
console.log('\n--- 7. Testing PascalCase Indication-to-Target Training (8 Mandatory + 6 Optional) ---');

assert(isPascalCaseLabel('Nationality') === true, 'isPascalCaseLabel recognizes Nationality');
assert(isPascalCaseLabel('Sex') === true, 'isPascalCaseLabel recognizes Sex');
assert(isPascalCaseLabel('Date of Birth') === true, 'isPascalCaseLabel recognizes Date of Birth');
assert(isPascalCaseLabel('Weight(kg)') === true, 'isPascalCaseLabel recognizes Weight(kg)');
assert(isPascalCaseLabel('Height(m)') === true, 'isPascalCaseLabel recognizes Height(m)');
assert(isPascalCaseLabel('Address') === true, 'isPascalCaseLabel recognizes Address');
assert(isPascalCaseLabel('License No.') === true, 'isPascalCaseLabel recognizes License No.');
assert(isPascalCaseLabel('Last Name, First Name, Middle Name') === true, 'isPascalCaseLabel recognizes Last Name, First Name, Middle Name');
assert(isPascalCaseLabel('Expiration Date') === true, 'isPascalCaseLabel recognizes Expiration Date');
assert(isPascalCaseLabel('Agency Code') === true, 'isPascalCaseLabel recognizes Agency Code');
assert(isPascalCaseLabel('Blood Type') === true, 'isPascalCaseLabel recognizes Blood Type');
assert(isPascalCaseLabel('Eyes Color') === true, 'isPascalCaseLabel recognizes Eyes Color');
assert(isPascalCaseLabel('DL Codes') === true, 'isPascalCaseLabel recognizes DL Codes');
assert(isPascalCaseLabel('Conditions') === true, 'isPascalCaseLabel recognizes Conditions');
assert(isPascalCaseLabel('SUICO, JHONMARK AMACA') === false, 'isPascalCaseLabel does NOT flag ALL-CAPS user data');
assert(isPascalCaseLabel('J07-22-302560') === false, 'isPascalCaseLabel does NOT flag License No. data');

const pascalSampleCard = [
  'REPUBLIC OF THE PHILIPPINES',
  'DEPARTMENT OF TRANSPORTATION',
  'LAND TRANSPORTATION OFFICE',
  "DRIVER'S LICENSE",
  'Last Name, First Name, Middle Name',
  'SUICO, JHONMARK AMACA',
  'Nationality Sex Date of Birth Weight(kg) Height(m)',
  'PHL M 2004/02/20 52 1.71',
  'Address',
  '-, -, POBLACION, MANUKAN, ZAMBOANGA DEL',
  'NORTE, 7110',
  'License No. Expiration Date Agency Code',
  'J07-22-302560 2027/02/20 J07',
  'Blood Type Eyes Color',
  '- BLACK',
  'DL Codes Conditions',
  'A,A1,B,B1,B2 NONE'
].join('\n');

const pascalParsed = parseFieldsByPascalCaseIndications(pascalSampleCard);
assert(pascalParsed.lastName === 'SUICO', `PascalCase parser extracted lastName='SUICO' (got '${pascalParsed.lastName}')`);
assert(pascalParsed.firstName === 'JHONMARK', `PascalCase parser extracted firstName='JHONMARK' (got '${pascalParsed.firstName}')`);
assert(pascalParsed.middleName === 'AMACA', `PascalCase parser extracted middleName='AMACA' (got '${pascalParsed.middleName}')`);
assert(pascalParsed.nationality === 'PHL', `PascalCase parser extracted nationality='PHL' (got '${pascalParsed.nationality}')`);
assert(pascalParsed.sex === 'MALE', `PascalCase parser extracted sex='MALE' (got '${pascalParsed.sex}')`);
assert(pascalParsed.birthDate === '2004/02/20', `PascalCase parser extracted birthDate='2004/02/20' (got '${pascalParsed.birthDate}')`);
assert(pascalParsed.weight === '52', `PascalCase parser extracted weight='52' (got '${pascalParsed.weight}')`);
assert(pascalParsed.height === '1.71', `PascalCase parser extracted height='1.71' (got '${pascalParsed.height}')`);
assert(
  pascalParsed.address === '-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110',
  `PascalCase parser extracted address='-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110' (got '${pascalParsed.address}')`
);
assert(pascalParsed.idNumber === 'J07-22-302560', `PascalCase parser extracted idNumber='J07-22-302560' (got '${pascalParsed.idNumber}')`);
assert(pascalParsed.expirationDate === '2027/02/20', `PascalCase parser extracted expirationDate='2027/02/20' (got '${pascalParsed.expirationDate}')`);
assert(pascalParsed.agencyCode === 'J07', `PascalCase parser extracted agencyCode='J07' (got '${pascalParsed.agencyCode}')`);
assert(pascalParsed.bloodType === '-', `PascalCase parser extracted bloodType='-' (got '${pascalParsed.bloodType}')`);
assert(pascalParsed.eyesColor === 'BLACK', `PascalCase parser extracted eyesColor='BLACK' (got '${pascalParsed.eyesColor}')`);
assert(pascalParsed.dlCodes === 'A,A1,B,B1,B2', `PascalCase parser extracted dlCodes='A,A1,B,B1,B2' (got '${pascalParsed.dlCodes}')`);
assert(pascalParsed.conditions === 'NONE', `PascalCase parser extracted conditions='NONE' (got '${pascalParsed.conditions}')`);

console.log('\n========================================================');
console.log('ALL TEXT EXTRACTOR (POWERTOYS SPEC) TESTS PASSED (100%)');
console.log('========================================================\n');
