import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

// Card Skeleton - khớp chính xác với CoinCard
export const CardSkeleton: React.FC = () => (
  <div className="flex cursor-pointer transition-colors duration-200 group">
    {/* Image skeleton - 124x124px */}
    <div className="w-[124px] h-[124px] rounded-[10px] shrink-0 overflow-hidden">
      <Skeleton width="124px" height="124px" className="rounded-[10px]" />
    </div>

    {/* Content skeleton */}
    <div className="flex flex-col flex-1 pl-3 pt-0.5 min-w-0">
      {/* Name */}
      <Skeleton width="70%" height="18px" className="mb-1" />
      
      {/* Ticker */}
      <Skeleton width="40%" height="16px" className="mb-2" />
      
      {/* Creator + time */}
      <div className="flex items-center space-x-2 mb-2">
        <Skeleton width="16px" height="16px" variant="circular" />
        <Skeleton width="60px" height="14px" />
        <Skeleton width="50px" height="14px" />
      </div>
      
      {/* Price + progress bar + change */}
      <div className="flex items-center space-x-2 mb-1">
        <Skeleton width="80px" height="16px" />
        <Skeleton width="36px" height="6px" className="rounded-sm" />
        <Skeleton width="50px" height="16px" />
      </div>
      
      {/* Volume */}
      <Skeleton width="90px" height="14px" className="mb-1" />
      
      {/* Description */}
      <Skeleton width="100%" height="14px" />
    </div>
  </div>
);

// List Skeleton - dùng cho danh sách tokens
export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

// Chart Skeleton - dùng cho TradingView chart
export const ChartSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4">
    <div className="flex items-center justify-between mb-4">
      <Skeleton width="150px" height="24px" />
      <div className="flex gap-2">
        {['1m', '5m', '15m', '1h', '4h', '1d'].map((interval) => (
          <Skeleton key={interval} width="40px" height="32px" />
        ))}
      </div>
    </div>
    <Skeleton width="100%" height="400px" />
  </div>
);

// Table Skeleton - dùng cho transaction table
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg overflow-hidden">
    <div className="p-3 bg-gray-100 dark:bg-gray-900/50">
      <div className="flex gap-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} width="80px" height="16px" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-gray-300/50 dark:divide-gray-800/50">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 flex gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((j) => (
            <Skeleton key={j} width="80px" height="16px" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Comment Skeleton - dùng cho comment section
export const CommentSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex gap-3">
        <Skeleton variant="circular" width="40px" height="40px" />
        <div className="flex-1 space-y-2">
          <Skeleton width="120px" height="16px" />
          <Skeleton width="100%" height="40px" />
        </div>
      </div>
    ))}
  </div>
);

// Token Info Bar Skeleton - khớp chính xác với TokenInfoBar
export const TokenInfoBarSkeleton: React.FC = () => (
  <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4 mb-4 gap-4 md:gap-8">
    {/* Left: Token Info */}
    <div className="flex items-center gap-4 flex-1">
      <div className="flex flex-col gap-2 w-full">
        {/* Token name */}
        <Skeleton width="200px" height="28px" />
        {/* Symbol */}
        <Skeleton width="80px" height="24px" />
        {/* Creator + contract + date */}
        <div className="flex items-center gap-3 mt-1">
          <Skeleton width="120px" height="24px" className="rounded" />
          <Skeleton width="120px" height="24px" className="rounded" />
          <Skeleton width="150px" height="16px" />
        </div>
      </div>
    </div>

    {/* Right: Metrics - 6 columns */}
    <div className="flex gap-4 md:gap-6 flex-wrap md:flex-nowrap">
      {['Market Cap', 'Vol 24h', 'Price', '5m', '1h', '6h'].map((label, i) => (
        <div key={i} className="flex flex-col justify-center min-w-fit gap-2">
          <Skeleton width="60px" height="10px" />
          <Skeleton width="80px" height="24px" />
        </div>
      ))}
    </div>
  </div>
);

// Bonding Curve Skeleton - khớp với BondingCurve component
export const BondingCurveSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-5">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <Skeleton width="200px" height="16px" />
      <div className="flex items-center gap-3">
        <Skeleton width="60px" height="20px" />
        <Skeleton width="8px" height="8px" variant="circular" />
        <Skeleton width="120px" height="16px" />
      </div>
    </div>
    
    {/* Progress bar */}
    <Skeleton width="100%" height="24px" className="mb-3" />
    
    {/* Stats row */}
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="space-y-2">
        <Skeleton width="80px" height="12px" />
        <Skeleton width="120px" height="20px" />
      </div>
      <div className="space-y-2">
        <Skeleton width="80px" height="12px" className="ml-auto" />
        <Skeleton width="120px" height="20px" className="ml-auto" />
      </div>
    </div>
    
    {/* Warning box */}
    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-400 dark:border-yellow-700/30 p-3 rounded">
      <div className="space-y-2">
        <Skeleton width="100%" height="14px" />
        <Skeleton width="90%" height="14px" />
      </div>
    </div>
  </div>
);

// Trade Form Skeleton - khớp với BondingCurveTrader
export const TradeFormSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4">
    {/* Buy/Sell tabs */}
    <div className="flex gap-2 mb-4">
      <Skeleton width="50%" height="40px" />
      <Skeleton width="50%" height="40px" />
    </div>
    
    {/* Input fields */}
    <div className="space-y-4">
      <div>
        <Skeleton width="80px" height="16px" className="mb-2" />
        <Skeleton width="100%" height="48px" />
      </div>
      <div>
        <Skeleton width="100px" height="16px" className="mb-2" />
        <Skeleton width="100%" height="48px" />
      </div>
      
      {/* Button */}
      <Skeleton width="100%" height="48px" />
      
      {/* Stats */}
      <div className="space-y-2">
        <Skeleton width="100%" height="14px" />
        <Skeleton width="100%" height="14px" />
      </div>
    </div>
  </div>
);

// Full Trade Page Skeleton
export const TradePageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-white">
    <div className="container mx-auto px-4 py-4 max-w-[1600px]">
      {/* Back button */}
      <Skeleton width="150px" height="20px" className="mb-4" />
      
      {/* Token Info Bar */}
      <TokenInfoBarSkeleton />
      
      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <ChartSkeleton />
          <BondingCurveSkeleton />
          <div className="hidden lg:block">
            <TableSkeleton />
          </div>
        </div>
        
        {/* Right column */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <TradeFormSkeleton />
          
          {/* Comments */}
          <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4">
            <Skeleton width="100px" height="20px" className="mb-4" />
            <CommentSkeleton count={3} />
          </div>
          
          {/* Top Holders */}
          <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4">
            <Skeleton width="120px" height="20px" className="mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton width="150px" height="16px" />
                  <Skeleton width="60px" height="16px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Home Page Skeleton
export const HomePageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-white dark:bg-pump-bg">
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Skeleton width="200px" height="32px" className="mb-2" />
        <Skeleton width="300px" height="20px" />
      </div>
      <ListSkeleton count={12} />
    </div>
  </div>
);
