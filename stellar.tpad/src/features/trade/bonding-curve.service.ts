/**
 * bonding-curve.service.ts
 * Soroban RPC calls + Freighter signing for BondingCurve_Contract.
 * All paths: stellar.tpad-v1/stellar.tpad/src/features/trade/
 */
import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
  Networks,
  xdr,
} from '@stellar/stellar-sdk';
import { STELLAR_TESTNET_RPC_URL, STELLAR_NETWORK_PASSPHRASE } from '@/config/network';
import { BONDING_CURVE_CONTRACT } from '@/config/contracts';
import type { TokenCurveState } from '@/types';

// ─── Error ────────────────────────────────────────────────────────────────────

const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: 'Contract already initialized',
  2: 'Token already registered',
  3: 'Token not found on bonding curve',
  4: 'Invalid amount — must be greater than 0',
  5: 'Price moved too fast, please retry',
  6: 'Not enough tokens available',
  7: 'Insufficient liquidity',
  8: 'Insufficient XLM reserve',
  9: 'Insufficient balance',
  10: 'Unauthorized',
};

export class ContractError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'ContractError';
  }
}

function parseContractError(err: unknown): ContractError {
  const msg = String(err);
  // Soroban contract errors come back as "Error(Contract, #N)"
  const match = msg.match(/Error\(Contract,\s*#(\d+)\)/);
  if (match) {
    const code = parseInt(match[1], 10);
    return new ContractError(code, CONTRACT_ERROR_MESSAGES[code] ?? `Contract error ${code}`);
  }
  return new ContractError(0, msg);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRpc() {
  return new SorobanRpc.Server(STELLAR_TESTNET_RPC_URL, { allowHttp: false });
}

export function calcSlippageBuy(cost: bigint): bigint {
  return (cost * 101n) / 100n;
}

export function calcSlippageSell(proceeds: bigint): bigint {
  return (proceeds * 99n) / 100n;
}

async function pollTransaction(rpc: SorobanRpc.Server, hash: string, maxRetries = 30): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const result = await rpc.getTransaction(hash);
    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return hash;
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${hash}`);
    }
  }
  throw new Error('Transaction timeout after 60s');
}

// ─── Read-only simulations ────────────────────────────────────────────────────

/**
 * Simulate get_buy_price — returns cost in stroops (bigint).
 * No signing required.
 */
export async function getBuyPrice(tokenAddress: string, tokenAmount: bigint): Promise<bigint> {
  const rpc = getRpc();
  const contract = new Contract(BONDING_CURVE_CONTRACT);

  const account = await rpc.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN').catch(() => null);
  // Use a dummy source account for simulation
  const sourceAccount = account ?? {
    accountId: () => 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => {},
  } as any;

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
  })
    .addOperation(
      contract.call(
        'get_buy_price',
        new Address(tokenAddress).toScVal(),
        nativeToScVal(tokenAmount, { type: 'i128' }),
      )
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }

  const result = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result;
  if (!result) throw new Error('No simulation result for get_buy_price');
  return BigInt(scValToNative(result.retval) as string | number);
}

/**
 * Simulate get_sell_price — returns proceeds in stroops (bigint).
 */
export async function getSellPrice(tokenAddress: string, tokenAmount: bigint): Promise<bigint> {
  const rpc = getRpc();
  const contract = new Contract(BONDING_CURVE_CONTRACT);

  const sourceAccount = {
    accountId: () => 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => {},
  } as any;

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
  })
    .addOperation(
      contract.call(
        'get_sell_price',
        new Address(tokenAddress).toScVal(),
        nativeToScVal(tokenAmount, { type: 'i128' }),
      )
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }

  const result = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result;
  if (!result) throw new Error('No simulation result for get_sell_price');
  return BigInt(scValToNative(result.retval) as string | number);
}

/**
 * Simulate get_token_state — returns TokenCurveState.
 */
export async function getTokenState(tokenAddress: string): Promise<TokenCurveState> {
  const rpc = getRpc();
  const contract = new Contract(BONDING_CURVE_CONTRACT);

  const sourceAccount = {
    accountId: () => 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => {},
  } as any;

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
  })
    .addOperation(
      contract.call('get_token_state', new Address(tokenAddress).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }

  const result = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result;
  if (!result) throw new Error('No simulation result for get_token_state');

  const raw = scValToNative(result.retval) as Record<string, unknown>;
  return {
    token_address: String(raw.token_address),
    admin: String(raw.admin),
    base_price: BigInt(String(raw.base_price)),
    slope: BigInt(String(raw.slope)),
    total_supply: BigInt(String(raw.total_supply)),
    sold_supply: BigInt(String(raw.sold_supply)),
    xlm_reserve: BigInt(String(raw.xlm_reserve)),
    active: Boolean(raw.active),
  };
}

// ─── Execute Buy/Sell ─────────────────────────────────────────────────────────

export interface BuyParams {
  buyer: string;           // G... address
  tokenAddress: string;    // C... contract address
  tokenAmount: bigint;     // raw units (7 decimals)
  signTransaction: (xdr: string, opts?: { networkPassphrase?: string }) => Promise<string>;
}

export interface SellParams {
  seller: string;
  tokenAddress: string;
  tokenAmount: bigint;
  signTransaction: (xdr: string, opts?: { networkPassphrase?: string }) => Promise<string>;
}

/**
 * Execute buy on BondingCurve_Contract via Freighter.
 * Applies 1% slippage automatically.
 * Returns txHash after confirmation.
 */
export async function executeBuy(params: BuyParams): Promise<string> {
  const { buyer, tokenAddress, tokenAmount, signTransaction } = params;
  const rpc = getRpc();
  const contract = new Contract(BONDING_CURVE_CONTRACT);

  // Get cost first for slippage
  const cost = await getBuyPrice(tokenAddress, tokenAmount);
  const maxXlmIn = calcSlippageBuy(cost);

  const account = await rpc.getAccount(buyer);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
  })
    .addOperation(
      contract.call(
        'buy',
        new Address(buyer).toScVal(),
        new Address(tokenAddress).toScVal(),
        nativeToScVal(tokenAmount, { type: 'i128' }),
        nativeToScVal(maxXlmIn, { type: 'i128' }),
      )
    )
    .setTimeout(30)
    .build();

  // Simulate to get footprint
  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }

  // Assemble with footprint
  const assembled = SorobanRpc.assembleTransaction(tx, sim).build();
  const signedXdr = await signTransaction(assembled.toXDR(), {
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
  });

  const submitted = await rpc.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE as string)
  );

  if (submitted.status === 'ERROR') {
    throw parseContractError(submitted.errorResult?.toString() ?? 'Send failed');
  }

  return pollTransaction(rpc, submitted.hash);
}

/**
 * Execute sell on BondingCurve_Contract via Freighter.
 * Applies 1% slippage automatically.
 * Returns txHash after confirmation.
 */
export async function executeSell(params: SellParams): Promise<string> {
  const { seller, tokenAddress, tokenAmount, signTransaction } = params;
  const rpc = getRpc();
  const contract = new Contract(BONDING_CURVE_CONTRACT);

  const proceeds = await getSellPrice(tokenAddress, tokenAmount);
  const minXlmOut = calcSlippageSell(proceeds);

  const account = await rpc.getAccount(seller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
  })
    .addOperation(
      contract.call(
        'sell',
        new Address(seller).toScVal(),
        new Address(tokenAddress).toScVal(),
        nativeToScVal(tokenAmount, { type: 'i128' }),
        nativeToScVal(minXlmOut, { type: 'i128' }),
      )
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw parseContractError(sim.error);
  }

  const assembled = SorobanRpc.assembleTransaction(tx, sim).build();
  const signedXdr = await signTransaction(assembled.toXDR(), {
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE as string,
  });

  const submitted = await rpc.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE as string)
  );

  if (submitted.status === 'ERROR') {
    throw parseContractError(submitted.errorResult?.toString() ?? 'Send failed');
  }

  return pollTransaction(rpc, submitted.hash);
}
