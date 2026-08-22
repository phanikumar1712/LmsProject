const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');

// Weighted grade model per the product spec:
//   Assignments 20% · Quizzes 20% · Mid Exam 20% · Final Exam 40%
const WEIGHTS = { assignments: 0.2, quizzes: 0.2, midExam: 0.2, finalExam: 0.4 };

// GET /api/grades/my — the student's per-course grades with the weighted
// breakdown. Components without any data are omitted and the weights are
// renormalized over the components that do exist, so the total stays honest
// (e.g. a course with only assignments+quizzes reports their average).
const getMyGrades = async (req, res) => {
    if (req.user.role !== 'STUDENT') throw createError('Forbidden', 403);
    const studentId = req.user.id;

    const result = await query(`
        SELECT
            c.id AS course_id,
            c.title AS course_title,
            COALESCE(u.name, '') AS instructor_name,
            (
                SELECT COALESCE(AVG(s.marks::numeric / NULLIF(a.max_marks, 0) * 100), NULL)
                FROM submissions s
                JOIN assignments a ON a.id = s.assignment_id
                WHERE a.course_id = c.id AND s.student_id = $1 AND s.marks IS NOT NULL
            ) AS assignments_pct,
            (
                SELECT COALESCE(AVG(qa.score), NULL)
                FROM quiz_attempts qa
                JOIN quizzes q ON q.id = qa.quiz_id
                WHERE q.course_id = c.id AND qa.student_id = $1
                  AND (q.exam_kind IS NULL OR q.exam_kind = '')
            ) AS quizzes_pct,
            (
                SELECT COALESCE(AVG(qa.score), NULL)
                FROM quiz_attempts qa
                JOIN quizzes q ON q.id = qa.quiz_id
                WHERE q.course_id = c.id AND qa.student_id = $1 AND q.exam_kind = 'mid'
            ) AS mid_pct,
            (
                SELECT COALESCE(AVG(qa.score), NULL)
                FROM quiz_attempts qa
                JOIN quizzes q ON q.id = qa.quiz_id
                WHERE q.course_id = c.id AND qa.student_id = $1 AND q.exam_kind = 'final'
            ) AS final_pct
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        LEFT JOIN users u ON u.id = c.instructor_id
        WHERE e.student_id = $1
        ORDER BY c.title ASC
    `, [studentId]);

    const grades = result.rows.map(r => {
        const components = [
            { key: 'assignments', label: 'Assignments', weight: WEIGHTS.assignments, pct: r.assignments_pct },
            { key: 'quizzes', label: 'Quizzes', weight: WEIGHTS.quizzes, pct: r.quizzes_pct },
            { key: 'midExam', label: 'Mid Exam', weight: WEIGHTS.midExam, pct: r.mid_pct },
            { key: 'finalExam', label: 'Final Exam', weight: WEIGHTS.finalExam, pct: r.final_pct },
        ];
        const available = components.filter(c => c.pct !== null && c.pct !== undefined);
        const weightSum = available.reduce((sum, c) => sum + c.weight, 0);
        const total = available.length && weightSum > 0
            ? Math.round(available.reduce((sum, c) => sum + Number(c.pct) * (c.weight / weightSum), 0))
            : null;

        return {
            courseId: r.course_id,
            courseTitle: r.course_title,
            instructorName: r.instructor_name,
            components: available.map(c => ({
                key: c.key,
                label: c.label,
                weight: Math.round(c.weight * 100),
                pct: Math.round(Number(c.pct)),
            })),
            total,
        };
    });

    res.json(grades);
};

module.exports = { getMyGrades };
