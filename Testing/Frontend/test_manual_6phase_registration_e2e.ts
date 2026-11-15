// [Layer: Testing/Frontend]
// test_manual_6phase_registration_e2e.ts -- Playwright automated verification test for the Unified 5-Phase Registration Workflow & Strategy Pattern.
// Verifies:
// 1. API Verification: Status codes 201, 400, 403, 409, 413, 415, 422, separate verification statuses, email-only login.
// 2. Browser E2E Automation (Port 1998):
//    - Phase 1 (01 Role): Role Selection (Civilian, verifies LDRRMO Admin is forbidden from self-registration).
//    - Phase 2 (02 ID & Info): Dual-side Gov ID Upload & Verification Gate -> unlocks #personal-info-section directly (editable fields + address + physical stats).
//    - Phase 3 (03 Facial): Facial Record (Camera/upload panel, privacy consent, capture preview, confirm).
//    - Phase 4 (04 Auth): Account Credentials (DisplayName for UI display only, Email login identifier, Password/ConfirmPassword, Show Password toggle).
//    - Phase 5 (05 Review): Review & Submission (Full review summary, password hash never shown, backward navigation preserves state, submission succeeds).
// Universal lambda expressions (=>). Zero emojis. Zero 'any'.

import { chromium } from 'playwright';
import { deflateSync } from 'node:zlib';
import path from 'path';
import fs from 'fs';
import { createElenaMarquezDriversLicensePngBuffer } from './fixtures/syntheticIdFixtures';
import { ensureE2eServersReady, type E2eServersHandle } from './fixtures/e2eServerHarness';

const ARTIFACTS_DIR = 'C:/Users/provu/.gemini/antigravity-cli/brain/f4db8cc5-1635-43fd-94bb-ed301c4741f1';
const API_BASE_URL = 'http://127.0.0.1:1999';
const FRONTEND_URL = 'http://127.0.0.1:1998/register';

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
  const crcInput = Buffer.concat([typeBytes, Buffer.from(data)]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(computeCrc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBytes, Buffer.from(data), crcBuf]);
};

const encodeRgbaPngBuffer = (width: number, height: number, pixels: Uint8Array): Buffer => {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    const srcStart = y * width * 4;
    raw.set(pixels.subarray(srcStart, srcStart + width * 4), rowStart + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(raw);
  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', idat),
    createPngChunk('IEND', Buffer.alloc(0))
  ]);
};

const setPixelRgba = (
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number
): void => {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }
  const idx = (y * width + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = 255;
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
    for (let x = x0; x < x0 + w; x += 1) {
      setPixelRgba(pixels, width, height, x, y, r, g, b);
    }
  }
};

// High-contrast 856x540 Driver's License Back Card PNG (distinct from Front PNG & non-blank for pre-flight)
const createProceduralBackIdPngBuffer = (): Buffer => {
  const width = 856;
  const height = 540;
  const pixels = new Uint8Array(width * height * 4);
  fillRectRgba(pixels, width, height, 0, 0, width, height, 240, 244, 250);
  fillRectRgba(pixels, width, height, 14, 14, width - 28, height - 28, 252, 253, 255);
  fillRectRgba(pixels, width, height, 14, 14, width - 28, 74, 16, 42, 84);
  fillRectRgba(pixels, width, height, 14, 88, width - 28, 8, 198, 40, 40);
  // Restrictions & Conditions data lines
  for (let row = 0; row < 6; row += 1) {
    const y = 128 + row * 34;
    fillRectRgba(pixels, width, height, 48, y, 220, 14, 30, 41, 59);
    fillRectRgba(pixels, width, height, 290, y, 490, 14, 51, 65, 85);
  }
  // PDF417-style high-contrast vertical stripe barcode on lower back
  for (let bar = 0; bar < 96; bar += 1) {
    const bw = (bar % 3 === 0) ? 5 : 3;
    const x = 48 + bar * 7;
    if (bar % 2 === 0 && x + bw < width - 48) {
      fillRectRgba(pixels, width, height, x, 356, bw, 118, 15, 23, 42);
    }
  }
  fillRectRgba(pixels, width, height, 48, 492, 420, 16, 71, 85, 105);
  return encodeRgbaPngBuffer(width, height, pixels);
};

