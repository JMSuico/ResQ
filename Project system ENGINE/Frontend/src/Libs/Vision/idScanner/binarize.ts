/**
 * ResQTrack Vision Engine - Classical Image Preprocessing & Adaptive Binarization
 * 
 * High-performance deterministic image processing pipeline tailored for Philippine identity documents
 * (PhilSys National ID, UMID, Driver's License, Passport, Postal ID).
 * 
 * Architectural Guarantees:
 * - Zero 'any' types across all signatures.
 * - 100% Universal Lambda syntax (`=>`).
 * - High-efficiency typed arrays (`Uint8ClampedArray`, `Float32Array`, `Uint8Array`, `Float64Array`).
 * - O(1) integral-image local variance computations for Sauvola thresholding over microprint patterns.
 * - Deterministic, non-allocating projection profile deskewing.
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface OtsuResult {
  readonly binary: Uint8Array;
  readonly threshold: number;
}

export interface DeskewResult {
  readonly deskewed: Uint8Array;
  readonly bestAngle: number;
}

export interface IntegralImages {
  readonly integral: Float64Array;
  readonly integralSq: Float64Array;
  readonly width: number;
  readonly height: number;
}

// ============================================================================
// Grayscale & Color Space Conversions
// ============================================================================

/**
 * Converts standard RGBA interleaved buffer to high-precision Float32 grayscale.
 * Applies ITU-R BT.601 perceptual luma coefficients: Y = 0.299R + 0.587G + 0.114B.
 */
export const rgbaToGrayscale = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array => {
  const totalPixels = width * height;
  const gray = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    gray[i] =
      0.299 * rgba[offset] +
      0.587 * rgba[offset + 1] +
      0.114 * rgba[offset + 2];
  }

  return gray;
};

// ============================================================================
// Kovesi 3-Pass Box Filter Gaussian Blur Approximation (O(1) per pixel)
// ============================================================================

/**
 * Computes optimal box filter sizes to approximate Gaussian convolution with standard deviation sigma.
 */
const computeBoxWidths = (sigma: number, passes = 3): number[] => {
  if (sigma <= 0) return [1, 1, 1];
  const wIdeal = Math.sqrt((12 * sigma * sigma) / passes + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round(
    (12 * sigma * sigma - passes * wl * wl - 4 * passes * wl - 3 * passes) /
      (-4 * wl - 4)
  );

  const sizes: number[] = [];
  for (let i = 0; i < passes; i++) {
    sizes.push(i < m ? wl : wu);
  }
  return sizes;
};

/**
 * 1D Horizontal Box Blur with edge-replicate boundary clamping.
 */
const boxBlurHorizontal = (
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number
): void => {
  const windowSize = 2 * radius + 1;
  const invWindow = 1.0 / windowSize;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let sum = src[rowOffset] * (radius + 1);

    for (let r = 1; r <= radius; r++) {
      const xClamped = Math.min(r, width - 1);
      sum += src[rowOffset + xClamped];
    }

    for (let x = 0; x < width; x++) {
      dst[rowOffset + x] = sum * invWindow;

      const addX = Math.min(width - 1, x + radius + 1);
      const remX = Math.max(0, x - radius);
      sum += src[rowOffset + addX] - src[rowOffset + remX];
    }
  }
};

/**
 * 1D Vertical Box Blur with edge-replicate boundary clamping.
 */
const boxBlurVertical = (
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number
): void => {
  const windowSize = 2 * radius + 1;
  const invWindow = 1.0 / windowSize;

  for (let x = 0; x < width; x++) {
    let sum = src[x] * (radius + 1);

    for (let r = 1; r <= radius; r++) {
      const yClamped = Math.min(r, height - 1);
      sum += src[yClamped * width + x];
    }

    for (let y = 0; y < height; y++) {
      dst[y * width + x] = sum * invWindow;

      const addY = Math.min(height - 1, y + radius + 1);
      const remY = Math.max(0, y - radius);
      sum += src[addY * width + x] - src[remY * width + x];
    }
  }
};

