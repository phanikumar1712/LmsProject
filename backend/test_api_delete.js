const { pool } = require('./src/db/pool');
const jwt = require('jsonwebtoken');
require('dotenv').config();

(async () => {
    try {
        const result = await pool.query("SELECT id FROM users LIMIT 1");
        if (!result.rows.length) return console.log('no user');
        const userId = result.rows[0].id;

        // generate SUPER_ADMIN token (bypasses instructor check)
        const token = jwt.sign({ id: userId, role: 'SUPER_ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const courseQuery = await pool.query("SELECT id, title FROM courses LIMIT 1");
        if (courseQuery.rows.length === 0) {
            const insertResult = await pool.query(
                "INSERT INTO courses (title, instructor_id, status) VALUES ('Test Course 123', $1, 'DRAFT') RETURNING id, title",
                [userId]
            );
            console.log("Created course to delete:", insertResult.rows[0].id);
            courseQuery.rows = insertResult.rows;
        }

        const courseId = courseQuery.rows[0].id;
        console.log("Deleting course via API:", courseId, courseQuery.rows[0].title);

        const delRes = await fetch('http://localhost:5000/api/courses/' + courseId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        const data = await delRes.text();
        console.log('HTTP Status:', delRes.status);
        console.log('Response body:', data);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
})();
