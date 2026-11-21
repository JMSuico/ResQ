// [Layer: Testing/Frontend/VisionTests]
// Responsibility: RED/GREEN TDD suite for oversized Gov ID downscaling, 384px fast preflight, low-light face tracking parity, and live biometric login payload contracts.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, ZERO hardcoded fallback PII, and 100% Universal Arrow Lambda syntax (=>).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import * as claudeProviderModule from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/ai/ClaudeSonnetOcrProvider';
import { ClaudeSonnetOcrProvider } from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/ai/ClaudeSonnetOcrProvider';
import { runDualSideRegistrationPreflight } from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/idScanEngine';
import {
  trackSkinFace,
  type OvalGuide
} from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/face/skinFaceTracker';

interface PolyfillImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: PredefinedColorSpace;
}

type DownscaleIdImageDataUrlFn = (
  imageDataUrl: string,
  maxDim?: number
) => string | Promise<string>;

interface DrawnDimensions {
  readonly width: number;
  readonly height: number;
}

interface MockBitmap {
  readonly width: number;
  readonly height: number;
  readonly close: () => void;
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_SRC_DIR = resolve(
  CURRENT_DIR,
  '../../../Project system ENGINE/Frontend/src'
);

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

const encodeRgbaToPngDataUrl = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): string => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = width * 4 + 1;
  const rawScanlines = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    rawScanlines[rowStart] = 0;
    const srcOffset = y * width * 4;
    rawScanlines.set(rgba.subarray(srcOffset, srcOffset + width * 4), rowStart + 1);
  }

  const png = Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', deflateSync(rawScanlines, { level: 1 })),
    makePngChunk('IEND', Buffer.alloc(0))
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
};

const encodeSolidPngDataUrl = (
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): string => {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    rgba[offset] = r;
    rgba[offset + 1] = g;
    rgba[offset + 2] = b;
    rgba[offset + 3] = 255;
  }
  return encodeRgbaToPngDataUrl(rgba, width, height);
};

const readPngDimensionsFromBytes = (bytes: Uint8Array): DrawnDimensions => {
  if (bytes.length < 24) {
    return { width: 0, height: 0 };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
};

const readPngDimensionsFromDataUrl = (dataUrl: string): DrawnDimensions => {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    return { width: 0, height: 0 };
  }
  const payload = dataUrl.slice(commaIdx + 1);
  const buf = Buffer.from(payload, 'base64');
  return readPngDimensionsFromBytes(buf);
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

const createTexturedFrontCard384 = (): ImageData => {
  ensureImageDataGlobal();
  const width = 384;
  const height = 288;
  const rgba = new Uint8ClampedArray(width * height * 4);

  fillRgbaRect(rgba, width, height, 0, 0, width, height, 232, 238, 244);
  fillRgbaRect(rgba, width, height, 4, 4, width - 8, 4, 15, 23, 42);
  fillRgbaRect(rgba, width, height, 4, height - 8, width - 8, 4, 15, 23, 42);
  fillRgbaRect(rgba, width, height, 4, 4, 4, height - 8, 15, 23, 42);
  fillRgbaRect(rgba, width, height, width - 8, 4, 4, height - 8, 15, 23, 42);
  fillRgbaRect(rgba, width, height, 10, 10, width - 20, 38, 15, 35, 75);
  fillRgbaRect(rgba, width, height, 18, 66, 72, 92, 95, 105, 120);

  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      fillRgbaRect(rgba, width, height, 108 + col * 18, 68 + row * 28, 12, 8, 12, 18, 30);
    }
  }
  return new ImageData(rgba, width, height);
};

const createTexturedBackCard384 = (): ImageData => {
  ensureImageDataGlobal();
  const width = 384;
  const height = 288;
  const rgba = new Uint8ClampedArray(width * height * 4);

  fillRgbaRect(rgba, width, height, 0, 0, width, height, 230, 236, 242);
  fillRgbaRect(rgba, width, height, 4, 4, width - 8, 4, 15, 23, 42);
  fillRgbaRect(rgba, width, height, 4, height - 8, width - 8, 4, 15, 23, 42);
  fillRgbaRect(rgba, width, height, 4, 4, 4, height - 8, 15, 23, 42);
  fillRgbaRect(rgba, width, height, width - 8, 4, 4, height - 8, 15, 23, 42);

  for (let bar = 0; bar < 34; bar += 1) {
    const barW = bar % 2 === 0 ? 4 : 2;
    fillRgbaRect(rgba, width, height, 24 + bar * 9, 178, barW, 68, 10, 14, 22);
  }
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 11; col += 1) {
      fillRgbaRect(rgba, width, height, 28 + col * 28, 40 + row * 28, 18, 10, 20, 28, 44);
    }
  }
  return new ImageData(rgba, width, height);
};

