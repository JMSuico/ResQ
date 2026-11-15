// [Layer: Testing/Frontend/Fixtures]
// Produces a 150-frame 640x480 YUV4MPEG2 (.y4m) photorealistic multi-pose blinking video from Elena's real studio portrait
// and exposes the photorealistic LTO / PhilSys / Specimen / Mismatch ID PNG card assets from Testing/Frontend/fixtures/assets.
// Strict TypeScript: ZERO 'any', ZERO emojis, 100% Universal Arrow Lambdas (=>).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

export interface Y4mAndIdFixturePaths {
  readonly y4mPath: string;
  readonly frontIdPath: string;
  readonly backIdPath: string;
  readonly nonMatchingFrontIdPath: string;
  readonly philsysWrongTypePath: string;
  readonly philsysBackPath: string;
  readonly specimenFakePath: string;
}

interface DecodedRgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

interface Y4mPoseParameters {
  readonly yawDeg: number;
  readonly pitchDeg: number;
  readonly eyeOpenness: number;
}

const Y4M_WIDTH = 640;
const Y4M_HEIGHT = 480;
const Y4M_FRAME_COUNT = 150;
const Y4M_FPS = 30;
const Y4M_HEADER = `YUV4MPEG2 W${Y4M_WIDTH} H${Y4M_HEIGHT} F${Y4M_FPS}:1 Ip A1:1 C420jpeg\n`;
const resolveAssetsDir = (): string => {
  const candidates: string[] = [
    ...(typeof __dirname === 'string' ? [join(__dirname, 'assets')] : []),
    join(process.cwd(), 'Testing', 'Frontend', 'fixtures', 'assets'),
    join(process.cwd(), 'fixtures', 'assets'),
    join(process.cwd(), 'assets')
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return join(process.cwd(), 'Testing', 'Frontend', 'fixtures', 'assets');
};

const ASSETS_DIR = resolveAssetsDir();

const clampByte = (value: number): number => {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
};

const paethPredictor = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
};

const decodePngToRgba = (pngBytes: Buffer): DecodedRgbaImage => {
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (pngBytes.length < 33 || !pngBytes.subarray(0, 8).equals(pngSig)) {
    throw new Error('Invalid PNG signature while decoding headshot fixture.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= pngBytes.length) {
    const chunkLen = pngBytes.readUInt32BE(offset);
    const chunkType = pngBytes.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLen;
    if (dataEnd + 4 > pngBytes.length) {
      break;
    }

    if (chunkType === 'IHDR') {
      width = pngBytes.readUInt32BE(dataStart);
      height = pngBytes.readUInt32BE(dataStart + 4);
      bitDepth = pngBytes.readUInt8(dataStart + 8);
      colorType = pngBytes.readUInt8(dataStart + 9);
    } else if (chunkType === 'IDAT') {
      idatChunks.push(pngBytes.subarray(dataStart, dataEnd));
    } else if (chunkType === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0 || bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`Unsupported PNG format (w=${width}, h=${height}, depth=${bitDepth}, color=${colorType}).`);
  }

  const srcBpp = colorType === 6 ? 4 : 3;
  const srcStride = width * srcBpp;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const unfiltered = new Uint8Array(height * srcStride);
  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (srcStride + 1);
    const filterType = inflated[rowStart];
    const destRowStart = y * srcStride;
    const prevRowStart = (y - 1) * srcStride;

    for (let i = 0; i < srcStride; i += 1) {
      const raw = inflated[rowStart + 1 + i];
      const left = i >= srcBpp ? unfiltered[destRowStart + i - srcBpp] : 0;
      const up = y > 0 ? unfiltered[prevRowStart + i] : 0;
      const upLeft = y > 0 && i >= srcBpp ? unfiltered[prevRowStart + i - srcBpp] : 0;

      let recon = raw;
      if (filterType === 1) {
        recon = (raw + left) & 0xff;
      } else if (filterType === 2) {
        recon = (raw + up) & 0xff;
      } else if (filterType === 3) {
        recon = (raw + ((left + up) >> 1)) & 0xff;
      } else if (filterType === 4) {
        recon = (raw + paethPredictor(left, up, upLeft)) & 0xff;
      }
      unfiltered[destRowStart + i] = recon;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIdx = y * srcStride + x * srcBpp;
      const dstIdx = (y * width + x) * 4;
      rgba[dstIdx] = unfiltered[srcIdx];
      rgba[dstIdx + 1] = unfiltered[srcIdx + 1];
      rgba[dstIdx + 2] = unfiltered[srcIdx + 2];
      rgba[dstIdx + 3] = srcBpp === 4 ? unfiltered[srcIdx + 3] : 255;
    }
  }

  return { width, height, data: rgba };
};

