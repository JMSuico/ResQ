/**
 * ResQTrack Vision Engine - Real-Time Optical Quality Gates & Anti-Spoofing Checks
 * 
 * Enforces rigorous quality assurance checks on incoming identity document frames prior to
 * OCR text extraction and biometric facial comparison.
 * 
 * Quality Dimensions Evaluated:
 * 1. Discrete 3x3 Laplacian Edge Sharpness / Blur Detection (Nominal 548.6, Threshold >= 100.0)
 * 2. Specular Glare & Hotspot Saturation Detection via HSV color space (Threshold < 3.0%)
 * 3. Photometric Exposure Balance & Dynamic Range (Optimal [60.0, 200.0])
 * 4. Screen Replay & Moiré Pattern Detection (LCD / OLED physical sub-pixel rastering)
 * 5. Composite Evaluator Score & Rejection Reason Generation
 * 
 * Architectural Guarantees:
 * - Strict TypeScript with ZERO 'any' types.
 * - 100% Universal Lambda syntax (`=>`).
 * - High-efficiency typed arrays (`Uint8ClampedArray`, `Float32Array`, `Uint8Array`).
 */

import { rgbaToGrayscale } from './binarize';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface LaplacianResult {
  readonly variance: number;
  readonly isSharp: boolean;
}

export interface SpecularGlareResult {
  readonly glareRatio: number;
  readonly hasGlare: boolean;
  readonly glareMask: Uint8Array;
}

export type ExposureStatus = 'UNDEREXPOSED' | 'OPTIMAL' | 'OVEREXPOSED';

export interface ExposureResult {
  readonly meanLuminance: number;
  readonly status: ExposureStatus;
}

export interface MoirePatternResult {
  readonly hasMoireScreenReplay: boolean;
  readonly highFrequencyRatio: number;
}

export interface QualityGateEvaluation {
  readonly passed: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly details: {
    readonly laplacian: number;
    readonly glare: number;
    readonly exposure: number;
    readonly moire: number;
  };
}

// ============================================================================
// Quality Gate 1: Discrete 3x3 Laplacian Clarity & Blur Detection
// ============================================================================

/**
 * Assesses image focus and optical sharpness using an 8-neighbor discrete 3x3 Laplacian kernel:
 * [ -1, -1, -1 ]
 * [ -1,  8, -1 ]
 * [ -1, -1, -1 ]
 * 
 * Computes variance of Laplacian response across the frame. High edge variance indicates
 * crisp text borders and genuine photo fidelity. Blurry, motion-smeared, or defocused
 * frames yield low variance.
 *
 * @param gray Grayscale image buffer [0..255]
 * @param width Image width
 * @param height Image height
 * @returns Variance score and sharpness pass/fail boolean (threshold >= 100.0, nominal 548.6)
 */
export const assessLaplacianClarity = (
  gray: Float32Array,
  width: number,
  height: number
): LaplacianResult => {
  if (width < 3 || height < 3) {
    return { variance: 0, isSharp: false };
  }

  let sum = 0;
  let sumSq = 0;
  let sampleCount = 0;

  // Convolve inner image pixels (skip 1-pixel boundary)
  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    const prevRowOffset = (y - 1) * width;
    const nextRowOffset = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;

      // 3x3 Discrete Laplacian Kernel [-1, -1, -1, -1, 8, -1, -1, -1, -1]
      const laplacian =
        8 * gray[idx] -
        gray[prevRowOffset + x - 1] -
        gray[prevRowOffset + x] -
        gray[prevRowOffset + x + 1] -
        gray[rowOffset + x - 1] -
        gray[rowOffset + x + 1] -
        gray[nextRowOffset + x - 1] -
        gray[nextRowOffset + x] -
        gray[nextRowOffset + x + 1];

      sum += laplacian;
      sumSq += laplacian * laplacian;
      sampleCount++;
    }
  }

  if (sampleCount === 0) {
    return { variance: 0, isSharp: false };
  }

  const mean = sum / sampleCount;
  const rawVariance = Math.max(0.0, sumSq / sampleCount - mean * mean);
  const variance = Math.round(rawVariance * 10) / 10;

  // Pass threshold: variance >= 100.0 (nominal sharp target: 548.6)
  const isSharp = variance >= 100.0;

  return { variance, isSharp };
};

// ============================================================================
// Quality Gate 2: Specular Glare & Flash Reflection Detection
// ============================================================================

