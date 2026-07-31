const { query, getClient } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapQuizAttempt } = require('../utils/formatters');
const { validateQuizPayload, serializeQuiz, answersMatch, drawQuestions } = require('../utils/quiz');

const MAX_ATTEMPTS_PER_DAY = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isAdmin = (user) => ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

const requireUuid = (value, field = 'id') => {
    if (!UUID_PATTERN.test(String(value || ''))) throw createError(`Invalid ${field}`, 400);
    return value;
};

const loadCourse = async (courseId) => {
    requireUuid(courseId, 'courseId');
    const result = await query(
        'SELECT id, instructor_id, status FROM courses WHERE id = $1',
        [courseId]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    return result.rows[0];
};

const loadQuiz = async (id) => {
    requireUuid(id, 'quiz id');
    const result = await query(`
        SELECT q.*, c.instructor_id, c.status AS course_status
        FROM quizzes q
        JOIN courses c ON c.id = q.course_id
        WHERE q.id = $1 OR q.lesson_id = $1
    `, [id]);
    if (!result.rows.length) throw createError('Quiz not found', 404);
    return result.rows[0];
};

const assertCourseAccess = async (course, user) => {
    if (isAdmin(user)) return 'EDITOR';
    if (user.role === 'INSTRUCTOR') {
        if (course.instructor_id !== user.id) throw createError('Not your course', 403);
        return 'EDITOR';
    }
    if (user.role !== 'STUDENT') throw createError('Forbidden', 403);
    if (course.status !== 'PUBLISHED' && course.course_status !== 'PUBLISHED') {
        throw createError('Course is not published', 403);
    }
    const courseId = course.course_id || course.id;
    const enrollment = await query(
        'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [user.id, courseId]
    );
    if (!enrollment.rows.length) throw createError('You must be enrolled in this course', 403);
    return 'STUDENT';
};

// GET /api/quizzes/course/:courseId
const getByCourse = async (req, res) => {
    const course = await loadCourse(req.params.courseId);
    const access = await assertCourseAccess(course, req.user);
    const result = await query(
        'SELECT * FROM quizzes WHERE course_id = $1 ORDER BY created_at ASC',
        [course.id]
    );
    res.json(result.rows.map(quiz => serializeQuiz(quiz, {
        includeQuestions: access === 'EDITOR',
        includeAnswers: access === 'EDITOR',
    })));
};

// GET /api/quizzes/:id (can be quiz id or lesson id)
const getById = async (req, res) => {
    const quiz = await loadQuiz(req.params.id);
    const access = await assertCourseAccess({ ...quiz, id: quiz.course_id }, req.user);
    res.json(serializeQuiz(quiz, {
        includeQuestions: access === 'EDITOR',
        includeAnswers: access === 'EDITOR',
    }));
};

// POST /api/quizzes
const createQuiz = async (req, res) => {
    const courseId = requireUuid(req.body.courseId, 'courseId');
    const lessonId = req.body.lessonId ? requireUuid(req.body.lessonId, 'lessonId') : null;
    const course = await loadCourse(courseId);
    await assertCourseAccess(course, req.user);
    const payload = validateQuizPayload(req.body);

    if (lessonId) {
        const lesson = await query('SELECT course_id, type FROM lessons WHERE id = $1', [lessonId]);
        if (!lesson.rows.length || lesson.rows[0].course_id !== courseId) {
            throw createError('Lesson does not belong to this course', 400);
        }
        if (lesson.rows[0].type !== 'quiz') throw createError('Lesson is not a quiz lesson', 400);
    }

    const values = [courseId, lessonId, payload.title, payload.description, payload.passingScore,
        payload.timeLimit, JSON.stringify(payload.questions),
        payload.selectionConfig ? JSON.stringify(payload.selectionConfig) : null];
    const result = lessonId
        ? await query(`
            INSERT INTO quizzes (course_id, lesson_id, title, description, passing_score, time_limit, questions, selection_config)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (lesson_id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                passing_score = EXCLUDED.passing_score,
                time_limit = EXCLUDED.time_limit,
                questions = EXCLUDED.questions,
                selection_config = EXCLUDED.selection_config
            WHERE quizzes.course_id = EXCLUDED.course_id
            RETURNING *
        `, values)
        : await query(`
            INSERT INTO quizzes (course_id, lesson_id, title, description, passing_score, time_limit, questions, selection_config)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, values);

    if (!result.rows.length) throw createError('Quiz course mismatch', 409);
    res.status(201).json(serializeQuiz(result.rows[0], { includeAnswers: true }));
};

// POST /api/quizzes/:id/start
const startAttempt = async (req, res) => {
    const quiz = await loadQuiz(req.params.id);
    await assertCourseAccess({ ...quiz, id: quiz.course_id }, req.user);

    // Reconstruct the exact question set pinned to a session (order preserved)
    const questionsForIds = (ids) => {
        const byId = new Map((quiz.questions || []).map(q => [q.id, q]));
        return (ids || []).map(qid => byId.get(qid)).filter(Boolean);
    };

    const active = await query(`
        SELECT id, expires_at, question_ids FROM quiz_attempt_sessions
        WHERE quiz_id = $1 AND student_id = $2 AND submitted_at IS NULL AND expires_at > NOW()
        ORDER BY started_at DESC LIMIT 1
    `, [quiz.id, req.user.id]);
    if (active.rows.length) {
        const pinned = active.rows[0].question_ids;
        return res.json({
            attemptId: active.rows[0].id,
            expiresAt: active.rows[0].expires_at,
            quiz: serializeQuiz(quiz, pinned ? { questionOverride: questionsForIds(pinned) } : {}),
        });
    }

    const recent = await query(`
        SELECT COUNT(*)::int AS count FROM quiz_attempt_sessions
        WHERE quiz_id = $1 AND student_id = $2 AND started_at >= NOW() - INTERVAL '24 hours'
    `, [quiz.id, req.user.id]);
    if (recent.rows[0].count >= MAX_ATTEMPTS_PER_DAY) {
        throw createError(`Maximum ${MAX_ATTEMPTS_PER_DAY} attempts allowed per 24 hours`, 429);
    }

    // Draw this attempt's questions per the quiz's selection config and pin
    // them to the session so grading uses exactly what was served.
    const drawn = drawQuestions(quiz.questions || [], quiz.selection_config);
    if (!drawn.length) throw createError('This quiz has no questions available', 409);

    const session = await query(`
        INSERT INTO quiz_attempt_sessions (quiz_id, student_id, expires_at, question_ids)
        VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'), $4)
        RETURNING id, expires_at
    `, [quiz.id, req.user.id, quiz.time_limit, drawn.map(q => q.id)]);
    res.status(201).json({
        attemptId: session.rows[0].id,
        expiresAt: session.rows[0].expires_at,
        quiz: serializeQuiz(quiz, { questionOverride: drawn }),
    });
};

// POST /api/quizzes/:id/attempt
const submitAttempt = async (req, res) => {
    const quiz = await loadQuiz(req.params.id);
    await assertCourseAccess({ ...quiz, id: quiz.course_id }, req.user);
    const attemptId = requireUuid(req.body.attemptId, 'attemptId');
    const answers = req.body.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        throw createError('answers must be an object keyed by question ID', 400);
    }
    if (Object.keys(answers).length > quiz.questions.length) throw createError('Too many answers supplied', 400);
    const violations = Number.isInteger(req.body.violations)
        ? Math.max(0, Math.min(req.body.violations, 3))
        : 0;

    const client = await getClient();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${quiz.id}:${req.user.id}`]);
        const session = await client.query(`
            SELECT * FROM quiz_attempt_sessions
            WHERE id = $1 AND quiz_id = $2 AND student_id = $3
            FOR UPDATE
        `, [attemptId, quiz.id, req.user.id]);
        if (!session.rows.length) throw createError('Invalid quiz attempt', 403);
        if (session.rows[0].submitted_at) throw createError('Quiz attempt already submitted', 409);
        if (new Date(session.rows[0].expires_at).getTime() < Date.now()) throw createError('Quiz time limit expired', 409);

        // Grade against the exact question set pinned to this session (question
        // banks serve a subset per attempt); legacy sessions fall back to all.
        const pinnedIds = session.rows[0].question_ids;
        const attemptQuestions = pinnedIds
            ? (() => {
                const byId = new Map(quiz.questions.map(q => [q.id, q]));
                return pinnedIds.map(qid => byId.get(qid)).filter(Boolean);
            })()
            : quiz.questions;
        if (Object.keys(answers).length > attemptQuestions.length) throw createError('Too many answers supplied', 400);

        const recent = await client.query(`
            SELECT COUNT(*)::int AS count FROM quiz_attempts
            WHERE quiz_id = $1 AND student_id = $2 AND completed_at >= NOW() - INTERVAL '24 hours'
        `, [quiz.id, req.user.id]);
        if (recent.rows[0].count >= MAX_ATTEMPTS_PER_DAY) {
            throw createError(`Maximum ${MAX_ATTEMPTS_PER_DAY} attempts allowed per 24 hours`, 429);
        }

        let correctCount = 0;
        const results = attemptQuestions.map(question => {
            const answer = Object.prototype.hasOwnProperty.call(answers, question.id)
                ? answers[question.id]
                : undefined;
            const correct = answersMatch(question, answer);
            if (correct) correctCount++;
            return { questionId: question.id, correct };
        });
        const score = attemptQuestions.length ? Math.round((correctCount / attemptQuestions.length) * 100) : 0;
        const passed = score >= quiz.passing_score;
        const elapsedSeconds = Math.max(0, Math.round(
            (Date.now() - new Date(session.rows[0].started_at).getTime()) / 1000
        ));

        const attempt = await client.query(`
            INSERT INTO quiz_attempts (quiz_id, student_id, score, passed, violations, time_taken, results)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
        `, [quiz.id, req.user.id, score, passed, violations, elapsedSeconds, JSON.stringify(results)]);
        await client.query('UPDATE quiz_attempt_sessions SET submitted_at = NOW() WHERE id = $1', [attemptId]);
        await client.query('COMMIT');

        const { updateStreak } = require('../utils/streak');
        await updateStreak(req.user.id).catch(() => { });
        await query(
            'INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)',
            [req.user.id, 'QUIZ_ATTEMPTED', 'quizzes', quiz.id]
        ).catch(() => { });

        const safeAttempt = { ...attempt.rows[0] };
        delete safeAttempt.results;
        res.status(201).json(mapQuizAttempt(safeAttempt));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// GET /api/quizzes/attempts/:studentId
const getAttempts = async (req, res) => {
    const studentId = requireUuid(req.params.studentId, 'studentId');
    if (req.user.role === 'STUDENT' && studentId !== req.user.id) throw createError('Forbidden', 403);

    const values = [studentId];
    let ownershipFilter = '';
    if (req.user.role === 'INSTRUCTOR') {
        values.push(req.user.id);
        ownershipFilter = 'AND c.instructor_id = $2';
    } else if (!isAdmin(req.user) && req.user.role !== 'STUDENT') {
        throw createError('Forbidden', 403);
    }

    const result = await query(`
        SELECT qa.id, qa.quiz_id, qa.student_id, qa.score, qa.passed, qa.violations,
               qa.time_taken, qa.completed_at, q.title AS quiz_title, q.passing_score,
               c.id AS course_id, c.title AS course_title
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN courses c ON q.course_id = c.id
        WHERE qa.student_id = $1 ${ownershipFilter}
        ORDER BY qa.completed_at DESC
    `, values);
    res.json(result.rows.map(mapQuizAttempt));
};

module.exports = { getByCourse, getById, createQuiz, startAttempt, submitAttempt, getAttempts };
