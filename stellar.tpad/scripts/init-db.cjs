require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing in .env.local');
  process.exit(1);
}

const sql = `
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
  trader_count INTEGER DEFAULT 0,
  price_snapshot_time TIMESTAMP,
  price_snapshot_value NUMERIC(36, 18),
  bonding_curve_contract VARCHAR(255),
  bonding_curve_registered BOOLEAN DEFAULT FALSE,
  sold_supply NUMERIC(36, 18) DEFAULT 0,
  current_price NUMERIC(36, 18) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  from_address VARCHAR(255) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  amount NUMERIC(36, 18) NOT NULL,
  transaction_hash VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  avatar_url VARCHAR(255),
  bio TEXT,
  owned_coins TEXT[] DEFAULT ARRAY[]::TEXT[],
  minted_coins TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  user_address VARCHAR(255) NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_bonding_progress (
  token_id INTEGER PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
  max_reserve NUMERIC(30, 18) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
`;

(async () => {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query(sql);
    console.log('Database schema initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database schema:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
