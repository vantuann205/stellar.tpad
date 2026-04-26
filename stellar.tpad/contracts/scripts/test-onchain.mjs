/**
 * Full onchain integration test: create token → buy × 3 → sell × 2
 * Uses stellar CLI under the hood, always reads fresh state before each tx.
 *
 * Run: node contracts/scripts/test-onchain.mjs
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ────────────────────────────────────────────────────────
const envPath = resolve(__dir, '../../.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
);

const SECRET   = env.STELLAR_DEPLOYER_SECRET_KEY;
const ADMIN    = env.STELLAR_DEPLOYER_PUBLIC_KEY;
const WASM     = env.NEXT_PUBLIC_TOKEN_WASM_HASH;
const NETWORK  = 'testnet';

// ── Deployed contracts ─────────────────────────────────────────────────────
const FACTORY  = 'CD57IS3U3XLHGBX744VX2LSU32IYXDV6G2WAG5XM4L3N7XUJYP7MASV4';
const BC       = 'CAHXGXZU2W7JL2L6TQPXK2UVECQZBDQKFV2N2R2IVBCKVROJ6P42U7M4';

// ── Constants ──────────────────────────────────────────────────────────────
const ONE_TOKEN  = 10_000_000n;   // 1 token = 10^7 raw units
const STROOPS    = 10_000_000n;   // stroops per XLM

// ── Helpers ────────────────────────────────────────────────────────────────
function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
  } catch (e) {
    const stderr = (e.stderr || '').toString();
    const stdout = (e.stdout || '').toString();
    throw new Error(`CMD FAILED:\n${cmd}\nSTDERR: ${stderr}\nSTDOUT: ${stdout}`);
  }
}

function invoke(contractId, fn, args = '') {
  return run(
    `stellar contract invoke --id ${contractId} --source ${SECRET} --network ${NETWORK} -- ${fn} ${args}`
  );
}

function toXlm(stroops) {
  const s = BigInt(stroops);
  return `${s / STROOPS}.${(s % STROOPS).toString().padStart(7,'0')} XLM`;
}

function toTokens(raw) {
  const r = BigInt(raw);
  return `${r / ONE_TOKEN}.${(r % ONE_TOKEN).toString().padStart(7,'0')} tokens`;
}

function parseJson(raw) {
  // strip CLI noise lines (non-JSON)
  const line = raw.split('\n').find(l => l.trim().startsWith('{') || l.trim().startsWith('"'));
  return JSON.parse(line ?? raw);
}

function parseI128(raw) {
  const line = raw.split('\n').find(l => l.includes('"'));
  return BigInt(JSON.parse(line ?? raw));
}

function getState(tokenAddr) {
  const raw = invoke(BC, 'get_token_state', `--token_address ${tokenAddr}`);
  return parseJson(raw);
}

function getBuyPrice(tokenAddr, tokenAmount) {
  const raw = invoke(BC, 'get_buy_price',
    `--token_address ${tokenAddr} --token_amount ${tokenAmount}`);
  return parseI128(raw);
}

function getSellPrice(tokenAddr, tokenAmount) {
  const raw = invoke(BC, 'get_sell_price',
    `--token_address ${tokenAddr} --token_amount ${tokenAmount}`);
  return parseI128(raw);
}

function printState(label, state) {
  console.log(`  [${label}]`);
  console.log(`    sold_supply  : ${toTokens(state.sold_supply)}`);
  console.log(`    xlm_reserve  : ${toXlm(state.xlm_reserve)}`);
  const price = BigInt(state.base_price) + BigInt(state.slope) * (BigInt(state.sold_supply) / ONE_TOKEN);
  console.log(`    current price: ${toXlm(price)} per token`);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(65));
  console.log('  Bonding Curve — Full Onchain Integration Test');
  console.log('  Network  : Stellar Testnet');
  console.log(`  Factory  : ${FACTORY}`);
  console.log(`  BondingCurve: ${BC}`);
  console.log('='.repeat(65));

  // ── STEP 1: Create token ─────────────────────────────────────────────────
  console.log('\n[STEP 1] Creating new token via Factory...');
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2,'0')).join('');
  console.log(`  Salt: ${salt}`);

  const createOut = invoke(FACTORY, 'create_token',
    `--wasm_hash ${WASM} --salt ${salt} --admin ${ADMIN} --name TestCoin --symbol TEST --bonding_curve ${BC}`
  );
  const TOKEN = createOut.split('\n').find(l => l.includes('"')).replace(/"/g,'').trim();
  console.log(`  Token deployed : ${TOKEN}`);
  console.log('  Events emitted : mint → register → transfer (1B tokens → BondingCurve)');

  // ── STEP 2: Verify initial state ─────────────────────────────────────────
  console.log('\n[STEP 2] Verifying initial state...');
  let state = getState(TOKEN);
  printState('initial', state);
  console.log(`  base_price : ${state.base_price} stroops`);
  console.log(`  slope      : ${state.slope} stroops/token`);
  console.log(`  total_supply: ${toTokens(state.total_supply)}`);

  // Verify bonding curve holds full supply
  const bcBalance = invoke(TOKEN, 'balance', `--id ${BC}`);
  console.log(`  BC token balance: ${toTokens(parseI128(bcBalance))}`);
  console.log(`  Admin balance   : ${toTokens(parseI128(invoke(TOKEN, 'balance', `--id ${ADMIN}`)))}`);

  // ── STEP 3: Buy 1 token ──────────────────────────────────────────────────
  console.log('\n[STEP 3] BUY 1 token...');
  state = getState(TOKEN);
  const cost1 = getBuyPrice(TOKEN, ONE_TOKEN);
  const fee1  = cost1 / 100n;
  const max1  = cost1 + fee1 + 1000n;
  console.log(`  sold_supply before : ${toTokens(state.sold_supply)}`);
  console.log(`  cost (pre-fee)     : ${toXlm(cost1)}`);
  console.log(`  fee (1%)           : ${toXlm(fee1)}`);
  console.log(`  max_xlm_in         : ${toXlm(max1)}`);
  invoke(BC, 'buy',
    `--buyer ${ADMIN} --token_address ${TOKEN} --token_amount ${ONE_TOKEN} --max_xlm_in ${max1}`);
  state = getState(TOKEN);
  printState('after buy 1', state);

  // ── STEP 4: Buy 5 tokens ─────────────────────────────────────────────────
  console.log('\n[STEP 4] BUY 5 tokens...');
  state = getState(TOKEN);
  const cost5 = getBuyPrice(TOKEN, 5n * ONE_TOKEN);
  const fee5  = cost5 / 100n;
  const max5  = cost5 + fee5 + 5000n;
  console.log(`  sold_supply before : ${toTokens(state.sold_supply)}`);
  console.log(`  cost (pre-fee)     : ${toXlm(cost5)}`);
  console.log(`  fee (1%)           : ${toXlm(fee5)}`);
  console.log(`  max_xlm_in         : ${toXlm(max5)}`);
  invoke(BC, 'buy',
    `--buyer ${ADMIN} --token_address ${TOKEN} --token_amount ${5n * ONE_TOKEN} --max_xlm_in ${max5}`);
  state = getState(TOKEN);
  printState('after buy 5', state);

  // ── STEP 5: Buy 10 tokens ────────────────────────────────────────────────
  console.log('\n[STEP 5] BUY 10 tokens...');
  state = getState(TOKEN);
  const cost10 = getBuyPrice(TOKEN, 10n * ONE_TOKEN);
  const fee10  = cost10 / 100n;
  const max10  = cost10 + fee10 + 10000n;
  console.log(`  sold_supply before : ${toTokens(state.sold_supply)}`);
  console.log(`  cost (pre-fee)     : ${toXlm(cost10)}`);
  console.log(`  fee (1%)           : ${toXlm(fee10)}`);
  console.log(`  max_xlm_in         : ${toXlm(max10)}`);
  invoke(BC, 'buy',
    `--buyer ${ADMIN} --token_address ${TOKEN} --token_amount ${10n * ONE_TOKEN} --max_xlm_in ${max10}`);
  state = getState(TOKEN);
  printState('after buy 10', state);

  // ── STEP 6: Sell 3 tokens ────────────────────────────────────────────────
  console.log('\n[STEP 6] SELL 3 tokens...');
  state = getState(TOKEN);
  const proc3 = getSellPrice(TOKEN, 3n * ONE_TOKEN);
  const sfee3 = proc3 / 100n;
  const min3  = proc3 - sfee3 - 5000n;
  console.log(`  sold_supply before  : ${toTokens(state.sold_supply)}`);
  console.log(`  proceeds (pre-fee)  : ${toXlm(proc3)}`);
  console.log(`  fee (1%)            : ${toXlm(sfee3)}`);
  console.log(`  min_xlm_out         : ${toXlm(min3)}`);
  invoke(BC, 'sell',
    `--seller ${ADMIN} --token_address ${TOKEN} --token_amount ${3n * ONE_TOKEN} --min_xlm_out ${min3}`);
  state = getState(TOKEN);
  printState('after sell 3', state);

  // ── STEP 7: Sell 5 tokens ────────────────────────────────────────────────
  console.log('\n[STEP 7] SELL 5 tokens...');
  state = getState(TOKEN);
  const proc5 = getSellPrice(TOKEN, 5n * ONE_TOKEN);
  const sfee5 = proc5 / 100n;
  const min5  = proc5 - sfee5 - 5000n;
  console.log(`  sold_supply before  : ${toTokens(state.sold_supply)}`);
  console.log(`  proceeds (pre-fee)  : ${toXlm(proc5)}`);
  console.log(`  fee (1%)            : ${toXlm(sfee5)}`);
  console.log(`  min_xlm_out         : ${toXlm(min5)}`);
  invoke(BC, 'sell',
    `--seller ${ADMIN} --token_address ${TOKEN} --token_amount ${5n * ONE_TOKEN} --min_xlm_out ${min5}`);
  state = getState(TOKEN);
  printState('after sell 5', state);

  // ── STEP 8: Final summary ────────────────────────────────────────────────
  console.log('\n[STEP 8] Final summary:');
  state = getState(TOKEN);
  const finalPrice = BigInt(state.base_price) + BigInt(state.slope) * (BigInt(state.sold_supply) / ONE_TOKEN);
  console.log('='.repeat(65));
  console.log(`  Token contract : ${TOKEN}`);
  console.log(`  Final sold     : ${toTokens(state.sold_supply)}`);
  console.log(`  Final reserve  : ${toXlm(state.xlm_reserve)}`);
  console.log(`  Final price    : ${toXlm(finalPrice)} per token`);
  console.log('='.repeat(65));
  console.log('\n✓ All onchain steps completed successfully.');
}

main().catch(err => {
  console.error('\n✗ Test failed:', err.message);
  process.exit(1);
});
