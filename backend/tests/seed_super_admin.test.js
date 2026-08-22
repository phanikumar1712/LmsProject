const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// seedSuperAdmin is a standalone module (extracted from migrate.js) so it can be
// unit-tested with a fake client — no DB, no full migration run.
const { seedSuperAdmin, SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL } = require('../src/db/seedSuperAdmin');

// Pin the environment so results are deterministic regardless of the ambient
// shell env. With NODE_ENV=production and no SUPER_ADMIN_PASSWORD the seed
// throws by design, which would break these dev-behavior tests.
delete process.env.NODE_ENV;
delete process.env.SUPER_ADMIN_PASSWORD;

// A fake client that mimics Postgres ON CONFLICT(email) DO UPDATE semantics:
//   - no existing row  → INSERT (record the new row)
//   - existing row     → UPDATE name to EXCLUDED.name, keep everything else
// This lets us assert the real upsert path without a database.
const makeFakeClient = () => {
    const rows = [];
    const calls = [];
    const client = {
        query: async (sql, params = []) => {
            calls.push({ sql, params });
            const isInsert = /INSERT INTO users/.test(sql);
            const hasConflict = /ON CONFLICT/.test(sql);
            const email = params[1];
            const existing = rows.find(r => r.email === email);
            if (isInsert && hasConflict) {
                if (existing) {
                    // ON CONFLICT ... DO UPDATE SET name = EXCLUDED.name[, password = EXCLUDED.password]
                    const idx = rows.indexOf(existing);
                    const updated = { ...existing, name: params[0] };
                    if (/password\s*=\s*EXCLUDED\.password/.test(sql)) {
                        updated.password = params[2];
                    }
                    rows[idx] = updated;
                    return { rows: [rows[idx]] };
                }
                // role/avatar are SQL literals in the INSERT ('SUPER_ADMIN', ''),
                // not params — mirror them exactly in the fake row.
                const row = { name: params[0], email: params[1], password: params[2], role: 'SUPER_ADMIN', avatar: '' };
                rows.push(row);
                return { rows: [row] };
            }
            return { rows: [] };
        },
    };
    return { client, rows, calls };
};

test('seedSuperAdmin inserts the account with name "Super Admin" on a fresh DB', async () => {
    const { client, rows, calls } = makeFakeClient();
    await seedSuperAdmin(client, { rounds: 4 }); // low cost factor for test speed

    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, SUPER_ADMIN_NAME);
    assert.equal(rows[0].email, SUPER_ADMIN_EMAIL);
    assert.equal(rows[0].role, 'SUPER_ADMIN');
    // Password is a real bcrypt hash of 'superadmin'.
    assert.ok(await bcrypt.compare('superadmin', rows[0].password));

    // SQL uses ON CONFLICT DO UPDATE (never DO NOTHING) and never touches password.
    const sql = calls[0].sql;
    assert.match(sql, /ON CONFLICT\s*\(email\)\s*DO UPDATE SET name = EXCLUDED\.name/);
    assert.doesNotMatch(sql, /DO NOTHING/);
    assert.doesNotMatch(sql, /password\s*=\s*EXCLUDED\.password/);
});

test('seedSuperAdmin renames a stale "Test" row to "Super Admin" on re-run', async () => {
    // Simulate a DB seeded by an older version: name 'Test', a distinct password.
    const { client, rows } = makeFakeClient();
    rows.push({
        name: 'Test',
        email: SUPER_ADMIN_EMAIL,
        password: await bcrypt.hash('old-password', 4),
        role: 'SUPER_ADMIN',
        avatar: '',
    });

    await seedSuperAdmin(client, { rounds: 4 });

    // Name corrected…
    assert.equal(rows[0].name, SUPER_ADMIN_NAME);
    // …but the pre-existing password is preserved (DO UPDATE only sets name).
    assert.ok(await bcrypt.compare('old-password', rows[0].password));
    assert.equal(rows.length, 1); // no duplicate row created
});

test('seedSuperAdmin is idempotent — repeated runs never duplicate or regress the name', async () => {
    const { client, rows } = makeFakeClient();
    await seedSuperAdmin(client, { rounds: 4 });
    await seedSuperAdmin(client, { rounds: 4 });
    await seedSuperAdmin(client, { rounds: 4 });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, SUPER_ADMIN_NAME);
    assert.ok(await bcrypt.compare('superadmin', rows[0].password));
});

test('seedSuperAdmin returns the super-admin email', async () => {
    const { client } = makeFakeClient();
    const email = await seedSuperAdmin(client, { rounds: 4 });
    assert.equal(email, SUPER_ADMIN_EMAIL);
});

test('seedSuperAdmin throws in production when SUPER_ADMIN_PASSWORD is missing', async () => {
    const { client, rows } = makeFakeClient();
    const prevEnv = process.env.NODE_ENV;
    const prevPass = process.env.SUPER_ADMIN_PASSWORD;
    process.env.NODE_ENV = 'production';
    delete process.env.SUPER_ADMIN_PASSWORD;
    try {
        await assert.rejects(
            () => seedSuperAdmin(client, { rounds: 4 }),
            /SUPER_ADMIN_PASSWORD is not set/
        );
        assert.equal(rows.length, 0); // never seeds a known default password
    } finally {
        if (prevEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = prevEnv;
        if (prevPass === undefined) delete process.env.SUPER_ADMIN_PASSWORD;
        else process.env.SUPER_ADMIN_PASSWORD = prevPass;
    }
});

test('seedSuperAdmin in production uses SUPER_ADMIN_PASSWORD and rotates it on conflict', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevPass = process.env.SUPER_ADMIN_PASSWORD;
    process.env.NODE_ENV = 'production';
    process.env.SUPER_ADMIN_PASSWORD = 'hunter2-rotated'; // known test value

    try {
        // Fresh DB: inserts with the env-var password (conflict clause also carries
        // the rotation, but a fresh insert just uses the param password).
        const fresh = makeFakeClient();
        await seedSuperAdmin(fresh.client, { rounds: 4 });
        assert.equal(fresh.rows.length, 1);
        assert.ok(await bcrypt.compare('hunter2-rotated', fresh.rows[0].password));

        // Pre-existing account (e.g. legacy 'superadmin' default): password is rotated.
        const stale = makeFakeClient();
        stale.rows.push({
            name: 'Super Admin',
            email: SUPER_ADMIN_EMAIL,
            password: await bcrypt.hash('superadmin', 4),
            role: 'SUPER_ADMIN',
            avatar: '',
        });
        await seedSuperAdmin(stale.client, { rounds: 4 });
        assert.ok(await bcrypt.compare('hunter2-rotated', stale.rows[0].password));
        assert.match(stale.calls[0].sql, /DO UPDATE SET name = EXCLUDED\.name, password = EXCLUDED\.password/);
    } finally {
        if (prevEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = prevEnv;
        if (prevPass === undefined) delete process.env.SUPER_ADMIN_PASSWORD;
        else process.env.SUPER_ADMIN_PASSWORD = prevPass;
    }
});