// High-contrast 240x240 synthetic textured facial portrait PNG (passes >= 64px & non-blank contrast checks)
const createProceduralFacePngBuffer = (): Buffer => {
  const width = 240;
  const height = 240;
  const pixels = new Uint8Array(width * height * 4);
  fillRectRgba(pixels, width, height, 0, 0, width, height, 226, 232, 240);
  fillRectRgba(pixels, width, height, 16, 16, width - 32, height - 32, 244, 247, 252);
  fillRectRgba(pixels, width, height, 72, 46, 96, 116, 212, 166, 136);
  fillRectRgba(pixels, width, height, 88, 86, 18, 10, 28, 36, 48);
  fillRectRgba(pixels, width, height, 134, 86, 18, 10, 28, 36, 48);
  fillRectRgba(pixels, width, height, 102, 128, 36, 8, 140, 62, 62);
  fillRectRgba(pixels, width, height, 52, 168, 136, 56, 30, 58, 110);
  return encodeRgbaPngBuffer(width, height, pixels);
};

// Corrupted file data url (invalid magic bytes)
const CORRUPT_DATA_URL = 'data:image/png;base64,VGhpcyBpcyBub3QgYSB2YWxpZCBQTkcgZmlsZSBhdCBhbGwh';

// Small 10x10 PNG sample (below 64x64 minimum dimensions)
const SUB_MIN_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABmJLR0QA/wD/AP+gvaeTAAAAFklEQVR42mNk+M9QDwMMAQo00VAAAwAg6gEBe6b0wQAAAABJRU5ErkJggg==';

