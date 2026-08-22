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

test('SHORT_ANSWER and TRUE_FALSE authoring are accepted and normalized', () => {
    const quiz = validateQuizPayload({
        title: 'Mixed types',
        questions: [
            { id: 'q1', type: 'SHORT_ANSWER', text: 'What is 2+2?', correctAnswer: 'four' },
            { id: 'q2', type: 'TRUE_FALSE', text: 'The sky is blue', options: ['True', 'False'], correctAnswer: 0 },
        ],
    });
    assert.equal(quiz.questions[0].type, 'SHORT_ANSWER');
    assert.equal(quiz.questions[0].correctAnswer, 'four');
    assert.equal(quiz.questions[1].type, 'TRUE_FALSE');
    assert.equal(quiz.questions[1].correctAnswer, 'True');
});

test('SHORT_ANSWER grading is case-insensitive and accepts alternative spellings', () => {
    const q = { type: 'SHORT_ANSWER', correctAnswer: 'Array', options: ['Arrays'] };
    assert.equal(answersMatch(q, 'array'), true);
    assert.equal(answersMatch(q, '  ARRAY  '), true);
    assert.equal(answersMatch(q, 'Arrays'), true); // alternative accepted
    assert.equal(answersMatch(q, 'List'), false);
});

test('TRUE_FALSE grading matches the selected option text', () => {
    const q = { type: 'TRUE_FALSE', correctAnswer: 'False', options: ['True', 'False'] };
    assert.equal(answersMatch(q, 'False'), true);
    assert.equal(answersMatch(q, 'false'), true);
    assert.equal(answersMatch(q, 'True'), false);
});

test('negativeMarking defaults to 0 and accepts valid fractions', () => {
    const base = (overrides = {}) => validateQuizPayload({
        title: 'Neg',
        questions: [{ id: 'q1', type: 'MCQ_SINGLE', text: 'Pick', options: ['A', 'B'], correctAnswer: 'A' }],
        ...overrides,
    });
    assert.equal(base().negativeMarking, 0);
    assert.equal(base({ negativeMarking: 0.25 }).negativeMarking, 0.25);
    assert.equal(base({ negativeMarking: 1 }).negativeMarking, 1);
    assert.throws(() => base({ negativeMarking: -0.1 }), /negativeMarking/);
    assert.throws(() => base({ negativeMarking: 1.5 }), /negativeMarking/);
    assert.throws(() => base({ negativeMarking: 'half' }), /negativeMarking/);
});

test('startDate/endDate are validated and endDate must follow startDate', () => {
    const base = (overrides = {}) => validateQuizPayload({
        title: 'Window',
        questions: [{ id: 'q1', type: 'MCQ_SINGLE', text: 'Pick', options: ['A', 'B'], correctAnswer: 'A' }],
        ...overrides,
    });
    const quiz = base({ startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-30T00:00:00Z' });
    assert.equal(quiz.startDate.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.equal(quiz.endDate.toISOString(), '2026-09-30T00:00:00.000Z');
    assert.throws(() => base({ startDate: 'not-a-date' }), /startDate/);
    assert.throws(() => base({ endDate: '2026-10-01T00:00:00Z', startDate: '2026-11-01T00:00:00Z' }), /endDate/);
});

test('serializeQuiz exposes negativeMarking and the availability window', () => {
    const quiz = serializeQuiz({
        id: 'quiz-id',
        course_id: 'course-id',
        title: 'Quiz',
        description: '',
        passing_score: 70,
        time_limit: 30,
        negative_marking: 0.25,
        start_date: '2026-09-01T00:00:00.000Z',
        end_date: '2026-09-30T00:00:00.000Z',
        questions: [],
    });
    assert.equal(quiz.negativeMarking, 0.25);
    assert.equal(quiz.startDate, '2026-09-01T00:00:00.000Z');
    assert.equal(quiz.endDate, '2026-09-30T00:00:00.000Z');
});
