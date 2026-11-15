import { chromium } from 'playwright';

const TEST_FILE = 'C:\\Users\\provu\\.gemini\\antigravity-cli\\brain\\f4db8cc5-1635-43fd-94bb-ed301c4741f1\\.user_uploaded\\uploaded_media_1794112090689.jpg';

export const run = async (): Promise<void> => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:1998/register?step=1', { waitUntil: 'networkidle' });
  await page.locator('#phase-2-id-identity').waitFor({ state: 'visible', timeout: 8000 });

  const info = await page.evaluate(async (): Promise<{ naturalWidth: number; naturalHeight: number } | null> => {
    // load image via blob / file
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      };
      img.onerror = () => resolve(null);
      const win = window as unknown as { __testBase64?: string };
      img.src = 'data:image/jpeg;base64,' + (win.__testBase64 ?? '');
    });
  });
  void TEST_FILE;
  void info;

  await browser.close();
};
