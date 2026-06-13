const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://psqladmin:phanikumar@localhost:5432/lllms' });
pool.query('SELECT status, COUNT(*) FROM courses GROUP BY status').then(r => { console.log(r.rows); pool.end(); }).catch(e => console.error(e));
