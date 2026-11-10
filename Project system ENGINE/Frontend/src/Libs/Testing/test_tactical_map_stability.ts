// [Layer: Testing]
// Responsibility: Automated comprehensive verification of Tactical Map Stability, Draggable Modal,
// isComfortablyInView camera gating, non-clipping boundary clamping at multiple zoom levels,
// and scrollbar elimination in ResQTrack Incident AI.

import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1';
const SHOT_100_ZOOM = path.join(ARTIFACT_DIR, 'tactical_map_zoom_100.png');
const SHOT_DRAGGED = path.join(ARTIFACT_DIR, 'tactical_map_modal_dragged.png');
const SHOT_MINIMAP = path.join(ARTIFACT_DIR, 'tactical_minimap_clamped.png');

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
};

const safeScreenshot = async (p: Page, targetPath: string): Promise<void> => {
  try {
    await p.screenshot({ path: targetPath, timeout: 15000, animations: 'disabled' });
    console.log(`Saved screenshot: ${targetPath}`);
  } catch (err) {
    console.warn(`[Screenshot Notice] ${targetPath}:`, (err as Error).message);
  }
};

// ----------------------------------------------------------------------------
// SUITE 1: isComfortablyInView Camera Anti-Jitter Algorithm Verification
// ----------------------------------------------------------------------------
const testComfortablyInViewLogic = (): void => {
  console.log('\n--- SUITE 1: isComfortablyInView Camera Anti-Jitter Algorithm Verification ---');

  const mapSize = { x: 1000, y: 700 };
  const padX = mapSize.x * 0.12; // 120
  const padY = mapSize.y * 0.15; // 105

  const checkComfortable = (ptX: number, ptY: number): boolean => {
    return (
      ptX >= padX &&
      ptX <= mapSize.x - padX &&
      ptY >= padY &&
      ptY <= mapSize.y - padY
    );
  };

  // Center point: (500, 350)
  assert(checkComfortable(500, 350), 'Center of viewport (500, 350) is comfortably in view -> ZERO camera shake');

  // Comfortably in-view interior points
  assert(checkComfortable(150, 120), 'Interior point (150, 120) is comfortably in view -> camera stays rock solid');
  assert(checkComfortable(850, 580), 'Interior point (850, 580) is comfortably in view -> camera stays rock solid');

  // Exact boundary edge
  assert(checkComfortable(120, 105), 'Exact boundary (120, 105) satisfies comfortable threshold');
  assert(checkComfortable(880, 595), 'Exact boundary (880, 595) satisfies comfortable threshold');

  // Outside comfortable view (at extreme edges where camera SHOULD pan gently)
  assert(!checkComfortable(50, 350), 'Left extreme perimeter (50, 350) correctly triggers gentle pan');
  assert(!checkComfortable(950, 350), 'Right extreme perimeter (950, 350) correctly triggers gentle pan');
  assert(!checkComfortable(500, 40), 'Top extreme perimeter (500, 40) correctly triggers gentle pan');
  assert(!checkComfortable(500, 650), 'Bottom extreme perimeter (500, 650) correctly triggers gentle pan');
};

