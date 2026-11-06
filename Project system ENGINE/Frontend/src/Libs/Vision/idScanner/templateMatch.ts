/**
 * ResQTrack Classical ID Scanner Normalized Cross-Correlation (NCC) Template Matcher
 * Zero-ML optical template detection with integral image variance normalization.
 * 100% universal lambda syntax, zero 'any', high-performance typed arrays.
 */

export interface NCCResult {
  maxCorr: number;
  bestX: number;
  bestY: number;
}

export interface MultiScaleTemplateResult {
  score: number;
  x: number;
  y: number;
  scale: number;
}

export interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Computes 2D Integral Images (Summed Area Tables) for intensity and squared intensity.
 * Uses 64-bit precision to eliminate numerical drift across large image dimensions.
 */
const computeIntegralTables = (
  image: Float32Array,
  width: number,
  height: number
): { sat1: Float64Array; sat2: Float64Array; stride: number } => {
  const stride = width + 1;
  const sat1 = new Float64Array(stride * (height + 1));
  const sat2 = new Float64Array(stride * (height + 1));

  for (let y = 0; y < height; y++) {
    const imgRow = y * width;
    const satPrevRow = y * stride;
    const satCurrRow = (y + 1) * stride;

    let rowSum = 0;
    let rowSqSum = 0;

    for (let x = 0; x < width; x++) {
      const val = image[imgRow + x];
      rowSum += val;
      rowSqSum += val * val;

      const satIdx = satCurrRow + (x + 1);
      const satAboveIdx = satPrevRow + (x + 1);

      sat1[satIdx] = sat1[satAboveIdx] + rowSum;
      sat2[satIdx] = sat2[satAboveIdx] + rowSqSum;
    }
  }

  return { sat1, sat2, stride };
};

/**
 * Resamples a 2D float image patch using bilinear interpolation.
 */
