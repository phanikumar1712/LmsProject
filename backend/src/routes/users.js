const router = require('express').Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/usersController');

// Public instructor profile (with optional auth for follower status)
router.get('/instructor/:id', optionalAuth, asyncHandler(ctrl.getInstructorProfile));
router.post('/instructor/:id/follow', authenticate, asyncHandler(ctrl.followInstructor));
router.post('/instructor/:id/unfollow', authenticate, asyncHandler(ctrl.unfollowInstructor));

router.post('/invite-admin', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.inviteAdmin));
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAll));
router.put('/:id/role', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateRole));
router.put('/:id/toggle-status', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.toggleStatus));
router.put('/:id/subscription', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.assignPlan));
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteUser));

router.post('/instructor-request', authenticate, asyncHandler(ctrl.submitInstructorRequest));
router.get('/instructor-requests', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getInstructorRequests));
router.put('/instructor-requests/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.approveInstructorRequest));

module.exports = router;