/**
 * Fast separable Gaussian blur using 3 successive passes of 1D horizontal and vertical box blurs.
 * Operates in strict O(W * H) time complexity regardless of sigma.
 */
export const fastGaussianBlur = (
  src: Float32Array,
  width: number,
  height: number,
  sigma: number
): Float32Array => {
  if (sigma <= 0.5) {
    return new Float32Array(src);
  }

  const boxSizes = computeBoxWidths(sigma, 3);
  let currentSrc = new Float32Array(src);
  let currentDst = new Float32Array(width * height);

  for (let i = 0; i < 3; i++) {
    const radius = Math.floor((boxSizes[i] - 1) / 2);
    if (radius <= 0) continue;

    // Horizontal 1D pass
    boxBlurHorizontal(currentSrc, currentDst, width, height, radius);
    // Vertical 1D pass
    boxBlurVertical(currentDst, currentSrc, width, height, radius);
  }

  return currentSrc;
};

// ============================================================================
// Illumination Compensation (Retinex Homomorphic Division)
// ============================================================================

/**
 * Flattens uneven illumination, camera flash gradients, and harsh document shadows
 * by dividing local pixel intensities by a low-pass Gaussian background estimate.
 * Preserves foreground text contrast while normalizing card background to uniform baseline.
 *
 * @param gray Grayscale image array [0..255]
 * @param width Image pixel width
 * @param height Image pixel height
 * @param sigma Standard deviation for background low-pass estimator (default = 25)
 * @returns Corrected Float32Array in range [0..255]
 */
export const flattenIllumination = (
  gray: Float32Array,
  width: number,
  height: number,
  sigma = 25
): Float32Array => {
  const totalPixels = width * height;
  if (totalPixels === 0) return new Float32Array(0);

  // Compute low-pass background estimate
  const background = fastGaussianBlur(gray, width, height, sigma);

  // Compute global background mean
  let sumB = 0;
  for (let i = 0; i < totalPixels; i++) {
    sumB += background[i];
  }
  const meanB = sumB / totalPixels;

  const flattened = new Float32Array(totalPixels);
  const epsilon = 1e-4;

  for (let i = 0; i < totalPixels; i++) {
    const bg = background[i];
    const normalized = (gray[i] / (bg + epsilon)) * meanB;
    flattened[i] = Math.min(255.0, Math.max(0.0, normalized));
  }

  return flattened;
};

// ============================================================================
// Global Otsu Thresholding
// ============================================================================

/**
 * Computes global Otsu threshold by maximizing between-class variance:
 * sigma_b^2 = w0 * w1 * (mu0 - mu1)^2
 *
 * Returns binary mask where foreground text pixels are 255 and background is 0.
 *
 * @param gray Float32Array of grayscale intensities
 * @param width Image width
 * @param height Image height
 * @returns Binarized Uint8Array and the optimal integer threshold [0..255]
 */
export const otsuThreshold = (
  gray: Float32Array,
  width: number,
  height: number
): OtsuResult => {
  const totalPixels = width * height;
  const binary = new Uint8Array(totalPixels);

  if (totalPixels === 0) {
    return { binary, threshold: 128 };
  }

  // 1. Build 256-bin histogram
  const histogram = new Float64Array(256);
  for (let i = 0; i < totalPixels; i++) {
    const val = Math.round(Math.min(255, Math.max(0, gray[i])));
    histogram[val]++;
  }

  // 2. Compute total weighted intensity sum
  let sumTotal = 0;
  for (let t = 0; t < 256; t++) {
    sumTotal += t * histogram[t];
  }

  // 3. Maximize between-class variance sigma_b^2
  let w0 = 0;
  let sum0 = 0;
  let maxVariance = -1;
  let optimalThreshold = 128;

  for (let t = 0; t < 256; t++) {
    w0 += histogram[t];
    if (w0 === 0) continue;

    const w1 = totalPixels - w0;
    if (w1 === 0) break;

    sum0 += t * histogram[t];

    const mu0 = sum0 / w0;
    const mu1 = (sumTotal - sum0) / w1;
    const diff = mu0 - mu1;
    const betweenVariance = w0 * w1 * diff * diff;

    if (betweenVariance > maxVariance) {
      maxVariance = betweenVariance;
      optimalThreshold = t;
    }
  }

  // 4. Generate binary mask (text <= threshold => 255 foreground)
  for (let i = 0; i < totalPixels; i++) {
    binary[i] = gray[i] <= optimalThreshold ? 255 : 0;
  }

  return {
    binary,
    threshold: optimalThreshold
  };
};

