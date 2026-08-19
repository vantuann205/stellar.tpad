export const UTC7_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

/**
 * Parse a timestamp from any source into a JS Date (always UTC internally).
 *
 * Rules:
 * - If value already has timezone info (Z, +07:00, etc.) → parse as-is
 * - If value has NO timezone → treat as UTC (Postgres stores UTC without suffix)
 * - Numbers → treat as unix seconds if < 1e12, else milliseconds
 */
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

  const normalized = value.trim().replace(' ', 'T');

  // If no timezone suffix → assume UTC (Postgres TIMESTAMP WITHOUT TIME ZONE stores UTC)
  const withTz = hasExplicitTimezone(normalized)
    ? normalized
    : `${normalized}Z`;

  const date = new Date(withTz);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parsePossiblyUtc7TimestampToUnixSeconds(
  value: string | number | Date | null | undefined
): number | null {
  const date = parsePossiblyUtc7Timestamp(value);
  if (!date) return null;
  return Math.floor(date.getTime() / 1000);
}

/** Format a UTC timestamp as a date string in UTC+7 (Vietnam time) */
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

/** Format a UTC timestamp as a date+time string in UTC+7 (Vietnam time) */
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

/**
 * Compact age of a timestamp: `5m`, `3h`, `2d`.
 * Anything in the future, or unparseable, renders as `--`.
 */
export function formatTimeAgoShort(value: string | number | Date | null | undefined): string {
  const date = parsePossiblyUtc7Timestamp(value);
  if (!date) return '--';

  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 0) return '--';
  if (minutes < 60) return `${Math.max(1, minutes)}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Same scale as {@link formatTimeAgoShort} with an `ago` suffix. */
export function formatTimeAgo(value: string | number | Date | null | undefined): string {
  const short = formatTimeAgoShort(value);
  return short === '--' ? short : `${short} ago`;
}
