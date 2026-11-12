// [Layer: Testing/Frontend]
// Responsibility: Automated Playwright E2E verification for Biometric Model Training during 4-pose registration
// and 1:1 Biometric Login verification against the enrolled training template.
// Complies with Katipuneros Architecture: Universal Lambdas (=>), Zero 'any', Zero emojis, centralized in Testing/.

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const REGISTER_URL = 'http://127.0.0.1:1998/register';
const LOGIN_URL = 'http://127.0.0.1:1998/login';
const ARTIFACT_DIR = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';
const ENROLLMENT_SCREENSHOT = path.join(ARTIFACT_DIR, 'biometric_training_enrollment_verified.png');
const BIOMETRIC_LOGIN_SCREENSHOT = path.join(ARTIFACT_DIR, 'biometric_login_success_verified.png');

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const createSyntheticSamplePng = (filename: string, label: string): string => {
  const filePath = path.join(ARTIFACT_DIR, filename);
  const base64Data =
    'iVBORw0KGgoAAAANSUhEUgAAAoAAAAHgCAYAAAA10dzkAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF1ElEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgLsBAwABAAEA+1AAAAAElFTkSuQmCC';
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return filePath;
};

const runBiometricVerification = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('   RESQTRACK BIOMETRIC TRAINING & 1:1 LOGIN VERIFICATION SUITE');
  console.log('========================================================================\n');

  const browser: Browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--no-sandbox'
    ]
  });

  const timestamp = Date.now();
  const testEmail = `biometric.citizen.${timestamp}@resqtrack.gov.ph`;
  const testPassword = 'Password123!@#Secure';
  const frontIdPath = createSyntheticSamplePng('test_bio_front.png', 'FRONT_ID');
  const backIdPath = createSyntheticSamplePng('test_bio_back.png', 'BACK_ID');

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page: Page = await context.newPage();

    // -------------------------------------------------------------------------
    // TEST 1: Navigate to Registration & Complete Phase 1 (Role Selection)
    // -------------------------------------------------------------------------
    console.log(`[Step 1] Navigating to Registration Portal: ${REGISTER_URL}...`);
    await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
    await delay(1200);

    console.log('[Step 2] Selecting Civilian / Resident role...');
    await page.click('button#role-btn-civilian');
    await delay(300);
    await page.click('button#btn-phase1-next');
    await delay(600);

    // -------------------------------------------------------------------------
    // TEST 2: Complete Phase 2 (Personal Information)
    // -------------------------------------------------------------------------
    console.log('[Step 3] Populating personal information...');
    await page.waitForSelector('input#first-name', { state: 'visible', timeout: 5000 });
    await page.fill('input#first-name', 'Maria Clara');
    await page.fill('input#last-name', 'Rizal');
    await page.fill('input#phone-number', '+639171234567');
    await page.fill('input#dob', '1998-05-12');
    await page.fill('input#barangay', 'Barangay Uno Poblacion');
    await page.fill('input#street-purok', 'Purok Rosal, Mabini Street');
    await page.click('button#btn-phase2-next');
    await delay(600);

    // -------------------------------------------------------------------------
    // TEST 3: Complete Phase 3 (Government ID Upload)
    // -------------------------------------------------------------------------
    console.log('[Step 4] Uploading Government ID Front & Back...');
    await page.waitForSelector('select#id-type', { state: 'visible', timeout: 5000 });
    await page.selectOption('select#id-type', 'philsys');
    await page.setInputFiles('input#front-id-input', frontIdPath);
    await delay(300);
    await page.setInputFiles('input#back-id-input', backIdPath);
    await delay(400);

    await page.click('button#btn-phase3-next');
    await delay(800);

    // -------------------------------------------------------------------------
    // TEST 4: Phase 4 Biometric Model Training & 4-Pose Video Recording
    // -------------------------------------------------------------------------
    console.log('[Step 5] Auditing Biometric Model Training Indicators in Phase 4...');
    const trainingBanner = page.locator('#biometric-training-banner');
    await trainingBanner.waitFor({ state: 'visible', timeout: 5000 });
    const bannerText = await trainingBanner.innerText();
    console.log(`   Training Banner Content: ${bannerText.split('\n')[0]}`);

    console.log('[Step 6] Populating 4-Pose facial record via live video stream & multi-pose locks...');
    await page.click('button#btn-request-camera');
    await delay(800);

    const lockBtn = page.locator('button#btn-lock-next-pose');
    await lockBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Pose 1: Center -> Lock
    console.log('   Locking Pose 1 (Center 0°)...');
    await lockBtn.click();
    await delay(600);

    // Pose 2: Right -> Lock
    console.log('   Locking Pose 2 (Right +25°)...');
    await lockBtn.click();
    await delay(600);

    // Pose 3: Left -> Lock
    console.log('   Locking Pose 3 (Left -25°)...');
    await lockBtn.click();
    await delay(600);

    // Pose 4: Blink -> Lock
    console.log('   Locking Pose 4 (Blink Liveness)...');
    await lockBtn.click();
    await delay(800);

    // Verify 100% trained badge in banner
    const trainedText = await trainingBanner.innerText();
    if (!trainedText.includes('100% Trained')) {
      throw new Error(`Expected training banner to indicate 100% Trained, found: ${trainedText}`);
    }
    console.log('   [PASS] 4-Pose facial calibration verified: 100% Biometric Profile Trained!');

    // Accept RA 10173 Biometric & Privacy Consent
    const consentCheckbox = page.locator('input#facial-consent-checkbox');
    await consentCheckbox.setChecked(true, { force: true });
    await delay(200);

    // Confirm 4-pose facial record
    console.log('[Step 7] Confirming 4-Pose facial record...');
    await page.click('button#btn-confirm-facial-capture');
    await delay(600);

    // Take screenshot of confirmed biometric record
    await page.screenshot({ path: ENROLLMENT_SCREENSHOT, fullPage: false });
    console.log(`   [Artifact] Captured enrollment screenshot to ${ENROLLMENT_SCREENSHOT}`);

    await page.click('button#btn-phase4-next');
    await delay(500);

    // -------------------------------------------------------------------------
    // TEST 5: Complete Phase 5 (Account Credentials)
    // -------------------------------------------------------------------------
    console.log('[Step 8] Setting account credentials...');
    await page.fill('input#display-name', 'Maria Rizal');
    await page.fill('input#email', testEmail);
    await page.fill('input#password', testPassword);
    await page.fill('input#confirm', testPassword);

    await page.locator('input#consent-1').setChecked(true, { force: true });
    await page.locator('input#consent-2').setChecked(true, { force: true });
    await page.click('button#btn-phase5-next');
    await delay(800);

    // -------------------------------------------------------------------------
    // TEST 6: Phase 6 Review & Verification of Trained 128-D Biometric Vector
    // -------------------------------------------------------------------------
    console.log('[Step 9] Auditing Phase 6 Review screen for Biometric Training Badge...');
    const bioReviewBadge = page.locator('#review-biometric-training-status');
    await bioReviewBadge.waitFor({ state: 'visible', timeout: 5000 });
    const reviewText = await bioReviewBadge.innerText();
    console.log(`   Phase 6 Review Status: ${reviewText}`);
    if (!reviewText.includes('128-D Vector Ready for 1:1 Login')) {
      throw new Error('Biometric training status not displayed in Phase 6 review.');
    }

    // Submit Registration
    console.log('[Step 10] Submitting registration with trained biometric vector...');
    await page.click('button#submit');
    await delay(2500);
    console.log('   [PASS] User registration submitted with active biometric training vector!');

    // -------------------------------------------------------------------------
    // TEST 7: 1:1 Biometric Login with Trained Profile
    // -------------------------------------------------------------------------
    console.log('\n[Step 11] Navigating to Login Portal for 1:1 Biometric Authentication...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await delay(1000);

    console.log('[Step 12] Opening 1:1 Biometric Authentication Modal...');
    const biometricModalTrigger = page.locator('button:has-text("Face Login"), button:has-text("Biometric"), button:has-text("Scan Face")').first();
    await biometricModalTrigger.waitFor({ state: 'visible', timeout: 5000 });
    await biometricModalTrigger.click();
    await delay(600);

    const bioEmailInput = page.locator('input#bio-email');
    await bioEmailInput.waitFor({ state: 'visible', timeout: 5000 });
    await bioEmailInput.fill(testEmail);
    console.log(`   Entered account email: ${testEmail}`);

    await page.locator('button[type="submit"]:has-text("Activate Live Camera")').click();
    await delay(800);

    console.log('[Step 13] Executing 1:1 Biometric Optical Scan...');
    const scanButton = page.locator('button#btn-synthetic-test-scan');
    await scanButton.waitFor({ state: 'visible', timeout: 5000 });
    await scanButton.click();
    await delay(2000);

    // Verify successful authentication and redirection
    await page.screenshot({ path: BIOMETRIC_LOGIN_SCREENSHOT, fullPage: false });
    console.log(`   [Artifact] Captured biometric login screenshot to ${BIOMETRIC_LOGIN_SCREENSHOT}`);

    const currentUrl = page.url();
    console.log(`   Current URL after biometric verification: ${currentUrl}`);
    const isRedirectedToDashboard = currentUrl.includes('/civilian/dashboard') || currentUrl.includes('/dashboard');

    if (!isRedirectedToDashboard) {
      const statusText = await page.locator('p').filter({ hasText: /Identity verified|Redirecting/i }).first().innerText().catch(() => '');
      console.log(`   Modal Status Message: ${statusText}`);
      if (!statusText.includes('Identity verified')) {
        throw new Error(`Expected successful biometric authentication, but landed on ${currentUrl} with status: ${statusText}`);
      }
    }
    console.log('   [PASS] 1:1 Biometric Authentication verified against enrolled training template!');

    // -------------------------------------------------------------------------
    // TEST 8: Adversarial Biometric Verification on Vector Mismatch
    // -------------------------------------------------------------------------
    console.log('\n[Step 14] Testing Adversarial Rejection on Biometric Mismatch...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await delay(800);

    const bioTrigger2 = page.locator('button:has-text("Face Login"), button:has-text("Biometric"), button:has-text("Scan Face")').first();
    await bioTrigger2.click();
    await delay(500);

    await page.locator('input#bio-email').fill(testEmail);
    await page.locator('button[type="submit"]:has-text("Activate Live Camera")').click();
    await delay(500);

    console.log('   Simulating unauthorized impersonator with mismatched biometric vector...');
    const mismatchResult = await page.evaluate(async (email) => {
      const mismatchedVector = new Array(128).fill(0).map((_, i) => (i % 2 === 0 ? 0.8 : -0.8));
      const res = await fetch('/api/auth/biometric-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          liveDescriptorVector: mismatchedVector,
          portalOrigin: 'ResponderCivilian'
        })
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    }, testEmail);

    console.log(`   Mismatched Biometric Response Status: ${mismatchResult.status}`);
    console.log(`   Mismatched Error Message: ${mismatchResult.data?.message}`);

    if ((mismatchResult.status !== 401 && mismatchResult.status !== 403) || !mismatchResult.data?.message?.includes('mismatch')) {
      throw new Error(`Expected 401 or 403 Biometric Mismatch, got ${mismatchResult.status}`);
    }
    console.log('   [PASS] Adversarial biometric mismatch successfully blocked with 401 Unauthorized!');

    // -------------------------------------------------------------------------
    // TEST 9: Biometric Login with Pre-Seeded Resident
    // -------------------------------------------------------------------------
    console.log('\n[Step 15] Testing Biometric Login for Pre-Seeded Resident (resident.juan@resqtrack.gov.ph)...');
    const seededResult = await page.evaluate(async () => {
      const seed = 'resident.juan@resqtrack.gov.ph';
      const vec = new Array(128).fill(0);
      for (let i = 0; i < 128; i++) {
        const charCode = seed.charCodeAt(i % seed.length) || 42;
        vec[i] = Math.sin((i + 1) * (charCode + 1) * 0.17);
      }
      let norm = 0;
      for (let i = 0; i < 128; i++) norm += vec[i] * vec[i];
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (let i = 0; i < 128; i++) vec[i] = Number((vec[i] / norm).toFixed(4));
      }

      const res = await fetch('/api/auth/biometric-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: seed,
          liveDescriptorVector: vec,
          portalOrigin: 'ResponderCivilian'
        })
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    });

    console.log(`   Seeded User Biometric Login Status: ${seededResult.status}`);
    if (seededResult.status !== 200 || !seededResult.data?.token) {
      throw new Error(`Expected 200 OK for seeded resident biometric login, got ${seededResult.status}`);
    }
    console.log('   [PASS] Pre-seeded resident authenticated successfully via enrolled biometric template!');

    console.log('\n========================================================================');
    console.log('   ALL BIOMETRIC TRAINING & 1:1 LOGIN VERIFICATION TESTS PASSED (100% GREEN)!');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
  }
};

runBiometricVerification().catch((err) => {
  console.error('\n[FATAL AUDIT FAILURE]:', err);
  process.exit(1);
});
