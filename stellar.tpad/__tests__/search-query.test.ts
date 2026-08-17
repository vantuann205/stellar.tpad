import { escapeLikePattern, MAX_SEARCH_LENGTH, normalizeSearchTerm } from '@/lib/search-query';

test('escapes LIKE wildcards so they match literally', () => {
  expect(escapeLikePattern('100%')).toBe('100\\%');
  expect(escapeLikePattern('a_b')).toBe('a\\_b');
  expect(escapeLikePattern('back\\slash')).toBe('back\\\\slash');
  expect(escapeLikePattern('doge')).toBe('doge');
});

test('normalizes a raw query into safe search inputs', () => {
  expect(normalizeSearchTerm('  doge  ')).toEqual({ exact: 'doge', pattern: '%doge%' });
  expect(normalizeSearchTerm('%')).toEqual({ exact: '\\%', pattern: '%\\%%' });
  expect(normalizeSearchTerm('   ')).toBeNull();
  expect(normalizeSearchTerm(null)).toBeNull();
  expect(normalizeSearchTerm('a'.repeat(200))?.exact).toHaveLength(MAX_SEARCH_LENGTH);
});
