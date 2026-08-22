const test = require('node:test');
const assert = require('node:assert/strict');

// Unit tests for department isolation on quiz endpoints.
//
// The controller (and utils/courseAuth, which destructures `query` at require
// time) gets a fake pool injected into require.cache, so no DB is needed.
// Proves that a department-scoped admin cannot reach quizzes/attempts/students
// of another department, while same-department admins, SUPER_ADMINs, and
// owning instructors still can.

const POOL_PATH = require.resolve('../src/db/pool');
const CONTROLLER_PATH = require.resolve('../src/controllers/quizzesController');
const COURSE_AUTH_PATH = require.resolve('../src/utils/courseAuth');

const QUIZ_ID = '00000000-0000-4000-8000-000000000001';
const COURSE_ID = '00000000-0000-4000-8000-00000000000c';
const STUDENT_ID = '00000000-0000-4000-8000-00000000000a';
const INSTRUCTOR_ID = '00000000-0000-4000-8000-00000000000b';

// A quiz whose single question carries a correctAnswer — used to prove answer
// keys reach legitimate editors but never a cross-department admin.
const QUIZ_QUESTIONS = [
    { id: 'q-1', text: 'What is 2+2?', type: 'MCQ_SINGLE', options: ['3', '4', '5'], correctAnswer: '4' },
];

const defaultState = () => ({
    courseInstructor: INSTRUCTOR_ID,
    courseDept: 'dept-cse',      // department of the course (via its category)
    targetUserDept: 'dept-cse',  // department of the student/instructor being viewed
    courseStatus: 'PUBLISHED',
    enrolled: true,
    questions: QUIZ_QUESTIONS,
});

// Build a fake pool + fresh controller. `state` controls what the fake queries
// return; record every call for optional assertions.
const loadController = (state) => {
    const calls = [];
    const fakePool = {
        query: async (sql) => {
            calls.push(sql);
            // loadQuiz: quiz joined to its course (multi-line SQL → match a stable fragment)
            if (sql.includes('c.status AS course_status') && sql.includes('FROM quizzes q')) {
                return { rows: [{
                    id: QUIZ_ID, course_id: COURSE_ID, instructor_id: state.courseInstructor,
                    course_status: state.courseStatus, title: 'Unit Quiz', description: '',
                    passing_score: 70, time_limit: 30, max_attempts: 0, negative_marking: 0,
                    start_date: null, end_date: null, selection_config: null, questions: state.questions,
                    created_at: new Date().toISOString(),
                }] };
            }
            // loadCourse
            if (sql.includes('SELECT id, instructor_id, status FROM courses')) {
                return { rows: [{ id: COURSE_ID, instructor_id: state.courseInstructor, status: state.courseStatus }] };
            }
            // assertCourseEditable
            if (sql.includes('SELECT instructor_id FROM courses')) {
                return { rows: [{ instructor_id: state.courseInstructor }] };
            }
            // assertCourseInScope (via utils/courseAuth)
            if (sql.includes('SELECT department_id FROM courses WHERE id = $1')) {
                return { rows: [{ department_id: state.courseDept }] };
            }
            // assertUserInDepartmentScope
            if (sql.includes('SELECT department_id FROM users')) {
                return { rows: [{ department_id: state.targetUserDept }] };
            }
            // enrollment check (student access path)
            if (sql.includes('SELECT 1 FROM enrollments')) {
                return { rows: state.enrolled ? [{ '?column?': 1 }] : [] };
            }
            // getById: the quiz row list for the course
            if (sql.includes('SELECT * FROM quizzes WHERE course_id')) {
                return { rows: [{
                    id: QUIZ_ID, course_id: COURSE_ID, title: 'Unit Quiz', description: '',
                    passing_score: 70, time_limit: 30, max_attempts: 0, negative_marking: 0,
                    start_date: null, end_date: null, selection_config: null, questions: state.questions,
                    created_at: new Date().toISOString(),
                }] };
            }
            // getQuizPerformance summary
            if (sql.includes('COUNT(DISTINCT student_id)')) {
                return { rows: [{ participants: 0, total_attempts: 0, avg_score: 0, highest_score: 0, passed_count: 0 }] };
            }
            // ranking / per-question results / attempts lists — empty data is fine
            if (sql.includes('quiz_attempts')) return { rows: [] };
            return { rows: [] };
        },
        pool: { connect: async () => { throw new Error('unexpected pool.connect'); } },
    };
    require.cache[POOL_PATH] = { id: POOL_PATH, filename: POOL_PATH, loaded: true, exports: fakePool };
    delete require.cache[CONTROLLER_PATH];
    delete require.cache[COURSE_AUTH_PATH];
    const controller = require(CONTROLLER_PATH);
    return { controller, calls };
};

const call = async (controller, fn, user, params = {}, query = {}, body = {}) => {
    const req = { user, params, query, body };
    const res = { json: (payload) => { res.payload = payload; } };
    await controller[fn](req, res);
    return res.payload;
};

// A rejection that must carry a specific HTTP status.
const rejectsWith = (promise, status) =>
    assert.rejects(promise, (err) => err.statusCode === status, `expected HTTP ${status}`);

// ── Answer-key isolation: CSE admin vs ECE quiz ──────────────────────────────
test('getById: CSE admin cannot access ECE quiz questions or answer keys', async () => {
    const { controller } = loadController({ ...defaultState(), courseDept: 'dept-ece' });
    const req = { user: { id: 'cse-admin', role: 'ADMIN', department_id: 'dept-cse' }, params: { id: QUIZ_ID }, query: {}, body: {} };
    const res = { json: (payload) => { res.payload = payload; } };
    await assert.rejects(
        controller.getById(req, res),
        (err) => err.statusCode === 403,
        'expected HTTP 403'
    );
    assert.equal(res.payload, undefined, 'no quiz data may be serialized for a cross-department admin');
});

