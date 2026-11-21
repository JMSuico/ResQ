// [Layer: Backend/Services/Implementations]
// Responsibility: Implements shared Anthropic Claude Messages API client with automatic primary-to-fallback model failover.
// Invariant: C# .NET 10, nullable reference types, zero leaked secrets in logs or responses.

using System.Globalization;
using System.Text;
using System.Text.Json;
using Backend.Features.Services.Interfaces;
using Microsoft.Extensions.Logging.Abstractions;

namespace Backend.Features.Services.Implementations;

public class ClaudeMessagesClient(
    HttpClient? httpClient,
    IConfiguration? configuration,
    ILogger<ClaudeMessagesClient>? logger = null) : IClaudeMessagesClient
{
    private const string DefaultPrimaryModel = "claude-sonnet-4-6";
    private const string DefaultFallbackModel = "claude-sonnet-5-5";
    private const string DefaultEndpoint = "https://api.anthropic.com/v1/messages";
    private const string DefaultAnthropicVersion = "2023-06-01";
    private const double DefaultAttemptTimeoutSeconds = 22.0;

    private static readonly Lazy<HttpClient> FallbackHttpClient = new(() => new HttpClient());

    private readonly HttpClient _httpClient = httpClient ?? FallbackHttpClient.Value;
    private readonly IConfiguration? _configuration = configuration;
    private readonly ILogger<ClaudeMessagesClient> _logger = logger ?? NullLogger<ClaudeMessagesClient>.Instance;

    public ClaudeMessagesClient()
        : this(null, null, null)
    {
    }

    public bool IsConfigured => ResolveApiKey() is not null;

    public string PrimaryModel =>
        ResolveNonEmpty(_configuration?["Claude:Model"], DefaultPrimaryModel);

    public string FallbackModel =>
        ResolveNonEmpty(_configuration?["Claude:FallbackModel"], DefaultFallbackModel);

    public async Task<ClaudeMessageAttemptResult> SendMessagesAsync(
        IReadOnlyDictionary<string, object> payloadWithoutModel,
        CancellationToken ct = default,
        string? modelOverride = null)
    {
        ArgumentNullException.ThrowIfNull(payloadWithoutModel);

        string? apiKey = ResolveApiKey();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new ClaudeMessageAttemptResult(
                Success: false,
                RawText: null,
                ModelUsed: PrimaryModel,
                ErrorCode: "PROVIDER_UNAVAILABLE",
                ErrorMessage: "Claude API key is not configured.",
                HttpStatusCode: 0,
                UsedFallbackModel: false);
        }

        List<string> attemptModels = BuildAttemptModels(modelOverride);
        string endpoint = ResolveNonEmpty(_configuration?["Claude:Endpoint"], DefaultEndpoint);
        string anthropicVersion = ResolveNonEmpty(_configuration?["Claude:AnthropicVersion"], DefaultAnthropicVersion);
        TimeSpan perAttemptTimeout = ResolvePerAttemptTimeout();

        for (int attemptIndex = 0; attemptIndex < attemptModels.Count; attemptIndex++)
        {
            ct.ThrowIfCancellationRequested();

            string candidateModel = attemptModels[attemptIndex];
            bool usedFallback = attemptIndex > 0;
            bool hasRemainingFallback = attemptIndex + 1 < attemptModels.Count;

            var payload = new Dictionary<string, object>(payloadWithoutModel)
            {
                ["model"] = candidateModel
            };
            string serializedPayload = JsonSerializer.Serialize(payload);

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.TryAddWithoutValidation("x-api-key", apiKey);
            request.Headers.TryAddWithoutValidation("anthropic-version", anthropicVersion);
            request.Content = new StringContent(serializedPayload, Encoding.UTF8, "application/json");

            using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            attemptCts.CancelAfter(perAttemptTimeout);

            try
            {
                using HttpResponseMessage response = await _httpClient.SendAsync(request, attemptCts.Token);
                int statusCode = (int)response.StatusCode;
                string responseBody = await response.Content.ReadAsStringAsync(attemptCts.Token);

                if (response.IsSuccessStatusCode)
                {
                    if (!TryExtractConcatenatedText(responseBody, out string extractedText))
                    {
                        return new ClaudeMessageAttemptResult(
                            Success: false,
                            RawText: null,
                            ModelUsed: candidateModel,
                            ErrorCode: "PROVIDER_UNAVAILABLE",
                            ErrorMessage: "Claude API returned an unreadable response payload.",
                            HttpStatusCode: statusCode,
                            UsedFallbackModel: usedFallback);
                    }

                    return new ClaudeMessageAttemptResult(
                        Success: true,
                        RawText: extractedText,
                        ModelUsed: candidateModel,
                        ErrorCode: null,
                        ErrorMessage: null,
                        HttpStatusCode: statusCode,
                        UsedFallbackModel: usedFallback);
                }

                if (IsRetriableStatusCode(statusCode))
                {
                    _logger.LogWarning(
                        "Claude Messages API attempt failed for model {Model} with HTTP {StatusCode}.",
                        candidateModel,
                        statusCode);

                    if (hasRemainingFallback && !ct.IsCancellationRequested)
                    {
                        continue;
                    }
                }

                return new ClaudeMessageAttemptResult(
                    Success: false,
                    RawText: null,
                    ModelUsed: candidateModel,
                    ErrorCode: ResolveHttpErrorCode(statusCode),
                    ErrorMessage: ExtractSafeErrorMessage(responseBody, statusCode, apiKey),
                    HttpStatusCode: statusCode,
                    UsedFallbackModel: usedFallback);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (HttpRequestException ex)
            {
                int statusCode = ex.StatusCode.HasValue ? (int)ex.StatusCode.Value : 0;
                _logger.LogWarning(
                    "Claude Messages API request failed for model {Model} with HTTP {StatusCode}.",
                    candidateModel,
                    statusCode);

                if (!ct.IsCancellationRequested && hasRemainingFallback)
                {
                    continue;
                }

                return new ClaudeMessageAttemptResult(
                    Success: false,
                    RawText: null,
                    ModelUsed: candidateModel,
                    ErrorCode: "PROVIDER_UNAVAILABLE",
                    ErrorMessage: "Claude API request failed due to a network error.",
                    HttpStatusCode: statusCode,
                    UsedFallbackModel: usedFallback);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Claude Messages API request timed out for model {Model} with HTTP {StatusCode}.",
                    candidateModel,
                    0);

                if (hasRemainingFallback)
                {
                    continue;
                }

                return new ClaudeMessageAttemptResult(
                    Success: false,
                    RawText: null,
                    ModelUsed: candidateModel,
                    ErrorCode: "PROVIDER_UNAVAILABLE",
                    ErrorMessage: "Claude API request timed out.",
                    HttpStatusCode: 0,
                    UsedFallbackModel: usedFallback);
            }
        }

        return new ClaudeMessageAttemptResult(
            Success: false,
            RawText: null,
            ModelUsed: PrimaryModel,
            ErrorCode: "PROVIDER_UNAVAILABLE",
            ErrorMessage: "Claude API request exhausted all configured models.",
            HttpStatusCode: 0,
            UsedFallbackModel: false);
    }

    private List<string> BuildAttemptModels(string? modelOverride)
    {
        string firstModel = string.IsNullOrWhiteSpace(modelOverride)
            ? PrimaryModel
            : modelOverride.Trim();

        string primaryModel = PrimaryModel;
        string fallbackModel = FallbackModel;
        var models = new List<string>(3);

        if (!string.IsNullOrWhiteSpace(firstModel))
        {
            models.Add(firstModel);
        }

        if (!string.IsNullOrWhiteSpace(modelOverride) &&
            (firstModel.Equals("claude-haiku-4-5-20251001", StringComparison.OrdinalIgnoreCase) ||
             firstModel.Equals("claude-haiku-4-5", StringComparison.OrdinalIgnoreCase) ||
             firstModel.Contains("haiku", StringComparison.OrdinalIgnoreCase)) &&
            !string.IsNullOrWhiteSpace(primaryModel) &&
            !models.Any(m => string.Equals(m, primaryModel, StringComparison.OrdinalIgnoreCase)))
        {
            models.Add(primaryModel);
        }

        if (!string.IsNullOrWhiteSpace(fallbackModel) &&
            !models.Any(m => string.Equals(m, fallbackModel, StringComparison.OrdinalIgnoreCase)))
        {
            models.Add(fallbackModel);
        }

        return models;
    }

    private string? ResolveApiKey()
    {
        string?[] candidates =
        [
            _configuration?["Claude:ApiKey"],
            _configuration?["Anthropic:ApiKey"],
            Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"),
            Environment.GetEnvironmentVariable("CLAUDE_API_KEY")
        ];

        foreach (string? candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            string trimmed = candidate.Trim();
            if (!IsTemplatePlaceholderKey(trimmed))
            {
                return trimmed;
            }
        }

        return null;
    }

    private static bool IsTemplatePlaceholderKey(string key) =>
        key.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase) ||
        key.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase) ||
        (key.Length >= 2 && key.StartsWith('<') && key.EndsWith('>'));

    private static string ResolveNonEmpty(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private TimeSpan ResolvePerAttemptTimeout()
    {
        string? configured = _configuration?["Claude:TimeoutSeconds"];
        if (!string.IsNullOrWhiteSpace(configured) &&
            double.TryParse(configured.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out double seconds) &&
            double.IsFinite(seconds) &&
            seconds > 0)
        {
            return TimeSpan.FromSeconds(Math.Min(seconds, 3600.0));
        }

        return TimeSpan.FromSeconds(DefaultAttemptTimeoutSeconds);
    }

    private static bool IsRetriableStatusCode(int statusCode) =>
        statusCode is 404 or 429 or 500 or 502 or 503 or 529;

    private static string ResolveHttpErrorCode(int statusCode) =>
        statusCode == 400 ? "REQUEST_FAILED" : "PROVIDER_UNAVAILABLE";

    private static bool TryExtractConcatenatedText(string responseBody, out string text)
    {
        text = string.Empty;
        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return true;
        }

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (!doc.RootElement.TryGetProperty("content", out var contentArray) ||
                contentArray.ValueKind != JsonValueKind.Array)
            {
                return true;
            }

            var sb = new StringBuilder();
            foreach (var item in contentArray.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                if (item.TryGetProperty("type", out var typeProp) &&
                    typeProp.ValueKind == JsonValueKind.String &&
                    !string.Equals(typeProp.GetString(), "text", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (item.TryGetProperty("text", out var textProp) &&
                    textProp.ValueKind == JsonValueKind.String)
                {
                    string? part = textProp.GetString();
                    if (!string.IsNullOrEmpty(part))
                    {
                        sb.Append(part);
                    }
                }
            }

            text = sb.ToString();
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static string ExtractSafeErrorMessage(string responseBody, int statusCode, string apiKey)
    {
        string fallback = $"Claude API returned HTTP {statusCode}.";
        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return fallback;
        }

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (doc.RootElement.TryGetProperty("error", out var errorObj) &&
                errorObj.ValueKind == JsonValueKind.Object &&
                errorObj.TryGetProperty("message", out var msgProp) &&
                msgProp.ValueKind == JsonValueKind.String)
            {
                string? msg = msgProp.GetString();
                if (!string.IsNullOrWhiteSpace(msg) &&
                    !msg.Contains("sk-ant-", StringComparison.OrdinalIgnoreCase) &&
                    (apiKey.Length < 8 || !msg.Contains(apiKey, StringComparison.Ordinal)))
                {
                    string trimmed = msg.Trim();
                    return trimmed.Length <= 300 ? trimmed : trimmed[..300];
                }
            }
        }
        catch (JsonException)
        {
            // Ignore malformed error body and fall back to status code message.
        }

        return fallback;
    }
}