const sampleBilinearRgb = (
  img: DecodedRgbaImage,
  u: number,
  v: number
): readonly [number, number, number] => {
  const clampedU = Math.min(0.999, Math.max(0.0, u));
  const clampedV = Math.min(0.999, Math.max(0.0, v));
  const fx = clampedU * (img.width - 1);
  const fy = clampedV * (img.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(img.width - 1, x0 + 1);
  const y1 = Math.min(img.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const idx00 = (y0 * img.width + x0) * 4;
  const idx10 = (y0 * img.width + x1) * 4;
  const idx01 = (y1 * img.width + x0) * 4;
  const idx11 = (y1 * img.width + x1) * 4;

  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;

  const r =
    img.data[idx00] * w00 + img.data[idx10] * w10 + img.data[idx01] * w01 + img.data[idx11] * w11;
  const g =
    img.data[idx00 + 1] * w00 + img.data[idx10 + 1] * w10 + img.data[idx01 + 1] * w01 + img.data[idx11 + 1] * w11;
  const b =
    img.data[idx00 + 2] * w00 + img.data[idx10 + 2] * w10 + img.data[idx01 + 2] * w01 + img.data[idx11 + 2] * w11;

  return [r, g, b];
};

const smoothStep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const resolvePoseForFrame = (frameIndex: number): Y4mPoseParameters => {
  // Phase 1 (0..34): CENTER neutral frontal pose with subtle breathing
  if (frameIndex < 35) {
    const t = frameIndex / 34;
    return {
      yawDeg: Math.sin(t * Math.PI * 2) * 1.4,
      pitchDeg: Math.sin(t * Math.PI * 2) * 1.1,
      eyeOpenness: 1.0
    };
  }

  // Phase 2 (35..69): RIGHT turn (+24 deg)
  if (frameIndex < 70) {
    const local = frameIndex - 35;
    const ramp = smoothStep(0, 12, local) * (1 - 0.1 * smoothStep(26, 34, local));
    return {
      yawDeg: 24.0 * ramp,
      pitchDeg: 0.9 * Math.sin((local / 35) * Math.PI),
      eyeOpenness: 1.0
    };
  }

  // Phase 3 (70..104): LEFT turn (-24 deg)
  if (frameIndex < 105) {
    const local = frameIndex - 70;
    const ramp = smoothStep(0, 12, local) * (1 - 0.1 * smoothStep(26, 34, local));
    return {
      yawDeg: -24.0 * ramp,
      pitchDeg: 0.9 * Math.sin((local / 35) * Math.PI),
      eyeOpenness: 1.0
    };
  }

  // Phase 4 (105..149): Return to center + deliberate blink dip (frames 120..131) + micro pitch
  const local = frameIndex - 105;
  let eyeOpenness = 1.0;
  if (frameIndex >= 119 && frameIndex <= 132) {
    const blinkT = (frameIndex - 119) / 13;
    eyeOpenness = Math.max(0.05, 1.0 - Math.sin(blinkT * Math.PI) * 0.95);
  }
  const pitch = frameIndex >= 134 ? 10.0 * smoothStep(134, 142, frameIndex) * (1 - 0.3 * smoothStep(143, 149, frameIndex)) : 0;

  return {
    yawDeg: Math.sin((local / 44) * Math.PI) * 1.1,
    pitchDeg: pitch,
    eyeOpenness
  };
};

const renderPhotorealisticY4mFrame = (
  portrait: DecodedRgbaImage,
  params: Y4mPoseParameters,
  frameIndex: number,
  yPlane: Uint8Array,
  uPlane: Uint8Array,
  vPlane: Uint8Array
): void => {
  // Portrait square placement centered horizontally so head fits inside the live camera oval (320, 240, rx=168, ry=204)
  const squareSize = 468;
  const sinYaw = Math.sin((params.yawDeg * Math.PI) / 180);
  const cosYaw = Math.cos((params.yawDeg * Math.PI) / 180);
  const headCenterShiftPx = sinYaw * 58;
  const pitchShiftPx = -Math.sin((params.pitchDeg * Math.PI) / 180) * 18;

  const originX = (Y4M_WIDTH - squareSize) * 0.5 + headCenterShiftPx;
  const originY = 14 + pitchShiftPx;

  const [bgR0, bgG0, bgB0] = sampleBilinearRgb(portrait, 0.04, 0.04);
  const blinkClosure = 1.0 - params.eyeOpenness;

  const rgbR = new Float32Array(Y4M_WIDTH * Y4M_HEIGHT);
  const rgbG = new Float32Array(Y4M_WIDTH * Y4M_HEIGHT);
  const rgbB = new Float32Array(Y4M_WIDTH * Y4M_HEIGHT);

  for (let py = 0; py < Y4M_HEIGHT; py += 1) {
    const rawV = (py - originY) / squareSize;
    for (let px = 0; px < Y4M_WIDTH; px += 1) {
      const idx = py * Y4M_WIDTH + px;
      const rawU = (px - originX) / squareSize;

      // Subtle cylindrical horizontal perspective warp on the facial column during yaw turn
      const dxFromCenter = rawU - 0.5;
      const inVerticalHead = rawV >= 0.06 && rawV <= 0.72;
      const radialFaceMask = inVerticalHead
        ? Math.max(0, 1 - Math.abs(dxFromCenter) / 0.28)
        : 0;
      const warpedU = rawU - sinYaw * 0.14 * radialFaceMask + (dxFromCenter * (1 - cosYaw) * 0.25 * radialFaceMask);
      const warpedV = rawV + Math.sin((params.pitchDeg * Math.PI) / 180) * 0.02 * radialFaceMask;

      let r: number;
      let g: number;
      let b: number;

      if (warpedU >= 0 && warpedU <= 1 && warpedV >= 0 && warpedV <= 1) {
        [r, g, b] = sampleBilinearRgb(portrait, warpedU, warpedV);

        // Eyelid blink overlay over Elena's left/right eyes in UV coordinates (~0.405, 0.408) & (~0.592, 0.408)
        if (blinkClosure > 0.04) {
          const leftEyeDx = (warpedU - 0.406) / 0.056;
          const rightEyeDx = (warpedU - 0.594) / 0.056;
          const leftEyeDy = (warpedV - 0.408) / 0.026;
          const rightEyeDy = (warpedV - 0.408) / 0.026;

          const leftSq = leftEyeDx * leftEyeDx + leftEyeDy * leftEyeDy;
          const rightSq = rightEyeDx * rightEyeDx + rightEyeDy * rightEyeDy;
          const eyeMask = leftSq <= 1.0 ? leftSq : rightSq <= 1.0 ? rightSq : 2.0;

          if (eyeMask <= 1.0) {
            const lidWeight = blinkClosure * (1.0 - eyeMask * 0.28);
            const [lidR, lidG, lidB] = sampleBilinearRgb(portrait, warpedU, 0.378);
            const lashCrease = Math.abs(warpedV - (0.394 + blinkClosure * 0.024)) < 0.0045 ? 0.52 : 1.0;
            r = r * (1 - lidWeight) + lidR * lashCrease * lidWeight;
            g = g * (1 - lidWeight) + lidG * lashCrease * lidWeight;
            b = b * (1 - lidWeight) + lidB * lashCrease * lidWeight;
          }
        }

        // Subtle directional illumination shift matching head yaw
        if (radialFaceMask > 0) {
          const shade = 1.0 - sinYaw * dxFromCenter * 0.22 * radialFaceMask;
          r *= shade;
          g *= shade;
          b *= shade;
        }
      } else {
        // Seamless studio backdrop extension matching Elena portrait borders + soft camera vignette
        const vig = 1.0 - 0.08 * ((px / Y4M_WIDTH - 0.5) ** 2 + (py / Y4M_HEIGHT - 0.5) ** 2);
        r = bgR0 * vig;
        g = bgG0 * vig;
        b = bgB0 * vig;
      }

      // Micro temporal photon sensor variation across frames to sustain high-FPS live signal delta
      const grain = (((px * 73856093) ^ (py * 19349663) ^ (frameIndex * 83492791)) & 3) - 1.5;
      const crR = clampByte(r + grain);
      const crG = clampByte(g + grain);
      const crB = clampByte(b + grain);

      rgbR[idx] = crR;
      rgbG[idx] = crG;
      rgbB[idx] = crB;

      const yVal = 0.299 * crR + 0.587 * crG + 0.114 * crB;
      yPlane[idx] = clampByte(yVal);
    }
  }

  // 4:2:0 subsampled chroma planes (320x240)
  const cw = Y4M_WIDTH >> 1;
  const ch = Y4M_HEIGHT >> 1;
  for (let cy = 0; cy < ch; cy += 1) {
    const py = cy << 1;
    const row0 = py * Y4M_WIDTH;
    const row1 = (py + 1) * Y4M_WIDTH;
    for (let cx = 0; cx < cw; cx += 1) {
      const px = cx << 1;
      const avgR = (rgbR[row0 + px] + rgbR[row0 + px + 1] + rgbR[row1 + px] + rgbR[row1 + px + 1]) * 0.25;
      const avgG = (rgbG[row0 + px] + rgbG[row0 + px + 1] + rgbG[row1 + px] + rgbG[row1 + px + 1]) * 0.25;
      const avgB = (rgbB[row0 + px] + rgbB[row0 + px + 1] + rgbB[row1 + px] + rgbB[row1 + px + 1]) * 0.25;

      const cb = 128 - 0.168736 * avgR - 0.331264 * avgG + 0.5 * avgB;
      const cr = 128 + 0.5 * avgR - 0.418688 * avgG - 0.081312 * avgB;

      const cIdx = cy * cw + cx;
      uPlane[cIdx] = clampByte(cb);
      vPlane[cIdx] = clampByte(cr);
    }
  }
};

const readRequiredAssetBuffer = (fileName: string): Buffer => {
  const fullPath = join(ASSETS_DIR, fileName);
  if (!existsSync(fullPath)) {
    throw new Error(`Required photorealistic test asset is missing: ${fullPath}`);
  }
  return readFileSync(fullPath);
};

export const createMultiPoseFaceY4mBuffer = (): Buffer => {
  const portrait = decodePngToRgba(readRequiredAssetBuffer('elena_headshot_280.png'));
  const headerBuf = Buffer.from(Y4M_HEADER, 'ascii');
  const frameTagBuf = Buffer.from('FRAME\n', 'ascii');
  const ySize = Y4M_WIDTH * Y4M_HEIGHT;
  const uvSize = (Y4M_WIDTH >> 1) * (Y4M_HEIGHT >> 1);
  const framePayloadSize = ySize + uvSize * 2;
  const singleFrameBlockSize = frameTagBuf.length + framePayloadSize;

  const output = Buffer.allocUnsafe(headerBuf.length + Y4M_FRAME_COUNT * singleFrameBlockSize);
  headerBuf.copy(output, 0);

  for (let i = 0; i < Y4M_FRAME_COUNT; i += 1) {
    const offset = headerBuf.length + i * singleFrameBlockSize;
    frameTagBuf.copy(output, offset);

    const yOffset = offset + frameTagBuf.length;
    const uOffset = yOffset + ySize;
    const vOffset = uOffset + uvSize;

    const yView = output.subarray(yOffset, uOffset);
    const uView = output.subarray(uOffset, vOffset);
    const vView = output.subarray(vOffset, vOffset + uvSize);

    const params = resolvePoseForFrame(i);
    renderPhotorealisticY4mFrame(portrait, params, i, yView, uView, vView);
  }

  return output;
};

export const createElenaMatchingDriversLicenseFrontPngBuffer = (): Buffer =>
  readRequiredAssetBuffer('elena_drivers_front.png');

export const createElenaMatchingDriversLicenseBackPngBuffer = (): Buffer =>
  readRequiredAssetBuffer('elena_drivers_back.png');

export const createNonMatchingPersonDriversLicensePngBuffer = (): Buffer =>
  readRequiredAssetBuffer('marco_drivers_front.png');

export const createPhilsysFrontPngBuffer = (): Buffer =>
  readRequiredAssetBuffer('elena_philsys_front.png');

export const createPhilsysBackPngBuffer = (): Buffer =>
  readRequiredAssetBuffer('elena_philsys_back.png');

export const createWatermarkSpecimenPngBuffer = (): Buffer =>
  readRequiredAssetBuffer('elena_specimen_front.png');

export const writeY4mAndMatchingIdArtifacts = (outputDir: string): Y4mAndIdFixturePaths => {
  mkdirSync(outputDir, { recursive: true });

  const y4mPath = join(outputDir, 'elena_multipose_liveness.y4m');
  const frontIdPath = join(outputDir, 'elena_drivers_front.png');
  const backIdPath = join(outputDir, 'elena_drivers_back.png');
  const nonMatchingFrontIdPath = join(outputDir, 'marco_mismatch_drivers_front.png');
  const philsysWrongTypePath = join(outputDir, 'elena_philsys_wrong_type_front.png');
  const philsysBackPath = join(outputDir, 'elena_philsys_wrong_type_back.png');
  const specimenFakePath = join(outputDir, 'elena_specimen_fake_front.png');

  writeFileSync(y4mPath, createMultiPoseFaceY4mBuffer());
  writeFileSync(frontIdPath, createElenaMatchingDriversLicenseFrontPngBuffer());
  writeFileSync(backIdPath, createElenaMatchingDriversLicenseBackPngBuffer());
  writeFileSync(nonMatchingFrontIdPath, createNonMatchingPersonDriversLicensePngBuffer());
  writeFileSync(philsysWrongTypePath, createPhilsysFrontPngBuffer());
  writeFileSync(philsysBackPath, createPhilsysBackPngBuffer());
  writeFileSync(specimenFakePath, createWatermarkSpecimenPngBuffer());

  return {
    y4mPath,
    frontIdPath,
    backIdPath,
    nonMatchingFrontIdPath,
    philsysWrongTypePath,
    philsysBackPath,
    specimenFakePath
  };
};
