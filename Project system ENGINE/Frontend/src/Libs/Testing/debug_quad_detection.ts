import { chromium } from 'playwright';
import fs from 'fs';

const FRONT_ID_PATH = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1_1793858609231.jpg';

export const debugQuadDetection = async (): Promise<void> => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/register?step=1', { waitUntil: 'networkidle' });

  // Read image as base64
  const imgBase64 = fs.readFileSync(FRONT_ID_PATH).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${imgBase64}`;

  const result = await page.evaluate(async (srcUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ error: 'no ctx' });
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Access internal DIP routines from window or test module
        const res = (window as any).__lastFrontScanResult;
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = srcUrl;
    });
  }, dataUrl);

  console.log('Image dimensions:', result);

  const frontInput = page.locator('input[data-side="front"]');
  await frontInput.setInputFiles(FRONT_ID_PATH);
  await page.waitForTimeout(4000);

  const scanRes = await page.evaluate(() => {
    const res = (window as any).__lastFrontScanResult;
    return res ? {
      corners: res.corners,
      confidence: res.confidence,
      method: res.method,
      fields: res.fields,
      quality: res.quality,
      cardPresence: res.cardPresence
    } : null;
  });

  console.log('\n=== REAL SCAN RESULT ON WOODEN TABLE ===');
  console.log(JSON.stringify(scanRes, null, 2));

  await browser.close();
};

debugQuadDetection().catch(console.error);
