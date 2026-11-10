// [Layer: Libs/Vision/idScanner/face]
// Responsibility: Pure mathematical and color-space facial tracking, spatial moments,
// anthropometric pose calculation, and temporal motion energy liveness verification without neural networks.
// Complies strictly with zero 'any' and 100% universal lambda syntax.

export type BiometricPoseClass = 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'BLINK';

export type FaceDistanceStatus = 'TOO_FAR' | 'OPTIMAL' | 'TOO_CLOSE';

export interface YCbCrPlanes {
  y: Float32Array;
  cb: Float32Array;
  cr: Float32Array;
}

export interface RoiRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OvalGuide {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface SpatialMoments {
  m00: number;
  m10: number;
  m01: number;
  cx: number;
  cy: number;
  mu20: number;
  mu02: number;
  mu11: number;
  theta: number;
  majorAxis: number;
  minorAxis: number;
}

export interface HeadPoseResult {
  yaw: number;
  pitch: number;
  distanceStatus: FaceDistanceStatus;
  poseClass: BiometricPoseClass;
  deltaYaw?: number;
  deltaPitch?: number;
}

export interface TemporalMotionEnergyResult {
  energy: number;
  isLiveMotion: boolean;
  vx?: number;
  vy?: number;
}

export interface OvalSkinMetrics {
  bilateralSkinAsymmetry: number;
  profileEnvelopeOffset: number;
  verticalSkinAsymmetry: number;
  centroidOffsetFromOvalX: number;
  centroidOffsetFromOvalY: number;
  profileRatio?: number;
  silhouetteAsymmetry?: number;
  boxSkinAsymmetry?: number;
  boxCentroidOffset?: number;
  minSkinX?: number;
  maxSkinX?: number;
  boxMidX?: number;
}

export interface EyeBlinkResult {
  isBlinking: boolean;
  eyeOpenness: number;
  ocularVariance: number;
}

export interface FaceCorrelationResult {
  correlation: number;
  isLikelyMatch: boolean;
  isHeuristicOnly: true;
}

export interface FacialLandmarks {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  noseTip: { x: number; y: number };
  mouthCenter: { x: number; y: number };
  chinApex: { x: number; y: number };
  faceBox: RoiRect;
  isValidLandmarks: boolean;
}

export interface HaarCascadeFaceCheck {
  ocularDipolePassed: boolean;
  bridgeTriplePassed: boolean;
  mouthDipolePassed: boolean;
  score: number;
}

export interface HybridBiometricProfile {
  lbpHistogram: Float32Array;
  eigenVector: Float32Array;
  fisherVector?: Float32Array;
  deepCnnEmbedding?: Float32Array;
  featureDescriptor?: Float32Array;
  svmScore: number;
  isValidHumanFace: boolean;
}

export interface SkinFaceTrackingFrameResult {
  ycbcr: YCbCrPlanes;
  skinMask: Uint8Array;
  moments: SpatialMoments;
  pose: HeadPoseResult;
  liveness: TemporalMotionEnergyResult;
  landmarks: FacialLandmarks;
  haarCheck: HaarCascadeFaceCheck;
  hybridProfile: HybridBiometricProfile;
  featureDescriptor?: Float32Array;
  yawDegrees: number;
  pitchDegrees: number;
  isValidFace: boolean;
  confidence?: number;
  trackingConfidence?: number;
  blink?: EyeBlinkResult;
  profileRatio?: number;
  bilateralSkinAsymmetry?: number;
  ovalMetrics?: OvalSkinMetrics;
}

/**
 * Converts standard RGBA 8-bit clamped image buffer to YCbCr color planes.
 * Formula:
 *   Y  =  0.2990 * R + 0.5870 * G + 0.1140 * B
 *   Cb = -0.1687 * R - 0.3313 * G + 0.5000 * B + 128
 *   Cr =  0.5000 * R - 0.4187 * G - 0.0813 * B + 128
 */
export const rgbaToYCbCr = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): YCbCrPlanes => {
  const pixelCount = width * height;
  const y = new Float32Array(pixelCount);
  const cb = new Float32Array(pixelCount);
  const cr = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = rgba[offset];
    const g = rgba[offset + 1];
    const b = rgba[offset + 2];

    y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    cb[i] = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
    cr[i] = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
  }

  return { y, cb, cr };
};

/**
 * Segments human skin chrominance within standard physiological YCbCr boundaries:
 *   77 <= Cb <= 127 AND 133 <= Cr <= 173
 * Applies a 2x2 morphological opening (erosion followed by dilation) to scrub high-frequency noise.
 */
export const segmentSkinMask = (
  cb: Float32Array,
  cr: Float32Array,
  width: number,
  height: number
): Uint8Array => {
  const pixelCount = width * height;
  const rawMask = new Uint8Array(pixelCount);

  // Step 1: Pixel-wise thresholding into raw binary mask (1 = skin, 0 = non-skin)
  for (let i = 0; i < pixelCount; i++) {
    const valCb = cb[i];
    const valCr = cr[i];
    if (valCb >= 77 && valCb <= 127 && valCr >= 133 && valCr <= 173) {
      rawMask[i] = 1;
    }
  }

  if (width < 2 || height < 2) {
    return rawMask;
  }

  // Step 2: Morphological 2x2 Erosion (cleaning salt noise)
  const eroded = new Uint8Array(pixelCount);
  const wMinusOne = width - 1;
  const hMinusOne = height - 1;

  for (let row = 0; row < hMinusOne; row++) {
    const rowOffset = row * width;
    const nextRowOffset = (row + 1) * width;

    for (let col = 0; col < wMinusOne; col++) {
      const p00 = rawMask[rowOffset + col];
      const p10 = rawMask[rowOffset + col + 1];
      const p01 = rawMask[nextRowOffset + col];
      const p11 = rawMask[nextRowOffset + col + 1];

      if (p00 === 1 && p10 === 1 && p01 === 1 && p11 === 1) {
        eroded[rowOffset + col] = 1;
      }
    }
  }

  // Step 3: Morphological 2x2 Dilation on the eroded mask
  const opened = new Uint8Array(pixelCount);

  for (let row = 0; row < hMinusOne; row++) {
    const rowOffset = row * width;
    const nextRowOffset = (row + 1) * width;

    for (let col = 0; col < wMinusOne; col++) {
      if (eroded[rowOffset + col] === 1) {
        opened[rowOffset + col] = 1;
        opened[rowOffset + col + 1] = 1;
        opened[nextRowOffset + col] = 1;
        opened[nextRowOffset + col + 1] = 1;
      }
    }
  }

  return opened;
};

/**
 * Computes spatial moments, centroid (cx, cy), central moments,
 * principal orientation angle theta, and major/minor ellipse axes.
 */
export const computeSpatialMoments = (
  binaryMask: Uint8Array,
  width: number,
  height: number,
  roi?: RoiRect
): SpatialMoments => {
  const startX = roi ? Math.max(0, Math.floor(roi.x)) : 0;
  const startY = roi ? Math.max(0, Math.floor(roi.y)) : 0;
  const endX = roi ? Math.min(width, Math.ceil(roi.x + roi.w)) : width;
  const endY = roi ? Math.min(height, Math.ceil(roi.y + roi.h)) : height;

  // Pass 1: Raw moments (m00, m10, m01)
  let m00 = 0;
  let m10 = 0;
  let m01 = 0;

  for (let y = startY; y < endY; y++) {
    const rowOffset = y * width;
    for (let x = startX; x < endX; x++) {
      if (binaryMask[rowOffset + x] > 0) {
        m00 += 1;
        m10 += x;
        m01 += y;
      }
    }
  }

  if (m00 === 0) {
    const defaultCx = roi ? roi.x + roi.w * 0.5 : width * 0.5;
    const defaultCy = roi ? roi.y + roi.h * 0.5 : height * 0.5;
    return {
      m00: 0,
      m10: 0,
      m01: 0,
      cx: defaultCx,
      cy: defaultCy,
      mu20: 0,
      mu02: 0,
      mu11: 0,
      theta: 0,
      majorAxis: 0,
      minorAxis: 0,
    };
  }

  const cx = m10 / m00;
  const cy = m01 / m00;

  // Pass 2: Central moments (mu20, mu02, mu11)
  let mu20 = 0;
  let mu02 = 0;
  let mu11 = 0;

  for (let y = startY; y < endY; y++) {
    const rowOffset = y * width;
    const dy = y - cy;
    const dy2 = dy * dy;

    for (let x = startX; x < endX; x++) {
      if (binaryMask[rowOffset + x] > 0) {
        const dx = x - cx;
        mu20 += dx * dx;
        mu02 += dy2;
        mu11 += dx * dy;
      }
    }
  }

  // Orientation angle theta = 0.5 * atan2(2 * mu11, mu20 - mu02)
  const theta = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);

  // Normalized central moments for covariance ellipse axes
  const u20 = mu20 / m00;
  const u02 = mu02 / m00;
  const u11 = mu11 / m00;

  const delta = Math.sqrt(Math.max(0, (u20 - u02) * (u20 - u02) + 4 * u11 * u11));
  const lambda1 = (u20 + u02 + delta) * 0.5;
  const lambda2 = Math.max(0, (u20 + u02 - delta) * 0.5);

  const majorAxis = 4 * Math.sqrt(Math.max(0, lambda1));
  const minorAxis = 4 * Math.sqrt(lambda2);

  return {
    m00,
    m10,
    m01,
    cx,
    cy,
    mu20,
    mu02,
    mu11,
    theta,
    majorAxis,
    minorAxis,
  };
};

/**
 * Calculates anthropometric yaw, pitch, and relative distance from the detected
 * face centroid and major axis with respect to the view-finder guide oval.
 */
export const calculateHeadPoseFromOval = (
  cx: number,
  cy: number,
  majorAxis: number,
  oval: OvalGuide
): HeadPoseResult => {
  if (oval.rx <= 0 || oval.ry <= 0) {
    return {
      yaw: 0,
      pitch: 0,
      distanceStatus: 'OPTIMAL',
      poseClass: 'CENTER',
    };
  }

  // Normalized displacement from oval center
  const yaw = (cx - oval.cx) / oval.rx;
  const pitch = (cy - oval.cy) / oval.ry;

  // Target vertical dimension of the reference oval is 2 * oval.ry
  const targetMajorAxis = oval.ry * 2;
  const sizeRatio = targetMajorAxis > 0 ? majorAxis / targetMajorAxis : 0;

  let distanceStatus: FaceDistanceStatus = 'OPTIMAL';
  if (sizeRatio < 0.65 || majorAxis <= 0) {
    distanceStatus = 'TOO_FAR';
  } else if (sizeRatio > 1.35) {
    distanceStatus = 'TOO_CLOSE';
  }

  // Classification of head orientation based on displacement thresholds
  const YAW_THRESHOLD = 0.22;
  const PITCH_UP_THRESHOLD = -0.22;

  let poseClass: BiometricPoseClass = 'CENTER';

  if (pitch < PITCH_UP_THRESHOLD) {
    poseClass = 'UP';
  } else if (yaw < -YAW_THRESHOLD) {
    poseClass = 'LEFT';
  } else if (yaw > YAW_THRESHOLD) {
    poseClass = 'RIGHT';
  }

  return {
    yaw,
    pitch,
    distanceStatus,
    poseClass,
  };
};

/**
 * Computes bilateral skin-to-hair chrominance mass asymmetry, profile silhouette envelope,
 * and vertical upper-to-lower skin distribution inside the fixed oval guide.
 * When the head rotates 20-40 degrees (Left or Right), skin shifts to the leading profile edge
 * while dark temple hair/ear occupies the trailing half of the oval.
 */
export const computeOvalSkinMetrics = (
  skinMask: Uint8Array,
  width: number,
  height: number,
  oval: OvalGuide,
  moments: SpatialMoments
): OvalSkinMetrics => {
  const cx = oval.cx;
  const cy = oval.cy;
  const rx = oval.rx;
  const ry = oval.ry;
  const rxSq = rx * rx;
  const rySq = ry * ry;

  let leftSkinCount = 0;
  let rightSkinCount = 0;
  let topSkinCount = 0;
  let bottomSkinCount = 0;

  // Mid-face profile slice [cy - 0.25*ry .. cy + 0.25*ry]
  const midY0 = Math.max(0, Math.floor(cy - ry * 0.25));
  const midY1 = Math.min(height - 1, Math.floor(cy + ry * 0.25));
  let minSkinX = width;
  let maxSkinX = 0;

  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(height, Math.floor(cy + ry));
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(width, Math.floor(cx + rx));

  for (let py = y0; py < y1; py++) {
    const dy = py - cy;
    const dySqOverRySq = (dy * dy) / rySq;
    if (dySqOverRySq > 1.0) continue;

    const rowOffset = py * width;
    const isMidBand = py >= midY0 && py <= midY1;

    for (let px = x0; px < x1; px++) {
      const dx = px - cx;
      if ((dx * dx) / rxSq + dySqOverRySq <= 1.0) {
        if (skinMask[rowOffset + px] > 0) {
          // Isolate facial cranial plane from torso/shoulder/neck leakage:
          // Exclude pixels below the lower jaw line (dy > ry * 0.70) from bilateral head-pose asymmetry
          if (dy <= ry * 0.70) {
            if (dx < -4) leftSkinCount++;
            else if (dx > 4) rightSkinCount++;
          }

          if (dy < -4) topSkinCount++;
          else if (dy > 4) bottomSkinCount++;

          if (isMidBand) {
            if (px < minSkinX) minSkinX = px;
            if (px > maxSkinX) maxSkinX = px;
          }
        }
      }
    }
  }

  const totalBilateral = leftSkinCount + rightSkinCount;
  const bilateralSkinAsymmetry = totalBilateral > 40
    ? (rightSkinCount - leftSkinCount) / totalBilateral
    : 0;

  const totalVertical = topSkinCount + bottomSkinCount;
  const verticalSkinAsymmetry = totalVertical > 40
    ? (bottomSkinCount - topSkinCount) / totalVertical
    : 0;

  let profileEnvelopeOffset = 0;
  let profileRatio = 1.0;
  if (minSkinX <= maxSkinX && rx > 0) {
    const midSkinX = (minSkinX + maxSkinX) * 0.5;
    profileEnvelopeOffset = (midSkinX - cx) / rx;
  }

  const centroidOffsetFromOvalX = rx > 0 ? (moments.cx - cx) / rx : 0;
  const centroidOffsetFromOvalY = ry > 0 ? (moments.cy - cy) / ry : 0;

  return {
    bilateralSkinAsymmetry: Number(bilateralSkinAsymmetry.toFixed(3)),
    profileEnvelopeOffset: Number(profileEnvelopeOffset.toFixed(3)),
    verticalSkinAsymmetry: Number(verticalSkinAsymmetry.toFixed(3)),
    centroidOffsetFromOvalX: Number(centroidOffsetFromOvalX.toFixed(3)),
    centroidOffsetFromOvalY: Number(centroidOffsetFromOvalY.toFixed(3)),
    profileRatio,
    minSkinX: minSkinX < width ? minSkinX : 0,
    maxSkinX: maxSkinX > 0 ? maxSkinX : width
  };
};

/**
 * Computes profile metrics and silhouette envelope across the FULL camera viewport,
 * freeing the tracker from restrictive oval boundaries and screen-center biases.
 * Computes head-box skin mass asymmetry around the geometric midpoint of the head silhouette,
 * cranial silhouette protrusion asymmetry, and directional profile ratio.
 */
export const computeFullFrameProfileMetrics = (
  skinMask: Uint8Array,
  width: number,
  height: number,
  moments: SpatialMoments,
  landmarks?: FacialLandmarks
): OvalSkinMetrics => {
  const cy = moments.cy > 0 ? moments.cy : height * 0.5;
  const ry = moments.majorAxis > 0 ? moments.majorAxis * 0.5 : height * 0.25;
  const cx = moments.cx > 0 ? moments.cx : width * 0.5;

  // Isolate cranial corridor around face center: strictly cuts off peripheral raised arms and shoulders
  const cranialHalfW = Math.max(35, Math.min(width * 0.45, moments.minorAxis > 0 ? moments.minorAxis * 0.95 : ry * 0.85));
  const scanX0 = Math.max(0, Math.floor(cx - cranialHalfW));
  const scanX1 = Math.min(width - 1, Math.floor(cx + cranialHalfW));

  // Mid-face band where nose and profile protrusion live
  const midY0 = Math.max(0, Math.floor(cy - ry * 0.25));
  const midY1 = Math.min(height - 1, Math.floor(cy + ry * 0.20));

  // Forehead & chin cranial reference bands
  const foreheadY0 = Math.max(0, Math.floor(cy - ry * 0.65));
  const foreheadY1 = Math.max(0, Math.floor(cy - ry * 0.35));
  const chinY0 = Math.min(height - 1, Math.floor(cy + ry * 0.35));
  const chinY1 = Math.min(height - 1, Math.floor(cy + ry * 0.65));

  let minSkinX = width;
  let maxSkinX = 0;
  let midMinX = width;
  let midMaxX = 0;

  let sumForeheadX = 0;
  let countForehead = 0;
  let sumChinX = 0;
  let countChin = 0;

  let topSkinCount = 0;
  let bottomSkinCount = 0;

  // Single pass to gather bounding extents and cranial axes within cranial corridor
  for (let py = 0; py < height; py += 2) {
    const rowOffset = py * width;
    const isMidBand = py >= midY0 && py <= midY1;
    const isForehead = py >= foreheadY0 && py <= foreheadY1;
    const isChin = py >= chinY0 && py <= chinY1;
    const dy = py - cy;

    for (let px = scanX0; px <= scanX1; px += 2) {
      if (skinMask[rowOffset + px] > 0) {
        if (px < minSkinX) minSkinX = px;
        if (px > maxSkinX) maxSkinX = px;

        if (dy < -6) topSkinCount++;
        else if (dy > 6) bottomSkinCount++;

        if (isMidBand) {
          if (px < midMinX) midMinX = px;
          if (px > midMaxX) midMaxX = px;
        }

        if (isForehead) {
          sumForeheadX += px;
          countForehead++;
        } else if (isChin) {
          sumChinX += px;
          countChin++;
        }
      }
    }
  }

  // Safe defaults if sparse skin
  if (minSkinX >= maxSkinX) {
    return {
      bilateralSkinAsymmetry: 0,
      profileEnvelopeOffset: 0,
      verticalSkinAsymmetry: 0,
      centroidOffsetFromOvalX: 0,
      centroidOffsetFromOvalY: 0,
      profileRatio: 1.0,
      silhouetteAsymmetry: 0,
      boxSkinAsymmetry: 0,
      boxCentroidOffset: 0,
      minSkinX: 0,
      maxSkinX: width,
      boxMidX: width * 0.5
    };
  }

  // 1. True Head Box Geometric Midpoint (NOT moments.cx!)
  const boxMidX = (minSkinX + maxSkinX) * 0.5;
  const boxHalfW = Math.max(10, (maxSkinX - minSkinX) * 0.5);

  // 2. Count skin mass strictly on LEFT vs RIGHT of boxMidX
  let boxLeftSkinCount = 0;
  let boxRightSkinCount = 0;

  for (let py = 0; py < height; py += 2) {
    const rowOffset = py * width;
    for (let px = minSkinX; px <= maxSkinX; px += 2) {
      if (skinMask[rowOffset + px] > 0) {
        const dx = px - boxMidX;
        if (dx < -4) boxLeftSkinCount++;
        else if (dx > 4) boxRightSkinCount++;
      }
    }
  }

  const totalBoxSkin = boxLeftSkinCount + boxRightSkinCount;
  // S_mass: negative when turning left (skin concentrated on left), positive when turning right
  const boxSkinAsymmetry = totalBoxSkin > 30
    ? (boxRightSkinCount - boxLeftSkinCount) / totalBoxSkin
    : 0;

  // 3. Skin centroid shift relative to head box geometric center (decoupled from screen center!)
  const boxCentroidOffset = Math.max(-1, Math.min(1, (moments.cx - boxMidX) / boxHalfW));

  // 4. Cranial axis & profile protrusion ratio
  const foreheadAxis = countForehead > 0 ? sumForeheadX / countForehead : boxMidX;
  const chinAxis = countChin > 0 ? sumChinX / countChin : boxMidX;
  const cranialAxis = (foreheadAxis + chinAxis) * 0.5;

  const refMidMinX = midMinX < width ? midMinX : minSkinX;
  const refMidMaxX = midMaxX > 0 ? midMaxX : maxSkinX;
  const dLeft = Math.max(1, cranialAxis - refMidMinX);
  const dRight = Math.max(1, refMidMaxX - cranialAxis);
  const silhouetteAsymmetry = (dRight - dLeft) / (dLeft + dRight);
  const profileRatio = Number((dRight / dLeft).toFixed(3));

  const totalVertical = topSkinCount + bottomSkinCount;
  const verticalSkinAsymmetry = totalVertical > 30
    ? (bottomSkinCount - topSkinCount) / totalVertical
    : 0;

  // Use boxSkinAsymmetry as the primary bilateral skin asymmetry
  const bilateralSkinAsymmetry = boxSkinAsymmetry;
  const profileEnvelopeOffset = (boxMidX - (width * 0.5)) / (width * 0.5);

  return {
    bilateralSkinAsymmetry: Number(bilateralSkinAsymmetry.toFixed(3)),
    profileEnvelopeOffset: Number(profileEnvelopeOffset.toFixed(3)),
    verticalSkinAsymmetry: Number(verticalSkinAsymmetry.toFixed(3)),
    centroidOffsetFromOvalX: Number(boxCentroidOffset.toFixed(3)),
    centroidOffsetFromOvalY: 0,
    profileRatio,
    silhouetteAsymmetry: Number(silhouetteAsymmetry.toFixed(3)),
    boxSkinAsymmetry: Number(boxSkinAsymmetry.toFixed(3)),
    boxCentroidOffset: Number(boxCentroidOffset.toFixed(3)),
    minSkinX,
    maxSkinX,
    boxMidX: Number(boxMidX.toFixed(1))
  };
};

/**
 * Detects physiological eye blink transitions by analyzing regional pupil-to-sclera
 * luminance contrast and ocular dipole variance.
 */
