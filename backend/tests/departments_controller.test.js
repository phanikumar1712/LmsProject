const test = require('node:test');
const assert = require('node:assert/strict');

// Unit tests for the departments controller (Super Admin department CRUD).
// The controller is exercised directly with a mocked DB pool (same
// require.cache injection pattern as users_http.test.js / platform_stats.test.js),
// so no live DB is needed.

const POOL_PATH = require.resolve('../src/db/pool');
const CTRL_PATH = require.resolve('../src/controllers/departmentsController');

const actor = { id: 'sa-1', role: 'SUPER_ADMIN', department_id: null };

// Canned dispatcher — most-specific SQL fragments matched first.
const makeQueryImpl = () => (sql, params) => {
    if (sql.includes('user_count') && sql.includes('FROM departments d WHERE d.id = $1')) {
        // remove() dependency check: dept with 2 users + 1 course
        return { rows: [{ id: 'dept-1', name: 'CSE', user_count: 2, course_count: 1 }] };
    }
    if (sql.includes('SELECT id, name, icon FROM departments WHERE active = true')) {
        return { rows: [{ id: 'd1', name: 'CSE', icon: '💻' }, { id: 'd2', name: 'ECE', icon: '📡' }] };
    }
    if (sql.includes('FROM departments d') && sql.includes('student_count')) {
        // list(): d.* plus count columns.
        return { rows: [{
            id: 'dept-1', name: 'CSE', icon: '💻', code: 'CSE', active: true, created_at: new Date().toISOString(),
            category_count: 5, student_count: 40, instructor_count: 3, course_count: 10, admin_count: 1,
        }] };
    }
    if (sql.includes('FROM departments WHERE id = $1')) {
        // update()/updateLimits() pre-edit snapshot for the audit old/new values.
        return { rows: [{
            id: 'dept-1', name: 'CSE', icon: '💻', code: 'CSE', description: 'Old desc', hod: 'Old HOD',
            contact_email: 'old@dept.edu', contact_number: '000', active: true,
            max_students: null, max_courses: null,
        }] };
    }
    if (sql.includes('WHERE LOWER(name) = LOWER($1)')) {
        return { rows: [] }; // name is unique
    }
    if (sql.includes('WHERE code = $1 AND id <> $2')) {
        return { rows: [] }; // no code clash on update
    }
    if (sql.includes('WHERE code = $1')) {
        return { rows: [] }; // no code clash on create
    }
    if (sql.includes('UPDATE departments SET active = $1')) {
        return { rows: [{ id: 'dept-1', name: 'CSE', active: params[0] }] };
    }
    if (sql.includes('UPDATE departments SET')) {
        // RETURNING * — mirror the UPDATE column order: name $1, icon $2, code $3,
        // description $4, hod $5, contact_email $6, contact_number $7, active $8.
        return { rows: [{
            id: 'dept-1',
            name: params[0] ?? 'CSE',
            icon: params[1] ?? '🏛️',
            code: params[2],
            description: params[3],
            hod: params[4],
            contact_email: params[5],
            contact_number: params[6],
            active: params[7] ?? true,
        }] };
    }
    if (sql.includes('INSERT INTO departments')) {
        return { rows: [{ id: 'dept-new', ...Object.fromEntries(['name', 'icon', 'code', 'description', 'hod', 'contact_email', 'contact_number', 'active'].map((k, i) => [k, params[i]])) }] };
    }
    if (sql.includes('DELETE FROM departments')) {
        return { rows: [{ id: 'dept-1', name: 'CSE' }] };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
    }
    throw new Error(`Unexpected SQL in departments test: ${sql}`);
};

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
const ctrl = require(CTRL_PATH);

const makeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; };
    return res;
};

const expectError = async (promise, statusCode, pattern) => {
    try {
        await promise;
        assert.fail('expected the call to throw');
    } catch (err) {
        assert.equal(err.statusCode, statusCode);
        if (pattern) assert.match(err.message, pattern);
    }
};

test.after(() => {
    delete require.cache[POOL_PATH];
    delete require.cache[CTRL_PATH];
});

// ── LIST ─────────────────────────────────────────────────────────────────────
test('list: returns departments with counts (unscoped super admin)', async () => {
    const res = makeRes();
    await ctrl.list({ user: { id: 'sa-1', role: 'SUPER_ADMIN', department_id: null }, query: {} }, res);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].student_count, 40);
    assert.equal(res.body[0].instructor_count, 3);
    assert.equal(res.body[0].course_count, 10);
    assert.equal(res.body[0].admin_count, 1);
    assert.equal(res.body[0].createdAt, res.body[0].createdAt); // mapDepartment passthrough
});

