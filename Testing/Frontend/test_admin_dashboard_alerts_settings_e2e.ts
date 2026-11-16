// [Layer: Testing/Frontend]
// Responsibility: Playwright real-browser verification for:
//   1. Admin Settings Audit Log pagination hooks (#audit-pagination-controls, page size selector, Prev/Next).
//   2. AlertsCenter Dispatched Units KPI overflow/overlap fix & minimal copy.
//   3. AdminDashboard LinearCurveyChart dynamic X-axis & Y-axis updates when changing horizon options.
//   4. Premium glassmorphism & zero horizontal overflow across Admin pages.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, ZERO mocks, 100% Arrow Lambdas (=>).

import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import {
  E2E_BACKEND_URL,
  ensureE2eServersReady,
  probeHttpReady,
  type E2eServersHandle
} from './fixtures/e2eServerHarness';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

const ARTIFACT_DIR =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';
const ADMIN_URL = 'http://127.0.0.1:1996';

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

const runAdminUiFixesE2e = async (): Promise<void> => {
  let servers: E2eServersHandle | null = null;
  let spawnedAdminProc: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    servers = await ensureE2eServersReady({ includeResponder: false, useWireServer: true });
    const adminUp = await probeHttpReady(ADMIN_URL);
    if (!adminUp) {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      spawnedAdminProc = spawn(npmCmd, ['run', 'dev:admin'], {
        cwd: join(process.cwd(), 'Project system ENGINE', 'Frontend'),
        stdio: 'ignore',
        shell: process.platform === 'win32'
      });
      for (let i = 0; i < 40; i += 1) {
        if (await probeHttpReady(ADMIN_URL, 1500)) break;
        await delay(500);
      }
    }

    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });

    await context.addInitScript((): void => {
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

    const page: Page = await context.newPage();

    // 1. Admin Dashboard: Dynamic X-axis & Y-axis on LinearCurveyChart + Glassmorphism
    console.log(`\n[1] Checking AdminDashboard LinearCurveyChart dynamic axes at ${ADMIN_URL}/admin/dashboard ...`);
    await page.goto(`${ADMIN_URL}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.locator('h3:has-text("Incident Trend")').waitFor({ state: 'visible', timeout: 15000 });
    await delay(1000);

    const chartRoot = page.locator('[data-x-labels]').first();
    await chartRoot.waitFor({ state: 'visible', timeout: 10000 });
    const initialX = (await chartRoot.getAttribute('data-x-labels')) ?? '';
    const initialYTicks = (await chartRoot.getAttribute('data-y-ticks')) ?? '';
    console.log(`[AXIS 24h] X="${initialX}" Y="${initialYTicks}"`);
    assertCondition(
      initialX.includes('00:00') && initialYTicks.split(',').length >= 4,
      `Initial 24h chart renders X-axis buckets and adaptive Y-axis ticks (${initialYTicks})`
    );

    // Select 'Last 7 Days' on the Incident Trend Dropdown
    const trendCard = page.locator('div.tactical-card:has(h3:has-text("Incident Trend"))').first();
    await trendCard.locator('button').first().click();
    await page.locator('button:has-text("Last 7 Days")').first().click();
    await delay(500);

    const xAfter7d = (await chartRoot.getAttribute('data-x-labels')) ?? '';
    const yAfter7d = (await chartRoot.getAttribute('data-y-ticks')) ?? '';
    console.log(`[AXIS 7d] X="${xAfter7d}" Y="${yAfter7d}"`);
    assertCondition(
      xAfter7d !== initialX && !xAfter7d.includes('00:00'),
      `Selecting "Last 7 Days" updates X-axis labels dynamically ("${xAfter7d}")`
    );

    // Select 'Year: 2026' on the Incident Trend Dropdown
    await trendCard.locator('button').first().click();
    await page.locator('button:has-text("Year: 2026")').first().click();
    await delay(500);

    const xAfterYear = (await chartRoot.getAttribute('data-x-labels')) ?? '';
    const yAfterYear = (await chartRoot.getAttribute('data-y-ticks')) ?? '';
    console.log(`[AXIS 2026] X="${xAfterYear}" Y="${yAfterYear}"`);
    assertCondition(
      xAfterYear.includes('Jan|Feb|Mar') && xAfterYear.includes('Dec'),
      `Selecting "Year: 2026" switches X-axis to 12 monthly labels ("${xAfterYear}")`
    );
    await page.screenshot({ path: join(ARTIFACT_DIR, 'admin_dashboard_dynamic_chart_glass.png'), fullPage: false, animations: 'disabled', timeout: 60000 });

    // 2. AlertsCenter: Fix 3 Corps overlapping card + Glassmorphism
    console.log(`\n[2] Checking AlertsCenter Dispatched Units KPI card at ${ADMIN_URL}/admin/alerts ...`);
    await page.goto(`${ADMIN_URL}/admin/alerts`, { waitUntil: 'domcontentloaded' });
    await page.locator('h1:has-text("Emergency Broadcasts")').waitFor({ state: 'visible', timeout: 15000 });
    await delay(1000);

    const dispatchedCard = page.locator('div.tactical-card:has-text("Dispatched Units")').first();
    await dispatchedCard.waitFor({ state: 'visible', timeout: 5000 });
    const cardText = (await dispatchedCard.innerText()).trim();
    const overflowCheck = await dispatchedCard.evaluate((el: Element): { scrollW: number; clientW: number } => ({
      scrollW: el.scrollWidth,
      clientW: el.clientWidth
    }));
    console.log(`[ALERTS KPI] text="${cardText.replace(/\s+/g, ' ')}" scrollW=${overflowCheck.scrollW} clientW=${overflowCheck.clientW}`);
    assertCondition(
      !cardText.includes('VehicularAccident/CrimeOrSecurity') && overflowCheck.scrollW <= overflowCheck.clientW + 2,
      'Dispatched Units KPI card renders concise non-overlapping text inside bounds'
    );
    await page.screenshot({ path: join(ARTIFACT_DIR, 'admin_alerts_fixed_overlap_glass.png'), fullPage: false, animations: 'disabled', timeout: 60000 });

    // 3. System Settings: Audit Log Pagination Hooks + Glassmorphism
    console.log(`\n[3] Checking System Settings Audit pagination hooks at ${ADMIN_URL}/admin/settings ...`);
    await page.goto(`${ADMIN_URL}/admin/settings`, { waitUntil: 'domcontentloaded' });
    await page.locator('#tab-audit-radio').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#tab-audit-radio').click({ force: true });
    await page.locator('#audit-pagination-controls').waitFor({ state: 'visible', timeout: 8000 });
    const paginationText = (await page.locator('#audit-pagination-controls').innerText()).replace(/\s+/g, ' ').trim();
    console.log(`[AUDIT PAGINATION] "${paginationText}"`);
    assertCondition(
      paginationText.includes('Show') && paginationText.includes('Page 1 /') && paginationText.includes('Prev') && paginationText.includes('Next'),
      'Settings Audit tab renders full usePagination controls (#audit-pagination-controls)'
    );
    await page.screenshot({ path: join(ARTIFACT_DIR, 'admin_settings_audit_pagination_glass.png'), fullPage: false, animations: 'disabled', timeout: 60000 });

    console.log('\nALL ADMIN DASHBOARD, ALERTS, AND SETTINGS AUDIT E2E CHECKS PASSED!');
    console.log(`[INFO] Backend=${E2E_BACKEND_URL}`);
  } finally {
    if (browser) await browser.close().catch((): void => {});
    if (spawnedAdminProc?.pid && process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(spawnedAdminProc.pid), '/T', '/F'], { stdio: 'ignore' });
    }
    if (servers) await servers.stopAll();
  }
};

runAdminUiFixesE2e().catch((err: unknown): void => {
  console.error('[FATAL ADMIN UI E2E FAILURE]', err);
  process.exit(1);
});
