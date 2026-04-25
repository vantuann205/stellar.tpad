// Stellar Soroban Token Contract interface
// Contract functions: initialize, balance, transfer, mint, burn, decimals, name, symbol, admin

export const TOKEN_CONTRACT_METHODS = {
  initialize: 'initialize',
  balance: 'balance',
  transfer: 'transfer',
  mint: 'mint',
  burn: 'burn',
  decimals: 'decimals',
  name: 'name',
  symbol: 'symbol',
  admin: 'admin',
} as const;

// Default supply: 1,000,000,000 tokens with 7 decimals
export const DEFAULT_SUPPLY = BigInt('10000000000000000'); // 1B * 10^7

export const TOKEN_DECIMALS = 7;
