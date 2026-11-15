// [Layer: Testing/Frontend]
// Diagnostic script verifying Choose ID Type upload gate, decoded Front ID image dimensions,
// and Front ID upload preview/quad diagnostics on Phase 2 (?step=1).
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, and Universal Arrow Lambdas (=>).

import { chromium, type Browser, type Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  E2E_CIVILIAN_FRONTEND_URL,
  ensureE2eServersReady,
  type E2eServersHandle
} from './fixtures/e2eServerHarness';

const PRIMARY_FRONT_ID_PATH =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1_1793858609231.jpg';

interface ImageDimensionCheckResult {
  readonly width: number;
  readonly height: number;
  readonly byteLength?: number;
  readonly error?: string;
}

interface LastFrontScanDebug {
  readonly corners?: unknown;
  readonly confidence?: number;
  readonly method?: string;
  readonly fields?: unknown;
  readonly quality?: unknown;
  readonly cardPresence?: unknown;
}

const assertCondition = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
};

const resolveFrontIdPath = (): { readonly filePath: string; readonly mimeType: string } => {
  if (fs.existsSync(PRIMARY_FRONT_ID_PATH)) {
    return { filePath: PRIMARY_FRONT_ID_PATH, mimeType: 'image/jpeg' };
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fallbackPath = path.join(currentDir, 'fixtures', 'assets', 'elena_drivers_front.png');
  assertCondition(
    fs.existsSync(fallbackPath),
    `Missing front ID image at ${PRIMARY_FRONT_ID_PATH} and ${fallbackPath}`
  );
  return { filePath: fallbackPath, mimeType: 'image/png' };
};

const launchDebugBrowser = async (): Promise<Browser> => {
  const chromeExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(chromeExe)) {
    return chromium.launch({
      executablePath: chromeExe,
      headless: true
    });
  }
  return chromium.launch({ headless: true });
};

const verifyChooseIdTypeUploadGateAndSelectDrivers = async (page: Page): Promise<void> => {
  await page.locator('#phase-2-id-identity').waitFor({ state: 'visible', timeout: 15000 });

  const idTypeSelect = page.locator('select#id-type');
  await idTypeSelect.waitFor({ state: 'visible', timeout: 5000 });

  const initialValue = await idTypeSelect.inputValue();
  const firstOption = idTypeSelect.locator('option').first();
  const firstOptionValue = (await firstOption.getAttribute('value')) ?? '';
  const firstOptionLabel = (await firstOption.innerText()).trim();

  assertCondition(initialValue === '', `Expected initial select#id-type value '', got '${initialValue}'`);
  assertCondition(firstOptionValue === '', `Expected first option value '', got '${firstOptionValue}'`);
  assertCondition(
    firstOptionLabel === 'Choose ID Type',
    `Expected first option label 'Choose ID Type', got '${firstOptionLabel}'`
  );

  await page.locator('#id-upload-locked-notice').waitFor({ state: 'visible', timeout: 5000 });
  assertCondition(
    await page.locator('#id-upload-locked-notice').isVisible(),
    'Expected #id-upload-locked-notice to be visible before selecting an ID type'
  );
  assertCondition((await page.locator('#id-upload-section').count()) === 0, 'Expected #id-upload-section count === 0');
  assertCondition((await page.locator('input#front-id-input').count()) === 0, 'Expected input#front-id-input count === 0');
  assertCondition((await page.locator('input#back-id-input').count()) === 0, 'Expected input#back-id-input count === 0');
  assertCondition((await page.locator('#front-id-dropzone').count()) === 0, 'Expected #front-id-dropzone count === 0');
  assertCondition((await page.locator('#back-id-dropzone').count()) === 0, 'Expected #back-id-dropzone count === 0');
  assertCondition(
    (await page.locator('#personal-info-section').count()) === 0,
    'Expected #personal-info-section count === 0'
  );
  console.log('[PASS] Verified initial Choose ID Type lock gate before ID selection.');

  await page.selectOption('select#id-type', 'drivers');
  await page.locator('#id-upload-section').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('input#front-id-input').waitFor({ state: 'attached', timeout: 5000 });
  await page.locator('input#back-id-input').waitFor({ state: 'attached', timeout: 5000 });
  await page.locator('input[data-side="front"]').waitFor({ state: 'attached', timeout: 5000 });

  assertCondition(
    (await page.locator('#id-upload-locked-notice').count()) === 0,
    'Expected #id-upload-locked-notice count === 0 after selecting drivers'
  );
  console.log('[PASS] Verified #id-upload-section, input#front-id-input, and input#back-id-input mounted cleanly.');
};

export const debugQuadDetection = async (): Promise<void> => {
  const { filePath, mimeType } = resolveFrontIdPath();
  const servers: E2eServersHandle = await ensureE2eServersReady({ includeResponder: false });
  const browser = await launchDebugBrowser();
  const pageErrors: string[] = [];

  try {
    const page = await browser.newPage();
    page.on('pageerror', (err: Error): void => {
      pageErrors.push(err.message);
      console.error('[PAGE ERROR]', err.message);
    });

    await page.goto(`${E2E_CIVILIAN_FRONTEND_URL}/register?step=1`, { waitUntil: 'domcontentloaded' });
    await verifyChooseIdTypeUploadGateAndSelectDrivers(page);

    const imgBase64 = fs.readFileSync(filePath).toString('base64');
    const dataUrl = `data:${mimeType};base64,${imgBase64}`;

    const result = await page.evaluate(async (srcUrl: string): Promise<ImageDimensionCheckResult> => {
      return new Promise<ImageDimensionCheckResult>((resolve) => {
        const img = new Image();
        img.onload = (): void => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ width: img.naturalWidth, height: img.naturalHeight, error: 'no 2d context' });
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight,
            byteLength: imgData.data.byteLength
          });
        };
        img.onerror = (): void => {
          resolve({ width: 0, height: 0, error: 'Failed to decode image data URL' });
        };
        img.src = srcUrl;
      });
    }, dataUrl);

    console.log('Image dimensions:', result);
    assertCondition(!result.error && result.width >= 64 && result.height >= 64, `Invalid image dimensions: ${JSON.stringify(result)}`);

    const frontInput = page.locator('input[data-side="front"]');
    await frontInput.setInputFiles(filePath);
    await page.locator('#front-id-preview').waitFor({ state: 'visible', timeout: 10000 });

    const bannerStatus = await page.locator('#id-verification-banner').getAttribute('data-verification-status');
    const scanRes = await page.evaluate((): LastFrontScanDebug | null => {
      const res = (window as unknown as { __lastFrontScanResult?: LastFrontScanDebug }).__lastFrontScanResult;
      return res
        ? {
            corners: res.corners,
            confidence: res.confidence,
            method: res.method,
            fields: res.fields,
            quality: res.quality,
            cardPresence: res.cardPresence
          }
        : null;
    });

    console.log('\n=== REAL SCAN DIAGNOSTIC ===');
    console.log(JSON.stringify({ previewMounted: true, bannerStatus, scanRes }, null, 2));

    assertCondition(pageErrors.length === 0, `Encountered page errors: ${pageErrors.join(' | ')}`);
  } finally {
    await browser.close().catch((): void => {});
    await servers.stopAll();
  }
};

debugQuadDetection().catch((err: unknown): void => {
  console.error('[ERROR] Quad detection debug failed:', err);
  process.exit(1);
});
