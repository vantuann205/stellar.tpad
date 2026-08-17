/** Coerce API values (numeric strings, nulls, NaN) into a finite number. */
function toFiniteNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function abbreviate(value: number, fractionDigits: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(fractionDigits)}B`;
  if (magnitude >= 1_000_000) return `${(value / 1_000_000).toFixed(fractionDigits)}M`;
  if (magnitude >= 1_000) return `${(value / 1_000).toFixed(fractionDigits)}K`;
  return value.toFixed(fractionDigits);
}

export function formatMarketCap(value: number): string {
  const amount = toFiniteNumber(value);
  const formatted = abbreviate(Math.abs(amount), 2);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatVolume(value: number): string {
  return abbreviate(toFiniteNumber(value), 2);
}

export function formatPriceChange(value: number): string {
  const change = toFiniteNumber(value);
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export function formatPriceChangeColor(value: number): string {
  return toFiniteNumber(value) >= 0 ? 'text-pump-green' : 'text-pump-red';
}

export function formatTraderCount(value: number): string {
  const count = toFiniteNumber(value);
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(Math.trunc(count));
}
