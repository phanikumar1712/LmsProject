const test = require('node:test');
const assert = require('node:assert/strict');

// Unit tests for GET /stats/platform — the Super Admin dashboard endpoint.
// The controller is exercised directly with a mocked DB pool (same
// require.cache injection pattern as users_http.test.js), so no live DB is
// needed. Verifies every new dashboard field is present and correctly parsed
// for both platform-wide (SUPER_ADMIN) and department-scoped (ADMIN) callers.

const POOL_PATH = require.resolve('../src/db/pool');
const CTRL_PATH = require.resolve('../src/controllers/statsController');

// ── Canned response dispatcher ───────────────────────────────────────────────
// Most-specific SQL fragments are matched first. Returns the rows each query
// in getPlatform would see with a typical dev database. Also records every
// (sql, params) call so tests can assert scoping params were passed.
const calls = [];
const makeQueryImpl = () => (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('COALESCE(u_agg.students')) {
        // Per-department breakdown (chart series).
        return { rows: [
            { name: 'CSE', students: 40, instructors: 3, courses: 10, enrollments: 80, completed: 20 },
            { name: 'ECE', students: 30, instructors: 2, courses: 8, enrollments: 40, completed: 16 },
        ] };
    }
    if (sql.includes('SELECT COUNT(*) FROM departments')) {
        return { rows: [{ count: '5' }] };
    }
    if (sql.includes('active = true')) {
        // Active (non-suspended) users — must precede the generic users count.
        return { rows: [{ count: '90' }] };
    }
    if (sql.includes('SELECT COUNT(*) FROM users')) {
        return { rows: [{ count: '100' }] };
    }
    if (sql.includes('COUNT(*) AS total,') && sql.includes('progress >= 100')) {
        // Enrollments with a completed-progress breakdown (completion rate).
        return { rows: [{ total: '120', completed: '36' }] };
    }
    if (sql.includes('COUNT(*) FROM enrollments')) {
        return { rows: [{ count: '120' }] };
    }
    if (sql.includes('FROM courses c LEFT JOIN categories')) {
        return { rows: [{ total: '40', published: '25', pending: '6' }] };
    }
    if (sql.includes('ROUND(AVG(r.stars)')) {
        return { rows: [{ avg_rating: '4.5' }] };
    }
    if (sql.includes('GROUP BY role')) {
        return { rows: [
            { role: 'STUDENT', count: '80' },
            { role: 'INSTRUCTOR', count: '15' },
            { role: 'ADMIN', count: '5' },
            { role: 'SUPER_ADMIN', count: '1' },
        ] };
    }
    if (sql.includes("TO_CHAR(e.enrolled_at")) {
        return { rows: [{ month: 'Jan', count: '10' }, { month: 'Feb', count: '22' }] };
    }
    if (sql.includes('FROM categories cat') && sql.includes('JOIN courses c')) {
        return { rows: [{ name: 'Programming', enrollments: '30' }] };
    }
    if (sql.includes("FILTER (WHERE role = 'STUDENT')")) {
        // Role counts (students / instructors / admins).
        return { rows: [{ students: '80', instructors: '15', admins: '5' }] };
    }
    if (sql.includes('ORDER BY u.created_at DESC')) {
        return { rows: [{ id: 'u1', name: 'New User', email: 'new@x.com', role: 'STUDENT', avatar: '', department_name: 'CSE', created_at: '2026-08-01T00:00:00Z' }] };
    }
    if (sql.includes('ORDER BY c.created_at DESC')) {
        return { rows: [{ id: 'c1', title: 'New Course', status: 'PUBLISHED', thumbnail: '', enrollment_count: '7', instructor_name: 'Dr. X', created_at: '2026-08-02T00:00:00Z' }] };
    }
    if (sql.includes("TO_CHAR(u.created_at")) {
        return { rows: [{ month: 'Mar', count: '12' }] };
    }
    if (sql.includes("TO_CHAR(c.created_at")) {
        return { rows: [{ month: 'Apr', count: '5' }] };
    }
    if (sql.includes('FROM audit_logs al')) {
        return { rows: [{ id: 'a1', action: 'COURSE_APPROVED', resource: 'courses', resource_id: 'c1', created_at: '2026-08-03T00:00:00Z', user_name: 'Super Admin', user_role: 'SUPER_ADMIN' }] };
    }
    throw new Error(`Unexpected SQL in platform stats test: ${sql}`);
};

// Fresh-require the controller against the mocked pool.
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

// Runs the controller with a fake req/res and captures the JSON body.
const runGetPlatform = async (user) => {
    let body;
    await ctrl.getPlatform(
        { user, query: {} },
        { json: (data) => { body = data; } }
    );
    return body;
};

