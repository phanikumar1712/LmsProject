const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/versionsController');

// Version management (instructors + admins)
router.post('/:id/versions', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.createVersion));
router.get('/:id/versions', authenticate, asyncHandler(ctrl.getVersions));
router.get('/:id/versions/:versionId', authenticate, asyncHandler(ctrl.getVersionById));
router.put('/:id/versions/:versionId/changelog', authenticate, authorize('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.updateChangelog));

// Drip status (students)
router.get('/:id/drip-status', authenticate, asyncHandler(ctrl.getDripStatus));

module.exports = router;