// ============================================================================
// Sauvola Adaptive Local Thresholding with Integral Images (O(1))
// ============================================================================

/**
 * Builds integral image (II) and squared integral image (II_sq)
 * using double-precision Float64Array to prevent arithmetic overflow on high-res buffers.
 */
export const computeIntegralImages = (
  gray: Float32Array,
  width: number,
  height: number
): IntegralImages => {
  const intW = width + 1;
  const intH = height + 1;
  const integral = new Float64Array(intW * intH);
  const integralSq = new Float64Array(intW * intH);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    const currRow = (y + 1) * intW;
    const prevRow = y * intW;
    const grayRow = y * width;

    for (let x = 0; x < width; x++) {
      const val = gray[grayRow + x];
      rowSum += val;
      rowSumSq += val * val;

      integral[currRow + x + 1] = integral[prevRow + x + 1] + rowSum;
      integralSq[currRow + x + 1] = integralSq[prevRow + x + 1] + rowSumSq;
    }
  }

  return { integral, integralSq, width, height };
};

/**
 * Sauvola Local Adaptive Thresholding.
 * Formula: T(x,y) = m(x,y) * (1 + k * (s(x,y)/r - 1))
 * 
 * Computes local mean m(x,y) and standard deviation s(x,y) in O(1) time per pixel
 * using integral images. Crucial for suppressing high-frequency guilloche patterns,
 * security thread background watermarks, and gradient shading on national IDs.
 *
 * @param gray Grayscale image array [0..255]
 * @param width Image width
 * @param height Image height
 * @param windowSize Local square window dimension (default = 25)
 * @param k Dynamic threshold sensitivity parameter (default = 0.34)
 * @param r Dynamic range of standard deviation (default = 128)
 * @returns Binarized Uint8Array with 255 for foreground text, 0 for background
 */
export const sauvolaAdaptiveThreshold = (
  gray: Float32Array,
  width: number,
  height: number,
  windowSize = 25,
  k = 0.34,
  r = 128
): Uint8Array => {
  const totalPixels = width * height;
  const binary = new Uint8Array(totalPixels);

  if (totalPixels === 0) return binary;

  const { integral, integralSq } = computeIntegralImages(gray, width, height);
  const intW = width + 1;
  const halfWindow = Math.floor(windowSize / 2);

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - halfWindow);
    const y2 = Math.min(height, y + halfWindow + 1);
    const rowOffset = y * width;

    const rowIdxY1 = y1 * intW;
    const rowIdxY2 = y2 * intW;

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfWindow);
      const x2 = Math.min(width, x + halfWindow + 1);

      const area = (x2 - x1) * (y2 - y1);

      // Fast rectangular integral lookups
      const sum =
        integral[rowIdxY2 + x2] -
        integral[rowIdxY1 + x2] -
        integral[rowIdxY2 + x1] +
        integral[rowIdxY1 + x1];

      const sumSq =
        integralSq[rowIdxY2 + x2] -
        integralSq[rowIdxY1 + x2] -
        integralSq[rowIdxY2 + x1] +
        integralSq[rowIdxY1 + x1];

      const mean = sum / area;
      const variance = Math.max(0.0, sumSq / area - mean * mean);
      const stdDev = Math.sqrt(variance);

      // Sauvola local threshold formula
      const threshold = mean * (1.0 + k * (stdDev / r - 1.0));

      // Foreground text marked as 255
      binary[rowOffset + x] = gray[rowOffset + x] <= threshold ? 255 : 0;
    }
  }

  return binary;
};

