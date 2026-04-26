'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import BondingCurveTrader from '@/components/trade/BondingCurveTrader';
import TokenLightweightChart from '@/components/trade/TokenLightweightChart';
import TransactionTable from '@/components/trade/TransactionTable';
import BondingCurve from '@/components/trade/BondingCurve';
import TokenInfoBar from '@/components/trade/TokenInfoBar';
import TokenMetrics from '@/components/trade/TokenMetrics';
import CommentSection from '@/components/trade/CommentSection';
import HoldersList from '@/components/trade/HoldersList';
import { getTokenState } from '@/features/trade/bonding-curve.service';
import type { TokenRecord } from '@/types/token';
import { stellarWalletService } from '@/services/wallet.service';

interface PageProps {
  params: { contractAddress: string };
}

interface Comment {
  id: string;
  user: string;
  avatarUrl?: string;
  text: string;
  timestamp: string;
}

const TOTAL_SUPPLY = 1_000_000_000n * 10_000_000n;
const BONDING_TARGET = 10000; // XLM target for graduation

export default function TradingPage({ params }: PageProps) {
  const { contractAddress } = params;
  const [token, setToken] = useState<TokenRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [soldSupply, setSoldSupply] = useState(0n);
  const [refreshKey, setRefreshKey] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [tokenMetrics, setTokenMetrics] = useState<any>(null);
  const [maxReserve, setMaxReserve] = useState(0);

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

  // fetch token metrics
  const fetchTokenMetrics = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${contractAddress}/metrics`);
      const data = await res.json();
      if (data.success) {
        setTokenMetrics(data.data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, [contractAddress]);

  // fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${contractAddress}/comments`);
      const data = await res.json();
      if (data.success && data.data) {
        setComments(data.data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  }, [contractAddress]);

  // fetch bonding progress
  const fetchBondingProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${contractAddress}/bonding-progress`);
      const data = await res.json();
      if (data.success) {
        setMaxReserve(parseFloat(data.data.max_reserve) || 0);
      }
    } catch (error) {
      console.error('Error fetching bonding progress:', error);
    }
  }, [contractAddress]);

  useEffect(() => {
    fetchSoldSupply();
    fetchTokenMetrics();
    fetchComments();
    fetchBondingProgress();

    // Polling intervals
    const metricsInterval = setInterval(fetchTokenMetrics, 10000);
    const progressInterval = setInterval(fetchBondingProgress, 15000);
    const commentsInterval = setInterval(fetchComments, 20000);

    return () => {
      clearInterval(metricsInterval);
      clearInterval(progressInterval);
      clearInterval(commentsInterval);
    };
  }, [fetchSoldSupply, fetchTokenMetrics, fetchComments, fetchBondingProgress]);

  const onTradeSuccess = useCallback(() => {
    setRefreshKey(k => k + 1);
    fetchSoldSupply();
    fetchTokenMetrics();
    fetchBondingProgress();
  }, [fetchSoldSupply, fetchTokenMetrics, fetchBondingProgress]);

  const handleAddComment = async (text: string) => {
    try {
      const walletAddress = await stellarWalletService.getPublicKey();
      const res = await fetch(`/api/tokens/${contractAddress}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userAddress: walletAddress || 'Anonymous' }),
      });
      if (res.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-pump-bg flex flex-col items-center justify-center gap-4 text-gray-400">
        <p className="text-lg">Token not found</p>
        <Link href="/" className="text-pump-green hover:underline text-sm">← Back to home</Link>
      </div>
    );
  }

  const ticker = token?.symbol ?? '...';
  const currentPrice = token?.current_price ?? 0;
  const progress = Math.min(100, (maxReserve / BONDING_TARGET) * 100);
  const pctRemaining = (100 - progress).toFixed(4);

  return (
    <div className="min-h-screen bg-pump-bg text-white">
      <div className="container mx-auto px-4 py-4 max-w-[1600px] animate-fade-in">
        {/* Back button */}
        <Link 
          href="/"
          className="flex items-center gap-2 text-gray-600 hover:text-white mb-4 text-sm font-bold uppercase transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to board
        </Link>

        {/* Token Info Bar */}
        {token && (
          <TokenInfoBar 
            token={token} 
            currentPrice={currentPrice}
            metrics={tokenMetrics}
          />
        )}

        {/* Token Metrics */}
        <TokenMetrics metrics={tokenMetrics} />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - Chart & Bonding Curve & Transactions */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <TokenLightweightChart
              tokenAddress={contractAddress}
              ticker={ticker}
              currentPrice={currentPrice}
              createdAt={token?.created_at}
              refreshKey={refreshKey}
            />

            {/* Bonding Curve Progress */}
            <div className="bg-pump-card border border-gray-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    Bonding Curve Progress
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="text-pump-green">{progress.toFixed(4)}%</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-400 text-xs font-mono">
                    {pctRemaining}% to Graduate
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <BondingCurve soldSupply={soldSupply} totalSupply={TOTAL_SUPPLY} />

              {/* Stats row */}
              <div className="mt-3 grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <div className="text-gray-600 uppercase tracking-wider mb-0.5">Collected</div>
                  <div className="text-white font-bold">{maxReserve.toFixed(4)} XLM</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-600 uppercase tracking-wider mb-0.5">Target</div>
                  <div className="text-gray-300 font-bold">{BONDING_TARGET.toLocaleString()} XLM</div>
                </div>
              </div>

              {/* Warning */}
              <div className="mt-4 flex gap-3 items-start bg-yellow-900/10 border border-yellow-700/30 p-3 rounded text-[11px] text-yellow-500">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  When the BONDING CURVE reaches <b>{BONDING_TARGET.toLocaleString()} XLM</b>, all liquidity will be deposited into{' '}
                  <b>Stellar DEX</b> and burned. Token graduates to open market.
                </p>
              </div>
            </div>

            {/* Transaction Table */}
            <div className="hidden lg:block">
              <TransactionTable 
                tokenAddress={contractAddress} 
                refreshKey={refreshKey} 
              />
            </div>
          </div>

          {/* Right column - Trade Form, Comments, Holders */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            <BondingCurveTrader
              tokenAddress={contractAddress}
              ticker={ticker}
              onTradeSuccess={onTradeSuccess}
            />
            
            <CommentSection 
              comments={comments}
              onAddComment={handleAddComment}
            />
            
            <HoldersList 
              tokenAddress={contractAddress}
              refreshKey={refreshKey}
            />

            {/* Mobile Transaction Table */}
            <div className="lg:hidden">
              <TransactionTable 
                tokenAddress={contractAddress} 
                refreshKey={refreshKey} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
