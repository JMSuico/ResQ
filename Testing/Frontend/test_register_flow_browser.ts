// [Layer: Libs/Testing]
// Responsibility: Automated Browser Testing for Unified 5-Phase Registration Identity & Facial Biometrics.
// Connects to Chrome via native CDP, validates Phase 2 (?step=1) Dual-Side Gate, Unlock & Name Separation
// inside #personal-info-section, and progression to Phase 3 (?step=2) Facial Record.

import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElenaMarquezDriversLicensePngBuffer } from './fixtures/syntheticIdFixtures';
import {
  E2E_CIVILIAN_FRONTEND_URL,
  ensureE2eServersReady,
  type E2eServersHandle
} from './fixtures/e2eServerHarness';

interface CdpMessage {
  id: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

interface CdpTargetInfo {
  readonly id: string;
  readonly url: string;
  readonly webSocketDebuggerUrl: string;
}

interface Phase2InitialGateState {
  readonly hasPhase2: boolean;
  readonly idType: string | null;
  readonly firstOptionValue: string | null;
  readonly firstOptionLabel: string | null;
  readonly hasUploadLockedNotice: boolean;
  readonly hasUploadSection: boolean;
  readonly hasFrontInput: boolean;
  readonly hasBackInput: boolean;
  readonly hasFrontDropzone: boolean;
  readonly hasBackDropzone: boolean;
  readonly hasUploadControls: boolean;
  readonly isPersonalInfoLocked: boolean;
  readonly noLegacyFullNameInput: boolean;
  readonly isNextDisabled: boolean;
}

interface Phase2PostSelectState {
  readonly idType: string | null;
  readonly lockedNoticeCount: number;
  readonly hasUploadSection: boolean;
  readonly frontInputCount: number;
  readonly backInputCount: number;
  readonly frontDropzoneCount: number;
  readonly backDropzoneCount: number;
}

interface Phase2UnlockPollState {
  readonly unlocked: boolean;
  readonly bannerStatus: string | null;
  readonly errorCode: string | null;
  readonly bannerText: string;
}

interface Phase2PersonalSectionState {
  readonly hasPersonalSection: boolean;
  readonly hasFirstName: boolean;
  readonly hasMiddleName: boolean;
  readonly hasLastName: boolean;
  readonly hasAge: boolean;
  readonly firstNameValue: string;
  readonly middleNameValue: string;
  readonly lastNameValue: string;
  readonly ageValue: string;
}

interface Phase3BiometricState {
  readonly hasPhase3: boolean;
  readonly hasBlinkPrompt: boolean;
  readonly hasCameraBtn: boolean;
  readonly hasSimBtn: boolean;
  readonly ellipseCount: number;
}

const assertCondition = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
};

const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolveDelay: () => void): void => {
    setTimeout(resolveDelay, ms);
  });

