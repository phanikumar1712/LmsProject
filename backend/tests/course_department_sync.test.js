const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const { pool } = require('../src/db/pool');

// DB-backed regression test for the denormalized courses.department_id column.
//
// Requires a live database (NODE_ENV != production, DATABASE_URL set). Run with:
//   npm run test:db
// (Intentionally NOT part of `test:unit`, which fakes the pool and must stay
// DB-free.)
//
// Proves two things:
//   1. INVARIANT — every course row's department_id equals the value the old
//      derived queries computed: COALESCE(category.department_id,
//      instructor.department_id).
//   2. SYNC — the three migration triggers keep the column correct across every
//      mutation path (create, category change, category dept change, category
//      delete, instructor dept change). All fixture rows are cleaned up.

const SYNC_TRIGGERS = [
    'trg_courses_sync_department',
    'trg_categories_sync_courses',
    'trg_users_sync_courses_dept',
];

// ── 1. Invariant across all existing rows ────────────────────────────────────
test('every existing course matches the derived category/instructor department', async () => {
    const r = await pool.query(`
        SELECT COUNT(*)::int AS mismatches
        FROM courses c
        LEFT JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN users u ON u.id = c.instructor_id
        WHERE c.department_id IS DISTINCT FROM COALESCE(cat.department_id, u.department_id)
    `);
    assert.equal(r.rows[0].mismatches, 0,
        `${r.rows[0].mismatches} course(s) have a stale department_id`);
});

// ── 2. Sync triggers exist (created by npm run migrate) ──────────────────────
test('all three department-sync triggers are installed', async () => {
    const r = await pool.query(
        `SELECT tgname FROM pg_trigger WHERE tgname = ANY($1::text[])`,
        [SYNC_TRIGGERS]
    );
    const present = new Set(r.rows.map(row => row.tgname));
    const missing = SYNC_TRIGGERS.filter(name => !present.has(name));
    assert.deepEqual(missing, [], `missing trigger(s): ${missing.join(', ')} — re-run npm run migrate`);
});

// ── 3. Trigger behavior across every mutation path ───────────────────────────
test('department_id stays in sync across create/category/instructor changes', async () => {
    const client = await pool.connect();
    const created = { departments: [], categories: [], users: [], courses: [] };
    const cleanup = async () => {
        if (created.courses.length) await client.query(`DELETE FROM courses WHERE id = ANY($1::uuid[])`, [created.courses]).catch(() => { });
        if (created.users.length) await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [created.users]).catch(() => { });
        if (created.categories.length) await client.query(`DELETE FROM categories WHERE id = ANY($1::uuid[])`, [created.categories]).catch(() => { });
        if (created.departments.length) await client.query(`DELETE FROM departments WHERE id = ANY($1::uuid[])`, [created.departments]).catch(() => { });
    };

    try {
        const insert = async (sql, params, bucket) => {
            const r = await client.query(sql, params);
            created[bucket].push(r.rows[0].id);
            return r.rows[0].id;
        };
        const deptOf = async (courseId) =>
            (await client.query('SELECT department_id FROM courses WHERE id = $1', [courseId])).rows[0].department_id;

        const deptA = await insert(`INSERT INTO departments (name) VALUES ('Sync Dept A') RETURNING id`, [], 'departments');
        const deptB = await insert(`INSERT INTO departments (name) VALUES ('Sync Dept B') RETURNING id`, [], 'departments');
        const catA = await insert(`INSERT INTO categories (name, department_id) VALUES ('Sync Cat A', $1) RETURNING id`, [deptA], 'categories');
        const catB = await insert(`INSERT INTO categories (name, department_id) VALUES ('Sync Cat B', $1) RETURNING id`, [deptB], 'categories');
        const inst = await insert(
            `INSERT INTO users (name, email, password, role, department_id) VALUES ('Sync Instr', 'sync.instr@demo.com', 'x', 'INSTRUCTOR', $1) RETURNING id`,
            [deptA], 'users');

        // (a) INSERT with a category → department = category's department
        const c1 = await insert(
            `INSERT INTO courses (title, instructor_id, category_id, status) VALUES ('Sync Course 1', $1, $2, 'DRAFT') RETURNING id`,
            [inst, catA], 'courses');
        assert.equal(await deptOf(c1), deptA, 'categorized insert should take the category department');

        // (b) INSERT uncategorized → falls back to the instructor's department
        const c2 = await insert(
            `INSERT INTO courses (title, instructor_id, category_id, status) VALUES ('Sync Course 2', $1, NULL, 'DRAFT') RETURNING id`,
            [inst], 'courses');
        assert.equal(await deptOf(c2), deptA, 'uncategorized insert should fall back to instructor department');

        // (c) UPDATE category_id → re-derives
        await client.query('UPDATE courses SET category_id = $1 WHERE id = $2', [catB, c1]);
        assert.equal(await deptOf(c1), deptB, 'category change should re-derive the department');

        // (d) UPDATE a category's department → cascades to its courses
        await client.query('UPDATE categories SET department_id = $1 WHERE id = $2', [deptA, catB]);
        assert.equal(await deptOf(c1), deptA, 'category department change should cascade to its courses');

        // (e) DELETE the category (FK SET NULL) → course becomes uncategorized → instructor fallback
        await client.query('DELETE FROM categories WHERE id = $1', [catB]);
        assert.equal(await deptOf(c1), deptA, 'category delete should fall back to instructor department');

        // (f) UPDATE the instructor's department → re-derives their uncategorized courses,
        //     but categorized courses stay with their category
        await client.query('UPDATE users SET department_id = $1 WHERE id = $2', [deptB, inst]);
        assert.equal(await deptOf(c2), deptB, 'instructor department change should re-derive uncategorized courses');
        const c3 = await insert(
            `INSERT INTO courses (title, instructor_id, category_id, status) VALUES ('Sync Course 3', $1, $2, 'DRAFT') RETURNING id`,
            [inst, catA], 'courses');
        assert.equal(await deptOf(c3), deptA, 'categorized course must ignore the instructor department');
    } finally {
        await cleanup();
        client.release();
    }
});
