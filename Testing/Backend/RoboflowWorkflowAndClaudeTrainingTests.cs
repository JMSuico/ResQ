// [Layer: Testing/Backend]
// Responsibility: TDD RED contract tests for Roboflow Serverless Workflow (face & yolov8-ctdd4/philippine-ids), 15-min caching,
// header auth (inference-sdk v1.5.0+ parity), Claude ephemeral dataset training/caching, and canonical class alignment.
// Invariant: C# .NET 10, xUnit 2.9.3, universal expression-bodied arrow lambdas (=>), zero hardcoded API keys, zero emojis.

using System.Net;
using System.Text;
using System.Text.Json;
using Backend.Features.Api.Controllers;
using Backend.Features.Api.DTOs;
using Backend.Features.Services.Implementations;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification;
using Backend.Features.Services.Vision;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ResQTrack.Backend.Features.Services.Biometrics;

namespace Backend.Tests;

public class RoboflowWorkflowAndClaudeTrainingTests
{
    private const string TinyPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";

    private static byte[] CreateDistinctImageBytes(string marker) =>
        [.. Convert.FromBase64String(TinyPngBase64), .. Encoding.UTF8.GetBytes(marker)];

    private static IConfiguration BuildRoboflowAndClaudeConfig(bool includeWorkflow = true) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Roboflow:ApiKey"] = "rf_test_placeholder_key",
                ["Roboflow:ApiUrl"] = "https://serverless.roboflow.com",
                ["Roboflow:WorkspaceName"] = includeWorkflow ? "resqtrack-ws" : string.Empty,
                ["Roboflow:FaceWorkflowId"] = includeWorkflow ? "face-workflow" : string.Empty,
                ["Roboflow:PhilippineIdsWorkflowId"] = includeWorkflow ? "ph-ids-workflow" : string.Empty,
                ["Roboflow:PhilippineIdsModelId"] = "philippine-ids/1",
                ["Roboflow:FaceClasses"] = "face",
                ["Roboflow:IdClasses"] = "driver, postal, umid",
                ["Roboflow:UseWorkflowCache"] = "true",
                ["Roboflow:WorkflowCacheTtlMinutes"] = "15",
                ["Claude:ApiKey"] = "sk-ant-test-placeholder",
                ["Claude:Model"] = "claude-sonnet-4-6",
                ["Claude:FallbackModel"] = "claude-sonnet-5-5"
            })
            .Build();

    [Fact]
    public async Task DetectFaceAsync_UsesHeaderAuth_ClassesFace_UseCacheTrue_AndCachesFor15Minutes()
    {
        var handler = new RecordingHttpHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""
                    {
                      "outputs": [
                        {
                          "predictions": {
                            "image": { "width": 640, "height": 480 },
                            "predictions": [
                              { "x": 320, "y": 210, "width": 180, "height": 220, "class": "face", "confidence": 0.962 }
                            ]
                          }
                        }
                      ]
                    }
                    """, Encoding.UTF8, "application/json")
            }));

        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var strategy = new RoboflowServerlessWorkflowStrategy(
            new HttpClient(handler),
            BuildRoboflowAndClaudeConfig(),
            memoryCache,
            distributedCache: null,
            NullLogger<RoboflowServerlessWorkflowStrategy>.Instance);

        byte[] frameBytes = CreateDistinctImageBytes("face-frame-01");
        RoboflowWorkflowDetectionResult first = await strategy.DetectFaceAsync(new RoboflowWorkflowImageInput(frameBytes));
        RoboflowWorkflowDetectionResult second = await strategy.DetectFaceAsync(new RoboflowWorkflowImageInput(frameBytes));

        Assert.True(first.Success);
        Assert.True(first.RanOnline);
        Assert.False(first.CacheHit);
        Assert.Equal(900, first.CacheTtlSeconds);
        Assert.Equal("face", first.TopClass);
        Assert.Equal(0.962, first.TopConfidence, precision: 3);
        Assert.Single(first.Predictions);
        Assert.True(second.CacheHit);
        Assert.Single(handler.Requests);

        CapturedHttpCall call = handler.Requests[0];
        Assert.Contains("/infer/workflows/resqtrack-ws/face-workflow", call.Url, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("api_key=", call.Url, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Bearer rf_test_placeholder_key", call.AuthorizationHeader);
        Assert.Contains("\"classes\":\"face\"", call.Body, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"use_cache\":true", call.Body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DetectPhilippineIdAsync_RequestsDriverPostalUmid_AndCanonicalizesDriverToDrivers()
    {
        var handler = new RecordingHttpHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""
                    {
                      "outputs": [
                        {
                          "predictions": {
                            "image": { "width": 1000, "height": 630 },
                            "predictions": [
                              { "x": 500, "y": 315, "width": 860, "height": 540, "class": "driver", "confidence": 0.941 }
                            ]
                          }
                        }
                      ]
                    }
                    """, Encoding.UTF8, "application/json")
            }));

        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var strategy = new RoboflowServerlessWorkflowStrategy(
            new HttpClient(handler),
            BuildRoboflowAndClaudeConfig(),
            memoryCache,
            distributedCache: null,
            NullLogger<RoboflowServerlessWorkflowStrategy>.Instance);

        RoboflowWorkflowDetectionResult result = await strategy.DetectPhilippineIdAsync(
            new RoboflowWorkflowImageInput(CreateDistinctImageBytes("lto-front"), SelectedIdType: "drivers"));

        Assert.True(result.Success);
        Assert.Equal(RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug, result.DatasetSlug);
        Assert.Equal("driver, postal, umid", result.RequestedClasses);
        Assert.Equal("driver", result.TopClass);
        Assert.Equal("drivers", result.CanonicalIdType);
        Assert.Contains("\"classes\":\"driver, postal, umid\"", handler.Requests[0].Body, StringComparison.OrdinalIgnoreCase);
        Assert.True(RoboflowPretrainedDatasets.AreEquivalentIdClasses("drivers", "driver"));
        Assert.True(RoboflowPretrainedDatasets.AreEquivalentIdClasses("postal", "postal"));
        Assert.True(RoboflowPretrainedDatasets.AreEquivalentIdClasses("umid", "umid"));
    }

    [Fact]
    public async Task ClaudeFaceToGovIdMatchStrategy_UsesEphemeralCacheControl_AndFaceDatasetContext()
    {
        string capturedBody = string.Empty;
        var stubClaude = new InlineStubClaudeClient(payload =>
        {
            capturedBody = JsonSerializer.Serialize(payload);
            return new ClaudeMessageAttemptResult(
                Success: true,
                RawText: "{\"isLiveHuman\":true,\"faceToIdSimilarity\":0.89,\"verdict\":\"LIVE_FACE_ID_MATCHED\",\"spoofIndicators\":[],\"reason\":\"Live face matches Front ID portrait inside Roboflow face region.\",\"confidence\":0.92}",
                ModelUsed: "claude-sonnet-4-6",
                ErrorCode: null,
                ErrorMessage: null,
                HttpStatusCode: 200,
                UsedFallbackModel: false);
        });

        var faceStrategy = new StubWorkflowStrategy(
            faceResult: new RoboflowWorkflowDetectionResult(
                Success: true,
                RanOnline: true,
                CacheHit: true,
                CacheTtlSeconds: 900,
                TaskType: "FACE_DETECTION",
                DatasetSlug: RoboflowPretrainedDatasets.FaceDatasetSlug,
                RequestedClasses: "face",
                TopClass: "face",
                TopConfidence: 0.97,
                CanonicalIdType: null,
                AuthTransport: RoboflowPretrainedDatasets.HeaderAuthTransport,
                TransportMode: "SERVERLESS_WORKFLOW_HTTP_HEADER",
                Predictions: [new RoboflowBoundingBox(310, 220, 175, 210, "face", 0.97, 640, 480)]));

        var strategy = new ClaudeFaceToGovIdMatchStrategy(
            BuildRoboflowAndClaudeConfig(),
            stubClaude,
            Options.Create(new VerificationTokenOptions()),
            NullLogger<ClaudeFaceToGovIdMatchStrategy>.Instance,
            faceStrategy);

        FaceToGovIdMatchResult res = await strategy.EvaluateMatchAsync(
            new FaceToGovIdMatchInput(
                FrontIdBytes: CreateDistinctImageBytes("front-id-img"),
                FrontIdMimeType: "image/jpeg",
                LiveFacialBytes: CreateDistinctImageBytes("live-center-img"),
                LiveFacialMimeType: "image/jpeg",
                IdVerificationToken: "abc.def",
                PoseFramesJson: null,
                GeometricSignatureJson: null,
                BlurVariance: 120,
                LivenessConfidence: 0.94));

        Assert.True(res.Success);
        Assert.Contains("\"cache_control\":{\"type\":\"ephemeral\"}", capturedBody, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("face", capturedBody, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("0.97", capturedBody, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SharedGovIdForensicsEvaluator_IncludesPhilippineIdsDatasetPriors_AndMatchesSingularDriverToDrivers()
    {
        string capturedBody = string.Empty;
        var stubClaude = new InlineStubClaudeClient(payload =>
        {
            capturedBody = JsonSerializer.Serialize(payload);
            return new ClaudeMessageAttemptResult(
                Success: true,
                RawText: "{\"unreadable\":false,\"isGenuineId\":true,\"authenticityVerdict\":\"GENUINE_PHYSICAL_ID\",\"detectedIdType\":\"driver\",\"detectedIdLabel\":\"Philippine Driver's License\",\"matchesSelectedIdType\":true,\"frontSlotDetectedSide\":\"FRONT\",\"backSlotDetectedSide\":\"BACK\",\"areSidesIdentical\":false,\"confidence\":0.95,\"IdType\":\"driver\",\"fields\":{\"FirstName\":\"JUAN\",\"Surname\":\"DELA CRUZ\",\"LicenseNumber\":\"J07-22-302560\"}}",
                ModelUsed: "claude-sonnet-4-6",
                ErrorCode: null,
                ErrorMessage: null,
                HttpStatusCode: 200,
                UsedFallbackModel: false);
        });

        var idWorkflowStub = new StubWorkflowStrategy(
            idResult: new RoboflowWorkflowDetectionResult(
                Success: true,
                RanOnline: true,
                CacheHit: false,
                CacheTtlSeconds: 900,
                TaskType: "PHILIPPINE_ID_DETECTION",
                DatasetSlug: RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug,
                RequestedClasses: "driver, postal, umid",
                TopClass: "driver",
                TopConfidence: 0.95,
                CanonicalIdType: "drivers",
                AuthTransport: RoboflowPretrainedDatasets.HeaderAuthTransport,
                TransportMode: "SERVERLESS_WORKFLOW_HTTP_HEADER",
                Predictions: [new RoboflowBoundingBox(500, 315, 860, 540, "driver", 0.95, 1000, 630)]));

        var evaluator = new SharedGovIdForensicsEvaluator(
            BuildRoboflowAndClaudeConfig(),
            stubClaude,
            NullLogger<SharedGovIdForensicsEvaluator>.Instance,
            idWorkflowStub);

        GovIdForensicsResult eval = await evaluator.EvaluateAsync(new GovIdAuthenticityInput(
            FrontBytes: CreateDistinctImageBytes("front-driver"),
            FrontMimeType: "image/png",
            BackBytes: CreateDistinctImageBytes("back-driver"),
            BackMimeType: "image/png",
            SelectedIdType: "drivers"));

        Assert.True(eval.Success);
        Assert.True(eval.MatchesSelectedIdType);
        Assert.Contains("yolov8-ctdd4/philippine-ids", capturedBody, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"cache_control\":{\"type\":\"ephemeral\"}", capturedBody, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task IdentityController_ExposesRoboflowDetectFaceAndIdEndpoints()
    {
        var workflowStub = new StubWorkflowStrategy(
            faceResult: new RoboflowWorkflowDetectionResult(
                true, true, true, 900, "FACE_DETECTION", RoboflowPretrainedDatasets.FaceDatasetSlug, "face", "face", 0.98, null,
                RoboflowPretrainedDatasets.HeaderAuthTransport, "SERVERLESS_WORKFLOW_HTTP_HEADER",
                [new RoboflowBoundingBox(300, 220, 160, 195, "face", 0.98, 640, 480)]),
            idResult: new RoboflowWorkflowDetectionResult(
                true, true, false, 900, "PHILIPPINE_ID_DETECTION", RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug, "driver, postal, umid", "umid", 0.93, "umid",
                RoboflowPretrainedDatasets.HeaderAuthTransport, "SERVERLESS_WORKFLOW_HTTP_HEADER",
                [new RoboflowBoundingBox(480, 300, 820, 510, "umid", 0.93, 960, 600)]));

        var aiService = new IdentityAiService(
            new DummyHttpClientFactory(),
            BuildRoboflowAndClaudeConfig(),
            NullLogger<IdentityAiService>.Instance,
            roboflowWorkflowStrategy: workflowStub);

        var controller = new IdentityController(aiService);

        IActionResult faceAction = await controller.DetectRoboflowFaceAsync(
            new RoboflowWorkflowDetectRequestDto { ImageBase64 = TinyPngBase64 },
            CancellationToken.None);
        var faceOk = Assert.IsType<OkObjectResult>(faceAction);
        var faceDto = Assert.IsType<RoboflowWorkflowDetectResponseDto>(faceOk.Value);
        Assert.True(faceDto.Success);
        Assert.True(faceDto.CacheHit);
        Assert.Equal("face", faceDto.TopClass);

        IActionResult idAction = await controller.DetectRoboflowPhilippineIdAsync(
            new RoboflowWorkflowDetectRequestDto { ImageBase64 = TinyPngBase64, SelectedIdType = "umid" },
            CancellationToken.None);
        var idOk = Assert.IsType<OkObjectResult>(idAction);
        var idDto = Assert.IsType<RoboflowWorkflowDetectResponseDto>(idOk.Value);
        Assert.True(idDto.Success);
        Assert.Equal("umid", idDto.TopClass);
        Assert.Equal("umid", idDto.CanonicalIdType);
    }

    [Fact]
    public void PythonInferenceSdkScript_UsesHeaderTransportAnd15MinUseCache()
    {
        string repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        string scriptPath = Path.Combine(repoRoot, "Project system ENGINE", "Backend", "Scripts", "roboflow_workflow_runner.py");
        Assert.True(File.Exists(scriptPath), $"Expected Python runner at {scriptPath}");

        string content = File.ReadAllText(scriptPath);
        Assert.Contains("from inference_sdk import InferenceHTTPClient, InferenceConfiguration", content);
        Assert.Contains("https://serverless.roboflow.com", content);
        Assert.Contains("api_key_transport=\"header\"", content);
        Assert.Contains("client.run_workflow(", content);
        Assert.Contains("use_cache=", content);
    }

    [Fact]
    public async Task DetectFaceAsync_CachePoisoningGuard_DoesNotCacheEmptyPredictions()
    {
        int callCount = 0;
        var handler = new RecordingHttpHandler(_ =>
        {
            callCount++;
            string json = callCount == 1
                ? "{\"outputs\":[{\"predictions\":{\"image\":{\"width\":640,\"height\":480},\"predictions\":[]}}]}"
                : "{\"outputs\":[{\"predictions\":{\"image\":{\"width\":640,\"height\":480},\"predictions\":[{\"x\":320,\"y\":220,\"width\":160,\"height\":190,\"class\":\"face\",\"confidence\":0.95}]}}]}";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
        });

        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var strategy = new RoboflowServerlessWorkflowStrategy(
            new HttpClient(handler),
            BuildRoboflowAndClaudeConfig(),
            memoryCache,
            distributedCache: null,
            NullLogger<RoboflowServerlessWorkflowStrategy>.Instance);

        byte[] img = CreateDistinctImageBytes("cache-guard-empty-frame");
        RoboflowWorkflowDetectionResult first = await strategy.DetectFaceAsync(new RoboflowWorkflowImageInput(img));
        RoboflowWorkflowDetectionResult second = await strategy.DetectFaceAsync(new RoboflowWorkflowImageInput(img));

        Assert.Empty(first.Predictions);
        Assert.False(second.CacheHit);
        Assert.Single(second.Predictions);
        Assert.Equal(2, callCount);
    }

    [Fact]
    public async Task DetectRoboflowFaceAndId_WhenRoboflowUnconfiguredAndClaudeActive_ReturnsDatasetPredictionsAndCaches()
    {
        var unconfiguredRfConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Claude:ApiKey"] = "sk-ant-test-placeholder",
                ["Roboflow:ApiKey"] = string.Empty
            })
            .Build();

        int claudeCalls = 0;
        var stubClaude = new InlineStubClaudeClient(payload =>
        {
            claudeCalls++;
            string body = JsonSerializer.Serialize(payload);
            bool isFace = body.Contains("FACE_DETECTION", StringComparison.OrdinalIgnoreCase) ||
                          body.Contains("classes [face]", StringComparison.OrdinalIgnoreCase);
            string json = isFace
                ? "{\"predictions\":[{\"x\":500,\"y\":440,\"width\":350,\"height\":420,\"class\":\"face\",\"confidence\":0.94}]}"
                : "{\"predictions\":[{\"x\":500,\"y\":500,\"width\":840,\"height\":540,\"class\":\"driver\",\"confidence\":0.93}]}";
            return new ClaudeMessageAttemptResult(true, json, "claude-sonnet-4-6", null, null, 200, false);
        });

        var rfStrategy = new RoboflowServerlessWorkflowStrategy(null, unconfiguredRfConfig);
        var aiService = new IdentityAiService(
            new DummyHttpClientFactory(),
            unconfiguredRfConfig,
            NullLogger<IdentityAiService>.Instance,
            claudeMessagesClient: stubClaude,
            roboflowWorkflowStrategy: rfStrategy);

        string uniqueFaceB64 = Convert.ToBase64String(CreateDistinctImageBytes("claude-face-fallback-" + Guid.NewGuid().ToString("N")));
        RoboflowWorkflowDetectResponseDto face1 = await aiService.DetectRoboflowFaceAsync(
            new RoboflowWorkflowDetectRequestDto { ImageBase64 = uniqueFaceB64 });
        RoboflowWorkflowDetectResponseDto face2 = await aiService.DetectRoboflowFaceAsync(
            new RoboflowWorkflowDetectRequestDto { ImageBase64 = uniqueFaceB64 });

        Assert.True(face1.Success);
        Assert.Equal("CLAUDE_EPHEMERAL_DATASET_VISION", face1.TransportMode);
        Assert.Equal("face", face1.TopClass);
        Assert.Single(face1.Predictions);
        Assert.True(face2.CacheHit);

        string uniqueIdB64 = Convert.ToBase64String(CreateDistinctImageBytes("claude-id-fallback-" + Guid.NewGuid().ToString("N")));
        RoboflowWorkflowDetectResponseDto id1 = await aiService.DetectRoboflowPhilippineIdAsync(
            new RoboflowWorkflowDetectRequestDto { ImageBase64 = uniqueIdB64, SelectedIdType = "drivers" });

        Assert.True(id1.Success);
        Assert.Equal("driver", id1.TopClass);
        Assert.Equal("drivers", id1.CanonicalIdType);
        Assert.Equal(2, claudeCalls);
    }

    [Fact]
    public async Task DetectPhilippineIdAsync_AdversarialClassesAndCorruptJson_DegradesSafelyWithoutThrowing()
    {
        var handler = new RecordingHttpHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{not valid json[[[", Encoding.UTF8, "application/json")
            }));

        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var strategy = new RoboflowServerlessWorkflowStrategy(
            new HttpClient(handler),
            BuildRoboflowAndClaudeConfig(),
            memoryCache);

        string adversarialClasses = "driver; rm -rf /, postal[.*+?^${}()|\\], umid, " + new string('x', 200);
        RoboflowWorkflowDetectionResult result = await strategy.DetectPhilippineIdAsync(
            new RoboflowWorkflowImageInput(CreateDistinctImageBytes("adv-test"), ClassesOverride: adversarialClasses));

        Assert.True(result.Success);
        Assert.Empty(result.Predictions);
        Assert.DoesNotContain(";", result.RequestedClasses);
        Assert.DoesNotContain("[", result.RequestedClasses);
    }

    private sealed record CapturedHttpCall(string Url, string AuthorizationHeader, string Body);

    private sealed class RecordingHttpHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> responder) : HttpMessageHandler
    {
        public List<CapturedHttpCall> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            string body = request.Content != null ? await request.Content.ReadAsStringAsync(cancellationToken) : string.Empty;
            string auth = request.Headers.Authorization?.ToString() ?? string.Empty;
            Requests.Add(new CapturedHttpCall(request.RequestUri?.AbsoluteUri ?? string.Empty, auth, body));
            return await responder(request);
        }
    }

    private sealed class InlineStubClaudeClient(Func<IReadOnlyDictionary<string, object>, ClaudeMessageAttemptResult> handler) : IClaudeMessagesClient
    {
        public bool IsConfigured => true;
        public string PrimaryModel => "claude-sonnet-4-6";
        public string FallbackModel => "claude-sonnet-5-5";

        public Task<ClaudeMessageAttemptResult> SendMessagesAsync(
            IReadOnlyDictionary<string, object> payloadWithoutModel,
            CancellationToken ct = default,
            string? modelOverride = null) =>
            Task.FromResult(handler(payloadWithoutModel));
    }

    private sealed class StubWorkflowStrategy(
        RoboflowWorkflowDetectionResult? faceResult = null,
        RoboflowWorkflowDetectionResult? idResult = null) : IRoboflowWorkflowStrategy
    {
        public bool IsConfigured => true;
        public bool IsFaceWorkflowConfigured => faceResult != null;
        public bool IsPhilippineIdWorkflowConfigured => idResult != null;

        public Task<RoboflowWorkflowDetectionResult> DetectFaceAsync(RoboflowWorkflowImageInput input, CancellationToken ct = default) =>
            Task.FromResult(faceResult ?? new RoboflowWorkflowDetectionResult(
                false, false, false, 900, "FACE_DETECTION", RoboflowPretrainedDatasets.FaceDatasetSlug, "face", null, 0, null, "STUB", "STUB", []));

        public Task<RoboflowWorkflowDetectionResult> DetectPhilippineIdAsync(RoboflowWorkflowImageInput input, CancellationToken ct = default) =>
            Task.FromResult(idResult ?? new RoboflowWorkflowDetectionResult(
                false, false, false, 900, "PHILIPPINE_ID_DETECTION", RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug, "driver, postal, umid", null, 0, null, "STUB", "STUB", []));

        public string GetPretrainedDatasetPromptContext(string taskType, string? selectedIdType = null, RoboflowWorkflowDetectionResult? workflowDetection = null) =>
            new RoboflowServerlessWorkflowStrategy().GetPretrainedDatasetPromptContext(taskType, selectedIdType, workflowDetection);
    }

    private sealed class DummyHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }
}
