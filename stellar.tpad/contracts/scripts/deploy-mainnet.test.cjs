const assert = require('node:assert/strict');
const test = require('node:test');
const {
  assertMinimumBalance,
  deriveStellarPublicKey,
  validateOptions,
  validateStateIdentity,
} = require('./deploy-mainnet.cjs');

test('derives a stable Stellar public key from a mnemonic', () => {
  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  assert.equal(
    deriveStellarPublicKey(mnemonic),
    'GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX',
  );
  assert.notEqual(deriveStellarPublicKey(mnemonic, 1), deriveStellarPublicKey(mnemonic, 0));
});

test('requires explicit execute flag before mainnet writes', () => {
  assert.throws(
    () => validateOptions({ execute: true, confirm: '' }),
    /DEPLOY_MAINNET_ONCE/,
  );
  assert.doesNotThrow(() =>
    validateOptions({ execute: true, confirm: 'DEPLOY_MAINNET_ONCE' }),
  );
});

test('blocks deployment when the source balance is too low', () => {
  assert.throws(() => assertMinimumBalance(4.99), /at least 5 XLM/);
  assert.doesNotThrow(() => assertMinimumBalance(5));
});

test('blocks resuming another deployer wallet state', () => {
  assert.throws(
    () => validateStateIdentity({ deployer: 'GA-OLD' }, 'GA-NEW'),
    /different deployer/,
  );
});
