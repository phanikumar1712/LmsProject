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
