// [Layer: Testing/Frontend/VisionTests]
// Responsibility: TDD verification suite for visible-only OCR field sanitization, non-destructive merging, DOB age computation, and Claude/Backend provider failure & failover contracts.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, ZERO hardcoded secrets, 100% Universal Arrow Lambda syntax (=>).

import {
  sanitizeVisibleOcrFields,
  mergeVisibleOcrFields,
  computeAgeFromIsoDob,
  buildMissingFrontImageWarning,
  type VisibleOcrFields
} from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/ai/ocrFieldUtils';
import { ClaudeSonnetOcrProvider } from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/ai/ClaudeSonnetOcrProvider';
import { BackendProxyProvider } from '../../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/ai/BackendProxyProvider';
import {
  createBlankWhiteIdDataUrl,
  createElenaMarquezDriversLicenseDataUrl
} from '../fixtures/syntheticIdFixtures';

let passedCount = 0;
let failedCount = 0;

const assert = (condition: boolean, message: string): void => {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedCount += 1;
  } else {
    console.error(`[FAIL] ${message}`);
    failedCount += 1;
  }
};

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  assert(
    actual === expected,
    `${message} (expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)})`
  );
};

const BANNED_FALLBACK_TOKENS: readonly string[] = [
  'JUAN',
  'JUAN MIGUEL',
  'DELA CRUZ',
  'SANTOS',
  '1995-05-15',
  '1996-05-14',
  '2030-05-15',
  'N01-23-456789',
  'K02-24-008491',
  '+639171234567'
];

const containsBannedFallback = (serialized: string): boolean => {
  const upper = serialized.toUpperCase();
  return BANNED_FALLBACK_TOKENS.some((token: string): boolean => upper.includes(token.toUpperCase()));
};

const readModelFromFetchInit = (init?: RequestInit): string | null => {
  if (!init?.body) {
    return null;
  }
  if (typeof FormData !== 'undefined' && init.body instanceof FormData) {
    const model = init.body.get('model') ?? init.body.get('preferredModel');
    return typeof model === 'string' ? model : null;
  }
  if (typeof init.body === 'string') {
    try {
      const parsed = JSON.parse(init.body) as { readonly model?: unknown; readonly preferredModel?: unknown };
      if (typeof parsed.model === 'string') {
        return parsed.model;
      }
      if (typeof parsed.preferredModel === 'string') {
        return parsed.preferredModel;
      }
    } catch {
      return null;
    }
  }
  return null;
};

