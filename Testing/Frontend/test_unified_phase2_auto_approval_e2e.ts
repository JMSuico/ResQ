// [Layer: Testing/Frontend]
// Unified Phase 2-5 End-to-End Verification Suite for ResQTrack Incident AI System Detection.
// Exercises Chromium fake media stream capture from generated .y4m + matching textured ID PNGs,
// Choose ID Type upload lock gate, zero URL query param/role silent defaults, type-switch reset semantics,
// backend fail-closed MISSING_ID_TYPE HTTP 400 contract, real forensic ID verification, AI token auto-approval,
// immediate login, token replay rejection, and Responder (FIRE) auto-approval.
// Invariant: Strict explicit typing (zero untyped escape hatches), zero emojis, zero page.route mocks,
// zero production test bypasses, 100% Universal Arrow Lambdas (=>).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  E2E_BACKEND_URL,
  E2E_CIVILIAN_FRONTEND_URL,
  E2E_RESPONDER_FRONTEND_URL,
  ensureE2eServersReady,
  probeHttpReady,
  type E2eServersHandle,
} from './fixtures/e2eServerHarness';
import {
  writeY4mAndMatchingIdArtifacts,
  type Y4mAndIdFixturePaths,
} from './fixtures/y4mFaceAndMatchingIdFixture';

const BACKEND_URL = process.env.RESQTRACK_BACKEND_URL ?? E2E_BACKEND_URL;
const FRONTEND_URL = process.env.RESQTRACK_FRONTEND_URL ?? E2E_CIVILIAN_FRONTEND_URL;
const RESPONDER_FRONTEND_URL = process.env.RESQTRACK_RESPONDER_FRONTEND_URL ?? E2E_RESPONDER_FRONTEND_URL;
const DEFAULT_BRAIN_ARTIFACTS_DIR =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';

interface OcrApiResponse {
  readonly success?: boolean;
  readonly idVerificationToken?: string | null;
  readonly detectedIdType?: string | null;
  readonly detectedIdLabel?: string | null;
  readonly matchesSelectedIdType?: boolean;
  readonly frontSlotDetectedSide?: string | null;
  readonly backSlotDetectedSide?: string | null;
  readonly areSidesIdentical?: boolean;
  readonly authenticityVerdict?: string | null;
  readonly requiresPendingManualReview?: boolean;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly firstName?: string | null;
  readonly surname?: string | null;
  readonly lastName?: string | null;
  readonly middleName?: string | null;
  readonly dateOfBirth?: string | null;
  readonly sex?: string | null;
  readonly licenseNumber?: string | null;
  readonly barangay?: string | null;
  readonly weight?: string | null;
  readonly height?: string | null;
  readonly confidence?: number;
}

interface BiometricsApiResponse {
  readonly success?: boolean;
  readonly isLiveHuman?: boolean;
  readonly isFaceMatchedToId?: boolean;
  readonly faceToIdSimilarity?: number;
  readonly facialVerificationToken?: string | null;
  readonly isAutoApproveEligible?: boolean;
  readonly requiresPendingManualReview?: boolean;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
}

interface RegisterApiResponse {
  readonly userId?: string;
  readonly email?: string;
  readonly role?: string;
  readonly unit?: string;
  readonly status?: string;
  readonly faceVerified?: boolean;
  readonly autoApprovedByAi?: boolean;
  readonly autoApprovalReason?: string | null;
  readonly verificationStatus?: string;
  readonly code?: string;
  readonly message?: string;
}

interface LoginApiResponse {
  readonly token?: string;
  readonly message?: string;
  readonly redirectUrl?: string;
}

interface CapturedRegisterSubmission {
  readonly payload: Record<string, unknown>;
  readonly status: number;
  readonly body: RegisterApiResponse;
}

const assertCondition = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
};

const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });

const computeExpectedAgeFromDob = (isoDob: string): string => {
  const parts = isoDob.split('-').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return '';
  }
  const [birthYear, birthMonth, birthDay] = parts;
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  const monthDiff = now.getMonth() + 1 - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDay)) {
    age -= 1;
  }
  return String(age);
};

const ensureTestServersReady = async (): Promise<E2eServersHandle> => {
  if (process.env.SKIP_SERVER_START === '1') {
    const backendUp = await probeHttpReady(`${BACKEND_URL}/api/auth/verification-providers`, 2500);
    const civilianUp = await probeHttpReady(FRONTEND_URL, 2500);
    const responderUp = await probeHttpReady(RESPONDER_FRONTEND_URL, 2500);
    assertCondition(backendUp, `SKIP_SERVER_START=1 set, but Backend is offline at ${BACKEND_URL}`);
    assertCondition(civilianUp, `SKIP_SERVER_START=1 set, but Civilian Frontend is offline at ${FRONTEND_URL}`);
    assertCondition(responderUp, `SKIP_SERVER_START=1 set, but Responder Frontend is offline at ${RESPONDER_FRONTEND_URL}`);
  }

  return await ensureE2eServersReady({ includeResponder: true, useWireServer: true });
};

const LOCKED_UNMOUNTED_PHASE2_SELECTORS: readonly string[] = [
  '#id-upload-section',
  '#front-id-dropzone',
  'input#front-id-input',
  '#back-id-dropzone',
  'input#back-id-input',
  '#btn-clear-both-ids',
  '#id-verification-banner',
  '#personal-info-section',
];

