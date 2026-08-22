const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { assertCourseEditable, assertChildEditable } = require('../utils/courseAuth');

// ── ASSIGNMENT AUTHORIZATION HELPERS ──────────────────────────────────────────
// Assignments belong to a course. Editing/grading/removing an assignment (or its
// submissions/rubric) is limited to the course's instructor, a department-scoped
// admin whose department owns the course, or a SUPER_ADMIN — mirroring the
// assertCourseOwnership / assertCourseInScope rules used across the platform.

const assignmentToCourseSql = `
    SELECT a.course_id FROM assignments a WHERE a.id = $1
`;
const submissionToCourseSql = `
    SELECT a.course_id FROM submissions s
    JOIN assignments a ON s.assignment_id = a.id
    WHERE s.id = $1
`;

// GET /api/assignments/course/:courseId
const getByCourse = async (req, res) => {
    // Instructors may only list assignments for their own courses; scoped
    // admins only for in-department courses. Enrolled students may view (they
    // need to see the work they must submit).
    if (req.user.role === 'STUDENT') {
        const enrolled = await query(
            'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
            [req.user.id, req.params.courseId]
        );
        if (!enrolled.rows.length) throw createError('Not enrolled in this course', 403);
    } else {
        await assertCourseEditable(req, req.params.courseId);
    }

    const result = await query(`
        SELECT a.*,
               (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as submission_count,
               (SELECT ROUND(AVG(s.marks)::numeric, 1) FROM submissions s WHERE s.assignment_id = a.id AND s.marks IS NOT NULL) as avg_marks
        FROM assignments a
        WHERE a.course_id = $1
        ORDER BY a.due_date ASC
    `, [req.params.courseId]);
    res.json(result.rows.map(a => ({
        ...a,
        submissionCount: parseInt(a.submission_count) || 0,
        avgMarks: parseFloat(a.avg_marks) || null,
        createdAt: a.created_at,
        dueDate: a.due_date,
    })));
};

// POST /api/assignments — create assignment
const create = async (req, res) => {
    const { courseId, lessonId, title, description, maxMarks = 100, dueDate, allowLate = false, fileRequired = true, allowResubmit = false } = req.body;
    if (!courseId || !title || !dueDate) throw createError('courseId, title, and dueDate are required', 400);

    await assertCourseEditable(req, courseId);

    const result = await query(`
        INSERT INTO assignments (course_id, lesson_id, title, description, max_marks, due_date, allow_late, file_required, allow_resubmit)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `, [courseId, lessonId || null, title, description || '', maxMarks, dueDate, allowLate, fileRequired, allowResubmit]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'ASSIGNMENT_CREATED', 'assignments', result.rows[0].id]
    ).catch(() => {});

    res.status(201).json(result.rows[0]);
};

// PUT /api/assignments/:id — update assignment
const update = async (req, res) => {
    await assertChildEditable(req, { sql: assignmentToCourseSql, id: req.params.id, notFound: 'Assignment not found' });
    const { title, description, maxMarks, dueDate, allowLate, fileRequired, allowResubmit } = req.body;
    const result = await query(`
        UPDATE assignments
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            max_marks = COALESCE($3, max_marks),
            due_date = COALESCE($4, due_date),
            allow_late = COALESCE($5, allow_late),
            file_required = COALESCE($6, file_required),
            allow_resubmit = COALESCE($7, allow_resubmit),
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
    `, [title, description, maxMarks, dueDate, allowLate, fileRequired, allowResubmit, req.params.id]);
    if (!result.rows.length) throw createError('Assignment not found', 404);
    res.json(result.rows[0]);
};

// DELETE /api/assignments/:id
const remove = async (req, res) => {
    await assertChildEditable(req, { sql: assignmentToCourseSql, id: req.params.id, notFound: 'Assignment not found' });
    const result = await query('DELETE FROM assignments WHERE id = $1 RETURNING id, title', [req.params.id]);
    if (!result.rows.length) throw createError('Assignment not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'ASSIGNMENT_DELETED', 'assignments', req.params.id,
         JSON.stringify({ title: result.rows[0].title })]
    ).catch(() => {});

    res.json({ success: true });
};

