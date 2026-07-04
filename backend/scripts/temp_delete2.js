const { query } = require('../src/db/pool');

async function run() {
    try {
        const res = await query('SELECT id, title FROM courses');
        console.log(`Total courses before: ${res.rows.length}`);

        const deleteRes = await query(`
      DELETE FROM courses 
      WHERE title NOT ILIKE '%test%'
      RETURNING id, title
    `);

        console.log(`\nDeleted courses count: ${deleteRes.rows.length}`);
        deleteRes.rows.forEach(r => console.log(`Deleted: ${r.title}`));

        const remaining = await query('SELECT id, title FROM courses');
        console.log(`\nRemaining courses: ${remaining.rows.length}`);
        remaining.rows.forEach(r => console.log(`Keep: ${r.title}`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

run();