test('list: scoped admin only sees their own department', async () => {
    const res = makeRes();
    await ctrl.list({ user: { id: 'adm-1', role: 'ADMIN', department_id: 'dept-1' }, query: {} }, res);
    assert.equal(res.body.length, 1);
});

// ── CREATE ───────────────────────────────────────────────────────────────────
test('create: requires a department name', async () => {
    await expectError(ctrl.create({ user: actor, body: {} }, makeRes()), 400, /name is required/);
});

test('create: rejects duplicate names with 409', async () => {
    const original = queryImpl;
    queryImpl = (sql, params) => {
        if (sql.includes('WHERE LOWER(name) = LOWER($1)')) return { rows: [{ id: 'existing' }] };
        return original(sql, params);
    };
    await expectError(ctrl.create({ user: actor, body: { name: 'CSE' } }, makeRes()), 409, /already exists/);
    queryImpl = original;
});

test('create: persists management fields and uppercases the code', async () => {
    const res = makeRes();
    await ctrl.create({
        user: actor,
        body: {
            name: 'Computer Science',
            code: 'cse',
            description: 'CS dept',
            hod: 'Dr. Jane',
            contactEmail: 'hod@cse.edu',
            contactNumber: '12345',
            active: false,
        },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.code, 'CSE');
    assert.equal(res.body.contact_email, 'hod@cse.edu');
    assert.equal(res.body.description, 'CS dept');
    assert.equal(res.body.hod, 'Dr. Jane');
    assert.equal(res.body.active, false);
});

test('create: defaults active to true when omitted', async () => {
    const res = makeRes();
    await ctrl.create({ user: actor, body: { name: 'New Dept' } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.active, true);
    assert.equal(res.body.icon, '🏛️');
});

// ── UPDATE ───────────────────────────────────────────────────────────────────
test('update: applies the new fields', async () => {
    const res = makeRes();
    await ctrl.update({
        user: actor,
        params: { id: 'dept-1' },
        body: { name: 'CSE Dept', code: 'cse', hod: 'Dr. Rao', contactEmail: 'hod@cse.edu', active: true },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.code, 'CSE');
    assert.equal(res.body.hod, 'Dr. Rao');
});

test('update: rejects a code clash with 409', async () => {
    const original = queryImpl;
    queryImpl = (sql, params) => {
        if (sql.includes('WHERE code = $1 AND id <> $2')) return { rows: [{ id: 'other' }] };
        return original(sql, params);
    };
    await expectError(
        ctrl.update({ user: actor, params: { id: 'dept-1' }, body: { code: 'CSE' } }, makeRes()),
        409, /code already in use/
    );
    queryImpl = original;
});

// ── STATUS TOGGLE ────────────────────────────────────────────────────────────
test('updateStatus: activates and deactivates', async () => {
    const res = makeRes();
    await ctrl.updateStatus({ user: actor, params: { id: 'dept-1' }, body: { active: false } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.active, false);

    await ctrl.updateStatus({ user: actor, params: { id: 'dept-1' }, body: { active: true } }, res);
    assert.equal(res.body.active, true);
});

test('updateStatus: rejects a non-boolean payload with 400', async () => {
    await expectError(
        ctrl.updateStatus({ user: actor, params: { id: 'dept-1' }, body: { active: 'yes' } }, makeRes()),
        400, /active must be a boolean/
    );
});

// ── DELETE ───────────────────────────────────────────────────────────────────
test('remove: blocks deletion while users/courses exist (409)', async () => {
    await expectError(
        ctrl.remove({ user: actor, params: { id: 'dept-1' } }, makeRes()),
        409, /still has 2 user\(s\) and 1 course\(s\)/
    );
});

test('remove: deletes a department with no dependencies', async () => {
    const original = queryImpl;
    queryImpl = (sql, params) => {
        if (sql.includes('user_count') && sql.includes('FROM departments d WHERE d.id = $1')) {
            return { rows: [{ id: 'dept-1', name: 'CSE', user_count: 0, course_count: 0 }] };
        }
        return original(sql, params);
    };
    const res = makeRes();
    await ctrl.remove({ user: actor, params: { id: 'dept-1' } }, res);
    assert.equal(res.body.success, true);
    queryImpl = original;
});

// ── PUBLIC LIST ──────────────────────────────────────────────────────────────
test('publicList: only returns active departments', async () => {
    const res = makeRes();
    await ctrl.publicList({}, res);
    assert.equal(res.body.length, 2);
    // The SQL itself filters active = true; the mock simply returns rows.
    assert.equal(res.body[0].name, 'CSE');
});
