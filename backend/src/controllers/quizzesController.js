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

    // Department isolation: a student may only access assessments of courses
    // whose department matches their own (course → category → department).
    if (user.department_id) {
        const deptRes = await query(
            `SELECT cat.department_id AS "departmentId"
             FROM courses c
             LEFT JOIN categories cat ON c.category_id = cat.id
             WHERE c.id = $1`,
            [courseId]
        );
        const courseDeptId = deptRes.rows[0]?.departmentId || null;
        if (courseDeptId && courseDeptId !== user.department_id) {
            throw createError('This assessment is not available in your department', 403);
        }
    }

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
        payload.timeLimit, payload.maxAttempts, JSON.stringify(payload.questions),
        payload.selectionConfig ? JSON.stringify(payload.selectionConfig) : null];
    const result = lessonId
        ? await query(`
            INSERT INTO quizzes (course_id, lesson_id, title, description, passing_score, time_limit, max_attempts, questions, selection_config)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (lesson_id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                passing_score = EXCLUDED.passing_score,
                time_limit = EXCLUDED.time_limit,
                max_attempts = EXCLUDED.max_attempts,
                questions = EXCLUDED.questions,
                selection_config = EXCLUDED.selection_config
            WHERE quizzes.course_id = EXCLUDED.course_id
            RETURNING *, xmax
        `, values)
        : await query(`
            INSERT INTO quizzes (course_id, lesson_id, title, description, passing_score, time_limit, max_attempts, questions, selection_config)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *, xmax
        `, values);

    if (!result.rows.length) throw createError('Quiz course mismatch', 409);

    // ── Notify enrolled students that a new assessment is available ──────────
    // Only notify when a brand-new quiz row was inserted (xmax = '0'); re-saving
    // an existing lesson-linked quiz must not spam students with duplicates.
    const quizRow = result.rows[0];
    const isFreshInsert = String(quizRow.xmax ?? '0') === '0';
    if (isFreshInsert) {
        await query(`
            INSERT INTO notifications (user_id, message, type, link)
            SELECT e.student_id, $1, 'quiz', $2
            FROM enrollments e
            WHERE e.course_id = $3
        `, [
            `📝 New assessment available: ${quizRow.title}`,
            `/courses/${courseId}/quiz/${quizRow.id}`,
            courseId,
        ]).catch(() => { });
    }

    res.status(201).json(serializeQuiz(result.rows[0], { includeAnswers: true }));
};

// GET /api/quizzes/instructor/:instructorId — assessments created by an instructor
// with aggregate attempt stats (attempts, students, avg score, pass rate).
const getInstructorQuizzes = async (req, res) => {
    const instructorId = requireUuid(req.params.instructorId, 'instructorId');
    if (req.user.role === 'INSTRUCTOR' && instructorId !== req.user.id) throw createError('Forbidden', 403);

    const result = await query(`
        SELECT q.id, q.title, q.description, q.passing_score, q.time_limit, q.max_attempts, q.created_at,
               c.id AS course_id, c.title AS course_title, c.thumbnail AS course_thumbnail,
               jsonb_array_length(q.questions)::int AS question_count,
               (SELECT COUNT(*)::int FROM quiz_attempts qa WHERE qa.quiz_id = q.id) AS attempt_count,
               (SELECT COUNT(DISTINCT qa.student_id)::int FROM quiz_attempts qa WHERE qa.quiz_id = q.id) AS student_count,
               (SELECT COALESCE(ROUND(AVG(qa.score)), 0)::int FROM quiz_attempts qa WHERE qa.quiz_id = q.id) AS avg_score,
               (SELECT COUNT(*)::int FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.passed) AS passed_count
        FROM quizzes q
        JOIN courses c ON c.id = q.course_id
        WHERE c.instructor_id = $1
        ORDER BY q.created_at DESC
    `, [instructorId]);

    res.json(result.rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        passingScore: r.passing_score,
        timeLimit: r.time_limit,
        maxAttempts: r.max_attempts ?? 0,
        createdAt: r.created_at,
        courseId: r.course_id,
        courseTitle: r.course_title,
        courseThumbnail: r.course_thumbnail,
        questionCount: r.question_count,
        attemptCount: r.attempt_count,
        studentCount: r.student_count,
        avgScore: r.avg_score,
        passedCount: r.passed_count,
        passRate: r.attempt_count > 0 ? Math.round((r.passed_count / r.attempt_count) * 100) : 0,
    })));
};

