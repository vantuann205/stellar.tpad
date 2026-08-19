import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/holders?tokenId=123
// % holding = net_qty_of_wallet / total_supply_of_token * 100
export async function GET(request: NextRequest) {
    try {
        const rawTokenId = request.nextUrl.searchParams.get('tokenId');
        const tokenId = Number(rawTokenId);
        // `id` is an INTEGER column: a non-numeric value makes Postgres raise
        // instead of returning "not found".
        if (!Number.isInteger(tokenId) || tokenId <= 0) {
            return NextResponse.json({ error: 'tokenId must be a positive integer' }, { status: 400 });
        }

        // Get total_supply from tokens table
        const supplyResult = await query(
            `SELECT total_supply FROM tokens WHERE id = $1`,
            [tokenId]
        ) as any;

        if (!supplyResult?.rows || supplyResult.rows.length === 0) {
            return NextResponse.json({ error: 'Token not found' }, { status: 404 });
        }

        const totalSupply = parseFloat(supplyResult.rows[0].total_supply || '0');

        // Net balance per wallet: total buy - total sell
        const result = await query(
            `SELECT
                address,
                SUM(net_qty) AS net_qty
             FROM (
                 SELECT buyer_address AS address, SUM(quantity::numeric) AS net_qty
                 FROM purchases
                 WHERE token_id = $1 AND buyer_address IS NOT NULL AND status = 'completed'
                 GROUP BY buyer_address

                 UNION ALL

                 SELECT seller_address AS address, -SUM(quantity::numeric) AS net_qty
                 FROM purchases
                 WHERE token_id = $1 AND seller_address IS NOT NULL AND status = 'completed'
                 GROUP BY seller_address
             ) t
             GROUP BY address
             HAVING SUM(net_qty) > 0
             ORDER BY SUM(net_qty) DESC
             LIMIT 10`,
            [tokenId]
        ) as any;

        const holders = result?.rows?.map((r: any, i: number) => {
            const qty = parseFloat(r.net_qty);
            // % = tokens held by wallet / total supply * 100
            const pct = totalSupply > 0 ? (qty / totalSupply) * 100 : 0;
            return {
                rank: i + 1,
                qty,
                pct: Math.round(pct * 100) / 100,
            };
        });

        return NextResponse.json({ success: true, data: holders, totalSupply });
    } catch (error) {
        console.error('Error fetching holders:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch holders' }, { status: 500 });
    }
}
