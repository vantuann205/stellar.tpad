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

const g = globalThis as any;

if (!g.__tokenStore) g.__tokenStore = new Map<string, TokenStoreRecord>();
if (!g.__tradeStore) g.__tradeStore = new Map<string, TradeRecord[]>();

export const tokenStore: Map<string, TokenStoreRecord> = g.__tokenStore;
export const tradeStore: Map<string, TradeRecord[]>    = g.__tradeStore;