// ─── SUBMISSIONS ────────────────────────────────────────────────────────────

// GET /api/assignments/my — every assignment across the student's enrolled
// courses, joined with their own submission (if any) plus the linked lesson's
// resource URL for the "Download Resources" action. Powers the student
// Assignments page (view / download / upload / submit / resubmit / marks /
// feedback).
const getMyAssignments = async (req, res) => {
    if (req.user.role !== 'STUDENT') throw createError('Forbidden', 403);
    const studentId = req.user.id;

    const result = await query(`
        SELECT a.id, a.title, a.description, a.max_marks, a.due_date,
               a.allow_late, a.file_required, a.allow_resubmit,
               a.lesson_id, l.title AS lesson_title, l.content_url AS resource_url,
               c.id AS course_id, c.title AS course_title,
               s.id AS submission_id, s.file_url, s.comments, s.marks, s.feedback,
               s.submitted_at, s.graded_at, s.resubmission_requested
        FROM assignments a
        JOIN courses c ON c.id = a.course_id
        JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
        LEFT JOIN lessons l ON l.id = a.lesson_id
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
        ORDER BY a.due_date ASC
    `, [studentId]);

    const statusOf = (r) => {
        if (r.resubmission_requested) return 'RESUBMISSION_REQUIRED';
        if (r.marks !== null && r.marks !== undefined) return 'GRADED';
        if (r.submitted_at) {
            return r.due_date && new Date(r.submitted_at) > new Date(r.due_date) ? 'LATE' : 'SUBMITTED';
        }
        return r.due_date && new Date(r.due_date) < new Date() ? 'OVERDUE' : 'NOT_STARTED';
    };

    res.json(result.rows.map(r => {
        const status = statusOf(r);
        return {
            id: r.id,
            title: r.title,
            description: r.description,
            maxMarks: r.max_marks,
            dueDate: r.due_date,
            allowLate: r.allow_late,
            fileRequired: r.file_required,
            allowResubmit: r.allow_resubmit,
            lessonId: r.lesson_id,
            lessonTitle: r.lesson_title,
            resourceUrl: r.resource_url,
            courseId: r.course_id,
            courseTitle: r.course_title,
            status,
            submission: r.submission_id ? {
                id: r.submission_id,
                fileUrl: r.file_url,
                comments: r.comments,
                marks: r.marks,
                feedback: r.feedback,
                submittedAt: r.submitted_at,
                gradedAt: r.graded_at,
                status,
            } : null,
        };
    }));
};

