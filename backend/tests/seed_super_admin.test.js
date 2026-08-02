const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// seedSuperAdmin is a standalone module (extracted from migrate.js) so it can be
// unit-tested with a fake client — no DB, no full migration run.
const { seedSuperAdmin, SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL } = require('../src/db/seedSuperAdmin');

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
                    // ON CONFLICT ... DO UPDATE SET name = EXCLUDED.name
                    const idx = rows.indexOf(existing);
                    rows[idx] = { ...existing, name: params[0] };
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
