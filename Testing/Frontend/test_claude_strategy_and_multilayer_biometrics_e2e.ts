// [Layer: Testing/Frontend]
// Responsibility: Automated Playwright E2E verification for Claude Sonnet/Vision Strategy Pattern,
// Standby AI Governance (Auto-Approve Gov ID & Fairness-Boosted Responder Auto-Dispatch),
// Phase 2 Unified Dual-Side ID Gate & Direct Visible-Only Auto-Fill, Phase 3 30-60 FPS Multi-Pose Biometric Enrollment & Retake Cache,
// and 5-Layer Biometric Login Validation Pipeline.
// Complies with Katipuneros Architecture: Universal Lambdas (=>), Zero 'any', Zero emojis, centralized in Testing/.

import { chromium, Browser, Page, Request, Response } from 'playwright';
import { deflateSync } from 'node:zlib';
import * as fs from 'fs';
import * as path from 'path';
import {
  createBlankWhiteIdPngBuffer,
  createElenaMarquezDriversLicensePngBuffer
} from './fixtures/syntheticIdFixtures';
import { writeY4mAndMatchingIdArtifacts } from './fixtures/y4mFaceAndMatchingIdFixture';
import { ensureE2eServersReady, type E2eServersHandle } from './fixtures/e2eServerHarness';

const FRONTEND_BASE_URL = 'http://127.0.0.1:1998';
const BACKEND_BASE_URL = 'http://127.0.0.1:1999';
const REGISTER_URL = `${FRONTEND_BASE_URL}/register`;
const LOGIN_URL = `${FRONTEND_BASE_URL}/login`;
const ARTIFACT_DIR = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';
const VERIFIED_SCREENSHOT_PATH = path.join(ARTIFACT_DIR, 'claude_strategy_multilayer_biometrics_verified.png');
const PHASE2_UNIFIED_SCREENSHOT = path.join(ARTIFACT_DIR, 'e2e_unified_phase2_id_identity.png');
const PHASE5_UNIFIED_SCREENSHOT = path.join(ARTIFACT_DIR, 'e2e_unified_phase5_review.png');

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

const FONT_3X5: Record<string, readonly string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '111', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ':': ['000', '010', '000', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '.': ['000', '000', '000', '000', '010'],
  '/': ['001', '001', '010', '100', '100'],
  "'": ['010', '010', '000', '000', '000'],
  ' ': ['000', '000', '000', '000', '000']
};

const drawTextRgba = (
  pixels: Uint8Array,
  width: number,
  height: number,
  text: string,
  x0: number,
  y0: number,
  scale: number,
  r: number,
  g: number,
  b: number
): void => {
  let cursorX = x0;
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i += 1) {
    const ch = upper[i];
    const glyph = FONT_3X5[ch] ?? FONT_3X5[' '];
    for (let gy = 0; gy < 5; gy += 1) {
      for (let gx = 0; gx < 3; gx += 1) {
        if (glyph[gy][gx] === '1') {
          fillRectRgba(pixels, width, height, cursorX + gx * scale, y0 + gy * scale, scale, scale, r, g, b);
        }
      }
    }
    cursorX += 4 * scale;
  }
};

// Distinct flat light-slate 856x540 PNG (avoids duplicate Front/Back match while still failing blank/flat gate)
const createDistinctFlatBlankBackPngBuffer = (): Buffer => {
  const width = 856;
  const height = 540;
  const pixels = new Uint8Array(width * height * 4);
  fillRectRgba(pixels, width, height, 0, 0, width, height, 245, 247, 250);
  return encodeRgbaPngBuffer(width, height, pixels);
};

