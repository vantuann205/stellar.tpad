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
} from '@stellar/stellar-sdk';
import { STELLAR_TESTNET_RPC_URL, STELLAR_NETWORK_PASSPHRASE } from '@/config/network';

export interface CreateTokenParams {
  name: string;
  symbol: string;
  adminPublicKey: string;
  wasmHash: string; // hex string from `stellar contract install`
  signTransaction: (xdr: string) => Promise<string>;
}

const rpc = new SorobanRpc.Server(STELLAR_TESTNET_RPC_URL, { allowHttp: false });

/** Deploy a new token contract instance and call initialize. Returns contract ID (C...). */
export async function deployAndInitToken(params: CreateTokenParams): Promise<string> {
  const { name, symbol, adminPublicKey, wasmHash, signTransaction } = params;

  const adminAddress = new Address(adminPublicKey);
  const wasmHashBytes = hexToBytes(wasmHash);

  // ── Step 1: Deploy contract instance ──────────────────────────────────────
  const account1 = await rpc.getAccount(adminPublicKey);
  const deployTx = new TransactionBuilder(account1, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createCustomContract({
        address: adminAddress,
        wasmHash: wasmHashBytes,
      })
    )
    .setTimeout(60)
    .build();

  const simDeploy = await rpc.simulateTransaction(deployTx);
  if (SorobanRpc.Api.isSimulationError(simDeploy)) {
    throw new Error(`Deploy simulation failed: ${simDeploy.error}`);
  }

  const preparedDeploy = SorobanRpc.assembleTransaction(deployTx, simDeploy).build();
  const signedDeployXdr = await signTransaction(preparedDeploy.toXDR());

  // Send using raw XDR envelope — avoids fromXDR parse issues with new op types
  const deployResp = await rpc.sendTransaction(
    xdrToTransaction(signedDeployXdr)
  );

  if (deployResp.status === 'ERROR') {
    throw new Error(`Deploy tx error: ${JSON.stringify(deployResp.errorResult)}`);
  }

  const contractId = await waitForContractId(deployResp.hash);

  // ── Step 2: Initialize contract ───────────────────────────────────────────
  const account2 = await rpc.getAccount(adminPublicKey);

  // Build ScVal args manually to ensure correct types
  const adminScVal = adminAddress.toScVal();
  const nameScVal  = xdr.ScVal.scvString(Buffer.from(name,   'utf8'));
  const symbolScVal = xdr.ScVal.scvString(Buffer.from(symbol, 'utf8'));

  const initTx = new TransactionBuilder(account2, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(contractId).call('initialize', adminScVal, nameScVal, symbolScVal)
    )
    .setTimeout(60)
    .build();

  const simInit = await rpc.simulateTransaction(initTx);
  if (SorobanRpc.Api.isSimulationError(simInit)) {
    throw new Error(`Initialize simulation failed: ${simInit.error}`);
  }

  const preparedInit = SorobanRpc.assembleTransaction(initTx, simInit).build();
  const signedInitXdr = await signTransaction(preparedInit.toXDR());

  const initResp = await rpc.sendTransaction(xdrToTransaction(signedInitXdr));

  if (initResp.status === 'ERROR') {
    throw new Error(`Initialize tx error: ${JSON.stringify(initResp.errorResult)}`);
  }

  await waitForTx(initResp.hash);
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
