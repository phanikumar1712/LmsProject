const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/usersController');

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getAll));
router.put('/:id/role', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateRole));
router.put('/:id/toggle-status', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.toggleStatus));
router.put('/:id/subscription', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.assignPlan));
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.deleteUser));

router.post('/instructor-request', authenticate, asyncHandler(ctrl.submitInstructorRequest));
router.get('/instructor-requests', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getInstructorRequests));
router.put('/instructor-requests/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.approveInstructorRequest));

module.exports = router;
