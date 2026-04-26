'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import {
  isConnected,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';
import {
  getBuyPrice,
  getSellPrice,
  getTokenState,
  executeBuy,
  executeSell,
  ContractError,
} from '@/features/trade/bonding-curve.service';
import { STELLAR_NETWORK_PASSPHRASE } from '@/config/network';

interface BondingCurveTraderProps {
  tokenAddress: string;
  ticker: string;
  onTradeSuccess: () => void;
}

interface Preview {
  cost: bigint;
  fee: bigint;
  total: bigint;
}

const STROOPS = 10_000_000n;

function stroopsToXlm(s: bigint): string {
  return (Number(s) / 1e7).toFixed(6);
}

export default function BondingCurveTrader({ tokenAddress, ticker, onTradeSuccess }: BondingCurveTraderProps) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [tokenAmount, setTokenAmount] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [xlmBalance, setXlmBalance] = useState(0n);
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── toast helper ──────────────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── wallet connection ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const conn = await isConnected();
        if (conn.isConnected) {
          const addr = await getAddress();
          setConnected(true);
          setUserAddress(addr.address ?? '');
        }
      } catch { /* freighter not installed */ }
    })();
  }, []);

  // ── fetch current price on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!tokenAddress) return;
    getTokenState(tokenAddress)
      .then(s => {
        const priceStroops = s.base_price + s.slope * s.sold_supply / STROOPS;
        setCurrentPrice(stroopsToXlm(priceStroops));
      })
      .catch(() => {});
  }, [tokenAddress]);

  // ── debounced price preview ───────────────────────────────────────────────
  const updatePreview = useCallback((amount: string, mode: 'buy' | 'sell') => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) { setPreview(null); return; }

    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const rawAmount = BigInt(Math.floor(num * 1e7));
        if (mode === 'buy') {
          const cost = await getBuyPrice(tokenAddress, rawAmount);
          const fee = cost / 100n;
          setPreview({ cost, fee, total: cost + fee });
        } else {
          const proceeds = await getSellPrice(tokenAddress, rawAmount);
          const fee = proceeds / 100n;
          setPreview({ cost: proceeds, fee, total: proceeds - fee });
        }
      } catch { setPreview(null); }
      finally { setPreviewLoading(false); }
    }, 300);
  }, [tokenAddress]);

  useEffect(() => {
    updatePreview(tokenAmount, tab);
  }, [tokenAmount, tab, updatePreview]);

  // ── quick amount buttons ──────────────────────────────────────────────────
  const setQuickBuy = (val: number) => setTokenAmount(String(val));
  const setQuickSell = (pct: number) => {
    const amt = Number(tokenBalance) / 1e7 * pct;
    setTokenAmount(amt.toFixed(2));
  };

  // ── sign helper ───────────────────────────────────────────────────────────
  const sign = async (xdr: string) => {
    const res = await signTransaction(xdr, { networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string });
    if ('error' in res) throw new Error(res.error);
    return res.signedTxXdr;
  };

  // ── trade handler ─────────────────────────────────────────────────────────
  const handleTrade = async () => {
    const num = parseFloat(tokenAmount);
    if (!num || num <= 0) return;
    setLoading(true);
    try {
      const rawAmount = BigInt(Math.floor(num * 1e7));
      if (tab === 'buy') {
        await executeBuy({ buyer: userAddress, tokenAddress, tokenAmount: rawAmount, signTransaction: sign });
        showToast('success', 'buy successful');
      } else {
        await executeSell({ seller: userAddress, tokenAddress, tokenAmount: rawAmount, signTransaction: sign });
        showToast('success', 'sell successful');
      }

      // record trade
      if (preview) {
        await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenId: tokenAddress,
            type: tab,
            tokenAmount: String(rawAmount),
            xlmAmount: String(preview.cost),
            price: Number(preview.cost) / 1e7 / num,
            fee: String(preview.fee),
            user: userAddress,
            txHash: Date.now().toString(36),
            timestamp: new Date().toISOString(),
          }),
        });
      }

      setTokenAmount('');
      setPreview(null);
      onTradeSuccess();
    } catch (err) {
      if (err instanceof ContractError) {
        if (err.code === 5) showToast('error', 'price moved, please retry');
        else if (err.code === 6) showToast('error', 'not enough tokens available');
        else if (err.code === 9) showToast('error', 'insufficient token balance');
        else showToast('error', err.message);
      } else {
        showToast('error', String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const amountNum = parseFloat(tokenAmount) || 0;
  const tokenBalanceNum = Number(tokenBalance) / 1e7;
  const buyDisabled  = loading || !connected || amountNum <= 0;
  const sellDisabled = loading || !connected || amountNum <= 0 || amountNum > tokenBalanceNum;

  return (
    <div className="bg-pump-card border border-gray-800 rounded-lg overflow-hidden shadow-lg">
      {/* toast */}
      {toast && (
        <div className={`px-4 py-2 text-xs font-medium ${toast.type === 'success' ? 'bg-pump-green/10 text-pump-green' : 'bg-pump-red/10 text-pump-red'}`}>
          {toast.msg}
        </div>
      )}

      {/* tabs */}
      <div className="flex border-b border-gray-800">
        {(['buy', 'sell'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all relative
              ${tab === t
                ? t === 'buy' ? 'text-pump-green bg-pump-green/5' : 'text-pump-red bg-pump-red/5'
                : 'text-gray-500 hover:text-gray-300 bg-gray-900/50'}`}
          >
            {t}
            {tab === t && (
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${t === 'buy' ? 'bg-pump-green' : 'bg-pump-red'}`} />
            )}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {/* balance + price */}
        <div className="flex justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" />
            {tab === 'buy'
              ? `${(Number(xlmBalance) / 1e7).toFixed(4)} XLM`
              : `${tokenBalanceNum.toFixed(2)} ${ticker.toUpperCase()}`}
          </span>
          {currentPrice && <span>price: {currentPrice} XLM</span>}
        </div>

        {/* amount input */}
        <div className="bg-gray-900/80 rounded-lg p-4 border border-gray-800 focus-within:border-pump-green/50 transition-colors">
          <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
            <span className="uppercase">amount ({ticker.toUpperCase()})</span>
            {tab === 'sell' && (
              <button className="uppercase hover:text-white transition-colors" onClick={() => setTokenAmount(tokenBalanceNum.toFixed(2))}>
                max
              </button>
            )}
          </div>
          <input
            type="number"
            value={tokenAmount}
            onChange={e => setTokenAmount(e.target.value)}
            placeholder="0.0"
            className="bg-transparent text-2xl font-mono font-bold w-full outline-none text-white placeholder-gray-700"
          />
        </div>

        {/* quick buttons */}
        <div className="flex gap-2">
          <button onClick={() => setTokenAmount('')} className="bg-gray-800 text-gray-500 hover:text-white px-3 py-2 rounded text-xs font-bold transition-colors">
            reset
          </button>
          {tab === 'buy'
            ? [10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setQuickBuy(v)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-xs py-2 rounded text-gray-300 font-mono transition-colors border border-transparent hover:border-gray-600">
                  {v}
                </button>
              ))
            : [25, 50, 75, 100].map(v => (
                <button key={v} onClick={() => setQuickSell(v / 100)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-xs py-2 rounded text-gray-300 font-mono transition-colors border border-transparent hover:border-gray-600">
                  {v}%
                </button>
              ))}
        </div>

        {/* preview */}
        {(preview || previewLoading) && (
          <div className="space-y-2 p-3 bg-gray-900/50 rounded-lg text-xs border border-gray-800/50">
            {previewLoading ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-3 h-3 animate-spin" /> calculating...</div>
            ) : preview ? (
              <>
                <div className="flex justify-between text-gray-500">
                  <span>base value</span>
                  <span className="font-mono text-gray-400">{stroopsToXlm(preview.cost)} XLM</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>fee (1%)</span>
                  <span className="font-mono text-gray-400">{stroopsToXlm(preview.fee)} XLM</span>
                </div>
                <div className={`flex justify-between font-bold text-sm pt-2 border-t ${tab === 'buy' ? 'border-pump-green/20' : 'border-pump-red/20'}`}>
                  <span className="text-white">{tab === 'buy' ? 'total cost:' : 'you receive:'}</span>
                  <span className={`font-mono ${tab === 'buy' ? 'text-pump-green' : 'text-pump-red'}`}>
                    {stroopsToXlm(preview.total)} XLM
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* cta */}
        {connected ? (
          <button
            onClick={handleTrade}
            disabled={tab === 'buy' ? buyDisabled : sellDisabled}
            className={`w-full py-4 rounded-lg text-lg font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2
              ${tab === 'buy'
                ? 'bg-pump-green text-black hover:bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.2)]'
                : 'bg-pump-red text-white hover:bg-red-400 shadow-[0_0_20px_rgba(248,113,113,0.2)]'}
              disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : `place ${tab} order`}
          </button>
        ) : (
          <button
            onClick={async () => {
              try {
                const addr = await getAddress();
                setConnected(true);
                setUserAddress(addr.address ?? '');
              } catch { showToast('error', 'freighter not found'); }
            }}
            className="w-full py-4 rounded-lg text-sm font-bold uppercase tracking-widest bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            connect wallet
          </button>
        )}
      </div>
    </div>
  );
}
