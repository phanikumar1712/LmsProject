const test = require('node:test');
const assert = require('node:assert/strict');

// Same fake-pool pattern as the other coursesController unit tests: inject a
// fake pool into require.cache before requiring the controller so no DB
// connection is made. These endpoints only use `query` (no transaction client),
// but `query.pool` is still attached to mirror the real pool module.
const POOL_PATH = require.resolve('../src/db/pool');
const CONTROLLER_PATH = require.resolve('../src/controllers/coursesController');

const loadController = (dispatch) => {
    const calls = [];
    const fakeQuery = async (sql, params) => {
        calls.push({ sql, params });
        return dispatch(sql, params);
    };
    fakeQuery.pool = { connect: async () => { throw new Error('unexpected pool.connect'); } };
    require.cache[POOL_PATH] = {
        id: POOL_PATH,
        filename: POOL_PATH,
        loaded: true,
        exports: { query: fakeQuery, pool: fakeQuery.pool },
    };
    delete require.cache[CONTROLLER_PATH];
    const controller = require(CONTROLLER_PATH);
    return { controller, calls };
};

const instructorReq = (overrides = {}) => ({
    user: { id: 'instructor-1', role: 'INSTRUCTOR' },
    params: {},
    body: {},
    ...overrides,
});

// ── reorderSections ───────────────────────────────────────────────────────────

// Happy path: instructor-1 owns the course; every requested section belongs to it.
const sectionsDispatch = () => (sql, params) => {
    if (sql.includes('SELECT instructor_id FROM courses')) {
        return { rows: [{ instructor_id: 'instructor-1' }] };
    }
    if (sql.includes('FROM sections WHERE course_id')) {
        return { rows: (params[1] || []).map(id => ({ id })) };
    }
    if (sql.includes('UPDATE sections s SET')) {
        return { rowCount: params[0].length, rows: [] };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
    }
    return { rows: [] };
};

test('reorderSections batch-updates every owned section in the submitted order', async () => {
    const { controller, calls } = loadController(sectionsDispatch());
    const req = instructorReq({ params: { id: 'course-1' }, body: { sectionIds: ['s3', 's1', 's2'] } });
    const res = { payload: null, json: (p) => { res.payload = p; } };

    await controller.reorderSections(req, res);

    const update = calls.find(c => c.sql.includes('UPDATE sections s SET'));
    assert.ok(update, 'expected the batched section UPDATE');
    // The unnest order array is the submitted order (deduped).
    assert.deepEqual(update.params[0], ['s3', 's1', 's2']);

    // Ownership was checked first.
    assert.equal(calls.findIndex(c => c.sql.includes('SELECT instructor_id FROM courses')), 0);

    const audit = calls.find(c => c.sql.includes('INSERT INTO audit_logs'));
    assert.ok(audit, 'expected an audit log');
    assert.equal(audit.params[1], 'SECTIONS_REORDERED');

    assert.deepEqual(res.payload, { success: true, reordered: 3 });
});

test('reorderSections rejects ids that belong to another course', async () => {
    const { controller } = loadController((sql, params) => {
        if (sql.includes('SELECT instructor_id FROM courses')) {
            return { rows: [{ instructor_id: 'instructor-1' }] };
        }
        // Only s1 and s2 belong to this course — s3 is foreign.
        if (sql.includes('FROM sections WHERE course_id')) {
            return { rows: (params[1] || []).filter(id => id !== 's3').map(id => ({ id })) };
        }
        return { rows: [] };
    });
    const req = instructorReq({ params: { id: 'course-1' }, body: { sectionIds: ['s3', 's1', 's2'] } });

    await assert.rejects(
        () => controller.reorderSections(req, {}),
        (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /do not belong to this course/);
            return true;
        }
    );
});

test('reorderSections rejects an instructor who does not own the course', async () => {
    const { controller } = loadController((sql) => {
        if (sql.includes('SELECT instructor_id FROM courses')) {
            return { rows: [{ instructor_id: 'somebody-else' }] };
        }
        return { rows: [] };
    });
    const req = instructorReq({ params: { id: 'course-1' }, body: { sectionIds: ['s1'] } });

    await assert.rejects(
        () => controller.reorderSections(req, {}),
        (err) => {
            assert.equal(err.statusCode, 403);
            return true;
        }
    );
});

