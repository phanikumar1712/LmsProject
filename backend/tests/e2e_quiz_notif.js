// E2E: Quiz creation → start → submit + Notification flow
// This test is saved as a permanent test script for future use.
// Run: node tests/e2e_quiz_notif.js
require('dotenv').config();
const http = require('http');
const BASE = 'http://localhost:5000/api';

const fetchJSON = (path, opts = {}) => new Promise((resolve, reject) => {
    const req = http.request(BASE + path, opts, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
            catch (e) { resolve({ status: res.statusCode, data }); }
        });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
});

const login = async (email, password) => {
    const r = await fetchJSON('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (r.status !== 200) throw new Error(`Login failed for ${email}: ${r.status}`);
    return { token: r.data.token, user: r.data.user || r.data };
};

const authOpts = (token) => ({
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
});

// ── Shared course ID (created + approved for ECE instructor) ──────────────
const COURSE_ID = '262efe2b-86bc-478a-bc7e-8715c1957120';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
    if (ok) { passed++; console.log(`  ✅ ${label}`); }
    else { failed++; console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); }
};

(async () => {
    try {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  E2E: Quiz Builder + Notification Flow');
        console.log('═══════════════════════════════════════════════════════\n');

        // ── 1. Login as ECE instructor ──────────────────────────────────
        console.log('─── 1. Instructor Login ───');
        const instAuth = await login('ece.instructor@demo.com', 'demo123');
        const instToken = instAuth.token;
        const instructorId = instAuth.user.id;
        check('Instructor logged in', !!instToken);
        console.log(`    Instructor ID: ${instructorId}`);

        // ── 2. Verify course is accessible ───────────────────────────────
        console.log('\n─── 2. Verify Published Course ───');
        const course = await fetchJSON(`/courses/${COURSE_ID}`, authOpts(instToken));
        check('Published course exists', course.status === 200, JSON.stringify(course.data?.error));
        console.log(`    Course: "${course.data?.title || course.title}" (${course.data?.status || course.status})`);

        // ── 3. Create a quiz ─────────────────────────────────────────────
        console.log('\n─── 3. Instructor Creates Quiz ───');
        const quizPayload = {
            courseId: COURSE_ID,
            title: 'E2E Test - Digital Electronics Quiz',
            description: 'Created during automated E2E verification',
            timeLimit: 10,
            passingScore: 60,
            selectionConfig: null,
            questions: [
                {
                    id: 'q_diode',
                    type: 'MCQ_SINGLE',
                    text: 'What does a diode do?',
                    category: 'Fundamentals',
                    difficulty: 'EASY',
                    options: ['Rectifies AC', 'Amplifies signal', 'Stores charge', 'Generates voltage'],
                    correctAnswer: 'Rectifies AC'
                },
                {
                    id: 'q_gates',
                    type: 'MCQ_MULTI',
                    text: 'Select logic gates:',
                    category: 'Gates',
                    difficulty: 'MEDIUM',
                    options: ['AND', 'OR', 'RESISTOR', 'CAPACITOR'],
                    correctAnswer: ['AND', 'OR']
                },
                {
                    id: 'q_fill',
                    type: 'FILL_BLANK',
                    text: 'The most common semiconductor material is ___',
                    category: 'Materials',
                    difficulty: 'EASY',
                    options: [],
                    correctAnswer: 'Silicon'
                }
            ]
        };
        const quiz = await fetchJSON('/quizzes', {
            ...authOpts(instToken),
            method: 'POST',
            body: JSON.stringify(quizPayload)
        });
        check('Quiz created successfully', quiz.status === 201, JSON.stringify(quiz.data?.error || quiz.status));
        const quizId = quiz.data?.id;
        console.log(`    Quiz ID: ${quizId}`);
        console.log(`    Questions: ${quiz.data?.questions?.length || 0}`);

        // ── 4. Login as ECE student and enroll ───────────────────────────
        console.log('\n─── 4. Student Login & Enroll ───');
        const studAuth = await login('ece.student1@demo.com', 'demo123');
        const studToken = studAuth.token;
        const studentId = studAuth.user.id;
        check('Student logged in', !!studToken);
        console.log(`    Student ID: ${studentId}`);

        const enroll = await fetchJSON('/enrollments', {
            ...authOpts(studToken),
            method: 'POST',
            body: JSON.stringify({ courseId: COURSE_ID })
        });
        check('Student enrolled in course', enroll.status === 201 || enroll.status === 200,
            JSON.stringify(enroll.data?.error || enroll.status));

        // ── 5. Student views course quizzes (must NOT see answers) ───────
        console.log('\n─── 5. Student Views Quiz (no answers exposed) ───');
        const courseQuizzes = await fetchJSON(`/quizzes/course/${COURSE_ID}`, authOpts(studToken));
        check('Student can view course quizzes', courseQuizzes.status === 200);
        const quizList = Array.isArray(courseQuizzes.data) ? courseQuizzes.data :
                         Array.isArray(courseQuizzes) ? courseQuizzes : [];
        if (quizList.length > 0) {
            const hasAnswers = quizList.some(q =>
                q.questions?.some(qq => qq.correctAnswer !== undefined)
            );
            check('Student does NOT see answer keys', !hasAnswers, 'Answers were exposed!');
        }

        // ── 6. Student starts quiz attempt ───────────────────────────────
        console.log('\n─── 6. Student Starts Quiz Attempt ───');
        const start = await fetchJSON(`/quizzes/${quizId}/start`, {
            ...authOpts(studToken),
            method: 'POST',
            body: JSON.stringify({})
        });
        check('Student can start quiz attempt', start.status === 201 || start.status === 200,
            JSON.stringify(start.data?.error || start.status));
        const attemptId = start.data?.attemptId;
        check('Attempt ID returned', !!attemptId);
        check('Expiry time set', !!start.data?.expiresAt);
        console.log(`    Attempt ID: ${attemptId}`);
        console.log(`    Questions served: ${start.data?.quiz?.questions?.length || 0}`);

        // ── 7. Student submits quiz attempt ──────────────────────────────
        console.log('\n─── 7. Student Submits Quiz ───');
        const answers = {
            q_diode: 'Rectifies AC',
            q_gates: ['AND', 'OR'],
            q_fill: 'Silicon'
        };
        const submit = await fetchJSON(`/quizzes/${quizId}/attempt`, {
            ...authOpts(studToken),
            method: 'POST',
            body: JSON.stringify({ attemptId, answers, violations: 0 })
        });
        check('Student can submit quiz', submit.status === 201 || submit.status === 200,
            JSON.stringify(submit.data?.error || submit.status));
        const score = submit.data?.score;
        const qPassed = submit.data?.passed;
        check('Quiz was auto-graded (score >= 0)', score !== undefined && score !== null);
        check('All correct answers = 100%', score === 100);
        console.log(`    Score: ${score}%, Passed: ${qPassed}`);

        // ── 8. Student views attempt history ─────────────────────────────
        console.log('\n─── 8. Student Views Attempt History ───');
        const attemptsRes = await fetchJSON(`/quizzes/attempts/${studentId}`, authOpts(studToken));
        check('Student can view attempt history', attemptsRes.status === 200);
        const attempts = attemptsRes.data || attemptsRes || [];
        check('Attempt appears in history', Array.isArray(attempts) && attempts.length > 0);
        if (Array.isArray(attempts) && attempts.length > 0) {
            check('History shows score', attempts[0].score === 100);
            check('History shows passed=true', attempts[0].passed === true);
        }

        // ── 9. Admin creates announcement → notifications ────────────────
        console.log('\n─── 9. Admin Creates Announcement ───');
        const adminAuth = await login('ece.admin@demo.com', 'demo123');
        const adminToken = adminAuth.token;
        check('Admin logged in', !!adminToken);

        const announcement = await fetchJSON('/announcements', {
            ...authOpts(adminToken),
            method: 'POST',
            body: JSON.stringify({
                title: 'E2E Test: Quiz Reminder',
                content: 'This is a test announcement for verifying notifications!',
                priority: 'NORMAL',
                pinned: false,
                targetRoles: ['STUDENT']
            })
        });
        check('Admin can create announcement', announcement.status === 201 || announcement.status === 200,
            JSON.stringify(announcement.data?.error || announcement.status));

        // ── 10. Student receives notification ────────────────────────────
        console.log('\n─── 10. Student Receives Notification ───');
        const notifsRes = await fetchJSON('/notifications', authOpts(studToken));
        check('Student can fetch notifications', notifsRes.status === 200);
        const notifPayload = notifsRes.data?.data || notifsRes.data || notifsRes || [];
        const notifList = Array.isArray(notifPayload) ? notifPayload :
                          Array.isArray(notifPayload?.data) ? notifPayload.data : [];
        const hasAnnNotif = notifList.some(n =>
            n.type === 'announcement' && n.message?.includes('E2E')
        );
        check('Student received announcement notification', hasAnnNotif,
            `Notifications found: ${notifList.length}`);

        // ── 11. Student marks notification as read ───────────────────────
        console.log('\n─── 11. Student Marks Notification Read ───');
        if (notifList.length > 0) {
            const notifId = notifList[0].id;
            const markReadRes = await fetchJSON(`/notifications/${notifId}/read`, {
                ...authOpts(studToken),
                method: 'PUT'
            });
            check('Student can mark notification read', markReadRes.status === 200);
        }

        // ── 12. Student views announcements ──────────────────────────────
        console.log('\n─── 12. Student Views Announcements ───');
        const annsRes = await fetchJSON('/announcements', authOpts(studToken));
        check('Student can view announcements', annsRes.status === 200);
        const annList = annsRes.data || annsRes || [];
        const hasTestAnn = Array.isArray(annList) && annList.some(a => a.title?.includes('E2E'));
        check('E2E announcement visible to student', hasTestAnn,
            `Announcements: ${Array.isArray(annList) ? annList.length : 0}`);

        // ── Summary ──────────────────────────────────────────────────────
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