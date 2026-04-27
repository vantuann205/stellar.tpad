import React from 'react';
import { Trade } from '@/types';
import { formatUtc7DateTime } from '@/lib/time';

interface TransactionTableProps {
  trades: Trade[];
}

const TransactionTable: React.FC<TransactionTableProps> = ({ trades }) => {
  const OASIS_TX_EXPLORER_URL = 'https://testnet.explorer.sapphire.oasis.io/tx';

  const formatTradeTime = (timestampStr: string) => {
    if (!timestampStr) return '-';
    const formatted = formatUtc7DateTime(timestampStr);
    if (formatted === '--') return timestampStr;
    // Return as YYYY-MM-DD HH:mm:ss
    return formatted.replace(/(\d{2})\/(\d{2})\/(\d{4}),\s*/, '$3-$2-$1 ');
  };

  return (
    <div className="w-full">
      <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Recent Trades</h3>
      <div className="bg-white dark:bg-pump-card rounded-lg border border-gray-300 dark:border-gray-800 overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm text-left table-fixed">
            <thead className="text-xs text-gray-600 dark:text-gray-500 uppercase bg-gray-100 dark:bg-gray-900/50 sticky top-0 z-10">
              <tr>
                <th className="w-[22%] px-3 py-3 text-left">Account</th>
                <th className="w-[10%] px-3 py-3 text-left">Type</th>
                <th className="w-[15%] px-3 py-3 text-left">Price</th>
                <th className="w-[23%] px-3 py-3 text-left">Fees</th>
                <th className="w-[20%] px-3 py-3 text-left">Date (UTC+7)</th>
                <th className="w-[10%] px-3 py-3 text-left">Tx Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300/50 dark:divide-gray-800/50">
              {trades.map((trade, idx) => (
                <tr
                  key={`${trade.timestamp}-${trade.user}-${idx}`}
                  className={`
                        hover:bg-gray-200/30 dark:hover:bg-gray-800/30 transition-colors duration-200
                        ${idx === 0 ? 'animate-slide-in-fade bg-pump-accent/5' : ''}
                      `}
                >
                  <td className="w-[22%] px-3 py-3 text-gray-700 dark:text-gray-400 font-mono text-xs truncate">
                    {trade.user.slice(0, 6)}...{trade.user.slice(-4)}
                  </td>
                  <td className="w-[10%] px-3 py-3">
                    <span className={`
                              inline-block px-2 py-1 rounded text-xs font-bold min-w-[45px] text-center
                              ${trade.type === 'buy'
                        ? 'bg-pump-green/10 text-pump-green'
                        : 'bg-pump-red/10 text-pump-red'
                      }
                            `}>
                      {trade.type === 'buy' ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="w-[15%] px-3 py-3 text-gray-700 dark:text-gray-400 font-mono text-xs text-left tabular-nums">
                    {trade.price.toFixed(6)} TEST
                  </td>
                  <td className="w-[23%] px-3 py-3 text-xs font-mono text-gray-700 dark:text-gray-400">
                    {(trade.totalFee || 0).toFixed(6)} TEST
                  </td>
                  <td className="w-[20%] px-3 py-3 text-gray-700 dark:text-gray-500 text-xs font-mono">
                    {formatTradeTime(trade.timestamp)}
                  </td>
                  <td className="w-[10%] px-3 py-3 text-gray-700 dark:text-gray-400 text-xs font-mono">
                    {trade.txHash ? (
                      <a
                        href={`${OASIS_TX_EXPLORER_URL}/${trade.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-gray-900 dark:hover:text-white transition-colors"
                        title="View transaction on Oasis Explorer"
                      >
                        {trade.txHash.slice(0, 6)}...{trade.txHash.slice(-4)}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionTable;