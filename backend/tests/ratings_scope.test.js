const test = require('node:test');
const assert = require('node:assert/strict');

// Unit tests for department isolation on review-moderation endpoints.
// A department-scoped admin may only list / reply / delete reviews of courses
// in their own department, and may only view ratings of their own dept's
// students & instructors. SUPER_ADMIN stays unrestricted.

const POOL_PATH = require.resolve('../src/db/pool');
const CONTROLLER_PATH = require.resolve('../src/controllers/ratingsController');

const RATING_ID = 'rating-1';
const COURSE_ID = '00000000-0000-4000-8000-00000000000c';
const STUDENT_ID = '00000000-0000-4000-8000-00000000000a';
const INSTRUCTOR_ID = '00000000-0000-4000-8000-00000000000b';

const defaultState = () => ({
    courseInstructor: INSTRUCTOR_ID,
    courseDept: 'dept-cse',     // department of the reviewed course
    targetUserDept: 'dept-cse', // department of the student/instructor being viewed
});

const loadController = (state) => {
    const calls = [];
    const fakePool = {
        query: async (sql) => {
            calls.push(sql);
            // assertUserInDepartmentScope
            if (sql.includes('SELECT department_id FROM users')) {
                return { rows: [{ department_id: state.targetUserDept }] };
            }
            // assertRatingInScope (rating → course department)
            if (sql.includes('SELECT c.department_id FROM ratings r')) {
                return { rows: [{ department_id: state.courseDept }] };
            }
            // replyToReview: rating + course lookup
            if (sql.includes('SELECT c.instructor_id, r.course_id, r.student_id FROM ratings r')) {
                return { rows: [{ instructor_id: state.courseInstructor, course_id: COURSE_ID, student_id: STUDENT_ID }] };
            }
            // replyToReview: UPDATE + re-fetch of the rating row
            if (sql.includes('UPDATE ratings SET instructor_reply')) {
                return { rows: [{ id: RATING_ID }] };
            }
            if (sql.includes('WHERE r.id = $1')) {
                return { rows: [{
                    id: RATING_ID, course_id: COURSE_ID, student_id: STUDENT_ID, stars: 5,
                    comment: 'Great', instructor_reply: 'Thanks', likes: 0, helpful: true,
                    created_at: new Date().toISOString(), studentName: 'Ada', studentAvatar: '',
                }] };
            }
            // deleteRating
            if (sql.includes('DELETE FROM ratings WHERE id = $1')) {
                return { rows: [{ course_id: COURSE_ID, stars: 5 }] };
            }
            // list queries (getAll / getByInstructor / getByStudent) — empty is fine
            return { rows: [] };
        },
        pool: { connect: async () => { throw new Error('unexpected pool.connect'); } },
    };
    require.cache[POOL_PATH] = { id: POOL_PATH, filename: POOL_PATH, loaded: true, exports: fakePool };
    delete require.cache[CONTROLLER_PATH];
    const controller = require(CONTROLLER_PATH);
    return { controller, calls };
};

const call = async (controller, fn, user, params = {}, query = {}, body = {}) => {
    const req = { user, params, query, body };
    const res = { json: (payload) => { res.payload = payload; } };
    await controller[fn](req, res);
    return res.payload;
};

const rejectsWith = (promise, status) =>
    assert.rejects(promise, (err) => err.statusCode === status, `expected HTTP ${status}`);

const cseAdmin = { id: 'admin-1', role: 'ADMIN', department_id: 'dept-cse' };
const superAdmin = { id: 'sa-1', role: 'SUPER_ADMIN' };

// ── List (moderate reviews page) ─────────────────────────────────────────────
test('getAll: scoped admin list is filtered to their department', async () => {
    const { controller, calls } = loadController(defaultState());
    await call(controller, 'getAll', cseAdmin);
    const listSql = calls.find(sql => sql.includes('FROM ratings r'));
    assert.ok(listSql.includes('c.department_id = $1'), 'scoped list must filter by course department');
});

test('getAll: SUPER_ADMIN list is NOT department-filtered', async () => {
    const { controller, calls } = loadController(defaultState());
    await call(controller, 'getAll', superAdmin);
    const listSql = calls.find(sql => sql.includes('FROM ratings r'));
    assert.ok(!listSql.includes('c.department_id = $1'));
});

// ── Delete / reply ───────────────────────────────────────────────────────────
test('deleteRating: cross-department admin is blocked (403)', async () => {
    const { controller } = loadController({ ...defaultState(), courseDept: 'dept-ece' });
    await rejectsWith(call(controller, 'deleteRating', cseAdmin, { id: RATING_ID }), 403);
});

test('deleteRating: same-department admin can delete', async () => {
    const { controller } = loadController(defaultState());
    const payload = await call(controller, 'deleteRating', cseAdmin, { id: RATING_ID });
    assert.equal(payload.success, true);
});

test('replyToReview: cross-department admin is blocked (403)', async () => {
    const { controller } = loadController({ ...defaultState(), courseDept: 'dept-ece' });
    await rejectsWith(call(controller, 'replyToReview', cseAdmin, { id: RATING_ID }, {}, { reply: 'Thanks!' }), 403);
});

test('replyToReview: same-department admin can reply', async () => {
    const { controller } = loadController(defaultState());
    const payload = await call(controller, 'replyToReview', cseAdmin, { id: RATING_ID }, {}, { reply: 'Thanks!' });
    assert.equal(payload.id, RATING_ID);
});

test('replyToReview: non-owning instructor is still blocked (403)', async () => {
    const { controller } = loadController(defaultState());
    await rejectsWith(
        call(controller, 'replyToReview', { id: 'instr-other', role: 'INSTRUCTOR' }, { id: RATING_ID }, {}, { reply: 'Thanks!' }),
        403
    );
});

// ── Per-user views ───────────────────────────────────────────────────────────
test('getByInstructor: cross-department admin cannot view another dept instructor', async () => {
    const { controller } = loadController({ ...defaultState(), targetUserDept: 'dept-ece' });
    await rejectsWith(call(controller, 'getByInstructor', cseAdmin, { instructorId: INSTRUCTOR_ID }), 403);
});

test('getByStudent: cross-department admin cannot view another dept student', async () => {
    const { controller } = loadController({ ...defaultState(), targetUserDept: 'dept-ece' });
    await rejectsWith(call(controller, 'getByStudent', cseAdmin, { studentId: STUDENT_ID }), 403);
});