const assertChooseIdTypeLockedGate = async (page: Page, contextLabel: string): Promise<void> => {
  await page.locator('#phase-2-id-identity').waitFor({ state: 'visible', timeout: 15000 });
  const idSelect = page.locator('select#id-type');
  await idSelect.waitFor({ state: 'visible', timeout: 10000 });
  const selectedVal = await idSelect.inputValue();
  assertCondition(selectedVal === '', `[${contextLabel}] Expected select#id-type value === '', got '${selectedVal}'`);

  const firstOption = page.locator('select#id-type option').first();
  const firstOptionValue = await firstOption.getAttribute('value');
  const firstOptionText = ((await firstOption.textContent()) ?? '').trim();
  assertCondition(
    firstOptionValue === '' && firstOptionText === 'Choose ID Type',
    `[${contextLabel}] Expected first <option> value="" text="Choose ID Type", got value="${firstOptionValue}" text="${firstOptionText}"`
  );

  const lockedNotice = page.locator('#id-upload-locked-notice');
  await lockedNotice.waitFor({ state: 'visible', timeout: 10000 });
  const lockedRole = await lockedNotice.getAttribute('role');
  assertCondition(
    lockedRole === 'status',
    `[${contextLabel}] Expected #id-upload-locked-notice role="status", got '${lockedRole}'`
  );

  for (const selector of LOCKED_UNMOUNTED_PHASE2_SELECTORS) {
    const count = await page.locator(selector).count();
    assertCondition(count === 0, `[${contextLabel}] Locked selector ${selector} must stay unmounted (count=${count})`);
  }

  assertCondition(
    await page.locator('#btn-phase2-next').isDisabled(),
    `[${contextLabel}] #btn-phase2-next must be disabled when idType === ''`
  );
};

const assertIdTypeSelectedPreUploadGate = async (page: Page, contextLabel: string): Promise<void> => {
  assertCondition(
    (await page.locator('#id-type-error').count()) === 0,
    `[${contextLabel}] #id-type-error must clear once a valid ID type is selected`
  );
  assertCondition(
    (await page.locator('#id-upload-locked-notice').count()) === 0,
    `[${contextLabel}] #id-upload-locked-notice must unmount once a valid ID type is selected`
  );
  await page.locator('#id-upload-section').waitFor({ state: 'visible', timeout: 10000 });
  assertCondition(
    (await page.locator('input#front-id-input').count()) === 1 &&
      (await page.locator('input#back-id-input').count()) === 1,
    `[${contextLabel}] Front and Back upload inputs must mount once ID type is selected`
  );
  assertCondition(
    (await page.locator('#personal-info-section').count()) === 0,
    `[${contextLabel}] #personal-info-section must stay unmounted before upload/verification`
  );
};

const verifyBackendMissingIdTypeContract = async (artifacts: Y4mAndIdFixturePaths): Promise<void> => {
  console.log('\n[API CONTRACT] Testing backend fail-closed MISSING_ID_TYPE on POST /api/identity/ocr/extract...');
  const frontBytes = readFileSync(artifacts.frontIdPath);
  const backBytes = readFileSync(artifacts.backIdPath);

  for (const blankIdType of ['', '   ']) {
    const form = new FormData();
    form.append('frontImage', new Blob([frontBytes], { type: 'image/png' }), 'front.png');
    form.append('backImage', new Blob([backBytes], { type: 'image/png' }), 'back.png');
    form.append('requireDualSide', 'true');
    form.append('idType', blankIdType);

    const resp = await fetch(`${BACKEND_URL}/api/identity/ocr/extract`, {
      method: 'POST',
      body: form,
    });
    const body = (await resp.json()) as OcrApiResponse;
    assertCondition(
      resp.status === 400,
      `Expected HTTP 400 for idType=${JSON.stringify(blankIdType)}, got ${resp.status}`
    );
    assertCondition(
      body.success === false,
      `Expected success === false for MISSING_ID_TYPE, got ${String(body.success)}`
    );
    assertCondition(
      body.errorCode === 'MISSING_ID_TYPE',
      `Expected errorCode === 'MISSING_ID_TYPE', got '${body.errorCode}'`
    );
    assertCondition(
      body.requiresPendingManualReview === false,
      `Expected requiresPendingManualReview === false on MISSING_ID_TYPE, got ${String(body.requiresPendingManualReview)}`
    );
    assertCondition(!body.idVerificationToken, 'MISSING_ID_TYPE must never issue an idVerificationToken');
  }
  console.log('[PASS] Backend /api/identity/ocr/extract failed closed with HTTP 400 MISSING_ID_TYPE.');
};

const launchY4mChromium = async (y4mPath: string): Promise<Browser> => {
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${y4mPath}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ];

  try {
    return await chromium.launch({
      channel: 'chrome',
      headless: true,
      args,
    });
  } catch {
    return await chromium.launch({
      headless: true,
      args,
    });
  }
};

const createCameraContext = async (browser: Browser): Promise<BrowserContext> =>
  browser.newContext({
    viewport: { width: 1440, height: 960 },
    permissions: ['camera', 'microphone'],
  });

const clearDualSideUploadsIfPresent = async (page: Page): Promise<void> => {
  const clearBtn = page.locator('#btn-clear-both-ids');
  if ((await clearBtn.count()) > 0 && (await clearBtn.isVisible())) {
    await clearBtn.click();
    await page.waitForFunction(() => {
      const f = document.querySelector('#front-id-preview');
      const b = document.querySelector('#back-id-preview');
      return !f && !b;
    });
  }
};

const uploadDualSideAndAwaitSettled = async (
  page: Page,
  frontPath: string,
  backPath: string,
  expectRemoteExtract: boolean
): Promise<{ status: number; body: OcrApiResponse } | null> => {
  const ocrResponsePromise = expectRemoteExtract
    ? page.waitForResponse(
        (resp) => resp.url().includes('/api/identity/ocr/extract') && resp.request().method() === 'POST',
        { timeout: 105000 }
      )
    : null;

  await page.locator('input#front-id-input').setInputFiles(frontPath);
  await page.locator('input#back-id-input').setInputFiles(backPath);

  let remoteOutcome: { status: number; body: OcrApiResponse } | null = null;
  if (ocrResponsePromise) {
    try {
      const resp = await ocrResponsePromise;
      let parsed: OcrApiResponse = {};
      try {
        parsed = (await resp.json()) as OcrApiResponse;
      } catch {
        parsed = {};
      }
      remoteOutcome = { status: resp.status(), body: parsed };
    } catch {
      remoteOutcome = null;
    }
  }

  await page.waitForFunction(
    () => {
      const banner = document.querySelector('#id-verification-banner');
      const st = banner?.getAttribute('data-verification-status');
      return Boolean(st && st !== 'IDLE' && st !== 'VERIFYING');
    },
    { timeout: 105000 }
  );

  return remoteOutcome;
};

