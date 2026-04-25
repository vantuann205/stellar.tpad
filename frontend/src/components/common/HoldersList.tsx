'use client'

import React, { useEffect, useState } from 'react';

interface Holder {
    rank: number;
    address: string;
    qty: number;
    pct: number;
}

interface HoldersListProps {
    tokenId?: number | string;
    refreshKey?: number;
}

const HoldersList: React.FC<HoldersListProps> = ({ tokenId, refreshKey }) => {
    const [holders, setHolders] = useState<Holder[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!tokenId) return;
        setLoading(true);
        fetch(`/api/holders?tokenId=${tokenId}`)
            .then(r => r.json())
            .then(data => {
                if (data.success && Array.isArray(data.data)) setHolders(data.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [tokenId, refreshKey]);

    return (
        <div className="bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 dark:text-gray-300 mb-4 text-sm uppercase">Top Holders</h3>
            {loading ? (
                <p className="text-xs text-gray-500 text-center py-4">Loading...</p>
            ) : holders.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No holder data yet.</p>
            ) : (
                <div className="space-y-3">
                    {holders.map((holder) => (
                        <div key={holder.rank} className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400 font-semibold text-xs">
                                TOP {holder.rank}
                            </span>
                            <span className="text-gray-900 dark:text-white font-medium text-xs">
                                {holder.pct < 0.01 ? holder.pct.toFixed(5) : holder.pct.toFixed(2)}%
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HoldersList;
