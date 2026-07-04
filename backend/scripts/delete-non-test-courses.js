require('dotenv').config();
const { pool, query } = require('../src/db/pool');

async function main() {
    try {
        // First, list all courses
        const result = await query('SELECT id, title, status FROM courses ORDER BY created_at DESC');
        console.log('All courses:');
        result.rows.forEach(c => console.log(`  [${c.status}] ${c.id}: ${c.title}`));

        // Delete all courses that don't have 'test' or 'testing' in title (case-insensitive)
        // This keeps any "testing" courses as the user requested
        const deleteResult = await query(`
            DELETE FROM courses 
            WHERE title NOT ILIKE '%test%'
            RETURNING id, title
        `);
        console.log('\nDeleted courses:');
        deleteResult.rows.forEach(c => console.log(`  ${c.id}: ${c.title}`));
        console.log(`\nTotal deleted: ${deleteResult.rows.length}`);

        // Show remaining
        const remaining = await query('SELECT id, title, status FROM courses');
        console.log('\nRemaining courses:');
        remaining.rows.forEach(c => console.log(`  [${c.status}] ${c.id}: ${c.title}`));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
