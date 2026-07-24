'use client';

import React from 'react';
import { ExternalLink, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { TokenRecord } from '@/types/token';
import { formatUtc7Date } from '@/lib/time';
import { STELLAR_EXPLORER_URL } from '@/config/network';

interface TokenInfoBarProps {
  token: TokenRecord;
  currentPrice?: number;
  metrics?: any;
}

const TokenInfoBar: React.FC<TokenInfoBarProps> = ({ token, currentPrice, metrics }) => {
  const formatMarketCap = (value: any) => {
    const num = Number(value);
    if (!isFinite(num) || isNaN(num)) return '$0.00';
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatVolume = (value: any) => {
    const num = Number(value);
    if (!isFinite(num) || isNaN(num)) return '0.00';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatPrice = (price: any) => {
    const num = Number(price);
    if (!isFinite(num) || isNaN(num)) return '0.00000000';
    if (num < 0.00001) return num.toFixed(8);
    if (num < 0.01) return num.toFixed(6);
    return num.toFixed(8);
  };

  const getPriceChangeColor = (change: number | null | undefined) => {
    if (change === null || change === undefined) return 'text-gray-400';
    if (change > 0) return 'text-pump-green';
    if (change < 0) return 'text-pump-red';
    return 'text-gray-400';
  };

  const getPriceChangeIcon = (change: number | null | undefined) => {
    if (change === null || change === undefined) return null;
    if (change > 0) return <ArrowUpRight className="w-4 h-4 inline" />;
    if (change < 0) return <ArrowDownRight className="w-4 h-4 inline" />;
    return null;
  };

  const openExplorer = (address: string) => {
    window.open(`${STELLAR_EXPLORER_URL}/${address.startsWith('C') ? 'contract' : 'account'}/${address}`, '_blank');
  };

  const volume = parseFloat(metrics?.volume_24h ?? token.volume_24h ?? 0);
  const metricsPrice = parseFloat(metrics?.price_snapshot_value ?? token.current_price ?? 0);
  const price = currentPrice && currentPrice > 0 ? currentPrice : metricsPrice;
  const marketCap = parseFloat(metrics?.marketcap ?? token.marketcap ?? 0);
  const change5m = parseFloat(metrics?.price_change_5m ?? token.price_change_5m ?? 0);
  const change1h = parseFloat(metrics?.price_change_1h ?? token.price_change_1h ?? 0);
  const change6h = parseFloat(metrics?.price_change_6h ?? token.price_change_6h ?? 0);

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4 mb-4 gap-4 md:gap-8">
      {/* Left: Token Info */}
      <div className="flex items-center gap-4 flex-1">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {token.name}
          </h1>
          <div className="text-lg text-gray-600 dark:text-gray-500 font-mono">
            {token.symbol}
          </div>
          <div className="flex items-center gap-3 text-xs mt-1">
            <button
              onClick={() => openExplorer(token.owner)}
              className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              title="View creator on Stellar Explorer"
            >
              {token.owner.slice(0, 6)}...{token.owner.slice(-4)} <ExternalLink className="w-3 h-3" />
            </button>
            {token.contract_address && (
              <button
                onClick={() => openExplorer(token.contract_address)}
                className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                title="View contract on Stellar Explorer"
              >
                {token.contract_address.slice(0, 6)}...{token.contract_address.slice(-4)} <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <span className="text-gray-600 dark:text-gray-500">
              Created {formatUtc7Date(token.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Metrics */}
      <div className="flex gap-4 md:gap-6 flex-wrap md:flex-nowrap md:justify-end overflow-x-auto">
        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">
            Market Cap
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">
            {formatMarketCap(marketCap)}
          </div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">
            Vol 24h
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">
            {formatVolume(volume)}
          </div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">
            Price
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">
            {formatPrice(price)}
          </div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
            5m
          </div>
          <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getPriceChangeColor(change5m)}`}>
            {getPriceChangeIcon(change5m)}
            {change5m.toFixed(2)}%
          </div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
            1h
          </div>
          <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getPriceChangeColor(change1h)}`}>
            {getPriceChangeIcon(change1h)}
            {change1h.toFixed(2)}%
          </div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
            6h
          </div>
          <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getPriceChangeColor(change6h)}`}>
            {getPriceChangeIcon(change6h)}
            {change6h.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenInfoBar;