const createBlankWhite384 = (): ImageData => {
  ensureImageDataGlobal();
  const width = 384;
  const height = 288;
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(255);
  return new ImageData(rgba, width, height);
};

const createWellLitPortraitSelfie384 = (): ImageData => {
  ensureImageDataGlobal();
  const width = 384;
  const height = 288;
  const rgba = new Uint8ClampedArray(width * height * 4);

  const cx = 192;
  const cy = 144;
  const rx = 68;
  const ry = 88;
  const leftEyeX = 166;
  const rightEyeX = 218;
  const eyeY = 114;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const ovalDist = nx * nx + ny * ny;

      if (ovalDist > 1.0) {
        rgba[idx] = 18;
        rgba[idx + 1] = 22;
        rgba[idx + 2] = 30;
        rgba[idx + 3] = 255;
        continue;
      }

      const texture = ((x * 7 + y * 11) % 7) - 3;
      let r = 204 + texture;
      let g = 152 + Math.round(texture * 0.7);
      let b = 122 + Math.round(texture * 0.5);

      const dLeftEye = ((x - leftEyeX) / 11) ** 2 + ((y - eyeY) / 7) ** 2;
      const dRightEye = ((x - rightEyeX) / 11) ** 2 + ((y - eyeY) / 7) ** 2;
      const dNose = ((x - cx) / 10) ** 2 + ((y - (cy - 10)) / 24) ** 2;
      const dLeftCheek = ((x - 160) / 18) ** 2 + ((y - 150) / 16) ** 2;
      const dRightCheek = ((x - 224) / 18) ** 2 + ((y - 150) / 16) ** 2;
      const dMouth = ((x - cx) / 20) ** 2 + ((y - 188) / 7) ** 2;

      if (dLeftEye <= 1.0 || dRightEye <= 1.0) {
        r = 52;
        g = 38;
        b = 32;
      } else if (dMouth <= 1.0) {
        r = 82;
        g = 48;
        b = 42;
      } else if (dNose <= 1.0) {
        r = 228 + texture;
        g = 176 + texture;
        b = 144 + texture;
      } else if (dLeftCheek <= 1.0 || dRightCheek <= 1.0) {
        r = 216 + texture;
        g = 164 + texture;
        b = 132 + texture;
      }

      rgba[idx] = Math.max(0, Math.min(255, r));
      rgba[idx + 1] = Math.max(0, Math.min(255, g));
      rgba[idx + 2] = Math.max(0, Math.min(255, b));
      rgba[idx + 3] = 255;
    }
  }

  return new ImageData(rgba, width, height);
};

interface SyntheticDimFaceResult {
  readonly rgba: Uint8ClampedArray;
  readonly meanSkinLuma: number;
}

