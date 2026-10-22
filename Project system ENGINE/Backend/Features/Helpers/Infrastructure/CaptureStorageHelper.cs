// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Validates PNG Data URLs, checks magic bytes, and persists capture files.
// DO NOT save raw unvalidated file buffers directly to disk.

using System.Text.RegularExpressions;

namespace Backend.Features.Helpers.Infrastructure;

public static class CaptureStorageHelper
{
    private static readonly byte[] PngMagicBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    public static async Task<string?> SavePngDataUrlAsync(string? dataUrl, string folderPath, string prefix, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dataUrl)) return null;

        string base64Data = Regex.Replace(dataUrl, @"^data:image\/[a-zA-Z]+;base64,", string.Empty);
        byte[] imageBytes;

        try
        {
            imageBytes = Convert.FromBase64String(base64Data);
        }
        catch
        {
            return null;
        }

        if (imageBytes.Length < 8 || !ValidatePngHeader(imageBytes))
            return null;

        Directory.CreateDirectory(folderPath);
        string fileName = $"{prefix}_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}.png";
        string fullPath = Path.Combine(folderPath, fileName);

        await File.WriteAllBytesAsync(fullPath, imageBytes, ct);
        return fullPath;
    }

    public static bool ValidatePngHeader(byte[] bytes) =>
        bytes.Length >= 8 &&
        bytes[0] == PngMagicBytes[0] &&
        bytes[1] == PngMagicBytes[1] &&
        bytes[2] == PngMagicBytes[2] &&
        bytes[3] == PngMagicBytes[3] &&
        bytes[4] == PngMagicBytes[4] &&
        bytes[5] == PngMagicBytes[5] &&
        bytes[6] == PngMagicBytes[6] &&
        bytes[7] == PngMagicBytes[7];

    public static byte[] GenerateSyntheticFallbackPng() =>
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 
         0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 
         0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 
         0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 
         0x42, 0x60, 0x82];
}
