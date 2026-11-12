// [Layer: Frontend/Libs/Vision/idScanner/ai]
// Responsibility: Dispatches OCR extraction requests to the ASP.NET Core Web API proxy at /api/identity/ai-extract.
// Invariant: Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>).

import type { AiOcrProvider, IdOcrResult, ExtractedFieldsMap } from './AiOcrProvider';

/**
 * Request payload sent to ASP.NET Core /api/identity/ai-extract.
 */
export interface BackendAiExtractRequest {
  readonly imageDataUrl: string;
  readonly hintType?: string;
  readonly preferredProvider?: string;
}

/**
 * Structured field DTO returned by the backend.
 */
export interface BackendExtractedFieldDto {
  readonly value: string;
  readonly confidence: number;
}

/**
 * Full response envelope returned by /api/identity/ai-extract.
 */
export interface BackendAiExtractResponse {
  readonly success: boolean;
  readonly providerUsed?: string;
  readonly idType?: string;
  readonly extractedFields?: Record<string, BackendExtractedFieldDto>;
  readonly rawText?: string;
  readonly errorMessage?: string;
  readonly executionTimeMs: number;
}

/**
 * Health & configuration status returned by /api/identity/ai-status.
 */
export interface BackendAiStatusResponse {
  readonly geminiConfigured: boolean;
  readonly openAiConfigured: boolean;
  readonly azureConfigured: boolean;
  readonly hasAnyProvider: boolean;
  readonly activeChain: string;
}

/**
 * Initialization options for BackendProxyProvider.
 */
export interface BackendProxyProviderOptions {
  readonly targetProvider?: string;
  readonly extractEndpoint?: string;
  readonly statusEndpoint?: string;
  readonly timeoutMs?: number;
}

const resolveBackendEndpoint = (path: string): string => {
  let base = '';
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    base = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, '');
  }
  if (!base && typeof window !== 'undefined') {
    const port = window.location.port;
    if (['1996', '1997', '1998', '5173', '5174', '5175'].includes(port)) {
      base = `${window.location.protocol}//${window.location.hostname}:1999`;
    }
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Communicates with the ResQTrack ASP.NET Core backend to invoke cloud vision providers securely.
 */
export class BackendProxyProvider implements AiOcrProvider {
  public readonly name: string;
  private readonly extractEndpoint: string;
  private readonly statusEndpoint: string;
  private readonly timeoutMs: number;
  private cachedIsConfigured: boolean | null = null;
  private lastConfigCheckTime: number = 0;
  private static readonly CACHE_TTL_MS: number = 45_000;

  public constructor(options?: BackendProxyProviderOptions) {
    this.name = options?.targetProvider ?? 'backend-proxy';
    this.extractEndpoint = options?.extractEndpoint ?? resolveBackendEndpoint('/api/identity/ai-extract');
    this.statusEndpoint = options?.statusEndpoint ?? resolveBackendEndpoint('/api/identity/ai-status');
    this.timeoutMs = options?.timeoutMs ?? 20_000;
  }

  /**
   * Verifies whether the specified provider or any AI provider is configured on the backend.
   */
  public readonly isConfigured = async (): Promise<boolean> => {
    const now = Date.now();
    if (this.cachedIsConfigured !== null && now - this.lastConfigCheckTime < BackendProxyProvider.CACHE_TTL_MS) {
      return this.cachedIsConfigured;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout((): void => controller.abort(), 6_000);

      const response = await fetch(this.statusEndpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.cachedIsConfigured = false;
        this.lastConfigCheckTime = now;
        return false;
      }

      const status = (await response.json()) as BackendAiStatusResponse;
      let configured = false;

      if (this.name === 'gemini') {
        configured = status.geminiConfigured;
      } else if (this.name === 'azure') {
        configured = status.azureConfigured;
      } else if (this.name === 'openai') {
        configured = status.openAiConfigured;
      } else {
        configured = status.hasAnyProvider;
      }

      this.cachedIsConfigured = configured;
      this.lastConfigCheckTime = now;
      return configured;
    } catch {
      this.cachedIsConfigured = false;
      this.lastConfigCheckTime = now;
      return false;
    }
  };

  /**
   * Executes AI-assisted OCR extraction via the backend endpoint.
   */
  public readonly extract = async (
    imageDataUrl: string,
    hintType?: string
  ): Promise<IdOcrResult | null> => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout((): void => controller.abort(), this.timeoutMs);

      const requestBody: BackendAiExtractRequest = {
        imageDataUrl,
        hintType,
        preferredProvider: this.name === 'backend-proxy' ? undefined : this.name
      };

      const response = await fetch(this.extractEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch((): string => 'Unable to read error text');
        console.warn(`[BackendProxyProvider:${this.name}] HTTP ${response.status} Error: ${errorText}`);
        return null;
      }

      const data = (await response.json()) as BackendAiExtractResponse;
      if (!data.success) {
        console.info(
          `[BackendProxyProvider:${this.name}] Standby mode notice: ${data.errorMessage ?? 'No extraction produced'}`
        );
        return null;
      }

      const fields: ExtractedFieldsMap = {};
      if (data.extractedFields) {
        for (const [key, field] of Object.entries(data.extractedFields)) {
          if (field && typeof field.value === 'string' && field.value.trim().length > 0) {
            fields[key] = {
              value: field.value.trim(),
              confidence: typeof field.confidence === 'number' ? Number(field.confidence.toFixed(3)) : 1.0
            };
          }
        }
      }

      return {
        type: data.idType || hintType || 'UNKNOWN',
        fields,
        rawText: data.rawText ?? '',
        providerUsed: data.providerUsed ?? this.name,
        executionTimeMs: data.executionTimeMs > 0 ? data.executionTimeMs : (Date.now() - startTime)
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[BackendProxyProvider:${this.name}] Extraction failure: ${message}`);
      return null;
    }
  };
}