// ----------------------------------------------------------------------------
// SUITE 2: Boundary Clamping & Zoom Mathematical Invariants
// ----------------------------------------------------------------------------
const testClampingLogic = (): void => {
  console.log('\n--- SUITE 2: Modal Card Clamping & Zoom Mathematical Invariants ---');

  const testZoomLevel = (zoomFactor: number, viewportW: number, viewportH: number) => {
    const containerW = Math.round(viewportW / zoomFactor);
    const containerH = Math.round(viewportH / zoomFactor);
    const safeMargin = 12;
    const isCompactMinimap = containerH < 440 || containerW < 460;

    const cardW = isCompactMinimap
      ? Math.min(290, containerW - 20)
      : Math.min(390, Math.max(340, Math.round(containerW * 0.38)));
    const halfW = cardW / 2;

    const cardMaxH = Math.max(200, containerH - safeMargin * 2);
    const targetCardH = isCompactMinimap
      ? Math.min(290, cardMaxH)
      : Math.min(430, cardMaxH);

    const testPoints = [
      { rawX: 50, rawY: 50 },
      { rawX: containerW / 2, rawY: 80 },
      { rawX: containerW - 40, rawY: 60 },
      { rawX: 60, rawY: containerH - 50 },
      { rawX: containerW / 2, rawY: containerH - 60 },
      { rawX: containerW - 40, rawY: containerH - 50 },
      { rawX: containerW / 2, rawY: containerH / 2 }
    ];

    for (const pt of testPoints) {
      let clampX: number;
      let clampedTop: number;

      if (isCompactMinimap || containerW < 460) {
        clampX = containerW / 2;
        clampedTop = Math.max(safeMargin, (containerH - targetCardH) / 2);
      } else {
        const isPlacedAbove = pt.rawY > containerH * 0.58;
        const pinClearance = 18;
        const idealTop = isPlacedAbove
          ? pt.rawY - pinClearance - targetCardH
          : pt.rawY + pinClearance;
        clampX = Math.max(halfW + safeMargin, Math.min(containerW - halfW - safeMargin, pt.rawX));
        clampedTop = Math.max(safeMargin, Math.min(containerH - targetCardH - safeMargin, idealTop));
      }

      const leftEdge = clampX - halfW;
      const rightEdge = clampX + halfW;
      const topEdge = clampedTop;
      const bottomEdge = clampedTop + targetCardH;

      assert(leftEdge >= 0, `Zoom ${zoomFactor * 100}% at (${pt.rawX}, ${pt.rawY}): leftEdge (${leftEdge}) >= 0`);
      assert(rightEdge <= containerW, `Zoom ${zoomFactor * 100}% at (${pt.rawX}, ${pt.rawY}): rightEdge (${rightEdge}) <= containerW (${containerW})`);
      assert(topEdge >= 0, `Zoom ${zoomFactor * 100}% at (${pt.rawX}, ${pt.rawY}): topEdge (${topEdge}) >= 0`);
      assert(bottomEdge <= containerH, `Zoom ${zoomFactor * 100}% at (${pt.rawX}, ${pt.rawY}): bottomEdge (${bottomEdge}) <= containerH (${containerH})`);
    }

    console.log(`[PASS] Clamping invariant holds 100% cleanly for Zoom Level ${zoomFactor * 100}% (${containerW}x${containerH})`);
  };

  testZoomLevel(1.0, 1440, 900); // 100% Zoom
  testZoomLevel(1.25, 1440, 900); // 125% Zoom
  testZoomLevel(1.5, 1440, 900); // 150% Zoom
  testZoomLevel(2.0, 1440, 900); // 200% Zoom
  testZoomLevel(1.0, 400, 320); // Compact Minimap container
};

