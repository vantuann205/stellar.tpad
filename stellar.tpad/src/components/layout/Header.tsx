'use client';

import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Menu, Search, HelpCircle, LayoutGrid, PlusCircle, Tv, LifeBuoy, X, ChevronDown, Settings, LogOut } from 'lucide-react';
import DolphinLogo from './DolphinLogo';
import ThemeToggle from '../ui/ThemeToggle';
import { ViewState } from '@/types';
import type { Network } from '@/hooks/useNetwork';

interface SearchResult {
  tokens: Array<{
    id: number;
    name: string;
    symbol: string;
    contract_address: string;
    owner: string;
    image_url: string;
  }>;
  wallets: Array<{
    wallet_address: string;
    display_name: string;
    avatar_url: string;
  }>;
}

interface HeaderProps {
  onGoHome: () => void;
  onGoCreate: () => void;
  onGoLivestreams: () => void;
  onGoSupport: () => void;
  onGoProfile: () => void;
  onConnectWallet: () => void;
  onDisconnectWallet?: () => void;
  onSelectToken?: (tokenAddress: string) => void;
  walletConnected: boolean;
  walletAddress?: string;
  currentView: ViewState;
  network: Network;
  onToggleNetwork: () => void;
}

export interface HeaderRef {
  refreshWalletInfo: () => Promise<void>;
}

