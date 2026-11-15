// [Layer: Testing/Frontend/VisionTests]
// Responsibility: TDD verification suite for unified Phase 2 dual-side pre-flight gating and ClaudeSonnetOcrProvider HTTP 422/503 contracts.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, ZERO hardcoded secrets, 100% Universal Arrow Lambda syntax (=>).

import { deflateSync } from 'node:zlib';
import * as idScanEngineModule from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/idScanEngine';
import { ClaudeSonnetOcrProvider } from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/ai/ClaudeSonnetOcrProvider';
import {
  createElenaMarquezDriversLicenseDataUrl
} from '../fixtures/syntheticIdFixtures';

interface PolyfillImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: PredefinedColorSpace;
}

interface DualSidePreflightResult {
  readonly passed: boolean;
  readonly errorCode?: string;
  readonly reason?: string;
  readonly detectedFrontSide?: string;
  readonly detectedBackSide?: string;
}

type RunDualSideRegistrationPreflightFn = (
  frontImageData: ImageData | null | undefined,
  backImageData: ImageData | null | undefined,
  selectedCategory?: string
) => DualSidePreflightResult | Promise<DualSidePreflightResult>;

const ensureImageDataGlobal = (): void => {
  const g = globalThis as unknown as {
    ImageData?: new (
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      maybeHeight?: number
    ) => PolyfillImageData;
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
};

let passedCount = 0;
let failedCount = 0;

const assert = (condition: boolean, message: string): void => {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedCount += 1;
  } else {
    console.error(`[FAIL] ${message}`);
    failedCount += 1;
  }
};

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  assert(
    actual === expected,
    `${message} (expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)})`
  );
};

const BANNED_FALLBACK_TOKENS: readonly string[] = [
  'JUAN',
  'JUAN MIGUEL',
  'DELA CRUZ',
  'SANTOS',
  '1995-05-15',
  '1996-05-14',
  '2030-05-15',
  'N01-23-456789',
  'K02-24-008491',
  '+639171234567'
];

const containsBannedFallback = (serialized: string): boolean => {
  const upper = serialized.toUpperCase();
  return BANNED_FALLBACK_TOKENS.some((token: string): boolean => upper.includes(token.toUpperCase()));
};

const fillRgbaRect = (
  rgba: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number
): void => {
  const xEnd = Math.min(imgWidth, x0 + w);
  const yEnd = Math.min(imgHeight, y0 + h);
  for (let y = Math.max(0, y0); y < yEnd; y += 1) {
    for (let x = Math.max(0, x0); x < xEnd; x += 1) {
      const idx = (y * imgWidth + x) * 4;
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }
};

const createTexturedFrontCardImageData = (): ImageData => {
  ensureImageDataGlobal();
  const width = 856;
  const height = 540;
  const rgba = new Uint8ClampedArray(width * height * 4);

  // Neutral matte off-white card body below HSV glare threshold (V <= 0.96)
  fillRgbaRect(rgba, width, height, 0, 0, width, height, 232, 238, 244);
  // Crisp outer card frame
  fillRgbaRect(rgba, width, height, 8, 8, width - 16, 6, 15, 23, 42);
  fillRgbaRect(rgba, width, height, 8, height - 14, width - 16, 6, 15, 23, 42);
  fillRgbaRect(rgba, width, height, 8, 8, 6, height - 16, 15, 23, 42);
  fillRgbaRect(rgba, width, height, width - 14, 8, 6, height - 16, 15, 23, 42);
  // Navy LTO header band
  fillRgbaRect(rgba, width, height, 20, 20, width - 40, 76, 15, 35, 75);
  // High-contrast printed text bars representing name, DOB, license number, address
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 18; col += 1) {
      fillRgbaRect(rgba, width, height, 240 + col * 26, 145 + row * 48, 18, 12, 12, 18, 30);
    }
  }
  return new ImageData(rgba, width, height);
};

