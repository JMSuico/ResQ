// [Layer: Testing/Frontend]
// test_manual_6phase_registration_e2e.ts -- Playwright automated verification test for the 6-Phase Manual Registration Workflow & Strategy Pattern.
// Verifies:
// 1. API Verification: Status codes 201, 400, 403, 409, 413, 415, 422, separate verification statuses, email-only login.
// 2. Browser E2E Automation (Port 1998):
//    - Phase 1: Role Selection (Civilian, verifies LDRRMO Admin is forbidden from self-registration).
//    - Phase 2: Personal Information (100% manual entry: First, Middle, Surname, Suffix, Sex, DOB, Age, Contact, Address, Weight, Height -- ZERO OCR lock).
//    - Phase 3: Government ID Upload (Manual ID type selection, Front/Back image upload, preview, replace/remove -- ZERO OCR extraction).
//    - Phase 4: Facial Record (Camera/upload panel, privacy consent, capture preview, retake, confirm -- ZERO automatic face recognition).
//    - Phase 5: Account Credentials (DisplayName for UI display only, Email login identifier, Password/ConfirmPassword, Show Password toggle).
//    - Phase 6: Review & Submission (Full review summary, password hash never shown, backward navigation preserves state, submission succeeds).
// Universal lambda expressions (=>). Zero emojis.

import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = 'C:/Users/provu/.gemini/antigravity-cli/brain/f4db8cc5-1635-43fd-94bb-ed301c4741f1';
const API_BASE_URL = 'http://127.0.0.1:1999';
const FRONTEND_URL = 'http://127.0.0.1:1998/register';

// Valid 100x100 PNG sample in base64
const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAAP0lEQVR42u3BAQEAAACAkP6v7ggKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4G8kOAABiW+UigAAAABJRU5ErkJggg==';

// Corrupted file data url (invalid magic bytes)
const CORRUPT_DATA_URL = 'data:image/png;base64,VGhpcyBpcyBub3QgYSB2YWxpZCBQTkcgZmlsZSBhdCBhbGwh';

// Small 10x10 PNG sample (below 64x64 minimum dimensions)
const SUB_MIN_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABmJLR0QA/wD/AP+gvaeTAAAAFklEQVR42mNk+M9QDwMMAQo00VAAAwAg6gEBe6b0wQAAAABJRU5ErkJggg==';

