'use client';

import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    CandlestickData,
    Time,
    ColorType,
    CrosshairMode,
    CandlestickSeries,
    HistogramSeries,
} from 'lightweight-charts';
import { useTheme } from '@/context/ThemeContext';

interface TokenLightweightChartProps {
    tokenId: string | number;
    ticker: string;
    currentPrice?: number;
    createdAt?: number | string;
    refreshKey?: number;
}

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Interval = typeof INTERVALS[number];
type CandleWithVolume = CandlestickData & { volume?: number };

const INTERVAL_SECONDS: Record<Interval, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
};

const TZ_UTC7 = 'Asia/Bangkok';
const timeFormatterUtc7 = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_UTC7,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});
const dateTimeFormatterUtc7 = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_UTC7,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

const pad2 = (n: number) => n.toString().padStart(2, '0');

/**
 * Tính bucket timestamp chuẩn UTC - giống TradingView
 * 1m  → floor to minute
 * 5m  → floor to 5-minute mark (0,5,10,15...)
 * 1h  → floor to hour
 * 1d  → floor to 00:00 UTC
 */
function getBucketTime(unixSec: number, intervalSec: number): number {
    return Math.floor(unixSec / intervalSec) * intervalSec;
}

/**
 * Thời gian còn lại đến khi đóng nến hiện tại
 */
function getRemainingSeconds(nowSec: number, intervalSec: number): number {
    const elapsed = nowSec % intervalSec;
    return elapsed === 0 ? intervalSec : intervalSec - elapsed;
}

