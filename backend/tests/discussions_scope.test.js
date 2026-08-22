const test = require('node:test');
const assert = require('node:assert/strict');

// Unit tests for discussion authorization.
//  - Students may only read/post on courses they're enrolled in.
//  - Instructors may only read/post on courses they own.
//  - Admins (incl. department-scoped) may read, post, and moderate discussions
//    of any course — discussions are not department-scoped.
//  - SUPER_ADMIN stays unrestricted.

const POOL_PATH = require.resolve('../src/db/pool');
const CTRL_PATH = require.resolve('../src/controllers/discussionsController');

const QUESTION_ID = 'question-1';
const ANSWER_ID = 'answer-1';
const COURSE_ID = '00000000-0000-4000-8000-00000000000c';
const STUDENT_ID = '00000000-0000-4000-8000-00000000000a';
const INSTRUCTOR_ID = '00000000-0000-4000-8000-00000000000b';

const defaultState = () => ({
    enrolled: true,          // is the acting STUDENT enrolled in the course?
    courseInstructor: INSTRUCTOR_ID,
    courseDept: 'dept-cse',  // department of the course the discussion belongs to
});

const loadController = (state) => {
    const calls = [];
    const fakePool = {
        query: async (sql) => {
            calls.push(sql);
            // assertDiscussionAccess — student enrollment check
            if (sql.includes('SELECT 1 FROM enrollments WHERE student_id')) {
                return { rows: state.enrolled ? [{ 1: 1 }] : [] };
            }
            // assertDiscussionAccess / markBestAnswer — course lookup
            if (sql.includes('SELECT instructor_id FROM courses')) {
                return { rows: [{ instructor_id: state.courseInstructor }] };
            }
            // assertCourseInScope — course department
            if (sql.includes('SELECT department_id FROM courses')) {
                return { rows: [{ department_id: state.courseDept }] };
            }
            // question → course resolution (getAnswers / createAnswer)
            if (sql.includes('SELECT course_id FROM discussion_questions WHERE id = $1')) {
                return { rows: [{ course_id: COURSE_ID }] };
            }
            // markBestAnswer / deleteAnswer — answer → question → course
            if (sql.includes('FROM discussion_answers da')) {
                return { rows: [{ id: ANSWER_ID, question_id: QUESTION_ID, course_id: COURSE_ID, user_id: STUDENT_ID }] };
            }
            // deleteQuestion
            if (sql.includes('SELECT student_id, title, course_id FROM discussion_questions')) {
                return { rows: [{ student_id: STUDENT_ID, title: 'Q', course_id: COURSE_ID }] };
            }
            if (sql.includes('DELETE FROM discussion_questions WHERE id = $1')) {
                return { rows: [{ id: QUESTION_ID }] };
            }
            if (sql.includes('DELETE FROM discussion_answers WHERE id = $1')) {
                return { rows: [{ id: ANSWER_ID, question_id: QUESTION_ID }] };
            }
            // createQuestion / createAnswer inserts
            if (sql.includes('INSERT INTO discussion_questions')) {
                return { rows: [{ id: QUESTION_ID, course_id: COURSE_ID, student_id: STUDENT_ID, title: 'Q' }] };
            }
            if (sql.includes('INSERT INTO discussion_answers')) {
                return { rows: [{ id: ANSWER_ID }] };
            }
            // answer-count updates / best-answer updates / notifications / audit — no rows needed
            return { rows: [] };
        },
        pool: { connect: async () => { throw new Error('unexpected pool.connect'); } },
    };
    require.cache[POOL_PATH] = { id: POOL_PATH, filename: POOL_PATH, loaded: true, exports: fakePool };
    delete require.cache[CTRL_PATH];

    const ctrl = require(CTRL_PATH);
    const makeRes = () => {
        const res = {};
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (body) => { res.body = body; res.statusCode = res.statusCode || 200; return res; };
        return res;
    };
    return { ctrl, calls, makeRes };
};

const makeReq = (role, extra = {}) => ({
    user: {
        id: extra.id ?? (role === 'ADMIN' ? 'admin-1' : role === 'INSTRUCTOR' ? INSTRUCTOR_ID : STUDENT_ID),
        role,
        department_id: extra.department_id ?? null,
    },
    params: extra.params || {},
    body: extra.body || {},
    query: extra.query || {},
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test' },
});

const reject = async (promise) => {
    try {
        await promise;
        assert.fail('expected the call to reject');
    } catch (err) {
        return err;
    }
};

const cseAdmin = () => makeReq('ADMIN', { department_id: 'dept-cse' });
const eceAdmin = () => makeReq('ADMIN', { department_id: 'dept-ece' });