// Authentic-layout 856x540 Driver's License Back Card PNG (LTO Restrictions + Conditions + PDF417 Barcode)
const createElenaMarquezDriversLicenseBackPngBuffer = (): Buffer => {
  const width = 856;
  const height = 540;
  const pixels = new Uint8Array(width * height * 4);
  fillRectRgba(pixels, width, height, 0, 0, width, height, 224, 232, 242);
  fillRectRgba(pixels, width, height, 12, 12, width - 24, height - 24, 249, 251, 255);
  fillRectRgba(pixels, width, height, 12, 12, width - 24, 72, 15, 38, 76);
  fillRectRgba(pixels, width, height, 12, 84, width - 24, 8, 196, 38, 46);
  drawTextRgba(pixels, width, height, 'REPUBLIC OF THE PHILIPPINES', 36, 26, 3, 255, 255, 255);
  drawTextRgba(pixels, width, height, "LAND TRANSPORTATION OFFICE - DRIVER'S LICENSE BACK", 36, 52, 2, 219, 234, 254);

  drawTextRgba(pixels, width, height, 'DL CODES / VEHICLE CATEGORIES', 40, 114, 3, 15, 23, 42);
  drawTextRgba(pixels, width, height, 'A  B  B1  - NON-PROFESSIONAL', 40, 142, 3, 30, 58, 138);
  drawTextRgba(pixels, width, height, 'CONDITIONS', 40, 186, 3, 15, 23, 42);
  drawTextRgba(pixels, width, height, '1. WEAR CORRECTIVE EYEGLASSES', 40, 214, 3, 51, 65, 85);
  drawTextRgba(pixels, width, height, 'BLOOD TYPE: O   LICENSE NO: K09-88-776655', 40, 252, 3, 15, 23, 42);
  drawTextRgba(pixels, width, height, 'EMERGENCY CONTACT: DIPOLOG CITY LDRRMO', 40, 286, 2, 71, 85, 105);

  // High-contrast PDF417 barcode strip across bottom of back side
  for (let row = 0; row < 4; row += 1) {
    for (let bar = 0; bar < 94; bar += 1) {
      const bw = ((bar + row) % 3 === 0) ? 5 : 3;
      const x = 40 + bar * 8;
      if ((bar + row) % 2 === 0 && x + bw < width - 40) {
        fillRectRgba(pixels, width, height, x, 336 + row * 34, bw, 28, 15, 23, 42);
      }
    }
  }
  drawTextRgba(pixels, width, height, 'LTO SECURED BACK CARD // DO NOT FOLD', 40, 492, 2, 71, 85, 105);
  return encodeRgbaPngBuffer(width, height, pixels);
};

interface StandbyStatusPayload {
  configured?: boolean;
  maskedKey?: string;
  model?: string;
  autoApproveGovIdStrategy?: string;
  autoDispatchResponderStrategy?: string;
}

interface StandbyCandidateScore {
  responderUnitId: number;
  unitCode: string;
  unitName: string;
  agencyType: string;
  distanceKm: number;
  historicalDispatchCount: number;
  neverChosenBefore: boolean;
  proximityScore: number;
  fairnessRotationScore: number;
  workloadScore: number;
  compositeScore: number;
  selectionReason: string;
}

interface StandbyAutoDispatchResponse {
  success?: boolean;
  strategyName?: string;
  providerUsed?: string;
  incidentId?: number;
  selectedUnit?: StandbyCandidateScore;
  rankedCandidates?: StandbyCandidateScore[];
  tacticalAiReasoning?: string;
}

interface StandbyGovIdApproveResponse {
  approved?: boolean;
  decisionStatus?: string;
  strategyName?: string;
  providerUsed?: string;
  confidenceScore?: number;
  reasoning?: string;
  userId?: string;
}

interface CapturedRegisterPayload {
  email?: string;
  firstName?: string;
  surname?: string;
  biometricDescriptorVector?: number[];
  geometricSignatureJson?: string;
  poseFramesJson?: string;
}

interface CapturedRegisterResponse {
  userId?: string;
  email?: string;
  status?: string;
}

interface BiometricValidationLayer {
  layer?: number;
  name?: string;
  layerName?: string;
  status?: string;
  passed?: boolean;
}

