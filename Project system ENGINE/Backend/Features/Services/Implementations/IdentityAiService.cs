// [Layer: Backend/Services/Implementations]
// Responsibility: AI Standby Multi-Provider service supporting Google Gemini, OpenAI GPT-4o Vision, and Azure Document Intelligence.
// Invariant: C# .NET 10 Web API standards, nullable reference types, universal lambda expressions (=>), masked secrets in logs.

using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Backend.Features.Api.DTOs;
using Backend.Features.Services.Interfaces;

namespace Backend.Features.Services.Implementations;

public class IdentityAiService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<IdentityAiService> logger) : IIdentityAiService
{
    private static readonly string[] CoreIdFields =
    [
        "FullName",
        "IdNumber",
        "DateOfBirth",
        "ExpirationDate",
        "Address",
        "Sex"
    ];

    public AiProviderStatusDto GetAiStatus() =>
        new()
        {
            GeminiConfigured = !string.IsNullOrWhiteSpace(GetSecret("GEMINI_API_KEY")),
            OpenAiConfigured = !string.IsNullOrWhiteSpace(GetSecret("OPENAI_API_KEY")),
            AzureConfigured = !string.IsNullOrWhiteSpace(GetSecret("AZURE_VISION_KEY")) &&
                              !string.IsNullOrWhiteSpace(GetSecret("AZURE_VISION_ENDPOINT")),
            ActiveChain = ResolveActiveChainSummary()
        };

    public async Task<AiExtractResponseDto> ExtractIdentityAsync(AiExtractRequestDto request, CancellationToken ct = default) =>
        await ExecuteAiExtractionAsync(request, ct);

    public Task<IdentityDocumentAnalyzeResponseDto> AnalyzeDocumentAsync(IdentityDocumentAnalyzeRequestDto request, CancellationToken ct = default) =>
        Task.FromResult(ExecuteDeterministicDocumentAnalysis(request));

    private async Task<AiExtractResponseDto> ExecuteAiExtractionAsync(AiExtractRequestDto request, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        if (string.IsNullOrWhiteSpace(request.ImageDataUrl))
        {
            return new AiExtractResponseDto
            {
                Success = false,
                ErrorMessage = "Image payload is missing or empty.",
                ExecutionTimeMs = sw.ElapsedMilliseconds
            };
        }

        string geminiKey = GetSecret("GEMINI_API_KEY");
        string openAiKey = GetSecret("OPENAI_API_KEY");
        string azureKey = GetSecret("AZURE_VISION_KEY");
        string azureEndpoint = GetSecret("AZURE_VISION_ENDPOINT");

        bool hasGemini = !string.IsNullOrWhiteSpace(geminiKey);
        bool hasOpenAi = !string.IsNullOrWhiteSpace(openAiKey);
        bool hasAzure = !string.IsNullOrWhiteSpace(azureKey) && !string.IsNullOrWhiteSpace(azureEndpoint);

        if (!hasGemini && !hasOpenAi && !hasAzure)
        {
            logger.LogInformation("No external AI keys configured. Returning standby deterministic notice.");
            return new AiExtractResponseDto
            {
                Success = false,
                ProviderUsed = "none",
                ErrorMessage = "No external AI providers are configured on this server. Running in purely deterministic mode.",
                ExecutionTimeMs = sw.ElapsedMilliseconds
            };
        }

        var (mimeType, base64Data) = ParseDataUrl(request.ImageDataUrl);
        var client = httpClientFactory.CreateClient();

        var executionList = new List<string>();
        if (!string.IsNullOrWhiteSpace(request.PreferredProvider))
        {
            executionList.Add(request.PreferredProvider.ToLowerInvariant());
        }
        foreach (var p in new[] { "gemini", "azure", "openai" })
        {
            if (!executionList.Contains(p))
            {
                executionList.Add(p);
            }
        }

        var accumulatedErrors = new List<string>();

        foreach (var provider in executionList)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                if (provider == "gemini" && hasGemini)
                {
                    logger.LogInformation("Attempting Gemini AI Standby extraction. Key: {MaskedKey}", MaskKey(geminiKey));
                    var result = await ExtractWithGeminiAsync(client, geminiKey, mimeType, base64Data, request.HintType, ct);
                    if (result != null && result.ExtractedFields.Count > 0)
                    {
                        result.ExecutionTimeMs = sw.ElapsedMilliseconds;
                        return result;
                    }
                }
                else if (provider == "azure" && hasAzure)
                {
                    logger.LogInformation("Attempting Azure Document Intelligence extraction. Endpoint: {Endpoint}, Key: {MaskedKey}",
                        azureEndpoint, MaskKey(azureKey));
                    var result = await ExtractWithAzureAsync(client, azureEndpoint, azureKey, base64Data, request.HintType, ct);
                    if (result != null && result.ExtractedFields.Count > 0)
                    {
                        result.ExecutionTimeMs = sw.ElapsedMilliseconds;
                        return result;
                    }
                }
                else if (provider == "openai" && hasOpenAi)
                {
                    logger.LogInformation("Attempting OpenAI GPT-4o extraction. Key: {MaskedKey}", MaskKey(openAiKey));
                    var result = await ExtractWithOpenAiAsync(client, openAiKey, request.ImageDataUrl, mimeType, base64Data, request.HintType, ct);
                    if (result != null && result.ExtractedFields.Count > 0)
                    {
                        result.ExecutionTimeMs = sw.ElapsedMilliseconds;
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                var errorMsg = $"Provider [{provider}] failed: {ex.Message}";
                logger.LogWarning("{Error}", errorMsg);
                accumulatedErrors.Add(errorMsg);
            }
        }

        return new AiExtractResponseDto
        {
            Success = false,
            ProviderUsed = "none",
            ErrorMessage = accumulatedErrors.Count > 0
                ? string.Join(" | ", accumulatedErrors)
                : "All configured AI providers produced empty results or were unavailable.",
            ExecutionTimeMs = sw.ElapsedMilliseconds
        };
    }

