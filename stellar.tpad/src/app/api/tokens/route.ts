import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';
import { TokenValidationError, validateTokenInput } from '@/lib/token-validation';

export interface TokenRecord {
  id: number;
  name: string;
  symbol: string;
  description: string;
  image_url: string;
  social_link: string;
  total_supply: string;
  owner: string;
  contract_address: string;
  created_at: string;
  bonding_curve_contract?: string;
  bonding_curve_registered?: boolean;
  current_price?: number;
  volume_24h?: number;
  price_change_5m?: number;
  sold_supply?: string;
}

export async function GET() {
  try {
    await ensureDatabaseSchema();
    const result = await query(
      `SELECT
          t.*,
          COALESCE(
            (SELECT GREATEST(
                COALESCE(SUM(CASE WHEN buyer_address IS NOT NULL THEN total_price ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN seller_address IS NOT NULL THEN total_price ELSE 0 END), 0),
                0
            ) FROM purchases WHERE token_id = t.id AND status = 'completed'),
            0
          ) AS max_reserve
       FROM tokens t
       ORDER BY t.created_at DESC`
    ) as any;

    return NextResponse.json({ success: true, data: result?.rows || [] });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { bonding_curve_contract, bonding_curve_registered } = body as Record<string, unknown>;
    const {
      name, symbol, description, imageUrl, socialLink,
      totalSupply: supply, owner, contractAddress,
    } = validateTokenInput(body as Record<string, unknown>);

    const existing = await query('SELECT * FROM tokens WHERE contract_address = $1 LIMIT 1', [contractAddress]) as any;
    if (existing?.rows && existing.rows.length > 0) {
      return NextResponse.json({ success: true, data: existing?.rows?.[0] });
    }

    const INITIAL_PRICE = 0.0001;
    const initialMarketcap = INITIAL_PRICE * supply;
    // Default slope for Stellar based on contract
    const DEFAULT_SLOPE = 25000; // stroops

    // The token row and its launch snapshot must land together — a token without
    // a snapshot renders an empty chart and breaks price-change windows.
    const client = await getClient();
    let result: any;
    try {
      await client.query('BEGIN');
      result = await client.query(
        `INSERT INTO tokens (
        name, symbol, description, image_url, social_link,
        total_supply, owner, contract_address, network,
        price_snapshot_value, price_snapshot_time,
        marketcap, volume_24h,
        price_change_5m, price_change_1h, price_change_4h, price_change_6h,
        trader_count, bonding_curve_contract, bonding_curve_registered,
        sold_supply, current_price, base_price, slope, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,'mainnet',
        $9,NOW(),
        $10,0,
        0,0,0,0,
        0,$11,$12,
        0,$13,$14,$15,NOW(),NOW()
        ) RETURNING *`,
        [
          name,
          symbol,
          description,
          imageUrl,
          socialLink,
          supply,
          owner,
          contractAddress,
          INITIAL_PRICE,
          initialMarketcap,
          typeof bonding_curve_contract === 'string' ? bonding_curve_contract : null,
          bonding_curve_registered === true,
          INITIAL_PRICE,
          INITIAL_PRICE,
          DEFAULT_SLOPE,
        ]
      );

      await client.query(
        `INSERT INTO price_snapshots (token_id, price, recorded_at)
         VALUES ($1, $2, NOW())`,
        [result?.rows?.[0]?.id, INITIAL_PRICE]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, data: result?.rows?.[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof TokenValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Error creating token:', error);
    return NextResponse.json({ success: false, error: 'Failed to create token' }, { status: 500 });
  }
}