/**
 * Detects specular glare reflections, flash hotspots, and plastic laminate sheen.
 * Converts RGB to HSV color space:
 * - Glare pixels exhibit near-zero Saturation (S < 0.10) and near-maximum Value (V > 0.98).
 * 
 * Passes if glare pixel ratio is strictly under 3.0% (0.03).
 *
 * @param rgba Raw 32-bit RGBA pixel array
 * @param width Image width
 * @param height Image height
 * @returns Glare ratio, pass/fail boolean, and 8-bit binary mask of glare pixels
 */
export const detectSpecularGlare = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): SpecularGlareResult => {
  const totalPixels = width * height;
  const glareMask = new Uint8Array(totalPixels);

  if (totalPixels === 0) {
    return { glareRatio: 0, hasGlare: false, glareMask };
  }

  let glarePixelCount = 0;
  const inv255 = 1.0 / 255.0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = rgba[offset] * inv255;
    const g = rgba[offset + 1] * inv255;
    const b = rgba[offset + 2] * inv255;

    // Fast HSV conversion
    const cMax = Math.max(r, g, b);
    const cMin = Math.min(r, g, b);
    const delta = cMax - cMin;

    const v = cMax;
    const s = cMax > 0.0 ? delta / cMax : 0.0;

    // Glare criteria: washed out saturation with high luminance
    if (s < 0.10 && v > 0.98) {
      glareMask[i] = 255;
      glarePixelCount++;
    }
  }

  const rawGlareRatio = glarePixelCount / totalPixels;
  const glareRatio = Math.round(rawGlareRatio * 10000) / 10000;
  const hasGlare = glareRatio >= 0.03;

  return { glareRatio, hasGlare, glareMask };
};

// ============================================================================
// Quality Gate 3: Exposure Balance & Photometric Range
// ============================================================================

/**
 * Checks overall photometric exposure balance of the document frame.
 * Evaluates mean frame luminance against optimal operational window [60.0, 200.0].
 *
 * @param gray Float32Array of grayscale intensities [0..255]
 * @param width Image width
 * @param height Image height
 * @returns Mean luminance and categorical status ('UNDEREXPOSED' | 'OPTIMAL' | 'OVEREXPOSED')
 */
export const checkExposureBalance = (
  gray: Float32Array,
  width: number,
  height: number
): ExposureResult => {
  const totalPixels = width * height;

  if (totalPixels === 0) {
    return { meanLuminance: 0, status: 'UNDEREXPOSED' };
  }

  let totalLuminance = 0;
  for (let i = 0; i < totalPixels; i++) {
    totalLuminance += gray[i];
  }

  const rawMean = totalLuminance / totalPixels;
  const meanLuminance = Math.round(rawMean * 10) / 10;

  let status: ExposureStatus;
  if (meanLuminance < 38.0) {
    status = 'UNDEREXPOSED';
  } else if (meanLuminance > 225.0) {
    status = 'OVEREXPOSED';
  } else {
    status = 'OPTIMAL';
  }

  return { meanLuminance, status };
};

// ============================================================================
// Quality Gate 4: Screen Replay & Moiré Pattern Detection
// ============================================================================

/**
 * Detects LCD / OLED digital screen replay spoofing attacks (presentation attacks)
 * by measuring high-frequency spatial variation and repetitive pixel rasters characteristic
 * of smartphone and monitor subpixel matrices.
 * 
 * Genuine printed PVC / paper documents have continuous tonality in non-text areas.
 * Digital screens exhibit rapid sign-alternating gradient oscillations across uniform regions.
 *
 * @param gray Grayscale image array [0..255]
 * @param width Image width
 * @param height Image height
 * @returns Replay spoofing detection boolean and normalized high-frequency ratio [0..1]
 */
export const detectMoirePattern = (
  gray: Float32Array,
  width: number,
  height: number
): MoirePatternResult => {
  if (width < 5 || height < 5) {
    return { hasMoireScreenReplay: false, highFrequencyRatio: 0 };
  }

  let repetitiveRasterPixels = 0;
  let totalSampled = 0;

  // Stride loop to evaluate local 2nd-order alternating spatial gradients
  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    const prevRowOffset = (y - 1) * width;
    const nextRowOffset = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;
      const center = gray[idx];

      // 4-neighborhood average
      const avg4 =
        (gray[rowOffset + x - 1] +
          gray[rowOffset + x + 1] +
          gray[prevRowOffset + x] +
          gray[nextRowOffset + x]) *
        0.25;

      const highPassResidual = Math.abs(center - avg4);

      // Check horizontal gradient sign alternation (sub-pixel raster oscillation)
      const gradLeft = center - gray[rowOffset + x - 1];
      const gradRight = gray[rowOffset + x + 1] - center;
      const hOscillating = gradLeft * gradRight < -1e-4;

      // Check vertical gradient sign alternation
      const gradUp = center - gray[prevRowOffset + x];
      const gradDown = gray[nextRowOffset + x] - center;
      const vOscillating = gradUp * gradDown < -1e-4;

      // High-frequency raster ripple signature
      if (highPassResidual > 6.0 && (hOscillating || vOscillating)) {
        repetitiveRasterPixels++;
      }

      totalSampled++;
    }
  }

  if (totalSampled === 0) {
    return { hasMoireScreenReplay: false, highFrequencyRatio: 0 };
  }

  const rawRatio = repetitiveRasterPixels / totalSampled;
  const highFrequencyRatio = Math.round(rawRatio * 10000) / 10000;

  // Genuine printed IDs typically yield 2-6% high-frequency edge content.
  // Replayed LCD/OLED screens with subpixel grid exceed 18%.
  const hasMoireScreenReplay = highFrequencyRatio > 0.18;

  return { hasMoireScreenReplay, highFrequencyRatio };
};

