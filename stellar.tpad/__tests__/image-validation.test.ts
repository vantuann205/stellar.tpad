import { detectImageType, InvalidImageError, validateImageBuffer } from '@/lib/image-validation';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const svg = Uint8Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

test('detects supported image types from their header bytes', () => {
  expect(detectImageType(png)).toBe('image/png');
  expect(detectImageType(jpeg)).toBe('image/jpeg');
  expect(detectImageType(gif)).toBe('image/gif');
  expect(detectImageType(webp)).toBe('image/webp');
  expect(detectImageType(svg)).toBeNull();
});

test('rejects empty, oversized, and non-image uploads', () => {
  expect(validateImageBuffer(png)).toBe('image/png');
  expect(() => validateImageBuffer(new Uint8Array())).toThrow(InvalidImageError);
  expect(() => validateImageBuffer(svg)).toThrow('Only PNG, JPEG, WebP, or GIF');
  expect(() => validateImageBuffer(new Uint8Array(11), 10)).toThrow('too large');
});
