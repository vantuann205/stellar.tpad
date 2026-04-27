'use client';

import { useState, useEffect, useCallback } from 'react';

export type Network = 'TESTNET' | 'MAINNET';

const STORAGE_KEY = 'stellar_network';

export function useNetwork() {
  const [network, setNetworkState] = useState<Network>('TESTNET');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Network | null;
    if (saved === 'MAINNET' || saved === 'TESTNET') {
      setNetworkState(saved);
    }
  }, []);

  const setNetwork = useCallback((n: Network) => {
    setNetworkState(n);
    localStorage.setItem(STORAGE_KEY, n);
  }, []);

  const toggle = useCallback(() => {
    setNetworkState(prev => {
      const next = prev === 'TESTNET' ? 'MAINNET' : 'TESTNET';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { network, setNetwork, toggle };
}
