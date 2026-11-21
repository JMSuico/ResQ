// [Layer: Testing/Frontend]
// Responsibility: Real-server + Chromium Playwright E2E verification for:
//   1. Freshly registered Civilian & Responder (RHU) accounts are NEVER locked out for 15 minutes
//      even after 6 failed biometric login attempts, and succeed immediately in 1:1 and 1:N biometric login
//      without any system restart.
//   2. Visual UI inspection & computed typography/glassmorphism metrics across Landing Page,
//      Biometric Login Modal, Admin Portal, Responder RHU Portal, and Civilian Portal.
// Invariant: Strict TypeScript (zero 'any', zero emojis, 100% Universal Arrow Lambdas).

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  E2E_BACKEND_URL,
  E2E_CIVILIAN_FRONTEND_URL,
  E2E_RESPONDER_FRONTEND_URL,
  ensureE2eServersReady,
  probeHttpReady,
  type E2eServersHandle
} from './fixtures/e2eServerHarness';
import { writeY4mAndMatchingIdArtifacts } from './fixtures/y4mFaceAndMatchingIdFixture';

const ADMIN_URL = 'http://127.0.0.1:1996';
const ARTIFACT_DIR =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';

interface AuthApiResponse {
  readonly token?: string;
  readonly message?: string;
  readonly userId?: string;
  readonly status?: string;
  readonly role?: string;
  readonly unit?: string;
  readonly email?: string;
  readonly redirectUrl?: string;
  readonly session?: {
    readonly userId?: string;
    readonly email?: string;
    readonly fullName?: string;
    readonly role?: string;
    readonly unit?: string;
    readonly status?: string;
    readonly faceVerified?: boolean;
  };
}

interface UiAuditMetrics {
  readonly minFontPx: number;
  readonly bodyFontPx: number;
  readonly h1FontPx: number;
  readonly glassElementCount: number;
  readonly hasHorizontalOverflow: boolean;
  readonly tinySamples: readonly string[];
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

const normalizeUnitVector = (dominantIndex: number, secondaryIndex: number): number[] => {
  const vec = new Array<number>(128).fill(0);
  vec[dominantIndex] = 0.992;
  vec[secondaryIndex] = 0.126;
  const norm = Math.sqrt(vec.reduce((acc: number, v: number): number => acc + v * v, 0));
  return vec.map((v: number): number => Number((v / norm).toFixed(6)));
};

const postJson = async <TRes>(url: string, body: Record<string, unknown>): Promise<{ readonly status: number; readonly data: TRes }> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let parsed: TRes;
  try {
    parsed = JSON.parse(text) as TRes;
  } catch {
    parsed = { message: text } as unknown as TRes;
  }
  return { status: res.status, data: parsed };
};

