const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { importLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/coursesController');

// In-memory upload for CSV/XLSX course import (parsed, never written to disk).
const uploadSheet = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public routes
router.get('/', optionalAuth, asyncHandler(ctrl.getAll));
router.get('/instructor/:instructorId', authenticate, asyncHandler(ctrl.getByInstructor));
router.get('/:id', asyncHandler(ctrl.getById));
router.get('/:id/lessons', optionalAuth, asyncHandler(ctrl.getLessons));

// Instructor + Admin routes — Admins can edit/delete courses within their own
// department (enforced by assertCourseInScope in the controller).
// Super Admin has platform-wide override. Granular permissions gate each action.
router.post('/', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.create'), asyncHandler(ctrl.create));
router.put('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.update));
router.delete('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.delete'), asyncHandler(ctrl.deleteCourse));
router.post('/:id/sections', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.createSection));
router.put('/:id/sections/reorder', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.reorderSections));
router.put('/sections/:id/lessons/reorder', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.reorderLessons));
router.put('/sections/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.updateSection));
router.delete('/sections/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.deleteSection));
router.post('/:id/lessons', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.createLesson));
router.put('/lessons/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.updateLesson));
router.put('/lessons/:id/move', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.moveLesson));
router.delete('/lessons/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.deleteLesson));

// Admin bulk import routes
router.get('/import/template', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('course.create'), asyncHandler(ctrl.downloadCourseTemplate));
router.post('/import', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('course.create'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.importCourses));
router.post('/import/preview', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('course.create'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.previewCourseImport));

// Admin routes — moderation gated by course.approve
router.put('/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('course.approve'), asyncHandler(ctrl.approve));
router.put('/:id/reject', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('course.approve'), asyncHandler(ctrl.reject));
router.put('/:id/publish', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('course.approve'), asyncHandler(ctrl.publish));
router.put('/:id/unpublish', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('course.approve'), asyncHandler(ctrl.unpublish));
router.put('/:id/instructor', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.assignInstructor));

// Course bucket (semester/year) assignments — many-to-many copy-to-multiple.
router.post('/:id/buckets', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.addBuckets));
router.delete('/:id/buckets', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('course.update'), asyncHandler(ctrl.removeBuckets));

module.exports = router;
