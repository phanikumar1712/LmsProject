const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');

// GET /api/assignments/course/:courseId
const getByCourse = async (req, res) => {
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
    const { courseId, lessonId, title, description, maxMarks = 100, dueDate, allowLate = false, fileRequired = true } = req.body;
    if (!courseId || !title || !dueDate) throw createError('courseId, title, and dueDate are required', 400);

    const result = await query(`
        INSERT INTO assignments (course_id, lesson_id, title, description, max_marks, due_date, allow_late, file_required)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `, [courseId, lessonId || null, title, description || '', maxMarks, dueDate, allowLate, fileRequired]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'ASSIGNMENT_CREATED', 'assignments', result.rows[0].id]
    ).catch(() => {});

    res.status(201).json(result.rows[0]);
};

// PUT /api/assignments/:id — update assignment
const update = async (req, res) => {
    const { title, description, maxMarks, dueDate, allowLate, fileRequired } = req.body;
    const result = await query(`
        UPDATE assignments
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            max_marks = COALESCE($3, max_marks),
            due_date = COALESCE($4, due_date),
            allow_late = COALESCE($5, allow_late),
            file_required = COALESCE($6, file_required),
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
    `, [title, description, maxMarks, dueDate, allowLate, fileRequired, req.params.id]);
    if (!result.rows.length) throw createError('Assignment not found', 404);
    res.json(result.rows[0]);
};

// DELETE /api/assignments/:id
const remove = async (req, res) => {
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

// GET /api/assignments/:id/submissions — get all submissions for an assignment
const getSubmissions = async (req, res) => {
    const result = await query(`
        SELECT s.*, u.name as student_name, u.email as student_email, u.avatar as student_avatar
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        WHERE s.assignment_id = $1
        ORDER BY s.submitted_at DESC
    `, [req.params.id]);
    res.json(result.rows.map(s => ({
        ...s,
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

    // Check if already submitted
    const existing = await query(
        'SELECT id FROM submissions WHERE assignment_id = $1 AND student_id = $2',
        [req.params.id, studentId]
    );
    if (existing.rows.length) throw createError('Already submitted. Use update to resubmit.', 409);

    const result = await query(`
        INSERT INTO submissions (assignment_id, student_id, file_url, comments)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [req.params.id, studentId, fileUrl || '', comments || '']);
    res.status(201).json(result.rows[0]);
};

// PUT /api/assignments/submissions/:id/grade — instructor/admin grades submission
const grade = async (req, res) => {
    const { marks, feedback } = req.body;
    if (marks === undefined || marks === null) throw createError('Marks are required', 400);

    const result = await query(`
        UPDATE submissions
        SET marks = $1, feedback = $2, graded_by = $3, graded_at = NOW()
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
    const result = await query(`
        SELECT * FROM rubric_criteria WHERE assignment_id = $1 ORDER BY "order" ASC
    `, [req.params.id]);
    res.json(result.rows);
};

// PUT /api/assignments/:id/rubric — save full rubric (replace all criteria)
const saveRubric = async (req, res) => {
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

module.exports = { getByCourse, create, update, remove, getSubmissions, submit, grade, getRubric, saveRubric, getRubricScores, saveRubricScores, checkPlagiarism };
