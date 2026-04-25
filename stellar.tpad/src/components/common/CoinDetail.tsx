'use client';

import React, { useState } from 'react';
import { Coin } from '@/types';
import { ArrowLeft, ExternalLink, Copy, CheckCheck } from 'lucide-react';
import { ToastMessage } from '@/components/ui/Toast';
import BondingCurve from './BondingCurve';
import TokenInfoBar from './TokenInfoBar';

interface CoinDetailProps {
  coin: Coin;
  onBack: () => void;
  showToast: (type: ToastMessage['type'], title: string, message: string) => string;
  removeToast: (id: string) => void;
}

const CoinDetail: React.FC<CoinDetailProps> = ({ coin, onBack }) => {
  const [copied, setCopied] = useState(false);
  const contractId = coin.contractAddress || coin.tokenAddress || '';

  const copy = () => {
    if (!contractId) return;
    navigator.clipboard.writeText(contractId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-4 max-w-3xl animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white mb-6 text-sm font-bold uppercase transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to board
      </button>

      <TokenInfoBar coin={coin} />

      {/* Token card */}
      <div className="mt-6 bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-xl p-6 space-y-5">
        {/* Image + name */}
        <div className="flex items-center gap-4">
          {coin.imageUrl && (
            <img src={coin.imageUrl} alt={coin.name} className="w-20 h-20 rounded-xl object-cover" />
          )}
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">{coin.name}</h2>
            <p className="text-emerald-400 font-mono font-bold">${coin.ticker}</p>
            {coin.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{coin.description}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-gray-500 text-xs uppercase mb-1">Network</p>
            <p className="text-emerald-400 font-medium">Stellar Testnet</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-gray-500 text-xs uppercase mb-1">Total Supply</p>
            <p className="text-gray-900 dark:text-white font-mono">1,000,000,000</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-gray-500 text-xs uppercase mb-1">Decimals</p>
            <p className="text-gray-900 dark:text-white font-mono">7</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <p className="text-gray-500 text-xs uppercase mb-1">Creator</p>
            <p className="text-gray-900 dark:text-white font-mono text-xs truncate">
              {coin.creator ? `${coin.creator.slice(0, 8)}...${coin.creator.slice(-4)}` : '—'}
            </p>
          </div>
        </div>

        {/* Contract ID */}
        {contractId && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <p className="text-gray-500 text-xs uppercase mb-2">Contract ID</p>
            <div className="flex items-center gap-2">
              <p className="text-gray-900 dark:text-white font-mono text-xs flex-1 truncate">{contractId}</p>
              <button onClick={copy} className="text-gray-400 hover:text-white transition-colors shrink-0">
                {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {contractId && (
            <>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${contractId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-500 hover:text-emerald-400 text-sm font-medium transition-colors"
              >
                Stellar Expert <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href={`https://lab.stellar.org/r/testnet/contract/${contractId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
              >
                Stellar Lab <ExternalLink className="w-4 h-4" />
              </a>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        <BondingCurve progress={coin.bondingCurveProgress ?? 0} />
      </div>
    </div>
  );
};

export default CoinDetail;
