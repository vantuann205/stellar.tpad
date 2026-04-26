'use client';

import { useEffect, useState } from 'react';
import type { TradeRecord } from '@/types';

interface TransactionTableProps {
  tokenAddress: string;
  refreshKey: number;
}

function truncate(addr: string) {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

  if (trades.length === 0) {
    return (
      <div className="bg-pump-card border border-gray-800 rounded-lg p-6 text-center text-gray-500 text-sm">
        no transactions yet
      </div>
    );
  }

  return (
    <div className="bg-pump-card border border-gray-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="px-3 py-2 text-left font-medium">type</th>
              <th className="px-3 py-2 text-right font-medium">tokens</th>
              <th className="px-3 py-2 text-right font-medium">xlm</th>
              <th className="px-3 py-2 text-right font-medium">price</th>
              <th className="px-3 py-2 text-right font-medium">user</th>
              <th className="px-3 py-2 text-right font-medium">time</th>
              <th className="px-3 py-2 text-right font-medium">tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                <td className={`px-3 py-2 font-bold uppercase ${t.type === 'buy' ? 'text-pump-green' : 'text-pump-red'}`}>
                  {t.type}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-300">
                  {(Number(t.tokenAmount) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-300">
                  {(Number(t.xlmAmount) / 1e7).toFixed(4)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-400">
                  {t.price.toFixed(8)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">
                  {truncate(t.user)}
                </td>
                <td className="px-3 py-2 text-right text-gray-500">
                  {formatTime(t.timestamp)}
                </td>
                <td className="px-3 py-2 text-right">
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${t.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-gray-300 transition-colors font-mono"
                  >
                    {truncate(t.txHash)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