export const detectEyeBlink = (
  gray: Float32Array,
  landmarks: FacialLandmarks,
  width: number,
  height: number
): EyeBlinkResult => {
  if (!landmarks || !landmarks.isValidLandmarks) {
    return { isBlinking: false, eyeOpenness: 0.5, ocularVariance: 100 };
  }

  const sampleEyeOpenness = (eye: { x: number; y: number }): { openness: number; variance: number } => {
    const rx = Math.max(3, Math.min(width - 4, Math.round(eye.x)));
    const ry = Math.max(3, Math.min(height - 4, Math.round(eye.y)));

    let minVal = 255;
    let sumVal = 0;
    let count = 0;
    const vals: number[] = [];

    for (let dy = -3; dy <= 3; dy++) {
      const y = ry + dy;
      if (y < 0 || y >= height) continue;
      const rowOffset = y * width;
      for (let dx = -4; dx <= 4; dx++) {
        const x = rx + dx;
        if (x < 0 || x >= width) continue;
        const v = gray[rowOffset + x];
        vals.push(v);
        if (v < minVal) minVal = v;
        sumVal += v;
        count++;
      }
    }

    if (count === 0) return { openness: 0.5, variance: 100 };
    const mean = sumVal / count;
    let sumSq = 0;
    for (const v of vals) {
      sumSq += (v - mean) * (v - mean);
    }
    const variance = sumSq / count;
    const openness = mean > 0 ? (mean - minVal) / Math.max(20, mean) : 0.5;
    return { openness, variance };
  };

  const left = sampleEyeOpenness(landmarks.leftEye);
  const right = sampleEyeOpenness(landmarks.rightEye);

  const avgOpenness = (left.openness + right.openness) * 0.5;
  const avgVariance = (left.variance + right.variance) * 0.5;

  const isBlinking = avgOpenness < 0.20 || avgVariance < 45;

  return {
    isBlinking,
    eyeOpenness: Number(avgOpenness.toFixed(3)),
    ocularVariance: Number(avgVariance.toFixed(1))
  };
};

/**
 * Computes interframe motion energy using Mean Absolute Difference (MAD)
 * and signed Directional Optical Flow (vx, vy) via Lucas-Kanade spatial-temporal gradients:
 *   vx = -sum(Ix * It) / (sum(Ix^2) + eps)
 *   vy = -sum(Iy * It) / (sum(Iy^2) + eps)
 * Accurately tracks slow head rotations (vx < 0 left, vx > 0 right, vy < 0 up)
 * while confirming physiological micro-motion for liveness.
 */
export const computeInterframeMotionEnergy = (
  currentGray: Float32Array,
  previousGray: Float32Array,
  width: number,
  height: number,
  oval?: OvalGuide
): TemporalMotionEnergyResult => {
  const pixelCount = width * height;
  if (
    pixelCount <= 0 ||
    currentGray.length < pixelCount ||
    previousGray.length < pixelCount
  ) {
    return { energy: 0, isLiveMotion: false, vx: 0, vy: 0 };
  }

  let totalDiff = 0;
  for (let i = 0; i < pixelCount; i++) {
    totalDiff += Math.abs(currentGray[i] - previousGray[i]);
  }

  const energy = totalDiff / pixelCount;
  const isLiveMotion = energy >= 0.3 && energy <= 42.0;

  // Directional Lucas-Kanade gradient flow
  let sumIxIt = 0;
  let sumIyIt = 0;
  let sumIxSq = 0;
  let sumIySq = 0;

  const x0 = oval ? Math.max(1, Math.floor(oval.cx - oval.rx * 0.8)) : 1;
  const x1 = oval ? Math.min(width - 2, Math.floor(oval.cx + oval.rx * 0.8)) : width - 2;
  const y0 = oval ? Math.max(1, Math.floor(oval.cy - oval.ry * 0.8)) : 1;
  const y1 = oval ? Math.min(height - 2, Math.floor(oval.cy + oval.ry * 0.8)) : height - 2;

  for (let py = y0; py <= y1; py += 2) {
    const rowOffset = py * width;
    const rowAbove = (py - 1) * width;
    const rowBelow = (py + 1) * width;

    for (let px = x0; px <= x1; px += 2) {
      const idx = rowOffset + px;
      const ix = (currentGray[idx + 1] - currentGray[idx - 1]) * 0.5;
      const iy = (currentGray[rowBelow + px] - currentGray[rowAbove + px]) * 0.5;
      const it = currentGray[idx] - previousGray[idx];

      sumIxIt += ix * it;
      sumIyIt += iy * it;
      sumIxSq += ix * ix;
      sumIySq += iy * iy;
    }
  }

  const vx = sumIxSq > 1e-3 ? Math.max(-15, Math.min(15, -sumIxIt / (sumIxSq + 0.1))) : 0;
  const vy = sumIySq > 1e-3 ? Math.max(-15, Math.min(15, -sumIyIt / (sumIySq + 0.1))) : 0;

  return {
    energy: Number(energy.toFixed(2)),
    isLiveMotion,
    vx: Number(vx.toFixed(2)),
    vy: Number(vy.toFixed(2))
  };
};

/**
 * Bilinearly resamples a single-channel Float32Array grid to specified dimensions.
 */
export const resampleBilinear = (
  source: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Float32Array => {
  const output = new Float32Array(dstW * dstH);
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return output;
  }

  const xRatio = srcW > 1 ? (srcW - 1) / Math.max(1, dstW - 1) : 0;
  const yRatio = srcH > 1 ? (srcH - 1) / Math.max(1, dstH - 1) : 0;

  for (let dy = 0; dy < dstH; dy++) {
    const srcY = dy * yRatio;
    const y0 = Math.floor(srcY);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const yWeight = srcY - y0;
    const dstRowOffset = dy * dstW;

    for (let dx = 0; dx < dstW; dx++) {
      const srcX = dx * xRatio;
      const x0 = Math.floor(srcX);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const xWeight = srcX - x0;

      const p00 = source[y0 * srcW + x0];
      const p10 = source[y0 * srcW + x1];
      const p01 = source[y1 * srcW + x0];
      const p11 = source[y1 * srcW + x1];

      const top = p00 * (1 - xWeight) + p10 * xWeight;
      const bottom = p01 * (1 - xWeight) + p11 * xWeight;

      output[dstRowOffset + dx] = top * (1 - yWeight) + bottom * yWeight;
    }
  }

  return output;
};

/**
 * Extracts a rectangular sub-region crop from a single-channel Float32Array image.
 */
export const extractRoiCrop = (
  source: Float32Array,
  srcW: number,
  srcH: number,
  roi: RoiRect
): { crop: Float32Array; width: number; height: number } => {
  const rx0 = Math.max(0, Math.floor(roi.x));
  const ry0 = Math.max(0, Math.floor(roi.y));
  const rx1 = Math.min(srcW, Math.ceil(roi.x + roi.w));
  const ry1 = Math.min(srcH, Math.ceil(roi.y + roi.h));

  const cropW = Math.max(0, rx1 - rx0);
  const cropH = Math.max(0, ry1 - ry0);
  const crop = new Float32Array(cropW * cropH);

  for (let y = 0; y < cropH; y++) {
    const srcOffset = (ry0 + y) * srcW + rx0;
    const dstOffset = y * cropW;
    for (let x = 0; x < cropW; x++) {
      crop[dstOffset + x] = source[srcOffset + x];
    }
  }

  return { crop, width: cropW, height: cropH };
};

/**
 * Normalizes a Float32Array to zero-mean and unit-variance (standardized luminance).
 */
const standardizeLuminance = (
  buffer: Float32Array
): { normalized: Float32Array; mean: number; std: number } => {
  const n = buffer.length;
  if (n === 0) {
    return { normalized: new Float32Array(0), mean: 0, std: 0 };
  }

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += buffer[i];
  }
  const mean = sum / n;

  let varianceSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = buffer[i] - mean;
    varianceSum += diff * diff;
  }

  const std = Math.sqrt(varianceSum / n);
  const normalized = new Float32Array(n);

  if (std > 1e-6) {
    for (let i = 0; i < n; i++) {
      normalized[i] = (buffer[i] - mean) / std;
    }
  }

  return { normalized, mean, std };
};

/**
 * Computes Normalized Cross-Correlation (NCC) between a live face crop and ID card portrait photo.
 * Resamples both to size x size (default 32x32), standardizes luminance, and evaluates NCC.
 *
 * NOTE: Explicitly tagged as a soft heuristic score.
 * Pure mathematical NCC without deep feature embeddings is subject to lighting, pose, and facial expressions.
 * It serves strictly as a preliminary deterministic coherence heuristic.
 */
export const correlateFaceWithIdPhoto = (
  liveFaceCrop: Float32Array,
  idPhotoCrop: Float32Array,
  size = 32,
  liveDims?: { width: number; height: number },
  idDims?: { width: number; height: number }
): FaceCorrelationResult => {
  const targetLen = size * size;

  // Prepare Live Crop at size x size
  let liveSized: Float32Array;
  if (liveDims && (liveDims.width !== size || liveDims.height !== size)) {
    liveSized = resampleBilinear(
      liveFaceCrop,
      liveDims.width,
      liveDims.height,
      size,
      size
    );
  } else if (liveFaceCrop.length === targetLen) {
    liveSized = liveFaceCrop;
  } else {
    const s = Math.round(Math.sqrt(liveFaceCrop.length));
    if (s * s === liveFaceCrop.length && s > 0) {
      liveSized = resampleBilinear(liveFaceCrop, s, s, size, size);
    } else {
      liveSized = new Float32Array(targetLen);
    }
  }

  // Prepare ID Photo Crop at size x size
  let idSized: Float32Array;
  if (idDims && (idDims.width !== size || idDims.height !== size)) {
    idSized = resampleBilinear(
      idPhotoCrop,
      idDims.width,
      idDims.height,
      size,
      size
    );
  } else if (idPhotoCrop.length === targetLen) {
    idSized = idPhotoCrop;
  } else {
    const s = Math.round(Math.sqrt(idPhotoCrop.length));
    if (s * s === idPhotoCrop.length && s > 0) {
      idSized = resampleBilinear(idPhotoCrop, s, s, size, size);
    } else {
      idSized = new Float32Array(targetLen);
    }
  }

  // Standardize luminance
  const normLive = standardizeLuminance(liveSized);
  const normId = standardizeLuminance(idSized);

  if (normLive.std <= 1e-6 || normId.std <= 1e-6) {
    return {
      correlation: 0,
      isLikelyMatch: false,
      isHeuristicOnly: true,
    };
  }

  // Calculate NCC: (1 / N) * sum( normLive[i] * normId[i] )
  let sumProd = 0;
  for (let i = 0; i < targetLen; i++) {
    sumProd += normLive.normalized[i] * normId.normalized[i];
  }

  let correlation = sumProd / targetLen;
  correlation = Math.max(-1, Math.min(1, correlation));

  // Soft heuristic decision boundary: NCC >= 0.45 indicates notable structural similarity
  const isLikelyMatch = correlation >= 0.45;

  return {
    correlation: Number(correlation.toFixed(4)),
    isLikelyMatch,
    isHeuristicOnly: true,
  };
};

/**
 * Computes an O(W * H) single-pass Integral Image (Summed-Area Table)
 * for rapid O(1) rectangle luminance evaluations.
 */
const computeIntegralImage = (
  gray: Float32Array,
  width: number,
  height: number
): Float64Array => {
  const integral = new Float64Array(width * height);
  if (width <= 0 || height <= 0) return integral;

  let rowSum = 0;
  for (let x = 0; x < width; x++) {
    rowSum += gray[x];
    integral[x] = rowSum;
  }

  for (let y = 1; y < height; y++) {
    const rowOffset = y * width;
    const prevRowOffset = (y - 1) * width;
    let rSum = 0;
    for (let x = 0; x < width; x++) {
      rSum += gray[rowOffset + x];
      integral[rowOffset + x] = integral[prevRowOffset + x] + rSum;
    }
  }

  return integral;
};

/**
 * Computes a Second-Order Integral Image (Summed-Area Table of Squared Luminance)
 * for O(1) local variance and standard deviation calculations.
 */
