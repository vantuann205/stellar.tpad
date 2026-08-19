'use client';

import React, { useState, useEffect, useMemo, useReducer } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Header, { type HeaderRef } from '@/components/layout/Header';
import KingOfTheHill from '@/components/common/KingOfTheHill';
import TrendingCoins from '@/components/common/TrendingCoins';
import CoinCard from '@/components/common/CoinCard';
import FilterBar from '@/components/common/FilterBar';
import Toast, { ToastMessage } from '@/components/ui/Toast';
import { ListSkeleton, TokenTableSkeleton } from '@/components/skeleton';
import { Coin, ViewState, SortOption } from '@/types';
import { formatMarketCap, formatPriceChange, formatTraderCount, formatVolume } from '@/lib/helpers';
import { getWalletErrorMessage, stellarWalletService, WalletServiceError } from '@/services/wallet.service';
import { initialWalletState, walletStateReducer } from '@/store/wallet.store';
import { formatTimeAgoShort, parsePossiblyUtc7Timestamp } from '@/lib/time';
import { useRef } from 'react';
import { useNetwork } from '@/hooks/useNetwork';

const CreateCoinPage = dynamic(() => import('@/components/common/CreateCoinPage'), { ssr: false });
const LivestreamsPage = dynamic(() => import('@/components/common/LivestreamsPage'), { ssr: false });
const SupportPage    = dynamic(() => import('@/components/common/SupportPage'),    { ssr: false });

const formatChangeValue = (v: number | null) =>
  v === null || !Number.isFinite(v) ? '--' : formatPriceChange(v);