test('getById: same-department admin receives questions WITH answer keys', async () => {
    const { controller } = loadController(defaultState());
    const payload = await call(controller, 'getById', { id: 'cse-admin', role: 'ADMIN', department_id: 'dept-cse' }, { id: QUIZ_ID });
    assert.equal(payload.id, QUIZ_ID);
    assert.equal(payload.questions.length, 1);
    assert.equal(payload.questions[0].correctAnswer, '4', 'same-dept admin legitimately sees answer keys');
});

test('getById: SUPER_ADMIN receives questions WITH answer keys', async () => {
    const { controller } = loadController({ ...defaultState(), courseDept: 'dept-ece' });
    const payload = await call(controller, 'getById', { id: 'sa-1', role: 'SUPER_ADMIN' }, { id: QUIZ_ID });
    assert.equal(payload.questions[0].correctAnswer, '4');
});

test('getByCourse: CSE admin cannot list ECE quiz questions or answer keys', async () => {
    const { controller } = loadController({ ...defaultState(), courseDept: 'dept-ece' });
    const req = { user: { id: 'cse-admin', role: 'ADMIN', department_id: 'dept-cse' }, params: { courseId: COURSE_ID }, query: {}, body: {} };
    const res = { json: (payload) => { res.payload = payload; } };
    await assert.rejects(
        controller.getByCourse(req, res),
        (err) => err.statusCode === 403,
        'expected HTTP 403'
    );
    assert.equal(res.payload, undefined, 'no quiz data may be serialized for a cross-department admin');
});

test('getByCourse: same-department admin lists questions WITH answer keys', async () => {
    const { controller } = loadController(defaultState());
    const payload = await call(controller, 'getByCourse', { id: 'cse-admin', role: 'ADMIN', department_id: 'dept-cse' }, { courseId: COURSE_ID });
    assert.equal(payload.length, 1);
    assert.equal(payload[0].questions[0].correctAnswer, '4');
});

test('getById: owning instructor is allowed, non-owning instructor blocked', async () => {
    const { controller } = loadController(defaultState());
    const ok = await call(controller, 'getById', { id: INSTRUCTOR_ID, role: 'INSTRUCTOR' }, { id: QUIZ_ID });
    assert.equal(ok.id, QUIZ_ID);

    const { controller: other } = loadController(defaultState());
    await rejectsWith(
        call(other, 'getById', { id: 'instr-other', role: 'INSTRUCTOR' }, { id: QUIZ_ID }),
        403
    );
});

// ── Analytics / management endpoints ─────────────────────────────────────────
test('getQuizPerformance: cross-department admin blocked, SUPER_ADMIN allowed', async () => {
    const { controller } = loadController({ ...defaultState(), courseDept: 'dept-ece' });
    await rejectsWith(
        call(controller, 'getQuizPerformance', { id: 'admin-1', role: 'ADMIN', department_id: 'dept-cse' }, { id: QUIZ_ID }),
        403
    );
    const { controller: sa } = loadController({ ...defaultState(), courseDept: 'dept-ece' });
    const payload = await call(sa, 'getQuizPerformance', { id: 'sa-1', role: 'SUPER_ADMIN' }, { id: QUIZ_ID });
    assert.equal(payload.quiz.id, QUIZ_ID);
});

test('remindStudents: cross-department admin blocked', async () => {
    const { controller } = loadController({ ...defaultState(), courseDept: 'dept-ece' });
    await rejectsWith(
        call(controller, 'remindStudents', { id: 'admin-1', role: 'ADMIN', department_id: 'dept-cse' }, { id: QUIZ_ID }, {}, { message: 'hi' }),
        403
    );
});

// ── Per-user views ───────────────────────────────────────────────────────────
test('getAttempts: cross-department admin cannot view another dept student', async () => {
    const { controller } = loadController({ ...defaultState(), targetUserDept: 'dept-ece' });
    await rejectsWith(
        call(controller, 'getAttempts', { id: 'admin-1', role: 'ADMIN', department_id: 'dept-cse' }, { studentId: STUDENT_ID }),
        403
    );
    const { controller: ok } = loadController(defaultState());
    const payload = await call(ok, 'getAttempts', { id: 'admin-1', role: 'ADMIN', department_id: 'dept-cse' }, { studentId: STUDENT_ID });
    assert.deepEqual(payload, []);
});

test('getInstructorQuizzes: cross-department admin cannot view another dept instructor', async () => {
    const { controller } = loadController({ ...defaultState(), targetUserDept: 'dept-ece' });
    await rejectsWith(
        call(controller, 'getInstructorQuizzes', { id: 'admin-1', role: 'ADMIN', department_id: 'dept-cse' }, { instructorId: INSTRUCTOR_ID }),
        403
    );
});

test('getAvailableExams: cross-department admin cannot list exams for another dept student', async () => {
    const { controller } = loadController({ ...defaultState(), targetUserDept: 'dept-ece' });
    await rejectsWith(
        call(controller, 'getAvailableExams', { id: 'admin-1', role: 'ADMIN', department_id: 'dept-cse' }, {}, { studentId: STUDENT_ID }),
        403
    );
    const { controller: ok } = loadController(defaultState());
    const payload = await call(ok, 'getAvailableExams', { id: 'admin-1', role: 'ADMIN', department_id: 'dept-cse' }, {}, { studentId: STUDENT_ID });
    assert.deepEqual(payload, []);
});
