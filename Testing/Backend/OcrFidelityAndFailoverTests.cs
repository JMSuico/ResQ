// [Layer: Testing/Backend]
// Responsibility: TDD contract tests for visible-only OCR extraction, zero dummy fallbacks, and Claude 4.6 -> 5.5 model failover.
// Invariant: C# .NET 10, xUnit 2.9.3, custom HttpMessageHandler stubs, universal lambda expressions (=>), zero hardcoded secrets.

using System.Net;
using System.Text;
using System.Text.Json;
using Backend.Features.Api.DTOs;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Backend.Tests;

public class OcrFidelityAndFailoverTests
{
    private const string TestApiKeyPlaceholder = "test-anthropic-key-placeholder";

    private static readonly string[] BannedDummyTokens =
    [
        "JUAN",
        "JUAN MIGUEL",
        "DELA CRUZ",
        "SANTOS",
        "1995-05-15",
        "1996-05-14",
        "2030-05-15",
        "N01-23-456789",
        "K02-24-008491",
        "+639171234567"
    ];

    private static byte[] CreateMinimalPngBytes() =>
        Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    private static IConfiguration BuildClaudeConfig(
        string? apiKey = TestApiKeyPlaceholder,
        string? primaryModel = null,
        string? fallbackModel = null)
    {
        var values = new Dictionary<string, string?>();
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            values["Claude:ApiKey"] = apiKey;
        }
        if (!string.IsNullOrWhiteSpace(primaryModel))
        {
            values["Claude:Model"] = primaryModel;
        }
        if (!string.IsNullOrWhiteSpace(fallbackModel))
        {
            values["Claude:FallbackModel"] = fallbackModel;
        }

        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }

    private static string BuildAnthropicMessageEnvelope(string assistantText, string model = "claude-sonnet-4-6") =>
        JsonSerializer.Serialize(new
        {
            id = "msg_test_ocr",
            type = "message",
            role = "assistant",
            model,
            content = new[]
            {
                new { type = "text", text = assistantText }
            }
        });

    private static void AssertNoBannedDummyArtifacts(AiExtractResponseDto dto)
    {
        var valuesToInspect = new List<string?>
        {
            dto.FirstName,
            dto.MiddleName,
            dto.Surname,
            dto.FullName,
            dto.Suffix,
            dto.DateOfBirth,
            dto.ExpirationDate,
            dto.LicenseNumber,
            dto.IdNumber,
            dto.Address,
            dto.Barangay,
            dto.Street,
            dto.CityOrMunicipality,
            dto.Province,
            dto.Weight,
            dto.Height,
            dto.RawText
        };

        foreach (var kvp in dto.ExtractedFields)
        {
            valuesToInspect.Add(kvp.Key);
            valuesToInspect.Add(kvp.Value?.Value);
        }

        foreach (var candidate in valuesToInspect)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            foreach (var banned in BannedDummyTokens)
            {
                Assert.DoesNotContain(banned, candidate, StringComparison.OrdinalIgnoreCase);
            }
        }
    }

    private static async Task WithClearedAiEnvironmentAsync(Func<Task> action)
    {
        string[] keys =
        [
            "ANTHROPIC_API_KEY",
            "CLAUDE_API_KEY",
            "GEMINI_API_KEY",
            "OPENAI_API_KEY",
            "AZURE_VISION_KEY",
            "AZURE_VISION_ENDPOINT"
        ];

        var previous = keys.ToDictionary(k => k, k => Environment.GetEnvironmentVariable(k));
        try
        {
            foreach (var key in keys)
            {
                Environment.SetEnvironmentVariable(key, null);
            }

            await action();
        }
        finally
        {
            foreach (var kvp in previous)
            {
                Environment.SetEnvironmentVariable(kvp.Key, kvp.Value);
            }
        }
    }

    [Fact]
    public async Task IdentityAiService_MissingOrEmptyFrontImage_ReturnsMissingFrontImageWithZeroDummyFallback()
    {
        var handler = new StubClaudeHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            });
        var config = BuildClaudeConfig();
        var claudeClient = new ClaudeMessagesClient(
            new HttpClient(handler),
            config,
            NullLogger<ClaudeMessagesClient>.Instance);
        var service = new IdentityAiService(
            new StubHttpClientFactory(handler),
            config,
            NullLogger<IdentityAiService>.Instance,
            claudeClient);

        var ocrResult = await service.ExtractIdOcrAsync(
            [],
            "image/png",
            null,
            null,
            "drivers",
            "claude");

        Assert.False(ocrResult.Success);
        Assert.Equal("MISSING_FRONT_IMAGE", ocrResult.ErrorCode);
        Assert.Equal(0.0, ocrResult.Confidence);
        Assert.False(ocrResult.IsAuthentic);
        Assert.Empty(ocrResult.ExtractedFields);
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.FirstName));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.MiddleName));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.Surname));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.Suffix));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.DateOfBirth));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.Sex));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.LicenseNumber));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.IdNumber));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.Weight));
        Assert.True(string.IsNullOrWhiteSpace(ocrResult.Height));
        AssertNoBannedDummyArtifacts(ocrResult);

        var dtoResult = await service.ExtractIdentityAsync(new AiExtractRequestDto
        {
            ImageDataUrl = string.Empty,
            FrontImageBase64 = string.Empty,
            IdType = "drivers",
            PreferredProvider = "claude"
        });

        Assert.False(dtoResult.Success);
        Assert.Equal("MISSING_FRONT_IMAGE", dtoResult.ErrorCode);
        Assert.Equal(0.0, dtoResult.Confidence);
        Assert.False(dtoResult.IsAuthentic);
        Assert.Empty(dtoResult.ExtractedFields);
        AssertNoBannedDummyArtifacts(dtoResult);
        Assert.Empty(handler.RequestedModels);
    }

    [Fact]
    public async Task IdentityAiService_BlankOrUnreadableClaudeResponse_ReturnsUnreadableErrorWithZeroDummyData()
    {
        string blankSignalJson = JsonSerializer.Serialize(new
        {
            unreadable = true,
            errorCode = "UNREADABLE_OR_BLANK_IMAGE",
            confidence = 0.0,
            fields = new Dictionary<string, object>()
        });

        var handler = new StubClaudeHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    BuildAnthropicMessageEnvelope(blankSignalJson),
                    Encoding.UTF8,
                    "application/json")
            });

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var config = BuildClaudeConfig();
            var claudeClient = new ClaudeMessagesClient(
                new HttpClient(handler),
                config,
                NullLogger<ClaudeMessagesClient>.Instance);
            var service = new IdentityAiService(
                new StubHttpClientFactory(handler),
                config,
                NullLogger<IdentityAiService>.Instance,
                claudeClient);

            var result = await service.ExtractIdOcrAsync(
                CreateMinimalPngBytes(),
                "image/png",
                null,
                null,
                "drivers",
                "claude");

            Assert.False(result.Success);
            Assert.Equal("UNREADABLE_OR_BLANK_IMAGE", result.ErrorCode);
            Assert.Equal(0.0, result.Confidence);
            Assert.False(result.IsAuthentic);
            Assert.Empty(result.ExtractedFields);
            Assert.True(string.IsNullOrWhiteSpace(result.FirstName));
            Assert.True(string.IsNullOrWhiteSpace(result.MiddleName));
            Assert.True(string.IsNullOrWhiteSpace(result.Surname));
            Assert.True(string.IsNullOrWhiteSpace(result.Suffix));
            Assert.True(string.IsNullOrWhiteSpace(result.DateOfBirth));
            Assert.True(string.IsNullOrWhiteSpace(result.Sex));
            Assert.True(string.IsNullOrWhiteSpace(result.LicenseNumber));
            Assert.True(string.IsNullOrWhiteSpace(result.IdNumber));
            Assert.True(string.IsNullOrWhiteSpace(result.Weight));
            Assert.True(string.IsNullOrWhiteSpace(result.Height));
            Assert.False(result.ExtractedFields.ContainsKey("PhoneNumber"));
            AssertNoBannedDummyArtifacts(result);
        });
    }

    [Fact]
    public async Task IdentityAiService_PartialVisibleElenaMarquezResponse_PreservesVisibleAndLeavesOmittedFieldsNull()
    {
        string partialVisibleJson = JsonSerializer.Serialize(new
        {
            IdType = "DRIVERS_LICENSE",
            FirstName = "ELENA",
            MiddleName = (string?)null,
            Surname = "MARQUEZ",
            Suffix = (string?)null,
            DateOfBirth = "1994-03-11",
            Sex = "Female",
            LicenseNumber = "K09-88-776655",
            Barangay = "BARRA",
            CityOrMunicipality = "DIPOLOG",
            Province = "ZAMBOANGA DEL NORTE",
            Weight = (string?)null,
            Height = (string?)null,
            PhoneNumber = (string?)null,
            RawText = "REPUBLIC OF THE PHILIPPINES\nDRIVER'S LICENSE\nMARQUEZ, ELENA\n1994/03/11\nK09-88-776655\nBARRA, DIPOLOG, ZAMBOANGA DEL NORTE"
        });

        var handler = new StubClaudeHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    BuildAnthropicMessageEnvelope(partialVisibleJson),
                    Encoding.UTF8,
                    "application/json")
            });

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var config = BuildClaudeConfig();
            var claudeClient = new ClaudeMessagesClient(
                new HttpClient(handler),
                config,
                NullLogger<ClaudeMessagesClient>.Instance);
            var service = new IdentityAiService(
                new StubHttpClientFactory(handler),
                config,
                NullLogger<IdentityAiService>.Instance,
                claudeClient);

            var result = await service.ExtractIdOcrAsync(
                CreateMinimalPngBytes(),
                "image/png",
                null,
                null,
                "drivers",
                "claude");

            Assert.True(result.Success);
            Assert.Equal("ELENA", result.FirstName);
            Assert.Equal("MARQUEZ", result.Surname);
            Assert.Equal("1994-03-11", result.DateOfBirth);
            Assert.Equal("Female", result.Sex);
            Assert.Equal("K09-88-776655", result.LicenseNumber);
            Assert.Equal("BARRA", result.Barangay);
            Assert.Equal("DIPOLOG", result.CityOrMunicipality);
            Assert.Equal("ZAMBOANGA DEL NORTE", result.Province);

            Assert.True(string.IsNullOrWhiteSpace(result.MiddleName));
            Assert.True(string.IsNullOrWhiteSpace(result.Suffix));
            Assert.True(string.IsNullOrWhiteSpace(result.Weight));
            Assert.True(string.IsNullOrWhiteSpace(result.Height));
            Assert.False(result.ExtractedFields.ContainsKey("MiddleName"));
            Assert.False(result.ExtractedFields.ContainsKey("Suffix"));
            Assert.False(result.ExtractedFields.ContainsKey("Weight"));
            Assert.False(result.ExtractedFields.ContainsKey("Height"));
            Assert.False(result.ExtractedFields.ContainsKey("PhoneNumber"));

            Assert.NotEqual(0.96, result.Confidence);
            Assert.NotEqual(0.98, result.Confidence);
            Assert.InRange(result.Confidence, 0.0, 1.0);
            AssertNoBannedDummyArtifacts(result);
        });
    }

    [Fact]
    public async Task ClaudeMessagesClient_PrimaryModel404_RetriesWithFallbackModelAndSucceeds()
    {
        var handler = new StubClaudeHttpMessageHandler(ctx =>
        {
            if (ctx.Model == "claude-sonnet-4-6")
            {
                return new HttpResponseMessage(HttpStatusCode.NotFound)
                {
                    Content = new StringContent(
                        "{\"type\":\"error\",\"error\":{\"type\":\"not_found_error\",\"message\":\"model not found\"}}",
                        Encoding.UTF8,
                        "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    BuildAnthropicMessageEnvelope("{\"FirstName\":\"ELENA\",\"Surname\":\"MARQUEZ\"}", ctx.Model ?? "claude-sonnet-5-5"),
                    Encoding.UTF8,
                    "application/json")
            };
        });

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var config = BuildClaudeConfig();
            IClaudeMessagesClient client = new ClaudeMessagesClient(
                new HttpClient(handler),
                config,
                NullLogger<ClaudeMessagesClient>.Instance);

            Assert.True(client.IsConfigured);
            Assert.Equal("claude-sonnet-4-6", client.PrimaryModel);
            Assert.Equal("claude-sonnet-5-5", client.FallbackModel);

            var payload = new Dictionary<string, object>
            {
                ["max_tokens"] = 256,
                ["messages"] = new object[]
                {
                    new { role = "user", content = "Extract visible fields." }
                }
            };

            ClaudeMessageAttemptResult attempt = await client.SendMessagesAsync(payload);

            Assert.Equal(["claude-sonnet-4-6", "claude-sonnet-5-5"], handler.RequestedModels);
            Assert.True(attempt.Success);
            Assert.True(attempt.UsedFallbackModel);
            Assert.Equal("claude-sonnet-5-5", attempt.ModelUsed);
            Assert.Equal(200, attempt.HttpStatusCode);
            Assert.Contains("ELENA", attempt.RawText ?? string.Empty);
            Assert.Contains("MARQUEZ", attempt.RawText ?? string.Empty);
        });
    }

    [Fact]
    public async Task IdentityAiService_And_ClaudeMessagesClient_MissingKeys_ReturnProviderUnavailableWithZeroFabrication()
    {
        var handler = new StubClaudeHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            });

        await WithClearedAiEnvironmentAsync(async () =>
        {
            var emptyConfig = new ConfigurationBuilder().Build();
            IClaudeMessagesClient claudeClient = new ClaudeMessagesClient(
                new HttpClient(handler),
                emptyConfig,
                NullLogger<ClaudeMessagesClient>.Instance);

            Assert.False(claudeClient.IsConfigured);

            var payload = new Dictionary<string, object>
            {
                ["max_tokens"] = 128,
                ["messages"] = new object[]
                {
                    new { role = "user", content = "Extract visible fields." }
                }
            };

            var attempt = await claudeClient.SendMessagesAsync(payload);
            Assert.False(attempt.Success);
            Assert.Equal("PROVIDER_UNAVAILABLE", attempt.ErrorCode);
            Assert.False(attempt.UsedFallbackModel);

            var service = new IdentityAiService(
                new StubHttpClientFactory(handler),
                emptyConfig,
                NullLogger<IdentityAiService>.Instance,
                claudeClient);

            var ocrResult = await service.ExtractIdOcrAsync(
                CreateMinimalPngBytes(),
                "image/png",
                null,
                null,
                "drivers",
                "claude");

            Assert.False(ocrResult.Success);
            Assert.Equal("PROVIDER_UNAVAILABLE", ocrResult.ErrorCode);
            Assert.Equal(0.0, ocrResult.Confidence);
            Assert.False(ocrResult.IsAuthentic);
            Assert.Empty(ocrResult.ExtractedFields);
            Assert.True(string.IsNullOrWhiteSpace(ocrResult.FirstName));
            Assert.True(string.IsNullOrWhiteSpace(ocrResult.Surname));
            Assert.True(string.IsNullOrWhiteSpace(ocrResult.LicenseNumber));
            Assert.True(string.IsNullOrWhiteSpace(ocrResult.DateOfBirth));
            AssertNoBannedDummyArtifacts(ocrResult);
            Assert.Empty(handler.RequestedModels);
        });
    }

    private sealed record StubRequestContext(string? Model, string Body, HttpRequestMessage Request);

    private sealed class StubClaudeHttpMessageHandler(Func<StubRequestContext, HttpResponseMessage> responder)
        : HttpMessageHandler
    {
        public List<string> RequestedModels { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            string body = request.Content != null
                ? await request.Content.ReadAsStringAsync(cancellationToken)
                : string.Empty;

            string? model = null;
            if (!string.IsNullOrWhiteSpace(body))
            {
                try
                {
                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("model", out var modelProp))
                    {
                        model = modelProp.GetString();
                    }
                }
                catch
                {
                    model = null;
                }
            }

            if (!string.IsNullOrWhiteSpace(model))
            {
                RequestedModels.Add(model);
            }

            return responder(new StubRequestContext(model, body, request));
        }
    }

    private sealed class StubHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }
}
