// [Layer: Testing/Frontend]
// Responsibility: Automated Playwright E2E verification for Biometric Model Training during 4-pose registration
// and 1:1 Biometric Login verification against the enrolled training template.
// Complies with Katipuneros Architecture: Universal Lambdas (=>), Zero 'any', Zero emojis, centralized in Testing/.

import { chromium, Browser, Page } from 'playwright';
import { deflateSync } from 'node:zlib';
import * as fs from 'fs';
import * as path from 'path';
import { writeY4mAndMatchingIdArtifacts } from './fixtures/y4mFaceAndMatchingIdFixture';

const REGISTER_URL = 'http://127.0.0.1:1998/register';
const LOGIN_URL = 'http://127.0.0.1:1998/login';
const ARTIFACT_DIR = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';
const ENROLLMENT_SCREENSHOT = path.join(ARTIFACT_DIR, 'biometric_training_enrollment_verified.png');
const BIOMETRIC_LOGIN_SCREENSHOT = path.join(ARTIFACT_DIR, 'biometric_login_success_verified.png');

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const computeCrc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createPngChunk = (type: string, data: Uint8Array): Buffer => {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(computeCrc32(Buffer.concat([typeBytes, Buffer.from(data)])), 0);
  return Buffer.concat([lenBuf, typeBytes, Buffer.from(data), crcBuf]);
};

const encodeRgbaPngBuffer = (width: number, height: number, pixels: Uint8Array): Buffer => {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', deflateSync(raw)),
    createPngChunk('IEND', Buffer.alloc(0))
  ]);
};

