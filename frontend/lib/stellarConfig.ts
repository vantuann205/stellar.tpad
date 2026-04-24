import { Networks } from '@creit.tech/stellar-wallets-kit';

export const STELLAR_TESTNET_RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

export const STELLAR_NETWORK_PASSPHRASE =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE as Networks | undefined) || Networks.TESTNET;
