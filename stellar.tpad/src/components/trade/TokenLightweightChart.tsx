'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { OHLCVRecord } from '@/types';

interface TokenLightweightChartProps {
  tokenAddress: string;
  refreshKey: number;
}

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Interval = typeof INTERVALS[number];

export default function TokenLightweightChart({ tokenAddress, refreshKey }: TokenLightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef    = useRef<any>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const [interval, setIntervalState] = useState<Interval>('15m');

  // init chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(139,92,246,0.08)' },
        horzLines: { color: 'rgba(139,92,246,0.08)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1e293b' },
      timeScale: { borderColor: '#1e293b', timeVisible: true },
      width: containerRef.current.clientWidth,
      height: 380,
    });

    // lightweight-charts v5: addSeries with CandlestickSeries type
    const series = (chart as any).addCandlestickSeries
      ? (chart as any).addCandlestickSeries({
          upColor:   '#26a69a',
          downColor: '#ef5350',
          borderUpColor:   '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor:   '#26a69a',
          wickDownColor: '#ef5350',
        })
      : (chart as any).addSeries('Candlestick', {
          upColor:   '#26a69a',
          downColor: '#ef5350',
          borderUpColor:   '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor:   '#26a69a',
          wickDownColor: '#ef5350',
        });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  // fetch + auto-refresh
  useEffect(() => {
    if (!tokenAddress || !seriesRef.current) return;

    const load = async () => {
      try {
        const res  = await fetch(`/api/ohlcv?tokenId=${tokenAddress}&interval=${interval}`);
        const json = await res.json();
        if (!json.success) return;

        const data = (json.data as OHLCVRecord[]).map(c => ({
          time:  c.time as any,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }));

        seriesRef.current.setData(data);
        if (data.length > 0) chartRef.current?.timeScale().fitContent();
      } catch { /* silent */ }
    };

    load();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(load, 10_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tokenAddress, interval, refreshKey]);

  return (
    <div className="bg-pump-card rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-1 px-4 pt-3 pb-2">
        {INTERVALS.map(tf => (
          <button
            key={tf}
            onClick={() => setIntervalState(tf)}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
              interval === tf ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
