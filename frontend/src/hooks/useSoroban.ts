'use client';

import { getSorobanRpcUrl } from '@/blockchain/providers/soroban.provider';

export function useSoroban() {
  return { rpcUrl: getSorobanRpcUrl() };
}