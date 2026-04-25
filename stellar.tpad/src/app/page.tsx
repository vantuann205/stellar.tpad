'use client'

import React, { useState, useEffect, useMemo, useRef, useReducer } from 'react';
import dynamic from 'next/dynamic';
import Header, { type HeaderRef } from '@/components/layout/header';
import KingOfTheHill from '@/components/common/KingOfTheHill';
import TrendingCoins from '@/components/common/TrendingCoins';
import CoinCard from '@/components/common/CoinCard';
import FilterBar from '@/components/common/FilterBar';
import Toast, { ToastMessage } from '@/components/ui/Toast';
import { Coin, ViewState, SortOption } from '@/types';
import { formatMarketCap, formatPriceChange, formatTraderCount, formatVolume } from '@/lib/helpers';
import { saveWalletInfo } from '@/lib/walletHelper';
import { getWalletErrorMessage, stellarWalletService, WalletServiceError } from '@/services/wallet.service';
import { initialWalletState, walletStateReducer } from '@/store/wallet.store';

const CoinDetail    = dynamic(() => import('@/components/common/CoinDetail'),    { ssr: false });
const CreateCoinPage = dynamic(() => import('@/components/common/CreateCoinPage'), { ssr: false });
const LivestreamsPage = dynamic(() => import('@/components/common/LivestreamsPage'), { ssr: false });
const SupportPage   = dynamic(() => import('@/components/common/SupportPage'),   { ssr: false });

const getTimeAgoShort = (timestamp: number) => {
  const diffInMs = Date.now() - timestamp;
  const diffInMinutes = Math.floor(diffInMs / 60000);
  if (diffInMinutes < 60) return `${Math.max(1, diffInMinutes)}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d`;
};

const buildSparkPathFromValues = (values: number[]) => {
  if (values.length === 0) return '';
  if (values.length === 1) return 'M0 20 L132 20';

  const width = 132;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1e-9);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const normalized = (value - min) / range;
      const y = height - 4 - normalized * (height - 8);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

type OhlcvCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

const getPercentChangeFromCandleSet = (candles: OhlcvCandle[], windowSeconds: number) => {
  if (candles.length < 2) return null;

  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const latest = sorted[sorted.length - 1];
  const reference = [...sorted].reverse().find((c) => c.time <= latest.time - windowSeconds);

  if (!reference || reference.close <= 0) return null;
  return ((latest.close - reference.close) / reference.close) * 100;
};

const formatChangeValue = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '--';
  return formatPriceChange(value);
};

