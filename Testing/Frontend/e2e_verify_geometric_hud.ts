import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/provu/.gemini/antigravity-cli/brain/f4db8cc5-1635-43fd-94bb-ed301c4741f1';

const runE2eGeometricHudTest = async () => {
  console.log('--- Starting Chrome E2E Live Verification for Geometric Facial Pattern HUD ---');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  try {
    // 1. Navigate directly to Biometrics Step 2
    console.log('Navigating to http://localhost:5173/register?step=2 ...');
    await page.goto('http://localhost:5173/register?step=2', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Save initial load screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_standby.png') });
    console.log('[PASS] Biometrics Step 2 loaded.');

    // Verify Biometric Engine viewport is visible
    const scanBtn = page.locator('button:has-text("START BIOMETRIC SCAN")');
    await scanBtn.waitFor({ state: 'visible', timeout: 8000 });
    console.log('[PASS] Biometric Engine viewport is visible.');

    // 3. Start Biometric Scan
    await scanBtn.click();
    console.log('Clicked START BIOMETRIC SCAN.');
    await page.waitForTimeout(1000);

    // Step A: Distance Check -> Pose 1 Center
    console.log('Awaiting POSE 1: CENTER (0°)...');
    await page.waitForSelector('text=Face Forward (Frontal View)', { timeout: 12000 });
    console.log('[PASS] Detected Geometric Blueprint HUD: Face Forward (Frontal View)!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_pose1_front.png') });

    // Await POSE 2: LEFT PROFILE
    console.log('Awaiting POSE 2: LEFT PROFILE (~90° / -25°)...');
    await page.waitForSelector('text=Face Left (Left Profile View)', { timeout: 15000 });
    console.log('[PASS] Detected Geometric Blueprint HUD: Face Left (Left Profile View)!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_pose2_left.png') });

    // Await POSE 3: RIGHT PROFILE
    console.log('Awaiting POSE 3: RIGHT PROFILE (~90° / +25°)...');
    await page.waitForSelector('text=Face Right (Right Profile View)', { timeout: 15000 });
    console.log('[PASS] Detected Geometric Blueprint HUD: Face Right (Right Profile View)!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_pose3_right.png') });

    // Await POSE 4: EYE BLINK LIVENESS
    console.log('Awaiting POSE 4: EYE BLINK LIVENESS [BLINK]...');
    await page.waitForSelector('text=Blink (Eye Closure View)', { timeout: 15000 });
    console.log('[PASS] Detected Geometric Blueprint HUD: Blink (Eye Closure View)!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_pose4_blink.png') });

    // Await final Verified Certificate
    console.log('Awaiting Multi-Angle Biometric Certificate & Verification badge...');
    await page.waitForSelector('text=BIOMETRIC PROOF VERIFIED [99.8%]', { timeout: 20000 });
    console.log('[PASS] Final Composite Biometric Certificate generated & certified!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_composite_verified.png') });

    console.log('================================================================');
    console.log('ALL CHROME DEV E2E GEOMETRIC PATTERN HUD TESTS PASSED (100%)');
    console.log('================================================================');
  } catch (err) {
    console.error('[E2E FAIL]:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_failure_state.png') });
    throw err;
  } finally {
    await browser.close();
  }
};

runE2eGeometricHudTest();
