const { createError } = require('../middleware/errorHandler');

const QUESTION_TYPES = new Set(['MCQ', 'MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'FILL_BLANK']);
const DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);
const SELECTION_MODES = new Set(['ALL', 'RANDOM', 'BY_DIFFICULTY', 'BY_CATEGORY']);
const MAX_QUESTIONS = 500;

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
    if (!Array.isArray(questions) || questions.length < 1 || questions.length > MAX_QUESTIONS) {
        throw createError(`questions must contain between 1 and ${MAX_QUESTIONS} items`, 400);
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
        const difficulty = String(question.difficulty || 'MEDIUM').toUpperCase();
        if (!DIFFICULTIES.has(difficulty)) {
            throw createError(`Question ${index + 1} difficulty must be EASY, MEDIUM or HARD`, 400);
        }
        const category = question.category && typeof question.category === 'string'
            ? question.category.trim().slice(0, 100)
            : '';
        const normalized = { id, type, text, difficulty, category, options: [] };

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

// selection_config shapes:
//   { mode: 'ALL' }                                — every question, shuffled client-side
//   { mode: 'RANDOM', count: 20 }                  — N random questions from the whole bank
//   { mode: 'BY_DIFFICULTY', easy: 5, medium: 10, hard: 5 } — N random per difficulty
const validateSelectionConfig = (config, questions) => {
    if (config === undefined || config === null) return null;
    if (typeof config !== 'object' || Array.isArray(config)) {
        throw createError('selectionConfig must be an object', 400);
    }
    const mode = String(config.mode || 'ALL').toUpperCase();
    if (!SELECTION_MODES.has(mode)) throw createError('selectionConfig.mode must be ALL, RANDOM or BY_DIFFICULTY', 400);
    if (mode === 'ALL') return { mode };

    const toCount = (value, field, max) => {
        const n = Number(value ?? 0);
        if (!Number.isInteger(n) || n < 0 || n > max) {
            throw createError(`selectionConfig.${field} must be an integer from 0 to ${max}`, 400);
        }
        return n;
    };

    if (mode === 'RANDOM') {
        const count = toCount(config.count, 'count', questions.length);
        if (count < 1) throw createError('selectionConfig.count must be at least 1', 400);
        return { mode, count };
    }

    // BY_CATEGORY — choose N random questions from each category
    if (mode === 'BY_CATEGORY') {
        const cats = config.categories;
        if (!cats || typeof cats !== 'object' || Array.isArray(cats) || !Object.keys(cats).length) {
            throw createError('selectionConfig.categories must be an object with category names and counts', 400);
        }
        const available = {};
        questions.forEach(q => {
            const cat = q.category || 'Uncategorized';
            available[cat] = (available[cat] || 0) + 1;
        });
        const validated = {};
        let total = 0;
        for (const [catName, count] of Object.entries(cats)) {
            const n = toCount(count, `categories.${catName}`, MAX_QUESTIONS);
            if (n > 0) {
                const avail = available[catName] || 0;
                if (n > avail) throw createError(`Only ${avail} questions available in category "${catName}" (requested ${n})`, 400);
                validated[catName] = n;
                total += n;
            }
        }
        if (total < 1) throw createError('selectionConfig must request at least 1 question', 400);
        return { mode, categories: validated };
    }

    // BY_DIFFICULTY — each requested count must be available in the bank
    const available = { EASY: 0, MEDIUM: 0, HARD: 0 };
    questions.forEach(q => { available[q.difficulty] = (available[q.difficulty] || 0) + 1; });
    const easy = toCount(config.easy, 'easy', MAX_QUESTIONS);
    const medium = toCount(config.medium, 'medium', MAX_QUESTIONS);
    const hard = toCount(config.hard, 'hard', MAX_QUESTIONS);
    if (easy + medium + hard < 1) throw createError('selectionConfig must request at least 1 question', 400);
    if (easy > available.EASY) throw createError(`Only ${available.EASY} easy questions available (requested ${easy})`, 400);
    if (medium > available.MEDIUM) throw createError(`Only ${available.MEDIUM} medium questions available (requested ${medium})`, 400);
    if (hard > available.HARD) throw createError(`Only ${available.HARD} hard questions available (requested ${hard})`, 400);
    return { mode, easy, medium, hard };
};

// Fisher–Yates on a copy
const shuffle = (items) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// Draw the set of questions for one attempt according to selection_config.
const drawQuestions = (questions, config) => {
    const all = Array.isArray(questions) ? questions : [];
    if (!config || config.mode === 'ALL') return shuffle(all);
    if (config.mode === 'RANDOM') return shuffle(all).slice(0, Math.min(config.count, all.length));
    if (config.mode === 'BY_CATEGORY') {
        const byCat = {};
        all.forEach(q => {
            const cat = q.category || 'Uncategorized';
            if (!byCat[cat]) byCat[cat] = [];
            byCat[cat].push(q);
        });
        const drawn = [];
        for (const [cat, count] of Object.entries(config.categories || {})) {
            const pool = byCat[cat] || [];
            drawn.push(...shuffle(pool).slice(0, count));
        }
        return shuffle(drawn);
    }
    // BY_DIFFICULTY — clamp to what actually exists in case the bank shrank
    const byLevel = { EASY: [], MEDIUM: [], HARD: [] };
    all.forEach(q => (byLevel[q.difficulty || 'MEDIUM'] || byLevel.MEDIUM).push(q));
    return shuffle([
        ...shuffle(byLevel.EASY).slice(0, config.easy || 0),
        ...shuffle(byLevel.MEDIUM).slice(0, config.medium || 0),
        ...shuffle(byLevel.HARD).slice(0, config.hard || 0),
    ]);
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
    const questions = validateQuestions(body.questions);
    return {
        title: cleanText(body.title, 'title', 255),
        description: typeof (body.instructions || body.description) === 'string'
            ? (body.instructions || body.description).trim().slice(0, 5000)
            : '',
        passingScore,
        timeLimit,
        questions,
        selectionConfig: validateSelectionConfig(body.selectionConfig ?? body.selection_config, questions),
    };
};

const stripAnswers = (questions = []) => questions.map(({ correctAnswer, ...question }) => question);

const serializeQuiz = (quiz, { includeQuestions = true, includeAnswers = false, questionOverride = null } = {}) => {
    const sourceQuestions = questionOverride ?? quiz.questions ?? [];
    const config = quiz.selection_config || null;
    // Advertise the per-attempt question count, not the bank size
    let effectiveCount = Array.isArray(sourceQuestions) ? sourceQuestions.length : 0;
    if (!questionOverride && config) {
        if (config.mode === 'RANDOM') effectiveCount = Math.min(config.count, effectiveCount);
        else if (config.mode === 'BY_DIFFICULTY') effectiveCount = Math.min((config.easy || 0) + (config.medium || 0) + (config.hard || 0), effectiveCount);
    }
    return {
        id: quiz.id,
        courseId: quiz.course_id,
        lessonId: quiz.lesson_id,
        title: quiz.title,
        description: quiz.description,
        instructions: quiz.description,
        passingScore: quiz.passing_score,
        timeLimit: quiz.time_limit,
        selectionConfig: config,
        bankSize: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
        questionCount: effectiveCount,
        ...(includeQuestions && {
            questions: includeAnswers ? sourceQuestions : stripAnswers(sourceQuestions),
        }),
    };
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

module.exports = { validateQuizPayload, serializeQuiz, answersMatch, drawQuestions };
