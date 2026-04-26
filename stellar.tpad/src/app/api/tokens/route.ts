/**
 * In-memory token store — no database.
 * Tokens persist for the lifetime of the server process.
 * For production, swap `store` with a real DB or KV store.
 */
import { NextRequest, NextResponse } from 'next/server';
import { tradeStore } from '@/app/api/trades/route';

export interface TokenRecord {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image_url: string;
  social_link: string;
  total_supply: string;
  owner: string;
  contract_address: string;
  created_at: string;
  // Bonding curve fields
  bonding_curve_contract?: string;
  bonding_curve_registered?: boolean;
  current_price?: number;    // XLM per token
  volume_24h?: number;       // XLM
  price_change_5m?: number;  // %
  sold_supply?: string;      // raw units string
}

// Module-level in-memory store (survives hot-reload in dev via globalThis)
const g = globalThis as any;
if (!g.__tokenStore) g.__tokenStore = new Map<string, TokenRecord>();
export const store: Map<string, TokenRecord> = g.__tokenStore;

export async function GET() {
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms5m  = 5 * 60 * 1000;

  const tokens = Array.from(store.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(token => {
      if (!token.bonding_curve_registered) return token;

      // current_price from stored sold_supply
      let current_price: number | undefined;
      if (token.sold_supply) {
        const soldRaw = BigInt(token.sold_supply);
        const priceStroops = 100 + Number(soldRaw / 10_000_000n);
        current_price = priceStroops / 1e7;
      }

      // volume_24h and price_change_5m from trade store
      const trades = tradeStore.get(token.contract_address) ?? [];
      const recent24h = trades.filter(t => now - new Date(t.timestamp).getTime() < ms24h);
      const volume_24h = recent24h.reduce((s, t) => s + Number(t.xlmAmount) / 1e7, 0);

      // price_change_5m: compare current_price with last trade older than 5m
      let price_change_5m: number | undefined;
      if (current_price !== undefined) {
        const older = trades.find(t => now - new Date(t.timestamp).getTime() > ms5m);
        if (older) {
          price_change_5m = ((current_price - older.price) / older.price) * 100;
        }
      }

      return { ...token, current_price, volume_24h, price_change_5m };
    });

  return NextResponse.json({ success: true, data: tokens });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, symbol, description, image_url, social_link, totalSupply, owner, contractAddress } = body;

    if (!name || !symbol || !owner || !contractAddress) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (store.has(contractAddress)) {
      return NextResponse.json({ success: true, data: store.get(contractAddress) });
    }

    const record: TokenRecord = {
      id: contractAddress,
      name,
      symbol,
      description: description || '',
      image_url: image_url || '',
      social_link: social_link || '',
      total_supply: totalSupply || '1000000000',
      owner,
      contract_address: contractAddress,
      created_at: new Date().toISOString(),
    };

    store.set(contractAddress, record);
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
