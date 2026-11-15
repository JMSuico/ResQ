// [Layer: Libs/Testing]
// Responsibility: Native Chrome DevTools Protocol (CDP) Browser Console Automator.
// Launches a real Chrome browser instance, connects via WebSocket CDP, navigates to
// http://127.0.0.1:1998/register?step=2 (#phase-3-facial-record), captures live browser
// console logs, exercises Phase 3 4-pose simulation & confirmation controls,
// and saves a verification browser screenshot.

import http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface CdpMessage {
  id: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export const runBrowserConsoleTest = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('EXTREME CHALLENGE: LIVE BROWSER CONSOLE VERIFICATION VIA CDP');
  console.log('========================================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9222;

  console.log(`[1/5] Launching Chrome Headless instance on port ${cdpPort}...`);
  const chromeProc: ChildProcess = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-web-security',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      'http://127.0.0.1:1998/register?step=2'
    ],
    { stdio: 'ignore' }
  );

  const cleanup = () => {
    try {
      chromeProc.kill('SIGKILL');
    } catch {
      // ignore
    }
  };

  process.on('exit', cleanup);

  // Wait 2.5s for Chrome to bind CDP port and initialize page
  await new Promise((r) => setTimeout(r, 2500));

  try {
    console.log(`[2/5] Fetching CDP targets from http://127.0.0.1:${cdpPort}/json/list...`);
    const targets = await new Promise<Array<{ id: string; url: string; webSocketDebuggerUrl: string }>>((resolve, reject) => {
      http.get(`http://127.0.0.1:${cdpPort}/json/list`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse /json/list: ${data} (Error: ${e})`));
          }
        });
      }).on('error', reject);
    });

    const pageTarget = targets.find((t) => t.webSocketDebuggerUrl && (t.url.includes('1998') || t.url.includes('register'))) || targets[0];
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error(`No valid page target found in /json/list: ${JSON.stringify(targets)}`);
    }

    const pageWsUrl = pageTarget.webSocketDebuggerUrl;
    console.log(`[OK] Connected to Chrome Page target: ${pageWsUrl} (${pageTarget.url})`);

    // Connect WebSocket
    const ws = new WebSocket(pageWsUrl);
    let msgId = 1;
    const pendingCallbacks = new Map<number, (res: CdpMessage) => void>();
    const consoleLogs: Array<{ type: string; text: string }> = [];
    const runtimeExceptions: string[] = [];

    const sendCdp = (method: string, params: Record<string, unknown> = {}): Promise<CdpMessage> => {
      const id = msgId++;
      return new Promise<CdpMessage>((resolve) => {
        pendingCallbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (err) => reject(err);
    });

    ws.onmessage = (event) => {
      const msg: CdpMessage = JSON.parse(event.data.toString());
      if (msg.id && pendingCallbacks.has(msg.id)) {
        const cb = pendingCallbacks.get(msg.id)!;
        pendingCallbacks.delete(msg.id);
        cb(msg);
      }

      // Capture browser console logs
      if (msg.method === 'Runtime.consoleAPICalled') {
        const p = msg.params as {
          type: string;
          args: Array<{ type: string; value?: unknown; description?: string }>;
        };
        const text = (p.args || [])
          .map((a) => (a.value !== undefined ? String(a.value) : a.description || ''))
          .join(' ');
        consoleLogs.push({ type: p.type, text });
        console.log(`  [BROWSER CONSOLE ${p.type.toUpperCase()}] ${text}`);
      }

      if (msg.method === 'Runtime.exceptionThrown') {
        const p = msg.params as { exceptionDetails?: { text?: string } };
        const errText = p.exceptionDetails?.text || 'Uncaught exception';
        runtimeExceptions.push(errText);
        console.error(`  [BROWSER EXCEPTION] ${errText}`);
      }
    };

    // Enable CDP Domains
    await sendCdp('Runtime.enable');
    await sendCdp('Page.enable');
    await sendCdp('DOM.enable');

    console.log('[4/5] Waiting for page load and Phase 3 biometric initialization...');
    await new Promise((r) => setTimeout(r, 3000));

    // Evaluate JavaScript in browser console: inspect Phase 3 (#phase-3-facial-record) DOM
    const evalResult = await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const title = document.title;
          const hasPhase3 = !!document.querySelector('#phase-3-facial-record');
          const hasSimBtn = !!document.querySelector('#btn-simulate-4pose-capture');
          const hasCameraBtn = !!document.querySelector('#btn-request-camera');
          const ellipseCount = document.querySelectorAll('#phase-3-facial-record svg ellipse, svg ellipse').length;
          return { title, hasPhase3, hasSimBtn, hasCameraBtn, ellipseCount };
        })()
      `,
      returnByValue: true
    });

    const initialState = (evalResult.result as {
      result?: {
        value: {
          title: string;
          hasPhase3: boolean;
          hasSimBtn: boolean;
          hasCameraBtn: boolean;
          ellipseCount: number;
        };
      };
    })?.result?.value;
    console.log('  [CDP Evaluate Result]:', JSON.stringify(initialState));

    // Execute Phase 3 4-pose capture & confirmation sequence in browser console
    console.log('[5/5] Executing Phase 3 Biometric Simulation Sequence in browser console...');
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          console.info("[TEST-RUNNER] Starting Phase 3 (?step=2) Biometric Console Verification...");
          const simBtn = document.querySelector('#btn-simulate-4pose-capture');
          if (simBtn) {
            simBtn.click();
            console.info("[TEST-RUNNER] Clicked #btn-simulate-4pose-capture for 4-pose qualification.");
          } else {
            console.warn("[TEST-RUNNER] #btn-simulate-4pose-capture button not found in DOM.");
          }
          return { simulated: !!simBtn };
        })()
      `,
      returnByValue: true
    });

    await new Promise((r) => setTimeout(r, 800));

    const confirmResult = await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const bodyText = document.body.innerText;
          const qualified4of4 = bodyText.includes('4 of 4 Poses Qualified');
          const consentChk = document.querySelector('#chk-facial-consent, #facial-consent-checkbox');
          if (consentChk && !consentChk.checked) {
            consentChk.click();
          }
          const confirmBtn = document.querySelector('#btn-confirm-facial-capture');
          if (confirmBtn && !confirmBtn.disabled) {
            confirmBtn.click();
          }
          console.info("[TEST-RUNNER] Phase 3 4-pose check complete: qualified4of4=" + qualified4of4);
          return { qualified4of4, consentChecked: !!(consentChk && consentChk.checked) };
        })()
      `,
      returnByValue: true
    });

    console.log('  [Phase 3 Simulation Confirm]:', JSON.stringify((confirmResult.result as { result?: { value: unknown } })?.result?.value));
    await new Promise((r) => setTimeout(r, 1000));

    const finalPhase3Check = await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const confirmedBadge = !!document.querySelector('#badge-facial-confirmed');
          const nextBtn = document.querySelector('#btn-phase3-next');
          const nextEnabled = nextBtn ? !nextBtn.disabled : false;
          console.info("[TEST-RUNNER] Phase 3 confirmation state: badge=" + confirmedBadge + ", nextEnabled=" + nextEnabled);
          return { confirmedBadge, nextEnabled };
        })()
      `,
      returnByValue: true
    });

    const finalState = (finalPhase3Check.result as {
      result?: { value: { confirmedBadge: boolean; nextEnabled: boolean } };
    })?.result?.value;
    console.log('  [Phase 3 Final DOM]:', JSON.stringify(finalState));

    // Capture screenshot of browser page via CDP
    const screenshotRes = await sendCdp('Page.captureScreenshot', { format: 'png' });
    const b64Data = (screenshotRes.result as { data?: string })?.data;
    if (b64Data) {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const outPath = path.resolve(currentDir, 'cdp_browser_verification.png');
      fs.writeFileSync(outPath, Buffer.from(b64Data, 'base64'));
      console.log(`  [OK] Saved browser screenshot to: ${outPath}`);
    }

    // Verify console logs & DOM assertions
    console.log('\n--- BROWSER CONSOLE VERIFICATION ASSERTIONS ---');
    const logTexts = consoleLogs.map((l) => l.text);

    const assertLog = (pattern: string, desc: string): void => {
      const match = logTexts.some((t) => t.includes(pattern));
      if (match) {
        console.log(`[PASS] ${desc}`);
      } else {
        console.error(`[FAIL] ${desc} (Missing pattern: "${pattern}")`);
        throw new Error(`Browser console log pattern not found: ${pattern}`);
      }
    };

    if (!initialState?.hasPhase3) {
      throw new Error('#phase-3-facial-record was not rendered on http://127.0.0.1:1998/register?step=2');
    }
    if (runtimeExceptions.length > 0) {
      throw new Error(`Uncaught browser runtime exceptions detected: ${runtimeExceptions.join('; ')}`);
    }
    const consoleErrors = consoleLogs.filter((l) => l.type === 'error');
    if (consoleErrors.length > 0) {
      throw new Error(`Console error logs detected: ${consoleErrors.map((e) => e.text).join('; ')}`);
    }

    assertLog('Starting Phase 3 (?step=2) Biometric Console Verification', 'Phase 3 test runner telemetry logged');
    assertLog('Phase 3 4-pose check complete: qualified4of4=true', '4-of-4 simulated pose qualification verified');
    assertLog('Phase 3 confirmation state: badge=true, nextEnabled=true', 'Facial confirmation badge & Phase 3 next button verified');

    console.log('\n========================================================================');
    console.log('ALL BROWSER CONSOLE ASSERTIONS VERIFIED SUCCESSFULLY (100% PASS)');
    console.log('========================================================================');

    ws.close();
  } finally {
    cleanup();
  }
};

runBrowserConsoleTest().catch((err: unknown) => {
  console.error('[ERROR] Browser Console Verification Failed:', err);
  process.exit(1);
});
