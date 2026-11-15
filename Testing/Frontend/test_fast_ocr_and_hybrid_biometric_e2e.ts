// [Layer: Testing/Frontend]
// End-to-End Verification & Timing Benchmark for:
//   1. <10s High-Res (4160x3120) Dual-Side Gov ID Upload Downscaling, 384px Preflight & OCR Unlock
//   2. Approach 1 Hybrid Biometric Login (Live Multi-Frame Burst + SQL PoseFramesJson 4-Pose Gallery via Claude)
//      across BOTH 1:1 Targeted Verification AND 1:N Direct Face Scan (WITHOUT #btn-synthetic-test-scan).
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, ZERO page.route mocks, 100% Arrow Lambdas (=>).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Request, type Response } from 'playwright';
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

interface OcrExtractResultDto {
  readonly success?: boolean;
  readonly idVerificationToken?: string | null;
  readonly firstName?: string | null;
  readonly surname?: string | null;
  readonly modelUsed?: string | null;
  readonly errorCode?: string | null;
}

interface BiometricLoginResultDto {
  readonly validationVerdict?: string | null;
  readonly biometricStrategyUsed?: string | null;
  readonly session?: {
    readonly email?: string | null;
    readonly validationVerdict?: string | null;
    readonly biometricStrategyUsed?: string | null;
    readonly validationLayers?: ReadonlyArray<{
      readonly layerNumber?: number;
      readonly layerCode?: string;
      readonly passed?: boolean;
      readonly detail?: string;
      readonly score?: number;
    }>;
  } | null;
  readonly validationLayers?: ReadonlyArray<{
    readonly layerNumber?: number;
    readonly layerCode?: string;
    readonly passed?: boolean;
    readonly detail?: string;
    readonly score?: number;
  }>;
}

interface CapturedBiometricRequestPayload {
  readonly email?: string;
  readonly liveCaptureBase64?: string;
  readonly liveCaptureFramesBase64?: readonly string[];
  readonly liveDescriptorVector?: readonly number[];
}

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

const createOversized4160x3120JpegPair = async (
  page: Page,
  frontSrcPath: string,
  backSrcPath: string,
  outDir: string
): Promise<{ readonly frontJpgPath: string; readonly backJpgPath: string; readonly frontBytes: number; readonly backBytes: number }> => {
  const frontPngDataUrl = `data:image/png;base64,${readFileSync(frontSrcPath).toString('base64')}`;
  const backPngDataUrl = `data:image/png;base64,${readFileSync(backSrcPath).toString('base64')}`;

  const rendered = await page.evaluate(
    async (inputs: { readonly frontUrl: string; readonly backUrl: string }): Promise<{ readonly frontB64: string; readonly backB64: string }> => {
      const results: string[] = [];
      for (const srcUrl of [inputs.frontUrl, inputs.backUrl]) {
        const img = new Image();
        await new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
          img.onload = (): void => resolve();
          img.onerror = (): void => reject(new Error('Failed to decode source PNG for 4160x3120 upscaling'));
          img.src = srcUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 4160;
        canvas.height = 3120;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('2D context unavailable for 4160x3120 fixture render');
        }
        ctx.fillStyle = '#5a2414';
        ctx.fillRect(0, 0, 4160, 3120);
        ctx.drawImage(img, 180, 140, 3800, 2840);
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.92);
        results.push(jpegUrl.split(',')[1] ?? '');
      }
      return { frontB64: results[0] ?? '', backB64: results[1] ?? '' };
    },
    { frontUrl: frontPngDataUrl, backUrl: backPngDataUrl }
  );

  const frontBuf = Buffer.from(rendered.frontB64, 'base64');
  const backBuf = Buffer.from(rendered.backB64, 'base64');
  const frontJpgPath = join(outDir, 'FRONT_4160x3120.jpg');
  const backJpgPath = join(outDir, 'BACK_4160x3120.jpg');
  writeFileSync(frontJpgPath, frontBuf);
  writeFileSync(backJpgPath, backBuf);

  return {
    frontJpgPath,
    backJpgPath,
    frontBytes: frontBuf.length,
    backBytes: backBuf.length
  };
};