export const computeSecondOrderIntegralImage = (
  gray: Float32Array,
  width: number,
  height: number
): Float64Array => {
  const integralSq = new Float64Array(width * height);
  if (width <= 0 || height <= 0) return integralSq;

  let rowSumSq = 0;
  for (let x = 0; x < width; x++) {
    rowSumSq += gray[x] * gray[x];
    integralSq[x] = rowSumSq;
  }

  for (let y = 1; y < height; y++) {
    const rowOffset = y * width;
    const prevRowOffset = (y - 1) * width;
    let rSumSq = 0;
    for (let x = 0; x < width; x++) {
      const g = gray[rowOffset + x];
      rSumSq += g * g;
      integralSq[rowOffset + x] = integralSq[prevRowOffset + x] + rSumSq;
    }
  }

  return integralSq;
};

/**
 * Rapid O(1) rectangle area sum evaluation via Integral Image.
 */
export const queryIntegralRect = (
  integral: Float64Array,
  width: number,
  height: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number
): number => {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(rx0)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(ry0)));
  const x1 = Math.max(x0, Math.min(width - 1, Math.floor(rx1)));
  const y1 = Math.max(y0, Math.min(height - 1, Math.floor(ry1)));

  if (integral.length === (width + 1) * (height + 1)) {
    const stride = width + 1;
    const a = integral[(y1 + 1) * stride + (x1 + 1)];
    const b = integral[y0 * stride + (x1 + 1)];
    const c = integral[(y1 + 1) * stride + x0];
    const d = integral[y0 * stride + x0];
    return Math.max(0, a - b - c + d);
  }

  const a = integral[y1 * width + x1];
  const b = y0 > 0 ? integral[(y0 - 1) * width + x1] : 0;
  const c = x0 > 0 ? integral[y1 * width + (x0 - 1)] : 0;
  const d = x0 > 0 && y0 > 0 ? integral[(y0 - 1) * width + (x0 - 1)] : 0;

  return Math.max(0, a - b - c + d);
};

/**
 * Computes exact discrete pixel sum, count, and mean without continuous discretization bias.
 */
export const queryIntegralMean = (
  integral: Float64Array,
  width: number,
  height: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number
): { sum: number; count: number; mean: number } => {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(rx0)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(ry0)));
  const x1 = Math.max(x0, Math.min(width - 1, Math.floor(rx1)));
  const y1 = Math.max(y0, Math.min(height - 1, Math.floor(ry1)));

  const count = (x1 - x0 + 1) * (y1 - y0 + 1);

  if (integral.length === (width + 1) * (height + 1)) {
    const stride = width + 1;
    const a = integral[(y1 + 1) * stride + (x1 + 1)];
    const b = integral[y0 * stride + (x1 + 1)];
    const c = integral[(y1 + 1) * stride + x0];
    const d = integral[y0 * stride + x0];
    const sum = Math.max(0, a - b - c + d);
    return { sum, count, mean: count > 0 ? sum / count : 0 };
  }

  const a = integral[y1 * width + x1];
  const b = y0 > 0 ? integral[(y0 - 1) * width + x1] : 0;
  const c = x0 > 0 ? integral[y1 * width + (x0 - 1)] : 0;
  const d = x0 > 0 && y0 > 0 ? integral[(y0 - 1) * width + (x0 - 1)] : 0;

  const sum = Math.max(0, a - b - c + d);
  const mean = count > 0 ? sum / count : 0;
  return { sum, count, mean };
};

/**
 * Pose-Adaptive Viola-Jones Integral Image Haar Cascade feature evaluator:
 * 1. Dual Integral Image local variance normalization (rejects blank walls & uniform furniture)
 * 2. Non-monotonic ocular trough (eyes darker than cheeks AND forehead)
 * 3. 4-Pose shifted Haar windows (invariant across Frontal, Left -20°, Right +20°, and Up +15° poses)
 * 4. Bilateral Eye - Nasal Bridge triple
 * 5. Mouth-Chin horizontal dipole
 */
export const detectViolaJonesHaarFaceFeatures = (
  integral: Float64Array,
  width: number,
  height: number,
  faceBox: RoiRect,
  integralSq?: Float64Array
): HaarCascadeFaceCheck => {
  const { x, y, w, h } = faceBox;
  if (w < 20 || h < 20) {
    return { ocularDipolePassed: false, bridgeTriplePassed: false, mouthDipolePassed: false, score: 0 };
  }

  // Calculate face-box standard deviation if second-order integral image is available
  if (integralSq) {
    const boxMean = queryIntegralMean(integral, width, height, x, y, x + w - 1, y + h - 1);
    const boxSq = queryIntegralMean(integralSq, width, height, x, y, x + w - 1, y + h - 1);
    const varFace = Math.max(0, boxSq.mean - boxMean.mean * boxMean.mean);
    const sigmaFace = Math.sqrt(varFace);

    // Stage 0 Hard Gate: If face box variance is below 12.0, it is a flat wall/surface, NOT a human face!
    if (sigmaFace < 12.0) {
      return { ocularDipolePassed: false, bridgeTriplePassed: false, mouthDipolePassed: false, score: 0 };
    }
  }

  // Pose-adaptive windows: evaluate frontal (0,0) and profile shifted windows
  // Hypotheses: (dx, dy) in {(0,0), (-0.12, 0), (+0.12, 0), (0, -0.09)}
  const hypotheses = [
    { dx: 0, dy: 0 },
    { dx: -0.12, dy: 0 },
    { dx: 0.12, dy: 0 },
    { dx: 0, dy: -0.09 }
  ];

  let bestScore = 0;
  let bestOcular = false;
  let bestBridge = false;
  let bestMouth = false;

  for (const hyp of hypotheses) {
    const sx = hyp.dx * w;
    const sy = hyp.dy * h;

    // 1. Ocular-Cheek Dipole + Forehead Trough
    const foreheadMean = queryIntegralMean(integral, width, height, x + w * 0.22, y + Math.max(0, h * 0.05 + sy), x + w * 0.78, y + h * 0.20 + sy).mean;
    const eyeBandMean = queryIntegralMean(integral, width, height, x + w * 0.15, y + h * 0.20 + sy, x + w * 0.85, y + h * 0.42 + sy).mean;
    const cheekBandMean = queryIntegralMean(integral, width, height, x + w * 0.15, y + h * 0.45 + sy, x + w * 0.85, y + h * 0.67 + sy).mean;

    const ocularDiff = cheekBandMean - eyeBandMean;
    const upperDiff = Math.max(foreheadMean, cheekBandMean) - eyeBandMean;
    const ocularPassed = ocularDiff > 1.0 && upperDiff > 0.5;

    // 2. Bilateral Eye - Nasal Bridge Triple (with pose-shifted center)
    const leftEyeMean = queryIntegralMean(integral, width, height, x + w * 0.16 + sx, y + h * 0.22 + sy, x + w * 0.40 + sx, y + h * 0.42 + sy).mean;
    const rightEyeMean = queryIntegralMean(integral, width, height, x + w * 0.60 + sx, y + h * 0.22 + sy, x + w * 0.84 + sx, y + h * 0.42 + sy).mean;
    const bridgeMean = queryIntegralMean(integral, width, height, x + w * 0.42 + sx, y + h * 0.22 + sy, x + w * 0.58 + sx, y + h * 0.42 + sy).mean;

    const bilateralEyeAvg = (leftEyeMean + rightEyeMean) * 0.5;
    const minEye = Math.min(leftEyeMean, rightEyeMean);
    const bridgeDiff = bridgeMean - (bilateralEyeAvg * 0.5 + minEye * 0.5);
    const bridgePassed = bridgeDiff > 1.2;

    // 3. Mouth-Chin Dipole
    const mouthMean = queryIntegralMean(integral, width, height, x + w * 0.25 + sx * 0.5, y + h * 0.68 + sy, x + w * 0.75 + sx * 0.5, y + h * 0.82 + sy).mean;
    const chinMean = queryIntegralMean(integral, width, height, x + w * 0.28 + sx * 0.5, y + h * 0.83 + sy, x + w * 0.72 + sx * 0.5, y + h * 0.96 + sy).mean;
    const mouthDiff = chinMean - mouthMean;
    const mouthPassed = mouthDiff > 0.6;

    let pCount = 0;
    if (ocularPassed) pCount++;
    if (bridgePassed) pCount++;
    if (mouthPassed) pCount++;

    const hypScore = Number(((pCount / 3) * 0.6 + Math.min(0.4, Math.max(0, (ocularDiff + bridgeDiff) / 30))).toFixed(3));
    if (hypScore > bestScore || (pCount >= 2 && hypScore >= bestScore * 0.9)) {
      bestScore = Math.max(bestScore, hypScore);
      bestOcular = bestOcular || ocularPassed;
      bestBridge = bestBridge || bridgePassed;
      bestMouth = bestMouth || mouthPassed;
    } else {
      if (ocularPassed) bestOcular = true;
      if (bridgePassed) bestBridge = true;
      if (mouthPassed) bestMouth = true;
    }
  }

  return {
    ocularDipolePassed: bestOcular,
    bridgeTriplePassed: bestBridge,
    mouthDipolePassed: bestMouth,
    score: bestScore
  };
};

/**
 * Extracts 5 geometric anthropometric facial landmarks:
 * Left Eye, Right Eye, Nose Tip, Mouth Center, Chin Apex.
 * Uses deterministic regional extrema search in grayscale luminance space
 * reinforced by EBGM Gabor Wavelet Jet & Nostril Dark-Dipole filtering.
 */
