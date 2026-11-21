// [Layer: Backend/Services/Vision]
// Responsibility: Implements IRoboflowWorkflowStrategy with header-authenticated Serverless Workflows (inference-sdk v1.5.0+ transport parity),
// 15-minute workflow & prediction caching, pretrained Face ("face") and Philippine IDs ("driver, postal, umid" - yolov8-ctdd4/philippine-ids) detection,
// and structured dataset training priors for Claude Vision ephemeral prompt caching.
// Strategy Pattern (OCP), Universal Lambda Expressions (=>), Pure ASCII, Zero Emojis.

using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Backend.Features.Services.Vision;

public sealed record RoboflowWorkflowImageInput(
    byte[] ImageBytes,
    string MimeType = "image/jpeg",
    string? SelectedIdType = null,
    string? ClassesOverride = null);

public sealed record RoboflowBoundingBox(
    double X,
    double Y,
    double Width,
    double Height,
    string ClassName,
    double Confidence,
    int? ImageWidth = null,
    int? ImageHeight = null);

public sealed record RoboflowWorkflowDetectionResult(
    bool Success,
    bool RanOnline,
    bool CacheHit,
    int CacheTtlSeconds,
    string TaskType,
    string DatasetSlug,
    string RequestedClasses,
    string? TopClass,
    double TopConfidence,
    string? CanonicalIdType,
    string AuthTransport,
    string TransportMode,
    IReadOnlyList<RoboflowBoundingBox> Predictions,
    string? ErrorCode = null,
    string? ErrorMessage = null,
    string RawJson = "{}");

public interface IRoboflowWorkflowStrategy
{
    bool IsConfigured { get; }
    bool IsFaceWorkflowConfigured { get; }
    bool IsPhilippineIdWorkflowConfigured { get; }

    Task<RoboflowWorkflowDetectionResult> DetectFaceAsync(
        RoboflowWorkflowImageInput input,
        CancellationToken ct = default);

    Task<RoboflowWorkflowDetectionResult> DetectPhilippineIdAsync(
        RoboflowWorkflowImageInput input,
        CancellationToken ct = default);

    string GetPretrainedDatasetPromptContext(
        string taskType,
        string? selectedIdType = null,
        RoboflowWorkflowDetectionResult? workflowDetection = null);
}

public static class RoboflowPretrainedDatasets
{
    public const string ServerlessBaseUrl = "https://serverless.roboflow.com";
    public const string HeaderAuthTransport = "header (Authorization: Bearer / api_key_transport=header)";
    public const int WorkflowCacheMinutes = 15;
    public const int WorkflowCacheTtlSeconds = WorkflowCacheMinutes * 60;

    public const string FaceDatasetSlug = "roboflow-pretrained/face";
    public const string DefaultFaceClasses = "face";

    public const string PhilippineIdsDatasetSlug = "yolov8-ctdd4/philippine-ids";
    public const string PhilippineIdsModelEndpointPath = "philippine-ids/1";
    public const string PhilippineIdsDatasetUrl = "https://universe.roboflow.com/yolov8-ctdd4/philippine-ids";
    public const string DefaultPhilippineIdClasses = "driver, postal, umid";

    public static string CanonicalizePhilippineIdClass(string? rawClass)
    {
        if (string.IsNullOrWhiteSpace(rawClass))
        {
            return string.Empty;
        }

        string lower = rawClass.Trim().ToLowerInvariant();
        return lower switch
        {
            "driver" or "drivers" or "drivers_license" or "driver_license" or "lto" => "drivers",
            "postal" or "postal_id" or "phlpost" => "postal",
            "umid" or "sss_umid" or "unified_multi_purpose_id" => "umid",
            "philsys" or "national_id" or "philid" => "philsys",
            "passport" or "dfa_passport" => "passport",
            "prc" or "prc_id" => "prc",
            "voters" or "voter" or "comelec" => "voters",
            "senior" or "senior_citizen" or "osca" => "senior_citizen",
            "pwd" => "pwd",
            _ => lower
        };
    }

    public static bool AreEquivalentIdClasses(string? selectedIdType, string? detectedClass)
    {
        string left = CanonicalizePhilippineIdClass(selectedIdType);
        string right = CanonicalizePhilippineIdClass(detectedClass);
        return !string.IsNullOrEmpty(left) && string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
    }
}

public class RoboflowServerlessWorkflowStrategy : IRoboflowWorkflowStrategy
{
    private static readonly Lazy<HttpClient> FallbackHttpClient = new(() => new HttpClient());
    private static readonly MemoryCache FallbackMemoryCache = new(new MemoryCacheOptions());

