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

    const reserveResult = await query(
      `SELECT
          GREATEST(
            COALESCE(SUM(CASE WHEN buyer_address IS NOT NULL THEN total_price ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN seller_address IS NOT NULL THEN total_price ELSE 0 END), 0),
            0
          ) AS max_reserve
       FROM purchases
       WHERE token_id = $1 AND status = 'completed'`,
      [tokenId]
    );

    const maxReserve = Number(reserveResult.rows[0]?.max_reserve || 0);

    return NextResponse.json({
      success: true,
      data: {
        max_reserve: maxReserve,
        target: 10000,
        progress: Math.min(100, (maxReserve / 10000) * 100),
      },
    });
  } catch (error) {
    console.error('Error fetching bonding progress:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bonding progress' }, { status: 500 });
  }
}