const waitForPhase3CameraAdvance = async (page: Page, maxWaitMs = 45000): Promise<void> => {
  const deadline = Date.now() + maxWaitMs;
  await page.waitForFunction(
    (): boolean => {
      const video = document.querySelector<HTMLVideoElement>('#facial-camera-video');
      return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
    },
    { timeout: 20000 }
  );

  const lockBtn = page.locator('#btn-lock-next-pose');
  const confirmBtn = page.locator('#btn-confirm-facial-capture');
  while (Date.now() < deadline) {
    if (await confirmBtn.isVisible().catch(() => false)) {
      const consentBox = page.locator('#facial-consent-checkbox');
      if (await consentBox.isVisible().catch(() => false)) {
        if (!(await consentBox.isChecked())) {
          await consentBox.check();
        }
      }
      if (await confirmBtn.isEnabled().catch(() => false)) {
        await confirmBtn.click();
        return;
      }
    }

    if ((await lockBtn.isVisible().catch(() => false)) && (await lockBtn.isEnabled().catch(() => false))) {
      await lockBtn.click().catch(() => undefined);
    }

    await delay(800);
  }
  throw new Error(`Timed out waiting for Phase 3 .y4m capture confirmation after ${maxWaitMs}ms`);
};

const run = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('  FAST <10s OCR BENCHMARK & APPROACH 1 HYBRID BIOMETRIC LOGIN E2E SUITE ');
  console.log('========================================================================');

  if (!existsSync(ARTIFACT_DIR)) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'resqtrack-fast-hybrid-'));
  const fixtures: Y4mAndIdFixturePaths = writeY4mAndMatchingIdArtifacts(tempDir);
  let servers: E2eServersHandle | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    servers = await ensureE2eServersReady({ includeResponder: false, useWireServer: true });
    console.log(`[SERVER] Backend=${E2E_BACKEND_URL}, Frontend=${E2E_CIVILIAN_FRONTEND_URL}`);

    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-for-media-stream=${fixtures.y4mPath}`
      ]
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      permissions: ['camera']
    });
    const page: Page = await context.newPage();

    console.log('\n[TEST 1] High-Res 4160x3120 Dual-Side ID Upload -> Background Downscale + <10s Unlock...');
    await page.goto(`${E2E_CIVILIAN_FRONTEND_URL}/register`, { waitUntil: 'domcontentloaded' });
    await page.locator('#phase-1-role').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#role-btn-civilian').click();
    await page.locator('#btn-phase1-next').click();
    await page.locator('#phase-2-id-identity').waitFor({ state: 'visible', timeout: 10000 });

    const hiResPair = await createOversized4160x3120JpegPair(page, fixtures.frontIdPath, fixtures.backIdPath, tempDir);
    console.log(`[FIXTURE] Generated 4160x3120 JPEGs: Front=${Math.round(hiResPair.frontBytes / 1024)}KB, Back=${Math.round(hiResPair.backBytes / 1024)}KB`);

    await page.locator('select#id-type').selectOption('drivers');
    await page.locator('#id-upload-section').waitFor({ state: 'visible', timeout: 5000 });

    const ocrResponsePromise = page.waitForResponse(
      (res: Response): boolean => res.url().includes('/api/identity/ocr/extract'),
      { timeout: 15000 }
    );

    const uploadStartMs = performance.now();
    await page.locator('input#front-id-input').setInputFiles(hiResPair.frontJpgPath);
    await page.locator('input#back-id-input').setInputFiles(hiResPair.backJpgPath);

    const ocrRes = await ocrResponsePromise;
    await page.locator('#personal-info-section').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#badge-id-verified-genuine').waitFor({ state: 'visible', timeout: 5000 });
    const ocrTotalElapsedMs = Math.round(performance.now() - uploadStartMs);
    await ocrRes.finished().catch((): void => {});
    const reqHeaders = await ocrRes.request().allHeaders();
    const reqSizes = await ocrRes.request().sizes();
    const uploadedMultipartPayloadBytes = Math.max(
      Number.parseInt(reqHeaders['content-length'] ?? '0', 10) || 0,
      reqSizes.requestBodySize > 0 ? reqSizes.requestBodySize : 0
    );

    const ocrBody = (await ocrRes.json()) as OcrExtractResultDto;
    console.log(
      `[TIMING] 4160x3120 Dual Upload -> Downscale -> Preflight -> Backend OCR -> UI Unlock elapsed = ${ocrTotalElapsedMs} ms (HTTP ${ocrRes.status()}, multipart=${Math.round(uploadedMultipartPayloadBytes / 1024)}KB vs raw=${Math.round((hiResPair.frontBytes + hiResPair.backBytes) / 1024)}KB)`
    );

    assertCondition(
      ocrRes.status() === 200 && Boolean(ocrBody.success && ocrBody.idVerificationToken),
      `High-res 4160x3120 ID pair verified cleanly via background OCR & minted standby token`
    );
    assertCondition(
      ocrTotalElapsedMs < 10_000,
      `High-res 4160x3120 end-to-end OCR & UI unlock finished under 10,000 ms (${ocrTotalElapsedMs} ms)`
    );
    assertCondition(
      uploadedMultipartPayloadBytes > 0 &&
        uploadedMultipartPayloadBytes < hiResPair.frontBytes + hiResPair.backBytes,
      `Client downscaled multipart upload payload before transfer (${Math.round(uploadedMultipartPayloadBytes / 1024)}KB < raw ${Math.round((hiResPair.frontBytes + hiResPair.backBytes) / 1024)}KB)`
    );

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

    console.log('\n[TEST 2] Live 4-Pose .y4m Registration + Hybrid Approach 1 Login (1:1 & 1:N)...');
    const faceBioPromise = page.waitForResponse(
      (res: Response): boolean => res.url().includes('/api/identity/biometrics/analyze-geometry'),
      { timeout: 45000 }
    );
    await page.locator('#btn-request-camera').click();
    await waitForPhase3CameraAdvance(page, 45000);
    const faceBioRes = await faceBioPromise;
    assertCondition(faceBioRes.status() === 200, `Phase 3 live .y4m Face-to-ID analysis returned HTTP 200`);
    await page.locator('#badge-facial-confirmed').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#btn-phase3-next').click();

    await page.locator('#phase-4-credentials').waitFor({ state: 'visible', timeout: 5000 });
    const testEmail = `hybrid-e2e-${Date.now()}@katipunan.local`;
    const testPassword = 'ResQTrack!2026#Hybrid';
    await page.locator('#display-name').fill('Elena Marquez');
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill(testPassword);
    await page.locator('#confirm').fill(testPassword);
    await page.locator('#btn-accept-both-consents').click();
    await page.locator('#btn-phase4-next').click();

    await page.locator('#phase-5-review').waitFor({ state: 'visible', timeout: 5000 });
    const regPromise = page.waitForResponse(
      (res: Response): boolean => res.url().includes('/api/register'),
      { timeout: 15000 }
    );
    await page.locator('#submit').click();
    const regRes = await regPromise;
    const regBodyText = await regRes.text().catch(() => '');
    assertCondition(
      regRes.status() === 200 || regRes.status() === 201,
      `Auto-approved account registered (${testEmail}) -> HTTP ${regRes.status()}: ${regBodyText}`
    );

    console.log('\n[TEST 2A] 1:1 Hybrid Login via Real Camera Burst (NO #btn-synthetic-test-scan)...');
    await page.goto(`${E2E_CIVILIAN_FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('button#biometric-login-btn').click();
    await page.locator('#biometric-5layer-pipeline').waitFor({ state: 'visible', timeout: 5000 });

    let captured1To1Payload: CapturedBiometricRequestPayload | null = null;
    const bioReqListener = (req: Request): void => {
      if (req.url().includes('biometric-login') && req.method() === 'POST') {
        try {
          const raw = req.postData() ?? '';
          if (raw) {
            captured1To1Payload = JSON.parse(raw) as CapturedBiometricRequestPayload;
          }
        } catch {
          // ignore parse failure
        }
      }
    };
    page.on('request', bioReqListener);

    let bioLogin1To1Resolved = false;
    const bioRes1To1Promise = page
      .waitForResponse(
        (res: Response): boolean =>
          res.url().includes('biometric-login') && res.status() === 200,
        { timeout: 25000 }
      )
      .then((res: Response): Response => {
        bioLogin1To1Resolved = true;
        return res;
      });

    await page.locator('input#bio-email').fill(testEmail);
    await page.locator('button[type="submit"]:has-text("Activate Live Camera")').click();
    await delay(1800);

    if (!bioLogin1To1Resolved) {
      const scanNowBtn = page.locator('button#btn-scan-biometric-face');
      await scanNowBtn.waitFor({ state: 'visible', timeout: 5000 });
      await scanNowBtn.click();
    }

    const bioRes1To1 = await bioRes1To1Promise;
    page.off('request', bioReqListener);

    const bioBody1To1 = (await bioRes1To1.json()) as BiometricLoginResultDto;
    const verdict1To1 = bioBody1To1.validationVerdict ?? bioBody1To1.session?.validationVerdict;
    const layers1To1 = bioBody1To1.validationLayers ?? bioBody1To1.session?.validationLayers ?? [];
    const layer4 = layers1To1.find((l) => l.layerNumber === 4);

    assertCondition(verdict1To1 === 'SUCCESS_LOGIN', `1:1 Hybrid Live Camera Login returned SUCCESS_LOGIN`);
    assertCondition(
      Boolean(captured1To1Payload?.liveCaptureBase64 && captured1To1Payload.liveCaptureBase64.startsWith('data:image/')),
      '1:1 /api/biometric-login request included liveCaptureBase64 webcam frame'
    );
    assertCondition(
      Boolean(captured1To1Payload?.liveCaptureFramesBase64 && captured1To1Payload.liveCaptureFramesBase64.length >= 1),
      `1:1 /api/biometric-login request included liveCaptureFramesBase64 burst (count=${captured1To1Payload?.liveCaptureFramesBase64?.length ?? 0})`
    );
    assertCondition(
      Boolean(layer4?.detail?.includes('Hybrid Claude 4-Pose Gallery')),
      `Layer 4 evaluated real Claude 4-Pose Gallery (detail="${layer4?.detail ?? ''}")`
    );

    await page.screenshot({
      path: join(ARTIFACT_DIR, 'biometric_hybrid_login_verified.png'),
      fullPage: true
    });
    console.log(`[ARTIFACT] Captured screenshot: ${join(ARTIFACT_DIR, 'biometric_hybrid_login_verified.png')}`);

    await page.waitForURL('**/civilian/dashboard', { timeout: 10000 });
    assertCondition(page.url().includes('/civilian/dashboard'), '1:1 Hybrid Biometric Login redirected to /civilian/dashboard');

    console.log('\n[TEST 2B] 1:N Direct Scan Hybrid Login (No Email)...');
    await page.goto(`${E2E_CIVILIAN_FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((): void => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('button#biometric-login-btn').click();
    await page.locator('#biometric-5layer-pipeline').waitFor({ state: 'visible', timeout: 5000 });

    let captured1ToNPayload: CapturedBiometricRequestPayload | null = null;
    const req1ToNListener = (req: Request): void => {
      if (req.url().includes('biometric-login') && req.method() === 'POST') {
        try {
          const raw = req.postData() ?? '';
          if (raw) {
            captured1ToNPayload = JSON.parse(raw) as CapturedBiometricRequestPayload;
          }
        } catch {
          // ignore
        }
      }
    };
    page.on('request', req1ToNListener);

    let bioLogin1ToNResolved = false;
    const bioRes1ToNPromise = page
      .waitForResponse(
        (res: Response): boolean =>
          res.url().includes('biometric-login') && res.status() === 200,
        { timeout: 25000 }
      )
      .then((res: Response): Response => {
        bioLogin1ToNResolved = true;
        return res;
      });

    await page.locator('button#btn-direct-1ton-scan').click();
    await delay(1800);

    if (!bioLogin1ToNResolved) {
      await page.locator('button#btn-scan-biometric-face').click();
    }

    const bioRes1ToN = await bioRes1ToNPromise;
    page.off('request', req1ToNListener);
    const bioBody1ToN = (await bioRes1ToN.json()) as BiometricLoginResultDto;
    const verdict1ToN = bioBody1ToN.validationVerdict ?? bioBody1ToN.session?.validationVerdict;

    assertCondition(!captured1ToNPayload?.email, '1:N /api/biometric-login sent ZERO email address');
    assertCondition(Boolean(captured1ToNPayload?.liveCaptureBase64), '1:N /api/biometric-login included liveCaptureBase64');
    assertCondition(verdict1ToN === 'SUCCESS_LOGIN', `1:N Direct Face Scan Hybrid Login succeeded (verdict=${verdict1ToN})`);

    console.log('\n========================================================================');
    console.log('  FAST <10s OCR & HYBRID BIOMETRIC LOGIN E2E VERIFICATION 100% GREEN!  ');
    console.log('========================================================================');
  } finally {
    await context?.close().catch((): void => {});
    await browser?.close().catch((): void => {});
    if (servers) {
      await servers.stopAll();
    }
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors
    }
  }
};

void run().catch((err: unknown): void => {
  console.error('[FATAL E2E FAILURE]:', err);
  process.exit(1);
});