// GET /api/quizzes/:id/performance — per-student ranking & performance for one assessment.
// Instructors see every student's best attempt, ordered by score then time.
const getQuizPerformance = async (req, res) => {
    const quiz = await loadQuiz(req.params.id);
    const course = await query('SELECT instructor_id FROM courses WHERE id = $1', [quiz.course_id]);
    if (!course.rows.length) throw createError('Course not found', 404);
    if (!isAdmin(req.user) && course.rows[0].instructor_id !== req.user.id) {
        throw createError('Forbidden', 403);
    }

    const [summary, attempts] = await Promise.all([
        query(`
            SELECT COUNT(DISTINCT student_id)::int AS participants,
                   COUNT(*)::int AS total_attempts,
                   COALESCE(ROUND(AVG(score)), 0)::int AS avg_score,
                   COALESCE(MAX(score), 0)::int AS highest_score,
                   COUNT(*) FILTER (WHERE passed)::int AS passed_count
            FROM quiz_attempts WHERE quiz_id = $1
        `, [quiz.id]),
        query(`
            SELECT DISTINCT ON (qa.student_id)
                qa.student_id, u.name, u.avatar, u.roll_no,
                qa.score, qa.passed, qa.time_taken, qa.violations, qa.completed_at,
                (SELECT COUNT(*)::int FROM quiz_attempts qa2
                 WHERE qa2.quiz_id = qa.quiz_id AND qa2.student_id = qa.student_id) AS attempts
            FROM quiz_attempts qa
            JOIN users u ON u.id = qa.student_id
            WHERE qa.quiz_id = $1
            ORDER BY qa.student_id, qa.score DESC, qa.time_taken ASC
        `, [quiz.id]),
    ]);

    // Rank by best score desc, then time taken asc
    const ranked = attempts.rows
        .sort((a, b) => b.score - a.score || a.time_taken - b.time_taken)
        .map((r, i) => ({
            rank: i + 1,
            studentId: r.student_id,
            name: r.name,
            avatar: r.avatar,
            rollNo: r.roll_no,
            score: r.score,
            passed: r.passed,
            timeTaken: r.time_taken,
            violations: r.violations,
            attempts: r.attempts,
            completedAt: r.completed_at,
        }));

    // ── Category & difficulty score breakdown ──────────────────────────────
    // Aggregate per-question results across ALL attempts (not just the best
    // one per student) so instructors see where students struggle: for each
    // question in the bank we count correct vs total answers, then group by
    // the question's category and difficulty.
    const allAttempts = await query(
        'SELECT results FROM quiz_attempts WHERE quiz_id = $1',
        [quiz.id]
    );
    const bank = Array.isArray(quiz.questions) ? quiz.questions : [];
    const byId = new Map(bank.map(q => [q.id, q]));
    const catAgg = {}; // category -> { total, correct }
    const diffAgg = { EASY: { total: 0, correct: 0 }, MEDIUM: { total: 0, correct: 0 }, HARD: { total: 0, correct: 0 } };

    for (const row of allAttempts.rows) {
        const results = Array.isArray(row.results) ? row.results : [];
        for (const r of results) {
            const q = byId.get(r.questionId);
            if (!q) continue;
            const cat = q.category || 'Uncategorized';
            if (!catAgg[cat]) catAgg[cat] = { total: 0, correct: 0 };
            catAgg[cat].total++;
            if (r.correct) catAgg[cat].correct++;
            const diff = diffAgg[q.difficulty] ? q.difficulty : 'MEDIUM';
            diffAgg[diff].total++;
            if (r.correct) diffAgg[diff].correct++;
        }
    }

    const pct = (agg) => (agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0);
    const breakdown = {
        byCategory: Object.entries(catAgg)
            .map(([category, agg]) => ({ category, total: agg.total, correct: agg.correct, accuracy: pct(agg) }))
            .sort((a, b) => b.total - a.total),
        byDifficulty: Object.entries(diffAgg).map(([difficulty, agg]) => ({
            difficulty,
            total: agg.total,
            correct: agg.correct,
            accuracy: pct(agg),
        })),
    };

    res.json({
        quiz: {
            id: quiz.id,
            title: quiz.title,
            passingScore: quiz.passing_score,
            timeLimit: quiz.time_limit,
            maxAttempts: quiz.max_attempts ?? 0,
            questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
        },
        summary: {
            participants: summary.rows[0].participants,
            totalAttempts: summary.rows[0].total_attempts,
            avgScore: summary.rows[0].avg_score,
            highestScore: summary.rows[0].highest_score,
            passRate: summary.rows[0].total_attempts > 0
                ? Math.round((summary.rows[0].passed_count / summary.rows[0].total_attempts) * 100)
                : 0,
        },
        ranking: ranked,
        breakdown,
    });
};

