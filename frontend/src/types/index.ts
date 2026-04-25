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

declare global {
  interface Window {
    freighterApi?: unknown;
    rabet?: unknown;
  }
}
