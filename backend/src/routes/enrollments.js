const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { asyncHandler } = require('../middleware/errorHandler');
const { importLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/enrollmentsController');

// In-memory upload for CSV/XLSX enrollment import (parsed, never written to disk).
const uploadSheet = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/student/:studentId', authenticate, asyncHandler(ctrl.getByStudent));
router.get('/course/:courseId', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getCourseStudents));
// Any authenticated user may enroll in a published course — the controller
// enforces department isolation via req.user.department_id, so a department-
// scoped admin (or instructor) gets full access to their own department's
// courses, and SUPER_ADMIN (no department) is unrestricted.
router.post('/', authenticate, authorize('STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.enroll));
router.put('/progress', authenticate, authorize('STUDENT'), asyncHandler(ctrl.updateProgress));
router.get('/stats/:instructorId', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getStats));
router.post('/bulk', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('enrollment.manage'), asyncHandler(ctrl.bulkEnroll));
router.post('/unenroll', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('enrollment.manage'), asyncHandler(ctrl.bulkUnenroll));

// Bulk enrollment import — validate → preview → confirm (mirrors user/course imports)
router.get('/import/template', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('enrollment.manage'), asyncHandler(ctrl.downloadEnrollmentTemplate));
router.post('/import/preview', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('enrollment.manage'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.previewEnrollmentImport));
router.post('/import', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('enrollment.manage'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.importEnrollments));

module.exports = router;
