'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Wallet, Settings } from 'lucide-react';
import {
  buyToken,
  sellToken,
  getBuyPrice,
  getSellPrice,
  getTokenState,
  getWalletTokenBalance,
  ContractError,
} from '@/features/bonding-curve/bonding-curve.service';
import { stellarWalletService } from '@/services/wallet.service';
import { STELLAR_NETWORK_PASSPHRASE } from '@/config/network';
import { STELLAR_HORIZON_URL } from '@/config/network';

// Freighter addToken — only available in browser with Freighter extension
let freighterAddToken: ((args: { contractId: string; networkPassphrase?: string }) => Promise<any>) | null = null;
if (typeof window !== 'undefined') {
  import('@stellar/freighter-api').then(m => { freighterAddToken = m.addToken; }).catch(() => {});
}

interface BondingCurveTraderProps {
  tokenAddress: string;
  ticker: string;
  walletAddress?: string; // passed from TradingPageClient (navbar wallet state)
  onTradeSuccess: () => void;
}

interface Preview {
  cost: bigint;
  fee: bigint;
  total: bigint;
}

const STROOPS = 10_000_000n;
const TOTAL_FEE_RATE = 0.005; // 0.5% fee per transaction
const GAS_RESERVE_XLM = 0.3;

function stroopsToXlm(s: bigint): string {
  return (Number(s) / 1e7).toFixed(6);
}

