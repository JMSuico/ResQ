// [Layer: Libs/Vision/idScanner]
// Responsibility: Complete layout definitions, relative bounding box field maps, anchor coordinates,
// and header dictionary rules for all 8 Philippine Government ID categories in TypeScript.
// Architectural Invariants: Strict TypeScript, ZERO 'any', Universal Lambda Expressions (`=>`),
// Normalized relative coordinates [0.0 - 1.0], ICAO Doc 9303 Part 4 & ISO/IEC 7810 ID-1 / ID-3 compliance.

export type GovernmentIdCategory =
  | 'philsys'
  | 'drivers'
  | 'passport'
  | 'prc'
  | 'umid'
  | 'postal'
  | 'fire'
  | 'police';

export interface RelativeRoi {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PixelRoi {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FieldCropSpec {
  fieldKey: string;
  label: string;
  relativeRoi: { x: number; y: number; w: number; h: number };
  expectedCharType: 'ALPHA' | 'NUMERIC' | 'ALPHANUMERIC' | 'DATE' | 'MRZ';
  regexPattern: RegExp;
  required: boolean;
}

export interface GovernmentIdSpec {
  idType: GovernmentIdCategory;
  officialName: string;
  standardForm: 'ID-1' | 'ID-3';
  targetDimensions: { width: number; height: number; aspectRatio: number };
  headerDictionary: string[];
  emblemAnchorRoi?: { x: number; y: number; w: number; h: number };
  photoRoi: { x: number; y: number; w: number; h: number };
  fields: FieldCropSpec[];
  reverseFields?: FieldCropSpec[];
}

export interface HeaderMatchResult {
  type: GovernmentIdCategory;
  confidence: number;
}

// ---------------------------------------------------------------------------
// 1. Philippine Identification System (PhilSys) National ID
// ---------------------------------------------------------------------------
const philsysSpec: GovernmentIdSpec = {
  idType: 'philsys',
  officialName: 'Philippine Identification System (PhilSys) National ID',
  standardForm: 'ID-1',
  targetDimensions: {
    width: 856,
    height: 540,
    aspectRatio: 856 / 540,
  },
  headerDictionary: [
    'REPUBLIKA NG PILIPINAS',
    'PAMBANSANG PAGKAKAKILANLAN',
    'PHILIPPINE IDENTIFICATION SYSTEM',
    'PHILSYS',
    'PHILIPPINE NATIONAL ID',
    'PHILPOST',
    'PCN',
  ],
  emblemAnchorRoi: {
    x: 0.04,
    y: 0.03,
    w: 0.12,
    h: 0.18,
  },
  photoRoi: {
    x: 0.05,
    y: 0.24,
    w: 0.24,
    h: 0.50,
  },
  fields: [
    {
      fieldKey: 'pcn',
      label: 'PhilSys Card Number (PCN)',
      relativeRoi: { x: 0.32, y: 0.18, w: 0.64, h: 0.09 },
      expectedCharType: 'NUMERIC',
      regexPattern: /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/,
      required: true,
    },
    {
      fieldKey: 'lastName',
      label: 'Last Name / Apelyido',
      relativeRoi: { x: 0.32, y: 0.28, w: 0.46, h: 0.09 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.-]+$/i,
      required: true,
    },
    {
      fieldKey: 'givenNames',
      label: 'Given Names / Mga Pangalan',
      relativeRoi: { x: 0.32, y: 0.38, w: 0.46, h: 0.09 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.-]+$/i,
      required: true,
    },
    {
      fieldKey: 'middleName',
      label: 'Middle Name / Gitnang Apelyido',
      relativeRoi: { x: 0.32, y: 0.48, w: 0.46, h: 0.08 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.-]*$/i,
      required: false,
    },
    {
      fieldKey: 'dob',
      label: 'Date of Birth / Petsa ng Kapanganakan',
      relativeRoi: { x: 0.32, y: 0.57, w: 0.28, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|[A-Z]{3,9}\s+\d{1,2},\s*\d{4})$/i,
      required: true,
    },
    {
      fieldKey: 'sex',
      label: 'Sex / Kasarian',
      relativeRoi: { x: 0.62, y: 0.57, w: 0.16, h: 0.08 },
      expectedCharType: 'ALPHA',
      regexPattern: /^(MALE|FEMALE|M|F|LALAKI|BABAE)$/i,
      required: true,
    },
    {
      fieldKey: 'bloodType',
      label: 'Blood Type / Uri ng Dugo',
      relativeRoi: { x: 0.32, y: 0.66, w: 0.16, h: 0.08 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^(A|B|AB|O)[+-]?$/i,
      required: false,
    },
    {
      fieldKey: 'address',
      label: 'Address / Tirahan',
      relativeRoi: { x: 0.32, y: 0.75, w: 0.64, h: 0.20 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
    {
      fieldKey: 'ghostPortrait',
      label: 'Ghost Portrait Window',
      relativeRoi: { x: 0.80, y: 0.40, w: 0.16, h: 0.34 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
  ],
  reverseFields: [
    {
      fieldKey: 'ed25519Qr',
      label: 'Ed25519 Signed QR Code Zone',
      relativeRoi: { x: 0.48, y: 0.16, w: 0.48, h: 0.72 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
    {
      fieldKey: 'maritalStatus',
      label: 'Marital Status / Katayuang Sibil',
      relativeRoi: { x: 0.06, y: 0.20, w: 0.38, h: 0.12 },
      expectedCharType: 'ALPHA',
      regexPattern: /^(SINGLE|MARRIED|WIDOWED|DIVORCED|SEPARATED)$/i,
      required: false,
    },
    {
      fieldKey: 'dateOfIssuance',
      label: 'Date of Issuance / Petsa ng Paglabas',
      relativeRoi: { x: 0.06, y: 0.36, w: 0.38, h: 0.12 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|[A-Z]{3,9}\s+\d{1,2},\s*\d{4})$/i,
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Land Transportation Office (LTO) Driver's License
// ---------------------------------------------------------------------------
const driversSpec: GovernmentIdSpec = {
  idType: 'drivers',
  officialName: "Land Transportation Office Driver's License",
  standardForm: 'ID-1',
  targetDimensions: {
    width: 856,
    height: 540,
    aspectRatio: 856 / 540,
  },
  headerDictionary: [
    'REPUBLIC OF THE PHILIPPINES',
    'DEPARTMENT OF TRANSPORTATION',
    'LAND TRANSPORTATION OFFICE',
    'LTO',
    "DRIVER'S LICENSE",
    'DRIVERS LICENSE',
    'NON-PROFESSIONAL',
    'PROFESSIONAL',
  ],
  emblemAnchorRoi: {
    x: 0.04,
    y: 0.03,
    w: 0.14,
    h: 0.18,
  },
  photoRoi: {
    x: 0.04,
    y: 0.22,
    w: 0.24,
    h: 0.52,
  },
  fields: [
    {
      fieldKey: 'fullName',
      label: 'Full Name (Last, First, Middle)',
      relativeRoi: { x: 0.28, y: 0.24, w: 0.68, h: 0.12 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'nationality',
      label: 'Nationality',
      relativeRoi: { x: 0.28, y: 0.36, w: 0.20, h: 0.08 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-Z]+$/i,
      required: false,
    },
    {
      fieldKey: 'sex',
      label: 'Sex',
      relativeRoi: { x: 0.48, y: 0.36, w: 0.12, h: 0.08 },
      expectedCharType: 'ALPHA',
      regexPattern: /^(M|F|MALE|FEMALE)$/i,
      required: true,
    },
    {
      fieldKey: 'dob',
      label: 'Date of Birth',
      relativeRoi: { x: 0.60, y: 0.36, w: 0.34, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: true,
    },
    {
      fieldKey: 'bloodType',
      label: 'Blood Type',
      relativeRoi: { x: 0.28, y: 0.45, w: 0.14, h: 0.08 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^(A|B|AB|O)[+-]?$/i,
      required: false,
    },
    {
      fieldKey: 'weight',
      label: 'Weight (kg)',
      relativeRoi: { x: 0.42, y: 0.45, w: 0.15, h: 0.08 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^\d{2,3}(\s*kg)?$/i,
      required: false,
    },
    {
      fieldKey: 'height',
      label: 'Height (m)',
      relativeRoi: { x: 0.58, y: 0.45, w: 0.15, h: 0.08 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^\d+(\.\d+)?(\s*m)?$/i,
      required: false,
    },
    {
      fieldKey: 'address',
      label: 'Address',
      relativeRoi: { x: 0.28, y: 0.52, w: 0.68, h: 0.14 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
    {
      fieldKey: 'licenseNumber',
      label: "Driver's License Number",
      relativeRoi: { x: 0.28, y: 0.66, w: 0.40, h: 0.09 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^[A-Z][0-9]{2}-[0-9]{2}-[0-9]{6}$/,
      required: true,
    },
    {
      fieldKey: 'expirationDate',
      label: 'Expiration Date',
      relativeRoi: { x: 0.68, y: 0.66, w: 0.28, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: true,
    },
    {
      fieldKey: 'conditions',
      label: 'Agency Conditions',
      relativeRoi: { x: 0.28, y: 0.75, w: 0.68, h: 0.14 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^[1-5A-E,\sNoneNONE]+$/i,
      required: false,
    },
  ],
  reverseFields: [
    {
      fieldKey: 'pdf417',
      label: 'PDF417 2D Barcode Zone',
      relativeRoi: { x: 0.08, y: 0.52, w: 0.84, h: 0.38 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
    {
      fieldKey: 'emergencyContact',
      label: 'Emergency Contact Information',
      relativeRoi: { x: 0.08, y: 0.15, w: 0.84, h: 0.22 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. Republic of the Philippines Passport (ICAO Doc 9303 Part 4 ID-3)
// ---------------------------------------------------------------------------
const passportSpec: GovernmentIdSpec = {
  idType: 'passport',
  officialName: 'Republic of the Philippines Passport (Pasaporte)',
  standardForm: 'ID-3',
  targetDimensions: {
    width: 1000,
    height: 704,
    aspectRatio: 1000 / 704,
  },
  headerDictionary: [
    'REPUBLIC OF THE PHILIPPINES',
    'REPUBLIKA NG PILIPINAS',
    'PASAPORTE',
    'PASSPORT',
    'DEPARTMENT OF FOREIGN AFFAIRS',
    'KAGAWARAN NG UGNAYANG PANLABAS',
    'DFA',
  ],
  emblemAnchorRoi: {
    x: 0.03,
    y: 0.03,
    w: 0.13,
    h: 0.19,
  },
  photoRoi: {
    x: 0.04,
    y: 0.25,
    w: 0.26,
    h: 0.48,
  },
  fields: [
    {
      fieldKey: 'passportNumber',
      label: 'Passport Number',
      relativeRoi: { x: 0.68, y: 0.08, w: 0.28, h: 0.07 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^[A-Z][0-9]{7}[A-Z]|[A-Z0-9]{9}$/,
      required: true,
    },
    {
      fieldKey: 'surname',
      label: 'Surname',
      relativeRoi: { x: 0.33, y: 0.21, w: 0.62, h: 0.07 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s-]+$/i,
      required: true,
    },
    {
      fieldKey: 'givenNames',
      label: 'Given Names',
      relativeRoi: { x: 0.33, y: 0.29, w: 0.62, h: 0.07 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s-]+$/i,
      required: true,
    },
    {
      fieldKey: 'nationality',
      label: 'Nationality',
      relativeRoi: { x: 0.33, y: 0.37, w: 0.30, h: 0.07 },
      expectedCharType: 'ALPHA',
      regexPattern: /^(PHILIPPINES|PHILIPPINE|PHL)$/i,
      required: true,
    },
    {
      fieldKey: 'dob',
      label: 'Date of Birth',
      relativeRoi: { x: 0.64, y: 0.37, w: 0.32, h: 0.07 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{2}\s+[A-Z]{3}\s+\d{4}|\d{2}[-/]\d{2}[-/]\d{4})$/i,
      required: true,
    },
    {
      fieldKey: 'placeOfBirth',
      label: 'Place of Birth',
      relativeRoi: { x: 0.33, y: 0.45, w: 0.62, h: 0.07 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.,-]+$/i,
      required: false,
    },
    {
      fieldKey: 'sex',
      label: 'Sex',
      relativeRoi: { x: 0.33, y: 0.53, w: 0.15, h: 0.07 },
      expectedCharType: 'ALPHA',
      regexPattern: /^(M|F)$/,
      required: true,
    },
    {
      fieldKey: 'dateOfIssue',
      label: 'Date of Issue',
      relativeRoi: { x: 0.49, y: 0.53, w: 0.23, h: 0.07 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{2}\s+[A-Z]{3}\s+\d{4}|\d{2}[-/]\d{2}[-/]\d{4})$/i,
      required: true,
    },
    {
      fieldKey: 'expiryDate',
      label: 'Date of Expiration',
      relativeRoi: { x: 0.73, y: 0.53, w: 0.23, h: 0.07 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{2}\s+[A-Z]{3}\s+\d{4}|\d{2}[-/]\d{2}[-/]\d{4})$/i,
      required: true,
    },
    {
      fieldKey: 'issuingAuthority',
      label: 'Issuing Authority',
      relativeRoi: { x: 0.33, y: 0.61, w: 0.62, h: 0.07 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^[A-Z0-9\s.,-]+$/i,
      required: false,
    },
    {
      fieldKey: 'mrz',
      label: 'Machine Readable Zone (MRZ 2x44)',
      relativeRoi: { x: 0.03, y: 0.78, w: 0.94, h: 0.20 },
      expectedCharType: 'MRZ',
      regexPattern: /^[A-Z0-9<]{44}(\r?\n)?[A-Z0-9<]{44}$|^[A-Z0-9<]{88}$/,
      required: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. Professional Regulation Commission (PRC) License
// ---------------------------------------------------------------------------
const prcSpec: GovernmentIdSpec = {
  idType: 'prc',
  officialName: 'Professional Regulation Commission Identification Card',
  standardForm: 'ID-1',
  targetDimensions: {
    width: 856,
    height: 540,
    aspectRatio: 856 / 540,
  },
  headerDictionary: [
    'PROFESSIONAL REGULATION COMMISSION',
    'PRC',
    'REPUBLIC OF THE PHILIPPINES',
    'PROFESSIONAL IDENTIFICATION CARD',
    'REGULATION COMMISSION',
    'BOARD',
  ],
  emblemAnchorRoi: {
    x: 0.04,
    y: 0.03,
    w: 0.15,
    h: 0.20,
  },
  photoRoi: {
    x: 0.06,
    y: 0.27,
    w: 0.25,
    h: 0.49,
  },
  fields: [
    {
      fieldKey: 'profession',
      label: 'Profession Title',
      relativeRoi: { x: 0.33, y: 0.23, w: 0.62, h: 0.10 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-Z\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'registrationNumber',
      label: '7-digit Registration Number',
      relativeRoi: { x: 0.33, y: 0.35, w: 0.40, h: 0.09 },
      expectedCharType: 'NUMERIC',
      regexPattern: /^\d{7}$/,
      required: true,
    },
    {
      fieldKey: 'fullName',
      label: 'Full Name',
      relativeRoi: { x: 0.33, y: 0.46, w: 0.62, h: 0.12 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'registrationDate',
      label: 'Registration Date',
      relativeRoi: { x: 0.33, y: 0.60, w: 0.30, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: false,
    },
    {
      fieldKey: 'expirationDate',
      label: 'Expiration Date / Valid Until',
      relativeRoi: { x: 0.65, y: 0.60, w: 0.30, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: true,
    },
  ],
  reverseFields: [
    {
      fieldKey: 'code128',
      label: 'Code 128 Barcode Zone',
      relativeRoi: { x: 0.12, y: 0.64, w: 0.76, h: 0.26 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Unified Multi-Purpose ID (UMID) Card
// ---------------------------------------------------------------------------
const umidSpec: GovernmentIdSpec = {
  idType: 'umid',
  officialName: 'Unified Multi-Purpose Identification Card (UMID)',
  standardForm: 'ID-1',
  targetDimensions: {
    width: 856,
    height: 540,
    aspectRatio: 856 / 540,
  },
  headerDictionary: [
    'UNIFIED MULTI-PURPOSE ID',
    'UMID',
    'REPUBLIC OF THE PHILIPPINES',
    'SOCIAL SECURITY SYSTEM',
    'SSS',
    'GSIS',
    'PHILHEALTH',
    'PAG-IBIG',
  ],
  emblemAnchorRoi: {
    x: 0.40,
    y: 0.03,
    w: 0.20,
    h: 0.18,
  },
  photoRoi: {
    x: 0.71,
    y: 0.22,
    w: 0.24,
    h: 0.49,
  },
  fields: [
    {
      fieldKey: 'contactChip',
      label: 'ISO 7816 Contact Chip',
      relativeRoi: { x: 0.08, y: 0.35, w: 0.16, h: 0.24 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
    {
      fieldKey: 'crn',
      label: 'Common Reference Number (CRN)',
      relativeRoi: { x: 0.08, y: 0.21, w: 0.58, h: 0.10 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^\d{4}-\d{7}-\d$/,
      required: true,
    },
    {
      fieldKey: 'fullName',
      label: 'Full Name (Surname, Given, Middle)',
      relativeRoi: { x: 0.26, y: 0.34, w: 0.43, h: 0.16 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'dob',
      label: 'Date of Birth',
      relativeRoi: { x: 0.26, y: 0.52, w: 0.28, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: true,
    },
    {
      fieldKey: 'sex',
      label: 'Sex',
      relativeRoi: { x: 0.55, y: 0.52, w: 0.14, h: 0.08 },
      expectedCharType: 'ALPHA',
      regexPattern: /^(M|F|MALE|FEMALE)$/i,
      required: true,
    },
    {
      fieldKey: 'address',
      label: 'Address',
      relativeRoi: { x: 0.08, y: 0.65, w: 0.60, h: 0.24 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
  ],
  reverseFields: [
    {
      fieldKey: 'hicoStripe',
      label: 'HiCo Magnetic Stripe Zone',
      relativeRoi: { x: 0.00, y: 0.04, w: 1.00, h: 0.22 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
    {
      fieldKey: 'agencyBarcodes',
      label: 'SSS / GSIS Agency Barcode',
      relativeRoi: { x: 0.10, y: 0.55, w: 0.80, h: 0.35 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. Digital Postal ID (PHLPost)
// ---------------------------------------------------------------------------
const postalSpec: GovernmentIdSpec = {
  idType: 'postal',
  officialName: 'Philippine Postal Corporation (PHLPost) Postal ID',
  standardForm: 'ID-1',
  targetDimensions: {
    width: 856,
    height: 540,
    aspectRatio: 856 / 540,
  },
  headerDictionary: [
    'PHILIPPINE POSTAL CORPORATION',
    'PHLPOST',
    'POSTAL ID',
    'POSTAL IDENTITY CARD',
    'REPUBLIC OF THE PHILIPPINES',
  ],
  emblemAnchorRoi: {
    x: 0.04,
    y: 0.03,
    w: 0.16,
    h: 0.19,
  },
  photoRoi: {
    x: 0.06,
    y: 0.26,
    w: 0.25,
    h: 0.49,
  },
  fields: [
    {
      fieldKey: 'prn',
      label: 'Postal Reference Number (PRN)',
      relativeRoi: { x: 0.33, y: 0.20, w: 0.42, h: 0.09 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^[A-Z0-9]{16}$|^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
      required: true,
    },
    {
      fieldKey: 'fullName',
      label: 'Full Name',
      relativeRoi: { x: 0.33, y: 0.31, w: 0.38, h: 0.14 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'address',
      label: 'Address',
      relativeRoi: { x: 0.33, y: 0.47, w: 0.38, h: 0.20 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
    {
      fieldKey: 'dob',
      label: 'Date of Birth',
      relativeRoi: { x: 0.33, y: 0.69, w: 0.24, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: true,
    },
    {
      fieldKey: 'expiryDate',
      label: 'Valid Until / Expiry Date',
      relativeRoi: { x: 0.33, y: 0.79, w: 0.24, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: true,
    },
    {
      fieldKey: 'primaryQr',
      label: 'Primary QR Code Zone',
      relativeRoi: { x: 0.72, y: 0.44, w: 0.24, h: 0.42 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
  ],
  reverseFields: [
    {
      fieldKey: 'ghostPhoto',
      label: 'Ghost Portrait Watermark',
      relativeRoi: { x: 0.08, y: 0.25, w: 0.25, h: 0.50 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
    {
      fieldKey: 'contactNumber',
      label: 'Emergency Contact / Tel Number',
      relativeRoi: { x: 0.38, y: 0.35, w: 0.54, h: 0.15 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. Bureau of Fire Protection (BFP) Service ID
// ---------------------------------------------------------------------------
const fireSpec: GovernmentIdSpec = {
  idType: 'fire',
  officialName: 'Bureau of Fire Protection (BFP) Service Identification Card',
  standardForm: 'ID-1',
  targetDimensions: {
    width: 856,
    height: 540,
    aspectRatio: 856 / 540,
  },
  headerDictionary: [
    'BUREAU OF FIRE PROTECTION',
    'BFP',
    'DEPARTMENT OF THE INTERIOR AND LOCAL GOVERNMENT',
    'DILG',
    'REPUBLIC OF THE PHILIPPINES',
    'FIRE SERVICE',
  ],
  emblemAnchorRoi: {
    x: 0.04,
    y: 0.03,
    w: 0.16,
    h: 0.22,
  },
  photoRoi: {
    x: 0.06,
    y: 0.27,
    w: 0.26,
    h: 0.50,
  },
  fields: [
    {
      fieldKey: 'badgeNumber',
      label: 'BFP Badge Number',
      relativeRoi: { x: 0.34, y: 0.22, w: 0.60, h: 0.09 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^BFP-[A-Z]{2}-\d{4}-\d{3}$/,
      required: true,
    },
    {
      fieldKey: 'fullName',
      label: 'Officer Full Name',
      relativeRoi: { x: 0.34, y: 0.33, w: 0.60, h: 0.12 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'rank',
      label: 'Rank / Designation',
      relativeRoi: { x: 0.34, y: 0.47, w: 0.60, h: 0.09 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-Z0-9\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'station',
      label: 'Station Assignment',
      relativeRoi: { x: 0.34, y: 0.58, w: 0.60, h: 0.10 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
    {
      fieldKey: 'bloodType',
      label: 'Blood Type',
      relativeRoi: { x: 0.34, y: 0.70, w: 0.24, h: 0.08 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^(A|B|AB|O)[+-]?$/i,
      required: false,
    },
    {
      fieldKey: 'dob',
      label: 'Date of Birth',
      relativeRoi: { x: 0.60, y: 0.70, w: 0.34, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: false,
    },
    {
      fieldKey: 'expirationDate',
      label: 'Valid Until / Expiration Date',
      relativeRoi: { x: 0.34, y: 0.80, w: 0.34, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: false,
    },
  ],
  reverseFields: [
    {
      fieldKey: 'emergencyContact',
      label: 'Emergency Contact Information',
      relativeRoi: { x: 0.10, y: 0.20, w: 0.80, h: 0.20 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
    {
      fieldKey: 'chiefSignature',
      label: 'Chief BFP Signature Zone',
      relativeRoi: { x: 0.25, y: 0.50, w: 0.50, h: 0.20 },
      expectedCharType: 'ALPHA',
      regexPattern: /^.+$/,
      required: false,
    },
    {
      fieldKey: 'barcode',
      label: 'Service Serial Barcode',
      relativeRoi: { x: 0.15, y: 0.75, w: 0.70, h: 0.18 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// 8. Philippine National Police (PNP) Official ID
// ---------------------------------------------------------------------------
const policeSpec: GovernmentIdSpec = {
  idType: 'police',
  officialName: 'Philippine National Police (PNP) Official Identification Card',
  standardForm: 'ID-1',
  targetDimensions: {
    width: 856,
    height: 540,
    aspectRatio: 856 / 540,
  },
  headerDictionary: [
    'PHILIPPINE NATIONAL POLICE',
    'PNP',
    'NATIONAL POLICE COMMISSION',
    'NAPOLCOM',
    'DEPARTMENT OF THE INTERIOR AND LOCAL GOVERNMENT',
    'DILG',
    'REPUBLIC OF THE PHILIPPINES',
  ],
  emblemAnchorRoi: {
    x: 0.04,
    y: 0.03,
    w: 0.16,
    h: 0.22,
  },
  photoRoi: {
    x: 0.06,
    y: 0.27,
    w: 0.26,
    h: 0.50,
  },
  fields: [
    {
      fieldKey: 'badgeNumber',
      label: 'PNP Badge Number',
      relativeRoi: { x: 0.34, y: 0.22, w: 0.60, h: 0.09 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^PNP-[A-Z]{2}-\d{4}-\d{3}$/,
      required: true,
    },
    {
      fieldKey: 'fullName',
      label: 'Officer Full Name',
      relativeRoi: { x: 0.34, y: 0.33, w: 0.60, h: 0.12 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-ZÑ\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'rank',
      label: 'Rank / Designation',
      relativeRoi: { x: 0.34, y: 0.47, w: 0.60, h: 0.09 },
      expectedCharType: 'ALPHA',
      regexPattern: /^[A-Z0-9\s.,-]+$/i,
      required: true,
    },
    {
      fieldKey: 'station',
      label: 'Station / Precinct / Unit',
      relativeRoi: { x: 0.34, y: 0.58, w: 0.60, h: 0.10 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: true,
    },
    {
      fieldKey: 'bloodType',
      label: 'Blood Type',
      relativeRoi: { x: 0.34, y: 0.70, w: 0.24, h: 0.08 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^(A|B|AB|O)[+-]?$/i,
      required: false,
    },
    {
      fieldKey: 'dob',
      label: 'Date of Birth',
      relativeRoi: { x: 0.60, y: 0.70, w: 0.34, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: false,
    },
    {
      fieldKey: 'expirationDate',
      label: 'Valid Until / Expiration Date',
      relativeRoi: { x: 0.34, y: 0.80, w: 0.34, h: 0.08 },
      expectedCharType: 'DATE',
      regexPattern: /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/,
      required: false,
    },
  ],
  reverseFields: [
    {
      fieldKey: 'firearmAuthorization',
      label: 'Firearm Bearing Authorization Stamp',
      relativeRoi: { x: 0.10, y: 0.18, w: 0.80, h: 0.22 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
    {
      fieldKey: 'chiefSignature',
      label: 'Chief PNP Signature Zone',
      relativeRoi: { x: 0.25, y: 0.45, w: 0.50, h: 0.20 },
      expectedCharType: 'ALPHA',
      regexPattern: /^.+$/,
      required: false,
    },
    {
      fieldKey: 'barcode',
      label: 'PNP Serial Barcode / QR',
      relativeRoi: { x: 0.15, y: 0.72, w: 0.70, h: 0.22 },
      expectedCharType: 'ALPHANUMERIC',
      regexPattern: /^.+$/,
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry Mapping & Deterministic Spec Dictionary
// ---------------------------------------------------------------------------
const ID_SPECS_MAP: Readonly<Record<GovernmentIdCategory, GovernmentIdSpec>> = {
  philsys: philsysSpec,
  drivers: driversSpec,
  passport: passportSpec,
  prc: prcSpec,
  umid: umidSpec,
  postal: postalSpec,
  fire: fireSpec,
  police: policeSpec,
};

// ---------------------------------------------------------------------------
// Helper Methods (Universal Lambda Syntax `=>`)
// ---------------------------------------------------------------------------

/**
 * Retrieves the complete layout and ROI spec for a given Government ID category.
 */
export const getIdSpec = (type: GovernmentIdCategory): GovernmentIdSpec => {
  const spec = ID_SPECS_MAP[type];
  if (!spec) {
    throw new Error(`[idSpecs] Unsupported Government ID category: "${type}"`);
  }
  return spec;
};

/**
 * Returns all 8 supported Government ID specifications.
 */
export const getAllIdSpecs = (): GovernmentIdSpec[] => {
  return [
    philsysSpec,
    driversSpec,
    passportSpec,
    prcSpec,
    umidSpec,
    postalSpec,
    fireSpec,
    policeSpec,
  ];
};

/**
 * Identifies the Government ID category from raw OCR header text by analyzing
 * dictionary token matches, canonical phrases, and signature regex characteristics.
 */
export const identifyIdCategoryFromHeader = (
  ocrHeaderText: string
): HeaderMatchResult | null => {
  if (!ocrHeaderText || typeof ocrHeaderText !== 'string') {
    return null;
  }

  const normalized = ocrHeaderText.toUpperCase().replace(/[\r\n\t]+/g, ' ').trim();
  if (normalized.length === 0) {
    return null;
  }

  // Pre-check for signature distinctive patterns that yield immediate high confidence
  if (/P<PHL/i.test(normalized) || /PASAPORTE/i.test(normalized)) {
    return { type: 'passport', confidence: 0.98 };
  }
  if (/BFP-[A-Z]{2,3}-\d{4}-\d{3}/i.test(normalized)) {
    return { type: 'fire', confidence: 0.99 };
  }
  if (/PNP-[A-Z]{2,3}-\d{4}-\d{3}/i.test(normalized)) {
    return { type: 'police', confidence: 0.99 };
  }
  if (/[A-Z][0-9]{2}-[0-9]{2}-[0-9]{6}/i.test(normalized) && /DRIVER/i.test(normalized)) {
    return { type: 'drivers', confidence: 0.97 };
  }
  if (/\d{4}-\d{7}-\d/i.test(normalized) && (/UMID/i.test(normalized) || /SSS/i.test(normalized) || /GSIS/i.test(normalized))) {
    return { type: 'umid', confidence: 0.97 };
  }
  if (/\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}/i.test(normalized) && (/PHILSYS/i.test(normalized) || /PAMBANSANG/i.test(normalized))) {
    return { type: 'philsys', confidence: 0.97 };
  }

  const allSpecs = getAllIdSpecs();
  const categoryScores: { type: GovernmentIdCategory; score: number }[] = [];

  allSpecs.forEach((spec) => {
    let score = 0;
    const dictionary = spec.headerDictionary;

    dictionary.forEach((phrase) => {
      const upperPhrase = phrase.toUpperCase();
      if (normalized.includes(upperPhrase)) {
        // Longer phrase matches carry heavier weight
        const weight = Math.max(1, upperPhrase.split(/\s+/).length);
        score += weight * 2.0;
      }
    });

    // Check specific anchor keywords
    switch (spec.idType) {
      case 'philsys':
        if (/PAMBANSANG|PAGKAKAKILANLAN|PHILSYS|PCN/i.test(normalized)) score += 3.0;
        break;
      case 'drivers':
        if (/LAND\s+TRANSPORTATION|DRIVER'?S?\s+LICENSE|LTO/i.test(normalized)) score += 3.5;
        break;
      case 'passport':
        if (/PASAPORTE|PASSPORT|FOREIGN\s+AFFAIRS|DFA/i.test(normalized)) score += 4.0;
        break;
      case 'prc':
        if (/PROFESSIONAL\s+REGULATION|PRC|REGISTRATION\s+NO/i.test(normalized)) score += 3.5;
        break;
      case 'umid':
        if (/UNIFIED|MULTI-PURPOSE|UMID|CRN/i.test(normalized)) score += 3.5;
        break;
      case 'postal':
        if (/POSTAL\s+ID|PHLPOST|POSTAL\s+IDENTITY/i.test(normalized)) score += 3.5;
        break;
      case 'fire':
        if (/BUREAU\s+OF\s+FIRE|FIRE\s+PROTECTION|BFP/i.test(normalized)) score += 4.0;
        break;
      case 'police':
        if (/PHILIPPINE\s+NATIONAL\s+POLICE|PNP|NAPOLCOM/i.test(normalized)) score += 4.0;
        break;
    }

    if (score > 0) {
      categoryScores.push({ type: spec.idType, score });
    }
  });

  if (categoryScores.length === 0) {
    return null;
  }

  categoryScores.sort((a, b) => b.score - a.score);
  const bestCandidate = categoryScores[0];

  // Maximum realistic score in header dictionary matching is ~12-16
  const normalizedConfidence = Math.min(1.0, Math.max(0.2, bestCandidate.score / 10.0));

  if (normalizedConfidence < 0.25) {
    return null;
  }

  return {
    type: bestCandidate.type,
    confidence: Number(normalizedConfidence.toFixed(2)),
  };
};

/**
 * Validates a field value string against its FieldCropSpec regex pattern and type.
 */
export const validateFieldValue = (
  fieldSpec: FieldCropSpec,
  value: string
): boolean => {
  if (!value || typeof value !== 'string') {
    return !fieldSpec.required;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return !fieldSpec.required;
  }

  return fieldSpec.regexPattern.test(trimmed);
};

/**
 * Denormalizes relative ROI coordinates [0.0 - 1.0] into pixel bounding box coordinates.
 */
export const denormalizeRoi = (
  roi: RelativeRoi,
  containerWidth: number,
  containerHeight: number
): PixelRoi => {
  const safeW = Math.max(1, containerWidth);
  const safeH = Math.max(1, containerHeight);

  const x = Math.round(roi.x * safeW);
  const y = Math.round(roi.y * safeH);
  const width = Math.round(roi.w * safeW);
  const height = Math.round(roi.h * safeH);

  return {
    x: Math.max(0, Math.min(x, safeW - 1)),
    y: Math.max(0, Math.min(y, safeH - 1)),
    width: Math.max(1, Math.min(width, safeW - x)),
    height: Math.max(1, Math.min(height, safeH - y)),
  };
};

/**
 * Normalizes pixel bounding box coordinates into relative ROI coordinates [0.0 - 1.0].
 */
export const normalizeRoi = (
  pixelRoi: PixelRoi,
  containerWidth: number,
  containerHeight: number
): RelativeRoi => {
  const safeW = Math.max(1, containerWidth);
  const safeH = Math.max(1, containerHeight);

  const normX = Number((pixelRoi.x / safeW).toFixed(4));
  const normY = Number((pixelRoi.y / safeH).toFixed(4));
  const normW = Number((pixelRoi.width / safeW).toFixed(4));
  const normH = Number((pixelRoi.height / safeH).toFixed(4));

  return {
    x: Math.max(0, Math.min(1, normX)),
    y: Math.max(0, Math.min(1, normY)),
    w: Math.max(0.001, Math.min(1, normW)),
    h: Math.max(0.001, Math.min(1, normH)),
  };
};

export const NON_TEXT_ROI_KEYS: ReadonlySet<string> = new Set([
  'ghostPortrait',
  'contactChip',
  'primaryQr',
  'barcodeOrQr',
  'signatureBand',
  'coatOfArms',
  'securityHologram',
]);

/**
 * Finds a specific field crop spec by its key within a Government ID category.
 */
export const getFieldSpec = (
  idType: GovernmentIdCategory,
  fieldKey: string,
  isReverse = false
): FieldCropSpec | undefined => {
  const spec = getIdSpec(idType);
  const fieldList = isReverse ? (spec.reverseFields || []) : spec.fields;
  return fieldList.find((f) => f.fieldKey === fieldKey);
};
