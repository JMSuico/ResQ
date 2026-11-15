// [Layer: Testing/Frontend/Fixtures]
// Responsibility: Local Anthropic Messages (/v1/messages) HTTP wire server for deterministic end-to-end tests of the real C# Backend, PostgreSQL/SQL Server token persistence, and Playwright 5-Phase UI without hardcoded test bypasses in production code.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, 100% Universal Arrow Lambda syntax (=>).

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import {
  createBlankWhiteIdPngBuffer,
  createElenaMarquezDriversLicensePngBuffer
} from './syntheticIdFixtures';

export interface AnthropicWireServerHandle {
  readonly baseUrl: string;
  readonly messagesEndpoint: string;
  readonly getRequestCount: () => number;
  readonly close: () => Promise<void>;
}

interface ImageContentSource {
  readonly type?: string;
  readonly media_type?: string;
  readonly data?: string;
}

interface MessageContentBlock {
  readonly type?: string;
  readonly text?: string;
  readonly source?: ImageContentSource;
  readonly cache_control?: {
    readonly type?: string;
  };
}

interface AnthropicMessageItem {
  readonly role?: string;
  readonly content?: string | readonly MessageContentBlock[];
}

interface AnthropicRequestBody {
  readonly model?: string;
  readonly max_tokens?: number;
  readonly temperature?: number;
  readonly system?: string | readonly MessageContentBlock[];
  readonly messages?: readonly AnthropicMessageItem[];
}

interface DecodedImageBlock {
  readonly mediaType: string;
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly assetKind: KnownAssetKind;
}

type KnownAssetKind =
  | 'ELENA_DRIVERS_FRONT'
  | 'ELENA_DRIVERS_BACK'
  | 'ELENA_SYNTHETIC_FRONT'
  | 'MARCO_DRIVERS_FRONT'
  | 'ELENA_PHILSYS_FRONT'
  | 'ELENA_PHILSYS_BACK'
  | 'ELENA_SPECIMEN_FRONT'
  | 'BLANK_OR_UNREADABLE'
  | 'UNKNOWN_CUSTOM_IMAGE';

const resolveAssetsDir = (): string => {
  const candidates: string[] = [
    ...(typeof __dirname === 'string' ? [join(__dirname, 'assets')] : []),
    join(process.cwd(), 'Testing', 'Frontend', 'fixtures', 'assets'),
    join(process.cwd(), 'fixtures', 'assets'),
    join(process.cwd(), 'assets')
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return join(process.cwd(), 'Testing', 'Frontend', 'fixtures', 'assets');
};

const ASSETS_DIR = resolveAssetsDir();

const sha256Hex = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex').toLowerCase();

const isFlatOrBlankPng = (bytes: Buffer): boolean => {
  if (bytes.length < 33) {
    return true;
  }
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(pngSig)) {
    return false;
  }

  try {
    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 6;
    const idatChunks: Buffer[] = [];

    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const chunkType = bytes.subarray(offset + 4, offset + 8).toString('ascii');
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd + 4 > bytes.length) {
        break;
      }
      if (chunkType === 'IHDR' && length >= 13) {
        width = bytes.readUInt32BE(dataStart);
        height = bytes.readUInt32BE(dataStart + 4);
        colorType = bytes.readUInt8(dataStart + 9);
      } else if (chunkType === 'IDAT') {
        idatChunks.push(bytes.subarray(dataStart, dataEnd));
      } else if (chunkType === 'IEND') {
        break;
      }
      offset = dataEnd + 4;
    }

    if (width <= 0 || height <= 0 || idatChunks.length === 0) {
      return true;
    }

    const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
    if (bpp === 0) {
      return false;
    }

    const inflated = inflateSync(Buffer.concat(idatChunks));
    const stride = width * bpp + 1;
    if (inflated.length < stride * Math.min(height, 4)) {
      return false;
    }

    const rowStep = Math.max(1, Math.floor(height / 24));
    const colStep = Math.max(1, Math.floor(width / 24));
    let count = 0;
    let sum = 0;
    let sumSq = 0;

    for (let y = 0; y < height; y += rowStep) {
      const rowOffset = y * stride;
      if (rowOffset >= inflated.length) {
        break;
      }
      const filterByte = inflated[rowOffset];
      if (filterByte !== 0) {
        // Non-Filter-0 compressed photographic PNG is not a blank uniform sheet.
        return false;
      }
      for (let x = 0; x < width; x += colStep) {
        const pxOffset = rowOffset + 1 + x * bpp;
        if (pxOffset + 2 >= inflated.length) {
          break;
        }
        const lum =
          0.299 * inflated[pxOffset] +
          0.587 * inflated[pxOffset + 1] +
          0.114 * inflated[pxOffset + 2];
        sum += lum;
        sumSq += lum * lum;
        count += 1;
      }
    }

    if (count < 4) {
      return false;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < 2.5;
  } catch {
    return false;
  }
};