test('platform stats: platform-wide SUPER_ADMIN response has every dashboard field', async () => {
    const body = await runGetPlatform({
        id: 'sa-1',
        role: 'SUPER_ADMIN',
        department_id: null,
    });

    // KPIs
    assert.equal(body.totalDepartments, 5);
    assert.equal(body.totalAdmins, 5);
    assert.equal(body.totalStudents, 80);
    assert.equal(body.totalInstructors, 15);
    assert.equal(body.totalUsers, 100);
    assert.equal(body.totalCourses, 40);
    assert.equal(body.activeCourses, 25);
    assert.equal(body.approvedCourses, 25); // existing fields still present
    assert.equal(body.pendingApprovals, 6);
    assert.equal(body.pendingCourses, 6);
    assert.equal(body.totalEnrollments, 120);
    assert.equal(body.activeUsers, 90);
    assert.equal(body.completionRate, 30); // 36/120
    assert.equal(body.avgRating, 4.5);

    // Existing aggregates untouched
    assert.equal(body.usersByRole.length, 4);
    assert.equal(body.enrollmentsByMonth.length, 2);
    assert.equal(body.topCategories.length, 1);

    // Per-department chart series
    assert.deepEqual(body.studentsByDepartment, [
        { name: 'CSE', count: 40 },
        { name: 'ECE', count: 30 },
    ]);
    assert.deepEqual(body.instructorsByDepartment, [
        { name: 'CSE', count: 3 },
        { name: 'ECE', count: 2 },
    ]);
    assert.deepEqual(body.coursesByDepartment, [
        { name: 'CSE', count: 10 },
        { name: 'ECE', count: 8 },
    ]);
    assert.deepEqual(body.enrollmentsByDepartment, [
        { name: 'CSE', count: 80 },
        { name: 'ECE', count: 40 },
    ]);
    assert.deepEqual(body.completionByDepartment, [
        { name: 'CSE', completionRate: 25 }, // 20/80
        { name: 'ECE', completionRate: 40 }, // 16/40
    ]);

    // Monthly trends
    assert.deepEqual(body.monthlyUserRegistrations, [{ month: 'Mar', count: 12 }]);
    assert.deepEqual(body.monthlyCourseCreation, [{ month: 'Apr', count: 5 }]);

    // Recent lists
    assert.equal(body.recentlyAddedUsers[0].name, 'New User');
    assert.equal(body.recentlyAddedUsers[0].departmentName, 'CSE');
    assert.equal(body.recentCourses[0].title, 'New Course');
    assert.equal(body.recentCourses[0].enrollmentCount, 7);
    assert.equal(body.recentCourses[0].instructorName, 'Dr. X');
    assert.equal(body.recentActivities[0].action, 'COURSE_APPROVED');
    assert.equal(body.recentActivities[0].userName, 'Super Admin');
});

test('platform stats: scoped ADMIN gets dept-filtered KPIs and empty chart series', async () => {
    calls.length = 0;
    const body = await runGetPlatform({
        id: 'admin-1',
        role: 'ADMIN',
        department_id: 'dept-cse',
    });

    // A scoped admin counts their own department as the "platform" slice.
    assert.equal(body.totalDepartments, 1);
    assert.equal(body.totalStudents, 80);
    assert.equal(body.totalInstructors, 15);
    assert.equal(body.totalAdmins, 5);
    assert.equal(body.activeUsers, 90);
    assert.equal(body.completionRate, 30);

    // Per-department charts are meaningless when scoped → empty arrays.
    assert.deepEqual(body.studentsByDepartment, []);
    assert.deepEqual(body.instructorsByDepartment, []);
    assert.deepEqual(body.coursesByDepartment, []);
    assert.deepEqual(body.enrollmentsByDepartment, []);
    assert.deepEqual(body.completionByDepartment, []);

    // Recent lists still resolve against the scoped data.
    assert.equal(body.recentlyAddedUsers.length, 1);
    assert.equal(body.recentCourses.length, 1);

    // Department isolation: every list query must be passed the scoped dept id,
    // including the recent-activities (audit log) query — a scoped admin must
    // never receive other departments' activity.
    const deptScoped = calls.filter(c => c.params && c.params[0] === 'dept-cse');
    assert.ok(deptScoped.length >= 6, 'expected the list queries to be dept-scoped');
    assert.ok(calls.some(c => c.sql.includes('FROM audit_logs al') && c.params[0] === 'dept-cse'),
        'recentActivities query must be department-scoped');
});

test.after(() => {
    delete require.cache[POOL_PATH];
    delete require.cache[CTRL_PATH];
});
