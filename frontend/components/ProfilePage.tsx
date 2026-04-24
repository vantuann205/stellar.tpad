'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Edit2, Copy, Check } from 'lucide-react';
import Image from 'next/image';
import { getWalletInfo } from '@/lib/walletHelper';
import EditProfileModal from './EditProfileModal';
import { Coin } from '@/types';

interface WalletInfo {
  id: number;
  wallet_address: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  owned_coins: string[];
  minted_coins: string[];
  created_at: string;
  updated_at: string;
}

interface CoinInfo {
  id: number;
  name: string;
  symbol: string;
  contract_address: string;
  marketcap: number;
  image_url: string;
  created_at?: string;
}

interface ProfilePageProps {
  walletAddress: string;
  onBack: () => void;
  onProfileUpdated?: () => Promise<void>;
  onCoinClick?: (coin: Coin) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ walletAddress, onBack, onProfileUpdated, onCoinClick }) => {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [testBalance, setTestBalance] = useState<number>(0);
  const [ownedCoinDetails, setOwnedCoinDetails] = useState<(CoinInfo & { quantity?: number; pricePerToken?: number })[]>([]);
  const [mintedCoinDetails, setMintedCoinDetails] = useState<CoinInfo[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Handler to navigate to coin detail
  const handleCoinClick = useCallback((coin: CoinInfo & { quantity?: number; pricePerToken?: number; marketcap?: number }, isOwned: boolean) => {
    if (onCoinClick) {
      const coinData: Coin = {
        id: String(coin.id),
        name: coin.name,
        ticker: coin.symbol,
        description: '',
        imageUrl: coin.image_url || `https://picsum.photos/200/200?random=${coin.id}`,
        creator: walletAddress,
        marketCap: coin.marketcap || 0,
        replies: 0,
        bondingCurveProgress: 0,
        createdAt: new Date(coin.created_at || '').getTime(),
        lastReply: new Date(coin.created_at || '').getTime(),
        priceHistory: [],
        tokenAddress: coin.contract_address,
        contractAddress: coin.contract_address,
      };
      onCoinClick(coinData);
    }
  }, [onCoinClick, walletAddress]);

  // Memoize helper functions to prevent unnecessary recalculations
  const formatCompactNumber = useMemo(() => (num: any) => {
    const value = typeof num === 'string' ? parseFloat(num) : Number(num);
    if (isNaN(value)) return '0';
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(2);
  }, []);

  const formatRelativeTime = useMemo(() => (dateString?: string) => {
    if (!dateString) return 'unknown';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return Math.floor(seconds / 604800) + 'w ago';
  }, []);

  useEffect(() => {
    fetchWalletInfo();
  }, [walletAddress]);

  const fetchTestBalance = useCallback(async (address: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch('https://testnet.sapphire.oasis.io', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      if (data.result) {
        const balance = parseInt(data.result, 16) / 1e18;
        setTestBalance(balance);
      }
    } catch (error) {
      console.error('Error fetching TEST balance:', error);
      setTestBalance(0);
    }
  }, []);

  const fetchWalletInfo = useCallback(async () => {
    try {
      // Fetch wallet info first
      const result = await getWalletInfo(walletAddress);

      if (!result.success || !result.wallet) {
        setInitialLoadDone(true);
        return;
      }

      setWalletInfo(result.wallet);
      
      // Fetch TEST balance asynchronously (don't block UI)
      fetchTestBalance(walletAddress);

      // Fetch all tokens in parallel with wallet info
      const tokensResponse = await fetch('/api/tokens');
      const tokensData = await tokensResponse.json();

      if (!tokensData.success || !tokensData.data) {
        setInitialLoadDone(true);
        return;
      }

      // Filter coins immediately and show UI
      const ownedCoins = tokensData.data.filter((coin: any) =>
        result.wallet.owned_coins?.includes(coin.contract_address)
      );
      const mintedCoins = tokensData.data.filter((coin: any) =>
        result.wallet.minted_coins?.includes(coin.contract_address)
      );

      setMintedCoinDetails(mintedCoins);
      setInitialLoadDone(true); // Show UI immediately with owned coins loading

      // Fetch purchase details in background - only show coins with quantity > 0
      if (ownedCoins.length > 0) {
        setPurchasesLoading(true);
        fetchPurchaseDetails(ownedCoins);
      } else {
        setOwnedCoinDetails([]);
      }
    } catch (error) {
      console.error('Error fetching wallet info:', error);
      setInitialLoadDone(true);
    }
  }, [walletAddress, fetchTestBalance]);

  const fetchPurchaseDetails = useCallback(async (coins: any[]) => {
    try {
      // Fetch ALL purchases for wallet in ONE request (not per-coin)
      const allPurchasesRes = await fetch(`/api/purchases?wallet_address=${walletAddress}`);
      const allPurchasesData = await allPurchasesRes.json();

      if (!allPurchasesData.data) {
        setOwnedCoinDetails([]);
        return;
      }

      // Process all purchases once and map to coins
      const coinsWithQuantity = coins.map((coin: any) => {
        let totalBought = 0;
        let totalSold = 0;
        let avgPrice = 0;

        // Filter purchases for this specific coin
        const coinPurchases = allPurchasesData.data.filter(
          (p: any) => p.contract_address && p.contract_address.toLowerCase() === coin.contract_address.toLowerCase()
        );

        if (coinPurchases.length > 0) {
          coinPurchases.forEach((p: any) => {
            const qty = parseFloat(p.quantity) || 0;
            if (p.buyer_address && p.buyer_address.toLowerCase() === walletAddress.toLowerCase()) {
              totalBought += qty;
            }
            if (p.seller_address && p.seller_address.toLowerCase() === walletAddress.toLowerCase()) {
              totalSold += qty;
            }
          });
          // Use first buy transaction's price as average
          const buyTransaction = coinPurchases.find((p: any) =>
            p.buyer_address && p.buyer_address.toLowerCase() === walletAddress.toLowerCase()
          );
          avgPrice = buyTransaction ? (parseFloat(buyTransaction.price_per_token) || 0) : 0;
        }

        const netQuantity = totalBought - totalSold;
        return { ...coin, quantity: netQuantity > 0 ? netQuantity : 0, pricePerToken: avgPrice };
      });

      // Filter out coins with quantity = 0
      const filteredCoins = coinsWithQuantity.filter(coin => coin.quantity > 0);
      setOwnedCoinDetails(filteredCoins);
    } catch (e) {
      console.error('Error fetching purchase details:', e);
      setOwnedCoinDetails([]);
    } finally {
      setPurchasesLoading(false);
    }
  }, [walletAddress]);

  const handleProfileUpdated = () => {
    setShowEditModal(false);
    fetchWalletInfo();
    // Notify parent to refresh Header
    if (onProfileUpdated) {
      onProfileUpdated();
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  if (!initialLoadDone) {
    return (
      <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-white p-4 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
      </div>
    );
  }

  if (!walletInfo) {
    return (
      <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-white p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-green-600 dark:text-pump-green hover:text-green-700 dark:hover:text-pump-green/80 transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <p className="text-gray-600 dark:text-gray-400">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-300 dark:border-gray-800 bg-white dark:bg-pump-bg/95 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Profile Card */}
        <div className="bg-gradient-to-b from-gray-100 dark:from-gray-900/50 to-white dark:to-pump-card rounded-xl border border-gray-300 dark:border-gray-800 p-6 mb-8">
          <div className="flex items-start justify-between gap-6">
            {/* Left: Avatar + Info */}
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pump-accent to-blue-500 border-3 border-gray-300 dark:border-gray-800 flex items-center justify-center text-white font-bold text-2xl overflow-hidden flex-shrink-0">
                {walletInfo.avatar_url ? (
                  <img
                    src={walletInfo.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  walletInfo.display_name?.[0]?.toUpperCase() || 'U'
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-1">
                  {walletInfo.display_name || 'Unnamed User'}
                </h2>
                
                {/* Wallet Address with Copy & Link */}
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-gray-600 dark:text-gray-400 font-mono text-xs bg-gray-200 dark:bg-gray-900/50 px-2 py-1 rounded">
                    {walletInfo.wallet_address.slice(0, 6)}...{walletInfo.wallet_address.slice(-4)}
                  </p>
                  <button
                    onClick={handleCopyAddress}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <a
                    href={`https://explorer.oasis.io/testnet/sapphire/address/${walletInfo.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 dark:text-pump-green hover:text-green-700 dark:hover:text-pump-green/80 text-xs font-medium transition-colors"
                  >
                    View on Explorer ↗
                  </a>
                </div>

                {/* Bio */}
                {walletInfo.bio && (
                  <p className="text-gray-700 dark:text-gray-300 mb-2 text-sm">{walletInfo.bio}</p>
                )}

                {/* Joined Date */}
                <p className="text-xs text-gray-600 dark:text-gray-500">
                  Joined {new Date(walletInfo.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Right: Edit Button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 bg-green-600 dark:bg-pump-green hover:bg-green-700 dark:hover:bg-pump-green/80 text-white dark:text-black px-4 py-2 rounded-lg font-bold text-sm transition-colors flex-shrink-0"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-300 dark:border-gray-800 flex gap-8 px-4">
          <button className="py-4 px-2 font-bold text-green-600 dark:text-pump-green border-b-2 border-green-600 dark:border-pump-green">
            Balances
          </button>
        </div>

        {/* Balances Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Owned Coins */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              Portfolio ({ownedCoinDetails.length + 1}) {purchasesLoading && <span className="text-xs text-gray-500 animate-pulse">updating...</span>}
            </h3>
            <div className="space-y-3">
              {/* TEST Balance Item */}
              <div className="bg-white dark:bg-gray-900/30 rounded-xl p-4 border border-gray-300 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700 transition-colors flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden">
                  <Image 
                    src="/oasis-logo.svg" 
                    alt="Oasis TEST" 
                    width={48} 
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white">TEST</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatCompactNumber(testBalance)} TEST
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    -
                  </p>
                </div>
              </div>

              {/* Owned Coins - with loading state */}
              {ownedCoinDetails.length > 0 ? (
                ownedCoinDetails.map((coin) => (
                  <div
                    key={coin.contract_address}
                    onClick={() => handleCoinClick(coin, true)}
                    className="bg-white dark:bg-gray-900/30 rounded-xl p-4 border border-gray-300 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all cursor-pointer flex items-center gap-4"
                  >
                    <img
                      src={coin.image_url || 'https://picsum.photos/48/48'}
                      alt={coin.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white">{coin.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatCompactNumber(Number((coin as any).quantity || 0))} {coin.symbol}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCompactNumber(Number(((coin as any).pricePerToken || 0) * ((coin as any).quantity || 0)))} TEST
                      </p>
                    </div>
                  </div>
                ))
              ) : purchasesLoading ? (
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="bg-white dark:bg-gray-900/30 rounded-xl p-4 border border-gray-300 dark:border-gray-800 flex items-center gap-4 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-800 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-300 dark:bg-gray-800 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-gray-300 dark:bg-gray-800 rounded w-1/4" />
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-gray-300 dark:bg-gray-800 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Minted Coins */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              Created Coins ({mintedCoinDetails.length})
            </h3>
            {mintedCoinDetails.length > 0 ? (
              <div className="space-y-3">
                {mintedCoinDetails.map((coin) => (
                  <div
                    key={coin.contract_address}
                    onClick={() => handleCoinClick(coin, false)}
                    className="bg-white dark:bg-gray-900/30 rounded-xl p-4 border border-gray-300 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all cursor-pointer flex items-center gap-4"
                  >
                    <img
                      src={coin.image_url || 'https://picsum.photos/48/48'}
                      alt={coin.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white">{coin.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{coin.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        ${formatCompactNumber(coin.marketcap)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                        {formatRelativeTime(coin.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-900/20 rounded-xl p-8 border border-gray-300 dark:border-gray-800 text-center">
                <p className="text-gray-600 dark:text-gray-400">No coins created yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <EditProfileModal
          walletAddress={walletAddress}
          walletInfo={walletInfo}
          onClose={() => setShowEditModal(false)}
          onSave={handleProfileUpdated}
        />
      )}
    </div>
  );
};

export default ProfilePage;
