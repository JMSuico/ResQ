// [Layer: Backend/Api/DTOs]
// Responsibility: Data Transfer Objects for AI standby ID document extraction and vision provider orchestration.
// Invariant: C# .NET 10 Web API standards, nullable reference types enabled, universal lambda expressions (=>).

namespace Backend.Features.Api.DTOs;

/// <summary>
/// Payload submitted for AI-assisted optical character recognition and identity classification.
/// </summary>
public class AiExtractRequestDto
{
    /// <summary>
    /// Base64 data URL (e.g. data:image/jpeg;base64,...) or raw base64 string of the captured ID document.
    /// </summary>
    public string ImageDataUrl { get; set; } = string.Empty;

    /// <summary>
    /// Optional hint indicating expected Philippine ID format (e.g., PH_NATIONAL_ID, DRIVERS_LICENSE, PASSPORT).
    /// </summary>
    public string? HintType { get; set; }

    /// <summary>
    /// Explicit preferred AI provider ('gemini', 'azure', 'openai') or null to invoke default fallback chain.
    /// </summary>
    public string? PreferredProvider { get; set; }
}

/// <summary>
/// Individual identity field holding textual value and normalized confidence score (0.0 to 1.0).
/// </summary>
public class ExtractedFieldDto
{
    public string Value { get; set; } = string.Empty;
    public double Confidence { get; set; } = 1.0;

    public ExtractedFieldDto() { }

    public ExtractedFieldDto(string value, double confidence = 1.0) =>
        (Value, Confidence) = (value, confidence);
}

/// <summary>
/// Standard response envelope returning extracted fields, provider diagnostics, and performance telemetry.
/// </summary>
public class AiExtractResponseDto
{
    public bool Success { get; set; }
    public string? ProviderUsed { get; set; }
    public string? IdType { get; set; }
    public Dictionary<string, ExtractedFieldDto> ExtractedFields { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string? RawText { get; set; }
    public string? ErrorMessage { get; set; }
    public long ExecutionTimeMs { get; set; }
}

/// <summary>
/// Telemetry DTO communicating availability of configured cloud vision providers without exposing secret keys.
/// </summary>
public class AiProviderStatusDto
{
    public bool GeminiConfigured { get; set; }
    public bool OpenAiConfigured { get; set; }
    public bool AzureConfigured { get; set; }
    public bool HasAnyProvider => GeminiConfigured || OpenAiConfigured || AzureConfigured;
    public string ActiveChain { get; set; } = string.Empty;
}
