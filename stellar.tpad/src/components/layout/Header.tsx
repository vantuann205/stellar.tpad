'use client';

import React, { forwardRef, useImperativeHandle } from 'react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { ViewState } from '@/types';

interface HeaderProps {
  onGoHome: () => void;
  onGoCreate: () => void;
  onGoLivestreams: () => void;
  onGoSupport: () => void;
  onConnectWallet: () => void;
  onDisconnectWallet?: () => void;
  onSelectToken?: (tokenAddress: string) => void;
  walletConnected: boolean;
  walletAddress?: string;
  currentView: ViewState;
}

export interface HeaderRef {
  refreshWalletInfo: () => Promise<void>;
}

const Header = forwardRef<HeaderRef, HeaderProps>((props, ref) => {
  useImperativeHandle(ref, () => ({
    refreshWalletInfo: async () => {
      return;
    },
  }));

  const navButtonClass = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
        : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/80'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-[#10141f]/90">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <button onClick={props.onGoHome} className="text-base font-bold tracking-wide text-slate-900 dark:text-white">
          Stellar Tpad
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          <button
            onClick={props.onGoHome}
            className={navButtonClass(props.currentView === ViewState.GRID || props.currentView === ViewState.DETAIL)}
          >
            Board
          </button>
          <button
            onClick={props.onGoCreate}
            className={navButtonClass(props.currentView === ViewState.CREATE)}
          >
            Create
          </button>
          <button
            onClick={props.onGoLivestreams}
            className={navButtonClass(props.currentView === ViewState.LIVESTREAMS)}
          >
            Livestreams
          </button>
          <button
            onClick={props.onGoSupport}
            className={navButtonClass(props.currentView === ViewState.SUPPORT)}
          >
            Support
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!props.walletConnected ? (
            <button
              onClick={props.onConnectWallet}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={props.onDisconnectWallet}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;
