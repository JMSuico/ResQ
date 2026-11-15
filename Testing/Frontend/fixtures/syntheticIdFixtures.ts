// [Layer: Testing/Frontend/fixtures]
// Responsibility: Deterministic zero-dependency PNG generator for Elena Marquez visible-only ID and blank white negative ID fixtures.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, and 100% Universal Arrow Lambda syntax (=>).

import { deflateSync } from 'node:zlib';

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;

const FONT_5X7: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['#...#', '#...#', '#...#', '#####', '....#', '....#', '....#'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
  '.': ['.....', '.....', '.....', '.....', '.....', '..#..', '..#..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....']
};

const buildCrc32Table = (): Uint32Array => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
};

const CRC32_TABLE = buildCrc32Table();

const computeCrc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createPngChunk = (chunkType: string, data: Buffer): Buffer => {
  const typeBuf = Buffer.from(chunkType, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(computeCrc32(crcInput), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
};

const encodeRgbaToPng = (width: number, height: number, rgba: Uint8Array): Buffer => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4 + 1;
  const rawScanlines = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    rawScanlines[rowStart] = 0; // filter type None
    const srcOffset = y * width * 4;
    rawScanlines.set(rgba.subarray(srcOffset, srcOffset + width * 4), rowStart + 1);
  }

  const compressed = deflateSync(rawScanlines, { level: 6 });

  return Buffer.concat([
    signature,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', compressed),
    createPngChunk('IEND', Buffer.alloc(0))
  ]);
};

const fillRect = (
  rgba: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number = 255
): void => {
  const xEnd = Math.min(imgWidth, x0 + w);
  const yEnd = Math.min(imgHeight, y0 + h);
  for (let y = Math.max(0, y0); y < yEnd; y++) {
    for (let x = Math.max(0, x0); x < xEnd; x++) {
      const idx = (y * imgWidth + x) * 4;
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }
};

const drawText5x7 = (
  rgba: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  text: string,
  startX: number,
  startY: number,
  scale: number,
  r: number,
  g: number,
  b: number
): void => {
  const upper = text.toUpperCase();
  const charAdvance = (GLYPH_WIDTH + 1) * scale;
  let cursorX = startX;

  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    const glyph = FONT_5X7[ch] ?? FONT_5X7[' '];

    for (let gy = 0; gy < GLYPH_HEIGHT; gy++) {
      const row = glyph[gy];
      for (let gx = 0; gx < GLYPH_WIDTH; gx++) {
        if (row[gx] === '#') {
          fillRect(
            rgba,
            imgWidth,
            imgHeight,
            cursorX + gx * scale,
            startY + gy * scale,
            scale,
            scale,
            r,
            g,
            b,
            255
          );
        }
      }
    }

    cursorX += charAdvance;
  }
};

/**
 * Renders a high-contrast synthetic Philippine Driver's License PNG for ELENA MARQUEZ.
 * Intentionally omits Middle Name, Suffix, Weight, Height, and Phone Number so visible-only
 * OCR assertions verify omitted fields remain empty.
 */
export const createElenaMarquezDriversLicensePngBuffer = (): Buffer => {
  const width = 856;
  const height = 540;
  const rgba = new Uint8Array(width * height * 4);

  // Off-white crisp card background
  fillRect(rgba, width, height, 0, 0, width, height, 248, 250, 252);

  // Outer border
  fillRect(rgba, width, height, 8, 8, width - 16, 4, 15, 23, 42);
  fillRect(rgba, width, height, 8, height - 12, width - 16, 4, 15, 23, 42);
  fillRect(rgba, width, height, 8, 8, 4, height - 16, 15, 23, 42);
  fillRect(rgba, width, height, width - 12, 8, 4, height - 16, 15, 23, 42);

  // Dark navy top header bar
  fillRect(rgba, width, height, 16, 16, width - 32, 78, 15, 35, 75);
  drawText5x7(rgba, width, height, 'REPUBLIC OF THE PHILIPPINES', 40, 30, 2, 255, 255, 255);
  drawText5x7(rgba, width, height, "DRIVER'S LICENSE", 40, 58, 3, 250, 204, 21);

  // Portrait placeholder frame on the left (neutral silhouette, non-PII)
  fillRect(rgba, width, height, 36, 130, 170, 220, 226, 232, 240);
  fillRect(rgba, width, height, 96, 165, 50, 55, 100, 116, 139);
  fillRect(rgba, width, height, 70, 235, 102, 85, 100, 116, 139);

  // Visible-only credential fields (strictly omitting Middle Name, Suffix, Weight, Height, Phone)
  drawText5x7(rgba, width, height, 'LAST NAME, FIRST NAME', 235, 132, 2, 71, 85, 105);
  drawText5x7(rgba, width, height, 'MARQUEZ, ELENA', 235, 158, 3, 10, 15, 28);

  drawText5x7(rgba, width, height, 'DATE OF BIRTH 1994/03/11', 235, 215, 2, 10, 15, 28);
  drawText5x7(rgba, width, height, 'SEX F', 235, 255, 2, 10, 15, 28);
  drawText5x7(rgba, width, height, 'LICENSE NO K09-88-776655', 235, 298, 2, 10, 15, 28);
  drawText5x7(rgba, width, height, 'ADDRESS BARRA, DIPOLOG, ZAMBOANGA DEL NORTE', 235, 345, 2, 10, 15, 28);

  return encodeRgbaToPng(width, height, rgba);
};

/**
 * Generates a solid pure-white PNG (>= 480x300) for testing negative UNREADABLE_OR_BLANK_IMAGE handling.
 */
export const createBlankWhiteIdPngBuffer = (): Buffer => {
  const width = 856;
  const height = 540;
  const rgba = new Uint8Array(width * height * 4);
  rgba.fill(255);
  return encodeRgbaToPng(width, height, rgba);
};

export const createElenaMarquezDriversLicenseDataUrl = (): string =>
  `data:image/png;base64,${createElenaMarquezDriversLicensePngBuffer().toString('base64')}`;

export const createBlankWhiteIdDataUrl = (): string =>
  `data:image/png;base64,${createBlankWhiteIdPngBuffer().toString('base64')}`;
