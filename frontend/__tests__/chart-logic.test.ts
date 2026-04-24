/**
 * Tests for chart candle logic — no DOM, no lightweight-charts dependency.
 * Tests the pure logic that should be in the chart component.
 *
 * Run: npx jest __tests__/chart-logic.test.ts --no-coverage
 */

// ── Types ─────────────────────────────────────────────────────────────────────
type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };
type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
const SECS: Record<Interval, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

// ── Pure functions extracted from chart component ─────────────────────────────
function floorBucket(ts: number, sec: number): number {
    return Math.floor(ts / sec) * sec;
}

function buildLiveCandlesFromSource(
    source: Bar[],
    intervalSec: number,
    nowSec: number,
    currentPrice: number | null,
    createdAtMs?: number
): Bar[] {
    const nowBucket = floorBucket(nowSec, intervalSec);
    const startBucketRaw = typeof createdAtMs === 'number' && createdAtMs > 0
        ? floorBucket(Math.floor(createdAtMs / 1000), intervalSec)
        : nowBucket;
    const startBucket = Math.min(startBucketRaw, nowBucket);

    if (source.length === 0) {
        if (currentPrice === null) return [];
        const out: Bar[] = [];
        for (let t = startBucket; t <= nowBucket; t += intervalSec) {
            out.push({ time: t, open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 });
        }
        return out;
    }

    const map = new Map<number, Bar>();
    for (const row of source) {
        const bkt = Math.min(floorBucket(row.time, intervalSec), nowBucket);
        map.set(bkt, {
            time: bkt,
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.volume ?? 0),
        });
    }

    const sourceBuckets = Array.from(map.keys()).sort((a, b) => a - b);
    const timelineStart = sourceBuckets.length > 0 ? Math.min(startBucket, sourceBuckets[0]) : startBucket;
    const latestSourceBucket = sourceBuckets.length > 0 ? sourceBuckets[sourceBuckets.length - 1] : null;

    const out: Bar[] = [];
    const firstSourceOpen = sourceBuckets.length > 0 ? Number(map.get(sourceBuckets[0])?.open) : null;
    let prevClose: number | null = Number.isFinite(firstSourceOpen as number) ? (firstSourceOpen as number) : null;
    for (let t = timelineStart; t <= nowBucket; t += intervalSec) {
        const existing = map.get(t);
        if (existing) {
            const open = prevClose ?? existing.open;
            const merged: Bar = {
                time: t,
                open,
                high: Math.max(existing.high, open, existing.close),
                low: Math.min(existing.low, open, existing.close),
                close: existing.close,
                volume: Number(existing.volume ?? 0),
            };
            out.push(merged);
            prevClose = merged.close;
            continue;
        }
        if (prevClose === null) continue;
        out.push({ time: t, open: prevClose, high: prevClose, low: prevClose, close: prevClose, volume: 0 });
    }

    if (out.length === 0) {
        if (currentPrice === null) return [];
        return [{ time: nowBucket, open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 }];
    }

    const shouldApplyCurrentPrice = currentPrice !== null && (
        source.length === 0 || latestSourceBucket === nowBucket
    );
    if (shouldApplyCurrentPrice) {
        const i = out.length - 1;
        out[i] = {
            ...out[i],
            close: currentPrice,
            high: Math.max(out[i].high, out[i].open, currentPrice),
            low: Math.min(out[i].low, out[i].open, currentPrice),
        };
    }

    return out;
}

/** Simulate what OHLCV API returns: group trades into buckets with continuity */
function buildOHLCV(trades: { time: number; price: number; qty: number; isBuy: boolean }[], intervalSec: number): Bar[] {
    const SLOPE = 0.00001;
    const bucketMap = new Map<number, { open: number; close: number; high: number; low: number; volume: number }>();

    for (const t of trades) {
        const bkt = floorBucket(t.time, intervalSec);
        const half = (t.qty * SLOPE) / 2;
        const startPrice = t.isBuy ? t.price - half : t.price + half;
        const endPrice   = t.isBuy ? t.price + half : t.price - half;
        const hi = Math.max(startPrice, endPrice);
        const lo = Math.min(startPrice, endPrice);

        if (!bucketMap.has(bkt)) {
            bucketMap.set(bkt, { open: startPrice, close: endPrice, high: hi, low: lo, volume: t.qty });
        } else {
            const b = bucketMap.get(bkt)!;
            b.close = endPrice;
            b.high  = Math.max(b.high, hi);
            b.low   = Math.min(b.low, lo);
            b.volume += t.qty;
        }
    }

    const sorted = Array.from(bucketMap.entries()).sort(([a], [b]) => a - b);
    return sorted.map(([bkt, c], i) => {
        const open = i === 0 ? c.open : sorted[i - 1][1].close;
        return {
            time:   bkt,
            open,
            high:   Math.max(open, c.high, c.close),
            low:    Math.min(open, c.low,  c.close),
            close:  c.close,
            volume: c.volume,
        };
    });
}

