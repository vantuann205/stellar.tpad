export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

/**
 * Detect the real image type from the file header.
 * The browser-supplied MIME type is attacker-controlled, so the magic bytes decide.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/** Validate an uploaded image buffer, returning the detected MIME type. */
export function validateImageBuffer(bytes: Uint8Array, maxBytes = MAX_IMAGE_BYTES): string {
  if (bytes.length === 0) {
    throw new InvalidImageError('File is empty');
  }
  if (bytes.length > maxBytes) {
    throw new InvalidImageError(`File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`);
  }

  const detected = detectImageType(bytes);
  if (!detected) {
    throw new InvalidImageError('Only PNG, JPEG, WebP, or GIF images are allowed');
  }
  return detected;
}
