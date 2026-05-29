const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/enrollmentsController');

router.get('/student/:studentId', authenticate, asyncHandler(ctrl.getByStudent));
router.post('/', authenticate, authorize('STUDENT'), asyncHandler(ctrl.enroll));
router.put('/progress', authenticate, authorize('STUDENT'), asyncHandler(ctrl.updateProgress));
router.get('/stats/:instructorId', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getStats));

module.exports = router;
