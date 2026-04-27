/**
 * Bonding Curve service for buy/sell operations on Stellar Soroban.
 */

import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  Account,
  scValToNative,
} from '@stellar/stellar-sdk';
import { STELLAR_TESTNET_RPC_URL, STELLAR_NETWORK_PASSPHRASE } from '@/config/network';

const rpc = new SorobanRpc.Server(STELLAR_TESTNET_RPC_URL, { allowHttp: false });
const BONDING_CURVE_ID = process.env.NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID!;

export class ContractError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'ContractError';
  }
}

export interface BuyTokenParams {
  buyerPublicKey: string;
  tokenAddress: string;
  tokenAmount: string; // raw units (e.g., "10000000" for 1 token with 7 decimals)
  maxXlmIn: string; // stroops (slippage protection)
  signTransaction: (xdr: string) => Promise<string>;
}

export interface SellTokenParams {
  sellerPublicKey: string;
  tokenAddress: string;
  tokenAmount: string; // raw units
  minXlmOut: string; // stroops (slippage protection)
  signTransaction: (xdr: string) => Promise<string>;
}

export interface TokenCurveState {
  token_address: string;
  admin: string;
  base_price: string;
  slope: string;
  total_supply: string;
  sold_supply: string;
  xlm_reserve: string;
  active: boolean;
}

