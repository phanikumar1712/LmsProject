const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapRating } = require('../utils/formatters');

const ratingFields = `
    r.id, r.course_id, r.student_id, r.stars, r.comment, r.instructor_reply,
    r.likes, r.helpful, r.created_at,
    u.name as "studentName", u.avatar as "studentAvatar"
`;

// GET /api/ratings
const getAll = async (req, res) => {
    const result = await query(`
        SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
        ORDER BY r.created_at DESC
    `);
    res.json(result.rows.map(mapRating));
};

// GET /api/ratings/instructor/:instructorId
const getByInstructor = async (req, res) => {
    const { instructorId } = req.params;
    if (req.user.role === 'INSTRUCTOR' && req.user.id !== instructorId) {
        throw createError('Forbidden', 403);
    }
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

// POST /api/ratings
const create = async (req, res) => {
    const { courseId, stars, comment = '' } = req.body;
    if (!courseId || !stars) throw createError('courseId and stars are required', 400);
    if (stars < 1 || stars > 5) throw createError('Stars must be between 1 and 5', 400);

    const enrolled = await query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );
    if (!enrolled.rows.length) throw createError('You must be enrolled to rate this course', 403);

    const insert = await query(
        `INSERT INTO ratings (course_id, student_id, stars, comment) VALUES ($1,$2,$3,$4) RETURNING id`,
        [courseId, req.user.id, stars, comment]
    );

    await query(`
        UPDATE courses SET
            rating = (SELECT ROUND(AVG(stars)::numeric, 1) FROM ratings WHERE course_id = $1),
            review_count = (SELECT COUNT(*) FROM ratings WHERE course_id = $1)
        WHERE id = $1
    `, [courseId]);

    const result = await query(`
        SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
        WHERE r.id = $1
    `, [insert.rows[0].id]);

    res.status(201).json(mapRating(result.rows[0]));
};

// PUT /api/ratings/:id/reply
const replyToReview = async (req, res) => {
    const { reply } = req.body;
    if (!reply) throw createError('Reply text is required', 400);
    const result = await query(
        `UPDATE ratings SET instructor_reply = $1 WHERE id = $2 RETURNING id`,
        [reply, req.params.id]
    );
    if (!result.rows.length) throw createError('Rating not found', 404);

    const full = await query(`
        SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
        WHERE r.id = $1
    `, [req.params.id]);
    res.json(mapRating(full.rows[0]));
};

// PUT /api/ratings/:id/like
const likeReview = async (req, res) => {
    const result = await query(
        `UPDATE ratings SET likes = likes + 1 WHERE id = $1 RETURNING id`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Rating not found', 404);

    const full = await query(`
        SELECT ${ratingFields} FROM ratings r JOIN users u ON r.student_id = u.id
        WHERE r.id = $1
    `, [req.params.id]);
    res.json(mapRating(full.rows[0]));
};

const deleteRating = async (req, res) => {
    const result = await query(
        `DELETE FROM ratings WHERE id = $1 RETURNING course_id`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Rating not found', 404);

    const courseId = result.rows[0].course_id;
    await query(`
        UPDATE courses SET
            rating = COALESCE((SELECT ROUND(AVG(stars)::numeric, 1) FROM ratings WHERE course_id = $1), 0),
            review_count = (SELECT COUNT(*) FROM ratings WHERE course_id = $1)
        WHERE id = $1
    `, [courseId]);

    res.json({ success: true });
};

module.exports = { getAll, getByInstructor, getByCourse, create, replyToReview, likeReview, deleteRating };