// GET /api/assignments/overview — a student's dashboard view: upcoming
// assignments across their enrolled courses (with their own submission status)
// plus their recent graded submissions.
const getStudentOverview = async (req, res) => {
    if (req.user.role !== 'STUDENT') throw createError('Forbidden', 403);
    const studentId = req.user.id;

    const [upcomingRes, gradesRes] = await Promise.all([
        query(`
            SELECT a.id, a.title, a.description, a.due_date, a.max_marks, a.allow_resubmit,
                   c.id AS course_id, c.title AS course_title,
                   s.id AS submission_id, s.marks, s.feedback, s.submitted_at, s.resubmission_requested
            FROM assignments a
            JOIN courses c ON c.id = a.course_id
            JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
            LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
            WHERE a.due_date >= NOW() - INTERVAL '1 day'   -- keep late-but-open items visible
            ORDER BY a.due_date ASC
        `, [studentId]),
        query(`
            SELECT a.id AS assignment_id, a.title AS assignment_title, a.max_marks,
                   c.id AS course_id, c.title AS course_title,
                   s.marks, s.feedback, s.graded_at
            FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN courses c ON c.id = a.course_id
            WHERE s.student_id = $1 AND s.marks IS NOT NULL
            ORDER BY s.graded_at DESC NULLS LAST, s.submitted_at DESC
            LIMIT 8
        `, [studentId]),
    ]);

    // Derive each assignment's status for this student (mirrors the submission
    // status logic used in getSubmissions).
    const statusOf = (row) => {
        if (row.resubmission_requested) return 'RESUBMISSION_REQUIRED';
        if (row.marks !== null && row.marks !== undefined) return 'GRADED';
        if (row.submitted_at) {
            return row.due_date && new Date(row.submitted_at) > new Date(row.due_date)
                ? 'LATE' : 'SUBMITTED';
        }
        return row.due_date && new Date(row.due_date) < new Date() ? 'LATE' : 'NOT_STARTED';
    };

    const upcoming = upcomingRes.rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        courseId: r.course_id,
        courseTitle: r.course_title,
        dueDate: r.due_date,
        maxMarks: r.max_marks,
        allowResubmit: r.allow_resubmit,
        status: statusOf(r),
        marks: r.marks,
        feedback: r.feedback,
        submittedAt: r.submitted_at,
    }));

    const recentGrades = gradesRes.rows.map(r => ({
        assignmentId: r.assignment_id,
        title: r.assignment_title,
        courseId: r.course_id,
        courseTitle: r.course_title,
        marks: r.marks,
        maxMarks: r.max_marks,
        feedback: r.feedback,
        gradedAt: r.graded_at,
    }));

    res.json({ upcoming, recentGrades });
};

// GET /api/assignments/:id/submissions — get all submissions for an assignment
const getSubmissions = async (req, res) => {
    await assertChildEditable(req, { sql: assignmentToCourseSql, id: req.params.id, notFound: 'Assignment not found' });
    const result = await query(`
        SELECT s.*, a.due_date, u.name as student_name, u.email as student_email, u.avatar as student_avatar
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN users u ON s.student_id = u.id
        WHERE s.assignment_id = $1
        ORDER BY s.submitted_at DESC
    `, [req.params.id]);
    // Derive a workflow status for each submission:
    //   RESUBMISSION_REQUIRED → instructor sent it back, grade was cleared
    //   GRADED               → marks + feedback assigned
    //   LATE                 → submitted after the deadline (not yet graded)
    //   SUBMITTED            → awaiting grading
    const statusOf = (s) => {
        if (s.resubmission_requested) return 'RESUBMISSION_REQUIRED';
        if (s.marks !== null && s.marks !== undefined) return 'GRADED';
        if (s.due_date && new Date(s.submitted_at) > new Date(s.due_date)) return 'LATE';
        return 'SUBMITTED';
    };
    res.json(result.rows.map(s => ({
        ...s,
        status: statusOf(s),
        studentName: s.student_name,
        studentEmail: s.student_email,
        studentAvatar: s.student_avatar,
        submittedAt: s.submitted_at,
        gradedAt: s.graded_at,
    })));
};

