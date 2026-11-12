import { chromium } from 'playwright';

const TEST_FILE = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1794112090689.jpg';

export const run = async (): Promise<void> => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/register?step=1', { waitUntil: 'networkidle' });

  const info = await page.evaluate(async (path) => {
    // load image via blob / file
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/jpeg;base64,' + (window as any).__testBase64;
    });
  });

  await browser.close();
};