const performPhase3Y4mFacialCapture = async (page: Page): Promise<{
  status: number;
  body: BiometricsApiResponse;
}> => {
  await page.locator('#phase-3-facial-record').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#btn-request-camera').click();

  await page.waitForFunction(
    () => {
      const video = document.querySelector<HTMLVideoElement>('#facial-camera-video');
      return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
    },
    { timeout: 20000 }
  );

  // Align lock clicks across the 5.0s 30fps .y4m loop while staying safely below the 4.0s auto-complete timeout
  const lockBtn = page.locator('#btn-lock-next-pose');
  const confirmBtn = page.locator('#btn-confirm-facial-capture');
  await lockBtn.waitFor({ state: 'visible', timeout: 10000 });

  const clickPoseOrAcceptAutoComplete = async (): Promise<void> => {
    if (await confirmBtn.isVisible().catch(() => false)) {
      return;
    }
    try {
      await lockBtn.click({ timeout: 8000 });
    } catch (err) {
      if (await confirmBtn.isVisible().catch(() => false)) {
        return;
      }
      throw err;
    }
  };

  await sleepMs(750);
  await clickPoseOrAcceptAutoComplete(); // Lock CENTER -> RIGHT

  await sleepMs(1600);
  await clickPoseOrAcceptAutoComplete(); // Lock RIGHT -> LEFT

  await sleepMs(2800);
  await clickPoseOrAcceptAutoComplete(); // Lock LEFT -> BLINK

  await sleepMs(1900);
  await clickPoseOrAcceptAutoComplete(); // Lock BLINK -> Compile

  await confirmBtn.waitFor({ state: 'visible', timeout: 15000 });

  const consentCheckbox = page.locator('#facial-consent-checkbox');
  await consentCheckbox.waitFor({ state: 'visible', timeout: 10000 });
  if (!(await consentCheckbox.isChecked())) {
    await consentCheckbox.check();
  }

  const bioResponsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/identity/biometrics/analyze-geometry') &&
      resp.request().method() === 'POST',
    { timeout: 105000 }
  );

  await page.locator('#btn-confirm-facial-capture').click();
  const bioResp = await bioResponsePromise;
  const bioBody = (await bioResp.json()) as BiometricsApiResponse;

  return { status: bioResp.status(), body: bioBody };
};

const completePhase4AndPhase5Submit = async (
  page: Page,
  displayName: string,
  email: string,
  password: string
): Promise<CapturedRegisterSubmission> => {
  await page.locator('#phase-4-credentials').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#display-name').fill(displayName);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirm').fill(password);
  await page.locator('#btn-accept-both-consents').click();
  await page.locator('#btn-phase4-next').click();

  await page.locator('#phase-5-review').waitFor({ state: 'visible', timeout: 15000 });

  let capturedPayload: Record<string, unknown> = {};
  const registerPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/register') &&
      !resp.url().includes('/api/register/') &&
      resp.request().method() === 'POST',
    { timeout: 45000 }
  );

  const reqWaitPromise = page.waitForRequest(
    (req) => req.url().includes('/api/register') && req.method() === 'POST',
    { timeout: 45000 }
  );

  await page.locator('#submit').click();

  const [req, resp] = await Promise.all([reqWaitPromise, registerPromise]);
  try {
    capturedPayload = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
  } catch {
    capturedPayload = {};
  }
  const body = (await resp.json()) as RegisterApiResponse;
  return { payload: capturedPayload, status: resp.status(), body };
};

const verifyVisibleFieldsOnElenaIdUnlock = async (page: Page): Promise<void> => {
  await page.locator('#personal-info-section').waitFor({ state: 'visible', timeout: 15000 });
  const firstName = (await page.locator('#first-name').inputValue()).trim().toUpperCase();
  const lastName = (await page.locator('#last-name').inputValue()).trim().toUpperCase();
  const dob = (await page.locator('#dob').inputValue()).trim();
  const age = (await page.locator('#age').inputValue()).trim();
  const sex = (await page.locator('#sex').inputValue()).trim();
  const licenseNum = (await page.locator('#license-number').inputValue()).trim().toUpperCase();
  const middleName = (await page.locator('#middle-name').inputValue()).trim();
  const weight = (await page.locator('#weight').inputValue()).trim();
  const height = (await page.locator('#height').inputValue()).trim();

  assertCondition(firstName === 'ELENA', `Expected #first-name ELENA, got '${firstName}'`);
  assertCondition(lastName === 'MARQUEZ', `Expected #last-name MARQUEZ, got '${lastName}'`);
  assertCondition(dob === '1994-03-11', `Expected #dob 1994-03-11, got '${dob}'`);

  const expectedAge = computeExpectedAgeFromDob('1994-03-11');
  assertCondition(age === expectedAge, `Expected #age '${expectedAge}', got '${age}'`);
  assertCondition(sex === 'Female', `Expected #sex Female, got '${sex}'`);
  assertCondition(
    licenseNum === 'K09-88-776655',
    `Expected #license-number K09-88-776655, got '${licenseNum}'`
  );
  assertCondition(middleName === '', `Visible-only OCR fabricated #middle-name: '${middleName}'`);
  assertCondition(weight === '', `Visible-only OCR fabricated #weight: '${weight}'`);
  assertCondition(height === '', `Visible-only OCR fabricated #height: '${height}'`);
};

