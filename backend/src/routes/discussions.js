const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/discussionsController');

// Questions
router.get('/course/:courseId', authenticate, asyncHandler(ctrl.getQuestions));
router.post('/questions', authenticate, asyncHandler(ctrl.createQuestion));
router.delete('/questions/:id', authenticate, asyncHandler(ctrl.deleteQuestion));

// Answers
router.get('/questions/:id/answers', authenticate, asyncHandler(ctrl.getAnswers));
router.post('/questions/:id/answers', authenticate, asyncHandler(ctrl.createAnswer));
router.delete('/answers/:id', authenticate, asyncHandler(ctrl.deleteAnswer));
router.post('/answers/:id/upvote', authenticate, asyncHandler(ctrl.toggleUpvote));
router.put('/answers/:id/best-answer', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.markBestAnswer));

module.exports = router;
