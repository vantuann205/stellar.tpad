import { StrKey } from '@stellar/stellar-sdk';

export function validateTradeInput(trade: Record<string, unknown>): void {
  const { buyer_address: buyer, seller_address: seller } = trade;
  if (Boolean(buyer) === Boolean(seller)) throw new Error('exactly one buyer or seller wallet is required');
  if (!StrKey.isValidEd25519PublicKey(String(buyer || seller))) throw new Error('invalid wallet address');
  if (!Number.isInteger(Number(trade.token_id)) || Number(trade.token_id) <= 0) throw new Error('token_id must be a positive integer');
  for (const field of ['quantity', 'price_per_token', 'total_price']) {
    if (!Number.isFinite(Number(trade[field])) || Number(trade[field]) <= 0) throw new Error(`${field} must be positive`);
  }
  if (!/^[a-f0-9]{64}$/i.test(String(trade.transaction_hash || ''))) throw new Error('invalid transaction_hash');
}
