'use client';

interface TokenMetricsProps {
  metrics?: {
    price_change_5m?: number;
    price_change_1h?: number;
    price_change_4h?: number;
    price_change_6h?: number;
    price_change_24h?: number;
    volume_24h?: number;
    trader_count?: number;
    holder_count?: number;
  } | null;
}

export default function TokenMetrics({ metrics }: TokenMetricsProps) {
  if (!metrics) return null;

  const formatChange = (value?: number) => {
    if (value === undefined || value === null) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getChangeColor = (value?: number) => {
    if (value === undefined || value === null) return 'text-gray-400';
    return value >= 0 ? 'text-pump-green' : 'text-pump-red';
  };

  return (
    <div className="bg-pump-card border border-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
        Price Changes
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <div className="text-gray-500 text-xs mb-1">5M</div>
          <div className={`font-bold ${getChangeColor(metrics.price_change_5m)}`}>
            {formatChange(metrics.price_change_5m)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">1H</div>
          <div className={`font-bold ${getChangeColor(metrics.price_change_1h)}`}>
            {formatChange(metrics.price_change_1h)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">4H</div>
          <div className={`font-bold ${getChangeColor(metrics.price_change_4h)}`}>
            {formatChange(metrics.price_change_4h)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">6H</div>
          <div className={`font-bold ${getChangeColor(metrics.price_change_6h)}`}>
            {formatChange(metrics.price_change_6h)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">24H</div>
          <div className={`font-bold ${getChangeColor(metrics.price_change_24h)}`}>
            {formatChange(metrics.price_change_24h)}
          </div>
        </div>
      </div>
      
      {(metrics.trader_count !== undefined || metrics.holder_count !== undefined) && (
        <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4">
          {metrics.trader_count !== undefined && (
            <div>
              <div className="text-gray-500 text-xs mb-1">Traders</div>
              <div className="text-white font-bold">{metrics.trader_count}</div>
            </div>
          )}
          {metrics.holder_count !== undefined && (
            <div>
              <div className="text-gray-500 text-xs mb-1">Holders</div>
              <div className="text-white font-bold">{metrics.holder_count}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
