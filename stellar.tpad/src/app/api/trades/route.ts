import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';

const REQUIRED = ['tokenId', 'type', 'tokenAmount', 'xlmAmount', 'price', 'fee', 'user', 'txHash', 'timestamp'] as const;

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json();

    for (const field of REQUIRED) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ success: false, error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const tokenRes = await query('SELECT id FROM tokens WHERE LOWER(contract_address) = LOWER($1) LIMIT 1', [body.tokenId]);
    if (tokenRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }
    const tokenId = tokenRes.rows[0].id;

    const type = body.type === 'sell' ? 'sell' : 'buy';
    const buyerAddress = type === 'buy' ? body.user : null;
    const sellerAddress = type === 'sell' ? body.user : null;

    const result = await query(
      `INSERT INTO purchases (
        token_id, buyer_address, seller_address,
        quantity, price_per_token, total_price,
        transaction_hash, status, created_at, updated_at
      ) VALUES (
        $1,$2,$3,
        $4,$5,$6,
        $7,'completed',$8,$8
      ) RETURNING *`,
      [
        tokenId,
        buyerAddress,
        sellerAddress,
        Number(body.tokenAmount) / 1e7,
        Number(body.price),
        Number(body.xlmAmount) / 1e7,
        String(body.txHash),
        body.timestamp ? new Date(body.timestamp) : new Date(),
      ]
    );

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: String(row.id),
        tokenId: body.tokenId,
        type,
        tokenAmount: String(body.tokenAmount),
        xlmAmount: String(body.xlmAmount),
        price: Number(body.price),
        fee: String(body.fee),
        user: body.user,
        txHash: row.transaction_hash,
        timestamp: new Date(row.created_at).toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureDatabaseSchema();
    const tokenAddress = req.nextUrl.searchParams.get('tokenId');
    if (!tokenAddress) {
      return NextResponse.json({ success: false, error: 'tokenId is required' }, { status: 400 });
    }

    const result = await query(
      `SELECT
          p.id,
          CASE WHEN p.buyer_address IS NOT NULL THEN 'buy' ELSE 'sell' END AS type,
          p.quantity,
          p.price_per_token,
          p.total_price,
          p.transaction_hash,
          p.created_at,
          COALESCE(p.buyer_address, p.seller_address, 'unknown') AS user_address
       FROM purchases p
       JOIN tokens t ON t.id = p.token_id
       WHERE LOWER(t.contract_address) = LOWER($1)
         AND p.status = 'completed'
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [tokenAddress]
    );

    const trades = result.rows.map((row: any) => ({
      id: String(row.id),
      tokenId: tokenAddress,
      type: row.type,
      tokenAmount: String(Math.round(Number(row.quantity || 0) * 1e7)),
      xlmAmount: String(Math.round(Number(row.total_price || 0) * 1e7)),
      price: Number(row.price_per_token || 0),
      fee: '0',
      user: row.user_address,
      txHash: row.transaction_hash || '',
      timestamp: new Date(row.created_at).toISOString(),
    }));

    return NextResponse.json({ success: true, data: trades });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
