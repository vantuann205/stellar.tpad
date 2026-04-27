'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function SimpleHeader() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState('');

  const connectWallet = async () => {
    try {
      const { isConnected, getAddress } = await import('@stellar/freighter-api');
      const connected = await isConnected();
      if (!connected) {
        alert('Vui lòng cài Freighter extension: https://freighter.app');
        return;
      }
      const result = await getAddress();
      const pk = typeof result === 'string' ? result : (result as any).address ?? '';
      setWalletAddress(pk);
    } catch (e) {
      alert('Không thể kết nối Freighter: ' + (e instanceof Error ? e.message : e));
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-[#0b0f1a]/90 backdrop-blur">
      <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4">
        <span className="text-base font-black text-white tracking-wide">
          stellar<span className="text-emerald-400">.tpad</span>
        </span>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {walletAddress ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/profile/${walletAddress}`)}
                className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 transition-colors"
              >
                Profile
              </button>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm text-emerald-300 font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              Connect Freighter
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
