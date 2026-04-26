-- Create tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  description TEXT,
  image_url VARCHAR(255),
  social_link VARCHAR(255),
  total_supply BIGINT DEFAULT 0,
  owner VARCHAR(255) NOT NULL,
  contract_address VARCHAR(255) NOT NULL UNIQUE,
  -- Market metrics
  current_price NUMERIC(36, 18) DEFAULT 0,
  marketcap NUMERIC(36, 18) DEFAULT 0,
  volume_24h NUMERIC(36, 18) DEFAULT 0,
  price_change_5m NUMERIC(10, 4) DEFAULT 0,
  price_change_1h NUMERIC(10, 4) DEFAULT 0,
  price_change_4h NUMERIC(10, 4) DEFAULT 0,
  price_change_6h NUMERIC(10, 4) DEFAULT 0,
  price_change_24h NUMERIC(10, 4) DEFAULT 0,
  trader_count INTEGER DEFAULT 0,
  -- Timestamp tracking for price changes
  price_snapshot_time TIMESTAMP,
  price_snapshot_value NUMERIC(36, 18),
  -- Cache timestamp for metrics
  metrics_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table (for mint/transfer events)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  from_address VARCHAR(255) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  amount BIGINT NOT NULL,
  transaction_hash VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create purchases table (for token buys/sells in marketplace)
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
  status VARCHAR(50) DEFAULT 'completed', -- completed, pending, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallets table to store wallet/user information
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  avatar_url VARCHAR(255),
  bio TEXT,
  -- Array fields to track owned and minted coins
  owned_coins TEXT[] DEFAULT ARRAY[]::TEXT[],
  minted_coins TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Timestamp tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create price_snapshots table for price history tracking
CREATE TABLE IF NOT EXISTS price_snapshots (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  price NUMERIC(36, 18) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comments table for token comments
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  user_address VARCHAR(255) NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create token_bonding_progress table for bonding curve progress tracking
CREATE TABLE IF NOT EXISTS token_bonding_progress (
  token_id INTEGER PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
  max_reserve NUMERIC(30, 18) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tokens_owner ON tokens(owner);
CREATE INDEX IF NOT EXISTS idx_tokens_contract_address ON tokens(contract_address);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_marketcap ON tokens(marketcap DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_metrics_updated ON tokens(metrics_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_current_price ON tokens(current_price DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_token_id ON transactions(token_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_token_id ON purchases(token_id);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer_address);
CREATE INDEX IF NOT EXISTS idx_purchases_seller ON purchases(seller_address);
CREATE INDEX IF NOT EXISTS idx_purchases_is_private ON purchases(is_private);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_token_status ON purchases(token_id, status);
CREATE INDEX IF NOT EXISTS idx_purchases_token_status_created ON purchases(token_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallets_display_name ON wallets(display_name);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_token_id ON price_snapshots(token_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_token_id ON comments(token_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_token_bonding_progress_token_id ON token_bonding_progress(token_id);
