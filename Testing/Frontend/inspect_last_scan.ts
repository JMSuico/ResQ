// [Layer: Testing/Frontend]
// Diagnostic script verifying Choose ID Type upload gate and inspecting Front ID upload preview,
// verification banner state, and optional __lastFrontScanResult fields on Phase 2 (?step=1).
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, and Universal Arrow Lambdas (=>).

import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  E2E_CIVILIAN_FRONTEND_URL,
  ensureE2eServersReady,
  type E2eServersHandle
} from './fixtures/e2eServerHarness';

const PRIMARY_TEST_FILE =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1794112090689.jpg';

interface LastScanWindowShape {
  readonly __lastFrontScanResult?: {
    readonly success?: boolean;
    readonly category?: string;
    readonly confidence?: number;
    readonly fields?: Record<string, unknown>;
    readonly rawText?: string;
  };
}

interface ScanInspectionSummary {
  readonly previewMounted: boolean;
  readonly verificationStatus: string | null;
  readonly bannerMessage: string;
  readonly lastScan: LastScanWindowShape['__lastFrontScanResult'] | null;
}

const assertCondition = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
};

const resolveTestFile = (): string => {
  if (fs.existsSync(PRIMARY_TEST_FILE)) {
    return PRIMARY_TEST_FILE;
  }
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fallbackPath = path.join(currentDir, 'fixtures', 'assets', 'elena_drivers_front.png');
  assertCondition(fs.existsSync(fallbackPath), `Missing test file at ${PRIMARY_TEST_FILE} and ${fallbackPath}`);
  return fallbackPath;
};

const launchInspectionBrowser = async (): Promise<Browser> => {
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

const main = async (): Promise<void> => {
  const testFilePath = resolveTestFile();
  const servers: E2eServersHandle = await ensureE2eServersReady({ includeResponder: false });
  const browser = await launchInspectionBrowser();
  const pageErrors: string[] = [];

  try {
    const page = await browser.newPage();
    page.on('console', (msg: ConsoleMessage): void => {
      console.log('[BROWSER]', msg.text());
    });
    page.on('pageerror', (err: Error): void => {
      pageErrors.push(err.message);
      console.error('[PAGE ERROR]', err.message);
    });

    await page.goto(`${E2E_CIVILIAN_FRONTEND_URL}/register?step=1`, { waitUntil: 'domcontentloaded' });
    await verifyChooseIdTypeUploadGateAndSelectDrivers(page);

    const frontInput = page.locator('input[data-side="front"]');
    await frontInput.setInputFiles(testFilePath);
    await page.locator('#front-id-preview').waitFor({ state: 'visible', timeout: 10000 });

    const bannerStatus = await page.locator('#id-verification-banner').getAttribute('data-verification-status');
    const bannerMessage = (await page.locator('#id-verification-banner').innerText()).trim();
    const lastScan = await page.evaluate((): LastScanWindowShape['__lastFrontScanResult'] | null => {
      const win = window as unknown as LastScanWindowShape;
      const res = win.__lastFrontScanResult;
      if (!res) return null;
      return {
        success: res.success,
        category: res.category,
        confidence: res.confidence,
        fields: res.fields,
        rawText: res.rawText
      };
    });

    const summary: ScanInspectionSummary = {
      previewMounted: true,
      verificationStatus: bannerStatus,
      bannerMessage,
      lastScan
    };
    console.log('--- EXTRACTED SCAN & BANNER STATE ---');
    console.log(JSON.stringify(summary, null, 2));

    assertCondition(pageErrors.length === 0, `Encountered page errors: ${pageErrors.join(' | ')}`);
  } finally {
    await browser.close().catch((): void => {});
    await servers.stopAll();
  }
};

main().catch((err: unknown): void => {
  console.error('[ERROR] Last scan inspection failed:', err);
  process.exit(1);
});
