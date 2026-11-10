// [Layer: Test/Libs/Vision/idScanner]
// Responsibility: Comprehensive Verification Suite for Philippine Driver's License
// PascalCase Indication-to-Target Parsing, Noise Suppression, and Dynamic DOB Auto-Fill.
// Strict TypeScript, ZERO 'any', 100% universal lambdas (=>).

import {
  isPascalCaseLabel,
  parseFieldsByPascalCaseIndications,
  parseIdFieldsWithSpatialFsm
} from '../textExtractor';
import {
  isPlausibleHumanName,
  parseNameComponents,
  normalizePhilippineAddress,
  normalizePhysicalMeasurement,
  validateIdNumber
} from '../validators';
import { getIdSpec } from '../idSpecs';

let passedCount = 0;
let totalCount = 0;

const assert = (condition: boolean, msg: string): void => {
  totalCount++;
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedCount++;
  console.log(`[PASS] ${msg}`);
};

// ============================================================================
// SUITE 1: PascalCase Header Identification & Non-Header Discrimination
// ============================================================================
console.log('\n--- 1. Testing PascalCase Field Header Identification ---');

// Mandatory Philippine Government Card Headers
assert(isPascalCaseLabel('Last Name, First Name, Middle Name') === true, 'Recognizes "Last Name, First Name, Middle Name" as PascalCase header');
assert(isPascalCaseLabel('Nationality') === true, 'Recognizes "Nationality" as PascalCase header');
assert(isPascalCaseLabel('Sex') === true, 'Recognizes "Sex" as PascalCase header');
assert(isPascalCaseLabel('Date of Birth') === true, 'Recognizes "Date of Birth" as PascalCase header');
assert(isPascalCaseLabel('Birth Date') === true, 'Recognizes "Birth Date" as PascalCase header');
assert(isPascalCaseLabel('Weight(kg)') === true, 'Recognizes "Weight(kg)" as PascalCase header');
assert(isPascalCaseLabel('Weight (kg)') === true, 'Recognizes "Weight (kg)" as PascalCase header');
assert(isPascalCaseLabel('Height(m)') === true, 'Recognizes "Height(m)" as PascalCase header');
assert(isPascalCaseLabel('Height (m)') === true, 'Recognizes "Height (m)" as PascalCase header');
assert(isPascalCaseLabel('Address') === true, 'Recognizes "Address" as PascalCase header');
assert(isPascalCaseLabel('License No.') === true, 'Recognizes "License No." as PascalCase header');
assert(isPascalCaseLabel("Driver's License No.") === true, 'Recognizes "Driver\'s License No." as PascalCase header');
assert(isPascalCaseLabel('Expiration Date') === true, 'Recognizes "Expiration Date" as PascalCase header');
assert(isPascalCaseLabel('Agency Code') === true, 'Recognizes "Agency Code" as PascalCase header');
assert(isPascalCaseLabel('Blood Type') === true, 'Recognizes "Blood Type" as PascalCase header');
assert(isPascalCaseLabel('Eyes Color') === true, 'Recognizes "Eyes Color" as PascalCase header');
assert(isPascalCaseLabel('Conditions') === true, 'Recognizes "Conditions" as PascalCase header');
assert(isPascalCaseLabel('DL Codes') === true, 'Recognizes "DL Codes" as PascalCase header');

// Target Values MUST NOT be flagged as headers
assert(isPascalCaseLabel('SUICO, JHONMARK AMACA') === false, 'User name "SUICO, JHONMARK AMACA" is NOT flagged as header');
assert(isPascalCaseLabel('PHL') === false, 'Nationality value "PHL" is NOT flagged as header');
assert(isPascalCaseLabel('M') === false, 'Sex value "M" is NOT flagged as header');
assert(isPascalCaseLabel('2004/02/20') === false, 'DOB value "2004/02/20" is NOT flagged as header');
assert(isPascalCaseLabel('52') === false, 'Weight value "52" is NOT flagged as header');
assert(isPascalCaseLabel('1.71') === false, 'Height value "1.71" is NOT flagged as header');
assert(isPascalCaseLabel('-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110') === false, 'Address value is NOT flagged as header');
assert(isPascalCaseLabel('J07-22-302560') === false, 'License number "J07-22-302560" is NOT flagged as header');

// ============================================================================
// SUITE 2: PascalCase Indication to Target Value Extraction (Philippine Driver's License)
// ============================================================================
console.log('\n--- 2. Testing Indication-to-Target Extraction for Philippine DL ---');

