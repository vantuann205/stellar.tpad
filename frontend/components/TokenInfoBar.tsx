'use client'

import React, { useEffect, useState } from 'react';
import { Coin } from '../types';
import { ExternalLink, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TokenInfoBarProps {
    coin: Coin;
    currentPriceOverride?: number;
}

const TokenInfoBar: React.FC<TokenInfoBarProps> = ({ coin, currentPriceOverride }) => {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const OASIS_EXPLORER_URL = 'https://testnet.explorer.sapphire.oasis.io/address';

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!coin.id) { setLoading(false); return; }
            try {
                const res = await fetch(`/api/tokens/update-metrics?token_id=${coin.id}`);
                const data = await res.json();
                if (data.success && data.data) setMetrics(data.data);
            } catch (error) {
                console.error('Error fetching metrics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 8000);
        const onMetricsUpdated = () => fetchMetrics();
        window.addEventListener('token-metrics-updated', onMetricsUpdated as EventListener);
        return () => {
            clearInterval(interval);
            window.removeEventListener('token-metrics-updated', onMetricsUpdated as EventListener);
        };
    }, [coin.id]);

    const openExplorer = (address: string) => {
        window.open(`${OASIS_EXPLORER_URL}/${address}`, '_blank');
    };

    const formatVolume = (volume: number) => {
        if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
        if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
        return volume.toFixed(2);
    };

    const formatPrice = (price: number) => {
        if (price < 0.00001) return price.toFixed(8);
        if (price < 0.01) return price.toFixed(6);
        return price.toFixed(8);
    };

    const getPriceChangeColor = (change: number) => {
        if (change > 0) return 'text-pump-green';
        if (change < 0) return 'text-pump-red';
        return 'text-gray-400';
    };

    const getPriceChangeIcon = (change: number) => {
        if (change > 0) return <ArrowUpRight className="w-4 h-4 inline" />;
        if (change < 0) return <ArrowDownRight className="w-4 h-4 inline" />;
        return null;
    };

    const volume = metrics ? parseFloat(metrics.volume_24h) || 0 : 0;
    const metricsPrice = metrics ? parseFloat(metrics.price_snapshot_value) || 0 : 0;
    const price = currentPriceOverride && currentPriceOverride > 0 ? currentPriceOverride : metricsPrice;
    const marketCap = metrics ? parseFloat(metrics.marketcap) || 0 : 0;
    const change5m = metrics ? parseFloat(metrics.price_change_5m) || 0 : 0;
    const change1h = metrics ? parseFloat(metrics.price_change_1h) || 0 : 0;
    const change6h = metrics ? parseFloat(metrics.price_change_6h) || 0 : 0;

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4 mb-4 gap-4 md:gap-8">
            {/* Left: Token Info */}
            <div className="flex items-center gap-4 flex-1">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        {coin.name}
                    </h1>
                    <div className="text-lg text-gray-600 dark:text-gray-500 font-mono">
                        {coin.ticker}
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-1">
                        <button
                            onClick={() => openExplorer(coin.creator)}
                            className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                            title="View creator on Oasis Explorer"
                        >
                            {coin.creator.slice(0, 6)}...{coin.creator.slice(-4)} <ExternalLink className="w-3 h-3" />
                        </button>
                        {coin.contractAddress && (
                            <button
                                onClick={() => openExplorer(coin.contractAddress!)}
                                className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                title="View contract on Oasis Explorer"
                            >
                                {coin.contractAddress.slice(0, 6)}...{coin.contractAddress.slice(-4)} <ExternalLink className="w-3 h-3" />
                            </button>
                        )}
                        <span className="text-gray-600 dark:text-gray-500">Created {new Date(coin.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            {/* Right: Metrics */}
            <div className="flex gap-4 md:gap-6 flex-wrap md:flex-nowrap md:justify-end overflow-x-auto">
                {loading ? (
                    <>
                        <div className="animate-pulse h-12 bg-gray-300 dark:bg-gray-800 rounded w-24"></div>
                        <div className="animate-pulse h-12 bg-gray-300 dark:bg-gray-800 rounded w-24"></div>
                        <div className="animate-pulse h-12 bg-gray-300 dark:bg-gray-800 rounded w-24"></div>
                        <div className="animate-pulse h-12 bg-gray-300 dark:bg-gray-800 rounded w-24"></div>
                        <div className="animate-pulse h-12 bg-gray-300 dark:bg-gray-800 rounded w-24"></div>
                        <div className="animate-pulse h-12 bg-gray-300 dark:bg-gray-800 rounded w-24"></div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col justify-center min-w-fit">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">
                                Market Cap
                            </div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                                ${marketCap ? (marketCap / 1000000).toFixed(2) : '0.00'}M
                            </div>
                        </div>

                        <div className="flex flex-col justify-center min-w-fit">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">
                                Vol 24h
                            </div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                                {formatVolume(volume)}
                            </div>
                        </div>

                        <div className="flex flex-col justify-center min-w-fit">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-semibold tracking-wider">
                                Price
                            </div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                                {formatPrice(price)}
                            </div>
                        </div>

                        <div className="flex flex-col justify-center min-w-fit">
                            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
                                5m
                            </div>
                            <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getPriceChangeColor(change5m)}`}>
                                {getPriceChangeIcon(change5m)}
                                {change5m.toFixed(2)}%
                            </div>
                        </div>

                        <div className="flex flex-col justify-center min-w-fit">
                            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
                                1h
                            </div>
                            <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getPriceChangeColor(change1h)}`}>
                                {getPriceChangeIcon(change1h)}
                                {change1h.toFixed(2)}%
                            </div>
                        </div>

                        <div className="flex flex-col justify-center min-w-fit">
                            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
                                6h
                            </div>
                            <div className={`text-lg font-bold font-mono flex items-center gap-1 ${getPriceChangeColor(change6h)}`}>
                                {getPriceChangeIcon(change6h)}
                                {change6h.toFixed(2)}%
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TokenInfoBar;
