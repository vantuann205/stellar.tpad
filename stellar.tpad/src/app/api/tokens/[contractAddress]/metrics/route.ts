import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';
import { calculateAndStoreTokenMetrics } from '@/lib/token-metrics';

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  try {
    await ensureDatabaseSchema();

    const tokenResult = await query(
      `SELECT 
        id, 
        current_price,
        sold_supply,
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

    // Recalculate — do NOT pass current_price, let token-metrics pick from latest trade
    const metrics = await calculateAndStoreTokenMetrics({
      tokenId,
      currentPrice: null,
      recordSnapshot: false,
    });

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return NextResponse.json({ success: false, error: 'Failed to calculate metrics' }, { status: 500 });
  }
}
