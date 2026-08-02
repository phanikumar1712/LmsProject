const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');

// usersController destructures `query` from '../db/pool' at require time, so we
// inject a fake pool module into require.cache BEFORE loading the controller.
// This keeps the test a pure unit test (no DB connection).
const POOL_PATH = require.resolve('../src/db/pool');
const CONTROLLER_PATH = require.resolve('../src/controllers/usersController');

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
    delete require.cache[CONTROLLER_PATH];
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

// Restore the real pool module so other test files in the same process are unaffected.
test.after(() => {
    delete require.cache[POOL_PATH];
});