const fillRectRgba = (
  pixels: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number
): void => {
  for (let y = y0; y < y0 + h; y += 1) {
    if (y < 0 || y >= height) continue;
    for (let x = x0; x < x0 + w; x += 1) {
      if (x < 0 || x >= width) continue;
      const idx = (y * width + x) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
};

const createProceduralBackIdPngBuffer = (): Buffer => {
  const width = 856;
  const height = 540;
  const pixels = new Uint8Array(width * height * 4);
  fillRectRgba(pixels, width, height, 0, 0, width, height, 232, 238, 246);
  fillRectRgba(pixels, width, height, 14, 14, width - 28, height - 28, 250, 252, 255);
  fillRectRgba(pixels, width, height, 14, 14, width - 28, 70, 18, 44, 86);
  for (let row = 0; row < 5; row += 1) {
    fillRectRgba(pixels, width, height, 48, 124 + row * 36, 700, 14, 30, 41, 59);
  }
  for (let bar = 0; bar < 90; bar += 1) {
    const bw = (bar % 3 === 0) ? 5 : 3;
    const x = 48 + bar * 8;
    if (bar % 2 === 0 && x + bw < width - 48) {
      fillRectRgba(pixels, width, height, x, 344, bw, 128, 15, 23, 42);
    }
  }
  return encodeRgbaPngBuffer(width, height, pixels);
};

const writeArtifactPng = (filename: string, buffer: Buffer): string => {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  const filePath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

const runBiometricVerification = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('   RESQTRACK BIOMETRIC TRAINING & 1:1 LOGIN VERIFICATION SUITE');
  console.log('========================================================================\n');

  const y4mFixtures = writeY4mAndMatchingIdArtifacts(ARTIFACT_DIR);

  const browser: Browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${y4mFixtures.y4mPath}`,
      '--no-sandbox'
    ]
  });

  const timestamp = Date.now();
  const testEmail = `biometric.citizen.${timestamp}@resqtrack.gov.ph`;
  const testPassword = 'Password123!@#Secure';
  const frontIdPath = y4mFixtures.frontIdPath;
  const backIdPath = y4mFixtures.backIdPath;

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
    // TEST 2: Complete Phase 2 (Unified Gov ID Upload & Personal Information)
    // -------------------------------------------------------------------------
    console.log('[Step 3] Uploading Government ID Front & Back and unlocking Personal Info...');
    await page.waitForSelector('#phase-2-id-identity', { state: 'visible', timeout: 5000 });
    await page.waitForSelector('select#id-type', { state: 'visible', timeout: 5000 });
    await page.selectOption('select#id-type', 'drivers');
    await page.setInputFiles('input#front-id-input', frontIdPath);
    await delay(300);
    await page.setInputFiles('input#back-id-input', backIdPath);

    await page.waitForSelector('#id-verification-banner', { state: 'visible', timeout: 25000 });
    await page.waitForSelector('#badge-id-verified-genuine, #badge-id-pending-manual', {
      state: 'visible',
      timeout: 25000
    });
    await page.waitForSelector('#personal-info-section', { state: 'visible', timeout: 10000 });

    console.log('[Step 4] Populating personal information inside unlocked #personal-info-section...');
    await page.waitForSelector('input#first-name', { state: 'visible', timeout: 5000 });
    await page.fill('input#first-name', 'Maria Clara');
    await page.fill('input#last-name', 'Rizal');
    await page.selectOption('select#sex', 'Female');
    await page.fill('input#phone-number', '+639185550202');
    await page.fill('input#dob', '1998-05-12');
    await page.fill('input#barangay', 'Barangay Uno Poblacion');
    await page.fill('input#street-purok', 'Purok Rosal, Mabini Street');
    await page.click('button#btn-phase2-next');
    await delay(800);

    // -------------------------------------------------------------------------
    // TEST 3: Phase 3 Biometric Model Training & 4-Pose Video Recording
    // -------------------------------------------------------------------------
    console.log('[Step 5] Auditing Biometric Model Training Indicators in Phase 3 (#phase-3-facial-record)...');
    await page.waitForSelector('#phase-3-facial-record', { state: 'visible', timeout: 5000 });
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
    console.log('   Locking Pose 1 (Center 0 deg)...');
    await lockBtn.click();
    await delay(600);

    // Pose 2: Right -> Lock
    console.log('   Locking Pose 2 (Right +25 deg)...');
    await lockBtn.click();
    await delay(600);

    // Pose 3: Left -> Lock
    console.log('   Locking Pose 3 (Left -25 deg)...');
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
    await page.waitForSelector('span#badge-facial-confirmed', { state: 'visible', timeout: 15000 });
    await delay(400);

    // Take screenshot of confirmed biometric record
    await page.screenshot({ path: ENROLLMENT_SCREENSHOT, fullPage: false });
    console.log(`   [Artifact] Captured enrollment screenshot to ${ENROLLMENT_SCREENSHOT}`);

    await page.click('button#btn-phase3-next');
    await delay(500);

    // -------------------------------------------------------------------------
    // TEST 4: Complete Phase 4 (Account Credentials)
    // -------------------------------------------------------------------------
    console.log('[Step 8] Setting account credentials in Phase 4 (#phase-4-credentials)...');
    await page.waitForSelector('#phase-4-credentials', { state: 'visible', timeout: 5000 });
    await page.fill('input#display-name', 'Maria Rizal');
    await page.fill('input#email', testEmail);
    await page.fill('input#password', testPassword);
    await page.fill('input#confirm', testPassword);

    await page.locator('input#consent-1').setChecked(true, { force: true });
    await page.locator('input#consent-2').setChecked(true, { force: true });
    await page.click('button#btn-phase4-next');
    await delay(800);

    // -------------------------------------------------------------------------
    // TEST 5: Phase 5 Review & Verification of Trained 128-D Biometric Vector
    // -------------------------------------------------------------------------
    console.log('[Step 9] Auditing Phase 5 Review (#phase-5-review) for Biometric Training Badge...');
    await page.waitForSelector('#phase-5-review', { state: 'visible', timeout: 5000 });
    const bioReviewBadge = page.locator('#review-biometric-training-status');
    await bioReviewBadge.waitFor({ state: 'visible', timeout: 5000 });
    const reviewText = await bioReviewBadge.innerText();
    console.log(`   Phase 5 Review Status: ${reviewText}`);
    if (!reviewText.includes('128-D Vector Ready for 1:1 Login')) {
      throw new Error('Biometric training status not displayed in Phase 5 review.');
    }

    // Submit Registration & capture userId
    console.log('[Step 10] Submitting registration with trained biometric vector...');
    const registerResPromise = page.waitForResponse(
      (res) => res.url().includes('/api/register') && res.request().method() === 'POST',
      { timeout: 15000 }
    );
    await page.click('button#submit');
    const registerRes = await registerResPromise;
    const registerJson = (await registerRes.json()) as { userId?: string };
    await delay(1000);
    if (!registerRes.ok() || !registerJson.userId) {
      throw new Error(`Registration failed: HTTP ${registerRes.status()} (${JSON.stringify(registerJson)})`);
    }
    console.log(`   [PASS] User registration submitted with active biometric training vector (userId=${registerJson.userId})!`);

    // Trigger Standby AI Auto-Approve so the newly registered Pending user is approved before 1:1 login
    console.log('[Step 10.5] Triggering Standby AI Gov ID Auto-Approve Strategy...');
    const standbyApproveRes = await fetch('http://127.0.0.1:1999/api/standby-ai/auto-approve-gov-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: registerJson.userId,
        governmentIdType: 'drivers',
        firstName: 'Maria Clara',
        lastName: 'Rizal',
        dateOfBirth: '1998-05-12',
        applyToDatabase: true
      })
    });
    if (!standbyApproveRes.ok) {
      throw new Error(`Standby Auto-Approve failed with HTTP ${standbyApproveRes.status}`);
    }
    const standbyApproveData = (await standbyApproveRes.json()) as {
      approved?: boolean;
      decisionStatus?: string;
      strategyName?: string;
    };
    if (!standbyApproveData.approved) {
      throw new Error(`Expected Standby Auto-Approve to approve user, got ${JSON.stringify(standbyApproveData)}`);
    }
    console.log(
      `   [PASS] Standby Auto-Approve completed via ${standbyApproveData.strategyName ?? 'ClaudeStandbyAutoApproveGovId'} (${standbyApproveData.decisionStatus ?? 'Approved'})`
    );

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

    const biometricLoginResponsePromise = page.waitForResponse(
      (res) =>
        (res.url().includes('/api/biometric-login') || res.url().includes('/api/auth/biometric-login')) &&
        res.request().method() === 'POST',
      { timeout: 25000 }
    );

    await page.locator('button[type="submit"]:has-text("Activate Live Camera")').click();

    console.log('[Step 13] Executing 1:1 Biometric Optical Scan...');
    const settledEarly = await Promise.race([
      biometricLoginResponsePromise.then(() => true),
      delay(4500).then(() => false)
    ]);
    if (!settledEarly) {
      const manualScanButton = page.locator('button#btn-scan-biometric-face');
      const fallbackScanButton = page.locator('button#btn-synthetic-test-scan');
      if (await manualScanButton.isVisible().catch(() => false) && !(await manualScanButton.isDisabled().catch(() => true))) {
        await manualScanButton.click();
      } else if (await fallbackScanButton.isVisible().catch(() => false) && !(await fallbackScanButton.isDisabled().catch(() => true))) {
        await fallbackScanButton.click();
      }
    }
    const loginRes = await biometricLoginResponsePromise;
    console.log(`   [Biometric Login API] HTTP ${loginRes.status()}`);
    await page.waitForURL(/\/(civilian\/)?dashboard/i, { timeout: 10000 }).catch(() => undefined);
    await delay(1000);

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

runBiometricVerification().catch((err: unknown) => {
  console.error('\n[FATAL AUDIT FAILURE]:', err);
  process.exit(1);
});
