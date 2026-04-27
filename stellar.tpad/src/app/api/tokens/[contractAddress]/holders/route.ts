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
      `SELECT id, total_supply FROM tokens WHERE LOWER(contract_address) = LOWER($1) LIMIT 1`,
      [params.contractAddress]
    ) as any;
    if (!tokenResult?.rows || tokenResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }
    const token = tokenResult?.rows?.[0];
    const tokenId = token.id;
    const totalSupply = Number(token.total_supply || 0);

    // Optimized query using CTE for better performance
    const result = await query(
      `WITH holder_balances AS (
         SELECT
           COALESCE(buyer_address, seller_address) AS address,
           SUM(CASE 
             WHEN buyer_address IS NOT NULL THEN quantity::numeric
             ELSE -quantity::numeric
           END) AS net_qty
         FROM purchases
         WHERE token_id = $1 
           AND status = 'completed'
           AND (buyer_address IS NOT NULL OR seller_address IS NOT NULL)
         GROUP BY COALESCE(buyer_address, seller_address)
         HAVING SUM(CASE 
           WHEN buyer_address IS NOT NULL THEN quantity::numeric
           ELSE -quantity::numeric
         END) > 0
       )
       SELECT address, net_qty
       FROM holder_balances
       ORDER BY net_qty DESC
       LIMIT 50`,
      [tokenId]
    ) as any;

    const holdersWithPercentage = (result?.rows || []).map((row: any) => {
      const balance = Number(row.net_qty || 0);
      return {
        address: row.address,
        balance: balance.toFixed(2),
        percentage: totalSupply > 0 ? (balance / totalSupply) * 100 : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: holdersWithPercentage,
    });
  } catch (error) {
    console.error('Error fetching holders:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch holders' }, { status: 500 });
  }
}
