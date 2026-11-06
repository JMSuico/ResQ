/**
 * ResQTrack Incident AI System Detection -- DIP Core Geometry & Segmentation
 * Module: imageOps.ts
 *
 * Foundational Digital Image Processing (DIP) mathematical operations:
 * - ITU-R BT.601 Grayscale Conversion
 * - Separable 5x5 Gaussian Blur
 * - 3x3 Sobel Gradient Computation (Magnitude, Angle, Gx, Gy)
 * - Summed-Area Table (Integral Image) Computation
 * - Multi-Channel Bilinear Pixel Sampling
 * - High-Efficiency Bilinear Buffer Resizing
 *
 * Standards:
 * - Strict TypeScript with ZERO 'any'
 * - 100% Universal Lambda syntax (`=>`)
 * - High-efficiency typed arrays (Uint8ClampedArray, Float32Array, Float64Array)
 */

export interface SobelResult {
  magnitude: Float32Array;
  angle: Float32Array;
  gx: Float32Array;
  gy: Float32Array;
}

/**
 * Converts RGBA pixel data to a single-channel grayscale Float32Array
 * using the standard ITU-R BT.601 luma formula: Y = 0.299*R + 0.587*G + 0.114*B.
 */
export const toGrayscale = (
  data: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array => {
  const totalPixels = width * height;
  const gray = new Float32Array(totalPixels);
  let srcOffset = 0;

  for (let i = 0; i < totalPixels; i++) {
    const r = data[srcOffset];
    const g = data[srcOffset + 1];
    const b = data[srcOffset + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    srcOffset += 4;
  }

  return gray;
};

/**
 * Applies a separable 5x5 Gaussian Blur filter to a single-channel image.
 * Uses two 1D convolution passes (horizontal then vertical) with replicated boundary clamping.
 * Default sigma = 1.4 for optimal Canny edge detection pre-filtering.
 */
export const gaussianBlur5x5 = (
  gray: Float32Array,
  width: number,
  height: number,
  sigma = 1.4
): Float32Array => {
  // Dynamically compute normalized 1D 5-element Gaussian kernel
  const kernel = new Float32Array(5);
  let kernelSum = 0;
  const twoSigmaSq = 2 * sigma * sigma;

  for (let i = -2; i <= 2; i++) {
    const v = Math.exp(-(i * i) / twoSigmaSq);
    kernel[i + 2] = v;
    kernelSum += v;
  }
  for (let i = 0; i < 5; i++) {
    kernel[i] /= kernelSum;
  }

  const k0 = kernel[0];
  const k1 = kernel[1];
  const k2 = kernel[2];
  const k3 = kernel[3];
  const k4 = kernel[4];

  const totalPixels = width * height;
  const temp = new Float32Array(totalPixels);
  const out = new Float32Array(totalPixels);

  // Horizontal 1D Convolution Pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const xm2 = x >= 2 ? x - 2 : 0;
      const xm1 = x >= 1 ? x - 1 : 0;
      const xp1 = x < width - 1 ? x + 1 : width - 1;
      const xp2 = x < width - 2 ? x + 2 : width - 1;

      temp[rowOffset + x] =
        gray[rowOffset + xm2] * k0 +
        gray[rowOffset + xm1] * k1 +
        gray[rowOffset + x] * k2 +
        gray[rowOffset + xp1] * k3 +
        gray[rowOffset + xp2] * k4;
    }
  }

  // Vertical 1D Convolution Pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const ym2 = y >= 2 ? y - 2 : 0;
      const ym1 = y >= 1 ? y - 1 : 0;
      const yp1 = y < height - 1 ? y + 1 : height - 1;
      const yp2 = y < height - 2 ? y + 2 : height - 1;

      out[y * width + x] =
        temp[ym2 * width + x] * k0 +
        temp[ym1 * width + x] * k1 +
        temp[y * width + x] * k2 +
        temp[yp1 * width + x] * k3 +
        temp[yp2 * width + x] * k4;
    }
  }

  return out;
};

/**
 * Computes image gradients using 3x3 Sobel kernels:
 *   Gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
 *   Gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
 *
 * Returns magnitude, angle in radians [-PI, PI], and directional components gx, gy.
 */
export const sobelGradients = (
  gray: Float32Array,
  width: number,
  height: number
): SobelResult => {
  const totalPixels = width * height;
  const magnitude = new Float32Array(totalPixels);
  const angle = new Float32Array(totalPixels);
  const gx = new Float32Array(totalPixels);
  const gy = new Float32Array(totalPixels);

  for (let y = 0; y < height; y++) {
    const ym1 = y > 0 ? y - 1 : 0;
    const yp1 = y < height - 1 ? y + 1 : height - 1;

    const rowOffset = y * width;
    const rowOffsetM1 = ym1 * width;
    const rowOffsetP1 = yp1 * width;

    for (let x = 0; x < width; x++) {
      const xm1 = x > 0 ? x - 1 : 0;
      const xp1 = x < width - 1 ? x + 1 : width - 1;

      const tl = gray[rowOffsetM1 + xm1];
      const tc = gray[rowOffsetM1 + x];
      const tr = gray[rowOffsetM1 + xp1];

      const ml = gray[rowOffset + xm1];
      const mr = gray[rowOffset + xp1];

      const bl = gray[rowOffsetP1 + xm1];
      const bc = gray[rowOffsetP1 + x];
      const br = gray[rowOffsetP1 + xp1];

      const gXVal = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gYVal = -tl - 2 * tc - tr + bl + 2 * bc + br;

      const idx = rowOffset + x;
      gx[idx] = gXVal;
      gy[idx] = gYVal;
      magnitude[idx] = Math.hypot(gXVal, gYVal);
      angle[idx] = Math.atan2(gYVal, gXVal);
    }
  }

  return { magnitude, angle, gx, gy };
};

