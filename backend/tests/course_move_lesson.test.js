const test = require('node:test');
const assert = require('node:assert/strict');

// coursesController destructures `query` from '../db/pool' at require time, so
// we inject a fake pool into require.cache BEFORE loading the controller — same
// pattern as the other unit tests. moveLesson also needs a transaction client,
// so the fake pool's `pool.connect()` returns a recording fake client.
const POOL_PATH = require.resolve('../src/db/pool');
const CONTROLLER_PATH = require.resolve('../src/controllers/coursesController');

const loadController = (dispatch) => {
    const calls = [];
    const clientQueries = [];
    const fakeClient = {
        query: async (sql, params) => {
            clientQueries.push({ sql, params });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
            return dispatch(sql, params);
        },
        release: () => {},
    };
    // The real pool.js attaches `query.pool = pool` onto the query function
    // itself — mirror that so `query.pool.connect()` works in the controller.
    const fakeQuery = async (sql, params) => {
        calls.push({ sql, params });
        return dispatch(sql, params);
    };
    fakeQuery.pool = { connect: async () => fakeClient };
    const fakePool = { query: fakeQuery, pool: fakeQuery.pool };
    require.cache[POOL_PATH] = {
        id: POOL_PATH,
        filename: POOL_PATH,
        loaded: true,
        exports: fakePool,
    };
    delete require.cache[CONTROLLER_PATH];
    const controller = require(CONTROLLER_PATH);
    return { controller, calls, clientQueries };
};

const ownerReq = () => ({
    user: { id: 'instructor-1', role: 'INSTRUCTOR' },
    params: { id: 'lesson-loops' },
    body: { sectionId: 'sec-b', order: 2 },
});

// Happy path: lesson "Loops" lives in sec-a at position 2 (owned by
// instructor-1); target sec-b has 3 lessons in the same course.
const happyDispatch = (sql) => {
    if (sql.includes('JOIN courses c ON l.course_id = c.id')) {
        return { rows: [{ instructor_id: 'instructor-1', course_id: 'course-1' }] };
    }
    if (sql.includes('FROM lessons l WHERE l.id')) {
        return { rows: [{ section_id: 'sec-a', order: 2, title: 'Loops', course_id: 'course-1' }] };
    }
    if (sql.includes('SELECT s.course_id')) {
        return { rows: [{ course_id: 'course-1', lesson_count: 3 }] };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
    }
    if (sql.includes('UPDATE lessons SET section_id')) {
        return { rows: [{ id: 'lesson-loops', section_id: 'sec-b', order: 2 }] };
    }
    return { rows: [] };
};

test('moveLesson moves a lesson across sections and renumbers both lists in a transaction', async () => {
    const { controller, clientQueries } = loadController(happyDispatch);
    const res = { payload: null, json: (p) => { res.payload = p; } };

    await controller.moveLesson(ownerReq(), res);

    // Final update moved the lesson to sec-b at position 2.
    const finalUpdate = clientQueries.find(c => c.sql.includes('UPDATE lessons SET section_id'));
    assert.ok(finalUpdate, 'expected the final lesson update inside the transaction');
    assert.equal(finalUpdate.params[0], 'sec-b');
    assert.equal(finalUpdate.params[1], 2);
    assert.equal(finalUpdate.params[2], 'lesson-loops');

    // Source section: close the gap after the old position.
    const decrement = clientQueries.find(c => c.sql.includes('"order" = "order" - 1'));
    assert.ok(decrement, 'expected source-section renumbering');
    assert.equal(decrement.params[0], 'sec-a');
    assert.equal(decrement.params[1], 2);

    // Target section: open a slot at the new position.
    const increment = clientQueries.find(c => c.sql.includes('"order" = "order" + 1'));
    assert.ok(increment, 'expected target-section renumbering');
    assert.equal(increment.params[0], 'sec-b');
    assert.equal(increment.params[1], 2);

    // Whole move is wrapped in BEGIN/COMMIT.
    assert.equal(clientQueries[0].sql, 'BEGIN');
    assert.equal(clientQueries[clientQueries.length - 1].sql, 'COMMIT');

    // Response reflects the moved lesson.
    assert.equal(res.payload.id, 'lesson-loops');
    assert.equal(res.payload.section_id, 'sec-b');
});

test('moveLesson rejects a lesson the instructor does not own', async () => {
    const { controller } = loadController((sql) => {
        if (sql.includes('JOIN courses c ON l.course_id = c.id')) {
            return { rows: [{ instructor_id: 'somebody-else', course_id: 'course-1' }] };
        }
        return { rows: [] };
    });

    await assert.rejects(
        () => controller.moveLesson(ownerReq(), {}),
        (err) => {
            assert.equal(err.statusCode, 403);
            return true;
        }
    );
});

test('moveLesson defaults to appending at the end when order is missing', async () => {
    const req = ownerReq();
    req.body = { sectionId: 'sec-b' }; // no order → append
    const { controller, clientQueries } = loadController(happyDispatch);
    const res = { payload: null, json: (p) => { res.payload = p; } };

    await controller.moveLesson(req, res);

    // Target has 3 lessons → append at position 4.
    const finalUpdate = clientQueries.find(c => c.sql.includes('UPDATE lessons SET section_id'));
    assert.equal(finalUpdate.params[1], 4);
});

test('moveLesson rejects a target section in a different course', async () => {
    const { controller } = loadController((sql) => {
        if (sql.includes('JOIN courses c ON l.course_id = c.id')) {
            return { rows: [{ instructor_id: 'instructor-1', course_id: 'course-1' }] };
        }
        if (sql.includes('FROM lessons l WHERE l.id')) {
            return { rows: [{ section_id: 'sec-a', order: 2, title: 'Loops', course_id: 'course-1' }] };
        }
        if (sql.includes('SELECT s.course_id')) {
            return { rows: [{ course_id: 'course-2', lesson_count: 3 }] }; // different course!
        }
        return { rows: [] };
    });

    await assert.rejects(
        () => controller.moveLesson(ownerReq(), {}),
        (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /different course/);
            return true;
        }
    );
});

// Restore the real pool module so other test files in the same process are unaffected.
test.after(() => {
    delete require.cache[POOL_PATH];
});