const createDimlyLitSyntheticOvalFace320x240 = (
  oval: OvalGuide
): SyntheticDimFaceResult => {
  const width = 320;
  const height = 240;
  const rgba = new Uint8ClampedArray(width * height * 4);

  const leftEyeX = oval.cx - oval.rx * 0.36;
  const rightEyeX = oval.cx + oval.rx * 0.36;
  const eyeY = oval.cy - oval.ry * 0.34;
  const noseY = oval.cy - oval.ry * 0.06;
  const cheekY = oval.cy + oval.ry * 0.04;
  const mouthY = oval.cy + oval.ry * 0.35;

  let skinLumaSum = 0;
  let skinPixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const nx = (x - oval.cx) / oval.rx;
      const ny = (y - oval.cy) / oval.ry;
      const ovalDist = nx * nx + ny * ny;

      if (ovalDist > 1.0) {
        rgba[idx] = 14;
        rgba[idx + 1] = 15;
        rgba[idx + 2] = 18;
        rgba[idx + 3] = 255;
        continue;
      }

      const microTex = ((x * 5 + y * 9) % 5) - 2;
      let r = 80 + microTex;
      let g = 56 + Math.round(microTex * 0.7);
      let b = 44 + Math.round(microTex * 0.5);

      const dForehead = ((x - oval.cx) / (oval.rx * 0.55)) ** 2 + ((y - (oval.cy - oval.ry * 0.65)) / (oval.ry * 0.22)) ** 2;
      const dLeftEye = ((x - leftEyeX) / 10) ** 2 + ((y - eyeY) / 6) ** 2;
      const dRightEye = ((x - rightEyeX) / 10) ** 2 + ((y - eyeY) / 6) ** 2;
      const dLeftPupil = ((x - leftEyeX) / 4) ** 2 + ((y - eyeY) / 3) ** 2;
      const dRightPupil = ((x - rightEyeX) / 4) ** 2 + ((y - eyeY) / 3) ** 2;
      const dNose = ((x - oval.cx) / 10) ** 2 + ((y - noseY) / 22) ** 2;
      const dLeftCheek = ((x - (oval.cx - oval.rx * 0.42)) / 20) ** 2 + ((y - cheekY) / 18) ** 2;
      const dRightCheek = ((x - (oval.cx + oval.rx * 0.42)) / 20) ** 2 + ((y - cheekY) / 18) ** 2;
      const dMouth = ((x - oval.cx) / 18) ** 2 + ((y - mouthY) / 6) ** 2;
      const dChin = ((x - oval.cx) / 24) ** 2 + ((y - (oval.cy + oval.ry * 0.62)) / 16) ** 2;

      if (dLeftPupil <= 1.0 || dRightPupil <= 1.0) {
        r = 40;
        g = 28;
        b = 24;
      } else if (dLeftEye <= 1.0 || dRightEye <= 1.0) {
        r = 58;
        g = 41;
        b = 34;
      } else if (dMouth <= 1.0) {
        r = 62;
        g = 42;
        b = 35;
      } else if (dNose <= 1.0) {
        r = 92 + microTex;
        g = 64 + microTex;
        b = 51 + microTex;
      } else if (dLeftCheek <= 1.0 || dRightCheek <= 1.0) {
        r = 89 + microTex;
        g = 62 + microTex;
        b = 49 + microTex;
      } else if (dForehead <= 1.0 || dChin <= 1.0) {
        r = 84 + microTex;
        g = 59 + microTex;
        b = 46 + microTex;
      }

      const clampedR = Math.max(0, Math.min(255, r));
      const clampedG = Math.max(0, Math.min(255, g));
      const clampedB = Math.max(0, Math.min(255, b));

      rgba[idx] = clampedR;
      rgba[idx + 1] = clampedG;
      rgba[idx + 2] = clampedB;
      rgba[idx + 3] = 255;

      const luma = 0.299 * clampedR + 0.587 * clampedG + 0.114 * clampedB;
      skinLumaSum += luma;
      skinPixelCount += 1;
    }
  }

  return {
    rgba,
    meanSkinLuma: skinPixelCount > 0 ? skinLumaSum / skinPixelCount : 0
  };
};