const genuineCardOcrSample = [
  'REPUBLIC OF THE PHILIPPINES',
  'DEPARTMENT OF TRANSPORTATION',
  'LAND TRANSPORTATION OFFICE',
  "DRIVER'S LICENSE",
  'Last Name, First Name, Middle Name',
  'SUICO, JHONMARK AMACA',
  'Nationality Sex Date of Birth Weight(kg) Height(m)',
  'PHL M 2004/02/20 52 1.71',
  'Address',
  '-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110',
  'License No. Expiration Date Agency Code',
  'J07-22-302560 2027/02/20 J07',
  'Blood Type Eyes Color',
  '- BLACK',
  'DL Codes Conditions',
  'A,A1,B,B1,B2 NONE'
].join('\n');

const parsed = parseFieldsByPascalCaseIndications(genuineCardOcrSample);

// 1. Name Indication Extraction
assert(parsed.lastName === 'SUICO', `Header "Last Name" indicates Surname: "SUICO" (got "${parsed.lastName}")`);
assert(parsed.firstName === 'JHONMARK', `Header "First Name" indicates First Name: "JHONMARK" (got "${parsed.firstName}")`);
assert(parsed.middleName === 'AMACA', `Header "Middle Name" indicates Middle Name: "AMACA" (got "${parsed.middleName}")`);
assert(parsed.fullName === 'SUICO, JHONMARK AMACA', `Full name is preserved as "SUICO, JHONMARK AMACA" (got "${parsed.fullName}")`);

// 2. Nationality Indication Extraction
assert(parsed.nationality === 'PHL', `Header "Nationality" indicates Acronym: "PHL" (got "${parsed.nationality}")`);

// 3. Sex Indication Extraction
assert(parsed.sex === 'MALE', `Header "Sex" indicates "M" -> "MALE" (got "${parsed.sex}")`);

// 4. Date of Birth Indication Extraction
assert(parsed.birthDate === '2004/02/20', `Header "Date of Birth" indicates "2004/02/20" (got "${parsed.birthDate}")`);

// 5. Weight Indication Extraction
assert(parsed.weight === '52', `Header "Weight(kg)" indicates 2-digit integer: "52" (got "${parsed.weight}")`);

// 6. Height Indication Extraction
assert(parsed.height === '1.71', `Header "Height(m)" indicates decimal: "1.71" (got "${parsed.height}")`);

// 7. Address Indication Extraction
assert(
  parsed.address === '-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110',
  `Header "Address" indicates full normalized address (got "${parsed.address}")`
);

// 8. License Number Indication Extraction
assert(parsed.idNumber === 'J07-22-302560', `Header "License No." indicates "J07-22-302560" (got "${parsed.idNumber}")`);

// 9. Optional Indicators
assert(parsed.expirationDate === '2027/02/20', `Header "Expiration Date" indicates "2027/02/20" (got "${parsed.expirationDate}")`);
assert(parsed.agencyCode === 'J07', `Header "Agency Code" indicates "J07" (got "${parsed.agencyCode}")`);
assert(parsed.bloodType === '-', `Header "Blood Type" indicates "-" (got "${parsed.bloodType}")`);
assert(parsed.eyesColor === 'BLACK', `Header "Eyes Color" indicates "BLACK" (got "${parsed.eyesColor}")`);
assert(parsed.dlCodes === 'A,A1,B,B1,B2', `Header "DL Codes" indicates "A,A1,B,B1,B2" (got "${parsed.dlCodes}")`);
assert(parsed.conditions === 'NONE', `Header "Conditions" indicates "NONE" (got "${parsed.conditions}")`);

// ============================================================================
// SUITE 3: Dynamic DOB-to-Age Auto-Calculation Verification
// ============================================================================
console.log('\n--- 3. Testing Dynamic DOB-to-Age Auto-Calculation Engine ---');

const computeAgeFromDob = (dob?: string): string | null => {
  if (!dob) return null;
  const clean = dob.trim();
  const m = clean.match(/^(\d{4})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])$/);
  if (m) {
    const birthYear = parseInt(m[1], 10);
    const birthMonth = parseInt(m[2], 10) - 1;
    const birthDay = parseInt(m[3], 10);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthYear;
    if (
      today.getMonth() < birthMonth ||
      (today.getMonth() === birthMonth && today.getDate() < birthDay)
    ) {
      calculatedAge--;
    }
    if (calculatedAge >= 10 && calculatedAge <= 120) {
      return String(calculatedAge);
    }
  }
  return null;
};

