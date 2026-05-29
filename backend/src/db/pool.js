const { Pool } = require('pg');
const { URL } = require('url');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const parsed = new URL(process.env.DATABASE_URL);

const pool = new Pool({
    host: parsed.hostname,
    port: parsed.port || 5432,
    database: parsed.pathname.slice(1),
    user: parsed.username,
    password: parsed.password,
    ssl: {
        rejectUnauthorized: false,
        servername: parsed.hostname
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle DB client (NeonDB may have closed it)', err.message);
});

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
