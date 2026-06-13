const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapEnrollment } = require('../utils/formatters');

// GET /api/enrollments/student/:studentId
const getByStudent = async (req, res) => {
    const studentId = req.params.studentId || req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    const { getPagination } = require('../utils/pagination');

    // Only allow students to see their own, admins can see any
    if (req.user.role === 'STUDENT' && String(studentId) !== String(req.user.id)) {
        throw createError('Forbidden', 403);
    }

    const countRes = await query('SELECT COUNT(*)::int as total FROM enrollments WHERE student_id = $1', [studentId]);
    const total = countRes.rows[0].total;

    const result = await query(`
        SELECT e.*,
               c.id as "courseId", c.title, c.thumbnail, c.level, c.duration,
               u.name as "instructorName", u.avatar as "instructorAvatar"
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON c.instructor_id = u.id
        WHERE e.student_id = $1
        ORDER BY e.last_accessed DESC
        LIMIT $2 OFFSET $3
    `, [studentId, parseInt(limit), parseInt(offset)]);

    const pageNum = Math.floor(parseInt(offset) / parseInt(limit)) + 1;

    res.json({
        success: true,
        data: result.rows.map(mapEnrollment),
        pagination: getPagination(total, pageNum, limit)
    });
};

// POST /api/enrollments
const enroll = async (req, res) => {
    const { courseId } = req.body;
    if (!courseId) throw createError('courseId is required', 400);

    const course = await query('SELECT id, enrollment_count FROM courses WHERE id = $1 AND status = $2', [courseId, 'PUBLISHED']);
    if (!course.rows.length) throw createError('Course not found or not published', 404);

    const result = await query(
        `INSERT INTO enrollments (student_id, course_id) VALUES ($1,$2) RETURNING *`,
        [req.user.id, courseId]
    );
    // Increment enrollment count
    await query('UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1', [courseId]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_ENROLLED', 'courses', courseId]
    ).catch(() => { });

    await query(
        `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'You enrolled in a new course. Start learning today!', 'enrollment', `/courses/${courseId}/learn`]
    ).catch(() => { });

    res.status(201).json(mapEnrollment(result.rows[0]));
};

// PUT /api/enrollments/progress
const updateProgress = async (req, res) => {
    const { courseId, lessonId } = req.body;
    if (!courseId || !lessonId) throw createError('courseId and lessonId are required', 400);

    const enrollment = await query(
        'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );
    if (!enrollment.rows.length) throw createError('Not enrolled in this course', 403);

    const current = enrollment.rows[0];
    const completedLessons = current.completed_lessons || [];

    if (!completedLessons.includes(lessonId)) {
        completedLessons.push(lessonId);
    }

    // Calculate progress
    const totalLessons = await query('SELECT COUNT(*) FROM lessons WHERE course_id = $1', [courseId]);
    const total = parseInt(totalLessons.rows[0].count) || 1;
    const progress = Math.min(100, Math.round((completedLessons.length / total) * 100));

    const result = await query(
        `UPDATE enrollments SET
            completed_lessons = $1,
            progress = $2,
            last_accessed = NOW(),
            completed_at = CASE WHEN $2 >= 100 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
         WHERE student_id = $3 AND course_id = $4 RETURNING *`,
        [completedLessons, progress, req.user.id, courseId]
    );

    // Track active learning for streak
    const { updateStreak } = require('../utils/streak');
    await updateStreak(req.user.id).catch(() => { });

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'LESSON_COMPLETED', 'lessons', lessonId]
    ).catch(() => { });

    res.json(mapEnrollment(result.rows[0]));
};

// GET /api/enrollments/stats/:instructorId
const getStats = async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const { getPagination } = require('../utils/pagination');

    const countRes = await query(`
        SELECT COUNT(*)::int as total
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = $1
    `, [req.params.instructorId]);
    const total = countRes.rows[0].total;

    const result = await query(`
        SELECT e.*,
               c.title as course_title,
               u.id as "studentId", u.name as "studentName",
               u.email as "studentEmail", u.avatar as "studentAvatar"
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON e.student_id = u.id
        WHERE c.instructor_id = $1
        ORDER BY e.last_accessed DESC
        LIMIT $2 OFFSET $3
    `, [req.params.instructorId, parseInt(limit), parseInt(offset)]);

    const pageNum = Math.floor(parseInt(offset) / parseInt(limit)) + 1;

    res.json({
        success: true,
        data: result.rows.map(row => ({
            ...mapEnrollment(row),
            studentId: row.studentId,
            studentName: row.studentName,
            studentEmail: row.studentEmail,
            studentAvatar: row.studentAvatar,
            courseTitle: row.course_title,
        })),
        pagination: getPagination(total, pageNum, limit)
    });
};

module.exports = { getByStudent, enroll, updateProgress, getStats };
