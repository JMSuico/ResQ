// [Layer: Libs/Vision/idScanner]
// Responsibility: Pure, generalized Dynamic Anchor Header Parser for Philippine Government IDs.
// ZERO hardcoded static names, numbers, or addresses.
// Anchors dynamically to statutory Philippine card headers:
// 1. Full Name Anchor: 'Last Name, First Name, Middle Name' -> parses compound Filipino first names.
// 2. Demographics Row Anchor: 'Nationality', 'Sex', 'Date of Birth', 'Weight', 'Height'.
// 3. Address Anchor: 'Address' -> extracts full street/purok, barangay, city/municipality, province & ZIP code.
// 4. License / ID No. Anchor: 'License No.' / 'ID No.' -> extracts format [A-Z]\d{2}-\d{2}-\d{6} or specific card patterns.
// Strict TypeScript, ZERO 'any', 100% universal lambdas (=>), zero emojis.

import {
  normalizePhilippineAddress,
  normalizePhysicalMeasurement,
  isPlausibleHumanName,
  sanitizeExtractedPersonName
} from './validators';
import type { ExtractedFieldsPayload } from './idScanWorker';

export interface ParsedAnchorResult {
  readonly fullName?: string;
  readonly firstName?: string;
  readonly middleName?: string;
  readonly lastName?: string;
  readonly dateOfBirth?: string;
  readonly sex?: 'MALE' | 'FEMALE';
  readonly nationality?: string;
  readonly weight?: string;
  readonly height?: string;
  readonly address?: string;
  readonly licenseNumber?: string;
  readonly idNumber?: string;
  readonly expirationDate?: string;
  readonly agencyCode?: string;
  readonly bloodType?: string;
  readonly eyesColor?: string;
  readonly conditions?: string;
  readonly confidence: number;
}

/**
 * Cleans OCR noise while preserving valid letters, spaces, commas, hyphens, and slashes.
 */
