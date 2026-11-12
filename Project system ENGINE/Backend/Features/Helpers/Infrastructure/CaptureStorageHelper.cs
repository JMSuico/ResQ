// [Layer: Backend/Helpers/Infrastructure]
// Responsibility: Validates multi-format image Data URLs (PNG, JPEG, WebP), checks magic bytes, and persists/reads AES-256-GCM encrypted capture files.
// Compliance: Philippine Data Privacy Act of 2012 (RA 10173 Section 20) & NPC Circular 16-01. Zero emojis.

using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Backend.Features.Helpers.Infrastructure;

public static class CaptureStorageHelper
{
    private static readonly byte[] EncryptedFileMarker = [0x52, 0x51, 0x54, 0x43]; // "RQTC" header
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private const int MaxUploadSizeBytes = 5 * 1024 * 1024; // 5.0 MB maximum

    private static byte[] GetMasterEncryptionKey()
    {
        string? keyEnv = Environment.GetEnvironmentVariable("RESQTRACK_CAPTURE_KEY");
        if (!string.IsNullOrWhiteSpace(keyEnv) && keyEnv.Length >= 16)
        {
            return SHA256.HashData(Encoding.UTF8.GetBytes(keyEnv));
        }
        return SHA256.HashData(Encoding.UTF8.GetBytes("ResQTrack_Katipunan_7109_MasterCaptureVaultKey_DefaultSecure"));
    }

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

        // 1. Enforce payload size limit (max 5 MB)
        if (imageBytes.Length == 0 || imageBytes.Length > MaxUploadSizeBytes)
            return null;

        // 2. Enforce magic-byte header validation (must be authentic PNG, JPEG, or WebP)
        if (!IsValidImageHeader(imageBytes))
            return null;

        string? extension = DetectExtensionFromBytes(imageBytes);
        if (extension is null)
            return null;

        Directory.CreateDirectory(folderPath);
        string fileName = $"{prefix}_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{extension}.enc";
        string fullPath = Path.Combine(folderPath, fileName);

        // 3. Encrypt payload with AES-256-GCM before writing to disk
        byte[] key = GetMasterEncryptionKey();
        byte[] nonce = RandomNumberGenerator.GetBytes(NonceSize);
        byte[] tag = new byte[TagSize];
        byte[] ciphertext = new byte[imageBytes.Length];

        using (var aesGcm = new AesGcm(key, TagSize))
        {
            aesGcm.Encrypt(nonce, imageBytes, ciphertext, tag);
        }

        // File format: [4-byte RQTC marker] + [12-byte Nonce] + [16-byte Tag] + [Ciphertext]
        byte[] encryptedFileBuffer = new byte[EncryptedFileMarker.Length + NonceSize + TagSize + ciphertext.Length];
        Buffer.BlockCopy(EncryptedFileMarker, 0, encryptedFileBuffer, 0, EncryptedFileMarker.Length);
        Buffer.BlockCopy(nonce, 0, encryptedFileBuffer, EncryptedFileMarker.Length, NonceSize);
        Buffer.BlockCopy(tag, 0, encryptedFileBuffer, EncryptedFileMarker.Length + NonceSize, TagSize);
        Buffer.BlockCopy(ciphertext, 0, encryptedFileBuffer, EncryptedFileMarker.Length + NonceSize + TagSize, ciphertext.Length);