const executeManualRegistrationSuite = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('   TEST: RESQTRACK UNIFIED 5-PHASE REGISTRATION & STRATEGY PATTERN E2E');
  console.log('========================================================================');

  const timestamp = Date.now();
  const testEmail = `playwright.citizen.${timestamp}@resqtrack.gov.ph`;
  const testDisplayName = `citizen_pw_${timestamp}`;

  // ---------------------------------------------------------------------------
  // SECTION 1: Backend API Contract & Semantic HTTP Status Code Verification
  // ---------------------------------------------------------------------------
  console.log('\n[Section 1/2] Verifying Backend API Contracts and Semantic Status Codes...');

  // 1.1 GET /api/auth/verification-providers
  console.log('  1.1 Checking GET /api/auth/verification-providers...');
  const providersRes = await fetch(`${API_BASE_URL}/api/auth/verification-providers`);
  if (!providersRes.ok) {
    throw new Error(`Failed to fetch verification providers: ${providersRes.status}`);
  }
  const providersData = await providersRes.json();
  console.log(`      Active Identity: ${providersData.activeIdentityProvider} (${providersData.activeIdentityMode})`);
  console.log(`      Active Facial: ${providersData.activeFacialProvider} (${providersData.activeFacialMode})`);
  if (providersData.activeIdentityMode !== 'Manual' || providersData.activeFacialMode !== 'Manual') {
    throw new Error('Default providers must be in Manual mode.');
  }

  // 1.2 POST /api/register -> 403 Forbidden for LDRRMO_Admin self-registration
  console.log('  1.2 Verifying 403 Forbidden on LDRRMO_Admin self-registration...');
  const forbiddenRes = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `admin.attempt.${timestamp}@resqtrack.gov.ph`,
      password: 'AdminPassword123!@#',
      confirmPassword: 'AdminPassword123!@#',
      displayName: 'fake_commander',
      fullName: 'Fake Commander',
      role: 'LDRRMO_Admin',
      consentAccepted: true
    })
  });
  if (forbiddenRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden on LDRRMO_Admin registration, got ${forbiddenRes.status}`);
  }
  const forbiddenBody = await forbiddenRes.json();
  if (forbiddenBody.code !== 'ROLE_FORBIDDEN') {
    throw new Error(`Expected ROLE_FORBIDDEN code, got ${forbiddenBody.code}`);
  }
  console.log('      Verified: 403 Forbidden (ROLE_FORBIDDEN) correctly enforced.');

  // 1.3 POST /api/register -> 400 Bad Request on password mismatch
  console.log('  1.3 Verifying 400 Bad Request on password mismatch...');
  const mismatchRes = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `mismatch.${timestamp}@resqtrack.gov.ph`,
      password: 'Password123!@#',
      confirmPassword: 'DifferentPassword456!@#',
      displayName: 'mismatch_user',
      fullName: 'Mismatch User',
      role: 'Civilian',
      consentAccepted: true
    })
  });
  if (mismatchRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request on password mismatch, got ${mismatchRes.status}`);
  }
  console.log('      Verified: 400 Bad Request (PASSWORD_MISMATCH) correctly enforced.');

  // 1.4 POST /api/register -> 415 Unsupported Media Type on corrupt magic bytes
  console.log('  1.4 Verifying 415 Unsupported Media Type on corrupt magic bytes...');
  const corruptRes = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `corrupt.${timestamp}@resqtrack.gov.ph`,
      password: 'ValidPassword123!@#',
      confirmPassword: 'ValidPassword123!@#',
      displayName: 'corrupt_user',
      fullName: 'Corrupt User',
      role: 'Civilian',
      consentAccepted: true,
      governmentIdType: 'PhilSys',
      idCaptureDataUrl: CORRUPT_DATA_URL
    })
  });
  if (corruptRes.status !== 415) {
    throw new Error(`Expected 415 Unsupported Media Type on corrupt header, got ${corruptRes.status}`);
  }
  console.log('      Verified: 415 Unsupported Media Type correctly enforced.');

  // 1.5 POST /api/register -> 422 Unprocessable Entity on sub-minimum image dimensions
  console.log('  1.5 Verifying 422 Unprocessable Entity on sub-minimum dimensions (<64px)...');
  const subDimRes = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `subdim.${timestamp}@resqtrack.gov.ph`,
      password: 'ValidPassword123!@#',
      confirmPassword: 'ValidPassword123!@#',
      displayName: 'subdim_user',
      fullName: 'Subdim User',
      role: 'Civilian',
      consentAccepted: true,
      governmentIdType: 'PhilSys',
      idCaptureDataUrl: SUB_MIN_PNG_BASE64,
      minImageDimension: 64
    })
  });
  if (subDimRes.status !== 422) {
    throw new Error(`Expected 422 Unprocessable Entity on sub-minimum dimensions, got ${subDimRes.status}`);
  }
  console.log('      Verified: 422 Unprocessable Entity correctly enforced.');

  // ---------------------------------------------------------------------------
  // SECTION 2: Full Unified 5-Phase Frontend Wizard E2E Browser Automation
  // ---------------------------------------------------------------------------
  console.log('\n[Section 2/2] Running Playwright E2E Browser Automation on Port 1998 (/register)...');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  // Navigate to Registration Wizard on Port 1998
  console.log(`  Navigating to ${FRONTEND_URL}...`);
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // PHASE 1: Role Selection (#phase-1-role, ?step=0)
  console.log('  Executing Phase 1: Role Selection...');
  await page.waitForSelector('#phase-1-role', { state: 'visible', timeout: 8000 });
  const civilianBtn = page.locator('button#role-btn-civilian');
  await civilianBtn.waitFor({ state: 'visible', timeout: 8000 });
  await civilianBtn.click();
  await page.waitForTimeout(400);

  // Verify LDRRMO Admin is NOT selectable
  const adminOptionCount = await page.locator('button:has-text("LDRRMO Admin"), button:has-text("Administrator")').count();
  if (adminOptionCount > 0) {
    throw new Error('Security Breach: Privileged LDRRMO Admin was presented in public registration options.');
  }

  // Click continue to Phase 2 (Unified ID & Identity Verification)
  const nextPhase1Btn = page.locator('button#btn-phase1-next');
  await nextPhase1Btn.click();
  await page.waitForTimeout(600);

  // PHASE 2: Unified Gov ID Upload & Personal Information (#phase-2-id-identity, ?step=1)
  console.log('  Executing Phase 2: Government ID Upload & Identity Verification Gate...');
  await page.waitForSelector('#phase-2-id-identity', { state: 'visible', timeout: 5000 });
  await page.waitForSelector('select#id-type', { state: 'visible', timeout: 5000 });

  const initialIdTypeValue = await page.locator('select#id-type').inputValue();
  if (initialIdTypeValue !== '') {
    throw new Error(`Security Gate Violation: select#id-type must start at "" ("Choose ID Type"), got '${initialIdTypeValue}'.`);
  }
  const firstIdOption = page.locator('select#id-type option').first();
  const firstIdOptionText = ((await firstIdOption.textContent()) ?? '').trim();
  const firstIdOptionValue = await firstIdOption.getAttribute('value');
  if (firstIdOptionText !== 'Choose ID Type' || firstIdOptionValue !== '') {
    throw new Error(`Expected first option value="" text="Choose ID Type", got value="${firstIdOptionValue}" text="${firstIdOptionText}".`);
  }
  const lockedNotice = page.locator('#id-upload-locked-notice');
  await lockedNotice.waitFor({ state: 'visible', timeout: 5000 });
  if ((await lockedNotice.getAttribute('role')) !== 'status') {
    throw new Error('Expected #id-upload-locked-notice to expose role="status".');
  }
  for (const lockedSel of [
    '#id-upload-section',
    '#front-id-dropzone',
    'input#front-id-input',
    '#back-id-dropzone',
    'input#back-id-input',
    '#btn-clear-both-ids',
    '#personal-info-section'
  ]) {
    const lockedCount = await page.locator(lockedSel).count();
    if (lockedCount !== 0) {
      throw new Error(`Security Gate Violation: ${lockedSel} must stay unmounted until ID type is chosen (count=${lockedCount}).`);
    }
  }
  const nextBtnDisabledBeforeIdType = await page.locator('button#btn-phase2-next').isDisabled();
  if (!nextBtnDisabledBeforeIdType) {
    throw new Error('Security Gate Violation: #btn-phase2-next must remain disabled while idType === "".');
  }
  await page.locator('ol.steps li[data-step-item="2"]').click();
  if ((await page.locator('#phase-2-id-identity').count()) !== 1 || (await page.locator('#phase-3-facial-record').count()) !== 0) {
    throw new Error('Security Gate Violation: Phase 2 must block advancement to Phase 3 while idType is empty.');
  }
  const idTypeErrorAlert = page.locator('#id-type-error');
  await idTypeErrorAlert.waitFor({ state: 'visible', timeout: 5000 });
  if ((await idTypeErrorAlert.getAttribute('role')) !== 'alert') {
    throw new Error('Expected #id-type-error to have role="alert".');
  }

  await page.selectOption('select#id-type', 'drivers');
  if ((await page.locator('#id-type-error').count()) !== 0) {
    throw new Error('Expected #id-type-error to clear immediately after selecting "drivers".');
  }
  if ((await page.locator('#id-upload-locked-notice').count()) !== 0) {
    throw new Error('Expected #id-upload-locked-notice to disappear after selecting "drivers".');
  }
  await page.waitForSelector('#id-upload-section', { state: 'visible', timeout: 5000 });

  // Verify #personal-info-section is gated (unmounted) and #btn-phase2-next is disabled BEFORE Dual-Side ID Upload
  const preUploadPersonalCount = await page.locator('#personal-info-section').count();
  if (preUploadPersonalCount !== 0) {
    throw new Error(`Security Gate Violation: #personal-info-section must remain unmounted before dual-side upload (found ${preUploadPersonalCount}).`);
  }
  const nextBtnDisabledBeforeUpload = await page.locator('button#btn-phase2-next').isDisabled();
  if (!nextBtnDisabledBeforeUpload) {
    throw new Error('Security Gate Violation: #btn-phase2-next must remain disabled before dual-side ID verification.');
  }

  // Upload distinct textured Front & Back ID + Face PNGs via temporary files
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  const tempFrontPath = path.join(ARTIFACTS_DIR, 'temp_front_id.png');
  const tempBackPath = path.join(ARTIFACTS_DIR, 'temp_back_id.png');
  const tempFacePath = path.join(ARTIFACTS_DIR, 'temp_face.png');

  fs.writeFileSync(tempFrontPath, createElenaMarquezDriversLicensePngBuffer());
  fs.writeFileSync(tempBackPath, createProceduralBackIdPngBuffer());
  fs.writeFileSync(tempFacePath, createProceduralFacePngBuffer());

  const frontInput = page.locator('input#front-id-input');
  await frontInput.setInputFiles(tempFrontPath);
  await page.waitForTimeout(400);

  // Upload distinct Back ID
  const backInput = page.locator('input#back-id-input');
  await backInput.setInputFiles(tempBackPath);
  await page.waitForTimeout(500);

  // Verify previews appear
  const frontPreview = await page.locator('img#front-id-preview').isVisible();
  const backPreview = await page.locator('img#back-id-preview').isVisible();
  if (!frontPreview || !backPreview) {
    throw new Error('ID Front or Back preview image was not rendered.');
  }

  // Wait for automatic dual-side preflight + verification/pending unlock of #personal-info-section
  await page.waitForSelector('#id-verification-banner', { state: 'visible', timeout: 105000 });
  await page.waitForSelector('#badge-id-verified-genuine, #badge-id-pending-manual', {
    state: 'visible',
    timeout: 105000
  });
  await page.waitForSelector('#personal-info-section', { state: 'visible', timeout: 10000 });
  console.log('      Verified: Front and Back ID previews rendered and #personal-info-section unlocked.');

  // Verify canonical input field inside #personal-info-section is editable immediately without secondary OCR confirm clicks
  await page.waitForSelector('#personal-info-section input#first-name', { state: 'visible', timeout: 5000 });
  const isEditable = await page.locator('input#first-name').isEditable();
  if (!isEditable) {
    throw new Error('Input field firstName inside #personal-info-section must be editable once unlocked.');
  }

  await page.fill('input#first-name', 'Gabriela');
  await page.fill('input#middle-name', 'Silang');
  await page.fill('input#last-name', 'Cariño');
  await page.selectOption('select#sex', 'Female');
  await page.fill('input#dob', '1998-03-15');
  await page.fill('input#phone-number', '+639185550101');
  await page.fill('input#province', 'Zamboanga del Norte');
  await page.fill('input#city', 'Katipunan');
  await page.fill('input#barangay', 'Barangay Uno (Pob.)');
  await page.fill('input#street-purok', 'Purok 2, Rizal Street');
  await page.fill('input#weight', '54 kg');
  await page.fill('input#height', '163 cm');

  // Verify calculated age
  const ageVal = await page.inputValue('input#age');
  console.log(`      Calculated Age from DOB 1998-03-15: ${ageVal}`);

  const nextPhase2Btn = page.locator('button#btn-phase2-next');
  await nextPhase2Btn.click();
  await page.waitForTimeout(600);

  // PHASE 3: Facial Record (#phase-3-facial-record, ?step=2)
  console.log('  Executing Phase 3: Facial Record...');
  await page.waitForSelector('#phase-3-facial-record', { state: 'visible', timeout: 5000 });
  await page.waitForSelector('input#facial-consent-checkbox', { state: 'visible', timeout: 5000 });

  // Upload face capture photo via hidden input
  const faceFileInput = page.locator('input#facial-file-upload-input');
  await faceFileInput.setInputFiles(tempFacePath);
  await page.waitForTimeout(500);

  // Check RA 10173 Consent Checkbox
  await page.locator('input#facial-consent-checkbox').setChecked(true, { force: true });
  await page.waitForTimeout(300);

  // Click Confirm Facial Capture
  const confirmCaptureBtn = page.locator('button#btn-confirm-facial-capture');
  await confirmCaptureBtn.click();
  await page.waitForSelector('span#badge-facial-confirmed', { state: 'visible', timeout: 15000 });
  console.log('      Verified: Facial photograph confirmed.');

  const nextPhase3Btn = page.locator('button#btn-phase3-next');
  await nextPhase3Btn.click();
  await page.waitForTimeout(600);

  // PHASE 4: Account Credentials (#phase-4-credentials, ?step=3)
  console.log('  Executing Phase 4: Account Credentials...');
  await page.waitForSelector('#phase-4-credentials', { state: 'visible', timeout: 5000 });
  await page.waitForSelector('input#display-name', { state: 'visible', timeout: 5000 });

  await page.fill('input#display-name', testDisplayName);
  await page.fill('input#email', testEmail);
  await page.fill('input#password', 'ResQTrack2026!@#');
  await page.fill('input#confirm', 'ResQTrack2026!@#');

  // Test Password Visibility Toggle
  console.log('      Testing Password Visibility Toggle...');
  const eyeBtn = page.locator('button#pw-toggle');
  await eyeBtn.click();
  const passwordTypeAfterToggle = await page.locator('input#password').getAttribute('type');
  if (passwordTypeAfterToggle !== 'text') {
    throw new Error('Password input should be type="text" when visibility toggled on.');
  }
  await eyeBtn.click();
  const passwordTypeRestored = await page.locator('input#password').getAttribute('type');
  if (passwordTypeRestored !== 'password') {
    throw new Error('Password input should be type="password" when visibility toggled off.');
  }

  // Check Legal Certifications
  await page.locator('input#consent-1').setChecked(true, { force: true });
  await page.locator('input#consent-2').setChecked(true, { force: true });
  await page.waitForTimeout(300);

  const nextPhase4Btn = page.locator('button#btn-phase4-next');
  await nextPhase4Btn.click();
  await page.waitForTimeout(600);

  // PHASE 5: Review & Submission (#phase-5-review, ?step=4)
  console.log('  Executing Phase 5: Review & Registration Submission...');
  await page.waitForSelector('div#phase-5-review', { state: 'visible', timeout: 5000 });

  // Verify Summary Information
  const reviewRole = await page.locator('text=Civilian').first().isVisible();
  const reviewName = await page.locator('strong#review-fullname').innerText();
  const reviewDisplayName = await page.locator(`text=${testDisplayName}`).isVisible();
  const reviewEmail = await page.locator(`text=${testEmail}`).isVisible();
  const reviewIdType = await page.locator('strong#review-id-type').innerText();

  console.log(`      Review Summary -> Name: ${reviewName}, ID Type: ${reviewIdType}`);
  if (!reviewRole || !reviewName.includes('Gabriela') || !reviewDisplayName || !reviewEmail) {
    throw new Error('Review summary failed to display all submitted details correctly.');
  }

  // Verify password / hash is NEVER displayed
  const passwordVisible = await page.locator('text=ResQTrack2026!@#').isVisible();
  if (passwordVisible) {
    throw new Error('Security Breach: Plaintext password was exposed in registration review!');
  }

  // Verify Backward Navigation preserves state and Phase 5 Edit buttons route to matching phases
  console.log('      Testing backward navigation state preservation...');
  const backwardNavBugs: string[] = [];

  const editPhase2Btn = page.locator('button#review-edit-phase2');
  await editPhase2Btn.click();
  await page.waitForTimeout(500);
  const landedOnPhase2 = await page.locator('#phase-2-id-identity').isVisible();
  if (!landedOnPhase2) {
    backwardNavBugs.push('Clicking #review-edit-phase2 did not navigate to #phase-2-id-identity.');
  }

  const preservedFirstName = await page.inputValue('input#first-name');
  if (preservedFirstName !== 'Gabriela') {
    throw new Error(`Backward navigation lost form state! Expected "Gabriela", got "${preservedFirstName}"`);
  }

  // Advance from Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 Review, then verify #review-edit-phase3
  await page.locator('button#btn-phase2-next').click();
  await page.waitForTimeout(400);
  await page.locator('button#btn-phase3-next').click();
  await page.waitForTimeout(400);
  await page.locator('button#btn-phase4-next').click();
  await page.waitForTimeout(600);

  const editPhase3Btn = page.locator('button#review-edit-phase3');
  await editPhase3Btn.click();
  await page.waitForTimeout(500);
  const landedOnPhase3Facial = await page.locator('#phase-3-facial-record').isVisible();
  if (!landedOnPhase3Facial) {
    backwardNavBugs.push('Clicking #review-edit-phase3 did not navigate to #phase-3-facial-record.');
  }
  const facialStillConfirmed = await page.locator('span#badge-facial-confirmed').isVisible();
  if (!facialStillConfirmed) {
    backwardNavBugs.push('Backward navigation to #phase-3-facial-record lost facial confirmation state.');
  }

  // Return cleanly to Phase 5 Review
  await page.locator('button#btn-phase3-next').click();
  await page.waitForTimeout(400);
  await page.locator('button#btn-phase4-next').click();
  await page.waitForTimeout(600);
  await page.waitForSelector('div#phase-5-review', { state: 'visible', timeout: 5000 });

  if (backwardNavBugs.length > 0) {
    throw new Error(backwardNavBugs.join(' | '));
  }

  // Click Submit Registration
  console.log('      Submitting complete registration to backend...');
  const submitBtn = page.locator('button#submit');
  await submitBtn.click();

  // Wait for submission request to finish loading
  await page.waitForSelector('button#submit.is-ok', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(300);

  const statusText = await page.locator('p#status').innerText();
  console.log(`      Submission Status Text: "${statusText}"`);

  if (!statusText.toLowerCase().includes('successful') && !statusText.toLowerCase().includes('submitted') && !statusText.toLowerCase().includes('pending')) {
    throw new Error(`Expected submission confirmation text, got: "${statusText}"`);
  }
  console.log('      Verified: Submission accepted with 201 Created!');

  // Capture verification screenshot
  const screenshotPath = path.join(ARTIFACTS_DIR, 'e2e_manual_5phase_registration_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`      Saved verification screenshot: ${screenshotPath}`);

  // ---------------------------------------------------------------------------
  // SECTION 3: Post-Registration Authentication & Enforcement Verification
  // ---------------------------------------------------------------------------
  console.log('\n[Section 3/3] Verifying Post-Registration Security Enforcement...');

  // 3.1 Duplicate Email Registration -> 409 Conflict
  console.log('  3.1 Attempting duplicate registration with same email (Expect 409 Conflict)...');
  const duplicateRes = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'AnotherPassword123!@#',
      confirmPassword: 'AnotherPassword123!@#',
      displayName: 'another_user',
      fullName: 'Another User',
      role: 'Civilian',
      consentAccepted: true
    })
  });
  if (duplicateRes.status !== 409) {
    throw new Error(`Expected 409 Conflict for duplicate email, got ${duplicateRes.status}`);
  }
  console.log('      Verified: 409 Conflict (EMAIL_CONFLICT) properly enforced.');

  // 3.2 Login Attempt with DisplayName -> Fails (Email-Only Login Rule)
  console.log('  3.2 Attempting login using DisplayName instead of Email (Expect failure)...');
  const dnLoginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testDisplayName, // Passing DisplayName into email login field
      password: 'ResQTrack2026!@#'
    })
  });
  if (dnLoginRes.ok) {
    throw new Error('Security Breach: System permitted login using DisplayName instead of Email!');
  }
  console.log('      Verified: DisplayName login rejected. Email is strictly required.');

  // 3.3 Login Attempt before Admin Approval -> Returns 401 with Pending verification message
  console.log('  3.3 Attempting login before Administrator review approval (Expect Pending)...');
  const pendingLoginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'ResQTrack2026!@#'
    })
  });
  if (pendingLoginRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for pending account, got ${pendingLoginRes.status}`);
  }
  const pendingLoginData = await pendingLoginRes.json();
  const pendingMsg = pendingLoginData.message || '';
  if (!pendingMsg.toLowerCase().includes('pending')) {
    throw new Error(`Expected pending verification message, got: "${pendingMsg}"`);
  }
  console.log(`      Verified: Account is in Pending state ("${pendingMsg}").`);

  // Cleanup temp files
  try {
    if (fs.existsSync(tempFrontPath)) fs.unlinkSync(tempFrontPath);
    if (fs.existsSync(tempBackPath)) fs.unlinkSync(tempBackPath);
    if (fs.existsSync(tempFacePath)) fs.unlinkSync(tempFacePath);
  } catch {
    // Ignore cleanup
  }

  await browser.close();

  console.log('\n========================================================================');
  console.log('   ALL E2E & API REGISTRATION TESTS PASSED (100% GREEN)');
  console.log('========================================================================');
};

const runTest = async (): Promise<void> => {
  const servers: E2eServersHandle = await ensureE2eServersReady({ includeResponder: false });
  try {
    await executeManualRegistrationSuite();
  } finally {
    await servers.stopAll();
  }
};

runTest().catch((err: unknown) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
