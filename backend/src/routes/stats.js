const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { importLimiter } = require('../middleware/rateLimiter');
const uploadSheet = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/statsController');

router.get('/public', asyncHandler(ctrl.getPublicStats));
router.get('/platform', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getPlatform));
router.get('/instructor/:instructorId', authenticate, asyncHandler(ctrl.getInstructor));
router.get('/audit-logs', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAuditLogs));
// Department admins see only their own department's usage vs limits (scoped in
// the controller); SUPER_ADMIN sees all departments.
router.get('/admins', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAdminOverview));
router.get('/student/streak', authenticate, authorize('STUDENT'), asyncHandler(ctrl.getStudentStreak));
router.get('/students/progress', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getStudentProgress));
router.get('/categories', optionalAuth, asyncHandler(ctrl.getCategories));
router.get('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getCategoryDetail));
router.post('/categories', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createCategory));
router.put('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateCategory));
router.put('/categories/:id/courses', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.assignCourseToCategory));
router.delete('/categories/:id/courses/:courseId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.removeCourseFromCategory));
router.delete('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteCategory));
router.post('/categories/import', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.importCategories));
router.get('/departments', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getDepartmentsStats));
router.get('/system-health', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getSystemHealth));
router.get('/ai-report', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getAiReport));
router.get('/settings', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getPlatformSettings));
router.put('/settings', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.updatePlatformSettings));

router.get('/academic-sessions', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAcademicSessions));
router.post('/academic-sessions', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createAcademicSession));
router.put('/academic-sessions/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateAcademicSession));
router.delete('/academic-sessions/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteAcademicSession));

module.exports = router;
