// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Sanitizes untrusted user strings and prevents XSS attacks.
// DO NOT pass unsanitized HTML/JS inputs directly into database entities.

using System.Text.RegularExpressions;

namespace Backend.Features.Helpers.Infrastructure;

public static class InputSanitizer
{
    private static readonly Regex ScriptPattern = new(@"<\s*script[^>]*>[\s\S]*?<\/\s*script\s*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex DangerousBlockPattern = new(@"<\s*(?:style|iframe|object|embed|applet|svg|math)[^>]*>[\s\S]*?<\/\s*(?:style|iframe|object|embed|applet|svg|math)\s*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex DangerousStandalonePattern = new(@"<\s*(?:script|style|iframe|object|embed|applet|meta|link|base)[^>]*\/?>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex HtmlTagPattern = new(@"<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex JavascriptPseudoPattern = new(@"javascript\s*:", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string Sanitize(string? input) =>
        string.IsNullOrWhiteSpace(input)
            ? string.Empty
            : HtmlTagPattern.Replace(
                DangerousStandalonePattern.Replace(
                    DangerousBlockPattern.Replace(
                        ScriptPattern.Replace(
                            JavascriptPseudoPattern.Replace(input.Trim(), string.Empty),
                            string.Empty),
                        string.Empty),
                    string.Empty),
                string.Empty).Trim();
}
