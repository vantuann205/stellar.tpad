'use client';

import { useEffect, useState } from 'react';
import type { TradeRecord } from '@/types';

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
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function TransactionTable({ tokenAddress, refreshKey }: TransactionTableProps) {
  const [trades, setTrades] = useState<TradeRecord[]>([]);

  useEffect(() => {
    if (!tokenAddress) return;
    fetch(`/api/trades?tokenId=${tokenAddress}`)
      .then(r => r.json())
      .then(j => { if (j.success) setTrades(j.data); })
      .catch(() => {});
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
              {trades.length === 0 ? (
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
                      {(Number(trade.tokenAmount) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="w-[14%] px-3 py-3 text-xs font-mono text-gray-700 dark:text-gray-400">
                      {(Number(trade.fee) / 1e7).toFixed(6)} XLM
                    </td>
                    <td className="w-[16%] px-3 py-3 text-gray-700 dark:text-gray-500 text-xs font-mono">
                      {formatTime(trade.timestamp)}
                    </td>
                    <td className="w-[10%] px-3 py-3 text-gray-700 dark:text-gray-400 text-xs font-mono">
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${trade.txHash}`}
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
