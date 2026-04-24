import React from 'react';
import { Coin } from '../types';
import { Crown } from 'lucide-react';
import { formatMarketCap, formatVolume } from '../utils/formatters';

interface KingOfTheHillProps {
  coin: Coin | null;
  onClick: (coin: Coin) => void;
}

const KingOfTheHill: React.FC<KingOfTheHillProps> = ({ coin, onClick }) => {
  if (!coin) {
    return (
      <div className="mb-8 w-full animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-md animate-hero-glow" />
            <Crown className="relative text-yellow-500 dark:text-yellow-400 w-6 h-6 animate-bounce" />
          </div>
          <h2 className="text-xl font-bold text-yellow-600 dark:text-yellow-400">King of the Hill</h2>
        </div>
        <div className="relative overflow-hidden rounded-2xl border-2 border-yellow-400 dark:border-yellow-400/30 bg-gradient-to-r from-yellow-50 dark:from-yellow-900/20 to-white dark:to-pump-card p-6 h-48 flex items-center justify-center animate-hero-glow">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_26%)]" />
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-0 animate-hero-shimmer" />
          <p className="text-gray-600 dark:text-gray-400">Loading top coin...</p>
        </div>
      </div>
    );
  }

  const amountInCurve = (coin.maxReserve ?? ((coin.bondingCurveProgress / 100) * 10000)).toFixed(4);

  return (
    <div className="mb-8 w-full animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-md animate-hero-glow" />
          <Crown className="relative text-yellow-500 dark:text-yellow-400 w-6 h-6 animate-bounce" />
        </div>
        <h2 className="text-xl font-bold text-yellow-600 dark:text-yellow-400">King of the Hill</h2>
      </div>
      
      <div 
        onClick={() => onClick(coin)}
        className="group relative overflow-hidden rounded-2xl border-2 border-yellow-400 dark:border-yellow-400/30 bg-gradient-to-r from-yellow-50 dark:from-yellow-900/20 to-white dark:to-pump-card p-6 cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:border-yellow-500 dark:hover:border-yellow-400 hover:shadow-[0_24px_70px_-28px_rgba(250,204,21,0.5)] animate-hero-glow animate-pulse-border"
      >
        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.12),transparent_28%)]" />
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 animate-hero-shimmer" />
        <div className="relative flex flex-col md:flex-row gap-6 items-center">
            <img 
                src={coin.imageUrl} 
                alt={coin.name} 
                    className="w-32 h-32 md:w-40 md:h-40 rounded-lg object-cover shadow-2xl shadow-yellow-400/30 border-2 border-yellow-400 dark:border-yellow-400/50 transition-transform duration-500 group-hover:scale-[1.03] animate-float-slow"
            />
            <div className="flex-1 text-center md:text-left">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-1">{coin.name}</h3>
                <p className="text-xl font-mono text-yellow-700 dark:text-yellow-200/80 mb-3">{coin.ticker}</p>
                <div className="w-full flex justify-between mb-4">
                    <div className="flex flex-col items-center">
                        <span className="text-[11px] text-yellow-600/70 dark:text-yellow-500/60 uppercase tracking-wider font-semibold">MC</span>
                        <span className="text-yellow-700 dark:text-yellow-200/90 font-black text-base">{formatMarketCap(coin.marketCap)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[11px] text-yellow-600/70 dark:text-yellow-500/60 uppercase tracking-wider font-semibold">24H VOL</span>
                        <span className="text-yellow-700 dark:text-yellow-200/90 font-black text-base">{formatVolume(coin.volume24h ?? 0)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[11px] text-yellow-600/70 dark:text-yellow-500/60 uppercase tracking-wider font-semibold">Price</span>
                        <span className="text-yellow-700 dark:text-yellow-200/90 font-black text-base">
                            {coin.priceHistory?.[coin.priceHistory.length - 1]?.price?.toFixed(4) ?? '—'}
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[11px] text-yellow-600/70 dark:text-yellow-500/60 uppercase tracking-wider font-semibold">Holders</span>
                        <span className="text-yellow-700 dark:text-yellow-200/90 font-black text-base">{coin.traderCount ?? 0}</span>
                    </div>
                </div>
                <p className="text-gray-700 dark:text-gray-300 max-w-2xl">{coin.description}</p>
                
                <div className="mt-4 w-full">
                   <div className="flex justify-between text-sm text-yellow-600 dark:text-yellow-400 mb-1 font-bold">
                        <span className="uppercase">BONDING CURVE PROGRESS</span>
                        <span>{coin.bondingCurveProgress.toFixed(4)}%</span>
                   </div>
                   <div className="relative h-4 bg-gray-300 dark:bg-gray-800 rounded-full overflow-hidden border border-yellow-400 dark:border-yellow-400/30 mb-2">
                        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.35)_45%,transparent_60%)] bg-[length:200%_100%] opacity-80 animate-hero-shimmer" />
                        <div 
                            className="relative h-full bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 shadow-[0_0_14px_rgba(250,204,21,0.55)] transition-all duration-700 ease-out" 
                            style={{ width: `${coin.bondingCurveProgress}%` }}
                        />
                   </div>
                   <p className="text-xs text-yellow-700 dark:text-yellow-500/70 font-medium">
                        There are {amountInCurve} TEST in the BONDING CURVE
                   </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default KingOfTheHill;
