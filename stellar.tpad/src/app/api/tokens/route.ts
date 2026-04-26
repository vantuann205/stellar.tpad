import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureDatabaseSchema } from '@/lib/db-schema';

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
          COALESCE(bp.max_reserve, 0) AS max_reserve,
          COALESCE(NULLIF(t.volume_24h, 0), pm.volume_24h_calc, 0) AS computed_volume_24h,
          COALESCE(pm.trader_count_calc, t.trader_count, 0) AS computed_trader_count,
          lt.last_trade_type
       FROM tokens t
       LEFT JOIN token_bonding_progress bp ON bp.token_id = t.id
       LEFT JOIN LATERAL (
          SELECT
            COALESCE(
              SUM(
                COALESCE(
                  quantity,
                  CASE
                    WHEN price_per_token IS NULL OR price_per_token = 0 THEN 0
                    ELSE total_price / price_per_token
                  END
                )
              ),
              0
            ) AS volume_24h_calc,
            COALESCE((
              SELECT COUNT(*)
              FROM (
                SELECT address
                FROM (
                  SELECT buyer_address AS address, SUM(quantity::numeric) AS net_qty
                  FROM purchases
                  WHERE token_id = t.id AND buyer_address IS NOT NULL AND status = 'completed'
                  GROUP BY buyer_address
                  UNION ALL
                  SELECT seller_address AS address, -SUM(quantity::numeric) AS net_qty
                  FROM purchases
                  WHERE token_id = t.id AND seller_address IS NOT NULL AND status = 'completed'
                  GROUP BY seller_address
                ) net_moves
                GROUP BY address
                HAVING SUM(net_qty) > 0
              ) holder_wallets
            ), 0) AS trader_count_calc
          FROM purchases p
          WHERE p.token_id = t.id
            AND p.status = 'completed'
            AND p.created_at >= NOW() - INTERVAL '24 hours'
       ) pm ON true
       LEFT JOIN LATERAL (
          SELECT CASE WHEN buyer_address IS NOT NULL THEN 'buy' ELSE 'sell' END AS last_trade_type
          FROM purchases
          WHERE token_id = t.id AND status = 'completed'
          ORDER BY created_at DESC
          LIMIT 1
       ) lt ON true
       ORDER BY t.created_at DESC`
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json();
    const {
      name, symbol, description, image_url, social_link,
      totalSupply, owner, contractAddress,
      bonding_curve_contract, bonding_curve_registered,
    } = body;

    if (!name || !symbol || !owner || !contractAddress) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await query('SELECT * FROM tokens WHERE contract_address = $1 LIMIT 1', [contractAddress]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: true, data: existing.rows[0] });
    }

    const INITIAL_PRICE = 0.05;
    const supply = parseFloat(String(totalSupply || 0));
    const initialMarketcap = INITIAL_PRICE * supply;

    const result = await query(
      `INSERT INTO tokens (
        name, symbol, description, image_url, social_link,
        total_supply, owner, contract_address,
        price_snapshot_value, price_snapshot_time,
        marketcap, volume_24h,
        price_change_5m, price_change_1h, price_change_4h, price_change_6h,
        trader_count, bonding_curve_contract, bonding_curve_registered,
        sold_supply, current_price, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,NOW(),
        $10,0,
        0,0,0,0,
        0,$11,$12,
        0,$13,NOW(),NOW()
      ) RETURNING *`,
      [
        name,
        symbol,
        description || null,
        image_url || null,
        social_link || null,
        supply,
        owner,
        contractAddress,
        INITIAL_PRICE,
        initialMarketcap,
        bonding_curve_contract || null,
        bonding_curve_registered ?? false,
        INITIAL_PRICE,
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
