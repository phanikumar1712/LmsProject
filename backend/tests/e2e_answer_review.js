// E2E: Answer Review Round-Trip — create → student takes (right + wrong) →
// instructor fetches per-question details → verify given answers persisted.
// Run: node tests/e2e_answer_review.js
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
        console.log('  E2E: Answer Review Round-Trip (create → take → detail)');
        console.log('═══════════════════════════════════════════════════════\n');

        // ── 1. Logins ──────────────────────────────────────────────────
        console.log('─── 1. Logins ───');
        const instAuth = await login('ece.instructor@demo.com', 'demo123');
        const instToken = instAuth.token;
        const instructorId = instAuth.user.id;
        check('ECE instructor logged in', !!instToken);

        const studAuth = await login('ece.student1@demo.com', 'demo123');
        const studToken = studAuth.token;
        const studentId = studAuth.user.id;
        check('ECE student logged in', !!studToken);

        const cseInstAuth = await login('cse.instructor@demo.com', 'demo123');
        const cseInstToken = cseInstAuth.token;
        check('CSE instructor logged in (for 403 check)', !!cseInstToken);

        // ── 2. Verify course + enroll student ─────────────────────────
        console.log('\n─── 2. Course & Enrollment ───');
        const course = await fetchJSON('GET', `/courses/${COURSE_ID}`, instToken);
        check('Published course exists', course.status === 200, JSON.stringify(course.data?.error));
        const enroll = await fetchJSON('POST', '/enrollments', studToken, { courseId: COURSE_ID });
        check('Student enrolled in course', [200, 201, 409].includes(enroll.status),
            JSON.stringify(enroll.data?.error || enroll.status));

        // ── 3. Create assessment with a right answer + a wrong one ────
        console.log('\n─── 3. Create Assessment ───');
        const quizTitle = `E2E Answers ${Date.now()}`;
        const quizPayload = {
            courseId: COURSE_ID,
            title: quizTitle,
            description: 'Answer-review round-trip verification',
            timeLimit: 10,
            passingScore: 50,
            maxAttempts: 2,
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
                    difficulty: 'HARD',
                    options: ['LED', 'Zener', 'Resistor', 'Capacitor'],
                    correctAnswer: ['LED', 'Zener']
                },
                {
                    id: 'q_blank',
                    type: 'FILL_BLANK',
                    text: 'Majority carrier in N-type:',
                    category: 'Materials',
                    difficulty: 'MEDIUM',
                    options: [],
                    correctAnswer: 'electrons'
                }
            ]
        };
        const quiz = await fetchJSON('POST', '/quizzes', instToken, quizPayload);
        check('Assessment created', quiz.status === 201, JSON.stringify(quiz.data?.error || quiz.status));
        const quizId = quiz.data?.id;
        check('Assessment ID returned', !!quizId);
        console.log(`    Quiz ID: ${quizId}`);

        // ── 4. Student starts the exam ─────────────────────────────────
        console.log('\n─── 4. Student Starts Exam ───');
        const start = await fetchJSON('POST', `/quizzes/${quizId}/start`, studToken, {});
        check('Student can start exam', [200, 201].includes(start.status),
            JSON.stringify(start.data?.error || start.status));
        const attemptId = start.data?.attemptId;
        check('Attempt ID returned', !!attemptId);

        // ── 5. Student submits — Q1 right, Q2 WRONG, Q3 right ─────────
        console.log('\n─── 5. Student Submits (1 wrong answer) ───');
        const answers = {
            q_semi: 'Semiconductor',      // correct
            q_diode: ['LED', 'Resistor'], // wrong: Resistor is not a diode
            q_blank: 'electrons'          // correct
        };
        const submit = await fetchJSON('POST', `/quizzes/${quizId}/attempt`, studToken, {
            attemptId, answers, violations: 0
        });
        check('Student can submit exam', [200, 201].includes(submit.status),
            JSON.stringify(submit.data?.error || submit.status));
        check('Auto-graded 67%', submit.data?.score === 67, `score=${submit.data?.score}`);
        console.log(`    Score: ${submit.data?.score}%`);

        // ── 6. Instructor fetches per-question detail ─────────────────
        console.log('\n─── 6. Instructor Fetches Per-Question Detail ───');
        const detail = await fetchJSON('GET', `/quizzes/${quizId}/attempts/${studentId}`, instToken);
        check('Endpoint returns 200', detail.status === 200, JSON.stringify(detail.data?.error));
        const attempts = detail.data?.attempts || [];
        check('1 attempt returned', Array.isArray(attempts) && attempts.length === 1,
            `attempts: ${attempts.length}`);
        const attempt = attempts[0];
        check('Attempt score = 67', attempt?.score === 67, `score=${attempt?.score}`);
        check('Attempt questions count = 3', attempt?.questions?.length === 3,
            `questions: ${attempt?.questions?.length}`);

        // Q1 — correct
        const q1 = attempt?.questions?.find(q => q.questionId === 'q_semi');
        check('Q1 text preserved', q1?.text?.includes('Silicon'), q1?.text);
        check('Q1 category preserved', q1?.category === 'Materials', q1?.category);
        check('Q1 difficulty preserved', q1?.difficulty === 'EASY', q1?.difficulty);
        check('Q1 options preserved', Array.isArray(q1?.options) && q1.options.length === 4);
        check('Q1 correctAnswer preserved', q1?.correctAnswer === 'Semiconductor', q1?.correctAnswer);
        check('Q1 givenAnswer round-tripped', q1?.givenAnswer === 'Semiconductor', `got ${JSON.stringify(q1?.givenAnswer)}`);
        check('Q1 marked correct', q1?.correct === true);

        // Q2 — wrong
        const q2 = attempt?.questions?.find(q => q.questionId === 'q_diode');
        check('Q2 difficulty preserved (HARD)', q2?.difficulty === 'HARD', q2?.difficulty);
        check('Q2 correctAnswer array preserved', Array.isArray(q2?.correctAnswer) && q2.correctAnswer.join(',') === 'LED,Zener',
            JSON.stringify(q2?.correctAnswer));
        check('Q2 givenAnswer array round-tripped (LED, Resistor)',
            Array.isArray(q2?.givenAnswer) && q2.givenAnswer.join(',') === 'LED,Resistor',
            `got ${JSON.stringify(q2?.givenAnswer)}`);
        check('Q2 marked incorrect', q2?.correct === false);

        // Q3 — correct (FILL_BLANK)
        const q3 = attempt?.questions?.find(q => q.questionId === 'q_blank');
        check('Q3 givenAnswer round-tripped (electrons)', q3?.givenAnswer === 'electrons', `got ${JSON.stringify(q3?.givenAnswer)}`);
        check('Q3 correctAnswer = electrons', q3?.correctAnswer === 'electrons');
        check('Q3 marked correct', q3?.correct === true);

        check('Student metadata returned', detail.data?.student?.name === 'Karthik Reddy', detail.data?.student?.name);
        check('Quiz metadata returned', detail.data?.quiz?.title === quizTitle);

        // ── 7. Security: another instructor must NOT access ───────────
        console.log('\n─── 7. Security (cross-instructor denied) ───');
        const denied = await fetchJSON('GET', `/quizzes/${quizId}/attempts/${studentId}`, cseInstToken);
        check('CSE instructor gets 403', denied.status === 403, `got ${denied.status}`);

        // ── 8. Legacy tolerance: empty answers array doesn't crash ─────
        console.log('\n─── 8. Robustness ───');
        // Use a valid-format UUID that doesn't exist in the DB — the all-zero
        // UUID would be rejected by requireUuid with a 400 before the lookup.
        const badStudent = await fetchJSON('GET', `/quizzes/${quizId}/attempts/11111111-1111-4111-8111-111111111111`, instToken);
        check('Unknown student → 404', badStudent.status === 404, `got ${badStudent.status}`);

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
