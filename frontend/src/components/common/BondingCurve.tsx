import React from 'react';

interface BondingCurveProps {
  progress: number;
  showLabel?: boolean;
}

const BondingCurve: React.FC<BondingCurveProps> = ({ progress, showLabel = false }) => {
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1 text-xs font-bold text-gray-600 dark:text-gray-500 uppercase tracking-widest">
          <span>BONDING CURVE</span>
          <span className="text-pump-green">{progress}%</span>
        </div>
      )}
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-900 rounded-full overflow-hidden border border-gray-300 dark:border-gray-800 shadow-inner">
        <div 
          className="h-full bg-pump-green shadow-[0_0_10px_rgba(74,222,128,0.5)] transition-all duration-500 ease-out relative" 
          style={{ width: `${progress}%` }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default BondingCurve;
