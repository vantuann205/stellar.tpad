<div align="center">

# Stellar TPad

**Token launchpad built on Stellar Soroban**

Launch, trade, and discover meme coins on Stellar Testnet — powered by on-chain bonding curves.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-Soroban-CE422B?style=for-the-badge&logo=rust&logoColor=white)](https://soroban.stellar.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-7B2FBE?style=for-the-badge&logo=stellar&logoColor=white)](https://stellar.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Railway](https://img.shields.io/badge/Railway-Deployed-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app/)

---

**Live Demo:** [https://stellar-tpad.up.railway.app/](https://stellar-tpad.up.railway.app/)

</div>

---

## Demo Video

[Watch demo videos on Google Drive](https://drive.google.com/drive/folders/1-1BtdV2j7WqHs0YID6WRkH6jUj0S15Xu?usp=sharing)


---

## Testnet Users

Testnet accounts used for demo and testing:

| # | Address |
|---|---------|
| 1 | `GAEU3CLX3AZNNHB6ICCNMUN5VDMVRKJBP4CPQQGLRAXWKAFVBXAGLX32` |
| 2 | `GDQAK5F3RXAHGNUZZGODDTUL4D2OFBQG26LOZF36URKXGDIQQEVBBA4L` |
| 3 | `GCW74EQE6JLW446BLSOFWHAUDTZFBTZLLLBAA7JTRSXLBBWGXR4V4YD5` |
| 4 | `GAVRZLSQR7CEHJCFSN6ENPFRFY3VVICZV2KZWXCIDNFXSE5BUIOLBFCB` |
| 5 | `GBXANKIZ2P4JMKOY5LXSDNFX2VK5I2VKYFJWUNAPQA4JFO3V4PFZBCZT` |
| 6 | `GDLYHOUXV2IGDWK4P7C56JSPMOYU7ZZVQIK3HVQS5WLITWQIXVXHWOJC` |



---

## Feedback

**Feedback Form (Excel/Google Sheet):** [Open Feedback Sheet](https://docs.google.com/spreadsheets/d/1VCt3XFTEFzilO3JXc9C7jStOINJ5Z-U4mrHIEyYR-oQ/edit?resourcekey=&gid=1510160419#gid=1510160419)

### Future Improvements & Evolution
Based on collected user feedback, we are actively improving and evolving the project. In the next phase, we plan to focus on:
- **Enhanced Data Accuracy & UX:** Synchronize frontend visual indicators (like the bonding curve progress) directly with database state to ensure real-time accuracy (completed based on feedback from `ttgaming1246@gmail.com` - see commit [63db900e42354b0efe0ca4564877cb52568b93bf](https://github.com/vantuann205/stellar.tpad/commit/63db900e42354b0efe0ca4564877cb52568b93bf)).
- **Improved Performance:** Optimize database queries for trade processing and OHLCV chart data loading.
- **Advanced Trading Tools:** Build out more robust charting and trading interface elements directly addressing trader requests.

---

## Architecture

```
+------------------------------------------------------------------+
|                        User Browser                             |
|              Freighter / Rabet Wallet Extension                 |
+---------------------------+--------------------------------------+
                            | HTTPS
+---------------------------v--------------------------------------+
|                   Next.js 14 App (Railway)                      |
|  +------------------+   +------------------+  +--------------+  |
|  |   App Router     |   |   API Routes     |  |  Background  |  |
|  |  (RSC + Client)  |   |  /api/tokens     |  |    Jobs      |  |
|  |                  |   |  /api/purchases  |  |  (metrics,   |  |
|  |  - Home Feed     |   |  /api/upload     |  |  snapshots)  |  |
|  |  - Token Page    |   |  /api/health     |  +--------------+  |
|  |  - Create Coin   |   +--------+---------+                    |
|  |  - Profile       |            |                              |
|  +------------------+            |                              |
+----------------------------+-----+------------------------------+
                             |     |
              +--------------v--+  |  +------------------+
              |   PostgreSQL    |  |  |   Cloudinary CDN |
              |  (Neon / PG)    |  |  |  (Token Images)  |
              |                 |  |  +------------------+
              | tokens          |  |
              | purchases       |  |
              | price_snapshots |  |
              | wallets         |  |
              | comments        |  |
              +-----------------+  |
                                   | Soroban RPC
+----------------------------------v---------------------------------+
|                    Stellar Testnet (Soroban)                      |
|                                                                   |
|  +------------------+  +------------------+  +---------------+   |
|  |  Factory Contract|  | BondingCurve     |  |   Token       |   |
|  |                  |  | Contract         |  |  Contract     |   |
|  | create_token()   |  |                  |  |  (SEP-41)     |   |
|  | -> deploy token  |  | buy()  sell()    |  |               |   |
|  | -> register curve|  | get_price()      |  | transfer()    |   |
|  |  (1 signature)   |  | register_token() |  | balance()     |   |
|  +------------------+  +------------------+  +---------------+   |
+-------------------------------------------------------------------+
```

**Architecture Document (Google Docs):** [View full architecture doc](https://docs.google.com/document/d/1fQm1F1tq3mS-cU8EuXBTgSiRIuU8hK7CIaAbfBXRWVE/edit?tab=t.0)

### Bonding Curve Formula

```
Price(supply) = base_price + slope x (sold_supply / 10_000_000)

Buy cost     = integral of Price ds  (from sold to sold+amount)
Sell proceeds = integral of Price ds  (from sold-amount to sold)
Fee = 0.5% on every trade -> Treasury wallet
```

- **Base price:** 10 stroops/unit
- **Slope:** 750 (price increases linearly with supply sold)
- **Total supply:** 1,000,000,000 tokens (7 decimals -> 10^16 raw units)
- **Fee:** 50 bps (0.5%) per trade

---

## Project Structure

```
stellar-tpad/
├── Dockerfile                        # Multi-stage Docker build
├── railway.toml                      # Railway deployment config
│
└── stellar.tpad/                     # Next.js 14 application
    ├── src/
    │   ├── app/                      # App Router
    │   │   ├── page.tsx              # Main dashboard (home feed)
    │   │   ├── layout.tsx            # Root layout
    │   │   ├── ThemeProvider.tsx     # Dark/light theme
    │   │   ├── api/                  # API route handlers
    │   │   │   ├── tokens/           # Token CRUD + listing
    │   │   │   │   └── [contractAddress]/
    │   │   │   │       ├── route.ts
    │   │   │   │       ├── metrics/  # Trigger metric recalc
    │   │   │   │       ├── holders/
    │   │   │   │       ├── comments/
    │   │   │   │       └── bonding-progress/
    │   │   │   ├── purchases/        # Buy/sell records
    │   │   │   ├── trades/           # Trade history
    │   │   │   ├── ohlcv/            # Candlestick data
    │   │   │   ├── holders/          # Holder list
    │   │   │   ├── comments/         # Token comments
    │   │   │   ├── search/           # Token search
    │   │   │   ├── upload/           # Cloudinary image upload
    │   │   │   ├── wallets/          # Wallet profiles
    │   │   │   └── health/           # Health check (Railway)
    │   │   ├── token/[contractAddress]/
    │   │   │   ├── page.tsx          # Token detail (SSR shell)
    │   │   │   ├── TradingPageClient.tsx  # Trade UI (client)
    │   │   │   ├── loading.tsx
    │   │   │   └── not-found.tsx
    │   │   └── profile/[walletAddress]/
    │   │       └── page.tsx          # User profile page
    │   │
    │   ├── components/
    │   │   ├── common/               # Shared page-level components
    │   │   │   ├── KingOfTheHill.tsx # Top MC token banner
    │   │   │   ├── TrendingCoins.tsx # Trending carousel
    │   │   │   ├── CoinCard.tsx      # Token grid card
    │   │   │   ├── CreateCoinPage.tsx# Token launch form
    │   │   │   ├── FilterBar.tsx     # Sort/filter controls
    │   │   │   ├── BondingCurve.tsx  # Curve visualizer
    │   │   │   ├── TokenInfoBar.tsx  # Price/MC/vol bar
    │   │   │   ├── TokenMetrics.tsx  # Metrics display
    │   │   │   ├── TokenLightweightChart.tsx  # OHLCV chart
    │   │   │   ├── TradingViewChart.tsx
    │   │   │   ├── TransactionTable.tsx
    │   │   │   ├── CommentSection.tsx
    │   │   │   ├── HoldersList.tsx
    │   │   │   ├── LivestreamsPage.tsx
    │   │   │   └── SupportPage.tsx
    │   │   ├── trade/                # Trading panel components
    │   │   │   ├── BondingCurveTrader.tsx  # Buy/sell panel
    │   │   │   ├── TokenLightweightChart.tsx
    │   │   │   ├── TokenInfoBar.tsx
    │   │   │   ├── TokenMetrics.tsx
    │   │   │   ├── TransactionTable.tsx
    │   │   │   ├── CommentSection.tsx
    │   │   │   └── HoldersList.tsx
    │   │   ├── layout/
    │   │   │   ├── Header.tsx        # Top nav + wallet connect
    │   │   │   ├── DolphinLogo.tsx
    │   │   │   └── SimpleHeader.tsx
    │   │   ├── ui/                   # Primitive UI components
    │   │   │   ├── Toast.tsx
    │   │   │   ├── Skeleton.tsx
    │   │   │   ├── ThemeToggle.tsx
    │   │   │   ├── EditProfileModal.tsx
    │   │   │   ├── SettingsModal.tsx
    │   │   │   ├── button.tsx
    │   │   │   ├── input.tsx
    │   │   │   └── modal.tsx
    │   │   └── wallet/
    │   │       ├── connect-button.tsx
    │   │       └── wallet-info.tsx
    │   │
    │   ├── features/                 # Business logic by domain
    │   │   ├── bonding-curve/
    │   │   │   └── bonding-curve.service.ts  # buy/sell/price RPC calls
    │   │   ├── token/
    │   │   │   ├── token.service.ts  # Factory deploy + init
    │   │   │   └── token.logic.ts
    │   │   ├── trade/
    │   │   │   ├── bonding-curve.service.ts
    │   │   │   ├── trade.service.ts
    │   │   │   └── trade.logic.ts
    │   │   ├── wallet/
    │   │   │   ├── wallet.service.ts
    │   │   │   ├── wallet.logic.ts
    │   │   │   └── wallet.types.ts
    │   │   └── auth/
    │   │       ├── auth.service.ts
    │   │       ├── auth.logic.ts
    │   │       └── auth.types.ts
    │   │
    │   ├── lib/                      # Shared utilities
    │   │   ├── db.ts                 # PostgreSQL client (pg)
    │   │   ├── db-schema.ts          # Schema + auto-migrations
    │   │   ├── token-metrics.ts      # Price/volume/marketcap calc
    │   │   ├── background-jobs.ts    # Keepalive + snapshot jobs
    │   │   ├── ohlcv.ts              # OHLCV aggregation
    │   │   ├── helpers.ts            # formatMarketCap, formatVolume...
    │   │   ├── time.ts               # Timestamp parsing
    │   │   └── horizon.ts            # Horizon URL helper
    │   │
    │   ├── config/
    │   │   ├── network.ts            # RPC URL, network passphrase
    │   │   └── contracts.ts          # Contract IDs + constants
    │   │
    │   ├── hooks/
    │   │   ├── useWallet.ts
    │   │   ├── useTransaction.ts
    │   │   ├── useNetwork.ts
    │   │   └── useTheme.tsx
    │   │
    │   ├── services/
    │   │   ├── wallet.service.ts     # StellarWalletsKit wrapper
    │   │   ├── contract.service.ts
    │   │   └── auth.service.ts
    │   │
    │   ├── store/                    # Zustand global state
    │   │   ├── wallet.store.ts
    │   │   └── auth.store.ts
    │   │
    │   └── types/
    │       ├── index.ts              # Coin, Trade, ViewState...
    │       └── token.ts              # TokenRecord, CommentRecord
    │
    ├── contracts/                    # Soroban smart contracts (Rust)
    │   ├── bonding_curve/
    │   │   └── src/
    │   │       ├── lib.rs            # buy(), sell(), register_token()
    │   │       ├── math.rs           # calc_buy_cost, calc_sell_proceeds
    │   │       ├── state.rs          # TokenCurveState, DataKey, errors
    │   │       └── test.rs           # Property-based tests (proptest)
    │   ├── token/
    │   │   └── src/
    │   │       ├── lib.rs            # transfer(), mint(), burn()
    │   │       ├── storage.rs        # Persistent storage helpers
    │   │       ├── types.rs          # TokenError enum
    │   │       └── test.rs
    │   ├── factory/
    │   │   └── src/
    │   │       └── lib.rs            # create_token() — 1-tx deploy+register
    │   └── scripts/
    │       ├── deploy.ts
    │       └── config.ts
    │
    └── instrumentation.ts            # Background jobs bootstrap (Railway)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript 5 |
| Styling | Tailwind CSS 3, Lucide React |
| Charts | Lightweight Charts, Recharts |
| Blockchain | Stellar Soroban, `@stellar/stellar-sdk` v15 |
| Wallet | Freighter, Rabet via `@creit.tech/stellar-wallets-kit` |
| Smart Contracts | Rust (no_std), Soroban SDK |
| Database | PostgreSQL (Neon serverless) |
| Image Storage | Cloudinary |
| State Management | Zustand |
| Deployment | Docker, Railway |
| Testing | Jest, Proptest (Rust property-based tests) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Rust + `soroban-cli`
- PostgreSQL database
- Freighter browser extension
- Cloudinary account

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/your-org/stellar-tpad.git
cd stellar-tpad/stellar.tpad

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Configure environment
cp .env.local.example .env.local
# Fill in your values (see Environment Variables below)

# 4. Initialize database
npm run init-db

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
# Stellar Network
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Smart Contracts
NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID=C...
NEXT_PUBLIC_FACTORY_CONTRACT_ID=C...
NEXT_PUBLIC_TOKEN_WASM_HASH=...

# Database
DATABASE_URL=postgresql://...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Deploy Smart Contracts

```bash
cd stellar.tpad/contracts/bonding_curve
soroban contract build
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/bonding_curve.wasm --network testnet

cd ../token
soroban contract build

cd ../factory
soroban contract build
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/factory.wasm --network testnet
```

## Docker / Railway Deployment

```bash
# Build image locally
docker build -t stellar-tpad \
  --build-arg NEXT_PUBLIC_STELLAR_NETWORK=testnet \
  --build-arg NEXT_PUBLIC_BONDING_CURVE_CONTRACT_ID=C... \
  .

# Run
docker run -p 3000:3000 --env-file .env stellar-tpad
```

Railway deployment is configured via `railway.toml` — push to `main` to trigger auto-deploy.

---

## License

MIT © 2026 Stellar TPad Team
