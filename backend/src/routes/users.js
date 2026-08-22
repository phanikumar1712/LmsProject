const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { importLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/usersController');

// In-memory upload for CSV/XLSX instructor import (parsed, never written to disk).
const uploadSheet = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public instructor profile (with optional auth for follower status)
router.get('/instructor/:id', optionalAuth, asyncHandler(ctrl.getInstructorProfile));
router.post('/instructor/:id/follow', authenticate, asyncHandler(ctrl.followInstructor));
router.post('/instructor/:id/unfollow', authenticate, asyncHandler(ctrl.unfollowInstructor));

router.post('/invite-admin', authenticate, authorize('SUPER_ADMIN'), requirePermission('admin.create'), asyncHandler(ctrl.inviteAdmin));
router.put('/:id/departments', authenticate, authorize('SUPER_ADMIN'), requirePermission('admin.update'), asyncHandler(ctrl.setAdminDepartments));
router.get('/:id/departments', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getUserDepartments));

// ── Granular permission management (SUPER_ADMIN only) ────────────────────────
router.get('/:id/permissions', authenticate, authorize('SUPER_ADMIN'), requirePermission('permission.manage'), asyncHandler(ctrl.getUserPermissions));
router.put('/:id/permissions', authenticate, authorize('SUPER_ADMIN'), requirePermission('permission.manage'), asyncHandler(ctrl.updateUserPermissions));

router.post('/students', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('student.create'), asyncHandler(ctrl.createStudent));
router.post('/instructors', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('instructor.create'), asyncHandler(ctrl.createInstructor));
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('student.update', 'instructor.update', 'admin.update'), asyncHandler(ctrl.updateUser));
router.post('/bulk/status', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('user.status.update'), asyncHandler(ctrl.bulkToggleStatus));
router.post('/bulk/delete', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('student.delete', 'instructor.delete'), asyncHandler(ctrl.bulkDeleteUsers));
router.post('/bulk/assign', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('student.update'), asyncHandler(ctrl.bulkAssignCohort));
router.get('/instructors/template', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('instructor.create'), asyncHandler(ctrl.downloadInstructorTemplate));
router.get('/students/template', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('student.create'), asyncHandler(ctrl.downloadStudentTemplate));
router.post('/instructors/import', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('instructor.create'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.importInstructors));
router.post('/instructors/preview', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('instructor.create'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.previewInstructors));
router.post('/students/import', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('student.create'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.importStudents));
router.post('/students/preview', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('student.create'), importLimiter, uploadSheet.single('file'), asyncHandler(ctrl.previewStudents));
router.post('/instructor-request', authenticate, asyncHandler(ctrl.submitInstructorRequest));
router.get('/instructor-requests', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('instructor.create'), asyncHandler(ctrl.getInstructorRequests));
router.put('/instructor-requests/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('instructor.create'), asyncHandler(ctrl.approveInstructorRequest));

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('user.view'), asyncHandler(ctrl.getAll));
// Instructors may view students enrolled in their own courses (grade.update
// implies read access to the learners being graded); admins view dept users.
router.get('/:id', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), requirePermission('user.view', 'grade.update'), asyncHandler(ctrl.getById));
router.put('/:id/role', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('user.role.change'), asyncHandler(ctrl.updateRole));
router.put('/:id/reset-password', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('user.password.reset'), asyncHandler(ctrl.resetUserPassword));
router.put('/:id/toggle-status', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('user.status.update'), asyncHandler(ctrl.toggleStatus));
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('student.delete', 'instructor.delete', 'admin.delete'), asyncHandler(ctrl.deleteUser));

module.exports = router;
