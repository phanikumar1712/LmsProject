const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { importLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/usersController');

// In-memory upload for CSV/XLSX instructor import (parsed, never written to disk).
const uploadSheet = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public instructor profile (with optional auth for follower status)
router.get('/instructor/:id', optionalAuth, asyncHandler(ctrl.getInstructorProfile));
router.post('/instructor/:id/follow', authenticate, asyncHandler(ctrl.followInstructor));
router.post('/instructor/:id/unfollow', authenticate, asyncHandler(ctrl.unfollowInstructor));

router.post('/invite-admin', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.inviteAdmin));
router.put('/:id/departments', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.setAdminDepartments));
router.get('/:id/departments', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getUserDepartments));
router.post('/instructors', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createInstructor));
router.get('/instructors/template', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.downloadInstructorTemplate));
router.get('/students/template', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.downloadStudentTemplate));
router.post('/instructors/import', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.importInstructors));
router.post('/students/import', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.importStudents));
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAll));
router.get('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getById));
router.put('/:id/role', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateRole));
router.put('/:id/reset-password', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.resetUserPassword));
router.put('/:id/toggle-status', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.toggleStatus));
router.put('/:id/subscription', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.assignPlan));
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteUser));

router.post('/instructor-request', authenticate, asyncHandler(ctrl.submitInstructorRequest));
router.get('/instructor-requests', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getInstructorRequests));
router.put('/instructor-requests/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.approveInstructorRequest));

module.exports = router;