const buildAssetHashLookup = (): ReadonlyMap<string, KnownAssetKind> => {
  const map = new Map<string, KnownAssetKind>();
  const registerFile = (fileName: string, kind: KnownAssetKind): void => {
    const fullPath = join(ASSETS_DIR, fileName);
    if (existsSync(fullPath)) {
      map.set(sha256Hex(readFileSync(fullPath)), kind);
    }
  };

  registerFile('elena_drivers_front.png', 'ELENA_DRIVERS_FRONT');
  registerFile('elena_drivers_back.png', 'ELENA_DRIVERS_BACK');
  registerFile('marco_drivers_front.png', 'MARCO_DRIVERS_FRONT');
  registerFile('elena_philsys_front.png', 'ELENA_PHILSYS_FRONT');
  registerFile('elena_philsys_back.png', 'ELENA_PHILSYS_BACK');
  registerFile('elena_specimen_front.png', 'ELENA_SPECIMEN_FRONT');

  map.set(sha256Hex(createElenaMarquezDriversLicensePngBuffer()), 'ELENA_SYNTHETIC_FRONT');
  map.set(sha256Hex(createBlankWhiteIdPngBuffer()), 'BLANK_OR_UNREADABLE');

  return map;
};

const ASSET_HASH_LOOKUP = buildAssetHashLookup();

const classifyImageBytes = (bytes: Buffer): KnownAssetKind => {
  const hash = sha256Hex(bytes);
  const exact = ASSET_HASH_LOOKUP.get(hash);
  if (exact) {
    return exact;
  }
  if (isFlatOrBlankPng(bytes)) {
    return 'BLANK_OR_UNREADABLE';
  }
  return 'UNKNOWN_CUSTOM_IMAGE';
};

const canonicalizeIdCategory = (rawIdType: string): string => {
  const s = rawIdType.trim().toLowerCase();
  if (s === 'dl' || s.includes('driver') || s.includes('lto')) return 'drivers';
  if (s.includes('philsys') || s.includes('national') || s.includes('ephilid')) return 'philsys';
  if (s.includes('passport') || s.includes('dfa')) return 'passport';
  if (s.includes('prc')) return 'prc';
  if (s.includes('umid')) return 'umid';
  if (s.includes('postal')) return 'postal';
  if (s.includes('voter') || s.includes('comelec')) return 'voters';
  return s || 'drivers';
};

const extractSelectedIdHintFromSystem = (systemText: string): string => {
  const hintMatch = systemText.match(/Selected ID Category Hint:\s*"?([^"\r\n]+)"?/i);
  if (hintMatch?.[1]) {
    return canonicalizeIdCategory(hintMatch[1]);
  }
  const lineMatch = systemText.match(/Selected ID Type:\s*"?([^"\r\n]+)"?/i);
  if (lineMatch?.[1]) {
    return canonicalizeIdCategory(lineMatch[1]);
  }
  return 'drivers';
};

const buildVisibleField = (value: string | null, confidence = 0.99): { value: string; confidence: number } | null =>
  value === null ? null : { value, confidence };