/** Simulate cache-based interval switching */
class ChartState {
    cache: Partial<Record<Interval, Bar[]>> = {};
    current: Bar[] = [];
    currentIv: Interval = '5m';

    load(iv: Interval, bars: Bar[]) {
        this.cache[iv] = [...bars];
        this.current = [...bars];
        this.currentIv = iv;
    }

    switchTo(iv: Interval, freshBars: Bar[]) {
        // Paint cache immediately
        const cached = this.cache[iv];
        if (cached && cached.length > 0) {
            this.current = [...cached];
        } else {
            this.current = [];
        }
        this.currentIv = iv;
        // Then update with fresh data
        this.cache[iv] = [...freshBars];
        this.current = [...freshBars];
    }

    appendOrUpdate(bar: Bar) {
        const hist = this.current;
        if (hist.length === 0) { hist.push(bar); return; }
        const last = hist[hist.length - 1];
        if (bar.time === last.time) {
            hist[hist.length - 1] = bar; // update in place
        } else if (bar.time > last.time) {
            hist.push(bar); // new candle
        }
        this.cache[this.currentIv] = [...hist];
    }
}

// ── Test data ─────────────────────────────────────────────────────────────────
// 3 trades at t=0, t=90, t=200 seconds
const BASE_TIME = 1700000400; // divisible by 300 (5m bucket boundary)
const TRADES = [
    { time: BASE_TIME + 0,   price: 0.05,   qty: 100, isBuy: true  },
    { time: BASE_TIME + 90,  price: 0.0501, qty: 200, isBuy: true  },
    { time: BASE_TIME + 200, price: 0.0499, qty: 50,  isBuy: false },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OHLCV API logic', () => {
    test('1m: 3 trades → 4 buckets (t=0,60,120,180)', () => {
        const bars = buildOHLCV(TRADES, 60);
        // t=0 and t=90 are in different 1m buckets; t=200 is in bucket 180
        expect(bars.length).toBe(3);
        expect(bars[0].time).toBe(floorBucket(BASE_TIME, 60));
        expect(bars[1].time).toBe(floorBucket(BASE_TIME + 90, 60));
        expect(bars[2].time).toBe(floorBucket(BASE_TIME + 200, 60));
    });

    test('5m: all 3 trades in same bucket', () => {
        // All trades within 300s window → same 5m bucket
        const trades = [
            { time: BASE_TIME + 0,   price: 0.05,   qty: 100, isBuy: true  },
            { time: BASE_TIME + 90,  price: 0.0501, qty: 200, isBuy: true  },
            { time: BASE_TIME + 250, price: 0.0499, qty: 50,  isBuy: false },
        ];
        const bars = buildOHLCV(trades, 300);
        expect(bars.length).toBe(1);
        expect(bars[0].time).toBe(floorBucket(BASE_TIME, 300));
    });

    test('continuity: open[i] === close[i-1]', () => {
        const bars = buildOHLCV(TRADES, 60);
        for (let i = 1; i < bars.length; i++) {
            expect(bars[i].open).toBeCloseTo(bars[i - 1].close, 8);
        }
    });

    test('wick contains body: high >= max(open,close), low <= min(open,close)', () => {
        const bars = buildOHLCV(TRADES, 60);
        for (const b of bars) {
            expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close) - 1e-10);
            expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close) + 1e-10);
        }
    });

    test('1h: all trades in same bucket, same result as 5m here', () => {
        const bars = buildOHLCV(TRADES, 3600);
        expect(bars.length).toBe(1);
    });

    test('cross-timeframe consistency: 5m close === 1m last-bucket close', () => {
        const bars1m = buildOHLCV(TRADES, 60);
        const bars5m = buildOHLCV(TRADES, 300);
        // The final close price should be the same regardless of interval
        expect(bars1m[bars1m.length - 1].close).toBeCloseTo(bars5m[bars5m.length - 1].close, 8);
    });
});

