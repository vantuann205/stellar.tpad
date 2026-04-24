'use client'

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Coin } from '../types';
import { formatMarketCap, formatVolume } from '../utils/formatters';

interface TrendingToken {
    id: string;
    name: string;
    ticker: string;
    description: string;
    imageUrl: string;
    creator: string;
    contractAddress: string;
    marketCap: number;
    volume24h: number;
    price: number;
    traderCount: number;
    bondingCurveProgress: number;
    createdAt: number;
    trendScore: number;
}

interface TrendingCoinsProps {
    onClick: (coin: Coin) => void;
}

const formatPrice = (p: number) => {
    if (!p || p === 0) return '—';
    if (p < 0.00001) return p.toFixed(8);
    if (p < 0.01) return p.toFixed(6);
    return p.toFixed(4);
};

const TrendingCoins: React.FC<TrendingCoinsProps> = ({ onClick }) => {
    const [tokens, setTokens] = useState<TrendingToken[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchTrending = async () => {
        try {
            const res = await fetch('/api/trending?limit=10&window=24');
            const data = await res.json();
            if (data.success) setTokens(data.data);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchTrending();
        const interval = setInterval(fetchTrending, 30000);
        return () => clearInterval(interval);
    }, []);

    const [pressing, setPressing] = useState<'left' | 'right' | null>(null);
    const isDragging = useRef(false);
    const hasDragged = useRef(false);
    const dragStartX = useRef(0);
    const dragScrollLeft = useRef(0);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        let active = false;
        let startX = 0;
        let startScroll = 0;

        const onPointerDown = (e: PointerEvent) => {
            active = true;
            hasDragged.current = false;
            startX = e.clientX;
            startScroll = el.scrollLeft;
            el.style.cursor = 'grabbing';
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!active) return;
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 4) {
                hasDragged.current = true;
                isDragging.current = true;
                if (!el.hasPointerCapture(e.pointerId)) {
                    el.setPointerCapture(e.pointerId);
                }
            }
            if (hasDragged.current) {
                el.scrollLeft = startScroll - dx;
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            active = false;
            el.style.cursor = 'grab';
            setTimeout(() => {
                isDragging.current = false;
                hasDragged.current = false;
            }, 50);
        };

        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);

        return () => {
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointermove', onPointerMove);
            el.removeEventListener('pointerup', onPointerUp);
            el.removeEventListener('pointercancel', onPointerUp);
        };
    }, []);

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        setPressing(dir);
        setTimeout(() => setPressing(null), 150);

        const el = scrollRef.current;
        const cardWidth = 192 + 12;
        const distance = dir === 'left' ? -cardWidth * 3 : cardWidth * 3;
        const start = el.scrollLeft;
        const target = start + distance;
        const duration = 400;
        const startTime = performance.now();

        const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            el.scrollLeft = start + distance * easeInOut(progress);
            if (progress < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    };

    const handleClick = (t: TrendingToken) => {
        onClick({
            id: t.id,
            name: t.name,
            ticker: t.ticker,
            description: t.description,
            imageUrl: t.imageUrl,
            creator: t.creator,
            marketCap: t.marketCap,
            replies: 0,
            bondingCurveProgress: t.bondingCurveProgress,
            createdAt: t.createdAt,
            lastReply: t.createdAt,
            priceHistory: [],
            tokenAddress: t.contractAddress,
            contractAddress: t.contractAddress,
            volume24h: t.volume24h,
            traderCount: t.traderCount,
        });
    };

    if (!loading && tokens.length === 0) return null;

    return (
        <div className="mb-8 w-full animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Trending Coins</h2>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => scroll('left')}
                        style={{ transform: pressing === 'left' ? 'scale(0.82)' : 'scale(1)', transition: 'transform 0.15s ease' }}
                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    >
                        <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        style={{ transform: pressing === 'right' ? 'scale(0.82)' : 'scale(1)', transition: 'transform 0.15s ease' }}
                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Scroll container */}
            <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto pb-1 select-none"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
            >
                {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="shrink-0 w-48 h-64 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    ))
                    : tokens.map((t, idx) => (
                        <div
                            key={t.id}
                            onPointerUp={() => { if (!hasDragged.current) handleClick(t); }}
                            className="group shrink-0 w-48 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-pump-card cursor-pointer hover:border-orange-400 dark:hover:border-orange-500 hover:-translate-y-1 transition-all duration-200 overflow-hidden"
                        >
                            {/* Image */}
                            <div className="relative w-full h-36 overflow-hidden">
                                <img
                                    src={t.imageUrl}
                                    alt={t.name}
                                    draggable="false"
                                    onDragStart={e => e.preventDefault()}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                {/* Rank badge */}
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    #{idx + 1}
                                </div>
                                {/* MC overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                                    <p className="text-white font-black text-sm">{formatMarketCap(t.marketCap)}</p>
                                    <p className="text-white/90 font-bold text-xs truncate">{t.name} <span className="text-white/60">{t.ticker}</span></p>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="px-2.5 py-2 space-y-1">
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-gray-500 dark:text-gray-400">24H VOL</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{formatVolume(t.volume24h)}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-gray-500 dark:text-gray-400">Price</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(t.price)}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-gray-500 dark:text-gray-400">Holders</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{t.traderCount}</span>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

export default TrendingCoins;