const buildElenaDriversVisiblePayload = (): Record<string, unknown> => ({
  isGenuineId: true,
  authenticityVerdict: 'GENUINE_PHYSICAL_ID',
  authenticityReason:
    'Genuine LTO Philippine Driver\'s License card layout with coherent portrait, security guilloche, and clear visible typography.',
  detectedIdType: 'drivers',
  detectedIdLabel: 'Philippine Driver\'s License (LTO)',
  matchesSelectedIdType: true,
  frontSlotDetectedSide: 'FRONT',
  backSlotDetectedSide: 'BACK',
  areSidesIdentical: false,
  confidence: 0.99,
  IdType: 'DRIVERS_LICENSE',
  fields: {
    FullName: buildVisibleField('MARQUEZ, ELENA'),
    FirstName: buildVisibleField('ELENA'),
    MiddleName: null,
    Surname: buildVisibleField('MARQUEZ'),
    Suffix: null,
    DateOfBirth: buildVisibleField('1994-03-11'),
    Age: null,
    ExpirationDate: buildVisibleField('2029-03-11'),
    Sex: buildVisibleField('Female'),
    LicenseNumber: buildVisibleField('K09-88-776655'),
    IdNumber: buildVisibleField('K09-88-776655'),
    Street: null,
    Barangay: buildVisibleField('BARRA', 0.98),
    CityOrMunicipality: buildVisibleField('DIPOLOG CITY'),
    Province: buildVisibleField('ZAMBOANGA DEL NORTE'),
    Address: buildVisibleField('BARRA, DIPOLOG CITY, ZAMBOANGA DEL NORTE'),
    Weight: null,
    Height: null,
    PhoneNumber: null,
    RawText: 'REPUBLIC OF THE PHILIPPINES LAND TRANSPORTATION OFFICE DRIVER\'S LICENSE MARQUEZ, ELENA F 1994/03/11 BARRA, DIPOLOG CITY, ZAMBOANGA DEL NORTE K09-88-776655 2029/03/11'
  }
});

const buildMarcoDriversVisiblePayload = (): Record<string, unknown> => ({
  isGenuineId: true,
  authenticityVerdict: 'GENUINE_PHYSICAL_ID',
  authenticityReason:
    'Genuine LTO Philippine Driver\'s License card layout with coherent portrait, security guilloche, and clear visible typography.',
  detectedIdType: 'drivers',
  detectedIdLabel: 'Philippine Driver\'s License (LTO)',
  matchesSelectedIdType: true,
  frontSlotDetectedSide: 'FRONT',
  backSlotDetectedSide: 'BACK',
  areSidesIdentical: false,
  confidence: 0.99,
  IdType: 'DRIVERS_LICENSE',
  fields: {
    FullName: buildVisibleField('SANTOS, MARCO'),
    FirstName: buildVisibleField('MARCO'),
    MiddleName: null,
    Surname: buildVisibleField('SANTOS'),
    Suffix: null,
    DateOfBirth: buildVisibleField('1989-11-24'),
    Age: null,
    ExpirationDate: buildVisibleField('2030-11-24'),
    Sex: buildVisibleField('Male'),
    LicenseNumber: buildVisibleField('M44-12-908811'),
    IdNumber: buildVisibleField('M44-12-908811'),
    Street: null,
    Barangay: buildVisibleField('POBLACION', 0.98),
    CityOrMunicipality: buildVisibleField('KATIPUNAN'),
    Province: buildVisibleField('ZAMBOANGA DEL NORTE'),
    Address: buildVisibleField('POBLACION, KATIPUNAN, ZAMBOANGA DEL NORTE'),
    Weight: null,
    Height: null,
    PhoneNumber: null,
    RawText: 'REPUBLIC OF THE PHILIPPINES LAND TRANSPORTATION OFFICE DRIVER\'S LICENSE SANTOS, MARCO M 1989/11/24 POBLACION, KATIPUNAN, ZAMBOANGA DEL NORTE M44-12-908811 2030/11/24'
  }
});

