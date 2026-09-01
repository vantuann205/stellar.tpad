/**
 * The bonding curve trades whole tokens only.
 *
 * `validate_token_amount` in the contract rejects anything that is not an exact
 * multiple of the 7-decimal scale, and `calc_sell_proceeds` divides by that
 * scale before pricing — so a fractional amount is refused outright, and an
 * amount under one token would be priced at zero even if it were not.
 *
 * The interface, however, was working in fractions: it built raw units with
 * `Math.floor(num * 1e7)` and its percentage buttons produced values like
 * `12.34`. Every one of those reached the contract as an invalid amount and
 * came back as an opaque `InvalidPrecision` panic.
 */

/** Stroop-style scale for a 7-decimal token, matching `SCALE` in the contract. */
export const TOKEN_SCALE = 10_000_000n;

/** The smallest amount the curve will price: exactly one token. */
export const MIN_TRADE_RAW = TOKEN_SCALE;

/**
 * Converts a user-entered token amount into raw units the contract accepts.
 *
 * Rounds **down** to a whole token. Rounding up would spend or sell more than
 * the person asked for, which is never the safe direction with money.
 */
export function toRawWholeTokens(input: number | string): bigint {
  const value = typeof input === 'string' ? Number(input) : input;
  if (!Number.isFinite(value) || value <= 0) return 0n;
  return BigInt(Math.floor(value)) * TOKEN_SCALE;
}

/** Raw balance to the largest whole number of tokens it contains. */
export function wholeTokensFromRaw(raw: bigint | number | string): number {
  const value = typeof raw === 'bigint' ? raw : BigInt(Math.floor(Number(raw) || 0));
  return Number(value / TOKEN_SCALE);
}

/**
 * A fraction of a balance, floored to whole tokens.
 *
 * Used by the 25% / 50% / MAX buttons, which previously produced two decimal
 * places and therefore an amount the contract would refuse.
 */
export function portionOfBalance(rawBalance: bigint | number | string, fraction: number): number {
  const whole = wholeTokensFromRaw(rawBalance);
  if (!Number.isFinite(fraction) || fraction <= 0) return 0;
  return Math.floor(whole * Math.min(fraction, 1));
}

export interface AmountCheck {
  /** Raw units to send to the contract. */
  raw: bigint;
  /** Whole tokens the raw value represents. */
  tokens: number;
  /** Null when the amount is tradeable. */
  error: string | null;
  /** True when the entry was rounded down, so the interface can say so. */
  rounded: boolean;
}

/**
 * Decides whether an entered amount can be traded, and what will actually be
 * traded if it can.
 */
export function checkTradeAmount(
  input: number | string,
  rawBalance?: bigint | number | string,
): AmountCheck {
  const value = typeof input === 'string' ? Number(input) : input;

  if (!Number.isFinite(value) || value <= 0) {
    return { raw: 0n, tokens: 0, error: 'Enter an amount to trade.', rounded: false };
  }

  const raw = toRawWholeTokens(value);
  const tokens = Number(raw / TOKEN_SCALE);
  const rounded = tokens !== value;

  if (raw < MIN_TRADE_RAW) {
    return {
      raw,
      tokens,
      rounded,
      error:
        'The curve trades whole tokens, so the smallest trade is 1 token. ' +
        `Enter 1 or more instead of ${value}.`,
    };
  }

  if (rawBalance !== undefined) {
    const balance = typeof rawBalance === 'bigint' ? rawBalance : BigInt(Math.floor(Number(rawBalance) || 0));
    if (raw > balance) {
      return {
        raw,
        tokens,
        rounded,
        error: `You hold ${wholeTokensFromRaw(balance)} whole tokens, which is less than ${tokens}.`,
      };
    }
  }

  return { raw, tokens, rounded, error: null };
}
