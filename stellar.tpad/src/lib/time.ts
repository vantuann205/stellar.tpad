export const UTC7_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim());
}

function normalizeTimestampInput(value: string): string {
  return value.trim().replace(' ', 'T');
}

export function parsePossiblyUtc7Timestamp(value: string | number | Date | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const normalized = normalizeTimestampInput(value);
  const isoLike = hasExplicitTimezone(normalized)
    ? normalized
    : `${normalized}+07:00`;
  const date = new Date(isoLike);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parsePossiblyUtc7TimestampToUnixSeconds(
  value: string | number | Date | null | undefined
): number | null {
  const date = parsePossiblyUtc7Timestamp(value);
  if (!date) return null;
  return Math.floor(date.getTime() / 1000);
}

export function formatUtc7Date(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parsePossiblyUtc7Timestamp(value);
  if (!date) return '--';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: UTC7_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(date);
}

export function formatUtc7DateTime(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parsePossiblyUtc7Timestamp(value);
  if (!date) return '--';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: UTC7_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  }).format(date);
}