const testOversizedGovIdDownscaling = async (): Promise<void> => {
  console.log('\n--- 1. Testing ClaudeSonnetOcrProvider Oversized Gov ID Downscaling ---');

  const moduleRecord = claudeProviderModule as unknown as Readonly<Record<string, unknown>>;
  const classRecord = ClaudeSonnetOcrProvider as unknown as Readonly<Record<string, unknown>>;
  const candidateDownscale =
    moduleRecord['downscaleIdImageDataUrl'] ?? classRecord['downscaleIdImageDataUrl'];
  const hasDownscaleHelper = typeof candidateDownscale === 'function';

  assert(
    hasDownscaleHelper,
    'ClaudeSonnetOcrProvider exports or provides static downscaleIdImageDataUrl helper'
  );

  if (hasDownscaleHelper) {
    const downscaleFn = candidateDownscale as DownscaleIdImageDataUrlFn;
    const smallPngDataUrl = encodeSolidPngDataUrl(400, 260, 210, 218, 226);
    const oversizedPngDataUrl = encodeSolidPngDataUrl(2048, 1536, 210, 218, 226);

    const g = globalThis as unknown as {
      document?: {
        createElement: (tag: string) => unknown;
      };
      Image?: unknown;
      createImageBitmap?: (source: Blob | ImageData) => Promise<MockBitmap>;
      OffscreenCanvas?: unknown;
    };

    const prevDocument = g.document;
    const prevImage = g.Image;
    const prevCreateImageBitmap = g.createImageBitmap;
    const prevOffscreenCanvas = g.OffscreenCanvas;

    let lastDrawnDims: DrawnDimensions | null = null;

    try {
      g.Image = class MockHtmlImage {
        public naturalWidth = 0;
        public naturalHeight = 0;
        public width = 0;
        public height = 0;
        public crossOrigin = '';
        public onload: (() => void) | null = null;
        public onerror: ((err?: unknown) => void) | null = null;
        private readonly loadListeners: Array<() => void> = [];
        private readonly errorListeners: Array<(err?: unknown) => void> = [];
        private internalSrc = '';

        public readonly addEventListener = (
          event: string,
          cb: () => void
        ): void => {
          if (event === 'load') {
            this.loadListeners.push(cb);
          } else if (event === 'error') {
            this.errorListeners.push(cb);
          }
        };

        public readonly removeEventListener = (
          event: string,
          cb: () => void
        ): void => {
          if (event === 'load') {
            const idx = this.loadListeners.indexOf(cb);
            if (idx >= 0) this.loadListeners.splice(idx, 1);
          } else if (event === 'error') {
            const idx = this.errorListeners.indexOf(cb);
            if (idx >= 0) this.errorListeners.splice(idx, 1);
          }
        };

        public get src(): string {
          return this.internalSrc;
        }

        public set src(value: string) {
          this.internalSrc = value;
          const dims = readPngDimensionsFromDataUrl(value);
          this.naturalWidth = dims.width;
          this.naturalHeight = dims.height;
          this.width = dims.width;
          this.height = dims.height;

          queueMicrotask((): void => {
            if (dims.width > 0 && dims.height > 0) {
              if (this.onload) {
                this.onload();
              }
              for (const listener of this.loadListeners) {
                listener();
              }
            } else {
              if (this.onerror) {
                this.onerror(new Error('Invalid mock PNG'));
              }
              for (const listener of this.errorListeners) {
                listener(new Error('Invalid mock PNG'));
              }
            }
          });
        }
      };

      const createCanvasStub = (initW = 300, initH = 150) => {
        const canvasObj = {
          width: initW,
          height: initH,
          getContext: () => ({
            drawImage: (): void => {
              lastDrawnDims = {
                width: canvasObj.width,
                height: canvasObj.height
              };
            }
          }),
          toDataURL: (mimeType?: string): string => {
            lastDrawnDims = {
              width: canvasObj.width,
              height: canvasObj.height
            };
            const mime = mimeType || 'image/jpeg';
            return `data:${mime};base64,${Buffer.from(
              `mock-downscaled-${canvasObj.width}x${canvasObj.height}`,
              'utf8'
            ).toString('base64')}`;
          },
          convertToBlob: async (opts?: { type?: string }): Promise<Blob> => {
            lastDrawnDims = {
              width: canvasObj.width,
              height: canvasObj.height
            };
            const mime = opts?.type || 'image/jpeg';
            return new Blob(
              [`mock-downscaled-${canvasObj.width}x${canvasObj.height}`],
              { type: mime }
            );
          }
        };
        return canvasObj;
      };

      g.document = {
        createElement: (tag: string): unknown => {
          if (tag === 'canvas') {
            return createCanvasStub();
          }
          return {};
        }
      };

      g.OffscreenCanvas = class MockOffscreenCanvas {
        public width: number;
        public height: number;
        private readonly stub: ReturnType<typeof createCanvasStub>;

        public constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
          this.stub = createCanvasStub(width, height);
        }

        public readonly getContext = () => {
          this.stub.width = this.width;
          this.stub.height = this.height;
          return this.stub.getContext();
        };

        public readonly convertToBlob = (opts?: { type?: string }): Promise<Blob> => {
          this.stub.width = this.width;
          this.stub.height = this.height;
          return this.stub.convertToBlob(opts);
        };
      };

      g.createImageBitmap = async (source: Blob | ImageData): Promise<MockBitmap> => {
        if ('width' in source && 'height' in source && 'data' in source) {
          return {
            width: source.width,
            height: source.height,
            close: (): void => {}
          };
        }
        const ab = await source.arrayBuffer();
        const dims = readPngDimensionsFromBytes(new Uint8Array(ab));
        return {
          width: dims.width,
          height: dims.height,
          close: (): void => {}
        };
      };

      const smallResult = await Promise.resolve(downscaleFn(smallPngDataUrl));
      assertEqual(
        smallResult,
        smallPngDataUrl,
        'downscaleIdImageDataUrl keeps small 400x260 ID images untouched'
      );

      lastDrawnDims = null;
      const oversizedResult = await Promise.resolve(downscaleFn(oversizedPngDataUrl));
      assert(
        oversizedResult !== oversizedPngDataUrl &&
          oversizedResult.startsWith('data:image/'),
        'downscaleIdImageDataUrl downscales oversized 2048x1536 payload when canvas/bitmap available'
      );
      assert(
        lastDrawnDims !== null &&
          Math.max(lastDrawnDims.width, lastDrawnDims.height) === 1568,
        `downscaleIdImageDataUrl caps longest dimension to maxDim = 1568 (actual=${JSON.stringify(lastDrawnDims)})`
      );
      assert(
        lastDrawnDims !== null &&
          lastDrawnDims.width === 1568 &&
          lastDrawnDims.height === 1176,
        `downscaleIdImageDataUrl preserves aspect ratio for 2048x1536 -> 1568x1176 (actual=${JSON.stringify(lastDrawnDims)})`
      );
    } finally {
      g.document = prevDocument;
      g.Image = prevImage;
      g.createImageBitmap = prevCreateImageBitmap;
      g.OffscreenCanvas = prevOffscreenCanvas;
    }
  } else {
    assert(
      false,
      'downscaleIdImageDataUrl keeps small ID images untouched (missing helper)'
    );
    assert(
      false,
      'downscaleIdImageDataUrl caps oversized ID upload to maxDim = 1568 (missing helper)'
    );
  }

  const providerSource = readFileSync(
    resolve(FRONTEND_SRC_DIR, 'Libs/Vision/idScanner/ai/ClaudeSonnetOcrProvider.ts'),
    'utf8'
  );

  const timeoutMatch = providerSource.match(/timeoutMs\s*:\s*number\s*=\s*([0-9_]+)/);
  const parsedDefaultTimeout = timeoutMatch
    ? Number.parseInt(timeoutMatch[1].replace(/_/g, ''), 10)
    : NaN;

  assert(
    Number.isFinite(parsedDefaultTimeout) &&
      parsedDefaultTimeout > 0 &&
      parsedDefaultTimeout <= 30_000,
    `ClaudeSonnetOcrProvider.ts default per-attempt timeoutMs <= 30000 (actual=${parsedDefaultTimeout})`
  );

  const runtimeProvider = new ClaudeSonnetOcrProvider(
    'https://mock.resqtrack.test/api/identity/ocr/extract'
  ) as unknown as { readonly timeoutMs: number };
  assert(
    typeof runtimeProvider.timeoutMs === 'number' &&
      runtimeProvider.timeoutMs > 0 &&
      runtimeProvider.timeoutMs <= 30_000,
    `ClaudeSonnetOcrProvider runtime instance timeoutMs <= 30000 (actual=${runtimeProvider.timeoutMs})`
  );

  const extractStartIdx = providerSource.indexOf('public readonly extractDualSide');
  const extractSlice = extractStartIdx >= 0 ? providerSource.slice(extractStartIdx) : '';
  const downscaleCallIdx = extractSlice.indexOf('downscaleIdImageDataUrl');
  const buildFormIdx = extractSlice.indexOf('buildMultipartFormData');

  assert(
    downscaleCallIdx >= 0 && buildFormIdx >= 0 && downscaleCallIdx < buildFormIdx,
    'ClaudeSonnetOcrProvider.ts invokes downscaleIdImageDataUrl before buildMultipartFormData in extractDualSide'
  );
};

