/**
 * ohlcv.ts — pure aggregation function, no side effects, no Next.js imports.
 * Converts TradeRecord[] into OHLCVRecord[] bucketed by interval.
 */
import type { TradeRecord, OHLCVRecord } from '@/types';

const INTERVAL_SECONDS: Record<string, number> = {
  '1m':  60,
  '5m':  300,
  '15m': 900,
  '1h':  3600,
  '4h':  14400,
  '1d':  86400,
};

/**
 * Aggregate trades into OHLCV candles.
 * @param trades - array of TradeRecord (any order)
 * @param interval - one of '1m','5m','15m','1h','4h','1d' (defaults to '1m')
 * @returns OHLCVRecord[] sorted ascending by time
 */
export function aggregateOHLCV(trades: TradeRecord[], interval: string): OHLCVRecord[] {
  const secs = INTERVAL_SECONDS[interval] ?? 60;

  // bucket key → trades in that bucket (sorted by timestamp asc)
  const buckets = new Map<number, TradeRecord[]>();

  for (const trade of trades) {
    const unixSec = Math.floor(new Date(trade.timestamp).getTime() / 1000);
    const bucket = Math.floor(unixSec / secs) * secs;
    const list = buckets.get(bucket) ?? [];
    list.push(trade);
    buckets.set(bucket, list);
  }

  const candles: OHLCVRecord[] = [];

  for (const [time, list] of buckets) {
    // sort within bucket by timestamp asc
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const prices = list.map(t => t.price);
    const volume = list.reduce((sum, t) => sum + Number(t.xlmAmount) / 1e7, 0);

    candles.push({
      time,
      open:  prices[0],
      close: prices[prices.length - 1],
      high:  Math.max(...prices),
      low:   Math.min(...prices),
      volume,
    });
  }

  // sort candles ascending by time
  candles.sort((a, b) => a.time - b.time);
  return candles;
}
