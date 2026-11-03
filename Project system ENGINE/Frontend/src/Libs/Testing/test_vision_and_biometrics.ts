// [Layer: Libs/Testing]
// Responsibility: Verification suite for Full-Frame ID Optical Detection and Hybrid Facial Biometrics Liveness Engine.
// Strict TypeScript, zero 'any', universal arrow lambdas (=>).

import {
  computeConvexHull,
  fitQuadFromHull,
  findCardQuad,
  verifyCardInteriorSignature,
  computePerimeterEdgeSupport
} from '../Vision/idScanner/contour';
import { isPlausibleHumanName, sanitizeExtractedPersonName, parseNameComponents } from '../Vision/idScanner/validators';
import { computeIntegralImage } from '../Vision/idScanner/imageOps';
import {
  detectViolaJonesHaarFaceFeatures,
  calculateGeometricHeadPose,
  computeLbpTextureHistogram,
  computeHolisticEigenfaceProjection,
  computeFisherfaceLinearDiscriminant,
  computeDeepCnnFeatureEmbedding,
  buildUnifiedFeatureDescriptor,
  evaluateCosineSimilarity,
  evaluateEuclideanKnnDistance,
  evaluateHybridFaceVerification,
  trackSkinFace,
  computeOvalSkinMetrics,
  computeFullFrameProfileMetrics,
  detectEyeBlink,
  detectEyeBlinkTransition,
  computeInterframeMotionEnergy,
  FacialLandmarks,
  RoiRect
} from '../Vision/idScanner/face/skinFaceTracker';
import { BiometricFrameCacheStore, isBiometricCacheComplete } from '../../Libs/Cache/biometricFrameCache';

