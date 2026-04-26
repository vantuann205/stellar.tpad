import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json({ success: false, error: 'tokenId is required' }, { status: 400 });
    }

    // Get token ID from contract address
    const tokenResult = await query(
      `SELECT id FROM tokens WHERE LOWER(contract_address) = LOWER($1) LIMIT 1`,
      [tokenId]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const dbTokenId = tokenResult.rows[0].id;

    // Fetch recent trades with optimized query
    const tradesResult = await query(
      `SELECT 
        id,
        COALESCE(buyer_address, seller_address) as user,
        CASE 
          WHEN buyer_address IS NOT NULL THEN 'buy'
          ELSE 'sell'
        END as type,
        price_per_token as price,
        quantity as token_amount,
        0 as fee,
        transaction_hash as tx_hash,
        created_at as timestamp
      FROM purchases
      WHERE token_id = $1 AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 100`,
      [dbTokenId]
    );

    const trades = tradesResult.rows.map((row: any) => ({
      id: row.id,
      user: row.user || 'Unknown',
      type: row.type,
      price: parseFloat(row.price) || 0,
      tokenAmount: row.token_amount || '0',
      fee: row.fee || '0',
      txHash: row.tx_hash || '',
      timestamp: row.timestamp,
    }));

    return NextResponse.json({ success: true, data: trades });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch trades' }, { status: 500 });
  }
}
