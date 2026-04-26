/**
 * Shared in-memory stores — imported by API routes.
 * Using globalThis to survive Next.js hot-reload.
 * No imports from route files to avoid circular deps.
 */
import type { TradeRecord } from '@/types';

// TokenRecord shape (duplicated here to avoid circular import from route file)
export interface TokenStoreRecord {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image_url: string;
  social_link: string;
  total_supply: string;
  owner: string;
  contract_address: string;
  created_at: string;
  bonding_curve_contract?: string;
  bonding_curve_registered?: boolean;
  current_price?: number;
  volume_24h?: number;
  price_change_5m?: number;
  sold_supply?: string;
}

export interface CommentRecord {
  id: string;
  token_id: string;
  user_address: string;
  comment_text: string;
  avatar_url: string | null;
  created_at: string;
}

const g = globalThis as any;

if (!g.__tokenStore) g.__tokenStore = new Map<string, TokenStoreRecord>();
if (!g.__tradeStore) g.__tradeStore = new Map<string, TradeRecord[]>();
if (!g.__commentStore) g.__commentStore = new Map<string, CommentRecord[]>();

export const tokenStore: Map<string, TokenStoreRecord> = g.__tokenStore;
export const tradeStore: Map<string, TradeRecord[]>    = g.__tradeStore;
export const commentStore: Map<string, CommentRecord[]> = g.__commentStore;

// Helper functions for stores
export async function getTokenStore() {
  return {
    getByContractAddress: (address: string) => {
      return Array.from(tokenStore.values()).find(
        t => t.contract_address.toLowerCase() === address.toLowerCase()
      );
    },
    getById: (id: string) => tokenStore.get(id),
    getAll: () => Array.from(tokenStore.values()),
  };
}

export async function getTradeStore() {
  return {
    getByTokenId: (tokenId: string) => tradeStore.get(tokenId) || [],
    add: (tokenId: string, trade: TradeRecord) => {
      const trades = tradeStore.get(tokenId) || [];
      trades.push(trade);
      tradeStore.set(tokenId, trades);
    },
  };
}

export async function getCommentStore() {
  return {
    getByTokenId: (tokenId: string) => commentStore.get(tokenId) || [],
    create: (comment: Omit<CommentRecord, 'id' | 'created_at'>) => {
      const tokenId = comment.token_id;
      const comments = commentStore.get(tokenId) || [];
      const newComment: CommentRecord = {
        ...comment,
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
      };
      comments.push(newComment);
      commentStore.set(tokenId, comments);
      return newComment;
    },
  };
}
