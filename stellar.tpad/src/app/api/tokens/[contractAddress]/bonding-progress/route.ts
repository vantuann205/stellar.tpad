import { NextRequest, NextResponse } from 'next/server';
import { getTokenStore, getTradeStore } from '@/lib/stores';

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  try {
    const tokenStore = await getTokenStore();
    const tradeStore = await getTradeStore();
    
    const token = tokenStore.getByContractAddress(params.contractAddress);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const trades = tradeStore.getByTokenId(token.id);
    
    // Calculate total collected from buys
    let maxReserve = 0;
    trades.forEach(trade => {
      const xlmAmount = parseFloat(trade.xlmAmount) / 10_000_000; // Convert stroops to XLM
      if (trade.type === 'buy') {
        maxReserve += xlmAmount;
      } else if (trade.type === 'sell') {
        maxReserve -= xlmAmount;
      }
    });

    // Ensure non-negative
    maxReserve = Math.max(0, maxReserve);

    return NextResponse.json({
      success: true,
      data: {
        max_reserve: maxReserve,
        target: 10000,
        progress: Math.min(100, (maxReserve / 10000) * 100),
      },
    });
  } catch (error) {
    console.error('Error fetching bonding progress:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bonding progress' }, { status: 500 });
  }
}
