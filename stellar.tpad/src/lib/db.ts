import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // 10s — enough for Neon serverless cold start
    maxUses: 7500,
});

pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
});

/**
 * Execute a query with automatic retry on connection timeout (Neon serverless cold start).
 * Retries up to 3 times with 2s delay.
 */
export async function query(text: string, params?: any[]): Promise<any> {
    const MAX_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const start = Date.now();
            const result = await pool.query(text, params);
            const duration = Date.now() - start;
            if (duration > 1000) {
                console.warn('Slow query detected', { text: text.substring(0, 100), duration, rows: result.rowCount });
            }
            return result;
        } catch (error: unknown) {
            lastError = error;
            const msg = error instanceof Error ? error.message : String(error);
            const isTimeout = msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('Connection terminated');

            if (isTimeout && attempt < MAX_RETRIES) {
                console.warn(`[db] Connection timeout (attempt ${attempt}/${MAX_RETRIES}), retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            console.error('Database query error:', error);
            throw error;
        }
    }

    throw lastError;
}

export async function getClient() {
    const client = await pool.connect();
    return client;
}

export default pool;
