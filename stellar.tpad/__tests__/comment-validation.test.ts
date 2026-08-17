import {
  ANONYMOUS_AUTHOR,
  MAX_COMMENT_LENGTH,
  normalizeCommentAuthor,
  normalizeCommentText,
  parseTokenId,
} from '@/lib/comment-validation';

const validAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

test('trims comment text and rejects empty or oversized bodies', () => {
  expect(normalizeCommentText('  gm  ')).toBe('gm');
  expect(normalizeCommentText('a'.repeat(MAX_COMMENT_LENGTH))).toHaveLength(MAX_COMMENT_LENGTH);
  expect(() => normalizeCommentText('   ')).toThrow('required');
  expect(() => normalizeCommentText(undefined)).toThrow('required');
  expect(() => normalizeCommentText('a'.repeat(MAX_COMMENT_LENGTH + 1))).toThrow('at most');
});

test('accepts only valid Stellar authors and falls back to anonymous', () => {
  expect(normalizeCommentAuthor(validAddress, undefined)).toBe(validAddress);
  expect(normalizeCommentAuthor(undefined, validAddress)).toBe(validAddress);
  expect(normalizeCommentAuthor(undefined, '')).toBe(ANONYMOUS_AUTHOR);
  expect(() => normalizeCommentAuthor('not-a-wallet')).toThrow('valid Stellar public key');
  expect(() => normalizeCommentAuthor('G'.repeat(300))).toThrow('valid Stellar public key');
});

test('accepts only positive integer token ids', () => {
  expect(parseTokenId('7')).toBe(7);
  expect(() => parseTokenId('0')).toThrow('positive integer');
  expect(() => parseTokenId('-1')).toThrow('positive integer');
  expect(() => parseTokenId('1.5')).toThrow('positive integer');
  expect(() => parseTokenId(null)).toThrow('positive integer');
  expect(() => parseTokenId('CBBOFJ43OHF63NH64LGOWSWYPGETBJKLI44BGPJPQIQIVL3RIVJ2N6M5')).toThrow('positive integer');
});