const resampleBilinearFloat = (
  src: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Float32Array => {
  const dst = new Float32Array(dstW * dstH);
  const ratioX = (srcW - 1) / Math.max(1, dstW - 1);
  const ratioY = (srcH - 1) / Math.max(1, dstH - 1);

  for (let dy = 0; dy < dstH; dy++) {
    const sy = dy * ratioY;
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const fy = sy - y0;
    const dstRowOffset = dy * dstW;

    for (let dx = 0; dx < dstW; dx++) {
      const sx = dx * ratioX;
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const fx = sx - x0;

      const p00 = src[y0 * srcW + x0];
      const p10 = src[y0 * srcW + x1];
      const p01 = src[y1 * srcW + x0];
      const p11 = src[y1 * srcW + x1];

      const top = p00 + fx * (p10 - p00);
      const bottom = p01 + fx * (p11 - p01);
      dst[dstRowOffset + dx] = top + fy * (bottom - top);
    }
  }

  return dst;
};

/**
 * Calculates Normalized Cross-Correlation (NCC) with integral image variance normalization.
 * Finds the top-left position (bestX, bestY) in image where template correlates maximally.
 *
 * @param image 1D Float32Array representing the search image.
 * @param imgW Image width in pixels.
 * @param imgH Image height in pixels.
 * @param template 1D Float32Array representing template kernel.
 * @param tplW Template width in pixels.
 * @param tplH Template height in pixels.
 * @param roi Optional Region of Interest to restrict the search space.
 * @returns Maximum correlation coefficient [-1, 1] and coordinate of the best match.
 */
export const normalizedCrossCorrelation = (
  image: Float32Array,
  imgW: number,
  imgH: number,
  template: Float32Array,
  tplW: number,
  tplH: number,
  roi?: { x: number; y: number; w: number; h: number }
): NCCResult => {
  if (tplW <= 0 || tplH <= 0 || imgW < tplW || imgH < tplH) {
    return { maxCorr: -1, bestX: 0, bestY: 0 };
  }

  const N = tplW * tplH;

  // Compute template zero-mean and template variance
  let tplSum = 0;
  for (let i = 0; i < N; i++) {
    tplSum += template[i];
  }
  const tplMean = tplSum / N;

  const tplZeroMean = new Float32Array(N);
  let tplSqDiffSum = 0;
  for (let i = 0; i < N; i++) {
    const diff = template[i] - tplMean;
    tplZeroMean[i] = diff;
    tplSqDiffSum += diff * diff;
  }

  const tplStd = Math.sqrt(tplSqDiffSum);
  if (tplStd < 1e-7) {
    // Degenerate flat template has undefined correlation
    return { maxCorr: 0, bestX: 0, bestY: 0 };
  }

  // Determine search bounds based on ROI
  let startX = 0;
  let endX = imgW - tplW;
  let startY = 0;
  let endY = imgH - tplH;

  if (roi) {
    startX = Math.max(0, Math.floor(roi.x));
    endX = Math.min(imgW - tplW, Math.floor(roi.x + roi.w - tplW));
    startY = Math.max(0, Math.floor(roi.y));
    endY = Math.min(imgH - tplH, Math.floor(roi.y + roi.h - tplH));
  }

  if (endX < startX || endY < startY) {
    return { maxCorr: -1, bestX: 0, bestY: 0 };
  }

  // Precompute integral tables for O(1) patch variance lookups
  const { sat1, sat2, stride } = computeIntegralTables(image, imgW, imgH);

  let maxCorr = -1.0;
  let bestX = startX;
  let bestY = startY;

  for (let y = startY; y <= endY; y++) {
    const topRow = y * stride;
    const botRow = (y + tplH) * stride;

    for (let x = startX; x <= endX; x++) {
      // O(1) sum and sum-of-squares calculation via Summed Area Table
      const xRight = x + tplW;

      const sumI =
        sat1[botRow + xRight] -
        sat1[topRow + xRight] -
        sat1[botRow + x] +
        sat1[topRow + x];

      const sumSqI =
        sat2[botRow + xRight] -
        sat2[topRow + xRight] -
        sat2[botRow + x] +
        sat2[topRow + x];

      const patchVariance = sumSqI - (sumI * sumI) / N;

      if (patchVariance < 1e-7) {
        // Zero-variance patch (flat color)
        continue;
      }

      const patchStd = Math.sqrt(patchVariance);

      // Convolve image patch with zero-mean template
      let crossProduct = 0;
      for (let ty = 0; ty < tplH; ty++) {
        const imgOffset = (y + ty) * imgW + x;
        const tplOffset = ty * tplW;
        for (let tx = 0; tx < tplW; tx++) {
          crossProduct += image[imgOffset + tx] * tplZeroMean[tplOffset + tx];
        }
      }

      const ncc = crossProduct / (patchStd * tplStd);

      if (ncc > maxCorr) {
        maxCorr = ncc;
        bestX = x;
        bestY = y;
      }
    }
  }

  // Clamp correlation to theoretical limits [-1, 1]
  const clampedCorr = Math.max(-1.0, Math.min(1.0, maxCorr));

  return {
    maxCorr: Number(clampedCorr.toFixed(4)),
    bestX,
    bestY,
  };
};

/**
 * Performs multi-scale Normalized Cross-Correlation template matching by scaling the template
 * across user-defined scaling factors.
 *
 * @param image 1D Float32Array search image.
 * @param imgW Image width in pixels.
 * @param imgH Image height in pixels.
 * @param template 1D Float32Array template image.
 * @param tplW Template width in pixels.
 * @param tplH Template height in pixels.
 * @param scales Array of scale multipliers (default: [0.9, 1.0, 1.1]).
 * @param roi Optional search region of interest.
 * @returns Best match result containing score, coordinates, and optimal scale factor.
 */
export const matchTemplateMultiScale = (
  image: Float32Array,
  imgW: number,
  imgH: number,
  template: Float32Array,
  tplW: number,
  tplH: number,
  scales = [0.9, 1.0, 1.1],
  roi?: { x: number; y: number; w: number; h: number }
): MultiScaleTemplateResult => {
  let bestScore = -1.0;
  let bestX = 0;
  let bestY = 0;
  let bestScale = 1.0;

  for (let i = 0; i < scales.length; i++) {
    const s = scales[i];
    const scaledW = Math.round(tplW * s);
    const scaledH = Math.round(tplH * s);

    if (scaledW < 3 || scaledH < 3 || scaledW > imgW || scaledH > imgH) {
      continue;
    }

    const scaledTemplate =
      s === 1.0
        ? template
        : resampleBilinearFloat(template, tplW, tplH, scaledW, scaledH);

    const match = normalizedCrossCorrelation(
      image,
      imgW,
      imgH,
      scaledTemplate,
      scaledW,
      scaledH,
      roi
    );

    if (match.maxCorr > bestScore) {
      bestScore = match.maxCorr;
      bestX = match.bestX;
      bestY = match.bestY;
      bestScale = s;
    }
  }

  return {
    score: Number(bestScore.toFixed(4)),
    x: bestX,
    y: bestY,
    scale: bestScale,
  };
};