describe('Chart cache & interval switching', () => {
    let state: ChartState;

    beforeEach(() => {
        state = new ChartState();
    });

    test('switching interval preserves cache of previous interval', () => {
        const bars1m = buildOHLCV(TRADES, 60);
        const bars5m = buildOHLCV(TRADES, 300);

        state.load('1m', bars1m);
        expect(state.current.length).toBe(bars1m.length);

        state.switchTo('5m', bars5m);
        expect(state.current.length).toBe(bars5m.length);

        // Switch back to 1m — cache should restore immediately
        state.switchTo('1m', bars1m);
        expect(state.current.length).toBe(bars1m.length);
        expect(state.current[0].time).toBe(bars1m[0].time);
    });

    test('switching 1m→5m→1m: 1m candles are NOT lost', () => {
        const bars1m = buildOHLCV(TRADES, 60);
        const bars5m = buildOHLCV(TRADES, 300);

        state.load('1m', bars1m);
        const original1mCount = state.current.length;

        state.switchTo('5m', bars5m);
        state.switchTo('1m', bars1m); // back to 1m

        expect(state.current.length).toBe(original1mCount);
        // All original candles present
        for (let i = 0; i < bars1m.length; i++) {
            expect(state.current[i].time).toBe(bars1m[i].time);
            expect(state.current[i].open).toBeCloseTo(bars1m[i].open, 8);
            expect(state.current[i].close).toBeCloseTo(bars1m[i].close, 8);
        }
    });

    test('appendOrUpdate: new candle appended correctly', () => {
        const bars = buildOHLCV(TRADES, 60);
        state.load('1m', bars);
        const before = state.current.length;

        const newBar: Bar = {
            time: bars[bars.length - 1].time + 60,
            open: bars[bars.length - 1].close,
            high: bars[bars.length - 1].close + 0.001,
            low:  bars[bars.length - 1].close - 0.0005,
            close: bars[bars.length - 1].close + 0.0008,
            volume: 10,
        };
        state.appendOrUpdate(newBar);
        expect(state.current.length).toBe(before + 1);
        expect(state.current[state.current.length - 1].time).toBe(newBar.time);
    });

    test('appendOrUpdate: same-time bar updates in place (no duplicate)', () => {
        const bars = buildOHLCV(TRADES, 60);
        state.load('1m', bars);
        const before = state.current.length;
        const lastBar = bars[bars.length - 1];

        const updatedBar: Bar = { ...lastBar, close: lastBar.close + 0.001, high: lastBar.high + 0.001 };
        state.appendOrUpdate(updatedBar);

        expect(state.current.length).toBe(before); // no new candle
        expect(state.current[state.current.length - 1].close).toBeCloseTo(updatedBar.close, 8);
    });

    test('cache updated after appendOrUpdate', () => {
        const bars = buildOHLCV(TRADES, 60);
        state.load('1m', bars);

        const newBar: Bar = {
            time: bars[bars.length - 1].time + 60,
            open: bars[bars.length - 1].close,
            high: bars[bars.length - 1].close + 0.001,
            low:  bars[bars.length - 1].close,
            close: bars[bars.length - 1].close + 0.001,
            volume: 5,
        };
        state.appendOrUpdate(newBar);

        // Cache should reflect the new candle
        expect(state.cache['1m']!.length).toBe(bars.length + 1);
    });
});

