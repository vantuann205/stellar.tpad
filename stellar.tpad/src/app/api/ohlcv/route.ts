import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Bonding curve slope for Stellar: adjust based on your bonding curve formula
// For linear curve: price increases by SLOPE per token
const SLOPE = 0.00001;

/**
 * Calculate price range from avgPrice and quantity
 * For bonding curve: price = base + soldSupply * slope
 * avgPrice = (startPrice + endPrice) / 2
 * endPrice = startPrice + quantity * slope
 * => startPrice = avgPrice - (quantity * slope) / 2
 * => endPrice   = avgPrice + (quantity * slope) / 2
 */
function calcPriceRange(avgPrice: number, quantity: number, isBuy: boolean): { lo: number; hi: number } {
    const half = (quantity * SLOPE) / 2;
    const start = avgPrice - half;
    const end = avgPrice + half;
    // buy: price goes from start to end (increasing)
    // sell: price goes from start to end (decreasing)
    return {
        lo: Math.min(start, end, avgPrice),
        hi: Math.max(start, end, avgPrice),
    };
}

export async function GET(request: NextRequest) {
    try {
        const tokenId = request.nextUrl.searchParams.get('tokenId');
        const interval = request.nextUrl.searchParams.get('interval') || '5m';

        if (!tokenId) {
            return NextResponse.json({ error: 'Missing tokenId' }, { status: 400 });
        }

        const intervalSeconds: Record<string, number> = {
            '1m': 60, '5m': 300, '15m': 900,
            '1h': 3600, '4h': 14400, '1d': 86400,
        };
        const secs = intervalSeconds[interval] ?? 300;

        // Get individual trades to calculate accurate high/low
        const result = await query(
            `WITH normalized AS (
                SELECT
                    CASE
                        WHEN created_at > NOW() + INTERVAL '30 minutes' THEN created_at - INTERVAL '7 hours'
                        ELSE created_at
                    END                                                      AS trade_ts,
                    price_per_token::float                                   AS avg_price,
                    COALESCE(
                        quantity::float,
                        CASE
                            WHEN price_per_token::float = 0 THEN 0
                            ELSE total_price::float / price_per_token::float
                        END
                    )                                                        AS qty,
                    total_price::float                                       AS total_price,
                    buyer_address
                FROM purchases
                WHERE token_id = $1
                  AND price_per_token IS NOT NULL
                  AND price_per_token::float > 0
                  AND status = 'completed'
            )
            SELECT
                (FLOOR(EXTRACT(EPOCH FROM trade_ts) / $2) * $2)::bigint     AS bucket,
                avg_price,
                qty,
                total_price,
                buyer_address,
                trade_ts                                                     AS created_at
            FROM normalized
            ORDER BY trade_ts ASC`,
            [tokenId, secs]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Group by bucket, calculate OHLCV with high/low wicks
        const bucketMap = new Map<number, {
            open: number; close: number;
            high: number; low: number; volume: number;
        }>();

        for (const row of result.rows) {
            const bucket = parseInt(row.bucket);
            const avgPrice = parseFloat(row.avg_price);
            const qty = parseFloat(row.qty) || 0;
            const isBuy = !!row.buyer_address;

            // Calculate actual price range for this trade (with wicks)
            const { lo, hi } = calcPriceRange(avgPrice, qty, isBuy);

            // startPrice = price before trade, endPrice = price after
            const startPrice = isBuy ? lo : hi;
            const endPrice   = isBuy ? hi : lo;

            if (!bucketMap.has(bucket)) {
                bucketMap.set(bucket, {
                    open: startPrice,
                    close: endPrice,
                    high: hi,
                    low: lo,
                    volume: qty,
                });
            } else {
                const b = bucketMap.get(bucket)!;
                b.high = Math.max(b.high, hi);
                b.low = Math.min(b.low, lo);
                b.volume += qty;
                b.close = endPrice; // close = endPrice of last tx
            }
        }

        // Sort and build candles
        const candles = Array.from(bucketMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([bucket, c]) => ({
                time: bucket,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume,
            }));

        return NextResponse.json({ success: true, data: candles });
    } catch (error) {
        console.error('Error fetching OHLCV:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed' },
            { status: 500 }
        );
    }
}
