const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapRating } = require('../utils/formatters');
const { writeAudit } = require('../utils/audit');
const { getDepartmentScope } = require('../utils/scope');

const ratingFields = `
    r.id, r.course_id, r.student_id, r.stars, r.comment, r.instructor_reply,
    r.likes, r.helpful, r.created_at,
    u.name as "studentName", u.avatar as "studentAvatar"
`;

// Helper: recalculate & persist course avg rating
const recalcCourseRating = (courseId) =>
    query(`
        UPDATE courses SET
            rating = COALESCE((SELECT ROUND(AVG(stars)::numeric, 1) FROM ratings WHERE course_id = $1), 0),
            review_count = (SELECT COUNT(*) FROM ratings WHERE course_id = $1)
        WHERE id = $1
    `, [courseId]);

// Department-scoped admins may only view/act on users in their own department
// (mirrors usersController.assertUserInScope). Unscoped callers pass through.
const assertUserInDepartmentScope = async (req, userId) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    if (!scoped) return;
    const r = await query('SELECT department_id FROM users WHERE id = $1', [userId]);
    if (!r.rows.length) throw createError('User not found', 404);
    if (r.rows[0].department_id !== departmentId) {
        throw createError('This user is outside your department', 403);
    }
};

// Resolve a rating to its course's department, then 403 a scoped ADMIN whose
// department doesn't match (mirrors assertCourseInScope used for course edits).
// Uses the denormalized courses.department_id column, kept in sync by triggers.
const assertRatingInScope = async (req, ratingId) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    if (!scoped) return;
    const r = await query(
        `SELECT c.department_id FROM ratings r
         JOIN courses c ON r.course_id = c.id
         WHERE r.id = $1`,
        [ratingId]
    );
    if (!r.rows.length) throw createError('Rating not found', 404);
    if (r.rows[0].department_id !== departmentId) {
        throw createError('This review is outside your department', 403);
    }
};

// GET /api/ratings — admin only. Department isolation: a scoped ADMIN only
// moderates reviews for courses in their own department.
const getAll = async (req, res) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    const where = scoped ? 'WHERE c.department_id = $1' : '';
    const values = scoped ? [departmentId] : [];
    const result = await query(`
        SELECT ${ratingFields}, c.id as "courseId", c.title as "courseTitle"
        FROM ratings r
        JOIN users u ON r.student_id = u.id
        JOIN courses c ON r.course_id = c.id
        ${where}
        ORDER BY r.created_at DESC
    `, values);
    res.json(result.rows.map(r => ({ ...mapRating(r), courseTitle: r.courseTitle })));
};

// GET /api/ratings/instructor/:instructorId
const getByInstructor = async (req, res) => {
    const { instructorId } = req.params;
    if (req.user.role === 'INSTRUCTOR' && req.user.id !== instructorId) {
        throw createError('Forbidden', 403);
    }
    if (req.user.role === 'ADMIN') await assertUserInDepartmentScope(req, instructorId);
    const result = await query(`
        SELECT ${ratingFields}, c.title as "courseTitle"
        FROM ratings r
        JOIN users u ON r.student_id = u.id
        JOIN courses c ON r.course_id = c.id
        WHERE c.instructor_id = $1
        ORDER BY r.created_at DESC
    `, [instructorId]);
    res.json(result.rows.map(r => ({ ...mapRating(r), courseTitle: r.courseTitle })));
};

// GET /api/ratings/course/:courseId
const getByCourse = async (req, res) => {
    const result = await query(`
        SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
        WHERE r.course_id = $1 ORDER BY r.created_at DESC
    `, [req.params.courseId]);
    res.json(result.rows.map(mapRating));
};

// GET /api/ratings/my/:courseId  — returns the logged-in student's own rating
const getMyRating = async (req, res) => {
    const result = await query(`
        SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
        WHERE r.course_id = $1 AND r.student_id = $2
    `, [req.params.courseId, req.user.id]);
    res.json(result.rows.length ? mapRating(result.rows[0]) : null);
};

// POST /api/ratings — upsert (create or update) so students can edit their review
const create = async (req, res) => {
    const { courseId, stars, comment = '' } = req.body;
    if (!courseId || !stars) throw createError('courseId and stars are required', 400);
    if (stars < 1 || stars > 5) throw createError('Stars must be between 1 and 5', 400);

    const enrolled = await query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );
    if (!enrolled.rows.length) throw createError('You must be enrolled to rate this course', 403);

    // Upsert: if already rated, update; otherwise insert
    const existing = await query(
        'SELECT id FROM ratings WHERE course_id = $1 AND student_id = $2',
        [courseId, req.user.id]
    );

    let ratingId;
    if (existing.rows.length) {
        // Update existing rating
        await query(
            `UPDATE ratings SET stars = $1, comment = $2 WHERE id = $3`,
            [stars, comment, existing.rows[0].id]
        );
        ratingId = existing.rows[0].id;
    } else {
        const insert = await query(
            `INSERT INTO ratings (course_id, student_id, stars, comment) VALUES ($1,$2,$3,$4) RETURNING id`,
            [courseId, req.user.id, stars, comment]
        );
        ratingId = insert.rows[0].id;
    }

    await recalcCourseRating(courseId);

    const result = await query(`
        SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
        WHERE r.id = $1
    `, [ratingId]);

    const statusCode = existing.rows.length ? 200 : 201;
    res.status(statusCode).json(mapRating(result.rows[0]));
};

