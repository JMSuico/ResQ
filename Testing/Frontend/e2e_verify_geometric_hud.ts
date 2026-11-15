import { chromium, Browser } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/provu/.gemini/antigravity-cli/brain/f4db8cc5-1635-43fd-94bb-ed301c4741f1';

const runE2eGeometricHudTest = async (): Promise<void> => {
  console.log('--- Starting Chrome E2E Live Verification for Phase 3 Facial Record & Biometric HUD ---');
  let browser: Browser | undefined;
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
    // 1. Navigate directly to Phase 3 Facial Record (?step=2 -> #phase-3-facial-record)
    console.log('Navigating to http://127.0.0.1:1998/register?step=2 ...');
    await page.goto('http://127.0.0.1:1998/register?step=2', { waitUntil: 'networkidle' });
    await page.locator('#phase-3-facial-record').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(800);

    // Save initial load screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_standby.png') });
    console.log('[PASS] Phase 3 Facial Record (#phase-3-facial-record) loaded.');

    // 2. Verify Biometric Engine viewport & SVG oval guide are visible
    const requestCameraBtn = page.locator('#btn-request-camera');
    await requestCameraBtn.waitFor({ state: 'visible', timeout: 8000 });
    const simulateBtn = page.locator('#btn-simulate-4pose-capture');
    await simulateBtn.waitFor({ state: 'visible', timeout: 8000 });
    const ovalGuideCount = await page.locator('#phase-3-facial-record svg ellipse').count();
    if (ovalGuideCount < 1) {
      throw new Error('Expected SVG oval face guide inside #phase-3-facial-record');
    }
    console.log('[PASS] Biometric Engine camera viewport & single oval HUD guide are visible.');

    // 3. Trigger synthetic 4-pose biometric simulation (Center 0 deg, Right +25 deg, Left -25 deg, Blink)
    await simulateBtn.click();
    console.log('Clicked #btn-simulate-4pose-capture (4-Pose Simulation).');
    await page.waitForSelector('text=4 of 4 Poses Qualified', { timeout: 15000 });
    console.log('[PASS] All 4 geometric pose stages qualified (Center, Right, Left, Blink).');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'geometric_hud_pose_qualified.png') });

    // 4. Accept RA 10173 biometric consent & confirm 4-pose facial record
    const consentCheckbox = page.locator('#chk-facial-consent');
    await consentCheckbox.check();
    const confirmFacialBtn = page.locator('#btn-confirm-facial-capture');
    await confirmFacialBtn.waitFor({ state: 'visible', timeout: 8000 });
    await confirmFacialBtn.click();

    await page.locator('#badge-facial-confirmed').waitFor({ state: 'visible', timeout: 15000 });
    console.log('[PASS] 4-Pose Facial Record confirmed (#badge-facial-confirmed).');

    const phase3NextEnabled = await page.locator('#btn-phase3-next').isEnabled();
    if (!phase3NextEnabled) {
      throw new Error('Expected #btn-phase3-next to become enabled after confirming 4-Pose Facial Record');
    }
    console.log('[PASS] #btn-phase3-next unlocked for Phase 4 credentials.');
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