const buildElenaPhilsysVisiblePayload = (): Record<string, unknown> => ({
  isGenuineId: true,
  authenticityVerdict: 'GENUINE_PHYSICAL_ID',
  authenticityReason: 'Genuine PhilSys National Identification Card layout with QR reverse.',
  detectedIdType: 'philsys',
  detectedIdLabel: 'PhilSys National ID',
  matchesSelectedIdType: true,
  frontSlotDetectedSide: 'FRONT',
  backSlotDetectedSide: 'BACK',
  areSidesIdentical: false,
  confidence: 0.99,
  IdType: 'PH_NATIONAL_ID',
  fields: {
    FullName: buildVisibleField('MARQUEZ, ELENA'),
    FirstName: buildVisibleField('ELENA'),
    MiddleName: null,
    Surname: buildVisibleField('MARQUEZ'),
    Suffix: null,
    DateOfBirth: buildVisibleField('1994-03-11'),
    Age: null,
    Sex: buildVisibleField('Female'),
    IdNumber: buildVisibleField('4192-8854-7721-3306'),
    Barangay: buildVisibleField('BARRA', 0.98),
    CityOrMunicipality: buildVisibleField('DIPOLOG CITY'),
    Province: buildVisibleField('ZAMBOANGA DEL NORTE'),
    Address: buildVisibleField('BARRA, DIPOLOG CITY, ZAMBOANGA DEL NORTE'),
    Weight: null,
    Height: null,
    PhoneNumber: null,
    RawText: 'REPUBLIC OF THE PHILIPPINES PHILSYS NATIONAL ID MARQUEZ, ELENA 4192-8854-7721-3306'
  }
});