test('getQuestions: cross-department admin is allowed (discussions are not department-scoped)', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.getQuestions(eceAdmin(), res);
    assert.equal(res.statusCode, 200);
});

test('getQuestions: same-department admin is allowed', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.getQuestions(cseAdmin(), res);
    assert.equal(res.statusCode, 200);
});

test('getQuestions: non-enrolled student is blocked (403)', async () => {
    const { ctrl, makeRes } = loadController({ ...defaultState(), enrolled: false });
    const err = await reject(ctrl.getQuestions(makeReq('STUDENT', { params: { courseId: COURSE_ID } }), makeRes()));
    assert.equal(err.statusCode, 403);
});

test('getQuestions: enrolled student is allowed', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.getQuestions(makeReq('STUDENT', { params: { courseId: COURSE_ID } }), res);
    assert.equal(res.statusCode, 200);
});

test('getQuestions: SUPER_ADMIN is unrestricted', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.getQuestions(makeReq('SUPER_ADMIN', { params: { courseId: COURSE_ID } }), res);
    assert.equal(res.statusCode, 200);
});

test('createQuestion: non-enrolled student cannot post (403, no insert)', async () => {
    const { ctrl, calls, makeRes } = loadController({ ...defaultState(), enrolled: false });
    const err = await reject(ctrl.createQuestion(makeReq('STUDENT', { body: { courseId: COURSE_ID, title: 'Q', content: 'A' } }), makeRes()));
    assert.equal(err.statusCode, 403);
    assert.ok(!calls.some(s => s.includes('INSERT INTO discussion_questions')));
});

test('createQuestion: enrolled student can post', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.createQuestion(makeReq('STUDENT', { body: { courseId: COURSE_ID, title: 'Q', content: 'A' } }), res);
    assert.equal(res.statusCode, 201);
});

test('createQuestion: cross-department admin is allowed', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.createQuestion(
        makeReq('ADMIN', { department_id: 'dept-ece', body: { courseId: COURSE_ID, title: 'Q', content: 'A' } }),
        res
    );
    assert.equal(res.statusCode, 201);
});

test('createAnswer: non-enrolled student cannot answer (403)', async () => {
    const { ctrl, makeRes } = loadController({ ...defaultState(), enrolled: false });
    const err = await reject(ctrl.createAnswer(makeReq('STUDENT', { params: { id: QUESTION_ID }, body: { content: 'A' } }), makeRes()));
    assert.equal(err.statusCode, 403);
});

test('createAnswer: enrolled student can answer', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.createAnswer(makeReq('STUDENT', { params: { id: QUESTION_ID }, body: { content: 'A' } }), res);
    assert.equal(res.statusCode, 201);
});

test('getAnswers: non-enrolled student is blocked (403)', async () => {
    const { ctrl, makeRes } = loadController({ ...defaultState(), enrolled: false });
    const err = await reject(ctrl.getAnswers(makeReq('STUDENT', { params: { id: QUESTION_ID } }), makeRes()));
    assert.equal(err.statusCode, 403);
});

test('markBestAnswer: cross-department admin is allowed', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.markBestAnswer(eceAdmin(), res);
    assert.equal(res.statusCode, 200);
});

test('markBestAnswer: same-department admin is allowed', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.markBestAnswer(cseAdmin(), res);
    assert.equal(res.statusCode, 200);
});

test('markBestAnswer: non-owning instructor is blocked (403)', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const err = await reject(ctrl.markBestAnswer(
        makeReq('INSTRUCTOR', { id: 'other-instructor', params: { id: ANSWER_ID } }),
        makeRes()
    ));
    assert.equal(err.statusCode, 403);
});

test('markBestAnswer: owning instructor is allowed', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.markBestAnswer(makeReq('INSTRUCTOR', { params: { id: ANSWER_ID } }), res);
    assert.equal(res.statusCode, 200);
});

test('deleteQuestion: cross-department admin is allowed', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.deleteQuestion(eceAdmin(), res);
    assert.equal(res.statusCode, 200);
});

test('deleteQuestion: same-department admin can delete', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.deleteQuestion(cseAdmin(), res);
    assert.equal(res.statusCode, 200);
});

test('deleteAnswer: cross-department admin is allowed', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.deleteAnswer(eceAdmin(), res);
    assert.equal(res.statusCode, 200);
});

test('deleteAnswer: same-department admin can delete', async () => {
    const { ctrl, makeRes } = loadController(defaultState());
    const res = makeRes();
    await ctrl.deleteAnswer(cseAdmin(), res);
    assert.equal(res.statusCode, 200);
});
