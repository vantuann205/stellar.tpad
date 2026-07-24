const { execFileSync } = require('node:child_process');
const { createHash, createHmac, pbkdf2Sync } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Keypair } = require('@stellar/stellar-sdk');

const ROOT = resolve(__dirname, '..', '..');
const RPC = 'https://mainnet.sorobanrpc.com';
const PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const XLM_SAC = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
const STATE_FILE = resolve(ROOT, '.mainnet-deployment.json');
const SIGNER_ALIAS = 'tpad-mainnet-deployer';
const CONTRACTS = ['token', 'bonding_curve', 'factory'];

function deriveStellarPublicKey(mnemonic, accountIndex = 0) {
  const seed = pbkdf2Sync(mnemonic.normalize('NFKD'), 'mnemonic', 2048, 64, 'sha512');
  let key = createHmac('sha512', 'ed25519 seed').update(seed).digest();
  for (const index of [44, 148, accountIndex]) {
    const data = Buffer.alloc(37);
    data[0] = 0;
    key.subarray(0, 32).copy(data, 1);
    data.writeUInt32BE(index + 0x80000000, 33);
    key = createHmac('sha512', key.subarray(32)).update(data).digest();
  }
  return Keypair.fromRawEd25519Seed(key.subarray(0, 32)).publicKey();
}

function validateOptions({ execute, confirm }) {
  if (execute && confirm !== 'DEPLOY_MAINNET_ONCE') {
    throw new Error('Mainnet write blocked: pass --confirm DEPLOY_MAINNET_ONCE');
  }
}

function assertMinimumBalance(balance) {
  if (!Number.isFinite(balance) || balance < 5) {
    throw new Error('Source wallet needs at least 5 XLM before mainnet deployment');
  }
}

function validateStateIdentity(state, source) {
  if (state.deployer && state.deployer !== source) {
    throw new Error('Deployment state belongs to a different deployer wallet');
  }
}

function run(args, cwd = ROOT, env = process.env) {
  return execFileSync('stellar', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
}

function buildAll() {
  for (const name of CONTRACTS) {
    run(['contract', 'build', '--optimize'], resolve(ROOT, 'contracts', name));
  }
}

function wasm(name) {
  const dir = resolve(ROOT, 'contracts', name, 'target', 'wasm32v1-none', 'release');
  const optimized = resolve(dir, `${name}.optimized.wasm`);
  return existsSync(optimized) ? optimized : resolve(dir, `${name}.wasm`);
}

function salt(label) {
  return createHash('sha256').update(`stellar-tpad-mainnet-${label}-v1`).digest('hex');
}

function readState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
}

function saveState(state) {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function upload(name, state, env, hdPath) {
  if (state[`${name}WasmHash`]) return state[`${name}WasmHash`];
  const hash = run([
    'contract', 'upload', '--wasm', wasm(name),
    '--sign-with-key', SIGNER_ALIAS,
    '--hd-path', String(hdPath),
    '--inclusion-fee', '10000',
    '--rpc-url', RPC, '--network-passphrase', PASSPHRASE,
  ], ROOT, env);
  state[`${name}WasmHash`] = hash;
  saveState(state);
  return hash;
}

function deploy(hash, label, constructorArgs, state, env, hdPath) {
  const key = `${label}ContractId`;
  if (state[key]) return state[key];
  const id = run([
    'contract', 'deploy', '--wasm-hash', hash, '--salt', salt(label),
    '--sign-with-key', SIGNER_ALIAS,
    '--hd-path', String(hdPath),
    '--inclusion-fee', '10000',
    '--rpc-url', RPC, '--network-passphrase', PASSPHRASE,
    ...(constructorArgs.length ? ['--', ...constructorArgs] : []),
  ], ROOT, env);
  state[key] = id;
  saveState(state);
  return id;
}

function parseArgs(argv) {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i < 0 ? '' : argv[i + 1] || '';
  };
  return {
    execute: argv.includes('--execute'),
    confirm: value('--confirm'),
    mnemonicFile: value('--mnemonic-file'),
    treasury: value('--treasury'),
    hdPath: Number(value('--hd-path') || 0),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  validateOptions(options);
  buildAll();

  const health = execFileSync('powershell', [
    '-NoProfile', '-Command',
    `$b='{"jsonrpc":"2.0","id":1,"method":"getHealth"}'; (Invoke-RestMethod -Method Post -Uri '${RPC}' -ContentType 'application/json' -Body $b).result.status`,
  ], { encoding: 'utf8' }).trim();
  if (health !== 'healthy') throw new Error(`Mainnet RPC is ${health}`);

  if (!options.execute) {
    console.log('Preflight passed. No mainnet transaction was sent.');
    return;
  }
  if (!options.mnemonicFile) throw new Error('--mnemonic-file is required with --execute');
  if (!Number.isInteger(options.hdPath) || options.hdPath < 0) throw new Error('--hd-path must be a non-negative integer');

  const mnemonic = readFileSync(resolve(options.mnemonicFile), 'utf8').trim();
  if (mnemonic.split(/\s+/).length < 12) throw new Error('Mnemonic file is invalid');
  const source = deriveStellarPublicKey(mnemonic, options.hdPath);
  const treasury = options.treasury || source;
  const env = { ...process.env, STELLAR_ACCOUNT: SIGNER_ALIAS };
  const state = readState();
  validateStateIdentity(state, source);

  const balance = Number(execFileSync('powershell', [
    '-NoProfile', '-Command',
    `(Invoke-RestMethod -Uri 'https://horizon.stellar.org/accounts/${source}').balances | Where-Object asset_type -eq native | Select-Object -ExpandProperty balance`,
  ], { encoding: 'utf8' }).trim());
  assertMinimumBalance(balance);
  state.deployer = source;
  state.treasury = treasury;
  state.hdPath = options.hdPath;
  saveState(state);

  const tokenHash = upload('token', state, env, options.hdPath);
  const bondingHash = upload('bonding_curve', state, env, options.hdPath);
  const factoryHash = upload('factory', state, env, options.hdPath);
  const bondingId = deploy(
    bondingHash,
    'bonding',
    ['--admin', source, '--treasury', treasury, '--xlm_address', XLM_SAC],
    state, env, options.hdPath,
  );
  const factoryId = deploy(factoryHash, 'factory', [], state, env, options.hdPath);

  state.network = 'mainnet';
  state.deployer = source;
  state.treasury = treasury;
  state.xlmSac = XLM_SAC;
  state.tokenWasmHash = tokenHash;
  state.bondingContractId = bondingId;
  state.factoryContractId = factoryId;
  saveState(state);

  console.log(JSON.stringify({
    NEXT_PUBLIC_STELLAR_NETWORK: 'mainnet',
    NEXT_PUBLIC_STELLAR_RPC_URL: RPC,
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: PASSPHRASE,
    NEXT_PUBLIC_XLM_CONTRACT_ID: XLM_SAC,
    NEXT_PUBLIC_TREASURY_ADDRESS: treasury,
    NEXT_PUBLIC_TOKEN_WASM_HASH: tokenHash,
    NEXT_PUBLIC_FACTORY_CONTRACT_ID: factoryId,
    NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID: bondingId,
  }, null, 2));
}

module.exports = {
  assertMinimumBalance,
  deriveStellarPublicKey,
  validateOptions,
  validateStateIdentity,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
