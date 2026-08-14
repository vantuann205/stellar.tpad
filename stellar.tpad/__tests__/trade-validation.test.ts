import { validateTradeInput } from '@/lib/trade-validation';

const validTrade = {
  token_id: 1,
  buyer_address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  quantity: '1',
  price_per_token: '0.1',
  total_price: '0.1',
  transaction_hash: 'a'.repeat(64),
};

test('accepts a complete trade and rejects forged fields', () => {
  expect(() => validateTradeInput(validTrade)).not.toThrow();
  expect(() => validateTradeInput({ ...validTrade, transaction_hash: 'fake' })).toThrow('transaction_hash');
  expect(() => validateTradeInput({ ...validTrade, buyer_address: 'not-a-wallet' })).toThrow('wallet');
  expect(() => validateTradeInput({ ...validTrade, seller_address: validTrade.buyer_address })).toThrow('exactly one');
  expect(() => validateTradeInput({ ...validTrade, quantity: 0 })).toThrow('positive');
});
