/**
 * ResQTrack Incident AI System Detection -- DIP Core Geometry & Segmentation
 * Module: homography.ts
 *
 * Perspective Transformation & Geometric Rectification:
 * - Deterministic 4-corner topological ordering (TL, TR, BR, BL)
 * - 8x8 Direct Linear Transformation (DLT) Homography Solver
 * - Gaussian Elimination with Partial Pivoting
 * - Inverse Homography Calculation
 * - Backward Perspective Warping with Sub-Pixel Bilinear Interpolation
 *
 * Standards:
 * - Strict TypeScript with ZERO 'any'
 * - 100% Universal Lambda syntax (`=>`)
 * - High-efficiency typed arrays (Float64Array, Uint8ClampedArray)
 */

import { Point2D } from './cannyHough';

export interface OrderedCorners {
  tl: Point2D;
  tr: Point2D;
  br: Point2D;
  bl: Point2D;
}

/**
 * Orders 4 arbitrary quadrilateral corner points into a deterministic canonical order:
 * - Top-Left (TL): Minimum sum (x + y)
 * - Bottom-Right (BR): Maximum sum (x + y)
 * - Top-Right (TR): Minimum difference (y - x)
 * - Bottom-Left (BL): Maximum difference (y - x)
 */
export const orderCorners = (corners: Point2D[]): OrderedCorners => {
  if (corners.length !== 4) {
    throw new Error(`orderCorners requires exactly 4 points, got ${corners.length}`);
  }

  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;

  let tl: Point2D = corners[0];
  let br: Point2D = corners[0];
  let tr: Point2D = corners[0];
  let bl: Point2D = corners[0];

  for (let i = 0; i < 4; i++) {
    const pt = corners[i];
    const sum = pt.x + pt.y;
    const diff = pt.y - pt.x;

    if (sum < minSum) {
      minSum = sum;
      tl = pt;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = pt;
    }
    if (diff < minDiff) {
      minDiff = diff;
      tr = pt;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      bl = pt;
    }
  }

  // Safety verification: ensure all 4 points are distinct
  const uniqueCount = new Set([
    `${tl.x},${tl.y}`,
    `${tr.x},${tr.y}`,
    `${br.x},${br.y}`,
    `${bl.x},${bl.y}`,
  ]).size;

  if (uniqueCount !== 4) {
    // Centroid-based angular fallback if corner projection had ties
    const cx = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
    const cy = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
    const sorted = corners
      .slice()
      .sort(
        (a, b) =>
          Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
      );

    // sorted: [BR/TR/TL/BL] depending on angle. Find the one with smallest x+y as TL
    let tlIdx = 0;
    let bestSum = Infinity;
    for (let i = 0; i < 4; i++) {
      const s = sorted[i].x + sorted[i].y;
      if (s < bestSum) {
        bestSum = s;
        tlIdx = i;
      }
    }

    tl = sorted[tlIdx];
    tr = sorted[(tlIdx + 1) % 4];
    br = sorted[(tlIdx + 2) % 4];
    bl = sorted[(tlIdx + 3) % 4];
  }

  return { tl, tr, br, bl };
};

/**
 * Solves the 3x3 projective transformation matrix (Homography) mapping
 * 4 source point correspondences to 4 destination point correspondences.
 *
 * Implements the Direct Linear Transformation (DLT) algorithm by setting up
 * an 8x8 system Ah = b and solving via Gaussian Elimination with Partial Pivoting.
 *
 * Returns a 9-element Float64Array representing the 3x3 row-major homography matrix.
 */
