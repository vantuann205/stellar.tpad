export const CONTRACT_CONFIG = {
  token: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID ?? '',
  bondingCurve: process.env.NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID ?? '',
};

// Deployment-specific addresses. Mainnet values are supplied by Railway after deployment.
export const XLM_NATIVE_CONTRACT = process.env.NEXT_PUBLIC_XLM_CONTRACT_ID ?? '';
export const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? '';
export const BONDING_CURVE_CONTRACT = process.env.NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID ?? '';
export const MINT_FEE_XLM = 1; // 1 XLM mint fee
export const TRADE_FEE_BPS = 100; // 1% = 100 basis points