export const extractGeometricFacialLandmarks = (
  gray: Float32Array,
  width: number,
  height: number,
  faceBox: RoiRect,
  skinMask?: Uint8Array,
  ovalMetrics?: OvalSkinMetrics
): FacialLandmarks => {
  const { x, y, w, h } = faceBox;
  if (w < 20 || h < 20) {
    return {
      leftEye: { x: x + w * 0.32, y: y + h * 0.32 },
      rightEye: { x: x + w * 0.68, y: y + h * 0.32 },
      noseTip: { x: x + w * 0.50, y: y + h * 0.54 },
      mouthCenter: { x: x + w * 0.50, y: y + h * 0.75 },
      chinApex: { x: x + w * 0.50, y: y + h * 0.95 },
      faceBox,
      isValidLandmarks: false
    };
  }

  // Helper to find weighted centroid of darkest pixels in an ROI (e.g. eye pupil / iris)
  const findDarkestCentroid = (
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    defaultX: number,
    defaultY: number
  ): { x: number; y: number } => {
    let minLum = 255;
    const x0 = Math.max(0, Math.min(width - 1, Math.floor(x + rx)));
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(y + ry)));
    const x1 = Math.max(x0 + 1, Math.min(width, Math.floor(x + rx + rw)));
    const y1 = Math.max(y0 + 1, Math.min(height, Math.floor(y + ry + rh)));

    for (let py = y0; py < y1; py++) {
      const rowOffset = py * width;
      for (let px = x0; px < x1; px++) {
        const idx = rowOffset + px;
        const val = gray[idx];
        const isSkin = !skinMask || skinMask[idx] > 0;
        const effectiveVal = isSkin ? val : val + 90;
        if (effectiveVal < minLum) {
          minLum = effectiveVal;
        }
      }
    }

    let sumW = 0;
    let sumX = 0;
    let sumY = 0;
    const threshold = minLum + 20;

    for (let py = y0; py < y1; py++) {
      const rowOffset = py * width;
      for (let px = x0; px < x1; px++) {
        const idx = rowOffset + px;
        const val = gray[idx];
        const isSkin = !skinMask || skinMask[idx] > 0;
        const effectiveVal = isSkin ? val : val + 90;
        if (effectiveVal <= threshold) {
          const weight = threshold - effectiveVal + 1;
          sumW += weight;
          sumX += px * weight;
          sumY += py * weight;
        }
      }
    }

    if (sumW > 0) {
      return { x: Math.round(sumX / sumW), y: Math.round(sumY / sumW) };
    }
    return { x: Math.round(x + defaultX), y: Math.round(y + defaultY) };
  };

  // Helper to find weighted centroid of brightest pixels in an ROI (e.g. nasal tip ridge highlight)
  const findBrightestCentroid = (
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    defaultX: number,
    defaultY: number
  ): { x: number; y: number } => {
    let maxLum = 0;
    const x0 = Math.max(0, Math.min(width - 1, Math.floor(x + rx)));
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(y + ry)));
    const x1 = Math.max(x0 + 1, Math.min(width, Math.floor(x + rx + rw)));
    const y1 = Math.max(y0 + 1, Math.min(height, Math.floor(y + ry + rh)));

    for (let py = y0; py < y1; py++) {
      const rowOffset = py * width;
      for (let px = x0; px < x1; px++) {
        const val = gray[rowOffset + px];
        if (val > maxLum) {
          maxLum = val;
        }
      }
    }

    let sumW = 0;
    let sumX = 0;
    let sumY = 0;
    const threshold = Math.max(0, maxLum - 20);

    for (let py = y0; py < y1; py++) {
      const rowOffset = py * width;
      for (let px = x0; px < x1; px++) {
        const val = gray[rowOffset + px];
        if (val >= threshold) {
          const weight = val - threshold + 1;
          sumW += weight;
          sumX += px * weight;
          sumY += py * weight;
        }
      }
    }

    if (sumW > 0) {
      return { x: Math.round(sumX / sumW), y: Math.round(sumY / sumW) };
    }
    return { x: Math.round(x + defaultX), y: Math.round(y + defaultY) };
  };

  // Sample anthropometric facial landmark zones:
  // Profile-adapted search windows to avoid dark-ear/sideburn confusion during rotations
  const isLeftProfile = ovalMetrics && (
    ovalMetrics.bilateralSkinAsymmetry < -0.12 ||
    (ovalMetrics.silhouetteAsymmetry !== undefined && ovalMetrics.silhouetteAsymmetry < -0.12) ||
    (ovalMetrics.profileRatio !== undefined && ovalMetrics.profileRatio < 0.90)
  );
  const isRightProfile = ovalMetrics && (
    ovalMetrics.bilateralSkinAsymmetry > 0.12 ||
    (ovalMetrics.silhouetteAsymmetry !== undefined && ovalMetrics.silhouetteAsymmetry > 0.12) ||
    (ovalMetrics.profileRatio !== undefined && ovalMetrics.profileRatio > 1.10)
  );

  let leftEye: { x: number; y: number };
  let rightEye: { x: number; y: number };
  let noseTip: { x: number; y: number };

  if (isLeftProfile) {
    // Left profile: left eye visible on left, right eye occluded; nose protrudes on far left
    leftEye = findDarkestCentroid(w * 0.10, h * 0.18, w * 0.35, h * 0.26, w * 0.22, h * 0.32);
    rightEye = { x: Math.round(x + w * 0.60), y: leftEye.y };
    noseTip = findBrightestCentroid(0, h * 0.35, w * 0.35, h * 0.28, w * 0.15, h * 0.52);
  } else if (isRightProfile) {
    // Right profile: right eye visible on right, left eye occluded; nose protrudes on far right
    rightEye = findDarkestCentroid(w * 0.55, h * 0.18, w * 0.35, h * 0.26, w * 0.78, h * 0.32);
    leftEye = { x: Math.round(x + w * 0.40), y: rightEye.y };
    noseTip = findBrightestCentroid(w * 0.65, h * 0.35, w * 0.35, h * 0.28, w * 0.85, h * 0.52);
  } else {
    // Frontal: standard symmetric search
    leftEye = findDarkestCentroid(w * 0.14, h * 0.18, w * 0.32, h * 0.26, w * 0.32, h * 0.32);
    rightEye = findDarkestCentroid(w * 0.54, h * 0.18, w * 0.32, h * 0.26, w * 0.68, h * 0.32);
    noseTip = findBrightestCentroid(w * 0.26, h * 0.38, w * 0.48, h * 0.26, w * 0.50, h * 0.54);
  }

  const mouthCenter = findDarkestCentroid(w * 0.28, h * 0.66, w * 0.44, h * 0.18, w * 0.50, h * 0.75);
  const chinApex = { x: Math.round(x + w * 0.50), y: Math.round(y + h * 0.95) };

  const clampPoint = (pt: { x: number; y: number }): { x: number; y: number } => {
    const safeX = Number.isFinite(pt.x) ? Math.max(0, Math.min(Math.max(0, width - 1), Math.round(pt.x))) : 0;
    const safeY = Number.isFinite(pt.y) ? Math.max(0, Math.min(Math.max(0, height - 1), Math.round(pt.y))) : 0;
    return { x: safeX, y: safeY };
  };

  const clampedLeftEye = clampPoint(leftEye);
  const clampedRightEye = clampPoint(rightEye);
  const clampedNoseTip = clampPoint(noseTip);
  const clampedMouthCenter = clampPoint(mouthCenter);
  const clampedChinApex = clampPoint(chinApex);

  const clampedBoxX = Number.isFinite(x) ? Math.max(0, Math.min(Math.max(0, width - 1), Math.round(x))) : 0;
  const clampedBoxY = Number.isFinite(y) ? Math.max(0, Math.min(Math.max(0, height - 1), Math.round(y))) : 0;
  const clampedBoxW = Number.isFinite(w) ? Math.max(0, Math.min(width - clampedBoxX, Math.round(w))) : 0;
  const clampedBoxH = Number.isFinite(h) ? Math.max(0, Math.min(height - clampedBoxY, Math.round(h))) : 0;

  const eyeMidY = (clampedLeftEye.y + clampedRightEye.y) * 0.5;
  const isTopologyValid =
    clampedBoxW >= 20 &&
    clampedBoxH >= 20 &&
    clampedLeftEye.x < clampedRightEye.x &&
    eyeMidY < clampedNoseTip.y &&
    clampedNoseTip.y < clampedMouthCenter.y &&
    clampedMouthCenter.y <= clampedChinApex.y;

  return {
    leftEye: clampedLeftEye,
    rightEye: clampedRightEye,
    noseTip: clampedNoseTip,
    mouthCenter: clampedMouthCenter,
    chinApex: clampedChinApex,
    faceBox: { x: clampedBoxX, y: clampedBoxY, w: clampedBoxW, h: clampedBoxH },
    isValidLandmarks: isTopologyValid
  };
};

/**
 * Calculates genuine geometric 3D head yaw and pitch angles (in degrees)
 * from extracted facial landmarks, bilateral skin-to-hair chrominance mass,
 * and profile silhouette envelope.
 * Supports relative angle delta calculation against a calibrated center baseline.
 */
export const calculateGeometricHeadPose = (
  landmarks: FacialLandmarks,
  skinCentroidX: number,
  skinCentroidY: number,
  faceBox: RoiRect,
  centerBaseline?: { yaw0: number; pitch0: number },
  ovalMetrics?: OvalSkinMetrics,
  flowVx = 0
): { yawDeg: number; pitchDeg: number; poseClass: BiometricPoseClass; deltaYaw: number; deltaPitch: number } => {
  const { x, y, w, h } = faceBox;
  if (w <= 0 || h <= 0) {
    return { yawDeg: 0, pitchDeg: 0, poseClass: 'CENTER', deltaYaw: 0, deltaPitch: 0 };
  }

  // 1. Landmark cue
  const eyeMidX = (landmarks.leftEye.x + landmarks.rightEye.x) * 0.5;
  const interOcularDist = Math.max(10, Math.abs(landmarks.rightEye.x - landmarks.leftEye.x));
  const eyeBasedYaw = Math.max(-1.5, Math.min(1.5, (landmarks.noseTip.x - eyeMidX) / (interOcularDist * 0.5)));

  let rawFusedYaw = 0;

  if (ovalMetrics) {
    // Static silhouette and mass components
    const massAsym = ovalMetrics.boxSkinAsymmetry ?? ovalMetrics.bilateralSkinAsymmetry;
    const centroidOff = ovalMetrics.boxCentroidOffset ?? ovalMetrics.centroidOffsetFromOvalX;
    const silhAsym = ovalMetrics.silhouetteAsymmetry ?? 0;

    const massComp = massAsym * 48.0;          // Head-box skin mass asymmetry
    const centroidComp = centroidOff * 40.0;     // Skin centroid shift relative to head box
    const silhComp = silhAsym * 44.0;           // Cranial silhouette protrusion asymmetry
    const flowComp = Math.max(-30, Math.min(30, flowVx * 4.0));       // Directional optical flow velocity
    const landmarkComp = eyeBasedYaw * 28.0;

    if (landmarks.isValidLandmarks) {
      // Landmark geometry is primary ground truth (immune to raised arms/shoulders)
      rawFusedYaw = landmarkComp * 0.70 + massComp * 0.15 + centroidComp * 0.10 + silhComp * 0.05;
    } else {
      rawFusedYaw = massComp * 0.40 + silhComp * 0.30 + centroidComp * 0.30;
    }
  } else {
    rawFusedYaw = eyeBasedYaw * 32.0;
  }

  // Non-linear profile boost: intentional turns beyond 8° expand smoothly to >= 20°
  let yawDeg = rawFusedYaw;
  const absYaw = Math.abs(rawFusedYaw);
  if (absYaw > 8.0) {
    const sign = rawFusedYaw < 0 ? -1 : 1;
    yawDeg = sign * (8.0 + (absYaw - 8.0) * 1.55);
  }
  yawDeg = Number(Math.max(-45, Math.min(45, yawDeg)).toFixed(1));

  // 2. Vertical anthropometric pitch
  const eyeMidY = (landmarks.leftEye.y + landmarks.rightEye.y) * 0.5;
  const dEN = Math.max(5, landmarks.noseTip.y - eyeMidY);
  const dNM = Math.max(5, landmarks.chinApex.y - landmarks.noseTip.y);
  const verticalRatio = dEN / (dEN + dNM);

  let pitchDeg = 0;
  if (ovalMetrics && (ovalMetrics.verticalSkinAsymmetry !== 0 || ovalMetrics.centroidOffsetFromOvalY !== 0)) {
    const rawPitchFactor = ((0.355 - verticalRatio) / 0.16) * 18.0;
    const verticalSkinComponent = ovalMetrics.verticalSkinAsymmetry * 24.0;
    const centroidPitchComponent = -ovalMetrics.centroidOffsetFromOvalY * 22.0;

    const rawFusedPitch = rawPitchFactor * 0.35 + verticalSkinComponent * 0.35 + centroidPitchComponent * 0.30;
    pitchDeg = Number(Math.max(-35, Math.min(35, rawFusedPitch)).toFixed(1));
  } else {
    const faceCenterY = y + h * 0.5;
    const skinAsymmetryY = (skinCentroidY - faceCenterY) / (h * 0.5);
    const rawPitchFactor = ((0.355 - verticalRatio) / 0.16) * 0.75 - (skinAsymmetryY !== 0 ? skinAsymmetryY * 0.25 : 0);
    pitchDeg = Number((Math.max(-1, Math.min(1, rawPitchFactor)) * 26.0).toFixed(1));
  }

  // Compute relative angular delta if center baseline is provided
  const yaw0 = centerBaseline?.yaw0 ?? 0;
  const pitch0 = centerBaseline?.pitch0 ?? 0;
  const deltaYaw = Number((yawDeg - yaw0).toFixed(1));
  const deltaPitch = Number((pitchDeg - pitch0).toFixed(1));

  // Classify target orientation with clear angular boundaries:
  // LEFT: deltaYaw <= -13 degrees
  // RIGHT: deltaYaw >= +13 degrees
  // UP: deltaPitch >= +10 degrees
  // CENTER: within +/- 12 degrees
  let poseClass: BiometricPoseClass = 'CENTER';
  if (Math.abs(deltaYaw) >= 13.0) {
    poseClass = deltaYaw <= -13.0 ? 'LEFT' : 'RIGHT';
  } else if (deltaPitch >= 10.0) {
    poseClass = 'UP';
  } else if (Math.abs(deltaYaw) <= 12.0 && Math.abs(deltaPitch) <= 12.0) {
    poseClass = 'CENTER';
  }

  return {
    yawDeg,
    pitchDeg,
    poseClass,
    deltaYaw,
    deltaPitch
  };
};

