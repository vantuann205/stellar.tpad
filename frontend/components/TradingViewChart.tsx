'use client';

import { useEffect, useRef, memo } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewChartProps {
  symbol?: string;
  width?: string | number;
  height?: string | number;
  interval?: string;
  timezone?: string;
  theme?: 'light' | 'dark';
  style?: string;
  locale?: string;
  toolbar_bg?: string;
  enable_publishing?: boolean;
  hide_top_toolbar?: boolean;
  hide_legend?: boolean;
  save_image?: boolean;
  container_id?: string;
}

const TradingViewChart = memo(({
  symbol = 'BINANCE:BTCUSDT',
  width = '100%',
  height = 610,
  interval = '1D',
  timezone = 'Etc/UTC',
  theme = 'dark',
  style = '1',
  locale = 'en',
  toolbar_bg = '#f1f3f6',
  enable_publishing = false,
  hide_top_toolbar = false,
  hide_legend = false,
  save_image = false,
  container_id = 'tradingview-widget'
}: TradingViewChartProps) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Remove existing widget if any
    if (container.current) {
      container.current.innerHTML = '';
    }

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = `
      {
        "autosize": false,
        "symbol": "${symbol}",
        "interval": "${interval}",
        "timezone": "${timezone}",
        "theme": "${theme}",
        "style": "${style}",
        "locale": "${locale}",
        "enable_publishing": ${enable_publishing},
        "gridColor": "${theme === 'dark' ? '#2B2B43' : '#e1ecf4'}",
        "hide_top_toolbar": ${hide_top_toolbar},
        "hide_legend": ${hide_legend},
        "save_image": ${save_image},
        "calendar": false,
        "support_host": "https://www.tradingview.com",
        "width": "${width}",
        "height": "${height}"
      }`;

    if (container.current) {
      container.current.appendChild(script);
    }

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol, width, height, interval, timezone, theme, style, locale, enable_publishing, hide_top_toolbar, hide_legend, save_image]);

  return (
    <div className="tradingview-widget-container">
      <div 
        ref={container}
        className="tradingview-widget"
        style={{ width: width, height: height }}
      />
      <div className="tradingview-widget-copyright">
        <a 
          href="https://www.tradingview.com/" 
          rel="noopener nofollow" 
          target="_blank"
          className="text-xs text-blue-500 hover:text-blue-600"
        >
          Track all markets on TradingView.
        </a>
      </div>
    </div>
  );
});

TradingViewChart.displayName = 'TradingViewChart';

export default TradingViewChart;