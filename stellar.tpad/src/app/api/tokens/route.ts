/**
 * In-memory token store — no database.
 */
import { NextRequest, NextResponse } from 'next/server';
import { tokenStore, tradeStore, type TokenStoreRecord } from '@/lib/stores';

// Re-export type alias for components that import TokenRecord from this path
export type { TokenStoreRecord as TokenRecord };

export async function GET() {
  const now   = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms5m  = 5 * 60 * 1000;

  const tokens = Array.from(tokenStore.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(token => {
      if (!token.bonding_curve_registered) return token;

      let current_price: number | undefined;
      if (token.sold_supply) {
        const soldRaw = BigInt(token.sold_supply);
        const priceStroops = 100 + Number(soldRaw / 10_000_000n);
        current_price = priceStroops / 1e7;
      }

      const trades     = tradeStore.get(token.contract_address) ?? [];
      const recent24h  = trades.filter(t => now - new Date(t.timestamp).getTime() < ms24h);
      const volume_24h = recent24h.reduce((s, t) => s + Number(t.xlmAmount) / 1e7, 0);

      let price_change_5m: number | undefined;
      if (current_price !== undefined) {
        const older = trades.find(t => now - new Date(t.timestamp).getTime() > ms5m);
        if (older) price_change_5m = ((current_price - older.price) / older.price) * 100;
      }

      return { ...token, current_price, volume_24h, price_change_5m };
    });

  return NextResponse.json({ success: true, data: tokens });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, symbol, description, image_url, social_link,
      totalSupply, owner, contractAddress,
      bonding_curve_contract, bonding_curve_registered,
    } = body;

    if (!name || !symbol || !owner || !contractAddress) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (tokenStore.has(contractAddress)) {
      return NextResponse.json({ success: true, data: tokenStore.get(contractAddress) });
    }

    const record: TokenStoreRecord = {
      id: contractAddress,
      name,
      symbol,
      description:              description || '',
      image_url:                image_url || '',
      social_link:              social_link || '',
      total_supply:             totalSupply || '1000000000',
      owner,
      contract_address:         contractAddress,
      created_at:               new Date().toISOString(),
      bonding_curve_contract:   bonding_curve_contract || '',
      bonding_curve_registered: bonding_curve_registered ?? false,
    };

    tokenStore.set(contractAddress, record);
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
