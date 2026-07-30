const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/quizzesController');

router.get('/course/:courseId', authenticate, asyncHandler(ctrl.getByCourse));
router.get('/attempts/:studentId', authenticate, asyncHandler(ctrl.getAttempts));
router.get('/:id', authenticate, asyncHandler(ctrl.getById));
router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createQuiz));
router.post('/:id/start', authenticate, authorize('STUDENT', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.startAttempt));
router.post('/:id/attempt', authenticate, authorize('STUDENT', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.submitAttempt));

module.exports = router;