// PUT /api/ratings/:id/reply — instructor reply
const replyToReview = async (req, res) => {
    const { reply } = req.body;
    if (!reply) throw createError('Reply text is required', 400);

    // Verify the instructor owns the course being reviewed
    const rating = await query(
        `SELECT c.instructor_id, r.course_id, r.student_id FROM ratings r
         JOIN courses c ON r.course_id = c.id
         WHERE r.id = $1`,
        [req.params.id]
    );
    if (!rating.rows.length) throw createError('Rating not found', 404);
    if (req.user.role === 'INSTRUCTOR' && rating.rows[0].instructor_id !== req.user.id) {
        throw createError('Not authorized to reply to this review', 403);
    }
    if (req.user.role === 'ADMIN') await assertRatingInScope(req, req.params.id);

    const result = await query(
        `UPDATE ratings SET instructor_reply = $1 WHERE id = $2 RETURNING id`,
        [reply, req.params.id]
    );
    if (!result.rows.length) throw createError('Rating not found', 404);

    await writeAudit(req, {
        action: 'REVIEW_REPLIED',
        resource: 'ratings',
        resourceId: req.params.id,
        newValue: { instructorReply: reply },
        details: { courseId: rating.rows[0].course_id, studentId: rating.rows[0].student_id },
    });

    const full = await query(`
        SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
        WHERE r.id = $1
    `, [req.params.id]);
    res.json(mapRating(full.rows[0]));
};

// PUT /api/ratings/:id/like
const likeReview = async (req, res) => {
    const ratingId = req.params.id;
    const userId = req.user.id;

    // Check if rating exists
    const ratingCheck = await query('SELECT id FROM ratings WHERE id = $1', [ratingId]);
    if (!ratingCheck.rows.length) throw createError('Rating not found', 404);

    // Check if user already liked this review
    const existing = await query(
        'SELECT 1 FROM rating_likes WHERE rating_id = $1 AND user_id = $2',
        [ratingId, userId]
    );
    if (existing.rows.length) throw createError('You have already liked this review', 409);

    // Use transaction to ensure atomicity
    const client = await query.pool.connect();
    try {
        await client.query('BEGIN');

        // Record the like
        await client.query(
            'INSERT INTO rating_likes (rating_id, user_id) VALUES ($1, $2)',
            [ratingId, userId]
        );

        // Increment the counter
        await client.query(
            'UPDATE ratings SET likes = likes + 1 WHERE id = $1',
            [ratingId]
        );

        await client.query('COMMIT');

        const full = await query(`
            SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
            WHERE r.id = $1
        `, [ratingId]);
        res.json(mapRating(full.rows[0]));
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// DELETE /api/ratings/:id
const deleteRating = async (req, res) => {
    await assertRatingInScope(req, req.params.id);
    const result = await query(
        `DELETE FROM ratings WHERE id = $1 RETURNING course_id, stars`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Rating not found', 404);
    await recalcCourseRating(result.rows[0].course_id);

    await writeAudit(req, {
        action: 'RATING_DELETED',
        resource: 'ratings',
        resourceId: req.params.id,
        oldValue: { stars: result.rows[0].stars },
        newValue: null,
        details: { courseId: result.rows[0].course_id, stars: result.rows[0].stars },
    });

    res.json({ success: true });
};

// GET /api/ratings/student/:studentId
const getByStudent = async (req, res) => {
    const { studentId } = req.params;
    if (req.user.role === 'STUDENT' && req.user.id !== studentId) {
        throw createError('Forbidden', 403);
    }
    if (req.user.role === 'ADMIN') await assertUserInDepartmentScope(req, studentId);
    const result = await query(`
        SELECT ${ratingFields}, c.title as "courseTitle"
        FROM ratings r
        JOIN users u ON r.student_id = u.id
        JOIN courses c ON r.course_id = c.id
        WHERE r.student_id = $1
        ORDER BY r.created_at DESC
    `, [studentId]);
    res.json(result.rows.map(r => ({ ...mapRating(r), courseTitle: r.courseTitle })));
};

module.exports = { getAll, getByInstructor, getByCourse, getMyRating, getByStudent, create, replyToReview, likeReview, deleteRating };
