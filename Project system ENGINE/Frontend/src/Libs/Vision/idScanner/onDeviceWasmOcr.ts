// [Layer: Libs/Vision/idScanner]
// Responsibility: 100% Client-Side On-Device WebAssembly OCR Engine powered by Tesseract.js.
// Runs entirely inside the browser via Web Workers and WebAssembly.
// Zero cloud fees, zero external server dependencies, zero API keys required, works offline.
// Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>). Zero emojis.

import { createWorker, PSM, type Worker as TesseractWorker } from 'tesseract.js';
import { parseDynamicIdAnchors, toExtractedFieldsPayload } from './dynamicAnchorParser';
import type { ExtractedFieldsPayload } from './idScanWorker';

export interface OnDeviceOcrResult {
  readonly success: boolean;
  readonly rawText: string;
  readonly fields: ExtractedFieldsPayload;
  readonly confidence: number;
  readonly executionTimeMs: number;
  readonly error?: string;
}

let workerInstance: TesseractWorker | null = null;
let initPromise: Promise<TesseractWorker | null> | null = null;

/**
 * Initializes or retrieves the singleton on-device WebAssembly Tesseract OCR worker.
 * Configured with English language model and whitelist-optimized for Government IDs.
 */
export const getOnDeviceOcrWorker = async (): Promise<TesseractWorker | null> => {
  if (workerInstance) return workerInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      console.info('[OnDeviceWasmOCR] Initializing client-side WebAssembly OCR worker with offline local assets...');
      const worker = await createWorker('eng', 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/tesseract-core-simd.wasm.js',
        langPath: '/tesseract',
        gzip: true,
        logger: () => {}
      });

      // Optimize parameters for identity cards (mixed alphanumeric Latin text, uppercase priority)
      await worker.setParameters({
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-,./:;()+%# \n\r',
        tessedit_pageseg_mode: PSM.AUTO // Fully automatic page segmentation for multi-field cards
      });

      workerInstance = worker;
      console.info('[OnDeviceWasmOCR] WebAssembly OCR worker successfully initialized.');
      return workerInstance;
    } catch (err: unknown) {
      console.warn('[OnDeviceWasmOCR] Failed to initialize WebAssembly OCR worker, falling back to heuristics:', err);
      workerInstance = null;
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

/**
 * Executes 100% on-device OCR on an uploaded ID image (data URL, canvas, blob, or ImageData).
 * Extracts raw text and dynamically parses statutory fields using Dynamic Anchor Header Parsing.
 */
export const scanCardWithOnDeviceWasm = async (
  imageSource: string | HTMLCanvasElement | ImageData | Blob
): Promise<OnDeviceOcrResult> => {
  const startTime = performance.now();

  try {
    const worker = await getOnDeviceOcrWorker();
    if (!worker) {
      return {
        success: false,
        rawText: '',
        fields: {},
        confidence: 0,
        executionTimeMs: performance.now() - startTime,
        error: 'WebAssembly OCR worker could not be initialized in this environment.'
      };
    }

    // Convert ImageData to offscreen canvas or base64 data url if needed
    let recognitionInput: string | HTMLCanvasElement | Blob = imageSource as string | HTMLCanvasElement | Blob;
    if (typeof ImageData !== 'undefined' && imageSource instanceof ImageData) {
      const canvas = document.createElement('canvas');
      canvas.width = imageSource.width;
      canvas.height = imageSource.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageSource, 0, 0);
        recognitionInput = canvas;
      }
    }

    const { data } = await worker.recognize(recognitionInput);
    const rawText = data?.text || '';
    const anchorParsed = parseDynamicIdAnchors(rawText);
    const fields = toExtractedFieldsPayload(anchorParsed);

    const hasCoreField = Boolean(
      fields.fullname ||
      fields.lastName ||
      fields.firstName ||
      fields.licenseNumber ||
      fields.idNumber
    );

    const confidence = hasCoreField ? Math.max(0.75, anchorParsed.confidence) : 0.20;

    return {
      success: hasCoreField,
      rawText,
      fields,
      confidence,
      executionTimeMs: Math.round(performance.now() - startTime)
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[OnDeviceWasmOCR] Execution encountered an issue:', errorMsg);
    return {
      success: false,
      rawText: '',
      fields: {},
      confidence: 0,
      executionTimeMs: Math.round(performance.now() - startTime),
      error: errorMsg
    };
  }
};
