import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * OHLCV API for TradingView-style charts.
 * tokenId param accepts either a numeric DB id or a contract address string.
 *
 * Candle logic:
 * - open  = price_per_token of the FIRST trade in the bucket (or previous close)
 * - close = price_per_token of the LAST trade in the bucket
 * - high  = max price seen in bucket
 * - low   = min price seen in bucket (always >= 0)
 * - volume = sum of quantity traded in bucket
 *
 * price_per_token is the post-trade price from the bonding curve — always positive.
 * We do NOT reconstruct pre-trade price from slope (that caused negative candles).
 */

export async function GET(request: NextRequest) {
    try {
        const tokenIdParam = request.nextUrl.searchParams.get('tokenId');
        const interval = request.nextUrl.searchParams.get('interval') || '5m';

        if (!tokenIdParam) {
            return NextResponse.json({ error: 'Missing tokenId' }, { status: 400 });
        }

        // Resolve to numeric DB id — accept both integer id and contract address
        const isNumeric = /^\d+$/.test(tokenIdParam);
        const tokenRes = await query(
            isNumeric
                ? `SELECT id, base_price FROM tokens WHERE id = $1 LIMIT 1`
                : `SELECT id, base_price FROM tokens WHERE LOWER(contract_address) = LOWER($1) LIMIT 1`,
            [tokenIdParam]
        ) as any;

        if (!tokenRes?.rows || tokenRes.rows.length === 0) {
            const emptyResponse = NextResponse.json({ success: true, data: [] });
            emptyResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return emptyResponse;
        }

        const tokenRow = tokenRes.rows[0];
        const dbTokenId: number = tokenRow.id;
        const launchPrice: number = parseFloat(tokenRow.base_price || '0') || 0.0001;

        const intervalSeconds: Record<string, number> = {
            '1m': 60, '5m': 300, '15m': 900,
            '1h': 3600, '4h': 14400, '1d': 86400,
        };
        const secs = intervalSeconds[interval] ?? 300;

        // Fetch all trades ordered by time
        const result = await query(
            `SELECT
                (FLOOR(EXTRACT(EPOCH FROM created_at) / $2) * $2)::bigint AS bucket,
                price_per_token::float                                     AS price,
                COALESCE(quantity::float, 0)                               AS qty,
                buyer_address,
                seller_address,
                created_at
            FROM purchases
            WHERE token_id = $1
              AND price_per_token IS NOT NULL
              AND price_per_token::float > 0
              AND status = 'completed'
            ORDER BY created_at ASC`,
            [dbTokenId, secs]
        ) as any;

        if (!result?.rows || result.rows.length === 0) {
            const emptyResponse = NextResponse.json({ success: true, data: [] });
            emptyResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return emptyResponse;
        }

        // Build candles — open = previous close (or launch price for first candle)
        const bucketMap = new Map<number, {
            open: number; close: number;
            high: number; low: number; volume: number;
            tradeCount: number;
        }>();

        let prevClose = launchPrice;

        for (const row of result.rows) {
            const bucket = parseInt(row.bucket);
            const price = parseFloat(row.price);
            const qty = parseFloat(row.qty) || 0;

            if (!bucketMap.has(bucket)) {
                // New candle: open = previous candle's close
                bucketMap.set(bucket, {
                    open: prevClose,
                    close: price,
                    high: Math.max(prevClose, price),
                    low: Math.min(prevClose, price),
                    volume: qty,
                    tradeCount: 1,
                });
            } else {
                const b = bucketMap.get(bucket)!;
                b.close = price;
                b.high = Math.max(b.high, price);
                b.low = Math.min(b.low, price);
                b.volume += qty;
                b.tradeCount++;
            }

            prevClose = price;
        }

        const candles = Array.from(bucketMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([bucket, c]) => ({
                time: bucket,
                open: parseFloat(c.open.toFixed(8)),
                high: parseFloat(c.high.toFixed(8)),
                low: parseFloat(c.low.toFixed(8)),
                close: parseFloat(c.close.toFixed(8)),
                volume: parseFloat(c.volume.toFixed(4)),
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
