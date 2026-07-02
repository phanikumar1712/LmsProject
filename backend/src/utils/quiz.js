const { createError } = require('../middleware/errorHandler');

const QUESTION_TYPES = new Set(['MCQ', 'MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'FILL_BLANK']);
const PLAN_RANK = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 };

const cleanText = (value, field, maxLength) => {
    if (typeof value !== 'string' || !value.trim()) throw createError(`${field} is required`, 400);
    const text = value.trim();
    if (text.length > maxLength) throw createError(`${field} is too long`, 400);
    return text;
};

const normalizeOptionAnswer = (answer, options, field) => {
    if (Number.isInteger(answer) && answer >= 0 && answer < options.length) return options[answer];
    if (typeof answer === 'string' && options.includes(answer)) return answer;
    throw createError(`${field} must reference a valid option`, 400);
};

const validateQuestions = (questions) => {
    if (!Array.isArray(questions) || questions.length < 1 || questions.length > 200) {
        throw createError('questions must contain between 1 and 200 items', 400);
    }

    const ids = new Set();
    return questions.map((question, index) => {
        if (!question || typeof question !== 'object' || Array.isArray(question)) {
            throw createError(`Question ${index + 1} is invalid`, 400);
        }
        const id = cleanText(String(question.id || ''), `Question ${index + 1} id`, 100);
        if (!/^[A-Za-z0-9_-]+$/.test(id)) {
            throw createError(`Question ${index + 1} id contains invalid characters`, 400);
        }
        if (ids.has(id)) throw createError('Question IDs must be unique', 400);
        ids.add(id);

        const type = String(question.type || '').toUpperCase();
        if (!QUESTION_TYPES.has(type)) throw createError(`Question ${index + 1} has an unsupported type`, 400);
        const text = cleanText(question.text, `Question ${index + 1} text`, 2000);
        const normalized = { id, type, text, options: [] };

        if (['MCQ', 'MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'].includes(type)) {
            if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 20) {
                throw createError(`Question ${index + 1} must have between 2 and 20 options`, 400);
            }
            normalized.options = question.options.map((option, optionIndex) =>
                cleanText(option, `Question ${index + 1} option ${optionIndex + 1}`, 500));
            if (new Set(normalized.options).size !== normalized.options.length) {
                throw createError(`Question ${index + 1} options must be unique`, 400);
            }
        }

        if (type === 'MCQ_MULTI') {
            if (!Array.isArray(question.correctAnswer) || !question.correctAnswer.length) {
                throw createError(`Question ${index + 1} requires at least one correct option`, 400);
            }
            normalized.correctAnswer = [...new Set(question.correctAnswer.map(answer =>
                normalizeOptionAnswer(answer, normalized.options, `Question ${index + 1} correctAnswer`)))].sort();
        } else if (type === 'FILL_BLANK') {
            normalized.correctAnswer = cleanText(question.correctAnswer, `Question ${index + 1} correctAnswer`, 500);
        } else {
            normalized.correctAnswer = normalizeOptionAnswer(
                question.correctAnswer, normalized.options, `Question ${index + 1} correctAnswer`);
        }
        return normalized;
    });
};

const validateQuizPayload = (body) => {
    const passingScore = Number(body.passingScore ?? 70);
    const timeLimit = Number(body.timeLimit ?? 30);
    if (!Number.isInteger(passingScore) || passingScore < 0 || passingScore > 100) {
        throw createError('passingScore must be an integer from 0 to 100', 400);
    }
    if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 180) {
        throw createError('timeLimit must be an integer from 1 to 180 minutes', 400);
    }
    return {
        title: cleanText(body.title, 'title', 255),
        description: typeof (body.instructions || body.description) === 'string'
            ? (body.instructions || body.description).trim().slice(0, 5000)
            : '',
        passingScore,
        timeLimit,
        questions: validateQuestions(body.questions),
    };
};

const stripAnswers = (questions = []) => questions.map(({ correctAnswer, ...question }) => question);

const serializeQuiz = (quiz, { includeQuestions = true, includeAnswers = false } = {}) => ({
    id: quiz.id,
    courseId: quiz.course_id,
    lessonId: quiz.lesson_id,
    title: quiz.title,
    description: quiz.description,
    instructions: quiz.description,
    passingScore: quiz.passing_score,
    timeLimit: quiz.time_limit,
    questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
    ...(includeQuestions && {
        questions: includeAnswers ? (quiz.questions || []) : stripAnswers(quiz.questions || []),
    }),
});

const hasRequiredPlan = (user, requiredPlan) => {
    let currentPlan = String(user.subscription_plan || 'FREE').toUpperCase();
    if (currentPlan !== 'FREE' && user.subscription_expiry) {
        const expiry = new Date(user.subscription_expiry);
        expiry.setHours(23, 59, 59, 999);
        if (expiry < new Date()) currentPlan = 'FREE';
    }
    return (PLAN_RANK[currentPlan] ?? 0) >= (PLAN_RANK[String(requiredPlan || 'FREE').toUpperCase()] ?? 0);
};

const answersMatch = (question, answer) => {
    if (answer === undefined || answer === null) return false;
    if (question.type === 'MCQ_MULTI') {
        if (!Array.isArray(answer) || answer.length > 20 || answer.some(value => typeof value !== 'string' || value.length > 500)) {
            return false;
        }
        const actual = [...new Set(answer.map(String))].sort();
        const expected = [...question.correctAnswer].map(String).sort();
        return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
    }
    if (typeof answer !== 'string' || answer.length > 500) return false;
    return String(answer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
};

module.exports = { validateQuizPayload, serializeQuiz, hasRequiredPlan, answersMatch };
