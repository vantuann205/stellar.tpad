import React from 'react';
import { Coin } from '../types';
import { formatMarketCap } from '../utils/formatters';

interface CoinCardProps {
  coin: Coin;
  onClick: (coin: Coin) => void;
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

const CoinCard: React.FC<CoinCardProps> = ({ coin, onClick }) => {
  const priceChange = coin.bondingCurveProgress || 0;
  const progressCls = coin.bondingCurveProgress > 80 ? 'bg-yellow-400' : 'bg-pump-green';
  const isBuy = coin.lastTradeType !== 'sell'; // default xanh nếu chưa có giao dịch

  return (
    <div
      onClick={() => onClick(coin)}
      className="flex cursor-pointer transition-colors duration-200 group"
    >
      <div className="w-[124px] h-[124px] rounded-[10px] shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-800">
        <img
          src={coin.imageUrl}
          alt={coin.name}
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
          <span className="truncate max-w-[80px]">
            {coin.creator.slice(0, 6)}
          </span>
          <span>{getTimeAgo(coin.createdAt)}</span>
        </div>

        <div className="flex items-center space-x-2 text-[12.5px] whitespace-nowrap mb-1">
          <div className="flex items-center text-[13px]">
            <span className="mr-[4px] font-medium text-gray-500 uppercase">MC</span>
            <span className="font-bold text-gray-900 dark:text-white">{formatMarketCap(coin.marketCap)}</span>
          </div>

          <div className="w-9 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-sm overflow-hidden flex-shrink-0">
            <div 
              className={`h-full ${progressCls}`}
              style={{ width: `${coin.bondingCurveProgress}%` }}
            />
          </div>

          <div className={`font-medium ${isBuy ? 'text-pump-green' : 'text-pump-red'}`}>
            {isBuy ? '↑' : '↓'} {priceChange.toFixed(2)}%
          </div>
        </div>

        <div className="text-gray-500 dark:text-gray-400 text-[12px] truncate">
          {coin.description ? coin.description : `https://axiom.trade/@${coin.ticker.toLowerCase()}`}
        </div>
      </div>
    </div>
  );
};

export default CoinCard;
