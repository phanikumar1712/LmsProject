require('dotenv').config();
const { Pool } = require('pg');

const pool1 = new Pool({
    connectionString: `postgresql://neondb_owner:npg_ZCE4ogI2NWlV@34.206.177.121/neondb?sslmode=require`,
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined, servername: 'ep-withered-mode-am2a8xup.c-5.us-east-1.aws.neon.tech' }
});

pool1.query('SELECT NOW()')
    .then(res => console.log("Success pool1:", res.rows))
    .catch(err => console.error("Error pool1:", err))
    .finally(() => process.exit(0));
