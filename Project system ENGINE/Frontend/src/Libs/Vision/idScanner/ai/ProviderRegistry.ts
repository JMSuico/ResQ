// [Layer: Frontend/Libs/Vision/idScanner/ai]
// Responsibility: Provider registry and fallback/consensus orchestrator managing multi-cloud AI vision adapters with strict visible-only stop guards.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, and 100% Universal Lambda syntax (=>).

import type {
  AiOcrProvider,
  AiProviderId,
  IdOcrResult,
  MultiProviderConfig,
  ExtractedFieldsMap,
  ExtractedField
} from './AiOcrProvider';
import {
  DEFAULT_MULTI_PROVIDER_CONFIG,
  CORE_ID_FIELDS,
  normalizeFieldValue,
  calculateConsensusScore
} from './AiOcrProvider';
import {
  type OcrErrorCode,
  buildMissingFrontImageWarning,
  isBannedDummyOcrValue,
  isPlaceholderOcrValue
} from './ocrFieldUtils';
import { NullAiProvider } from './NullAiProvider';
import { BackendProxyProvider } from './BackendProxyProvider';
import { ClaudeSonnetOcrProvider } from './ClaudeSonnetOcrProvider';

/**
 * Input options accepted by executeOcrWithDiagnostics.
 */
export interface OcrDiagnosticExecutionInput {
  readonly frontImageDataUrl?: string | null;
  readonly backImageDataUrl?: string | null;
  readonly imageDataUrl?: string | null;
  readonly hintType?: string;
  readonly idType?: string;
}

const isTerminalImageValidationFailure = (errorCode?: OcrErrorCode | string): boolean => {
  if (!errorCode) {
    return false;
  }
  const normalized = errorCode.trim().toUpperCase();
  return (
    normalized === 'MISSING_FRONT_IMAGE' ||
    normalized === 'UNREADABLE_OR_BLANK_IMAGE'
  );
};

const filterValidExtractedFields = (fields: ExtractedFieldsMap): ExtractedFieldsMap => {
  const cleanFields: ExtractedFieldsMap = {};
  for (const [key, field] of Object.entries(fields)) {
    if (!field || typeof field.value !== 'string') {
      continue;
    }
    const trimmed = field.value.trim();
    if (
      trimmed.length > 0 &&
      !isPlaceholderOcrValue(trimmed) &&
      !isBannedDummyOcrValue(trimmed)
    ) {
      cleanFields[key] = {
        value: trimmed,
        confidence: field.confidence
      };
    }
  }
  return cleanFields;
};

/**
 * Registry and coordinator managing multi-provider AI standby fallback chains and consensus extraction.
 */
export class ProviderRegistry {
  private readonly providers: Map<string, AiOcrProvider> = new Map();
  public readonly defaultOrder: readonly AiProviderId[] = [
    'claude',
    'gemini',
    'openai',
    'groq',
    'ollama'
  ];
  private config: MultiProviderConfig;

  public constructor(initialConfig: MultiProviderConfig = DEFAULT_MULTI_PROVIDER_CONFIG) {
    this.config = {
      ...initialConfig,
      chain: initialConfig.chain.length > 0 ? [...initialConfig.chain] : [...this.defaultOrder]
    };
    this.initializeDefaultProviders();
  }

  /**
   * Initializes default provider instances for Claude Sonnet, Gemini, OpenAI, Groq, Ollama, Azure, and Null standby.
   */
  private readonly initializeDefaultProviders = (): void => {
    this.registerProvider(new ClaudeSonnetOcrProvider());
    this.registerProvider(new BackendProxyProvider({ targetProvider: 'gemini' }));
    this.registerProvider(new BackendProxyProvider({ targetProvider: 'openai' }));
    this.registerProvider(new BackendProxyProvider({ targetProvider: 'groq' }));
    this.registerProvider(new BackendProxyProvider({ targetProvider: 'ollama' }));
    this.registerProvider(new BackendProxyProvider({ targetProvider: 'azure' }));
    this.registerProvider(new NullAiProvider());
  };

  /**
   * Registers or overrides a named AI OCR provider in the registry.
   */
  public readonly registerProvider = (provider: AiOcrProvider): void => {
    this.providers.set(provider.name.toLowerCase(), provider);
  };

  /**
   * Retrieves an AI OCR provider by name.
   */
  public readonly getProvider = (name: string): AiOcrProvider | undefined =>
    this.providers.get(name.toLowerCase());