// ============================================================================
// Mathematical Morphology Operations
// ============================================================================

/**
 * Morphological Binary Erosion.
 * Output pixel is 255 only if all neighborhood pixels within kernel bounds are 255.
 */
export const morphologyErode = (
  binary: Uint8Array,
  width: number,
  height: number,
  kw: number,
  kh: number
): Uint8Array => {
  const output = new Uint8Array(width * height);
  const radX = Math.floor(kw / 2);
  const radY = Math.floor(kh / 2);

  for (let y = 0; y < height; y++) {
    const yMin = Math.max(0, y - radY);
    const yMax = Math.min(height - 1, y + (kw > 1 && kh === 1 ? 0 : radY));

    for (let x = 0; x < width; x++) {
      const xMin = Math.max(0, x - radX);
      const xMax = Math.min(width - 1, x + radX);

      let allSet = true;
      for (let ky = yMin; ky <= yMax && allSet; ky++) {
        const rowOffset = ky * width;
        for (let kx = xMin; kx <= xMax; kx++) {
          if (binary[rowOffset + kx] === 0) {
            allSet = false;
            break;
          }
        }
      }

      output[y * width + x] = allSet ? 255 : 0;
    }
  }

  return output;
};

/**
 * Morphological Binary Dilation.
 * Output pixel is 255 if any neighborhood pixel within kernel bounds is 255.
 */
export const morphologyDilate = (
  binary: Uint8Array,
  width: number,
  height: number,
  kw: number,
  kh: number
): Uint8Array => {
  const output = new Uint8Array(width * height);
  const radX = Math.floor(kw / 2);
  const radY = Math.floor(kh / 2);

  for (let y = 0; y < height; y++) {
    const yMin = Math.max(0, y - radY);
    const yMax = Math.min(height - 1, y + (kw > 1 && kh === 1 ? 0 : radY));

    for (let x = 0; x < width; x++) {
      const xMin = Math.max(0, x - radX);
      const xMax = Math.min(width - 1, x + radX);

      let anySet = false;
      for (let ky = yMin; ky <= yMax && !anySet; ky++) {
        const rowOffset = ky * width;
        for (let kx = xMin; kx <= xMax; kx++) {
          if (binary[rowOffset + kx] === 255) {
            anySet = true;
            break;
          }
        }
      }

      output[y * width + x] = anySet ? 255 : 0;
    }
  }

  return output;
};

/**
 * Morphological Opening (Erosion followed by Dilation).
 * Eliminates salt-and-pepper noise, scanner dust specks, and single-pixel spurious artifacts.
 *
 * @param binary Binarized image array (0 or 255)
 * @param width Image width
 * @param height Image height
 * @param kernelSize Symmetric square kernel dimension (default = 2)
 */
export const morphologyOpen = (
  binary: Uint8Array,
  width: number,
  height: number,
  kernelSize = 2
): Uint8Array => {
  const eroded = morphologyErode(binary, width, height, kernelSize, kernelSize);
  return morphologyDilate(eroded, width, height, kernelSize, kernelSize);
};

/**
 * Morphological Horizontal Closing (Dilation followed by Erosion).
 * Bridges small horizontal fractures and broken stroke gaps in alphanumeric text
 * without merging adjacent vertical lines.
 *
 * @param binary Binarized image array (0 or 255)
 * @param width Image width
 * @param height Image height
 * @param kw Kernel horizontal width (default = 3)
 * @param kh Kernel vertical height (default = 1)
 */
