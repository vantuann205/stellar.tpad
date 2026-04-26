'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import BondingCurveTrader from '@/components/trade/BondingCurveTrader';
import TokenLightweightChart from '@/components/trade/TokenLightweightChart';
import TransactionTable from '@/components/trade/TransactionTable';
import BondingCurve from '@/components/trade/BondingCurve';
import { getTokenState } from '@/features/trade/bonding-curve.service';
import type { TokenStoreRecord as TokenRecord } from '@/lib/stores';

interface PageProps {
  params: { contractAddress: string };
}

const TOTAL_SUPPLY = 1_000_000_000n * 10_000_000n;

export default function TradingPage({ params }: PageProps) {
  const { contractAddress } = params;
  const [token, setToken] = useState<TokenRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [soldSupply, setSoldSupply] = useState(0n);
  const [refreshKey, setRefreshKey] = useState(0);

  // fetch token info
  useEffect(() => {
    fetch(`/api/tokens/${contractAddress}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setToken(j.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [contractAddress]);

  // fetch sold_supply from contract
  const fetchSoldSupply = useCallback(async () => {
    try {
      const state = await getTokenState(contractAddress);
      setSoldSupply(state.sold_supply);
    } catch { /* contract not yet registered */ }
  }, [contractAddress]);

  useEffect(() => { fetchSoldSupply(); }, [fetchSoldSupply]);

  const onTradeSuccess = useCallback(() => {
    setRefreshKey(k => k + 1);
    fetchSoldSupply();
  }, [fetchSoldSupply]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-pump-bg flex flex-col items-center justify-center gap-4 text-gray-400">
        <p className="text-lg">token not found</p>
        <Link href="/" className="text-pump-green hover:underline text-sm">← back to home</Link>
      </div>
    );
  }

  const ticker = token?.symbol ?? '...';
  const currentPriceXlm = token?.current_price?.toFixed(8) ?? '—';

  return (
    <div className="min-h-screen bg-pump-bg text-white">
      {/* header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-gray-500 hover:text-white transition-colors text-sm">←</Link>
        <div className="flex items-center gap-3">
          {token?.image_url && (
            <img src={token.image_url} alt={ticker} className="w-8 h-8 rounded-full object-cover" />
          )}
          <div>
            <span className="font-bold text-white">{token?.name ?? '...'}</span>
            <span className="ml-2 text-gray-500 text-sm">{ticker}</span>
          </div>
        </div>
        <div className="ml-auto text-sm font-mono text-pump-green">{currentPriceXlm} XLM</div>
      </div>

      {/* main layout */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* left — chart + table */}
        <div className="lg:col-span-2 space-y-4">
          <TokenLightweightChart tokenAddress={contractAddress} refreshKey={refreshKey} />
          <TransactionTable tokenAddress={contractAddress} refreshKey={refreshKey} />
        </div>

        {/* right — trader + progress */}
        <div className="space-y-4">
          <BondingCurveTrader
            tokenAddress={contractAddress}
            ticker={ticker}
            onTradeSuccess={onTradeSuccess}
          />
          <BondingCurve soldSupply={soldSupply} totalSupply={TOTAL_SUPPLY} />
        </div>
      </div>
    </div>
  );
}