  /**
   * Returns all currently registered providers.
   */
  public readonly getAllProviders = (): readonly AiOcrProvider[] =>
    Array.from(this.providers.values());

  /**
   * Returns current multi-provider orchestrator configuration.
   */
  public readonly getConfig = (): MultiProviderConfig => ({ ...this.config });

  /**
   * Updates multi-provider configuration (chain order, consensusMode, timeout).
   */
  public readonly updateConfig = (patch: Partial<MultiProviderConfig>): void => {
    this.config = {
      ...this.config,
      ...patch,
      chain: patch.chain ? [...patch.chain] : this.config.chain
    };
  };

  /**
   * Executes AI-assisted OCR across the configured provider chain with graceful fallback or consensus resolution.
   */
  public readonly extract = async (
    imageDataUrl: string,
    hintType?: string
  ): Promise<IdOcrResult | null> => {
    if (this.config.consensusMode) {
      return this.executeConsensus(imageDataUrl, hintType);
    }
    return this.executeSequentialFallback(imageDataUrl, hintType);
  };

  /**
   * Executes OCR across the configured provider chain and returns a structured IdOcrResult
   * containing diagnostic error codes and warnings when extraction cannot proceed.
   */
  public readonly executeOcrWithDiagnostics = async (
    input: OcrDiagnosticExecutionInput | string,
    hintType?: string
  ): Promise<IdOcrResult> => {
    const resolvedFront =
      typeof input === 'string'
        ? input.trim()
        : (input.frontImageDataUrl ?? input.imageDataUrl ?? '').trim();
    const resolvedHint =
      typeof input === 'string'
        ? hintType
        : input.idType ?? input.hintType ?? hintType;
    const normalizedType = (resolvedHint || 'UNKNOWN').toUpperCase();

    if (!resolvedFront) {
      const warning = buildMissingFrontImageWarning(resolvedHint);
      return {
        type: normalizedType,
        fields: {},
        rawText: '',
        providerUsed: 'none',
        executionTimeMs: 0,
        success: false,
        errorCode: 'MISSING_FRONT_IMAGE',
        errorMessage: warning,
        warnings: [warning]
      };
    }

    let lastDiagnosticResult: IdOcrResult | null = null;

    for (const providerName of this.config.chain) {
      const provider = this.getProvider(providerName);
      if (!provider) {
        continue;
      }

      try {
        const isConfigured = await provider.isConfigured();
        if (!isConfigured) {
          continue;
        }

        const result = await provider.extract(resolvedFront, resolvedHint);
        if (!result) {
          continue;
        }

        if (isTerminalImageValidationFailure(result.errorCode)) {
          return {
            ...result,
            fields: {},
            success: false
          };
        }

        const cleanFields = filterValidExtractedFields(result.fields);
        if (result.success !== false && Object.keys(cleanFields).length > 0) {
          return {
            ...result,
            fields: cleanFields,
            success: true
          };
        }

        lastDiagnosticResult = result;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        lastDiagnosticResult = {
          type: normalizedType,
          fields: {},
          rawText: '',
          providerUsed: providerName,
          executionTimeMs: 0,
          success: false,
          errorCode: 'PROVIDER_UNAVAILABLE',
          errorMessage: errorMsg,
          warnings: [errorMsg]
        };
      }
    }

    if (lastDiagnosticResult) {
      return {
        ...lastDiagnosticResult,
        fields: {},
        success: false
      };
    }

    const fallbackMsg = 'No configured OCR provider could extract readable identity fields.';
    return {
      type: normalizedType,
      fields: {},
      rawText: '',
      providerUsed: 'none',
      executionTimeMs: 0,
      success: false,
      errorCode: 'PROVIDER_UNAVAILABLE',
      errorMessage: fallbackMsg,
      warnings: [fallbackMsg]
    };
  };

