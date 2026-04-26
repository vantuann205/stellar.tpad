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
    
    // Calculate balances from trades
    const balances = new Map<string, number>();
    
    trades.forEach(trade => {
      const tokenAmount = parseFloat(trade.tokenAmount) / 10_000_000; // Convert to human-readable
      if (trade.type === 'buy') {
        const current = balances.get(trade.user) || 0;
        balances.set(trade.user, current + tokenAmount);
      } else if (trade.type === 'sell') {
        const current = balances.get(trade.user) || 0;
        balances.set(trade.user, current - tokenAmount);
      }
    });

    // Filter out zero balances and calculate total
    const holders = Array.from(balances.entries())
      .filter(([_, balance]) => balance > 0)
      .map(([address, balance]) => ({ address, balance }));
    
    const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0);

    // Sort by balance descending
    holders.sort((a, b) => b.balance - a.balance);

    const holdersWithPercentage = holders.map(h => ({
      address: h.address,
      balance: h.balance.toFixed(2),
      percentage: totalSupply > 0 ? (h.balance / totalSupply) * 100 : 0,
    }));

    return NextResponse.json({
      success: true,
      data: holdersWithPercentage,
    });
  } catch (error) {
    console.error('Error fetching holders:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch holders' }, { status: 500 });
  }
}
