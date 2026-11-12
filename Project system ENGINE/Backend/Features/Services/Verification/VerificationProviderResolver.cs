// [Layer: Backend/Services/Verification]
// Responsibility: Configuration-driven Strategy & Decorator resolver for Identity and Facial verification providers.
// Defaults to ManualIdentityVerificationProvider and ManualFacialReviewProvider wrapped in Logging and Resilience decorators.
// Universal lambda expressions (=>). Zero emojis.

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Backend.Features.Services.Interfaces;
using Backend.Features.Services.Verification.Decorators;
using Backend.Features.Services.Verification.Providers;

namespace Backend.Features.Services.Verification;

public class VerificationProviderResolver(
    IOptions<VerificationProviderOptions>? options = null,
    IIdentityAiService? identityAiService = null,
    ILogger<VerificationProviderResolver>? logger = null) : IVerificationProviderResolver
{
    private readonly VerificationProviderOptions _options = options?.Value ?? new VerificationProviderOptions();

    private static readonly IReadOnlyList<string> IdentityProviderKeys =
        ["Manual", "AutomatedOcr", "GovernmentApi", "ThirdPartyApi"];

    private static readonly IReadOnlyList<string> FacialProviderKeys =
        ["Manual", "InternalBiometric", "ExternalFacialApi"];

    public IReadOnlyList<string> GetAvailableIdentityProviders() => IdentityProviderKeys;

    public IReadOnlyList<string> GetAvailableFacialProviders() => FacialProviderKeys;

    public IIdentityVerificationProvider ResolveIdentityProvider(string? providerKey = null)
    {
        string key = (providerKey ?? _options.IdentityProvider ?? "Manual").Trim().ToLowerInvariant();
        IIdentityVerificationProvider coreProvider = key switch
        {
            "ocr" or "automatedocr" or "ocridentityverificationprovider" => new OcrIdentityVerificationProvider(identityAiService),
            "governmentapi" or "govapi" or "governmentapiidentityverificationprovider" => new GovernmentApiIdentityVerificationProvider(),
            "thirdparty" or "thirdpartyapi" or "thirdpartyidentityverificationprovider" => new ThirdPartyIdentityVerificationProvider(),
            _ => new ManualIdentityVerificationProvider()
        };

        var logged = new LoggingIdentityVerificationDecorator(coreProvider, logger);
        return new ResilienceIdentityVerificationDecorator(logged, logger);
    }

    public IFacialVerificationProvider ResolveFacialProvider(string? providerKey = null)
    {
        string key = (providerKey ?? _options.FacialProvider ?? "Manual").Trim().ToLowerInvariant();
        IFacialVerificationProvider coreProvider = key switch
        {
            "internal" or "internalbiometric" or "internalfacialverificationprovider" => new InternalFacialVerificationProvider(),
            "external" or "externalfacialapi" or "externalfacialapiprovider" => new ExternalFacialApiProvider(),
            _ => new ManualFacialReviewProvider()
        };

        var logged = new LoggingFacialVerificationDecorator(coreProvider, logger);
        return new ResilienceFacialVerificationDecorator(logged, logger);
    }

    public static IIdentityVerificationProvider CreateDefaultIdentityProvider(ILogger? logger = null) =>
        new ResilienceIdentityVerificationDecorator(
            new LoggingIdentityVerificationDecorator(
                new ManualIdentityVerificationProvider(),
                logger),
            logger);

    public static IFacialVerificationProvider CreateDefaultFacialProvider(ILogger? logger = null) =>
        new ResilienceFacialVerificationDecorator(
            new LoggingFacialVerificationDecorator(
                new ManualFacialReviewProvider(),
                logger),
            logger);
}
