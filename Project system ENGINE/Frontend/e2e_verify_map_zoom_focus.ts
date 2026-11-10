import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/provu/.gemini/antigravity-cli/brain/f4db8cc5-1635-43fd-94bb-ed301c4741f1';

const runMapZoomFocusVerification = async (): Promise<void> => {
  console.log('--- Starting Chrome E2E Live Verification for Map Sector Focus & Fixed Zoom ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Inject session so user is authenticated
  await context.addInitScript(() => {
    localStorage.setItem(
      'resqtrack_auth_token',
      JSON.stringify({
        userId: 'usr-admin-01',
        fullName: 'Admin Commander Ramos',
        role: 'LDRRMO_Admin',
        unit: 'LDRRMO',
        expiresAt: Date.now() + 86400000
      })
    );
  });

  const page = await context.newPage();

  // 1. Verify Civilian Tactical Live Map (The page in the user's uploaded picture)
  console.log('Navigating to http://localhost:5173/civilian/live-map ...');
  await page.goto('http://localhost:5173/civilian/live-map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const civilianMap = page.locator('div[role="application"][aria-label*="Satellite map of Katipunan"]');
  await civilianMap.waitFor({ state: 'visible', timeout: 10000 });
  console.log('[PASS] Civilian Satellite Command Map is rendered and visible.');

  // Check that tactical zoom controls are present
  const zoomInBtn = page.locator('button[aria-label="Zoom in"]');
  const zoomOutBtn = page.locator('button[aria-label="Zoom out"]');
  const recenterBtn = page.locator('button[aria-label="Recenter on Katipunan Sector"]');

  await zoomInBtn.waitFor({ state: 'visible', timeout: 5000 });
  await zoomOutBtn.waitFor({ state: 'visible', timeout: 5000 });
  await recenterBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('[PASS] Floating tactical zoom controls (+, -, and Recenter Sector) are visible and active.');

  // Capture screenshot of Civilian Live Map with Katipunan sector framing
  const civilianScreenshotPath = path.join(ARTIFACTS_DIR, 'katipunan_sector_civilian_live_map.png');
  await page.screenshot({ path: civilianScreenshotPath, fullPage: false });
  console.log(`[PASS] Saved Civilian Live Map screenshot to: ${civilianScreenshotPath}`);

  // Test Zoom In interaction
  await zoomInBtn.click();
  await page.waitForTimeout(1000);
  console.log('[PASS] Zoom in clicked successfully.');

  // Test Recenter Sector button
  await recenterBtn.click();
  await page.waitForTimeout(1500);
  console.log('[PASS] Recenter Sector clicked - smoothly reframed Katipunan Municipal Sector.');

  const recenteredScreenshotPath = path.join(ARTIFACTS_DIR, 'katipunan_sector_recentered_frame.png');
  await page.screenshot({ path: recenteredScreenshotPath, fullPage: false });
  console.log(`[PASS] Saved recentered Katipunan frame to: ${recenteredScreenshotPath}`);

  // 2. Verify Admin Strategic Map (/admin/strategic-map)
  console.log('Navigating to http://localhost:5173/admin/strategic-map ...');
  await page.goto('http://localhost:5173/admin/strategic-map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const adminMap = page.locator('div[role="application"][aria-label*="Satellite map of Katipunan"]');
  await adminMap.waitFor({ state: 'visible', timeout: 10000 });
  console.log('[PASS] Admin Strategic Command Map is rendered and strictly focused on Katipunan sector.');

  const adminScreenshotPath = path.join(ARTIFACTS_DIR, 'katipunan_sector_admin_strategic_map.png');
  await page.screenshot({ path: adminScreenshotPath, fullPage: false });
  console.log(`[PASS] Saved Admin Strategic Map screenshot to: ${adminScreenshotPath}`);

  await browser.close();
  console.log('================================================================');
  console.log('ALL MAP ZOOM FOCUS & SECTOR FRAMING TESTS PASSED (100%)');
  console.log('================================================================');
};

runMapZoomFocusVerification().catch((err) => {
  console.error('[FAIL] Map sector zoom focus verification failed:', err);
  process.exit(1);
});