    private async Task<AiExtractResponseDto?> ExtractWithGeminiAsync(
        HttpClient client,
        string apiKey,
        string mimeType,
        string base64Data,
        string? hintType,
        CancellationToken ct)
    {
        string endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";

        string prompt =
            "You are an expert identity document OCR parser for official Philippine identification cards " +
            "(PhilSys National ID, Driver's License, Passport, UMID, Postal ID, PRC, Voter's ID, Senior Citizen, PWD). " +
            (string.IsNullOrWhiteSpace(hintType) ? "" : $"The expected document type hint is: {hintType}. ") +
            "Extract structured fields and return ONLY a single valid JSON object with the following schema:\n" +
            "{\n" +
            "  \"IdType\": \"PH_NATIONAL_ID | DRIVERS_LICENSE | PASSPORT | UMID | POSTAL_ID | UNKNOWN\",\n" +
            "  \"FullName\": { \"Value\": \"...\", \"Confidence\": 0.98 },\n" +
            "  \"IdNumber\": { \"Value\": \"...\", \"Confidence\": 0.98 },\n" +
            "  \"DateOfBirth\": { \"Value\": \"YYYY-MM-DD\", \"Confidence\": 0.95 },\n" +
            "  \"ExpirationDate\": { \"Value\": \"YYYY-MM-DD\", \"Confidence\": 0.95 },\n" +
            "  \"Address\": { \"Value\": \"...\", \"Confidence\": 0.92 },\n" +
            "  \"Sex\": { \"Value\": \"MALE | FEMALE\", \"Confidence\": 0.98 },\n" +
            "  \"RawText\": \"All visible text on card\"\n" +
            "}\n" +
            "If a field is not present or illegible, leave Value as empty string \"\". Output pure JSON only, without markdown fences.";

        var payload = new JsonObject
        {
            ["contents"] = new JsonArray
            {
                new JsonObject
                {
                    ["parts"] = new JsonArray
                    {
                        new JsonObject { ["text"] = prompt },
                        new JsonObject
                        {
                            ["inline_data"] = new JsonObject
                            {
                                ["mime_type"] = mimeType,
                                ["data"] = base64Data
                            }
                        }
                    }
                }
            },
            ["generationConfig"] = new JsonObject
            {
                ["responseMimeType"] = "application/json",
                ["temperature"] = 0.1
            }
        };

        using var content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(endpoint, content, ct);

        if (!response.IsSuccessStatusCode)
        {
            string err = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning("Gemini API returned status {StatusCode}: {Error}", response.StatusCode, err);
            return null;
        }

        string responseJson = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(responseJson);

        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
        {
            return null;
        }

        var firstCandidate = candidates[0];
        if (!firstCandidate.TryGetProperty("content", out var candidateContent) ||
            !candidateContent.TryGetProperty("parts", out var parts) ||
            parts.GetArrayLength() == 0)
        {
            return null;
        }

        string rawAiText = parts[0].GetProperty("text").GetString() ?? string.Empty;
        return ParseStructuredAiJson(rawAiText, "gemini", hintType);
    }