export default function BondingCurveTrader({
  tokenAddress,
  ticker,
  walletAddress,
  onTradeSuccess,
}: BondingCurveTraderProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [xlmBalance, setXlmBalance] = useState(0n);
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWalletReady = !!walletAddress;

  // ── toast helper ──────────────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── load balances ─────────────────────────────────────────────────────────
  const loadBalances = useCallback(async (address: string) => {
    if (!address) return;
    try {
      const res = await fetch(`${STELLAR_HORIZON_URL}/accounts/${address}`);
      if (res.ok) {
        const account = await res.json();
        const native = (account.balances || []).find((b: any) => b.asset_type === 'native');
        setXlmBalance(BigInt(Math.floor(parseFloat(native?.balance || '0') * 1e7)));
      }
    } catch { setXlmBalance(0n); }

    try {
      const bal = await getWalletTokenBalance(tokenAddress, address);
      setTokenBalance(bal);
    } catch { setTokenBalance(0n); }
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

  // Reload when wallet changes
  useEffect(() => {
    refreshPrice();
    if (walletAddress) loadBalances(walletAddress);
  }, [walletAddress, tokenAddress, refreshPrice, loadBalances]);

  // Poll balances every 15s
  useEffect(() => {
    if (!walletAddress) return;
    const id = setInterval(() => loadBalances(walletAddress), 15000);
    return () => clearInterval(id);
  }, [walletAddress, loadBalances]);

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

  useEffect(() => { updatePreview(amount, mode); }, [amount, mode, updatePreview]);

  // ── sign via Freighter ───────────────────────────────────────────────────
  const sign = async (xdr: string): Promise<string> => {
    const { signedTxXdr } = await stellarWalletService.signTransaction(xdr, {
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
    });
    if (!signedTxXdr) throw new Error('Signing failed or was rejected by wallet');
    return signedTxXdr;
  };

  // ── quick amount buttons ──────────────────────────────────────────────────
  const setQuickBuy = (val: number) => setAmount(String(val));
  const setQuickSell = (pct: number) => {
    setAmount((Number(tokenBalance) / 1e7 * pct).toFixed(2));
  };

  const handleMaxClick = async () => {
    if (mode === 'sell') {
      setAmount((Number(tokenBalance) / 1e7).toFixed(2));
      return;
    }
    setIsCalculatingMax(true);
    try {
      const availableXlm = Math.max(0, Number(xlmBalance) / 1e7 - GAS_RESERVE_XLM);
      if (availableXlm <= 0) { showToast('error', 'insufficient XLM balance'); return; }
      const basePrice = parseFloat(currentPrice || '0');
      if (basePrice <= 0) return;

      let low = 0.1, high = Math.min((availableXlm / (1 + TOTAL_FEE_RATE)) / basePrice * 1.2, 900_000_000), best = 0;
      for (let i = 0; i < 11 && high - low > 0.01; i++) {
        const mid = (low + high) / 2;
        try {
          const cost = BigInt(await getBuyPrice(tokenAddress, String(BigInt(Math.floor(mid * 1e7)))));
          if ((Number(cost) / 1e7) * (1 + TOTAL_FEE_RATE) <= availableXlm) { best = mid; low = mid; }
          else high = mid;
        } catch { high = mid; }
      }
      if (best <= 0) { showToast('error', 'insufficient balance for max buy'); return; }
      setAmount((Math.floor(best * 100) / 100).toString());
    } finally { setIsCalculatingMax(false); }
  };

  // ── trade handler ─────────────────────────────────────────────────────────
  const handleTrade = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    if (!walletAddress) {
      showToast('error', 'please connect your wallet first');
      return;
    }
    setLoading(true);
    try {
      const rawAmount = BigInt(Math.floor(num * 1e7));
      let txHash: string;

      if (mode === 'buy') {
        const maxXlmIn = preview ? String(preview.total * 105n / 100n) : String(rawAmount * 10000n);
        txHash = await buyToken({
          buyerPublicKey: walletAddress,
          tokenAddress,
          tokenAmount: String(rawAmount),
          maxXlmIn,
          signTransaction: sign,
        });
        showToast('success', 'buy successful!');
      } else {
        const minXlmOut = preview ? String(preview.total * 95n / 100n) : '0';
        txHash = await sellToken({
          sellerPublicKey: walletAddress,
          tokenAddress,
          tokenAmount: String(rawAmount),
          minXlmOut,
          signTransaction: sign,
        });
        showToast('success', 'sell successful!');
      }

      // Save trade to database — run in background, don't block UI
      const saveTrade = async () => {
        try {
          console.log('[trade] Saving trade to DB...');
          
          const tokenRes = await fetch(`/api/tokens/${tokenAddress}`);
          const tokenData = await tokenRes.json();
          
          if (!tokenData.success || !tokenData.data) {
            console.error('[trade] Token not found in DB:', tokenData);
            return;
          }

          // CRITICAL: Get exact post-trade state from chain (with retry)
          // sold_supply and price MUST come from chain — not from preview
          let currentPriceXlm = 0;
          let soldSupplyTokens = 0;
          let gotChainState = false;

          for (let attempt = 1; attempt <= 5; attempt++) {
            try {
              const state = await getTokenState(tokenAddress);
              const basePrice = BigInt(String(state.base_price).replace(/n$/, ''));
              const slope = BigInt(String(state.slope).replace(/n$/, ''));
              const soldSupply = BigInt(String(state.sold_supply).replace(/n$/, ''));
              const soldTokens = soldSupply / STROOPS;
              currentPriceXlm = Number(basePrice + slope * soldTokens) / 1e7;
              soldSupplyTokens = Number(soldSupply) / 1e7;
              gotChainState = true;
              console.log('[trade] Chain state OK: price=', currentPriceXlm, 'sold_supply=', soldSupplyTokens);
              break;
            } catch (e) {
              console.warn(`[trade] getTokenState attempt ${attempt}/5 failed:`, e);
              if (attempt < 5) await new Promise(r => setTimeout(r, 2000));
            }
          }

          // total_price = XLM value of this trade (from preview)
          const totalPrice = preview ? Number(preview.cost) / 1e7 : 0;

          if (!gotChainState) {
            // Fallback: estimate price from preview if chain unavailable
            // For buy: cost/qty = average buy price (slightly below post-trade price)
            // For sell: proceeds/qty = average sell price (slightly above post-trade price)
            currentPriceXlm = totalPrice > 0 && num > 0 ? totalPrice / num : 0;
            console.warn('[trade] Using fallback price from preview:', currentPriceXlm);
          }

          console.log('[trade] Saving: mode=', mode, 'price=', currentPriceXlm, 'sold_supply=', soldSupplyTokens, 'total=', totalPrice);

          const saveRes = await fetch('/api/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token_id: tokenData.data.id,
              buyer_address: mode === 'buy' ? walletAddress : null,
              seller_address: mode === 'sell' ? walletAddress : null,
              quantity: num,
              sold_supply: soldSupplyTokens > 0 ? soldSupplyTokens : undefined,
              price_per_token: currentPriceXlm,
              total_price: totalPrice,
              transaction_hash: txHash,
              status: 'completed',
            }),
          });

          const saveData = await saveRes.json();
          if (!saveRes.ok || !saveData.success) {
            console.error('[trade] Purchase save failed:', saveData);
          } else {
            console.log('[trade] Purchase saved OK, id=', saveData.data?.id, 'price=', currentPriceXlm);
            refreshPrice();
            onTradeSuccess();

            // After buy — prompt Freighter to add token to wallet
            if (mode === 'buy' && freighterAddToken) {
              try {
                await freighterAddToken({
                  contractId: tokenAddress,
                  networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
                });
              } catch {
                // Non-critical
              }
            }
          }
        } catch (err) {
          console.error('[trade] Failed to record purchase:', err);
        }
      };

      // Start save in background
      saveTrade();

      setAmount('');
      setPreview(null);
      // Immediate UI feedback — price and balances will update after saveTrade completes
      loadBalances(walletAddress);
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
          <button key={t} onClick={() => setMode(t)}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all relative
              ${mode === t
                ? t === 'buy' ? 'text-pump-green bg-pump-green/5' : 'text-pump-red bg-pump-red/5'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-900/50'}`}
          >
            {t}
            {mode === t && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${t === 'buy' ? 'bg-pump-green' : 'bg-pump-red'}`} />}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Settings className="w-3 h-3" /> 1% slippage
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Wallet className="w-3.5 h-3.5" />
            {isWalletReady
              ? mode === 'buy'
                ? `${(Number(xlmBalance) / 1e7).toFixed(4)} XLM`
                : `${tokenBalanceNum.toFixed(2)} ${ticker.toUpperCase()}`
              : 'not connected'}
          </div>
        </div>

        {/* amount input */}
        <div className="bg-gray-100 dark:bg-gray-900/80 rounded-lg p-4 border border-gray-300 dark:border-gray-800 focus-within:border-pump-green/50 transition-colors">
          <div className="flex justify-between text-xs font-bold text-gray-600 dark:text-gray-500 mb-2">
            <span className="uppercase">amount ({ticker.toUpperCase()})</span>
            <button className="uppercase hover:text-gray-800 dark:hover:text-white transition-colors"
              onClick={handleMaxClick} disabled={isCalculatingMax}>
              {isCalculatingMax ? 'max...' : 'max'}
            </button>
          </div>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.0"
            className="bg-transparent text-2xl font-mono font-bold w-full outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700"
          />
        </div>

        {/* quick buttons */}
        <div className="flex gap-2">
          <button onClick={() => setAmount('')}
            className="bg-gray-200 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded text-xs font-bold transition-colors">
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
        <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-900/50 rounded-lg text-xs border border-gray-300 dark:border-gray-800/50">
          {previewLoading ? (
            <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-3 h-3 animate-spin" /> calculating...</div>
          ) : (
            <>
              <div className="flex justify-between text-gray-500">
                <span>Base Value</span>
                <span className="font-mono text-gray-400">{preview ? stroopsToXlm(preview.cost) : '0'} XLM</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Fee (0.5%)</span>
                <span className="font-mono text-gray-400">{preview ? stroopsToXlm(preview.fee) : '0'} XLM</span>
              </div>
              <div className={`flex justify-between font-bold text-sm pt-2 border-t ${mode === 'buy' ? 'border-pump-green/20' : 'border-pump-red/20'}`}>
                <span className="text-gray-900 dark:text-white">{mode === 'buy' ? 'Total Cost:' : 'You Receive:'}</span>
                <span className={`font-mono ${mode === 'buy' ? 'text-pump-green' : 'text-pump-red'}`}>
                  {preview ? stroopsToXlm(preview.total) : '0'} XLM
                </span>
              </div>
            </>
          )}
        </div>

        {/* CTA — show trade button if wallet connected, else prompt to connect */}
        {isWalletReady ? (
          <button onClick={handleTrade}
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
          <div className="w-full py-4 rounded-lg text-sm font-bold uppercase tracking-widest bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-center cursor-not-allowed select-none">
            connect wallet to trade
          </div>
        )}
      </div>
    </div>
  );
}
