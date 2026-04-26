'use client';

import { formatDistanceToNow } from 'date-fns';

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
  };
  currentPrice?: number;
}

export default function TokenInfoBar({ token, currentPrice }: TokenInfoBarProps) {
  const formatMarketCap = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatVolume = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toFixed(2);
  };

  return (
    <div className="bg-pump-card border border-gray-800 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-4">
        {token.image_url && (
          <img 
            src={token.image_url} 
            alt={token.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{token.name}</h1>
            <span className="text-gray-400 text-lg">{token.symbol}</span>
          </div>
          {token.description && (
            <p className="text-gray-400 text-sm mb-3">{token.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            {token.owner && (
              <div>
                <span className="text-gray-500">Creator: </span>
                <span className="text-gray-300 font-mono">
                  {token.owner.slice(0, 6)}...{token.owner.slice(-4)}
                </span>
              </div>
            )}
            {token.created_at && (
              <div>
                <span className="text-gray-500">Created: </span>
                <span className="text-gray-300">
                  {formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}
                </span>
              </div>
            )}
            {currentPrice !== undefined && (
              <div>
                <span className="text-gray-500">Price: </span>
                <span className="text-pump-green font-bold">
                  {currentPrice.toFixed(8)} XLM
                </span>
              </div>
            )}
            {token.marketcap !== undefined && (
              <div>
                <span className="text-gray-500">Market Cap: </span>
                <span className="text-pump-green font-bold">
                  {formatMarketCap(token.marketcap)}
                </span>
              </div>
            )}
            {token.volume_24h !== undefined && (
              <div>
                <span className="text-gray-500">24h Volume: </span>
                <span className="text-gray-300">
                  {formatVolume(token.volume_24h)} XLM
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
