export const STELLAR_NETWORK = 'MAINNET' as const;

export const STELLAR_RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://mainnet.sorobanrpc.com';

export const STELLAR_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ||
  'Public Global Stellar Network ; September 2015';

export const STELLAR_HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon.stellar.org';

export const STELLAR_EXPLORER_URL = 'https://stellar.expert/explorer/public';
