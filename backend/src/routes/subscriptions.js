const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/subscriptionsController');

// Subscription plans
router.get('/plans', asyncHandler(ctrl.getPlans));
router.post('/upgrade', authenticate, asyncHandler(ctrl.upgrade));
router.post('/plans', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.createPlan));
router.put('/plans/:id', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.updatePlan));
router.delete('/plans/:id', authenticate, authorize('SUPER_ADMIN'), asyncHandler(ctrl.deletePlan));

module.exports = router;
