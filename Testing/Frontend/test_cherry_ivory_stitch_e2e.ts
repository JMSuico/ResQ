// [Layer: Testing/Frontend]
// Comprehensive Playwright E2E & Visual Audit for Official Cherry/Warm Ivory Stitch Overhaul,
// Portal Additions/Renames/Removals, Instructor #1-#9 Report Requirements, and Desktop/Mobile Responsiveness.
// Strict TypeScript (zero 'any', zero emojis, 100% Universal Arrow Lambdas).

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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

const ADMIN_URL = 'http://127.0.0.1:1996';
const ARTIFACT_DIR =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';

const delay = (ms: number): Promise<void> =>
  new Promise((resolve: () => void): void => {
    setTimeout(resolve, ms);
  });

const assertCondition = (cond: boolean, msg: string): void => {
  if (!cond) {
    throw new Error(`[ASSERTION FAILED] ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
};

const checkNoHorizontalOverflow = async (page: Page, label: string): Promise<void> => {
  const overflow = await page.evaluate(
    (): boolean => document.documentElement.scrollWidth > window.innerWidth + 4
  );
  assertCondition(!overflow, `${label}: zero horizontal overflow`);
};

const runCherryIvoryStitchE2e = async (): Promise<void> => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  let servers: E2eServersHandle | null = null;
  let adminProc: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    servers = await ensureE2eServersReady({ includeResponder: true, useWireServer: true });
    const adminUp = await probeHttpReady(ADMIN_URL);
    if (!adminUp) {
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

    // 1. Authenticate as Civilian & Verify Backend Instructor #1/#2/#5/#7 contracts on POST /api/reports + GET /api/reports
    console.log('\n[1] Signing in as seeded Civilian & verifying Instructor #1/#2/#5/#7 contracts...');
    const loginRes = await fetch(`${E2E_BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'resident.juan@resqtrack.gov.ph',
        password: 'CivilianSafe@2026!',
        selectedTabRole: 'Civilian',
        portalOrigin: 'ResponderCivilian'
      })
    });
    assertCondition(loginRes.status === 200, `POST /api/login returned HTTP ${loginRes.status}`);
    const loginJson = (await loginRes.json()) as {
      readonly token?: string;
      readonly session?: { readonly userId?: string };
    };
    const civToken = loginJson.token ?? '';
    const civUserId = loginJson.session?.userId ?? '';
    assertCondition(civToken.length > 10, 'Obtained real Civilian bearer token for report submission');

    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
    const repRes = await fetch(`${E2E_BACKEND_URL}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${civToken}`,
        'X-Forwarded-For': '203.0.113.77'
      },
      body: JSON.stringify({
        title: 'Cherry Stitch E2E Collision',
        note: 'Two-vehicle collision verification check',
        category: 'VehicularAccident',
        severity: 'Medium',
        latitude: 8.5147,
        longitude: 123.2842,
        gpsAccuracyMeters: 7.5,
        isHardwareGeolocated: true,
        isBlurry: false,
        requiresManualVerification: false,
        locationLabel: 'Katipunan Junction',
        imageDataUrl: tinyPng,
        reporterContactNumber: '09171239999'
      })
    });
    assertCondition(repRes.status === 201, `POST /api/reports returned HTTP ${repRes.status}`);
    const repJson = (await repRes.json()) as {
      readonly report?: {
        readonly category?: string | number;
        readonly status?: string | number;
        readonly verifiedAt?: string | null;
        readonly submittedIpAddress?: string | null;
        readonly reporterContactNumber?: string | null;
      };
    };
    assertCondition(
      typeof repJson.report?.category === 'string' && repJson.report?.category === 'VehicularAccident',
      `Report category serialized as string enum 'VehicularAccident' (got=${String(repJson.report?.category ?? '')})`
    );
    const statusStr = String(repJson.report?.status ?? '');
    assertCondition(
      statusStr === 'Reported' || statusStr === '0',
      `New upload starts in Reported/Submitted status (got=${statusStr})`
    );
    assertCondition(repJson.report?.verifiedAt == null, 'New upload has null VerifiedAt (not auto-verified)');
    assertCondition(
      repJson.report?.submittedIpAddress === '203.0.113.77',
      `Captured client IP (got=${repJson.report?.submittedIpAddress ?? 'null'})`
    );
    assertCondition(
      repJson.report?.reporterContactNumber === '09171239999',
      `Persisted personal contact number (got=${repJson.report?.reporterContactNumber ?? 'null'})`
    );

    const civListRes = await fetch(`${E2E_BACKEND_URL}/api/reports`, {
      headers: { Authorization: `Bearer ${civToken}` }
    });
    assertCondition(civListRes.status === 200, `Civilian GET /api/reports returned HTTP ${civListRes.status}`);
    const civReports = (await civListRes.json()) as Array<{ readonly reporterId?: string }>;
    assertCondition(
      civReports.length > 0 && civReports.every((r) => r.reporterId === civUserId),
      `Civilian GET /api/reports strictly filters to own reports only (${civReports.length} rows)`
    );

    browser = await chromium.launch({ channel: 'chrome', headless: true });

    // 2. Landing & Biometric Modal
    const guestCtx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const guestPage: Page = await guestCtx.newPage();
    await guestPage.goto(`${E2E_CIVILIAN_FRONTEND_URL}/`, { waitUntil: 'domcontentloaded' });
    await guestPage.locator('h1').first().waitFor({ state: 'visible', timeout: 15000 });
    await delay(700);
    assertCondition((await guestPage.locator('a[href^="tel:"]').count()) === 0, 'Landing page has 0 tel: links');
    await checkNoHorizontalOverflow(guestPage, 'Landing Desktop');
    await guestPage.screenshot({ path: join(ARTIFACT_DIR, 'cherry_landing.png'), fullPage: false });

    await guestPage.goto(`${E2E_CIVILIAN_FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
    await guestPage.locator('#biometric-login-btn').waitFor({ state: 'visible', timeout: 15000 });
    await guestPage.locator('#biometric-login-btn').click();
    await guestPage.locator('#bio-email').waitFor({ state: 'visible', timeout: 8000 });
    await delay(500);
    await guestPage.screenshot({ path: join(ARTIFACT_DIR, 'cherry_biometric_modal.png'), fullPage: false });
    await guestCtx.close();

    // 3. Admin Portal (Responders + Dispatch Manager + Nearby Auto-Dispatch)
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
    await delay(900);
    const adminSidebarText = await adminPage.locator('aside.sidebar').innerText();
    assertCondition(adminSidebarText.includes('Responders'), 'Admin sidebar renames Fleet Roster -> Responders');
    assertCondition(
      adminSidebarText.includes('Dispatch Manager'),
      'Admin sidebar renames Incidents & Triage -> Dispatch Manager'
    );
    await checkNoHorizontalOverflow(adminPage, 'Admin Dashboard');
    await adminPage.screenshot({ path: join(ARTIFACT_DIR, 'cherry_admin_dashboard.png'), fullPage: false });

    await adminPage.goto(`${ADMIN_URL}/admin/incidents`, { waitUntil: 'domcontentloaded' });
    await adminPage.locator('h1:has-text("Dispatch Manager")').waitFor({ state: 'visible', timeout: 15000 });
    await delay(800);
    await adminPage.screenshot({ path: join(ARTIFACT_DIR, 'cherry_admin_dispatch.png'), fullPage: false });
    await adminCtx.close();

    // 4. Responder FIRE Portal (Reports, Responders leaderboard, Request & Deploy, removed Apparatus/Alerts)
    const fireCtx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    await fireCtx.addInitScript((): void => {
      const fireUser = {
        userId: 'usr-fire-e2e',
        id: 'usr-fire-e2e',
        fullName: 'Capt. Gabriel Mendoza',
        role: 'Responder',
        unit: 'FIRE',
        email: 'bfp.fire@resqtrack.gov.ph',
        employeeOrResidentId: 'BFP-KTP-001'
      };
      localStorage.setItem('resqtrack_user', JSON.stringify(fireUser));
      localStorage.setItem('resqtrack_session', JSON.stringify(fireUser));
      localStorage.setItem('resqtrack_user_fire', JSON.stringify(fireUser));
      localStorage.setItem('resqtrack_user_1997', JSON.stringify(fireUser));
      localStorage.setItem('resqtrack_token_1997', 'e2e-fire-token');
      sessionStorage.setItem('resqtrack_user', JSON.stringify(fireUser));
      sessionStorage.setItem('resqtrack_unit', 'fire');
      sessionStorage.setItem('resqtrack_token', 'e2e-fire-token');
    });
    const firePage = await fireCtx.newPage();
    await firePage.goto(`${E2E_RESPONDER_FRONTEND_URL}/responder/dashboard`, { waitUntil: 'domcontentloaded' });
    await firePage.locator('aside.sidebar').waitFor({ state: 'visible', timeout: 15000 });
    await delay(900);
    const fireSidebarText = await firePage.locator('aside.sidebar').innerText();
    assertCondition(!fireSidebarText.includes('Apparatus'), 'FIRE sidebar removes Apparatus');
    assertCondition(!fireSidebarText.includes('Alerts'), 'FIRE sidebar removes Alerts page menu');
    assertCondition(fireSidebarText.includes('Reports'), 'FIRE sidebar shows Reports (renamed from Hazmat & 2-Alarm)');
    assertCondition(fireSidebarText.includes('Responders'), 'FIRE sidebar adds Responders');
    assertCondition(fireSidebarText.includes('Request & Deploy'), 'FIRE sidebar adds Request & Deploy');
    assertCondition(
      (await firePage.locator('a[href^="tel:"]').count()) === 0 &&
        !(await firePage.locator('body').innerText()).includes('Hotline 911'),
      'FIRE portal contains 0 tel: links and 0 Hotline 911 banners'
    );
    await checkNoHorizontalOverflow(firePage, 'FIRE Responder Dashboard');
    await firePage.screenshot({ path: join(ARTIFACT_DIR, 'cherry_responder_fire.png'), fullPage: false });
    await fireCtx.close();

    // 5. Civilian Portal Desktop (1366x860) + ENLARGE TO REDIRECT + Mobile (390x844)
    const civCtx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    await civCtx.addInitScript((): void => {
      const civUser = {
        userId: 'usr-civ-e2e',
        id: 'usr-civ-e2e',
        fullName: 'Juan Dela Cruz Jr.',
        role: 'Civilian',
        unit: 'NONE',
        email: 'resident.juan@resqtrack.gov.ph',
        employeeOrResidentId: 'RES-7109-001'
      };
      localStorage.setItem('resqtrack_user', JSON.stringify(civUser));
      localStorage.setItem('resqtrack_session', JSON.stringify(civUser));
      localStorage.setItem('resqtrack_user_1998', JSON.stringify(civUser));
      localStorage.setItem('resqtrack_token_1998', 'e2e-civ-token');
      sessionStorage.setItem('resqtrack_user', JSON.stringify(civUser));
      sessionStorage.setItem('resqtrack_token', 'e2e-civ-token');
    });
    const civPage = await civCtx.newPage();
    await civPage.goto(`${E2E_CIVILIAN_FRONTEND_URL}/civilian/dashboard`, { waitUntil: 'domcontentloaded' });
    await civPage.locator('aside.sidebar').waitFor({ state: 'visible', timeout: 15000 });
    await delay(900);
    const civSidebarText = await civPage.locator('aside.sidebar').innerText();
    assertCondition(civSidebarText.includes('Profile'), 'Civilian sidebar shows Profile (renamed from Identity)');
    assertCondition(!civSidebarText.includes('Hotlines') && !civSidebarText.includes('Warnings'), 'Civilian sidebar removes Hotlines and Warnings');
    const civBody = await civPage.locator('body').innerText();
    assertCondition(!civBody.includes('View All (25)') && !civBody.includes('Nearest Stations') && !civBody.includes('Emergency Hotlines'), 'Civilian dashboard removes banned panels');
    const enlargeBtn = civPage.locator('button:has-text("ENLARGE TO REDIRECT")').first();
    await enlargeBtn.waitFor({ state: 'visible', timeout: 8000 });

    const leftRightCheck = await civPage.evaluate((): boolean => {
      const btns = Array.from(document.querySelectorAll('button'));
      const enlarge = btns.find((b) => (b.textContent ?? '').includes('ENLARGE TO REDIRECT'));
      const sosText = Array.from(document.querySelectorAll('h2,h3')).find((h) =>
        (h.textContent ?? '').includes('Report Emergency')
      );
      if (!enlarge || !sosText) return false;
      return enlarge.getBoundingClientRect().left < sosText.getBoundingClientRect().left;
    });
    assertCondition(leftRightCheck, 'Evacuation Safe Zones is positioned LEFT of Report Emergency');
    await checkNoHorizontalOverflow(civPage, 'Civilian Dashboard Desktop');
    await civPage.screenshot({ path: join(ARTIFACT_DIR, 'cherry_civilian_desktop.png'), fullPage: false });

    await enlargeBtn.click();
    await civPage.waitForURL(/\/civilian\/live-map/, { timeout: 10000 });
    await delay(800);
    const liveMapBody = await civPage.locator('body').innerText();
    assertCondition(!liveMapBody.includes('Emergency Stations'), 'Civilian Live Map removes Emergency Stations');

    await civPage.setViewportSize({ width: 390, height: 844 });
    await civPage.goto(`${E2E_CIVILIAN_FRONTEND_URL}/civilian/dashboard`, { waitUntil: 'domcontentloaded' });
    await delay(900);
    await checkNoHorizontalOverflow(civPage, 'Civilian Dashboard Mobile 390px');
    await civPage.screenshot({ path: join(ARTIFACT_DIR, 'cherry_civilian_mobile.png'), fullPage: false });
    await civCtx.close();

    console.log('\nALL CHERRY/WARM IVORY STITCH E2E & VISUAL ASSERTIONS PASSED!');
  } finally {
    if (browser) await browser.close();
    if (adminProc?.pid) {
      try {
        spawnSync('taskkill', ['/PID', String(adminProc.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        // Ignore cleanup failure.
      }
    }
    if (servers) await servers.stopAll();
  }
};

runCherryIvoryStitchE2e().catch((err: unknown): void => {
  console.error(`[FATAL ERROR] ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
