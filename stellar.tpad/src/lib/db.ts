import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
});

pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
});

export async function query(text: string, params?: any[]) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.warn('Slow query detected', { text: text.substring(0, 100), duration, rows: result.rowCount });
        }
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

export async function getClient() {
    const client = await pool.connect();
    return client;
}

export default pool;
