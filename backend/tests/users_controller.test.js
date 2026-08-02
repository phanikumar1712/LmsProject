const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');

// usersController destructures `query` from '../db/pool' at require time, so we
// inject a fake pool module into require.cache BEFORE loading the controller.
// This keeps the test a pure unit test (no DB connection).
const POOL_PATH = require.resolve('../src/db/pool');
const CONTROLLER_PATH = require.resolve('../src/controllers/usersController');
const LIMITS_PATH = require.resolve('../src/utils/limits');

// bcrypt is a real dependency; use a low cost factor for fast test runs.
const ADMIN_HASH = bcrypt.hashSync('super-secret-pw', 4);

const safeUserRow = (overrides = {}) => ({
    id: 'target-user-id',
    name: 'Old Admin',
    email: 'old.admin@demo.com',
    role: 'INSTRUCTOR',
    phone: '',
    avatar: null,
    bio: null,
    active: true,
    department_id: 'dept-1',
    roll_no: null,
    created_at: new Date().toISOString(),
    ...overrides,
});

// Build a fake pool and a fresh controller instance. Records every query call.
const loadController = (queryImpl) => {
    const calls = [];
    const fakePool = {
        query: async (sql, params) => {
            calls.push({ sql, params });
            return queryImpl(sql, params);
        },
        pool: { connect: async () => { throw new Error('unexpected pool.connect'); } },
    };
    require.cache[POOL_PATH] = {
        id: POOL_PATH,
        filename: POOL_PATH,
        loaded: true,
        exports: fakePool,
    };
    // Force a fresh require so the destructured query picks up our mock.
    // limits.js also destructures `query` at require time, so invalidate it too.
    delete require.cache[CONTROLLER_PATH];
    delete require.cache[LIMITS_PATH];
    const controller = require(CONTROLLER_PATH);
    return { controller, calls };
};

const makeReqRes = ({ role = 'INSTRUCTOR', adminPassword = 'super-secret-pw' } = {}) => {
    const req = {
        user: { id: 'admin-user-id', name: 'Super Admin', role: 'SUPER_ADMIN' },
        params: { id: 'target-user-id' },
        body: { role, reason: 'unit test', adminPassword },
    };
    const res = { json: (payload) => { res.payload = payload; } };
    return { req, res };
};

// A query impl that exercises a single role change. oldRole is what the target
// currently is; newRole is what we're changing them to.
const roleChangeQueryImpl = ({ oldRole, newRole }) => (sql, params) => {
    if (sql.includes('SELECT password FROM users')) {
        return { rows: [{ password: ADMIN_HASH }] };
    }
    if (sql.includes('SELECT name, role FROM users')) {
        return { rows: [{ name: 'Old Admin', role: oldRole }] };
    }
    if (sql.includes('UPDATE users SET role')) {
        return { rows: [safeUserRow({ role: newRole })] };
    }
    if (sql.includes('DELETE FROM admin_departments')) {
        return { rows: [] };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
    }
    return { rows: [] };
};

test('demoting an ADMIN to INSTRUCTOR deletes their admin_departments rows', async () => {
    const { controller, calls } = loadController(
        roleChangeQueryImpl({ oldRole: 'ADMIN', newRole: 'INSTRUCTOR' })
    );
    const { req, res } = makeReqRes();

    await controller.updateRole(req, res);

    // The DELETE must have been issued for the target user.
    const deletes = calls.filter(c => c.sql.includes('DELETE FROM admin_departments'));
    assert.equal(deletes.length, 1);
    assert.deepEqual(deletes[0].params, ['target-user-id']);

    // The role update still succeeded.
    assert.equal(res.payload.role, 'INSTRUCTOR');
});

test('demoting an ADMIN to STUDENT also deletes their admin_departments rows', async () => {
    const { controller, calls } = loadController(
        roleChangeQueryImpl({ oldRole: 'ADMIN', newRole: 'STUDENT' })
    );
    const { req, res } = makeReqRes({ role: 'STUDENT' });

    await controller.updateRole(req, res);

    const deletes = calls.filter(c => c.sql.includes('DELETE FROM admin_departments'));
    assert.equal(deletes.length, 1);
    assert.deepEqual(deletes[0].params, ['target-user-id']);
    assert.equal(res.payload.role, 'STUDENT');
});

