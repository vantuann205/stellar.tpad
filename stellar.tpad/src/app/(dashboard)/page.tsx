'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Rocket, TrendingUp, Wallet, Plus } from 'lucide-react';
import CreateCoinPage from '@/components/common/CreateCoinPage';
import Header from '@/components/layout/SimpleHeader';

interface CoinCard {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image_url: string;
  owner: string;
  contract_address: string;
  created_at: string;
}

export default function DashboardPage() {
  const [view, setView] = useState<'home' | 'create'>('home');
  const [coins, setCoins] = useState<CoinCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tokens');
      const data = await res.json();
      if (data.success && data.data) setCoins(data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-[#0b0f1a]">
        <Header />
        <div className="pt-4">
          <CreateCoinPage
            onCancel={() => setView('home')}
            onTokenCreated={(contractId, name, symbol) => {
              setView('home');
              fetchCoins();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a]">
      <Header />

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-8 text-center">
        <h1 className="text-5xl font-black text-white mb-3">
          Launch your coin on <span className="text-emerald-400">Stellar</span>
        </h1>
        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
          Deploy token trong vài giây. Supply 1B mint ngay cho bạn. Không presale, không team allocation.
        </p>
        <button
          onClick={() => setView('create')}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all hover:scale-105 shadow-lg shadow-emerald-900/40"
        >
          <Rocket className="w-5 h-5" />
          Start a new coin
        </button>
      </div>

      {/* Stats bar */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: <TrendingUp className="w-4 h-4" />, label: 'Coins launched', value: coins.length.toString() },
            { icon: <Wallet className="w-4 h-4" />, label: 'Network', value: 'Stellar Testnet' },
            { icon: <Plus className="w-4 h-4" />, label: 'Default supply', value: '1,000,000,000' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className="text-emerald-400">{stat.icon}</div>
              <div>
                <p className="text-white font-bold">{stat.value}</p>
                <p className="text-gray-500 text-xs">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coin list */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Coins mới nhất</h2>
          <button onClick={fetchCoins} className="text-sm text-gray-400 hover:text-white transition-colors">
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        ) : coins.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
            <p className="text-gray-500 mb-4">Chưa có coin nào. Hãy là người đầu tiên!</p>
            <button
              onClick={() => setView('create')}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-lg transition-colors"
            >
              <Rocket className="w-4 h-4" /> Tạo coin đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {coins.map(coin => (
              <div
                key={coin.id}
                className="bg-gray-900/50 border border-gray-800 hover:border-emerald-500/40 rounded-xl overflow-hidden transition-all hover:-translate-y-1 cursor-pointer group"
              >
                <div className="h-40 bg-gray-800 overflow-hidden">
                  {coin.image_url
                    ? <img src={coin.image_url} alt={coin.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-600">{coin.symbol[0]}</div>
                  }
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-bold text-white truncate">{coin.name}</p>
                    <span className="text-xs text-emerald-400 font-mono ml-2 shrink-0">${coin.symbol}</span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{coin.description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>by {coin.owner.slice(0, 6)}...{coin.owner.slice(-4)}</span>
                    <span className="text-emerald-600">1B supply</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
