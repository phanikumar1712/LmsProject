require('dotenv').config();
const { pool } = require('./src/db/pool');

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS instructor_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                bio TEXT,
                expertise VARCHAR(255),
                experience VARCHAR(50),
                sample_topic VARCHAR(255),
                linkedin VARCHAR(255),
                youtube VARCHAR(255),
                status VARCHAR(50) DEFAULT 'PENDING',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log("Table created.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