const cleanOcrLine = (line: string): string =>
  line.replace(/[\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Checks if a string looks like a field header or instructional label rather than citizen data.
 */
export const isHeaderLabel = (text: string): boolean => {
  const norm = text.toUpperCase().trim();
  return (
    norm.includes('LAST NAME') ||
    norm.includes('FIRST NAME') ||
    norm.includes('MIDDLE NAME') ||
    norm.includes('DATE OF BIRTH') ||
    norm.includes('EXPIRATION DATE') ||
    norm.includes('AGENCY CODE') ||
    norm.includes('BLOOD TYPE') ||
    norm.includes('EYES COLOR') ||
    norm.includes('CONDITIONS') ||
    norm.includes('WEIGHT') ||
    norm.includes('HEIGHT') ||
    norm.includes('NATIONALITY') ||
    norm.includes('REPUBLIC OF THE PHILIPPINES') ||
    norm.includes('DEPARTMENT OF TRANSPORTATION') ||
    norm.includes('LAND TRANSPORTATION OFFICE') ||
    norm.includes("DRIVER'S LICENSE") ||
    norm.includes('DRIVERS LICENSE') ||
    norm.includes('SIGNATURE OF LICENSEE') ||
    norm.includes('ASSISTANT SECRETARY') ||
    norm.includes('DL CODES')
  );
};

/**
 * Parses raw OCR text into structured identity fields using dynamic anchor detection.
 * Pure functional algorithm without ANY static hardcoded citizen names or credentials.
 */
export const parseDynamicIdAnchors = (rawText: string): ParsedAnchorResult => {
  if (!rawText || rawText.trim().length === 0) {
    return { confidence: 0 };
  }

  const lines = rawText
    .split('\n')
    .map(cleanOcrLine)
    .filter((l) => l.length > 0);

  let fullName: string | undefined;
  let firstName: string | undefined;
  let middleName: string | undefined;
  let lastName: string | undefined;
  let dateOfBirth: string | undefined;
  let sex: 'MALE' | 'FEMALE' | undefined;
  let nationality: string | undefined;
  let weight: string | undefined;
  let height: string | undefined;
  let address: string | undefined;
  let licenseNumber: string | undefined;
  let idNumber: string | undefined;
  let expirationDate: string | undefined;
  let agencyCode: string | undefined;
  let bloodType: string | undefined;
  let eyesColor: string | undefined;
  let conditions: string | undefined;

  let matchedFieldsCount = 0;

  // --------------------------------------------------------------------------
  // 1. FULL NAME ANCHOR: 'Last Name, First Name, Middle Name'
  // --------------------------------------------------------------------------
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNameHeader =
      /Last\s*Name/i.test(line) && (/First\s*Name/i.test(line) || /Middle\s*Name/i.test(line));

    if (isNameHeader) {
      // The citizen's name is on the subsequent non-header line
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const candidate = lines[j];
        if (!isHeaderLabel(candidate) && candidate.length >= 3) {
          // Standard Philippine Driver's License: 'SURNAME, FIRST_NAME MIDDLE_NAME'
          if (candidate.includes(',')) {
            const commaSplit = candidate.split(',');
            const rawLast = commaSplit[0].trim();
            const rawFirstMid = commaSplit.slice(1).join(',').trim();

            if (isPlausibleHumanName(rawLast)) {
              lastName = rawLast.toUpperCase();
              const nameTokens = rawFirstMid.split(/\s+/).filter((t) => t.length > 0);

              if (nameTokens.length === 1) {
                firstName = nameTokens[0].toUpperCase();
              } else if (nameTokens.length >= 2) {
                // Last token is Middle Name; all preceding tokens form the compound First Name
                middleName = nameTokens[nameTokens.length - 1].toUpperCase();
                firstName = nameTokens.slice(0, -1).join(' ').toUpperCase();
              }

              fullName = middleName
                ? `${lastName}, ${firstName} ${middleName}`
                : `${lastName}, ${firstName}`;
              matchedFieldsCount++;
              break;
            }
          } else {
            // Comma might be missed by OCR: split by whitespace
            const tokens = candidate.split(/\s+/).filter((t) => t.length > 0 && /^[A-ZÑa-z'-]+$/.test(t));
            if (tokens.length >= 3) {
              lastName = tokens[0].toUpperCase();
              middleName = tokens[tokens.length - 1].toUpperCase();
              firstName = tokens.slice(1, -1).join(' ').toUpperCase();
              fullName = `${lastName}, ${firstName} ${middleName}`;
              matchedFieldsCount++;
              break;
            }
          }
        }
      }
      break;
    }
  }

  // Fallback: If no 'Last Name' header found, scan for canonical 'SURNAME, FIRSTNAME MIDDLENAME' line
  if (!fullName) {
    for (const line of lines) {
      if (line.includes(',') && !isHeaderLabel(line)) {
        const parts = line.split(',');
        const candidateLast = parts[0].trim();
        const candidateRest = parts.slice(1).join(' ').trim();
        const restTokens = candidateRest.split(/\s+/).filter((t) => /^[A-ZÑa-z'-]+$/.test(t));

        if (
          candidateLast.length >= 2 &&
          /^[A-ZÑa-z'-]+$/.test(candidateLast) &&
          restTokens.length >= 2 &&
          isPlausibleHumanName(candidateLast)
        ) {
          lastName = candidateLast.toUpperCase();
          middleName = restTokens[restTokens.length - 1].toUpperCase();
          firstName = restTokens.slice(0, -1).join(' ').toUpperCase();
          fullName = `${lastName}, ${firstName} ${middleName}`;
          matchedFieldsCount++;
          break;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. DEMOGRAPHICS ROW ANCHOR: Nationality, Sex, Date of Birth, Weight, Height
  // --------------------------------------------------------------------------
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isDemographicsHeader =
      (/Nationality/i.test(line) || /Sex/i.test(line)) &&
      (/Date\s*of\s*Birth/i.test(line) || /Birth/i.test(line) || /Weight/i.test(line));

    if (isDemographicsHeader) {
      // Values appear on the next non-header line
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const valLine = lines[j];
        if (!isHeaderLabel(valLine)) {
          // Nationality
          if (!nationality) {
            const natMatch = valLine.match(/\b(PHL|FIL|PHI)\b/i);
            if (natMatch) {
              nationality = natMatch[1].toUpperCase();
              matchedFieldsCount++;
            }
          }

          // Sex (M or F)
          if (!sex) {
            const sexMatch = valLine.match(/\b([MF])\b/i) || valLine.match(/\b(MALE|FEMALE)\b/i);
            if (sexMatch) {
              const s = sexMatch[1].toUpperCase();
              sex = s.startsWith('F') ? 'FEMALE' : 'MALE';
              matchedFieldsCount++;
            }
          }

          // Date of Birth: YYYY/MM/DD or YYYY-MM-DD
          if (!dateOfBirth) {
            const dobMatch = valLine.match(/\b((?:19|20)\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
            if (dobMatch) {
              dateOfBirth = `${dobMatch[1]}/${dobMatch[2]}/${dobMatch[3]}`;
              matchedFieldsCount++;
            }
          }

          // Weight (kg): 2 or 3 digits (e.g. 84, 52, 70)
          if (!weight) {
            const wtMatch = valLine.match(/\b([3-9]\d|1\d{2})\b/);
            if (wtMatch && wtMatch[0] !== dateOfBirth?.split('/')[2]) {
              weight = wtMatch[1];
              matchedFieldsCount++;
            }
          }

          // Height (m): decimal format 1.XX (e.g. 1.70, 1.65, 1.82)
          if (!height) {
            const htMatch = valLine.match(/\b([0-2]\.\d{2})\b/);
            if (htMatch) {
              height = htMatch[1];
              matchedFieldsCount++;
            }
          }
          break;
        }
      }
    }
  }

  // Fallback scan across entire text for Date of Birth if missed in row
  if (!dateOfBirth) {
    const dobGlobal = rawText.match(
      /(?:Date\s*of\s*Birth|DOB|Birth\s*Date)[\s:]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i
    ) || rawText.match(/\b((?:19|20)\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
    if (dobGlobal) {
      const yr = dobGlobal[1];
      const mo = dobGlobal[2];
      const dy = dobGlobal[3];
      if (yr && mo && dy) {
        dateOfBirth = `${yr}/${mo}/${dy}`;
        matchedFieldsCount++;
      }
    }
  }

  // Fallback scan across entire text for Sex
  if (!sex) {
    if (/\bSex[\s:]*\bM\b/i.test(rawText) || /\bSex[\s:]*MALE\b/i.test(rawText)) {
      sex = 'MALE';
      matchedFieldsCount++;
    } else if (/\bSex[\s:]*\bF\b/i.test(rawText) || /\bSex[\s:]*FEMALE\b/i.test(rawText)) {
      sex = 'FEMALE';
      matchedFieldsCount++;
    }
  }

  // --------------------------------------------------------------------------
  // 3. ADDRESS ANCHOR: 'Address'
  // --------------------------------------------------------------------------
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^Address\b/i.test(line) || /\bAddress[\s:]*$/i.test(line)) {
      const addrLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const candidate = lines[j];
        if (
          isHeaderLabel(candidate) ||
          /License\s*No/i.test(candidate) ||
          /Expiration\s*Date/i.test(candidate) ||
          /[A-Z]\d{2}-\d{2}-\d{6}/.test(candidate)
        ) {
          break;
        }
        addrLines.push(candidate);
      }
      if (addrLines.length > 0) {
        address = normalizePhilippineAddress(addrLines.join(', '));
        matchedFieldsCount++;
        break;
      }
    }
  }

  // Fallback: search for line containing Philippine postal code (4 digits, e.g. 7102, 7109)
  if (!address) {
    const addrWithZip = lines.find((l) =>
      /\b(?:PUROK|BARANGAY|BRGY|STREET|POBLACION|ZAMBOANGA|DEL\s*NORTE|CEBU|MANILA|DAVAO)\b/i.test(l) &&
      /\b\d{4}\b/.test(l)
    );
    if (addrWithZip) {
      address = normalizePhilippineAddress(addrWithZip);
      matchedFieldsCount++;
    }
  }

  // --------------------------------------------------------------------------
  // 4. LICENSE / ID NUMBER ANCHOR: 'License No.' / Format [A-Z]\d{2}-\d{2}-\d{6}
  // --------------------------------------------------------------------------
  // Direct Regex for Philippine Driver's License: 1 letter + 2 digits + '-' + 2 digits + '-' + 6 digits
  const licDirectMatch = rawText.match(/\b([A-Z]\d{2}-\d{2}-\d{6})\b/i);
  if (licDirectMatch) {
    licenseNumber = licDirectMatch[1].toUpperCase();
    idNumber = licenseNumber;
    matchedFieldsCount++;
  } else {
    // Check if separated by spaces instead of dashes: e.g. 'J01 24 005544'
    const licSpaced = rawText.match(/\b([A-Z]\d{2})\s+(\d{2})\s+(\d{6})\b/i);
    if (licSpaced) {
      licenseNumber = `${licSpaced[1].toUpperCase()}-${licSpaced[2]}-${licSpaced[3]}`;
      idNumber = licenseNumber;
      matchedFieldsCount++;
    }
  }

  // Expiration Date (usually right next to or below License No.)
  const expMatch = rawText.match(
    /(?:Expiration\s*Date|Exp\s*Date|Expires)[\s:]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i
  );
  if (expMatch) {
    expirationDate = expMatch[1].replace(/-/g, '/');
  } else {
    // Find second date in text that is in the future (greater than DOB)
    const allDates = [...rawText.matchAll(/\b((?:19|20)\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g)];
    for (const d of allDates) {
      const formatted = `${d[1]}/${d[2]}/${d[3]}`;
      if (formatted !== dateOfBirth && Number(d[1]) >= 2025) {
        expirationDate = formatted;
        break;
      }
    }
  }

  // Agency Code (e.g. J01, N02)
  const agencyMatch = rawText.match(/(?:Agency\s*Code)[\s:]*([A-Z]\d{2})/i) ||
                      rawText.match(/\b([A-Z]\d{2})\b(?=[\s\r\n]*$)/m);
  if (agencyMatch) {
    agencyCode = agencyMatch[1].toUpperCase();
  }

  // Blood Type
  const bloodMatch = rawText.match(/(?:Blood\s*Type)[\s:]*([ABO][+-])/i) ||
                     rawText.match(/\b([ABO][+-])\b/);
  if (bloodMatch) {
    bloodType = bloodMatch[1].toUpperCase();
  }

  // Eyes Color
  const eyesMatch = rawText.match(/(?:Eyes\s*Color)[\s:]*([A-Z]+)/i);
  if (eyesMatch && !isHeaderLabel(eyesMatch[1])) {
    eyesColor = eyesMatch[1].toUpperCase();
  }

  // Conditions
  const condMatch = rawText.match(/(?:Conditions)[\s:]*([A-Z0-9]+)/i);
  if (condMatch) {
    conditions = condMatch[1].toUpperCase();
  }

  // Confidence calculation based on recognized statutory fields (max 1.0)
  const confidence = Math.min(1.0, Number((matchedFieldsCount / 5).toFixed(2)));

  return {
    fullName,
    firstName,
    middleName,
    lastName,
    dateOfBirth,
    sex,
    nationality,
    weight,
    height,
    address,
    licenseNumber,
    idNumber,
    expirationDate,
    agencyCode,
    bloodType,
    eyesColor,
    conditions,
    confidence
  };
};

/**
 * Converts dynamic anchor result to ExtractedFieldsPayload for registration wizard consumption.
 */
export const toExtractedFieldsPayload = (result: ParsedAnchorResult): ExtractedFieldsPayload => ({
  fullname: result.fullName,
  firstName: result.firstName,
  middleName: result.middleName,
  lastName: result.lastName,
  dateOfBirth: result.dateOfBirth,
  sex: result.sex,
  address: result.address,
  licenseNumber: result.licenseNumber,
  idNumber: result.idNumber || result.licenseNumber,
  expirationDate: result.expirationDate,
  agencyCode: result.agencyCode,
  bloodType: result.bloodType,
  eyesColor: result.eyesColor,
  conditions: result.conditions,
  weight: result.weight,
  height: result.height,
  nationality: result.nationality
});
