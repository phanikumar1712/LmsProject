const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/quizzesController');

router.get('/course/:courseId', authenticate, asyncHandler(ctrl.getByCourse));
router.get('/attempts/:studentId', authenticate, asyncHandler(ctrl.getAttempts));
router.get('/instructor/:instructorId', authenticate, asyncHandler(ctrl.getInstructorQuizzes));
router.get('/available', authenticate, asyncHandler(ctrl.getAvailableExams));
router.get('/:id/performance', authenticate, asyncHandler(ctrl.getQuizPerformance));
router.get('/:id/attempts/:studentId', authenticate, asyncHandler(ctrl.getStudentAttemptDetails));
router.get('/:id', authenticate, asyncHandler(ctrl.getById));
router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('quiz.create'), asyncHandler(ctrl.createQuiz));
router.post('/:id/start', authenticate, authorize('STUDENT', 'ADMIN', 'SUPER_ADMIN'), requirePermission('quiz.attempt'), asyncHandler(ctrl.startAttempt));
router.post('/:id/attempt', authenticate, authorize('STUDENT', 'ADMIN', 'SUPER_ADMIN'), requirePermission('quiz.attempt'), asyncHandler(ctrl.submitAttempt));
router.post('/:id/remind', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('quiz.create'), asyncHandler(ctrl.remindStudents));

module.exports = router;
