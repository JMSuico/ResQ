// [Layer: Backend/Services/Verification]
// Responsibility: Shared Government ID forensic authenticity, side-slot, ID-type, and Face-to-Gov-ID portrait matching strategies via IClaudeMessagesClient.
// Invariant: C# .NET 10, nullable reference types, universal lambda expressions (=>), zero dummy PII fallbacks, zero emojis.

using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Backend.Features.Api.DTOs;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Interfaces;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Backend.Features.Services.Verification;

public sealed record GovIdAuthenticityInput(
    byte[]? FrontBytes,
    string FrontMimeType,
    byte[]? BackBytes,
    string? BackMimeType,
    string SelectedIdType,
    string? PreferredModel = null,
    bool RequireDualSideVerification = true);

public sealed record GovIdForensicsResult(
    bool Success,
    bool IsGenuineId,
    string AuthenticityVerdict,
    string? AuthenticityReason,
    string? DetectedIdType,
    string? DetectedIdLabel,
    bool MatchesSelectedIdType,
    string? FrontSlotDetectedSide,
    string? BackSlotDetectedSide,
    bool AreSidesIdentical,
    string? ImagePairSha256,
    bool RequiresPendingManualReview,
    string? ErrorCode,
    string? ErrorMessage,
    string ProviderUsed,
    string? ModelUsed,
    double Confidence,
    string RawJson,
    AiOcrFieldsDto? Fields,
    string? RawText,
    List<string> Warnings);

public sealed record FaceToGovIdMatchInput(
    byte[]? FrontIdBytes,
    string FrontIdMimeType,
    byte[]? LiveFacialBytes,
    string LiveFacialMimeType,
    string? IdVerificationToken,
    string? PoseFramesJson,
    string? GeometricSignatureJson,
    int BlurVariance,
    double LivenessConfidence,
    string? PreferredModel = null);

public sealed record FaceToGovIdMatchResult(
    bool Success,
    bool IsLiveHuman,
    bool IsFaceMatchedToId,
    double FaceToIdSimilarity,
    bool IsAutoApproveEligible,
    bool RequiresPendingManualReview,
    string? FacialVerificationToken,
    string? ErrorCode,
    string? ErrorMessage,
    string ProviderUsed,
    string? ModelUsed,
    double AuthenticityConfidence,
    string GeometryVerdict,
    List<string> Diagnostics);

public interface IGovIdAuthenticityEvaluator
{
    Task<GovIdForensicsResult> EvaluateAsync(
        GovIdAuthenticityInput input,
        CancellationToken ct = default);
}

public interface IFaceToGovIdMatchStrategy
{
    Task<FaceToGovIdMatchResult> EvaluateMatchAsync(
        FaceToGovIdMatchInput input,
        CancellationToken ct = default);
}

