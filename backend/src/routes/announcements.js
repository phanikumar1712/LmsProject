const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/announcementsController');

router.get('/', authenticate, asyncHandler(ctrl.list));
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.create));
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.update));
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.remove));
router.post('/:id/mark-read', authenticate, asyncHandler(ctrl.markRead));
router.get('/:id/reads', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(ctrl.getReads));

module.exports = router;
