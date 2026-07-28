const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/departmentsController');

// Public minimal list for the registration branch picker (no auth).
router.get('/public', asyncHandler(ctrl.publicList));
// Any admin can list departments (needed for pickers/filters).
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.list));
// Only SUPER_ADMIN manages the department taxonomy.
router.post('/', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.create));
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.update));
router.put('/:id/limits', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.updateLimits));
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.remove));

module.exports = router;
