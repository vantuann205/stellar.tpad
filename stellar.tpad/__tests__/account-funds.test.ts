import {
  accountFundsFromHorizon,
  checkAffordable,
  describeSubmitError,
  minimumReserve,
  stroopsToXlm,
  transactionResultCode,
  xlmToStroops,
  BASE_RESERVE_STROOPS,
} from '@/features/bonding-curve/account-funds';

/** The exact payload the network returned when a sell failed. */
const insufficientBalanceResult = {
  _maxDepth: 200,
  _attributes: {
    feeCharged: { _value: '42597' },
    result: { _maxDepth: 200, _switch: { name: 'txInsufficientBalance', value: -7 } },
    ext: { _maxDepth: 200, _switch: 0 },
  },
};

describe('xlmToStroops', () => {
  it('converts whole and fractional XLM', () => {
    expect(xlmToStroops('1')).toBe(10_000_000n);
    expect(xlmToStroops('0.5')).toBe(5_000_000n);
    expect(xlmToStroops('1.0000001')).toBe(10_000_001n);
    expect(xlmToStroops('0')).toBe(0n);
  });

  it('pads a short fraction rather than misreading it', () => {
    // "1.5" is 1.5 XLM, not 1.0000015.
    expect(xlmToStroops('1.5')).toBe(15_000_000n);
  });

  it('ignores precision Stellar cannot represent', () => {
    expect(xlmToStroops('1.23456789')).toBe(12_345_678n);
  });

  it('refuses input that is not a number', () => {
    expect(() => xlmToStroops('abc')).toThrow();
    expect(() => xlmToStroops('-1')).toThrow();
  });
});

describe('stroopsToXlm', () => {
  it('round-trips', () => {
    for (const value of ['0', '1', '0.5', '1.0000001', '12345.678']) {
      expect(stroopsToXlm(xlmToStroops(value))).toBe(value);
    }
  });

  it('trims trailing zeros', () => {
    expect(stroopsToXlm(10_000_000n)).toBe('1');
    expect(stroopsToXlm(15_000_000n)).toBe('1.5');
  });
});

describe('minimumReserve', () => {
  it('is 1 XLM for a plain account', () => {
    expect(minimumReserve(0)).toBe(2n * BASE_RESERVE_STROOPS);
    expect(stroopsToXlm(minimumReserve(0))).toBe('1');
  });

  it('adds half an XLM per subentry', () => {
    expect(stroopsToXlm(minimumReserve(2))).toBe('2');
  });

  it('charges the sponsor rather than the sponsored account', () => {
    expect(minimumReserve(0, 4, 0)).toBeGreaterThan(minimumReserve(0));
    expect(minimumReserve(4, 0, 4)).toBe(minimumReserve(0));
  });

  it('never falls below the two-entry base', () => {
    // More sponsored entries than owned must not produce a negative reserve.
    expect(minimumReserve(0, 0, 10)).toBe(2n * BASE_RESERVE_STROOPS);
  });
});

describe('accountFundsFromHorizon', () => {
  it('separates the reserve from what can be spent', () => {
    const funds = accountFundsFromHorizon({
      balances: [
        { asset_type: 'credit_alphanum4', balance: '500' },
        { asset_type: 'native', balance: '2.5' },
      ],
      subentry_count: 0,
    });

    expect(stroopsToXlm(funds.balance)).toBe('2.5');
    expect(stroopsToXlm(funds.reserve)).toBe('1');
    expect(stroopsToXlm(funds.spendable)).toBe('1.5');
  });

  it('reports zero spendable rather than a negative number', () => {
    // This is the wallet in the bug report: it has XLM, but none of it is free.
    const funds = accountFundsFromHorizon({
      balances: [{ asset_type: 'native', balance: '1.0000042' }],
      subentry_count: 0,
    });

    expect(funds.spendable).toBe(42n);
  });

  it('treats a missing native balance as zero', () => {
    expect(accountFundsFromHorizon({ balances: [] }).balance).toBe(0n);
    expect(accountFundsFromHorizon({}).spendable).toBe(0n);
  });
});

describe('checkAffordable', () => {
  const funds = accountFundsFromHorizon({
    balances: [{ asset_type: 'native', balance: '1.004' }],
    subentry_count: 0,
  });

  it('refuses the fee that produced the reported failure', () => {
    // 42,597 stroops of fee against 40,000 stroops of spendable balance.
    const result = checkAffordable(funds, 42_597n);
    expect(result.ok).toBe(false);
  });

  it('names the shortfall so the message is actionable', () => {
    const result = checkAffordable(funds, 42_597n);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.reason).toContain('0.0042597');
    expect(result.reason).toContain('0.004');
    expect(result.reason).toContain('1');
  });

  it('allows a trade the balance covers', () => {
    expect(checkAffordable(funds, 30_000n).ok).toBe(true);
  });

  it('treats exactly enough as enough', () => {
    expect(checkAffordable(funds, funds.spendable).ok).toBe(true);
  });
});

describe('transactionResultCode', () => {
  it('reads the code out of the XDR wrapper', () => {
    expect(transactionResultCode(insufficientBalanceResult)).toBe('txInsufficientBalance');
  });

  it('returns null for anything else', () => {
    expect(transactionResultCode(null)).toBeNull();
    expect(transactionResultCode({})).toBeNull();
    expect(transactionResultCode('boom')).toBeNull();
  });
});

describe('describeSubmitError', () => {
  it('explains the reserve instead of printing XDR', () => {
    const message = describeSubmitError(insufficientBalanceResult);
    expect(message).toContain('XLM');
    expect(message).toContain('1 XLM per account');
    expect(message).not.toContain('_maxDepth');
    expect(message).not.toContain('_switch');
  });

  it('covers the other codes a trader can actually hit', () => {
    const cases: Record<string, RegExp> = {
      txInsufficientFee: /busy|fee/i,
      txBadSeq: /stale|refresh/i,
      txNoAccount: /funded/i,
      txTooLate: /expired/i,
      txFailed: /slippage|rejected/i,
    };
    for (const [name, pattern] of Object.entries(cases)) {
      const message = describeSubmitError({ _attributes: { result: { _switch: { name } } } });
      expect(message).toMatch(pattern);
    }
  });

  it('still says something useful for an unknown code', () => {
    const message = describeSubmitError({
      _attributes: { result: { _switch: { name: 'txSomethingNew' } } },
    });
    expect(message).toContain('txSomethingNew');
  });

  it('does not throw on a malformed result', () => {
    expect(() => describeSubmitError(undefined)).not.toThrow();
    expect(describeSubmitError(undefined)).toBeTruthy();
  });
});
