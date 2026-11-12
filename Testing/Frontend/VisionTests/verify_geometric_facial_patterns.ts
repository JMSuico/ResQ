// [Layer: Test/Libs/Vision/idScanner]
// Responsibility: Comprehensive TDD verification suite for Traditional Geometric Pattern Facial Recognition.
// Tests anthropometric bounding boxes, center crosshair lines, keypoints (eyes, nose, chin),
// inverted facial triangles, profile angle sectors (~90°), eyelid calipers (||), and validation checklists
// matching Pictures 1 through 7.
// Strict TypeScript, zero 'any', 100% universal lambdas (=>), zero emojis.

import {
  computeGeometricFrontPose,
  computeGeometricLeftProfilePose,
  computeGeometricRightProfilePose,
  computeGeometricBlinkPose,
  evaluateLiveGeometricPose,
  type GeometricFaceResult
} from '../face/geometricFacePatternEngine';

const assert = (condition: boolean, msg: string): void => {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
};

const VIEWPORT_W = 640;
const VIEWPORT_H = 480;

console.log('\n--- 1. Testing Face Forward (Frontal View) Geometry (Picture 3) ---');
const front: GeometricFaceResult = computeGeometricFrontPose(VIEWPORT_W, VIEWPORT_H);
assert(front.poseType === 'FRONT', 'Front pose returns poseType = FRONT');
assert(front.isValid === true, 'Front pose validation checks all passed');
assert(front.boundingBox.width > 200 && front.boundingBox.height > 250, 'Front bounding box scaled to anthropometric facial dimensions');
assert(front.centerLines.vertical.x === VIEWPORT_W * 0.5, 'Vertical midline accurately bisects viewport center');
assert(front.centerLines.horizontal.y === front.keyPoints.leftEye.y, 'Horizontal eye line aligns with eye height');
assert(front.keyPoints.leftEye.x < front.keyPoints.rightEye.x, 'Left eye positioned to the left of right eye');
assert(front.keyPoints.noseCenter.y > front.keyPoints.leftEye.y, 'Nose positioned below eye line');
assert(front.keyPoints.chinPoint.y > front.keyPoints.noseCenter.y, 'Chin positioned below nose');
assert(front.triangle.area > 5000, `Facial triangle area calculated (${front.triangle.area})`);
assert(front.triangle.isSymmetric === true, 'Facial triangle is symmetric across vertical midline');
assert(front.validationChecks.check1.passed === true, 'Check 1: Face Centered passed');
assert(front.validationChecks.check2.passed === true, 'Check 2: Eyes Level passed');
assert(front.validationChecks.check3.passed === true, 'Check 3: Symmetry passed');
assert(front.validationChecks.check4.passed === true, 'Check 4: Head Pose (0° ± 15°) passed');
assert(front.validationChecks.check5?.passed === true, 'Check 5: Face Clear passed');
assert(front.geometricData.yaw === 0, 'Yaw is 0°');
assert(front.geometricData.pitch === 0, 'Pitch is 0°');
assert(front.geometricData.roll === 0, 'Roll is 0°');
assert(front.geometricData.eyeDistance === 'OK', 'Eye distance is OK');
assert(front.geometricData.faceRatio === 'OK', 'Face ratio is OK');

console.log('\n--- 2. Testing Face Left Profile View Geometry (Picture 5) ---');
const left: GeometricFaceResult = computeGeometricLeftProfilePose(VIEWPORT_W, VIEWPORT_H);
assert(left.poseType === 'LEFT', 'Left profile pose returns poseType = LEFT');
assert(left.isValid === true, 'Left profile validation checks passed');
assert(Boolean(left.profileAngle), 'Profile angle indicator is defined');
assert(left.profileAngle?.angleDegrees === 90, 'Profile angle indicator displays ~90°');
assert(left.profileAngle?.direction === 'LEFT', 'Profile angle indicator points LEFT');
assert(left.profileAngle?.yawGaugeAngle === -90, 'Yaw gauge indicates -90° (Left)');
assert(left.keyPoints.nosePoint!.x < left.keyPoints.visibleEye!.x, 'Nose tip projects anteriorly to the left of the visible eye');
assert(left.validationChecks.check1.passed === true, 'Check 1: Face Turned Left (~ 70° – 110°) passed');
assert(left.validationChecks.check2.passed === true, 'Check 2: Left Eye Visible (>= 60%) passed');
assert(left.validationChecks.check3.passed === true, 'Check 3: Face Clear passed');
assert(left.validationChecks.check4.passed === true, 'Check 4: Proper Framing passed');
assert(left.geometricData.yaw === -90, 'Geometric data yaw is -90°');