test('promoting a STUDENT to INSTRUCTOR does NOT touch admin_departments', async () => {
    const { controller, calls } = loadController(
        roleChangeQueryImpl({ oldRole: 'STUDENT', newRole: 'INSTRUCTOR' })
    );
    const { req, res } = makeReqRes();

    await controller.updateRole(req, res);

    assert.equal(calls.some(c => c.sql.includes('DELETE FROM admin_departments')), false);
    assert.equal(res.payload.role, 'INSTRUCTOR');
});

test('promoting an INSTRUCTOR to ADMIN preserves admin_departments rows', async () => {
    const { controller, calls } = loadController(
        roleChangeQueryImpl({ oldRole: 'INSTRUCTOR', newRole: 'ADMIN' })
    );
    const { req, res } = makeReqRes({ role: 'ADMIN' });

    await controller.updateRole(req, res);

    // Only SUPER_ADMIN may assign admin roles — we are, so it proceeds.
    assert.equal(calls.some(c => c.sql.includes('DELETE FROM admin_departments')), false);
    assert.equal(res.payload.role, 'ADMIN');
});

test('a wrong admin password blocks the demotion and never deletes junction rows', async () => {
    const { controller, calls } = loadController(
        roleChangeQueryImpl({ oldRole: 'ADMIN', newRole: 'INSTRUCTOR' })
    );
    const { req } = makeReqRes({ adminPassword: 'wrong-password' });

    await assert.rejects(
        () => controller.updateRole(req, {}),
        /Incorrect password/
    );

    // No UPDATE, no DELETE — the change was aborted before any mutation.
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET role')), false);
    assert.equal(calls.some(c => c.sql.includes('DELETE FROM admin_departments')), false);
});

// ── inviteAdmin ─────────────────────────────────────────────────────────────

test('inviteAdmin rejects a duplicate email with 409 before creating anything', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT id FROM users WHERE email = $1')) {
            return { rows: [{ id: 'existing-user' }] };
        }
        return { rows: [] };
    });

    const req = {
        user: { id: 'actor-id', name: 'Super Admin' },
        body: { name: 'New Admin', email: '  NewAdmin@Demo.COM ', role: 'ADMIN', password: 'password123' },
    };

    await assert.rejects(
        () => controller.inviteAdmin(req, {}),
        (err) => {
            assert.equal(err.statusCode, 409);
            assert.match(err.message, /User already exists/);
            return true;
        }
    );

    // The lookup email is normalized (trim + lowercase) before the check.
    assert.equal(calls[0].params[0], 'newadmin@demo.com');
    // No INSERT ever happened — the 409 short-circuits before creation.
    assert.equal(calls.some(c => c.sql.includes('INSERT INTO users')), false);
});

// ── importStudents ───────────────────────────────────────────────────────────

test('importStudents blocks a department that has reached its student limit', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT value FROM platform_settings')) {
            return { rows: [{ value: { defaultMaxStudentsPerAdmin: 2, defaultMaxCoursesPerAdmin: 100 } }] };
        }
        if (sql.includes('SELECT name, max_students, max_courses FROM departments')) {
            return { rows: [] }; // no dept override → platform default (2)
        }
        // IMPORTANT: the dup-roll query also contains "role = 'STUDENT'" — check
        // roll BEFORE the student-count branch so the dispatcher never confuses them.
        if (sql.includes('SELECT 1 FROM users WHERE roll_no = $1')) {
            return { rows: [] }; // roll free
        }
        if (sql.includes("COUNT(*)::int AS c FROM users WHERE department_id = $1 AND role = 'STUDENT'")) {
            return { rows: [{ c: 2 }] }; // already at the limit
        }
        if (sql.includes("role = 'ADMIN' AND active = true")) {
            return { rows: [{ id: 'dept-admin-1' }] }; // dept admin gets notified
        }
        if (sql.includes("role = 'SUPER_ADMIN' AND active = true")) {
            return { rows: [{ id: 'super-1' }] }; // super admin notified for review
        }
        if (sql.includes('FROM notifications WHERE user_id')) {
            return { rows: [] }; // no recent limit notification → dedupe passes
        }
        if (sql.includes('SELECT id FROM users WHERE email = $1')) {
            return { rows: [] }; // email free
        }
        return { rows: [] };
    });

    // Real XLSX buffer with one student row so the parser path is real.
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([
        { name: 'Jane Doe', email: 'jane@demo.com', roll_no: 'CS22001', phone: '9876543210' },
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const req = {
        user: { id: 'actor-id', name: 'Admin', role: 'SUPER_ADMIN' },
        body: { departmentId: 'dept-1' }, // resolveTargetDepartment → dept-1
        file: { buffer },
    };
    const res = {
        statusCode: 0,
        payload: null,
        status(c) { this.statusCode = c; return this; },
        json(p) { this.payload = p; return this; },
    };

    await controller.importStudents(req, res);

    // The import aggregates per-row outcomes — the blocked row is an 'error'.
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.created, 0);
    assert.equal(res.payload.failed, 1);
    assert.match(res.payload.results[0].error, /Student limit reached for this department \(2\/2\)/);
    // No student was inserted.
    assert.equal(calls.some(c => c.sql.includes('INSERT INTO users')), false);
    // Dept admin + super admin were notified for a limit-review discussion.
    const notifInserts = calls.filter(c => c.sql.includes('INSERT INTO notifications'));
    assert.ok(notifInserts.length >= 2);
    assert.ok(notifInserts.every(c => c.params[1].includes('student limit reached')));
});

