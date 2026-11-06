/**
 * ResQTrack Incident AI System Detection -- DIP Core Geometry & Segmentation
 * Module: cannyHough.ts
 *
 * Edge Detection & Parametric Hough Transform:
 * - Dynamic Auto-Canny with median-derived hysteresis thresholds
 * - Directional Non-Maximum Suppression (NMS)
 * - 8-Connected Hysteresis Edge Tracking
 * - Parametric Standard Hough Transform in (rho, theta) accumulator space
 * - Accumulator Non-Maximum Suppression & Thresholding
 * - Line Intersection Geometry for Boundary Extraction
 *
 * Standards:
 * - Strict TypeScript with ZERO 'any'
 * - 100% Universal Lambda syntax (`=>`)
 * - High-efficiency typed arrays (Uint8Array, Float32Array, Int32Array, Float64Array)
 */

import { gaussianBlur5x5, sobelGradients } from './imageOps';

export interface HoughLine {
  rho: number;
  theta: number;
  score: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface ClusteredLines {
  horizontal: HoughLine[];
  vertical: HoughLine[];
}

/**
 * Computes an adaptive Canny edge map from a grayscale image:
 * 1. 5x5 Gaussian blur pre-filtering (sigma = 1.4)
 * 2. Rapid O(N) median intensity extraction via 256-bin histogram
 * 3. Dynamic hysteresis thresholds: high = 0.66 * median, low = 0.33 * median
 * 4. 3x3 Sobel gradients and 4-sector Non-Maximum Suppression (NMS)
 * 5. Depth/breadth-first 8-connected hysteresis edge tracking
 *
 * Returns a binary Uint8Array where 255 = edge, 0 = background.
 */
export const autoCanny = (
  gray: Float32Array,
  width: number,
  height: number
): Uint8Array => {
  const total = width * height;

  // 1. Pre-filter noise with Gaussian blur
  const blurred = gaussianBlur5x5(gray, width, height, 1.4);

  // 2. Rapid O(N) median intensity calculation
  const hist = new Int32Array(256);
  for (let i = 0; i < total; i++) {
    const val = Math.max(0, Math.min(255, Math.round(blurred[i])));
    hist[val]++;
  }

  let count = 0;
  const halfTotal = Math.floor(total / 2);
  let median = 128;
  for (let i = 0; i < 256; i++) {
    count += hist[i];
    if (count >= halfTotal) {
      median = i;
      break;
    }
  }

  // 3. Dynamic hysteresis thresholds
  // Clamped to reasonable minimum thresholds to prevent noise explosion in dark frames
  const highThreshold = Math.max(15, 0.66 * median);
  const lowThreshold = Math.max(7.5, 0.33 * median);

  // 4. Gradient magnitude and angle
  const { magnitude, angle } = sobelGradients(blurred, width, height);
  const nms = new Float32Array(total);

  // Non-Maximum Suppression along gradient direction
  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    const rowOffsetM1 = (y - 1) * width;
    const rowOffsetP1 = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;
      const mag = magnitude[idx];
      if (mag < lowThreshold) continue;

      let deg = (angle[idx] * 180) / Math.PI;
      if (deg < 0) deg += 180;

      let mag1 = 0;
      let mag2 = 0;

      if ((deg >= 0 && deg < 22.5) || (deg >= 157.5 && deg <= 180)) {
        // Sector 0: Horizontal gradient (E-W), compare with left & right
        mag1 = magnitude[rowOffset + (x - 1)];
        mag2 = magnitude[rowOffset + (x + 1)];
      } else if (deg >= 22.5 && deg < 67.5) {
        // Sector 1: Diagonal NE-SW (45 deg)
        mag1 = magnitude[rowOffsetM1 + (x + 1)];
        mag2 = magnitude[rowOffsetP1 + (x - 1)];
      } else if (deg >= 67.5 && deg < 112.5) {
        // Sector 2: Vertical gradient (N-S 90 deg), compare top & bottom
        mag1 = magnitude[rowOffsetM1 + x];
        mag2 = magnitude[rowOffsetP1 + x];
      } else {
        // Sector 3: Diagonal NW-SE (135 deg)
        mag1 = magnitude[rowOffsetM1 + (x - 1)];
        mag2 = magnitude[rowOffsetP1 + (x + 1)];
      }

      if (mag >= mag1 && mag >= mag2) {
        nms[idx] = mag;
      }
    }
  }

  // 5. Hysteresis edge tracking with preallocated stack
  const edges = new Uint8Array(total);
  const stack = new Int32Array(total);
  let stackPtr = 0;

  // Enqueue strong edges
  for (let i = 0; i < total; i++) {
    if (nms[i] >= highThreshold) {
      edges[i] = 255;
      stack[stackPtr++] = i;
    }
  }

  // 8-connected flood fill from strong edges
  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

  while (stackPtr > 0) {
    const curr = stack[--stackPtr];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    for (let k = 0; k < 8; k++) {
      const nx = cx + dx[k];
      const ny = cy + dy[k];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (edges[nIdx] === 0 && nms[nIdx] >= lowThreshold) {
          edges[nIdx] = 255;
          stack[stackPtr++] = nIdx;
        }
      }
    }
  }

  return edges;
};

/**
 * Clusters lines into horizontal (theta near 0/PI or PI/2 depending on geometric convention)
 * and vertical lines. Accommodates both standard normal angle and line-slope conventions.
 */