    private readonly HttpClient _httpClient;
    private readonly IConfiguration? _configuration;
    private readonly IMemoryCache _memoryCache;
    private readonly IDistributedCache? _distributedCache;
    private readonly ILogger<RoboflowServerlessWorkflowStrategy> _logger;

    public RoboflowServerlessWorkflowStrategy(
        HttpClient? httpClient = null,
        IConfiguration? configuration = null,
        IMemoryCache? memoryCache = null,
        IDistributedCache? distributedCache = null,
        ILogger<RoboflowServerlessWorkflowStrategy>? logger = null,
        IHttpClientFactory? httpClientFactory = null)
    {
        _httpClient = httpClient ?? httpClientFactory?.CreateClient("RoboflowServerless") ?? FallbackHttpClient.Value;
        _configuration = configuration;
        _memoryCache = memoryCache ?? FallbackMemoryCache;
        _distributedCache = distributedCache;
        _logger = logger ?? NullLogger<RoboflowServerlessWorkflowStrategy>.Instance;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ResolveApiKey());

    public bool IsFaceWorkflowConfigured =>
        IsConfigured &&
        !string.IsNullOrWhiteSpace(ResolveWorkspaceName()) &&
        !string.IsNullOrWhiteSpace(ResolveFaceWorkflowId());

    public bool IsPhilippineIdWorkflowConfigured =>
        IsConfigured &&
        ((!string.IsNullOrWhiteSpace(ResolveWorkspaceName()) && !string.IsNullOrWhiteSpace(ResolvePhilippineIdWorkflowId())) ||
         !string.IsNullOrWhiteSpace(ResolvePhilippineIdsModelId()));

    public Task<RoboflowWorkflowDetectionResult> DetectFaceAsync(
        RoboflowWorkflowImageInput input,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);

        string fallbackClasses = ResolveConfigValue(
            "Roboflow:FaceClasses",
            "ROBOFLOW_FACE_CLASSES",
            RoboflowPretrainedDatasets.DefaultFaceClasses);
        string classes = SanitizeClassesCsv(input.ClassesOverride, fallbackClasses);

