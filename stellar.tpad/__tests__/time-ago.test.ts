import { formatTimeAgo, formatTimeAgoShort } from '@/lib/time';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test('renders ages on a minute, hour, and day scale', () => {
  const now = Date.now();
  expect(formatTimeAgoShort(now)).toBe('1m');
  expect(formatTimeAgoShort(now - 5 * MINUTE)).toBe('5m');
  expect(formatTimeAgoShort(now - 3 * HOUR)).toBe('3h');
  expect(formatTimeAgoShort(now - 2 * DAY)).toBe('2d');
  expect(formatTimeAgo(now - 3 * HOUR)).toBe('3h ago');
});

test('renders unusable and future timestamps as a placeholder', () => {
  expect(formatTimeAgoShort(null)).toBe('--');
  expect(formatTimeAgoShort('not-a-date')).toBe('--');
  expect(formatTimeAgoShort(Date.now() + HOUR)).toBe('--');
  expect(formatTimeAgo(null)).toBe('--');
});

test('accepts the timestamp shapes the API returns', () => {
  const iso = new Date(Date.now() - 2 * HOUR).toISOString();
  expect(formatTimeAgoShort(iso)).toBe('2h');

  const postgresStyle = new Date(Date.now() - 2 * HOUR).toISOString().replace('T', ' ').replace('Z', '');
  expect(formatTimeAgoShort(postgresStyle)).toBe('2h');
});