export const clusterLines = (lines: HoughLine[]): ClusteredLines => {
  const horizontal: HoughLine[] = [];
  const vertical: HoughLine[] = [];

  for (const line of lines) {
    const deg = (line.theta * 180) / Math.PI;
    const distFrom0Or180 = Math.min(deg, Math.abs(180 - deg));
    const distFrom90 = Math.abs(90 - deg);

    // Prompt specification & dual-convention matching:
    // In parametric rho = x*cos(theta) + y*sin(theta):
    // If line is horizontal (y = const), theta is near PI/2 (90 deg).
    // If line is vertical (x = const), theta is near 0 or PI.
    if (distFrom90 <= 35) {
      horizontal.push(line);
    } else if (distFrom0Or180 <= 35) {
      vertical.push(line);
    }
  }

  return { horizontal, vertical };
};

/**
 * Standard Hough Transform detecting parametric straight lines in binary edge maps:
 *   rho = x * cos(theta) + y * sin(theta)
 *
 * Performs local 3x3 Non-Maximum Suppression in the Hough Accumulator space
 * and returns detected lines sorted by normalized score.
 *
 * @param edges Binary edge map from autoCanny (Uint8Array, 255 = edge)
 * @param width Image width
 * @param height Image height
 * @param threshold Relative vote threshold in [0.0, 1.0] (default 0.30)
 */
export const houghLines = (
  edges: Uint8Array,
  width: number,
  height: number,
  threshold = 0.30
): HoughLine[] => {
  const maxD = Math.ceil(Math.hypot(width, height));
  const numRhos = 2 * maxD + 1;
  const numThetas = 180;
  const thetaStep = Math.PI / numThetas;

  // Precompute trigonometric tables for speed
  const cosTable = new Float64Array(numThetas);
  const sinTable = new Float64Array(numThetas);
  for (let t = 0; t < numThetas; t++) {
    const rad = t * thetaStep;
    cosTable[t] = Math.cos(rad);
    sinTable[t] = Math.sin(rad);
  }

  // Allocate 2D accumulator [numRhos x numThetas]
  const acc = new Int32Array(numRhos * numThetas);
  let maxVotes = 0;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (edges[rowOffset + x] === 0) continue;

      for (let t = 0; t < numThetas; t++) {
        const rho = Math.round(x * cosTable[t] + y * sinTable[t]) + maxD;
        if (rho >= 0 && rho < numRhos) {
          const accIdx = rho * numThetas + t;
          const votes = ++acc[accIdx];
          if (votes > maxVotes) {
            maxVotes = votes;
          }
        }
      }
    }
  }

  if (maxVotes === 0) {
    return [];
  }

  const minVotes = Math.max(10, Math.floor(maxVotes * threshold));
  const detectedLines: HoughLine[] = [];

  // Local 3x3 Non-Maximum Suppression in accumulator space
  for (let r = 1; r < numRhos - 1; r++) {
    const rOffset = r * numThetas;
    for (let t = 0; t < numThetas; t++) {
      const votes = acc[rOffset + t];
      if (votes < minVotes) continue;

      let isLocalMax = true;
      for (let dr = -1; dr <= 1 && isLocalMax; dr++) {
        const neighborROffset = (r + dr) * numThetas;
        for (let dt = -1; dt <= 1; dt++) {
          if (dr === 0 && dt === 0) continue;
          let neighborT = t + dt;
          if (neighborT < 0) neighborT += numThetas;
          else if (neighborT >= numThetas) neighborT -= numThetas;

          if (acc[neighborROffset + neighborT] > votes) {
            isLocalMax = false;
            break;
          }
        }
      }

      if (isLocalMax) {
        detectedLines.push({
          rho: r - maxD,
          theta: t * thetaStep,
          score: votes / maxVotes,
        });
      }
    }
  }

  detectedLines.sort((a, b) => b.score - a.score);
  return detectedLines;
};

/**
 * Finds geometric intersections between horizontal and vertical Hough line candidates.
 * Solves the 2x2 system:
 *   [cos(th_h)  sin(th_h)] [x]   [rho_h]
 *   [cos(th_v)  sin(th_v)] [y] = [rho_v]
 *
 * Deduplicates adjacent intersection points within a cluster radius.
 */
export const findLineIntersections = (
  hLines: { rho: number; theta: number }[],
  vLines: { rho: number; theta: number }[],
  width: number,
  height: number
): Point2D[] => {
  const intersections: Point2D[] = [];
  const margin = 25;

  for (const h of hLines) {
    const cosH = Math.cos(h.theta);
    const sinH = Math.sin(h.theta);

    for (const v of vLines) {
      const cosV = Math.cos(v.theta);
      const sinV = Math.sin(v.theta);

      const det = cosH * sinV - sinH * cosV;
      if (Math.abs(det) < 1e-4) continue;

      const x = (h.rho * sinV - v.rho * sinH) / det;
      const y = (v.rho * cosH - h.rho * cosV) / det;

      if (
        x >= -margin &&
        x <= width + margin &&
        y >= -margin &&
        y <= height + margin
      ) {
        const isDuplicate = intersections.some(
          (p) => Math.hypot(p.x - x, p.y - y) < 12
        );
        if (!isDuplicate) {
          intersections.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
          });
        }
      }
    }
  }

  return intersections;
};