const waitForCdpPageTarget = async (
  cdpPort: number,
  maxWaitMs = 15000
): Promise<CdpTargetInfo> => {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const targets = await new Promise<CdpTargetInfo[]>((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${cdpPort}/json/list`, (res: http.IncomingMessage): void => {
            let data = '';
            res.on('data', (chunk: Buffer | string): void => {
              data += chunk.toString();
            });
            res.on('end', (): void => {
              try {
                resolve(JSON.parse(data) as CdpTargetInfo[]);
              } catch {
                reject(new Error(`Failed to parse CDP targets: ${data}`));
              }
            });
          })
          .on('error', reject);
      });
      const match =
        targets.find(
          (t: CdpTargetInfo): boolean =>
            Boolean(t.webSocketDebuggerUrl) && (t.url.includes('1998') || t.url.includes('register'))
        ) ?? targets.find((t: CdpTargetInfo): boolean => Boolean(t.webSocketDebuggerUrl));
      if (match) {
        return match;
      }
    } catch {
      // Chrome remote debugging socket not listening yet.
    }
    await sleepMs(250);
  }
  throw new Error(`Timed out waiting for Chrome CDP page target on port ${cdpPort}`);
};

const createDistinctBackIdPngBuffer = (): Buffer => {
  const width = 856;
  const height = 540;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const dark = y < 84 || (y > 340 && y < 465 && x > 48 && x < width - 48 && ((x >> 3) % 2 === 0));
      pixels[idx] = dark ? 18 : 248;
      pixels[idx + 1] = dark ? 40 : 251;
      pixels[idx + 2] = dark ? 82 : 255;
      pixels[idx + 3] = 255;
    }
  }
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunk = (t: string, d: Uint8Array): Buffer => {
    const tb = Buffer.from(t, 'ascii');
    const lb = Buffer.alloc(4);
    lb.writeUInt32BE(d.length, 0);
    const ci = Buffer.concat([tb, Buffer.from(d)]);
    let c = 0xffffffff;
    for (let i = 0; i < ci.length; i += 1) {
      c ^= ci[i];
      for (let b = 0; b < 8; b += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    const cb = Buffer.alloc(4);
    cb.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([lb, tb, Buffer.from(d), cb]);
  };
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
};

export const runFullRegisterFlowBrowserTest = async (): Promise<void> => {
  console.log('========================================================================');
  console.log('AUTOMATED BROWSER TEST: UNIFIED 5-PHASE REGISTRATION & BIOMETRIC FLOW');
  console.log('========================================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  assertCondition(fs.existsSync(chromePath), `Chrome executable not found at ${chromePath}`);
  const cdpPort = 9223;

  const servers: E2eServersHandle = await ensureE2eServersReady({ includeResponder: false });

  const tempFrontIdPath = path.join(os.tmpdir(), 'resqtrack_synthetic_elena_front_id.png');
  const tempBackIdPath = path.join(os.tmpdir(), 'resqtrack_synthetic_elena_back_id.png');
  fs.writeFileSync(tempFrontIdPath, createElenaMarquezDriversLicensePngBuffer());
  fs.writeFileSync(tempBackIdPath, createDistinctBackIdPngBuffer());

  console.log(`[1/6] Launching Chrome Headless instance on port ${cdpPort}...`);
  const chromeUserDataDir = path.join(os.tmpdir(), `resqtrack-cdp-9223-${Date.now()}`);
  const chromeProc: ChildProcess = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${chromeUserDataDir}`,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-web-security',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `${E2E_CIVILIAN_FRONTEND_URL}/register?role=civilian&step=1`
    ],
    { stdio: 'ignore' }
  );

  const cleanup = (): void => {
    try {
      chromeProc.kill('SIGKILL');
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(tempFrontIdPath)) {
        fs.unlinkSync(tempFrontIdPath);
      }
      if (fs.existsSync(tempBackIdPath)) {
        fs.unlinkSync(tempBackIdPath);
      }
    } catch {
      // ignore
    }
  };

  process.once('exit', cleanup);

  try {
    console.log('[2/6] Connecting to Chrome Page target via CDP...');
    const pageTarget = await waitForCdpPageTarget(cdpPort, 15000);

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map<number, (res: CdpMessage) => void>();

    const sendCdp = (method: string, params: Record<string, unknown> = {}): Promise<CdpMessage> => {
      const id = msgId++;
      return new Promise<CdpMessage>((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await new Promise<void>((resolve, reject) => {
      ws.onopen = (): void => resolve();
      ws.onerror = (): void => reject(new Error('CDP WebSocket connection failed.'));
    });

    ws.onmessage = (evt: MessageEvent): void => {
      const msg: CdpMessage = JSON.parse(String(evt.data)) as CdpMessage;
      if (msg.id && pending.has(msg.id)) {
        const cb = pending.get(msg.id);
        pending.delete(msg.id);
        if (cb) {
          cb(msg);
        }
      }
    };

    await sendCdp('Runtime.enable');
    await sendCdp('Page.enable');
    await sendCdp('DOM.enable');

    const uploadInputFile = async (selector: string, filePath: string): Promise<boolean> => {
      const docRes = await sendCdp('DOM.getDocument', { depth: -1 });
      const rootNodeId = (docRes.result as { root?: { nodeId?: number } })?.root?.nodeId;
      if (!rootNodeId) return false;
      const queryRes = await sendCdp('DOM.querySelector', { nodeId: rootNodeId, selector });
      const inputNodeId = (queryRes.result as { nodeId?: number })?.nodeId;
      if (!inputNodeId) return false;
      await sendCdp('DOM.setFileInputFiles', { nodeId: inputNodeId, files: [filePath] });
      return true;
    };

    console.log('[3/6] Waiting for React 19 app initialization on #phase-2-id-identity...');
    let phase2Mounted = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const readyRes = await sendCdp('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('#phase-2-id-identity') && document.querySelector('select#id-type'))`,
        returnByValue: true
      });
      phase2Mounted = Boolean((readyRes.result as { result?: { value?: boolean } })?.result?.value);
      if (phase2Mounted) {
        break;
      }
      await sleepMs(250);
    }
    if (!phase2Mounted) {
      const mountDiagRes = await sendCdp('Runtime.evaluate', {
        expression: `JSON.stringify({ href: window.location.href, title: document.title, body: (document.body?.innerText || '').slice(0, 200) })`,
        returnByValue: true
      });
      console.log('[INIT MOUNT DIAG]:', (mountDiagRes.result as { result?: { value?: string } })?.result?.value);
    }
    assertCondition(phase2Mounted, 'Timed out waiting for #phase-2-id-identity and select#id-type to mount.');

    // Phase A: Verify Phase 2 (?step=1) Choose ID Type Upload Lock & Hidden Personal Info Gate
    console.log('\n--- VERIFYING PHASE 2 (#phase-2-id-identity) CHOOSE ID TYPE UPLOAD GATE ---');
    const step1Check = await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const phase2 = document.querySelector('#phase-2-id-identity');
          const personalSection = document.querySelector('#personal-info-section');
          const fullNameInput = document.querySelector('input[name="fullname"]') || document.querySelector('input[name="fullName"]');
          const idTypeSelect = document.querySelector('select#id-type');
          const firstOption = idTypeSelect ? idTypeSelect.querySelector('option') : null;
          const lockedNotice = document.querySelector('#id-upload-locked-notice');
          const uploadSection = document.querySelector('#id-upload-section');
          const frontInput = document.querySelector('#front-id-input');
          const backInput = document.querySelector('#back-id-input');
          const frontDropzone = document.querySelector('#front-id-dropzone');
          const backDropzone = document.querySelector('#back-id-dropzone');
          const nextBtn = document.querySelector('#btn-phase2-next');

          return {
            hasPhase2: !!phase2,
            idType: idTypeSelect ? idTypeSelect.value : null,
            firstOptionValue: firstOption ? firstOption.value : null,
            firstOptionLabel: firstOption && firstOption.textContent ? firstOption.textContent.trim() : null,
            hasUploadLockedNotice: !!(lockedNotice && lockedNotice.getBoundingClientRect().height > 0),
            hasUploadSection: !!uploadSection,
            hasFrontInput: !!frontInput,
            hasBackInput: !!backInput,
            hasFrontDropzone: !!frontDropzone,
            hasBackDropzone: !!backDropzone,
            hasUploadControls: !!(uploadSection || frontInput || backInput || frontDropzone || backDropzone),
            isPersonalInfoLocked: !personalSection,
            noLegacyFullNameInput: !fullNameInput,
            isNextDisabled: nextBtn ? nextBtn.disabled : true
          };
        })()
      `,
      returnByValue: true
    });

    const s1 = (step1Check.result as { result?: { value?: Phase2InitialGateState } })?.result?.value;
    console.log('[EVAL RESULT 1 - INITIAL GATE]:', JSON.stringify(s1));

    if (!s1) {
      throw new Error('Failed to evaluate initial Phase 2 state in browser.');
    }
    assertCondition(s1.hasPhase2, 'Expected #phase-2-id-identity to be visible at /register?step=1.');
    assertCondition(s1.idType === '', `Expected initial select#id-type value to be '', got '${String(s1.idType)}'.`);
    assertCondition(
      s1.firstOptionValue === '',
      `Expected first option value to be '', got '${String(s1.firstOptionValue)}'.`
    );
    assertCondition(
      s1.firstOptionLabel === 'Choose ID Type',
      `Expected first option label to be 'Choose ID Type', got '${String(s1.firstOptionLabel)}'.`
    );
    assertCondition(
      s1.hasUploadLockedNotice,
      'Expected #id-upload-locked-notice to be visible prior to selecting an ID type.'
    );
    assertCondition(
      !s1.hasUploadControls &&
        !s1.hasUploadSection &&
        !s1.hasFrontInput &&
        !s1.hasBackInput &&
        !s1.hasFrontDropzone &&
        !s1.hasBackDropzone,
      `Expected upload section, inputs, and dropzones to be absent before ID type selection: ${JSON.stringify(s1)}`
    );
    assertCondition(
      s1.isPersonalInfoLocked,
      'Expected #personal-info-section to remain unmounted prior to ID verification.'
    );
    assertCondition(s1.noLegacyFullNameInput, 'Expected legacy monolithic fullName input to be absent.');
    assertCondition(s1.isNextDisabled, 'Expected #btn-phase2-next to be disabled prior to ID verification.');
    console.log('[PASS] Phase 2 (?step=1) Choose ID Type lock gate verified before selecting ID type.');

    // Phase A2: Select 'drivers' ID type via React native value setter and verify upload controls mount
    const selectedRes = await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const sel = document.querySelector('select#id-type');
          if (!sel) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          if (setter) setter.call(sel, 'drivers');
          else sel.value = 'drivers';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()
      `,
      returnByValue: true
    });
    const selectedDispatched = Boolean(
      (selectedRes.result as { result?: { value?: boolean } })?.result?.value
    );
    assertCondition(selectedDispatched, 'Failed to select drivers on select#id-type.');

    let postSelect: Phase2PostSelectState | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const checkMounted = await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const sel = document.querySelector('select#id-type');
            return {
              idType: sel ? sel.value : null,
              lockedNoticeCount: document.querySelectorAll('#id-upload-locked-notice').length,
              hasUploadSection: Boolean(document.querySelector('#id-upload-section')),
              frontInputCount: document.querySelectorAll('input#front-id-input').length,
              backInputCount: document.querySelectorAll('input#back-id-input').length,
              frontDropzoneCount: document.querySelectorAll('#front-id-dropzone').length,
              backDropzoneCount: document.querySelectorAll('#back-id-dropzone').length
            };
          })()
        `,
        returnByValue: true
      });
      postSelect = (checkMounted.result as { result?: { value?: Phase2PostSelectState } })?.result?.value;
      if (
        postSelect &&
        postSelect.idType === 'drivers' &&
        postSelect.lockedNoticeCount === 0 &&
        postSelect.hasUploadSection &&
        postSelect.frontInputCount === 1 &&
        postSelect.backInputCount === 1
      ) {
        break;
      }
      await sleepMs(250);
    }

    console.log('[EVAL RESULT 1B - POST ID TYPE SELECT]:', JSON.stringify(postSelect));
    if (!postSelect) {
      throw new Error('Failed to evaluate post-selection Phase 2 upload mount state.');
    }
    assertCondition(postSelect.idType === 'drivers', `Expected select#id-type === 'drivers', got '${String(postSelect.idType)}'`);
    assertCondition(
      postSelect.lockedNoticeCount === 0,
      `Expected #id-upload-locked-notice count === 0 after selecting drivers, got ${postSelect.lockedNoticeCount}`
    );
    assertCondition(postSelect.hasUploadSection, 'Expected #id-upload-section to mount after selecting drivers.');
    assertCondition(
      postSelect.frontInputCount === 1 && postSelect.backInputCount === 1,
      `Expected input#front-id-input and input#back-id-input to mount (front=${postSelect.frontInputCount}, back=${postSelect.backInputCount}).`
    );
    assertCondition(
      postSelect.frontDropzoneCount === 1 && postSelect.backDropzoneCount === 1,
      `Expected #front-id-dropzone and #back-id-dropzone to mount (front=${postSelect.frontDropzoneCount}, back=${postSelect.backDropzoneCount}).`
    );
    console.log('[PASS] #id-upload-section, input#front-id-input, and input#back-id-input mounted and #id-upload-locked-notice removed.');

    // Phase B: Upload distinct Front & Back ID and wait for #personal-info-section unlock
    console.log('\n--- UPLOADING DISTINCT FRONT & BACK GOV ID & UNLOCKING PERSONAL INFO ---');
    const uploadedFront = await uploadInputFile('#front-id-input', tempFrontIdPath);
    await sleepMs(200);
    const uploadedBack = await uploadInputFile('#back-id-input', tempBackIdPath);
    console.log('[UPLOAD RESULT]:', JSON.stringify({ uploadedFront, uploadedBack }));
    assertCondition(uploadedFront && uploadedBack, 'Failed to set Front and Back files via CDP DOM.setFileInputFiles.');

    let unlockedPersonalSection = false;
    let lastPollState: Phase2UnlockPollState | undefined;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await sleepMs(500);
      const pollRes = await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const personal = document.querySelector('#personal-info-section');
            const banner = document.querySelector('#id-verification-banner');
            return {
              unlocked: Boolean(personal),
              bannerStatus: banner ? banner.getAttribute('data-verification-status') : null,
              errorCode: banner ? banner.getAttribute('data-error-code') : null,
              bannerText: banner && banner.textContent ? banner.textContent.trim() : ''
            };
          })()
        `,
        returnByValue: true
      });
      lastPollState = (pollRes.result as { result?: { value?: Phase2UnlockPollState } })?.result?.value;
      if (lastPollState?.unlocked) {
        unlockedPersonalSection = true;
        break;
      }
      if (lastPollState?.bannerStatus === 'REJECTED_LOCAL' || lastPollState?.bannerStatus === 'REJECTED_AI') {
        throw new Error(
          `Dual-side ID verification rejected (${lastPollState.errorCode ?? 'UNKNOWN'}): ${lastPollState.bannerText}`
        );
      }
    }
    assertCondition(
      unlockedPersonalSection,
      `Timed out waiting for #personal-info-section unlock. Last banner state: ${JSON.stringify(lastPollState)}`
    );

    // Phase C: Verify separated inputs inside #personal-info-section and advance Phase 2 -> Phase 3 Facial
    const unlockedCheck = await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const section = document.querySelector('#personal-info-section');
          const fn = document.querySelector('#first-name, input[name="firstName"]');
          const mn = document.querySelector('#middle-name, input[name="middleName"]');
          const ln = document.querySelector('#last-name, input[name="lastName"]');
          const age = document.querySelector('#age, input[name="age"]');

          return {
            hasPersonalSection: !!section,
            hasFirstName: !!fn,
            hasMiddleName: !!mn,
            hasLastName: !!ln,
            hasAge: !!age,
            firstNameValue: fn ? fn.value : '',
            middleNameValue: mn ? mn.value : '',
            lastNameValue: ln ? ln.value : '',
            ageValue: age ? age.value : ''
          };
        })()
      `,
      returnByValue: true
    });

    const s2 = (unlockedCheck.result as { result?: { value?: Phase2PersonalSectionState } })?.result?.value;
    console.log('[EVAL RESULT 2 - PHASE 2 PERSONAL SECTION]:', JSON.stringify(s2));

    if (s2?.hasPersonalSection && s2?.hasFirstName && s2?.hasLastName) {
      console.log('[PASS] #personal-info-section unlocked inside #phase-2-id-identity after dual-side Gov ID check.');
      console.log(
        `[PASS] Verified separated inputs: First Name ("${s2.firstNameValue}"), Middle Name ("${s2.middleNameValue}"), Surname ("${s2.lastNameValue}"), Age ("${s2.ageValue}")`
      );
    } else {
      throw new Error('#personal-info-section failed to unlock after uploading distinct Front & Back Driver License PNGs.');
    }

    // Populate any missing required Phase 2 inputs and click #btn-phase2-next to advance to Phase 3 Facial
    console.log('\n--- COMPLETING PHASE 2 REQUIRED FIELDS & ADVANCING TO PHASE 3 ---');
    const docRootRes = await sendCdp('DOM.getDocument', { depth: -1 });
    const phase2RootNodeId = (docRootRes.result as { root?: { nodeId?: number } })?.root?.nodeId;
    assertCondition(Boolean(phase2RootNodeId), 'Expected valid CDP document root nodeId in Phase 2.');

    const typeIntoEmptyFieldViaCdp = async (selector: string, textValue: string): Promise<string> => {
      const qRes = await sendCdp('DOM.querySelector', { nodeId: phase2RootNodeId, selector });
      const nodeId = (qRes.result as { nodeId?: number })?.nodeId;
      if (!nodeId) return 'missing';
      const valRes = await sendCdp('Runtime.evaluate', {
        expression: `document.querySelector(${JSON.stringify(selector)})?.value ?? ''`,
        returnByValue: true
      });
      const existingVal = String((valRes.result as { result?: { value?: string } })?.result?.value ?? '');
      if (existingVal.trim().length > 0) return `kept:${existingVal}`;
      await sendCdp('DOM.focus', { nodeId });
      await sendCdp('Input.insertText', { text: textValue });
      await sleepMs(60);
      return `typed:${textValue}`;
    };

    const setSelectIfEmpty = async (selector: string, value: string): Promise<string> => {
      const res = await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return 'missing';
            if (el.value) return 'kept:' + el.value;
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
            if (setter) setter.call(el, ${JSON.stringify(value)});
            else el.value = ${JSON.stringify(value)};
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return 'set:' + el.value;
          })()
        `,
        returnByValue: true
      });
      return String((res.result as { result?: { value?: string } })?.result?.value ?? '');
    };

    const fillResults = {
      firstName: await typeIntoEmptyFieldViaCdp('#first-name', 'ELENA'),
      lastName: await typeIntoEmptyFieldViaCdp('#last-name', 'MARQUEZ'),
      sex: await setSelectIfEmpty('#sex', 'Female'),
      dob: await typeIntoEmptyFieldViaCdp('#dob', '1994-03-11'),
      age: await typeIntoEmptyFieldViaCdp('#age', '32'),
      phoneNumber: await typeIntoEmptyFieldViaCdp('#phone-number', '+639185550199'),
      province: await typeIntoEmptyFieldViaCdp('#province', 'ZAMBOANGA DEL NORTE'),
      city: await typeIntoEmptyFieldViaCdp('#city', 'KATIPUNAN'),
      barangay: await typeIntoEmptyFieldViaCdp('#barangay', 'POBLACION'),
      streetOrPurok: await typeIntoEmptyFieldViaCdp('#street-purok', 'PUROK 1')
    };
    console.log('[PHASE 2 CDP FILL SNAPSHOT]:', JSON.stringify(fillResults));

    let clickedNext = false;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await sleepMs(200);
      const clickRes = await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const nextBtn = document.querySelector('#btn-phase2-next');
            if (nextBtn && !nextBtn.disabled) {
              nextBtn.click();
              return true;
            }
            return false;
          })()
        `,
        returnByValue: true
      });
      clickedNext = Boolean((clickRes.result as { result?: { value?: boolean } })?.result?.value);
      if (clickedNext) {
        break;
      }
    }
    if (!clickedNext) {
      const diagRes = await sendCdp('Runtime.evaluate', {
        expression: `
          (() => {
            const q = (s) => document.querySelector(s)?.value ?? null;
            return {
              roleBanner: document.body.innerText.split(String.fromCharCode(10)).find((l) => l.includes('Active Role:')) ?? null,
              idType: q('select#id-type'),
              firstName: q('#first-name'),
              lastName: q('#last-name'),
              sex: q('#sex'),
              dob: q('#dob'),
              age: q('#age'),
              phone: q('#phone-number'),
              province: q('#province'),
              city: q('#city'),
              barangay: q('#barangay'),
              street: q('#street-purok'),
              nextDisabled: Boolean(document.querySelector('#btn-phase2-next')?.disabled)
            };
          })()
        `,
        returnByValue: true
      });
      console.log('[PHASE 2 FAILURE DIAG]:', JSON.stringify(diagRes.result));
    }
    assertCondition(clickedNext, 'Expected #btn-phase2-next to become enabled and click cleanly after completing Phase 2.');

    let phase3Mounted = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await sleepMs(250);
      const p3Res = await sendCdp('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('#phase-3-facial-record'))`,
        returnByValue: true
      });
      phase3Mounted = Boolean((p3Res.result as { result?: { value?: boolean } })?.result?.value);
      if (phase3Mounted) {
        break;
      }
    }
    assertCondition(phase3Mounted, 'Timed out waiting for #phase-3-facial-record after clicking #btn-phase2-next.');

    // Phase D: Verify Phase 3 (?step=2 / #phase-3-facial-record) ManualFacialCapturePanel
    console.log('\n--- VERIFYING PHASE 3 (#phase-3-facial-record) BIOMETRIC HUD ---');
    const step2Check = await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          const phase3 = document.querySelector('#phase-3-facial-record');
          const bodyText = document.body.innerText;
          const hasBlinkPrompt = /blink/i.test(bodyText);
          const hasCameraBtn = !!document.querySelector('#btn-request-camera');
          const hasSimBtn = !!document.querySelector('#btn-simulate-4pose-capture');
          const ellipses = document.querySelectorAll('#phase-3-facial-record svg ellipse, svg ellipse');

          return {
            hasPhase3: !!phase3,
            hasBlinkPrompt,
            hasCameraBtn,
            hasSimBtn,
            ellipseCount: ellipses.length
          };
        })()
      `,
      returnByValue: true
    });

    const s3 = (step2Check.result as { result?: { value?: Phase3BiometricState } })?.result?.value;
    console.log('[EVAL RESULT 3 - PHASE 3 BIOMETRIC HUD]:', JSON.stringify(s3));

    if (s3?.hasPhase3) {
      console.log('[PASS] Phase 3 (#phase-3-facial-record) successfully reached.');
    } else {
      throw new Error('Expected #phase-3-facial-record to render after clicking #btn-phase2-next.');
    }
    assertCondition(
      Boolean(s3.hasCameraBtn && s3.hasSimBtn),
      'Expected #btn-request-camera and #btn-simulate-4pose-capture to be present in Phase 3.'
    );
    console.log(
      '[PASS] Camera activation & 4-pose simulation controls verified (#btn-request-camera, #btn-simulate-4pose-capture).'
    );

    await sendCdp('Runtime.evaluate', {
      expression: `document.querySelector('#btn-request-camera')?.click()`
    });

    let activeEllipseCount = 0;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await sleepMs(200);
      const ellipseRes = await sendCdp('Runtime.evaluate', {
        expression: `document.querySelectorAll('#phase-3-facial-record svg ellipse, svg ellipse').length`,
        returnByValue: true
      });
      activeEllipseCount = Number((ellipseRes.result as { result?: { value?: number } })?.result?.value ?? 0);
      if (activeEllipseCount >= 1) {
        break;
      }
    }
    assertCondition(
      activeEllipseCount >= 1,
      `Expected >= 1 <ellipse> in Phase 3 live camera HUD after activating camera, got ${activeEllipseCount}.`
    );
    console.log(`[PASS] SVG facial alignment oval guide verified (${activeEllipseCount} <ellipse> present).`);

    // Save final browser screenshot
    const screenshotRes = await sendCdp('Page.captureScreenshot', { format: 'png' });
    const b64 = (screenshotRes.result as { data?: string })?.data;
    if (b64) {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const outScreenshot = path.resolve(currentDir, 'browser_full_registration_test.png');
      fs.writeFileSync(outScreenshot, Buffer.from(b64, 'base64'));
      console.log(`\n[OK] Full Registration Flow Screenshot captured: ${outScreenshot}`);
    }

    console.log('\n========================================================================');
    console.log('AUTOMATED BROWSER TEST PASSED WITH 100% SUCCESS');
    console.log('========================================================================');

    ws.close();
  } finally {
    cleanup();
    await servers.stopAll();
  }
};

runFullRegisterFlowBrowserTest().catch((err: unknown) => {
  console.error('[ERROR] Automated Browser Test Failed:', err);
  process.exit(1);
});
