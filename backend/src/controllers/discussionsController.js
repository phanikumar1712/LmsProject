const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');

// GET /api/discussions/course/:courseId — get questions for a course (optionally filtered by lesson)
const getQuestions = async (req, res) => {
    const { courseId } = req.params;
    const { lessonId } = req.query;
    let where = 'WHERE dq.course_id = $1';
    const values = [courseId];
    if (lessonId) {
        where += ' AND dq.lesson_id = $2';
        values.push(lessonId);
    }
    const result = await query(`
        SELECT dq.*, u.name as student_name, u.avatar as student_avatar
        FROM discussion_questions dq
        JOIN users u ON dq.student_id = u.id
        ${where}
        ORDER BY dq.updated_at DESC
    `, values);
    res.json(result.rows.map(q => ({
        ...q,
        studentName: q.student_name,
        studentAvatar: q.student_avatar,
        createdAt: q.created_at,
    })));
};

// POST /api/discussions/questions — ask a question
const createQuestion = async (req, res) => {
    const { courseId, lessonId, title, content } = req.body;
    if (!courseId || !title || !content) throw createError('courseId, title, and content are required', 400);
    const result = await query(
        `INSERT INTO discussion_questions (course_id, lesson_id, student_id, title, content)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [courseId, lessonId || null, req.user.id, title, content]
    );
    res.status(201).json(result.rows[0]);
};

// DELETE /api/discussions/questions/:id
const deleteQuestion = async (req, res) => {
    const q = await query('SELECT student_id, title FROM discussion_questions WHERE id = $1', [req.params.id]);
    if (!q.rows.length) throw createError('Question not found', 404);
    if (q.rows[0].student_id !== req.user.id && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        throw createError('Not authorized', 403);
    }
    await query('DELETE FROM discussion_questions WHERE id = $1', [req.params.id]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'DISCUSSION_QUESTION_DELETED', 'discussion_questions', req.params.id,
         JSON.stringify({ title: q.rows[0].title })]
    ).catch(() => {});

    res.json({ success: true });
};

// GET /api/discussions/questions/:id/answers — get answers for a question
const getAnswers = async (req, res) => {
    const result = await query(`
        SELECT da.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
               (SELECT COUNT(*) FROM answer_upvotes au WHERE au.answer_id = da.id) as upvote_count
        FROM discussion_answers da
        JOIN users u ON da.user_id = u.id
        WHERE da.question_id = $1
        ORDER BY da.is_best_answer DESC, upvote_count DESC, da.created_at ASC
    `, [req.params.id]);
    res.json(result.rows.map(a => ({
        ...a,
        userName: a.user_name,
        userAvatar: a.user_avatar,
        userRole: a.user_role,
        upvoteCount: parseInt(a.upvote_count) || 0,
        createdAt: a.created_at,
    })));
};

// POST /api/discussions/questions/:id/answers — post an answer
const createAnswer = async (req, res) => {
    const { content } = req.body;
    if (!content) throw createError('Content is required', 400);
    const result = await query(
        `INSERT INTO discussion_answers (question_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
        [req.params.id, req.user.id, content]
    );
    // Update answer count on question
    await query(
        `UPDATE discussion_questions SET answer_count = answer_count + 1, updated_at = NOW() WHERE id = $1`,
        [req.params.id]
    );
    // Notify question author
    const q = await query('SELECT student_id, title, course_id FROM discussion_questions WHERE id = $1', [req.params.id]);
    if (q.rows.length && q.rows[0].student_id !== req.user.id) {
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [q.rows[0].student_id, `New answer on "${q.rows[0].title}"`, 'discussion', `/courses/${q.rows[0].course_id}/discuss`]
        ).catch(() => {});
    }
    res.status(201).json(result.rows[0]);
};

// DELETE /api/discussions/answers/:id
const deleteAnswer = async (req, res) => {
    const a = await query('SELECT user_id, question_id FROM discussion_answers WHERE id = $1', [req.params.id]);
    if (!a.rows.length) throw createError('Answer not found', 404);
    if (a.rows[0].user_id !== req.user.id && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        throw createError('Not authorized', 403);
    }
    await query('DELETE FROM discussion_answers WHERE id = $1', [req.params.id]);
    await query(
        `UPDATE discussion_questions SET answer_count = GREATEST(answer_count - 1, 0) WHERE id = $1`,
        [a.rows[0].question_id]
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'DISCUSSION_ANSWER_DELETED', 'discussion_answers', req.params.id]
    ).catch(() => {});

    res.json({ success: true });
};

// POST /api/discussions/answers/:id/upvote — toggle upvote
const toggleUpvote = async (req, res) => {
    const existing = await query(
        'SELECT 1 FROM answer_upvotes WHERE user_id = $1 AND answer_id = $2',
        [req.user.id, req.params.id]
    );
    if (existing.rows.length) {
        await query('DELETE FROM answer_upvotes WHERE user_id = $1 AND answer_id = $2',
            [req.user.id, req.params.id]);
        await query('UPDATE discussion_answers SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = $1',
            [req.params.id]);
        res.json({ upvoted: false });
    } else {
        await query('INSERT INTO answer_upvotes (user_id, answer_id) VALUES ($1, $2)',
            [req.user.id, req.params.id]);
        await query('UPDATE discussion_answers SET upvotes = upvotes + 1 WHERE id = $1',
            [req.params.id]);
        res.json({ upvoted: true });
    }
};

// PUT /api/discussions/answers/:id/best-answer — mark as best answer (instructor/admin only)
const markBestAnswer = async (req, res) => {
    const answer = await query(`
        SELECT da.id, da.question_id, dq.course_id FROM discussion_answers da
        JOIN discussion_questions dq ON da.question_id = dq.id
        WHERE da.id = $1
    `, [req.params.id]);
    if (!answer.rows.length) throw createError('Answer not found', 404);

    // Check authorization: course instructor, admin, or super admin
    const course = await query(
        'SELECT instructor_id FROM courses WHERE id = $1',
        [answer.rows[0].course_id]
    );
    const isInstructor = course.rows.length && course.rows[0].instructor_id === req.user.id;
    if (!isInstructor && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
        throw createError('Only the course instructor can mark best answer', 403);
    }

    // Clear previous best answer for this question
    await query(
        'UPDATE discussion_answers SET is_best_answer = false WHERE question_id = $1',
        [answer.rows[0].question_id]
    );
    // Set new best answer
    await query(
        'UPDATE discussion_answers SET is_best_answer = true WHERE id = $1',
        [req.params.id]
    );
    res.json({ success: true, isBestAnswer: true });
};

module.exports = { getQuestions, createQuestion, deleteQuestion, getAnswers, createAnswer, deleteAnswer, toggleUpvote, markBestAnswer };
