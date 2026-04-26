'use client';

import { ArrowDownRight, ArrowUpRight, ExternalLink } from 'lucide-react';

interface TokenInfoBarProps {
  token: {
    name: string;
    symbol: string;
    description?: string;
    image_url?: string;
    owner?: string;
    created_at?: string;
    marketcap?: number;
    volume_24h?: number;
    sold_supply?: string;
    contract_address?: string;
  };
  currentPrice?: number;
  metrics?: {
    price_change_5m?: number | null;
    price_change_1h?: number | null;
    price_change_6h?: number | null;
    volume_24h?: number;
  } | null;
}

export default function TokenInfoBar({ token, currentPrice, metrics }: TokenInfoBarProps) {
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

  const getChangeColor = (change: number | null | undefined) => {
    if (change === null || change === undefined) return 'text-gray-400';
    if (change > 0) return 'text-pump-green';
    if (change < 0) return 'text-pump-red';
    return 'text-gray-400';
  };

  const getChangeIcon = (change: number | null | undefined) => {
    if (change === null || change === undefined) return null;
    if (change > 0) return <ArrowUpRight className="w-4 h-4 inline" />;
    if (change < 0) return <ArrowDownRight className="w-4 h-4 inline" />;
    return null;
  };

  const openExplorer = (kind: 'account' | 'contract', value?: string) => {
    if (!value) return;
    const base = 'https://stellar.expert/explorer/testnet';
    const suffix = kind === 'account' ? `account/${value}` : `contract/${value}`;
    window.open(`${base}/${suffix}`, '_blank', 'noopener,noreferrer');
  };

  const soldSupply = Number(token.sold_supply || '0') / 1e7;
  const effectivePrice = currentPrice ?? 0;
  const marketCap = token.marketcap ?? soldSupply * effectivePrice;
  const volume = metrics?.volume_24h ?? token.volume_24h ?? 0;
  const change5m = metrics?.price_change_5m;
  const change1h = metrics?.price_change_1h;
  const change6h = metrics?.price_change_6h;
  const creator = token.owner || '';
  const contractAddress = token.contract_address || '';

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4 mb-4 gap-4 md:gap-8">
      <div className="flex items-center gap-4 flex-1">
        {token.image_url && (
          <img
            src={token.image_url}
            alt={token.name}
            className="w-14 h-14 rounded-full object-cover"
          />
        )}
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{token.name}</h1>
          <div className="text-lg text-gray-600 dark:text-gray-500 font-mono">{token.symbol}</div>
          {token.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{token.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs mt-2 flex-wrap">
            {creator && (
              <button
                onClick={() => openExplorer('account', creator)}
                className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                {creator.slice(0, 6)}...{creator.slice(-4)} <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {contractAddress && (
              <button
                onClick={() => openExplorer('contract', contractAddress)}
                className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)} <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {token.created_at && (
              <span className="text-gray-600 dark:text-gray-500">
                Created {new Date(token.created_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 md:gap-6 flex-wrap md:flex-nowrap md:justify-end overflow-x-auto">
        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">Market Cap</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">{formatMarketCap(marketCap)}</div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">Vol 24h</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">{formatVolume(volume)}</div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">Price</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">{formatPrice(effectivePrice)}</div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">5m</div>
          <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getChangeColor(change5m)}`}>
            {getChangeIcon(change5m)}
            {change5m === null || change5m === undefined ? '--' : `${change5m.toFixed(2)}%`}
          </div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">1h</div>
          <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getChangeColor(change1h)}`}>
            {getChangeIcon(change1h)}
            {change1h === null || change1h === undefined ? '--' : `${change1h.toFixed(2)}%`}
          </div>
        </div>

        <div className="flex flex-col justify-center min-w-fit">
          <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">6h</div>
          <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getChangeColor(change6h)}`}>
            {getChangeIcon(change6h)}
            {change6h === null || change6h === undefined ? '--' : `${change6h.toFixed(2)}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