const testSanitizeVisibleOcrFields = (): void => {
  console.log('\n--- 1. Testing sanitizeVisibleOcrFields ---');

  const partialSanitized = sanitizeVisibleOcrFields({
    firstName: '  ELENA  ',
    middleName: 'N/A',
    lastName: 'MARQUEZ',
    suffix: 'null',
    dob: '1994-03-11',
    sex: 'Female',
    idNumber: 'K09-88-776655',
    barangay: 'BARRA',
    cityOrMunicipality: 'DIPOLOG',
    province: 'ZAMBOANGA DEL NORTE',
    weight: '-',
    height: 'undefined',
    phoneNumber: ''
  });

  assertEqual(partialSanitized.fields.firstName, 'ELENA', 'Preserves visible firstName ELENA');
  assertEqual(partialSanitized.fields.lastName, 'MARQUEZ', 'Preserves visible lastName MARQUEZ');
  assertEqual(partialSanitized.fields.dob, '1994-03-11', 'Preserves visible dob 1994-03-11');
  assertEqual(partialSanitized.fields.sex, 'Female', 'Preserves visible sex Female');
  assertEqual(partialSanitized.fields.idNumber, 'K09-88-776655', 'Preserves visible idNumber K09-88-776655');
  assertEqual(partialSanitized.fields.barangay, 'BARRA', 'Preserves visible barangay BARRA');
  assertEqual(partialSanitized.fields.cityOrMunicipality, 'DIPOLOG', 'Preserves visible city DIPOLOG');
  assertEqual(partialSanitized.fields.province, 'ZAMBOANGA DEL NORTE', 'Preserves visible province ZAMBOANGA DEL NORTE');
  assert(!partialSanitized.fields.middleName, 'Strips N/A marker from omitted middleName');
  assert(!partialSanitized.fields.suffix, 'Strips null marker from omitted suffix');
  assert(!partialSanitized.fields.weight, 'Strips dash marker from omitted weight');
  assert(!partialSanitized.fields.height, 'Strips undefined marker from omitted height');
  assert(!partialSanitized.fields.phoneNumber, 'Keeps empty phoneNumber omitted');

  const dummyTuple1 = sanitizeVisibleOcrFields({
    firstName: 'JUAN MIGUEL',
    middleName: 'SANTOS',
    lastName: 'DELA CRUZ',
    dob: '1996-05-14',
    sex: 'Male',
    idNumber: 'K02-24-008491',
    phoneNumber: '+639171234567',
    expirationDate: '2030-05-15'
  });

  assert(!dummyTuple1.fields.firstName, 'Rejects banned dummy firstName JUAN MIGUEL');
  assert(!dummyTuple1.fields.lastName, 'Rejects banned dummy lastName DELA CRUZ');
  assert(!dummyTuple1.fields.idNumber, 'Rejects banned dummy idNumber K02-24-008491');
  assert(!dummyTuple1.fields.dob, 'Rejects banned dummy dob 1996-05-14');
  assert(!dummyTuple1.fields.phoneNumber, 'Rejects banned dummy phone +639171234567');
  assert(dummyTuple1.strippedPlaceholders.length > 0, 'Records strippedPlaceholders for dummy specimen tuple');

  const dummyTuple2 = sanitizeVisibleOcrFields({
    firstName: 'JUAN',
    middleName: 'SANTOS',
    lastName: 'DELA CRUZ',
    dob: '1995-05-15',
    idNumber: 'N01-23-456789'
  });

  assert(!dummyTuple2.fields.firstName, 'Rejects banned dummy firstName JUAN');
  assert(!dummyTuple2.fields.idNumber, 'Rejects banned dummy idNumber N01-23-456789');
  assert(!dummyTuple2.fields.dob, 'Rejects banned dummy dob 1995-05-15');

  const legitimateKatipunan = sanitizeVisibleOcrFields({
    firstName: 'ELENA',
    lastName: 'MARQUEZ',
    dob: '1994-03-11',
    idNumber: 'K09-88-776655',
    barangay: 'Poblacion',
    cityOrMunicipality: 'Katipunan',
    province: 'Zamboanga del Norte'
  });

  assertEqual(legitimateKatipunan.fields.barangay, 'Poblacion', 'Allows legitimate Poblacion address on genuine ID');
  assertEqual(legitimateKatipunan.fields.cityOrMunicipality, 'Katipunan', 'Allows legitimate Katipunan city on genuine ID');
  assertEqual(legitimateKatipunan.fields.province, 'Zamboanga del Norte', 'Allows legitimate Zamboanga del Norte province on genuine ID');
};

const testMergeAndAgeHelpers = (): void => {
  console.log('\n--- 2. Testing mergeVisibleOcrFields, computeAgeFromIsoDob, and missing-front warning ---');

  const emptyPhase3State = {
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    dob: '',
    age: '',
    sex: '',
    idNumber: '',
    barangay: '',
    cityOrMunicipality: '',
    province: '',
    weight: '',
    height: '',
    phoneNumber: ''
  };

  const incomingVisible: VisibleOcrFields = {
    firstName: 'ELENA',
    lastName: 'MARQUEZ',
    dob: '1994-03-11',
    age: '32',
    sex: 'Female',
    idNumber: 'K09-88-776655',
    barangay: 'BARRA',
    cityOrMunicipality: 'DIPOLOG',
    province: 'ZAMBOANGA DEL NORTE',
    middleName: undefined,
    suffix: '',
    weight: undefined,
    height: '',
    phoneNumber: undefined
  };

  const mergedFromEmpty = mergeVisibleOcrFields(emptyPhase3State, incomingVisible);
  assertEqual(mergedFromEmpty.firstName, 'ELENA', 'Populates visible firstName');
  assertEqual(mergedFromEmpty.lastName, 'MARQUEZ', 'Populates visible lastName');
  assertEqual(mergedFromEmpty.dob, '1994-03-11', 'Populates visible dob');
  assertEqual(mergedFromEmpty.age, '32', 'Populates visible age');
  assertEqual(mergedFromEmpty.sex, 'Female', 'Populates visible sex');
  assertEqual(mergedFromEmpty.idNumber, 'K09-88-776655', 'Populates visible idNumber');
  assertEqual(mergedFromEmpty.barangay, 'BARRA', 'Populates visible barangay');
  assertEqual(mergedFromEmpty.cityOrMunicipality, 'DIPOLOG', 'Populates visible cityOrMunicipality');
  assertEqual(mergedFromEmpty.province, 'ZAMBOANGA DEL NORTE', 'Populates visible province');
  assertEqual(mergedFromEmpty.middleName, '', 'Leaves omitted middleName at empty string');
  assertEqual(mergedFromEmpty.suffix, '', 'Leaves omitted suffix at empty string');
  assertEqual(mergedFromEmpty.weight, '', 'Leaves omitted weight at empty string');
  assertEqual(mergedFromEmpty.height, '', 'Leaves omitted height at empty string');
  assertEqual(mergedFromEmpty.phoneNumber, '', 'Leaves omitted phoneNumber at empty string');

  const userTypedPhase3State = {
    ...emptyPhase3State,
    middleName: 'REYES',
    weight: '55',
    phoneNumber: '09170001111'
  };

  const mergedPreservingUserTyped = mergeVisibleOcrFields(userTypedPhase3State, {
    firstName: 'ELENA',
    lastName: 'MARQUEZ',
    middleName: undefined,
    weight: '',
    phoneNumber: undefined
  });

  assertEqual(mergedPreservingUserTyped.firstName, 'ELENA', 'Fills empty firstName alongside user-typed fields');
  assertEqual(mergedPreservingUserTyped.middleName, 'REYES', 'Preserves user-typed middleName when OCR omits it');
  assertEqual(mergedPreservingUserTyped.weight, '55', 'Preserves user-typed weight when OCR omits it');
  assertEqual(mergedPreservingUserTyped.phoneNumber, '09170001111', 'Preserves user-typed phoneNumber when OCR omits it');

  assertEqual(computeAgeFromIsoDob('1994-03-11'), '32', 'computeAgeFromIsoDob calculates 32 for 1994-03-11');
  assertEqual(computeAgeFromIsoDob('1994/03/11'), '32', 'computeAgeFromIsoDob calculates 32 for 1994/03/11');
  assertEqual(computeAgeFromIsoDob(''), '', 'computeAgeFromIsoDob returns empty string for empty DOB');
  assertEqual(computeAgeFromIsoDob('invalid-dob'), '', 'computeAgeFromIsoDob returns empty string (never 28) for invalid DOB');

  const missingFrontWarning = buildMissingFrontImageWarning();
  assert(
    typeof missingFrontWarning === 'string' && missingFrontWarning.trim().length > 0,
    'buildMissingFrontImageWarning returns descriptive non-empty warning'
  );
};

