import {
  checkTradeAmount,
  portionOfBalance,
  toRawWholeTokens,
  wholeTokensFromRaw,
  MIN_TRADE_RAW,
  TOKEN_SCALE,
} from '@/features/bonding-curve/token-amount';

/** Mirrors `validate_token_amount` in the bonding-curve contract. */
const contractAccepts = (raw: bigint) => raw > 0n && raw % TOKEN_SCALE === 0n;

describe('toRawWholeTokens', () => {
  it('scales whole tokens', () => {
    expect(toRawWholeTokens(1)).toBe(10_000_000n);
    expect(toRawWholeTokens(250)).toBe(2_500_000_000n);
  });

  it('rounds down rather than up', () => {
    // Rounding up would trade more than the person asked for.
    expect(toRawWholeTokens(1.9)).toBe(10_000_000n);
    expect(toRawWholeTokens(12.34)).toBe(120_000_000n);
  });

  it('returns zero for amounts under one token', () => {
    expect(toRawWholeTokens(0.5)).toBe(0n);
    expect(toRawWholeTokens(0.9999)).toBe(0n);
  });

  it('refuses nonsense without throwing', () => {
    expect(toRawWholeTokens(0)).toBe(0n);
    expect(toRawWholeTokens(-5)).toBe(0n);
    expect(toRawWholeTokens(NaN)).toBe(0n);
    expect(toRawWholeTokens('abc')).toBe(0n);
    expect(toRawWholeTokens(Infinity)).toBe(0n);
  });

  it('only ever produces amounts the contract accepts', () => {
    for (const input of [1, 2.5, 12.34, 999.999, '7', '0.5']) {
      const raw = toRawWholeTokens(input);
      if (raw > 0n) expect(contractAccepts(raw)).toBe(true);
    }
  });
});

describe('the bug this replaces', () => {
  it('shows why Math.floor(num * 1e7) failed', () => {
    // What the component used to do:
    const old = BigInt(Math.floor(0.5 * 1e7));
    expect(old).toBe(5_000_000n);
    expect(contractAccepts(old)).toBe(false); // InvalidPrecision

    // And what the MAX button produced from a real balance:
    const oldMax = BigInt(Math.floor(Number('12.34') * 1e7));
    expect(contractAccepts(oldMax)).toBe(false);

    // Both are now refused before a signature is requested.
    expect(checkTradeAmount(0.5).error).toBeTruthy();
    expect(checkTradeAmount(12.34).rounded).toBe(true);
  });
});

describe('wholeTokensFromRaw', () => {
  it('floors a raw balance to whole tokens', () => {
    expect(wholeTokensFromRaw(123_400_000n)).toBe(12);
    expect(wholeTokensFromRaw(9_999_999n)).toBe(0);
    expect(wholeTokensFromRaw(10_000_000n)).toBe(1);
  });

  it('accepts the numeric and string balances the component holds', () => {
    expect(wholeTokensFromRaw(50_000_000)).toBe(5);
    expect(wholeTokensFromRaw('50000000')).toBe(5);
    expect(wholeTokensFromRaw('')).toBe(0);
  });
});

describe('portionOfBalance', () => {
  const balance = 123_400_000n; // 12.34 tokens

  it('returns whole tokens for the quick buttons', () => {
    expect(portionOfBalance(balance, 0.25)).toBe(3);
    expect(portionOfBalance(balance, 0.5)).toBe(6);
    expect(portionOfBalance(balance, 1)).toBe(12);
  });

  it('never exceeds the balance', () => {
    expect(portionOfBalance(balance, 2)).toBe(12);
  });

  it('is zero when the balance holds less than one token', () => {
    expect(portionOfBalance(9_000_000n, 1)).toBe(0);
  });

  it('always yields something the contract accepts', () => {
    for (const pct of [0.1, 0.25, 0.5, 0.75, 1]) {
      const tokens = portionOfBalance(balance, pct);
      if (tokens > 0) expect(contractAccepts(toRawWholeTokens(tokens))).toBe(true);
    }
  });
});

describe('checkTradeAmount', () => {
  it('accepts a whole token', () => {
    const result = checkTradeAmount(5);
    expect(result.error).toBeNull();
    expect(result.raw).toBe(50_000_000n);
    expect(result.rounded).toBe(false);
  });

  it('explains the one-token floor instead of failing on chain', () => {
    const result = checkTradeAmount(0.5);
    expect(result.error).toContain('whole tokens');
    expect(result.error).toContain('1 token');
    expect(result.raw).toBeLessThan(MIN_TRADE_RAW);
  });

  it('flags a fractional entry as rounded so the interface can say so', () => {
    const result = checkTradeAmount(12.34);
    expect(result.error).toBeNull();
    expect(result.rounded).toBe(true);
    expect(result.tokens).toBe(12);
  });

  it('refuses to sell more than the balance holds', () => {
    const result = checkTradeAmount(20, 123_400_000n);
    expect(result.error).toContain('12');
  });

  it('allows selling the whole balance', () => {
    expect(checkTradeAmount(12, 123_400_000n).error).toBeNull();
  });

  it('rejects an empty or negative entry', () => {
    expect(checkTradeAmount('').error).toBeTruthy();
    expect(checkTradeAmount(-1).error).toBeTruthy();
    expect(checkTradeAmount(0).error).toBeTruthy();
  });
});
