// [Layer: Backend/Api/Controllers]
// Responsibility: Exposes Claude Standby AI Governance (Auto-Approve Uploaded Gov ID) and Multi-Objective Responder Auto-Dispatch endpoints.
// Universal Lambda Expressions (=>). Strategy Pattern (OCP). Zero emojis.

using Backend.Features.Services.Vision;
using Microsoft.AspNetCore.Mvc;
using ResQTrack.Backend.Features.Services.Standby;

namespace Backend.Features.Api.Controllers;

[ApiController]
[Route("api/standby-ai")]
public class StandbyAiController(
    IConfiguration configuration,
    IStandbyGovIdAutoApproveStrategy govIdStrategy,
    IStandbyResponderAutoDispatchStrategy dispatchStrategy,
    IRoboflowWorkflowStrategy? roboflowWorkflowStrategy = null) : ControllerBase
{
    [HttpGet("status")]
    public IActionResult GetStatus() =>
        Ok(BuildStatusPayload());

    [HttpPost("auto-approve-gov-id")]
    public async Task<IActionResult> AutoApproveGovIdAsync(
        [FromBody] StandbyGovIdApprovalRequest request,
        CancellationToken ct) =>
        Ok(await govIdStrategy.EvaluateAndApproveAsync(request, ct));

    [HttpPost("auto-dispatch-responder")]
    public async Task<IActionResult> AutoDispatchResponderAsync(
        [FromBody] StandbyAutoDispatchRequest request,
        CancellationToken ct) =>
        Ok(await dispatchStrategy.SelectAndDispatchOptimalUnitAsync(request, ct));

    private object BuildStatusPayload()
    {
        string apiKey = ResolveApiKey();

        return new
        {
            configured = !string.IsNullOrWhiteSpace(apiKey),
            maskedKey = MaskClaudeKey(apiKey),
            model = string.IsNullOrWhiteSpace(configuration["Claude:Model"]) ? "claude-sonnet-4-6" : configuration["Claude:Model"]!.Trim(),
            fallbackModel = string.IsNullOrWhiteSpace(configuration["Claude:FallbackModel"]) ? "claude-sonnet-5-5" : configuration["Claude:FallbackModel"]!.Trim(),
            endpoint = configuration["Claude:Endpoint"] ?? "https://api.anthropic.com/v1/messages",
            standbyAutoApproveGovIdEnabled = bool.TryParse(configuration["Claude:StandbyAutoApproveGovIdEnabled"], out var g) ? g : true,
            standbyAutoDispatchRespondersEnabled = bool.TryParse(configuration["Claude:StandbyAutoDispatchRespondersEnabled"], out var d) ? d : true,
            autoApproveGovIdStrategy = govIdStrategy.StrategyKey,
            autoDispatchResponderStrategy = dispatchStrategy.StrategyKey,
            roboflowConfigured = ResolveRoboflowConfigured(),
            roboflowFaceClasses = string.IsNullOrWhiteSpace(configuration["Roboflow:FaceClasses"])
                ? RoboflowPretrainedDatasets.DefaultFaceClasses
                : configuration["Roboflow:FaceClasses"]!.Trim(),
            roboflowIdClasses = string.IsNullOrWhiteSpace(configuration["Roboflow:IdClasses"])
                ? RoboflowPretrainedDatasets.DefaultPhilippineIdClasses
                : configuration["Roboflow:IdClasses"]!.Trim(),
            philippineIdsDataset = RoboflowPretrainedDatasets.PhilippineIdsDatasetSlug,
            workflowCacheTtlMinutes = ResolveWorkflowCacheTtlMinutes(),
            claudeTrainingCacheEnabled = ResolveClaudeTrainingCacheEnabled()
        };
    }

    private bool ResolveRoboflowConfigured() =>
        (roboflowWorkflowStrategy ?? new RoboflowServerlessWorkflowStrategy(null, configuration)).IsConfigured;

    private int ResolveWorkflowCacheTtlMinutes() =>
        int.TryParse(configuration["Roboflow:WorkflowCacheTtlMinutes"], out int parsed) && parsed is >= 1 and <= 120
            ? parsed
            : RoboflowPretrainedDatasets.WorkflowCacheMinutes;

    private bool ResolveClaudeTrainingCacheEnabled() =>
        !string.Equals(configuration["Biometrics:EnableAsyncClaudeTraining"], "false", StringComparison.OrdinalIgnoreCase);

    private string ResolveApiKey()
    {
        string?[] candidates =
        [
            configuration["Claude:ApiKey"],
            configuration["Anthropic:ApiKey"],
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

        return string.Empty;
    }

    private static bool IsTemplatePlaceholderKey(string key) =>
        key.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase) ||
        key.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase) ||
        (key.Length >= 2 && key.StartsWith('<') && key.EndsWith('>'));

    private static string MaskClaudeKey(string key) =>
        string.IsNullOrWhiteSpace(key)
            ? "[UNCONFIGURED]"
            : key.Length >= 20
                ? $"{key[..15]}...{key[^4..]}"
                : $"{key[..Math.Min(4, key.Length)]}...{key[^Math.Min(4, key.Length)..]}";
}
