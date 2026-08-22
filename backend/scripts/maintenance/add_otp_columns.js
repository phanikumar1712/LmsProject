// One-off migration helper: add reset_otp columns to users.
// Uses DATABASE_URL from backend/.env — never hardcode credentials.
require('dotenv').config();
const { Client } = require('pg');

async function addOtpColumns() {
    const config = { connectionString: process.env.DATABASE_URL };

    let success = false;
    for (let i = 0; i < 15; i++) {
        const client = new Client(config);
        try {
            await client.connect();
            console.log(`Connected to database (attempt ${i + 1})...`);

            await client.query(`
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(6),
                ADD COLUMN IF NOT EXISTS reset_otp_expiry TIMESTAMP;
            `);

            console.log("✅ Successfully added reset_otp and reset_otp_expiry columns to users table.");
            success = true;
            await client.end();
            break;
        } catch (err) {
            console.error(`Attempt ${i + 1} failed:`, err.message);
            await client.end().catch(() => { });
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!success) {
        console.error("❌ Schema update completely failed after 15 attempts");
    }
}

addOtpColumns();
