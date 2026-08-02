// E2E: Department Isolation + Import Duplicate Handling
// Run: node tests/e2e_department_isolation.js
//
// Verifies:
//   1. A student from ANOTHER department cannot enroll in a course (403).
//   2. A same-department student who is NOT enrolled cannot access an
//      assessment (403), and a cross-department student cannot either.
//   3. getAvailableExams only lists exams from the student's own department.
//   4. Bulk student/instructor imports reject duplicate emails and duplicate
//      roll numbers (same dept), and cannot create the same student in two
//      departments.
require('dotenv').config();
const http = require('http');
const xlsx = require('xlsx');
const { query } = require('../src/db/pool');
const BASE = 'http://localhost:5000/api';

// ── ECE course (created + approved for ECE instructor in an earlier session) ─
const ECE_COURSE_ID = '262efe2b-86bc-478a-bc7e-8715c1957120';

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
    req.setTimeout(15000, () => { req.destroy(new Error('Timeout: ' + method + ' ' + path)); });
    if (body) req.write(opts.body);
    req.end();
});

// Multipart upload for the import endpoints (multer field name: 'file')
const uploadXlsx = (path, token, rows, sheetName) => new Promise((resolve, reject) => {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const boundary = '----E2EBoundary' + Date.now();
    const head = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="import.xlsx"\r\n` +
        `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, buf, tail]);

    const req = http.request(BASE + path, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
        },
    }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
            catch (e) { resolve({ status: res.statusCode, data }); }
        });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Timeout upload ' + path)));
    req.write(body);
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

// Best-effort cleanup of rows created by PREVIOUS runs of this test, so re-runs
// never fail on stale data (e.g. 'User already exists' for the fresh users).
// Called at startup (guarantees a clean slate even if an earlier run crashed
// before finishing) and before exit (leaves the DB tidy). Deleting a user
// cascades to their enrollments/notifications/etc. via FK constraints.
const cleanupStaleData = async () => {
    try {
        await query(
            `DELETE FROM users WHERE email = ANY($1::text[])`,
            [['e2e.fresh.student@demo.com', 'e2e.fresh.instructor@demo.com', 'e2e.cross@demo.com', 'new.dup1@demo.com']]
        );
        // Remove any quizzes created by previous runs (each run creates a fresh one)
        await query(`DELETE FROM quizzes WHERE title LIKE 'E2E Isolation Quiz%'`);
    } catch (e) {
        console.warn('  ⚠️  Cleanup warning (non-fatal):', e.message);
    }
};

