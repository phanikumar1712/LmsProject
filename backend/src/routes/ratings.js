const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/ratingsController');

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAll));
router.get('/instructor/:instructorId', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getByInstructor));
router.get('/course/:courseId', asyncHandler(ctrl.getByCourse));
router.get('/my/:courseId', authenticate, authorize('STUDENT'), asyncHandler(ctrl.getMyRating));
router.get('/student/:studentId', authenticate, asyncHandler(ctrl.getByStudent));
router.post('/', authenticate, authorize('STUDENT'), asyncHandler(ctrl.create));
router.put('/:id/reply', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.replyToReview));
router.put('/:id/like', authenticate, asyncHandler(ctrl.likeReview));
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteRating));

module.exports = router;
