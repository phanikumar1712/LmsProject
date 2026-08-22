require('dotenv').config();
const { Pool } = require('pg');

const pool1 = new Pool({ connectionString: process.env.DATABASE_URL });

pool1.query('SELECT NOW()')
    .then(res => console.log("Success pool1:", res.rows))
    .catch(err => console.error("Error pool1:", err))
    .finally(() => process.exit(0));
