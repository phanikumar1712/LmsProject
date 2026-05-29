const { Client } = require('pg');

async function fix() {
    const config = {
        host: '54.209.204.248',
        port: 5432,
        user: 'neondb_owner',
        password: 'npg_ZCE4ogI2NWlV',
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
              DO $$ BEGIN
                  CREATE TYPE subscription_plan AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');
              EXCEPTION WHEN duplicate_object THEN null; END $$;
          `);

            await client.query(`
              ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
              ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_desc TEXT DEFAULT '';
              ALTER TABLE courses ADD COLUMN IF NOT EXISTS certificate BOOLEAN DEFAULT true;
              ALTER TABLE courses ADD COLUMN IF NOT EXISTS required_plan subscription_plan DEFAULT 'FREE';
              
              ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '';
              ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
              ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
              ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan subscription_plan NOT NULL DEFAULT 'FREE';
              ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expiry DATE;
              ALTER TABLE users ADD COLUMN IF NOT EXISTS earnings DECIMAL(10,2) DEFAULT 0;
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
