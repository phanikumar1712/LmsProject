const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapEnrollment } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');
const { writeAudit } = require('../utils/audit');

// GET /api/enrollments/student/:studentId
const getByStudent = async (req, res) => {
    const studentId = req.params.studentId || req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    const { getPagination } = require('../utils/pagination');

    // Anyone may look up their own enrollments (students, admins, instructors).
    // The role checks below only apply when viewing someone else's record.
    const isSelf = String(studentId) === String(req.user.id);

    // Only allow students to see their own
    if (req.user.role === 'STUDENT' && !isSelf) {
        throw createError('Forbidden', 403);
    }

    // Instructors may only view students enrolled in their own courses
    if (req.user.role === 'INSTRUCTOR' && !isSelf) {
        const check = await query(`
            SELECT 1 FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.student_id = $1 AND c.instructor_id = $2
            LIMIT 1
        `, [studentId, req.user.id]);
        if (!check.rows.length) {
            throw createError('You can only view students enrolled in your courses', 403);
        }
    }

    // Department-scoped admins may only view students in their own department
    const { scoped, departmentId } = getDepartmentScope(req);
    if (scoped && !isSelf) {
        const deptCheck = await query(
            'SELECT 1 FROM users WHERE id = $1 AND department_id = $2',
            [studentId, departmentId]
        );
        if (!deptCheck.rows.length) {
            throw createError('This student is outside your department', 403);
        }
    }

    const countRes = await query('SELECT COUNT(*)::int as total FROM enrollments WHERE student_id = $1', [studentId]);
    const total = countRes.rows[0].total;

    const result = await query(`
        SELECT e.*,
               c.id as "courseId", c.title, c.thumbnail, c.level, c.duration,
               u.name as "instructorName", u.avatar as "instructorAvatar"
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        LEFT JOIN users u ON c.instructor_id = u.id
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

    const course = await query(
        `SELECT c.id, c.enrollment_count, c.department_id AS "departmentId"
         FROM courses c
         WHERE c.id = $1 AND c.status = $2`,
        [courseId, 'PUBLISHED']
    );
    if (!course.rows.length) throw createError('Course not found or not published', 404);

    // Department isolation: a student may only enroll in courses whose
    // department matches their own (course → category → department). Students
    // without a department, or courses without one, bypass the check.
    const courseDeptId = course.rows[0].departmentId;
    const studentDeptId = req.user.department_id;
    if (courseDeptId && studentDeptId && courseDeptId !== studentDeptId) {
        throw createError('This course is not available in your department', 403);
    }

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
        await writeAudit(req, {
            action: 'COURSE_ENROLLED',
            resource: 'courses',
            resourceId: courseId,
            newValue: { courseId, versionId },
            details: { courseId },
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

    await writeAudit(req, {
        action: 'LESSON_COMPLETED',
        resource: 'lessons',
        resourceId: lessonId,
        oldValue: { progress: current.progress },
        newValue: { progress, lessonId },
        details: { courseId, lessonId, completedLessons: completedLessons.length },
    });

    // Auto-issue the certificate the moment the course hits 100% (idempotent —
    // only creates it once; safe if progress was already 100 from an earlier
    // lesson). Never blocks the progress response.
    if (progress >= 100) {
        const { ensureCertificate } = require('./certificatesController');
        await ensureCertificate(req.user.id, courseId).catch(err => {
            console.error('[Certificate] Auto-issue failed:', err.message);
        });
    }

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

    // Defense in depth: only surface students whose department matches the
    // instructor's own (or students with no department). Legacy cross-department
    // enrollments from before the isolation rules are filtered out here.
    const instructorDept = await query('SELECT department_id FROM users WHERE id = $1', [instructorId]);
    const instructorDeptId = instructorDept.rows.length ? instructorDept.rows[0].department_id : null;

    const countRes = await query(`
        SELECT COUNT(*)::int as total
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON e.student_id = u.id
        WHERE c.instructor_id = $1
          ${instructorDeptId ? 'AND (u.department_id IS NULL OR u.department_id = $2)' : ''}
    `, instructorDeptId ? [instructorId, instructorDeptId] : [instructorId]);
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
          ${instructorDeptId ? 'AND (u.department_id IS NULL OR u.department_id = $2)' : ''}
        ORDER BY e.last_accessed DESC
        LIMIT ${instructorDeptId ? '$3' : '$2'} OFFSET ${instructorDeptId ? '$4' : '$3'}
    `, instructorDeptId
        ? [instructorId, instructorDeptId, parseInt(limit), parseInt(offset)]
        : [instructorId, parseInt(limit), parseInt(offset)]);

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

    // Verify course exists and resolve its department (courses.department_id)
    const course = await query(
        `SELECT c.id, c.title, c.enrollment_count, c.department_id AS "departmentId"
         FROM courses c
         WHERE c.id = $1`,
        [courseId]
    );
    if (!course.rows.length) throw createError('Course not found', 404);
    const courseDeptId = course.rows[0].departmentId;

    // Resolve roll_no to user IDs if provided — restricted to the course's department
    let allStudentIds = [...studentIds];
    if (rollNos.length) {
        const { scoped, departmentId } = getDepartmentScope(req);
        const deptFilter = scoped ? departmentId : courseDeptId;
        const resolved = await query(
            `SELECT id FROM users
             WHERE roll_no = ANY($1)
               AND role = 'STUDENT'
               AND active = true
               ${deptFilter ? 'AND department_id = $2' : ''}`,
            deptFilter ? [rollNos, deptFilter] : [rollNos]
        );
        const resolvedIds = resolved.rows.map(r => r.id);
        allStudentIds = [...new Set([...allStudentIds, ...resolvedIds])];
    }

    if (!allStudentIds.length) throw createError('No valid students found to enroll', 400);

    // Students must belong to the course's department
    const deptMismatched = new Set();
    if (courseDeptId && allStudentIds.length) {
        const matched = await query(
            `SELECT id FROM users WHERE id = ANY($1::uuid[]) AND department_id = $2`,
            [allStudentIds, courseDeptId]
        );
        const matchedIds = new Set(matched.rows.map(r => r.id));
        allStudentIds.forEach(sid => { if (!matchedIds.has(sid)) deptMismatched.add(sid); });
    }

    // Get latest version to assign
    const latestVersion = await query(
        'SELECT id FROM course_versions WHERE course_id = $1 ORDER BY version_number DESC LIMIT 1',
        [courseId]
    );
    const versionId = latestVersion.rows.length ? latestVersion.rows[0].id : null;

    const client = await query.pool.connect();
    try {
        await client.query('BEGIN');

        // Batch the dup-check + insert into a single statement (was N+1: one
        // SELECT + one INSERT per student). The enrollments UNIQUE(student_id,
        // course_id) constraint is the arbiter — ON CONFLICT DO NOTHING skips
        // already-enrolled students and RETURNING tells us who was inserted.
        const eligibleIds = allStudentIds.filter(sid => !deptMismatched.has(sid));
        const insertedIds = new Set();
        if (eligibleIds.length) {
            const inserted = await client.query(`
                INSERT INTO enrollments (student_id, course_id, version_id)
                SELECT t.id, $1, $2
                FROM unnest($3::uuid[]) AS t(id)
                ON CONFLICT (student_id, course_id) DO NOTHING
                RETURNING student_id
            `, [courseId, versionId, eligibleIds]);
            inserted.rows.forEach(r => insertedIds.add(r.student_id));
        }

        const results = [];
        let enrolledCount = 0;
        for (const studentId of allStudentIds) {
            if (deptMismatched.has(studentId)) {
                results.push({ studentId, status: 'skipped', reason: 'Different department' });
            } else if (insertedIds.has(studentId)) {
                enrolledCount++;
                results.push({ studentId, status: 'enrolled' });
            } else {
                results.push({ studentId, status: 'skipped', reason: 'Already enrolled' });
            }
        }

        // Update enrollment count atomically
        if (enrolledCount > 0) {
            await client.query(
                'UPDATE courses SET enrollment_count = enrollment_count + $1 WHERE id = $2',
                [enrolledCount, courseId]
            );
        }

        await client.query('COMMIT');

        await writeAudit(req, {
            action: 'BULK_ENROLLMENT',
            resource: 'courses',
            resourceId: courseId,
            newValue: { enrolled: enrolledCount, total: allStudentIds.length },
            details: { enrolled: enrolledCount, total: allStudentIds.length, courseId },
        });

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

// GET /api/enrollments/course/:courseId — list students enrolled in a course.
// Scoped admins may only see enrollments of courses in their own department.
const getCourseStudents = async (req, res) => {
    const { courseId } = req.params;
    const course = await query(
        `SELECT c.id, c.department_id AS "departmentId"
         FROM courses c
         WHERE c.id = $1`,
        [courseId]
    );
    if (!course.rows.length) throw createError('Course not found', 404);
    const { scoped, departmentId } = getDepartmentScope(req);
    if (scoped && course.rows[0].departmentId && course.rows[0].departmentId !== departmentId) {
        throw createError('Course is outside your department', 403);
    }

    const result = await query(`
        SELECT u.id, u.name, u.email, u.roll_no, u.avatar, u.active, e.enrolled_at, e.progress
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        WHERE e.course_id = $1
        ORDER BY u.name ASC`,
        [courseId]
    );
    res.json(result.rows.map(r => ({
        ...r,
        rollNo: r.roll_no,
        enrolledAt: r.enrolled_at,
    })));
};

// POST /api/enrollments/unenroll — admin/super-admin bulk-unenrolls students
// from a course. Department isolation: a scoped admin may only unenroll their
// own department's students from courses in their own department (course →
// category → department). Returns per-student results.
const bulkUnenroll = async (req, res) => {
    const { courseId, studentIds } = req.body;
    if (!courseId) throw createError('courseId is required', 400);
    if (!Array.isArray(studentIds) || !studentIds.length) throw createError('studentIds must be a non-empty array', 400);

    const course = await query(
        `SELECT c.id, c.title, c.enrollment_count, c.department_id AS "departmentId"
         FROM courses c
         WHERE c.id = $1`,
        [courseId]
    );
    if (!course.rows.length) throw createError('Course not found', 404);
    const courseDeptId = course.rows[0].departmentId;
    const { scoped, departmentId } = getDepartmentScope(req);

    // Scoped admins may only unenroll students from their own department.
    let eligibleIds = [...new Set(studentIds.map(String))];
    if (courseDeptId) {
        const matched = await query(
            `SELECT id FROM users WHERE id = ANY($1::uuid[]) AND department_id = $2`,
            [eligibleIds, courseDeptId]
        );
        const matchedIds = new Set(matched.rows.map(r => r.id));
        eligibleIds = eligibleIds.filter(sid => matchedIds.has(sid));
    }

    const client = await query.pool.connect();
    try {
        await client.query('BEGIN');

        let removedCount = 0;
        if (eligibleIds.length) {
            const removed = await client.query(
                `DELETE FROM enrollments WHERE course_id = $1 AND student_id = ANY($2::uuid[])
                 RETURNING student_id`,
                [courseId, eligibleIds]
            );
            removedCount = removed.rowCount;
            if (removedCount > 0) {
                await client.query(
                    'UPDATE courses SET enrollment_count = GREATEST(0, enrollment_count - $1) WHERE id = $2',
                    [removedCount, courseId]
                );
            }
        }

        await client.query('COMMIT');

        await writeAudit(req, {
            action: 'BULK_UNENROLLMENT',
            resource: 'courses',
            resourceId: courseId,
            newValue: { removed: removedCount, total: studentIds.length },
            details: { removed: removedCount, total: studentIds.length, courseTitle: course.rows[0].title },
        });

        res.json({ success: true, total: studentIds.length, removed: removedCount });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ── BULK ENROLLMENT IMPORT (validate → preview → confirm) ──────────────────
// Upload a CSV/Excel sheet with per-row Course + Student references:
//   Course   — course id or title (case-insensitive), required
//   Student ID / Roll No — student roll number, OR
//   Email    — student email
// Preview resolves + validates every row WITHOUT writing (unknown course,
// unknown student, different department, already enrolled → per-row errors).
// Confirm then enrolls exactly the valid rows in a single batched insert with
// ON CONFLICT DO NOTHING (the UNIQUE(student_id, course_id) constraint is the
// arbiter), mirroring the bulkEnroll semantics.

const MAX_ENROLL_IMPORT_ROWS = 500;

const parseEnrollmentSheet = (req) => {
    if (!req.file || !req.file.buffer) throw createError('No file uploaded', 400);
    const xlsx = require('xlsx');
    let rows;
    try {
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
        throw createError('Could not parse file. Upload a valid CSV or Excel file.', 400);
    }
    if (!rows.length) throw createError('The file has no rows', 400);
    if (rows.length > MAX_ENROLL_IMPORT_ROWS) throw createError(`File exceeds maximum of ${MAX_ENROLL_IMPORT_ROWS} rows`, 400);
    return rows;
};

// Case-insensitive column picker (headers may be "Course", "COURSE", ...).
const pickEnrollCell = (row, key) => {
    const found = Object.keys(row).find(k => k.trim().toLowerCase() === key);
    return found ? row[found] : '';
};

// Shared runner: preview=false actually enrolls, preview=true only validates.
const runEnrollmentImport = async (req, res, { preview = false }) => {
    const rows = parseEnrollmentSheet(req);
    const { scoped, departmentId } = getDepartmentScope(req);
    const isUUID = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));

    // Optional courseId from query param — when provided, CSV rows don't need a
    // "Course" column; every row is enrolled in the pre-selected course.
    const overrideCourseId = req.query.courseId || null;
    let overrideCourse = null;
    if (overrideCourseId) {
        const cRes = await query(
            `SELECT c.id, c.title, c.enrollment_count, d.name AS "departmentName", c.department_id AS "departmentId"
             FROM courses c LEFT JOIN departments d ON d.id = c.department_id WHERE c.id = $1`,
            [overrideCourseId]
        );
        if (cRes.rows.length) overrideCourse = cRes.rows[0];
    }

    // 1) Normalize each row (format validation only, no DB).
    const normalized = rows.map((row, index) => {
        const courseRef = overrideCourse
            ? overrideCourse.title // auto-fill from pre-selected course
            : String(pickEnrollCell(row, 'course') || pickEnrollCell(row, 'course id') || pickEnrollCell(row, 'course title') || '').trim();
        const rollNo = String(pickEnrollCell(row, 'student id') || pickEnrollCell(row, 'roll no') || pickEnrollCell(row, 'roll') || '').trim();
        const email = String(pickEnrollCell(row, 'email') || '').trim().toLowerCase();
        let error = null;
        if (!courseRef) error = 'Course is required';
        else if (!rollNo && !email) error = 'Student ID (roll no) or Email is required';
        return { index, courseRef, rollNo, email, error };
    });

    // 2) Resolve every referenced course in ONE query (id or title).
    const courseRefs = [...new Set(normalized.filter(r => !r.error).map(r => r.courseRef))];
    const courseMap = new Map(); // lower(ref) → course row
    // Pre-populate with override course if provided
    if (overrideCourse) {
        courseMap.set(overrideCourse.id, overrideCourse);
        courseMap.set(overrideCourse.title.toLowerCase(), overrideCourse);
    }
    if (courseRefs.length) {
        const ids = courseRefs.filter(isUUID);
        const titles = courseRefs.filter(r => !isUUID(r)).map(r => r.toLowerCase());
        const res = await query(`
            SELECT c.id, c.title, c.enrollment_count, d.name AS "departmentName", c.department_id AS "departmentId"
            FROM courses c
            LEFT JOIN departments d ON d.id = c.department_id
            WHERE c.id = ANY($1::uuid[]) OR LOWER(c.title) = ANY($2::text[])
        `, [ids.length ? ids : [null], titles.length ? titles : [null]]);
        res.rows.forEach(c => {
            courseMap.set(c.id, c);
            courseMap.set(c.title.toLowerCase(), c);
        });
    }

    // 3) Resolve every referenced student in ONE query (roll_no or email).
    const rolls = [...new Set(normalized.filter(r => !r.error && r.rollNo).map(r => r.rollNo))];
    const emails = [...new Set(normalized.filter(r => !r.error && r.email).map(r => r.email))];
    const studentsByRoll = new Map();
    const studentsByEmail = new Map();
    if (rolls.length) {
        const res = await query(
            `SELECT id, name, email, roll_no, department_id FROM users WHERE roll_no = ANY($1) AND role = 'STUDENT'`,
            [rolls]
        );
        res.rows.forEach(u => { if (u.roll_no) studentsByRoll.set(u.roll_no.toLowerCase(), u); });
    }
    if (emails.length) {
        const res = await query(
            `SELECT id, name, email, roll_no, department_id FROM users WHERE LOWER(email) = ANY($1::text[]) AND role = 'STUDENT'`,
            [emails]
        );
        res.rows.forEach(u => studentsByEmail.set(u.email.toLowerCase(), u));
    }

    // 4) Classify each row: course ok? student ok? dept match?
    const results = new Array(rows.length).fill(null);
    const validPairs = []; // { courseId, studentId, index }
    normalized.forEach(r => {
        const rowNo = r.index + 1;
        if (r.error) {
            results[r.index] = { row: rowNo, status: 'error', error: r.error, courseRef: r.courseRef, rollNo: r.rollNo, email: r.email };
            return;
        }
        const course = courseMap.get(r.courseRef.toLowerCase()) || courseMap.get(r.courseRef);
        if (!course) {
            results[r.index] = { row: rowNo, status: 'error', error: `Course not found: ${r.courseRef}`, courseRef: r.courseRef, rollNo: r.rollNo, email: r.email };
            return;
        }
        if (scoped && course.departmentId && course.departmentId !== departmentId) {
            results[r.index] = { row: rowNo, status: 'error', error: 'Course is outside your department', courseTitle: course.title, rollNo: r.rollNo, email: r.email };
            return;
        }
        const student = r.rollNo ? studentsByRoll.get(r.rollNo.toLowerCase()) : studentsByEmail.get(r.email);
        if (!student) {
            results[r.index] = { row: rowNo, status: 'error', error: `Student not found: ${r.rollNo || r.email}`, courseTitle: course.title, rollNo: r.rollNo, email: r.email };
            return;
        }
        if (course.departmentId && student.department_id && student.department_id !== course.departmentId) {
            results[r.index] = { row: rowNo, status: 'error', error: 'Different department', courseTitle: course.title, studentName: student.name, rollNo: student.roll_no, email: student.email };
            return;
        }
        results[r.index] = {
            row: rowNo, status: preview ? 'ok' : 'pending', courseId: course.id, courseTitle: course.title,
            departmentName: course.departmentName, studentId: student.id, studentName: student.name,
            rollNo: student.roll_no, email: student.email, error: null,
        };
        validPairs.push({ courseId: course.id, studentId: student.id, index: r.index });
    });

    // 5) Existing-enrollment check in one batched query (preview + confirm both
    //    need it so the user sees exactly what will happen).
    const pairKey = (cid, sid) => `${cid}|${sid}`;
    if (validPairs.length) {
        const existing = new Set();
        const eres = await query(
            `SELECT course_id, student_id FROM enrollments
             WHERE (course_id, student_id) IN (SELECT t.c::uuid, t.s::uuid FROM unnest($1::uuid[], $2::uuid[]) AS t(c, s))`,
            [validPairs.map(p => p.courseId), validPairs.map(p => p.studentId)]
        );
        eres.rows.forEach(e => existing.add(pairKey(e.course_id, e.student_id)));
        validPairs.forEach(p => {
            if (existing.has(pairKey(p.courseId, p.studentId))) {
                const r = results[p.index];
                r.status = 'error';
                r.error = 'Already enrolled';
            }
        });
    }

    // Preview stops here — classification is identical to the real import.
    if (preview) {
        const ok = results.filter(r => r && r.status === 'ok').length;
        return res.status(200).json({ total: rows.length, ok, failed: rows.length - ok, preview: true, results: stripEnrollResults(results) });
    }

    // 6) Confirm: batched INSERT with ON CONFLICT DO NOTHING (mirrors bulkEnroll).
    const eligible = results.filter(r => r && r.status !== 'error');
    const client = await query.pool.connect();
    try {
        await client.query('BEGIN');

        let enrolledCount = 0;
        if (eligible.length) {
            const courseIds = eligible.map(r => r.courseId);
            const studentIds = eligible.map(r => r.studentId);

            // Resolve the latest course version per course (one query).
            const distinctCourseIds = [...new Set(courseIds)];
            const versionMap = new Map();
            const vres = await client.query(
                `SELECT DISTINCT ON (course_id) course_id, id FROM course_versions
                 WHERE course_id = ANY($1::uuid[]) ORDER BY course_id, version_number DESC`,
                [distinctCourseIds]
            );
            vres.rows.forEach(v => versionMap.set(v.course_id, v.id));
            const versionIds = courseIds.map(cid => versionMap.get(cid) || null);

            const inserted = await client.query(`
                INSERT INTO enrollments (student_id, course_id, version_id)
                SELECT t.s, t.c, t.v
                FROM unnest($1::uuid[], $2::uuid[], $3::uuid[]) AS t(c, s, v)
                ON CONFLICT (student_id, course_id) DO NOTHING
                RETURNING student_id, course_id
            `, [courseIds, studentIds, versionIds]);

            const insertedPairs = new Set(inserted.rows.map(r => pairKey(r.course_id, r.student_id)));
            eligible.forEach(r => {
                if (insertedPairs.has(pairKey(r.courseId, r.studentId))) {
                    r.status = 'enrolled';
                    enrolledCount++;
                } else {
                    r.status = 'error';
                    r.error = 'Already enrolled';
                }
            });

            // Update enrollment_count per course (batch by course).
            const perCourse = new Map();
            inserted.rows.forEach(r => perCourse.set(r.course_id, (perCourse.get(r.course_id) || 0) + 1));
            for (const [cid, cnt] of perCourse) {
                await client.query(
                    'UPDATE courses SET enrollment_count = enrollment_count + $1 WHERE id = $2',
                    [cnt, cid]
                );
            }
        }

        await client.query('COMMIT');

        if (enrolledCount > 0) {
            await writeAudit(req, {
                action: 'BULK_ENROLLMENT_IMPORT',
                resource: 'enrollments',
                newValue: { enrolled: enrolledCount, total: rows.length },
                details: { enrolled: enrolledCount, total: rows.length },
            });
        }

        const created = results.filter(r => r && r.status === 'enrolled').length;
        res.status(201).json({
            total: rows.length, created, failed: rows.length - created, preview: false,
            results: stripEnrollResults(results),
        });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// Results are sent to the UI for display — never expose raw student/course ids.
const stripEnrollResults = (results) => results.map(r => r ? ({
    row: r.row, status: r.status, error: r.error || null,
    courseTitle: r.courseTitle || null, departmentName: r.departmentName || null,
    studentName: r.studentName || null, rollNo: r.rollNo || null, email: r.email || null,
}) : null).filter(Boolean);

const previewEnrollmentImport = async (req, res) => runEnrollmentImport(req, res, { preview: true });
const importEnrollments = async (req, res) => runEnrollmentImport(req, res, { preview: false });

// GET /api/enrollments/import/template — downloadable Excel template.
const downloadEnrollmentTemplate = async (req, res) => {
    const xlsx = require('xlsx');
    const wb = xlsx.utils.book_new();
    const data = [
        { course: 'Java Programming', 'student id': 'CS22001', email: 'student@example.com' },
        { course: 'Java Programming', 'student id': 'CS22002', email: '' },
    ];
    const ws = xlsx.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 35 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Enrollments');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Enrollment_Import_Template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
};

module.exports = {
    getByStudent, enroll, updateProgress, getStats, bulkEnroll, bulkUnenroll, getCourseStudents,
    previewEnrollmentImport, importEnrollments, downloadEnrollmentTemplate,
};