        await File.WriteAllBytesAsync(fullPath, encryptedFileBuffer, ct);
        return fullPath;
    }

    public static Task<string?> SavePngDataUrlAsync(string? dataUrl, string folderPath, string prefix, CancellationToken ct = default) =>
        SaveCaptureDataUrlAsync(dataUrl, folderPath, prefix, ct);

    public static async Task<(byte[] Bytes, string ContentType)> ReadCaptureFileAsync(string? filePath, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
            return (GenerateSyntheticFallbackPng(), "image/png");

        byte[] rawDiskBytes = await File.ReadAllBytesAsync(filePath, ct);

        // Check if file is encrypted with RQTC marker
        bool isEncrypted = rawDiskBytes.Length >= (EncryptedFileMarker.Length + NonceSize + TagSize) &&
                           rawDiskBytes[0] == EncryptedFileMarker[0] &&
                           rawDiskBytes[1] == EncryptedFileMarker[1] &&
                           rawDiskBytes[2] == EncryptedFileMarker[2] &&
                           rawDiskBytes[3] == EncryptedFileMarker[3];

        if (isEncrypted)
        {
            try
            {
                byte[] key = GetMasterEncryptionKey();
                byte[] nonce = new byte[NonceSize];
                byte[] tag = new byte[TagSize];
                int ciphertextOffset = EncryptedFileMarker.Length + NonceSize + TagSize;
                int ciphertextSize = rawDiskBytes.Length - ciphertextOffset;
                byte[] ciphertext = new byte[ciphertextSize];
                byte[] plaintext = new byte[ciphertextSize];

                Buffer.BlockCopy(rawDiskBytes, EncryptedFileMarker.Length, nonce, 0, NonceSize);
                Buffer.BlockCopy(rawDiskBytes, EncryptedFileMarker.Length + NonceSize, tag, 0, TagSize);
                Buffer.BlockCopy(rawDiskBytes, ciphertextOffset, ciphertext, 0, ciphertextSize);

                using (var aesGcm = new AesGcm(key, TagSize))
                {
                    aesGcm.Decrypt(nonce, ciphertext, tag, plaintext);
                }

                return (plaintext, DetermineContentType(plaintext, filePath));
            }
            catch
            {
                return (GenerateSyntheticFallbackPng(), "image/png");
            }
        }

        // Backward compatibility: legacy unencrypted file read
        return (rawDiskBytes, DetermineContentType(rawDiskBytes, filePath));
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
        !string.IsNullOrWhiteSpace(filePath) ? (Path.GetExtension(filePath).Replace(".enc", "").ToLowerInvariant() switch
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

    public record ImageValidationResult(
        bool IsValid,
        string StatusCode,
        int HttpStatusCode,
        string? ErrorMessage,
        int ByteLength = 0,
        string? DetectedExtension = null,
        string? DetectedContentType = null,
        int Width = 0,
        int Height = 0
    );

    public static ImageValidationResult InspectAndValidateImage(
        string? dataUrl,
        string fieldLabel = "Image",
        int maxBytes = MaxUploadSizeBytes,
        int minWidth = 1,
        int minHeight = 1,
        int maxWidth = 8192,
        int maxHeight = 8192)
    {
        if (string.IsNullOrWhiteSpace(dataUrl))
            return new ImageValidationResult(false, "EMPTY_PAYLOAD", 400, $"{fieldLabel} is required.");

        string trimmed = dataUrl.Trim();
        if (trimmed.StartsWith("data:", StringComparison.OrdinalIgnoreCase) &&
            !Regex.IsMatch(trimmed, @"^data:image\/(png|jpeg|jpg|webp);base64,", RegexOptions.IgnoreCase))
        {
            return new ImageValidationResult(false, "UNSUPPORTED_MEDIA_TYPE", 415, $"{fieldLabel} has an unsupported MIME type. Only PNG, JPEG, and WebP images are permitted.");
        }

        string base64Data = Regex.Replace(trimmed, @"^data:image\/[a-zA-Z0-9\+\-\.]+;base64,", string.Empty, RegexOptions.IgnoreCase).Trim();
        if (string.IsNullOrWhiteSpace(base64Data))
            return new ImageValidationResult(false, "EMPTY_PAYLOAD", 400, $"{fieldLabel} contains no binary image payload.");

        // Quick pre-decode size estimate check (~3/4 of base64 length)
        long estimatedBytes = ((long)base64Data.Length * 3) / 4;
        if (estimatedBytes > maxBytes + 4096)
            return new ImageValidationResult(false, "PAYLOAD_TOO_LARGE", 413, $"{fieldLabel} exceeds the maximum allowed upload size of {maxBytes / (1024 * 1024)} MB.");

        byte[] imageBytes;
        try
        {
            imageBytes = Convert.FromBase64String(base64Data);
        }
        catch
        {
            return new ImageValidationResult(false, "UNSUPPORTED_MEDIA_TYPE", 415, $"{fieldLabel} contains malformed Base64 data or unsupported binary encoding.");
        }

        if (imageBytes.Length == 0)
            return new ImageValidationResult(false, "EMPTY_PAYLOAD", 400, $"{fieldLabel} decoded to 0 bytes.");

        if (imageBytes.Length > maxBytes)
            return new ImageValidationResult(false, "PAYLOAD_TOO_LARGE", 413, $"{fieldLabel} size ({imageBytes.Length:N0} bytes) exceeds the maximum allowed limit of {maxBytes:N0} bytes ({maxBytes / (1024 * 1024)} MB).");

        if (!IsValidImageHeader(imageBytes))
            return new ImageValidationResult(false, "UNSUPPORTED_MEDIA_TYPE", 415, $"{fieldLabel} failed magic-byte header validation. Uploaded file content must be an authentic PNG, JPEG, or WebP image.");

        string? ext = DetectExtensionFromBytes(imageBytes);
        string contentType = DetermineContentType(imageBytes);

        if (TryReadImageDimensions(imageBytes, out int width, out int height) && width > 0 && height > 0)
        {
            if (width < minWidth || height < minHeight || width > maxWidth || height > maxHeight)
            {
                return new ImageValidationResult(
                    false,
                    "INVALID_DIMENSIONS",
                    422,
                    $"{fieldLabel} dimensions ({width}x{height}px) are outside the allowed range ({minWidth}x{minHeight}px to {maxWidth}x{maxHeight}px).",
                    imageBytes.Length,
                    ext,
                    contentType,
                    width,
                    height);
            }

            return new ImageValidationResult(true, "VALID", 200, null, imageBytes.Length, ext, contentType, width, height);
        }

        return new ImageValidationResult(true, "VALID", 200, null, imageBytes.Length, ext, contentType, 0, 0);
    }

    public static bool TryReadImageDimensions(byte[] bytes, out int width, out int height)
    {
        width = 0;
        height = 0;
        if (bytes == null || bytes.Length < 16) return false;

        // 1. PNG: IHDR chunk at offset 16..23 (Big-Endian)
        if (ValidatePngHeader(bytes) && bytes.Length >= 24)
        {
            width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
            height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
            return width > 0 && height > 0;
        }

        // 2. JPEG: Scan markers for SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        if (ValidateJpegHeader(bytes))
        {
            int idx = 2;
            while (idx + 8 < bytes.Length)
            {
                if (bytes[idx] != 0xFF)
                {
                    idx++;
                    continue;
                }
                while (idx < bytes.Length && bytes[idx] == 0xFF) idx++;
                if (idx >= bytes.Length) break;

                byte marker = bytes[idx++];
                if (marker == 0xD8 || marker == 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker == 0x01)
                    continue;

                if (idx + 1 >= bytes.Length) break;
                int segLength = (bytes[idx] << 8) | bytes[idx + 1];
                if (segLength < 2 || idx + segLength > bytes.Length) break;

                bool isSof = (marker >= 0xC0 && marker <= 0xC3) ||
                             (marker >= 0xC5 && marker <= 0xC7) ||
                             (marker >= 0xC9 && marker <= 0xCB) ||
                             (marker >= 0xCD && marker <= 0xCF);
                if (isSof && idx + 6 < bytes.Length)
                {
                    height = (bytes[idx + 3] << 8) | bytes[idx + 4];
                    width = (bytes[idx + 5] << 8) | bytes[idx + 6];
                    return width > 0 && height > 0;
                }

                idx += segLength;
            }
            return false;
        }

        // 3. WebP: VP8X / VP8L / VP8
        if (ValidateWebpHeader(bytes) && bytes.Length >= 30)
        {
            string chunk = Encoding.ASCII.GetString(bytes, 12, 4);
            if (chunk == "VP8X" && bytes.Length >= 30)
            {
                width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
                height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
                return width > 0 && height > 0;
            }
            if (chunk == "VP8L" && bytes.Length >= 25)
            {
                int b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
                width = 1 + (((b1 & 0x3F) << 8) | b0);
                height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
                return width > 0 && height > 0;
            }
            if (chunk == "VP8 " && bytes.Length >= 30)
            {
                width = ((bytes[26] | (bytes[27] << 8)) & 0x3FFF);
                height = ((bytes[28] | (bytes[29] << 8)) & 0x3FFF);
                return width > 0 && height > 0;
            }
        }

        return false;
    }
}
