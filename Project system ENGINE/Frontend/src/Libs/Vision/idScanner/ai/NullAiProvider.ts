// [Layer: Frontend/Libs/Vision/idScanner/ai]
// Responsibility: Default standby AI provider returning null when external cloud AI keys are omitted or running in purely deterministic mode.
// Invariant: Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>).

import type { AiOcrProvider, IdOcrResult } from './AiOcrProvider';

/**
 * NullAiProvider represents the default standby AI provider.
 * When external AI services (Gemini, Azure, OpenAI) are unconfigured, disabled,
 * or unreachable, this provider safely returns null, allowing the ID scanner
 * pipeline to seamlessly fall back to local deterministic heuristic OCR.
 */
export class NullAiProvider implements AiOcrProvider {
  public readonly name: string = 'null';

  public readonly isConfigured = (): boolean => false;

  public readonly extract = async (
    _imageDataUrl: string,
    _hintType?: string
  ): Promise<IdOcrResult | null> => {
    return null;
  };
}

export const nullAiProvider = new NullAiProvider();
