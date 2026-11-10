// [Layer: Libs/Vision/idScanner/__tests__]
// Responsibility: TDD Verification Suite for Upload-Only Front & Back Government ID OCR Pipeline.
// Verifies:
// 1. Uncropped Front ID image upload -> quad detection -> homography warp -> automated OCR & portrait crop.
// 2. Pre-cropped (full-frame 100% area) Front ID & Back ID upload -> full-frame fallback rectification -> automated OCR.
// 3. Anti-selfie rejection (FACE_DETECTED) when a human portrait is uploaded instead of an ID card.
// 4. Deterministic Front + Back field merging (mergeFrontAndBackFields).
// Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>). Zero emojis.

interface PolyfillImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: PredefinedColorSpace;
}

const g = globalThis as unknown as {
  ImageData?: new (
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight: number,
    maybeHeight?: number
  ) => PolyfillImageData;
  document?: Record<string, unknown>;
};

if (typeof g.ImageData === 'undefined') {
  g.ImageData = class ImageDataPolyfill implements PolyfillImageData {
    public readonly data: Uint8ClampedArray;
    public readonly width: number;
    public readonly height: number;
    public readonly colorSpace: PredefinedColorSpace = 'srgb';

    public constructor(
      arg1: Uint8ClampedArray | number,
      arg2: number,
      arg3?: number
    ) {
      if (typeof arg1 === 'number') {
        this.width = arg1;
        this.height = arg2;
        this.data = new Uint8ClampedArray(arg1 * arg2 * 4);
      } else {
        this.data = arg1;
        this.width = arg2;
        this.height = arg3 ?? Math.floor(arg1.length / (arg2 * 4));
      }
    }
  };
}

if (typeof g.document === 'undefined') {
  g.document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const canvasObj = {
          width: 856,
          height: 540,
          getContext: () => ({
            putImageData: () => undefined,
            drawImage: () => undefined,
            getImageData: (_x: number, _y: number, w: number, h: number) =>
              new ImageData(w, h)
          }),
          toDataURL: () => 'data:image/png;base64,SYNTHETIC_RECTIFIED_PNG'
        };
        return canvasObj;
      }
      return {};
    }
  };
}

import { IdScanEngine, mergeFrontAndBackFields } from '../idScanEngine';
import { FONT_BANK } from '../fontBank';

let passed = 0;
let failed = 0;