export const solveHomography = (
  src: Point2D[],
  dst: Point2D[]
): Float64Array => {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('solveHomography requires exactly 4 source and 4 destination points');
  }

  // Setup 8x8 matrix A and 8-element vector b
  const A = new Float64Array(64); // 8 rows x 8 cols
  const b = new Float64Array(8);

  for (let i = 0; i < 4; i++) {
    const xs = src[i].x;
    const ys = src[i].y;
    const xd = dst[i].x;
    const yd = dst[i].y;

    const row1 = (2 * i) * 8;
    const row2 = (2 * i + 1) * 8;

    // Row 2*i: [xs, ys, 1,  0,  0, 0, -xd*xs, -xd*ys] * h = xd
    A[row1 + 0] = xs;
    A[row1 + 1] = ys;
    A[row1 + 2] = 1.0;
    A[row1 + 3] = 0.0;
    A[row1 + 4] = 0.0;
    A[row1 + 5] = 0.0;
    A[row1 + 6] = -xd * xs;
    A[row1 + 7] = -xd * ys;
    b[2 * i] = xd;

    // Row 2*i + 1: [ 0,  0, 0, xs, ys, 1, -yd*xs, -yd*ys] * h = yd
    A[row2 + 0] = 0.0;
    A[row2 + 1] = 0.0;
    A[row2 + 2] = 0.0;
    A[row2 + 3] = xs;
    A[row2 + 4] = ys;
    A[row2 + 5] = 1.0;
    A[row2 + 6] = -yd * xs;
    A[row2 + 7] = -yd * ys;
    b[2 * i + 1] = yd;
  }

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    // 1. Pivot search
    let maxRow = col;
    let maxVal = Math.abs(A[col * 8 + col]);
    for (let r = col + 1; r < 8; r++) {
      const val = Math.abs(A[r * 8 + col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = r;
      }
    }

    if (maxVal < 1e-12) {
      throw new Error('solveHomography failed: Singular or degenerate point configuration');
    }

    // 2. Row swap
    if (maxRow !== col) {
      for (let c = 0; c < 8; c++) {
        const tmpA = A[col * 8 + c];
        A[col * 8 + c] = A[maxRow * 8 + c];
        A[maxRow * 8 + c] = tmpA;
      }
      const tmpB = b[col];
      b[col] = b[maxRow];
      b[maxRow] = tmpB;
    }

    // 3. Elimination
    const pivot = A[col * 8 + col];
    for (let r = col + 1; r < 8; r++) {
      const factor = A[r * 8 + col] / pivot;
      A[r * 8 + col] = 0.0;
      for (let c = col + 1; c < 8; c++) {
        A[r * 8 + c] -= factor * A[col * 8 + c];
      }
      b[r] -= factor * b[col];
    }
  }

  // Back substitution
  const h = new Float64Array(8);
  for (let r = 7; r >= 0; r--) {
    let sum = b[r];
    for (let c = r + 1; c < 8; c++) {
      sum -= A[r * 8 + c] * h[c];
    }
    h[r] = sum / A[r * 8 + r];
  }

  // Return full 3x3 homography matrix with h22 normalized to 1.0
  return new Float64Array([
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1.0,
  ]);
};

/**
 * Computes the inverse of a 3x3 homography matrix using the analytic adjugate method.
 */
export const invertHomography = (H: Float64Array): Float64Array => {
  const h00 = H[0];
  const h01 = H[1];
  const h02 = H[2];
  const h10 = H[3];
  const h11 = H[4];
  const h12 = H[5];
  const h20 = H[6];
  const h21 = H[7];
  const h22 = H[8];

  const c00 = h11 * h22 - h12 * h21;
  const c01 = h12 * h20 - h10 * h22;
  const c02 = h10 * h21 - h11 * h20;

  const det = h00 * c00 + h01 * c01 + h02 * c02;
  if (Math.abs(det) < 1e-12) {
    throw new Error('Homography matrix is non-invertible (determinant near zero)');
  }

  const invDet = 1.0 / det;
  const inv = new Float64Array(9);

  inv[0] = c00 * invDet;
  inv[1] = (h02 * h21 - h01 * h22) * invDet;
  inv[2] = (h01 * h12 - h02 * h11) * invDet;

  inv[3] = c01 * invDet;
  inv[4] = (h00 * h22 - h02 * h20) * invDet;
  inv[5] = (h02 * h10 - h00 * h12) * invDet;

  inv[6] = c02 * invDet;
  inv[7] = (h01 * h20 - h00 * h21) * invDet;
  inv[8] = (h00 * h11 - h01 * h10) * invDet;

  return inv;
};