test('importStudents flags a duplicate roll number as a per-row error, not a crash', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT id FROM users WHERE email = $1')) {
            return { rows: [] }; // email is free
        }
        if (sql.includes('SELECT 1 FROM users WHERE roll_no = $1')) {
            return { rows: [{ '?column?': 1 }] }; // roll already taken in this dept
        }
        return { rows: [] };
    });

    // Build a real XLSX buffer with one student row so the parser path is real.
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([
        { name: 'Jane Doe', email: 'jane@demo.com', roll_no: 'CS22001', phone: '9876543210' },
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const req = {
        user: { id: 'actor-id', name: 'Admin', role: 'SUPER_ADMIN' },
        body: {}, // no departmentId → resolveTargetDepartment returns null
        file: { buffer },
    };
    const res = {
        statusCode: 0,
        payload: null,
        status(c) { this.statusCode = c; return this; },
        json(p) { this.payload = p; return this; },
    };

    await controller.importStudents(req, res);

    // Imports aggregate per-row outcomes — the dup-roll row is an 'error', not a throw.
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.total, 1);
    assert.equal(res.payload.created, 0);
    assert.equal(res.payload.failed, 1);
    assert.equal(res.payload.results[0].status, 'error');
    assert.match(res.payload.results[0].error, /Roll number is already taken in this department/);
    // No student was inserted.
    assert.equal(calls.some(c => c.sql.includes('INSERT INTO users')), false);
});

// ── setAdminDepartments ──────────────────────────────────────────────────────

test('setAdminDepartments rejects a non-admin target with 400', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT id, role, department_id FROM users')) {
            return { rows: [{ id: 'target-id', role: 'INSTRUCTOR', department_id: 'dept-1' }] };
        }
        return { rows: [] };
    });

    const req = {
        user: { id: 'actor-id' },
        params: { id: 'target-id' },
        body: { departmentIds: ['dept-1'] },
    };

    await assert.rejects(
        () => controller.setAdminDepartments(req, {}),
        (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /Only admin users can be assigned to departments/);
            return true;
        }
    );

    // No junction rows were touched.
    assert.equal(calls.some(c => c.sql.includes('DELETE FROM admin_departments')), false);
});

test('setAdminDepartments rejects a SUPER_ADMIN target with 400', async () => {
    const { controller } = loadController((sql) => {
        if (sql.includes('SELECT id, role, department_id FROM users')) {
            return { rows: [{ id: 'super-id', role: 'SUPER_ADMIN', department_id: null }] };
        }
        return { rows: [] };
    });

    const req = {
        user: { id: 'actor-id' },
        params: { id: 'super-id' },
        body: { departmentIds: ['dept-1'] },
    };

    await assert.rejects(
        () => controller.setAdminDepartments(req, {}),
        /Super Admins cannot be department-bound/
    );
});

test('setAdminDepartments rejects a non-array departmentIds with 400', async () => {
    const { controller, calls } = loadController(() => ({ rows: [] }));

    const req = {
        user: { id: 'actor-id' },
        params: { id: 'target-id' },
        body: { departmentIds: 'dept-1' },
    };

    await assert.rejects(
        () => controller.setAdminDepartments(req, {}),
        (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /departmentIds must be an array/);
            return true;
        }
    );

    // The validation fails before any DB query.
    assert.equal(calls.length, 0);
});

// Restore the real pool module so other test files in the same process are unaffected.
test.after(() => {
    delete require.cache[POOL_PATH];
});
