// [Layer: Testing/Frontend]
// Responsibility: Real-browser Playwright E2E verification for Minimal UI across Auth/Registration
// and Live Human Face Detection Status Indicators (#biometric-face-status-badge & #facial-capture-face-status)
// contrasting blank/dark NO-FACE camera streams against real human-face .y4m camera streams.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, ZERO page.route mocks, 100% Arrow Lambdas (=>).

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  E2E_BACKEND_URL,
  E2E_CIVILIAN_FRONTEND_URL,
  ensureE2eServersReady,
  type E2eServersHandle
} from './fixtures/e2eServerHarness';
import {
  writeY4mAndMatchingIdArtifacts,
  type Y4mAndIdFixturePaths
} from './fixtures/y4mFaceAndMatchingIdFixture';

const ARTIFACT_DIR =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';

const delay = (ms: number): Promise<void> =>
  new Promise((resolve: () => void): void => {
    setTimeout(resolve, ms);
  });

const assertCondition = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
  console.log(`[PASS] ${message}`);
};

const writeBlankDarkY4m = (filePath: string, width = 640, height = 480, frames = 60): void => {
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\n`, 'ascii');
  const frameTag = Buffer.from('FRAME\n', 'ascii');
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const frameBytes = Buffer.alloc(ySize + uvSize * 2);
  frameBytes.fill(18, 0, ySize);
  frameBytes.fill(128, ySize, ySize + uvSize * 2);

  const chunks: Buffer[] = [header];
  for (let i = 0; i < frames; i += 1) {
    chunks.push(frameTag, frameBytes);
  }
  writeFileSync(filePath, Buffer.concat(chunks));
};

const navigateToRegisterPhase3 = async (page: Page, fixtures: Y4mAndIdFixturePaths): Promise<void> => {
  await page.goto(`${E2E_CIVILIAN_FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });
  await page.locator('#phase-1-role').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#role-btn-civilian').click();
  await page.locator('#btn-phase1-next').click();

  await page.locator('#phase-2-id-identity').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('select#id-type').selectOption('drivers');
  await page.locator('#id-upload-section').waitFor({ state: 'visible', timeout: 5000 });

  const ocrPromise = page.waitForResponse(
    (res): boolean => res.url().includes('/api/identity/ocr/extract'),
    { timeout: 20000 }
  );
  await page.locator('input#front-id-input').setInputFiles(fixtures.frontIdPath);
  await page.locator('input#back-id-input').setInputFiles(fixtures.backIdPath);
  const ocrRes = await ocrPromise;
  console.log(`[OCR] POST /api/identity/ocr/extract -> HTTP ${ocrRes.status()}`);
  if (ocrRes.status() >= 400 && ocrRes.status() !== 503) {
    const errText = await ocrRes.text().catch(() => '');
    throw new Error(`Unexpected OCR rejection (HTTP ${ocrRes.status()}): ${errText}`);
  }

  await page.locator('#personal-info-section').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#phone-number').fill('09171234567');
  await page.locator('#street-purok').fill('Purok 2, Katipunan');
  if ((await page.locator('#first-name').inputValue()).trim() === '') {
    await page.locator('#first-name').fill('Elena');
    await page.locator('#last-name').fill('Marquez');
    await page.locator('#sex').selectOption('Female');
    await page.locator('#dob').fill('1994-03-11');
    await page.locator('#barangay').fill('Uno');
  }

  await page.locator('#btn-phase2-next').click();
  await page.locator('#phase-3-facial-record').waitFor({ state: 'visible', timeout: 5000 });
};

