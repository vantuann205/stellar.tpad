import React from 'react';
import { Coin } from '@/types';
import { formatMarketCap } from '@/lib/helpers';
import type { TokenRecord } from '@/types/token';

interface CoinCardProps {
  coin: Coin;
  onClick: (coin: Coin) => void;
  tokenRecord?: TokenRecord; // optional enriched data from API
}

const getTimeAgo = (timestamp: number) => {
  const diffInMs = Date.now() - timestamp;
  const diffInMins = Math.floor(diffInMs / 60000);
  if (diffInMins < 60) return `${Math.max(1, diffInMins)}m ago`;
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

/** Neutral placeholder for tokens whose image URL is dead or missing. */
const FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="124" height="124">' +
      '<rect width="124" height="124" fill="#1f2937"/>' +
      '<text x="50%" y="54%" font-family="sans-serif" font-size="42" fill="#4b5563" text-anchor="middle">?</text>' +
      '</svg>'
  );

const CoinCard: React.FC<CoinCardProps> = ({ coin, onClick, tokenRecord }) => {
  const priceChange = Number(tokenRecord?.price_change_5m ?? coin.priceChange5m ?? 0);
  const progressPct = coin.bondingCurveProgress ?? 0;
  const progressCls = progressPct > 80 ? 'bg-yellow-400' : 'bg-pump-green';
  const isBuy = priceChange >= 0;

  const currentPrice = tokenRecord?.current_price ?? (coin.priceHistory?.length ? coin.priceHistory[coin.priceHistory.length - 1].price : undefined);
  const volume24h    = tokenRecord?.volume_24h ?? coin.volume24h;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${coin.name} (${coin.ticker})`}
      onClick={() => onClick(coin)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick(coin);
      }}
      className="flex cursor-pointer transition-colors duration-200 group rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-pump-green"
    >
      <div className="w-[124px] h-[124px] rounded-[10px] shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-800">
        <img
          src={coin.imageUrl || FALLBACK_IMAGE}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(event) => {
            const image = event.currentTarget;
            if (image.src === FALLBACK_IMAGE) return;
            image.src = FALLBACK_IMAGE;
          }}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      </div>

      <div className="flex flex-col flex-1 pl-3 pt-0.5 min-w-0">
        <h3 className="font-bold text-gray-900 dark:text-white text-[15px] truncate">
          {coin.name}
        </h3>

        <div className="text-gray-500 dark:text-gray-400 text-[13px] truncate -mt-0.5 mb-[2px]">
          {coin.ticker}
        </div>

        <div className="flex items-center text-gray-500 dark:text-gray-400 text-[12px] truncate space-x-[4px] mb-[3px]">
          <span className="text-[12px]">🐸</span>
          <span className="truncate max-w-[80px]">{(coin.creator ?? '').slice(0, 6) || 'unknown'}</span>
          <span>{getTimeAgo(coin.createdAt)}</span>
        </div>

        <div className="flex items-center space-x-2 text-[12.5px] whitespace-nowrap mb-1">
          <div className="flex items-center text-[13px]">
            <span className="mr-[4px] font-medium text-gray-500 uppercase">MC</span>
            <span className="font-bold text-gray-900 dark:text-white">{formatMarketCap(coin.marketCap)}</span>
          </div>

          <div className="w-9 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-sm overflow-hidden flex-shrink-0">
            <div className={`h-full ${progressCls}`} style={{ width: `${progressPct}%` }} />
          </div>

          <span className="text-[11px] font-mono text-pump-green font-semibold">
            {progressPct.toFixed(2)}%
          </span>

          <div className={`font-medium ${isBuy ? 'text-pump-green' : 'text-pump-red'}`}>
            {isBuy ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
          </div>
        </div>

        {volume24h !== undefined && (
          <div className="text-gray-500 text-[11px] font-mono">
            vol 24h: {Number(volume24h).toFixed(2)} XLM
          </div>
        )}

        <div className="text-gray-500 dark:text-gray-400 text-[12px] truncate">
          {coin.description || `https://axiom.trade/@${coin.ticker.toLowerCase()}`}
        </div>
      </div>
    </div>
  );
};

export default CoinCard;
