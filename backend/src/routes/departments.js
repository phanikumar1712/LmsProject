const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/departmentsController');

// Public minimal list for the registration branch picker (no auth).
router.get('/public', asyncHandler(ctrl.publicList));
// Any admin can list departments (needed for pickers/filters).
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), requirePermission('department.view'), asyncHandler(ctrl.list));
// Only SUPER_ADMIN manages the department taxonomy — enforced by permission.
router.post('/', authenticate, authorize('SUPER_ADMIN'), requirePermission('department.create'), asyncHandler(ctrl.create));
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), requirePermission('department.update'), asyncHandler(ctrl.update));
router.put('/:id/status', authenticate, authorize('SUPER_ADMIN'), requirePermission('department.update'), asyncHandler(ctrl.updateStatus));
router.put('/:id/limits', authenticate, authorize('SUPER_ADMIN'), requirePermission('department.update'), asyncHandler(ctrl.updateLimits));
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), requirePermission('department.delete'), asyncHandler(ctrl.remove));

module.exports = router;
