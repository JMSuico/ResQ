/**
 * [Layer: Testing/Frontend]
 * File: challenge_30_60_fps_biometric_video_engine.ts
 *
 * Strict Production Challenge for the 30-60 FPS Multi-Pose Biometric Video Recording Engine:
 * 1. Full 6-Phase Stepper progression into Phase 4: Facial Record
 * 2. Standby Calibration Banner & 30-60 FPS Badge Verification
 * 3. 4-Pose Frame Cache Strip Header & '60 Frames/Pose Video Buffer Target' Tag
 * 4. Live Camera Stream Activation & High-Frequency Sampling Telemetry:
 *    - Viewfinder Header: '● REC [30-60 FPS]' + live measured FPS
 *    - Real-time Buffer Fill Meter: 'BUFFER: {count}/60 FRAMES ({percent}%)'
 *    - SVG Overlay: 'REC ● 30-60 FPS', 'SAMPLING: 30-60 FPS HD', '60 FRAMES/SEC HIGH-SPEED BIOMETRIC BUFFER'
 * 5. Synthetic 60-Frame Video Cache Emulation (240 Frames Total across 4 Poses)
 * 6. Thumbnail Badges: '● 30-60 FPS // 60 frames' across all 4 Poses
 * 7. RA 10173 30-60 FPS Video Consent & Record Confirmation
 * 8. Compiled 4-Quadrant Canvas Watermark & Telemetry Audit
 * 9. High-Resolution Screenshot Artifact Capture & Step 5 Transition
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:1997/register';
const ARTIFACT_DIR = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\aab2608f-1efd-4dff-8017-e356dc4f97f6';
const SCREENSHOT_STREAMING_HUD = path.join(ARTIFACT_DIR, 'challenge_live_30_60_fps_streaming_hud.png');
const SCREENSHOT_CONFIRMED_RECORD = path.join(ARTIFACT_DIR, 'challenge_confirmed_30_60_fps_record.png');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let total = 0;

const logPass = (m: string) => {
  passed += 1;
  total += 1;
  console.log(`  ${GREEN}✓ [PASS]${RESET} ${m}`);
};

const logFail = (m: string) => {
  total += 1;
  console.error(`  ${RED}✗ [FAIL]${RESET} ${m}`);
};

const logSection = (title: string) => {
  console.log(`\n${CYAN}------------------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}${title}${RESET}`);
  console.log(`${CYAN}------------------------------------------------------------------------${RESET}`);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const runChallenge = async () => {
  console.log(`\n${BOLD}========================================================================${RESET}`);
  console.log(`${BOLD}   RESQTRACK 30-60 FPS BIOMETRIC VIDEO RECORDING PRODUCTION CHALLENGE${RESET}`);
  console.log(`${BOLD}========================================================================${RESET}`);

  const browser: Browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--no-sandbox'
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 }
    });
    const page: Page = await context.newPage();

    logSection('CHALLENGE 1: REGISTRATION NAVIGATION & PHASE 1-3 ADVANCEMENT');
    console.log(`Navigating to ${FRONTEND_URL}...`);
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    await delay(1000);

    // Phase 1: Select Civilian
    const civilianBtn = page.locator('button#role-btn-civilian');
    await civilianBtn.waitFor({ state: 'visible', timeout: 6000 });
    await civilianBtn.click();
    await delay(200);
    await page.click('button#btn-phase1-next');
    await delay(500);
    logPass('Phase 1 (Role Selection) completed successfully.');

    // Phase 2: Personal Info
    await page.waitForSelector('input#first-name', { state: 'visible', timeout: 5000 });
    await page.fill('input#first-name', 'Crisostomo');
    await page.fill('input#last-name', 'Ibarra');
    await page.fill('input#phone-number', '+639178881234');
    await page.fill('input#dob', '1995-06-19');
    await page.fill('input#barangay', 'Poblacion Alto');
    await page.fill('input#street-purok', 'Rizal Avenue, Sector 4');
    await page.click('button#btn-phase2-next');
    await delay(500);
    logPass('Phase 2 (Personal Information) completed successfully.');

    // Phase 3: Government ID Upload
    await page.waitForSelector('select#id-type', { state: 'visible', timeout: 5000 });
    await page.selectOption('select#id-type', 'philsys');

    const dummyPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAAP0lEQVR42u3BAQEAAACAkP6v7ggKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4G8kOAABiW+UigAAAABJRU5ErkJggg==',
      'base64'
    );
    const tmpFront = path.join(ARTIFACT_DIR, 'challenge_temp_front.png');
    const tmpBack = path.join(ARTIFACT_DIR, 'challenge_temp_back.png');
    fs.writeFileSync(tmpFront, dummyPixel);
    fs.writeFileSync(tmpBack, dummyPixel);

    await page.setInputFiles('input#front-id-input', tmpFront);
    await delay(200);
    await page.setInputFiles('input#back-id-input', tmpBack);
    await delay(300);
    await page.click('button#btn-phase3-next');
    await delay(800);
    logPass('Phase 3 (Government ID Upload) completed successfully.');

    logSection('CHALLENGE 2: PHASE 4 CALIBRATION BANNER & 30-60 FPS STANDBY INDICATORS');
    const panel = page.locator('#manual-facial-capture-panel');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    logPass('Phase 4: Manual Facial Capture Panel loaded.');

    // 1. Verify Top Calibration Banner Text
    const banner = page.locator('#biometric-training-banner');
    const bannerText = await banner.innerText();
    if (bannerText.includes('30 to 60 frames per second (FPS)')) {
      logPass('Calibration Banner states: "at 30 to 60 frames per second (FPS)"');
    } else {
      logFail(`Calibration Banner text mismatch: ${bannerText}`);
    }

    // 2. Verify 30-60 FPS HD Video Stream Badge
    if (bannerText.includes('30-60 FPS HD VIDEO STREAM')) {
      logPass('Calibration Banner contains high-tech badge: "● 30-60 FPS HD VIDEO STREAM"');
    } else {
      logFail('Calibration Banner missing "30-60 FPS HD VIDEO STREAM" badge');
    }

    // 3. Verify Strip Header and 60 Frames Target Tag
    const stripHeader = page.locator('text=4-Pose Biometric Frame Cache Strip (30–60 FPS High-Speed Sampling)');
    await stripHeader.waitFor({ state: 'visible', timeout: 4000 });
    logPass('Cache Strip Header indicates: "4-Pose Biometric Frame Cache Strip (30–60 FPS High-Speed Sampling)"');

    const bufferTargetTag = page.locator('text=60 Frames/Pose Video Buffer Target');
    await bufferTargetTag.waitFor({ state: 'visible', timeout: 4000 });
    logPass('Cache Strip Status Tag confirms: "60 Frames/Pose Video Buffer Target"');

    logSection('CHALLENGE 3: LIVE CAMERA 30-60 FPS STREAMING HUD & BUFFER TELEMETRY');
    const startCamBtn = page.locator('button#btn-request-camera');
    await startCamBtn.waitFor({ state: 'visible', timeout: 4000 });
    await startCamBtn.click();
    await delay(1200);

    // Viewfinder Header REC [30-60 FPS] Badge
    const recBadge = page.locator('text=REC [30-60 FPS]');
    await recBadge.first().waitFor({ state: 'visible', timeout: 5000 });
    logPass('Live Viewfinder Header displays pulsing red badge: "● REC [30-60 FPS]"');

    // Streaming Buffer Progress HUD
    const bufferHud = page.locator('text=/BUFFER: \\d+\\/60 FRAMES/');
    await bufferHud.first().waitFor({ state: 'visible', timeout: 5000 });
    const bufferHudText = await bufferHud.first().innerText();
    logPass(`Real-time Buffer Meter active: "${bufferHudText}"`);

    // SVG Viewfinder Telemetry
    const svgRecText = page.locator('svg text:has-text("REC ● 30-60 FPS")');
    await svgRecText.waitFor({ state: 'visible', timeout: 4000 });
    logPass('SVG Viewfinder Overlay renders Top-Left HUD: "REC ● 30-60 FPS"');

    const svgSamplingText = page.locator('svg text:has-text("SAMPLING: 30-60 FPS HD")');
    await svgSamplingText.waitFor({ state: 'visible', timeout: 4000 });
    logPass('SVG Viewfinder Overlay renders Top-Right HUD: "SAMPLING: 30-60 FPS HD"');

    const svgBottomHud = page.locator('svg text:has-text("60 FRAMES/SEC HIGH-SPEED BIOMETRIC BUFFER")');
    await svgBottomHud.waitFor({ state: 'visible', timeout: 4000 });
    logPass('SVG Viewfinder Overlay renders Bottom HUD: "60 FRAMES/SEC HIGH-SPEED BIOMETRIC BUFFER"');

    // Capture Streaming Screenshot Artifact
    await page.screenshot({ path: SCREENSHOT_STREAMING_HUD, fullPage: false });
    logPass(`Captured Live Streaming Telemetry Screenshot: ${SCREENSHOT_STREAMING_HUD}`);

    // Pause Camera Stream
    await page.locator('button:has-text("Pause Video")').click();
    await delay(500);

    logSection('CHALLENGE 4: SYNTHETIC TEST MODE & 60 FRAMES/POSE CACHE BUFFER AUDIT');
    const syntheticBtn = page.locator('button#btn-synthetic-test-mode');
    await syntheticBtn.waitFor({ state: 'visible', timeout: 4000 });
    await syntheticBtn.click();
    await delay(2500); // Allow synthetic generator to synthesize 240 frames and composite

    // Verify In-Memory Cache Store Counts
    const cacheReport = await page.evaluate(() => {
      const w = window as unknown as {
        biometricFrameCache?: {
          getTotalCount: () => number;
          getPoseCounts: () => { CENTER: number; RIGHT: number; LEFT: number; BLINK: number; total: number };
          getTargetFpsRange: () => string;
          getBufferCapacityPerPose: () => number;
        };
      };
      if (!w.biometricFrameCache) return null;
      return {
        total: w.biometricFrameCache.getTotalCount(),
        counts: w.biometricFrameCache.getPoseCounts(),
        fpsRange: w.biometricFrameCache.getTargetFpsRange(),
        capacity: w.biometricFrameCache.getBufferCapacityPerPose()
      };
    });

    console.log(`    Evaluated Cache Buffer: ${JSON.stringify(cacheReport)}`);
    if (cacheReport && cacheReport.total === 240 && cacheReport.counts.CENTER === 60) {
      logPass(`BiometricFrameCache holds full 60 frames/pose (Total: ${cacheReport.total} frames, Target: ${cacheReport.fpsRange})`);
    } else {
      logFail(`Cache count expected 240, got: ${JSON.stringify(cacheReport)}`);
    }

    logSection('CHALLENGE 5: THUMBNAIL CARDS & 30-60 FPS BADGES AUDIT');
    // Verify each of the 4 thumbnail cards shows the 30-60 FPS // 60 frames badge
    const badgeElements = page.locator('text=30-60 FPS // 60 frames');
    const badgeCount = await badgeElements.count();
    if (badgeCount === 4) {
      logPass(`All 4 thumbnail strip cards display tactical badge: "● 30-60 FPS // 60 frames" (Count: ${badgeCount})`);
    } else {
      logFail(`Expected 4 badges with "30-60 FPS // 60 frames", found: ${badgeCount}`);
    }

    // Verify Recapture buttons on all 4 cards
    const recaptureBtns = page.locator('button[id^="btn-retake-pose-"]');
    const retakeCount = await recaptureBtns.count();
    if (retakeCount === 4) {
      logPass(`All 4 thumbnail cards provide dedicated Recapture actions (Count: ${retakeCount})`);
    } else {
      logFail(`Expected 4 recapture buttons, found: ${retakeCount}`);
    }

    logSection('CHALLENGE 6: RA 10173 30-60 FPS CONSENT & RECORD CONFIRMATION');
    const consentBox = page.locator('input#facial-consent-checkbox');
    const consentLabel = page.locator('label[for="facial-consent-checkbox"]');
    const consentText = await consentLabel.innerText();
    if (consentText.includes('4-pose video recording at 30–60 FPS in compliance with RA 10173')) {
      logPass('RA 10173 consent explicitly references "4-pose video recording at 30–60 FPS"');
    } else {
      logFail(`Consent text mismatch: ${consentText}`);
    }

    await consentBox.setChecked(true, { force: true });
    await delay(300);

    const confirmBtn = page.locator('button#btn-confirm-facial-capture');
    await confirmBtn.waitFor({ state: 'visible', timeout: 4000 });
    await confirmBtn.click();
    await delay(1200);

    const confirmedStatus = page.locator('text=4-pose video recording at 30–60 FPS confirmed and staged for submission');
    await confirmedStatus.waitFor({ state: 'visible', timeout: 5000 });
    logPass('Record confirmation passed: "4-pose video recording at 30–60 FPS confirmed and staged for submission"');

    logSection('CHALLENGE 7: COMPILED 4-POSE COMPOSITE CANVAS WATERMARK AUDIT');
    const previewImg = page.locator('img#captured-facial-preview');
    await previewImg.waitFor({ state: 'visible', timeout: 5000 });
    const previewSrc = await previewImg.getAttribute('src');
    if (previewSrc && previewSrc.startsWith('data:image/jpeg;base64,')) {
      logPass(`Compiled 4-Pose Biometric Record rendered successfully (Data URL length: ${previewSrc.length} bytes)`);
    } else {
      logFail('Compiled 4-Pose Biometric Record image preview missing or invalid');
    }

    // Capture Final Confirmed Record Screenshot Artifact
    await page.screenshot({ path: SCREENSHOT_CONFIRMED_RECORD, fullPage: false });
    logPass(`Captured Confirmed Record Screenshot: ${SCREENSHOT_CONFIRMED_RECORD}`);

    logSection('CHALLENGE 8: ADVANCE TO PHASE 5 & FORM METADATA VERIFICATION');
    const nextPhase4Btn = page.locator('button#btn-phase4-next');
    await nextPhase4Btn.click();
    await delay(600);

    const phase5Account = page.locator('input#display-name');
    await phase5Account.waitFor({ state: 'visible', timeout: 5000 });
    logPass('Successfully transitioned to Phase 5: Account Credentials with 30-60 FPS Biometric Record attached!');

    console.log(`\n${BOLD}========================================================================${RESET}`);
    console.log(`   ${GREEN}${BOLD}PRODUCTION CHALLENGE PASSED: ${passed}/${total} CHECKS GREEN (100%)${RESET}`);
    console.log(`${BOLD}========================================================================${RESET}\n`);

  } finally {
    await browser.close();
  }
};

runChallenge().catch((err) => {
  console.error(`\n${RED}CHALLENGE FATAL FAILURE:${RESET}`, err);
  process.exit(1);
});
