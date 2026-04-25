# Frontend (stellar.tpad-v1)

This folder contains the UI-only variant with Stellar extension wallet connection.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy environment file and adjust if needed:

```bash
copy .env.local.example .env.local
```

3. Run development server:

```bash
npm run dev
```

## Stellar Wallet Connect

Supported wallets:

- Freighter extension
- Rabet extension

Default network:

- Stellar Testnet (`Test SDF Network ; September 2015`)

Required environment variables:

- `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`
- `NEXT_PUBLIC_STELLAR_RPC_URL`

## Tests

Run wallet-specific tests:

```bash
npm run test:wallet
```

Run all tests:

```bash
npm test
```