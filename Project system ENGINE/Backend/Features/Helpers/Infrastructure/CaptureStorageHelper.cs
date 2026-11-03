// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Validates multi-format image Data URLs (PNG, JPEG, WebP), checks magic bytes, and persists/reads capture files.
// DO NOT save raw unvalidated file buffers directly to disk.

using System.Text.RegularExpressions;

namespace Backend.Features.Helpers.Infrastructure;

public static class CaptureStorageHelper
{
    private static readonly byte[] PngMagicBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    public static async Task<string?> SaveCaptureDataUrlAsync(string? dataUrl, string folderPath, string prefix, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dataUrl)) return null;

        string base64Data = Regex.Replace(dataUrl.Trim(), @"^data:image\/[a-zA-Z0-9\+\-\.]+;base64,", string.Empty, RegexOptions.IgnoreCase).Trim();
        byte[] imageBytes;

        try
        {
            imageBytes = Convert.FromBase64String(base64Data);
        }
        catch
        {
            return null;
        }

        string? extension = DetectExtensionFromBytes(imageBytes);
        if (extension is null)
            return null;

        Directory.CreateDirectory(folderPath);
        string fileName = $"{prefix}_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{extension}";
        string fullPath = Path.Combine(folderPath, fileName);

        await File.WriteAllBytesAsync(fullPath, imageBytes, ct);
        return fullPath;
    }

    public static Task<string?> SavePngDataUrlAsync(string? dataUrl, string folderPath, string prefix, CancellationToken ct = default) =>
        SaveCaptureDataUrlAsync(dataUrl, folderPath, prefix, ct);

    public static async Task<(byte[] Bytes, string ContentType)> ReadCaptureFileAsync(string? filePath, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
            return (GenerateSyntheticFallbackPng(), "image/png");

        byte[] bytes = await File.ReadAllBytesAsync(filePath, ct);
        return (bytes, DetermineContentType(bytes, filePath));
    }

    public static bool ValidatePngHeader(byte[] bytes) =>
        bytes.Length >= 4 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47;

    public static bool ValidateJpegHeader(byte[] bytes) =>
        bytes.Length >= 3 &&
        bytes[0] == 0xFF &&
        bytes[1] == 0xD8 &&
        bytes[2] == 0xFF;

    public static bool ValidateWebpHeader(byte[] bytes) =>
        bytes.Length >= 12 &&
        bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50;

    public static bool IsValidImageHeader(byte[] bytes) =>
        ValidatePngHeader(bytes) || ValidateJpegHeader(bytes) || ValidateWebpHeader(bytes);

    public static string? DetectExtensionFromBytes(byte[] bytes) =>
        ValidatePngHeader(bytes) ? ".png" :
        ValidateJpegHeader(bytes) ? ".jpg" :
        ValidateWebpHeader(bytes) ? ".webp" :
        null;

    public static string DetermineContentType(byte[]? bytes, string? filePath = null) =>
        bytes != null && ValidatePngHeader(bytes) ? "image/png" :
        bytes != null && ValidateJpegHeader(bytes) ? "image/jpeg" :
        bytes != null && ValidateWebpHeader(bytes) ? "image/webp" :
        !string.IsNullOrWhiteSpace(filePath) ? (Path.GetExtension(filePath).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        }) :
        "image/png";

    public static string DetermineContentType(string filePath) =>
        DetermineContentType(null, filePath);

    public static byte[] GenerateSyntheticFallbackPng() =>
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 
         0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 
         0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 
         0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 
         0x42, 0x60, 0x82];
}