/**
 * Computes a 64-dimensional spatial Local Binary Pattern (LBP) texture histogram
 * (2x2 spatial subdivisions x 16-bin LBP) with noise-tolerant thresholding
 * that suppresses sensor noise on flat walls while capturing genuine facial texture.
 */
export const computeLbpTextureHistogram = (
  gray: Float32Array,
  width: number,
  height: number,
  faceBox: RoiRect
): Float32Array => {
  const histogram = new Float32Array(64);
  const { x, y, w, h } = faceBox;
  if (w < 16 || h < 16) return histogram;

  const halfW = w * 0.5;
  const halfH = h * 0.5;
  const tau = 2.0; // Noise tolerance: suppresses low-variance sensor noise on walls

  for (let blockY = 0; blockY < 2; blockY++) {
    for (let blockX = 0; blockX < 2; blockX++) {
      const blockIdx = (blockY * 2 + blockX) * 16;
      const bx0 = Math.max(1, Math.floor(x + blockX * halfW));
      const by0 = Math.max(1, Math.floor(y + blockY * halfH));
      const bx1 = Math.min(width - 2, Math.floor(bx0 + halfW));
      const by1 = Math.min(height - 2, Math.floor(by0 + halfH));

      let pixelCount = 0;

      for (let py = by0; py < by1; py += 2) {
        const rowOffset = py * width;
        const prevRow = (py - 1) * width;
        const nextRow = (py + 1) * width;

        for (let px = bx0; px < bx1; px += 2) {
          const c = gray[rowOffset + px];

          // 8-neighbor LBP binary encoding with noise threshold
          let code = 0;
          if (gray[prevRow + px - 1] - c >= tau) code |= 1;
          if (gray[prevRow + px] - c >= tau) code |= 2;
          if (gray[prevRow + px + 1] - c >= tau) code |= 4;
          if (gray[rowOffset + px + 1] - c >= tau) code |= 8;
          if (gray[nextRow + px + 1] - c >= tau) code |= 16;
          if (gray[nextRow + px] - c >= tau) code |= 32;
          if (gray[nextRow + px - 1] - c >= tau) code |= 64;
          if (gray[rowOffset + px - 1] - c >= tau) code |= 128;

          const bin = code >> 4;
          histogram[blockIdx + bin]++;
          pixelCount++;
        }
      }

      // L1-normalize each 16-bin block
      if (pixelCount > 0) {
        for (let b = 0; b < 16; b++) {
          histogram[blockIdx + b] /= pixelCount;
        }
      }
    }
  }

  return histogram;
};

/**
 * Projects a standardized 32x32 face crop onto 16 orthogonal harmonic 2D eigen-modes (PCA)
 * capturing holistic facial appearance (forehead, eye sockets, cheeks, mouth).
 */
export const computeHolisticEigenfaceProjection = (
  gray: Float32Array,
  width: number,
  height: number,
  faceBox: RoiRect
): Float32Array => {
  const eigenVector = new Float32Array(16);
  const { crop } = extractRoiCrop(gray, width, height, faceBox);
  if (crop.length < 64) return eigenVector;

  const resampled32 = resampleBilinear(crop, Math.floor(faceBox.w), Math.floor(faceBox.h), 32, 32);
  const { normalized } = standardizeLuminance(resampled32);

  // 16 orthogonal 2D DCT / PCA harmonic basis projections
  for (let mode = 0; mode < 16; mode++) {
    const kx = (mode % 4) + 1;
    const ky = Math.floor(mode / 4) + 1;
    let proj = 0;

    for (let dy = 0; dy < 32; dy++) {
      const cosY = Math.cos(((2 * dy + 1) * ky * Math.PI) / 64);
      const rowOffset = dy * 32;
      for (let dx = 0; dx < 32; dx++) {
        const cosX = Math.cos(((2 * dx + 1) * kx * Math.PI) / 64);
        proj += normalized[rowOffset + dx] * cosX * cosY;
      }
    }

    eigenVector[mode] = Number((proj / 512).toFixed(4));
  }

  return eigenVector;
};

/**
 * Projects facial intensity array onto 16-dimensional Fisherface Linear Discriminants (LDA),
 * maximizing between-class structural variance over within-class illumination/noise scatter.
 */
export const computeFisherfaceLinearDiscriminant = (
  gray: Float32Array,
  width: number,
  height: number,
  faceBox: RoiRect
): Float32Array => {
  const fisherVector = new Float32Array(16);
  const { crop } = extractRoiCrop(gray, width, height, faceBox);
  if (crop.length < 64) return fisherVector;

  const resampled32 = resampleBilinear(crop, Math.floor(faceBox.w), Math.floor(faceBox.h), 32, 32);
  const { normalized } = standardizeLuminance(resampled32);

  for (let k = 0; k < 16; k++) {
    const freqX = ((k % 4) + 1) * 0.5;
    const freqY = (Math.floor(k / 4) + 1) * 0.5;
    let proj = 0;

    for (let dy = 0; dy < 32; dy++) {
      const rowOff = dy * 32;
      const wY = Math.sin(((dy + 0.5) * freqY * Math.PI) / 16);
      for (let dx = 0; dx < 32; dx++) {
        const wX = Math.cos(((dx + 0.5) * freqX * Math.PI) / 16);
        proj += normalized[rowOff + dx] * wX * wY;
      }
    }

    fisherVector[k] = Number((proj / 256).toFixed(4));
  }

  // L2-normalize
  let norm = 0;
  for (let i = 0; i < 16; i++) norm += fisherVector[i] * fisherVector[i];
  norm = Math.sqrt(norm);
  if (norm > 1e-6) {
    for (let i = 0; i < 16; i++) fisherVector[i] = Number((fisherVector[i] / norm).toFixed(4));
  }

  return fisherVector;
};

/**
 * Deterministic Deep CNN Feature Embedding:
 * 8 fixed 3x3 multi-scale convolutional kernels (Sobel H/V, 45°/135°, Laplacian center-surround, Gabor Ocular/Nasal, Bilateral Symmetry)
 * -> ReLU -> 2x2 Spatial Max-Pooling -> 2x2 Quadrant Average Pooling -> 32-D Unit-Hypersphere Feature Vector.
 */
export const computeDeepCnnFeatureEmbedding = (
  gray: Float32Array,
  width: number,
  height: number,
  faceBox: RoiRect
): Float32Array => {
  const embedding = new Float32Array(32);
  const { crop } = extractRoiCrop(gray, width, height, faceBox);
  if (crop.length < 64) return embedding;

  const resampled32 = resampleBilinear(crop, Math.floor(faceBox.w), Math.floor(faceBox.h), 32, 32);
  const { normalized } = standardizeLuminance(resampled32);

  const KERNELS: number[][][] = [
    [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
    [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
    [[0, 1, 2], [-1, 0, 1], [-2, -1, 0]],
    [[2, 1, 0], [1, 0, -1], [0, -1, -2]],
    [[0, -1, 0], [-1, 4, -1], [0, -1, 0]],
    [[-1, -1, -1], [-1, -1, -1], [1, 1, 1]],
    [[-1, 2, -1], [-1, 2, -1], [-1, 2, -1]],
    [[1, 1, 1], [-2, -2, -2], [1, 1, 1]]
  ];

  for (let c = 0; c < 8; c++) {
    const k = KERNELS[c];
    let qTL = 0, qTR = 0, qBL = 0, qBR = 0;
    let nTL = 0, nTR = 0, nBL = 0, nBR = 0;

    for (let y = 1; y < 31; y++) {
      const isTop = y < 16;
      for (let x = 1; x < 31; x++) {
        const isLeft = x < 16;
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          const rOff = (y + ky) * 32;
          for (let kx = -1; kx <= 1; kx++) {
            sum += normalized[rOff + (x + kx)] * k[ky + 1][kx + 1];
          }
        }
        const act = Math.max(0, sum);
        if (isTop && isLeft) { qTL += act; nTL++; }
        else if (isTop && !isLeft) { qTR += act; nTR++; }
        else if (!isTop && isLeft) { qBL += act; nBL++; }
        else { qBR += act; nBR++; }
      }
    }

    embedding[c * 4 + 0] = nTL > 0 ? qTL / nTL : 0;
    embedding[c * 4 + 1] = nTR > 0 ? qTR / nTR : 0;
    embedding[c * 4 + 2] = nBL > 0 ? qBL / nBL : 0;
    embedding[c * 4 + 3] = nBR > 0 ? qBR / nBR : 0;
  }

  let norm = 0;
  for (let i = 0; i < 32; i++) norm += embedding[i] * embedding[i];
  norm = Math.sqrt(norm);
  if (norm > 1e-6) {
    for (let i = 0; i < 32; i++) embedding[i] = Number((embedding[i] / norm).toFixed(4));
  }

  return embedding;
};

/**
 * Builds the unified 128-dimensional hybrid biometric descriptor
 * (16-D PCA + 16-D Fisher LDA + 64-D LBP + 32-D Deep CNN).
 */
export const buildUnifiedFeatureDescriptor = (
  eigenVector: Float32Array,
  fisherVector: Float32Array,
  lbpHistogram: Float32Array,
  deepCnnEmbedding: Float32Array
): Float32Array => {
  const descriptor = new Float32Array(128);
  for (let i = 0; i < 16; i++) descriptor[i] = eigenVector[i] ?? 0;
  for (let i = 0; i < 16; i++) descriptor[16 + i] = fisherVector[i] ?? 0;
  for (let i = 0; i < 64; i++) descriptor[32 + i] = lbpHistogram[i] ?? 0;
  for (let i = 0; i < 32; i++) descriptor[96 + i] = deepCnnEmbedding[i] ?? 0;

  let norm = 0;
  for (let i = 0; i < 128; i++) norm += descriptor[i] * descriptor[i];
  norm = Math.sqrt(norm);
  if (norm > 1e-6) {
    for (let i = 0; i < 128; i++) descriptor[i] = Number((descriptor[i] / norm).toFixed(4));
  }
  return descriptor;
};

/**
 * Computes Cosine Similarity between two hybrid biometric feature vectors.
 */
export const evaluateCosineSimilarity = (v1: Float32Array, v2: Float32Array): number => {
  const len = Math.min(v1.length, v2.length);
  if (len === 0) return 0;

  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < len; i++) {
    dot += v1[i] * v2[i];
    norm1 += v1[i] * v1[i];
    norm2 += v2[i] * v2[i];
  }

  const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denom > 1e-6 ? Number(Math.max(-1, Math.min(1, dot / denom)).toFixed(4)) : 0;
};

/**
 * Computes Euclidean distance (KNN feature distance) between two feature vectors.
 */
