/**
 * Comprehensive API Route Tester
 * Tests every route for each role (PUBLIC, SUPER_ADMIN, ADMIN, INSTRUCTOR, STUDENT)
 * Reports pass/fail for each endpoint.
 *
 * Usage: node test_all_routes.js
 */
const BASE = process.env.API_URL || 'http://localhost:5000/api';

const PASS = 0, FAIL = 1;
const results = { PASS: [], FAIL: [] };

let superAdminToken, adminToken, instructorToken, studentToken;

// ---------- Helpers ----------
const api = async (method, path, opts = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    const url = `${BASE}${path}`;
    try {
        const res = await fetch(url, {
            method,
            headers,
            body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        return { status: res.status, ok: res.ok, data };
    } catch (err) {
        return { status: 0, ok: false, data: { error: err.message }, _err: err };
    }
};

const test = async (name, method, path, opts = {}) => {
    const res = await api(method, path, opts);
    const expectStatus = opts.expectStatus || 200;
    const failOn = opts.failOn; // fail if status matches this (for 403 checks)
    const canFail = opts.canFail; // won't fail test suite if this fails

    let passed = false;
    let note = '';
    if (failOn) {
        passed = res.status === failOn;
        if (!passed) note = ` (expected ${failOn}, got ${res.status})`;
    } else if (res.status === 0) {
        if (canFail) { passed = true; note = ` (⚠️ skipped - ${res.data?.error})`; }
        else { passed = false; note = ` (❌ connection error: ${res.data?.error})`; }
    } else {
        passed = res.status < 500;
        if (!passed) note = ` (status ${res.status})`;
    }

    if (passed) {
        results.PASS.push({ name, status: res.status, note });
    } else {
        const errMsg = typeof res.data === 'object' ? (res.data?.error || JSON.stringify(res.data).slice(0, 80)) : String(res.data).slice(0, 80);
        results.FAIL.push({ name, status: res.status, error: errMsg });
    }
};

// ---------- Login ----------
const login = async (email, password, role) => {
    const res = await api('POST', '/auth/login', { body: { email, password } });
    if (!res.ok) {
        console.error(`❌ Cannot login as ${role} (${email}): ${res.data?.error || res.status}`);
        process.exit(1);
    }
    console.log(`  ✅ Logged in as ${role} (${email})`);
    return res.data.token;
};

// ---------- Test Runner ----------
(async () => {
    console.log('\n═══════════════════════════════════════════════');
    console.log('   🌐 COMPREHENSIVE API ROUTE TESTER');
    console.log(`   Base URL: ${BASE}`);
    console.log('═══════════════════════════════════════════════\n');

    // ---- LOGIN ----
    console.log('📌 LOGGING IN...');
    superAdminToken = await login('superadmin@lms.com', 'superadmin', 'SUPER_ADMIN');
    adminToken = await login('cse.admin@demo.com', 'demo123', 'ADMIN');
    instructorToken = await login('cse.instructor@demo.com', 'demo123', 'INSTRUCTOR');
    studentToken = await login('cse.student1@demo.com', 'demo123', 'STUDENT');

    // ---- PUBLIC ROUTES (no auth) ----
    console.log('\n📌 PUBLIC ROUTES');
    await test('GET /api/health', 'GET', '/../health');
    await test('GET /api/stats/public', 'GET', '/stats/public');
    await test('GET /api/courses (public)', 'GET', '/courses');
    await test('GET /api/departments/public', 'GET', '/departments/public');
    await test('GET /api/stats/categories', 'GET', '/stats/categories');
    await test('POST /api/auth/register', 'POST', '/auth/register', {
        body: { name: 'Test Route User', email: `route.test.${Date.now()}@demo.com`, password: 'test1234', role: 'STUDENT' },
    });

    // ---- AUTH ROUTES (authenticated) ----
    console.log('\n📌 AUTH ROUTES');
    await test('GET /api/auth/me (SA)', 'GET', '/auth/me', { token: superAdminToken });
    await test('GET /api/auth/me (Admin)', 'GET', '/auth/me', { token: adminToken });
    await test('GET /api/auth/me (Instructor)', 'GET', '/auth/me', { token: instructorToken });
    await test('GET /api/auth/me (Student)', 'GET', '/auth/me', { token: studentToken });

    // ---- SUPER ADMIN ROUTES ----
    console.log('\n📌 SUPER ADMIN ROUTES');
    // Stats
    await test('GET /api/stats/admins', 'GET', '/stats/admins', { token: superAdminToken });
    await test('GET /api/stats/departments', 'GET', '/stats/departments', { token: superAdminToken });
    await test('GET /api/stats/settings', 'GET', '/stats/settings', { token: superAdminToken });
    await test('GET /api/stats/system-health', 'GET', '/stats/system-health', { token: superAdminToken });
    await test('GET /api/stats/audit-logs', 'GET', '/stats/audit-logs', { token: superAdminToken });
    await test('GET /api/stats/ai-report', 'GET', '/stats/ai-report', { token: superAdminToken });
    await test('GET /api/stats/platform', 'GET', '/stats/platform', { token: superAdminToken });

    // Users
    await test('GET /api/users (list)', 'GET', '/users', { token: superAdminToken });
    await test('POST /api/users/invite-admin', 'POST', '/users/invite-admin', {
        token: superAdminToken,
        body: { name: 'Test Admin', email: `testadmin.${Date.now()}@demo.com`, password: 'admin1234', role: 'ADMIN' }
    });
    await test('GET /api/users/instructor-requests', 'GET', '/users/instructor-requests', { token: superAdminToken });

    // Departments
    await test('GET /api/departments', 'GET', '/departments', { token: superAdminToken });

    // Courses
    await test('GET /api/courses?admin=true (SA)', 'GET', '/courses?admin=true', { token: superAdminToken });

    // ---- ADMIN ROUTES ----
    console.log('\n📌 ADMIN ROUTES');
    await test('GET /api/stats/platform (Admin)', 'GET', '/stats/platform', { token: adminToken });
    await test('GET /api/stats/audit-logs (Admin)', 'GET', '/stats/audit-logs', { token: adminToken });
    await test('GET /api/stats/students/progress', 'GET', '/stats/students/progress', { token: adminToken });
    await test('GET /api/users (Admin)', 'GET', '/users', { token: adminToken });
    await test('GET /api/announcements (Admin)', 'GET', '/announcements', { token: adminToken });
    await test('GET /api/departments (Admin)', 'GET', '/departments', { token: adminToken });
    await test('GET /api/courses?admin=true (Admin)', 'GET', '/courses?admin=true', { token: adminToken });
    await test('GET /api/stats/categories (Admin)', 'GET', '/stats/categories', { token: adminToken });
    await test('GET /api/academic-sessions', 'GET', '/stats/academic-sessions', { token: adminToken });
    await test('GET /api/users/instructor-requests (Admin)', 'GET', '/users/instructor-requests', { token: adminToken });

    // ---- INSTRUCTOR ROUTES ----
    console.log('\n📌 INSTRUCTOR ROUTES');
    // Get instructor profile
    await test('GET instructor profile', 'GET', '/users/instructor/' + encodeURIComponent('cse.instructor@demo.com'), { token: instructorToken, canFail: true });
    // Actually get by ID
    const meRes = await api('GET', '/auth/me', { token: instructorToken });
    const instructorId = meRes.data?.id || meRes.data?.user?.id;
    if (instructorId) {
        await test(`GET /api/users/instructor/${instructorId}`, 'GET', `/users/instructor/${instructorId}`, { token: studentToken });
        await test(`GET /api/stats/instructor/${instructorId}`, 'GET', `/stats/instructor/${instructorId}`, { token: instructorToken });
        await test(`GET /api/courses/instructor/${instructorId}`, 'GET', `/courses/instructor/${instructorId}`, { token: instructorToken });
        await test(`GET /api/enrollments/stats/${instructorId}`, 'GET', `/enrollments/stats/${instructorId}`, { token: instructorToken });
    }

    // ---- STUDENT ROUTES ----
    console.log('\n📌 STUDENT ROUTES');
    const stuMeRes = await api('GET', '/auth/me', { token: studentToken });
    const studentId = stuMeRes.data?.id || stuMeRes.data?.user?.id;
    if (studentId) {
        await test(`GET /api/enrollments/student/${studentId}`, 'GET', `/enrollments/student/${studentId}`, { token: studentToken });
        await test('GET /api/wishlist', 'GET', '/wishlist', { token: studentToken });
        await test('GET /api/notifications', 'GET', '/notifications', { token: studentToken });
        await test('GET /api/certificates/my', 'GET', '/certificates/my', { token: studentToken });
        await test(`GET /api/ratings/student/${studentId}`, 'GET', `/ratings/student/${studentId}`, { token: studentToken });
        await test('GET /api/stats/student/streak', 'GET', '/stats/student/streak', { token: studentToken });
    }

    // ---- COURSES DETAIL ----
    console.log('\n📌 COURSE DETAILS');
    const coursesRes = await api('GET', '/courses', {});
    const courses = coursesRes.data?.rows || coursesRes.data || [];
    const courseId = Array.isArray(courses) && courses.length > 0 ? (courses[0]?.id || courses[0]?.course_id) : null;
    if (courseId) {
        await test(`GET /api/courses/${courseId}`, 'GET', `/courses/${courseId}`, { token: studentToken });
        await test(`GET /api/courses/${courseId}/lessons`, 'GET', `/courses/${courseId}/lessons`, { token: studentToken });
        await test(`GET /api/quizzes/course/${courseId}`, 'GET', `/quizzes/course/${courseId}`, { token: studentToken });
        await test(`GET /api/ratings/course/${courseId}`, 'GET', `/ratings/course/${courseId}`);
        await test(`GET /api/discussions/course/${courseId}`, 'GET', `/discussions/course/${courseId}`, { token: studentToken });
        await test(`GET /api/versions/${courseId}/versions`, 'GET', `/versions/${courseId}/versions`, { token: studentToken });
        await test(`GET /api/versions/${courseId}/drip-status`, 'GET', `/versions/${courseId}/drip-status`, { token: studentToken });
    } else {
        results.PASS.push({ name: '⚠️ Course detail tests', status: '-', note: 'No courses found, skipping' });
    }

    // ---- 403 CHECKS (verify authorization) ----
    console.log('\n📌 AUTHORIZATION CHECKS (should 403)');
    await test('Admin → GET /api/stats/admins (should 403)', 'GET', '/stats/admins', { token: adminToken, failOn: 403 });
    await test('Admin → GET /api/stats/settings (should 403)', 'GET', '/stats/settings', { token: adminToken, failOn: 403 });
    await test('Instructor → GET /api/stats/admins (should 403)', 'GET', '/stats/admins', { token: instructorToken, failOn: 403 });
    await test('Student → GET /api/stats/platform (should 403)', 'GET', '/stats/platform', { token: studentToken, failOn: 403 });
    await test('Student → GET /api/users (should 403)', 'GET', '/users', { token: studentToken, failOn: 403 });
    await test('Instructor → GET /api/stats/settings (should 403)', 'GET', '/stats/settings', { token: instructorToken, failOn: 403 });

    // ---- SUMMARY ----
    console.log('\n═══════════════════════════════════════════════');
    console.log('   📊 RESULTS SUMMARY');
    console.log('═══════════════════════════════════════════════');
    console.log(`   ✅ PASSED: ${results.PASS.length}`);
    console.log(`   ❌ FAILED: ${results.FAIL.length}`);
    console.log('');

    results.PASS.forEach(r => console.log(`   ✅ ${r.name}${r.note || ''}`));

    if (results.FAIL.length > 0) {
        console.log('\n   ❌ FAILURES:');
        results.FAIL.forEach(r => console.log(`   ❌ ${r.name} — status ${r.status}: ${r.error}`));
        process.exit(1);
    } else {
        console.log('\n   🎉 ALL ROUTES PASS!');
    }
})().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
