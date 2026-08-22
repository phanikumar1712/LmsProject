const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// Unit-test the authController password flows (changePassword + OTP reset) with a
// mocked pool and mocked mailer — no live DB or email. Same require.cache
// injection technique as users_controller.test.js: authController destructures
// `query` from '../db/pool' and `sendOTPEmail` from '../utils/mail' at require
// time, so both modules are replaced before the controller is loaded.
const POOL_PATH = require.resolve('../src/db/pool');
const MAIL_PATH = require.resolve('../src/utils/mail');
const CONTROLLER_PATH = require.resolve('../src/controllers/authController');

// bcrypt is a real dependency; use a low cost factor for fast test runs.
const PWD_HASH = bcrypt.hashSync('current-pass-123', 4);

let mailCalls = [];

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
    require.cache[MAIL_PATH] = {
        id: MAIL_PATH,
        filename: MAIL_PATH,
        loaded: true,
        exports: {
            sendOTPEmail: async (email, otp) => {
                mailCalls.push({ email, otp });
                return { success: true };
            },
        },
    };
    delete require.cache[CONTROLLER_PATH];
    const controller = require(CONTROLLER_PATH);
    return { controller, calls };
};

const makeReq = (role, body = {}) => ({
    user: { id: 'user-1', role },
    body,
});

const makeRes = () => {
    const res = { json: (payload) => { res.payload = payload; } };
    return res;
};

test.after(() => {
    delete require.cache[POOL_PATH];
    delete require.cache[MAIL_PATH];
});

// ── PUT /api/auth/change-password ───────────────────────────────────────────

test('changePassword blocks an ADMIN (403) before touching the DB', async () => {
    const { controller, calls } = loadController(() => ({ rows: [] }));
    const req = makeReq('ADMIN', { currentPassword: 'x', newPassword: 'new-pass-1234' });

    await assert.rejects(
        () => controller.changePassword(req, makeRes()),
        (err) => {
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /managed by the Super Admin/);
            return true;
        }
    );
    assert.equal(calls.length, 0);
});

test('changePassword allows a STUDENT with a correct current password', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT password FROM users')) return { rows: [{ password: PWD_HASH }] };
        if (sql.includes('UPDATE users SET password')) return { rows: [] };
        return { rows: [] };
    });
    const req = makeReq('STUDENT', { currentPassword: 'current-pass-123', newPassword: 'new-pass-1234' });
    const res = makeRes();

    await controller.changePassword(req, res);

    assert.equal(res.payload.success, true);
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET password')), true);
});

test('changePassword allows a SUPER_ADMIN to self-service their own password', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT password FROM users')) return { rows: [{ password: PWD_HASH }] };
        if (sql.includes('UPDATE users SET password')) return { rows: [] };
        return { rows: [] };
    });
    const req = makeReq('SUPER_ADMIN', { currentPassword: 'current-pass-123', newPassword: 'new-pass-1234' });
    const res = makeRes();

    await controller.changePassword(req, res);

    assert.equal(res.payload.success, true);
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET password')), true);
});

test('changePassword rejects a wrong current password with 401', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT password FROM users')) return { rows: [{ password: PWD_HASH }] };
        return { rows: [] };
    });
    const req = makeReq('STUDENT', { currentPassword: 'wrong-pass', newPassword: 'new-pass-1234' });

    await assert.rejects(
        () => controller.changePassword(req, makeRes()),
        (err) => {
            assert.equal(err.statusCode, 401);
            assert.match(err.message, /Current password is incorrect/);
            return true;
        }
    );
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET password')), false);
});

// ── POST /api/auth/reset-password/request ────────────────────────────────────

test('requestPasswordReset silently no-ops for an ADMIN account (no OTP, no email)', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT id, role FROM users')) return { rows: [{ id: 'user-1', role: 'ADMIN' }] };
        return { rows: [] };
    });
    const req = makeReq('STUDENT', { email: 'admin@demo.com' });
    const res = makeRes();
    mailCalls = [];

    await controller.requestPasswordReset(req, res);

    // Generic success — doesn't reveal the account is an admin.
    assert.match(res.payload.message, /If registered, an OTP has been sent/);
    // No OTP was stored and no email was sent.
    assert.equal(calls.some(c => c.sql.includes('UPDATE users SET reset_otp')), false);
    assert.equal(mailCalls.length, 0);
});

test('requestPasswordReset stores an OTP and emails it for a STUDENT', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT id, role FROM users')) return { rows: [{ id: 'user-1', role: 'STUDENT' }] };
        if (sql.includes('UPDATE users SET reset_otp')) return { rows: [] };
        return { rows: [] };
    });
    const req = makeReq('STUDENT', { email: 'student@demo.com' });
    const res = makeRes();
    mailCalls = [];

    await controller.requestPasswordReset(req, res);

    assert.match(res.payload.message, /OTP has been sent/);
    const update = calls.find(c => c.sql.includes('UPDATE users SET reset_otp'));
    assert.ok(update, 'expected an OTP update for a student');
    assert.equal(String(update.params[0]).length, 6); // 6-digit OTP
    assert.equal(mailCalls.length, 1);
    assert.equal(mailCalls[0].email, 'student@demo.com');
});

// ── POST /api/auth/verify-otp + reset-password ───────────────────────────────

test('verifyOTP rejects an ADMIN even when a stale OTP exists', async () => {
    const { controller } = loadController((sql) => {
        if (sql.includes('SELECT reset_otp, reset_otp_expiry, role')) {
            return { rows: [{ reset_otp: '123456', reset_otp_expiry: new Date(Date.now() + 600000), role: 'ADMIN' }] };
        }
        return { rows: [] };
    });
    const req = makeReq('STUDENT', { email: 'admin@demo.com', otp: '123456' });

    await assert.rejects(
        () => controller.verifyOTP(req, makeRes()),
        (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /Invalid OTP/);
            return true;
        }
    );
});

test('resetPasswordByEmail rejects an ADMIN even with a valid-looking OTP', async () => {
    const { controller } = loadController((sql) => {
        if (sql.includes('SELECT id, reset_otp, reset_otp_expiry, role')) {
            return { rows: [{ id: 'user-1', reset_otp: '123456', reset_otp_expiry: new Date(Date.now() + 600000), role: 'ADMIN' }] };
        }
        return { rows: [] };
    });
    const req = makeReq('STUDENT', { email: 'admin@demo.com', otp: '123456', newPassword: 'new-pass-1234' });

    await assert.rejects(
        () => controller.resetPasswordByEmail(req, makeRes()),
        (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /Invalid OTP/);
            return true;
        }
    );
});
