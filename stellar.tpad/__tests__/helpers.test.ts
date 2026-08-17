import {
  formatMarketCap,
  formatPriceChange,
  formatPriceChangeColor,
  formatTraderCount,
  formatVolume,
} from '@/lib/helpers';

test('abbreviates market caps and keeps the sign readable', () => {
  expect(formatMarketCap(1_500)).toBe('$1.50K');
  expect(formatMarketCap(2_400_000)).toBe('$2.40M');
  expect(formatMarketCap(3_000_000_000)).toBe('$3.00B');
  expect(formatMarketCap(12.5)).toBe('$12.50');
  expect(formatMarketCap(-1_500)).toBe('-$1.50K');
});

test('falls back to zero instead of rendering NaN', () => {
  expect(formatMarketCap(NaN)).toBe('$0.00');
  expect(formatMarketCap(Infinity)).toBe('$0.00');
  expect(formatVolume(undefined as unknown as number)).toBe('0.00');
  expect(formatPriceChange(NaN)).toBe('+0.00%');
  expect(formatTraderCount(NaN)).toBe('0');
  expect(formatPriceChangeColor(NaN)).toBe('text-pump-green');
});

test('formats volumes, price changes, and trader counts', () => {
  expect(formatVolume(1_234)).toBe('1.23K');
  expect(formatVolume(-2_000_000)).toBe('-2.00M');
  expect(formatPriceChange(4.567)).toBe('+4.57%');
  expect(formatPriceChange(-4.567)).toBe('-4.57%');
  expect(formatPriceChangeColor(-1)).toBe('text-pump-red');
  expect(formatTraderCount(950)).toBe('950');
  expect(formatTraderCount(2_500)).toBe('2.5K');
  expect(formatTraderCount(3_400_000)).toBe('3.4M');
});
