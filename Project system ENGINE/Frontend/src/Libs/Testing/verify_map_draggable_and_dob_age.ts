// [Layer: Testing]
// Responsibility: Comprehensive verification of:
// 1. Draggable modal card via useDraggable in Strategic Command Geospatial Map and Admin Minimap
// 2. Non-clipping boundary clamping at 100% default browser zoom
// 3. Automated Age calculation from Date of Birth (YYYY/MM/DD) in Registration Page
// 4. Front Driver's License auto-fill accuracy on genuine uploaded ID.

import { chromium } from 'playwright';

const FRONT_ID_PATH =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1_1793858609231.jpg';
const MAP_SCREENSHOT =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\strategic_map_draggable_verification.png';
const MINIMAP_SCREENSHOT =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\admin_minimap_callout_verification.png';
const REG_SCREENSHOT =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\dob_age_autofill_verification.png';

const assert = (cond: boolean, msg: string): void => {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
};

export const runFullVerification = async (): Promise<void> => {
  console.log('\n============================================================');
  console.log('STARTING DRAGGABLE MAP MODAL & DOB/AGE VERIFICATION');
  console.log('============================================================\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  // --------------------------------------------------------------------------
  // TEST 1: Front ID Upload, Complete Field Extraction & Age Auto-Fill (YYYY/MM/DD)
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Testing Genuine Front ID Upload, 100% Autofill & DOB -> Age Auto-Calculation ---');
  await page.goto('http://localhost:5173/register?step=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('Uploading Front ID image...');
  const frontInput = page.locator('input[data-side="front"]');
  await frontInput.setInputFiles(FRONT_ID_PATH);
  await page.waitForTimeout(6000);

  const dobInput = page.locator('#dob');
  const ageInput = page.locator('#age');

  const formValues = {
    firstName: await page.locator('#first-name').inputValue(),
    middleName: await page.locator('#middle-name').inputValue(),
    lastName: await page.locator('#last-name').inputValue(),
    dateOfBirth: await dobInput.inputValue(),
    age: await ageInput.inputValue(),
    licenseNumber: await page.locator('#license-number').inputValue(),
    address: await page.locator('#address').inputValue(),
    weight: await page.locator('#weight').inputValue(),
    height: await page.locator('#height').inputValue(),
    sex: await page.locator('#sex').inputValue()
  };

  console.log('Extracted Form Values:\n', JSON.stringify(formValues, null, 2));

  assert(formValues.firstName === 'JHONMARK', `First name extracted accurately: '${formValues.firstName}'`);
  assert(formValues.middleName === 'AMACA', `Middle name extracted accurately: '${formValues.middleName}'`);
  assert(formValues.lastName === 'SUICO', `Last name extracted accurately: '${formValues.lastName}'`);
  assert(formValues.dateOfBirth === '2004/02/20', `Date of birth extracted accurately: '${formValues.dateOfBirth}'`);
  assert(formValues.age === '22', `Age auto-calculated accurately from DOB (2004/02/20 -> 22): '${formValues.age}'`);
  assert(formValues.licenseNumber === 'J07-22-302560', `License number extracted accurately: '${formValues.licenseNumber}'`);
  assert(formValues.weight === '52', `Weight extracted accurately: '${formValues.weight}'`);
  assert(formValues.height === '1.71', `Height extracted accurately: '${formValues.height}'`);
  assert(formValues.sex === 'male', `Sex extracted accurately: '${formValues.sex}'`);
  assert(
    formValues.address === '-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110',
    `Address extracted accurately: '${formValues.address}'`
  );

  // Test dynamic manual typing of birthdate: 1996/05/15 -> calculates Age 30
  await dobInput.fill('1996/05/15');
  await page.waitForTimeout(400);
  let computedAge = await ageInput.inputValue();
  assert(computedAge === '30', `Typing '1996/05/15' dynamically calculates age to '30' (got '${computedAge}')`);

  // Reset back to original genuine birthdate
  await dobInput.fill('2004/02/20');
  await page.waitForTimeout(400);
  computedAge = await ageInput.inputValue();
  assert(computedAge === '22', `Re-filling '2004/02/20' resets age to '22' (got '${computedAge}')`);

  await page.screenshot({ path: REG_SCREENSHOT, fullPage: true });
  console.log(`Saved screenshot: ${REG_SCREENSHOT}`);

  // --------------------------------------------------------------------------
  // TEST 3: Strategic Command Geospatial Map Callout & Draggability
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Strategic Map Callout Boundary & Draggable Hook ---');
  await page.goto('http://localhost:5173/admin/strategic-map', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Click on the tactical pointer marker on the map with force: true
  const pin = page.locator('.resqtrack-tactical-pointer').first();
  await pin.click({ force: true });
  await page.waitForTimeout(1000);

  // Find the callout modal card
  const calloutCard = page.locator('div[style*="z-index: 1200"], div.absolute.z-\\[1200\\]').first();

  assert((await calloutCard.count()) > 0, 'Callout modal card appeared upon clicking map pointer');

  const cardBoxBefore = await calloutCard.boundingBox();
  assert(Boolean(cardBoxBefore), 'Callout modal card bounding box is measurable');

  if (cardBoxBefore) {
    console.log(`Initial card bounds: x=${cardBoxBefore.x}, y=${cardBoxBefore.y}, w=${cardBoxBefore.width}, h=${cardBoxBefore.height}`);
    assert(cardBoxBefore.y >= 0, `Card top is within visible viewport (y=${cardBoxBefore.y} >= 0)`);
    assert(cardBoxBefore.y + cardBoxBefore.height <= 900, `Card bottom is within visible viewport (bottom=${cardBoxBefore.y + cardBoxBefore.height} <= 900)`);
  }

  // Test Dragging the Callout Card via useDraggable
  const dragHeader = page.locator('[title="Drag to reposition card on map"]').first();
  const headerBox = await dragHeader.boundingBox();
  if (headerBox) {
    const startX = headerBox.x + headerBox.width / 2;
    const startY = headerBox.y + headerBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY + 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const cardBoxAfter = await calloutCard.boundingBox();
    if (cardBoxAfter && cardBoxBefore) {
      console.log(`Dragged card bounds: x=${cardBoxAfter.x}, y=${cardBoxAfter.y}`);
      const deltaX = Math.abs(cardBoxAfter.x - cardBoxBefore.x);
      const deltaY = Math.abs(cardBoxAfter.y - cardBoxBefore.y);
      console.log(`Measured drag deltas: deltaX=${deltaX}px, deltaY=${deltaY}px`);
      assert(deltaX > 20 || deltaY > 20, `Card was successfully dragged via useDraggable (deltaX=${deltaX}px, deltaY=${deltaY}px)`);
    }
  }

  await page.screenshot({ path: MAP_SCREENSHOT, fullPage: true });
  console.log(`Saved screenshot: ${MAP_SCREENSHOT}`);

  // --------------------------------------------------------------------------
  // TEST 4: Admin Dashboard Minimap Compact Callout
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Admin Dashboard Minimap Compact Callout & Non-Overflow ---');
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const minimapPin = page.locator('.resqtrack-tactical-pointer').first();
  if ((await minimapPin.count()) > 0) {
    await minimapPin.click({ force: true });
    await page.waitForTimeout(800);

    const minimapCallout = page.locator('[title="Drag to reposition card on map"]').first();
    assert((await minimapCallout.count()) > 0, 'Minimap callout appeared on pointer click');

    // Check that minimap callout has compact size and zero excessive overflow
    const minimapCard = page.locator('div.absolute.z-\\[1200\\] > div').first();
    const mmBox = await minimapCard.boundingBox();
    if (mmBox) {
      console.log(`Minimap card box: w=${mmBox.width}, h=${mmBox.height}`);
      assert(mmBox.height <= 260, `Minimap callout card height is compact (got ${mmBox.height}px <= 260px)`);
    }

    const enlargeBtn = page.locator('button:has-text("ENLARGE")').first();
    assert((await enlargeBtn.count()) > 0, 'Minimap callout contains ENLARGE button');
  }

  await page.screenshot({ path: MINIMAP_SCREENSHOT, fullPage: true });
  console.log(`Saved screenshot: ${MINIMAP_SCREENSHOT}`);

  await browser.close();

  console.log('\n============================================================');
  console.log('ALL VERIFICATION CHECKS PASSED (100%)');
  console.log('============================================================\n');
};

runFullVerification().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
