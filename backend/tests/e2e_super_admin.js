// E2E: Super-Admin Endpoints
// Run: node tests/e2e_super_admin.js
//
// Logs in as the SUPER_ADMIN and asserts every super-admin endpoint returns
// 200 with the expected response shape:
//   GET  /stats/departments   — every department with usage stats
//   GET  /stats/admins        — per-department overview vs limits
//   GET  /stats/settings      — platform settings object
//   GET  /stats/audit-logs    — recent audit entries
//   GET  /stats/system-health — service/DB/memory health
//   GET  /stats/ai-report     — data-driven platform report
//   GET  /departments         — full department taxonomy (SUPER_ADMIN only)
//   GET  /users               — all users (admin scope)
require('dotenv').config();
const http = require('http');
const { query } = require('../src/db/pool');
const BASE = 'http://localhost:5000/api';

const fetchJSON = (method, path, token = null, body = null) => new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const req = http.request(BASE + path, opts, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
            catch (e) { resolve({ status: res.statusCode, data }); }
        });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('Timeout: ' + method + ' ' + path)); });
    if (body) req.write(opts.body);
    req.end();
});

const login = async (email, password) => {
    const r = await fetchJSON('POST', '/auth/login', null, { email, password });
    if (r.status !== 200) throw new Error(`Login failed for ${email}: ${r.status} ${JSON.stringify(r.data)}`);
    return { token: r.data.token, user: r.data.user || r.data };
};

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
    if (ok) { passed++; console.log(`  ✅ ${label}`); }
    else { failed++; console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); }
};