/** Get current bonding curve state for a token */
export async function getTokenState(tokenAddress: string): Promise<TokenCurveState> {
  const contract = new Contract(BONDING_CURVE_ID);
  
  const tx = new TransactionBuilder(
    new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
    { fee: BASE_FEE, networkPassphrase: STELLAR_NETWORK_PASSPHRASE }
  )
    .addOperation(
      contract.call('get_token_state', new Address(tokenAddress).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const result = sim.result?.retval;
  if (!result) throw new Error('No result from simulation');

  // Parse TokenCurveState from ScVal
  const native = scValToNative(result);
  return {
    token_address: tokenAddress,
    admin: native.admin || '',
    base_price: String(native.base_price || 0),
    slope: String(native.slope || 0),
    total_supply: String(native.total_supply || 0),
    sold_supply: String(native.sold_supply || 0),
    xlm_reserve: String(native.xlm_reserve || 0),
    active: native.active ?? true,
  };
}

/** Get current price for a token (stroops per raw unit) */
export async function getCurrentPrice(tokenAddress: string): Promise<string> {
  const contract = new Contract(BONDING_CURVE_ID);
  const tx = new TransactionBuilder(
    new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
    { fee: BASE_FEE, networkPassphrase: STELLAR_NETWORK_PASSPHRASE }
  )
    .addOperation(
      contract.call('get_price', new Address(tokenAddress).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Price simulation failed: ${sim.error}`);
  }

  const result = sim.result?.retval;
  if (!result) throw new Error('No price result');

  // Parse i128 from ScVal
  const price = scValToNative(result);
  return String(price);
}

/** Get XLM cost to buy token_amount (in stroops, before fee) */
export async function getBuyPrice(tokenAddress: string, tokenAmount: string): Promise<string> {
  const contract = new Contract(BONDING_CURVE_ID);
  const tx = new TransactionBuilder(
    new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
    { fee: BASE_FEE, networkPassphrase: STELLAR_NETWORK_PASSPHRASE }
  )
    .addOperation(
      contract.call(
        'get_buy_price',
        new Address(tokenAddress).toScVal(),
        nativeToScVal(BigInt(tokenAmount), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Buy price simulation failed: ${sim.error}`);
  }

  const result = sim.result?.retval;
  if (!result) throw new Error('No buy price result');

  // Parse i128
  const cost = scValToNative(result);
  return String(cost);
}

/** Get XLM proceeds from selling token_amount (in stroops, before fee) */
export async function getSellPrice(tokenAddress: string, tokenAmount: string): Promise<string> {
  const contract = new Contract(BONDING_CURVE_ID);
  const tx = new TransactionBuilder(
    new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
    { fee: BASE_FEE, networkPassphrase: STELLAR_NETWORK_PASSPHRASE }
  )
    .addOperation(
      contract.call(
        'get_sell_price',
        new Address(tokenAddress).toScVal(),
        nativeToScVal(BigInt(tokenAmount), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Sell price simulation failed: ${sim.error}`);
  }

  const result = sim.result?.retval;
  if (!result) throw new Error('No sell price result');

  const proceeds = scValToNative(result);
  return String(proceeds);
}

/** Get wallet token balance */
export async function getWalletTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
  const contract = new Contract(tokenAddress);
  const tx = new TransactionBuilder(
    new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
    { fee: BASE_FEE, networkPassphrase: STELLAR_NETWORK_PASSPHRASE }
  )
    .addOperation(
      contract.call('balance', new Address(walletAddress).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    return 0n;
  }

  const result = sim.result?.retval;
  if (!result) return 0n;

  const balance = scValToNative(result);
  return BigInt(balance);
}

/** Buy tokens via bonding curve */
export async function buyToken(params: BuyTokenParams): Promise<string> {
  const { buyerPublicKey, tokenAddress, tokenAmount, maxXlmIn, signTransaction } = params;

  if (!buyerPublicKey || buyerPublicKey.length < 10) throw new Error('Wallet not connected — please connect Freighter first');
  if (!tokenAddress || tokenAddress.length < 10) throw new Error('Invalid token address');

  console.log('[buyToken] buyer:', buyerPublicKey, 'token:', tokenAddress, 'amount:', tokenAmount, 'maxXlmIn:', maxXlmIn);

  const account = await rpc.getAccount(buyerPublicKey);
  console.log('[buyToken] account loaded, seq:', account.sequenceNumber());

  const buyerAddress = new Address(buyerPublicKey);
  const tokenAddr = new Address(tokenAddress);

  const tx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 200),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(BONDING_CURVE_ID).call(
        'buy',
        buyerAddress.toScVal(),
        tokenAddr.toScVal(),
        nativeToScVal(BigInt(tokenAmount), { type: 'i128' }),
        nativeToScVal(BigInt(maxXlmIn), { type: 'i128' })
      )
    )
    .setTimeout(60)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  console.log('[buyToken] simulation status:', SorobanRpc.Api.isSimulationError(simulation) ? 'ERROR: ' + (simulation as any).error : 'OK');
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Buy simulation failed: ${simulation.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simulation).build();
  console.log('[buyToken] sending to Freighter for signing...');
  const signedXdr = await signTransaction(preparedTx.toXDR());
  console.log('[buyToken] signedXdr type:', typeof signedXdr, 'length:', signedXdr?.length);
  if (!signedXdr) throw new Error('Transaction signing failed or was rejected');

  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);

  const resp = await rpc.sendTransaction(signedTx);
  if (resp.status === 'ERROR') {
    throw new Error(`Buy tx error: ${JSON.stringify(resp.errorResult)}`);
  }

  // Wait for confirmation
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await rpc.getTransaction(resp.hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return resp.hash;
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Buy transaction failed on chain: ${resp.hash}`);
    }
  }
  throw new Error(`Buy transaction timeout: ${resp.hash}`);
}

/** Sell tokens via bonding curve */
export async function sellToken(params: SellTokenParams): Promise<string> {
  const { sellerPublicKey, tokenAddress, tokenAmount, minXlmOut, signTransaction } = params;

  if (!sellerPublicKey || sellerPublicKey.length < 10) throw new Error('Wallet not connected — please connect Freighter first');
  if (!tokenAddress || tokenAddress.length < 10) throw new Error('Invalid token address');

  const account = await rpc.getAccount(sellerPublicKey);
  const sellerAddress = new Address(sellerPublicKey);
  const tokenAddr = new Address(tokenAddress);

  const tx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 200),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(BONDING_CURVE_ID).call(
        'sell',
        sellerAddress.toScVal(),
        tokenAddr.toScVal(),
        nativeToScVal(BigInt(tokenAmount), { type: 'i128' }),
        nativeToScVal(BigInt(minXlmOut), { type: 'i128' })
      )
    )
    .setTimeout(60)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Sell simulation failed: ${simulation.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simulation).build();
  const signedXdr = await signTransaction(preparedTx.toXDR());
  if (!signedXdr) throw new Error('Transaction signing failed or was rejected');

  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);

  const resp = await rpc.sendTransaction(signedTx);
  if (resp.status === 'ERROR') {
    throw new Error(`Sell tx error: ${JSON.stringify(resp.errorResult)}`);
  }

  // Wait for confirmation
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await rpc.getTransaction(resp.hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return resp.hash;
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Sell transaction failed on chain: ${resp.hash}`);
    }
  }
  throw new Error(`Sell transaction timeout: ${resp.hash}`);
}

/** Register a new token in bonding curve (called after token creation) */
export async function registerToken(
  tokenAddress: string,
  tokenAdmin: string,
  adminSignTransaction: (xdr: string) => Promise<string>
): Promise<void> {
  const account = await rpc.getAccount(tokenAdmin);

  const tx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(BONDING_CURVE_ID).call(
        'register_token',
        new Address(tokenAddress).toScVal(),
        new Address(tokenAdmin).toScVal()
      )
    )
    .setTimeout(60)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Register simulation failed: ${simulation.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simulation).build();
  const signedXdr = await adminSignTransaction(preparedTx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);

  const resp = await rpc.sendTransaction(signedTx);
  if (resp.status === 'ERROR') {
    throw new Error(`Register tx error: ${JSON.stringify(resp.errorResult)}`);
  }

  // Wait for confirmation
  await waitForTx(resp.hash);
}

/** Transfer tokens from creator to bonding curve contract (for initial liquidity) */
export async function fundBondingCurve(
  tokenAddress: string,
  creatorPublicKey: string,
  amount: string, // raw units (e.g., "10000000000000000" for 1B tokens with 7 decimals)
  signTransaction: (xdr: string) => Promise<string>
): Promise<void> {
  const account = await rpc.getAccount(creatorPublicKey);
  const creatorAddr = new Address(creatorPublicKey);
  const bondingCurveAddr = new Address(BONDING_CURVE_ID);

  const tx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(tokenAddress).call(
        'transfer',
        creatorAddr.toScVal(),
        bondingCurveAddr.toScVal(),
        nativeToScVal(BigInt(amount), { type: 'i128' })
      )
    )
    .setTimeout(60)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Fund simulation failed: ${simulation.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simulation).build();
  const signedXdr = await signTransaction(preparedTx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);

  const resp = await rpc.sendTransaction(signedTx);
  if (resp.status === 'ERROR') {
    throw new Error(`Fund tx error: ${JSON.stringify(resp.errorResult)}`);
  }

  await waitForTx(resp.hash);
}

async function waitForTx(hash: string, retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await rpc.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return;
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${hash}`);
    }
  }
  throw new Error(`Transaction timeout: ${hash}`);
}