const launchFakeCamBrowser = async (y4mPath: string): Promise<{ browser: Browser; context: BrowserContext; page: Page }> => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${y4mPath}`
    ]
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    permissions: ['camera']
  });
  const page = await context.newPage();
  return { browser, context, page };
};

const runMinimalUiAndFaceIndicatorE2e = async (): Promise<void> => {
  const tempDir = mkdtempSync(join(tmpdir(), 'resqtrack-minimal-face-e2e-'));
  const blankY4mPath = join(tempDir, 'blank_no_face.y4m');
  writeBlankDarkY4m(blankY4mPath);

  const fixtures = writeY4mAndMatchingIdArtifacts(ARTIFACT_DIR);
  let servers: E2eServersHandle | null = null;
  let noFaceBrowser: Browser | null = null;
  let faceBrowser: Browser | null = null;

  try {
    servers = await ensureE2eServersReady({ includeResponder: false, useWireServer: true });
    console.log(`[SERVER] Backend=${E2E_BACKEND_URL}, Frontend=${E2E_CIVILIAN_FRONTEND_URL}`);

    // ── PART A: NO-FACE BLANK CAMERA STREAM ─────────────────────────────────────────
    console.log('\n[PART A] Blank dark camera stream -> NO FACE DETECTED indicators + Minimal Login/Reg UI...');
    const sessionA = await launchFakeCamBrowser(blankY4mPath);
    noFaceBrowser = sessionA.browser;
    const pageA = sessionA.page;

    await pageA.goto(`${E2E_CIVILIAN_FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
    await pageA.locator('button#biometric-login-btn').waitFor({ state: 'visible', timeout: 15000 });

    const loginBodyText = (await pageA.locator('body').innerText()).trim();
    assertCondition(
      !loginBodyText.includes('[AUTH.IDENTIFIER]') && !loginBodyText.includes('[ARGON2.KEY]'),
      'Minimal Login page contains zero bracketed telemetry tags'
    );
    await pageA.screenshot({ path: join(ARTIFACT_DIR, 'minimal_login_ui.png'), fullPage: false });

    await pageA.locator('button#biometric-login-btn').click();
    await pageA.locator('#biometric-5layer-pipeline').waitFor({ state: 'visible', timeout: 5000 });
    const standbyBadgeText = (await pageA.locator('#biometric-face-status-badge').innerText()).trim();
    assertCondition(
      standbyBadgeText.includes('CAMERA STANDBY'),
      `BiometricLoginModal initial status shows CAMERA STANDBY (actual="${standbyBadgeText}")`
    );

    await pageA.locator('button[type="submit"]:has-text("Activate Live Camera")').click();
    await delay(1400);

    const noFaceBiometricBadge = pageA.locator('#biometric-face-status-badge[data-face-detected="false"]');
    await noFaceBiometricBadge.waitFor({ state: 'visible', timeout: 5000 });
    const noFaceBioText = (await noFaceBiometricBadge.innerText()).trim();
    assertCondition(
      noFaceBioText.includes('NO FACE DETECTED'),
      `BiometricLoginModal live blank camera indicates NO FACE DETECTED (actual="${noFaceBioText}")`
    );
    await pageA.screenshot({ path: join(ARTIFACT_DIR, 'biometric_modal_no_face.png'), fullPage: false });

    await navigateToRegisterPhase3(pageA, fixtures);
    const phase3StandbyText = (await pageA.locator('#facial-capture-face-status').innerText()).trim();
    assertCondition(
      phase3StandbyText.includes('CAMERA STANDBY'),
      `ManualFacialCapturePanel initial status shows CAMERA STANDBY (actual="${phase3StandbyText}")`
    );

    await pageA.locator('#btn-request-camera').click();
    await delay(1400);
    const noFaceRegBadge = pageA.locator('#facial-capture-face-status[data-face-detected="false"]');
    await noFaceRegBadge.waitFor({ state: 'visible', timeout: 5000 });
    const noFaceRegText = (await noFaceRegBadge.innerText()).trim();
    assertCondition(
      noFaceRegText.includes('NO FACE DETECTED'),
      `ManualFacialCapturePanel live blank camera indicates NO FACE DETECTED (actual="${noFaceRegText}")`
    );
    await pageA.screenshot({ path: join(ARTIFACT_DIR, 'register_phase3_no_face.png'), fullPage: false });

    await noFaceBrowser.close();
    noFaceBrowser = null;

    // ── PART B: REAL HUMAN FACE .Y4M STREAM ─────────────────────────────────────────
    console.log('\n[PART B] Real human face .y4m stream -> FACE DETECTED / HUMAN FACE DETECTED transitions...');
    const sessionB = await launchFakeCamBrowser(fixtures.y4mPath);
    faceBrowser = sessionB.browser;
    const pageB = sessionB.page;

    await pageB.goto(`${E2E_CIVILIAN_FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
    await pageB.locator('button#biometric-login-btn').waitFor({ state: 'visible', timeout: 15000 });
    await pageB.locator('button#biometric-login-btn').click();
    await pageB.locator('#biometric-5layer-pipeline').waitFor({ state: 'visible', timeout: 5000 });

    await pageB.locator('button[type="submit"]:has-text("Activate Live Camera")').click();
    const faceDetectedBioBadge = pageB.locator('#biometric-face-status-badge[data-face-detected="true"]');
    await faceDetectedBioBadge.waitFor({ state: 'visible', timeout: 8000 });
    const faceDetectedBioText = (await faceDetectedBioBadge.innerText()).trim();
    assertCondition(
      faceDetectedBioText.includes('FACE DETECTED'),
      `BiometricLoginModal live human face stream transitions to FACE DETECTED (actual="${faceDetectedBioText}")`
    );
    await pageB.screenshot({ path: join(ARTIFACT_DIR, 'biometric_modal_face_detected.png'), fullPage: false });

    await navigateToRegisterPhase3(pageB, fixtures);
    await pageB.locator('#btn-request-camera').click();
    const faceDetectedRegBadge = pageB.locator('#facial-capture-face-status[data-face-detected="true"]');
    await faceDetectedRegBadge.waitFor({ state: 'visible', timeout: 8000 });
    const faceDetectedRegText = (await faceDetectedRegBadge.innerText()).trim();
    assertCondition(
      faceDetectedRegText.includes('FACE DETECTED'),
      `ManualFacialCapturePanel live human face stream transitions to FACE DETECTED (actual="${faceDetectedRegText}")`
    );
    await pageB.screenshot({ path: join(ARTIFACT_DIR, 'register_phase3_face_detected.png'), fullPage: false });

    console.log('\nALL MINIMAL UI & LIVE FACE INDICATOR E2E TESTS PASSED!');
  } finally {
    if (noFaceBrowser) {
      await noFaceBrowser.close().catch((): void => {});
    }
    if (faceBrowser) {
      await faceBrowser.close().catch((): void => {});
    }
    if (servers) {
      await servers.stopAll();
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
};

runMinimalUiAndFaceIndicatorE2e().catch((err: unknown): void => {
  console.error('[FATAL E2E FAILURE]', err);
  process.exit(1);
});