const testFastBackgroundPreflight384 = (): void => {
  console.log('\n--- 2. Testing Fast Background Pre-Flight at 384x288 ---');

  const frontCard384 = createTexturedFrontCard384();
  const backCard384 = createTexturedBackCard384();
  const duplicateBack384 = new ImageData(
    new Uint8ClampedArray(frontCard384.data),
    frontCard384.width,
    frontCard384.height
  );
  const blank384 = createBlankWhite384();
  const selfie384 = createWellLitPortraitSelfie384();

  // Warm up JIT once before measuring hot path execution
  runDualSideRegistrationPreflight(frontCard384, backCard384, 'drivers');

  const t0 = performance.now();
  const validRes = runDualSideRegistrationPreflight(frontCard384, backCard384, 'drivers');
  const elapsedMs = performance.now() - t0;

  assertEqual(
    validRes.passed,
    true,
    '384x288 valid Front + Back ID cards pass runDualSideRegistrationPreflight'
  );
  assert(
    elapsedMs < 100,
    `runDualSideRegistrationPreflight completes 384x288 frame check under 100ms (actual=${elapsedMs.toFixed(2)}ms)`
  );

  const dupRes = runDualSideRegistrationPreflight(frontCard384, duplicateBack384, 'drivers');
  assertEqual(
    dupRes.passed,
    false,
    '384x288 identical Front + Back frames fail preflight'
  );
  assertEqual(
    dupRes.errorCode,
    'DUPLICATE_FRONT_BACK_IMAGE',
    '384x288 identical Front + Back frames reject with DUPLICATE_FRONT_BACK_IMAGE'
  );

  const blankRes = runDualSideRegistrationPreflight(blank384, backCard384, 'drivers');
  assertEqual(
    blankRes.passed,
    false,
    '384x288 blank white Front frame fails preflight'
  );
  assertEqual(
    blankRes.errorCode,
    'UNREADABLE_OR_BLANK_IMAGE',
    '384x288 blank white Front frame rejects with UNREADABLE_OR_BLANK_IMAGE'
  );

  const selfieRes = runDualSideRegistrationPreflight(selfie384, backCard384, 'drivers');
  assertEqual(
    selfieRes.passed,
    false,
    '384x288 portrait selfie without card structure fails preflight'
  );
  assertEqual(
    selfieRes.errorCode,
    'NON_ID_DOCUMENT',
    '384x288 portrait selfie without card structure rejects with NON_ID_DOCUMENT'
  );

  const hookSource = readFileSync(
    resolve(FRONTEND_SRC_DIR, 'Hooks/useBackgroundIdVerification.ts'),
    'utf8'
  );
  const decodeStart = hookSource.indexOf('const decodeDataUrlToImageData');
  const decodeEnd = hookSource.indexOf('const getDualSidePreflightHelper');
  const decodeSlice =
    decodeStart >= 0 && decodeEnd > decodeStart
      ? hookSource.slice(decodeStart, decodeEnd)
      : '';

  assert(
    /\bmaxDim\s*=\s*384\b/.test(decodeSlice) && !/\bmaxDim\s*=\s*1280\b/.test(decodeSlice),
    'useBackgroundIdVerification.ts decodeDataUrlToImageData decodes preflight canvases at maxDim = 384 (not 1280)'
  );
};