// POST /api/assignments/:id/submit — student submits their work
const submit = async (req, res) => {
    const { fileUrl, comments } = req.body;
    const studentId = req.user.id;

    // Only enrolled students may submit to this assignment's course.
    const assign = await query('SELECT course_id, allow_resubmit FROM assignments WHERE id = $1', [req.params.id]);
    if (!assign.rows.length) throw createError('Assignment not found', 404);
    const enrolled = await query(
        'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [studentId, assign.rows[0].course_id]
    );
    if (!enrolled.rows.length) throw createError('Not enrolled in this course', 403);

    // Check if already submitted
    const existing = await query(
        'SELECT id, resubmission_requested FROM submissions WHERE assignment_id = $1 AND student_id = $2',
        [req.params.id, studentId]
    );
    if (existing.rows.length) {
        // Resubmission: only allowed when the instructor enabled it (or the
        // submission was explicitly sent back for revision). Otherwise reject.
        if (!assign.rows[0].allow_resubmit && !existing.rows[0].resubmission_requested) {
            throw createError('Already submitted. Resubmission is not allowed for this assignment.', 409);
        }
        const resubmitted = await query(`
            UPDATE submissions
            SET file_url = $1, comments = $2, submitted_at = NOW(),
                marks = NULL, feedback = NULL, graded_by = NULL, graded_at = NULL,
                resubmission_requested = false
            WHERE id = $3 AND assignment_id = $4 AND student_id = $5
            RETURNING *
        `, [fileUrl || '', comments || '', existing.rows[0].id, req.params.id, studentId]);
        return res.json(resubmitted.rows[0]);
    }

    const result = await query(`
        INSERT INTO submissions (assignment_id, student_id, file_url, comments)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [req.params.id, studentId, fileUrl || '', comments || '']);
    res.status(201).json(result.rows[0]);
};

// PUT /api/assignments/submissions/:id/grade — instructor/admin grades a
// submission, or sends it back for revision (requestResubmission → grade is
// cleared, status becomes RESUBMISSION_REQUIRED until the student resubmits).
const grade = async (req, res) => {
    await assertChildEditable(req, { sql: submissionToCourseSql, id: req.params.id, notFound: 'Submission not found' });
    const { marks, feedback, requestResubmission } = req.body;
    if (requestResubmission) {
        const result = await query(`
            UPDATE submissions
            SET marks = NULL, feedback = $1, graded_by = $2, graded_at = NULL,
                resubmission_requested = true
            WHERE id = $3
            RETURNING *
        `, [feedback || '', req.user.id, req.params.id]);
        if (!result.rows.length) throw createError('Submission not found', 404);
        const sub = result.rows[0];
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [sub.student_id, `↩️ Your assignment was sent back for revision: ${feedback || 'please resubmit'}`, 'grade', `/assignments/${sub.assignment_id}`]
        ).catch(() => {});
        return res.json({ ...result.rows[0], resubmissionRequested: true });
    }
    if (marks === undefined || marks === null) throw createError('Marks are required', 400);

    const result = await query(`
        UPDATE submissions
        SET marks = $1, feedback = $2, graded_by = $3, graded_at = NOW(),
            resubmission_requested = false
        WHERE id = $4
        RETURNING *
    `, [marks, feedback || '', req.user.id, req.params.id]);
    if (!result.rows.length) throw createError('Submission not found', 404);

    // Notify student
    const sub = result.rows[0];
    await query(
        `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
        [sub.student_id, `📝 Your assignment has been graded: ${marks}/${sub.max_marks || ''} marks`, 'grade', `/assignments/${sub.assignment_id}`]
    ).catch(() => {});

    res.json(result.rows[0]);
};

// ─── RUBRIC CRITERIA ─────────────────────────────────────────────────────────

// GET /api/assignments/:id/rubric — get rubric criteria for an assignment
const getRubric = async (req, res) => {
    await assertChildEditable(req, { sql: assignmentToCourseSql, id: req.params.id, notFound: 'Assignment not found' });
    const result = await query(`
        SELECT * FROM rubric_criteria WHERE assignment_id = $1 ORDER BY "order" ASC
    `, [req.params.id]);
    res.json(result.rows);
};

// PUT /api/assignments/:id/rubric — save full rubric (replace all criteria)
const saveRubric = async (req, res) => {
    await assertChildEditable(req, { sql: assignmentToCourseSql, id: req.params.id, notFound: 'Assignment not found' });
    const { criteria } = req.body;
    if (!Array.isArray(criteria)) throw createError('criteria must be an array', 400);

    await query('DELETE FROM rubric_criteria WHERE assignment_id = $1', [req.params.id]);

    for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i];
        if (!c.name || !c.maxScore) throw createError(`Criteria ${i + 1}: name and maxScore required`, 400);
        await query(
            `INSERT INTO rubric_criteria (assignment_id, criterion_name, max_score, description, "order")
             VALUES ($1, $2, $3, $4, $5)`,
            [req.params.id, c.name, c.maxScore, c.description || '', i + 1]
        );
    }

    await query('UPDATE assignments SET rubric_enabled = true WHERE id = $1', [req.params.id]);
    res.json({ success: true });
};

