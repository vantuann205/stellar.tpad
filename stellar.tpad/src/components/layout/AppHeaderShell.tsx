'use client';

import { useEffect, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { ViewState } from '@/types';
import { stellarWalletService, WalletServiceError } from '@/services/wallet.service';
import { initialWalletState, walletStateReducer } from '@/store/wallet.store';

interface AppHeaderShellProps {
  currentView?: ViewState;
}

export default function AppHeaderShell({ currentView = ViewState.DETAIL }: AppHeaderShellProps) {
  const router = useRouter();
  const [walletState, dispatchWallet] = useReducer(walletStateReducer, initialWalletState);

  useEffect(() => {
    stellarWalletService.restoreSession().then((session) => {
      if (!session) return;
      dispatchWallet({ type: 'connected', payload: { provider: session.provider, address: session.address } });
    });
  }, []);

  const handleConnectWallet = async () => {
    dispatchWallet({ type: 'connecting' });
    try {
      const { provider, address } = await stellarWalletService.connect();
      dispatchWallet({ type: 'connected', payload: { provider, address } });
    } catch (error) {
      const code = error instanceof WalletServiceError ? error.code : 'unknown';
      dispatchWallet({ type: 'error', payload: { errorCode: code } });
    }
  };

  const handleDisconnectWallet = async () => {
    await stellarWalletService.disconnect();
    dispatchWallet({ type: 'disconnected' });
  };

  return (
    <Header
      onGoHome={() => router.push('/')}
      onGoCreate={() => router.push('/?view=create')}
      onGoLivestreams={() => router.push('/?view=livestreams')}
      onGoSupport={() => router.push('/?view=support')}
      onGoProfile={() => {
        if (walletState.address) {
          router.push(`/profile/${walletState.address}`);
        }
      }}
      onConnectWallet={handleConnectWallet}
      onDisconnectWallet={handleDisconnectWallet}
      onSelectToken={(addr) => router.push(`/token/${addr}`)}
      walletConnected={walletState.status === 'connected'}
      walletAddress={walletState.address}
      currentView={currentView}
    />
  );
}