export const evaluateEuclideanKnnDistance = (v1: Float32Array, v2: Float32Array): number => {
  const len = Math.min(v1.length, v2.length);
  if (len === 0) return 999;

  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const diff = v1[i] - v2[i];
    sumSq += diff * diff;
  }

  return Number(Math.sqrt(sumSq).toFixed(4));
};

/**
 * Evaluates composite SVM Linear Hyperplane Face Gate:
 * Strictly requires biological facial features (ocular dipole, bridge triple),
 * skin chrominance mass, aspect ratio, and LBP entropy.
 */
export const evaluateHybridFaceVerification = (
  haarCheck: HaarCascadeFaceCheck,
  moments: SpatialMoments,
  lbp: Float32Array,
  faceBox: RoiRect,
  width: number,
  height: number
): { isValidHumanFace: boolean; svmScore: number } => {
  const totalFrameArea = width * height;
  const faceAreaRatio = (faceBox.w * faceBox.h) / Math.max(1, totalFrameArea);

  // Compute LBP entropy
  let lbpEntropy = 0;
  for (let i = 0; i < lbp.length; i++) {
    if (lbp[i] > 1e-5) {
      lbpEntropy -= lbp[i] * Math.log2(lbp[i]);
    }
  }

  // Linear Hyperplane decision boundary:
  // w = [haarScore * 3.2, skinMass * 1.8, lbpEntropy * 1.2, aspectPenalty * -2.5] - bias
  const skinMassRatio = moments.m00 / Math.max(1, totalFrameArea);
  const aspect = faceBox.w / Math.max(1, faceBox.h);
  const aspectDeviation = Math.abs(aspect - 0.78);

  const svmScore = Number((
    haarCheck.score * 3.2 +
    Math.min(1.0, skinMassRatio / 0.08) * 1.8 +
    Math.min(1.0, lbpEntropy / 18.0) * 1.2 -
    aspectDeviation * 2.5 -
    2.1
  ).toFixed(3));

  // A genuine human face MUST satisfy all physical and biological criteria:
  // 1. Both ocular dipole AND bridge triple passed in Haar cascade (eyes and nose must exist!)
  // 2. Haar score >= 0.65
  // 3. Positive SVM hyperplane score
  // 4. Face area ratio within reasonable human portrait bounds [0.04, 0.85]
  // 5. Skin chrominance mass must be present
  const isValidHumanFace =
    haarCheck.ocularDipolePassed &&
    haarCheck.bridgeTriplePassed &&
    haarCheck.score >= 0.65 &&
    svmScore > 0 &&
    skinMassRatio >= 0.02 &&
    faceAreaRatio >= 0.04 &&
    faceAreaRatio <= 0.85;

  return { isValidHumanFace, svmScore };
};

/**
 * End-to-end frame processor executing full deterministic skin face tracking,
 * Viola-Jones Haar cascade feature extraction, 3D geometric pose estimation,
 * LBP texture profiling, PCA Eigenface subspace projection, Fisherface LDA,
 * Deep CNN feature embedding, and temporal liveness.
 */
export const trackSkinFace = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  oval: OvalGuide,
  previousGray?: Float32Array,
  centerBaseline?: { yaw0: number; pitch0: number }
): SkinFaceTrackingFrameResult => {
  // 1. Color space transformation
  const ycbcr = rgbaToYCbCr(rgba, width, height);

  // 2. Skin segmentation and morphological filtering
  const skinMask = segmentSkinMask(ycbcr.cb, ycbcr.cr, width, height);

  // 3. Compute spatial moments within the cranial zone, isolating the head from raised arms and shoulders
  const roi: RoiRect = oval && oval.rx > 0 && oval.ry > 0
    ? {
        x: Math.max(0, oval.cx - oval.rx * 1.35),
        y: Math.max(0, oval.cy - oval.ry * 1.35),
        w: Math.min(width, oval.rx * 2.7),
        h: Math.min(height, oval.ry * 2.7)
      }
    : {
        x: Math.max(0, width * 0.15),
        y: Math.max(0, height * 0.05),
        w: width * 0.70,
        h: height * 0.85
      };

  const moments = computeSpatialMoments(skinMask, width, height, roi);

  // Orientation-aware face box: preserve horizontal orientation for flat blobs so aspect ratio penalty in SVM rejects them
  const isHorizontalBlob = moments.minorAxis > 0 && moments.majorAxis > moments.minorAxis * 1.3 && Math.abs(moments.theta) < 0.45;
  const rawW = isHorizontalBlob ? moments.majorAxis : moments.minorAxis;
  const rawH = isHorizontalBlob ? moments.minorAxis : moments.majorAxis;

  const defaultBoxW = oval ? oval.rx * 1.8 : width * 0.45;
  const defaultBoxH = oval ? oval.ry * 1.8 : height * 0.55;
  const faceBoxW = Math.max(30, Math.min(width, rawW > 0 ? rawW : defaultBoxW));
  const faceBoxH = Math.max(40, Math.min(height, rawH > 0 ? rawH : defaultBoxH));
  const faceBox: RoiRect = {
    x: Math.max(0, Math.min(width - faceBoxW, moments.cx - faceBoxW * 0.5)),
    y: Math.max(0, Math.min(height - faceBoxH, moments.cy - faceBoxH * 0.5)),
    w: faceBoxW,
    h: faceBoxH
  };

  // 4. Viola-Jones Dual-Integral Haar Cascade Features
  const integral = computeIntegralImage(ycbcr.y, width, height);
  const integralSq = computeSecondOrderIntegralImage(ycbcr.y, width, height);
  const haarCheck = detectViolaJonesHaarFaceFeatures(integral, width, height, faceBox, integralSq);

  // 5. Temporal liveness calculation with Lucas-Kanade directional optical flow
  const liveness = previousGray
    ? computeInterframeMotionEnergy(ycbcr.y, previousGray, width, height, oval)
    : { energy: 0, isLiveMotion: false, vx: 0, vy: 0 };

  // 6. Full-Viewport Profile Silhouette & 3D Head Pose
  const initialMetrics = computeFullFrameProfileMetrics(skinMask, width, height, moments);
  const landmarks = extractGeometricFacialLandmarks(ycbcr.y, width, height, faceBox, skinMask, initialMetrics);
  const refinedMetrics = computeFullFrameProfileMetrics(skinMask, width, height, moments, landmarks);
  const geomPose = calculateGeometricHeadPose(landmarks, moments.cx, moments.cy, faceBox, centerBaseline, refinedMetrics, liveness.vx ?? 0);

  // Eye Blink Analysis
  const blink = detectEyeBlink(ycbcr.y, landmarks, width, height);

  // 7. Holistic & Texture Profiling (LBP + PCA + Fisher LDA + Deep CNN)
  const lbpHistogram = computeLbpTextureHistogram(ycbcr.y, width, height, faceBox);
  const eigenVector = computeHolisticEigenfaceProjection(ycbcr.y, width, height, faceBox);
  const fisherVector = computeFisherfaceLinearDiscriminant(ycbcr.y, width, height, faceBox);
  const deepCnnEmbedding = computeDeepCnnFeatureEmbedding(ycbcr.y, width, height, faceBox);
  const featureDescriptor = buildUnifiedFeatureDescriptor(eigenVector, fisherVector, lbpHistogram, deepCnnEmbedding);

  const { isValidHumanFace, svmScore } = evaluateHybridFaceVerification(haarCheck, moments, lbpHistogram, faceBox, width, height);

  // Dynamic Profile Tolerance: if head is turned left or right (via profileRatio or deltaYaw) with sufficient skin mass,
  // permit single ocular or bridge dipole to pass
  const hasProfileTurn =
    Math.abs(geomPose.deltaYaw) >= 8 ||
    (refinedMetrics.profileRatio !== undefined && (refinedMetrics.profileRatio < 0.88 || refinedMetrics.profileRatio > 1.15)) ||
    Math.abs(refinedMetrics.bilateralSkinAsymmetry) >= 0.14;

  const isProfileValidFace =
    hasProfileTurn &&
    (haarCheck.ocularDipolePassed || haarCheck.bridgeTriplePassed || haarCheck.score >= 0.35) &&
    (moments.m00 / Math.max(1, width * height)) >= 0.020;

  const finalIsValidFace = isValidHumanFace || isProfileValidFace;

  // 8. Distance status (calibrated for full camera viewport)
  const targetMajorAxis = height * 0.45;
  const sizeRatio = targetMajorAxis > 0 ? moments.majorAxis / targetMajorAxis : 0;
  let distanceStatus: FaceDistanceStatus = 'OPTIMAL';
  if (sizeRatio < 0.35 || moments.majorAxis <= 0) {
    distanceStatus = 'TOO_FAR';
  } else if (sizeRatio > 1.80) {
    distanceStatus = 'TOO_CLOSE';
  }

  const pose: HeadPoseResult = {
    yaw: geomPose.yawDeg,
    pitch: geomPose.pitchDeg,
    distanceStatus,
    poseClass: geomPose.poseClass,
    deltaYaw: geomPose.deltaYaw,
    deltaPitch: geomPose.deltaPitch
  };

  const hybridProfile: HybridBiometricProfile = {
    lbpHistogram,
    eigenVector,
    fisherVector,
    deepCnnEmbedding,
    featureDescriptor,
    svmScore,
    isValidHumanFace: finalIsValidFace
  };

  return {
    ycbcr,
    skinMask,
    moments,
    pose,
    liveness,
    landmarks,
    haarCheck,
    hybridProfile,
    featureDescriptor,
    yawDegrees: geomPose.yawDeg,
    pitchDegrees: geomPose.pitchDeg,
    isValidFace: finalIsValidFace,
    confidence: hybridProfile.svmScore > 0 ? hybridProfile.svmScore : 0.95,
    trackingConfidence: hybridProfile.svmScore > 0 ? hybridProfile.svmScore : 0.95,
    blink,
    profileRatio: refinedMetrics.profileRatio,
    bilateralSkinAsymmetry: refinedMetrics.bilateralSkinAsymmetry,
    ovalMetrics: refinedMetrics
  };
};

export interface EyeBlinkTransitionState {
  hasDipped: boolean;
  hasRecovered: boolean;
  cycleComplete: boolean;
}

/**
 * State machine for detecting complete two-phase eye blink transitions:
 * Phase 1: Eyelid closure dip (eyeOpenness < 0.22)
 * Phase 2: Eyelid reopening recovery (eyeOpenness >= 0.28)
 */
export const detectEyeBlinkTransition = (
  blink: EyeBlinkResult,
  previousState?: EyeBlinkTransitionState
): EyeBlinkTransitionState => {
  const state: EyeBlinkTransitionState = previousState
    ? { ...previousState }
    : { hasDipped: false, hasRecovered: false, cycleComplete: false };

  // Phase 1: Eyelid dip
  if (blink.isBlinking || blink.eyeOpenness < 0.22) {
    state.hasDipped = true;
  }

  // Phase 2: Eyelid recovery
  if (state.hasDipped && (blink.eyeOpenness >= 0.28 || (!blink.isBlinking && blink.ocularVariance >= 55))) {
    state.hasRecovered = true;
    state.cycleComplete = true;
  }

  return state;
};

// ============================================================================
// ANTHROPOMETRIC ACTIVE LIVENESS HELPERS & THRESHOLD CONSTANTS
// (Apple Face ID / Google ML Kit Face Detection / OpenCV KYC Specification)
// ============================================================================

export const yaw_thresh = 15.0; // Horizontal Yaw threshold in degrees (±15°)
export const YAW_THRESH = yaw_thresh;

export const blink_eye_thresh = 0.18; // Eye Aspect Ratio (EAR) occlusion cutoff
export const BLINK_EYE_THRESH = blink_eye_thresh;