const testProviderFailureAndFailover = async (): Promise<void> => {
  console.log('\n--- 3. Testing ClaudeSonnetOcrProvider & BackendProxyProvider failure/failover contracts ---');

  const originalFetch = globalThis.fetch;
  const blankIdDataUrl = createBlankWhiteIdDataUrl();
  const elenaDataUrl = createElenaMarquezDriversLicenseDataUrl();

  try {
    // 3a. ClaudeSonnetOcrProvider HTTP 500 failure -> zero K02-24-008491 or 0.96 fallback
    globalThis.fetch = (async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'UNREADABLE_OR_BLANK_IMAGE',
          errorMessage: 'Uploaded ID image is blank or unreadable.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const claudeProvider = new ClaudeSonnetOcrProvider('https://mock.resqtrack.test/api/identity/ocr/extract');
    const blankExtractDual = await claudeProvider.extractDualSide({
      frontImage: blankIdDataUrl,
      idType: 'drivers',
      preferredProvider: 'claude'
    });

    assert(!containsBannedFallback(JSON.stringify(blankExtractDual)), 'Claude extractDualSide emits zero banned fallback PII on unreadable response');
    assert(blankExtractDual.firstName === '', 'Claude extractDualSide keeps firstName empty on blank ID failure');
    assert(blankExtractDual.lastName === '', 'Claude extractDualSide keeps lastName empty on blank ID failure');
    assert(blankExtractDual.idNumber === '', 'Claude extractDualSide keeps idNumber empty on blank ID failure');
    assert(blankExtractDual.confidence !== 0.96 && blankExtractDual.confidence === 0, 'Claude extractDualSide returns 0 confidence (never 0.96) on failure');

    const blankExtractResult = await claudeProvider.extract(blankIdDataUrl, 'drivers');
    const blankFieldCount = blankExtractResult ? Object.keys(blankExtractResult.fields).length : 0;
    assert(
      blankExtractResult === null || (blankExtractResult.success === false && blankFieldCount === 0),
      'Claude extract returns null or failed empty-field result on unreadable blank ID'
    );
    if (blankExtractResult) {
      assert(!containsBannedFallback(JSON.stringify(blankExtractResult)), 'Claude extract result contains zero banned fallback strings');
    }

    // 3b. ClaudeSonnetOcrProvider HTTP 404 primary claude-sonnet-4-6 -> claude-sonnet-5-5 failover
    const seenModels: string[] = [];
    let attemptNumber = 0;

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      attemptNumber += 1;
      const modelSent = readModelFromFetchInit(init);
      if (modelSent) {
        seenModels.push(modelSent);
      }

      if (attemptNumber === 1) {
        return new Response(
          JSON.stringify({
            errorCode: 'MODEL_NOT_FOUND',
            errorMessage: 'claude-sonnet-4-6 returned HTTP 404'
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          providerUsed: 'claude',
          modelUsed: 'claude-sonnet-5-5',
          confidence: 0.91,
          firstName: 'ELENA',
          surname: 'MARQUEZ',
          dateOfBirth: '1994-03-11',
          sex: 'Female',
          licenseNumber: 'K09-88-776655',
          barangay: 'BARRA',
          cityOrMunicipality: 'DIPOLOG',
          province: 'ZAMBOANGA DEL NORTE',
          middleName: null,
          suffix: null,
          weight: null,
          height: null,
          phoneNumber: null
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const failoverDual = await claudeProvider.extractDualSide({
      frontImage: elenaDataUrl,
      idType: 'drivers',
      preferredProvider: 'claude'
    });

    assertEqual(attemptNumber, 2, 'ClaudeSonnetOcrProvider retries once on HTTP 404');
    if (seenModels.length >= 2) {
      assertEqual(seenModels[0], 'claude-sonnet-4-6', 'First attempt targets claude-sonnet-4-6');
      assertEqual(seenModels[1], 'claude-sonnet-5-5', 'Fallback attempt targets claude-sonnet-5-5');
    }
    assertEqual(failoverDual.firstName, 'ELENA', 'Failover extraction preserves ELENA');
    assertEqual(failoverDual.lastName, 'MARQUEZ', 'Failover extraction preserves MARQUEZ');
    assertEqual(failoverDual.idNumber, 'K09-88-776655', 'Failover extraction preserves K09-88-776655');
    assertEqual(failoverDual.middleName, '', 'Failover extraction leaves omitted middleName empty');
    assertEqual(failoverDual.weight, '', 'Failover extraction leaves omitted weight empty');
    assertEqual(failoverDual.height, '', 'Failover extraction leaves omitted height empty');
    assert(failoverDual.confidence !== 0.96, 'Failover extraction confidence is not forced 0.96');

    // 3c. BackendProxyProvider missing-front & unreadable error handling
    let proxyFetchCalls = 0;
    globalThis.fetch = (async (): Promise<Response> => {
      proxyFetchCalls += 1;
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: 'UNREADABLE_OR_BLANK_IMAGE',
          errorMessage: 'Image contains no readable identification text.',
          confidence: 0.0,
          extractedFields: {}
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const backendProxy = new BackendProxyProvider({
      targetProvider: 'claude',
      extractEndpoint: 'https://mock.resqtrack.test/api/identity/ai-extract',
      statusEndpoint: 'https://mock.resqtrack.test/api/identity/ai-status'
    });

    const missingFrontRes = await backendProxy.extract('', 'drivers');
    assertEqual(proxyFetchCalls, 0, 'BackendProxyProvider short-circuits missing front image before calling fetch');
    assert(
      missingFrontRes === null || missingFrontRes.errorCode === 'MISSING_FRONT_IMAGE',
      'BackendProxyProvider signals MISSING_FRONT_IMAGE or null for empty front image'
    );

    const unreadableProxyRes = await backendProxy.extract(blankIdDataUrl, 'drivers');
    assertEqual(proxyFetchCalls, 1, 'BackendProxyProvider calls backend once for non-empty blank image');
    assert(
      unreadableProxyRes === null ||
        (unreadableProxyRes.success === false && Object.keys(unreadableProxyRes.fields).length === 0),
      'BackendProxyProvider returns null or failed empty-field result for UNREADABLE_OR_BLANK_IMAGE'
    );
    if (unreadableProxyRes) {
      assert(!containsBannedFallback(JSON.stringify(unreadableProxyRes)), 'BackendProxyProvider failure contains zero banned dummy PII');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const main = async (): Promise<void> => {
  console.log('====================================================================');
  console.log('VISIBLE-ONLY OCR FIDELITY & MODEL FAILOVER CONTRACT TESTS');
  console.log('====================================================================');

  testSanitizeVisibleOcrFields();
  testMergeAndAgeHelpers();
  await testProviderFailureAndFailover();

  console.log('\n====================================================================');
  if (failedCount > 0) {
    console.error(`CONTRACT SUITE FAILED: ${failedCount} failed, ${passedCount} passed.`);
    process.exit(1);
  }
  console.log(`ALL VISIBLE-ONLY OCR CONTRACT TESTS PASSED (${passedCount}/${passedCount})`);
  console.log('====================================================================');
};

void main();
