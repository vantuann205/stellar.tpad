'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Wallet, Settings } from 'lucide-react';
import {
  isConnected,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';
import {
  buyToken,
  sellToken,
  getBuyPrice,
  getSellPrice,
  getTokenState,
  getWalletTokenBalance,
  ContractError,
} from '@/features/bonding-curve/bonding-curve.service';
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
const CREATOR_FEE_RATE = 0.003;
const PROTOCOL_FEE_RATE = 0.008;
const TOTAL_FEE_RATE = CREATOR_FEE_RATE + PROTOCOL_FEE_RATE;
const GAS_RESERVE_XLM = 0.3;
const HORIZON_FALLBACK = 'https://horizon-testnet.stellar.org';

function stroopsToXlm(s: bigint): string {
  return (Number(s) / 1e7).toFixed(6);
}

export default function BondingCurveTrader({ tokenAddress, ticker, onTradeSuccess }: BondingCurveTraderProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);
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
          const address = addr.address || (addr as any).publicKey || '';
          if (address) {
            setConnected(true);
            setUserAddress(address);
          }
        }
      } catch { /* freighter not installed */ }
    })();
  }, []);

  const loadBalances = useCallback(async (address: string) => {
    try {
      const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL || HORIZON_FALLBACK;
      const res = await fetch(`${horizonUrl}/accounts/${address}`);
      if (res.ok) {
        const account = await res.json();
        const native = (account.balances || []).find((b: any) => b.asset_type === 'native');
        const balanceValue = parseFloat(native?.balance || '0');
        setXlmBalance(BigInt(Math.floor(balanceValue * 1e7)));
      }
    } catch {
      setXlmBalance(0n);
    }

    try {
      const bal = await getWalletTokenBalance(tokenAddress, address);
      setTokenBalance(bal);
    } catch {
      setTokenBalance(0n);
    }
  }, [tokenAddress]);

  // ── fetch current price ───────────────────────────────────────────────────
  const refreshPrice = useCallback(() => {
    if (!tokenAddress) return;
    getTokenState(tokenAddress)
      .then(s => {
        const basePrice = BigInt(s.base_price);
        const slope = BigInt(s.slope);
        const soldSupply = BigInt(s.sold_supply);
        const soldTokens = soldSupply / STROOPS;
        const priceStroops = basePrice + slope * soldTokens;
        setCurrentPrice(stroopsToXlm(priceStroops));
      })
      .catch(() => {});
  }, [tokenAddress]);

  useEffect(() => {
    refreshPrice();
    if (connected && userAddress) {
      loadBalances(userAddress);
    }
  }, [connected, loadBalances, refreshPrice, tokenAddress, userAddress]);

  useEffect(() => {
    if (!connected || !userAddress) return;
    const id = setInterval(() => {
      loadBalances(userAddress);
    }, 15000);
    return () => clearInterval(id);
  }, [connected, userAddress, loadBalances]);

  // ── debounced price preview ───────────────────────────────────────────────
  const updatePreview = useCallback((nextAmount: string, nextMode: 'buy' | 'sell') => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const num = parseFloat(nextAmount);
    if (!nextAmount || isNaN(num) || num <= 0) { setPreview(null); return; }

    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const rawAmount = BigInt(Math.floor(num * 1e7));
        if (nextMode === 'buy') {
          const costStr = await getBuyPrice(tokenAddress, String(rawAmount));
          const cost = BigInt(costStr);
          const fee = BigInt(Math.floor(Number(cost) * TOTAL_FEE_RATE));
          setPreview({ cost, fee, total: cost + fee });
        } else {
          const proceedsStr = await getSellPrice(tokenAddress, String(rawAmount));
          const proceeds = BigInt(proceedsStr);
          const fee = BigInt(Math.floor(Number(proceeds) * TOTAL_FEE_RATE));
          setPreview({ cost: proceeds, fee, total: proceeds - fee });
        }
      } catch { setPreview(null); }
      finally { setPreviewLoading(false); }
    }, 300);
  }, [tokenAddress]);

  useEffect(() => {
    updatePreview(amount, mode);
  }, [amount, mode, updatePreview]);

  // ── quick amount buttons ──────────────────────────────────────────────────
  const setQuickBuy = (val: number) => setAmount(String(val));
  const setQuickSell = (pct: number) => {
    const amt = Number(tokenBalance) / 1e7 * pct;
    setAmount(amt.toFixed(2));
  };

  // ── sign helper ───────────────────────────────────────────────────────────
  const sign = async (xdr: string): Promise<string> => {
    console.log('[sign] Requesting Freighter signature...');
    const res = await signTransaction(xdr, { networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string });
    console.log('[sign] Freighter response:', typeof res, JSON.stringify(res)?.slice(0, 200));
    // Freighter API v2+ returns { signedTxXdr, signerAddress } or { error }
    if (typeof res === 'object' && res !== null) {
      if ('error' in res && res.error) throw new Error(String(res.error));
      if ('signedTxXdr' in res && res.signedTxXdr) return res.signedTxXdr as string;
    }
    // Older API returns string directly
    if (typeof res === 'string' && res) return res;
    throw new Error('Signing failed or was rejected by wallet');
  };

  const computeMaxBuyAmount = useCallback(async () => {
    const availableXlm = Math.max(0, Number(xlmBalance) / 1e7 - GAS_RESERVE_XLM);
    if (availableXlm <= 0) return '0';

    const basePrice = parseFloat(currentPrice || '0');
    if (basePrice <= 0) return '0';

    let low = 0.1;
    let high = Math.max(0.1, (availableXlm / (1 + TOTAL_FEE_RATE)) / basePrice);
    high = Math.min(high * 1.2, 900_000_000);
    let best = 0;

    for (let i = 0; i < 11 && high - low > 0.01; i++) {
      const mid = (low + high) / 2;
      try {
        const rawAmount = BigInt(Math.floor(mid * 1e7));
        const costStr = await getBuyPrice(tokenAddress, String(rawAmount));
        const cost = BigInt(costStr);
        const totalXlm = (Number(cost) / 1e7) * (1 + TOTAL_FEE_RATE);
        if (totalXlm <= availableXlm) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      } catch {
        high = mid;
      }
    }

    if (best <= 0) return '0';
    const rounded = Math.floor(best * 100) / 100;
    return rounded.toString();
  }, [currentPrice, tokenAddress, xlmBalance]);

  const handleMaxClick = async () => {
    if (mode === 'sell') {
      setAmount((Number(tokenBalance) / 1e7).toFixed(2));
      return;
    }

    setIsCalculatingMax(true);
    try {
      const maxBuy = await computeMaxBuyAmount();
      if (maxBuy === '0') {
        showToast('error', 'insufficient balance for max buy');
        return;
      }
      setAmount(maxBuy);
    } finally {
      setIsCalculatingMax(false);
    }
  };

  // ── trade handler ─────────────────────────────────────────────────────────
  const handleTrade = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    console.log('[handleTrade] userAddress:', userAddress, 'connected:', connected, 'mode:', mode, 'amount:', amount);
    if (!userAddress) {
      showToast('error', 'wallet not connected — please connect Freighter first');
      return;
    }
    setLoading(true);
    try {
      const rawAmount = BigInt(Math.floor(num * 1e7));
      let txHash: string;
      if (mode === 'buy') {
        const maxXlmIn = preview ? String(preview.total * 105n / 100n) : String(rawAmount * 10000n); // 5% slippage
        txHash = await buyToken({
          buyerPublicKey: userAddress,
          tokenAddress,
          tokenAmount: String(rawAmount),
          maxXlmIn,
          signTransaction: sign,
        });
        showToast('success', 'buy successful');
      } else {
        const minXlmOut = preview ? String(preview.total * 95n / 100n) : String(rawAmount * 100n); // 5% slippage
        txHash = await sellToken({
          sellerPublicKey: userAddress,
          tokenAddress,
          tokenAmount: String(rawAmount),
          minXlmOut,
          signTransaction: sign,
        });
        showToast('success', 'sell successful');
      }

      // record trade in database — always, regardless of preview state
      try {
        const tokenRes = await fetch(`/api/tokens/${tokenAddress}`);
        const tokenData = await tokenRes.json();
        
        if (tokenData.success && tokenData.data) {
          // Get updated bonding curve state after trade — chain already confirmed
          const updatedState = await getTokenState(tokenAddress);
          const basePrice = BigInt(updatedState.base_price);
          const slope = BigInt(updatedState.slope);
          const soldSupply = BigInt(updatedState.sold_supply);
          
          // price = base_price + slope * (sold_supply / 10^7)  [in stroops → XLM]
          const soldTokens = soldSupply / STROOPS;
          const currentPriceStroops = basePrice + slope * soldTokens;
          const currentPriceXlm = Number(currentPriceStroops) / 1e7;
          
          // total_price = base XLM value of the trade (from preview or estimate)
          const totalPrice = preview ? Number(preview.cost) / 1e7 : num * currentPriceXlm;
          
          const saveRes = await fetch('/api/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token_id: tokenData.data.id,
              buyer_address: mode === 'buy' ? userAddress : null,
              seller_address: mode === 'sell' ? userAddress : null,
              quantity: num,
              sold_supply: Number(soldSupply) / 1e7,
              price_per_token: currentPriceXlm,
              total_price: totalPrice,
              transaction_hash: txHash,
              status: 'completed',
            }),
          });
          
          if (!saveRes.ok) {
            console.error('[trade] Failed to save purchase:', await saveRes.text());
          } else {
            console.log('[trade] Purchase saved, price:', currentPriceXlm, 'XLM');
          }
        }
      } catch (err) {
        console.error('[trade] Failed to record purchase:', err);
      }

      setAmount('');
      setPreview(null);
      refreshPrice();       // update price display immediately
      onTradeSuccess();     // trigger chart + metrics refresh
      loadBalances(userAddress);
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

  const amountNum = parseFloat(amount) || 0;
  const tokenBalanceNum = Number(tokenBalance) / 1e7;
  const isWalletReady = connected && !!userAddress;
  const buyDisabled  = loading || !isWalletReady || amountNum <= 0;
  const sellDisabled = loading || !isWalletReady || amountNum <= 0 || amountNum > tokenBalanceNum;

  return (
    <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg overflow-hidden shadow-lg">
      {/* toast */}
      {toast && (
        <div className={`px-4 py-2 text-xs font-medium ${toast.type === 'success' ? 'bg-pump-green/10 text-pump-green' : 'bg-pump-red/10 text-pump-red'}`}>
          {toast.msg}
        </div>
      )}

      {/* tabs */}
      <div className="flex border-b border-gray-300 dark:border-gray-800">
        {(['buy', 'sell'] as const).map(t => (
          <button
            key={t}
            onClick={() => setMode(t)}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all relative
              ${mode === t
                ? t === 'buy' ? 'text-pump-green bg-pump-green/5' : 'text-pump-red bg-pump-red/5'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-900/50'}`}
          >
            {t}
            {mode === t && (
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${t === 'buy' ? 'bg-pump-green' : 'bg-pump-red'}`} />
            )}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Settings className="w-3 h-3" />
            0.5% slippage
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Wallet className="w-3.5 h-3.5" />
            {mode === 'buy'
              ? `${(Number(xlmBalance) / 1e7).toFixed(4)} XLM`
              : `${tokenBalanceNum.toFixed(2)} ${ticker.toUpperCase()}`}
          </div>
        </div>

        {/* amount input */}
        <div className="bg-gray-100 dark:bg-gray-900/80 rounded-lg p-4 border border-gray-300 dark:border-gray-800 focus-within:border-pump-green/50 transition-colors">
          <div className="flex justify-between text-xs font-bold text-gray-600 dark:text-gray-500 mb-2">
            <span className="uppercase">amount ({ticker.toUpperCase()})</span>
            <button
              className="uppercase hover:text-gray-800 dark:hover:text-white transition-colors"
              onClick={handleMaxClick}
              disabled={isCalculatingMax}
            >
              {isCalculatingMax ? 'max...' : 'max'}
              </button>
          </div>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.0"
            className="bg-transparent text-2xl font-mono font-bold w-full outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700"
          />
        </div>

        {/* quick buttons */}
        <div className="flex gap-2">
          <button onClick={() => setAmount('')} className="bg-gray-200 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded text-xs font-bold transition-colors">
            reset
          </button>
          {mode === 'buy'
            ? [10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setQuickBuy(v)}
                  className="flex-1 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-xs py-2 rounded text-gray-700 dark:text-gray-300 font-mono transition-colors border border-transparent hover:border-gray-600">
                  {v}
                </button>
              ))
            : [25, 50, 75, 100].map(v => (
                <button key={v} onClick={() => setQuickSell(v / 100)}
                  className="flex-1 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-xs py-2 rounded text-gray-700 dark:text-gray-300 font-mono transition-colors border border-transparent hover:border-gray-600">
                  {v}%
                </button>
              ))}
        </div>

        {/* preview */}
        {(preview || previewLoading) && (
          <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-900/50 rounded-lg text-xs border border-gray-300 dark:border-gray-800/50">
            {previewLoading ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-3 h-3 animate-spin" /> calculating...</div>
            ) : preview ? (
              <>
                <div className="flex justify-between text-gray-500">
                  <span>base value</span>
                  <span className="font-mono text-gray-400">{stroopsToXlm(preview.cost)} XLM</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>fee (1.1%)</span>
                  <span className="font-mono text-gray-400">{stroopsToXlm(preview.fee)} XLM</span>
                </div>
                <div className={`flex justify-between font-bold text-sm pt-2 border-t ${mode === 'buy' ? 'border-pump-green/20' : 'border-pump-red/20'}`}>
                  <span className="text-gray-900 dark:text-white">{mode === 'buy' ? 'total cost:' : 'you receive:'}</span>
                  <span className={`font-mono ${mode === 'buy' ? 'text-pump-green' : 'text-pump-red'}`}>
                    {stroopsToXlm(preview.total)} XLM
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* cta */}
        {isWalletReady ? (
          <button
            onClick={handleTrade}
            disabled={mode === 'buy' ? buyDisabled : sellDisabled}
            className={`w-full py-4 rounded-lg text-lg font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2
              ${mode === 'buy'
                ? 'bg-pump-green text-black hover:bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.2)]'
                : 'bg-pump-red text-white hover:bg-red-400 shadow-[0_0_20px_rgba(248,113,113,0.2)]'}
              disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : `place ${mode} order`}
          </button>
        ) : (
          <button
            onClick={async () => {
              try {
                const addr = await getAddress();
                const address = addr.address || (addr as any).publicKey || '';
                if (!address) {
                  showToast('error', 'could not get wallet address — unlock Freighter first');
                  return;
                }
                setConnected(true);
                setUserAddress(address);
                loadBalances(address);
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
