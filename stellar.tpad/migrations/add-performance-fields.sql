-- Add new performance fields to tokens table
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS current_price NUMERIC(36, 18) DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS price_change_24h NUMERIC(10, 4) DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMP;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_tokens_metrics_updated ON tokens(metrics_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_current_price ON tokens(current_price DESC);
