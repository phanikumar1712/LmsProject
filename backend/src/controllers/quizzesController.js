const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapQuizAttempt } = require('../utils/formatters');

// GET /api/quizzes/course/:courseId
const getByCourse = async (req, res) => {
    const result = await query(
        'SELECT * FROM quizzes WHERE course_id = $1 ORDER BY created_at ASC',
        [req.params.courseId]
    );
    res.json(result.rows.map(r => ({
        ...r,
        courseId: r.course_id,
        lessonId: r.lesson_id,
        passingScore: r.passing_score,
        timeLimit: r.time_limit,
        instructions: r.description
    })));
};

// GET /api/quizzes/:id (can be quiz id or lesson id)
const getById = async (req, res) => {
    const { id } = req.params;
    const result = await query(
        'SELECT * FROM quizzes WHERE id = $1 OR lesson_id = $1',
        [id]
    );
    if (!result.rows.length) throw createError('Quiz not found', 404);
    const r = result.rows[0];
    res.json({
        ...r,
        courseId: r.course_id,
        lessonId: r.lesson_id,
        passingScore: r.passing_score,
        timeLimit: r.time_limit,
        instructions: r.description
    });
};

// POST /api/quizzes
const createQuiz = async (req, res) => {
    const { courseId, lessonId, title, instructions = '', description = '', passingScore = 70, timeLimit = 30, questions = [] } = req.body;
    if (!courseId || !title) throw createError('courseId and title are required', 400);

    let result;
    if (lessonId) {
        // Try to update existing if lessonId matches
        result = await query(
            `INSERT INTO quizzes (course_id, lesson_id, title, description, passing_score, time_limit, questions)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (lesson_id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                passing_score = EXCLUDED.passing_score,
                time_limit = EXCLUDED.time_limit,
                questions = EXCLUDED.questions
             RETURNING *`,
            [courseId, lessonId, title, instructions || description, passingScore, timeLimit, JSON.stringify(questions)]
        );
    } else {
        result = await query(
            `INSERT INTO quizzes (course_id, title, description, passing_score, time_limit, questions)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [courseId, title, instructions || description, passingScore, timeLimit, JSON.stringify(questions)]
        );
    }
    res.status(201).json(result.rows[0]);
};

// POST /api/quizzes/:id/attempt
const submitAttempt = async (req, res) => {
    const { id } = req.params;
    const { answers, violations = 0, timeTaken = 0 } = req.body;
    const quizResult = await query(
        'SELECT * FROM quizzes WHERE id = $1 OR lesson_id = $1',
        [id]
    );
    if (!quizResult.rows.length) throw createError('Quiz not found', 404);

    const quiz = quizResult.rows[0];
    const questions = quiz.questions || [];

    let correctCount = 0;
    const results = questions.map((q, idx) => {
        const answer = answers[idx];
        const isCorrect = answer !== undefined && answer !== null &&
            String(answer).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim();
        if (isCorrect) correctCount++;
        return { questionId: q.id, correct: isCorrect, correctAnswer: q.correctAnswer };
    });

    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const passed = score >= quiz.passing_score;

    const attempt = await query(
        `INSERT INTO quiz_attempts (quiz_id, student_id, score, passed, violations, time_taken, results)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [quiz.id, req.user.id, score, passed, violations, timeTaken, JSON.stringify(results)]
    );

    // Track active learning for streak
    const { updateStreak } = require('../utils/streak');
    await updateStreak(req.user.id).catch(() => { });

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'QUIZ_ATTEMPTED', 'quizzes', quiz.id]
    ).catch(() => { });

    res.status(201).json({ ...mapQuizAttempt(attempt.rows[0]), results });
};

// GET /api/quizzes/attempts/:studentId
const getAttempts = async (req, res) => {
    const studentId = req.params.studentId || req.user.id;
    const result = await query(`
        SELECT qa.*, q.title as quiz_title, q.passing_score, c.id as course_id, c.title as course_title
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN courses c ON q.course_id = c.id
        WHERE qa.student_id = $1
        ORDER BY qa.completed_at DESC
    `, [studentId]);

    res.json(result.rows.map(mapQuizAttempt));
};

module.exports = { getByCourse, getById, createQuiz, submitAttempt, getAttempts };
