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
    const now = Date.now();

    // Calculate price changes
    const calculatePriceChange = (windowMs: number) => {
      const windowStart = now - windowMs;
      const recentTrades = trades.filter(t => new Date(t.timestamp).getTime() >= windowStart);
      
      if (recentTrades.length < 2) return null;
      
      const sorted = recentTrades.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const firstPrice = sorted[0].price;
      const lastPrice = sorted[sorted.length - 1].price;
      
      if (firstPrice <= 0) return null;
      return ((lastPrice - firstPrice) / firstPrice) * 100;
    };

    // Calculate volume
    const calculate24hVolume = () => {
      const windowStart = now - 24 * 60 * 60 * 1000;
      const recentTrades = trades.filter(t => new Date(t.timestamp).getTime() >= windowStart);
      return recentTrades.reduce((sum, t) => {
        const xlmAmount = parseFloat(t.xlmAmount) / 10_000_000;
        return sum + xlmAmount;
      }, 0);
    };

    // Count unique traders
    const countTraders = () => {
      const addresses = new Set<string>();
      trades.forEach(t => {
        addresses.add(t.user);
      });
      return addresses.size;
    };

    const metrics = {
      price_change_5m: calculatePriceChange(5 * 60 * 1000),
      price_change_1h: calculatePriceChange(60 * 60 * 1000),
      price_change_4h: calculatePriceChange(4 * 60 * 60 * 1000),
      price_change_6h: calculatePriceChange(6 * 60 * 60 * 1000),
      price_change_24h: calculatePriceChange(24 * 60 * 60 * 1000),
      volume_24h: calculate24hVolume(),
      trader_count: countTraders(),
    };

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return NextResponse.json({ success: false, error: 'Failed to calculate metrics' }, { status: 500 });
  }
}