(async () => {
    try {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  E2E: Super-Admin Endpoints');
        console.log('═══════════════════════════════════════════════════════\n');

        // ── 1. Super-admin login ──────────────────────────────────────
        console.log('─── 1. Login ───');
        const sa = await login('superadmin@lms.com', 'superadmin');
        check('SUPER_ADMIN logged in', !!sa.token);
        check('Logged-in user has SUPER_ADMIN role', sa.user?.role === 'SUPER_ADMIN',
            `got ${sa.user?.role}`);
        // Guards against a stale 'Test' seed name surviving in an old database
        // (the seed now DO UPDATEs the name on conflict).
        check('Super-admin name is "Super Admin"', sa.user?.name === 'Super Admin',
            `got ${sa.user?.name}`);

        // ── 2. Departments overview ───────────────────────────────────
        console.log('\n─── 2. /stats/departments ───');
        const departments = await fetchJSON('GET', '/stats/departments', sa.token);
        check('GET /stats/departments returns 200', departments.status === 200,
            `got ${departments.status} ${JSON.stringify(departments.data?.error)}`);
        const deptArr = Array.isArray(departments.data) ? departments.data : [];
        check('Returns an array of departments', Array.isArray(departments.data));
        check('Departments carry usage stats', deptArr.every(d => d.id && d.name &&
            typeof d.studentCount === 'number' && typeof d.courseTotal === 'number'),
            JSON.stringify(deptArr[0]));
        check('At least one department exists', deptArr.length > 0, `got ${deptArr.length}`);

        // ── 3. Admins overview (usage vs limits) ──────────────────────
        console.log('\n─── 3. /stats/admins ───');
        const admins = await fetchJSON('GET', '/stats/admins', sa.token);
        check('GET /stats/admins returns 200', admins.status === 200,
            `got ${admins.status} ${JSON.stringify(admins.data?.error)}`);
        check('Returns { defaults, data } shape',
            admins.data?.defaults && Array.isArray(admins.data?.data),
            JSON.stringify(admins.data));
        check('Defaults include maxStudents/maxCourses',
            typeof admins.data?.defaults?.maxStudents === 'number' &&
            typeof admins.data?.defaults?.maxCourses === 'number');
        check('Each dept has usage + limit fields',
            (admins.data?.data || []).every(d => d.departmentName && d.maxStudents != null && d.maxCourses != null));

        // ── 4. Platform settings ──────────────────────────────────────
        console.log('\n─── 4. /stats/settings ───');
        const settings = await fetchJSON('GET', '/stats/settings', sa.token);
        check('GET /stats/settings returns 200', settings.status === 200,
            `got ${settings.status} ${JSON.stringify(settings.data?.error)}`);
        check('Settings is an object', settings.data && typeof settings.data === 'object' && !Array.isArray(settings.data));

        // ── 5. Audit logs ─────────────────────────────────────────────
        console.log('\n─── 5. /stats/audit-logs ───');
        const audit = await fetchJSON('GET', '/stats/audit-logs', sa.token);
        check('GET /stats/audit-logs returns 200', audit.status === 200,
            `got ${audit.status} ${JSON.stringify(audit.data?.error)}`);
        check('Audit logs is an array', Array.isArray(audit.data));
        check('Audit entries have expected fields',
            (audit.data || []).every(l => l.id && l.action && l.timestamp),
            JSON.stringify(audit.data?.[0]));

        // ── 6. System health ──────────────────────────────────────────
        console.log('\n─── 6. /stats/system-health ───');
        const health = await fetchJSON('GET', '/stats/system-health', sa.token);
        check('GET /stats/system-health returns 200', health.status === 200,
            `got ${health.status} ${JSON.stringify(health.data?.error)}`);
        check('Health reports services + memory',
            Array.isArray(health.data?.services) && health.data?.memory && health.data?.uptime != null,
            JSON.stringify(health.data));
        check('Database service status present',
            health.data?.services?.some(s => /database/i.test(s.name)), 
            JSON.stringify(health.data?.services?.map(s => s.name)));

        // ── 7. AI report ──────────────────────────────────────────────
        console.log('\n─── 7. /stats/ai-report ───');
        const ai = await fetchJSON('GET', '/stats/ai-report', sa.token);
        check('GET /stats/ai-report returns 200', ai.status === 200,
            `got ${ai.status} ${JSON.stringify(ai.data?.error)}`);
        check('AI report has generatedAt + platform block',
            ai.data?.generatedAt && ai.data?.platform && Array.isArray(ai.data?.departments),
            JSON.stringify(Object.keys(ai.data || {})));

        // ── 8. Departments taxonomy + users (SUPER_ADMIN-wide) ────────
        console.log('\n─── 8. /departments + /users ───');
        const deptTaxonomy = await fetchJSON('GET', '/departments', sa.token);
        check('GET /departments returns 200', deptTaxonomy.status === 200,
            `got ${deptTaxonomy.status} ${JSON.stringify(deptTaxonomy.data?.error)}`);
        check('Department taxonomy is an array', Array.isArray(deptTaxonomy.data));
        const users = await fetchJSON('GET', '/users?limit=5', sa.token);
        check('GET /users returns 200', users.status === 200,
            `got ${users.status} ${JSON.stringify(users.data?.error)}`);
        // getAll returns { success, data: [...], pagination }; tolerate plain arrays too.
        const usersArr = users.data?.data || users.data?.users || users.data;
        check('Users list is an array', Array.isArray(usersArr));
        check('Users list has entries', Array.isArray(usersArr) && usersArr.length > 0, `got ${usersArr?.length}`);

        // ── 9. Negative: a STUDENT must be blocked from super-admin routes ──
        console.log('\n─── 9. Access control ───');
        const student = await login('cse.student1@demo.com', 'demo123');
        check('Student logged in (for negative test)', !!student.token);
        const denied = await fetchJSON('GET', '/stats/system-health', student.token);
        check('Student blocked from /stats/system-health (403)', denied.status === 403,
            `got ${denied.status}`);
        const deniedDept = await fetchJSON('GET', '/stats/departments', student.token);
        check('Student blocked from /stats/departments (403)', deniedDept.status === 403,
            `got ${deniedDept.status}`);

        // ── Summary ────────────────────────────────────────────────────
        console.log('\n═══════════════════════════════════════════════════════');
        console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
        console.log('═══════════════════════════════════════════════════════\n');
        process.exit(failed > 0 ? 1 : 0);

    } catch (e) {
        console.error('\n❌ FATAL ERROR:', e.message);
        console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
        process.exit(1);
    }
})();