const handleGovIdForensicsRequest = (
  systemText: string,
  images: readonly DecodedImageBlock[]
): Record<string, unknown> => {
  const selectedId = extractSelectedIdHintFromSystem(systemText);
  const front = images[0];
  const back = images[1];

  if (!front || front.assetKind === 'BLANK_OR_UNREADABLE') {
    return {
      isGenuineId: false,
      authenticityVerdict: 'UNREADABLE_OR_BLANK',
      authenticityReason: 'Front ID upload appears blank, white, or lacks legible card details.',
      matchesSelectedIdType: false,
      frontSlotDetectedSide: 'UNKNOWN',
      backSlotDetectedSide: back ? 'BACK' : null,
      areSidesIdentical: false,
      errorCode: 'UNREADABLE_OR_BLANK_IMAGE',
      errorMessage: 'Uploaded Front Government ID image is blank or unreadable. Please upload a crisp photo.'
    };
  }

  if (back && back.sha256 === front.sha256) {
    return {
      isGenuineId: false,
      authenticityVerdict: 'DUPLICATE_FRONT_BACK_IMAGE',
      authenticityReason: 'Front ID and Back ID slots contain identical image data.',
      matchesSelectedIdType: true,
      frontSlotDetectedSide: 'FRONT',
      backSlotDetectedSide: 'FRONT',
      areSidesIdentical: true,
      errorCode: 'DUPLICATE_FRONT_BACK_IMAGE',
      errorMessage:
        'Invalid Government ID: The Back ID upload is identical to your Front ID image. Please upload the actual reverse side of your Government ID card.'
    };
  }

  if (front.assetKind === 'ELENA_DRIVERS_BACK' || front.assetKind === 'ELENA_PHILSYS_BACK') {
    const detectedType = front.assetKind === 'ELENA_PHILSYS_BACK' ? 'philsys' : 'drivers';
    return {
      isGenuineId: true,
      authenticityVerdict: 'WRONG_ID_SIDE',
      authenticityReason: 'Reverse side (barcode/QR and restrictions table) was placed into Front ID slot.',
      detectedIdType: detectedType,
      detectedIdLabel: detectedType === 'philsys' ? 'PhilSys National ID' : 'Philippine Driver\'s License (LTO)',
      matchesSelectedIdType: detectedType === selectedId,
      frontSlotDetectedSide: 'BACK',
      backSlotDetectedSide: back?.assetKind.endsWith('FRONT') ? 'FRONT' : 'BACK',
      areSidesIdentical: false,
      errorCode: 'WRONG_ID_SIDE_FRONT_EXPECTED',
      errorMessage:
        'Invalid Government ID: You uploaded the Back side of your Government ID in the Front ID slot. Please upload the Front side showing your photo and identity details.'
    };
  }

  if (
    back &&
    (back.assetKind === 'ELENA_DRIVERS_FRONT' ||
      back.assetKind === 'MARCO_DRIVERS_FRONT' ||
      back.assetKind === 'ELENA_SYNTHETIC_FRONT' ||
      back.assetKind === 'ELENA_PHILSYS_FRONT')
  ) {
    return {
      isGenuineId: true,
      authenticityVerdict: 'WRONG_ID_SIDE',
      authenticityReason: 'Front portrait data page was uploaded in the Back ID slot.',
      detectedIdType: selectedId,
      detectedIdLabel: selectedId === 'philsys' ? 'PhilSys National ID' : 'Philippine Driver\'s License (LTO)',
      matchesSelectedIdType: true,
      frontSlotDetectedSide: 'FRONT',
      backSlotDetectedSide: 'FRONT',
      areSidesIdentical: false,
      errorCode: 'WRONG_ID_SIDE_BACK_EXPECTED',
      errorMessage:
        'Invalid Government ID: You uploaded the Front side of your Government ID in the Back ID slot. Please upload the Back side of your card.'
    };
  }

  if (back && back.assetKind === 'BLANK_OR_UNREADABLE') {
    return {
      isGenuineId: false,
      authenticityVerdict: 'UNREADABLE_OR_BLANK',
      authenticityReason: 'Back ID upload appears blank or unreadable.',
      matchesSelectedIdType: true,
      frontSlotDetectedSide: 'FRONT',
      backSlotDetectedSide: 'UNKNOWN',
      areSidesIdentical: false,
      errorCode: 'UNREADABLE_OR_BLANK_IMAGE',
      errorMessage: 'Back Government ID image is blank or unreadable. Please upload a clear reverse side photo.'
    };
  }

  if (front.assetKind === 'ELENA_SPECIMEN_FRONT') {
    return {
      isGenuineId: false,
      authenticityVerdict: 'SPECIMEN',
      authenticityReason: 'Visible red SPECIMEN / SAMPLE TEMPLATE - VOID watermark across card surface.',
      detectedIdType: 'drivers',
      detectedIdLabel: 'Philippine Driver\'s License (LTO)',
      matchesSelectedIdType: true,
      frontSlotDetectedSide: 'FRONT',
      backSlotDetectedSide: back ? 'BACK' : null,
      areSidesIdentical: false,
      errorCode: 'FAKE_OR_AI_GENERATED_ID',
      errorMessage:
        'Invalid Government ID: Security validation flagged this upload as a SPECIMEN sample template. Please upload photos of your real physical Government ID.'
    };
  }

  const detectedType =
    front.assetKind === 'ELENA_PHILSYS_FRONT' ? 'philsys' : 'drivers';
  const detectedLabel =
    detectedType === 'philsys' ? 'PhilSys National ID' : 'Philippine Driver\'s License (LTO)';

  if (detectedType !== selectedId) {
    return {
      isGenuineId: true,
      authenticityVerdict: 'GENUINE_PHYSICAL_ID',
      authenticityReason: `Detected ${detectedLabel}, which conflicts with selected ${selectedId} category.`,
      detectedIdType: detectedType,
      detectedIdLabel: detectedLabel,
      matchesSelectedIdType: false,
      frontSlotDetectedSide: 'FRONT',
      backSlotDetectedSide: back ? 'BACK' : null,
      areSidesIdentical: false,
      errorCode: 'WRONG_GOVERNMENT_ID_TYPE',
      errorMessage: `Invalid Government ID: Selected ${selectedId}, but uploaded card is ${detectedLabel}.`
    };
  }

  if (front.assetKind === 'MARCO_DRIVERS_FRONT') {
    return buildMarcoDriversVisiblePayload();
  }
  if (front.assetKind === 'ELENA_PHILSYS_FRONT') {
    return buildElenaPhilsysVisiblePayload();
  }
  return buildElenaDriversVisiblePayload();
};

