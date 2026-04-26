'use client';

import { useEffect, useState, useCallback, useRef, useReducer } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import Header, { type HeaderRef } from '@/components/layout/Header';
import BondingCurveTrader from '@/components/trade/BondingCurveTrader';
import TokenLightweightChart from '@/components/trade/TokenLightweightChart';
import TransactionTable from '@/components/trade/TransactionTable';
import BondingCurve from '@/components/trade/BondingCurve';
import TokenInfoBar from '@/components/trade/TokenInfoBar';
import CommentSection from '@/components/trade/CommentSection';
import HoldersList from '@/components/trade/HoldersList';
import { getTokenState } from '@/features/trade/bonding-curve.service';
import type { TokenRecord } from '@/types/token';
import { stellarWalletService, WalletServiceError } from '@/services/wallet.service';
import { initialWalletState, walletStateReducer } from '@/store/wallet.store';
import { ViewState } from '@/types';

interface TradingPageClientProps {
  token: TokenRecord;
  contractAddress: string;
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
const STROOPS = 10_000_000n;
const INITIAL_LISTING_PRICE = 0.0001;

export default function TradingPageClient({ token: initialToken, contractAddress }: TradingPageClientProps) {
  const router = useRouter();
  const [token, setToken] = useState<TokenRecord>(initialToken);
  const [soldSupply, setSoldSupply] = useState(0n);
  const [curveFallbackPrice, setCurveFallbackPrice] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [tokenMetrics, setTokenMetrics] = useState<any>(null);
  const [maxReserve, setMaxReserve] = useState(0);
  const [walletState, dispatchWallet] = useReducer(walletStateReducer, initialWalletState);
  const headerRef = useRef<HeaderRef>(null);

  // fetch token data (current_price etc)
  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${contractAddress}`);
      const data = await res.json();
      if (data.success && data.data) {
        setToken(data.data);
      }
    } catch (error) {
      console.error('Error fetching token:', error);
    }
  }, [contractAddress]);

  // fetch sold_supply from contract
  const fetchSoldSupply = useCallback(async () => {
    try {
      const state = await getTokenState(contractAddress);
      setSoldSupply(state.sold_supply);
      const priceStroops = state.base_price + (state.slope * state.sold_supply) / STROOPS;
      const nextFallback = Number(priceStroops) / Number(STROOPS);
      if (Number.isFinite(nextFallback) && nextFallback > 0) {
        setCurveFallbackPrice(nextFallback);
      }
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
    fetchToken();
    fetchSoldSupply();
    fetchTokenMetrics();
    fetchComments();
    fetchBondingProgress();

    // Polling intervals
    const tokenInterval = setInterval(fetchToken, 5000);
    const metricsInterval = setInterval(fetchTokenMetrics, 10000);
    const progressInterval = setInterval(fetchBondingProgress, 15000);
    const commentsInterval = setInterval(fetchComments, 20000);

    return () => {
      clearInterval(tokenInterval);
      clearInterval(metricsInterval);
      clearInterval(progressInterval);
      clearInterval(commentsInterval);
    };
  }, [fetchToken, fetchSoldSupply, fetchTokenMetrics, fetchComments, fetchBondingProgress]);

  const onTradeSuccess = useCallback(() => {
    setRefreshKey(k => k + 1);
    fetchToken();
    fetchSoldSupply();
    fetchTokenMetrics();
    fetchBondingProgress();
  }, [fetchToken, fetchSoldSupply, fetchTokenMetrics, fetchBondingProgress]);

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

  // Wallet handlers
  const handleConnectWallet = async () => {
    dispatchWallet({ type: 'connecting' });
    try {
      const { provider, address } = await stellarWalletService.connect();
      dispatchWallet({ type: 'connected', payload: { provider, address } });
    } catch (error) {
      const code = error instanceof WalletServiceError ? error.code : 'unknown';
      dispatchWallet({ type: 'error', payload: { errorCode: code } });
    }
  };

  const handleDisconnectWallet = async () => {
    await stellarWalletService.disconnect();
    dispatchWallet({ type: 'disconnected' });
  };

  useEffect(() => {
    stellarWalletService.restoreSession().then(session => {
      if (!session) return;
      dispatchWallet({ type: 'connected', payload: { provider: session.provider, address: session.address } });
    });
  }, []);

  const ticker = token?.symbol ?? '...';
  const dbPriceNum = Number(token?.current_price);
  const currentPrice = dbPriceNum > 0
    ? dbPriceNum
    : (curveFallbackPrice > 0 ? curveFallbackPrice : INITIAL_LISTING_PRICE);
  const progress = Math.min(100, (maxReserve / BONDING_TARGET) * 100);
  const pctRemaining = (100 - progress).toFixed(4);

  return (
    <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-white">
      <Header
        ref={headerRef}
        onGoHome={() => router.push('/')}
        onGoCreate={() => router.push('/?view=create')}
        onGoLivestreams={() => router.push('/?view=livestreams')}
        onGoSupport={() => router.push('/?view=support')}
        onGoProfile={() => {
          if (walletState.address) {
            router.push(`/profile/${walletState.address}`);
          }
        }}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onSelectToken={(addr) => router.push(`/token/${addr}`)}
        walletConnected={walletState.status === 'connected'}
        walletAddress={walletState.address}
        currentView={ViewState.DETAIL}
      />

      <div className="container mx-auto px-4 py-4 max-w-[1600px] animate-fade-in">
        {/* Back button */}
        <Link 
          href="/"
          className="flex items-center gap-2 text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white mb-4 text-sm font-bold uppercase transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to board
        </Link>

        {/* Token Info Bar */}
        <TokenInfoBar 
          token={token} 
          currentPrice={currentPrice}
          metrics={tokenMetrics}
        />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - Chart & Bonding Curve & Transactions */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <TokenLightweightChart
              tokenId={token?.id ?? contractAddress}
              ticker={ticker}
              currentPrice={currentPrice}
              createdAt={token?.created_at}
              refreshKey={refreshKey}
            />

            {/* Bonding Curve Progress */}
            <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">
                    Bonding Curve Progress
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="text-pump-green">{progress.toFixed(4)}%</span>
                  <span className="text-gray-400 dark:text-gray-600">·</span>
                  <span className="text-gray-600 dark:text-gray-400 text-xs font-mono">
                    {pctRemaining}% to Graduate
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <BondingCurve soldSupply={soldSupply} totalSupply={TOTAL_SUPPLY} />

              {/* Stats row */}
              <div className="mt-3 grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <div className="text-gray-700 dark:text-gray-600 uppercase tracking-wider mb-0.5">Collected</div>
                  <div className="text-gray-900 dark:text-white font-bold">{maxReserve.toFixed(4)} XLM</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-700 dark:text-gray-600 uppercase tracking-wider mb-0.5">Target</div>
                  <div className="text-gray-900 dark:text-gray-300 font-bold">{BONDING_TARGET.toLocaleString()} XLM</div>
                </div>
              </div>

              {/* Warning */}
              <div className="mt-4 flex gap-3 items-start bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-400 dark:border-yellow-700/30 p-3 rounded text-[11px] text-yellow-700 dark:text-yellow-500">
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