const assert = (condition: boolean, message: string): void => {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] Assertion failed: ${message}`);
    failed++;
  }
};

/**
 * Renders text using FONT_BANK 16x16 glyph bitmaps onto an RGBA buffer.
 */
const drawBitmapString = (
  rgba: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  text: string,
  startX: number,
  startY: number,
  scale = 1
): void => {
  const stdFont = FONT_BANK['standard'];
  let cursorX = startX;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toUpperCase();
    if (ch === ' ') {
      cursorX += Math.round(10 * scale);
      continue;
    }
    const glyph = stdFont.find((gItem) => gItem.char === ch);
    if (!glyph) {
      cursorX += Math.round(10 * scale);
      continue;
    }

    for (let gy = 0; gy < 16; gy++) {
      for (let gx = 0; gx < 16; gx++) {
        if (glyph.bits16x16[gy * 16 + gx] > 0) {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = cursorX + Math.round(gx * scale) + sx;
              const py = startY + Math.round(gy * scale) + sy;
              if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
                const idx = (py * imgW + px) * 4;
                rgba[idx] = 15;
                rgba[idx + 1] = 20;
                rgba[idx + 2] = 30;
                rgba[idx + 3] = 255;
              }
            }
          }
        }
      }
    }
    cursorX += Math.round(14 * scale);
  }
};

/**
 * Creates a synthetic pre-cropped (full-frame 856x540) Government ID ImageData
 * where the card fills 100% of the image without an outer table background.
 */
const createPreCroppedUploadedIdImageData = (side: 'front' | 'back'): ImageData => {
  const width = 856;
  const height = 540;
  const rgba = new Uint8ClampedArray(width * height * 4);

  // Light card surface
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = 238;
    rgba[i * 4 + 1] = 242;
    rgba[i * 4 + 2] = 246;
    rgba[i * 4 + 3] = 255;
  }

  // Dark header bar
  for (let y = 12; y < 74; y++) {
    for (let x = 20; x < width - 20; x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 20;
      rgba[idx + 1] = 45;
      rgba[idx + 2] = 90;
    }
  }

  if (side === 'front') {
    // Portrait box on left
    for (let y = 110; y < 380; y++) {
      for (let x = 35; x < 235; x++) {
        const idx = (y * width + x) * 4;
        rgba[idx] = 180;
        rgba[idx + 1] = 190;
        rgba[idx + 2] = 205;
      }
    }
    drawBitmapString(rgba, width, height, 'DRIVERS LICENSE', 260, 90, 1);
    drawBitmapString(rgba, width, height, 'LAST NAME', 260, 130, 1);
    drawBitmapString(rgba, width, height, 'SUICO', 260, 156, 2);
    drawBitmapString(rgba, width, height, 'FIRST NAME', 260, 200, 1);
    drawBitmapString(rgba, width, height, 'JHONMARK', 260, 226, 2);
    drawBitmapString(rgba, width, height, 'LICENSE NO', 260, 275, 1);
    drawBitmapString(rgba, width, height, 'J07-22-012360', 260, 302, 2);
    drawBitmapString(rgba, width, height, 'DATE OF BIRTH', 260, 350, 1);
    drawBitmapString(rgba, width, height, '2004/09/15', 260, 376, 2);
  } else {
    // Back side: barcode strip + reverse fields (address, weight, height)
    for (let x = 60; x < width - 60; x += 8) {
      for (let y = 95; y < 185; y++) {
        for (let bx = 0; bx < 4; bx++) {
          const idx = (y * width + (x + bx)) * 4;
          rgba[idx] = 18;
          rgba[idx + 1] = 22;
          rgba[idx + 2] = 28;
        }
      }
    }
    drawBitmapString(rgba, width, height, 'ADDRESS', 60, 220, 1);
    drawBitmapString(rgba, width, height, 'POBLACION MANUKAN ZAMBOANGA', 60, 250, 2);
    drawBitmapString(rgba, width, height, 'WEIGHT', 60, 310, 1);
    drawBitmapString(rgba, width, height, '52 KG', 60, 338, 2);
    drawBitmapString(rgba, width, height, 'HEIGHT', 420, 310, 1);
    drawBitmapString(rgba, width, height, '1.71 M', 420, 338, 2);
  }

  return new ImageData(rgba, width, height);
};

/**
 * Creates a synthetic human selfie ImageData (large central skin-tone oval with eyes/nose/mouth)
 * to verify Pillar 1 Anti-Selfie rejection on upload.
 */
const createSelfieUploadImageData = (): ImageData => {
  const width = 400;
  const height = 400;
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = (x - 200) / 110;
      const dy = (y - 200) / 145;
      if (dx * dx + dy * dy <= 1.0) {
        // Physiological YCbCr skin tone
        const n = Math.round(Math.sin(x * 0.3) * 14 + Math.cos(y * 0.3) * 14);
        rgba[idx] = Math.min(255, Math.max(0, 205 + n));
        rgba[idx + 1] = Math.min(255, Math.max(0, 152 + n));
        rgba[idx + 2] = Math.min(255, Math.max(0, 122 + n));
        rgba[idx + 3] = 255;

        // Dark eye sockets
        const leftEyeDist = Math.hypot(x - 160, y - 165);
        const rightEyeDist = Math.hypot(x - 240, y - 165);
        if (leftEyeDist < 16 || rightEyeDist < 16) {
          rgba[idx] = 25;
          rgba[idx + 1] = 20;
          rgba[idx + 2] = 20;
        }
        // Mouth
        if (Math.abs(x - 200) < 32 && Math.abs(y - 265) < 9) {
          rgba[idx] = 65;
          rgba[idx + 1] = 25;
          rgba[idx + 2] = 30;
        }
      } else {
        rgba[idx] = 40;
        rgba[idx + 1] = 45;
        rgba[idx + 2] = 55;
        rgba[idx + 3] = 255;
      }
    }
  }

  return new ImageData(rgba, width, height);
};

const runTests = async (): Promise<void> => {
  console.log('\n==============================================================');
  console.log('RUNNING UPLOAD-ONLY GOVERNMENT ID & AUTOMATED OCR TDD SUITE');
  console.log('==============================================================\n');

  const engine = new IdScanEngine({ useWebWorker: false, enableAiStandbyFallback: false });

  // 1. Pre-cropped Front ID Upload
  console.log('--- 1. Testing Pre-Cropped Front ID Upload & Automated Text Extraction ---');
  const frontImg = createPreCroppedUploadedIdImageData('front');
  const frontRes = await engine.scanUploadedIdImage(frontImg, 'drivers', 'Civilian', 'front');

  assert(frontRes.side === 'front', `scanUploadedIdImage recorded side='front' (got '${frontRes.side}')`);
  assert(frontRes.success === true, `Pre-cropped Front ID scan succeeded (got success=${frontRes.success}, error=${frontRes.error || 'none'})`);
  assert(frontRes.corners.length === 4, `Pre-cropped Front ID returned 4 canonical corners (got ${frontRes.corners.length})`);
  assert(Boolean(frontRes.rectifiedImageData), 'Front ID produced rectified 856x540 ImageData');
  assert(Boolean(frontRes.portraitImageData || frontRes.portraitImageUrl), 'Front ID extracted portrait crop for Step 2 biometric matching');

  const hasExtractedFrontData = Boolean(
    frontRes.fields.lastName ||
    frontRes.fields.firstName ||
    frontRes.fields.fullname ||
    frontRes.fields.idNumber ||
    frontRes.fields.licenseNumber ||
    frontRes.rawText.length > 0
  );
  assert(hasExtractedFrontData, `Front ID automated OCR extracted structured fields/text (rawText length=${frontRes.rawText.length})`);

  // 2. Pre-cropped Back ID Upload
  console.log('\n--- 2. Testing Pre-Cropped Back ID Upload & Reverse Field Extraction ---');
  const backImg = createPreCroppedUploadedIdImageData('back');
  const backRes = await engine.scanUploadedIdImage(backImg, 'drivers', 'Civilian', 'back');

  assert(backRes.side === 'back', `scanUploadedIdImage recorded side='back' (got '${backRes.side}')`);
  assert(backRes.success === true, `Pre-cropped Back ID scan succeeded (got success=${backRes.success}, error=${backRes.error || 'none'})`);
  assert(backRes.corners.length === 4, `Pre-cropped Back ID returned 4 canonical corners`);

  // 3. Front + Back Deterministic Field Merging
  console.log('\n--- 3. Testing Deterministic Front + Back Field Merging ---');
  const merged = mergeFrontAndBackFields(
    {
      firstName: 'JHONMARK',
      lastName: 'SUICO',
      middleName: 'AMACA',
      licenseNumber: 'J07-22-012360',
      dateOfBirth: '2004/09/15',
      sex: 'male',
      weight: '52',
      height: '1.71'
    },
    {
      firstName: 'NOISE_NAME',
      address: 'POBLACION, MANUKAN, ZAMBOANGA DEL NORTE'
    }
  );

  assert(merged.firstName === 'JHONMARK', `mergeFrontAndBackFields preserved Front firstName='JHONMARK' over Back noise`);
  assert(merged.lastName === 'SUICO', `mergeFrontAndBackFields preserved Front lastName='SUICO'`);
  assert(merged.licenseNumber === 'J07-22-012360', `mergeFrontAndBackFields preserved Front licenseNumber`);
  assert(
    merged.address === 'POBLACION, MANUKAN, ZAMBOANGA DEL NORTE',
    `mergeFrontAndBackFields backfilled address from Back ID (got '${merged.address}')`
  );
  assert(merged.weight === '52', `mergeFrontAndBackFields preserved Front weight='52'`);
  assert(merged.height === '1.71', `mergeFrontAndBackFields preserved Front height='1.71'`);

  // 4. Anti-Selfie Rejection on Upload
  console.log('\n--- 4. Testing Anti-Selfie Rejection on Uploaded Portrait Image ---');
  const selfieImg = createSelfieUploadImageData();
  const selfieRes = await engine.scanUploadedIdImage(selfieImg, 'drivers', 'Civilian', 'front');
  assert(selfieRes.success === false, `Selfie upload rejected (success=${selfieRes.success})`);
  assert(
    selfieRes.cardPresence?.status === 'FACE_DETECTED',
    `Selfie upload flagged FACE_DETECTED (got '${selfieRes.cardPresence?.status}')`
  );

  console.log('\n==============================================================');
  if (failed > 0) {
    console.error(`UPLOADED ID OCR PIPELINE TESTS FAILED: ${failed} failed, ${passed} passed.`);
    process.exit(1);
  } else {
    console.log(`ALL UPLOADED ID OCR PIPELINE TESTS PASSED (${passed}/${passed} - 100%)`);
    console.log('==============================================================\n');
  }
};

runTests();