const handleFaceToGovIdMatchRequest = (
  images: readonly DecodedImageBlock[]
): Record<string, unknown> => {
  const frontId = images[0];
  const liveFrames = images.slice(1);

  if (!frontId || frontId.assetKind === 'BLANK_OR_UNREADABLE' || liveFrames.length === 0) {
    return {
      isLiveHuman: false,
      faceToIdSimilarity: 0.0,
      confidence: 0.95,
      verdict: 'LIVENESS_SPOOF_REJECTED',
      reason: 'Insufficient or blank facial capture frames provided for live 4-pose verification.',
      spoofIndicators: ['Blank or missing live webcam frames']
    };
  }

  if (liveFrames.some((frame: DecodedImageBlock): boolean => frame.assetKind === 'BLANK_OR_UNREADABLE')) {
    return {
      isLiveHuman: false,
      faceToIdSimilarity: 0.0,
      confidence: 0.96,
      verdict: 'LIVENESS_SPOOF_REJECTED',
      reason: 'Live webcam stream appears uniform or covered.',
      spoofIndicators: ['Flat/blank camera frame detected']
    };
  }

  if (frontId.assetKind === 'MARCO_DRIVERS_FRONT') {
    return {
      isLiveHuman: true,
      faceToIdSimilarity: 0.16,
      confidence: 0.97,
      verdict: 'FACE_TO_ID_MISMATCH',
      reason:
        'Live facial scan depicts a different person (female presenter) from the male Government ID portrait (MARCO SANTOS).',
      spoofIndicators: []
    };
  }

  return {
    isLiveHuman: true,
    faceToIdSimilarity: 0.94,
    confidence: 0.97,
    verdict: 'LIVE_FACE_ID_MATCHED',
    reason:
      'Live multi-angle 4-pose facial scan shows authentic motion/blink cues and strongly matches the portrait on the uploaded Government ID.',
    spoofIndicators: []
  };
};

const handleCachedPoseIdentityMatchRequest = (
  images: readonly DecodedImageBlock[]
): Record<string, unknown> => {
  if (
    images.length === 0 ||
    images.some((frame: DecodedImageBlock): boolean => frame.assetKind === 'BLANK_OR_UNREADABLE')
  ) {
    return {
      isLiveHuman: false,
      samePerson: false,
      similarity: 0.0,
      bestMatchingPose: 'UNKNOWN',
      reason: 'Live frame appears blank or covered.'
    };
  }

  return {
    isLiveHuman: true,
    samePerson: true,
    similarity: 0.93,
    confidence: 0.97,
    bestMatchingPose: 'CENTER',
    reason: 'Live webcam frames match the cached 4-pose enrollment gallery.'
  };
};

const handleTacticalDispatchReasoningRequest = (userText: string): string => {
  const unitMatch = userText.match(/unit\s+([A-Z0-9-]+)/i);
  const incidentMatch = userText.match(/Incident\s+#(\d+)/i);
  const unitCode = unitMatch?.[1] ?? 'RESPOND-UNIT-01';
  const incidentId = incidentMatch?.[1] ?? '1';
  return `Dispatched ${unitCode} for Incident #${incidentId} based on highest composite proximity, workload readiness, and unchosen-unit fairness rotation score.`;
};

const extractMessagesParts = (
  body: AnthropicRequestBody
): {
  readonly systemText: string;
  readonly userText: string;
  readonly images: readonly DecodedImageBlock[];
} => {
  const systemTextParts: string[] = [];
  if (typeof body.system === 'string') {
    systemTextParts.push(body.system);
  } else if (Array.isArray(body.system)) {
    for (const block of body.system) {
      if ((block.type === undefined || block.type === 'text') && typeof block.text === 'string') {
        systemTextParts.push(block.text);
      }
    }
  }
  const systemText = systemTextParts.join('\n');
  const textParts: string[] = [];
  const images: DecodedImageBlock[] = [];

  for (const msg of body.messages ?? []) {
    if (typeof msg.content === 'string') {
      textParts.push(msg.content);
      continue;
    }
    if (!Array.isArray(msg.content)) {
      continue;
    }
    for (const block of msg.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textParts.push(block.text);
      } else if (block.type === 'image' && typeof block.source?.data === 'string') {
        const bytes = Buffer.from(block.source.data, 'base64');
        images.push({
          mediaType: block.source.media_type ?? 'image/png',
          bytes,
          sha256: sha256Hex(bytes),
          assetKind: classifyImageBytes(bytes)
        });
      }
    }
  }

  return {
    systemText,
    userText: textParts.join('\n'),
    images
  };
};

