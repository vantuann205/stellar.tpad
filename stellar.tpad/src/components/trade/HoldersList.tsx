'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

interface Holder {
  address: string;
  balance: string;
  percentage: number;
}

interface HoldersListProps {
  tokenAddress: string;
  refreshKey?: number;
}

export default function HoldersList({ tokenAddress, refreshKey = 0 }: HoldersListProps) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHolders = async () => {
      try {
        const res = await fetch(`/api/tokens/${tokenAddress}/holders`);
        const data = await res.json();
        if (data.success && data.data) {
          setHolders(data.data);
        }
      } catch (error) {
        console.error('Error fetching holders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHolders();
  }, [tokenAddress, refreshKey]);

  return (
    <div className="bg-pump-card border border-gray-800 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-gray-400" />
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
          Top Holders ({holders.length})
        </h3>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
      ) : holders.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">No holders yet</div>
      ) : (
        <div className="space-y-2">
          {holders.slice(0, 10).map((holder, index) => (
            <div
              key={holder.address}
              className="flex items-center justify-between p-2 bg-pump-bg rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs font-bold w-6">
                  #{index + 1}
                </span>
                <span className="text-white text-sm font-mono">
                  {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                </span>
              </div>
              <div className="text-right">
                <div className="text-white text-sm font-bold">
                  {parseFloat(holder.balance).toFixed(2)}
                </div>
                <div className="text-gray-500 text-xs">
                  {holder.percentage.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