const createTexturedBackCardImageData = (): ImageData => {
  ensureImageDataGlobal();
  const width = 856;
  const height = 540;
  const rgba = new Uint8ClampedArray(width * height * 4);

  fillRgbaRect(rgba, width, height, 0, 0, width, height, 230, 236, 242);
  fillRgbaRect(rgba, width, height, 8, 8, width - 16, 6, 15, 23, 42);
  fillRgbaRect(rgba, width, height, 8, height - 14, width - 16, 6, 15, 23, 42);
  // Back-side PDF417-style deterministic barcode bars
  for (let bar = 0; bar < 48; bar += 1) {
    const barW = bar % 2 === 0 ? 6 : 3;
    fillRgbaRect(rgba, width, height, 60 + bar * 14, 340, barW, 120, 10, 14, 22);
  }
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      fillRgbaRect(rgba, width, height, 70 + col * 36, 90 + row * 48, 24, 14, 20, 28, 44);
    }
  }
  return new ImageData(rgba, width, height);
};

const createBlankWhiteImageData = (): ImageData => {
  ensureImageDataGlobal();
  const width = 856;
  const height = 540;
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(255);
  return new ImageData(rgba, width, height);
};

const buildCrc32Table = (): Uint32Array => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
};

const CRC32_TABLE = buildCrc32Table();

