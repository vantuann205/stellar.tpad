import { TOKEN_LIMITS, TokenValidationError, validateTokenInput } from '@/lib/token-validation';

const validBody = {
  name: 'Dolphin',
  symbol: 'DOLP',
  description: 'A friendly token',
  image_url: 'https://cdn.example.com/dolphin.png',
  social_link: 'x.com/dolphin',
  totalSupply: '1000000000',
  owner: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  contractAddress: 'CBBOFJ43OHF63NH64LGOWSWYPGETBJKLI44BGPJPQIQIVL3RIVJ2N6M5',
};

test('accepts a complete token payload and normalizes links', () => {
  const parsed = validateTokenInput({ ...validBody });
  expect(parsed.name).toBe('Dolphin');
  expect(parsed.totalSupply).toBe(1_000_000_000);
  expect(parsed.socialLink).toBe('https://x.com/dolphin');
  expect(parsed.imageUrl).toBe('https://cdn.example.com/dolphin.png');
});

test('rejects forged addresses and unusable supplies', () => {
  expect(() => validateTokenInput({ ...validBody, owner: 'not-a-wallet' })).toThrow('valid Stellar public key');
  expect(() => validateTokenInput({ ...validBody, contractAddress: validBody.owner })).toThrow('contract id');
  expect(() => validateTokenInput({ ...validBody, totalSupply: '0' })).toThrow('positive number');
  expect(() => validateTokenInput({ ...validBody, totalSupply: 'abc' })).toThrow(TokenValidationError);
});

test('rejects missing text, oversized text, and dangerous links', () => {
  expect(() => validateTokenInput({ ...validBody, name: '   ' })).toThrow('name is required');
  expect(() => validateTokenInput({ ...validBody, symbol: 'S'.repeat(TOKEN_LIMITS.symbol + 1) })).toThrow('at most');
  expect(() => validateTokenInput({ ...validBody, social_link: 'javascript:alert(1)' })).toThrow('http or https');
});
