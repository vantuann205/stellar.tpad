import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/app/api/tokens/route';

export async function GET(
  _req: NextRequest,
  { params }: { params: { contractAddress: string } },
) {
  const { contractAddress } = params;
  const token = store.get(contractAddress);

  if (!token) {
    return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
  }

  // compute current_price if bonding curve registered
  let current_price: number | undefined;
  if (token.bonding_curve_registered && token.sold_supply) {
    const base = 100; // base_price default stroops
    const slope = 1;  // slope default
    const soldRaw = BigInt(token.sold_supply);
    const priceStroops = base + Number((BigInt(slope) * soldRaw) / 10_000_000n);
    current_price = priceStroops / 1e7; // convert stroops → XLM
  }

  return NextResponse.json({ success: true, data: { ...token, current_price } });
}
