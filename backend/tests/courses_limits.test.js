const test = require('node:test');
const assert = require('node:assert/strict');

// coursesController destructures `query` from '../db/pool' (and utils/limits
// destructures it too) at require time, so we inject a fake pool into
// require.cache BEFORE loading the controller — same pattern as the other unit
// tests. No DB connection is made.
const POOL_PATH = require.resolve('../src/db/pool');
const CONTROLLER_PATH = require.resolve('../src/controllers/coursesController');
const LIMITS_PATH = require.resolve('../src/utils/limits');

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
    delete require.cache[CONTROLLER_PATH];
    delete require.cache[LIMITS_PATH];
    const controller = require(CONTROLLER_PATH);
    return { controller, calls };
};

// A department-scoped ADMIN approving a course in their own department.
const scopedAdminReq = () => ({
    user: { id: 'admin-user-id', name: 'CSE Admin', role: 'ADMIN', department_id: 'dept-1' },
    params: { id: 'course-id' },
});

// Dispatches mock responses for: assertCourseInScope, resolveCourseDepartment,
// getDeptCapacity (platform settings + dept override + student/course counts),
// and notifyLimitReached (dept admins + super admins + dedupe + inserts).
const limitReachedQueryImpl = () => (sql) => {
    if (sql.includes('SELECT value FROM platform_settings')) {
        return { rows: [{ value: { defaultMaxStudentsPerAdmin: 2, defaultMaxCoursesPerAdmin: 2 } }] };
    }
    if (sql.includes('SELECT name, max_students, max_courses FROM departments')) {
        return { rows: [{ name: 'CSE', max_students: null, max_courses: null }] };
    }
    if (sql.includes("role = 'STUDENT'")) {
        return { rows: [{ c: 0 }] };
    }
    if (sql.includes("c.status NOT IN ('REJECTED', 'ARCHIVED')")) {
        return { rows: [{ c: 2 }] }; // already at the 2-course limit
    }
    if (sql.includes('SELECT cat.department_id FROM courses c')) {
        return { rows: [{ department_id: 'dept-1' }] };
    }
    if (sql.includes('SELECT COALESCE(cat.department_id, u.department_id)')) {
        return { rows: [{ department_id: 'dept-1' }] };
    }
    if (sql.includes("role = 'ADMIN' AND active = true")) {
        return { rows: [{ id: 'dept-admin-1' }] };
    }
    if (sql.includes("role = 'SUPER_ADMIN' AND active = true")) {
        return { rows: [{ id: 'super-1' }] };
    }
    if (sql.includes('FROM notifications WHERE user_id')) {
        return { rows: [] }; // no recent notification → dedupe passes
    }
    if (sql.includes('INSERT INTO notifications')) {
        return { rows: [] };
    }
    return { rows: [] };
};

test('approve blocks a department that has reached its course limit with 409', async () => {
    const { controller, calls } = loadController(limitReachedQueryImpl());
    const req = scopedAdminReq();

    await assert.rejects(
        () => controller.approve(req, {}),
        (err) => {
            assert.equal(err.statusCode, 409);
            assert.match(err.message, /Course limit reached for this department/);
            return true;
        }
    );

    // The course was never published.
    assert.equal(calls.some(c => c.sql.includes("UPDATE courses SET status = 'PUBLISHED'")), false);
    // Dept admin + super admin were notified for a limit-review discussion.
    const notifInserts = calls.filter(c => c.sql.includes('INSERT INTO notifications'));
    assert.ok(notifInserts.length >= 2);
    assert.ok(notifInserts.every(c => c.params[1].includes('course limit reached')));
});

test('approve succeeds when the department is under its course limit', async () => {
    const { controller, calls } = loadController((sql) => {
        if (sql.includes('SELECT value FROM platform_settings')) {
            return { rows: [{ value: { defaultMaxStudentsPerAdmin: 500, defaultMaxCoursesPerAdmin: 5 } }] };
        }
        if (sql.includes('SELECT name, max_students, max_courses FROM departments')) {
            return { rows: [{ name: 'CSE', max_students: null, max_courses: null }] };
        }
        if (sql.includes("role = 'STUDENT'")) {
            return { rows: [{ c: 0 }] };
        }
        if (sql.includes("c.status NOT IN ('REJECTED', 'ARCHIVED')")) {
            return { rows: [{ c: 1 }] }; // 1 of 5 used — plenty of headroom
        }
        if (sql.includes('SELECT cat.department_id FROM courses c')) {
            return { rows: [{ department_id: 'dept-1' }] };
        }
        if (sql.includes('SELECT COALESCE(cat.department_id, u.department_id)')) {
            return { rows: [{ department_id: 'dept-1' }] };
        }
        if (sql.includes("UPDATE courses SET status = 'PUBLISHED'")) {
            return { rows: [{ id: 'course-id', title: 'CSE 101', status: 'PUBLISHED', instructor_id: 'instructor-1' }] };
        }
        if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [] };
        }
        if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
        }
        return { rows: [] };
    });
    const req = scopedAdminReq();
    const res = { payload: null, json: (p) => { res.payload = p; } };

    await controller.approve(req, res);

    assert.equal(calls.some(c => c.sql.includes("UPDATE courses SET status = 'PUBLISHED'")), true);
    // No limit-reached notification was created.
    assert.equal(
        calls.filter(c => c.sql.includes('INSERT INTO notifications')).some(c => c.params[1]?.includes('limit reached')),
        false
    );
});

// Restore the real pool module so other test files in the same process are unaffected.
test.after(() => {
    delete require.cache[POOL_PATH];
});