/**
 * Creates an ImageData instance safely across DOM, Web Worker, and Node environments.
 */
const createSafeImageData = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): ImageData => {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(pixels as unknown as ImageData['data'], width, height);
  }
  return {
    width,
    height,
    data: pixels,
    colorSpace: 'srgb',
  } as ImageData;
};

/**
 * Warps a perspective region defined by homography matrix H into a rectified
 * axis-aligned destination canvas (dstWidth x dstHeight).
 *
 * Applies backward mapping through H^-1 with sub-pixel bilinear interpolation
 * across all RGBA color channels.
 *
 * @param src Source image data (ImageData)
 * @param H Forward homography matrix mapping source coordinates to destination coordinates
 * @param dstWidth Desired rectified output width in pixels
 * @param dstHeight Desired rectified output height in pixels
 * @returns Rectified destination image data
 */
export const warpPerspective = (
  src: ImageData,
  H: Float64Array,
  dstWidth: number,
  dstHeight: number
): ImageData => {
  const invH = invertHomography(H);
  const m00 = invH[0];
  const m01 = invH[1];
  const m02 = invH[2];
  const m10 = invH[3];
  const m11 = invH[4];
  const m12 = invH[5];
  const m20 = invH[6];
  const m21 = invH[7];
  const m22 = invH[8];

  const srcData = src.data;
  const srcW = src.width;
  const srcH = src.height;

  const dstPixels = new Uint8ClampedArray(dstWidth * dstHeight * 4);

  for (let dy = 0; dy < dstHeight; dy++) {
    const dstRowOffset = dy * dstWidth * 4;

    for (let dx = 0; dx < dstWidth; dx++) {
      const w = m20 * dx + m21 * dy + m22;
      if (Math.abs(w) < 1e-9) continue;

      const invW = 1.0 / w;
      const sx = (m00 * dx + m01 * dy + m02) * invW;
      const sy = (m10 * dx + m11 * dy + m12) * invW;

      // Coordinate bounds check
      if (sx < 0 || sx > srcW - 1 || sy < 0 || sy > srcH - 1) {
        continue;
      }

      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y0 = Math.floor(sy);
      const y1 = Math.min(srcH - 1, y0 + 1);

      const fx = sx - x0;
      const fy = sy - y0;

      const w00 = (1.0 - fx) * (1.0 - fy);
      const w10 = fx * (1.0 - fy);
      const w01 = (1.0 - fx) * fy;
      const w11 = fx * fy;

      const row0 = y0 * srcW * 4;
      const row1 = y1 * srcW * 4;
      const p00 = row0 + x0 * 4;
      const p10 = row0 + x1 * 4;
      const p01 = row1 + x0 * 4;
      const p11 = row1 + x1 * 4;

      const dstIdx = dstRowOffset + dx * 4;

      dstPixels[dstIdx] = Math.round(
        w00 * srcData[p00] +
        w10 * srcData[p10] +
        w01 * srcData[p01] +
        w11 * srcData[p11]
      );
      dstPixels[dstIdx + 1] = Math.round(
        w00 * srcData[p00 + 1] +
        w10 * srcData[p10 + 1] +
        w01 * srcData[p01 + 1] +
        w11 * srcData[p11 + 1]
      );
      dstPixels[dstIdx + 2] = Math.round(
        w00 * srcData[p00 + 2] +
        w10 * srcData[p10 + 2] +
        w01 * srcData[p01 + 2] +
        w11 * srcData[p11 + 2]
      );
      dstPixels[dstIdx + 3] = Math.round(
        w00 * srcData[p00 + 3] +
        w10 * srcData[p10 + 3] +
        w01 * srcData[p01 + 3] +
        w11 * srcData[p11 + 3]
      );
    }
  }

  return createSafeImageData(dstPixels, dstWidth, dstHeight);
};
