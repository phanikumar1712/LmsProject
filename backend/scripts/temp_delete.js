require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // First let's check what we have
    const res = await client.query('SELECT id, title, status FROM courses');
    console.log(`Total courses before: ${res.rows.length}`);
    
    const deleteRes = await client.query(`
      DELETE FROM courses 
      WHERE title NOT ILIKE '%test%'
      RETURNING id, title
    `);
    
    console.log(`\nDeleted courses count: ${deleteRes.rows.length}`);
    deleteRes.rows.forEach(r => console.log(`Deleted: ${r.title}`));
    
    const remaining = await client.query('SELECT id, title, status FROM courses');
    console.log(`\nRemaining courses: ${remaining.rows.length}`);
    remaining.rows.forEach(r => console.log(`Keep: ${r.title}`));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

run();
