/**
 * Token deployment service for Stellar Soroban.
 *
 * Flow per coin creation:
 *  1. Operation.createCustomContract  → deploys a fresh contract instance from wasm hash
 *  2. Contract.call('initialize', ...)  → sets name/symbol and mints 1B to admin
 */

import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Address,
  xdr,
  StrKey,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { STELLAR_RPC_URL, STELLAR_NETWORK_PASSPHRASE } from '@/config/network';

export interface CreateTokenParams {
  name: string;
  symbol: string;
  adminPublicKey: string;
  bondingCurveAddress: string;
  wasmHash: string;
  signTransaction: (xdr: string) => Promise<string>;
}

const rpc = new SorobanRpc.Server(STELLAR_RPC_URL, { allowHttp: false });

/** Deploy a new token contract instance via Factory contract. Returns contract ID. */
export async function deployAndInitToken(params: CreateTokenParams): Promise<string> {
  const { name, symbol, adminPublicKey, bondingCurveAddress, wasmHash, signTransaction } = params;

  const adminAddress = new Address(adminPublicKey);
  const bondingCurveAddr = new Address(bondingCurveAddress);
  const wasmHashBytes = hexToBytes(wasmHash);
  const salt = crypto.getRandomValues(new Uint8Array(32));

  const factoryId = process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID;
  if (!factoryId) {
    throw new Error('NEXT_PUBLIC_FACTORY_CONTRACT_ID is not configured in .env.local');
  }

  // ── Build Factory Call ──────────────────────────────────────────────────
  // Interface: create_token(wasm_hash, salt, admin, bonding_curve_address, name, symbol)
  const account = await rpc.getAccount(adminPublicKey);
  const factoryTx = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 200),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(factoryId).call(
        'create_token',
        xdr.ScVal.scvBytes(Buffer.from(wasmHashBytes)),
        xdr.ScVal.scvBytes(Buffer.from(salt)),
        adminAddress.toScVal(),
        bondingCurveAddr.toScVal(),
        nativeToScVal(name, { type: 'string' }),
        nativeToScVal(symbol, { type: 'string' })
      )
    )
    .setTimeout(60)
    .build();

  // ── Simulation & Auth ────────────────────────────────────────────────────
  const simulation = await rpc.simulateTransaction(factoryTx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Factory simulation failed: ${simulation.error}`);
  }

  // Log auth entries for debugging
  const simSuccess = simulation as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  console.log('Simulation auth entries:', JSON.stringify(simSuccess.result?.auth?.length ?? 0));

  // assembleTransaction injects sorobanData (footprint) + fee + auth entries from simulation
  const assembled = SorobanRpc.assembleTransaction(factoryTx, simulation);
  const preparedTx = assembled.build();

  console.log('Prepared tx soroban data set, sending to Freighter for signing...');
  const signedXdr = await signTransaction(preparedTx.toXDR());

  // ── Send Transaction ─────────────────────────────────────────────────────
  // Parse signed XDR directly — do NOT re-wrap to preserve auth entries & footprint
  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const resp = await rpc.sendTransaction(signedTx);

  if (resp.status === 'ERROR') {
    throw new Error(`Factory tx error: ${JSON.stringify(resp.errorResult)}`);
  }

  // Extraction of the new contract ID is handled by waitForContractId (Method 1: return value)
  const contractId = await waitForContractId(resp.hash);
  return contractId;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a base64 XDR envelope string to a Transaction object without re-parsing via TransactionBuilder */
function xdrToTransaction(envelopeXdr: string): ReturnType<typeof TransactionBuilder.fromXDR> {
  return TransactionBuilder.fromXDR(envelopeXdr, STELLAR_NETWORK_PASSPHRASE);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function waitForTx(hash: string, retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    await sleep(2000);
    const status = await rpc.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return;
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${hash}`);
    }
  }
  throw new Error(`Transaction timeout: ${hash}`);
}

async function waitForContractId(hash: string, retries = 30): Promise<string> {
  for (let i = 0; i < retries; i++) {
    await sleep(2000);
    const status = await rpc.getTransaction(hash);

    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      const success = status as SorobanRpc.Api.GetSuccessfulTransactionResponse;

      // Method 1: return value from soroban meta
      try {
        const meta = getTransactionMeta(success.resultMetaXdr);
        const sorobanMeta = meta.sorobanMeta();
        if (sorobanMeta) {
          const returnVal = sorobanMeta.returnValue();
          console.log('waitForContractId: returnVal switch:', returnVal?.switch()?.name);
          if (returnVal) {
            // Try Address.fromScVal first
            try {
              const addr = Address.fromScVal(returnVal).toString();
              if (addr.startsWith('C')) return addr;
            } catch (e) {
              console.log('waitForContractId: Address.fromScVal failed', e);
            }
          }
        }
      } catch (err) {
        console.error('waitForContractId: Method 1 failed:', err);
      }

      // Method 2: scan ledger entry changes for new ContractData with instance key
      try {
        const meta = getTransactionMeta(success.resultMetaXdr);
        const allChanges = [
          ...(meta.txChangesBefore?.() || []),
          ...(meta.txChangesAfter?.() || []),
          ...(meta.operations?.()?.flatMap((op: any) => [...op.changes()]) || []),
        ];
        console.log('waitForContractId: Checking', allChanges.length, 'ledger changes');
        for (const change of allChanges) {
          try {
            if (change.switch().name !== 'ledgerEntryCreated') continue;
            const entry = change.created().data();
            if (entry.switch().name !== 'contractData') continue;
            const contractData = entry.contractData();
            if (contractData.key().switch().name !== 'scvLedgerKeyContractInstance') continue;
            const contractIdBytes = contractData.contract().contractId();
            const cid = StrKey.encodeContract(contractIdBytes);
            console.log('waitForContractId: Found contract ID in changes:', cid);
            return cid;
          } catch { /* not a contract entry */ }
        }
      } catch (err) {
        console.error('waitForContractId: Method 2 failed:', err);
      }

      throw new Error('Could not extract contract ID from deploy result');
    }

    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Deploy transaction failed: ${hash}`);
    }
  }
  throw new Error(`Deploy transaction timeout: ${hash}`);
}


function getTransactionMeta(txMeta: xdr.TransactionMeta): any {
  const v = txMeta.switch() as any;
  // Handle both old (object with .value) and new (plain number) SDK versions
  const switchValue = (typeof v === 'object' && v !== null) ? v.value : v;
  
  console.log('getTransactionMeta: switch value =', switchValue);
  if (switchValue === 3) return txMeta.v3();
  if (switchValue === 4) return (txMeta as any).v4();
  throw new Error(`Unsupported TransactionMeta switch: ${switchValue}`);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
