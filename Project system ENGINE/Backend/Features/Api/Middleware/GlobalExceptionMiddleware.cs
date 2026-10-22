// [Layer: Backend/Api/Middleware]
// Responsibility: Catches unhandled runtime exceptions and returns safe standardized JSON responses.
// DO NOT leak internal stack traces to client browsers in production.

using System.Net;
using System.Text.Json;

namespace Backend.Features.Api.Middleware;

public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception occurred during request processing.");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        var response = new
        {
            statusCode = context.Response.StatusCode,
            message = "An error occurred while processing your emergency request.",
            error = exception.InnerException?.Message ?? exception.Message,
            details = exception.ToString()
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
