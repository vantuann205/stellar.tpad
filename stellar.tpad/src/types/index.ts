export interface Coin {
  id: string | number;
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  creator: string;
  marketCap: number;
  maxReserve?: number;
  replies: number;
  bondingCurveProgress: number; // 0 to 100
  createdAt: number;
  lastReply: number;
  priceHistory: { time: string; price: number }[];
  tokenAddress?: string; // Added for real contract interaction
  contractAddress?: string; // Smart contract address
  volume24h?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange4h?: number;
  priceChange6h?: number;
  traderCount?: number;
  lastTradeType?: 'buy' | 'sell' | null;
}

export interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  type: 'buy' | 'sell' | 'chat';
  amount?: number;
  avatarUrl?: string;
}

export enum ViewState {
  GRID = 'GRID',
  DETAIL = 'DETAIL',
  CREATE = 'CREATE',
  LIVESTREAMS = 'LIVESTREAMS',
  SUPPORT = 'SUPPORT'
}

export interface Trade {
  type: 'buy' | 'sell';
  amount?: number | null;
  price: number;
  totalPrice?: number;
  creatorFee?: number;
  protocolFee?: number;
  totalFee?: number;
  timestamp: string;
  user: string;
  txHash?: string | null;
}

export type SortOption = 'featured' | 'marketCap' | 'lastReply' | 'creationTime';

// Bonding curve state from BondingCurve_Contract
export interface TokenCurveState {
  token_address: string;
  admin: string;
  base_price: bigint;
  slope: bigint;
  total_supply: bigint;
  sold_supply: bigint;
  xlm_reserve: bigint;
  active: boolean;
}

// Trade record stored in in-memory store
export interface TradeRecord {
  id: string;
  tokenId: string;
  type: 'buy' | 'sell';
  tokenAmount: string;  // human-readable token quantity
  xlmAmount: string;    // stroops string
  price: number;        // XLM per token (human-readable)
  fee: string;          // stroops string
  user: string;         // G... address
  txHash: string;
  timestamp: string;    // ISO 8601
}

// OHLCV candle record
export interface OHLCVRecord {
  time: number;    // Unix seconds (bucket start)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;  // XLM (human-readable)
}