const computeCrc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const makePngChunk = (chunkType: string, data: Buffer): Buffer => {
  const typeBuf = Buffer.from(chunkType, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(computeCrc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
};

const createDistinctBackDataUrl = (): string => {
  const backImg = createTexturedBackCardImageData();
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(backImg.width, 0);
  ihdr.writeUInt32BE(backImg.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = backImg.width * 4 + 1;
  const rawScanlines = Buffer.alloc(stride * backImg.height);
  for (let y = 0; y < backImg.height; y += 1) {
    const rowStart = y * stride;
    rawScanlines[rowStart] = 0;
    const srcOffset = y * backImg.width * 4;
    rawScanlines.set(backImg.data.subarray(srcOffset, srcOffset + backImg.width * 4), rowStart + 1);
  }

  const png = Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', deflateSync(rawScanlines, { level: 6 })),
    makePngChunk('IEND', Buffer.alloc(0))
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
};

const testDualSideRegistrationPreflight = async (): Promise<void> => {
  console.log('\n--- 1. Testing idScanEngine.runDualSideRegistrationPreflight ---');

  const engineExports = idScanEngineModule as unknown as Readonly<Record<string, unknown>>;
  const candidatePreflight = engineExports['runDualSideRegistrationPreflight'];
  const hasPreflightExport = typeof candidatePreflight === 'function';

  assert(
    hasPreflightExport,
    'idScanEngine exports runDualSideRegistrationPreflight function'
  );

  if (!hasPreflightExport) {
    assert(
      false,
      'Identical Front + Back RGBA ImageData rejects with DUPLICATE_FRONT_BACK_IMAGE (requires runDualSideRegistrationPreflight)'
    );
    assert(
      false,
      'Blank white Front RGBA ImageData rejects with UNREADABLE_OR_BLANK_IMAGE (requires runDualSideRegistrationPreflight)'
    );
    return;
  }

  const preflightFn = candidatePreflight as RunDualSideRegistrationPreflightFn;

  const frontA = createTexturedFrontCardImageData();
  const frontClone = new ImageData(new Uint8ClampedArray(frontA.data), frontA.width, frontA.height);
  const duplicateResult = await Promise.resolve(preflightFn(frontA, frontClone, 'drivers'));

  assertEqual(
    duplicateResult.passed,
    false,
    'Identical Front + Back RGBA ImageData fails pre-flight'
  );
  assertEqual(
    duplicateResult.errorCode,
    'DUPLICATE_FRONT_BACK_IMAGE',
    'Identical Front + Back RGBA ImageData rejects with DUPLICATE_FRONT_BACK_IMAGE'
  );

  const blankFront = createBlankWhiteImageData();
  const distinctBack = createTexturedBackCardImageData();
  const blankResult = await Promise.resolve(preflightFn(blankFront, distinctBack, 'drivers'));

  assertEqual(
    blankResult.passed,
    false,
    'Blank white Front RGBA ImageData fails pre-flight'
  );
  assertEqual(
    blankResult.errorCode,
    'UNREADABLE_OR_BLANK_IMAGE',
    'Blank white Front RGBA ImageData rejects with UNREADABLE_OR_BLANK_IMAGE'
  );
};

const testClaudeSonnet422And503Contracts = async (): Promise<void> => {
  console.log('\n--- 2. Testing ClaudeSonnetOcrProvider HTTP 422 code preservation and HTTP 503 Pending flag ---');

  const originalFetch = globalThis.fetch;
  const elenaDataUrl = createElenaMarquezDriversLicenseDataUrl();
  const distinctBackUrl = createDistinctBackDataUrl();
  const claudeProvider = new ClaudeSonnetOcrProvider('https://mock.resqtrack.test/api/identity/ocr/extract');

  const expected422Codes: readonly string[] = [
    'WRONG_ID_SIDE_FRONT_EXPECTED',
    'WRONG_ID_SIDE_BACK_EXPECTED',
    'WRONG_GOVERNMENT_ID_TYPE',
    'DUPLICATE_FRONT_BACK_IMAGE',
    'FAKE_OR_AI_GENERATED_ID',
    'NON_ID_DOCUMENT'
  ];

  try {
    for (const expectedCode of expected422Codes) {
      globalThis.fetch = (async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            success: false,
            errorCode: expectedCode,
            errorMessage: `Forensic rejection: ${expectedCode}`,
            detectedIdType: expectedCode === 'WRONG_GOVERNMENT_ID_TYPE' ? 'passport' : 'drivers',
            detectedIdLabel:
              expectedCode === 'WRONG_GOVERNMENT_ID_TYPE'
                ? 'Philippine Passport'
                : "Philippine Driver's License",
            matchesSelectedIdType: expectedCode !== 'WRONG_GOVERNMENT_ID_TYPE',
            frontSlotDetectedSide: expectedCode === 'WRONG_ID_SIDE_FRONT_EXPECTED' ? 'BACK' : 'FRONT',
            backSlotDetectedSide: expectedCode === 'WRONG_ID_SIDE_BACK_EXPECTED' ? 'FRONT' : 'BACK',
            areSidesIdentical: expectedCode === 'DUPLICATE_FRONT_BACK_IMAGE',
            authenticityVerdict:
              expectedCode === 'FAKE_OR_AI_GENERATED_ID'
                ? 'SPECIMEN'
                : expectedCode === 'NON_ID_DOCUMENT'
                ? 'NON_ID_DOCUMENT'
                : 'REJECTED'
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )) as typeof fetch;

      const response = await claudeProvider.extractDualSide({
        frontImage: elenaDataUrl,
        backImage: expectedCode === 'DUPLICATE_FRONT_BACK_IMAGE' ? elenaDataUrl : distinctBackUrl,
        idType: 'drivers',
        preferredProvider: 'claude'
      });

      assertEqual(response.success, false, `HTTP 422 ${expectedCode} keeps success === false`);
      assertEqual(
        response.errorCode,
        expectedCode,
        `HTTP 422 preserves exact errorCode ${expectedCode}`
      );
      assertEqual(response.confidence, 0, `HTTP 422 ${expectedCode} returns 0 confidence`);
      assert(
        !containsBannedFallback(JSON.stringify(response)),
        `HTTP 422 ${expectedCode} emits zero banned dummy PII`
      );
    }

    globalThis.fetch = (async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'PROVIDER_UNAVAILABLE',
          errorMessage: 'Claude Vision service is offline; proceed with manual review.',
          requiresPendingManualReview: true
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const offlineResponse = await claudeProvider.extractDualSide({
      frontImage: elenaDataUrl,
      backImage: distinctBackUrl,
      idType: 'drivers',
      preferredProvider: 'claude'
    });

    const offlineRecord = offlineResponse as unknown as Readonly<Record<string, unknown>>;
    assertEqual(offlineResponse.success, false, 'HTTP 503 PROVIDER_UNAVAILABLE keeps success === false');
    assertEqual(
      offlineResponse.errorCode,
      'PROVIDER_UNAVAILABLE',
      'HTTP 503 preserves errorCode PROVIDER_UNAVAILABLE'
    );
    assertEqual(
      offlineRecord['requiresPendingManualReview'],
      true,
      'HTTP 503 PROVIDER_UNAVAILABLE propagates requiresPendingManualReview === true'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const testMissingIdTypeGuardContracts = async (): Promise<void> => {
  console.log('\n--- 3. Testing ClaudeSonnetOcrProvider client MISSING_ID_TYPE fail-closed guard & HTTP 400 preservation ---');

  const originalFetch = globalThis.fetch;
  const elenaDataUrl = createElenaMarquezDriversLicenseDataUrl();
  const distinctBackUrl = createDistinctBackDataUrl();
  const claudeProvider = new ClaudeSonnetOcrProvider('https://mock.resqtrack.test/api/identity/ocr/extract');
  const expectedMissingIdType: string = 'MISSING_ID_TYPE';

  const blankIdTypes: readonly { readonly label: string; readonly value: string }[] = [
    { label: 'empty string', value: '' },
    { label: 'whitespace-only', value: '   ' }
  ];

  try {
    for (const testCase of blankIdTypes) {
      let fetchCalls = 0;
      globalThis.fetch = (async (): Promise<Response> => {
        fetchCalls += 1;
        return new Response(
          JSON.stringify({
            success: false,
            errorCode: 'EXTRACTION_FAILED',
            errorMessage: 'Unexpected network call for missing idType.'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }) as typeof fetch;

      const response = await claudeProvider.extractDualSide({
        frontImage: elenaDataUrl,
        backImage: distinctBackUrl,
        idType: testCase.value,
        requireDualSide: true
      });

      assertEqual(
        fetchCalls,
        0,
        `Blank idType (${testCase.label}) fails closed locally before calling fetch`
      );
      assertEqual(
        response.success,
        false,
        `Blank idType (${testCase.label}) returns success === false`
      );
      assertEqual<string | undefined>(
        response.errorCode,
        expectedMissingIdType,
        `Blank idType (${testCase.label}) rejects with MISSING_ID_TYPE`
      );
      assertEqual(
        response.confidence,
        0,
        `Blank idType (${testCase.label}) returns confidence === 0`
      );
      assertEqual(
        response.requiresPendingManualReview,
        false,
        `Blank idType (${testCase.label}) returns requiresPendingManualReview === false`
      );
      assertEqual(
        containsBannedFallback(JSON.stringify(response)),
        false,
        `Blank idType (${testCase.label}) emits zero banned fallback tokens`
      );
    }

    globalThis.fetch = (async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'MISSING_ID_TYPE',
          errorMessage:
            'Government ID document type must be selected before uploading or verifying ID images.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const http400Response = await claudeProvider.extractDualSide({
      frontImage: elenaDataUrl,
      backImage: distinctBackUrl,
      idType: 'drivers',
      requireDualSide: true
    });

    assertEqual(
      http400Response.success,
      false,
      'HTTP 400 MISSING_ID_TYPE keeps success === false'
    );
    assertEqual<string | undefined>(
      http400Response.errorCode,
      expectedMissingIdType,
      'HTTP 400 preserves exact errorCode MISSING_ID_TYPE'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const main = async (): Promise<void> => {
  console.log('====================================================================');
  console.log('UNIFIED PHASE 2 PRE-FLIGHT & CLAUDE 422/503 CONTRACT TESTS');
  console.log('====================================================================');

  await testDualSideRegistrationPreflight();
  await testClaudeSonnet422And503Contracts();
  await testMissingIdTypeGuardContracts();

  console.log('\n====================================================================');
  if (failedCount > 0) {
    console.error(`PREFLIGHT SUITE FAILED: ${failedCount} failed, ${passedCount} passed.`);
    process.exit(1);
  }
  console.log(`ALL UNIFIED PHASE 2 PREFLIGHT TESTS PASSED (${passedCount}/${passedCount})`);
  console.log('====================================================================');
};

void main();
