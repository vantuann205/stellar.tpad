'use client';

import { useMemo } from 'react';

export function useWallet(address?: string) {
  return useMemo(() => ({ connected: Boolean(address), address }), [address]);
}