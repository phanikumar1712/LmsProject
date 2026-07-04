const fs = require('fs');
const { Pool } = require('pg');

const envFile = fs.readFileSync('./.env', 'utf8');
const match = envFile.match(/DATABASE_URL=(["']?)([^\s"']+)\1/);
if (!match) throw new Error("Could not extract string");
const dbUrl = match[2];

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
});

pool.query("DELETE FROM courses WHERE id = '4a2e1e5e-5f83-4033-8694-daba83657d94' RETURNING id")
    .then(r => console.log("DELETED SUCCESSFULLY:", r.rows))
    .catch(e => console.log("PG ERROR:", e.message))
    .finally(() => pool.end());
