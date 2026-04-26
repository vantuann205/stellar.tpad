import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  try {
    await ensureDatabaseSchema();

    const tokenResult = await query(
      `SELECT id FROM tokens WHERE LOWER(contract_address) = LOWER($1) LIMIT 1`,
      [params.contractAddress]
    );
    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }
    const tokenId = tokenResult.rows[0].id;

    const tradesResult = await query(
      `SELECT price_per_token, total_price, created_at,
              COALESCE(buyer_address, seller_address) AS actor
       FROM purchases
       WHERE token_id = $1 AND status = 'completed'
       ORDER BY created_at ASC`,
      [tokenId]
    );

    const rows = tradesResult.rows;
    const now = Date.now();

    const calculatePriceChange = (windowMs: number) => {
      const from = now - windowMs;
      const windowRows = rows.filter((r: any) => new Date(r.created_at).getTime() >= from);
      if (windowRows.length < 2) return null;
      const first = Number(windowRows[0].price_per_token || 0);
      const last = Number(windowRows[windowRows.length - 1].price_per_token || 0);
      if (first <= 0) return null;
      return ((last - first) / first) * 100;
    };

    const volume24h = rows
      .filter((r: any) => new Date(r.created_at).getTime() >= (now - 24 * 60 * 60 * 1000))
      .reduce((sum: number, r: any) => sum + Number(r.total_price || 0), 0);

    const traderCount = new Set(
      rows
        .map((r: any) => String(r.actor || '').trim())
        .filter((v: string) => v.length > 0)
    ).size;

    const metrics = {
      price_change_5m: calculatePriceChange(5 * 60 * 1000),
      price_change_1h: calculatePriceChange(60 * 60 * 1000),
      price_change_4h: calculatePriceChange(4 * 60 * 60 * 1000),
      price_change_6h: calculatePriceChange(6 * 60 * 60 * 1000),
      price_change_24h: calculatePriceChange(24 * 60 * 60 * 1000),
      volume_24h: volume24h,
      trader_count: traderCount,
    };

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return NextResponse.json({ success: false, error: 'Failed to calculate metrics' }, { status: 500 });
  }
}