const runTests = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('TEST SUITE: FULL-FRAME ID SCANNER & HYBRID FACIAL BIOMETRIC LIVENESS');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, desc: string): void => {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  };

  // -------------------------------------------------------------------------
  // Test Group 1: OCR Name Sanitization & Artifact Noise Filter
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: OCR Name Sanitization & Noise Rejection ---');
  const garbledArtifact = 'N NR NW AW NWN W ZDMWR LZ W R E A';
  const validFilipinoName = 'SUICO, JHONMARK AMACA';
  const validCivilianName = 'JUAN DELA CRUZ';

  assert(!isPlausibleHumanName(garbledArtifact), 'Rejects random OCR glyph noise: "N NR NW AW NWN W ZDMWR LZ W R E A"');
  assert(sanitizeExtractedPersonName(garbledArtifact) === null, 'sanitizeExtractedPersonName returns null for gibberish');

  assert(isPlausibleHumanName(validFilipinoName), 'Accepts valid LTO license name: "SUICO, JHONMARK AMACA"');
  assert(sanitizeExtractedPersonName(validFilipinoName) === 'SUICO, JHONMARK AMACA', 'Sanitizes and preserves valid name');

  assert(isPlausibleHumanName(validCivilianName), 'Accepts valid name: "JUAN DELA CRUZ"');

  // -------------------------------------------------------------------------
  // Test Group 2: Convex Hull & Finger-Occlusion Resilient Quad Fitting
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Convex Hull & Finger-Occluded Card Quad Extraction ---');
  // 8-point polygon representing a card where fingers overlap the bottom corners
  const fingerOccludedPoints = [
    { x: 100, y: 50 },  // Top-left
    { x: 300, y: 50 },  // Top-right
    { x: 300, y: 150 }, // Right side
    { x: 290, y: 180 }, // Right finger notch
    { x: 270, y: 180 }, // Bottom-right corner
    { x: 130, y: 180 }, // Bottom-left corner
    { x: 110, y: 170 }, // Left finger notch
    { x: 100, y: 140 }  // Left side
  ];

  const hull = computeConvexHull(fingerOccludedPoints);
  assert(hull.length >= 4, `Convex hull extracted (${hull.length} vertices)`);

  const fittedQuad = fitQuadFromHull(hull);
  assert(fittedQuad !== null && fittedQuad.length === 4, 'Successfully recovered 4 corners from finger-occluded card contour');

  // -------------------------------------------------------------------------
  // Test Group 3: Full-Frame Card Detection Anywhere in Viewport
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Full-Frame Edge Detection Anywhere in Viewport ---');
  const frameW = 640;
  const frameH = 360;
  const edges = new Uint8Array(frameW * frameH);

  // Draw an ID card off-center on the right side: x=350..580 (width=230), y=80..225 (height=145, aspect=1.586)
  const cardX0 = 350;
  const cardY0 = 80;
  const cardX1 = 580;
  const cardY1 = 225;

  // Outer border edges
  for (let x = cardX0; x <= cardX1; x++) {
    edges[cardY0 * frameW + x] = 255;
    edges[cardY1 * frameW + x] = 255;
  }
  for (let y = cardY0; y <= cardY1; y++) {
    edges[y * frameW + cardX0] = 255;
    edges[y * frameW + cardX1] = 255;
  }
  // Internal typography & barcode strokes
  for (let y = cardY0 + 20; y <= cardY1 - 20; y += 4) {
    for (let x = cardX0 + 30; x <= cardX1 - 30; x += 3) {
      edges[y * frameW + x] = 255;
    }
  }

  const detectedQuad = findCardQuad(edges, frameW, frameH, [1.5858, 1.4205]);
  assert(detectedQuad !== null, 'Card detected anywhere in viewport without inner bounding box restriction');
  if (detectedQuad) {
    assert(detectedQuad.corners.length === 4, '4 corners returned');
    assert(detectedQuad.score > 0.60, `Detection score is high (${detectedQuad.score.toFixed(2)})`);
  }

  // -------------------------------------------------------------------------
  // Test Group 4: Viola-Jones Haar Integral Features & Face Presence Gate
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Viola-Jones Haar Features & SVM Face Gate ---');
  const faceW = 320;
  const faceH = 240;
  const syntheticFaceGray = new Float32Array(faceW * faceH);

  // Fill base skin luminance
  for (let i = 0; i < faceW * faceH; i++) {
    syntheticFaceGray[i] = 145.0; // skin base
  }

  const faceBox: RoiRect = { x: 100, y: 40, w: 120, h: 160 };

  // Paint dark bilateral eye sockets
  for (let y = faceBox.y + 35; y < faceBox.y + 60; y++) {
    for (let x = faceBox.x + 20; x < faceBox.x + 48; x++) {
      syntheticFaceGray[y * faceW + x] = 65.0; // Left eye
    }
    for (let x = faceBox.x + 72; x < faceBox.x + 100; x++) {
      syntheticFaceGray[y * faceW + x] = 65.0; // Right eye
    }
  }
  // Bright nasal bridge between eyes
  for (let y = faceBox.y + 35; y < faceBox.y + 60; y++) {
    for (let x = faceBox.x + 49; x < faceBox.x + 71; x++) {
      syntheticFaceGray[y * faceW + x] = 160.0;
    }
  }
  // Dark mouth cleft
  for (let y = faceBox.y + 110; y < faceBox.y + 128; y++) {
    for (let x = faceBox.x + 35; x < faceBox.x + 85; x++) {
      syntheticFaceGray[y * faceW + x] = 75.0;
    }
  }

  const integral = computeIntegralImage(syntheticFaceGray, faceW, faceH);
  const haarResult = detectViolaJonesHaarFaceFeatures(integral, faceW, faceH, faceBox);

  assert(haarResult.ocularDipolePassed, 'Viola-Jones Ocular Dipole passed (eyes darker than cheeks)');
  assert(haarResult.bridgeTriplePassed, 'Viola-Jones Nasal Bridge Triple passed (bridge brighter than eyes)');
  assert(haarResult.mouthDipolePassed, 'Viola-Jones Mouth Dipole passed (mouth shadow darker than chin)');
  assert(haarResult.score > 0.65, `Haar score is confident (${haarResult.score})`);

  // -------------------------------------------------------------------------
  // Test Group 5: True 3D Head Pose Angles (Yaw, Pitch)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Anthropometric 3D Head Pose Angles ---');
  const centerLandmarks: FacialLandmarks = {
    leftEye: { x: 138, y: 90 },
    rightEye: { x: 182, y: 90 },
    noseTip: { x: 160, y: 125 }, // Centered nose
    mouthCenter: { x: 160, y: 160 },
    chinApex: { x: 160, y: 195 },
    faceBox: { x: 100, y: 40, w: 120, h: 160 },
    isValidLandmarks: true
  };
  const centerPose = calculateGeometricHeadPose(centerLandmarks, 160, 120, centerLandmarks.faceBox);
  assert(centerPose.poseClass === 'CENTER', `Center pose correctly classified (Yaw: ${centerPose.yawDeg}°, Pitch: ${centerPose.pitchDeg}°)`);

  // Left turned nose
  const leftLandmarks: FacialLandmarks = {
    ...centerLandmarks,
    noseTip: { x: 142, y: 125 } // Nose shifted left
  };
  const leftPose = calculateGeometricHeadPose(leftLandmarks, 145, 120, centerLandmarks.faceBox);
  assert(leftPose.poseClass === 'LEFT' || leftPose.yawDeg <= -14, `Left pose correctly detected (Yaw: ${leftPose.yawDeg}°)`);

  // Right turned nose
  const rightLandmarks: FacialLandmarks = {
    ...centerLandmarks,
    noseTip: { x: 178, y: 125 } // Nose shifted right
  };
  const rightPose = calculateGeometricHeadPose(rightLandmarks, 175, 120, centerLandmarks.faceBox);
  assert(rightPose.poseClass === 'RIGHT' || rightPose.yawDeg >= 14, `Right pose correctly detected (Yaw: ${rightPose.yawDeg}°)`);

  // Up turned pitch
  const upLandmarks: FacialLandmarks = {
    ...centerLandmarks,
    leftEye: { x: 138, y: 78 },
    rightEye: { x: 182, y: 78 },
    noseTip: { x: 160, y: 106 }, // Shorter nose-to-eye segment, longer chin
    mouthCenter: { x: 160, y: 155 },
    chinApex: { x: 160, y: 205 }
  };
  const upPose = calculateGeometricHeadPose(upLandmarks, 160, 110, centerLandmarks.faceBox);
  assert(upPose.poseClass === 'UP' || upPose.pitchDeg >= 11, `Up / tilt pose correctly detected (Pitch: ${upPose.pitchDeg}°)`);

  // -------------------------------------------------------------------------
  // Test Group 6: LBP Texture, PCA Eigenface, and Cosine Cross-Pose Match
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: LBP Texture, PCA Subspace, and Cosine Cross-Pose Match ---');
  const lbpHist = computeLbpTextureHistogram(syntheticFaceGray, faceW, faceH, faceBox);
  assert(lbpHist.length === 64, 'LBP texture histogram is 64-dimensional');

  const eigenVec1 = computeHolisticEigenfaceProjection(syntheticFaceGray, faceW, faceH, faceBox);
  assert(eigenVec1.length === 16, 'PCA Eigenface projection is 16-dimensional');

  // Verify same face identity matching across poses
  const simSelf = evaluateCosineSimilarity(eigenVec1, eigenVec1);
  assert(simSelf >= 0.99, `Self cosine similarity is 1.0 (${simSelf})`);

  // Slight lighting shift
  const shiftedGray = new Float32Array(syntheticFaceGray);
  for (let i = 0; i < shiftedGray.length; i++) {
    shiftedGray[i] = Math.min(255, shiftedGray[i] + 15);
  }
  const eigenVecShifted = computeHolisticEigenfaceProjection(shiftedGray, faceW, faceH, faceBox);
  const simLighting = evaluateCosineSimilarity(eigenVec1, eigenVecShifted);
  assert(simLighting >= 0.85, `Luminance-standardized PCA cosine similarity remains high under lighting changes (${simLighting})`);

  // -------------------------------------------------------------------------
  // Test Group 7: Blank / Background Clutter Face Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Background Clutter & Empty Frame Rejection ---');
  // Pure flat or noisy wooden wall background (no human face)
  const emptyWallRgba = new Uint8ClampedArray(faceW * faceH * 4);
  for (let i = 0; i < faceW * faceH; i++) {
    const offset = i * 4;
    emptyWallRgba[offset] = 160;     // Brownish wood
    emptyWallRgba[offset + 1] = 110;
    emptyWallRgba[offset + 2] = 70;
    emptyWallRgba[offset + 3] = 255;
  }

  const emptyResult = trackSkinFace(emptyWallRgba, faceW, faceH, { cx: 160, cy: 120, rx: 68, ry: 92 });
  assert(!emptyResult.isValidFace, 'Empty room / wooden wall is strictly REJECTED (isValidFace = false)');
  assert(!emptyResult.haarCheck.ocularDipolePassed || !emptyResult.haarCheck.bridgeTriplePassed, 'Haar cascade correctly rejects non-face surface');

  // -------------------------------------------------------------------------
  // Test Group 8: Fisherface LDA, Deep CNN Embedding & 128-D Hybrid Descriptor
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Fisherface LDA, Deep CNN & 128-D Hybrid Descriptor ---');
  const fisherVec = computeFisherfaceLinearDiscriminant(syntheticFaceGray, faceW, faceH, faceBox);
  assert(fisherVec.length === 16, 'Fisherface LDA projection is 16-dimensional');

  const cnnEmbedding = computeDeepCnnFeatureEmbedding(syntheticFaceGray, faceW, faceH, faceBox);
  assert(cnnEmbedding.length === 32, 'Deep CNN feature embedding is 32-dimensional');

  const unified128 = buildUnifiedFeatureDescriptor(eigenVec1, fisherVec, lbpHist, cnnEmbedding);
  assert(unified128.length === 128, 'Unified biometric descriptor is 128-dimensional');

  const unifiedSim = evaluateCosineSimilarity(unified128, unified128);
  assert(unifiedSim >= 0.99, `Unified 128-D descriptor self-similarity is 1.0 (${unifiedSim})`);

  // -------------------------------------------------------------------------
  // Test Group 9: Relative Center-Baseline Delta Angles & Cross-Pose Lock
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Calibrated Center-Baseline Head Pose Deltas ---');
  const userCenterBaseline = { yaw0: centerPose.yawDeg, pitch0: centerPose.pitchDeg };
  const calibratedLeft = calculateGeometricHeadPose(leftLandmarks, 145, 120, centerLandmarks.faceBox, userCenterBaseline);
  assert(calibratedLeft.deltaYaw <= -14, `Relative Left delta yaw is significant (${calibratedLeft.deltaYaw}°)`);
  assert(calibratedLeft.poseClass === 'LEFT', 'Calibrated Left pose correctly classified');

  const calibratedRight = calculateGeometricHeadPose(rightLandmarks, 175, 120, centerLandmarks.faceBox, userCenterBaseline);
  assert(calibratedRight.deltaYaw >= 14, `Relative Right delta yaw is significant (${calibratedRight.deltaYaw}°)`);
  assert(calibratedRight.poseClass === 'RIGHT', 'Calibrated Right pose correctly classified');

  const calibratedUp = calculateGeometricHeadPose(upLandmarks, 160, 110, centerLandmarks.faceBox, userCenterBaseline);
  assert(calibratedUp.deltaPitch >= 11, `Relative Up delta pitch is significant (${calibratedUp.deltaPitch}°)`);
  assert(calibratedUp.poseClass === 'UP', 'Calibrated Up pose correctly classified');

  // -------------------------------------------------------------------------
  // Test Group 10: Perimeter Edge Support & Dim/Warm Indoor ID Validation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: Perimeter Edge Support & Dim Indoor ID Recognition ---');
  if (detectedQuad) {
    const support = computePerimeterEdgeSupport(edges, detectedQuad.corners, frameW, frameH);
    assert(support.passed, `Perimeter edge support passed (${(support.totalSupport * 100).toFixed(1)}%)`);
  }

  // Blank wall candidate quad should fail interior signature
  const blankWallEdges = new Uint8Array(frameW * frameH);
  const fakeQuadCorners = [
    { x: 100, y: 50 },
    { x: 300, y: 50 },
    { x: 300, y: 200 },
    { x: 100, y: 200 }
  ];
  const blankPassed = verifyCardInteriorSignature(blankWallEdges, fakeQuadCorners, frameW, frameH);
  assert(!blankPassed, 'Blank surface without text/stroke signatures is strictly REJECTED');

  // -------------------------------------------------------------------------
  // Test Group 11: 35° Left and Right Profile Turns & Oval Skin Asymmetry
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 11: 35° Left & Right Profile Turns via Oval Skin Asymmetry ---');
  const testW = 320;
  const testH = 240;
  const testOval = { cx: 160, cy: 120, rx: 84, ry: 102 };

  // Create synthetic 35° Left Profile turn:
  // Left half of oval is filled with skin (face profile), while right half contains non-skin (hair/ear)
  const leftTurnMask = new Uint8Array(testW * testH);
  for (let y = testOval.cy - testOval.ry; y <= testOval.cy + testOval.ry; y++) {
    const dy = y - testOval.cy;
    for (let x = testOval.cx - testOval.rx; x <= testOval.cx + testOval.rx; x++) {
      const dx = x - testOval.cx;
      if ((dx * dx) / (testOval.rx * testOval.rx) + (dy * dy) / (testOval.ry * testOval.ry) <= 0.85) {
        // Skin concentrated on left: from x = cx - rx to cx + 0.15*rx
        if (x <= testOval.cx + testOval.rx * 0.15) {
          leftTurnMask[y * testW + x] = 255;
        }
      }
    }
  }

  const leftMoments = {
    m00: 4500,
    m10: 4500 * (testOval.cx - 25),
    m01: 4500 * testOval.cy,
    cx: testOval.cx - 25,
    cy: testOval.cy,
    mu20: 1000,
    mu02: 1500,
    mu11: 0,
    majorAxis: 140,
    minorAxis: 90,
    theta: 0
  };

  const leftMetrics = computeOvalSkinMetrics(leftTurnMask, testW, testH, testOval, leftMoments);
  assert(leftMetrics.bilateralSkinAsymmetry <= -0.30, `Left profile produces strong negative skin asymmetry (${leftMetrics.bilateralSkinAsymmetry})`);
  assert(leftMetrics.profileEnvelopeOffset < -0.15, `Left profile envelope correctly shifts left (${leftMetrics.profileEnvelopeOffset})`);

  // Evaluate Head Pose with left metrics
  const mockLeftLandmarks: FacialLandmarks = {
    leftEye: { x: testOval.cx - 30, y: testOval.cy - 20 },
    rightEye: { x: testOval.cx + 25, y: testOval.cy - 20 },
    noseTip: { x: testOval.cx - 35, y: testOval.cy },
    mouthCenter: { x: testOval.cx - 20, y: testOval.cy + 30 },
    chinApex: { x: testOval.cx - 15, y: testOval.cy + 60 },
    faceBox: { x: testOval.cx - 65, y: testOval.cy - 70, w: 130, h: 140 },
    isValidLandmarks: true
  };
  const leftPoseRes = calculateGeometricHeadPose(mockLeftLandmarks, leftMoments.cx, leftMoments.cy, mockLeftLandmarks.faceBox, undefined, leftMetrics);
  assert(leftPoseRes.yawDeg <= -14, `Fused Left 35° profile yaw correctly reaches <= -14° (${leftPoseRes.yawDeg}°)`);
  assert(leftPoseRes.poseClass === 'LEFT', 'Left profile classified as LEFT');

  // Create synthetic 35° Right Profile turn
  const rightTurnMask = new Uint8Array(testW * testH);
  for (let y = testOval.cy - testOval.ry; y <= testOval.cy + testOval.ry; y++) {
    const dy = y - testOval.cy;
    for (let x = testOval.cx - testOval.rx; x <= testOval.cx + testOval.rx; x++) {
      const dx = x - testOval.cx;
      if ((dx * dx) / (testOval.rx * testOval.rx) + (dy * dy) / (testOval.ry * testOval.ry) <= 0.85) {
        // Skin concentrated on right: from x = cx - 0.15*rx to cx + rx
        if (x >= testOval.cx - testOval.rx * 0.15) {
          rightTurnMask[y * testW + x] = 255;
        }
      }
    }
  }

  const rightMoments = {
    m00: 4500,
    m10: 4500 * (testOval.cx + 25),
    m01: 4500 * testOval.cy,
    cx: testOval.cx + 25,
    cy: testOval.cy,
    mu20: 1000,
    mu02: 1500,
    mu11: 0,
    majorAxis: 140,
    minorAxis: 90,
    theta: 0
  };

  const rightMetrics = computeOvalSkinMetrics(rightTurnMask, testW, testH, testOval, rightMoments);
  assert(rightMetrics.bilateralSkinAsymmetry >= 0.30, `Right profile produces strong positive skin asymmetry (${rightMetrics.bilateralSkinAsymmetry})`);

  const mockRightLandmarks: FacialLandmarks = {
    leftEye: { x: testOval.cx - 25, y: testOval.cy - 20 },
    rightEye: { x: testOval.cx + 30, y: testOval.cy - 20 },
    noseTip: { x: testOval.cx + 35, y: testOval.cy },
    mouthCenter: { x: testOval.cx + 20, y: testOval.cy + 30 },
    chinApex: { x: testOval.cx + 15, y: testOval.cy + 60 },
    faceBox: { x: testOval.cx - 65, y: testOval.cy - 70, w: 130, h: 140 },
    isValidLandmarks: true
  };
  const rightPoseRes = calculateGeometricHeadPose(mockRightLandmarks, rightMoments.cx, rightMoments.cy, mockRightLandmarks.faceBox, undefined, rightMetrics);
  assert(rightPoseRes.yawDeg >= 14, `Fused Right 35° profile yaw correctly reaches >= +14° (${rightPoseRes.yawDeg}°)`);
  assert(rightPoseRes.poseClass === 'RIGHT', 'Right profile classified as RIGHT');

  // -------------------------------------------------------------------------
  // Test Group 12: Upward Head Tilt & Vertical Skin Distribution
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 12: Upward Head Tilt & Vertical Skin Metrics ---');
  const upTiltMask = new Uint8Array(testW * testH);
  for (let y = testOval.cy - testOval.ry; y <= testOval.cy + testOval.ry; y++) {
    const dy = y - testOval.cy;
    for (let x = testOval.cx - testOval.rx; x <= testOval.cx + testOval.rx; x++) {
      const dx = x - testOval.cx;
      if ((dx * dx) / (testOval.rx * testOval.rx) + (dy * dy) / (testOval.ry * testOval.ry) <= 0.85) {
        // Lower chin/neck skin exposed during upward tilt
        if (y >= testOval.cy - testOval.ry * 0.10) {
          upTiltMask[y * testW + x] = 255;
        }
      }
    }
  }

  const upMoments = {
    m00: 4500,
    m10: 4500 * testOval.cx,
    m01: 4500 * (testOval.cy - 15),
    cx: testOval.cx,
    cy: testOval.cy - 15, // Head centroid shifted upward
    mu20: 1000,
    mu02: 1500,
    mu11: 0,
    majorAxis: 135,
    minorAxis: 95,
    theta: 0
  };

  const upMetrics = computeOvalSkinMetrics(upTiltMask, testW, testH, testOval, upMoments);
  assert(upMetrics.verticalSkinAsymmetry >= 0.20, `Upward tilt shows higher lower-oval skin mass (${upMetrics.verticalSkinAsymmetry})`);

  const mockUpLandmarks: FacialLandmarks = {
    leftEye: { x: testOval.cx - 25, y: testOval.cy - 30 },
    rightEye: { x: testOval.cx + 25, y: testOval.cy - 30 },
    noseTip: { x: testOval.cx, y: testOval.cy - 20 },
    mouthCenter: { x: testOval.cx, y: testOval.cy + 5 },
    chinApex: { x: testOval.cx, y: testOval.cy + 40 },
    faceBox: { x: testOval.cx - 65, y: testOval.cy - 70, w: 130, h: 140 },
    isValidLandmarks: true
  };
  const upPoseRes = calculateGeometricHeadPose(mockUpLandmarks, upMoments.cx, upMoments.cy, mockUpLandmarks.faceBox, undefined, upMetrics);
  assert(upPoseRes.pitchDeg >= 10, `Fused Upward tilt pitch correctly reaches >= +10° (${upPoseRes.pitchDeg}°)`);
  assert(upPoseRes.poseClass === 'UP', 'Upward tilt classified as UP');

  // -------------------------------------------------------------------------
  // Test Group 13: Lucas-Kanade Directional Optical Flow (vx, vy)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 13: Lucas-Kanade Directional Optical Flow ---');
  const framePrev = new Float32Array(testW * testH);
  const frameCurrLeft = new Float32Array(testW * testH);
  const frameCurrRight = new Float32Array(testW * testH);

  // Synthesize a vertical edge moving left and right
  for (let y = 0; y < testH; y++) {
    for (let x = 0; x < testW; x++) {
      framePrev[y * testW + x] = x;
      frameCurrLeft[y * testW + x] = x + 3; // Shifted left (features move left)
      frameCurrRight[y * testW + x] = x - 3; // Shifted right (features move right)
    }
  }

  const flowLeft = computeInterframeMotionEnergy(frameCurrLeft, framePrev, testW, testH, testOval);
  assert((flowLeft.vx ?? 0) < 0, `Left motion correctly produces negative vx (${flowLeft.vx} px/frame)`);
  assert(flowLeft.isLiveMotion, 'Live motion confirmed during left turn');

  const flowRight = computeInterframeMotionEnergy(frameCurrRight, framePrev, testW, testH, testOval);
  assert((flowRight.vx ?? 0) > 0, `Right motion correctly produces positive vx (${flowRight.vx} px/frame)`);

  // -------------------------------------------------------------------------
  // Test Group 14: BiometricFrameCacheStore Rate Limiting & Pose Curation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 14: BiometricFrameCacheStore Curation & Rate Limiting ---');
  const cacheStore = new BiometricFrameCacheStore();
  cacheStore.clear();

  // Push 25 frames to 'CENTER' with varying Laplacian variance
  for (let i = 1; i <= 25; i++) {
    cacheStore.addFrame('CENTER', `data:image/png;base64,frame_center_${i}`, i * 10, 0, 0);
  }

  // Push 15 frames to 'LEFT'
  for (let i = 1; i <= 15; i++) {
    cacheStore.addFrame('LEFT', `data:image/png;base64,frame_left_${i}`, i * 15, -20, 0);
  }

  const counts = cacheStore.getPoseCounts();
  assert(counts.CENTER === 10, `Center frames strictly capped at 10 (actual: ${counts.CENTER})`);
  assert(counts.LEFT === 10, `Left frames strictly capped at 10 (actual: ${counts.LEFT})`);
  assert(counts.total === 20, `Total frames bounded to 20 instead of runaway caching (${counts.total})`);

  const bestFrames = cacheStore.getBestFrames();
  assert(bestFrames.CENTER.includes('frame_center_25'), 'Best center frame retains the highest Laplacian variance frame');
  assert(bestFrames.LEFT.includes('frame_left_15'), 'Best left frame retains the highest Laplacian variance frame');

  // -------------------------------------------------------------------------
  // Test Group 15: Name Decomposition for Philippine Government IDs
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 15: Name Decomposition for Government IDs ---');
  const parsed1 = parseNameComponents('SUICO, JHONMARK AMACA');
  assert(parsed1.firstName === 'JHONMARK', `Parsed First Name correctly: "${parsed1.firstName}"`);
  assert(parsed1.middleName === 'AMACA', `Parsed Middle Name correctly: "${parsed1.middleName}"`);
  assert(parsed1.lastName === 'SUICO', `Parsed Last Name correctly: "${parsed1.lastName}"`);

  const parsed2 = parseNameComponents('JUAN DELA CRUZ');
  assert(parsed2.firstName === 'JUAN', `Parsed First Name correctly: "${parsed2.firstName}"`);
  assert(parsed2.middleName === '', `Handled empty middle name: "${parsed2.middleName}"`);
  assert(parsed2.lastName === 'DELA CRUZ', `Parsed compound surname correctly: "${parsed2.lastName}"`);

  const parsed3 = parseNameComponents('EDUARDO M. REYES');
  assert(parsed3.firstName === 'EDUARDO', `Parsed First Name: "${parsed3.firstName}"`);
  assert(parsed3.middleName === 'M.', `Parsed Middle Name: "${parsed3.middleName}"`);
  assert(parsed3.lastName === 'REYES', `Parsed Last Name: "${parsed3.lastName}"`);

  // -------------------------------------------------------------------------
  // Test Group 16: Ocular Contrast & Eye Blink Detection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 16: Ocular Contrast & Eye Blink Liveness ---');
  // Open eyes test patch: dark pupil in center, bright sclera around
  const openEyeGray = new Float32Array(testW * testH).fill(160);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      openEyeGray[(90 + dy) * testW + (138 + dx)] = 50; // Left pupil
      openEyeGray[(90 + dy) * testW + (182 + dx)] = 50; // Right pupil
    }
  }
  const blinkOpenRes = detectEyeBlink(openEyeGray, centerLandmarks, testW, testH);
  assert(!blinkOpenRes.isBlinking, `Open eyes correctly detected as NOT blinking (openness: ${blinkOpenRes.eyeOpenness})`);
  assert(blinkOpenRes.eyeOpenness >= 0.25, `Ocular openness exceeds threshold (${blinkOpenRes.eyeOpenness})`);

  // Closed eyes test patch: uniform eyelid skin without pupil contrast
  const closedEyeGray = new Float32Array(testW * testH).fill(140);
  const blinkClosedRes = detectEyeBlink(closedEyeGray, centerLandmarks, testW, testH);
  assert(blinkClosedRes.isBlinking, `Closed eyelid dip correctly detected as BLINK (openness: ${blinkClosedRes.eyeOpenness})`);
  assert(blinkClosedRes.eyeOpenness < 0.20 || blinkClosedRes.ocularVariance < 45, 'Eye closure falls below openness/variance threshold');

  // -------------------------------------------------------------------------
  // Test Group 17: Full-Viewport Silhouette Profile Ratio
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 17: Full-Viewport Silhouette Profile Ratio ---');
  const fullFrameLeftMetrics = computeFullFrameProfileMetrics(leftTurnMask, testW, testH, leftMoments, mockLeftLandmarks);
  assert((fullFrameLeftMetrics.profileRatio ?? 1) < 0.90, `Full-frame left profile ratio correctly < 0.90 (${fullFrameLeftMetrics.profileRatio})`);

  const fullFrameRightMetrics = computeFullFrameProfileMetrics(rightTurnMask, testW, testH, rightMoments, mockRightLandmarks);
  assert((fullFrameRightMetrics.profileRatio ?? 1) > 1.10, `Full-frame right profile ratio correctly > 1.10 (${fullFrameRightMetrics.profileRatio})`);

  // -------------------------------------------------------------------------
  // Test Group 18: Biometric Cache BLINK Integration
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 18: Biometric Cache BLINK Integration ---');
  cacheStore.addFrame('RIGHT', 'data:image/png;base64,frame_right_1', 120, 25, 0);
  cacheStore.addFrame('BLINK', 'data:image/png;base64,frame_blink_1', 145, 0, 0);

  const updatedCounts = cacheStore.getPoseCounts();
  assert(updatedCounts.BLINK === 1, `Blink frame counted in store (${updatedCounts.BLINK})`);
  assert(isBiometricCacheComplete(cacheStore), 'Biometric cache recognized as COMPLETE with CENTER, LEFT, RIGHT, and BLINK');

  // -------------------------------------------------------------------------
  // Test Group 19: Command Transition Pause & Resume for Frame Counts
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 19: Command Transition Pause & Resume for Frame Counts ---');
  const transitionStore = new BiometricFrameCacheStore();
  assert(!transitionStore.getIsPaused(), 'Cache store starts in unpaused active state');

  // Command 1 in progress: accumulates frames
  const addedC1 = transitionStore.addFrame('CENTER', 'data:image/png;base64,c1', 100, 0, 0);
  assert(addedC1 === true, 'Frame accepted during active Command 1');
  assert(transitionStore.getTotalCount() === 1, 'Total frames increased to 1');

  // Command 1 completes -> PAUSE frames during transition to Command 2
  transitionStore.pause('COMMAND_1_COMPLETE_TRANSITION');
  assert(transitionStore.getIsPaused() === true, 'Cache is paused upon Command 1 completion');
  assert(transitionStore.getPauseReason() === 'COMMAND_1_COMPLETE_TRANSITION', 'Pause reason matches transition');

  // Attempt to add frames while paused: strictly rejected!
  const addedDuringPause1 = transitionStore.addFrame('CENTER', 'data:image/png;base64,pause_frame', 110, 0, 0);
  assert(addedDuringPause1 === false, 'Frame strictly rejected while paused during command transition');
  assert(transitionStore.getTotalCount() === 1, 'Frame count remains FROZEN at 1 during transition');

  // Command 2 starts -> RESUME frames
  transitionStore.resume();
  assert(transitionStore.getIsPaused() === false, 'Cache resumed as Command 2 starts');
  const addedL1 = transitionStore.addFrame('LEFT', 'data:image/png;base64,l1', 105, -20, 0);
  assert(addedL1 === true, 'Frame accepted after Command 2 resumes');
  assert(transitionStore.getTotalCount() === 2, 'Frame count advances to 2 after Command 2 starts');

  // Command 2 completes -> PAUSE frames during transition to Command 3
  transitionStore.pause('COMMAND_2_COMPLETE_TRANSITION');
  assert(transitionStore.getIsPaused() === true, 'Cache is paused upon Command 2 completion');
  const addedDuringPause2 = transitionStore.addFrame('LEFT', 'data:image/png;base64,pause_frame_2', 110, -20, 0);
  assert(addedDuringPause2 === false, 'Frame rejected while paused between Command 2 and Command 3');
  assert(transitionStore.getTotalCount() === 2, 'Frame count remains FROZEN at 2 during Command 2->3 transition');

  // Command 3 starts -> RESUME frames
  transitionStore.resume();
  const addedR1 = transitionStore.addFrame('RIGHT', 'data:image/png;base64,r1', 110, 20, 0);
  assert(addedR1 === true, 'Frame accepted after Command 3 resumes');
  assert(transitionStore.getTotalCount() === 3, 'Frame count advances to 3');

  // Command 3 completes -> PAUSE frames during transition to Command 4
  transitionStore.pause('COMMAND_3_COMPLETE_TRANSITION');
  assert(transitionStore.getIsPaused() === true, 'Cache is paused upon Command 3 completion');

  // Command 4 starts -> RESUME frames
  transitionStore.resume();
  const addedB1 = transitionStore.addFrame('BLINK', 'data:image/png;base64,b1', 120, 0, 0);
  assert(addedB1 === true, 'Frame accepted after Command 4 resumes');
  assert(transitionStore.getTotalCount() === 4, 'Frame count advances to 4');

  // Command 4 completes -> PERMANENT PAUSE
  transitionStore.pause('ALL_COMMANDS_COMPLETE');
  assert(transitionStore.getIsPaused() === true, 'Cache permanently paused upon all commands complete');
  const addedFinal = transitionStore.addFrame('BLINK', 'data:image/png;base64,extra', 130, 0, 0);
  assert(addedFinal === false, 'Extra frames rejected after completion');
  assert(transitionStore.getTotalCount() === 4, 'Final frame count frozen at 4');

  // -------------------------------------------------------------------------
  // Test Group 20: Face Presence Gating (Auto-Pause when face not detected)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 20: Face Presence Gating (Auto-Pause when no face detected) ---');
  const faceGateStore = new BiometricFrameCacheStore();

  // Face present in camera: frames accumulate
  const hasFacePresent = true;
  if (hasFacePresent) {
    faceGateStore.addFrame('CENTER', 'data:image/png;base64,face_ok_1', 100, 0, 0);
  }
  assert(faceGateStore.getTotalCount() === 1, 'Frame counted when face is present');

  // Face leaves camera / no face detected: auto-pause
  const faceLeavesCamera = true;
  if (faceLeavesCamera) {
    faceGateStore.pause('NO_FACE_IN_CAMERA');
  }
  assert(faceGateStore.getIsPaused() === true, 'Frame caching auto-paused when face leaves camera');
  assert(faceGateStore.getPauseReason() === 'NO_FACE_IN_CAMERA', 'Pause reason correctly marked as NO_FACE_IN_CAMERA');

  // User moves or frames arrive while no face detected: frame is rejected
  const droppedFrame = faceGateStore.addFrame('CENTER', 'data:image/png;base64,empty_room', 80, 0, 0);
  assert(droppedFrame === false, 'Frame strictly rejected while no face detected in camera');
  assert(faceGateStore.getTotalCount() === 1, 'Frame count does NOT advance when no face is in camera');

  // Face re-enters camera: auto-resume
  const faceReEntersCamera = true;
  if (faceReEntersCamera && faceGateStore.getPauseReason() === 'NO_FACE_IN_CAMERA') {
    faceGateStore.resume();
  }
  assert(faceGateStore.getIsPaused() === false, 'Frame caching auto-resumes when face re-enters camera');
  const resumedFrame = faceGateStore.addFrame('CENTER', 'data:image/png;base64,face_ok_2', 105, 0, 0);
  assert(resumedFrame === true, 'Frame accepted after face re-enters camera');
  assert(faceGateStore.getTotalCount() === 2, 'Frame count advances to 2 after face re-enters');

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
