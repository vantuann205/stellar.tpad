'use client';

import { STELLAR_NETWORK } from '@/config/network';

export type Network = 'MAINNET';

export function useNetwork() {
  const network: Network = STELLAR_NETWORK;
  return { network, setNetwork: () => undefined, toggle: () => undefined };
}
