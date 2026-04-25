'use client'

import React, { useEffect, useState, useRef } from 'react';
import { Coin, Comment, Trade } from '../types';
import TokenLightweightChart from './TokenLightweightChart';
import TradeForm from './TradeForm';
import CommentSection from './CommentSection';
import TransactionTable from './TransactionTable';
import BondingCurve from './BondingCurve';
import TokenInfoBar from './TokenInfoBar';
import TokenMetrics from './TokenMetrics';
import HoldersList from './HoldersList';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { ToastMessage } from './Toast';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { wrapEthereumProvider } from '@oasisprotocol/sapphire-paratime';
import { TOKEN_ABI } from '../abi/factoryAbi';

const BONDING_TARGET = 10000; // TEST
const CREATOR_FEE_RATE = 0.003;
const PROTOCOL_FEE_RATE = 0.008;

interface CoinDetailProps {
  coin: Coin;
  onBack: () => void;
  showToast: (type: ToastMessage['type'], title: string, message: string) => string;
  removeToast: (id: string) => void;
}

const CoinDetail: React.FC<CoinDetailProps> = ({ coin, onBack, showToast, removeToast }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [tokenData, setTokenData] = useState<Coin & { reserveBalance?: number }>(coin as any);
  const [tokenMetrics, setTokenMetrics] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<{ address: string; displayName: string | null }>({ address: '', displayName: null });
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  // Bonding progress state — separate so it updates instantly on buy
  const [maxReserve, setMaxReserve] = useState<number>(0);
  const maxReserveRef = useRef<number>(0); // sync ref for optimistic update
  const commentsEventSourceRef = useRef<EventSource | null>(null);

  const progress = Math.min(100, (maxReserve / BONDING_TARGET) * 100);
  const pctRemaining = (100 - progress).toFixed(4);

  const getProvider = async () => {
    let ethereum = window.ethereum;
    if (window.ethereum?.providers) {
      ethereum = window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum;
    }
    return new BrowserProvider(wrapEthereumProvider(ethereum));
  };

  // ── Load bonding progress from DB ──────────────────────────────────────────
  const loadBondingProgress = async () => {
    if (!coin.id) return;
    try {
      const res = await fetch(`/api/bonding-progress?tokenId=${coin.id}`);
      const data = await res.json();
      if (data.success) {
        const val = parseFloat(data.data.max_reserve) || 0;
        maxReserveRef.current = val;
        setMaxReserve(val);
      }
    } catch { /* silent */ }
  };

  // ── Load price + market data from chain ────────────────────────────────────
  const loadRealTokenData = async () => {
    if (!coin.tokenAddress || !window.ethereum) return;
    try {
      const provider = await getProvider();
      const tokenContract = new Contract(coin.tokenAddress, TOKEN_ABI, provider);
      const [price, sold] = await Promise.all([
        tokenContract.getCurrentPrice(),
        tokenContract.soldSupply(),
      ]);
      const priceEth = parseFloat(formatEther(price));
      const soldEth = parseFloat(formatEther(sold));
      setTokenData(prev => ({
        ...prev,
        marketCap: soldEth * priceEth * 1_000_000,
        priceHistory: [
          ...prev.priceHistory,
          { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), price: priceEth },
        ],
      }));
      loadTokenMetrics(priceEth);
    } catch (e) {
      console.error('Error loading token data:', e);
    }
  };

  const loadTokenMetrics = async (_currentPrice?: number) => {
    if (!coin.id) return;
    try {
      const res = await fetch(`/api/tokens/update-metrics?token_id=${coin.id}`);
      const data = await res.json();
      if (data.success && data.data) setTokenMetrics(data.data);
    } catch { /* silent */ }
  };

  const fetchRealTrades = async () => {
    if (!coin.id) return;
    try {
      const res = await fetch(`/api/trades?tokenId=${coin.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setLiveTrades(data.data.map((p: any) => ({
          type: p.trade_type === 'sell' ? 'sell' : 'buy',
          amount: null,
          price: parseFloat(p.price_per_token) || 0,
          totalPrice: parseFloat(p.total_price) || 0,
          creatorFee: (parseFloat(p.total_price) || 0) * CREATOR_FEE_RATE,
          protocolFee: (parseFloat(p.total_price) || 0) * PROTOCOL_FEE_RATE,
          totalFee: (parseFloat(p.total_price) || 0) * (CREATOR_FEE_RATE + PROTOCOL_FEE_RATE),
          timestamp: p.created_at,
          user: p.buyer_address || p.seller_address || '0x...',
          txHash: p.transaction_hash || null,
        })));
      }
    } catch { /* silent */ }
  };

  const fetchRealComments = async () => {
    if (!coin.id) return;
    try {
      const res = await fetch(`/api/comments?tokenId=${coin.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        const vnDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        const toDisplayTimeString = (value: string) => {
          const normalized = value.replace(' ', 'T');
          const hasTimeZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized);
          let dt: Date;

          if (!hasTimeZone && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(normalized)) {
            const [datePart, timePart] = normalized.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hour, minute, second] = timePart.split(':').map(Number);
            dt = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
          } else {
            dt = new Date(value);
          }

          if (Number.isNaN(dt.getTime())) return value;

          const parts = vnDateTimeFormatter.formatToParts(dt);
          const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
          return `${byType.hour}:${byType.minute} ${byType.day}/${byType.month}/${byType.year}`;
        };

        setComments(data.data.map((c: any) => ({
          id: c.id.toString(),
          user: c.username || c.user_address || 'Anonymous',
          avatarUrl: c.avatar_url || '',
          text: c.comment_text || '',
          timestamp: toDisplayTimeString(c.created_at),
          type: 'chat',
        })));
      }
    } catch { /* silent */ }
  };

  const loadCurrentUser = async () => {
    if (!window.ethereum) return;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const address = accounts?.[0] || '';
      if (!address) return;

      let displayName: string | null = null;
      try {
        const res = await fetch(`/api/wallets?address=${address}`);
        const data = await res.json();
        if (data.success && data.wallet?.display_name) {
          displayName = data.wallet.display_name;
        }
      } catch { /* silent */ }

      setCurrentUser({ address, displayName });
    } catch { /* silent */ }
  };

  const connectCommentsStream = () => {
    if (!coin.id) return () => { };

    const es = new EventSource(`/api/comments/stream?tokenId=${coin.id}`);
    commentsEventSourceRef.current = es;

    const onCommentsUpdated = () => {
      fetchRealComments();
    };

    es.addEventListener('comments-updated', onCommentsUpdated);
    es.addEventListener('ready', onCommentsUpdated);
    es.onerror = () => {
      es.close();
      commentsEventSourceRef.current = null;
      setTimeout(() => {
        if (!commentsEventSourceRef.current) connectCommentsStream();
      }, 2500);
    };

    return () => {
      es.removeEventListener('comments-updated', onCommentsUpdated);
      es.removeEventListener('ready', onCommentsUpdated);
      es.close();
      if (commentsEventSourceRef.current === es) {
        commentsEventSourceRef.current = null;
      }
    };
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    loadBondingProgress();
    loadRealTokenData();

    // Recalc metrics khi user load trang (sliding window có thể đã trượt)
    if (coin.id) {
      fetch('/api/tokens/calculate-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: coin.id }),
      }).then(() => loadTokenMetrics()).catch(() => {});
    }

    loadTokenMetrics();
    fetchRealTrades();
    fetchRealComments();
    loadCurrentUser();

    const disconnectCommentsStream = connectCommentsStream();

    const priceInterval    = setInterval(loadRealTokenData, 5_000);
    const metricsInterval  = setInterval(loadTokenMetrics, 10_000);
    const progressInterval = setInterval(loadBondingProgress, 15_000);
    const tradesInterval   = setInterval(fetchRealTrades, 5_000);
    const commentsFallbackInterval = setInterval(fetchRealComments, 20_000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(metricsInterval);
      clearInterval(progressInterval);
      clearInterval(tradesInterval);
      clearInterval(commentsFallbackInterval);
      disconnectCommentsStream();
    };
  }, [coin]);

  const handleAddComment = async (text: string) => {
    if (!coin.id) return;
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: coin.id,
          userAddress: currentUser.address || currentUser.displayName || 'Anonymous',
          text,
        }),
      });
      if (res.ok) {
        await fetchRealComments();
      }
    } catch { /* silent */ }
  };

  // ── Called by TradeForm after successful buy ────────────────────────────────
  const handleTradeSuccess = async (tradeType: 'buy' | 'sell', totalPrice: number) => {
    const newVal = tradeType === 'buy'
      ? maxReserveRef.current + totalPrice
      : Math.max(0, maxReserveRef.current - totalPrice);
    maxReserveRef.current = newVal;
    setMaxReserve(newVal);

    // Fetch tất cả song song — cùng lúc update ngay
    await Promise.all([
      loadRealTokenData(),
      fetchRealTrades(),
      loadBondingProgress(),
      loadTokenMetrics(),
    ]);
    setChartRefreshKey(k => k + 1);
  };

  const currentPrice = tokenData.priceHistory[tokenData.priceHistory.length - 1]?.price;

  return (
    <div className="container mx-auto px-4 py-4 max-w-[1600px] animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white mb-4 text-sm font-bold uppercase transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to board
      </button>

      <TokenInfoBar coin={tokenData} currentPriceOverride={currentPrice} />
      <TokenMetrics token={tokenMetrics} key={tokenMetrics?.id || 'empty'} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <TokenLightweightChart
            tokenId={coin.id}
            ticker={coin.ticker}
            currentPrice={currentPrice}
            createdAt={coin.createdAt}
            refreshKey={chartRefreshKey}
          />

          {/* Bonding Curve — full width, replaces AI Analysis */}
          <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">BONDING CURVE PROGRESS</h3>
              </div>
              <div className="flex items-center gap-3 text-sm font-bold">
                <span className="text-pump-green">{progress.toFixed(4)}%</span>
                <span className="text-gray-400 dark:text-gray-600">·</span>
                <span className="text-gray-600 dark:text-gray-400 text-xs font-mono">{pctRemaining}% to Graduate</span>
              </div>
            </div>

            {/* Progress bar */}
            <BondingCurve progress={progress} />

            {/* Stats row */}
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <div className="text-gray-700 dark:text-gray-600 uppercase tracking-wider mb-0.5">Collected</div>
                <div className="text-gray-900 dark:text-white font-bold">{maxReserve.toFixed(4)} TEST</div>
              </div>
              <div className="text-right">
                <div className="text-gray-700 dark:text-gray-600 uppercase tracking-wider mb-0.5">Target</div>
                <div className="text-gray-900 dark:text-gray-300 font-bold">10,000 TEST</div>
              </div>
            </div>

            {/* Warning */}
            <div className="mt-4 flex gap-3 items-start bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-400 dark:border-yellow-700/30 p-3 rounded text-[11px] text-yellow-700 dark:text-yellow-500">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                When the BONDING CURVE reaches <b>10,000 TEST</b>, all liquidity will be deposited into{' '}
                <b>Oasis DEX</b> and burned. Token graduates to open market.
              </p>
            </div>
          </div>

          <div className="hidden lg:block">
            <TransactionTable trades={liveTrades} />
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <TradeForm
            coin={tokenData}
            showToast={showToast}
            removeToast={removeToast}
            onSuccess={handleTradeSuccess}
          />
          <CommentSection comments={comments} onAddComment={handleAddComment} />
          <HoldersList tokenId={coin.id} refreshKey={chartRefreshKey} />
          <div className="lg:hidden">
            <TransactionTable trades={liveTrades} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoinDetail;