const testLowLightSkinTrackingAndOvalAlignment = (): void => {
  console.log('\n--- 3. Testing Low-Light Skin/Face Tracking Parity & Biometric Cache Oval Alignment ---');

  const guideOval: OvalGuide = { cx: 160, cy: 120, rx: 84, ry: 102 };
  const dimFace = createDimlyLitSyntheticOvalFace320x240(guideOval);

  assert(
    dimFace.meanSkinLuma >= 55 && dimFace.meanSkinLuma <= 68,
    `Synthetic dimly lit face has realistic skin mean luma ~62 (actual=${dimFace.meanSkinLuma.toFixed(1)})`
  );

  const trackingResult = trackSkinFace(dimFace.rgba, 320, 240, guideOval);

  assertEqual(
    trackingResult.isValidFace,
    true,
    `Dimly lit 320x240 oval face passes trackSkinFace isValidFace === true (haarScore=${trackingResult.haarCheck.score}, svmScore=${trackingResult.hybridProfile.svmScore})`
  );
  assertEqual(
    trackingResult.landmarks.isValidLandmarks,
    true,
    'Dimly lit 320x240 oval face passes landmarks.isValidLandmarks === true'
  );
  assertEqual(
    trackingResult.featureDescriptor?.length,
    128,
    'Dimly lit 320x240 oval face produces 128-D featureDescriptor'
  );

  const cacheSource = readFileSync(
    resolve(FRONTEND_SRC_DIR, 'Libs/Cache/biometricFrameCache.ts'),
    'utf8'
  );
  const extractStart = cacheSource.indexOf('export const extractBiometricFeatureVectorDetailed');
  const nextHelperIdx = cacheSource.indexOf('export const generateDeterministicBiometricVector');
  const extractSlice =
    extractStart >= 0 && nextHelperIdx > extractStart
      ? cacheSource.slice(extractStart, nextHelperIdx)
      : '';

  assert(
    /rx:\s*targetW\s*\*\s*0\.2625\b/.test(extractSlice) &&
      /ry:\s*targetH\s*\*\s*0\.425\b/.test(extractSlice),
    'biometricFrameCache.ts extractBiometricFeatureVectorDetailed uses aligned oval proportions rx: targetW * 0.2625, ry: targetH * 0.425'
  );
};

