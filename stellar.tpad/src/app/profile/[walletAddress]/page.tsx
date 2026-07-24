'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Copy, Edit2 } from 'lucide-react';
import EditProfileModal from '@/components/ui/EditProfileModal';
import { ViewState } from '@/types';
import AppHeaderShell from '@/components/layout/AppHeaderShell';
import { STELLAR_EXPLORER_URL, STELLAR_HORIZON_URL } from '@/config/network';

const XLM_ICON_URL = 'https://www.binance.com/bapi/fe/resource/image?image=aHR0cHM6Ly9wdWJsaWMuYm5ic3RhdGljLmNvbS9zdGF0aWMvYWNhZGVteS91cGxvYWRzLW9yaWdpbmFsL2U2ZTA2MDk0YTEyMzQ3ZGFhZDNjMGIyODUyYWMwMDUzLnBuZw==&level=lg';

interface PageProps {
  params: Promise<{
    walletAddress: string;
  }>;
}

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

interface TokenInfo {
  id: number;
  name: string;
  symbol: string;
  contract_address: string;
  image_url: string | null;
  marketcap?: number | null;
  created_at?: string;
}

interface OwnedToken extends TokenInfo {
  quantity: number;
  pricePerToken: number;
}

interface PurchaseRecord {
  buyer_address: string | null;
  seller_address: string | null;
  quantity: number | string;
  price_per_token: number | string;
  contract_address: string;
}