function formatCountdown(seconds: number): string {
    const s = Math.max(0, seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
    return `${pad2(m)}:${pad2(sec)}`;
}

function timeToUnixSeconds(time: Time): number {
    if (typeof time === 'number') return time;
    if (typeof time === 'string') return Math.floor(new Date(time).getTime() / 1000);
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
}

function formatTimeUtc7(time: Time, withDate = false): string {
    const d = new Date(timeToUnixSeconds(time) * 1000);
    return withDate ? dateTimeFormatterUtc7.format(d) : timeFormatterUtc7.format(d);
}

export default function TokenLightweightChart({
    tokenId,
    ticker,
    currentPrice: _currentPrice,
    createdAt,
    refreshKey,
}: TokenLightweightChartProps) {
    const [mounted, setMounted] = useState(false);
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('dark');
    
    const themeContext = useTheme();
    const theme = themeContext?.theme || systemTheme;
    
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const [interval, setIntervalState] = useState<Interval>('5m');
    const [candles, setCandles] = useState<CandleWithVolume[]>([]);
    const [loading, setLoading] = useState(true);
    const [priceChange, setPriceChange] = useState(0);
    const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
    const [countdownY, setCountdownY] = useState<number | null>(null);
    const isFetchingRef = useRef(false);
    const fitPendingRef = useRef(true);
    const pendingPostTradeAutoscaleRef = useRef(false);

    // Mount and detect system theme
    useEffect(() => {
        setMounted(true);
        const isDark = document.documentElement.classList.contains('dark') ||
            window.matchMedia('(prefers-color-scheme: dark)').matches;
        setSystemTheme(isDark ? 'dark' : 'light');

        // Watch for theme changes on DOM
        const observer = new MutationObserver(() => {
            const isDarkMode = document.documentElement.classList.contains('dark');
            setSystemTheme(isDarkMode ? 'dark' : 'light');
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    // Theme colors
    const themeColors = theme === 'dark' ? {
        background: '#0d1117',
        textColor: '#9ca3af',
        borderColor: 'rgba(139, 92, 246, 0.2)',
        gridColor: 'rgba(139, 92, 246, 0.08)',
        crosshairColor: 'rgba(139, 92, 246, 0.5)',
        crosshairLabelBg: '#7c3aed',
    } : {
        background: '#ffffff',
        textColor: '#4b5563',
        borderColor: 'rgba(139, 92, 246, 0.1)',
        gridColor: 'rgba(139, 92, 246, 0.05)',
        crosshairColor: 'rgba(139, 92, 246, 0.3)',
        crosshairLabelBg: '#8b5cf6',
    };

    const intervalSec = INTERVAL_SECONDS[interval];
    const remaining = getRemainingSeconds(nowSec, intervalSec);
    const countdownLabel = formatCountdown(remaining);

    // ─── Build live candles - chuẩn TradingView ──────────────────────────────
    const buildLiveCandles = useCallback(
        (source: CandleWithVolume[]): CandleWithVolume[] => {
            const cp = typeof _currentPrice === 'number' && _currentPrice > 0 ? _currentPrice : null;
            const nowBucket = getBucketTime(nowSec, intervalSec);
            const createdAtSec = (() => {
                if (typeof createdAt === 'number' && createdAt > 0) {
                    const raw = createdAt > 1_000_000_000_000
                        ? Math.floor(createdAt / 1000)
                        : Math.floor(createdAt);
                    return raw > nowSec + 1800 ? raw - (7 * 3600) : raw;
                }
                if (typeof createdAt === 'string') {
                    const ms = Date.parse(createdAt);
                    if (!Number.isNaN(ms) && ms > 0) {
                        const raw = Math.floor(ms / 1000);
                        return raw > nowSec + 1800 ? raw - (7 * 3600) : raw;
                    }
                }
                return null;
            })();
            const startBucketRaw = createdAtSec !== null
                ? getBucketTime(createdAtSec, intervalSec)
                : nowBucket;
            const startBucket = Math.min(startBucketRaw, nowBucket);

            if (source.length === 0) {
                if (!cp) return [];

                const flatCandles: CandleWithVolume[] = [];
                for (let t = startBucket; t <= nowBucket; t += intervalSec) {
                    flatCandles.push({
                        time: t as Time,
                        open: cp,
                        high: cp,
                        low: cp,
                        close: cp,
                        volume: 0,
                    });
                }

                return flatCandles;
            }

            // Normalize + dedupe bucket. Any future bucket from API is clamped to nowBucket
            // so countdown rollover is never blocked by bad/shifted timestamps.
            const bucketMap = new Map<number, CandleWithVolume>();
            for (const raw of source) {
                const rawBucket = getBucketTime(Number(raw.time), intervalSec);
                const bucket = Math.min(rawBucket, nowBucket);
                bucketMap.set(bucket, {
                    time: bucket as Time,
                    open: Number(raw.open),
                    high: Number(raw.high),
                    low: Number(raw.low),
                    close: Number(raw.close),
                    volume: Number(raw.volume ?? 0),
                });
            }

            const sourceBuckets = Array.from(bucketMap.keys()).sort((a, b) => a - b);
            const timelineStart = sourceBuckets.length > 0
                ? Math.min(startBucket, sourceBuckets[0])
                : startBucket;
            const latestSourceBucket = sourceBuckets.length > 0
                ? sourceBuckets[sourceBuckets.length - 1]
                : null;

            const filled: CandleWithVolume[] = [];
            // Seed from the first source candle open so pre-trade flats are preserved,
            // while the first trade candle still keeps its original open.
            const firstSourceOpen = sourceBuckets.length > 0
                ? Number(bucketMap.get(sourceBuckets[0])?.open)
                : null;
            let prevClose: number | null = Number.isFinite(firstSourceOpen as number)
                ? (firstSourceOpen as number)
                : null;

            for (let t = timelineStart; t <= nowBucket; t += intervalSec) {
                const existing = bucketMap.get(t);
                if (existing) {
                    const open = prevClose ?? existing.open;
                    const close = existing.close;
                    const merged: CandleWithVolume = {
                        time: t as Time,
                        open,
                        high: Math.max(existing.high, open, close),
                        low: Math.min(existing.low, open, close),
                        close,
                        volume: Number(existing.volume ?? 0),
                    };
                    filled.push(merged);
                    prevClose = merged.close;
                    continue;
                }

                if (prevClose === null) continue;

                const flat: CandleWithVolume = {
                    time: t as Time,
                    open: prevClose,
                    high: prevClose,
                    low: prevClose,
                    close: prevClose,
                    volume: 0,
                };
                filled.push(flat);
                prevClose = flat.close;
            }

            if (filled.length === 0) {
                return cp === null
                    ? []
                    : [{
                        time: nowBucket as Time,
                        open: cp,
                        high: cp,
                        low: cp,
                        close: cp,
                        volume: 0,
                    }];
            }

            // Chỉ áp currentPrice lên nến hiện tại nếu bucket hiện tại có trade data.
            // Nếu không, giữ nến mới mở ở dạng flat để tránh cảm giác "đóng sớm" nến trước.
            const shouldApplyCurrentPrice = cp !== null && (
                source.length === 0 || latestSourceBucket === nowBucket
            );
            if (shouldApplyCurrentPrice) {
                const idx = filled.length - 1;
                const cur = filled[idx];
                // Wick: high = max của tất cả giá đã qua trong bucket
                //        low  = min của tất cả giá đã qua trong bucket
                filled[idx] = {
                    ...cur,
                    close: cp,
                    high: Math.max(cur.high, cur.open, cp),
                    low:  Math.min(cur.low,  cur.open, cp),
                };
            }

            return filled;
        },
        [_currentPrice, createdAt, intervalSec, nowSec]
    );

    // ─── Fetch OHLCV ─────────────────────────────────────────────────────────
    const fetchCandles = useCallback(
        async (showLoader = false) => {
            if (!tokenId) { setCandles([]); setLoading(false); return; }
            if (isFetchingRef.current) return;
            if (showLoader) setLoading(true);
            isFetchingRef.current = true;
            try {
                const res = await fetch(`/api/ohlcv?tokenId=${tokenId}&interval=${interval}`);
                const data = await res.json();
                if (data.success && data.data.length > 0) {
                    setCandles(data.data);
                    const first = data.data[0];
                    const last = data.data[data.data.length - 1];
                    if (first.open > 0) {
                        setPriceChange(((last.close - first.open) / first.open) * 100);
                    }
                } else {
                    setCandles([]);
                    setPriceChange(0);
                }
            } catch {
                setCandles([]);
            } finally {
                isFetchingRef.current = false;
                if (showLoader) setLoading(false);
            }
        },
        [tokenId, interval]
    );

    // ─── Init chart ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: themeColors.background },
                textColor: themeColors.textColor,
                fontSize: 11,
            },
            localization: {
                timeFormatter: (time: Time) => formatTimeUtc7(time, true),
            },
            grid: {
                vertLines: { color: themeColors.gridColor },
                horzLines: { color: themeColors.gridColor },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: themeColors.crosshairColor, labelBackgroundColor: themeColors.crosshairLabelBg },
                horzLine: { color: themeColors.crosshairColor, labelBackgroundColor: themeColors.crosshairLabelBg },
            },
            rightPriceScale: {
                borderColor: themeColors.borderColor,
                scaleMargins: { top: 0.08, bottom: 0.22 },
                autoScale: true,
            },
            timeScale: {
                borderColor: themeColors.borderColor,
                timeVisible: true,
                // secondsVisible chỉ bật cho 1m
                secondsVisible: false,
                rightOffset: 10,
                barSpacing: 12,
                minBarSpacing: 2,
                fixLeftEdge: false,
                fixRightEdge: false,
                tickMarkFormatter: (time: Time) => formatTimeUtc7(time, interval === '1d'),
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
                axisPressedMouseMove: { time: true, price: true },
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
            width: containerRef.current.clientWidth,
            height: 420,
        });

        // Candlestick series - màu giống TradingView mặc định
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderUpColor: '#26a69a',
            borderDownColor: '#ef5350',
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            priceFormat: {
                type: 'price',
                precision: 8,
                minMove: 0.00000001,
            },
        });

        // Volume histogram
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: 'rgba(139, 92, 246, 0.3)',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.82, bottom: 0 },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        const ro = new ResizeObserver(() => {
            if (containerRef.current) {
                chart.applyOptions({ width: containerRef.current.clientWidth });
            }
        });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
        };
    }, [theme]);

    // secondsVisible chỉ bật cho 1m
    useEffect(() => {
        chartRef.current?.applyOptions({
            timeScale: { secondsVisible: interval === '1m' },
        });
    }, [interval]);

    // Fetch khi đổi interval
    useEffect(() => {
        fitPendingRef.current = true;
        fetchCandles(true);
    }, [fetchCandles]);

    // Clock tick mỗi giây - cập nhật countdown + nến live
    useEffect(() => {
        const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    // Poll mỗi 10s
    useEffect(() => {
        const t = setInterval(() => fetchCandles(false), 10000);
        return () => clearInterval(t);
    }, [fetchCandles]);

    // Refresh sau trade
    useEffect(() => {
        if (refreshKey === undefined) return;
        pendingPostTradeAutoscaleRef.current = true;
        fetchCandles(false);
    }, [refreshKey, fetchCandles]);

    // ─── Apply data to chart ──────────────────────────────────────────────────
    useEffect(() => {
        const live = buildLiveCandles(candles);
        if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

        if (live.length === 0) {
            candleSeriesRef.current.setData([]);
            volumeSeriesRef.current.setData([]);
            setPriceChange(0);
            return;
        }

        // Validate: đảm bảo high >= max(open,close) và low <= min(open,close)
        // Đây là điều kiện bắt buộc để có râu nến đúng
        const validated = live.map((c) => ({
            ...c,
            high: Math.max(c.high, c.open, c.close),
            low: Math.min(c.low, c.open, c.close),
        }));

        candleSeriesRef.current.setData(validated);
        volumeSeriesRef.current.setData(
            validated.map((c) => ({
                time: c.time,
                value: c.volume ?? 0,
                color: c.close >= c.open
                    ? 'rgba(38, 166, 154, 0.4)'
                    : 'rgba(239, 83, 80, 0.4)',
            }))
        );

        // Auto-scale once right after a trade so the full spike candle is visible,
        // then keep user manual scale/zoom untouched.
        if (pendingPostTradeAutoscaleRef.current) {
            chartRef.current?.priceScale('right').applyOptions({
                autoScale: true,
                scaleMargins: { top: 0.1, bottom: 0.22 },
            });
            pendingPostTradeAutoscaleRef.current = false;
        }

        const first = validated[0];
        const last = validated[validated.length - 1];
        if (first.open > 0) {
            setPriceChange(((last.close - first.open) / first.open) * 100);
        }

        // Countdown overlay position
        const y = candleSeriesRef.current.priceToCoordinate(last.close);
        setCountdownY(typeof y === 'number' ? y : null);

        if (fitPendingRef.current) {
            chartRef.current?.timeScale().fitContent();
            fitPendingRef.current = false;
        }
    }, [buildLiveCandles, candles]);

    const liveCandles = buildLiveCandles(candles);
    const symbol = `${ticker.toUpperCase()}/TEST`;
    const isPositive = priceChange >= 0;

    // Vol 24h — tổng volume 24h gần nhất từ candles gốc (không phải live)
    const vol24h = (() => {
        const cutoff = Math.floor(Date.now() / 1000) - 86400;
        const total = candles.reduce((sum, c) => {
            return Number(c.time) >= cutoff ? sum + (c.volume ?? 0) : sum;
        }, 0);
        if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(2)}M`;
        if (total >= 1_000) return `${(total / 1_000).toFixed(2)}K`;
        return total.toFixed(2);
    })();

    return (
        <div style={{
            background: themeColors.background,
            border: `1px solid ${themeColors.borderColor}`,
            borderRadius: '0.75rem',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderBottom: `1px solid ${themeColors.gridColor}`,
                flexWrap: 'wrap',
                gap: '0.5rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: themeColors.textColor === '#9ca3af' ? '#fff' : '#111827', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em' }}>
                        {symbol}
                    </span>
                    {/* Countdown badge - giống TradingView */}
                    <span style={{
                        color: themeColors.textColor,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)',
                        border: theme === 'dark' ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid rgba(148, 163, 184, 0.25)',
                        borderRadius: '0.3rem',
                        padding: '0.12rem 0.4rem',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '0.03em',
                    }}>
                        {interval} · {countdownLabel}
                    </span>
                    {candles.length > 1 && (
                        <span style={{
                            color: isPositive ? '#26a69a' : '#ef5350',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                        }}>
                            {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                        </span>
                    )}
                </div>

                {/* Interval buttons */}
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                    {INTERVALS.map((iv) => (
                        <button
                            key={iv}
                            onClick={() => setIntervalState(iv)}
                            style={{
                                padding: '0.22rem 0.55rem',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                borderRadius: '0.3rem',
                                border: 'none',
                                cursor: 'pointer',
                                background: interval === iv
                                    ? (theme === 'dark' ? 'rgba(139, 92, 246, 0.45)' : 'rgba(139, 92, 246, 0.25)')
                                    : (theme === 'dark' ? 'rgba(139, 92, 246, 0.07)' : 'rgba(139, 92, 246, 0.05)'),
                                color: interval === iv ? (theme === 'dark' ? '#fff' : '#111827') : themeColors.textColor,
                                transition: 'all 0.15s',
                            }}
                        >
                            {iv}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart area */}
            <div style={{ position: 'relative' }}>

                {loading && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: theme === 'dark' ? 'rgba(13, 17, 23, 0.75)' : 'rgba(255, 255, 255, 0.75)',
                    }}>
                        <span style={{ color: themeColors.textColor, fontSize: '0.85rem' }}>Loading chart...</span>
                    </div>
                )}

                {!loading && liveCandles.length === 0 && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 10,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        background: theme === 'dark' ? 'rgba(13, 17, 23, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                        gap: '0.5rem',
                    }}>
                        <span style={{ color: theme === 'dark' ? '#6b7280' : '#9ca3af', fontSize: '0.9rem' }}>No trades yet</span>
                        <span style={{ color: theme === 'dark' ? '#4b5563' : '#b0b8c1', fontSize: '0.75rem' }}>Waiting for the first trade</span>
                    </div>
                )}

                <div ref={containerRef} style={{ width: '100%', height: '420px' }} />
            </div>
        </div>
    );
}
