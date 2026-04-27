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
import { ListSkeleton } from '@/components/skeleton';
import { Coin, ViewState, SortOption } from '@/types';
import { formatMarketCap, formatPriceChange, formatTraderCount, formatVolume } from '@/lib/helpers';
import { getWalletErrorMessage, stellarWalletService, WalletServiceError } from '@/services/wallet.service';
import { initialWalletState, walletStateReducer } from '@/store/wallet.store';
import { parsePossiblyUtc7Timestamp } from '@/lib/time';
import { useRef } from 'react';
import { useNetwork } from '@/hooks/useNetwork';

const CreateCoinPage = dynamic(() => import('@/components/common/CreateCoinPage'), { ssr: false });
const LivestreamsPage = dynamic(() => import('@/components/common/LivestreamsPage'), { ssr: false });
const SupportPage    = dynamic(() => import('@/components/common/SupportPage'),    { ssr: false });

const getTimeAgoShort = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

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
  const headerRef = useRef<HeaderRef>(null);
  const { network, toggle: toggleNetwork } = useNetwork();

  const addToast = (type: ToastMessage['type'], title: string, message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message, shakeCount: 0 }]);
    return id;
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tokens');
      const data = await res.json();
      if (data.success && data.data) {
        setTokens(data.data.map((t: any, i: number): Coin => {
          const createdAt = parsePossiblyUtc7Timestamp(t.created_at);
          const createdAtMs = createdAt?.getTime() ?? Date.now();

          return {
            id: t.id || String(i),
            name: t.name,
            ticker: t.symbol,
            description: t.description || '',
            imageUrl: t.image_url || `https://picsum.photos/200/200?random=${i}`,
            creator: t.owner,
            marketCap: 0,
            replies: 0,
            bondingCurveProgress: 0,
            createdAt: createdAtMs,
            lastReply: createdAtMs,
            priceHistory: [],
            tokenAddress: t.contract_address,
            contractAddress: t.contract_address,
          };
        }));
      }
    } catch { /* silent */ }
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
        {viewState === ViewState.GRID && network === 'MAINNET' && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center select-none">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-widest text-green-400 mb-4">MAINNET</p>
              <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                COMING SOON
              </h1>
              <p className="mt-4 text-gray-500 dark:text-gray-500 text-sm uppercase tracking-widest font-bold">
                Stellar TPAD on Mainnet
              </p>
            </div>
          </div>
        )}

        {viewState === ViewState.GRID && network === 'TESTNET' && (
          <>
            <KingOfTheHill coin={topCoin} onClick={handleCoinClick} />
            <TrendingCoins onClick={handleCoinClick} />
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
                          {Array.from({ length: 10 }).map((_, idx) => (
                            <tr key={idx} className="border-b border-gray-200/60 dark:border-[#1c273a]">
                              <td className="px-4 py-3">
                                <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-800 rounded h-4 w-8">
                                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-800 rounded-full h-8 w-8">
                                    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
                                  </div>
                                  <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-800 rounded h-4 w-32">
                                    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-800 rounded h-4 w-16">
                                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-800 rounded h-4 w-12">
                                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-800 rounded h-4 w-24">
                                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                              <td className="px-4 py-3 text-gray-500">{getTimeAgoShort(coin.createdAt)}</td>
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