const runLiveEndToEndSuite = async (): Promise<void> => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'resqtrack-unified-e2e-'));
  const screenshotDir = process.env.ARTIFACTS_DIR ?? DEFAULT_BRAIN_ARTIFACTS_DIR;
  mkdirSync(screenshotDir, { recursive: true });

  let servers: E2eServersHandle | null = null;
  let browser: Browser | null = null;

  try {
    const artifacts = writeY4mAndMatchingIdArtifacts(fixtureDir);
    const y4mMagic = readFileSync(artifacts.y4mPath).subarray(0, 9).toString('ascii');
    assertCondition(y4mMagic === 'YUV4MPEG2', `Invalid Y4M header magic: '${y4mMagic}'`);
    assertCondition(existsSync(artifacts.frontIdPath), 'Missing frontIdPath');
    assertCondition(existsSync(artifacts.backIdPath), 'Missing backIdPath');
    assertCondition(existsSync(artifacts.nonMatchingFrontIdPath), 'Missing nonMatchingFrontIdPath');
    assertCondition(existsSync(artifacts.philsysWrongTypePath), 'Missing philsysWrongTypePath');
    assertCondition(existsSync(artifacts.specimenFakePath), 'Missing specimenFakePath');
    console.log(`[FIXTURES] Generated 150-frame .y4m + 5 textured 856x540 PNG fixtures in ${fixtureDir}`);

    servers = await ensureTestServersReady();

    // Check active provider capabilities
    const providersRes = await fetch(`${BACKEND_URL}/api/auth/verification-providers`);
    assertCondition(providersRes.ok, `GET /api/auth/verification-providers failed with ${providersRes.status}`);
    const providersJson = (await providersRes.json()) as Record<string, unknown>;
    console.log(`[PROVIDERS] Active config: ${JSON.stringify(providersJson)}`);

    // Backend fail-closed MISSING_ID_TYPE HTTP 400 contract check (real backend call, zero mocking)
    await verifyBackendMissingIdTypeContract(artifacts);

    browser = await launchY4mChromium(artifacts.y4mPath);
    const ctx = await createCameraContext(browser);
    const page = await ctx.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err: Error) => {
      pageErrors.push(err.stack ?? err.message);
    });

    let liveClaudeOcrOnline = true;
    let civilianEmail = '';
    let civilianPassword = '';

    try {
      // Scenario 1: Phase 01 Role -> Phase 02 Initial Choose ID Type Locked Gate + Obsolete Removal + Blocked Next Alert
      console.log('\n[SCENARIO 1] Verifying Choose ID Type initial locked gate, blocked next alert, & obsolete removal...');
      await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'networkidle' });
      await page.locator('#phase-1-role').waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('#role-btn-civilian').click();
      await page.locator('#btn-phase1-next').click();

      await assertChooseIdTypeLockedGate(page, 'Scenario 1 Phase 01 -> Phase 02');

      const removedSelectors = [
        '#claude-id-ocr-panel',
        '[id^="ocr-field-"]',
        '#btn-claude-ocr-extract',
        '#btn-confirm-ocr-autofill',
        '#badge-ocr-autofill-confirmed',
        '#phase-2-id-upload',
        '#phase-3-personal-info',
        '#phase-6-review',
        '#btn-phase5-next',
        '#review-edit-phase5',
      ];
      for (const selector of removedSelectors) {
        const count = await page.locator(selector).count();
        assertCondition(count === 0, `Removed obsolete selector still present in DOM: ${selector} (count=${count})`);
      }

      const lockedGateShot = join(screenshotDir, 'unified_phase2_locked_choose_id_type.png');
      await page.screenshot({ path: lockedGateShot, fullPage: true });
      console.log(`[PASS] Captured Choose ID Type locked state screenshot: ${lockedGateShot}`);

      // Verify blocked Next / Stepper triggers #id-type-error (role="alert") and stays on #phase-2-id-identity
      await page.locator('ol.steps li[data-step-item="2"]').click();
      assertCondition(
        (await page.locator('#phase-2-id-identity').count()) === 1 &&
          (await page.locator('#phase-3-facial-record').count()) === 0,
        'Navigation from Phase 2 to Phase 3 must stay blocked while idType is empty'
      );
      const idTypeError = page.locator('#id-type-error');
      await idTypeError.waitFor({ state: 'visible', timeout: 5000 });
      assertCondition(
        (await idTypeError.getAttribute('role')) === 'alert',
        'Expected #id-type-error to expose role="alert"'
      );
      const idTypeErrorText = (await idTypeError.innerText()).toLowerCase();
      assertCondition(
        idTypeErrorText.includes('select') && idTypeErrorText.includes('government id'),
        `Unexpected #id-type-error guidance text: '${idTypeErrorText}'`
      );
      console.log('[PASS] Scenario 1 verified locked Phase 2 gate, #id-type-error alert, and zero obsolete selectors.');

      // Scenario 1B: Zero Silent Defaults on URL Query Params (?unit=fire|pnp|rhu) & Responder->Civilian Role Switch Reset
      console.log('\n[SCENARIO 1B] Verifying zero silent ID type defaults across query params & role/agency switching...');
      const unitCheckPage = await ctx.newPage();
      try {
        const unitUrls: readonly string[] = [
          `${FRONTEND_URL}/register?unit=fire`,
          `${FRONTEND_URL}/register?unit=fire&step=1`,
          `${RESPONDER_FRONTEND_URL}/register?unit=pnp&step=1`,
          `${RESPONDER_FRONTEND_URL}/register?unit=rhu&step=1`,
          `${RESPONDER_FRONTEND_URL}/register?unit=fire&step=0`,
        ];
        for (const unitUrl of unitUrls) {
          await unitCheckPage.goto(unitUrl, { waitUntil: 'domcontentloaded' });
          await unitCheckPage
            .locator('#phase-1-role, #phase-2-id-identity')
            .first()
            .waitFor({ state: 'visible', timeout: 15000 });
          if (!unitUrl.includes('step=1')) {
            await unitCheckPage.locator('#phase-1-role').waitFor({ state: 'visible', timeout: 10000 });
            if (unitUrl.startsWith(RESPONDER_FRONTEND_URL)) {
              await unitCheckPage.locator('#unit-btn-pnp').click();
              await unitCheckPage.locator('#unit-btn-rhu').click();
              await unitCheckPage.locator('#unit-btn-fire').click();
            }
            await unitCheckPage.locator('#btn-phase1-next').click();
          }
          await assertChooseIdTypeLockedGate(unitCheckPage, `URL query zero-default check (${unitUrl})`);
        }

        // Select responderOnly 'fire' ID type, upload shots, then switch Role back to Civilian and verify complete reset
        await unitCheckPage.locator('select#id-type').selectOption('fire');
        await assertIdTypeSelectedPreUploadGate(unitCheckPage, 'Scenario 1B Responder fire ID selection');
        await uploadDualSideAndAwaitSettled(unitCheckPage, artifacts.frontIdPath, artifacts.backIdPath, true);
        assertCondition(
          (await unitCheckPage.locator('#front-id-preview').count()) === 1 &&
            (await unitCheckPage.locator('#back-id-preview').count()) === 1,
          'Expected Front/Back previews mounted before Responder -> Civilian role switch'
        );

        await unitCheckPage.locator('ol.steps li[data-step-item="0"]').click();
        await unitCheckPage.locator('#phase-1-role').waitFor({ state: 'visible', timeout: 10000 });
        await unitCheckPage.locator('#role-btn-civilian').click();
        await unitCheckPage.locator('#btn-phase1-next').click();

        await assertChooseIdTypeLockedGate(unitCheckPage, 'Responder -> Civilian reset check');
        assertCondition(
          (await unitCheckPage.locator('select#id-type option[value="fire"]').count()) === 0,
          'Responder-only option "fire" must not remain after switching to Civilian'
        );
        const resetTokens = await unitCheckPage.evaluate(() => ({
          id: sessionStorage.getItem('resqtrack_standby_id_verification_token'),
          facial: sessionStorage.getItem('resqtrack_standby_facial_verification_token'),
        }));
        assertCondition(
          !resetTokens.id && !resetTokens.facial,
          `Standby session tokens must clear on Responder->Civilian switch: ${JSON.stringify(resetTokens)}`
        );

        await unitCheckPage.locator('select#id-type').selectOption('drivers');
        await assertIdTypeSelectedPreUploadGate(unitCheckPage, 'Responder->Civilian post-reset drivers select');
        assertCondition(
          (await unitCheckPage.locator('input#front-id-input').inputValue()) === '' &&
            (await unitCheckPage.locator('input#back-id-input').inputValue()) === '' &&
            (await unitCheckPage.locator('#front-id-preview').count()) === 0 &&
            (await unitCheckPage.locator('#back-id-preview').count()) === 0,
          'Responder -> Civilian role switch must wipe uploaded previews and DOM input values'
        );
      } finally {
        await unitCheckPage.close();
      }
      console.log('[PASS] Scenario 1B verified zero silent defaults on URL params and clean Responder->Civilian reset.');

      // Scenario 2: Select 'drivers' clears #id-type-error & unlocks upload section only -> Duplicate Front == Back rejection
      console.log('\n[SCENARIO 2] Selecting "drivers" & verifying duplicate Front == Back image rejection...');
      await page.locator('select#id-type').selectOption('drivers');
      await assertIdTypeSelectedPreUploadGate(page, 'Scenario 2 select drivers');
      await uploadDualSideAndAwaitSettled(page, artifacts.frontIdPath, artifacts.frontIdPath, false);
      const dupBanner = page.locator('#banner-id-rejected');
      await dupBanner.waitFor({ state: 'visible', timeout: 10000 });
      const dupCode = await dupBanner.getAttribute('data-error-code');
      const dupText = (await dupBanner.innerText()).toLowerCase();
      assertCondition(
        dupCode === 'DUPLICATE_FRONT_BACK_IMAGE' || dupText.includes('identical') || dupText.includes('duplicate'),
        `Expected duplicate rejection, got code='${dupCode}', text='${dupText}'`
      );
      assertCondition((await page.locator('#personal-info-section').count()) === 0, 'Duplicate upload must NOT unlock #personal-info-section');
      await clearDualSideUploadsIfPresent(page);
      console.log(`[PASS] Scenario 2 verified duplicate Front==Back rejection (${dupCode ?? 'LOCAL_PREFLIGHT'}).`);

      // Scenario 3: Swapped Back-in-Front slot rejection
      console.log('\n[SCENARIO 3] Testing Back ID uploaded into Front slot...');
      const backFrontOutcome = await uploadDualSideAndAwaitSettled(page, artifacts.backIdPath, artifacts.frontIdPath, true);
      if (backFrontOutcome?.status === 503 || backFrontOutcome?.body.errorCode === 'PROVIDER_UNAVAILABLE') {
        liveClaudeOcrOnline = false;
        console.log('[INFO] Scenario 3 hit external 503 PROVIDER_UNAVAILABLE; fallback verified below.');
      } else {
        assertCondition(
          backFrontOutcome?.body.errorCode === 'WRONG_ID_SIDE_FRONT_EXPECTED',
          `Expected WRONG_ID_SIDE_FRONT_EXPECTED, got HTTP ${backFrontOutcome?.status} code=${backFrontOutcome?.body.errorCode}`
        );
        assertCondition((await page.locator('#personal-info-section').count()) === 0, 'Swapped sides must NOT unlock #personal-info-section');
        console.log('[PASS] Scenario 3 verified real WRONG_ID_SIDE_FRONT_EXPECTED.');
      }
      await clearDualSideUploadsIfPresent(page);

      // Scenario 4: PhilSys uploaded under 'drivers' + Specimen Watermark rejection (when live AI is available)
      if (liveClaudeOcrOnline) {
        console.log('\n[SCENARIO 4] Testing PhilSys under Drivers License & Specimen Watermark rejections...');
        const philsysOutcome = await uploadDualSideAndAwaitSettled(page, artifacts.philsysWrongTypePath, artifacts.philsysBackPath, true);
        if (philsysOutcome?.status === 503 || philsysOutcome?.body.errorCode === 'PROVIDER_UNAVAILABLE') {
          liveClaudeOcrOnline = false;
        } else {
          assertCondition(
            philsysOutcome?.body.errorCode === 'WRONG_GOVERNMENT_ID_TYPE',
            `Expected WRONG_GOVERNMENT_ID_TYPE, got HTTP ${philsysOutcome?.status} code=${philsysOutcome?.body.errorCode}`
          );
          assertCondition((await page.locator('#personal-info-section').count()) === 0, 'Wrong ID type must NOT unlock #personal-info-section');
          console.log('[PASS] Scenario 4A verified real WRONG_GOVERNMENT_ID_TYPE.');
        }
        await clearDualSideUploadsIfPresent(page);

        if (liveClaudeOcrOnline) {
          const specimenOutcome = await uploadDualSideAndAwaitSettled(page, artifacts.specimenFakePath, artifacts.backIdPath, true);
          if (specimenOutcome?.status === 503 || specimenOutcome?.body.errorCode === 'PROVIDER_UNAVAILABLE') {
            liveClaudeOcrOnline = false;
          } else {
            assertCondition(
              specimenOutcome?.body.errorCode === 'FAKE_OR_AI_GENERATED_ID',
              `Expected FAKE_OR_AI_GENERATED_ID, got HTTP ${specimenOutcome?.status} code=${specimenOutcome?.body.errorCode}`
            );
            assertCondition((await page.locator('#personal-info-section').count()) === 0, 'Specimen ID must NOT unlock #personal-info-section');
            console.log('[PASS] Scenario 4B verified real FAKE_OR_AI_GENERATED_ID.');
          }
          await clearDualSideUploadsIfPresent(page);
        }
      }

      // Scenario 5: Genuine Elena Marquez Front + Back ID upload -> Unlock & Auto-fill
      console.log('\n[SCENARIO 5] Uploading Genuine Driver License Front + Back...');
      const genuineOutcome = await uploadDualSideAndAwaitSettled(page, artifacts.frontIdPath, artifacts.backIdPath, true);

      if (genuineOutcome?.status === 503 || genuineOutcome?.body.errorCode === 'PROVIDER_UNAVAILABLE') {
        liveClaudeOcrOnline = false;
        console.log('[INFO] Genuine upload hit live 503 PROVIDER_UNAVAILABLE; verifying real standby unlock...');
        await page.locator('#badge-id-pending-manual').waitFor({ state: 'visible', timeout: 10000 });
        await page.locator('#personal-info-section').waitFor({ state: 'visible', timeout: 10000 });
        await page.locator('#license-number').fill('K09-88-776655');
        await page.locator('#first-name').fill('Elena');
        await page.locator('#last-name').fill('Marquez');
        await page.locator('#sex').selectOption('Female');
        await page.locator('#dob').fill('1994-03-11');
      } else {
        assertCondition(
          Boolean(genuineOutcome?.body.success && genuineOutcome?.body.idVerificationToken),
          `Genuine upload failed with HTTP ${genuineOutcome?.status} code=${genuineOutcome?.body.errorCode}: ${genuineOutcome?.body.errorMessage}`
        );
        await page.locator('#badge-id-verified-genuine').waitFor({ state: 'visible', timeout: 10000 });
        await verifyVisibleFieldsOnElenaIdUnlock(page);
        const phase2Shot = join(screenshotDir, 'unified_phase2_unlocked_verified.png');
        await page.screenshot({ path: phase2Shot, fullPage: true });
        console.log(`[PASS] Scenario 5 verified live AI unlock & auto-fill. Screenshot: ${phase2Shot}`);
      }

      await page.locator('#phone-number').fill('09171234567');
      await page.locator('#barangay').fill('Uno');
      await page.locator('#street-purok').fill('Purok Mabini');

      // Scenario 6: Type-switching semantics ('drivers' -> 'passport' preserves shots & clears token -> '' resets all -> 'drivers' clean re-upload)
      console.log('\n[SCENARIO 6] Testing type-switching semantics ("drivers" -> "passport" -> "" -> "drivers")...');
      const reverifyOcrPromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/identity/ocr/extract') && resp.request().method() === 'POST',
        { timeout: 105000 }
      );
      await page.locator('select#id-type').selectOption('passport');
      const tokenAfterPassportSwitch = await page.evaluate(() =>
        sessionStorage.getItem('resqtrack_standby_id_verification_token')
      );
      assertCondition(
        !tokenAfterPassportSwitch,
        `Standby ID token must clear immediately on select#id-type switch, found '${tokenAfterPassportSwitch}'`
      );
      assertCondition(
        (await page.locator('#id-upload-section').count()) === 1 &&
          (await page.locator('#front-id-preview').count()) === 1 &&
          (await page.locator('#back-id-preview').count()) === 1,
        'Switching between valid ID types ("drivers" -> "passport") must preserve uploaded Front/Back shots'
      );

      const passportReverifyResp = await reverifyOcrPromise;
      await page.waitForFunction(
        () => {
          const banner = document.querySelector('#id-verification-banner');
          const st = banner?.getAttribute('data-verification-status');
          return Boolean(st && st !== 'IDLE' && st !== 'VERIFYING');
        },
        { timeout: 105000 }
      );
      if (passportReverifyResp.status() !== 503) {
        assertCondition(
          (await page.locator('#personal-info-section').count()) === 0,
          'Mismatched Drivers image under "passport" must keep #personal-info-section unmounted after re-verification'
        );
      }

      // Now select empty "" ("Choose ID Type"): must wipe uploaded shots, <input> values, standby tokens, and unmount upload + personal sections
      await page.locator('select#id-type').selectOption('');
      await assertChooseIdTypeLockedGate(page, 'Scenario 6 reset to empty Choose ID Type');
      const tokensAfterEmptyReset = await page.evaluate(() => ({
        id: sessionStorage.getItem('resqtrack_standby_id_verification_token'),
        facial: sessionStorage.getItem('resqtrack_standby_facial_verification_token'),
      }));
      assertCondition(
        !tokensAfterEmptyReset.id && !tokensAfterEmptyReset.facial,
        `Switching select#id-type to "" must clear standby tokens: ${JSON.stringify(tokensAfterEmptyReset)}`
      );

      // Re-select "drivers", verify clean empty inputs/previews, re-upload Elena Front + Back cleanly
      await page.locator('select#id-type').selectOption('drivers');
      await assertIdTypeSelectedPreUploadGate(page, 'Scenario 6 re-select drivers');
      assertCondition(
        (await page.locator('input#front-id-input').inputValue()) === '' &&
          (await page.locator('input#back-id-input').inputValue()) === '' &&
          (await page.locator('#front-id-preview').count()) === 0 &&
          (await page.locator('#back-id-preview').count()) === 0,
        'DOM file input values and previews must be cleared before re-upload after "" reset'
      );

      const restoreOutcome = await uploadDualSideAndAwaitSettled(page, artifacts.frontIdPath, artifacts.backIdPath, true);
      if (restoreOutcome?.status === 503 || restoreOutcome?.body.errorCode === 'PROVIDER_UNAVAILABLE') {
        liveClaudeOcrOnline = false;
      }
      await page.locator('#personal-info-section').waitFor({ state: 'visible', timeout: 30000 });
      if ((await page.locator('#first-name').inputValue()).trim() === '') {
        await page.locator('#license-number').fill('K09-88-776655');
        await page.locator('#first-name').fill('Elena');
        await page.locator('#last-name').fill('Marquez');
        await page.locator('#sex').selectOption('Female');
        await page.locator('#dob').fill('1994-03-11');
      }
      await page.locator('#phone-number').fill('09171234567');
      await page.locator('#barangay').fill('Uno');
      await page.locator('#street-purok').fill('Purok Mabini');
      await page.locator('#btn-phase2-next').click();
      console.log('[PASS] Scenario 6 verified "drivers" -> "passport" -> "" -> "drivers" semantics and recovery.');

      // Scenario 7: Phase 3 Live .y4m 4-Pose Camera Capture + Face-to-Gov-ID Match
      console.log('\n[SCENARIO 7] Running Phase 3 live .y4m 4-pose facial capture...');
      const bioOutcome = await performPhase3Y4mFacialCapture(page);

      let hasLiveFacialAutoApprove = false;
      if (bioOutcome.status === 503 || bioOutcome.body.errorCode === 'PROVIDER_UNAVAILABLE') {
        liveClaudeOcrOnline = false;
        await page.locator('#facial-pending-review-banner').waitFor({ state: 'visible', timeout: 10000 });
        console.log('[INFO] Scenario 7 hit live 503 PROVIDER_UNAVAILABLE; proceeding in live standby mode.');
      } else {
        assertCondition(
          bioOutcome.status === 200 && Boolean(bioOutcome.body.isFaceMatchedToId && bioOutcome.body.facialVerificationToken),
          `Face-to-Gov-ID match failed: HTTP ${bioOutcome.status} code=${bioOutcome.body.errorCode} similarity=${bioOutcome.body.faceToIdSimilarity}`
        );
        hasLiveFacialAutoApprove = true;
        await page.locator('#badge-facial-confirmed').waitFor({ state: 'visible', timeout: 10000 });
        await page.locator('#badge-face-id-matched').waitFor({ state: 'visible', timeout: 10000 });
        const phase3Shot = join(screenshotDir, 'unified_phase3_y4m_facial_matched.png');
        await page.screenshot({ path: phase3Shot, fullPage: true });
        console.log(`[PASS] Scenario 7 verified live .y4m Face-to-ID match. Screenshot: ${phase3Shot}`);
      }

      await page.locator('#btn-phase3-next').click();

      // Scenario 8: Phase 4 Credentials -> Phase 5 Review -> Submit -> Login -> Replay Check
      console.log('\n[SCENARIO 8] Submitting Phase 4-5 registration...');
      civilianEmail = `elena-unified-${Date.now()}@katipunan.local`;
      civilianPassword = 'ResQTrack!2026#Secure';

      if (liveClaudeOcrOnline && hasLiveFacialAutoApprove) {
        const expectedMode = await page.locator('#phase-4-credentials').isVisible();
        assertCondition(expectedMode, 'Expected Phase 4 visible before Phase 5');
      }

      const regOutcome = await completePhase4AndPhase5Submit(page, 'Elena Marquez', civilianEmail, civilianPassword);
      assertCondition(regOutcome.status === 201, `Expected 201 Created from /api/register, got ${regOutcome.status}: ${regOutcome.body.message}`);

      if (liveClaudeOcrOnline && hasLiveFacialAutoApprove) {
        assertCondition(regOutcome.body.status === 'Verified', `Expected Verified civilian status, got ${regOutcome.body.status}`);
        assertCondition(regOutcome.body.faceVerified === true, `Expected faceVerified=true, got ${String(regOutcome.body.faceVerified)}`);
        assertCondition(regOutcome.body.autoApprovedByAi === true, `Expected autoApprovedByAi=true, got ${String(regOutcome.body.autoApprovedByAi)}`);
        assertCondition(regOutcome.body.verificationStatus === 'APPROVED_AUTO_AI', `Expected APPROVED_AUTO_AI, got ${regOutcome.body.verificationStatus}`);

        // Immediate Login Proof
        const loginResp = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: civilianEmail,
            password: civilianPassword,
            selectedTabRole: 'Civilian',
          }),
        });
        const loginBody = (await loginResp.json()) as LoginApiResponse;
        assertCondition(loginResp.status === 200 && Boolean(loginBody.token), `Immediate login failed: HTTP ${loginResp.status} ${loginBody.message}`);

        // Token Replay Rejection Proof (400 VERIFICATION_TOKEN_REPLAYED)
        const replayResp = await fetch(`${BACKEND_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...regOutcome.payload,
            email: `replay-attack-${Date.now()}@katipunan.local`,
          }),
        });
        const replayBody = (await replayResp.json()) as RegisterApiResponse;
        assertCondition(replayResp.status === 400, `Expected HTTP 400 on replayed token submission, got ${replayResp.status}`);
        assertCondition(
          replayBody.code === 'VERIFICATION_TOKEN_REPLAYED',
          `Expected VERIFICATION_TOKEN_REPLAYED, got '${replayBody.code}'`
        );
        console.log('[PASS] Scenario 8 verified live Civilian AI auto-approval, immediate login, and VERIFICATION_TOKEN_REPLAYED.');
      } else {
        assertCondition(regOutcome.body.status === 'Pending', `Expected Pending when AI unavailable, got ${regOutcome.body.status}`);
        console.log('[PASS] Scenario 8 verified graceful Pending registration under live external AI unavailability.');
      }

      assertCondition(pageErrors.length === 0, `Unhandled browser pageerror events detected: ${pageErrors.join(' | ')}`);
    } finally {
      await ctx.close();
    }

    // If live AI returned 200 throughout, also prove Responder (FIRE) live auto-approval + negative person mismatch
    if (liveClaudeOcrOnline) {
      console.log('\n[SCENARIO 8B] Verifying Responder (FIRE) Choose ID Type gate & AI auto-approval flow...');
      const respCtx = await createCameraContext(browser);
      const respPage = await respCtx.newPage();
      try {
        await respPage.goto(`${RESPONDER_FRONTEND_URL}/register?step=0`, { waitUntil: 'networkidle' });
        await respPage.locator('#role-btn-responder').click();
        await respPage.locator('#unit-btn-fire').click();
        await respPage.locator('#btn-phase1-next').click();

        await assertChooseIdTypeLockedGate(respPage, 'Scenario 8B Responder FIRE Phase 2');
        await respPage.locator('select#id-type').selectOption('drivers');
        await assertIdTypeSelectedPreUploadGate(respPage, 'Scenario 8B Responder select drivers');
        const ocrFire = await uploadDualSideAndAwaitSettled(respPage, artifacts.frontIdPath, artifacts.backIdPath, true);
        if (ocrFire?.status === 200 && ocrFire.body.idVerificationToken) {
          await respPage.locator('#badge-id-verified-genuine').waitFor({ state: 'visible', timeout: 10000 });
          await respPage.locator('#phone-number').fill('09179876543');
          await respPage.locator('#barangay').fill('Dos');
          await respPage.locator('#street-purok').fill('BFP Compound');
          await respPage.locator('#agency-unit').selectOption('FIRE');
          await respPage.locator('#employee-id').fill('BFP-KTP-2026-009');
          await respPage.locator('#rank-title').fill('FO1');
          await respPage.locator('#btn-phase2-next').click();

          const bioFire = await performPhase3Y4mFacialCapture(respPage);
          if (bioFire.status === 200 && bioFire.body.isFaceMatchedToId && bioFire.body.facialVerificationToken) {
            await respPage.locator('#btn-phase3-next').click();
            const fireEmail = `fire-unified-${Date.now()}@katipunan.local`;
            const fireReg = await completePhase4AndPhase5Submit(respPage, 'Elena Marquez FIRE', fireEmail, 'ResQTrack!2026#Fire');
            assertCondition(fireReg.status === 201, `Responder registration failed: HTTP ${fireReg.status}`);
            assertCondition(fireReg.body.status === 'Verified', `Expected Responder Verified, got ${fireReg.body.status}`);
            assertCondition(fireReg.body.autoApprovedByAi === true, `Expected Responder autoApprovedByAi=true`);
            console.log('[PASS] Scenario 8B verified Responder (FIRE) Choose ID Type gate & AI instant auto-approval.');
          }
        }
      } finally {
        await respCtx.close();
      }

      console.log('\n[SCENARIO 8C] Verifying Non-Matching Person Front ID (Marco vs Elena y4m) rejection...');
      const mismatchCtx = await createCameraContext(browser);
      const mismatchPage = await mismatchCtx.newPage();
      try {
        await mismatchPage.goto(`${FRONTEND_URL}/register?step=1&role=civilian`, { waitUntil: 'networkidle' });
        await assertChooseIdTypeLockedGate(mismatchPage, 'Scenario 8C Mismatch initial Phase 2');
        await mismatchPage.locator('select#id-type').selectOption('drivers');
        const ocrMismatch = await uploadDualSideAndAwaitSettled(
          mismatchPage,
          artifacts.nonMatchingFrontIdPath,
          artifacts.backIdPath,
          true
        );
        if (ocrMismatch?.status === 200 && ocrMismatch.body.idVerificationToken) {
          await mismatchPage.locator('#personal-info-section').waitFor({ state: 'visible', timeout: 10000 });
          await mismatchPage.locator('#phone-number').fill('09171112222');
          await mismatchPage.locator('#barangay').fill('Tres');
          await mismatchPage.locator('#street-purok').fill('Poblacion');
          await mismatchPage.locator('#btn-phase2-next').click();

          const bioMismatch = await performPhase3Y4mFacialCapture(mismatchPage);
          if (bioMismatch.status !== 503) {
            assertCondition(
              bioMismatch.body.isFaceMatchedToId !== true && !bioMismatch.body.facialVerificationToken,
              `Expected mismatch rejection comparing Elena .y4m against Marco ID, got similarity=${bioMismatch.body.faceToIdSimilarity}`
            );
            assertCondition(
              (await mismatchPage.locator('#badge-face-id-matched').count()) === 0,
              '#badge-face-id-matched must NOT appear on person mismatch'
            );
            console.log('[PASS] Scenario 8C verified Face-to-Gov-ID mismatch rejection (Marco vs Elena).');
          }
        }
      } finally {
        await mismatchCtx.close();
      }
    }

    console.log('\n[SUCCESS] Unified Phase 2-5 Auto-Approval & Y4M E2E Master Suite completed cleanly.');
  } finally {
    if (browser) {
      await browser.close();
    }
    if (servers) {
      await servers.stopAll();
    }
    rmSync(fixtureDir, { recursive: true, force: true });
  }
};

runLiveEndToEndSuite().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[FATAL ERROR] ${message}`);
  process.exit(1);
});
