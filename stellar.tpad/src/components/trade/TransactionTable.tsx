'use client';

import { useEffect, useState } from 'react';
import type { TradeRecord } from '@/types';
import { formatUtc7DateTime } from '@/lib/time';
import { STELLAR_EXPLORER_URL } from '@/config/network';

interface TransactionTableProps {
  tokenAddress: string;
  refreshKey: number;
}

function truncate(addr: string) {
  if (!addr) return '-';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTime(iso: string) {
  return formatUtc7DateTime(iso);
}

type FeedState = 'loading' | 'ready' | 'error';

export default function TransactionTable({ tokenAddress, refreshKey }: TransactionTableProps) {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [state, setState] = useState<FeedState>('loading');

  useEffect(() => {
    if (!tokenAddress) return;

    // Abort in-flight requests so a slow response for an older token cannot
    // overwrite the rows of the token now on screen.
    const controller = new AbortController();
    setState('loading');

    fetch(`/api/trades?tokenId=${encodeURIComponent(tokenAddress)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(j => {
        if (!j.success) throw new Error(j.error || 'Failed to load trades');
        setTrades(j.data);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('error');
      });

    return () => controller.abort();
  }, [tokenAddress, refreshKey]);

  return (
    <div className="w-full">
      <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Recent Trades</h3>
      <div className="bg-white dark:bg-pump-card rounded-lg border border-gray-300 dark:border-gray-800 overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm text-left table-fixed">
            <thead className="text-xs text-gray-600 dark:text-gray-500 uppercase bg-gray-100 dark:bg-gray-900/50 sticky top-0 z-10">
              <tr>
                <th className="w-[20%] px-3 py-3 text-left">Account</th>
                <th className="w-[10%] px-3 py-3 text-left">Type</th>
                <th className="w-[15%] px-3 py-3 text-left">Price</th>
                <th className="w-[15%] px-3 py-3 text-left">Amount</th>
                <th className="w-[14%] px-3 py-3 text-left">Fees</th>
                <th className="w-[16%] px-3 py-3 text-left">Date</th>
                <th className="w-[10%] px-3 py-3 text-left">Tx Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300/50 dark:divide-gray-800/50">
              {state === 'loading' ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-800" />
                    </td>
                  </tr>
                ))
              ) : state === 'error' ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-pump-red text-sm">
                    could not load trades — try refreshing
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-sm">
                    no transactions yet
                  </td>
                </tr>
              ) : (
                trades.map((trade, idx) => (
                  <tr
                    key={trade.id}
                    className={`hover:bg-gray-200/30 dark:hover:bg-gray-800/30 transition-colors duration-200 ${idx === 0 ? 'animate-slide-in-fade bg-pump-accent/5' : ''}`}
                  >
                    <td className="w-[20%] px-3 py-3 text-gray-700 dark:text-gray-400 font-mono text-xs truncate">
                      {truncate(trade.user)}
                    </td>
                    <td className="w-[10%] px-3 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold min-w-[45px] text-center ${trade.type === 'buy'
                          ? 'bg-pump-green/10 text-pump-green'
                          : 'bg-pump-red/10 text-pump-red'}`}
                      >
                        {trade.type === 'buy' ? 'BUY' : 'SELL'}
                      </span>
                    </td>
                    <td className="w-[15%] px-3 py-3 text-gray-700 dark:text-gray-400 font-mono text-xs tabular-nums">
                      {trade.price.toFixed(8)} XLM
                    </td>
                    <td className="w-[15%] px-3 py-3 text-gray-700 dark:text-gray-400 font-mono text-xs tabular-nums">
                      {Number(trade.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td className="w-[14%] px-3 py-3 text-xs font-mono text-gray-700 dark:text-gray-400">
                      {(Number(trade.fee) / 1e7).toFixed(6)} XLM
                    </td>
                    <td className="w-[16%] px-3 py-3 text-gray-700 dark:text-gray-500 text-xs font-mono">
                      {formatTime(trade.timestamp)}
                    </td>
                    <td className="w-[10%] px-3 py-3 text-gray-700 dark:text-gray-400 text-xs font-mono">
                      <a
                        href={`${STELLAR_EXPLORER_URL}/tx/${trade.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-gray-900 dark:hover:text-white transition-colors"
                        title="View transaction on Stellar Expert"
                      >
                        {truncate(trade.txHash)}
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