export default function Home() {
  const router = useRouter();
  const [viewState, setViewState]       = useState<ViewState>(ViewState.GRID);
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [sortOption, setSortOption]     = useState<SortOption>('creationTime');
  const [listMode, setListMode]         = useState<'grid' | 'table'>('grid');
  const [toasts, setToasts]             = useState<ToastMessage[]>([]);
  const [walletState, dispatchWallet]   = useReducer(walletStateReducer, initialWalletState);
  const [tokens, setTokens]             = useState<Coin[]>([]);
  const [loading, setLoading]           = useState(false);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const headerRef = useRef<HeaderRef>(null);
  const { network, toggle: toggleNetwork } = useNetwork();

  // Two toasts raised in the same millisecond used to share an id, which made
  // React reuse one node and dismiss the wrong toast.
  const toastSeq = useRef(0);
  const addToast = (type: ToastMessage['type'], title: string, message: string) => {
    const id = `toast-${Date.now()}-${++toastSeq.current}`;
    setToasts(prev => [...prev, { id, type, title, message, shakeCount: 0 }]);
    return id;
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchTokens = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/tokens');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
      if (data.success && data.data) {
        setTokens(data.data.map((t: any, i: number): Coin => {
          const createdAt = parsePossiblyUtc7Timestamp(t.created_at);
          const createdAtMs = createdAt?.getTime() ?? Date.now();

          // Parse metrics from API
          const currentPrice = Number(t.current_price) || 0.0001; // launch price fallback
          const marketcap = Number(t.marketcap) || (currentPrice * Number(t.total_supply || 1_000_000_000));

          // Bonding curve progress: max_reserve (XLM collected) vs 10,000 XLM target
          const BONDING_TARGET = 10_000; // 10,000 XLM graduation target
          const maxReserve = Number(t.max_reserve) || 0;
          const bondingProgress = Math.min(100, (maxReserve / BONDING_TARGET) * 100);

          return {
            id: t.id || String(i),
            name: t.name,
            ticker: t.symbol,
            description: t.description || '',
            imageUrl: t.image_url || `https://picsum.photos/200/200?random=${i}`,
            creator: t.owner,
            marketCap: marketcap,
            maxReserve: maxReserve,
            replies: 0,
            bondingCurveProgress: bondingProgress,
            createdAt: createdAtMs,
            lastReply: createdAtMs,
            priceHistory: currentPrice > 0 ? [{ time: new Date(createdAtMs).toISOString(), price: currentPrice }] : [],
            tokenAddress: t.contract_address,
            contractAddress: t.contract_address,
            volume24h: Number(t.volume_24h) || 0,
            priceChange5m: Number(t.price_change_5m) || 0,
            priceChange1h: Number(t.price_change_1h) || 0,
            priceChange4h: Number(t.price_change_4h) || 0,
            priceChange6h: Number(t.price_change_6h) || 0,
            traderCount: Number(t.trader_count) || 0,
          };
        }));
      }
    } catch {
      // Without this the page sat on an empty grid that looked like "no coins yet".
      setLoadError('Could not load coins. Check your connection and try again.');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTokens(); }, []);

  // Wallet
  const handleConnectWallet = async () => {
    dispatchWallet({ type: 'connecting' });
    try {
      const { provider, address } = await stellarWalletService.connect();
      dispatchWallet({ type: 'connected', payload: { provider, address } });
      addToast('success', 'Wallet Connected', `${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (error) {
      const code = error instanceof WalletServiceError ? error.code : 'unknown';
      dispatchWallet({ type: 'error', payload: { errorCode: code } });
      addToast('error', 'Connection Failed', getWalletErrorMessage(code));
    }
  };

  const handleDisconnectWallet = async () => {
    await stellarWalletService.disconnect();
    dispatchWallet({ type: 'disconnected' });
    addToast('success', 'Disconnected', 'Wallet disconnected.');
  };

  useEffect(() => {
    stellarWalletService.restoreSession().then(session => {
      if (!session) return;
      dispatchWallet({ type: 'connected', payload: { provider: session.provider, address: session.address } });
    });
  }, []);

  const handleCoinClick = (coin: Coin) => {
    // Navigate to token page instead of showing CoinDetail
    if (coin.contractAddress) {
      router.push(`/token/${coin.contractAddress}`);
    }
  };
  const handleGoHome    = () => { setSelectedCoin(null); setViewState(ViewState.GRID); fetchTokens(); };
  const handleGoProfile = () => {
    // Navigate to profile page
    if (walletState.address) {
      router.push(`/profile/${walletState.address}`);
    }
  };

  const topCoin = useMemo(() =>
    tokens.length ? [...tokens].sort((a, b) => b.marketCap - a.marketCap)[0] : null,
    [tokens]
  );

  const sorted = useMemo(() => {
    const c = [...tokens];
    if (sortOption === 'creationTime') return c.sort((a, b) => b.createdAt - a.createdAt);
    if (sortOption === 'lastReply')    return c.sort((a, b) => b.lastReply - a.lastReply);
    return c.sort((a, b) => b.marketCap - a.marketCap);
  }, [tokens, sortOption]);

  return (
    <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-pump-text font-sans pb-20">
      <Header
        ref={headerRef}
        onGoHome={handleGoHome}
        onGoCreate={() => setViewState(ViewState.CREATE)}
        onGoLivestreams={() => setViewState(ViewState.LIVESTREAMS)}
        onGoSupport={() => setViewState(ViewState.SUPPORT)}
        onGoProfile={handleGoProfile}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onSelectToken={(addr) => {
          // Navigate to token page
          router.push(`/token/${addr}`);
        }}
        walletConnected={walletState.status === 'connected'}
        walletAddress={walletState.address}
        currentView={viewState}
        network={network}
        onToggleNetwork={toggleNetwork}
      />

      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map(t => <Toast key={t.id} toast={t} onClose={removeToast} />)}
      </div>

      <main className="container mx-auto px-4 py-6">
        {viewState === ViewState.GRID && (
          <>
            <KingOfTheHill coin={topCoin} onClick={handleCoinClick} />
            <TrendingCoins onClick={handleCoinClick} />
            {loadError && (
              <div
                role="alert"
                className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pump-red/40 bg-pump-red/5 px-4 py-3 text-sm text-pump-red"
              >
                <span>{loadError}</span>
                <button
                  type="button"
                  onClick={fetchTokens}
                  className="rounded-lg border border-pump-red/40 px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-pump-red/10"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="mt-8">
              <FilterBar
                currentSort={sortOption}
                onSortChange={setSortOption}
                listMode={listMode}
                onListModeChange={setListMode}
              />

              {listMode === 'grid' && (
                <>
                  {loading ? (
                    <ListSkeleton count={9} />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {sorted.map(coin => (
                        <CoinCard key={coin.id} coin={coin} onClick={handleCoinClick} />
                      ))}
                      {sorted.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-500">
                          Chưa có coin nào.{' '}
                          <button onClick={() => setViewState(ViewState.CREATE)} className="text-emerald-400 hover:underline">
                            Tạo coin đầu tiên →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {listMode === 'table' && (
                <>
                  {loading ? (
                    <TokenTableSkeleton rows={10} />
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-300/70 bg-white/80 shadow-lg dark:border-[#24324b] dark:bg-[#0b0f19]">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200/80 bg-gradient-to-r from-slate-100 to-slate-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#22314a] dark:from-[#142238] dark:to-[#101a2d] dark:text-gray-400">
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Coin</th>
                            <th className="px-4 py-3">Symbol</th>
                            <th className="px-4 py-3">Age</th>
                            <th className="px-4 py-3">Contract</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((coin, idx) => (
                            <tr
                              key={coin.id}
                              onClick={() => handleCoinClick(coin)}
                              className="cursor-pointer border-b border-gray-200/60 text-gray-800 transition hover:bg-slate-100/70 dark:border-[#1c273a] dark:text-gray-100 dark:hover:bg-[#101726]"
                            >
                              <td className="px-4 py-3 text-gray-500">#{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <img src={coin.imageUrl} alt={coin.name} className="h-8 w-8 rounded-full object-cover" />
                                  <span className="font-semibold">{coin.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-emerald-400 font-mono">{coin.ticker}</td>
                              <td className="px-4 py-3 text-gray-500">{formatTimeAgoShort(coin.createdAt)}</td>
                              <td className="px-4 py-3 font-mono text-xs text-gray-400">
                                {coin.contractAddress ? `${coin.contractAddress.slice(0, 8)}...` : '—'}
                              </td>
                            </tr>
                          ))}
                          {sorted.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No tokens yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {viewState === ViewState.CREATE && (
          <CreateCoinPage
            onCancel={handleGoHome}
            onTokenCreated={async (addr, name, symbol) => {
              addToast('success', '🚀 Token Launched!', `${name} (${symbol}) deployed`);
              await fetchTokens();
              // Navigate to new token page
              router.push(`/token/${addr}`);
            }}
          />
        )}

        {viewState === ViewState.LIVESTREAMS && <LivestreamsPage />}
        {viewState === ViewState.SUPPORT && <SupportPage />}
      </main>
    </div>
  );
}
