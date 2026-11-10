import { chromium } from 'playwright';
import fs from 'fs';

const TEST_FILE = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1794112090689.jpg';

export const run = async (): Promise<void> => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  await page.goto('http://localhost:5173/register?step=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const frontInput = page.locator('input[data-side="front"]');
  await frontInput.setInputFiles(TEST_FILE);
  await page.waitForTimeout(6000);

  const scanResult = await page.evaluate(() => {
    return (window as any).__lastFrontScanResult;
  });

  if (scanResult?.rectifiedImageUrl) {
    const base64Data = scanResult.rectifiedImageUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('C:\\Users\\provu\\Desktop\\rectified_debug.png', base64Data, 'base64');
    console.log('Saved rectified image to C:\\Users\\provu\\Desktop\\rectified_debug.png');
  }

  await browser.close();
};

run().catch(console.error);