console.log('\n--- 3. Testing Face Right Profile View Geometry (Picture 4) ---');
const right: GeometricFaceResult = computeGeometricRightProfilePose(VIEWPORT_W, VIEWPORT_H);
assert(right.poseType === 'RIGHT', 'Right profile pose returns poseType = RIGHT');
assert(right.isValid === true, 'Right profile validation checks passed');
assert(Boolean(right.profileAngle), 'Profile angle indicator is defined');
assert(right.profileAngle?.angleDegrees === 90, 'Profile angle indicator displays ~90°');
assert(right.profileAngle?.direction === 'RIGHT', 'Profile angle indicator points RIGHT');
assert(right.profileAngle?.yawGaugeAngle === 90, 'Yaw gauge indicates +90° (Right)');
assert(right.keyPoints.nosePoint!.x > right.keyPoints.visibleEye!.x, 'Nose tip projects anteriorly to the right of the visible eye');
assert(right.validationChecks.check1.passed === true, 'Check 1: Face Turned Right (~ 70° – 110°) passed');
assert(right.validationChecks.check2.passed === true, 'Check 2: Right Eye Visible (>= 60%) passed');
assert(right.validationChecks.check3.passed === true, 'Check 3: Face Clear passed');
assert(right.validationChecks.check4.passed === true, 'Check 4: Proper Framing passed');
assert(right.geometricData.yaw === 90, 'Geometric data yaw is +90°');

console.log('\n--- 4. Testing Blink (Eye Closure) Geometry (Picture 7) ---');
const blinkClosed: GeometricFaceResult = computeGeometricBlinkPose(VIEWPORT_W, VIEWPORT_H, true);
assert(blinkClosed.poseType === 'BLINK', 'Blink pose returns poseType = BLINK');
assert(blinkClosed.isValid === true, 'Blink closed validation checks passed');
assert(Boolean(blinkClosed.calipers), 'Eyelid calipers are defined');
assert(blinkClosed.calipers?.isClosed === true, 'Calipers indicate eye closure');
assert(blinkClosed.calipers?.left.height === 3, 'Palpebral aperture closed caliper height = 3px');
assert(blinkClosed.validationChecks.check2.passed === true, 'Check 2: Eyes Closed (Blink) passed');
assert(blinkClosed.geometricData.statusText === 'Blink Detected', 'Status text displays "Blink Detected"');

const blinkOpen: GeometricFaceResult = computeGeometricBlinkPose(VIEWPORT_W, VIEWPORT_H, false);
assert(blinkOpen.isValid === false, 'Blink open validation is pending closure');
assert(blinkOpen.calipers?.isClosed === false, 'Calipers indicate eye aperture open');
assert(blinkOpen.validationChecks.check2.passed === false, 'Check 2: Eyes Closed (Blink) = false when eyes open');

console.log('\n--- 5. Testing Dynamic Live Video Pose Evaluation ---');
const liveFront = evaluateLiveGeometricPose(VIEWPORT_W, VIEWPORT_H, 'FRONT', 0.5, -0.2, 0.55);
assert(liveFront.isValid === true, 'Live front within ±12° is valid');

const liveFrontOff = evaluateLiveGeometricPose(VIEWPORT_W, VIEWPORT_H, 'FRONT', 18.5, 0, 0.55);
assert(liveFrontOff.isValid === false, 'Live front rotated beyond 12° is flagged invalid');

const liveLeft = evaluateLiveGeometricPose(VIEWPORT_W, VIEWPORT_H, 'LEFT', -24.0, 0, 0.55);
assert(liveLeft.isValid === true, 'Live left turned <= -14° is valid');

const liveRight = evaluateLiveGeometricPose(VIEWPORT_W, VIEWPORT_H, 'RIGHT', 24.0, 0, 0.55);
assert(liveRight.isValid === true, 'Live right turned >= 14° is valid');

const liveBlink = evaluateLiveGeometricPose(VIEWPORT_W, VIEWPORT_H, 'BLINK', 0, 0, 0.18);
assert(liveBlink.isValid === true, 'Live blink with eye openness 0.18 triggers valid eye closure');

console.log('\n================================================================');
console.log('ALL GEOMETRIC PATTERN FACIAL RECOGNITION TESTS PASSED (100%)');
console.log('================================================================\n');
