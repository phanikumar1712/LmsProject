const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validateQuizPayload,
    serializeQuiz,
    answersMatch,
} = require('../src/utils/quiz');

test('normalizes option indexes and multi-select answers when authoring', () => {
    const quiz = validateQuizPayload({
        title: 'Security basics',
        passingScore: 80,
        timeLimit: 15,
        questions: [
            { id: 'q1', type: 'MCQ_SINGLE', text: 'Choose B', options: ['A', 'B'], correctAnswer: 1 },
            { id: 'q2', type: 'MCQ_MULTI', text: 'Choose both', options: ['A', 'B'], correctAnswer: [1, 0] },
        ],
    });

    assert.equal(quiz.questions[0].correctAnswer, 'B');
    assert.deepEqual(quiz.questions[1].correctAnswer, ['A', 'B']);
});

test('rejects invalid passing scores and unsupported question types', () => {
    assert.throws(() => validateQuizPayload({
        title: 'Invalid',
        passingScore: -1,
        questions: [{ id: 'q1', type: 'LONG_ANSWER', text: 'No', correctAnswer: 'x' }],
    }), /passingScore/);

    assert.throws(() => validateQuizPayload({
        title: 'Invalid',
        questions: [{ id: 'q1', type: 'LONG_ANSWER', text: 'No', correctAnswer: 'x' }],
    }), /unsupported type/);
});

test('student serialization never includes answer keys', () => {
    const serialized = serializeQuiz({
        id: 'quiz-id',
        course_id: 'course-id',
        title: 'Quiz',
        description: '',
        passing_score: 70,
        time_limit: 30,
        questions: [{ id: 'q1', type: 'FILL_BLANK', text: 'Answer', options: [], correctAnswer: 'secret' }],
    });

    assert.equal(serialized.questions[0].correctAnswer, undefined);
    assert.equal(JSON.stringify(serialized).includes('secret'), false);
});

test('multi-select grading is order independent and rejects extra choices', () => {
    const question = { type: 'MCQ_MULTI', correctAnswer: ['A', 'B'] };
    assert.equal(answersMatch(question, ['B', 'A']), true);
    assert.equal(answersMatch(question, ['A', 'B', 'C']), false);
});

test('multi-select grading rejects extra choices beyond correct set', () => {
    const question = { type: 'MCQ_MULTI', correctAnswer: ['A', 'B'] };
    assert.equal(answersMatch(question, ['B', 'A']), true);
    assert.equal(answersMatch(question, ['A', 'B', 'C']), false);
});

test('maxAttempts defaults to 0 (unlimited) and accepts explicit valid limits', () => {
    const base = (overrides = {}) => validateQuizPayload({
        title: 'Attempts',
        questions: [{ id: 'q1', type: 'MCQ_SINGLE', text: 'Pick', options: ['A', 'B'], correctAnswer: 'A' }],
        ...overrides,
    });

    // Omitted → 0 (unlimited)
    assert.equal(base().maxAttempts, 0);
    // Explicit 0 → unlimited
    assert.equal(base({ maxAttempts: 0 }).maxAttempts, 0);
    // Explicit limits are preserved
    assert.equal(base({ maxAttempts: 1 }).maxAttempts, 1);
    assert.equal(base({ maxAttempts: 3 }).maxAttempts, 3);
    assert.equal(base({ maxAttempts: 100 }).maxAttempts, 100);
});

test('maxAttempts rejects negative, oversized, and non-integer values', () => {
    const base = (overrides = {}) => validateQuizPayload({
        title: 'Attempts',
        questions: [{ id: 'q1', type: 'MCQ_SINGLE', text: 'Pick', options: ['A', 'B'], correctAnswer: 'A' }],
        ...overrides,
    });

    assert.throws(() => base({ maxAttempts: -1 }), /maxAttempts/);
    assert.throws(() => base({ maxAttempts: 101 }), /maxAttempts/);
    assert.throws(() => base({ maxAttempts: 1.5 }), /maxAttempts/);
    assert.throws(() => base({ maxAttempts: 'three' }), /maxAttempts/);
});

test('serializeQuiz exposes maxAttempts and falls back to 0 for legacy quizzes', () => {
    const withLimit = serializeQuiz({
        id: 'quiz-id',
        course_id: 'course-id',
        title: 'Quiz',
        description: '',
        passing_score: 70,
        time_limit: 30,
        max_attempts: 3,
        questions: [],
    });
    assert.equal(withLimit.maxAttempts, 3);

    // Legacy rows (no max_attempts column value) → 0 = unlimited
    const legacy = serializeQuiz({
        id: 'quiz-id',
        course_id: 'course-id',
        title: 'Quiz',
        description: '',
        passing_score: 70,
        time_limit: 30,
        questions: [],
    });
    assert.equal(legacy.maxAttempts, 0);
});
