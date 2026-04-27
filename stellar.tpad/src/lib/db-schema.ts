import { query } from '@/lib/db';

// All timestamp columns use TIMESTAMPTZ so Postgres always stores UTC
// and returns ISO strings with timezone info (e.g. 2026-04-27T04:23:40.277+00:00)
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  description TEXT,
  image_url VARCHAR(255),
  social_link VARCHAR(255),
  total_supply NUMERIC(36, 18) DEFAULT 0,
  owner VARCHAR(255) NOT NULL,
  contract_address VARCHAR(255) NOT NULL UNIQUE,
  marketcap NUMERIC(36, 18) DEFAULT 0,
  volume_24h NUMERIC(36, 18) DEFAULT 0,
  price_change_5m NUMERIC(10, 4) DEFAULT 0,
  price_change_1h NUMERIC(10, 4) DEFAULT 0,
  price_change_4h NUMERIC(10, 4) DEFAULT 0,
  price_change_6h NUMERIC(10, 4) DEFAULT 0,
  price_change_24h NUMERIC(10, 4) DEFAULT 0,
  trader_count INTEGER DEFAULT 0,
  price_snapshot_time TIMESTAMPTZ,
  price_snapshot_value NUMERIC(36, 18),
  metrics_updated_at TIMESTAMPTZ,
  bonding_curve_contract VARCHAR(255),
  bonding_curve_registered BOOLEAN DEFAULT FALSE,
  sold_supply NUMERIC(36, 18) DEFAULT 0,
  current_price NUMERIC(36, 18) DEFAULT 0,
  base_price NUMERIC(36, 18) DEFAULT 0.0001,
  slope NUMERIC(36, 18) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  from_address VARCHAR(255) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  amount NUMERIC(36, 18) NOT NULL,
  transaction_hash VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  buyer_address VARCHAR(255),
  seller_address VARCHAR(255),
  quantity NUMERIC(36, 18),
  quantity_ciphertext TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  visibility_source VARCHAR(20) NOT NULL DEFAULT 'public',
  price_per_token NUMERIC(36, 18) NOT NULL,
  total_price NUMERIC(36, 18) NOT NULL,
  transaction_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  avatar_url VARCHAR(255),
  bio TEXT,
  owned_coins TEXT[] DEFAULT ARRAY[]::TEXT[],
  minted_coins TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  price NUMERIC(36, 18) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  user_address VARCHAR(255) NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_bonding_progress (
  token_id INTEGER PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
  max_reserve NUMERIC(30, 18) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_owner ON tokens(owner);
CREATE INDEX IF NOT EXISTS idx_tokens_contract_address ON tokens(contract_address);
CREATE INDEX IF NOT EXISTS idx_transactions_token_id ON transactions(token_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_purchases_token_id ON purchases(token_id);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer_address);
CREATE INDEX IF NOT EXISTS idx_purchases_seller ON purchases(seller_address);
CREATE INDEX IF NOT EXISTS idx_purchases_is_private ON purchases(is_private);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallets_display_name ON wallets(display_name);
CREATE INDEX IF NOT EXISTS idx_comments_token_id_created_at ON comments(token_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tokens_metrics_updated ON tokens(metrics_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_token_id ON price_snapshots(token_id, recorded_at DESC);
`;

let schemaPromise: Promise<void> | null = null;

export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(SCHEMA_SQL);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }

  await schemaPromise;

  // Migrations: add missing columns + convert TIMESTAMP → TIMESTAMPTZ for correct UTC storage
  try {
    await query(`
      ALTER TABLE tokens ADD COLUMN IF NOT EXISTS base_price NUMERIC(36, 18) DEFAULT 0.0001;
      ALTER TABLE tokens ADD COLUMN IF NOT EXISTS slope NUMERIC(36, 18) DEFAULT 0;
      ALTER TABLE tokens ADD COLUMN IF NOT EXISTS price_change_24h NUMERIC(10, 4) DEFAULT 0;
      ALTER TABLE tokens ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;
    `);

    // Convert existing TIMESTAMP columns to TIMESTAMPTZ (idempotent — no-op if already TIMESTAMPTZ)
    // We interpret existing values as UTC+7 local time and convert to UTC
    await query(`
      DO $$
      BEGIN
        -- tokens
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='tokens' AND column_name='created_at'
            AND data_type='timestamp without time zone'
        ) THEN
          ALTER TABLE tokens
            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
            ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
            ALTER COLUMN price_snapshot_time TYPE TIMESTAMPTZ USING price_snapshot_time AT TIME ZONE 'Asia/Ho_Chi_Minh',
            ALTER COLUMN metrics_updated_at TYPE TIMESTAMPTZ USING metrics_updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
        END IF;

        -- purchases
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='purchases' AND column_name='created_at'
            AND data_type='timestamp without time zone'
        ) THEN
          ALTER TABLE purchases
            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
            ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
        END IF;

        -- price_snapshots
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='price_snapshots' AND column_name='recorded_at'
            AND data_type='timestamp without time zone'
        ) THEN
          ALTER TABLE price_snapshots
            ALTER COLUMN recorded_at TYPE TIMESTAMPTZ USING recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
        END IF;

        -- wallets
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='wallets' AND column_name='created_at'
            AND data_type='timestamp without time zone'
        ) THEN
          ALTER TABLE wallets
            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
            ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
        END IF;

        -- comments
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='comments' AND column_name='created_at'
            AND data_type='timestamp without time zone'
        ) THEN
          ALTER TABLE comments
            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
        END IF;
      END $$;
    `);
  } catch (err) {
    console.error('Migration error:', err);
  }
}
