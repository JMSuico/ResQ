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

  await page.goto('http://localhost:5176/register?step=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('Uploading Front ID...');
  const frontInput = page.locator('input[data-side="front"]');
  await frontInput.setInputFiles(FRONT_ID_PATH);
  await page.waitForTimeout(6000);

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

  const frontValues = {
    firstName: await getInputValue('#first-name'),
    middleName: await getInputValue('#middle-name'),
    lastName: await getInputValue('#last-name'),
    dateOfBirth: await getInputValue('#dob'),
    age: await getInputValue('#age'),
    licenseNumber: await getInputValue('#license-number'),
    address: await getInputValue('#address'),
    weight: await getInputValue('#weight'),
    height: await getInputValue('#height'),
    sex: await getSelectValue('#sex')
  };

  console.log('\n=== FORM VALUES AFTER FRONT ID ===');
  console.log(JSON.stringify(frontValues, null, 2));

  console.log('\nUploading Back ID...');
  const backInput = page.locator('input[data-side="back"]');
  await backInput.setInputFiles(BACK_ID_PATH);
  await page.waitForTimeout(6000);

  const afterBackValues = {
    firstName: await getInputValue('#first-name'),
    middleName: await getInputValue('#middle-name'),
    lastName: await getInputValue('#last-name'),
    dateOfBirth: await getInputValue('#dob'),
    age: await getInputValue('#age'),
    licenseNumber: await getInputValue('#license-number'),
    address: await getInputValue('#address'),
    weight: await getInputValue('#weight'),
    height: await getInputValue('#height'),
    sex: await getSelectValue('#sex')
  };

  console.log('\n=== FORM VALUES AFTER BACK ID ===');
  console.log(JSON.stringify(afterBackValues, null, 2));

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log('\nScreenshot saved to:', SCREENSHOT_PATH);

  await browser.close();
};

runInspection().catch(console.error);