    private async Task<AiExtractResponseDto?> ExtractWithOpenAiAsync(
        HttpClient client,
        string apiKey,
        string fullDataUrl,
        string mimeType,
        string base64Data,
        string? hintType,
        CancellationToken ct)
    {
        string endpoint = "https://api.openai.com/v1/chat/completions";

        string imageUri = fullDataUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase)
            ? fullDataUrl
            : $"data:{mimeType};base64,{base64Data}";

        string systemPrompt =
            "You are an official ID verification system specialized in Philippine Identification Cards. " +
            "Extract identity fields into JSON with properties: IdType, FullName, IdNumber, DateOfBirth, ExpirationDate, Address, Sex, RawText. " +
            "Each identity field must be an object with 'Value' (string) and 'Confidence' (number between 0.0 and 1.0). " +
            (string.IsNullOrWhiteSpace(hintType) ? "" : $"Hint: Document type is likely {hintType}. ");

        var payload = new JsonObject
        {
            ["model"] = "gpt-4o",
            ["temperature"] = 0.1,
            ["response_format"] = new JsonObject { ["type"] = "json_object" },
            ["messages"] = new JsonArray
            {
                new JsonObject
                {
                    ["role"] = "system",
                    ["content"] = systemPrompt
                },
                new JsonObject
                {
                    ["role"] = "user",
                    ["content"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["type"] = "text",
                            ["text"] = "Extract structured identification fields from this Philippine government ID image."
                        },
                        new JsonObject
                        {
                            ["type"] = "image_url",
                            ["image_url"] = new JsonObject
                            {
                                ["url"] = imageUri
                            }
                        }
                    }
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            string err = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning("OpenAI API returned status {StatusCode}: {Error}", response.StatusCode, err);
            return null;
        }

        string responseJson = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(responseJson);

        if (!doc.RootElement.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
        {
            return null;
        }

        string contentText = choices[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
        return ParseStructuredAiJson(contentText, "openai", hintType);
    }

    private async Task<AiExtractResponseDto?> ExtractWithAzureAsync(
        HttpClient client,
        string endpoint,
        string apiKey,
        string base64Data,
        string? hintType,
        CancellationToken ct)
    {
        string normalizedEndpoint = endpoint.TrimEnd('/');
        string analyzeUrl = $"{normalizedEndpoint}/documentintelligence/documentModels/prebuilt-idDocument:analyze?api-version=2024-02-29-preview";

        var payload = new JsonObject
        {
            ["base64Source"] = base64Data
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, analyzeUrl);
        request.Headers.Add("Ocp-Apim-Subscription-Key", apiKey);
        request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            string err = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning("Azure Document Intelligence returned {StatusCode}: {Error}", response.StatusCode, err);
            return null;
        }

        if (response.Headers.TryGetValues("Operation-Location", out var opValues))
        {
            string? pollUrl = opValues.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(pollUrl))
            {
                var pollResult = await PollAzureOperationAsync(client, pollUrl, apiKey, ct);
                if (pollResult != null)
                {
                    return ParseAzureAnalyzeResult(pollResult, hintType);
                }
            }
        }

        string responseJson = await response.Content.ReadAsStringAsync(ct);
        return ParseAzureAnalyzeResult(responseJson, hintType);
    }