test('reorderSections rejects an empty or non-array sectionIds payload', async () => {
    const { controller } = loadController(sectionsDispatch());
    for (const body of [{}, { sectionIds: [] }, { sectionIds: 'nope' }]) {
        const req = instructorReq({ params: { id: 'course-1' }, body });
        await assert.rejects(
            () => controller.reorderSections(req, {}),
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /non-empty array/);
                return true;
            }
        );
    }
});

// ── reorderLessons ────────────────────────────────────────────────────────────

// Happy path: instructor-1 owns the course containing the section; every
// requested lesson belongs to that section.
const lessonsDispatch = () => (sql, params) => {
    if (sql.includes('JOIN courses c ON s.course_id = c.id')) {
        return { rows: [{ instructor_id: 'instructor-1', course_id: 'course-1' }] };
    }
    if (sql.includes('FROM lessons WHERE section_id')) {
        return { rows: (params[1] || []).map(id => ({ id })) };
    }
    if (sql.includes('UPDATE lessons l SET')) {
        return { rowCount: params[0].length, rows: [] };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
    }
    return { rows: [] };
};

test('reorderLessons batch-updates every owned lesson in the submitted order', async () => {
    const { controller, calls } = loadController(lessonsDispatch());
    const req = instructorReq({
        params: { id: 'section-1' },
        body: { lessonIds: ['l2', 'l3', 'l1'] },
    });
    const res = { payload: null, json: (p) => { res.payload = p; } };

    await controller.reorderLessons(req, res);

    const update = calls.find(c => c.sql.includes('UPDATE lessons l SET'));
    assert.ok(update, 'expected the batched lesson UPDATE');
    assert.deepEqual(update.params[0], ['l2', 'l3', 'l1']);

    // Section ownership (course membership) was checked first.
    assert.equal(calls.findIndex(c => c.sql.includes('JOIN courses c ON s.course_id = c.id')), 0);

    const audit = calls.find(c => c.sql.includes('INSERT INTO audit_logs'));
    assert.ok(audit, 'expected an audit log');
    assert.equal(audit.params[1], 'LESSONS_REORDERED');

    assert.deepEqual(res.payload, { success: true, reordered: 3 });
});

test('reorderLessons rejects ids that belong to a different section', async () => {
    const { controller } = loadController((sql, params) => {
        if (sql.includes('JOIN courses c ON s.course_id = c.id')) {
            return { rows: [{ instructor_id: 'instructor-1', course_id: 'course-1' }] };
        }
        // Only l1 and l2 belong to this section — l9 is foreign.
        if (sql.includes('FROM lessons WHERE section_id')) {
            return { rows: (params[1] || []).filter(id => id !== 'l9').map(id => ({ id })) };
        }
        return { rows: [] };
    });
    const req = instructorReq({
        params: { id: 'section-1' },
        body: { lessonIds: ['l9', 'l1', 'l2'] },
    });

    await assert.rejects(
        () => controller.reorderLessons(req, {}),
        (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /do not belong to this section/);
            return true;
        }
    );
});

test('reorderLessons rejects an instructor who does not own the section\'s course', async () => {
    const { controller } = loadController((sql) => {
        if (sql.includes('JOIN courses c ON s.course_id = c.id')) {
            return { rows: [{ instructor_id: 'somebody-else', course_id: 'course-1' }] };
        }
        return { rows: [] };
    });
    const req = instructorReq({ params: { id: 'section-1' }, body: { lessonIds: ['l1'] } });

    await assert.rejects(
        () => controller.reorderLessons(req, {}),
        (err) => {
            assert.equal(err.statusCode, 403);
            return true;
        }
    );
});

// Restore the real pool module so other test files in the same process are unaffected.
test.after(() => {
    delete require.cache[POOL_PATH];
});
