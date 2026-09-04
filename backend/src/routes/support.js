const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/supportController');

// Any authenticated user can create a support request
router.post('/requests', authenticate, asyncHandler(ctrl.createRequest));

// List requests — SUPER_ADMIN sees all, others see their own
router.get('/requests', authenticate, asyncHandler(ctrl.listRequests));

// Get single request — SUPER_ADMIN or owner
router.get('/requests/:id', authenticate, asyncHandler(ctrl.getRequest));

// SUPER_ADMIN responds to a request
router.put('/requests/:id/respond', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.respondToRequest));

// SUPER_ADMIN stats
router.get('/stats', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.getStats));

module.exports = router;
