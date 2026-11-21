// [Layer: Backend/Api/DTOs]
// Responsibility: Encapsulates request and response contracts for inter-agency dispatch requests.
// Universal lambda expressions (=>). Zero emojis.

using System.ComponentModel.DataAnnotations;

namespace Backend.Features.Api.DTOs;

public record CreateDispatchRequest(
    string? RequestCode = null,
    string Direction = "MEDIC_REQUEST",
    string TargetUnit = "LDRRMO",
    string OriginUnit = "RHU",
    string Title = "",
    string? Description = null,
    string Severity = "High",
    string? Status = null,
    string? LocationLabel = null,
    double Latitude = 8.5147,
    double Longitude = 123.2842,
    string? RequestedByName = null,
    string? IpAddress = null
);

public record UpdateDispatchStatusRequest(
    [Required] string Status,
    string? RespondedByName = null,
    string? Notes = null
);

public record DispatchRequestResponse(
    Guid Id,
    string RequestCode,
    string Direction,
    string TargetUnit,
    string OriginUnit,
    string Title,
    string Description,
    string Severity,
    string Status,
    string LocationLabel,
    double Latitude,
    double Longitude,
    string? IpAddress,
    Guid? RequestedByUserId,
    string RequestedByName,
    string? RespondedByName,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
