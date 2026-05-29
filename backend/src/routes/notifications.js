const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/notificationsController');

router.get('/', authenticate, asyncHandler(ctrl.getByUser));
router.put('/read-all', authenticate, asyncHandler(ctrl.markAllRead));
router.put('/:id/read', authenticate, asyncHandler(ctrl.markRead));
router.delete('/clear-all', authenticate, asyncHandler(ctrl.clearAll));

module.exports = router;
