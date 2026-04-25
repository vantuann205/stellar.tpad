/**
 * In-memory token store — no database.
 * Tokens persist for the lifetime of the server process.
 * For production, swap `store` with a real DB or KV store.
 */
import { NextRequest, NextResponse } from 'next/server';

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
}

// Module-level in-memory store (survives hot-reload in dev via globalThis)
const g = globalThis as any;
if (!g.__tokenStore) g.__tokenStore = new Map<string, TokenRecord>();
const store: Map<string, TokenRecord> = g.__tokenStore;

export async function GET() {
  const tokens = Array.from(store.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
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