const Header = forwardRef<HeaderRef, HeaderProps>(({
  onGoHome,
  onGoCreate,
  onGoLivestreams,
  onGoSupport,
  onGoProfile,
  onConnectWallet,
  onDisconnectWallet,
  onSelectToken,
  walletConnected,
  walletAddress,
  currentView,
  network,
  onToggleNetwork,
}, ref) => {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const searchAbortRef = useRef<AbortController | null>(null);

  // A pending debounce or request must not outlive the header.
  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchAbortRef.current?.abort();
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refreshWalletInfo: async () => {
      await fetchWalletInfo();
    }
  }), [walletAddress]);

  // Fetch wallet info when connected
  React.useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchWalletInfo();
    }
  }, [walletConnected, walletAddress]);

  const fetchWalletInfo = async () => {
    try {
      const res = await fetch(`/api/wallets?address=${encodeURIComponent(walletAddress ?? '')}`);
      const data = await res.json();
      if (data.success && data.wallet) {
        setWalletInfo(data.wallet);
      }
    } catch (error) {
      console.error('Error fetching wallet info:', error);
    }
  };

  // Handle search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    // Drop the in-flight request: a slow answer for an earlier query used to
    // land after the newer one and replace the visible results.
    searchAbortRef.current?.abort();

    if (!query.trim()) {
      setSearchResults(null);
      setShowSearchResults(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (data.success) {
          setSearchResults(data.data);
          setShowSearchResults(true);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Error searching:', error);
      } finally {
        if (searchAbortRef.current === controller) {
          searchAbortRef.current = null;
          setSearchLoading(false);
        }
      }
    }, 300);
  };

  const handleSelectToken = (contractAddress: string) => {
    if (onSelectToken) {
      onSelectToken(contractAddress);
    }
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleSelectWallet = (address: string) => {
    setSearchQuery('');
    setShowSearchResults(false);
    // Selecting a user result used to clear the box and go nowhere.
    router.push(`/profile/${address}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 dark:border-gray-800 bg-white dark:bg-pump-bg/95 dark:backdrop-blur dark:supports-[backdrop-filter]:bg-pump-bg/60 transition-colors duration-300">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo Section */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={onGoHome}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
              <DolphinLogo size={32} />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-none">
                Stellar TPAD
              </span>
              <span className="text-[10px] text-gray-600 dark:text-gray-400 font-mono">Stellar Protocol</span>
            </div>
          </div>

          <nav className="hidden xl:flex items-center gap-6 text-sm font-medium">
            <button
              onClick={onGoHome}
              className={`flex items-center gap-2 transition-colors ${currentView === ViewState.GRID || currentView === ViewState.DETAIL
                  ? 'text-gray-900 dark:text-white font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
                }`}
            >
              <LayoutGrid className="w-4 h-4" /> Board
            </button>
            <button
              onClick={onGoLivestreams}
              className={`flex items-center gap-2 transition-colors ${currentView === ViewState.LIVESTREAMS
                  ? 'text-gray-900 dark:text-white font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
                }`}
            >
              <Tv className="w-4 h-4" /> Livestreams
            </button>
            <button
              onClick={onGoCreate}
              className={`flex items-center gap-2 transition-colors ${currentView === ViewState.CREATE
                  ? 'text-gray-900 dark:text-white font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
                }`}
            >
              <PlusCircle className="w-4 h-4" /> Start Coin
            </button>
            <button
              onClick={onGoSupport}
              className={`flex items-center gap-2 transition-colors ${currentView === ViewState.SUPPORT
                  ? 'text-gray-900 dark:text-white font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
                }`}
            >
              <LifeBuoy className="w-4 h-4" /> Support
            </button>
            <button onClick={() => window.open('https://developers.stellar.org/', '_blank')} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
              <HelpCircle className="w-4 h-4" /> Docs
            </button>
          </nav>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md px-8 hidden lg:block">
          <div className="relative group">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors z-10" />
            <input
              type="search"
              placeholder="Search tokens, users, addresses..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchQuery && showSearchResults && setShowSearchResults(true)}
              className="w-full rounded-lg bg-gray-50 dark:bg-pump-card border border-gray-300 dark:border-gray-800 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-600"
            />
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg shadow-lg max-h-96 overflow-y-auto z-40">
                {/* Token Results */}
                {searchResults.tokens && searchResults.tokens.length > 0 && (
                  <div className="border-b border-gray-200 dark:border-gray-700">
                    <div className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tokens</div>
                    {searchResults.tokens.map((token) => (
                      <button
                        key={token.id}
                        onClick={() => handleSelectToken(token.contract_address)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          {token.image_url ? (
                            <img src={token.image_url} alt={token.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                              {token.symbol[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{token.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{token.symbol}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Wallet Results */}
                {searchResults.wallets && searchResults.wallets.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Users</div>
                    {searchResults.wallets.map((wallet) => (
                      <button
                        key={wallet.wallet_address}
                        onClick={() => handleSelectWallet(wallet.wallet_address)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          {wallet.avatar_url ? (
                            <img src={wallet.avatar_url} alt={wallet.display_name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                              {wallet.display_name?.[0]?.toUpperCase() || 'U'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{wallet.display_name || 'Unknown User'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">{wallet.wallet_address.slice(0, 6)}...{wallet.wallet_address.slice(-4)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* No Results */}
                {(!searchResults.tokens || searchResults.tokens.length === 0) &&
                 (!searchResults.wallets || searchResults.wallets.length === 0) && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No results found for &quot;{searchQuery}&quot;</p>
                  </div>
                )}

                {/* Loading State */}
                {searchLoading && (
                  <div className="px-4 py-4 text-center">
                    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400"></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Wallet & Actions */}
        <div className="flex items-center gap-3">
          {/* Network is fixed by deployment configuration. */}
          <button
            onClick={onToggleNetwork}
            disabled
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border border-green-500/50 bg-green-500/10 text-green-400"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {network}
          </button>
          <ThemeToggle />
          {!walletConnected ? (
            <button
              onClick={onConnectWallet}
              className="flex items-center gap-2 bg-white hover:bg-gray-200 dark:bg-white dark:hover:bg-gray-200 text-black px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setWalletMenuOpen(!walletMenuOpen)}>
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {walletInfo?.display_name || 'User'}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-pump-accent to-blue-500 border-2 border-gray-300 dark:border-gray-800 flex items-center justify-center text-white font-bold hover:scale-105 transition-transform overflow-hidden">
                  {walletInfo?.avatar_url ? (
                    <img src={walletInfo.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    walletInfo?.display_name?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${walletMenuOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Wallet Dropdown Menu */}
              {walletMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-pump-card border border-gray-300 dark:border-gray-800 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      onGoProfile();
                      setWalletMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-green-600 dark:text-pump-green hover:bg-green-50 dark:hover:bg-pump-green/10 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      if (onDisconnectWallet) {
                        onDisconnectWallet();
                      }
                      setWalletMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="xl:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-white dark:bg-pump-bg border-b border-gray-300 dark:border-gray-800 p-4 animate-fade-in">
          <nav className="flex flex-col gap-4">
            <button onClick={() => { onGoHome(); setMobileMenuOpen(false); }} className="flex items-center gap-3 text-gray-900 dark:text-white font-bold"><LayoutGrid className="w-5 h-5" /> Board</button>
            <button onClick={() => { onGoCreate(); setMobileMenuOpen(false); }} className="flex items-center gap-3 text-gray-900 dark:text-white font-bold"><PlusCircle className="w-5 h-5" /> Start Coin</button>
            <button onClick={() => window.open('https://developers.stellar.org/', '_blank')} className="flex items-center gap-3 text-gray-600 dark:text-gray-400"><HelpCircle className="w-5 h-5" /> Docs</button>
            {!walletConnected && (
              <button onClick={() => { onConnectWallet(); setMobileMenuOpen(false); }} className="flex items-center gap-3 text-green-600 dark:text-pump-green font-bold border border-green-600/30 dark:border-pump-green/30 rounded-lg p-3 justify-center"><Wallet className="w-5 h-5" /> Connect Wallet</button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
});

Header.displayName = 'Header';

export default Header;
