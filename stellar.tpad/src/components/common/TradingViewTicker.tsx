'use client';

import { useEffect, useRef, memo } from 'react';

interface TradingViewTickerProps {
  symbols?: string[];
  showSymbolLogo?: boolean;
  colorTheme?: 'light' | 'dark';
  isTransparent?: boolean;
  displayMode?: 'adaptive' | 'compact' | 'regular';
  width?: string | number;
  height?: number;
  locale?: string;
}

const TradingViewTicker = memo(({
  symbols = [
    "BINANCE:BTCUSDT|1D",
    "BINANCE:ETHUSDT|1D", 
    "BINANCE:BNBUSDT|1D",
    "BINANCE:ADAUSDT|1D",
    "BINANCE:SOLUSDT|1D"
  ],
  showSymbolLogo = true,
  colorTheme = 'dark',
  isTransparent = false,
  displayMode = 'adaptive',
  width = '100%',
  height = 46,
  locale = 'en'
}: TradingViewTickerProps) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Remove existing widget if any
    if (container.current) {
      container.current.innerHTML = '';
    }

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = `
      {
        "symbols": ${JSON.stringify(symbols.map(symbol => ({
          "proName": symbol,
          "title": symbol.split(':')[1]?.split('|')[0] || symbol
        })))},
        "showSymbolLogo": ${showSymbolLogo},
        "colorTheme": "${colorTheme}",
        "isTransparent": ${isTransparent},
        "displayMode": "${displayMode}",
        "locale": "${locale}",
        "width": "${width}",
        "height": ${height}
      }`;

    if (container.current) {
      container.current.appendChild(script);
    }

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbols, showSymbolLogo, colorTheme, isTransparent, displayMode, width, height, locale]);

  return (
    <div className="tradingview-widget-container">
      <div 
        ref={container}
        className="tradingview-widget"
        style={{ width: width, height: height }}
      />
    </div>
  );
});

TradingViewTicker.displayName = 'TradingViewTicker';

export default TradingViewTicker;