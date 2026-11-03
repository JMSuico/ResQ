// [Layer: Backend/Api/Middleware]
// Responsibility: Catches unhandled runtime exceptions and returns safe standardized JSON responses.
// DO NOT leak internal stack traces to client browsers in production.

using System.Net;
using System.Text.Json;

namespace Backend.Features.Api.Middleware;

public class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger,
    IWebHostEnvironment _env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception occurred during request processing. Incident ID: {IncidentId}", context.TraceIdentifier);
            await HandleExceptionAsync(context, ex);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        string incidentId = context.TraceIdentifier;
        var response = new
        {
            statusCode = context.Response.StatusCode,
            message = "An error occurred while processing your emergency request.",
            error = ResolveErrorMessage(exception),
            details = ResolveDetails(exception, incidentId),
            incidentId
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }

    private string ResolveErrorMessage(Exception exception) =>
        _env.IsDevelopment()
            ? (exception.InnerException?.Message ?? exception.Message)
            : "Internal Server Error";

    private string ResolveDetails(Exception exception, string incidentId) =>
        _env.IsDevelopment()
            ? exception.ToString()
            : $"An internal server error occurred. Please contact system administrator. (Incident ID: {incidentId})";
}
