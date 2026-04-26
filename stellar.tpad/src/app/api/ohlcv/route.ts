import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * OHLCV API for TradingView-style charts
 */

export async function GET(request: NextRequest) {
    try {
        const tokenId = request.nextUrl.searchParams.get('tokenId');
        const interval = request.nextUrl.searchParams.get('interval') || '5m';

        if (!tokenId) {
            return NextResponse.json({ error: 'Missing tokenId' }, { status: 400 });
        }

        // Fetch token-specific slope and base_price for accurate wick calculation
        const tokenRes = await query(`SELECT slope, base_price FROM tokens WHERE id = $1 OR contract_address = $1 LIMIT 1`, [tokenId]);
        const tokenData = tokenRes.rows[0];
        // Default to a sensible slope if not found (matching contract)
        const TOKEN_SLOPE = tokenData ? parseFloat(tokenData.slope) / 1e7 : 0.0025;

        const intervalSeconds: Record<string, number> = {
            '1m': 60, '5m': 300, '15m': 900,
            '1h': 3600, '4h': 14400, '1d': 86400,
        };
        const secs = intervalSeconds[interval] ?? 300;

        // Build candles from completed trades. `price_per_token` is the post-trade price,
        // so we reconstruct the pre-trade edge from quantity and bonding slope.
        const result = await query(
            `SELECT
                (FLOOR(EXTRACT(EPOCH FROM created_at) / $2) * $2)::bigint AS bucket,
                price_per_token::float                                     AS end_price,
                COALESCE(
                    quantity::float,
                    CASE
                        WHEN price_per_token::float = 0 THEN 0
                        ELSE total_price::float / price_per_token::float
                    END
                )                                                          AS qty,
                total_price::float                                         AS total_price,
                buyer_address,
                seller_address,
                created_at
            FROM purchases
            WHERE (
                    token_id = $1
                    OR token_id = (
                        SELECT id
                        FROM tokens
                        WHERE contract_address = $1
                        LIMIT 1
                    )
                )
              AND price_per_token IS NOT NULL
              AND price_per_token::float > 0
              AND status = 'completed'
            ORDER BY created_at ASC`,
            [tokenId, secs]
        );

        if (result.rows.length === 0) {
            const emptyResponse = NextResponse.json({ success: true, data: [] });
            emptyResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return emptyResponse;
        }

        // Group by bucket, calculate OHLCV with buy/sell direction using post-trade price.
        const bucketMap = new Map<number, {
            open: number; close: number;
            high: number; low: number; volume: number;
        }>();

        for (const row of result.rows) {
            const bucket = parseInt(row.bucket);
            const endPrice = parseFloat(row.end_price);
            const qty = parseFloat(row.qty) || 0;
            const isBuy = !!row.buyer_address && !row.seller_address;
            const priceDelta = qty * TOKEN_SLOPE;
            const startPrice = isBuy ? endPrice - priceDelta : endPrice + priceDelta;
            const hi = Math.max(startPrice, endPrice);
            const lo = Math.min(startPrice, endPrice);

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
                b.close = endPrice;
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

        const response = NextResponse.json({ success: true, data: candles });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    } catch (error) {
        console.error('Error fetching OHLCV:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed' },
            { status: 500 }
        );
    }
}
