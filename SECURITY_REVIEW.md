# Security Review

Review date: 24 July 2026  
Scope: Token, bonding-curve and factory Soroban contracts; wallet connection;
Mainnet deployment configuration.

## Checks performed

- Contract authorization is required for token creation, buying and selling.
- Factory creation and bonding-curve registration execute atomically.
- Buy and sell calculations enforce positive amounts and slippage limits.
- Persistent and instance storage TTLs are extended on active paths.
- Mainnet IDs are public configuration; signing keys and mnemonic phrases are
  excluded from Git.
- Mainnet deployments use deterministic salts and a balance guard.
- Contract unit tests and the factory integration test pass before deployment.

## Verification

```bash
cd stellar.tpad/contracts/token && cargo test
cd ../bonding_curve && cargo test
cd ../factory && cargo test
cd ../scripts && node deploy-mainnet.test.cjs
```

Deployment and onboarding transactions are linked from the project README.

## Residual risks

- This is an internal engineering review, not a third-party professional audit.
- Bonding-curve trading exposes users to price movement and slippage.
- Users must verify that Freighter is connected to Stellar Mainnet before
  signing.
- Contract code and data TTLs require ongoing monitoring and extension.

Report security issues privately to the repository owner. Do not publish wallet
secrets, mnemonic phrases or exploitable details in a public issue.
