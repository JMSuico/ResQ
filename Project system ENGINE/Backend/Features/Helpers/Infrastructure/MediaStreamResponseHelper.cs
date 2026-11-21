// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Builds HTTP 206 Partial Content byte-range responses or unbuffered media stream responses with security headers.
// Universal lambda expressions (=>). Zero emojis.

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Features.Helpers.Infrastructure;

public static class MediaStreamResponseHelper
{
    public static IActionResult CreateBytesOrRangeResponse(HttpContext? httpContext, byte[] bytes, string contentType)
    {
        if (httpContext != null)
        {
            httpContext.Response.Headers["X-Accel-Buffering"] = "no";
            httpContext.Response.Headers["Accept-Ranges"] = "bytes";
            httpContext.Response.Headers["Cache-Control"] = "private, no-cache";
            httpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";

            if (bytes.Length > 0 &&
                httpContext.Request.Headers.TryGetValue("Range", out var rangeValues) &&
                rangeValues.FirstOrDefault() is { } rangeHeader &&
                rangeHeader.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase))
            {
                string spec = rangeHeader["bytes=".Length..].Split(',')[0].Trim();
                string[] parts = spec.Split('-', 2);
                if (parts.Length == 2 && int.TryParse(parts[0], out int rawStart))
                {
                    int start = Math.Clamp(rawStart, 0, bytes.Length - 1);
                    int end = int.TryParse(parts[1], out int rawEnd)
                        ? Math.Clamp(rawEnd, start, bytes.Length - 1)
                        : bytes.Length - 1;

                    byte[] slice = bytes[start..(end + 1)];
                    httpContext.Response.StatusCode = StatusCodes.Status206PartialContent;
                    httpContext.Response.Headers["Content-Range"] = $"bytes {start}-{end}/{bytes.Length}";
                    return new FileContentResult(slice, contentType);
                }
            }
        }

        return new FileContentResult(bytes, contentType)
        {
            EnableRangeProcessing = true
        };
    }
}
