// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Sanitizes untrusted user strings and prevents XSS attacks.
// DO NOT pass unsanitized HTML/JS inputs directly into database entities.

using System.Net;
using System.Text.RegularExpressions;

namespace Backend.Features.Helpers.Infrastructure;

public static class InputSanitizer
{
    private static readonly Regex ScriptPattern = new(@"<script[^>]*>[\s\S]*?<\/script>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex HtmlTagPattern = new(@"<[^>]+>", RegexOptions.Compiled);

    public static string Sanitize(string? input) =>
        string.IsNullOrWhiteSpace(input)
            ? string.Empty
            : WebUtility.HtmlEncode(HtmlTagPattern.Replace(ScriptPattern.Replace(input.Trim(), string.Empty), string.Empty));
}
