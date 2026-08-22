const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');

// Private study aids (notes + bookmarks) that a student attaches to lessons of
// an enrolled course. Everything is scoped to the authenticated user — students
// can only ever read/write their own rows.

// Verify the user is enrolled in the course before creating study aids, so notes
// and bookmarks can't be attached to courses the student doesn't have access to.
const assertEnrolled = async (req, courseId, lessonId) => {
    const enrolled = await query(
        'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2 LIMIT 1',
        [req.user.id, courseId]
    );
    if (!enrolled.rows.length) throw createError('Not enrolled in this course', 403);

    if (lessonId) {
        const lesson = await query(
            'SELECT 1 FROM lessons WHERE id = $1 AND course_id = $2 LIMIT 1',
            [lessonId, courseId]
        );
        if (!lesson.rows.length) throw createError('Lesson does not belong to this course', 400);
    }
};

// ── NOTES ─────────────────────────────────────────────────────────────────────

// GET /api/notes?courseId=xxx&lessonId=xxx — my notes (optionally filtered)
const getNotes = async (req, res) => {
    const { courseId, lessonId } = req.query;
    let sql = `
        SELECT n.*, l.title AS lesson_title
        FROM course_notes n
        LEFT JOIN lessons l ON l.id = n.lesson_id
        WHERE n.user_id = $1
    `;
    const values = [req.user.id];
    let i = 2;
    if (courseId) { sql += ` AND n.course_id = $${i++}`; values.push(courseId); }
    if (lessonId) { sql += ` AND n.lesson_id = $${i++}`; values.push(lessonId); }
    sql += ' ORDER BY n.updated_at DESC';
    const result = await query(sql, values);
    res.json(result.rows.map(n => ({
        ...n,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
        lessonTitle: n.lesson_title,
    })));
};

// POST /api/notes — create a note on a lesson of an enrolled course
const createNote = async (req, res) => {
    const { courseId, lessonId, content } = req.body;
    if (!courseId) throw createError('courseId is required', 400);
    if (!lessonId) throw createError('lessonId is required', 400);
    const text = String(content || '').trim();
    if (!text) throw createError('Note content cannot be empty', 400);

    await assertEnrolled(req, courseId, lessonId);

    const result = await query(
        `INSERT INTO course_notes (user_id, course_id, lesson_id, content)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.user.id, courseId, lessonId, text]
    );
    res.status(201).json(result.rows[0]);
};

// PUT /api/notes/:id — update own note
const updateNote = async (req, res) => {
    const text = String(req.body.content || '').trim();
    if (!text) throw createError('Note content cannot be empty', 400);
    const result = await query(
        `UPDATE course_notes SET content = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3 RETURNING *`,
        [text, req.params.id, req.user.id]
    );
    if (!result.rows.length) throw createError('Note not found', 404);
    res.json(result.rows[0]);
};

// DELETE /api/notes/:id — delete own note
const deleteNote = async (req, res) => {
    const result = await query(
        'DELETE FROM course_notes WHERE id = $1 AND user_id = $2 RETURNING id',
        [req.params.id, req.user.id]
    );
    if (!result.rows.length) throw createError('Note not found', 404);
    res.json({ success: true });
};

// ── BOOKMARKS ─────────────────────────────────────────────────────────────────

// GET /api/bookmarks?courseId=xxx — my bookmarked lessons (with lesson titles)
const getBookmarks = async (req, res) => {
    const { courseId } = req.query;
    let sql = `
        SELECT b.id, b.course_id, b.lesson_id, b.created_at,
               l.title AS lesson_title, l.type AS lesson_type
        FROM lesson_bookmarks b
        JOIN lessons l ON l.id = b.lesson_id
        WHERE b.user_id = $1
    `;
    const values = [req.user.id];
    if (courseId) { sql += ` AND b.course_id = $2`; values.push(courseId); }
    sql += ' ORDER BY b.created_at DESC';
    const result = await query(sql, values);
    res.json(result.rows.map(b => ({
        id: b.id,
        courseId: b.course_id,
        lessonId: b.lesson_id,
        createdAt: b.created_at,
        lessonTitle: b.lesson_title,
        lessonType: b.lesson_type,
    })));
};

// POST /api/bookmarks/toggle — bookmark / unbookmark a lesson. Returns the new
// state so the client can update its UI in one round-trip.
const toggleBookmark = async (req, res) => {
    const { courseId, lessonId } = req.body;
    if (!courseId || !lessonId) throw createError('courseId and lessonId are required', 400);

    await assertEnrolled(req, courseId, lessonId);

    const existing = await query(
        'SELECT id FROM lesson_bookmarks WHERE user_id = $1 AND lesson_id = $2',
        [req.user.id, lessonId]
    );
    if (existing.rows.length) {
        await query('DELETE FROM lesson_bookmarks WHERE id = $1', [existing.rows[0].id]);
        return res.json({ bookmarked: false });
    }
    await query(
        `INSERT INTO lesson_bookmarks (user_id, course_id, lesson_id) VALUES ($1, $2, $3)`,
        [req.user.id, courseId, lessonId]
    );
    res.status(201).json({ bookmarked: true });
};

module.exports = {
    getNotes, createNote, updateNote, deleteNote,
    getBookmarks, toggleBookmark,
};