export default function ProfilePage({ params }: PageProps) {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState('');
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [xlmBalance, setXlmBalance] = useState(0);
  const [ownedTokenDetails, setOwnedTokenDetails] = useState<OwnedToken[]>([]);
  const [mintedTokenDetails, setMintedTokenDetails] = useState<TokenInfo[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatCompactNumber = useMemo(
    () =>
      (num: unknown) => {
        const value = typeof num === 'string' ? parseFloat(num) : Number(num);
        if (Number.isNaN(value)) return '0';
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
        return value.toFixed(2);
      },
    []
  );

  const formatRelativeTime = useMemo(
    () =>
      (dateString?: string) => {
        if (!dateString) return 'unknown';
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return `${Math.floor(seconds / 604800)}w ago`;
      },
    []
  );

  const fetchXlmBalance = useCallback(async (address: string) => {
    try {
      const response = await fetch(`${STELLAR_HORIZON_URL}/accounts/${address}`);
      if (!response.ok) {
        setXlmBalance(0);
        return;
      }

      const data = await response.json();
      const native = Array.isArray(data.balances)
        ? data.balances.find((b: { asset_type?: string; balance?: string }) => b.asset_type === 'native')
        : null;

      setXlmBalance(native?.balance ? parseFloat(native.balance) : 0);
    } catch {
      setXlmBalance(0);
    }
  }, []);

  const fetchPurchaseDetails = useCallback(async (address: string, tokens: TokenInfo[]) => {
    try {
      const purchasesRes = await fetch(`/api/purchases?wallet_address=${address}`);
      const purchasesData = await purchasesRes.json();
      const purchases: PurchaseRecord[] = Array.isArray(purchasesData.data) ? purchasesData.data : [];

      const tokensWithQuantity: OwnedToken[] = tokens
        .map((token) => {
          let totalBought = 0;
          let totalSold = 0;
          let avgPrice = 0;

          const tokenPurchases = purchases.filter(
            (p) => p.contract_address && p.contract_address.toLowerCase() === token.contract_address.toLowerCase()
          );

          for (const purchase of tokenPurchases) {
            const qty = Number(purchase.quantity) || 0;
            if (purchase.buyer_address?.toLowerCase() === address.toLowerCase()) {
              totalBought += qty;
            }
            if (purchase.seller_address?.toLowerCase() === address.toLowerCase()) {
              totalSold += qty;
            }
          }

          const buyTransaction = tokenPurchases.find(
            (p) => p.buyer_address?.toLowerCase() === address.toLowerCase()
          );
          avgPrice = buyTransaction ? Number(buyTransaction.price_per_token) || 0 : 0;

          return {
            ...token,
            quantity: Math.max(0, totalBought - totalSold),
            pricePerToken: avgPrice,
          };
        })
        .filter((token) => token.quantity > 0);

      setOwnedTokenDetails(tokensWithQuantity);
    } catch {
      setOwnedTokenDetails([]);
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  const fetchWalletInfo = useCallback(
    async (address: string) => {
      try {
        const walletRes = await fetch(`/api/wallets?address=${address}`);
        const walletData = await walletRes.json();

        if (!walletData.success || !walletData.wallet) {
          setInitialLoadDone(true);
          return;
        }

        const wallet: WalletInfo = walletData.wallet;
        setWalletInfo(wallet);
        fetchXlmBalance(address);

        const tokenRes = await fetch('/api/tokens');
        const tokenData = await tokenRes.json();

        if (!tokenData.success || !Array.isArray(tokenData.data)) {
          setInitialLoadDone(true);
          return;
        }

        const allTokens: TokenInfo[] = tokenData.data;
        const owned = allTokens.filter((token) => wallet.owned_coins?.includes(token.contract_address));
        const minted = allTokens.filter((token) => wallet.minted_coins?.includes(token.contract_address));

        setMintedTokenDetails(minted);
        setInitialLoadDone(true);

        if (owned.length > 0) {
          setPurchasesLoading(true);
          fetchPurchaseDetails(address, owned);
        } else {
          setOwnedTokenDetails([]);
        }
      } catch {
        setInitialLoadDone(true);
      }
    },
    [fetchPurchaseDetails, fetchXlmBalance]
  );

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const resolved = await params;
      if (!mounted) return;
      const decoded = decodeURIComponent(resolved.walletAddress);
      setWalletAddress(decoded);
      fetchWalletInfo(decoded);
    };
    init();

    return () => {
      mounted = false;
    };
  }, [params, fetchWalletInfo]);

  const handleProfileUpdated = () => {
    setShowEditModal(false);
    if (walletAddress) {
      fetchWalletInfo(walletAddress);
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  };

  if (!initialLoadDone) {
    return (
      <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-white">
        <AppHeaderShell currentView={ViewState.DETAIL} />
        <div className="p-4 flex items-center justify-center">
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!walletInfo) {
    return (
      <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-white">
        <AppHeaderShell currentView={ViewState.DETAIL} />
        <div className="p-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-green-600 dark:text-pump-green hover:text-green-700 dark:hover:text-pump-green/80 transition-colors mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <p className="text-gray-600 dark:text-gray-400">Failed to load profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-pump-bg text-gray-900 dark:text-white">
      <AppHeaderShell currentView={ViewState.DETAIL} />

      <div className="container mx-auto px-4 py-8">
        <div className="bg-gradient-to-b from-gray-100 dark:from-gray-900/50 to-white dark:to-pump-card rounded-xl border border-gray-300 dark:border-gray-800 p-6 mb-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pump-accent to-blue-500 border-3 border-gray-300 dark:border-gray-800 flex items-center justify-center text-white font-bold text-2xl overflow-hidden flex-shrink-0">
                {walletInfo.avatar_url ? (
                  <img src={walletInfo.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  walletInfo.display_name?.[0]?.toUpperCase() || 'U'
                )}
              </div>

              <div className="flex-1">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-1">
                  {walletInfo.display_name || 'Unnamed User'}
                </h2>

                <div className="flex items-center gap-2 mb-2">
                  <p className="text-gray-600 dark:text-gray-400 font-mono text-xs bg-gray-200 dark:bg-gray-900/50 px-2 py-1 rounded">
                    {walletInfo.wallet_address.slice(0, 6)}...{walletInfo.wallet_address.slice(-4)}
                  </p>
                  <button
                    onClick={handleCopyAddress}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Copy address"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <a
                    href={`${STELLAR_EXPLORER_URL}/account/${walletInfo.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 dark:text-pump-green hover:text-green-700 dark:hover:text-pump-green/80 text-xs font-medium transition-colors"
                  >
                    View on Explorer ↗
                  </a>
                </div>

                {walletInfo.bio && (
                  <p className="text-gray-700 dark:text-gray-300 mb-2 text-sm">{walletInfo.bio}</p>
                )}

                <p className="text-xs text-gray-600 dark:text-gray-500">
                  Joined {new Date(walletInfo.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 bg-green-600 dark:bg-pump-green hover:bg-green-700 dark:hover:bg-pump-green/80 text-white dark:text-black px-4 py-2 rounded-lg font-bold text-sm transition-colors flex-shrink-0"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="mb-8 border-b border-gray-300 dark:border-gray-800 flex gap-8 px-4">
          <button className="py-4 px-2 font-bold text-green-600 dark:text-pump-green border-b-2 border-green-600 dark:border-pump-green">
            Balances
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              Portfolio ({ownedTokenDetails.length + 1})
              {purchasesLoading && <span className="text-xs text-gray-500 animate-pulse">updating...</span>}
            </h3>
            <div className="space-y-3">
              <div className="bg-white dark:bg-gray-900/30 rounded-xl p-4 border border-gray-300 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700 transition-colors flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img src={XLM_ICON_URL} alt="Stellar XLM" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white">XLM</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatCompactNumber(xlmBalance)} XLM</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">-</p>
                </div>
              </div>

              {ownedTokenDetails.length > 0 ? (
                ownedTokenDetails.map((token) => (
                  <button
                    key={token.contract_address}
                    onClick={() => router.push(`/token/${token.contract_address}`)}
                    className="w-full text-left bg-white dark:bg-gray-900/30 rounded-xl p-4 border border-gray-300 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all cursor-pointer flex items-center gap-4"
                  >
                    <img
                      src={token.image_url || XLM_ICON_URL}
                      alt={token.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white">{token.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatCompactNumber(token.quantity)} {token.symbol}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCompactNumber(token.pricePerToken * token.quantity)} XLM
                      </p>
                    </div>
                  </button>
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

          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              Created Coins ({mintedTokenDetails.length})
            </h3>
            {mintedTokenDetails.length > 0 ? (
              <div className="space-y-3">
                {mintedTokenDetails.map((token) => (
                  <button
                    key={token.contract_address}
                    onClick={() => router.push(`/token/${token.contract_address}`)}
                    className="w-full text-left bg-white dark:bg-gray-900/30 rounded-xl p-4 border border-gray-300 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all cursor-pointer flex items-center gap-4"
                  >
                    <img
                      src={token.image_url || XLM_ICON_URL}
                      alt={token.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white">{token.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{token.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        ${formatCompactNumber(token.marketcap || 0)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">{formatRelativeTime(token.created_at)}</p>
                    </div>
                  </button>
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

      {showEditModal && walletAddress && (
        <EditProfileModal
          walletAddress={walletAddress}
          walletInfo={walletInfo}
          onClose={() => setShowEditModal(false)}
          onSave={handleProfileUpdated}
        />
      )}
    </div>
  );
}
