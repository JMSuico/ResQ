import { chromium } from 'playwright';
import fs from 'node:fs';

const DEFAULT_BACK_ID =
  'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_2_1793858609231.jpg';

const testWebcamSnapshot = async (): Promise<void> => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('[BROWSER]', msg.text()));
  page.on('pageerror', (err) => console.error('[BROWSER ERR]', err));

  await page.goto('http://127.0.0.1:1998/register?step=1', { waitUntil: 'networkidle' });
  await page.locator('#phase-2-id-identity').waitFor({ state: 'visible', timeout: 8000 });
  await page.selectOption('select#id-type', 'drivers');

  // Switch to upload if toggle button exists in legacy layout
  const uploadBtn = page.locator('button:has-text("Upload Picture File")');
  if (await uploadBtn.isVisible().catch(() => false)) {
    await uploadBtn.click();
    await page.waitForTimeout(500);
  }

  const frontInput = page.locator('input[data-side="front"]');
  // Override with IMG env var (absolute path) for adversarial runs
  const WEBCAM_SHOT = process.env.IMG || 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_0_1793858609231.jpg';
  await frontInput.setInputFiles(WEBCAM_SHOT);

  const backPath = process.env.BACK_IMG || DEFAULT_BACK_ID;
  if (fs.existsSync(backPath) && backPath !== WEBCAM_SHOT) {
    await page.locator('input[data-side="back"]').setInputFiles(backPath);
  }
  await page.waitForTimeout(4000);

  const statusText = await page.evaluate(() => document.body.innerText);
  const frontPreviewVisible = await page.locator('#front-id-preview').isVisible().catch(() => false);
  const rejectedVisible = await page.locator('#banner-id-rejected').isVisible().catch(() => false);
  console.log('Includes Front preview / FRONT ID SECURED:', frontPreviewVisible || statusText.includes('FRONT ID SECURED'));
  console.log('Includes ID Rejected banner / message:', rejectedVisible || statusText.includes('ID Scan Rejected'));

  const statusMsg = await page.evaluate(() => {
    const el = document.querySelector('#id-verification-banner, #banner-id-rejected, .field__error, [role="alert"]');
    return el ? el.textContent : 'No error element';
  });
  console.log('Status/Error element:', statusMsg);

  const personalVisible = await page.locator('#personal-info-section').isVisible().catch(() => false);
  console.log('Personal Info unlocked (#personal-info-section):', personalVisible);

  const fields = await page.evaluate(() => {
    const getVal = (selector: string): string => {
      const el = document.querySelector<HTMLInputElement>(selector);
      return el ? el.value : '';
    };
    return {
      first: getVal('#first-name, input[name="firstName"]'),
      last: getVal('#last-name, input[name="lastName"]'),
      lic: getVal('#license-number, input[name="licenseNumber"]'),
      dob: getVal('#dob, input[name="dateOfBirth"]'),
      address: [
        getVal('#street-purok, input[name="streetOrPurok"]'),
        getVal('#barangay, input[name="barangay"]'),
        getVal('#city, input[name="city"], input[name="cityOrMunicipality"]'),
        getVal('#province, input[name="province"]')
      ].filter(Boolean).join(', ')
    };
  });
  console.log('Fields:', JSON.stringify(fields, null, 2));

  await browser.close();
};

testWebcamSnapshot().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
