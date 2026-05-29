const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/statsController');

router.get('/public', asyncHandler(ctrl.getPublicStats));
router.get('/platform', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getPlatform));
router.get('/instructor/:instructorId', authenticate, asyncHandler(ctrl.getInstructor));
router.get('/audit-logs', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAuditLogs));
router.get('/student/streak', authenticate, authorize('STUDENT'), asyncHandler(ctrl.getStudentStreak));
router.get('/categories', asyncHandler(ctrl.getCategories));
router.post('/categories', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createCategory));
router.put('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateCategory));
router.delete('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteCategory));
router.get('/system-health', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getSystemHealth));

module.exports = router;