public class SharedGovIdForensicsEvaluator(
    IConfiguration configuration,
    IClaudeMessagesClient? claudeClient = null,
    ILogger<SharedGovIdForensicsEvaluator>? logger = null) : IGovIdAuthenticityEvaluator
{
    private readonly IClaudeMessagesClient _claudeClient =
        claudeClient ?? new ClaudeMessagesClient(null, configuration, NullLogger<ClaudeMessagesClient>.Instance);

    private readonly ILogger<SharedGovIdForensicsEvaluator> _logger =
        logger ?? NullLogger<SharedGovIdForensicsEvaluator>.Instance;

    internal static readonly string[] CoreIdFields =
    [
        "FullName",
        "FirstName",
        "MiddleName",
        "Surname",
        "Suffix",
        "IdNumber",
        "LicenseNumber",
        "DateOfBirth",
        "Age",
        "ExpirationDate",
        "Address",
        "Barangay",
        "Street",
        "CityOrMunicipality",
        "Province",
        "Sex",
        "Weight",
        "Height",
        "PhoneNumber",
        "RawText"
    ];

    private static readonly IReadOnlyDictionary<string, string[]> FieldAliases =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["FirstName"] = ["GivenName"],
            ["MiddleName"] = ["MiddleInitial"],
            ["Surname"] = ["LastName", "FamilyName"],
            ["DateOfBirth"] = ["Dob", "BirthDate"],
            ["Street"] = ["StreetOrPurok", "StreetPurok"],
            ["CityOrMunicipality"] = ["City", "Municipality"],
            ["Barangay"] = ["Brgy"],
            ["LicenseNumber"] = ["DocumentNumber"],
            ["IdNumber"] = ["SerialNumber"],
            ["PhoneNumber"] = ["Phone", "MobileNumber"]
        };

    private static readonly HashSet<string> SentinelEmptyTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "null",
        "nil",
        "none",
        "n/a",
        "na",
        "not available",
        "not visible",
        "unreadable",
        "illegible",
        "unknown",
        "-",
        "--",
        "---",
        "?",
        "yyyy-mm-dd",
        "male|female",
        "<null>",
        "<string>",
        "<string|null>",
        "<string or null>",
        "string or null"
    };

    public async Task<GovIdForensicsResult> EvaluateAsync(
        GovIdAuthenticityInput input,
        CancellationToken ct = default)
    {
        string pairSha = ComputeImagePairSha256(input.FrontBytes, input.BackBytes);

        if (input.FrontBytes is null || input.FrontBytes.Length == 0)
        {
            return BuildFailureResult(
                errorCode: "MISSING_FRONT_IMAGE",
                errorMessage: "Front Government ID image is required before running OCR.",
                authenticityVerdict: "UNREADABLE_OR_BLANK",
                detectedIdType: null,
                detectedIdLabel: null,
                matchesSelectedIdType: true,
                frontSlotSide: null,
                backSlotSide: null,
                areSidesIdentical: false,
                imagePairSha256: pairSha,
                requiresPendingManualReview: false,
                providerUsed: "DeterministicForensicPreFlight",
                modelUsed: null);
        }

        if (input.BackBytes is { Length: > 0 } && input.FrontBytes.AsSpan().SequenceEqual(input.BackBytes))
        {
            return BuildFailureResult(
                errorCode: "DUPLICATE_FRONT_BACK_IMAGE",
                errorMessage: "Invalid Government ID: The Back ID upload is identical to your Front ID image. Please upload the actual reverse side of your Government ID card.",
                authenticityVerdict: "DUPLICATE_FRONT_BACK_IMAGE",
                detectedIdType: null,
                detectedIdLabel: null,
                matchesSelectedIdType: true,
                frontSlotSide: null,
                backSlotSide: null,
                areSidesIdentical: true,
                imagePairSha256: pairSha,
                requiresPendingManualReview: false,
                providerUsed: "DeterministicForensicPreFlight",
                modelUsed: null,
                authenticityReason: "Front and Back Government ID uploads contain identical image bytes.");
        }

        if (input.RequireDualSideVerification && (input.BackBytes is null || input.BackBytes.Length == 0))
        {
            return BuildFailureResult(
                errorCode: "MISSING_BACK_IMAGE",
                errorMessage: "Back Government ID image is required for dual-side verification.",
                authenticityVerdict: "UNREADABLE_OR_BLANK",
                detectedIdType: null,
                detectedIdLabel: null,
                matchesSelectedIdType: true,
                frontSlotSide: null,
                backSlotSide: null,
                areSidesIdentical: false,
                imagePairSha256: pairSha,
                requiresPendingManualReview: false,
                providerUsed: "DeterministicForensicPreFlight",
                modelUsed: null);
        }

        if (!_claudeClient.IsConfigured)
        {
            return BuildFailureResult(
                errorCode: "PROVIDER_UNAVAILABLE",
                errorMessage: "Claude Vision verification service is not configured; proceed with pending manual review.",
                authenticityVerdict: "PROVIDER_UNAVAILABLE",
                detectedIdType: null,
                detectedIdLabel: null,
                matchesSelectedIdType: true,
                frontSlotSide: null,
                backSlotSide: null,
                areSidesIdentical: false,
                imagePairSha256: pairSha,
                requiresPendingManualReview: true,
                providerUsed: _claudeClient.PrimaryModel,
                modelUsed: _claudeClient.PrimaryModel);
        }

        var contentBlocks = new List<object>
        {
            new
            {
                type = "image",
                source = new
                {
                    type = "base64",
                    media_type = NormalizeClaudeMime(input.FrontMimeType),
                    data = Convert.ToBase64String(input.FrontBytes)
                }
            }
        };

        bool hasBackBytes = input.BackBytes is { Length: > 0 };
        if (hasBackBytes)
        {
            contentBlocks.Add(new
            {
                type = "image",
                source = new
                {
                    type = "base64",
                    media_type = NormalizeClaudeMime(input.BackMimeType ?? "image/jpeg"),
                    data = Convert.ToBase64String(input.BackBytes!)
                }
            });
        }

        contentBlocks.Add(new
        {
            type = "text",
            text = hasBackBytes
                ? "Image 1 is the Front ID slot and Image 2 is the Back ID slot. Inspect both for authenticity, side placement, ID category match against the selected hint, and transcribe ONLY text literally visible in the pixels."
                : "Inspect Image 1 for authenticity, side placement, ID category match against the selected hint, and transcribe ONLY text literally visible in the pixels."
        });

        var payloadWithoutModel = new Dictionary<string, object>
        {
            ["max_tokens"] = 1024,
            ["temperature"] = 0.0,
            ["system"] = new object[]
            {
                new
                {
                    type = "text",
                    text = BuildForensicSystemPrompt(input.SelectedIdType, hasBackBytes),
                    cache_control = new { type = "ephemeral" }
                }
            },
            ["messages"] = new object[]
            {
                new
                {
                    role = "user",
                    content = contentBlocks.ToArray()
                }
            }
        };

        ClaudeMessageAttemptResult attempt;
        try
        {
            attempt = await _claudeClient.SendMessagesAsync(payloadWithoutModel, ct, input.PreferredModel);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning("Claude forensics invocation failed ({Message}); flagging pending manual review.", ex.Message);
            return BuildFailureResult(
                errorCode: "PROVIDER_UNAVAILABLE",
                errorMessage: "Claude Vision verification service is temporarily unavailable; proceed with pending manual review.",
                authenticityVerdict: "PROVIDER_UNAVAILABLE",
                detectedIdType: null,
                detectedIdLabel: null,
                matchesSelectedIdType: true,
                frontSlotSide: null,
                backSlotSide: null,
                areSidesIdentical: false,
                imagePairSha256: pairSha,
                requiresPendingManualReview: true,
                providerUsed: _claudeClient.PrimaryModel,
                modelUsed: _claudeClient.PrimaryModel);
        }

        if (!attempt.Success)
        {
            _logger.LogWarning(
                "Claude forensics attempt returned failure ErrorCode={ErrorCode}, Status={StatusCode}, Model={Model}.",
                attempt.ErrorCode,
                attempt.HttpStatusCode,
                attempt.ModelUsed);

            return BuildFailureResult(
                errorCode: "PROVIDER_UNAVAILABLE",
                errorMessage: attempt.ErrorMessage ?? "Claude Vision verification service is unavailable; proceed with pending manual review.",
                authenticityVerdict: "PROVIDER_UNAVAILABLE",
                detectedIdType: null,
                detectedIdLabel: null,
                matchesSelectedIdType: true,
                frontSlotSide: null,
                backSlotSide: null,
                areSidesIdentical: false,
                imagePairSha256: pairSha,
                requiresPendingManualReview: true,
                providerUsed: attempt.ModelUsed,
                modelUsed: attempt.ModelUsed);
        }

        return ParseForensicOcrResponse(
            rawText: attempt.RawText ?? string.Empty,
            provider: attempt.ModelUsed,
            selectedIdType: input.SelectedIdType,
            hasBackBytes: hasBackBytes,
            imagePairSha256: pairSha);
    }

    internal static string BuildForensicSystemPrompt(string? selectedIdType, bool hasBackBytes = false) =>
        "Strict forensic verifier and OCR transcriber for Philippine Government IDs. " +
        (string.IsNullOrWhiteSpace(selectedIdType)
            ? string.Empty
            : $"Selected category: {selectedIdType} ({FormatIdTypeLabel(selectedIdType)}). ") +
        "MANDATORY RULES:\n" +
        "1. Authenticity: Verify a genuine physical Philippine Government ID. " +
        "Set isGenuineId=false and authenticityVerdict=\"SPECIMEN\" or \"FAKE_OR_AI_GENERATED\" if watermarks (SPECIMEN, SAMPLE, VOID, TEMPLATE), AI artifacts, synthetic overlays, or screen-replay moire appear. " +
        "Set isGenuineId=false and authenticityVerdict=\"NON_ID_DOCUMENT\" for a selfie, receipt, plain note, landscape, or non-ID document.\n" +
        "2. Side orientation: Image 1 MUST be FRONT (frontSlotDetectedSide: \"FRONT\"|\"BACK\"|\"UNKNOWN\"). " +
        (hasBackBytes ? "Image 2 MUST be BACK (backSlotDetectedSide: \"FRONT\"|\"BACK\"|\"UNKNOWN\"). " : string.Empty) +
        "Set areSidesIdentical=true if both slots depict the same image.\n" +
        "3. Category: Set detectedIdType to canonical key (drivers, philsys, passport, prc, umid, postal, voters, senior_citizen, pwd, sss, tin, philhealth, pagibig, gsis, owwa, solo_parent, barangay, fire, police, rhu, unknown) and detectedIdLabel. Set matchesSelectedIdType=false if the ID differs from the selected category.\n" +
        "4. Visible-only OCR: Transcribe ONLY characters literally visible in pixels. Set any unseen, absent, cropped, or illegible field to null. NEVER guess, compute, or fabricate names, dates, sexes, weights, heights, addresses, phone numbers, or ID numbers.\n" +
        "5. Blank/unreadable: If blank, solid color, too blurry, or lacking readable ID text, set unreadable=true and errorCode=\"UNREADABLE_OR_BLANK_IMAGE\".\n" +
        "6. Output ONLY one minified single-line JSON object (no newlines, no pretty indentation, no markdown fences, no prose; keep authenticityReason concise <= 12 words; use flat scalar strings/numbers inside \"fields\" and omit any key in \"fields\" whose value is unseen or null):\n" +
        "{\"unreadable\":false,\"isGenuineId\":true,\"authenticityVerdict\":\"GENUINE_PHYSICAL_ID\",\"authenticityReason\":null," +
        "\"detectedIdType\":\"<canonical key>\",\"detectedIdLabel\":\"<human label>\",\"matchesSelectedIdType\":true," +
        "\"frontSlotDetectedSide\":\"FRONT\",\"backSlotDetectedSide\":\"BACK\",\"areSidesIdentical\":false," +
        "\"errorCode\":null,\"confidence\":0.95,\"IdType\":\"<visible ID type code>\"," +
        "\"fields\":{\"IdNumber\":\"...\",\"LicenseNumber\":\"...\",\"FirstName\":\"...\",\"MiddleName\":\"...\"," +
        "\"Surname\":\"...\",\"Suffix\":\"...\",\"FullName\":\"...\",\"DateOfBirth\":\"YYYY-MM-DD\"," +
        "\"ExpirationDate\":\"YYYY-MM-DD\",\"Sex\":\"Male|Female\",\"Street\":\"...\",\"Barangay\":\"...\"," +
        "\"CityOrMunicipality\":\"...\",\"Province\":\"...\",\"Address\":\"...\",\"Weight\":\"...\",\"Height\":\"...\",\"PhoneNumber\":\"...\"}}";

    internal static GovIdForensicsResult ParseForensicOcrResponse(
        string rawText,
        string provider,
        string? selectedIdType,
        bool hasBackBytes,
        string imagePairSha256)
    {
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return BuildFailureResult(
                errorCode: "UNREADABLE_OR_BLANK_IMAGE",
                errorMessage: "AI vision OCR returned an empty response.",
                authenticityVerdict: "UNREADABLE_OR_BLANK",
                detectedIdType: null,
                detectedIdLabel: null,
                matchesSelectedIdType: true,
                frontSlotSide: null,
                backSlotSide: null,
                areSidesIdentical: false,
                imagePairSha256: imagePairSha256,
                requiresPendingManualReview: false,
                providerUsed: provider,
                modelUsed: provider);
        }

        string cleanJson = CleanJsonFences(rawText);

        try
        {
            using var doc = JsonDocument.Parse(cleanJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return BuildFailureResult(
                    "UNREADABLE_OR_BLANK_IMAGE",
                    "AI response was not a JSON object.",
                    "UNREADABLE_OR_BLANK",
                    null,
                    null,
                    true,
                    null,
                    null,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider);
            }

            bool? unreadable = TryReadOptionalBool(root, "unreadable");
            bool? explicitSuccess = TryReadOptionalBool(root, "success");
            string? reportedErrorCode = TryReadOptionalString(root, "errorCode");
            string? reportedErrorMessage = TryReadOptionalString(root, "errorMessage");
            bool? explicitIsGenuineId = TryReadOptionalBool(root, "isGenuineId");
            string? authenticityVerdict = TryReadOptionalString(root, "authenticityVerdict");
            string? authenticityReason = TryReadOptionalString(root, "authenticityReason");
            string? detectedIdType = TryReadOptionalString(root, "detectedIdType") ?? TryReadOptionalString(root, "IdType");
            string? detectedIdLabel = TryReadOptionalString(root, "detectedIdLabel");
            bool? explicitMatchesSelectedType = TryReadOptionalBool(root, "matchesSelectedIdType");
            string? frontSlotSide = NormalizeSlotSide(TryReadOptionalString(root, "frontSlotDetectedSide"));
            string? backSlotSide = NormalizeSlotSide(TryReadOptionalString(root, "backSlotDetectedSide"));
            bool areSidesIdentical = TryReadOptionalBool(root, "areSidesIdentical") ?? false;

            if (areSidesIdentical || string.Equals(reportedErrorCode, "DUPLICATE_FRONT_BACK_IMAGE", StringComparison.OrdinalIgnoreCase))
            {
                return BuildFailureResult(
                    "DUPLICATE_FRONT_BACK_IMAGE",
                    reportedErrorMessage ?? "Invalid Government ID: The Back ID upload is identical to your Front ID image. Please upload the actual reverse side of your Government ID card.",
                    authenticityVerdict ?? "DUPLICATE_FRONT_BACK_IMAGE",
                    detectedIdType,
                    detectedIdLabel,
                    explicitMatchesSelectedType ?? true,
                    frontSlotSide,
                    backSlotSide,
                    areSidesIdentical: true,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            if (string.Equals(frontSlotSide, "BACK", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(reportedErrorCode, "WRONG_ID_SIDE_FRONT_EXPECTED", StringComparison.OrdinalIgnoreCase))
            {
                return BuildFailureResult(
                    "WRONG_ID_SIDE_FRONT_EXPECTED",
                    reportedErrorMessage ?? "Invalid Government ID: You uploaded the Back side of your Government ID in the Front ID slot. Please upload the Front side showing your photo and identity details.",
                    authenticityVerdict ?? "WRONG_ID_SIDE",
                    detectedIdType,
                    detectedIdLabel,
                    explicitMatchesSelectedType ?? true,
                    frontSlotSide ?? "BACK",
                    backSlotSide,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            if ((hasBackBytes && string.Equals(backSlotSide, "FRONT", StringComparison.OrdinalIgnoreCase)) ||
                string.Equals(reportedErrorCode, "WRONG_ID_SIDE_BACK_EXPECTED", StringComparison.OrdinalIgnoreCase))
            {
                return BuildFailureResult(
                    "WRONG_ID_SIDE_BACK_EXPECTED",
                    reportedErrorMessage ?? "Invalid Government ID: You uploaded the Front side of your Government ID in the Back ID slot. Please upload the Back side of your card.",
                    authenticityVerdict ?? "WRONG_ID_SIDE",
                    detectedIdType,
                    detectedIdLabel,
                    explicitMatchesSelectedType ?? true,
                    frontSlotSide,
                    backSlotSide ?? "FRONT",
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            if (unreadable == true ||
                reportedErrorCode is not null && (
                    reportedErrorCode.Equals("UNREADABLE_OR_BLANK_IMAGE", StringComparison.OrdinalIgnoreCase) ||
                    reportedErrorCode.Equals("INSUFFICIENT_VISIBLE_TEXT", StringComparison.OrdinalIgnoreCase) ||
                    reportedErrorCode.Equals("MISSING_FRONT_IMAGE", StringComparison.OrdinalIgnoreCase) ||
                    reportedErrorCode.Equals("MISSING_BACK_IMAGE", StringComparison.OrdinalIgnoreCase)))
            {
                string code = string.IsNullOrWhiteSpace(reportedErrorCode)
                    ? "UNREADABLE_OR_BLANK_IMAGE"
                    : reportedErrorCode.Trim().ToUpperInvariant();
                return BuildFailureResult(
                    code,
                    reportedErrorMessage ?? "The uploaded Government ID image is blank, blurry, or contains no readable text.",
                    authenticityVerdict ?? "UNREADABLE_OR_BLANK",
                    detectedIdType,
                    detectedIdLabel,
                    explicitMatchesSelectedType ?? true,
                    frontSlotSide,
                    backSlotSide,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            string verdictUpper = (authenticityVerdict ?? string.Empty).Trim().ToUpperInvariant();
            bool isNonIdVerdict = verdictUpper.Contains("NON_ID", StringComparison.Ordinal) ||
                                  verdictUpper.Contains("SELFIE", StringComparison.Ordinal) ||
                                  verdictUpper.Contains("RECEIPT", StringComparison.Ordinal) ||
                                  verdictUpper.Contains("SCREENSHOT", StringComparison.Ordinal);

            if (string.Equals(reportedErrorCode, "NON_ID_DOCUMENT", StringComparison.OrdinalIgnoreCase) ||
                (explicitIsGenuineId == false && isNonIdVerdict) ||
                isNonIdVerdict)
            {
                return BuildFailureResult(
                    "NON_ID_DOCUMENT",
                    reportedErrorMessage ?? BuildNonIdMessage(authenticityReason),
                    authenticityVerdict ?? "NON_ID_DOCUMENT",
                    detectedIdType,
                    detectedIdLabel,
                    explicitMatchesSelectedType ?? true,
                    frontSlotSide,
                    backSlotSide,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            bool isUnreadableVerdict = verdictUpper.Contains("UNREADABLE", StringComparison.Ordinal) ||
                                       verdictUpper.Contains("BLANK", StringComparison.Ordinal);
            if (isUnreadableVerdict)
            {
                return BuildFailureResult(
                    "UNREADABLE_OR_BLANK_IMAGE",
                    reportedErrorMessage ?? "The uploaded Government ID image is blank, blurry, or contains no readable text.",
                    authenticityVerdict ?? "UNREADABLE_OR_BLANK",
                    detectedIdType,
                    detectedIdLabel,
                    explicitMatchesSelectedType ?? true,
                    frontSlotSide,
                    backSlotSide,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            bool isFakeVerdict = verdictUpper.Contains("FAKE", StringComparison.Ordinal) ||
                                 verdictUpper.Contains("SPECIMEN", StringComparison.Ordinal) ||
                                 verdictUpper.Contains("AI_GENERATED", StringComparison.Ordinal) ||
                                 verdictUpper.Contains("SYNTHETIC", StringComparison.Ordinal) ||
                                 verdictUpper.Contains("EDITED", StringComparison.Ordinal) ||
                                 verdictUpper.Contains("TEMPLATE", StringComparison.Ordinal) ||
                                 verdictUpper.Contains("TAMPERED", StringComparison.Ordinal);

            if (string.Equals(reportedErrorCode, "FAKE_OR_AI_GENERATED_ID", StringComparison.OrdinalIgnoreCase) ||
                explicitIsGenuineId == false ||
                isFakeVerdict)
            {
                return BuildFailureResult(
                    "FAKE_OR_AI_GENERATED_ID",
                    reportedErrorMessage ?? BuildFakeIdMessage(authenticityReason),
                    authenticityVerdict ?? "FAKE_OR_AI_GENERATED",
                    detectedIdType,
                    detectedIdLabel,
                    explicitMatchesSelectedType ?? true,
                    frontSlotSide,
                    backSlotSide,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            bool canonicalConflict = IsCanonicalIdTypeConflict(selectedIdType, detectedIdType);
            if (string.Equals(reportedErrorCode, "WRONG_GOVERNMENT_ID_TYPE", StringComparison.OrdinalIgnoreCase) ||
                explicitMatchesSelectedType == false ||
                canonicalConflict)
            {
                string detectedLabel = !string.IsNullOrWhiteSpace(detectedIdLabel)
                    ? detectedIdLabel!
                    : FormatIdTypeLabel(detectedIdType);
                return BuildFailureResult(
                    "WRONG_GOVERNMENT_ID_TYPE",
                    reportedErrorMessage ?? $"Invalid Government ID: The uploaded image appears to be a {detectedLabel}, which does not match your selected Government ID type ({FormatIdTypeLabel(selectedIdType)}). Please upload the matching ID or change your selected ID type.",
                    authenticityVerdict ?? "WRONG_GOVERNMENT_ID_TYPE",
                    detectedIdType,
                    detectedIdLabel,
                    matchesSelectedIdType: false,
                    frontSlotSide,
                    backSlotSide,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            if (explicitSuccess == false)
            {
                string fallbackCode = string.IsNullOrWhiteSpace(reportedErrorCode)
                    ? "UNREADABLE_OR_BLANK_IMAGE"
                    : reportedErrorCode.Trim().ToUpperInvariant();
                return BuildFailureResult(
                    fallbackCode,
                    reportedErrorMessage ?? "The uploaded Government ID image could not be verified.",
                    authenticityVerdict ?? "REJECTED",
                    detectedIdType,
                    detectedIdLabel,
                    true,
                    frontSlotSide,
                    backSlotSide,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            double? rootConfidence = null;
            if (TryGetPropertyCaseInsensitive(root, "confidence", out var confProp) &&
                confProp.ValueKind == JsonValueKind.Number &&
                confProp.TryGetDouble(out var parsedRootConf) &&
                double.IsFinite(parsedRootConf))
            {
                rootConfidence = Math.Clamp(parsedRootConf, 0.0, 1.0);
            }

            JsonElement? nestedFieldsObj = null;
            foreach (string containerKey in new[] { "fields", "extractedFields", "data" })
            {
                if (TryGetPropertyCaseInsensitive(root, containerKey, out var candidateObj) &&
                    candidateObj.ValueKind == JsonValueKind.Object)
                {
                    nestedFieldsObj = candidateObj;
                    break;
                }
            }

            var fields = new Dictionary<string, ExtractedFieldDto>(StringComparer.OrdinalIgnoreCase);
            var explicitConfidences = new List<double>();

            foreach (var coreKey in CoreIdFields)
            {
                if (TryFindFieldElement(root, nestedFieldsObj, coreKey, out var prop))
                {
                    var parsed = ReadFieldProperty(prop, rootConfidence);
                    if (parsed.HasValue)
                    {
                        fields[coreKey] = parsed.Value.Field;
                        if (parsed.Value.HasExplicitConfidence)
                        {
                            explicitConfidences.Add(parsed.Value.Field.Confidence);
                        }
                    }
                }
            }

            int visibleIdentityFieldCount = fields.Count(kvp =>
                !string.Equals(kvp.Key, "RawText", StringComparison.OrdinalIgnoreCase));

            if (visibleIdentityFieldCount == 0)
            {
                return BuildFailureResult(
                    "UNREADABLE_OR_BLANK_IMAGE",
                    "No readable identification fields were visible in the uploaded image.",
                    authenticityVerdict ?? "UNREADABLE_OR_BLANK",
                    detectedIdType,
                    detectedIdLabel,
                    true,
                    frontSlotSide,
                    backSlotSide,
                    false,
                    imagePairSha256,
                    false,
                    provider,
                    provider,
                    authenticityReason);
            }

            string? GetVisible(string key) =>
                fields.TryGetValue(key, out var dto) && !string.IsNullOrWhiteSpace(dto.Value)
                    ? dto.Value
                    : null;

            double computedConfidence = explicitConfidences.Count > 0
                ? Math.Clamp(Math.Round(explicitConfidences.Average(), 4), 0.0, 1.0)
                : (rootConfidence ?? 0.0);

            string? parsedIdType = CleanSentinelText(TryReadOptionalString(root, "IdType"));
            string? rawVisibleText = GetVisible("RawText");
            string canonicalDetected = CanonicalizeIdCategory(detectedIdType ?? parsedIdType ?? selectedIdType);

            var fieldsDto = new AiOcrFieldsDto
            {
                IdType = parsedIdType ?? NormalizeIdTypeCode(detectedIdType ?? selectedIdType),
                FirstName = GetVisible("FirstName"),
                MiddleName = GetVisible("MiddleName"),
                Surname = GetVisible("Surname"),
                Suffix = GetVisible("Suffix"),
                FullName = GetVisible("FullName"),
                DateOfBirth = GetVisible("DateOfBirth"),
                Age = GetVisible("Age"),
                ExpirationDate = GetVisible("ExpirationDate"),
                Sex = NormalizeVisibleSex(GetVisible("Sex")),
                LicenseNumber = GetVisible("LicenseNumber"),
                IdNumber = GetVisible("IdNumber"),
                Barangay = GetVisible("Barangay"),
                Street = GetVisible("Street"),
                CityOrMunicipality = GetVisible("CityOrMunicipality"),
                Province = GetVisible("Province"),
                Address = GetVisible("Address"),
                Weight = GetVisible("Weight"),
                Height = GetVisible("Height"),
                PhoneNumber = GetVisible("PhoneNumber"),
                RawText = rawVisibleText ?? rawText,
                ExtractedFields = fields
            };

            return new GovIdForensicsResult(
                Success: true,
                IsGenuineId: explicitIsGenuineId ?? true,
                AuthenticityVerdict: string.IsNullOrWhiteSpace(authenticityVerdict) ? "GENUINE_PHYSICAL_ID" : authenticityVerdict!,
                AuthenticityReason: authenticityReason,
                DetectedIdType: canonicalDetected == "unknown" ? detectedIdType : canonicalDetected,
                DetectedIdLabel: detectedIdLabel ?? FormatIdTypeLabel(canonicalDetected),
                MatchesSelectedIdType: true,
                FrontSlotDetectedSide: frontSlotSide,
                BackSlotDetectedSide: backSlotSide,
                AreSidesIdentical: false,
                ImagePairSha256: imagePairSha256,
                RequiresPendingManualReview: false,
                ErrorCode: null,
                ErrorMessage: null,
                ProviderUsed: provider,
                ModelUsed: provider,
                Confidence: computedConfidence,
                RawJson: cleanJson,
                Fields: fieldsDto,
                RawText: rawVisibleText ?? rawText,
                Warnings: []);
        }
        catch (JsonException)
        {
            return BuildFailureResult(
                "UNREADABLE_OR_BLANK_IMAGE",
                "AI OCR response could not be parsed as structured JSON.",
                "UNREADABLE_OR_BLANK",
                null,
                null,
                true,
                null,
                null,
                false,
                imagePairSha256,
                false,
                provider,
                provider);
        }
    }

    private static string BuildNonIdMessage(string? authenticityReason) =>
        string.IsNullOrWhiteSpace(authenticityReason)
            ? "Invalid Government ID: The uploaded image does not appear to be a valid Philippine Government ID document."
            : $"Invalid Government ID: The uploaded image does not appear to be a valid Philippine Government ID document ({authenticityReason}).";

    private static string BuildFakeIdMessage(string? authenticityReason) =>
        string.IsNullOrWhiteSpace(authenticityReason)
            ? "Invalid Government ID: Security validation flagged this upload as a fabricated, altered, specimen, or AI-generated image. Please upload clear photos of your real physical Government ID."
            : $"Invalid Government ID: Security validation flagged this upload as a fabricated, altered, specimen, or AI-generated image ({authenticityReason}). Please upload clear photos of your real physical Government ID.";

    private static GovIdForensicsResult BuildFailureResult(
        string errorCode,
        string errorMessage,
        string authenticityVerdict,
        string? detectedIdType,
        string? detectedIdLabel,
        bool matchesSelectedIdType,
        string? frontSlotSide,
        string? backSlotSide,
        bool areSidesIdentical,
        string? imagePairSha256,
        bool requiresPendingManualReview,
        string providerUsed,
        string? modelUsed,
        string? authenticityReason = null) =>
        new(
            Success: false,
            IsGenuineId: false,
            AuthenticityVerdict: authenticityVerdict,
            AuthenticityReason: authenticityReason ?? errorMessage,
            DetectedIdType: detectedIdType,
            DetectedIdLabel: detectedIdLabel,
            MatchesSelectedIdType: matchesSelectedIdType,
            FrontSlotDetectedSide: frontSlotSide,
            BackSlotDetectedSide: backSlotSide,
            AreSidesIdentical: areSidesIdentical,
            ImagePairSha256: imagePairSha256,
            RequiresPendingManualReview: requiresPendingManualReview,
            ErrorCode: errorCode,
            ErrorMessage: errorMessage,
            ProviderUsed: providerUsed,
            ModelUsed: modelUsed,
            Confidence: 0.0,
            RawJson: "{}",
            Fields: null,
            RawText: null,
            Warnings: [errorMessage]);

    internal static string ComputeImagePairSha256(byte[]? frontBytes, byte[]? backBytes)
    {
        byte[] frontHash = frontBytes is { Length: > 0 } ? SHA256.HashData(frontBytes) : [];
        byte[] backHash = backBytes is { Length: > 0 } ? SHA256.HashData(backBytes) : [];
        string combined = $"{Convert.ToHexString(frontHash)}|{Convert.ToHexString(backHash)}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(combined))).ToLowerInvariant();
    }

    internal static string CanonicalizeIdCategory(string? idType)
    {
        if (string.IsNullOrWhiteSpace(idType))
        {
            return "unknown";
        }

        string s = idType.Trim().ToLowerInvariant();
        return s switch
        {
            var x when x == "dl" || x.Contains("driver", StringComparison.Ordinal) || x.Contains("lto", StringComparison.Ordinal) => "drivers",
            var x when x.Contains("philsys", StringComparison.Ordinal) || x.Contains("national", StringComparison.Ordinal) || x.Contains("ephilid", StringComparison.Ordinal) || x.Contains("psa", StringComparison.Ordinal) => "philsys",
            var x when x.Contains("passport", StringComparison.Ordinal) || x.Contains("dfa", StringComparison.Ordinal) => "passport",
            var x when x.Contains("prc", StringComparison.Ordinal) || x.Contains("professional", StringComparison.Ordinal) => "prc",
            var x when x.Contains("umid", StringComparison.Ordinal) => "umid",
            var x when x.Contains("postal", StringComparison.Ordinal) || x.Contains("philpost", StringComparison.Ordinal) => "postal",
            var x when x.Contains("voter", StringComparison.Ordinal) || x.Contains("comelec", StringComparison.Ordinal) => "voters",
            var x when x.Contains("senior", StringComparison.Ordinal) || x.Contains("osca", StringComparison.Ordinal) => "senior_citizen",
            var x when x.Contains("pwd", StringComparison.Ordinal) || x.Contains("disability", StringComparison.Ordinal) || x.Contains("ncda", StringComparison.Ordinal) => "pwd",
            var x when x.Contains("sss", StringComparison.Ordinal) => "sss",
            var x when x is "tin" or "tin_id" or "tin id" || x.Contains("bir", StringComparison.Ordinal) || x.Contains("taxpayer", StringComparison.Ordinal) => "tin",
            var x when x.Contains("philhealth", StringComparison.Ordinal) => "philhealth",
            var x when x.Contains("pagibig", StringComparison.Ordinal) || x.Contains("pag-ibig", StringComparison.Ordinal) || x.Contains("hdmf", StringComparison.Ordinal) => "pagibig",
            var x when x.Contains("gsis", StringComparison.Ordinal) => "gsis",
            var x when x.Contains("owwa", StringComparison.Ordinal) => "owwa",
            var x when x.Contains("solo", StringComparison.Ordinal) => "solo_parent",
            var x when x.Contains("barangay", StringComparison.Ordinal) || x.Contains("brgy", StringComparison.Ordinal) => "barangay",
            var x when x.Contains("fire", StringComparison.Ordinal) || x.Contains("bfp", StringComparison.Ordinal) => "fire",
            var x when x.Contains("police", StringComparison.Ordinal) || x.Contains("pnp", StringComparison.Ordinal) => "police",
            var x when x.Contains("rhu", StringComparison.Ordinal) || x.Contains("medic", StringComparison.Ordinal) => "rhu",
            _ => "unknown"
        };
    }

    internal static bool IsCanonicalIdTypeConflict(string? selectedIdType, string? detectedIdType)
    {
        string selectedCanonical = CanonicalizeIdCategory(selectedIdType);
        string detectedCanonical = CanonicalizeIdCategory(detectedIdType);
        return selectedCanonical != "unknown" &&
               detectedCanonical != "unknown" &&
               !string.Equals(selectedCanonical, detectedCanonical, StringComparison.OrdinalIgnoreCase);
    }

    internal static string FormatIdTypeLabel(string? idType) =>
        CanonicalizeIdCategory(idType) switch
        {
            "drivers" => "Philippine Driver's License (LTO)",
            "philsys" => "PhilSys National ID",
            "passport" => "Philippine Passport (DFA)",
            "prc" => "PRC Professional ID",
            "umid" => "Unified Multi-Purpose ID (UMID)",
            "postal" => "Philippine Postal ID",
            "voters" => "COMELEC Voter's ID",
            "senior_citizen" => "Senior Citizen ID (OSCA)",
            "pwd" => "PWD ID (NCDA)",
            "sss" => "SSS ID",
            "tin" => "BIR TIN ID",
            "philhealth" => "PhilHealth ID",
            "pagibig" => "Pag-IBIG Loyalty Card",
            "gsis" => "GSIS eCard",
            "owwa" => "OWWA ID",
            "solo_parent" => "Solo Parent ID",
            "barangay" => "Barangay ID",
            "fire" => "BFP Fire Responder ID",
            "police" => "PNP Police ID",
            "rhu" => "RHU Medical ID",
            _ => string.IsNullOrWhiteSpace(idType) ? "Government ID" : idType.Trim()
        };

    internal static string NormalizeIdTypeCode(string? idType) =>
        CanonicalizeIdCategory(idType) switch
        {
            "drivers" => "DRIVERS_LICENSE",
            "philsys" => "PH_NATIONAL_ID",
            "passport" => "PASSPORT",
            "prc" => "PRC_ID",
            "umid" => "UMID",
            "postal" => "POSTAL_ID",
            "voters" => "VOTERS_ID",
            "senior_citizen" => "SENIOR_CITIZEN_ID",
            "pwd" => "PWD_ID",
            "sss" => "SSS_ID",
            "tin" => "TIN_ID",
            "philhealth" => "PHILHEALTH_ID",
            "pagibig" => "PAGIBIG_ID",
            "gsis" => "GSIS_ID",
            "owwa" => "OWWA_ID",
            "solo_parent" => "SOLO_PARENT_ID",
            "barangay" => "BARANGAY_ID",
            "fire" => "BFP_ID",
            "police" => "PNP_ID",
            "rhu" => "RHU_ID",
            _ => "UNKNOWN"
        };

    internal static string NormalizeClaudeMime(string mime) =>
        mime.Trim().ToLowerInvariant() switch
        {
            "image/png" => "image/png",
            "image/webp" => "image/webp",
            "image/gif" => "image/gif",
            _ => "image/jpeg"
        };

    internal static string CleanJsonFences(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        string? fencedInner = TryExtractMarkdownFenceInner(input);
        if (!string.IsNullOrWhiteSpace(fencedInner) &&
            TryFindValidJsonObject(fencedInner, out string? fencedObject))
        {
            return fencedObject!;
        }

        if (TryFindValidJsonObject(input, out string? rawObject))
        {
            return rawObject!;
        }

        return (fencedInner ?? input).Trim();
    }

    private static string? TryExtractMarkdownFenceInner(string input)
    {
        int fenceStart = input.IndexOf("```", StringComparison.Ordinal);
        if (fenceStart < 0)
        {
            return null;
        }

        int contentStart = fenceStart + 3;
        int fenceEnd = input.IndexOf("```", contentStart, StringComparison.Ordinal);
        string inner = fenceEnd >= 0
            ? input[contentStart..fenceEnd]
            : input[contentStart..];

        string trimmedStart = inner.TrimStart();
        if (trimmedStart.StartsWith("json", StringComparison.OrdinalIgnoreCase))
        {
            if (trimmedStart.Length == 4 || char.IsWhiteSpace(trimmedStart[4]) || trimmedStart[4] == '{')
            {
                trimmedStart = trimmedStart[4..];
            }
        }
        else
        {
            int newlineIdx = trimmedStart.IndexOfAny(['\r', '\n']);
            if (newlineIdx >= 0 && trimmedStart[..newlineIdx].IndexOf('{') < 0)
            {
                trimmedStart = trimmedStart[(newlineIdx + 1)..];
            }
        }

        return trimmedStart.Trim();
    }

    private static bool TryFindValidJsonObject(string text, out string? jsonObject)
    {
        int scanFrom = 0;
        while (scanFrom < text.Length)
        {
            int start = text.IndexOf('{', scanFrom);
            if (start < 0)
            {
                break;
            }

            int depth = 0;
            bool inString = false;
            bool escaped = false;
            bool closed = false;

            for (int i = start; i < text.Length; i++)
            {
                char c = text[i];
                if (inString)
                {
                    if (escaped)
                    {
                        escaped = false;
                    }
                    else if (c == '\\')
                    {
                        escaped = true;
                    }
                    else if (c == '"')
                    {
                        inString = false;
                    }

                    continue;
                }

                if (c == '"')
                {
                    inString = true;
                }
                else if (c == '{')
                {
                    depth++;
                }
                else if (c == '}')
                {
                    depth--;
                    if (depth == 0)
                    {
                        string candidate = text[start..(i + 1)];
                        if (TryIsValidJsonObject(candidate))
                        {
                            jsonObject = candidate;
                            return true;
                        }

                        scanFrom = i + 1;
                        closed = true;
                        break;
                    }
                }
            }

            if (!closed)
            {
                scanFrom = start + 1;
            }
        }

        jsonObject = null;
        return false;
    }

    private static bool TryIsValidJsonObject(string candidate)
    {
        try
        {
            using var doc = JsonDocument.Parse(candidate);
            return doc.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    internal static (string MimeType, string Base64Data) ParseDataUrl(string? dataUrl)
    {
        if (string.IsNullOrWhiteSpace(dataUrl))
            return ("image/jpeg", string.Empty);

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

    internal static byte[] TryDecodeDataUrlBytes(string? dataUrlOrBase64)
    {
        var (_, b64) = ParseDataUrl(dataUrlOrBase64);
        return TryDecodeBase64(b64);
    }

    internal static byte[] TryDecodeBase64(string? base64)
    {
        if (string.IsNullOrWhiteSpace(base64)) return [];
        try
        {
            return Convert.FromBase64String(base64.Trim());
        }
        catch
        {
            return [];
        }
    }

    internal static bool TryGetPropertyCaseInsensitive(JsonElement obj, string propertyName, out JsonElement value)
    {
        if (obj.ValueKind == JsonValueKind.Object)
        {
            if (obj.TryGetProperty(propertyName, out value))
                return true;

            foreach (var prop in obj.EnumerateObject())
            {
                if (string.Equals(prop.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    value = prop.Value;
                    return true;
                }
            }
        }

        value = default;
        return false;
    }

    internal static bool? TryReadOptionalBool(JsonElement obj, string propertyName) =>
        TryGetPropertyCaseInsensitive(obj, propertyName, out var prop)
            ? prop.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.String when bool.TryParse(prop.GetString(), out bool parsed) => parsed,
                _ => null
            }
            : null;

    internal static string? TryReadOptionalString(JsonElement obj, string propertyName) =>
        TryGetPropertyCaseInsensitive(obj, propertyName, out var prop) && prop.ValueKind == JsonValueKind.String
            ? CleanSentinelText(prop.GetString())
            : null;

    private static string? NormalizeSlotSide(string? side)
    {
        if (string.IsNullOrWhiteSpace(side)) return null;
        string upper = side.Trim().ToUpperInvariant();
        return upper switch
        {
            "FRONT" or "DATA-PAGE" or "DATAPAGE" or "DOCUMENT" => "FRONT",
            "BACK" or "REVERSE" => "BACK",
            "UNKNOWN" => "UNKNOWN",
            _ => upper
        };
    }

    private static bool TryFindFieldElement(
        JsonElement root,
        JsonElement? nestedFieldsObj,
        string canonicalKey,
        out JsonElement element)
    {
        if (nestedFieldsObj.HasValue && TryGetPropertyCaseInsensitive(nestedFieldsObj.Value, canonicalKey, out element))
            return true;

        if (TryGetPropertyCaseInsensitive(root, canonicalKey, out element))
            return true;

        if (FieldAliases.TryGetValue(canonicalKey, out var aliases))
        {
            foreach (string alias in aliases)
            {
                if (nestedFieldsObj.HasValue && TryGetPropertyCaseInsensitive(nestedFieldsObj.Value, alias, out element))
                    return true;

                if (TryGetPropertyCaseInsensitive(root, alias, out element))
                    return true;
            }
        }

        element = default;
        return false;
    }

    private static (ExtractedFieldDto Field, bool HasExplicitConfidence)? ReadFieldProperty(
        JsonElement element,
        double? rootConfidence)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            string? rawVal = null;
            if (TryGetPropertyCaseInsensitive(element, "value", out var valProp))
            {
                rawVal = ReadScalarJsonValue(valProp);
            }

            string? cleaned = CleanSentinelText(rawVal);
            if (string.IsNullOrWhiteSpace(cleaned))
                return null;

            bool hasExplicitConf = false;
            double conf = rootConfidence ?? 0.0;
            if (TryGetPropertyCaseInsensitive(element, "confidence", out var confProp) &&
                confProp.ValueKind == JsonValueKind.Number &&
                confProp.TryGetDouble(out var parsedConf) &&
                double.IsFinite(parsedConf))
            {
                conf = Math.Clamp(parsedConf, 0.0, 1.0);
                hasExplicitConf = true;
            }

            return (new ExtractedFieldDto(cleaned, conf), hasExplicitConf);
        }

        string? scalar = CleanSentinelText(ReadScalarJsonValue(element));
        if (string.IsNullOrWhiteSpace(scalar))
            return null;

        return (new ExtractedFieldDto(scalar, rootConfidence ?? 0.0), false);
    }

    private static string? ReadScalarJsonValue(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null
        };

    private static string? CleanSentinelText(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        string trimmed = raw.Trim();
        return SentinelEmptyTokens.Contains(trimmed) ? null : trimmed;
    }

    private static string? NormalizeVisibleSex(string? sex)
    {
        if (string.IsNullOrWhiteSpace(sex))
            return null;

        string trimmed = sex.Trim();
        if (trimmed.Equals("M", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("Male", StringComparison.OrdinalIgnoreCase))
            return "Male";

        if (trimmed.Equals("F", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("Female", StringComparison.OrdinalIgnoreCase))
            return "Female";

        return trimmed;
    }
}

public class ClaudeFaceToGovIdMatchStrategy(
    IConfiguration configuration,
    IClaudeMessagesClient? claudeClient = null,
    IOptions<VerificationTokenOptions>? tokenOptions = null,
    ILogger<ClaudeFaceToGovIdMatchStrategy>? logger = null) : IFaceToGovIdMatchStrategy
{
    private const int MinimumBlurVariance = 80;
    private const double MinimumLivenessConfidence = 0.70;
    private const double DefaultFaceToIdThreshold = 0.72;

    private readonly IClaudeMessagesClient _claudeClient =
        claudeClient ?? new ClaudeMessagesClient(null, configuration, NullLogger<ClaudeMessagesClient>.Instance);

    private readonly ILogger<ClaudeFaceToGovIdMatchStrategy> _logger =
        logger ?? NullLogger<ClaudeFaceToGovIdMatchStrategy>.Instance;

    public async Task<FaceToGovIdMatchResult> EvaluateMatchAsync(
        FaceToGovIdMatchInput input,
        CancellationToken ct = default)
    {
        if (input.FrontIdBytes is null || input.FrontIdBytes.Length == 0)
        {
            return BuildFailure(
                errorCode: "MISSING_FRONT_IMAGE",
                errorMessage: "Front Government ID image is required for Face-to-Gov-ID verification.",
                providerUsed: "DeterministicBiometricPreFlight",
                modelUsed: null,
                isLiveHuman: false,
                faceToIdSimilarity: 0.0,
                requiresPendingManualReview: false,
                geometryVerdict: "MISSING_FRONT_ID",
                diagnostics: ["FrontIdBytes were empty."]);
        }

        if (input.LiveFacialBytes is null || input.LiveFacialBytes.Length == 0)
        {
            return BuildFailure(
                errorCode: "LIVENESS_SPOOF_REJECTED",
                errorMessage: "Live facial capture image is required for biometric verification.",
                providerUsed: "DeterministicBiometricPreFlight",
                modelUsed: null,
                isLiveHuman: false,
                faceToIdSimilarity: 0.0,
                requiresPendingManualReview: false,
                geometryVerdict: "NO_LIVE_FACIAL_FRAME",
                diagnostics: ["LiveFacialBytes were empty."]);
        }

        if (input.BlurVariance < MinimumBlurVariance)
        {
            return BuildFailure(
                errorCode: "LIVENESS_SPOOF_REJECTED",
                errorMessage: $"Facial frame optical sharpness ({input.BlurVariance}) is below the minimum anti-spoofing threshold ({MinimumBlurVariance}).",
                providerUsed: "DeterministicBiometricPreFlight",
                modelUsed: null,
                isLiveHuman: false,
                faceToIdSimilarity: 0.0,
                requiresPendingManualReview: false,
                geometryVerdict: "LOW_BLUR_VARIANCE",
                diagnostics: [$"BlurVariance={input.BlurVariance} < {MinimumBlurVariance}"]);
        }

        if (input.LivenessConfidence > 0.0 && input.LivenessConfidence < MinimumLivenessConfidence)
        {
            return BuildFailure(
                errorCode: "LIVENESS_SPOOF_REJECTED",
                errorMessage: $"Optical liveness confidence ({input.LivenessConfidence:F2}) is below the required threshold ({MinimumLivenessConfidence:F2}).",
                providerUsed: "DeterministicBiometricPreFlight",
                modelUsed: null,
                isLiveHuman: false,
                faceToIdSimilarity: 0.0,
                requiresPendingManualReview: false,
                geometryVerdict: "LOW_LIVENESS_CONFIDENCE",
                diagnostics: [$"LivenessConfidence={input.LivenessConfidence:F2} < {MinimumLivenessConfidence:F2}"]);
        }

        var extraPoseFrames = ExtractPoseFramesForInspection(
            input.PoseFramesJson,
            input.LiveFacialBytes,
            out bool isStaticSpoof,
            out string? staticReason);

        if (isStaticSpoof)
        {
            return BuildFailure(
                errorCode: "LIVENESS_SPOOF_REJECTED",
                errorMessage: staticReason ?? "Static single-photo upload cannot satisfy live 4-pose liveness verification.",
                providerUsed: "DeterministicBiometricPreFlight",
                modelUsed: null,
                isLiveHuman: false,
                faceToIdSimilarity: 0.0,
                requiresPendingManualReview: false,
                geometryVerdict: "STATIC_UPLOAD_REJECTED",
                diagnostics: [staticReason ?? "Static upload marker or duplicated pose frames detected."]);
        }

        if (!_claudeClient.IsConfigured)
        {
            return BuildFailure(
                errorCode: "PROVIDER_UNAVAILABLE",
                errorMessage: "Claude Vision biometric service is unavailable; registration may proceed with pending manual review.",
                providerUsed: _claudeClient.PrimaryModel,
                modelUsed: _claudeClient.PrimaryModel,
                isLiveHuman: false,
                faceToIdSimilarity: 0.0,
                requiresPendingManualReview: true,
                geometryVerdict: "PROVIDER_UNAVAILABLE",
                diagnostics: ["Claude API key is not configured."]);
        }

        var contentBlocks = new List<object>
        {
            new
            {
                type = "image",
                source = new
                {
                    type = "base64",
                    media_type = SharedGovIdForensicsEvaluator.NormalizeClaudeMime(input.FrontIdMimeType),
                    data = Convert.ToBase64String(input.FrontIdBytes)
                }
            },
            new
            {
                type = "image",
                source = new
                {
                    type = "base64",
                    media_type = SharedGovIdForensicsEvaluator.NormalizeClaudeMime(input.LiveFacialMimeType),
                    data = Convert.ToBase64String(input.LiveFacialBytes)
                }
            }
        };

        foreach (var (bytes, mime) in extraPoseFrames)
        {
            contentBlocks.Add(new
            {
                type = "image",
                source = new
                {
                    type = "base64",
                    media_type = SharedGovIdForensicsEvaluator.NormalizeClaudeMime(mime),
                    data = Convert.ToBase64String(bytes)
                }
            });
        }

        contentBlocks.Add(new
        {
            type = "text",
            text = "Image 1 is the Front Government ID card portrait. Image 2 is the live camera CENTER frame" +
                   (extraPoseFrames.Count > 0 ? $" followed by {extraPoseFrames.Count} additional live pose frame(s)." : ".") +
                   " Evaluate human liveness (reject printed photo, phone screen replay, or mask) and compare whether the live person matches the portrait photo on the Front Government ID."
        });

        var payloadWithoutModel = new Dictionary<string, object>
        {
            ["max_tokens"] = 768,
            ["temperature"] = 0.0,
            ["system"] = BuildBiometricMatchSystemPrompt(),
            ["messages"] = new object[]
            {
                new
                {
                    role = "user",
                    content = contentBlocks.ToArray()
                }
            }
        };

        ClaudeMessageAttemptResult attempt;
        try
        {
            attempt = await _claudeClient.SendMessagesAsync(payloadWithoutModel, ct, input.PreferredModel);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning("Claude Face-to-Gov-ID match request failed ({Message}).", ex.Message);
            return BuildFailure(
                errorCode: "PROVIDER_UNAVAILABLE",
                errorMessage: "Claude Vision biometric matching service is temporarily unavailable; proceed with pending manual review.",
                providerUsed: _claudeClient.PrimaryModel,
                modelUsed: _claudeClient.PrimaryModel,
                isLiveHuman: false,
                faceToIdSimilarity: 0.0,
                requiresPendingManualReview: true,
                geometryVerdict: "PROVIDER_UNAVAILABLE",
                diagnostics: [ex.Message]);
        }

        if (!attempt.Success)
        {
            return BuildFailure(
                errorCode: "PROVIDER_UNAVAILABLE",
                errorMessage: attempt.ErrorMessage ?? "Claude Vision biometric service is unavailable; proceed with pending manual review.",
                providerUsed: attempt.ModelUsed,
                modelUsed: attempt.ModelUsed,
                isLiveHuman: false,
                faceToIdSimilarity: 0.0,
                requiresPendingManualReview: true,
                geometryVerdict: "PROVIDER_UNAVAILABLE",
                diagnostics: [attempt.ErrorCode ?? "PROVIDER_UNAVAILABLE"]);
        }

        double threshold = ResolveSimilarityThreshold();
        return ParseClaudeFaceMatchResponse(
            attempt.RawText ?? string.Empty,
            attempt.ModelUsed,
            threshold,
            input.IdVerificationToken);
    }

    private double ResolveSimilarityThreshold()
    {
        double? fromOptions = tokenOptions?.Value?.FaceToIdMatchThreshold;
        if (fromOptions is > 0.0 and <= 1.0)
        {
            return fromOptions.Value;
        }

        string? rawConfig = configuration[$"{VerificationTokenOptions.SectionName}:FaceToIdMatchThreshold"];
        if (double.TryParse(rawConfig, NumberStyles.Float, CultureInfo.InvariantCulture, out double parsed) &&
            parsed is > 0.0 and <= 1.0)
        {
            return parsed;
        }

        return DefaultFaceToIdThreshold;
    }

    private static string BuildBiometricMatchSystemPrompt() =>
        "You are a forensic facial biometric liveness and 1:1 identity verification engine.\n" +
        "Compare the portrait photograph printed on the Government ID (Image 1) with the live camera facial capture frame(s) (Image 2+).\n" +
        "1. Verify anti-spoofing liveness (isLiveHuman): set false if the live frame shows a photo-of-a-photo, phone/monitor screen replay, bezel, moire pattern, or synthetic mask.\n" +
        "2. Compute faceToIdSimilarity between 0.0 and 1.0 representing facial structure & identity consistency between Image 1 portrait and Image 2+ live face.\n" +
        "3. Return ONLY valid JSON (no markdown fences, no prose):\n" +
        "{\"isLiveHuman\": true|false, \"faceToIdSimilarity\": <0.0-1.0>, \"verdict\": \"LIVE_FACE_ID_MATCHED\"|\"LIVENESS_SPOOF_REJECTED\"|\"FACE_TO_ID_MISMATCH\", \"spoofIndicators\": [<string>], \"reason\": \"<concise 1-sentence justification>\", \"confidence\": <0.0-1.0>}";

    private static FaceToGovIdMatchResult ParseClaudeFaceMatchResponse(
        string rawText,
        string modelUsed,
        double threshold,
        string? idVerificationToken)
    {
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return BuildFailure(
                "LIVENESS_SPOOF_REJECTED",
                "Biometric matching engine returned an empty response.",
                modelUsed,
                modelUsed,
                false,
                0.0,
                false,
                "EMPTY_AI_RESPONSE",
                ["Empty Claude biometric JSON response."]);
        }

        string cleanJson = SharedGovIdForensicsEvaluator.CleanJsonFences(rawText);
        try
        {
            using var doc = JsonDocument.Parse(cleanJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return BuildFailure(
                    "LIVENESS_SPOOF_REJECTED",
                    "Biometric matching response was not a structured JSON object.",
                    modelUsed,
                    modelUsed,
                    false,
                    0.0,
                    false,
                    "INVALID_AI_RESPONSE",
                    ["Non-object JSON payload."]);
            }

            bool isLiveHuman = SharedGovIdForensicsEvaluator.TryReadOptionalBool(root, "isLiveHuman") ?? false;
            string verdict = SharedGovIdForensicsEvaluator.TryReadOptionalString(root, "verdict") ?? string.Empty;
            string? reason = SharedGovIdForensicsEvaluator.TryReadOptionalString(root, "reason");

            double similarity = 0.0;
            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "faceToIdSimilarity", out var simProp) &&
                simProp.ValueKind == JsonValueKind.Number &&
                simProp.TryGetDouble(out double parsedSim) &&
                double.IsFinite(parsedSim))
            {
                similarity = Math.Clamp(Math.Round(parsedSim, 4), 0.0, 1.0);
            }

            double confidence = similarity;
            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "confidence", out var confProp) &&
                confProp.ValueKind == JsonValueKind.Number &&
                confProp.TryGetDouble(out double parsedConf) &&
                double.IsFinite(parsedConf))
            {
                confidence = Math.Clamp(Math.Round(parsedConf, 4), 0.0, 1.0);
            }

            var diagnostics = new List<string>();
            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "spoofIndicators", out var spoofArr) &&
                spoofArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in spoofArr.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(item.GetString()))
                    {
                        diagnostics.Add(item.GetString()!.Trim());
                    }
                }
            }

            if (!string.IsNullOrWhiteSpace(reason))
            {
                diagnostics.Add(reason!);
            }

            string verdictUpper = verdict.Trim().ToUpperInvariant();
            bool isSpoofVerdict = verdictUpper.Contains("SPOOF", StringComparison.Ordinal) ||
                                  verdictUpper.Contains("REPLAY", StringComparison.Ordinal) ||
                                  verdictUpper.Contains("MASK", StringComparison.Ordinal);

            if (!isLiveHuman || isSpoofVerdict)
            {
                return BuildFailure(
                    "LIVENESS_SPOOF_REJECTED",
                    reason ?? "Live facial liveness check rejected the capture due to suspected static photo, screen replay, or spoof presentation.",
                    modelUsed,
                    modelUsed,
                    false,
                    similarity,
                    false,
                    string.IsNullOrWhiteSpace(verdict) ? "LIVENESS_SPOOF_REJECTED" : verdict,
                    diagnostics);
            }

            if (similarity < threshold)
            {
                return BuildFailure(
                    "FACE_TO_ID_MISMATCH",
                    reason ?? $"Live facial scan similarity ({similarity:F2}) is below the required threshold ({threshold:F2}) against your uploaded Government ID portrait. Please ensure good lighting and retake your 4-pose capture.",
                    modelUsed,
                    modelUsed,
                    true,
                    similarity,
                    false,
                    string.IsNullOrWhiteSpace(verdict) ? "FACE_TO_ID_MISMATCH" : verdict,
                    diagnostics);
            }

            bool hasTokenFormat = !string.IsNullOrWhiteSpace(idVerificationToken) && idVerificationToken.Contains('.');
            return new FaceToGovIdMatchResult(
                Success: true,
                IsLiveHuman: true,
                IsFaceMatchedToId: true,
                FaceToIdSimilarity: similarity,
                IsAutoApproveEligible: hasTokenFormat,
                RequiresPendingManualReview: false,
                FacialVerificationToken: null,
                ErrorCode: null,
                ErrorMessage: null,
                ProviderUsed: modelUsed,
                ModelUsed: modelUsed,
                AuthenticityConfidence: confidence,
                GeometryVerdict: string.IsNullOrWhiteSpace(verdict) ? "LIVE_FACE_ID_MATCHED" : verdict,
                Diagnostics: diagnostics);
        }
        catch (JsonException)
        {
            return BuildFailure(
                "LIVENESS_SPOOF_REJECTED",
                "Biometric matching engine returned malformed JSON.",
                modelUsed,
                modelUsed,
                false,
                0.0,
                false,
                "INVALID_AI_RESPONSE",
                ["Malformed JSON returned by Claude biometric match."]);
        }
    }

    private static List<(byte[] Bytes, string MimeType)> ExtractPoseFramesForInspection(
        string? poseFramesJson,
        byte[] centerBytes,
        out bool isStaticSpoof,
        out string? staticReason)
    {
        isStaticSpoof = false;
        staticReason = null;
        var extraFrames = new List<(byte[] Bytes, string MimeType)>();

        if (string.IsNullOrWhiteSpace(poseFramesJson))
        {
            return extraFrames;
        }

        try
        {
            using var doc = JsonDocument.Parse(poseFramesJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return extraFrames;
            }

            if (SharedGovIdForensicsEvaluator.TryReadOptionalBool(root, "isStaticUpload") == true)
            {
                isStaticSpoof = true;
                staticReason = "Static single-photo upload cannot satisfy live 4-pose liveness verification.";
                return extraFrames;
            }

            string? captureSource = SharedGovIdForensicsEvaluator.TryReadOptionalString(root, "captureSource");
            if (string.Equals(captureSource, "static_upload", StringComparison.OrdinalIgnoreCase))
            {
                isStaticSpoof = true;
                staticReason = "Static single-photo upload cannot satisfy live 4-pose liveness verification.";
                return extraFrames;
            }

            JsonElement poseContainer = root;
            if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "poses", out var posesObj) &&
                posesObj.ValueKind == JsonValueKind.Object)
            {
                poseContainer = posesObj;
            }
            else if (SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(root, "bestFrames", out var bestObj) &&
                     bestObj.ValueKind == JsonValueKind.Object)
            {
                poseContainer = bestObj;
            }

            var distinctHashes = new HashSet<string>(StringComparer.Ordinal);
            distinctHashes.Add(Convert.ToHexString(SHA256.HashData(centerBytes)));

            int poseFrameCount = 0;
            foreach (string poseKey in new[] { "CENTER", "RIGHT", "LEFT", "BLINK" })
            {
                if (!SharedGovIdForensicsEvaluator.TryGetPropertyCaseInsensitive(poseContainer, poseKey, out var poseEl))
                {
                    continue;
                }

                string? dataUrl = poseEl.ValueKind == JsonValueKind.String
                    ? poseEl.GetString()
                    : (poseEl.ValueKind == JsonValueKind.Object
                        ? (SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "bestFrameDataUrl") ??
                           SharedGovIdForensicsEvaluator.TryReadOptionalString(poseEl, "frameDataUrl"))
                        : null);

                if (string.IsNullOrWhiteSpace(dataUrl))
                {
                    continue;
                }

                var (mime, b64) = SharedGovIdForensicsEvaluator.ParseDataUrl(dataUrl);
                byte[] decoded = SharedGovIdForensicsEvaluator.TryDecodeBase64(b64);
                if (decoded.Length == 0)
                {
                    continue;
                }

                poseFrameCount += 1;
                distinctHashes.Add(Convert.ToHexString(SHA256.HashData(decoded)));
                if (!string.Equals(poseKey, "CENTER", StringComparison.OrdinalIgnoreCase) &&
                    !decoded.AsSpan().SequenceEqual(centerBytes))
                {
                    extraFrames.Add((decoded, mime));
                }
            }

            if (poseFrameCount >= 2 && distinctHashes.Count == 1)
            {
                isStaticSpoof = true;
                staticReason = "All pose slots contain identical image bytes; live multi-angle 4-pose video capture is required.";
                return [];
            }
        }
        catch (JsonException)
        {
            // Ignore malformed optional pose metadata and rely on primary live frame bytes.
        }

        return extraFrames;
    }

    private static FaceToGovIdMatchResult BuildFailure(
        string errorCode,
        string errorMessage,
        string providerUsed,
        string? modelUsed,
        bool isLiveHuman,
        double faceToIdSimilarity,
        bool requiresPendingManualReview,
        string geometryVerdict,
        List<string> diagnostics) =>
        new(
            Success: false,
            IsLiveHuman: isLiveHuman,
            IsFaceMatchedToId: false,
            FaceToIdSimilarity: faceToIdSimilarity,
            IsAutoApproveEligible: false,
            RequiresPendingManualReview: requiresPendingManualReview,
            FacialVerificationToken: null,
            ErrorCode: errorCode,
            ErrorMessage: errorMessage,
            ProviderUsed: providerUsed,
            ModelUsed: modelUsed,
            AuthenticityConfidence: 0.0,
            GeometryVerdict: geometryVerdict,
            Diagnostics: diagnostics);
}