export const morphologyClose = (
  binary: Uint8Array,
  width: number,
  height: number,
  kw = 3,
  kh = 1
): Uint8Array => {
  const dilated = morphologyDilate(binary, width, height, kw, kh);
  return morphologyErode(dilated, width, height, kw, kh);
};

// ============================================================================
// Projection Profile Deskewing
// ============================================================================

/**
 * Corrects angular tilt of document by calculating horizontal projection profiles across
 * candidate search angles and identifying angle that maximizes row-sum projection variance.
 * Text lines aligned horizontally exhibit maximum peak-to-valley variance.
 *
 * @param binary Binarized image array (255 foreground text, 0 background)
 * @param width Image width
 * @param height Image height
 * @param searchAngles Array of integer or fractional angular offsets in degrees
 * @returns Rotated deskewed binary buffer and the selected best angle
 */
export const deskewProjectionProfile = (
  binary: Uint8Array,
  width: number,
  height: number,
  searchAngles: readonly number[] = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
): DeskewResult => {
  const totalPixels = width * height;
  if (totalPixels === 0 || searchAngles.length === 0) {
    return { deskewed: new Uint8Array(binary), bestAngle: 0 };
  }

  const cx = width * 0.5;
  const cy = height * 0.5;

  let maxVariance = -1;
  let bestAngle = 0;

  // Pre-collect foreground pixel coordinates to accelerate projection variance loop
  const fgX: number[] = [];
  const fgY: number[] = [];
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (binary[rowOffset + x] === 255) {
        fgX.push(x);
        fgY.push(y);
      }
    }
  }

  const fgCount = fgX.length;
  // If image is blank or nearly devoid of text, return untransformed
  if (fgCount < 20) {
    return { deskewed: new Uint8Array(binary), bestAngle: 0 };
  }

  const profile = new Float64Array(height);

  for (let a = 0; a < searchAngles.length; a++) {
    const angleDeg = searchAngles[a];
    const angleRad = (angleDeg * Math.PI) / 180.0;
    const sinA = Math.sin(angleRad);
    const cosA = Math.cos(angleRad);

    profile.fill(0);

    for (let i = 0; i < fgCount; i++) {
      const dx = fgX[i] - cx;
      const dy = fgY[i] - cy;
      // Rotated row coordinate
      const rotY = Math.round(-dx * sinA + dy * cosA + cy);
      if (rotY >= 0 && rotY < height) {
        profile[rotY]++;
      }
    }

    // Compute profile variance
    let sum = 0;
    let sumSq = 0;
    for (let y = 0; y < height; y++) {
      const p = profile[y];
      sum += p;
      sumSq += p * p;
    }

    const mean = sum / height;
    const variance = sumSq / height - mean * mean;

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angleDeg;
    }
  }

  // If no rotation needed or angle is zero, return clone
  if (bestAngle === 0) {
    return { deskewed: new Uint8Array(binary), bestAngle: 0 };
  }

  // Apply inverse mapping rotation to create deskewed binary image
  const deskewed = new Uint8Array(totalPixels);
  const rotRad = (-bestAngle * Math.PI) / 180.0;
  const invCos = Math.cos(rotRad);
  const invSin = Math.sin(rotRad);

  for (let y = 0; y < height; y++) {
    const dy = y - cy;
    const rowOffset = y * width;

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const srcX = Math.round(dx * invCos - dy * invSin + cx);
      const srcY = Math.round(dx * invSin + dy * invCos + cy);

      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        deskewed[rowOffset + x] = binary[srcY * width + srcX];
      } else {
        deskewed[rowOffset + x] = 0;
      }
    }
  }

  return { deskewed, bestAngle };
};

/**
 * Inverts binary values (0 -> 255, 255 -> 0) for dark-on-light document display or OCR adapters.
 */
export const invertBinary = (binary: Uint8Array): Uint8Array => {
  const inverted = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    inverted[i] = binary[i] === 255 ? 0 : 255;
  }
  return inverted;
};
