// [Test: verify_dynamic_anchor_parser.ts]
// Responsibility: Verifies pure dynamic anchor extraction for Philippine Driver's Licenses.
// Guarantees zero hardcoded names, and verifies parsing of real-world compound Filipino names,
// license number formatting, address normalization, and physical demographics.

import { parseDynamicIdAnchors } from '../dynamicAnchorParser';

const runTests = () => {
  console.log('--- TEST 1: User Uploaded Evidence Card (SALIWAN, ART LEVIN TORILLA) ---');
  const cardText1 = `
REPUBLIC OF THE PHILIPPINES
DEPARTMENT OF TRANSPORTATION
LAND TRANSPORTATION OFFICE
DRIVER'S LICENSE
Last Name, First Name, Middle Name
SALIWAN, ART LEVIN TORILLA
Nationality Sex Date of Birth Weight (kg) Height(m)
PHL M 2004/08/27 84 1.70
Address
PUROK 2, LANGATIAN, PRES. MANUEL A. ROXAS, ZAMBOANGA DEL NORTE, 7102
License No. Expiration Date Agency Code
J01-24-005544 2029/08/27 J01
Blood Type Eyes Color Conditions
A+ BLACK NONE
`;

  const res1 = parseDynamicIdAnchors(cardText1);
  console.log('Result 1:', JSON.stringify(res1, null, 2));

  if (res1.lastName !== 'SALIWAN') throw new Error(`Expected lastName 'SALIWAN', got '${res1.lastName}'`);
  if (res1.firstName !== 'ART LEVIN') throw new Error(`Expected firstName 'ART LEVIN', got '${res1.firstName}'`);
  if (res1.middleName !== 'TORILLA') throw new Error(`Expected middleName 'TORILLA', got '${res1.middleName}'`);
  if (res1.fullName !== 'SALIWAN, ART LEVIN TORILLA') throw new Error(`Expected fullName 'SALIWAN, ART LEVIN TORILLA', got '${res1.fullName}'`);
  if (res1.licenseNumber !== 'J01-24-005544') throw new Error(`Expected licenseNumber 'J01-24-005544', got '${res1.licenseNumber}'`);
  if (res1.dateOfBirth !== '2004/08/27') throw new Error(`Expected dateOfBirth '2004/08/27', got '${res1.dateOfBirth}'`);
  if (res1.sex !== 'MALE') throw new Error(`Expected sex 'MALE', got '${res1.sex}'`);
  if (res1.nationality !== 'PHL') throw new Error(`Expected nationality 'PHL', got '${res1.nationality}'`);
  if (res1.weight !== '84') throw new Error(`Expected weight '84', got '${res1.weight}'`);
  if (res1.height !== '1.70') throw new Error(`Expected height '1.70', got '${res1.height}'`);
  if (!res1.address?.includes('LANGATIAN') || !res1.address?.includes('7102')) {
    throw new Error(`Expected address to contain 'LANGATIAN' and '7102', got '${res1.address}'`);
  }
  if (res1.expirationDate !== '2029/08/27') throw new Error(`Expected expirationDate '2029/08/27', got '${res1.expirationDate}'`);
  console.log('[PASS] Test 1: User card successfully parsed with zero hardcoding.');

  console.log('\n--- TEST 2: Second Completely Different Citizen (DELA CRUZ, JUAN MIGUEL SANTOS) ---');
  const cardText2 = `
REPUBLIC OF THE PHILIPPINES
DEPARTMENT OF TRANSPORTATION
LAND TRANSPORTATION OFFICE
DRIVER'S LICENSE
Last Name, First Name, Middle Name
DELA CRUZ, JUAN MIGUEL SANTOS
Nationality Sex Date of Birth Weight (kg) Height(m)
PHL M 1998/12/15 68 1.75
Address
PUROK MABUHAY, BARANGAY SAN JOSE, DIPOLOG CITY, ZAMBOANGA DEL NORTE, 7100
License No. Expiration Date Agency Code
N02-21-987654 2031/12/15 N02
Blood Type Eyes Color Conditions
O+ BROWN NONE
`;

  const res2 = parseDynamicIdAnchors(cardText2);
  console.log('Result 2:', JSON.stringify(res2, null, 2));

  if (res2.lastName !== 'DELA CRUZ') throw new Error(`Expected lastName 'DELA CRUZ', got '${res2.lastName}'`);
  if (res2.firstName !== 'JUAN MIGUEL') throw new Error(`Expected firstName 'JUAN MIGUEL', got '${res2.firstName}'`);
  if (res2.middleName !== 'SANTOS') throw new Error(`Expected middleName 'SANTOS', got '${res2.middleName}'`);
  if (res2.licenseNumber !== 'N02-21-987654') throw new Error(`Expected licenseNumber 'N02-21-987654', got '${res2.licenseNumber}'`);
  if (res2.dateOfBirth !== '1998/12/15') throw new Error(`Expected dateOfBirth '1998/12/15', got '${res2.dateOfBirth}'`);
  if (res2.weight !== '68') throw new Error(`Expected weight '68', got '${res2.weight}'`);
  if (res2.height !== '1.75') throw new Error(`Expected height '1.75', got '${res2.height}'`);
  if (!res2.address?.includes('DIPOLOG') || !res2.address?.includes('7100')) {
    throw new Error(`Expected address to contain 'DIPOLOG' and '7100', got '${res2.address}'`);
  }
  console.log('[PASS] Test 2: Second citizen card successfully parsed with zero hardcoding.');

  console.log('\n=========================================');
  console.log('ALL DYNAMIC ANCHOR PARSER TESTS PASSED!');
  console.log('=========================================');
};

runTests();