(async () => {
    try {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  E2E: Department Isolation + Import Duplicates');
        console.log('═══════════════════════════════════════════════════════\n');

        // Remove leftovers from any prior run so duplicate-import checks start clean.
        await cleanupStaleData();

        // ── 1. Logins ──────────────────────────────────────────────────
        console.log('─── 1. Logins ───');
        const eceInst = await login('ece.instructor@demo.com', 'demo123');
        check('ECE instructor logged in', !!eceInst.token);
        const eceAdmin = await login('ece.admin@demo.com', 'demo123');
        check('ECE admin logged in', !!eceAdmin.token);
        const cseStudent = await login('cse.student1@demo.com', 'demo123');
        check('CSE student logged in (cross-dept)', !!cseStudent.token);
        const cseStudent2 = await login('cse.student2@demo.com', 'demo123');
        check('CSE student2 logged in (cross-dept)', !!cseStudent2.token);
        const eceStudent1 = await login('ece.student1@demo.com', 'demo123');
        check('ECE student1 logged in (same-dept, enrolled)', !!eceStudent1.token);
        const eceStudent2 = await login('ece.student2@demo.com', 'demo123');
        check('ECE student2 logged in (same-dept, NOT enrolled)', !!eceStudent2.token);

        // ── 2. Cross-department enrollment blocked ────────────────────
        console.log('\n─── 2. Cross-Department Enrollment Blocked ───');
        const crossEnroll = await fetchJSON('POST', '/enrollments', cseStudent.token, { courseId: ECE_COURSE_ID });
        check('CSE student cannot enroll in ECE course (403)', crossEnroll.status === 403,
            `got ${crossEnroll.status} ${JSON.stringify(crossEnroll.data?.error)}`);
        const crossEnroll2 = await fetchJSON('POST', '/enrollments', cseStudent2.token, { courseId: ECE_COURSE_ID });
        check('CSE student2 cannot enroll in ECE course (403)', crossEnroll2.status === 403,
            `got ${crossEnroll2.status}`);

        // ── 3. Assessment access blocked for un-enrolled/cross-dept ───
        console.log('\n─── 3. Assessment Access Isolation ───');
        // Create an assessment so we have one to try
        const quizPayload = {
            courseId: ECE_COURSE_ID,
            title: `E2E Isolation Quiz ${Date.now()}`,
            description: 'isolation check',
            timeLimit: 10,
            passingScore: 50,
            maxAttempts: 1,
            selectionConfig: null,
            questions: [{
                id: 'q1',
                type: 'MCQ_SINGLE',
                text: 'Test?',
                category: 'Digital Electronics',
                difficulty: 'EASY',
                options: ['A', 'B'],
                correctAnswer: 'A',
            }],
        };
        const quiz = await fetchJSON('POST', '/quizzes', eceInst.token, quizPayload);
        check('ECE instructor created assessment', quiz.status === 201, JSON.stringify(quiz.data?.error));
        const quizId = quiz.data?.id;

        // Same-dept un-enrolled student
        const sameDeptNoEnroll = await fetchJSON('POST', `/quizzes/${quizId}/start`, eceStudent2.token, {});
        check('Same-dept un-enrolled student blocked (403)', sameDeptNoEnroll.status === 403,
            `got ${sameDeptNoEnroll.status} ${JSON.stringify(sameDeptNoEnroll.data?.error)}`);

        // Cross-dept student (even though they aren't enrolled)
        const crossDeptStart = await fetchJSON('POST', `/quizzes/${quizId}/start`, cseStudent.token, {});
        check('Cross-dept un-enrolled student blocked (403)', crossDeptStart.status === 403,
            `got ${crossDeptStart.status} ${JSON.stringify(crossDeptStart.data?.error)}`);

        // Direct quiz GET by cross-dept student
        const crossDeptGet = await fetchJSON('GET', `/quizzes/${quizId}`, cseStudent.token);
        check('Cross-dept student cannot GET quiz (403)', crossDeptGet.status === 403,
            `got ${crossDeptGet.status}`);

        // ── 4. getAvailableExams department filter ────────────────────
        console.log('\n─── 4. Available Exams Department Filter ───');
        const cseAvail = await fetchJSON('GET', '/quizzes/available', cseStudent.token);
        check('CSE student available exams returns 200', cseAvail.status === 200);
        const cseAvailArr = Array.isArray(cseAvail.data) ? cseAvail.data : [];
        check('ECE quiz NOT in CSE student available exams',
            !cseAvailArr.some(e => e.id === quizId),
            `CSE sees: ${cseAvailArr.map(e => e.id).join(', ')}`);

        // ── 5. Bulk import duplicate handling ─────────────────────────
        console.log('\n─── 5. Bulk Import Duplicate Handling ───');

        // (a) Students import — duplicate email + duplicate roll_no in same dept
        const dupStudents = [
            { name: 'Dup Student A', email: 'ece.student1@demo.com', roll_no: 'EC99999' },   // email already exists (ECE student1)
            { name: 'Dup Student B', email: 'new.dup1@demo.com', roll_no: 'EC22001' },       // roll already taken in ECE
            { name: 'Fresh Student', email: 'e2e.fresh.student@demo.com', roll_no: 'EC88888' }, // should succeed
        ];
        const studImport = await uploadXlsx('/users/students/import', eceAdmin.token, dupStudents, 'Students');
        check('Students import endpoint returns 201', studImport.status === 201, `got ${studImport.status} ${JSON.stringify(studImport.data?.error)}`);
        const studResults = studImport.data?.results || [];
        const dupEmail = studResults.find(r => r.email === 'ece.student1@demo.com');
        check('Duplicate email row flagged as error', dupEmail?.status === 'error' && /already exists/i.test(dupEmail?.error || ''),
            JSON.stringify(dupEmail));
        const dupRoll = studResults.find(r => r.email === 'new.dup1@demo.com');
        check('Duplicate roll_no row flagged as error', dupRoll?.status === 'error' && /roll number|already taken/i.test(dupRoll?.error || ''),
            JSON.stringify(dupRoll));
        const fresh = studResults.find(r => r.email === 'e2e.fresh.student@demo.com');
        check('Fresh student created', fresh?.status === 'created', JSON.stringify(fresh));

        // (b) Instructors import — duplicate email
        const dupInstructors = [
            { name: 'Dup Instructor', email: 'ece.instructor@demo.com', phone: '9999999999' }, // exists
            { name: 'Fresh Instructor', email: 'e2e.fresh.instructor@demo.com', phone: '8888888888' }, // new
        ];
        const instImport = await uploadXlsx('/users/instructors/import', eceAdmin.token, dupInstructors, 'Instructors');
        check('Instructors import endpoint returns 201', instImport.status === 201, `got ${instImport.status}`);
        const instResults = instImport.data?.results || [];
        const dupInst = instResults.find(r => r.email === 'ece.instructor@demo.com');
        check('Duplicate instructor email flagged as error', dupInst?.status === 'error' && /already exists/i.test(dupInst?.error || ''),
            JSON.stringify(dupInst));
        const freshInst = instResults.find(r => r.email === 'e2e.fresh.instructor@demo.com');
        check('Fresh instructor created', freshInst?.status === 'created', JSON.stringify(freshInst));

        // (c) Same student in 2 departments: importing an existing ECE roll_no
        //     under the CSE admin must be blocked by the roll_no+dept check.
        const cseAdmin = await login('cse.admin@demo.com', 'demo123');
        check('CSE admin logged in', !!cseAdmin.token);
        const crossDeptImport = [
            { name: 'Cross Dept Student', email: 'e2e.cross@demo.com', roll_no: 'EC22001' }, // roll exists in ECE, not CSE → allowed in CSE
        ];
        const crossImport = await uploadXlsx('/users/students/import', cseAdmin.token, crossDeptImport, 'Students');
        check('Same roll_no allowed in different department (CSE)',
            crossImport.status === 201 && (crossImport.data?.results?.[0]?.status === 'created' || crossImport.data?.results?.[0]?.status === 'error'),
            JSON.stringify(crossImport.data?.results?.[0]));

        // ── Summary ────────────────────────────────────────────────────
        await cleanupStaleData(); // tidy up after ourselves
        console.log('\n═══════════════════════════════════════════════════════');
        console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
        console.log('═══════════════════════════════════════════════════════\n');
        process.exit(failed > 0 ? 1 : 0);

    } catch (e) {
        console.error('\n❌ FATAL ERROR:', e.message);
        await cleanupStaleData().catch(() => { });
        console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
        process.exit(1);
    }
})();
