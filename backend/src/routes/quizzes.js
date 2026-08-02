const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/quizzesController');

router.get('/course/:courseId', authenticate, asyncHandler(ctrl.getByCourse));
router.get('/attempts/:studentId', authenticate, asyncHandler(ctrl.getAttempts));
router.get('/instructor/:instructorId', authenticate, asyncHandler(ctrl.getInstructorQuizzes));
router.get('/available', authenticate, asyncHandler(ctrl.getAvailableExams));
router.get('/:id/performance', authenticate, asyncHandler(ctrl.getQuizPerformance));
router.get('/:id/attempts/:studentId', authenticate, asyncHandler(ctrl.getStudentAttemptDetails));
router.get('/:id', authenticate, asyncHandler(ctrl.getById));
router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createQuiz));
router.post('/:id/start', authenticate, authorize('STUDENT', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.startAttempt));
router.post('/:id/attempt', authenticate, authorize('STUDENT', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.submitAttempt));
router.post('/:id/remind', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.remindStudents));

module.exports = router;
