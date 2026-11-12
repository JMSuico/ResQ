import { chromium } from 'playwright';
import path from 'path';

async function testWebcamSnapshot() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('[BROWSER]', msg.text()));
  page.on('pageerror', (err) => console.error('[BROWSER ERR]', err));

  await page.goto('http://localhost:5173/register?step=1', { waitUntil: 'networkidle' });
  
  // Switch to upload
  await page.click('button:has-text("Upload Picture File")');
  await page.waitForTimeout(500);

  const frontInput = page.locator('input[data-side="front"]');
  // Override with IMG env var (absolute path) for adversarial runs
  const WEBCAM_SHOT = process.env.IMG || 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_0_1793858609231.jpg';
  await frontInput.setInputFiles(WEBCAM_SHOT);
  await page.waitForTimeout(3000);

  const statusText = await page.evaluate(() => document.body.innerText);
  console.log('Includes FRONT ID SECURED:', statusText.includes('FRONT ID SECURED'));
  console.log('Includes ID Scan Rejected:', statusText.includes('ID Scan Rejected'));
  
  const statusMsg = await page.evaluate(() => {
    const el = document.querySelector('.field__error');
    return el ? el.textContent : 'No error element';
  });
  console.log('Error element:', statusMsg);

  const fields = await page.evaluate(`
    (() => {
      const getVal = (name) => {
        const el = document.querySelector('input[name="' + name + '"]');
        return el ? el.value : '';
      };
      return {
        first: getVal('firstName'),
        last: getVal('lastName'),
        lic: getVal('licenseNumber'),
        dob: getVal('dateOfBirth'),
        address: getVal('address')
      };
    })()
  `);
  console.log('Fields:', JSON.stringify(fields, null, 2));

  await browser.close();
}

testWebcamSnapshot().catch(console.error);
