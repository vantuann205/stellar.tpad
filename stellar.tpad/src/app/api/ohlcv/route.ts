import { NextRequest, NextResponse } from 'next/server';
import { tradeStore } from '@/app/api/trades/route';
import { aggregateOHLCV } from '@/lib/ohlcv';

const VALID_INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);

export async function GET(req: NextRequest) {
  const tokenId  = req.nextUrl.searchParams.get('tokenId');
  const interval = req.nextUrl.searchParams.get('interval') ?? '1m';

  if (!tokenId) {
    return NextResponse.json({ success: false, error: 'tokenId is required' }, { status: 400 });
  }

  const safeInterval = VALID_INTERVALS.has(interval) ? interval : '1m';
  const trades = tradeStore.get(tokenId) ?? [];
  const candles = aggregateOHLCV(trades, safeInterval);

  return NextResponse.json({ success: true, data: candles });
}
