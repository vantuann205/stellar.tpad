import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/stores';

export async function GET(
  _req: NextRequest,
  { params }: { params: { contractAddress: string } },
) {
  const { contractAddress } = params;
  const token = tokenStore.get(contractAddress);

  if (!token) {
    return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
  }

  let current_price: number | undefined;
  if (token.bonding_curve_registered && token.sold_supply) {
    const soldRaw = BigInt(token.sold_supply);
    const priceStroops = 100 + Number(soldRaw / 10_000_000n);
    current_price = priceStroops / 1e7;
  }

  return NextResponse.json({ success: true, data: { ...token, current_price } });
}
