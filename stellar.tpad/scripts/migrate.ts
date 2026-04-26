import { query } from '../src/lib/db';

async function migrate() {
  console.log('Running migration...');
  try {
    await query(`
      ALTER TABLE tokens ADD COLUMN IF NOT EXISTS base_price NUMERIC(36, 18) DEFAULT 0.0001;
      ALTER TABLE tokens ADD COLUMN IF NOT EXISTS slope NUMERIC(36, 18) DEFAULT 0;
    `);
    console.log('Migration successful: base_price and slope added to tokens table.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrate();
