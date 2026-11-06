// [Layer: Frontend/Libs/Vision/idScanner/ai]
// Responsibility: Provider registry and fallback/consensus orchestrator managing multi-cloud AI vision adapters.
// Invariant: Strict TypeScript with ZERO 'any'. 100% Universal Lambda syntax (=>).

import type {
  AiOcrProvider,
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
import { NullAiProvider } from './NullAiProvider';
import { BackendProxyProvider } from './BackendProxyProvider';

/**
 * Registry and coordinator managing multi-provider AI standby fallback chains and consensus extraction.
 */
export class ProviderRegistry {
  private readonly providers: Map<string, AiOcrProvider> = new Map();
  private config: MultiProviderConfig;

  public constructor(initialConfig: MultiProviderConfig = DEFAULT_MULTI_PROVIDER_CONFIG) {
    this.config = { ...initialConfig };
    this.initializeDefaultProviders();
  }

  /**
   * Initializes default provider instances for Gemini, Azure, OpenAI, and Null standby.
   */
  private readonly initializeDefaultProviders = (): void => {
    this.registerProvider(new BackendProxyProvider({ targetProvider: 'gemini' }));
    this.registerProvider(new BackendProxyProvider({ targetProvider: 'azure' }));
    this.registerProvider(new BackendProxyProvider({ targetProvider: 'openai' }));
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
   * Sequentially invokes configured providers in chain order, advancing upon errors or null outputs.
   */
  public readonly executeSequentialFallback = async (
    imageDataUrl: string,
    hintType?: string
  ): Promise<IdOcrResult | null> => {
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

        const result = await provider.extract(imageDataUrl, hintType);
        if (result && Object.keys(result.fields).length > 0) {
          return result;
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
      (p: AiOcrProvider): Promise<IdOcrResult | null> => p.extract(imageDataUrl, hintType)
    );

    const settledResults = await Promise.allSettled(extractionPromises);
    const successfulResults: IdOcrResult[] = [];

    for (const outcome of settledResults) {
      if (outcome.status === 'fulfilled' && outcome.value && Object.keys(outcome.value.fields).length > 0) {
        successfulResults.push(outcome.value);
      }
    }

    if (successfulResults.length === 0) {
      return null;
    }

    if (successfulResults.length === 1) {
      return successfulResults[0];
    }

    // Synthesize field consensus
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

      // Check if values agree under normalization
      const firstNormalized = normalizeFieldValue(candidates[0].value);
      const allAgree = candidates.every(
        (c: ExtractedField): boolean => normalizeFieldValue(c.value) === firstNormalized
      );

      if (allAgree) {
        const avgConfidence =
          candidates.reduce((acc: number, c: ExtractedField): number => acc + c.confidence, 0) /
          candidates.length;
        // Boost confidence by 0.1 for multi-provider agreement, capped at 1.0
        const consensusConfidence = Math.min(1.0, Number((avgConfidence + 0.1).toFixed(3)));
        mergedFields[key] = {
          value: candidates[0].value,
          confidence: consensusConfidence
        };
      } else {
        // Conflicting fields: pick candidate with highest confidence score
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
      consensusScore
    };
  };
}

/**
 * Singleton instance of the ProviderRegistry.
 */
export const providerRegistry = new ProviderRegistry();