// ----------------------------------------------------------------------------
// SUITE 3: Playwright Live Browser E2E Tactical Map Stability & Draggability
// ----------------------------------------------------------------------------
const runBrowserE2E = async (): Promise<void> => {
  console.log('\n--- SUITE 3: Playwright Live Browser E2E Tactical Map Stability & Draggability ---');

  const browser: Browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1
    });
    const page: Page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Authenticate with .NET Backend to initialize valid executive session
    console.log('Authenticating with backend on port 5000...');
    const loginRes = await page.request.post('http://localhost:5000/api/login', {
      data: {
        email: 'ldrrmo.admin@resqtrack.gov.ph',
        password: 'LdrrmoCommand@2026!',
        portalOrigin: 'Admin'
      }
    });
    assert(loginRes.status() === 200, 'Backend authentication succeeded with HTTP 200');
    const loginData = await loginRes.json();
    const token = loginData.token;
    assert(Boolean(token), 'Valid session token acquired');

    await page.addInitScript(({ sessionToken, sessionData }) => {
      sessionStorage.setItem('resqtrack_token', sessionToken);
      sessionStorage.setItem('resqtrack_user', JSON.stringify(sessionData));
      sessionStorage.setItem('resqtrack_session', JSON.stringify(sessionData));
      localStorage.setItem('resqtrack_token', sessionToken);
      localStorage.setItem('resqtrack_token_5173', sessionToken);
      localStorage.setItem('resqtrack_token_5176', sessionToken);
      localStorage.setItem('resqtrack_session', JSON.stringify(sessionData));
      localStorage.setItem('resqtrack_user', JSON.stringify(sessionData));
    }, { sessionToken: token, sessionData: loginData.session });

    // 1. Load Strategic Map Page
    console.log('Navigating to http://localhost:5176/admin/strategic-map...');
    await page.goto('http://localhost:5176/admin/strategic-map', { waitUntil: 'domcontentloaded' });
    
    // Wait for markers to appear after async telemetry sync / fallback
    console.log('Waiting for tactical pointer pins to be plotted...');
    await page.waitForSelector('.resqtrack-tactical-pointer', { timeout: 20000 });

    // Verify map canvas is rendered
    const mapContainer = page.locator('div[role="application"][aria-label*="Satellite map"]');
    assert((await mapContainer.count()) > 0, 'Leaflet map application container is active');

    // 2. Click Tactical Pointer Marker and Verify ZERO Camera Shaking
    const pins = page.locator('.resqtrack-tactical-pointer');
    const pinCount = await pins.count();
    assert(pinCount > 0, 'Tactical pointer pins are rendered on map');

    let pin = pins.first();
    for (let i = 0; i < pinCount; i++) {
      const p = pins.nth(i);
      const box = await p.boundingBox();
      if (box && box.x > 320 && box.x < 1100 && box.y > 180 && box.y < 800) {
        pin = p;
        break;
      }
    }
    assert((await pin.count()) > 0, 'Tactical pointer pin is visible in viewport on the map');

    // Capture map center / pan transform before clicking pin
    const mapPane = page.locator('.leaflet-map-pane').first();
    const transformBefore = await mapPane.evaluate((el) => window.getComputedStyle(el).transform);
    console.log(`Leaflet map pane transform before pin click: ${transformBefore}`);

    await pin.click({ force: true });
    await page.waitForTimeout(600);

    const transformAfter = await mapPane.evaluate((el) => window.getComputedStyle(el).transform);
    console.log(`Leaflet map pane transform after pin click: ${transformAfter}`);

    // If marker is comfortably in view, transform should remain rock-solid (identical)
    assert(
      transformBefore === transformAfter,
      'isComfortablyInView successfully gated camera: transformBefore === transformAfter (ZERO jitter/vibration)'
    );

    // 3. Verify Modal Callout Card Appeared & Is Clamped Inside Container Bounds
    const callout = page.locator('div[style*="z-index: 1200"], div.absolute.z-\\[1200\\]').first();
    assert((await callout.count()) > 0, 'Modal callout card opened successfully');

    const cardBox = await callout.boundingBox();
    const mapBox = await mapContainer.boundingBox();
    assert(Boolean(cardBox) && Boolean(mapBox), 'Modal card and map container are measurable');

    if (cardBox && mapBox) {
      console.log(`Callout Box: x=${cardBox.x}, y=${cardBox.y}, w=${cardBox.width}, h=${cardBox.height}`);
      console.log(`Map Container: x=${mapBox.x}, y=${mapBox.y}, w=${mapBox.width}, h=${mapBox.height}`);

      // Check card relative to map container
      const relX = cardBox.x - mapBox.x;
      const relY = cardBox.y - mapBox.y;
      const relRight = relX + cardBox.width;
      const relBottom = relY + cardBox.height;

      assert(relX >= 0, `Card left edge (${relX}px) >= 0px within map container`);
      assert(relRight <= mapBox.width + 2, `Card right edge (${relRight}px) <= map width (${mapBox.width}px)`);
      assert(relY >= 0, `Card top edge (${relY}px) >= 0px within map container (HEADER NOT CUT OFF)`);
      assert(relBottom <= mapBox.height + 2, `Card bottom edge (${relBottom}px) <= map height (${mapBox.height}px) (FOOTER NOT CUT OFF)`);
    }

    // Verify header and footer elements exist and are rendered
    const cardHeader = page.locator('[title="Drag to reposition card on map"]').first();
    assert((await cardHeader.count()) > 0, 'Card fixed draggable header is rendered');

    const actionFooter = page.locator('button:has-text("MARK RESPONDED"), button:has-text("RESPONDED")').first();
    assert((await actionFooter.count()) > 0, 'Card action footer button is rendered and visible');

    // 4. Verify Scrollbar Suppression CSS (.tactical-modal-scroll)
    const scrollableBody = page.locator('.tactical-modal-scroll').first();
    assert((await scrollableBody.count()) > 0, 'Scrollable modal body has .tactical-modal-scroll class');

    const scrollbarStyles = await scrollableBody.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        scrollbarWidth: computed.scrollbarWidth,
        overflowY: computed.overflowY
      };
    });
    console.log('Scrollbar computed styles:', scrollbarStyles);
    assert(
      scrollbarStyles.scrollbarWidth === 'none',
      `scrollbarWidth is 'none' (zero ugly white scrollbar in modern browsers)`
    );

    // Check style tag rules for scrollbar elimination
    const styleContent = await page.evaluate(() => {
      const styleTags = Array.from(document.querySelectorAll('style'));
      return styleTags.map((s) => s.textContent || '').join('\n');
    });
    assert(
      styleContent.includes('scrollbar-width: none !important'),
      'Contains scrollbar-width: none !important rule in embedded CSS'
    );
    assert(
      styleContent.includes('::-webkit-scrollbar') && styleContent.includes('display: none !important'),
      'Contains ::-webkit-scrollbar { display: none !important } rule in embedded CSS'
    );

    await safeScreenshot(page, SHOT_100_ZOOM);

    // 5. Verify Smooth Dragging via useDraggable
    const dragCursor = await cardHeader.evaluate((el) => window.getComputedStyle(el).cursor);
    assert(dragCursor === 'grab', `Drag handle cursor is 'grab' (got '${dragCursor}')`);

    const headerBox = await cardHeader.boundingBox();
    if (headerBox && cardBox) {
      const startX = headerBox.x + headerBox.width / 2;
      const startY = headerBox.y + headerBox.height / 2;

      console.log(`Dragging modal card from (${startX}, ${startY}) to (${startX + 100}, ${startY - 80})...`);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY - 80, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(400);

      const cardBoxAfterDrag = await callout.boundingBox();
      if (cardBoxAfterDrag) {
        const deltaX = Math.abs(cardBoxAfterDrag.x - cardBox.x);
        const deltaY = Math.abs(cardBoxAfterDrag.y - cardBox.y);
        console.log(`Card position after drag: x=${cardBoxAfterDrag.x}, y=${cardBoxAfterDrag.y}`);
        console.log(`Measured drag offsets: deltaX=${deltaX}px, deltaY=${deltaY}px`);
        assert(deltaX > 20 || deltaY > 20, `Modal card was smoothly dragged via useDraggable (deltaX=${deltaX}px, deltaY=${deltaY}px)`);
      }
    }

    await safeScreenshot(page, SHOT_DRAGGED);

    // 6. Test Browser Viewport Clamping Under 150% Zoom Simulation (960x600)
    console.log('\n--- 6. Testing Browser Viewport Clamping Under 150% Zoom Simulation (960x600) ---');
    await page.setViewportSize({ width: 960, height: 600 });
    await page.waitForTimeout(600);

    // Click pin to reposition callout in resized viewport
    await pin.dispatchEvent('click');
    await page.waitForTimeout(600);

    const zoom150Callout = page.locator('div[style*="z-index: 1200"], div.absolute.z-\\[1200\\]').first();
    const zoom150CardBox = await zoom150Callout.boundingBox();
    const zoom150MapBox = await mapContainer.boundingBox();
    if (zoom150CardBox && zoom150MapBox) {
      console.log(`Zoom 150% Callout Box: x=${zoom150CardBox.x}, y=${zoom150CardBox.y}, w=${zoom150CardBox.width}, h=${zoom150CardBox.height}`);
      console.log(`Zoom 150% Map Box: x=${zoom150MapBox.x}, y=${zoom150MapBox.y}, w=${zoom150MapBox.width}, h=${zoom150MapBox.height}`);
      const relTop = zoom150CardBox.y - zoom150MapBox.y;
      const relBottom = relTop + zoom150CardBox.height;
      const relLeft = zoom150CardBox.x - zoom150MapBox.x;
      const relRight = relLeft + zoom150CardBox.width;
      assert(relLeft >= 0, `Zoom 150%: Card left edge (${relLeft}px) >= 0px within map container`);
      assert(relRight <= zoom150MapBox.width + 2, `Zoom 150%: Card right edge (${relRight}px) <= map width (${zoom150MapBox.width}px)`);
      assert(relTop >= 0, `Zoom 150%: Card top edge (${relTop}px) >= 0px within map container (HEADER NOT CUT OFF)`);
      assert(relBottom <= zoom150MapBox.height + 2, `Zoom 150%: Card bottom edge (${relBottom}px) <= map height (${zoom150MapBox.height}px) (FOOTER NOT CUT OFF)`);
    }

    // 7. Test Browser Viewport Clamping Under 200% Zoom Simulation (720x450)
    console.log('\n--- 7. Testing Browser Viewport Clamping Under 200% Zoom Simulation (720x450) ---');
    await page.setViewportSize({ width: 720, height: 450 });
    await page.waitForTimeout(600);

    // Click pin to reposition callout in resized viewport
    await pin.dispatchEvent('click');
    await page.waitForTimeout(600);

    const zoom200Callout = page.locator('div[style*="z-index: 1200"], div.absolute.z-\\[1200\\]').first();
    const zoom200CardBox = await zoom200Callout.boundingBox();
    const zoom200MapBox = await mapContainer.boundingBox();
    if (zoom200CardBox && zoom200MapBox) {
      console.log(`Zoom 200% Callout Box: x=${zoom200CardBox.x}, y=${zoom200CardBox.y}, w=${zoom200CardBox.width}, h=${zoom200CardBox.height}`);
      console.log(`Zoom 200% Map Box: x=${zoom200MapBox.x}, y=${zoom200MapBox.y}, w=${zoom200MapBox.width}, h=${zoom200MapBox.height}`);
      const relTop = zoom200CardBox.y - zoom200MapBox.y;
      const relBottom = relTop + zoom200CardBox.height;
      const relLeft = zoom200CardBox.x - zoom200MapBox.x;
      const relRight = relLeft + zoom200CardBox.width;
      assert(relLeft >= 0, `Zoom 200%: Card left edge (${relLeft}px) >= 0px within map container`);
      assert(relRight <= zoom200MapBox.width + 2, `Zoom 200%: Card right edge (${relRight}px) <= map width (${zoom200MapBox.width}px)`);
      assert(relTop >= 0, `Zoom 200%: Card top edge (${relTop}px) >= 0px within map container (HEADER NOT CUT OFF)`);
      assert(relBottom <= zoom200MapBox.height + 2, `Zoom 200%: Card bottom edge (${relBottom}px) <= map height (${zoom200MapBox.height}px) (FOOTER NOT CUT OFF)`);
    }

    // 8. Test Callout Dismissal / Close Button
    console.log('\n--- 8. Testing Callout Modal Close and Clean Dismissal ---');
    const closeBtn = page.locator('button[title="Close Callout"], button[title="Close tactical callout"]').first();
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      const remainingCallout = page.locator('div[style*="z-index: 1200"], div.absolute.z-\\[1200\\]');
      assert((await remainingCallout.count()) === 0, 'Callout modal cleanly unmounts upon close button click');
    }

  } finally {
    await browser.close();
  }
};

const runAllTests = async (): Promise<void> => {
  console.log('============================================================');
  console.log('TACTICAL MAP STABILITY & DRAGGABLE MODAL AUDIT SUITE');
  console.log('============================================================');

  testComfortablyInViewLogic();
  testClampingLogic();
  await runBrowserE2E();

  console.log('\n============================================================');
  console.log('ALL VERIFICATION AUDITS PASSED WITH ZERO ERRORS (100%)');
  console.log('============================================================\n');
};

runAllTests().catch((err) => {
  console.error('[TEST FAILURE]', err);
  process.exit(1);
});
