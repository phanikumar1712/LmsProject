// E2E: Full Assessment Flow — create → notify → take → rank + max-attempts enforcement
// Run: node tests/e2e_assessment_flow.js
//
// NOTE: COURSE_ID below was created by the ECE instructor and approved by the
// ECE admin in an earlier session ("ECE Test Quiz Course", PUBLISHED). If the
// DB is reset, create + approve a course for ece.instructor@demo.com and
// replace this ID.
require('dotenv').config();
const http = require('http');
const BASE = 'http://localhost:5000/api';

// ── Shared course ID (created + approved for ECE instructor) ──────────────
const COURSE_ID = '262efe2b-86bc-478a-bc7e-8715c1957120';

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
        console.log('  E2E: Assessment Flow (create → notify → take → rank)');
        console.log('═══════════════════════════════════════════════════════\n');

        // ── 1. Login as ECE instructor ──────────────────────────────────
        console.log('─── 1. Instructor Login ───');
        const instAuth = await login('ece.instructor@demo.com', 'demo123');
        const instToken = instAuth.token;
        const instructorId = instAuth.user.id;
        check('Instructor logged in', !!instToken);
        console.log(`    Instructor ID: ${instructorId}`);

        // ── 2. Verify published course ─────────────────────────────────
        console.log('\n─── 2. Verify Published Course ───');
        const course = await fetchJSON('GET', `/courses/${COURSE_ID}`, instToken);
        check('Published course exists', course.status === 200, JSON.stringify(course.data?.error));
        console.log(`    Course: "${course.data?.title || course.title}" (${course.data?.status || course.status})`);

        // ── 3. Ensure student enrolled BEFORE quiz creation (so the
        //      creation notification reaches them) ─────────────────────
        console.log('\n─── 3. Student Login & Enroll ───');
        const studAuth = await login('ece.student1@demo.com', 'demo123');
        const studToken = studAuth.token;
        const studentId = studAuth.user.id;
        check('Student logged in', !!studToken);
        console.log(`    Student ID: ${studentId}`);

        const enroll = await fetchJSON('POST', '/enrollments', studToken, { courseId: COURSE_ID });
        check('Student enrolled in course', enroll.status === 201 || enroll.status === 200 || enroll.status === 409,
            JSON.stringify(enroll.data?.error || enroll.status));
        if (enroll.status === 409) console.log('    (already enrolled — continuing)');

        // ── 4. Instructor creates an assessment with maxAttempts=1 ─────
        console.log('\n─── 4. Instructor Creates Assessment (maxAttempts=1) ───');
        const quizTitle = `E2E Assessment ${Date.now()}`;
        const quizPayload = {
            courseId: COURSE_ID,
            title: quizTitle,
            description: 'Created during automated E2E assessment-flow verification',
            timeLimit: 10,
            passingScore: 50,
            maxAttempts: 1,
            selectionConfig: null,
            questions: [
                {
                    id: 'q_semi',
                    type: 'MCQ_SINGLE',
                    text: 'Silicon is a ___ material?',
                    category: 'Materials',
                    difficulty: 'EASY',
                    options: ['Semiconductor', 'Conductor', 'Insulator', 'Superconductor'],
                    correctAnswer: 'Semiconductor'
                },
                {
                    id: 'q_diode',
                    type: 'MCQ_MULTI',
                    text: 'Select diodes:',
                    category: 'Components',
                    difficulty: 'MEDIUM',
                    options: ['LED', 'Zener', 'Resistor', 'Capacitor'],
                    correctAnswer: ['LED', 'Zener']
                },
                {
                    id: 'q_blank',
                    type: 'FILL_BLANK',
                    text: 'The free electron is the majority carrier in ___ type semiconductor',
                    category: 'Materials',
                    difficulty: 'MEDIUM',
                    options: [],
                    correctAnswer: 'N'
                }
            ]
        };
        const quiz = await fetchJSON('POST', '/quizzes', instToken, quizPayload);
        check('Assessment created', quiz.status === 201, JSON.stringify(quiz.data?.error || quiz.status));
        const quizId = quiz.data?.id;
        check('Assessment ID returned', !!quizId);
        check('maxAttempts persisted = 1', quiz.data?.maxAttempts === 1, `got ${quiz.data?.maxAttempts}`);
        console.log(`    Quiz ID: ${quizId}`);

        // ── 5. Instructor sees it in their assessment list ─────────────
        console.log('\n─── 5. Instructor Assessment List ───');
        const myQuizzes = await fetchJSON('GET', `/quizzes/instructor/${instructorId}`, instToken);
        check('Instructor can list assessments', myQuizzes.status === 200, JSON.stringify(myQuizzes.data?.error));
        const listArr = Array.isArray(myQuizzes.data) ? myQuizzes.data : Array.isArray(myQuizzes) ? myQuizzes : [];
        const foundInList = listArr.some(q => q.id === quizId);
        check('New assessment appears in instructor list', foundInList);
        const listItem = listArr.find(q => q.id === quizId);
        check('List exposes maxAttempts', listItem?.maxAttempts === 1, `got ${listItem?.maxAttempts}`);
        check('List exposes passingScore', listItem?.passingScore === 50);

        // ── 6. Student receives the "new assessment" notification ─────
        console.log('\n─── 6. Student Notification ───');
        const notifsRes = await fetchJSON('GET', '/notifications?limit=50', studToken);
        check('Student can fetch notifications', notifsRes.status === 200);
        const notifPayload = notifsRes.data?.data || notifsRes.data || notifsRes || [];
        const notifList = Array.isArray(notifPayload) ? notifPayload :
                          Array.isArray(notifPayload?.data) ? notifPayload.data : [];
        const hasAssessNotif = notifList.some(n =>
            n.message?.includes(quizTitle) ||
            (n.message?.includes('assessment') && n.link?.includes(quizId))
        );
        check('Student received "new assessment" notification', hasAssessNotif,
            `Notifications: ${notifList.length} — ${notifList.map(n => n.message).join(' | ')}`);
        const assessNotif = notifList.find(n => n.message?.includes(quizTitle) || n.link?.includes(quizId));
        check('Notification links to the exam', !!assessNotif?.link?.includes(`/courses/${COURSE_ID}/quiz/${quizId}`),
            assessNotif?.link);

        // ── 7. Student sees exam in "available exams" (write exam tab) ─
        console.log('\n─── 7. Student Available Exams ───');
        const avail = await fetchJSON('GET', '/quizzes/available', studToken);
        check('Student can fetch available exams', avail.status === 200, JSON.stringify(avail.data?.error));
        const availArr = Array.isArray(avail.data) ? avail.data : Array.isArray(avail) ? avail : [];
        const myExam = availArr.find(e => e.id === quizId);
        check('New exam appears in Write Exam tab', !!myExam, `Available: ${availArr.map(e => e.id).join(', ')}`);
        check('Exposes attemptsLeft = 1', myExam?.attemptsLeft === 1, `got ${myExam?.attemptsLeft}`);
        check('Exposes attemptsUsed = 0', myExam?.attemptsUsed === 0, `got ${myExam?.attemptsUsed}`);
        console.log(`    Exam: "${myExam?.title}" · ${myExam?.questionCount} Qs · ${myExam?.timeLimit}m · pass ${myExam?.passingScore}%`);

        // ── 8. Student starts the exam ─────────────────────────────────
        console.log('\n─── 8. Student Starts Exam ───');
        const start = await fetchJSON('POST', `/quizzes/${quizId}/start`, studToken, {});
        check('Student can start exam', start.status === 201 || start.status === 200,
            JSON.stringify(start.data?.error || start.status));
        const attemptId = start.data?.attemptId;
        check('Attempt ID returned', !!attemptId);
        console.log(`    Attempt ID: ${attemptId}`);
        console.log(`    Questions served: ${start.data?.quiz?.questions?.length || 0}`);

        // ── 9. Student submits answers (all correct) ───────────────────
        console.log('\n─── 9. Student Submits Answers ───');
        const answers = {
            q_semi: 'Semiconductor',
            q_diode: ['LED', 'Zener'],
            q_blank: 'N'
        };
        const submit = await fetchJSON('POST', `/quizzes/${quizId}/attempt`, studToken, {
            attemptId, answers, violations: 0
        });
        check('Student can submit exam', submit.status === 201 || submit.status === 200,
            JSON.stringify(submit.data?.error || submit.status));
        const score = submit.data?.score;
        check('Auto-graded 100%', score === 100, `score=${score}`);
        check('Passed = true', submit.data?.passed === true);
        console.log(`    Score: ${score}%, Passed: ${submit.data?.passed}`);

        // ── 10. Max-attempts enforcement: second start is blocked ──────
        console.log('\n─── 10. Max-Attempts Enforcement (maxAttempts=1) ───');
        const second = await fetchJSON('POST', `/quizzes/${quizId}/start`, studToken, {});
        check('Second start is blocked', second.status === 403,
            `expected 403, got ${second.status} ${JSON.stringify(second.data)}`);
        check('Block message is clear', typeof second.data?.error === 'string' && second.data.error.includes('allowed attempt'),
            second.data?.error);

        // ── 11. Instructor sees ranking update ─────────────────────────
        console.log('\n─── 11. Instructor Sees Ranking ───');
        const perf = await fetchJSON('GET', `/quizzes/${quizId}/performance`, instToken);
        check('Instructor can fetch performance', perf.status === 200, JSON.stringify(perf.data?.error));
        const ranking = perf.data?.ranking || [];
        check('Ranking has 1 student', Array.isArray(ranking) && ranking.length === 1,
            `ranking length: ${ranking.length}`);
        const topStudent = ranking[0];
        check('Ranked student is our student', topStudent?.studentId === studentId, `got ${topStudent?.studentId}`);
        check('Rank #1', topStudent?.rank === 1, `rank=${topStudent?.rank}`);
        check('Score shows 100%', topStudent?.score === 100, `score=${topStudent?.score}`);
        check('Attempts count = 1', topStudent?.attempts === 1, `attempts=${topStudent?.attempts}`);
        check('Passed = true', topStudent?.passed === true);
        const summary = perf.data?.summary;
        check('Summary participants = 1', summary?.participants === 1, JSON.stringify(summary));
        check('Summary pass rate = 100%', summary?.passRate === 100, `passRate=${summary?.passRate}`);
        check('Detail exposes maxAttempts', perf.data?.quiz?.maxAttempts === 1, `got ${perf.data?.quiz?.maxAttempts}`);
        console.log(`    Ranking: ${topStudent?.name} (${topStudent?.rollNo}) — ${topStudent?.score}% — Rank #${topStudent?.rank}`);

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
