const { Client } = require('pg');

async function fix() {
    const config = {
        host: '54.209.204.248',
        port: 5432,
        user: 'neondb_owner',
        password: 'REDACTED',
        database: 'neondb',
        ssl: {
            rejectUnauthorized: false,
            servername: 'ep-withered-mode-am2a8xup-pooler.c-5.us-east-1.aws.neon.tech'
        }
    };

    let client;
    let success = false;
    for (let i = 0; i < 15; i++) {
        client = new Client(config);
        try {
            await client.connect();
            await client.query(`
              ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
              ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_desc TEXT DEFAULT '';
              ALTER TABLE courses ADD COLUMN IF NOT EXISTS certificate BOOLEAN DEFAULT true;
              
              ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '';
              ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
              ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
          `);
            console.log("✅ Schema updated successfully with missing columns");
            success = true;
            break;
        } catch (e) {
            console.log(`Attempt ${i + 1} failed:`, e.message);
            await new Promise(r => setTimeout(r, 2000));
        } finally {
            await client.end().catch(() => { });
        }
    }

    if (!success) console.error("❌ Schema update completely failed after 15 attempts");
}

fix();
