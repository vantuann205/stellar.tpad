import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  try {
    await ensureDatabaseSchema();

    // First, try to get cached metrics from tokens table
    const tokenResult = await query(
      `SELECT 
        id, 
        current_price,
        marketcap,
        volume_24h,
        price_change_5m,
        price_change_1h,
        price_change_4h,
        price_change_6h,
        price_change_24h,
        trader_count,
        metrics_updated_at,
        price_snapshot_value
      FROM tokens 
      WHERE LOWER(contract_address) = LOWER($1) 
      LIMIT 1`,
      [params.contractAddress]
    );
    
    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }
    
    const token = tokenResult.rows[0];
    const tokenId = token.id;
    const metricsAge = token.metrics_updated_at 
      ? Date.now() - new Date(token.metrics_updated_at).getTime()
      : Infinity;

    // If metrics are fresh (less than 5 seconds old), return cached data
    if (metricsAge < 5000) {
      return NextResponse.json({
        success: true,
        data: {
          current_price: token.current_price,
          marketcap: token.marketcap,
          volume_24h: token.volume_24h,
          price_change_5m: token.price_change_5m,
          price_change_1h: token.price_change_1h,
          price_change_4h: token.price_change_4h,
          price_change_6h: token.price_change_6h,
          price_change_24h: token.price_change_24h,
          trader_count: token.trader_count,
          price_snapshot_value: token.price_snapshot_value,
        },
      });
    }

    // Otherwise, recalculate metrics
    const tradesResult = await query(
      `SELECT 
        price_per_token, 
        total_price, 
        created_at,
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
      if (windowRows.length < 2) return 0;
      const first = Number(windowRows[0].price_per_token || 0);
      const last = Number(windowRows[windowRows.length - 1].price_per_token || 0);
      if (first <= 0) return 0;
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

    const currentPrice = rows.length > 0 
      ? Number(rows[rows.length - 1].price_per_token || 0)
      : 0;

    const metrics = {
      current_price: currentPrice,
      marketcap: token.marketcap || 0,
      price_change_5m: calculatePriceChange(5 * 60 * 1000),
      price_change_1h: calculatePriceChange(60 * 60 * 1000),
      price_change_4h: calculatePriceChange(4 * 60 * 60 * 1000),
      price_change_6h: calculatePriceChange(6 * 60 * 60 * 1000),
      price_change_24h: calculatePriceChange(24 * 60 * 60 * 1000),
      volume_24h: volume24h,
      trader_count: traderCount,
      price_snapshot_value: currentPrice,
    };

    // Update cached metrics in database (fire and forget)
    query(
      `UPDATE tokens 
      SET 
        current_price = $1,
        volume_24h = $2,
        price_change_5m = $3,
        price_change_1h = $4,
        price_change_4h = $5,
        price_change_6h = $6,
        price_change_24h = $7,
        trader_count = $8,
        price_snapshot_value = $9,
        metrics_updated_at = NOW()
      WHERE id = $10`,
      [
        metrics.current_price,
        metrics.volume_24h,
        metrics.price_change_5m,
        metrics.price_change_1h,
        metrics.price_change_4h,
        metrics.price_change_6h,
        metrics.price_change_24h,
        metrics.trader_count,
        metrics.price_snapshot_value,
        tokenId,
      ]
    ).catch(err => console.error('Failed to update cached metrics:', err));

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return NextResponse.json({ success: false, error: 'Failed to calculate metrics' }, { status: 500 });
  }
}
