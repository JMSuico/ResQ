import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/provu/.gemini/antigravity-cli/brain/f4db8cc5-1635-43fd-94bb-ed301c4741f1';

const captureMapScreenshot = async (): Promise<void> => {
  console.log('--- Capturing Live Map Display Screenshot ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1357, height: 800 }
  });

  // Inject authenticated civilian session
  await context.addInitScript(() => {
    localStorage.setItem(
      'resqtrack_user',
      JSON.stringify({
        userId: 'usr-civ-01',
        fullName: 'Juan Dela Cruz',
        role: 'Civilian',
        email: 'juan.delacruz@gmail.com'
      })
    );
    localStorage.setItem(
      'resqtrack_auth_token',
      JSON.stringify({
        userId: 'usr-civ-01',
        fullName: 'Juan Dela Cruz',
        role: 'Civilian',
        expiresAt: Date.now() + 86400000
      })
    );
  });

  const page = await context.newPage();

  // Try port 1998 first (Civilian SOS Portal), then port 1997 or 5173
  const candidateUrls = [
    'http://localhost:1998/civilian/live-map',
    'http://localhost:1997/civilian/live-map',
    'http://localhost:1996/admin/strategic-map'
  ];

  let loaded = false;
  for (const url of candidateUrls) {
    try {
      console.log(`Attempting to navigate to ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 8000 });
      loaded = true;
      console.log(`Successfully loaded ${url}`);
      break;
    } catch (err) {
      console.log(`Could not load ${url}, trying next candidate...`);
    }
  }

  if (!loaded) {
    console.error('No candidate URL could be loaded.');
    await browser.close();
    return;
  }

  // Wait for Leaflet satellite tiles and tactical pointer pins to be plotted
  await page.waitForTimeout(4000);

  // 1. Capture the Map Element specifically (Edge-to-Edge like the user's reference picture)
  const mapElement = page.locator('div[role="application"][aria-label*="Satellite map"]');
  if (await mapElement.count() > 0) {
    const mapOnlyPath = path.join(ARTIFACTS_DIR, 'katipunan_map_updated_display.png');
    await mapElement.screenshot({ path: mapOnlyPath });
    console.log(`[PASS] Captured edge-to-edge tactical map screenshot to: ${mapOnlyPath}`);
  } else {
    const outPath = path.join(ARTIFACTS_DIR, 'katipunan_map_updated_display.png');
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[PASS] Captured fullpage screenshot to: ${outPath}`);
  }

  await browser.close();
};

captureMapScreenshot().catch(console.error);