const testBiometricLoginModalAndAuthContracts = (): void => {
  console.log('\n--- 4. Testing BiometricLoginModal Live Capture & No Silent Email Vector Fallback ---');

  const authEndpointsSource = readFileSync(
    resolve(FRONTEND_SRC_DIR, 'Endpoints/authEndpoints.ts'),
    'utf8'
  );
  const payloadStart = authEndpointsSource.indexOf('export interface BiometricLoginPayload');
  const payloadEnd = authEndpointsSource.indexOf('export interface BiometricValidationLayerTelemetry');
  const payloadSlice =
    payloadStart >= 0 && payloadEnd > payloadStart
      ? authEndpointsSource.slice(payloadStart, payloadEnd)
      : '';

  assert(
    /\bliveCaptureBase64\??\s*:\s*string\b/.test(payloadSlice),
    'authEndpoints.ts BiometricLoginPayload declares liveCaptureBase64'
  );
  assert(
    /\bliveCaptureFramesBase64\??\s*:\s*(?:readonly\s+)?string\[\]/.test(payloadSlice),
    'authEndpoints.ts BiometricLoginPayload declares liveCaptureFramesBase64'
  );

  const modalSource = readFileSync(
    resolve(
      FRONTEND_SRC_DIR,
      'LANDING_PAGE/Features/Pages/LoginPage/BiometricLoginModal.tsx'
    ),
    'utf8'
  );

  const executeStart = modalSource.indexOf('const executeBiometricLogin');
  const executeEnd = modalSource.indexOf('const recognizedName', executeStart);
  const executeSlice =
    executeStart >= 0 && executeEnd > executeStart
      ? modalSource.slice(executeStart, executeEnd)
      : '';

  assert(
    /\bliveCaptureBase64\b/.test(executeSlice),
    'BiometricLoginModal.tsx attaches liveCaptureBase64 to /api/biometric-login payload'
  );
  assert(
    /\bliveCaptureFramesBase64\b/.test(executeSlice),
    'BiometricLoginModal.tsx attaches liveCaptureFramesBase64 to /api/biometric-login payload'
  );

  const manualScanStart = modalSource.indexOf('const handleManualScanNow');
  const manualScanEnd = modalSource.indexOf('const handleSyntheticTestScan');
  const manualScanSlice =
    manualScanStart >= 0 && manualScanEnd > manualScanStart
      ? modalSource.slice(manualScanStart, manualScanEnd)
      : '';

  const executeCallMatch = manualScanSlice.match(
    /executeBiometricLogin\s*\(\s*([^,)]+)\s*,\s*([^,)]+)(?:\s*,\s*([^,)]+))?(?:\s*,\s*([^,)]+))?\s*\)/
  );
  const thirdArg = executeCallMatch?.[3]?.trim() ?? '';
  const passesNonUndefinedFallback = Boolean(thirdArg && thirdArg !== 'undefined');
  const buildsDeterministicFallbackVar =
    /\bgenerateDeterministicBiometricVector\b/.test(manualScanSlice);

  assert(
    !passesNonUndefinedFallback && !buildsDeterministicFallbackVar,
    'BiometricLoginModal.tsx handleManualScanNow does NOT pass a generateDeterministicBiometricVector(email) retry fallbackVector to executeBiometricLogin'
  );
};

