import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
}

async function initDatabase() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        console.log('🔌 Connecting to database...');
        const client = await pool.connect();
        console.log('✅ Connected to database');

        // Read schema.sql
        const schemaPath = path.join(__dirname, '../schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        console.log('📝 Running schema.sql...');
        await client.query(schema);
        console.log('✅ Schema created successfully');

        // Check tables
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);

        console.log('\n📊 Tables created:');
        tablesResult.rows.forEach((row: any) => {
            console.log(`  - ${row.table_name}`);
        });

        client.release();
        await pool.end();
        console.log('\n✅ Database initialization complete!');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        await pool.end();
        process.exit(1);
    }
}

initDatabase();
