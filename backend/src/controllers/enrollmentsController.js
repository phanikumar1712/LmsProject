const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapEnrollment } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');

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

    // Check for existing enrollment to prevent duplicates
    const existing = await query(
        'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [req.user.id, courseId]
    );
    if (existing.rows.length) throw createError('Already enrolled in this course', 409);

    // Get the latest version to assign at enrollment (so student sees the content that existed when they enrolled)
    const latestVersion = await query(
        'SELECT id FROM course_versions WHERE course_id = $1 ORDER BY version_number DESC LIMIT 1',
        [courseId]
    );
    const versionId = latestVersion.rows.length ? latestVersion.rows[0].id : null;

    // Use a transaction to ensure atomicity of enrollment creation and counter increment
    const client = await query.pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO enrollments (student_id, course_id, version_id) VALUES ($1,$2,$3) RETURNING *`,
            [req.user.id, courseId, versionId]
        );

        // Increment enrollment count atomically within the same transaction
        await client.query('UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1', [courseId]);

        await client.query('COMMIT');

        // Audit log and notifications (non-critical, can fail silently)
        await query(
            `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
            [req.user.id, 'COURSE_ENROLLED', 'courses', courseId]
        ).catch(err => {
            console.error('[Audit] Failed to log enrollment:', err.message);
        });

        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [req.user.id, 'You enrolled in a new course. Start learning today!', 'enrollment', `/courses/${courseId}/learn`]
        ).catch(err => {
            console.error('[Notification] Failed to create enrollment notification:', err.message);
        });

        res.status(201).json(mapEnrollment(result.rows[0]));
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
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

    const lessons = await query('SELECT id, type FROM lessons WHERE course_id = $1', [courseId]);
    const lesson = lessons.rows.find(row => row.id === lessonId);
    if (!lesson) throw createError('Lesson does not belong to this course', 400);

    if (lesson.type === 'quiz') {
        const passed = await query(`
            SELECT 1
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            WHERE qa.student_id = $1 AND q.lesson_id = $2 AND q.course_id = $3 AND qa.passed = true
            LIMIT 1
        `, [req.user.id, lessonId, courseId]);
        if (!passed.rows.length) throw createError('You must pass this quiz before completing the lesson', 403);
    }

    const current = enrollment.rows[0];
    const validLessonIds = new Set(lessons.rows.map(row => row.id));
    const completedLessons = (current.completed_lessons || []).filter(id => validLessonIds.has(id));

    if (!completedLessons.includes(lessonId)) {
        completedLessons.push(lessonId);
    }

    // Calculate progress
    const total = lessons.rows.length || 1;
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
    await updateStreak(req.user.id).catch(err => {
        console.error('[Streak] Update failed for user', req.user.id, ':', err.message);
    });

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'LESSON_COMPLETED', 'lessons', lessonId]
    ).catch(err => {
        console.error('[Audit] Failed to log lesson completion:', err.message);
    });

    res.json(mapEnrollment(result.rows[0]));
};

// GET /api/enrollments/stats/:instructorId
const getStats = async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const { getPagination } = require('../utils/pagination');
    const instructorId = req.params.instructorId;

    // Authorization: instructors can only see their own stats
    if (req.user.role === 'INSTRUCTOR' && req.user.id !== instructorId) {
        throw createError('Forbidden', 403);
    }

    // Department-scoped admins must verify the instructor is in their department
    const { scoped, departmentId } = getDepartmentScope(req);
    if (scoped) {
        const deptCheck = await query(
            'SELECT 1 FROM users WHERE id = $1 AND department_id = $2',
            [instructorId, departmentId]
        );
        if (!deptCheck.rows.length) {
            throw createError('Instructor not in your department', 403);
        }
    }

    const countRes = await query(`
        SELECT COUNT(*)::int as total
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = $1
    `, [instructorId]);
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
    `, [instructorId, parseInt(limit), parseInt(offset)]);

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

// POST /api/enrollments/bulk — Admin bulk-enrolls students in a course
const bulkEnroll = async (req, res) => {
    const { courseId, studentIds = [], rollNos = [] } = req.body;
    if (!courseId) throw createError('courseId is required', 400);
    if (!studentIds.length && !rollNos.length) throw createError('Provide studentIds or rollNos to enroll', 400);

    // Resolve roll_no to user IDs if provided
    let allStudentIds = [...studentIds];
    if (rollNos.length) {
        const { scoped, departmentId } = getDepartmentScope(req);
        const resolved = await query(
            `SELECT id FROM users
             WHERE roll_no = ANY($1)
               AND role = 'STUDENT'
               AND active = true
               ${scoped ? 'AND department_id = $2' : ''}`,
            scoped ? [rollNos, departmentId] : [rollNos]
        );
        const resolvedIds = resolved.rows.map(r => r.id);
        allStudentIds = [...new Set([...allStudentIds, ...resolvedIds])];
    }

    if (!allStudentIds.length) throw createError('No valid students found to enroll', 400);

    // Get latest version to assign
    const latestVersion = await query(
        'SELECT id FROM course_versions WHERE course_id = $1 ORDER BY version_number DESC LIMIT 1',
        [courseId]
    );
    const versionId = latestVersion.rows.length ? latestVersion.rows[0].id : null;

    // Verify course exists
    const course = await query('SELECT id, title, enrollment_count FROM courses WHERE id = $1', [courseId]);
    if (!course.rows.length) throw createError('Course not found', 404);

    const client = await query.pool.connect();
    try {
        await client.query('BEGIN');

        const results = [];
        let enrolledCount = 0;

        for (const studentId of allStudentIds) {
            // Check duplicate
            const existing = await client.query(
                'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
                [studentId, courseId]
            );
            if (existing.rows.length) {
                results.push({ studentId, status: 'skipped', reason: 'Already enrolled' });
                continue;
            }

            await client.query(
                'INSERT INTO enrollments (student_id, course_id, version_id) VALUES ($1, $2, $3)',
                [studentId, courseId, versionId]
            );
            enrolledCount++;
            results.push({ studentId, status: 'enrolled' });
        }

        // Update enrollment count atomically
        if (enrolledCount > 0) {
            await client.query(
                'UPDATE courses SET enrollment_count = enrollment_count + $1 WHERE id = $2',
                [enrolledCount, courseId]
            );
        }

        await client.query('COMMIT');

        await query(
            `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
            [req.user.id, 'BULK_ENROLLMENT', 'courses', courseId, JSON.stringify({ enrolled: enrolledCount, total: allStudentIds.length })]
        ).catch(() => {});

        res.json({
            success: true,
            total: allStudentIds.length,
            enrolled: enrolledCount,
            skipped: results.filter(r => r.status === 'skipped').length,
            results,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { getByStudent, enroll, updateProgress, getStats, bulkEnroll };
