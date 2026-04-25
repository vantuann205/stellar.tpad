import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
});

export async function query(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result;
}

export async function getClient() {
  return pool.connect();
}

export default pool;