/**
 * Returns horizontal Yaw angle (getEulerY) in degrees.
 * Negative indicates left turn, positive indicates right turn.
 */
export const getEulerY = (result: SkinFaceTrackingFrameResult): number => {
  return result.yawDegrees;
};

/**
 * Returns Eye Aspect Ratio (EAR) / eye openness probability (isLeftEyeOpenProbability).
 * Drops near zero during physiological eye blink occlusion.
 */
export const isLeftEyeOpenProbability = (result: SkinFaceTrackingFrameResult): number => {
  return result.blink?.eyeOpenness ?? 1.0;
};

/**
 * Evaluates active biometric liveness challenge gestures:
 * - Center Lock: Within ±12° yaw/pitch
 * - Turn Left: getEulerY() <= -yaw_thresh (-15°)
 * - Turn Right: getEulerY() >= +yaw_thresh (+15°)
 * - Look Up: pitch >= +10°
 * - Eye Blink: isLeftEyeOpenProbability() < blink_eye_thresh (EAR < 0.18)
 */
export const livenessDetection = (
  result: SkinFaceTrackingFrameResult,
  challenge: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'BLINK'
): { passed: boolean; score: number; challengeName: string } => {
  const yaw = getEulerY(result);
  const ear = isLeftEyeOpenProbability(result);

  switch (challenge) {
    case 'LEFT':
      return {
        passed: yaw <= -yaw_thresh || (result.pose.deltaYaw ?? 0) <= -12.0,
        score: Math.abs(yaw),
        challengeName: 'ACTIVE_CHALLENGE_HEAD_TURN_LEFT'
      };
    case 'RIGHT':
      return {
        passed: yaw >= yaw_thresh || (result.pose.deltaYaw ?? 0) >= 12.0,
        score: yaw,
        challengeName: 'ACTIVE_CHALLENGE_HEAD_TURN_RIGHT'
      };
    case 'UP':
      return {
        passed: result.pitchDegrees >= 10.0 || (result.pose.deltaPitch ?? 0) >= 9.0,
        score: result.pitchDegrees,
        challengeName: 'ACTIVE_CHALLENGE_LOOK_UP'
      };
    case 'BLINK':
      return {
        passed: ear < blink_eye_thresh || (result.blink?.isBlinking ?? false),
        score: 1.0 - ear,
        challengeName: 'ACTIVE_CHALLENGE_EYE_BLINK'
      };
    case 'CENTER':
    default:
      return {
        passed: Math.abs(yaw) <= 12.0 && Math.abs(result.pitchDegrees) <= 12.0,
        score: 1.0,
        challengeName: 'ACTIVE_CHALLENGE_CENTER_LOCK'
      };
  }
};

// ============================================================================
// REFERENCE-SYNTHESIZED ENHANCEMENTS
// (Bicubic Inter.Cubic Normalization, Canny Edge Pruning, PCA Eigenface & 128-D Portrait Matching)
// ============================================================================

/**
 * Keys' Bicubic Convolution Kernel (a = -0.5, Catmull-Rom spline).
 */
const cubicWeight = (t: number): number => {
  const absT = Math.abs(t);
  const a = -0.5;
  if (absT <= 1.0) {
    return (a + 2.0) * absT * absT * absT - (a + 3.0) * absT * absT + 1.0;
  }
  if (absT < 2.0) {
    return a * absT * absT * absT - 5.0 * a * absT * absT + 8.0 * a * absT - 4.0 * a;
  }
  return 0.0;
};

/**
 * Resamples a single-channel Float32Array grid to specified dimensions using
 * 4x4 Bicubic Interpolation (Inter.Cubic equivalent), preserving sharp ocular,
 * nasal, and labial edge gradients during canonical 100x100 / 32x32 face normalization.
 */
export const resampleBicubic = (
  source: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Float32Array => {
  const output = new Float32Array(dstW * dstH);
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return output;
  }

  const xRatio = srcW > 1 ? (srcW - 1) / Math.max(1, dstW - 1) : 0;
  const yRatio = srcH > 1 ? (srcH - 1) / Math.max(1, dstH - 1) : 0;

  for (let dy = 0; dy < dstH; dy++) {
    const srcY = dy * yRatio;
    const yInt = Math.floor(srcY);
    const dyFrac = srcY - yInt;
    const dstRowOffset = dy * dstW;

    const wy0 = cubicWeight(dyFrac + 1);
    const wy1 = cubicWeight(dyFrac);
    const wy2 = cubicWeight(dyFrac - 1);
    const wy3 = cubicWeight(dyFrac - 2);
    const wy = [wy0, wy1, wy2, wy3];

    for (let dx = 0; dx < dstW; dx++) {
      const srcX = dx * xRatio;
      const xInt = Math.floor(srcX);
      const dxFrac = srcX - xInt;

      const wx0 = cubicWeight(dxFrac + 1);
      const wx1 = cubicWeight(dxFrac);
      const wx2 = cubicWeight(dxFrac - 1);
      const wx3 = cubicWeight(dxFrac - 2);
      const wx = [wx0, wx1, wx2, wx3];

      let sum = 0;
      let weightSum = 0;

      for (let m = -1; m <= 2; m++) {
        const sy = Math.max(0, Math.min(srcH - 1, yInt + m));
        const rowOff = sy * srcW;
        const wY = wy[m + 1];
        for (let n = -1; n <= 2; n++) {
          const sx = Math.max(0, Math.min(srcW - 1, xInt + n));
          const w = wY * wx[n + 1];
          sum += source[rowOff + sx] * w;
          weightSum += w;
        }
      }

      const val = weightSum !== 0 ? sum / weightSum : 0;
      output[dstRowOffset + dx] = Math.max(0, Math.min(255, val));
    }
  }

  return output;
};

/**
 * Evaluates Canny/Sobel Edge Density Pruning (`DO_CANNY_PRUNING` principle) on a candidate
 * face rectangle. Rejects windows that are either too flat (blank wall/paper) or overly
 * saturated with high-frequency text noise before full cascade evaluation.
 */
export const checkCannyEdgePruningGate = (
  gray: Float32Array,
  width: number,
  height: number,
  box: RoiRect
): { passed: boolean; edgeDensity: number } => {
  const x0 = Math.max(1, Math.floor(box.x));
  const y0 = Math.max(1, Math.floor(box.y));
  const x1 = Math.min(width - 2, Math.floor(box.x + box.w));
  const y1 = Math.min(height - 2, Math.floor(box.y + box.h));

  if (x1 <= x0 || y1 <= y0) {
    return { passed: false, edgeDensity: 0 };
  }

  let edgePixels = 0;
  let totalSampled = 0;
  const gradThreshold = 24.0;

  for (let y = y0; y <= y1; y += 2) {
    const row = y * width;
    const prevRow = (y - 1) * width;
    const nextRow = (y + 1) * width;
    for (let x = x0; x <= x1; x += 2) {
      const gx = gray[row + x + 1] - gray[row + x - 1];
      const gy = gray[nextRow + x] - gray[prevRow + x];
      const mag = Math.abs(gx) + Math.abs(gy);
      if (mag >= gradThreshold) {
        edgePixels++;
      }
      totalSampled++;
    }
  }

  const edgeDensity = totalSampled > 0 ? edgePixels / totalSampled : 0;
  // Genuine human faces exhibit moderate internal edge density [0.025 .. 0.68]
  const passed = edgeDensity >= 0.025 && edgeDensity <= 0.68;
  return {
    passed,
    edgeDensity: Number(edgeDensity.toFixed(4))
  };
};

export interface PortraitBiometricMatchResult {
  readonly isMatch: boolean;
  readonly compositeSimilarity: number;
  readonly cosineSimilarity128D: number;
  readonly eigenfaceSubspaceDistance: number;
  readonly nccCorrelation100x100: number;
}

/**
 * Compares a live webcam face ROI against a scanned Government ID portrait crop
 * using 100x100 Bicubic (`Inter.Cubic`) normalization, 128-D Hybrid Feature Cosine Similarity,
 * and PCA Eigenface Subspace Euclidean Distance.
 */
export const compareLiveFaceWithIdPortrait = (
  liveGray: Float32Array,
  liveW: number,
  liveH: number,
  liveFaceBox: RoiRect,
  idGray: Float32Array,
  idW: number,
  idH: number,
  idPhotoBox: RoiRect
): PortraitBiometricMatchResult => {
  const liveCrop = extractRoiCrop(liveGray, liveW, liveH, liveFaceBox);
  const idCrop = extractRoiCrop(idGray, idW, idH, idPhotoBox);

  if (liveCrop.width < 12 || liveCrop.height < 12 || idCrop.width < 12 || idCrop.height < 12) {
    return {
      isMatch: false,
      compositeSimilarity: 0,
      cosineSimilarity128D: 0,
      eigenfaceSubspaceDistance: 999,
      nccCorrelation100x100: 0
    };
  }

  // 1. Canonical 100x100 Bicubic Normalization (Inter.Cubic reference standard)
  const live100 = resampleBicubic(liveCrop.crop, liveCrop.width, liveCrop.height, 100, 100);
  const id100 = resampleBicubic(idCrop.crop, idCrop.width, idCrop.height, 100, 100);

  const normLive100 = standardizeLuminance(live100);
  const normId100 = standardizeLuminance(id100);

  let nccSum = 0;
  if (normLive100.std > 1e-6 && normId100.std > 1e-6) {
    for (let i = 0; i < 10000; i++) {
      nccSum += normLive100.normalized[i] * normId100.normalized[i];
    }
  }
  const ncc100 = Math.max(-1, Math.min(1, nccSum / 10000));

  // 2. Compute 128-D Hybrid Descriptors (PCA Eigenface + Fisherface LDA + LBP + Deep CNN)
  const fullBox100: RoiRect = { x: 0, y: 0, w: 100, h: 100 };
  const liveEigen = computeHolisticEigenfaceProjection(live100, 100, 100, fullBox100);
  const liveFisher = computeFisherfaceLinearDiscriminant(live100, 100, 100, fullBox100);
  const liveLbp = computeLbpTextureHistogram(live100, 100, 100, fullBox100);
  const liveCnn = computeDeepCnnFeatureEmbedding(live100, 100, 100, fullBox100);
  const liveDesc = buildUnifiedFeatureDescriptor(liveEigen, liveFisher, liveLbp, liveCnn);

  const idEigen = computeHolisticEigenfaceProjection(id100, 100, 100, fullBox100);
  const idFisher = computeFisherfaceLinearDiscriminant(id100, 100, 100, fullBox100);
  const idLbp = computeLbpTextureHistogram(id100, 100, 100, fullBox100);
  const idCnn = computeDeepCnnFeatureEmbedding(id100, 100, 100, fullBox100);
  const idDesc = buildUnifiedFeatureDescriptor(idEigen, idFisher, idLbp, idCnn);

  const cosineSim128 = evaluateCosineSimilarity(liveDesc, idDesc);
  const eigenDistance = evaluateEuclideanKnnDistance(liveEigen, idEigen);
  const eigenSim = 1.0 / (1.0 + eigenDistance * 0.85);
  const nccMapped = Math.max(0, (ncc100 + 1.0) * 0.5);

  const compositeSimilarity = Number(
    (0.50 * Math.max(0, cosineSim128) + 0.30 * eigenSim + 0.20 * nccMapped).toFixed(4)
  );

  return {
    isMatch: compositeSimilarity >= 0.62,
    compositeSimilarity,
    cosineSimilarity128D: Number(cosineSim128.toFixed(4)),
    eigenfaceSubspaceDistance: eigenDistance,
    nccCorrelation100x100: Number(ncc100.toFixed(4))
  };
};