const testBiometricLoginModalLockoutAndRetryGuards = (): void => {
  console.log('\n--- 5. Testing BiometricLoginModal Terminal Auth Guard & Bounded Auto-Retry ---');

  const modalSource = readFileSync(
    resolve(
      FRONTEND_SRC_DIR,
      'LANDING_PAGE/Features/Pages/LoginPage/BiometricLoginModal.tsx'
    ),
    'utf8'
  );

  const executeStart = modalSource.indexOf('const executeBiometricLogin');
  const executeEnd = modalSource.indexOf('const processFrame', executeStart);
  const executeSlice =
    executeStart >= 0 && executeEnd > executeStart
      ? modalSource.slice(executeStart, executeEnd)
      : '';

  const catchStart = executeSlice.indexOf('} catch (err: unknown)');
  const catchSlice = catchStart >= 0 ? executeSlice.slice(catchStart) : '';

  const processFrameStart = modalSource.indexOf('const processFrame = useCallback');
  const processFrameEnd = modalSource.indexOf('stopCameraRef.current = stopCamera', processFrameStart);
  const processFrameSlice =
    processFrameStart >= 0 && processFrameEnd > processFrameStart
      ? modalSource.slice(processFrameStart, processFrameEnd)
      : '';

  const hasTerminalGuardHelper = /\bisTerminalAuthFailure\b/.test(modalSource);
  const hasExplicitTerminalChecks =
    /\bpending\b/i.test(executeSlice) &&
    /\bsuspended\b/i.test(executeSlice) &&
    /not\s+found/i.test(executeSlice);

  assert(
    hasTerminalGuardHelper || hasExplicitTerminalChecks,
    'BiometricLoginModal.tsx contains terminal-auth-failure guard (isTerminalAuthFailure or explicit pending/suspended/not found checks)'
  );

  assert(
    !modalSource.includes('temporarily locked') && !/TERMINAL_AUTH_FAILURE_TOKENS[\s\S]*'locked'/.test(modalSource),
    'BiometricLoginModal.tsx removes 15-minute lockout token guards from biometric sign-in'
  );

  const catchMentionsTerminalOrPauseGuard =
    /\bisTerminalAuthFailure\b/.test(catchSlice) ||
    /\bautoScanPausedRef\b/.test(catchSlice) ||
    /\bpending\b/i.test(catchSlice);
  const catchUnconditionallySchedulesRetry =
    /retryTimeoutRef\.current\s*=\s*window\.setTimeout/.test(catchSlice) &&
    !catchMentionsTerminalOrPauseGuard;

  assert(
    catchMentionsTerminalOrPauseGuard && !catchUnconditionallySchedulesRetry,
    'BiometricLoginModal.tsx executeBiometricLogin catch block gates auto-retry so terminal auth failures NEVER schedule retryTimeoutRef or loop automatically'
  );

  const hasPauseOrRetryRefs =
    /\bautoScanPausedRef\b/.test(modalSource) &&
    /\bautoRetryCountRef\b/.test(modalSource);

  assert(
    hasPauseOrRetryRefs,
    'BiometricLoginModal.tsx declares dedicated autoScanPausedRef and autoRetryCountRef for bounded auto-scan retries'
  );

  const processFrameChecksPauseRef = /\bautoScanPausedRef\.current\b/.test(processFrameSlice);

  assert(
    processFrameChecksPauseRef,
    'BiometricLoginModal.tsx processFrame stops automatic captures when autoScanPausedRef.current is true'
  );
};

const main = async (): Promise<void> => {
  console.log('====================================================================');
  console.log('FAST OCR & HYBRID BIOMETRIC LOGIN TDD VERIFICATION SUITE');
  console.log('====================================================================');

  await testOversizedGovIdDownscaling();
  testFastBackgroundPreflight384();
  testLowLightSkinTrackingAndOvalAlignment();
  testBiometricLoginModalAndAuthContracts();
  testBiometricLoginModalLockoutAndRetryGuards();

  console.log('\n====================================================================');
  if (failedCount > 0) {
    console.error(`SUITE FAILED (RED): ${failedCount} failed, ${passedCount} passed.`);
    process.exit(1);
  }
  console.log(`ALL FAST OCR & HYBRID BIOMETRIC LOGIN TESTS PASSED (${passedCount}/${passedCount})`);
  console.log('====================================================================');
};

void main();