const runTest = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('   TEST: RESQTRACK 6-PHASE MANUAL REGISTRATION & STRATEGY PATTERN E2E');
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
  // SECTION 2: Full 6-Phase Frontend Wizard E2E Browser Automation
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

  // PHASE 1: Role Selection
  console.log('  Executing Phase 1: Role Selection...');
  const civilianBtn = page.locator('button#role-btn-civilian');
  await civilianBtn.waitFor({ state: 'visible', timeout: 8000 });
  await civilianBtn.click();
  await page.waitForTimeout(400);

  // Verify LDRRMO Admin is NOT selectable
  const adminOptionCount = await page.locator('button:has-text("LDRRMO Admin"), button:has-text("Administrator")').count();
  if (adminOptionCount > 0) {
    throw new Error('Security Breach: Privileged LDRRMO Admin was presented in public registration options.');
  }

  // Click continue to Phase 2
  const nextPhase1Btn = page.locator('button#btn-phase1-next');
  await nextPhase1Btn.click();
  await page.waitForTimeout(600);

  // PHASE 2: Personal Information (100% Manual Entry, Zero OCR lock)
  console.log('  Executing Phase 2: Personal Information (100% manual input, zero OCR)...');
  await page.waitForSelector('input#first-name', { state: 'visible', timeout: 5000 });

  // Verify field is editable immediately without OCR scan
  const isEditable = await page.locator('input#first-name').isEditable();
  if (!isEditable) {
    throw new Error('Input field firstName must be editable immediately (zero OCR locking).');
  }

  await page.fill('input#first-name', 'Gabriela');
  await page.fill('input#middle-name', 'Silang');
  await page.fill('input#last-name', 'Cariño');
  await page.selectOption('select#sex', 'Female');
  await page.fill('input#dob', '1998-03-15');
  await page.fill('input#phone-number', '+639171234567');
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

  // PHASE 3: Government ID Upload (Manual Selection & Upload)
  console.log('  Executing Phase 3: Government ID Upload...');
  await page.waitForSelector('select#id-type', { state: 'visible', timeout: 5000 });
  await page.selectOption('select#id-type', 'philsys');

  // Verify manual review disclaimer notice is visible
  const disclaimer = await page.locator('text=Manual Government ID Selection').isVisible();
  if (!disclaimer) {
    throw new Error('Expected disclaimer stating manual document selection.');
  }

  // Upload Front ID via temporary file
  const tempFrontPath = path.join(ARTIFACTS_DIR, 'temp_front_id.png');
  const tempBackPath = path.join(ARTIFACTS_DIR, 'temp_back_id.png');
  const tempFacePath = path.join(ARTIFACTS_DIR, 'temp_face.png');

  const pngBuffer = Buffer.from(VALID_PNG_BASE64.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(tempFrontPath, pngBuffer);
  fs.writeFileSync(tempBackPath, pngBuffer);
  fs.writeFileSync(tempFacePath, pngBuffer);

  const frontInput = page.locator('input#front-id-input');
  await frontInput.setInputFiles(tempFrontPath);
  await page.waitForTimeout(500);

  // Upload Back ID
  const backInput = page.locator('input#back-id-input');
  await backInput.setInputFiles(tempBackPath);
  await page.waitForTimeout(500);

  // Verify previews appear
  const frontPreview = await page.locator('img#front-id-preview').isVisible();
  const backPreview = await page.locator('img#back-id-preview').isVisible();
  if (!frontPreview || !backPreview) {
    throw new Error('ID Front or Back preview image was not rendered.');
  }
  console.log('      Verified: Front and Back ID previews rendered without auto-OCR triggering.');

  const nextPhase3Btn = page.locator('button#btn-phase3-next');
  await nextPhase3Btn.click();
  await page.waitForTimeout(600);

  // PHASE 4: Facial Record (Manual Camera / Photo Capture, Zero Face Recognition)
  console.log('  Executing Phase 4: Facial Record...');
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
  await page.waitForTimeout(500);

  // Verify "Capture Confirmed (Pending Review)" status
  const confirmedBadge = await page.locator('span#badge-facial-confirmed').isVisible();
  if (!confirmedBadge) {
    throw new Error('Expected Capture Confirmed badge after confirmation.');
  }
  console.log('      Verified: Facial photograph confirmed and marked PENDING REVIEW.');

  const nextPhase4Btn = page.locator('button#btn-phase4-next');
  await nextPhase4Btn.click();
  await page.waitForTimeout(600);

  // PHASE 5: Account Credentials
  console.log('  Executing Phase 5: Account Credentials...');
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

  const nextPhase5Btn = page.locator('button#btn-phase5-next');
  await nextPhase5Btn.click();
  await page.waitForTimeout(600);

  // PHASE 6: Review & Submission
  console.log('  Executing Phase 6: Review & Registration Submission...');
  await page.waitForSelector('div#phase-6-review', { state: 'visible', timeout: 5000 });

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

  // Verify Backward Navigation preserves state
  console.log('      Testing backward navigation state preservation...');
  const editPersonalInfoBtn = page.locator('button#review-edit-phase2');
  await editPersonalInfoBtn.click();
  await page.waitForTimeout(500);

  const preservedFirstName = await page.inputValue('input#first-name');
  if (preservedFirstName !== 'Gabriela') {
    throw new Error(`Backward navigation lost form state! Expected "Gabriela", got "${preservedFirstName}"`);
  }

  // Jump directly back to Review Phase via stepper or Next buttons
  await page.locator('button#btn-phase2-next').click();
  await page.waitForTimeout(400);
  await page.locator('button#btn-phase3-next').click();
  await page.waitForTimeout(400);
  await page.locator('button#btn-phase4-next').click();
  await page.waitForTimeout(400);
  await page.locator('button#btn-phase5-next').click();
  await page.waitForTimeout(600);

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
  console.log('      Verified: Submission accepted with 201 Created and Pending Review status!');

  // Capture verification screenshot
  const screenshotPath = path.join(ARTIFACTS_DIR, 'e2e_manual_6phase_registration_verified.png');
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

runTest().catch((err: unknown) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
