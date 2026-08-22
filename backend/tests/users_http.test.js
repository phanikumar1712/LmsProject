const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Exercise the FULL HTTP stack for the role-change endpoint:
//   authenticate (JWT) → authorize (role gate) → updateRole (admin-password gate)
// exactly like a real client would, but with the DB pool mocked so no live DB
// is touched. Same require.cache injection technique as users_controller.test.js
// (both the router's auth middleware and the controller destructure `query` from
// '../db/pool' at require time).
const POOL_PATH = require.resolve('../src/db/pool');
const ROUTER_PATH = require.resolve('../src/routes/users');

process.env.JWT_SECRET = 'test-http-secret';

const ADMIN_HASH = bcrypt.hashSync('super-secret-pw', 4);

const actorRow = (overrides = {}) => ({
    id: 'actor-user-id',
    name: 'Super Admin',
    email: 'super@demo.com',
    role: 'SUPER_ADMIN',
    avatar: null,
    bio: null,
    active: true,
    department_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
});

const targetRow = (role) => ({
    id: 'target-user-id',
    name: 'Old Admin',
    email: 'old.admin@demo.com',
    role,
    phone: '',
    avatar: null,
    bio: null,
    active: true,
    department_id: 'dept-1',
    roll_no: null,
    created_at: new Date().toISOString(),
});

// Records every (sql, params) call so tests can assert what was / wasn't issued.
let calls = [];

// Dispatches the fake pool's responses based on SQL content. `scenario` lets a
// test override the actor role, the target's old role, and the password hash.
const makeQueryImpl = ({ actor = actorRow(), oldRole = 'ADMIN', adminHash = ADMIN_HASH } = {}) =>
    (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('SELECT password FROM users')) {
            return { rows: [{ password: adminHash }] };
        }
        if (sql.includes('SELECT name, role FROM users')) {
            return { rows: [{ name: 'Old Admin', role: oldRole }] };
        }
        if (sql.includes('SELECT id, role, department_id FROM users WHERE id = $1')) {
            return { rows: [{ id: 'target-user-id', role: oldRole, department_id: 'dept-1' }] };
        }
        if (sql.includes('SELECT id, name, email, role, avatar, bio, active, department_id, created_at, must_change_password FROM users WHERE id = $1')) {
            return { rows: [actor] };
        }
        if (sql.includes('UPDATE users SET role')) {
            return { rows: [targetRow('INSTRUCTOR')] };
        }
        if (sql.includes('DELETE FROM admin_departments')) {
            return { rows: [] };
        }
        if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [] };
        }
        return { rows: [] };
    };

// Build the router with a mocked pool (fresh require so it picks up the mock).
let queryImpl = makeQueryImpl();
require.cache[POOL_PATH] = {
    id: POOL_PATH,
    filename: POOL_PATH,
    loaded: true,
    exports: {
        query: async (sql, params) => queryImpl(sql, params),
        pool: { connect: async () => { throw new Error('unexpected pool.connect'); } },
    },
};

const app = express();
app.use(express.json());
app.use('/api/users', require(ROUTER_PATH));
// Mirrors src/index.js's global error handler (createError → statusCode/error body).
app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

let server;
let baseUrl;

const putRole = async ({ token, body }) => {
    const res = await fetch(`${baseUrl}/api/users/target-user-id/role`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON body */ }
    return { status: res.status, body: json };
};

test.before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[POOL_PATH];
});

test('HTTP: wrong admin password on a role change returns 403 and mutates nothing', async () => {
    calls = [];
    queryImpl = makeQueryImpl();
    const token = jwt.sign({ userId: 'actor-user-id' }, process.env.JWT_SECRET);
    const { status, body } = await putRole({
        token,
        body: { role: 'INSTRUCTOR', reason: 'test', adminPassword: 'wrong-password' },
    });

    assert.equal(status, 403);
    assert.match(body.error, /Incorrect password/);
    // The password check aborted before any UPDATE or DELETE.
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET role')), false);
    assert.equal(calls.some(c => c.sql.includes('DELETE FROM admin_departments')), false);
});

test('HTTP: correct admin password on a role change returns 200 and updates the role', async () => {
    calls = [];
    queryImpl = makeQueryImpl();
    const token = jwt.sign({ userId: 'actor-user-id' }, process.env.JWT_SECRET);
    const { status, body } = await putRole({
        token,
        body: { role: 'INSTRUCTOR', reason: 'test', adminPassword: 'super-secret-pw' },
    });

    assert.equal(status, 200);
    assert.equal(body.role, 'INSTRUCTOR');
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET role')), true);
    // Demoting an admin must clear junction rows (regression guard).
    assert.equal(calls.some(c => c.sql.includes('DELETE FROM admin_departments')), true);
});

test('HTTP: missing admin password returns 400 without even loading the password hash', async () => {
    calls = [];
    queryImpl = makeQueryImpl();
    const token = jwt.sign({ userId: 'actor-user-id' }, process.env.JWT_SECRET);
    const { status, body } = await putRole({
        token,
        body: { role: 'INSTRUCTOR', reason: 'test' },
    });

    assert.equal(status, 400);
    assert.match(body.error, /password is required/);
    assert.equal(calls.some(c => c.sql.includes('SELECT password FROM users')), false);
});

test('HTTP: no token is rejected by the auth middleware with 401', async () => {
    calls = [];
    queryImpl = makeQueryImpl();
    const { status, body } = await putRole({
        body: { role: 'INSTRUCTOR', reason: 'test', adminPassword: 'super-secret-pw' },
    });

    assert.equal(status, 401);
    assert.match(body.error, /No token provided/);
});

test('HTTP: a non-admin actor is blocked by the authorize gate with 403', async () => {
    calls = [];
    queryImpl = makeQueryImpl({ actor: actorRow({ id: 'student-id', role: 'STUDENT', name: 'A Student' }) });
    const token = jwt.sign({ userId: 'student-id' }, process.env.JWT_SECRET);
    const { status, body } = await putRole({
        token,
        body: { role: 'INSTRUCTOR', reason: 'test', adminPassword: 'super-secret-pw' },
    });

    assert.equal(status, 403);
    assert.match(body.error, /Insufficient permissions/);
    // Never reached the controller.
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET role')), false);
});

test('HTTP: a department-scoped admin outside their own department is rejected with 403', async () => {
    calls = [];
    // Scoped ADMIN whose department_id differs from the target's.
    queryImpl = makeQueryImpl({
        actor: actorRow({ id: 'scoped-admin', role: 'ADMIN', department_id: 'other-dept' }),
    });
    // assertUserInScope runs a SELECT before the password check.
    const token = jwt.sign({ userId: 'scoped-admin' }, process.env.JWT_SECRET);
    const { status, body } = await putRole({
        token,
        body: { role: 'INSTRUCTOR', reason: 'test', adminPassword: 'super-secret-pw' },
    });

    assert.equal(status, 403);
    assert.match(body.error, /outside your department/);
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET role')), false);
});
