import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../src/lib/db';

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    
    const migrationPath = join(process.cwd(), 'migrations', 'add-performance-fields.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Running migration...');
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