/**
 * Computes the summed-area table (integral image) of size (width + 1) * (height + 1).
 * II(x, y) = sum of all gray(x', y') for x' < x, y' < y.
 * Output is represented as a Float64Array to prevent numerical precision overflow.
 */
export const computeIntegralImage = (
  gray: Float32Array,
  width: number,
  height: number
): Float64Array => {
  const stride = width + 1;
  const integral = new Float64Array((width + 1) * (height + 1));

  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    const rowOffset = y * stride;
    const prevRowOffset = (y - 1) * stride;
    const grayOffset = (y - 1) * width;

    for (let x = 1; x <= width; x++) {
      rowSum += gray[grayOffset + (x - 1)];
      integral[rowOffset + x] = integral[prevRowOffset + x] + rowSum;
    }
  }

  return integral;
};

/**
 * Queries the sum of pixel values within a bounding box [x0, y0] to [x1, y1] (inclusive)
 * using the precomputed (width + 1) * (height + 1) integral image in O(1) time.
 */
export const queryIntegralArea = (
  integral: Float64Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number => {
  const stride = width + 1;
  const height = integral.length / stride - 1;

  const minX = Math.max(0, Math.min(width - 1, Math.floor(Math.min(x0, x1))));
  const maxX = Math.max(0, Math.min(width - 1, Math.floor(Math.max(x0, x1))));
  const minY = Math.max(0, Math.min(height - 1, Math.floor(Math.min(y0, y1))));
  const maxY = Math.max(0, Math.min(height - 1, Math.floor(Math.max(y0, y1))));

  const xRight = maxX + 1;
  const yBottom = maxY + 1;

  const br = yBottom * stride + xRight;
  const bl = yBottom * stride + minX;
  const tr = minY * stride + xRight;
  const tl = minY * stride + minX;

  return integral[br] - integral[bl] - integral[tr] + integral[tl];
};

/**
 * Samples sub-pixel coordinates (x, y) with bilinear interpolation.
 * Supports single-channel (Float32Array) or multi-channel (Uint8ClampedArray).
 *
 * @param image Input buffer (length = width * height * channels)
 * @param width Buffer width in pixels
 * @param height Buffer height in pixels
 * @param x Floating-point x-coordinate
 * @param y Floating-point y-coordinate
 * @param channels Number of channels per pixel (1 = Grayscale, 4 = RGBA). Default: 1
 * @returns Interpolated values per channel as number[]
 */
export const bilinearSample = (
  image: Float32Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  channels = 1
): number[] => {
  const result: number[] = new Array<number>(channels);

  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));

  const x0 = Math.floor(clampedX);
  const x1 = Math.min(width - 1, x0 + 1);
  const y0 = Math.floor(clampedY);
  const y1 = Math.min(height - 1, y0 + 1);

  const dx = clampedX - x0;
  const dy = clampedY - y0;

  const w00 = (1 - dx) * (1 - dy);
  const w10 = dx * (1 - dy);
  const w01 = (1 - dx) * dy;
  const w11 = dx * dy;

  const row0 = y0 * width;
  const row1 = y1 * width;

  for (let c = 0; c < channels; c++) {
    const idx00 = (row0 + x0) * channels + c;
    const idx10 = (row0 + x1) * channels + c;
    const idx01 = (row1 + x0) * channels + c;
    const idx11 = (row1 + x1) * channels + c;

    result[c] =
      w00 * image[idx00] +
      w10 * image[idx10] +
      w01 * image[idx01] +
      w11 * image[idx11];
  }

  return result;
};

/**
 * Resizes an RGBA buffer (Uint8ClampedArray) to (dstW, dstH) using bilinear interpolation.
 * Operates at high performance without DOM overhead.
 */
export const resizeBilinear = (
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8ClampedArray => {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const srcY = (dy + 0.5) * yRatio - 0.5;
    const clampedY = Math.max(0, Math.min(srcH - 1, srcY));
    const y0 = Math.floor(clampedY);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const fy = clampedY - y0;

    const row0 = y0 * srcW * 4;
    const row1 = y1 * srcW * 4;
    const dstRow = dy * dstW * 4;

    for (let dx = 0; dx < dstW; dx++) {
      const srcX = (dx + 0.5) * xRatio - 0.5;
      const clampedX = Math.max(0, Math.min(srcW - 1, srcX));
      const x0 = Math.floor(clampedX);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const fx = clampedX - x0;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const p00 = row0 + x0 * 4;
      const p10 = row0 + x1 * 4;
      const p01 = row1 + x0 * 4;
      const p11 = row1 + x1 * 4;
      const dstIdx = dstRow + dx * 4;

      dst[dstIdx] = Math.round(
        w00 * src[p00] + w10 * src[p10] + w01 * src[p01] + w11 * src[p11]
      );
      dst[dstIdx + 1] = Math.round(
        w00 * src[p00 + 1] + w10 * src[p10 + 1] + w01 * src[p01 + 1] + w11 * src[p11 + 1]
      );
      dst[dstIdx + 2] = Math.round(
        w00 * src[p00 + 2] + w10 * src[p10 + 2] + w01 * src[p01 + 2] + w11 * src[p11 + 2]
      );
      dst[dstIdx + 3] = Math.round(
        w00 * src[p00 + 3] + w10 * src[p10 + 3] + w01 * src[p01 + 3] + w11 * src[p11 + 3]
      );
    }
  }

  return dst;
};
