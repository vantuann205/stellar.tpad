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
    );
    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }
    const token = tokenResult.rows[0];
    const tokenId = token.id;
    const totalSupply = Number(token.total_supply || 0);

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
       LIMIT 50`,
      [tokenId]
    );

    const holdersWithPercentage = result.rows.map((row: any) => {
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