  /**
   * Sequentially invokes configured providers in chain order, advancing upon provider errors
   * while halting immediately on MISSING_FRONT_IMAGE or UNREADABLE_OR_BLANK_IMAGE.
   */
  public readonly executeSequentialFallback = async (
    imageDataUrl: string,
    hintType?: string
  ): Promise<IdOcrResult | null> => {
    const cleanImage = (imageDataUrl ?? '').trim();
    if (!cleanImage) {
      return null;
    }

    for (const providerName of this.config.chain) {
      const provider = this.getProvider(providerName);
      if (!provider) {
        continue;
      }

      try {
        const isConfigured = await provider.isConfigured();
        if (!isConfigured) {
          continue;
        }

        const result = await provider.extract(cleanImage, hintType);
        if (!result) {
          continue;
        }

        if (isTerminalImageValidationFailure(result.errorCode)) {
          return null;
        }

        const cleanFields = filterValidExtractedFields(result.fields);
        if (result.success !== false && Object.keys(cleanFields).length > 0) {
          return {
            ...result,
            fields: cleanFields,
            success: true
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[ProviderRegistry] Provider "${providerName}" threw error: ${errorMsg}. Advancing to next fallback...`
        );
      }
    }

    return null;
  };

  /**
   * Executes configured providers in parallel and synthesizes a field-level consensus result.
   */
  public readonly executeConsensus = async (
    imageDataUrl: string,
    hintType?: string
  ): Promise<IdOcrResult | null> => {
    const cleanImage = (imageDataUrl ?? '').trim();
    if (!cleanImage) {
      return null;
    }

    const startTime = Date.now();
    const candidateProviders: AiOcrProvider[] = [];

    for (const providerName of this.config.chain) {
      const provider = this.getProvider(providerName);
      if (provider) {
        try {
          if (await provider.isConfigured()) {
            candidateProviders.push(provider);
          }
        } catch {
          // Skip unconfigured or unreachable provider
        }
      }
    }

    if (candidateProviders.length === 0) {
      return null;
    }

    const extractionPromises = candidateProviders.map(
      (p: AiOcrProvider): Promise<IdOcrResult | null> => p.extract(cleanImage, hintType)
    );

    const settledResults = await Promise.allSettled(extractionPromises);
    const successfulResults: IdOcrResult[] = [];

    for (const outcome of settledResults) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        if (isTerminalImageValidationFailure(outcome.value.errorCode)) {
          continue;
        }
        const cleanFields = filterValidExtractedFields(outcome.value.fields);
        if (outcome.value.success !== false && Object.keys(cleanFields).length > 0) {
          successfulResults.push({
            ...outcome.value,
            fields: cleanFields
          });
        }
      }
    }

    if (successfulResults.length === 0) {
      return null;
    }

    if (successfulResults.length === 1) {
      return successfulResults[0];
    }

    const mergedFields: ExtractedFieldsMap = {};
    const allFieldKeys = Array.from(
      new Set([
        ...CORE_ID_FIELDS,
        ...successfulResults.flatMap((r: IdOcrResult): string[] => Object.keys(r.fields))
      ])
    );

    for (const key of allFieldKeys) {
      const candidates: ExtractedField[] = [];
      for (const res of successfulResults) {
        const field = res.fields[key];
        if (field && field.value && field.value.trim().length > 0) {
          candidates.push(field);
        }
      }

      if (candidates.length === 0) {
        continue;
      }

      if (candidates.length === 1) {
        mergedFields[key] = candidates[0];
        continue;
      }

      const firstNormalized = normalizeFieldValue(candidates[0].value);
      const allAgree = candidates.every(
        (c: ExtractedField): boolean => normalizeFieldValue(c.value) === firstNormalized
      );

      if (allAgree) {
        const avgConfidence =
          candidates.reduce((acc: number, c: ExtractedField): number => acc + c.confidence, 0) /
          candidates.length;
        const consensusConfidence = Math.min(1.0, Number((avgConfidence + 0.1).toFixed(3)));
        mergedFields[key] = {
          value: candidates[0].value,
          confidence: consensusConfidence
        };
      } else {
        let bestCandidate = candidates[0];
        for (let i = 1; i < candidates.length; i++) {
          if (candidates[i].confidence > bestCandidate.confidence) {
            bestCandidate = candidates[i];
          }
        }
        mergedFields[key] = bestCandidate;
      }
    }

    const consensusScore = calculateConsensusScore(successfulResults, allFieldKeys);
    const contributingProviders = successfulResults.map((r: IdOcrResult): string => r.providerUsed);
    const combinedRawText = successfulResults
      .map((r: IdOcrResult): string => `[${r.providerUsed}]\n${r.rawText}`)
      .join('\n\n');

    return {
      type: successfulResults[0].type || hintType || 'UNKNOWN',
      fields: mergedFields,
      rawText: combinedRawText,
      providerUsed: `consensus(${contributingProviders.join('+')})`,
      executionTimeMs: Date.now() - startTime,
      consensusScore,
      success: true
    };
  };
}

/**
 * Singleton instance of the ProviderRegistry.
 */
export const providerRegistry = new ProviderRegistry();

export * from './ClaudeSonnetOcrProvider';