interface BiometricLoginApiPayload {
  token?: string;
  redirectUrl?: string;
  validationVerdict?: string;
  biometricStrategyUsed?: string;
  validationLayers?: BiometricValidationLayer[];
  session?: {
    userId?: string;
    email?: string;
    targetDashboardUrl?: string;
    validationVerdict?: string;
    biometricStrategyUsed?: string;
    validationLayers?: BiometricValidationLayer[];
  };
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const BANNED_DUMMY_STRINGS: readonly string[] = [
  'JUAN',
  'JUAN MIGUEL',
  'DELA CRUZ',
  'SANTOS',
  '1995-05-15',
  '1996-05-14',
  'N01-23-456789',
  'K02-24-008491',
  '+639171234567'
];

const assertNoBannedTokens = (contextLabel: string, value: string): void => {
  const upperVal = value.toUpperCase();
  for (const token of BANNED_DUMMY_STRINGS) {
    if (upperVal.includes(token.toUpperCase())) {
      throw new Error(`Banned dummy string "${token}" leaked into ${contextLabel}: "${value}"`);
    }
  }
};

const writePngArtifact = (filename: string, buffer: Buffer): string => {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  const filePath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

interface OcrExtractApiPayload {
  success?: boolean;
  confidence?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  surname?: string | null;
  suffix?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  licenseNumber?: string | null;
  weight?: string | null;
  height?: string | null;
  phoneNumber?: string | null;
}

const runClaudeStrategyAndMultiLayerBiometricsE2E = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('   CLAUDE STRATEGY & 5-LAYER BIOMETRICS END-TO-END VERIFICATION SUITE');
  console.log('========================================================================\n');

  const servers: E2eServersHandle = await ensureE2eServersReady({ includeResponder: false });
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
  const testEmail = `claude.verified.elena.${timestamp}@resqtrack.gov.ph`;
  const testPassword = 'Password123!@#ClaudeSecure';
  const blankFrontPath = writePngArtifact('claude_blank_front_id.png', createBlankWhiteIdPngBuffer());
  const blankBackPath = writePngArtifact('claude_blank_back_id.png', createDistinctFlatBlankBackPngBuffer());
  const elenaFrontPath = writePngArtifact('claude_elena_front_id.png', createElenaMarquezDriversLicensePngBuffer());
  const elenaBackPath = writePngArtifact('claude_elena_back_id.png', createElenaMarquezDriversLicenseBackPngBuffer());

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page: Page = await context.newPage();

    // =========================================================================
    // TEST 1: Claude API Key & Standby AI Governance Strategies
    // =========================================================================
    console.log('[Test 1] Verifying Claude API Key configuration & Standby AI Governance Strategies...');
    const statusRes = await fetch(`${BACKEND_BASE_URL}/api/standby-ai/status`);
    if (!statusRes.ok) {
      throw new Error(`GET /api/standby-ai/status failed with HTTP ${statusRes.status}`);
    }
    const statusData = (await statusRes.json()) as StandbyStatusPayload;
    console.log(`   Standby AI Status: configured=${String(statusData.configured)}, maskedKey=${statusData.maskedKey ?? ''}`);

    if (statusData.configured !== true) {
      throw new Error(`Expected configured === true, got ${String(statusData.configured)}`);
    }
    if (
      typeof statusData.maskedKey !== 'string' ||
      statusData.maskedKey.includes('[UNCONFIGURED]') ||
      !statusData.maskedKey.includes('...')
    ) {
      throw new Error(`Expected valid maskedKey containing '...', got ${String(statusData.maskedKey)}`);
    }
    if (statusData.autoApproveGovIdStrategy !== 'ClaudeStandbyAutoApproveGovId') {
      throw new Error(
        `Expected autoApproveGovIdStrategy === 'ClaudeStandbyAutoApproveGovId', got ${String(statusData.autoApproveGovIdStrategy)}`
      );
    }
    if (statusData.autoDispatchResponderStrategy !== 'ClaudeStandbyAutoDispatchResponders') {
      throw new Error(
        `Expected autoDispatchResponderStrategy === 'ClaudeStandbyAutoDispatchResponders', got ${String(statusData.autoDispatchResponderStrategy)}`
      );
    }

    const dispatchRes = await fetch(`${BACKEND_BASE_URL}/api/standby-ai/auto-dispatch-responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentId: 901,
        incidentLat: 8.5117,
        incidentLng: 123.2925,
        incidentType: 'Emergency Disaster Response',
        severity: 'Critical',
        applyDispatch: false
      })
    });
    if (!dispatchRes.ok) {
      throw new Error(`POST /api/standby-ai/auto-dispatch-responder failed with HTTP ${dispatchRes.status}`);
    }
    const dispatchData = (await dispatchRes.json()) as StandbyAutoDispatchResponse;
    const candidates = dispatchData.rankedCandidates ?? [];

    if (dispatchData.success !== true || candidates.length === 0) {
      throw new Error(
        `Expected auto-dispatch success === true and rankedCandidates.length > 0, got success=${String(dispatchData.success)}, count=${candidates.length}`
      );
    }

    const unchosenUnits = candidates.filter(
      (c: StandbyCandidateScore) => c.neverChosenBefore === true || c.historicalDispatchCount === 0
    );
    if (unchosenUnits.length === 0) {
      throw new Error('Expected at least one unchosen responder candidate unit to verify fairness rotation boost.');
    }
    for (const unit of unchosenUnits) {
      if (unit.fairnessRotationScore !== 100) {
        throw new Error(
          `Expected unchosen unit ${unit.unitCode} to receive fairnessRotationScore === 100, got ${unit.fairnessRotationScore}`
        );
      }
    }
    console.log('   [PASS] Test 1: Standby AI Governance & Fairness Rotation Score (100) verified!\n');

    // =========================================================================
    // TEST 2: Unified Phase 2 Government ID Gate & Claude Vision Visible-Only Auto-Fill
    // =========================================================================
    console.log(`[Test 2] Navigating to ${REGISTER_URL} and advancing to Unified Phase 2 (#phase-2-id-identity)...`);
    await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
    await delay(1000);

    await page.waitForSelector('#phase-1-role', { state: 'visible', timeout: 5000 });
    await page.click('button#role-btn-civilian');
    await delay(250);
    await page.click('button#btn-phase1-next');
    await delay(500);

    await page.waitForSelector('#phase-2-id-identity', { state: 'visible', timeout: 5000 });
    await page.waitForSelector('select#id-type', { state: 'visible', timeout: 5000 });

    const initialIdVal = await page.locator('select#id-type').inputValue();
    if (initialIdVal !== '') {
      throw new Error(`Expected select#id-type to start at "" ("Choose ID Type"), got '${initialIdVal}'.`);
    }
    const firstIdOption = page.locator('select#id-type option').first();
    const firstOptionText = ((await firstIdOption.textContent()) ?? '').trim();
    const firstOptionValue = await firstIdOption.getAttribute('value');
    if (firstOptionText !== 'Choose ID Type' || firstOptionValue !== '') {
      throw new Error(`Expected first option value="" text="Choose ID Type", got value="${firstOptionValue}" text="${firstOptionText}".`);
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
      const count = await page.locator(lockedSel).count();
      if (count !== 0) {
        throw new Error(`Security Gate Violation: ${lockedSel} must stay unmounted before choosing ID type (count=${count}).`);
      }
    }
    if (!(await page.locator('button#btn-phase2-next').isDisabled())) {
      throw new Error('Expected #btn-phase2-next to stay disabled while idType === "".');
    }
    await page.locator('ol.steps li[data-step-item="2"]').click();
    if ((await page.locator('#phase-2-id-identity').count()) !== 1 || (await page.locator('#phase-3-facial-record').count()) !== 0) {
      throw new Error('Expected Phase 2 advancement to stay blocked while idType is empty.');
    }
    const idTypeErr = page.locator('#id-type-error');
    await idTypeErr.waitFor({ state: 'visible', timeout: 5000 });
    if ((await idTypeErr.getAttribute('role')) !== 'alert') {
      throw new Error('Expected #id-type-error to have role="alert".');
    }

    // --- 2A. Negative Blank-PNG Check ---
    console.log('   [2A] Selecting PhilSys & uploading distinct flat blank PNGs to verify local preflight gate & zero leaked PII...');
    await page.selectOption('select#id-type', 'philsys');
    if ((await page.locator('#id-type-error').count()) !== 0) {
      throw new Error('Expected #id-type-error to clear after selecting "philsys".');
    }
    if ((await page.locator('#id-upload-locked-notice').count()) !== 0) {
      throw new Error('Expected #id-upload-locked-notice to vanish after selecting "philsys".');
    }
    await page.waitForSelector('#id-upload-section', { state: 'visible', timeout: 5000 });
    if ((await page.locator('#personal-info-section').count()) !== 0) {
      throw new Error('Expected #personal-info-section to remain unmounted before dual-side ID upload.');
    }

    await page.setInputFiles('input#front-id-input', blankFrontPath);
    await delay(200);
    await page.setInputFiles('input#back-id-input', blankBackPath);

    const idBanner = page.locator('#id-verification-banner');
    await idBanner.waitFor({ state: 'visible', timeout: 10000 });
    const rejectedBanner = page.locator('#banner-id-rejected');
    await rejectedBanner.waitFor({ state: 'visible', timeout: 10000 });

    const blankBannerStatus = await idBanner.getAttribute('data-verification-status');
    const blankErrorCode = await idBanner.getAttribute('data-error-code');
    const rejectedText = (await rejectedBanner.innerText()).trim();
    if (!rejectedText || (blankBannerStatus !== 'REJECTED_LOCAL' && blankBannerStatus !== 'REJECTED_AI')) {
      throw new Error(
        `Expected #banner-id-rejected on blank PNGs, got status=${String(blankBannerStatus)}, code=${String(blankErrorCode)}, text="${rejectedText}"`
      );
    }
    if ((await page.locator('#personal-info-section').count()) !== 0) {
      throw new Error('Security Gate Violation: #personal-info-section mounted after blank PNG rejection.');
    }
    const nextDisabledOnBlank = await page.locator('button#btn-phase2-next').isDisabled();
    if (!nextDisabledOnBlank) {
      throw new Error('Expected #btn-phase2-next to stay disabled after blank PNG rejection.');
    }
    assertNoBannedTokens('Blank-PNG #phase-2-id-identity', await page.locator('#phase-2-id-identity').innerText());

    const clearBtnAfterBlank = page.locator('#btn-clear-both-ids');
    if ((await clearBtnAfterBlank.count()) > 0 && (await clearBtnAfterBlank.isVisible())) {
      await clearBtnAfterBlank.click();
      await page.waitForFunction(() => !document.querySelector('#front-id-preview') && !document.querySelector('#back-id-preview'));
    }
    console.log(`   [PASS] Test 2A: Blank-PNG local gate (${String(blankErrorCode)}) blocked #personal-info-section!`);

    // --- 2B. Positive Visible-Only ELENA MARQUEZ Check ---
    console.log('   [2B] Selecting Drivers License and uploading distinct visible-only ELENA MARQUEZ Front & Back PNGs...');
    await page.selectOption('select#id-type', 'drivers');
    await page.waitForSelector('#id-upload-section', { state: 'visible', timeout: 5000 });
    await delay(250);

    const elenaOcrResPromise = page.waitForResponse(
      (res: Response) => res.url().includes('/api/identity/ocr/extract') && res.request().method() === 'POST',
      { timeout: 105000 }
    );
    await page.setInputFiles('input#front-id-input', elenaFrontPath);
    await delay(250);
    await page.setInputFiles('input#back-id-input', elenaBackPath);
    const elenaOcrRes = await elenaOcrResPromise;
    if (!elenaOcrRes.ok()) {
      throw new Error(`Elena OCR request failed with HTTP ${elenaOcrRes.status()}`);
    }
    const elenaOcrJson = (await elenaOcrRes.json()) as OcrExtractApiPayload;
    console.log(
      `   Elena API response: success=${String(elenaOcrJson.success)}, confidence=${String(elenaOcrJson.confidence)}, firstName=${String(elenaOcrJson.firstName)}, surname=${String(elenaOcrJson.surname)}, dob=${String(elenaOcrJson.dateOfBirth)}, sex=${String(elenaOcrJson.sex)}, license=${String(elenaOcrJson.licenseNumber)}`
    );
    if (elenaOcrJson.success !== true) {
      throw new Error(`Expected Elena OCR success === true, got ${JSON.stringify(elenaOcrJson)}`);
    }
    if (
      typeof elenaOcrJson.confidence !== 'number' ||
      elenaOcrJson.confidence <= 0.7 ||
      elenaOcrJson.confidence === 0.96 ||
      elenaOcrJson.confidence === 0.98
    ) {
      throw new Error(`Unexpected or hardcoded Elena OCR confidence: ${String(elenaOcrJson.confidence)}`);
    }

    await page.waitForSelector('#badge-id-verified-genuine', { state: 'visible', timeout: 45000 });
    await page.waitForSelector('#personal-info-section', { state: 'visible', timeout: 45000 });

    await page.waitForFunction(
      () => {
        const fn = document.querySelector('#personal-info-section input#first-name') as HTMLInputElement | null;
        const ln = document.querySelector('#personal-info-section input#last-name') as HTMLInputElement | null;
        return Boolean(fn && fn.value.trim() === 'ELENA' && ln && ln.value.trim() === 'MARQUEZ');
      },
      { timeout: 45000 }
    );

    const p2First = await page.inputValue('input#first-name');
    const p2Last = await page.inputValue('input#last-name');
    const p2Dob = await page.inputValue('input#dob');
    const p2Age = await page.inputValue('input#age');
    const p2Sex = await page.inputValue('select#sex');
    const p2License = await page.inputValue('input#license-number');
    const p2Middle = await page.inputValue('input#middle-name');
    const p2Suffix = await page.inputValue('input#suffix');
    const p2Weight = await page.inputValue('input#weight');
    const p2Height = await page.inputValue('input#height');
    const p2Phone = await page.inputValue('input#phone-number');

    const nowForAge = new Date();
    const elenaMonthDiff = nowForAge.getMonth() + 1 - 3;
    const expectedElenaAge = String(
      nowForAge.getFullYear() - 1994 - (elenaMonthDiff < 0 || (elenaMonthDiff === 0 && nowForAge.getDate() < 11) ? 1 : 0)
    );
    if (p2First !== 'ELENA' || p2Last !== 'MARQUEZ' || p2Dob !== '1994-03-11' || p2Age !== expectedElenaAge || p2Sex !== 'Female') {
      throw new Error(
        `Phase 2 synced values mismatch: first="${p2First}", last="${p2Last}", dob="${p2Dob}", age="${p2Age}", sex="${p2Sex}"`
      );
    }
    if (p2License !== 'K09-88-776655') {
      throw new Error(`Expected Phase 2 input#license-number === "K09-88-776655", got "${p2License}"`);
    }
    if (p2Middle !== '' || p2Suffix !== '' || p2Weight !== '' || p2Height !== '' || p2Phone !== '') {
      throw new Error(
        `Expected unseen Phase 2 fields to stay empty! middle="${p2Middle}", suffix="${p2Suffix}", weight="${p2Weight}", height="${p2Height}", phone="${p2Phone}"`
      );
    }
    for (const val of [p2First, p2Last, p2Dob, p2Age, p2Sex, p2License, p2Middle, p2Suffix, p2Weight, p2Height, p2Phone]) {
      assertNoBannedTokens('Phase 2 verified ELENA fields', val);
    }
    console.log(`   Verified canonical inputs (age=${p2Age}): ELENA MARQUEZ | 1994-03-11 | Female | K09-88-776655`);

    await page.screenshot({ path: PHASE2_UNIFIED_SCREENSHOT, fullPage: true });
    console.log(`   [Artifact] Captured unified Phase 2 screenshot to ${PHASE2_UNIFIED_SCREENSHOT}`);

    // Supply required fields omitted from the ID before advancing Phase 2 -> Phase 3 Facial
    await page.fill('input#phone-number', '+639185550404');
    if ((await page.inputValue('input#barangay')).trim() === '') {
      await page.fill('input#barangay', 'Barra');
    }
    if ((await page.inputValue('input#street-purok')).trim() === '') {
      await page.fill('input#street-purok', 'Barra Road');
    }
    console.log('   [PASS] Test 2: Unified Phase 2 Gate & Direct Visible-Only Auto-Fill verified!\n');

    // =========================================================================
    // TEST 3: Phase 3 30-60 FPS Facial Recognition, Retake Cache, Claude AI Geometry & SQL Server Persistence
    // =========================================================================
    console.log('[Test 3] Advancing to Phase 3 (#phase-3-facial-record, 30-60 FPS Multi-Pose Biometric Engine)...');
    await page.click('button#btn-phase2-next');
    await page.waitForSelector('#phase-3-facial-record', { state: 'visible', timeout: 5000 });
    await delay(500);

    const simulateBtn = page.locator('button#btn-simulate-4pose-capture');
    await simulateBtn.waitFor({ state: 'visible', timeout: 5000 });
    await simulateBtn.click();
    await delay(600);

    console.log('   Testing per-pose retake (button#btn-retake-pose-RIGHT) and re-simulating...');
    const retakeRightBtn = page.locator('button#btn-retake-pose-RIGHT');
    await retakeRightBtn.waitFor({ state: 'visible', timeout: 5000 });
    await retakeRightBtn.click();
    await delay(400);

    await simulateBtn.click();
    await delay(800);

    const statusCard = page.locator('#biometric-training-status-card');
    await statusCard.waitFor({ state: 'visible', timeout: 5000 });
    const trainedBadge = page.locator('#badge-biometric-trained');
    await trainedBadge.waitFor({ state: 'visible', timeout: 5000 });

    console.log('   Testing Retake All Poses + Live Camera 4-Pose 30-60 FPS Enrollment...');
    const retakeAllBtn = page.locator('button#btn-retake-all-poses');
    await retakeAllBtn.waitFor({ state: 'visible', timeout: 5000 });
    await retakeAllBtn.click();
    await delay(1400);

    const requestCamBtn = page.locator('button#btn-request-camera');
    if (await requestCamBtn.isVisible().catch(() => false)) {
      await requestCamBtn.click();
      await delay(1200);
    }

    const lockNextPoseBtn = page.locator('button#btn-lock-next-pose');
    const poseSchedule = [
      { label: 'Center (0 deg)', waitBeforeMs: 750 },
      { label: 'Right (+25 deg)', waitBeforeMs: 1400 },
      { label: 'Left (-25 deg)', waitBeforeMs: 1600 },
      { label: 'Blink Liveness', waitBeforeMs: 1200 }
    ] as const;
    for (const pose of poseSchedule) {
      if (await trainedBadge.isVisible().catch(() => false)) {
        break;
      }
      await delay(pose.waitBeforeMs);
      if (await trainedBadge.isVisible().catch(() => false)) {
        break;
      }
      if (await lockNextPoseBtn.isVisible().catch(() => false)) {
        console.log(`   Locking live camera pose: ${pose.label}...`);
        await lockNextPoseBtn.click().catch(() => undefined);
      }
    }

    await trainedBadge.waitFor({ state: 'visible', timeout: 15000 });
    const trainedBadgeText = await trainedBadge.innerText();
    console.log(`   Biometric Training Status Badge: ${trainedBadgeText}`);

    await page.locator('#chk-facial-consent').setChecked(true, { force: true });
    await delay(250);
    await page.click('button#btn-confirm-facial-capture');
    await page.waitForSelector('span#badge-facial-confirmed', { state: 'visible', timeout: 60000 });
    await delay(300);

    await page.click('button#btn-phase3-next');
    await delay(500);

    console.log('   Completing Phase 4 (Credentials) and Phase 5 (Review & Submission)...');
    await page.waitForSelector('#phase-4-credentials', { state: 'visible', timeout: 5000 });
    await page.fill('input#display-name', 'ElenaMarquezVerified');
    await page.fill('input#email', testEmail);
    await page.fill('input#password', testPassword);
    await page.fill('input#confirm', testPassword);
    await page.locator('input#consent-1').setChecked(true, { force: true });
    await page.locator('input#consent-2').setChecked(true, { force: true });
    await page.click('button#btn-phase4-next');
    await delay(600);

    await page.waitForSelector('#phase-5-review', { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: PHASE5_UNIFIED_SCREENSHOT, fullPage: true });
    console.log(`   [Artifact] Captured Phase 5 review screenshot to ${PHASE5_UNIFIED_SCREENSHOT}`);
    const reviewText = await page.locator('#phase-5-review').innerText();
    if (!reviewText.includes('ELENA') || !reviewText.includes('MARQUEZ') || !reviewText.includes('K09-88-776655')) {
      throw new Error(`Phase 5 review missing verified Elena Marquez details: ${reviewText}`);
    }

    let capturedRegisterPayload: CapturedRegisterPayload | null = null;
    let capturedRegisterResponse: CapturedRegisterResponse | null = null;

    const registerRequestPromise = page.waitForRequest(
      (req: Request) => req.url().includes('/api/register') && req.method() === 'POST',
      { timeout: 45000 }
    );
    const registerResponsePromise = page.waitForResponse(
      (res: Response) => res.url().includes('/api/register') && res.request().method() === 'POST',
      { timeout: 45000 }
    );

    const submitRegistrationBtn = page.locator('button#btn-submit-registration, button#submit').first();
    await submitRegistrationBtn.click();

    const [regReq, regRes] = await Promise.all([registerRequestPromise, registerResponsePromise]);
    capturedRegisterPayload = JSON.parse(regReq.postData() || '{}') as CapturedRegisterPayload;
    capturedRegisterResponse = (await regRes.json()) as CapturedRegisterResponse;

    if (
      !capturedRegisterPayload.biometricDescriptorVector ||
      capturedRegisterPayload.biometricDescriptorVector.length !== 128
    ) {
      throw new Error(
        `Expected POST /api/register payload to include 128-float biometricDescriptorVector, got length=${
          capturedRegisterPayload.biometricDescriptorVector?.length ?? 0
        }`
      );
    }
    if (!capturedRegisterPayload.geometricSignatureJson || capturedRegisterPayload.geometricSignatureJson.length < 10) {
      throw new Error('Expected POST /api/register payload to contain non-empty geometricSignatureJson.');
    }
    if (!capturedRegisterPayload.poseFramesJson || capturedRegisterPayload.poseFramesJson.length < 10) {
      throw new Error('Expected POST /api/register payload to contain non-empty poseFramesJson.');
    }
    if (!capturedRegisterResponse.userId) {
      throw new Error('Expected POST /api/register response to return a valid userId.');
    }
    console.log(
      `   [PASS] Test 3: 128-D Descriptor, Claude Geometric Signature & 4-Pose Cache persisted for userId=${capturedRegisterResponse.userId}!\n`
    );

    // =========================================================================
    // TEST 4: Standby Auto-Approve Government ID & 5-Layer Biometric Login Validation Pipeline
    // =========================================================================
    console.log('[Test 4] Auto-approving Government ID via Standby AI Strategy...');
    const approveRes = await fetch(`${BACKEND_BASE_URL}/api/standby-ai/auto-approve-gov-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: capturedRegisterResponse.userId,
        governmentIdType: 'drivers',
        firstName: 'ELENA',
        lastName: 'MARQUEZ',
        dateOfBirth: '1994-03-11',
        applyToDatabase: true
      })
    });
    if (!approveRes.ok) {
      throw new Error(`POST /api/standby-ai/auto-approve-gov-id failed with HTTP ${approveRes.status}`);
    }
    const approveData = (await approveRes.json()) as StandbyGovIdApproveResponse;
    if (approveData.approved !== true) {
      throw new Error(`Expected Standby AI Gov ID approval === true, got ${String(approveData.approved)}`);
    }
    console.log(`   Standby AI Decision: ${approveData.decisionStatus ?? ''} (${approveData.strategyName ?? ''})`);

    console.log(`   Navigating to ${LOGIN_URL} and opening Biometric Login Modal...`);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await delay(900);

    const openBioModalBtn = page
      .locator('button#biometric-login-btn, button:has-text("Sign In with Facial Biometrics")')
      .first();
    await openBioModalBtn.waitFor({ state: 'visible', timeout: 5000 });
    await openBioModalBtn.click();
    await delay(500);

    const pipelineContainer = page.locator('#biometric-5layer-pipeline');
    await pipelineContainer.waitFor({ state: 'visible', timeout: 5000 });
    const renderedLayerCount = await pipelineContainer.locator('[data-layer-code]').count();
    if (renderedLayerCount !== 5) {
      throw new Error(`Expected #biometric-5layer-pipeline to render 5 layers, found ${renderedLayerCount}`);
    }

    let bioLoginResolved = false;
    const bioLoginResponsePromise = page
      .waitForResponse(
        (res: Response) =>
          (res.url().includes('/api/biometric-login') || res.url().includes('/api/auth/biometric-login')) &&
          res.status() === 200,
        { timeout: 25000 }
      )
      .then((res) => {
        bioLoginResolved = true;
        return res;
      });

    const bioDebugListener = async (res: Response): Promise<void> => {
      if (res.url().includes('biometric-login') && res.status() !== 200) {
        const bodyText = await res.text().catch(() => '');
        console.log(`   [Biometric Login HTTP ${res.status()}] ${bodyText}`);
      }
    };
    page.on('response', bioDebugListener);

    await page.fill('input#bio-email', testEmail);
    await page.locator('button[type="submit"]:has-text("Activate Live Camera")').click();
    await delay(1400);

    if (!bioLoginResolved) {
      const syntheticScanBtn = page.locator('button#btn-synthetic-test-scan');
      const canClickManual =
        (await syntheticScanBtn.isVisible().catch(() => false)) &&
        (await syntheticScanBtn.isEnabled().catch(() => false));
      if (canClickManual) {
        await syntheticScanBtn.click().catch(() => undefined);
      }
    }

    const bioLoginRes = await bioLoginResponsePromise;
    const bioLoginData = (await bioLoginRes.json()) as BiometricLoginApiPayload;

    const verdict = bioLoginData.validationVerdict ?? bioLoginData.session?.validationVerdict;
    const strategyUsed = bioLoginData.biometricStrategyUsed ?? bioLoginData.session?.biometricStrategyUsed;
    const layers = bioLoginData.validationLayers ?? bioLoginData.session?.validationLayers ?? [];

    if (verdict !== 'SUCCESS_LOGIN') {
      throw new Error(`Expected validationVerdict === 'SUCCESS_LOGIN', got ${String(verdict)}`);
    }
    if (strategyUsed !== 'MultiLayerClaudeBiometricLoginStrategy') {
      throw new Error(
        `Expected biometricStrategyUsed === 'MultiLayerClaudeBiometricLoginStrategy', got ${String(strategyUsed)}`
      );
    }
    if (!Array.isArray(layers) || layers.length !== 5) {
      throw new Error(`Expected validationLayers length === 5, got ${Array.isArray(layers) ? layers.length : 0}`);
    }

    await delay(1500);
    await page.screenshot({ path: VERIFIED_SCREENSHOT_PATH, fullPage: false });
    console.log(`   [Artifact] Saved verification screenshot to ${VERIFIED_SCREENSHOT_PATH}`);

    const finalUrl = page.url();
    if (!finalUrl.includes('/civilian')) {
      throw new Error(`Expected redirect to /civilian dashboard after biometric login, landed on ${finalUrl}`);
    }
    console.log(`   [PASS] Test 4: 5-Layer Biometric Login verified and redirected to ${finalUrl}!\n`);

    console.log('========================================================================');
    console.log('   ALL 4 CLAUDE STRATEGY & MULTI-LAYER BIOMETRIC E2E TESTS PASSED!');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
    await servers.stopAll();
  }
};

runClaudeStrategyAndMultiLayerBiometricsE2E().catch((err: unknown) => {
  console.error('\n[FATAL E2E TEST FAILURE]:', err);
  process.exit(1);
});
