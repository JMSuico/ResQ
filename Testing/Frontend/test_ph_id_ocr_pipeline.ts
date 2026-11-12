// [Layer: Frontend/Tests]
// Responsibility: Comprehensive TDD & Gold-Standard Benchmark Suite for Philippine Government ID Recognition & Template-Aware OCR Pipeline.
// Universal arrow lambdas (=>). Zero any. Zero emojis.

import { validateIdNumber } from '../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/validators';
import { postProcessFieldText } from '../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/textExtractor';
import {
  getAllIdTemplates,
  getSupportedIdFamiliesForDropdown,
} from '../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/idTemplateRegistry';
import {
  runPhilippineIdRecognitionPipeline,
} from '../../Project system ENGINE/Frontend/src/Libs/Vision/idScanner/idRecognitionPipeline';

let totalTests = 0;
let passedTests = 0;

const assert = (condition: boolean, label: string, detail = ''): void => {
  totalTests += 1;
  if (!condition) {
    throw new Error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
  passedTests += 1;
  console.log(`[PASS] ${label}`);
};

const assertEqual = <T>(actual: T, expected: T, label: string): void => {
  assert(
    actual === expected,
    label,
    `expected "${String(expected)}", received "${String(actual)}"`
  );
};

const runAllPipelineTests = (): void => {
  console.log('======================================================================');
  console.log('1. STAGE 1 TDD: LTO DRIVER LICENSE NON-CORRUPTION & VERSION/SIDE TESTS');
  console.log('======================================================================');

  // 1.1 License numbers starting with I or T or ending in 88/80/68 must NOT be rewritten to J...60
  const ltoRegionI = validateIdNumber('drivers', 'I02-19-123488');
  assertEqual(ltoRegionI.normalized, 'I02-19-123488', 'LTO Region I license ending in 88 preserved without J/60 corruption');

  const ltoPrefixT = validateIdNumber('drivers', 'T04-21-654380');
  assertEqual(ltoPrefixT.normalized, 'T04-21-654380', 'LTO license starting with T and ending in 80 preserved');

  const ltoEnding68 = validateIdNumber('drivers', 'N03-18-004568');
  assertEqual(ltoEnding68.normalized, 'N03-18-004568', 'LTO NCR license ending in 68 preserved');

  // 1.2 Birth years 2000, 2006, 2008, 2009 must NOT be rewritten to 2004
  assertEqual(postProcessFieldText('2000/05/14', 'DATE'), '2000/05/14', 'LTO DOB in year 2000 preserved without 2004 override');
  assertEqual(postProcessFieldText('2006/11/03', 'DATE'), '2006/11/03', 'LTO DOB in year 2006 preserved without 2004 override');
  assertEqual(postProcessFieldText('2008/01/22', 'DATE'), '2008/01/22', 'LTO DOB in year 2008 preserved without 2004 override');

  // 1.3 LTO 2021+ New DL-Code Front Recognition & Field Separation
  const ltoNewFrontRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'DEPARTMENT OF TRANSPORTATION',
      'LAND TRANSPORTATION OFFICE',
      "NON-PROFESSIONAL DRIVER'S LICENSE",
      'Last Name, First Name, Middle Name',
      'DELA CRUZ, JUAN SANTOS',
      'Nationality Sex Date of Birth Weight (kg) Height (m)',
      'PHL M 2000/05/14 68 1.71',
      'Address',
      'PUROK 2, POBLACION, KATIPUNAN, ZAMBOANGA DEL NORTE, 7109',
      'License No. Expiration Date Agency Code',
      'I02-19-123488 2031/05/14 J07',
      'Blood Type Eyes Color',
      'O+ BLACK',
      'DL Codes Conditions',
      'A, A1, B, B1, B2 1, 2',
    ].join('\n'),
    expectedSide: 'front',
  });

  assertEqual(ltoNewFrontRes.classification.templateId, 'PH-LTO-DL-2021-NEW-FRONT', 'Classified LTO 2021+ New DL-Code Front');
  assertEqual(ltoNewFrontRes.classification.version, '2021-dl-code-v1', 'Identified LTO 2021-dl-code-v1 version');
  assertEqual(ltoNewFrontRes.classification.side, 'front', 'Identified LTO Front side');
  assertEqual(ltoNewFrontRes.fields['idNumber']?.normalizedValue, 'I02-19-123488', 'LTO Front idNumber extracted without mutation');
  assertEqual(ltoNewFrontRes.fields['dateOfBirth']?.normalizedValue, '2000-05-14', 'LTO Front DOB normalized to ISO YYYY-MM-DD (year 2000 intact)');
  assertEqual(ltoNewFrontRes.fields['height']?.normalizedValue, '1.71 m', 'LTO Front height normalized with meters unit');
  assertEqual(ltoNewFrontRes.fields['weight']?.normalizedValue, '68 kg', 'LTO Front weight normalized with kg unit');
  assertEqual(ltoNewFrontRes.fields['dlCodes']?.normalizedValue, 'A, A1, B, B1, B2', 'LTO Front alphanumeric DL codes separated from conditions');
  assertEqual(ltoNewFrontRes.fields['conditions']?.normalizedValue, '1, 2', 'LTO Front driving conditions extracted separately');
  assertEqual(ltoNewFrontRes.fields['idNumber']?.status, 'ACCEPTED_FOR_PREFILL', 'High-confidence valid LTO license number accepted for prefill');

  // 1.4 LTO Legacy Numeric Restrictions Front
  const ltoOldFrontRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'LAND TRANSPORTATION OFFICE',
      "PROFESSIONAL DRIVER'S LICENSE",
      'Last Name, First Name, Middle Name',
      'REYES, MARCO ANTONIO',
      'Nationality Sex Date of Birth Weight (kg) Height (m)',
      'PHL M 1988/09/12 74 1.75',
      'Address',
      'BARANGAY UNO, KATIPUNAN, ZAMBOANGA DEL NORTE, 7109',
      'License No. Expiration Date Agency Code',
      'N03-18-004568 2027/09/12 N03',
      'Restrictions Conditions',
      '1, 2, 4 NONE',
    ].join('\n'),
    expectedSide: 'front',
  });

  assertEqual(ltoOldFrontRes.classification.templateId, 'PH-LTO-DL-OLD-FRONT', 'Classified LTO Legacy Numeric Restrictions Front');
  assertEqual(ltoOldFrontRes.classification.version, 'legacy-restrictions-v1', 'Identified LTO legacy-restrictions-v1 version');
  assertEqual(ltoOldFrontRes.fields['restrictions']?.normalizedValue, '1, 2, 4', 'Extracted legacy numeric restrictions (1, 2, 4)');
  assertEqual(ltoOldFrontRes.fields['conditions']?.normalizedValue, 'NONE', 'Extracted NONE driving conditions');

  // 1.5 LTO New DL-Code Back & Wrong-Slot Upload Detection
  const ltoNewBackText = [
    'SERIAL NO: SN-998877665',
    'DL CODE VEHICLE CATEGORY',
    'A MOTORCYCLE',
    'B PASSENGER CAR UP TO 5000 KG GVW',
    'CONDITIONS: 1. WEAR CORRECTIVE LENSES',
    'IN CASE OF EMERGENCY NOTIFY: MARIA DELA CRUZ',
    'ORGAN DONOR: NO',
  ].join('\n');

  const ltoNewBackRes = runPhilippineIdRecognitionPipeline({
    rawText: ltoNewBackText,
    expectedSide: 'back',
  });
  assertEqual(ltoNewBackRes.classification.templateId, 'PH-LTO-DL-2021-NEW-BACK', 'Classified LTO 2021+ Back side');
  assertEqual(ltoNewBackRes.classification.side, 'back', 'Detected LTO Back side');
  assertEqual(ltoNewBackRes.fields['cardSerialNumber']?.normalizedValue, 'SN-998877665', 'Extracted LTO back Card Serial Number separately from License No.');
  assert(!ltoNewBackRes.fields['fullName']?.normalizedValue, 'LTO Back does NOT fabricate or overwrite front fullName');

  const ltoWrongSlotRes = runPhilippineIdRecognitionPipeline({
    rawText: ltoNewBackText,
    expectedSide: 'front',
  });
  assert(Boolean(ltoWrongSlotRes.classification.sideMismatchWarning), 'Detected wrong-slot upload when Back image is uploaded into Front slot');
  assertEqual(ltoWrongSlotRes.overallStatus, 'NEEDS_USER_REVIEW', 'Wrong-slot upload triggers NEEDS_USER_REVIEW');

  console.log('\n======================================================================');
  console.log('2. STAGE 2 & 3: WAVE 1 TEMPLATES (PHILSYS, PASSPORT MRZ, UMID/SSS/GSIS, PRC)');
  console.log('======================================================================');

  // 2.1 PhilSys PVC Front, Back, Paper ePhilID, Digital ID & PSN Exclusion
  const philsysFrontRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIKA NG PILIPINAS',
      'PAMBANSANG PAGKAKAKILANLAN',
      'PHILIPPINE IDENTIFICATION CARD',
      'PCN 1234-5678-9012-3456',
      'PSN 9999-8888-7777-6666',
      'Apelyido/Last Name',
      'SANTOS',
      'Mga Pangalan/Given Names',
      'ELENA',
      'Gitnang Apelyido/Middle Name',
      'GARCIA',
      'Petsa ng Kapanganakan/Date of Birth',
      '1996/03/25',
      'Tirahan/Address',
      'PUROK 4, BARANGAY DOS, KATIPUNAN, ZAMBOANGA DEL NORTE, 7109',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(philsysFrontRes.classification.templateId, 'PH-PSA-PHILSYS-PVC-FRONT', 'Classified PhilSys PVC Front');
  assertEqual(philsysFrontRes.fields['idNumber']?.normalizedValue, '1234-5678-9012-3456', 'Extracted 16-digit public PCN and ignored internal PSN');
  assertEqual(philsysFrontRes.privacyCompliance.pcnSeparatedFromPsn, true, 'Verified PhilSys PCN/PSN privacy separation');

  const philsysBackQrRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'PETSA NG PAGKAKALOOB / DATE OF ISSUE: 2023/04/10',
      'KASARIAN / SEX: FEMALE',
      'URI NG DUGO / BLOOD TYPE: B+',
      'KALAGAYANG SIBIL / MARITAL STATUS: SINGLE',
      'LUGAR NG KAPANGANAKAN / PLACE OF BIRTH: DIPOLOG CITY',
      '{"pcn":"1234-5678-9012-3456","psn":"9999-8888-7777-6666","lastName":"SANTOS","firstName":"ELENA","dob":"1996-03-25","sex":"FEMALE"}',
    ].join('\n'),
    expectedSide: 'back',
    previousOppositeSideAnalysis: philsysFrontRes,
  });
  assertEqual(philsysBackQrRes.classification.templateId, 'PH-PSA-PHILSYS-PVC-BACK', 'Classified PhilSys PVC Back');
  assertEqual(philsysBackQrRes.crossSideCheck?.consistent, true, 'Front VIZ and Back QR PCN/Name/DOB cross-check passed');

  const ephilIdPaperRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIKA NG PILIPINAS',
      'PHILIPPINE STATISTICS AUTHORITY',
      'ELECTRONIC PHILIPPINE IDENTIFICATION (ePhilID)',
      'PAMBANSANG PAGKAKAKILANLAN',
      'PCN: 4321-8765-2109-6543',
      'Last Name, First Name, Middle Name',
      'MENDOZA, CARLOS TAN',
      'Date of Birth: 1994/07/19',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(ephilIdPaperRes.classification.templateId, 'PH-PSA-EPHILID-PAPER', 'Classified PhilSys Paper ePhilID');
  assertEqual(ephilIdPaperRes.classification.side, 'document', 'Identified Paper ePhilID as document layout');

  const philsysDigitalRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'DIGITAL NATIONAL ID',
      'NATIONAL-ID.GOV.PH',
      'EGOVPH',
      'PAMBANSANG PAGKAKAKILANLAN',
      'PCN 1122-3344-5566-7788',
      'Last Name, First Name, Middle Name',
      'RAMOS, BIANCA LOPEZ',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(philsysDigitalRes.classification.templateId, 'PH-PSA-NATIONAL-ID-DIGITAL', 'Classified Digital National ID');

  // 2.2 Philippine Passport ICAO 9303 TD3 MRZ Check-Digit Verification & VIZ Cross-Check
  // Let's use a cryptographically valid TD3 MRZ line pair:
  // Passport No: P1234567A (P=25,1,2,3,4,5,6,7,A=10 -> weights 7,3,1:
  // 25*7 + 1*3 + 2*1 + 3*7 + 4*3 + 5*1 + 6*7 + 7*3 + 10*1 = 175+3+2+21+12+5+42+21+10 = 291 -> check digit 1)
  // Birth Date: 950520 (9*7 + 5*3 + 0*1 + 5*7 + 2*3 + 0*1 = 63+15+0+35+6+0 = 119 -> check digit 9)
  // Expiry Date: 300520 (3*7 + 0*3 + 0*1 + 5*7 + 2*3 + 0*1 = 21+0+0+35+6+0 = 62 -> check digit 2)
  // Composite data: "P1234567A1" + "9505209" + "3005202<<<<<<<<<<<<<<0" -> let's compute composite check digit:
  const mrzLine1 = 'P<PHLDELA<CRUZ<<JUAN<SANTOS<<<<<<<<<<<<<<<<<';
  const mrzLine2Prefix = 'P1234567A1PHL9505209M3005202<<<<<<<<<<<<<<0';
  // Compute exact composite check digit for mrzLine2Prefix
  const compStr = mrzLine2Prefix.slice(0, 10) + mrzLine2Prefix.slice(13, 20) + mrzLine2Prefix.slice(21, 43);
  const weights = [7, 3, 1];
  let compSum = 0;
  for (let i = 0; i < compStr.length; i++) {
    const ch = compStr[i];
    const v = ch === '<' ? 0 : ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55;
    compSum += v * weights[i % 3];
  }
  const validMrzLine2 = `${mrzLine2Prefix}${compSum % 10}`;

  const passportValidRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIKA NG PILIPINAS',
      'PASAPORTE / PASSPORT',
      'DEPARTMENT OF FOREIGN AFFAIRS',
      'Passport No. P1234567A',
      'Last Name, First Name, Middle Name',
      'DELA CRUZ, JUAN SANTOS',
      'Date of Birth: 1995/05/20',
      'Sex: M',
      'Expiration Date: 2030/05/20',
      mrzLine1,
      validMrzLine2,
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(passportValidRes.classification.templateId, 'PH-DFA-PASSPORT-TD3-DATAPAGE', 'Classified Philippine ePassport TD3 Data Page');
  assertEqual(passportValidRes.fields['idNumber']?.validation.checkDigitValid, true, 'Verified ICAO 9303 Modulo-10 MRZ check digits');
  assertEqual(passportValidRes.fields['idNumber']?.status, 'ACCEPTED_FOR_PREFILL', 'Passport number cross-checked between VIZ and MRZ');

  // Corrupted MRZ check digit must be flagged as REQUIRES_REVIEW
  const corruptedMrzLine2 = `${mrzLine2Prefix}${(compSum + 5) % 10}`;
  const passportBadMrzRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIKA NG PILIPINAS',
      'PASAPORTE / PASSPORT',
      'DEPARTMENT OF FOREIGN AFFAIRS',
      'Passport No. P1234567A',
      mrzLine1,
      corruptedMrzLine2,
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(passportBadMrzRes.fields['idNumber']?.status, 'REQUIRES_REVIEW', 'Corrupted MRZ check digit downgraded passport field to REQUIRES_REVIEW');

  // 2.3 UMID, SSS, GSIS & PRC (PIC + Digital e-PIC)
  const umidRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'UNIFIED MULTI-PURPOSE ID',
      'CRN-0111-2345678-9',
      'Last Name, First Name, Middle Name',
      'VILLANUEVA, MARCO REYES',
      'Date of Birth: 1991/08/14',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(umidRes.classification.templateId, 'PH-UMID-GENERIC-FRONT', 'Classified UMID Generic Front');
  assertEqual(umidRes.fields['idNumber']?.normalizedValue, '0111-2345678-9', 'Normalized 12-digit UMID CRN');

  const sssRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'SOCIAL SECURITY SYSTEM',
      'SS NUMBER: 34-1234567-8',
      'Last Name, First Name, Middle Name',
      'AQUINO, PAOLO CRUZ',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(sssRes.classification.templateId, 'PH-SSS-ID-FRONT', 'Classified SSS Card separately from generic UMID');
  assertEqual(sssRes.fields['idNumber']?.normalizedValue, '34-1234567-8', 'Validated 10-digit SSS Number');

  const gsisRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'GOVERNMENT SERVICE INSURANCE SYSTEM',
      'GSIS ECARD',
      'BP NO: 2001234567',
      'Last Name, First Name, Middle Name',
      'CASTRO, LORENA DIZON',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(gsisRes.classification.templateId, 'PH-GSIS-ECARD-FRONT', 'Classified GSIS eCard separately from generic UMID');

  const prcPicRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'PROFESSIONAL REGULATION COMMISSION',
      'PROFESSIONAL IDENTIFICATION CARD',
      'Last Name, First Name, Middle Name',
      'SORIANO, GABRIEL LIM',
      'REGISTRATION NO: 0145892',
      'REGISTRATION DATE: 2019/11/18',
      'Expiration Date: 2028/04/12',
      'CIVIL ENGINEER',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(prcPicRes.classification.templateId, 'PH-PRC-PIC-FRONT', 'Classified PRC Physical PIC Front');
  assertEqual(prcPicRes.fields['idNumber']?.normalizedValue, '0145892', 'Extracted 7-digit PRC Registration Number');
  assertEqual(prcPicRes.fields['profession']?.normalizedValue, 'CIVIL ENGINEER', 'Extracted PRC Profession banner');
  assertEqual(prcPicRes.fields['registrationDate']?.normalizedValue, '2019-11-18', 'Extracted PRC Registration Date');

  const prcEpicRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'PROFESSIONAL REGULATION COMMISSION',
      'ELECTRONIC PROFESSIONAL IDENTIFICATION (E-PIC)',
      'LERIS',
      'REGISTRATION NO: 0198765',
      'REGISTERED NURSE',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(prcEpicRes.classification.templateId, 'PH-PRC-EPIC-DIGITAL', 'Classified PRC Digital e-PIC');

  console.log('\n======================================================================');
  console.log('3. STAGE 4: WAVE 2 TEMPLATES & PRIVACY / BIOMETRIC GUARDS');
  console.log('======================================================================');

  // 3.1 PhilHealth Current Card, 2011 I-PhilHealthy, and MDR Document
  const philHealthCardRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'PHILIPPINE HEALTH INSURANCE CORPORATION',
      'PHILHEALTH IDENTIFICATION NUMBER',
      '12-098765432-1',
      'Last Name, First Name, Middle Name',
      'FERNANDEZ, ROSA PEREZ',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(philHealthCardRes.classification.templateId, 'PH-PHILHEALTH-CARD-CURRENT', 'Classified PhilHealth Current Card');
  assertEqual(philHealthCardRes.fields['idNumber']?.normalizedValue, '12-098765432-1', 'Validated 12-digit PhilHealth PIN');

  const philHealth2011Res = runPhilippineIdRecognitionPipeline({
    rawText: [
      'PHILIPPINE HEALTH INSURANCE CORPORATION',
      'I-PHILHEALTHY',
      '19-123456789-0',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(philHealth2011Res.classification.templateId, 'PH-PHILHEALTH-IPHILHEALTHY-2011', 'Classified PhilHealth 2011 I-PhilHealthy Card');

  const philHealthMdrRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'PHILIPPINE HEALTH INSURANCE CORPORATION',
      'MEMBER DATA RECORD (MDR)',
      'PHILHEALTH IDENTIFICATION NUMBER: 15-112233445-6',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(philHealthMdrRes.classification.templateId, 'PH-PHILHEALTH-MDR-DOCUMENT', 'Classified PhilHealth MDR Document separately from card');
  assertEqual(philHealthMdrRes.classification.side, 'document', 'Identified PhilHealth MDR as document');

  // 3.2 Postal ID, OWWA Physical & Digital, COMELEC Card & Voter's Certificate
  const postalRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'PHILIPPINE POSTAL CORPORATION',
      'POSTAL IDENTITY CARD',
      'PRN A12345678901',
      'Last Name, First Name, Middle Name',
      'BAUTISTA, DANTE GOMEZ',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(postalRes.classification.templateId, 'PH-POSTAL-ID-2016-FRONT', 'Classified Postal ID 2016+ Front');
  assertEqual(postalRes.fields['idNumber']?.normalizedValue, 'PRN A12345678901', 'Normalized Postal PRN');

  const owwaPhysicalRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'OVERSEAS WORKERS WELFARE ADMINISTRATION',
      'OWWA OFW E-CARD',
      'ECARD NO: OWWA-2024-889900',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(owwaPhysicalRes.classification.templateId, 'PH-OWWA-ECARD-FRONT', 'Classified OWWA Physical e-Card');

  const owwaDigitalRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'OVERSEAS WORKERS WELFARE ADMINISTRATION',
      'OWWA DIGITAL E-CARD',
      'ECARD NO: OWWA-2025-112233',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(owwaDigitalRes.classification.templateId, 'PH-OWWA-ECARD-DIGITAL', 'Classified OWWA Digital e-Card');

  const comelecCardRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'COMMISSION ON ELECTIONS',
      "VOTER'S IDENTIFICATION CARD",
      'VIN: 7109-0012A-B1988JDC1',
      'PRECINCT NO: 0012A',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(comelecCardRes.classification.templateId, 'PH-COMELEC-VOTERS-ID-CARD', "Classified COMELEC Voter's ID Card");

  const comelecCertRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'COMMISSION ON ELECTIONS',
      "VOTER'S CERTIFICATION",
      'THIS IS TO CERTIFY THAT JUAN DELA CRUZ IS A REGISTERED VOTER',
      'PRECINCT: 0012A',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(comelecCertRes.classification.templateId, 'PH-COMELEC-VOTERS-CERTIFICATE-DOC', "Classified COMELEC Voter's Certificate Document separately");

  // 3.3 Senior Citizen Age Validation (>= 60)
  const seniorValidRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'OFFICE OF THE SENIOR CITIZENS AFFAIRS (OSCA)',
      'SENIOR CITIZENS ID',
      'OSCA ID NO: ZN-KAT-1955-042',
      'Last Name, First Name, Middle Name',
      'ABALOS, ERNESTO RAMOS',
      'Date of Birth: 1955/04/10',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(seniorValidRes.classification.templateId, 'PH-LGU-SENIOR-CITIZEN-ID', 'Classified Senior Citizen ID');
  assertEqual(seniorValidRes.fields['dateOfBirth']?.status, 'ACCEPTED_FOR_PREFILL', 'Senior Citizen born in 1955 (age >= 60) passes semantic validation');

  const seniorUnderageRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'OFFICE OF THE SENIOR CITIZENS AFFAIRS (OSCA)',
      'SENIOR CITIZENS ID',
      'OSCA ID NO: ZN-KAT-1999-042',
      'Date of Birth: 1999/04/10',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(seniorUnderageRes.fields['dateOfBirth']?.status, 'REQUIRES_REVIEW', 'Underage DOB (1999) on Senior Citizen ID flagged as REQUIRES_REVIEW');

  // 3.4 PWD Legacy LGU & Sept 9, 2026 NCDA AO No. 001 Unified PWD ID Privacy & Biometric Guard
  const pwdLegacyRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'PERSONS WITH DISABILITY AFFAIRS OFFICE (PDAO)',
      'PWD ID NO: 09-7206-001-0001234',
      'Last Name, First Name, Middle Name',
      'TORRES, MIGUEL NAVARRO',
      'TYPE OF DISABILITY: ORTHOPEDIC DISABILITY',
    ].join('\n'),
    expectedSide: 'front',
    extractedFields: {
      disabilityType: 'ORTHOPEDIC DISABILITY',
      causeOfDisability: 'CONGENITAL',
    },
  });
  assertEqual(pwdLegacyRes.classification.templateId, 'PH-NCDA-PWD-ID-LEGACY-LGU', 'Classified PWD Legacy LGU ID');
  assertEqual(pwdLegacyRes.privacyCompliance.allowBiometricProfiling, false, 'Enforced allowBiometricProfiling=false on Legacy PWD ID');
  assert(!pwdLegacyRes.fields['disabilityType'], 'Excluded disabilityType from PWD registration prefill');

  const pwd2026Res = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'NATIONAL COUNCIL ON DISABILITY AFFAIRS (NCDA)',
      'UNIFIED PWD ID (AO NO. 001 SERIES OF 2026)',
      'PWD ID NO: 09-7206-002-0005678',
      'Last Name, First Name, Middle Name',
      'SALAZAR, CLARA MENDOZA',
      'Date of Birth: 1992/10/08',
    ].join('\n'),
    expectedSide: 'front',
    extractedFields: {
      disabilityType: 'VISUAL DISABILITY',
      disabilitySeverity: 'MODERATE',
    },
  });
  assertEqual(pwd2026Res.classification.templateId, 'PH-NCDA-PWD-ID-2026-UNIFIED', 'Classified 2026 NCDA AO No. 001 Unified PWD ID');
  assertEqual(pwd2026Res.privacyCompliance.allowBiometricProfiling, false, 'Enforced allowBiometricProfiling=false on 2026 Unified PWD ID');
  assert(!pwd2026Res.fields['disabilityType'] && !pwd2026Res.fields['disabilitySeverity'], 'Excluded sensitive disability details per NCDA AO No. 001');
  assertEqual(pwd2026Res.fields['idNumber']?.normalizedValue, '09-7206-002-0005678', 'Validated 16-digit National PWD ID format');

  // 3.5 Solo Parent, Barangay ID, BFP, PNP
  const soloParentRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'SOLO PARENT IDENTIFICATION CARD',
      'RA 11861 / CSWDO',
      'ID NO: SP-2025-00891',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(soloParentRes.classification.templateId, 'PH-LGU-SOLO-PARENT-ID', 'Classified Solo Parent ID (RA 11861)');

  const barangayRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'REPUBLIC OF THE PHILIPPINES',
      'OFFICE OF THE PUNONG BARANGAY',
      'SANGGUNIANG BARANGAY',
      'BARANGAY IDENTIFICATION CARD',
      'ID NO: BRGY-7109-00412',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(barangayRes.classification.templateId, 'PH-BARANGAY-ID-CARD', 'Classified Barangay Resident ID');

  const bfpRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'DEPARTMENT OF THE INTERIOR AND LOCAL GOVERNMENT',
      'BUREAU OF FIRE PROTECTION',
      'BFP-ZN-2024-089',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(bfpRes.classification.templateId, 'PH-DILG-BFP-ID-FRONT', 'Classified BFP Personnel ID');

  const pnpRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'NATIONAL POLICE COMMISSION',
      'PHILIPPINE NATIONAL POLICE',
      'PNP-ZN-2024-118',
    ].join('\n'),
    expectedSide: 'front',
  });
  assertEqual(pnpRes.classification.templateId, 'PH-DILG-PNP-ID-FRONT', 'Classified PNP Personnel ID');

  console.log('\n======================================================================');
  console.log('4. STAGE 5, 6 & 7: FRONT/BACK MISMATCH, ZERO-CONFIDENCE & UNKNOWN TESTS');
  console.log('======================================================================');

  // 4.1 Front/Back Mismatch Detection (Front is LTO, Back is PhilSys QR of another person)
  const mismatchedBackRes = runPhilippineIdRecognitionPipeline({
    rawText: [
      'PETSA NG PAGKAKALOOB / DATE OF ISSUE: 2023/04/10',
      'KASARIAN / SEX: FEMALE',
      '{"pcn":"9999-1111-2222-3333","lastName":"OTHERPERSON","firstName":"JANE"}',
    ].join('\n'),
    expectedSide: 'back',
    previousOppositeSideAnalysis: ltoNewFrontRes,
  });
  assertEqual(mismatchedBackRes.crossSideCheck?.consistent, false, 'Detected Front/Back document family & ID number mismatch');
  assertEqual(mismatchedBackRes.overallStatus, 'NEEDS_USER_REVIEW', 'Front/Back mismatch forces NEEDS_USER_REVIEW');

  // 4.2 Zero-Confidence Field Gating (Must NEVER be marked ACCEPTED_FOR_PREFILL)
  const zeroConfRes = runPhilippineIdRecognitionPipeline({
    rawText: 'LAND TRANSPORTATION OFFICE\nNON-PROFESSIONAL DRIVER LICENSE',
    expectedSide: 'front',
    extractedFields: {
      idNumber: 'I02-19-123488',
    },
    fieldConfidences: {
      idNumber: 0,
    },
  });
  assertEqual(zeroConfRes.fields['idNumber']?.status, 'NOT_EXTRACTED', 'Zero-confidence field is marked NOT_EXTRACTED, never ACCEPTED_FOR_PREFILL');
  assertEqual(zeroConfRes.fields['fullName']?.status, 'NOT_EXTRACTED', 'Missing field is marked NOT_EXTRACTED with 0 confidence');

  // 4.3 Unknown / Unsupported Document Rejection
  const unknownRes = runPhilippineIdRecognitionPipeline({
    rawText: 'COFFEE SHOP LOYALTY REWARDS CARD\nBUY 9 GET 1 FREE ESPRESSO\nMEMBER SINCE 2025',
    expectedSide: 'front',
  });
  assertEqual(unknownRes.classification.templateId, 'UNKNOWN', 'Unsupported card classified as UNKNOWN (not routed to LTO or PhilSys)');
  assertEqual(unknownRes.classification.categoryKey, 'unknown', 'Unsupported card categoryKey is unknown');
  assertEqual(unknownRes.classification.needsManualTypeSelection, true, 'Unsupported card sets needsManualTypeSelection=true');
  assertEqual(unknownRes.overallStatus, 'UNSUPPORTED_DOCUMENT', 'Unsupported card overallStatus is UNSUPPORTED_DOCUMENT');
  assertEqual(Object.keys(unknownRes.fields).length, 0, 'Unsupported card performs zero forced field prefill');

  // 4.4 Registry Completeness Check
  const allTemplates = getAllIdTemplates();
  assert(allTemplates.length >= 28, `Template registry contains ${allTemplates.length} versioned templates across Wave 1 & Wave 2`);
  const dropdownOptions = getSupportedIdFamiliesForDropdown(true);
  assertEqual(dropdownOptions.length, 17, 'Dropdown exposes all 15 civilian + 2 responder Philippine ID families');

  console.log('\n======================================================================');
  console.log(`ALL ${passedTests}/${totalTests} PHILIPPINE ID OCR PIPELINE TESTS PASSED (100% GREEN)`);
  console.log('======================================================================');
};

runAllPipelineTests();
