// [Layer: Backend/Services/Biometrics]
// Responsibility: Defines Strategy Pattern contract and DTOs for the 5-Layer Claude AI & Geometric Biometric Login Validation Pipeline.
// Open/Closed Principle (OCP), Universal Lambda Expressions (=>), Zero Emojis.

global using ResQTrack.Backend.Features.Services.Biometrics;

namespace ResQTrack.Backend.Features.Services.Biometrics
{
    public class BiometricLoginLayerResultDto
    {
        public int LayerNumber { get; set; }
        public string LayerCode { get; set; } = string.Empty;
        public string LayerName { get; set; } = string.Empty;
        public bool Passed { get; set; }
        public double Score { get; set; }
        public string Detail { get; set; } = string.Empty;
    }

    public class BiometricMultiLayerContext
    {
        public string? Email { get; set; }
        public string? LiveCaptureBase64 { get; set; }
        public string[]? LiveCaptureFramesBase64 { get; set; }
        public string? LiveDescriptorVectorJson { get; set; }
        public float[]? LiveDescriptorVector { get; set; }
        public string? LiveGeometricSignatureJson { get; set; }
        public double LivenessScore { get; set; } = 0.95;
        public string? PortalOrigin { get; set; }
    }

    public class BiometricMultiLayerEvaluationResult
    {
        public bool IsValidated { get; set; }
        public string ValidationVerdict { get; set; } = "INVALID"; // "SUCCESS_LOGIN" or "INVALID"
        public string StrategyName { get; set; } = "MultiLayerClaudeBiometricLoginStrategy";
        public Guid? MatchedUserId { get; set; }
        public string? MatchedEmail { get; set; }
        public double CosineSimilarity { get; set; }
        public double SimilarityThreshold { get; set; } = 0.82;
        public double GeometricAlignmentScore { get; set; }
        public string FailureReason { get; set; } = string.Empty;
        public List<BiometricLoginLayerResultDto> Layers { get; set; } = new();
    }

    public interface IBiometricLoginValidationStrategy
    {
        string StrategyName { get; }

        Task<BiometricMultiLayerEvaluationResult> ExecuteLayersAsync(
            BiometricMultiLayerContext context,
            CancellationToken ct = default);
    }
}

namespace Backend.Features.Services.Biometrics
{
    // Namespace compatibility bridge so both Backend.Features.Services.Biometrics and ResQTrack.Backend.Features.Services.Biometrics resolve cleanly.
}