// Current year calculation
const today = new Date();
const currentYear = today.getFullYear();
const expectedAge = String(
  today.getMonth() > 1 || (today.getMonth() === 1 && today.getDate() >= 20)
    ? currentYear - 2004
    : currentYear - 2004 - 1
);

const autoAge = computeAgeFromDob(parsed.birthDate);
assert(autoAge === expectedAge, `DOB "2004/02/20" dynamically auto-calculates Age to ${expectedAge} (got "${autoAge}")`);

// Additional Date Boundary Tests
const age1996 = computeAgeFromDob('1996/05/15');
const expected1996 = String(
  today.getMonth() > 4 || (today.getMonth() === 4 && today.getDate() >= 15)
    ? currentYear - 1996
    : currentYear - 1996 - 1
);
assert(age1996 === expected1996, `DOB "1996/05/15" dynamically auto-calculates Age to ${expected1996} (got "${age1996}")`);

const age2000 = computeAgeFromDob('2000-01-01');
const expected2000 = String(currentYear - 2000);
assert(age2000 === expected2000, `DOB "2000-01-01" calculates Age to ${expected2000} (got "${age2000}")`);

assert(computeAgeFromDob('') === null, 'Empty DOB returns null');
assert(computeAgeFromDob('INVALID') === null, 'Malformed DOB returns null');

// ============================================================================
// SUITE 4: Consonant Soup & Optical Noise Suppression (isPlausibleHumanName)
// ============================================================================
console.log('\n--- 4. Testing Consonant Soup & Guilloche Pattern Noise Suppression ---');

const noisyArtifacts = [
  'LRNSCDCDJNLL',
  'MRQZMM',
  '-MMM XO',
  'OFTHI',
  'ZZ3M...',
  'FFNRMNMFR',
  'LMMMMMM.MMMMMG.MMNMMMQ',
  '-MMM',
  'ZZ3M',
  'NMM',
  'N NR NW AW NWN W ZDMWR LZ W R E A',
  'LNMNNTG.MMNMCMMMRGQM',
  'OMNMMBJMMNNZWNMMNSMNWRMMM'
];

for (const noise of noisyArtifacts) {
  const result = isPlausibleHumanName(noise);
  assert(result === false, `Strictly rejects noisy consonant soup: "${noise}" -> isPlausibleHumanName = false`);
}

// Verify that genuine names pass with 100% confidence
const genuineNames = [
  'SUICO, JHONMARK AMACA',
  'SUICO JHONMARK AMACA',
  'JHONMARK AMACA',
  'JUAN DELA CRUZ',
  'MARIA CLARA DE LOS SANTOS',
  'EDUARDO REYES',
  'JOSE RIZAL'
];

for (const name of genuineNames) {
  const result = isPlausibleHumanName(name);
  assert(result === true, `Authenticates genuine human name: "${name}" -> isPlausibleHumanName = true`);
}

// Verify that name parsing separates components correctly
const parsedName = parseNameComponents('SUICO, JHONMARK AMACA');
assert(parsedName.lastName === 'SUICO', `parseNameComponents extracts lastName = "SUICO"`);
assert(parsedName.firstName === 'JHONMARK', `parseNameComponents extracts firstName = "JHONMARK"`);
assert(parsedName.middleName === 'AMACA', `parseNameComponents extracts middleName = "AMACA"`);

// ============================================================================
// SUITE 5: Field Sanitation & Registration Safety Gating
// ============================================================================
console.log('\n--- 5. Testing Registration Safety Gating (No Leaked Headers in User Fields) ---');

// Emulate Registration Form field gating
const simulateFormFieldPopulation = (fields: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  address?: string;
}) => {
  const form: { firstName?: string; middleName?: string; lastName?: string; address?: string } = {};

  if (fields.firstName && isPlausibleHumanName(fields.firstName) && !isPascalCaseLabel(fields.firstName)) {
    form.firstName = fields.firstName;
  }
  if (fields.middleName && isPlausibleHumanName(fields.middleName) && !isPascalCaseLabel(fields.middleName)) {
    form.middleName = fields.middleName;
  }
  if (fields.lastName && isPlausibleHumanName(fields.lastName) && !isPascalCaseLabel(fields.lastName)) {
    form.lastName = fields.lastName;
  }
  if (fields.address && !isPascalCaseLabel(fields.address)) {
    form.address = fields.address;
  }

  return form;
};

// Test with noisy strings leaking into OCR fields
const poisonedFields = {
  firstName: 'LRNSCDCDJNLL',
  middleName: 'MRQZMM',
  lastName: '-MMM XO',
  address: 'Address'
};

