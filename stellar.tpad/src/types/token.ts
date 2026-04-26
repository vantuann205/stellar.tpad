/**
 * Token database record type
 */
export interface TokenRecord {
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
  price_change_1h?: number;
  price_change_4h?: number;
  price_change_6h?: number;
  price_change_24h?: number;
  marketcap?: number;
  trader_count?: number;
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
