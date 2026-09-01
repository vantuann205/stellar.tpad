/**
 * Stellar keeps part of every account's XLM permanently unspendable.
 *
 * A trader who spends down to that floor still holds their tokens but can no
 * longer pay the fee to sell them, and the network answers with
 * `txInsufficientBalance` — a transaction-level code that says nothing about
 * tokens and reads, to a user, like the app is broken.
 *
 * This module computes what an account can actually spend, and turns Stellar's
 * result codes into something a person can act on.
 */

/** The network's base reserve: 0.5 XLM, in stroops. */
export const BASE_RESERVE_STROOPS = 5_000_000n;

/** 1 XLM in stroops. */
export const STROOPS_PER_XLM = 10_000_000n;

/**
 * A little more than a typical Soroban fee, kept back so a buyer is not left
 * with exactly enough for the buy and nothing for the sell that follows it.
 */
export const SELL_FEE_HEADROOM_STROOPS = 500_000n; // 0.05 XLM

export interface AccountFunds {
  /** Total native balance. */
  balance: bigint;
  /** What the network will not let the account spend. */
  reserve: bigint;
  /** balance − reserve, floored at zero. */
  spendable: bigint;
}

/** Horizon reports balances as decimal strings; the ledger works in stroops. */
export function xlmToStroops(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d*)?$/.test(trimmed)) {
    throw new Error(`Not a valid XLM amount: ${value}`);
  }
  const [whole, fraction = ''] = trimmed.split('.');
  // Seven decimal places, padded or truncated — Stellar has no eighth.
  const padded = (fraction + '0000000').slice(0, 7);
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(padded);
}

export function stroopsToXlm(stroops: bigint): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const fraction = (abs % STROOPS_PER_XLM).toString().padStart(7, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`;
}

/**
 * The minimum balance formula from the Stellar protocol.
 *
 * Sponsored entries are paid for by someone else, which is why they subtract:
 * an account sponsoring ten entries carries their reserve, and an account whose
 * entries are sponsored carries none of its own.
 */
export function minimumReserve(
  subentryCount: number,
  numSponsoring = 0,
  numSponsored = 0,
): bigint {
  const entries = 2n + BigInt(subentryCount) + BigInt(numSponsoring) - BigInt(numSponsored);
  const floored = entries < 2n ? 2n : entries;
  return floored * BASE_RESERVE_STROOPS;
}

interface HorizonAccount {
  balances?: { asset_type: string; balance: string }[];
  subentry_count?: number;
  num_sponsoring?: number;
  num_sponsored?: number;
}

export function accountFundsFromHorizon(account: HorizonAccount): AccountFunds {
  const native = account.balances?.find((entry) => entry.asset_type === 'native');
  const balance = native ? xlmToStroops(native.balance) : 0n;
  const reserve = minimumReserve(
    account.subentry_count ?? 0,
    account.num_sponsoring ?? 0,
    account.num_sponsored ?? 0,
  );
  const spendable = balance > reserve ? balance - reserve : 0n;
  return { balance, reserve, spendable };
}

/**
 * Reads the account's spendable balance from Horizon.
 *
 * Soroban RPC's `getAccount` returns only an id and a sequence number, so the
 * balance and the subentry count — both needed for the reserve — have to come
 * from Horizon.
 */
export async function fetchAccountFunds(
  publicKey: string,
  horizonUrl: string,
): Promise<AccountFunds> {
  const response = await fetch(`${horizonUrl.replace(/\/+$/, '')}/accounts/${publicKey}`);
  if (!response.ok) {
    throw new Error(`Could not read the account balance (HTTP ${response.status}).`);
  }
  return accountFundsFromHorizon((await response.json()) as HorizonAccount);
}

/**
 * Explains a failed submission in terms of what the person should do next.
 *
 * The raw value is an XDR result object, and printing it produces the
 * `{"_maxDepth":200,...}` blob users were seeing.
 */
export function describeSubmitError(errorResult: unknown): string {
  const code = transactionResultCode(errorResult);

  switch (code) {
    case 'txInsufficientBalance':
      return (
        'Your wallet does not have enough XLM left to pay the network fee. ' +
        'Stellar keeps 1 XLM per account permanently unspendable, so a little ' +
        'has to stay above that. Add around 1 XLM and try again.'
      );
    case 'txInsufficientFee':
      return 'The network is busy and the fee offered was too low. Try again in a moment.';
    case 'txBadSeq':
      return 'This transaction was built against a stale account state. Refresh and try again.';
    case 'txNoAccount':
      return 'This wallet does not exist on the network yet. It needs to be funded first.';
    case 'txBadAuth':
    case 'txBadAuthExtra':
      return 'The signature did not match this wallet. Reconnect the wallet and try again.';
    case 'txTooLate':
      return 'The transaction expired before it reached the network. Try again.';
    case 'txFailed':
      return 'The contract rejected this trade. The price may have moved past your slippage limit.';
    default:
      return code
        ? `The network rejected this transaction (${code}).`
        : 'The network rejected this transaction.';
  }
}

/** Digs the result code name out of the SDK's XDR wrapper. */
export function transactionResultCode(errorResult: unknown): string | null {
  const attributes = (errorResult as { _attributes?: unknown } | null)?._attributes as
    | { result?: { _switch?: { name?: unknown } } }
    | undefined;
  const name = attributes?.result?._switch?.name;
  return typeof name === 'string' ? name : null;
}

/**
 * Whether a trade can go ahead, and why not when it cannot.
 *
 * `required` is the fee alone for a sell, or the fee plus the XLM being spent
 * for a buy.
 */
export function checkAffordable(
  funds: AccountFunds,
  required: bigint,
): { ok: true } | { ok: false; reason: string } {
  if (funds.spendable >= required) return { ok: true };

  const short = required - funds.spendable;
  return {
    ok: false,
    reason:
      `This needs ${stroopsToXlm(required)} XLM but only ${stroopsToXlm(funds.spendable)} XLM ` +
      `is spendable — Stellar reserves ${stroopsToXlm(funds.reserve)} XLM of your ` +
      `${stroopsToXlm(funds.balance)} XLM balance. Add about ${stroopsToXlm(short)} XLM.`,
  };
}
