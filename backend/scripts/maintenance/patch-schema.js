/**
 * Apply column patches without re-running full migrate.
 * Usage: node scripts/patch-schema.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

async function run() {
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE subscription_plans
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        `);
        await client.query(`
            ALTER TABLE enrollments
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
        `);
        await client.query(`
            ALTER TABLE notifications
            ADD COLUMN IF NOT EXISTS link TEXT DEFAULT '';
        `);
        await client.query(`
            UPDATE enrollments SET completed_at = last_accessed
            WHERE progress >= 100 AND completed_at IS NULL;
        `);
        console.log('Schema patches applied.');
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