// GET /api/assignments/submissions/:id/rubric-scores — get rubric scores for a submission
const getRubricScores = async (req, res) => {
    await assertChildEditable(req, { sql: submissionToCourseSql, id: req.params.id, notFound: 'Submission not found' });
    const result = await query(`
        SELECT rs.*, rc.criterion_name, rc.max_score
        FROM rubric_scores rs
        JOIN rubric_criteria rc ON rs.criterion_id = rc.id
        WHERE rs.submission_id = $1
    `, [req.params.id]);
    res.json(result.rows);
};

// PUT /api/assignments/submissions/:id/rubric-scores — save rubric scores for a submission
const saveRubricScores = async (req, res) => {
    await assertChildEditable(req, { sql: submissionToCourseSql, id: req.params.id, notFound: 'Submission not found' });
    const { scores } = req.body;
    if (!Array.isArray(scores)) throw createError('scores must be an array', 400);

    // Delete existing scores
    await query('DELETE FROM rubric_scores WHERE submission_id = $1', [req.params.id]);

    let totalScore = 0;
    for (const s of scores) {
        if (!s.criterionId || s.score === undefined) continue;
        await query(
            `INSERT INTO rubric_scores (submission_id, criterion_id, score, comment)
             VALUES ($1, $2, $3, $4)`,
            [req.params.id, s.criterionId, s.score, s.comment || '']
        );
        totalScore += Number(s.score);
    }

    // Auto-grade: set the total marks on the submission
    await query(
        `UPDATE submissions SET marks = $1, graded_by = $2, graded_at = NOW() WHERE id = $3`,
        [totalScore, req.user.id, req.params.id]
    );

    res.json({ success: true, totalScore });
};

// ─── PLAGIARISM CHECK ─────────────────────────────────────────────────────────

// GET /api/assignments/:id/plagiarism — compare all submissions for similarity
const checkPlagiarism = async (req, res) => {
    await assertChildEditable(req, { sql: assignmentToCourseSql, id: req.params.id, notFound: 'Assignment not found' });
    const subs = await query(
        `SELECT s.id, s.student_id, u.name as student_name, s.comments
         FROM submissions s JOIN users u ON s.student_id = u.id
         WHERE s.assignment_id = $1 AND s.comments != ''
         ORDER BY u.name`,
        [req.params.id]
    );

    const results = [];
    for (let i = 0; i < subs.rows.length; i++) {
        for (let j = i + 1; j < subs.rows.length; j++) {
            const a = subs.rows[i].comments || '';
            const b = subs.rows[j].comments || '';
            if (!a || !b) continue;

            // Simple cosine similarity on word frequency vectors
            const wordsA = a.toLowerCase().split(/\W+/).filter(Boolean);
            const wordsB = b.toLowerCase().split(/\W+/).filter(Boolean);
            const allWords = [...new Set([...wordsA, ...wordsB])];

            const vecA = allWords.map(w => wordsA.filter(x => x === w).length);
            const vecB = allWords.map(w => wordsB.filter(x => x === w).length);

            const dot = vecA.reduce((sum, v, idx) => sum + v * vecB[idx], 0);
            const magA = Math.sqrt(vecA.reduce((sum, v) => sum + v * v, 0));
            const magB = Math.sqrt(vecB.reduce((sum, v) => sum + v * v, 0));

            const similarity = magA && magB ? dot / (magA * magB) : 0;

            if (similarity > 0.3) { // Only report > 30% similarity
                results.push({
                    student1: { id: subs.rows[i].student_id, name: subs.rows[i].student_name },
                    student2: { id: subs.rows[j].student_id, name: subs.rows[j].student_name },
                    similarity: Math.round(similarity * 100),
                    flagged: similarity > 0.7,
                });
            }
        }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    res.json(results);
};

module.exports = { getByCourse, create, update, remove, getMyAssignments, getStudentOverview, getSubmissions, submit, grade, getRubric, saveRubric, getRubricScores, saveRubricScores, checkPlagiarism };
