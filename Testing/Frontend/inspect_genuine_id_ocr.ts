import { chromium } from 'playwright';

const FRONT_ID_PATH = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1_1793858609231.jpg';
const BACK_ID_PATH = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_2_1793858609231.jpg';
const SCREENSHOT_PATH = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\genuine_id_autofill_verification.png';

export const runInspection = async (): Promise<void> => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  await page.goto('http://127.0.0.1:1998/register?step=1', { waitUntil: 'networkidle' });
  await page.locator('#phase-2-id-identity').waitFor({ state: 'visible', timeout: 8000 });
  await page.selectOption('select#id-type', 'drivers');
  await page.waitForTimeout(500);

  console.log('Uploading Front & Back ID...');
  await page.locator('input[data-side="front"]').setInputFiles(FRONT_ID_PATH);
  await page.locator('input[data-side="back"]').setInputFiles(BACK_ID_PATH);

  await page.locator('#id-verification-banner').waitFor({ state: 'visible', timeout: 25000 });
  await page
    .locator('#badge-id-verified-genuine, #badge-id-pending-manual')
    .waitFor({ state: 'visible', timeout: 25000 });
  await page.locator('#personal-info-section').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  const getInputValue = async (selector: string): Promise<string> => {
    const el = page.locator(selector);
    if ((await el.count()) > 0) {
      return (await el.inputValue()) || '';
    }
    return '';
  };

  const getSelectValue = async (selector: string): Promise<string> => {
    const el = page.locator(selector);
    if ((await el.count()) > 0) {
      return (await el.inputValue()) || '';
    }
    return '';
  };

  const extractedValues = {
    firstName: await getInputValue('#first-name'),
    middleName: await getInputValue('#middle-name'),
    lastName: await getInputValue('#last-name'),
    dateOfBirth: await getInputValue('#dob'),
    age: await getInputValue('#age'),
    licenseNumber: await getInputValue('#license-number'),
    province: await getInputValue('#province'),
    city: await getInputValue('#city'),
    barangay: await getInputValue('#barangay'),
    streetOrPurok: await getInputValue('#street-purok'),
    weight: await getInputValue('#weight'),
    height: await getInputValue('#height'),
    sex: await getSelectValue('#sex')
  };

  console.log('\n=== UNIFIED PHASE 2 PERSONAL INFO VALUES (#personal-info-section) ===');
  console.log(JSON.stringify(extractedValues, null, 2));

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log('\nScreenshot saved to:', SCREENSHOT_PATH);

  await browser.close();
};

runInspection().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