const sanitizedForm = simulateFormFieldPopulation(poisonedFields);
assert(sanitizedForm.firstName === undefined, 'Noisy "LRNSCDCDJNLL" does NOT populate firstName');
assert(sanitizedForm.middleName === undefined, 'Noisy "MRQZMM" does NOT populate middleName');
assert(sanitizedForm.lastName === undefined, 'Noisy "-MMM XO" does NOT populate lastName');
assert(sanitizedForm.address === undefined, 'Header "Address" does NOT populate user address field');

// Test with clean extracted fields
const cleanFields = {
  firstName: parsed.firstName,
  middleName: parsed.middleName,
  lastName: parsed.lastName,
  address: parsed.address
};
const validForm = simulateFormFieldPopulation(cleanFields);
assert(validForm.firstName === 'JHONMARK', 'Genuine "JHONMARK" successfully populates firstName');
assert(validForm.middleName === 'AMACA', 'Genuine "AMACA" successfully populates middleName');
assert(validForm.lastName === 'SUICO', 'Genuine "SUICO" successfully populates lastName');
assert(validForm.address === '-, -, POBLACION, MANUKAN, ZAMBOANGA DEL NORTE, 7110', 'Genuine address successfully populates address');

// ============================================================================
// SUITE 6: Spatial ROI Coordinate Calibration (Philippine Driver's License)
// ============================================================================
console.log('\n--- 6. Testing ISO ID-1 Coordinate ROIs for Drivers License ---');

const dlSpec = getIdSpec('drivers');
assert(Boolean(dlSpec), 'Driver\'s License specification is registered');
if (dlSpec) {
  assert(dlSpec.targetDimensions.width === 856, 'Target width is 856 (ISO/IEC 7810 ID-1 standard)');
  assert(dlSpec.targetDimensions.height === 540, 'Target height is 540 (ISO/IEC 7810 ID-1 standard)');

  const nameField = dlSpec.fields.find((f) => f.fieldKey === 'fullName');
  assert(Boolean(nameField), 'fullName ROI is defined');
  assert(nameField!.relativeRoi.y >= 0.28 && nameField!.relativeRoi.y <= 0.35, 'fullName ROI target is calibrated below header banner');

  const dobField = dlSpec.fields.find((f) => f.fieldKey === 'dateOfBirth');
  assert(Boolean(dobField), 'dateOfBirth ROI is defined');
  assert(dobField!.relativeRoi.y >= 0.40 && dobField!.relativeRoi.y <= 0.45, 'dateOfBirth ROI is calibrated in demographic band');

  const addrField = dlSpec.fields.find((f) => f.fieldKey === 'address');
  assert(Boolean(addrField), 'address ROI is defined');
  assert(addrField!.relativeRoi.y >= 0.50 && addrField!.relativeRoi.y <= 0.55, 'address ROI is calibrated below demographics');

  const licField = dlSpec.fields.find((f) => f.fieldKey === 'licenseNumber');
  assert(Boolean(licField), 'licenseNumber ROI is defined');
  assert(licField!.relativeRoi.y >= 0.64 && licField!.relativeRoi.y <= 0.70, 'licenseNumber ROI is calibrated in credential band');
}

// ============================================================================
// SUITE 7: End-to-End License Number Normalization & Validation
// ============================================================================
console.log('\n--- 7. Testing Driver\'s License Number Normalization & Format Validation ---');

const validLicRes = validateIdNumber('drivers', 'J07-22-302560');
assert(validLicRes.isValid === true, 'Validates canonical license "J07-22-302560"');
assert(validLicRes.normalized === 'J07-22-302560', 'Normalized canonical license is "J07-22-302560"');

// OCR distortion repairs
const distortedLic1 = validateIdNumber('drivers', '3O7-22-302560'); // 3 -> J, O -> 0
assert(distortedLic1.isValid === true, 'Repairs OCR distortion "3O7-22-302560" -> isValid');
assert(distortedLic1.normalized === 'J07-22-302560', 'Repairs "3O7-22-302560" to "J07-22-302560"');

const distortedLic2 = validateIdNumber('drivers', 'License No. J07-22-302560'); // Leading label noise
assert(distortedLic2.isValid === true, 'Strips leading "License No." label noise');
assert(distortedLic2.normalized === 'J07-22-302560', 'Normalized value is "J07-22-302560"');

console.log('\n============================================================');
console.log(`ALL TESTS PASSED: ${passedCount}/${totalCount} (100% ACCURACY)`);
console.log('============================================================\n');
