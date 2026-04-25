import type { WalletSummary } from './wallet.types';

export const hasBalance = (wallet: WalletSummary | null): boolean => Number(wallet?.balance ?? 0) > 0;