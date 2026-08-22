const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { importLimiter } = require('../middleware/rateLimiter');
const uploadSheet = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/statsController');

router.get('/public', asyncHandler(ctrl.getPublicStats));
router.get('/platform', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('reports.view'), asyncHandler(ctrl.getPlatform));
router.get('/instructor/:instructorId', authenticate, asyncHandler(ctrl.getInstructor));
// Audit trail: SUPER_ADMIN sees all; a department-scoped ADMIN sees only their
// department's entries (scoping enforced in the controller).
router.get('/audit-logs', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('audit.view'), asyncHandler(ctrl.getAuditLogs));
router.get('/audit-logs/actions', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('audit.view'), asyncHandler(ctrl.getAuditLogActions));
// Department admins see only their own department's usage vs limits (scoped in
// the controller); SUPER_ADMIN sees all departments.
router.get('/admins', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAdminOverview));
router.get('/admin/dashboard', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getDeptAdminDashboard));
router.get('/student/streak', authenticate, authorize('STUDENT'), asyncHandler(ctrl.getStudentStreak));
router.get('/students/progress', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getStudentProgress));
router.get('/categories', optionalAuth, asyncHandler(ctrl.getCategories));
router.get('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getCategoryDetail));
router.post('/categories', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('category.manage'), asyncHandler(ctrl.createCategory));
router.put('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('category.manage'), asyncHandler(ctrl.updateCategory));
router.put('/categories/:id/courses', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('category.manage'), asyncHandler(ctrl.assignCourseToCategory));
router.delete('/categories/:id/courses/:courseId', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('category.manage'), asyncHandler(ctrl.removeCourseFromCategory));
router.delete('/categories/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('category.manage'), asyncHandler(ctrl.deleteCategory));
router.post('/categories/import', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('category.manage'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.importCategories));
router.get('/departments', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getDepartmentsStats));
router.get('/reports/attendance', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getAttendanceReport));
router.get('/reports/assignments', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getAssignmentsReport));
router.get('/reports/quizzes', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getQuizReport));
router.get('/reports/certificates', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getCertificateReport));
router.get('/system-health', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getSystemHealth));
router.get('/ai-report', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getAiReport));
router.get('/settings', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getPlatformSettings));
router.put('/settings', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.updatePlatformSettings));

router.get('/academic-sessions', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAcademicSessions));
router.post('/academic-sessions', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createAcademicSession));
router.put('/academic-sessions/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateAcademicSession));
router.delete('/academic-sessions/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteAcademicSession));

module.exports = router;