const pngCrc32 = (bytes: Buffer): number => {
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

const makeDistinctPngDataUrl = (basePngBytes: Buffer, poseTag: string): string => {
  const tagBytes = Buffer.from(`PoseVariant\0${poseTag}`, 'ascii');
  const iendIndex = basePngBytes.lastIndexOf(Buffer.from('IEND', 'ascii')) - 4;
  const head = basePngBytes.subarray(0, iendIndex > 8 ? iendIndex : basePngBytes.length);
  const chunkType = Buffer.from('tEXt', 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(tagBytes.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(pngCrc32(Buffer.concat([chunkType, tagBytes])), 0);
  const tail = iendIndex > 8 ? basePngBytes.subarray(iendIndex) : Buffer.alloc(0);
  const out = Buffer.concat([head, lenBuf, chunkType, tagBytes, crcBuf, tail]);
  return `data:image/png;base64,${out.toString('base64')}`;
};

const mintPairedVerificationTokens = async (
  frontIdPath: string,
  backIdPath: string
): Promise<{
  readonly idVerificationToken: string;
  readonly facialVerificationToken: string;
  readonly frontIdDataUrl: string;
  readonly backIdDataUrl: string;
  readonly centerFaceDataUrl: string;
}> => {
  const frontBytes = readFileSync(frontIdPath);
  const backBytes = readFileSync(backIdPath);
  const portraitBytes = readFileSync(
    join(process.cwd(), 'Testing', 'Frontend', 'fixtures', 'assets', 'elena_headshot_280.png')
  );
  const frontIdDataUrl = `data:image/png;base64,${frontBytes.toString('base64')}`;
  const backIdDataUrl = `data:image/png;base64,${backBytes.toString('base64')}`;
  const centerFaceDataUrl = makeDistinctPngDataUrl(portraitBytes, 'CENTER_0');
  const rightFaceDataUrl = makeDistinctPngDataUrl(portraitBytes, 'RIGHT_25');
  const leftFaceDataUrl = makeDistinctPngDataUrl(portraitBytes, 'LEFT_25');
  const blinkFaceDataUrl = makeDistinctPngDataUrl(portraitBytes, 'BLINK_EAR');

  const form = new FormData();
  form.append('frontImage', new Blob([frontBytes], { type: 'image/png' }), 'elena_front.png');
  form.append('backImage', new Blob([backBytes], { type: 'image/png' }), 'elena_back.png');
  form.append('idType', 'drivers');
  form.append('requireDualSide', 'true');

  const ocrRes = await fetch(`${E2E_BACKEND_URL}/api/identity/ocr/extract`, {
    method: 'POST',
    body: form
  });
  const ocrJson = (await ocrRes.json()) as {
    readonly success?: boolean;
    readonly idVerificationToken?: string;
    readonly errorMessage?: string;
  };
  assertCondition(
    ocrRes.status === 200 && Boolean(ocrJson.idVerificationToken),
    `OCR endpoint minted IdVerificationToken cleanly (HTTP ${ocrRes.status} msg=${ocrJson.errorMessage ?? 'ok'})`
  );

  const bioRes = await postJson<{
    readonly facialVerificationToken?: string;
    readonly isFaceMatchedToId?: boolean;
    readonly errorMessage?: string;
  }>(`${E2E_BACKEND_URL}/api/identity/biometrics/analyze-geometry`, {
    centerFrameDataUrl: centerFaceDataUrl,
    rightFrameDataUrl: rightFaceDataUrl,
    leftFrameDataUrl: leftFaceDataUrl,
    blinkFrameDataUrl: blinkFaceDataUrl,
    frontIdDataUrl,
    idVerificationToken: ocrJson.idVerificationToken,
    poseFramesJson: JSON.stringify({
      CENTER: centerFaceDataUrl,
      RIGHT: rightFaceDataUrl,
      LEFT: leftFaceDataUrl,
      BLINK: blinkFaceDataUrl
    }),
    totalCachedFrames: 24,
    samplingFps: 60
  });
  assertCondition(
    bioRes.status === 200 && Boolean(bioRes.data.facialVerificationToken),
    `Biometric geometry endpoint minted FacialVerificationToken cleanly (HTTP ${bioRes.status} msg=${bioRes.data.errorMessage ?? 'ok'})`
  );

  return {
    idVerificationToken: ocrJson.idVerificationToken ?? '',
    facialVerificationToken: bioRes.data.facialVerificationToken ?? '',
    frontIdDataUrl,
    backIdDataUrl,
    centerFaceDataUrl
  };
};

const verifyFreshRegistrationAndImmediateBiometricLogin = async (): Promise<{
  readonly civilianEmail: string;
  readonly civilianToken: string;
  readonly civilianSession: Record<string, unknown>;
  readonly responderEmail: string;
  readonly responderToken: string;
  readonly responderSession: Record<string, unknown>;
}> => {
  const stamp = Date.now();
  const fixtureWorkDir = join(tmpdir(), `resqtrack-fresh-e2e-${stamp}`);
  mkdirSync(fixtureWorkDir, { recursive: true });

  const artifacts = writeY4mAndMatchingIdArtifacts(fixtureWorkDir);
  const civTokens = await mintPairedVerificationTokens(artifacts.frontIdPath, artifacts.backIdPath);
  const rhuTokens = await mintPairedVerificationTokens(artifacts.frontIdPath, artifacts.backIdPath);
  rmSync(fixtureWorkDir, { recursive: true, force: true });

  // Use a unique orthogonal dimension pair per fresh account so 1:N identifies them immediately
  const civVector = normalizeUnitVector(17, 19);
  const respVector = normalizeUnitVector(29, 31);
  const mismatchVector = normalizeUnitVector(111, 113);

  const civilianEmail = `fresh-civ-${stamp}@katipunan.local`;
  const responderEmail = `fresh-rhu-${stamp}@katipunan.local`;

  console.log('\n[1] Registering fresh Civilian & Responder (RHU) accounts with biometric vectors & paired tokens...');
  const civReg = await postJson<AuthApiResponse>(`${E2E_BACKEND_URL}/api/register`, {
    email: civilianEmail,
    password: 'ResQTrack!2026#SafeUser',
    confirmPassword: 'ResQTrack!2026#SafeUser',
    fullName: 'Elena Marquez Reyes',
    firstName: 'Elena',
    middleName: 'Marquez',
    surname: 'Reyes',
    dateOfBirth: '1994-03-11',
    sex: 'Female',
    age: 32,
    province: 'Zamboanga del Norte',
    cityOrMunicipality: 'Katipunan',
    barangay: 'Uno',
    streetOrPurok: 'Purok Mabini',
    phoneNumber: '09171234561',
    validIdType: 'drivers',
    governmentIdType: 'drivers',
    governmentIdNumber: `K09-95-${stamp % 100000}`,
    role: 'Civilian',
    unit: 'None',
    consentAccepted: true,
    consentNoticeVersion: '2026.1',
    biometricDescriptorVector: civVector,
    geometricSignatureJson: JSON.stringify({
      source: 'playwright-4pose-e2e',
      poseCount: 4,
      eyeAspectRatio: 0.31
    }),
    poseFramesJson: JSON.stringify({
      CENTER: civTokens.frontIdDataUrl,
      RIGHT: civTokens.frontIdDataUrl,
      LEFT: civTokens.frontIdDataUrl,
      BLINK: civTokens.frontIdDataUrl
    }),
    aiBiometricStrategyName: 'ResQTrack_Hybrid_CSLBP_Gabor_Haar',
    idCaptureDataUrl: civTokens.frontIdDataUrl,
    idBackCaptureDataUrl: civTokens.backIdDataUrl,
    faceCaptureDataUrl: civTokens.frontIdDataUrl,
    idVerificationToken: civTokens.idVerificationToken,
    facialVerificationToken: civTokens.facialVerificationToken
  });
  assertCondition(
    civReg.status === 201 && civReg.data.status === 'Verified',
    `Fresh Civilian registration returned HTTP ${civReg.status} status=${civReg.data.status ?? civReg.data.message}`
  );

  const rhuReg = await postJson<AuthApiResponse>(`${E2E_BACKEND_URL}/api/register`, {
    email: responderEmail,
    password: 'ResQTrack!2026#SafeRhu',
    confirmPassword: 'ResQTrack!2026#SafeRhu',
    fullName: 'Elena Marquez Santos',
    firstName: 'Elena',
    middleName: 'Marquez',
    surname: 'Santos',
    dateOfBirth: '1991-09-20',
    sex: 'Female',
    age: 35,
    province: 'Zamboanga del Norte',
    cityOrMunicipality: 'Katipunan',
    barangay: 'Dos',
    streetOrPurok: 'RHU Health Center',
    phoneNumber: '09179876541',
    employeeOrResidentId: `RHU-KTP-${stamp % 100000}`,
    validIdType: 'drivers',
    governmentIdType: 'drivers',
    governmentIdNumber: `K09-91-${stamp % 100000}`,
    role: 'Responder',
    unit: 'RHU',
    departmentOrBarangay: 'RHU Medical Dispatch',
    rankOrTitle: 'EMT-Lead',
    consentAccepted: true,
    consentNoticeVersion: '2026.1',
    biometricDescriptorVector: respVector,
    geometricSignatureJson: JSON.stringify({
      source: 'playwright-4pose-e2e',
      poseCount: 4,
      eyeAspectRatio: 0.32
    }),
    poseFramesJson: JSON.stringify({
      CENTER: rhuTokens.frontIdDataUrl,
      RIGHT: rhuTokens.frontIdDataUrl,
      LEFT: rhuTokens.frontIdDataUrl,
      BLINK: rhuTokens.frontIdDataUrl
    }),
    aiBiometricStrategyName: 'ResQTrack_Hybrid_CSLBP_Gabor_Haar',
    idCaptureDataUrl: rhuTokens.frontIdDataUrl,
    idBackCaptureDataUrl: rhuTokens.backIdDataUrl,
    faceCaptureDataUrl: rhuTokens.frontIdDataUrl,
    idVerificationToken: rhuTokens.idVerificationToken,
    facialVerificationToken: rhuTokens.facialVerificationToken
  });
  assertCondition(
    rhuReg.status === 201 && rhuReg.data.status === 'Verified',
    `Fresh Responder (RHU) registration returned HTTP ${rhuReg.status} status=${rhuReg.data.status ?? rhuReg.data.message}`
  );

  console.log('\n[2] Hammering Biometric Login with 6 consecutive mismatches on BOTH fresh accounts (must NEVER lock out)...');
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const civFail = await postJson<AuthApiResponse>(`${E2E_BACKEND_URL}/api/biometric-login`, {
      email: civilianEmail,
      liveDescriptorVector: mismatchVector,
      livenessScore: 0.92
    });
    const civMsg = (civFail.data.message ?? '').toLowerCase();
    assertCondition(
      civFail.status === 401 && !civMsg.includes('temporarily locked') && !civMsg.includes('wait 15 minute'),
      `Civilian mismatch #${attempt} returned HTTP ${civFail.status} without 15-min lockout: "${civFail.data.message}"`
    );

    const rhuFail = await postJson<AuthApiResponse>(`${E2E_BACKEND_URL}/api/biometric-login`, {
      email: responderEmail,
      liveDescriptorVector: mismatchVector,
      livenessScore: 0.92
    });
    const rhuMsg = (rhuFail.data.message ?? '').toLowerCase();
    assertCondition(
      rhuFail.status === 401 && !rhuMsg.includes('temporarily locked') && !rhuMsg.includes('wait 15 minute'),
      `Responder mismatch #${attempt} returned HTTP ${rhuFail.status} without 15-min lockout: "${rhuFail.data.message}"`
    );
  }

  console.log('\n[3] Verifying immediate 1:1 AND 1:N Biometric Login WITHOUT server restart...');
  const civLogin1to1 = await postJson<AuthApiResponse>(`${E2E_BACKEND_URL}/api/biometric-login`, {
    email: civilianEmail,
    liveDescriptorVector: civVector,
    livenessScore: 0.94
  });
  assertCondition(
    civLogin1to1.status === 200 && Boolean(civLogin1to1.data.token),
    `Fresh Civilian immediate 1:1 biometric login succeeded (HTTP ${civLogin1to1.status} msg=${civLogin1to1.data.message ?? 'ok'})`
  );

  const rhuLogin1to1 = await postJson<AuthApiResponse>(`${E2E_BACKEND_URL}/api/biometric-login`, {
    email: responderEmail,
    liveDescriptorVector: respVector,
    livenessScore: 0.94
  });
  assertCondition(
    rhuLogin1to1.status === 200 && Boolean(rhuLogin1to1.data.token),
    `Fresh Responder (RHU) immediate 1:1 biometric login succeeded (HTTP ${rhuLogin1to1.status} msg=${rhuLogin1to1.data.message ?? 'ok'})`
  );

  const civLogin1toN = await postJson<AuthApiResponse>(`${E2E_BACKEND_URL}/api/biometric-login`, {
    liveDescriptorVector: civVector,
    livenessScore: 0.94
  });
  assertCondition(
    civLogin1toN.status === 200 && civLogin1toN.data.session?.email === civilianEmail,
    `Fresh Civilian passwordless 1:N biometric login matched immediately without restart (matched=${civLogin1toN.data.session?.email ?? civLogin1toN.data.message})`
  );

  const rhuLogin1toN = await postJson<AuthApiResponse>(`${E2E_BACKEND_URL}/api/biometric-login`, {
    liveDescriptorVector: respVector,
    livenessScore: 0.94
  });
  assertCondition(
    rhuLogin1toN.status === 200 && rhuLogin1toN.data.session?.email === responderEmail,
    `Fresh Responder passwordless 1:N biometric login matched immediately without restart (matched=${rhuLogin1toN.data.session?.email ?? rhuLogin1toN.data.message})`
  );

  return {
    civilianEmail,
    civilianToken: civLogin1to1.data.token ?? '',
    civilianSession: (civLogin1to1.data.session ?? {}) as Record<string, unknown>,
    responderEmail,
    responderToken: rhuLogin1to1.data.token ?? '',
    responderSession: (rhuLogin1to1.data.session ?? {}) as Record<string, unknown>
  };
};

const inspectPageUiMetrics = async (
  page: Page,
  label: string,
  screenshotPath?: string
): Promise<UiAuditMetrics> => {
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }
  const metrics = await page.evaluate((): UiAuditMetrics => {
    const bodyStyle = window.getComputedStyle(document.body);
    const bodyFontPx = parseFloat(bodyStyle.fontSize || '14');
    const h1 = document.querySelector('h1');
    const h1FontPx = h1 ? parseFloat(window.getComputedStyle(h1).fontSize || '0') : bodyFontPx;

    let minFontPx = 99;
    let glassElementCount = 0;
    const tinySamples: string[] = [];

    const nodes = Array.from(document.querySelectorAll('h1,h2,h3,p,span,a,button,label,input,td,th,div'));
    for (const el of nodes) {
      if (el.closest('.leaflet-control-attribution') || el.closest('.recharts-wrapper')) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const textLen = (el.textContent ?? '').trim().length;
      if (textLen > 0 && el.children.length === 0) {
        const fs = parseFloat(style.fontSize || '14');
        if (fs > 0 && fs < minFontPx) {
          minFontPx = fs;
        }
        if (fs > 0 && fs < 12 && tinySamples.length < 6) {
          tinySamples.push(`${fs}px<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}" text="${(el.textContent ?? '').trim().slice(0, 30)}">`);
        }
      }

      const bf = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter') || '';
      if (bf.includes('blur(')) {
        glassElementCount += 1;
      }
    }

    const hasHorizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
    return {
      minFontPx: minFontPx === 99 ? bodyFontPx : minFontPx,
      bodyFontPx,
      h1FontPx,
      glassElementCount,
      hasHorizontalOverflow,
      tinySamples
    };
  });

  console.log(
    `[UI METRICS: ${label}] body=${metrics.bodyFontPx}px, minText=${metrics.minFontPx}px, h1=${metrics.h1FontPx}px, glassEls=${metrics.glassElementCount}, overflow=${metrics.hasHorizontalOverflow}`
  );
  if (metrics.tinySamples.length > 0) {
    console.log(`[TINY SAMPLES: ${label}] ${metrics.tinySamples.join(' | ')}`);
  }
  assertCondition(metrics.bodyFontPx >= 14, `${label}: root body font (${metrics.bodyFontPx}px) >= 14px`);
  assertCondition(metrics.minFontPx >= 11.5, `${label}: visible text floor (${metrics.minFontPx}px) >= 11.5px`);
  assertCondition(metrics.glassElementCount >= 1, `${label}: dark frosted glassmorphism active (${metrics.glassElementCount} blur surfaces)`);
  assertCondition(!metrics.hasHorizontalOverflow, `${label}: zero horizontal overflow at 1366px`);
  return metrics;
};

const runSuite = async (): Promise<void> => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  let servers: E2eServersHandle | null = null;
  let adminProc: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    servers = await ensureE2eServersReady({ includeResponder: true, useWireServer: true });

    const adminAlreadyUp = await probeHttpReady(ADMIN_URL);
    if (!adminAlreadyUp) {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      adminProc = spawn(npmCmd, ['run', 'dev:admin'], {
        cwd: join(process.cwd(), 'Project system ENGINE', 'Frontend'),
        stdio: 'ignore',
        shell: process.platform === 'win32'
      });
      for (let i = 0; i < 40; i += 1) {
        if (await probeHttpReady(ADMIN_URL, 1500)) break;
        await delay(500);
      }
    }

    const authResult = await verifyFreshRegistrationAndImmediateBiometricLogin();

    browser = await chromium.launch({ channel: 'chrome', headless: true });

    // 1. Landing Page + Login/Biometric Modal
    const guestCtx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const guestPage: Page = await guestCtx.newPage();

    await guestPage.goto(`${E2E_CIVILIAN_FRONTEND_URL}/`, { waitUntil: 'domcontentloaded' });
    await guestPage.locator('h1').first().waitFor({ state: 'visible', timeout: 15000 });
    await delay(800);
    await inspectPageUiMetrics(guestPage, 'Landing Page', join(ARTIFACT_DIR, 'ui_review_landing_glass.png'));

    await guestPage.goto(`${E2E_CIVILIAN_FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
    await guestPage.locator('input#email').waitFor({ state: 'visible', timeout: 15000 });
    await delay(500);
    const bioTrigger = guestPage.locator('button:has-text("Face Login"), button:has-text("Biometric"), button:has-text("Scan Face")').first();
    await bioTrigger.click();
    await guestPage.locator('input#bio-email').waitFor({ state: 'visible', timeout: 8000 });
    await guestPage.locator('input#bio-email').fill('civilian1@gmail.com');
    await guestPage.locator('#btn-synthetic-test-scan').click();
    const fallback1ToNBtn = guestPage.locator('#btn-fallback-1ton-scan');
    await fallback1ToNBtn.waitFor({ state: 'visible', timeout: 10000 });
    await inspectPageUiMetrics(guestPage, 'Biometric Login Modal', join(ARTIFACT_DIR, 'ui_review_biometric_modal_glass.png'));
    await fallback1ToNBtn.click();
    await delay(300);
    const emailAfterFallback = await guestPage.locator('input#bio-email').inputValue();
    assertCondition(emailAfterFallback === '', 'Clicking Switch to 1:N Face Scan clears un-enrolled email cleanly');
    const modalText = await guestPage.locator('body').innerText();
    assertCondition(
      !modalText.toLowerCase().includes('temporarily locked'),
      'Biometric Login Modal contains zero 15-minute lockout notices'
    );
    await guestCtx.close();

    // 2. Admin LDRRMO Portal
    const adminCtx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    await adminCtx.addInitScript((): void => {
      const adminUser = {
        userId: 'usr-admin-e2e',
        id: 'usr-admin-e2e',
        fullName: 'Commander Carlos Mendez',
        role: 'LDRRMO_Admin',
        unit: 'NONE',
        email: 'ldrrmo.admin@resqtrack.gov.ph'
      };
      localStorage.setItem('resqtrack_user', JSON.stringify(adminUser));
      localStorage.setItem('resqtrack_session', JSON.stringify(adminUser));
      localStorage.setItem('resqtrack_user_1996', JSON.stringify(adminUser));
      localStorage.setItem('resqtrack_token_1996', 'e2e-admin-token');
      sessionStorage.setItem('resqtrack_user', JSON.stringify(adminUser));
      sessionStorage.setItem('resqtrack_token', 'e2e-admin-token');
    });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(`${ADMIN_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await adminPage.locator('h3:has-text("Incident Trend")').waitFor({ state: 'visible', timeout: 15000 });
    await delay(800);
    await inspectPageUiMetrics(adminPage, 'Admin LDRRMO Portal', join(ARTIFACT_DIR, 'ui_review_admin_portal_glass.png'));
    await adminCtx.close();

    // 3. Responder RHU Portal (authenticated with REAL token returned by fresh Biometric Login!)
    const respCtx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    await respCtx.addInitScript((initData: { readonly user: Record<string, unknown>; readonly token: string }): void => {
      localStorage.setItem('resqtrack_user', JSON.stringify(initData.user));
      localStorage.setItem('resqtrack_session', JSON.stringify(initData.user));
      localStorage.setItem('resqtrack_user_1997', JSON.stringify(initData.user));
      localStorage.setItem('resqtrack_token_1997', initData.token);
      sessionStorage.setItem('resqtrack_user', JSON.stringify(initData.user));
      sessionStorage.setItem('resqtrack_token', initData.token);
    }, { user: authResult.responderSession, token: authResult.responderToken });
    const respPage = await respCtx.newPage();
    await respPage.goto(`${E2E_RESPONDER_FRONTEND_URL}/responder/dashboard`, { waitUntil: 'domcontentloaded' });
    await respPage.locator('aside.sidebar').waitFor({ state: 'visible', timeout: 15000 });
    await delay(1000);
    await inspectPageUiMetrics(respPage, 'Responder RHU Portal', join(ARTIFACT_DIR, 'ui_review_responder_portal_glass.png'));
    await respCtx.close();

    // 4. Civilian Portal (authenticated with REAL token returned by fresh Biometric Login!)
    const civCtx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    await civCtx.addInitScript((initData: { readonly user: Record<string, unknown>; readonly token: string }): void => {
      localStorage.setItem('resqtrack_user', JSON.stringify(initData.user));
      localStorage.setItem('resqtrack_session', JSON.stringify(initData.user));
      localStorage.setItem('resqtrack_user_1998', JSON.stringify(initData.user));
      localStorage.setItem('resqtrack_token_1998', initData.token);
      sessionStorage.setItem('resqtrack_user', JSON.stringify(initData.user));
      sessionStorage.setItem('resqtrack_token', initData.token);
    }, { user: authResult.civilianSession, token: authResult.civilianToken });
    const civPage = await civCtx.newPage();
    await civPage.goto(`${E2E_CIVILIAN_FRONTEND_URL}/civilian/dashboard`, { waitUntil: 'domcontentloaded' });
    await civPage.locator('aside.sidebar').waitFor({ state: 'visible', timeout: 15000 });
    await delay(1000);
    await inspectPageUiMetrics(civPage, 'Civilian Portal', join(ARTIFACT_DIR, 'ui_review_civilian_portal_glass.png'));
    await civCtx.close();

    assertCondition(
      existsSync(join(ARTIFACT_DIR, 'ui_review_landing_glass.png')) &&
        existsSync(join(ARTIFACT_DIR, 'ui_review_biometric_modal_glass.png')) &&
        existsSync(join(ARTIFACT_DIR, 'ui_review_admin_portal_glass.png')) &&
        existsSync(join(ARTIFACT_DIR, 'ui_review_responder_portal_glass.png')) &&
        existsSync(join(ARTIFACT_DIR, 'ui_review_civilian_portal_glass.png')),
      'All 5 UI portal review screenshots generated cleanly'
    );

    console.log('\nALL FRESH-ACCOUNT BIOMETRIC NO-LOCKOUT & MULTI-PORTAL UI CHECKS PASSED!');
  } finally {
    if (browser) {
      await browser.close();
    }
    if (adminProc?.pid) {
      try {
        spawnSync('taskkill', ['/PID', String(adminProc.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        // Ignore cleanup failure.
      }
    }
    if (servers) {
      await servers.stopAll();
    }
  }
};

runSuite().catch((err: unknown): void => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[FATAL ERROR] ${message}`);
  process.exit(1);
});