const buildClaudeMessageEnvelope = (model: string, textContent: string): string =>
  JSON.stringify({
    id: `msg_wire_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text: textContent }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 480,
      output_tokens: 240
    }
  });

const readJsonBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const writeJsonResponse = (res: ServerResponse, statusCode: number, bodyJson: string): void => {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(bodyJson, 'utf8')
  });
  res.end(bodyJson);
};

export const startAnthropicTestWireServer = async (): Promise<AnthropicWireServerHandle> => {
  let requestCount = 0;

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const reqUrl = req.url ?? '/';
    if (req.method !== 'POST' || !reqUrl.endsWith('/v1/messages')) {
      writeJsonResponse(
        res,
        404,
        JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'Route not found' } })
      );
      return;
    }

    const apiKey = req.headers['x-api-key'];
    const version = req.headers['anthropic-version'];
    if (typeof apiKey !== 'string' || apiKey.trim().length < 10 || typeof version !== 'string') {
      writeJsonResponse(
        res,
        401,
        JSON.stringify({
          type: 'error',
          error: { type: 'authentication_error', message: 'Missing x-api-key or anthropic-version header.' }
        })
      );
      return;
    }

    requestCount += 1;
    let body: AnthropicRequestBody;
    try {
      const raw = await readJsonBody(req);
      body = JSON.parse(raw) as AnthropicRequestBody;
    } catch {
      writeJsonResponse(
        res,
        400,
        JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Malformed JSON body.' } })
      );
      return;
    }

    const model = typeof body.model === 'string' && body.model.trim().length > 0
      ? body.model.trim()
      : 'claude-sonnet-4-6';

    const { systemText, userText, images } = extractMessagesParts(body);
    const combinedPrompt = `${systemText}\n${userText}`;

    let responseText = '';
    if (
      combinedPrompt.includes('cached enrollment pose gallery') ||
      combinedPrompt.includes('BIOMETRIC_GALLERY_MATCH')
    ) {
      responseText = JSON.stringify(handleCachedPoseIdentityMatchRequest(images));
    } else if (
      combinedPrompt.includes('portrait photo on the Front Government ID') ||
      combinedPrompt.includes('faceToIdSimilarity') ||
      combinedPrompt.includes('Evaluate human liveness')
    ) {
      responseText = JSON.stringify(handleFaceToGovIdMatchRequest(images));
    } else if (
      combinedPrompt.includes('Selected ID Category Hint') ||
      combinedPrompt.includes('Front ID slot') ||
      combinedPrompt.includes('transcribe ONLY text literally visible')
    ) {
      responseText = JSON.stringify(handleGovIdForensicsRequest(systemText, images));
    } else if (
      combinedPrompt.includes('FairnessRotationScore') ||
      combinedPrompt.includes('auto-selected for Incident')
    ) {
      responseText = handleTacticalDispatchReasoningRequest(userText);
    } else {
      responseText = JSON.stringify({
        isValidGeometry: true,
        livenessConfidence: 0.95,
        ovalAlignment: 0.94,
        geometryVerdict: 'CLAUDE_GEOMETRIC_VERIFIED'
      });
    }

    writeJsonResponse(res, 200, buildClaudeMessageEnvelope(model, responseText));
  });

  await new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', (): void => resolve());
  });

  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    messagesEndpoint: `${baseUrl}/v1/messages`,
    getRequestCount: (): number => requestCount,
    close: (): Promise<void> =>
      new Promise<void>((resolve: () => void, reject: (err?: Error) => void): void => {
        server.close((err?: Error): void => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      })
  };
};