// GET /api/quizzes/available — assessments the student can take (from enrolled
// published courses). Lightweight list without question details.
const getAvailableExams = async (req, res) => {
    if (req.user.role !== 'STUDENT' && !isAdmin(req.user)) throw createError('Forbidden', 403);
    const studentId = req.user.role === 'STUDENT' ? req.user.id : (req.query.studentId || req.user.id);

    const result = await query(`
        SELECT q.id, q.title, q.description, q.passing_score, q.time_limit, q.max_attempts, q.created_at,
               c.id AS course_id, c.title AS course_title, c.thumbnail AS course_thumbnail,
               jsonb_array_length(q.questions)::int AS question_count,
               (SELECT COUNT(*)::int FROM quiz_attempts qa
                WHERE qa.quiz_id = q.id AND qa.student_id = $1) AS attempts_used,
               (SELECT MAX(qa.score) FROM quiz_attempts qa
                WHERE qa.quiz_id = q.id AND qa.student_id = $1) AS best_score
        FROM quizzes q
        JOIN courses c ON c.id = q.course_id
        JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
        LEFT JOIN categories cat ON c.category_id = cat.id
        WHERE c.status = 'PUBLISHED'
        -- Department isolation: students only see exams from their own
        -- department's courses (course → category → department). Courses with
        -- no category (no department) remain visible to everyone.
        ${req.user.department_id ? `AND (cat.department_id IS NULL OR cat.department_id = $2)` : ''}
        ORDER BY q.created_at DESC
    `, req.user.department_id ? [studentId, req.user.department_id] : [studentId]);

    res.json(result.rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        passingScore: r.passing_score,
        timeLimit: r.time_limit,
        maxAttempts: r.max_attempts ?? 0,
        attemptsUsed: r.attempts_used ?? 0,
        attemptsLeft: r.max_attempts > 0 ? Math.max(0, r.max_attempts - (r.attempts_used ?? 0)) : null,
        createdAt: r.created_at,
        courseId: r.course_id,
        courseTitle: r.course_title,
        courseThumbnail: r.course_thumbnail,
        questionCount: r.question_count,
        attempted: (r.attempts_used ?? 0) > 0,
        bestScore: r.best_score,
    })));
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

    // Draw this attempt's questions per the quiz's selection config and pin
    // them to the session so grading uses exactly what was served. This is pure
    // in-memory work, so it happens outside the locked transaction below.
    const drawn = drawQuestions(quiz.questions || [], quiz.selection_config);
    if (!drawn.length) throw createError('This quiz has no questions available', 409);

    // The active-session lookup + cap checks + session INSERT run inside a
    // transaction guarded by a per-quiz-per-student advisory lock (the same key
    // submitAttempt uses). This serializes concurrent starts from the same
    // student so the count-then-insert can never exceed the configured cap:
    // without the lock, two racing requests could both read count < maxAttempts
    // and both insert, each returning a fresh attempt.
    const client = await getClient();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${quiz.id}:${req.user.id}`]);

        // Re-check inside the lock: a previously started session may have been
        // created by a concurrent request that won the lock first.
        const active = await client.query(`
            SELECT id, expires_at, question_ids FROM quiz_attempt_sessions
            WHERE quiz_id = $1 AND student_id = $2 AND submitted_at IS NULL AND expires_at > NOW()
            ORDER BY started_at DESC LIMIT 1
        `, [quiz.id, req.user.id]);
        if (active.rows.length) {
            const pinned = active.rows[0].question_ids;
            await client.query('COMMIT');
            return res.json({
                attemptId: active.rows[0].id,
                expiresAt: active.rows[0].expires_at,
                quiz: serializeQuiz(quiz, pinned ? { questionOverride: questionsForIds(pinned) } : {}),
            });
        }

        // Enforce the instructor-configured overall attempt cap (0 = unlimited).
        // Counts completed quiz_attempts, so an in-progress session can be resumed
        // without consuming a slot.
        const maxAttempts = quiz.max_attempts ?? 0;
        if (maxAttempts > 0) {
            const used = await client.query(
                'SELECT COUNT(*)::int AS count FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2',
                [quiz.id, req.user.id]
            );
            if (used.rows[0].count >= maxAttempts) {
                throw createError(
                    `You have used all ${maxAttempts} allowed attempt${maxAttempts > 1 ? 's' : ''} for this assessment`,
                    403
                );
            }
        }

        // Legacy anti-abuse daily cap only applies when the instructor hasn't set an
        // explicit overall limit — an instructor-configured maxAttempts is authoritative.
        if (!(maxAttempts > 0)) {
            const recent = await client.query(`
                SELECT COUNT(*)::int AS count FROM quiz_attempt_sessions
                WHERE quiz_id = $1 AND student_id = $2 AND started_at >= NOW() - INTERVAL '24 hours'
            `, [quiz.id, req.user.id]);
            if (recent.rows[0].count >= MAX_ATTEMPTS_PER_DAY) {
                throw createError(`Maximum ${MAX_ATTEMPTS_PER_DAY} attempts allowed per 24 hours`, 429);
            }
        }

        const session = await client.query(`
            INSERT INTO quiz_attempt_sessions (quiz_id, student_id, expires_at, question_ids)
            VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'), $4)
            RETURNING id, expires_at
        `, [quiz.id, req.user.id, quiz.time_limit, drawn.map(q => q.id)]);
        await client.query('COMMIT');

        res.status(201).json({
            attemptId: session.rows[0].id,
            expiresAt: session.rows[0].expires_at,
            quiz: serializeQuiz(quiz, { questionOverride: drawn }),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
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

        // Same daily-cap rule as startAttempt: skipped when the instructor has
        // configured an explicit overall attempt limit.
        const maxAttempts = quiz.max_attempts ?? 0;
        if (!(maxAttempts > 0)) {
            const recent = await client.query(`
                SELECT COUNT(*)::int AS count FROM quiz_attempts
                WHERE quiz_id = $1 AND student_id = $2 AND completed_at >= NOW() - INTERVAL '24 hours'
            `, [quiz.id, req.user.id]);
            if (recent.rows[0].count >= MAX_ATTEMPTS_PER_DAY) {
                throw createError(`Maximum ${MAX_ATTEMPTS_PER_DAY} attempts allowed per 24 hours`, 429);
            }
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
            INSERT INTO quiz_attempts (quiz_id, student_id, score, passed, violations, time_taken, results, answers)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [quiz.id, req.user.id, score, passed, violations, elapsedSeconds, JSON.stringify(results), JSON.stringify(answers)]);
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

// GET /api/quizzes/:id/attempts/:studentId — per-question breakdown of one
// student's attempts on one assessment (instructor/admin only).
const getStudentAttemptDetails = async (req, res) => {
    const quiz = await loadQuiz(req.params.id);
    const course = await query('SELECT instructor_id FROM courses WHERE id = $1', [quiz.course_id]);
    if (!course.rows.length) throw createError('Course not found', 404);
    if (!isAdmin(req.user) && course.rows[0].instructor_id !== req.user.id) {
        throw createError('Forbidden', 403);
    }
    const studentId = requireUuid(req.params.studentId, 'studentId');

    const [student, attempts] = await Promise.all([
        query('SELECT id, name, email, avatar, roll_no FROM users WHERE id = $1', [studentId]),
        query(`
            SELECT id, score, passed, violations, time_taken, results, answers, completed_at
            FROM quiz_attempts
            WHERE quiz_id = $1 AND student_id = $2
            ORDER BY completed_at DESC
        `, [quiz.id, studentId]),
    ]);
    if (!student.rows.length) throw createError('Student not found', 404);

    const bank = Array.isArray(quiz.questions) ? quiz.questions : [];
    const byId = new Map(bank.map(q => [q.id, q]));

    const detail = attempts.rows.map(a => {
        const results = Array.isArray(a.results) ? a.results : [];
        const answers = (a.answers && typeof a.answers === 'object' && !Array.isArray(a.answers)) ? a.answers : {};
        const questions = results.map(r => {
            const q = byId.get(r.questionId) || null;
            return {
                questionId: r.questionId,
                correct: r.correct,
                text: q ? q.text : '(question removed)',
                type: q ? q.type : 'MCQ_SINGLE',
                category: q ? (q.category || '') : '',
                difficulty: q ? (q.difficulty || 'MEDIUM') : 'MEDIUM',
                options: q ? (q.options || []) : [],
                correctAnswer: q ? (q.correctAnswer ?? null) : null,
                givenAnswer: Object.prototype.hasOwnProperty.call(answers, r.questionId)
                    ? answers[r.questionId]
                    : null,
            };
        });
        return {
            attemptId: a.id,
            score: a.score,
            passed: a.passed,
            violations: a.violations,
            timeTaken: a.time_taken,
            completedAt: a.completed_at,
            questions,
        };
    });

    res.json({
        quiz: { id: quiz.id, title: quiz.title, passingScore: quiz.passing_score },
        student: {
            id: student.rows[0].id,
            name: student.rows[0].name,
            email: student.rows[0].email,
            avatar: student.rows[0].avatar,
            rollNo: student.rows[0].roll_no,
        },
        attempts: detail,
    });
};

// POST /api/quizzes/:id/remind — send a re-take reminder (or custom message)
// to enrolled students of this assessment. Instructor/admin only.
// Body: { studentId?: uuid, message?: string }
//   - studentId present → remind just that student
//   - otherwise → remind all enrolled students of the quiz's course
const remindStudents = async (req, res) => {
    const quiz = await loadQuiz(req.params.id);
    const course = await query('SELECT instructor_id FROM courses WHERE id = $1', [quiz.course_id]);
    if (!course.rows.length) throw createError('Course not found', 404);
    if (!isAdmin(req.user) && course.rows[0].instructor_id !== req.user.id) {
        throw createError('Forbidden', 403);
    }

    const { studentId, message } = req.body || {};
    if (studentId) requireUuid(studentId, 'studentId');
    const custom = typeof message === 'string' && message.trim()
        ? message.trim().slice(0, 500)
        : `⏰ Reminder: "${quiz.title}" is waiting for you. Take it before time runs out!`;

    const link = `/courses/${quiz.course_id}/quiz/${quiz.id}`;

    let targetIds;
    if (studentId) {
        const student = await query('SELECT id FROM users WHERE id = $1 AND role = $2 AND active = true', [studentId, 'STUDENT']);
        if (!student.rows.length) throw createError('Student not found', 404);
        targetIds = [studentId];
    } else {
        const enrolled = await query(
            `SELECT DISTINCT e.student_id AS id
             FROM enrollments e
             JOIN users u ON u.id = e.student_id
             WHERE e.course_id = $1 AND u.active = true`,
            [quiz.course_id]
        );
        targetIds = enrolled.rows.map(r => r.id);
    }

    for (const id of targetIds) {
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, 'quiz', $3)`,
            [id, custom, link]
        ).catch(() => { });
    }

    await query(
        'INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)',
        [req.user.id, 'QUIZ_REMINDER_SENT', 'quizzes', quiz.id, JSON.stringify({ students: targetIds.length, custom: Boolean(custom) })]
    ).catch(() => { });

    res.json({ success: true, notified: targetIds.length, message: custom });
};

module.exports = { getByCourse, getById, createQuiz, startAttempt, submitAttempt, getAttempts, getInstructorQuizzes, getQuizPerformance, getAvailableExams, getStudentAttemptDetails, remindStudents };