    private async Task<string?> PollAzureOperationAsync(
        HttpClient client,
        string pollUrl,
        string apiKey,
        CancellationToken ct)
    {
        for (int i = 0; i < 20; i++)
        {
            await Task.Delay(500, ct);
            using var req = new HttpRequestMessage(HttpMethod.Get, pollUrl);
            req.Headers.Add("Ocp-Apim-Subscription-Key", apiKey);

            using var res = await client.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) break;

            string body = await res.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("status", out var statusProp))
            {
                string status = statusProp.GetString() ?? string.Empty;
                if (string.Equals(status, "succeeded", StringComparison.OrdinalIgnoreCase))
                {
                    return body;
                }
                if (string.Equals(status, "failed", StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogWarning("Azure analyze operation status: failed");
                    return null;
                }
            }
        }
        return null;
    }

    private static AiExtractResponseDto? ParseAzureAnalyzeResult(string json, string? hintType)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("analyzeResult", out var analyzeResult))
            {
                return null;
            }

            string rawText = analyzeResult.TryGetProperty("content", out var contentProp)
                ? contentProp.GetString() ?? string.Empty
                : string.Empty;

            var fields = new Dictionary<string, ExtractedFieldDto>(StringComparer.OrdinalIgnoreCase);
            string detectedType = hintType ?? "UNKNOWN";

            if (analyzeResult.TryGetProperty("documents", out var docs) && docs.GetArrayLength() > 0)
            {
                var firstDoc = docs[0];
                if (firstDoc.TryGetProperty("docType", out var docTypeProp))
                {
                    detectedType = MapAzureDocType(docTypeProp.GetString() ?? "");
                }

                if (firstDoc.TryGetProperty("fields", out var fieldsElem))
                {
                    string firstName = GetAzureFieldValue(fieldsElem, "FirstName", out var fnConf);
                    string lastName = GetAzureFieldValue(fieldsElem, "LastName", out var lnConf);
                    string fullName = string.Join(" ", new[] { firstName, lastName }.Where(s => !string.IsNullOrWhiteSpace(s)));
                    if (string.IsNullOrWhiteSpace(fullName))
                    {
                        fullName = GetAzureFieldValue(fieldsElem, "FullName", out fnConf);
                    }
                    if (!string.IsNullOrWhiteSpace(fullName))
                    {
                        fields["FullName"] = new ExtractedFieldDto(fullName, Math.Max(fnConf, lnConf));
                    }

                    AssignAzureField(fields, fieldsElem, "DocumentNumber", "IdNumber");
                    AssignAzureField(fields, fieldsElem, "DateOfBirth", "DateOfBirth");
                    AssignAzureField(fields, fieldsElem, "DateOfExpiration", "ExpirationDate");
                    AssignAzureField(fields, fieldsElem, "Address", "Address");
                    AssignAzureField(fields, fieldsElem, "Sex", "Sex");
                }
            }

            return new AiExtractResponseDto
            {
                Success = fields.Count > 0,
                ProviderUsed = "azure",
                IdType = detectedType,
                ExtractedFields = fields,
                RawText = rawText
            };
        }
        catch
        {
            return null;
        }
    }

    private static void AssignAzureField(
        Dictionary<string, ExtractedFieldDto> target,
        JsonElement azureFields,
        string azureKey,
        string targetKey)
    {
        string val = GetAzureFieldValue(azureFields, azureKey, out var conf);
        if (!string.IsNullOrWhiteSpace(val))
        {
            target[targetKey] = new ExtractedFieldDto(val, conf);
        }
    }

    private static string GetAzureFieldValue(JsonElement fieldsElem, string propertyName, out double confidence)
    {
        confidence = 0.90;
        if (fieldsElem.TryGetProperty(propertyName, out var prop))
        {
            if (prop.TryGetProperty("confidence", out var confElem) && confElem.TryGetDouble(out var c))
            {
                confidence = c;
            }
            if (prop.TryGetProperty("valueString", out var valStr))
            {
                return valStr.GetString() ?? string.Empty;
            }
            if (prop.TryGetProperty("content", out var contentElem))
            {
                return contentElem.GetString() ?? string.Empty;
            }
        }
        return string.Empty;
    }

    private static string MapAzureDocType(string azureDocType) =>
        azureDocType.ToLowerInvariant() switch
        {
            var s when s.Contains("driverlicense") => "DRIVERS_LICENSE",
            var s when s.Contains("passport") => "PASSPORT",
            var s when s.Contains("nationalidentity") => "PH_NATIONAL_ID",
            _ => "PH_GOVERNMENT_ID"
        };

    private static AiExtractResponseDto? ParseStructuredAiJson(string rawText, string provider, string? hintType)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return null;

        string cleanJson = CleanJsonFences(rawText);

        try
        {
            using var doc = JsonDocument.Parse(cleanJson);
            var root = doc.RootElement;
            var fields = new Dictionary<string, ExtractedFieldDto>(StringComparer.OrdinalIgnoreCase);

            foreach (var coreKey in CoreIdFields)
            {
                if (root.TryGetProperty(coreKey, out var prop) ||
                    root.TryGetProperty(coreKey.ToLowerInvariant(), out prop))
                {
                    ReadFieldProperty(fields, coreKey, prop);
                }
            }

            string idType = hintType ?? "UNKNOWN";
            if (root.TryGetProperty("IdType", out var typeProp) || root.TryGetProperty("idType", out typeProp))
            {
                idType = typeProp.GetString() ?? idType;
            }

            string fullRaw = rawText;
            if (root.TryGetProperty("RawText", out var rawProp) || root.TryGetProperty("rawText", out rawProp))
            {
                fullRaw = rawProp.GetString() ?? rawText;
            }

            return new AiExtractResponseDto
            {
                Success = fields.Count > 0,
                ProviderUsed = provider,
                IdType = idType,
                ExtractedFields = fields,
                RawText = fullRaw
            };
        }
        catch
        {
            return null;
        }
    }

    private static void ReadFieldProperty(
        Dictionary<string, ExtractedFieldDto> fields,
        string key,
        JsonElement element,
        double fallbackConfidence = 0.95)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            string val = string.Empty;
            double conf = fallbackConfidence;

            if (element.TryGetProperty("Value", out var valProp) || element.TryGetProperty("value", out valProp))
            {
                val = valProp.GetString() ?? string.Empty;
            }

            if (element.TryGetProperty("Confidence", out var confProp) || element.TryGetProperty("confidence", out confProp))
            {
                if (confProp.TryGetDouble(out var parsedConf))
                {
                    conf = parsedConf;
                }
            }

            if (!string.IsNullOrWhiteSpace(val))
            {
                fields[key] = new ExtractedFieldDto(val.Trim(), conf);
            }
        }
        else if (element.ValueKind == JsonValueKind.String)
        {
            string? val = element.GetString();
            if (!string.IsNullOrWhiteSpace(val))
            {
                fields[key] = new ExtractedFieldDto(val.Trim(), fallbackConfidence);
            }
        }
    }

    private static string CleanJsonFences(string input)
    {
        string trimmed = input.Trim();
        if (trimmed.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[7..];
        }
        else if (trimmed.StartsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[3..];
        }

        if (trimmed.EndsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[..^3];
        }

        return trimmed.Trim();
    }

    private static (string MimeType, string Base64Data) ParseDataUrl(string dataUrl)
    {
        if (dataUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            int semiIdx = dataUrl.IndexOf(';');
            int commaIdx = dataUrl.IndexOf(',');
            if (semiIdx > 5 && commaIdx > semiIdx)
            {
                string mime = dataUrl[5..semiIdx];
                string base64 = dataUrl[(commaIdx + 1)..];
                return (mime, base64);
            }
        }
        return ("image/jpeg", dataUrl);
    }

    private string GetSecret(string key) =>
        Environment.GetEnvironmentVariable(key) ?? configuration[key] ?? string.Empty;

    private static string MaskKey(string? key) =>
        string.IsNullOrWhiteSpace(key)
            ? "[NONE]"
            : key.Length > 8
                ? $"{key[..4]}...{key[^4..]}"
                : "***";

    private string ResolveActiveChainSummary()
    {
        var active = new List<string>();
        if (!string.IsNullOrWhiteSpace(GetSecret("GEMINI_API_KEY"))) active.Add("gemini");
        if (!string.IsNullOrWhiteSpace(GetSecret("AZURE_VISION_KEY")) && !string.IsNullOrWhiteSpace(GetSecret("AZURE_VISION_ENDPOINT"))) active.Add("azure");
        if (!string.IsNullOrWhiteSpace(GetSecret("OPENAI_API_KEY"))) active.Add("openai");

        return active.Count > 0 ? string.Join(", ", active) : "deterministic-standby";
    }

    private static IdentityDocumentAnalyzeResponseDto ExecuteDeterministicDocumentAnalysis(IdentityDocumentAnalyzeRequestDto request)
    {
        string rawFront = (request.FrontRawText ?? string.Empty).ToUpperInvariant();
        string rawBack = (request.BackRawText ?? string.Empty).ToUpperInvariant();
        string combined = $"{rawFront}\n{rawBack}".Trim();
        string selectedCat = (request.SelectedIdCategory ?? "unknown").Trim().ToLowerInvariant();

        var response = new IdentityDocumentAnalyzeResponseDto
        {
            CategoryKey = selectedCat,
            OfficialVerificationStatus = "not_checked",
            AllowBiometricProfiling = selectedCat != "pwd"
        };

        if (combined.Contains("P<PHL") || combined.Contains("PASAPORTE") || selectedCat == "passport")
        {
            response.CategoryKey = "passport";
            response.DocumentFamily = "Philippine Passport";
            response.Issuer = "DFA";
            response.Version = "icao-9303-td3-v1";
            response.DetectedSide = "data-page";
            response.TemplateId = "PH-DFA-PASSPORT-TD3-DATAPAGE";
            response.CalibratedConfidence = combined.Contains("P<PHL") ? 0.94 : 0.78;
        }
        else if (combined.Contains("DRIVER'S LICENSE") || combined.Contains("LAND TRANSPORTATION OFFICE") || selectedCat == "drivers")
        {
            response.CategoryKey = "drivers";
            response.DocumentFamily = "LTO Driver's License";
            response.Issuer = "LTO";
            bool isLegacy = combined.Contains("RESTRICTIONS") && !combined.Contains("DL CODES");
            response.Version = isLegacy ? "legacy-restrictions-v1" : "2021-dl-code-v1";
            response.DetectedSide = !string.IsNullOrWhiteSpace(rawFront) ? "front" : (!string.IsNullOrWhiteSpace(rawBack) ? "back" : "front");
            response.TemplateId = isLegacy ? "PH-LTO-DL-OLD-FRONT" : "PH-LTO-DL-2021-NEW-FRONT";
            response.CalibratedConfidence = combined.Contains("LAND TRANSPORTATION OFFICE") ? 0.92 : 0.76;
        }
        else if (combined.Contains("PAMBANSANG PAGKAKAKILANLAN") || combined.Contains("PHILIPPINE IDENTIFICATION") || selectedCat == "philsys")
        {
            response.CategoryKey = "philsys";
            response.DocumentFamily = "PhilSys National ID";
            response.Issuer = "PSA";
            bool isPaper = combined.Contains("EPHILID");
            bool isDigital = combined.Contains("DIGITAL NATIONAL ID");
            response.Version = isPaper ? "ephilid-paper-v1" : (isDigital ? "digital-national-id-v1" : "pvc-v1");
            response.DetectedSide = isPaper || isDigital ? "document" : "front";
            response.TemplateId = isPaper ? "PH-PSA-EPHILID-PAPER" : (isDigital ? "PH-PSA-NATIONAL-ID-DIGITAL" : "PH-PSA-PHILSYS-PVC-FRONT");
            response.CalibratedConfidence = combined.Contains("PAMBANSANG PAGKAKAKILANLAN") ? 0.93 : 0.78;
        }
        else if (combined.Contains("PERSONS WITH DISABILITY") || combined.Contains("NCDA") || selectedCat == "pwd")
        {
            response.CategoryKey = "pwd";
            response.DocumentFamily = "PWD ID";
            response.Issuer = "NCDA / LGU PDAO";
            bool isUnified = combined.Contains("NCDA") || combined.Contains("AO NO. 001") || combined.Contains("UNIFIED");
            response.Version = isUnified ? "ncda-ao001-2026-unified-v1" : "lgu-legacy-pwd-v1";
            response.DetectedSide = "front";
            response.TemplateId = isUnified ? "PH-NCDA-PWD-ID-2026-UNIFIED" : "PH-NCDA-PWD-ID-LEGACY-LGU";
            response.AllowBiometricProfiling = false;
            response.CalibratedConfidence = 0.86;
            response.Warnings.Add("NCDA AO No. 001 (2026): PWD cardholder portrait is restricted from automated facial profiling.");
        }
        else if (combined.Contains("PROFESSIONAL REGULATION COMMISSION") || selectedCat == "prc")
        {
            response.CategoryKey = "prc";
            response.DocumentFamily = "PRC Professional Identification Card";
            response.Issuer = "PRC";
            response.Version = combined.Contains("E-PIC") ? "prc-epic-digital-v1" : "prc-pic-v1";
            response.DetectedSide = combined.Contains("E-PIC") ? "document" : "front";
            response.TemplateId = combined.Contains("E-PIC") ? "PH-PRC-EPIC-DIGITAL" : "PH-PRC-PIC-FRONT";
            response.CalibratedConfidence = 0.88;
        }
        else if (combined.Contains("UNIFIED MULTI-PURPOSE") || combined.Contains("CRN") || selectedCat == "umid")
        {
            response.CategoryKey = "umid";
            response.DocumentFamily = "Unified Multi-Purpose ID (UMID)";
            response.Issuer = "SSS / GSIS / PhilHealth / Pag-IBIG";
            response.Version = "umid-crn-v1";
            response.DetectedSide = "front";
            response.TemplateId = "PH-UMID-GENERIC-FRONT";
            response.CalibratedConfidence = 0.88;
        }
        else
        {
            response.DocumentFamily = string.IsNullOrWhiteSpace(selectedCat) || selectedCat == "unknown"
                ? "Unclassified Philippine Document"
                : selectedCat.ToUpperInvariant();
            response.Issuer = "Republic of the Philippines";
            response.Version = "generic-v1";
            response.DetectedSide = "front";
            response.TemplateId = $"PH-{response.CategoryKey.ToUpperInvariant()}-GENERIC";
            response.CalibratedConfidence = !string.IsNullOrWhiteSpace(combined) ? 0.72 : 0.45;
        }

        if (request.ExtractedFields != null)
        {
            foreach (var kvp in request.ExtractedFields)
            {
                if (!string.IsNullOrWhiteSpace(kvp.Value))
                {
                    response.NormalizedFields[kvp.Key] = kvp.Value.Trim();
                }
            }
        }

        response.OverallStatus = response.CalibratedConfidence >= 0.80
            ? "READY_FOR_PREFILL"
            : (response.CategoryKey == "unknown" ? "UNSUPPORTED_DOCUMENT" : "OCR_NEEDS_REVIEW");

        return response;
    }
}