export default function Home() {
  const [viewState, setViewState]     = useState<ViewState>(ViewState.GRID);
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [sortOption, setSortOption]   = useState<SortOption>('creationTime');
  const [listMode, setListMode]       = useState<'grid' | 'table'>('grid');
  const [toasts, setToasts]           = useState<ToastMessage[]>([]);
  const [walletState, dispatchWallet] = useReducer(walletStateReducer, initialWalletState);
  const [realTokens, setRealTokens]   = useState<Coin[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [tableSparkPaths, setTableSparkPaths] = useState<Record<string, string>>({});

  const headerRef = useRef<HeaderRef>(null);

  const addToast = (type: ToastMessage['type'], title: string, message: string) => {
    // Nếu đã có error toast cùng loại → rung thay vì tạo mới
    if (type === 'error') {
      const existing = toasts.find(t => t.type === 'error');
      if (existing) {
        setToasts(prev => prev.map(t =>
          t.id === existing.id
            ? { ...t, title, message, shakeCount: (t.shakeCount ?? 0) + 1 }
            : t
        ));
        return existing.id;
      }
    }
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message, shakeCount: 0 }]);
    return id;
  };

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const handleCoinClick = (coin: Coin) => { setSelectedCoin(coin); setViewState(ViewState.DETAIL); };
  const handleGoHome    = () => { setSelectedCoin(null); setViewState(ViewState.GRID); fetchRealTokens(); };
  const handleGoCreate  = () => setViewState(ViewState.CREATE);
  const handleGoLivestreams = () => setViewState(ViewState.LIVESTREAMS);
  const handleGoSupport = () => setViewState(ViewState.SUPPORT);

  const handleSelectTokenFromSearch = (contractAddress: string) => {
    const token = realTokens.find(t => t.contractAddress === contractAddress);
    if (token) {
      setSelectedCoin(token);
      setViewState(ViewState.DETAIL);
    }
  };

  const fetchRealTokens = async () => {
    setLoadingTokens(true);
    try {
      const response = await fetch('/api/tokens');
      const data = await response.json();
      if (data.success && data.data) {
        const formattedTokens: Coin[] = data.data.map((token: any, idx: number) => {
          const maxReserve = parseFloat(token.max_reserve) || 0;
          const bondingCurveProgress = Math.min(100, (maxReserve / 10000) * 100);
          return {
            id: String(token.id ?? idx),
            name: token.name,
            ticker: token.symbol,
            description: token.description || 'Token created on Oasis Sapphire',
            imageUrl: token.image_url || `https://picsum.photos/200/200?random=${idx + 500}`,
            creator: token.owner,
            marketCap: parseFloat(token.marketcap) || 0,
            maxReserve,
            volume24h: parseFloat(token.computed_volume_24h ?? token.volume_24h) || 0,
            priceChange5m: token.price_change_5m !== undefined && token.price_change_5m !== null ? parseFloat(token.price_change_5m) : null,
            priceChange4h: token.price_change_4h !== undefined && token.price_change_4h !== null ? parseFloat(token.price_change_4h) : null,
            priceChange6h: token.price_change_6h !== undefined && token.price_change_6h !== null ? parseFloat(token.price_change_6h) : null,
            traderCount: parseInt(token.computed_trader_count ?? token.trader_count) || 0,
            lastTradeType: token.last_trade_type ?? null,
            replies: 0,
            bondingCurveProgress,
            createdAt: new Date(token.created_at).getTime(),
            lastReply: new Date(token.created_at).getTime(),
            priceHistory: token.price_snapshot_value
              ? [{ time: '', price: parseFloat(token.price_snapshot_value) }]
              : [],
            tokenAddress: token.contract_address,
            contractAddress: token.contract_address,
          };
        });
        setRealTokens(formattedTokens);
      } else {
        setRealTokens([]);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setRealTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => { fetchRealTokens(); }, []);

  useEffect(() => {
    if (viewState !== ViewState.GRID) return;
    const interval = setInterval(fetchRealTokens, 10000);
    return () => clearInterval(interval);
  }, [viewState]);

  // Refresh metrics cho tất cả tokens khi ở table mode
  useEffect(() => {
    if (viewState !== ViewState.GRID || listMode !== 'table') return;

    const refreshAllMetrics = async () => {
      await Promise.all(
        realTokens.map(coin =>
          fetch('/api/tokens/calculate-metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token_id: coin.id }),
          }).catch(() => {})
        )
      );
      fetchRealTokens();
    };

    refreshAllMetrics();
    const interval = setInterval(refreshAllMetrics, 15000);
    return () => clearInterval(interval);
  }, [viewState, listMode]);
  const topCoinByMarketCap = useMemo(() => {
    const coins = [...realTokens];
    return coins.length > 0 ? coins.sort((a, b) => b.marketCap - a.marketCap)[0] : null;
  }, [realTokens]);

  const sortedCoins = useMemo(() => {
    const coins = [...realTokens];
    switch (sortOption) {
      case 'marketCap':    return coins.sort((a, b) => b.marketCap - a.marketCap);
      case 'creationTime': return coins.sort((a, b) => b.createdAt - a.createdAt);
      case 'lastReply':    return coins.sort((a, b) => b.lastReply - a.lastReply);
      default:             return coins.sort((a, b) => b.marketCap - a.marketCap);
    }
  }, [sortOption, realTokens]);

  useEffect(() => {
    let cancelled = false;

    const loadTableSparkPaths = async () => {
      if (listMode !== 'table' || sortedCoins.length === 0) {
        setTableSparkPaths({});
        return;
      }
      const entries = await Promise.all(
        sortedCoins.map(async (coin) => {
          try {
            // Chọn interval theo tuổi token để full history fit vừa sparkline
            const ageMs = Date.now() - coin.createdAt;
            const ageHours = ageMs / 3_600_000;
            const sparkInterval =
              ageHours < 2   ? '1m'  :
              ageHours < 12  ? '5m'  :
              ageHours < 72  ? '15m' :
              ageHours < 336 ? '1h'  : '4h';

            const res = await fetch(`/api/ohlcv?tokenId=${coin.id}&interval=${sparkInterval}`);
            const data = await res.json();

            const fiveMinuteCandles = (Array.isArray(data?.data) ? data.data : []) as OhlcvCandle[];

            const sparkCloses = fiveMinuteCandles
              .map((candle) => Number(candle.close))
              .filter((close) => Number.isFinite(close) && close > 0);
            const path = sparkCloses.length >= 2
              ? buildSparkPathFromValues(sparkCloses)
              : 'M0 20 L132 20'; // flat line nếu chưa có trade
            const dir = sparkCloses.length >= 2
              ? (sparkCloses[sparkCloses.length - 1] > sparkCloses[0] ? 'up'
                : sparkCloses[sparkCloses.length - 1] < sparkCloses[0] ? 'down'
                : 'flat')
              : 'flat';

            return [
              [String(coin.id), path],
              [String(coin.id) + '_dir', dir],
            ] as const;
          } catch {
            return [
              [String(coin.id), 'M0 20 L132 20'],
              [String(coin.id) + '_dir', 'up'],
            ] as const;
          }
        })
      );

      if (!cancelled) {
        setTableSparkPaths(Object.fromEntries(entries.flat()));
      }
    };

    void loadTableSparkPaths();
    const sparkInterval = listMode === 'table' ? setInterval(() => { void loadTableSparkPaths(); }, 15000) : null;

    return () => {
      cancelled = true;
      if (sparkInterval) clearInterval(sparkInterval);
    };
  }, [listMode, sortedCoins]);

  const handleConnectWallet = async () => {
    dispatchWallet({ type: 'connecting' });

    try {
      const { provider, address } = await stellarWalletService.connect();
      dispatchWallet({ type: 'connected', payload: { provider, address } });
      try { await saveWalletInfo(address); } catch { /* silent */ }
      addToast('success', 'Wallet Connected', `Connected to ${address.slice(0, 6)}...`);
    } catch (error) {
      const errorCode = error instanceof WalletServiceError ? error.code : 'unknown';
      dispatchWallet({ type: 'error', payload: { errorCode } });
      addToast('error', 'Connection Failed', getWalletErrorMessage(errorCode));
    }
  };

  const handleDisconnectWallet = async () => {
    await stellarWalletService.disconnect();
    dispatchWallet({ type: 'disconnected' });
    addToast('success', 'Wallet Disconnected', 'Your wallet has been disconnected.');
  };

  useEffect(() => {
    const restoreWalletConnection = async () => {
      const restoredSession = await stellarWalletService.restoreSession();
      if (!restoredSession) return;

      dispatchWallet({
        type: 'connected',
        payload: {
          provider: restoredSession.provider,
          address: restoredSession.address,
        },
      });

      try { await saveWalletInfo(restoredSession.address); } catch { /* silent */ }
    };

    restoreWalletConnection();
  }, []);

  useEffect(() => {
    const onMetricsUpdated = () => {
      void fetchRealTokens();
    };

    window.addEventListener('token-metrics-updated', onMetricsUpdated as EventListener);
    return () => {
      window.removeEventListener('token-metrics-updated', onMetricsUpdated as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-pump-text font-sans pb-20 relative">
      <Header
        ref={headerRef}
        onGoHome={handleGoHome}
        onGoCreate={handleGoCreate}
        onGoLivestreams={handleGoLivestreams}
        onGoSupport={handleGoSupport}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onSelectToken={handleSelectTokenFromSearch}
        walletConnected={walletState.status === 'connected'}
        walletAddress={walletState.address}
        currentView={viewState}
      />

      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map(toast => <Toast key={toast.id} toast={toast} onClose={removeToast} />)}
      </div>

      <main className="container mx-auto px-4 py-6">
        {viewState === ViewState.GRID && (
          <>
            <KingOfTheHill coin={topCoinByMarketCap} onClick={handleCoinClick} />
            <TrendingCoins onClick={handleCoinClick} />
            <div className="mt-8">
              <FilterBar
                currentSort={sortOption}
                onSortChange={setSortOption}
                listMode={listMode}
                onListModeChange={setListMode}
              />

              {listMode === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedCoins.map((coin) => (
                    <div key={coin.id}>
                      <CoinCard coin={coin} onClick={handleCoinClick} />
                    </div>
                  ))}
                </div>
              )}

              {listMode === 'table' && (
                <div className="overflow-x-auto rounded-xl border border-gray-300/70 bg-white/80 shadow-lg dark:border-[#24324b] dark:bg-[#0b0f19]">
                  <table className="w-full min-w-[1080px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/80 bg-gradient-to-r from-slate-100 to-slate-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#22314a] dark:from-[#142238] dark:to-[#101a2d] dark:text-gray-400">
                        <th className="px-4 py-3 font-semibold">Coin</th>
                        <th className="px-4 py-3 font-semibold">Graph</th>
                        <th className="px-4 py-3 font-semibold">MCAP</th>
                        <th className="px-4 py-3 font-semibold">Age</th>
                        <th className="px-4 py-3 font-semibold">24H VOL</th>
                        <th className="px-4 py-3 font-semibold">TRADERS</th>
                        <th className="px-4 py-3 font-semibold">5M</th>
                        <th className="px-4 py-3 font-semibold">4H</th>
                        <th className="px-4 py-3 font-semibold">6H</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCoins.map((coin, idx) => {
                        const overview = {
                          volume24h: coin.volume24h ?? 0,
                          traderCount: coin.traderCount ?? 0,
                          priceChange5m: coin.priceChange5m ?? null,
                          priceChange4h: coin.priceChange4h ?? null,
                          priceChange6h: coin.priceChange6h ?? null,
                        };
                        const sparkPath = tableSparkPaths[String(coin.id)] || '';
                        return (
                          <tr
                            key={coin.id}
                            onClick={() => handleCoinClick(coin)}
                            className="cursor-pointer border-b border-gray-200/60 text-gray-800 transition hover:bg-slate-100/70 dark:border-[#1c273a] dark:text-gray-100 dark:hover:bg-[#101726]"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="w-8 text-lg font-semibold text-gray-500 dark:text-gray-400">#{idx + 1}</span>
                                <img src={coin.imageUrl} alt={coin.name} className="h-9 w-9 rounded-full object-cover" />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold">{coin.name}</p>
                                  <p className="truncate text-xs tracking-wide text-gray-500 dark:text-gray-400">{coin.ticker}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {(() => {
                                const path = tableSparkPaths[String(coin.id)];
                                if (!path) return <div className="h-10 w-[132px] rounded bg-gray-200/60 dark:bg-[#1a2231]" />;
                                const sparkColor = tableSparkPaths[String(coin.id) + '_dir'] === 'down' ? '#ef5350'
                                  : tableSparkPaths[String(coin.id) + '_dir'] === 'up' ? '#26a69a'
                                  : '#6b7280';
                                const gradId = `sg-${coin.id}`;
                                const fillPath = path + ' L132 40 L0 40 Z';
                                return (
                                  <svg viewBox="0 0 132 40" className="h-10 w-[132px]">
                                    <defs>
                                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={sparkColor} stopOpacity="0.35" />
                                        <stop offset="100%" stopColor={sparkColor} stopOpacity="0.02" />
                                      </linearGradient>
                                    </defs>
                                    <path d={fillPath} fill={`url(#${gradId})`} />
                                    <path
                                      d={path}
                                      fill="none"
                                      stroke={sparkColor}
                                      strokeWidth="1.5"
                                      strokeLinejoin="round"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 font-semibold text-emerald-500">{formatMarketCap(coin.marketCap)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800 dark:text-gray-100">{getTimeAgoShort(coin.createdAt)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium">{formatVolume(overview.volume24h)}</td>
                            <td className="px-4 py-3 font-medium">{formatTraderCount(overview.traderCount)}</td>
                            <td className={`px-4 py-3 font-semibold ${overview.priceChange5m !== null && overview.priceChange5m < 0 ? 'text-pump-red' : 'text-pump-green'}`}>{formatChangeValue(overview.priceChange5m)}</td>
                            <td className={`px-4 py-3 font-semibold ${overview.priceChange4h !== null && overview.priceChange4h < 0 ? 'text-pump-red' : 'text-pump-green'}`}>{formatChangeValue(overview.priceChange4h)}</td>
                            <td className={`px-4 py-3 font-semibold ${overview.priceChange6h !== null && overview.priceChange6h < 0 ? 'text-pump-red' : 'text-pump-green'}`}>{formatChangeValue(overview.priceChange6h)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {!loadingTokens && sortedCoins.length === 0 && (
                    <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No tokens to display with current filters.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {viewState === ViewState.DETAIL && selectedCoin && (
          <CoinDetail coin={selectedCoin} onBack={handleGoHome} showToast={addToast} removeToast={removeToast} />
        )}

        {viewState === ViewState.CREATE && (
          <CreateCoinPage
            onCancel={handleGoHome}
            onTokenCreated={async (addr) => {
              addToast('success', 'Token Created', `Address: ${addr}`);
              await fetchRealTokens();
              // Navigate thẳng đến token mới
              const newToken = realTokens.find(t => t.contractAddress?.toLowerCase() === addr.toLowerCase());
              if (newToken) {
                setSelectedCoin(newToken);
                setViewState(ViewState.DETAIL);
              } else {
                handleGoHome();
              }
            }}
          />
        )}

        {viewState === ViewState.LIVESTREAMS && <LivestreamsPage />}
        {viewState === ViewState.SUPPORT && <SupportPage />}
      </main>
    </div>
  );
}
