// Apply the admin_departments role backstop trigger to the live DB.
// Run: node scripts/apply_admin_dept_trigger.js
//
// Source of truth for the DDL lives in src/db/migrate.js (kept in sync there);
// this script exists so an existing database is protected without re-running
// the full migration. The verification writes below are leave-no-trace.
require('dotenv').config();
const { query } = require('../src/db/pool');

const main = async () => {
    // 1. Trigger function (idempotent)
    await query(`
        CREATE OR REPLACE FUNCTION enforce_admin_departments_role()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM users
                WHERE id = NEW.user_id AND role IN ('ADMIN', 'SUPER_ADMIN')
            ) THEN
                RAISE EXCEPTION 'Only ADMIN or SUPER_ADMIN users can be assigned to departments (user_id: %)', NEW.user_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // 2. Trigger (idempotent)
    await query('DROP TRIGGER IF EXISTS trg_admin_departments_role ON admin_departments;');
    await query(`
        CREATE TRIGGER trg_admin_departments_role
        BEFORE INSERT OR UPDATE ON admin_departments
        FOR EACH ROW EXECUTE FUNCTION enforce_admin_departments_role();
    `);

    // 3. Clean legacy rows left before the app-side demote fix existed
    const cleaned = await query(`
        DELETE FROM admin_departments ad
        WHERE NOT EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = ad.user_id AND u.role IN ('ADMIN', 'SUPER_ADMIN')
        )
        RETURNING ad.user_id;
    `);
    console.log('✅ trigger created; legacy rows removed:', cleaned.rows.length);

    // 4. Verify: non-admin insert must be blocked; admin insert allowed; trigger exists
    const dept = await query('SELECT id FROM departments LIMIT 1');
    const stud = await query("SELECT id FROM users WHERE role='STUDENT' LIMIT 1");
    const admin = await query("SELECT id FROM users WHERE role IN ('ADMIN','SUPER_ADMIN') LIMIT 1");
    if (!dept.rows.length || !stud.rows.length || !admin.rows.length) {
        throw new Error('Missing dept/student/admin to verify against');
    }

    let blocked = false;
    try {
        await query('INSERT INTO admin_departments (user_id, department_id) VALUES ($1,$2)', [stud.rows[0].id, dept.rows[0].id]);
    } catch (e) {
        blocked = /ADMIN|SUPER_ADMIN/i.test(e.message);
        if (!blocked) throw e;
    }
    console.log('non-admin insert blocked by trigger:', blocked);

    let adminInsertAllowed = false;
    const client = await query.pool.connect();
    try {
        // Verify the admin insert inside a rolled-back transaction so the
        // script leaves no trace on the live DB.
        await client.query('BEGIN');
        await client.query(
            'INSERT INTO admin_departments (user_id, department_id) VALUES ($1,$2)',
            [admin.rows[0].id, dept.rows[0].id]
        );
        adminInsertAllowed = true;
        await client.query('ROLLBACK');
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        client.release();
    }
    console.log('admin insert allowed:', adminInsertAllowed);

    const trg = await query("SELECT tgname FROM pg_trigger WHERE tgname='trg_admin_departments_role'");
    console.log('trigger exists:', trg.rows.length > 0);

    process.exit(0);
};

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