        return ExecuteWorkflowOrDatasetAsync(
            taskType: "FACE_DETECTION",
            datasetSlug: RoboflowPretrainedDatasets.FaceDatasetSlug,
            classes: classes,
            workflowId: ResolveFaceWorkflowId(),
            modelEndpointPath: ResolveConfigValue("Roboflow:FaceModelId", "ROBOFLOW_FACE_MODEL_ID", string.Empty),
            input: input,
            ct: ct);
    }

    public Task<RoboflowWorkflowDetectionResult> DetectPhilippineIdAsync(
        RoboflowWorkflowImageInput input,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(input);

        string fallbackClasses = ResolveConfigValue(
            "Roboflow:IdClasses",
            "ROBOFLOW_ID_CLASSES",
            RoboflowPretrainedDatasets.DefaultPhilippineIdClasses);
        string classes = SanitizeClassesCsv(input.ClassesOverride, fallbackClasses);

        return ExecuteWorkflowOrDatasetAsync(
            taskType: "PHILIPPINE_ID_DETECTION",
            datasetSlug: RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug,
            classes: classes,
            workflowId: ResolvePhilippineIdWorkflowId(),
            modelEndpointPath: ResolvePhilippineIdsModelId(),
            input: input,
            ct: ct);
    }

    internal static string SanitizeClassesCsv(string? rawClasses, string fallbackClasses)
    {
        if (string.IsNullOrWhiteSpace(rawClasses))
        {
            return fallbackClasses;
        }

        var safeTokens = rawClasses
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(token => new string(token.Where(c => char.IsLetterOrDigit(c) || c is '_' or '-' or ' ').ToArray()).Trim())
            .Where(token => token.Length > 0 && token.Length <= 40)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(10)
            .ToList();

        return safeTokens.Count > 0 ? string.Join(", ", safeTokens) : fallbackClasses;
    }

    public string GetPretrainedDatasetPromptContext(
        string taskType,
        string? selectedIdType = null,
        RoboflowWorkflowDetectionResult? workflowDetection = null)
    {
        if (string.Equals(taskType, "FACE_DETECTION", StringComparison.OrdinalIgnoreCase))
        {
            var sb = new StringBuilder();
            sb.Append("Pretrained Face Dataset Calibration (classes: \"face\", 15-min workflow cache): ");
            sb.Append("Isolate primary human cranium/face bounding box, bilateral eyes, nasal bridge, jawline contour, and anti-spoofing surface cues (reject phone bezels, halftone prints, moire, or flat photos).");
            if (workflowDetection is { Success: true, Predictions.Count: > 0 })
            {
                RoboflowBoundingBox top = workflowDetection.Predictions[0];
                sb.Append($" Live Roboflow workflow detected class={top.ClassName} conf={top.Confidence:F2} bbox=[x={top.X:F0},y={top.Y:F0},w={top.Width:F0},h={top.Height:F0}] cacheHit={workflowDetection.CacheHit}.");
            }
            return sb.ToString();
        }

        var idSb = new StringBuilder();
        idSb.Append($"Pretrained Philippine IDs Dataset ({RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug}, classes: \"driver, postal, umid\", ref: {RoboflowPretrainedDatasets.PhilippineIdsDatasetUrl}): ");
        idSb.Append("Dataset visual taxonomy maps class \"driver\" -> \"drivers\" (LTO Philippine Driver's License: PascalCase headers above ALL-CAPS data, PHL Nationality, M/F Sex, YYYY/MM/DD DOB, Address -, -, ..., License No. X##-##-######), ");
        idSb.Append("\"postal\" -> \"postal\" (PhilPost Postal ID: PRN barcode, VALID UNTIL, cardholder photo right/left band), ");
        idSb.Append("\"umid\" -> \"umid\" (SSS/GSIS UMID: CRN-####-#######-#, surname/given/middle uppercase lines, holographic seal). ");
        if (!string.IsNullOrWhiteSpace(selectedIdType))
        {
            idSb.Append($"Canonicalize singular \"driver\" to \"{RoboflowPretrainedDatasets.CanonicalizePhilippineIdClass("driver")}\" when comparing against selectedIdType=\"{selectedIdType}\".");
        }

        if (workflowDetection is { Success: true, Predictions.Count: > 0 })
        {
            RoboflowBoundingBox top = workflowDetection.Predictions[0];
            idSb.Append($" Roboflow dataset inference detected class={top.ClassName} (canonical={workflowDetection.CanonicalIdType ?? RoboflowPretrainedDatasets.CanonicalizePhilippineIdClass(top.ClassName)}) conf={top.Confidence:F2} bbox=[x={top.X:F0},y={top.Y:F0},w={top.Width:F0},h={top.Height:F0}] cacheHit={workflowDetection.CacheHit}.");
        }

        return idSb.ToString();
    }

    private async Task<RoboflowWorkflowDetectionResult> ExecuteWorkflowOrDatasetAsync(
        string taskType,
        string datasetSlug,
        string classes,
        string workflowId,
        string modelEndpointPath,
        RoboflowWorkflowImageInput input,
        CancellationToken ct)
    {
        int ttlMinutes = ResolveCacheTtlMinutes();
        int ttlSeconds = ttlMinutes * 60;

        if (input.ImageBytes is null || input.ImageBytes.Length == 0)
        {
            return new RoboflowWorkflowDetectionResult(
                Success: false,
                RanOnline: false,
                CacheHit: false,
                CacheTtlSeconds: ttlSeconds,
                TaskType: taskType,
                DatasetSlug: datasetSlug,
                RequestedClasses: classes,
                TopClass: null,
                TopConfidence: 0.0,
                CanonicalIdType: null,
                AuthTransport: "NONE",
                TransportMode: "EMPTY_IMAGE",
                Predictions: [],
                ErrorCode: "MISSING_IMAGE",
                ErrorMessage: "Image bytes are required for Roboflow detection.");
        }

        bool useCache = ResolveUseWorkflowCache();
        string imageSha = Convert.ToHexString(SHA256.HashData(input.ImageBytes));
        string cacheKey = $"resqtrack:rf_wf:{taskType}:{classes}:{workflowId}:{modelEndpointPath}:{imageSha}";

        if (useCache && TryGetFromCache(cacheKey, out RoboflowWorkflowDetectionResult? cachedResult) && cachedResult is not null)
        {
            return cachedResult with { CacheHit = true, CacheTtlSeconds = ttlSeconds };
        }

        string? apiKey = ResolveApiKey();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new RoboflowWorkflowDetectionResult(
                Success: false,
                RanOnline: false,
                CacheHit: false,
                CacheTtlSeconds: ttlSeconds,
                TaskType: taskType,
                DatasetSlug: datasetSlug,
                RequestedClasses: classes,
                TopClass: null,
                TopConfidence: 0.0,
                CanonicalIdType: null,
                AuthTransport: "UNCONFIGURED",
                TransportMode: "CLAUDE_TRAINED_PRIOR_ONLY",
                Predictions: [],
                ErrorCode: "ROBOFLOW_UNCONFIGURED",
                ErrorMessage: "Roboflow API key not configured; Claude trained dataset priors active.");
        }

        string workspaceName = ResolveWorkspaceName();
        string apiBaseUrl = ResolveConfigValue("Roboflow:ApiUrl", "ROBOFLOW_API_URL", RoboflowPretrainedDatasets.ServerlessBaseUrl).TrimEnd('/');
        bool hasWorkflow = !string.IsNullOrWhiteSpace(workspaceName) && !string.IsNullOrWhiteSpace(workflowId);
        bool usePythonSdk = ResolveUsePythonSdk() && hasWorkflow;

        RoboflowWorkflowDetectionResult? onlineResult = null;
        if (usePythonSdk)
        {
            onlineResult = await TryExecuteViaPythonSdkAsync(
                apiBaseUrl,
                apiKey,
                workspaceName,
                workflowId,
                classes,
                useCache,
                taskType,
                datasetSlug,
                ttlSeconds,
                input,
                ct);
        }

        if (onlineResult is null && hasWorkflow)
        {
            onlineResult = await TryExecuteServerlessWorkflowHttpAsync(
                apiBaseUrl,
                apiKey,
                workspaceName,
                workflowId,
                classes,
                useCache,
                taskType,
                datasetSlug,
                ttlSeconds,
                input,
                ct);
        }

        if (onlineResult is null && !string.IsNullOrWhiteSpace(modelEndpointPath))
        {
            onlineResult = await TryExecuteServerlessDatasetModelHttpAsync(
                apiBaseUrl,
                apiKey,
                modelEndpointPath,
                classes,
                taskType,
                datasetSlug,
                ttlSeconds,
                input,
                ct);
        }

        if (onlineResult is not null)
        {
            // Cache Poisoning Guard: never cache failed or empty (0-prediction) frames.
            if (useCache &&
                onlineResult.Success &&
                onlineResult.RanOnline &&
                string.IsNullOrWhiteSpace(onlineResult.ErrorCode) &&
                onlineResult.Predictions.Count > 0)
            {
                await StoreInCacheAsync(cacheKey, onlineResult, TimeSpan.FromMinutes(ttlMinutes), ct);
            }
            return onlineResult;
        }

        return new RoboflowWorkflowDetectionResult(
            Success: false,
            RanOnline: false,
            CacheHit: false,
            CacheTtlSeconds: ttlSeconds,
            TaskType: taskType,
            DatasetSlug: datasetSlug,
            RequestedClasses: classes,
            TopClass: null,
            TopConfidence: 0.0,
            CanonicalIdType: null,
            AuthTransport: RoboflowPretrainedDatasets.HeaderAuthTransport,
            TransportMode: hasWorkflow ? "WORKFLOW_UNAVAILABLE" : "NO_WORKFLOW_OR_MODEL_ID",
            Predictions: [],
            ErrorCode: hasWorkflow ? "ROBOFLOW_WORKFLOW_UNAVAILABLE" : "ROBOFLOW_WORKFLOW_UNCONFIGURED",
            ErrorMessage: hasWorkflow
                ? "Roboflow serverless workflow did not return a valid detection payload."
                : "Roboflow workspace/workflow ID is not configured; falling back to Claude pretrained dataset calibration.");
    }

    private async Task<RoboflowWorkflowDetectionResult?> TryExecuteServerlessWorkflowHttpAsync(
        string apiBaseUrl,
        string apiKey,
        string workspaceName,
        string workflowId,
        string classes,
        bool useCache,
        string taskType,
        string datasetSlug,
        int ttlSeconds,
        RoboflowWorkflowImageInput input,
        CancellationToken ct)
    {
        string endpointUrl = $"{apiBaseUrl}/infer/workflows/{Uri.EscapeDataString(workspaceName)}/{Uri.EscapeDataString(workflowId)}";
        string base64Image = Convert.ToBase64String(input.ImageBytes);

        // Ensure 15-minute workflow definition cache entry exists in IMemoryCache matching use_cache=True semantics.
        if (useCache)
        {
            string wfCacheKey = $"resqtrack:rf_wf_def:{workspaceName}:{workflowId}";
            _memoryCache.Set(wfCacheKey, DateTime.UtcNow, TimeSpan.FromMinutes(ResolveCacheTtlMinutes()));
        }

        string bodyJson = JsonSerializer.Serialize(new
        {
            inputs = new
            {
                image = new
                {
                    type = "base64",
                    value = base64Image
                },
                classes
            },
            parameters = new
            {
                classes
            },
            use_cache = useCache
        });

        try
        {
            using var request = CreateHeaderAuthRequest(
                HttpMethod.Post,
                endpointUrl,
                apiKey,
                new StringContent(bodyJson, Encoding.UTF8, "application/json"));

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(10));

            using HttpResponseMessage response = await _httpClient.SendAsync(request, timeoutCts.Token);
            string responseJson = await response.Content.ReadAsStringAsync(timeoutCts.Token);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Roboflow workflow {Workspace}/{Workflow} returned HTTP {StatusCode}.",
                    workspaceName,
                    workflowId,
                    (int)response.StatusCode);
                return null;
            }

            List<RoboflowBoundingBox> predictions = ParsePredictionsFromJson(responseJson, classes);
            return BuildOnlineResult(
                taskType,
                datasetSlug,
                classes,
                ttlSeconds,
                transportMode: "SERVERLESS_WORKFLOW_HTTP_HEADER",
                predictions,
                responseJson);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Roboflow workflow {Workspace}/{Workflow} HTTP invocation failed.", workspaceName, workflowId);
            return null;
        }
    }

    private async Task<RoboflowWorkflowDetectionResult?> TryExecuteServerlessDatasetModelHttpAsync(
        string apiBaseUrl,
        string apiKey,
        string modelEndpointPath,
        string classes,
        string taskType,
        string datasetSlug,
        int ttlSeconds,
        RoboflowWorkflowImageInput input,
        CancellationToken ct)
    {
        string cleanedPath = modelEndpointPath.Trim().TrimStart('/');
        string endpointUrl = $"{apiBaseUrl}/{cleanedPath}";
        string base64Image = Convert.ToBase64String(input.ImageBytes);

        try
        {
            using var request = CreateHeaderAuthRequest(
                HttpMethod.Post,
                endpointUrl,
                apiKey,
                new StringContent(base64Image, Encoding.UTF8, "application/x-www-form-urlencoded"));

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(8));

            using HttpResponseMessage response = await _httpClient.SendAsync(request, timeoutCts.Token);
            string responseJson = await response.Content.ReadAsStringAsync(timeoutCts.Token);

            if (!response.IsSuccessStatusCode && (int)response.StatusCode is 400 or 415)
            {
                using var jsonReq = CreateHeaderAuthRequest(
                    HttpMethod.Post,
                    endpointUrl,
                    apiKey,
                    new StringContent(
                        JsonSerializer.Serialize(new { image = new { type = "base64", value = base64Image } }),
                        Encoding.UTF8,
                        "application/json"));

                using HttpResponseMessage jsonResp = await _httpClient.SendAsync(jsonReq, timeoutCts.Token);
                responseJson = await jsonResp.Content.ReadAsStringAsync(timeoutCts.Token);
                if (!jsonResp.IsSuccessStatusCode)
                {
                    return null;
                }
            }
            else if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Roboflow pretrained dataset model {ModelPath} returned HTTP {StatusCode}.",
                    cleanedPath,
                    (int)response.StatusCode);
                return null;
            }

            List<RoboflowBoundingBox> predictions = ParsePredictionsFromJson(responseJson, classes);
            return BuildOnlineResult(
                taskType,
                datasetSlug,
                classes,
                ttlSeconds,
                transportMode: "SERVERLESS_PRETRAINED_MODEL_HEADER",
                predictions,
                responseJson);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Roboflow pretrained dataset model {ModelPath} request failed.", cleanedPath);
            return null;
        }
    }

    private async Task<RoboflowWorkflowDetectionResult?> TryExecuteViaPythonSdkAsync(
        string apiBaseUrl,
        string apiKey,
        string workspaceName,
        string workflowId,
        string classes,
        bool useCache,
        string taskType,
        string datasetSlug,
        int ttlSeconds,
        RoboflowWorkflowImageInput input,
        CancellationToken ct)
    {
        string scriptPath = Path.Combine(AppContext.BaseDirectory, "Scripts", "roboflow_workflow_runner.py");
        if (!File.Exists(scriptPath))
        {
            scriptPath = Path.Combine(Directory.GetCurrentDirectory(), "Scripts", "roboflow_workflow_runner.py");
        }
        if (!File.Exists(scriptPath))
        {
            return null;
        }

        string pythonExe = File.Exists("/opt/roboflow-venv/bin/python")
            ? "/opt/roboflow-venv/bin/python"
            : "python3";

        string tempFile = Path.Combine(Path.GetTempPath(), $"rf_{Guid.NewGuid():N}.jpg");
        try
        {
            await File.WriteAllBytesAsync(tempFile, input.ImageBytes, ct);
            var psi = new ProcessStartInfo
            {
                FileName = pythonExe,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            psi.ArgumentList.Add(scriptPath);
            psi.ArgumentList.Add("--api-url");
            psi.ArgumentList.Add(apiBaseUrl);
            psi.ArgumentList.Add("--workspace");
            psi.ArgumentList.Add(workspaceName);
            psi.ArgumentList.Add("--workflow");
            psi.ArgumentList.Add(workflowId);
            psi.ArgumentList.Add("--image");
            psi.ArgumentList.Add(tempFile);
            psi.ArgumentList.Add("--classes");
            psi.ArgumentList.Add(classes);
            psi.ArgumentList.Add("--use-cache");
            psi.ArgumentList.Add(useCache ? "true" : "false");
            psi.Environment["ROBOFLOW_API_KEY"] = apiKey;

            using Process? proc = Process.Start(psi);
            if (proc is null)
            {
                return null;
            }

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(12));
            string stdout = await proc.StandardOutput.ReadToEndAsync(timeoutCts.Token);
            await proc.WaitForExitAsync(timeoutCts.Token);
            if (proc.ExitCode != 0 || string.IsNullOrWhiteSpace(stdout))
            {
                return null;
            }

            List<RoboflowBoundingBox> predictions = ParsePredictionsFromJson(stdout, classes);
            return BuildOnlineResult(
                taskType,
                datasetSlug,
                classes,
                ttlSeconds,
                transportMode: "INFERENCE_SDK_PYTHON_HEADER",
                predictions,
                stdout);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogDebug(ex, "Python inference-sdk bridge unavailable; falling back to C# Serverless HTTP header transport.");
            return null;
        }
        finally
        {
            try
            {
                if (File.Exists(tempFile)) File.Delete(tempFile);
            }
            catch
            {
                // Ignore temp cleanup failure.
            }
        }
    }

    private static RoboflowWorkflowDetectionResult BuildOnlineResult(
        string taskType,
        string datasetSlug,
        string classes,
        int ttlSeconds,
        string transportMode,
        List<RoboflowBoundingBox> predictions,
        string rawJson)
    {
        RoboflowBoundingBox? top = predictions.OrderByDescending(p => p.Confidence).FirstOrDefault();
        string? topClass = top?.ClassName;
        string? canonicalId = string.Equals(taskType, "PHILIPPINE_ID_DETECTION", StringComparison.OrdinalIgnoreCase) &&
                              !string.IsNullOrWhiteSpace(topClass)
            ? RoboflowPretrainedDatasets.CanonicalizePhilippineIdClass(topClass)
            : null;

        return new RoboflowWorkflowDetectionResult(
            Success: true,
            RanOnline: true,
            CacheHit: false,
            CacheTtlSeconds: ttlSeconds,
            TaskType: taskType,
            DatasetSlug: datasetSlug,
            RequestedClasses: classes,
            TopClass: topClass,
            TopConfidence: top?.Confidence ?? 0.0,
            CanonicalIdType: canonicalId,
            AuthTransport: RoboflowPretrainedDatasets.HeaderAuthTransport,
            TransportMode: transportMode,
            Predictions: predictions,
            ErrorCode: null,
            ErrorMessage: null,
            RawJson: rawJson);
    }

    internal static List<RoboflowBoundingBox> ParsePredictionsFromJson(string rawJson, string? allowedClassesCsv = null)
    {
        var collected = new List<RoboflowBoundingBox>();
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return collected;
        }

        HashSet<string>? allowedClasses = string.IsNullOrWhiteSpace(allowedClassesCsv)
            ? null
            : allowedClassesCsv
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(c => c.ToLowerInvariant())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            CollectPredictionsRecursive(doc.RootElement, null, null, allowedClasses, collected);
        }
        catch (JsonException)
        {
            return [];
        }

        return collected
            .OrderByDescending(p => p.Confidence)
            .ToList();
    }

    private static void CollectPredictionsRecursive(
        JsonElement element,
        int? imageWidth,
        int? imageHeight,
        HashSet<string>? allowedClasses,
        List<RoboflowBoundingBox> output)
    {
        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (JsonElement item in element.EnumerateArray())
            {
                CollectPredictionsRecursive(item, imageWidth, imageHeight, allowedClasses, output);
            }
            return;
        }

        if (element.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        int? nextWidth = TryReadImageDim(element, "width") ?? imageWidth;
        int? nextHeight = TryReadImageDim(element, "height") ?? imageHeight;

        if (element.TryGetProperty("predictions", out JsonElement predsEl))
        {
            if (predsEl.ValueKind == JsonValueKind.Object)
            {
                int? nestedW = TryReadImageDim(predsEl, "width") ?? nextWidth;
                int? nestedH = TryReadImageDim(predsEl, "height") ?? nextHeight;
                if (predsEl.TryGetProperty("predictions", out JsonElement nestedArr) &&
                    nestedArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (JsonElement pred in nestedArr.EnumerateArray())
                    {
                        TryAddPredictionItem(pred, nestedW, nestedH, allowedClasses, output);
                    }
                    return;
                }
            }
            else if (predsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (JsonElement pred in predsEl.EnumerateArray())
                {
                    TryAddPredictionItem(pred, nextWidth, nextHeight, allowedClasses, output);
                }
                return;
            }
        }

        foreach (JsonProperty prop in element.EnumerateObject())
        {
            if (prop.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array)
            {
                CollectPredictionsRecursive(prop.Value, nextWidth, nextHeight, allowedClasses, output);
            }
        }
    }

    private static void TryAddPredictionItem(
        JsonElement item,
        int? imageWidth,
        int? imageHeight,
        HashSet<string>? allowedClasses,
        List<RoboflowBoundingBox> output)
    {
        if (item.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        string? className = TryReadString(item, "class") ?? TryReadString(item, "label") ?? TryReadString(item, "class_name");
        double conf = TryReadDouble(item, "confidence") ?? 0.0;
        if (string.IsNullOrWhiteSpace(className) || conf <= 0.0)
        {
            return;
        }

        string trimmedClass = className.Trim();
        if (allowedClasses is { Count: > 0 } &&
            !allowedClasses.Contains(trimmedClass) &&
            !allowedClasses.Contains(RoboflowPretrainedDatasets.CanonicalizePhilippineIdClass(trimmedClass)))
        {
            // Keep recognized dataset classes even if singular/plural variant differs, otherwise filter unrelated classes.
            string canonical = RoboflowPretrainedDatasets.CanonicalizePhilippineIdClass(trimmedClass);
            if (!allowedClasses.Any(a => RoboflowPretrainedDatasets.AreEquivalentIdClasses(a, canonical)))
            {
                return;
            }
        }

        double x = TryReadDouble(item, "x") ?? 0.0;
        double y = TryReadDouble(item, "y") ?? 0.0;
        double width = TryReadDouble(item, "width") ?? 0.0;
        double height = TryReadDouble(item, "height") ?? 0.0;

        output.Add(new RoboflowBoundingBox(
            X: Math.Round(x, 2),
            Y: Math.Round(y, 2),
            Width: Math.Round(width, 2),
            Height: Math.Round(height, 2),
            ClassName: trimmedClass,
            Confidence: Math.Round(Math.Clamp(conf, 0.0, 1.0), 4),
            ImageWidth: imageWidth,
            ImageHeight: imageHeight));
    }

    private static int? TryReadImageDim(JsonElement element, string dimKey)
    {
        if (element.TryGetProperty("image", out JsonElement imgEl) &&
            imgEl.ValueKind == JsonValueKind.Object &&
            TryReadDouble(imgEl, dimKey) is { } d &&
            d > 0)
        {
            return (int)Math.Round(d);
        }

        if (TryReadDouble(element, $"image_{dimKey}") is { } flat && flat > 0)
        {
            return (int)Math.Round(flat);
        }

        return null;
    }

    private bool TryGetFromCache(string cacheKey, out RoboflowWorkflowDetectionResult? cachedResult)
    {
        if (_memoryCache.TryGetValue(cacheKey, out RoboflowWorkflowDetectionResult? mem) &&
            mem is { Success: true, Predictions.Count: > 0 })
        {
            cachedResult = mem;
            return true;
        }

        if (_distributedCache is not null)
        {
            try
            {
                string? json = _distributedCache.GetString(cacheKey);
                if (!string.IsNullOrWhiteSpace(json))
                {
                    cachedResult = JsonSerializer.Deserialize<RoboflowWorkflowDetectionResult>(json);
                    if (cachedResult is { Success: true, Predictions.Count: > 0 })
                    {
                        _memoryCache.Set(cacheKey, cachedResult, TimeSpan.FromMinutes(ResolveCacheTtlMinutes()));
                        return true;
                    }
                }
            }
            catch
            {
                // Ignore transient distributed cache errors.
            }
        }

        cachedResult = null;
        return false;
    }

    private static HttpRequestMessage CreateHeaderAuthRequest(
        HttpMethod method,
        string endpointUrl,
        string apiKey,
        HttpContent content)
    {
        var request = new HttpRequestMessage(method, endpointUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Headers.TryAddWithoutValidation("x-api-key", apiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = content;
        return request;
    }

    private async Task StoreInCacheAsync(
        string cacheKey,
        RoboflowWorkflowDetectionResult result,
        TimeSpan ttl,
        CancellationToken ct)
    {
        _memoryCache.Set(cacheKey, result, ttl);

        if (_distributedCache is not null)
        {
            try
            {
                string json = JsonSerializer.Serialize(result);
                await _distributedCache.SetStringAsync(
                    cacheKey,
                    json,
                    new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
                    ct);
            }
            catch
            {
                // Non-blocking distributed cache write failure.
            }
        }
    }

    private string? ResolveApiKey()
    {
        string?[] candidates =
        [
            _configuration?["Roboflow:ApiKey"],
            Environment.GetEnvironmentVariable("ROBOFLOW_API_KEY")
        ];

        foreach (string? candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            string trimmed = candidate.Trim();
            if (!trimmed.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase) &&
                !trimmed.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase) &&
                !(trimmed.StartsWith('<') && trimmed.EndsWith('>')))
            {
                return trimmed;
            }
        }

        return null;
    }

    private string ResolveWorkspaceName() =>
        CleanOptionalPlaceholder(
            ResolveConfigValue("Roboflow:WorkspaceName", "ROBOFLOW_WORKSPACE_NAME", string.Empty));

    private string ResolveFaceWorkflowId() =>
        CleanOptionalPlaceholder(
            ResolveConfigValue("Roboflow:FaceWorkflowId", "ROBOFLOW_FACE_WORKFLOW_ID", string.Empty));

    private string ResolvePhilippineIdWorkflowId() =>
        CleanOptionalPlaceholder(
            ResolveConfigValue("Roboflow:PhilippineIdsWorkflowId", "ROBOFLOW_ID_WORKFLOW_ID", string.Empty));

    private string ResolvePhilippineIdsModelId() =>
        CleanOptionalPlaceholder(
            ResolveConfigValue("Roboflow:PhilippineIdsModelId", "ROBOFLOW_PHILIPPINE_IDS_MODEL_ID", RoboflowPretrainedDatasets.PhilippineIdsModelEndpointPath));

    private bool ResolveUseWorkflowCache()
    {
        string raw = ResolveConfigValue("Roboflow:UseWorkflowCache", "ROBOFLOW_USE_CACHE", "true");
        return !raw.Equals("false", StringComparison.OrdinalIgnoreCase) && !raw.Equals("0", StringComparison.Ordinal);
    }

    private bool ResolveUsePythonSdk()
    {
        string raw = ResolveConfigValue("Roboflow:UsePythonInferenceSdk", "ROBOFLOW_USE_PYTHON_SDK", "false");
        return raw.Equals("true", StringComparison.OrdinalIgnoreCase) || raw.Equals("1", StringComparison.Ordinal);
    }

    private int ResolveCacheTtlMinutes()
    {
        string raw = ResolveConfigValue(
            "Roboflow:WorkflowCacheTtlMinutes",
            "ROBOFLOW_CACHE_TTL_MINUTES",
            RoboflowPretrainedDatasets.WorkflowCacheMinutes.ToString(CultureInfo.InvariantCulture));
        return int.TryParse(raw, out int parsed) && parsed is >= 1 and <= 120
            ? parsed
            : RoboflowPretrainedDatasets.WorkflowCacheMinutes;
    }

    private string ResolveConfigValue(string configKey, string envKey, string fallback)
    {
        string? fromConfig = _configuration?[configKey];
        if (!string.IsNullOrWhiteSpace(fromConfig))
        {
            return fromConfig.Trim();
        }

        string? fromEnv = Environment.GetEnvironmentVariable(envKey);
        return !string.IsNullOrWhiteSpace(fromEnv) ? fromEnv.Trim() : fallback;
    }

    private static string CleanOptionalPlaceholder(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        string trimmed = value.Trim();
        return trimmed.StartsWith('<') && trimmed.EndsWith('>') ||
               trimmed.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase) ||
               trimmed.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase)
            ? string.Empty
            : trimmed;
    }

    private static string? TryReadString(JsonElement obj, string key) =>
        obj.TryGetProperty(key, out JsonElement prop) && prop.ValueKind == JsonValueKind.String
            ? prop.GetString()
            : null;

    private static double? TryReadDouble(JsonElement obj, string key) =>
        obj.TryGetProperty(key, out JsonElement prop) &&
        prop.ValueKind == JsonValueKind.Number &&
        prop.TryGetDouble(out double val) &&
        double.IsFinite(val)
            ? val
            : null;
}