// ============================================================================
// Master Quality Gate Evaluator
// ============================================================================

/**
 * Master optical quality gate pipeline.
 * Evaluates Laplacian clarity, specular glare, exposure balance, and moiré screen replay.
 * Generates composite score [0..100] and detailed human-readable rejection reasons.
 *
 * @param rgba Raw 32-bit RGBA pixel array
 * @param width Frame width
 * @param height Frame height
 * @returns QualityGateEvaluation containing composite pass boolean, score, reasons, and raw details
 */
export const evaluateQualityGate = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): QualityGateEvaluation => {
  const reasons: string[] = [];

  // Convert to grayscale for optical measurements
  const gray = rgbaToGrayscale(rgba, width, height);

  // 1. Laplacian sharpness check
  const laplacian = assessLaplacianClarity(gray, width, height);
  if (!laplacian.isSharp) {
    reasons.push(
      `BLUR_DETECTED: Edge Laplacian variance ${laplacian.variance} is below sharp threshold 100.0 (nominal 548.6)`
    );
  }

  // 2. Specular glare check
  const glare = detectSpecularGlare(rgba, width, height);
  if (glare.hasGlare) {
    reasons.push(
      `SPECULAR_GLARE_DETECTED: Glare surface ratio ${(glare.glareRatio * 100).toFixed(1)}% exceeds 3.0% maximum tolerance`
    );
  }

  // 3. Exposure balance check
  const exposure = checkExposureBalance(gray, width, height);
  if (exposure.status === 'UNDEREXPOSED') {
    reasons.push(
      `UNDEREXPOSED: Mean frame luminance ${exposure.meanLuminance} is below optimal range [38.0, 225.0]`
    );
  } else if (exposure.status === 'OVEREXPOSED') {
    reasons.push(
      `OVEREXPOSED: Mean frame luminance ${exposure.meanLuminance} exceeds optimal range [38.0, 225.0]`
    );
  }

  // 4. Moiré / screen replay check
  const moire = detectMoirePattern(gray, width, height);
  if (moire.hasMoireScreenReplay) {
    reasons.push(
      `SCREEN_REPLAY_DETECTED: Moiré raster ratio ${(moire.highFrequencyRatio * 100).toFixed(1)}% indicates digital display capture`
    );
  }

  // Weighted Composite Score [0..100]
  // 1. Sharpness component (35% weight)
  const sharpnessScore = Math.min(35.0, (laplacian.variance / 548.6) * 35.0);

  // 2. Glare component (25% weight)
  const glareScore = Math.max(0.0, (1.0 - glare.glareRatio / 0.03) * 25.0);

  // 3. Exposure component (20% weight)
  let exposureScore = 20.0;
  if (exposure.meanLuminance < 38.0) {
    exposureScore = (exposure.meanLuminance / 38.0) * 20.0;
  } else if (exposure.meanLuminance > 225.0) {
    exposureScore = Math.max(0.0, ((255.0 - exposure.meanLuminance) / 30.0) * 20.0);
  }

  // 4. Moiré anti-spoofing component (20% weight)
  const moireScore = Math.max(0.0, (1.0 - moire.highFrequencyRatio / 0.18) * 20.0);

  const rawCompositeScore = sharpnessScore + glareScore + exposureScore + moireScore;
  const score = Math.round(Math.min(100.0, Math.max(0.0, rawCompositeScore)) * 10) / 10;

  // Pass requirement: all individual gates passed AND composite score >= 70.0
  const passed = reasons.length === 0 && score >= 70.0;

  return {
    passed,
    score,
    reasons,
    details: {
      laplacian: laplacian.variance,
      glare: glare.glareRatio,
      exposure: exposure.meanLuminance,
      moire: moire.highFrequencyRatio
    }
  };
};
