import { chromium } from 'playwright';

const TEST_FILE = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1794112090689.jpg';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('[BROWSER]', msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]', err));

  await page.goto('http://localhost:5176/register?step=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const frontInput = page.locator('input[data-side="front"]');
  await frontInput.setInputFiles(TEST_FILE);
  await page.waitForTimeout(10000);

  const scanResult = await page.evaluate(`
    (() => {
      const res = window.__lastFrontScanResult;
      if (!res) return null;
      return {
        success: res.success,
        category: res.category,
        confidence: res.confidence,
        fields: res.fields,
        rawText: res.rawText
      };
    })()
  `);
  console.log('--- EXTRACTED FIELDS & RAW TEXT ---');
  console.log(JSON.stringify(scanResult, null, 2));

  await browser.close();
}

main().catch(console.error);