describe('Live tick bucket logic', () => {
    test('same bucket: open stays fixed, wick extends', () => {
        const sec = 60;
        const bkt = floorBucket(BASE_TIME + 10, sec);
        let prev: Bar = { time: bkt, open: 0.05, high: 0.051, low: 0.049, close: 0.050, volume: 0 };

        // New price higher
        const newPrice = 0.052;
        const updated: Bar = {
            time:   bkt,
            open:   prev.open,                        // open NEVER changes
            high:   Math.max(prev.high, newPrice),
            low:    Math.min(prev.low,  newPrice),
            close:  newPrice,
            volume: prev.volume,
        };

        expect(updated.open).toBe(0.05);              // open unchanged
        expect(updated.high).toBeCloseTo(0.052, 8);   // wick extended
        expect(updated.close).toBeCloseTo(0.052, 8);
    });

    test('new bucket: open = prev.close (continuity)', () => {
        const sec = 60;
        const prevBkt = floorBucket(BASE_TIME, sec);
        const newBkt  = prevBkt + sec;
        const prevClose = 0.0512;

        const newBar: Bar = {
            time:   newBkt,
            open:   prevClose,                        // open = prev close
            high:   Math.max(prevClose, 0.0515),
            low:    Math.min(prevClose, 0.0515),
            close:  0.0515,
            volume: 0,
        };

        expect(newBar.open).toBeCloseTo(prevClose, 8);
        expect(newBar.time).toBe(newBkt);
    });

    test('bucket detection: prevBkt < newBkt triggers new candle', () => {
        const sec = 300; // 5m
        const t1 = floorBucket(BASE_TIME, sec);
        const t2 = t1 + sec;

        let prevBkt = t1;
        let newBucket = false;

        // Simulate clock advancing past bucket boundary
        const nowBkt = t2;
        newBucket = prevBkt !== 0 && nowBkt > prevBkt;
        prevBkt = nowBkt;

        expect(newBucket).toBe(true);
    });

    test('single trade: next bucket is created after interval boundary', () => {
        const sec = 60;
        const tradeBucket = floorBucket(BASE_TIME + 5, sec);
        const source: Bar[] = [
            { time: tradeBucket, open: 0.05, high: 0.0503, low: 0.0498, close: 0.0502, volume: 100 },
        ];

        const beforeBoundary = buildLiveCandlesFromSource(source, sec, tradeBucket + 59, 0.0502);
        expect(beforeBoundary[beforeBoundary.length - 1].time).toBe(tradeBucket);

        const afterBoundary = buildLiveCandlesFromSource(source, sec, tradeBucket + 60, 0.0502);
        expect(afterBoundary.length).toBe(beforeBoundary.length + 1);
        expect(afterBoundary[afterBoundary.length - 1].time).toBe(tradeBucket + sec);
        expect(afterBoundary[afterBoundary.length - 1].open).toBeCloseTo(0.0502, 8);
    });

    test('future source timestamp is clamped so rollover is not blocked', () => {
        const sec = 60;
        const now = floorBucket(BASE_TIME + 120, sec);
        const future = now + (7 * 3600); // emulate timezone-shifted row
        const source: Bar[] = [
            { time: future, open: 0.05, high: 0.051, low: 0.049, close: 0.0505, volume: 42 },
        ];

        const live = buildLiveCandlesFromSource(source, sec, now, 0.0505);
        expect(live[live.length - 1].time).toBe(now);
    });

    test('first trade candle keeps source open, not overwritten by currentPrice', () => {
        const sec = 60;
        const bkt = floorBucket(BASE_TIME + 60, sec);
        const source: Bar[] = [
            { time: bkt, open: 0.05, high: 0.0502, low: 0.05, close: 0.0502, volume: 32 },
        ];

        const live = buildLiveCandlesFromSource(source, sec, bkt + 1, 0.05032);
        const first = live[0];
        expect(first.time).toBe(bkt);
        expect(first.open).toBeCloseTo(0.05, 8);
        expect(first.close).toBeCloseTo(0.05032, 8);
        expect(first.low).toBeLessThanOrEqual(Math.min(first.open, first.close));
        expect(first.high).toBeGreaterThanOrEqual(Math.max(first.open, first.close));
    });

    test('pre-trade flat candles are preserved after first trade appears', () => {
        const sec = 60;
        const createdAt = BASE_TIME; // token exists from this minute
        const tradeBkt = floorBucket(BASE_TIME + sec, sec); // first trade in next minute
        const source: Bar[] = [
            { time: tradeBkt, open: 0.05, high: 0.0502, low: 0.05, close: 0.0502, volume: 10 },
        ];

        const live = buildLiveCandlesFromSource(source, sec, tradeBkt + 1, 0.0502, createdAt * 1000);
        expect(live.length).toBe(2);
        expect(live[0].time).toBe(floorBucket(createdAt, sec));
        expect(live[0].open).toBeCloseTo(0.05, 8);
        expect(live[0].close).toBeCloseTo(0.05, 8);
        expect(live[1].time).toBe(tradeBkt);
    });

    test('after boundary without new trade: newest candle stays flat (no premature growth)', () => {
        const sec = 60;
        const prevBucket = floorBucket(BASE_TIME + sec, sec);
        const nowSec = prevBucket + sec + 2; // moved to next bucket
        const source: Bar[] = [
            { time: prevBucket, open: 0.05, high: 0.05034, low: 0.05, close: 0.05034, volume: 34.43 },
        ];

        const live = buildLiveCandlesFromSource(source, sec, nowSec, 0.05034, BASE_TIME * 1000);
        expect(live.length).toBeGreaterThanOrEqual(2);

        const last = live[live.length - 1];
        const prev = live[live.length - 2];
        expect(last.time).toBe(prev.time + sec);
        expect(last.open).toBeCloseTo(prev.close, 8);
        expect(last.close).toBeCloseTo(prev.close, 8);
        expect(last.high).toBeCloseTo(prev.close, 8);
        expect(last.low).toBeCloseTo(prev.close, 8);
    });
});
